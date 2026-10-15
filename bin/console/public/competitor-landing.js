import {escapeHTML,badge,textLink,notice,emptyState} from './ui-components.js'
// Pure renderers for what a competitor's site promises (dossier block) and the promise map
// (competitors collection). Data comes from galaxy-model `landing`, `messaging` and `promiseMap`;
// nothing here infers strength, jobs or dates. Source citations are supplied by the caller.
const esc=escapeHTML
const list=value=>Array.isArray(value)?value:[]
const text=value=>typeof value==='string'&&value.trim()?value.trim():''
export const STRENGTH_WORDS={strong:'сильное обещание',moderate:'среднее обещание',weak:'слабое обещание'}
export const STRENGTH_DOTS={strong:'●●●',moderate:'●●○',weak:'●○○'}
export const LANDING_STATUS_WORDS={captured:'снимок страницы',['text-only']:'снимок текста без скриншота',legacy:'разбор из записей исследования; цитаты не сверены с текстом страницы',unverified:'снимок не найден, цитаты не проверены',unavailable:'сайт был недоступен',none:'сайт не разобран'}
const LANG_WORDS={ru:'русский',en:'английский'}
export function formatDate(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:text(value)||'дата не указана'}
export function strengthMarkup(strength){
 if(!STRENGTH_DOTS[strength])return '<span class="landing-strength landing-strength-unknown">сила не оценена</span>'
 return `<span class="landing-strength" role="img" aria-label="${esc(STRENGTH_WORDS[strength])}" title="${esc(STRENGTH_WORDS[strength])}">${STRENGTH_DOTS[strength]}</span>`
}
function hostOf(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return ''}}
function safeHttp(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function lineMarkup(line,{key,evidence,stale=false}={}){
 const meta=[line.formulaLabel?badge({label:line.formulaLabel}):'',strengthMarkup(line.strength),line.criterionLabel?`<span class="landing-criterion">критерий: ${esc(line.criterionLabel)}</span>`:'',
  text(line.against)?`<span class="landing-against">задевает наше отличие: ${esc(line.against)}</span>`:'',stale?'<span class="landing-stale-mark">устаревшая связь</span>':''].filter(Boolean).join(' ')
 return `<div class="landing-line${stale?' is-stale':''}"><blockquote class="landing-quote">${evidence?evidence(line,key,line.quote):esc(line.quote)}</blockquote><p class="landing-line-meta">${meta}</p></div>`
}
function groupLines(lines){
 const groups=new Map()
 for(const line of lines){const id=line.jobId||(text(line.job)?`label:${line.job}`:'');if(!groups.has(id))groups.set(id,{id,label:text(line.job)||'Без привязки к работе сегмента',segmentLabel:text(line.segmentLabel),lines:[]});groups.get(id).lines.push(line)}
 return [...groups.values()].sort((a,b)=>(a.id===''?1:0)-(b.id===''?1:0))
}
function groupsMarkup(groups,{prefix,evidence}){
 return groups.map(group=>`<article class="galaxy-fact landing-job"><div class="dossier-claim-head"><strong>${esc(group.label)}</strong>${group.segmentLabel?`<span class="landing-seg">${esc(group.segmentLabel)}</span>`:''}</div>${group.lines.map((line,i)=>lineMarkup(line,{key:`${prefix}:${group.id||'none'}:${i}`,evidence,stale:line.stale===true})).join('')}</article>`).join('')
}
function factsMarkup(rows){
 const filled=rows.filter(([,value])=>text(value))
 return filled.length?`<dl class="os-facts landing-facts">${filled.map(([label,value])=>`<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>`:''
}
function firstScreenMarkup(landing,{competitorId,evidence}){
 const main=list(landing.lines).find(line=>line.main)
 const headline=text(landing.h1)||main?.quote||''
 const site=hostOf(landing.url)
 const shot=landing.screenshotHref?`<figure class="landing-shot-box"><img class="landing-shot" src="${esc(landing.screenshotHref)}" alt="Снимок сайта ${esc(site||'конкурента')} от ${esc(formatDate(landing.observedAt))}" loading="lazy"></figure>`:''
 return `<article class="landing-first${shot?' has-shot':''}"><div class="landing-first-body"><p class="landing-kicker">${landing.contentType?'Обещание на странице':'Первый экран'}</p>${headline?`<h4 class="landing-h1">${main&&evidence?evidence(main,`${competitorId}:landing:main`,headline):esc(headline)}</h4>`:'<p class="galaxy-empty-copy">Заголовок первого экрана не записан.</p>'}${text(landing.subtitle)?`<p class="landing-sub">${esc(landing.subtitle)}</p>`:''}${text(landing.cta)?`<p class="landing-cta">Кнопка: ${esc(landing.cta)}</p>`:''}${main?`<p class="landing-line-meta">${badge({label:landing.contentType?'Основная фраза разбора':'Главное обещание',tone:'positive'})} ${main.formulaLabel?badge({label:main.formulaLabel}):''} ${strengthMarkup(main.strength)}</p>`:''}${factsMarkup([['Доверие',landing.proof],['Кого увольняет',landing.fires]])}</div>${shot}</article>`
}
function foreignMarkup(rows,competitor){
 if(!rows.length)return ''
 const hosts=[...new Set(rows.map(row=>hostOf(row.source)).filter(Boolean))]
 const own=hostOf(competitor.url)||'сайт карточки'
 const count=rows.length,word=count%10===1&&count%100!==11?'фраза взята':count%10>=2&&count%10<=4&&(count%100<10||count%100>=20)?'фразы взяты':'фраз взято'
 return notice({kind:'warning',className:'landing-foreign',message:`Две компании в одной карточке. ${count} ${word} с ${hosts.join(', ')||'другого сайта'}, а карточка ведёт на ${own}. Они не показаны как обещания этого конкурента.`,
  actions:`<details class="landing-details"><summary>Показать чужие фразы</summary>${rows.map(row=>`<blockquote class="landing-quote">${esc(row.quote)} <span class="landing-seg">· ${esc(hostOf(row.source)||row.source||'источник не указан')}</span></blockquote>`).join('')}</details>`})
}
function previousMarkup(previous,{competitorId,evidence}){
 return list(previous).filter(item=>item&&item.observedAt).map((item,n)=>`<details class="landing-details landing-previous"><summary>Прошлый снимок · ${esc(formatDate(item.observedAt))}${item.status&&!['captured','text-only','legacy'].includes(item.status)?` · ${esc(LANDING_STATUS_WORDS[item.status]||item.status)}`:''}</summary>${text(item.h1)?`<p class="landing-sub"><b>${esc(item.h1)}</b></p>`:''}${list(item.lines).length?groupsMarkup(groupLines(item.lines),{prefix:`${competitorId}:landing-previous:${n}`,evidence}):'<p class="galaxy-empty-copy">Строки этого снимка не сохранены.</p>'}</details>`).join('')
}
/** «Что обещает сайт». `evidence(row,key)` renders a source citation; `actions` and `gapAction` are trusted markup slots. */
export function renderLandingBlock(competitor,{evidence=null,actions='',gapAction=''}={}){
 const id=competitor.id||'competitor',landing=competitor.landing&&typeof competitor.landing==='object'?competitor.landing:null
 const messaging=list(competitor.messaging).filter(row=>row&&text(row.quote))
 const findings=new Set(list(competitor.researchSections?.messaging?.findings).map(item=>text(item?.statement)).filter(Boolean))
 const foreign=messaging.filter(row=>row.foreign)
 const landingQuotes=new Set(list(landing?.lines).map(line=>line.quote))
 const own=messaging.filter(row=>!row.foreign&&!landingQuotes.has(row.quote)&&!findings.has(row.quote)&&(row.formulaKey||row.jobId||text(row.job)))
 let body=''
 if(landing){
  const status=LANDING_STATUS_WORDS[landing.status]||'снимок'
  const site=safeHttp(landing.url)
  body+=`<p class="landing-meta">Снимок <b>${esc(formatDate(landing.observedAt))}</b>${landing.lang?` · ${esc(LANG_WORDS[landing.lang]||landing.lang)}`:''}${site?` · <a href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(site))} ↗</a>`:''}${landing.snapshotHref?` · <a href="${esc(landing.snapshotHref)}" target="_blank" rel="noopener noreferrer">текст снимка</a>`:''} · <span class="landing-status">${esc(status)}</span>${actions?`<span class="landing-meta-actions">${actions}</span>`:''}</p>`
  if(['captured','text-only','legacy'].includes(landing.status))body+=firstScreenMarkup(landing,{competitorId:id,evidence})
  if(text(landing.limitations))body+=notice({message:landing.limitations})
  const current=[...list(landing.lines),...own]
  const groups=groupLines(current)
  body+=`<h4 class="landing-h">Какие работы занимает</h4>${groups.length?groupsMarkup(groups,{prefix:`${id}:landing`,evidence}):'<p class="galaxy-empty-copy">Ни одна фраза со страницы не привязана к работам сегментов.</p>'}`
  body+=factsMarkup([['Как снимает страх',landing.fearHandling],['Что с ошибками',landing.errorHandling],['Сценарии',landing.scenarios]])
  body+=previousMarkup(landing.previous,{competitorId:id,evidence})
 }else{
  body+=notice({className:'landing-empty',message:'Сайт ещё не разобран: нет датированного снимка с обещаниями конкурента.'+(text(competitor.landingBigJob)?` Есть только сохранённая фраза: ${competitor.landingBigJob}`:''),actions:gapAction})
  if(own.length)body+=`<h4 class="landing-h">Что записано в исследовании</h4>${groupsMarkup(groupLines(own),{prefix:`${id}:messaging`,evidence})}`
 }
 body+=foreignMarkup(foreign,competitor)
 return `<div class="landing-block" data-landing-status="${esc(landing?.status||'none')}">${body}</div>`
}
// A selected parent includes descendants, but the caller's selected filters stay unchanged.
export function expandSegmentIds(segmentIds,segments=[]){
 const expanded=new Set(segmentIds),children=new Map()
 for(const segment of segments){
  if(!segment.id||!segment.parentId)continue
  if(!children.has(segment.parentId))children.set(segment.parentId,[])
  children.get(segment.parentId).push(segment.id)
 }
 for(const id of expanded)for(const child of children.get(id)||[])expanded.add(child)
 return [...expanded]
}
// Filter both axes without changing the shared projection. Older maps have only segmentId.
export function scopePromiseMap(map,{segmentIds=[],competitorIds=null}={}){
 const selected=new Set(segmentIds),allowed=competitorIds===null?null:new Set(competitorIds)
 const scopeOf=row=>Array.isArray(row.segmentIds)?row.segmentIds:row.segmentId?[row.segmentId]:[]
 const jobs=list(map?.jobs).flatMap(job=>{
  const scope=scopeOf(job).filter(id=>!selected.size||selected.has(id))
  if(selected.size&&!scope.length)return []
  const segments=(list(job.segments).length?job.segments:job.segmentId?[{id:job.segmentId,label:job.segmentLabel}]:[]).filter(segment=>scope.includes(segment.id))
  const criteria=list(job.criteria).flatMap(criterion=>{
   const criterionScope=(Array.isArray(criterion.segmentIds)?criterion.segmentIds:scopeOf(job)).filter(id=>scope.includes(id))
   return selected.size&&!criterionScope.length?[]:[{...criterion,segmentIds:criterionScope}]
  })
  return [{...job,segmentId:scope[0]||null,segmentIds:scope,segments,segmentLabel:segments.map(segment=>segment.label).filter(Boolean).join(' · '),criteria}]
 })
 const competitors=list(map?.competitors).filter(column=>allowed===null||allowed.has(column.id))
 const columnIds=new Set(competitors.map(column=>column.id))
 const rows=[...jobs.map(job=>({rowId:job.id,kind:'job',label:job.label})),...jobs.flatMap(job=>job.criteria.map(criterion=>({rowId:criterion.id,kind:'criterion',label:criterion.label})))]
 const cells={}
 for(const {rowId} of rows){
  const values=Object.entries(map?.cells?.[rowId]||{}).filter(([id])=>columnIds.has(id))
  if(values.length)cells[rowId]=Object.fromEntries(values)
 }
 const openings=[...new Map(rows.map(row=>[row.rowId,row])).values()].filter(row=>!Object.keys(cells[row.rowId]||{}).length).map(row=>({...row,claimedBy:0}))
 return {...map,jobs,competitors,cells,openings}
}
function cellMarkup(cell,column){
 if(column.status==='unavailable')return '<td class="promise-cell promise-none">сайт недоступен</td>'
 if(!['captured','text-only','legacy'].includes(column.status))return '<td class="promise-cell promise-none">нет снимка</td>'
 if(!cell)return '<td class="promise-cell promise-empty"><span aria-label="обещание не найдено в изученном материале">—</span></td>'
 const quote=text(cell.quote)
 return `<td class="promise-cell${cell.against?' promise-against':''}" title="${esc([cell.formulaLabel,quote].filter(Boolean).join(': '))}">${strengthMarkup(cell.strength)}${cell.against?'<span class="landing-against">задевает отличие</span>':''}<span class="promise-quote">${esc(quote)}</span></td>`
}
function claimedMarkup(row,columns,cells){
 const measured=columns.filter(column=>['captured','text-only','legacy'].includes(column.status))
 const claimed=measured.filter(column=>cells[row.id]?.[column.id]).length
 if(!measured.length)return '<td class="promise-cell promise-none">нет снимков</td>'
 return claimed?`<td class="promise-cell promise-claimed">${claimed} из ${measured.length}</td>`:'<td class="promise-cell promise-free">Не найдено</td>'
}
/** «Карта обещаний»: concrete jobs and criteria; unavailable sources never count as inspected. */
export function renderPromiseMap(map,{limit=8,hrefFor=id=>`#competitor/${encodeURIComponent(id)}/messages`}={}){
 const jobs=list(map?.jobs),all=list(map?.competitors),cells=map?.cells&&typeof map.cells==='object'?map.cells:{}
 const columns=all.slice(0,limit),rest=all.slice(limit)
 const lead='<p class="promise-lead">Какие задачи и критерии конкуренты обещают закрыть на изученных страницах. Точки — заметность обещания на сайте. Пустая ячейка означает, что обещание не найдено в изученном материале; это не доказательство свободной ниши.</p>'
 if(!jobs.length)return `<section class="promise-map" aria-label="Карта обещаний"><h2>Карта обещаний</h2>${lead}${emptyState({kind:'first-use',title:'Основные работы сегментов ещё не описаны',description:'Карта строится по основным работам живых сегментов и их критериям выбора.'})}</section>`
 if(!all.some(column=>['captured','text-only','legacy'].includes(column.status)))return `<section class="promise-map" aria-label="Карта обещаний"><h2>Карта обещаний</h2>${lead}${emptyState({kind:'first-use',title:'Нет доступных снимков сайтов',description:'Сайты выбранных конкурентов ещё не разобраны или были недоступны. Это не означает отсутствия обещаний.'})}</section>`
 const span=columns.length+2
 const head=`<tr><th scope="col">Работа или критерий</th>${columns.map(column=>`<th scope="col">${textLink({label:column.label,href:hrefFor(column.id)})}<span class="promise-date">${column.status==='none'?'сайт не разобран':column.status==='unavailable'?'сайт недоступен':`снимок ${esc(formatDate(column.observedAt))}`}${column.status==='legacy'?' · по записям':''}${column.mixed?' · две компании':''}</span></th>`).join('')}<th scope="col">Найдено в выборке</th></tr>`
 const rowMarkup=(row,extra='')=>`<tr><th scope="row">${extra}${esc(row.label)}</th>${columns.map(column=>cellMarkup(cells[row.id]?.[column.id],column)).join('')}${claimedMarkup(row,columns,cells)}</tr>`
 const jobRows=jobs.map(job=>rowMarkup(job,`<span class="landing-seg">${esc(job.segmentLabel||'')}</span>`)).join('')
 const criteria=jobs.flatMap(job=>job.criteria.map(criterion=>({...criterion,jobLabel:job.label})))
 const criterionRows=criteria.length?`<tr class="promise-group"><th colspan="${span}" scope="colgroup">Критерии выбора</th></tr>${criteria.map(criterion=>rowMarkup(criterion,`<span class="landing-seg">${esc(criterion.jobLabel)}</span>`)).join('')}`:''
 return `<section class="promise-map" aria-label="Карта обещаний"><h2>Карта обещаний</h2>${lead}<div class="promise-scroll" role="region" aria-label="Таблица карты обещаний" tabindex="0"><table class="promise-table"><thead>${head}</thead><tbody><tr class="promise-group"><th colspan="${span}" scope="colgroup">Задачи клиентов</th></tr>${jobRows}${criterionRows}</tbody></table></div>${rest.length?`<p class="promise-rest">Без колонки в таблице: ${rest.map(column=>textLink({label:column.label,href:hrefFor(column.id)})).join(', ')}.</p>`:''}</section>`
}
