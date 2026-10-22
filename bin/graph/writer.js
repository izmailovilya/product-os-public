const fs = require('fs')
const path = require('path')
const { workspaceLock, recoverPending, commitFiles } = require('./storage')
const { criterionId, digest, edgeKey, scopedId, nonempty, evidenceUsable, validateGraph, STATUSES } = require('./schema')
const clone = value => JSON.parse(JSON.stringify(value))
const { mergeCompetitors } = require('./competitors')

// Explicit null clears a field; absence leaves it alone. Arrays replace rather than append.
function mergeData(previous, patch) {
  const next = { ...(previous || {}) }
  for (const [key, value] of Object.entries(patch || {})) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Недопустимое имя поля')
    if (value === undefined) continue
    if (value === null) delete next[key]
    else if (typeof value === 'object' && !Array.isArray(value)) next[key] = mergeData(next[key], value)
    else next[key] = clone(value)
  }
  return next
}

const ORIGIN_ALIASES = { field: 'test', 'field-test': 'test', experiment: 'test', review: 'web', 'web-review': 'web' }

function migrateGraph(input) {
  const g = clone(input), warnings = []
  g.nodes ||= []; g.edges ||= []
  const by = new Map(g.nodes.map(n => [n.id, n]))
  for (const n of g.nodes) {
    n.data ||= {}; n.status ||= 'hypothesis'
    if (!n.source) { n.source = `research-graph.json#${n.id}`; n.data.legacyUnverified = true }
    if (n.type === 'evidence' && !n.data.origin) n.data.origin = /^https?:\/\//.test(n.source) ? 'web' : 'unknown'
    // aliases written around the typed writer before the vocabulary was enforced: a "field"
    // observation is our own experiment (control purchase, correspondence) → test. Logged, never silent.
    if (n.type === 'evidence' && ORIGIN_ALIASES[n.data.origin]) { warnings.push(`${n.id}: origin "${n.data.origin}" → "${ORIGIN_ALIASES[n.data.origin]}"`); n.data.origin = ORIGIN_ALIASES[n.data.origin] }
  }
  for (const e of g.edges.filter(e => e.type === 'produced')) {
    const n = by.get(e.to), art = by.get(e.from)
    if (n?.data.legacyUnverified && art?.source) n.source = art.source
  }
  g.edges = g.edges.filter(e => e.type !== 'produced')
  // an edge to a node that does not exist blocks the whole map behind the validator; the
  // fact it carried is already lost (no node, no label) — quarantine it with a warning
  // instead of hiding 500 good edges behind 5 broken ones. Read-time only: the file is untouched.
  // legacy vocabulary: a segment "competes_for" a competitor meant "hires" it (the canon word)
  for (const e of g.edges) {
    if (e.type === 'competes_for' && by.get(e.from)?.type === 'segment' && by.get(e.to)?.type === 'competitor') { warnings.push(`${e.from} competes_for ${e.to} → hires`); e.type = 'hires' }
  }
  const seen = new Set()
  g.edges = g.edges.filter(e => {
    const k = `${e.from}|${e.type}|${e.to}`
    if (seen.has(k)) { warnings.push(`дубликат связи ${k} исключён`); return false }
    seen.add(k)
    if (by.has(e.from) && by.has(e.to)) return true
    warnings.push(`висячая связь ${e.type} ${e.from} → ${e.to} исключена из карты (узел не найден)`)
    return false
  })
  for (const e of g.edges.filter(e => e.type === 'performs')) {
    e.data ||= {}
    if (!Array.isArray(e.data.criteria)) {
      const all = g.edges.filter(x => x.type === 'judged_by' && x.from === e.to)
      const own = all.filter(x => x.data?.segment === e.from)
      e.data.criteria = (own.length ? own : all.filter(x => !x.data?.segment))
        .sort((a, b) => (a.data?.priority || 99) - (b.data?.priority || 99)).map((x, i) => ({ id: x.to, priority: i + 1 }))
    }
    e.data.context ||= by.get(e.from)?.data.context
  }
  const uses = new Map()
  for (const e of g.edges.filter(e => e.type === 'performs')) for (const ref of e.data.criteria) {
    if (!uses.has(ref.id)) uses.set(ref.id, [])
    uses.get(ref.id).push(e)
  }
  const legacy = new Set(), extraEdges = []
  for (const [id, pairs] of uses) {
    const old = by.get(id)
    if (!old || old.type !== 'criterion' || old.data.segmentId) continue
    legacy.add(id)
    for (const pe of pairs) {
      const newId = criterionId(pe.from, pe.to, old.label, old.data.level)
      const n = { ...clone(old), id: newId, data: { ...clone(old.data), segmentId: pe.from, jobId: pe.to, legacyId: id } }
      const evidence = g.edges.filter(e => e.from === id && ['evidenced_by', 'contradicted_by'].includes(e.type))
      const certain = evidence.filter(e => pairs.length === 1 || by.get(e.to)?.data.segmentId === pe.from)
      if (pairs.length > 1 && (certain.length === 0 || certain.length !== evidence.length)) {
        n.status = 'hypothesis'; n.data.legacyScopeUnknown = true
        warnings.push(`Критерий ${id}: старые свидетельства без контекста не перенесены в ${pe.from}.`)
      }
      const supportingType = n.status === 'contradicted' ? 'contradicted_by' : 'evidenced_by'
      if (['evidenced', 'validated', 'contradicted'].includes(n.status) && !certain.some(e => e.type === supportingType && evidenceUsable(by.get(e.to)) && (n.status !== 'validated' || ['interview', 'test', 'payment'].includes(by.get(e.to)?.data?.origin)))) {
        n.status = 'hypothesis'; n.data.legacyUnverified = true
      }
      if (!by.has(newId)) { g.nodes.push(n); by.set(newId, n) }
      pe.data.criteria = pe.data.criteria.map(ref => ref.id === id ? { ...ref, id: newId } : ref)
      extraEdges.push({ from: pe.to, to: newId, type: 'judged_by' })
      extraEdges.push(...certain.map(e => ({ ...clone(e), from: newId })))
      for (const e of g.edges.filter(e => e.type === 'implies' && e.to === id)) {
        if (g.edges.some(x => x.type === 'suffers' && x.from === pe.from && x.to === e.from)) extraEdges.push({ ...clone(e), to: newId })
      }
      for (const e of g.edges.filter(e => e.type === 'sub_segment_of' && e.from === pe.from)) {
        if (e.data?.addedCriteria) e.data.addedCriteria = e.data.addedCriteria.map(ref => ref.id === id ? { ...ref, id: newId } : ref)
      }
    }
    // Keep the original card and its citations as a historical record, never attach it to
    // another segment again. The original graph is also retained in transaction history.
    old.data.retired = true
  }
  g.edges = g.edges.filter(e => !(e.type === 'judged_by' && legacy.has(e.to)))
  const keys = new Set(g.edges.map(edgeKey))
  for (const e of extraEdges) if (!keys.has(edgeKey(e))) { g.edges.push(e); keys.add(edgeKey(e)) }
  g.version = 2; g.contractVersion = 3; g.revision ||= 0
  return { graph: g, warnings }
}

