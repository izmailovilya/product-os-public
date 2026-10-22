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
  if(researchInputs.version!==1||researchInputs.productId!==map.scope?.productId||!Array.isArray(researchInputs.jobs)||hash!==fingerprint(body))fail('Повреждён или не соответствует продукту вход исследования.');
  if(liveRegistry&&current.fingerprint!==researchInputs.fingerprint)fail('Вход исследования устарел или неполон: перечитайте текущий реестр.');
 }
 const evidenceInputs=liveRegistry?current:researchInputs||current,researchRows=new Map((evidenceInputs?.jobs||[]).map(row=>[row.id,row]));
 const refs=(items,where)=>{if(!Array.isArray(items))return fail(where+': ожидаются sourceRefs.');for(const id of items)if(!Object.hasOwn(sources,id))fail(where+': неизвестный источник '+id)};
 for(const key of ['title','basis'])if(!nonempty(map[key]))fail('Не заполнено '+key);
 if(!nonempty(map.scope?.productId)||!nonempty(map.scope?.goal))fail('Не заполнены продукт и цель карты.');
 for(const [id,s] of Object.entries(sources))for(const key of ['kind','title','text'])if(!nonempty(s?.[key]))fail('Источник '+id+': не заполнено '+key);
 if(workspace)for(const [id,s] of Object.entries(sources))if(s.path){try{fileWithin(workspace,s.path)}catch{fail('Источник '+id+': локальный файл не найден или выходит за workspace.')}}
 const used=new Set();
 for(const g of map.graphs){
  for(const key of ['note','boundary'])if(!nonempty(g[key]))fail('Граф '+g.id+': не заполнено '+key);
  const parents=new Map(g.jobIds.map(id=>[id,[]])),seen=new Set();
  for(const edge of g.edges){const key=edge.from+'\0'+edge.to;if(seen.has(key))fail('Граф '+g.id+': повтор ребра');seen.add(key);parents.get(edge.from).push(edge.to);if(!nonempty(edge.why))fail('Ребро '+edge.from+' → '+edge.to+': нет объяснения');if(!['hypothesis','owner','source'].includes(edge.basis))fail('Ребро '+edge.from+': нет происхождения');refs(edge.sourceRefs,'Ребро '+edge.from)}
  const connected=new Map([[g.id,true]]);function reaches(id){if(!connected.has(id))connected.set(id,parents.get(id).some(reaches));return connected.get(id)}
  for(const id of g.jobIds){used.add(id);if(!reaches(id))fail('Работа '+id+': нет пути к цели графа '+g.id)}
 }
 for(const [id,j] of Object.entries(map.jobs)){
  if(!used.has(id))fail('Работа '+id+' не показана ни в одном фрагменте.');
  for(const key of ['description','input','output','mechanism','alternatives'])if(!nonempty(j[key]))fail('Работа '+id+': не заполнено '+key);
  if(!['original','higher','bridge','external','proposed'].includes(j.kind))fail('Работа '+id+': неизвестная роль');
  if(!['hypothesis','owner','source'].includes(j.basis))fail('Работа '+id+': не указано происхождение');refs(j.sourceRefs,'Работа '+id);
  if(Object.hasOwn(j,'criteria'))fail('Работа '+id+': общие критерии нельзя приписывать разным сегментам.');
  for(const edition of ['full','public']){const x=j[edition];for(const key of ['contribution','limit'])if(!nonempty(x[key]))fail('Работа '+id+'/'+edition+': не заполнено '+key);refs(x.sources,'Работа '+id+'/'+edition);if(x.state==='ready'&&!x.sources.length)fail('Работа '+id+'/'+edition+': процедура ready без основания.');if(x.state==='change'&&!nonempty(j.change))fail('Работа '+id+': не описана необходимая доработка.')}
 }
 for(const c of map.contexts){if(Boolean(c.segmentId)===Boolean(c.ideaId))fail('Связь '+c.id+': нужен ровно один настоящий segmentId или ideaId.');if(Object.hasOwn(c,'criteria'))fail('Связь '+c.id+': нельзя хранить общий набор критериев.');for(const id of c.excludedJobIds||[])if(!map.jobs[id])fail('Связь '+c.id+': неизвестное исключение '+id)}
 const ledger=map.inventory;
 if(!Array.isArray(ledger))fail('Нет inventory исходных работ.');
 else{
  const ids=new Set();for(const row of ledger){if(!nonempty(row.id)||ids.has(row.id)||!nonempty(row.text)||!nonempty(row.reason)||!Array.isArray(row.jobIds))fail('Некорректная запись inventory.');ids.add(row.id);for(const id of row.jobIds||[])if(!map.jobs[id])fail('Inventory '+row.id+': неизвестная работа '+id);if(!row.jobIds?.length&&row.decision!=='out_of_scope')fail('Inventory '+row.id+': пункт потерян без явного исключения.')}
  if(inventory){const expected=new Map(inventory.map(row=>[row.id,row.text]));for(const row of ledger){if(researchRows.has(row.id)&&!expected.has(row.id))continue;if(!expected.has(row.id)||expected.get(row.id)!==row.text)fail('Inventory '+row.id+': изменён или придуман входной пункт.');expected.delete(row.id)}for(const id of expected.keys())fail('Inventory: потерян входной пункт '+id)}
  for(const row of ledger)if(typeof row.id==='string'&&row.id.startsWith('research:')&&!researchRows.has(row.id))fail('Inventory '+row.id+': работа отсутствует в текущем входе исследования.');
  for(const [id,expected] of researchRows){
   const row=ledger.find(r=>r.id===id);
   if(!row){fail('Inventory: потеряна работа из исследования '+expected.evidence.recordId);continue}
   if(row.text!==expected.text||!isDeepStrictEqual(row.evidence,expected.evidence))fail('Inventory '+id+': изменены формулировка, контекст или основания работы респондента.');
   if(!row.jobIds?.length||row.decision==='out_of_scope')fail('Inventory '+id+': собранная работа должна быть видна на карте, в том числе за пределами продукта.');
   refs(row.sourceRefs,'Inventory '+id);
   if(!row.sourceRefs?.length||!(row.jobIds||[]).some(jobId=>map.jobs[jobId]?.sourceRefs?.some(ref=>row.sourceRefs?.includes(ref))))fail('Inventory '+id+': нет связи основания с показанной работой.');
  }
 }
 if(!evidenceInputs)warnings.push('Реестр исследования не проверен: полнота по работам респондентов не установлена.');
 else if(researchInputs&&!liveRegistry)warnings.push('Проверен только переданный снимок исследования; его актуальность в исходном реестре не установлена.');
 else if(!liveRegistry)warnings.push('Типизированного реестра нет. Проверьте сохранённые разборы: это не доказательство отсутствия интервью.');
 else if(evidenceInputs.coverage.unprocessedUnits||evidenceInputs.coverage.checkpoints.some(c=>c.status!=='complete'))warnings.push('Полнота по сохранённым работам не означает полноту разбора интервью: есть незавершённые части реестра.');
 if(!['reviewed','unreviewed'].includes(map.review?.status))fail('Не указан статус смысловой проверки.');
 refs(map.review?.sourceRefs,'Review');
 if(map.review?.status==='reviewed'&&!map.review.sourceRefs?.length)fail('Review: нет сохранённого разбора.');
 let readingReview;
 if(requireReadingReview||map.review?.readingReview){
  try{
   const receipt=map.review?.readingReview;
   if(!workspace||!receipt?.path||!receipt.sha256)throw Error('нет сохранённой независимой проверки текста.');
   const bytes=fs.readFileSync(fileWithin(workspace,receipt.path,4*1024*1024));
   if(require('node:crypto').createHash('sha256').update(bytes).digest('hex')!==receipt.sha256)throw Error('изменён файл проверки текста.');
   readingReview=checkReadingReview(map,JSON.parse(bytes));
  }catch(error){fail('Проверка текста: '+error.message)}
 }
 if(graph){if(!graph.nodes.some(n=>n.id===map.scope?.productId&&n.type==='product'&&n.status!=='dropped'&&!n.data?.retired))fail('Продукт карты не найден.');const segments=new Set(graph.nodes.filter(n=>n.type==='segment'&&n.status!=='dropped'&&!n.data?.retired).map(n=>n.id));let ideas;for(const c of map.contexts){if(c.segmentId&&!segments.has(c.segmentId))fail('Связь '+c.id+': сегмент не найден.');if(c.ideaId){ideas??=new Set(graph.nodes.filter(n=>n.type==='artifact'&&n.data?.artifactKind==='audience-ideas'&&n.status!=='dropped'&&!n.data?.retired).flatMap(n=>(n.data.ideas||[]).map(i=>n.id+':'+i.id)));if(!ideas.has(c.ideaId))fail('Связь '+c.id+': отложенная идея не найдена.')}}}
 else warnings.push('Граф workspace не предоставлен: ссылки на продукт и сегменты не проверены.');
 if(errors.length)throw Error(errors.join('\n'));
 return {valid:true,jobs:Object.keys(map.jobs).length,graphs:map.graphs.length,associations:map.contexts.length,inventory:ledger.length,review:map.review.status,...(readingReview?{readingReview}:{}),evidenceCoverage:evidenceInputs?{status:liveRegistry?'checked':researchInputs?'snapshot_only':'no_registry',registeredJobs:researchRows.size,revision:evidenceInputs.revision,factRevision:evidenceInputs.factRevision}: {status:'unchecked'},warnings,semanticReview:'Соответствие смысла и качество оснований проверяются человеком/независимым критиком отдельно.'};
}
function fileWithin(workspace,relative,maxBytes=32*1024*1024){
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('\\'))throw Error('Нужен относительный путь внутри workspace.');
 const root=fs.realpathSync(workspace),file=fs.realpathSync(path.resolve(root,relative));if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile()||fs.statSync(file).size>maxBytes)throw Error('Недопустимый путь или размер файла.');return file;
}
function readWithin(workspace,relative,maxBytes=4*1024*1024){return JSON.parse(fs.readFileSync(fileWithin(workspace,relative,maxBytes),'utf8'))}
if(require.main===module){try{
 const [workspace,file,...args]=process.argv.slice(2);if(!workspace||!file)throw Error('Usage: check-map.cjs <workspace> <relative-map.json> [--inventory <relative.json>] [--research-inputs <relative.json>] [--require-reviewed] [--require-reading-review]');
 let inventoryPath,researchPath,requireReviewed=false,requireReadingReview=false;for(let i=0;i<args.length;i++){if(args[i]==='--inventory'&&args[i+1])inventoryPath=args[++i];else if(args[i]==='--research-inputs'&&args[i+1])researchPath=args[++i];else if(args[i]==='--require-reviewed')requireReviewed=true;else if(args[i]==='--require-reading-review')requireReadingReview=true;else throw Error('Неизвестный аргумент: '+args[i])}
 const map=readWithin(workspace,file),graphFile=path.join(workspace,'research-graph.json'),result=checkMap(map,{workspace,requireReadingReview,inventory:inventoryPath?readWithin(workspace,inventoryPath):undefined,researchInputs:researchPath?readWithin(workspace,researchPath,32*1024*1024):undefined,graph:fs.existsSync(graphFile)?JSON.parse(fs.readFileSync(graphFile,'utf8')):undefined});
 if(requireReviewed&&map.review.status!=='reviewed')throw Error('Карта ещё не прошла независимую смысловую проверку.');console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e.message);process.exitCode=1}}
module.exports={checkMap,readWithin};
