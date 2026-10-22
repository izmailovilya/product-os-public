# Reference library file and research contract

Read this when preparing a brief, writing files, verifying a direction, assembling
or finalizing the library. It supplements the runtime CONTRACT.md/GRAPH-WRITES.md.
The purpose is a reusable, inspectable catalog for a human's manual choice.

When selecting new collection sources, use [source-guide.md](source-guide.md) to
match the owner's question to flow recordings, screen libraries, visual styles
or templates. The guide is a discovery aid, not a required site checklist or an
access grant. Fixed scope and reuse retain their existing boundaries.

## Scope, dates and access

- Origin supplies productId, libraryId, purpose/productContext, unique runKey and
  real asOf (YYYY-MM-DD); the collecting agent must take it from the owner or saved context, not guess. Original capturedAt and
  actual source publication/build dates are separate and may be unknown.
- Before freezing an open request, origin selects products from the decision and
  functional mechanism families, including transferable analogues when authorized.
  An agent's initial shortlist is not a user restriction. Once frozen, collection uses
  explicit selected competitors and directions only. All nine common directions
  are candidates, not defaults selected for every product. A custom direction has
  its own brief, competitors, quotas and allocated verification work.
- Reuse mode reads existing originals, indices and captures without repeat network
  research. Changed originals are new versions, not corrected in place. A stored
  snapshot does not establish that a live source was reopened or remains current.
- Collection mode permits public-only tools or an explicitly authorized isolated
  sandboxed headless browser, including its narrowly specified scope. No ordinary
  browser profiles/desktop apps/system Chrome, unsandboxed Chrome, credential/auth
  extraction, new logins/accounts, installs, remote execution, spending, messaging,
  publication or product implementation. Unavailable safe access stays a gap.
- All paths are workspace-relative under reports/ or sources/. Check realpath and
  symlink containment. No mutation of existing originals, graph or MOVES by verifier subagents.
  Store new run outputs under reports/product-reference-library/<runKey>/ and
  sources/product-reference-library/<runKey>/; keep raw and verified directories
  separate.
- Verify returns the collector's exact `rawArchivePath`, bound by a native schema
  constant; a checked derivative index is a separate file referenced by the
  verification or coverage record. It must not replace the original binding.
  `checks.proseLedger` is the audited local direction check, not the pending
  cross-direction assembly check. Real local excess remains a failed check.
  Delivery review saves and returns the run's `delivery-review.json`; a human
  `delivery-review.md` may accompany it. Its manifest binding is also schema-bound.
- Product OS runs the collection natively in the user's agent, without an orchestration
  engine: the same file contracts, coverage plan and independent-verification gates
  apply. Respect the user's model choice and budget; do not hard-code a
  provider/model into reference-collection rules, silently buy extra access or add
  a model fallback. If an independent verifier (subagent or second agent instance)
  is unavailable, the run stays an honest draft and never claims independent review.

## Decision coverage

For open mechanism discovery, origin supplies `coveragePlan` before launching:

```json
{
  "request": "Collect reference mechanisms for this fictional user difficulty.",
  "userScope": "open",
  "selectionBasis": "mechanisms",
  "families": [
    {"key": "fictional-mechanism", "question": "Which action resolves the selected user difficulty?", "trackKeys": ["custom-direction"]}
  ]
}
```

Families are functional alternatives needed for the owner's decision, not a list
of companies or industries. Consider simple conventional alternatives before
choosing source products; do not hardcode one industry's answer for every task.
For an explicitly fixed selection use `userScope: fixed` and
`selectionBasis: selected-scope` (or `mechanisms` when relevant within that slice).
Legacy fixed-scope runs without this optional field remain supported. Reuse never
authorizes new retrieval or products. User constraints take precedence over breadth.

Carry the same plan through preparation, collection, verification, assembly and
review. Assembly saves `decisionCoveragePath` and manifest.decisionCoveragePath,
copies coveragePlan into the manifest and binds the sidecar into owner-handoff.
The sidecar has schemaVersion 1 and one entry per family with `key`, `status`,
`cardIds`, `evidenceRefs`, and `reason` (null only when covered). Status is one of
`covered`, `searched-no-example`, `access-blocked`, `not-searched`. Covered entries
point to actual supported cards; searched/access gaps point to concrete search or
access evidence. They are not evidence that a feature does not exist.

The independent reviewer compares the original decision question, plan, sidecar
and actual cards. It returns `checks.decisionCoverage` and `decisionCoverage`:
`planMatched`, `usefulForDecision`, `missedBaselines` (strings), `families` (the
checked sidecar entries). It tests whether adjacent functionality substituted for
the requested mechanism and whether simple baseline alternatives were missed.
Do not infer content fit from file validity, card counts or the collector's PASS.

