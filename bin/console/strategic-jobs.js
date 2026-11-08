const fs = require('node:fs')
const path = require('node:path')
const {createHash} = require('node:crypto')
const {audienceIdeas} = require('./audience-ideas')

// Strategic hypotheses are a separate document. They neither create segment jobs
// nor copy one segment's criteria to other people who might do a similar job.
function validateMap(map) {
  const fail = () => { throw new Error("Incorrect work map structure.") }
  if (map?.version !== 1 || !map.jobs || typeof map.jobs !== 'object' || !Array.isArray(map.graphs) || !map.graphs.length || map.graphs.length > 100 || Object.keys(map.jobs).length > 2000 || !Array.isArray(map.contexts)) fail()
  // scope.edition optionally names the offering coverage slot this map selects.
  // Missing keeps the legacy full default; neither value relabels job slots.
  if (map.scope?.edition != null && !['full', 'public'].includes(map.scope.edition)) fail()
  const ids = new Set()
  for (const [id, job] of Object.entries(map.jobs)) {
    if (id !== job?.id || typeof job.label !== 'string' || !job.label.trim()) fail()
    for (const edition of ['full','public']) if (!['ready','assist','change','external','unknown'].includes(job[edition]?.state) || !Array.isArray(job[edition].sources)) fail()
  }
  for (const graph of map.graphs) {
    if (ids.has(graph.id) || typeof graph.id !== 'string' || typeof graph.title !== 'string' || !graph.title.trim() || !Array.isArray(graph.jobIds) || !graph.jobIds.length || !graph.jobIds.includes(graph.id) || !Array.isArray(graph.edges)) fail()
    ids.add(graph.id)
    const jobs = new Set(graph.jobIds)
    if (jobs.size !== graph.jobIds.length || graph.jobIds.some(id => !map.jobs[id])) fail()
    const parents = new Map(graph.jobIds.map(id => [id, []]))
    for (const edge of graph.edges) { if (!jobs.has(edge.from) || !jobs.has(edge.to) || edge.from === edge.to) fail(); parents.get(edge.from).push(edge.to) }
    const finished = new Set(), stack = new Set()
    function walk(id) { if (stack.has(id)) fail(); if (finished.has(id)) return; stack.add(id); for (const parent of parents.get(id)) walk(parent); stack.delete(id); finished.add(id) }
    for (const id of jobs) walk(id)
  }
  const contexts = new Set()
  for (const context of map.contexts) {
    if (typeof context.id !== 'string' || contexts.has(context.id) || !Array.isArray(context.graphs) || context.graphs.some(id => !ids.has(id)) || !Array.isArray(context.jobIds) || context.jobIds.some(id => !map.jobs[id]) || typeof context.reason !== 'string' || !context.reason.trim()) fail()
    contexts.add(context.id)
  }
  return map
}

function strategicJobs(workspace, graph, productId) {
  const product = graph.nodes.find(n => n.type === 'product' && n.id === productId && n.status !== 'dropped' && !n.data?.retired)
  if (!product) return {state:'empty', message:"Product not found."}
  const artifacts = graph.nodes.filter(n => n.type === 'artifact' && n.status !== 'dropped' && !n.data?.retired && n.data?.artifactKind === 'strategic-job-map' && n.data.productId === productId)
  if (!artifacts.length) return {state:'empty', message:"The strategic work map has not yet been saved. It brings together possible market activities and preliminary connections with segments."}
  if (artifacts.length > 1) return {state:'error', message:"There are several valid cards saved for the product. You need to explicitly select the current one, saving the rest in the archive."}
  const artifact = artifacts[0], relative = artifact.data.mapPath
  if (artifact.data.version !== 1) return {state:'error',message:"This version of the work map is not yet supported."}
  try {
    if (typeof relative !== 'string' || !/^reports\/.+\.json$/.test(relative) || relative.includes('\\') || relative.split('/').includes('..')) throw Error()
    const root = fs.realpathSync(workspace), file = fs.realpathSync(path.resolve(root, relative))
    if (!file.startsWith(root + path.sep + 'reports' + path.sep) || !fs.statSync(file).isFile() || fs.statSync(file).size > 4 * 1024 * 1024) throw Error()
    const text = fs.readFileSync(file,'utf8')
    if (artifact.data.mapSha256 && artifact.data.mapSha256 !== createHash('sha256').update(text).digest('hex')) throw Error()
    const map = validateMap(JSON.parse(text))
    const segments = new Map(graph.nodes.filter(n => n.type === 'segment' && n.status !== 'dropped' && !n.data?.retired).map(n => [n.id,n])), ideas = new Map(audienceIdeas(workspace, graph).map(i => [i.id,i]))
    map.contexts = map.contexts.map(context => {
      const segment = segments.get(context.segmentId), idea = ideas.get(context.ideaId)
      const {criteria:_discarded, situation:_oldSituation, label:_oldLabel, href:_oldHref, ...saved} = context
      // Context and criteria come only from this exact current segment profile.
      // The strategic association itself remains a hypothesis, even when the
      // segment already has customer evidence for some other work.
      return segment ? {...saved, kind:'core', label:segment.label, situation:segment.data?.customerProfile?.context?.text || segment.data?.context || '', href:'#segment/'+encodeURIComponent(segment.id), graphHref:'#segment/'+encodeURIComponent(segment.id)+'/graph', available:true, profileCriteria:segment.data?.customerProfile?.successCriteria || [], profileSource:segment.data?.customerProfileSource || segment.source, basis:"Preliminary communication with a stored segment. The context and criteria are specified on its page."}
        : idea ? {...saved, kind:'adjacent', label:idea.title, situation:idea.benefit, href:idea.href, available:Boolean(idea.href), basis:"The idea of expansion is still out of focus. There is no detailed segment profile yet."}
        : {...saved, label:context.label || "Previously associated segment", situation:"The associated profile is no longer available.", available:false, href:null, basis:"Historical connection preserved; The current segment was not found."}
    })
    // Proposed generic checks in the original brainstorming are not customer
    // criteria. Keep the source document intact; omit them from this reading model.
    map.jobs = Object.fromEntries(Object.entries(map.jobs).map(([id,{criteria,...job}]) => [id,job]))
    return {state:'ready', id:artifact.id, productId, workspaceKey:createHash('sha256').update(fs.realpathSync(workspace)).digest('hex').slice(0,20), revision:graph.revision || 0, digest:createHash('sha256').update(text).digest('hex'), map}
  } catch { return {state:'error', message:"The saved card could not be read. Check the map file and its structure; segment profiles have not been changed."} }
}
module.exports = {strategicJobs, validateMap}
