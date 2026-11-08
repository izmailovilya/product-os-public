#!/usr/bin/env node
// Regenerate segments/*.md passports from research-graph.json (derived view, like the pages).
//   node bin/segments.js [path/to/workspace]
const fs = require('fs')
const path = require('path')
const { verificationOf } = require('./verification')
const { marketSizeScore } = require('./research-quality')

const ws = path.resolve(process.argv[2] || '.')
const g = JSON.parse(fs.readFileSync(path.join(ws, 'research-graph.json'), 'utf8'))
const by = {}; (g.nodes || []).forEach(n => { by[n.id] = n })
const E = g.edges || []
const outs = (i, t) => E.filter(e => e.from === i && e.type === t && by[e.to]).map(e => by[e.to])
// criteria of a (segment, job) pair — GRAPH.md v2: the ordered list lives on the performs edge;
// v1 graphs fall back to the job's judged_by list
const critsOf = segId => {
  const res = []
  for (const pe of E.filter(e => e.from === segId && e.type === 'performs' && by[e.to])) {
    const j = by[pe.to]
    const listed = pe.data && Array.isArray(pe.data.criteria) && pe.data.criteria.length
      ? pe.data.criteria.slice().sort((a, b) => (a.priority || 99) - (b.priority || 99)).map(c => by[c.id]).filter(Boolean)
      : null
    res.push([j, listed || outs(j.id, 'judged_by')])
  }
  return res
}
// sub-segments (GRAPH.md, sub-segments): sub --sub_segment_of--> parent,
// the delta (sharper context, added criteria, triggers) lives on that edge
const parentEdgeOf = segId => E.find(e => e.from === segId && e.type === 'sub_segment_of' && by[e.to])
const subEdgesOf = segId => E.filter(e => e.to === segId && e.type === 'sub_segment_of' && by[e.from])
const addedCritIds = segId => new Set((((parentEdgeOf(segId) || {}).data || {}).addedCriteria || []).map(c => c.id))
const ST = { hypothesis: "hypothesis", evidenced: "there is field evidence", validated: "confirmed in the field", contradicted: "REFUSED", dropped: "discarded" }
const CV = { hypothesis: "hypothesis", evidenced: "confirmed by field", validated: "verified with clients", contradicted: "REFUSED" }
const ins2 = (i, t) => E.filter(e => e.to === i && e.type === t && by[e.from]).map(e => by[e.from])
// «What are they deciding now? - own segment list from the field: segment --hires--> competitor
// (including “with your own hands” and “do nothing”). Absent in old graphs - then
// old is printed data.currentSolutions.
const HIRE_KIND = { direct: "direct competitor", indirect: "indirect", diy: "do it yourself", do_nothing: "do nothing" }
const HIRE_PREV = { dominant: "most often", common: "often", rare: "rare" }
const PREV_ORDER = { dominant: 0, common: 1, rare: 2 }
const hiresOf = segId => E.filter(e => e.from === segId && e.type === 'hires' && by[e.to])
  .map(e => ({ n: by[e.to], d: e.data || {} }))
  .sort((a, b) => (PREV_ORDER[a.d.prevalence] ?? 9) - (PREV_ORDER[b.d.prevalence] ?? 9))
// people and segment budget (GRAPH: peopleCount / spendTodayUsdMonthly / impliedAnnualSpendUsd) —
// Printed as trailing numbers only > 0; zero or empty = «not counted", not «0»
const BASIS = { sourced: "according to source", derived: "calculation from sources" }
const posNum = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
const fmtInt = n => Math.round(n).toLocaleString('en-US')

