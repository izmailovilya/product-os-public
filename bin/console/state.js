const fs = require('fs')
const path = require('path')
const { atomicWrite, workspaceLock } = require('../graph/storage')

const EMPTY_STATE = Object.freeze({
  version: 1,
  launches: [],
  deck: { accepted: [], rejected: {}, deferred: {} },
})

function cloneEmpty() {
  return JSON.parse(JSON.stringify(EMPTY_STATE))
}

function normalize(raw) {
  const state = raw && typeof raw === 'object' ? raw : cloneEmpty()
  state.version = 1
  if (!Array.isArray(state.launches)) state.launches = []
  if (!state.deck || typeof state.deck !== 'object') state.deck = {}
  if (!Array.isArray(state.deck.accepted)) state.deck.accepted = []
  if (!state.deck.rejected || typeof state.deck.rejected !== 'object') state.deck.rejected = {}
  if (!state.deck.deferred || typeof state.deck.deferred !== 'object') state.deck.deferred = {}
  // saved segment positions from the removed map view; dropped on the next write
  delete state.galaxy
  return state
}

class StateStore {
  constructor(workspace) {
    this.workspace = workspace
    this.dir = path.join(workspace, '.product-os')
    this.file = path.join(this.dir, 'state.json')
    this.state = this.read()
  }

  read() {
    try {
      return normalize(JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch (error) {
      if (error.code === 'ENOENT') return cloneEmpty()
      throw new Error(`Не удалось прочитать состояние консоли: ${error.message}`)
    }
  }

  get() {
    this.state = this.read()
    return this.state
  }

  update(mutator) {
    const release = workspaceLock(this.workspace)
    try {
      const next = this.read()
      const result = mutator(next)
      this.state = normalize(result && typeof result === 'object' ? result : next)
      atomicWrite(this.file, `${JSON.stringify(this.state, null, 2)}\n`)
      return this.state
    } finally { release() }
  }
}

module.exports = { StateStore, normalize }
