const {createHash,randomUUID}=require('node:crypto')
const {GraphTransaction}=require('../graph/writer')
const {resolveSegmentModel,segmentSelection,evaluateSegmentModel,parameterViewRationale}=require('../segment-model')
function save(workspace,body){
 if(!Number.isInteger(body.expectedRevision))throw Object.assign(Error('Обновите модель перед сохранением'),{status:400})
 const label=typeof body.label==='string'?body.label.trim():'';if(!label||label.length>160)throw Object.assign(Error('Нужно название от 1 до 160 символов'),{status:400})
 const tx=new GraphTransaction(workspace,{expectedRevision:body.expectedRevision,strict:true})
 try{
  const scope=resolveSegmentModel(tx.graph,body.segmentId);if(!scope.model)throw Object.assign(Error('Модель параметров ещё не создана'),{status:400})
  const selection=segmentSelection(scope.model,body.selection);if(!Object.keys(selection).length)throw Object.assign(Error('Выберите условия подсегмента'),{status:400})
  const rationale=parameterViewRationale(scope.model,selection,scope.owner.data.parameterModelSource||scope.owner.source)
  const evaluation=evaluateSegmentModel(scope.model,selection);if(evaluation.conflictCount)throw Object.assign(Error('Сначала разрешите противоречивые правила модели'),{status:409})
  const id='seg-variant-'+createHash('sha256').update(JSON.stringify([scope.base.id,selection])).digest('hex').slice(0,20),existing=tx.graph.nodes.find(n=>n.id===id||n.type==='segment'&&n.data?.parameterView?.baseSegmentId===scope.base.id&&JSON.stringify(Object.fromEntries(Object.entries(n.data.parameterView.selection||{}).sort(([a],[b])=>a<b?-1:a>b?1:0)))===JSON.stringify(selection))
  if(existing){if(!existing.data.parameterView.rationale){tx.source=existing.source;tx.node(existing.id,'segment',existing.label,{data:{parameterView:{...existing.data.parameterView,rationale}}});const result=tx.commit();return {id:existing.id,label:existing.label,existing:true,revision:result.graph.revision}}return {id:existing.id,label:existing.label,existing:true,revision:tx.graph.revision}}
  const condition=Object.entries(selection).map(([key,value])=>{const p=scope.model.parameters.find(p=>p.id===key);return p.label+': '+p.values.find(v=>v.id===value).label}).join('; ')
  const report='reports/segment-views/'+new Date().toISOString().slice(0,10)+'_'+randomUUID()+'.md';tx.source=report
  tx.stageFile(report,`# ${label.replace(/[\r\n]/g,' ')}\n\nВариант модели сегмента ${scope.base.label}.\n\n${condition}\n\nСохранены условия, которые меняют задачи, критерии и предполагаемые приоритеты. Наличие респондентов не требуется. Правила остаются гипотезами; подтверждение спроса не наследуется.\n\nОснование модели: ${scope.owner.data.parameterModelSource||scope.owner.source}.\n\n${JSON.stringify(selection)}\n\n## Почему выделен подсегмент\n\n${rationale.parameters.map(p=>p.label+': '+p.value+' — '+p.whyCritical).join('\n\n')}\n\n${rationale.rules.map(r=>r.explanation).join('\n\n')}\n\n## Задачи и возможности продукта\n\n${rationale.jobs.map(j=>j.label+' — '+j.productFit.explanation).join('\n\n')}\n`)
  tx.node(id,'segment',label,{source:report,data:{shortName:label,description:condition,classificationBasis:'observable_context',parameterView:{version:1,baseSegmentId:scope.base.id,selection,rationale},priorityOrder:'conditional_hypothesis'}})
  tx.edge(id,'sub_segment_of',scope.base.id,{basis:'observable_context',sharperContext:condition,criteriaInheritance:'conditional_model',source:report})
  const result=tx.commit();return {id,label,existing:false,revision:result.graph.revision,report}
 }catch(error){if(error.code==='REVISION_CONFLICT')error.status=409;throw error}finally{tx.close()}
}
module.exports={save}
