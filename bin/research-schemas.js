// JSON schemas shared with the standalone Workflow. An observation is a captured
// passage; only the independent verification stage can establish claim support.
const RESEARCH_STRING = { type: 'string' }
const RESEARCH_STRINGS = { type: 'array', items: RESEARCH_STRING }
const RESEARCH_NULLABLE_STRING = { type: ['string', 'null'] }
const RESEARCH_QUANTITY_REF = { type: ['string', 'null'], description: 'ID of a supported numeric claim in the evidence ledger; null when unavailable' }
// Project regression budget, not a documented provider limit. Keep the structured
// contract compact; all field guidance remains visible in the ordinary prompt.
const RESEARCH_SCHEMA_BUDGET_BYTES = 3000
function researchSchemaBytes(schema) {
  let bytes = 0
  for (const character of JSON.stringify(schema)) {
    const code = character.codePointAt(0)
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4
  }
  return bytes
}
function prepareResearchSchema(schema) {
  const guidance = []
  const schemaMaps = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas'])
  const schemaChildren = new Set(['items', 'additionalProperties', 'additionalItems', 'contains', 'propertyNames', 'not', 'if', 'then', 'else', 'unevaluatedProperties', 'unevaluatedItems'])
  const schemaArrays = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems'])
  function visit(node, at) {
    if (!node || typeof node !== 'object') return node
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      if (['description', 'title', 'examples', '$comment'].includes(key)) {
        guidance.push(`${at} (${key}): ${typeof value === 'string' ? value : JSON.stringify(value)}`)
      } else if (schemaMaps.has(key)) {
        out[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, visit(child, `${at}/${key}/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`)]))
      } else if (schemaArrays.has(key) || key === 'items' && Array.isArray(value)) {
        out[key] = value.map((child, i) => visit(child, `${at}/${key}/${i}`))
      } else if (schemaChildren.has(key)) out[key] = visit(value, `${at}/${key}`)
      else out[key] = value
    }
    return out
  }
  const transport = visit(schema, '#')
  // Workflow's standalone sandbox does not require Node's Buffer or TextEncoder.
  const bytes = researchSchemaBytes(transport)
  let parts = [{ schema: transport, bytes }]
  if (bytes > RESEARCH_SCHEMA_BUDGET_BYTES) {
    const unsupported = Object.keys(transport).filter(key => !['type', 'properties', 'required', 'additionalProperties'].includes(key))
    if (transport.type !== 'object' || !transport.properties || unsupported.length || typeof transport.additionalProperties === 'object') throw new Error('Output schema exceeds the project budget and needs an explicit typed split')
    const identity = Object.hasOwn(transport.properties, 'segmentId') ? ['segmentId'] : []
    const makePart = keys => {
      const schema = { ...transport, properties: Object.fromEntries(keys.map(key => [key, transport.properties[key]])), required: (transport.required || []).filter(key => keys.includes(key)), additionalProperties: false }
      return { schema, bytes: researchSchemaBytes(schema) }
    }
    // Collect evidence before any prose that cites it. Repeat segment identity in
    // each part; no other field can overwrite a preceding part's observations.
    const keys = Object.keys(transport.properties).filter(key => !identity.includes(key))
    if (keys.includes('evidencePacket')) keys.unshift(...keys.splice(keys.indexOf('evidencePacket'), 1))
    parts = []
    let current = [...identity]
    for (const key of keys) {
      if (makePart([...current, key]).bytes > RESEARCH_SCHEMA_BUDGET_BYTES) {
        if (current.length > identity.length) parts.push(makePart(current))
        current = [...identity]
      }
      current.push(key)
      if (makePart(current).bytes > RESEARCH_SCHEMA_BUDGET_BYTES) throw new Error(`Output schema field ${key} exceeds the project budget; split this typed field explicitly before running this stage`)
    }
    if (current.length > identity.length) parts.push(makePart(current))
  }
  return { schema: transport, bytes, parts, guidance: guidance.length ? `Output field guidance (schema paths):\n${guidance.join('\n')}` : '' }
}
const EVIDENCE_PACKET_SCHEMA = {
  type: 'object', required: ['sources', 'claims'], additionalProperties: false,
  properties: {
    sources: { type: 'array', items: { type: 'object', required: ['id', 'source', 'excerpt', 'retrievedAt', 'publishedAt', 'kind'], additionalProperties: false, properties: {
      id: RESEARCH_STRING, source: { type: 'string', description: 'Opened primary URL or an existing original under sources/' },
      excerpt: { type: 'string', description: 'Exact captured passage, including enough surrounding context to interpret it' },
      retrievedAt: RESEARCH_STRING, publishedAt: RESEARCH_NULLABLE_STRING,
      kind: { type: 'string', enum: ['official', 'review', 'community', 'research', 'interview', 'test', 'payment', 'secondary'] },
      originalSource: RESEARCH_NULLABLE_STRING,
    } } },
    claims: { type: 'array', items: { type: 'object', required: ['id', 'subjectId', 'kind', 'statement', 'markets', 'observations'], additionalProperties: false, properties: {
      id: RESEARCH_STRING, subjectId: RESEARCH_STRING, productId: RESEARCH_NULLABLE_STRING, segmentId: RESEARCH_NULLABLE_STRING,
      kind: { type: 'string', enum: ['criterion-axis', 'criterion-level', 'criterion-priority', 'problem', 'hired', 'competitor-identity', 'competitor-price', 'product-price', 'market-number', 'market-availability', 'people-count', 'job-spend', 'cogs', 'cac', 'lifetime', 'capability', 'fundamental-risk', 'channel', 'messaging', 'exchange-rate', 'population-partition'] },
      statement: RESEARCH_STRING, markets: RESEARCH_STRINGS, value: { type: ['number', 'null'] },
      unit: RESEARCH_NULLABLE_STRING, currency: RESEARCH_NULLABLE_STRING, baseCurrency: RESEARCH_NULLABLE_STRING, period: RESEARCH_NULLABLE_STRING,
      memberClaimIds: RESEARCH_STRINGS, asOf: RESEARCH_NULLABLE_STRING, basis: { type: 'string', enum: ['observed', 'measured', 'derived', 'hypothesis'] },
      range: { type: 'object', required: ['low', 'base', 'high'], properties: { low: { type: 'number' }, base: { type: 'number' }, high: { type: 'number' } } },
      derivation: { type: 'object', required: ['operation', 'inputClaimIds'], additionalProperties: false, properties: { operation: { type: 'string', enum: ['multiply', 'divide', 'add', 'annualize', 'convert'] }, inputClaimIds: RESEARCH_STRINGS, partitionClaimId: RESEARCH_STRING } },
      observations: { type: 'array', items: { type: 'object', required: ['sourceId', 'quote', 'relation'], additionalProperties: false, properties: {
        sourceId: RESEARCH_STRING, quote: RESEARCH_STRING, relation: { type: 'string', enum: ['supports', 'refutes'] },
      } } },
    } } },
  },
}
const EVIDENCE_CHECK_SCHEMA = { type: 'object', required: ['checks'], additionalProperties: false, properties: {
  checks: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['claimId', 'sourceId', 'quote', 'relation', 'opened', 'sourceExcerpt', 'scopeMatches', 'segmentFit', 'temporalFit', 'checkedAt', 'verdict', 'reason', 'independenceKey', 'claimFingerprint', 'sourceFingerprint', 'contextFingerprint'], properties: {
      claimFingerprint: RESEARCH_STRING, sourceFingerprint: RESEARCH_STRING, contextFingerprint: RESEARCH_STRING,
      claimId: RESEARCH_STRING, sourceId: RESEARCH_STRING, quote: RESEARCH_STRING,
      relation: { type: 'string', enum: ['supports', 'refutes'] }, opened: { type: 'boolean' },
      sourceExcerpt: { type: 'string', description: 'Verbatim copy of the opened page text that contains the quote character-for-character, with a sentence of context; never a paraphrase, translation, summary or “confirmed”' },
      scopeMatches: { type: 'boolean' }, segmentFit: { type: 'string', enum: ['matched', 'unknown', 'other', 'not-applicable'] },
      marketFit: { type: 'string', enum: ['matched', 'other', 'unknown'], description: 'whether the passage applies to the stated target markets, whatever label the collector wrote' },
      temporalFit: { type: 'string', enum: ['current', 'historical', 'unknown'] }, checkedAt: RESEARCH_STRING,
      verdict: { type: 'string', enum: ['supports', 'refutes', 'not-supported', 'unavailable'] }, reason: RESEARCH_STRING, independenceKey: RESEARCH_STRING,
    } } },
} }
const SEGMENT_REVIEW_SCHEMA = { type: 'object', required: ['segments', 'followUpQuestions'], additionalProperties: false, properties: {
  segments: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['segmentId', 'decision', 'reason', 'claimIds', 'proposedChanges'], properties: {
    segmentId: RESEARCH_STRING, decision: { type: 'string', enum: ['retain', 'revise', 'split', 'merge', 'insufficient'] }, reason: RESEARCH_STRING,
    claimIds: RESEARCH_STRINGS, proposedChanges: RESEARCH_STRINGS,
  } } },
  followUpQuestions: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['subjectId', 'question', 'whyDecisionDependsOnIt'], properties: {
    subjectId: RESEARCH_STRING, question: RESEARCH_STRING, whyDecisionDependsOnIt: RESEARCH_STRING,
  } } },
} }
const FAILURE_TEST_SCHEMA = { type: 'object', additionalProperties: false, required: ['metric', 'operator', 'value', 'measurement', 'deadline'], properties: {
  metric: RESEARCH_STRING, operator: { type: 'string', enum: ['<', '<=', '>', '>=', '=', 'equals'] }, value: { type: ['number', 'string'] },
  unit: RESEARCH_STRING, sampleSize: { type: 'integer', minimum: 1 }, measurement: RESEARCH_STRING, deadline: RESEARCH_STRING,
} }
const PLAN_REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['reviews'], properties: {
  reviews: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['moveId', 'moveFingerprint', 'assumptionMatches', 'failureTestValid', 'goalAligned', 'constraintsSatisfied', 'reason'], properties: {
    moveFingerprint: RESEARCH_STRING,
    moveId: RESEARCH_STRING, assumptionMatches: { type: 'boolean' }, failureTestValid: { type: 'boolean' }, goalAligned: { type: 'boolean' }, constraintsSatisfied: { type: 'boolean' }, reason: RESEARCH_STRING,
  } } },
} }
// Flat section rows keep each transport field below the standalone schema budget.
// Evidence is collected in an earlier part and referenced here, never duplicated.
const COMPETITOR_FINDINGS_SCHEMA = { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['competitorId', 'section', 'statement', 'claimIds'], properties: {
    competitorId: RESEARCH_STRING, section: { type: 'string', enum: ['pricing', 'jobs', 'messaging', 'channels', 'complaints'] },
    statement: { type: 'string', description: 'Exact atomic claim statement; interpretation and unverified claims remain unconfirmed' }, claimIds: RESEARCH_STRINGS,
    segmentId: RESEARCH_NULLABLE_STRING, job: RESEARCH_STRING,
    coverage: { type: 'string', enum: ['full', 'partial', 'none', 'unknown'] },
    priceKind: { type: 'string', enum: ['subscription', 'implementation', 'customization', 'usage', 'other'] },
    plan: RESEARCH_STRING, amountClaimId: RESEARCH_QUANTITY_REF, channel: RESEARCH_STRING,
    billingUnit: RESEARCH_STRING, includes: RESEARCH_STRING, excludes: RESEARCH_STRING,
  } } }
