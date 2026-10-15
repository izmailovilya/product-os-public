import {competitorPreview,competitorCategory,competitorText} from './competitor-preview.js'
import {readingList} from './reading-list.js'
import {segmentSupportBadge,segmentSupportSummary} from './segment-support.js'
import {ProductTabs} from './product-tabs.js'
import {sourceNote,sourceEntry,sourceList,pageHeader,topicNav,detailLayout,emptyState,textLink,notice,button,readingSection,readingSections,readingLayout,proseFacts,factLine,disclosure,summaryCard,field,filterBar,badge} from './ui-components.js'
import {renderLandingBlock} from './competitor-landing.js'
import {segmentReading} from './segment-collection.js'
// Atlas dossiers keep evidence beside each claim.
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const list = value => Array.isArray(value) ? value : []
const words = { hypothesis: 'Гипотеза', evidenced: 'Есть свидетельства', validated: 'Подтверждено', contradicted: 'Есть возражения', dropped: 'Отложено', unverified: 'Требует проверки', unknown: 'Не исследовано', supported: 'Подтверждено источниками', source_only: 'Есть источник; вывод требует проверки', mixed: 'Источники расходятся', direct: 'Прямой конкурент', indirect: 'Альтернативное решение', diy: 'Самостоятельное решение', do_nothing: 'Бездействие', not_researched: 'Не исследовано', observed: 'Наблюдается сейчас', draft: 'Черновик для проверки', current: 'Используется сейчас', proposed: 'Предложение', planned: 'Запланировано', implemented: 'Реализовано' }
const status = value => words[value] || (typeof value==='string'&&/[А-Яа-яЁё]/.test(value)?value:'Требует проверки')
const textOf = value => typeof value === 'string' ? value : value?.label || value?.summary || value?.message || value?.text || ''
const note = text => text ? `<p class="dossier-note">${esc(text)}</p>` : ''
const title = (label, body, empty = 'Этот раздел ещё не исследован.', id = '') => `<section class="galaxy-panel-section"${id ? ` data-dossier-section="${esc(id)}"` : ''}><h3>${esc(label)}</h3>${body || `<p class="galaxy-empty-copy">${esc(empty)}</p>`}</section>`
// Saved paragraph boundaries are formatting; ordinary body text is always complete.
const prose = (value, render = esc) => String(value ?? '').split(/\n\s*\n/)
  .filter(part => part.trim()).map(part => `<p class="os-reading-prose">${render === esc ? esc(part).replace(/\n/g, '<br>') : render(part)}</p>`).join('');
const dl = rows => {
  const items=rows.filter(([,value])=>value!=null&&value!=='').map(([label,value])=>({label,value:prose(textOf(value)||value)}))
  return items.length?proseFacts({items}):''
}

