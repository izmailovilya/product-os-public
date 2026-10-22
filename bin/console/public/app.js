import * as UI from './ui-components.js'
import {mountIdentity} from './identity-reading.js'
import {mountReferences} from './product-references.js'

const page = document.querySelector('#publicPage')
const feedback = document.querySelector('#publicFeedback')
const labels = {product:'Продукт',materials:'Материалы',competitors:'Конкуренты',segments:'Сегменты',jobs:'Карта работ',research:'Исследования',library:'Библиотека'}
let snapshot, signature, pending, route = ''
let mapRequest, mapView, mapResult
let libraryMount
const text = value => {
  if(typeof value === 'string')return value
  if(!value || typeof value !== 'object')return ''
  for(const key of ['text','statement','summary','label','job','rawOutcome'])if(typeof value[key] === 'string')return value[key]
  return ''
}
const list = value => Array.isArray(value) ? value : []
const firstList = (...values) => values.find(value=>Array.isArray(value)&&value.length) || []
const enc = encodeURIComponent
const name = row => row?.displayLabel || row?.displayName || row?.label || row?.name || 'Без названия'
const rawNode = id => snapshot.graph.nodes.find(row => row.id === id)
const data = row => ({...(rawNode(row?.id)?.data || {}),...(row?.data || {})})

