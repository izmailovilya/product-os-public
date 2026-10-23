const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const telemetry=require('../bin/telemetry'),cli=require('../bin/product-os'),version=require('../package.json').version
function home(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-telemetry-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir}
function capture(userHome){const events=[];return{events,options:{userHome,env:{},fetchImpl:async(url,options)=>{events.push({url:new URL(url),options});return{status:204}}}}}

test('only fixed event metadata leaves the machine; arbitrary skill names are refused',async t=>{
  const c=capture(home(t));await telemetry.record('skill_used','product-status',c.options)
  assert.equal(c.events.length,1);const {url,options}=c.events[0]
  assert.equal(url.origin,'https://productos.izmailov.tech');assert.equal(url.pathname,'/_cli_event')
  assert.deepEqual(Object.fromEntries(url.searchParams),{event:'skill_used',version,skill:'product-status'})
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.body,undefined)
  await assert.rejects(telemetry.record('skill_used','private-product-name',c.options),/Неизвестное/)
  await assert.rejects(telemetry.main(['skill-used','product-status','private-context'],c.options))
  assert.equal(c.events.length,1)
})
test('off is persistent, enabling cannot override DO_NOT_TRACK, and invalid settings fail closed',async t=>{
  const userHome=home(t),c=capture(userHome)
  await telemetry.main(['off'],c.options);await telemetry.record('install_success',null,c.options);assert.equal(c.events.length,0)
  assert.equal(telemetry.status({userHome,env:{}}).enabled,false)
  await telemetry.main(['on'],c.options)
  for(const env of [{DO_NOT_TRACK:'1'},{PRODUCT_OS_TELEMETRY:'0'},{CI:'true'},{NODE_TEST_CONTEXT:'child-v8'}])await telemetry.record('install_success',null,{...c.options,env})
  assert.equal(c.events.length,0)
  fs.writeFileSync(path.join(userHome,'.product-os/telemetry.json'),'broken')
  assert.equal(telemetry.status(c.options).enabled,false)
  await telemetry.record('install_success',null,c.options);assert.equal(c.events.length,0)
})
test('settings never follow a linked state directory or file',t=>{
  const userHome=home(t),outside=home(t)
  fs.symlinkSync(outside,path.join(userHome,'.product-os'))
  assert.throws(()=>telemetry.setEnabled(false,{userHome}),/ссылки/);assert.deepEqual(fs.readdirSync(outside),[])
  assert.equal(telemetry.status({userHome,env:{}}).enabled,false)
  fs.unlinkSync(path.join(userHome,'.product-os'));fs.mkdirSync(path.join(userHome,'.product-os'))
  const kept=path.join(outside,'keep.json');fs.writeFileSync(kept,'owner text')
  fs.symlinkSync(kept,path.join(userHome,'.product-os/telemetry.json'))
  assert.throws(()=>telemetry.setEnabled(false,{userHome}),/ссылки/);assert.equal(fs.readFileSync(kept,'utf8'),'owner text')
})
test('offline or stalled collection cannot fail or hang the workflow and never retries',async t=>{
  const userHome=home(t);let attempts=0
  const failed=await telemetry.record('install_success',null,{userHome,env:{},fetchImpl:async()=>{attempts++;throw Error('offline')}})
  assert.equal(failed.sent,false);assert.equal(attempts,1)
  const started=Date.now();let signal
  const stalled=await telemetry.record('install_success',null,{userHome,env:{},timeoutMs:20,fetchImpl:(_url,options)=>{attempts++;signal=options.signal;return new Promise(()=>{})}})
  assert.equal(stalled.reason,'timeout');assert.equal(signal.aborted,true);assert.ok(Date.now()-started<1000);assert.equal(attempts,2)
})
test('fresh install, same-version repeat and actual upgrade produce distinct counts for both agents together',async t=>{
  const userHome=home(t),c=capture(userHome),options={userHome,telemetryOptions:c.options}
  const marker=path.join(userHome,'owner.txt');fs.writeFileSync(marker,'keep')
  await cli.main(['install','--agent','both'],options)
  await cli.main(['install','--agent','both'],options)
  assert.deepEqual(c.events.map(e=>e.url.searchParams.get('event')),['install_success'])
  const runtime=path.join(userHome,'.agents/product-os-tools/package.json'),pkg=JSON.parse(fs.readFileSync(runtime));pkg.version='0.1.0';fs.writeFileSync(runtime,JSON.stringify(pkg))
  await cli.main(['install','--agent','both'],options)
  assert.deepEqual(c.events.map(e=>e.url.searchParams.get('event')),['install_success','update_success'])
  await telemetry.main(['off'],c.options);pkg.version='0.1.0';fs.writeFileSync(runtime,JSON.stringify(pkg))
  await cli.main(['install','--agent','both'],options);assert.equal(c.events.length,2)
  assert.equal(telemetry.status({userHome,env:{}}).enabled,false);assert.equal(fs.readFileSync(marker,'utf8'),'keep')
  for(const config of ['.agents/skills','.claude/skills']){
    assert.ok(fs.existsSync(path.join(userHome,config,'TELEMETRY.md')))
    for(const skill of telemetry.SKILLS){const text=fs.readFileSync(path.join(userHome,config,skill,'SKILL.md'),'utf8');assert.equal(text.split('product-os-public:usage:start').length,2);assert.ok(text.includes('telemetry skill-used '+skill))}
  }
})
test('a refused install produces no event and preserves both agent environments',async t=>{
  const userHome=home(t),c=capture(userHome)
  const conflict=path.join(userHome,'.claude/skills/os-setup');fs.mkdirSync(conflict,{recursive:true});fs.writeFileSync(path.join(conflict,'SKILL.md'),'owner skill')
  await assert.rejects(cli.main(['install','--agent','both'],{userHome,telemetryOptions:c.options}),/Сохраните/)
  assert.equal(c.events.length,0);assert.equal(fs.readFileSync(path.join(conflict,'SKILL.md'),'utf8'),'owner skill');assert.equal(fs.existsSync(path.join(userHome,'.agents')),false)
})
test('adding the analytics document preserves an unrelated or edited shared document before either agent changes',async t=>{
  const userHome=home(t),c=capture(userHome),opts={userHome,telemetryOptions:c.options}
  await cli.main(['install','--agent','both'],opts)
  const document=path.join(userHome,'.claude/skills/TELEMETRY.md')
  fs.unlinkSync(path.join(userHome,'.claude/skills/product-os-tools/TELEMETRY.md'))
  fs.writeFileSync(document,'Owner analytics document')
  const codex=fs.readFileSync(path.join(userHome,'.agents/product-os-tools/package.json'),'utf8')
  await assert.rejects(cli.main(['install','--agent','both'],opts),/TELEMETRY.md/)
  assert.equal(fs.readFileSync(document,'utf8'),'Owner analytics document')
  assert.equal(fs.readFileSync(path.join(userHome,'.agents/product-os-tools/package.json'),'utf8'),codex)
  assert.equal(c.events.length,1)
})
