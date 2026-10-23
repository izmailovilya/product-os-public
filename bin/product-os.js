#!/usr/bin/env node
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { createConsoleServer, listen } = require('./console/server')

function option(args, name, fallback) { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] }
function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(command, args, { detached: true, stdio: 'ignore' }); child.on('error', () => {}); child.unref()
}
function usage() { return `Product OS

  product-os setup [workspace] [--agent both|claude|codex]
  product-os install [workspace] [--agent both|claude|codex]
  product-os init <workspace> [--agent both|claude|codex]
  product-os <workspace> [--no-open] [--port N]
  product-os import <workspace> <file>
  product-os sources <workspace>
  product-os skills add|sync|list|verify|offer|decline|prepare <workspace> [skill] [options]
  product-os share prepare|review|password|preview|deploy <workspace-or-package> [options]
  product-os references read|types|graph <workspace> [productId=…] [track=…] [competitor=…] [type=…] [id=…]
  product-os graph-write <workspace> <operations.json> [--dry]
  product-os research read|source|summary|audit <workspace> [key=value]
  product-os telemetry status|on|off
  product-os telemetry skill-used <skill>

Восемь навыков: os-setup, product-context, product-status, product-research,
product-segment-hypotheses, product-job-map, product-brand-identity и
product-reference-library.
install без папки устанавливает навыки один раз для пользователя.
os-setup настраивает каждый продукт в его отдельной папке.
setup сохраняет совместимость с прежней установкой в проект.
Product OS бесплатен, без подписки.
Node.js 22+. AI работает в вашем установленном агенте.
` }
async function main(args = process.argv.slice(2),{userHome,telemetryOptions={}}={}) {
  const [command, ...rest] = args
  if (['help', '--help', '-h'].includes(command)) { console.log(usage()); return }
  if (command === 'telemetry') { const result=await require('./telemetry').main(rest,{...telemetryOptions,userHome});console.log(JSON.stringify(result,null,2));return result }
  if (command === 'skills') return require('./custom-skills').main(rest)
  if (command === 'share') return require('./share/cli').main(rest)
  if (command === 'setup') {
    const {install,installedGlobally,installationTargets,parseInstallArgs}=require('./install')
    const request=parseInstallArgs(rest),workspace=request.workspace||'.',agent=request.agent
    require('./workspace').assertWorkspace(workspace)
    const local=installationTargets(path.resolve(workspace),agent).some(({tools})=>fs.existsSync(tools))
    if(local||!installedGlobally(agent,{userHome})) { const installed=install(workspace,{agent,userHome});await require('./telemetry').recordInstallation(installed,{...telemetryOptions,userHome}) }
    const result = require('./workspace').init(workspace, { agent })
    console.log(`Рабочее место готово: ${result.workspace}`)
    console.log('Продолжите разговор с агентом в этой папке: «Настрой Product OS по контексту нашего разговора через os-setup и покажи консоль».')
    return result
  }
  if (command === 'install') {
    const {install,parseInstallArgs}=require('./install'),{workspace,agent}=parseInstallArgs(rest)
    const result=install(workspace, {agent,userHome})
    await require('./telemetry').recordInstallation(result,{...telemetryOptions,userHome})
    return result
  }
  if (command === 'init') { const result = require('./workspace').init(rest[0] || '.', { agent: option(rest, '--agent', 'both') }); console.log(JSON.stringify(result, null, 2)); return result }
  if (command === 'import') { if (!rest[0] || !rest[1]) throw new Error('product-os import <workspace> <file>'); const result = require('./workspace').importSource(rest[0], rest[1]); console.log(JSON.stringify(result, null, 2)); return result }
  if (command === 'sources') { const result = require('./workspace').sources(rest[0] || '.'); console.log(JSON.stringify(result, null, 2)); return result }
  if (command === 'status-receipt') { if(!rest[0] || !rest[1])throw new Error('status-receipt <workspace> <receipt.json>');const result=require('./workspace').statusReceipt(path.resolve(rest[0]),JSON.parse(fs.readFileSync(rest[1],'utf8')));console.log(JSON.stringify(result,null,2));return result }
  if (command === 'graph-write') return require('./graph-write').main(rest)
  if (command === 'research') return require('./research/cli').main(rest)
  if (command === 'references') return require('./reference-graph').main(rest)
  if (['article', 'eval', 'chrome', 'landings', 'research-brief', 'research-tools'].includes(command)) throw new Error('Эта команда не входит в Product OS')
  const workspace = path.resolve(command || '.')
  if (!fs.existsSync(path.join(workspace, 'research-graph.json'))) throw new Error('Воркспейс не найден. Сначала: product-os init <workspace>')
  const port = Number(option(rest, '--port', 0))
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Порт должен быть целым числом от 0 до 65535')
  const app = await createConsoleServer({ workspace, repoRoot: path.resolve(__dirname, '..'), chromeAgent: false, bbPath: false, claudePath: false, codexPath: false })
  const address = await listen(app.server, port), url = `http://127.0.0.1:${address.port}`
  console.log(`Product OS · ${url}`)
  if (!args.includes('--no-open')) openBrowser(url)
  const close = () => app.server.close(() => process.exit(0))
  process.once('SIGINT', close); process.once('SIGTERM', close)
  return app
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { main, usage, openBrowser }
