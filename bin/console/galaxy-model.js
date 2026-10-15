const crypto = require('crypto')
const { compatibleCompetitors } = require('./competitor-compatibility')

const { verificationOf } = require('../verification')
const { normalizeKind, priceTierOf } = require('./competitor-kind')
const { evidenceResolver, evidenceFields, uniqueEvidence, sourceOf } = require('./evidence')
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

// Landing formulas (contract §2): key ↔ canon name ↔ legacy English name ↔ Russian label.
const FORMULAS = {
  core_for_big: { label: 'Работа ради большой цели', aliases: ['Core Jobs for Big Jobs', 'Goal link'] },
  core_value: { label: 'Работа + ценность', aliases: ['Core Jobs + value', 'Value'] },
  trigger: { label: 'Триггер → работа', aliases: ['Trigger → Core Jobs', 'Trigger scenario'] },
  orientation: { label: 'Работа ориентирования', aliases: ['Orientation Jobs', 'Choice help'] },
  big_jobs_lived: { label: 'Большая цель прожита', aliases: ['Big Jobs lived', 'Emotional goal'] },
  micro: { label: 'Микро-работа', aliases: ['Micro Job', 'Effortlessness'] },
  problem_contrast: { label: 'Проблема старого решения', aliases: ['Problem with current Solution → Core Jobs', 'Problem contrast'] },
}
const formulaFold = value => String(value ?? '').toLowerCase().replace(/[→+]/g, ' ').replace(/[_\s-]+/g, ' ').replace(/[^a-zа-яё0-9 ]/gi, '').trim()
const FORMULA_ALIASES = new Map(Object.entries(FORMULAS).flatMap(([key, { aliases }]) => [[formulaFold(key), key], ...aliases.map(alias => [formulaFold(alias), key])]))
function localNormalizeFormula(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  return FORMULA_ALIASES.get(formulaFold(value)) || null
}
// research-quality.js is the shared owner of this mapping once it exports it; until then the local mirror applies.
function normalizeFormula(value) {
  const shared = require('../research-quality').normalizeFormula
  return typeof shared === 'function' ? shared(value) : localNormalizeFormula(value)
}
const formulaLabel = key => FORMULAS[key]?.label || null
const STRENGTHS = new Set(['strong', 'moderate', 'weak'])
const STRENGTH_ORDER = { strong: 3, moderate: 2, weak: 1 }
const strengthOf = value => STRENGTHS.has(value) ? value : null
function hostnameOf(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase() || null } catch { return null }
}
function competitorHosts(node) {
  return new Set([hostnameOf(node.data?.domain), hostnameOf(node.data?.url), ...(Array.isArray(node.data?.landingDomains) ? node.data.landingDomains.map(hostnameOf) : [])].filter(Boolean))
}
const IMAGE_ASSET = /^sources\/[^\\]+\.(?:jpe?g|png|webp)$/i
function assetHref(relative) {
  return typeof relative === 'string' && IMAGE_ASSET.test(relative) && !relative.split('/').includes('..') ? `/asset?path=${encodeURIComponent(relative)}` : null
}
function snapshotHref(relative) {
  return typeof relative === 'string' && /^sources\/[^\\]+\.(?:json|md|txt|html|csv)$/i.test(relative) && !relative.split('/').includes('..') ? `/source?path=${encodeURIComponent(relative)}` : null
}
const cyrillicShare = text => { const letters = String(text || '').match(/\p{L}/gu) || []; return letters.length ? letters.filter(ch => /[Ѐ-ӿ]/.test(ch)).length / letters.length : 0 }

function byId(nodes) {
  return Object.fromEntries((nodes || []).map(node => [node.id, node]))
}

function evidenceFor(nodeId, nodes, edges) {
  return evidenceResolver(nodes, edges).forDatum(byId(nodes)[nodeId] || {}, { nodeId }).evidence
}

function criteriaForSegmentJob(segmentId, jobId, nodes, edges) {
  const index = byId(nodes)
  const performs = edges.find(edge => edge.from === segmentId && edge.to === jobId && edge.type === 'performs')
  const ordered = Array.isArray(performs?.data?.criteria) && performs.data.criteria.length
    ? performs.data.criteria.slice().sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99))
      .map((item, order) => ({ node: index[item.id], priority: Number(item.priority) || order + 1 }))
    : edges.filter(edge => edge.from === jobId && edge.type === 'judged_by' && index[edge.to])
      .map((edge, order) => ({ node: index[edge.to], priority: order + 1 }))
  return ordered.filter(item => item.node).map(item => {
    const evidence = evidenceFor(item.node.id, nodes, edges)
    return {
      id: item.node.id,
      label: item.node.label,
      level: textOrNull(item.node.data?.level),
      status: item.node.status || 'hypothesis',
      priority: item.priority,
      levelStatus: item.node.data?.levelStatus, priorityStatus: item.node.data?.priorityStatus, evidenceConflict: item.node.data?.evidenceConflict,
      ...evidenceFields(evidence),
    }
  })
}

function jobsForSegment(segmentId, nodes, edges) {
  const index = byId(nodes)
  return edges.filter(edge => edge.from === segmentId && edge.type === 'performs' && index[edge.to])
    .map(edge => ({
      id: index[edge.to].id,
      label: index[edge.to].label,
      level: index[edge.to].data?.level || null,
      status: index[edge.to].status || 'hypothesis',
      context: edge.data?.context || '',
      ...evidenceResolver(nodes, edges).forDatum(index[edge.to], { segmentId }),
      criteria: criteriaForSegmentJob(segmentId, edge.to, nodes, edges),
    }))
}

