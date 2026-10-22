const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const { init, importSource, sources } = require('../bin/public-workspace')
const expected = ['os-setup','product-brand-identity','product-context','product-job-map','product-reference-library','product-research','product-segment-hypotheses','product-status']
const skillDirs = dir => fs.readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort((a,b)=>a.localeCompare(b,'en'))
function temporary(t) { const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-public-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir }

test('only the public skills and reviewed files ship', () => {
  assert.deepEqual(skillDirs(path.join(root,'skills')),expected)
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
    assert.deepEqual(skillDirs(skillDir).filter(name=>name!=='product-os-tools'),expected)
    const runtime=path.join(dir,tools)
    assert.deepEqual(fs.readdirSync(path.join(runtime,'skills'),{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort(),expected)
    assert.match(execFileSync(process.execPath,[path.join(runtime,'bin/product-os.js'),'help'],{encoding:'utf8'}),/Product OS/)
  }
})
test('global install is reused by two products and updates preserve unrelated skills and data',async t=>{
  const dir=temporary(t),userHome=path.join(dir,'user'),cli=require('../bin/product-os')
  fs.mkdirSync(userHome)
  fs.writeFileSync(path.join(userHome,'AGENTS.md'),'Personal home rules\n')
  fs.writeFileSync(path.join(userHome,'CLAUDE.md'),'Personal Claude rules\n')
  for(const config of ['.agents','.claude']) {
    const nmt=path.join(userHome,config,'skills/nmt-chat');fs.mkdirSync(nmt,{recursive:true})
    fs.writeFileSync(path.join(nmt,'SKILL.md'),'NMT must stay unchanged\n')
  }
  const result=await cli.main(['install','--agent','both'],{userHome})
  assert.equal(result.scope,'global')
  for(const file of ['PRODUCT.md','research-graph.json','sources','reports','MOVES.md','IDEAS.md'])assert.equal(fs.existsSync(path.join(userHome,file)),false,file)
  const runtimes=['.agents/product-os-tools','.claude/skills/product-os-tools'].map(file=>path.join(userHome,file))
  const projects=[]
  for(const [i,runtime] of runtimes.entries()) {
    const workspace=path.join(dir,'product-'+i);fs.mkdirSync(workspace)
    fs.writeFileSync(path.join(workspace,'PRODUCT.md'),`# Product ${i}\n\nOwner description ${i}\n`)
    fs.writeFileSync(path.join(workspace,'AGENTS.md'),'Owner workspace instructions\n')
    await require(path.join(runtime,'bin/product-os')).main(['setup',workspace,'--agent','both'],{userHome})
    await assert.rejects(require(path.join(runtime,'bin/product-os')).main(['setup',path.join(runtime,'nested-product'),'--agent','both'],{userHome}),/вне установленного инструментария/)
    assert.equal(fs.existsSync(path.join(runtime,'nested-product')),false)
    const other=runtimes[1-i],insideOther=path.join(other,'nested-product')
    await assert.rejects(require(path.join(runtime,'bin/product-os')).main(['setup',insideOther,'--agent','both'],{userHome}),/вне установленного инструментария/)
    assert.equal(fs.existsSync(insideOther),false)
    for(const config of ['.agents','.claude'])assert.equal(fs.existsSync(path.join(workspace,config)),false,'No local copy: '+config)
    const instructions=fs.readFileSync(path.join(workspace,'AGENTS.md'),'utf8')
    assert.ok(instructions.startsWith('Owner workspace instructions\n'))
    assert.ok(instructions.includes('~/.agents/product-os-tools'))
    assert.match(fs.readFileSync(path.join(workspace,'CLAUDE.md'),'utf8'),/~\/\.claude\/skills\/product-os-tools/)
    const source=path.join(dir,'note-'+i+'.md');fs.writeFileSync(source,'Original '+i+'\n')
    const saved=require(path.join(runtime,'bin/workspace')).importSource(workspace,source)
    execFileSync(process.execPath,[path.join(runtime,'bin/graph-write.js'),workspace,'--check'])
    const {createConsoleServer,listen}=require(path.join(runtime,'bin/console/server'))
    const app=await createConsoleServer({workspace,repoRoot:runtime,bbPath:false,claudePath:false,codexPath:false,chromeAgent:false})
    try {
      const address=await listen(app.server),response=await fetch(`http://127.0.0.1:${address.port}/api/snapshot`)
      const snapshot=await response.json()
      assert.equal(snapshot.graph.nodes.find(n=>n.type==='product').label,'Product '+i)
    } finally {await new Promise(resolve=>app.server.close(resolve))}
    const files=['PRODUCT.md','research-graph.json','AGENTS.md','CLAUDE.md',saved.source]
    projects.push({workspace,files,before:files.map(file=>fs.readFileSync(path.join(workspace,file)))})
  }
  for(const runtime of runtimes) {
    await require(path.join(runtime,'bin/product-os')).main(['install','--agent','both'],{userHome})
    for(const other of runtimes)assert.match(execFileSync(process.execPath,[path.join(other,'bin/product-os.js'),'help'],{encoding:'utf8'}),/Product OS/)
  }
  for(const {workspace,files,before} of projects)assert.deepEqual(files.map(file=>fs.readFileSync(path.join(workspace,file))),before)
  for(const config of ['.agents','.claude'])assert.equal(fs.readFileSync(path.join(userHome,config,'skills/nmt-chat/SKILL.md'),'utf8'),'NMT must stay unchanged\n')
  assert.equal(fs.readFileSync(path.join(userHome,'AGENTS.md'),'utf8'),'Personal home rules\n')
  assert.equal(fs.readFileSync(path.join(userHome,'CLAUDE.md'),'utf8'),'Personal Claude rules\n')
})
test('global install validates both agents before touching conflicts or symlink targets',async t=>{
  const dir=temporary(t),userHome=path.join(dir,'user'),foreign=path.join(userHome,'.agents/product-os-tools')
  fs.mkdirSync(foreign,{recursive:true});fs.writeFileSync(path.join(foreign,'package.json'),'{"name":"product-os"}')
  const cli=require('../bin/product-os')
  await assert.rejects(cli.main(['install','--agent','both'],{userHome}),/другой Product OS/)
  assert.equal(fs.existsSync(path.join(userHome,'.claude')),false)
  const other=path.join(dir,'other-user'),outside=path.join(dir,'outside');fs.mkdirSync(outside)
  fs.mkdirSync(path.join(other,'.agents/skills'),{recursive:true})
  fs.symlinkSync(outside,path.join(other,'.agents/skills/product-context'))
  await assert.rejects(cli.main(['install','--agent','both'],{userHome:other}),/символические ссылки/)
  assert.equal(fs.existsSync(path.join(other,'.claude')),false)
  assert.deepEqual(fs.readdirSync(outside),[])
  for(const args of [['--agent'],['--unknown'],['--agent','missing']])await assert.rejects(cli.main(['install',...args],{userHome:path.join(dir,'invalid')}),/install/)
  assert.equal(fs.existsSync(path.join(dir,'invalid')),false)
  const nested=path.join(dir,'nested-user')
  await cli.main(['install','--agent','codex'],{userHome:nested})
  const skill=path.join(nested,'.agents/skills/product-status/SKILL.md'),outsideFile=path.join(dir,'outside.md')
  fs.writeFileSync(outsideFile,'Keep outside\n');fs.unlinkSync(skill);fs.symlinkSync(outsideFile,skill)
  await assert.rejects(cli.main(['install','--agent','both'],{userHome:nested}),/символические ссылки/)
  assert.equal(fs.readFileSync(outsideFile,'utf8'),'Keep outside\n')
  assert.equal(fs.existsSync(path.join(nested,'.claude')),false)
})
test('custom skills and their sharing decision survive Public updates from either runtime',t=>{
  const dir=temporary(t),workspace=path.join(dir,'product'),source=path.join(dir,'team-check')
  fs.mkdirSync(workspace);fs.mkdirSync(source)
  fs.writeFileSync(path.join(source,'SKILL.md'),'---\nname: team-check\ndescription: Check one team task.\n---\n\nUse PRODUCT.md.\n')
  const cli=path.join(root,'bin/product-os.js')
  execFileSync(process.execPath,[cli,'setup',workspace,'--agent','both'])
  execFileSync(process.execPath,[cli,'skills','add',workspace,source])
  execFileSync(process.execPath,[cli,'skills','verify',workspace,'team-check','--evidence','Checked a fictional task.'])
  execFileSync(process.execPath,[cli,'skills','decline',workspace,'team-check'])
  const canonical=path.join(workspace,'.product-os/custom-skills/team-check/SKILL.md'),bytes=fs.readFileSync(canonical)
  for(const runtime of ['.agents/product-os-tools','.claude/skills/product-os-tools']) {
    const installed=path.join(workspace,runtime,'bin/product-os.js')
    execFileSync(process.execPath,[installed,'setup',workspace,'--agent','both'])
    assert.deepEqual(fs.readFileSync(canonical),bytes)
    const offer=JSON.parse(execFileSync(process.execPath,[installed,'skills','offer',workspace,'team-check'],{encoding:'utf8'}))
    assert.equal(offer.shouldAsk,false);assert.equal(offer.verified,true)
    assert.equal(fs.existsSync(path.join(workspace,runtime,'CUSTOM-SKILLS.md')),true)
    for(const agent of ['.agents','.claude'])assert.deepEqual(fs.readFileSync(path.join(workspace,agent,'skills/team-check/SKILL.md')),bytes)
  }
})
test('installed Public can prepare and preview a standalone read-only sharing bundle',async t=>{
  const dir=temporary(t),workspace=path.join(dir,'product'),cli=path.join(root,'bin/product-os.js')
  execFileSync(process.execPath,[cli,'setup',workspace,'--agent','codex'])
  const installed=path.join(workspace,'.agents/product-os-tools/bin/product-os.js')
  const bundle=JSON.parse(execFileSync(process.execPath,[installed,'share','prepare',workspace,'--access','open','--name','fictional-public-console'],{encoding:'utf8'}))
  assert.equal(bundle.readOnly,true);assert.equal(bundle.published,false)
  const {preview}=require('../bin/share/cli'),app=await preview(bundle.directory)
  t.after(()=>new Promise(resolve=>app.server.close(resolve)))
  const response=await fetch(app.url+'/api/snapshot')
  assert.equal(response.status,200)
  assert.equal((await response.json()).sharedSnapshot.access,'open')
  assert.equal((await fetch(app.url+'/api/launch',{method:'POST'})).status,405)
  assert.equal(fs.existsSync(path.join(workspace,'.agents/product-os-tools/SHARING.md')),true)
})

test('setup prepares one workspace for both agents and preserves user work on repeat',t=>{
  const dir=temporary(t),workspace=path.join(dir,'my-product')
  fs.mkdirSync(workspace)
  fs.writeFileSync(path.join(workspace,'PRODUCT.md'),'# My product\n\nOwner description\n')
  fs.writeFileSync(path.join(workspace,'AGENTS.md'),'Personal instructions\n')
  const cli=path.join(root,'bin/product-os.js')
  const output=execFileSync(process.execPath,[cli,'setup',workspace,'--agent','both'],{encoding:'utf8'})
  assert.match(output,/Рабочее место готово/)
  const graph=fs.readFileSync(path.join(workspace,'research-graph.json'),'utf8')
  const notes=path.join(workspace,'notes.md');fs.writeFileSync(notes,'Original user material\n')
  const saved=importSource(workspace,notes)
  const withSource=fs.readFileSync(path.join(workspace,'research-graph.json'),'utf8')
  execFileSync(process.execPath,[cli,'setup',workspace,'--agent','both'])
  assert.equal(fs.readFileSync(path.join(workspace,'PRODUCT.md'),'utf8'),'# My product\n\nOwner description\n')
  assert.ok(fs.readFileSync(path.join(workspace,'AGENTS.md'),'utf8').startsWith('Personal instructions\n'))
  assert.equal(fs.readFileSync(path.join(workspace,'research-graph.json'),'utf8'),withSource)
  assert.equal(fs.readFileSync(path.join(workspace,saved.source),'utf8'),'Original user material\n')
  assert.equal(JSON.parse(graph).nodes.find(n=>n.type==='product').label,'My product')
  for(const runtime of ['.agents/product-os-tools','.claude/skills/product-os-tools']) {
    const installed=path.join(workspace,runtime,'bin/product-os.js')
    assert.match(execFileSync(process.execPath,[installed,'sources',workspace],{cwd:dir,encoding:'utf8'}),/notes.md/)
  }
})

test('installed runtimes repeat setup for both agents without self-deletion',t=>{
  const dir=temporary(t)
  fs.writeFileSync(path.join(dir,'PRODUCT.md'),'# Мой продукт\n\nОписание владельца\n')
  fs.writeFileSync(path.join(dir,'AGENTS.md'),'Personal instructions\n')
  execFileSync(process.execPath,[path.join(root,'bin/product-os.js'),'setup',dir,'--agent','both'])
  const notes=path.join(dir,'notes.md');fs.writeFileSync(notes,'Материал владельца\n')
  const saved=importSource(dir,notes)
  for(const cli of ['.agents/product-os-tools/bin/product-os.js','.claude/skills/product-os-tools/bin/product-os.js'])
    execFileSync(process.execPath,[path.join(dir,cli),'setup',dir,'--agent','both'])
  for(const [base,runtime] of [['.agents','.agents/product-os-tools'],['.claude','.claude/skills/product-os-tools']]) {
    assert.equal(fs.existsSync(path.join(dir,runtime,'bin','product-os.js')),true,base)
    assert.match(execFileSync(process.execPath,[path.join(dir,runtime,'bin','product-os.js'),'help'],{encoding:'utf8'}),/Product OS/)
    assert.deepEqual(skillDirs(path.join(dir,base,'skills')).filter(name=>name!=='product-os-tools'),expected)
  }
  assert.equal(fs.readFileSync(path.join(dir,'PRODUCT.md'),'utf8'),'# Мой продукт\n\nОписание владельца\n')
  assert.ok(fs.readFileSync(path.join(dir,'AGENTS.md'),'utf8').startsWith('Personal instructions\n'))
  assert.equal(fs.readFileSync(path.join(dir,saved.source),'utf8'),'Материал владельца\n')
  execFileSync(process.execPath,[path.join(dir,'.agents/product-os-tools/bin/graph-write.js'),dir,'--check'])
})

test('setup defaults to the current folder and respects the chosen agent',t=>{
  const dir=temporary(t)
  execFileSync(process.execPath,[path.join(root,'bin/product-os.js'),'setup','--agent','codex'],{cwd:dir})
  assert.ok(fs.existsSync(path.join(dir,'research-graph.json')))
  assert.ok(fs.existsSync(path.join(dir,'.agents/skills/product-context/SKILL.md')))
  assert.equal(fs.existsSync(path.join(dir,'.claude')),false)
  assert.equal(fs.existsSync(path.join(dir,'CLAUDE.md')),false)
})

test('setup rejects another edition or an invalid agent without initializing product data',t=>{
  const dir=temporary(t),foreign=path.join(dir,'.agents/product-os-tools')
  fs.mkdirSync(foreign,{recursive:true});fs.writeFileSync(path.join(foreign,'package.json'),'{"name":"product-os"}')
  const cli=path.join(root,'bin/product-os.js')
  assert.throws(()=>execFileSync(process.execPath,[cli,'setup',dir,'--agent','both'],{stdio:'pipe'}),/другой Product OS/)
  for(const file of ['PRODUCT.md','research-graph.json','CLAUDE.md','AGENTS.md'])assert.equal(fs.existsSync(path.join(dir,file)),false,file)
  assert.throws(()=>execFileSync(process.execPath,[cli,'setup',path.join(dir,'invalid'),'--agent','missing'],{stdio:'pipe'}),/setup/)
  assert.equal(fs.existsSync(path.join(dir,'invalid')),false)
})

test('installation refuses another edition before changing either agent',t=>{
  const dir=temporary(t),foreign=path.join(dir,'.agents/product-os-tools')
  fs.mkdirSync(foreign,{recursive:true});fs.writeFileSync(path.join(foreign,'package.json'),'{"name":"product-os"}')
  assert.throws(()=>require('../bin/install').install(dir,{agent:'both'}),/другой Product OS/)
  assert.equal(fs.existsSync(path.join(dir,'.claude')),false)
  assert.equal(fs.readFileSync(path.join(foreign,'package.json'),'utf8'),'{"name":"product-os"}')
})

test('console serves source and public skills; advanced routes are unavailable',async t=>{
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
  fs.writeFileSync(path.join(dir,'reports','saved-note.md'),'# Saved note\n\nSaved context.\n')
  const report=await(await fetch(base+'/report?path=reports%2Fsaved-note.md')).text()
  assert.ok(report.includes('href="/#materials"'))
  assert.ok(!report.includes('Взять следующий шаг'))
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

test('native job map round-trips through the public reader with a saved offering scope',t=>{
  const dir=temporary(t);init(dir)
  fs.mkdirSync(path.join(dir,'reports/job-map/run-1'),{recursive:true})
  const map={version:1,title:'Карта работ',basis:'Гипотезы из описания продукта.',scope:{productId:'product',goal:'Выбрать работы для исследования',edition:'full'},
    editions:{full:'Текущий продукт',public:'Отдельная версия не описана'},
    jobs:{'job-plan':{id:'job-plan',label:'Спланировать следующий шаг',kind:'original',description:'Человек решает, что делать дальше.',input:'Сохранённый контекст продукта.',output:'Выбранное направление.',mechanism:'Продукт собирает контекст в одном месте.',alternatives:'Заметки в разных файлах.',basis:'hypothesis',sourceRefs:['product-description'],
      full:{state:'assist',contribution:'Хранит контекст и решения с источниками.',limit:'Не выбирает направление за человека.',sources:['product-description']},
      public:{state:'unknown',contribution:'Отдельная версия не описана.',limit:'Возможности этой версии неизвестны.',sources:[]}}},
    graphs:[{id:'job-plan',title:'Спланировать следующий шаг',jobIds:['job-plan'],edges:[],note:'Один фрагмент.',boundary:'Решение остаётся за человеком.'}],
    contexts:[],sources:{'product-description':{kind:'owner',title:'PRODUCT.md',text:'Описание продукта владельцем.'}},inventory:[],
    review:{status:'unreviewed',sourceRefs:[]}}
  const mapFile=path.join(dir,'reports/job-map/run-1/map.json'),mapBytes=Buffer.from(JSON.stringify(map,null,2)+'\n')
  fs.writeFileSync(mapFile,mapBytes)
  fs.writeFileSync(path.join(dir,'reports/job-map/run-1/report.md'),'---\ntitle: Карта работ\ndate: 2026-10-21\nskill: product-job-map\nnodeId: product\noutcome: partial\nsummary: Черновик карты без независимой проверки.\n---\n\nЧерновик.\n')
  const operations=path.join(dir,'map-ops.json')
  fs.writeFileSync(operations,JSON.stringify({schemaVersion:1,expectedRevision:1,source:'reports/job-map/run-1/report.md',operations:[{op:'node',node:{id:'artifact-job-map-product',type:'artifact',label:'Карта работ',status:'hypothesis',data:{confidence:'ai',artifactKind:'strategic-job-map',version:1,productId:'product',mapPath:'reports/job-map/run-1/map.json',mapSha256:createHash('sha256').update(mapBytes).digest('hex')}}}]},null,2))
  execFileSync(process.execPath,[path.join(root,'bin/product-os.js'),'graph-write',dir,operations])
  const {strategicJobs}=require('../bin/console/strategic-jobs')
  const graph=JSON.parse(fs.readFileSync(path.join(dir,'research-graph.json'),'utf8'))
  const reading=strategicJobs(dir,graph,'product')
  assert.equal(reading.state,'ready')
  assert.equal(reading.map.scope.edition,'full')
  assert.equal(reading.map.jobs['job-plan'].full.state,'assist')
  assert.equal(reading.map.jobs['job-plan'].full.contribution,'Хранит контекст и решения с источниками.')
  assert.equal(reading.map.jobs['job-plan'].public.state,'unknown')
  const rejected=JSON.parse(mapBytes.toString());rejected.scope.edition='free'
  assert.throws(()=>require('../bin/console/strategic-jobs').validateMap(rejected),/Некорректная структура/)
})

test('focused research persists with the evidence op and reaches the console report list',async t=>{
  const dir=temporary(t);init(dir)
  const reportPath='reports/research/2026-10-21_probe.md'
  fs.mkdirSync(path.join(dir,'reports/research'),{recursive:true})
  fs.writeFileSync(path.join(dir,reportPath),'---\ntitle: Проверка вопроса\ndate: 2026-10-21\nskill: product-research\nnodeId: seg-probe\noutcome: partial\nsummary: Часть фактов подтверждена; независимая проверка не выполнялась.\n---\n\nОтвет на вопрос.\n')
  const operations=path.join(dir,'research-ops.json')
  fs.writeFileSync(operations,JSON.stringify({schemaVersion:1,expectedRevision:1,source:reportPath,operations:[
    {op:'node',node:{id:'seg-probe',type:'segment',label:'Возможные клиенты',status:'hypothesis',source:'PRODUCT.md',data:{confidence:'ai',customerProfileSource:'PRODUCT.md',customerProfile:{version:1,group:{id:'g',label:'Группа'},summary:{text:'Практика людей, которым продукт может помочь.',basis:'hypothesis',sourceRefs:[]},context:{text:'Рабочий контекст.',basis:'hypothesis',sourceRefs:[]},recognition:{text:'Узнаются по ситуации.',basis:'hypothesis',sourceRefs:[]},whySeparate:{text:'Другая ценность.',basis:'hypothesis',sourceRefs:[]},primaryJob:{text:'Сделать шаг.',basis:'hypothesis',sourceRefs:[]},productFit:{text:'Помощь контекстом.',basis:'hypothesis',sourceRefs:[]},alternatives:{text:'Заметки.',basis:'hypothesis',sourceRefs:[]},successCriteria:[],otherJobs:[],roles:{user:{text:'Пользуется сам в своей работе.',basis:'hypothesis',sourceRefs:[]},decisionMaker:{text:'Кто решает о покупке — неизвестно.',basis:'unknown',sourceRefs:[]},payer:{text:'Кто платит — неизвестно.',basis:'unknown',sourceRefs:[]}},journey:{trigger:{text:'Возникает задача.',basis:'hypothesis',sourceRefs:[]},discovery:{text:'Как находят — неизвестно.',basis:'unknown',sourceRefs:[]},firstUse:{text:'Первый сценарий не описан.',basis:'unknown',sourceRefs:[]},purchase:{text:'Покупка не описана.',basis:'unknown',sourceRefs:[]},retention:{text:'Повторное использование не описано.',basis:'unknown',sourceRefs:[]}},unknowns:['Кто платит']}}}},
    {op:'evidence',target:'seg-probe',text:'Публичная страница описывает практику.',source:'https://example.com/practice',origin:'web',relation:'evidenced_by'},
    {op:'complete',nodeId:'seg-probe',skill:'product-research',report:reportPath,outcome:'completed'}
  ]},null,2))
  execFileSync(process.execPath,[path.join(root,'bin/product-os.js'),'graph-write',dir,operations])
  const graph=JSON.parse(fs.readFileSync(path.join(dir,'research-graph.json'),'utf8'))
  assert.equal(graph.nodes.find(n=>n.id==='seg-probe').data.research['product-research'].report,reportPath)
  assert.ok(graph.nodes.some(n=>n.type==='evidence'&&n.source==='https://example.com/practice'))
  const {createConsoleServer,listen}=require('../bin/console/server')
  const app=await createConsoleServer({workspace:dir,repoRoot:root,bbPath:false,claudePath:false,chromeAgent:false})
  t.after(()=>new Promise(resolve=>app.server.close(resolve)))
  const address=await listen(app.server),base=`http://127.0.0.1:${address.port}`
  const snap=await(await fetch(base+'/api/snapshot')).json()
  const report=snap.reports.find(item=>item.path===reportPath)
  assert.equal(report.nodeId,'seg-probe')
  assert.equal(report.skill,'product-research')
  const identity=await(await fetch(base+'/api/product-identity?productId=product')).json()
  assert.equal(identity.state,'unregistered')
  const references=await(await fetch(base+'/api/product-references?productId=product')).json()
  assert.equal(references.state,'unregistered')
})
