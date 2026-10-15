// Communications use the same graph transaction, evidence rules and journal as research.
const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { materialCopyId, readLegacyDocument } = require('./communications-legacy')
const { digest, safeId, nonempty } = require('./schema')
const EDITABLE = new Set(['product', 'journey', 'touchpoint', 'channel', 'rubric', 'reference', 'artifact'])
const LINKS = {
  product: ['subproduct_of', 'serves'], journey: ['journey_offer', 'journey_segment', 'has_contact'],
  touchpoint: ['contact_job', 'contact_channel', 'contact_rubric', 'uses_material'],
  channel: ['channel_offer', 'channel_segment', 'subproduct_of', 'serves'], rubric: ['rubric_channel'], reference: ['reference_for'], artifact: ['material_offer', 'material_segment', 'material_channel'],
}
function communication(tx, input) {
  const command = input.command || 'save'
  if (command === 'import-material') {
    const original = tx.graph.nodes.find(n => n.id === input.artifactId)
    const { relative, body } = readLegacyDocument(tx.workspace, original)
    const id = materialCopyId(original.id), existing = tx.graph.nodes.find(n => n.id === id)
    if (existing) {
      if (existing.data?.importedFrom !== original.id) throw new Error('ID рабочей копии уже занят')
      return existing
    }
    const by = new Map(tx.graph.nodes.map(n => [n.id, n]))
    const offers = tx.graph.edges.filter(e => e.from === original.id && e.type === 'material_offer').map(e => e.to)
    if (!offers.length && by.get(original.data?.productId)?.type === 'product') offers.push(original.data.productId)
    if (!offers.length && (by.get(input.offerId)?.type === 'product' || by.get(input.offerId)?.data?.isOffering === true)) offers.push(input.offerId)
    return communication(tx, { type: 'artifact', id, label: original.label, data: {
      kind: 'communication_material', stage: original.data?.readiness === 'ready-for-review' ? 'review' : 'draft',
      format: 'Документ', body, importedFrom: original.id, originalReport: relative, legacyReadiness: original.data?.readiness || '',
    }, links: { material_offer: offers, material_segment: (Array.isArray(original.data?.segmentIds) ? original.data.segmentIds : []).filter(id => by.get(id)?.type === 'segment'),
      material_channel: by.get(original.data?.channelId)?.type === 'channel' ? [original.data.channelId] : [] } })
  }
  if (command === 'observe') {
    const target = tx.graph.nodes.find(n => n.id === input.target)
    if (!['artifact', 'rubric'].includes(target?.type)) throw new Error('Наблюдение относится к материалу или рубрике')
    if (!validWindow(input.windowStart, input.windowEnd)) throw new Error('Укажи корректное окно измерения: начало и конец')
    const rubricIds = target.type === 'rubric' ? [target.id] : [target.data?.rubricId, ...tx.graph.edges.filter(e => e.type === 'uses_material' && e.to === target.id).flatMap(e => tx.graph.edges.filter(r => r.from === e.from && r.type === 'contact_rubric').map(r => r.to))].filter(Boolean)
    return tx.observe({ rubricIds: [...new Set(rubricIds)], target: input.target, text: input.text, source: input.source, origin: 'test', kind: 'communication', windowStart: input.windowStart, windowEnd: input.windowEnd, observationId: randomUUID() })
  }
  if (command === 'feedback') {
    const n = tx.graph.nodes.find(n => n.id === input.id && n.type === 'artifact')
    if (!n || !nonempty(input.text)) throw new Error('Нужны материал и текст отзыва')
    return tx.node(n.id, n.type, n.label, { data: { feedback: [...(n.data?.feedback || []), { text: input.text.trim(), at: new Date().toISOString() }] } })
  }
  if (command === 'decide') {
    const rubric = tx.graph.nodes.find(n => n.id === input.rubricId && n.type === 'rubric')
    if (!rubric || !['continue', 'change', 'defer'].includes(input.outcome) || !nonempty(input.rationale)) throw new Error('Нужны рубрика, решение и основание')
    const id = `decision-${randomUUID()}`
    const node = tx.node(id, 'communication_decision', input.rationale.trim(), { source: 'communications:manual', data: { outcome: input.outcome, at: new Date().toISOString() } })
    tx.edge(id, 'decides', rubric.id)
    for (const evidenceId of input.evidenceIds || []) tx.edge(id, 'based_on', evidenceId)
    return node
  }
  if (command !== 'save' || !EDITABLE.has(input.type) || !safeId(input.id) || !nonempty(input.label)) throw new Error('Неверная запись центра связи')
  const existing = tx.graph.nodes.find(n => n.id === input.id)
  const data = { ...(input.data || {}) }
  // Feedback and decisions are append-only; save cannot overwrite their history.
  if ('feedback' in data) throw new Error('Используй отдельную операцию feedback')
  if (input.type === 'channel' && 'contentMode' in data && !['', 'page', 'feed', 'resource'].includes(data.contentMode)) throw new Error('Неверный вид содержания канала')
  if (input.type === 'channel' && 'contexts' in data) {
    if (!Array.isArray(data.contexts) || data.contexts.length > 100) throw new Error('Неверные контексты канала')
    const ids = new Set()
    for (const c of data.contexts) {
      if (!c || !safeId(c.id) || ids.has(c.id) || !nonempty(c.situation)) throw new Error('Нужны уникальный контекст и ситуация прихода')
      ids.add(c.id)
      if (c.segmentId && !tx.graph.nodes.some(n => n.id === c.segmentId && n.type === 'segment')) throw new Error('Сегмент контекста не найден')
      for (const key of ['segmentId', 'situation', 'entry', 'known', 'criteria', 'purpose', 'message', 'proof']) {
        if (c[key] != null && typeof c[key] !== 'string') throw new Error('Поля контекста должны быть текстом')
      }
    }
  }
  if (input.type === 'channel' && 'contentOrder' in data) {
    if (!Array.isArray(data.contentOrder) || new Set(data.contentOrder).size !== data.contentOrder.length || data.contentOrder.some(id => !tx.graph.nodes.some(n => n.id === id && n.type === 'artifact'))) throw new Error('Неверный порядок материалов')
  }
  if (input.type === 'artifact') {
    const channelIds = input.links?.material_channel || tx.graph.edges.filter(e => e.from === input.id && e.type === 'material_channel').map(e => e.to)
    const merged = { ...existing?.data, ...data }
    if (merged.contextId && !channelIds.some(id => tx.graph.nodes.find(n => n.id === id)?.data?.contexts?.some(c => c.id === merged.contextId))) throw new Error('Контекст относится к другому каналу')
    if (merged.rubricId && !tx.graph.edges.some(e => e.from === merged.rubricId && e.type === 'rubric_channel' && channelIds.includes(e.to))) throw new Error('Рубрика относится к другому каналу')
  }
  if (input.type === 'artifact') data.kind = 'communication_material'
  const node = tx.node(input.id, input.type, input.label.trim(), { source: existing?.source || 'communications:manual', data })
  for (const [relation, ids] of Object.entries(input.links || {})) {
    if (!LINKS[input.type].includes(relation) || !Array.isArray(ids) || ids.some(id => !safeId(id)) || new Set(ids).size !== ids.length) throw new Error('Неверная связь центра связи')
    tx.graph.edges = tx.graph.edges.filter(e => !(e.from === node.id && e.type === relation))
    for (const id of ids) tx.edge(node.id, relation, id)
  }
  if (input.attachJourney) {
    if (input.type !== 'touchpoint' || existing || !tx.graph.nodes.some(n => n.id === input.attachJourney && n.type === 'journey')) throw new Error('Неверный путь нового контакта')
    tx.edge(input.attachJourney, 'has_contact', node.id)
  }
  if (input.attachLegacyContact) {
    const { segmentId, channelId } = input.attachLegacyContact
    const legacy = tx.graph.edges.find(e => e.type === 'reached_via' && e.from === segmentId && e.to === channelId)
    if (input.type !== 'journey' || existing || !legacy || !tx.graph.edges.some(e => e.from === node.id && e.to === segmentId && e.type === 'journey_segment')) throw new Error('Выбранный контакт относится к другому сегменту')
    const channel = tx.graph.nodes.find(n => n.id === channelId), contactId = `contact-legacy-${digest([node.id, segmentId, channelId])}`
    tx.node(contactId, 'touchpoint', channel.label, { source: channel.source, data: { surface: channel.label, orientationJob: legacy.data?.orientationJob || '',
      message: legacy.data?.hook || legacy.data?.message || '', tactic: legacy.data?.tactic || '', legacyContact: { segmentId, channelId }, benefit: '' } })
    tx.edge(node.id, 'has_contact', contactId); tx.edge(contactId, 'contact_channel', channelId)
  }
  if (input.attachContact) {
    if (input.type !== 'artifact' || existing || !tx.graph.nodes.some(n => n.id === input.attachContact && n.type === 'touchpoint')) throw new Error('Неверный контакт нового материала')
    tx.edge(input.attachContact, 'uses_material', node.id)
  }
  if (input.type === 'artifact') {
    const relative = `reports/communications/${node.id}.md`
    const file = path.join(tx.workspace, relative)
    let ancestor = file
    while (ancestor !== tx.workspace) {
      if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('Символическая ссылка в пути материала')
      ancestor = path.dirname(ancestor)
    }
    const content = `# ${node.label}\n\n${node.data.body || ''}\n`
    tx.files.set(relative, { path: relative, before: digest(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null), content })
    if (input.runId) {
      if (!/^run-[a-z0-9-]{1,100}$/i.test(input.runId)) throw new Error('Неверный runId материала')
      const runReport = `reports/communications/${input.runId}.md`
      const runFile = path.join(tx.workspace, runReport)
      if (fs.existsSync(runFile)) throw new Error('Документ этого запуска уже существует')
      tx.stageFile(runReport, `---\nrunId: ${input.runId}\nmaterialId: ${node.id}\n---\n${content}`)
    }
    node.source = relative
  }
  return node
}
function validWindow(start, end) {
  const date = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x
  return date(start) && date(end) && start <= end
}
module.exports = { communication, validWindow }
