import {escapeHTML as e,readingSection,summaryCard} from './ui-components.js'

export function renderAudienceIdeas(ideas=[]) {
 if(!ideas.length)return ''
 const cards=ideas.map(idea=>summaryCard({title:idea.title,href:idea.href,level:3,attributes:{'data-audience-idea':idea.id},content:
  `<p>${e(idea.benefit||'Возможная польза пока не описана.')}</p>`+
  `<p><strong>Почему отложили:</strong> ${e(idea.deferredReason||'Причина пока не записана.')}</p>`+
  (idea.href?'':'<p>Подробный разбор пока недоступен.</p>')
 })).join('')
 return readingSection({id:'audience-ideas',title:`Пока вне фокуса · ${ideas.length} ${ideaCountWord(ideas.length)}`,intro:'Идеи применения, к которым можно вернуться позже. Возможная польза описана как гипотеза; решение отложить её не означает, что она опровергнута.',content:cards})
}
function ideaCountWord(n){return n%10===1&&n%100!==11?'идея':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'идеи':'идей'}
