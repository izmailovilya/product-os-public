import './ui-components.js'
import './console-runtime.js'
import './product-work.js'
import {captureReadingLists,restoreReadingLists} from './reading-list.js'
import {ProductTabs} from './product-tabs.js'
(() => {
  'use strict'

  const $ = selector => document.querySelector(selector)
  const $$ = selector => [...document.querySelectorAll(selector)]
  const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const uiIcon = (name, className = '') => window.ProductOsIcons?.iconMarkup(name, className) || ''
  const plural = (number, one, few, many) => {
    const mod10 = number % 10; const mod100 = number % 100
    return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14) ? few : many
  }
  const formatTime = value => new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  const pageHeaders = [
    ['next','Что дальше',window.OSUI.button({label:'Обзор состояния',className:'next-overview',attributes:{id:'hqButton','aria-label':'Где мы и что дальше?'}})],
    ['reports','Отчёты исследований','<span id="reportsCount" class="count-label"></span>'],
    ['skills','Задачи агентам',''],
  ]
  for (const [id,title,actions] of pageHeaders) {
    const view = document.getElementById('view-'+id)
    view.querySelector('[data-page-header]').remove()
    view.innerHTML = window.OSUI.collectionLayout({header:window.OSUI.pageHeader({title,actions}),content:view.innerHTML})
    view.classList.add('os-work-page')
  }

  $('#launchContextFields').innerHTML=window.OSUI.field({label:'Уточнение к задаче',type:'textarea',attributes:{id:'launchContext',maxlength:10000,placeholder:'Что учесть при выполнении'}})+window.OSUI.button({label:'Скопировать инструкцию',attributes:{id:'launchCopyPrompt'}})
  let snapshot = null
  let refreshSequence = 0
  let activeTab = window.AtlasRouteState?.read().contentTab || 'map'
  let pendingGalaxyFocus = null
  let launchMove = null
  let launchKey = null
  let launchBusy = false
  let deckBusy = false
  let deckTotal = 0
  let deckStats = { accepted: 0, rejected: 0, later: 0 }
  let confirmAction = null
  const expandedReports = new Set()
  const expandedSkills = new Set()
  const skillPresentation = {
    'product-interviews': ['evidence', 'Сохранить интервью, проверить источники и полноту ответов, затем сопоставить результаты.'],
    'product-status': ['route', 'Прочитать текущий контекст и предложить следующий шаг.'],
    'product-context': ['evidence', 'Добавить материалы и сведения с источниками.'],
    'product-segment-hypotheses': ['segment', 'Найти сегменты по задачам клиентов и сформулировать гипотезы для проверки.'],
    'product-deep-research': ['evidence', 'Исследовать рынок, конкурентов и потребности клиентов с опорой на источники.'],
    'product-risk-analysis': ['alert', 'Найти слабые места идеи или плана и подготовить проверку самого опасного риска.'],
    'product-walkthrough': ['route', 'Пройти путь клиента: от его задачи до результата и причин отказа.'],
    'product-ui-audit': ['list', 'Проверить весь интерфейс как одну систему: страницы, данные, источники, графы, адаптивность и взаимодействия.'],
    'product-prioritize': ['list', 'Сравнить варианты действий с учётом цели продукта и ресурсов команды.'],
    'product-channel-concept': ['route', 'Определить, зачем читать канал и как читатель придёт к полезному результату в продукте.'],
    'product-editorial-voice': ['evidence', 'Настроить голос автора, стиль и правила редакции по образцам или пожеланиям.'],
    'product-visual-style': ['evidence', 'Настроить визуальный профиль канала по референсам и проверить на изображениях.'],
    'product-visual': ['list', 'Создать изображение к материалу по стилю канала, сохранить исходники и проверить читаемость.'],
    'product-content': ['list', 'Подготовить темы, посты и серии или отредактировать текст с опорой на концепцию и голос.'],
    'product-search-opportunities': ['route', 'Найти темы и недостающие страницы для поиска и AI-ответов с опорой на задачи клиентов.'],
    'product-search-audit': ['evidence', 'Проверить страницу: доступность для поиска, содержание, доверие и наблюдаемую AI-видимость.'],
    'product-search-brief': ['list', 'Подготовить структуру и ТЗ на страницу: проверенные факты, ссылки и критерии приёмки.'],
    'product-search-article': ['list', 'Написать статью по теме или ТЗ: фактура, голос автора, метаданные и редакционная проверка.'],
    'product-landing': ['list', 'Написать структуру и текст лендинга по работам сегмента и поисковым запросам; по поручению собрать страницу в айдентике.'],
    'product-landing-review': ['list', 'Проверить формулировки лендинга по сегментам и задачам клиентов; предложить обоснованные правки.'],
  }

  // Polling should not recreate unchanged controls or reset a selected launch target.
  function setMarkup(root, markup) {
    if (root.innerHTML === markup) return
    const readingState=captureReadingLists(root)
    const active = root.contains(document.activeElement) ? document.activeElement : null
    const identity = active && [...active.attributes].find(attribute => attribute.name.startsWith('data-'))
    const disclosures = new Map([...root.querySelectorAll('details[data-disclosure]')].map(item => [item.dataset.disclosure, item.open]))
    const values = [...root.querySelectorAll('select[data-skill-target]')].map(select => [select.dataset.skillTarget, select.value])
    root.innerHTML = markup
    restoreReadingLists(root,readingState)
    for (const item of root.querySelectorAll('details[data-disclosure]')) if (disclosures.has(item.dataset.disclosure)) item.open = disclosures.get(item.dataset.disclosure)
    for (const [slug, value] of values) {
      const select = root.querySelector(`[data-skill-target="${CSS.escape(slug)}"]`)
      if (select?.options && [...select.options].some(option => option.value === value)) select.value = value
    }
    if (identity) root.querySelector(`[${identity.name}="${CSS.escape(identity.value)}"]`)?.focus({ preventScroll: true })
  }

  async function api(path, options = {}) {
    let response
    try { response = await fetch(path, {
      method: options.method || 'GET',
      headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(snapshot?.csrfToken ? { 'x-product-os-token': snapshot.csrfToken } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }) } catch(error) { console.error('Console request failed',error);throw new Error('Консоль не отвечает. Проверьте соединение и повторите действие.') }
    let payload
    try { payload = await response.json() } catch { payload = {} }
    if (!response.ok) {
      const error = new Error(typeof payload.error==='string'&&/[а-яё]/i.test(payload.error)?payload.error:'Не удалось выполнить действие. Обновите данные и повторите попытку.')
      error.code = payload.code
      error.status = response.status
      throw error
    }
    return payload
  }

  let refreshPending,refreshQueued,initialError='',lastUpdatedAt=null,workReportOpened=false
  const refreshNotice=document.createElement('section');refreshNotice.id='snapshotRefreshNotice';refreshNotice.hidden=true;document.getElementById('atlasPageOutlet').prepend(refreshNotice)
  new ResizeObserver(()=>document.documentElement.style.setProperty('--atlas-feedback-height',`${refreshNotice.getBoundingClientRect().height}px`)).observe(refreshNotice)
  const initialView=document.createElement('section');initialView.id='atlasInitialLoading';document.getElementById('atlasPageOutlet').prepend(initialView)
  const bootstrap=JSON.parse(document.getElementById('productOsBootstrap')?.textContent||'{}')
  // Router consumes navigation clicks in document capture; refresh the pending view after its history write.
  window.addEventListener('click',()=>{if(!snapshot)requestAnimationFrame(initialLoading)},true)
  function initialLoading(){
    if(snapshot){initialView.hidden=true;initialView.replaceChildren();return}
    const route=window.AtlasRouteState?.read().route||location.hash.slice(1),kind=route.split('/')[0].split('?')[0]
    const title=({product:bootstrap.productName||'Продукт',map:'Сегменты',segment:'Сегмент',hangar:'Конкуренты',competitor:'Конкурент',communications:'Каналы коммуникации',channel:'Канал',material:'Материал',people:'Респонденты',person:'Досье респондента',next:'Что дальше',reports:'Отчёты исследований',skills:'Задачи агентам'})[kind]||'Продукт'
    const productLoading=kind==='product'&&bootstrap.productName?ProductTabs.header({displayLabel:bootstrap.productName,summary:bootstrap.description},route.split('?')[0].split('/')[1]||'overview')+ProductTabs.render(route.split('?')[0].split('/')[1]||'overview')+window.OSUI.loadingState({kind:'section',label:'Загрузка данных…'}):window.OSUI.loadingState({kind:'page',title,label:'Загрузка данных…'})
    initialView.hidden=false
    initialView.innerHTML=initialError?window.OSUI.emptyState({kind:'unavailable',title:'Не удалось загрузить '+title.toLocaleLowerCase(),description:initialError,actions:window.OSUI.button({label:'Повторить загрузку',attributes:{'data-retry-snapshot':''}})}):productLoading
  }
  initialLoading();window.addEventListener('hashchange',initialLoading)
  document.addEventListener('click',event=>{if(event.target.closest('[data-retry-snapshot]')){initialError='';initialLoading();refresh()}else if(!snapshot)requestAnimationFrame(initialLoading)})
  async function refresh(options = {}) {
    if(refreshPending){refreshQueued=options;return refreshPending}
    refreshPending=(async()=>{
      let next=options
      do {refreshQueued=null;await refreshSnapshot(next);next=refreshQueued} while(next)
    })().finally(()=>{refreshPending=null})
    return refreshPending
  }
  async function refreshSnapshot(options = {}) {
    if(!snapshot)$('#app').setAttribute('aria-busy','true')
    try {
      const sequence = ++refreshSequence
      const scope = window.ProductCommunications?.scope || ''
      const next = await api(`/api/snapshot${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`)
      if (sequence !== refreshSequence || scope !== (window.ProductCommunications?.scope || '')) return
      snapshot = next
      lastUpdatedAt=Date.now();refreshNotice.hidden=true
      initialError='';initialLoading()
      renderAll()
      const reportPath=new URLSearchParams(location.hash.split('?')[1]||'').get('work-report')
      if(reportPath&&!workReportOpened){workReportOpened=true;window.ProductWork.edit('',reportPath)}
      $('#app').setAttribute('aria-busy', 'false')
    } catch (error) {
      console.error('Snapshot refresh failed',error)
      if (!snapshot){initialError='Не удалось связаться с консолью. Проверьте, что сервер запущен, и повторите загрузку.';initialLoading()}
      else {refreshNotice.hidden=false;refreshNotice.innerHTML=window.OSUI.notice({kind:'warning',message:`Не удалось обновить данные. Показана версия от ${formatTime(lastUpdatedAt)}.`,actions:window.OSUI.button({label:'Обновить',attributes:{'data-retry-snapshot':''}})})}
    } finally {
      $('#app').setAttribute('aria-busy','false');if(snapshot)initialLoading()
    }
  }

  function renderAll() {
    if (!snapshot) return
    document.title = `Product OS · ${snapshot.productName}`
    $('#productName').textContent = snapshot.productName
    $('#productName').title = snapshot.productName
    const sections = [
      ['Состояние данных', '#graphStatus', renderGraphStatus],
      ['Навигация', null, renderTabs],
      ['Карта продукта', '#mapDesktop', renderMap],
      ['Коммуникации', '#communicationsCenter', () => window.ProductCommunications?.update(snapshot)],
      ['Что дальше', '#todoList', renderNext],
      ['Отчёты', '#reportsList', renderReports],
      ['Задачи агентам', '#skillsList', renderSkills],
    ]
    for (const [title,selector,render] of sections) {
      try { render() } catch(error) {
        console.error(`Не удалось показать раздел «${title}»`,error)
        const root=selector&&$(selector)
        if(root)root.innerHTML=window.OSUI.emptyState({kind:'unavailable',title:`Не удалось показать раздел «${title}»`,description:'Остальные разделы доступны. Попробуйте обновить данные.',actions:window.OSUI.button({label:'Обновить',attributes:{'data-retry-snapshot':''}})})
      }
    }
  }

  function renderGraphStatus() {
    const element = $('#graphStatus')
    const status = snapshot.graphStatus
    element.className = `sync-status is-${status.state}`
    const label = status.state === 'saved' ? `Данные сохранены · ${formatTime(status.mtime)}` : status.state === 'saving' ? 'Сохраняю…' : 'Не сохранилось — что делать'
    element.querySelector('.sync-copy').textContent = label
    element.setAttribute('aria-label', label)
    element.title = label
  }

  function renderTabs() {
    $$('.tab').forEach(tab => {
      const active = tab.dataset.tab === activeTab
      tab.classList.toggle('is-active', active)
      tab.setAttribute('aria-selected', String(active))
      tab.tabIndex = active ? 0 : -1
      tab.id = `tab-${tab.dataset.tab}`
      tab.setAttribute('aria-controls', `view-${tab.dataset.tab}`)
    })
    $$('.view').forEach(view => {
      const active = view.dataset.view === activeTab
      view.hidden = !active
      view.inert = !active
      view.setAttribute('aria-labelledby', `tab-${view.dataset.view}`)
    })
    $('#nextBadge').hidden = !snapshot.badges.next
    $('#nextBadge').textContent = snapshot.badges.next || ''
    $('#waitBadge').hidden = !snapshot.badges.waiting
  }

  function setTab(tab) {
    // The map locks the document scroll. Reset the root before enabling that lock so a long
    // content tab cannot strand the entire map chrome above the viewport.
    if (tab === 'map') window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    activeTab = tab
    renderTabs()
    if (tab !== 'map') window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  function focusNode(id) {
    if (!snapshot?.graph.nodes.some(node => node.id === id)) return
    pendingGalaxyFocus = id
    setTab('map')
    if (window.ProductGalaxy) {
      window.ProductGalaxy.selectEntity(id)
      pendingGalaxyFocus = null
    }
  }

  function renderMap() {
    const empty = snapshot.graph.empty || !snapshot.galaxy?.product
    $('#mapEmpty').hidden = !empty
    $('#mapDesktop').hidden = empty
    if (empty) {
      $('#mapEmpty').innerHTML = '<h3>Карта пуста.</h3><p>Подготовьте первую задачу — по результатам исследования карта наполнится сегментами и связями.</p><button type="button" class="primary-button" data-empty-hq>Подготовить первую задачу</button>'
      return
    }
    window.__productGalaxySnapshot = snapshot
    if (window.ProductGalaxy) {
      window.ProductGalaxy.update(snapshot)
      if (pendingGalaxyFocus) { window.ProductGalaxy.selectEntity(pendingGalaxyFocus); pendingGalaxyFocus = null }
    } else window.dispatchEvent(new CustomEvent('product-galaxy:snapshot', { detail: { snapshot } }))
  }

  function statusCopy(item) {
    if (item.status === 'waiting') return 'Нужен ваш ответ'
    if (item.status === 'running') return `Агент работает · ${item.elapsed || 0} мин`
    if (item.status === 'done') return `Готово ${item.report ? formatTime(item.report.date) : ''}`.trim()
    if (item.status === 'stopped') return 'Остановлено вами'
    if (item.status === 'failed') return 'Ошибка выполнения'
    if (item.status === 'blocked') return 'ПЛАН ТРЕБУЕТ УТОЧНЕНИЯ'
    if (item.status === 'unknown') return 'СТАТУС УТОЧНЯЕТСЯ'
    if (item.status === 'incomplete') return 'РЕЗУЛЬТАТ НЕ ЗАПИСАН'
    return 'К запуску'
  }

  function renderNext() {
    let work=$('#productWorkNext');if(!work){work=document.createElement('section');work.id='productWorkNext';$('#deckBanner').before(work)}
    setMarkup(work,window.ProductWork.summary(snapshot)+window.ProductWork.queue(snapshot))
    let productActions = document.querySelector('#productNextActions');
    if (!productActions) { productActions = document.createElement('section'); productActions.id = 'productNextActions'; document.querySelector('#todoList').after(productActions); }
    const planned = new Set(snapshot.todo.map(item => item.move?.id));
    const available = (snapshot.galaxy?.product?.moves || []).filter(move => !planned.has(move.id));
    productActions.innerHTML = available.length ? '<h2>Уточнить продукт</h2>' + available.map(move => `<article class="todo-row"><h3>${escapeHtml(move.title)}</h3><p>${escapeHtml(move.output || '')}</p><button type="button" class="secondary-button" data-galaxy-move="${escapeHtml(move.id)}">Подготовить задачу</button></article>`).join('') : '';

    const count = snapshot.suggestions.length
    $('#deckBanner').hidden = count === 0
    $('#deckCount').textContent = `${count} ${plural(count, 'предложение', 'предложения', 'предложений')} ${plural(count, 'ждёт', 'ждут', 'ждут')} разбора`
    const list = $('#todoList')
    if (!snapshot.todo.length) {
      list.innerHTML = window.OSUI.emptyState({kind:'first-use',title:'Задач пока нет.',description:'Разберите предложения или спросите, где мы и что делать дальше.',actions:window.OSUI.button({label:'Определить следующую задачу',variant:'primary',attributes:{'data-empty-hq':''}})})
      return
    }
    const rowMarkup = item => {
      const move = item.move
      const actions = []
      if (item.status === 'blocked' && item.clarifyMove) actions.push(`<button type="button" class="secondary-button" data-move="${escapeHtml(item.clarifyMove.id)}">Уточнить план задачи</button>`)
      if (item.status === 'ready') actions.push(`<button type="button" class="primary-button" data-move="${escapeHtml(move.id)}">Запустить агента</button>`)
      if (['running', 'waiting', 'unknown', 'incomplete'].includes(item.status)) {
        if (item.provider !== 'claude' && item.threadId) actions.push(`<button type="button" class="secondary-button" data-open-agent="${escapeHtml(item.threadId)}">Открыть работу агента</button>`)
        if (item.status === 'running' && item.provider !== 'claude') actions.push(`<button type="button" class="danger-button" data-stop-agent="${escapeHtml(item.threadId)}">Остановить</button>`)
      }
      if (item.status === 'done') {
        if (item.report) {
          actions.push(`<a class="secondary-button" href="/report?path=${encodeURIComponent(item.report.path)}">Посмотреть результат</a>`)
          if (!item.report.integrated && item.move.kind !== 'ingest') actions.push(`<button type="button" class="ghost-button" data-ingest-report="${escapeHtml(item.report.path)}" data-node-id="${escapeHtml(item.node.id)}">Добавить выводы в карту</button>`)
          else actions.push('<span class="todo-integrated">Выводы сохранены в карте</span>')
        } else if (item.provider !== 'claude' && item.threadId) actions.push(`<button type="button" class="secondary-button" data-open-agent="${escapeHtml(item.threadId)}">Открыть результат</button>`)
      }
      if (['failed','stopped'].includes(item.status)) {
        actions.push(`<button type="button" class="primary-button" data-retry-move="${escapeHtml(move.id)}">Запустить заново</button>`)
        if (item.provider !== 'claude' && item.threadId) actions.push(`<button type="button" class="ghost-button" data-open-agent="${escapeHtml(item.threadId)}">Открыть работу агента</button>`)
      }
      return `<article class="todo-item is-${escapeHtml(item.status)}"><button type="button" class="todo-body" data-focus="${escapeHtml(item.node.id)}"><span class="todo-status">${statusCopy(item)}</span><strong class="todo-title">${escapeHtml(move.title)}</strong><span class="todo-reward">На выходе: ${escapeHtml(move.output)}</span>${item.owner ? `<span class="todo-note">Ответственный: ${escapeHtml(item.owner)}</span>` : ''}${item.long ? '<span class="todo-note">Дольше обычного — загляни в работу агента.</span>' : ''}${item.failure ? `<span class="todo-note">${escapeHtml(/[а-яё]/i.test(item.failure)?item.failure:'Не удалось выполнить задачу. Откройте работу агента для подробностей.')}</span>` : ''}</button><div class="todo-actions">${actions.join('')}</div></article>`
    }
    const active = snapshot.todo.filter(item => item.status !== 'done')
    const completed = snapshot.todo.filter(item => item.status === 'done')
    setMarkup(list, active.map(rowMarkup).join('') + (completed.length ? `<details class="todo-completed" data-disclosure="completed-tasks"><summary>Завершённые задачи · ${completed.length}</summary>${completed.map(rowMarkup).join('')}</details>` : ''))
  }

  function linkedText(value, sourceMentions = []) {
    let text = value || ''
    const mentions = [...sourceMentions].sort((a, b) => b.label.length - a.label.length)
    const parts = []
    while (text) {
      let match = null
      for (const mention of mentions) {
        const index = text.toLocaleLowerCase('ru').indexOf(mention.label.toLocaleLowerCase('ru'))
        if (index >= 0 && (!match || index < match.index)) match = { ...mention, index }
      }
      if (!match) { parts.push(escapeHtml(text)); break }
      if (match.index) parts.push(escapeHtml(text.slice(0, match.index)))
      parts.push(`<button type="button" class="inline-node-link" data-focus="${escapeHtml(match.id)}">${escapeHtml(text.slice(match.index, match.index + match.label.length))}</button>`)
      text = text.slice(match.index + match.label.length)
    }
    return parts.join('')
  }

  function renderReports() {
    const originals=snapshot.sources || [], reports=snapshot.reports || []
    $('#reportsCount').textContent=`${originals.length} исходных материалов · ${reports.length} заметок`
    const cards=(rows,original)=>rows.map(row=>window.OSUI.summaryCard({title:row.name || row.title,content:original?'<p>Исходный файл сохранён без изменений.</p>':`<p>${escapeHtml(row.summary || '')}</p>`,actions:window.OSUI.button({label:original?'Открыть оригинал':'Открыть заметку',href:(original?'/source?path=':'/report?path=')+encodeURIComponent(row.source || row.path)})})).join('')
    setMarkup($('#reportsList'),window.OSUI.readingSection({title:'Исходные материалы',content:originals.length?cards(originals,true):'<p>Материалы ещё не добавлены. Используйте навык «Добавить контекст».</p>'})+window.OSUI.readingSection({title:'Заметки и отчёты',content:reports.length?cards(reports,false):'<p>Производных заметок пока нет.</p>'}))
  }

  function filterReports(key,value){const params=new URLSearchParams(location.hash.split('?')[1]||'');if(value)params.set(key,value);else params.delete(key);if(key!=='limit')params.delete('limit');window.AtlasRouteState?.write('reports'+(params.size?'?'+params:''),{replace:true,state:history.state||{}});renderReports()}
  document.addEventListener('input',event=>{if(event.target.id==='launchContext'&&launchMove){try{localStorage.setItem(`product-os-launch:${snapshot.workspace}:${launchMove.id}:context`,event.target.value)}catch{}}})
  document.addEventListener('change',event=>{if(event.target.matches('[data-report-filter="method"]'))filterReports('method',event.target.value)})
  window.addEventListener('hashchange',()=>{if(snapshot&&location.hash.startsWith('#reports'))renderReports()})
  function skillTargets(skill) {
    const allowed = skill.targetTypes || (skill.slug === 'product-deep-research' ? ['product', 'segment', 'competitor']
      : skill.slug === 'product-walkthrough' ? ['segment']
        : skill.slug === 'product-risk-analysis' ? ['product', 'assumption', 'value']
          : ['product', 'segment', 'assumption', 'competitor', 'value'])
    return snapshot.graph.nodes.filter(node => allowed.includes(node.type))
  }

  // the launch is visible where the button was pressed: a live chip on the skill card
  function skillLive(skill) {
    const item = snapshot.todo.find(entry => ['running', 'waiting'].includes(entry.status) && entry.move?.skill === skill.slug)
    if (!item) return ''
    return `<span class="skill-live is-${escapeHtml(item.status)}"><i></i>${escapeHtml(statusCopy(item))}</span>`
  }

  // the actions live under the head, where a button is allowed
  function skillLiveBar(skill) {
    const item = snapshot.todo.find(entry => ['running', 'waiting'].includes(entry.status) && entry.move?.skill === skill.slug)
    if (!item) return ''
    const open = item.provider !== 'claude' && item.threadId ? `<button type="button" class="secondary-button" data-open-agent="${escapeHtml(item.threadId)}">Открыть работу агента</button>` : ''
    return `<div class="skill-live-bar"><span>${item.status === 'waiting' ? 'Агент ждёт вашего ответа.' : 'Агент работает — результат появится в «Что дальше».'}</span>${open}<button type="button" class="ghost-button" data-goto-next>Смотреть в «Что дальше»</button></div>`
  }

  function renderSkills() {
    setMarkup($('#skillsList'), snapshot.skills.map(skill => {
      const targets=skillTargets(skill)
      const input=targets.length===1 ? `<input type="hidden" data-skill-target="${escapeHtml(skill.slug)}" value="${escapeHtml(targets[0].id)}">` : `<select aria-label="Продукт" data-skill-target="${escapeHtml(skill.slug)}">${targets.map(node=>`<option value="${escapeHtml(node.id)}">${escapeHtml(node.label)}</option>`).join('')}</select>`
      return window.OSUI.readingSection({title:skill.title,intro:skill.description,content:`${input}${window.OSUI.button({label:'Подготовить задачу',attributes:{'data-skill-launch':skill.slug}})}`})
    }).join(''))
  }

  function allMoves() { return [...Object.values(snapshot.moves).flat(), ...snapshot.todo.flatMap(item => [item.move, item.clarifyMove].filter(Boolean)), ...snapshot.suggestions.map(item => item.move)] }
  function moveById(id) { return allMoves().find(move => move?.id === id) || null }

  function openLaunch(move) {
    if (!move?.prompt?.trim()) { showToast('Задача больше не найдена или её инструкция пуста. Обновите страницу.'); return }
    if (move.action === 'open') { api('/api/open', { method: 'POST', body: { threadId: move.threadId } }).then(() => refresh()).catch(error => showToast(error.message)); return }
    if(launchBusy){showToast('Предыдущая задача ещё запускается. Статус появится в «Что дальше».');return}
    launchMove = move
    const storageKey = `product-os-launch:${snapshot.workspace}:${move.id}`
    launchKey = localStorage.getItem(storageKey) || crypto.randomUUID()
    localStorage.setItem(storageKey, launchKey)
    launchBusy = false
    $('#launchError').hidden = true
    $('#launchTitle').textContent = move.title
    $('#launchOutput').textContent = move.output
    $('#launchMeta').innerHTML = `<div><dt>О чём задача</dt><dd>${escapeHtml(move.node.label)}</dd></div><div><dt>Оценка времени</dt><dd>${escapeHtml(move.duration || 'Зависит от объёма')}</dd></div>`

    $('#launchPrompt').textContent = move.prompt
    $('#launchContext').value=localStorage.getItem(storageKey+':context')||''
    const duplicate = snapshot.todo.some(item => ['running', 'waiting'].includes(item.status) && item.node.id === move.node.id)
    $('#duplicateWarning').hidden = !duplicate
    $('#duplicateWarning').textContent = 'По этому объекту уже работает агент — запуск создаст вторую работу.'
    renderLaunchActions()
    openOverlay('launchOverlay')
    $('#launchTitle').focus({preventScroll:true})
  }

  function renderLaunchActions(retry = false) {
    const root = $('#launchPrimaryActions')
    if (snapshot.graphStatus.state === 'error') { root.innerHTML = '<button type="button" class="primary-button" disabled>Задачи недоступны, пока карта исследования не читается</button>'; return }
    if (snapshot.capabilities.bb) root.innerHTML = `<button type="button" class="primary-button" data-launch-provider="bb">${retry ? 'Повторить' : 'Запустить агента'}</button>`
    else root.innerHTML = `<p class="reward-small">bb не найден. Можно запустить ту же работу в Claude Code или скопировать команду.</p>${snapshot.capabilities.claude ? '<button type="button" class="secondary-button" data-launch-provider="claude">Запустить в Claude Code</button>' : ''}<button type="button" class="ghost-button" data-copy-command>Скопировать команду</button>`
  }

  async function launch(provider) {
    if (launchBusy || !launchMove) return
    launchBusy = true
    const button = $(`[data-launch-provider="${provider}"]`)
    if (button) { button.disabled = true; button.textContent = 'Запускаю агента…' }
    $('#launchError').hidden = true
    const move=launchMove,key=launchKey,context=$('#launchContext').value.trim(),storageKey=`product-os-launch:${snapshot.workspace}:${move.id}`
    localStorage.setItem(storageKey+':context',context)
    try {
      const result = await api(provider === 'bb' ? '/api/launch' : '/api/launch-claude', { method: 'POST', body: { moveId: move.id, idempotencyKey: key, context } })
      if(result.launch?.launchState==='started'){localStorage.removeItem(storageKey);localStorage.removeItem(storageKey+':context')}
      closeOverlay('launchOverlay')
      await refresh({ silent: true })
      if(window.AtlasNavigation?.navigate)window.AtlasNavigation.navigate('next');else {location.hash='next';setTab('next')}
      showToast(result.launch?.launchState === 'started' ? 'Запуск создан — статус и результат появятся в «Что дальше».' : 'Исход запуска уточняется. Проверьте существующую работу в «Что дальше».', null, null, 6000)
    } catch (error) {
      console.error('Agent launch failed',error)
      const message=error.status?error.message:'Не удалось подтвердить запуск: консоль не отвечает. Повтор с теми же параметрами безопасен; статус уточняется.'
      if(!$('#launchOverlay').hidden){$('#launchError').hidden=false;$('#launchError').textContent=message;renderLaunchActions(true);$('#launchError').scrollIntoView({block:'nearest'})}else showToast(message,null,null,10000)
    } finally { launchBusy = false }
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text)
      if (button) { const before = button.textContent; button.textContent = 'Скопировано'; setTimeout(() => { if (button.isConnected) button.textContent = before }, 1800) }
    } catch { showToast('Не удалось скопировать — выделите команду в раскрытой инструкции агенту.') }
  }

  function overlayController(id) {
    return window.OSUI.dialog(document.getElementById(id), {
      background: [document.getElementById('app'),document.querySelector('.atlas-navigation')].filter(Boolean),
      onClose() {
        if (id === 'launchOverlay' && !launchBusy) launchMove = null
        if (id === 'confirmOverlay') confirmAction = null
      },
    })
  }
  function openOverlay(id) { overlayController(id).open(document.activeElement) }
  function closeOverlay(id) { overlayController(id).close() }

  function openDeck() {
    deckBusy = false; deckStats = { accepted: 0, rejected: 0, later: 0 }; deckTotal = snapshot.suggestions.length
    renderDeck(); openOverlay('deckOverlay')
  }

  function renderDeck() {
    const handled = deckStats.accepted + deckStats.rejected + deckStats.later
    const suggestion = snapshot.suggestions[0]
    $('#deckProgress').textContent = suggestion ? `Предложение ${Math.min(deckTotal, handled + 1)} из ${deckTotal}` : 'Разбор завершён'
    $('#deckLayerTwo').hidden = !suggestion || snapshot.suggestions.length < 2
    $('#deckLayerThree').hidden = !suggestion || snapshot.suggestions.length < 3
    $('#deckStack').classList.toggle('is-empty', !suggestion)
    if (!suggestion) {
      $('#deckCard').innerHTML = `<article class="deck-empty"><span class="eyebrow">Предложения разобраны</span><h2 id="deckTitle">Все ${handled || deckTotal} разобраны</h2><p>Новые предложения появятся после обновления исследования.</p><div class="summary-numbers"><div class="summary-number"><strong>${deckStats.accepted}</strong><span>принято</span></div><div class="summary-number"><strong>${deckStats.rejected}</strong><span>отклонено</span></div><div class="summary-number"><strong>${deckStats.later}</strong><span>отложено</span></div></div><button type="button" class="ghost-button" data-close="deck">Вернуться в «Что дальше»</button></article>`
      return
    }
    $('#deckCard').innerHTML = `<article class="deck-card" data-deck-card><div class="deck-tags"><button type="button" class="deck-context" data-deck-focus="${escapeHtml(suggestion.node.id)}">${escapeHtml(suggestion.node.typeLabel)} · ${escapeHtml(suggestion.node.statusLabel)}</button><span class="deck-node-name">${escapeHtml(suggestion.node.label)}</span></div><h2 id="deckTitle">${escapeHtml(suggestion.move.title)}</h2><p class="deck-why">Какой вопрос закрываем: ${escapeHtml(suggestion.reason)}</p><div class="deck-move"><span><strong>На выходе</strong><small> ${escapeHtml(suggestion.move.output)}</small></span><span class="deck-cost">${escapeHtml(suggestion.move.duration)}</span></div><div class="deck-actions"><button type="button" class="accept" data-deck-action="accept">Добавить в план</button><button type="button" data-deck-action="reject">Отклонить</button><button type="button" data-deck-action="later">Позже</button></div></article>`
  }

  async function deckAction(action) {
    if (deckBusy || !snapshot.suggestions[0]) return
    deckBusy = true
    const suggestion = snapshot.suggestions[0]
    $$('#deckCard [data-deck-action]').forEach(button=>button.disabled=true)
    try {
      await api('/api/deck', { method: 'POST', body: { suggestionId: suggestion.id, action } })
      deckStats[action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'later']++
      await refresh({ silent: true }); renderDeck()
      if (action === 'reject') showToast('Отклонено — вернётся, если изменятся связанные данные.', 'Отменить', async () => { await api('/api/deck', { method: 'POST', body: { suggestionId: suggestion.id, action: 'undo' } }); await refresh({ silent: true }); renderDeck() }, 5000)
      if (action === 'later') showToast('Отложено — вернётся после новых результатов.')
    } catch (error) { showToast(error.message) }
    finally { deckBusy = false;$$('#deckCard [data-deck-action]').forEach(button=>button.disabled=false) }
  }

  function showToast(message, actionLabel, action, duration = 4200) {
    const toast = document.createElement('div')
    toast.className = 'toast'
    toast.innerHTML = `<span>${escapeHtml(message)}</span>${actionLabel ? `<button type="button">${escapeHtml(actionLabel)}</button>` : ''}`
    if (actionLabel) toast.querySelector('button').addEventListener('click', async () => { try { await action?.() } finally { toast.remove() } })
    $('#toastRegion').append(toast); setTimeout(() => toast.remove(), duration)
  }

  function askStop(threadId) {
    confirmAction = async () => {
      try { await api('/api/stop', { method: 'POST', body: { threadId } }); closeOverlay('confirmOverlay'); showToast('Работа агента остановлена.'); await refresh({ silent: true }) }
      catch (error) { showToast(error.message) }
    }
    openOverlay('confirmOverlay'); $('#confirmYes').focus({ preventScroll: true })
  }

  function handleEscape() {
    // Let the topmost native modal handle Escape and restore its own focus.
    if (document.querySelector('dialog:modal')) return false
    if (!$('#confirmOverlay').hidden) { closeOverlay('confirmOverlay'); return true }
    if (!$('#launchOverlay').hidden) { closeOverlay('launchOverlay'); return true }
    if (!$('#deckOverlay').hidden) { closeOverlay('deckOverlay'); return true }
    return Boolean(window.ProductGalaxy?.escape())
  }

  document.addEventListener('click', async event => {
    if(event.target.closest('[data-report-more]'))return filterReports('limit',event.target.closest('[data-report-more]').dataset.reportMore)
    if(event.target.closest('[data-report-reset]')){window.AtlasRouteState?.write('reports',{replace:true});return renderReports()}
    const tab = event.target.closest('[data-tab]'); if (tab) return setTab(tab.dataset.tab)
    const focus = event.target.closest('[data-focus]'); if (focus) return focusNode(focus.dataset.focus)
    const close = event.target.closest('[data-close]'); if (close) return closeOverlay(`${close.dataset.close}Overlay`)
    const move = event.target.closest('[data-move]'); if (move) return openLaunch(moveById(move.dataset.move))
    const retry = event.target.closest('[data-retry-move]'); if (retry) return openLaunch(moveById(retry.dataset.retryMove))
    const provider = event.target.closest('[data-launch-provider]'); if (provider) return launch(provider.dataset.launchProvider)
    if(event.target.closest('#launchCopyPrompt'))return copyText(launchMove.prompt+($('#launchContext').value.trim()?'\n\nУточнение пользователя:\n'+$('#launchContext').value.trim():''),event.target.closest('#launchCopyPrompt'))
    const copy = event.target.closest('[data-copy-command]'); if (copy) {const quote=value=>"'"+String(value).replaceAll("'","'\"'\"'")+"'",prompt=launchMove.prompt+($('#launchContext').value.trim()?'\n\nУточнение пользователя:\n'+$('#launchContext').value.trim():'');return copyText(`cd -- ${quote(snapshot.workspace)} && claude --bg --name ${quote(launchMove.title)} ${quote(prompt)}`,copy)}
    if (event.target.closest('[data-empty-hq]')) return openLaunch(snapshot.hqMove)
    if (event.target.closest('[data-copy-install]')) return copyText('product-os install', event.target.closest('[data-copy-install]'))
    if (event.target.closest('#deckBanner')) return openDeck()
    const deckButton = event.target.closest('[data-deck-action]'); if (deckButton) return deckAction(deckButton.dataset.deckAction)
    const deckFocus = event.target.closest('[data-deck-focus]'); if (deckFocus) { closeOverlay('deckOverlay'); return focusNode(deckFocus.dataset.deckFocus) }
    const openAgent = event.target.closest('[data-open-agent]'); if (openAgent) { try { await api('/api/open', { method: 'POST', body: { threadId: openAgent.dataset.openAgent } }) } catch (error) { showToast(error.message) } return }
    const stop = event.target.closest('[data-stop-agent]'); if (stop) return askStop(stop.dataset.stopAgent)
    const reportToggle = event.target.closest('[data-report-toggle]'); if (reportToggle) { const id = reportToggle.dataset.reportToggle; expandedReports.has(id) ? expandedReports.delete(id) : expandedReports.add(id); renderReports(); return }
    const skillToggle = event.target.closest('[data-skill-toggle]'); if (skillToggle) { const id = skillToggle.dataset.skillToggle; expandedSkills.has(id) ? expandedSkills.delete(id) : expandedSkills.add(id); renderSkills(); return }
    if (event.target.closest('[data-goto-next]')) { setTab('next'); return }
    const skillLaunch = event.target.closest('[data-skill-launch]')
    if (skillLaunch) {
      const select = $(`[data-skill-target="${CSS.escape(skillLaunch.dataset.skillLaunch)}"]`)
      try { openLaunch(await api('/api/move', { method: 'POST', body: { skill: skillLaunch.dataset.skillLaunch, nodeId: select.value } })) } catch (error) { showToast(error.message) }
      return
    }
    const ingest = event.target.closest('[data-ingest-report]')
    if (ingest) { try { openLaunch(await api('/api/report-move', { method: 'POST', body: { path: ingest.dataset.ingestReport, nodeId: ingest.dataset.nodeId } })) } catch (error) { showToast(error.message) }; return }
    if (event.target.closest('#graphStatus')) { const status = snapshot.graphStatus; return showToast(status.state === 'saved' ? `Последнее сохранение карты: ${formatTime(status.mtime)}.` : `${status.message || ''} ${status.recovery || ''}`.trim(), null, null, 7000) }
    if (event.target.closest('#hqButton')) return openLaunch(snapshot.hqMove)
  })

  $('#deckCard').addEventListener('dblclick', event => { event.preventDefault(); event.stopPropagation() })
  $('#confirmYes').addEventListener('click', () => confirmAction?.())
  document.addEventListener('keydown', event => {
    const tab = event.target.closest?.('[role="tab"]')
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const tabs = $$('.tab')
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
      event.preventDefault()
      setTab(tabs[index].dataset.tab)
      tabs[index].focus({ preventScroll: true })
      return
    }
    if (event.key !== 'Escape') return
    if (handleEscape()) event.preventDefault()
  })
  window.addEventListener('product-galaxy:move', event => openLaunch(event.detail.move))
  window.addEventListener('product-galaxy:refresh', () => refresh({ silent: true }))

  refresh()
  setInterval(() => refresh({ silent: true }), 6000)
})()
