import {escapeHTML as e,readingSection,readingSections,brandCanvas,brandTypography,emptyState,notice,loadingState,button,field,sourceNote,sourceList,textLink,sourceReferenceHref,evidencePanel,previewImage,applyPreviewFont} from './ui-components.js'
import {createReadCache} from './read-resource.js'
const identityCache=createReadCache()
const list=v=>Array.isArray(v)?v:[]
const prose=v=>typeof v==='string'?v.split(/\n\s*\n/).map(p=>`<p>${e(p)}</p>`).join(''):''
const hex=v=>typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v)
const fileTitle=f=>f.title||f.label||f.path?.split('/').pop()||"Saved file"
const fileURL=(data,file,download=false)=>data.example&&file.previewURL==='/assets/identity-typography-example.png'?file.previewURL:'/api/product-identity/file?'+new URLSearchParams({productId:data.productId,profile:data.artifactId,file:file.id,...(download?{download:'1'}:{})})
const findFile=(data,id)=>list(data.profile?.files).find(f=>f.id===id)
const unavailable=title=>notice({kind:'warning',message:title+" - file is not available. The rest of the materials have been preserved."})
function download(data,id,title,compact=false){const f=findFile(data,id);return f?.available?textLink({label:compact?"Download":title||"Download: "+fileTitle(f),href:fileURL(data,f,true),...(compact?{attributes:{'aria-label':title||"Download: "+fileTitle(f)}}:{})}):unavailable(title||fileTitle(f||{}))}
function image(data,ref,{className=''}={}){
 const f=findFile(data,ref?.fileId)
 if(!f?.available||!f.preview)return unavailable(ref?.alt||fileTitle(f||{}))
 return previewImage({src:fileURL(data,f),alt:ref.alt||fileTitle(f),region:ref.region,className:[className,ref.fileId===data.presentation?.cover?.logoFileId?'brand-wordmark':''].filter(Boolean).join(' ')})
}
function exampleImage(data,item,{detail=false}={}){
 const f=findFile(data,item.image?.fileId),isLogo=f?.role==='logo'||f?.purpose==='brand-signature'
 const media=image(data,item.image,{className:detail?'brand-detail-media':''})
 return brandCanvas({theme:item.theme,className:'brand-example-art'+(isLogo?' brand-example-logo':'')+(detail?' brand-example-detail':''),content:media})
}
function ruleSources(profile,rule){
 const entries=list(rule.sourceIds).map(id=>list(profile.sources).find(s=>s?.id===id)).filter(Boolean)
 return sourceNote({text:"Rule base",variant:'link',content:prose(rule.rationale)+sourceList({entries:entries.map(s=>({title:s.note||"Rule source",meta:s.locator||'',href:sourceReferenceHref(s.locator||'')}))})})
}
const usesSourceWording=data=>['legacy','unavailable'].includes(data.presentationSource)
function rules(data,ids,{values=usesSourceWording(data),sources=false}={}){
 // Authored copy explains application; ruleIds retain provenance. Raw source
 // wording belongs in the archive, while scope/exceptions remain beside use.
 return list(ids).map(id=>list(data.profile.rules).find(r=>r.id===id)).filter(Boolean).map(rule=>{
  const body=`${values?prose(rule.value):''}${rule.strength==='candidate'?"<p>Proposal - the rule is still under discussion.</p>":''}${rule.strength==='preferred'?"<p>Recommended application.</p>":''}${rule.scope?prose("Scope of application: "+rule.scope):''}${typeof rule.exceptions==='string'?prose("Exceptions: "+rule.exceptions):list(rule.exceptions).map(prose).join('')}${sources?ruleSources(data.profile,rule):''}`
  return body?`<div class="brand-guidance">${body}</div>`:''
 }).join('')
}
function cover(data,model,{application=false}={}){
 const f=findFile(data,model.logoFileId),logo=f?image(data,{fileId:f.id,alt:fileTitle(f)},{className:'brand-wordmark'}):''
 return brandCanvas({theme:model.theme||data.presentation?.theme, className:application?'brand-application':'brand-cover'+(model.image?'':' brand-cover-compact'),content:`<div class="brand-cover-copy">${logo||`<p class="brand-name">${e(model.title||data.presentation?.title||data.profile.product?.name||"Brand identity")}</p>`}${prose(model.heading||model.description)}${model.supportingText?prose(model.supportingText):''}${model.caption?`<p class="brand-cover-caption">${e(model.caption)}</p>`:''}</div>${model.image?image(data,model.image,{className:'brand-cover-art'}):''}`})
}
function section(data,s){
 let content=''
 if(s.type==='text')content=prose(s.body)
 if(['showcase','gallery'].includes(s.type))content=`<div class="${s.type==='gallery'?'brand-gallery':'brand-showcase'}">${list(s.items).map((item,i)=>`<div class="brand-example">${exampleImage(data,item)}<div class="brand-example-copy"><h3>${e(item.title)}</h3>${prose(item.description)}${rules(data,item.ruleIds)}${button({label:"View details",attributes:{'data-brand-focus':s.id+':'+i,'aria-label':"View details: "+item.title}})}</div></div>`).join('')}</div>`
 if(s.type==='palette')content=`<div class="brand-swatches">${list(s.colors).filter(c=>hex(c?.value)).map(c=>{const rgb=c.value.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),lum=rgb.reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0),fg=lum>.179?'#000000':'#ffffff';return brandCanvas({theme:{background:c.value,foreground:fg},density:'compact',className:'brand-swatch',content:`<p>${e(c.label)}</p><p class="brand-color-code">${e(c.value)}</p>`})}).join('')}</div>`
 if(s.type==='typography')content=brandTypography({...s,theme:data.presentation?.theme})
 if(s.type==='applications')content=`<div class="brand-applications">${list(s.items).map(item=>`<div>${cover(data,item,{application:true})}<p class="brand-caption">${e(item.title)} · Sketch</p>${prose(item.description)}${rules(data,item.ruleIds)}</div>`).join('')}</div>`
 if(s.type==='downloads')content=`<div class="brand-downloads">${list(s.items).map(item=>`<div class="brand-download-row"><div><h3>${e(item.title)}</h3>${prose(item.description)}</div>${download(data,item.fileId,"Download: "+item.title,true)}</div>`).join('')}</div>`
 return {id:'brand-'+s.id,title:s.title,intro:s.description||'',content:content+rules(data,s.ruleIds,{values:s.type!=='text'&&usesSourceWording(data)}),className:'brand-chapter'}
}
function versionSelector(data,state){return field({name:'profile',label:"Identity version",type:'select',attributes:{'data-brand-version':'','aria-label':"Identity version"},optionsHtml:'<option value="">'+(data.state==='choice'?"Select version":"Current version")+'</option>'+list(data.versions).map(v=>`<option value="${e(v.id)}"${v.id===(data.artifactId||state.profile)?' selected':''}>${e(v.title||"Brand identity")} · version ${e(v.version)} · ${v.decision==='accepted'?"recorded as accepted":"proposal"}</option>`).join('')})}
export function renderIdentity(data,state={}){
 const issues=list(data.issues).filter(message=>!/^Один файл/.test(message)).map(message=>notice({kind:'warning',message})).join('')
 if(data.state!=='ready')return (list(data.versions).length>1||data.state==='missing'?versionSelector(data,state):'')+issues+emptyState({kind:['error','unsupported','missing'].includes(data.state)?'unavailable':'first-use',title:data.state==='unregistered'?"No brand identity yet":data.state==='choice'?"Select identity version":"Brand identity unavailable",description:data.message,actions:data.state==='choice'?'':button({label:"Retry loading",attributes:{'data-brand-retry':''}})})
 const p=data.profile,presentation=data.presentation||p.presentation
 const utility=`<div class="brand-utility">${button({label:"Versions and sources",attributes:{'data-brand-history':''}})}</div>`
 if(!presentation)return utility+issues+emptyState({title:"Presentation not yet prepared",description:"Saved rules and files are available in the \"Versions and Sources\" section."})
 return utility+issues+(p.decision!=='accepted'?notice({message:"This identity has not yet been approved."}):'')+(p.waitingFor?notice({kind:'warning',message:p.waitingFor}):'')+`<div class="brand-book">${cover(data,presentation.cover||{})}${readingSections({sections:list(presentation.sections).map(s=>section({...data,presentation},s)),contentsTitle:"Identity sections",className:'brand-reading'})}</div>`
}
function archive(data,state){
 const p=data.profile
 const decisions=list(p.selectionHistory).map(s=>{const f=findFile(data,s.target),rule=list(p.rules).find(r=>r.id===s.target),direction=list(p.directions).find(d=>d.id===s.target);return `<div>${prose((f?fileTitle(f):rule?.value||direction?.label||s.target)+' — '+({accepted:"selected by owner",rejected:"rejected",proposed:"proposal",deferred:"postponed"}[s.decision]||s.decision))}${s.source?sourceNote({text:"Solution source",variant:'link',content:sourceList({entries:[{title:"Owner's decision",meta:s.source,href:sourceReferenceHref(s.source)}]})}):''}</div>`}).join('')
 const sources=sourceList({entries:[{title:"Saved profile",href:'/asset?path='+encodeURIComponent(data.profileFile),meta:data.profileFile},...list(p.sources).filter(s=>s&&typeof s==='object').map(s=>({title:s.note||"Identity source",meta:s.locator||'',href:sourceReferenceHref(s.locator||'')}))]})
 return versionSelector(data,state)+prose(p.acceptanceScope)+(data.presentationSource==='legacy'?"<p>View collected from previous profile. The original composition is not saved in this version.</p>":'')+readingSection({title:"Owner decisions",content:decisions||"<p>Individual decisions not recorded.</p>"})+readingSection({title:"Rules and restrictions",content:rules(data,list(p.rules).map(r=>r.id),{values:true,sources:true})})+readingSection({title:"All files",content:list(p.files).map(f=>`<p>${download(data,f.id,"Download: "+fileTitle(f))}</p>`).join('')})+readingSection({title:"Primary sources",content:sources})
}
let fontSequence=0
export function mountIdentity(root,{productId,versionKey='',state={},data,navigate=route=>window.AtlasNavigation?.navigate(route)}={}){
 const abort=new AbortController(),panels=new Set(),fonts=new Set();let disposed=false,current,request=0
 const closePanels=()=>{for(const panel of panels)panel.close();panels.clear()}
 function bindImages(parent){for(const img of parent.querySelectorAll('[data-brand-image]')){const media=img.closest('[data-brand-media]'),end=failed=>{if(disposed)return;media.querySelector('[data-brand-loading]').hidden=true;img.hidden=failed;media.querySelector('[data-brand-error]').hidden=!failed;media.dataset.loaded=failed?'error':'ready'};img.addEventListener('load',()=>end(false),{signal:abort.signal});img.addEventListener('error',()=>end(true),{signal:abort.signal});if(img.complete)end(!img.naturalWidth)}}
 async function bindFonts(value){for(const node of root.querySelectorAll('[data-brand-font]')){const file=findFile(value,node.dataset.brandFont),status=node.querySelector('[data-brand-font-status]');if(!file?.available){status.textContent="The font file is not available. A system sample is shown.";continue}try{const alias='brand-preview-'+(++fontSequence),face=new FontFace(alias,`url("${fileURL(value,file)}")`,{weight:node.dataset.brandFontWeight||'normal'});await face.load();if(disposed||!node.isConnected)return;document.fonts.add(face);fonts.add(face);applyPreviewFont(node,alias);status.hidden=true}catch{if(!disposed&&node.isConnected)status.textContent="The font was not loaded. A system sample is shown."}}}
 function render(value){if(disposed)return;closePanels();for(const face of fonts)document.fonts.delete(face);fonts.clear();current={...value,productId};root.innerHTML=renderIdentity(current,state);root.removeAttribute('aria-busy');bindImages(root);bindFonts(current)}
 async function load(refresh=false){const token=++request,url='/api/product-identity?'+new URLSearchParams({productId,...(state.profile?{profile:state.profile}:{})}),cached=!refresh&&identityCache.peek(url,{version:versionKey});if(cached){render(cached);return}root.setAttribute('aria-busy','true');root.innerHTML=loadingState({label:"Loading identity..."});try{const value=await identityCache.load(url,{version:versionKey,refresh});if(token===request)render(value)}catch{if(token===request)render({state:'error',message:"Failed to load identity. Please try again."})}}
 root.addEventListener('click',event=>{
  const retry=event.target.closest('[data-brand-retry]');if(retry)return load(true)
  const history=event.target.closest('[data-brand-history]');if(history&&current?.profile){const panel=evidencePanel({title:"Versions and sources",trigger:history,content:archive(current,state)});panels.add(panel);panel.element.addEventListener('change',change=>{if(change.target.matches('[data-brand-version]')){const id=change.target.value;closePanels();navigate('library/identity'+(id?'?'+new URLSearchParams({profile:id}):''))}},{signal:abort.signal});return}
  const focus=event.target.closest('[data-brand-focus]');if(focus&&current){const [id,index]=focus.dataset.brandFocus.split(':'),s=list(current.presentation?.sections||current.profile.presentation?.sections).find(s=>s.id===id),item=s?.items?.[Number(index)];if(!item)return;const panel=evidencePanel({title:item.title,trigger:focus,content:exampleImage(current,item,{detail:true})+prose(item.description)+rules(current,item.ruleIds)+download(current,item.image.fileId,"Download original image")});panels.add(panel);bindImages(panel.element)}
 },{signal:abort.signal})
 root.addEventListener('change',event=>{if(event.target.matches('[data-brand-version]'))navigate('library/identity'+(event.target.value?'?'+new URLSearchParams({profile:event.target.value}):''))},{signal:abort.signal})
 const ready=data?(render(data),Promise.resolve()):load();return {ready,destroy(){disposed=true;closePanels();abort.abort();for(const face of fonts)document.fonts.delete(face);fonts.clear()}}
}
