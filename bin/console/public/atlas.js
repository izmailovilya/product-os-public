import {renderProductCapability} from './dossier-content.js';
import {mountElements} from './product-elements.js';
import {mountReferences} from './product-references.js';
import {renderSegmentChecks,renderSegmentContext} from './dossier-content.js';
import {readingList,captureReadingLists,restoreReadingLists} from './reading-list.js';
import {competitorPreview} from './competitor-preview.js';
import {channelsForSegment} from './channel-content.js';
import {mountResearchBrief,mountResearchBriefReading} from './research-brief.js';
import {segmentSupportSummary} from './segment-support.js';
import './ui-components.js';
import {renderSegmentHierarchy,segmentConditions,renderCustomerProfile,renderCustomerReading,mountCustomerProfiles} from './segment-collection.js';
import {mountSegmentDiscovery} from './segment-discovery.js';
import {SEGMENT_TOPICS,segmentTopicNav,segmentReading} from './segment-collection.js';
/* Optional, read-only console concept. No writes or second research store. */
(() => {
'use strict'
const mounted=!!document.querySelector('#atlasReadingPage');
const embedded=mounted;
const profileReadingPreview=new URLSearchParams(location.search).get('profile-reading')!=='0';
const reader=document.querySelector('#atlasReadingPage')||document.body;
const tell=data=>window.dispatchEvent(new CustomEvent('atlas:action',{detail:data}));
const $=s=>reader.querySelector(s), e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let briefMount, referencesMount, elementsMount;
let snapshot, registry, syntheses=[], turn=0, researchSummary, discoveryMount, profileMount;
const summary=()=>researchSummary ||= Promise.all([get('/api/research?type=Person&limit=1'),records({type:'SynthesisRevision'})]).then(([r,s])=>{registry=r;syntheses=s}).catch(error=>{researchSummary=null;throw error});
let receiveSnapshot;const initialSnapshot=mounted?(window.__productGalaxySnapshot?Promise.resolve(window.__productGalaxySnapshot):new Promise(resolve=>{receiveSnapshot=resolve})):get('/api/snapshot');
const labels={hypothesis:'Гипотеза',candidate:'Кандидатная принадлежность',validated:'Подтверждено',evidenced:'Есть основания',researched:'Исследовано',unknown:'Неизвестно',not_asked:'Не спрашивали',asked_unanswered:'Без ответа',not_applicable:'Не применимо',ambiguous:'Неоднозначно',conflicting:'Противоречие',completed:'Проведено',scheduled:'Запланировано',confirmed:'Подтверждено',active:'Активно',draft:'Черновик'};
const plain=v=>v===null||v===undefined?'':typeof v==='object'?'См. исходный ответ':String(v);
const proof=r=>(r.evidenceRefs||[]).length?link('source',r.evidenceRefs[0].sourceUnitId,'Исходный ответ →','source'):'';
const state=v=>labels[v]||'Требует проверки', name=r=>r.displayLabel||r.displayName||r.label||r.rawOutcome||'Без названия';
const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};
const href=(kind,id='',tab='')=>'#'+[kind,id,tab].filter(Boolean).map(encodeURIComponent).join('/');
const link=(kind,id,text,cls='button',tab='')=>`<a class="${cls}" href="${href(kind,id,tab)}">${e(text)}</a>`;
const empty=t=>window.OSUI.emptyState({kind:'first-use',title:t});
const missing=(title,route='map',label='К сегментам')=>window.OSUI.emptyState({kind:'unavailable',title,description:'Проверьте адрес или откройте список доступных записей.',actions:window.OSUI.textLink({href:'#'+route,label:'← '+label})});
const badge=(t,w=false)=>`<span class="badge ${w?'warn':''}">${e(t)}</span>`;
const head=(k,t,d,action='')=>window.OSUI.pageHeader({title:t,actions:action});
const crumbs=(kind,title)=>embedded?'':`<div class="crumb">${link(kind,'',kind==='map'?'Карта сегментов':kind==='hangar'?'Конкуренты':'Центр связи','')}<span> / ${e(title)}</span></div>`;

const validSource=path=>typeof path==='string'&&!path.includes('..')&&/^(sources|reports|research)\//.test(path);
function sourceTitle(row){
 const path=row.source, label=row.title||row.label;
 if(label&&label!==path&&label!==row.quote&&label!==row.statement)return label;
 const kinds={'analyze-interviews':'Разбор интервью','deep-research':'Исследование рынка','product-hq':'Обзор исследования','product-status':'Состояние продукта','product-context':'Новые сведения','meetings':'Запись встречи','competitors':'Материал о конкуренте','interviews':'Интервью'};
 const date=path.match(/\d{4}-\d{2}-\d{2}/)?.[0]?.split('-').reverse().join('.');
 const kind=kinds[path.split('/')[1]]||(path.startsWith('reports/')?'Отчёт исследования':'Материал исследования');
 return kind+(date?' · '+date:'');
}
function sourceGroups(rows){const groups=new Map();for(const raw of rows||[]){const row=typeof raw==='string'?{source:raw}:raw;if(!validSource(row?.source))continue;const key=row.source.split('#')[0];const group=groups.get(key)||{...row,quotes:[]};for(const quote of Array.isArray(row.quotes)?row.quotes:[row.quote||row.statement])if(quote&&!group.quotes.includes(quote))group.quotes.push(quote);if(row.title)group.title=row.title;if(row.author)group.author=row.author;groups.set(key,group)}return [...groups.values()]}
const sourceBody=rows=>sourceGroups(rows).map(row=>window.OSUI.sourceEntry({title:sourceTitle(row),author:row.author||'Автор в записи не указан',meta:row.source,quotes:row.quotes,context:row.quotes.length?'':'<p>Привязан документ целиком. Точный фрагмент не указан.</p>',href:'/source?path='+encodeURIComponent(row.source.split('#')[0]),details:`<details data-source-document="${e(row.source.split('#')[0])}"><summary>Читать исходный документ</summary><div data-source-content role="status">Загрузка источника…</div></details>`})).join('');
const sourced=(text,rows,{title='Источники и основания',notes='',attributes={}}={})=>sourceGroups(rows).length||notes?window.OSUI.sourceNote({text,title,content:notes+(sourceBody(rows)||'<p>Источник не связан.</p>'),attributes}):e(text);
const source=s=>{const row=typeof s==='string'?{source:s}:s;return validSource(row?.source)?sourced(sourceTitle(row),[row],{attributes:{'data-product-source':row.source}}):''};
const sources=rows=>sourceGroups(rows).map(row=>`<p>${source(row)}</p>`).join('');
async function get(url){const r=await fetch(url);if(!r.ok)throw Error('Не удалось загрузить данные. Обновите страницу.');return r.json()}
async function records(query){let all=[],offset=0,revision;do{const q=new URLSearchParams({...query,limit:'200',offset:String(offset),...(revision!==undefined?{expectedRevision:String(revision)}:{})});const page=await get('/api/research?'+q);revision=page.revision;all.push(...page.records);offset=page.nextOffset}while(offset!==null);return all}
const segments=()=>[...snapshot.galaxy.segments,...snapshot.galaxy.subSegments||[]], competitors=()=>snapshot.galaxy.competitors;
const compsFor=s=>competitors().filter(c=>c.segmentIds.includes(s.id));
const allChannels=()=>snapshot.communications.nodes.filter(n=>n.type==='channel');
const channelsFor=s=>channelsForSegment(s,allChannels(),snapshot.communications.edges);
function searchable(items,render){return window.OSUI.collectionLayout({content:`<div id="results" class="grid">${items.map(x=>`<div class="card os-object-card" data-search="${e(name(x).toLocaleLowerCase())}">${render(x)}</div>`).join('')}</div>${items.length?'':empty('Записи пока не добавлены.')}<div id="noResults" hidden>${window.OSUI.emptyState({kind:'no-results',title:'Совпадений нет',description:'Попробуйте другое название.'})}</div>`})}
const capabilityCard=(c,i)=>renderProductCapability(c,i,sourced);
// Child offering keeps its own pricing and capabilities; it is never merged into root plans.
function childProductSections(rootId){
 return (snapshot.communications.products||[]).filter(n=>n.parentId===rootId&&n.id!==rootId).map(child=>{
  const data=child.data||{};
  const caps=Object.values(data.capabilities||{}).filter(c=>c?.statement);
  const pricing=typeof data.pricing==='string'?data.pricing:data.pricing?.summary||'';
  const pricingConflict=['mixed','contradicted','conflicting'].includes(data.pricing?.evidenceStatus);
  const pricingEvidence=typeof data.pricing==='object'?data.pricing?.evidence:[];
  if(!caps.length&&!pricing)return '';
  return `<section class="product-capabilities product-child-offering" data-child-product="${e(child.id)}"><h2>Отдельное предложение · ${e(child.label)}</h2>
   ${pricing?`<div class="product-child-pricing"><h3>Цены и оплата предложения</h3><p>${sourced(pricing,pricingEvidence,{title:'Основания цены и условия оплаты',attributes:{'data-product-pricing-source':true}})}</p>${pricingConflict?window.OSUI.notice({kind:'warning',message:'В источниках цены есть расхождения. Сопоставьте условия перед решением.'}):''}</div>`:''}
   ${caps.length?`<h3>Возможности предложения</h3><div class="capability-list">${caps.map((c,i)=>capabilityCard(c,i)).join('')}</div>`:''}
   <p class="muted">Условия и возможности этого предложения учитываются отдельно от тарифов основного продукта.</p></section>`;
 }).join('');
}
function product(topic='overview'){
 if(!['overview','terms','goals','positioning','development','actions','references','elements','materials','brief'].includes(topic))return missing('Раздел продукта не найден','product','К обзору продукта');
 const p=snapshot.galaxy.product;if(!p)return empty('Описание продукта ещё не записано.');
 if(topic==='brief')return window.ProductTabs.header(p,'brief',{workspaceName:snapshot.productName})+window.ProductTabs.render('brief')+'<section data-research-brief-reading></section>';
 if(topic==='elements')return '<section data-product-elements aria-label="Элементы продукта"></section>';
 if(['references','materials'].includes(topic))return window.ProductTabs.header(p,topic,{workspaceName:snapshot.productName})+window.ProductTabs.render(topic,{library:new URLSearchParams(location.hash.split('?')[1]||'').get('library')||''})+`<section data-product-references data-reference-view="${topic}" aria-label="${topic==='materials'?'Материалы продукта':'Референсы продукта'}"></section>`;
 const productNode=snapshot.communications.nodes.find(n=>n.id===p.id),raw=productNode?.data||{},d=p.description||{};
 const pricing=typeof raw.pricing==='string'?raw.pricing:raw.pricing?.summary||raw.pricing?.text||'';
 const pricingConflict=['mixed','contradicted','conflicting'].includes(raw.pricing?.evidenceStatus||raw.pricingEvidenceStatus);
 const pricingEvidence=typeof raw.pricing==='object'?raw.pricing?.evidence:[];

 const capabilities=Object.values(raw.capabilities||{}).filter(c=>c?.statement);
 const sections=[
  {id:'product-description',title:'Что делает продукт',content:window.ProductTabs.description(p).replace(/<h2>Что делает продукт<\/h2>/,'')},
  {id:'product-audience',title:'Для кого',content:`<p>${sourced(d.forWhom||raw.market||'Пока не записано.',d.evidence||[])}</p>`},
  {id:'product-result',title:'Какой результат даёт',content:`<p>${sourced(d.outcome||'Пока не записано.',d.evidence||[])}</p>`},
  {id:'product-pricing',title:'Цены и оплата',content:`<p>${sourced(pricing||'Цены и условия оплаты пока не записаны.',pricingEvidence,{title:'Основания цены и условия оплаты',attributes:{'data-product-pricing-source':true}})}</p>${pricingConflict?window.OSUI.notice({kind:'warning',message:'В источниках цены есть расхождения. Сопоставьте условия перед решением.'}):''}`},
  {id:'product-capabilities',title:'Возможности продукта',content:`<div class="capability-list">${capabilities.map((c,i)=>capabilityCard(c,i)).join('')||empty('Возможности ещё не записаны.')}</div>`},
  ...(childProductSections(p.id)?[{id:'product-offerings',title:'Отдельные предложения',content:childProductSections(p.id)}]:[]),
  {id:'product-jobs',title:'Какие работы помогает выполнить',content:p.jobs?.length?window.ProductTabs.jobs(p.jobs):empty('Связанные работы ещё не указаны.')},
 ]
 const overview=window.OSUI.detailLayout({header:window.ProductTabs.header(p,topic,{workspaceName:snapshot.productName}),nav:window.ProductTabs.render(topic==='terms'?'overview':topic),content:window.OSUI.readingSections({sections,contentsTitle:'В обзоре продукта',className:'product-reading'})})
 return overview;
}

function segmentCollection(){
 const all=segments(),roots=all.filter(s=>!s.parentId)
 return window.OSUI.collectionLayout({content:`<div id="results">${renderSegmentHierarchy(roots,all)}</div>${roots.length?'':empty('Сегменты пока не добавлены.')}<div id="noResults" hidden>${window.OSUI.emptyState({kind:'no-results',title:'Совпадений нет',description:'Попробуйте другое название сегмента или подсегмента.'})}</div>`})
}
function map(){return `<div class="customer-catalog">`+head('','Сегменты','Клиенты, их задачи и путь к покупке.')+segmentCollection()+`<p class="muted">Описания включают гипотезы и открытые вопросы. Основание каждого утверждения доступно рядом с ним.</p><p>${window.OSUI.textLink({href:'#people',label:'Все материалы исследования →'})} · ${window.OSUI.textLink({href:'#product/brief',label:'Бриф исследования'})}</p></div>`}

async function loadSegmentPeople(s){
 if(s.cohortView){const data=await get('/api/segment-analysis?'+new URLSearchParams({segmentId:s.id}));s.participants=[...new Map(data.selected.cases.flatMap(c=>c.people).map(p=>[p.id,{id:p.id,displayName:p.label,membershipStatus:'candidate'}])).values()];return}
 const ids=new Set([s.id,s.researchSegmentId,...s.archivedResearchSegmentIds||[],...segments().filter(c=>c.parentId===s.id).flatMap(c=>[c.id,c.researchSegmentId])].filter(Boolean))
 const members=(await records({type:'MembershipAssertion'})).filter(m=>ids.has(m.segmentId)&&['candidate','supported'].includes(m.status))
 const byId=new Map(members.map(m=>[m.personId,m]))
 s.participants=(await records({type:'Person'})).filter(p=>byId.has(p.id)).map(p=>({...p,membershipStatus:byId.get(p.id).status}))
}
function peopleRows(people){const candidates=people.length>0&&people.every(p=>p.membershipStatus==='candidate');return people.length?`${candidates?'<p>Связь этих респондентов с сегментом пока предварительная.</p>':''}`+readingList(people.map(p=>({text:name(p),html:window.OSUI.summaryCard({title:name(p),meta:p.membershipStatus&&!candidates?`<p>${e(state(p.membershipStatus))}</p>`:'',actions:window.OSUI.button({href:href('person',p.id),label:'Открыть досье →'})})})),{label:'Поиск по имени или номеру материала',className:'rows',pageSize:10}):empty('Участники ещё не связаны с этим сегментом. Они доступны в общем реестре.')}


function competitorCard(c){const preview=competitorPreview(c);return window.OSUI.summaryCard({title:name(c),href:href('competitor',c.id),level:2,meta:preview.category?`<p>${e(preview.category)}</p>`:'',content:(preview.summary?`<p>${preview.summaryLabel?'Обещание сервиса: ':''}${e(preview.summary)}</p>`:'')+window.OSUI.proseFacts({items:preview.facts.map(f=>({label:f.label,value:e(f.text)+(f.context?`<p>${e(f.context)}</p>`:'')}))})})}
function groupedAlternatives(items){
 const populated=[],unfilled=[];for(const c of items){const p=competitorPreview(c);(p.summary||p.facts.length?populated:unfilled).push(c)}
 const row=c=>`<article class="row"><div><h3>${e(name(c))}</h3></div>${window.OSUI.textLink({href:href('competitor',c.id),label:'Открыть конкурента →'})}</article>`;
 return readingList(populated.map(c=>({text:name(c),html:competitorCard(c)})),{label:'Поиск конкурентов сегмента',className:'grid'})+(unfilled.length?`<details><summary>Без описания и фактов · ${unfilled.length}</summary><p>Сохранена связь с сегментом. Причины выбора и свойства решения ещё не описаны.</p>${readingList(unfilled.map(c=>({text:name(c),html:row(c)})),{label:'Найти запись без описания'})}</details>`:'')
}
function channelRows(channels){return channels.length?`<div class="rows">${channels.map(c=>window.OSUI.summaryCard({title:c.label,meta:c.status&&c.status!=='hypothesis'?badge(state(c.status),true):'',content:c.data?.tactic?`<p>${e(c.data.tactic)}</p>`:'',actions:window.OSUI.button({href:href('channel',c.id),label:'Подробнее →'})})).join('')}</div>`:empty('Связанные каналы пока не записаны. Это пробел исследования, а не доказательство отсутствия каналов.')}
let jobGraphMode='motives';
function segmentGraph(s){return window.JobFlow.segmentMarkup(s.id,undefined,{topicNavigation:true})}

function segment(id,tab='overview') {
 const s=segments().find(x=>x.id===id);if(!s)return missing('Сегмент не найден');
 const ps=s.participants||[],cs=compsFor(s),chs=channelsFor(s);
 if(!SEGMENT_TOPICS.some(topic=>topic.id===tab))return missing('Раздел сегмента не найден','segment/'+encodeURIComponent(id),'К обзору сегмента');
 let content='';
 if(tab==='graph')content=`<p class="section-intro">Граф показывает задачи клиентов и связи между ними. Это задачи клиентов, а не список действий исследователя; связи берутся из сохранённых данных.</p>`+segmentGraph(s);
 else if(tab==='checks')content=renderSegmentChecks(s,{reading:true});
 else if(tab==='people')content=segmentReading([
  {id:'segment-research-basis',title:'На чём основан профиль',intro:'Здесь собраны материалы о клиентах этого сегмента и основания выводов о них. Наличие материала, подтверждение по интервью и актуальность выводов — разные вещи.',content:segmentSupportSummary(s,{explain:true})},
  {id:'segment-research-materials',title:'Материалы о клиентах',intro:'Откройте досье, чтобы прочитать ответы и увидеть их источники. Несколько материалов могут относиться к одному человеку.',content:peopleRows(ps)+window.OSUI.textLink({label:'Все материалы исследования',href:'#people'})+window.OSUI.disclosure({title:'Источники, связанные с сегментом',content:sources(s.sources)})}
 ],{contentsTitle:'В исследовании'});

 else if(tab==='competitors')content=`<p class="section-intro">Способы решения, связанные с этим сегментом. В карточке альтернативы — причины выбора и основания.</p>`+(cs.length?groupedAlternatives(cs):empty('Альтернативы пока не связаны с сегментом.'));
 else if(tab==='channels')content=segmentReading([
  {id:'segment-search-history',title:'Поиск решений в интервью',intro:'Где клиенты узнавали о решениях и что пробовали.',content:`<div data-segment-discovery="${e(id)}" aria-label="История каналов из интервью"></div>`},
  {id:'segment-search-planned',title:'Каналы, запланированные для продукта',intro:'Запланированные каналы продвижения продукта показаны отдельно от истории поиска в интервью.',content:channelRows(chs)+(embedded?window.OSUI.button({label:'Работать с каналами в разделе «Коммуникации» →',attributes:{'data-segment-comms':id}}):'')}
 ],{contentsTitle:'В истории поиска'});
 if(tab==='overview')content=profileReadingPreview?renderCustomerReading(s,segments()):renderCustomerProfile(s,segments());
 if(s.catalogRole==='group'&&tab==='overview')return head('',name(s),'Группа клиентов')+renderSegmentHierarchy([],segments().filter(c=>c.customerProfile?.group?.id===s.customerGroup?.id))+`<p>${window.OSUI.textLink({href:href('segment',id,'people'),label:'Материалы группы →'})}</p>`+window.OSUI.textLink({href:'#map',label:'← Все сегменты'});
 const back={href:s.parentId?href('segment',s.parentId):'#map',label:s.parentId?'← '+name(segments().find(p=>p.id===s.parentId)):'← Все сегменты'};
 return `<div class="segment-page">${window.OSUI.pageHeader({title:name(s),description:'',context:'',className:'os-segment-heading',back:window.OSUI.button(back),backTight:true,actions:''})}${segmentTopicNav({segmentId:id,active:tab})}<section class="segment-content" aria-label="${e(SEGMENT_TOPICS.find(topic=>topic.id===tab).label)}">${content}</section></div>`
}
function hangar(){
 const raw=snapshot.communications.nodes.find(n=>n.id===snapshot.galaxy.product?.id)?.data||{};
 const review=raw.competitorReview;
 // Saved review scope only; without it the page does not invent boundaries.
 const scope=review&&typeof review==='object'&&(review.scope||review.limitations)?`<aside class="notes" data-competitor-review><h3>Границы обзора</h3>${review.scope?`<p>${e(review.scope)}</p>`:''}${review.limitations?`<p class="muted">${e(review.limitations)}</p>`:''}${review.asOf?`<p class="muted">Границы проверены на ${e(review.asOf)}.</p>`:''}${source(review.latestScopeSource?{source:review.latestScopeSource}:null)}</aside>`:'';
 return head('02 / Конкуренты','Конкуренты и альтернативы','Какие продукты, поставщики и способы решения встречаются в исследовании.')+scope+searchable(competitors(),competitorCard)}
function segmentJob(id,segmentId){const job=snapshot.communications.nodes.find(n=>n.id===id),seg=segments().find(s=>s.id===segmentId),j=seg?.jobs.find(j=>j.id===id)||job;if(!j)return missing('Работа не найдена',seg?'segment/'+encodeURIComponent(seg.id)+'/graph':'map',seg?'К графу сегмента':'К сегментам');const criteria=j.criteria||snapshot.communications.edges.filter(r=>r.from===id&&r.type==='judged_by').map(r=>snapshot.communications.nodes.find(n=>n.id===r.to)).filter(Boolean);return head('Работа сегмента',j.label,'')+`<section class="section"><h2>Контекст</h2><p>${sourced(j.context||job?.data?.context||'Контекст ещё не описан.',j.evidence?.length?j.evidence:[job?.source].filter(Boolean))}</p></section><section class="section"><h2>Критерии успеха</h2>${criteria.length?`<ul>${criteria.map(c=>`<li>${sourced(c.label,c.evidence?.length?c.evidence:[c.source].filter(Boolean))}${c.level?`<p>${e(c.level)}</p>`:''}</li>`).join('')}</ul>`:'<p>Критерии ещё не записаны.</p>'}</section>`}
function competitor(id){const c=competitors().find(c=>c.id===id);if(!c)return missing('Конкурент не найден','hangar','К конкурентам');return crumbs('hangar',name(c))+head('Альтернатива',name(c),c.landingBigJob||'Описание ещё не заполнено.',embedded?`<button class="button" data-full-competitor="${e(id)}">Полное досье и действия</button>`:'')+`<div class="split"><div><section class="section"><h2>В каких сегментах встречается</h2><div class="rows">${segments().filter(s=>c.segmentIds.includes(s.id)).map(s=>`<div class="row"><div><h3>${e(name(s))}</h3><p>${e(c.hiredFacts?.find(f=>f.segmentId===s.id)?.whyHired||'Причина выбора пока не описана.')}</p></div>${link('segment',s.id,'В сегмент →')}</div>`).join('')||empty('Связей с сегментами пока нет.')}</div></section><section><h2>Условия из исследования</h2><p>${e(typeof c.pricing==='string'&&c.pricing||'Условия пока не описаны.')}</p><p class="muted">Это сохранённые сведения, а не проверка сегодняшних цен.</p></section></div><aside class="notes"><h3>Основания и пробелы</h3>${source(c.source)}<p>${e(c.researchGaps?.filter(x=>typeof x==='string').join(' · ')||'Полноту сведений нужно оценивать по источникам.')}</p></aside></div>`}
function comms(){return head('03 / Центр связи','Коммуникации и каналы','Где встретить людей из сегмента и что им объяснить. Связи показываем только там, где они записаны.')+`<div class="section notes"><h3>От сегмента — к коммуникации</h3><p>Откройте канал, чтобы увидеть связанные сегменты и сохранённую идею сообщения. Гипотеза канала не означает, что через него уже приходили клиенты.</p></div>`+channelRows(allChannels())}
function channel(id){const c=allChannels().find(c=>c.id===id);if(!c)return empty('Канал не найден.');const ss=segments().filter(s=>channelsFor(s).some(x=>x.id===id));return crumbs('comms',c.label)+head('Канал коммуникации',c.label,'Сохранённые сведения и гипотезы из исследования.')+`<div class="split"><div><section class="section"><h2>Как использовать</h2><p>${e(c.data?.tactic||'Тактика ещё не описана.')}</p></section><section><h2>Что объяснить аудитории</h2><p>${e(c.data?.hook||c.data?.description||'Сообщение ещё не сформулировано.')}</p></section></div><aside class="notes"><h3>Для каких сегментов</h3>${ss.map(s=>link('segment',s.id,name(s),'source')).join('<br>')||'<p>Связи ещё не записаны.</p>'}${source(c.source)}</aside></div>`}
async function person(id){const rs=await records({personId:id}),p=rs.find(r=>r.id===id&&r.type==='Person');if(!p)return missing('Респондент не найден','people','К респондентам');const jobs=rs.filter(r=>r.type==='JobInstance'),orgs=rs.filter(r=>r.type==='Organization'),sessions=rs.filter(r=>r.type==='Session');return crumbs('map','Участник исследования')+head('Индивидуальное досье',name(p),orgs.map(name).join(' · ')||'Компания не указана.')+`<div class="split"><div><section class="section"><h2>Работы участника</h2>${jobs.map(j=>`<article class="rows"><div class="row"><div><h3>${e(j.rawOutcome)}</h3><details><summary>Критерии и исходные ответы</summary>${rs.filter(r=>r.type==='CriterionObservation'&&r.jobInstanceId===j.id).map(c=>`<p>${e(c.raw||c.rawText||c.rawWording||c.label||'Формулировка не указана')}</p>${proof(c)}`).join('')||'<p>Критерии пока не записаны.</p>'}${rs.filter(r=>r.type==='Assertion'&&r.subject?.id===j.id).map(a=>`<blockquote>${e(plain(a.raw??a.rawText??a.rawWording??a.value??state(a.state)))}</blockquote>${proof(a)}`).join('')}</details></div></div></article>`).join('')||empty('Работы ещё не извлечены.')}</section><section><h2>Принадлежность к сегментам</h2>${segments().filter(s=>s.participants?.some(x=>x.id===id)).map(s=>link('segment',s.id,name(s),'source')).join('<br>')||empty('Пока не распределён по сегментам.')}</section></div><aside><section class="notes section"><h3>Встречи</h3>${sessions.map(s=>`<p>${e(state(s.status))}<br><small>Дата: ${e(s.time?.date||'не указана')}</small></p>`).join('')||'<p>Встречи ещё не записаны.</p>'}</section><h3>Оригиналы</h3>${sources(rs.flatMap(r=>r.evidenceRefs||[]).map(r=>rs.find(x=>x.id===r.sourceUnitId)).filter(Boolean))}<p class="muted">Это краткий просмотр досье в концепте. Полная проверка источников и история исправлений остаются в прежней версии.</p><a href="/" class="button">Полная консоль →</a></aside></div>`}
function references(){return head('Визуальное направление','Спокойный рабочий атлас','Метафоры остаются в структуре навигации. Содержание читается как рабочий документ.')+`<div class="reference"><h2>Steep — пространство для чтения</h2><p>Светлая поверхность, свободные интервалы и заметная иерархия текста.</p><a href="https://styles.refero.design/style/75fdb89f-ca64-41b3-af36-7a78bd09448e" target="_blank" rel="noopener">Референс на Refero ↗</a></div><div class="reference"><h2>Linear — сдержанная геометрия</h2><p>Чёткие границы разделов, минимум декора и последовательные компоненты.</p><a href="https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1" target="_blank" rel="noopener">Референс на Refero ↗</a></div><div class="reference"><h2>Mercury — редкий цветовой акцент</h2><p>Цвет помогает найти действие. Типографика задаёт основную иерархию.</p><a href="https://styles.refero.design/style/3172cd4d-118a-4a16-a259-6b634d32322e" target="_blank" rel="noopener">Референс на Refero ↗</a></div>`}
async function exactSource(id){const d=await get('/api/research/source?id='+encodeURIComponent(id));return head('Основания','Исходный ответ','Фрагмент источника с соседними строками. Нумерация соответствует оригиналу.')+`<div class="rows">${d.context.map(x=>`<div class="row"><small>${x.line}</small><p>${e(x.text)}</p></div>`).join('')}</div>`+source(d.document?.path)}
function disposeDiscovery(){briefMount?.destroy();briefMount=null;discoveryMount?.destroy();discoveryMount=null;profileMount?.destroy();profileMount=null}
async function render(saved){
 referencesMount?.destroy();referencesMount=null;elementsMount?.destroy();elementsMount=null;
 if(saved?.graphMode)jobGraphMode=saved.graphMode;
 const seq=++turn;
 disposeDiscovery();
 try{
  const [kind='map',id='',tab='overview']=(window.AtlasRouteState.read().route.split('?')[0]||'product').split('/').map(decode);
  const group=['segment','person','people'].includes(kind)?'map':kind==='competitor'?'hangar':kind==='channel'?'comms':kind;
  document.querySelectorAll('[data-nav]').forEach(a=>a.setAttribute('aria-current',a.dataset.nav===group?'page':'false'));
  if(!snapshot)return;

  if(kind==='segment'&&tab==='people'){const selected=segments().find(s=>s.id===id);if(selected)await loadSegmentPeople(selected);}
  const html=kind==='research-brief'?'<div data-research-brief></div>':kind==='job'?segmentJob(id,new URLSearchParams(location.hash.split('?')[1]||'').get('segment')):kind==='product'?product(id||'overview'):kind==='segment'?segment(id,tab):kind==='hangar'?hangar():kind==='competitor'?competitor(id):kind==='comms'?comms():kind==='channel'?channel(id):kind==='person'?await person(id):kind==='source'?await exactSource(id):kind==='people'?head('Реестр','Все респонденты','Включая людей, пока не связанных с сегментами.')+peopleRows(await records({type:'Person'})):kind==='references'?references():map();
  if(seq!==turn)return;
  $('#main').innerHTML=window.OSUI.detailLayout({content:html});
  profileMount=mountCustomerProfiles(reader);
  const referencesElement=$('[data-product-references]');
  if(referencesElement){const q=new URLSearchParams(location.hash.split('?')[1]||'');referencesMount=mountReferences(referencesElement,{productId:snapshot.galaxy.product.id,view:referencesElement.dataset.referenceView,state:{filtersOpen:Boolean(saved?.filtersOpen),library:q.get('library')||'',track:q.get('track')||'',competitor:q.get('competitor')||'',page:Number(q.get('page'))||1,card:decode(window.AtlasRouteState.read().route.split('?')[0].split('/')[2]||'')},navigate:route=>embedded?tell({action:'navigate',route}):location.hash=route});await referencesMount.ready;if(seq!==turn)return;}
  const elementsElement=$('[data-product-elements]');
  if(elementsElement){const q=new URLSearchParams(location.hash.split('?')[1]||'');elementsMount=mountElements(elementsElement,{product:snapshot.galaxy.product,workspaceName:snapshot.productName,nav:window.ProductTabs.render('elements'),productId:snapshot.galaxy.product.id,state:{filtersOpen:Boolean(saved?.filtersOpen),category:q.get('category')||'',status:q.get('status')||'',role:q.get('role')||'',page:Number(q.get('page'))||1,element:decode(window.AtlasRouteState.read().route.split('?')[0].split('/')[2]||''),step:q.get('step')||''},navigate:route=>embedded?tell({action:'navigate',route}):location.hash=route});await elementsMount.ready;if(seq!==turn)return;}
  const briefReading=$('[data-research-brief-reading]');
  if(briefReading){const mounted=await mountResearchBriefReading(briefReading,{id:tab==='overview'?'':tab,product:snapshot.galaxy.product});if(seq!==turn){mounted.destroy();return}briefMount=mounted;}
  const briefElement=$('[data-research-brief]');
  if(briefElement){const mounted=await mountResearchBrief(briefElement,{id,snapshot});if(seq!==turn){mounted.destroy();return}briefMount=mounted;}
  const discoveryElement=$('[data-segment-discovery]');
  if(discoveryElement){
   const selectedSegment=segments().find(segment=>segment.id===discoveryElement.dataset.segmentDiscovery);
   if(selectedSegment)discoveryMount=mountSegmentDiscovery(discoveryElement,selectedSegment,{workspace:snapshot.workspace,retain:Boolean(saved),openEvents:saved?.discoveryDetails||[],onReady(){if(seq===turn&&saved)reader.scrollTop=saved.scroll||0}});
  }
  if(embedded)tell({action:'presentation',view:kind==='product'?'product':'map',route:location.hash.slice(1)});
  reader.scrollTop=0;
  if(kind==='product'&&id==='terms')document.getElementById('product-pricing')?.scrollIntoView();
  if(!mounted)$('#main').focus({preventScroll:true});
 }catch(err){if(seq===turn){disposeDiscovery();$('#main').innerHTML=window.OSUI.notice({kind:'error',message:err.message})}}
}
window.AtlasContent={
 render,ready:false,
 async update(value){const changed=JSON.stringify([snapshot?.productName,snapshot?.galaxy,snapshot?.communications,snapshot?.researchRevision])!==JSON.stringify([value?.productName,value?.galaxy,value?.communications,value?.researchRevision]);snapshot=value;if(window.AtlasRouteState.read().kind==='research-brief'&&briefMount)return;if(receiveSnapshot){receiveSnapshot(value);receiveSnapshot=null;return}if(!changed)return;researchSummary=null;if(!reader.hidden){const saved=this.capture();await render(saved);this.restore(saved)}},
 capture:()=>({filtersOpen:Boolean(reader.querySelector('.os-filter-disclosure')?.open),readingLists:captureReadingLists(reader),scroll:reader.scrollTop,graphMode:jobGraphMode,discoveryDetails:[...reader.querySelectorAll('[data-discovery-event]')].filter(el=>el.querySelector('details')?.open).map(el=>el.dataset.discoveryEvent),details:[...reader.querySelectorAll('details')].flatMap((el,index)=>el.matches('.os-filter-disclosure')?[]:[{index,open:el.open}])}),
 restore(value){restoreReadingLists(reader,value?.readingLists);if(value?.graphMode)jobGraphMode=value.graphMode;for(const item of value?.details||[]){const el=reader.querySelectorAll('details')[item.index];if(el&&!el.matches('.os-filter-disclosure'))el.open=item.open}const filters=reader.querySelector('.os-filter-disclosure');if(filters)filters.open=Boolean(value?.filtersOpen);reader.scrollTop=value?.scroll||0},
 unmount(){turn++;referencesMount?.destroy();referencesMount=null;elementsMount?.destroy();elementsMount=null;disposeDiscovery();reader.hidden=true;$('#main').replaceChildren();document.querySelector('.product-source-dialog[open]')?.close()}
};
document.addEventListener('toggle',async event=>{
 const details=event.target;if(!details.matches?.('[data-source-document]')||!details.open||details.dataset.loaded)return
 details.dataset.loaded='true';const body=details.querySelector('[data-source-content]')
 try{const response=await fetch('/source?path='+encodeURIComponent(details.dataset.sourceDocument));if(!response.ok)throw Error('Источник не удалось загрузить. Закройте и откройте текст для повторной попытки.');let text=await response.text();if(response.headers.get('content-type')?.includes('text/html')){const doc=new DOMParser().parseFromString(text,'text/html');doc.querySelector('.back')?.remove();text=doc.querySelector('main')?.textContent||doc.body.textContent}if(body.isConnected)body.innerHTML=`<pre>${e(text)}</pre>`}catch(error){delete details.dataset.loaded;if(body.isConnected)body.textContent=error.message}
},true);
reader.addEventListener('click',async event=>{
 const productTab=event.target.closest('[data-product-tab]');if(productTab){const route=productTab.dataset.productRoute||'product/'+productTab.dataset.productTab;if(embedded)tell({action:'navigate',route});else location.hash=route;return}
 if(event.target.closest('[data-manage-products]')){tell({action:'manage-products'});return}
 const mode=event.target.closest('[data-graph-mode]');if(mode){jobGraphMode=mode.dataset.graphMode;render();return}
 if(!embedded)return;
 const comms=event.target.closest('[data-segment-comms]');if(comms){tell({action:'navigate',route:'communications?segment='+encodeURIComponent(comms.dataset.segmentComms)});return}
 const jobButton=event.target.closest('[data-full-job]');
 if(jobButton&&embedded){tell({action:'navigate',route:'job/'+encodeURIComponent(jobButton.dataset.fullJob)+'?segment='+encodeURIComponent(decodeURIComponent(location.hash.split('/')[1]||''))});return}
 if(jobButton){
  const id=jobButton.dataset.fullJob,job=snapshot.communications.nodes.find(n=>n.id===id),segmentId=decodeURIComponent(location.hash.split('/')[1]||''),seg=segments().find(s=>s.id===segmentId),j=seg?.jobs.find(j=>j.id===id)||job;
  if(!j)return;const d=document.createElement('dialog');d.className='atlas-job-detail os-dialog';d.setAttribute('aria-label','Детали работы сегмента');
  const criteria=j.criteria||snapshot.communications.edges.filter(r=>r.from===id&&r.type==='judged_by').map(r=>snapshot.communications.nodes.find(n=>n.id===r.to)).filter(Boolean);
  d.innerHTML=`<button class="button" data-close-job>Закрыть</button><h2>${e(j.label)}</h2><h3>Контекст</h3><p>${sourced(j.context||job?.data?.context||'Контекст ещё не описан.',j.evidence?.length?j.evidence:[job?.source].filter(Boolean))}</p><h3>Критерии успеха</h3>${criteria.length?`<ul>${criteria.map(c=>`<li>${sourced(c.label,c.evidence?.length?c.evidence:[c.source].filter(Boolean))}${c.level?`<p>${e(c.level)}</p>`:''}</li>`).join('')}</ul>`:'<p>Критерии ещё не записаны.</p>'}`;
  document.body.append(d);const controller=window.OSUI.dialog(d);d.querySelector('[data-close-job]').onclick=()=>controller.close();d.addEventListener('close',()=>d.remove());controller.open(jobButton);return;
 }
 const full=event.target.closest('[data-full-product],[data-full-segment],[data-full-competitor]');
 if(full){tell({action:'full',kind:full.dataset.fullProduct?'product':full.dataset.fullJob?'job':full.dataset.fullSegment?'segment':'competitor',id:full.dataset.fullProduct||full.dataset.fullJob||full.dataset.fullSegment||full.dataset.fullCompetitor});return}
 const a=event.target.closest('a[href^="#"]');if(!a)return;
 const [kind,id,tab]=(a.getAttribute('href').slice(1)).split('/').map(decode);
 if(kind==='person'){event.preventDefault();tell({action:'person',id})}
 else if(kind==='people'){event.preventDefault();tell({action:'people'})}
 else if(kind==='comms'){event.preventDefault();tell({action:'communications',segmentId:kind==='segment'?id:undefined})}
});
if(!mounted)window.addEventListener('hashchange',render);
window.addEventListener('product-galaxy:ready',event=>window.AtlasContent.update(event.detail.snapshot));
(async()=>{try{snapshot=await initialSnapshot;const workspace=$('#workspace');if(workspace)workspace.textContent=snapshot.productName;if(!mounted)await render();window.AtlasContent.ready=true;window.dispatchEvent(new CustomEvent('atlas:ready'))}catch(err){$('#main').innerHTML=`<p class="error" role="alert">${e(err.message)}</p>`}})();
})();
