const {createHash,randomUUID}=require('node:crypto')
const {GraphTransaction}=require('../graph/writer')
const store=require('../research/store')
const analysis=require('../research/segment-analysis')
function save(workspace,body){
 if(!Number.isInteger(body.expectedRevision)||!Number.isInteger(body.expectedResearchRevision))throw Object.assign(new Error('Обновите данные перед сохранением'),{status:400})
 const label=typeof body.label==='string'?body.label.trim():''
 if(!label||label.length>160)throw Object.assign(new Error('Название должно содержать от 1 до 160 символов'),{status:400})
 const tx=new GraphTransaction(workspace,{expectedRevision:body.expectedRevision,strict:true})
 try{
  const data=store.load(workspace)
  if(data.revision!==body.expectedResearchRevision)throw Object.assign(new Error('Данные исследования изменились. Обновите результат и повторите сохранение.'),{status:409})
  const model=analysis.build(data,tx.graph,body.segmentId),filters=analysis.normalizeFilters(body.filters,model.parameters)
  if(!Object.keys(filters).length)throw Object.assign(new Error('Выберите хотя бы один параметр подсегмента'),{status:400})
  const identity=JSON.stringify([model.base.id,filters]),id='seg-view-'+createHash('sha256').update(identity).digest('hex').slice(0,20)
  const existing=tx.graph.nodes.find(n=>n.id===id)
  if(existing)return {id,label:existing.label,existing:true,revision:tx.graph.revision}
  const selected=analysis.aggregate(model,filters)
  if(!selected.materialCount)throw Object.assign(new Error('По этим условиям пока нет материалов. Измените параметры.'),{status:400})
  const condition=Object.entries(filters).map(([key,value])=>{const p=model.parameters.find(p=>p.id===key);return p.label+': '+(Array.isArray(value)?value.map(v=>v===analysis.UNKNOWN?'не указано':p.values.find(x=>x.id===v).label).join(' или '):value.unknown?'не указано':[value.min!=null?'от '+value.min:'',value.max!=null?'до '+value.max:''].filter(Boolean).join(' '))}).join('; ')
  const report='reports/segment-views/'+new Date().toISOString().slice(0,10)+'_'+randomUUID()+'.md'
  tx.source=report
  tx.stageFile(report,`# ${label.replace(/[\r\n]/g,' ')}\n\nСохранено пользователем в консоли.\n\nБазовый сегмент: ${model.base.label}.\nУсловия: ${condition}.\n\nНа момент сохранения: ${selected.materialCount} материалов, ${selected.dossierCount} досье. Это не число установленных уникальных людей и не доля рынка.\nРеестр: ${data.revision}; факты: ${data.factRevision}; граф до записи: ${tx.graph.revision}.\n\nСостав обновляется по текущим данным; критерии и приоритеты вычисляются только из отобранных случаев. Подтверждение спроса не наследуется.\n\n\`\`\`json\n${JSON.stringify({baseSegmentId:model.base.id,filters},null,2)}\n\`\`\`\n`)
  tx.node(id,'segment',label,{source:report,data:{shortName:label,description:condition,segmentationLevel:'subsegment',classificationBasis:'observable_context',cohortView:{version:1,baseSegmentId:model.base.id,filters,parameterDefinitions:model.parameters,savedResearchRevision:data.revision},priorityOrder:'unknown'}})
  tx.edge(id,'sub_segment_of',model.base.id,{basis:'observable_context',sharperContext:condition,criteriaInheritance:'not_asserted',priorityOrder:'unknown',source:report})
  const result=tx.commit();return {id,label,existing:false,revision:result.graph.revision,report}
 }catch(error){if(error.code==='REVISION_CONFLICT')error.status=409;throw error}finally{tx.close()}
}
module.exports={save}
