const fs=require('fs'),path=require('path')
const {workspaceLock,recoverPending}=require('../graph/storage')
const {validate,sourceText}=require('./schema')
const FILE='research/research-data.json'
const empty=()=>({schemaVersion:1,revision:0,factRevision:0,records:[],coverage:[],checkpoints:[]})
const canonical=v=>JSON.stringify(v && typeof v==='object' ? Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v)
function load(workspace){ const file=path.join(workspace,FILE); return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):empty() }
function apply(tx,operation) {
  if(!tx.research) {tx.research=load(tx.workspace);tx.researchBefore=canonical(tx.research)}
  if(tx.options.expectedResearchRevision!==tx.research.revision) throw new Error('Research revision conflict: expectedResearchRevision required')
  const d=tx.research
  if(operation.op==='research-put') {
    const r=JSON.parse(JSON.stringify(operation.record)),old=d.records.find(x=>x.id===r.id)
    if(old && canonical(old)!==canonical(r)) throw new Error(`Research record ${r.id} is immutable; create a new version with supersedes`)
    if(!old) d.records.push(r)
  } else if(operation.op==='research-update') {
    const r=JSON.parse(JSON.stringify(operation.record)),index=d.records.findIndex(x=>x.id===r.id),old=d.records[index]
    if(!old || old.type!==r.type || !['Study','Person','Organization','Affiliation','Session','Episode'].includes(r.type)) throw new Error('Only identity/context records can be updated; assertions and sources require a new version')
    if(!operation.reason?.trim() || !r.evidenceRefs?.length) throw new Error('Research update requires reason and provenance')
    if(canonical(old)!==canonical(r)) {d.records[index]=r;tx.warnings.push(`Research ${r.id}: ${operation.reason}; previous value retained in research-history/${d.revision}.json`)}
  } else if(operation.op==='research-provenance') {
    const entry=structuredClone(operation.provenance);const subject=d.records.find(r=>r.id===entry.recordId);if(!subject)throw new Error('Missing provenance subject');entry.valueHash||=require('./provenance').valueHash(subject,entry.fields);d.fieldProvenance||=[];const old=d.fieldProvenance.find(p=>p.id===entry.id)
    if(old&&canonical(old)!==canonical(entry))throw new Error('Field provenance is immutable; supersede it with a reason')
    if(!old)d.fieldProvenance.push(entry)
  } else if(operation.op==='research-coverage') {
    const c=structuredClone(operation.coverage),i=d.coverage.findIndex(x=>x.sourceUnitId===c.sourceUnitId)
    if(i<0)d.coverage.push(c);else d.coverage[i]=c
  } else if(operation.op==='research-checkpoint') {
    const c=structuredClone(operation.checkpoint);if(c.status==='complete')d.fieldProvenance||=[];const i=d.checkpoints.findIndex(x=>x.id===c.id)
    if(i<0)d.checkpoints.push(c);else d.checkpoints[i]=c
  } else throw new Error('Unknown research operation')
}
function prepare(tx) {
  if(!tx.research){const existing=load(tx.workspace);validate(existing,{workspace:tx.workspace,graph:tx.graph});return}
  const before=JSON.parse(tx.researchBefore)
  const individual = d => d.records.filter(r=>!['SynthesisRevision','MembershipAssertion'].includes(r.type))
  const individualProvenance = d => {const ids=new Set(individual(d).map(r=>r.id));return (d.fieldProvenance||[]).filter(p=>ids.has(p.recordId))}
  const changedFacts=canonical(individual(before))!==canonical(individual(tx.research))||canonical(individualProvenance(before))!==canonical(individualProvenance(tx.research))||canonical(before.coverage)!==canonical(tx.research.coverage)
  const factRevisionAfter=changedFacts?tx.research.revision+1:tx.research.factRevision
  validate(tx.research,{workspace:tx.workspace,graph:tx.graph,factRevisionAfter})
  if(canonical(load(tx.workspace))!==tx.researchBefore) throw new Error('Research changed outside writer')
  if(canonical(tx.research)===tx.researchBefore)return
  const old=JSON.parse(tx.researchBefore)
  tx.stageFile(`.product-os/research-history/${old.revision}.json`,JSON.stringify(old,null,2)+'\n')
  tx.research.revision++
  if(changedFacts) tx.research.factRevision=tx.research.revision
  tx.stageFile(FILE,JSON.stringify(tx.research,null,2)+'\n')
}
function snapshot(workspace,query,consume) {
 const release=workspaceLock(workspace)
 try {
  recoverPending(workspace)
  const current=load(workspace)
  const archive=query.atRevision===undefined?null:Number(query.atRevision)
  if(archive!==null && (!Number.isSafeInteger(archive)||archive<0))throw new Error('Invalid historical revision')
  const data=archive!==null&&archive!==current.revision?JSON.parse(fs.readFileSync(path.join(workspace,'.product-os','research-history',`${archive}.json`),'utf8')):current,file=path.join(workspace,'research-graph.json'),graph=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {nodes:[],edges:[]}
  if(query.expectedRevision!==undefined && Number(query.expectedRevision)!==data.revision)throw Object.assign(new Error('Research snapshot changed; reread the first page'),{status:409})
  if(query.expectedGraphRevision!==undefined && Number(query.expectedGraphRevision)!==(graph.revision||0))throw Object.assign(new Error('Graph snapshot changed; reread the first page'),{status:409})
  return consume(data,graph)
 } finally {release()}
}
function read(workspace,query={}) {
 return snapshot(workspace,query,(data,graph)=>{
  const retired=new Set(data.records.flatMap(r=>r.supersedes||[]))
  let records=data.records.filter(r=>query.history==='true'||!retired.has(r.id))
  const counts={people:records.filter(r=>r.type==='Person').length,organizations:records.filter(r=>r.type==='Organization').length,interviews:records.filter(r=>r.type==='Session'&&r.kind==='interview'&&r.status==='completed').length,scheduled:records.filter(r=>r.type==='Session'&&r.status==='scheduled').length}
  if(query.personId) {
   const ids=new Set([query.personId])
   for(const r of records) if(r.personIds?.includes(query.personId)||r.personId===query.personId||r.actor?.personId===query.personId||r.assertedBy?.personId===query.personId||r.aboutActors?.some(a=>a.personId===query.personId)||r.participants?.some(a=>a.personId===query.personId))ids.add(r.id)
   for(let i=0;i<5;i++) {
    for(const r of records) if(ids.has(r.id)) for(const id of [r.episodeId,r.jobInstanceId,r.sessionId].filter(Boolean))ids.add(id)
    for(const r of records) if([r.episodeId,r.jobInstanceId,r.subjectId,r.subject?.id,r.sessionId,r.from,r.to].some(id=>ids.has(id)))ids.add(r.id)
   }
   for(const r of records) if(ids.has(r.id) && r.organizationId) ids.add(r.organizationId)
   records=records.filter(r=>ids.has(r.id))
  }
  if(query.type)records=records.filter(r=>r.type===query.type)
  if(query.id)records=records.filter(r=>r.id===query.id)
  if(query.subjectId)records=records.filter(r=>r.subjectId===query.subjectId||r.subject?.id===query.subjectId)
  if(query.segmentId){const scope=require('./scope').segmentScope(data,query.segmentId,query.membershipStatus);records=records.filter(r=>query.type?scope.ids.has(r.id):r.type==='Person'&&scope.personIds.has(r.id))}
  const total=records.length,offset=Math.max(0,Number(query.offset)||0),limit=Math.min(200,Math.max(1,Number(query.limit)||50))
  return {schemaVersion:data.schemaVersion,quality:{checkpoints:data.checkpoints.map(c=>({id:c.id,status:c.status,scope:c.sourceRanges||c.sourceIds})),fieldProvenanceGaps:require('./provenance').gaps(data).length,unprocessedUnits:data.coverage.filter(c=>['unprocessed','source_only'].includes(c.disposition)).length},revision:data.revision,factRevision:data.factRevision,graphRevision:graph.revision||0,counts,total,offset,nextOffset:offset+limit<total?offset+limit:null,fieldProvenance:records.slice(offset,offset+limit).flatMap(r=>require('./provenance').forRecord(data,r.id)),records:records.slice(offset,offset+limit).map(r=>({...r,...r.type==='SynthesisRevision'?{stale:require('./scope').synthesisStale(data,r)}:r.type==='JobInstance'?{projection:{elements:Object.fromEntries(['situation','emotionBefore','considerationSet','trigger','expectedResult','successCriteria','higherMotivation','emotionAfter'].map(field=>{const a=data.records.filter(a=>a.type==='Assertion'&&!retired.has(a.id)&&a.subject.id===r.id&&a.subject.field===field);return [field,a.length?a.map(a=>({assertionId:a.id,state:a.state,value:a.value})): [{state:'unknown'}]]}))}}:{} })),legacyEvidenceCount:graph.nodes.filter(n=>n.type==='evidence'&&!n.data?.researchAssertionIds).length,legacyMappingState:'legacy_unmapped',legacyEvidence:query.legacy==='true'?graph.nodes.filter(n=>n.type==='evidence'&&!n.data?.researchAssertionIds).slice(offset,offset+limit).map(n=>({id:n.id,mappingState:'legacy_unmapped',priorityState:'unranked'})):[]}
 })
}
function source(workspace,id){ const release=workspaceLock(workspace);try{recoverPending(workspace);const d=load(workspace);let u=d.records.find(r=>r.id===id&&r.type==='SourceUnit');if(!u)throw new Error('Unknown SourceUnit');const original=u;let current=u;const visited=new Set([u.id]);while(true){const successors=d.records.filter(r=>r.type==='SourceUnit'&&r.supersedes?.includes(current.id));if(successors.length!==1)break;const next=successors[0];if(visited.has(next.id))throw new Error('Cyclic source-unit correction');visited.add(next.id);current=next}u=current;const s=d.records.find(r=>r.id===u.sourceId),text=sourceText(workspace,s),lines=text.split(/\r?\n/),start=Math.max(1,u.locator.startLine-3),end=Math.min(lines.length,u.locator.endLine+3);return {referencedUnitId:original.id,unit:u,document:s,context:lines.slice(start-1,end).map((text,i)=>({line:start+i,text}))}}finally{release()}}
function summary(workspace,query={}) {return snapshot(workspace,query,(data,graph)=>require('./summary').summarize(data,graph,query))}
module.exports={FILE,empty,load,apply,prepare,read,source,summary,snapshot}

// Bounded public projection; contact Assertions and the corpus never enter the map.
function projection(data) {
 const retired=new Set(data.records.flatMap(r=>r.supersedes||[])),active=data.records.filter(r=>!retired.has(r.id)),people=new Map(active.filter(r=>r.type==='Person').map(r=>[r.id,r])),segments={}
 for(const m of active.filter(r=>r.type==='MembershipAssertion'&&r.status!=='withdrawn'))if(people.has(m.personId)){segments[m.segmentId]||=new Map();segments[m.segmentId].set(m.personId,{id:m.personId,displayName:people.get(m.personId).displayName,membershipStatus:m.status})}
 const support=require('./interview-support').interviewSupport(data)
 return {revision:data.revision,segments:Object.fromEntries([...new Set([...Object.keys(segments),...Object.keys(support)])].map(id=>[id,{count:segments[id]?.size||0,people:[...(segments[id]?.values()||[])].slice(0,8),interviewSupport:support[id]||require('./interview-support').emptySupport()}]))}
}
module.exports.projection=projection
