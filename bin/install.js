const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { renderWorkspaceInstructions, mergeWorkspaceInstructions, writeWorkspaceInstructions } = require('./workspace-instructions')
const SKILLS = ['os-setup','product-context','product-status','product-research','product-segment-hypotheses','product-job-map','product-brand-identity','product-reference-library']
const SHARED = ['CONTRACT.md','GRAPH.md','GRAPH-WRITES.md','DESIGN-SYSTEM.md','CUSTOM-SKILLS.md','SHARING.md']

function parseInstallArgs(args) {
  let workspace,agent='both'
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--agent'&&args[i+1]&&!args[i+1].startsWith('-'))agent=args[++i]
    else if(!args[i].startsWith('-')&&workspace==null)workspace=args[i]
    else throw new Error('install|setup [workspace] --agent both|claude|codex')
  }
  if(!['both','claude','codex'].includes(agent))throw new Error('install|setup [workspace] --agent both|claude|codex')
  return {workspace,agent}
}
function installationTargets(base,agent) {
  return (agent==='both'?['claude','codex']:[agent]).map(name=>{
    const config=name==='codex'?'.agents':'.claude',target=path.join(base,config,'skills')
    return {name,config,target,tools:path.join(name==='codex'?path.dirname(target):target,'product-os-tools')}
  })
}
function assertNoLinks(file) {
  const stat=fs.lstatSync(file,{throwIfNoEntry:false})
  if(!stat)return
  if(stat.isSymbolicLink())throw new Error('Установка не записывает через символические ссылки: '+file)
  if(stat.isDirectory())for(const name of fs.readdirSync(file))assertNoLinks(path.join(file,name))
}
function installedGlobally(agent,{userHome=os.homedir()}={}) {
  return installationTargets(path.resolve(userHome),agent).every(({tools,target})=>{
    try{return JSON.parse(fs.readFileSync(path.join(tools,'package.json'),'utf8')).name==='product-os-public'
      && fs.existsSync(path.join(tools,'bin/product-os.js'))
      && SKILLS.every(skill=>fs.existsSync(path.join(target,skill,'SKILL.md')))}catch{return false}
  })
}
function install(workspace, {agent='both',userHome=os.homedir()}={}) {
  if(!['both','claude','codex'].includes(agent))throw new Error('install [workspace] --agent both|claude|codex')
  const global=workspace==null
  workspace=path.resolve(global?userHome:workspace)
  const root=path.resolve(__dirname,'..')
  const customRegistry=path.join(workspace,'.product-os','custom-skills.json')
  if(fs.existsSync(customRegistry)) {
    const custom=JSON.parse(fs.readFileSync(customRegistry,'utf8')).skills||{}
    if(SKILLS.some(name=>Object.hasOwn(custom,name)))throw new Error('Имя нового базового навыка занято пользовательским. Сначала переименуйте своё расширение.')
  }
  if(workspace===root)throw new Error('Создайте отдельную папку продукта, вне репозитория инструментария')
  if(!global)require('./workspace').assertWorkspace(workspace)
  const targets=installationTargets(workspace,agent)
  // Validate all destinations before changing either agent's installation.
  for(const {name,config,target,tools} of targets) {
    for(const dir of [workspace,path.join(workspace,config),target,tools,...SKILLS.map(skill=>path.join(target,skill)),...SHARED.map(file=>path.join(target,file))])if(fs.lstatSync(dir,{throwIfNoEntry:false})?.isSymbolicLink())throw new Error('Установка не записывает через символические ссылки: '+dir)
    for(const file of [tools,...SKILLS.map(skill=>path.join(target,skill))])assertNoLinks(file)
    if(fs.existsSync(tools)) {
      let existing;try{existing=JSON.parse(fs.readFileSync(path.join(tools,'package.json'),'utf8'))}catch{}
      if(existing?.name!=='product-os-public')throw new Error('В папке уже установлен другой Product OS. Выберите отдельный воркспейс для Product OS.')
      if(fs.readdirSync(path.join(tools,'skills'),{withFileTypes:true}).some(entry=>entry.isDirectory()&&!SKILLS.includes(entry.name)))throw new Error('В runtime есть дополнительные навыки; выберите чистый воркспейс для Product OS.')
      if(global) {
        let owned;try{owned=JSON.parse(fs.readFileSync(path.join(tools,'INSTALLATION.json'),'utf8'))}catch{}
        for(const skill of SKILLS)if(fs.existsSync(path.join(target,skill))&&!(owned?.schemaVersion===1&&Array.isArray(owned.skills)&&owned.skills.includes(skill)))throw new Error('Общий навык не принадлежит этой установке: '+skill)
      }
    } else if(global&&[...SKILLS.map(skill=>path.join(target,skill)),...SHARED.map(file=>path.join(target,file))].some(file=>fs.existsSync(file))) {
      throw new Error('В общих каталогах уже есть отдельные навыки или правила Product OS. Сохраните их перед установкой.')
    }
    if(!global) {
      const instructions=path.join(workspace,name==='codex'?'AGENTS.md':'CLAUDE.md')
      mergeWorkspaceInstructions(fs.existsSync(instructions)?fs.readFileSync(instructions,'utf8'):'',renderWorkspaceInstructions(name))
    }
  }
  const results=[]
  const samePhysical=(a,b)=>{try{return fs.realpathSync(a)===fs.realpathSync(b)}catch{return false}}
  for(const {name,config,target,tools} of targets) {
    const adapt=text=>text.replace(/\.claude\/skills\/product-os-tools|\.agents\/(?:skills\/)?product-os-tools/g,name==='codex'?'.agents/product-os-tools':'.claude/skills/product-os-tools')
    // Retire only a byte-identical document owned by the previous Public install.
    // User-authored changes in the discovery directory are never deleted.
    const retired=path.join(target,'COMMUNICATIONS.md'),old=path.join(tools,'COMMUNICATIONS.md')
    const oldEdition=(()=>{try{return JSON.parse(fs.readFileSync(path.join(tools,'package.json'),'utf8')).name}catch{return null}})()
    const removeRetired=oldEdition==='product-os-public'&&fs.lstatSync(retired,{throwIfNoEntry:false})?.isFile()&&fs.lstatSync(old,{throwIfNoEntry:false})?.isFile()&&fs.readFileSync(retired,'utf8')===adapt(fs.readFileSync(old,'utf8'))
    fs.mkdirSync(target,{recursive:true})
    // Installing from this very runtime (e.g. installed CLI repeating setup):
    // its own copy is already in place; replacing it deletes the running source.
    if(samePhysical(root,tools)) {
      for(const file of ['package.json','PUBLIC-RELEASE.json'])if(!fs.existsSync(path.join(tools,file)))throw new Error('Установленный runtime повреждён: повторите установку из checkout')
    } else {
      if(fs.existsSync(tools))fs.rmSync(tools,{recursive:true})
      fs.mkdirSync(tools,{recursive:true})
      for(const directory of ['bin','skills'])fs.cpSync(path.join(root,directory),path.join(tools,directory),{recursive:true})
      if(fs.existsSync(path.join(root,'community-skills')))fs.cpSync(path.join(root,'community-skills'),path.join(tools,'community-skills'),{recursive:true})
      for(const file of ['package.json','PUBLIC-RELEASE.json',...SHARED])fs.copyFileSync(path.join(root,file),path.join(tools,file))
    }
    for(const skill of SKILLS) {
      fs.cpSync(path.join(root,'skills',skill),path.join(target,skill),{recursive:true})
      const file=path.join(target,skill,'SKILL.md');fs.writeFileSync(file,adapt(fs.readFileSync(file,'utf8')))
    }
    for(const file of SHARED)fs.writeFileSync(path.join(target,file),adapt(fs.readFileSync(path.join(root,file),'utf8')))
    if(removeRetired)fs.unlinkSync(retired)
    const adaptTree=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())adaptTree(file);else if(entry.name.endsWith('.md'))fs.writeFileSync(file,adapt(fs.readFileSync(file,'utf8')))}}
    adaptTree(path.join(tools,'skills'))
    for(const script of ['pages','segments','graph-write','product-os'])fs.writeFileSync(path.join(tools,script+'.js'),`#!/usr/bin/env node\n${['graph-write','product-os'].includes(script)?`Promise.resolve().then(()=>require('./bin/${script}').main()).catch(error=>{console.error(error.message);process.exitCode=1})`:`require('./bin/${script}')`}\n`)
    if(global)fs.writeFileSync(path.join(tools,'INSTALLATION.json'),JSON.stringify({schemaVersion:1,skills:SKILLS},null,2)+'\n')
    results.push({agent:name,target,installed:SKILLS})
  }
  if(!global)writeWorkspaceInstructions(workspace,agent)
  console.log('Product OS установлен '+(global?'для пользователя '+workspace:'в '+workspace)+' для '+targets.map(t=>t.name).join(', '))
  if(global)console.log('Откройте папку своего продукта в агенте и попросите: «Настрой Product OS через os-setup и покажи консоль».')
  return {scope:global?'global':'project',installations:results}
}
if(require.main===module){try{const {workspace,agent}=parseInstallArgs(process.argv.slice(2));install(workspace,{agent})}catch(error){console.error(error.message);process.exitCode=1}}
module.exports={install,installedGlobally,installationTargets,parseInstallArgs}
