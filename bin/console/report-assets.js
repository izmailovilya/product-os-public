const fs = require('fs')
const path = require('path')
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
const allowed = relative => /^(reports|sources)\/.+\.(png|jpg|jpeg|webp|gif|json|svg|html|css|js|cjs|txt)$/i.test(relative)
function safeAssetPath(workspace, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.split('/').includes('..') || !allowed(relative)) return null
  try {
    const root = fs.realpathSync(workspace), real = fs.realpathSync(path.resolve(workspace, relative))
    const canonical = path.relative(root, real).split(path.sep).join('/')
    return real.startsWith(root + path.sep) && allowed(canonical) && fs.statSync(real).isFile() ? real : null
  } catch { return null }
}
function readAsset(workspace, relative) {
  const file = safeAssetPath(workspace, relative)
  if (file) return { file, bytes: fs.readFileSync(file) }
  if (typeof relative !== 'string' || !relative.startsWith('reports/') || !relative.endsWith('.json') || !allowed(relative)) return null
  try {
    const stored = require('../artifact-storage').read(workspace, relative)
    return { file: relative, bytes: stored.bytes }
  } catch { return null }
}
function localReportLink(documentPath, target, image = false) {
  if (!documentPath) return null
  // Markdown text has already been HTML-escaped. Decode only for URL construction.
  const decoded = target.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  if(!image && ['/#map','/atlas#map'].includes(decoded)) return decoded
  if(!image && /^\/atlas#product\/brief\/[a-z0-9][a-z0-9_.:-]*$/i.test(decoded)) return decoded
  if(!image && decoded.startsWith('/source?')) {
    const url=new URL(decoded,'http://local.invalid'),relative=url.searchParams.get('path')
    if(url.searchParams.size===1&&typeof relative==='string'&&!relative.includes('\\')&&!relative.split('/').includes('..')&&require('./source-path').sourcePathCandidate(relative)) return '/source?path='+encodeURIComponent(relative)
    return null
  }
  if (/^(?:[a-z]+:|\/|\\)/i.test(decoded)) return null
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(documentPath), decoded.split('#')[0]))
  if(!image&&!/^(reports|sources)\//.test(relative)&&require('./source-path').sourcePathCandidate(relative))return '/source?path='+encodeURIComponent(relative)
  if (!/^(reports|sources)\//.test(relative)) return null
  if (image && !MIME[path.posix.extname(relative).toLowerCase()]) return null
  const route = relative.endsWith('.md') ? (relative.startsWith('reports/') ? '/report' : '/source') : allowed(relative) ? '/asset' : null
  return route ? `${route}?path=${encodeURIComponent(relative)}` : null
}
module.exports = { MIME, safeAssetPath, readAsset, localReportLink }
