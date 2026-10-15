import {pageHeader,topicNav,escapeHTML,sourceNote,sourceList} from './ui-components.js'
/* Addressable product topics, rendered by the shared component contract. */
export const ProductTabs={
 jobs(jobs=[]){
  const groups=[['core','Основные работы клиента'],['big','Более высокие работы'],['small','Соседние работы других решений'],['micro','Шаги внутри работы'],['unknown','Уровень пока не установлен']];
  return groups.map(([level,label])=>{const rows=jobs.filter(j=>(['core','big','small','micro'].includes(j.level)?j.level:'unknown')===level);return rows.length?`<section><h3>${label}</h3><ul>${rows.map(j=>`<li>${j.climbReason?sourceNote({text:j.label,title:'Граница работы',content:`<p>${escapeHTML(j.climbReason)}</p>`}):escapeHTML(j.label)}</li>`).join('')}</ul></section>`:''}).join('');
 },
 header(product,active='overview',{title,workspaceName='',back='',backTight=false}={}){
  const name=product.displayLabel||product.displayName||product.label||'';
  const topicTitle=active==='overview'||active==='terms'?'Обзор продукта':this.topics.find(([id])=>id===active)?.[1]||'Продукт';
  return pageHeader({title:title||topicTitle,className:'product-head',back,backTight,context:workspaceName&&name&&name!==workspaceName?`Продукт: ${escapeHTML(name)}`:''})
 },
 description(product){
  const text=product.description?.what||product.summary||'',entries=(product.description?.evidence||[]).map(raw=>{const row=typeof raw==='string'?{source:raw}:raw,ref=row.url||row.source||'';return {title:row.title||row.label||'Описание продукта',quote:row.quote||'',author:row.author||'',href:/^https?:\/\//.test(ref)?ref:/^(sources|reports|research)\//.test(ref)&&!ref.includes('..')?'/source?path='+encodeURIComponent(ref):'',meta:ref}})
  return text?`<section class="product-summary"><h2>Что делает продукт</h2><p>${entries.length?sourceNote({text,content:sourceList({entries})}):escapeHTML(text)}</p></section>`:''
 },
 topics:[['overview','Обзор'],['goals','Цели и ограничения'],['positioning','Позиционирование'],['brief','Бриф исследования'],['development','Развитие'],['elements','Элементы продукта'],['materials','Материалы продукта'],['references','Референсы конкурентов']],
 render(active='overview',{library=''}={}){return topicNav({label:'Разделы продукта',className:'product-tabs',active,items:this.topics.map(([id,label])=>({id,label,attributes:{'data-product-tab':id,...(library&&['references','materials'].includes(id)?{'data-product-route':'product/'+id+'?'+new URLSearchParams({library})}:{})}}))})}
};

if(typeof window!=='undefined')window.ProductTabs=ProductTabs;