class GraphTransaction {
  constructor(workspace, options = {}) {
    this.workspace = path.resolve(workspace); this.options = options
    this.file = path.join(this.workspace, 'research-graph.json')
    this.release = workspaceLock(this.workspace, options)
    try {
      recoverPending(this.workspace)
      this.raw = fs.existsSync(this.file) ? fs.readFileSync(this.file, 'utf8') : null
      this.original = this.raw ? JSON.parse(this.raw) : { version: 2, product: path.basename(this.workspace), nodes: [], edges: [], revision: 0 }
      if (options.expectedRevision != null && options.expectedRevision !== (this.original.revision || 0)) throw Object.assign(new Error('Граф изменился. Перечитай нужный срез и повтори операцию.'), { code: 'REVISION_CONFLICT' })
      const migrated = migrateGraph(this.original)
      this.graph = migrated.graph; this.warnings = migrated.warnings
      this.before = clone(this.graph)
      this.source = options.source || null; this.pending = []; this.decisions = []
      this.files = new Map()
      this.designCompletions = new Map()
      this.removals = new Set()
    } catch (error) { this.release(); throw error }
  }

  mergeCompetitors(group) {
    const result = mergeCompetitors(this.graph, { ...group, source: group.source || this.source })
    for (const id of result.removedIds) this.removals.add(id)
    return result
  }

