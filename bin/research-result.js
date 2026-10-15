// Validate persisted workflow output again at the graph/eval boundary.
const q = require('./research-quality')
const { finalizeMoves } = require('./research-gates')
const { behaviourCandidates, applyBehaviourGroups } = require('./behaviour-identity')
function normalizeResearchResult(input) {
  const R = structuredClone(input)
  R.researchContext = q.createResearchContext({ researchContext: R.researchContext })
  R.evidenceLedger = q.verifyEvidencePacket(R.evidencePacket || {}, R.verificationChecks || [], R.researchContext)
  if (R.researchMode === 'focused') {
    const gap = R.researchGap || {}
    if (![gap.nodeId, gap.section, gap.question, gap.expectedOutcome].every(q.researchText)) throw new Error('Focused research needs nodeId, section, question and expectedOutcome')
    if(R.customerProfile){const issue=require('./customer-profile').customerProfileIssue(R.customerProfile);if(issue)throw new Error(issue)}
    if(R.parameterModel){const issue=require('./segment-model').segmentModelIssue(R.parameterModel);if(issue)throw new Error(issue)}
    R.findings = q.groundFocusedFindings(R.findings, R.evidenceLedger)
    R.failedStages = (R.stages || []).filter(s => s.required && s.status !== 'completed')
    const modelComplete = (!R.segmentModelContract || !!R.parameterModel && (R.stages||[]).some(s=>s.label==='segment-model:'+gap.nodeId&&s.required&&s.status==='completed')) && (!R.customerProfileContract || !!R.customerProfile && (R.stages||[]).some(s=>s.label==='customer-profile:'+gap.nodeId&&s.required&&s.status==='completed'))
    const gatherComplete = (R.stages || []).some(s => s.label === 'focused-gather' && s.status === 'completed' && s.required)
    const verificationComplete = !R.evidencePacket?.claims?.some(c => c.observations?.length) || (R.stages || []).some(s => /^verify:focused:/.test(s.label) && s.status === 'completed' && s.required)
    R.stage = R.stage === 'focused' && gatherComplete && modelComplete && verificationComplete && !R.failedStages.length ? 'focused' : 'partial'
    R.executionReady = false // Research completion never grants launch/delivery authorization.
    R.nextMoves = { nextMoves: [], optionsNotTaken: [] }
    const search = R.research || {}, searched = search.queries?.some(q.researchText) && q.researchText(search.checkedAt)
    const sourceIds = (search.sourceIds || []).filter(id => R.evidenceLedger.sources.some(s => s.id === id))
    R.research = { ...search, sourceIds, status: R.findings.some(f => f.sources.length) ? 'researched'
      : searched && search.status === 'not_found' && sourceIds.length ? 'not_found'
        : searched && search.status === 'unavailable' ? 'unavailable' : searched ? 'researched' : 'not_researched' }
    return R
  }
  R.market = q.groundMarket(R.market || {}, R.evidenceLedger, R.researchContext)
  const prepared = q.prepareSegments(R.segments || []).map(segment => {
    if(segment.customerProfile){const issue=require('./customer-profile').customerProfileIssue(segment.customerProfile);if(issue)throw new Error(issue)}
    if(segment.parameterModel){const issue=require('./segment-model').segmentModelIssue(segment.parameterModel);if(issue)throw new Error(issue)}
    const deep = q.normalizeCriteria(segment, q.groundResearchFindings(segment.deep || {}, R.evidenceLedger), R.evidenceLedger)
    return { segment, deep, scored: q.scoreSegment(segment.scoring || {}, segment, deep, R.evidenceLedger, R.researchContext) }
  })
  R.segments = q.rankSegments(prepared).map(x => ({ ...x.segment, rank: x.rank, ranking: x.ranking, deep: x.deep, scoring: x.scored }))
  R.developmentHypotheses = q.developmentHypotheses(R.segments)
  const registry = q.buildRiskRegistry(R.fundamentalRisks, R.productRisks, R.segments, R.evidenceLedger)
  R.riskRegistry = registry.risks
  R.fundamentalRisks = registry.risks.filter(r => r.fundamental)
  R.productRisks = registry.risks.filter(r => r.scope === 'product' && !r.fundamental)
  for (const s of R.segments) s.scoring.segmentRat = registry.risks.filter(r => r.segmentId === s.id)
  const stageIssues = []
  const stages = R.stages || []
  if (behaviourCandidates(R.segments, R.existingCompetitors).length) {
    try { applyBehaviourGroups(R.segments, R.behaviourIdentity, R.existingCompetitors) }
    catch (error) { stageIssues.push(`behaviour-identity:${error.message}`) }
    if (!stages.some(s => s.label === 'behaviour-identity' && s.status === 'completed' && s.required === true)) stageIssues.push('required-stage-missing-or-failed:behaviour-identity')
  }
  const expected = ['market-research', 'comm-gaps', 'product-rat', 'next-moves', 'segment-review:0', 'plan-review:0']
  for (const s of R.intendedSegmentIds || R.segments.map(s => s.id)) expected.push(`field:${s}`, `score:${s}`)
  if(R.customerProfileContract)for(const s of R.segments){expected.push('customer-profile:'+s.id);if(!s.customerProfile)stageIssues.push('missing-customer-profile:'+s.id)}
  if(R.segmentModelContract)for(const s of R.segments){expected.push('segment-model:'+s.id);if(!s.parameterModel)stageIssues.push('missing-segment-model:'+s.id)}
  for (const label of expected) if (!stages.some(s => s.label === label && s.required === true && s.status === 'completed')) stageIssues.push(`required-stage-missing-or-failed:${label}`)
  if (!stages.some(s => /^verify:/.test(s.label) && s.status === 'completed') && R.evidencePacket?.claims?.some(c => c.observations?.length)) stageIssues.push('missing-source-verification-stage')
  if (R.fundamentalRisks.length && !stages.some(s => s.label === 'fundamental-check' && s.status === 'completed')) stageIssues.push('missing-fundamental-check-stage')
  R.failedStages = stages.filter(s => s.required && s.status !== 'completed')
  stageIssues.push(...R.failedStages.map(s => `required-stage-failed:${s.label}`))
  if (!R.segments.length) stageIssues.push('no-researched-segments')
  if ((R.intendedSegmentIds || []).some(id => !R.segments.some(s => s.id === id))) stageIssues.push('missing-intended-segment')
  R.stage = R.stage === 'full' && !stageIssues.length ? 'full' : 'partial'
  const gate = finalizeMoves(R.nextMoves, R.riskRegistry, R.researchContext.businessGoal, { requireStructured: true, requireReview: true,
    constraints: R.researchContext.constraints, limits: R.researchContext.limits, evidenceFingerprint: q.researchId('ledger', R.evidenceLedger), reviews: R.planReview?.reviews || [] })
  R.nextMoves = gate.nextMoves
  const fatal = R.riskRegistry.filter(r => r.fatal)
  R.evidenceQuality = { ...R.evidenceLedger.coverage,
    sufficientForDelivery: R.segments.length > 0 && R.segments.every(s => !s.scoring.thinEvidence && s.deep.segmentReview?.decision === 'retain') && !fatal.some(r => r.status !== 'supported') && !R.market.consistencyIssues.length,
    issues: [...R.evidenceLedger.issues, ...R.market.consistencyIssues, ...registry.issues, ...R.segments.flatMap(s => s.deep.criteriaIssues || [])] }
  R.validationDebt = { unvalidatedAssumptions: R.riskRegistry.filter(r => !['supported', 'refuted'].includes(r.status)).length,
    fatal: fatal.filter(r => !['supported', 'refuted'].includes(r.status)).length,
    fundamentalBlockersUntested: gate.untestedBlockers.filter(r => r.status !== 'refuted').length,
    fundamentalBlockersUncovered: gate.uncoveredBlockers.length,
    unconfirmedCriteria: R.segments.reduce((n, s) => n + s.deep.criteriaValidation.filter(c => c.status === 'unconfirmed').length, 0) }
  const delivery = R.nextMoves.nextMoves.some(m => m.horizon === 'now' && m.intent === 'delivery')
  R.blockedReasons = [...new Set([...(R.blockedReasons || []), ...registry.issues, ...stageIssues, ...gate.blockedReasons,
    ...(delivery && !R.evidenceQuality.sufficientForDelivery ? ['insufficient-evidence-for-delivery'] : [])])]
  R.executionReady = R.executionReady === true && R.stage === 'full' && !R.blockedReasons.length
  return R
}
module.exports = { normalizeResearchResult }
