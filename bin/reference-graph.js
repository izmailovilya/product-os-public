// Read-only structural index of a registered reference library. This is an
// artifact graph, separate from the business research graph's fixed ontology.
const fs = require('node:fs')
const path = require('node:path')
const {createHash} = require('node:crypto')
const {loadLibrary,packageFile,referenceCardHash} = require('./console/product-references')

const hash = value => createHash('sha256').update(value).digest('hex')
const id = (kind,...keys) => 'ref-'+kind+'-'+hash(JSON.stringify(keys)).slice(0,24)
const text = (v,max=600) => typeof v === 'string' && v.trim() && v.length <= max
const normalize = v => String(v || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
function jsonFile(workspace,relative) {
 const file=packageFile(workspace,relative)
 if(fs.statSync(file).size>20*1024*1024)throw Error('Reference metadata file is too large')
 return JSON.parse(fs.readFileSync(file,'utf8'))
}
function annotations(workspace,relative,rows,issues) {
 const types=new Map(), assignments=new Map()
 if(!relative)return {types,assignments}
 try {
  const metadata=jsonFile(workspace,relative)
  if(metadata.schemaVersion!==1||!Array.isArray(metadata.types)||metadata.types.length>500||!Array.isArray(metadata.assignments)||metadata.assignments.length>10000)throw Error('Invalid type metadata schema')
  for(const t of metadata.types){
   if(!/^[a-z][a-z0-9-]{0,79}$/.test(t?.id||'')||!text(t.label,180)||types.has(t.id)||t.parentId!=null&&!text(t.parentId,80))throw Error('Invalid or repeated element type')
   types.set(t.id,{id:t.id,label:t.label,parentId:t.parentId||null})
  }
  for(const t of types.values()){
   const seen=new Set([t.id]);let parent=t.parentId
   while(parent){if(!types.has(parent)||seen.has(parent))throw Error('Unknown or cyclic type parent');seen.add(parent);parent=types.get(parent).parentId}
  }
  const cards=new Map(rows.map(r=>[r.card.id,r.card])),seen=new Set()
  for(const a of metadata.assignments){
   const card=cards.get(a?.cardId),key=a?.cardId+'|'+a?.part+'|'+(a?.part==='step'?a.stepIndex:'')
   if(!card||!['example','step'].includes(a.part)||a.part==='step'&&(!Number.isInteger(a.stepIndex)||a.stepIndex<0||a.stepIndex>=card.steps?.length)||
     a.basedOnCardSha256!==referenceCardHash(card)||a.basis!=='editor_classification'||!text(a.rationale)||
     !Array.isArray(a.typeIds)||!a.typeIds.length||new Set(a.typeIds).size!==a.typeIds.length||a.typeIds.some(t=>!types.has(t))||seen.has(key)){
    issues.push({code:'invalid-or-stale-type-assignment',cardId:a?.cardId||null,stepIndex:a?.stepIndex??null});continue
   }
   seen.add(key);assignments.set(key,a)
  }
 }catch(error){types.clear();assignments.clear();issues.push({code:'element-types-unavailable',detail:error.message})}
 return {types,assignments}
}
function build(workspace,graph,options={}) {
 const products=(graph.nodes||[]).filter(n=>n.type==='product')
 const productId=options.productId||(products.length===1?products[0].id:null)
 if(!productId)throw Error('Specify productId for this workspace')
 const library=loadLibrary(workspace,graph,productId,options.library)
 if(library.state!=='ready')throw Error('Registered reference library is not readable: '+library.state)
 const manifest=jsonFile(workspace,library.library.manifestFile),issues=library.issues.map(detail=>({code:'library-issue',detail}))
 const tags=annotations(workspace,manifest.referenceTypesPath,library.cards,issues)
 const nodes=new Map(),edges=[],edgeKeys=new Set(),bindings=new Map(),records=new Map()
 const add=n=>{if(nodes.has(n.id))return nodes.get(n.id);nodes.set(n.id,n);return n}
 const edge=(from,type,to,data)=>{const key=JSON.stringify([from,type,to]);if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push({from,type,to,...(data?{data}:{})})}}
 const bind=p=>{if(!bindings.has(p)){const file=packageFile(workspace,p);bindings.set(p,{path:p,sha256:hash(fs.readFileSync(file))})}}
 const lib=manifest.libraryId||library.library.artifactId,namespace=productId+':'+lib
 const root=add({id:id('library',namespace),kind:'library',artifactId:library.library.artifactId,key:lib,label:manifest.title,record:{file:library.library.manifestFile,pointer:''}})
 bind(library.library.manifestFile);if(manifest.referenceTypesPath&&tags.types.size)bind(manifest.referenceTypesPath)
 for(const t of tags.types.values()){
  const node=add({id:id('type',namespace,t.id),kind:'element-type',key:t.id,label:t.label,parentId:t.parentId})
  edge(root.id,'defines_type',node.id)
  if(t.parentId)edge(node.id,'subtype_of',id('type',namespace,t.parentId))
 }
 const rivals=(graph.nodes||[]).filter(n=>n.type==='competitor')
 const attachTypes=(node,card,part,stepIndex)=>{
  const a=tags.assignments.get(card.id+'|'+part+'|'+(part==='step'?stepIndex:''))
  if(a)for(const key of a.typeIds)edge(node.id,'classified_as',id('type',namespace,key),{basis:a.basis,rationale:a.rationale,annotationFile:manifest.referenceTypesPath})
 }
 for(const row of library.cards){
  const card=row.card,track=manifest.tracks.find(t=>t.key===row.trackKey)
  if(!text(card.product?.id,180)||!text(card.product?.name,180)){issues.push({code:'missing-reference-product',cardId:card.id});continue}
  if(!records.has(track.cardsPath))records.set(track.cardsPath,jsonFile(workspace,track.cardsPath).cards)
  if(!records.has(track.sourcesPath))records.set(track.sourcesPath,jsonFile(workspace,track.sourcesPath).sources)
  bind(track.cardsPath);bind(track.sourcesPath)
  const cardIndex=records.get(track.cardsPath).findIndex(c=>c.id===card.id),pointer='/cards/'+cardIndex
  const rivalIds=rivals.filter(n=>[n.label,...(n.data?.aliases||[])].some(name=>normalize(name)===normalize(card.product.name))).map(n=>n.id)
  const product=add({id:id('product',namespace,card.product.id),kind:'reference-product',key:card.product.id,label:card.product.name,researchNodeIds:rivalIds})
  const direction=add({id:id('direction',namespace,card.product.id,row.trackKey),kind:'direction',key:row.trackKey,productKey:card.product.id,label:row.trackTitle})
  const example=add({id:id('example',namespace,card.id),kind:'example',key:card.id,productKey:card.product.id,trackKey:row.trackKey,record:{file:track.cardsPath,pointer},basedOnCardSha256:referenceCardHash(card),observationType:card.observationType,verificationStatus:card.verification?.status||null})
  edge(root.id,'contains',product.id);edge(product.id,'contains',direction.id);edge(direction.id,'contains',example.id);attachTypes(example,card,'example')
  const sourceNodes=new Map(),mediaNodes=new Map()
  const sourceNode=sourceId=>{
   if(sourceNodes.has(sourceId))return sourceNodes.get(sourceId)
   const index=records.get(track.sourcesPath).findIndex(s=>s.id===sourceId)
   if(index<0){issues.push({code:'missing-source',cardId:card.id,sourceId});return null}
   const source=records.get(track.sourcesPath)[index]
   const node=add({id:id('source',namespace,row.trackKey,sourceId),kind:'source',key:sourceId,url:source.url||null,record:{file:track.sourcesPath,pointer:'/sources/'+index}})
   sourceNodes.set(sourceId,node);return node
  }
  for(const sourceId of new Set([...(card.sourceIds||[]),card.primarySourceId,...(card.claims||[]).map(c=>c.sourceId)].filter(Boolean))){const s=sourceNode(sourceId);if(s)edge(example.id,'references_source',s.id)}
  for(const [index,m] of (card.media||[]).entries()){
   if(!text(m.id,180)||mediaNodes.has(m.id)){issues.push({code:'invalid-media-id',cardId:card.id});continue}
   const node=add({id:id('image',namespace,card.id,m.id),kind:'image',key:m.id,cardId:card.id,path:m.path,record:{file:track.cardsPath,pointer:pointer+'/media/'+index},imageSha256:m.sha256||m.imageSHA256||null})
   mediaNodes.set(m.id,node);edge(example.id,'has_image',node.id)
   if(m.sourceId){const s=sourceNode(m.sourceId);if(s)edge(node.id,'references_source',s.id)}
  }
  let previous=null
  for(const [index,step] of (card.steps||[]).entries()){
   const node=add({id:id('step',namespace,card.id,index),kind:'step',key:card.id+':'+index,cardId:card.id,stepIndex:index,order:step.order??null,productKey:card.product.id,trackKey:row.trackKey,record:{file:track.cardsPath,pointer:pointer+'/steps/'+index},basedOnCardSha256:referenceCardHash(card)})
   edge(example.id,'contains',node.id);attachTypes(node,card,'step',index)
   // Storage/gallery order is explicitly not an observed causal transition.
   if(previous)edge(previous.id,'listed_next',node.id,{basis:'stored_array_order',observedTransition:false})
   previous=node
   for(const mediaId of step.screenshotIds||[]){const m=mediaNodes.get(mediaId);if(m)edge(node.id,'has_image',m.id);else issues.push({code:'missing-step-image',cardId:card.id,stepIndex:index,mediaId})}
  }
 }
 return {schemaVersion:1,kind:'product-reference-graph',productId,libraryId:lib,artifactId:library.library.artifactId,researchGraphRevision:graph.revision??null,rootId:root.id,
  sourceScope:'registered checked library; type labels are editor classifications; structural edges do not establish observed transitions or causal effects',
  basedOnInputs:[...bindings.values()].sort((a,b)=>a.path.localeCompare(b.path)),nodes:[...nodes.values()],edges,issues,
  counts:Object.fromEntries([...new Set([...nodes.values()].map(n=>n.kind))].map(k=>[k,[...nodes.values()].filter(n=>n.kind===k).length]))}
}
function query(workspace,index,options={}) {
 const map=new Map(index.nodes.map(n=>[n.id,n])),incoming=new Map(),outgoing=new Map(),files=new Map()
 const resolve=record=>{if(!files.has(record.file))files.set(record.file,jsonFile(workspace,record.file));let v=files.get(record.file);for(const p of record.pointer.split('/').slice(1))v=v[p.replace(/~1/g,'/').replace(/~0/g,'~')];return v}
 for(const e of index.edges){if(!incoming.has(e.to))incoming.set(e.to,[]);incoming.get(e.to).push(e);if(!outgoing.has(e.from))outgoing.set(e.from,[]);outgoing.get(e.from).push(e)}
 const summary=n=>({...Object.fromEntries(['id','kind','key','label','url','record'].filter(k=>n[k]!=null).map(k=>[k,n[k]])),...(['example','step'].includes(n.kind)?{label:resolve(n.record).title}: {})})
 const hydrate=n=>{
  const chain=[];let current=n
  while(current){chain.unshift(summary(current));const parent=(incoming.get(current.id)||[]).find(e=>e.type==='contains');current=parent?map.get(parent.from):null}
  const example=chain.find(p=>p.kind==='example'),imageEdges=(outgoing.get(n.id)||[]).filter(e=>e.type==='has_image')
  const images=imageEdges.map(e=>map.get(e.to)).map(m=>({...summary(m),path:m.path,imageSha256:m.imageSha256,sources:(outgoing.get(m.id)||[]).filter(e=>e.type==='references_source').map(e=>summary(map.get(e.to)))}))
  const sources=(outgoing.get(n.id)||[]).filter(e=>e.type==='references_source').map(e=>summary(map.get(e.to)))
  const card=example?resolve(example.record):null
  const context=card?{cardId:card.id,title:card.title,product:card.product,observationType:card.observationType,verification:card.verification,gaps:card.gaps}:null
  return {node:summary(n),chain,details:n.kind==='example'?{title:card.title,description:card.description,record:example.record}:n.record?resolve(n.record):null,images,sources,context,
   types:(outgoing.get(n.id)||[]).filter(e=>e.type==='classified_as').map(e=>({type:summary(map.get(e.to)),basis:e.data.basis,rationale:e.data.rationale})),
   parents:(incoming.get(n.id)||[]).filter(e=>e.type==='contains').map(e=>summary(map.get(e.from))),children:(outgoing.get(n.id)||[]).filter(e=>e.type==='contains').map(e=>summary(map.get(e.to))),
   relations:Object.fromEntries([['incoming',incoming.get(n.id)||[],e=>e.from],['outgoing',outgoing.get(n.id)||[],e=>e.to]].map(([direction,edges,endpoint])=>[direction,{total:edges.length,items:edges.slice(0,100).map(e=>({relation:e.type,node:summary(map.get(endpoint(e))),data:e.data||null})),truncated:edges.length>100}]))}
 }
 if(options.id){const n=map.get(options.id);return {schemaVersion:1,artifactId:index.artifactId,found:Boolean(n),result:n?hydrate(n):null,issues:index.issues}}
 const type=options.type?index.nodes.find(n=>n.kind==='element-type'&&n.key===options.type):null
 if(options.type&&!type)throw Error('Unknown element type: '+options.type)
 const wantedTypes=new Set(type?[type.id]:[])
 if(type){let changed=true;while(changed){changed=false;for(const e of index.edges)if(e.type==='subtype_of'&&wantedTypes.has(e.to)&&!wantedTypes.has(e.from)){wantedTypes.add(e.from);changed=true}}}
 const classified=new Set(index.edges.filter(e=>e.type==='classified_as'&&wantedTypes.has(e.to)).map(e=>e.from))
 const products=index.nodes.filter(n=>n.kind==='reference-product'&&(!options.competitor||[n.key,n.label,...n.researchNodeIds].some(v=>normalize(v)===normalize(options.competitor))))
 const keys=new Set(products.map(p=>p.key))
 const matches=index.nodes.filter(n=>['example','step'].includes(n.kind)&&keys.has(n.productKey)&&(!options.track||n.trackKey===options.track)&&(!type||classified.has(n.id))&&(!options.kind||n.kind===options.kind))
 const limit=options.limit==null?20:Number(options.limit),cursor=options.cursor==null?0:Number(options.cursor)
 if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(cursor)||cursor<0)throw Error('limit must be 1–100 and cursor a nonnegative integer')
 return {schemaVersion:1,artifactId:index.artifactId,libraryId:index.libraryId,query:options,total:matches.length,limit,cursor,nextCursor:cursor+limit<matches.length?cursor+limit:null,
  results:matches.slice(cursor,cursor+limit).map(hydrate),issues:index.issues,
  coverageNote:'No match means no currently annotated saved example, not absence of this feature in a competitor. Current builds and source continuity retain their original gaps.'}
}
function typeList(index){return index.nodes.filter(n=>n.kind==='element-type').map(n=>{
 const types=new Set([n.id]);let changed=true
 while(changed){changed=false;for(const e of index.edges)if(e.type==='subtype_of'&&types.has(e.to)&&!types.has(e.from)){types.add(e.from);changed=true}}
 const instances=new Set(index.edges.filter(e=>e.type==='classified_as'&&types.has(e.to)).map(e=>e.from))
 return {...n,directAssignments:index.edges.filter(e=>e.type==='classified_as'&&e.to===n.id).length,matchingElements:instances.size,
  productsCount:new Set(index.nodes.filter(v=>instances.has(v.id)).map(v=>v.productKey)).size}
})}
// Assembly can validate a new saved manifest before graph registration. The
// prospective artifact is local to this call; no research graph is written.
function buildFromManifest(workspace,graph,{manifestFile,artifactId,productId}){
 if(!text(artifactId,180)||!text(productId,180))throw Error('Assembly needs the prospective artifactId and productId')
 const manifest=jsonFile(workspace,manifestFile)
 if(manifest.productId!==productId)throw Error('Staged manifest belongs to another product')
 if(!(graph.nodes||[]).some(n=>n.id===productId&&n.type==='product'))throw Error('Staged product is not in this workspace')
 const existing=(graph.nodes||[]).find(n=>n.id===artifactId)
 if(existing&&(existing.type!=='artifact'||existing.data?.artifactKind!=='product-reference-library'||existing.data.productId!==productId))throw Error('Prospective artifact conflicts with an existing graph identity')
 const prospective={id:artifactId,type:'artifact',label:manifest.title,data:{artifactKind:'product-reference-library',productId,manifestFile}}
 return build(workspace,{...graph,nodes:[...(graph.nodes||[]).filter(n=>n.id!==artifactId),prospective]},{productId,library:artifactId})
}
async function main(argv){
 const [command,workspaceArg,...filters]=argv
 if(!['graph','read','types'].includes(command)||!workspaceArg)throw Error('Usage: references graph|read|types <workspace> [productId=…] [library=…] [competitor=…] [track=…] [type=…] [id=…] [limit=20] [cursor=0]')
 const options={};for(const f of filters){const at=f.indexOf('=');if(at<1||!['productId','library','competitor','track','type','id','limit','cursor','kind'].includes(f.slice(0,at)))throw Error('Unknown reference filter: '+f);options[f.slice(0,at)]=f.slice(at+1)}
 const workspace=fs.realpathSync(path.resolve(workspaceArg)),{workspaceLock,recoverPending}=require('./graph/storage'),release=workspaceLock(workspace)
 let result
 try{recoverPending(workspace);const graph=JSON.parse(fs.readFileSync(path.join(workspace,'research-graph.json'),'utf8')),index=build(workspace,graph,options)
  result=command==='graph'?index:command==='types'?{schemaVersion:1,artifactId:index.artifactId,types:typeList(index),issues:index.issues}:query(workspace,index,options)
 }finally{release()}
 console.log(JSON.stringify(result,null,2));return result
}
module.exports={build,buildFromManifest,query,typeList,main}