function competitorsForSegment(segmentId, nodes, edges) {
  nodes = compatibleCompetitors(nodes)
  const index = byId(nodes)
  const jobIds = new Set(edges.filter(edge => edge.from === segmentId && edge.type === 'performs').map(edge => edge.to))
  const shared = new Map()
  for (const edge of edges) {
    const competitor = index[edge.from]
    const job = index[edge.to]
    if (edge.type !== 'competes_for' || competitor?.type !== 'competitor' || competitor.status === 'dropped' || !jobIds.has(edge.to) || !job) continue
    if (!shared.has(competitor.id)) shared.set(competitor.id, { competitor, jobs: new Map() })
    shared.get(competitor.id).jobs.set(job.id, { id: job.id, label: job.label })
  }
  return [...shared.values()].map(({ competitor, jobs }) => ({
    id: competitor.id,
    label: competitor.label,
    status: competitor.status || 'hypothesis',
    kind: normalizeKind(competitor.data?.kind),
    category: categoryOf(competitor),
    isCategory: competitor.data?.isCategory === true || competitor.data?.entityType === 'category',
    sharedJobs: [...jobs.values()],
  })).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

function risksForSegment(segmentId, nodes, edges) {
  const index = byId(nodes)
  return edges.filter(edge => edge.to === segmentId && edge.type === 'about' && index[edge.from]?.type === 'assumption' && index[edge.from]?.status !== 'dropped')
    .map(edge => {
      const node = index[edge.from]
      const evidence = evidenceFor(node.id, nodes, edges)
      return {
        id: node.id,
        label: node.label,
        status: node.status || 'hypothesis',
        fatal: Boolean(node.data?.fatal),
        testMethod: textOrNull(node.data?.testMethod),
        whyImportant: textOrNull(node.data?.whyFundamental),
        ...evidenceFields(evidence),
      }
    })
}

function finitePositive(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function researchQuantity(segment, value) {
  return segment.data?.scoringVersion === 2 ? typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null : finitePositive(value)
}

function textOrNull(value) {
  return typeof value === 'string' && value.trim() && !/^(unknown|n\/?a|undefined|null)$/i.test(value.trim()) ? value.trim() : null
}

function categoryOf(node) {
  const raw = node.data?.category || node.data?.solutionCategory
  const label = textOrNull(typeof raw === 'string' ? raw : raw?.name || raw?.label)
  const isCategory = node.data?.isCategory === true || node.data?.entityType === 'category'
  return { id: textOrNull(raw?.id) || (label ? `category-${crypto.createHash('sha1').update(label.toLocaleLowerCase('ru')).digest('hex').slice(0, 12)}` : isCategory ? node.id : 'uncategorized'),
    label: label || (isCategory ? node.label : 'Категория не уточнена'), parentId: textOrNull(raw?.parentId) }
}

const RESEARCH_SECTIONS = {
  jobs: { label: 'Задачи клиентов', action: 'Проверить, какие задачи решает продукт' },
  pricing: { label: 'Стоимость и условия', action: 'Проверить тарифы и стоимость внедрения' },
  messaging: { label: 'Обещания клиентам', action: 'Снять сайт и разобрать обещания' },
  channels: { label: 'Каналы продвижения', action: 'Изучить каналы привлечения клиентов' },
  complaints: { label: 'Жалобы и ограничения', action: 'Изучить отзывы и жалобы клиентов' },
}
function researchSectionsOf(node, resolver) {
  const subjectIds = [node.id, node.data?.researchCompetitorId, ...(node.data?.researchCompetitorIds || [])].filter(Boolean)
  return Object.fromEntries(Object.entries(RESEARCH_SECTIONS).map(([key, definition]) => {
    const raw = node.data?.researchSections?.[key] || {}
    const status = ['not_researched', 'researched', 'not_found', 'unavailable'].includes(raw.status) ? raw.status : 'not_researched'
    return [key, { ...definition, status, summary: textOrNull(raw.summary), checkedAt: textOrNull(raw.checkedAt),
      queries: Array.isArray(raw.queries) ? raw.queries : [], limitations: textOrNull(raw.limitations),
      ...resolver.forDatum(raw), findings: (Array.isArray(raw.findings) ? raw.findings : []).filter(item => item && typeof item === 'object')
        .map(item => ({ ...item, ...resolver.forDatum(item, { segmentId: item.segmentId, subjectIds }) })) }]
  }))
}

function competitorDetails(node, nodes, edges, segments, resolver, fileExists = null) {
  const index = byId(nodes)
  const sections = researchSectionsOf(node, resolver)
  const graphSegmentId = id => id ? segments.find(segment => segment.id === id || index[segment.id]?.data?.researchSegmentId === id)?.id || id : id
  for (const section of Object.values(sections)) for (const finding of section.findings) if (finding.segmentId) finding.segmentId = graphSegmentId(finding.segmentId)
  const hires = segments.flatMap(segment => segment.hired.filter(item => item.id === node.id).map(item => ({ ...item, segmentId: segment.id })))
  const researchIds = [node.id, node.data?.researchCompetitorId, ...(node.data?.researchCompetitorIds || [])].filter(Boolean)
  const jobCoverage = edges.filter(edge => edge.from === node.id && edge.type === 'competes_for' && index[edge.to]?.type === 'job').map(edge => {
    const findings = sections.jobs.findings.filter(item => item.jobId === edge.to || item.job === index[edge.to].label)
    const linkedSegments = segments.filter(segment => segment.jobs.some(job => job.id === edge.to))
    const hired = hires.filter(item => linkedSegments.some(segment => segment.id === item.segmentId))
    const globalFinding = findings.find(item => !item.segmentId && item.coverage && item.coverage !== 'unknown')
    const edgeSegment = graphSegmentId(edge.data?.segmentId || edge.data?.segment)
    const reportedCoverage = globalFinding?.coverage || (!edgeSegment ? edge.data?.coverage || edge.data?.jobCoverage : null)
    const scopeRows = linkedSegments.map(segment => {
      const h = hired.find(item => item.segmentId === segment.id)
      const f = findings.find(item => item.segmentId === segment.id) || findings.find(item => !item.segmentId)
      return { segmentId: segment.id, segmentLabel: segment.displayLabel,
        coverage: f?.coverage || (h?.coverage && h.coverage !== 'unknown' ? h.coverage : null) || (edgeSegment === segment.id ? edge.data?.coverage || edge.data?.jobCoverage : null) || reportedCoverage || 'unknown',
        explanation: textOrNull(f?.statement || h?.coverageExplanation || (!edgeSegment || edgeSegment === segment.id ? edge.data?.coverageExplanation : null)),
        ...evidenceFields([...(f?.evidence || []), ...(h?.evidence || []), ...resolver.forDatum(edge.data || {}, { segmentId: segment.id }).evidence]) }
    })
    const levels = [...new Set(scopeRows.map(row => row.coverage))]
    return { jobId: edge.to, job: index[edge.to].label, coverage: levels.length === 1 ? levels[0] : levels.length > 1 ? 'varies' : reportedCoverage || 'unknown',
      explanation: textOrNull(globalFinding?.statement || (!edgeSegment ? edge.data?.coverageExplanation : null)) || (scopeRows.length === 1 ? scopeRows[0].explanation : null),
      segmentIds: linkedSegments.map(segment => segment.id), bySegment: scopeRows,
      ...evidenceFields([...findings.flatMap(item => item.evidence), ...resolver.forDatum(edge.data || {}).evidence, ...hired.flatMap(item => item.evidence)]) }
  })
  // A finding may name a task before it has been linked to a canonical Job.
  for (const finding of sections.jobs.findings.filter(item => item.job && !jobCoverage.some(row => row.job === item.job || row.jobId === item.job))) {
    jobCoverage.push({ jobId: null, job: finding.job, coverage: finding.coverage || 'unknown', explanation: textOrNull(finding.statement),
      segmentIds: finding.segmentId ? [finding.segmentId] : [], bySegment: [], ...evidenceFields(finding.evidence) })
  }
  const rawPricing = Array.isArray(node.data?.pricingDetails) ? node.data.pricingDetails : sections.pricing.findings
  const priceDetails = rawPricing.map((item, n) => {
    const claimId = item.amountClaimId || item.amount?.claimId || item.claimId
    const claim = resolver.claim(claimId)
    const supported = claim?.status === 'supported' && claim.kind === 'competitor-price' && researchIds.includes(claim.subjectId) && (!item.segmentId || !claim.segmentId || graphSegmentId(claim.segmentId) === item.segmentId)
    const quantity = supported && typeof claim.value === 'number' && Number.isFinite(claim.value) && claim.value >= 0 ? claim : null
    return { id: item.id || `price-${n}`, label: textOrNull(item.plan || item.label) || 'Стоимость', priceKind: textOrNull(item.priceKind) || 'unspecified',
      amount: quantity?.value ?? null,
      amountRange: quantity?.range && [quantity.range.low, quantity.range.base, quantity.range.high].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0) && quantity.range.low <= quantity.range.base && quantity.range.base <= quantity.range.high ? { ...quantity.range } : null,
      currency: quantity?.currency || textOrNull(item.currency), period: quantity?.period || textOrNull(item.period), unit: quantity?.unit || textOrNull(item.unit),
      billingUnit: textOrNull(item.billingUnit),
      includes: textOrNull(item.includes), excludes: textOrNull(item.excludes), summary: textOrNull(item.statement || item.summary),
      segmentIds: item.segmentId ? [item.segmentId] : Array.isArray(item.segmentIds) ? item.segmentIds : [],
      ...resolver.forDatum(item, { segmentId: item.segmentId, subjectIds: researchIds }), claimId: claimId || null }
  })
  if (!priceDetails.length && textOrNull(node.data?.pricing)) priceDetails.push({ id: 'legacy-pricing', label: 'Описание стоимости', priceKind: 'unspecified', amount: null, currency: null, period: null, unit: null,
    includes: null, excludes: null, summary: textOrNull(node.data.pricing), segmentIds: [], ...resolver.forDatum({ source: node.source }), legacy: true })
  const hosts = competitorHosts(node)
  const jobRef = (jobId, jobLabel) => {
    const byIdMatch = jobId && index[jobId]?.type === 'job' ? index[jobId] : jobLabel && index[jobLabel]?.type === 'job' ? index[jobLabel] : null
    const byLabel = !byIdMatch && textOrNull(jobLabel) ? nodes.find(item => item.type === 'job' && item.label === jobLabel.trim()) : null
    const job = byIdMatch || byLabel
    return { jobId: job?.id || null, jobLabel: job?.label || (textOrNull(jobLabel) && !/^job-/.test(jobLabel) ? jobLabel.trim() : null), dropped: job?.status === 'dropped' }
  }
  const segmentLabelFor = jobId => segments.find(segment => segment.jobs.some(job => job.id === jobId))?.displayLabel || null
  const enrich = (line, extra = {}) => {
    const ref = jobRef(line.jobId, line.job)
    const key = normalizeFormula(line.formula)
    const host = hostnameOf(line.source)
    return { formula: line.formula || null, formulaKey: key, formulaLabel: formulaLabel(key) || textOrNull(line.formula), quote: textOrNull(line.quote || line.statement), strength: strengthOf(line.strength),
      job: ref.jobLabel, jobLabel: ref.jobLabel, jobId: ref.jobId, segmentLabel: ref.jobId ? segmentLabelFor(ref.jobId) : null, observedAt: textOrNull(line.observedAt), source: sourceOf(line.source),
      stale: Boolean(extra.supersededAt) || ref.dropped, foreign: Boolean(host && hosts.size && !hosts.has(host)) }
  }
  const messaging = edges.filter(edge => edge.from === node.id && edge.type === 'communicates' && index[edge.to]?.type === 'job')
    .map(edge => ({ ...enrich({ ...(edge.data || {}), jobId: edge.to }, { supersededAt: edge.data?.supersededAt }), job: index[edge.to].label, ...resolver.forDatum(edge.data || {}, { subjectIds: researchIds }) }))
  for (const line of [...(Array.isArray(node.data?.messaging) ? node.data.messaging : []), ...sections.messaging.findings]) {
    const quote = textOrNull(line.quote || line.statement)
    if (!quote || messaging.some(row => row.quote === quote)) continue
    messaging.push({ ...enrich(line), ...resolver.forDatum(line, { subjectIds: researchIds }) })
  }
  const landing = landingOf(node, { segments, resolver, researchIds, enrich, fileExists, index })
  const channels = sections.channels.findings.map((item, n) => ({ id: item.id || `channel-${n}`, label: textOrNull(item.channel) || 'Канал не уточнён',
    description: textOrNull(item.statement), url: sourceOf(item.url), ...evidenceFields(item.evidence) }))
  const failures = edges.filter(edge => edge.from === node.id && edge.type === 'fails_at' && index[edge.to]?.type === 'problem').map(edge => {
    const problem = index[edge.to]
    return { id: problem.id, label: problem.label, severity: problem.data?.severity || edge.data?.severity || null,
      segmentId: edge.data?.segment || problem.data?.segmentId || null, ...resolver.forDatum(problem, { segmentId: edge.data?.segment || problem.data?.segmentId }) }
  })
  for (const finding of sections.complaints.findings) {
    if (!textOrNull(finding.statement) || failures.some(row => row.label === finding.statement)) continue
    failures.push({ id: finding.id || `complaint-${failures.length}`, label: finding.statement, severity: finding.severity || null,
      segmentId: finding.segmentId || null, ...evidenceFields(finding.evidence) })
  }
  failures.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))
  const kind = normalizeKind(node.data?.kind)
  const rationale = textOrNull(node.data?.competitionRationale || node.data?.classification?.rationale)
  const classification = { kind, rationale, status: rationale ? node.data?.competitionStatus || 'hypothesis' : 'unexplained',
    bySegment: hires.map(item => ({ segmentId: item.segmentId, kind: item.kind, rationale: item.competitionRationale, status: item.competitionStatus || 'hypothesis', ...evidenceFields(item.competitionEvidence || []) })),
    ...resolver.forDatum(node.data?.classification || { claimIds: node.data?.competitionClaimIds, supportStatus: node.data?.competitionStatus }, { subjectIds: researchIds }) }
  const content = { jobs: jobCoverage, pricing: priceDetails, messaging, channels, complaints: failures }
  const researchGaps = Object.entries(sections).flatMap(([id, section]) => {
    const rows = content[id]
    if (id === 'messaging') {
      // A dated site snapshot closes the gap; it stays available as a manual refresh of that snapshot.
      if (landing && ['captured', 'text-only', 'legacy'].includes(landing.status)) return [{ id, label: section.label, status: 'researched', action: 'Обновить снимок сайта',
        reason: `Сайт снят ${formatDate(landing.observedAt)}${landing.status === 'legacy' ? ' по записям исследования; цитаты не сверены с текстом страницы' : ''}. Обновите снимок, если сайт изменился.` }]
      return [{ id, label: section.label, status: section.status, action: section.action, reason: section.status === 'unavailable' ? section.limitations || 'Сайт был недоступен при последней попытке.' : 'Сайт конкурента ещё не снят: нет датированного снимка с его обещаниями.' }]
    }
    const lacksProof = rows.some(row => !['supported', 'mixed', 'contradicted'].includes(row.evidenceStatus) || id === 'jobs' && row.coverage === 'unknown')
    if (rows.length && !lacksProof && section.status !== 'unavailable') return []
    return [{ id, label: section.label, reason: section.status === 'not_found' ? 'В проверенных источниках не найдено; это не доказывает отсутствие.'
      : section.status === 'unavailable' ? section.limitations || 'Источники недоступны.' : rows.length ? 'Есть описание, но его основания ещё не подтверждены.'
        : section.summary || 'Эта часть досье ещё не исследована.', action: section.action, status: section.status }]
  })
  if (!rationale && !classification.bySegment.some(item => item.rationale)) researchGaps.unshift({ id: 'classification', label: 'Тип конкуренции', reason: 'Не объяснено, за какую задачу и какой сегмент конкурирует решение.', action: 'Обосновать тип конкуренции', status: 'not_researched' })
  return { classification, jobCoverage, priceDetails, messaging, landing, channels, failures, researchSections: sections, researchGaps }
}

function formatDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}.${match[2]}.${match[1]}` : textOrNull(value) || 'дата не указана'
}

// What the competitor's own site promises: the latest dated landing observation (contract §3),
// or — for graphs written before captures existed — the dated manual `messaging` entries.
function landingOf(node, { segments, resolver, researchIds, enrich, fileExists, index }) {
  const data = node.data || {}
  const observations = (Array.isArray(data.landingObservations) ? data.landingObservations : []).filter(item => item && typeof item === 'object' && textOrNull(item.observedAt))
    .slice().sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)))
  const lineEvidence = (line, url, snapshot, observedAt, verified) => {
    const rows = []
    if (sourceOf(url)) rows.push({ id: url, label: hostnameOf(url) || url, status: verified ? 'observed' : 'unverified', source: url, url, quote: line.quote, relation: 'evidenced_by', kind: verified ? 'evidence' : 'source', usable: verified, checkedAt: observedAt })
    if (sourceOf(snapshot)) rows.push({ id: snapshot, label: 'Снимок сайта', status: verified ? 'observed' : 'unverified', source: snapshot, url: null, quote: verified ? line.quote : null, relation: 'source', kind: 'source', usable: false, checkedAt: observedAt })
    rows.push(...resolver.forDatum({ claimIds: line.claimIds }, { subjectIds: researchIds }).evidence)
    return evidenceFields(rows)
  }
  const projectLine = (line, meta, verified) => ({ ...enrich(line), criterionId: index[line.criterionId]?.type === 'criterion' ? line.criterionId : null,
    criterionLabel: index[line.criterionId]?.type === 'criterion' ? index[line.criterionId].label : null, against: textOrNull(line.against) || '', main: line.main === true,
    observedAt: meta.observedAt, source: sourceOf(line.source) || sourceOf(meta.url), ...lineEvidence(line, meta.url, meta.snapshot, meta.observedAt, verified) })
  const summarize = (item, verified) => {
    const meta = { observedAt: textOrNull(item.observedAt), url: sourceOf(item.url) || sourceOf(data.url) || (data.domain ? `https://${data.domain}` : null), snapshot: sourceOf(item.snapshot) }
    const lines = (Array.isArray(item.lines) ? item.lines : []).filter(line => line && textOrNull(line.quote)).map(line => projectLine(line, meta, verified))
    return { id: textOrNull(item.id), observedAt: meta.observedAt, capturedAt: textOrNull(item.capturedAt), url: meta.url, lang: textOrNull(item.lang), renderer: textOrNull(item.renderer), contentType: textOrNull(item.contentType), limitations: textOrNull(item.limitations),
      status: ['captured', 'text-only', 'unavailable', 'unverified'].includes(item.status) ? item.status : 'unverified', title: textOrNull(item.title), h1: textOrNull(item.h1) || '', subtitle: textOrNull(item.subtitle) || '', cta: textOrNull(item.cta) || '',
      proof: textOrNull(item.proof) || '', fearHandling: textOrNull(item.fearHandling) || '', errorHandling: textOrNull(item.errorHandling) || '', scenarios: textOrNull(item.scenarios) || '', fires: textOrNull(item.fires) || '',
      snapshot: meta.snapshot, screenshot: sourceOf(item.screenshot), screenshotHref: assetHref(sourceOf(item.screenshot)), snapshotHref: snapshotHref(meta.snapshot), lines }
  }
  const latestRaw = observations.filter(item => ['captured', 'text-only'].includes(item.status)).at(-1)
  if (latestRaw) {
    const latest = summarize(latestRaw, true)
    latest.previous = observations.filter(item => item !== latestRaw).reverse().map(item => summarize(item, ['captured', 'text-only'].includes(item.status)))
    return latest
  }
  // Legacy fallback: manual entries dated by hand, snapshot referenced by `landingSnapshot`.
  const dated = (Array.isArray(data.messaging) ? data.messaging : []).filter(line => line && textOrNull(line.quote) && textOrNull(line.observedAt))
  if (!dated.length) return observations.length ? summarize(observations.at(-1), false) : null
  const dates = [...new Set(dated.map(line => line.observedAt.trim()))].sort()
  const observedAt = dates.at(-1)
  const first = data.landingFirstScreen && typeof data.landingFirstScreen === 'object' ? data.landingFirstScreen : {}
  const build = date => {
    const own = dated.filter(line => line.observedAt.trim() === date)
    const url = own.map(line => sourceOf(line.source)).find(value => value && /^https?:/.test(value)) || sourceOf(data.url) || (data.domain ? `https://${data.domain}` : null)
    const snapshot = date === observedAt ? sourceOf(data.landingSnapshot) : null
    const meta = { observedAt: date, url, snapshot }
    // Lines quoted from another site are not this site's promises; they stay in `messaging` as foreign rows.
    const lines = own.map(line => projectLine(line, meta, false)).filter(line => !line.foreign)
    const headline = lines.find(line => line.main) || lines.find(line => line.strength === 'strong') || lines[0]
    const h1 = textOrNull(first.h1) || headline?.quote || textOrNull(data.landingBigJob) || ''
    const screenshotCandidate = snapshot ? snapshot.replace(/-landing-text\.json$/i, '-landing.jpg') : null
    const screenshot = screenshotCandidate && screenshotCandidate !== snapshot && typeof fileExists === 'function' && fileExists(screenshotCandidate) ? screenshotCandidate : null
    if (headline && !lines.some(line => line.main)) headline.main = true
    return { id: `lo-${date}-legacy`, observedAt: date, capturedAt: null, url, lang: textOrNull(first.lang) || (cyrillicShare(`${h1} ${lines.map(line => line.quote).join(' ')}`) > 0.5 ? 'ru' : 'en'), renderer: null, status: 'legacy', title: null,
      h1, subtitle: textOrNull(first.subtitle) || '', cta: textOrNull(first.cta) || '', proof: textOrNull(first.proof) || '', fearHandling: textOrNull(first.fearHandling) || '', errorHandling: textOrNull(first.errorHandling) || '', scenarios: textOrNull(first.scenarios) || '', fires: textOrNull(first.fires) || '',
      snapshot, screenshot, screenshotHref: assetHref(screenshot), snapshotHref: snapshotHref(snapshot), lines }
  }
  const latest = build(observedAt)
  latest.previous = dates.slice(0, -1).reverse().map(build)
  return latest
}

