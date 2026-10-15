/** Shared UI renderers. Text props are escaped; content/actions/attributes HTML are trusted caller-owned markup.
 * No feature imports, routing, API calls, or research interpretation belong here. */
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const attrs = value => typeof value === 'string' ? value : Object.entries(value || {}).filter(([,v]) => v !== false && v != null).map(([k,v]) => `${k}="${escapeHTML(v === true ? '' : v)}"`).join(' ')
const classes = (base, extra) => `${base}${extra ? ' ' + escapeHTML(extra) : ''}`
export function button({label,variant='secondary',type='button',disabled=false,attributes='',className='',icon='',href} = {}) {
  const common=`class="${classes(`os-button os-button-${variant}`,className)}" ${icon?`aria-label="${escapeHTML(label)}"`:''} ${attrs(attributes)}`
  if(href!==undefined){
    const target=/^(?:#|\/(?!\/)|https?:\/\/)/i.test(href)?href:'#'
    return `<a ${common} ${disabled?'aria-disabled="true" tabindex="-1"':`href="${escapeHTML(target)}"`}>${icon||escapeHTML(label)}</a>`
  }
  return `<button type="${escapeHTML(type)}" ${common} ${disabled ? 'disabled' : ''}>${icon||escapeHTML(label)}</button>`
}
export function textLink({label,href='#',attributes=''} = {}) {
  const target = /^(?:#|\/(?!\/)|https?:\/\/)/i.test(href) ? href : '#'
  return `<a class="os-text-link" href="${escapeHTML(target)}" ${attrs(attributes)}>${escapeHTML(label)}</a>`
}
export function badge({label,tone='neutral',attributes=''} = {}) {return `<span class="os-badge" data-tone="${tone==='positive'?'positive':'neutral'}" ${attrs(attributes)}>${escapeHTML(label)}</span>`}
export function segmentMarker({label,colorIndex=null,basis='supported'} = {}) {
  const color = Number.isInteger(colorIndex) && colorIndex >= 0 && colorIndex < 12 ? colorIndex : 'neutral'
  return `<span class="os-segment-marker" data-marker-color="${color}" data-basis="${basis === 'interpretation' ? 'interpretation' : 'supported'}">${escapeHTML(label)}</span>`
}
export function annotationLegend({segments=[],title='Цвета сегментов',uncertainty='Вероятная связь',uncertaintyDetail='пунктир под фразой.',neutral='Связь не найдена',neutralDetail='среди выбранных сегментов. Это не оценка качества текста.',detail='Тип фразы и все связи — в карточке при наведении. Текст без подсветки не размечен.'} = {}) {
  return `<section class="os-annotation-legend" aria-label="Легенда подсветки"><h3>${escapeHTML(title)}</h3><ul>${segments.map((s,i) => `<li>${segmentMarker({label:s.label,colorIndex:s.colorIndex === 12 ? null : s.colorIndex ?? i % 12})}</li>`).join('')}</ul><p>${segmentMarker({label:uncertainty,colorIndex:segments[0]?.colorIndex ?? 0,basis:'interpretation'})} — ${escapeHTML(uncertaintyDetail)}</p><p>${segmentMarker({label:neutral})} — ${escapeHTML(neutralDetail)}</p><p>${escapeHTML(detail)}</p></section>`
}
export function field({name='',label,value='',type='text',optionsHtml='',required=false,disabled=false,attributes='',className='',hint='',error=''} = {}) {
  const id = typeof attributes === 'object' && attributes.id || (typeof attributes === 'string' && attributes.match(/\bid="([^"]+)"/)?.[1]) || `os-field-${++field.sequence}`, common = `${attrs(attributes).includes('id="')?'':`id="${id}"`} name="${escapeHTML(name)}" aria-label="${escapeHTML(label)}" ${required?'required':''} ${disabled?'disabled':''} ${error?'aria-invalid="true"':''} ${hint||error?`aria-describedby="${id}-help"`:''} ${attrs(attributes)}`
  const control = type === 'textarea' ? `<textarea rows="3" ${common}>${escapeHTML(value)}</textarea>` : type === 'select' ? `<select ${common}>${optionsHtml}</select>` : `<input type="${escapeHTML(type)}" value="${escapeHTML(value)}" ${common}>`
  return `<label class="${classes('os-field',className)}"><span>${escapeHTML(label)}</span>${control}${hint||error?`<span class="os-field-help${error?' os-field-error':''}" id="${id}-help">${escapeHTML(error||hint)}</span>`:''}</label>`
}
field.sequence=0
/** Add one validation message while preserving an existing field hint. */
export function setFieldError(control,message='') {
 if(!control)return
 if(!control.id)control.id=`os-field-${++field.sequence}`
 const id=control.id+'-error',wrapper=control.closest('.os-field')||control.parentElement
 wrapper?.querySelector('[data-os-validation]')?.remove()
 const described=(control.getAttribute('aria-describedby')||'').split(/\s+/).filter(value=>value&&value!==id)
 control.removeAttribute('aria-invalid')
 if(message){const help=document.createElement('span');help.className='os-field-help os-field-error';help.id=id;help.dataset.osValidation='';help.textContent=message;wrapper?.append(help);control.setAttribute('aria-invalid','true');described.push(id)}
 if(described.length)control.setAttribute('aria-describedby',described.join(' '));else control.removeAttribute('aria-describedby')
}
export function notice({kind='status',message='',actions='',hidden=false,className=''} = {}) { return `<div class="${classes(`os-notice${kind==='error'?' os-notice-error':kind==='warning'?' os-notice-warning':''}`,className)}" role="${kind==='error'?'alert':'status'}" ${hidden?'hidden':''}>${escapeHTML(message)}${actions}</div>` }
export function brandSignature({compact=false}={}) { return `<div class="os-brand" role="img" aria-label="Product OS"><img src="/assets/brand/mark-ink.svg" width="32" height="32" alt="">${compact?'':'<span aria-hidden="true">Product OS</span>'}</div>` }
export function pageHeader({title,description='',context='',actions='',back='',className='',level=1,backTight=false} = {}) { const heading = level === 2 ? 'h2' : 'h1'; return `<header class="${classes('os-page-header',className)}">${back&&!backTight?`<div class="os-parent-return">${back}</div>`:''}<div class="os-page-heading">${back&&backTight?`<div class="os-parent-return">${back}</div>`:''}<${heading}>${escapeHTML(title)}</${heading}>${description?`<p>${escapeHTML(description)}</p>`:''}${context?`<div class="os-page-context">${context}</div>`:''}</div>${actions?`<div class="os-page-actions">${actions}</div>`:''}</header>` }
const topicObservers=new Map()
let topicFrame=0
function revealTopic(nav){
 if(!nav.isConnected||!nav.getClientRects().length)return
 const selected=nav.querySelector('[aria-current=page]');if(!selected)return
 const item=selected.getBoundingClientRect(),box=nav.getBoundingClientRect()
 if(item.width>box.width||item.left<box.left)nav.scrollLeft+=item.left-box.left
 else if(item.right>box.right)nav.scrollLeft+=item.right-box.right
}
function observeTopics(){
 topicFrame=0
 for(const [nav,observers] of topicObservers)if(!nav.isConnected){observers.resize.disconnect();observers.mutation.disconnect();topicObservers.delete(nav)}
 for(const nav of document.querySelectorAll('.os-topic-nav')){
  if(!topicObservers.has(nav)&&typeof ResizeObserver==='function'){
   const resize=new ResizeObserver(()=>revealTopic(nav))
   const observe=()=>{resize.disconnect();resize.observe(nav);for(const item of nav.children)resize.observe(item);revealTopic(nav)}
   const mutation=new MutationObserver(observe);mutation.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-current']})
   topicObservers.set(nav,{resize,mutation});observe()
  }
  revealTopic(nav)
 }
}
function scheduleTopics(){if(typeof requestAnimationFrame==='function'&&!topicFrame)topicFrame=requestAnimationFrame(observeTopics)}
if(typeof document!=='undefined'&&typeof MutationObserver==='function')new MutationObserver(records=>{
 if(records.some(record=>record.removedNodes.length))scheduleTopics()
}).observe(document.documentElement,{childList:true,subtree:true})
export function topicNav({label='Темы страницы',items=[],active,className='',actions=''} = {}) {
  scheduleTopics()
  const nav = `<nav class="${classes('os-topic-nav',className)}" aria-label="${escapeHTML(label)}">${items.map(item=>item.href?`<a href="${escapeHTML(item.href)}" ${item.id===active?'aria-current="page"':''} ${attrs(item.attributes)}>${escapeHTML(item.label)}</a>`:`<button type="button" aria-pressed="${item.id===active}" ${item.id===active?'aria-current="page"':''} ${attrs(item.attributes)}>${escapeHTML(item.label)}</button>`).join('')}</nav>`
  return actions ? `<div class="os-topic-toolbar">${nav}<div class="os-topic-actions">${actions}</div></div>` : nav
}
export function emptyState({kind='first-use',title='',description='',actions='',primaryAction='',secondaryAction='',className=''} = {}) { return `<section class="${classes('os-empty-state',className)}" data-empty-kind="${escapeHTML(kind)}" ${kind==='unavailable'?'role="alert"':''}>${title?`<h2>${escapeHTML(title)}</h2>`:''}${description?`<p>${escapeHTML(description)}</p>`:''}${actions||primaryAction||secondaryAction?`<div class="os-actions">${actions||primaryAction+secondaryAction}</div>`:''}</section>` }
const filterTitle=active=>active?'Фильтры · применены':'Фильтры'
export function filterBar({content='',label='Фильтры списка',className='',active=false,open=false,collapsible=true} = {}) {
 const fields=`<div class="${classes('os-filter-bar',className)}" role="group" aria-label="${escapeHTML(label)}">${content}</div>`
 return collapsible?disclosure({title:filterTitle(active),content:fields,className:'os-filter-disclosure',open}):fields
}
// Update the indicator without replacing a focused field or changing disclosure state.
export function setFilterActive(root,active){const panel=root.matches?.('.os-filter-disclosure')?root:root.querySelector('.os-filter-disclosure');const title=panel?.querySelector(':scope>summary>span');if(title)title.textContent=filterTitle(active)}
/** One compact result count and page controls, composed from the existing button contract. */
export function pagination({page=1,pages=1,total=0,size=12,href=()=>'#',label='Страницы списка',context=''}={}) {
 const range=total?`Показаны ${(page-1)*size+1}–${Math.min(page*size,total)} из ${total}`:'Нет результатов'
 return `<nav class="os-pagination" aria-label="${escapeHTML(label)}"><span class="os-pagination-context">${escapeHTML([range,pages>1?`Страница ${page} из ${pages}`:'',context].filter(Boolean).join(' · '))}</span>${pages>1?`<div class="os-actions">${button({label:'← Предыдущая',attributes:{'aria-label':'← Предыдущая страница'},href:page>1?href(page-1):undefined,disabled:page<=1})}${button({label:'Следующая →',attributes:{'aria-label':'Следующая страница →'},href:page<pages?href(page+1):undefined,disabled:page>=pages})}</div>`:''}</nav>`
}
export function collectionLayout({header='',nav='',filters='',content='',notice='',className=''} = {}) {return `<div class="${classes('os-collection-layout',className)}" data-page-template="collection">${header}${nav}${filters}${notice}<div class="os-page-content">${content}</div></div>`}
/** One recorded parent/child level. Text is escaped; meta/content are trusted slots. */
export function hierarchyList({items=[],childrenLabel='Подсегменты',emptyChildren='Подсегменты пока не выделены.',showEmptyChildren=true}={}) {
 const row=(item,child=false)=>`<${child?'li':'article'} class="os-hierarchy-item ${child?'os-hierarchy-child':'os-hierarchy-root'} os-object-card" data-hierarchy-id="${escapeHTML(item.id)}" ${child?`data-hierarchy-search="${escapeHTML((item.title||'').toLocaleLowerCase())}"`:`data-search="${escapeHTML([item.title,...(item.children||[]).map(c=>c.title)].join(' ').toLocaleLowerCase())}" data-hierarchy-own-search="${escapeHTML((item.title||'').toLocaleLowerCase())}"`}><div class="os-hierarchy-heading"><h${child?'3':'2'}>${textLink({href:item.href,label:item.title,attributes:{'data-hierarchy-link':true}})}</h${child?'3':'2'}>${item.badge||''}</div>${item.description?`<p>${escapeHTML(item.description)}</p>`:''}${item.content||''}${item.meta||''}${!child&&(showEmptyChildren||item.children?.length)?`<section class="os-hierarchy-children"><h3>${escapeHTML(childrenLabel)}</h3>${item.children?.length?`<ul>${item.children.map(c=>row(c,true)).join('')}</ul>`:`<p>${escapeHTML(emptyChildren)}</p>`}</section>`:''}</${child?'li':'article'}>`
 return `<div class="os-hierarchy-list">${items.map(item=>row(item)).join('')}</div>`
}
/** Prose fact rows: the label sits directly above its value; no questionnaire columns. */
export function proseFacts({items=[],className=''} = {}) {
  return `<dl class="${classes('os-prose-facts',className)}">${items.map(item=>`<div><dt>${escapeHTML(item.label)}</dt><dd>${item.value??''}</dd></div>`).join('')}</dl>`
}
/** One short contextual fact stays on a single reading line instead of a subsection. */
export function factLine({label='',value='',className=''} = {}) {
  return `<p class="${classes('os-fact-line',className)}"><span class="os-fact-line-label">${escapeHTML(label)}:</span> ${value??''}</p>`
}
export function detailLayout({header='',nav='',content='',back='',notice='',className=''} = {}) {return `<div class="${classes('os-detail-layout',className)}" data-page-template="detail">${back?`<div class="os-parent-return">${back}</div>`:''}${header}${nav}${notice}<div class="os-page-content">${content}</div></div>`}
/** Open reading section: transparent rhythm owner. Title/intro are escaped; content is a trusted slot. */
export function readingSection({id='',title='',level=2,intro='',content='',className='',attributes=''} = {}) {
  const heading=level===3?'h3':'h2'
  return `<section class="${classes('os-reading-section',className)}"${id?` id="${escapeHTML(id)}" aria-labelledby="${escapeHTML(id)}-heading"`:''} ${attrs(attributes)}>${title?`<${heading}${id?` id="${escapeHTML(id)}-heading"`:''}>${escapeHTML(title)}</${heading}>`:''}${intro?`<p class="os-reading-intro">${escapeHTML(intro)}</p>`:''}${content}</section>`
}
/** Compose explicit, open sections. One section needs no contents panel.
 * Raw sources and editorial interpretation remain the caller's responsibility. */
export function readingSections({sections=[],contentsTitle='На странице',className=''}={}) {
  const content=sections.map(section=>readingSection(section)).join('')
  return sections.length>1?readingLayout({content,className,contentsTitle,contents:sections.filter(s=>s.id&&s.title).map(s=>({id:s.id,label:s.title}))}):content
}
/** Shared list entry. Domain content/meta/actions are trusted slots; titles are escaped.
 * Independent source controls stay independent of the object's navigation. */
export function summaryCard({title='',href,level=3,meta='',content='',actions='',className='',attributes=''}={}) {
  const heading=level===2?'h2':level===4?'h4':'h3'
  return `<article class="${classes('os-summary-card',className)}" ${attrs(attributes)}><header class="os-summary-card-heading"><${heading}>${href?textLink({href,label:title}):escapeHTML(title)}</${heading}>${meta}</header><div class="os-summary-card-content">${content}</div>${actions?`<footer class="os-summary-card-actions">${actions}</footer>`:''}</article>`
}
/** A reading page with in-page contents. Buttons scroll within the active outlet;
 * object actions keep real link semantics and use the shared button geometry. */
export function readingLayout({content='',contents=[],contentsTitle='На странице',actions='',className=''} = {}) {
  scheduleReadingContents()
  return `<div class="${classes('os-reading-layout',className)}"><div class="os-reading-columns"><div class="os-reading-body">${content}</div><aside class="os-reading-contents" aria-label="${escapeHTML(contentsTitle)}"><nav>${contents.map(item=>button({label:item.label,variant:'quiet',attributes:{'data-reading-target':item.id}})).join('')}</nav>${actions?`<div class="os-reading-actions">${actions}</div>`:''}</aside></div></div>`
}
// Contents follow the current section in the actual scrolling outlet, including
// restored scroll positions, disclosures and container reflow. No route writes.
const readingObservers=new Map()
let readingFrame=0
function readingViewport(root){
 for(let el=root.parentElement;el;el=el.parentElement){
  if(/^(auto|scroll|overlay)$/.test(getComputedStyle(el).overflowY)){
   const top=el.getBoundingClientRect().top+el.clientTop
   return {top,bottom:top+el.clientHeight,atEnd:el.scrollHeight>el.clientHeight&&el.scrollTop+el.clientHeight>=el.scrollHeight-2}
  }
 }
 const el=document.scrollingElement
 return {top:0,bottom:innerHeight,atEnd:el.scrollHeight>innerHeight&&el.scrollTop+innerHeight>=el.scrollHeight-2}
}
function updateReadingContents(root){
 if(!root.isConnected||!root.getClientRects().length||root.closest('[hidden],[inert]'))return
 const targets=new Map([...root.querySelectorAll('.os-reading-body [id]')].map(el=>[el.id,el]))
 const items=[...root.querySelectorAll('.os-reading-contents [data-reading-target]')].map(control=>({control,target:targets.get(control.dataset.readingTarget)})).filter(item=>item.target?.getClientRects().length)
 if(!items.length)return
 const view=readingViewport(root),offset=parseFloat(getComputedStyle(items[0].target).scrollMarginBlockStart)||0
 let current=items[0]
 for(const item of items)if(item.target.getBoundingClientRect().top<=view.top+offset+1)current=item
 // A short last section may never reach the top before the outlet ends.
 if(view.atEnd&&items.at(-1).target.getBoundingClientRect().top<view.bottom)current=items.at(-1)
 for(const {control} of items){
  if(control===current.control){if(control.getAttribute('aria-current')!=='location')control.setAttribute('aria-current','location')}
  else control.removeAttribute('aria-current')
 }
}
function refreshReadingContents(){
 readingFrame=0
 for(const [root,observer] of readingObservers)if(!root.isConnected){observer?.disconnect();readingObservers.delete(root)}
 for(const root of document.querySelectorAll('.os-reading-layout')){
  if(!readingObservers.has(root)){
   const resize=typeof ResizeObserver==='function'?new ResizeObserver(scheduleReadingContents):null
   resize?.observe(root)
   for(const section of root.querySelectorAll('.os-reading-body>.os-reading-section'))resize?.observe(section)
   readingObservers.set(root,resize)
  }
  updateReadingContents(root)
 }
}
function scheduleReadingContents(){if(typeof requestAnimationFrame==='function'&&!readingFrame)readingFrame=requestAnimationFrame(refreshReadingContents)}
if(typeof document!=='undefined'){
 document.addEventListener('scroll',()=>{if(readingObservers.size)scheduleReadingContents()},{capture:true,passive:true})
 window.addEventListener('resize',scheduleReadingContents,{passive:true})
 if(typeof MutationObserver==='function')new MutationObserver(records=>{
  if(readingObservers.size||records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches('.os-reading-layout')||node.querySelector('.os-reading-layout')))))scheduleReadingContents()
 }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert']})
}
if(typeof document!=='undefined')document.addEventListener('click',event=>{
 const control=event.target.closest('[data-reading-target]');if(!control)return
 const root=control.closest('.os-reading-layout'),target=[...(root?.querySelectorAll('[id]')||[])].find(el=>el.id===control.dataset.readingTarget)
 if(!target)return
 target.scrollIntoView({block:'start'});const heading=target.querySelector(':scope>h2,:scope>h3')||target;heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});scheduleReadingContents()
})
/** Paper surface: owns background, hairline and padding when reading content sits on a distinct surface. Content is a trusted slot. */
export function paperSurface({content='',id='',className='',attributes=''} = {}) {return `<div class="${classes('os-paper-surface',className)}"${id?` id="${escapeHTML(id)}"`:''} ${attrs(attributes)}>${content}</div>`}
/** A filter that navigates: link semantics with shared control geometry; the active state comes from aria-current. */
export function filterLink({label,href='#',active=false,attributes='',className=''} = {}) {
  const target=/^(?:#|\/(?!\/)|https?:\/\/)/i.test(href)?href:'#'
  return `<a class="${classes('os-filter-link',className)}" href="${escapeHTML(target)}"${active?' aria-current="page"':''} ${attrs(attributes)}>${escapeHTML(label)}</a>`
}
/** Native disclosure with the shared summary marker and compact body rhythm. Title is escaped; content is a trusted slot. */
export function disclosure({title='',content='',className='',bodyClassName='',attributes='',open=false} = {}) {
  return `<details class="${classes('os-disclosure',className)}" ${open?'open':''} ${attrs(attributes)}><summary><span>${escapeHTML(title)}</span></summary><div class="${classes('os-disclosure-body',bodyClassName)}">${content}</div></details>`
}
export function editorLayout({content='',actions='',className='',attributes=''} = {}) {return `<form class="${classes('os-editor-layout',className)}" data-page-template="editor" ${attrs(attributes)}><div class="os-editor-fields">${content}</div><div class="os-editor-actions">${actions}</div></form>`}
/** Immediate structural feedback. Caller owns aria-busy and removes this state when content resolves. */
export function loadingState({kind='section',title='',label='Загрузка…',className=''} = {}) {
 const variant=kind==='page'?'page':'section',heading=variant==='page'?'h1':'h2'
 return `<section class="${classes('os-loading-state',className)}" data-loading-kind="${variant}">${title?`<${heading} class="os-loading-title">${escapeHTML(title)}</${heading}>`:''}<p class="os-loading-status" role="status">${escapeHTML(label)}</p><div class="os-loading-skeleton" aria-hidden="true">${variant==='page'?(title?'':'<div class="os-loading-heading"></div>')+'<div class="os-loading-navigation"></div>':''}<div class="os-loading-lines"><span></span><span></span><span></span></div></div></section>`
}
const dialogs = new WeakMap(), dialogStack=[]
let dialogCycle=0
let activeSourcePreview=null
// One capture listener owns Escape; lower dialogs and legacy handlers never see it.
if(typeof document!=='undefined')document.addEventListener('keydown',event=>{
 const top=dialogStack.at(-1)
 if(event.key==='Escape'&&activeSourcePreview&&(!top||top.element.contains(activeSourcePreview.trigger))){event.preventDefault();event.stopImmediatePropagation();activeSourcePreview.close(true);return}
 if(event.key==='Escape'&&top){event.preventDefault();event.stopImmediatePropagation();top.close()}
},true)
/** Native dialog owns trapping/inert siblings. Controller owns history, dismissal and focus return. */
export function dialog(element, {background=[],onClose,initialFocus} = {}) {
 if(!element)return null
 if(dialogs.has(element))return dialogs.get(element)
 let trigger,disposed=false,active=false,overflow,historyId,restoreFocus=true,returnScroll=[],returnURL
 const native=typeof element.showModal==='function',previous=new Map()
 const focusables=()=>[...element.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]'))
 const restore=()=>{
  if(!active)return;active=false
  const index=dialogStack.indexOf(controller);if(index>=0)dialogStack.splice(index,1)
  if(!native){element.inert=true;document.body.style.overflow=overflow??''}
  for(const [el,inert] of previous)el.inert=inert;previous.clear()
  if(historyId){const id=historyId;historyId=null;window.AtlasRouteState?.overlays.close(id)}
  if(restoreFocus&&returnURL===location.href){
   const opener=trigger,cycle=dialogCycle,url=returnURL,positions=returnScroll
   const available=()=>opener?.isConnected&&opener.getClientRects().length&&!opener.closest('[hidden],[inert]')
   if(available())opener.focus({preventScroll:true})
   const settled=window.AtlasRouteState?.overlays.whenSettled?.()
   if(settled){
    let moved=false
    const chosenFocus=event=>{if(event.target!==opener&&event.target!==document.body)moved=true}
    const chosenInput=()=>{moved=true},inputs=['pointerdown','wheel','touchstart','keydown']
    document.addEventListener('focusin',chosenFocus,true)
    for(const type of inputs)document.addEventListener(type,chosenInput,{capture:true,passive:true})
    settled.then(()=>{
     document.removeEventListener('focusin',chosenFocus,true)
     for(const type of inputs)document.removeEventListener(type,chosenInput,true)
     const top=dialogStack.at(-1),focused=document.activeElement
     if(!active&&cycle===dialogCycle&&url===location.href&&!moved&&available()&&
       (focused===document.body||focused===opener)&&(!top||top.element.contains(opener))){
      // Fragment traversal may also scroll away from the still-connected opener.
      // Restore its document/container context only while this return still owns it.
      for(const {element,left,top} of positions)if(element.isConnected)element.scrollTo({left,top,behavior:'instant'})
      opener.focus({preventScroll:true})
     }
    })
   }
  }
  onClose?.()
 }
 const close=(options={})=>{if(!active)return;restoreFocus=options?.restoreFocus!==false;if(options?.fromHistory)historyId=null;if(native){if(element.open)element.close();restore()}else{element.hidden=true;restore()}}
 const click=event=>{if(event.target.closest('[data-os-close]'))close()}
 const cancel=event=>{event.preventDefault();close()}
 // Native dialogs can send a boundary Tab to browser chrome. Keep the shared
 // keyboard loop explicit for both variants; nested source handlers keep ownership.
 const keyboard=event=>{if(!active||event.defaultPrevented||dialogStack.at(-1)!==controller||event.key!=='Tab')return;const items=focusables();if(!items.length){event.preventDefault();return}if(event.shiftKey&&(document.activeElement===items[0]||!items.includes(document.activeElement))){event.preventDefault();items.at(-1).focus()}else if(!event.shiftKey&&(document.activeElement===items.at(-1)||!items.includes(document.activeElement))){event.preventDefault();items[0].focus()}}
 element.addEventListener('close',restore);element.addEventListener('cancel',cancel);element.addEventListener('click',click);element.addEventListener('keydown',keyboard)
 const controller={element,open(from=document.activeElement){
  if(disposed||active)return controller;trigger=from;active=true;restoreFocus=true;dialogCycle++;dialogStack.push(controller)
  returnURL=location.href
  returnScroll=[];for(let parent=trigger?.parentElement;parent;parent=parent.parentElement)if(parent.scrollHeight>parent.clientHeight||parent.scrollWidth>parent.clientWidth)returnScroll.push({element:parent,left:parent.scrollLeft,top:parent.scrollTop})
  historyId=window.AtlasRouteState?.overlays.open(reason=>close({fromHistory:true,restoreFocus:reason!=='route'}))
  if(native){if(!element.open)element.showModal()}else{element.hidden=false;element.inert=false;overflow=document.body.style.overflow;document.body.style.overflow='hidden';for(const el of background){previous.set(el,el.inert);el.inert=true}}
  const title=typeof initialFocus==='string'?element.querySelector(initialFocus):initialFocus||element.querySelector('h1,h2,[aria-labelledby] h3')
  if(title){title.tabIndex=-1;title.focus({preventScroll:true})}else focusables()[0]?.focus({preventScroll:true})
  return controller
 },close,destroy(){close();element.removeEventListener('close',restore);element.removeEventListener('cancel',cancel);element.removeEventListener('click',click);element.removeEventListener('keydown',keyboard);dialogs.delete(element);disposed=true}}
 dialogs.set(element,controller);return controller
}
export function evidencePanel({title='Источник',content='',trigger=document.activeElement,onClose} = {}) {
 const element=document.createElement('dialog');element.className='os-dialog os-evidence-panel';element.setAttribute('aria-label',title)
 element.innerHTML=pageHeader({title,level:2,actions:button({label:'Закрыть',attributes:{'data-os-close':true}})})+`<div class="os-evidence-content">${content}</div>`
 document.body.append(element);const controller=dialog(element,{onClose})
 // Source inspection is dismissible outside; editor dialogs keep explicit cancellation.
 const outside=event=>{const box=element.getBoundingClientRect();return event.target===element&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)}
 let pointerOutside=false
 element.addEventListener('pointerdown',event=>{pointerOutside=outside(event)})
 element.addEventListener('click',event=>{if(pointerOutside&&outside(event))controller.close();pointerOutside=false})
 element.addEventListener('close',()=>{controller.destroy();element.remove()},{once:true});controller.open(trigger);return controller
}
/** Full raster inspection uses the shared evidence/dialog lifecycle. Context is a trusted slot. */
export function imageFocus({src,alt='',title='Изображение',context='',trigger=document.activeElement,onClose} = {}) {
 const abort=new AbortController()
 const panel=evidencePanel({title,trigger,onClose(){abort.abort();onClose?.()},content:`<p>Прокручивайте изображение, чтобы увидеть его целиком.</p><div class="os-image-focus-media" role="region" aria-label="Изображение — прокрутка" tabindex="0" aria-busy="true"><div data-os-image-loading>${loadingState({label:'Загрузка изображения…'})}</div><img data-os-image-raster alt="${escapeHTML(alt)}" hidden><div data-os-image-error hidden>${notice({kind:'warning',message:'Изображение недоступно. Закройте просмотр и повторите попытку. Описание и источники доступны ниже.'})}</div></div>${context}`})
 panel.element.classList.add('os-image-focus')
 const region=panel.element.querySelector('.os-image-focus-media'),image=region.querySelector('img'),loading=region.querySelector('[data-os-image-loading]'),error=region.querySelector('[data-os-image-error]')
 const settle=failed=>{if(abort.signal.aborted)return;region.setAttribute('aria-busy','false');loading.hidden=true;image.hidden=failed;error.hidden=!failed}
 image.addEventListener('load',()=>settle(false),{signal:abort.signal})
 image.addEventListener('error',()=>settle(true),{signal:abort.signal})
 image.src=src
 if(image.complete)settle(!image.naturalWidth)
 return panel
}
export const OSUI={brandSignature,hierarchyList,escapeHTML,button,textLink,badge,field,setFieldError,notice,pageHeader,topicNav,emptyState,filterBar,setFilterActive,pagination,collectionLayout,detailLayout,readingSection,readingSections,summaryCard,readingLayout,paperSurface,filterLink,disclosure,proseFacts,factLine,editorLayout,loadingState,dialog,evidencePanel,imageFocus}
if(typeof window!=='undefined')window.OSUI=OSUI

