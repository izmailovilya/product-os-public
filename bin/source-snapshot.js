#!/usr/bin/env node
// The code's own copy of every page a research result quotes. A verifier agent reopens the
// source and copies an excerpt, but nothing stops that excerpt from being its own paraphrase
// (an audit of 40 confirmed quotes found 2 missing from the live page). At the save boundary
// we fetch each quoted web page or read the local source file, keep a text snapshot in
// sources/snapshots/ and record on the check whether the quote is really there.
// research-quality.js then rejects a quote the page does not contain; a page the code could
// not read keeps the verifier's confirmation, marked as agent-only.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { spawnSync } = require('child_process')
const { quoteFoundIn } = require('./research-quality')

const SNAPSHOTS = 'sources/snapshots'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
// Below this much readable text the page is a script shell or a block page, not the source.
const MIN_TEXT = 200

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' }
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code) => code[0] === '#'
    ? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
    : ENTITIES[code.toLowerCase()] ?? all)
}
// Title and descriptions count as page text: collectors often quote the meta description.
function htmlText(html) {
  const meta = [...html.matchAll(/<meta\b[^>]*(?:name|property)=["'](?:description|og:description|twitter:description|og:title)["'][^>]*>/gi)]
    .map(m => m[0].match(/content=["']([^"']*)["']/i)?.[1] || '')
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
  const body = html.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decode([title, ...meta, body].join('\n')).replace(/[ \t\f\v ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
}

const snapshotFile = url => `${SNAPSHOTS}/${crypto.createHash('sha256').update(url).digest('hex').slice(0, 20)}.txt`
function readSnapshot(workspace, url) {
  const file = path.join(workspace, snapshotFile(url))
  if (!fs.existsSync(file)) return null
  const [header, ...rest] = fs.readFileSync(file, 'utf8').split('\n---\n')
  const field = name => header.match(new RegExp(`^${name}: (.*)$`, 'm'))?.[1] || null
  return { url, status: Number(field('http')), fetchedAt: field('fetchedAt'), text: rest.join('\n---\n'), snapshot: snapshotFile(url) }
}
function writeSnapshot(workspace, page) {
  const file = path.join(workspace, snapshotFile(page.url))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `url: ${page.url}\nhttp: ${page.status}\nfetchedAt: ${page.fetchedAt}\nlanguage: ${page.language}\n---\n${page.text}\n`)
  return { ...page, snapshot: snapshotFile(page.url) }
}

async function fetchPage(url, language, timeoutMs = 20000) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': USER_AGENT, 'accept-language': language, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' } })
  const type = response.headers.get('content-type') || ''
  const body = /text\/|html|xml|json/i.test(type) || !type ? await response.text() : ''
  const markup = /html|xml/i.test(type) || /^\s*</.test(body)
  // url = where the redirects ended; html = raw markup for callers that need headings or buttons (landing-capture).
  return { status: response.status, url: response.url || url, text: markup ? htmlText(body) : body.trim(), html: markup ? body : '' }
}

// Sites serve different languages by header; try the quote's language first, then the other.
async function snapshotPage(workspace, url, quotes, fetcher = fetchPage) {
  const cached = readSnapshot(workspace, url)
  if (cached && (cached.status !== 200 || quotes.every(q => quoteFoundIn(cached.text, q)))) return cached
  const cyrillic = quotes.some(q => /[а-яё]/i.test(q))
  let best = cached
  for (const language of cyrillic ? ['ru-RU,ru;q=0.9,en;q=0.5', 'en-US,en;q=0.9'] : ['en-US,en;q=0.9', 'ru-RU,ru;q=0.9,en;q=0.5']) {
    let page
    // No response at all (offline sandbox, DNS) is not a fact about the page: nothing is cached.
    try { page = await fetcher(url, language) } catch { continue }
    const fetched = { url, status: page.status, text: page.text || '', language, fetchedAt: new Date().toISOString() }
    if (!best || best.status !== 200 && fetched.status === 200) best = fetched
    if (fetched.status === 200 && quotes.every(q => quoteFoundIn(fetched.text, q))) { best = fetched; break }
    if (fetched.status !== 200) break
  }
  return best && !best.snapshot ? writeSnapshot(workspace, best) : best
}

