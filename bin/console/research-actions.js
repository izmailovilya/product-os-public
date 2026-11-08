// Research actions describe a missing answer, not a request to rerun the whole map.
const COMPETITOR_GAPS = [
  { id: 'identity', label: "Specify a specific solution", reason: "The card describes a class of solutions. We need specific products and separate sources for each.", action: "Find solutions in this category", output: "Individual cards of verified products within a category; general category data will remain separate" },
  { id: 'jobs', label: "Check competitor's tasks", reason: "The intersection of client tasks does not yet show which part of the task the competitor is actually covering.", action: "Check what problems it solves", output: "For each common task: what is supported, limitations, segment and supporting sources" },
  { id: 'pricing', label: "Check price", reason: "There is no verified description of tariffs and additional costs for a specific solution.", action: "Check tariffs and costs", output: "Tariff, currency, period, unit of calculation, conditions and link to the source; implementation separately from subscription" },
  { id: 'messaging', label: "Parse communication", reason: "There is no dated snapshot of a competitor's website with its promises to customers.", action: "Take down the site and dismantle promises", output: "Dated snapshot of the site (text and screenshot in sources/competitors/), first screen, promises for segment work with verbatim quotes and a link to the snapshot" },
  { id: 'complaints', label: "Investigate complaints", reason: "Feedback and limitations of the solution have not yet been explored.", action: "Investigate reviews and complaints", output: "Specific restrictions and complaints with sources, dates and client context; separately - an area where nothing was found" },
  { id: 'channels', label: "Research promotion", reason: "It is not established where the competitor attracts customers.", action: "Explore promotion channels", output: "Watched channels, example messages and links; performance assumptions are noted separately" },
]

function dossierGaps(node, dossier = {}) {
  if (node.type === 'product') return [{
    id: 'positioning', action: dossier.positioning?.touchpoints?.length ? "Update product positioning" : "Parse product positioning",
    reason: "It is necessary to compare real promises on the website and in social networks with the tasks and customer segments.",
    output: "Current messages for each site with links and client tasks; proposals for change separate from observed facts",
  }]
  if (node.type === 'competitor' && (dossier.isCategory || node.data?.entityType === 'category')) {
    const identity = node.data?.researchSections?.identity
    return ['researched', 'not_found', 'unavailable'].includes(identity?.status) ? [] : [COMPETITOR_GAPS[0]]
  }
  const explicit = dossier.researchGaps || node.data?.researchGaps
  if (Array.isArray(explicit) && explicit.length) return explicit.filter(gap => !['not_found', 'unavailable'].includes(gap.status)).map(gap => {
    const defaults = COMPETITOR_GAPS.find(item => item.id === gap.id || item.id === gap.section) || {}
    return { ...defaults, ...gap, action: gap.action || gap.label || defaults.action }
  })
  if (node.type === 'competitor') {
    if (dossier.isCategory || node.data?.entityType === 'category') return [COMPETITOR_GAPS[0]]
    const sections = node.data?.researchSections || {}
    const has = {
      jobs: dossier.jobCoverage?.some(row => row.coverage && !['unknown', 'unverified'].includes(row.coverage)),
      pricing: dossier.priceDetails?.some(row => row.evidenceStatus === 'supported'),
      // Only a dated site snapshot closes this gap; older quote lists without a snapshot do not.
      messaging: ['captured', 'text-only', 'legacy'].includes(dossier.landing?.status),
      complaints: dossier.failures?.length > 0,
      channels: dossier.channels?.length > 0,
    }
    return COMPETITOR_GAPS.slice(1).filter(gap => !has[gap.id] && !['completed', 'not_found', 'unavailable'].includes(sections[gap.id]?.status))
  }
  if (node.type !== 'segment') return []
  const completed = node.data?.research?.['product-deep-research']?.outcome === 'completed'
  if (!completed && !node.data?.researchAudit && !dossier.jobs?.length) return [{
    id: 'initial', kind: 'segmentDefinition', action: "Clarify the task and segment boundaries", reason: "The segment is only named yet: the tasks, selection criteria and existing solutions are not described.", output: "Definition of this segment: customer situation, task, success criteria and differences from neighboring segments; the remaining segments are preserved",
  }]
  const gaps = []
  const jobs = dossier.jobs || []
  if (!jobs.length || jobs.some(job => !job.criteria?.length)) gaps.push({
    id: 'criteria', action: "Clarify success criteria", reason: "Not all tasks describe what result the client considers successful.", output: "Objective and measurable success criteria without duplicating language; sources or explicitly noted hypotheses",
  })
  if ((dossier.problems || []).some(problem => !problem.evidenceCount) || !dossier.sources?.length) gaps.push({
    id: 'evidence', action: "Check the basis of conclusions about the segment", reason: "The dossier contains findings without associated evidence. It is these statements that need to be verified and linked to sources.", output: "Affirmations and objections to specific pain points and criteria, with citations and references; list of remaining unknowns",
  })
  return gaps
}

const ISSUE_LABELS = {
  'missing-failure-test': "A way to measure the test result is not described.",
  'invalid-failure-test': "It is necessary to clarify the metric, threshold and method of measuring the result.",
  'missing-assumption': "It is not specified which assumption the problem tests.",
  'unknown-assumption': "The specified assumption was not found in the map.",
  'unknown-or-ambiguous-assumption': "The specified assumption was not found in the map or was specified in an ambiguous manner.",
  'missing-outcome': "The expected result of the task is not described.",
  'canonical-now-capacity-exceeded': "Three tasks have already been assigned for the near future. You need to choose what to transfer.",
  'research-plan-incomplete': "Study partially completed; the plan requires verification for the remaining gaps.",
}
const RESOURCE_FIELDS = { budgetUsd: "Budget", hours: "Time", people: "Number of participants" }

function explainMoveIssues(item) {
  const issues = (item.issues || []).map(issue => typeof issue === 'string' ? issue : issue.message || issue.reason || issue.code).filter(Boolean)
  const labels = issues.map(issue => ISSUE_LABELS[issue] || (
    issue.startsWith('constraint-exceeded-or-unknown:') ? `${RESOURCE_FIELDS[issue.split(':')[1]] || "Resource"} Task exceeds limit or unknown.` :
    issue.startsWith('now-move-has-pending-dependencies:') ? "The task for the near future has unfinished dependencies - wait for them or change the order." :
    /assumption|test-target/.test(issue) ? "The assumption being tested and its connection with the problem requires clarification." :
    /failure|threshold|metric|measurement|sample|deadline/.test(issue) ? "The metric, threshold, measurement method and verification period require clarification." :
    /depend/.test(issue) ? "The dependency needs to be clarified: which task should be completed first." :
    /resource|budget|capacity/.test(issue) ? "Requires a check to see if the task's resources are within the constraints." :
    /outcome|output/.test(issue) ? "The expected result of the task requires clarification." :
    /[а-яё]/i.test(issue) ? issue : "It is necessary to check the completeness of the plan and its connection with the product goal."
  ))
  if (!labels.length && item.executionReady === false) labels.push(item.testsAssumptionId
    ? "The test plan lacks a measurable result or conditions for implementation."
    : "The result, responsible person, or execution conditions have not yet been agreed upon for the task.")
  return [...new Set(labels)]
}

module.exports = { dossierGaps, explainMoveIssues }
