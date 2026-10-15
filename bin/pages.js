#!/usr/bin/env node
// The one entry point for every derived page. Pages are projections of
// research-graph.json — they are never edited by hand and never rebuilt piecemeal.
//   node pages.js [path/to/workspace]
// Today that is the segment passports (segments/*.md). There is no static dashboard
// and no graph.html: the interface is the console (bin/product-os.js).
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ws = path.resolve(process.argv[2] || '.')
if (!fs.existsSync(path.join(ws, 'research-graph.json'))) {
  console.error(`no research-graph.json in ${ws} — nothing to render`)
  process.exit(1)
}
for (const script of ['segments.js']) {
  execFileSync(process.execPath, [path.join(__dirname, script), ws], { stdio: 'inherit' })
}