// Which concrete jobs and criteria competitor sites address in saved observations.
function promiseMapOf(segments, competitors, nodes, edges) {
  const index = byId(nodes)
  const stepsByJob = new Map()
  for (const edge of edges) {
    if (edge.type !== 'in_order_to' || edge.data?.supersededAt || edge.status === 'dropped') continue
    const step = index[edge.from], parent = index[edge.to]
    if (step?.type !== 'job' || parent?.type !== 'job' || step.status === 'dropped' || parent.status === 'dropped') continue
    if (step.data?.level === 'big' || parent.data?.level === 'big') continue
    if (!stepsByJob.has(parent.id)) stepsByJob.set(parent.id, [])
    stepsByJob.get(parent.id).push(step)
  }
  const jobsInScope = segment => {
    const scoped = new Map(segment.jobs.filter(job => index[job.id]?.status !== 'dropped' && index[job.id]?.data?.level !== 'big').map(job => [job.id, job]))
    // Follow recorded steps towards the performed job, never its higher goal or siblings.
    // This is a display scope, not a new performs relation or a promise of the whole job.
    for (const job of scoped.values()) for (const step of stepsByJob.get(job.id) || []) {
      if (scoped.has(step.id)) continue
      const criteria = nodes.filter(node => node.type === 'criterion' && node.status !== 'dropped' && node.data?.segmentId === segment.id && node.data?.jobId === step.id)
        .map(node => ({ id: node.id, label: node.label }))
      scoped.set(step.id, { id: step.id, label: step.label, criteria })
    }
    return [...scoped.values()]
  }
  const jobs = []
  for (const segment of segments) for (const job of jobsInScope(segment)) {
    if (index[job.id]?.status === 'dropped' || index[job.id]?.data?.level === 'big') continue
    let row = jobs.find(item => item.id === job.id)
    if (!row) {
      row = { id: job.id, label: job.label, level: index[job.id]?.data?.level || null, segmentId: segment.id, segmentLabel: '', segmentIds: [], segments: [], criteria: [] }
      jobs.push(row)
    }
    if (!row.segmentIds.includes(segment.id)) {
      row.segmentIds.push(segment.id)
      row.segments.push({ id: segment.id, label: segment.displayLabel || segment.label })
      row.segmentLabel = row.segments.map(item => item.label).filter(Boolean).join(' · ')
    }
    for (const criterion of job.criteria) {
      let scoped = row.criteria.find(item => item.id === criterion.id)
      if (!scoped) { scoped = { id: criterion.id, label: criterion.label, segmentIds: [] }; row.criteria.push(scoped) }
      if (!scoped.segmentIds.includes(segment.id)) scoped.segmentIds.push(segment.id)
    }
  }
  const named = competitors.filter(item => !item.isCategory && item.entityKind === 'product')
  const withLanding = named.filter(item => item.landing && ['captured', 'text-only', 'legacy'].includes(item.landing.status))
  const without = named.filter(item => !withLanding.includes(item))
  const columns = [...withLanding.sort((a, b) => String(b.landing.observedAt).localeCompare(String(a.landing.observedAt)) || a.label.localeCompare(b.label, 'ru')), ...without.sort((a, b) => a.label.localeCompare(b.label, 'ru'))]
    .map(item => ({ id: item.id, label: item.displayLabel || item.label, observedAt: item.landing?.observedAt || null, status: item.landing ? item.landing.status : 'none', mixed: item.messaging.some(row => row.foreign) }))
  const cells = {}
  const put = (rowId, competitorId, cell) => {
    if (!cell.quote) return
    cells[rowId] ||= {}
    const current = cells[rowId][competitorId]
    if (!current || (STRENGTH_ORDER[cell.strength] || 0) > (STRENGTH_ORDER[current.strength] || 0) || cell.against && !current.against) cells[rowId][competitorId] = cell
  }
  const criterionRows = jobs.flatMap(job => job.criteria)
  for (const competitor of withLanding) {
    for (const edge of edges.filter(edge => edge.from === competitor.id && edge.type === 'communicates' && !edge.data?.supersededAt && jobs.some(job => job.id === edge.to))) {
      const key = normalizeFormula(edge.data?.formula)
      put(edge.to, competitor.id, { strength: strengthOf(edge.data?.strength), quote: textOrNull(edge.data?.quote), formulaLabel: formulaLabel(key) || textOrNull(edge.data?.formula), against: Boolean(textOrNull(edge.data?.against)) })
    }
    for (const line of competitor.landing.lines) {
      const cell = { strength: line.strength, quote: line.quote, formulaLabel: line.formulaLabel, against: Boolean(line.against) }
      if (line.jobId && jobs.some(job => job.id === line.jobId)) put(line.jobId, competitor.id, cell)
      if (line.criterionId && criterionRows.some(criterion => criterion.id === line.criterionId)) put(line.criterionId, competitor.id, cell)
    }
  }
  const openings = [...jobs.map(job => ({ rowId: job.id, kind: 'job', label: job.label })), ...criterionRows.map(criterion => ({ rowId: criterion.id, kind: 'criterion', label: criterion.label }))]
    .filter(row => !Object.keys(cells[row.rowId] || {}).length).map(row => ({ ...row, claimedBy: 0 }))
  // Put the actual observations first, so a wide map does not open on empty rows
  // and generic communications products. This is visibility, not market rank.
  jobs.sort((a,b)=>Object.keys(cells[b.id]||{}).length-Object.keys(cells[a.id]||{}).length)
  const claimCount = column => jobs.filter(job=>cells[job.id]?.[column.id]).length
  columns.sort((a,b)=>claimCount(b)-claimCount(a))
  return { jobs, competitors: columns, cells, openings }
}

