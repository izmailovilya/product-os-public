// Keep the standalone workflow's marked copy identical; the regression test checks it.
function finalizeMoves(raw, risks, goal, options = {}) {
  const key = text => String(text || '').trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ')
  const threshold = text => typeof text === 'string' && text.trim().length >= 8 && /\d/.test(text)
    && /fails?|fewer|less|more|exceed|below|above|under|over|неудач|провал|отказ|меньше|менее|больше|более|превыс|ниже|выше/i.test(text)
    && !/\b(?:tbd|todo|define|placeholder)\b|определить порог|уточнить порог|задать порог/i.test(text)
  const structured = test => test && String(test.metric || '').trim() && String(test.measurement || '').trim()
    && String(test.deadline || '').trim() && (test.operator === 'equals'
      ? typeof test.value === 'string' && test.value.trim().length > 0
      : ['<', '<=', '>', '>=', '='].includes(test.operator) && Number.isFinite(test.value) && String(test.unit || '').trim())
    && (test.sampleSize == null || Number.isInteger(test.sampleSize) && test.sampleSize > 0)
  const known = risks.map((r, i) => ({ ...r, id: r.id || `risk-${i + 1}` }))
  const ids = new Map()
  for (const move of raw?.nextMoves || []) ids.set(move.id, (ids.get(move.id) || 0) + 1)
  const moves = (raw?.nextMoves || []).map(move => {
    const matches = known.filter(r => move.testsAssumptionId ? r.id === move.testsAssumptionId : key(r.assumption) === key(move.testsAssumption))
    const risk = matches.length === 1 ? matches[0] : null
    const issues = []
    if ((options.requireStructured || options.requireReview) && (!String(move.id || '').trim() || ids.get(move.id) !== 1)) issues.push('missing-or-duplicate-move-id')
    if (!['now', 'next', 'later'].includes(move.horizon)) issues.push('invalid-horizon')
    if (!String(move.action || '').trim()) issues.push('missing-action')
    if ((move.testsAssumption || move.testsAssumptionId) && !risk) issues.push('unknown-or-ambiguous-assumption')
    if (risk && !(structured(move.failureTest) || !options.requireStructured && threshold(move.killCriterion))) issues.push('missing-measurable-kill-criterion')
    if (options.requireStructured && move.horizon === 'now' && !risk) issues.push('now-needs-assumption')
    if (goal && move.horizon === 'now' && !String(move.servesGoal || '').trim()) issues.push('missing-goal-link')
    if (options.constraints && move.horizon === 'now' && !String(move.respectsConstraints || '').trim()) issues.push('missing-constraint-explanation')
    const reviews = (options.reviews || []).filter(r => r.moveId === move.id)
    const review = reviews.length === 1 ? reviews[0] : null
    if (options.requireReview && (!review || review.moveFingerprint !== moveReviewFingerprint(move, known, goal, options) || review.assumptionMatches !== true || review.failureTestValid !== true || review.goalAligned !== true || review.constraintsSatisfied !== true)) issues.push('plan-review-not-passed')
    for (const field of ['budgetUsd', 'hours', 'people']) {
      const limit = options.limits?.[field]
      if (limit != null && (!Number.isFinite(move.resources?.[field]) || move.resources[field] < 0 || move.resources[field] > limit)) issues.push(`constraint-exceeded-or-unknown:${field}`)
    }
    return { ...move, testsAssumptionId: risk?.id || null, executionReady: move.executionReady !== false && issues.length === 0, issues }
  })
  let count = 0
  const final = moves.map(m => m.horizon === 'now' && ++count > 3 ? { ...m, horizon: 'next' } : m)
  const now = final.filter(m => m.horizon === 'now' && m.executionReady)
  const critical = known.filter(r => (r.fatal || r.impact === 5 || r.critical) && !['supported', 'validated', 'dependency-removed'].includes(r.status))
  const fundamental = critical.filter(r => r.checkBeforeSpending)
  const untestedBlockers = fundamental
  const uncoveredBlockers = fundamental.filter(r => !final.some(m => m.executionReady && m.testsAssumptionId === r.id))
  const reachable = (move, seen = new Set()) => {
    if (!move || !move.executionReady || seen.has(move.id)) return false
    if (move.horizon === 'now') return !(move.dependsOn || []).length
    if (!(move.dependsOn || []).length) return false
    const next = new Set(seen); next.add(move.id)
    return move.dependsOn.every(id => reachable(final.find(m => m.id === id), next))
  }
  const unscheduled = fundamental.filter(r => !final.some(m => m.testsAssumptionId === r.id && reachable(m)))
  const fatalCovered = !critical.length || now.some(m => critical.some(r => r.id === m.testsAssumptionId))
  const blockedReasons = [
    ...(!now.length ? ['no-ready-now-move'] : []),
    ...(!fatalCovered ? ['no-critical-assumption-tested-now'] : []),
    ...unscheduled.map(r => `fundamental-blocker-without-reachable-test:${r.id}`),
    ...final.filter(m => m.horizon === 'now' && m.intent === 'delivery' && critical.length).map(m => `delivery-before-unresolved-risk:${m.id || m.action}`),
    ...final.filter(m => m.horizon === 'now' && (m.dependsOn || []).length).map(m => `now-move-has-pending-dependencies:${m.id || m.action}`),
    ...final.filter(m => m.horizon === 'now').flatMap(m => m.issues.map(issue => `${issue}:${m.action}`)),
  ]
  for (const field of ['budgetUsd', 'hours']) if (options.limits?.[field] != null && now.reduce((sum, m) => sum + (m.resources?.[field] || 0), 0) > options.limits[field]) blockedReasons.push(`combined-now-budget-exceeded:${field}`)
  return { nextMoves: { ...raw, nextMoves: final }, untestedBlockers, uncoveredBlockers,
    executionReady: blockedReasons.length === 0, blockedReasons,
    goalAlignment: { stated: Boolean(goal), nowMovesWithoutGoalLink: final.filter(m => m.horizon === 'now' && m.issues.includes('missing-goal-link')).length } }
}

function moveReviewFingerprint(move, risks, goal, options = {}) {
  const keys = ['id', 'action', 'why', 'testsAssumptionId', 'testsAssumption', 'killCriterion', 'failureTest', 'resources', 'dependsOn', 'intent', 'horizon', 'servesGoal', 'respectsConstraints', 'usesAssets', 'segmentId', 'claimIds']
  const risk = risks.find(r => r.id === move.testsAssumptionId)
  const text = JSON.stringify({ move: Object.fromEntries(keys.map(k => [k, move[k] ?? null])), risk: risk ? { id: risk.id, assumption: risk.assumption, fatal: Boolean(risk.fatal || risk.impact === 5), status: risk.status || 'unconfirmed' } : null,
    goal: goal || '', constraints: options.constraints || '', limits: options.limits || {}, evidenceFingerprint: options.evidenceFingerprint || null })
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return `move-review-${(hash >>> 0).toString(36)}`
}

module.exports = { finalizeMoves, moveReviewFingerprint }
