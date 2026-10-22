import {competitorPreview,competitorCategory} from './competitor-preview.js'
import { filterBar, field, button, textLink, topicNav, notice } from './ui-components.js'
import { renderPromiseMap, scopePromiseMap, expandSegmentIds } from './competitor-landing.js'
// Atlas competitor collection: competition types contain solution categories and named solution cards.
// Category overviews remain compact records; every card uses the shared reading surface.
import { iconMarkup } from './galaxy-icons.js'

const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const KIND_ORDER = ['direct', 'indirect', 'diy', 'do_nothing']
const GROUP_ORDER = ['contextual', ...KIND_ORDER, 'unclassified']
const GROUP_TITLES = { contextual: 'Категории решений', direct: 'Прямые конкуренты', indirect: 'Косвенные альтернативы', diy: 'Своими руками', do_nothing: 'Без отдельного решения', unclassified: 'Тип конкуренции не определён' }
const GROUP_HINTS = {
  contextual: 'Одна категория объединяет решения и сценарии их использования. Тип конкуренции уточняется для каждого сценария.',
  direct: 'Связь с той же задачей или её этапом. Основания — в карточке решения.',
  indirect: 'Закрывают соседние задачи или помогают в процессе. Это не означает замену всего продукта.',
  diy: 'Клиент собирает решение самостоятельно.',
  do_nothing: 'Клиент откладывает решение или сохраняет текущий порядок.',
  unclassified: 'Связь с продуктом ещё нужно уточнить.',
}
const PRICE_WORDS = { free: 'бесплатно', cheap: 'дёшево', mid: 'средняя цена', premium: 'дорого', unknown: 'Нет данных о цене' }
const TIER_ORDER = { free: 0, cheap: 1, mid: 2, premium: 3, unknown: 4 }
const SORT_WORDS = { segments: 'по числу сегментов в группе', name: 'по имени в группе' }
const COLLAPSE_THRESHOLD = 20

let options = null
let galaxy = null
let signature = ''
let toolbarSignature = ''
let deckSignature = ''
let filters = { family: 'all', tier: 'all', segments: new Set() }
let sortKey = 'segments',visibleLimit=20,filtersOpen=false
// 'list' = grouped cards; 'map' = promise map. Kept in the hash like the other filters.
let view='list',mapSignature=''
function readFilters(){if(!location.hash.startsWith('#hangar'))return;const q=new URLSearchParams(location.hash.split('?')[1]||'');if(q.has('segment')){q.delete('segment');history.replaceState(history.state,'','#hangar'+(q.size?'?'+q:''))}filters={family:GROUP_ORDER.includes(q.get('family'))?q.get('family'):'all',tier:Object.hasOwn(TIER_ORDER,q.get('tier'))?q.get('tier'):'all',segments:new Set()};sortKey=q.get('sort')==='name'?'name':'segments';visibleLimit=Math.max(20,Math.min(1000,Number(q.get('limit'))||20));view=q.get('view')==='map'?'map':'list'}
function writeFilters(){if(!location.hash.startsWith('#hangar'))return;const q=new URLSearchParams();if(filters.family!=='all')q.set('family',filters.family);if(filters.tier!=='all')q.set('tier',filters.tier);for(const id of filters.segments)q.append('segment',id);if(sortKey!=='segments')q.set('sort',sortKey);if(visibleLimit>20)q.set('limit',visibleLimit);if(view==='map')q.set('view','map');history.replaceState(history.state,'','#hangar'+(q.size?'?'+q:''))}
let groupState = new Map()
const notesState = new Map()
let groupDefaultsFor = ''
let panelObserver = null
let bound = false
let active = false

// ---------------------------------------------------------------- data helpers

// unknown kinds sit with alternatives when counted; the grouping keeps them apart
function kindOf(competitor) {
  return KIND_ORDER.includes(competitor.kind) ? competitor.kind : 'indirect'
}

function competitionGroupOf(competitor) {
  if (roster().some(item => item.scenarios?.length && categoryOf(item).id === categoryOf(competitor).id)) return 'contextual'
  return competitor.kind === 'unknown' ? 'unclassified' : kindOf(competitor)
}

function isCategory(competitor) {
  return competitor.isCategory === true || [competitor.entityKind, competitor.entityType].includes('category')
}

