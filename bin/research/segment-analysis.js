// Deterministic, episode-scoped cohort reading. No prose inference and no writes.
const {synthesisStale}=require('./scope')
const UNKNOWN='__unknown'
const fail=message=>{throw Object.assign(new Error(message),{status:400})}
const current=data=>{const retired=new Set(data.records.flatMap(x=>x.supersedes||[]));return data.records.filter(r=>!retired.has(r.id))}
function configuration(graph,id){
 const by=new Map(graph.nodes.map(n=>[n.id,n])),segment=by.get(id)
 if(segment?.type!=='segment')throw Object.assign(new Error('Сегмент не найден'),{status:404})
 const base=segment.data?.cohortView?by.get(segment.data.cohortView.baseSegmentId):segment
 if(base?.type!=='segment'||base.data?.cohortView)fail('Основание подсегмента недоступно')
 let owner=base;const seen=new Set()
 while(!owner.data?.analysisParameters&& !seen.has(owner.id)){seen.add(owner.id);const parent=graph.edges.find(e=>e.type==='sub_segment_of'&&e.from===owner.id);if(!parent||!by.has(parent.to))break;owner=by.get(parent.to)}
 const parameters=owner.data?.analysisParameters||[]
 return {segment,base,parameters,familyLabels:owner.data?.criterionFamilyLabels||{},savedFilters:segment.data?.cohortView?.filters||{}}
}
function normalizeFilters(input,parameters){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Некорректные параметры отбора')
 const result={}
 for(const key of Object.keys(input).sort()){
  const def=parameters.find(p=>p.id===key);if(!def)fail('Неизвестный параметр: '+key)
  const value=input[key];if(value==null)continue
  if(def.kind==='number'){
   if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['min','max','unknown'].includes(k)))fail('Некорректный диапазон')
   if(value.unknown===true){if(value.min!=null||value.max!=null)fail('Выберите диапазон или отсутствие данных');result[key]={unknown:true};continue}
   const range={};for(const k of ['min','max'])if(value[k]!=null&&value[k]!==''){if(typeof value[k]!=='number'||!Number.isFinite(value[k])||value[k]<0)fail('Нужен неотрицательный числовой диапазон');range[k]=value[k]}
   if(range.min!=null&&range.max!=null&&range.min>range.max)fail('Нижняя граница больше верхней')
   if(Object.keys(range).length)result[key]=range
  }else{
   if(!Array.isArray(value)||value.some(v=>typeof v!=='string'||(v!==UNKNOWN&&!def.values?.some(o=>o.id===v))))fail('Неизвестное значение параметра')
   if(value.length)result[key]=[...new Set(value)].sort()
  }
 }
 return result
}
function build(data,graph,segmentId){
 const cfg=configuration(graph,segmentId),records=current(data),by=new Map(records.map(r=>[r.id,r])),nodes=new Map(graph.nodes.map(n=>[n.id,n]))
 const scope=new Set([cfg.base.id]);let changed=true
 while(changed){changed=false;for(const e of graph.edges)if(e.type==='sub_segment_of'&&scope.has(e.to)&&!scope.has(e.from)&&!nodes.get(e.from)?.data?.cohortView){scope.add(e.from);changed=true}}
 for(const id of [...scope])if(nodes.get(id)?.data?.researchSegmentId)scope.add(nodes.get(id).data.researchSegmentId)
 const memberships=records.filter(r=>r.type==='MembershipAssertion'&&scope.has(r.segmentId)&&['candidate','supported'].includes(r.status))
 const episodes=new Set(memberships.map(m=>m.episodeId)),groups=[]
 for(const syn of records.filter(r=>r.type==='SynthesisRevision'&&r.segmentIds?.some(id=>scope.has(id)))){
  const linked=syn.segmentIds.filter(id=>scope.has(id)),segment=graph.nodes.find(n=>n.type==='segment'&&linked.some(id=>id===n.id||id===n.data?.researchSegmentId))
  if(!segment)continue
  const jobEdges=graph.edges.filter(e=>e.type==='performs'&&e.from===segment.id)
  // A legacy synthesis with several core jobs does not identify which instances belong
  // to which core job. Keep those instances separate instead of copying them to each.
  const instances=(syn.jobInstanceIds||[]).map(id=>by.get(id)).filter(j=>j?.type==='JobInstance'&&episodes.has(j.episodeId))
  const candidates=jobEdges.length===1?[{id:jobEdges[0].to,label:nodes.get(jobEdges[0].to)?.label||segment.label,instances}]:instances.map(j=>({id:j.id,label:j.normalizedOutcome||j.rawOutcome,instances:[j]}))
  for(const candidate of candidates){
   const allowed=new Set(memberships.filter(m=>linked.includes(m.segmentId)).map(m=>m.episodeId))
   const jobs=candidate.instances.filter(j=>allowed.has(j.episodeId)),jobIds=new Set(jobs.map(j=>j.id))
   const criteria=(syn.criterionObservationIds||[]).map(id=>by.get(id)).filter(c=>c?.type==='CriterionObservation'&&jobIds.has(c.jobInstanceId))
   const id=segment.id+':'+candidate.id,existing=groups.find(g=>g.id===id)
   if(existing){existing.jobs=[...new Map([...existing.jobs,...jobs].map(j=>[j.id,j])).values()];existing.criteria=[...new Map([...existing.criteria,...criteria].map(c=>[c.id,c])).values()];existing.stale||=synthesisStale(data,syn)}
   else groups.push({id,label:candidate.label,segmentId:segment.id,jobs,criteria,stale:synthesisStale(data,syn)})
  }
 }
 const parameters=[...cfg.parameters]
 if(groups.length)parameters.push({id:'job',label:'Задачи',kind:'set',values:groups.map(g=>({id:g.id,label:g.label}))})
 const cases=[...episodes].map(id=>{
  const episode=by.get(id),people=(episode?.personIds||[]).map(id=>by.get(id)).filter(p=>p?.type==='Person'),sessions=(episode?.sessionIds||[]).map(id=>by.get(id)).filter(Boolean)
  const kind=['case_story','written_case_story_self_report'].includes(episode?.kind)?'case_story':new Set(sessions.map(s=>s.kind)).size===1?sessions[0].kind:'unknown'
  const assertions=records.filter(r=>r.type==='Assertion'&&r.subject?.type==='Episode'&&r.subject.id===id&&(!r.episodeId||r.episodeId===id))
  const attributes={}
  for(const p of parameters){
   if(p.id==='job'){const values=groups.filter(g=>g.jobs.some(j=>j.episodeId===id)).map(g=>g.id);attributes[p.id]={state:values.length?'known':'unknown',values,evidence:[]};continue}
   const observations=assertions.filter(a=>a.subject.field===p.field),known=observations.filter(a=>a.state==='known'&&a.evidenceRefs?.length&&a.verification!=='unresolved')
   const uncertain=observations.some(a=>['conflicting','ambiguous'].includes(a.state))
   const values=[...new Set(known.flatMap(a=>Array.isArray(a.value)?a.value:[a.value]))].filter(v=>p.kind==='number'?typeof v==='number'&&Number.isFinite(v):p.values?.some(o=>o.id===v))
   const conflict=uncertain||(p.kind==='number'&&values.length>1)
   attributes[p.id]={state:conflict?'conflicting':values.length?'known':'unknown',values:conflict?[]:values,evidence:observations.map(a=>({id:a.id,state:a.state,value:a.value,raw:a.raw,basis:a.basis,elicitation:a.elicitation,verification:a.verification,evidenceRefs:a.evidenceRefs}))}
  }
  return {id,people:people.map(p=>({id:p.id,label:p.displayName})),kind,attributes}
 })
 return {...cfg,records,by,parameters,cases,groups}
}
function matches(row,filters){return Object.entries(filters).every(([key,filter])=>{
 const a=row.attributes[key]||{state:'unknown',values:[]},known=a.state==='known'
 if(Array.isArray(filter))return filter.some(v=>v===UNKNOWN?!known:known&&a.values.includes(v))
 if(filter.unknown)return !known
 return known&&a.values.some(v=>(filter.min==null||v>=filter.min)&&(filter.max==null||v<=filter.max))
})}
function coverage(cases,parameters){return parameters.map(p=>({...p,known:cases.filter(c=>c.attributes[p.id]?.state==='known').length,unknown:cases.filter(c=>c.attributes[p.id]?.state!=='known').length,conflicting:cases.filter(c=>c.attributes[p.id]?.state==='conflicting').length,total:cases.length,values:(p.values||[]).map(v=>({...v,count:cases.filter(c=>c.attributes[p.id]?.state==='known'&&c.attributes[p.id].values.includes(v.id)).length}))}))}
function aggregate(model,filters){
 const cases=model.cases.filter(c=>matches(c,filters)),ids=new Set(cases.map(c=>c.id)),people=new Set(cases.flatMap(c=>c.people.map(p=>p.id))),kinds={}
 cases.forEach(c=>kinds[c.kind]=(kinds[c.kind]||0)+1)
 const groups=model.groups.map(g=>{
  const jobs=g.jobs.filter(j=>ids.has(j.episodeId)),jobIds=new Set(jobs.map(j=>j.id)),episodeIds=new Set(jobs.map(j=>j.episodeId)),criteria=new Map()
  for(const c of g.criteria.filter(c=>jobIds.has(c.jobInstanceId))){
   const keys=(c.families||[]).filter(f=>model.familyLabels[f]);if(!keys.length)keys.push('record:'+c.id)
   for(const key of keys){
    if(!criteria.has(key))criteria.set(key,{id:key,label:model.familyLabels[key]||c.normalized||c.raw,observations:[]})
    const ep=model.by.get(c.jobInstanceId)?.episodeId,row=cases.find(r=>r.id===ep)
    criteria.get(key).observations.push({...c,episodeId:ep,people:row?.people||[],kind:row?.kind})
   }
  }
  const rows=[...criteria.values()].map(c=>{
   const eligible=c.observations.filter(o=>!['explicit_negative','unknown','not_asked','asked_unanswered','ambiguous','conflicting'].includes(o.stance))
   const counted=list=>new Set(list.map(o=>o.episodeId)).size
   return {...c,count:counted(eligible),negativeCount:counted(c.observations.filter(o=>o.stance==='explicit_negative')),conflictCount:counted(c.observations.filter(o=>o.stance==='conflicting')),promptedCount:counted(eligible.filter(o=>o.stance==='prompted')),primaryCount:counted(eligible.filter(o=>o.priority?.kind==='ranked'&&o.priority.rank===1)),codedPrimaryCount:counted(eligible.filter(o=>o.priorityTier==='primary'&&!(o.priority?.kind==='ranked'&&o.priority.rank===1))),requiredCount:counted(eligible.filter(o=>o.requirement==='must_have')),rankedCount:counted(eligible.filter(o=>['ranked','tied','partial_order'].includes(o.priority?.kind))),total:episodeIds.size}
  })
  return {id:g.id,label:g.label,segmentId:g.segmentId,count:episodeIds.size,denominator:cases.length,criteriaCoverage:new Set(rows.flatMap(c=>c.observations.map(o=>o.episodeId))).size,stale:g.stale,criteria:rows}
 })
 const mapped=new Set(model.groups.flatMap(g=>g.jobs.map(j=>j.episodeId)))
 return {filters,materialCount:cases.length,dossierCount:people.size,uniquePeopleKnown:false,kinds,unknownJobs:cases.filter(c=>!mapped.has(c.id)).length,cases,parameters:coverage(cases,model.parameters),jobs:groups}
}
function summarize(data,graph,query){
 const model=build(data,graph,query.segmentId),parse=(value,fallback)=>{if(value===undefined)return fallback;try{return typeof value==='string'?JSON.parse(value):value}catch{fail('Некорректные параметры отбора')}}
 const filters=normalizeFilters(parse(query.filters,model.savedFilters),model.parameters),compareFilters=query.compare===undefined?{}:normalizeFilters(parse(query.compare,{}),model.parameters)
 const selected=aggregate(model,filters),comparison=aggregate(model,compareFilters)
 if(query.evidence){const [jobId,criterionId]=parse(query.evidence,[]);return {revision:data.revision,graphRevision:graph.revision,observations:selected.jobs.find(j=>j.id===jobId)?.criteria.find(c=>c.id===criterionId)?.observations||[]}}
 const compact=c=>({...c,jobs:c.jobs.map(j=>({...j,criteria:j.criteria.map(({observations,...rest})=>({...rest,observationCount:observations.length}))}))})
 return {segmentId:query.segmentId,baseSegmentId:model.base.id,baseLabel:model.base.label,baseMaterialCount:model.cases.length,registryMaterialCount:model.records.filter(r=>r.type==='Episode').length,revision:data.revision,factRevision:data.factRevision,graphRevision:graph.revision||0,parameters:coverage(model.cases,model.parameters),selected:compact(selected),comparison:compact(comparison),overlapMaterialCount:selected.cases.filter(c=>comparison.cases.some(other=>other.id===c.id)).length,savedFilters:model.savedFilters,stale:model.groups.some(g=>g.stale),configured:model.parameters.length>0}
}
module.exports={UNKNOWN,current,configuration,normalizeFilters,build,matches,aggregate,summarize}