  node(id, type, label, extra = {}) {
    if (type === 'evidence') throw new Error('Наблюдения записываются операцией evidence, а не node')
    if (type === 'criterion' && (!extra.data?.segmentId || !extra.data?.jobId) && !this.graph.nodes.some(n => n.id === id && n.data?.segmentId)) throw new Error('Критерию нужны segmentId и jobId')
    let n = this.graph.nodes.find(n => n.id === id)
    if (n?.type === 'criterion' && label && label !== n.label) throw new Error('Изменение критерия требует нового ID')
    if (n?.type === 'criterion' && ['segmentId', 'jobId', 'level'].some(k => extra.data?.[k] !== undefined && extra.data[k] !== n.data?.[k])) throw new Error('Смена контекста или порога требует нового критерия')
    if (n && n.type !== type) throw new Error(`Тип узла ${id} нельзя изменить`)
    if (type === 'artifact' && (extra.data?.kind || n?.data?.kind) === 'research-reading-review') {
      const candidate = { source: extra.source || this.source || n?.source, data: mergeData(n?.data || {}, extra.data || {}) }
      const issue = require('../research-brief/reading-review').readingReviewIssue(this.workspace, candidate)
      if (issue) throw new Error(issue)
    }
    if (!n) {
      n = { id, type, label, status: 'hypothesis', source: extra.source || this.source, data: {} }
      this.graph.nodes.push(n)
    }
    if (label) n.label = label
    if (extra.source || this.source) n.source = extra.source || this.source
    if (extra.data) {
      for (const key of ['statusHistory', 'resolution', 'research', 'updatedAt']) if (Object.hasOwn(extra.data, key)) throw new Error(`${key} записывается специальной операцией, а не node`)
      n.data = mergeData(n.data, extra.data)
    }
    if (extra.status && extra.status !== 'hypothesis') this.pending.push({ id, status: extra.status })
    return n
  }

  edge(from, type, to, data) {
    if (['evidenced_by', 'contradicted_by'].includes(type) && ['resolvedAt', 'resolution', 'resolvedBy'].some(k => data && Object.hasOwn(data, k))) throw new Error('Разрешать свидетельства можно только через transition')
    let e = this.graph.edges.find(e => e.from === from && e.type === type && e.to === to)
    if (!e) { e = { from, type, to }; this.graph.edges.push(e) }
    if (data) e.data = mergeData(e.data, data)
    return e
  }

