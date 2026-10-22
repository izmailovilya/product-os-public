// Small, versioned, session-only cache for read-only catalogues. Views own their
// lifetime; a shared request may finish after one view has gone away.
export function createReadCache({fetcher=(...args)=>fetch(...args),now=()=>Date.now(),maxAge=30_000,maxEntries=4,accept=value=>value?.state==='ready'}={}) {
 const entries=new Map(),keyOf=(url,version)=>JSON.stringify([url,version])
 const fresh=entry=>entry?.value&&now()-entry.at<maxAge
 function touch(key,entry){entries.delete(key);entries.set(key,entry);while(entries.size>maxEntries)entries.delete(entries.keys().next().value)}
 return {
  peek(url,{version=''}={}){const key=keyOf(url,version),entry=entries.get(key);if(!fresh(entry))return;touch(key,entry);return entry.value},
  load(url,{version='',refresh=false}={}){
   const key=keyOf(url,version),previous=entries.get(key)
   if(!refresh&&fresh(previous)){touch(key,previous);return Promise.resolve(previous.value)}
   if(!refresh&&previous?.pending)return previous.pending
   const entry={};touch(key,entry)
   entry.pending=Promise.resolve().then(()=>fetcher(url)).then(async response=>{
    if(!response.ok)throw Error('Не удалось загрузить данные')
    const value=await response.json()
    if(entries.get(key)===entry){if(accept(value)){entry.value=value;entry.at=now();entry.pending=null}else entries.delete(key)}
    return value
   }).catch(error=>{if(entries.get(key)===entry)entries.delete(key);throw error})
   return entry.pending
  }
 }
}
