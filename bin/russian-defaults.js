const fs = require('node:fs'), path = require('node:path')

// The same bounded contract travels in checkout, linked and copied/package runtimes.
// Read once with the prompt modules; no output rewriting or additional model calls.
const contract = fs.readFileSync(path.join(__dirname, '..', 'CONTRACT.md'), 'utf8')
const russianDefaults = contract.match(/<!-- product-os:russian-defaults:start -->([\s\S]*?)<!-- product-os:russian-defaults:end -->/)?.[1].trim()
if (!russianDefaults) throw new Error('CONTRACT.md: отсутствует база «Русский текст по умолчанию».')

module.exports = { russianDefaults }
