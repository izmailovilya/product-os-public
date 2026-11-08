---
name: product-research
description: Investigate one selected question using public sources. Find primary sources, record facts, counterarguments and unknowns, and save a sourced report in product memory. Use for "check public evidence", "what is known about" or "investigate this question". Does not replace market research or customer interviews.
user-invocable: true
---

# Investigate one question

Each run investigates **one specific question**. The owner chooses it or explicitly
delegates that choice. With delegated choice, state the question and its rationale
before starting. Narrow "research everything about the product" to one testable
question and agree it with the owner.

Follow [CONTRACT.md](../CONTRACT.md) and [GRAPH-WRITES.md](../GRAPH-WRITES.md).
Distinguish primary-source facts, attributed claims, aggregator interpretations and
your conclusions. Support substantial claims with sources; leave unknowns unknown.

## Boundaries

Do not buy data, register accounts, contact third parties or publish without an
instruction. Blog statistics, reviews and case studies do not prove demand,
willingness to pay or profitability. This skill does not replace customer interviews
or promote hypotheses to `validated`: web observations are not customer evidence.

## Process

1. **Context.** Read PRODUCT.md and the relevant saved slice: the product or segment,
   its profile and known information. Use the exact target `nodeId`.
2. **Question.** State what will be investigated, which decision the answer changes
   and what would count as an answer. If saved unknowns do not identify the question,
   return the choice to the owner instead of silently picking an interesting topic.
3. **Search.** Use available web search and page-reading tools. Prefer primary
   sources: official pages, documentation, reports, statistics, marketplaces and
   firsthand discussions. Record URLs and publication/access dates. An inaccessible
   source is a coverage gap, not zero evidence.
4. **Facts and counterarguments.** Separate what a source says, with an exact locator,
   from your interpretation. Seek disconfirming evidence. Identify isolated cases,
   vendor claims and forecasts. Do not invent numbers or transfer estimates between
   markets without justification.
5. **Independent check.** If independent review is available and authorized in the
   environment, give the reviewer the question, sources and draft conclusion. Ask
   them to verify sources, missing counterarguments and unsupported claims. Address
   confirmed findings. Otherwise mark the report **not independently reviewed** at
   the start; do not call it verified.
6. **Answer.** Explain what is established, disputed or unknown and how it changes
   the owner's next step. A negative search result is useful: record where you looked
   and what you did not find.

## Save

One run produces one report and one graph-write transaction.

1. Save `reports/research/<date>_<slug>.md` with frontmatter: `title`, `date`
   (YYYY-MM-DD), `skill: product-research`, target `nodeId`,
   `outcome: completed|partial|failed` and a 2–3 line `summary` supported by the text.
   Include the question, search scope, sourced findings, counterarguments,
   limitations, unknowns and next step. Keep quotations short and precisely located.
2. Register observations and the report through graph-write:
   - `evidence`: `{op:"evidence", target:<nodeId>, text:"...", source:"https://…",
     origin:"web", relation:"evidenced_by"}`. Use `contradicted_by` when appropriate.
     State only what was actually observed in the source.
   - `complete`: `{op:"complete", nodeId:<nodeId>, skill:"product-research",
     report:"reports/research/<file>.md", outcome:"completed"|"failed"}`.
     A truthful partial report can complete the assigned activity; preserve its
     coverage limits in the report and its frontmatter.
3. Run `--dry`, apply, then run `--check`. Reread the graph on a revision conflict.
   Never edit research-graph.json by hand.

No console launch means no receipt is needed; `complete` without `runId` does not
create one. Reading existing reports and answering status questions belongs to
`product-status` and does not start a new search.

## Deliver

Show the answer, 3–5 key source links, the main unknown and a suggested next step.
State whether independent review occurred. Link to the report under the target
node in the console using `#research/<report-path>`.
