// A customer profile is a sourced description, never a parameter calculator.
const cpString={type:'string'},cpStrings={type:'array',items:cpString}
const cpObject=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties})
const CUSTOMER_FACT_SCHEMA=cpObject({text:cpString,basis:{type:'string',enum:['hypothesis','team','research','unknown']},sourceRefs:cpStrings})
const CUSTOMER_GROUP_SCHEMA=cpObject({id:cpString,label:cpString})
const CUSTOMER_PROFILE_SCHEMA=cpObject({
 version:{type:'integer',enum:[1]},group:CUSTOMER_GROUP_SCHEMA,
 summary:CUSTOMER_FACT_SCHEMA,context:CUSTOMER_FACT_SCHEMA,recognition:CUSTOMER_FACT_SCHEMA,whySeparate:CUSTOMER_FACT_SCHEMA,
 primaryJob:CUSTOMER_FACT_SCHEMA,successCriteria:{type:'array',items:CUSTOMER_FACT_SCHEMA},otherJobs:{type:'array',items:CUSTOMER_FACT_SCHEMA},
 productFit:CUSTOMER_FACT_SCHEMA,alternatives:CUSTOMER_FACT_SCHEMA,
 roles:cpObject({user:CUSTOMER_FACT_SCHEMA,decisionMaker:CUSTOMER_FACT_SCHEMA,payer:CUSTOMER_FACT_SCHEMA}),
 journey:cpObject({trigger:CUSTOMER_FACT_SCHEMA,discovery:CUSTOMER_FACT_SCHEMA,firstUse:CUSTOMER_FACT_SCHEMA,purchase:CUSTOMER_FACT_SCHEMA,retention:CUSTOMER_FACT_SCHEMA}),
 unknowns:cpStrings,
})
const CUSTOMER_PROFILE_PROMPT=`Describe ONE recognizable customer segment as a whole: who they are, how their practice or organization works, who uses/chooses/pays, why they seek a solution, its principal value and the other jobs they do with it. Start from people and actual practices plus explicit candidates outside the current customer base, within the product's market/capability scope. Existing jobs are evidence to inspect, not the universe of possible customers. A group is a navigation family such as teachers or schools; a segment is a coherent customer profile within it. Reuse supplied group IDs. A profession alone does not prove common needs. Explain differences that change value, success criteria, buying, acquisition or implementation. Do not generate filters, parameter combinations, pain-severity labels or arbitrary quotas. A subsegment is an independently described narrower customer group, never a saved control selection. Keep multiple jobs in one profile. Distinguish reason for first purchase, frequent use, adjacent tasks and retention. Distinguish trigger, discovery channel, first use and payment; do not infer one from another. Do not assume organizational users buy or pay. Each fact has text, basis and sourceRefs: hypothesis for your inference, team for an attributed team statement, research only for an exact supplied research/source finding, unknown for a specific gap. Sources of a circumstance do not prove the entire profile, causal priority or demand. No invented sources, people counts, priority rankings or capabilities. Unknowns are valid; no need to fill every field with a guess. Product fit must distinguish known capabilities and limits. Preserve stable segment boundaries on a focused update; do not copy validation, membership or parent priorities. Return the profile only.`
function customerProfileIssue(p){
 const text=x=>typeof x==='string'&&x.trim().length>0,strings=x=>Array.isArray(x)&&x.every(v=>typeof v==='string')
 if(!p||p.version!==1||!p.group||!text(p.group.label)||!(/^[a-zа-яё0-9][a-zа-яё0-9_.:-]{0,239}$/i.test(p.group.id||''))||['__proto__','constructor','prototype'].includes(p.group.id))return 'Профилю клиента нужны version:1 и понятная группа с устойчивым ID'
 const fact=(f,name)=>!f||!text(f.text)||!['hypothesis','team','research','unknown'].includes(f.basis)||!strings(f.sourceRefs)?'Нет текста, основания или источников: '+name:['team','research'].includes(f.basis)&&!f.sourceRefs.length?'Для утверждения нужен источник: '+name:null
 for(const key of ['summary','context','recognition','whySeparate','primaryJob','productFit','alternatives']){const issue=fact(p[key],key);if(issue)return issue}
 for(const [key,fields] of [['roles',['user','decisionMaker','payer']],['journey',['trigger','discovery','firstUse','purchase','retention']]])for(const field of fields){const issue=fact(p[key]?.[field],key+'.'+field);if(issue)return issue}
 for(const key of ['successCriteria','otherJobs']){if(!Array.isArray(p[key]))return 'Нужен список '+key;for(const f of p[key]){const issue=fact(f,key);if(issue)return issue}}
 if(!strings(p.unknowns))return 'Неизвестные сведения должны быть списком строк'
 return null
}
module.exports={CUSTOMER_FACT_SCHEMA,CUSTOMER_GROUP_SCHEMA,CUSTOMER_PROFILE_SCHEMA,CUSTOMER_PROFILE_PROMPT,customerProfileIssue}
