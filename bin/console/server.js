const fs = require('fs')
const { performance } = require('node:perf_hooks')
const { gzip } = require('node:zlib')
const { randomUUID, randomBytes } = require('crypto')
const { GraphTransaction, migrateGraph } = require('../graph/writer')
const { validateGraph } = require('../graph/schema')
const { workspaceLock, recoverPending } = require('../graph/storage')
const { ensureMoveIds } = require('../moves')
const http = require('http')
const path = require('path')
const { execFile, spawn } = require('child_process')
const { URL } = require('url')
const { StateStore } = require('./state')
const { attachFallback, buildSnapshot, hash, loadArena, moveFor, shellQuote, SKILL_META } = require('./model')
const { displayLabel } = require('./galaxy-model')

const { MIME: ASSET_MIME, safeAssetPath, localReportLink } = require('./report-assets')

const MAX_BODY = 1024 * 1024

function findExecutable(name, envPath = process.env.PATH || '') {
  const suffixes = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : ['']
  for (const directory of envPath.split(path.delimiter).filter(Boolean)) {
    for (const suffix of suffixes) {
      const candidate = path.join(directory, `${name}${suffix}`)
      try { fs.accessSync(candidate, fs.constants.X_OK); return candidate } catch {}
    }
  }
  return null
}

// bb reads BB_THREAD_ID & co. to decide "which thread am I inside"; the console is not
// inside any thread, so strip thread-scoped context before every bb call (keep BB_CLI/URL)
const THREAD_SCOPED = ['BB_THREAD_ID', 'BB_THREAD_STORAGE', 'BB_ENVIRONMENT_ID', 'BB_PROJECT_ID']
function consoleEnv() {
  const env = { ...process.env }
  for (const key of THREAD_SCOPED) delete env[key]
  return env
}

function runFile(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, {
      cwd: options.cwd,
      env: options.env || consoleEnv(),
      timeout: options.timeout || 10000,
      maxBuffer: options.maxBuffer || 4 * 1024 * 1024,
      encoding: 'utf8',
    }, (error, stdout, stderr) => {
      if (error) {
        const message = String(stderr || stdout || error.message).trim().slice(0, 1200)
        const wrapped = new Error(message || 'Команда завершилась с ошибкой.')
        wrapped.code = error.killed ? 'TIMEOUT' : (error.code || 'COMMAND_FAILED')
        reject(wrapped)
      } else resolve({ stdout, stderr })
    })
    child.on('error', reject)
  })
}

function parseJsonOutput(text) {
  const value = String(text || '').trim()
  if (!value) return null
  try { return JSON.parse(value) } catch {}
  const start = Math.min(...['{', '['].map(token => value.indexOf(token)).filter(index => index >= 0))
  if (Number.isFinite(start)) {
    try { return JSON.parse(value.slice(start)) } catch {}
  }
  return null
}

class BbClient {
  constructor(workspace, options = {}) {
    this.workspace = workspace
    this.path = options.bbPath === false ? null : (options.bbPath || findExecutable('bb', options.envPath))
    this.projectId = options.projectId || null
    this.cache = { at: 0, rows: [] }
  }

  get available() { return Boolean(this.path) }

  async resolveProjectId() {
    if (this.projectId) return this.projectId
    if (!this.path) return null
    try {
      const result = await runFile(this.path, ['project', 'list', '--include-personal', '--json'], { cwd: this.workspace, timeout: 5000 })
      const parsed = parseJsonOutput(result.stdout)
      const projects = Array.isArray(parsed) ? parsed : (parsed?.projects || [])
      const workspace = path.resolve(this.workspace)
      const exact = projects.find(project => (project.sources || []).some(source => source.path && path.resolve(source.path) === workspace))
      const containing = projects.find(project => (project.sources || []).some(source => {
        if (!source.path) return false
        const root = path.resolve(source.path)
        return workspace.startsWith(`${root}${path.sep}`)
      }))
      this.projectId = exact?.id || containing?.id || process.env.BB_PROJECT_ID || null
    } catch {
      this.projectId = process.env.BB_PROJECT_ID || null
    }
    if (!this.projectId) {
      const error = new Error(`Воркспейс ${this.workspace} не привязан к проекту bb. Добавь его в bb и повтори запуск.`)
      error.code = 'BB_PROJECT_NOT_FOUND'
      throw error
    }
    return this.projectId
  }

  async list() {
    if (!this.path) return []
    if (Date.now() - this.cache.at < 4000) return this.cache.rows
    try {
      const projectId = await this.resolveProjectId()
      const result = await runFile(this.path, ['thread', 'list', '--project', projectId, '--json'], { cwd: this.workspace, timeout: 5000 })
      const parsed = parseJsonOutput(result.stdout)
      this.cache = { at: Date.now(), rows: Array.isArray(parsed) ? parsed : (parsed?.threads || []) }
      return this.cache.rows
    } catch {
      return []
    }
  }

  async launch(move) {
    if (!this.path) {
      const error = new Error('bb не найден на этом компьютере.')
      error.code = 'BB_NOT_FOUND'
      throw error
    }
    const projectId = await this.resolveProjectId()
    const result = await runFile(this.path, [
      'thread', 'spawn', '--project', projectId, '--environment', this.workspace, '--title', move.title,
      '--prompt', move.prompt, '--service-tier', 'default', '--json',
      ...(move.executor ? ['--provider', move.executor.provider, '--model', move.executor.model, '--reasoning-level', move.executor.reasoningLevel] : []),
    ], { cwd: this.workspace, timeout: 10000 })
    const parsed = parseJsonOutput(result.stdout)
    const threadId = parsed?.id || parsed?.threadId || parsed?.thread?.id || parsed?.data?.id
    if (!threadId) {
      const error = new Error('Агент создан, но команда не вернула его идентификатор.')
      error.code = 'INVALID_BB_RESPONSE'
      throw error
    }
    this.cache.at = 0
    let openWarning = null
    try { await runFile(this.path, ['thread', 'open', threadId], { cwd: this.workspace, timeout: 5000 }) }
    catch (error) { openWarning = error.message }
    return { threadId, openWarning }
  }