/** A compact citation marker, an information icon, or a named textual action. Index is supplied by the source adapter, never counted here. */
export function sourceTrigger({variant='compact',label='Открыть источник',attributes='',index='',className=''} = {}) {
 const style=['link','icon'].includes(variant)?variant:'compact',extra=attrs(attributes),tooltip=style==='icon'&&!/\btitle\s*=/.test(extra)?`title="${escapeHTML(label)}"`:'',popup=/\baria-haspopup\s*=/.test(extra)?'':'aria-haspopup="dialog"'
 return `<button type="button" class="${classes(`source-icon os-source-trigger os-source-trigger-${style}`,className)}" aria-label="${escapeHTML(label)}" ${popup} ${tooltip} ${extra}>${style==='link'?escapeHTML(label):style==='icon'?'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg>':`[${escapeHTML(index||1)}]`}</button>`
}
/** Selectable reading text, with explicit keyboard/touch access to its provenance. */
export function sourceText({text='',label='',attributes='',className=''} = {}) {
 return `<span class="${classes('os-source-text',className)}" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" aria-label="${escapeHTML(label||text+' — источники и основания')}" ${attrs(attributes)}>${escapeHTML(text).replace(/\n/g,'<br>')}</span>`
}
/** A claim and its saved supporting markup travel together through any renderer. */
export function sourceNote({text='',title='Источники и основания',content='',attributes='',className='',variant='text'}={}) {
 const trigger=variant==='link'?sourceTrigger({variant:'link',label:text,attributes:`data-source-note ${attrs(attributes)}`,className}):sourceText({text,attributes:`data-source-note ${attrs(attributes)}`,className})
 return `${trigger}<template data-source-note-content data-source-title="${escapeHTML(title)}">${content}</template>`
}
/** One hoverable, nonmodal source panel. The adapter supplies saved content only. */
export function mountSourcePreviews(root,{selector='.os-source-text',getSource}={}) {
 const abort=new AbortController(),options={signal:abort.signal}
 let current=null,opening,closing,point=null,suppressFocus=false,destroyed=false
 const find=target=>{const el=target?.closest?.(selector);return el&&root.contains(el)?el:null}
 const focusables=element=>[...element.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.disabled&&el.getClientRects().length&&!el.closest('[hidden],[inert]'))
 const clearTimers=()=>{clearTimeout(opening);clearTimeout(closing)}
 const inside=(target,state=current)=>state&&(state.trigger.contains(target)||state.element.contains(target))
 const close=(restore=false)=>{
  clearTimers();const state=current;if(!state)return;current=null
  const replacement=!state.trigger.isConnected&&state.element.contains(document.activeElement)&&state.location===location.href&&state.originRoot?.isConnected?[...state.originRoot.querySelectorAll(selector)].find(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]')&&el.textContent===state.trigger.textContent&&['data-evidence-key','data-product-source','data-research-evidence','data-discovery-sources','data-segment-support-sources','data-customer-fact'].every(key=>el.getAttribute(key)===state.trigger.getAttribute(key))):null
  state.resize.disconnect();state.mutation?.disconnect();state.element.remove();state.trigger.setAttribute('aria-expanded','false');state.trigger.removeAttribute('aria-controls')
  if(activeSourcePreview===state)activeSourcePreview=null
  state.sourceAbort?.abort()
  const destination=replacement||(restore&&state.trigger.isConnected?state.trigger:null)
  if(destination){suppressFocus=true;destination.focus({preventScroll:true});suppressFocus=false}
 }
 const position=()=>{
  const state=current;if(!state)return
  if(!state.trigger.isConnected||!state.trigger.getClientRects().length){close();return}
  const viewport=window.visualViewport,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0
  const bounds=state.trigger.getBoundingClientRect(),rects=[...state.trigger.getClientRects()]
  const rect=rects.find(r=>point&&point.y>=r.top&&point.y<=r.bottom&&point.x>=r.left&&point.x<=r.right)||rects.find(r=>r.bottom>top&&r.top<top+height)||bounds
  if((bounds.bottom<top||bounds.top>top+height)&&!state.pinned){close();return}
  const gap=parseFloat(getComputedStyle(state.element).getPropertyValue('--os-preview-gap'))||12
  const box=state.element.getBoundingClientRect(),below=top+height-rect.bottom-gap,above=rect.top-top-gap
  const y=below>=box.height||below>=above?rect.bottom+gap:rect.top-gap-box.height
  state.element.style.left=Math.max(left+gap,Math.min(rect.left,left+width-box.width-gap))+'px'
  state.element.style.top=Math.max(top+gap,Math.min(y,top+height-box.height-gap))+'px'
 }
 const show=(trigger,{pin=false,focus=false}={})=>{
  clearTimers();if(destroyed||!trigger.isConnected||!trigger.getClientRects().length)return
  if(trigger.closest('.os-source-preview')){
   if(pin){const source=getSource(trigger);if(source)activeSourcePreview?.replace(source,trigger)}
   return
  }
  if(current?.trigger!==trigger){
   const source=getSource(trigger);if(!source)return
   activeSourcePreview?.close();close()
   const element=document.createElement('div');element.className='os-source-preview';element.id='os-source-preview-'+(++mountSourcePreviews.sequence)
   element.setAttribute('role','dialog');element.setAttribute('aria-label',source.title||'Источники и основания');element.setAttribute('popover','manual')
   element.innerHTML=`<header class="os-source-preview-heading"><h2 tabindex="-1">${escapeHTML(source.title||'Источники и основания')}</h2>${button({label:'Закрыть источники',attributes:{'data-os-close':true},icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'})}</header><div class="os-source-preview-content">${source.content||''}</div>`
   ;(trigger.closest('dialog')||document.body).append(element);element.showPopover?.()
   const resize=new ResizeObserver(position)
   const state={element,trigger,pinned:false,resize,close,history:[],sourceAbort:new AbortController()}
   state.replace=(source,from)=>{
    const body=element.querySelector('.os-source-preview-content'),heading=element.querySelector('h2')
    state.history.push({nodes:[...body.childNodes],title:heading.textContent,from})
    state.sourceAbort.abort();state.sourceAbort=new AbortController()
    heading.textContent=source.title||'Источники и основания';element.setAttribute('aria-label',heading.textContent);body.innerHTML=source.content||'';body.scrollTop=0
    element.querySelector('[data-os-source-back]').hidden=false;state.pinned=true
    heading.focus({preventScroll:true});source.onOpen?.({element,body,signal:state.sourceAbort.signal});position()
   }
   state.originRoot=root;state.location=location.href
   current=state;activeSourcePreview=current
   element.querySelector('.os-source-preview-heading').insertAdjacentHTML('afterbegin',button({label:'К основаниям',attributes:{'data-os-source-back':true,hidden:true},icon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>'}))
   trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',element.id)
   element.addEventListener('pointerenter',()=>clearTimeout(closing))
   element.addEventListener('pointerleave',()=>scheduleClose())
   element.addEventListener('focusin',()=>clearTimeout(closing))
   element.addEventListener('focusout',()=>scheduleBlur())
   element.addEventListener('pointerdown',()=>{state.pinned=true})
   element.addEventListener('click',event=>{
    if(event.target.closest('[data-os-close]'))close(true)
    else if(event.target.closest('[data-os-source-back]')){
     const previous=state.history.pop();if(!previous)return
     state.sourceAbort.abort();state.sourceAbort=new AbortController()
     element.querySelector('h2').textContent=previous.title;element.setAttribute('aria-label',previous.title);element.querySelector('.os-source-preview-content').replaceChildren(...previous.nodes)
     event.target.closest('[data-os-source-back]').hidden=!state.history.length;previous.from?.focus({preventScroll:true});position()
    }else if(event.target.closest('a[href^="#"]'))close()
   })
   element.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return
    const items=focusables(element)
    if(event.shiftKey&&(event.target===items[0]||event.target===element.querySelector('h2'))){event.preventDefault();trigger.focus({preventScroll:true})}
    else if(!event.shiftKey&&event.target===items.at(-1)){
     const pageItems=focusables(document).filter(el=>!element.contains(el)),next=pageItems[pageItems.indexOf(trigger)+1]
     if(next){event.preventDefault();close();next.focus()}else close(true)
    }
   })
   state.mutation=new MutationObserver(()=>{if(!trigger.isConnected||trigger.closest('[hidden],[inert]'))close()});state.mutation.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert']})
   resize.observe(element);resize.observe(trigger);position()
   source.onOpen?.({element,body:element.querySelector('.os-source-preview-content'),signal:state.sourceAbort.signal})
  }
  if(!current)return
  current.pinned ||= pin
  if(focus)current.element.querySelector('h2').focus({preventScroll:true})
 }
 const scheduleClose=()=>{
  clearTimeout(opening);clearTimeout(closing)
  if(current&&!current.pinned&&!inside(document.activeElement))closing=setTimeout(()=>close(),200)
 }
 const scheduleBlur=()=>{
  clearTimeout(closing);closing=setTimeout(()=>{
   if(!current||inside(document.activeElement))return
   // A deeper source dialog must retain its focus and return to this panel.
   if(dialogStack.at(-1)&&!dialogStack.at(-1).element.contains(current.trigger))return
   close()
  },0)
 }
 root.addEventListener('pointerover',event=>{
  const trigger=find(event.target);if(!trigger||trigger.contains(event.relatedTarget)||event.pointerType==='touch')return
  if(trigger.closest('.os-source-preview'))return
  if(current?.pinned&&current.trigger!==trigger)return
  clearTimers();point={x:event.clientX,y:event.clientY}
  opening=setTimeout(()=>{if(window.getSelection()?.isCollapsed!==false)show(trigger)},280)
 },options)
 root.addEventListener('pointerout',event=>{const trigger=find(event.target);if(trigger&&!trigger.contains(event.relatedTarget)&&!current?.element.contains(event.relatedTarget))scheduleClose()},options)
 root.addEventListener('focusin',event=>{const trigger=find(event.target);if(trigger&&!suppressFocus&&!trigger.closest('.os-source-preview')){point=null;show(trigger)}},options)
 root.addEventListener('focusout',event=>{if(find(event.target))scheduleBlur()},options)
 root.addEventListener('click',event=>{const trigger=find(event.target);if(!trigger||window.getSelection()?.isCollapsed===false)return;show(trigger,{pin:true})},options)
 root.addEventListener('keydown',event=>{
  const trigger=find(event.target);if(!trigger)return
  if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();show(trigger,{pin:true,focus:true})}
  else if(event.key==='Tab'&&!event.shiftKey&&current?.trigger===trigger){event.preventDefault();focusables(current.element)[0]?.focus()}
 },options)
 document.addEventListener('pointerdown',event=>{if(current&&!inside(event.target))close()},options)
 document.addEventListener('scroll',event=>{if(current&&!current.element.contains(event.target))position()},{...options,capture:true})
 window.addEventListener('resize',position,options)
 window.visualViewport?.addEventListener('resize',position,options)
 window.addEventListener('hashchange',()=>close(),options)
 return {close,destroy(){destroyed=true;close();abort.abort()}}
}
mountSourcePreviews.sequence=0
function sourceHref(href) {
 if(typeof href!=='string')return ''
 const value=href.trim()
 if(/[\u0000-\u0020\u007f\\]/.test(value))return ''
 if(value.startsWith('/source?'))return value
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?value:''}catch{return ''}
}
/** Source identity and source text stay separate. context/details are trusted, escaped-by-caller HTML slots. */
export function sourceEntry({title='',relation='',author='',meta='',quote='',quotes=[],href='',linkLabel='Открыть оригинал',context='',details=''} = {}) {
 const original=sourceHref(href),excerpts=(quotes.length?quotes:[quote]).filter(value=>typeof value==='string'&&value.trim())
 return `<article class="os-source-entry">${title?`<p class="os-source-entry-title"><strong>${escapeHTML(title)}</strong></p>`:''}${relation?`<p class="os-source-entry-relation">${escapeHTML(relation)}</p>`:''}${author?`<p class="os-source-entry-author">${escapeHTML(author)}</p>`:''}${meta?`<p class="os-source-entry-meta">${escapeHTML(meta)}</p>`:''}${excerpts.map(value=>`<blockquote class="os-source-entry-quote">${escapeHTML(value)}</blockquote>`).join('')}${context?`<div class="os-source-entry-context">${context}</div>`:''}${original?`<a class="os-source-entry-original" href="${escapeHTML(original)}" target="_blank" rel="noopener noreferrer">${escapeHTML(linkLabel)}</a>`:''}${details?`<details class="os-source-entry-details"><summary>Как получен вывод</summary><div>${details}</div></details>`:''}</article>`
}
export function sourceList({entries=[],emptyText='Источник не связан.'} = {}) {
 return `<div class="os-source-entries">${entries.length?entries.map(entry=>sourceEntry(entry)).join(''):`<p class="os-source-empty">${escapeHTML(emptyText)}</p>`}</div>`
}
/** Nonmodal evidence: caller owns position and document content; Escape/outside/close restore origin. */
export function popover({element,trigger=document.activeElement,content,onClose} = {}) {
 if(content!==undefined)element.innerHTML=content
 element.hidden=false;if(element.hasAttribute('popover')&&!element.matches(':popover-open'))element.showPopover(); const abort=new AbortController();const opts={signal:abort.signal}
 const close=(restore=true)=>{if(element.matches(':popover-open'))element.hidePopover();element.hidden=true;abort.abort();if(restore&&trigger?.isConnected)trigger.focus({preventScroll:true});onClose?.()}
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}},{...opts,capture:true})
 document.addEventListener('pointerdown',e=>{if(!element.contains(e.target)&&!trigger?.contains(e.target))close()},opts)
 element.addEventListener('click',e=>{if(e.target.closest('[data-os-close]'))close()},opts)
 return {element,close,destroy(){abort.abort();element.hidden=true}}
}
Object.assign(OSUI,{sourceTrigger,sourceText,sourceNote,mountSourcePreviews,sourceEntry,sourceList,popover})
if(typeof document!=='undefined')mountSourcePreviews(document,{selector:'[data-source-note]',getSource:trigger=>{
 const template=trigger.nextElementSibling
 return template?.matches('template[data-source-note-content]')?{title:template.dataset.sourceTitle,content:template.innerHTML}:null
}})
// One keyboard owner for every topic navigation. Native tab order remains intact.
if(typeof document!=='undefined')document.addEventListener('keydown',event=>{
 const item=event.target.closest('.os-topic-nav > button,.os-topic-nav > a');if(!item)return
 const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(event.key))return
 const items=[...item.parentElement.children].filter(el=>!el.disabled),index=items.indexOf(item)
 const next=event.key==='Home'?items[0]:event.key==='End'?items.at(-1):items[(index+(event.key==='ArrowRight'?1:-1)+items.length)%items.length]
 event.preventDefault();next?.focus();next?.scrollIntoView({block:'nearest',inline:'nearest'})
})