With a plan, missing outputs, mismatched families, unsupported coverage or an
unsearched selected family block delivery. A documented searched/access gap can
pass as partial when the remaining catalog is useful for the decision. Any such
gap keeps overall coverage partial even if every direction met its numerical quota.
No plan or AI verdict constitutes owner acceptance or permission to implement.

## Console manifest and cards

The console uses the existing artifact with artifactKind: product-reference-library.
Use this schemaVersion 1 manifest; optional sidecars remain optional:

```json
{
  "schemaVersion": 1,
  "productId": "fictional-product",
  "libraryId": "fictional-library",
  "title": "Selected examples",
  "status": "partial",
  "tracks": [{
    "key": "exercises", "title": "Exercise mechanisms",
    "cardsPath": "reports/product-reference-library/run-01/verified/exercises/cards.json",
    "sourcesPath": "reports/product-reference-library/run-01/verified/exercises/sources.json",
    "coveragePath": "reports/product-reference-library/run-01/verified/exercises/coverage.json",
    "verificationPath": "reports/product-reference-library/run-01/verified/exercises/verification.json",
    "reportPath": "reports/product-reference-library/run-01/verified/exercises/catalog.md"
  }],
  "gaps": ["Retry was not captured"]
}
```

Cards files: `{schemaVersion:1, cards:[...]}`. Every retained card has:

- id, track, product: {id,name,platform,version,accessMode}; version/platform
  unknown stays null/unknown. Keep product genre and actual capture session/build
  in source/capture provenance; an app and a game are different genres.
- title, description, observationType; sourceIds, primarySourceId linking actual
  records in the track's `{schemaVersion:1,sources:[...]}` source file.
- media: [{id,path,sourceId,caption,alt,locator,width,height}]. Every media file has
  imageSHA256, authentic source/capture origin, media kind and visualInspection
  (who checked what, asOf, result, notes) in the record or linked audit. Preserve
  locator/frame/timestamp/crop; generated illustrative art cannot be competitor
  evidence. Check actual encoded dimensions, file type and displayed image.
- steps: [{order,title,whatHappens,userAction,productResponse,purpose,purposeBasis,
  screenshotIds}]. Purpose is often editor_inference; label it. Missing response
  stays null. Orders and screenshotIds refer to actual observations, not a
  fabricated sequence made from unrelated screens, sessions or versions.
- details, claims, gaps, verification, adaptation. Each material claim retains
  its source ID/URL, exact locator, basis (observed/source-claim/inference/proposed),
  support status and checks. Adaptation is a proposed application with assumptions,
  dependencies/risks; it is not observed competitor behavior or customer evidence.
- canonicalExampleId for a specific observed example. Match identity on source,
  build/session, mechanism/rule and locator, not a fuzzy title. imageSHA256 can
  identify identical media across directions while keeping distinct rules.

Sources retain URL/permalink, type, author/publisher when known, capturedAt,
publishedAt, source locator and archived workspace path plus sha256 of bytes.
Collector summaries/snippets are discovery pointers, never evidence of opened
originals. Local source captures share their original URL's attribution budget.
Full source excerpts are private original archives, not mass-reproduced in catalogs.

Each checked direction includes a HUMAN-readable catalog with concrete source
examples, images, readable labels, full observed interaction/rule and gaps, plus
machine records and source ledger. File downloads alone are not a readable catalog.
One captured generic exercise screen is shown as an image with known fields,
without an invented flow or forced specialized exercise renderer.

## Direction-specific detail (only for selected directions)

| Key | Required captured detail; unavailable detail stays unknown |
| --- | --- |
| characters | Actual portrait; personality/role; all known facts with sources; actual interaction/dialogue; memory, relationship and behavior limits. No invented biography or unsolicited character art. |
| exercises | Group by actual observable mechanism. Concrete stimulus, action, response/feedback, retry and outcome; fully captured A → model → B → comparison only when available. Source worked examples and few-shots retain original locators. No grouping by arbitrary theme/taxonomy ID. |
| rpg | Selected relevant apps and games. Numbered actual rule: trigger, state before/action/state after, reward/cost and consequence. Separate visible rule from a guessed algorithm. |
| path | Actual path/order, prerequisites, branching, locked/unlocked state and return; screenshot per observed transition where available. |
| onboarding | Actual screenshot per step/build/session, question/input/action/response. No stitched multi-session flow or fabricated completion. |
| personalization | Input and actual resulting adaptation; later behavior where captured. Source claims about AI personalization remain claims. |
| progress | Metric wording, displayed value, before/after behavior, reset/retention and windows; unknown formula is not zero. |
| reminders | Actual wording, channel, trigger/timing and resulting response if observed; no invented effect or unapproved contact. |
| ui_voice | Real UI copy and dialogue turns with context/image/locator; a proposed editorial rule stays inference. |

