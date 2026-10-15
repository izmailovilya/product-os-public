// The same compact/expanded annotation view is used by the catalog and Chrome.
// Caller-supplied text is inserted as text, never HTML or page instructions.
;(() => {
  if (globalThis.productOsAnnotationPopover) return
  function render(panel, model, { expanded = false, onExpand, onClose } = {}) {
    panel.replaceChildren()
    panel.classList.add('os-annotation-popover')
    panel.dataset.mode = expanded ? 'expanded' : 'preview'
    panel.setAttribute('role', expanded ? 'dialog' : 'region')
    panel.setAttribute('aria-label', expanded ? 'Разбор коммуникации' : 'Краткий разбор коммуникации')
    const add = (parent, tag, text, className) => {
      const node = document.createElement(tag)
      if (text) node.textContent = text
      if (className) node.className = className
      parent.append(node); return node
    }
    const marker = (parent, item) => {
      const node=add(parent,'span',item.label,'os-segment-marker')
      node.dataset.markerColor=Number.isInteger(item.colorIndex) && item.colorIndex<12 ? item.colorIndex : 'neutral'
      node.dataset.basis=item.basis==='inferred' || item.basis==='interpretation' ? 'interpretation' : 'supported'
    }
    const header=add(panel,'header',null,'os-annotation-popover-heading')
    add(header,'h2',expanded ? model.title : model.shortTitle || model.title)
    const body=add(panel,'div',null,'os-annotation-popover-content')
    add(body,'p',model.quote,'os-annotation-popover-quote')
    if(expanded || model.basis==='inferred')add(body,'p',model.basis==='inferred' ? 'Предположение модели' : 'Смысл выражен в тексте.','os-annotation-popover-meta')
    if(expanded){
      if(model.signals?.length>1)for(const signal of model.signals){
        const heading=add(body,'h3');marker(heading,signal)
        if(signal.text && signal.text!==model.quote)add(body,'p',signal.text)
      }
      if(model.pattern){add(body,'h3','Приём коммуникации');add(body,'p',model.pattern)}
      if(model.audienceHint){add(body,'h3','Гипотеза об аудитории');add(body,'p',model.audienceHint)}
      for(const link of model.links || []){
        const heading=add(body,'h3');marker(heading,link)
        if(link.jobLabel)add(body,'p',link.jobLabel)
        if(link.criterionLabel)add(body,'p','Критерий: '+link.criterionLabel)
        add(body,'p',link.basis==='supported' ? 'Явное сопоставление' : 'Вероятная интерпретация','os-annotation-popover-meta')
        add(body,'p',link.explanation)
      }
      if(!model.links?.length && model.unlinkedNote)add(body,'p',model.unlinkedNote,'os-annotation-popover-meta')
      if(model.explanation)add(body,'p',model.explanation)
    }
    const footer=add(panel,'footer',null,'os-annotation-popover-actions')
    const button=add(footer,'button',expanded ? 'Закрыть' : 'Подробнее','os-button os-button-secondary')
    button.type='button'
    if(!expanded)button.setAttribute('aria-expanded','false')
    button.addEventListener('click',expanded ? onClose : onExpand)
    return button
  }
  globalThis.productOsAnnotationPopover=Object.freeze({render})
})()
