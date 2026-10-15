const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { GraphTransaction } = require('./graph/writer')
const { writeWorkspaceInstructions } = require('./workspace-instructions')
const { atomicWrite, workspaceLock } = require('./graph/storage')

function missing(file, text) {
  try { fs.writeFileSync(file, text, { flag: 'wx' }); return true }
  catch (error) { if (error.code !== 'EEXIST') throw error; return false }
}

function passportData(text) {
  const sections = new Map()
  for (const match of text.matchAll(/^##\s+([^\n]+)\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/gm)) sections.set(match[1].trim().toLowerCase(), match[2].trim())
  const known = value => value && !/^(пока не|не указ|не опис|unknown|not stated)/i.test(value) ? value : null
  const get = names => names.map(name => known(sections.get(name))).find(Boolean) || null
  const introduction = text.replace(/^#\s+[^\n]+\n/, '').split(/^##\s/m)[0].trim()
  const what = get(['продукт','что это','what it is']) || known(introduction)
  return { description: { what, forWhom: get(['для кого','аудитория']), outcome: get(['результат для клиента']) },
    summary: what, businessGoal: get(['цель','бизнес-цели','business goals (as stated)']),
    constraints: get(['ограничения','constraints (as stated)']), stage: get(['стадия и материалы','стадия','stage & assets']) }
}

function init(workspace, { agent = 'both' } = {}) {
  workspace = path.resolve(workspace)
  if (!['both', 'claude', 'codex'].includes(agent)) throw new Error('Agent must be claude, codex or both')
  fs.mkdirSync(workspace, { recursive: true })
  writeWorkspaceInstructions(workspace, agent)
  for (const name of ['sources', 'reports', 'segments']) fs.mkdirSync(path.join(workspace, name), { recursive: true })
  missing(path.join(workspace, 'PRODUCT.md'), `# ${path.basename(workspace)}\n\n## Продукт\nПока не описан.\n\n## Стадия и материалы\nНе указаны.\n\n## Цель\nНе указана.\n\n## Ограничения\nНе указаны.\n\n## Рынок\nНе указан.\n\n## Утверждения для проверки\nПока не записаны.\n`)
  missing(path.join(workspace, 'MOVES.md'), '# Следующие действия\n\n## Сейчас\n\n## Дальше\n\n## Позже\n\n## Сделано\n')
  missing(path.join(workspace, 'IDEAS.md'), '# Идеи\n\nИдея не является обязательством.\n\n## Возможности\n\n## Отложено\n\n## Отклонено\n')
  const ignore = path.join(workspace, '.gitignore')
  const prior = fs.existsSync(ignore) ? fs.readFileSync(ignore, 'utf8') : ''
  const additions = ['.product-os/', '.agents/product-os-tools/', '.claude/skills/product-os-tools/'].filter(line => !prior.split(/\r?\n/).includes(line))
  if (additions.length) fs.writeFileSync(ignore, prior + (prior && !prior.endsWith('\n') ? '\n' : '') + additions.join('\n') + '\n')
  const tx = new GraphTransaction(workspace, { source: 'PRODUCT.md' })
  try {
    if (!tx.graph.nodes.some(node => node.type === 'product')) {
      const name = fs.readFileSync(path.join(workspace, 'PRODUCT.md'), 'utf8').match(/^#\s+(.+)$/m)?.[1] || path.basename(workspace)
      tx.node('product', 'product', name, { source: 'PRODUCT.md', status: 'hypothesis', data: passportData(fs.readFileSync(path.join(workspace, 'PRODUCT.md'), 'utf8')) })
      tx.commit()
    }
  } finally { tx.close() }
  return { workspace, graph: path.join(workspace, 'research-graph.json') }
}

function importSource(workspace, file) {
  workspace = path.resolve(workspace); file = path.resolve(file)
  if (!fs.existsSync(path.join(workspace, 'research-graph.json'))) throw new Error('Сначала создайте воркспейс: product-os init <workspace>')
  if (!fs.statSync(file).isFile()) throw new Error('Нужен обычный файл')
  const bytes = fs.readFileSync(file), contentHash = createHash('sha256').update(bytes).digest('hex')
  const tx = new GraphTransaction(workspace, { source: 'PRODUCT.md' })
  try {
    const prior = tx.graph.nodes.find(node => node.type === 'artifact' && node.data?.contentHash === contentHash)
    if (prior && fs.existsSync(path.join(workspace, prior.source)) && createHash('sha256').update(fs.readFileSync(path.join(workspace, prior.source))).digest('hex') === contentHash) return { id: prior.id, source: prior.source, duplicate: true }
    const extension = path.extname(file).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12)
    const source = `sources/${contentHash}${extension}`
    fs.mkdirSync(path.join(workspace, 'sources'), { recursive: true })
    const destination = path.join(workspace, source)
    if (fs.existsSync(destination)) {
      if (createHash('sha256').update(fs.readFileSync(destination)).digest('hex') !== contentHash) throw new Error('Существующий оригинал изменён; восстановите его перед импортом')
    } else fs.writeFileSync(destination, bytes, { flag: 'wx' })
    const id = `source-${contentHash.slice(0, 24)}`
    tx.node(id, 'artifact', path.basename(file), { source, status: 'hypothesis', data: { kind: 'source-material', contentHash, originalName: path.basename(file), bytes: bytes.length, importedAt: new Date().toISOString(), summary: 'Исходный материал сохранён. Содержание ещё не разобрано.' } })
    tx.commit()
    return { id, source, duplicate: false }
  } finally { tx.close() }
}

function sources(workspace) {
  const graph = JSON.parse(fs.readFileSync(path.join(path.resolve(workspace), 'research-graph.json'), 'utf8'))
  return graph.nodes.filter(node => node.type === 'artifact' && node.data?.kind === 'source-material').map(node => ({ id: node.id, name: node.label, source: node.source, bytes: node.data.bytes }))
}

function statusReceipt(workspace, { runId, nodeId, summary, outcome = 'completed' }) {
  if (!/^run-[a-z0-9-]+$/i.test(runId || '') || !summary?.trim() || !['completed','failed'].includes(outcome)) throw new Error('Нужны корректный runId, outcome и фактический summary')
  const release = workspaceLock(workspace)
  try {
    const state = JSON.parse(fs.readFileSync(path.join(workspace,'.product-os','state.json'),'utf8'))
    const launch = state.launches.find(item => item.runId === runId)
    if (!launch || launch.move?.skill !== 'product-status' || (launch.move.receiptNodeId || launch.move.node?.id) !== nodeId) throw new Error('Запуск product-status не найден или цель не совпадает')
    const file = path.join(workspace,'.product-os','runs',runId+'.json')
    if(fs.existsSync(file))throw new Error('Результат запуска уже записан')
    const receipt = {runId,nodeId,skill:'product-status',summary,outcome,completedAt:new Date().toISOString()}
    atomicWrite(file,JSON.stringify(receipt,null,2)+'\n')
    return receipt
  } finally { release() }
}

module.exports = { init, importSource, sources, passportData, statusReceipt }
