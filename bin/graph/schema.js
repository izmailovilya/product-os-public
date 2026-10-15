const crypto = require('crypto')
const { validateVisualAssets } = require('./visual-assets')

const NODE_TYPES = new Set(['product', 'job', 'segment', 'criterion', 'evidence', 'competitor', 'problem', 'channel', 'assumption', 'move', 'artifact', 'role', 'journey', 'touchpoint', 'rubric', 'reference', 'communication_decision'])
const STATUSES = new Set(['hypothesis', 'evidenced', 'validated', 'contradicted', 'dropped'])
const ORIGINS = new Set(['web', 'interview', 'test', 'payment', 'unknown'])
const SUBJECTS = [...NODE_TYPES].filter(type => type !== 'evidence')
const RELATIONS = {
  mentions_solution: [['competitor'], ['competitor']],
  subproduct_of: [['product', 'channel'], ['product', 'channel']], serves: [['product', 'channel'], ['segment']],
  journey_offer: [['journey'], ['product', 'channel']], journey_segment: [['journey'], ['segment']], has_contact: [['journey'], ['touchpoint']],
  contact_job: [['touchpoint'], ['job']], contact_channel: [['touchpoint'], ['channel']], contact_rubric: [['touchpoint'], ['rubric']], uses_material: [['touchpoint'], ['artifact']],
  channel_offer: [['channel'], ['product', 'channel']], channel_segment: [['channel'], ['segment']], rubric_channel: [['rubric'], ['channel']],
  material_channel: [['artifact'], ['channel']],
  material_offer: [['artifact'], ['product', 'channel']], material_segment: [['artifact'], ['segment']],
  reference_for: [['reference'], ['touchpoint', 'channel', 'rubric', 'competitor']],
  decides: [['communication_decision'], ['rubric']], based_on: [['communication_decision'], ['evidence']],
  performs: [['segment', 'role'], ['job']], in_order_to: [['job'], ['job']],
  judged_by: [['job'], ['criterion']], evidenced_by: [SUBJECTS, ['evidence']],
  contradicted_by: [SUBJECTS, ['evidence']], competes_for: [['competitor', 'product', 'channel'], ['job']],
  hires: [['segment'], ['competitor']], suffers: [['segment'], ['problem']],
  fails_at: [['competitor'], ['problem']], communicates: [['competitor'], ['job']],
  implies: [['problem'], ['criterion']], reached_via: [['segment'], ['channel']],
  about: [['assumption'], ['segment', 'job', 'channel', 'product']], tests: [['move'], ['assumption']],
  involves: [['segment'], ['role']], sub_segment_of: [['segment'], ['segment']],
}
const EDGE_TYPES = new Set(Object.keys(RELATIONS))
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20)
const edgeKey = e => `${e.from}|${e.type}|${e.to}`
const scopedId = (prefix, scope, text) => `${prefix}-${String(text || 'item').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 36) || 'item'}-${digest([scope, text])}`
const criterionId = (segmentId, jobId, text, level) => scopedId('crit', [segmentId, jobId, level || ''], text)
const safeId = id => typeof id === 'string' && /^[a-zа-яё0-9][a-zа-яё0-9_.:-]{0,239}$/i.test(id) && !['constructor', 'prototype', '__proto__'].includes(id)
const nonempty = x => typeof x === 'string' && Boolean(x.trim())