// ---------- small formatting helpers shared by the passport ----------
const isHttp = u => /^https?:\/\//i.test(String(u))
const money = v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${Math.round(v / 1e6)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`

// «how the numbers are counted” - output of each counted digit with substituted numbers, one
// list of strings (markdown-bold), which md-the passport prints as is, but html — how <p>.
// Arithmetic is fixed in code; the agent's evaluation inputs are honestly called evaluations.
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null
const knownNum = (v, d) => d.scoringVersion === 2 ? num(v) : posNum(v)
const SATUR = { low: "low", medium: "medium", high: "high" }
const marketSizeScoreView = marketSizeScore

function calcExplainLines(d) {
  const b = d.scoringBreakdown || {}
  const c = b.computed || {}
  const f = b.forces || {}
  const comp = b.competition || {}
  const adv = b.advantage || {}
  const fe = b.fieldEvidence || {}
  const eco = d.economics || {}
  const P = []
  const sw = num(c.switchScore ?? d.switchScore)
  if (sw !== null && num(f.addedValue) !== null)
    P.push(`**Ready to switch = ${sw}.** (value of new ${num(f.addedValue)} + severity of pain ${num(f.problemSeverity)}) − (transition barriers ${num(f.barriers)} + force of habit ${num(f.habitStrength)}). More 50 — actively looking for a replacement, less 0 — hold on to the current. Four forces (0–100) — Agent's estimates of field finds.`)
  const price = num(eco.monthlyPriceUsd), cogs = num(eco.monthlyCogsUsd), life = num(eco.lifetimeMonths), cac = num(eco.cacUsd), ltv = num(d.ltvToCac)
  if (d.scoringVersion === 2) {
    const scenario = d.economicScenario || {}
    P.push(scenario.status === 'scenario'
      ? `**Economic scenario:** (price $${price}/month − cost $${cogs}/month) × ${life} month = $${scenario.contribution} marginal income; CAC $${cac}. LTV:CAC: ${ltv ?? "undefined when CAC = 0"}. Contribution margin range: $${scenario.range?.contribution?.low}–$${scenario.range?.contribution?.high}. This is a script according to the specified sources, not a promise of return on investment.`
      : `**Economy unknown.** Not enough validated inputs: ${(scenario.missing || []).join(', ')}. The customer's costs for alternatives do not determine the price of our product.`)
  } else if (d.economicsUnpriced)
    P.push(`**Economy was not considered.** There is no real price - neither in the price list of the product, nor in what the segment is paying now - and it is prohibited to calculate using a fictitious figure. The weight of the economy in the overall score has been redistributed to other assessments.`)
  else if (ltv !== null && price !== null && cogs !== null && life !== null && cac !== null) {
    const amppu = num(c.amppuUsd) ?? Math.round((price - cogs) * life)
    const basis = eco.priceBasis === 'product-pricing' ? " Price - from the real price list of the product." : eco.priceBasis === 'customers-pay-today' ? " Price is what the segment is already paying for current solutions." : ''
    P.push(`**LTV:CAC = ${ltv}.** Income per client for the entire time: (price $${price}/month − cost $${cogs}/month) × lifetime ${life} month = $${amppu}. Divide by the cost of attraction $${cac} → ${ltv}: every $1, nested in attraction, returns ~$${ltv}.${basis}${eco.priceSource ? ` Where does the price come from?: ${eco.priceSource}.` : ''}`)
    if (eco.calculation) P.push(`**How the input numbers were evaluated:** ${eco.calculation}`)
  }
  const total = num(d.totalScore), vd = num(c.valueDelivery), cs = num(c.competitionScore), as2 = num(c.advantageScore), eh = num(c.econHealth)
  const ms = num(c.marketScore) ?? (num(d.somValueUsd) !== null ? marketSizeScoreView(num(d.somValueUsd)) : null)
  if (total !== null && vd !== null && cs !== null && as2 !== null) {
    P.push(d.scoringVersion === 2
      ? `**Attractiveness ${total}/100.** (0,20 × market ${ms ?? '—'} + 0,30 × value ${vd} + 0,15 × competition ${cs} + 0,10 × advantage ${as2}) / 0,75. The economic scenario is considered separately for all segments. Subjective components - estimates, not measured probabilities.`
      : (d.economicsUnpriced || eh === null)
      ? `**Point ${total}/100.** Weighted sum: 20% market size (${ms ?? '—'}) + 30% value versus alternatives (${vd}) + 15% freedom from competitors (${cs}) + 10% uniqueness and barriers (${as2}); an economy without a price was not considered - its 25% weights distributed to others. The formula is the same for all segments and is written into the code.`
      : `**Point ${total}/100.** Weighted sum: 20% market size (${ms ?? '—'}) + 30% value versus alternatives (${vd}) + 25% economic health (${eh}) + 15% freedom from competitors (${cs}) + 10% uniqueness and barriers (${as2}). The formula is the same for all segments and is hardcoded into the code.`)
    const bits = []
    if (num(comp.competitorCount) !== null) bits.push(`−5 for each of ${num(comp.competitorCount)} competitors (maximum −50)`)
    if (comp.hasGiants) bits.push("−25 for the giants in the market")
    if (comp.hasMediumPlayers) bits.push("−15 for average players")
    if (SATUR[comp.saturation]) bits.push(`−${comp.saturation === 'high' ? 20 : comp.saturation === 'medium' ? 10 : 0} for saturation (${SATUR[comp.saturation]})`)
    if (bits.length) P.push(`**Freedom from competitors = ${cs}.** Start from 100, next ${bits.join(', ')}; total is within limits 0–100.`)
    if (num(adv.uniqueness) !== null) P.push(`**Uniqueness and barriers = ${as2}.** Uniqueness ${num(adv.uniqueness)}/100 × 0,6 + barriers to copying («${String(adv.barriersToEntry || '—')}») × 0,4 — agent assessment based on facts about competitors.`)
  }
  if (num(fe.total)) P.push(`**Signal from open sources: ${Math.round((num(fe.ratio) ?? 0) * 100)}% criteria.** From ${num(fe.total)} other people's reviews on the network met the hypothesis criteria ${num(fe.evidenced) ?? 0}${num(fe.contradicted) ? `, contradict ${num(fe.contradicted)}` : ''}. This is the gate 2 («there is a problem in the market"), not confirmation by our customers.`)
  // people × budget - from sources, not from head; the field exists but is empty → honest "not counted"»
  const people = knownNum(d.peopleCount, d), spend = knownNum(d.spendTodayUsdMonthly, d), annual = knownNum(d.impliedAnnualSpendUsd, d)
  if (people !== null) P.push(`**People in the segment = ${fmtInt(people)}.** ${BASIS[d.peopleBasis] || (d.peopleBasis ? String(d.peopleBasis) : "base not specified")}${d.peopleSource ? ` — source: ${d.peopleSource}` : ''}.`)
  else if (d.peopleCount !== undefined) P.push("**People: not counted.** There was no source with the number of people in the segment - we are not making up the number.")
  if (spend !== null) P.push(`**Budget for task = $${fmtInt(spend)}/month.** How much does one client pay today for current solutions${BASIS[d.spendBasis] ? ` — ${BASIS[d.spendBasis]}` : d.spendBasis ? ` — ${String(d.spendBasis)}` : ''}${d.spendSource ? `; source: ${d.spendSource}` : ''}.`)
  else if (d.spendTodayUsdMonthly !== undefined) P.push("**Budget for the task: not calculated.** The actual amount that the segment pays today is not available in the sources.")
  if (annual !== null) P.push(`**≈ ${money(annual)} per year across the segment.** ${people !== null && spend !== null ? `People ${fmtInt(people)} × budget $${fmtInt(spend)}/month × 12 month.` : "People × budget × 12 months."} This is what the segment is already spending on the task, not our income.`)
  return P
}
const dir = path.join(ws, 'segments')
fs.mkdirSync(dir, { recursive: true })
let count = 0
const ins = (i, t) => E.filter(e => e.to === i && e.type === t && by[e.from]).map(e => by[e.from])
const switchWords = v => v > 50 ? "actively looking for a replacement" : v >= 0 ? "eyeing a replacement" : "hold on to the current (inertia)"
for (const s of (g.nodes || []).filter(n => n.type === 'segment')) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(s.id))) { console.warn(`Skipping segment with unsafe id: ${s.id}`); continue }
  const jobs = outs(s.id, 'performs')
  const d = s.data || {}
  const L = [`# ${s.label}`, '',
    `*Status: **${ST[s.status] || s.status || '—'}** · profile assembled from research-graph.json · id: \`${s.id}\`*`, '']
  // subsegment ("country"): header with a link to the parent + what exactly adds context
  const parentE = parentEdgeOf(s.id)
  if (parentE) {
    const parent = by[parentE.to]; const pd = parentE.data || {}
    L.push(`**Subsegment [${parent.label}](./${parent.id}.md)** — ${pd.basis==='observable_context'?"more specific circumstances within the group; tasks and criteria are determined by conditions; confirmation of demand is not inherited.":"refinement of the previous criteria model; the order requires verification by sources."}`, '')
    if (pd.sharperContext) L.push(`- **The more acute the context:** ${pd.sharperContext}`)
    if (pd.triggers && pd.triggers.length) L.push(`- **Purchase entry triggers:** ${pd.triggers.join('; ')}`)
    const addedLbl = (pd.addedCriteria || []).map(c => by[c.id]).filter(Boolean).map(c => `«${c.label}»`)
    if (addedLbl.length) L.push(`- **Criteria this context adds:** ${addedLbl.join(', ')}`)
    L.push('')
  }
  if(d.customerProfile){
    const p=d.customerProfile, basis={hypothesis:"hypothesis",team:"according to the command",research:"based on materials",unknown:"unknown"}
    const fact=f=>`${f.text} (${basis[f.basis]}; ${f.sourceRefs.join(', ')||"source not linked"})`
    L.push(`**Group: ${p.group.label}**`,'',fact(p.summary),'',fact(p.context),'')
    for(const [title,f] of [["How to find out",p.recognition],["Why is it highlighted separately?",p.whySeparate],["Main task",p.primaryJob],["Product contribution",p.productFit],["Current solutions",p.alternatives]])L.push(`## ${title}`,'',fact(f),'')
    for(const [title,items] of [["Success criteria",p.successCriteria],["Other tasks",p.otherJobs]])L.push(`## ${title}`,'',...items.map(f=>'- '+fact(f)),'')
    L.push("## How they come and stay",'')
    for(const [key,title] of [['trigger',"A reason to look for"],['discovery',"Where will they find out"],['firstUse',"First try"],['purchase',"Payment"],['retention',"Reuse"]])L.push(`- **${title}:** ${fact(p.journey[key])}`)
    L.push('',"## Roles",'');for(const [key,title] of [['user',"In use"],['decisionMaker',"Selects"],['payer',"Pays"]])L.push(`- **${title}:** ${fact(p.roles[key])}`)
    L.push('',"## What to find out",'',...p.unknowns.map(t=>'- '+t),'')
  }
  // headline numbers — everything the research already computed
  const facts = []
  if (d.rank) facts.push(`**rank ${d.rank}**` + (num(d.totalScore) !== null ? ` (point ${d.totalScore}/100)` : '') + (d.scoringVersion === 2 && !d.ranking?.stable ? " - preliminary order" : ''))
  if (d.totalScoreRange) facts.push(`attractiveness range: ${d.totalScoreRange.low}–${d.totalScoreRange.high}/100`)
  if (d.researchReview && d.researchReview.decision !== 'retain') facts.push(`segment boundaries require checking: ${d.researchReview.reason}`)
  if (num(d.switchScore) !== null) facts.push(`ready to switch: ${switchWords(d.switchScore)}`)
  if (d.economicsUnpriced) {
    facts.push("**economy was not considered - there is no real price** (it does not participate in the segment score)")
  } else if (Number.isFinite(d.ltvToCac)) {
    const eco = d.economics || {}
    const detail = [eco.monthlyPriceUsd && `price $${eco.monthlyPriceUsd}/month`, eco.lifetimeMonths && `lifetime ${eco.lifetimeMonths} month`, eco.cacUsd && `CAC $${eco.cacUsd}`].filter(Boolean).join(', ')
    facts.push(`economics LTV:CAC ≈ ${d.ltvToCac}` + (detail ? ` (${detail})` : ''))
  }
  if (num(d.somValueUsd) !== null) facts.push(`reachable market (SOM): ${money(d.somValueUsd)}` + (d.tamValueUsd ? ` from ${money(d.tamValueUsd)} total` : ''))
  {
    const people = knownNum(d.peopleCount, d), spend = knownNum(d.spendTodayUsdMonthly, d), annual = knownNum(d.impliedAnnualSpendUsd, d)
    if (people !== null) facts.push(`people in the segment: ${fmtInt(people)}` + (BASIS[d.peopleBasis] ? ` (${BASIS[d.peopleBasis]})` : ''))
    if (spend !== null) facts.push(`budget for the job: $${fmtInt(spend)}/month - paid today`)
    if (annual !== null) facts.push(`≈ ${money(annual)} per year for the entire segment (people × budget)`)
  }
  const ver = verificationOf(s.id, g.nodes, E)
  facts.push(`**studied on ${ver.percent}%** — gate ${ver.passed} from ${ver.total}` + (ver.blockedAt ? ` — **STOP: ${ver.blockedReason}**` : ''))
  if (facts.length) L.push(facts.map(f => `- ${f}`).join('\n'), '')
  const calcLines = calcExplainLines(d)
  if (calcLines.length) L.push("## How the numbers are calculated", '', calcLines.map(l => `- ${l}`).join('\n'), '')
  L.push("## Learning Gate - what is 100%", '',
    "*100% = criteria, fatal assumptions, payment behavior and economics examined. Knowledge also gives a negative result; percentage of knowledge does not mean profitability.*", '')
  for (const gt of ver.gates) L.push(`- ${gt.blocked ? '✕' : gt.done ? '✓' : gt.partial ? '◐' : '—'} **${gt.label}** (${gt.earned}/${gt.weight}) — ${gt.detail}`)
  if (ver.blockers.length) L.push('', "**Risks based on study results:**", '', ...ver.blockers.map(b => `- ${b.reason}`))
  if (ver.next) L.push('', `**Will open «${ver.next.label}»:** ${ver.next.unlock}`)
  L.push('')
  if (d.context) L.push("## Who is this", '', d.context, '')
  // buying group: segment --involves--> role; the role's own jobs hang on its performs edges
  const INFL = { decides: "decides", approves: "approves the budget", vetoes: "may block (veto)", champions: "promotes from within", blocks: "against - can sabotage", uses: "enjoys" }
  const roleEdges = E.filter(e => e.from === s.id && e.type === 'involves' && by[e.to])
  if (roleEdges.length) {
    L.push("## Who decides (roles in the purchase)", '')
    for (const re of roleEdges) {
      const role = by[re.to]; const rd = re.data || {}
      const rjobs = outs(role.id, 'performs')
      const personal = rjobs.filter(j => (j.data || {}).personal)
      const business = rjobs.filter(j => !(j.data || {}).personal)
      L.push(`- **${role.label}** — ${INFL[rd.influence] || rd.influence || ''}`)
      if (business.length) L.push(`  - business work (justifies purchase): ${business.map(j => j.label).join('; ')}`)
      if (personal.length) L.push(`  - personal work (really decided): ${personal.map(j => j.label).join('; ')}`)
      if (rd.convincedBy) L.push(`  - how to convince: ${rd.convincedBy}`)
    }
    if (d.approvalProcess) L.push('', `How is the approval going?: ${d.approvalProcess}`)
    if (d.budgetCycle) L.push(`Budget cycle: ${d.budgetCycle}`)
    L.push('')
  }
  L.push("## What are they trying to do (work)", '')
  for (const j of jobs) {
    const up = outs(j.id, 'in_order_to')
    L.push(`- **${j.label}**` + (up.length ? ` — for the sake of: ${up[0].label}` : ''))
  }
  L.push('', "## How success is judged (criteria for this segment, by priority, with field verdicts)", '')
  const segCrits = critsOf(s.id)
  const addedHere = addedCritIds(s.id)
  for (const [, critList] of segCrits) {
    for (const c of critList) {
      const lvl = (c.data || {}).level || ''
      let line = `- «${c.label}»` + (lvl ? ` — threshold: ${lvl}` : '') + ` — *${CV[c.status] || c.status || "hypothesis"}*`
        + (c.data?.evidenceConflict ? " - there is conflicting evidence" : '')
        + (c.data?.levelStatus === 'unconfirmed' ? " — threshold not confirmed" : '')
        + (c.data?.priorityStatus === 'unconfirmed' ? " — hypothetical priority" : '')
        + (addedHere.has(c.id) ? " - **added by the acute context of this country**" : '')
      for (const ev of [...outs(c.id, 'evidenced_by'), ...outs(c.id, 'contradicted_by')]) {
        line += `\n  - quote: ${ev.label}` + (/^https?:/.test(ev.source || '') ? ` (${ev.source})` : '')
      }
      L.push(line)
    }
  }
  // subsegments: same main job, sharper context adds criteria
  const subEs = subEdgesOf(s.id)
  if (subEs.length) {
    L.push('', "## Subsegments", '',
      "*Same main job and same main criteria; The segment is won country by country.*", '')
    for (const se of subEs) {
      const sub = by[se.from]; const sd = se.data || {}
      const addedLbl = (sd.addedCriteria || []).map(c => by[c.id]).filter(Boolean).map(c => `«${c.label}»`)
      L.push(`- **[${sub.label}](./${sub.id}.md)** — *${ST[sub.status] || sub.status || "hypothesis"}*`)
      if (sd.sharperContext) L.push(`  - the more acute the context: ${sd.sharperContext}`)
      if (addedLbl.length) L.push(`  - adds criteria: ${addedLbl.join(', ')}`)
      if (sd.triggers && sd.triggers.length) L.push(`  - triggers: ${sd.triggers.join('; ')}`)
    }
  }
  if (d.qualificationQuestions && d.qualificationQuestions.length) {
    L.push('', "## How to recognize them (qualification questions)", '')
    d.qualificationQuestions.forEach(q => L.push(`- ${q}`))
  }
  const hires = hiresOf(s.id)
  if (hires.length) {
    L.push('', "## What are they deciding on now?", '',
      "*Finds and hypotheses about current segment decisions; prevalence requires separate sampling.*", '')
    for (const h of hires) {
      const nm = isHttp(h.n.source) ? `[${h.n.label}](${h.n.source})` : h.n.label
      const bits = [HIRE_KIND[h.d.kind] || (h.d.kind ? String(h.d.kind) : ''), HIRE_PREV[h.d.prevalence] || ''].filter(Boolean)
      L.push(`- **${nm}**${bits.length ? ` — ${bits.join(', ')}` : ''}`)
      if (h.d.supportStatus && h.d.supportStatus !== 'supported') L.push(`  - hiring not confirmed: ${h.d.supportStatus}`)
      if (h.d.categoryObservation) L.push("  - category mentioned this company; category expenses do not apply to the company")
      if (h.d.spendToday) L.push(`  - pay today: ${h.d.spendToday}`)
      if (h.d.whyHired) L.push(`  - what do they charge for?: ${h.d.whyHired}`)
      if (isHttp(h.d.source)) L.push(`  - source: ${h.d.source}`)
    }
  } else if (d.currentSolutions && d.currentSolutions.length) {
    L.push('', "## What are they deciding on now?", '')
    d.currentSolutions.forEach(cs => L.push(`- ${cs}`))
  }
  const probs = outs(s.id, 'suffers')
  if (probs.length) { L.push('', "## What hurts them with current solutions", ''); probs.forEach(p => L.push(`- ${p.label}`)) }
  const chans = E.filter(e => e.from === s.id && e.type === 'reached_via' && by[e.to])
  if (chans.length) { L.push('', "## Where to look for them (channels)", ''); chans.forEach(e => {
    const channel = by[e.to], details = e.data || {}
    L.push(`- ${channel.label}${details.tactic ? ` — ${details.tactic}` : ''}${details.supportStatus && details.supportStatus !== 'supported' ? " (hypothesis)" : ''}`)
    if (details.hook) L.push(`  - message for this segment: ${details.hook}`)
  }) }
  // segment-level risky assumptions + which move tests each
  const risks = ins(s.id, 'about').filter(n => n.type === 'assumption')
  if (risks.length) {
    L.push('', "## Risks of this segment (which should be true)", '')
    for (const r of risks) {
      const mv = ins(r.id, 'tests')
      L.push(`- «${r.label}»${(r.data || {}).fatal ? " - **fatal if false**" : ''}` +
        (mv.length ? `\n  - checked by progress: ${mv[0].label}` : ''))
    }
  }
  // competitors fighting for this segment's jobs (via competes_for, excluding the product)
  const compSet = new Map()
  for (const j of jobs) for (const c of ins(j.id, 'competes_for')) if (c.type === 'competitor') compSet.set(c.id, c)
  if (compSet.size) {
    L.push('', "## Who is already competing for these jobs", '')
    for (const c of compSet.values()) {
      const cd = c.data || {}
      L.push(`- ${c.label}${cd.kind === 'direct' ? " - **direct**" : ''}${cd.pricing ? ` — ${cd.pricing}` : ''}`)
    }
  }
  const comm = d.communication
  if (comm) {
    L.push('', "## Communication with segment", '',
      "*Ready formulations based only on confirmed criteria and real weaknesses of competitors. Drafts - test before publication.*", '')
    const bucket = (title, items) => {
      if (!items || !items.length) return
      L.push(`### ${title}`, '')
      for (const c of items) L.push(`- **${c.title}**${c.readyToUse === false ? " (test hypothesis)" : ''}${c.role ? ` *(for: ${c.role})*` : ''} — «${c.message}»\n  - why it will work: ${c.why}`)
      L.push('')
    }
    bucket("Deliver value", comm.value)
    bucket("Relieve fears", comm.fears)
    bucket("Arguments against competitors", comm.competitorCounters)
  }
  if (d.valueIdeas && d.valueIdeas.length) {
    L.push('', "## What to do - value ideas for this segment", '',
      "*Ideas, not obligations: take on work - through prioritization, in MOVES.md.*", '')
    for (const v of d.valueIdeas) {
      L.push(`- **${v.title}** — in pain: ${v.pain}`)
      for (const st of (v.steps || [])) L.push(`  - ${st}`)
      if (v.outcome) L.push(`  - **effect:** ${v.outcome}`)
      if (v.riskiestPart) L.push(`  - **based on unverified:** ${v.riskiestPart}`)
    }
  }
  L.push('', "*Passport is generated from research-graph.json; Make edits there/through the tools, otherwise they will be overwritten.*", '')
  fs.writeFileSync(path.join(dir, `${s.id}.md`), L.join('\n'))
  count++
}
console.log(`Wrote ${count} segment passport(s) (md) to ${dir}`)