/** Parameter values are supplied by the domain; this component never infers categories. */
export function parameterFilters({parameters=[],values={},prefix='selection'}={}) {
 return `<div class="os-parameter-grid">${parameters.map(p=>{
  const selected=values[p.id],known=p.known??0,total=p.total??0
  const summary=p.kind==='number'?(selected?.unknown?'Не указано':selected?[selected.min!=null?'от '+selected.min:'',selected.max!=null?'до '+selected.max:''].filter(Boolean).join(' '):'Любое'):selected?.length?selected.map(v=>v==='__unknown'?'Не указано':p.values?.find(o=>o.id===v)?.label||v).join(', '):'Любые'
  const control=p.kind==='number'?`<div class="os-parameter-range">${field({label:'От',type:'number',value:selected?.min??'',attributes:{min:0,'data-parameter':p.id,'data-side':prefix,'data-bound':'min'}})}${field({label:'До',type:'number',value:selected?.max??'',attributes:{min:0,'data-parameter':p.id,'data-side':prefix,'data-bound':'max'}})}</div><label class="os-parameter-option"><input type="checkbox" data-parameter="${escapeHTML(p.id)}" data-side="${prefix}" data-bound="unknown" ${selected?.unknown?'checked':''}>Не указано / неоднозначно</label>`:[...(p.values||[]),{id:'__unknown',label:'Не указано / неоднозначно',count:p.unknown||0}].map(v=>`<label class="os-parameter-option"><input type="checkbox" data-parameter="${escapeHTML(p.id)}" data-side="${prefix}" value="${escapeHTML(v.id)}" ${selected?.includes(v.id)?'checked':''}><span>${escapeHTML(v.label)} <span class="os-parameter-count">(${v.count??0})</span></span></label>`).join('')
  return `<details class="os-parameter-filter" data-parameter-box="${escapeHTML(p.id)}"><summary><span>${escapeHTML(p.label)}</span><span class="os-parameter-value">${escapeHTML(summary)}</span></summary><p class="os-parameter-coverage">Известно в ${known} из ${total} материалов.</p><fieldset><legend class="sr-only">${escapeHTML(p.label)}</legend>${control}</fieldset></details>`
 }).join('')}</div>`
}
/** Side-by-side facts reflow into labelled cells, keeping every number's scope. */
export function comparisonRows({rows=[],leftLabel='Выбранная группа',rightLabel='Весь сегмент'}={}) {
 return `<div class="os-comparison-rows">${rows.map(row=>`<article class="os-comparison-row"><div class="os-comparison-title"><h4>${escapeHTML(row.label)}</h4>${row.description?`<p>${escapeHTML(row.description)}</p>`:''}${row.actions||''}</div><div class="os-comparison-cell"><p class="os-comparison-label">${escapeHTML(leftLabel)}</p>${row.left||'<p>Нет данных</p>'}</div><div class="os-comparison-cell"><p class="os-comparison-label">${escapeHTML(rightLabel)}</p>${row.right||'<p>Нет данных</p>'}</div></article>`).join('')}</div>`
}
Object.assign(OSUI,{parameterFilters,comparisonRows})
