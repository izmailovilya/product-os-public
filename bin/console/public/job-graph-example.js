// Fictional data only. The catalogue and regression suite use the production adapter.
export function jobGraphExample(){
 const evidence=[{label:'Вымышленная запись автора',source:'https://example.org/job-notes',quote:'Сначала собрать варианты, затем согласовать документ.'}]
 const job=(id,label,level)=>({id,label,level,status:'hypothesis',evidence,criteria:[]})
 const relation=(id,from,to,kind)=>({id,from,to,kind,evidence})
 return {segmentId:'catalog-segment',common:{id:'segment',scope:'segment',jobs:[
  job('big','Согласовать совместную работу без задержек','big'),
  {...job('core','Согласовать общий документ с несколькими независимыми участниками','core'),context:'Перед запуском следующего этапа нужно согласовать документ с командой.',criteria:[{id:'criterion',raw:'Уложиться в один рабочий день',priority:{kind:'ranked',rank:1},evidence}]},
  job('small','Собрать варианты решения у коллег','small'),
  job('micro','Уточнить название документа','micro'),
  job('unknown','Проверить формулировку задачи с автором — уровень пока не размечен',null)
 ],relations:[relation('purpose-core','core','big','in_order_to'),relation('purpose-small','small','big','in_order_to'),relation('order','small','core','precedes'),relation('part','micro','core','part_of')]},
 cases:[{id:'case-a',label:'Участник А · один эпизод',scope:'person',kind:'interview',membershipStatus:'candidate',jobs:[{id:'instance-a',rawOutcome:'Получить доступ к нужным инструментам',kind:'lower_level',level:null,evidence,criteria:[{id:'negative',raw:'Широкий охват не требуется',stance:'explicit_negative',priority:{kind:'unranked'},evidence}],previewFields:[{title:'Триггер',text:'Начинается совместная работа над документом.',evidence,note:'Интерпретация исследователя'}],missingFields:['Когда','Рассматриваемые способы']}],relations:[]},
 {id:'case-b',label:'Участник Б · другой эпизод',scope:'person',kind:'survey',membershipStatus:'candidate',jobs:[],relations:[]}],stale:true,
 profileJob:{text:'Подготовить документ и согласовать его с командой.',basis:'founder_claim',sourceRefs:[]},profileOtherJobs:[],profileCriteria:[]}
}
