import './dossier-evidence.js';
import { iconMarkup, installGalaxyIcons } from './galaxy-icons.js';
import { initHangar, renderHangar, setHangarActive } from './galaxy-hangar.js';
import { renderSegmentDossier, renderCompetitorDossier, renderProductDossier } from './dossier-content.js';
const panel=document.querySelector('#galaxyPanel'),viewport=document.querySelector('#galaxyViewport');
let snapshot,galaxy,selection=null,mode='map',lastSegmentId,selectedValueId,productFilter='all',renderSignature='';
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent('product-galaxy:'+name,{detail}));
const entity=(type,id)=>type==='product'?galaxy?.product:(galaxy?.[type==='segment'?'segments':type==='competitor'?'competitors':'values']||[]).find(x=>x.id===id);
function resetSelection(){selection=null;panel.hidden=true;panel.replaceChildren();delete panel.dataset.presentation;viewport.classList.remove('atlas-show-dossier')}
// Addressable pages belong to the router; Escape only dismisses transient selections.
function close(){if(!selection||selection.presentation==='page')return false;resetSelection();return true}
function renderPanel(){
 const focused=panel.contains(document.activeElement)?document.activeElement:null;
 const focusAttribute=focused&&['id','data-evidence-key','data-galaxy-value-select','data-development-segment'].find(name=>focused.hasAttribute(name));
 const focusSelector=focusAttribute?`[${focusAttribute}=${JSON.stringify(focused.getAttribute(focusAttribute))}]`:null;
 const target=selection&&entity(selection.type,selection.id);if(!target){panel.hidden=true;return}
 const context={workspaceName:snapshot.productName,topic:selection.topic,ideaId:selection.ideaId,developmentSegment:selection.developmentSegment,icon:iconMarkup,values:galaxy.values,segments:galaxy.segments,segment:id=>entity('segment',id),lastSegmentId,selectedValueId,productFilter,communications:snapshot.communications};
 panel.innerHTML=(selection.type==='segment'?renderSegmentDossier:selection.type==='competitor'?renderCompetitorDossier:renderProductDossier)(target,context);panel.hidden=mode!=='map';panel.dataset.presentation=selection.presentation||'transient'
 if(focusSelector)panel.querySelector(focusSelector)?.focus({preventScroll:true});
}
function selectEntity(type,id,options){if(!id){id=type;type=galaxy?.product?.id===id?'product':galaxy?.segments.some(s=>s.id===id)?'segment':'competitor'}selection={...(selection?.type===type&&selection?.id===id?selection:{}),type,id,...options};if(type==='segment')lastSegmentId=id;renderPanel();emit('selection',selection)}
function setMode(next){mode=next;resetSelection();viewport.classList.toggle('is-communications-mode',mode==='communications');viewport.classList.toggle('is-fleet-mode',mode==='fleet');viewport.dataset.viewMode=mode;document.querySelector('#communicationsCenter').hidden=mode!=='communications';document.querySelector('#galaxyHangar').hidden=mode!=='fleet';setHangarActive(mode==='fleet');if(mode==='fleet'&&galaxy)renderHangar(galaxy);emit('mode',{mode})}
function update(next){const signature=JSON.stringify([next.productName,next.galaxy,next.communications,next.humanWork]),changed=signature!==renderSignature;renderSignature=signature;snapshot=next;galaxy=next.galaxy;if(mode==='fleet'&&changed)renderHangar(galaxy);if(selection&&changed)renderPanel();emit('ready',{snapshot})}
window.ProductGalaxy={update,selectEntity,setMode,getMode:()=>mode,escape:close};
initHangar({root:document.querySelector('#galaxyHangar'),panel,getGalaxy:()=>galaxy,getSelection:()=>selection,select:selectEntity,setMode});
installGalaxyIcons();
for(const [id,value] of [['galaxyMapToggle','map'],['galaxyFleetToggle','fleet'],['galaxyCommunicationsToggle','communications']])document.getElementById(id).addEventListener('click',()=>setMode(value));
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-galaxy-select]');if(b)return selectEntity(...b.dataset.galaxySelect.split(':'));
 if(event.target.closest('[data-galaxy-close],[data-galaxy-fit]'))return close();
 const move=event.target.closest('[data-galaxy-move]');if(move){const target=[...Object.values(snapshot.moves||{}).flat(),...galaxy.values.flatMap(v=>v.moves||[])].find(m=>m.id===move.dataset.galaxyMove);if(target)emit('move',{move:target});return}
 const value=event.target.closest('[data-galaxy-value],[data-galaxy-value-select],[data-galaxy-dependency]');if(value){const next=value.dataset.galaxyValue||value.dataset.galaxyValueSelect||value.dataset.galaxyDependency;selectedValueId=value.dataset.galaxyValueSelect&&selectedValueId===next?null:next;selectEntity('product',galaxy.product.id);return}
 const filter=event.target.closest('[data-galaxy-filter]');if(filter){productFilter=filter.dataset.galaxyFilter;renderPanel()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))close()});
window.addEventListener('product-galaxy:snapshot',e=>update(e.detail.snapshot));
if(window.__productGalaxySnapshot)update(window.__productGalaxySnapshot);

document.addEventListener('change',event=>{if(!event.target.matches('[data-development-segment]'))return;lastSegmentId=event.target.value||lastSegmentId;productFilter=event.target.value?'segment':'all';selectedValueId=null;renderPanel()});

