const schema = require('./schema.json')
const fs = require('fs'), path = require('path'), crypto = require('crypto')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const fail = message => { throw new Error(`Research: ${message}`) }
function check(value, rule, at = '$') {
  if (rule.$ref) return check(value, schema.$defs[rule.$ref.split('/').pop()], at)
  if (rule.oneOf && value?.type && schema.$defs[value.type] && rule.oneOf.some(r=>r.$ref===`#/$defs/${value.type}`)) return check(value,schema.$defs[value.type],at)
  if (rule.oneOf) {
    const matches = rule.oneOf.filter(r => { try { check(value, r, at); return true } catch { return false } })
    if (matches.length !== 1) fail(`${at}: expected one registered record type with required fields`)
  }
  if (rule.const !== undefined && value !== rule.const) fail(`${at}: expected ${rule.const}`)
  if (rule.enum && !rule.enum.includes(value)) fail(`${at}: unsupported value ${value}`)
  if (rule.type) {
    const valid = rule.type === 'array' ? Array.isArray(value) : rule.type === 'object' ? value && typeof value === 'object' && !Array.isArray(value) : rule.type === 'integer' ? Number.isInteger(value) : typeof value === rule.type
    if (!valid) fail(`${at}: expected ${rule.type}`)
  }
  if (typeof value === 'number' && (!Number.isFinite(value) || rule.minimum !== undefined && value < rule.minimum)) fail(`${at}: invalid number`)
  if (typeof value === 'string' && (rule.minLength && value.length < rule.minLength || rule.pattern && !new RegExp(rule.pattern).test(value))) fail(`${at}: invalid string`)
  if (rule.type === 'array') value.forEach((v, i) => check(v, rule.items, `${at}[${i}]`))
  if (rule.type === 'object') {
    for (const key of rule.required || []) if (!Object.hasOwn(value, key)) fail(`${at}.${key}: required`)
    for (const [key, v] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail(`${at}: unsafe key`)
      const r = rule.properties?.[key]
      if (r) check(v, r, `${at}.${key}`)
      else if (rule.additionalProperties === false) fail(`${at}.${key}: unregistered field`)
      else if (typeof rule.additionalProperties === 'object') check(v, rule.additionalProperties, `${at}.${key}`)
    }
  }
}
function sourceText(workspace, source) {
  if (!/^sources\//.test(source.path) || source.path.includes('\\') || source.path.split('/').some(p => p === '..' || p === '.')) fail('source must be inside sources/')
  const root = fs.realpathSync(path.join(workspace, 'sources'))
  const file = fs.realpathSync(path.join(workspace, source.path))
  if (!file.startsWith(root + path.sep)) fail('source escapes workspace')
  const bytes = fs.readFileSync(file)
  if (hash(bytes) !== source.sha256) fail(`source hash changed: ${source.id}; register an immutable new version`)
  return bytes.toString('utf8')
}
const refTypes = { studyId:'Study',personId:'Person',personIds:'Person',organizationId:'Organization',sessionId:'Session',sessionIds:'Session',ownerSessionIds:'Session',sourceId:'SourceDocument',sourceIds:'SourceDocument',frameSourceIds:'SourceDocument',sourceUnitId:'SourceUnit',questionUnitId:'SourceUnit',parentUnitId:'SourceUnit',episodeId:'Episode',jobInstanceId:'JobInstance',jobInstanceIds:'JobInstance',criterionObservationIds:'CriterionObservation',alternativeId:'Alternative',choiceEventId:'ChoiceEvent',stimulusId:'Stimulus',respondsToObservationId:'UXObservation',assertionIds:'Assertion',derivedFromAssertionIds:'Assertion',conflictGroupId:'Conflict',synthesisRevisionId:'SynthesisRevision' }
function validate(data, {workspace, graph, factRevisionAfter} = {}) {
  check(data, schema)
  const by = new Map(), sources = new Map()
  for (const r of data.records) { if (by.has(r.id)) fail(`duplicate id ${r.id}`); by.set(r.id,r) }
  const ref = (id, type) => { const r = by.get(id); if (!r || type && r.type !== type) fail(`invalid reference ${id} (expected ${type || 'record'})`); return r }
  const unitSuccessors=new Map();for(const r of data.records.filter(r=>r.type==='SourceUnit'))for(const id of r.supersedes||[]){if(!unitSuccessors.has(id))unitSuccessors.set(id,[]);unitSuccessors.get(id).push(r)}
  const effectiveUnit=unit=>{const seen=new Set();while(unitSuccessors.get(unit.id)?.length===1&&!seen.has(unit.id)){seen.add(unit.id);unit=unitSuccessors.get(unit.id)[0]}return unit}
  const sessionsFor=(record,seen=new Set())=>{if(!record||seen.has(record.id))return [];seen.add(record.id);if(record.type==='Session')return [record.id];if(record.type==='Episode')return record.sessionIds;return [...record.sessionId?[record.sessionId]:[],...['episodeId','jobInstanceId','subjectId'].flatMap(k=>record[k]?sessionsFor(by.get(record[k]),seen):[])]}
  const checkOwnership=(record,unit)=>{const sessions=sessionsFor(record),actual=effectiveUnit(unit);if(sessions.length&&actual.sessionIds?.length&&!sessions.some(id=>actual.sessionIds.includes(id)))fail(`${record.id}: source unit case ownership mismatch`)}

  function refs(value, key) {
    if (refTypes[key]) { for (const id of Array.isArray(value) ? value : [value]) ref(id, refTypes[key]); return }
    if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) refs(v,k)
  }
  for (const r of data.records) {
    // Typed values are payload, not identifiers. References there must be explicit Assertions.
    for (const [k,v] of Object.entries(r)) if (!['value','amount','threshold'].includes(k)) refs(v,k)
    for (const id of r.supersedes || []) {
      const previous = ref(id,r.type)
      if (id === r.id || !r.correctionReason) fail(`${r.id}: correction needs previous version and reason`)
      const visit = (record, seen = new Set()) => { if (record.id === r.id || seen.has(record.id)) fail('cyclic correction'); seen.add(record.id); for (const id of record.supersedes || []) visit(ref(id),new Set(seen)) }
      visit(previous)
    }
    if(r.type === 'SynthesisRevision' && r.researchRevision > (factRevisionAfter??data.factRevision)) fail('synthesis references future research')
    if(r.type === 'DiscoveryEvent') {
      if(r.alternativeId && ref(r.alternativeId,'Alternative').episodeId!==r.episodeId)fail('discovery alternative crosses episode scope')
      if(r.choiceEventId) {
        const choice=ref(r.choiceEventId,'ChoiceEvent')
        if(choice.episodeId!==r.episodeId || !r.alternativeId || choice.alternativeId!==r.alternativeId)fail('discovery choice link needs the same episode and alternative')
      }
      if(r.productId && graph && !graph.nodes.some(n=>n.id===r.productId&&n.type==='product'))fail('unknown discovery product')
      if(['purchase','repeat_purchase'].includes(r.stage) && !r.productId && !r.alternativeId)fail('purchase discovery stage needs an explicit solution reference')
    }
    if(r.type === 'SynthesisRevision' && r.topicFindings) {
      const findingIds=new Set()
      for(const finding of r.topicFindings) {
        if(findingIds.has(finding.id))fail('duplicate topic finding id')
        findingIds.add(finding.id)
        if(!r.segmentIds.includes(finding.segmentId))fail('topic finding outside synthesis segment scope')
        if(graph && !graph.nodes.some(n=>n.id===finding.productId&&n.type==='product'))fail('unknown topic finding product')
        if(!finding.supportingRecordIds.length)fail('topic finding needs supporting record versions')
        const episodeFor=(record,seen=new Set())=>{if(!record||seen.has(record.id))return null;seen.add(record.id);if(record.type==='Episode')return record.id;if(record.episodeId)return record.episodeId;return episodeFor(by.get(record.jobInstanceId||record.subjectId||record.subject?.id),seen)}
        for(const [key,cases] of [['supportingRecordIds',r.supportingCaseIds],['contradictingRecordIds',r.contradictingCaseIds]])for(const id of finding[key]) {
          const record=ref(id),episodeId=episodeFor(record)
          if(!episodeId||!cases.includes(episodeId))fail('topic finding basis outside declared case scope')
          if(r.researchRevision===(factRevisionAfter??data.factRevision)&&data.records.some(next=>next.supersedes?.includes(id)))fail('current topic finding references a superseded basis')
        }
      }
    }
    if (r.type === 'SourceDocument') {
      if (workspace) sources.set(r.id, sourceText(workspace,r))
      for (const id of [...r.derivedFrom || [],...r.supplements || []]) ref(id,'SourceDocument')
      if (data.records.some(x => x.id !== r.id && x.type === 'SourceDocument' && x.path === r.path && x.sha256 !== r.sha256)) fail('source versions need separate immutable paths')
    }
    if (r.type === 'Assertion') {
      ref(r.subject.id,r.subject.type)
      if(!require('./fields')[r.subject.type]?.split(' ').includes(r.subject.field)&&!(r.subject.type==='Episode'&&/^context\.[a-z][a-z0-9_]{0,63}$/.test(r.subject.field))) fail(`${r.id}: unregistered assertion field ${r.subject.field}`)
      if (r.state === 'known' && !Object.hasOwn(r,'value')) fail(`${r.id}: known assertion needs value (including false or 0)`)
      if (['unknown','not_asked','asked_unanswered','not_applicable'].includes(r.state)&&Object.hasOwn(r,'value'))fail('unanswered/unknown assertion cannot carry an established value; keep original wording in raw')
      if(r.subject.field.startsWith('context.')&&(r.subject.type!=='Episode'||r.episodeId!==r.subject.id))fail('context parameter must belong to its own episode')
      if (!r.evidenceRefs.length) fail(`${r.id}: assertion needs evidence`)
    }
    if (r.type === 'JobRelation') { ref(r.from,'JobInstance'); ref(r.to,'JobInstance'); if(r.from===r.to) fail('self job relation') }
    if (r.subjectId) ref(r.subjectId)
    for (const id of [...r.supportingCaseIds || [],...r.contradictingCaseIds || []]) ref(id,'Episode')
    for (const id of [r.segmentId,...r.segmentIds || []].filter(Boolean)) if (graph && !graph.nodes.some(n=>n.id===id && n.type==='segment')) fail(`unknown synthesis segment ${id}`)
    if (r.type === 'CriterionObservation') {
      if (['ranked','tied'].includes(r.priority.kind) && !r.priority.rank) fail('rank required')
      if (r.priority.kind === 'tied' && !r.priority.tieGroup) fail('tieGroup required')
      if (r.priority.kind === 'unranked' && r.priority.rank !== undefined) fail('unranked cannot have rank')
      for (const pair of r.priority.pairwiseComparisons || []) ref(pair.criterionId,'CriterionObservation')
    }
    if (r.type === 'Assessment' && r.state === 'known' && (r.value == null || r.value < r.scale.min || r.value > r.scale.max)) fail('assessment outside scale')
    if (r.type === 'UXObservation' && r.orderState === 'known' && r.order == null) fail('known UX order requires order')
    if(r.type === 'Conflict' && r.assertionIds.length < 2) fail('conflict requires both assertions')
    function actors(v) { if (!v || typeof v !== 'object') return; if (v.kind==='person' && !v.personId) fail('person ActorRef requires personId'); for(const child of Object.values(v)) actors(child) }
    actors(r)
  }
  for (const r of data.records) {
    if (r.type === 'SourceUnit') {
      for (const id of [r.questionUnitId,r.parentUnitId].filter(Boolean)) {
        const target=ref(id,'SourceUnit');if(target.sourceId!==r.sourceId)fail('question context crosses source ownership');
        const visit=(unit,seen=new Set())=>{if(unit.id===r.id||seen.has(unit.id))fail('cyclic question context');seen.add(unit.id);for(const id of [unit.questionUnitId,unit.parentUnitId].filter(Boolean))visit(ref(id,'SourceUnit'),new Set(seen))};visit(target);
      }
      for(const id of r.supersedes||[]) {const previous=ref(id,'SourceUnit');if(previous.sourceId!==r.sourceId||previous.raw!==r.raw||JSON.stringify(previous.locator)!==JSON.stringify(r.locator))fail('source descriptor correction must preserve exact fragment')}
      if(r.locator.endLine<r.locator.startLine) fail('reversed locator')
      if(r.locator.startChar!==undefined || r.locator.endChar!==undefined) {if(r.locator.startLine!==r.locator.endLine || !Number.isInteger(r.locator.startChar) || !Number.isInteger(r.locator.endChar) || r.locator.endChar<=r.locator.startChar)fail('invalid subfragment character range')}
      if(workspace) {
        const lines=sources.get(r.sourceId).split(/\r?\n/)
        const located=lines.slice(r.locator.startLine-1,r.locator.endLine).join('\n')
        const expected=r.locator.startChar===undefined?located:located.slice(r.locator.startChar,r.locator.endChar)
        if(r.locator.endLine>lines.length || r.locator.endChar!==undefined&&r.locator.endChar>located.length || expected!==r.raw) fail(`${r.id}: raw differs from exact source lines`)
      }
    }
    for(const e of r.evidenceRefs || []) { const u=ref(e.sourceUnitId,'SourceUnit');checkOwnership(r,u); if(!u.raw.includes(e.quote)) fail(`${r.id}: quote not present in SourceUnit`)
      if(r.sessionId && u.sessionIds?.length && !u.sessionIds.includes(r.sessionId))fail(`${r.id}: source unit ownership mismatch`)
      if(r.sessionId && !ref(u.sourceId,'SourceDocument').ownerSessionIds.includes(r.sessionId)) fail(`${r.id}: source ownership mismatch`)
    }
    if(!['SourceDocument','SourceUnit'].includes(r.type) && !r.evidenceRefs.length) fail(`${r.id}: provenance required`)
  }
  if(graph)for(const n of graph.nodes)for(const id of n.data?.researchAssertionIds || [])ref(id,'Assertion')
  const provenanceBy=new Map(),fieldOwners=new Set(),retiredProvenance=new Set((data.fieldProvenance||[]).flatMap(p=>p.supersedes||[]))
  for(const p of data.fieldProvenance||[]) {
    if(provenanceBy.has(p.id)||by.has(p.id))fail('duplicate field provenance id');provenanceBy.set(p.id,p)
    const record=ref(p.recordId),allowed=require('./provenance').fields(record)
    if(!p.fields.length||new Set(p.fields).size!==p.fields.length||p.fields.some(f=>!allowed.includes(f)))fail('unregistered provenance field')
    if(!p.evidenceRefs.length)fail('field provenance requires exact evidence')
    for(const e of p.evidenceRefs){const u=ref(e.sourceUnitId,'SourceUnit');checkOwnership(record,u);if(!u.raw.includes(e.quote))fail('field provenance quote not present in SourceUnit');if(record.sessionId&&!ref(u.sourceId,'SourceDocument').ownerSessionIds.includes(record.sessionId))fail('field provenance source ownership mismatch')}
    refs(p.assertedBy);refs(p.aboutActors)
    if(p.assertedBy.kind==='person'&&!p.assertedBy.personId)fail('provenance person actor needs personId')
    if(!retiredProvenance.has(p.id))for(const f of p.fields){const key=p.recordId+':'+f;if(fieldOwners.has(key))fail('overlapping current field provenance');fieldOwners.add(key)}
  }
  for(const p of data.fieldProvenance||[])for(const id of p.supersedes||[]){const old=provenanceBy.get(id);if(!old||old.recordId!==p.recordId||!p.correctionReason)fail('invalid provenance correction');const visit=(entry,seen=new Set())=>{if(entry.id===p.id||seen.has(entry.id))fail('cyclic provenance correction');seen.add(entry.id);for(const id of entry.supersedes||[]){const next=provenanceBy.get(id);if(!next)fail('missing provenance history');visit(next,new Set(seen))}};visit(old)}
  const provenanceGaps=[...require('./provenance').gaps(data),...require('./provenance').active(data.fieldProvenance).filter(p=>p.mapping!=='reviewed').map(p=>({recordId:p.recordId,fields:p.fields}))]
  const covered=new Set()
  for(const c of data.coverage) {
    ref(c.sourceUnitId,'SourceUnit'); if(covered.has(c.sourceUnitId)) fail('duplicate coverage unit'); covered.add(c.sourceUnitId)
    for(const id of c.recordIds) ref(id)
    if(['mapped','duplicate','explicit_negative','conflict'].includes(c.disposition) && !c.recordIds.length) fail('coverage requires concrete recordIds')
    if(c.disposition==='mapped' && c.recordIds.some(id=>['SourceDocument','SourceUnit'].includes(ref(id).type))) fail('source-only mapping is not extraction')
    for(const id of c.recordIds) if(!ref(id).evidenceRefs?.some(e=>e.sourceUnitId===c.sourceUnitId) && c.disposition!=='duplicate') fail(`coverage record ${id} does not cite unit ${c.sourceUnitId}`)
  }
  for(const cp of data.checkpoints) {
    for(const id of cp.sourceIds) ref(id,'SourceDocument')
    if(cp.status!=='complete') continue
    if(!cp.semanticReview || cp.semanticReview.method!=='second_content_pass') fail('complete requires independent second content pass')
    for(const id of cp.sourceIds) {
      if(cp.semanticReview.sourceHashes[id]!==ref(id).sha256) fail('semantic review hash mismatch')
      const ranges=cp.sourceRanges?.filter(r=>r.sourceId===id)
      if(cp.sourceRanges && !ranges?.length)fail('checkpoint source missing scope range')
      const inRange=line=>!ranges || ranges.some(r=>r.startLine<=line&&r.endLine>=line)
      const units=data.records.filter(r=>r.type==='SourceUnit' && r.sourceId===id && inRange(r.locator.startLine))
      if(!units.length) fail('complete source has no units')
      if(workspace) {
        const lines=sources.get(id).split(/\r?\n/)
        lines.forEach((line,i)=>{if(line.trim() && inRange(i+1) && !units.some(u=>u.locator.startLine<=i+1 && u.locator.endLine>=i+1)) fail(`uncovered source line ${id}:${i+1}`)})
      }
      if(data.fieldProvenance){const scoped=new Set(units.map(u=>u.id));for(const gap of provenanceGaps)if(ref(gap.recordId).evidenceRefs?.some(e=>scoped.has(e.sourceUnitId)))fail(`field provenance incomplete: ${gap.recordId}: ${gap.fields.join(', ')}`)}
      for(const u of units) { const c=data.coverage.find(c=>c.sourceUnitId===u.id); if(!c || ['source_only','unprocessed'].includes(c.disposition)) fail('incomplete coverage blocks complete') }
    }
  }
  for(const synthesis of data.records.filter(r=>r.type==='SynthesisRevision'&&r.status!=='withdrawn'&&r.researchRevision===(factRevisionAfter??data.factRevision))) {
    if(!synthesis.supportingCaseIds.length)fail('current synthesis needs supporting individual cases')
    const ids=new Set([...synthesis.supportingCaseIds,...synthesis.contradictingCaseIds]);
    for(let i=0;i<4;i++)for(const r of data.records)if([r.episodeId,r.jobInstanceId,r.subjectId,r.subject?.id].some(id=>ids.has(id)))ids.add(r.id)
    ids.add(synthesis.id)
    for(const gap of provenanceGaps)if(ids.has(gap.recordId))fail('current synthesis requires reviewed field provenance: '+gap.recordId)
    for(const id of [...synthesis.supportingCaseIds,...synthesis.contradictingCaseIds]){const record=ref(id,'Episode');const evidenceUnits=record.evidenceRefs.map(e=>ref(e.sourceUnitId,'SourceUnit'));if(!data.checkpoints.some(cp=>cp.status==='complete'&&evidenceUnits.some(u=>cp.sourceIds.includes(u.sourceId)&&(!cp.sourceRanges||cp.sourceRanges.some(range=>range.sourceId===u.sourceId&&range.startLine<=u.locator.startLine&&range.endLine>=u.locator.endLine)))))fail('current synthesis requires a completed individual content review: '+id)}
  }
  return data
}
module.exports={schema,check,validate,hash,sourceText}
