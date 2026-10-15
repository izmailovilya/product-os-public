import {escapeHTML as e,notice,emptyState,button,sourceNote,sourceList,sourceEntry,loadingState} from './ui-components.js'

export const discoveryPurposes=[['active_search','Где искали решение'],['choice_help','У кого спрашивали и чьим рекомендациям доверяли'],['incidental','Где встречали упоминания'],['content_consumption','Что читают и где бывают'],['recruitment','Как попали в исследование'],['acquisition_hypothesis','Гипотезы привлечения'],['other','Контекст обращения не уточнён']]
const states={known:'Известно',unknown:'Неизвестно',not_asked:'Не спрашивали',asked_unanswered:'Без ответа',not_applicable:'Не применимо',ambiguous:'Неоднозначно',conflicting:'Противоречие'}
const speakerRoles={respondent:'Ответ участника',interviewee:'Ответ участника',interviewer:'Реплика интервьюера',question:'Вопрос',prompt:'Подсказка',analyst:'Интерпретация исследователя',answer:'Ответ',note:'Заметка',explanation:'Объяснение',unknown:'Роль не установлена'}
const membershipStates={candidate:'Кандидатная принадлежность',supported:'Есть основания принадлежности',disputed:'Принадлежность оспаривается',unknown:'Принадлежность не уточнена'}
const current=records=>{const retired=new Set(records.flatMap(r=>r.supersedes||[]));return records.filter(r=>!retired.has(r.id)&&r.status!=='withdrawn')}

/** One registry revision across all type pages. No per-person fetches or graph writes. */
export async function loadSegmentDiscovery(segment,{fetcher=fetch,signal,expectedRevision}={}) {
 let revision=expectedRevision;const fieldProvenance=[]
 const read=async type=>{
  const rows=[],seenOffsets=new Set();let offset=0
  do{
   if(seenOffsets.has(offset))throw Error('Повтор страницы реестра. Повторите загрузку.');seenOffsets.add(offset)
   const query=new URLSearchParams({type,...(['Person','SynthesisRevision'].includes(type)?{history:'true'}:{}),limit:'200',offset:String(offset),...(revision===undefined?{}:{expectedRevision:String(revision)})})
   const response=await fetcher('/api/research?'+query,{signal})
   if(!response.ok)throw Error(response.status===409?'Реестр изменился во время чтения. Повторите загрузку.':'Не удалось загрузить историю каналов. Повторите загрузку.')
   const page=await response.json()
   if(!Array.isArray(page.records)||!Number.isInteger(page.revision))throw Error('Некорректная страница реестра. Повторите загрузку.')
   if(revision!==undefined&&revision!==page.revision)throw Error('Реестр изменился во время чтения. Повторите загрузку.')
   revision=page.revision;rows.push(...page.records);fieldProvenance.push(...page.fieldProvenance||[]);offset=page.nextOffset??null
  }while(offset!==null)
  return rows
 }
 const memberships=await read('MembershipAssertion')
 const [events,people,syntheses]=await Promise.all(['DiscoveryEvent','Person','SynthesisRevision'].map(read))
 return projectSegmentDiscovery(segment,{memberships,events,people,syntheses,revision,fieldProvenance})
}

/** Membership is episode-scoped. Episode participants are not presumed speakers of a quote. */
export function projectSegmentDiscovery(segment,{memberships=[],events=[],people=[],syntheses=[],revision,fieldProvenance=[]}={}) {
 const segmentIds=new Set([segment.id,segment.researchSegmentId].filter(Boolean))
 const scoped=current(memberships).filter(m=>segmentIds.has(m.segmentId)),byEpisode=new Map()
 for(const m of scoped){if(!byEpisode.has(m.episodeId))byEpisode.set(m.episodeId,[]);byEpisode.get(m.episodeId).push(m)}
 const personById=new Map(people.map(p=>[p.id,p])),successors=new Map();for(const person of people)for(const prior of person.supersedes||[]){if(!successors.has(prior))successors.set(prior,[]);successors.get(prior).push(person.id)}
 const resolvePerson=id=>{const seen=new Set();let cursor=id;while(successors.has(cursor)){if(seen.has(cursor)||successors.get(cursor).length!==1)return {id:null,label:'Личность участника: неоднозначная история исправлений'};seen.add(cursor);cursor=successors.get(cursor)[0]}const person=personById.get(cursor);return person?{id:person.id,label:person.displayName||'Респондент'}:{id:null,label:'Участник эпизода: запись недоступна'}}
 const provenanceById=new Map();for(const entry of current(fieldProvenance)){if(!provenanceById.has(entry.recordId))provenanceById.set(entry.recordId,[]);provenanceById.get(entry.recordId).push(entry)}
 const synthesisById=new Map(syntheses.map(s=>[s.id,s])),retiredSyntheses=new Set(syntheses.flatMap(s=>s.supersedes||[]))
 const rows=current(events).filter(d=>byEpisode.has(d.episodeId)).map(event=>({event,provenance:(provenanceById.get(event.id)||[]).map(p=>({...p,assertedByLabel:p.assertedBy?.kind==='person'?resolvePerson(p.assertedBy.personId).label:p.assertedBy?.kind==='group'?(p.assertedBy.personIds||[]).map(id=>resolvePerson(id).label).join(' · ')||p.assertedBy.label||'Группа не указана':p.assertedBy?.label||'Автор утверждения не установлен'})),memberships:byEpisode.get(event.episodeId),participants:[...new Set(byEpisode.get(event.episodeId).map(m=>m.personId))].map(resolvePerson)}))
 const recognized=new Set(discoveryPurposes.filter(([id])=>id!=='other').map(([id])=>id))
 return {revision,synthesisUnavailable:scoped.some(m=>!synthesisById.has(m.synthesisRevisionId)||retiredSyntheses.has(m.synthesisRevisionId)),stale:scoped.some(m=>synthesisById.get(m.synthesisRevisionId)?.stale),groups:discoveryPurposes.map(([purpose,title])=>({purpose,title,rows:rows.filter(({event})=>purpose==='other'?!recognized.has(event.purpose):event.purpose===purpose)})).filter(g=>g.rows.length),count:rows.length}
}

