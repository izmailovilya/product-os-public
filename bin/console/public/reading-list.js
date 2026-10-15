import {escapeHTML,button} from './ui-components.js'
// Long reading collections reveal records in pages without hiding any behind a query.
export function readingList(items,{className='',pageSize=20}={}){
 if(items.length<=pageSize)return items.map(item=>item.html).join('')
 return `<div data-reading-list data-reading-limit="${pageSize}" data-reading-page-size="${pageSize}"><p data-reading-count role="status">Показано ${pageSize} из ${items.length}</p><div class="${escapeHTML(className)}">${items.map((item,index)=>`<div data-reading-item${index>=pageSize?' hidden':''}>${item.html}</div>`).join('')}</div>${button({label:`Показать ещё ${pageSize}`,attributes:{'data-reading-more':''}})}</div>`
}
function refresh(root){
 const limit=Number(root.dataset.readingLimit)||20,items=[...root.querySelectorAll('[data-reading-item]')]
 items.forEach((item,index)=>{item.hidden=index>=limit})
 root.querySelector('[data-reading-count]').textContent=`Показано ${Math.min(limit,items.length)} из ${items.length}`
 root.querySelector('[data-reading-more]').hidden=items.length<=limit
}
export function captureReadingLists(container){return [...container.querySelectorAll('[data-reading-list]')].map(root=>({limit:Number(root.dataset.readingLimit)||20}))}
export function restoreReadingLists(container,states=[]){container.querySelectorAll('[data-reading-list]').forEach((root,index)=>{const state=states[index];if(!state)return;root.dataset.readingLimit=String(state.limit||root.dataset.readingPageSize||20);refresh(root)})}
if(typeof document!=='undefined'){
 document.addEventListener('click',event=>{const button=event.target.closest('[data-reading-more]');if(!button)return;const root=button.closest('[data-reading-list]');root.dataset.readingLimit=String((Number(root.dataset.readingLimit)||20)+(Number(root.dataset.readingPageSize)||20));refresh(root)})
}