  async open(threadId) {
    if (!this.path) throw new Error('bb не найден на этом компьютере.')
    await runFile(this.path, ['thread', 'open', threadId], { cwd: this.workspace, timeout: 5000 })
  }

  async stop(threadId) {
    if (!this.path) throw new Error('bb не найден на этом компьютере.')
    await runFile(this.path, ['thread', 'stop', threadId, '--json'], { cwd: this.workspace, timeout: 10000 })
    this.cache.at = 0
  }
}

class ClaudeClient {
  constructor(workspace, options = {}) {
    this.workspace = workspace
    this.path = options.claudePath === false ? null : (options.claudePath || findExecutable('claude', options.envPath))
  }

  get available() { return Boolean(this.path) }

  async launch(move) {
    if (!this.path) throw new Error('Claude Code не найден. Скопируй готовую команду и запусти её в терминале.')
    const result = await runFile(this.path, ['--bg', '--name', move.title, move.prompt], { cwd: this.workspace, timeout: 10000 })
    const externalId = String(result.stdout || '').trim().split(/\s+/).pop() || `claude-${Date.now()}`
    return { externalId }
  }
}

function jsonLineAndColumn(source, error) {
  const match = String(error.message).match(/position\s+(\d+)/i)
  if (!match) return null
  const position = Number(match[1])
  const before = source.slice(0, position)
  const lines = before.split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

class GraphStore {
  constructor(workspace) {
    this.file = path.join(workspace, 'research-graph.json')
    this.lastGood = { version: 2, nodes: [], edges: [] }
    this.lastGoodMtime = 0
  }

  read() {
    const release = workspaceLock(path.dirname(this.file))
    try { recoverPending(path.dirname(this.file)); return this.readUnlocked() } finally { release() }
  }

  readUnlocked() {
    let stat
    try { stat = fs.statSync(this.file) } catch {
      return { graph: this.lastGood, status: { state: 'error', mtime: 0, message: 'Файл карты исследования (research-graph.json) не найден', recovery: 'Запустите os setup — он создаст карту продукта.' } }
    }
    const source = fs.readFileSync(this.file, 'utf8')
    try {
      const graph = JSON.parse(source)
      const problem = validateGraph(migrateGraph(graph).graph)
      if (problem) throw new Error(problem)
      this.lastGood = graph
      this.lastGoodMtime = stat.mtimeMs
      const researchData = require('../research/store').load(path.dirname(this.file))
      return { graph, researchData, research: require('../research/store').projection(researchData), status: { state: 'saved', mtime: stat.mtimeMs, time: new Date(stat.mtimeMs).toISOString() } }
    } catch (error) {
      const freshWrite = Date.now() - stat.mtimeMs < 2000
      const position = jsonLineAndColumn(source, error)
      return {
        graph: this.lastGood,
        status: freshWrite
          ? { state: 'saving', mtime: stat.mtimeMs, message: 'Агент обновляет карту — обычно это занимает несколько секунд.' }
          : {
            state: 'error', mtime: stat.mtimeMs,
            message: `Карта исследования не читается${position ? `: строка ${position.line}, столбец ${position.column}` : `: ${error.message}`}.`,
            recovery: 'Откройте research-graph.json, исправьте ошибку формата JSON и обновите страницу. До этого показана последняя читаемая версия.',
          },
      }
    }
  }
}

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function inlineMarkdown(value, documentPath) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(!?)\[([^\]]+)\]\(([^)]+)\)/g, (_, image, label, target) => {
      const href = localReportLink(documentPath, target, Boolean(image))
      if (!href) return label
      return image ? `<img src="${href}" alt="${label}" loading="lazy">` : `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
    })
}

function markdownBody(markdown, documentPath) {
  const out = []
  let list = false
  let table = false
  let paragraph = []
  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${inlineMarkdown(paragraph.join(' '), documentPath)}</p>`); paragraph = [] } }
  const closeBlocks = () => {
    if (list) { out.push('</ul>'); list = false }
    if (table) { out.push('</table>'); table = false }
  }
  for (const raw of markdown.replace(/^---[\s\S]*?\n---\s*/, '').split('\n')) {
    const line = raw.trimEnd()
    const heading = line.match(/^(#{1,4})\s+(.+)/)
    if (heading) { flushParagraph(); closeBlocks(); const level = Math.min(4, heading[1].length + 1); out.push(`<h${level}>${inlineMarkdown(heading[2], documentPath)}</h${level}>`); continue }
    if (/^\|/.test(line)) {
      if (/^[|\s:-]+$/.test(line)) continue
      flushParagraph()
      if (list) { out.push('</ul>'); list = false }
      if (!table) { out.push('<table>'); table = true }
      const cells = line.split('|').slice(1, -1)
      out.push(`<tr>${cells.map(cell => `<td>${inlineMarkdown(cell.trim(), documentPath)}</td>`).join('')}</tr>`)
      continue
    } else if (table) { out.push('</table>'); table = false }
    const item = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)/)
    if (item) { flushParagraph(); if (!list) { out.push('<ul>'); list = true } out.push(`<li>${inlineMarkdown(item[1], documentPath)}</li>`); continue }
    if (!line.trim()) { flushParagraph(); closeBlocks(); continue }
    if (line.startsWith('>')) { flushParagraph(); closeBlocks(); out.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''), documentPath)}</blockquote>`); continue }
    paragraph.push(line.trim())
  }
  flushParagraph(); closeBlocks()
  return out.join('\n')
}

function reportPage(markdown, title, documentPath, missing=false) {
  const isReport=documentPath?.startsWith('reports/')
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="icon" href="data:"><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/ui-tokens.css"><link rel="stylesheet" href="/design-system.css"><link rel="stylesheet" href="/ui-components.css"><link rel="stylesheet" href="/report-reading.css"></head><body class="atlas-document"><main class="wrap"><nav aria-label="Возврат"><a class="back" href="/${isReport?'#reports':'#product'}" data-reader-back>← ${missing?'Вернуться в консоль':isReport?'Отчёты':'Продукт'}</a></nav>${markdownBody(markdown, documentPath).replace(/<h2>([\s\S]*?)<\/h2>/,'<h1>$1</h1>')}${isReport?`<p><a class="os-text-link" href="/#next?work-report=${encodeURIComponent(documentPath)}">Взять следующий шаг в работу →</a></p>`:''}</main><script type="module" src="/report-reading.js"></script></body></html>`
}
function missingDocumentPage(kind){return reportPage(`# ${kind} не найден\n\nВозможно, ссылка устарела или файл перенесён.`,kind+' не найден',null,true)}

