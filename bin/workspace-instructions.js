#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')

// Keep the original markers so existing installations upgrade in place.
const START = '<!-- product-os:research:start -->'
const END = '<!-- product-os:research:end -->'
const TEMPLATE = path.resolve(__dirname, '../skills/os-setup/workspace-CLAUDE.md')

function renderWorkspaceInstructions(agent) {
  if (!['claude', 'codex'].includes(agent)) throw new Error('Agent must be claude or codex')
  const tools = agent === 'codex' ? '.agents/product-os-tools' : '.claude/skills/product-os-tools'
  return fs.readFileSync(TEMPLATE, 'utf8')
    .replace(/\.(?:claude\/skills|agents(?:\/skills)?)\/product-os-tools/g, tools).trimEnd()
}

function mergeWorkspaceInstructions(prior, block) {
  const starts = prior.split(START).length - 1
  const ends = prior.split(END).length - 1
  if (!starts && !ends) return prior + (prior ? (prior.endsWith('\n') ? '\n' : '\n\n') : '') + block + '\n'
  const from = prior.indexOf(START), to = prior.indexOf(END)
  if (starts !== 1 || ends !== 1 || to < from) {
    throw new Error('Malformed Product OS instruction markers; preserve the file and repair its block boundaries first')
  }
  return prior.slice(0, from) + block + prior.slice(to + END.length)
}

function writeWorkspaceInstructions(workspace, agent) {
  if (!workspace || !['claude', 'codex', 'both'].includes(agent)) {
    throw new Error('Usage: workspace-instructions <workspace> --agent claude|codex|both')
  }
  // Validate every target before writing either file.
  const updates = (agent === 'both' ? ['claude', 'codex'] : [agent]).map(target => {
    const file = path.join(path.resolve(workspace), target === 'codex' ? 'AGENTS.md' : 'CLAUDE.md')
    const prior = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    return { file, text: mergeWorkspaceInstructions(prior, renderWorkspaceInstructions(target)) }
  })
  fs.mkdirSync(path.resolve(workspace), { recursive: true })
  for (const { file, text } of updates) fs.writeFileSync(file, text)
  return updates.map(({ file }) => file)
}

if (require.main === module) {
  try {
    const [workspace, flag, agent, ...extra] = process.argv.slice(2)
    if (flag !== '--agent' || extra.length) throw new Error('Usage: workspace-instructions <workspace> --agent claude|codex|both')
    for (const file of writeWorkspaceInstructions(workspace, agent)) console.log(file)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = { renderWorkspaceInstructions, mergeWorkspaceInstructions, writeWorkspaceInstructions }
