import {channelContentMode,isChannelContent} from './channel-content.js'
import * as UI from './ui-components.js'
(() => {
  'use strict'
  const $ = s => document.querySelector(s)
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const uid = type => `${type}-${crypto.randomUUID()}`
  let snapshot, comm, initialized = false, busy = false, error = '', notice = ''
  let structureEditing = null
  const state = { scope: '', segment: '', tab: 'channels', channelOpen: false, channelView: 'content', contentEditor: '', graphJob: '', graphCore: '', graphZoom: 1, journey: '', contact: '', channel: '', rubric: '', material: '', competitor: '' }
  const drafts = new Map()
  const draftStorageKey = () => `product-os:communication-drafts:${snapshot?.workspace}`
  let draftsStored = true
  const persistDrafts = () => { try { localStorage.setItem(draftStorageKey(), JSON.stringify([...drafts])); draftsStored = true } catch { draftsStored = false } }
  const draftKey = f => `${f.dataset.commForm}:${f.dataset.id}:${f.dataset.commContext || ''}`
  const draftStatus = () => draftsStored ? 'Черновик сохранён в этом браузере. Изменения ещё не применены.' : 'Есть несохранённые изменения. Не закрывайте вкладку: браузер не смог сохранить черновик.'
  const formError = error => /fetch|network|load failed/i.test(error?.message || '') ? 'Не удалось связаться с консолью. Проверьте соединение и повторите сохранение.' : error?.message || 'Не удалось сохранить. Проверьте поля и повторите.'
  function growFields(root) { for (const el of root.querySelectorAll('textarea')) { if (!el.getClientRects().length) continue; el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px` } }
  function validateForm(f) {
    let first
    for (const control of f.querySelectorAll('input,textarea,select')) {
      const message = control.required && !control.value.trim() ? 'Заполните это поле.' : control.type === 'url' && control.value && !/^https?:\/\/[^\s]+$/i.test(control.value) ? 'Укажите полный адрес, начиная с https:// или http://.' : !control.validity.valid ? 'Проверьте значение поля.' : ''
      UI.setFieldError(control, message)
      if (!message) continue
      first ||= control
    }
    if (first) { for (let parent = first.parentElement; parent && parent !== f; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true; first.focus(); growFields(f) }
    return !first
  }
  const currentDirtyForm = () => [...document.querySelectorAll('[data-comm-form]')].find(f => f.getClientRects().length && drafts.has(draftKey(f)))
  const canLeave = () => !currentDirtyForm() || window.confirm(draftsStored ? 'Изменения ещё не применены. Уйти? Черновик сохранён в этом браузере и будет восстановлен при возвращении.' : 'Черновик не удалось сохранить в браузере. Уйти и потерять изменения?')

  const editingChannels = new Set()
  const creatingJourneys = new Set()
  const legacySeeds = new Map()
  const journeyContext = () => `${state.scope}:${state.segment}`
  const channelPlatforms = ['Веб-сайт', 'Telegram', 'Email-рассылка', 'Блог / сайт', 'Сайт', 'Лендинг', 'Twitter / X', 'Facebook', 'Instagram', 'YouTube', 'ВКонтакте', 'Подкаст', 'Сообщество', 'Другое']
  const all = type => (comm?.nodes || []).filter(n => n.type === type)
  const node = id => comm?.nodes.find(n => n.id === id)
  const targets = (id, type) => (comm?.edges || []).filter(e => e.from === id && e.type === type).map(e => e.to)
  const sources = (id, type) => (comm?.edges || []).filter(e => e.to === id && e.type === type).map(e => e.from)
  const related = (id, type) => targets(id, type).map(node).filter(Boolean)
  const inScope = ids => !state.scope || ids.some(id => comm.offerIds.includes(id))
  const segments = () => all('segment').filter(n => comm.segmentIds.includes(n.id))
  const pathsInScope = () => all('journey').filter(n => inScope(targets(n.id, 'journey_offer')))
  const journeys = () => all('journey').filter(n => inScope(targets(n.id, 'journey_offer')) && (!state.segment || targets(n.id, 'journey_segment').includes(state.segment)))
  const channels = () => all('channel').filter(n => (inScope([n.id, ...targets(n.id, 'channel_offer')]) || journeys().some(j => related(j.id, 'has_contact').some(t => targets(t.id, 'contact_channel').includes(n.id)))) && (!state.segment || targets(n.id, 'channel_segment').includes(state.segment) || (n.data?.contexts || []).some(c => c.segmentId === state.segment) || !targets(n.id, 'channel_segment').length || journeys().some(j => related(j.id, 'has_contact').some(t => targets(t.id, 'contact_channel').includes(n.id)))))
  const materials = () => all('artifact').filter(n => n.data?.kind === 'communication_material' && ((inScope(targets(n.id, 'material_offer')) && (!state.segment || targets(n.id, 'material_segment').includes(state.segment) || !targets(n.id, 'material_segment').length)) || journeys().some(j => related(j.id, 'has_contact').some(t => targets(t.id, 'uses_material').includes(n.id)))))
  const stages = { idea: 'Идея', draft: 'Черновик', review: 'Редактура', ready: 'Готов к публикации' }
  const outcomes = { continue: 'Продолжить', change: 'Изменить', defer: 'Отложить' }
  const remember = () => { if (snapshot) { try { localStorage.setItem(`product-os:communications:${snapshot.workspace}`, JSON.stringify({ ...state, mode: window.ProductGalaxy?.getMode() || 'map' })) } catch {} } }
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))
  const persistContext = () => { remember(); render() }
  const listOptions = (items, chosen = '', empty = 'Не выбрано') => `<option value="">${esc(empty)}</option>${items.map(n => `<option value="${esc(n.id)}" ${n.id === chosen ? 'selected' : ''}>${esc(n.label)}</option>`).join('')}`
  const field = (name, label, value = '', type = 'text', required = false) => UI.field({name,label,value,type,required})
  const area = (name, label, value = '', required = false) => UI.field({name,label,value,type:'textarea',required})
  const select = (name, label, items, value = '', required = false) => UI.field({name,label,type:'select',optionsHtml:listOptions(items,value),required})
  const checks = (name, label, items, selected = []) => `<fieldset class="comm-checks"><legend>${esc(label)}</legend>${items.length ? items.map(n => `<label><input type="checkbox" name="${name}" value="${esc(n.id)}" ${selected.includes(n.id) ? 'checked' : ''}>${esc(n.label)}</label>`).join('') : '<p class="comm-muted">Пока нет вариантов.</p>'}</fieldset>`
  const readingActions=new Set(['channel','graph-channel','tab','material','edit-channel-material','channel-view','channels-home','materials-home','close-channel-material','open-channel-contact','journey','contact','reload-records','close-references','graph-tab','graph-fullscreen','graph-exit']);
  const button = (action, label, id = '', extra = '') => !readingActions.has(action)?'':UI.button({label,attributes:`data-comm-action="${esc(action)}" data-id="${esc(id)}" ${extra}`})
  const form = (kind, id, content, label = 'Сохранить', actions = '') => '' && UI.editorLayout({className:'comm-form',attributes:`novalidate data-comm-form="${kind}" data-id="${esc(id)}" data-revision="${comm.revision}"`,content,actions:UI.button({label,variant:'primary',type:'submit'})+actions+'<span class="comm-save-state" role="status"></span>'})
  const create = () => ''; // Overview never offers creation or agent launches.
  const empty = text => UI.emptyState({kind:"first-use",description:text})
  const card = (title, body, source='') => `<section class="comm-card"><h3>${source?UI.sourceNote({text:title,content:source}):esc(title)}</h3>${body}</section>`
  const documentSource = (source,label='Открыть исходный документ',context='') => /^(reports|sources)\/.+\.md(?:#.*)?$/.test(source||'')&&!source.includes('..') ? {title:label==='Открыть исходный документ'?'Исходный документ':label,relation:'Документ',href:'/source?path='+encodeURIComponent(source.split('#')[0]),linkLabel:label+' ↗',context,details:`<details><summary>Сведения об источнике</summary><p>${esc(source)}</p><p>Ссылка открывает документ целиком; точный фрагмент не указан.</p></details>`} : null
  const reportLink = (source,label='Открыть исходный документ',context='') => {const entry=documentSource(source,label,context);return entry?UI.sourceEntry(entry):''}
  const referenceSource = (reference,context='',details='') => ({title:reference.label,relation:reference.data?.matchKind==='format'?'Референс подачи':'Редакционный референс',href:/^https?:\/\//i.test(reference.data?.url||'')?reference.data.url:'',linkLabel:'Открыть пример ↗',context,details})

  const link = (url, label) => /^https?:\/\//i.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label || url)} ↗</a>` : ''
  const offerChecks = (relation, selected) => checks(relation, 'Продукты и направления · можно выбрать несколько', comm.products, selected)
  const chosenOffers = () => state.scope ? [state.scope] : comm.products[0] ? [comm.products[0].id] : []
  const currentJobOptions = () => related(state.segment, 'performs')
  const referenceList = ids => all('reference').filter(n => targets(n.id, 'reference_for').some(id => ids.includes(id)))
  const referenceBlock = ids => `${referenceList(ids).map(n => `<section class="comm-reference"><p>${UI.sourceNote({text:n.data?.note||n.label,content:UI.sourceEntry(referenceSource(n))})}</p>${create('Редактировать референс',referenceForm(n))}</section>`).join('') || empty('Референсов пока нет. Сохраните пример и поясните, что из него стоит проверить.')}${create('Добавить референс',referenceForm(null,ids))}`

  function productForm(n, parentId = state.scope) {
    return form('product', n?.id || '', field('label', 'Название продукта или направления', n?.label, 'text', true)
      + select('subproduct_of', 'В составе продукта · оставьте пустым для отдельного продукта', comm.products.filter(p => p.id !== n?.id), n ? targets(n.id, 'subproduct_of')[0] : parentId)
      + checks('serves', 'Какие сегменты обслуживает', all('segment'), n ? targets(n.id, 'serves') : state.segment ? [state.segment] : []), 'Сохранить', button('cancel-product', 'Отмена')).replace('data-comm-form="product"', `data-comm-form="product" data-comm-context="${esc(n ? '' : parentId)}"`)
  }
  function productPath(product) {
    const labels = [product.label], seen = new Set([product.id])
    let parent = comm.products.find(n => n.id === product.parentId)
    while (parent && !seen.has(parent.id)) { seen.add(parent.id); labels.unshift(parent.label); parent = comm.products.find(n => n.id === parent.parentId) }
    return labels.join(' / ')
  }
  function renderStructure() {
    const dialog = $('#productStructureDialog')
    if (!dialog.open) return
    const root = dialog.firstElementChild, focused = root.contains(document.activeElement) ? document.activeElement : null
    const focus = focused?.name ? { name: focused.name, start: focused.selectionStart, end: focused.selectionEnd } : null
    const laneScroll = [...root.querySelectorAll('.comm-route-scroll')].map(el => el.scrollLeft)
    const scroll = root.scrollTop
    const branch = (parentId = '', depth = 0) => depth > 15 ? '' : `<ul class="comm-product-tree">${comm.products.filter(n => n.parentId === parentId).map(n => `<li><div><strong>${esc(n.label)}</strong><small>${n.type === 'channel' ? 'Самостоятельное медиа' : parentId ? 'Направление продукта' : 'Продукт'}</small><div class="comm-actions">${button('select-product', 'Выбрать', n.id)}${n.type === 'product' ? button('edit-product', 'Изменить', n.id) : ''}${button('add-product', 'Добавить направление', n.id)}</div></div>${branch(n.id, depth + 1)}</li>`).join('')}</ul>`
    root.innerHTML = `<div class="comm-section-head"><h2 id="productStructureTitle">Структура продуктов</h2>${button('close-products', 'Закрыть')}</div><p>Курс, сообщество или отдельное направление могут входить в продукт. Вложенные элементы показаны под своим родителем.</p><div class="comm-notice" role="status">${esc(notice)}</div>${error ? `<div class="comm-error" role="alert">${esc(error)}${button('reload-records', 'Загрузить актуальные записи')}</div>` : ''}${structureEditing ? card(structureEditing.id ? 'Изменить продукт' : structureEditing.parentId ? `Новое направление: ${node(structureEditing.parentId)?.label || ''}` : 'Новый продукт', productForm(node(structureEditing.id), structureEditing.parentId)) : branch() + button('add-product', 'Добавить отдельный продукт')}`
    restoreForms(root)
    for (const control of root.querySelectorAll('input,textarea,select,button')) control.disabled = busy
    if (focus) { const control = root.querySelector(`[name="${CSS.escape(focus.name)}"]`); control?.focus({ preventScroll: true }); if (control?.setSelectionRange && focus.start != null) control.setSelectionRange(focus.start, focus.end) }
    root.querySelectorAll('.comm-route-scroll').forEach((el,i) => { el.scrollLeft = laneScroll[i] || 0 })
    root.scrollTop = scroll
  }
  function openStructure(productId) {
    if (productId) structureEditing = null
    error = ''; notice = ''
    const dialog = $('#productStructureDialog')
    UI.dialog(dialog).open()
    renderStructure()
    const target = productId ? dialog.querySelector(`[data-comm-action="add-product"][data-id="${CSS.escape(productId)}"]`) : dialog.querySelector('button')
    target?.focus()
  }
  function referenceForm(n, ids = []) {
    return form('reference', n?.id || '', field('label', 'Название референса', n?.label, 'text', true) + field('url', 'Ссылка на пример', n?.data?.url, 'url') + area('note', 'Что полезно и почему', n?.data?.note) + checks('reference_for', 'Связан с', [...all('touchpoint'), ...all('channel'), ...all('rubric'), ...all('competitor')], n ? targets(n.id, 'reference_for') : ids)).replace('data-comm-form="reference"', `data-comm-form="reference" data-comm-context="${esc(ids.join(','))}"`)
  }
  function journeyForm(n) {
    const seed = !n && legacySeeds.get(journeyContext()), seedContact = seed && (comm.legacy?.contacts || []).find(c => c.segmentId === seed.segmentId && c.channelId === seed.channelId)
    const content = (seedContact ? `<input type="hidden" name="legacyChannelId" value="${esc(seedContact.channelId)}"><input type="hidden" name="legacySegmentId" value="${esc(seedContact.segmentId)}"><p>Из исследования: ${esc(seedContact.label)}. ${esc(seedContact.orientationJob)}</p>` : '') + area('outcome', 'Что человек хочет получить в итоге', n?.data?.outcome)
      + '<p class="comm-muted">Например: принимать все заявки в одном месте и не терять их.</p>'
      + field('label', 'Название пути', n?.label || seedContact?.label, 'text', true)
      + '<p class="comm-muted">Например: «От статьи со сравнением способов — к пробе шаблона».</p>'
      + checks('journey_segment', 'Для каких сегментов · можно выбрать несколько', all('segment'), n ? targets(n.id, 'journey_segment') : [])
      + offerChecks('journey_offer', n ? targets(n.id, 'journey_offer') : chosenOffers())
    return form('journey', n?.id || '', content, n ? 'Сохранить' : 'Создать путь', n ? '' : button('cancel-journey', 'Отмена'))
      .replace('data-comm-form="journey"', `data-comm-form="journey" data-comm-context="${esc(n ? '' : journeyContext())}"`)
  }
  function legacyContactsView() {
    const contacts=comm.legacy?.contacts||[]
    return UI.readingSection({title:'Площадки из исследования',intro:'Сохранённые места поиска клиентов и сообщения. Это наблюдения и предложения; результаты привлечения в наш продукт ещё нужно проверить.',content:contacts.map(c=>UI.summaryCard({title:c.label,meta:`<p>${esc(node(c.segmentId)?.label||'Сегмент не указан')}</p>`,content:UI.proseFacts({items:[{label:'Задача клиента',value:esc(c.orientationJob||'Пока не записана')},{label:'Как обратиться',value:esc(c.tactic||'Пока не записано')},{label:'Сообщение',value:esc(c.message||'Пока не записано')} ]})+reportLink(c.source,'Источник наблюдения')})).join('')||empty('Площадки из исследования пока не записаны.')})
  }
  function pathIntro() {
    return UI.emptyState({kind:'first-use',title:'Пути клиентов пока не записаны',description:'Здесь будут сохранённые последовательности контактов с клиентами и их материалы.'})
  }
  function contactForm(n, journeyId = state.journey) {
    const channel = n ? targets(n.id, 'contact_channel')[0] : ''
    return form('touchpoint', n?.id || '', `<input type="hidden" name="journeyId" value="${esc(journeyId)}">` + field('label', 'Название точки контакта', n?.label, 'text', true) + select('contact_job', 'Задача человека', [...new Map([...currentJobOptions(), ...related(n?.id, 'contact_job')].map(n => [n.id, n])).values()], n ? targets(n.id, 'contact_job')[0] : '') + field('surface', 'Где человек встретит нас · поиск, статья, пост, встреча', n?.data?.surface) + area('intent', 'Что искал или хотел понять человек', n?.data?.intent || n?.data?.orientationJob) + area('benefit', 'Что человек сможет понять или сделать после контакта', n?.data?.benefit) + area('message', 'Наше сообщение', n?.data?.message) + area('promiseBasis', 'На чём основано обещание', n?.data?.promiseBasis) + select('contact_channel', 'Канал', all('channel'), channel) + select('contact_rubric', 'Рубрика выбранного канала', all('rubric').filter(r => targets(r.id, 'rubric_channel').includes(channel)), n ? targets(n.id, 'contact_rubric')[0] : '') + checks('uses_material', 'Связанные материалы · можно использовать повторно', all('artifact').filter(n => n.data?.kind === 'communication_material'), targets(n?.id, 'uses_material')))
  }
  function contactSignals(id) {
    const items = related(id, 'uses_material'), observed = observationsFor(items.map(n => n.id)).length
    return [items.length ? `Материалов: ${items.length}` : 'Гипотеза контакта', items.some(n => n.data?.stage === 'ready') ? 'есть готовый текст' : '', items.some(n => n.data?.publicationUrl) ? 'есть публикация' : '', observed ? `наблюдений: ${observed}` : ''].filter(Boolean).join(' · ')
  }
  function assistantForm(kind, options = {}) {
    const channel = node(options.channelId), material = node(options.materialId)
    const defaults = { 'job-graph': 'Предложи путь клиента: где он впервые встретит нас, какое сообщение или материал увидит и как придёт к продукту. Укажи все сегменты, которым подходит этот путь.', rubrics: 'Предложи рубрики для аудитории этого канала.', material: material ? 'Доработай материал с учётом задачи аудитории.' : 'Подготовь материал для аудитории канала.' }
    return form('assistant-task', options.materialId || options.journeyId || options.channelId || '', `<input type="hidden" name="kind" value="${kind}"><input type="hidden" name="segmentId" value="${esc(state.tab === 'paths' ? '' : state.segment)}"><input type="hidden" name="journeyId" value="${esc(options.journeyId || '')}"><input type="hidden" name="contactId" value="${esc(options.contactId || '')}"><input type="hidden" name="materialId" value="${esc(options.materialId || '')}">`
      + (channel ? `<input type="hidden" name="channelId" value="${esc(channel.id)}"><p class="comm-muted">${esc(channel.label)}</p>` : kind === 'material' ? select('channelId', 'Для какого канала', channels(), '') : '')
      + area('instruction', 'Что поручить ИИ', defaults[kind], true), 'Подготовить с ИИ')
      .replace('data-comm-form="assistant-task"', `data-comm-form="assistant-task" data-comm-context="${esc(kind + ':' + (options.channelId || '') + ':' + state.segment)}"`)
  }
  const materialText = n => n?.data?.body ? `<div class="comm-reading-text">${esc(n.data.body).split(/\n\s*\n/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')}</div>` : empty('Текст ещё не сохранён.')
  function materialReader(material, channel) {
    const materialsChannels = related(material.id, 'material_channel')
    return `<article class="comm-material-reader"><div class="comm-section-head"><div><span class="comm-kicker">${esc(material.data?.format || 'МАТЕРИАЛ')} · ${esc(stages[material.data?.stage] || 'Идея')}</span><h2>${esc(material.label)}</h2></div>${create('Поручить правку ИИ', assistantForm('material', { materialId: material.id, channelId: channel?.id || materialsChannels[0]?.id }))}</div><p class="comm-muted">${materialsChannels.map(c => esc(c.label)).join(' · ') || 'Канал пока не выбран'}</p>${material.data?.keyMessage ? `<p class="comm-reader-purpose">${esc(material.data.keyMessage)}</p>` : ''}${materialText(material)}${material.data?.publicationUrl ? link(material.data.publicationUrl, 'Открыть публикацию') : ''}</article>`
  }
  function contactLane(journey) {
    const contacts = related(journey.id, 'has_contact')
    const ids = new Set(contacts.map(t => t.id))
    const edges = (journey.data?.transitions || []).filter(e => ids.has(e.from) && ids.has(e.to))
    const incoming = new Map(contacts.map(t => [t.id, edges.filter(e => e.to === t.id).length]))
    const rank = new Map(contacts.map(t => [t.id, 0])), queue = contacts.filter(t => incoming.get(t.id) === 0).map(t => t.id), visited = new Set()
    while (queue.length) {
      const id = queue.shift(); visited.add(id)
      for (const e of edges.filter(e => e.from === id)) {
        rank.set(e.to, Math.max(rank.get(e.to), rank.get(id) + 1))
        incoming.set(e.to, incoming.get(e.to) - 1)
        if (!incoming.get(e.to)) queue.push(e.to)
      }
    }
    // Unconnected contacts have no inferred sequence; cycles retain their recorded arrows.
    if (!edges.length) contacts.forEach((t,i) => rank.set(t.id,i))
    else contacts.filter(t => !visited.has(t.id)).forEach((t,i) => rank.set(t.id,contacts.length+i))
    const columns = [...new Set(rank.values())].sort((a,b) => a-b)
    const height = Math.max(1,...columns.map(c => contacts.filter(t => rank.get(t.id) === c).length)) * 190 + 16
    const positions = new Map()
    columns.forEach((column,x) => { const rows=contacts.filter(t => rank.get(t.id) === column); rows.forEach((t,y) => positions.set(t.id,{x:x*292+12,y:(height-rows.length*190)/2+y*190})) })
    const width = Math.max(1,columns.length)*292
    const arrow = 'route-arrow-' + journey.id
    return contacts.length ? `<div class="comm-route-scroll" tabindex="0" role="region" aria-label="Шаги пути: ${esc(journey.label)}"><div class="comm-route-canvas" style="width:${width}px;height:${height}px"><svg class="comm-route-edges" width="${width}" height="${height}" aria-hidden="true"><defs><marker id="${esc(arrow)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z"/></marker></defs>${edges.map(e => { const a=positions.get(e.from),b=positions.get(e.to); return `<path data-route-from="${esc(e.from)}" data-route-to="${esc(e.to)}" d="M${a.x+236},${a.y+82} C${a.x+264},${a.y+82} ${b.x-28},${b.y+82} ${b.x-6},${b.y+82}" marker-end="url(#${esc(arrow)})"/>` }).join('')}</svg>${contacts.map(t => { const pos=positions.get(t.id); return `<button type="button" class="comm-route-step" style="left:${pos.x}px;top:${pos.y}px" data-comm-action="route-step" data-id="${esc(t.id)}" data-journey="${esc(journey.id)}" aria-expanded="${state.journey === journey.id && state.contact === t.id}" aria-haspopup="dialog" aria-controls="route-detail-${esc(journey.id)}" aria-pressed="${state.journey === journey.id && state.contact === t.id}" title="${esc(t.label)}"><small>${esc(related(t.id,'contact_channel')[0]?.data?.platform || 'Контакт с продуктом')}</small><strong>${esc(t.label)}</strong><span>${esc(t.data?.surface || related(t.id,'contact_channel')[0]?.label || '')}</span><small>Подробнее →</small></button>` }).join('')}</div></div>${!edges.length && contacts.length>1 ? '<p class="comm-muted">Переходы ещё не заданы; порядок блоков не означает последовательность.</p>' : ''}` : empty('Точки контакта ещё не описаны.')
  }
  function rootStepFocus(id, journey) {
    document.querySelector(`[data-route="${CSS.escape(journey)}"] [data-comm-action="route-step"][data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true})
  }
  function contactDetail(journey, selected) {
    if (!selected) return ''
    const exits = (journey.data?.transitions || []).filter(e => e.from === selected.id)
    const fields = [['Что искал человек', selected.data?.intent || selected.data?.orientationJob], ['Где встретил нас', selected.data?.surface], ['Что получает', selected.data?.benefit], ['Что показываем', selected.data?.message]]
    const content = fields.map(([label,value]) => `<dt>${esc(label)}</dt><dd>${esc(value || 'Пока не описано')}</dd>`).join('')
    const actions = related(selected.id,'contact_channel').map(c => button('graph-channel',c.label,c.id)).join('')
    const materials = related(selected.id,'uses_material').map(m => button('material',m.label,m.id)).join('')
    const prepare = create('Подготовить материал', assistantForm('material',{channelId:targets(selected.id,'contact_channel')[0],contactId:selected.id,journeyId:journey.id}))
    return `<dialog class="os-dialog comm-contact-detail" data-route-dialog="${esc(journey.id)}" data-contact="${esc(selected.id)}" data-comm-editor="route-detail:${esc(journey.id)}" id="route-detail-${esc(journey.id)}" aria-label="${esc(selected.label)}"><div class="comm-section-head"><h3>${esc(selected.label)}</h3><div class="comm-actions">${create('Изменить контакт',contactForm(selected))}${button('close-route-step','Закрыть')}</div></div><dl class="comm-summary">${content}</dl><div class="comm-actions">${actions}</div><h4>Материалы шага</h4><div class="comm-actions">${materials}${prepare}</div>${exits.length ? '<h4>Куда дальше</h4>' + exits.map(e => `<p>${esc(node(e.to)?.label)}${e.condition ? ' · '+esc(e.condition):''}</p>`).join('') : ''}</dialog>`
  }
  function pathsView() {
    const paths = pathsInScope()
    if (!paths.some(j => j.id === state.journey)) { state.journey = ''; state.contact = '' }
    const heading = `<div class="comm-section-head"><div><h2>Пути к продукту</h2></div>${create('Предложить путь',assistantForm('job-graph'),'+ Путь с ИИ')}</div>`
    const rows = paths.map(journey => {
      const selected = state.journey === journey.id ? related(journey.id,'has_contact').find(t => t.id === state.contact) : null
      const audience = related(journey.id,'journey_segment').map(segment => `<span class="comm-path-segment">${esc(segment.label)}</span>`).join('') || '<span class="comm-muted">Аудитория пока не указана</span>'
      return `<article class="comm-path-card" data-route="${esc(journey.id)}"><div class="comm-section-head"><h3>${esc(journey.label)}</h3>${create('Настроить путь: '+journey.label,journeyForm(journey),'Настроить')}</div><div class="comm-path-segments" aria-label="Сегменты этого пути">${audience}</div>${contactLane(journey)}${contactDetail(journey,selected)}<div class="comm-actions">${create('Добавить контакт: '+journey.label,contactForm(null,journey.id),'Добавить шаг')}${create('Уточнить путь: '+journey.label,assistantForm('job-graph',{journeyId:journey.id}),'Уточнить с ИИ')}</div></article>`
    }).join('')
    return `<div class="comm-paths">${heading}<div class="comm-route-list">${rows || empty('Пути к продукту ещё не записаны.')}</div></div>`
  }
  function channelForm(n) {
    return form('channel', n?.id || '', '<p class="comm-muted">Начните с названия, площадки и адреса. Остальное можно уточнить позже.</p><fieldset><legend>Основное</legend>' + field('label', 'Название канала', n?.label, 'text', true) + select('platform', 'Площадка канала', [...new Set([...channelPlatforms, n?.data?.platform].filter(Boolean))].map(label => ({ id: label, label })), n?.data?.platform) + field('url', 'Адрес канала', n?.data?.url, 'url') + '</fieldset><details><summary>Задача, аудитория и связи с продуктом</summary><fieldset><legend>Содержание канала</legend>' + select('contentMode', 'Как устроено содержание', [{ id: 'page', label: 'Страницы и блоки сайта' }, { id: 'feed', label: 'Рубрики и публикации' }, { id: 'resource', label: 'Связанные материалы без ленты' }], channelContentMode(n)) + '</fieldset><fieldset><legend>Задача и аудитория</legend>' + area('purpose', 'Задача канала', n?.data?.purpose) + area('audience', 'Читатели и их задачи', n?.data?.audience) + area('promise', 'Что обещает канал', n?.data?.promise) + area('returnReason', 'Зачем возвращаться', n?.data?.returnReason) + area('roles', 'Роли канала · медиа, привлечение, поддержка…', n?.data?.roles) + `</fieldset><fieldset><legend>Связи с продуктом</legend><label class="comm-checks"><input type="checkbox" name="isOffering" ${n?.data?.isOffering ? 'checked' : ''}>Канал — самостоятельное предложение в выборе области</label>` + select('subproduct_of', 'Родитель самостоятельного канала', comm.products.filter(p => p.id !== n?.id), n ? targets(n.id, 'subproduct_of')[0] : '') + checks('channel_offer', 'Предложения, которым помогает канал', comm.products.filter(p => p.id !== n?.id), n ? targets(n.id, 'channel_offer') : chosenOffers()) + checks('channel_segment', 'Сегменты канала', all('segment'), n ? targets(n.id, 'channel_segment') : state.segment ? [state.segment] : []) + '</fieldset></details>', 'Сохранить изменения', n ? button('cancel-channel', 'Отмена', n.id) + button('channel-ai', 'Уточнить с ИИ', n.id) : '<span class="comm-muted">После сохранения можно поручить ИИ уточнить задачу и аудиторию канала.</span>')
  }
  function rubricForm(n) {
    return form('rubric', n?.id || '', field('label', 'Название рубрики', n?.label, 'text', true) + select('rubric_channel', 'Канал рубрики', all('channel'), n ? targets(n.id, 'rubric_channel')[0] : state.channel, true) + area('readerJob', 'Задача читателя', n?.data?.readerJob) + area('rationale', 'Почему эта рубрика нужна', n?.data?.rationale) + area('topics', 'Примеры тем · инструкции, находки, мнения, юмор, эксперименты', n?.data?.topics))
  }
  const isPageChannel = n => channelContentMode(n) === 'page'
  const channelContexts = n => Array.isArray(n?.data?.contexts) ? n.data.contexts : []
  const channelMaterials = id => all('artifact').filter(n => n.data?.kind === 'communication_material' && (targets(n.id, 'material_channel').includes(id) || sources(n.id, 'uses_material').some(t => targets(t, 'contact_channel').includes(id))))
  const contextLabel = c => [node(c.segmentId)?.label, c.situation].filter(Boolean).join(' · ') || 'Контекст без сегмента'
  function contextForm(channel, context) {
    const c = context || {}
    return form('channel-context', channel.id, `<input type="hidden" name="contextId" value="${esc(c.id || uid('context'))}">`
      + select('segmentId', 'Сегмент аудитории', all('segment'), c.segmentId || state.segment)
      + area('situation', 'В какой ситуации приходит человек', c.situation, true)
      + '<details><summary>Источник, сообщение и основания</summary>' + field('entry', 'Откуда приходит · источник и предыдущий контакт', c.entry)
      + area('known', 'Что уже знает и какие решения рассматривает', c.known)
      + area('criteria', 'Критерии успеха в его задаче', c.criteria)
      + area('purpose', 'Задача канала в этом контексте', c.purpose)
      + area('message', 'Что нужно донести до человека', c.message)
      + area('proof', 'Чем можем подтвердить · факты, примеры, ограничения', c.proof) + '</details>')
      .replace('data-comm-form="channel-context"', `data-comm-form="channel-context" data-comm-context="${esc(c.id || 'new')}"`)
  }
  function channelContextView(channel, {heading=true}={}) {
    const contexts = channelContexts(channel)
    return `<div class="comm-section-head">${heading?'<div><span class="comm-kicker">КТО ПРИХОДИТ И ЗАЧЕМ</span><h3>Контексты аудитории</h3></div>':''}${create('Добавить контекст', contextForm(channel))}</div>
      <p class="comm-muted">Один канал может встречаться в разных ситуациях. Описываем их отдельно, чтобы выбрать нужные смыслы и доказательства.</p>
      ${contexts.length ? contexts.map(c => `<article class="comm-context-card"><div class="comm-section-head"><span class="comm-status">${esc(node(c.segmentId)?.label || 'Сегмент не указан')}</span>${create('Изменить контекст', contextForm(channel, c))}</div><h3>${esc(c.situation)}</h3><p class="comm-entry">${esc(c.entry || 'Источник прихода пока неизвестен')}</p><dl class="comm-summary"><dt>Уже знает</dt><dd>${esc(c.known || 'Пока неизвестно')}</dd><dt>Критерии успеха</dt><dd>${esc(c.criteria || 'Нужно уточнить')}</dd><dt>Задача канала</dt><dd>${esc(c.purpose || 'Нужно описать')}</dd><dt>Что донести</dt><dd>${esc(c.message || 'Нужно сформулировать')}</dd><dt>Основание</dt><dd>${esc(c.proof || 'Доказательство пока не добавлено')}</dd></dl></article>`).join('') : empty('Ситуации и задачи аудитории ещё не записаны.')}`
  }
  function rubricTable(channel, rubrics, items) {
    const hasFit = rubrics.some(r => r.data?.editorialFit)
    const fitLabels = { keep: 'Подходит', adapt: 'Адаптировать', park: 'Отложить' }
    const fitLevels = { direct: 'Прямая', conditional: 'Условная', weak: 'Слабая' }
    const ordered = [...rubrics].sort((a, b) => (a.data?.sourceNumber ?? Infinity) - (b.data?.sourceNumber ?? Infinity))
    const disclosure = (key, title, body) => `<details data-rubric-detail="${esc(key)}"><summary>${esc(title)}</summary>${body}</details>`
    const rows = ordered.map((r, i) => {
      const d = r.data || {}, refs = referenceList([r.id])
      const fit = d.editorialFit
      const fitCell = hasFit ? `<td>${fit ? `<span class="comm-fit-badge" data-fit="${esc(fit.recommendation)}">${esc(fitLabels[fit.recommendation] || 'Не оценено')}</span><p class="comm-muted">Редакционная рекомендация</p><dl class="comm-fit-levels">${[['theme', 'Тема'], ['audience', 'Аудитория'], ['product', 'Продукт']].map(([key, label]) => `<dt>${label}</dt><dd>${esc(fitLevels[fit[key]] || 'Не оценено')}</dd>`).join('')}</dl><p>${esc(fit.reason)}</p>${fit.proposedTitle ? disclosure(`${r.id}:adaptation`, 'Версия для нашего канала', `<p><strong>${esc(fit.proposedTitle)}</strong></p><p>${esc(fit.businessExample)}</p>`) : ''}` : '<p class="comm-muted">Соответствие фокусу пока не оценено.</p>'}</td>` : ''
      const count = items.filter(m => m.data?.rubricId === r.id || sources(m.id, 'uses_material').some(t => targets(t, 'contact_rubric').includes(r.id))).length
      const decision = all('communication_decision').filter(n => targets(n.id, 'decides').includes(r.id)).at(-1)
      const status = decision ? outcomes[decision.data?.outcome] || 'Есть редакционное решение' : r.status === 'hypothesis' ? 'Гипотеза' : 'Статус не уточнён'
      const source = reportLink(d.hypothesisSource || r.source, 'Источник рубрики')
      const references = refs.length ? UI.sourceList({entries:refs.map(ref => {
        const note = ref.data?.note || '', lead = note.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || note
        const more = (note && lead !== note ? `<p>${esc(note)}</p>` : '') + (ref.data?.archivedResult ? `<p><strong>Что было зафиксировано в источнике</strong></p><p>${esc(ref.data.archivedResult)}</p>` : '')
        return referenceSource(ref,lead?`<p><strong>Что берём:</strong> ${esc(lead)}</p>`:'<p class="comm-muted">Что заимствуем — пока не описано.</p>',more?disclosure(`${r.id}:${ref.id}`,'Контекст и ограничения',more):'')
      })}) : `<p class="comm-muted">${d.originKind === 'editorial-hypothesis' ? 'Собственная редакционная идея. Внешний референс не заявлен.' : 'Референс пока не добавлен.'}</p>`

      return `<tr class="comm-rubric" data-rubric-id="${esc(r.id)}"><th scope="row"><span class="comm-rubric-number">${esc(String(d.sourceNumber ?? i + 1).padStart(2, '0'))}</span><strong>${UI.sourceNote({text:r.label,title:'Основания рубрики',content:source+references+(d.originSummary?`<p>${esc(d.originSummary)}</p>`:'')})}</strong>${d.group ? `<span class="comm-rubric-group">${esc(d.group)}</span>` : ''}<span class="comm-status">${esc(status)}</span></th>${fitCell}
        <td><p>${esc(d.readerJob || d.rationale || 'Задача читателя пока не описана.')}</p>${d.rationale && d.rationale !== d.readerJob ? disclosure(`${r.id}:rationale`, 'Почему стоит проверить', `<p>${esc(d.rationale)}</p>`) : ''}</td>
        <td><p>${esc(d.topics || 'Тема пока не предложена.')}</p>${d.format ? `<p class="comm-muted">${esc(d.format)}</p>` : ''}<small>${count} материалов</small>${d.testSignal ? disclosure(`${r.id}:signal`, 'Что проверить публикацией', `<p>${esc(d.testSignal)}</p>`) : ''}</td></tr>`
    }).join('')
    return `<div class="comm-section-head"><h3>Рубрики <span class="comm-muted">· ${rubrics.length}</span></h3><div class="comm-actions">${create('Подготовить рубрики', assistantForm('rubrics', { channelId: channel.id }), 'Предложить с ИИ')}${rubrics.length ? create('Доработать рубрики', assistantForm('rubrics', { channelId: channel.id }), 'Доработать с ИИ') : ''}</div></div>
      <p class="comm-muted">Повторяемые темы канала: зачем читать, о чём писать и на какие примеры опираться. Референс объясняет происхождение идеи; результат нашей публикации проверяется отдельно.</p>
      ${rubrics.length ? `<div class="comm-rubric-table-scroll" role="region" aria-label="Таблица рубрик" tabindex="0"><table class="comm-rubric-table ${hasFit ? 'comm-has-fit' : ''}"><caption class="comm-sr-only">Рубрики канала ${esc(channel.label)}: задачи читателя, темы и источники</caption><thead><tr><th scope="col">Рубрика</th>${hasFit ? '<th scope="col">Соответствие фокусу</th>' : ''}<th scope="col">Зачем читателю</th><th scope="col">Пример темы</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('Рубрик пока нет. ИИ предложит их из задачи канала и аудитории.')}`
  }
  function channelContentView(channel) {
    const page = isPageChannel(channel), order = channel.data?.contentOrder || []
    const items = channelMaterials(channel.id).sort((a,b) => (order.includes(a.id) ? order.indexOf(a.id) : 1e6) - (order.includes(b.id) ? order.indexOf(b.id) : 1e6))
    if (state.contentEditor) {
      const material = items.find(n => n.id === state.contentEditor)
      if (material) return `${UI.pageHeader({title:material.label,back:UI.button({label:'← К материалам канала',href:'#channel/'+encodeURIComponent(channel.id)+'?view=content'}),backTight:true})}${materialReader(material, channel)}`
      state.contentEditor = ''
    }
    const content = items.filter(n => isChannelContent(n, channel)), attached = items.filter(n => !isChannelContent(n, channel))
    const cards = rows => rows.map(n => UI.summaryCard({title:n.label,href:'#material/'+encodeURIComponent(n.id)+'?channel='+encodeURIComponent(channel.id),meta:`<p>${esc(isChannelContent(n,channel)?stages[n.data?.stage]||'Идея':n.data?.format||'Формат не указан')}</p>`,content:n.data?.keyMessage?`<p>${esc(n.data.keyMessage)}</p>`:''})).join('')
    return `${channelContentMode(channel) === 'resource' ? '' : `<div class="comm-section-head">${create(page ? 'Подготовить блок' : 'Подготовить пост', assistantForm('material', { channelId: channel.id }), page ? '+ Блок с ИИ' : '+ Пост с ИИ')}</div><div class="comm-content-list">${cards(content) || empty(page ? 'Страницы и блоки сайта ещё не подготовлены.' : 'Публикаций пока нет.')}</div>`}${attached.length ? `<section class="comm-related-materials"><h3>Связанные материалы</h3><p class="comm-muted">Документы, разборы и материалы других форматов. Связь с каналом не означает публикацию в нём.</p><div class="comm-content-list">${cards(attached)}</div></section>` : channelContentMode(channel) === 'resource' ? empty('Связанных материалов пока нет.') : ''}`

  }
  function channelsView() {
    const available = channels().filter(n => !(comm.legacy?.placementIds || []).includes(n.id))
    if (!available.some(n => n.id === state.channel)) { state.channel = ''; state.channelOpen = false; state.contentEditor = '' }
    const channel = state.channelOpen && node(state.channel)
    if (!channel) return `<div class="comm-channel-overview"><div class="comm-section-head"><div><h2>Ваши каналы</h2></div>${create('Создать канал', channelForm(), '+ Добавить канал')}</div><div class="comm-channel-grid">${available.map((n,i) => {
      const contexts = channelContexts(n), items = channelMaterials(n.id), segments = [...new Map([...related(n.id, 'channel_segment'), ...contexts.map(c => node(c.segmentId)).filter(Boolean)].map(n => [n.id, n])).values()]
      return UI.summaryCard({title:n.label,className:'comm-channel-entry',meta:`<p>${esc(n.data?.platform||'Площадка не указана')}</p>`,content:`<p>${esc(n.data?.purpose||n.data?.promise||'Задача канала пока не описана')}</p>`+UI.proseFacts({items:[{label:'Аудитория',value:esc(segments.map(s=>s.label).join(' · ')||n.data?.audience||'Нужно определить')},{label:'Контекст прихода',value:esc(contexts[0]?.situation||'Пока не описан')+(contexts.length>1?`<span class="comm-more"> + ещё ${contexts.length-1}</span>`:'')}]}),href:'#channel/'+encodeURIComponent(n.id)})
    }).join('') || UI.emptyState(state.segment ? {kind:'no-results',title:'Каналы для этого сегмента не найдены',description:'Выберите другой сегмент или покажите все каналы.',actions:button('clear-segment','Все сегменты')} : {kind:'first-use',title:'Каналы пока не записаны',description:'Здесь появятся сохранённые площадки и материалы общения с клиентами.'})}</div></div>`
    const items = channelMaterials(channel.id)
    const rubrics = all('rubric').filter(n => targets(n.id, 'rubric_channel').includes(channel.id))
    const page = isPageChannel(channel)
    const channelHeader=UI.pageHeader({title:channel.label,back:button('channels-home','← Все каналы'),backTight:true,actions:/^https?:\/\//i.test(channel.data?.url||'')?UI.button({label:'Открыть канал',href:channel.data.url,attributes:{target:'_blank',rel:'noopener noreferrer'}}):''})
    const sections=[{id:'channel-purpose',title:'Задача канала',content:`<p>${esc(channel.data?.purpose||channel.data?.promise||'Задача канала ещё не описана.')}</p>`+UI.factLine({label:'Площадка',value:esc(channel.data?.platform||'Площадка не указана')})+(!channel.data?.url?'<p>Адрес не указан</p>':'')+(channel.data?.isOffering?'<p>Самостоятельный субпродукт</p>':'')+(channel.data?.audience?`<p>${esc(channel.data.audience)}</p>`:'')},
     {id:'channel-audience',title:'Контексты аудитории',content:channelContextView(channel,{heading:false})},
     {id:'channel-content',title:page?'Страницы и блоки сайта':channelContentMode(channel)==='feed'?'Публикации':'Материалы канала',intro:page?'Рабочие блоки страницы, которые нужно проверить и перенести на сайт.':'Материалы, через которые канал доносит обещание и помогает аудитории сделать следующий шаг.',content:channelContentView(channel)},
     ...(channelContentMode(channel)==='feed'?[{id:'channel-rubrics',title:'Рубрики',content:rubricTable(channel,rubrics,items)}]:[])]
    const topics=[['overview','Обзор'],['content','Материалы'],['rubrics','Рубрики'],['references','Источники']],active=topics.some(([id])=>id===state.channelView)?state.channelView:'overview'
    const nav=UI.topicNav({label:'Разделы канала',active,items:topics.map(([id,label])=>({id,label,attributes:{'data-comm-action':'channel-view','data-id':id}}))})
    const selected=active==='overview'?sections.filter(section=>['channel-purpose','channel-audience'].includes(section.id)):active==='content'?sections.filter(section=>section.id==='channel-content'):active==='rubrics'?[{id:'channel-rubrics',title:'Рубрики',content:rubrics.length?rubricTable(channel,rubrics,items):empty('Рубрики ещё не записаны.')}]:[{id:'channel-sources',title:'Источники канала',content:reportLink(channel.source,'Источник описания канала')+referenceBlock([channel.id])}]
    return `<div class="comm-channel-detail">${channelHeader}${nav}${state.contentEditor?channelContentView(channel):UI.readingSections({sections:selected,contentsTitle:'В разделе канала'})}</div>`
  }
  function materialForm(n, channel) {
    const channelId = channel?.id || (n ? targets(n.id, 'material_channel')[0] : targets(state.contact, 'contact_channel')[0])
    const contentChannel = channel || node(channelId)
    const page = isPageChannel(contentChannel)
    const publication = field('publicationUrl', 'Ссылка на публикацию · только после публикации', n?.data?.publicationUrl, 'url') + field('publishedAt', 'Дата публикации', n?.data?.publishedAt, 'date')
    return form('artifact', n?.id || '', `<input type="hidden" name="contactId" value="${esc(!n && !channel ? state.contact : '')}">` + field('label', 'Название материала', n?.label, 'text', true)
      + '<div class="comm-field-pair">' + select('stage', 'Готовность материала', Object.entries(stages).map(([id, label]) => ({ id, label })), n?.data?.stage || 'idea', true)
      + select('format', 'Формат', [...new Set(['Блок страницы', 'Пост', 'Статья', 'Лид-магнит', 'Лендинг', 'Демонстрация', 'Письмо', 'Документ', n?.data?.format].filter(Boolean))].map(label => ({ id: label, label })), n?.data?.format || (page ? 'Блок страницы' : 'Пост')) + '</div>'
      + select('material_channel', 'Канал материала', all('channel'), channelId)
      + select('contextId', 'Контекст аудитории', channelContexts(contentChannel).map(c => ({ id: c.id, label: contextLabel(c) })), n?.data?.contextId)
      + select('rubricId', 'Рубрика материала · необязательно', all('rubric').filter(r => targets(r.id, 'rubric_channel').includes(channelId)), n?.data?.rubricId)
      + area('keyMessage', 'Что должен понять человек', n?.data?.keyMessage)
      + area('criterion', 'Какой критерий успеха раскрываем', n?.data?.criterion)
      + area('proof', 'Доказательство и ограничения обещания', n?.data?.proof)
      + area('body', 'Текст материала', n?.data?.body) + create('Публикация и область материала', publication + offerChecks('material_offer', n ? targets(n.id, 'material_offer') : channel ? targets(channel.id, 'channel_offer') : chosenOffers())
      + checks('material_segment', 'Сегменты материала', all('segment'), n ? targets(n.id, 'material_segment') : channel ? targets(channel.id, 'channel_segment') : state.segment ? [state.segment] : []))).replace('data-comm-form="artifact"', `data-comm-form="artifact" data-comm-context="${esc(channel?.id || '')}"`)
  }
  function legacyMaterialView(material, legacy) {
    const previous = node(legacy.previousId)
    const kinds = { 'channel-concept': 'Концепция канала', 'editorial-profile': 'Голос автора', 'task-brief': 'Бриф', 'concept-outline': 'Концепция материала', 'source-backed-content-shortlist': 'Подборка источников', 'principles-and-editorial-rubric': 'Редакционные правила' }
    return card(material.label, `<p>Сохранённый документ и предыдущие версии доступны по ссылкам на источники.</p><dl class="comm-summary"><dt>Тип</dt><dd>${legacy.kind === 'content-pack' ? 'Пакет текстов · может содержать несколько постов' : esc(kinds[legacy.kind] || 'Рабочий документ')}</dd><dt>Готовность</dt><dd>${material.data?.readiness === 'ready-for-review' ? 'Подготовлен к редактуре' : 'Нужно уточнить перед публикацией'}</dd><dt>Канал</dt><dd>${esc(node(legacy.channelId)?.label || 'Не назначен')}</dd><dt>Сегменты</dt><dd>${legacy.segmentIds.map(id => esc(node(id)?.label)).join(', ') || 'Не назначены'}</dd></dl>${previous ? `<p>Основан на: ${UI.sourceNote({text:previous.label,content:reportLink(previous.source,'Предыдущий документ')})}.</p>` : ''}${reportLink(material.source)}<div class="comm-actions">${legacy.workingCopyId ? button('material', 'Открыть рабочую копию', legacy.workingCopyId) : button('import-material', 'Создать редактируемую копию', material.id)}</div><p class="comm-muted">В копию переносится весь документ. Публикация и эффективность не считаются подтверждёнными.</p>`)
  }
  function materialsView() {
    const available = materials()
    const documents = (comm.legacy?.documents || []).filter(d => !state.segment || !d.segmentIds.length || d.segmentIds.includes(state.segment))
    const material = available.find(n => n.id === state.material), legacy = documents.find(d => d.id === state.material)
    if (material || legacy) {
      const current = material || node(legacy.id)
      const visuals = (current?.data?.visualArtifactIds || []).map(node).filter(n => n?.data?.kind === 'visual-pack')
      const visualLinks = visuals.length ? card('Изображения к материалу',UI.sourceList({entries:visuals.map(n=>documentSource(n.source,n.label,`<p>${n.data.decision==='accepted'?'Оформление принято':'Предложено'} · ${n.data.readiness==='ready-for-review'?'Готово к просмотру':'Черновик'}</p>`)).filter(Boolean)})) : ''
      return `<div class="comm-library">${button('materials-home', '← Все материалы')}${legacy ? legacyMaterialView(node(legacy.id), legacy) : materialReader(material)}${visualLinks}</div>`
    }
    return UI.readingSection({title:'Материалы',content:`<div class="comm-material-grid">${available.map(n=>UI.summaryCard({title:n.label,href:'#material/'+encodeURIComponent(n.id),meta:`<p>${esc(n.data?.format||'Материал')} · ${esc(stages[n.data?.stage]||'Идея')}</p>`,content:`<p>${esc(n.data?.keyMessage||n.data?.body?.slice(0,140)||'Текст ещё не сохранён')}</p>`+UI.factLine({label:'Каналы',value:esc(related(n.id,'material_channel').map(c=>c.label).join(' · ')||'Связь с каналом не указана')})})).join('')||empty('Материалы пока не сохранены.')}</div>${documents.length?'<h3>Из отчётов</h3>'+documents.map(d=>UI.summaryCard({title:node(d.id)?.label||'Документ',href:'#material/'+encodeURIComponent(d.id)})).join(''):''}`})
  }
  const observationsFor = ids => all('evidence').filter(n => [...sources(n.id, 'evidenced_by'), ...sources(n.id, 'contradicted_by')].some(id => ids.includes(id)))
  function resultsView() {
    const rubrics = all('rubric').filter(n => channels().some(c => targets(n.id, 'rubric_channel').includes(c.id)))
    if (!rubrics.some(n => n.id === state.rubric)) state.rubric = rubrics[0]?.id || ''
    const rubric = node(state.rubric)
    const rubricMaterials = [...new Set([...sources(state.rubric, 'contact_rubric').flatMap(id => targets(id, 'uses_material')), ...all('artifact').filter(n => n.data?.rubricId === state.rubric).map(n => n.id)])]
    const relevant = [...materials(), ...rubrics]
    const target = relevant.find(n => n.id === state.material)?.id || state.rubric || relevant[0]?.id || ''
    const observations = observationsFor(relevant.map(n => n.id))
    const evidence = observationsFor([state.rubric, ...rubricMaterials]).concat(all('evidence').filter(n => n.data?.rubricIds?.includes(state.rubric))).filter((n, i, rows) => rows.findIndex(r => r.id === n.id) === i)
    const decisions = all('communication_decision').filter(n => targets(n.id, 'decides').includes(state.rubric)).reverse()
    const observationForm = form('observe', '', select('target', 'Материал или рубрика', relevant, target, true) + area('text', 'Что наблюдали · без вывода об эффективности', '', true)
      + field('source', 'Первичный источник · ссылка или sources/…', '', 'text', true) + '<div class="comm-field-pair">' + field('windowStart', 'Начало измерения', '', 'date', true)
      + field('windowEnd', 'Конец измерения', '', 'date', true) + '</div>', 'Добавить наблюдение')
    const decisionForm = rubric ? form('decide', rubric.id, select('outcome', 'Следующее действие', Object.entries(outcomes).map(([id, label]) => ({ id, label })), 'change', true)
      + area('rationale', 'Вывод и основание решения', '', true) + checks('evidenceIds', 'Наблюдения, на которые опираемся', evidence)
      + '<p class="comm-muted">Без наблюдений решение останется редакционным выбором, а не выводом об эффективности.</p>', 'Зафиксировать решение') : ''
    return `<div class="comm-results"><div>${card('Наблюдаемые результаты', '<p>Что произошло, откуда это известно и за какой период. Нулевой или отрицательный результат тоже полезен.</p>'
      + (relevant.length ? create('Добавить наблюдение', observationForm) : empty('Сначала создайте материал или рубрику.')))}
      ${observations.map(n => card(n.label, `<p>${[...sources(n.id, 'evidenced_by'), ...sources(n.id, 'contradicted_by')].map(id => esc(node(id)?.label)).join(', ')}</p>
      <p class="comm-muted">${esc(n.data?.windowStart || 'Окно не указано')} — ${esc(n.data?.windowEnd || '')}</p>
      `, UI.sourceEntry({title:'Первичный источник',href:/^https?:\/\//i.test(n.source||'')?n.source:n.source?'/source?path='+encodeURIComponent(n.source):'',meta:[n.data?.windowStart,n.data?.windowEnd].filter(Boolean).join(' — ')}))).join('') || empty('Наблюдений пока нет. Готовность материалов не говорит об эффективности.')}</div>
      <div>${card('Решение по рубрике', `${UI.field({label:'Рубрика',type:'select',optionsHtml:listOptions(rubrics,state.rubric),attributes:'data-comm-rubric'})}
      ${decisions.map(n => `<article class="comm-decision"><strong>${esc(outcomes[n.data.outcome])}</strong><p>${esc(n.label)}</p><small>${esc(new Date(n.data.at).toLocaleString('ru-RU'))} · ${targets(n.id, 'based_on').length ? 'С опорой на наблюдения' : 'Редакционное решение · без данных'}</small></article>`).join('')}
      ${rubric ? create('Зафиксировать решение', decisionForm) : empty('Сначала подготовьте рубрику внутри канала.')}`)}</div></div>`
  }
  function restoreForms(root) {
    for (const f of root.querySelectorAll('[data-comm-form]')) {
      const draft = drafts.get(`${f.dataset.commForm}:${f.dataset.id}:${f.dataset.commContext || ''}`)
      if (!draft) continue
      f.dataset.revision = draft.revision
      f.querySelectorAll('details').forEach((el,i)=>{if((draft.openDetails||[]).includes(i))el.open=true})
      // Channel first, then rebuild the dependent rubric options before restoring values.
      for (const e of f.elements) if (e.name && e.type !== 'submit') {
        if (e.type === 'checkbox') e.checked = (draft.values[e.name] || []).includes(e.value)
        else e.value = draft.values[e.name]?.[0] || ''
        if (e.name === 'contact_channel') updateRubrics(f)
        if (e.name === 'material_channel' && f.elements.contextId) {
          f.elements.contextId.innerHTML = listOptions(channelContexts(node(e.value)).map(c => ({ id: c.id, label: contextLabel(c) })))
          f.elements.rubricId.innerHTML = listOptions(all('rubric').filter(r => targets(r.id, 'rubric_channel').includes(e.value)))
        }
      }
      f.querySelector('.comm-save-state').textContent = draftStatus()
    }
  }
  function render() {
    if (!comm) return
    state.segment='';state.competitor='';
    const root = $('#communicationsCenter')
    root.classList.remove('comm-in-channel')
    root.classList.toggle('comm-in-paths', state.tab === 'paths')
    root.classList.toggle('comm-reading', Boolean(state.contentEditor) && state.tab === 'channels')
    const rubricDetails = [...root.querySelectorAll('details[data-rubric-detail][open]')].map(el => el.dataset.rubricDetail)
    const rubricScroll = root.querySelector('.comm-rubric-table-scroll')?.scrollLeft || 0
    const rubricFocus = root.contains(document.activeElement) && document.activeElement?.tagName === 'SUMMARY' ? document.activeElement.parentElement.dataset.rubricDetail : ''
    const openEditors = [...root.querySelectorAll('dialog[open]')].map(dialog => dialog.dataset.commEditor)
    const laneScroll = [...root.querySelectorAll('.comm-route-scroll')].map(el => el.scrollLeft)
    const scroll = root.scrollTop
    const graphScroll = root.querySelector('.comm-job-viewport')?.scrollLeft || 0
    const focused = root.contains(document.activeElement) ? document.activeElement : null
    const focusForm = focused?.closest('[data-comm-form]')
    const focusInfo = focusForm && focused.name ? { kind: focusForm.dataset.commForm, id: focusForm.dataset.id, name: focused.name, start: focused.selectionStart, end: focused.selectionEnd } : null
    const choices = $('#productScope')
    const options = `<option value="">Все продукты</option>${comm.products.map(p => `<option value="${esc(p.id)}" ${p.id === state.scope ? 'selected' : ''}>${esc(productPath(p))}</option>`).join('')}`
    if (choices.innerHTML !== options) choices.innerHTML = options
    const parent = comm.products.find(p => p.id === comm.products.find(n => n.id === state.scope)?.parentId)
    $('#scopeParent').hidden = !state.scope
    $('#scopeParent').textContent = parent ? `← ${parent.label}` : '← Все продукты'
    const selected = node(state.segment)
    const header = UI.pageHeader({title:'Каналы коммуникации'})
    const filters = ''
    const nav = UI.topicNav({label:'Работа с коммуникациями',active:state.tab,items:[['channels','Каналы'],['paths','Пути и контакты'],['materials','Материалы'],['research','Из исследования']].map(([id,label])=>({id,label,attributes:{'data-comm-action':'tab','data-id':id}}))})
    if (state.tab === 'results') state.tab = 'channels'
    const content = state.competitor ? card(`Референсы: ${node(state.competitor)?.label || ''}`, button('close-references', 'Вернуться к коммуникациям') + referenceBlock([state.competitor])) : state.tab === 'paths' ? pathsView() : state.tab === 'channels' ? channelsView() : state.tab === 'research' ? (legacyContactsView() || empty('Площадки из исследования пока не записаны.')) : materialsView()
    for (const element of root.querySelectorAll('dialog')) UI.dialog(element).destroy()
    const channelDetail = state.tab === 'channels' && state.channelOpen && node(state.channel) && !state.competitor
    root.innerHTML = (channelDetail ? UI.detailLayout : UI.collectionLayout)({header:channelDetail?'':header,nav:channelDetail?'':nav,filters:channelDetail?'':filters,notice:UI.notice({message:notice,className:'comm-notice',hidden:!notice})+UI.notice({kind:'error',message:error,actions:button('reload-records','Загрузить актуальные записи'),className:'comm-error',hidden:!error}),content})
    for (const key of openEditors) UI.dialog(root.querySelector(`[data-comm-editor="${CSS.escape(key)}"]`))?.open(root.querySelector(`[data-comm-action="open-editor"][data-id="${CSS.escape(key)}"]`))
    for (const key of rubricDetails) { const el = root.querySelector(`[data-rubric-detail="${CSS.escape(key)}"]`); if (el) el.open = true }
    if (rubricFocus) root.querySelector(`[data-rubric-detail="${CSS.escape(rubricFocus)}"] > summary`)?.focus({ preventScroll: true })
    if (root.querySelector('.comm-rubric-table-scroll')) root.querySelector('.comm-rubric-table-scroll').scrollLeft = rubricScroll
    restoreForms(root)
    for (const el of root.querySelectorAll('button[type="submit"]')) el.disabled = busy
    if (focusInfo) {
      const control = root.querySelector(`[data-comm-form="${CSS.escape(focusInfo.kind)}"][data-id="${CSS.escape(focusInfo.id)}"] [name="${CSS.escape(focusInfo.name)}"]`)
      control?.focus({ preventScroll: true }); if (control?.setSelectionRange && focusInfo.start != null) control.setSelectionRange(focusInfo.start, focusInfo.end)
    }
    root.querySelectorAll('.comm-route-scroll').forEach((el,i) => { el.scrollLeft = laneScroll[i] || 0 })
    root.scrollTop = scroll
    if (root.querySelector('.comm-job-viewport')) root.querySelector('.comm-job-viewport').scrollLeft = graphScroll
    growFields(root)
    renderStructure()
  }
  function updateRubrics(f) {
    const channel = f.elements.contact_channel?.value, rubric = f.elements.contact_rubric
    if (rubric) { const selected = rubric.value; rubric.innerHTML = listOptions(all('rubric').filter(n => targets(n.id, 'rubric_channel').includes(channel)), selected) }
  }
  async function api(url, body) {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-product-os-token': snapshot.csrfToken }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Не удалось сохранить')
    return result
  }
  async function write(body, revision = comm.revision) {
    return api('/api/communications', { ...body, expectedRevision: revision })
  }
  async function reload() {
    const response = await fetch(`/api/snapshot?scope=${encodeURIComponent(state.scope)}`)
    if (!response.ok) throw new Error('Не удалось обновить данные')
    const next = await response.json()
    update(next)
    emit('product-galaxy:refresh')
  }
  async function requestAssistant(f) {
    const values = new FormData(f), get = name => String(values.get(name) || '')
    const kind = get('kind'), materialId = get('materialId')
    const task = { kind, instruction: get('instruction'), channelId: get('channelId'), segmentId: get('segmentId'), journeyId: get('journeyId'), contactId: get('contactId') }
    const skill = { 'job-graph': 'product-channel-concept', rubrics: 'product-channel-concept', material: 'product-content' }[kind]
    const productId = targets(task.journeyId, 'journey_offer')[0] || targets(materialId, 'material_offer')[0] || targets(task.channelId, 'channel_offer')[0] || state.scope || comm.products[0]?.id
    const target = (kind === 'job-graph' ? productId : task.channelId) || productId
    busy = true; error = ''; f.querySelector('button[type=submit]').disabled = true
    try {
      const move = await api('/api/move', { nodeId: target, skill, ...(materialId ? { materialId } : {}), communicationTask: task })
      f.closest('dialog')?.close()
      drafts.delete(draftKey(f)); persistDrafts()
      emit('product-galaxy:move', { move })
      notice = 'Поручение готово. Запустите ИИ в открывшемся окне.'
    } catch(e) { error = formError(e) }
    finally { busy = false; render() }
  }
  async function saveForm(f) {
    if (busy || f.dataset.saving === 'true' || !validateForm(f)) return
    if (f.dataset.commForm === 'assistant-task') return requestAssistant(f)
    const values = new FormData(f), get = name => String(values.get(name) || ''), multi = name => values.getAll(name).map(String)
    const type = f.dataset.commForm, id = f.dataset.id || uid(type), revision = Number(f.dataset.revision)
    let body
    if (type === 'channel-context') {
      const channel = node(id), contextId = get('contextId')
      const context = Object.fromEntries(['segmentId', 'situation', 'entry', 'known', 'criteria', 'purpose', 'message', 'proof'].map(k => [k, get(k)]))
      context.id = contextId
      const contexts = channelContexts(channel), exists = contexts.some(c => c.id === contextId)
      body = { id, type: 'channel', label: channel.label, data: { contexts: exists ? contexts.map(c => c.id === contextId ? context : c) : [...contexts, context] } }
    } else if (type === 'channel-attach-material') {
      const material = node(get('materialId'))
      body = { id: material.id, type: 'artifact', label: material.label, links: { material_channel: [...new Set([...targets(material.id, 'material_channel'), id])] } }
    } else if (type === 'feedback') body = { command: 'feedback', id, text: get('text') }
    else if (type === 'observe') body = { command: 'observe', target: get('target'), text: get('text'), source: get('source'), windowStart: get('windowStart'), windowEnd: get('windowEnd') }
    else if (type === 'decide') body = { command: 'decide', rubricId: id, outcome: get('outcome'), rationale: get('rationale'), evidenceIds: multi('evidenceIds') }
    else if (type === 'transitions') body = { id, type: 'journey', label: node(id).label, data: { transitions: [...(node(id).data?.transitions || []).filter(t => t.from !== get('from')), ...multi('next').map(to => ({ from: get('from'), to, condition: get('condition') }))] } }
    else {
      const fields = { product: [], journey: ['outcome'], touchpoint: ['surface', 'intent', 'benefit', 'message', 'promiseBasis'], channel: ['platform', 'url', 'contentMode', 'purpose', 'audience', 'promise', 'returnReason', 'roles'], rubric: ['readerJob', 'rationale', 'topics'], reference: ['url', 'note'], artifact: ['stage', 'format', 'body', 'publicationUrl', 'publishedAt', 'contextId', 'rubricId', 'keyMessage', 'criterion', 'proof'] }
      const relations = { product: ['subproduct_of', 'serves'], journey: ['journey_offer', 'journey_segment'], touchpoint: ['contact_job', 'contact_channel', 'contact_rubric', 'uses_material'], channel: ['channel_offer', 'channel_segment', 'subproduct_of'], rubric: ['rubric_channel'], reference: ['reference_for'], artifact: ['material_offer', 'material_segment', 'material_channel'] }
      body = { id, type, label: get('label'), data: Object.fromEntries(fields[type].map(key => [key, get(key)])), links: Object.fromEntries(relations[type].map(key => [key, multi(key).filter(Boolean)])) }
      if (type === 'artifact' && f.dataset.id && targets(id, 'material_channel').includes(get('material_channel'))) body.links.material_channel = targets(id, 'material_channel')
      if (type === 'channel') { body.data.isOffering = values.has('isOffering'); body.data.communicationLinksManaged = true }
      if (type === 'journey' && !f.dataset.id && get('legacyChannelId')) body.attachLegacyContact = { channelId: get('legacyChannelId'), segmentId: get('legacySegmentId') }
      if (type === 'touchpoint' && !f.dataset.id) body.attachJourney = get('journeyId')
      if (type === 'artifact' && !f.dataset.id && get('contactId')) body.attachContact = get('contactId')
    }
    f.dataset.saving = 'true'
    busy = true; error = ''; notice = ''; f.setAttribute('aria-busy','true'); f.querySelector('.comm-save-state').textContent = 'Сохранение…'; $('#communicationsCenter .comm-notice').textContent = ''; for (const control of document.querySelectorAll('#communicationsCenter input, #communicationsCenter textarea, #communicationsCenter select, #communicationsCenter button, #productStructureDialog input, #productStructureDialog textarea, #productStructureDialog select, #productStructureDialog button')) control.disabled = true
    try {
      await write(body, revision)
      const editorKey = f.closest('dialog')?.dataset.commEditor
      if (editorKey) document.querySelector(`dialog[data-comm-editor="${CSS.escape(editorKey)}"]`)?.close()
      drafts.delete(draftKey(f)); persistDrafts()
      if (type === 'product') structureEditing = null
      if (type === 'channel') { editingChannels.delete(id); state.channelOpen = true }
      if (type === 'journey') { creatingJourneys.delete(f.dataset.commContext); legacySeeds.delete(f.dataset.commContext) }
      if (['journey', 'channel', 'rubric'].includes(type)) state[type] = id
      if (type === 'touchpoint') state.contact = id
      if (type === 'artifact') { state.material = id; if (state.contentEditor) state.contentEditor = id }
      notice = type === 'observe' ? 'Наблюдение сохранено. Вывод об эффективности ещё не сделан.' : type === 'decide' ? 'Решение записано в историю рубрики.' : 'Сохранено'
      await reload(); remember()
    } catch (e) { error = formError(e) }
    finally {
      busy = false; render()
      if (type === 'channel' && !error) {
        $('.comm-channel-detail')?.scrollIntoView({ block: 'start' })
        $('.comm-channel-detail [data-comm-action=edit-channel]')?.focus({ preventScroll: true })
      }
    }
  }
  function update(next) {
    if (!next.communications || (comm && next.communications.revision < comm.revision)) return
    if (initialized && state.scope !== next.communications.scope) return
    snapshot = next; comm = next.communications
    if (!initialized) {
      initialized = true
      try { for (const [key, value] of JSON.parse(localStorage.getItem(draftStorageKey()) || '[]')) {drafts.set(key, value);if(key.startsWith('channel:')&&key.split(':')[1])editingChannels.add(key.split(':')[1])} } catch {}
      try { const saved = JSON.parse(localStorage.getItem(`product-os:communications:${next.workspace}`) || '{}'); Object.assign(state, saved); if (saved.mode) window.ProductGalaxy?.setMode(saved.mode) } catch {}
      if (new URLSearchParams(location.search).get('view') === 'communications') window.ProductGalaxy?.setMode('communications')
      if (location.pathname === '/atlas' || !comm.products.some(n => n.id === state.scope)) state.scope = ''
      if (state.scope !== comm.scope) { emit('product-galaxy:refresh'); return }
    }
    if (state.scope !== comm.scope) return
    if (state.contact && !(state.tab === 'paths' ? pathsInScope() : journeys()).some(j => targets(j.id, 'has_contact').includes(state.contact))) state.contact = ''
    const changed = $('#communicationsCenter').dataset.signature !== `${next.graphSignature}:${state.scope}`
    if (changed) { $('#communicationsCenter').dataset.signature = `${next.graphSignature}:${state.scope}`; render() }
  }
  document.addEventListener('close', event => {
    const dialog = event.target
    if (!dialog.matches?.('[data-route-dialog]') || !dialog.isConnected) return
    state.contact = ''
    const step = document.querySelector(`[data-route="${CSS.escape(dialog.dataset.routeDialog)}"] [data-comm-action="route-step"][data-id="${CSS.escape(dialog.dataset.contact)}"]`)
    step?.setAttribute('aria-expanded', 'false')
    step?.setAttribute('aria-pressed', 'false')
    rootStepFocus(dialog.dataset.contact, dialog.dataset.routeDialog)
    remember()
  }, true)
  document.addEventListener('input', event => {
    const f = event.target.closest('[data-comm-form]')
    if (!f) return
    if (event.target.name === 'contact_channel') updateRubrics(f)
    if (event.target.name === 'material_channel') {
      const channelId = event.target.value
      f.elements.contextId.innerHTML = listOptions(channelContexts(node(channelId)).map(c => ({ id: c.id, label: contextLabel(c) })))
      f.elements.rubricId.innerHTML = listOptions(all('rubric').filter(r => targets(r.id, 'rubric_channel').includes(channelId)))
    }
    const values = {}; for (const [key, value] of new FormData(f)) (values[key] ||= []).push(value)
    drafts.set(`${f.dataset.commForm}:${f.dataset.id}:${f.dataset.commContext || ''}`, { values, revision: f.dataset.revision, openDetails:[...f.querySelectorAll('details')].map((el,i)=>el.open?i:-1).filter(i=>i>=0) })
    persistDrafts(); growFields(f)
    if (event.target.getAttribute('aria-invalid') === 'true') validateForm(f)
    f.querySelector('.comm-save-state').textContent = draftStatus()
  })
  document.addEventListener('submit', event => { if (event.target.matches('[data-comm-form]')) { event.preventDefault(); saveForm(event.target) } })
  document.addEventListener('change', event => {
    if (event.target.id === 'productScope') { state.scope = event.target.value; error = ''; remember(); emit('product-galaxy:refresh') }
    if (event.target.id === 'commSegment') { state.segment = event.target.value; state.journey = ''; state.contact = ''; state.competitor = ''; persistContext() }
    if (event.target.matches('[data-comm-path]')) { state.journey = event.target.value; state.contact = ''; state.graphJob = ''; persistContext() }
    if (event.target.matches('[data-comm-core]')) { state.graphCore = event.target.value; state.journey = ''; state.graphJob = ''; persistContext() }
    if (event.target.matches('[data-comm-rubric]')) { state.rubric = event.target.value; persistContext() }
  })
  document.addEventListener('click', async event => {
    if (event.target.closest('#manageProducts')) { openStructure(); return }
    const structureEntry = event.target.closest('[data-product-structure]')
    if (structureEntry) { openStructure(structureEntry.dataset.productStructure); return }
    if (event.target.closest('#scopeParent')) { state.scope = comm.products.find(p => p.id === state.scope)?.parentId || ''; remember(); emit('product-galaxy:refresh'); return }
    const b = event.target.closest('[data-comm-action]')
    if (!b || busy) return
    const action = b.dataset.commAction, id = b.dataset.id
    if(!readingActions.has(action))return
    if (['tab','channel','channels-home','channel-view','materials-home','close-channel-material','material','new-material'].includes(action) && !canLeave()) return
    error = ''; notice = ''
    if (action === 'clear-segment') { state.segment = ''; persistContext(); return }
    if (action === 'open-editor') { UI.dialog(b.nextElementSibling).open(b); growFields(b.nextElementSibling); b.nextElementSibling.querySelector('input:not([type=hidden]),textarea,select')?.focus(); return }
    else if (action === 'close-editor') { UI.dialog(b.closest('dialog')).close(); return }
    else if (action === 'tab') { state.tab = id; state.competitor = ''; if (id === 'materials') state.material = ''; if (id === 'paths') state.journey = '' }
    else if (action === 'channel') { state.channel = id; state.channelOpen = true; state.channelView = 'overview'; state.contentEditor = '' }
    else if (['journey', 'contact'].includes(action)) state[action] = id
    else if (action === 'channels-home') { state.channelOpen = false; state.contentEditor = '' }
    else if (action === 'channel-view') { state.channelView = id; state.contentEditor = '' }
    else if (action === 'materials-home') state.material = ''
    else if (action === 'graph-segment') { state.segment = id; state.journey = ''; state.graphJob = '' }
    else if (action === 'graph-variant') { state.journey = id; state.contact = ''; state.graphJob = '' }
    else if (action === 'close-route-step') { UI.dialog(b.closest('dialog')).close(); return }
    else if (action === 'route-step') { state.contact = id; state.journey = b.dataset.journey }
    else if (action === 'graph-job') state.graphJob = id
    else if (action === 'graph-zoom') state.graphZoom = Math.min(1.5, Math.max(.5, state.graphZoom + Number(id)))
    else if (action === 'graph-fit') { const view = $('.comm-job-viewport'), surface = $('.comm-job-surface'); state.graphZoom = Math.min(1.5, Math.max(.5, (view.clientWidth - 12) / parseFloat(surface.style.width))) }
    else if (action === 'graph-channel') { state.segment = ''; state.channel = id; state.channelOpen = true; state.channelView = 'overview'; state.contentEditor = ''; state.tab = 'channels' }
    else if (action === 'new-channel-material') state.contentEditor = 'new'
    else if (action === 'edit-channel-material') state.contentEditor = id
    else if (action === 'close-channel-material') state.contentEditor = ''
    else if (action === 'open-channel-contact') { state.contact = id; state.journey = sources(id, 'has_contact')[0] || ''; state.tab = 'paths' }
    else if (action === 'move-content-up') {
      const channel = node(state.channel), order = channel.data?.contentOrder || []
      const ids = channelMaterials(channel.id).filter(n => isChannelContent(n, channel)).map(n => n.id).sort((a,b) => (order.includes(a) ? order.indexOf(a) : 1e6) - (order.includes(b) ? order.indexOf(b) : 1e6))
      const index = ids.indexOf(id)
      if (index > 0) {
        ;[ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]
        busy = true
        try { await write({ id: channel.id, type: 'channel', label: channel.label, data: { contentOrder: ids } }); await reload() } catch(e) { error = formError(e) } finally { busy = false }
      }
    }
    else if (action === 'close-products') { $('#productStructureDialog').close(); return }
    else if (action === 'add-product') structureEditing = { parentId: id }
    else if (action === 'edit-product') structureEditing = { id }
    else if (action === 'cancel-product') { drafts.delete(`product:${structureEditing?.id || ''}:${structureEditing?.id ? '' : structureEditing?.parentId || ''}`); structureEditing = null }
    else if (action === 'select-product') { state.scope = id; $('#productStructureDialog').close(); remember(); emit('product-galaxy:refresh'); return }
    else if (action === 'new-journey') creatingJourneys.add(journeyContext())
    else if (action === 'use-legacy-contact') { state.segment = b.dataset.segment; legacySeeds.set(journeyContext(), { segmentId: state.segment, channelId: id }); creatingJourneys.add(journeyContext()) }
    else if (action === 'cancel-journey') { legacySeeds.delete(journeyContext()); creatingJourneys.delete(journeyContext()); drafts.delete(`journey::${journeyContext()}`) }
    else if (action === 'channel-ai') {
      busy=true
      try {const f=b.closest('form'),values=new FormData(f),instruction=`Уточни задачу, аудиторию и обещание канала на основе имеющихся материалов. Не выдавай предположения за факты. Текущий черновик владельца: ${JSON.stringify(Object.fromEntries(values))}`;const move=await api('/api/move',{nodeId:id,skill:'product-channel-concept',communicationTask:{kind:'rubrics',channelId:id,instruction}});emit('product-galaxy:move',{move});notice='Поручение подготовлено. Проверьте инструкцию в окне запуска.'}catch(e){error=formError(e)}finally{busy=false}
    }
    else if (action === 'edit-channel') editingChannels.add(id)
    else if (action === 'cancel-channel') { if (drafts.has(`channel:${id}:`) && !window.confirm('Отменить изменения канала? Локальный черновик будет удалён.')) return; editingChannels.delete(id); drafts.delete(`channel:${id}:`); persistDrafts() }
    else if (action === 'channel-tab') { state.tab = 'channels'; state.channelOpen = true; state.channelView = 'content'; state.channel = targets(state.contact, 'contact_channel')[0] || '' }
    else if (action === 'material') { if (state.tab === 'paths') state.segment = ''; state.material = id; state.tab = 'materials' }
    else if (action === 'new-material') { if (id) state.contact = id; state.material = 'new'; state.tab = 'materials' }
    else if (action === 'result-material') { state.material = id; state.tab = 'results'; state.rubric = sources(id, 'uses_material').flatMap(id => targets(id, 'contact_rubric'))[0] || '' }
    else if (action === 'result-rubric') { state.rubric = id; state.material = ''; state.tab = 'results' }
    else if (action === 'close-references') state.competitor = ''
    else if (action === 'edit-reference') { b.closest('.comm-reference').innerHTML = referenceForm(node(id)); return }
    else if (action === 'reload-records') { if (drafts.size && !window.confirm('Загрузить актуальные записи и удалить локальные черновики форм? Это действие нельзя отменить.')) return; drafts.clear(); persistDrafts(); await reload() }
    else if (action === 'link-rubric') {
      busy = true
      try { const contact = node(state.contact); await write({ type: 'touchpoint', id: contact.id, label: contact.label, links: { contact_channel: targets(id, 'rubric_channel'), contact_rubric: [id] } }); state.tab = 'paths'; notice = 'Канал и рубрика связаны с точкой контакта'; await reload() } catch (e) { error = formError(e) } finally { busy = false }
    } else if (action === 'import-material') {
      busy = true
      try { const result = await write({ command: 'import-material', artifactId: id, offerId: state.scope }); state.material = result.id; notice = 'Создана рабочая копия. Исходный документ сохранён в отчётах.'; await reload(); emit('atlas:action', { action: 'navigate', route: `material/${encodeURIComponent(result.id)}` }) } catch(e) { error = formError(e) } finally { busy = false }
    } else if (action === 'prepare') {
      busy = true
      try {
        const productId = targets(id, 'material_offer')[0] || state.scope || comm.products[0]?.id
        const move = await api('/api/move', { nodeId: productId, skill: 'product-content', materialId: id })
        emit('product-galaxy:move', { move })
      } catch (e) { error = formError(e) } finally { busy = false }
    }
    persistContext()
    if (['channel', 'channels-home', 'channel-view', 'new-channel-material', 'edit-channel-material', 'close-channel-material'].includes(action)) $('#communicationsCenter').scrollTop = 0
    if (action === 'route-step') { rootStepFocus(id, b.dataset.journey); const dialog = document.getElementById('route-detail-' + b.dataset.journey); UI.dialog(dialog)?.open(b); dialog?.querySelector('[data-comm-action=close-route-step]')?.focus({preventScroll:true}) }
    if (['add-product', 'edit-product'].includes(action)) $('#productStructureDialog input[name=label]')?.focus()
    if (action === 'choose-segment') $('#commSegment')?.focus()
    if (['new-journey', 'use-legacy-contact'].includes(action)) $('[data-comm-form=journey][data-id=""] textarea')?.focus()
    if (['edit-channel', 'cancel-channel'].includes(action)) $('.comm-channel-detail')?.scrollIntoView({ block: 'start' })
    if (action === 'edit-channel') $('.comm-channel-detail input[name=label]')?.focus({ preventScroll: true })
    if (action === 'cancel-channel') $('.comm-channel-detail [data-comm-action=edit-channel]')?.focus({ preventScroll: true })
  })

  document.addEventListener('toggle', event => { if (event.target.matches('details') && event.target.open && event.target.closest('[data-comm-form]')) growFields(event.target) }, true)
  window.addEventListener('resize', () => growFields($('#communicationsCenter')))
  new MutationObserver(() => growFields($('#communicationsCenter'))).observe(document.documentElement, {attributes:true, attributeFilter:['style']})
  window.addEventListener('beforeunload', event => { if (drafts.size) { event.preventDefault(); event.returnValue = '' } })
  window.addEventListener('product-galaxy:mode', () => remember())
  const scopeBar = document.querySelector('.product-scope-bar')
  new ResizeObserver(() => {
    const bottom = scopeBar.getBoundingClientRect().bottom - $('#galaxyViewport').getBoundingClientRect().top
    $('#galaxyViewport').style.setProperty('--scope-bar-bottom', `${bottom}px`)
  }).observe(scopeBar)
  window.ProductCommunications = { update, canLeave, hasUnsavedChanges: () => !!currentDirtyForm(),
    navigationState:()=>Object.fromEntries(['tab','segment','channel','channelOpen','channelView','material','contentEditor','journey','contact'].map(k=>[k,state[k]])),
    restoreNavigation(next){for(const k of ['tab','segment','channel','channelOpen','channelView','material','contentEditor','journey','contact'])if(k in next)state[k]=next[k];state.segment='';render()}, get scope() { return state.scope }, get segment() { return state.segment } }
})()
