document.querySelector('[data-reader-back]')?.addEventListener('click',event=>{
  try { if(new URL(document.referrer).origin===location.origin && history.length>1){event.preventDefault();history.back()} }catch{}
})
for(const table of document.querySelectorAll('table')){table.tabIndex=0;table.setAttribute('role','region');table.setAttribute('aria-label','Таблица отчёта — прокрутка по горизонтали')}
