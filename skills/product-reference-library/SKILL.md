---
name: product-reference-library
description: Collect a reference library for a product problem or selected solutions, with concrete mechanics, images, examples, sources, independent checks and a catalog for owner selection. Use for "how do others solve this", "collect references", competitor examples or reusing an archive. Not for general market research, unsourced design or implementation.
---

# Product reference library

Give the owner examples they can inspect, trace to sources and compare: what the
person does, how the product responds and what might be useful in their own product.
Card counts and a completed workflow do not prove usefulness, demand or retention.
Do not describe a bounded archive as exhaustive.

A request for a library authorizes preparing a brief, collecting examples, reviewing
them and creating reversible local artifacts within the selected product. It does
not authorize product implementation. Respect agreed scope and access limits.

Read [the file and track contract](references/contract.md) before collection and
review. Follow CONTRACT.md and GRAPH-WRITES.md in the selected runtime. Answer
questions about existing examples from the saved library. Use
[product-research](../product-research/SKILL.md) for one testable question;
implementation requires a separate instruction.

## Define scope

Read PRODUCT.md, MOVES.md and the relevant current research through the shared
reader. Repackaging an archive may need only that archive. Inspect existing originals,
libraries and accepted brand/character profiles when relevant. An absent profile
is unknown context, not a request to create an identity.

For open exploration, first map **owner question → family of solutions → person’s
action and product response → where to find an example**. Families differ by how
they solve the problem and the outcome, not by industry or brand. Include familiar,
simple methods; a complex, well-documented example must not displace the basic case.

