const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')
const { isPublicEdition } = require('../edition')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const exists = file => fs.lstatSync(file, { throwIfNoEntry: false })
const { pathToFileURL } = require('node:url')
const runtimeRoot = path.resolve(__dirname, '../..')

function regularTree(directory, callback, relative = '') {
  if (exists(directory)?.isSymbolicLink()) throw new Error("The snapshot does not follow symbolic links: " + directory)
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.')) continue
    const file = path.join(directory, entry.name), name = relative + entry.name
    if (entry.isDirectory()) regularTree(file, callback, name + '/')
    else if (entry.isFile()) callback(file, name)
    else throw new Error("The snapshot includes only regular files: " + name)
  }
}
function safeChild(workspace, relative) {
  const result = path.resolve(workspace, relative)
  if (result !== workspace && !result.startsWith(workspace + path.sep)) throw new Error("The image path extends beyond the work area.")
  for (let current = result; current !== workspace; current = path.dirname(current)) if (exists(current)?.isSymbolicLink()) throw new Error("The snapshot does not follow symbolic links: " + relative)
  return result
}
function settings(workspace) {
  const file = safeChild(workspace, '.product-os/share-settings.json')
  if (!exists(file)) return {}
  const value = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (value.version !== 1 || !['open', 'password'].includes(value.access) || typeof value.includeSources !== 'boolean') throw new Error("Incorrect saved publishing settings.")
  return value
}
function write(directory, relative, bytes) {
  const file = path.join(directory, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes)
}
function cleanSnapshot(snapshot, info) {
  for (const field of ['workspace', 'csrfToken', 'threads', 'todo', 'moves', 'suggestions', 'deck', 'calibration', 'skillGroups', 'skills']) delete snapshot[field]
  snapshot.capabilities = { bb: false, claude: false }
  snapshot.sharedSnapshot = info
  return snapshot
}
async function prepare(workspace, { access, name, includeSources, changeAccess = false } = {}) {
  workspace = fs.realpathSync(path.resolve(workspace))
  if (!exists(path.join(workspace, 'research-graph.json'))) throw new Error("We need a product workspace with research-graph.json.")
  const prior = settings(workspace)
  access = access || prior.access
  if (!['open', 'password'].includes(access)) throw new Error("Ask the owner: open access or password? Then specify --access open|password. For private data, recommend a password.")
  if (prior.access && prior.access !== access && !changeAccess) throw new Error("To change a saved access mode, you need an instruction from the owner and --change-access.")
  name = name || prior.name || 'product-os-' + randomUUID().slice(0, 8)
  if (!/^[a-z][a-z0-9-]{2,62}$/.test(name)) throw new Error("--name: from 3 to 63 lowercase Latin letters, numbers and hyphens, starting with the letter.")
  includeSources = includeSources ?? prior.includeSources ?? false
  if (typeof includeSources !== 'boolean') throw new Error("includeSources must be an explicit boolean choice.")
  const output = safeChild(workspace, '.product-os/shares/' + randomUUID())
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'product-os-share-'))
  const copy = path.join(temp, 'workspace'), inventory = [], routes = {}, omitted = [], auxiliary = new Map()
  const info = { createdAt: new Date().toISOString(), access, readOnly: true, includesSources: includeSources }
  let app, ok = false
  try {
    fs.mkdirSync(copy)
    const copyFile = (file, relative) => {
      if (!exists(file)?.isFile() || exists(file).isSymbolicLink()) throw new Error("A regular file is needed: " + relative)
      const bytes = fs.readFileSync(file)
      if (bytes.length > 25 * 1024 * 1024) throw new Error("File exceeds 25 MiB limit: " + relative)
      write(copy, relative, bytes); inventory.push({ path: relative, bytes: bytes.length, sha256: digest(bytes) })
    }
    const releaseSource = require('../graph/storage').workspaceLock(workspace)
    try {
    for (const relative of ['PRODUCT.md', 'MOVES.md', 'IDEAS.md', 'research-graph.json']) {
      const file = safeChild(workspace, relative)
      if (exists(file)) copyFile(file, relative)
    }
    for (const relative of ['reports', ...(includeSources ? ['sources'] : [])]) {
      const directory = safeChild(workspace, relative)
      if (exists(directory)) regularTree(directory, (file, name) => copyFile(file, relative + '/' + name))
    }
    fs.mkdirSync(path.join(copy, 'sources'), { recursive: true })
    fs.mkdirSync(path.join(copy, 'reports'), { recursive: true })
    // Registered presentations can refer to visual assets in sources/. Render
    // those on demand without exposing the source-document reader or all originals.
    if (!includeSources) {
      const visit = value => {
        if (typeof value === 'string' && /^sources\/[^\\]+\.(?:json|png|jpe?g|webp|gif|svg|woff2?|[ot]tf|pdf|pptx)$/i.test(value)) {
          if (/[\u0000-\u001f\u007f]/.test(value) || value.split('/').some(part => !part || part.startsWith('.'))) throw new Error("Incorrect link to the source file: " + value)
          const file = safeChild(workspace, value)
          if (exists(file)?.isFile() && !auxiliary.has(value)) {
            const bytes = fs.readFileSync(file)
            if (bytes.length > 25 * 1024 * 1024) throw new Error("File exceeds 25 MiB limit: " + value)
            write(copy, value, bytes); auxiliary.set(value, { path: value, bytes: bytes.length, sha256: digest(bytes), role: 'displayed-asset' })
            if (value.endsWith('.json')) { let data; try { data = JSON.parse(bytes) } catch {} if (data) visit(data) }
          }
        } else if (Array.isArray(value)) value.forEach(visit)
        else if (value && typeof value === 'object') Object.values(value).forEach(visit)
      }
      for (const file of inventory.filter(file => file.path.endsWith('.json'))) {
        let value; try { value = JSON.parse(fs.readFileSync(path.join(copy, file.path), 'utf8')) } catch { continue }
        visit(value)
      }
    }
    } finally { releaseSource() }
    // Resolve rendering from the reviewed Public runtime, never ship private toolkit code.
    let root = runtimeRoot
    if (!isPublicEdition(root)) {
      const exporter = path.join(root, 'scripts/export-public.js')
      if (!exists(exporter)) throw new Error("To export, use Product OS Public or the original toolkit checkout.")
      root = path.join(temp, 'public-runtime'); require(exporter).exportPublic(root)
    }
    const { createConsoleServer, listen } = require(path.join(root, 'bin/console/server'))
    app = await createConsoleServer({ workspace: copy, repoRoot: root, bbPath: false, claudePath: false, codexPath: false, chromeAgent: false })
    const address = await listen(app.server), base = `http://127.0.0.1:${address.port}`
    const { routeKey } = await import(pathToFileURL(path.join(__dirname, 'auth.mjs')))
    const add = (url, bytes, headers = {}, status = 200) => {
      if (bytes.length > 25 * 1024 * 1024) throw new Error("The saved page exceeds the 25 MiB limit: " + url)
      const key = routeKey(url), asset = '/_snapshot/' + digest(bytes)
      write(output, 'assets' + asset, bytes)
      routes[key] = { asset, status, headers }
    }
    const publicDirectory = path.join(root, 'bin/console/public')
    regularTree(publicDirectory, (file, relative) => {
      let bytes = fs.readFileSync(file)
      if (relative === 'app.js') {
        const original = bytes.toString('utf8'), changed = original.replace(/^setInterval\(\(\)=>\{if\(!document.hidden\)refresh\(\)\},4000\)\s*$/m, '')
        if (original === changed) throw new Error("The Public update scheme has changed. Check the snapshot adapter.")
        bytes = Buffer.from(changed)
      }
      const extension = path.extname(relative).toLowerCase()
      const mime = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[extension] || 'text/plain; charset=utf-8'
      add('/' + relative, bytes, { 'content-type': mime })
    })
    const capture = async (route, { optional = false, transform, sourcePath } = {}) => {
      if (routes[routeKey(route)]) return
      const response = await fetch(new URL(route, base))
      if (!response.ok) {
        if (optional && response.status === 404) { omitted.push(route); return }
        throw new Error("Failed to save page " + route + ': ' + response.status)
      }
      let bytes = Buffer.from(await response.arrayBuffer())
      let value
      if (response.headers.get('content-type')?.includes('application/json')) { value = JSON.parse(bytes); if (transform) value = transform(value); bytes = Buffer.from(JSON.stringify(value)) }
      if (route === '/') {
        let html = bytes.toString('utf8')
        html = html.replace(/<script type="application\/json" id="productOsBootstrap">[\s\S]*?<\/script>/, '')
        html = html.replace('</head>', '<link rel="stylesheet" href="/_share/login.css"></head>').replace('<script type="module" src="/app.js"></script>', '<script src="/_share/client.js"></script><script type="module" src="/app.js"></script>')
        const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(info.createdAt))
        html = html.replace('<nav class="public-navigation"', `<div class="share-status"><p>Photo from ${date}</p><p>View only · ${access === 'password' ? "Password access" : "Open access"}</p>${access === 'password' ? "<form method=\"post\" action=\"/_share/logout\"><button class=\"os-button os-button-secondary\" type=\"submit\">Exit</button></form>" : ''}</div><nav class="public-navigation"`)
        bytes = Buffer.from(html)
      }
      const headers = {}
      for (const key of ['content-type', 'content-disposition', 'content-security-policy']) if (response.headers.has(key)) headers[key] = response.headers.get(key)
      add(route, bytes, headers)
      if (auxiliary.has(sourcePath) && !inventory.some(file => file.path === sourcePath)) inventory.push(auxiliary.get(sourcePath))
      return value
    }
    await capture('/')
    // Alias the only index to the same stamped snapshot, not the raw static shell.
    routes['/index.html'] = routes['/']
    const snapshot = await capture('/api/snapshot', { transform: value => cleanSnapshot(value, info) })
    const productIds = snapshot.graph.nodes.filter(node => node.type === 'product').map(node => node.id)
    const query = (route, params) => route + '?' + new URLSearchParams(params)
    for (const productId of productIds) {
      await capture(query('/api/strategic-jobs', { productId }))
      const identity = await capture(query('/api/product-identity', { productId }))
      for (const profile of [null, ...(identity.versions || []).map(row => row.id)]) {
        const params = { productId, ...(profile ? { profile } : {}) }
        const data = profile ? await capture(query('/api/product-identity', params)) : identity
        for (const file of data?.profile?.files || []) if (file.available) for (const download of [null, '1']) await capture(query('/api/product-identity/file', { ...params, file: file.id, ...(download ? { download } : {}) }), { optional: true, sourcePath: file.path })
      }
      const references = await capture(query('/api/product-references', { productId }))
      const libraries = [null, ...(references.libraries || []).map(row => row.id)]
      for (const library of libraries) {
        const params = { productId, ...(library ? { library } : {}) }
        const data = library ? await capture(query('/api/product-references', params)) : references
        for (const row of data?.cards || []) for (const media of row.card?.media || []) await capture(query('/api/product-references/image', { productId, library: data.library.artifactId, card: row.card.id, media: media.id }), { optional: true, sourcePath: media.path })
        for (const file of data?.files || []) await capture(query(file.path?.endsWith('.md') ? '/report' : '/asset', { path: file.path }), { optional: true, sourcePath: file.path })
      }
    }
    for (const file of inventory) {
      if (file.path.startsWith('reports/')) await capture(query(file.path.endsWith('.md') ? '/report' : '/asset', { path: file.path }), { optional: true })
      if (includeSources && file.path.startsWith('sources/') || file.path === 'PRODUCT.md' || file.path === 'MOVES.md') await capture(query('/source', { path: file.path }), { optional: true })
    }
    // Only captured files are deployed. The temporary workspace and runtime never leave this machine.
    for (const file of ['auth.mjs', 'worker.mjs']) fs.copyFileSync(path.join(__dirname, file), path.join(output, file))
    write(output, 'login.mjs', fs.readFileSync(path.join(__dirname, 'login.mjs'), 'utf8').replace('../console/public/ui-components.js', './ui-components.mjs'))
    write(output, 'ui-components.mjs', fs.readFileSync(path.join(publicDirectory, 'ui-components.js')))
    add('/_share/login.css', fs.readFileSync(path.join(__dirname, 'login.css')), { 'content-type': 'text/css; charset=utf-8' })
    add('/_share/login.js', fs.readFileSync(path.join(__dirname, 'login.js')), { 'content-type': 'text/javascript; charset=utf-8' })
    add('/_share/client.js', fs.readFileSync(path.join(__dirname, 'client.js')), { 'content-type': 'text/javascript; charset=utf-8' })
    write(output, 'routes.json', JSON.stringify(routes))
    write(output, 'index.mjs', `import routes from './routes.json' with {type:'json'};\nimport {createShareWorker} from './worker.mjs';\nimport {loginPage} from './login.mjs';\nexport default createShareWorker({mode:${JSON.stringify(access)},routes,loginPage});\n`)
    const config = { name, main: 'index.mjs', compatibility_date: '2026-10-21', assets: { directory: './assets', binding: 'ASSETS', run_worker_first: true, html_handling: 'none', not_found_handling: 'none' }, ratelimits: [{ name: 'LOGIN_LIMITER', namespace_id: String(parseInt(digest(name).slice(0, 7), 16)), simple: { limit: 20, period: 60 } }] }
    write(output, 'wrangler.json', JSON.stringify(config, null, 2) + '\n')
    write(output, '.gitignore', '.dev.vars*\n.wrangler/\nnode_modules/\n')
    if (access === 'password' && prior.access === 'password' && /^[a-f0-9-]{36}$/.test(prior.lastPackage || '')) {
      const credentials = safeChild(workspace, '.product-os/shares/' + prior.lastPackage + '/.dev.vars')
      if (exists(credentials)?.isFile()) fs.copyFileSync(credentials, path.join(output, '.dev.vars'))
    }
    const manifest = { version: 1, workerName: name, ...info, files: inventory, unavailable: omitted, routes: Object.keys(routes).sort(), published: false, note: "The snapshot includes all saved product memory and reports. Original sources/ are only included when explicitly selected. Please check the contents, not just the file names, before sending." }
    write(output, 'REVIEW.json', JSON.stringify(manifest, null, 2) + '\n')
    write(output, 'README.md', "# Snapshot Product OS\n\nBefore publishing, review REVIEW.json and local preview.\n\nMode: " + access + ". View only.\n\nFor password: product-os share password <this directory> --env-file <protected dotenv s PRODUCT_OS_SHARE_PASSWORD>.\n\nPublication: product-os share deploy <this directory> --approved-digest <digest from share review>.\n\nHosting has free quotas Cloudflare Workers; Paid features are not automatically enabled.\n")
    fs.mkdirSync(path.dirname(safeChild(workspace, '.product-os/share-settings.json')), { recursive: true })
    const settingsFile = path.join(workspace, '.product-os/share-settings.json'), settingsTemp = settingsFile + '.' + randomUUID() + '.tmp'
    fs.writeFileSync(settingsTemp, JSON.stringify({ version: 1, access, name, includeSources, lastPackage: path.basename(output) }, null, 2) + '\n')
    fs.renameSync(settingsTemp, settingsFile)
    ok = true
    return { directory: output, ...manifest }
  } finally {
    if (app) await new Promise(resolve => app.server.close(resolve))
    fs.rmSync(temp, { recursive: true, force: true })
    if (!ok && exists(output)) fs.rmSync(output, { recursive: true, force: true })
  }
}
module.exports = { prepare, regularTree, digest }