  observe({ target, text, source, origin, segmentId, jobId, productId, observationId, respondentId, relation = 'evidenced_by', ...extra }) {
    if (!['evidenced_by', 'contradicted_by'].includes(relation)) throw new Error('Неверная связь свидетельства')
    if (!nonempty(source) || !nonempty(text) || !['web', 'interview', 'test', 'payment'].includes(origin)) throw new Error('Наблюдению нужны текст, первичный источник и происхождение')
    if (!/^https?:\/\//.test(source) && !/^sources\//.test(source)) throw new Error('Источник наблюдения — URL или оригинал в sources/, не вывод из отчёта')
    if (/^sources\//.test(source)) {
      const file = path.resolve(this.workspace, source.split('#')[0]), root = path.join(this.workspace, 'sources')
      if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.realpathSync(file).startsWith(`${fs.realpathSync(root)}${path.sep}`)) throw new Error('Оригинал свидетельства не найден внутри sources/')
    } else { const url = new URL(source); if (!url.hostname) throw new Error('Неверный URL источника') }
    const subject = this.graph.nodes.find(n => n.id === target)
    if (!subject) throw new Error(`Цель наблюдения не найдена: ${target}`)
    segmentId ||= subject.data?.segmentId || (subject.type === 'segment' ? subject.id : undefined)
    jobId ||= subject.data?.jobId
    const data = { ...extra, origin, kind: extra.kind || 'quote' }
    delete data.op; delete data.as
    for (const [key, value] of Object.entries({ segmentId, jobId, productId, observationId: observationId || source.split('#')[0], respondentId })) if (value) data[key] = value
    const id = `ev-${digest([source, text, data])}`
    let ev = this.graph.nodes.find(n => n.id === id)
    if (!ev) { ev = { id, type: 'evidence', label: text, source, status: 'evidenced', data }; this.graph.nodes.push(ev) }
    this.edge(target, relation, id)
    return ev
  }

  transition({ id, status, evidenceIds = [], reason, resolves = [], reopen = false, resolutionKind, source = this.source }) {
    const n = this.graph.nodes.find(n => n.id === id)
    if (!n || !STATUSES.has(status)) throw new Error(`Неверная смена статуса: ${id}`)
    if (n.type === 'evidence') throw new Error('Статус наблюдения неизменен; исправление оформляется новым наблюдением')
    const linked = relation => this.graph.edges.filter(e => e.from === id && e.type === relation && !e.data?.resolvedAt)
      .filter(e => evidenceUsable(this.graph.nodes.find(n => n.id === e.to)))
    const good = linked(status === 'contradicted' ? 'contradicted_by' : 'evidenced_by')
    const selected = good.filter(e => evidenceIds.includes(e.to))
    if (['evidenced', 'validated', 'contradicted'].includes(status) && !selected.length) throw new Error(`Статус ${status} у ${id} требует связанного первичного свидетельства`)
    if (status === 'validated' && !selected.some(e => ['interview', 'test', 'payment'].includes(this.graph.nodes.find(n => n.id === e.to).data.origin))) throw new Error(`Валидация ${id} требует клиентских данных`)
    if (n.status === 'dropped' && (!reopen || !nonempty(reason))) throw new Error(`Возврат ${id} требует явного reopen и причины`)
    if (['hypothesis', 'dropped'].includes(status) && (!nonempty(reason) || !nonempty(source))) throw new Error('Снятие или повторное открытие гипотезы требует причины и источника решения')
    const opposite = linked(status === 'contradicted' ? 'evidenced_by' : 'contradicted_by')
    if (status !== 'contradicted' && !['hypothesis', 'dropped'].includes(status) && opposite.some(e => !resolves.includes(e.to))) throw new Error(`У ${id} есть неразрешённые опровержения; укажи resolves и объяснение`)
    if (resolves.length && !nonempty(reason)) throw new Error('Разрешение противоречия требует объяснения')
    for (const evId of resolves) {
      const e = opposite.find(e => e.to === evId)
      if (!e) throw new Error(`Неизвестное разрешаемое свидетельство: ${evId}`)
      e.data = { ...e.data, resolvedAt: new Date().toISOString(), resolution: reason, resolvedBy: evidenceIds }
    }
    const event = { from: n.status, to: status, evidenceIds, reason: reason || 'Новое связанное свидетельство', source, at: new Date().toISOString() }
    n.data.statusHistory = [...(n.data.statusHistory || []), event]
    n.status = status; this.decisions.push({ id, ...event })
    if (status === 'dropped') n.data.resolution = { kind: resolutionKind === 'dependency-removed' ? resolutionKind : 'not-pursued', reason, source }
    else if (n.data.resolution) delete n.data.resolution
    return n
  }

