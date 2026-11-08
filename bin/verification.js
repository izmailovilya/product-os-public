// Research coverage and viability are separate. A measured loss or a falsified
// assumption is a research result; it does not erase the work that established it.
const { evidenceUsable } = require('./graph/schema')
const GATES = [
  { key: 'hypothesis', label: "Hypothesis completed", weight: 10, unlock: "describe the work, priority criteria and context" },
  { key: 'market-signal', label: "Market evidence examined", weight: 10, unlock: "find primary sources for the criteria and problems of the segment" },
  { key: 'customers', label: "Criteria verified with clients", weight: 30, unlock: "check the top criteria of each job for 15 independent interviews" },
  { key: 'fatal', label: "Fatal assumptions explored", weight: 20, unlock: "check the fatal risks of the segment and product; save the result, including negative ones" },
  { key: 'payment', label: "Payment behavior checked", weight: 20, unlock: "record payment for our product or the result of a real payment test" },
  { key: 'economics', label: "Economy explored", weight: 10, unlock: "calculate economics based on price with source and measured CAC; a losing result is also counted" },
]
const INTERVIEW_TARGET = 15
const TOP_CRITERIA = 3
const CUSTOMER_ORIGINS = new Set(['interview', 'test', 'payment'])
const originOf = ev => ev?.data?.origin || (/^https?:\/\//.test(ev?.source || '') ? 'web' : 'unknown')
const usable = ev => evidenceUsable(ev?.data?.origin ? ev : { ...ev, data: { ...ev?.data, origin: originOf(ev) } })
const finite = value => typeof value === 'number' && Number.isFinite(value)

function verificationOf(segmentId, nodes = [], edges = []) {
  const by = new Map(nodes.map(n => [n.id, n]))
  const seg = by.get(segmentId), d = seg?.data || {}
  const productIds = new Set(nodes.filter(n => n.type === 'product').map(n => n.id))
  const performs = edges.filter(e => e.from === segmentId && e.type === 'performs' && by.get(e.to)?.type === 'job')
  const ordered = [], top = []
  for (const pe of performs) {
    const refs = Array.isArray(pe.data?.criteria) ? pe.data.criteria.slice().sort((a, b) => a.priority - b.priority)
      : edges.filter(e => e.from === pe.to && e.type === 'judged_by').map(e => ({ id: e.to }))
    const own = refs.map(r => by.get(r.id)).filter(c => c?.type === 'criterion' && (!c.data?.segmentId || c.data.segmentId === segmentId))
    for (const c of own) if (!ordered.includes(c)) ordered.push(c)
    for (const c of own.slice(0, TOP_CRITERIA)) if (!top.includes(c)) top.push(c)
  }
  const scoped = ev => !ev.data?.segmentId || ev.data.segmentId === segmentId
  const evidence = (id, relation, { active = false } = {}) => edges.filter(e => e.from === id
    && (relation ? e.type === relation : ['evidenced_by', 'contradicted_by'].includes(e.type))
    && (!active || !e.data?.resolvedAt)).map(e => by.get(e.to)).filter(ev => usable(ev) && scoped(ev))
  const problems = edges.filter(e => e.from === segmentId && e.type === 'suffers').map(e => by.get(e.to)).filter(Boolean)
  const segmentRisks = edges.filter(e => e.type === 'about' && e.to === segmentId).map(e => by.get(e.from)).filter(n => n?.type === 'assumption')
  const productRisks = edges.filter(e => e.type === 'about' && productIds.has(e.to)).map(e => by.get(e.from)).filter(n => n?.type === 'assumption')
  const fatal = [...new Map([...segmentRisks, ...productRisks].filter(n => n.data?.fatal).map(n => [n.id, n])).values()]
  const segmentEvidence = [...new Map([seg, ...ordered, ...problems, ...segmentRisks].filter(Boolean)
    .flatMap(n => evidence(n.id)).map(ev => [ev.id, ev])).values()]
  const gates = GATES.map(g => ({ ...g, earned: 0, done: false, partial: false, blocked: false, detail: '' }))
  const gate = key => gates.find(g => g.key === key)
  const context = performs.every(pe => pe.data?.context || d.context)
  gate('hypothesis').earned = performs.length && ordered.length >= 2 && context ? 10 : 0
  const word=(n,one,few,many)=>n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&!(n%100>=12&&n%100<=14)?few:many
  gate('hypothesis').detail = `${performs.length} ${word(performs.length,"job","work","work")} in the column · ${ordered.length?ordered.length+' '+word(ordered.length,"criterion","criteria","criteria"):"graph criteria have not yet been selected"}${context ? '' : " · context not described"}`
  const web = segmentEvidence.filter(ev => originOf(ev) === 'web')
  gate('market-signal').earned = web.length ? 10 : 0
  gate('market-signal').detail = `${web.length} evidence with primary sources`
  const interviews = new Set(segmentEvidence.filter(ev => originOf(ev) === 'interview')
    .map(ev => ev.data.respondentId || ev.data.observationId || ev.source.split('#')[0])).size
  const studied = top.filter(c => evidence(c.id).some(ev => CUSTOMER_ORIGINS.has(originOf(ev))))
  gate('customers').earned = Math.round(30 * Math.min(1, interviews / INTERVIEW_TARGET) * (top.length ? studied.length / top.length : 0))
  gate('customers').detail = `interview: ${interviews} from ${INTERVIEW_TARGET} · ${top.length?"checked "+studied.length+" from "+top.length+" main criteria":"the graph criteria being checked have not yet been selected"}`
  const closed = fatal.filter(n => {
    if (n.status === 'dropped') return n.data?.resolution?.kind === 'dependency-removed' && n.data.resolution.reason && n.data.resolution.source
    const type = n.status === 'contradicted' ? 'contradicted_by' : 'evidenced_by'
    const proof = evidence(n.id, type, { active: true })
    const official = n.data?.fundamental && ['legal', 'regulatory', 'platform_dependency', 'market_entry'].includes(n.data.category)
      && ['evidenced', 'contradicted'].includes(n.status) && proof.some(ev => ev.data?.verified === true && ev.data?.claimKind === 'fundamental-risk' && ev.data?.sourceKind === 'official')
    return official || ['validated', 'contradicted'].includes(n.status) && proof.some(ev => CUSTOMER_ORIGINS.has(originOf(ev)))
  })
  gate('fatal').earned = fatal.length ? Math.round(20 * closed.length / fatal.length) : 0
  gate('fatal').detail = fatal.length
    ? `investigated ${closed.length} from ${fatal.length} · including the risks of the entire product`
    : "fatal assumptions have not yet been highlighted; product and segment risks have not been verified"
  const payment = segmentEvidence.filter(ev => ev.data?.segmentId === segmentId && productIds.has(ev.data?.productId)
    && (originOf(ev) === 'payment' || (originOf(ev) === 'test' && ev.data.kind === 'payment-test')))
  gate('payment').earned = payment.length ? 20 : 0
  gate('payment').detail = payment.length ? "there is a result of checking the payment for our product" : "no payment verification indicating product and segment"
  const eco = d.economics || {}
  const realPrice = eco.priceBasis === 'product-pricing' && !d.economicsUnpriced
  const verifiedScenario = d.scoringVersion !== 2 || d.economicScenario?.status === 'scenario' && d.economicScenario?.measuredCac === true
  const known = verifiedScenario && realPrice && eco.cacBasis === 'measured' && Boolean(eco.priceSource && eco.cacSource)
    && [eco.monthlyPriceUsd, eco.monthlyCogsUsd, eco.lifetimeMonths, eco.cacUsd].every(finite)
    && eco.monthlyPriceUsd >= 0 && eco.monthlyCogsUsd >= 0 && eco.lifetimeMonths > 0 && eco.cacUsd >= 0
  const contribution = known ? (eco.monthlyPriceUsd - eco.monthlyCogsUsd) * eco.lifetimeMonths : null
  const ratio = known && eco.cacUsd > 0 ? contribution / eco.cacUsd : null
  gate('economics').earned = known ? 10 : 0
  gate('economics').detail = known
    ? `${ratio == null ? 'CAC = 0' : `LTV:CAC ${Math.round(ratio * 100) / 100}`} · ${contribution >= eco.cacUsd ? "attraction pays off" : "attraction does not pay off"}; result studied`
    : "Need raw numbers, price source and measured CAC source"
  const contradictedCriteria = top.filter(c => evidence(c.id, 'contradicted_by', { active: true }).some(ev => CUSTOMER_ORIGINS.has(originOf(ev))))
  const broken = fatal.filter(n => n.status === 'contradicted')
  const blockers = [
    ...contradictedCriteria.map(n => ({ id: n.id, gate: 'customers', reason: `Criteria rejected «${n.label}»` })),
    ...broken.map(n => ({ id: n.id, gate: 'fatal', reason: `Fatal assumption refuted «${n.label}»` })),
    ...(known && contribution < eco.cacUsd ? [{ id: segmentId, gate: 'economics', reason: "Researched economics does not cover customer acquisition" }] : []),
  ]
  for (const g of gates) { g.done = g.earned >= g.weight; g.partial = g.earned > 0 && !g.done }
  const percent = gates.reduce((sum, g) => sum + g.earned, 0)
  const next = gates.find(g => !g.done)
  return { percent, interviews, passed: gates.filter(g => g.done).length, total: gates.length, gates,
    blockedAt: blockers[0]?.gate || null, blockedReason: blockers[0]?.reason || '', blockers,
    economics: { researched: known, contribution, ltvToCac: ratio, acquisitionCovered: known ? contribution >= eco.cacUsd : null },
    next: next ? { key: next.key, label: next.label, unlock: next.unlock } : null }
}
module.exports = { GATES, INTERVIEW_TARGET, TOP_CRITERIA, originOf, verificationOf }
