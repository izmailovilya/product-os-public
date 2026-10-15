const { behaviourKind, validBehaviourKey } = require('../behaviour-identity')
const clone = value => JSON.parse(JSON.stringify(value))
const unique = values => [...new Set(values.filter(Boolean))]

// Explicit semantic merge. Preserve the original nodes and every parallel-edge observation;
// a shared identity never makes one segment's spend/prevalence true in another segment.
function mergeCompetitors(graph, { ids, keepId, name, behaviourKey, reason, source }) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || !reason?.trim() || !source?.trim()) throw new Error('Merge requires unique competitor ids, reason and source')
  const nodes = ids.map(id => graph.nodes.find(n => n.id === id && n.type === 'competitor'))
  if (nodes.some(n => !n)) throw new Error('Merge references an unknown competitor')
  keepId ||= ids[0]
  if (!ids.includes(keepId)) throw new Error('Survivor must belong to the merge group')
  if (behaviourKey) {
    if (!validBehaviourKey(behaviourKey) || new Set(nodes.map(n => behaviourKind(n.data?.kind))).size !== 1 || !behaviourKind(nodes[0].data?.kind)) throw new Error('Incompatible behaviour identities')
    if (nodes.some(n => n.data?.behaviourKey && n.data.behaviourKey !== behaviourKey)) throw new Error('Existing behaviour key cannot be changed by merge')
  }
  const keep = clone(nodes.find(n => n.id === keepId)), gone = new Set(ids.filter(id => id !== keepId))
  const originals = nodes.flatMap(n => n.data?.mergedCompetitors || [clone(n)])
  const aliases = unique(nodes.flatMap(n => [n.label, ...(n.data?.aliases || [])]))
  const sources = unique(nodes.flatMap(n => [n.source, ...(n.data?.sources || [])]))
  keep.label = name || keep.label
  keep.data ||= {}
  for (const n of nodes) for (const [key, value] of Object.entries(n.data || {})) if (!Object.hasOwn(keep.data, key)) keep.data[key] = clone(value)
  Object.assign(keep.data, { aliases: aliases.filter(alias => alias !== keep.label), sources,
    mergedCompetitors: originals, identityDecision: { reason, source }, ...(behaviourKey ? { behaviourKey, kind: behaviourKind(keep.data.kind) } : {}) })
  // Do not inherit a stronger status from another record. Its status and citations remain
  // in mergedCompetitors; any status transition is a separate evidence decision.
  graph.nodes = graph.nodes.filter(n => !gone.has(n.id)).map(n => n.id === keepId ? keep : n)
  const edges = new Map(), firstObservations = new Map()
  for (const original of graph.edges) {
    const edge = clone(original)
    if (gone.has(edge.from)) edge.from = keepId
    if (gone.has(edge.to)) edge.to = keepId
    if (edge.from === edge.to) throw new Error('Merge would create a self-relation')
    const key = `${edge.from}|${edge.type}|${edge.to}`, previous = edges.get(key)
    if (!previous) { edges.set(key, edge); firstObservations.set(key, clone(original)); continue }
    const observations = [...(previous.data?.mergedObservations || [firstObservations.get(key)]), ...(edge.data?.mergedObservations || [clone(original)])]
    previous.data = { ...(edge.data || {}), ...(previous.data || {}), mergedObservations: observations }
  }
  graph.edges = [...edges.values()]
  for (const node of graph.nodes) {
    if (node.type === 'evidence') continue // original observations are immutable
    for (const field of ['competitorId', 'solutionId', 'nodeId', 'targetId']) if (gone.has(node.data?.[field])) node.data[field] = keepId
  }
  return { keepId, removedIds: [...gone] }
}
module.exports = { mergeCompetitors }