function quantitiesOf(segment, resolver) {
  const data = segment.data || {}
  const basis = value => ({ sourced: 'Оценка из источника', derived: 'Расчёт по исходным данным', none: 'Основание пока не установлено' })[value] || textOrNull(value)
  return [
    { id: 'people', label: 'Размер сегмента', value: researchQuantity(segment, data.peopleCount), unit: 'потенциальных клиентов', basis: basis(data.peopleBasis), source: data.peopleSource, claimId: data.peopleClaimId },
    { id: 'spend', label: 'Расходы одного клиента на задачу', value: researchQuantity(segment, data.spendTodayUsdMonthly), unit: 'USD в месяц на клиента', basis: basis(data.spendBasis), source: data.spendSource, claimId: data.spendClaimId },
    { id: 'annual-spend', label: 'Совокупные расходы сегмента', value: researchQuantity(segment, data.impliedAnnualSpendUsd), unit: 'USD в год для всего сегмента', basis: 'Расчёт по размеру сегмента и расходам клиента', calculation: 'Размер сегмента × расходы клиента в месяц × 12', sources: [data.peopleSource, data.spendSource].filter(Boolean), claimIds: [data.peopleClaimId, data.spendClaimId].filter(Boolean) },
  ].map(row => ({ ...row, ...resolver.forDatum(row, { segmentId: segment.id }), description: row.id === 'annual-spend' ? 'Оценка расходов на решение задачи. Это не выручка нашего продукта.' : null }))
}

function developmentForProduct(product, nodes, edges, resolver) {
  const index = byId(nodes)
  const segments = nodes.filter(node => node.type === 'segment' && node.status !== 'dropped')
  const segmentIds = new Set(segments.map(node => node.id))
  const existing = valuesForSegments([...segmentIds], nodes, edges).map(value => ({ ...value, title: value.label, type: 'feature' }))
  const authored = (Array.isArray(product.data?.developmentHypotheses) ? product.data.developmentHypotheses : []).filter(item => item && item.status !== 'dropped').map(item => ({ ...item, segmentIds: [...(item.segmentIds || [])] }))
  const raw = [...authored, ...existing.filter(value => !authored.some(item => item.id === value.id || item.title === value.title))]
  // Graphs preceding explicit development hypotheses kept ideas on segments.
  for (const segment of segments) for (const idea of segment.data?.valueIdeas || []) {
    if (!textOrNull(idea.title)) continue
    const found = raw.find(item => item.title === idea.title)
    if (found) { if (!found.steps?.length && idea.steps?.length) found.steps = idea.steps; found.segmentIds = [...new Set([...(found.segmentIds || []), segment.id])]; found.claimIds = [...new Set([...(found.claimIds || []), ...(idea.claimIds || [])])]; continue }
    raw.push({ ...idea, id: idea.id || `idea-${crypto.createHash('sha1').update(idea.title).digest('hex').slice(0, 12)}`, type: idea.type || 'feature', status: 'hypothesis', segmentIds: [segment.id], source: segment.source })
  }
  for (const idea of product.data?.valueIdeas || []) if (textOrNull(idea.title) && !raw.some(item => item.title === idea.title)) raw.push({ ...idea,
    id: idea.id || `idea-${crypto.createHash('sha1').update(idea.title).digest('hex').slice(0, 12)}`, type: idea.type || 'feature', segmentIds: idea.segmentIds || [], source: product.source })
  const ids = new Set(raw.map(item => item.id))
  const rows = raw.map(item => {
    const targets = [...new Set(item.segmentIds || [])].filter(id => segmentIds.has(id))
    const dependencies = [...new Set(item.dependsOn || [])]
    return { id: item.id, label: item.title || item.label, kind: item.type || item.kind || 'feature', status: item.status || 'hypothesis',
      steps: Array.isArray(item.steps) ? item.steps.filter(step => typeof step === 'string' && step.trim()) : [],
      description: textOrNull(item.description || item.pain), expectedOutcome: textOrNull(item.expectedOutcome || item.outcome),
      pain: textOrNull(item.pain), outcome: textOrNull(item.expectedOutcome || item.outcome), riskiestPart: textOrNull(item.riskiestPart),
      segmentIds: targets, segments: targets.map(id => ({ id, label: displayLabel(index[id]) })), jobIds: (item.jobIds || []).filter(id => index[id]?.type === 'job'),
      dependsOn: dependencies.filter(id => ids.has(id) && id !== item.id), unresolvedDependencies: dependencies.filter(id => !ids.has(id) || id === item.id),
      dependencyIssues: Array.isArray(item.dependencyIssues) ? item.dependencyIssues : [],
      ...resolver.forDatum(item) }
  })
  const by = new Map(rows.map(row => [row.id, row]))
  for (const row of rows) {
    const visiting = new Set([row.id]), visited = new Set()
    const cycle = id => {
      if (visiting.has(id)) return true
      if (visited.has(id)) return false
      visiting.add(id)
      const found = (by.get(id)?.dependsOn || []).some(cycle)
      visiting.delete(id); visited.add(id)
      return found
    }
    if (row.dependsOn.some(cycle)) row.dependencyIssues = [...new Set([...row.dependencyIssues, 'Циклическая зависимость: уточните порядок проверки гипотез.'])]
  }
  return { nodes: rows, edges: rows.flatMap(row => row.dependsOn.map(id => ({ from: id, to: row.id, type: 'enables' }))) }
}

function positioningOf(product, nodes, edges, resolver) {
  const raw = product.data?.positioning
  const data = raw && typeof raw === 'object' ? raw : {}
  const index = byId(nodes)
  const touchpoints = (Array.isArray(data.touchpoints) ? data.touchpoints : []).map(item => ({ channel: textOrNull(item.channel), url: sourceOf(item.url),
    message: textOrNull(item.message), status: item.status || 'hypothesis', ...resolver.forDatum(item) }))
  return { status: data.status || 'not_researched', summary: textOrNull(typeof raw === 'string' ? raw : data.summary),
    jobs: (data.jobIds || []).filter(id => index[id]?.type === 'job').map(id => ({ id, label: index[id].label })),
    segments: (data.segmentIds || []).filter(id => index[id]?.type === 'segment').map(id => ({ id, label: displayLabel(index[id]) })), touchpoints,
    advantages: (Array.isArray(data.advantages) ? data.advantages : []).filter(item => item && textOrNull(item.title)).map(item => ({
      id: textOrNull(item.id), title: textOrNull(item.title), description: textOrNull(item.description), qualification: textOrNull(item.qualification), ...resolver.forDatum(item) })),
    ...resolver.forDatum(data) }
}

const HIRED_KINDS = new Set(['direct', 'indirect', 'diy', 'do_nothing'])
const HIRED_PREVALENCE = new Set(['dominant', 'common', 'rare'])
const PREVALENCE_ORDER = { dominant: 0, common: 1, rare: 2 }