// Keep provided Markdown links readable without allowing HTML or script URLs.
function linkTarget(value) {
  if(typeof value!=='string')return ''
  if (/^https?:\/\//i.test(value)) return value
  const ref = value.replace(/^\.\//,'').replace(/^(?:\.\.\/)+/,'')
  if (/^(?:sources\/|reports\/|PRODUCT\.md(?:#|$)|MOVES\.md(?:#|$))/.test(ref) && !ref.includes('..') && !ref.includes('\\')) {
    const file = ref.split('#')[0]
    return (file.startsWith('reports/') ? '/report?path=' : '/source?path=') + enc(file)
  }
  return ''
}
function inline(value) {
  const source = String(text(value)), pattern = /\[([^\]]+)\]\(([^)]+)\)/g
  const styled = part => UI.escapeHTML(part).replace(/\*\*([^*\n]+)\*\*|`([^`\n]+)`/g,(_,bold,code)=>code!==undefined?`<code>${code}</code>`:`<strong>${bold}</strong>`)
  let html = '', position = 0
  for (const match of source.matchAll(pattern)) {
    html += styled(source.slice(position,match.index))
    const href = linkTarget(match[2])
    html += href ? UI.textLink({label:match[1],href}) : UI.escapeHTML(match[1])
    position = match.index + match[0].length
  }
  return html + styled(source.slice(position))
}
const provenance = value => list(value?.sourceRefs || value?.evidence).map((ref,i)=>{const href=linkTarget(typeof ref==='string'?ref:ref.source||ref.url||'');return href?UI.textLink({label:'Источник '+(i+1),href}):''}).filter(Boolean).join(' · ')
const prose = value => text(value).split(/\n\s*\n/).filter(Boolean).map(part=>`<p>${inline(part).replace(/\n/g,'<br>')}</p>`).join('')+(provenance(value)?`<p class="public-source">${provenance(value)}</p>`:'')
const rows = values => list(values).filter(value=>text(value)).map(value=>`<li>${inline(value)}${provenance(value)?` <span class="public-source">${provenance(value)}</span>`:''}</li>`).join('')
function sourceLink(row,label='Открыть исходное описание') {
  const source = row?.source || rawNode(row?.id)?.source
  const href = source && linkTarget(source)
  return href ? `<p class="public-source">${UI.textLink({label,href})}</p>` : ''
}
function facts(sections) {
  return UI.readingSections({sections:sections.filter(section=>section.content).map((section,i)=>({id:'section-'+i,...section})),contentsTitle:'На странице'})
}
function empty(kind) {
  const prompt = kind==='segments' ? 'добавь сегмент, его задачу и известные сведения' : 'добавь конкурента, его сайт и известные сведения'
  return UI.emptyState({title:kind==='segments'?'Сегментов пока нет':'Конкурентов пока нет',description:`Попросите своего агента: «Через product-context ${prompt}». Здесь появится сохранённая запись.`})
}
const researchHref = (report,segment='') => '#research/'+enc(report.path)+(segment?'?segment='+enc(segment):'')
const reportState = report => ({partial:'Частичный результат',failed:'Исследование не завершено',completed:'Отчёт сохранён'})[report.outcome] || 'Сохранённый материал'
function segmentReports(id) {
  const node=rawNode(id), paths=Object.values(node?.data?.research || {}).map(run=>run?.report)
  return list(snapshot.reports).filter(report=>report.nodeId===id || paths.includes(report.path))
}
function researchCards(reports,segment='') {
  return `<div class="public-records">${reports.map(report=>UI.summaryCard({title:report.title,href:researchHref(report,segment),level:2,meta:UI.escapeHTML(reportState(report)),content:prose(report.summary)})).join('')}</div>`
}
function researchPage(id,segment) {
  const report=list(snapshot.reports).find(report=>report.path===id)
  const parent=segment && segmentReports(segment).some(item=>item.path===id) && entityRows('segments').find(item=>item.id===segment)
  const back=UI.textLink({label:parent?'← '+name(parent):'← Исследования',href:parent?'#segment/'+enc(segment):'#research'})
  if(!id)return UI.collectionLayout({header:UI.pageHeader({title:'Исследования',back:UI.textLink({label:'← Продукт',href:'#product'})}),content:list(snapshot.reports).length?researchCards(snapshot.reports):UI.emptyState({title:'Исследований пока нет',description:'Попросите своего агента исследовать конкретный вопрос через product-research. Здесь появится сохранённый результат с его областью и ограничениями.'})})
  if(!report)return UI.detailLayout({header:UI.pageHeader({title:'Результат не найден',back}),content:'<p>Отчёт мог быть удалён или перемещён. Откройте список сохранённых исследований.</p>'})
  const target=report.nodeId && rawNode(report.nodeId)
  return UI.detailLayout({header:UI.pageHeader({title:report.title,back}),content:facts([
    {title:'Результат',content:`<p>${UI.escapeHTML(reportState(report))}${report.dateLabel?' · '+UI.escapeHTML(report.dateLabel):''}</p>`+prose(report.summary)},
    {title:'Область',content:target?`<p>${UI.escapeHTML(name(target))}</p>`:'<p>Область не указана отдельно. Проверьте её в отчёте.</p>'},
  ])+UI.button({label:'Открыть отчёт',variant:'primary',href:linkTarget(report.path)})})
}
const coverageLabels={ready:'Доступно в продукте',assist:'Помощь с частью работы',change:'Нужна доработка',external:'Нужно внешнее действие',unknown:'Пока не оценено'}
function mapSources(map,ids) {
  return [...new Set(list(ids))].map(id=>{
    const source=map.sources?.[id]
    if(!source)return '<p>Сохранённое основание недоступно.</p>'
    const href=linkTarget(source.path)
    return UI.disclosure({title:source.title||'Основание',content:prose(source.text)+(href?`<p>${UI.textLink({label:'Открыть источник',href})}</p>`:'')+(source.document?`<pre class="public-document">${UI.escapeHTML(source.document)}</pre>`:'')})
  }).join('')
}
function mapList(map) {
  const sections=map.graphs.map(graph=>({id:'map-graph-'+enc(graph.id),title:graph.title,content:prose(graph.note)+prose(graph.boundary)+
    '<ul>'+graph.edges.map(edge=>`<li>${UI.escapeHTML(map.jobs[edge.from].label)} → чтобы ${UI.escapeHTML(map.jobs[edge.to].label)}${edge.why?'. '+inline(edge.why):''}${edge.condition?'<br>Условие: '+inline(edge.condition):''}</li>`).join('')+'</ul>'}))
  for(const job of Object.values(map.jobs)) {
    const coverage=job[map.scope?.edition==='public'?'public':'full']
    sections.push({id:'map-job-'+enc(job.id),title:job.label,content:prose(job.description)+UI.proseFacts({items:[
      {label:'Что должно получиться',value:inline(job.output)},
      {label:'Что нужно на входе',value:inline(job.input)},
      {label:'Вклад продукта',value:inline(coverage.contribution)},
      {label:'Что остаётся за пределами',value:inline(coverage.limit)},
      {label:'Как выполняется работа',value:inline(job.mechanism)},
      {label:'Альтернативы',value:inline(job.alternatives)},
    ].filter(item=>item.value)})+`<p>${UI.escapeHTML(coverageLabels[coverage.state]||coverageLabels.unknown)}</p>`+
      (job.change?'<h3>Что нужно доработать</h3>'+prose(job.change):'')+mapSources(map,coverage.sources)})
  }
  sections.push({id:'map-contexts',title:'Связи с сегментами',content:'<p>Связи предварительные. Условия и критерии каждого сегмента уточняются отдельно.</p>'+map.contexts.map(context=>`<h3>${context.available&&context.segmentId?UI.textLink({label:context.label,href:'#segment/'+enc(context.segmentId)}):UI.escapeHTML(context.label)}</h3>`+prose(context.reason)+prose(context.situation)+(!context.available?'<p>Актуальный профиль недоступен.</p>':'')).join('')})
  return UI.readingSections({sections,contentsTitle:'Работы и связи'})
}
function jobsPage() {
  return UI.detailLayout({header:UI.pageHeader({title:'Карта работ'}),content:'<div id="publicMapReading" aria-live="polite">'+UI.loadingState({kind:'section',label:'Загружаем карту работ…'})+'</div>'})
}
function renderMap() {
  const root=document.querySelector('#publicMapReading');if(!root||!mapResult)return
  if(mapResult.state!=='ready') {
    root.innerHTML=mapResult.state==='error'?UI.notice({kind:'error',message:mapResult.message,actions:UI.button({label:'Повторить загрузку карты',attributes:{'data-map-retry':''}})}):UI.emptyState({title:'Карта работ ещё не составлена',description:mapResult.message+' Попросите своего агента построить её через product-job-map.'})
    return
  }
  const map=mapResult.map
  root.innerHTML=prose(map.basis)+UI.filterBar({label:'Вид карты',collapsible:false,content:['canvas','list'].map(view=>UI.button({label:view==='canvas'?'Схема':'Список',variant:mapView===view?'primary':'secondary',attributes:{'data-map-view':view,'aria-pressed':mapView===view}})).join('')})+
    (mapView==='list'?mapList(map):window.JobFlow.strategicMarkup(mapResult.productId,mapResult,{profileLinksOnly:true}))
}
async function loadMap() {
  mapRequest?.abort();const request=new AbortController();mapRequest=request;mapResult=null
  const root=document.querySelector('#publicMapReading');if(!root)return
  root.innerHTML=UI.loadingState({kind:'section',label:'Загружаем карту работ…'})
  try {
    const product=snapshot.graph.nodes.find(node=>node.type==='product'&&node.status!=='dropped'&&!node.data?.retired)
    const response=await fetch('/api/strategic-jobs?'+new URLSearchParams({productId:product?.id||''}),{signal:request.signal})
    if(!response.ok)throw Error()
    const result=await response.json()
    if(request!==mapRequest||locationState().kind!=='jobs')return
    mapResult=result;mapView ||= matchMedia('(max-width:1040px)').matches?'list':'canvas';renderMap()
  }catch(error){if(error.name==='AbortError'||request!==mapRequest)return;mapResult={state:'error',message:'Не удалось загрузить карту работ. Проверьте локальный сервер и повторите попытку.'};renderMap()}
}
const libraryTopics=[{id:'identity',label:'Айдентика',href:'#library/identity'},{id:'references',label:'Референсы',href:'#library/references'}]
function libraryPage(topic) {
  return UI.collectionLayout({header:UI.pageHeader({title:topic==='identity'?'Айдентика':'Референсы'}),nav:UI.topicNav({label:'Библиотека продукта',active:topic,items:libraryTopics}),content:topic==='identity'?'<section data-product-identity></section>':'<section data-product-references aria-label="Референсы продукта"></section>'})
}
function mountLibrary(state,filtersOpen) {
  const product=snapshot.graph.nodes.find(node=>node.type==='product'&&node.status!=='dropped'&&!node.data?.retired)
  const navigate=next=>{location.hash='#'+next}
  const options={productId:product?.id||'',state:{...state.params,card:state.card,filtersOpen},navigate}
  libraryMount=state.id==='identity'?mountIdentity(page.querySelector('[data-product-identity]'),options):mountReferences(page.querySelector('[data-product-references]'),options)
}
function productPage() {
  const row = snapshot.graph.nodes.find(row=>row.id===snapshot.graph.productId) || snapshot.graph.nodes.find(row=>row.type==='product')
  const d = row?.data || {}, description = d.description || {}
  const sections = [
    {title:'Что делает продукт',content:prose(description.what || d.summary)},
    {title:'Для кого',content:prose(description.forWhom)},
    {title:'Результат для клиента',content:prose(description.outcome)},
    {title:'Цель',content:prose(d.businessGoal)},
    {title:'Ограничения',content:prose(d.constraints)},
    {title:'Стадия',content:prose(d.stage)},
    {title:'Рынок',content:prose(d.market)},
    {title:'Цена и условия',content:prose(d.pricing)},
    {title:'Возможности',content:rows(Object.values(d.capabilities || {})) ? `<ul>${rows(Object.values(d.capabilities || {}))}</ul>` : ''},
    {title:'Открытые вопросы',content:rows(d.openQuestions || d.unknowns) ? `<ul>${rows(d.openQuestions || d.unknowns)}</ul>` : ''},
    {title:'Исследования',content:`<p>${UI.textLink({label:'Сохранённые исследования',href:'#research'})}</p>`},
  ]
  return UI.detailLayout({header:UI.pageHeader({title:'Продукт',context:UI.escapeHTML(name(row))}),content:sections.some(s=>s.title!=='Исследования'&&s.content)?facts(sections)+sourceLink(row,'Открыть паспорт продукта'):UI.emptyState({title:'Опишите свой продукт',description:'Откройте эту папку в Codex или Claude Code и попросите настроить её через os-setup.'})})
}
function materialPage() {
  const originals = snapshot.sources || [], reports = snapshot.reports || []
  const cards = (items,original) => `<div class="public-records">${items.map(row=>UI.summaryCard({title:row.name||row.title,content:original?'<p>Исходный файл сохранён без изменений.</p>':prose(row.summary),actions:UI.button({label:original?'Открыть оригинал':'Открыть заметку',href:(original?'/source?path=':'/report?path=')+enc(row.source||row.path)})})).join('')}</div>`
  return UI.collectionLayout({header:UI.pageHeader({title:'Материалы',description:`Исходные материалы: ${originals.length} · Заметки: ${reports.length}`}),content:UI.readingSection({title:'Исходные материалы',content:originals.length?cards(originals,true):'<p>Передайте файл агенту и попросите сохранить его через product-context.</p>'})+UI.readingSection({title:'Заметки',content:reports.length?cards(reports,false):'<p>Заметки появятся после работы с материалами.</p>'})})
}
function entityRows(kind) {
  const projected = kind==='segments' ? [...snapshot.galaxy?.segments||[],...snapshot.galaxy?.subSegments||[]] : snapshot.galaxy?.competitors || []
  const byId = new Map(projected.map(row=>[row.id,row]))
  for (const row of snapshot.graph.nodes.filter(row=>row.type===(kind==='segments'?'segment':'competitor') && row.status!=='dropped')) if(!byId.has(row.id))byId.set(row.id,row)
  return [...byId.values()].filter(row=>!row.data?.retired)
}
function entityCollection(kind) {
  const items = entityRows(kind), singular = kind==='segments'?'segment':'competitor'
  return UI.collectionLayout({header:UI.pageHeader({title:labels[kind]}),content:items.length?`<div class="public-records">${items.map(row=>{const d=data(row);return UI.summaryCard({title:name(row),href:`#${singular}/${enc(row.id)}`,level:2,meta:kind==='segments'&&rawNode(row.id)?.status==='hypothesis'?'Гипотеза':'',content:prose(row.customerProfile?.summary || row.description || d.description || d.summary)})}).join('')}</div>`:empty(kind)})
}
function entityPage(kind,id) {
  const items=entityRows(kind), row=items.find(row=>row.id===id)
  if(!row)return UI.detailLayout({header:UI.pageHeader({title:kind==='segments'?'Сегмент не найден':'Конкурент не найден',back:UI.textLink({label:'← '+labels[kind],href:'#'+kind})}),content:'<p>Откройте список и выберите существующую запись.</p>'})
  const d=data(row), p=row.customerProfile || {}, sections=[]
  const add=(title,value)=>{if(text(value))sections.push({title,content:prose(value)})}
  const addList=(title,value)=>{const content=rows(value);if(content)sections.push({title,content:`<ul>${content}</ul>`})}
  add('Описание',p.summary || row.description || d.description || d.summary)
  if(kind==='segments') {
    if(rawNode(id)?.status==='hypothesis')sections.push({title:'Статус',content:'<p>Гипотеза сегмента. Сохранённое описание само по себе не подтверждает спрос.</p>'})
    add('Контекст',p.context || row.context || d.context)
    add('Как узнать этих клиентов',p.recognition)
    add('Почему выделены отдельно',p.whySeparate || row.definition || d.definition)
    add('Основная задача',p.primaryJob || row.coreJob || d.coreJob)
    addList('Критерии результата',firstList(p.successCriteria,row.criteria,d.criteria))
    addList('Задачи',firstList(p.otherJobs,row.jobs,d.jobs))
    add('Как помогает продукт',p.productFit)
    for(const [key,title] of [['trigger','Повод искать'],['discovery','Как находят решение'],['firstUse','Первое использование'],['purchase','Решение об оплате'],['retention','Почему возвращаются']])add(title,p.journey?.[key])
    add('Текущие решения',p.alternatives || d.alternatives)
    addList('Открытые вопросы',p.unknowns || d.unknowns)
    const reports=segmentReports(id)
    sections.push({title:'Исследования сегмента',content:reports.length?researchCards(reports,id):'<p>Сохранённых исследований этого сегмента пока нет.</p>'})
  } else {
    add('Почему включён в сравнение',row.classification?.rationale || d.rationale)
    addList('Задачи клиента',row.jobCoverage || d.jobs)
    add('Цена и условия',row.pricing || d.pricing)
    addList('Сведения о цене',row.priceDetails)
    addList('Причины выбора',list(row.hiredFacts).map(item=>item.whyHired))
    addList('Ограничения',row.failures || d.limitations)
    addList('Обещания',row.messaging)
  }
  const url=row.url || row.website || d.url || d.website
  if(/^https?:\/\//i.test(url||''))sections.push({title:'Сайт',content:`<p>${UI.textLink({label:url,href:url})}</p>`})
  const related = kind==='segments' ? entityRows('competitors').filter(c=>list(c.segmentIds).includes(id)) : entityRows('segments').filter(s=>list(row.segmentIds).includes(s.id))
  if(related.length)sections.push({title:kind==='segments'?'Конкуренты и альтернативы':'Связанные сегменты',content:`<ul>${related.map(item=>`<li>${UI.textLink({label:name(item),href:'#'+(kind==='segments'?'competitor':'segment')+'/'+enc(item.id)})}</li>`).join('')}</ul>`})
  return UI.detailLayout({header:UI.pageHeader({title:name(row),back:UI.textLink({label:'← '+labels[kind],href:'#'+kind})}),content:(sections.length?facts(sections):'<p>Описание ещё не добавлено. Передайте известные сведения агенту через product-context.</p>')+sourceLink(row)})
}
function locationState() {
  let [kind='product',id='',card=''] = location.hash.slice(1).split('?')[0].split('/')
  try{id=decodeURIComponent(id);card=decodeURIComponent(card)}catch{id='';card=''}
  const aliases={map:'segments',hangar:'competitors',reports:'materials',next:'product',skills:'product'}
  if(aliases[kind])kind=aliases[kind]
  if(!Object.hasOwn(labels,kind)&&!['segment','competitor'].includes(kind))kind='product'
  if(Object.hasOwn(labels,kind)&&!['research','library'].includes(kind))id=''
  if(kind==='library'&&!['identity','references'].includes(id))id='identity'
  const query=new URLSearchParams(location.hash.split('?')[1]||''),segment=kind==='research'?query.get('segment')||'':''
  const params=kind==='library'?Object.fromEntries([...query].filter(([key])=>['profile','library','track','competitor','page'].includes(key))):{}
  const suffix=new URLSearchParams(kind==='library'?params:segment?{segment}:{})
  return {kind,id,card:kind==='library'&&id==='references'?card:'',params,segment,key:'#'+kind+(id?'/'+enc(id):'')+(kind==='library'&&id==='references'&&card?'/'+enc(card):'')+(suffix.size?'?'+suffix:'')}
}
function render({focus=false}={}) {
  const state=locationState(), changed=state.key!==route;route=state.key
  mapRequest?.abort()
  const filtersOpen=page.querySelector('.os-filter-disclosure')?.open||false
  libraryMount?.destroy();libraryMount=null
  if(location.hash!==state.key)history.replaceState(null,'',state.key)
  const active=state.kind==='segment'?'segments':state.kind==='competitor'?'competitors':state.kind==='research'?(state.segment?'segments':'product'):state.kind
  document.querySelectorAll('[data-page]').forEach(link=>{if(link.dataset.page===active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')})
  if(!snapshot){page.innerHTML=UI.loadingState({kind:'page',title:labels[active],label:'Загрузка данных…'});return}
  page.innerHTML=state.kind==='product'?productPage():state.kind==='materials'?materialPage():state.kind==='research'?researchPage(state.id,state.segment):state.kind==='jobs'?jobsPage():state.kind==='library'?libraryPage(state.id):Object.hasOwn(labels,state.kind)?entityCollection(state.kind):entityPage(active,state.id)
  if(state.kind==='jobs')loadMap()
  if(state.kind==='library')mountLibrary(state,filtersOpen)
  page.setAttribute('aria-busy','false')
  document.querySelector('#productName').textContent=snapshot.productName
  document.title='Product OS · '+snapshot.productName
  if(focus||changed){const heading=page.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true})}window.scrollTo(0,0)}
}
async function refresh() {
  if(pending)return pending
  pending=(async()=>{
    try {
      const response=await fetch('/api/snapshot');if(!response.ok)throw new Error('Snapshot unavailable')
      const next=await response.json(), nextSignature=JSON.stringify([next.productName,next.graph,next.galaxy,next.sources,next.reports])
      feedback.innerHTML=next.graphStatus?.state&&next.graphStatus.state!=='saved'?UI.notice({kind:'warning',message:[next.graphStatus.message,next.graphStatus.recovery].filter(Boolean).join(' ')}):''
      if(nextSignature!==signature){signature=nextSignature;snapshot=next;render()}
    }catch{
      if(!snapshot){page.innerHTML=UI.detailLayout({header:UI.pageHeader({title:'Продукт'}),content:UI.emptyState({kind:'unavailable',title:'Не удалось открыть продукт',description:'Проверьте, что локальный сервер работает.',actions:UI.button({label:'Повторить',attributes:{'data-retry':''}})})});page.setAttribute('aria-busy','false')}
      else feedback.innerHTML=UI.notice({kind:'warning',message:'Не удалось обновить данные. Показана последняя загруженная версия.',actions:UI.button({label:'Повторить',attributes:{'data-retry':''}})})
    }finally{pending=null}
  })()
  return pending
}
document.addEventListener('click',event=>{
  if(event.target.closest('[data-map-retry]'))loadMap()
  const view=event.target.closest('[data-map-view]');if(view){mapView=view.dataset.mapView;renderMap();document.querySelector(`[data-map-view="${mapView}"]`)?.focus()}
  if(event.target.closest('[data-retry]'))refresh()
  if(event.target.closest('.public-skip')){event.preventDefault();document.querySelector('#publicContent').focus()}
})
window.addEventListener('hashchange',()=>render({focus:true}))
render();refresh()
setInterval(()=>{if(!document.hidden)refresh()},4000)
