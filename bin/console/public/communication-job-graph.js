// Sequence is explicit per journey. Hierarchy never implies chronological order.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.CommunicationJobGraph = factory()
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function project(nodes, edges, journey, segmentId, offerIds = []) {
    const by = new Map(nodes.map(n => [n.id, n]))
    const target = (id, type) => edges.filter(e => e.from === id && e.type === type).map(e => e.to)
    const spec = journey?.data?.jobGraph
    const performed = target(segmentId, 'performs').filter(id => by.get(id)?.type === 'job')
    const served = new Set(offerIds.flatMap(id => target(id, 'competes_for')))
    const coreIds = spec ? [spec.coreJobId] : performed.filter(id => served.has(id))
    const jobIds = spec ? spec.jobIds.filter(id => by.get(id)?.type === 'job') : performed
    const transitions = spec ? spec.transitions.filter(e => jobIds.includes(e.from) && jobIds.includes(e.to)) : []
    const incoming = new Map(jobIds.map(id => [id, transitions.filter(e => e.to === id)]))
    const ranks = new Map(), visiting = new Set()
    const rank = id => {
      if (ranks.has(id)) return ranks.get(id)
      if (visiting.has(id)) return 0
      visiting.add(id)
      const result = Math.max(0, ...(incoming.get(id) || []).map(e => rank(e.from) + 1))
      visiting.delete(id); ranks.set(id, result); return result
    }
    jobIds.forEach(rank)
    const columns = new Map()
    for (const id of jobIds) { const r = ranks.get(id); if (!columns.has(r)) columns.set(r, []); columns.get(r).push(id) }
    const maxRows = Math.max(1, ...[...columns.values()].map(ids => ids.length))
    const jobs = jobIds.map(id => {
      const column = columns.get(ranks.get(id)), row = column.indexOf(id)
      const execution = edges.find(e => e.from === segmentId && e.to === id && e.type === 'performs')?.data || {}
      const criteria = [...new Set([...target(id, 'judged_by'), ...(execution.criteria || []).map(c => c.id)])].map(id => by.get(id)).filter(Boolean)
      return { ...by.get(id), criteria, context: execution.context || by.get(id).data?.context || '', x: 28 + ranks.get(id) * 310, y: 28 + row * 220 + (maxRows - column.length) * 110, core: coreIds.includes(id),
        contacts: (journey?.contactIds || target(journey?.id, 'has_contact')).map(id => by.get(id)).filter(c => c && target(c.id, 'contact_job').includes(id)) }
    })
    const motivationIds = [...new Set(jobIds.flatMap(id => target(id, 'in_order_to')))].filter(id => !jobIds.includes(id) && by.get(id)?.type === 'job')
    return { jobs, transitions, motivations: motivationIds.map(id => by.get(id)), complete: Boolean(spec),
      width: Math.max(600, columns.size * 310 + 28), height: maxRows * 220 + 28 }
  }
  function combine(journeys, edges, coreJobId) {
    const variants = journeys.filter(j => j.data?.jobGraph?.coreJobId === coreJobId)
    if (!variants.length) return null
    const jobIds = [...new Set(variants.flatMap(j => j.data.jobGraph.jobIds))]
    const links = new Map()
    for (const variant of variants) for (const e of variant.data.jobGraph.transitions) {
      const key = `${e.from}|${e.to}`
      if (!links.has(key)) links.set(key, { ...e, variantIds: [] })
      links.get(key).variantIds.push(variant.id)
      if (e.condition && !String(links.get(key).condition || '').includes(e.condition)) links.get(key).condition = [links.get(key).condition, e.condition].filter(Boolean).join(' / ')
    }
    return { id: 'combined', label: 'Все пути', contactIds: [...new Set(edges.filter(e => e.type === 'has_contact' && variants.some(j => j.id === e.from)).map(e => e.to))],
      data: { outcome: 'Разные входы одного сегмента сходятся к одной Core Job', jobGraph: { coreJobId, jobIds, transitions: [...links.values()] } } }
  }
  return { project, combine }
})
