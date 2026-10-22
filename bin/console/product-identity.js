// Read-only brand reader. Only registered product profiles and their declared files.
const fs=require('node:fs')
const path=require('node:path')
const {createHash}=require('node:crypto')
const {packageFile,imageMime}=require('./product-references')
const {validatePresentation,legacyPresentation}=require('../brand-presentation')
const extensions=['.json','.md','.txt','.html','.htm','.py','.pdf','.svg','.png','.jpg','.jpeg','.webp','.gif','.zip','.ai','.eps','.otf','.ttf','.woff','.woff2','.pptx']
const list=v=>Array.isArray(v)?v:[]
const text=v=>typeof v==='string'&&v.trim().length>0
// Asset validation is shared by the profile and each image/font request. Cache
// hashes and sniffed dimensions together, only while the exact filesystem
// version is unchanged, including ctime; the cache is consulted before reading.
const fileFactsCache=new Map()
function fileFacts(file,version){
  const cached=fileFactsCache.get(file);if(cached?.version===version)return cached
  const buffer=fs.readFileSync(file),facts={version,hash:createHash('sha256').update(buffer).digest('hex'),size:imageSize(buffer)}
  if(fileFactsCache.size>=256)fileFactsCache.delete(fileFactsCache.keys().next().value)
  fileFactsCache.set(file,facts);return facts
}
// Intrinsic raster geometry from header bytes, for legacy presentation
// safeguards. Vectors and unknown formats stay unknown; unknown never excludes.
function imageSize(buffer){
  if(buffer.length>=24&&buffer[0]===0x89&&buffer[1]===0x50)return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)}
  if(buffer.length>=10&&['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6)))return {width:buffer.readUInt16LE(6),height:buffer.readUInt16LE(8)}
  if(buffer.length>=30&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'){
    const chunk=buffer.toString('ascii',12,16)
    if(chunk==='VP8X')return {width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)}
    if(chunk==='VP8 ')return {width:buffer.readUInt16LE(26)&0x3fff,height:buffer.readUInt16LE(28)&0x3fff}
    if(chunk==='VP8L'&&buffer.length>=25){const bits=buffer.readUInt32LE(21);return {width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1}}
    return null
  }
  if(buffer.length>=4&&buffer[0]===0xff&&buffer[1]===0xd8){
    let offset=2
    const limit=Math.min(buffer.length,1<<18)
    while(offset+9<limit){
      if(buffer[offset]!==0xff){offset++;continue}
      const marker=buffer[offset+1]
      if(marker>=0xc0&&marker<=0xcf&&marker!==0xc4&&marker!==0xc8&&marker!==0xcc)return {height:buffer.readUInt16BE(offset+5),width:buffer.readUInt16BE(offset+7)}
      offset+=2+buffer.readUInt16BE(offset+2)
    }
  }
  return null
}
const registrations=(graph,productId)=>list(graph.nodes).filter(n=>n.type==='artifact'&&n.data?.kind==='visual-profile'&&n.data.artifactKind==='brand-identity'&&n.data.productId===productId&&!n.data.channelId)
function loadIdentity(workspace,graph,productId,profileId=''){
 const nodes=registrations(graph,productId),versions=nodes.map(n=>({id:n.id,title:n.label,version:n.data.version,decision:n.data.decision}))
 const base={state:'unregistered',productId,versions,issues:[],message:'Айдентика продукта пока не добавлена.'}
 if(!nodes.length)return base
 const accepted=nodes.filter(n=>n.data.decision==='accepted'),candidates=accepted.length?accepted:nodes
 const heads=candidates.filter(n=>!candidates.some(other=>other.data.supersedes===n.id))
 const chosen=profileId?nodes.find(n=>n.id===profileId):heads.length===1?heads[0]:null
 if(!chosen)return {...base,state:profileId?'missing':'choice',message:profileId?'Версия по этой ссылке не найдена. Выберите доступную версию.':'Сохранено несколько независимых версий. Выберите, какую открыть; общая принятая версия не определена.'}
 const result={...base,state:'ready',artifactId:chosen.id,profileFile:chosen.data.profileFile,message:''}
 try{
  const file=packageFile(workspace,chosen.data.profileFile)
  if(fs.statSync(file).size>5*1024*1024)throw Error()
  const profileBytes=fs.readFileSync(file),profile=JSON.parse(profileBytes)
  if(![1,2,3].includes(profile.schemaVersion))return {...result,state:'unsupported',message:'Версия формата айдентики не поддерживается.'}
  if(profile.product?.id!==productId||profile.version!==chosen.data.version||!['proposed','accepted'].includes(profile.decision)||!Array.isArray(profile.rules)||profile.rules.length>1000||!Array.isArray(profile.files)||profile.files.length>1000||!Array.isArray(profile.sources)||profile.sources.length>1000||profile.rules.some(r=>!r||!text(r.id)||!text(r.topic)||!text(r.value))||profile.files.some(f=>!f||!text(f.id)||!text(f.path)||!text(f.role))||new Set(profile.files.map(f=>f.id)).size!==profile.files.length)throw Error()
  const decision=chosen.data.decision==='accepted'&&profile.decision==='accepted'&&text(profile.decisionSource)&&text(chosen.data.decisionSource)?'accepted':'proposed'
  if(chosen.data.decision!==profile.decision||profile.decision==='accepted'&&decision!=='accepted')result.issues.push('Решение о принятии версии записано неоднозначно. Правила показаны для просмотра; принятие нужно сверить с источником.')
  const files=profile.files.map(f=>{
    // Bytes are read only on a cache miss, and only when something needs
    // them: a declared sha256 to compare or an intrinsic raster size to sniff.
    // Unhashed non-rasters keep the previous no-read projection path.
    let available=false,changed=false,size=null
    try{
      const real=packageFile(workspace,f.path,extensions),stat=fs.statSync(real,{bigint:true})
      if(stat.size>30n*1024n*1024n)throw Error()
      const raster=/\.(png|jpe?g|webp|gif)$/i.test(f.path)
      if(f.sha256||raster){
        const version=[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(':'),facts=fileFacts(real,version)
        if(f.sha256&&facts.hash!==f.sha256)changed=true
        if(!changed&&raster)size=facts.size
      }
      available=!changed
    }catch{}
    if(!available)result.issues.push(changed?'Один файл изменился после сохранения версии. Его прежний просмотр больше не подтверждает текущий файл.':'Один файл айдентики недоступен. Правила и остальные материалы сохранены.')
    return {...f,available,changed,...(size?{width:size.width,height:size.height}:{}),preview:available&&/\.(png|jpe?g|webp|gif|svg)$/i.test(f.path)}
  })
  const current={...profile,decision,files};let presentation=profile.presentation,presentationSource=presentation?'authored':'legacy'
  try{
   if(chosen.data.presentationFile){
    const companionFile=packageFile(workspace,chosen.data.presentationFile)
    if(fs.statSync(companionFile).size>1024*1024)throw Error()
    const companionBytes=fs.readFileSync(companionFile),companion=JSON.parse(companionBytes)
    if(companion.schemaVersion!==1||companion.productId!==productId||companion.artifactId!==chosen.id||companion.profileSha256!==createHash('sha256').update(profileBytes).digest('hex')||!chosen.data.presentationSha256||chosen.data.presentationSha256!==createHash('sha256').update(companionBytes).digest('hex'))throw Error()
    presentation=companion.presentation;presentationSource='authored'
   }
   if(presentation&&validatePresentation(presentation,current).length)throw Error()
   if(profile.schemaVersion===3&&!presentation)throw Error()
  }catch{
   presentation=null;presentationSource='unavailable';result.issues.push('Сохранённая презентация недоступна или не соответствует этой версии. Ниже показаны исходные материалы профиля.')
  }
  return {...result,profile:current,presentation:presentation||legacyPresentation(current),presentationSource,issues:[...new Set(result.issues)]}
 }catch(error){return {...result,state:error.code==='ENOENT'?'awaiting':'error',message:error.code==='ENOENT'?'Профиль зарегистрирован, но файл с правилами пока недоступен.':'Не удалось прочитать профиль айдентики. Проверьте сохранённую версию.'}}
}
function identityFile(workspace,graph,params){
 const data=loadIdentity(workspace,graph,params.productId,params.profile),file=data.profile?.files.find(f=>f.id===params.file&&f.available)
 if(!file)return null
 try{const real=packageFile(workspace,file.path,extensions),buffer=fs.readFileSync(real),extension=path.extname(real).toLowerCase();if(file.sha256&&createHash('sha256').update(buffer).digest('hex')!==file.sha256)return null;return {buffer,mime:imageMime(buffer,extension)||({'.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.woff':'font/woff','.woff2':'font/woff2'}[extension]||null),name:path.basename(real)}}catch{return null}
}
module.exports={loadIdentity,identityFile}
