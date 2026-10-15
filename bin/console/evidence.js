// One provenance projection for every dossier. Report pointers are context, never
// promoted to observations. Claim references retain their verified scope and polarity.
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null }
function sourceOf(value) {
  const source = text(typeof value === 'object' ? value?.url || value?.source || value?.path : value)
  if (!source || /[\u0000-\u001f]/.test(source)) return null
  if (/^https?:\/\//i.test(source)) {
    try { const url = new URL(source); return url.username || url.password ? null : source } catch { return null }
  }
  // Only workspace artifacts are links; arbitrary protocols and parent traversal are not.
  return !/^[a-z][a-z\d+.-]*:/i.test(source) && !source.startsWith('/') && !source.startsWith('\\') && !source.split(/[\\/]/).includes('..') && /^(?:sources\/|reports\/|[^/]+\.md(?:#|$))/.test(source) ? source : null
}
function uniqueEvidence(rows) {
  return [...new Map(rows.filter(Boolean).map(row => [`${row.claimId || ''}|${row.source || row.id}|${row.quote || ''}|${row.relation}`, row])).values()]
}
function evidenceFields(rows = []) {
  const evidence = uniqueEvidence(rows)
  const active = evidence.filter(row => row.kind === 'evidence' && row.usable !== false && !row.resolvedAt)
  const supports = active.some(row => row.relation !== 'contradicted_by')
  const opposes = active.some(row => row.relation === 'contradicted_by')
  return { evidence, evidenceCount: active.length,
    evidenceStatus: supports && opposes ? 'mixed' : opposes ? 'contradicted' : supports ? 'supported' : evidence.length ? 'source_only' : 'unverified' }
}
function evidenceResolver(nodes = [], edges = []) {
  const index = new Map(nodes.map(node => [node.id, node]))
  const ledgers = nodes.filter(node => node.type === 'product').flatMap(node => [node.data?.researchAudit?.evidenceLedger || node.data?.evidenceLedger,
    ...(node.data?.researchAddenda || []).map(addendum => addendum.evidenceLedger)]).filter(Boolean)
  const claims = new Map(ledgers.flatMap(ledger => ledger.claims || []).map(claim => [claim.id, claim]))
  const sources = new Map(ledgers.flatMap(ledger => ledger.sources || []).map(source => [source.id, source]))
  const segmentMatches = (actual, expected) => !expected || !actual || actual === expected || index.get(expected)?.data?.researchSegmentId === actual
  const sourceRow = (raw, extra = {}) => {
    const resolved = typeof raw === 'string' && sources.has(raw) ? sources.get(raw) : raw
    const source = sourceOf(resolved)
    if (!source) return null
    return { id: typeof resolved === 'object' ? resolved.id || source : source, label: text(resolved?.title) || source, status: 'unverified',
      source, url: /^https?:/.test(source) ? source : null, quote: text(resolved?.excerpt), relation: 'source', kind: 'source', usable: false, ...extra }
  }
  const claimRows = (id, seen = new Set()) => {
    const claim = claims.get(id)
    if (!claim || seen.has(id)) return []
    seen.add(id)
    const rows = (claim.observations || []).map((observation, n) => {
      const original = sources.get(observation.sourceId)
      const source = sourceOf(observation.source || original)
      if (!source) return null
      return { id: `${id}:${observation.sourceId || n}`, claimId: id, label: claim.statement || id, status: claim.status || 'unconfirmed',
        source, url: /^https?:/.test(source) ? source : null, quote: text(observation.quote), kind: observation.usable === true ? 'evidence' : 'source',
        relation: observation.relation === 'refutes' ? 'contradicted_by' : 'evidenced_by', usable: observation.usable === true,
        sourceKind: observation.sourceKind || original?.kind || null, segmentId: claim.segmentId || null, subjectId: claim.subjectId,
        checkedAt: observation.retrievedAt || original?.retrievedAt || null, explanation: observation.reason || null }
    })
    for (const inputId of claim.derivation?.inputClaimIds || []) rows.push(...claimRows(inputId, seen).map(row => ({ ...row, derivedFor: id,
      ...(claim.status !== 'supported' ? { kind: 'source', usable: false } : {}) })))
    return rows.filter(Boolean)
  }
  function forDatum(datum, { nodeId, segmentId, subjectIds, includeNodeSource = true } = {}) {
    const raw = datum && typeof datum === 'object' ? datum : {}
    const data = raw.data && typeof raw.data === 'object' ? raw.data : raw
    const rows = []
    const id = nodeId || (index.has(raw.id) ? raw.id : null)
    const references = [...(Array.isArray(data.claimIds) ? data.claimIds : []), data.claimId, data.amountClaimId, data.amount?.claimId, data.pricingClaimId]
      .filter(id => id && (!subjectIds?.length || !claims.has(id) || subjectIds.includes(claims.get(id).subjectId)))
    const evidenceIds = [...(Array.isArray(data.evidenceIds) ? data.evidenceIds : []), ...(Array.isArray(data.evidenceRefs) ? data.evidenceRefs : [])]
    const links = edges.filter(edge => edge.from === id && ['evidenced_by', 'contradicted_by'].includes(edge.type))
    for (const ref of evidenceIds) links.push({ to: typeof ref === 'string' ? ref : ref.id, type: ref.relation || 'evidenced_by' })
    for (const edge of links) {
      const ev = index.get(edge.to)
      if (!ev || ev.type !== 'evidence' || !segmentMatches(ev.data?.segmentId, segmentId)) continue
      const source = sourceOf(ev.source || ev.data?.url)
      const invalid = ev.data?.legacyUnverified || ev.data?.scopeUnknown || ev.data?.verified === false
      rows.push({ id: ev.id, label: ev.label, status: ev.status || 'hypothesis', source, url: source && /^https?:/.test(source) ? source : null,
        quote: text(ev.data?.quote) || ev.label, relation: edge.type, kind: 'evidence', usable: !invalid && Boolean(source),
        claimId: ev.data?.claimId || null, sourceKind: ev.data?.sourceKind || ev.data?.origin || null, segmentId: ev.data?.segmentId || null,
        checkedAt: ev.data?.retrievedAt || null, resolvedAt: edge.data?.resolvedAt || null })
    }
    for (const ref of references) rows.push(...claimRows(ref).filter(row => segmentMatches(row.segmentId, segmentId)))
    // Claim refs can also be resolved in graphs where only evidence nodes survived.
    for (const ev of nodes.filter(node => node.type === 'evidence' && references.includes(node.data?.claimId))) {
      if (rows.some(row => row.claimId === ev.data.claimId && row.source === sourceOf(ev.source))) continue
      const source = sourceOf(ev.source)
      const link = edges.find(edge => edge.to === ev.id && (!id || edge.from === id) && ['evidenced_by', 'contradicted_by'].includes(edge.type))
      if (source && segmentMatches(ev.data?.segmentId, segmentId)) rows.push({ id: ev.id, label: ev.label, claimId: ev.data.claimId,
        status: ev.status || 'hypothesis', source, url: /^https?:/.test(source) ? source : null, quote: ev.label,
        relation: link?.type || 'source',
        kind: link ? 'evidence' : 'source', usable: Boolean(link) && ev.data?.verified === true && !ev.data?.scopeUnknown && !ev.data?.legacyUnverified })
    }
    for (const ref of [...(Array.isArray(data.sourceIds) ? data.sourceIds : []), ...(Array.isArray(data.sources) ? data.sources : []), data.source, ...(includeNodeSource ? [raw.source] : [])].filter(Boolean)) rows.push(sourceRow(ref))
    const unconfirmed = ['unconfirmed', 'hypothesis', 'unverified'].includes(data.supportStatus)
    return evidenceFields(unconfirmed ? rows.map(row => ({ ...row, usable: false, kind: 'source' })) : rows)
  }
  return { forDatum, claim: id => claims.get(id) || null, claimRows, sourceRow }
}
module.exports = { evidenceResolver, evidenceFields, sourceOf, uniqueEvidence }