  complete({ nodeId, skill, report, runId, outcome = 'completed', storage }) {
    const n = this.graph.nodes.find(n => n.id === nodeId)
    this.validateReport(report)
    if (!['completed', 'failed'].includes(outcome)) throw new Error('Неверный исход исследования')
    if (!n || !nonempty(skill) || !/^reports\/.+\.md$/.test(report || '')) throw new Error('Завершению нужны узел, скилл и отчёт')
    if (skill === 'product-design' && outcome === 'completed' && !runId) throw new Error('Завершению product-design нужен runId и проверяемое закрытие хранения')
    n.data.research ||= {}
    n.data.research[skill] = { report, runId: runId || null, completedAt: new Date().toISOString(), outcome }
    if (runId) this.receipt({ runId, nodeId, skill, report, outcome, storage })
    return n
  }

  validateReport(report) {
    const file = path.resolve(this.workspace, report || ''), root = path.join(this.workspace, 'reports')
    const staged = this.files.get(report)
    if (report?.endsWith('.md') && file.startsWith(`${root}${path.sep}`) && staged && /^reports\/communications\/run-[a-z0-9-]+\.md$/i.test(report)) return
    if (!report?.endsWith('.md') || !file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile() || !fs.realpathSync(file).startsWith(`${fs.realpathSync(root)}${path.sep}`)) throw new Error('Отчёт результата должен существовать в reports/ этого воркспейса')
  }

  stageFile(relative, content) {
    const file = path.join(this.workspace, relative)
    const old = this.files.get(relative)
    this.files.set(relative, { path: relative, content, before: old?.before || digest(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null) })
  }