function isBehaviour(competitor) {
  return [competitor.entityKind, competitor.entityType].includes('behaviour')
}

function categoryOf(competitor) {
  const category = competitor.solutionCategory || competitor.category
  if (typeof category === 'string' && category.trim()) return { id: category.trim(), label: competitorCategory(competitor) || 'Категория решения не указана' }
  if (category?.label) return { id: String(category.id || category.label), label: competitorCategory(competitor) || 'Категория решения не указана' }
  return { id: 'uncategorized', label: 'Категория решения не указана' }
}

function segmentName(segment) {
  const value = String(segment.shortLabel || segment.displayLabel || segment.label || '')
  const label = value.replace(/\bunknown\b\s*[:—–-]?\s*/gi, '').split(/\s*:\s+|\s+[—–]\s+/)[0].trim()
  return value || 'Сегмент без названия'
}

function segmentTitle(segment) {
  return segment.fullLabel || segment.label || segment.displayLabel || ''
}

function plural(count, words) {
  const mod100 = count % 100
  return `${count} ${words[mod100 >= 11 && mod100 <= 14 ? 2 : count % 10 === 1 ? 0 : count % 10 >= 2 && count % 10 <= 4 ? 1 : 2]}`
}

function countSummary(competitors) {
  const count = { solution: 0, category: 0, normalized: 0, diy: 0, inaction: 0 }
  for (const competitor of competitors) {
    const kind = kindOf(competitor)
    count[competitor.alternative ? 'solution' : competitor.scenarios?.length ? 'normalized' : isCategory(competitor) ? 'category' : kind === 'do_nothing' ? 'inaction' : kind === 'diy' || isBehaviour(competitor) ? 'diy' : 'solution']++
  }
  return [
    count.solution && plural(count.solution, ['решение', 'решения', 'решений']),
    count.normalized && plural(count.normalized, ['категория', 'категории', 'категорий']),
    count.category && plural(count.category, ['групповая запись', 'групповые записи', 'групповых записей']),
    count.diy && plural(count.diy, ['самостоятельный способ', 'самостоятельных способа', 'самостоятельных способов']),
    count.inaction && plural(count.inaction, ['сценарий бездействия', 'сценария бездействия', 'сценариев бездействия']),
  ].filter(Boolean).join(' · ') || 'Нет записей'
}

function rosterKey(competitor) {
  return `${competitor.id}|${competitor.kind}|${competitor.priceTier}`
}

function sharedJobCount(competitor) {
  return new Set((competitor.appearances || []).flatMap(item => (item.sharedJobs || []).map(job => job.id))).size
}

function segmentsOf(competitor) {
  const ids = new Set(competitor.segmentIds || [])
  return (galaxy?.segments || []).filter(segment => ids.has(segment.id))
}

function roster() {
  return galaxy?.competitors || []
}

function selectedSegmentScope() {
  return expandSegmentIds(filters.segments, [...(galaxy?.segments || []), ...(galaxy?.subSegments || [])])
}

function matchesFilters(competitor) {
  if (filters.family !== 'all' && (competitor.scenarios?.length ? !scenarioRows(competitor).length : kindOf(competitor) !== filters.family && !(filters.family === 'unclassified' && competitor.kind === 'unknown'))) return false
  if (filters.tier !== 'all' && (competitor.priceTier || 'unknown') !== filters.tier) return false
  if (filters.segments.size) {
    const segmentIds = new Set(selectedSegmentScope())
    if (!(competitor.segmentIds || []).some(id => segmentIds.has(id))) return false
  }
  return true
}

function compare(a, b) {
  if (sortKey === 'name') return String(a.label).localeCompare(String(b.label), 'ru')
  if (sortKey === 'tier') {
    const delta = (TIER_ORDER[a.priceTier] ?? 4) - (TIER_ORDER[b.priceTier] ?? 4)
    return delta || String(a.label).localeCompare(String(b.label), 'ru')
  }
  const delta = (b.segmentIds?.length || 0) - (a.segmentIds?.length || 0) || sharedJobCount(b) - sharedJobCount(a)
  return delta || String(a.label).localeCompare(String(b.label), 'ru')
}

function filtersActive() {
  return filters.family !== 'all' || filters.tier !== 'all' || filters.segments.size > 0
}

