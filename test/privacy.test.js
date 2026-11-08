const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const root=path.resolve(__dirname,'..'),cli=require('../bin/product-os'),{install,installationTargets}=require('../bin/install')
function temp(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-privacy-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir}
test('install, update and custom skill verification make no telemetry requests',async t=>{
  const home=temp(t),workspace=path.join(home,'product'),source=path.join(home,'local-check')
  let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Unexpected outbound request')};t.after(()=>{globalThis.fetch=original})
  await cli.main(['install','--agent','both'],{userHome:home})
  await cli.main(['install','--agent','both'],{userHome:home})
  await cli.main(['init',workspace,'--agent','both'],{userHome:home})
  fs.mkdirSync(source);fs.writeFileSync(path.join(source,'SKILL.md'),'---\nname: local-check\ndescription: Check one local task.\n---\n\nUse the local product context.\n')
  const skills=require('../bin/custom-skills');skills.add(workspace,source);skills.verify(workspace,'local-check','A local example was checked.')
  const before=fs.readFileSync(path.join(workspace,'.product-os/custom-skills.json'))
  assert.deepEqual(skills.offer(workspace,'local-check'),{name:'local-check',shouldAsk:false,verified:true,prompt:null})
  assert.deepEqual(fs.readFileSync(path.join(workspace,'.product-os/custom-skills.json')),before)
  assert.equal(calls,0);assert.equal(fs.existsSync(path.join(home,'.product-os/telemetry.json')),false)
  for(const {target,tools} of installationTargets(home,'both')) {
    for(const file of ['bin/telemetry.js','TELEMETRY.md','skills/TELEMETRY.md'])assert.equal(fs.existsSync(path.join(tools,file)),false,file)
    for(const name of require('../bin/install').install?JSON.parse(fs.readFileSync(path.join(tools,'INSTALLATION.json'))).skills:[]) {
      const text=fs.readFileSync(path.join(target,name,'SKILL.md'),'utf8');assert.doesNotMatch(text,/telemetry skill-used|product-os-public:usage/)
    }
  }
})
test('upgrading retires owned telemetry instructions and preserves edited documents and product content',t=>{
  const home=temp(t);install(undefined,{userHome:home,agent:'both'})
  const owned='Old Product OS telemetry instructions.\n',custom='Owner-edited instructions.\n'
  for(const {target,tools} of installationTargets(home,'both')) {
    fs.writeFileSync(path.join(tools,'TELEMETRY.md'),owned)
    fs.writeFileSync(path.join(tools,'skills/TELEMETRY.md'),owned)
    fs.writeFileSync(path.join(tools,'bin/telemetry.js'),'throw Error("Old sender must be removed")\n')
    fs.writeFileSync(path.join(target,'TELEMETRY.md'),target.includes('.claude')?owned:custom)
    fs.appendFileSync(path.join(target,'product-context/SKILL.md'),'\n<!-- product-os-public:usage:start -->\nSend a skill event.\n<!-- product-os-public:usage:end -->\n')
    const pkg=path.join(tools,'package.json'),info=JSON.parse(fs.readFileSync(pkg));info.version='0.2.4';fs.writeFileSync(pkg,JSON.stringify(info))
  }
  const workspace=path.join(home,'product');require('../bin/workspace').init(workspace)
  const material=Buffer.from('Original non-English material: Привет\n');fs.writeFileSync(path.join(workspace,'sources/original.txt'),material)
  fs.appendFileSync(path.join(workspace,'AGENTS.md'),'\nOwner instruction outside the managed block.\n')
  install(undefined,{userHome:home,agent:'both'});install(workspace,{agent:'both'})
  for(const {target,tools} of installationTargets(home,'both')) {
    assert.equal(fs.existsSync(path.join(tools,'bin/telemetry.js')),false)
    assert.equal(fs.existsSync(path.join(tools,'skills/TELEMETRY.md')),false)
    if(target.includes('.claude'))assert.equal(fs.existsSync(path.join(target,'TELEMETRY.md')),false)
    else assert.equal(fs.readFileSync(path.join(target,'TELEMETRY.md'),'utf8'),custom)
    assert.doesNotMatch(fs.readFileSync(path.join(target,'product-context/SKILL.md'),'utf8'),/product-os-public:usage/)
  }
  assert.deepEqual(fs.readFileSync(path.join(workspace,'sources/original.txt')),material)
  assert.match(fs.readFileSync(path.join(workspace,'AGENTS.md'),'utf8'),/Owner instruction outside/)
})
test('the release has English defaults and no telemetry modules or event endpoints',()=>{
  const receipt=JSON.parse(fs.readFileSync(path.join(root,'PUBLIC-RELEASE.json')))
  for(const file of receipt.files){
    assert.doesNotMatch(file.path,/^(?:bin\/telemetry\.js|(?:skills\/)?TELEMETRY\.md)$/)
    if(/\.(?:js|mjs|md|html)$/.test(file.path)&&!file.path.startsWith('test/'))assert.doesNotMatch(fs.readFileSync(path.join(root,file.path),'utf8'),/_cli_event|telemetry skill-used|product-os-public:usage/)
  }
  assert.match(fs.readFileSync(path.join(root,'bin/console/public/index.html'),'utf8'),/<html lang="en">/)
  assert.match(fs.readFileSync(path.join(root,'CONTRACT.md'),'utf8'),/Use English/)
})
test('English templates parse as unknowns and both English and existing Russian product sections are readable',t=>{
  const dir=temp(t),workspace=require('../bin/workspace');workspace.init(dir)
  const created=workspace.passportData(fs.readFileSync(path.join(dir,'PRODUCT.md'),'utf8'))
  assert.equal(created.description.what,null);assert.equal(created.businessGoal,null);assert.equal(created.constraints,null);assert.equal(created.stage,null)
  const english=workspace.passportData('# Example\n\n## Product\nA planning tool.\n\n## For whom\nSmall teams.\n\n## Goal\nTest repeat use.\n\n## Constraints\nOne week.\n')
  assert.equal(english.description.what,'A planning tool.');assert.equal(english.description.forWhom,'Small teams.');assert.equal(english.businessGoal,'Test repeat use.');assert.equal(english.constraints,'One week.')
  const original='# Пример\n\n## Продукт\nИнструмент команды.\n\n## Цель\nПроверить пользу.\n\n## Ограничения\nОдна неделя.\n'
  assert.equal(workspace.passportData(original).businessGoal,'Проверить пользу.')
  fs.writeFileSync(path.join(dir,'PRODUCT.md'),original);workspace.init(dir);assert.equal(fs.readFileSync(path.join(dir,'PRODUCT.md'),'utf8'),original)
})
test('English action sections enforce the current-work limit and retain completed/later horizons',t=>{
  const {upsertMove}=require('../bin/moves')
  const original='# Actions\n\n## Now\n\n- [ ] One\n- [ ] Two\n- [ ] Three\n\n## Later\n\n- [ ] Later action\n\n## Done\n\n- [ ] Recorded as done\n'
  const added=upsertMove(original,{id:'four',title:'Fourth action',horizon:'now'}).text
  assert.match(added,/## Next[\s\S]*Fourth action/)
  const dir=temp(t);require('../bin/workspace').init(dir);fs.writeFileSync(path.join(dir,'MOVES.md'),original)
  const {GraphTransaction}=require('../bin/graph/writer'),tx=new GraphTransaction(dir,{source:'MOVES.md'})
  try{tx.commit()}finally{tx.close()}
  const graph=JSON.parse(fs.readFileSync(path.join(dir,'research-graph.json'))),moves=graph.nodes.filter(node=>node.type==='move')
  assert.equal(moves.find(node=>node.label==='Later action')?.data.horizon,'later')
  assert.equal(moves.find(node=>node.label==='Recorded as done')?.data.completed,true)
})
test('compiled graph labels include English keyboard announcements without escaped Russian strings',()=>{
  const bundle=fs.readFileSync(path.join(root,'bin/console/public/assets/job-flow.js'),'utf8')
  assert.doesNotMatch(bundle,/[А-Яа-яЁё]|\\u04[0-9a-f]{2}/i)
  assert.match(bundle,/Graph moved:/)
})
