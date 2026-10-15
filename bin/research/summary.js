const { createHash } = require('node:crypto')
const { segmentScope } = require('./scope')
const provenance = require('./provenance')

const MAX_LIMIT = 10, TEXT_LIMIT = 320
const clip = value => typeof value === 'string' ? { text: value.slice(0, TEXT_LIMIT), truncated: value.length > TEXT_LIMIT } : { text: null, truncated: false }
const unique = values => [...new Set(values)]
const countBy = values => values.reduce((counts, value) => { counts[value] = (counts[value] || 0) + 1; return counts }, {})
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24)

function page(items, query, extra = {}) {
  const offset = query.offset === undefined ? 0 : Number(query.offset)
  const limit = query.limit === undefined ? 5 : Number(query.limit)
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error('summary requires offset >= 0 and limit between 1 and 10')
  }
  if (offset && (query.expectedRevision === undefined || query.expectedGraphRevision === undefined)) {
    throw new Error('summary pagination requires expectedRevision and expectedGraphRevision from the first page')
  }
  const nextOffset = offset + limit < items.length ? offset + limit : null
  return { total: items.length, offset, limit, hasMore: nextOffset !== null, nextOffset,
    nextQuery: nextOffset === null ? null : { ...query, ...extra, offset: nextOffset }, items: items.slice(offset, offset + limit) }
}

