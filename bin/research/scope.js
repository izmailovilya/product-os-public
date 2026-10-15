// Episode ownership, not person-level fan-out, defines a segment's case slice.
function activeRecords(data) {
  const retired = new Set(data.records.flatMap(record => record.supersedes || []))
  return data.records.filter(record => !retired.has(record.id))
}

function segmentScope(data, segmentId, membershipStatus) {
  const records = activeRecords(data), byId = new Map(records.map(record => [record.id, record]))
  const historical = new Map(data.records.map(record => [record.id, record]))
  if (membershipStatus && !['candidate', 'supported', 'disputed', 'unknown'].includes(membershipStatus)) {
    throw new Error('membershipStatus must be candidate, supported, disputed or unknown')
  }
  const memberships = records.filter(record => {
    if (record.type !== 'MembershipAssertion' || record.segmentId !== segmentId || record.status === 'withdrawn') return false
    if (membershipStatus && record.status !== membershipStatus) return false
    const episode = byId.get(record.episodeId), person = byId.get(record.personId)
    return episode?.type === 'Episode' && person?.type === 'Person' && episode.personIds.includes(person.id)
  })
  const episodeIds = new Set(memberships.map(record => record.episodeId))
  const personIds = new Set(memberships.map(record => record.personId))
  const cache = new Map()
  function episodeOf(record, seen = new Set()) {
    if (!record || seen.has(record.id)) return null
    if (cache.has(record.id)) return cache.get(record.id)
    if (record.type === 'Episode') return record.id
    if (record.episodeId) return record.episodeId
    seen.add(record.id)
    const parents = [record.jobInstanceId, record.subjectId, record.subject?.id].filter(Boolean)
    const ids = [...new Set(parents.map(id => episodeOf(byId.get(id), new Set(seen))).filter(Boolean))]
    const episodeId = ids.length === 1 ? ids[0] : null
    cache.set(record.id, episodeId)
    return episodeId
  }
  const caseRecords = records.filter(record => episodeIds.has(episodeOf(record)))
  const ids = new Set(caseRecords.map(record => record.id))
  for (const id of personIds) ids.add(id)
  for (const record of memberships) ids.add(record.id)
  for (const record of records.filter(r => r.type === 'SynthesisRevision' && r.segmentIds.includes(segmentId))) ids.add(record.id)
  for (const episodeId of episodeIds) {
    for (const id of byId.get(episodeId).sessionIds) ids.add(id)
  }
  // Evidence links are explicit; do not include the rest of a shared transcript.
  for (const record of [...caseRecords, ...memberships]) {
    for (const ref of record.evidenceRefs || []) {
      ids.add(ref.sourceUnitId)
      const sourceId = historical.get(ref.sourceUnitId)?.sourceId
      if (sourceId) ids.add(sourceId)
    }
  }
  return { records, byId, memberships, episodeIds, personIds, caseRecords, ids, episodeOf }
}

function synthesisStale(data, synthesis) {
  if (synthesis.researchRevision !== data.factRevision) return true
  return (synthesis.topicFindings || []).some(finding => {
    const scope = segmentScope(data, finding.segmentId)
    return [...finding.supportingRecordIds, ...finding.contradictingRecordIds].some(id =>
      !scope.byId.has(id) || !scope.episodeIds.has(scope.episodeOf(scope.byId.get(id))))
  })
}

module.exports = { activeRecords, segmentScope, synthesisStale }
