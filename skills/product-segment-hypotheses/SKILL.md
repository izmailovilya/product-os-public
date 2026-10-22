---
name: product-segment-hypotheses
description: >-
  Form or revise a customer map: recognizable groups, segments and subsegments,
  with independent generator–critic debate. Use for "предложи сегменты", "пересобери
  сегментацию", "кто может пользоваться продуктом", or revising customer boundaries.
  Also explains an existing map through a scoped read; an explanation alone does not
  launch generation, subagents or a research rebuild.
user-invocable: true
---

# Customer groups and segment profiles

For an unclear broad request, clarify the intended result first and route it:
a checkable single question goes to [product-research](../product-research/SKILL.md);
a strategic job map goes to [product-job-map](../product-job-map/SKILL.md).
A scoped segmentation request comes directly here: use known product context and ask only
for consequential gaps. Missing current capabilities are not a reason to erase explicitly
in-scope applications requiring product changes.

When the owner asks for a broad audience map before choosing what to investigate,
start with about ten compact, distinct candidate situations if the scope supports them.
This is a breadth target, not a quota: explain fewer candidates and preserve alternatives
instead of inventing demographic slices. Compare who, situation/task, likely fit,
evidence and the next question. Keep the independent boundary review at this compact
level. Detailed profiles and deeper investigation follow the owner's choice or explicit
delegation to choose and continue. Preserve that instruction verbatim; a recommendation
alone is not delegated authority.