function sendJson(response, status, payload, request) {
  const body = `${JSON.stringify(payload)}\n`
  // Large graph projections repeat source-backed structures. Compress transport only;
  // clients still receive the complete unchanged JSON model.
  if (request && body.length > 32768 && (request.headers['accept-encoding'] || '').split(',').some(value => { const [encoding, ...parameters] = value.trim().toLowerCase().split(';'); const quality = parameters.map(p => p.trim()).find(p => p.startsWith('q=')); return encoding === 'gzip' && (!quality || Number(quality.slice(2)) > 0) })) {
    gzip(body, {level:1}, (error, compressed) => {
      if(response.destroyed)return
      if(error){response.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(body);return}
      response.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':compressed.length,'cache-control':'no-store','content-encoding':'gzip','vary':'Accept-Encoding'});response.end(compressed)
    })
    return
  }
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' })
  response.end(body)
}

function sendText(response, status, body, contentType) {
  response.writeHead(status, { 'content-type': contentType, 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' })
  response.end(body)
}

function sendBuffer(response, status, body, contentType) {
  response.writeHead(status, { 'content-type': contentType, 'content-length': body.length, 'cache-control': 'public, max-age=3600' })
  response.end(body)
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    request.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY) { reject(new Error('Слишком большой запрос.')); request.destroy(); return }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) }
      catch { reject(new Error('Запрос содержит неверный JSON.')) }
    })
    request.on('error', reject)
  })
}

function safeReportPath(workspace, relative) {
  if (!relative || !relative.endsWith('.md')) return null
  const root = path.resolve(workspace, 'reports')
  const absolute = path.resolve(workspace, relative)
  return absolute.startsWith(`${root}${path.sep}`) && fs.existsSync(absolute) && fs.statSync(absolute).isFile() && fs.realpathSync(absolute).startsWith(`${fs.realpathSync(root)}${path.sep}`) ? absolute : null
}

function safeSourcePath(workspace, relative) {
  if (typeof relative !== 'string' || relative.includes('..') || relative.includes('\\')) return null
  if (!/^(?:sources\/[^\\]+\.(?:md|txt|json|html|csv)|reports\/[^\\]+\.md|PRODUCT\.md|MOVES\.md)$/.test(relative)) return null
  const root = fs.realpathSync(workspace)
  const absolute = path.resolve(workspace, relative)
  try {
    const real = fs.realpathSync(absolute)
    const canonical = path.relative(root, real).split(path.sep).join('/')
    const allowed = /^(?:sources\/[^\\]+\.(?:md|txt|json|html|csv)|reports\/[^\\]+\.md|PRODUCT\.md|MOVES\.md)$/.test(canonical)
    return real.startsWith(`${root}${path.sep}`) && allowed && fs.statSync(real).isFile() ? real : null
  } catch { return null }
}

function findMove(snapshot, moveId) {
  for (const list of Object.values(snapshot.moves)) {
    const found = list.find(move => move.id === moveId)
    if (found) return found
  }
  for (const item of snapshot.todo) {
    if (item.move?.id === moveId) return item.move
    if (item.clarifyMove?.id === moveId) return item.clarifyMove
  }
  for (const suggestion of snapshot.suggestions) if (suggestion.move?.id === moveId) return suggestion.move
  return null
}

function normalizeMove(body, snapshot, workspace, issued) {
  const id = body.moveId || body.move?.id
  const custom = issued.get(id)
  const source = findMove(snapshot, id) || (custom?.signature === snapshot.graphSignature ? custom.move : null)
  if (!source?.prompt?.trim()) throw Object.assign(new Error('Задача не найдена или устарела. Обновите страницу и выберите её снова.'), { status: 409 })
  if (snapshot.todo.some(item => item.id === id && item.status === 'blocked')) throw Object.assign(new Error('Уточните план задачи перед запуском.'), { status: 409 })
  if (source.action === 'open') throw Object.assign(new Error('Этот ход требует ответа в существующей работе агента.'), { status: 409 })
  if (snapshot.graphStatus.state !== 'saved') throw Object.assign(new Error(snapshot.graphStatus.state === 'saving'
    ? 'Карта исследования обновляется. Подождите несколько секунд и повторите действие.'
    : [snapshot.graphStatus.message || 'Карта исследования не читается.', snapshot.graphStatus.recovery].filter(Boolean).map(text => /[.!?]$/.test(text) ? text : text + '.').join(' ')), { status: 409 })
  const node = snapshot.graph.nodes.find(item => item.id === source.node?.id)
  if (!node || node.status === 'dropped' || node.data?.retired) throw Object.assign(new Error('Целевой узел больше не активен.'), { status: 409 })
  if (source.skill === 'nmt-analyze-interviews') { source.skill = 'product-interviews'; source.prompt = 'Product OS: используем product-interviews вместо прежнего обработчика.\n' + source.prompt.replaceAll('nmt-analyze-interviews', 'product-interviews') }
  if(body.context!==undefined && (typeof body.context!=='string'||body.context.length>10000))throw Object.assign(new Error('Уточнение должно быть текстом до 10 000 символов.'),{status:400})
  const prompt=source.prompt+(body.context?.trim()?'\n\nУточнение пользователя:\n'+body.context.trim():'')
  return attachFallback({ ...source, prompt, node: { id: node.id, label: node.label, type: node.type } }, workspace)
}

