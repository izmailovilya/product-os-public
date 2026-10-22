const fs = require('fs')
const path = require('path')
const {safeSourcePath} = require('./source-path')

// Resolve provenance for reading only. A working link does not verify a claim.
// Read just the profile's declared provenance documents, never scan a workspace.
function customerProfileSources(workspace, nodes = []) {
  const root = fs.realpathSync(workspace), documents = new Map()
  const graph = new Map(nodes.map(node => [node.id, node]))
  function document(relative) {
    if (documents.has(relative)) return documents.get(relative)
    let result = null
    try {
      const file = safeSourcePath(root, relative)
      if (!file) return null
      const text = fs.readFileSync(file, 'utf8'), index = new Map(), parents = new Set()
      if (relative.endsWith('.json')) {
        const visit = value => {
          if (!value || typeof value !== 'object') return
          if (typeof value.id === 'string' && !index.has(value.id)) index.set(value.id, value)
          for (const key of ['previousSource','customerProfilePreviousSource']) if (typeof value[key] === 'string') parents.add(value[key])
          for (const child of Object.values(value)) visit(child)
        }
        visit(JSON.parse(text))
      }
      result = { index, parents:[...parents], title: text.match(/^#\s+(.+)$/m)?.[1] || path.basename(relative) }
    } catch {}
    documents.set(relative, result)
    return result
  }
  const href = relative => '/source?path=' + encodeURIComponent(relative)
  function resolve(ref, origins, seen = new Set(), depth = 0) {
    if (typeof ref !== 'string' || seen.has(ref) || depth > 4) return []
    const next = new Set(seen).add(ref)
    if (/^https?:\/\//i.test(ref)) {
      try { return [{ kind: 'material', label: new URL(ref).hostname, href: ref }] } catch { return [] }
    }
    const direct = document(ref)
    if (direct) return [{ kind: 'material', label: direct.title, href: href(ref) }]
    let record = graph.get(ref), origin = record?.source
    if (!record) for (const file of origins) {
      record = document(file)?.index.get(ref)
      if (record) { origin = file; break }
    }
    if (!record) return []
    const source = typeof record.source === 'string' ? record.source : null
    const references = [...(record.sourceRefs || []), ...(record.evidenceRefs || []), ...(record.sourceIds || []), ...(record.claimIds || []), ...(record.observations || []).map(o=>o.sourceId), ...(record.sources || []).map(s=>typeof s==='string'?s:s.source||s.url||s.id), ...(source ? [source] : [])]
    const label = record.name || record.label || record.criterion || record.statement || 'Исходная запись'
    const resolved = references.flatMap(item => resolve(item, origins, next, depth + 1))
    const entry = origin && document(origin) ? [{kind:'record',label,href:href(origin)}] : []
    // Only a stored excerpt is quoted; never turn an inferred statement into a quote.
    if (record.excerpt && resolved.length) resolved[0] = {...resolved[0], excerpt:String(record.excerpt).slice(0,1200)}
    return [...entry, ...resolved]
  }
  return (profile, provenance) => {
    if (!profile) return profile
    const origins = [...new Set(provenance.filter(value => typeof value === 'string'))]
    for (let i=0;i<origins.length&&i<16;i++) for (const parent of document(origins[i])?.parents||[]) if (!origins.includes(parent)&&origins.length<16) origins.push(parent)
    const walk = value => {
      if (Array.isArray(value)) return value.map(walk)
      if (!value || typeof value !== 'object') return value
      if (typeof value.text === 'string' && Array.isArray(value.sourceRefs)) {
        const details = new Map(), missing = []
        for (const ref of value.sourceRefs) {
          const entries = resolve(ref, origins)
          if (!entries.length) missing.push(ref)
          for (const item of entries) details.set(item.kind + '|' + item.href + '|' + item.label, item)
        }
        return {...value,sourceDetails:[...details.values()],unresolvedSourceCount:missing.length}
      }
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, walk(child)]))
    }
    return walk(profile)
  }
}
module.exports = {customerProfileSources}