No stage requires a fixed giant number of screenshots, turns or categories. Quotas
are selected per direction; unknown quotas stay null. Deep detail is supplied when
captured, not filled with imagined facts to reach a quota.

## Integrity, coverage and independent verification

Raw archive index lists source/media paths, byte SHA256 hashes and authentic origin
bindings. Independent verifier checks actual files and source evidence, views
media, records each verdict and creates checked copies; raw originals and collector
files stay untouched. Save field/card/source/media checks in verification.json.
Copies may remove/refute unsupported claims but preserve them in the original audit.

Coverage.json keeps selected scope, requested quotas (cards/sources/examples,
each integer or null), attained counts, actual examples/full loops, independently
verified counts, unknown fields, unavailable access and failed/skipped work.
Unknown coverage is unknown, not zero. Quota attainment and supported evidence
are separate: many unverified cards do not mean complete research. A complete
branch has its agreed quota met and all retained records/media checked; partial
states honest gaps and is usable if integrity/schema/origin checks passed.
Actual retrieval counts include unsuccessful queries/openings, and collection
plus verification allocations fit the run's global budget. Archive reads are
local audit work, not new external source openings.
Workflow usage exposes knownReportedUsage, not an assumed total actual spend.
retrievalUsageComplete is false if a launched collector/verifier threw, returned
null or lacked a schema-valid usage record. A status: failed result with a
schema-valid usage record still reports its known spend completely. Unknown
unreported spend is not zero.
Prepare/propose/assembly/delivery review use local files only, without retrieval.

Across ALL branches and reader outputs maintain one canonical-URL prose ledger:
at most 25 verbatim words and default at most 200 attributed words per URL, or a
lower source limit. Count captions, repeated snippets, quotes/paraphrases in catalogs,
reports, reader sidecars and proposed examples that draw on the source. Normalize
URL variants and bind stored captures to that URL; dedup is not a loophole.
Assembly reconciles independent ledgers before delivery. If the requested depth
cannot fit these limits, use factual atomic observations, original image links,
short compliant quotes and visible locators; keep the gap rather than reproducing
the entire source. Preserve lower lyric/source-specific quote limits as applicable.

Final assembly consumes every branch including null/failed/partial dispositions.
A required failure blocks registration, even if some local artifacts are readable.
A limit/null pauses and stops downstream calls. No arbitrary retry loop/model
fallback. Independent delivery review actually checks archive/schema/media,
authentic origins, global prose ledger/dedup, original preservation, selected scope
and a readable catalog/view. Its pass is evidence of this audit only.

## Reader presentation and separate proposed design

### Structural artifact graph and shared element types

The business research graph retains its fixed ontology. The library's structural
graph is a separate indexed artifact, linked from artifact.data.referenceGraphFile
and manifest.referenceGraphPath, not hundreds of new business graph nodes.
Existing competitors may hold scoped referenceLibraries pointers; matching an
existing identity does not establish hires/competes_for or customer validation.

Manifest.referenceTypesPath points to a schemaVersion 1 sidecar:

```json
{
  "schemaVersion": 1,
  "types": [{"id":"language-selection","label":"Language choice"},
    {"id":"target-language-selection","label":"Target language","parentId":"language-selection"}],
  "assignments": [{"cardId":"fictional-card","part":"step","stepIndex":0,
    "typeIds":["target-language-selection"],"basedOnCardSha256":"sha256-of-JSON.stringify-card",
    "basis":"editor_classification","rationale":"The captured question asks for the studied language."}]
}
```

Part is example or step; stepIndex is the zero-based source array index. Types
have unique stable keys, optional acyclic parents and plain labels. Assignments
are explicit, independently reviewed descriptions of an element's role. They are
not inferred on retrieval from a word, merged automatically or promoted to an
observation. Changed card hash invalidates the assignment. Unknown roles stay
unassigned. Keep target/native/interface languages distinct, generic categories
separate from concrete examples, and different builds/sessions as separate records.

Use runtime bin/reference-graph.js buildFromManifest for staged assembly with a
prospective artifactId recorded in manifest.registeredArtifactId; it builds with
an in-memory descriptor and never writes the business graph. After registration,
`references graph|read|types` selects only registered libraries. Graph schemaVersion 1
contains node IDs, record file/JSON pointers, nodes, edges, basedOnInputs with byte
SHA256, original gaps and counts. Nodes: library, reference-product, direction,
example, step, image, source, element-type. Fixed structural edges: contains,
defines_type, classified_as, subtype_of, has_image, references_source, listed_next.
The latter is stored order with observedTransition:false, not an observed action.

