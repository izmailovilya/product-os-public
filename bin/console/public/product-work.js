import {readingList} from './reading-list.js'
import {escapeHTML as e, button, field, dialog, notice, textLink, sourceNote, setFieldError} from './ui-components.js'
const labels={planned:'Запланировано',checking:'Проверяю',confirmed:'Подтверждено',refuted:'Опровергнуто',partial:'Частично подтверждено'}
const date=value=>value?new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}):''
const snap=()=>window.__productGalaxySnapshot
const entries=s=>Object.values(s?.humanWork||{})
const sourceLink=report=>textLink({label:'Открыть разбор',href:'/report?path='+encodeURIComponent(report.path)})
function control(id){const item=snap()?.humanWork?.[id];return `<div class="os-actions" data-work-control="${e(id)}">${item?`<p>${e(labels[item.status])} · ${e(date(item.updatedAt))}${item.note?`<br>${e(item.note)}`:''}</p>`:''}${button({label:item?'Обновить результат проверки':'Взять в работу',variant:'primary',attributes:{'data-human-work':id}})}</div>`}
// Saved checking status can be read beside its subject without exposing the editor.
function reading(id){const item=snap()?.humanWork?.[id];if(!item)return '';return `<section data-work-reading="${e(id)}"><h3>Сохранённая проверка</h3><p>${e(labels[item.status]||'Статус не уточнён')}${item.updatedAt?' · '+e(date(item.updatedAt)):''}</p>${item.note?`<p>${e(item.note)}</p>`:''}${item.reportPath?sourceLink({path:item.reportPath}):''}</section>`}
const visits=new Map()
function changes(s){
 const key='product-os:last-visit:'+s.workspace
 if(!visits.has(key)){let previous;try{previous=JSON.parse(localStorage.getItem(key)||'null')}catch{}visits.set(key,previous);try{localStorage.setItem(key,JSON.stringify({at:Date.now(),reports:s.reports.length,people:s.researchCounts?.people||0}))}catch{}}
 const previous=visits.get(key),reports=previous?s.reports.length-previous.reports:0,people=previous?(s.researchCounts?.people||0)-previous.people:0
 return previous&&(reports>0||people>0)?`<p>С прошлого открытия: ${[reports>0?'новых отчётов — '+reports:'',people>0?'новых респондентов — '+people:''].filter(Boolean).join('; ')}.</p>`:''
}
// Keep the complete source below the decision. The preview only reformats its
// first action and result; product-specific names, counts and dates are not baked in.
const paragraphs=text=>String(text||'').split(/\n\s*\n/).filter(Boolean)
function stepPreview(text) {
 const paragraph=paragraphs(text)[0]||''
 const sentences=Array.from(new Intl.Segmenter('ru',{granularity:'sentence'}).segment(paragraph),part=>part.segment.trim())
 const action=(sentences[0]||'').replace(/^(?:Продолжить|Выполнить) [«"].+?[»"],? (?:начав|начиная) с /i,'Начать с ')
 const result=(sentences[1]||'').replace(/^За предусмотренные (?:ходом|планом) /i,'За ')
 // Rephrase this explicit deliverable without assigning revenue/profit labels or
 // calculating anything. All list values, scope and timing remain source text.
 const amounts=result.match(/^(.*?)получить проверяемое разложение денег клиента:\s*(.+)$/iu)
 const outcome=amounts?`<p>${e(amounts[1])}свести и проверить:</p><ul>${amounts[2].replace(/\.$/,'').split(/,\s+/).map(item=>`<li>${e(item)}</li>`).join('')}</ul>`:result?`<p>${e(result)}</p>`:''
 return `${action?`<p>${e(action)}</p>`:''}${outcome}`
}
function stateLead(text) {
 // An explicitly introduced next move belongs to the action below. Preserve the
 // whole state clause, including its uncertainty, instead of guessing a summary.
 return String(text||'').split(/\s+(?=Следующий (?:ход|шаг)\s*[—:–-])/u)[0]
}
function summary(s){
 if(!s)return ''
 const productId=s.galaxy?.product?.id||s.graph.nodes.find(n=>n.type==='product')?.id
 const report=s.reports?.find(r=>r.productState&&(!r.nodeId||r.nodeId===productId))
 const taken=entries(s).find(x=>['checking','planned'].includes(x.status))
 const step=taken?.title||report?.nextStep
 const action=taken?button({label:'Обновить результат',variant:'primary',attributes:{'data-human-work':taken.nodeId||'','data-work-report':taken.reportPath||''}}):step?button({label:'Записать результат',variant:'primary',attributes:{'data-work-report':report.path}}):''
 const provenance=report||step?`${report?`<p>${e(report.stateSummary)}</p>`:''}${step?paragraphs(step).map(p=>`<p>${e(p)}</p>`).join(''):''}${report?sourceLink(report):''}`:''
 return `<section class="product-current-state"><h2>Состояние продукта</h2>${report?`<p>${sourceNote({text:stateLead(report.stateSummary),title:'Основания и полный план',content:provenance})}</p><p>По разбору от <time datetime="${new Date(report.date).toISOString()}">${e(date(report.date))}</time></p>`:'<p>Общий разбор продукта пока не сохранён.</p>'}${changes(s)}${step?`<h3>${taken?'В работе':'Что сделать дальше'}</h3><div class="product-step-preview">${!report?sourceNote({text:step,title:'Полный план',content:provenance}):stepPreview(step)}</div>${taken?`<p>${e(labels[taken.status])}${taken.dueDate?' · Срок: '+e(date(taken.dueDate)):''}</p>`:''}${action}`:''}</section>`
}

