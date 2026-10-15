import './atlas-shell.js';
import './atlas.js';
/* Reading-console routes. Objects have one address; previews never own another page. */
(() => {
 if(!['/','/atlas'].includes(location.pathname))return;
 const $=s=>document.querySelector(s),reader=$('#atlasReadingPage'),viewport=$('#galaxyViewport');
 const host=document.createElement('section');host.id='atlasObjectPage';host.hidden=true;host.setAttribute('aria-label','Страница объекта');viewport.append(host);
 const back=document.createElement('div');back.id='atlasRouteContext';back.hidden=true;viewport.append(back);
 const contextSize=new ResizeObserver(()=>viewport.style.setProperty('--atlas-context-height',`${back.getBoundingClientRect().height}px`));contextSize.observe(back);window.addEventListener('pagehide',()=>contextSize.disconnect(),{once:true});
 const nativePanel=$('#galaxyPanel');
 let interactionVersion=0;
 for(const event of ['pointerdown','keydown','focusin'])document.addEventListener(event,()=>interactionVersion++,true);
 const cache=new Map();let current=window.AtlasRouteState.read().route,applying=false,sequence=0,lastPerson='',ready=false;
 const enc=encodeURIComponent,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parts=route=>route.split('?')[0].split('/').map(value=>{try{return decodeURIComponent(value)}catch{return value}});
 const query=route=>new URLSearchParams(route.split('?')[1]||'');
 function label(route){const [kind,id,tab]=parts(route),g=window.__productGalaxySnapshot?.galaxy;if(kind==='job'||kind==='person'&&tab==='job')return 'Работа';if(kind==='person'){const p=g?.segments.flatMap(s=>s.participants||[]).find(p=>p.id===id);if(p)return p.displayName}return kind==='segment'?g?.segments.find(s=>s.id===id)?.displayLabel||'Сегмент':kind==='person'?'Досье респондента':kind==='competitor'?'Конкурент':kind==='channel'?'Канал':({'research-brief':'Бриф исследования',product:'Продукт',map:'Сегменты',people:'Все респонденты',hangar:'Конкуренты',communications:'Коммуникации',material:'Материал',next:'Что дальше',reports:'Отчёты',skills:'Скиллы'}[kind]||'Предыдущая страница')}
 const storageKey=()=>`product-os:navigation:${window.__productGalaxySnapshot?.workspace||location.origin}`;
 function loadCache(){try{for(const [key,value] of JSON.parse(sessionStorage.getItem(storageKey())||'[]')){if(value.reading)delete value.reading.filtersOpen;cache.set(key,value)}}catch{}}
 function capture(persist=true){const focused=document.activeElement;const data={scroll:host.scrollTop,windowScroll:window.scrollY,hangarScroll:$('#galaxyHangar').scrollTop,commScroll:$('#communicationsCenter').scrollTop,comm:window.ProductCommunications?.navigationState(),reading:window.AtlasContent?.capture(),focus:focused?.id?'#'+CSS.escape(focused.id):focused?.getAttribute('href')?'a[href='+JSON.stringify(focused.getAttribute('href'))+']':focused?.matches('[data-job-open]')?'[data-job-open='+JSON.stringify(focused.dataset.jobOpen)+']':null};cache.set(current,data);if(persist){window.AtlasRouteState.remember({atlasView:data});try{sessionStorage.setItem(storageKey(),JSON.stringify([...cache]))}catch{}}return data}
 function navMark(){window.AtlasAppShell.apply(window.AtlasRouteState.read('#'+current))}
 function fallback(route){const [kind,id,tab]=parts(route);return kind==='product'&&['development','brief'].includes(id)?'product/'+id:kind==='product'?'product':kind==='research-brief'?(id?'research-brief':'skills'):kind==='person'&&tab==='job'?`person/${enc(id)}/1`:kind==='person'?'people':kind==='competitor'?'hangar':kind==='channel'||kind==='material'?'communications':'map'}
 function context(){const [kind]=parts(current),from=history.state?.atlasFrom;back.hidden=['segment','product','map','hangar','communications','channel','material','next','reports','skills','people'].includes(kind);back.innerHTML=`<button type="button" data-atlas-back>← ${esc(from?'Вернуться: '+label(from):label(fallback(current)))}</button><span>${esc(label(current))}</span>`;viewport.classList.toggle('atlas-has-context',!back.hidden)}
 function storeRoute(route,replace=false,captureOld=true){const previous=captureOld?capture():null;const filters=reader.querySelector('.os-filter-disclosure');if(previous&&filters&&route.split('?')[0]===current.split('?')[0]){const saved=cache.get(route)||{};cache.set(route,{...saved,focus:previous.focus,reading:{...saved.reading,filtersOpen:filters.open}})}const identity=r=>{const p=parts(r);return p[0]==='person'&&p[2]==='job'?p.slice(0,4).join('/'):p.slice(0,2).join('/')};const sameObject=identity(route)===identity(current);const state={atlas:true,atlasFrom:replace||sameObject?history.state?.atlasFrom:current};const transition=window.AtlasRouteState.write(route,{replace,state});current=transition.route;context();navMark();return transition}
 function canLeave(){return window.ProductCommunications?.canLeave?.()!==false&&window.ProductResearchBrief?.canLeave?.()!==false}
 function readingRoute(route){const [kind,id]=parts(route),q=query(route);if(['communications','channel','material','hangar'].includes(kind)||kind==='product'&&id==='development'){q.delete('segment');return route.split('?')[0]+(q.size?'?'+q:'')}return route}
 async function navigate(route,{replace=false}={}){const actual=window.AtlasRouteState.read();if(parts(current)[0]==='hangar'&&actual.kind==='hangar')current=actual.route;route=readingRoute(route);if(route?.startsWith('product-detail/'))route='product';if(!route||route===current)return;if(!canLeave())return;const path=route.split('?')[0],from=current.split('?')[0],fresh=['hangar','reports','product/references','product/elements','product/materials'].includes(path)&&from!==path&&!from.startsWith(path+'/')&&!(path==='hangar'&&from.startsWith('competitor/'));const transition=storeRoute(route,replace);if(fresh){const saved=cache.get(route);if(saved?.reading)cache.set(route,{...saved,reading:{...saved.reading,filtersOpen:false}});const persistent=path==='hangar'?$('#galaxyHangar'):path==='reports'?$('#reportFilters'):null;const filters=persistent?.querySelector('.os-filter-disclosure');if(filters)filters.open=false}await transition.committed;if(current===transition.route)return apply()}
 function notFound(title='Страница не найдена'){
  window.ProductGalaxy.setMode('map');reader.hidden=true;host.hidden=false;
  host.innerHTML=window.OSUI.emptyState({kind:'unavailable',title,description:title==='Страница не найдена'?'Такой страницы в консоли нет. Проверьте адрес.':'Возможно, запись удалена или ссылка устарела.',actions:window.OSUI.textLink({label:'← '+label(fallback(current)),href:'#'+fallback(current)})});
 }
 function routeError(kind,id,tab,q){
  const snapshot=window.__productGalaxySnapshot,galaxy=snapshot.galaxy;
  if(kind==='competitor'&&!galaxy.competitors?.some(item=>item.id===id))return 'Конкурент не найден';
  if(kind==='segment-detail'&&!galaxy.segments?.some(item=>item.id===id))return 'Сегмент не найден';
  if(kind==='channel'&&!snapshot.communications?.nodes?.some(item=>item.id===id&&item.type==='channel'))return 'Канал не найден';
  if(kind==='material'&&!snapshot.communications?.nodes?.some(item=>item.id===id&&item.type==='artifact'&&item.data?.kind==='communication_material')&&!snapshot.communications?.legacy?.documents?.some(item=>item.id===id))return 'Материал не найден';
  if(kind==='product'&&id&&!['overview','goals','terms','positioning','development','actions','references','elements','materials','brief'].includes(id))return 'Раздел продукта не найден';
  if(kind==='communications'&&q.get('tab')&&!['channels','paths','materials','research'].includes(q.get('tab')))return 'Раздел коммуникаций не найден';
  if(!['next','reports','skills','product','map','segment','segment-detail','people','person','job','competitor','hangar','channel','material','communications','research-brief'].includes(kind))return 'Страница не найдена';
 }

 function click(el){if(el)el.click()}
 async function apply(){
   if(!ready)return;const canonical=readingRoute(current);if(canonical!==current){const transition=storeRoute(canonical,true,false);await transition.committed;}const seq=++sequence,focusVersion=interactionVersion;applying=true;
  const [kind,id,tab,jobId,jobTab]=parts(current),q=query(current),saved=cache.get(current),research=window.ResearchPages;
  research?.hide();window.AtlasContent.unmount();nativePanel.hidden=true;viewport.append(nativePanel);host.hidden=true;host.replaceChildren();
  click($('[data-tab="'+(['next','reports','skills'].includes(kind)?kind:'map')+'"]'));
  try{
   const invalid=routeError(kind,id,tab,q);if(invalid){notFound(invalid);return}
   if(['next','reports','skills'].includes(kind))return;
   window.ProductGalaxy.setMode(kind==='hangar'?'fleet':['communications','channel','material'].includes(kind)?'communications':'map');
   if(kind==='product'&&['goals','positioning','development','actions'].includes(id)){
    reader.hidden=true;host.hidden=false;window.ProductGalaxy.selectEntity('product',window.__productGalaxySnapshot.galaxy.product.id,{presentation:'page',topic:id,ideaId:id==='development'?tab||'':'',developmentSegment:''});
    host.append(nativePanel);nativePanel.classList.add('atlas-dossier-page');
   }else if(['person','people'].includes(kind)){
    reader.hidden=true;host.hidden=false;host.innerHTML='<p role="status">Открываю досье…</p>';
    if(kind==='people'){await research.registry();lastPerson=''}else if(lastPerson!==id){const loaded=await research.person(id);if(seq!==sequence||loaded===false)return;lastPerson=id}
    if(seq!==sequence)return;
    host.replaceChildren();host.append(research.dialog,research.jobDialog);research.showPerson();
    if(kind==='person'){research.section(tab==='job'?'1':tab||'0');if(tab==='job'){research.openJob(jobId);research.jobTab(jobTab||'context')}}
   }else if(kind==='competitor'||kind==='product-detail'||kind==='segment-detail'){
    reader.hidden=true;host.hidden=false;const type=kind.split('-')[0];window.ProductGalaxy.selectEntity(type,id||window.__productGalaxySnapshot.galaxy.product.id,{presentation:'page',topic:tab||'overview'});host.append(nativePanel);nativePanel.classList.add('atlas-dossier-page')
   }else if(['communications','channel','material'].includes(kind)){
    reader.hidden=true;
    const value=saved?.comm||{tab:'channels',segment:'',channel:'',channelOpen:false,material:'',contentEditor:''};
    if(!saved&&kind==='channel')Object.assign(value,{channel:id,channelOpen:true,channelView:q.get('view')||'overview'});
    if(!saved&&kind==='material')Object.assign(value,{tab:q.get('channel')?'channels':'materials',channel:q.get('channel')||'',channelOpen:!!q.get('channel'),channelView:'content',material:id,contentEditor:q.get('channel')?id:''});
    if(kind==='communications'&&!saved)value.tab=q.get('tab')||'channels';
    window.ProductCommunications.restoreNavigation(value);
   }else if(kind!=='hangar'){
    reader.hidden=false;await window.AtlasContent.render(saved?.reading);if(seq!==sequence)return;if(saved?.reading)window.AtlasContent.restore(saved.reading);
   }
  }catch(error){host.hidden=false;reader.hidden=true;console.error('Не удалось открыть страницу',error);host.innerHTML=window.OSUI.emptyState({kind:'unavailable',title:'Не удалось открыть страницу',description:'Проверьте подключение и повторите загрузку.',actions:window.OSUI.button({label:'Повторить',attributes:{'data-route-retry':''}})+window.OSUI.textLink({label:'← '+label(fallback(current)),href:'#'+fallback(current)})})}
  finally{if(seq===sequence){applying=false;context();navMark();requestAnimationFrame(()=>{if(seq!==sequence||focusVersion!==interactionVersion)return;host.scrollTop=saved?.scroll||0;$('#communicationsCenter').scrollTop=saved?.commScroll||0;$('#galaxyHangar').scrollTop=saved?.hangarScroll||0;window.scrollTo(0,saved?.windowScroll||0);let focus=saved?.focus&&document.querySelector(saved.focus);if(!focus||!focus.getClientRects().length){const active=document.querySelector('.view:not([hidden])');focus=[...(active?.querySelectorAll('h1,h2')||[])].find(el=>el.getClientRects().length);if(focus)focus.tabIndex=-1}focus?.focus({preventScroll:true})})}}
 }
 // Keep the existing native modules and their write actions; intercept navigation only.
 function syncCommunicationRoute(){const s=window.ProductCommunications.navigationState();const suffix='';const route=s.contentEditor&&s.contentEditor!=='new'?`material/${enc(s.contentEditor)}?channel=${enc(s.channel)}&${suffix}`:s.material&&s.tab==='materials'?`material/${enc(s.material)}?${suffix}`:s.channelOpen&&s.tab==='channels'?`channel/${enc(s.channel)}?view=${enc(s.channelView)}&${suffix}`:`communications?tab=${enc(s.tab)}&${suffix}`;if(route!==current){storeRoute(route,false,false);cache.set(route,{comm:s,commScroll:0});context();navMark()}}
 document.addEventListener('change',event=>{if(event.target.hasAttribute('data-development-segment')&&parts(current).slice(0,2).join('/')==='product/development'){event.stopImmediatePropagation();navigate('product/development'+(event.target.value?'?segment='+enc(event.target.value):''));return}if(event.target.id==='commSegment'){capture();setTimeout(syncCommunicationRoute)}},true);
 document.addEventListener('click',event=>{
  if(applying&&!event.isTrusted)return;const anchor=event.target.closest('a[href^="#"]');if(anchor&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&anchor.hash!=='#atlasPageOutlet'){event.preventDefault();event.stopImmediatePropagation();let route=anchor.hash.slice(1);navigate(route);return}const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-route-retry')){apply();return}
  if(b.hasAttribute('data-manage-products')){event.preventDefault();$('#manageProducts').click();return}
  const routes={atlasProductToggle:'product',galaxyMapToggle:'map',galaxyFleetToggle:'hangar',galaxyCommunicationsToggle:'communications','tab-next':'next','tab-reports':'reports','tab-skills':'skills'};
  let route=b.dataset.productRoute||(b.dataset.productTab?'product/'+b.dataset.productTab:b.dataset.atlasRoute||routes[b.id]);
  if(b.hasAttribute('data-atlas-back')||(b.hasAttribute('data-research-close')&&b.closest('.research-page'))||b.hasAttribute('data-galaxy-close')){event.preventDefault();event.stopImmediatePropagation();if(history.state?.atlasFrom)navigate(history.state.atlasFrom);else navigate(fallback(current));return}
  if(b.dataset.person)route=`person/${enc(b.dataset.person)}`;
  if(b.hasAttribute('data-research-all'))route='people';
  if(b.dataset.jobOpen)route=`person/${enc(window.ResearchPages.personId)}/job/${enc(b.dataset.jobOpen)}/context`;
  if(b.hasAttribute('data-research-section'))route=`person/${enc(window.ResearchPages.personId)}/${b.dataset.researchSection}`;
  if(b.dataset.jobTab){const p=parts(current);route=`person/${enc(p[1])}/job/${enc(p[3])}/${b.dataset.jobTab}`}
  if(b.dataset.hangarAction==='segment')route='segment/'+enc(b.dataset.segmentId);
  if(b.dataset.hangarAction==='mentioned-solution')route='competitor/'+enc(b.dataset.solutionId);
  if(b.dataset.hangarAction==='dossier')route=`competitor/${enc(b.closest('[data-hangar-card]')?.dataset.hangarCard)}`;
  if(b.dataset.galaxySelect){const [type,id]=b.dataset.galaxySelect.split(':');route=type==='segment'?`segment/${enc(id)}`:type==='competitor'?`competitor/${enc(id)}`:null}
  const ideaId=b.dataset.galaxyValue||b.dataset.galaxyValueSelect||b.dataset.galaxyDependency;
  if(ideaId){const segment=parts(current)[0]==='segment'?parts(current)[1]:query(current).get('segment');route='product/development/'+enc(ideaId)+(segment?'?segment='+enc(segment):'')}
  if(route){event.preventDefault();event.stopImmediatePropagation();navigate(route);return}
  if(b.dataset.commAction&&['channel','graph-channel','tab','material','edit-channel-material','channel-view','channels-home','materials-home','close-channel-material'].includes(b.dataset.commAction)){
   capture();setTimeout(syncCommunicationRoute)
  }
 },true);
 window.addEventListener('atlas:action',event=>{
  const d=event.detail;if(d.action==='presentation')return;
  const route=d.action==='navigate'?d.route:d.action==='person'?`person/${enc(d.id)}`:d.action==='people'?'people':d.action==='full'?(d.kind==='segment'?`segment/${enc(d.id)}/checks`:`${d.kind==='competitor'?'competitor':d.kind+'-detail'}/${enc(d.id)}`):d.action==='communications'?'communications':null;
  if(route)navigate(route);
 });
 window.AtlasRouteState.subscribe(state=>{if(state.route===current)return;if(!canLeave()){window.AtlasRouteState.write(current,{replace:true,state:history.state||{}});return}capture(false);current=state.route;if(history.state?.atlasView)cache.set(current,history.state.atlasView);apply()});
 // Mount once both runtime data and the reading renderer are initialized.
 function initialize(){if(ready||!window.AtlasContent.ready||!window.__productGalaxySnapshot||!window.ProductGalaxy)return;ready=true;loadCache();window.AtlasRouteState.write(current,{replace:true,state:{...history.state,atlas:true}});apply()}
 window.addEventListener('product-galaxy:ready',initialize);
 window.addEventListener('atlas:ready',initialize);
 window.AtlasNavigation={navigate,get route(){return current}};
 initialize();
})();
