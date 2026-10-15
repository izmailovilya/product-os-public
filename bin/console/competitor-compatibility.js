// Read-time compatibility only. Never split vendors or copy a category's research.
const { isCategoryBucket } = require('../competitor-key')
const text = value => typeof value === 'string' && value.trim() && !/^(unknown|n\/a|null|undefined)$/i.test(value.trim()) ? value.trim() : null
function legacyCategory(data) {
  for (const raw of [data.category, data.solutionCategory, data.categoryName]) {
    const name = text(typeof raw === 'string' ? raw : raw?.name || raw?.label)
    if (name) return { ...(typeof raw === 'object' ? raw : {}), name, ...(text(data.categoryId) && !raw?.id ? { id: data.categoryId } : {}) }
  }
  return null
}
function compatibleCompetitors(nodes) {
  const result = nodes.map(node => {
    if (node.type !== 'competitor') return node
    const data = { ...node.data }, category = legacyCategory(data)
    if (category) data.category = category
    if (data.entityType === 'behavior') data.entityType = 'behaviour'
    if (data.entityType === 'product') data.entityType = 'solution'
    const explicit = ['solution', 'product', 'behaviour', 'behavior', 'category'].includes(data.entityType) || typeof data.isCategory === 'boolean'
    // Enumeration is only a legacy warning. Explicit classification always wins.
    if (!explicit && isCategoryBucket({ name: node.label, kind: data.kind })) {
      data.isCategory = true
      data.entityType = 'category'
      data.classificationCompatibility = 'В старой записи перечислены несколько решений. Она показана как обзор группы; состав и отдельные продукты нужно уточнить.'
    }
    return { ...node, data }
  })
  const index = new Map(result.map(node => [node.id, node]))
  for (const node of result.filter(n => n.type === 'competitor' && !legacyCategory(n.data))) {
    // splitFrom is an explicit relationship. Do not infer membership from brand mentions.
    const parent = index.get(node.data.splitFrom)
    if (parent?.type !== 'competitor' || parent.status === 'dropped' || !(parent.data?.isCategory || parent.data?.entityType === 'category')) continue
    node.data.category = legacyCategory(parent.data) || { id: parent.id, name: parent.label }
  }
  return result
}
module.exports = { compatibleCompetitors }
