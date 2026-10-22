const { parentPort } = require('node:worker_threads')
const { performance } = require('node:perf_hooks')
const {buildSnapshot}=require('./model'),{attachSegmentResearch}=require('./segment-research')
parentPort.on('message',input=>{
  const started=performance.now()
  try{
    const snapshot=buildSnapshot(input)
    attachSegmentResearch(snapshot.galaxy,input.researchData||{records:[],factRevision:0},input.graph)
    parentPort.postMessage({snapshot,duration:performance.now()-started})
  }catch(error){parentPort.postMessage({error:{message:error.message,code:error.code}})}
})
