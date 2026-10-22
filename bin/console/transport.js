const {createHash}=require('node:crypto')
const {gzip}=require('node:zlib')

// Revalidate toolkit files; never put workspace JSON or documents in the HTTP cache.
function sendContent(response,status,body,type,{request=response.req,cache='no-store',etag=false}={}) {
  const bytes=Buffer.isBuffer(body)?body:Buffer.from(body)
  const headers={'content-type':type,'cache-control':cache}
  const compress=bytes.length>1024&&/^(text\/|application\/json|image\/svg\+xml)/.test(type)
  if(compress)headers.vary='Accept-Encoding'
  if(etag){
    headers.etag='W/"'+createHash('sha256').update(bytes).digest('hex')+'"'
    if((request?.headers['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===headers.etag.slice(2))){
      response.writeHead(304,headers);response.end();return
    }
  }
  const accepted=(request?.headers['accept-encoding']||'').split(',').some(value=>{
    const [encoding,...parameters]=value.trim().toLowerCase().split(';')
    const quality=parameters.map(p=>p.trim()).find(p=>p.startsWith('q='))
    return encoding==='gzip'&&(!quality||Number(quality.slice(2))>0)
  })
  const end=(data,encoded=false)=>{
    if(response.destroyed)return
    response.writeHead(status,{...headers,'content-length':data.length,...(encoded?{'content-encoding':'gzip'}:{})})
    response.end(data)
  }
  if(compress&&accepted)gzip(bytes,{level:1},(error,data)=>end(error?bytes:data,!error))
  else end(bytes)
}
module.exports={sendContent}
