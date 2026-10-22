const fs = require('node:fs')
const path = require('node:path')

// A saved reserve is not a set of validated segments. Only explicit deferred
// ideas are projected here; the graph's segment/status/evidence data stay intact.
function reportHref(workspace, relative) {
  if (typeof relative !== 'string' || !/^reports\/.+\.md$/.test(relative) || relative.includes('\\') || relative.split('/').includes('..')) return null
  try {
    const root = fs.realpathSync(workspace), file = fs.realpathSync(path.resolve(root, relative))
    if (!file.startsWith(root + path.sep + 'reports' + path.sep) || !fs.statSync(file).isFile()) return null
    return '/report?path=' + encodeURIComponent(relative)
  } catch { return null }
}

function audienceIdeas(workspace, graph) {
  return (graph.nodes || []).filter(node => node.type === 'artifact' && node.status !== 'dropped' && !node.data?.retired && node.data?.artifactKind === 'audience-ideas')
    .flatMap(node => (Array.isArray(node.data.ideas) ? node.data.ideas : []).filter(idea => idea?.focus === 'deferred' && typeof idea.id === 'string' && typeof idea.title === 'string' && idea.title.trim())
      .map(idea => ({
        id: node.id + ':' + idea.id,
        title: idea.title,
        benefit: typeof idea.benefit === 'string' ? idea.benefit : '',
        deferredReason: typeof idea.deferredReason === 'string' ? idea.deferredReason : '',
        href: reportHref(workspace, idea.report),
      })))
}

module.exports = { audienceIdeas }