export function sourceHref(source) {
  if (typeof source !== 'string') return null
  if (/^https?:\/\//i.test(source)) { try { const url = new URL(source); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null } }
  const [file, fragment] = source.split('#')
  if (!file.includes('..') && /^(?:sources\/[^\\]+\.(?:md|txt|json|html|csv)|reports\/[^\\]+\.md|PRODUCT\.md|MOVES\.md)$/.test(file)) return `/source?path=${encodeURIComponent(file)}${fragment ? `#${encodeURIComponent(fragment)}` : ''}`
  return null
}

function sourceModel(item) {
  item = typeof item === 'string' ? { source: item } : item || {}
  const href = sourceHref(item.url || item.source)
  const raw = item.url || item.source || ''
  const explicit = item.title || item.label
  const date = raw.match(/(20\d{2})-(\d{2})-(\d{2})/)
  const localLabel = raw.startsWith('reports/') ? 'Исследование' : raw.startsWith('sources/') ? 'Материал исследования' : raw === 'PRODUCT.md' ? 'Описание продукта' : raw === 'MOVES.md' ? 'План работы' : ''
  const friendly = localLabel ? localLabel + (date ? ' · ' + new Date(`${date[0]}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '') : href?.startsWith('http') ? new URL(href).hostname.replace(/^www\./, '') : 'Источник'
  const label = explicit && explicit !== raw && !/^(reports|sources)\//.test(explicit) ? explicit : friendly
  const relation = item.relation === 'contradicted_by' || item.relation === 'contradicts' ? 'Возражение' : item.kind === 'source' ? 'Источник контекста' : 'Свидетельство'
  const dates = [['Дата записи',item.date],['Опубликовано',item.publishedAt],['Получено',item.retrievedAt],['Проверено',item.checkedAt]].filter(([,value])=>value).map(([label,value])=>`${label}: ${value}`).join(' · ')
  const scope = typeof item.scope === 'string' ? item.scope : item.scope ? [item.scope.product,item.scope.segment,item.scope.market].filter(Boolean).join(' · ') : ''
  return {title:label,relation,author:textOf(item.author),meta:dates,quote:item.quote||'',href:href||'',linkLabel:href?'Открыть оригинал ↗':'',context:scope?note(scope):'',details:!href?note(item.source?`Источник: ${item.source}`:'Ссылка на первоисточник не указана.'):''}

}

export function sourceMarkup(item) { return sourceEntry(sourceModel(item)) }
function sourcesMarkup(items) { return sourceList({entries:list(items).map(sourceModel)}) }

function evidenceControl(key, label, body, text = '') {
 return sourceNote({text:text||label,title:'Источники и основания',content:body,attributes:{'data-evidence-key':key}})
}

export function evidenceMarkup(row, key, explanation = '', text = row?.label || row?.title || row?.name || row?.summary || 'Основания утверждения') {
  const evidence = list(row?.evidence)
  const label = `Источник: ${row?.label || row?.title || row?.name || 'утверждение'}`
  return evidenceControl(key, label, `${explanation ? note(explanation) : ''}${note(status(row?.evidenceStatus || 'unverified'))}${evidence.length ? sourcesMarkup(evidence) : note('Связанных подтверждений пока нет. Это гипотеза, которую нужно проверить.')}`,text)
}

function evidenceFields(row,key,fields){return `<dl>${fields.filter(([,value])=>value).map(([label,value],i)=>`<dt>${esc(label)}</dt><dd>${evidenceMarkup(row,`${key}:${i}`,'',value)}</dd>`).join('')}</dl>`}

function claim(row, key, body = '') {
  return `<article class="galaxy-fact dossier-claim"><div class="dossier-claim-head"><strong>${evidenceMarkup(row, key)}</strong></div>${body}</article>`
}

function header(entity, kind, ctx) {
  return `<div class="galaxy-panel-top"><span>${esc(kind)}</span><button type="button" data-galaxy-close aria-label="Закрыть досье">${ctx.icon('close')}</button></div><h2>${esc(entity.displayLabel || entity.label)}</h2><div class="galaxy-panel-status">${ctx.statusMarkup||`<span>${esc(status(entity.status))}</span>`}${entity.rank ? `<span>Приоритет №${entity.rank} · предварительная оценка</span>` : ''}</div>`
}

export function movesMarkup(moves) {
 return list(moves).length ? `<div class="dossier-moves">${moves.map(move => `<article class="galaxy-fact"><h3>${esc(move.title)}</h3>${move.reason?note(move.reason):''}${move.output?factLine({label:'Ожидаемый результат проверки',value:esc(move.output)}):''}</article>`).join('')}</div>` : ''
}

function segmentChips(ids, ctx) {
  return `<div class="dossier-segment-chips">${[...new Set(list(ids))].map(id => { const segment = ctx.segment(id); return segment ? `<button type="button" data-galaxy-select="segment:${esc(id)}">${esc(segment.displayLabel || segment.label)}</button>` : '' }).join('')}</div>`
}

function progressMarkup(segment) {
  const v = segment.verification
  const progress = segment.researchProgress
  if (!v && !progress) return ''
  const steps = progress?.steps || v?.gates || []
  return `<details class="galaxy-gates dossier-progress" data-disclosure="${esc(segment.id)}:progress"><summary><span>Шаги проверки сегмента</span><small>${progress?.completed ?? v?.passed ?? 0} из ${progress?.total ?? v?.total ?? steps.length} завершены</small></summary><h3>Проверка сегмента · ${v?.percent ?? 0}% этапов</h3>${note(progress?.summary || 'Это покрытие этапов проверки, а не вероятность успеха сегмента. Исследование открытых источников не заменяет интервью, проверку оплаты и экономику продукта. Отрицательный результат тоже завершает этап.')}<ol>${steps.map(step => `<li class="${(step.done || step.status === 'complete') ? 'is-done' : step.blocked ? 'is-blocked' : ''}"><i>${(step.done || step.status === 'complete') ? '✓' : (step.partial || step.status === 'partial') ? '◐' : '—'}</i><span><b>${esc(step.label)}</b><small>${esc(step.detail || step.description)}</small></span></li>`).join('')}</ol>${v?.blockers?.length ? `<div class="galaxy-gate-block"><b>Выявленные ограничения</b>${v.blockers.map(blocker => note(blocker.reason)).join('')}</div>` : ''}</details>`
}

function quantityMarkup(segment) {
  const quantities = list(segment.quantities).filter(row => row.value != null)
  if (!quantities.length) return title('Размер сегмента и расходы', note('Размер аудитории и расходы на задачу пока не подтверждены. Числовых оценок без основания здесь нет.'))
  return title('Размер сегмента и расходы', `<div class="galaxy-panel-facts dossier-quantities">${quantities.map((row, index) => claim(row, `${segment.id}:quantity:${row.id || index}`, dl([['Значение', row.formattedValue || (row.value != null ? `${typeof row.value === 'number' ? row.value.toLocaleString('ru-RU') : textOf(row.value)} ${row.unit || ''}`.trim() : 'Не установлено')], ['Основание оценки', ({ sourced: 'Из источника', derived: 'Расчёт по исходным данным', unknown: 'Основание не установлено' })[row.basis] || row.basis], ['Что означает', row.description], ['Расчёт', row.calculation]]))).join('')}</div>`)
}

function riskMarkup(risk, key) {
  return claim(risk, key, `${risk.fatal ? '<span class="dossier-warning">Критическое допущение</span>' : ''}${dl([['Почему важно', risk.whyFundamental || risk.whyImportant || risk.context], ['Как проверить', risk.testMethod], ['До каких затрат проверить', risk.checkBeforeSpending ? 'До начала расходов на этот сценарий' : '']])}${globalThis.ProductWork?.reading(risk.id)||''}${list(risk.moves).length ? movesMarkup(risk.moves) : ''}`)
}

export function renderSegmentContext(segment){
 const problems=list(segment.problems),countries=list(segment.countries);
 return (problems.length?title('Что болит',problems.map(problem=>claim(problem,`${segment.id}:problem:${problem.id}`,note(problem.context||problem.description))).join('')):'')+(countries.length?title('Подсегменты',countries.map(country=>claim(country,`${segment.id}:subsegment:${country.id}`,dl([['Особенность ситуации',country.sharperContext],['Что запускает поиск решения',list(country.triggers).join(' · ')],['Дополнительные критерии',list(country.addedCriteria).map(textOf).join(' · ')]]))).join('')):'');
}

export function renderSegmentChecks(segment,{reading=false}={}){
 const steps=list(segment.researchProgress?.steps||segment.verification?.gates),risks=list(segment.risks);
 const plan=steps.length?`<ol class="verification-list">${steps.map(step=>`<li><strong>${esc(step.label)}</strong><p>${step.done||step.status==='complete'?'Проверка выполнена':step.partial||step.status==='partial'?'Есть часть сведений':'Ещё не проверено'}</p>${note(step.detail||step.description)}${step.nextAction?note('Следующая проверка: '+step.nextAction):''}</li>`).join('')}</ol>`:emptyState({kind:'first-use',title:'План проверки ещё не записан',description:'Выберите следующее действие, чтобы уточнить задачи и основания сегмента.'});
 if(reading){
  const sections=[{id:'segment-check-plan',title:'План проверки',intro:'План показывает, что уже проверено, где есть только часть сведений и какие допущения ещё нужно проверить. Выполненный этап не означает, что спрос доказан.',content:segmentSupportSummary(segment,{includePeople:false,compact:true})+(Number.isFinite(segment.verification?.percent)?`<p data-check-coverage>${segment.verification.percent}% этапов исследования. Это покрытие проверки, а не подтверждение спроса.</p>`:'')+(list(segment.verification?.blockers).length?`<div data-check-blockers>${notice({kind:'warning',message:'Выявлены ограничения: '+segment.verification.blockers.map(blocker=>blocker.reason).join('; ')})}</div>`:'')+plan}]
  if(list(segment.quantities).some(row=>row.value!=null))sections.push({id:'segment-check-economy',title:'Экономика и условия',content:`<div data-check-economy>${quantityMarkup(segment)}</div>`})
  if(risks.length)sections.push({id:'segment-check-risks',title:'Риски и непроверенные допущения',content:risks.map(risk=>riskMarkup(risk,`${segment.id}:risk:${risk.id}`)).join('')})
  if(list(segment.moves).length)sections.push({id:'segment-check-actions',title:'Следующие действия',content:movesMarkup(segment.moves)})
  if(list(segment.sources).length)sections.push({id:'segment-check-sources',title:'Основания проверки',content:evidenceControl(`${segment.id}:check-sources`,'Источники проверки сегмента',sourcesMarkup(segment.sources),'Открыть источники проверки')})
  return `<div data-segment-checks>${segmentReading(sections,{contentsTitle:'В плане проверки'})}</div>`
 }
 return `<section data-segment-checks>${segmentSupportSummary(segment,{compact:true})}<h2>План проверки</h2>${Number.isFinite(segment.verification?.percent)?`<p data-check-coverage>${segment.verification.percent}% этапов исследования. Это покрытие проверки, а не подтверждение спроса.</p>`:''}${list(segment.verification?.blockers).length?`<div data-check-blockers>${notice({kind:'warning',message:'Выявлены ограничения: '+segment.verification.blockers.map(blocker=>blocker.reason).join('; ')})}</div>`:''}${plan}${list(segment.quantities).some(row=>row.value!=null)?`<div data-check-economy>${quantityMarkup(segment)}</div>`:''}${risks.length?title('Риски и непроверенные допущения',risks.map(risk=>riskMarkup(risk,`${segment.id}:risk:${risk.id}`)).join('')):''}${list(segment.moves).length?title('Следующие действия',movesMarkup(segment.moves)):''}${list(segment.sources).length?title('Основания проверки',evidenceControl(`${segment.id}:check-sources`,'Источники проверки сегмента',sourcesMarkup(segment.sources),'Открыть источники проверки')):''}</section>`
}

export function renderSegmentDossier(segment, ctx) {
  const values = ctx.values.filter(value => list(segment.valueIds).includes(value.id) || list(value.segmentIds).includes(segment.id))
  const jobs = list(segment.jobs)
  const solvers = new Map(list(segment.competitors).map(row => [row.id, row]))
  list(segment.hired).forEach(row => solvers.set(row.id, { ...solvers.get(row.id), ...row }))
  const fullDescription = segment.description || segment.fullLabel || segment.label
  return `${header(segment, 'СЕГМЕНТ КЛИЕНТОВ', {...ctx,statusMarkup:segmentSupportBadge(segment)})}${fullDescription !== segment.displayLabel ? note(fullDescription) : ''}
    ${segment.context && segment.context !== fullDescription ? dl([['Ситуация клиента', segment.context]]) : ''}
    ${segmentSupportSummary(segment,{includeBadge:false})}
    <details><summary>Статус исследовательской модели</summary><p>${esc(status(segment.status))}</p></details>
    <div class="research-people"><button type="button" data-research-segment="${esc(segment.id)}">Все участники сегмента (${segment.participantCount || 0})</button></div>
    ${progressMarkup(segment)}
    ${title('Задачи и критерии успеха', jobs.map(job => `<article class="galaxy-fact dossier-job"><div class="dossier-claim-head"><h4>${evidenceMarkup(job, `${segment.id}:job:${job.id}`)}</h4></div>${job.context ? dl([['Когда возникает задача', job.context]]) : ''}<h5>Успешный результат для клиента</h5>${list(job.criteria).length ? `<div class="dossier-criteria">${job.criteria.map(criterion => claim(criterion, `${segment.id}:criterion:${criterion.id}`, `${criterion.level ? note(criterion.level) : ''}${note([criterion.levelStatus === 'unconfirmed' ? 'порог — гипотеза' : '', criterion.priorityStatus === 'unconfirmed' ? 'важность требует проверки' : '', criterion.evidenceConflict ? 'источники расходятся' : ''].filter(Boolean).join(' · '))}`)).join('')}</div>` : note('Критерии успеха ещё не исследованы.')}</article>`).join(''))}
    ${list(segment.countries).length ? title('Подсегменты', segment.countries.map(country => claim(country, `${segment.id}:subsegment:${country.id}`, dl([['Особенность ситуации', country.sharperContext], ['Что запускает поиск решения', list(country.triggers).join(' · ')], ['Дополнительные критерии', list(country.addedCriteria).map(textOf).join(' · ')]]))).join('')) : ''}
    ${title('Что болит', list(segment.problems).map(problem => claim(problem, `${segment.id}:problem:${problem.id}`, note(problem.context || problem.description))).join(''))}
    ${title('Какими решениями пользуются сейчас', [...solvers.values()].map(row => `<article class="galaxy-fact"><button type="button" class="galaxy-fact-link" data-galaxy-select="competitor:${esc(row.id)}"><span>${esc(row.label)}</span><small>Открыть конкурента →</small></button>${evidenceFields(row,`${segment.id}:solver:${row.id}`,[['Причина выбора',row.whyHired||'Причина выбора ещё не установлена.']])}</article>`).join(''))}
    ${quantityMarkup(segment)}
    ${communicationOverview(segment, ctx)}
    ${title('Гипотезы изменений продукта', values.map(value => `<article class="galaxy-fact"><button type="button" class="galaxy-value-link" data-galaxy-value="${esc(value.id)}"><strong>${esc(value.label)}</strong><span>Открыть в развитии продукта →</span></button>${evidenceFields(value,`${segment.id}:value:${value.id}`,[['Боль клиента',value.description||value.pain],['Ожидаемый результат',value.expectedOutcome||value.outcome]])}</article>`).join(''))}
    ${title('Риски и непроверенные допущения', list(segment.risks).map(risk => riskMarkup(risk, `${segment.id}:risk:${risk.id}`)).join(''), 'Риски ещё не описаны.')}
    ${list(segment.sources).length ? evidenceControl(`${segment.id}:sources`, 'Источники сегмента', sourcesMarkup(segment.sources), `Все источники · ${segment.sources.length}`) : ''}
    ${title('Что уточнить о сегменте', movesMarkup(segment.moves))}`
}

const coverageWords = { varies: 'Зависит от сегмента', full: 'Закрывает задачу', complete: 'Закрывает задачу', partial: 'Закрывает часть задачи', none: 'Не закрывает задачу', unsupported: 'Не подтверждено', unknown: 'Покрытие не исследовано', unverified: 'Покрытие требует проверки' }
const priceKindWords = { subscription: 'Подписка', implementation: 'Внедрение', customization: 'Доработки', usage: 'Оплата использования', other: 'Другие расходы', unspecified: 'Вид расходов требует уточнения' }
const periodWords = { month: 'месяц', monthly: 'месяц', year: 'год', annual: 'год', yearly: 'год', once: 'разово', one_time: 'разово' }
function emptySection(entity, key, fallback) {
  const section = entity.researchSections?.[key]
  const state = typeof section === 'string' ? section : section?.status
  if (state === 'not_found') return `В изученных источниках сведений не найдено.${section?.scope ? ` Область поиска: ${textOf(section.scope)}` : ''} Это не означает, что их нет вообще.`
  if (state === 'unavailable') return 'Источники недоступны; вывод пока сделать нельзя.'
  return fallback
}

function researchLogMarkup(entity) {
  const sections = Object.entries(entity.researchSections || {}).filter(([, section]) => section.status && section.status !== 'not_researched')
  if (!sections.length) return ''
  const labels = { pricing: 'Стоимость', jobs: 'Задачи клиентов', messaging: 'Коммуникации', channels: 'Продвижение', complaints: 'Отзывы и жалобы', classification: 'Классификация', identity: 'Конкретные решения' }
  const states = { researched: 'Исследовано', not_found: 'В изученных источниках не найдено', unavailable: 'Источники недоступны' }
  return evidenceControl(`${entity.id}:research-log`, 'Источники и границы исследования', sections.map(([key, section]) => `<article class="galaxy-fact"><h4>${esc(labels[key] || section.label || key)}</h4>${dl([['Результат поиска', states[section.status] || status(section.status)], ['Дата проверки', section.checkedAt], ['Что искали', list(section.queries).join(' · ')], ['Ограничения поиска', section.limitations]])}${note(section.summary)}${sourcesMarkup(section.evidence)}</article>`).join(''), 'Границы исследования')
}

function priceComparison(competitor,ctx){
 const rootId=globalThis.__productGalaxySnapshot?.galaxy?.product?.id,products=list(ctx.communications?.nodes).filter(node=>node.type==='product'),product=products.find(node=>node.id===rootId)||products[0];
 const raw=product?.data?.pricing,ours=textOf(raw),ourSource=typeof raw==='object'?raw?.source||product?.source:product?.source;
 const rows=list(competitor.priceDetails).filter(row=>row.summary||row.amount!=null||row.amountRange),hasTheirs=rows.length||typeof competitor.pricing==='string'&&competitor.pricing.trim();
 if(!ours||!hasTheirs)return '';
 const priceText=row=>row.summary||[row.amountRange?`${row.amountRange.low??'Не уточнено'}–${row.amountRange.high??'Не уточнено'}`:row.amount,row.currency,row.period?'/ '+(periodWords[row.period]||row.period):'',row.billingUnit].filter(value=>value!==undefined&&value!==null&&value!=='').join(' ');
 const oursEvidence=sourceHref(ourSource)?evidenceControl(`${competitor.id}:compare-product-price`,'Цена своего продукта',note('Сохранённое описание. К нему привязан документ целиком; точный фрагмент не указан.')+sourceMarkup({source:ourSource}),ours):note(ours)+note('Источник описания цены не связан.');
 const theirs=rows.length?rows.map((row,index)=>`<p>${evidenceMarkup(row,`${competitor.id}:compare-price:${index}`,competitorText(priceText(row))!==priceText(row)?'Исходная формулировка в записи: '+priceText(row):'',competitorText(priceText(row)))}</p>`).join(''):`<p>${evidenceControl(`${competitor.id}:compare-price`,'Цена решения',sourceMarkup({source:competitor.source}),competitor.pricing)}</p>`;
 return `<section data-price-comparison><h2>Условия рядом</h2><p>Состав услуги, валюта и период могут различаться; сравните основания. Это сохранённые сведения, а не сегодняшняя проверка цен.</p><dl class="dossier-fields"><div><dt>${esc(product.label||'Свой продукт')}</dt><dd>${oursEvidence}</dd></div><div><dt>${esc(competitor.displayLabel||competitor.label)}</dt><dd>${theirs}</dd></div></dl></section>`
}

const competitorTopics=[['overview','Обзор'],['jobs','Задачи клиентов'],['choices','Выбор клиентами'],['economy','Цены и оплата'],['messages','Сообщения и каналы'],['research','Что уточнить']]
function sectionModel(){const sections=[];return {sections,add(id,topic,label,body,empty,missing=!body){sections.push({id,topic,label,missing,empty,content:body});return ''},content(id,topic,html){if(html)sections.push({id,topic,label:id==='references'?'Примеры интерфейса':'История исследования',content:html});return ''}}}
// Translate retained researcher prose; raw text and evidence stay beside the statement.
function competitorClaim(row,key,body=''){
 const raw=row?.label||row?.title||row?.name||row?.summary||'Основания утверждения',reading=competitorText(raw)
 return `<article class="galaxy-fact dossier-claim"><div class="dossier-claim-head"><strong>${evidenceMarkup(row,key,reading!==raw?'Исходная формулировка в записи: '+raw:'',reading)}</strong></div>${body}</article>`
}
function competitorNote(row,key,value){
 const raw=textOf(value),reading=competitorText(raw)
 return reading!==raw?`<p>${evidenceMarkup(row,key,'Исходная формулировка в записи: '+raw,reading)}</p>`:note(raw)
}
function renderCompetitorPage(competitor,ctx,overview,sections){
 if(ctx.topic&&!competitorTopics.some(([key])=>key===ctx.topic))return emptyState({kind:'unavailable',title:'Раздел конкурента не найден',actions:button({href:'#competitor/'+encodeURIComponent(competitor.id),label:'К обзору конкурента'})})
 const active=ctx.topic||'overview',classification=competitor.classification||{},gaps=sections.filter(section=>section.missing)
 const preview=competitorPreview(competitor),category=competitorCategory(competitor)
 const originals=dl([['Описание',competitor.description],['Обещание',competitor.landingBigJob],['Категория',competitor.solutionCategory?.label||competitor.category?.label],['Тип конкуренции',status(classification.kind||competitor.kind)]])
 const signalRows=[...list(competitor.priceDetails),...list(competitor.jobCoverage),...list(competitor.hiredFacts),...list(competitor.failures)].filter(row=>['mixed','contradicted'].includes(row.evidenceStatus)||row.evidenceConflict)
 const signals=signalRows.length?notice({kind:'warning',message:'Источники расходятся: '+signalRows.map(row=>competitorText(row.label||row.job||row.summary||'условия решения')).join('; ')+'. Сопоставьте основания перед решением.'}):''
 const description=preview.summary?`<p>${evidenceControl(`${competitor.id}:reading-description`,'Сохранённое описание решения',note('Формулировка из сохранённого исследования. Она не означает, что свойства сервиса проверены сегодня.')+originals+(competitor.source?sourceMarkup({source:competitor.source}):''),preview.summary)}</p>`:(!competitor.isCategory?note('Краткое описание ещё не записано. Сведения о задачах, выборе и условиях доступны в разделах сверху.'):'')
 const metadata=(category&&category!==(competitor.displayLabel||competitor.label)?note(category):'')+description+signals+overview
 const work=globalThis.ProductWork?.reading(competitor.id)||''
 const site=sourceHref(competitor.url)?button({href:sourceHref(competitor.url),label:'Открыть сайт',attributes:{target:'_blank',rel:'noopener noreferrer'}}):''

 const choices=readingList(list(competitor.considerationCases).map(c=>{const stages={selected:'Выбрали',rejected:'Отказались',considered:'Рассматривали',tried:'Пробовали',used:'Использовали',abandoned:'Перестали использовать'},stageNames=c.usageQualified===false?'Упоминание без подтверждённого использования':list(c.stages).map(stage=>stages[stage]||'Этап не уточнён').join(' · ');return {text:[stageNames,c.contextNote].filter(Boolean).join(' '),html:`<article>${note(stageNames||'Результат выбора не записан')}${note(c.contextNote)}${c.choiceScope==='compound'?note('Исходный ответ перечисляет несколько решений; этап выбора относится к этому ответу целиком.'):''}${list(c.personIds).map(id=>button({href:'#person/'+encodeURIComponent(id)+'/2',label:'Выбор респондента и источники'})).join('')}</article>`}}),{label:'Поиск по истории выбора'})
 const content=competitorTopics.map(([key])=>{
  const parts=sections.filter(section=>section.topic===key&&!section.missing).map(section=>({id:'competitor-'+section.id,title:section.label,content:section.content,attributes:{'data-dossier-section':section.id}}))
  if(key==='overview')parts.unshift({id:'competitor-overview',title:competitor.isCategory?'Что объединяет эти решения':'Что это за решение',content:metadata,attributes:{'data-dossier-section':'overview'}})
  if(key==='economy'){const comparison=priceComparison(competitor,ctx);if(comparison)parts.unshift({id:'competitor-price-comparison',title:'Условия рядом',content:comparison.replace('<h2>Условия рядом</h2>','')})}
  if(key==='choices'&&choices)parts.unshift({id:'competitor-consideration-cases',title:'Варианты выбора респондентов',content:choices,attributes:{'data-dossier-section':'consideration-cases'}})
  if(key==='research'&&gaps.length)parts.unshift({id:'competitor-gaps',title:'Каких сведений не хватает',content:`<ul>${gaps.map(section=>`<li><strong>${esc(section.label)}.</strong> ${esc(section.empty||'Сведения ещё не записаны.')}</li>`).join('')}</ul>`})
  if(key==='research'){
   parts.push({id:'competitor-reading-original',title:'Как составлено описание',content:disclosure({title:'Исходные формулировки',content:originals+(competitor.source?sourceMarkup({source:competitor.source}):'')})})
   if(work)parts.push({id:'competitor-own-work',title:'Сохранённая проверка',content:work})
  }
  return `<section data-competitor-panel="${key}"${key===active?'':' hidden'}>${parts.length?readingSections({sections:parts,contentsTitle:'В разделе'}):emptyState({kind:'first-use',title:'Сведения ещё не исследованы',description:'Сохранённые материалы и следующие проверки находятся во вкладке «Что уточнить».'})}</section>`
 }).join('')
 return detailLayout({header:pageHeader({title:competitor.displayLabel||competitor.label,className:'competitor-page-head',actions:site}),nav:topicNav({label:'Разделы конкурента',active,items:competitorTopics.map(([id,label])=>({id,label,attributes:{'data-atlas-route':`competitor/${encodeURIComponent(competitor.id)}/${id}`}}))}),content})
}

function normalizedCategoryDossier(competitor, ctx) {
  const model=sectionModel();const overview=`${competitor.alternative ? note(competitor.alternative.selection === 'tool' ? 'Здесь описан способ работы. Конкретный инструмент ещё не выбран.' : 'Клиент может поручить работу исполнителю. Конкретная компания или специалист ещё не выбраны.') : ''}${note('Сценарии относятся к разным задачам и сегментам. Условия и наблюдения приведены отдельно для каждого.')}${competitor.scenarios.map(s => model.add('scenario-'+s.id,'research',s.label,
    segmentChips(s.segmentIds, ctx) + dl([['Тип конкуренции в исходной записи', status(s.kind)], ['Задачи клиента', s.jobs.map(j=>j.label).join(' · ')]]) +
    s.contexts.map((c,i)=>claim({ ...c, label: c.segmentLabel }, `${competitor.id}:scenario:${s.id}:${i}`, dl([['Тип конкуренции', status(c.kind)], ['Почему выбирают', c.whyHired], ['Расходы этого сегмента', c.spendToday]]) )).join('') +
    evidenceFields(s,`${competitor.id}:scenario:${s.id}`,[['Условия в исходной записи',s.pricing],['Обещание',s.landingBigJob]]) +
    (s.discoveryPlaces.some(p=>p.role==='marketplace') ? dl([['Площадки поиска исполнителя',s.discoveryPlaces.filter(p=>p.role==='marketplace').map(p=>p.label).join(', ')]]) : '') +
    (s.discoveryPlaces.some(p=>p.role==='provider-example') ? dl([['Примеры поставщиков в исследовании',s.discoveryPlaces.filter(p=>p.role==='provider-example').map(p=>p.label).join(', ')]]) : '') +
    (s.mentionedSolutions.length ? note('Упомянутые решения:') + s.mentionedSolutions.map(n=>`<button type="button" class="galaxy-fact-link" data-galaxy-select="competitor:${esc(n.id)}">${esc(n.label)} →</button>`).join('') : '') +
    evidenceControl(`${competitor.id}:original:${s.id}`, 'Исходная запись исследования', note(s.originalLabel) + sourceMarkup({source:s.source}), 'Исходная запись')
  )).join('')}`
  return renderCompetitorPage(competitor,ctx,overview,model.sections)
}

// What the competitor's site promises: dated snapshot block; the messaging gap move refreshes it.
function landingSection(competitor) {
  return renderLandingBlock(competitor, { evidence: (row, key, text = row.quote) => evidenceMarkup({ ...row, label: row.quote }, key, '', text) })
}

export function renderCompetitorDossier(competitor, ctx) {
  if (competitor.scenarios?.length) return normalizedCategoryDossier(competitor, ctx)
  const classification = competitor.classification || {}
  const coverage = list(competitor.jobCoverage)
  const prices = list(competitor.priceDetails)
  const model=sectionModel();const overview=`${model.content('references','messages',competitorReferences(competitor,ctx))}
    ${competitor.isCategory ? note('Эта запись описывает несколько решений или способ их использования одним сегментом. Упомянутые продукты имеют собственные страницы; общие цены и наблюдения остаются у этой записи.') : ''}
    ${competitor.classificationCompatibility ? note(competitor.classificationCompatibility) : ''}
    ${competitor.classificationReview?.reason ? note('Основание категории: ' + competitor.classificationReview.reason) : ''}
    ${list(competitor.mentionedSolutions).length ? model.add('mentioned-solutions','overview','Какие решения упомянуты', list(competitor.mentionedSolutions).map(row => `<button type="button" class="galaxy-fact-link" data-galaxy-select="competitor:${esc(row.id)}">${esc(row.label)} →</button>`).join('')) : ''}
    ${list(competitor.mentionedIn).length ? model.add('mentioned-in','research','Упоминания в исследовании', note('Это ссылки из групповых записей. Само упоминание не подтверждает использование продукта сегментом или свойства всей группы.') + list(competitor.mentionedIn).map(row => `<button type="button" class="galaxy-fact-link" data-galaxy-select="competitor:${esc(row.id)}">${esc(row.label)} →</button>`).join('')) : ''}
    ${list(competitor.segmentIds).length?model.add('segment-links','choices','Связанные сегменты',note('Это связи из исследования, а не подтверждённые покупки.')+segmentChips(competitor.segmentIds,ctx)):''}
    ${model.add('classification','choices','Почему включён в сравнение', (classification.rationale?`<p>${evidenceMarkup(classification, `${competitor.id}:classification`,classification.rationale,competitorText(classification.rationale))}</p>`:'') + list(classification.bySegment).map((row, i) => competitorClaim({ ...row, label: status(row.kind) }, `${competitor.id}:competition:${i}`, note(competitorText(row.rationale)) + (row.rationale&&competitorText(row.rationale)!==row.rationale?evidenceControl(`${competitor.id}:competition-original:${i}`,'Исходное пояснение',note(row.rationale),'Исходное пояснение'):'') + segmentChips(row.segmentId ? [row.segmentId] : [], ctx))).join(''),'Почему решение включено в сравнение — ещё не описано.')}
    ${model.add('jobs','jobs','Для каких задач рассматривают', coverage.map((row, i) => competitorClaim({ ...row, label: textOf(row.job) || row.label }, `${competitor.id}:job:${row.jobId || i}`, `<span class="dossier-coverage">${esc(coverageWords[row.coverage] || 'Покрытие требует проверки')}</span>${competitorNote(row,`${competitor.id}:job-explanation:${i}`,row.explanation)}${segmentChips(row.segmentIds, ctx)}${list(row.bySegment).length > 1 ? row.bySegment.map(scope => `<div class="dossier-scope"><b>${esc(scope.segmentLabel)}</b><p>${evidenceMarkup(scope,`${competitor.id}:job:${row.jobId}:${scope.segmentId}`,'',coverageWords[scope.coverage]||'Покрытие требует проверки')}</p>${competitorNote(scope,`${competitor.id}:job-explanation:${i}:${scope.segmentId}`,scope.explanation)}</div>`).join('') : ''}`)).join(''), 'Задачи и ограничения решения ещё не проверены.')}
    ${model.add('pricing','economy','Стоимость и условия', prices.map((row, i) => {
      const amount = row.amountRange ? `${row.amountRange.low.toLocaleString('ru-RU')}–${row.amountRange.high.toLocaleString('ru-RU')} ${row.currency || ''}`.trim() : row.amount != null ? `${typeof row.amount === 'number' ? row.amount.toLocaleString('ru-RU') : textOf(row.amount)} ${row.currency || ''}`.trim() : ''
      return competitorClaim({ ...row, label: row.label || 'Стоимость' }, `${competitor.id}:price:${i}`, dl([['Вид расходов', priceKindWords[row.priceKind] || 'Стоимость'], ['Сумма', amount], ['Период', periodWords[row.period] || row.period], ['Единица тарификации', row.billingUnit || (row.unit && row.unit !== 'money' ? row.unit : '')], ['Включено', Array.isArray(row.includes) ? row.includes.join(' · ') : row.includes], ['Отдельные расходы', Array.isArray(row.excludes) ? row.excludes.join(' · ') : row.excludes]]) + competitorNote(row,`${competitor.id}:price-summary:${i}`,row.summary) + segmentChips(row.segmentIds, ctx))
    }).join('') || (typeof competitor.pricing==='string'?note(competitor.pricing):''), emptySection(competitor, 'pricing', 'Тарифы и дополнительные затраты ещё не проверены. Это не означает, что цена не публикуется.'))}
    ${model.add('hired-facts','choices','Причины выбора в материалах', list(competitor.hiredFacts).filter(row => row.whyHired).map((row, i) => competitorClaim({ ...row, label: row.segmentLabel }, `${competitor.id}:hired:${i}`, competitorNote(row,`${competitor.id}:hired-reading:${i}`,row.whyHired))).join(''), 'Причины выбора ещё не подтверждены данными клиентов.')}
    ${model.add('failures','economy','Ограничения и жалобы', list(competitor.failures).map((row, i) => competitorClaim(row, `${competitor.id}:failure:${row.id || i}`, competitorNote(row,`${competitor.id}:failure-reading:${i}`,row.context || row.explanation))).join(''), emptySection(competitor, 'complaints', 'Отзывы и жалобы ещё не исследованы. Отсутствие записей не означает отсутствия проблем.'))}
    ${model.add('messages','messages','Обещание на сайте', landingSection(competitor), emptySection(competitor, 'messaging', 'Сайт ещё не снят: нет датированного снимка с обещаниями конкурента.'), !competitor.landing && !list(competitor.messaging).some(row => row.quote && (row.formulaKey || row.jobId || row.job)))}
    ${list(competitor.researchSections?.messaging?.findings).some(row=>textOf(row.statement))?model.add('messaging-findings','messages','Что заметили при изучении сервиса', list(competitor.researchSections?.messaging?.findings).filter(row => textOf(row.statement) || typeof row.statement === 'string').map((row, i) => competitorClaim({ ...row, label: row.channel || row.job || 'Наблюдение из исследования' }, `${competitor.id}:messaging-finding:${i}`, note(row.statement))).join(''), ''):''}
    ${model.add('channels','messages','Каналы продвижения', list(competitor.channels).map((row, i) => competitorClaim({ ...row, label: row.label || row.name || row.channel }, `${competitor.id}:channel:${row.id || i}`, dl([['Как использует канал', row.tactic || row.description], ['Сообщение', row.message]]))).join(''), emptySection(competitor, 'channels', 'Каналы привлечения клиентов ещё не исследованы.'))}
    ${model.content('research-log','research',researchLogMarkup(competitor))}
    ${list(competitor.moves).length?model.add('next-actions','research','Следующие проверки', movesMarkup(competitor.moves)):''}`
  return renderCompetitorPage(competitor,ctx,overview,model.sections)
}

// Product-specific wording stays in saved data; the existing claim/source components
// retain visible qualifications and on-demand provenance.
const positioningWarning = row => ['mixed', 'conflicting', 'contradicted'].includes(row?.evidenceStatus)
  ? notice({kind:'warning',message:row.evidenceStatus === 'contradicted' ? 'В источниках есть возражения.' : 'Источники расходятся.'}) : ''
const advantageContent = (positioning, productId) => list(positioning.advantages).map((row, i) => readingSection({
  level:3, title:row.title || row.label || 'Заявленное преимущество',
  content:(row.description ? prose(row.description, text => evidenceMarkup(row, `${productId}:advantage:${row.id || i}`, '', text)) : `<p>${evidenceMarkup(row, `${productId}:advantage:${row.id || i}`, '', 'Источники преимущества')}</p>`)
    + prose(row.qualification) + positioningWarning(row)
})).join('')
export function renderProductAdvantages(positioning = {}, productId = 'product') {
  return list(positioning.advantages).length ? readingSection({id:'product-positioning-advantages',
    title:'Опоры ценности и заявленные преимущества',content:advantageContent(positioning,productId),
    attributes:{'data-dossier-section':'positioning-advantages'}}) : ''
}
const positioningMessages = (rows, productId, kind) => rows.map((item, i) => {
  const row = typeof item === 'string' ? {message:item} : item
  const text = row.message || row.label || row.title || row.tactic
  return readingSection({level:3,title:row.title || row.channel || row.surface || 'Сохранённое сообщение',
    content:prose(text, text => evidenceMarkup(row, `${productId}:positioning-${kind}:${row.id || i}`, '', text))
      + dl([['Где используется',row.surface || row.channel],['Для кого',row.audience],['Статус',row.status ? status(row.status) : '']])
      + prose(row.qualification) + positioningWarning(row)
      + (sourceHref(row.url) ? `<p>${textLink({label:'Открыть страницу ↗',href:sourceHref(row.url),attributes:{target:'_blank',rel:'noopener noreferrer'}})}</p>` : '')})
}).join('')

// Saved delivery brief: fields and qualifications come from stored data only.
export function deliveryBriefMarkup(brief, productId = 'product') {
  if (!brief || typeof brief !== 'object') return ''
  const payNote = brief.paymentObserved === true ? 'Оплата наблюдалась в сохранённых материалах' : brief.paymentObserved === false ? 'В прочитанной переписке подтверждение оплаты не найдено' : ''
  const mustKeep = list(brief.mustKeep).filter(Boolean)
  const openQuestions = list(brief.openQuestions).filter(Boolean)
  const assets = list(brief.assets).filter(row => row && row.title)
  const references = list(brief.references).filter(row => row && row.title)
  const facts = [
    ['Аудитория первой страницы', brief.firstAudience],
    ['Сообщение', brief.message],
    ['Последовательность', brief.sequence],
    ['Согласованный объём', brief.agreedScope],
    ['Первая версия', brief.firstVersionPromised],
    ['Оплата поручения', payNote],
  ].filter(([, value]) => value && String(value).trim())
  const sourceRows = [brief.currentSource && { source: brief.currentSource, title: 'Актуальный источник брифа' }, brief.source && { source: brief.source, title: 'Источник извлечения' }, brief.report && { source: brief.report, title: 'Отчёт' }].filter(Boolean)
  const firstVersionRaw = brief.firstVersionSource && typeof brief.firstVersionSource === 'object' ? brief.firstVersionSource : null
  const firstVersion = firstVersionRaw ? { ...firstVersionRaw, quote: firstVersionRaw.quote || firstVersionRaw.excerpt } : null
  const body = `${brief.scopeConflict === true ? notice({ kind: 'warning', message: 'В источниках есть расхождение об объёме поручения; оно не разрешено.' }) : ''}
    ${dl(facts)}
    ${mustKeep.length ? `<h4>Обязательные элементы</h4><ul>${mustKeep.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    ${openQuestions.length ? `<h4>Открытые вопросы</h4><ul>${openQuestions.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    ${assets.length ? `<h4>Материалы для работы</h4>${assets.map(row => `<p>${esc(row.title)}${row.status ? ` — ${esc(row.status)}` : ''}${sourceHref(row.url || row.source) ? ` <a class="dossier-touchpoint-link" href="${esc(sourceHref(row.url || row.source))}" target="_blank" rel="noopener noreferrer">Открыть ↗</a>` : ''}</p>`).join('')}` : ''}
    ${references.length ? `<h4>Референсы</h4>${references.map(row => `<p>${esc(row.title)}${row.purpose ? ` — ${esc(row.purpose)}` : ''}${sourceHref(row.url || row.source) ? ` <a class="dossier-touchpoint-link" href="${esc(sourceHref(row.url || row.source))}" target="_blank" rel="noopener noreferrer">Открыть ↗</a>` : ''}</p>`).join('')}` : ''}
    ${firstVersion || sourceRows.length ? evidenceControl(`${productId}:delivery-brief`, 'Источники брифа', `${firstVersion ? sourceMarkup(firstVersion) : ''}${sourceRows.map(row => sourceMarkup(row)).join('')}`, 'Источники рабочего брифа') : ''}`
  return body
}

// Verification questions are passport claims to check; they do not replace fundamental risks.
function verificationQuestionsMarkup(questions, productId = 'product') {
  return list(questions).filter(row => row && row.title).map((row, index) => claim(
    { ...row, label: row.title, evidence: list(row.sources).map(source => typeof source === 'string' ? { source } : { source: source.source || source.url, title: source.title, quote: source.excerpt || source.quote, author: source.author }) },
    `${productId}:verification:${row.id || index}`,
    `${row.qualification ? note(row.qualification) : ''}${prose(row.description)}`
  )).join('')
}

// Development ideas use the same list entry and document composition as other objects.
const developmentKinds={feature:'Функция',communication:'Коммуникация',messaging:'Коммуникация',positioning:'Позиционирование',channel:'Канал',service:'Сервис',value:'Гипотеза ценности'}
const developmentNodes=(product,ctx)=>list(product.development?.nodes).length?product.development.nodes:list(ctx.values)
export function developmentRoute(id='',segment='') {
  return '#product/development'+(id?'/'+encodeURIComponent(id):'')
}
export function renderDevelopmentList(product,ctx={}) {
 const nodes=developmentNodes(product,ctx)
 return nodes.length?`<div class="development-reading-list">${nodes.map(node=>summaryCard({title:node.label,href:developmentRoute(node.id),meta:`<p>${badge({label:status(node.status)})}</p>`,attributes:{'data-development-node':node.id},content:(node.description||node.pain?`<p>${evidenceMarkup(node,`${product.id}:development:${node.id}:description`,'',node.description||node.pain)}</p>`:'')+(node.expectedOutcome||node.outcome?factLine({label:'Ожидаемый результат',value:evidenceMarkup(node,`${product.id}:development:${node.id}:outcome`,'',node.expectedOutcome||node.outcome)}):'')})).join('')}</div>`:emptyState({kind:'first-use',title:'Идей развития пока нет',description:'Здесь появятся сохранённые гипотезы изменений продукта и способы их проверки.'})
}
export function renderDevelopmentIdea(product,ctx={}) {
  const nodes=developmentNodes(product,ctx),node=nodes.find(item=>item.id===ctx.ideaId),back=button({label:'← Все идеи',href:developmentRoute()})
  if(!node)return detailLayout({header:ProductTabs.header(product,'development',{title:'Идея развития не найдена',workspaceName:ctx.workspaceName,back,backTight:true}),nav:ProductTabs.render('development'),content:emptyState({kind:'unavailable',description:'Возможно, запись удалена или ссылка устарела. Вернитесь к списку идей.'})})
  const key=`${product.id}:development:${node.id}`,fields=[['Проблема',node.description||node.pain],['Ожидаемый результат',node.expectedOutcome||node.outcome]]
  const dependencyWarnings=list(node.dependencyIssues).map(textOf)
  if(list(node.unresolvedDependencies).length)dependencyWarnings.push('Часть связей ведёт к идеям, которых нет в списке. Порядок реализации требует уточнения.')
  const dependencies=list(node.dependsOn).length?`<div class="os-actions">${node.dependsOn.map(raw=>{const id=typeof raw==='string'?raw:raw.id,parent=nodes.find(item=>item.id===id);return parent?button({label:parent.label,href:developmentRoute(id),attributes:{'data-development-dependency':id}}):note('Связанная идея не найдена.')}).join('')}</div>`:note('Зависимости не указаны.')
  const sections=[{id:'idea-outcome',title:'Идея и ожидаемый результат',content:factLine({label:'Изменение',value:esc(developmentKinds[node.kind]||'Гипотеза изменения')})+`<p>${badge({label:status(node.status)})}</p>`+proseFacts({items:fields.map(([label,value],i)=>({label,value:value?evidenceMarkup(node,`${key}:${i}`,'',value):esc(label==='Проблема'?'Проблема ещё не описана.':'Ожидаемый результат ещё не описан.')}))})},
    {id:'idea-audience',title:'Кому может помочь',content:list(node.segmentIds).length?`<div class="os-actions">${node.segmentIds.map(id=>{const segment=ctx.segment?.(id);return segment?button({label:segment.displayLabel||segment.label,href:'#segment/'+encodeURIComponent(id)}):note('Связанный сегмент не найден.')}).join('')}</div>`:note('Целевые сегменты ещё не определены.')},
    {id:'idea-steps',title:'Шаги реализации',content:list(node.steps).length?`<ol>${node.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:note('Шаги реализации ещё не записаны.')},
    {id:'idea-dependencies',title:'Связанные идеи',content:proseFacts({items:[{label:'Для реализации нужны',value:dependencies},...(dependencyWarnings.length?[{label:'Что уточнить в связях',value:notice({kind:'warning',message:dependencyWarnings.join(' ')})}]:[])]})+(list(node.unresolvedDependencies).length?disclosure({title:'Сохранённые связи, требующие уточнения',content:`<ul>${node.unresolvedDependencies.map(raw=>`<li>${esc(textOf(raw)||raw)}</li>`).join('')}</ul>`}):'')},
    {id:'idea-check',title:'Проверка идеи',content:proseFacts({items:[{label:'Что проверить прежде всего',value:node.riskiestPart?evidenceMarkup(node,`${key}:risk`,'',node.riskiestPart):esc('Главный риск гипотезы ещё не указан.')}]})+(globalThis.ProductWork?.reading(node.id)||'')+movesMarkup(node.moves)}]
  return detailLayout({className:'development-idea-page',header:ProductTabs.header(product,'development',{title:node.label,workspaceName:ctx.workspaceName,back,backTight:true}),nav:ProductTabs.render('development'),content:readingSections({sections,contentsTitle:'В идее'})})
}

export function renderProductDossier(product, ctx) {
  if(ctx.topic==='development'&&ctx.ideaId)return renderDevelopmentIdea(product,ctx)
  const contents=[]
 const section=(id,topic,label,body,empty)=>{if(ctx.topic&&ctx.topic!==topic)return '';contents.push({id:'product-'+id,label});return readingSection({id:'product-'+id,title:label,content:body||note(empty||'Этот раздел ещё не исследован.'),attributes:{'data-dossier-section':id}})}
  const description = product.description || {}
  const positioning = product.positioning || {}
  const stages = { idea: 'Идея', has_users: 'Есть пользователи', has_revenue: 'Есть выручка', revenue: 'Есть выручка', scaling: 'Масштабирование' }
  const messages = list(positioning.touchpoints)
  const hasPositioning = positioning.summary || list(positioning.jobs).length || list(positioning.segments).length || list(positioning.advantages).length || messages.length || list(positioning.channels).length || positioning.qualification || list(positioning.evidence).length
  const savedNodeData = (ctx.communications?.nodes || []).find(node => node.id === product.id)?.data || {}
  const verificationQuestions = list(savedNodeData.verificationQuestions)
  const deliveryBrief = savedNodeData.deliveryBrief
  const content = `${ctx.topic?'':header(product,'ВАШ ПРОДУКТ',ctx)+productHierarchy(product,ctx)}
    ${section('description','overview','Что делает продукт', evidenceFields(description,`${product.id}:description`,[['Решение',description.what||product.summary],['Для кого',description.forWhom],['Результат для клиента',description.outcome]]) + (!description.what && !product.summary ? note('Описание ещё не заполнено. OS setup должен зафиксировать, для кого продукт, какую задачу решает и какой результат даёт.') : ''))}
    ${section('goals','goals','Цель бизнеса', prose(product.businessGoal), 'Цель бизнеса ещё не записана.')}
    ${product.goalRead ? section('goal-check','goals','Ближайшая проверка цели', prose(product.goalRead)) : ''}
    ${section('constraints','goals','Ограничения и доступ к данным', (prose(product.constraints) || note('Ограничения ещё не записаны.')) + (product.stage ? dl([['Стадия продукта',stages[product.stage] || product.stage]]) : ''), 'Ограничения ещё не записаны.')}
    ${verificationQuestions.length ? section('verification-questions','goals','Утверждения для проверки', verificationQuestionsMarkup(verificationQuestions, product.id)) : ''}
    ${section('positioning','positioning','Текущее позиционирование',
      (prose(positioning.summary, text => evidenceMarkup(positioning, `${product.id}:positioning`, '', text)) || note(hasPositioning ? 'Формулировка позиционирования ещё не записана.' : 'Позиционирование ещё не записано.'))
      + (positioning.summary && positioning.status==='founder_claim' ? dl([['Статус формулировки','Формулировка владельца.']]) : '')
      + prose(positioning.qualification) + positioningWarning(positioning)
      + (!positioning.summary && list(positioning.evidence).length ? `<p>${evidenceMarkup(positioning, `${product.id}:positioning-context`, '', 'Источники позиционирования')}</p>` : ''))}
    ${list(positioning.jobs).length ? section('positioning-jobs','positioning','На каких задачах строится', positioning.jobs.map(row => prose(textOf(row))).join('')) : ''}
    ${list(positioning.segments).length ? section('positioning-audience','positioning','Для кого сформулировано', positioning.segments.map(row => `<p>${row.id ? textLink({label:textOf(row),href:'#segment/'+encodeURIComponent(row.id)}) : esc(textOf(row))}</p>`).join('')) : ''}
    ${list(positioning.advantages).length ? section('positioning-advantages','positioning','Опоры ценности и заявленные преимущества', advantageContent(positioning,product.id)) : ''}
    ${messages.length ? section('positioning-messages','positioning','Сообщения и места использования',positioningMessages(messages,product.id,'message')) : ''}
    ${list(positioning.channels).length ? section('positioning-channels','positioning','Сообщения в каналах',positioningMessages(positioning.channels,product.id,'channel')) : ''}
    ${list(product.fundamentalRisks).length ? section('fundamental-risks','goals','Критические допущения продукта', `<div class="product-risk-grid">${product.fundamentalRisks.map(risk => riskMarkup(risk, `${product.id}:risk:${risk.id}`)).join('')}</div>`) : ''}
    ${section('development','development','Идеи развития',renderDevelopmentList(product,ctx))}
    ${deliveryBrief ? section('delivery-brief','development','Рабочий бриф доставки', deliveryBriefMarkup(deliveryBrief, product.id)) : ''}
    ${section('next-actions','actions','Что уточнить о продукте', movesMarkup(product.moves))}`
  return ctx.topic ? detailLayout({className:'product-topic-page',header:ProductTabs.header(product,ctx.topic,{workspaceName:ctx.workspaceName}),nav:ProductTabs.render(ctx.topic),content:contents.length>1?readingLayout({content,contents,contentsTitle:'В разделе продукта'}):content}) : content
}

function productHierarchy(product, ctx) {
  const products = ctx.communications?.products || []
  const current = products.find(n => n.id === product.id)
  const parent = products.find(n => n.id === current?.parentId)
  const children = products.filter(n => n.parentId === product.id)
  return title('Продукт и его направления', (parent ? note(`В составе продукта «${parent.label}»`) : '')
    + (children.length ? children.map(n => `<article class="galaxy-fact"><strong>${esc(n.label)}</strong><p>Направление продукта «${esc(product.label)}»</p></article>`).join('') : note('Отдельные направления этого продукта ещё не добавлены.'))
    + `<button type="button" class="ghost-button" data-product-structure="${esc(product.id)}">Настроить направления</button>`)
}
function competitorReferences(competitor, ctx) {
  const comm = ctx.communications
  const refs = (comm?.nodes || []).filter(n => n.type === 'reference' && comm.edges.some(e => e.from === n.id && e.to === competitor.id && e.type === 'reference_for'))
  return refs.length ? title('Примеры коммуникаций', refs.map(n => { const url = sourceHref(n.data?.url); return `<article class="galaxy-fact"><strong>${esc(n.label)}</strong>${url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Открыть пример ↗</a></p>` : ''}${note(n.data?.note || '')}</article>` }).join('')) : ''
}
function communicationOverview(segment, ctx) {
  const comm = ctx.communications
  const paths = (comm?.nodes || []).filter(n => n.type === 'journey' && comm.edges.some(e => e.from === n.id && e.type === 'journey_segment' && e.to === segment.id) && (!comm.scope || comm.edges.some(e => e.from === n.id && e.type === 'journey_offer' && comm.offerIds.includes(e.to))))
  const channels = list(segment.channels).map((channel, i) => claim(channel, `${segment.id}:channel:${channel.id || i}`, dl([['Способ обращения', channel.tactic], ['Сообщение', channel.message]]))).join('')
  const talk = segment.communication || {}
  const messages = ['value', 'fears', 'competitorCounters'].flatMap(key => list(talk[key]))
  const plans = paths.map(n => {
    const contacts = comm.edges.filter(e => e.from === n.id && e.type === 'has_contact').map(e => comm.nodes.find(c => c.id === e.to)).filter(Boolean)
    return `<article class="galaxy-fact"><h4>${esc(n.label)}</h4>${note(n.data?.outcome || '')}<small>План контактов · требует проверки</small>${contacts.length ? `<ul>${contacts.map(c => `<li><strong>${esc(c.data?.surface || c.label)}</strong>${note(c.data?.benefit || 'Пока не записано, чем этот контакт поможет клиенту.')}</li>`).join('')}</ul>` : note('Конкретные контакты ещё не добавлены.')}</article>`
  }).join('')
  const hypotheses = messages.length ? '<h4>Что можем предложить клиенту</h4>' + messages.map((line, i) => claim({ ...line, label: line.title || line.message }, `${segment.id}:message:${i}`, dl([['Сообщение', line.title ? line.message : ''], ['Почему может сработать', line.why], ['Для кого', line.role]]))).join('') : ''
  return title('Где искать клиентов и что им предложить', channels + plans + hypotheses || note('Пока не записано, где можно встретить этих клиентов и что им показать. Например: статья в поиске, пост в сообществе или демонстрация продукта.'))
}

const availabilityNames={documented_vendor_claim:'Описано поставщиком; в аккаунте не проверялось',documented:'Описано в источнике',observed:'Наблюдается в использовании',planned:'Запланировано',tested:'Проверено',live:'Заявлено как доступное'};
// Statement stays short; the saved mechanism, job and boundaries live in the disclosure.
// Source bundles may carry quotes as `quote` or `excerpt`; both render as saved excerpts.
const capabilitySourceRow=row=>row&&(row.source||row.url)?{source:row.source||row.url,title:row.title,author:row.author,quotes:[row.quote,row.excerpt].filter(Boolean)}:null;
export function renderProductCapability(c,i=0,sourced=(text,rows,options)=>sourceNote({text,title:options.title,content:options.notes+sourceList({entries:rows.filter(row=>row?.source).map(row=>({title:row.title||'Источник описания',author:row.author,quotes:row.quotes,href:/^https?:\/\//.test(row.source)?row.source:/^(sources|reports|research)\//.test(row.source)&&!row.source.includes('..')?'/source?path='+encodeURIComponent(row.source):'',meta:row.source}))})})){
 const bundleSources=[{source:c.source,author:c.attribution},...(Array.isArray(c.auditSources)?c.auditSources:[]).map(capabilitySourceRow),...(Array.isArray(c.sources)?c.sources:[]).map(capabilitySourceRow)].filter(Boolean);
 const detailFacts=[['Для какой задачи',c.customerJob],['Сообщённый результат',c.reportedOutcome],['Ограничения',c.scopeNote],['Доступность',availabilityNames[c.availability]||c.availability]];
 const items=detailFacts.filter(([,value])=>value&&String(value).trim()).map(([label,value])=>({label,value:esc(value)}));
 const detail=(c.mechanism&&String(c.mechanism).trim()?`<p>${esc(c.mechanism)}</p>`:'')+(items.length?proseFacts({items}):'');
 const sourceNotes=proseFacts({items:[['Откуда описание',c.attribution],['Ограничения',c.scopeNote||'Границы возможности не уточнены.']].filter(([,value])=>value&&String(value).trim()).map(([label,value])=>({label,value:esc(value)}))});
 const provenance=sourced('Источники описания',bundleSources,{title:'Основание возможности',notes:sourceNotes,attributes:{'data-product-source':c.source||''}});
 return `<article class="capability"><span class="capability-number" aria-hidden="true">${i+1}</span><div>${disclosure({title:c.statement,className:'capability-detail capability-statement',bodyClassName:'os-reading-prose',content:detail+`<p>${provenance}</p>`})}</div></article>`;
}
