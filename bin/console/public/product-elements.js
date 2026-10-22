import {ProductTabs} from './product-tabs.js'
import {escapeHTML as e,button,textLink,collectionLayout,detailLayout,emptyState,notice,loadingState,sourceNote,sourceList,readingSection,paperSurface,field,filterBar,disclosure,imageFocus,pagination,filterLink} from './ui-components.js'
import {createReadCache} from './read-resource.js'
const elementsCache=createReadCache({accept:value=>value?.state==='ready'&&value.elements?.length>0})

const list=v=>Array.isArray(v)?v:[]
const countWords=(number,one,few,many)=>{const mod10=number%10,mod100=number%100;return mod10===1&&mod100!==11?one:mod10>=2&&mod10<=4&&(mod100<10||mod100>=20)?few:many}
const roles={component:{title:'Компонент',plural:'Компоненты',purpose:'Отдельная деталь интерфейса.',listPurpose:'Отдельные детали интерфейса.'},composition:{title:'Композиция',plural:'Композиции',purpose:'Сочетание компонентов для экрана или сценария.',listPurpose:'Сочетания компонентов для экранов и сценариев.'},rule:{title:'Правило',plural:'Правила',purpose:'Правило для текста, расположения или взаимодействия.',listPurpose:'Правила текста, расположения и взаимодействия.'}}
const roleGroup=row=>row.role==null?'unclassified':Object.hasOwn(roles,row.role)?row.role:'unknown'
const roleText=row=>row.role==null?'Роль не указана':roles[row.role]?.title||'Неизвестная роль: '+row.role
const rolePurpose=role=>roles[role]?.listPurpose||(role==='unclassified'?'В сохранённых записях роль не указана.':role==='unknown'?'В записях сохранены роли, которые этот каталог пока не распознаёт.':'Компоненты — отдельные детали; композиции — их сочетания; правила — текст, расположение и поведение.')
const statuses={proposed:'Предложение',selected:'Выбрано владельцем',implemented:'Есть в базовой версии'}
export function elementRoute(state={}) {
 const query=new URLSearchParams()
 for(const key of ['category','status','role','page','step','library','documents'])if(state[key]&&!(key==='page'&&Number(state[key])===1))query.set(key,key==='documents'?'1':String(state[key]))
 return 'library/elements'+(state.element?'/'+encodeURIComponent(state.element):'')+(query.size?'?'+query:'')
}
const link=(label,state)=>textLink({label,href:'#'+elementRoute(state)})
const prose=text=>typeof text==='string'?text.split(/\n\s*\n/).map(p=>`<p>${e(p).replaceAll('\n','<br>')}</p>`).join(''):''
const imageURL=(data,row,media,step='')=>media.previewURL||'/api/product-elements/image?'+new URLSearchParams({productId:data.productId,element:row.id,...(step?{step}:{})})
function picture(data,row,media,step='') {
 if(!media)return ''
 const url=imageURL(data,row,media,step),title=list(row.steps).find(s=>s.id===step)?.title||row.title
 return `<div class="product-element-media"><div class="os-actions">${button({label:'Увеличить изображение',attributes:{'data-element-image-focus':row.id,'data-element-image-step':step,'aria-label':'Увеличить изображение: '+title,'aria-haspopup':'dialog'}})}</div><figure class="product-element-picture"><div data-element-image-loading>${loadingState({label:'Загрузка изображения…'})}</div><img data-element-raster src="${e(url)}" alt="${e(media.alt)}" ${media.width?`width="${e(media.width)}"`:''} ${media.height?`height="${e(media.height)}"`:''}><div data-element-image-error hidden>${notice({kind:'warning',message:'Изображение недоступно. Описание элемента и его источники доступны ниже.'})}</div></figure></div>`
}
function sourceAction(row) {
 return sourceNote({text:'Источники элемента',title:'Источники',variant:'link',content:sourceList({entries:list(row.sources).map(s=>({title:s.label,href:s.available===false?'':'/source?path='+encodeURIComponent(s.path),relation:s.available===false?'Сохранённый файл источника недоступен.':'',meta:s.path}))})})
}
function statePage(data) {
 return emptyState({kind:['error','unsupported'].includes(data.state)?'unavailable':'first-use',title:data.state==='awaiting'?'Материалы готовятся':data.state==='unregistered'?'Элементы пока не добавлены':'Каталог недоступен',description:data.message,actions:button({label:'Обновить каталог',attributes:{'data-elements-retry':true}})})
}
export function renderElements(data,state={},{product={},workspaceName='',nav='',library=false}={}) {
 const header=title=>ProductTabs.header(product,'elements',{title:library&&title==='Элементы продукта'?'Наши элементы':title,workspaceName})
 if(data.state!=='ready')return collectionLayout({header:header('Элементы продукта'),nav,content:statePage(data)})
 // The legacy generic catalog label names this same product topic, not a separate collection.
 const productName=product.displayLabel||product.displayName||product.label||workspaceName
 const catalogTitle=data.title&&data.title!=='Элементы продукта'&&data.title!==`Повторно используемые элементы ${productName}`?data.title:''
 const rows=list(data.elements),categories=list(data.categories),hasRoles=rows.some(r=>r.role!=null),parent={...state,element:'',step:''}
 const issues=list(data.issues).length?notice({kind:'warning',message:data.issues.join('\n')}):''
 if(state.element){
  const row=rows.find(r=>r.id===state.element)
  if(!row)return detailLayout({header:header('Элемент не найден'),nav,back:link('← К элементам продукта',parent),content:emptyState({kind:'unavailable',description:'Сохранённая ссылка устарела или элемент ещё не добавлен.'})})
  const steps=list(row.steps),requested=steps.findIndex(s=>s.id===state.step),index=requested>=0?requested:0,step=steps[index]
  const category=categories.find(c=>c.id===row.category)?.title||''
  const controls=steps.length>1?`<nav class="os-actions" aria-label="Экраны элемента">${index>0?link('← Предыдущий экран',{...state,step:steps[index-1].id}):''}${index<steps.length-1?link('Следующий экран →',{...state,step:steps[index+1].id}):''}</nav>`:''
  const stepContent=step?readingSection({title:step.title,intro:steps.length>1?`Экран ${index+1} из ${steps.length}`:'',content:`${controls}<div class="product-element-step">${picture(data,row,step.media,step.id)}<div>${prose(step.description)}</div></div>${controls}`}):''
  const persona=row.persona?readingSection({title:'Кто этот персонаж',content:prose(row.persona)}):''
  const speech=row.speech?readingSection({title:'Как говорит',content:`<blockquote>${e(row.speech)}</blockquote>`}):''
  const table=row.table?`<div class="product-element-table" role="region" aria-label="${e(row.title)} — таблица" tabindex="0"><table><thead><tr>${list(row.table.columns).map(c=>`<th scope="col">${e(c)}</th>`).join('')}</tr></thead><tbody>${list(row.table.rows).map(r=>`<tr>${list(r).map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''
  const related=list(row.relatedIds).map(id=>rows.find(r=>r.id===id)).filter(Boolean)
  const relatedSection=related.length?readingSection({title:'Связанные элементы',content:`<ul>${related.map(r=>`<li>${link(r.title,{...state,element:r.id,step:''})}</li>`).join('')}</ul>`}):''
  return detailLayout({className:'product-element-detail',back:link('← К элементам продукта',parent),header:header(row.title),nav,notice:issues+(state.step&&requested<0?notice({kind:'warning',message:'Экран по этой ссылке не найден. Показан первый экран элемента.'}):''),content:paperSurface({content:`<p class="product-element-meta">${[hasRoles||row.role!=null?roleText(row):'',category,statuses[row.status]].filter(Boolean).map(e).join(' · ')}</p>${row.role!=null?`<p>${e(roles[row.role]?.purpose||'Сохранённая роль пока не распознаётся.')}</p>`:''}${prose(row.summary)}${prose(row.context)}${!step?picture(data,row,row.preview):''}${persona}${speech}${stepContent}${prose(row.body)}${row.text!==row.body?prose(row.text):''}${table}${relatedSection}${readingSection({title:'Основание элемента',content:sourceAction(row)+(row.dataRef?disclosure({title:'Данные для AI',content:`<p>${e(row.dataRef)}</p>`}):'')})}`})})
 }
 const unknownCategory=state.category&&!categories.some(c=>c.id===state.category),unknownStatus=state.status&&!Object.hasOwn(statuses,state.status),unknownRole=state.role&&!Object.hasOwn(roles,state.role)&&!['unclassified','unknown'].includes(state.role),unknown=unknownCategory||unknownStatus||unknownRole
 const filtered=rows.filter(r=>(!state.category||r.category===state.category)&&(!state.status||r.status===state.status)&&(!state.role||roleGroup(r)===state.role)),size=12,total=Math.max(1,Math.ceil(filtered.length/size)),requested=Number(state.page),page=Math.min(total,Math.max(1,Number.isSafeInteger(requested)?requested:1)),normalized={...parent,page}
 const count=category=>rows.filter(r=>(!category||r.category===category)&&(!state.status||r.status===state.status)&&(!state.role||roleGroup(r)===state.role)).length
 const options=(items,value)=>items.map(([id,label])=>`<option value="${e(id)}"${id===(value||'')?' selected':''}>${e(label)}</option>`).join('')
 const roleRows=rows.filter(r=>(!state.category||r.category===state.category)&&(!state.status||r.status===state.status))
 const roleOptions=[['','Все'],...Object.entries(roles).map(([id,r])=>[id,r.plural]),...(rows.some(r=>roleGroup(r)==='unclassified')?[['unclassified','Без указанной роли']]:[]),...(rows.some(r=>roleGroup(r)==='unknown')?[['unknown','Неизвестные роли']]:[])]
 const roleNav=hasRoles||state.role?`<nav class="os-actions" aria-label="Роли элементов">${roleOptions.map(([role,label])=>filterLink({label:label+' · '+roleRows.filter(r=>!role||roleGroup(r)===role).length,href:'#'+elementRoute({...parent,role,page:1}),active:role===(state.role||'')})).join('')}</nav><p>${e(rolePurpose(state.role))} Схемы иллюстрируют записи.</p>`:''
 const filters=roleNav+filterBar({label:'Фильтры элементов',open:state.filtersOpen,active:Boolean(state.category||state.status),content:field({name:'category',label:'Категория',type:'select',attributes:{id:'product-elements-category','data-element-filter':'category'},optionsHtml:(unknownCategory?`<option value="${e(state.category)}" selected disabled>Категория по ссылке недоступна</option>`:'')+options([['',`Все категории · ${count('')}`],...categories.map(c=>[c.id,`${c.title} · ${count(c.id)}`])],state.category)})+field({name:'status',label:'Состояние элемента',type:'select',attributes:{id:'product-elements-status','data-element-filter':'status'},optionsHtml:(unknownStatus?`<option value="${e(state.status)}" selected disabled>Состояние по ссылке недоступно</option>`:'')+options([['','Все состояния'],...Object.entries(statuses)],state.status)})+(state.category||state.status?button({label:'Сбросить фильтры',href:'#'+elementRoute({library:state.library,documents:state.documents})}):'')})
 const cards=filtered.slice((page-1)*size,page*size).map(row=>`<article class="product-element-card"><p class="product-element-meta">${[hasRoles?roleText(row):'',categories.find(c=>c.id===row.category)?.title,statuses[row.status]].filter(Boolean).map(e).join(' · ')}</p><h3>${link(row.title,{...normalized,element:row.id})}</h3><p>${e(row.summary)}</p>${row.preview?picture(data,row,row.preview):''}</article>`).join('')
 const title=state.category?categories.find(c=>c.id===state.category)?.title||'Категория недоступна':state.role?(roles[state.role]?.plural||roleOptions.find(([id])=>id===state.role)?.[1]||'Роль недоступна'):'Все элементы'
 const resultContext=[state.role?(roles[state.role]?.plural||roleOptions.find(([id])=>id===state.role)?.[1]||'Роль недоступна'):'',state.status&&!unknownStatus?`Состояние: ${statuses[state.status]}`:''].filter(Boolean).join(' · ')
 const pages=()=>pagination({page,pages:total,total:filtered.length,size,label:'Страницы элементов',context:resultContext,href:p=>'#'+elementRoute({...parent,page:p})})
 return collectionLayout({className:'product-elements',header:header('Элементы продукта'),nav,filters,notice:issues+(unknown?notice({kind:'warning',message:'В адресе указан отсутствующий фильтр. Выберите доступное значение или сбросьте фильтры.'}):''),content:(catalogTitle||!hasRoles?`<p>${catalogTitle?`Каталог: ${e(catalogTitle)}. `:''}${!hasRoles?'Здесь собраны отдельные части продукта и правила их совместной работы. Схемы иллюстрируют записи.':''}</p>`:'')+readingSection({title,content:pages()+(cards?`<div class="product-element-grid">${cards}</div>`:emptyState({kind:rows.length?'no-results':'first-use',title:rows.length?'По этим фильтрам элементов нет':'Каталог пока пуст',description:hasRoles?'Измените роль или фильтры либо откройте все элементы.':'Выберите другую категорию или откройте все элементы.',actions:link('Все элементы',{library:state.library,documents:state.documents})}))+(total>1?pages():'')})})
}
export function mountElements(root,{productId,versionKey='',product={},workspaceName='',nav='',state={},data,library=false,navigate=route=>window.AtlasNavigation?.navigate(route)}={}) {
 const abort=new AbortController();let disposed=false,panel
 function closeImage(){panel?.close({restoreFocus:false});panel?.destroy();panel=null}
 function render(value){if(disposed)return;closeImage();data={...value,productId};root.innerHTML=renderElements(data,state,{product,workspaceName,nav,library});root.removeAttribute('aria-busy');for(const img of root.querySelectorAll('[data-element-raster]')){const figure=img.closest('figure'),loading=figure.querySelector('[data-element-image-loading]'),error=figure.querySelector('[data-element-image-error]'),loaded=()=>{loading.hidden=true},failed=()=>{img.hidden=true;loading.hidden=true;error.hidden=false};img.addEventListener('load',loaded,{signal:abort.signal});img.addEventListener('error',failed,{signal:abort.signal});if(img.complete)img.naturalWidth?loaded():failed()}}
 async function load(refresh=false){const url='/api/product-elements?'+new URLSearchParams({productId}),cached=!refresh&&elementsCache.peek(url,{version:versionKey});if(cached){render(cached);return}root.setAttribute('aria-busy','true');root.innerHTML=collectionLayout({header:ProductTabs.header(product,'elements',{title:library?'Наши элементы':'Элементы продукта',workspaceName}),nav,content:loadingState({label:'Загрузка элементов продукта…'})});try{render(await elementsCache.load(url,{version:versionKey,refresh}))}catch{render({state:'error',message:'Не удалось загрузить каталог. Повторите попытку.'})}}
 root.addEventListener('change',event=>{const control=event.target.closest('[data-element-filter]');if(control&&navigate)navigate(elementRoute({...state,element:'',step:'',page:1,[control.dataset.elementFilter]:control.value}))},{signal:abort.signal})
 root.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-element-image-focus]')
  if(trigger){
   const row=list(data?.elements).find(r=>r.id===trigger.dataset.elementImageFocus),step=list(row?.steps).find(s=>s.id===trigger.dataset.elementImageStep),media=step?step.media:row?.preview
   if(!media)return
   closeImage();panel=imageFocus({src:imageURL(data,row,media,step?.id),alt:media.alt,title:'Изображение элемента',trigger,context:`<p>${e(row.title)}${step?' · '+e(step.title):''}</p>${step?prose(step.description):prose(row.summary)}${sourceAction(row)}`});return
  }
  if(event.target.closest('[data-elements-retry]'))load(true);const anchor=event.target.closest('a[href^="#library/elements"]');if(anchor&&navigate&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();event.stopPropagation();navigate(anchor.hash.slice(1))}
 },{signal:abort.signal})
 const ready=data?(render(data),Promise.resolve()):load()
 return {ready,destroy(){disposed=true;closeImage();abort.abort()}}
}