Reader queries competitor/track/type or node ID, expands explicit child types and
returns bounded pages with nextCursor. Each match has its parent chain, actual
image/source pointers and original observation/build/verification limits. No match
means no indexed/annotated captured example, not feature absence. Generic node
neighborhoods state any truncation. Reader builds from current files and never
uses a stale saved snapshot as authority. Independent delivery review checks the
actual index, all endpoints, bindings and semantic assignments; referenceStructure
must be true separately from archive/schema checks. Structural edges never upgrade
source support, ownership decisions, completeness or retention claims.

Optional manifest.readerPresentationPath points to a schemaVersion 1 JSON:
`{schemaVersion:1,entries:[{cardId,basedOnCardSha256,title,summary,format,example?,note?}]}`.
Compute basedOnCardSha256 as SHA256(JSON.stringify(originalCard)) using the actual
stored card. Keep the original card unchanged. Copy editing cannot upgrade
certainty, add a transition/build or convert a claim/inference to observation.
Use concise plain labels; preserve notes such as «a single captured screen».

Optional manifest.designMaterials is an array of
`{id,title,description,decision:'proposed'|'accepted',links:[{label,path}],dataFiles?:[{label,path}]}`.
Links point to HUMAN-readable Markdown/PDF reports: full worked dialogue/few-shot galleries,
character sheets, UI or brand notes explicitly requested. Optional dataFiles are
JSON/JSONL/Markdown downloads for separate AI detail, never the primary human view.
Proposed examples cite checked sources but stay our design.
No mixing competitor screenshots/cards with our proposed artifacts. New examples
always proposed; accepted requires the owner's exact decision and decisionSource
in the associated artifact/report. If no existing brand/profile is supplied, mark
unknown and do not generate unsolicited art/identity.

## Origin finalization

Research completion, graph registration, owner acceptance and implementation
permission are separate statuses. Script returns ownerDecision: pending and
implementationAuthorized: false. Origin verifies/registers files with existing
artifact nodes via the shared transactional graph-write only. Keep artifact
status hypothesis, data.kind: content-pack, artifactKind: product-reference-library,
manifestFile and decision: proposed. Do not add graph types or imply evidence from
competitor usage. Reconcile optimistic revision conflicts instead of overwriting.

Preserve consoleRun's exact runId/nodeId/skill in report frontmatter and finalization.
Register reviewed artifacts, then emit exactly one receipt in that same transaction.
Successfully investigated and independently reviewed readable partial archives
complete the activity with receipt outcome: completed, while coverageStatus remains
partial and quota/access/unknown limits remain explicit. A researched negative
finding is completed work, not evidence of full coverage or viability. Incomplete
required steps or failed delivery get a failed receipt with a concrete report/summary;
paused work defers the receipt and remains resumable until finalization is decided. Never complete a node
with runId and also emit a duplicate receipt. A successful receipt does not accept
the design or authorize implementation. Without consoleRun no invented receipt.

Local deterministic tests run fictional agents and files; they demonstrate control
flow/contracts, not live source access, collection quality or end-to-end research.

## Observed flow boundaries and owner handoff to own design

Save `flow-boundaries.json`, linked by the delivery descriptor's flowBoundariesPath:
per example/build/session record observed state/action/response/known guards and
source/capture IDs. Separate inferred bridges. Explicitly list entry/back/exit,
empty/error/partial/re-entry as observed, inferred or unknown; a single screenshot
has unknown transitions. `listed_next` and gallery Next are storage/review order,
never product actions. Independent reviewer checks this separation against saved
sources and marks checks.flowBoundaries. Do not stitch sessions/builds.

Save `owner-handoff.json` (ownerHandoffPath) with `schemaVersion:1,snapshotPath,snapshotSha256,scope,scopeSha256,
sources:[{id,path,sha256,locator}],sourceSetSha256`; compute scope/source-set hashes
with the canonical SHA-256 digest (no absent helpers): recursively sort object keys,
keep arrays as-is, stringify, then SHA-256 hex, e.g.

```js
const crypto=require('node:crypto')
const canonical=v=>JSON.stringify(v===undefined?null:v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v)
const digest=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex')
```
Scope includes productId/libraryId, retained trackKeys, requested scope and limitations. Freeze the
manifest's byte SHA, selected/retained scope SHA and complete source/dependency
inventory SHA; preserve partial coverage and unobserved transitions. Owner decision
stays pending, source null; checks.ownerHandoff means snapshot integrity and pending
human gate, never human acceptance. Readable catalog gives a concrete scope for
manual owner review. Origin then stores the actual owner message/form decision
against this exact snapshot. Changed bytes/source/scope require another review.

A separate product-design task (not shipped in Product OS) may consume the library only after that
owner handoff. Legacy `design.enabled` remains optional proposed few-shot/source
adaptation examples only; it must not generate/accept the own product flow,
full own-product catalog or application. No monolithic auto-accept pipeline.