function groupOpen(family, total) {
  if (groupState.has(family)) return groupState.get(family)
  return !(total > COLLAPSE_THRESHOLD && (family === 'diy' || family === 'do_nothing'))
}

// ---------------------------------------------------------------- markup

function segmentChips(competitor) {
  return segmentsOf(competitor).map(segment => `<button type="button" class="hangar-chip" data-hangar-action="segment" data-segment-id="${escapeHtml(segment.id)}" title="${escapeHtml(segmentTitle(segment))}">${escapeHtml(segmentName(segment))}</button>`).join('')
}

const kindGroups = { direct: 'direct', indirect: 'indirect', diy: 'diy', do_nothing: 'do_nothing', unknown: 'unclassified' }
function scenarioRows(competitor) {
  const segmentIds = new Set(selectedSegmentScope())
  return (competitor.scenarios || []).filter(s => {
    const contexts = s.contexts.filter(c => !segmentIds.size || segmentIds.has(c.segmentId))
    if (filters.segments.size && !contexts.length) return false
    return filters.family === 'all' || (contexts.length ? contexts.some(c => kindGroups[c.kind] === filters.family) : kindGroups[s.kind] === filters.family)
  })
}

function categoryOverviewMarkup(competitor) {
 const chips=segmentChips(competitor)
 return window.OSUI.summaryCard({title:competitor.label,href:`#competitor/${encodeURIComponent(competitor.id)}`,level:3,className:'hangar-group-record is-rendered',attributes:{role:'listitem','data-hangar-card':competitor.id,'data-family':kindOf(competitor),'data-entity-kind':'category','aria-label':'Запись исследования: '+competitor.label},meta:'<p>Общие наблюдения о группе решений</p>',content:
  '<p>Здесь собраны сведения о способе решения задачи. Отдельные компании и инструменты, если они выделены в исследовании, имеют собственные страницы.</p>'+
  ((competitor.mentionedSolutions||[]).length?`<div class="hangar-mentioned"><span>Упомянутые решения:</span>${competitor.mentionedSolutions.map(solution=>button({label:solution.label,attributes:{'data-hangar-action':'mentioned-solution','data-solution-id':solution.id}})).join('')}</div>`:'')+
  (chips?`<div class="hangar-segments" aria-label="Связанные сегменты">${chips}</div>`:'')})
}
function readingCardMarkup(competitor) {
 const preview=competitorPreview(competitor,selectedSegmentScope());let domain='';try{domain=new URL(competitor.url).hostname.replace(/^www\./,'')}catch{}
 const meta=[preview.category,domain].filter(Boolean).join(' · ')
 return window.OSUI.summaryCard({title:competitor.label,href:`#competitor/${encodeURIComponent(competitor.id)}`,level:3,className:'hangar-reading-card is-rendered',attributes:{role:'listitem','data-hangar-card':competitor.id,'data-family':kindOf(competitor),'aria-label':competitor.label},meta:meta?`<p>${escapeHtml(meta)}</p>`:'',content:
  (preview.summary?`<p>${preview.summaryLabel?'Обещание сервиса: ':''}${escapeHtml(preview.summary)}</p>`:'')+
  (preview.facts.length?window.OSUI.proseFacts({items:preview.facts.map(f=>({label:f.label,value:escapeHtml(f.text)+(f.context?`<p class="hangar-preview-context">${escapeHtml(f.context)}</p>`:'')}))}):'')})
}
function cardMarkup(competitor) {
 return isCategory(competitor) && !competitor.alternative ? categoryOverviewMarkup(competitor) : readingCardMarkup(competitor)
}
function groupMarkup(family, competitors, total) {
 return `<details class="hangar-group" data-family="${family}" ${groupOpen(family,total)?'open':''}>
  <summary><span class="hangar-group-title">${GROUP_TITLES[family]}</span><span class="hangar-group-hint">${GROUP_HINTS[family]}</span>${iconMarkup('chevronDown')}</summary>
  <div class="hangar-reading-list" role="list" aria-label="${GROUP_TITLES[family]}">${competitors.map(cardMarkup).join('')}</div>
 </details>`
}

