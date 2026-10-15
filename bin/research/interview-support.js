// Interview support describes the basis of a hypothesis, never its validation status.
// Keep quotes and the research corpus out of the public console projection.
const emptySupport = () => ({ state: 'hypothesis', personCount: 0, caseCount: 0, synthesisCount: 0, stale: false, conflicting: false, reasons: [], respondents: [], evidenceRefs: [] })

function interviewSupport(data) {
  const records = data.records || []
  const retired = new Set(records.flatMap(record => record.supersedes || []))
  const active = records.filter(record => !retired.has(record.id) && record.status !== 'withdrawn')
  const byId = new Map(active.map(record => [record.id, record]))
  const historical = new Map(records.map(record => [record.id, record]))
  const successors = new Map()
  for (const record of records.filter(r => r.type === 'SourceUnit')) for (const id of record.supersedes || []) {
    if (!successors.has(id)) successors.set(id, [])
    successors.get(id).push(record)
  }
  // Immutable memberships may reference a corrected unit. Follow only a unique
  // correction chain; retain the exact quote and document across that chain.
  const currentUnit = id => {
    let unit = historical.get(id); const seen = new Set()
    while (unit && retired.has(unit.id)) {
      if (seen.has(unit.id)) return null
      seen.add(unit.id)
      const next = successors.get(unit.id) || []
      if (next.length !== 1 || next[0].sourceId !== unit.sourceId) return null
      unit = next[0]
    }
    return unit && byId.get(unit.id)
  }
  const syntheses = active.filter(record => record.type === 'SynthesisRevision')
  const memberships = active.filter(record => record.type === 'MembershipAssertion')
  const segmentIds = new Set([...syntheses.flatMap(record => record.segmentIds || []), ...memberships.map(record => record.segmentId)])
  const result = {}
  for (const segmentId of segmentIds) {
    const support = emptySupport(), people = new Map(), cases = new Set(), usedSyntheses = new Set(), refs = new Set(), reasons = new Set()
    const related = syntheses.filter(synthesis => synthesis.segmentIds?.includes(segmentId))
    support.stale = related.some(synthesis => synthesis.researchRevision !== data.factRevision)
    support.conflicting = related.some(synthesis => synthesis.status === 'disputed' || synthesis.contradictingCaseIds?.length) || memberships.some(m => m.segmentId === segmentId && m.status === 'disputed')
    if (support.stale) reasons.add('stale_synthesis')
    if (support.conflicting) reasons.add('contradicting_cases_or_disputed_membership')
    for (const membership of memberships.filter(m => m.segmentId === segmentId && ['candidate', 'supported'].includes(m.status))) {
      const synthesis = byId.get(membership.synthesisRevisionId)
      if (!synthesis || synthesis.type !== 'SynthesisRevision' || !['hypothesis', 'supported'].includes(synthesis.status) || synthesis.researchRevision !== data.factRevision || !synthesis.segmentIds?.includes(segmentId) || !synthesis.supportingCaseIds?.includes(membership.episodeId)) continue
      const episode = byId.get(membership.episodeId), person = byId.get(membership.personId)
      if (episode?.type !== 'Episode' || person?.type !== 'Person' || !episode.personIds?.includes(person.id)) continue
      const sessions = (episode.sessionIds || []).map(id => byId.get(id)).filter(session => session?.type === 'Session' && session.status === 'completed' && ['interview', 'followup'].includes(session.kind) && session.participants?.some(actor => actor.kind === 'person' && actor.personId === person.id))
      // Membership evidence is scoped to this person and episode. A synthesis-wide
      // quote or another participant's answer must not support every membership.
      const sourceIds = new Set(sessions.flatMap(session => session.sourceIds || []))
      const units = (membership.evidenceRefs || []).flatMap(ref => {
        const unit = currentUnit(ref.sourceUnitId), document = byId.get(unit?.sourceId)
        const valid = ['respondent', 'interviewee', 'answer'].includes(ref.speakerRole) && typeof ref.quote === 'string' && ref.quote.trim() && unit?.type === 'SourceUnit' && !['question', 'prompt', 'explanation'].includes(unit.role) && unit.raw?.includes(ref.quote) && document?.type === 'SourceDocument' && sourceIds.has(unit.sourceId)
        return valid ? [unit.id] : []
      })
      if (!units.length) { reasons.add('missing_client_response'); continue }
      if (!people.has(person.id)) people.set(person.id, { personId: person.id, displayName: person.displayName, units: new Set() })
      for (const id of units) { people.get(person.id).units.add(id); refs.add(id) }
      cases.add(episode.id); usedSyntheses.add(synthesis.id)
    }
    support.personCount = people.size; support.caseCount = cases.size; support.synthesisCount = usedSyntheses.size
    support.state = people.size ? 'supported' : 'hypothesis'
    if (!people.size) reasons.add('no_current_interview_support')
    support.reasons = [...reasons]
    support.respondents = [...people.values()].slice(0, 8).map(({ personId, displayName, units }) => ({ personId, displayName, evidenceRefs: [...units].slice(0, 8).map(sourceUnitId => ({ sourceUnitId })) }))
    support.evidenceRefs = [...refs].slice(0, 24).map(sourceUnitId => ({ sourceUnitId }))
    result[segmentId] = support
  }
  return result
}

module.exports = { interviewSupport, emptySupport }
