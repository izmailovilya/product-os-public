// Research coverage and viability are separate. A measured loss or a falsified
// assumption is a research result; it does not erase the work that established it.
const { evidenceUsable } = require('./graph/schema')
const GATES = [
  { key: 'hypothesis', label: 'Гипотеза оформлена', weight: 10, unlock: 'описать работу, критерии по приоритету и контекст' },
  { key: 'market-signal', label: 'Рыночные свидетельства изучены', weight: 10, unlock: 'найти первичные источники под критерии и проблемы сегмента' },
  { key: 'customers', label: 'Критерии проверены с клиентами', weight: 30, unlock: 'проверить верхние критерии каждой работы на 15 независимых интервью' },
  { key: 'fatal', label: 'Фатальные допущения исследованы', weight: 20, unlock: 'проверить фатальные риски сегмента и продукта; сохранить результат, включая отрицательный' },
  { key: 'payment', label: 'Платёжное поведение проверено', weight: 20, unlock: 'зафиксировать оплату нашего продукта или результат реального теста оплаты' },
  { key: 'economics', label: 'Экономика исследована', weight: 10, unlock: 'посчитать экономику на цене с источником и измеренном CAC; убыточный результат тоже засчитывается' },
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
  gate('hypothesis').detail = `${performs.length} работ · ${ordered.length} критериев${context ? '' : ' · контекст не описан'}`
  const web = segmentEvidence.filter(ev => originOf(ev) === 'web')
  gate('market-signal').earned = web.length ? 10 : 0
  gate('market-signal').detail = `${web.length} свидетельств с первичными источниками`
  const interviews = new Set(segmentEvidence.filter(ev => originOf(ev) === 'interview')
    .map(ev => ev.data.respondentId || ev.data.observationId || ev.source.split('#')[0])).size
  const studied = top.filter(c => evidence(c.id).some(ev => CUSTOMER_ORIGINS.has(originOf(ev))))
  gate('customers').earned = Math.round(30 * Math.min(1, interviews / INTERVIEW_TARGET) * (top.length ? studied.length / top.length : 0))
  gate('customers').detail = `интервью: ${interviews} из ${INTERVIEW_TARGET} · проверено ${studied.length} из ${top.length} верхних критериев`
  const closed = fatal.filter(n => {
    if (n.status === 'dropped') return n.data?.resolution?.kind === 'dependency-removed' && n.data.resolution.reason && n.data.resolution.source
    const type = n.status === 'contradicted' ? 'contradicted_by' : 'evidenced_by'
    const proof = evidence(n.id, type, { active: true })
    const official = n.data?.fundamental && ['legal', 'regulatory', 'platform_dependency', 'market_entry'].includes(n.data.category)
      && ['evidenced', 'contradicted'].includes(n.status) && proof.some(ev => ev.data?.verified === true && ev.data?.claimKind === 'fundamental-risk' && ev.data?.sourceKind === 'official')
    return official || ['validated', 'contradicted'].includes(n.status) && proof.some(ev => CUSTOMER_ORIGINS.has(originOf(ev)))
  })
  gate('fatal').earned = fatal.length ? Math.round(20 * closed.length / fatal.length) : 0
  gate('fatal').detail = `исследовано ${closed.length} из ${fatal.length} · включая риски всего продукта`
  const payment = segmentEvidence.filter(ev => ev.data?.segmentId === segmentId && productIds.has(ev.data?.productId)
    && (originOf(ev) === 'payment' || (originOf(ev) === 'test' && ev.data.kind === 'payment-test')))
  gate('payment').earned = payment.length ? 20 : 0
  gate('payment').detail = payment.length ? 'есть результат проверки оплаты нашего продукта' : 'нет проверки оплаты с указанием продукта и сегмента'
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
    ? `${ratio == null ? 'CAC = 0' : `LTV:CAC ${Math.round(ratio * 100) / 100}`} · ${contribution >= eco.cacUsd ? 'привлечение окупается' : 'привлечение не окупается'}; результат изучен`
    : 'нужны исходные числа, источник цены и источник измеренного CAC'
  const contradictedCriteria = top.filter(c => evidence(c.id, 'contradicted_by', { active: true }).some(ev => CUSTOMER_ORIGINS.has(originOf(ev))))
  const broken = fatal.filter(n => n.status === 'contradicted')
  const blockers = [
    ...contradictedCriteria.map(n => ({ id: n.id, gate: 'customers', reason: `Опровергнут критерий «${n.label}»` })),
    ...broken.map(n => ({ id: n.id, gate: 'fatal', reason: `Опровергнуто фатальное допущение «${n.label}»` })),
    ...(known && contribution < eco.cacUsd ? [{ id: segmentId, gate: 'economics', reason: 'Исследованная экономика не покрывает привлечение клиента' }] : []),
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
