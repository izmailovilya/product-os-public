// Pure research contracts. Embedded verbatim in the standalone Workflow script by
// scripts/sync-research-runtime.js; keep filesystem/network work outside this module.
function researchKey(value) { return String(value ?? '').trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ') }
function researchId(prefix, values) {
  const text = JSON.stringify(values)
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return `${prefix}-${(hash >>> 0).toString(36)}`
}
function researchText(value) { return typeof value === 'string' && Boolean(value.trim()) }
function researchNumber(value) { return typeof value === 'number' && Number.isFinite(value) }
function validateResearchValue(value, schema, at = '$') {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  if (!types.some(t => t === type || t === 'integer' && Number.isInteger(value))) return `${at}: expected ${types.join('|')}`
  if (schema.enum && !schema.enum.includes(value)) return `${at}: unknown enum value`
  if (type === 'number' && (!Number.isFinite(value) || schema.minimum != null && value < schema.minimum || schema.maximum != null && value > schema.maximum)) return `${at}: number outside bounds`
  if (type === 'array') {
    if (schema.minItems != null && value.length < schema.minItems || schema.maxItems != null && value.length > schema.maxItems) return `${at}: wrong item count`
    for (const [i, item] of value.entries()) { const error = validateResearchValue(item, schema.items, `${at}[${i}]`); if (error) return error }
  }
  if (type === 'object') {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) return `${at}.${key}: missing`
    for (const [key, item] of Object.entries(value)) {
      if (!schema.properties?.[key]) { if (schema.additionalProperties === false) return `${at}.${key}: unknown property`; continue }
      const error = validateResearchValue(item, schema.properties[key], `${at}.${key}`); if (error) return error
    }
  }
  return null
}
function primarySource(value) {
  if (typeof value !== 'string') return false
  if (/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(value)) return true
  try {
    const decoded = decodeURIComponent(value.split('#')[0])
    return decoded.startsWith('sources/') && !/[\\\s]/.test(decoded) && decoded.split('/').slice(1).every(p => p && p !== '.' && p !== '..')
  } catch { return false }
}
function sourceKey(value) { return String(value || '').replace(/#.*$/, '').replace(/[?&](?:utm_[^=&]+|fbclid|gclid)=[^&]*/g, '').replace(/[?&]$/, '').replace(/\/$/, '') }
// Market labels are matched literally against every claim, so a sentence never matches.
// Checked when a run is launched; saved results keep whatever frame they were run with.
// Workflow runtimes forbid the clock (it breaks resume), so dates are parsed as pure
// UTC arithmetic. Returns epoch milliseconds, or NaN for anything but an ISO date/time.
function researchTime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(String(value ?? '').trim())
  if (!m) return NaN
  const [year, month, day, hour = 0, minute = 0, second = 0] = m.slice(1, 7).map(part => Number(part || 0))
  if (month < 1 || month > 12 || day < 1 || day > [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || hour > 23 || minute > 59 || second > 59) return NaN
  const y = month <= 2 ? year - 1 : year, era = Math.floor(y / 400), yoe = y - era * 400
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1
  const days = era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468
  const offset = !m[8] || m[8] === 'Z' ? 0 : (m[8][0] === '-' ? -1 : 1) * (Number(m[8].slice(1, 3)) * 60 + Number(m[8].slice(-2)))
  return ((days * 24 + hour) * 60 + minute - offset) * 60000 + second * 1000 + Number((m[7] || '0').padEnd(3, '0'))
}
function marketLabelIssue(markets = []) {
  const bad = markets.find(m => String(m).length > 40 || /[;:]/.test(String(m)))
  return bad ? `targetMarkets must be short market labels such as "Россия" or "Русскоязычные в ЕС" (qualifiers belong in productContext), not: ${bad}` : null
}
function createResearchContext(args = {}) {
  const supplied = args.researchContext || {}
  const markets = supplied.targetMarkets ?? args.targetMarkets ?? []
  const context = {
    productId: supplied.productId || args.productId || 'product',
    productContext: supplied.productContext ?? args.productContext ?? '',
    businessGoal: supplied.businessGoal ?? args.businessGoal ?? '',
    assets: supplied.assets ?? args.assets ?? null,
    constraints: supplied.constraints ?? args.constraints ?? '',
    limits: supplied.limits || args.limits || {},
    targetMarkets: (Array.isArray(markets) ? markets : [markets]).filter(researchText),
    asOf: supplied.asOf || args.asOf || '',
    stage: supplied.stage || args.stage || 'unknown',
    inputClaims: Array.isArray(supplied.inputClaims) ? supplied.inputClaims : [],
    existingResearch: supplied.existingResearch || null,
  }
  if (!researchText(context.productContext)) throw new Error('productContext is required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(context.asOf) || !Number.isFinite(researchTime(context.asOf))) throw new Error('asOf must be an ISO date (YYYY-MM-DD snapshot date)')
  for (const c of context.inputClaims) {
    if (!c.id || !researchText(c.statement) || !['founder', 'source', 'derived', 'hypothesis'].includes(c.origin)) throw new Error('Input claims need id, statement and explicit origin')
    if (c.origin === 'source' && !primarySource(c.source)) throw new Error(`Input claim ${c.id} needs a primary source`)
  }
  for (const name of ['budgetUsd', 'hours', 'people']) if (context.limits[name] != null && (!researchNumber(context.limits[name]) || context.limits[name] < 0)) throw new Error(`Invalid constraint: ${name}`)
  context.id = researchId('context', context)
  return context
}
function prepareSegments(segments) {
  const ids = new Set()
  const labels = new Set()
  return (segments || []).map(s => {
    if (!s.id || ids.has(s.id) || !researchText(s.coreJob)) throw new Error('Segments need unique IDs and a Core Job')
    ids.add(s.id)
    const criteriaIds = new Set()
    const criteria = (s.criteria || []).map(c => {
      const id = c.id || researchId('criterion', [s.id, s.coreJob, c.criterion, c.level || ''])
      if (!researchText(c.criterion) || criteriaIds.has(id)) throw new Error(`Duplicate or empty criterion in ${s.id}`)
      criteriaIds.add(id)
      return { ...c, id }
    })
    // The display label is deliberately separate from the full research definition.
    // Old runs remain readable; new prompts explicitly author the short label.
    const candidate = String(s.shortName || s.name || '').split(/[:«“]/)[0].replace(/\.{3}|…/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 4).join(' ')
    let shortName = candidate && !/\bunknown\b/i.test(candidate) ? candidate : `Сегмент ${ids.size}`
    if (shortName.split(/\s+/).length < 2) shortName = `Сегмент ${shortName}`
    if (labels.has(researchKey(shortName))) shortName = `${shortName.split(/\s+/).slice(0, 3).join(' ')} ${ids.size}`
    labels.add(researchKey(shortName))
    return { ...s, shortName, description: s.description || s.name || s.context, criteria }
  })
}

const RESEARCH_SECTIONS = ['pricing', 'jobs', 'messaging', 'channels', 'complaints']
function competitorIdentity(entry) {
  const entityType = entry.isCategory || entry.entityType === 'category' ? 'category' : ['diy', 'do_nothing'].includes(entry.kind) ? 'behaviour' : 'solution'
  const name = entry.category?.name || entry.categoryName || entry.splitFrom || (entityType === 'category' ? entry.name : '')
  const category = name ? { id: entry.category?.id || entry.categoryId || researchId('category', researchKey(name)), name,
    ...(entry.category?.parentId || entry.parentCategoryId ? { parentId: entry.category?.parentId || entry.parentCategoryId } : {}) } : null
  return { ...entry, entityType, isCategory: entityType === 'category', category }
}
function groundCompetitorSections(entry, findings, reviews, ledger, segmentId) {
  const kinds = { pricing: ['competitor-price', 'job-spend'], jobs: ['capability', 'hired'], messaging: ['messaging'], channels: ['channel'], complaints: ['problem'] }
  const sections = {}
  for (const section of RESEARCH_SECTIONS) {
    const prior = entry.researchSections?.[section] || {}
    const review = (reviews || []).find(r => r.competitorId === entry.id && r.section === section) || prior
    const rows = (findings || []).filter(f => f.competitorId === entry.id && f.section === section)
    const records = (rows.length ? rows : prior.findings || []).map(f => {
      const scope = { subjectId: entry.id, segmentId: f.segmentId || segmentId || undefined, kind: kinds[section] }
      const claims = (f.claimIds || []).map(id => claimFor(ledger, id, scope)).filter(Boolean)
      // A true statement in a linked claim cannot authorize a different paraphrase.
      const matching = claims.filter(c => researchKey(c.statement) === researchKey(f.statement))
      const supportStatus = matching.some(c => c.status === 'mixed') || matching.some(c => c.status === 'supported') && matching.some(c => c.status === 'refuted') ? 'mixed'
        : matching.some(c => c.status === 'refuted') ? 'refuted' : matching.some(c => c.status === 'supported') ? 'supported' : 'unconfirmed'
      const sourceIds = [...new Set(claims.flatMap(c => c.observations || []).map(o => o.sourceId))]
      const sources = (ledger.sources || []).filter(s => sourceIds.includes(s.id)).map(s => ({ id: s.id, source: s.source, publishedAt: s.publishedAt, retrievedAt: s.retrievedAt }))
      const amount = supportStatus === 'supported' && matching.some(c => c.id === f.amountClaimId)
        ? quantityOf(ledger, f.amountClaimId, scope) : null
      const billing = Object.fromEntries(['billingUnit', 'includes', 'excludes'].map(key => [key,
        f[key] && matching.some(c => c.status === 'supported' && researchKey(c.statement).includes(researchKey(f[key]))) ? f[key] : null]))
      return { ...f, supportStatus, sourceIds, sources, amount, segmentId: f.segmentId || segmentId || null,
        ...billing,
        coverage: section === 'jobs' && supportStatus !== 'supported' ? 'unknown' : f.coverage }
    })
    const sourceIds = [...new Set([...(review.sourceIds || []), ...records.flatMap(f => f.sourceIds)])].filter(id => (ledger.sources || []).some(s => s.id === id))
    const searched = (review.queries || []).some(researchText) && researchText(review.checkedAt)
    let status = 'not_researched'
    if (records.length && sourceIds.length) status = 'researched'
    else if (searched && review.status === 'not_found' && sourceIds.length) status = 'not_found'
    else if (searched && review.status === 'unavailable') status = 'unavailable'
    else if (searched) status = 'researched'
    sections[section] = { status, summary: review.summary || '', checkedAt: review.checkedAt || null, sourceIds,
      queries: review.queries || [], limitations: review.limitations || '', findings: records }
  }
  return sections
}
function developmentHypotheses(segments) {
  const merged = new Map()
  for (const s of segments || []) {
    const scored = s.scoring || {}
    const ideas = [...(scored.valueIdeas || []).map(v => ({ ...v, type: v.type || 'feature' })),
      ...Object.values(scored.communication || {}).flat().filter(v => v && typeof v === 'object').map(v => ({ ...v, type: 'communication' }))]
    for (const idea of ideas) {
      const id = idea.id || researchId('idea', [idea.type, researchKey(idea.title)])
      const previous = merged.get(id)
      merged.set(id, { ...idea, id, status: 'hypothesis', description: idea.description || idea.message || idea.pain || '',
        expectedOutcome: idea.expectedOutcome || idea.outcome || '',
        segmentIds: [...new Set([...(previous?.segmentIds || []), s.id, ...(idea.segmentIds || [])])],
        jobIds: [...new Set([...(previous?.jobIds || []), ...(idea.jobIds || [])])],
        claimIds: [...new Set([...(previous?.claimIds || []), ...(idea.claimIds || [])])], dependsOn: idea.dependsOn || [] })
    }
  }
  const result = [...merged.values()]
  for (const idea of result) {
    idea.dependencyIssues = []
    const visits = new Set([idea.id])
    const walk = id => {
      if (visits.has(id)) { idea.dependencyIssues.push(`cyclic-dependency:${id}`); return }
      if (!merged.has(id)) { idea.dependencyIssues.push(`unknown-dependency:${id}`); return }
      visits.add(id); for (const dependency of merged.get(id).dependsOn) walk(dependency); visits.delete(id)
    }
    for (const dependency of idea.dependsOn) walk(dependency)
  }
  return result
}
function groundFocusedFindings(findings, ledger) {
  return (findings || []).map(f => {
    const claims = (f.claimIds || []).map(id => claimFor(ledger, id, { subjectId: f.subjectId })).filter(Boolean)
    const matching = claims.filter(c => researchKey(c.statement) === researchKey(f.statement))
    const positive = matching.some(c => ['supported', 'mixed'].includes(c.status)), negative = matching.some(c => ['refuted', 'mixed'].includes(c.status))
    const supportStatus = positive && negative ? 'mixed' : positive ? 'supported' : negative ? 'refuted' : 'unconfirmed'
    const sourceIds = [...new Set(claims.flatMap(c => c.observations || []).map(o => o.sourceId))]
    const billing = Object.fromEntries(['billingUnit', 'includes', 'excludes'].map(key => [key,
      f[key] && matching.some(c => c.status === 'supported' && researchKey(c.statement).includes(researchKey(f[key]))) ? f[key] : null]))
    return { ...f, ...billing, supportStatus, sourceIds, sources: (ledger.sources || []).filter(s => sourceIds.includes(s.id)),
      amount: supportStatus === 'supported' && matching.some(c => c.id === f.amountClaimId) ? quantityOf(ledger, f.amountClaimId, { subjectId: f.subjectId }) : null }
  })
}
function mergeEvidencePackets(packets) {
  const sources = new Map(), claims = new Map(), issues = [], ambiguous = new Set()
  for (const packet of packets.filter(Boolean)) for (const [type, map] of [['sources', sources], ['claims', claims]]) {
    for (const item of packet[type] || []) {
      if (!item?.id) { issues.push(`missing-${type}-id`); continue }
      if (map.has(item.id) && JSON.stringify(map.get(item.id)) !== JSON.stringify(item)) {
        ambiguous.add(`${type}:${item.id}`); issues.push(`conflicting-${type}-id:${item.id}`)
      } else map.set(item.id, item)
    }
  }
  return { sources: [...sources.values()].filter(x => !ambiguous.has(`sources:${x.id}`)), claims: [...claims.values()].filter(x => !ambiguous.has(`claims:${x.id}`)), issues }
}
// The quote must appear in the passage the verifier copied from the opened source. Typographic
// differences (quote marks, dashes, case, spacing) do not change what the page says, and a
// collector may cite two spans of one page joined by an ellipsis; every span must be present.
function quoteText(value) {
  return String(value ?? '').toLocaleLowerCase('ru').replace(/[«»“”„‟"]/g, '"').replace(/[‘’‚‛']/g, "'")
    .replace(/[‐-―−]/g, '-').replace(/…/g, '...').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim()
}
function quoteFoundIn(excerpt, quote) {
  const text = quoteText(excerpt)
  const spans = quoteText(quote).split(/\s*\.\.\.\s*/).map(s => s.replace(/^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g, '')).filter(s => s.length >= 3)
  return spans.length > 0 && spans.every(span => text.includes(span))
}
function verifyEvidencePacket(packet = {}, checks = [], context = {}) {
  const packetIssues = (packet.issues || []).filter(researchText)
  packet = mergeEvidencePackets([packet])
  packet.issues = [...new Set([...packetIssues, ...packet.issues])]
  const sources = new Map((packet.sources || []).map(s => [s.id, s]))
  const issues = [...(packet.issues || [])]
  const claims = (packet.claims || []).map(claim => {
    const observations = [], seen = new Set()
    for (const observation of claim.observations || []) {
      const source = sources.get(observation.sourceId)
      const matches = checks.filter(c => c.claimId === claim.id && c.sourceId === observation.sourceId && c.quote === observation.quote && c.relation === observation.relation)
      const check = matches.length === 1 ? matches[0] : null
      const key = `${sourceKey(source?.source)}|${String(observation.quote).replace(/\s+/g, ' ').trim()}|${observation.relation}`
      if (seen.has(key)) continue
      seen.add(key)
      const quote = String(observation.quote || '').replace(/\s+/g, ' ').trim()
      const checkedText = String(check?.sourceExcerpt || '').replace(/\s+/g, ' ').trim()
      const markets = (context.targetMarkets || []).map(researchKey)
      const declaredMarkets = (claim.markets || []).map(researchKey)
      // A literal market label match, or the independent check's explicit market verdict.
      const marketMatches = !markets.length || declaredMarkets.some(m => markets.includes(m)) || check?.marketFit === 'matched'
      const segmentBound = ['criterion-axis', 'criterion-level', 'criterion-priority', 'problem', 'hired', 'market-number', 'people-count', 'job-spend', 'cogs', 'cac', 'lifetime', 'channel'].includes(claim.kind) && claim.subjectId !== context.productId
      const scoped = segmentBound ? researchText(claim.segmentId) && check?.segmentFit === 'matched' : !claim.segmentId || check?.segmentFit === 'matched'
      const checkedAt = researchTime(check?.checkedAt)
      const asOf = researchTime(context.asOf)
      const withinSnapshot = Number.isFinite(checkedAt) && checkedAt <= asOf + 86400000 && checkedAt >= asOf - 7 * 86400000
      const reason = !source || !primarySource(source.source) ? 'missing-primary-source'
        : !check ? 'missing-or-duplicate-independent-check'
        : check.claimFingerprint !== researchId('claim', claim) || check.sourceFingerprint !== researchId('source', source) || check.contextFingerprint !== researchId('frame', context) ? 'check-does-not-match-claim-source-context'
        : check.opened !== true || !quote || !quoteFoundIn(checkedText, quote) ? 'quote-not-found-in-opened-source'
        // The excerpt above is the verifier's word. The page check is the code's own copy of the page,
        // attached at the save boundary (bin/source-snapshot.js); workflows run without it.
        : check.pageCheck?.status === 'not-found' ? 'quote-not-on-page'
        : check.scopeMatches !== true || !marketMatches || !scoped ? 'scope-not-established'
        : !withinSnapshot ? 'source-check-outside-snapshot'
        : check.temporalFit !== 'current' ? 'temporal-scope-not-established'
        : check.verdict !== observation.relation ? 'claim-not-supported-by-quote' : null
      observations.push({ ...observation, source: source?.source, sourceKind: source?.kind, publishedAt: source?.publishedAt || null,
        retrievedAt: check?.checkedAt || source?.retrievedAt, sourceExcerpt: check?.sourceExcerpt || null,
        independenceKey: sourceKey(source?.originalSource || check?.independenceKey || source?.source),
        usable: !reason, reason, verification: check || null,
        // found = the code saw the quote on its copy of the page; unavailable = only the verifier did.
        pageCheck: check?.pageCheck?.status || null, pageSnapshot: check?.pageCheck?.snapshot || null })
    }
    const support = observations.filter(o => o.usable && o.relation === 'supports')
    const refute = observations.filter(o => o.usable && o.relation === 'refutes')
    return { ...claim, observations, status: support.length && refute.length ? 'mixed' : refute.length ? 'refuted' : support.length ? 'supported' : 'unconfirmed',
      independentSources: new Set([...support, ...refute].map(o => o.independenceKey)).size }
  })
  const by = new Map(claims.map(c => [c.id, c]))
  const resolving = new Set(), resolved = new Set()
  const resolve = c => {
    if (!c?.derivation || resolved.has(c.id)) return c
    if (resolving.has(c.id)) { c.status = 'unconfirmed'; issues.push(`cyclic-derivation:${c.id}`); return null }
    resolving.add(c.id)
    const inputs = (c.derivation.inputClaimIds || []).map(id => resolve(by.get(id)))
    const validRange = x => !x.range || [x.range.low, x.range.base, x.range.high].every(researchNumber) && x.range.low >= 0 && x.range.low <= x.value && x.value <= x.range.high && x.range.base === x.value
    const good = inputs.length && inputs.every(x => x?.status === 'supported' && researchNumber(x.value) && x.value >= 0 && validRange(x) &&
      (x.kind === 'exchange-rate' || researchKey(x.subjectId) === researchKey(c.subjectId) && JSON.stringify(x.markets || []) === JSON.stringify(c.markets || [])))
    let value = null, low = null, high = null
    if (good) {
      const values = inputs.map(x => x.value)
      const lows = inputs.map(x => x.range?.low ?? x.value), highs = inputs.map(x => x.range?.high ?? x.value)
      if (c.derivation.operation === 'multiply' && inputs.length === 2) {
        const count = inputs.find(x => x.kind === 'people-count' && x.unit === 'entities')
        const spend = inputs.find(x => x.kind === 'job-spend' && x.unit === 'money')
        if (count && spend && c.kind === 'market-number' && c.unit === 'money' && c.currency === spend.currency && c.period === spend.period) {
          value = values[0] * values[1]; low = lows[0] * lows[1]; high = highs[0] * highs[1]
        }
      }
      // Addition requires explicit non-overlap evidence, not a model's boolean.
      const partition = by.get(c.derivation.partitionClaimId)
      const partitionCovers = partition?.subjectId === c.subjectId && JSON.stringify([...(partition?.memberClaimIds || [])].sort()) === JSON.stringify([...(c.derivation.inputClaimIds || [])].sort()) && new Set(c.derivation.inputClaimIds).size === inputs.length
      if (c.derivation.operation === 'add' && partitionCovers && partition?.status === 'supported' && partition.kind === 'population-partition' && inputs.every(x => x.kind === c.kind && x.unit === c.unit && x.currency === c.currency && x.period === c.period)) {
        value = values.reduce((a, b) => a + b, 0); low = lows.reduce((a, b) => a + b, 0); high = highs.reduce((a, b) => a + b, 0)
      }
      if (c.derivation.operation === 'divide' && inputs.length === 2 && lows[1] > 0 && inputs[0].kind === 'market-number' && inputs[1].kind === 'people-count' && c.kind === 'job-spend' && c.unit === inputs[0].unit && c.period === inputs[0].period && c.currency === inputs[0].currency) {
        value = values[0] / values[1]; low = lows[0] / highs[1]; high = highs[0] / lows[1]
      }
      if (c.derivation.operation === 'annualize' && inputs.length === 1 && inputs[0].kind === c.kind && c.unit === 'money' && inputs[0].period === 'month' && c.period === 'year' && inputs[0].currency === c.currency && inputs[0].unit === c.unit) {
        value = values[0] * 12; low = lows[0] * 12; high = highs[0] * 12
      }
      if (c.derivation.operation === 'convert' && inputs.length === 2) {
        const amount = inputs[0], fx = inputs[1]
        if (fx.kind === 'exchange-rate' && fx.asOf === context.asOf && fx.baseCurrency === amount.currency && fx.currency === c.currency && c.kind === amount.kind && c.unit === amount.unit && c.period === amount.period) {
          value = values[0] * values[1]; low = lows[0] * lows[1]; high = highs[0] * highs[1]
        }
      }
    }
    const close = (a, b) => researchNumber(a) && researchNumber(b) && Math.abs(a - b) <= Math.max(0.01, Math.abs(a) * 1e-6)
    const matches = close(value, c.value) && (!c.range || close(low, c.range.low) && close(high, c.range.high) && close(value, c.range.base))
    const refuted = ['mixed', 'refuted'].includes(c.status)
    c.status = matches ? refuted ? 'mixed' : 'supported' : refuted ? 'refuted' : 'unconfirmed'
    c.computedValue = matches ? value : null
    if (matches) c.range = { low, base: value, high }
    if (!matches) issues.push(`unverified-derivation:${c.id}`)
    resolving.delete(c.id); resolved.add(c.id)
    return c
  }
  for (const c of claims) resolve(c)
  return { version: 1, sources: [...sources.values()], claims, issues,
    coverage: { total: claims.length, supported: claims.filter(c => c.status === 'supported').length, mixed: claims.filter(c => c.status === 'mixed').length, refuted: claims.filter(c => c.status === 'refuted').length } }
}
function claimFor(ledger, id, { subjectId, kind, segmentId, productId } = {}) {
  const c = (ledger?.claims || []).find(c => c.id === id)
  return c && (!subjectId || c.subjectId === subjectId) && (!productId || c.productId === productId) && (!segmentId || c.segmentId === segmentId) && (!kind || (Array.isArray(kind) ? kind : [kind]).includes(c.kind)) ? c : null
}
function supportedClaim(ledger, id, expected = {}) { const c = claimFor(ledger, id, expected); return c?.status === 'supported' ? c : null }
function quantityOf(ledger, id, expected = {}) {
  const claim = supportedClaim(ledger, id, expected)
  if (!claim || !researchNumber(claim.value) || claim.value < 0 || !researchText(claim.unit) || !researchText(claim.period)) return null
  for (const k of ['unit', 'currency', 'period']) if (expected[k] && claim[k] !== expected[k]) return null
  const range = claim.range
  if (range && (![range.low, range.base, range.high].every(researchNumber) || range.low < 0 || range.low > range.base || range.base > range.high || range.base !== claim.value)) return null
  return { value: claim.value, low: range?.low ?? claim.value, high: range?.high ?? claim.value, claimId: claim.id, basis: claim.derivation ? 'derived' : 'sourced',
    source: (claim.observations || []).find(o => o.usable)?.source || (claim.derivation?.inputClaimIds || []).join(', '), unit: claim.unit, period: claim.period, currency: claim.currency }
}
function normalizeCriteria(segment, deep = {}, ledger = {}) {
  const issues = [], rows = deep.criteriaValidation || []
  const knownIds = new Set(segment.criteria.map(c => c.id))
  for (const row of rows) if (!knownIds.has(row.criterionId)) issues.push(`unknown-criterion:${row.criterionId || row.criterion || 'missing'}`)
  const validation = segment.criteria.map(c => {
    const matches = rows.filter(r => r.criterionId === c.id)
    if (matches.length > 1) issues.push(`duplicate-criterion:${c.id}`)
    // Preserve every referenced observation, including opposing ones, even on a
    // malformed duplicate response. Duplicates never increase coverage.
    const ids = [...new Set(matches.flatMap(r => r.claimIds || []))]
    const axis = ids.map(id => claimFor(ledger, id, { subjectId: c.id, segmentId: segment.id, kind: 'criterion-axis' })).filter(Boolean)
    const supported = axis.some(x => ['supported', 'mixed'].includes(x.status))
    const refuted = axis.some(x => ['refuted', 'mixed'].includes(x.status))
    const status = supported && refuted ? 'mixed' : refuted ? 'contradicted' : supported ? 'evidenced' : 'unconfirmed'
    const observations = axis.flatMap(x => x.observations || []).filter(o => o.usable)
    const dimension = kind => {
      const claims = ids.map(id => claimFor(ledger, id, { subjectId: c.id, segmentId: segment.id, kind })).filter(Boolean)
      const support = claims.some(c => ['supported','mixed'].includes(c.status)), refute = claims.some(c => ['refuted','mixed'].includes(c.status))
      return { status: support && refute ? 'mixed' : refute ? 'contradicted' : support ? 'evidenced' : 'unconfirmed', claims }
    }
    const level = dimension('criterion-level'), priority = dimension('criterion-priority')
    return { criterionId: c.id, criterion: c.criterion, status, claimIds: ids, observations,
      axisStatus: status, levelStatus: level.status, priorityStatus: priority.status,
      refinedLevel: level.status === 'evidenced' ? level.claims.find(c => c.status === 'supported').statement : null, proposedLevel: matches.find(r => r.refinedLevel)?.refinedLevel || null,
      reviewed: matches.length === 1 && matches[0].reviewed !== false }
  })
  return { ...deep, criteriaValidation: validation, criteriaIssues: issues }
}
function groundResearchFindings(deep, ledger) {
  const grounded = (entry, kind, subjectId = entry.id) => {
    const claims = (entry.claimIds || []).map(id => claimFor(ledger, id, { subjectId, segmentId: deep.segmentId, kind })).filter(Boolean)
    const positive = claims.some(c => ['supported', 'mixed'].includes(c.status)), negative = claims.some(c => ['refuted', 'mixed'].includes(c.status))
    return { ...entry, supportStatus: positive && negative ? 'mixed' : negative ? 'refuted' : positive ? 'supported' : 'unconfirmed' }
  }
  return { ...deep,
    solutionsHired: (deep.solutionsHired || []).map(h => {
      const entry = grounded(h, 'hired')
      const price = supportedClaim(ledger, h.pricingClaimId, { subjectId: h.id, segmentId: deep.segmentId, kind: ['competitor-price', 'job-spend'] })
      return { ...competitorIdentity(entry), spendToday: price?.statement || 'unknown', prevalence: entry.supportStatus === 'supported' && h.sampleDescription ? h.prevalence : 'unknown', whyHired: entry.supportStatus === 'supported' ? h.whyHired : null,
        competitionStatus: (h.competitionClaimIds || []).some(id => {
          const claim = supportedClaim(ledger, id, { subjectId: h.id, segmentId: deep.segmentId, kind: ['capability', 'hired'] })
          return claim && researchKey(claim.statement) === researchKey(h.competitionRationale)
        }) ? 'supported' : 'hypothesis',
        jobCoverage: [...(h.claimIds || []), ...(h.competitionClaimIds || [])].some(id => {
          const claim = supportedClaim(ledger, id, { subjectId: h.id, segmentId: deep.segmentId, kind: ['capability', 'hired'] })
          return claim && researchKey(claim.statement) === researchKey(h.coverageExplanation)
        }) ? h.jobCoverage || 'unknown' : 'unknown',
        researchSections: groundCompetitorSections(h, deep.competitorFindings, deep.competitorResearch, ledger, deep.segmentId) }
    }),
    problems: (deep.problems || []).map(p => grounded(p, 'problem')),
    channels: (deep.channels || []).map(c => ({ ...grounded(c, 'channel'), cacEstimate: 'unknown — use the verified economic scenario' })),
    newCriteria: (deep.newCriteria || []).map(c => ({ ...c, supportStatus: supportedClaim(ledger, c.axisClaimId, { subjectId: c.id, segmentId: deep.segmentId, kind: 'criterion-axis' }) ? 'supported' : 'unconfirmed',
      level: supportedClaim(ledger, c.levelClaimId, { subjectId: c.id, segmentId: deep.segmentId, kind: 'criterion-level' })?.statement || null })),
  }
}
function groundMarket(market, ledger, context) {
  const result = { ...market }
  for (const level of ['tam', 'sam', 'som']) {
    const raw = market[level] || {}
    const money = quantityOf(ledger, raw.valueClaimId, { subjectId: context.productId, kind: 'market-number', unit: 'money', currency: 'USD', period: 'year' })
    const people = quantityOf(ledger, raw.peopleClaimId, { subjectId: context.productId, kind: 'people-count', unit: 'entities' })
    result[level] = { ...raw, valueUsd: money?.value ?? null, peopleCount: people?.value ?? null, valueRange: money ? { low: money.low, base: money.value, high: money.high } : null,
      supportStatus: money ? 'supported' : 'unconfirmed', sources: [...new Set([money?.source, people?.source].filter(Boolean))] }
  }
  result.consistencyIssues = []
  if (result.tam.valueUsd != null && result.sam.valueUsd != null && result.sam.valueUsd > result.tam.valueUsd) result.consistencyIssues.push('sam-exceeds-tam')
  if (result.sam.valueUsd != null && result.som.valueUsd != null && result.som.valueUsd > result.sam.valueUsd) result.consistencyIssues.push('som-exceeds-sam')
  result.competitors = (market.competitors || []).map(c => ({ ...competitorIdentity(c),
    competitionStatus: (c.competitionClaimIds || []).some(id => {
      const claim = supportedClaim(ledger, id, { subjectId: c.id, kind: ['capability', 'hired'] })
      return claim && researchKey(claim.statement) === researchKey(c.competitionRationale)
    }) ? 'supported' : 'hypothesis',
    jobCoverage: (c.claimIds || []).some(id => {
      const claim = supportedClaim(ledger, id, { subjectId: c.id, kind: ['capability', 'hired'] })
      return claim && researchKey(claim.statement) === researchKey(c.coverageExplanation)
    }) ? c.jobCoverage || 'unknown' : 'unknown',
    pricing: supportedClaim(ledger, c.pricingClaimId, { subjectId: c.id, kind: 'competitor-price' })?.statement || 'unknown',
    availableOnTargetMarket: supportedClaim(ledger, c.availabilityClaimId, { subjectId: c.id, kind: 'market-availability' }) ? true : null,
    researchSections: groundCompetitorSections(c, market.competitorFindings, market.competitorResearch, ledger),
  }))
  return result
}
function fieldEvidenceOf(segment, deep) {
  const rows = deep.criteriaValidation || []
  const evidenced = rows.filter(r => r.status === 'evidenced').length
  const contradicted = rows.filter(r => ['contradicted', 'mixed'].includes(r.status)).length
  const reviewed = rows.filter(r => r.reviewed).length
  const total = segment.criteria.length
  const top = new Set(segment.criteria.slice().sort((a, b) => a.priority - b.priority).slice(0, 3).map(c => c.id))
  return { total, evidenced, contradicted, reviewed, ratio: total ? evidenced / total : 0, coverage: total ? reviewed / total : 0,
    topSupported: rows.filter(r => top.has(r.criterionId) && r.status === 'evidenced').length, topTotal: top.size,
    independentSources: new Set(rows.flatMap(r => r.observations || []).filter(o => o.usable).map(o => o.independenceKey)).size }
}
function normalizeRisk(r, scope) {
  const probability = researchNumber(r.probability) && r.probability >= 1 && r.probability <= 5 ? r.probability : null
  const impact = researchNumber(r.impact) && r.impact >= 1 && r.impact <= 5 ? r.impact : null
  const score = probability != null && impact != null ? probability * impact : null
  return { ...r, id: r.id || researchId('risk', [scope, r.assumption]), score,
    fatal: r.fatal === true || impact === 5, critical: score != null && score >= 15,
    status: 'unconfirmed', scope }
}
function buildRiskRegistry(fundamental, product, segments, ledger) {
  const entries = [
    ...(fundamental || []).map(r => ({ ...r, scope: 'product', fundamental: true })),
    ...(product || []).map(r => ({ ...r, scope: 'product' })),
    ...(segments || []).flatMap(s => (s.scoring?.segmentRat || []).map(r => ({ ...r, scope: 'segment', segmentId: s.id }))),
  ]
  const by = new Map(), issues = []
  for (const raw of entries) {
    let risk = normalizeRisk(raw, raw.scope === 'segment' ? raw.segmentId : 'product')
    risk.scope = raw.scope
    const prev = by.get(risk.id)
    if (prev) {
      if (prev.scope !== risk.scope || prev.segmentId !== risk.segmentId || researchKey(prev.assumption) !== researchKey(risk.assumption)) {
        issues.push(`ambiguous-risk-id:${risk.id}`)
        // Preserve both risks; neither can be accidentally discharged by the other's test.
        risk.id = researchId('risk-conflict', [risk.id, risk.scope, risk.segmentId, risk.assumption])
      } else risk = { ...prev, ...risk, fatal: prev.fatal || risk.fatal, critical: prev.critical || risk.critical,
        fundamental: prev.fundamental || risk.fundamental, checkBeforeSpending: prev.checkBeforeSpending || risk.checkBeforeSpending }
    }
    const claims = risk.fundamental ? (ledger?.claims || []).filter(c => c.subjectId === risk.id && c.kind === 'fundamental-risk' && researchKey(c.statement) === researchKey(risk.assumption)) : []
    const positive = claims.some(c => ['supported', 'mixed'].includes(c.status)), negative = claims.some(c => ['refuted', 'mixed'].includes(c.status))
    risk.status = positive && negative ? 'mixed' : negative ? 'refuted' : positive ? 'supported' : 'unconfirmed'
    risk.claimIds = claims.map(c => c.id)
    by.set(risk.id, risk)
  }
  return { risks: [...by.values()], issues }
}
function marketSizeScore(usd) {
  if (!researchNumber(usd) || usd < 0) return null
  if (usd === 0) return 0
  const bands = [[1e6, 10, 20], [1e7, 20, 40], [1e8, 40, 60], [1e9, 60, 80], [1e10, 80, 100]]
  let lo = 0
  for (const [cap, a, b] of bands) { if (usd < cap) return a + (b - a) * ((usd - lo) / (cap - lo)); lo = cap }
  return 100
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)) }
function economicScenario(e = {}, ledger = {}, segmentId, productId) {
  const specs = {
    price: { id: e.priceClaimId, subjectId: productId, kind: 'product-price', unit: 'money', currency: 'USD', period: 'month' },
    cogs: { id: e.cogsClaimId, subjectId: segmentId, segmentId, productId, kind: 'cogs', unit: 'money', currency: 'USD', period: 'month' },
    lifetime: { id: e.lifetimeClaimId, subjectId: segmentId, segmentId, productId, kind: 'lifetime', unit: 'months', period: 'lifetime' },
    cac: { id: e.cacClaimId, subjectId: segmentId, segmentId, productId, kind: 'cac', unit: 'money', currency: 'USD', period: 'acquisition' },
  }
  const values = Object.fromEntries(Object.entries(specs).map(([k, { id, ...expected }]) => [k, quantityOf(ledger, id, expected)]))
  const missing = Object.keys(values).filter(k => !values[k] || k === 'lifetime' && values[k].low <= 0)
  if (missing.length) return { status: 'unknown', missing, inputs: values, contribution: null, ltvToCac: null, range: null }
  const { price, cogs, lifetime, cac } = values
  const margins = [price.low - cogs.high, price.high - cogs.low]
  const bounds = margins.flatMap(x => [x * lifetime.low, x * lifetime.high])
  const low = Math.min(...bounds), high = Math.max(...bounds)
  const contribution = (price.value - cogs.value) * lifetime.value
  const ratio = cac.value > 0 ? contribution / cac.value : null
  const ratios = cac.low > 0 ? [low / cac.low, low / cac.high, high / cac.low, high / cac.high] : []
  return { status: 'scenario', missing: [], inputs: values, contribution, ltvToCac: ratio,
    range: { contribution: { low, high }, ltvToCac: ratios.length ? { low: Math.min(...ratios), high: Math.max(...ratios) } : null },
    acquisitionCovered: contribution >= cac.value, measuredCac: claimFor(ledger, e.cacClaimId)?.basis === 'measured' }
}
function scoreSegment(raw, segment, deep, ledger, context) {
  const f = raw.forces || {}, comp = raw.competition || {}, advantage = raw.advantage || {}
  const validForce = v => researchNumber(v) && v >= 0 && v <= 100
  const switchScore = Object.values(f).length >= 4 && ['addedValue', 'problemSeverity', 'barriers', 'habitStrength'].every(k => validForce(f[k]))
    ? f.addedValue + f.problemSeverity - f.barriers - f.habitStrength : null
  const valueDelivery = switchScore == null ? null : clamp(50 + switchScore / 4, 0, 100)
  const competitionScore = Number.isInteger(comp.competitorCount) && comp.competitorCount >= 0 && typeof comp.hasGiants === 'boolean' && typeof comp.hasMediumPlayers === 'boolean' && ['low', 'medium', 'high'].includes(comp.saturation)
    ? clamp(100 - Math.min(50, comp.competitorCount * 5) - (comp.hasGiants ? 25 : 0) - (comp.hasMediumPlayers ? 15 : 0) - ({ high: 20, medium: 10, low: 0 }[comp.saturation] ?? 0), 0, 100) : null
  const bte = { low: 20, medium: 50, high: 80 }[advantage.barriersToEntry]
  const advantageScore = validForce(advantage.uniqueness) && bte != null ? advantage.uniqueness * 0.6 + bte * 0.4 : null
  const money = quantityOf(ledger, raw.somClaimId, { subjectId: segment.id, segmentId: segment.id, kind: 'market-number', unit: 'money', currency: 'USD', period: 'year' })
  const people = quantityOf(ledger, raw.people?.claimId, { subjectId: segment.id, segmentId: segment.id, kind: 'people-count', unit: 'entities' })
  const spend = quantityOf(ledger, raw.spendToday?.claimId, { subjectId: segment.id, segmentId: segment.id, kind: 'job-spend', unit: 'money', currency: 'USD', period: 'month' })
  const marketScore = money ? marketSizeScore(money.value) : null
  // A single attraction scale for every segment. Economics is a separate scenario;
  // missing evidence produces an interval, never a better point estimate.
  const components = [marketScore, valueDelivery, competitionScore, advantageScore]
  const weights = [0.20 / 0.75, 0.30 / 0.75, 0.15 / 0.75, 0.10 / 0.75]
  const weighted = (values, w = weights) => values.reduce((n, x, i) => n + x * w[i], 0)
  const lower = components.map(x => x ?? 0), upper = components.map(x => x ?? 100)
  if (money) { lower[0] = marketSizeScore(money.low); upper[0] = marketSizeScore(money.high) }
  const low = weighted(lower), high = weighted(upper)
  const total = components.every(x => x != null) ? Math.round(weighted(components)) : null
  const variants = weights.map((_, changed) => weights.map((w, i) => w * (i === changed ? 1.2 : 1)))
    .map(w => w.map(x => x / w.reduce((a, b) => a + b, 0)))
  const sensitivity = variants.map(w => ({ low: Math.round(weighted(lower, w)), high: Math.round(weighted(upper, w)) }))
  const economic = economicScenario(raw.economics, ledger, segment.id, context.productId)
  const fe = fieldEvidenceOf(segment, deep)
  const thinEvidence = (deep.criteriaValidation || []).some(c => c.levelStatus !== 'evidenced' || c.priorityStatus !== 'evidenced') || fe.evidenced < fe.total || fe.contradicted > 0 || fe.coverage < 1 || (deep.criteriaIssues || []).length > 0
  const e = raw.economics || {}, inputs = economic.inputs
  return { ...raw, somValueUsd: money?.value ?? null, tamValueUsd: null,
    people: people ? { count: people.value, ...people } : { count: null, basis: 'none' },
    spendToday: spend ? { monthlyUsd: spend.value, ...spend } : { monthlyUsd: null, basis: 'none' },
    economics: { ...e, monthlyPriceUsd: inputs.price?.value ?? null, monthlyCogsUsd: inputs.cogs?.value ?? null, lifetimeMonths: inputs.lifetime?.value ?? null,
      cacUsd: inputs.cac?.value ?? null, priceBasis: inputs.price ? 'product-pricing' : 'none', priceSource: inputs.price?.source ?? null,
      cacBasis: economic.measuredCac ? 'measured' : 'unknown', cacSource: inputs.cac?.source ?? null },
    communication: Object.fromEntries(['value', 'fears', 'competitorCounters'].map(k => [k, (raw.communication?.[k] || []).map(card => ({ ...card, readyToUse: false, status: 'hypothesis-draft' }))])),
    economicsUnpriced: !inputs.price, economicsStatus: economic.status, economicScenario: economic,
    segmentRat: (raw.segmentRat || []).map(r => normalizeRisk(r, segment.id)),
    fieldEvidence: fe, thinEvidence, scoringVersion: 2,
    computed: { total, totalRange: { low: Math.round(low), high: Math.round(high) }, sensitivity,
      switchScore, marketScore, valueDelivery, competitionScore, advantageScore, econHealth: null,
      amppuUsd: economic.contribution, ltvToCac: economic.ltvToCac,
      peopleCount: people?.value ?? null, spendTodayUsdMonthly: spend?.value ?? null,
      impliedAnnualSpendUsd: people && spend ? people.value * spend.value * 12 : null },
  }
}
function rankSegments(entries) {
  const ranked = entries.slice().sort((a, b) => (b.scored.computed.totalRange.low - a.scored.computed.totalRange.low) || a.segment.id.localeCompare(b.segment.id))
  return ranked.map((entry, i) => {
    const range = entry.scored.computed.totalRange
    const contenders = ranked.filter(x => x !== entry && x.scored.computed.totalRange.high >= range.low && x.scored.computed.totalRange.low <= range.high)
    const stable = !entry.scored.thinEvidence && contenders.length === 0 && ranked.every((other, j) => other === entry ||
      entry.scored.computed.sensitivity.every((v, n) => i < j ? v.low > other.scored.computed.sensitivity[n].high : v.high < other.scored.computed.sensitivity[n].low))
    return { ...entry, rank: i + 1, ranking: { order: 'conservative-attractiveness', stable, overlappingSegmentIds: contenders.map(x => x.segment.id) } }
  })
}

// The seven Job-language promise formulas (canon §6 communication.md). One stable key each;
// the canon name, the legacy English label of older results and the console's Russian label
// all fold onto the key, so a formula written three ways is still one formula on the map.
const FORMULA_KEYS = ['core_for_big', 'core_value', 'trigger', 'orientation', 'big_jobs_lived', 'micro', 'problem_contrast']
const FORMULA_ALIASES = {
  core_for_big: ['Core Jobs for Big Jobs', 'Goal link', 'Работа ради большой цели'],
  core_value: ['Core Jobs + value', 'Core Jobs value', 'Value', 'Работа + ценность', 'Работа ценность'],
  trigger: ['Trigger → Core Jobs', 'Trigger Core Jobs', 'Trigger scenario', 'Триггер → работа', 'Триггер работа'],
  orientation: ['Orientation Jobs', 'Choice help', 'Работа ориентирования'],
  big_jobs_lived: ['Big Jobs lived', 'Emotional goal', 'Большая цель прожита'],
  micro: ['Micro Job', 'Micro Jobs', 'Effortlessness', 'Микро-работа', 'Микро работа'],
  problem_contrast: ['Problem with current Solution → Core Jobs', 'Problem with current Solution Core Jobs', 'Problem contrast', 'Проблема старого решения'],
}
function formulaKeyText(value) { return String(value ?? '').toLocaleLowerCase('ru').replace(/[→+_\-\s]+/g, ' ').trim() }
function normalizeFormula(value) {
  const wanted = formulaKeyText(value)
  if (!wanted) return null
  for (const key of FORMULA_KEYS) if (wanted === formulaKeyText(key) || FORMULA_ALIASES[key].some(alias => formulaKeyText(alias) === wanted)) return key
  return null
}
module.exports = { researchTime, researchKey, researchId, researchText, researchNumber, validateResearchValue, primarySource, sourceKey, marketLabelIssue, createResearchContext: withToday, prepareSegments, competitorIdentity, groundCompetitorSections, developmentHypotheses, groundFocusedFindings, mergeEvidencePackets, quoteFoundIn, verifyEvidencePacket, claimFor, supportedClaim, quantityOf, normalizeCriteria, groundResearchFindings, groundMarket, fieldEvidenceOf, normalizeRisk, buildRiskRegistry, marketSizeScore, economicScenario, scoreSegment, rankSegments, FORMULA_KEYS, normalizeFormula }
// Outside workflows (which forbid the clock) an omitted snapshot date means today.
// Defined after the exports so the embedded workflow copy never contains it.
function withToday(args = {}) {
  return args.researchContext?.asOf || args.asOf ? createResearchContext(args) : createResearchContext({ ...args, asOf: new Date().toISOString().slice(0, 10) })
}