const COMPETITOR_RESEARCH_SCHEMA = { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['competitorId', 'section', 'status', 'queries', 'sourceIds', 'checkedAt', 'limitations'], properties: {
    competitorId: RESEARCH_STRING, section: { type: 'string', enum: ['pricing', 'jobs', 'messaging', 'channels', 'complaints'] },
    status: { type: 'string', enum: ['not_researched', 'researched', 'not_found', 'unavailable'] },
    summary: RESEARCH_STRING, queries: RESEARCH_STRINGS, sourceIds: RESEARCH_STRINGS, checkedAt: RESEARCH_NULLABLE_STRING, limitations: RESEARCH_STRING,
  } } }
// What a rival's landing page promises, read from a dated capture (bin/landing-capture.js).
// Every line is a verbatim quote tied to a CURRENT job id, so the graph can say which Jobs a
// rival claims in the customer's head and which ones are still free. The formula enum mirrors
// FORMULA_KEYS in research-quality.js (kept literal here: this file is embedded without requires).
const LANDING_OBSERVATION_SCHEMA = { type: 'object', additionalProperties: false, required: ['url', 'observedAt', 'lang', 'h1', 'lines'], properties: {
  url: RESEARCH_STRING, observedAt: { type: 'string', description: 'YYYY-MM-DD of the capture, exactly as supplied' }, lang: RESEARCH_STRING,
  h1: { type: 'string', description: 'First-screen headline, verbatim' }, subtitle: RESEARCH_STRING, cta: RESEARCH_STRING,
  proof: { type: 'string', description: 'Ratings, user counts, testimonials shown on the page ("4.8 · 6M+ learners"); empty when none' },
  fearHandling: { type: 'string', description: 'How the page removes the fear behind the customer job; empty when not addressed' },
  errorHandling: { type: 'string', description: "What the page says it does with the customer's mistakes; empty when nothing" },
  scenarios: { type: 'string', description: 'Trigger situations named on the page; empty when none' },
  fires: { type: 'string', description: 'Whom the page fires: the current solution it argues against; empty when nobody' },
  lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['formula', 'quote', 'strength', 'jobId'], properties: {
    formula: { type: 'string', enum: ['core_for_big', 'core_value', 'trigger', 'orientation', 'big_jobs_lived', 'micro', 'problem_contrast'] },
    quote: { type: 'string', description: 'Verbatim from the captured page text' },
    strength: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
    jobId: { type: ['string', 'null'], description: 'One of the current job IDs supplied in the prompt, or null' },
    criterionId: { type: ['string', 'null'], description: 'One of the supplied criterion IDs, or null' },
    against: { type: 'string', description: 'Empty, or the supplied product differentiator this line touches: the rival promises the same thing or the opposite' },
    main: { type: 'boolean', description: 'true on exactly one line: the first-screen headline promise' },
  } } },
} }
function enrichResearchSchema(schema, label) {
  const copy = JSON.parse(JSON.stringify(schema))
  const claimRefs = target => { if (target?.properties) target.properties.claimIds = RESEARCH_STRINGS }
  if (label === 'market-research' || label.startsWith('field:')) {
    copy.properties.competitorFindings = COMPETITOR_FINDINGS_SCHEMA
    copy.properties.competitorResearch = COMPETITOR_RESEARCH_SCHEMA
    copy.required = [...new Set([...(copy.required || []), 'competitorFindings', 'competitorResearch'])]
    const item = label === 'market-research' ? copy.properties.competitors.items : copy.properties.solutionsHired.items
    Object.assign(item.properties, { entityType: { type: 'string', enum: ['solution', 'category', 'behaviour'] },
      categoryId: RESEARCH_STRING, categoryName: RESEARCH_STRING, parentCategoryId: RESEARCH_NULLABLE_STRING,
      productKey: { type: 'string', description: 'Stable lowercase slug only for distinct named products sharing one vendor domain; omit for ordinary domain identity' },
      competitionRationale: RESEARCH_STRING, competitionClaimIds: RESEARCH_STRINGS, jobCoverage: { type: 'string', enum: ['full', 'partial', 'none', 'unknown'] }, coverageExplanation: RESEARCH_STRING })
    item.required = [...new Set([...(item.required || []), 'id', 'entityType', 'categoryName', 'competitionRationale', 'jobCoverage', 'coverageExplanation'])]
  }
  if (label === 'market-research' || label.startsWith('field:') || label === 'comm-gaps' || label.startsWith('split:') || label.startsWith('follow-up:') || label === 'fundamental-check') {
    copy.properties.evidencePacket = EVIDENCE_PACKET_SCHEMA
    copy.required = [...new Set([...(copy.required || []), 'evidencePacket'])]
    copy.properties.searchLog = { type: 'array', items: { type: 'object', required: ['query', 'result'], properties: { query: RESEARCH_STRING, result: RESEARCH_STRING } } }
    copy.properties.gaps = copy.properties.gaps || RESEARCH_STRINGS
  }
  if (label === 'market-research') {
    for (const level of ['tam', 'sam', 'som']) {
      copy.properties[level].properties.valueUsd.type = ['number', 'null']
      copy.properties[level].properties.peopleCount.type = ['number', 'null']
      Object.assign(copy.properties[level].properties, { valueClaimId: RESEARCH_QUANTITY_REF, peopleClaimId: RESEARCH_QUANTITY_REF, overlapMethod: RESEARCH_STRING, attainableRevenueMethod: RESEARCH_STRING })
    }
    Object.assign(copy.properties.competitors.items.properties, { id: RESEARCH_STRING, pricingClaimId: RESEARCH_QUANTITY_REF, availabilityClaimId: RESEARCH_QUANTITY_REF })
    claimRefs(copy.properties.competitors.items)
  }
  if (label.startsWith('field:')) {
    const p = copy.properties
    p.solutionsHired.minItems = 0; p.criteriaValidation.minItems = 0
    p.criteriaValidation.items.required = ['criterionId', 'claimIds']
    Object.assign(p.criteriaValidation.items.properties, { criterionId: RESEARCH_STRING, claimIds: RESEARCH_STRINGS })
    for (const key of ['solutionsHired', 'problems', 'channels', 'newCriteria']) {
      const item = p[key].items
      claimRefs(item); item.properties.id = RESEARCH_STRING
    }
    p.solutionsHired.items.properties.prevalence.enum.push('unknown')
    Object.assign(p.solutionsHired.items.properties, { pricingClaimId: RESEARCH_QUANTITY_REF, availabilityClaimId: RESEARCH_QUANTITY_REF, sampleDescription: RESEARCH_STRING })
    p.newCriteria.items.properties.axisClaimId = RESEARCH_QUANTITY_REF
    p.newCriteria.items.properties.levelClaimId = RESEARCH_QUANTITY_REF
  }
  if (label === 'comm-gaps') {
    const item = copy.properties.perCompetitor.items
    item.properties.id = RESEARCH_STRING
    claimRefs(item.properties.formulasUsed.items)
    item.properties.formulasUsed.items.properties.source = RESEARCH_STRING
  }
  if (label.startsWith('score:')) {
    const p = copy.properties
    p.somClaimId = RESEARCH_QUANTITY_REF
    for (const group of ['forces', 'competition', 'advantage']) for (const property of Object.values(p[group].properties)) {
      property.type = [property.type, 'null']
      if (property.enum) property.enum.push(null)
      if (property.type.includes('number')) { property.minimum = 0; property.maximum = 100 }
    }
    p.forces.properties.reasoning = RESEARCH_STRING
    p.competition.properties.reasoning = RESEARCH_STRING
    p.advantage.properties.reasoning = RESEARCH_STRING
    p.economics.properties.priceBasis.enum = ['product-pricing', 'none']
    p.economics.properties.priceBasis.description = 'Only our verified price; alternative spending is not our revenue.'
    p.forces.properties.addedValue.description = 'Subjective 0–100 judgment, not a measured effect size; null when unknown.'
    for (const key of ['monthlyPriceUsd', 'monthlyCogsUsd', 'lifetimeMonths', 'cacUsd']) p.economics.properties[key].type = ['number', 'null']
    p.people.properties.count.type = ['number', 'null']
    p.spendToday.properties.monthlyUsd.type = ['number', 'null']
    for (const key of ['tamValueUsd', 'somValueUsd']) { p[key].type = ['number', 'null']; copy.required = copy.required.filter(k => k !== key) }
    for (const key of ['people', 'spendToday']) { p[key].properties.claimId = RESEARCH_QUANTITY_REF; p[key].required = ['claimId'] }
    p.economics.required = ['priceClaimId', 'cogsClaimId', 'lifetimeClaimId', 'cacClaimId']
    for (const key of p.economics.required) p.economics.properties[key] = RESEARCH_QUANTITY_REF
    p.economics.properties.cacBasis = { type: 'string', enum: ['measured', 'benchmark', 'unknown'] }
    p.segmentRat.minItems = 0
    p.valueIdeas.minItems = 0
    for (const key of ['value', 'fears', 'competitorCounters']) { p.communication.properties[key].minItems = 0; claimRefs(p.communication.properties[key].items); p.communication.properties[key].items.properties.capabilityClaimIds = RESEARCH_STRINGS }
    claimRefs(p.valueIdeas.items)
    for (const item of [p.valueIdeas.items, ...['value', 'fears', 'competitorCounters'].map(key => p.communication.properties[key].items)]) {
      Object.assign(item.properties, { id: RESEARCH_STRING, segmentIds: RESEARCH_STRINGS, dependsOn: RESEARCH_STRINGS })
    }
    Object.assign(p.valueIdeas.items.properties, { type: { type: 'string', enum: ['feature', 'communication', 'service', 'channel'] } })
  }
  if (label === 'next-moves' || label.startsWith('repair-plan:')) {
    copy.properties.nextMoves.minItems = 1
    const item = copy.properties.nextMoves.items
    item.required.push('id', 'intent', 'failureTest', 'expectedOutcome')
    Object.assign(item.properties, { id: RESEARCH_STRING, intent: { type: 'string', enum: ['probe', 'delivery'] }, failureTest: FAILURE_TEST_SCHEMA, dependsOn: RESEARCH_STRINGS,
      expectedOutcome: { type: 'string', description: 'Concrete deliverable and decision it enables, separate from the action and failure threshold' },
      resources: { type: 'object', properties: { budgetUsd: { type: 'number', minimum: 0 }, hours: { type: 'number', minimum: 0 }, people: { type: 'number', minimum: 0 } } }, claimIds: RESEARCH_STRINGS })
  }
  if (label === 'fundamental-risks' || label === 'product-rat') copy.properties.risks.minItems = 0
  return copy
}

module.exports = { EVIDENCE_PACKET_SCHEMA, EVIDENCE_CHECK_SCHEMA, SEGMENT_REVIEW_SCHEMA, FAILURE_TEST_SCHEMA, PLAN_REVIEW_SCHEMA, LANDING_OBSERVATION_SCHEMA, enrichResearchSchema, prepareResearchSchema, RESEARCH_SCHEMA_BUDGET_BYTES }
