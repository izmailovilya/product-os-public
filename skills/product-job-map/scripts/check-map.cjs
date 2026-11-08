#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),{isDeepStrictEqual}=require('node:util');
const {runtimeRoot,researchInputs:collectResearchInputs,fingerprint}=require('./research-inputs.cjs');
const {validateMap}=require(path.join(runtimeRoot(),'bin/console/strategic-jobs'));
const {checkReadingReview}=require('./reading-review.cjs');
const nonempty=v=>typeof v==='string'&&Boolean(v.trim());
function checkMap(map,{inventory,graph,workspace,researchInputs,requireReadingReview=false}={}){
 validateMap(map);const errors=[],warnings=[],fail=message=>errors.push(message),sources=map.sources||{};
 const current=workspace&&fs.existsSync(path.join(workspace,'research-graph.json'))?collectResearchInputs(workspace,map.scope?.productId):null;
 const liveRegistry=current?.coverage.registryState==='available';
 if(researchInputs){
  const {fingerprint:hash,...body}=researchInputs;
  if(researchInputs.version!==1||researchInputs.productId!==map.scope?.productId||!Array.isArray(researchInputs.jobs)||hash!==fingerprint(body))fail("The research input is damaged or does not match the product.");
  if(liveRegistry&&current.fingerprint!==researchInputs.fingerprint)fail("Research input is out of date or incomplete: Re-read the current registry.");
 }
 const evidenceInputs=liveRegistry?current:researchInputs||current,researchRows=new Map((evidenceInputs?.jobs||[]).map(row=>[row.id,row]));
 const refs=(items,where)=>{if(!Array.isArray(items))return fail(where+": sourceRefs expected.");for(const id of items)if(!Object.hasOwn(sources,id))fail(where+": unknown source "+id)};
 for(const key of ['title','basis'])if(!nonempty(map[key]))fail("Not filled "+key);
 if(!nonempty(map.scope?.productId)||!nonempty(map.scope?.goal))fail("The product and purpose of the card are not filled in.");
 for(const [id,s] of Object.entries(sources))for(const key of ['kind','title','text'])if(!nonempty(s?.[key]))fail("Source "+id+": empty "+key);
 if(workspace)for(const [id,s] of Object.entries(sources))if(s.path){try{fileWithin(workspace,s.path)}catch{fail("Source "+id+": Local file not found or outside of workspace.")}}
 const used=new Set();
 for(const g of map.graphs){
  for(const key of ['note','boundary'])if(!nonempty(g[key]))fail("Count "+g.id+": empty "+key);
  const parents=new Map(g.jobIds.map(id=>[id,[]])),seen=new Set();
  for(const edge of g.edges){const key=edge.from+'\0'+edge.to;if(seen.has(key))fail("Count "+g.id+": edge repeat");seen.add(key);parents.get(edge.from).push(edge.to);if(!nonempty(edge.why))fail("Edge "+edge.from+' → '+edge.to+": no explanation");if(!['hypothesis','owner','source'].includes(edge.basis))fail("Edge "+edge.from+": no origin");refs(edge.sourceRefs,"Edge "+edge.from)}
  const connected=new Map([[g.id,true]]);function reaches(id){if(!connected.has(id))connected.set(id,parents.get(id).some(reaches));return connected.get(id)}
  for(const id of g.jobIds){used.add(id);if(!reaches(id))fail("Work "+id+": no path to target graph "+g.id)}
 }
 for(const [id,j] of Object.entries(map.jobs)){
  if(!used.has(id))fail("Work "+id+" not shown in any fragment.");
  for(const key of ['description','input','output','mechanism','alternatives'])if(!nonempty(j[key]))fail("Work "+id+": empty "+key);
  if(!['original','higher','bridge','external','proposed'].includes(j.kind))fail("Work "+id+": unknown role");
  if(!['hypothesis','owner','source'].includes(j.basis))fail("Work "+id+": origin not specified");refs(j.sourceRefs,"Work "+id);
  if(Object.hasOwn(j,'criteria'))fail("Work "+id+": Common criteria cannot be assigned to different segments.");
  for(const edition of ['full','public']){const x=j[edition];for(const key of ['contribution','limit'])if(!nonempty(x[key]))fail("Work "+id+'/'+edition+": empty "+key);refs(x.sources,"Work "+id+'/'+edition);if(x.state==='ready'&&!x.sources.length)fail("Work "+id+'/'+edition+": procedure ready without reason.");if(x.state==='change'&&!nonempty(j.change))fail("Work "+id+": The required modification is not described.")}
 }
 for(const c of map.contexts){if(Boolean(c.segmentId)===Boolean(c.ideaId))fail("Communication "+c.id+": Exactly one real segmentId or ideaId is needed.");if(Object.hasOwn(c,'criteria'))fail("Communication "+c.id+": Cannot store a common set of criteria.");for(const id of c.excludedJobIds||[])if(!map.jobs[id])fail("Communication "+c.id+": unknown exception "+id)}
 const ledger=map.inventory;
 if(!Array.isArray(ledger))fail("No inventory of source works.");
 else{
  const ids=new Set();for(const row of ledger){if(!nonempty(row.id)||ids.has(row.id)||!nonempty(row.text)||!nonempty(row.reason)||!Array.isArray(row.jobIds))fail("Invalid inventory entry.");ids.add(row.id);for(const id of row.jobIds||[])if(!map.jobs[id])fail('Inventory '+row.id+": unknown job "+id);if(!row.jobIds?.length&&row.decision!=='out_of_scope')fail('Inventory '+row.id+": Item lost without explicit exception.")}
  if(inventory){const expected=new Map(inventory.map(row=>[row.id,row.text]));for(const row of ledger){if(researchRows.has(row.id)&&!expected.has(row.id))continue;if(!expected.has(row.id)||expected.get(row.id)!==row.text)fail('Inventory '+row.id+": entry point changed or invented.");expected.delete(row.id)}for(const id of expected.keys())fail("Inventory: lost entry point "+id)}
  for(const row of ledger)if(typeof row.id==='string'&&row.id.startsWith('research:')&&!researchRows.has(row.id))fail('Inventory '+row.id+": The job is missing from the current study input.");
  for(const [id,expected] of researchRows){
   const row=ledger.find(r=>r.id===id);
   if(!row){fail("Inventory: work lost from research "+expected.evidence.recordId);continue}
   if(row.text!==expected.text||!isDeepStrictEqual(row.evidence,expected.evidence))fail('Inventory '+id+": The wording, context, or basis of the respondent's work has been changed.");
   if(!row.jobIds?.length||row.decision==='out_of_scope')fail('Inventory '+id+": The collected work must be visible on the map, including outside the product.");
   refs(row.sourceRefs,'Inventory '+id);
   if(!row.sourceRefs?.length||!(row.jobIds||[]).some(jobId=>map.jobs[jobId]?.sourceRefs?.some(ref=>row.sourceRefs?.includes(ref))))fail('Inventory '+id+": There is no connection between the base and the work shown.");
  }
 }
 if(!evidenceInputs)warnings.push("The research register has not been verified: the completeness of the respondents’ works has not been established.");
 else if(researchInputs&&!liveRegistry)warnings.push("Only the transmitted study snapshot was verified; its relevance in the original registry has not been established.");
 else if(!liveRegistry)warnings.push("There is no typed registry. Check the saved reviews: this is not proof of the absence of an interview.");
 else if(evidenceInputs.coverage.unprocessedUnits||evidenceInputs.coverage.checkpoints.some(c=>c.status!=='complete'))warnings.push("Completeness of saved works does not mean completeness of the interview analysis: there are unfinished parts of the register.");
 if(!['reviewed','unreviewed'].includes(map.review?.status))fail("The semantic check status is not specified.");
 refs(map.review?.sourceRefs,'Review');
 if(map.review?.status==='reviewed'&&!map.review.sourceRefs?.length)fail("Review: no saved review.");
 let readingReview;
 if(requireReadingReview||map.review?.readingReview){
  try{
   const receipt=map.review?.readingReview;
   if(!workspace||!receipt?.path||!receipt.sha256)throw Error("No independent text verification stored.");
   const bytes=fs.readFileSync(fileWithin(workspace,receipt.path,4*1024*1024));
   if(require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==receipt.sha256)throw Error("text check file changed.");
   readingReview=checkReadingReview(map,JSON.parse(bytes));
  }catch(error){fail("Text check: "+error.message)}
 }
 if(graph){if(!graph.nodes.some(n=>n.id===map.scope?.productId&&n.type==='product'&&n.status!=='dropped'&&!n.data?.retired))fail("Card product not found.");const segments=new Set(graph.nodes.filter(n=>n.type==='segment'&&n.status!=='dropped'&&!n.data?.retired).map(n=>n.id));let ideas;for(const c of map.contexts){if(c.segmentId&&!segments.has(c.segmentId))fail("Communication "+c.id+": Segment not found.");if(c.ideaId){ideas??=new Set(graph.nodes.filter(n=>n.type==='artifact'&&n.data?.artifactKind==='audience-ideas'&&n.status!=='dropped'&&!n.data?.retired).flatMap(n=>(n.data.ideas||[]).map(i=>n.id+':'+i.id)));if(!ideas.has(c.ideaId))fail("Communication "+c.id+": deferred idea not found.")}}}
 else warnings.push("Workspace graph not provided: product and segment links not verified.");
 if(errors.length)throw Error(errors.join('\n'));
 return {valid:true,jobs:Object.keys(map.jobs).length,graphs:map.graphs.length,associations:map.contexts.length,inventory:ledger.length,review:map.review.status,...(readingReview?{readingReview}:{}),evidenceCoverage:evidenceInputs?{status:liveRegistry?'checked':researchInputs?'snapshot_only':'no_registry',registeredJobs:researchRows.size,revision:evidenceInputs.revision,factRevision:evidenceInputs.factRevision}: {status:'unchecked'},warnings,semanticReview:"The adequacy of the meaning and the quality of the grounds are checked separately by a human/independent reviewer."};
}
function fileWithin(workspace,relative,maxBytes=32*1024*1024){
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('\\'))throw Error("Need a relative path inside the workspace.");
 const root=fs.realpathSync(workspace),file=fs.realpathSync(path.resolve(root,relative));if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile()||fs.statSync(file).size>maxBytes)throw Error("Invalid path or file size.");return file;
}
function readWithin(workspace,relative,maxBytes=4*1024*1024){return JSON.parse(fs.readFileSync(fileWithin(workspace,relative,maxBytes),'utf8'))}
if(require.main===module){try{
 const [workspace,file,...args]=process.argv.slice(2);if(!workspace||!file)throw Error('Usage: check-map.cjs <workspace> <relative-map.json> [--inventory <relative.json>] [--research-inputs <relative.json>] [--require-reviewed] [--require-reading-review]');
 let inventoryPath,researchPath,requireReviewed=false,requireReadingReview=false;for(let i=0;i<args.length;i++){if(args[i]==='--inventory'&&args[i+1])inventoryPath=args[++i];else if(args[i]==='--research-inputs'&&args[i+1])researchPath=args[++i];else if(args[i]==='--require-reviewed')requireReviewed=true;else if(args[i]==='--require-reading-review')requireReadingReview=true;else throw Error("Unknown argument: "+args[i])}
 const map=readWithin(workspace,file),graphFile=path.join(workspace,'research-graph.json'),result=checkMap(map,{workspace,requireReadingReview,inventory:inventoryPath?readWithin(workspace,inventoryPath):undefined,researchInputs:researchPath?readWithin(workspace,researchPath,32*1024*1024):undefined,graph:fs.existsSync(graphFile)?JSON.parse(fs.readFileSync(graphFile,'utf8')):undefined});
 if(requireReviewed&&map.review.status!=='reviewed')throw Error("The map has not yet passed an independent semantic check.");console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={checkMap,readWithin};
