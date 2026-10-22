import {applicableBriefResult} from './research-brief-state.js';
import {escapeHTML as e,button,field,pageHeader,editorLayout,notice,emptyState,textLink,loadingState,sourceList,sourceNote,sourceReferenceHref,setFieldError,summaryCard,readingSections,proseFacts,disclosure} from './ui-components.js';
const stateLabel={pending:'В плане',running:'Выполняется',completed:'Исследовано',failed:'Ошибка',paused:'Приостановлено',unknown:'Проверьте статус запуска'};
const evidenceReason=reason=>({'missing-primary-source':'Первичный источник не указан корректно.','missing-or-duplicate-independent-check':'Нет однозначной независимой проверки.','check-does-not-match-claim-source-context':'Проверка относится к другой версии утверждения или источника.','quote-not-found-in-opened-source':'Цитата не найдена в открытом источнике.','quote-not-on-page':'Цитата отсутствует в сохранённой копии страницы.','scope-not-established':'Источник не подтверждает утверждение для этой аудитории и условий.','source-check-outside-snapshot':'Дата проверки выходит за период исследования.','temporal-scope-not-established':'Актуальность данных не установлена.','claim-not-supported-by-quote':'Цитата не подтверждает этот вывод.'})[reason]||'Основание не прошло проверку.';
const frameField=(b,key,label,type='text')=>field({label,value:b.frame[key]||'',type,attributes:{'data-brief-frame':key}});
function lastItem(b,id){return b.runs.flatMap(r=>r.items.map(i=>({...i,run:r}))).filter(i=>i.id===id).at(-1)}
export function resultView(item,{items=[]}={}){
 const r=item.result;
 const title=item.question||item.expectedOutcome||'Вопрос исследования';
 const status=({completed:'Ответ сохранён',failed:'Не завершено',paused:'Приостановлено',pending:'Не запускалось',running:'Выполняется',unknown:'Статус требует проверки'})[item.status]||'Статус требует проверки';
 const heading=`<h4>${e(title)}</h4><p>${e(status)}</p>`;
 if(!r){const dependencies=(item.dependsOn||[]).map(id=>items.find(i=>i.id===id)?.question||'Предыдущий вопрос');return `<article class="brief-result">${heading}<p>${dependencies.length?'Ожидает результатов: '+e(dependencies.join('; ')):'Сохранённого ответа пока нет.'}</p></article>`}
 const sourcesFor=f=>(f.sources||[]).flatMap(s=>{
  const observations=(r.evidenceLedger?.claims||[]).filter(c=>(f.claimIds||[]).includes(c.id)).flatMap(c=>c.observations||[]).filter(o=>o.sourceId===s.id);
  const href=sourceReferenceHref(s.source),base={title:s.title||s.source,href,meta:s.publishedAt||'Дата публикации неизвестна',context:href?'':'<p>Файл не сопоставлен с доступным материалом. Исходная ссылка сохранена в записи исследования.</p>'};
  return observations.length?observations.map(o=>({...base,quote:o.quote,relation:o.usable?(o.relation==='refutes'?'Проверенный фрагмент с опровержением':'Проверенный фрагмент'):'Фрагмент не прошёл проверку',context:base.context+(o.reason?`<p>${e(evidenceReason(o.reason))}</p>`:'')})): [base];
 });
 const claims=r.evidenceLedger?.claims||[],count=status=>claims.filter(c=>c.status===status).length;
 const checked=claims.length?`<p>${item.readingReviews?.length||item.readingReviewIssues?.length?'Исходная автоматическая проверка':'Результат проверки оснований'}: подтверждено — ${count('supported')}; опровергнуто — ${count('refuted')}; противоречивые данные — ${count('mixed')}; недостаточно данных — ${claims.filter(c=>!['supported','refuted','mixed'].includes(c.status)).length}.</p>`:'';
 const findingView=f=>{
  const original=`<h4>${e(({supported:'Есть основания',refuted:'Есть опровержение',mixed:'Противоречивые основания'})[f.supportStatus]||'Не подтверждено')}</h4><p>${sourceNote({text:f.statement,title:'Основания вывода',content:sourceList({entries:sourcesFor(f)})})}</p>`;
  const reviews=(item.readingReviews||[]).filter(review=>(f.claimIds||[]).includes(review.claimId));
  if(!reviews.length)return `<article>${original}</article>`;
  return `<article><h4>Уточнено после проверки</h4>${reviews.map(review=>`<p>${sourceNote({text:review.text,title:'Основания уточнения',content:sourceList({entries:[{title:'Сохранённый разбор',href:sourceReferenceHref(review.source)},...(review.sourceRefs||[]).map(ref=>({title:ref.source,href:sourceReferenceHref(ref.source),context:ref.available&&sourceReferenceHref(ref.source)?'':'<p>Источник недоступен или не сопоставлен с доступным материалом.</p>'}))]})})}</p><p>${textLink({label:'Сохранённый разбор',href:sourceReferenceHref(review.source)})}</p>`).join('')}<p>Разбор уточняет чтение вывода; новая автоматическая проверка не проводилась.</p>${disclosure({title:'Первоначальная формулировка и проверка',content:original})}</article>`;
 };
 return `<article class="brief-result">${heading}${r.budgetIssues?.length?notice({kind:'warning',message:'Исходное сообщение автоматической проверки: '+r.budgetIssues.join('. ')}):''}<details><summary>Результат и источники</summary>${(item.readingReviewIssues||[]).map(issue=>notice({kind:'warning',message:issue.message+' '+(issue.source||'')})).join('')}${checked}${(r.findings||[]).map(findingView).join('')}<p>Ограничения, записанные на этапе сбора: ${e(r.research?.limitations||'Не указаны.')}</p>${disclosure({title:'Заметки сбора до проверки',content:`<p>Первоначальный пересказ сборщика, до независимой проверки оснований:</p><p>${e(r.research?.summary||'Не сохранён.')}</p>`})}</details></article>`;
}
export function readableRunError(value) {
 return String(value||'').replace(/owner-practice/g,'часть об основателях').replace(/зависимый offer-demo-brief не запускался/g,'зависимая подготовка предложения и демонстрации не запускалась').replace(/offer-demo-brief не запускался/g,'подготовка предложения и демонстрации не запускалась').replace(/offer-demo-brief/g,'подготовка предложения и демонстрации').replace(/immutable queries/g,'исходной записи запросов').replace(/\bpartial\b/g,'незавершённой')
}
function savedRunView(run) {
 if(run.kind==='prepare')return `<article><h3>Подготовка направлений</h3><p>${run.status==='completed'?'Направления подготовлены: '+(run.result?.draft?.directions?.length||0)+'. Это гипотезы для выбора, до внешнего исследования.':'Подготовка не завершена.'}</p></article>`;
 const items=run.items||[],completed=items.filter(i=>i.status==='completed').length;
 return `<article><h3>Исследование выбранных вопросов</h3><p>Сохранены ответы: ${completed} из ${items.length}.${completed<items.length?' Исследование завершено не полностью.':''}</p>${run.needsReview?notice({kind:'warning',message:'Бриф изменился после запуска. Результат нужно сверить с текущей задачей.'}):''}${run.error?notice({kind:'warning',message:'Уточнение к запуску: '+readableRunError(run.error)}):''}${items.map(item=>resultView(item,{items})).join('')||'<p>Вопросы для этого запуска не сохранены.</p>'}</article>`
}
export function renderBriefContext(value) {
 const inline=text=>e(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,target)=>{const href=sourceReferenceHref(target.replace(/&amp;/g,'&'));return href?`<a href="${e(href)}">${label}</a>`:`${label} (${target})`})
 const titles={'What it is':'Что это','Stage & assets':'Стадия и активы','Constraints':'Ограничения','Business goals':'Бизнес-цели','Business goals (as stated)':'Заявленные бизнес-цели','Constraints (as stated)':'Заявленные ограничения','Target markets — hard boundary':'Границы целевых рынков','Current positioning and communication':'Текущее позиционирование и коммуникация','Claims to check':'Что предстоит проверить'}
 const out=[];let paragraph=[],list=false
 const flush=()=>{if(paragraph.length){out.push('<p>'+inline(paragraph.join(' '))+'</p>');paragraph=[]}}
 const close=()=>{if(list){out.push('</ul>');list=false}}
 for(const line of String(value||'Пока не записано.').split('\n')){
  const heading=line.match(/^#{1,6}\s+(.+)$/),item=line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/)
  if(heading){flush();close();out.push('<h4>'+inline(titles[heading[1]]||heading[1])+'</h4>')}
  else if(item){flush();if(!list){out.push('<ul>');list=true}out.push('<li>'+inline(item[1])+'</li>')}
  else if(!line.trim()){flush();close()}
  else {close();paragraph.push(line.trim())}
 }
 flush();close();return out.join('')
}
// Product reads saved briefs. Editing and launching remain a separate Tools destination.
export function renderResearchBriefReading(briefs=[],{id=''}={}) {
 const list=Array.isArray(briefs)?briefs:[],text=value=>typeof value==='string'?value:value?.question||value?.name||value?.label||'',facts=items=>proseFacts({items:items.map(([label,value])=>({label,value:e(value||'Пока не записано.')}))})
 if(!id)return list.length?`<div class="brief-reading-list">${list.map(b=>summaryCard({title:b.title||'Бриф исследования',href:'#product/brief/'+encodeURIComponent(b.id),content:`<p>${e(b.frame?.businessGoal||'Решение ещё не сформулировано.')}</p>`})).join('')}</div>`:emptyState({kind:'first-use',title:'Бриф пока не сохранён',description:'Здесь будет задача исследования, его направления и сохранённые результаты.'})
 const b=list.find(b=>b.id===id),back=button({label:'← Все брифы',href:'#product/brief'})
 if(!b)return pageHeader({title:'Бриф не найден',level:2,back,backTight:true})+emptyState({kind:'unavailable',description:'Запись отсутствует или ссылка устарела.'})
 const jobs=Array.isArray(b.jobs)?b.jobs:[],dirs=Array.isArray(b.directions)?b.directions:[],items=Array.isArray(b.items)?b.items:[],runs=Array.isArray(b.runs)?b.runs:[]
 const refs=values=>sourceList({entries:(values||[]).map(value=>{const path=typeof value==='string'?value:value.source||'',href=sourceReferenceHref(path);return {title:href?(typeof value==='string'?'Источник':value.title||'Источник'):'Связанный источник не найден',meta:href?path:'',href}})})
 const sections=[{id:'brief-decision',title:'Какое решение нужно принять',content:facts([['Задача исследования',b.frame?.businessGoal],['Ограничения',b.frame?.constraints],['Рынки',(b.frame?.targetMarkets||[]).join(' · ')]])+proseFacts({items:[{label:'Контекст на момент подготовки',value:renderBriefContext(b.frame?.productContext)}]})},
 {id:'brief-directions',title:'Направления исследования',content:dirs.map(d=>{const job=jobs.find(j=>j.id===d.coreJobId);return disclosure({title:d.name||'Направление без названия',content:facts([['Ситуация клиента',d.context],['Основная работа',job?.name],['Почему граница проведена здесь',d.boundaryRationale||job?.climbReason],['За что уже платили',d.pastHiring],['Ограничения',(d.constraints||[]).join(' · ')]])+(d.criteria?.length?'<h3>Критерии результата</h3><ul>'+d.criteria.map(c=>`<li>${e(c.criterion)}${c.axis?' · '+e(c.axis):''}${c.threshold!==null&&c.threshold!==undefined?' · порог: '+e(c.threshold):' · порог неизвестен'}${c.priority!==null&&c.priority!==undefined?' · приоритет: '+e(c.priority):''}</li>`).join('')+'</ul>':'<p>Критерии ещё не записаны.</p>')+(d.unknowns?.length?'<h3>Открытые вопросы</h3><ul>'+d.unknowns.map(v=>`<li>${e(text(v))}</li>`).join('')+'</ul>':'')+refs(d.evidenceRefs)})}).join('')||'<p>Направления ещё не записаны.</p>'},
 {id:'brief-jobs',title:'Задачи клиента и границы продукта',content:jobs.map(job=>disclosure({title:job.name||'Работа без названия',content:facts([['Уровень',({big:'Более высокая работа',core:'Основная работа продукта',small:'Соседняя работа',micro:'Шаг внутри работы'})[job.level]||'Не определён'],['Почему так выделена',job.climbReason],['Продукт выполняет целиком',job.performedFully==='yes'?'Заявлено; см. основания':job.performedFully==='no'?'Нет':'Гипотеза / неизвестно']])+refs(job.evidenceRefs)})).join('')||'<p>Работы ещё не записаны.</p>'},
 {id:'brief-questions',title:'Что нужно выяснить',content:(b.questions?.length?'<h3>Общие вопросы</h3><ul>'+b.questions.map(q=>`<li>${e(text(q))}</li>`).join('')+'</ul>':'')+(items.length?'<h3>Вопросы выбранных частей</h3>':'')+items.map(item=>disclosure({title:item.question||'Вопрос не записан',content:facts([['Ожидаемый результат',item.expectedOutcome],['Включено в исследование',item.included===false?'Нет':'Да'],['Нужны результаты других частей',(item.dependsOn||[]).map(id=>items.find(i=>i.id===id)?.question||'Связанный вопрос не найден').join(' · ')]])})).join('')||'<p>Вопросы ещё не записаны.</p>'},
 {id:'brief-results',title:'Сохранённые результаты',content:runs.slice().reverse().map(savedRunView).join('')||'<p>Сохранённых результатов пока нет.</p>'}]
 return pageHeader({title:b.title||'Бриф исследования',level:2,back,backTight:true})+readingSections({sections,contentsTitle:'В брифе'})
}
export async function mountResearchBriefReading(root,{id=''}={}) {
 const controller=new AbortController();let disposed=false
 root.innerHTML=loadingState({label:'Загрузка сохранённых брифов…'})
 async function load(){try{const response=await fetch('/api/research-briefs?view=reading'+(id?'&id='+encodeURIComponent(id):''),{signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(!disposed)root.innerHTML=renderResearchBriefReading(data.briefs,{id})}catch(error){if(!disposed&&error.name!=='AbortError')root.innerHTML=emptyState({kind:'unavailable',title:'Брифы недоступны',description:'Не удалось загрузить сохранённые данные.',actions:button({label:'Повторить загрузку',attributes:{'data-brief-read-retry':true}})})}}
 root.addEventListener('click',event=>{if(event.target.closest('[data-brief-read-retry]'))load()},{signal:controller.signal})
 await load();return {destroy(){disposed=true;controller.abort()}}
}
export async function mountResearchBrief(root,options={}) { return mountResearchBriefReading(root,options) }
