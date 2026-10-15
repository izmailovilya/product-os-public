const path=require('path'),fs=require('fs')
const {read,source,load,summary}=require('./store')
const {validate}=require('./schema')
function main(args=process.argv.slice(2)) {
 const [mode='audit',root='.',...rest]=args,workspace=path.resolve(root)
 if(require('../edition').isPublicEdition()&&!['read','source','summary','audit'].includes(mode))throw new Error('В Product OS Public доступны research read|source|summary|audit')
 let result
 if(mode==='read')result=read(workspace,Object.fromEntries(rest.map(s=>s.split('='))))
 else if(mode==='summary')result=summary(workspace,Object.fromEntries(rest.map(s=>{const at=s.indexOf('=');if(at<1)throw new Error('summary options must use key=value');return [s.slice(0,at),s.slice(at+1)]})))
 else if(mode==='source')result=source(workspace,rest[0])
 else if(mode==='audit'){ const d=load(workspace),g=JSON.parse(fs.readFileSync(path.join(workspace,'research-graph.json')));validate(d,{workspace,graph:g});const gaps=[...require('./provenance').gaps(d),...require('./provenance').active(d.fieldProvenance).filter(p=>p.mapping!=='reviewed').map(p=>({recordId:p.recordId,fields:p.fields,reason:'inherited_unresolved'}))];const selected=rest.find(x=>x.startsWith('checkpoint='))?.slice(11).split(',');const checkpoints=selected?d.checkpoints.filter(c=>selected.includes(c.id)):d.checkpoints;if(selected&&checkpoints.length!==new Set(selected).size)throw new Error('Unknown audit checkpoint');const unitBy=new Map(d.records.filter(r=>r.type==='SourceUnit').map(r=>[r.id,r]));const relevant=id=>{const r=d.records.find(r=>r.id===id);return r.evidenceRefs?.some(e=>{const u=unitBy.get(e.sourceUnitId);return checkpoints.some(c=>c.sourceIds.includes(u.sourceId)&&(!c.sourceRanges||c.sourceRanges.some(range=>range.sourceId===u.sourceId&&range.startLine<=u.locator.startLine&&range.endLine>=u.locator.endLine)))})};const scopedGaps=selected?gaps.filter(g=>relevant(g.recordId)):gaps;result={revision:d.revision,records:d.records.length,scope:selected||'whole_registry',checkpoints,fieldProvenanceGaps:scopedGaps,complete:!scopedGaps.length&&checkpoints.length>0&&checkpoints.every(c=>c.status==='complete')} }
 else if(['ingest','full','synthesize','reconcile'].includes(mode)) {
  if(!rest[0])throw new Error('Provide a reviewed operations package; extraction requires product-interviews content workflow')
  const input=JSON.parse(fs.readFileSync(path.resolve(rest[0])))
  if(mode==='synthesize' && input.operations.some(o=>o.op==='research-put'&&!['SynthesisRevision','MembershipAssertion'].includes(o.record.type)))throw new Error('synthesize cannot edit individual facts')
  result=require('../graph/writer').applyOperations(workspace,input,{dry:rest.includes('--dry')})
 }else throw new Error('research summary|read|source|audit|ingest|synthesize|full|reconcile <workspace> [package.json | key=value]')
 console.log(JSON.stringify(result.graph ? { graphRevision: result.graph.revision, research: result.research, warnings: result.warnings, dry: rest.includes('--dry') } : result,null,2));return result
}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1}
module.exports={main}
