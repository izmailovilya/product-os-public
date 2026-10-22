#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
function runtimeRoot(){
 for(const root of [path.resolve(__dirname,'../../..'),path.resolve(__dirname,'../../../product-os-tools'),path.resolve(__dirname,'../../product-os-tools')])if(fs.existsSync(path.join(root,'bin/research/store.js')))return root;
 throw Error('Не найден установленный runtime Product OS.');
}
const runtime=runtimeRoot(),{snapshot}=require(path.join(runtime,'bin/research/store'));
const {activeRecords}=require(path.join(runtime,'bin/research/scope'));
const provenance=require(path.join(runtime,'bin/research/provenance'));
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const pick=(record,keys)=>Object.fromEntries(keys.filter(key=>record[key]!==undefined).map(key=>[key,record[key]]));
function researchInputs(workspace,productId){
 return snapshot(workspace,{},(data,graph)=>{
  const products=graph.nodes.filter(n=>n.type==='product'&&n.status!=='dropped'&&!n.data?.retired);
  if(!products.some(n=>n.id===productId))throw Error('Продукт исследования не найден.');
  const records=activeRecords(data),by=new Map(records.map(r=>[r.id,r]));
  const productIds=new Set(products.map(n=>n.id));
  const jobs=records.filter(r=>r.type==='JobInstance').filter(job=>{
   const episode=by.get(job.episodeId),studies=(episode?.sessionIds||[]).map(id=>by.get(by.get(id)?.studyId));
   if(studies.some(study=>study?.product===productId))return true;
   if(!studies.length||studies.some(study=>!study||!productIds.has(study.product)))throw Error('Не определена принадлежность работы к продукту: '+job.id+'. Уточните Study/Session/Episode; пустая выборка не означает отсутствие работ.');
   return false;
  });
  const jobIds=new Set(jobs.map(j=>j.id)),episodeIds=new Set(jobs.map(j=>j.episodeId));
  const episodes=records.filter(r=>r.type==='Episode'&&episodeIds.has(r.id));
  const sessionIds=new Set(episodes.flatMap(e=>e.sessionIds));
  const sessions=records.filter(r=>r.type==='Session'&&sessionIds.has(r.id));
  const personIds=new Set([...episodes.flatMap(e=>e.personIds),...jobs.map(j=>j.actor.personId).filter(Boolean)]);
  const assertions=records.filter(r=>r.type==='Assertion'&&(jobIds.has(r.subject.id)||episodeIds.has(r.subject.id)));
  const criteria=records.filter(r=>r.type==='CriterionObservation'&&jobIds.has(r.jobInstanceId));
  const relations=records.filter(r=>r.type==='JobRelation'&&jobIds.has(r.from)&&jobIds.has(r.to));
  const selected=[...jobs,...episodes,...assertions,...criteria,...relations],recordIds=new Set(selected.map(r=>r.id));
  const fieldProvenance=provenance.active(data.fieldProvenance).filter(p=>recordIds.has(p.recordId));
  const sourceUnitIds=new Set([...selected,...fieldProvenance].flatMap(r=>(r.evidenceRefs||[]).map(e=>e.sourceUnitId)));
  const historical=new Map(data.records.map(r=>[r.id,r]));
  const sourceUnits=[...sourceUnitIds].map(id=>historical.get(id)).filter(Boolean).map(r=>pick(r,['id','sourceId','locator','role','sessionIds','supersedes']));
  const sourceIds=new Set(sourceUnits.map(u=>u.sourceId));
  const sources=data.records.filter(r=>r.type==='SourceDocument'&&sourceIds.has(r.id)).map(r=>pick(r,['id','path','sha256','kind']));
  const rows=jobs.map(job=>({id:'research:'+job.id,text:job.rawOutcome,...job.normalizedOutcome?{normalizedText:job.normalizedOutcome}:{},evidence:{recordId:job.id,episodeId:job.episodeId,actor:job.actor,personIds:by.get(job.episodeId).personIds,sessionIds:by.get(job.episodeId).sessionIds,evidenceRefs:job.evidenceRefs}}));
  // Repeated quotes and provenance notes are stored once. No source text is
  // shortened; consumers can resolve a record's exact references in this packet.
  const evidence={},notes={};
  const pack=record=>{
   const {evidenceRefs,note,...rest}=record;
   if(evidenceRefs)rest.evidenceRefIds=evidenceRefs.map(ref=>{const id=fingerprint(ref);evidence[id]=ref;return id});
   if(note!==undefined){const id=fingerprint(note);notes[id]=note;rest.noteId=id}
   return rest;
  };
  const result={version:1,productId,revision:data.revision,factRevision:data.factRevision,
   jobs:rows,episodes:episodes.map(r=>pick(r,['id','personIds','sessionIds','kind','time'])),
   people:records.filter(r=>r.type==='Person'&&personIds.has(r.id)).map(r=>pick(r,['id','displayName'])),
   sessions:sessions.map(r=>pick(r,['id','studyId','kind','status'])),assertions:assertions.map(pack),criteria:criteria.map(pack),relations:relations.map(pack),sourceUnits,sources,
   fieldProvenance:fieldProvenance.map(pack),evidence,notes,
   coverage:{registryState:fs.existsSync(path.join(workspace,'research/research-data.json'))?'available':'absent',registeredJobs:rows.length,
    unprocessedUnits:data.coverage.filter(c=>['unprocessed','source_only'].includes(c.disposition)).length,
    checkpoints:data.checkpoints.map(c=>({id:c.id,status:c.status})),
    note:'Полнота относительно текущих записей JobInstance этого продукта. Формулировки сохранённого разбора не равны дословным цитатам. Не доказывает полноту извлечения всех интервью или спрос; пробелы и происхождение сохраняются.'}};
  return {...result,fingerprint:fingerprint(result)};
 });
}
if(require.main===module)try{
 const [workspace,...args]=process.argv.slice(2),productId=args.find(a=>a.startsWith('productId='))?.slice(10);
 if(!workspace||!productId||args.length!==1)throw Error('Usage: research-inputs.cjs <workspace> productId=<id>');
 console.log(JSON.stringify(researchInputs(workspace,productId),null,2));
}catch(e){console.error(e.message);process.exitCode=1}
module.exports={researchInputs,runtimeRoot,fingerprint};
