// Competitor classification read from graph facts: the normalised competition kind and a
// rough price tier from free-text pricing. Same graph → same answer.

// GRAPH.md vocabulary is direct / indirect / diy / do_nothing; real graphs also carry
// aliases written by older skill runs. Normalised here, the graph itself is never touched.
const KIND_ALIASES = {
  direct: 'direct',
  indirect: 'indirect',
  marketplace: 'indirect',
  alternative: 'indirect',
  diy: 'diy',
  workaround: 'diy',
  do_nothing: 'do_nothing',
  'do-nothing': 'do_nothing',
  donothing: 'do_nothing',
  nothing: 'do_nothing',
}
function normalizeKind(kind) {
  const key = String(kind || '').trim().toLowerCase()
  if (!key) return 'unknown'
  if (KIND_ALIASES[key]) return KIND_ALIASES[key]
  if (key.startsWith('direct')) return 'direct'
  if (key.startsWith('indirect')) return 'indirect'
  if (key.startsWith('do_nothing') || key.startsWith('do-nothing')) return 'do_nothing'
  return 'unknown'
}

// Price tier from free-text pricing. Monthly thresholds in USD; RUB and EUR are converted
// roughly — the tier is a filter bucket, not an economic fact.
const TIER_LIMITS_USD = { cheap: 12, mid: 120 }
const RATES = { usd: 1, eur: 1.1, gbp: 1.25, rub: 1 / 90 }
// no \b: JavaScript word boundaries are ASCII-only and would miss Cyrillic words
const FREE_WORDS = /(^|[^a-zа-яё])(free|freemium|бесплатн[а-яё]*|open[- ]?source|opensource)(?![a-zа-яё])/i
const NUMBER = /(\$|€|£|usd|eur|gbp|руб\.?|₽|rub)?\s*(\d{1,3}(?:[  ,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|тыс\.?|тысяч\w*|m|млн\.?)?\s*(\$|€|£|usd|eur|gbp|руб\.?|₽|rub|р\.)?/gi
function currencyOf(token) {
  const key = String(token || '').toLowerCase()
  if (!key) return null
  if (key === '$' || key === 'usd') return 'usd'
  if (key === '€' || key === 'eur') return 'eur'
  if (key === '£' || key === 'gbp') return 'gbp'
  return 'rub'
}
const RANGE = /(\d+(?:[.,]\d+)?)\s*(?:[–—-]|до)\s*(\d+(?:[.,]\d+)?)\s*(k|тыс\.?|тысяч\w*|m|млн\.?)?\s*(\$|€|£|usd|eur|gbp|руб\.?|₽|rub|р\.)/gi
function pricedAmountsUsd(text) {
  const amounts = []
  // "5–12 тыс. руб." — the low end shares the high end's multiplier and currency
  for (const match of String(text).matchAll(RANGE)) {
    const currency = currencyOf(match[4])
    let amount = Number(String(match[1]).replace(',', '.'))
    const mult = String(match[3] || '').toLowerCase()
    if (mult.startsWith('k') || mult.startsWith('тыс')) amount *= 1000
    if (mult === 'm' || mult.startsWith('млн')) amount *= 1000000
    if (Number.isFinite(amount) && amount > 0) amounts.push(amount * RATES[currency])
  }
  for (const match of String(text).matchAll(NUMBER)) {
    const currency = currencyOf(match[1]) || currencyOf(match[4])
    if (!currency) continue
    let amount = Number(String(match[2]).replace(/[  ,]/g, m => (m === ',' && /^\d+,\d{1,2}$/.test(match[2]) ? '.' : '')))
    if (!Number.isFinite(amount)) continue
    const mult = String(match[3] || '').toLowerCase()
    if (mult.startsWith('k') || mult.startsWith('тыс')) amount *= 1000
    if (mult === 'm' || mult.startsWith('млн')) amount *= 1000000
    amounts.push(amount * RATES[currency])
  }
  return amounts
}
function priceTierOf(pricing) {
  const text = typeof pricing === 'string' ? pricing.trim() : pricing ? JSON.stringify(pricing) : ''
  if (!text) return 'unknown'
  const all = pricedAmountsUsd(text)
  const free = FREE_WORDS.test(text) || (all.length > 0 && all.every(amount => amount === 0))
  // the entry PAID tier decides the bucket: a freemium tool with a 990 ₽ plan is "cheap", not "free"
  const amounts = all.filter(amount => amount > 0)
  if (!amounts.length) return free ? 'free' : 'unknown'
  const entry = Math.min(...amounts)
  const yearly = /(в год|\/год|per year|\/yr|annual|годов)/i.test(text) && !/(мес|month|\/mo)/i.test(text)
  const monthly = yearly ? entry / 12 : entry
  if (monthly <= TIER_LIMITS_USD.cheap) return 'cheap'
  if (monthly <= TIER_LIMITS_USD.mid) return 'mid'
  return 'premium'
}

module.exports = { normalizeKind, priceTierOf }
