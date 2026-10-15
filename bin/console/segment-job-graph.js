// Read-only graph projection. A case is an Episode, never every job of a Person.
const {current, build, aggregate, normalizeFilters}=require('../research/segment-analysis')
const {jobsForSegment}=require('./galaxy-model')
const {evidenceResolver}=require('./evidence')
const TYPES=new Set(['in_order_to','part_of','precedes','depends_on','conditional'])
const levels=new Set(['big','core','small','micro'])
const titles={situation:'Когда',emotionBefore:'Эмоции до',considerationSet:'Рассматриваемые способы',trigger:'Триггер',expectedResult:'Ожидаемый результат',higherMotivation:'Зачем',emotionAfter:'Эмоции после',productBoundary:'Граница решения'}
const text=value=>typeof value==='string'?value:Array.isArray(value)?value.map(text).filter(Boolean).join('; '):value&&typeof value==='object'?text(value.text||value.statement||value.raw||value.description):''
function segmentJobGraph(data,graph,segmentId){
 const model=build(data,graph,segmentId),selected=aggregate(model,normalizeFilters(model.savedFilters,model.parameters))
 const records=current(data),by=new Map(records.map(r=>[r.id,r]))
 const scope=new Set([model.base.id]);let expanded=true
 while(expanded){expanded=false;for(const e of graph.edges)if(e.type==='sub_segment_of'&&scope.has(e.to)&&!scope.has(e.from)&&!graph.nodes.find(n=>n.id===e.from)?.data?.cohortView){scope.add(e.from);expanded=true}}
 for(const id of [...scope]){const alias=graph.nodes.find(n=>n.id===id)?.data?.researchSegmentId;if(alias)scope.add(alias)}
 const nodes=graph.nodes.filter(n=>n.status!=='dropped'&&!n.data?.retired&&!n.data?.excludedFromWorkingInputs),nodeBy=new Map(nodes.map(n=>[n.id,n]))
 const active=e=>e.status!=='dropped'&&!e.data?.supersededAt&&nodeBy.has(e.from)&&nodeBy.has(e.to)
 const edges=graph.edges.filter(active),seeds=jobsForSegment(segmentId,nodes,edges),ids=new Set(seeds.map(j=>j.id))
 const foreign=new Set(edges.filter(e=>e.type==='performs'&&e.from!==segmentId&&!ids.has(e.to)).map(e=>e.to))
 const links=edges.filter(e=>TYPES.has(e.type)&&nodeBy.get(e.from)?.type==='job'&&nodeBy.get(e.to)?.type==='job'&&(!e.data?.segmentId||e.data.segmentId===segmentId))
 let changed=true
 while(changed){changed=false;for(const e of links)for(const [a,b]of [[e.from,e.to],[e.to,e.from]])if(ids.has(a)&&!ids.has(b)&&!foreign.has(b)){ids.add(b);changed=true}}
 const resolver=evidenceResolver(nodes,edges)
 const commonJobs=[...ids].map(id=>{
  const n=nodeBy.get(id),seed=seeds.find(j=>j.id===id)
  const performs=edges.find(e=>e.type==='performs'&&e.from===segmentId&&e.to===id)
  const criteria=seed?.criteria?.map(c=>({...c,priority:performs?.data?.criteria?.find(ref=>ref.id===c.id)?.priority}))||edges.filter(e=>e.type==='judged_by'&&e.from===id).map(e=>({...nodeBy.get(e.to),...resolver.forDatum(nodeBy.get(e.to),{segmentId})}))
  return {...n,...seed,level:levels.has(n.data?.level)?n.data.level:null,context:seed?.context||n.data?.context||'',contextRecord:resolver.forDatum(performs||n,{segmentId}),criteria,...resolver.forDatum(n,{segmentId})}
 })
 const common={id:'segment',label:'Общий граф сегмента',scope:'segment',jobs:commonJobs,relations:links.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>({...e,kind:e.type,evidence:[...resolver.forDatum(e, {segmentId}).evidence]}))}
 const cases=selected.cases.map(c=>{
  const episode=by.get(c.id),jobs=records.filter(r=>r.type==='JobInstance'&&r.episodeId===c.id),jobIds=new Set(jobs.map(j=>j.id))
  const members=model.records.filter(r=>r.type==='MembershipAssertion'&&r.episodeId===c.id&&scope.has(r.segmentId)&&['candidate','supported'].includes(r.status))
  return {id:c.id,label:c.people.map(p=>p.label).join(', ')||'Кейс без имени',scope:'person',people:c.people,kind:c.kind,membershipStatus:members.some(m=>m.status==='candidate')?'candidate':'supported',
   jobs:jobs.map(j=>({...j,level:null,detailHref:'#person/'+encodeURIComponent(c.people[0]?.id||'')+'/job/'+encodeURIComponent(j.id)+'/context',
    criteria:records.filter(r=>r.type==='CriterionObservation'&&r.jobInstanceId===j.id),
    previewFields:records.filter(r=>r.type==='Assertion'&&r.subject?.id===j.id&&r.state==='known'&&titles[r.subject.field]&&text(r.value)).map(a=>({title:titles[a.subject.field],text:text(a.value),evidenceRefs:a.evidenceRefs,basis:a.basis,elicitation:a.elicitation,note:a.basis==='analyst_inference'?'Интерпретация исследователя':['after_explanation','prompted','after_prompt'].includes(a.elicitation)?'После подсказки или объяснения':''})),
    missingFields:Object.keys(titles).filter(k=>!records.some(a=>a.type==='Assertion'&&a.subject?.id===j.id&&a.subject.field===k&&a.state==='known')).map(k=>titles[k])})),
   relations:records.filter(r=>r.type==='JobRelation'&&jobIds.has(r.from)&&jobIds.has(r.to)),
   sourceRefs:episode?.evidenceRefs||[]}
 })
 return {segmentId,revision:data.revision,factRevision:data.factRevision,graphRevision:graph.revision||0,common,cases,
  stale:model.groups.some(g=>g.stale),savedFilters:model.savedFilters,baseSegmentId:model.base.id,
  cohort: {materialCount:selected.cases.length,baseMaterialCount:model.cases.length,filters:Object.entries(selected.filters).map(([id,value])=>{const p=model.parameters.find(p=>p.id===id);return {label:p.label,value:Array.isArray(value)?value.map(v=>v==='__unknown'?'Без данных':p.values.find(o=>o.id===v)?.label||v).join(', '):value.unknown?'Без данных':[value.min!=null?'от '+value.min:'',value.max!=null?'до '+value.max:''].filter(Boolean).join(' ')}})},
  profileJob:model.segment.data?.customerProfile?.primaryJob||null,
  profileOtherJobs:model.segment.data?.customerProfile?.otherJobs||[],
  profileCriteria:model.segment.data?.customerProfile?.successCriteria||[]}
}
module.exports={segmentJobGraph,TYPES}