Choose products afterward. Search direct competitors and other categories solving
the same problem, explaining transferability. Candidates are search leads, not
verified features. An agent-created list is not an owner-imposed limit. Record the
selected families and sources in launch parameters under
[decision coverage](references/contract.md#decision-coverage). Keep breadth and
depth within the budget rather than opening every possible branch.

If instructed to inspect only named products or reuse an archive, preserve that
scope. A market-wide map, extra products and web searches are unnecessary.

Record the selection goal, product, named competitors, chosen tracks, desired depth,
per-track quotas, archives, permitted access and limits on requests, source visits
and agent calls. Unknown quotas are `null`. A quota and source verification are
separate measures. The nine built-in track names are options, not mandatory scope:
`characters`, `exercises`, `rpg`, `path`, `onboarding`, `personalization`, `progress`,
`reminders`, `ui_voice`. Other tracks need a concrete description. Do not silently
expand agreed parameters; return a material gap for a bounded scope decision.

For open search, provide `coveragePlan` with the original `request`,
`userScope: open`, `selectionBasis: mechanisms` and `families` with unique `key`,
`question` and selected `trackKeys`. For a fixed slice use `userScope: fixed` and
`selectionBasis: selected-scope`. Follow the contract's schema.

Use `mode: reuse` for indexing, copying and checking an assigned or sufficient saved
archive, without new searches or network source visits. If further collection is
assigned, use `mode: collect` for the needed gaps while preserving originals.
Keep `runKey` and `asOf`; never make an old capture appear newly collected.

Show working assumptions, their risks and significant dependencies. Clarify missing
information that changes the action while continuing independent preparation.

## Collect and verify

This edition has no BB orchestrator. Work sequentially by selected track:
preparation → collection and independent review per track → assembly of all tracks
→ independent release review. Use independent agents only when available and
authorized in the current environment.

1. **Prepare.** Save launch parameters under
   `reports/product-reference-library/<runKey>/` as a parameter log, not a narrative
   report. Reusing a run key must not overwrite completed originals.
2. **Collect.** Use available public web search and page readers. Use public-only
   access, without the user's regular browser profile, authentication, new accounts,
   purchases, messages, tool installations or remote machines. Unavailable permitted
   access is a gap, not a reason to bypass limits. Save originals under
   `sources/product-reference-library/<runKey>/` with URL, date and provenance.
   Keep raw and verified copies separate. Follow the prose ledger: short quotations
   with locators, never wholesale reproduction of sources.
3. **Review each track.** Give an authorized independent reviewer the complete track.
   They inspect files, sources, media and claims, view images and create verified
   copies and `verification.json` under the contract. They do not launch nested
   teams or write the business graph. Without independent review, save a clearly
   marked draft and do not set `registrationReady`.
4. **Assemble.** Include **all** branches, including empty, partial and rejected ones,
   in a schemaVersion 1 manifest. Deduplication, the shared prose ledger and citation
   checks need the complete set. Produce a readable `catalog.md` with examples,
   images and gaps, plus cards/sources JSON for each track.
5. **Review the release.** Check the original question and `coveragePlan`: each chosen
   family needs a suitable example or a verified blocking gap. Do not substitute an
   adjacent feature for the requested solution or omit the basic case. Without
   independent review, keep `readiness: draft` and state the limitation.
6. **Check structure.** Build the index without writing the business graph:

   ```sh
   node -e "const {buildFromManifest}=require('<tools>/bin/reference-graph.js');\
   const fs=require('fs');const workspace=process.argv[1];\
   const graph=JSON.parse(fs.readFileSync(workspace+'/research-graph.json','utf8'));\
   const manifest=JSON.parse(fs.readFileSync(workspace+'/<manifestFile>','utf8'));\
   console.log(JSON.stringify(buildFromManifest(workspace,graph,{manifestFile:'<manifestFile>',artifactId:manifest.registeredArtifactId,productId:'<productId>'}),null,2))" <workspace>
   ```

Structural or link errors block registration. After registration, `references graph`
reads the same index. Failures, null results, exceeded limits and partial results
must retain their actual status. Tests using fictional data are not live collection.

## Save and register

Preserve **competitor product → track → example → step → image and source** links.
This is an artifact index, not a new set of business segments/jobs. Index the full
saved set, including images without a complete flow. Gallery order does not prove
a transition. Shared element types connect examples only as `editor_classification`
with a rationale and the original card hash; no basis means no assignment.

For registered libraries, start with the shared reader; use the staged check above
for unregistered packages:

```sh
node <tools>/bin/product-os.js references types . productId=<productId>
node <tools>/bin/product-os.js references read . productId=<productId> track=onboarding type=target-language-selection limit=20
node <tools>/bin/product-os.js references read . productId=<productId> competitor=<id-or-name> track=onboarding
node <tools>/bin/product-os.js references read . productId=<productId> id=<referenceNodeId>
```

`read` returns parents, children, types, images, links and exact locators;
`nextCursor` retrieves the next page. The reader uses current files, discards stale
type assignments and neither searches the web nor writes the graph. A reference
does not establish `hires`/`competes_for` links or prove demand.

Save compact paths, counts, statuses, gaps, all branches and a failure log. Keep
full cards, sources, images and examples in files. One narrative summary explains
the result; catalogs, JSON, coverage reports and hash/quote ledgers are attachments.
Proposed designs for the owner's product remain separate from competitor references
with `decision: proposed`.

A failed or null required stage means `registrationReady: false`; do not register
a dependent result as delivered. A checked, readable partial library without failed
required stages can finish the research activity with `activityStatus: completed`
and `coverageStatus: partial`. Register its actual partial/draft status and preserve
access/quota gaps and negative observations. Do not overwrite a complete older
library or its graph position with an incomplete result.

Recheck the original question and `coveragePlan` before completion. Unexamined chosen
families or an unsuitable set block delivery; verified gaps permit a clearly bounded
partial result.

Register an existing `artifact` type, without inventing ontology:
`data.kind: content-pack`, `data.artifactKind: product-reference-library`, `productId`,
`libraryId`, `manifestFile`, `decision: proposed`, `readiness: ready-for-review|draft`,
`researchStatus` and exact paths. Only an explicit owner decision establishes
`accepted` with `decisionSource`. Research review and a receipt do not replace it.
Do not automatically create mechanics, competitors or actions from each card.

For a console launch, put the original `runId/nodeId/skill` in the final report
frontmatter. Apply **one** revision-checked graph-write transaction containing artifact
operations and **one** receipt for the original target. A checked, readable partial
library with `registrationReady: true` uses `outcome: completed` and explicit partial
coverage. Incomplete required stages or failed delivery use `outcome: failed` and
a concrete report/summary. Do not invent a receipt for a direct invocation. Check
the writer result and reread registration; a writer error is not a saved result.

Show what was collected and checked, where the catalog and images are, unknowns,
partial tracks and whether independent review occurred. The next step is the
owner's manual selection of examples, not automatic implementation.

## Hand off to product design

Keep observed and inferred flow boundaries separate. For each example, build or
session, record observed states, actions, responses and sourced limitations.
A single screenshot has unknown transitions. Do not merge sessions or builds.
Support manual selection against an exact snapshot and sources. AI review checks
provenance and readability; it does not accept the library for the owner. Without
an explicit design decision, references remain research materials. Do not combine
competitor collection with self-approval of a proposed design.
