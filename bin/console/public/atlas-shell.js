import './atlas-route.js';
import { brandSignature } from './ui-components.js';
/* AppShell owns persistent navigation and the route outlet. Feature adapters own
   their contents; no polling, document bridge or DOM relocation is needed. */
const nav=document.querySelector('.atlas-navigation');
nav.querySelector('.atlas-nav-brand .os-brand').outerHTML=brandSignature();
const viewport=document.querySelector('#galaxyViewport');
function apply(route=window.AtlasRouteState.read()){
 document.body.classList.add('atlas-console');viewport.classList.add('atlas-enabled');
 for(const view of document.querySelectorAll('.view')){const active=view.dataset.view===route.contentTab;view.hidden=!active;view.inert=!active}
 for(const button of nav.querySelectorAll('button')){
  const active=button.id===route.navigationId;button.classList.toggle('atlas-nav-active',active);
  if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  if(button.hasAttribute('aria-pressed'))button.setAttribute('aria-pressed',String(active));
 }
 const tools=nav.querySelector('.atlas-nav-tools');if(tools&&['tab-reports','tab-skills'].includes(route.navigationId))tools.open=true;
 revealActiveNavigation();
}
function revealActiveNavigation(){
 const active=nav.querySelector('[aria-current="page"]');
 if(active&&matchMedia('(max-width:767px)').matches){const group=active.parentElement;group.scrollLeft=Math.max(0,active.offsetLeft-group.offsetLeft-(group.clientWidth-active.offsetWidth)/2)}
}
const observer=new ResizeObserver(()=>{document.body.style.setProperty('--atlas-mobile-nav-height',`${nav.getBoundingClientRect().height}px`);revealActiveNavigation()});observer.observe(nav);
window.addEventListener('pagehide',()=>observer.disconnect());
window.addEventListener('pageshow',()=>observer.observe(nav));
window.AtlasAppShell={apply};apply();