const provenanceWords={respondent_report:'Со слов участника',observed_action:'Наблюдаемое действие',screener:'Ответ в скринере',researcher_note:'Заметка исследователя',founder_statement:'Утверждение основателя',supplier_claim:'Утверждение поставщика',document_measurement:'Измерение в документе',analyst_inference:'Интерпретация исследователя',spontaneous:'Спонтанно',open_question:'Открытый вопрос',prompted:'После подсказки',after_explanation:'После объяснения',not_applicable:'Не применимо',unknown:'Неизвестно',source_located:'Источник найден',quote_checked:'Цитата проверена',context_checked:'Контекст проверен',cross_checked:'Сопоставлено с другими источниками',unresolved:'Требует проверки',reviewed:'Связь с полями проверена',inherited_unresolved:'Унаследованная связь не проверена'}
const fieldNames={channel:'Место',purpose:'Контекст обращения',useState:'Состояние сведений'}
function renderProvenance(entries=[]) {
 const relevant=entries.filter(p=>p.fields?.some(field=>fieldNames[field])),covered=new Set(relevant.flatMap(p=>p.fields||[])),missing=Object.keys(fieldNames).filter(field=>!covered.has(field))
 const groups=new Map()
 for(const p of relevant){const key=JSON.stringify([p.basis,p.elicitation,p.verification,p.mapping,p.assertedByLabel,p.note,p.evidenceRefs]);if(!groups.has(key))groups.set(key,{...p,fields:[]});groups.get(key).fields.push(...p.fields)}
 return [...groups.values()].map(p=>`<p>${[...new Set(p.fields)].filter(f=>fieldNames[f]).map(f=>e(fieldNames[f])).join(', ')}: ${['basis','elicitation','verification','mapping'].map(k=>e(provenanceWords[p[k]]||p[k]||'Не указано')).join(' · ')}. Автор утверждения: ${e(p.assertedByLabel||'не установлен')}.</p>${p.note?`<p>${e(p.note)}</p>`:''}`).join('')+(missing.length?`<p>Происхождение полей «${missing.map(f=>e(fieldNames[f])).join('», «')}» ещё не проверено.</p>`:'')
}

