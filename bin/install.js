const fs = require('node:fs')
const path = require('node:path')
const { renderWorkspaceInstructions, mergeWorkspaceInstructions, writeWorkspaceInstructions } = require('./workspace-instructions')
const SKILLS = ['os-setup','product-context','product-status']
const SHARED = ['CONTRACT.md','GRAPH.md','GRAPH-WRITES.md','COMMUNICATIONS.md','DESIGN-SYSTEM.md']

function install(workspace, {agent='both'}={}) {
  if(!workspace || !['both','claude','codex'].includes(agent))throw new Error('install <workspace> --agent both|claude|codex')
  workspace=path.resolve(workspace)
  const root=path.resolve(__dirname,'..')
  if(workspace===root)throw new Error('Создайте отдельную папку продукта, вне репозитория инструментария')
  const targets=(agent==='both'?['claude','codex']:[agent]).map(name=>{
    const config=name==='codex'?'.agents':'.claude',target=path.join(workspace,config,'skills')
    const tools=path.join(name==='codex'?path.dirname(target):target,'product-os-tools')
    return {name,config,target,tools}
  })
  // Validate all destinations before changing either agent's installation.
  for(const {name,config,target,tools} of targets) {
    for(const dir of [workspace,path.join(workspace,config),target,tools,...SKILLS.map(skill=>path.join(target,skill))])if(fs.lstatSync(dir,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('Установка не записывает через символические ссылки: '+dir)
    if(fs.existsSync(tools)) {
      let existing;try{existing=JSON.parse(fs.readFileSync(path.join(tools,'package.json'),'utf8'))}catch{}
      if(existing?.name!=='product-os-public')throw new Error('В папке уже установлен другой Product OS. Выберите отдельный воркспейс для Public.')
      if(fs.readdirSync(path.join(tools,'skills'),{withFileTypes:true}).some(entry=>entry.isDirectory()&&!SKILLS.includes(entry.name)))throw new Error('В runtime есть дополнительные навыки; выберите чистый воркспейс для Public.')
    }
    const instructions=path.join(workspace,name==='codex'?'AGENTS.md':'CLAUDE.md')
    mergeWorkspaceInstructions(fs.existsSync(instructions)?fs.readFileSync(instructions,'utf8'):'',renderWorkspaceInstructions(name))
  }
  const results=[]
  for(const {name,config,target,tools} of targets) {
    const adapt=text=>text.replace(/\.claude\/skills\/product-os-tools|\.agents\/(?:skills\/)?product-os-tools/g,name==='codex'?'.agents/product-os-tools':'.claude/skills/product-os-tools')
    fs.mkdirSync(target,{recursive:true})
    if(fs.existsSync(tools))fs.rmSync(tools,{recursive:true})
    fs.mkdirSync(tools,{recursive:true})
    for(const directory of ['bin','skills'])fs.cpSync(path.join(root,directory),path.join(tools,directory),{recursive:true})
    for(const file of ['package.json','PUBLIC-RELEASE.json',...SHARED])fs.copyFileSync(path.join(root,file),path.join(tools,file))
    for(const skill of SKILLS) {
      fs.cpSync(path.join(root,'skills',skill),path.join(target,skill),{recursive:true})
      const file=path.join(target,skill,'SKILL.md');fs.writeFileSync(file,adapt(fs.readFileSync(file,'utf8')))
    }
    for(const file of SHARED)fs.writeFileSync(path.join(target,file),adapt(fs.readFileSync(path.join(root,file),'utf8')))
    const adaptTree=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())adaptTree(file);else if(entry.name.endsWith('.md'))fs.writeFileSync(file,adapt(fs.readFileSync(file,'utf8')))}}
    adaptTree(path.join(tools,'skills'))
    for(const script of ['pages','segments','graph-write','product-os'])fs.writeFileSync(path.join(tools,script+'.js'),`#!/usr/bin/env node\n${['graph-write','product-os'].includes(script)?`Promise.resolve().then(()=>require('./bin/${script}').main()).catch(error=>{console.error(error.message);process.exitCode=1})`:`require('./bin/${script}')`}\n`)
    results.push({agent:name,target,installed:SKILLS})
  }
  writeWorkspaceInstructions(workspace,agent)
  console.log('Product OS Public установлен в '+workspace+' для '+targets.map(t=>t.name).join(', '))
  return {installations:results}
}
if(require.main===module){try{const args=process.argv.slice(2),i=args.indexOf('--agent');install(args[0],{agent:i<0?'both':args[i+1]})}catch(error){console.error(error.message);process.exitCode=1}}
module.exports={install}