function evidenceUsable(node) {
  return node?.type === 'evidence' && nonempty(node.label) && nonempty(node.source)
    && !/^research-graph\.json(?:#|$)/.test(node.source) && !node.data?.legacyUnverified
    && !node.data?.scopeUnknown && ORIGINS.has(node.data?.origin) && node.data.origin !== 'unknown'
}

function validateGraph(graph, { requireSources = true } = {}) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return 'нет массивов nodes/edges'
  const by = new Map()
  for (const n of graph.nodes) {
    if (!n || !safeId(n.id) || by.has(n.id)) return `дублирующийся или неверный id: ${n?.id || '—'}`
    if (!NODE_TYPES.has(n.type)) return `неизвестный тип узла: ${n.type}`
    if (!nonempty(n.label) || (requireSources && !nonempty(n.source))) return `у узла ${n.id} нет label/source`
    if (n.status && !STATUSES.has(n.status)) return `неизвестный статус: ${n.id}: ${n.status}`
    if (n.data != null && (typeof n.data !== 'object' || Array.isArray(n.data))) return `data узла ${n.id} должен быть объектом`
    if(n.data?.customerProfile){const issue=require('../customer-profile').customerProfileIssue(n.data.customerProfile);if(n.type!=='segment'||issue)return issue||'Профиль принадлежит сегменту'}
    if(n.data?.parameterModel){const issue=require('../segment-model').segmentModelIssue(n.data.parameterModel);if(n.type!=='segment'||issue)return issue||'Модель параметров принадлежит сегменту'}
    if (n.type === 'evidence' && n.data?.origin && !ORIGINS.has(n.data.origin)) return `неизвестное происхождение: ${n.id}`
    by.set(n.id, n)
  }
  const keys = new Set()
  for (const e of graph.edges) {
    if (!e || !EDGE_TYPES.has(e.type)) return `неизвестный тип связи: ${e?.type}`
    const from = by.get(e.from), to = by.get(e.to)
    if (!from || !to) return `висячая связь ${e.from} → ${e.to}`
    if (keys.has(edgeKey(e))) return `дублирующаяся связь: ${edgeKey(e)}`
    keys.add(edgeKey(e))
    const [fromTypes, toTypes] = RELATIONS[e.type]
    if (!fromTypes.includes(from.type) || !toTypes.includes(to.type)) return `неверные типы концов связи: ${edgeKey(e)}`
    if (e.from === e.to) return `связь с самим собой: ${edgeKey(e)}`
    if (e.type === 'mentions_solution' && (to.data?.isCategory || to.data?.entityType === 'category')) return `Упоминание должно вести к отдельному решению: ${e.to}`
    if (e.type === 'performs') {
      const used = new Set(), priorities = new Set()
      for (const ref of e.data?.criteria || []) {
        const c = by.get(ref.id)
        if (c?.type !== 'criterion' || used.has(ref.id) || !Number.isInteger(ref.priority) || ref.priority < 1 || priorities.has(ref.priority)) return `неверный список критериев: ${e.from} → ${e.to}`
        if (c.data?.segmentId && c.data.segmentId !== from.id) return `критерий другого сегмента: ${c.id}`
        if (c.data?.jobId && c.data.jobId !== to.id) return `критерий другой работы: ${c.id}`
        used.add(ref.id); priorities.add(ref.priority)
      }
    }
    if (['evidenced_by', 'contradicted_by'].includes(e.type) && from.data?.segmentId && to.data?.segmentId && from.data.segmentId !== to.data.segmentId) return `свидетельство другого сегмента: ${edgeKey(e)}`
  }
  const parents = new Map()
  for (const e of graph.edges.filter(e => e.type === 'sub_segment_of')) {
    if (parents.has(e.from)) return `два родителя подсегмента: ${e.from}`
    parents.set(e.from, e.to)
    for (const ref of e.data?.addedCriteria || []) if (by.get(ref.id)?.type !== 'criterion') return `неизвестный добавленный критерий: ${ref.id}`
  }
  for (const [child, parent] of parents) if (parents.has(parent)) return `подсегменты допускают только один уровень: ${child}`
  const problem = validateCommunications(graph, by)
  return problem || validateVisualAssets(graph, by)
}

