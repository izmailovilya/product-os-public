import {escapeHTML as esc,badge,sourceTrigger,sourceNote,sourceEntry,sourceList,proseFacts,notice} from './ui-components.js'
// Domain presentation only: the backend derives interview support. Linked people and
// the method's research status never promote a hypothesis in this renderer.
const list=value=>Array.isArray(value)?value:[]
const countWords=(n,words)=>words[n%100>=11&&n%100<=14?2:n%10===1?0:n%10>=2&&n%10<=4?1:2]
const support=segment=>segment.interviewSupport||{state:'hypothesis',personCount:0,respondents:[],evidenceRefs:[]}
// Confidence levels, most reliable first. Data comes only from evidence (graph status or current interview support);
// an unproven segment is an expert hypothesis only when the user said so, otherwise it is an AI proposal.
export const SEGMENT_CONFIDENCE=[
 {id:'data',title:'Подтверждено данными',label:'Подтверждено данными',description:'Есть полевые основания: ответы интервью или проверенные данные. Это не доказывает спрос и размер рынка.'},
 {id:'expert',title:'Экспертные гипотезы',label:'Экспертная гипотеза',description:'Команда считает их реалистичными по своему опыту. Данных пока нет.'},
 {id:'ai',title:'AI-гипотезы',label:'AI-гипотеза',description:'Предложены агентом без подтверждения команды. Низкая уверенность, пока нет данных.'},
 {id:'contradicted',title:'Опровергнуто данными',label:'Опровергнуто данными',description:'Полевые основания говорят против этой гипотезы.'}
]
export function segmentConfidence(segment){
 if(segment?.status==='contradicted')return 'contradicted'
 if(support(segment).state==='supported'||['evidenced','validated'].includes(segment?.status))return 'data'
 return segment?.confidence==='expert'?'expert':'ai'
}
export function segmentConfidenceGroups(segments){
 return SEGMENT_CONFIDENCE.map(level=>({...level,segments:list(segments).filter(segment=>segmentConfidence(segment)===level.id)})).filter(group=>group.segments.length)
}
export function segmentSupportBadge(segment){
 const state=support(segment).state==='supported'?'supported':'hypothesis',level=segmentConfidence(segment)
 // Interview support keeps its precise name; the level decides the rest of the label.
 const label=state==='supported'?'Поддержано интервью':level==='contradicted'?'Есть опровергающие данные':level==='data'?'Подтверждено данными':(segment.researchSummary?.materialCount||segment.participantCount)?'Есть материалы':'Требует проверки'
 return badge({tone:level==='data'?'positive':'neutral',label,attributes:{'data-segment-support-state':state,'data-segment-confidence':level}})
}
export function segmentSupportSummary(segment,{includeBadge=true,compact=false,includePeople=true,explain=false}={}){
 if(explain)return explainedSupportSummary(segment)
 const data=support(segment),people=list(segment.participants),total=Number.isFinite(segment.participantCount)?segment.participantCount:people.length
 const refs=list(data.evidenceRefs),respondents=list(data.respondents),hasSources=refs.length||respondents.some(person=>list(person.evidenceRefs).length)
 const visiblePeople=includePeople?(compact?people.slice(0,3):people):[]
 const names=visiblePeople.map(person=>`<a href="#person/${encodeURIComponent(person.id)}">${esc(person.displayName||'Респондент')}</a>`).join(' · ')
 const remaining=total>visiblePeople.length?` · <a href="#segment/${encodeURIComponent(segment.id)}/people">И ещё ${total-visiblePeople.length}</a>`:''
 const payload={personCount:data.personCount||0,respondents,evidenceRefs:refs}
 const research=segment.researchSummary,kinds={interview:['интервью','интервью','интервью'],survey:['анкета','анкеты','анкет'],case_story:['клиентская история','клиентские истории','клиентских историй']}
 const counts=research?`<p data-segment-material-count="${research.materialCount}">${research.materialCount?`Материалов: ${research.materialCount}${research.includesArchivedGroups?' · включая ранее собранные материалы':research.includesSubsegments?' · включая подсегменты':''}`:'Материалы пока не связаны.'}</p>${research.materialCount?`<p>${Object.entries(research.kinds||{}).map(([kind,n])=>`${n} ${countWords(n,kinds[kind]||['другой материал','других материала','других материалов'])}`).join(' · ')}</p>`:''}`:`<p data-segment-respondent-count="${total}">Респонденты: ${total}</p>`
 return `<div data-segment-support-summary="${esc(segment.id)}">${includeBadge?`<p>${segmentSupportBadge(segment)}</p>`:''}${counts}${names?`<p>${names+remaining}</p>`:compact?'':'<p>Связанные досье пока не добавлены.</p>'}${hasSources?`<p>${data.personCount!==total?`В интервью-основаниях: ${esc(data.personCount||0)} · `:''}${sourceNote({text:'Основания из интервью',title:'Основания из интервью',content:sourceContent(payload),attributes:{'data-segment-support-sources':segment.id}})}</p>`:compact?'':`<p>${data.state==='supported'?'Фрагменты интервью пока не связаны.':'Подтверждение границ сегмента интервью пока не установлено.'}</p>`}${data.stale||research?.stale?'<p data-segment-support-warning="stale">Выводы нужно сверить с обновлёнными материалами.</p>':''}${data.conflicting?'<p data-segment-support-warning="conflicting">Есть противоречащие данные: основания нужно сопоставить.</p>':''}</div>`
}
// Materials, interview support and warnings are separate facts, not a progress
// score. This reading variant never treats a linked survey as profile validation.
function explainedSupportSummary(segment){
 const data=support(segment),research=segment.researchSummary,refs=list(data.evidenceRefs),respondents=list(data.respondents)
 const total=Number.isFinite(segment.participantCount)?segment.participantCount:list(segment.participants).length
 const kinds={interview:['интервью','интервью','интервью'],survey:['анкета','анкеты','анкет'],case_story:['клиентская история','клиентские истории','клиентских историй']}
 const counts=research?`<p data-segment-material-count="${esc(research.materialCount)}">${research.materialCount?Object.entries(research.kinds||{}).map(([kind,n])=>`${esc(n)} ${countWords(n,kinds[kind]||['другой материал','других материала','других материалов'])}`).join(' · ')||`Материалов: ${esc(research.materialCount)}`:'Материалы пока не связаны.'}</p>`:`<p data-segment-respondent-count="${esc(total)}">Досье: ${esc(total)}</p>`
 const scope=[research?.includesArchivedGroups?'Включены ранее собранные материалы.':'',research?.includesSubsegments?'Включены материалы подсегментов.':''].filter(Boolean).join(' ')
 const supported=data.state==='supported',hasSources=refs.length||respondents.some(person=>list(person.evidenceRefs).length)
 const meaning=segment.status==='contradicted'?'В данных сохранено опровержение гипотезы сегмента.':supported?'Связь клиентов с этим сегментом поддержана ответами из интервью. Это не подтверждает все утверждения профиля, спрос или готовность платить.':'Интервью-оснований связи клиентов с этим сегментом пока нет. Связанный материал сам по себе не подтверждает профиль.'
 const payload={personCount:data.personCount||0,respondents,evidenceRefs:refs}
 const exact=hasSources?`<p>${sourceNote({text:'Посмотреть ответы, на которых основана связь с сегментом',title:'Основания из интервью',content:sourceContent(payload),attributes:{'data-segment-support-sources':segment.id}})}</p>`:supported?'<p>Точные фрагменты интервью пока не связаны.</p>':''
 const warnings=(data.stale||research?.stale?`<div data-segment-support-warning="stale">${notice({kind:'warning',message:'Выводы устарели: они сохранены для прежней версии материалов. Нужно сверить их с текущими ответами; новые материалы сами по себе не обновляют выводы.'})}</div>`:'')+(data.conflicting?`<div data-segment-support-warning="conflicting">${notice({kind:'warning',message:'Есть противоречащие данные или спорная связь клиента с сегментом. Сопоставьте основания, прежде чем опираться на этот профиль.'})}</div>`:'')
 return `<div data-segment-support-summary="${esc(segment.id)}" data-support-reading>${proseFacts({items:[{label:'Собранные материалы',value:counts+(scope?`<p>${esc(scope)}</p>`:'')},{label:'Что подтверждено',value:`<p>${esc(meaning)}</p>${exact}${warnings}`} ]})}</div>`
}
function sourceContent(data){
 const seen=new Set(),entries=[]
 for(const person of list(data.respondents)){
  const refs=list(person.evidenceRefs).filter(ref=>ref.sourceUnitId)
  if(!refs.length)continue
  refs.forEach(ref=>seen.add(ref.sourceUnitId))
  entries.push({title:person.displayName||'Респондент',relation:'Интервью-основание связи с сегментом',context:`<p><a href="#person/${encodeURIComponent(person.personId)}">Открыть досье респондента →</a></p>${refs.map((ref,index)=>sourceTrigger({variant:'link',label:refs.length>1?`Ответ в контексте · ${index+1}`:'Ответ в контексте',attributes:{'data-research-source':ref.sourceUnitId}})).join(' ')}`})
 }
 for(const ref of list(data.evidenceRefs))if(ref.sourceUnitId&&!seen.has(ref.sourceUnitId)){
  seen.add(ref.sourceUnitId)
  entries.push({title:'Основание из интервью',context:sourceTrigger({variant:'link',label:'Ответ в контексте',attributes:{'data-research-source':ref.sourceUnitId}})})
 }
 return sourceEntry({title:'Поддержка гипотезы сегмента',context:'<p>Связь с интервью не означает, что подтверждены спрос, размер рынка или все утверждения о сегменте.</p>'})+sourceList({entries,emptyText:'Точные фрагменты интервью пока не связаны.'})
}