// GRAPH.md `hires`: the segment's own list of what it hires today — named rivals, DIY,
// "do nothing". Resolved to plain rows; the competitor node must exist and not be dropped.
function hiredForSegment(segmentId, nodes, edges) {
  nodes = compatibleCompetitors(nodes)
  const index = byId(nodes)
  const evidence = evidenceResolver(nodes, edges)
  return edges.filter(edge => edge.from === segmentId && edge.type === 'hires' && index[edge.to]?.type === 'competitor' && index[edge.to].status !== 'dropped')
    .map(edge => {
      const node = index[edge.to]
      const data = edge.data || {}
      const scoped = (node.data?.competitionScenarios || []).flatMap(s => s.edges.filter(e => e.type === 'hires' && e.from === segmentId && e.to === s.original.id).map(e => ({ label: s.label, data: e.data || {}, original: s.original })))
      const common = key => { const values = [...new Set(scoped.map(s => s.data[key] || (key === 'kind' ? s.original.data?.kind : null)).filter(Boolean))]; return values.length === 1 ? values[0] : 'unknown' }
      const scopedText = key => scoped.filter(s => textOrNull(s.data[key])).map(s => `${s.label}: ${s.data[key]}`).join('\n') || null
      return {
        id: node.id,
        label: node.label,
        kind: HIRED_KINDS.has(data.kind) ? data.kind : (HIRED_KINDS.has(node.data?.kind) ? node.data.kind : 'unknown'),
        prevalence: HIRED_PREVALENCE.has(data.prevalence) ? data.prevalence : 'unknown',
        spendToday: textOrNull(data.spendToday),
        whyHired: textOrNull(data.whyHired),
        source: textOrNull(data.source) || node.source || null,
        status: node.status || 'hypothesis',
        competitionRationale: textOrNull(data.competitionRationale),
        competitionStatus: textOrNull(data.competitionStatus),
        competitionEvidence: evidence.forDatum({ claimIds: data.competitionClaimIds || [], supportStatus: data.competitionStatus }, { segmentId,
          subjectIds: [node.id, ...(node.data?.researchCompetitorIds || [])] }).evidence,
        coverage: data.jobCoverage || 'unknown',
        coverageExplanation: textOrNull(data.coverageExplanation),
        category: categoryOf(node),
        isCategory: node.data?.isCategory === true || node.data?.entityType === 'category',
        ...evidence.forDatum(data, { segmentId }),
        ...(scoped.length ? { kind: common('kind'), prevalence: common('prevalence'), whyHired: scopedText('whyHired'), spendToday: scopedText('spendToday'),
          competitionRationale: scopedText('competitionRationale'), coverage: common('jobCoverage'), coverageExplanation: scopedText('coverageExplanation'),
          ...evidenceFields(scoped.flatMap(s => evidence.forDatum(s.data, { segmentId }).evidence)) } : {}),
      }
    })
    .sort((a, b) => (PREVALENCE_ORDER[a.prevalence] ?? 3) - (PREVALENCE_ORDER[b.prevalence] ?? 3) || a.label.localeCompare(b.label, 'ru'))
}

const COMMUNICATION_KEYS = ['value', 'fears', 'competitorCounters']
const COMMUNICATION_CAP = 5

// segment data.communication: { value: [...], fears: [...], competitorCounters: [...] } — each card
// {title, message, why, role?}; malformed entries are dropped, arrays are capped so the dossier stays short
function communicationOf(segment, resolver = null) {
  const raw = segment?.data?.communication
  const result = { value: [], fears: [], competitorCounters: [] }
  if (!raw || typeof raw !== 'object') return result
  for (const key of COMMUNICATION_KEYS) {
    const list = Array.isArray(raw[key]) ? raw[key] : []
    result[key] = list
      .filter(item => item && typeof item === 'object' && (textOrNull(item.title) || textOrNull(item.message)))
      .slice(0, COMMUNICATION_CAP)
      .map(item => ({
        title: textOrNull(item.title) || '',
        message: textOrNull(item.message) || '',
        why: textOrNull(item.why) || '',
        role: textOrNull(item.role) || null,
        ...(resolver ? resolver.forDatum(item, { segmentId: segment.id }) : {}),
      }))
  }
  return result
}

const FUNDAMENTAL_CATEGORIES = new Set(['technical', 'legal', 'regulatory', 'platform_dependency', 'market_entry', 'operational', 'financial', 'custom'])

// fundamental risks: product-scoped assumptions with data.fundamental — "can this exist at all"
// (feasibility, law, platform, market entry). Sorted: check-before-spending first, then fatal.
function fundamentalRisksForProduct(productId, nodes, edges, moves = {}) {
  if (!productId) return []
  const index = byId(nodes)
  return edges.filter(edge => edge.to === productId && edge.type === 'about' && index[edge.from]?.type === 'assumption' && index[edge.from].data?.fundamental === true && index[edge.from].status !== 'dropped')
    .map(edge => {
      const node = index[edge.from]
      const data = node.data || {}
      const evidence = evidenceFor(node.id, nodes, edges)
      return {
        id: node.id,
        label: node.label,
        category: FUNDAMENTAL_CATEGORIES.has(data.category) ? data.category : 'custom',
        checkBeforeSpending: Boolean(data.checkBeforeSpending),
        market: textOrNull(data.market),
        whyFundamental: textOrNull(data.whyFundamental),
        fatal: Boolean(data.fatal),
        status: node.status || 'hypothesis',
        testMethod: textOrNull(data.testMethod),
        ...evidenceFields(evidence),
        moves: moves[node.id] || [],
      }
    })
    .sort((a, b) => Number(b.checkBeforeSpending) - Number(a.checkBeforeSpending) || Number(b.fatal) - Number(a.fatal) || a.label.localeCompare(b.label, 'ru'))
}

const PRODUCT_STAGES = new Set(['idea', 'has_users', 'has_revenue', 'scaling'])

function productPeople(data) {
  const raw = data?.people
  if (!raw || typeof raw !== 'object') return null
  const people = {}
  for (const key of ['tam', 'sam', 'som']) {
    const value = finitePositive(raw[key])
    if (value) people[key] = value
  }
  return Object.keys(people).length ? people : null
}

