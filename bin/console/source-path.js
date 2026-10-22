const fs = require('fs'), path = require('path')
const sourcePathCandidate = value => /^(?:(?:sources|reports|research|segments)\/.*\.(?:md|txt|json|csv|html|log)|[^/]+\.md|RESEARCH-RUNS\.json)$/i.test(value)

// One read-only boundary for both generated provenance links and their HTTP reader.
function safeSourcePath(workspace, relative) {
  relative = require('../source-locator').localSourceLocator(relative)
  const allowed = sourcePathCandidate
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').includes('..') || !allowed(relative)) return null
  try {
    const root=fs.realpathSync(workspace), file=fs.realpathSync(path.join(root,relative))
    const stat=fs.statSync(file), canonical=path.relative(root,file).split(path.sep).join('/')
    return file.startsWith(root+path.sep) && allowed(canonical) && stat.isFile() && stat.size<=8*1024*1024 ? file : null
  } catch { return null }
}
function readSource(workspace, relative) {
  const file = safeSourcePath(workspace, relative)
  if (file) return { file, content: fs.readFileSync(file, 'utf8') }
  relative = require('../source-locator').localSourceLocator(relative)
  if (!relative.startsWith('reports/') || !relative.endsWith('.json') || !sourcePathCandidate(relative)) return null
  try {
    const storage = require('../artifact-storage'), entry = storage.archivedInfo(workspace, relative)
    if (!entry || !Number.isSafeInteger(entry.logicalBytes) || entry.logicalBytes > 8 * 1024 * 1024) return null
    const value = storage.read(workspace, relative)
    return value.bytes.length <= 8 * 1024 * 1024 ? { file: path.join(workspace, relative), content: value.bytes.toString('utf8') } : null
  } catch { return null }
}
module.exports={safeSourcePath,sourcePathCandidate,readSource}