const route=(kind,id)=>'#'+kind+'/'+encodeURIComponent(id)
export function renderSegmentDiscovery(model) {
 const body=model.groups.map(group=>`<section class="section" data-discovery-purpose="${e(group.purpose)}"><h2>${e(group.title)}</h2><div class="rows">${group.rows.map(({event,participants,memberships,provenance})=>{
 const refs=[...new Map([...(event.evidenceRefs||[]),...provenance.flatMap(p=>p.evidenceRefs||[])].map(ref=>[JSON.stringify([ref.sourceUnitId,ref.quote,ref.speakerRole]),ref])).values()]
 const cautions=[...new Set(provenance.flatMap(p=>[p.basis==='analyst_inference'?'Интерпретация':'',p.elicitation==='prompted'?'После подсказки':p.elicitation==='after_explanation'?'После объяснения':'']).filter(Boolean))]
 const details=renderProvenance(provenance)+`<p>${[...new Set(memberships.map(m=>membershipStates[m.status]||'Принадлежность требует проверки'))].map(e).join(' · ')} · ${e(states[event.useState]||'Состояние не уточнено')}</p>`
 const entries=refs.map(ref=>({relation:speakerRoles[ref.speakerRole]||ref.speakerRole||'Роль не установлена',quote:ref.quote||'',context:button({label:'Контекст ответа',attributes:{'data-research-source':ref.sourceUnitId}})}))
 return `<article class="row" data-discovery-event="${e(event.id)}"><div><h3>${sourceNote({text:event.channel||'Место не названо',title:'Источники',content:sourceEntry({title:event.channel||'Место не названо',context:sourceList({entries}),details}),attributes:{'data-discovery-sources':event.id}})}</h3><p>Участники эпизода: ${participants.map(p=>p.id?`<a href="${route('person',p.id)}">${e(p.label)}</a>`:e(p.label)).join(' · ')}${cautions.length?' · '+cautions.map(e).join(' · '):''}</p>${['conflicting','ambiguous','unknown','not_asked','asked_unanswered'].includes(event.useState)?`<p class="muted">${e(states[event.useState])}</p>`:''}${memberships.some(m=>m.status==='disputed')?'<p>Принадлежность оспаривается</p>':''}${group.purpose==='other'?`<p>Контекст обращения: ${e(event.purpose==='ambiguous'?'Неоднозначно':event.purpose==='unknown'?'Неизвестно':event.purpose||'Не указан')}</p>`:''}${!refs.length?'<p class="muted">Источник ещё не связан.</p>':''}</div></article>`
 }).join('')}</div></section>`).join('')
 return `<p class="section-intro">Места поиска и знакомства с решениями из интервью участников сегмента. Чтение канала и упоминание сервиса сами по себе не означают привлечение клиента или оплату. Участники эпизода и авторство каждой реплики указаны отдельно.</p>${model.synthesisUnavailable?notice({kind:'warning',message:'Синтез принадлежности недоступен или заменён новой версией. Основание требует проверки.'}):''}${model.stale?notice({kind:'warning',message:'Принадлежность к сегменту опирается на устаревший синтез и требует пересмотра.'}):''}${body||emptyState({kind:'first-use',title:'История поиска пока не записана',description:'В интервью участников пока не записано, где они искали или узнавали о решениях.'})}`
}
// Completed results only. Workspace identity and immutable registry revision are part of every key.
const discoveryCache=new Map()
function cacheKey(workspace,segment,revision){return JSON.stringify([workspace,segment.id,segment.researchSegmentId||'',revision])}
function rememberDiscovery(key,model){discoveryCache.delete(key);discoveryCache.set(key,model);while(discoveryCache.size>24)discoveryCache.delete(discoveryCache.keys().next().value)}
/** Reentry validates the current revision before reusing results. No private research is persisted in browser storage. */
export function mountSegmentDiscovery(element,segment,options={}) {
 const controller=new AbortController();let disposed=false,busy=false,shownModel
 const paint=model=>{shownModel=model;element.innerHTML=renderSegmentDiscovery(model);options.onReady?.(model)}
 if(options.retain&&options.workspace){const previous=[...discoveryCache].reverse().find(([key])=>{const [workspace,id,alias]=JSON.parse(key);return workspace===options.workspace&&id===segment.id&&alias===(segment.researchSegmentId||'')})?.[1];if(previous){paint(previous);element.insertAdjacentHTML('afterbegin',notice({message:'Проверяем актуальность источников…'}))}}
 const run=async()=>{
  if(busy||disposed)return;busy=true;element.setAttribute('aria-busy','true')
  if(!shownModel)element.innerHTML=loadingState({kind:'section',label:'Загрузка истории каналов из интервью…'})
  try{
   const fetcher=options.fetcher||fetch
   let expectedRevision
   if(options.workspace){const response=await fetcher('/api/research/version',{signal:controller.signal});if(!response.ok)throw Error('Не удалось проверить актуальность истории. Повторите загрузку.');const version=await response.json();if(version.workspace!==options.workspace||!Number.isInteger(version.revision))throw Error('Источник данных изменился. Обновите страницу.');expectedRevision=version.revision}
   const key=options.workspace&&cacheKey(options.workspace,segment,expectedRevision)
   let model=key&&discoveryCache.get(key)
   if(!model){model=await loadSegmentDiscovery(segment,{...options,fetcher,signal:controller.signal,expectedRevision});if(key&&!disposed)rememberDiscovery(key,model)}
   if(!disposed)paint(model)
  }catch(error){if(!disposed){const failure=notice({kind:'error',message:error.message+(shownModel?' Показана предыдущая версия, актуальность не подтверждена.':''),actions:button({label:'Повторить загрузку',attributes:{'data-discovery-retry':true}})});element.innerHTML=failure+(shownModel?renderSegmentDiscovery(shownModel):'')}}
  finally{busy=false;if(!disposed)element.removeAttribute('aria-busy')}
 }
 const click=event=>{if(event.target.closest('[data-discovery-retry]'))run()};element.addEventListener('click',click);run()
 return {get model(){return shownModel},destroy(){disposed=true;controller.abort();element.removeEventListener('click',click)}}
}