// Extra origins for a console published through a trusted authenticated proxy (e.g. BB Connect).
function envAllowedOrigins() {
  return (process.env.PRODUCT_OS_ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(item => /^https?:\/\/[^/]+$/.test(item))
}

function authorizeRequest(request, token, allowedOrigins = []) {
  const host = request.headers.host || ''
  const port = request.socket.localPort
  const local = [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]
  const allowed = new Set([...local.map(h => `http://${h}`), ...allowedOrigins])
  if (!local.includes(host) && !allowedOrigins.some(origin => new URL(origin).host === host)) return 'Неподдерживаемый Host.'
  const origin = request.headers.origin
  if ((origin && !allowed.has(origin)) || request.headers['sec-fetch-site'] === 'cross-site') return 'Запрос с другого сайта отклонён.'
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (request.headers['x-product-os-token'] !== token) return 'Нужен токен текущей консоли.'
    if (request.method !== 'DELETE' && !/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) return 'Нужен application/json.'
  }
  return null
}

async function createConsoleServer(options) {
  const workspace = path.resolve(options.workspace)
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..', '..'))
  const staticRoot = path.join(__dirname, 'public')
  const store = new StateStore(workspace)
  const graphStore = new GraphStore(workspace)
  const bb = new BbClient(workspace, options)
  const claude = new ClaudeClient(workspace, options)
  const token = randomBytes(32).toString('hex')
  const issued = new Map()
  const issue = (move, snap) => {
    if (!["os-setup","product-context","product-status"].includes(move.skill)) throw new Error('Этот навык не входит в Product OS Public.')
    if (issued.size > 500) issued.delete(issued.keys().next().value)
    issued.set(move.id, { move, signature: snap.graphSignature }); return move
  }
  // Legacy accepted cards are copied once into the canonical move list.
  const accepted = store.get().deck.accepted
  if (accepted.length) {
    const tx = new GraphTransaction(workspace, { source: 'MOVES.md' })
    try {
      for (const row of accepted) tx.move({ ...row, title: row.title, acceptOnly: true })
      tx.commit()
      store.update(state => { state.deck.accepted = [] })
    } finally { tx.close() }
  }

  const snapshot = async (scope = '', timings = {}) => {
    let phase = performance.now()
    const release = workspaceLock(workspace)
    try { recoverPending(workspace) } finally { release() }
    ensureMoveIds(workspace)
    const { graph, status, research, researchData } = graphStore.read()
    timings.read = performance.now() - phase; phase = performance.now()
    const threads = await bb.list()
    timings.agents = performance.now() - phase; phase = performance.now()
    const snap = buildSnapshot({
      workspace, repoRoot, graph, graphStatus: status, state: store.get(), threads,
      capabilities: { bb: bb.available, claude: claude.available }, scope, researchRecords: researchData?.records,
    })
    timings.projection = performance.now() - phase
    require('./segment-research').attachSegmentResearch(snap.galaxy,researchData||{records:[],factRevision:0},graph)
    return { ...snap, researchRevision: research?.revision ?? 0, csrfToken: token }
  }

  const chromeBridge = require('./chrome').createChromeBridge({ workspace, graphStore,
    codexPath: options.codexPath === false ? null : options.codexPath || findExecutable('codex'),
    agent: options.chromeAgent === undefined && options.bbPath === false && options.claudePath === false ? false : options.chromeAgent,
    authorize: request => authorizeRequest(request, token, options.allowedOrigins || envAllowedOrigins()), readBody, sendJson, adminToken: token })
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    try {
      if (await chromeBridge.handle(request, response, url)) return
      const forbidden = authorizeRequest(request, token, options.allowedOrigins || envAllowedOrigins())
      if (forbidden) return sendJson(response, 403, { error: forbidden })
      if (url.pathname === '/api/research-briefs') {
        if(request.method === 'GET') return sendJson(response,200,{briefs:[],modules:[],capabilities:{bb:false,claude:false}})
        return sendJson(response,404,{error:'Запуск исследований не входит в Product OS Public.'})
      }
      if (url.pathname.startsWith('/api/chrome/') || url.pathname === '/chrome-extension.zip') return sendJson(response,404,{error:'Инструмент не входит в Product OS Public.'})

      if(request.method==='GET'&&url.pathname==='/api/segment-model')return sendJson(response,200,require('../research/store').snapshot(workspace,Object.fromEntries(url.searchParams),(_data,graph)=>require('../segment-model').segmentModelView(graph,Object.fromEntries(url.searchParams))))
      if(request.method==='POST'&&url.pathname==='/api/parameter-views')return sendJson(response,200,require('./parameter-views').save(workspace,await readBody(request)))
      if (request.method === 'GET' && url.pathname === '/api/segment-analysis') return sendJson(response,200,require('../research/store').snapshot(workspace,Object.fromEntries(url.searchParams),(data,graph)=>require('../research/segment-analysis').summarize(data,graph,Object.fromEntries(url.searchParams))))
      if (request.method === 'GET' && url.pathname === '/api/segment-jobs') return sendJson(response,200,require('../research/store').snapshot(workspace,Object.fromEntries(url.searchParams),(data,graph)=>require('./segment-job-graph').segmentJobGraph(data,graph,url.searchParams.get('segmentId'))))
      if (request.method === 'POST' && url.pathname === '/api/segment-views') return sendJson(response,200,require('./segment-views').save(workspace,await readBody(request)))
      if (request.method === 'GET' && url.pathname === '/api/research/reading-preview') return sendJson(response, 200, require('../research/reading-preview').read(workspace, url.searchParams.get('personId')))
      if (request.method === 'GET' && url.pathname === '/api/research/version') {const release=workspaceLock(workspace);try{recoverPending(workspace);return sendJson(response,200,{workspace,revision:require('../research/store').load(workspace).revision})}finally{release()}}
      if (request.method === 'GET' && url.pathname === '/api/research') return sendJson(response, 200, require('../research/store').read(workspace, Object.fromEntries(url.searchParams)))
      if (request.method === 'GET' && url.pathname === '/api/research/source') return sendJson(response, 200, require('../research/store').source(workspace, url.searchParams.get('id')))
      if (request.method === 'POST' && url.pathname === '/api/research') {
        const body = await readBody(request)
        if (!Number.isInteger(body.expectedRevision) || !Number.isInteger(body.expectedResearchRevision) || !body.operations?.every(o => ['research-put', 'research-update', 'research-coverage', 'research-checkpoint'].includes(o.op))) return sendJson(response, 400, { error: 'Research operations and both expected revisions required' })
        return sendJson(response, 200, require('../graph/writer').applyOperations(workspace, body))
      }
      if (request.method === 'GET' && ['/api/product-elements','/api/product-elements/image'].includes(url.pathname)) {
        const graph=graphStore.read().graph, elements=require('./product-elements'),params=Object.fromEntries(url.searchParams)
        if (url.pathname.endsWith('/image')) {
          const image=elements.elementImage(workspace,graph,params)
          if (!image) return sendText(response,404,'Изображение недоступно.','text/plain; charset=utf-8')
          response.setHeader('X-Content-Type-Options','nosniff')
          response.setHeader('Content-Security-Policy',"default-src 'none'; sandbox")
          return sendBuffer(response,200,image.buffer,image.mime)
        }
        return sendJson(response,200,elements.loadElements(workspace,graph,params.productId))
      }
      if (request.method === 'GET' && ['/api/product-references','/api/product-references/image'].includes(url.pathname)) {
        const graph = graphStore.read().graph, references = require('./product-references')
        const params = Object.fromEntries(url.searchParams)
        if (url.pathname.endsWith('/image')) {
          const image = references.libraryImage(workspace,graph,params)
          if (!image) return sendText(response,404,'Изображение недоступно.','text/plain; charset=utf-8')
          response.setHeader('X-Content-Type-Options','nosniff')
          response.setHeader('Content-Security-Policy',"default-src 'none'; sandbox")
          return sendBuffer(response,200,image.buffer,image.mime)
        }
        return sendJson(response,200,references.loadLibrary(workspace,graph,params.productId,params.library))
      }
      if (request.method === 'GET' && url.pathname === '/api/snapshot') {const timings={};const snap=await snapshot(url.searchParams.get('scope') || '',timings);response.setHeader('Server-Timing',Object.entries(timings).map(([name,ms])=>`${name};dur=${ms.toFixed(1)}`).join(', '));return sendJson(response,200,snap,request)}

      if (request.method === 'POST' && url.pathname === '/api/communications') {
        const body = await readBody(request)
        if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) return sendJson(response, 400, { error: 'Нужна текущая revision графа.' })
        const tx = new GraphTransaction(workspace, { expectedRevision: body.expectedRevision, source: 'communications:manual', strict: true })
        try {
          const node = require('../graph/communications').communication(tx, body)
          const result = tx.commit()
          return sendJson(response, 200, { ok: true, id: node.id, revision: result.graph.revision })
        } catch (error) { error.status ||= error.code === 'REVISION_CONFLICT' ? 409 : 400; throw error }
        finally { tx.close() }
      }

      if (request.method === 'POST' && url.pathname === '/api/move') {
        const body = await readBody(request)
        const snap = await snapshot()
        const node = snap.graph.nodes.find(item => item.id === body.nodeId)
        const redirected = body.skill === 'nmt-analyze-interviews'
        if (redirected) body.skill = 'product-interviews'
        const skill = snap.skills.find(item => item.slug === body.skill)
        if (!node || !skill) return sendJson(response, 404, { error: 'Узел или скилл не найден.' })
        if (skill.targetTypes && !skill.targetTypes.includes(node.type)) return sendJson(response, 400, { error: 'Этот скилл не работает с выбранным типом узла.' })
        const base = moveFor('custom', node, workspace, { id: `skill:${skill.slug}:${node.id}`, title: skill.title, objective: skill.title, output: skill.output })
        if (redirected) base.prompt = 'Старый обработчик nmt-analyze-interviews заменён на product-interviews. ' + base.prompt
        base.skill = skill.slug
        base.prompt = `Работай в продуктовом воркспейсе: ${workspace}.\nЗапусти /${skill.slug}. Выполни его инструкции для задачи «${skill.title}».`
        base.duration = skill.duration
        base.minutes = skill.minutes
        base.prompt = base.prompt.replace('/product-context', `/${skill.slug}`).replace('Выполни ход', 'Выполни работу')
        base.prompt += `\nИнструкции скилла: ${path.join(repoRoot, 'skills', skill.slug, 'SKILL.md')}. Прочитай этот файл перед выполнением работы.`
        if (body.materialId) {
          if (body.skill !== 'product-content') return sendJson(response, 400, { error: 'Подготовка материала использует product-content.' })
          const comm = require('./communications')
          const context = comm.materialPrompt(snap.communications, body.materialId, repoRoot)
          base.id = `communication:${body.materialId}:${hash(context)}`
          base.prompt += context
          base.output = 'Черновик материала в центре связи; документ и история в Отчётах'
          base.receiptNodeId = body.materialId
        }
        if (body.communicationTask) {
          const task = require('./communications').communicationTaskPrompt(snap.communications, body.communicationTask, body.skill)
          base.prompt += task
          base.id = `communication-task:${node.id}:${hash(task)}`
          base.output = body.communicationTask.kind === 'job-graph' ? 'Вариант графа работ до Core Job с контактами и каналами' : body.communicationTask.kind === 'rubrics' ? 'Рубрики канала в интерфейсе' : 'Материал в интерфейсе коммуникаций'
        }
        return sendJson(response, 200, issue(attachFallback(base, workspace), snap))
      }

      if (request.method === 'POST' && url.pathname === '/api/report-move') {
        const body = await readBody(request)
        const snap = await snapshot()
        const file = safeReportPath(workspace, body.path)
        const node = snap.graph.nodes.find(item => item.id === body.nodeId) || snap.graph.nodes.find(item => item.id === snap.graph.productId)
        if (!file || !node) return sendJson(response, 404, { error: 'Отчёт или узел не найден.' })
        if (snap.reports.find(report => report.path === body.path)?.integrated) return sendJson(response, 409, { error: 'Выводы этого отчёта уже связаны с картой. Откройте отчёт или источники в досье.' })
        const move = moveFor('ingest', node, workspace, { id: `ingest:${hash(body.path)}`, report: body.path })
        return sendJson(response, 200, issue(attachFallback(move, workspace), snap))
      }

      if (request.method === 'POST' && ['/api/launch', '/api/launch-claude'].includes(url.pathname)) {
        const body = await readBody(request)
        const provider = url.pathname === '/api/launch' ? 'bb' : 'claude'
        if (typeof body.idempotencyKey !== 'string' || !/^[a-z0-9-]{16,100}$/i.test(body.idempotencyKey)) return sendJson(response, 400, { error: 'Нужен idempotencyKey запуска.' })
        const snap = await snapshot()
        const move = normalizeMove(body, snap, workspace, issued)
        let previous, launch
        store.update(state => {
          previous = state.launches.find(row => row.idempotencyKey === body.idempotencyKey) || state.launches.find(row => row.moveId===move.id && row.provider===provider && row.requestPrompt===move.prompt && !row.statusOverride && (['pending','unknown'].includes(row.launchState)||snap.todo.some(item=>item.launchId===row.id && ['running','waiting','unknown'].includes(item.status))))
          if (previous) return
          const requestPrompt=move.prompt
          const runId = `run-${randomUUID()}`
          if (move.skill === 'product-status') move.prompt += `\nИдентификатор запуска: ${runId}. Для завершения сохрани служебный результат командой status-receipt: runId=${runId}, nodeId=${move.receiptNodeId || move.node.id}, outcome=completed или failed, summary=фактический итог. Продуктовую память не изменяй.`
          else move.prompt += `\nИдентификатор запуска: ${runId}. В конце запиши результат через graph-write: операция receipt, runId=${runId}, nodeId=${move.receiptNodeId || move.node.id}, skill=${move.skill}, outcome=completed или failed, report=путь к существующему отчёту в reports/ или summary=конкретный итог. Отчёт другого запуска использовать нельзя. Все изменения графа выполняй через graph-write.`
          launch = { requestPrompt, context: body.context||'', id: runId, runId, idempotencyKey: body.idempotencyKey, moveId: move.id, provider, startedAt: Date.now(), move, prompt: move.prompt, launchState: 'pending' }
          state.launches.push(launch)
        })
        if (previous) {
          if (previous.moveId !== move.id || previous.provider !== provider || (previous.context||'') !== (body.context||'')) return sendJson(response, 409, { error: 'Этот запрос уже использован с другими параметрами. Проверьте существующую работу в «Что дальше» перед новым запуском.' })
          return sendJson(response, previous.launchState === 'pending' || previous.launchState === 'unknown' ? 202 : 200, { ok: true, launch: previous, replayed: true })
        }
        try {
          const result = await (provider === 'bb' ? bb : claude).launch(move)
          store.update(state => { const row = state.launches.find(r => r.id === launch.id); Object.assign(row, { threadId: result.threadId || result.externalId, launchState: 'started' }); launch = row })
          return sendJson(response, 201, { ok: true, launch, warning: result.openWarning })
        } catch (error) {
          // A timeout or malformed reply may follow a successful spawn. Retrying the
          // same request must never start a second agent.
          const definite = ['BB_NOT_FOUND', 'BB_PROJECT_NOT_FOUND', 'ENOENT'].includes(error.code)
          store.update(state => { const row = state.launches.find(r => r.id === launch.id); Object.assign(row, { launchState: definite ? 'failed' : 'unknown', error: error.message }); launch = row })
          return sendJson(response, 202, { ok: false, launch, warning: 'Проверьте статус существующего запуска перед повтором.' })
        }
      }

      if (request.method === 'POST' && url.pathname === '/api/open') {
        const body = await readBody(request)
        const launch = store.get().launches.find(item => item.threadId === body.threadId)
        if (!launch || launch.provider === 'claude') return sendJson(response, 404, { error: 'Работа агента не найдена в bb.' })
        await bb.open(body.threadId)
        return sendJson(response, 200, { ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/api/stop') {
        const body = await readBody(request)
        const launch = store.get().launches.find(item => item.threadId === body.threadId)
        if (!launch || launch.provider === 'claude') return sendJson(response, 404, { error: 'Эту работу нельзя остановить из консоли.' })
        await bb.stop(body.threadId)
        store.update(state => { const item = state.launches.find(row => row.threadId === body.threadId); if (item) item.statusOverride = 'stopped' })
        return sendJson(response, 200, { ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/api/human-work') {
        const body=await readBody(request),snap=await snapshot()
        return sendJson(response,200,{ok:true,item:require('./work').updateWork(store,snap,body)})
      }

      if (request.method === 'POST' && url.pathname === '/api/deck') {
        const body = await readBody(request)
        const snap = await snapshot()
        const suggestion = snap.suggestions.find(item => item.id === body.suggestionId)
        if (body.action !== 'undo' && !suggestion) return sendJson(response, 404, { error: 'Предложение уже разобрано или устарело.' })
        if (body.action === 'accept') {
          if (suggestion.action === 'open') {
            await bb.open(suggestion.threadId)
            return sendJson(response, 200, { ok: true, opened: true })
          }
          const tx = new GraphTransaction(workspace, { source: 'MOVES.md' })
          try {
            tx.move({ title: suggestion.move.title, description: suggestion.reason, reason: suggestion.reason,
              expectedOutcome: suggestion.move.output, objective: suggestion.move.objective, gapId: suggestion.move.gapId, nodeId: suggestion.node.id,
              kind: suggestion.move.kind, skill: suggestion.move.skill, suggestionId: suggestion.id, fingerprint: suggestion.fingerprint,
              testsAssumptionId: suggestion.node.type === 'assumption' ? suggestion.node.id : null, acceptOnly: true })
            tx.commit()
          } finally { tx.close() }
        }
        store.update(state => {
          if (body.action === 'accept') delete state.deck.deferred[suggestion.id]
          else if (body.action === 'reject') {
            state.deck.rejected[suggestion.id] = { fingerprint: suggestion.fingerprint, at: Date.now() }
            delete state.deck.deferred[suggestion.id]
          } else if (body.action === 'later') state.deck.deferred[suggestion.id] = { fingerprint: suggestion.fingerprint, at: Date.now() }
          else if (body.action === 'undo') delete state.deck.rejected[body.suggestionId]
          else throw new Error('Неизвестное действие с предложением.')
        })
        return sendJson(response, 200, { ok: true })
      }

      if (request.method === 'POST' && url.pathname === '/api/calibration') {
        const body = await readBody(request)
        const task = loadArena(repoRoot).tasks.find(item => item.id === body.task)
        const pair = task?.calibration.find(item => item.pairId === body.pairId)
        if (!pair || !['A', 'B'].includes(body.choice)) return sendJson(response, 404, { error: 'Пара для калибровки не найдена.' })
        const file = path.join(repoRoot, 'evals', task.id, 'calibration.jsonl')
        const alreadyRecorded = fs.existsSync(file) && fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).some(line => {
          try { return JSON.parse(line).pairId === pair.pairId } catch { return false }
        })
        if (alreadyRecorded) return sendJson(response, 409, { error: 'Выбор по этой паре уже зафиксирован.' })
        fs.appendFileSync(file, `${JSON.stringify({ pairId: pair.pairId, choice: body.choice, judgeChoice: pair.winner, matched: body.choice === pair.winner, reason: pair.reason, createdAt: new Date().toISOString() })}\n`)
        return sendJson(response, 200, { ok: true, matched: body.choice === pair.winner, judgeChoice: pair.winner, reason: pair.reason })
      }

      if (request.method === 'GET' && url.pathname === '/report') {
        const file = safeReportPath(workspace, url.searchParams.get('path'))
        if (!file) return sendText(response,404,missingDocumentPage('Отчёт'),'text/html; charset=utf-8')
        const markdown = fs.readFileSync(file, 'utf8')
        return sendText(response, 200, reportPage(markdown, path.basename(file, '.md'), path.relative(workspace, file).split(path.sep).join('/')), 'text/html; charset=utf-8')
      }

      if (request.method === 'GET' && url.pathname === '/asset') {
        const file = safeAssetPath(workspace, url.searchParams.get('path'))
        if (!file) return sendText(response, 404, 'Файл не найден.', 'text/plain; charset=utf-8')
        // Raster previews only; editable SVG/HTML/JS are served as inert text.
        response.writeHead(200, { 'content-type': ASSET_MIME[path.extname(file).toLowerCase()] || 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" })
        return response.end(fs.readFileSync(file))
      }

      if (request.method === 'GET' && url.pathname === '/source') {
        const relative=url.searchParams.get('path') || ''
        if (!/\.(md|txt|json|html|csv)$/i.test(relative)) {
          const record=graphStore.read().graph.nodes.find(node=>node.type==='artifact' && node.data?.kind==='source-material' && node.source===relative)
          if(!record || !relative.startsWith('sources/'))return sendText(response,404,'Источник не найден.','text/plain; charset=utf-8')
          let real;try{real=fs.realpathSync(path.resolve(workspace,relative))}catch{return sendText(response,404,'Источник не найден.','text/plain; charset=utf-8')}
          if(!real.startsWith(fs.realpathSync(path.join(workspace,'sources'))+path.sep))return sendText(response,404,'Источник не найден.','text/plain; charset=utf-8')
          response.setHeader('Content-Disposition', "attachment; filename*=UTF-8''"+encodeURIComponent(record.label))
          response.setHeader('X-Content-Type-Options','nosniff')
          return sendBuffer(response,200,fs.readFileSync(real),'application/octet-stream')
        }
        const file = safeSourcePath(workspace, url.searchParams.get('path'))
        if (!file) return sendText(response,404,missingDocumentPage('Источник'),'text/html; charset=utf-8')
        // Serve collected HTML/JSON as text, never execute downloaded page content.
        const content = fs.readFileSync(file, 'utf8')
        return sendText(response, 200, file.endsWith('.md') ? reportPage(content, path.basename(file), path.relative(workspace, file).split(path.sep).join('/')) : content,
          file.endsWith('.md') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8')
      }

      if (request.method === 'GET' && url.pathname === '/chrome-extension.zip') {
        const archive = require('../chrome-extension/package').archive(repoRoot)
        response.setHeader('Content-Disposition', 'attachment; filename="product-os-chrome.zip"')
        return sendBuffer(response, 200, archive, 'application/zip')
      }
      const staticFiles = {
        '/job-graph-example.js':'job-graph-example.js',
        '/product-elements.js':'product-elements.js', '/product-elements.css':'product-elements.css', '/product-element-example.js':'product-element-example.js',
        '/product-references.js':'product-references.js', '/product-references.css':'product-references.css', '/reference-example.js':'reference-example.js',
        '/annotation-popover.js': 'annotation-popover.js',
        '/landing-panel-context.js': 'landing-panel-context.js',
        '/chrome': 'chrome.html', '/chrome.js': 'chrome.js', '/chrome.css': 'chrome.css',
        '/competitor-reading.css': 'competitor-reading.css', '/communication-reading.css': 'communication-reading.css', '/research-reading.css': 'research-reading.css',
        '/atlas': 'index.html', '/atlas-content': 'atlas.html', '/atlas-route.js': 'atlas-route.js', '/atlas-navigation.js': 'atlas-navigation.js', '/atlas-shell.js': 'atlas-shell.js', '/atlas-shell.css': 'atlas-shell.css', '/design-system.css': 'design-system.css', '/ui-components.css': 'ui-components.css', '/ui-tokens.css': 'ui-tokens.css', '/ui-components.js': 'ui-components.js', '/design-system-catalog.js': 'design-system-catalog.js', '/design-system': 'design-system.html', '/fonts.css': 'fonts.css', '/product-tabs.js': 'product-tabs.js', '/atlas.js': 'atlas.js', '/research-brief.js':'research-brief.js', '/research-brief-state.js':'research-brief-state.js', '/research-brief.css':'research-brief.css', '/segment-discovery.js': 'segment-discovery.js', '/segment-support.js': 'segment-support.js', '/segment-collection.js': 'segment-collection.js', '/customer-evidence.js': 'customer-evidence.js', '/segment-analysis.js':'segment-analysis.js', '/segment-parameters.js':'segment-parameters.js', '/competitor-preview.js': 'competitor-preview.js', '/competitor-landing.js': 'competitor-landing.js', '/atlas.css': 'atlas.css',
        '/communication-job-graph.js': 'communication-job-graph.js', '/communications.js': 'communications.js', '/channel-content.js': 'channel-content.js', '/communications.css': 'communications.css', '/': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css',
        '/research-job-layout.js': 'research-job-layout.js', '/research.js': 'research.js', '/research.css': 'research.css', '/readability.css': 'readability.css', '/dossier-content.js': 'dossier-content.js', '/dossier-evidence.js': 'dossier-evidence.js', '/dossier-refinement.css': 'dossier-refinement.css', '/hangar-refinement.css': 'hangar-refinement.css',
        '/report-reading.css':'report-reading.css','/report-reading.js':'report-reading.js','/reading-list.js':'reading-list.js', '/product-work.css':'product-work.css', '/product-work.js': 'product-work.js', '/console-runtime.js': 'console-runtime.js', '/atlas-runtime.js': 'atlas-runtime.js', '/galaxy-icons.js': 'galaxy-icons.js', '/galaxy-hangar.js': 'galaxy-hangar.js',
      }
      if (request.method === 'GET' && staticFiles[url.pathname]) {
        const file = path.join(staticRoot, staticFiles[url.pathname])
        const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8'
        let content=fs.readFileSync(file, 'utf8')
        if (staticFiles[url.pathname] === 'index.html') {
          // Use the same product node and naming rule as the final galaxy projection.
          // This reads only shell metadata, without computing research projections.
          let graph=graphStore.lastGood
          const release=workspaceLock(workspace)
          try {recoverPending(workspace);graph=JSON.parse(fs.readFileSync(graphStore.file,'utf8'))} catch {} finally {release()}
          const nodes=Array.isArray(graph?.nodes)?graph.nodes:graphStore.lastGood.nodes
          const product=nodes.find(node=>node?.type==='product')||nodes[0]
          const productName=product?displayLabel(product):path.basename(workspace)
          const description=product?.data?.description?.what||product?.data?.summary||product?.data?.context||product?.context||''
          const bootstrap={workspace,productName,description:typeof description==='string'?description:''}
          content=content.replace('Загружаю продукт…',escapeHtml(productName)).replace('</head>',`<script type="application/json" id="productOsBootstrap">${JSON.stringify(bootstrap).replace(/</g,'\\u003c')}</script></head>`)
        }
        return sendText(response, 200, content, type)
      }
      if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
        const root = path.resolve(staticRoot, 'assets')
        const file = path.resolve(staticRoot, `.${url.pathname}`)
        if (!file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJson(response, 404, { error: 'Asset не найден.' })
        const extension = path.extname(file).toLowerCase()
        const mime = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }[extension] || 'application/octet-stream'
        return sendBuffer(response, 200, fs.readFileSync(file), mime)
      }
      sendJson(response, 404, { error: 'Не найдено.' })
    } catch (error) {
      const timeout = error.code === 'TIMEOUT' || /timed out/i.test(error.message)
      sendJson(response, error.status || (error.code === 'REVISION_CONFLICT' ? 409 : timeout ? 504 : 500), { error: timeout ? 'Агент не ответил за 10 секунд. Проверьте существующий запуск перед повтором.' : error.message, code: error.code || 'ERROR' })
    }
  })

  server.on('close', () => chromeBridge.close())
  return { server, snapshot, store, graphStore, bb, claude }
}

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server.address()))
  })
}

module.exports = {
  BbClient, ClaudeClient, GraphStore, createConsoleServer, findExecutable, listen,
  markdownBody, parseJsonOutput, reportPage, runFile, safeReportPath, authorizeRequest,
}
