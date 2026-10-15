// Provenance contains no second copy of values: entries bind metadata to fields
// of an immutable record version. The archived registry preserves corrections.
const technical=new Set(['id','type','evidenceRefs','supersedes','correctionReason','displayOrder','researchRevision'])
const excluded=new Set(['Assertion','SourceDocument','SourceUnit'])
function fields(record){return excluded.has(record.type)?[]:Object.keys(record).filter(k=>!technical.has(k)&&k!=='projection'&&k!=='stale')}
function valueHash(record,selected){const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;return require('crypto').createHash('sha256').update(JSON.stringify(canonical(Object.fromEntries(selected.map(f=>[f,record[f]]))))).digest('hex')}
function active(entries=[]){const retired=new Set(entries.flatMap(e=>e.supersedes||[]));return entries.filter(e=>!retired.has(e.id))}
function gaps(data){const retired=new Set(data.records.flatMap(r=>r.supersedes||[])),entries=new Map();for(const e of active(data.fieldProvenance)){if(!entries.has(e.recordId))entries.set(e.recordId,[]);entries.get(e.recordId).push(e)}return data.records.filter(r=>!retired.has(r.id)).flatMap(r=>{const selected=fields(r);if(!selected.length)return [];const covered=new Set((entries.get(r.id)||[]).filter(e=>e.valueHash===valueHash(r,e.fields)).flatMap(e=>e.fields));const missing=selected.filter(f=>!covered.has(f));return missing.length?[{recordId:r.id,fields:missing}]:[]})}

function forRecord(data,id){return active(data.fieldProvenance).filter(e=>e.recordId===id)}
module.exports={fields,active,gaps,forRecord,valueHash}
