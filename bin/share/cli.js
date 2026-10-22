const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { pathToFileURL } = require('node:url')
const { randomBytes } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { parseEnv } = require('node:util')
const { prepare, regularTree, digest } = require('./prepare')

const WRANGLER = 'wrangler@4.151.3'
function review(directory) {
  directory = fs.realpathSync(path.resolve(directory))
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'REVIEW.json'), 'utf8'))
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'wrangler.json'), 'utf8'))
  if (manifest.version !== 1 || !['open', 'password'].includes(manifest.access) || config.assets?.run_worker_first !== true || config.assets.directory !== './assets') throw new Error('Некорректный пакет или отключена проверка доступа перед файлами.')
  const files = []
  regularTree(directory, (file, relative) => { if (!relative.startsWith('node_modules/')) files.push([relative, digest(fs.readFileSync(file))]) })
  return { directory, access: manifest.access, workerName: manifest.workerName, createdAt: manifest.createdAt, includesSources: manifest.includesSources, files: manifest.files, unavailable: manifest.unavailable, published: false, digest: digest(JSON.stringify(files)) }
}
async function password(directory, envFile) {
  if (review(directory).access !== 'password') throw new Error('Этот снимок подготовлен с открытым доступом. Сначала выберите режим password.')
  if (!envFile) throw new Error('Укажите --env-file: защищённый dotenv с PRODUCT_OS_SHARE_PASSWORD. Не передавайте пароль в аргументах или чате.')
  const input = parseEnv(fs.readFileSync(path.resolve(envFile), 'utf8'))
  const { passwordRecord } = await import(pathToFileURL(path.join(__dirname, 'auth.mjs')))
  const record = await passwordRecord(input.PRODUCT_OS_SHARE_PASSWORD)
  const destination = path.join(directory, '.dev.vars')
  if (fs.lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Файл настроек пароля не может быть символической ссылкой.')
  fs.writeFileSync(destination, `SHARE_PASSWORD_HASH="${record}"\nSHARE_SESSION_SECRET="${randomBytes(32).toString('base64url')}"\n`, { mode: 0o600 })
  fs.chmodSync(destination, 0o600)
  return { directory: path.resolve(directory), credentialsConfigured: true, plaintextCopied: false }
}
function rateLimiter() {
  const attempts = new Map()
  return { async limit({ key }) {
    const now = Date.now(), old = attempts.get(key), entry = old && old.until > now ? old : { count: 0, until: now + 60000 }
    if (attempts.size > 1000) for (const [id, value] of attempts) if (value.until < now) attempts.delete(id)
    attempts.set(key, entry); return { success: ++entry.count <= 20 }
  } }
}
async function preview(directory, { port = 0, origin } = {}) {
  const result = review(directory)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port: целое число от 0 до 65535.')
  if (origin) {
    const url = new URL(origin)
    if (url.origin !== origin || url.username || url.password || !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('--origin: точный HTTPS origin доверенного reverse proxy, без пути.')
  }
  const secrets = fs.existsSync(path.join(directory, '.dev.vars')) ? parseEnv(fs.readFileSync(path.join(directory, '.dev.vars'), 'utf8')) : {}
  const worker = (await import(pathToFileURL(path.join(result.directory, 'index.mjs')) + '?preview=' + Date.now())).default
  const assets = path.join(result.directory, 'assets'), limiter = rateLimiter()
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const requestOrigin = origin || `http://${incoming.headers.host}`
      const chunks = []; let size = 0
      for await (const chunk of incoming) { size += chunk.length; if (size > 4096) { outgoing.writeHead(413); outgoing.end(); return } chunks.push(chunk) }
      const request = new Request(new URL(incoming.url, requestOrigin), { method: incoming.method, headers: incoming.headers, ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Buffer.concat(chunks) } : {}) })
      const response = await worker.fetch(request, { ...secrets, LOGIN_LIMITER: limiter, ASSETS: { async fetch(request) {
        const name = new URL(request.url).pathname
        if (!/^\/_snapshot\/[a-f0-9]{64}$/.test(name)) return new Response(null, { status: 404 })
        const file = path.join(assets, name)
        return fs.existsSync(file) ? new Response(fs.readFileSync(file)) : new Response(null, { status: 404 })
      } } })
      outgoing.writeHead(response.status, Object.fromEntries(response.headers))
      outgoing.end(Buffer.from(await response.arrayBuffer()))
    } catch { outgoing.writeHead(500, { 'cache-control': 'no-store' }); outgoing.end('Не удалось открыть предварительный просмотр.') }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  return { server, url: `http://127.0.0.1:${server.address().port}`, access: result.access }
}
function deploy(directory, approvedDigest) {
  const result = review(directory)
  if (!approvedDigest || result.digest !== approvedDigest) throw new Error('Сначала покажите владельцу share review и preview. После разрешения на публикацию укажите текущий --approved-digest. Изменённый пакет требует нового просмотра.')
  if (result.access === 'password' && !fs.existsSync(path.join(directory, '.dev.vars'))) throw new Error('Сначала настройте пароль через share password.')
  const args = ['exec', '--yes', '--package=' + WRANGLER, '--', 'wrangler', 'deploy', '--config', 'wrangler.json']
  if (result.access === 'password') args.push('--secrets-file', '.dev.vars')
  // Credentials are read by Wrangler directly, never interpolated into shell commands.
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: result.directory, stdio: 'inherit' })
  return { directory: result.directory, workerName: result.workerName, published: true, access: result.access }
}
async function main(args) {
  const [action, target, ...rest] = args
  if (!target) throw new Error('share prepare|review|password|preview|deploy <workspace-or-package> [options]')
  const flags = {}
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i]
    if (['--include-sources', '--exclude-sources', '--change-access'].includes(key)) { flags[key.slice(2)] = true; continue }
    if (!['--access', '--name', '--port', '--origin', '--env-file', '--approved-digest'].includes(key) || !rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error('Неизвестный или незаполненный параметр: ' + key)
    flags[key.slice(2)] = rest[++i]
  }
  let result
  if (flags['include-sources'] && flags['exclude-sources']) throw new Error('Выберите либо --include-sources, либо --exclude-sources.')
  if (action === 'prepare') result = await prepare(target, { access: flags.access, name: flags.name, includeSources: flags['exclude-sources'] ? false : flags['include-sources'], changeAccess: flags['change-access'] })
  else if (action === 'review') result = review(target)
  else if (action === 'password') result = await password(path.resolve(target), flags['env-file'])
  else if (action === 'preview') {
    result = await preview(path.resolve(target), { port: Number(flags.port || 0), origin: flags.origin })
    console.log(`Снимок Product OS · ${result.access} · ${result.url}`)
    const stop = () => result.server.close(() => process.exit(0))
    process.once('SIGINT', stop); process.once('SIGTERM', stop)
    return result
  } else if (action === 'deploy') result = deploy(path.resolve(target), flags['approved-digest'])
  else throw new Error('Неизвестная команда share: ' + action)
  console.log(JSON.stringify(result, null, 2)); return result
}
module.exports = { main, review, password, preview, deploy }
