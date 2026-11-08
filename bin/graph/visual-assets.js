// Visual metadata lives in existing artifacts; this validates links, not design quality.
const nonempty = value => typeof value === 'string' && Boolean(value.trim())
const relativeFile = value => nonempty(value) && !value.startsWith('/') && !value.includes('\\') && !value.includes(':') && !value.split('/').some(part => ['..', '.', ''].includes(part))
function validateVisualAssets(graph, by) {
  for (const n of graph.nodes) {
    const d = n.data || {}
    if (n.type !== 'artifact') continue
    if (d.visualArtifactIds != null) {
      if (!Array.isArray(d.visualArtifactIds) || new Set(d.visualArtifactIds).size !== d.visualArtifactIds.length || d.visualArtifactIds.some(id => by.get(id)?.data?.kind !== 'visual-pack' || !by.get(id).data.materialIds?.includes(n.id))) return `Invalid material visuals: ${n.id}`
    }
    if (!['visual-profile', 'visual-pack'].includes(d.kind)) continue
    if (by.get(d.productId)?.type !== 'product' || (d.channelId != null && by.get(d.channelId)?.type !== 'channel')) return `Invalid visual area: ${n.id}`
    if (!Number.isInteger(d.version) || d.version < 1 || !['proposed', 'accepted'].includes(d.decision)) return `Invalid version or visual solution: ${n.id}`
    if (d.decision === 'accepted' && !nonempty(d.decisionSource)) return `Visual adoption needs a solution source: ${n.id}`
    if (d.supersedes) {
      const old = by.get(d.supersedes)
      if (old?.type !== 'artifact' || old.data?.kind !== d.kind || old.data.productId !== d.productId || old.data.channelId !== d.channelId || !(old.data.version < d.version)) return `Invalid previous version of visual: ${n.id}`
    }
    if (d.kind === 'visual-profile') {
      if (!relativeFile(d.profileFile)) return `Invalid profile file: ${n.id}`
      continue
    }
    if (!relativeFile(d.manifestFile) || !['draft', 'ready-for-review'].includes(d.readiness)) return `Invalid manifest or visual readiness: ${n.id}`
    if (!Array.isArray(d.materialIds) || !d.materialIds.length || new Set(d.materialIds).size !== d.materialIds.length) return `Visual needs materials: ${n.id}`
    for (const id of d.materialIds) {
      const m = by.get(id)
      if (m?.type !== 'artifact' || ['visual-profile', 'visual-pack'].includes(m.data?.kind)) return `Visual material not found: ${id}`
      const products = graph.edges.filter(e => e.from === id && e.type === 'material_offer').map(e => e.to)
      if (m.data?.productId) products.push(m.data.productId)
      const channels = graph.edges.filter(e => e.from === id && e.type === 'material_channel').map(e => e.to)
      if (m.data?.channelId) channels.push(m.data.channelId)
      if ((products.length && !products.includes(d.productId)) || (d.channelId && channels.length && !channels.includes(d.channelId))) return `Material from another area: ${id}`
    }
    if (d.visualProfileArtifactId) {
      const profile = by.get(d.visualProfileArtifactId)
      if (profile?.type !== 'artifact' || profile.data?.kind !== 'visual-profile' || profile.data.productId !== d.productId || profile.data.channelId !== d.channelId || profile.data.version !== d.visualProfileVersion) return `Invalid visual profile version: ${n.id}`
    } else if (d.visualProfileVersion != null || !nonempty(d.profileAssumptions)) return `Specify visual profile or assumptions: ${n.id}`
  }
  return null
}
module.exports = { validateVisualAssets }