function summarize(data, graph, query = {}) {
  if (!query.segmentId) throw new Error('summary requires segmentId')
  if ((query.topic || 'channels') !== 'channels') throw new Error('Only topic=channels is implemented; other topics use synthesis/record slices')
  if (query.atRevision !== undefined) throw new Error('summary reads current snapshots; use research read atRevision=N for historical records')
  const view = query.view || 'groups'
  if (!['groups', 'cases', 'findings'].includes(view)) throw new Error('summary view must be groups, cases or findings')
  const scope = segmentScope(data, query.segmentId, query.membershipStatus)
  const historical = new Map(data.records.map(record => [record.id, record]))
  const products = graph.nodes.filter(node => node.type === 'product')
  if (query.productId && !products.some(node => node.id === query.productId)) throw new Error('Unknown productId')
  if (!query.productId && products.length > 1) throw new Error('summary requires productId in a workspace with several products')
  const productId = query.productId || products[0]?.id || null
  const segment = graph.nodes.find(node => node.id === query.segmentId && node.type === 'segment')
  if (graph.nodes.length && !segment) throw new Error('Unknown segmentId; this is a scope error, not a synthesis quality verdict')
  const baseQuery = { segmentId: query.segmentId, topic: 'channels', ...(query.membershipStatus ? { membershipStatus: query.membershipStatus } : {}),
    ...(productId ? { productId } : {}), expectedRevision: data.revision, expectedGraphRevision: graph.revision || 0 }
  const origins = new Map(), uses = new Map(), coverages = new Map(data.coverage.map(c => [c.sourceUnitId, c]))
  for (const binding of provenance.active(data.fieldProvenance)) {
    if (!origins.has(binding.recordId)) origins.set(binding.recordId, [])
    origins.get(binding.recordId).push(binding)
  }
  for (const record of scope.records.filter(r => r.type === 'Assertion' && r.subject.type === 'DiscoveryEvent' && r.subject.field === 'use')) {
    if (!uses.has(record.subject.id)) uses.set(record.subject.id, [])
    uses.get(record.subject.id).push(record)
  }
  const validOrigins = record => record.type === 'Assertion' ? [{ ...record, mapping: 'self_described', fields: [] }]
    : (origins.get(record.id) || []).filter(p => p.valueHash === provenance.valueHash(record, p.fields))
  function originSummary(records) {
    const relevant = unique(records.flatMap(r => [r.id, ...(uses.get(r.id) || []).map(a => a.id)])).map(id => scope.byId.get(id)).filter(Boolean)
    const entries = relevant.flatMap(validOrigins)
    const missing = records.filter(record => {
      const covered = new Set(validOrigins(record).filter(p => p.mapping === 'reviewed').flatMap(p => p.fields))
      return provenance.fields(record).some(field => !covered.has(field))
    })
    return { records: records.length, associatedUseAssertions: relevant.length - records.length, recordsWithMissingReviewedFields: missing.length,
      bindingCounts: { basis: countBy(entries.map(p => p.basis)), verification: countBy(entries.map(p => p.verification)),
        elicitation: countBy(entries.map(p => p.elicitation)), mapping: countBy(entries.map(p => p.mapping)),
        authorship: countBy(entries.map(p => p.assertedBy?.kind || 'unknown')), timePrecision: countBy(entries.map(p => p.validTime?.precision || 'unknown')) },
      state: missing.length ? 'partial' : 'reviewed',
      caveat: 'Reviewed normalization is not necessarily respondent testimony; counts describe bindings, not people.' }
  }
  function evidence(record) {
    const refs = unique((record.evidenceRefs || []).map(ref => ref.sourceUnitId))
    return { total: refs.length, hasMore: refs.length > 2, refs: refs.slice(0, 2).map(sourceUnitId => {
      const unit = historical.get(sourceUnitId), document = historical.get(unit?.sourceId)
      return { sourceUnitId, sourceId: document?.id || null, locator: unit?.locator || null,
        resolution: scope.byId.has(sourceUnitId) ? 'current' : 'corrected_or_retired' }
    }) }
  }
  function useState(record) {
    const assertions = uses.get(record.id) || []
    const states = unique(assertions.map(a => a.state === 'known' && a.value === false ? 'explicit_negative' : a.state))
    if (states.length > 1 || states.includes('conflicting')) return 'conflicting'
    if (states.length && states[0] !== 'known') return states[0]
    return record.useState
  }
  function peopleFor(record) {
    const episode = scope.byId.get(record.episodeId)
    const about = unique(validOrigins(record).filter(p => p.mapping === 'reviewed').flatMap(p => p.aboutActors || []).filter(a => a.kind === 'person').map(a => a.personId))
    const known = about.length ? about : episode.personIds.length === 1 ? episode.personIds : []
    const members = new Set(scope.memberships.filter(m => m.episodeId === record.episodeId).map(m => m.personId))
    return known.filter(id => episode.personIds.includes(id) && members.has(id))
  }
  function dimension(record) {
    const alternative = scope.byId.get(record.alternativeId)
    const target = record.productId
      ? { kind: record.productId === productId ? 'own_product' : 'other_product', id: record.productId }
      : alternative ? { kind: 'unmapped_alternative', id: alternative.id, identification: alternative.identification }
        : { kind: 'unknown', id: null }
    // Never infer a stage from a neighbouring ChoiceEvent, CommercialObservation or session.
    const recordedStage = record.stage || 'unknown'
    const purchaseClaim = ['purchase', 'repeat_purchase'].includes(recordedStage)
    const directStage = validOrigins(record).some(p => p.mapping === 'reviewed' && p.fields.includes('stage') &&
      ['respondent_report', 'observed_action', 'document_measurement'].includes(p.basis) && ['quote_checked', 'context_checked', 'cross_checked'].includes(p.verification))
    const unverifiedPurchase = purchaseClaim && (!directStage || target.kind === 'unknown')
    return { channel: record.channel, purpose: record.purpose, useState: useState(record),
      stage: unverifiedPurchase ? 'unknown' : recordedStage,
      ...(unverifiedPurchase ? { recordedStage, stageCaveat: 'Purchase stage lacks reviewed direct evidence or a solution reference.' } : {}), target }
  }
  const events = scope.caseRecords.filter(record => record.type === 'DiscoveryEvent')
  const relatedByEvent = new Map(events.map(record => [record.id, []]))
  for (const record of scope.caseRecords) {
    const subjectId = record.subjectId || record.subject?.id
    if (relatedByEvent.has(subjectId)) relatedByEvent.get(subjectId).push(record)
  }
  function relatedRows(records) {
    const related = records.flatMap(record => relatedByEvent.get(record.id) || [])
    return { total: related.length, hasMore: related.length > 2, items: related.slice(0, 2).map(record => ({
      recordId: record.id, type: record.type, field: record.subject?.field || record.kind || null,
      state: record.state || record.realization || 'unknown',
      value: clip(record.value === undefined && record.amount === undefined ? null : JSON.stringify(record.value ?? record.amount)),
      ...(record.type === 'Assertion' ? { basis: record.basis, elicitation: record.elicitation, verification: record.verification } : {}),
      source: evidence(record),
    })), detail: 'research read <workspace> subjectId=<DiscoveryEvent.id> expectedRevision=' + data.revision }
  }
  const groups = new Map()
  for (const event of events) {
    const key = dimension(event), id = 'channel-' + fingerprint(key)
    if (!groups.has(id)) groups.set(id, { id, key, records: [] })
    groups.get(id).records.push(event)
  }
  const membershipCounts = records => Object.fromEntries(['candidate', 'supported', 'disputed', 'unknown'].map(status => {
    const episodes = new Set(records.map(r => r.episodeId))
    const matched = scope.memberships.filter(m => episodes.has(m.episodeId) && m.status === status)
    return [status, { people: unique(matched.map(m => m.personId)).length, episodes: unique(matched.map(m => m.episodeId)).length }]
  }))
  const caseRow = record => ({ recordId: record.id, episodeId: record.episodeId,
    people: { totalKnown: peopleFor(record).length, ids: peopleFor(record).slice(0, 2), hasMore: peopleFor(record).length > 2 }, useState: useState(record), source: evidence(record),
    useAssertions: { total: (uses.get(record.id) || []).length, ids: (uses.get(record.id) || []).slice(0, 2).map(a => a.id) },
    related: relatedRows([record]),
    provenance: originSummary([record]) })
  function groupRow(group) {
    const { records, key } = group
    const people = unique(records.flatMap(peopleFor)), sourceUnits = unique(records.flatMap(r => (r.evidenceRefs || []).map(e => e.sourceUnitId)))
    return { id: group.id, ...key, channel: clip(key.channel),
      counts: { events: records.length, episodes: unique(records.map(r => r.episodeId)).length, people: people.length,
        eventsWithUnattributedPerson: records.filter(r => !peopleFor(r).length).length },
      memberships: membershipCounts(records), provenance: originSummary(records),
      currentFindingLinks: { supportingEvents: records.filter(r => supportingRecords.has(r.id)).length,
        contradictingEvents: records.filter(r => contradictingRecords.has(r.id)).length, limitation: 'No link is not a negative finding.' },
      related: relatedRows(records),
      sourceCoverage: countBy(sourceUnits.map(id => coverages.get(id)?.disposition || 'no_coverage_record')),
      examples: records.slice(0, 2).map(r => ({ recordId: r.id, episodeId: r.episodeId, source: evidence(r) })),
      cases: { ...baseQuery, view: 'cases', groupId: group.id, limit: 5 },
      limits: { cac: 'unknown', conversion: 'unknown', causalAttribution: 'not_established',
        ownProductAcquisition: key.purpose === 'recruitment' || key.purpose === 'acquisition_hypothesis' || key.target.kind !== 'own_product' ? 'not_established' : 'not_measured' } }
  }
  const syntheses = scope.records.filter(r => r.type === 'SynthesisRevision' && r.status !== 'withdrawn' && r.segmentIds.includes(query.segmentId))
  const findings = syntheses.flatMap(synthesis => (synthesis.topicFindings || [])
    .filter(f => f.topic === 'channels' && f.segmentId === query.segmentId && f.productId === productId)
    .map(finding => {
      const basis = [...finding.supportingRecordIds, ...finding.contradictingRecordIds]
      const invalidBasis = basis.some(id => !scope.byId.has(id) || !scope.episodeIds.has(scope.episodeOf(scope.byId.get(id))))
      const stale = synthesis.researchRevision !== data.factRevision || invalidBasis
      return { synthesisId: synthesis.id, findingId: finding.id, status: synthesis.status, stale,
        reasons: [...(synthesis.researchRevision !== data.factRevision ? ['fact_revision_changed'] : []), ...(invalidBasis ? ['basis_changed_or_outside_current_membership'] : [])],
        basedOnFactRevision: synthesis.researchRevision, summary: clip(finding.summary), limitations: clip(finding.limitations),
        support: { total: finding.supportingRecordIds.length, recordIds: finding.supportingRecordIds.slice(0, 2), hasMore: finding.supportingRecordIds.length > 2 },
        contradiction: { total: finding.contradictingRecordIds.length, recordIds: finding.contradictingRecordIds.slice(0, 2), hasMore: finding.contradictingRecordIds.length > 2 },
        provenance: originSummary([synthesis]), detail: { mode: 'read', query: { id: synthesis.id, expectedRevision: data.revision } } }
    })).sort((a, b) => Number(a.stale) - Number(b.stale) || a.synthesisId.localeCompare(b.synthesisId) || a.findingId.localeCompare(b.findingId))
  const currentFindings = findings.filter(f => !f.stale), answered = events.filter(r => ['known', 'explicit_negative'].includes(useState(r)))
  const currentKeys = new Set(currentFindings.map(f => f.synthesisId + '/' + f.findingId))
  const scopedFindings = syntheses.flatMap(s => (s.topicFindings || []).filter(f => currentKeys.has(s.id + '/' + f.id)))
  const supportingRecords = new Set(scopedFindings.flatMap(f => f.supportingRecordIds))
  const contradictingRecords = new Set(scopedFindings.flatMap(f => f.contradictingRecordIds))
  const observedEpisodes = new Set(events.map(r => r.episodeId)), topicStates = unique(events.map(useState))
  const coverage = { state: 'partial', membershipEpisodes: scope.episodeIds.size,
    episodesWithChannelRecords: observedEpisodes.size, episodesWithoutChannelRecord: scope.episodeIds.size - observedEpisodes.size,
    recordStates: countBy(events.map(useState)), episodeStates: Object.fromEntries(topicStates.map(state => [state, unique(events.filter(r => useState(r) === state).map(r => r.episodeId)).length])),
    denominator: { value: null, state: 'unknown', reason: 'No explicit topic sampling/asked-question denominator; segment membership is not channel-question coverage.' },
    limitation: 'Absence of a record is not a negative answer. States may overlap within an episode. This selected sample is not a market share.' }
  const units = unique(events.flatMap(r => r.evidenceRefs.map(e => e.sourceUnitId))).map(id => historical.get(id)).filter(Boolean)
  const relevantCheckpoints = data.checkpoints.filter(cp => units.some(unit => cp.sourceIds.includes(unit.sourceId) &&
    (!cp.sourceRanges || cp.sourceRanges.some(range => range.sourceId === unit.sourceId && range.startLine <= unit.locator.startLine && range.endLine >= unit.locator.endLine))))
  coverage.sourceReview = { checkpoints: countBy(relevantCheckpoints.map(cp => cp.status)),
    unitDispositions: countBy(units.map(unit => coverages.get(unit.id)?.disposition || 'no_coverage_record')),
    limitation: 'Source review completion does not certify channel-question coverage.' }
  const origin = originSummary(events)
  const staleMembershipBases = scope.memberships.filter(m => !scope.byId.has(m.synthesisRevisionId) || scope.byId.get(m.synthesisRevisionId).researchRevision !== data.factRevision).length
  const hasStaleSynthesis = findings.some(f => f.stale) || syntheses.some(s => s.researchRevision !== data.factRevision)
  const status = !answered.length ? 'not_researched' : !currentFindings.length
    ? hasStaleSynthesis ? 'stale' : 'not_synthesized'
    : origin.recordsWithMissingReviewedFields || events.length !== answered.length || coverage.episodesWithoutChannelRecord || staleMembershipBases || currentFindings.some(f => f.status === 'disputed' || f.contradiction.total) ? 'partial' : 'available'
  let selected
  if (view === 'cases') {
    if (!query.groupId || !groups.has(query.groupId)) throw new Error('Unknown channel groupId; read the current first summary page')
    selected = groups.get(query.groupId).records.slice().sort((a, b) => a.id.localeCompare(b.id)).map(caseRow)
  } else if (view === 'findings') selected = findings
  else selected = [...groups.values()].sort((a, b) => a.id.localeCompare(b.id)).map(groupRow)
  const paged = page(selected, query, { ...baseQuery, view })
  const synopsis = { id: segment?.id || query.segmentId, name: clip(segment?.label),
    definition: clip(segment?.data?.definition || segment?.data?.context), coreJob: clip(segment?.data?.coreJob),
    basis: 'graph_context_not_customer_validation', differences: 'See scoped findings; no differences inferred from names or counts.' }
  return { schemaVersion: 1, registryState: data.records.length ? 'populated' : 'empty', topic: 'channels', view, status, mode: currentFindings.length ? 'saved_synthesis_with_deterministic_observations' : 'deterministic_observations',
    revision: data.revision, factRevision: data.factRevision, graphRevision: graph.revision || 0, productId, segment: synopsis,
    freshness: { observations: 'current_snapshot', interpretation: currentFindings.length ? 'current' : hasStaleSynthesis ? 'stale' : 'not_synthesized' },
    scope: { membershipPeople: scope.personIds.size, membershipEpisodes: scope.episodeIds.size, memberships: membershipCounts([...scope.episodeIds].map(episodeId => ({ episodeId }))),
      excluded: 'withdrawn/superseded membership; other episodes of the same person',
      staleMembershipBases },
    synthesis: { total: syntheses.length, ids: syntheses.slice(0, 3).map(s => s.id), hasMore: syntheses.length > 3,
      detail: { type: 'SynthesisRevision', segmentId: query.segmentId, expectedRevision: data.revision, limit: 10 } },
    coverage, provenance: origin,
    ...(view === 'findings' ? {} : { findings: { total: findings.length, items: findings.slice(0, 2), hasMore: findings.length > 2,
      nextQuery: findings.length > 2 ? { ...baseQuery, view: 'findings', offset: 2, limit: 5 } : null } }),
    ...paged, limits: { maxPageItems: MAX_LIMIT, maxTextCharacters: TEXT_LIMIT, evidenceExamplesPerItem: 2,
      grouping: 'Exact stored channel + purpose + state + stage + solution ID; no brand/name normalization.',
      economics: 'CAC, conversion and ROI are unknown; observations and linked stages do not establish causal acquisition.' },
    expand: { cases: 'Use an item.cases query with research summary.', record: 'research read <workspace> id=<recordId> expectedRevision=' + data.revision,
      source: 'research source <workspace> <sourceUnitId> — only for a named unresolved question or an explicit source request.' } }
}

module.exports = { summarize, MAX_LIMIT, TEXT_LIMIT }