// Saved competitor review scope: shown only when stored; never invented.
function reviewScopeMarkup() {
  const snapshot = window.__productGalaxySnapshot
  const node = (snapshot?.communications?.nodes || []).find(candidate => candidate.id === snapshot?.galaxy?.product?.id)
  const review = node?.data?.competitorReview
  if (!review || typeof review !== 'object' || !(review.scope || review.limitations)) return ''
  const source = typeof review.latestScopeSource === 'string' && !review.latestScopeSource.includes('..') && /^(?:sources|reports|research)\/[^\\]+$/.test(review.latestScopeSource) ? `/source?path=${encodeURIComponent(review.latestScopeSource)}` : ''
  const message = ['Границы обзора конкурентов:', review.scope, review.limitations, review.scopeAsOf ? `Граница обновлена ${review.scopeAsOf}.` : review.asOf ? `Исходный обзор от ${review.asOf}.` : ''].filter(Boolean).join(' ')
  return `<div data-competitor-review>${notice({message, actions: source ? textLink({label: 'Решение о границах →', href: source}) : ''})}</div>`
}

function toolbarMarkup() {
  const segments = galaxy?.segments || []
  const option = (value, label, current) => `<option value="${escapeHtml(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
  const header=window.OSUI.pageHeader({title:'Конкуренты и альтернативы'})
  const nav=topicNav({label:'Вид раздела',className:'hangar-view-nav',active:view,items:[{id:'list',label:'Список',attributes:{'data-hangar-view':'list'}},{id:'map',label:'Карта обещаний',attributes:{'data-hangar-view':'map'}}]})
  const filtersMarkup=`<section id="hangarFilterPanel" class="hangar-filter-panel" aria-label="Фильтры и сортировка" >
      ${filterBar({className:'hangar-filter-row',label:'Фильтры конкурентов',open:filtersOpen,active:filtersActive(),content:
        field({label:'Тип конкуренции',type:'select',attributes:{'data-hangar-filter':'family'},optionsHtml:option('all','Все типы',filters.family)+GROUP_ORDER.filter(family=>family!=='contextual').map(family=>option(family,GROUP_TITLES[family],filters.family)).join('')})+
        field({label:'Оценка цены в исследовании',type:'select',attributes:{'data-hangar-filter':'tier'},optionsHtml:option('all','Любая оценка',filters.tier)+Object.keys(TIER_ORDER).map(tier=>option(tier,PRICE_WORDS[tier],filters.tier)).join('')})+
        field({label:'Сортировка',type:'select',attributes:{'data-hangar-sort':true},optionsHtml:Object.entries(SORT_WORDS).map(([key,label])=>option(key,label,sortKey)).join('')})+
        button({label:'Сбросить фильтры',attributes:{'data-hangar-action':'reset-filters',hidden:true}})
      })}

    </section>
  `
  const content=`<p class="hangar-count" data-hangar-count role="status" hidden></p>
  <div class="hangar-promise-map" data-hangar-map hidden></div><div class="hangar-deck" data-hangar-deck></div>`
  return window.OSUI.collectionLayout({header,nav,notice:reviewScopeMarkup(),filters:filtersMarkup,content})
}

function renderToolbar() {
  const nextSignature = JSON.stringify([(galaxy?.segments || []).map(segment => [segment.id, segmentName(segment), segmentTitle(segment)]), reviewScopeMarkup()])
  if (toolbarSignature === nextSignature && options.root.querySelector('[data-hangar-deck]')) return
  toolbarSignature = nextSignature
  deckSignature = ''
  mapSignature = ''
  const existing=options.root.querySelector('.os-filter-disclosure');if(existing)filtersOpen=existing.open
  options.root.innerHTML = toolbarMarkup()
}

function renderDeck() {
  writeFilters()
  const deck = options.root.querySelector('[data-hangar-deck]')
  if (!deck) return
  const all = roster()
  // The view switch does not invalidate the rendered deck; it only decides which surface shows.
  syncView()
  // Keep decoded images, focus and scroll position on a round trip or an unchanged
  // snapshot. Include display data, not just ids, in this key.
  const nextSignature = JSON.stringify([all, galaxy?.segments, filters.family, filters.tier, [...filters.segments], sortKey,visibleLimit])
  if (deckSignature === nextSignature) { updateCount(all.filter(matchesFilters).length, all.length); refreshSelectionMarks(); return }
  deckSignature = nextSignature
  if (!all.length) {
    deck.innerHTML = window.OSUI.emptyState({kind:'first-use',title:'Карточки альтернатив пока не связаны',description:'Сохранённый обзор может находиться в отчётах, даже если карточки решений ещё не созданы.',actions:textLink({label:'Посмотреть сохранённые исследования',href:'#reports'})})
    updateCount(0, 0)
    return
  }
  const visible = all.filter(matchesFilters).sort(compare)
  const groups = GROUP_ORDER.map(family => [family, visible.filter(competitor => competitionGroupOf(competitor) === family).slice(0,visibleLimit)]).filter(([, items]) => items.length)
  const remaining = visible.length - groups.reduce((count,[,items])=>count+items.length,0)
  deck.innerHTML = groups.length
    ? groups.map(([family, items]) => groupMarkup(family, items, all.length)).join('')+(remaining>0?button({label:`Показать ещё · осталось ${remaining}`,attributes:{'data-hangar-more':''}}):'')
    : window.OSUI.emptyState({kind:'no-results',title:'Под такие условия никто не подходит',description:'Измените условия или сбросьте фильтры, чтобы увидеть другие решения.',actions:window.OSUI.button({label:'Сбросить фильтры',attributes:{'data-hangar-action':'reset-filters'}})})
  updateCount(visible.length, all.length)
  refreshSelectionMarks()
}

// The deck and the map share the toolbar; only one is visible and the nav says which.
function syncView() {
  const deck = options.root.querySelector('[data-hangar-deck]'), map = options.root.querySelector('[data-hangar-map]')
  if (!deck || !map) return
  for (const item of options.root.querySelectorAll('[data-hangar-view]')) { const on = item.dataset.hangarView === view; item.setAttribute('aria-pressed', String(on)); on ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current') }
  deck.hidden = view === 'map'
  map.hidden = view !== 'map'
  if (view !== 'map') return
  const visibleIds = new Set(roster().filter(matchesFilters).map(item => item.id))
  const sourceMap = galaxy?.promiseMap || { jobs: [], competitors: [], cells: {}, openings: [] }
  const scopedMap = scopePromiseMap(sourceMap, { segmentIds: selectedSegmentScope(), competitorIds: visibleIds })
  const nextSignature = JSON.stringify(scopedMap)
  if (mapSignature === nextSignature && map.childElementCount) return
  mapSignature = nextSignature
  map.innerHTML = filtersActive() && !scopedMap.competitors.length
    ? window.OSUI.emptyState({kind:'no-results',title:'Нет сайтов по выбранным условиям',description:'Измените фильтры, чтобы сравнить обещания других решений.',actions:button({label:'Сбросить фильтры',attributes:{'data-hangar-action':'reset-filters'}})})
    : renderPromiseMap(scopedMap, { limit: scopedMap.competitors.length })
}

function updateCount(shown, total) {
  window.OSUI.setFilterActive(options.root,filtersActive())
  const count = options.root.querySelector('[data-hangar-count]')
  if (count) {
    count.textContent = filtersActive() && view !== 'map' ? `Найдено записей: ${shown} из ${total}` : ''
    count.hidden = !count.textContent
  }
  const reset = options.root.querySelector('.hangar-filter-row [data-hangar-action="reset-filters"]')
  if (reset) reset.hidden = !filtersActive()
  for (const chip of options.root.querySelectorAll('[data-hangar-action="toggle-segment"]')) chip.setAttribute('aria-pressed', String(filters.segments.has(chip.dataset.segmentId)))
}

function refreshSelectionMarks() {
  const selection = options.getSelection?.()
  const id = selection?.type === 'competitor' ? selection.id : null
  for (const card of options.root.querySelectorAll('[data-hangar-card]')) card.classList.toggle('is-selected', card.dataset.hangarCard === id)
}

function competitorOf(element) {
  const owner = element.closest('[data-hangar-card], [data-hangar-owner]')
  const id = owner?.dataset.hangarCard || owner?.dataset.hangarOwner
  return roster().find(item => item.id === id) || null
}

function openDossier(competitor) {
  if (window.AtlasNavigation) { window.AtlasNavigation.navigate('competitor/' + encodeURIComponent(competitor.id)); return }
  if (location.pathname === '/atlas' || document.body.classList.contains('atlas-enabled')) { location.href = '/atlas#competitor/' + encodeURIComponent(competitor.id); return }
  // Keep the user's place in the list while the dossier opens alongside it.
  options.select('competitor', competitor.id)
  refreshSelectionMarks()
}

function onClick(event) {
  const viewButton = event.target.closest('[data-hangar-view]')
  if (viewButton) { view = viewButton.dataset.hangarView === 'map' ? 'map' : 'list'; renderDeck(); return }
  const action = event.target.closest('[data-hangar-action]')
  if (!action) {
    // The title is a native link. Also support direct clicks
    // on card content without making its independent controls open two destinations.
    if (event.target.closest('button,a,input,select,textarea,summary')) return
    const competitor = competitorOf(event.target)
    if (competitor) openDossier(competitor)
    return
  }
  const kind = action.dataset.hangarAction
  if (kind === 'reset-filters') {
    filters = { family: 'all', tier: 'all', segments: new Set() };visibleLimit=20
    for (const select of options.root.querySelectorAll('[data-hangar-filter]')) select.value = 'all'
    renderDeck()
    return
  }
  if (kind === 'toggle-segment') {
    const id = action.dataset.segmentId
    filters.segments.has(id) ? filters.segments.delete(id) : filters.segments.add(id)
    renderDeck()
    return
  }
  if (kind === 'mentioned-solution') {
    const target = roster().find(item => item.id === action.dataset.solutionId)
    if (target) openDossier(target)
    return
  }
  const competitor = competitorOf(action)
  if (!competitor) return
  if (kind === 'dossier') {
    openDossier(competitor)
    return
  }
  if (kind === 'segment') {
      options.setMode('map')
    options.select('segment', action.dataset.segmentId)
  }
}

function onChange(event) {
  const filter = event.target.closest('[data-hangar-filter]')
  if (filter) { filters[filter.dataset.hangarFilter] = filter.value; renderDeck(); return }
  if (event.target.closest('[data-hangar-sort]')) { sortKey = event.target.value; renderDeck() }
}

function onToggle(event) {
  if(event.target.matches('.os-filter-disclosure')){filtersOpen=event.target.open;return}
  const notes = event.target.closest('.hangar-research-notes')
  if (notes) { notesState.set(notes.dataset.hangarNotes, notes.open); return }
  const group = event.target.closest('.hangar-group')
  if (group) { groupState.set(group.dataset.family, group.open); return }
}

function bind() {
  if (bound) return
  bound = true
  const { root } = options
  root.addEventListener('click', onClick)
  root.addEventListener('change', onChange)
  root.addEventListener('toggle', onToggle, true)
  if (options.panel && typeof MutationObserver !== 'undefined') {
    panelObserver = new MutationObserver(() => { if (active) refreshSelectionMarks() })
    panelObserver.observe(options.panel, { attributes: true, attributeFilter: ['hidden'], childList: true })
  }
}

// ---------------------------------------------------------------- public API

// options: { root, getGalaxy, getSelection, select, setMode, panel }
export function initHangar(next) {
  options = next
  readFilters()
  options.root.addEventListener('click',event=>{if(event.target.closest('[data-hangar-more]')){visibleLimit+=20;renderDeck()}})
  bind()
  return { renderHangar, setHangarActive }
}

export function renderHangar(nextGalaxy = options?.getGalaxy?.()) {
  if (!options) return
  galaxy = nextGalaxy || null
  const nextSignature = galaxy ? `${galaxy.version || ''}|${roster().map(rosterKey).join('|')}|${(galaxy.segments || []).map(segment => segment.id).join(',')}` : 'empty'
  if (nextSignature !== signature) {
    signature = nextSignature
    // a projection reload can retire segment ids the filter still points at
    filters.segments = new Set([...filters.segments].filter(id => (galaxy?.segments || []).some(segment => segment.id === id)))
    if (groupDefaultsFor !== String(roster().length > COLLAPSE_THRESHOLD)) { groupDefaultsFor = String(roster().length > COLLAPSE_THRESHOLD); groupState = new Map() }
  }
  renderToolbar()
  renderDeck()
}

export function setHangarActive(next) {
  active = Boolean(next)
  if (active){readFilters();toolbarSignature='';deckSignature='';mapSignature='';if(galaxy){renderToolbar();renderDeck()}refreshSelectionMarks()}
}
