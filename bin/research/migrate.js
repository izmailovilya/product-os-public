// Portable migration of an explicitly reviewed identity/source plan. This imports
// identity and originals only; semantic extraction remains a resumable partial stage.
const fs=require('fs'),path=require('path')
const {hash,sourceText}=require('./schema'),{load}=require('./store')
const sourceId=file=>`source-${hash(file).slice(0,16)}`
const unitId=(file,line)=>`unit-${hash(file).slice(0,16)}-${line}`
function plan(workspace,input){
 const records=[],coverage=[],sources=new Map()
 for(const s of input.sources){const id=sourceId(s.path),bytes=fs.readFileSync(path.join(workspace,s.path));const r={id,type:'SourceDocument',path:s.path,sha256:s.sha256||hash(bytes),kind:s.kind,origin:s.origin,ownerSessionIds:s.ownerSessionIds||[],...(s.receivedTime?{receivedTime:s.receivedTime}:{})};sourceText(workspace,r);records.push(r);sources.set(s.path,r)
  bytes.toString('utf8').split(/\r?\n/).forEach((raw,index)=>{if(!raw.trim())return;const uid=unitId(s.path,index+1);records.push({id:uid,type:'SourceUnit',sourceId:id,locator:{startLine:index+1,endLine:index+1},role:'context',raw});coverage.push({sourceUnitId:uid,disposition:'unprocessed',recordIds:[],reason:'Preserved original; semantic extraction pending',reviewer:'migration-v1',reviewVersion:1})})
 }
 const evidence=refs=>refs.map(e=>{if(!sources.has(e.path))throw new Error('Evidence source missing from plan');return {sourceUnitId:unitId(e.path,e.line),quote:e.quote,speakerRole:e.speakerRole||'researcher'}})
 records.push({...input.study,type:'Study',frameSourceIds:input.study.framePaths.map(p=>sourceId(p)),evidenceRefs:evidence(input.study.evidence)})
 const study=records.at(-1);delete study.framePaths;delete study.evidence
 for(const p of input.people){const evidenceRefs=evidence(p.evidence);records.push({id:p.id,type:'Person',displayName:p.displayName,evidenceRefs});if(p.organization)records.push({id:p.organization.id,type:'Organization',name:p.organization.name,nameState:p.organization.nameState||'known',evidenceRefs:evidence(p.organization.evidence)},{id:`affiliation-${p.id}`,type:'Affiliation',personId:p.id,organizationId:p.organization.id,period:{precision:'unknown'},evidenceRefs:evidence(p.organization.evidence)})}
 for(const s of input.sessions)records.push({id:s.id,type:'Session',studyId:input.study.id,participants:s.personIds.map(personId=>({kind:'person',personId})),kind:'interview',status:s.status,sourceIds:s.sourcePaths.map(sourceId),time:s.time||{precision:'unknown'},evidenceRefs:evidence(s.evidence)})
 for(const e of input.episodes||[])records.push({...e,type:'Episode',evidenceRefs:evidence(e.evidence)}),delete records.at(-1).evidence
 const data=load(workspace),graphFile=path.join(workspace,'research-graph.json'),graph=fs.existsSync(graphFile)?JSON.parse(fs.readFileSync(graphFile)):{revision:0}
 return {schemaVersion:1,expectedRevision:graph.revision||0,expectedResearchRevision:data.revision,source:'migration:reviewed-plan',operations:[...records.map(record=>({op:'research-put',record})),...coverage.filter(c=>!data.coverage.some(old=>old.sourceUnitId===c.sourceUnitId)).map(coverage=>({op:'research-coverage',coverage})),{op:'research-checkpoint',checkpoint:{id:input.id,sourceIds:[...sources.values()].map(s=>s.id),status:'partial'}}]}
}
if(require.main===module){try{const [root,input,out]=process.argv.slice(2);if(!out)throw new Error('migrate <workspace> <reviewed-plan.json> <operations-output.json>');fs.writeFileSync(out,JSON.stringify(plan(path.resolve(root),JSON.parse(fs.readFileSync(input))),null,2)+'\n')}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={plan,sourceId,unitId}
