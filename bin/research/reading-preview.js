// Optional, read-only design specimen. It is never written back as research facts.
const fs=require('fs'),path=require('path')
function read(workspace,personId){
 const file=path.join(workspace,'reports','ui-previews','research-reading.json');if(!fs.existsSync(file))return null;
 if(!fs.realpathSync(file).startsWith(fs.realpathSync(workspace)+path.sep))throw Error('Preview must stay inside workspace');
 if(fs.statSync(file).size>200000)throw Error('Reading preview is too large');
 const model=JSON.parse(fs.readFileSync(file,'utf8'));if(model.personId!==personId)return null;
 const data=require('./store').load(workspace),retired=new Set(data.records.flatMap(r=>r.supersedes||[])),ids=new Set(data.records.filter(r=>!retired.has(r.id)).map(r=>r.id));
 if(model.researchRevision!==data.revision)return {stale:true};
 if(model.schemaVersion!==1||!Array.isArray(model.blocks)||model.blocks.length>12||!model.blocks.every(b=>typeof b.title==='string'&&typeof b.text==='string'&&Array.isArray(b.recordIds)&&b.recordIds.length&&b.recordIds.every(id=>ids.has(id))))throw Error('Invalid reading preview');
 return {...model,stale:false};
}
module.exports={read}
