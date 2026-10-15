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
function usage() { return `Product OS Public

  product-os install <workspace> [--agent both|claude|codex]
  product-os init <workspace> [--agent both|claude|codex]
  product-os <workspace> [--no-open] [--port N]
  product-os import <workspace> <file>
  product-os sources <workspace>
  product-os graph-write <workspace> <operations.json> [--dry]
  product-os research read|source|summary|audit <workspace> [key=value]

Три навыка: os-setup, product-context и product-status.
Node.js 22+. AI работает в вашем установленном агенте; модель в подписку не входит.
` }
async function main(args = process.argv.slice(2)) {
  const [command, ...rest] = args
  if (['help', '--help', '-h'].includes(command)) { console.log(usage()); return }
  if (command === 'install') {
    if (!rest[0] || rest[0].startsWith('-')) throw new Error('Укажите отдельную папку продукта')
    return require('./install').install(rest[0], { agent: option(rest, '--agent', 'both') })
  }
  if (command === 'init') { const result = require('./workspace').init(rest[0] || '.', { agent: option(rest, '--agent', 'both') }); console.log(JSON.stringify(result, null, 2)); return result }
  if (command === 'import') { if (!rest[0] || !rest[1]) throw new Error('product-os import <workspace> <file>'); const result = require('./workspace').importSource(rest[0], rest[1]); console.log(JSON.stringify(result, null, 2)); return result }
  if (command === 'sources') { const result = require('./workspace').sources(rest[0] || '.'); console.log(JSON.stringify(result, null, 2)); return result }
  if (command === 'status-receipt') { if(!rest[0] || !rest[1])throw new Error('status-receipt <workspace> <receipt.json>');const result=require('./workspace').statusReceipt(path.resolve(rest[0]),JSON.parse(fs.readFileSync(rest[1],'utf8')));console.log(JSON.stringify(result,null,2));return result }
  if (command === 'graph-write') return require('./graph-write').main(rest)
  if (command === 'research') return require('./research/cli').main(rest)
  if (['article', 'eval', 'chrome', 'landings', 'research-brief', 'references', 'research-tools'].includes(command)) throw new Error('Эта команда не входит в Product OS Public')
  const workspace = path.resolve(command || '.')
  if (!fs.existsSync(path.join(workspace, 'research-graph.json'))) throw new Error('Воркспейс не найден. Сначала: product-os init <workspace>')
  const port = Number(option(rest, '--port', 0))
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Порт должен быть целым числом от 0 до 65535')
  const app = await createConsoleServer({ workspace, repoRoot: path.resolve(__dirname, '..'), chromeAgent: false, ...(process.env.PRODUCT_OS_NO_AGENTS === '1' ? { bbPath: false, claudePath: false, codexPath: false } : {}) })
  const address = await listen(app.server, port), url = `http://127.0.0.1:${address.port}`
  console.log(`Product OS Public · ${url}`)
  if (!args.includes('--no-open')) openBrowser(url)
  const close = () => app.server.close(() => process.exit(0))
  process.once('SIGINT', close); process.once('SIGTERM', close)
  return app
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { main, usage, openBrowser }
