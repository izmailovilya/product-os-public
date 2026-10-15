// Explicit legacy fields only. Reading never creates research claims or rewrites a workspace.
const fs = require('fs')
const path = require('path')
const { digest } = require('./schema')
const KINDS = new Set(['content-pack', 'channel-concept', 'editorial-profile'])
const DOCUMENT_KINDS = new Set(['task-brief', 'concept-outline', 'source-backed-content-shortlist', 'principles-and-editorial-rubric'])
const active = n => n && n.status !== 'dropped' && !n.data?.retired && !n.data?.excludedFromWorkingInputs
const legacyDocument = n => active(n) && n.type === 'artifact' && (KINDS.has(n.data?.kind) || DOCUMENT_KINDS.has(n.data?.artifactKind))
const materialCopyId = id => `material-legacy-${digest(id)}`
function legacyProjection(nodes, edges, offerIds, segmentIds) {
  const by = new Map(nodes.map(n => [n.id, n]))
  const contacts = edges.filter(e => e.type === 'reached_via' && segmentIds.has(e.from)).map(e => ({
    segmentId: e.from, channelId: e.to, label: by.get(e.to).label, source: by.get(e.to).source,
    orientationJob: e.data?.orientationJob || '', tactic: e.data?.tactic || '', message: e.data?.hook || e.data?.message || '',
  }))
  const documents = nodes.filter(legacyDocument).map(n => {
    const explicitOffers = edges.filter(e => e.from === n.id && e.type === 'material_offer').map(e => e.to)
    const products = explicitOffers.length ? explicitOffers : [n.data?.productId].filter(id => by.get(id)?.type === 'product')
    return { id: n.id, offerIds: products, segmentIds: (Array.isArray(n.data?.segmentIds) ? n.data.segmentIds : []).filter(id => by.get(id)?.type === 'segment'),
      channelId: by.get(n.data?.channelId)?.type === 'channel' ? n.data.channelId : '',
      scopeUnknown: !products.length, workingCopyId: by.has(materialCopyId(n.id)) ? materialCopyId(n.id) : '',
      previousId: n.data?.basedOnArtifactId || n.data?.revisesArtifactId || '',
      kind: n.data?.kind || n.data?.artifactKind,
    }
  }).filter(n => !offerIds || n.scopeUnknown || n.offerIds.some(id => offerIds.has(id)))
  const placementIds = nodes.filter(n => n.type === 'channel' && n.data?.ownership !== 'own' && !n.data?.productId && edges.some(e => e.type === 'reached_via' && e.to === n.id) && !edges.some(e => e.type === 'channel_offer' && e.from === n.id)).map(n => n.id)
  return { contacts, documents, placementIds }
}
function readLegacyDocument(workspace, node) {
  if (!legacyDocument(node)) throw new Error('Документ не подходит для переноса в материалы')
  const relative = (node.source || '').split('#')[0]
  if (!/^reports\/.+\.md$/.test(relative) || relative.split(/[\\/]/).some(s => s === '..') || relative.includes('\\')) throw new Error('Рабочую копию можно создать только из отчёта воркспейса')
  const root = fs.realpathSync(workspace), file = fs.realpathSync(path.join(workspace, relative))
  if (!file.startsWith(root + path.sep)) throw new Error('Отчёт находится вне воркспейса')
  if (fs.statSync(file).size > 1024 * 1024) throw new Error('Документ слишком большой для редактора')
  return { relative, body: fs.readFileSync(file, 'utf8') }
}
module.exports = { legacyProjection, legacyDocument, materialCopyId, readLegacyDocument }