function pageStatus(page, quote) {
  if (!page || page.status !== 200 || !page.local && page.text.length < MIN_TEXT) return 'unavailable'
  return quoteFoundIn(page.text, quote) ? 'found' : 'not-found'
}

// RFC 2606/6761 names exist only in examples and test fixtures; there is no page to read.
function reserved(url) {
  try { return /(^|\.)(example\.(com|net|org)|test|invalid|localhost\.example)$/i.test(new URL(url).hostname) } catch { return false }
}

// Local sources (interviews, notes) are read from the workspace itself; the file is its own snapshot.
function localPage(workspace, source) {
  // Historical results appended line annotations. Resolve only that unambiguous
  // locator syntax; retain the original source and never interpret shell text.
  const locator = require('./source-locator').localSourceLocator(source)
  try {
    const root = fs.realpathSync(workspace), file = fs.realpathSync(path.resolve(root, locator))
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) return null
    const relative = path.relative(root, file).split(path.sep).join('/')
    return { url: String(source), status: 200, text: fs.readFileSync(file, 'utf8'), snapshot: relative, fetchedAt: null, local: true }
  } catch { return null }
}

// Adds check.pageCheck = { status: found | not-found | unavailable, snapshot, checkedAt } to every
// verification check that lacks one. An existing pageCheck is kept, so a replayed save is stable.
async function attestResult(workspace, result, { fetcher = fetchPage, concurrency = 6 } = {}) {
  const out = structuredClone(result)
  const sources = new Map((out.evidencePacket?.sources || []).map(s => [s.id, s]))
  const pending = (out.verificationChecks || []).filter(c => !c.pageCheck && sources.get(c.sourceId)?.source && !reserved(sources.get(c.sourceId).source) && typeof c.quote === 'string' && c.quote.trim())
  const byUrl = new Map()
  for (const check of pending) {
    const url = sources.get(check.sourceId).source
    byUrl.set(url, [...(byUrl.get(url) || []), check])
  }
  const urls = [...byUrl.keys()], pages = new Map()
  const worker = async () => {
    while (urls.length) {
      const url = urls.shift()
      pages.set(url, /^https?:\/\//i.test(url) ? await snapshotPage(workspace, url, byUrl.get(url).map(c => c.quote), fetcher) : localPage(workspace, url))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker))
  for (const [url, checks] of byUrl) for (const check of checks) {
    const page = pages.get(url)
    check.pageCheck = { status: pageStatus(page, check.quote), snapshot: page?.snapshot || null, checkedAt: page?.fetchedAt || null }
  }
  return out
}

// The writers are synchronous; the network is not. Run the attestation in a child process.
// PRODUCT_OS_PAGE_CHECK=off exists for offline test fixtures only.
function attestResultSync(workspace, result) {
  if (process.env.PRODUCT_OS_PAGE_CHECK === 'off' || !(result?.verificationChecks || []).length) return result
  const run = spawnSync(process.execPath, [__filename, 'attest', workspace], { input: JSON.stringify(result), encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 15 * 60 * 1000 })
  if (run.error || run.status !== 0) throw new Error(`Проверка цитат по страницам не выполнена: ${run.error?.message || run.stderr.trim()}`)
  return JSON.parse(run.stdout)
}

if (require.main === module && process.argv[2] === 'attest') {
  const chunks = []
  process.stdin.on('data', c => chunks.push(c)).on('end', async () => {
    try { process.stdout.write(JSON.stringify(await attestResult(path.resolve(process.argv[3]), JSON.parse(Buffer.concat(chunks).toString('utf8'))))) }
    catch (error) { console.error(error.message); process.exitCode = 1 }
  })
}

module.exports = { attestResult, attestResultSync, fetchPage, htmlText, snapshotPage, pageStatus, snapshotFile }