function validateCommunications(graph, by) {
  const targets = (id, type) => graph.edges.filter(e => e.from === id && e.type === type).map(e => e.to)
  const parents = new Map()
  for (const e of graph.edges) {
    if (['journey_offer', 'channel_offer', 'material_offer', 'subproduct_of'].includes(e.type) && by.get(e.to)?.type === 'channel' && !by.get(e.to).data?.isOffering) return `Канал не обозначен как предложение: ${e.to}`
    if (e.type === 'subproduct_of' && by.get(e.from)?.type === 'channel' && !by.get(e.from).data?.isOffering) return `Канал не обозначен как предложение: ${e.from}`
  }
  for (const e of graph.edges.filter(e => e.type === 'subproduct_of')) {
    if (parents.has(e.from)) return `Два родителя предложения: ${e.from}`
    parents.set(e.from, e.to)
  }
  for (const id of parents.keys()) {
    const seen = new Set([id]); let next = parents.get(id)
    while (next) { if (seen.has(next)) return `Цикл предложений: ${id}`; seen.add(next); next = parents.get(next) }
  }
  const url = value => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }
  for (const n of graph.nodes) {
    const d = n.data || {}
    if (n.type === 'reference' && d.url && !url(d.url)) return `Неверная ссылка референса: ${n.id}`
    if (n.type === 'artifact' && d.kind === 'communication_material') {
      const channelIds = targets(n.id, 'material_channel')
      if (d.contextId && !channelIds.some(id => by.get(id)?.data?.contexts?.some(c => c.id === d.contextId))) return `Контекст материала относится к другому каналу: ${n.id}`
      if (d.rubricId && !targets(d.rubricId, 'rubric_channel').some(id => channelIds.includes(id))) return `Рубрика материала относится к другому каналу: ${n.id}`

      if (d.stage && !['idea', 'draft', 'review', 'ready'].includes(d.stage)) return `Неверная готовность: ${n.id}`
      if (d.publicationUrl && (!url(d.publicationUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(d.publishedAt || '') || !Number.isFinite(Date.parse(d.publishedAt)))) return `Публикации нужны ссылка и дата: ${n.id}`
      if (d.publishedAt && !d.publicationUrl) return `Публикации нужна ссылка: ${n.id}`
      if (d.feedback != null && (!Array.isArray(d.feedback) || d.feedback.some(f => !f || !nonempty(f.text) || !nonempty(f.at)))) return `Неверная история отзывов: ${n.id}`
      if (d.body != null && typeof d.body !== 'string') return `Текст материала должен быть строкой: ${n.id}`
    }
    if (n.type === 'journey') {
      if (!targets(n.id, 'journey_segment').length || !targets(n.id, 'journey_offer').length) return `Пути нужны сегмент и предложение: ${n.id}`
      if (d.jobGraph) {
        const spec = d.jobGraph, ids = spec.jobIds
        if (!Array.isArray(ids) || !ids.length || ids.length > 40 || new Set(ids).size !== ids.length || ids.some(id => by.get(id)?.type !== 'job') || !ids.includes(spec.coreJobId) || !Array.isArray(spec.transitions)) return `Неверный граф работ пути: ${n.id}`
        const segments = targets(n.id, 'journey_segment')
        // A retained job graph describes research for part of a shared contact path's audience.
        if (!segments.some(segment => targets(segment, 'performs').includes(spec.coreJobId))) return `Core Job не относится к сегменту: ${n.id}`
        if (!targets(n.id, 'journey_offer').some(id => targets(id, 'competes_for').includes(spec.coreJobId))) return `Core Job не связана с предложением пути: ${n.id}`
        const seenEdges = new Set()
        for (const e of spec.transitions) {
          if (!e || !ids.includes(e.from) || !ids.includes(e.to) || e.from === e.to || e.from === spec.coreJobId || seenEdges.has(`${e.from}:${e.to}`) || (e.condition != null && typeof e.condition !== 'string')) return `Неверный переход между работами: ${n.id}`
          seenEdges.add(`${e.from}:${e.to}`)
        }
        const done = new Set(), visiting = new Set()
        const reachesCore = id => {
          if (id === spec.coreJobId || done.has(id)) return true
          if (visiting.has(id)) return false
          visiting.add(id)
          const next = spec.transitions.filter(e => e.from === id)
          if (!next.length || !next.every(e => reachesCore(e.to))) return false
          visiting.delete(id); done.add(id); return true
        }
        if (!ids.every(reachesCore)) return `Все ветви должны вести до Core Job без цикла: ${n.id}`
      }
      const contacts = new Set(targets(n.id, 'has_contact'))
      if (d.transitions != null && !Array.isArray(d.transitions)) return `Переходы должны быть массивом: ${n.id}`
      for (const step of d.transitions || []) if (!step || !contacts.has(step.from) || !contacts.has(step.to) || step.from === step.to) return `Переход выходит за пределы пути: ${n.id}`
    }
    if (n.type === 'touchpoint') {
      for (const relation of ['contact_job', 'contact_channel', 'contact_rubric']) if (targets(n.id, relation).length > 1) return `Выбери одну связь ${relation}: ${n.id}`
      const channel = targets(n.id, 'contact_channel')[0], rubric = targets(n.id, 'contact_rubric')[0]
      if (rubric && (!channel || !targets(rubric, 'rubric_channel').includes(channel))) return `Рубрика не принадлежит каналу: ${n.id}`
    }
    if (n.type === 'rubric' && targets(n.id, 'rubric_channel').length !== 1) return `Рубрике нужен один канал: ${n.id}`
    if (n.type === 'communication_decision') {
      if (!['continue', 'change', 'defer'].includes(d.outcome) || targets(n.id, 'decides').length !== 1) return `Неверное решение: ${n.id}`
      const rubric = targets(n.id, 'decides')[0]
      for (const id of targets(n.id, 'based_on')) {
        const subjects = graph.edges.filter(e => e.to === id && ['evidenced_by', 'contradicted_by'].includes(e.type)).map(e => e.from)
        const materials = graph.edges.filter(e => e.type === 'contact_rubric' && e.to === rubric).flatMap(e => targets(e.from, 'uses_material'))
        if (!by.get(id)?.data?.rubricIds?.includes(rubric) && !subjects.some(id => id === rubric || materials.includes(id))) return `Данные другой рубрики: ${id}`
        if (!evidenceUsable(by.get(id))) return `Непригодное свидетельство: ${id}`
      }
    }
  }
  return null
}

module.exports = { NODE_TYPES, EDGE_TYPES, RELATIONS, STATUSES, ORIGINS, digest, edgeKey, scopedId, criterionId, safeId, nonempty, evidenceUsable, validateGraph }
