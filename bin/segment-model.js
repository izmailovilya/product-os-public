// Pure, product-independent conditional segment model. No respondent registry is read.
const SEGMENT_PRIORITIES=['critical','important','secondary','unknown']
const SEGMENT_RELEVANCE=['active','inactive','unknown']
const smString={type:'string'},smStrings={type:'array',items:smString}
const smObject=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties})
const SEGMENT_MODEL_SCHEMA=smObject({
 version:{type:'integer',enum:[1]},summary:smString,
 parameters:{type:'array',maxItems:8,items:smObject({id:smString,label:smString,whyCritical:smString,values:{type:'array',minItems:2,maxItems:6,items:smObject({id:smString,label:smString})}})},
 jobs:{type:'array',minItems:1,maxItems:16,items:smObject({id:smString,label:smString,productFit:smObject({coverage:{type:'string',enum:['full','partial','none','unknown']},explanation:smString,sourceRefs:smStrings}),relevance:{type:'string',enum:SEGMENT_RELEVANCE},priority:{type:'string',enum:SEGMENT_PRIORITIES},criteria:{type:'array',maxItems:16,items:smObject({id:smString,label:smString,relevance:{type:'string',enum:SEGMENT_RELEVANCE},priority:{type:'string',enum:SEGMENT_PRIORITIES}})}})},
 rules:{type:'array',maxItems:64,items:smObject({id:smString,when:{type:'array',minItems:1,items:smObject({parameterId:smString,valueIds:smStrings})},explanation:smString,claimIds:smStrings,changes:{type:'array',minItems:1,items:smObject({jobId:smString,criterionId:{type:['string','null']},property:{type:'string',enum:['relevance','priority','wording']},value:smString})}})},
})
const SEGMENT_MODEL_PROMPT=`Generate a conditional model for ONE top-level customer segment. Top-level segments name recognizable people or organizations with observable responsibility, practice, buying context and ownership of value. Jobs and success criteria explain that boundary; do not create another top-level segment for every job, criterion or priority permutation. Preserve the customer's chosen umbrella segments. Within them identify only critical parameters with a plausible mechanism changing applicable jobs, criterion wording or RELATIVE priority. This must work with ZERO respondents. It is a proposed decision model, not respondent filters or prevalence statistics. No minimum quotas: omit cosmetic demographics and redundant parameters. Every parameter value must be classifiable from observable facts about a recent real situation. Do not use unanchored pain labels such as busy, overloaded, high workload or lacking time as customer boundaries. Describe the arrangement that creates the work; record pain severity separately. Do not invent a numeric threshold to make a vague boundary look precise. A group format or current tool alone does not prove urgency or willingness to pay. Do not put jobs themselves among the input parameters. Values are mutually exclusive interpretations of one situation; model combinations explicitly where necessary. Each rule needs an explanation and changes referencing declared job/criterion IDs. Conditions are AND across parameters, OR within valueIds. Start from base jobs/criteria; unknown priority is not low priority. Use critical/important/secondary to express a proposed relative order, never fabricated numeric effect sizes. A narrower combination does not silently override another rule: avoid incompatible simultaneous changes; conflicts remain visible. Reference only supplied claim IDs if they motivate the hypothesis; none is allowed. A source showing a context or feature does not establish a causal dependency. All generated rules remain hypotheses; do not assert validation or invent interviews. For each job add productFit: describe how the actual offering can help, its limitations, and supplied sourceRefs. Coverage is full/partial/none/unknown; do not infer capabilities from job importance. Unknown is valid when product capabilities are missing. A named subsegment may fix just one parameter; the rest remain open. State limitations in summary. Preserve stable IDs of an existing model when revising it.`
function segmentModelIssue(model){
 const text=x=>typeof x==='string'&&x.trim().length>0,id=x=>typeof x==='string'&&/^[a-z][a-z0-9_-]{0,99}$/i.test(x)&&!['constructor','prototype','__proto__'].includes(x)
 if(!model||model.version!==1||!text(model.summary)||!Array.isArray(model.parameters)||model.parameters.length>8||!Array.isArray(model.jobs)||!model.jobs.length||model.jobs.length>16||!Array.isArray(model.rules)||model.rules.length>64)return 'Нужна модель version 1 с параметрами, задачами и правилами'
 const ids=new Set(),take=x=>{if(!id(x)||ids.has(x))return false;ids.add(x);return true},params=new Map(),jobs=new Map(),used=new Set()
 for(const p of model.parameters){if(!take(p.id)||!text(p.label)||!text(p.whyCritical)||!Array.isArray(p.values)||p.values.length<2||p.values.length>6||p.values.some(v=>!id(v.id)||!text(v.label))||new Set(p.values.map(v=>v.id)).size!==p.values.length)return 'Неверный критический параметр';params.set(p.id,p)}
 for(const j of model.jobs){if(!take(j.id)||!text(j.label)||!SEGMENT_RELEVANCE.includes(j.relevance)||!SEGMENT_PRIORITIES.includes(j.priority)||!Array.isArray(j.criteria)||j.criteria.length>16)return 'Неверная задача модели';if(j.productFit&&(!['full','partial','none','unknown'].includes(j.productFit.coverage)||!text(j.productFit.explanation)||!Array.isArray(j.productFit.sourceRefs)||j.productFit.sourceRefs.some(x=>!text(x))))return 'Неверное объяснение покрытия задачи продуктом';jobs.set(j.id,j);for(const c of j.criteria)if(!take(c.id)||!text(c.label)||!SEGMENT_RELEVANCE.includes(c.relevance)||!SEGMENT_PRIORITIES.includes(c.priority))return 'Неверный критерий модели'}
 for(const r of model.rules){
  if(!take(r.id)||!text(r.explanation)||!Array.isArray(r.claimIds)||r.claimIds.some(x=>!text(x))||!Array.isArray(r.when)||!r.when.length||!Array.isArray(r.changes)||!r.changes.length)return 'Неверное правило модели'
  const conditions=new Set();for(const c of r.when){const p=params.get(c.parameterId);if(!p||conditions.has(p.id)||!Array.isArray(c.valueIds)||!c.valueIds.length||new Set(c.valueIds).size!==c.valueIds.length||c.valueIds.some(v=>!p.values.some(x=>x.id===v)))return 'Правило ссылается на неизвестное или повторное условие';conditions.add(p.id);used.add(p.id)}
  const targets=new Set();for(const e of r.changes){const j=jobs.get(e.jobId),key=JSON.stringify([e.jobId,e.criterionId,e.property]);if(!j||e.criterionId!==null&&!j.criteria.some(c=>c.id===e.criterionId)||targets.has(key))return 'Правило ссылается на чужой критерий или повторяет изменение';targets.add(key);if(e.property==='relevance'?!SEGMENT_RELEVANCE.includes(e.value):e.property==='priority'?!SEGMENT_PRIORITIES.includes(e.value):e.property==='wording'?!text(e.value):true)return 'Неверное изменение задачи или критерия'}
 }
 if(model.parameters.some(p=>!used.has(p.id)))return 'У критического параметра нет влияния на задачи или критерии'
 return null
}
function segmentSelection(model,input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Неверные условия сегмента'),{status:400})
 const out={};for(const key of Object.keys(input).sort()){const p=model.parameters.find(p=>p.id===key);if(!p||typeof input[key]!=='string'||!p.values.some(v=>v.id===input[key]))throw Object.assign(Error('Неизвестное значение критического параметра'),{status:400});out[key]=input[key]}return out
}
function evaluateSegmentModel(model,input={}){
 const issue=segmentModelIssue(model);if(issue)throw Object.assign(Error(issue),{status:400})
 const selection=segmentSelection(model,input),rules=model.rules.map(r=>({...r,state:r.when.some(c=>selection[c.parameterId]&&!c.valueIds.includes(selection[c.parameterId]))?'inactive':r.when.every(c=>selection[c.parameterId]&&c.valueIds.includes(selection[c.parameterId]))?'active':'pending',evidenceStatus:'hypothesis'}))
 const active=rules.filter(r=>r.state==='active'),changes=[]
 function item(base,jobId,criterionId){
  const result={...base,base:{label:base.label,relevance:base.relevance,priority:base.priority},effects:[],conflicts:[]}
  for(const property of ['relevance','priority','wording']){const effects=active.flatMap(r=>r.changes.filter(c=>c.jobId===jobId&&c.criterionId===criterionId&&c.property===property).map(c=>({...c,ruleId:r.id,explanation:r.explanation})));if(!effects.length)continue
   const values=[...new Set(effects.map(e=>e.value))],key=property==='wording'?'label':property;result.effects.push(...effects)
   if(values.length>1){result.conflicts.push({property,effects});if(property!=='wording')result[key]='unknown'}else result[key]=values[0]
   if(values.length>1||result[key]!==base[key])changes.push({jobId,criterionId,property,before:base[key],after:values.length>1?null:result[key],conflict:values.length>1,ruleIds:effects.map(e=>e.ruleId)})
  }return result
 }
 const jobs=model.jobs.map(j=>({...item(j,j.id,null),criteria:j.criteria.map(c=>item(c,j.id,c.id))}))
 return {selection,jobs,rules,changes,pendingParameters:model.parameters.filter(p=>!selection[p.id]).map(p=>p.id),conflictCount:jobs.reduce((n,j)=>n+j.conflicts.length+j.criteria.reduce((n,c)=>n+c.conflicts.length,0),0)}
}
function parameterViewRationale(model,input={},source=null){
 const result=evaluateSegmentModel(model,input),active=result.rules.filter(r=>r.state==='active'),jobIds=new Set(active.flatMap(r=>r.changes.map(c=>c.jobId)))
 const conditions=r=>r.when.map(c=>{const p=model.parameters.find(p=>p.id===c.parameterId);return p.label+': '+c.valueIds.map(v=>p.values.find(x=>x.id===v).label).join(' или ')}).join('; ')
 return {version:1,evidenceStatus:'hypothesis',source,selection:result.selection,
  parameters:model.parameters.filter(p=>result.selection[p.id]).map(p=>({id:p.id,label:p.label,valueId:result.selection[p.id],value:p.values.find(v=>v.id===result.selection[p.id]).label,whyCritical:p.whyCritical})),
  rules:active.map(r=>({id:r.id,condition:conditions(r),explanation:r.explanation,claimIds:r.claimIds})),
  pendingRules:result.rules.filter(r=>r.state==='pending'&&r.when.some(c=>result.selection[c.parameterId])).map(r=>({id:r.id,condition:conditions(r),explanation:r.explanation})),
  jobs:result.jobs.filter(j=>jobIds.has(j.id)).map(j=>({...j,productFit:j.productFit||{coverage:'unknown',explanation:'Покрытие этой задачи продуктом ещё не описано.',sourceRefs:[]}})),
  openParameters:model.parameters.filter(p=>!result.selection[p.id]).map(p=>({id:p.id,label:p.label}))}
}
function resolveSegmentModel(graph,segmentId){
 const segment=graph.nodes.find(n=>n.id===segmentId&&n.type==='segment');if(!segment)throw Object.assign(Error('Сегмент не найден'),{status:404})
 const base=segment.data?.parameterView?graph.nodes.find(n=>n.id===segment.data.parameterView.baseSegmentId&&n.type==='segment'):segment
 if(!base||base.data?.parameterView)throw Object.assign(Error('Основание варианта недоступно'),{status:400})
 const owner=base
 return {segment,base,owner,model:owner?.data?.parameterModel||null,savedSelection:segment.data?.parameterView?.selection||{}}
}
function segmentModelView(graph,query){
 const scope=resolveSegmentModel(graph,query.segmentId),parse=(v,d)=>{if(v===undefined)return d;try{return typeof v==='string'?JSON.parse(v):v}catch{throw Object.assign(Error('Неверные условия'),{status:400})}}
 if(!scope.model)return {configured:false,segmentId:scope.segment.id,graphRevision:graph.revision||0}
 const model=scope.model,selection=parse(query.selection,scope.savedSelection),comparison=parse(query.compare,{}),savedRationale=scope.segment.data?.parameterView?.rationale||null;let rationaleChanged=false
 if(savedRationale){try{rationaleChanged=JSON.stringify(savedRationale)!==JSON.stringify(parameterViewRationale(model,scope.savedSelection,scope.owner.data.parameterModelSource||scope.owner.source))}catch{rationaleChanged=true}}
 return {configured:true,savedRationale,rationaleChanged,segmentId:scope.segment.id,baseSegmentId:scope.base.id,graphRevision:graph.revision||0,model,evidenceStatus:'hypothesis',source:scope.owner.data.parameterModelSource||scope.owner.source,selected:evaluateSegmentModel(model,selection),comparison:evaluateSegmentModel(model,comparison),savedSelection:scope.savedSelection}
}
module.exports={SEGMENT_PRIORITIES,SEGMENT_RELEVANCE,SEGMENT_MODEL_SCHEMA,SEGMENT_MODEL_PROMPT,segmentModelIssue,segmentSelection,evaluateSegmentModel,parameterViewRationale,resolveSegmentModel,segmentModelView}