function queue(s){const items=entries(s);return `<section class="product-work-queue"><h2>Ваши проверки</h2>${items.length?readingList(items.map(item=>({text:`${item.title} ${labels[item.status]} ${item.note}`,html:`<article class="todo-row"><h3>${item.reportPath?sourceNote({text:item.title,title:'Основание проверки',content:sourceLink({path:item.reportPath})}):e(item.title)}</h3><p>${e(labels[item.status])} · Начато ${e(date(item.startedAt))}${item.dueDate?' · Срок '+e(date(item.dueDate)):''}</p>${item.note?`<p>${e(item.note)}</p>`:''}${button({label:'Обновить результат',attributes:{'data-human-work':item.nodeId||'','data-work-report':item.reportPath||''}})}</article>`})),{label:'Найти проверку'}):notice({message:'Возьмите одну проверку в работу. Здесь появятся её срок и ваши выводы.'})}</section>`}
let open=false
function edit(nodeId,reportPath){
 if(open)return
 const s=snap(),existing=entries(s).find(x=>reportPath?x.reportPath===reportPath:x.nodeId===nodeId),node=[...s.graph.nodes,...(s.galaxy?.values||[])].find(n=>n.id===nodeId),report=s.reports.find(r=>r.path===reportPath)
 if(!node&&!report)return
 const draftKey=`product-os-work:${s.workspace}:${reportPath||nodeId}`
 let draft;try{draft=JSON.parse(localStorage.getItem(draftKey)||'null')}catch{}
 const values=draft||existing||{status:'checking',note:'',dueDate:''}
 const root=document.createElement('dialog');root.className='os-dialog';root.setAttribute('aria-labelledby','workTitle')
 root.innerHTML=`<h2 id="workTitle" tabindex="-1">Результат вашей проверки</h2>${stepPreview(report?.nextStep||report?.title||node.label)}${report?.nextStep?`<details><summary>Полный план</summary>${paragraphs(report.nextStep).map(p=>`<p>${e(p)}</p>`).join('')}</details>`:''}<p>Это ваша рабочая отметка. Источники и выводы исследования сохраняются отдельно.</p>${draft&&existing?`${notice({kind:'warning',message:'Восстановлен ваш черновик. Сверьте его с сохранённой отметкой перед записью.'})}<p>Сохранено: ${e(labels[existing.status])} · ${e(date(existing.updatedAt))}<br>${e(existing.note||'Вывод пока не записан.')}</p>`:''}<form novalidate><div class="os-dialog-body">${field({name:'status',label:'Статус',type:'select',optionsHtml:Object.entries(labels).map(([key,label])=>`<option value="${key}" ${values.status===key?'selected':''}>${label}</option>`).join('')})}${field({name:'note',label:'Что узнали',type:'textarea',value:values.note,attributes:{maxlength:10000}})}${field({name:'dueDate',label:'Срок следующего шага',type:'date',value:values.dueDate})}${existing?.history?.length?`<details><summary>История отметок · ${existing.history.length}</summary>${existing.history.map(row=>`<p>${e(date(row.updatedAt))} · ${e(labels[row.status])}<br>${e(row.note)}</p>`).join('')}</details>`:''}</div><div class="os-dialog-footer"><div data-work-error></div><div class="os-actions">${button({label:'Сохранить результат',variant:'primary',type:'submit'})}${button({label:'Отмена',attributes:{'data-work-cancel':''}})}</div></div></form>`
 document.body.append(root);open=true
 const controller=dialog(root,{onClose(){open=false;root.remove()}});controller.open(document.activeElement);root.querySelector('h2').focus()
 root.querySelector('[data-work-cancel]').onclick=()=>controller.close()
 root.addEventListener('input',event=>{setFieldError(event.target,'');try{localStorage.setItem(draftKey,JSON.stringify(Object.fromEntries(new FormData(root.querySelector('form')))))}catch{root.querySelector('[data-work-error]').innerHTML=notice({kind:'warning',message:'Браузер не сохраняет черновики. Скопируйте текст перед закрытием окна.'})}})
 let busy=false
 root.querySelector('form').onsubmit=async event=>{event.preventDefault();if(busy)return;const values=Object.fromEntries(new FormData(event.target));if(['confirmed','refuted','partial'].includes(values.status)&&!values.note.trim()){const note=root.querySelector('[name=note]');setFieldError(note,'Запишите, что узнали по результатам проверки.');note.focus();note.scrollIntoView({block:'center'});return}busy=true;root.querySelector('[type=submit]').disabled=true
 try{const response=await fetch('/api/human-work',{method:'POST',headers:{'content-type':'application/json','x-product-os-token':s.csrfToken},body:JSON.stringify({...values,nodeId,reportPath,expectedRevision:existing?.revision||0})});const result=await response.json();if(!response.ok)throw Error(result.error);try{localStorage.removeItem(draftKey)}catch{}controller.close();window.dispatchEvent(new CustomEvent('product-galaxy:refresh'))}
 catch(error){console.error(error);root.querySelector('[data-work-error]').innerHTML=notice({kind:'error',message:/[а-я]/i.test(error.message)?error.message:'Не удалось сохранить результат. Черновик сохранён; повторите, когда консоль станет доступна.'})}finally{busy=false;if(root.isConnected)root.querySelector('[type=submit]').disabled=false}}
}
document.addEventListener('click',event=>{const trigger=event.target.closest('[data-human-work],[data-work-report]');if(trigger)edit(trigger.dataset.humanWork||'',trigger.dataset.workReport||'')})
window.ProductWork={summary,queue,control,reading,edit}
