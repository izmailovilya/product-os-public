const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto')
const VERSION=require('../package.json').version
const ENDPOINT='https://productos.izmailov.tech/_cli_event'
const SKILLS=['os-setup','product-context','product-status','product-research','product-segment-hypotheses','product-job-map','product-brand-identity','product-reference-library']
const EVENTS=['install_success','update_success','skill_used']
const configPath=userHome=>path.join(path.resolve(userHome||os.homedir()),'.product-os','telemetry.json')
function hasLink(file,stop){
  for(let item=file;;item=path.dirname(item)){
    if(fs.lstatSync(item,{throwIfNoEntry:false})?.isSymbolicLink())return true
    if(item===stop||path.dirname(item)===item)break
  }
  return false
}
function status({userHome=os.homedir(),env=process.env}={}){
  if(env.DO_NOT_TRACK||/^(0|off|false)$/i.test(env.PRODUCT_OS_TELEMETRY||''))return{enabled:false,reason:'environment'}
  if(env.CI||env.NODE_TEST_CONTEXT)return{enabled:false,reason:'test_or_ci'}
  const file=configPath(userHome)
  try{
    if(hasLink(file,path.resolve(userHome)))return{enabled:false,reason:'unsafe_config'}
    const info=fs.lstatSync(file,{throwIfNoEntry:false})
    if(!info)return{enabled:true,reason:'default'}
    if(!info.isFile()||info.size>8192)return{enabled:false,reason:'invalid_config'}
    const config=JSON.parse(fs.readFileSync(file,'utf8'))
    if(config.schemaVersion!==1||typeof config.enabled!=='boolean')return{enabled:false,reason:'invalid_config'}
    return{enabled:config.enabled,reason:'setting'}
  }catch{return{enabled:false,reason:'unreadable_config'}}
}
function setEnabled(enabled,{userHome=os.homedir()}={}){
  const file=configPath(userHome)
  if(hasLink(file,path.resolve(userHome)))throw Error('Настройка аналитики не записывается через символические ссылки')
  fs.mkdirSync(path.dirname(file),{recursive:true})
  const existing=fs.lstatSync(file,{throwIfNoEntry:false})
  if(existing&&!existing.isFile())throw Error('Настройка аналитики должна быть обычным файлом')
  const temp=file+'.'+randomUUID()+'.tmp'
  try{fs.writeFileSync(temp,JSON.stringify({schemaVersion:1,enabled},null,2)+'\n',{mode:0o600,flag:'wx'});fs.renameSync(temp,file)}
  finally{fs.rmSync(temp,{force:true})}
  return{enabled}
}
async function record(event,skill,{userHome=os.homedir(),env=process.env,fetchImpl=globalThis.fetch,timeoutMs=1500}={}){
  if(!EVENTS.includes(event)||(event==='skill_used'?!SKILLS.includes(skill):skill!=null))throw Error('Неизвестное событие или навык аналитики')
  const setting=status({userHome,env})
  if(!setting.enabled)return{event,sent:false,reason:setting.reason}
  const url=new URL(ENDPOINT);url.searchParams.set('event',event);url.searchParams.set('version',VERSION)
  if(skill)url.searchParams.set('skill',skill)
  const controller=new AbortController();let timer
  try{
    const request=Promise.resolve().then(()=>fetchImpl(url.toString(),{method:'GET',credentials:'omit',redirect:'error',signal:controller.signal}))
    const timeout=new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(null)},Math.min(Math.max(timeoutMs,1),1500))})
    const response=await Promise.race([request,timeout])
    return{event,...(skill?{skill}:{}),sent:response?.status===204,reason:response===null?'timeout':response?.status===204?'recorded':'http_error'}
  }catch{return{event,...(skill?{skill}:{}),sent:false,reason:'network_error'}}
  finally{clearTimeout(timer)}
}
function installationEvent(result){
  const previous=result.previousVersions||[]
  if(!previous.length)return'install_success'
  return previous.some(version=>version!==VERSION)?'update_success':null
}
async function recordInstallation(result,options={}){
  const event=installationEvent(result)
  if(!event)return{sent:false,reason:'same_version'}
  if(status(options).enabled)console.log('Аналитика Product OS: только событие установки/обновления и версия. Отключение: product-os telemetry off или DO_NOT_TRACK=1. Подробнее: TELEMETRY.md.')
  return record(event,null,options)
}
async function main(args,options={}){
  const[command,...rest]=args
  if(command==='status'&&!rest.length)return status(options)
  if(['on','off'].includes(command)&&!rest.length){setEnabled(command==='on',options);return status(options)}
  if(command==='skill-used'&&rest.length===1)return record('skill_used',rest[0],options)
  throw Error('telemetry status|on|off|skill-used <skill>')
}
module.exports={SKILLS,EVENTS,status,setEnabled,record,installationEvent,recordInstallation,main}
