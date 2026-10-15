const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const { init, importSource, sources } = require('../bin/public-workspace')
const expected = ['os-setup','product-context','product-status']
function temporary(t) { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-public-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir }

test('only the three public skills and reviewed files ship', () => {
  assert.deepEqual(fs.readdirSync(path.join(root,'skills'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort(),expected)
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'PUBLIC-RELEASE.json')))
  assert.deepEqual(manifest.skills,expected)
  for(const file of manifest.files) {
    assert.ok(!file.path.startsWith('sources/') && !file.path.startsWith('reports/'))
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,file.path))).digest('hex'),file.sha256,file.path)
  }
  for(const excluded of ['bin/article','bin/landing-review','bin/research-brief/service.js','evals','WORKSPACES.md'])assert.equal(fs.existsSync(path.join(root,excluded)),false,excluded)
})

test('init preserves existing passport and custom instructions on repeat',t=>{
  const dir=temporary(t)
  fs.writeFileSync(path.join(dir,'PRODUCT.md'),'# Existing product\nOwner text\n')
  fs.writeFileSync(path.join(dir,'AGENTS.md'),'Custom instructions\n')
  init(dir);const graph=fs.readFileSync(path.join(dir,'research-graph.json'),'utf8');init(dir)
  assert.equal(fs.readFileSync(path.join(dir,'PRODUCT.md'),'utf8'),'# Existing product\nOwner text\n')
  assert.ok(fs.readFileSync(path.join(dir,'AGENTS.md'),'utf8').startsWith('Custom instructions\n'))
  assert.equal(fs.readFileSync(path.join(dir,'research-graph.json'),'utf8'),graph)
  assert.equal(JSON.parse(graph).nodes.find(n=>n.type==='product').data.description.what,'Owner text')
})

test('import preserves exact bytes, deduplicates, and does not pretend to analyze',t=>{
  const dir=temporary(t);init(dir)
  const original=path.join(dir,'notes.md'),bytes=Buffer.from('# Original\r\nWords from the author.\r\n')
  fs.writeFileSync(original,bytes)
  const first=importSource(dir,original),second=importSource(dir,original)
  assert.equal(first.duplicate,false);assert.equal(second.duplicate,true)
  assert.deepEqual(fs.readFileSync(path.join(dir,first.source)),bytes)
  assert.equal(sources(dir).length,1)
  const record=JSON.parse(fs.readFileSync(path.join(dir,'research-graph.json'))).nodes.find(n=>n.id===first.id)
  assert.equal(record.status,'hypothesis');assert.match(record.data.summary,/ещё не разобрано/)
})

test('status completion writes only console metadata, never product memory',t=>{
  const dir=temporary(t);init(dir)
  const before=fs.readFileSync(path.join(dir,'research-graph.json'),'utf8')
  fs.mkdirSync(path.join(dir,'.product-os'),{recursive:true})
  const runId='run-test-status'
  fs.writeFileSync(path.join(dir,'.product-os','state.json'),JSON.stringify({launches:[{runId,move:{skill:'product-status',node:{id:'product'}}}]}))
  const {statusReceipt}=require('../bin/public-workspace')
  statusReceipt(dir,{runId,nodeId:'product',summary:'Прочитан существующий контекст.'})
  assert.equal(fs.readFileSync(path.join(dir,'research-graph.json'),'utf8'),before)
  assert.throws(()=>statusReceipt(dir,{runId:'run-unknown',nodeId:'product',summary:'Incorrect'}),/не найден/)
})

test('both agent installations contain only public skills and run independently',t=>{
  const dir=temporary(t)
  execFileSync(process.execPath,[path.join(root,'bin/product-os.js'),'install',dir,'--agent','both'])
  for(const [base,tools] of [['.agents','.agents/product-os-tools'],['.claude','.claude/skills/product-os-tools']]) {
    const skillDir=path.join(dir,base,'skills')
    assert.deepEqual(fs.readdirSync(skillDir,{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!=='product-os-tools').map(e=>e.name).sort(),expected)
    const runtime=path.join(dir,tools)
    assert.deepEqual(fs.readdirSync(path.join(runtime,'skills'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort(),expected)
    assert.match(execFileSync(process.execPath,[path.join(runtime,'bin/product-os.js'),'help'],{encoding:'utf8'}),/Product OS Public/)
  }
})

test('installation refuses another edition before changing either agent',t=>{
  const dir=temporary(t),foreign=path.join(dir,'.agents/product-os-tools')
  fs.mkdirSync(foreign,{recursive:true});fs.writeFileSync(path.join(foreign,'package.json'),'{"name":"product-os"}')
  assert.throws(()=>require('../bin/install').install(dir,{agent:'both'}),/другой Product OS/)
  assert.equal(fs.existsSync(path.join(dir,'.claude')),false)
  assert.equal(fs.readFileSync(path.join(foreign,'package.json'),'utf8'),'{"name":"product-os"}')
})

test('console serves source and three basic skills; advanced routes are unavailable',async t=>{
  const dir=temporary(t);init(dir)
  const original=path.join(dir,'note.md');fs.writeFileSync(original,'# Test source\nExact source.\n');const imported=importSource(dir,original)
  const {createConsoleServer,listen}=require('../bin/console/server')
  const app=await createConsoleServer({workspace:dir,repoRoot:root,bbPath:false,claudePath:false,chromeAgent:false})
  t.after(()=>new Promise(resolve=>app.server.close(resolve)))
  const address=await listen(app.server),base=`http://127.0.0.1:${address.port}`
  const snap=await(await fetch(base+'/api/snapshot')).json()
  assert.deepEqual(snap.skills.map(s=>s.slug).sort(),expected)
  assert.equal(snap.sources[0].source,imported.source)
  assert.equal((await fetch(base+'/')).status,200)
  assert.equal((await fetch(base+'/source?path='+encodeURIComponent(imported.source))).status,200)
  const binary=Buffer.from([0,255,0,128,42]),binaryFile=path.join(dir,'sample.pdf');fs.writeFileSync(binaryFile,binary)
  const binarySource=importSource(dir,binaryFile)
  const download=await fetch(base+'/source?path='+encodeURIComponent(binarySource.source))
  assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/)
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),binary)
  assert.equal((await fetch(base+'/api/chrome/state')).status,404)
  const response=await fetch(base+'/api/research-briefs',{method:'POST',headers:{'content-type':'application/json','x-product-os-token':snap.csrfToken},body:'{"action":"create"}'})
  assert.equal(response.status,404)
  assert.ok(Object.values(snap.moves).flat().every(move=>expected.includes(move.skill)))
})