function valuesForSegments(segmentIds, nodes, edges) {
  const wanted = new Set(segmentIds)
  const index = byId(nodes)
  const targets = new Map()
  for (const edge of edges) {
    if (edge.type !== 'has_value' || !wanted.has(edge.from) || index[edge.to]?.type !== 'value') continue
    if (!targets.has(edge.to)) targets.set(edge.to, new Set())
    targets.get(edge.to).add(edge.from)
  }
  return [...targets].map(([valueId, ids]) => {
    const node = index[valueId]
    return {
      id: node.id,
      label: node.label,
      status: node.status || 'hypothesis',
      segmentIds: [...ids].sort(),
      source: sourceOf(node.source),
      claimIds: Array.isArray(node.data?.claimIds) ? node.data.claimIds : [],
      pain: node.data?.pain || '',
      outcome: node.data?.outcome || '',
      riskiestPart: node.data?.riskiestPart || '',
      steps: Array.isArray(node.data?.steps) ? node.data.steps : [],
      ...evidenceFields(evidenceFor(node.id, nodes, edges)),
    }
  }).filter(value => value.status !== 'dropped').sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

function displayLabel(node) {
  const explicit = node?.data?.shortName || node?.data?.displayLabel || node?.data?.shortLabel
  const label = String(explicit || node?.label || '').replace(/\bunknown\b/gi, '').trim()
  const name = label.split(/\s+[—–]\s+|:\s*[«"“]/)[0].trim() || label
  return name.split(/\s+/).filter(Boolean).slice(0, 4).join(' ') || 'Без названия'
}

// Names identify people/groups; truncating them by word count can erase the
// qualifying condition. A supplied short name is editorial, otherwise keep it all.
const segmentDisplayLabel = node => String(node?.data?.shortName || node?.data?.displayLabel || node?.data?.shortLabel || node?.label || 'Без названия').trim()

function buildGalaxyProjection({ nodes = [], edges = [], productId = null, moves = {}, fileExists = null }) {
  nodes = compatibleCompetitors(nodes)
  const index = byId(nodes)
  const resolver = evidenceResolver(nodes, edges)
  const productNode = index[productId] || nodes.find(node => node.type === 'product') || null
  // sub-segments (GRAPH.md "Sub-segments"): a segment with an outgoing sub_segment_of edge
  // is shown inside its parent segment, never as its own
  const subEdges = edges.filter(edge => edge.type === 'sub_segment_of' && index[edge.from] && index[edge.to])
  const subIds = new Set(subEdges.map(edge => edge.from))
  const segmentsRaw = nodes.filter(node => node.type === 'segment' && node.status !== 'dropped')
  const development = productNode ? developmentForProduct(productNode, nodes, edges, resolver) : null
  if (development) development.nodes = development.nodes.map(node => ({ ...node, moves: moves[node.id] || [] }))
  const values = development?.nodes || valuesForSegments(segmentsRaw.map(segment => segment.id), nodes, edges)
  const valuesBySegment = new Map(segmentsRaw.map(segment => [segment.id, []]))
  for (const value of values) for (const segmentId of value.segmentIds) valuesBySegment.get(segmentId)?.push(value.id)

  const segments = segmentsRaw.map(segment => {
    const jobs = jobsForSegment(segment.id, nodes, edges)
    const problems = edges.filter(edge => edge.from === segment.id && edge.type === 'suffers' && index[edge.to])
      .map(edge => {
        const node = index[edge.to]
        const evidence = evidenceFor(node.id, nodes, edges)
        return { id: node.id, label: node.label, status: node.status || 'hypothesis', ...evidenceFields(evidence) }
      })
    const channels = edges.filter(edge => edge.from === segment.id && edge.type === 'reached_via' && index[edge.to])
      .map(edge => ({ id: index[edge.to].id, label: index[edge.to].label, ...edge.data, ...resolver.forDatum(edge.data || {}, { segmentId: segment.id }) }))
    const competitors = competitorsForSegment(segment.id, nodes, edges)
    const hired = hiredForSegment(segment.id, nodes, edges)
    const risks = risksForSegment(segment.id, nodes, edges)
    const verification = verificationOf(segment.id, nodes, edges)
    const countries = subEdges.filter(edge => edge.to === segment.id).map(edge => {
      const node = index[edge.from]
      const data = edge.data || {}
      return {
        id: node.id,
        label: node.label,
        displayLabel: segmentDisplayLabel(node),
        status: node.status || 'hypothesis',
        sharperContext: data.sharperContext || node.data?.sharperContext || null,
        addedCriteria: (data.addedCriteria || []).map(ref => index[ref.id]).filter(Boolean)
          .map(criterion => ({ id: criterion.id, label: criterion.label, status: criterion.status || 'hypothesis', ...resolver.forDatum(criterion, { segmentId: node.id }) })),
        triggers: Array.isArray(data.triggers) ? data.triggers : [],
        moves: moves[node.id] || [],
        ...resolver.forDatum(node),
      }
    })
    const criteria = jobs.flatMap(job => job.criteria)
    const evidenceSources = new Map()
    for (const item of [resolver.forDatum(segment), ...jobs, ...criteria, ...problems, ...risks, ...hired, ...channels, ...quantitiesOf(segment, resolver)]) {
      for (const evidence of item.evidence || []) {
        const key = `${evidence.source || evidence.id}|${evidence.quote || ''}|${evidence.relation}`
        if (!evidenceSources.has(key)) evidenceSources.set(key, evidence)
      }
    }
    return {
      id: segment.id,
      label: segment.label,
      fullLabel: segment.label,
      displayLabel: segmentDisplayLabel(segment),
      researchSegmentId: textOrNull(segment.data?.researchSegmentId),
      analysisParameters: segment.data?.analysisParameters || null,
      cohortView: segment.data?.cohortView || null,
      customerProfile: segment.data?.customerProfile || null,
      customerProfileSource: segment.data?.customerProfileSource || null,
      catalogRole: segment.data?.catalogRole || 'segment',
      catalogOrder: segment.data?.catalogOrder ?? null,
      customerGroup: segment.data?.customerGroup || null,
      hasParameterModel: !!segment.data?.parameterModel,
      parameterView: segment.data?.parameterView || null,
      archivedResearchSegmentIds: (segment.data?.archivedResearchSegmentIds||[]).filter(id=>nodes.some(n=>n.id===id&&n.type==='segment'&&n.status==='dropped')),
      parameterConditions: Object.entries(segment.data?.parameterView?.selection||{}).map(([key,value])=>{
        const base=nodes.find(n=>n.id===segment.data.parameterView.baseSegmentId),p=base?.data?.parameterModel?.parameters.find(p=>p.id===key)
        return {label:p?.label||'Условие больше не доступно',value:p?.values.find(v=>v.id===value)?.label||'Нужно выбрать заново'}
      }),
      shortLabel: segmentDisplayLabel(segment),
      parentId: subEdges.find(edge => edge.from === segment.id)?.to || null,
      subSegmentIds: subEdges.filter(edge => edge.to === segment.id).map(edge => edge.from),
      definition: textOrNull(segment.data?.definition),
      qualifyingSignals: Array.isArray(segment.data?.qualifyingSignals) ? segment.data.qualifyingSignals : [],
      description: textOrNull(segment.data?.description || segment.data?.context),
      context: textOrNull(segment.data?.context),
      status: segment.status || 'hypothesis',
      // Who stands behind an unproven segment: 'expert' only by an explicit user decision; everything else is an AI proposal.
      confidence: segment.data?.confidence === 'expert' ? 'expert' : 'ai',
      confidenceSource: textOrNull(segment.data?.confidenceSource),
      rank: segment.data?.rank ?? null,
      totalScore: segment.data?.totalScore ?? null,
      totalScoreRange: segment.data?.totalScoreRange || null, ranking: segment.data?.ranking || null,
      switchScore: segment.data?.switchScore ?? null,
      // «изучено на X%» — ворота из bin/verification.js
      verification,
      researchProgress: { label: 'Проверка сегмента', completed: verification.passed, total: verification.total,
        summary: `Завершено ${verification.passed} из ${verification.total} направлений проверки. Исследование рынка не заменяет интервью, проверку оплаты и экономики.`,
        steps: verification.gates.map(gate => ({ id: gate.key, label: gate.label, description: gate.detail, nextAction: gate.unlock,
          status: gate.done ? 'complete' : gate.partial ? 'partial' : 'not_started' })) },
      thinEvidence: Boolean(verification.blockedAt || segment.data?.thinEvidence),
      economicsUnpriced: Boolean(segment.data?.economicsUnpriced),
      jobs,
      problems,
      channels,
      risks,
      countries,
      competitors,
      hired,
      // people × budget-for-the-job: null when unsourced — the panel never shows a 0 as a fact
      people: { count: researchQuantity(segment, segment.data?.peopleCount), basis: textOrNull(segment.data?.peopleBasis) },
      spend: { monthlyUsd: researchQuantity(segment, segment.data?.spendTodayUsdMonthly), basis: textOrNull(segment.data?.spendBasis) },
      impliedAnnualSpendUsd: researchQuantity(segment, segment.data?.impliedAnnualSpendUsd),
      communication: communicationOf(segment, resolver),
      quantities: quantitiesOf(segment, resolver),
      valueIds: valuesBySegment.get(segment.id) || [],
      sources: [...evidenceSources.values()],
      moves: moves[segment.id] || [],
    }
  }).sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999) || a.label.localeCompare(b.label, 'ru'))

  const appearanceMap = new Map()
  for (const segment of segments) {
    for (const competitor of segment.competitors) {
      if (!appearanceMap.has(competitor.id)) appearanceMap.set(competitor.id, { node: index[competitor.id], appearances: [] })
      appearanceMap.get(competitor.id).appearances.push({ segmentId: segment.id, sharedJobs: competitor.sharedJobs })
    }
  }
  // Market research can discover a solution before establishing a segment/job link.
  // Keep it in the competitor list even without a proven shared job.
  for (const node of nodes.filter(node => node.type === 'competitor' && node.status !== 'dropped')) {
    if (!appearanceMap.has(node.id)) appearanceMap.set(node.id, { node, appearances: [] })
  }
  // a competitor that only exists through `hires` still gets a dossier entry (selectable from
  // the segment panel); appearances list only proven shared jobs
  const hiredByMap = new Map()
  for (const segment of segments) {
    for (const item of segment.hired) {
      if (!hiredByMap.has(item.id)) hiredByMap.set(item.id, [])
      hiredByMap.get(item.id).push(segment.id)
      if (!appearanceMap.has(item.id)) appearanceMap.set(item.id, { node: index[item.id], appearances: [] })
    }
  }
  const competitors = [...appearanceMap].map(([id, value]) => {
    const hiredBy = hiredByMap.get(id) || []
    const appearanceIds = value.appearances.map(item => item.segmentId)
    const kind = normalizeKind(value.node.data?.kind)
    return {
      id,
      label: value.node.data?.alternative?.label || value.node.label,
      displayLabel: value.node.data?.alternative?.label || displayLabel(value.node),
      status: value.node.status || 'hypothesis',
      kind,
      rawKind: value.node.data?.kind || 'unknown',
      pricing: value.node.data?.pricing || null,
      priceTier: priceTierOf(value.node.data?.pricing),
      landingBigJob: textOrNull(value.node.data?.landingBigJob),
      description: textOrNull(value.node.data?.description || value.node.data?.summary),
      // the address it lives at — the identity the graph keys on, and the link a dossier opens
      url: sourceOf(value.node.data?.url) || (value.node.data?.domain ? sourceOf(`https://${value.node.data.domain}`) : null),
      aliases: Array.isArray(value.node.data?.aliases) ? value.node.data.aliases : [],
      isCategory: Boolean(value.node.data?.isCategory) || value.node.data?.entityType === 'category',
      entityType: value.node.data?.isCategory || value.node.data?.entityType === 'category' ? 'category' : ['diy', 'do_nothing'].includes(kind) ? 'behaviour' : value.node.data?.entityType || 'solution',
      alternative: value.node.data?.alternative || null,
      entityKind: value.node.data?.alternative ? 'archetype' : value.node.data?.isCategory || value.node.data?.entityType === 'category' ? 'category' : value.node.data?.entityType === 'behaviour' || ['diy', 'do_nothing'].includes(kind) ? 'behaviour' : 'product',
      category: categoryOf(value.node),
      solutionCategory: categoryOf(value.node),
      classificationCompatibility: textOrNull(value.node.data?.classificationCompatibility),
      classificationReview: value.node.data?.classificationReview || null,
      previousIds: (value.node.data?.mergedCompetitors || []).map(n => n.id),
      scenarios: (value.node.data?.competitionScenarios || []).map(record => {
        const original = record.original, originalEdges = record.edges || []
        const hires = originalEdges.filter(e => e.type === 'hires' && e.to === original.id)
        return { id: record.id, label: record.label, originalLabel: original.label, source: original.source,
          kind: normalizeKind(original.data?.kind), status: original.status, discoveryPlaces: record.discoveryPlaces || [],
          segmentIds: hires.map(e => e.from),
          contexts: hires.map(e => ({ segmentId: e.from, segmentLabel: displayLabel(index[e.from] || {}), kind: normalizeKind(e.data?.kind || original.data?.kind),
            whyHired: e.data?.whyHired || '', spendToday: e.data?.spendToday || '', source: e.data?.source || original.source,
            ...resolver.forDatum(e.data || {}, { segmentId: e.from }) })),
          jobs: originalEdges.filter(e => e.type === 'competes_for' && e.from === original.id && index[e.to]).map(e => ({ id: e.to, label: index[e.to].label })),
          pricing: original.data?.pricing || '', landingBigJob: original.data?.landingBigJob || '',
          mentionedSolutions: originalEdges.filter(e => e.type === 'mentions_solution' && e.from === original.id && index[e.to]).map(e => ({ id: e.to, label: index[e.to].label })),
          ...resolver.forDatum(original),
        }
      }),
      mentionedSolutions: edges.filter(e => e.from === id && e.type === 'mentions_solution' && index[e.to]?.status !== 'dropped' && index[e.to]?.type === 'competitor').map(e => ({ id: e.to, label: index[e.to].label })),
      mentionedIn: edges.filter(e => e.to === id && e.type === 'mentions_solution' && index[e.from]?.status !== 'dropped' && index[e.from]?.type === 'competitor').map(e => ({ id: e.from, label: index[e.from].label })),
      source: sourceOf(value.node.source),
      ...resolver.forDatum(value.node),
      // what each segment pays for it today and why it hires it (GRAPH.md `hires`)
      hiredFacts: segments.filter(segment => (segment.hired || []).some(item => item.id === id))
        .map(segment => {
          const item = segment.hired.find(entry => entry.id === id)
          return { segmentId: segment.id, segmentLabel: segment.displayLabel || segment.label, prevalence: item.prevalence, spendToday: item.spendToday, whyHired: item.whyHired, source: item.source,
            competitionRationale: item.competitionRationale, ...evidenceFields(item.evidence) }
        }),
      segmentIds: [...new Set([...appearanceIds, ...hiredBy, ...(value.node.data?.considerationCases || []).flatMap(c => c.segmentIds)])],
      considerationCases: value.node.data?.considerationCases || [],
      appearances: value.appearances,
      hiredBy,
      ...competitorDetails(value.node, nodes, edges, segments, resolver, fileExists),
      moves: moves[id] || [],
    }
  }).sort((a, b) => a.label.localeCompare(b.label, 'ru'))

  const currentJobIds = Array.isArray(productNode?.data?.currentJobIds) ? new Set(productNode.data.currentJobIds) : null
  const productJobIds = productNode
    ? edges.filter(edge => edge.from === productNode.id && edge.type === 'competes_for' && index[edge.to]?.type === 'job'
      && index[edge.to].status !== 'dropped' && (!currentJobIds || currentJobIds.has(edge.to))).map(edge => edge.to)
    : []
  return {
    version: 1,
    product: productNode ? {
      id: productNode.id,
      label: productNode.label,
      displayLabel: displayLabel(productNode),
      status: productNode.status || 'hypothesis',
      summary: productNode.data?.summary || productNode.data?.context || productNode.context || '',
      description: { what: textOrNull(productNode.data?.description?.what || productNode.data?.summary || productNode.data?.context || productNode.context),
        forWhom: textOrNull(productNode.data?.description?.forWhom || productNode.data?.targetAudience), outcome: textOrNull(productNode.data?.description?.outcome || productNode.data?.outcome),
        ...resolver.forDatum(productNode.data?.description?.sources?.length || productNode.data?.description?.claimIds?.length ? productNode.data.description : productNode) },
      positioning: positioningOf(productNode, nodes, edges, resolver),
      development,
      // the run's frame: where the product stands, what the team is after, what it cannot cross
      stage: PRODUCT_STAGES.has(productNode.data?.stage) ? productNode.data.stage : textOrNull(productNode.data?.stage),
      businessGoal: textOrNull(productNode.data?.businessGoal),
      constraints: textOrNull(productNode.data?.constraints),
      goalRead: textOrNull(productNode.data?.goalRead),
      people: productPeople(productNode.data),
      fundamentalRisks: fundamentalRisksForProduct(productNode.id, nodes, edges, moves),
      jobIds: productJobIds,
      jobs: productJobIds.map(id => index[id]).filter(Boolean).map(node => ({ id: node.id, label: node.label, level: node.data?.level || null, climbReason: node.data?.climbReason || null })),
      moves: moves[productNode.id] || [],
    } : null,
    segments: segments.filter(segment=>!subIds.has(segment.id)),
    subSegments: segments.filter(segment=>subIds.has(segment.id)),
    competitors,
    promiseMap: promiseMapOf(segments, competitors, nodes, edges),
    values: values.map(value => ({ ...value, moves: moves[value.id] || [] })),
  }
}

module.exports = {
  buildGalaxyProjection,
  FORMULAS,
  normalizeFormula,
  formulaLabel,
  promiseMapOf,
  competitorsForSegment,
  criteriaForSegmentJob,
  communicationOf,
  displayLabel,
  fundamentalRisksForProduct,
  hiredForSegment,
  jobsForSegment,
  risksForSegment,
  valuesForSegments,
}
