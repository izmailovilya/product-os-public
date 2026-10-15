const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { digest } = require('./graph/schema')
const { atomicWrite, workspaceLock } = require('./graph/storage')
const META = /\s*<!--\s*product-os-move:(\{[^\n]*?\})\s*-->/
const SECTIONS = { now: 'Сейчас', next: 'Дальше', later: 'Позже', done: 'Сделано-Отброшено' }

function parseMoves(text) {
  const items = []; let section = '', current
  const flush = () => { if (current) items.push(current); current = null }
  for (const [lineNumber, raw] of String(text || '').split('\n').entries()) {
    const heading = raw.match(/^##\s+(.+)/)
    if (heading) { flush(); section = heading[1].trim(); continue }
    const item = raw.match(/^- \[([ xX])\]\s+(.+)/)
    if (item) {
      flush()
      let meta = {}; const match = item[2].match(META)
      if (match) { try { meta = JSON.parse(match[1]) } catch { throw new Error(`Неверная метка хода в MOVES.md:${lineNumber + 1}`) } }
      const text = item[2].replace(META, '').trim()
      current = { ...meta, id: meta.id || `legacy-${digest([section, text])}`, done: item[1].toLowerCase() === 'x', section, text, line: lineNumber, tagged: Boolean(meta.id) }
    } else if (current && /^\s{2,}\S/.test(raw)) current.text += `\n${raw.trim()}`
  }
  flush()
  return items
}

function withMoveIds(text) {
  const lines = String(text || '').split('\n'), used = new Set()
  for (const item of parseMoves(text)) {
    if (item.tagged && used.has(item.id)) throw new Error(`Дублирующийся id хода: ${item.id}`)
    const id = item.tagged ? item.id : `move-${randomUUID()}`
    used.add(id)
    if (!item.tagged) lines[item.line] += ` <!-- product-os-move:${JSON.stringify({ id })} -->`
  }
  return lines.join('\n')
}

function ensureMoveIds(workspace) {
  const release = workspaceLock(workspace)
  try {
    const file = path.join(workspace, 'MOVES.md')
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '# Ходы\n\n## Сейчас\n\n## Дальше\n\n## Позже\n\n## Сделано-Отброшено\n'
    const text = withMoveIds(old)
    if (old !== text || !fs.existsSync(file)) atomicWrite(file, text)
    return parseMoves(text)
  } finally { release() }
}

function upsertMove(text, move) {
  text = withMoveIds(text || '# Ходы\n')
  const existing = parseMoves(text).find(row => row.id === move.id || (move.suggestionId && row.suggestionId === move.suggestionId && row.fingerprint === move.fingerprint))
  // Accepting twice is idempotent; editing an existing move preserves its ID.
  if (existing && move.acceptOnly) return { text, id: existing.id }
  const id = existing?.id || move.id || `move-${randomUUID()}`
  let horizon = move.horizon || 'now'
  const nowCount = parseMoves(text).filter(item => !item.done && /сейчас/i.test(item.section) && item.id !== id).length
  if (horizon === 'now' && nowCount >= 3) horizon = 'next'
  if (move.done) horizon = 'done'
  const section = SECTIONS[horizon]
  if (!section) throw new Error('Неизвестный горизонт хода')
  const meta = { ...(existing ? Object.fromEntries(Object.entries(existing).filter(([key]) => !['text', 'line', 'tagged', 'done', 'section'].includes(key))) : {}), id }
  for (const key of ['nodeId', 'kind', 'skill', 'suggestionId', 'fingerprint', 'testsAssumptionId', 'killCriterion', 'usesAssets', 'executionReady', 'issues', 'failureTest', 'resources', 'dependsOn', 'servesGoal', 'respectsConstraints', 'expectedOutcome', 'output', 'objective', 'reason', 'owner', 'taskType', 'gapId']) if (move[key] != null) meta[key] = move[key]
  if (!move.title?.trim()) throw new Error('Ходу нужно название')
  const failure = move.failureTest
  const details = [move.description, move.expectedOutcome && `Ожидаемый результат: ${move.expectedOutcome}`, move.owner && `Ответственный: ${move.owner}`, move.killCriterion && `Порог провала: ${move.killCriterion}`,
    failure && `Проверка: ${failure.metric} ${failure.operator} ${failure.value}${failure.unit ? ` ${failure.unit}` : ''}; ${failure.measurement}; срок: ${failure.deadline}${failure.sampleSize ? `; выборка: ${failure.sampleSize}` : ''}`,
    move.servesGoal && `Для цели: ${move.servesGoal}`, move.respectsConstraints && `Ограничения: ${move.respectsConstraints}`,
    move.usesAssets && `Активы: ${move.usesAssets}`, move.report && `Отчёт: ${move.report}`, move.result && `Результат: ${move.result}`].filter(Boolean)
  const entry = `- [${move.done ? 'x' : ' '}] **${move.title.replace(/[\r\n]/g, ' ')}** <!-- product-os-move:${JSON.stringify(meta)} -->\n${details.map(x => String(x).split('\n').map(line => `  ${line}`).join('\n')).join('\n')}\n`
  if (existing) {
    const lines = text.split('\n'); let end = existing.line + 1
    while (end < lines.length && (/^\s{2,}/.test(lines[end]) || !lines[end].trim())) end++
    lines.splice(existing.line, end - existing.line); text = lines.join('\n')
  }
  const heading = `## ${section}`
  const lines = text.split('\n'), start = lines.findIndex(line => line.trim() === heading)
  if (start < 0) text = `${text.trimEnd()}\n\n${heading}\n\n${entry}`
  else {
    let end = start + 1
    while (end < lines.length && !/^##\s/.test(lines[end])) end++
    lines.splice(end, 0, entry); text = lines.join('\n')
  }
  return { text, id }
}

module.exports = { parseMoves, withMoveIds, ensureMoveIds, upsertMove, SECTIONS }
