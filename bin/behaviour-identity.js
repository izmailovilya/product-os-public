// Pure identity contract, also embedded in the standalone research workflow.
// Identity describes the solution; evidence IDs and segment-specific hire facts stay intact.
function behaviourKind(kind) {
  if (['do_nothing', 'do-nothing'].includes(kind)) return 'do_nothing'
  if (['diy', 'workaround'].includes(kind)) return 'diy'
  return null
}
function validBehaviourKey(key) { return typeof key === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) && key.length <= 80 }
function behaviourCandidates(segments, existing = []) {
  const rows = []
  for (const segment of segments || []) for (const [index, entry] of (segment.deep?.solutionsHired || []).entries()) {
    if (behaviourKind(entry.kind)) rows.push({ ref: `${segment.id}:${entry.id || index}`, name: entry.name, kind: behaviourKind(entry.kind), segmentId: segment.id })
  }
  for (const entry of existing) if (behaviourKind(entry.kind)) rows.push({ ref: `existing:${entry.id}`, name: entry.name, kind: behaviourKind(entry.kind), behaviourKey: entry.behaviourKey || null, aliases: entry.aliases || [] })
  return rows
}
function resolveBehaviourGroups(candidates, review) {
  if (!Array.isArray(review?.groups)) throw new Error('Missing behaviour identity review')
  const byRef = new Map(candidates.map(row => [row.ref, row]))
  if (byRef.size !== candidates.length) throw new Error('Duplicate behaviour reference')
  const assigned = new Map(), keys = new Set()
  for (const group of review.groups) {
    if (!validBehaviourKey(group.key) || keys.has(group.key) || !group.name?.trim() || !group.reason?.trim() || !group.members?.length) throw new Error('Invalid or duplicate behaviour group')
    keys.add(group.key)
    const kinds = new Set()
    for (const ref of group.members) {
      const row = byRef.get(ref)
      if (!row || assigned.has(ref)) throw new Error(`Unknown or repeated behaviour: ${ref}`)
      if (row.behaviourKey && row.behaviourKey !== group.key) throw new Error(`Existing behaviour key cannot be changed: ${ref}`)
      kinds.add(row.kind)
      assigned.set(ref, { behaviourKey: group.key, canonicalName: group.name, identityReason: group.reason })
    }
    if (kinds.size !== 1) throw new Error('DIY and do-nothing require separate identities')
  }
  if (assigned.size !== candidates.length) throw new Error('Behaviour review omitted a solution')
  return assigned
}
function applyBehaviourGroups(segments, review, existing = []) {
  const candidates = behaviourCandidates(segments, existing)
  const assignments = resolveBehaviourGroups(candidates, review)
  for (const segment of segments || []) for (const [index, entry] of (segment.deep?.solutionsHired || []).entries()) {
    if (behaviourKind(entry.kind)) Object.assign(entry, assignments.get(`${segment.id}:${entry.id || index}`))
  }
  return candidates
}
const BEHAVIOUR_IDENTITY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['groups'], properties: {
    groups: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'name', 'members', 'reason'], properties: {
      key: { type: 'string', description: 'Stable lowercase English kebab-case solution key, independent of segment or wording; reuse an existing key' },
      name: { type: 'string', description: 'Short neutral name of this concrete behaviour' },
      members: { type: 'array', items: { type: 'string' }, minItems: 1 },
      reason: { type: 'string', description: 'Why these entries are the same mechanism, or why this singleton must stay separate; disclose uncertainty' },
    } } },
  },
}
module.exports = { behaviourKind, validBehaviourKey, behaviourCandidates, resolveBehaviourGroups, applyBehaviourGroups, BEHAVIOUR_IDENTITY_SCHEMA }
