/* Route-derived shell state must be available before workspace data loads. */
(() => {
 const roots={
  'research-brief':'tab-skills',product:'atlasProductToggle',map:'galaxyMapToggle',job:'galaxyMapToggle',segment:'galaxyMapToggle',
  people:'galaxyMapToggle',person:'galaxyMapToggle',competitor:'galaxyFleetToggle',hangar:'galaxyFleetToggle',
  communications:'galaxyCommunicationsToggle',channel:'galaxyCommunicationsToggle',material:'galaxyCommunicationsToggle',
  next:'tab-next',reports:'tab-reports',skills:'tab-skills'
 };
 const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};
 function read(hash=location.hash){
  let route=String(hash||'').replace(/^#/,'')||'product';
  if(route==='product/actions')route='next';
  if(route==='comms')route='communications';
  if(route.startsWith('product-detail/'))route='product';
  if(route.startsWith('segment-detail/')){const [path,search]=route.split('?');route='segment/'+path.split('/')[1]+'/checks'+(search?'?'+search:'')}
  const kind=decode(route.split('?')[0].split('/')[0]||'product');
  const contentTab=['next','reports','skills'].includes(kind)?kind:'map';
  return{
   route,kind,contentTab,
   navigationId:roots[kind]||'galaxyMapToggle',
   mode:kind==='hangar'?'fleet':['communications','channel','material'].includes(kind)?'communications':'map',
   mapView:kind==='product'?'product':'map'
  };
 }
 // Transient history belongs to the route owner. Its callbacks contain no feature state.
 const layers=new Map();let serial=0,pending=false,queued=[];
 const layerIds=()=>Array.isArray(history.state?.atlasLayers)?history.state.atlasLayers:[];
 function cleanState(state=history.state){const next={...state};delete next.atlasLayers;return next}
 function later(action){if(pending)queued.push(action);else action()}
 function traverse(count,after){if(after)queued.push(after);if(pending)return;pending=true;history.go(-count)}
 // popstate runs before the browser restores fragment focus. Consumers that
 // return focus wait for our queue and those rendering turns, including Back.
 function whenSettled(){return new Promise(resolve=>{
  const check=()=>later(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
   if(pending)check();else resolve()
  })));check()
 })}
 function dismiss(ids,reason){for(const id of [...ids].reverse()){const layer=layers.get(id);if(layer){layers.delete(id);layer.dismiss(reason)}}}
 const overlays={
  open(dismissLayer){const id=`layer-${++serial}`;layers.set(id,{dismiss:dismissLayer,url:location.href});later(()=>{if(layers.has(id))history.pushState({...history.state,atlasLayers:[...layerIds(),id]},'')});return id},
  close(id){if(!layers.has(id))return;layers.delete(id);later(()=>{const ids=layerIds(),index=ids.indexOf(id);if(index<0)return;dismiss(ids.slice(index+1),'parent');traverse(ids.length-index)})},
  whenSettled,
  get active(){return layers.size>0}
 };
 // The pending traversal is our own dismissal, not page navigation. Queue a new
 // route until it completes so close-and-navigate cannot race history.back().
 window.addEventListener('popstate',event=>{
  if(pending){event.stopImmediatePropagation();pending=false;const actions=queued;queued=[];for(const action of actions)later(action);return}
  const allowed=new Set(layerIds());dismiss([...layers.keys()].filter(id=>!allowed.has(id)||layers.get(id).url!==location.href),'history');
  const live=layerIds().filter(id=>layers.has(id));if(live.length!==layerIds().length)history.replaceState({...cleanState(),...(live.length?{atlasLayers:live}:{})},'');
 },true);
 window.addEventListener('hashchange',()=>dismiss([...layers.keys()].filter(id=>layers.get(id).url!==location.href),'route'),true);
 function write(route,{replace=false,state={}}={}){
  const next=read('#'+route);let committed;
  next.committed=new Promise(resolve=>committed=resolve);
  const commit=()=>{history[replace?'replaceState':'pushState'](cleanState(state),'','#'+next.route);committed()};
  dismiss([...layers.keys()],'route');
  later(()=>{const ids=layerIds();if(ids.length)traverse(ids.length,commit);else commit()});return next
 }
 function remember(value){history.replaceState({...history.state,...value},'')}
 function subscribe(listener){const change=()=>{const state=read();if(location.hash!=='#'+state.route)write(state.route,{replace:true,state:history.state||{}});listener(state)};window.addEventListener('popstate',change);window.addEventListener('hashchange',change);return()=>{window.removeEventListener('popstate',change);window.removeEventListener('hashchange',change)}}
 window.AtlasRouteState={read,write,remember,subscribe,overlays};
})();
