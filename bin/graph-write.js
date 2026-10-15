#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { applyOperations, GraphTransaction } = require('./graph/writer')
const { validateGraph } = require('./graph/schema')

function main(args = process.argv.slice(2)) {
  const workspace = path.resolve(args[0] || '.')
  if (args.includes('--check')) {
    const error = validateGraph(JSON.parse(fs.readFileSync(path.join(workspace, 'research-graph.json'), 'utf8')))
    if (error) throw new Error(error)
    console.log('Граф валиден'); return
  }
  let result
  if (args.includes('--migrate')) {
    const tx = new GraphTransaction(workspace, { dry: args.includes('--dry') })
    result = tx.commit()
  } else {
    if (!args[1]) throw new Error('graph-write.js <workspace> <operations.json> [--dry] | --check | --migrate')
    result = applyOperations(workspace, JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')), { dry: args.includes('--dry') })
  }
  console.log(`Граф: revision ${result.graph.revision}; ${result.graph.nodes.length} узлов, ${result.graph.edges.length} связей.`)
  for (const warning of result.warnings) console.warn(warning)
  if (!args.includes('--dry')) require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'pages.js'), workspace], { stdio: 'inherit' })
  return result
}
if (require.main === module) { try { main() } catch (error) { console.error(error.message); process.exitCode = 1 } }
module.exports = { main }