Before proposing audiences, establish the scoped offering and its capabilities/limits,
then possible tasks it can perform, then who encounters those tasks and in what situation.
Use [formation rules](references/formation-rules.md#product-fit-before-audience-generation)
for this causal account, real usage and optional pool experiments. This exploration order
does not make one segment per capability; profiles still describe recognizable people.
Use [value reasoning](references/value-reasoning.md) before formatting profiles and
during critique. Explain what becomes possible or better for the person, why the scoped
product contributes beyond a strong current alternative, and where that advantage ends.
Sources and honest uncertainty remain necessary; they do not replace that explanation.

For a broad strategic flow that also asks where to compete or what to investigate,
hand the reviewed compact candidates and the complete prior job inventory to
[product-job-map](../product-job-map/SKILL.md) before selecting focused research.
Pass product boundaries, current approaches, value hypotheses and sources, not IDs
alone. The map connects higher/lower jobs and external gaps; it neither replaces
these customer profiles nor shares their criteria. Reuse the current critic for
that map review. A segment-only or explanation request does not add this stage.
When a strategic map already exists, use it as a hypothesis input, not a confirmed
segmentation: similar graphs are a question about boundaries, not a merge rule.

Describe who uses or could use the product, how they work, why the product matters,
and how they discover, choose, pay for and keep using it. Profiles describe customers
and their practice; jobs and success criteria explain the differences between them.

- **Group:** a familiar navigation family of related customer practices.
- **Segment:** a recognizable customer practice with inclusion/exclusion signs and
  an explained difference in value, criteria, buying or implementation.
- **Subsegment:** a strict narrowing of one segment, with its own meaningful difference.

These definitions apply across products. Do not copy a fixed number or set of groups
from examples. A coherent hypothesis may have zero respondents.

## Choose the mode

- **Explain:** answer a question about the saved map from a scoped current synthesis.
  No new team, research pass or write. Explain gaps without silently rebuilding.
  Preserve the saved scope and basis. Do not fill missing criteria, priorities, roles
  or buying reasons from a plausible story; any suggested consequence is explicitly
  an inference/hypothesis, not an established property of the segment.
- **Generate/revise:** proposing new candidates, changing boundaries or rebuilding
  a map requires a lead plus **two separate roles: generator and critic**.
  Read [formation rules](references/formation-rules.md),
  [worked examples](references/few-shot-examples.md) and the
  [debate procedure](references/generator-critic.md) before assigning them.
  The lead orchestrates and adjudicates; the generator cannot approve its own map.
- **Corpus rebuild:** requires an ingested interview corpus. Product OS ships no
  interview-processing skill, so this mode is available only when a research
  registry already exists in this workspace; otherwise state that limit instead
  of imitating extraction.

An invocation requesting generation/revision delegates those two roles by default.
Respect an explicit user constraint against delegation. If an independent critic
mechanism is unavailable in your runtime, deliver a labeled **unreviewed draft**,
record the failure and do not claim independent review. Ordinary questions and
internal worker invocations never spawn another team.

## Work sequence

For a compact discovery handoff to focused research, apply steps 3–7 to short candidates.
Step 4 records only known roles/tasks and the question to investigate; do not fill a
complete journey with guesses. In step 8 save the candidate list in the run report,
not ten full graph profiles. The full profile contract below applies after selection
or when a full map/profile has explicitly been requested. Preserve unselected candidates
and use the owner's choice or explicit delegation before commercial ranking or deeper modules.
When a full cycle and selection have been delegated, continue through review, selection and
the authorized research; do not ask for the same shortlist decision again. Save the exact
delegating statement in the run decisions record, with the selected IDs and scope.

1. Read PRODUCT.md, the current relevant synthesis and the user's chosen market scope.
   Establish the full offering under investigation, including version/edition limits.
   Proactively consult the permitted workspace index for a few diverse relevant real
   applications when available; supply their context, outcome, source and limits to both
   roles. Do not make the owner enumerate every existing material or scan a private corpus.
   Missing access/index/examples is a coverage limit, not evidence against a hypothesis.
   Reuse what is known; ask only for facts that change the next action.
2. Give both roles the same product frame, capability limits, evidence packet and rules.
   Keep team claims and generated ideas labeled. The critic first assesses the input
   and then challenges the generator's complete map, including groups and nesting.
3. Derive possible tasks from those capabilities, then explore existing customers and
   plausible potential users in situations where those tasks arise. Describe WHO,
   their practice and circumstances, and the source of the candidate. Start with people
   and organizations in the result; do not produce customers by permuting jobs/features.
   For each compact candidate explain the capability, task, situation, current approach
   (observed or hypothesized), incremental value and limit, then compare its nearest neighbor.
4. For each coherent practice, describe its primary value, additional jobs, roles,
   trigger, discovery, first use, payment and repeated use. Distinguish an observed case,
   a team statement, an analyst hypothesis and an unknown. Jobs and success criteria
   explain differences; unknown priority does not become a made-up ranking.
5. Group related profiles under short, familiar navigation headings. Profession, age,
   size or pain intensity alone is insufficient to establish a useful segment. Explain
   why the boundary matters for a product or commercial decision. No candidate quota.
6. Add a subsegment only when every member satisfies the parent's definition, and it
   has its own meaningful description and distinct value,
   criteria or buying circumstances. Do not create filters, conditional calculators,
   saved parameter selections or trees of every combination. Evidence is never inherited.
7. Run challenge → explicit generator responses/revision → critic recheck → lead
   resolution. At most two repair rounds. Every proposal needs a review disposition;
   every objection needs a rule, counterexample or source, consequence and resolution.
   Preserve unresolved candidates; agreement between agents does not validate demand.
8. Save each profile using the [customer profile contract](references/customer-profile.md).
   A profile may be useful with zero respondents; generated content remains a hypothesis.
   Keep actual users, decision makers and payers separate. Do not infer our acquisition
   channel or payments from a mentioned community, feature request or competitor purchase.
9. Explain what is ready for decisions and what needs verification. The next check should
   resolve a specific material uncertainty. Do not equate descriptive completeness with
   market demand or profitability.

## Persistence

Save the map, candidate dispositions, debate and lead decisions under
`reports/segmentation/<run>/`. Keep role artifacts and existing evidence separate.
The reader-facing deliverables are the current map and decisions. Keep prompts,
revision requests and intermediate replies in `generator/` or `critic/`; mark other
working documents with frontmatter `visibility: internal`. The report list excludes
these working materials while their original URLs remain available as provenance.
Do not copy review progress into customer needs or unknowns: review completion and
customer validation are different facts.
Rejected/merged/deferred ideas remain in the ledger with their reasons. A candidate
with unknown placement stays visible as unresolved; never fabricate a parent to file it.
These review artifacts do not introduce new graph fields or automatic publication.
For a console delivery, explicitly deferred application ideas that do not yet have
full profiles can use the saved `audience-ideas` artifact contract in
GRAPH-WRITES.md. Keep their benefit, deferral reason and separate full report visible
below the current map. Do not manufacture profile fields, mark them dropped merely
for being out of focus, or derive focus from evidence strength.

Read CONTRACT.md and GRAPH-WRITES.md in this runtime. Save the report first, then use
`graph-write` for typed changes. Never edit graph JSON or MOVES manually. Stable IDs,
source history and individual facts remain intact. Use `data.customerProfile` (version 1),
with group metadata. Groups are headings, not an extra `sub_segment_of` level.
A narrower segment links to its segment parent using `basis: observable_context`,
`sharperContext` and a decision source. Jobs and criteria retain their own segment scope.
Do not create AI/expert sections in navigation: confidence describes an assertion.
Only the user's explicit experience warrants `confidence: expert`; generated candidates
use `ai`. Existing source material does not automatically validate a whole segment.

Respect capability boundaries: Core is the highest outcome the product can fully perform;
Big is the purpose above it. Other uses belong in the same customer profile when that is
how the practice works. Distinguish a known capability from a proposed product fit.

## Completion and routing

For a commissioned full customer map delivered in the console, check that every retained
profile in the current overview is actually readable in the existing segment catalog,
with its basis and working source links. Showing only the few deeply investigated profiles
is not delivery of the complete reviewed map. Reuse reviewed profile fields and keep
uninvestigated content hypothetical; do not invent missing facts to fill a card. This does
not turn compact discovery into ten full-profile runs: its overview remains in
the run report until selection, as described above. Preserve research selection separately
from which hypotheses are visible.

A question about attractiveness, budgets/margins or additional jobs that could increase
price/acquisition is a separate commercial assessment; Product OS ships no skill for it, so
answer from saved context honestly or record it as an open question — do not launch
segmentation again to imitate it.

If the requested scope includes checking public discussions or video evidence, continue
with [product-research](../product-research/SKILL.md) for that single selected question.
Access failures remain unknown, and web observations do not validate a segment.

Fast hypotheses use this skill. A selected checkable question uses product-research.
When a broader product workflow delegates segmentation here, reuse its approved scope,
budget and existing role assignments. Do not recursively launch another team from a worker.
Report the actual mechanism and review outcome; failed or missing review stays explicit.
For a plain chat run, register results with the shared writer and `complete` (no runId);
do not invent console receipts. An ordinary explanation is read-only, not a new research run.