  receipt({ runId, nodeId, skill, report = null, summary, outcome = 'completed', storage }) {
    if (!/^run-[a-z0-9-]+$/i.test(runId || '') || !['completed', 'failed'].includes(outcome) || !this.graph.nodes.some(n => n.id === nodeId) || !nonempty(skill)) throw new Error('Неверный результат запуска')
    if (!report && !nonempty(summary)) throw new Error('Результату нужен отчёт или содержательное резюме')
    const stateFile = path.join(this.workspace, '.product-os', 'state.json')
    if (fs.existsSync(stateFile)) {
      const launch = JSON.parse(fs.readFileSync(stateFile, 'utf8')).launches?.find(l => (l.runId || l.id) === runId)
      if (launch && (launch.move?.skill !== skill || (launch.move?.receiptNodeId || launch.move?.node?.id) !== nodeId)) throw new Error('Результат не совпадает со скиллом/узлом фактического запуска')
    }
    if (report) {
      this.validateReport(report)
      const root = path.join(this.workspace, '.product-os', 'runs')
      for (const name of fs.existsSync(root) ? fs.readdirSync(root).filter(f => f.endsWith('.json')) : []) {
        const previous = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
        if (previous.report === report && previous.runId !== runId) throw new Error('Этот отчёт уже принадлежит другому запуску')
      }
      const text = this.files.get(report)?.content ?? fs.readFileSync(path.join(this.workspace, report), 'utf8')
      const declared = text.match(/^---\n[\s\S]*?^runId:\s*["']?([^\s"']+)/m)?.[1]
      if (declared && declared !== runId) throw new Error('runId отчёта не совпадает с результатом запуска')
    }
    const relative = `.product-os/runs/${runId}.json`
    if (fs.existsSync(path.join(this.workspace, relative)) || this.files.has(relative)) throw new Error('Результат этого запуска уже записан')
    this.stageFile(relative, JSON.stringify({ runId, nodeId, skill, report, summary, outcome, graphRevision: (this.original.revision || 0) + 1, completedAt: new Date().toISOString() }, null, 2))
    if (skill === 'product-design' && outcome === 'completed') this.designCompletions.set(relative, clone({ runId, nodeId, skill, report, storage }))
  }

  move(move) {
    const { upsertMove } = require('../moves')
    const file = path.join(this.workspace, 'MOVES.md')
    const current = this.files.get('MOVES.md')?.content ?? (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
    const result = upsertMove(current, move)
    this.stageFile('MOVES.md', result.text)
    return result.id
  }

  syncMoves() {
    const { parseMoves, withMoveIds } = require('../moves')
    const file = path.join(this.workspace, 'MOVES.md')
    const current = this.files.get('MOVES.md')?.content ?? (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null)
    if (current == null) return
    const text = withMoveIds(current)
    if (text !== current) this.stageFile('MOVES.md', text)
    const activeIds = new Set()
    for (const item of parseMoves(text)) {
      activeIds.add(item.id)
      const title = item.text.split('\n')[0].replace(/\*\*/g, '')
      const n = this.node(item.id, 'move', title, { source: `MOVES.md#${item.id}`, data: {
        description: item.text, horizon: /сейчас/i.test(item.section) ? 'now' : /позже/i.test(item.section) ? 'later' : 'next',
        expectedOutcome: item.expectedOutcome,
        completed: item.done || /сделано|отброшено/i.test(item.section), nodeId: item.nodeId, skill: item.skill,
        suggestionId: item.suggestionId, fingerprint: item.fingerprint, executionReady: item.executionReady, issues: item.issues, killCriterion: item.killCriterion, usesAssets: item.usesAssets,
        failureTest: item.failureTest, resources: item.resources, dependsOn: item.dependsOn, servesGoal: item.servesGoal, respectsConstraints: item.respectsConstraints,
      } })
      n.data.retired = false
      if (item.testsAssumptionId) this.edge(n.id, 'tests', item.testsAssumptionId)
    }
    for (const n of this.graph.nodes.filter(n => n.type === 'move' && /^MOVES\.md/.test(n.source || ''))) if (!activeIds.has(n.id)) n.data.retired = true
  }

  commit() {
    try {
      this.syncMoves()
      for (const pending of this.pending) {
        const n = this.graph.nodes.find(n => n.id === pending.id)
        if (!n || n.status === pending.status) continue
        const type = pending.status === 'contradicted' ? 'contradicted_by' : 'evidenced_by'
        const evidenceIds = this.graph.edges.filter(e => e.from === n.id && e.type === type && !e.data?.resolvedAt).map(e => e.to)
        try { this.transition({ ...pending, evidenceIds, source: n.source }) }
        catch (error) { if (this.options.strict) throw error; this.warnings.push(error.message) }
      }
      const by = new Map(this.graph.nodes.map(n => [n.id, n]))
      for (const old of this.before.nodes) {
        const n = by.get(old.id)
        if (!n && !this.removals.has(old.id)) throw new Error(`Нельзя удалить ${old.id}; используй статус dropped`)
        if (!n) continue
        if (['evidence', 'communication_decision'].includes(old.type) && JSON.stringify(old) !== JSON.stringify(n)) throw new Error(`Свидетельство ${old.id} неизменно`)
        if (old.status !== n.status && !this.decisions.some(e => e.id === n.id) && !this.removals.has(n.id)) throw new Error(`Статус ${n.id} изменён в обход transition`)
      }
      for (const n of this.graph.nodes) {
        const old = this.before.nodes.find(x => x.id === n.id)
        if (n.type !== 'evidence' && JSON.stringify(n) !== JSON.stringify(old)) n.data = { ...n.data, updatedAt: new Date().toISOString() }
      }
      require('../research/store').prepare(this)
      const error = validateGraph(this.graph)
      if (error) throw new Error(error)
      const latest = fs.existsSync(this.file) ? fs.readFileSync(this.file, 'utf8') : null
      if (latest !== this.raw) throw Object.assign(new Error('Граф изменён в обход писателя. Запись отменена без потери данных.'), { code: 'REVISION_CONFLICT' })
      if (this.research && this.files.size === 0 && JSON.stringify(this.graph) === JSON.stringify(this.original)) return { graph: this.graph, warnings: this.warnings, research: { revision: this.research.revision, factRevision: this.research.factRevision, path: 'research/research-data.json', unchanged: true } }
      this.graph.revision = (this.original.revision || 0) + 1
      if (!this.options.dry) {
        const files = [...this.files.values()]
        for (const entry of files) {
          const file = path.join(this.workspace, entry.path)
          if (digest(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null) !== entry.before) throw Object.assign(new Error(`${entry.path} изменён во время транзакции`), { code: 'REVISION_CONFLICT' })
        }
        for (const [relative, request] of this.designCompletions) {
          const completion = require('../design-completion').finalize(this.workspace, request)
          const entry = this.files.get(relative)
          entry.content = JSON.stringify({ ...JSON.parse(entry.content), storage: completion }, null, 2)
        }
        files.push({ path: 'research-graph.json', before: digest(this.raw), content: `${JSON.stringify(this.graph, null, 2)}\n` })
        commitFiles(this.workspace, files)
      }
      else for (const request of this.designCompletions.values()) require('../design-completion').finalize(this.workspace, request, { dryRun: true })
      return { graph: this.graph, warnings: this.warnings, ...(this.research ? { research: { path: 'research/research-data.json', revision: this.research.revision, factRevision: this.research.factRevision, checkpoints: this.research.checkpoints.map(c=>({id:c.id,status:c.status})) } } : {}) }
    } finally { this.close() }
  }

  close() { if (this.release) { this.release(); this.release = null } }
}

function applyOperations(workspace, input, options = {}) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.operations)) throw new Error('Нужен пакет {schemaVersion: 1, source, operations: []}')
  const tx = new GraphTransaction(workspace, { ...options, source: input.source, expectedRevision: input.expectedRevision, expectedResearchRevision: input.expectedResearchRevision, strict: true })
  try {
    const refs = new Map()
    for (const operation of input.operations) {
      if (['research-put', 'research-update', 'research-coverage', 'research-checkpoint', 'research-provenance'].includes(operation.op)) require('../research/store').apply(tx, operation)
      else if (operation.op === 'node') {
        const { id, type, label, ...extra } = operation.node || {}
        // Confidence says who stands behind an unproven hypothesis. It never replaces evidence-based status.
        const confidence = extra.data?.confidence
        if (confidence !== undefined && confidence !== null) {
          if (!['expert', 'ai'].includes(confidence)) throw new Error('Уверенность гипотезы: expert или ai')
          if (confidence === 'expert' && !nonempty(extra.data.confidenceSource)) throw new Error('Экспертной гипотезе нужен confidenceSource: чьё решение и где оно записано')
        }
        tx.node(id, type, label, extra)
      } else if (operation.op === 'normalize-competition') require('./competition-normalization').normalizeCompetition(tx, operation)
      else if (operation.op === 'merge-competitors') tx.mergeCompetitors(operation)
      else if (operation.op === 'edge') {
        const { from, type, to, data } = operation.edge || {}
        tx.edge(from, type, to, data)
      } else if (operation.op === 'evidence') {
        const ev = tx.observe(operation)
        if (operation.as) refs.set(`$${operation.as}`, ev.id)
      } else if (operation.op === 'transition') tx.transition({ ...operation,
        evidenceIds: (operation.evidenceIds || []).map(id => refs.get(id) || id),
        resolves: (operation.resolves || []).map(id => refs.get(id) || id),
      })
      else if (operation.op === 'research-brief') {
        if (require('../edition').isPublicEdition()) throw new Error('Брифы исследований не создаются в Product OS Public')
        require('../research-brief/store').apply(tx, operation)
      }
      else if (operation.op === 'complete') tx.complete(operation)
      else if (operation.op === 'move') tx.move(operation)
      else if (operation.op === 'communication') require('./communications').communication(tx, operation)
      else if (operation.op === 'receipt') tx.receipt(operation)
      else throw new Error(`Неизвестная операция: ${operation.op}`)
    }
    return tx.commit()
  } finally { tx.close() }
}

module.exports = { GraphTransaction, applyOperations, migrateGraph, mergeData, criterionId, scopedId }
