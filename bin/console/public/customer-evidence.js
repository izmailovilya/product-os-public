import {escapeHTML as e,badge,sourceText,textLink} from './ui-components.js'
import {segmentSupportSummary} from './segment-support.js'
const list=value=>Array.isArray(value)?value:[]

// Origin and support are independent. Linked materials and legacy status alone
// never validate the profile. A child is evaluated from its own fields only.
export function customerEvidenceState(s){
 const support=s.interviewSupport||{},p=s.customerProfile
 const fields=p?[p.summary,p.context,p.recognition,p.whySeparate,p.primaryJob,p.productFit,p.alternatives,...list(p.successCriteria),...list(p.otherJobs),...Object.values(p.roles||{}),...Object.values(p.journey||{})]:[]
 const origin=s.confidence==='expert'?'Мнение эксперта':'Предложено AI'
 const stale=Boolean(support.stale||s.researchSummary?.stale),conflicting=Boolean(support.conflicting)
 const researched=fields.some(f=>f?.basis==='research'&&list(f.sourceRefs).length)
 const warnings=[...(s.status==='contradicted'?['Есть опровергающие данные']:conflicting?['Есть противоречия']:[]),...(stale?['Основания устарели']:[])]
 const currentSupport=support.state==='supported'&&!stale&&!conflicting&&s.status!=='contradicted'
 return {origin,warnings,currentSupport,label:warnings.length?warnings.join(' · '):currentSupport?'Поддержано интервью':researched?'Есть основания по части профиля':'Требует проверки'}
}

export function customerEvidenceStatus(s){
 const state=customerEvidenceState(s),payload={id:s.id,label:s.displayLabel||s.label,confidence:s.confidence,status:s.status,customerProfileSource:s.customerProfileSource,confidenceSource:s.confidenceSource,interviewSupport:s.interviewSupport,researchSummary:s.researchSummary,participantCount:s.participantCount,summary:state}
 return `<div class="os-customer-evidence-status" data-customer-evidence-status="${e(s.id)}">${badge({label:state.origin})}${sourceText({text:state.label,label:state.label+'. Основания профиля: '+(s.displayLabel||s.label),className:'os-customer-evidence-state',attributes:{'data-state':state.warnings.length?'warning':state.currentSupport?'supported':'unverified','data-customer-evidence':JSON.stringify(payload)}})}</div>`
}

export function customerEvidenceContent(s){
 const state=s.summary
 const provenance=[s.customerProfileSource,s.confidenceSource].filter((value,index,all)=>value&&all.indexOf(value)===index)
 const ref=path=>/^https?:\/\//.test(path)?textLink({href:path,label:path}):/^(sources|reports|research|segments)\//.test(path)||path==='PRODUCT.md'?textLink({href:'/source?path='+encodeURIComponent(path),label:path}):e('Запись: '+path)
 return `<p>${e(s.label)}</p><p><strong>${e(state.origin)}</strong> · ${e(state.label)}</p><p>${s.confidence==='expert'?'Сегмент отмечен как экспертная гипотеза. Сведения команды сами по себе не подтверждают все свойства клиентов.':'Сегмент предложен AI. Это рабочая гипотеза; отдельные утверждения могут иметь собственные основания.'}</p>${provenance.length?`<h3>Как сформирован профиль</h3><ul>${provenance.map(path=>`<li>${ref(path)}</li>`).join('')}</ul>`:'<p>Документ о формировании профиля пока не связан.</p>'}<h3>Проверка по клиентам</h3>${segmentSupportSummary(s,{includeBadge:false,includePeople:false,compact:true})}<p>Связанные материалы не подтверждают все утверждения профиля, оплату или спрос. Основание каждого утверждения доступно при наведении или нажатии на текст утверждения.</p>${textLink({href:'#segment/'+encodeURIComponent(s.id)+'/people',label:'Материалы исследования →'})}`
}
