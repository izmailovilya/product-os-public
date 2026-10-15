// Read-only catalogue: the product selects a registered manifest, never a client file path.
const fs = require('node:fs')
const path = require('node:path')
const {packageFile,imageMime} = require('./product-references')
const raster = ['.png','.jpg','.jpeg','.webp','.gif']
const sourceTypes = ['.md','.txt','.json','.jsonl','.pdf',...raster]
const text = (v,max=20000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max
const object = v => v && typeof v === 'object' && !Array.isArray(v)
const id = v => text(v,120) && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(v)
function allowedPath(relative,extensions) {
  return typeof relative === 'string' && /^(reports|sources)\//.test(relative) &&
    !/[\\\u0000-\u001f\u007f]/.test(relative) && relative.split('/').every(p=>p&&!p.startsWith('.')) && extensions.includes(path.posix.extname(relative).toLowerCase())
}
function mediaValid(media) {
  return object(media) && allowedPath(media.path,raster) && text(media.alt,800) && ['width','height'].every(k=>media[k]==null||Number.isInteger(media[k])&&media[k]>0&&media[k]<=20000)
}
function elementValid(row,categories) {
  return object(row)&&id(row.id)&&categories.has(row.category)&&text(row.title,240)&&text(row.summary,2000)&&
    ['proposed','selected','implemented'].includes(row.status)&&['screen-flow','character','exercise','rule','table','text'].includes(row.format)&&
    (row.role==null||text(row.role,120))&&
    ['context','body','text','speech','persona'].every(k=>row[k]==null||text(row[k]))&&
    (row.preview==null||mediaValid(row.preview))&&
    (row.steps==null||Array.isArray(row.steps)&&row.steps.length<=100&&new Set(row.steps.map(s=>s?.id)).size===row.steps.length&&row.steps.every(s=>object(s)&&id(s.id)&&text(s.title,240)&&(s.description==null||text(s.description))&&(s.media==null||mediaValid(s.media))))&&
    (row.sources==null||Array.isArray(row.sources)&&row.sources.length<=100&&row.sources.every(s=>object(s)&&text(s.label,240)&&allowedPath(s.path,sourceTypes)))&&
    (row.relatedIds==null||Array.isArray(row.relatedIds)&&row.relatedIds.length<=100&&row.relatedIds.every(id))&&
    (row.dataRef==null||text(row.dataRef,800))&&
    (row.table==null||object(row.table)&&Array.isArray(row.table.columns)&&row.table.columns.length>0&&row.table.columns.length<=12&&row.table.columns.every(c=>text(c,240))&&Array.isArray(row.table.rows)&&row.table.rows.length<=200&&row.table.rows.every(r=>Array.isArray(r)&&r.length===row.table.columns.length&&r.every(c=>typeof c==='string'&&c.length<=5000)))
}
function checkedElement(workspace,row) {
  const copy=structuredClone(row)
  const media=[copy.preview,...(copy.steps||[]).map(s=>s.media)].filter(Boolean)
  for(const picture of media){delete picture.previewURL;try{packageFile(workspace,picture.path,raster)}catch(error){if(error.code!=='ENOENT')throw error}}
  for(const source of copy.sources||[]){try{packageFile(workspace,source.path,sourceTypes);source.available=true}catch(error){if(error.code!=='ENOENT')throw error;source.available=false}}
  return copy
}
function loadElements(workspace,graph,productId) {
  const product=(graph.nodes||[]).find(n=>n.id===productId&&n.type==='product')
  const artifactId=product?.data?.productElementCatalogArtifactId
  const artifact=(graph.nodes||[]).find(n=>n.id===artifactId&&n.type==='artifact'&&n.data?.artifactKind==='product-element-catalog'&&n.data.productId===productId)
  const base={productId,state:'unregistered',categories:[],elements:[],issues:[],message:'Элементы продукта пока не добавлены.'}
  if(!artifact)return base
  try {
    if(!allowedPath(artifact.data.manifestFile,['.json'])||!artifact.data.manifestFile.startsWith('reports/'))throw Error()
    const file=packageFile(workspace,artifact.data.manifestFile)
    if(fs.statSync(file).size>20*1024*1024)throw Error()
    const manifest=JSON.parse(fs.readFileSync(file,'utf8'))
    if(!object(manifest)||manifest.schemaVersion!==1)return {...base,state:'unsupported',message:'Версия каталога не поддерживается.'}
    if(manifest.productId!==productId||(manifest.title!=null&&!text(manifest.title,240))||!Array.isArray(manifest.categories)||manifest.categories.length>100||!Array.isArray(manifest.elements)||manifest.elements.length>3000)throw Error()
    const categories=new Set(),elements=new Set(),result={...base,state:'ready',title:manifest.title||'Элементы продукта',manifestFile:artifact.data.manifestFile,artifactId:artifact.id,message:''}
    for(const category of manifest.categories){if(!object(category)||!id(category.id)||!text(category.title,160)||categories.has(category.id))throw Error();categories.add(category.id);result.categories.push({id:category.id,title:category.title})}
    for(const row of manifest.elements){try{if(!elementValid(row,categories)||elements.has(row.id))throw Error();const checked=checkedElement(workspace,row);elements.add(row.id);result.elements.push(checked)}catch{result.issues.push('Один элемент повреждён или ссылается на недопустимый файл и пропущен. Остальные элементы доступны.')}}
    return result
  }catch(error){return {...base,state:error.code==='ENOENT'?'awaiting':'error',message:error.code==='ENOENT'?'Каталог зарегистрирован, но его материалы ещё не сохранены.':'Не удалось прочитать каталог. Проверьте сохранённые материалы.'}}
}
function elementImage(workspace,graph,params) {
  const data=loadElements(workspace,graph,params.productId)
  const row=data.elements.find(r=>r.id===params.element)
  const media=params.step?(row?.steps||[]).find(s=>s.id===params.step)?.media:row?.preview
  if(!media)return null
  try{const file=packageFile(workspace,media.path,raster);if(fs.statSync(file).size>30*1024*1024)return null;const buffer=fs.readFileSync(file),mime=imageMime(buffer,path.extname(file).toLowerCase());return mime?{buffer,mime}:null}catch{return null}
}
module.exports={loadElements,elementImage,allowedPath}
