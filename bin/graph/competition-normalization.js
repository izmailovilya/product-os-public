// Explicit reviewed category normalization. Original records/relations become scoped
// scenarios before the existing lossless identity merge rewires their graph links.
const clone = value => JSON.parse(JSON.stringify(value))
function normalizeCompetition(tx, input) {
  const { ids, keepId = ids?.[0], name, category, scenarios, reason } = input
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || !name?.trim() || !category?.id || !category?.name || !reason?.trim()) throw new Error('Нужны записи, название категории и основание объединения')
  if (!Array.isArray(scenarios) || scenarios.length !== ids.length || new Set(scenarios.map(s => s.sourceId)).size !== ids.length || scenarios.some(s => !ids.includes(s.sourceId) || !s.label?.trim())) throw new Error('Каждой исходной записи нужен отдельный сценарий')
  if (input.alternative && (typeof input.alternative.label !== 'string' || !input.alternative.label.trim() || !['provider', 'tool'].includes(input.alternative.selection))) throw new Error('Для способа решения нужны название и тип выбора: provider или tool')
  const originals = ids.map(id => tx.graph.nodes.find(n => n.id === id))
  if (originals.some(n => !n || n.type !== 'competitor' || !(n.data?.isCategory || n.data?.entityType === 'category') || n.data?.competitionScenarios)) throw new Error('Объединять можно только ещё не разобранные групповые записи; конкретные продукты сохраняют свои ID')
  for (const s of scenarios) if (s.discoveryPlaces && (!Array.isArray(s.discoveryPlaces) || s.discoveryPlaces.some(p => typeof p.label !== 'string' || !p.label.trim() || !['marketplace', 'provider-example'].includes(p.role)))) throw new Error('Укажи название и роль места поиска')
  const records = scenarios.map(s => {
    const original = originals.find(n => n.id === s.sourceId)
    return { id: original.id, label: s.label.trim(), original: clone(original),
      edges: clone(tx.graph.edges.filter(e => e.from === original.id || e.to === original.id)),
      discoveryPlaces: clone(s.discoveryPlaces || []) }
  })
  const result = tx.mergeCompetitors({ ids, keepId, name, reason, source: input.source || tx.source })
  const node = tx.graph.nodes.find(n => n.id === result.keepId), merged = node.data
  const kinds = [...new Set(originals.map(n => n.data?.kind).filter(Boolean))]
  // Global facts of the first record must not become facts of every scenario.
  node.data = { ...(kinds.length === 1 ? {kind:kinds[0]} : {}), entityType: 'category', isCategory: true, category: clone(category),
    ...(input.alternative ? { alternative: { label: input.alternative.label.trim(), selection: input.alternative.selection } } : {}),
    normalizationVersion: 1, competitionScenarios: records, aliases: merged.aliases, sources: merged.sources,
    mergedCompetitors: merged.mergedCompetitors, identityDecision: merged.identityDecision, updatedAt: new Date().toISOString() }
  return node
}
module.exports = { normalizeCompetition }
