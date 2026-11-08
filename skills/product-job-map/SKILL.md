---
name: product-job-map
description: Build or update a strategic job map connecting customer goals, lower-level jobs, product contributions, limits and possible segments. Use for "which jobs should we compete for", "map customer jobs", "connect these jobs" or "where would the product need to change". Does not replace segmentation, interview extraction or UI implementation. Questions about an existing map are read operations.
user-invocable: true
---

# Map the jobs worth competing for

Help the owner see distinct areas of customer activity, their connected jobs and
the product's actual limits. The map supports choosing **a job and possible segment
to investigate**; it does not declare a winner. Follow [CONTRACT.md](../CONTRACT.md).
Do not reduce the map to a feature or skill list.

## Scope

- To explain an existing job or its source, read the relevant slice and answer.
  Do not regenerate the map, start research or write records.
- To build a map, start from the product, constraints and goal. Existing job lists,
  profiles, interviews and maps are useful inputs, not required prerequisites.
- After research, update affected jobs, links and areas. Preserve prior versions,
  evidence and directions that were not selected.

A narrow review of an ad, text or interview does not initiate a market-wide map.
Process diagrams and schedules are different tasks.

## Recover the product and inputs

Read PRODUCT.md, the current offering's capabilities and limits, authorized examples
and relevant syntheses. Separate available functionality, required changes,
external work and unknowns. Do not substitute the free edition or one familiar skill
for the whole product.

Preserve the complete input job list and its provenance. Account for every item
through a node mapping, justified merge or explicit scope exclusion. Do not replace
a long list with a handful of names. Without an input list, propose jobs from the
product's value mechanism and customers' current alternatives. Do not impose an
arbitrary quota of graphs or jobs.

If research exists, read [evidence coverage](references/evidence-coverage.md).
Collect saved respondent jobs in the product area, including people outside the
current focus. Profiles and short syntheses do not replace that inventory. Keep
each case, original wording, rationale and mapping to nodes. A job the product
cannot perform still belongs on the map as an external outcome or required change.
Keep added hypotheses distinct. Mark incomplete interview extraction as a gap;
checking saved records does not prove the original case was fully extracted.

Clarify gaps that change the map: the decision being made, what the product actually
does and which changes are permitted. Do not ask the owner to invent criteria for
hypothetical customers. Some gaps can remain unknown.

## Build connected areas

A separate AJTBD canon is not bundled in this edition. State that limitation and
use the rules below; do not copy another product's private map into the skill.

For each area, identify the desired outcome. Check both directions: **"What does
this help achieve?"** and **"Which actions could produce this outcome?"** Compare
the current method, a strong alternative and the product's contribution. Include
adjacent jobs and permitted product extensions when they open a meaningful path.

- A node names a clear customer action or outcome. "Research" or "Marketing"
  without an object is too broad. A skill, feature or output file is not itself a
  customer job. Check the title with its outcome and context; analytical wording
  need not be a verbatim customer quotation.
- A vertical edge says the lower job is a **means** to the higher one, with a
  concrete reason and condition. Sequence, chronology and similar words do not
  establish causality. Conditional alternatives are not mandatory steps for everyone.
- Reuse a node when its meaning matches, not merely its wording. One job may serve
  several outcomes, and several jobs may serve one outcome.
- Show work the product cannot do: interviews, physical actions, approvals, sales
  and releases. Available subtasks do not prove a higher outcome is complete.
- Explain the product's contribution, required inputs, current alternative, limits
  and specific changes needed. Advantage criteria may be hypotheses; do not invent
  customer preferences or measurements.
- Big/Core/Small/Micro levels depend on the product, not graph depth. An area's
  heading is not automatically its Core Job. Instructions or AI availability do not
  prove complete delivery or superiority.

Explain the chosen market slice and remaining areas. Different possibilities add
useful breadth; dozens of synonyms do not.

## Link jobs to possible customers

With existing profiles, propose exact area/job-to-profile links and explain them.
Without profiles, describe plausible people and situations as input to
[product-segment-hypotheses](../product-segment-hypotheses/SKILL.md). Do not create
empty profiles or fake IDs. Keep extension ideas visible.

A shared node does not imply shared context, criteria, priorities or purchasing
behavior. Similar graphs suggest a segmentation question, not an automatic merge.
The console reads conditions and criteria from each specific profile. Do not copy
one profile's criteria to all jobs or register map hypotheses as `performs`,
`judged_by` or customer evidence.

## Check meaning before registration

Reuse an already assigned segmentation critic when this map is part of that flow.
For a separately commissioned map, use one independent reviewer if available and
authorized. Give them the same product context, complete input list, map and
[review criteria](references/review.md). With research, include the full job
inventory and case mappings; missing respondent jobs block a completeness claim.

Respond to concrete findings and make at most two revision rounds for substantive
defects. The reviewer does not launch nested teams. Without independent review,
save an **unreviewed draft**. Review checks causal links and value explanations,
not only file shape. Keep objections and unresolved questions. Agent agreement
does not prove demand, job importance or willingness to pay.

## Deliver and hand off

Follow [the format and registration guide](references/map-format.md). Save one
readable report and a working map, run its validator, register it with graph-write
and open `#jobs` in the console. Use the standard viewer rather than a one-off
HTML/React Flow application. Preserve semantic IDs and history when updating.

Explain the areas found, where the product helps, needs changes or cannot help,
and the decision the map now supports. State whether it is a draft, semantically
reviewed or supported by research.

For a selected job/situation/segment link, pass [product-research](../product-research/SKILL.md)
its actual content: the goal, current method, expected product contribution,
external gaps and one concrete question. Attach the exact map; a path or ID list
alone is insufficient. Record the owner's choice or explicit delegation. If no
choice exists, show the options and wait. Continue already assigned parts without
asking for the same authorization again.

After accepted research, update only affected parts. New results can clarify,
split or refute links; other areas remain hypotheses. Questions about winning on
specific criteria belong with the exact segment profile. This edition has no
separate commercial valuation skill: use saved evidence honestly or state the
open question rather than fabricating an estimate.
