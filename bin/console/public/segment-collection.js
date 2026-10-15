import {customerEvidenceStatus,customerEvidenceContent} from './customer-evidence.js'
import {escapeHTML as e,textLink,sourceText,mountSourcePreviews,readingSection,readingLayout,readingSections,summaryCard,disclosure,topicNav} from './ui-components.js'
const name=s=>s.displayLabel||s.label,href=s=>'#segment/'+encodeURIComponent(s.id)
const basis={hypothesis:'Гипотеза',team:'Со слов команды',research:'По материалам исследования',unknown:'Пока неизвестно'}
const visible=s=>s.catalogRole!=='group'&&(!s.parameterView||s.customerProfile)
const refLink=ref=>/^https?:\/\//.test(ref)?ref:(/^(sources|reports|research|segments)\//.test(ref)||ref==='PRODUCT.md')?'/source?path='+encodeURIComponent(ref):null
export function profileFact(f,{empty='Пока не описано',label='Основание утверждения'}={}){
 if(!f)return `<p class="os-customer-unknown">${e(empty)}</p>`
 return `<p class="os-customer-fact">${sourceText({text:f.text,attributes:{'data-customer-fact':JSON.stringify(f)}})}</p>`
}
const factList=(facts,label)=>facts?.length?`<ul class="os-customer-facts">${facts.map(f=>`<li>${profileFact(f,{label})}</li>`).join('')}</ul>`:'<p class="os-customer-unknown">Пока не описано</p>'
export function segmentConditions(s){return s.customerProfile?.whySeparate?.text||s.description||s.definition||s.context||''}
function childRows(s,all){const children=all.filter(c=>c.parentId===s.id&&visible(c));return children.length?`<section class="os-customer-children"><h3>Подсегменты</h3><ul>${children.map(c=>`<li data-hierarchy-search="${e((name(c)+' '+segmentConditions(c)).toLocaleLowerCase())}"><div>${textLink({href:href(c),label:name(c)})}${customerEvidenceStatus(c)}</div>${c.customerProfile?profileFact(c.customerProfile.whySeparate,{label:'Почему выделен подсегмент: '+name(c)}):`<p>${e(segmentConditions(c))}</p>`}</li>`).join('')}</ul></section>`:''}
function card(s,all){
 const p=s.customerProfile,children=all.filter(c=>c.parentId===s.id&&visible(c)),search=[name(s),p?.summary?.text,...children.flatMap(c=>[name(c),segmentConditions(c)])].join(' ').toLocaleLowerCase()
 return summaryCard({title:name(s),href:href(s),level:2,className:'os-customer-card',attributes:{'data-search':search,'data-hierarchy-own-search':(name(s)+' '+(p?.summary?.text||'')).toLocaleLowerCase()},meta:customerEvidenceStatus(s),content:
  (p?profileFact(p.summary,{label:'Основание описания: '+name(s)}):`<p>${e(s.description||s.definition||'Профиль клиентов ещё не описан.')}</p>`)+
  (p?`<div class="os-customer-preview"><section><h3>Что хотят</h3>${profileFact(p.primaryJob)}</section><section><h3>Что для них важно</h3>${factList(p.successCriteria.slice(0,1),'Основание критерия')}</section><section><h3>Что ещё делают</h3>${factList(p.otherJobs.slice(0,1),'Основание дополнительной задачи')}</section></div>`:'<p class="os-customer-unknown">Задачи, путь в продукт и критерии нужно собрать в целостный профиль.</p>')+childRows(s,all)})
}
export function renderSegmentHierarchy(roots,all=roots){
 const items=all.filter(visible),groups=new Map()
 for(const s of all.filter(s=>s.catalogRole==='group')){const g=s.customerGroup||{id:s.id,label:name(s)};groups.set(g.id,{...g,legacyId:s.id,items:[]})}
 for(const s of items){if(items.some(p=>p.id===s.parentId))continue;const parent=all.find(p=>p.id===s.parentId),g=s.customerProfile?.group||parent?.customerGroup||{id:'other-customers',label:'Группы клиентов'};if(!groups.has(g.id))groups.set(g.id,{...g,items:[]});groups.get(g.id).items.push(s)}
 return [...groups.values()].map(g=>`<section class="os-customer-group" data-search-group><header><h2>${e(g.label)}</h2>${g.legacyId?textLink({href:'#segment/'+encodeURIComponent(g.legacyId)+'/people',label:'Исследование группы'}):''}</header>${g.items.sort((a,b)=>(a.catalogOrder??999)-(b.catalogOrder??999)).map(s=>card(s,all)).join('')||'<p class="os-customer-unknown">Сегменты этой группы ещё не описаны.</p>'}</section>`).join('')
}
export function renderCustomerProfile(s,all=[]){
 const p=s.customerProfile
 if(!p)return `<section class="os-customer-empty"><h2>Профиль клиентов ещё не собран</h2><p>Нужно описать их практику, задачи, выбор продукта и критерии успеха. Сохранённые материалы доступны во вкладке «Исследование».</p></section>`
 const block=(title,f)=>`<section><h2>${e(title)}</h2>${profileFact(f,{label:'Основание: '+title})}</section>`
 return `<div class="os-customer-profile"><div class="os-customer-intro">${customerEvidenceStatus(s)}${profileFact(p.summary)}${profileFact(p.context)}</div><div class="os-customer-sections">${block('Как узнать этих клиентов',p.recognition)}${block('Почему выделяем отдельно',p.whySeparate)}</div><section class="os-customer-value"><h2>Задачи и ценность продукта</h2><div class="os-customer-preview"><section><h3>Основная задача</h3>${profileFact(p.primaryJob)}</section><section><h3>Критерии успеха</h3>${factList(p.successCriteria,'Основание критерия')}</section><section><h3>Другие задачи в продукте</h3>${factList(p.otherJobs,'Основание задачи')}</section></div>${block('Как помогает продукт',p.productFit)}</section><section><h2>Как приходят и остаются</h2><ol class="os-customer-journey">${[['trigger','Повод искать'],['discovery','Где узнают'],['firstUse','Первая проба'],['purchase','Решение об оплате'],['retention','Почему возвращаются']].map(([key,title])=>`<li><h3>${title}</h3>${profileFact(p.journey[key],{label:'Основание: '+title})}</li>`).join('')}</ol></section><section><h2>Кто участвует в выборе</h2><div class="os-customer-preview">${[['user','Пользуется'],['decisionMaker','Выбирает'],['payer','Платит']].map(([key,title])=>`<section><h3>${title}</h3>${profileFact(p.roles[key],{label:'Основание роли: '+title})}</section>`).join('')}</div></section>${block('Чем решают задачи сейчас',p.alternatives)}${childRows(s,all)}${p.unknowns.length?`<section class="os-customer-gaps"><h2>Что ещё нужно выяснить</h2><ul>${p.unknowns.map(t=>`<li>${e(t)}</li>`).join('')}</ul></section>`:''}</div>`
}
// The default reading composition of the same retained profile. No summaries are
// inferred and unknown journey fields keep their exact text and provenance.
export function renderCustomerReading(s,all=[]){
 const p=s.customerProfile;if(!p)return renderCustomerProfile(s,all)
 const section=(id,title,content)=>readingSection({id:'customer-'+id,title,content})
 const sub=(title,content)=>`<section class="os-customer-reading-part"><h3>${e(title)}</h3>${content}</section>`
 const journey=[['trigger','Повод искать'],['discovery','Где узнают'],['firstUse','Первая проба'],['purchase','Решение об оплате'],['retention','Почему возвращаются']]
 const known=journey.filter(([key])=>p.journey[key]?.basis!=='unknown'),gaps=journey.filter(([key])=>p.journey[key]?.basis==='unknown')
 const roles=[['user','Пользуется'],['decisionMaker','Выбирает'],['payer','Платит']]
 const content=`<div class="os-customer-intro">${customerEvidenceStatus(s)}${profileFact(p.summary)}</div>`+
 section('clients','Клиенты',sub('Что известно из материалов',profileFact(p.context))+disclosure({title:'Как узнать клиентов и где проходит граница профиля',content:sub('Как узнать этих клиентов',profileFact(p.recognition))+sub('Почему выделяем отдельно',profileFact(p.whySeparate))}))+
 section('jobs','Задачи и ценность',sub('Основная задача',profileFact(p.primaryJob))+`<div class="os-customer-reading-value">${sub('Критерии успеха',factList(p.successCriteria,'Основание критерия'))}${sub('Другие задачи в продукте',factList(p.otherJobs,'Основание задачи'))}</div>`+sub('Как помогает продукт',profileFact(p.productFit)))+
 section('choice','Выбор и использование',sub('Путь в продукт',`<ol class="os-customer-reading-journey">${known.map(([key,title])=>`<li><h4>${e(title)}</h4>${profileFact(p.journey[key])}</li>`).join('')}</ol>`)+sub('Кто пользуется, выбирает и платит',`<div class="os-customer-reading-roles">${roles.map(([key,title])=>`<section><h4>${e(title)}</h4>${profileFact(p.roles[key])}</section>`).join('')}</div>`))+
 section('alternatives','Текущие решения',profileFact(p.alternatives))+
 childRows(s,all)+section('gaps','Что проверить',(gaps.length?sub('Пробелы в пути клиента',gaps.map(([key,title])=>sub(title,profileFact(p.journey[key]))).join('')):'')+(p.unknowns.length?`<ul class="os-customer-reading-questions">${p.unknowns.map(t=>`<li>${e(t)}</li>`).join('')}</ul>`:''))
 return readingLayout({className:'os-customer-reading',content,contentsTitle:'В профиле',contents:[['clients','Клиенты'],['jobs','Задачи и ценность'],['choice','Выбор и использование'],['alternatives','Текущие решения'],['gaps','Что проверить']].map(([id,label])=>({id:'customer-'+id,label}))})
}
export function mountCustomerProfiles(element){
 return mountSourcePreviews(element,{selector:'[data-customer-fact],[data-customer-evidence]',getSource:trigger=>{
  if(trigger.hasAttribute('data-customer-evidence'))return {title:'Основания профиля',content:customerEvidenceContent(JSON.parse(trigger.dataset.customerEvidence))}
  if(!trigger.hasAttribute('data-customer-fact'))return null
  const f=JSON.parse(trigger.dataset.customerFact)
  return {title:'Основание утверждения',content:`<p><strong>${e(basis[f.basis]||'Основание не уточнено')}</strong></p><p>${e(f.text)}</p>${f.sourceRefs?.length?`<ul>${f.sourceRefs.map(ref=>`<li>${refLink(ref)?textLink({href:refLink(ref),label:ref}):e('Запись: '+ref)}</li>`).join('')}</ul>`:'<p>Источник пока не связан. Это не подтверждённое свойство клиентов.</p>'}`}
 }})
}


// The segment keeps the same identity and destinations on every topic.
export const SEGMENT_TOPICS=Object.freeze([
 {id:'overview',label:'Профиль'},
 {id:'graph',label:'Граф работ'},
 {id:'competitors',label:'Альтернативы'},
 {id:'people',label:'Исследование'},
 {id:'channels',label:'История поиска'},
 {id:'checks',label:'План проверки'}
])
export function segmentTopicNav({segmentId,active='overview',hrefFor}={}){
 const destination=hrefFor||((topic)=>'#segment/'+encodeURIComponent(segmentId)+(topic==='overview'?'':'/'+topic))
 return topicNav({label:'Разделы сегмента',active,items:SEGMENT_TOPICS.map(topic=>({...topic,href:destination(topic.id)}))})
}
// In-page contents are useful when a document has several reading sections.
// Collections and the interactive graph keep their own controls instead.
export function segmentReading(sections,{contentsTitle='На странице',className=''}={}){
 return readingSections({sections,className,contentsTitle})
}
