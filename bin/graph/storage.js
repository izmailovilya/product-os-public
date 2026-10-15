const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { digest } = require('./schema')

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`
  let fd
  try {
    fd = fs.openSync(temporary, 'wx', 0o600)
    fs.writeFileSync(fd, content); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined
    fs.renameSync(temporary, file)
  } finally {
    if (fd != null) fs.closeSync(fd)
    fs.rmSync(temporary, { force: true })
  }
}

// O_EXCL gives every cooperating process one owner. A crashed owner's PID can be
// reclaimed; an active owner is never evicted by a wall-clock timeout.
function acquireLock(file, { timeoutMs = 5000 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const token = randomUUID(), start = Date.now()
  while (true) {
    try {
      // Publish a fully initialized owner atomically; a crash cannot leave an empty lock.
      const ownerFile = `${file}.owner-${process.pid}-${token}`
      try {
        fs.writeFileSync(ownerFile, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 })
        fs.linkSync(ownerFile, file)
      } finally { fs.rmSync(ownerFile, { force: true }) }
      return () => {
        try { if (JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.unlinkSync(file) } catch {}
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      try {
        const owner = JSON.parse(fs.readFileSync(file, 'utf8'))
        try { process.kill(owner.pid, 0) } catch (e) {
          if (e.code === 'ESRCH') { fs.unlinkSync(file); continue }
        }
      } catch {} // partial lock initialization: wait, never steal
      if (Date.now() - start >= timeoutMs) throw Object.assign(new Error('Воркспейс занят другим процессом. Повтори запись.'), { code: 'WORKSPACE_BUSY' })
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20)
    }
  }
}

function workspaceLock(workspace, options) {
  return acquireLock(path.join(workspace, '.product-os', 'workspace.lock'), options)
}

function recoverPending(workspace) {
  const journal = path.join(workspace, '.product-os', 'pending-graph.json')
  if (!fs.existsSync(journal)) return
  const bundle = JSON.parse(fs.readFileSync(journal, 'utf8'))
  for (const entry of bundle.files) {
    if (!/^research\/briefs\/[a-z0-9][a-z0-9-]{0,99}\.json$/.test(entry.path) && !['research-graph.json', 'MOVES.md', 'research/research-data.json'].includes(entry.path) && !/^\.product-os\/research-history\/[0-9]+\.json$/.test(entry.path) && !/^reports\/(?:communications|segment-views)\/[a-zа-яё0-9][a-zа-яё0-9_.:-]{0,239}\.md$/i.test(entry.path) && !/^\.product-os\/runs\/[a-z0-9-]+\.json$/i.test(entry.path)) throw new Error('Неверный путь в журнале транзакции')
    const file = path.join(workspace, entry.path)
    // Never traverse a user-created symlink when recovering a report transaction.
    let ancestor = file
    while (ancestor !== path.resolve(workspace)) {
      if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('Символическая ссылка в пути транзакции')
      ancestor = path.dirname(ancestor)
    }
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (current === entry.content) continue
    if (digest(current) !== entry.before) throw Object.assign(new Error(`Восстановление остановлено: ${entry.path} изменён после незавершённой записи`), { code: 'RECOVERY_CONFLICT' })
  }
  // Preflight the entire bundle before changing any file. Recovery may still
  // resume after a crash between renames, while readers hold the same lock.
  for (const entry of bundle.files) {
    const file = path.join(workspace, entry.path)
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== entry.content) atomicWrite(file, entry.content)
  }
  fs.unlinkSync(journal)
}

function commitFiles(workspace, files) {
  const journal = path.join(workspace, '.product-os', 'pending-graph.json')
  atomicWrite(journal, JSON.stringify({ files }))
  recoverPending(workspace)
}

module.exports = { atomicWrite, acquireLock, workspaceLock, recoverPending, commitFiles }
