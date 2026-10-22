const { Worker } = require('node:worker_threads')
const { digest } = require('../graph/schema')

// Reuse one worker's loaded code, rebuilding the data on every read. Completed
// results are never cached: file-only changes must remain immediately visible.
function createSnapshotProjector({workerFactory=()=>new Worker(require.resolve('./snapshot-worker'))}={}) {
  let queue=Promise.resolve(), worker=null, running=null, closed=false
  const pending=new Map()
  function getWorker(){
    if(worker)return worker
    const current=workerFactory();worker=current
    function failed(error){if(worker===current)worker=null;if(running?.worker===current){const task=running;running=null;task.reject(error)}}
    current.on('error',failed)
    current.on('exit',code=>failed(Error('Не удалось собрать данные консоли: '+code)))
    current.on('message',message=>{
      if(running?.worker!==current)return
      const task=running;running=null
      if(message.error)task.reject(Object.assign(Error(message.error.message),{code:message.error.code}))
      else task.resolve(message)
    })
    return current
  }
  function project(input) {
    const key=digest(input)
    if(pending.has(key))return pending.get(key)
    const result=queue.then(()=>new Promise((resolve,reject)=>{
      if(closed){reject(Error('Консоль закрыта'));return}
      try{const current=getWorker();running={worker:current,resolve,reject};current.postMessage(input)}
      catch(error){running=null;reject(error)}
    }))
    pending.set(key,result)
    queue=result.then(()=>{},()=>{})
    result.then(()=>pending.delete(key),()=>pending.delete(key))
    return result
  }
  return {project,close(){closed=true;if(running){running.reject(Error('Консоль закрыта'));running=null}worker?.terminate();worker=null}}
}
module.exports={createSnapshotProjector}
