const fs = require('node:fs')
const path = require('node:path')
const PUBLIC_SKILLS = ['os-setup', 'product-context', 'product-status']
function isPublicEdition(root = path.resolve(__dirname, '..')) {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name === 'product-os-public' }
  catch { return false }
}
module.exports = { isPublicEdition, PUBLIC_SKILLS }
