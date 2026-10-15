# Communications center · v1

The center is the console section «Каналы коммуникации», alongside «Сегменты» and «Конкуренты». It uses
`research-graph.json`, `GraphTransaction`, graph history, the existing skill launcher
and exact run receipts. There is no second communications database. The demonstration
workspace is fictional and temporary (`node scripts/communications-preview.js`, port 4187,
agent integrations disabled); ordinary consoles use their selected product workspace.

## Model

Company offerings and customer jobs are distinct hierarchies. `product subproduct_of
product` expresses an offering hierarchy; `job in_order_to job` retains customer job
semantics. Products have at most one parent, with arbitrary depth and no cycles.
An ordinary feature stays a capability in the existing product development model.

A channel keeps its identity, audience, reader jobs, promise and reasons to return. It
can support multiple offerings and segments. When explicitly designated `data.isOffering:
true`, that same channel node is also an offering in the scope selector and can have a
`subproduct_of` parent. Never create a second product node merely to represent its media
role. Offering relations below accept products and channels explicitly marked as offerings.

| Entity / relation | Meaning |
| --- | --- |
| `product` / `serves` → segment | Our offering works on that segment's jobs |
| `channel` / `channel_offer` → offering | Shared channel supports an offering |
| `channel` / `channel_segment` → segment | Reader audience, independent of product CTA |
| `journey` / `journey_offer`, `journey_segment` | A proposed contact path for one or more segments and offerings |
| `journey has_contact touchpoint` | Contacts participating in this path; contacts can be reused |
| `touchpoint contact_job job` | Customer task, not the name of a search engine or surface |
| `touchpoint contact_channel channel`, `contact_rubric rubric` | Optional channel and rubric; rubric must belong to channel |
| `touchpoint uses_material artifact` | Many-to-many use of materials, including lead magnets |
| `rubric rubric_channel channel` | One owning channel per rubric |
| `reference reference_for touchpoint / channel / rubric / competitor` | A reusable reference with URL and explanation |
| `artifact material_offer offering`, `material_segment segment` | Material's direct scopes in addition to contacts using it |
| `artifact material_channel channel` | Direct channel assignment, including materials not yet attached to a contact |
| `communication_decision decides rubric`, `based_on evidence` | Immutable editorial decision and optional measurement evidence |

A journey's `data.transitions` is an array of `{from, to, condition?}` between its own
contacts. It expresses branches, conditional skips and return visits. Display order does
not create an obligatory funnel. Contact data has `surface`, `benefit`, `message` and
`promiseBasis`. Missing fields are visible gaps; a path can start with no contacts.
Rubric data has `readerJob`, `rationale` and `topics`. Channel data has `audience`,
`promise`, `returnReason`, `roles` and optional `platform`, `url` / `isOffering`.
`platform` is an explicit human-readable surface (for example `Telegram` or
`Email-рассылка`), separate from the channel name. Missing platforms in legacy
workspaces display as unspecified; they are never inferred from the name.
The channel card has explicit edit, save and cancel actions. Cancel discards only
that channel’s unsaved form; switching tabs preserves its in-session draft.

## Persistence and operations

`POST /api/communications` accepts one command plus `expectedRevision` and the existing
console CSRF header. It rejects stale revisions with 409 and invalid data with 400.
The equivalent CLI operation is `op: "communication"` inside the standard graph-write
package; put `expectedRevision` at the package level. Both routes use the same writer.

```json
{
  "schemaVersion": 1,
  "expectedRevision": 12,
  "source": "communications:manual",
  "operations": [{
    "op": "communication",
    "command": "save",
    "id": "material-example",
    "type": "artifact",
    "label": "Three ways to agree on a task",
    "data": {"body": "Editable text", "stage": "draft", "format": "Article"},
    "links": {"material_offer": ["product-example"], "material_segment": ["segment-example"]},
    "attachContact": "contact-example"
  }]
}
```

`save` upserts product, channel, journey, touchpoint, rubric, reference or material. Data
merges; explicitly supplied relation arrays replace only those relations. Omitted data
and relations remain unchanged. `attachJourney` on a new touchpoint and `attachContact`
on a new material create the attachment in the same transaction. IDs must already exist
for link targets. Reference URLs and publication URLs accept HTTP(S), never script URLs.

Materials remain `artifact` nodes with `data.kind: communication_material`. The editable
`body`, `stage` (`idea`, `draft`, `review`, `ready`) and format live on the artifact. The
writer mirrors the text to `reports/communications/<id>.md` in the same recoverable journal
transaction as the graph. This is a mutable working document; previous bodies remain in
`.product-os/graph-history`. Existing skill reports remain immutable. Manual origin is
recorded as `communications:manual`, not as a fabricated external source. Material source
is its generated report. No inference of effectiveness follows from document preparation.

Other commands:

- `import-material`: `{artifactId, offerId?}` creates one editable working copy of a supported
  existing report. The deterministic copy ID makes repeat calls preserve manual edits.
  Full Markdown content is copied, including multi-post packages; originals and version
  links remain unchanged. Explicit product, segment and channel assignments are retained.
  `offerId` is used only when the source document has no product assignment.
  `ready-for-review` maps to `review`, other legacy readiness to `draft`; publication
  and effectiveness are never inferred. Only existing Markdown files under `reports/`
  within the workspace, up to 1 MiB, can be copied.
- `feedback`: `{id: materialId, text}` appends a timestamped review; `save` cannot overwrite reviews.
- `observe`: `{target: materialOrRubricId, text, source, windowStart, windowEnd}` creates normal,
  immutable `evidence` (`origin: test`, `kind: communication`). Source must be a primary HTTP(S)
  URL or an existing original within `sources/`. Dates are ISO calendar dates, start ≤ end.
  The observation records the material's rubric IDs at measurement time, so subsequent
  reassignment never rewrites a past decision's basis.
- `decide`: `{rubricId, outcome: continue|change|defer, rationale, evidenceIds: []}` appends a
  decision. Evidence must belong to this rubric or its materials, including historical
  attribution. No evidence means an editorial choice, not demonstrated effectiveness.

`publicationUrl` and `publishedAt` record a manual publication fact independently of
readiness. A ready material is not automatically published; a publication is not data;
data is not a conclusion. Existing hypothesis/evidence validation statuses retain their
research meaning. These operations do not automatically promote a channel's status.
Negative results are first-class observations. There are no effectiveness scores.

## Scope and compatibility

The selected scope includes descendants. The ecosystem includes all active offerings.
Service connections are derived from explicit `serves`, shared `competes_for` / `performs`
jobs and paths assigned to an offering. In legacy single-product maps with no service
relations, existing segments stay visible. Reading a workspace never rewrites it.
`version: 2` / `contractVersion: 3` remain accepted; this is an additive vocabulary extension.

The selector, selected segment, working tab and map mode are device preferences saved
under a workspace-specific localStorage key. Business records never live there. A selected
segment outside the new scope is retained and explicitly marked; unrelated paths are not
shown. Unsaved form values survive tab switches and polling in memory. A page reload
restores saved records, not unsubmitted form edits. Revision conflicts preserve the typed
text and let the user load current records explicitly.

The «Каналы коммуникации» button in the top navigation is the only UI entry to the center.
Product and competitor dossiers never change this view. Segment dossiers merge legacy
channels, communication hypotheses and planned contacts into one overview. Competitor
reference links are shown directly in its dossier.

The selector is labelled “Продукт” / “Все продукты” and displays full parent paths.
“Структура продуктов” opens a separate native dialog in any map view; users can create
and edit products and add directions under a selected parent through the same graph writes.
Product dossiers also show their parent and child directions. The former communications
footer for offerings is removed. Contact planning starts with an explicit button and an
illustrative example that is never written as research data. Existing `content-pack`, `channel-concept` and `editorial-profile` reports retain
their original content-asset contract and report history.

The read-only compatibility projection exposes `reached_via` segment/channel edges as
research contacts, retaining `orientationJob`, `tactic`, `hook` and the original source.
It does not invent ordered journeys, useful outcomes, rubrics or results. Creating a
journey with `attachLegacyContact: {segmentId, channelId}` explicitly copies one selected
contact in the same transaction; its original research relation remains intact.

An existing channel's explicit `data.productId` supplies a display-only `channel_offer`
when canonical links are absent. Saving channel assignments sets
`data.communicationLinksManaged: true`; clearing those links then remains deliberate.
Acquisition placements with `reached_via` and no ownership or offering assignment appear
as research contacts, separate from owned channels and editorial rubrics.

Legacy `content-pack`, `channel-concept`, `editorial-profile` and HQ documents with
`artifactKind` of `task-brief`, `concept-outline`, `source-backed-content-shortlist` or
`principles-and-editorial-rubric` appear in Materials as source documents. Product and
segment filtering uses explicit assignments only; missing assignments are labelled.
`basedOnArtifactId` / `revisesArtifactId` remain visible as source-document history.
Dropped, retired and `excludedFromWorkingInputs` records are excluded. No migration or
copy is performed by opening the console; `import-material` is an explicit user action.

## Skill return contract

The existing `/api/move` route accepts `materialId` for `product-content`. The server issues
an authoritative move using the selected offering plus the material, contacts, path,
segment/jobs, channel, rubric, feedback and references. The launch sheet and provider flow
are unchanged; “What next” owns agent activity and “Reports” owns documents/history.

For this explicitly targeted launch, update the named working material through
`op: communication, command: save`, supplying `data.body` and `data.stage: draft`; omit
`links` to preserve attachments. The generated report appears in Reports and the editable
body appears in Materials at the next snapshot. Pass the launch's `runId` to `communication save` as well. It creates an immutable
`reports/communications/<runId>.md` snapshot alongside the working document. Use that
unique report with the exact `runId`, material `nodeId` and `skill: product-content` in
a single normal receipt. Both operations may share one atomic graph-write package.
Subsequent launches get their own snapshots and cannot reuse or overwrite earlier ones. A separate
content-pack may preserve editorial notes, but does not replace the required working
material update. Read the latest revision before writing. If a person edited concurrently,
preserve their changes and save a separately linked variant instead of overwriting.
Do not fabricate a successful provider run when only the prompt has been prepared.

## Verification and limits

`test/communications.test.js` covers writes, persistence, graph validation, concurrency,
scope, shared channels, channel-as-offering, and skill context/return. The browser suite
`visual-tests/communications.spec.js` starts its own isolated fictional workspace and
covers the complete manual flow on desktop and narrow viewports, navigation, reload,
shared scope and unsaved text. Run with `npx playwright test -c playwright.config.js visual-tests/communications.spec.js`.

`test/communications-legacy.test.js` and `visual-tests/communications-legacy.spec.js`
use a separate fictional legacy fixture. They cover read-only compatibility, scope,
excluded documents, report history, full-document copies, repeat import, persistence,
contact adoption and invalid/out-of-workspace sources. Real product research is never
a test dependency.

This release supports manual publication links and results. No autoposting, advertising
account integration, external analytics collection or evaluation arena is included. The preview deliberately disables real agent calls; the launcher and
returned-artifact contract are verified locally, without spending on a live generation.

## Channel-first workspace · September 2026

Communications now opens on **Каналы**. Existing workspaces keep their last selected
view; `?view=communications` opens the communications mode directly. Channel cards
show audience, arrival context, purpose and content counts. Opening a channel keeps
its audience context alongside its content. The global material library and
paths remain available as secondary views.

A channel's optional `data.contentMode` is `page` (semantic blocks) or `feed`
(rubrics and posts). Explicit platforms `Сайт` and `Лендинг` default to the page
presentation when the mode is missing; no inference from a channel name occurs.
The mode is independently editable. `data.purpose` describes the channel's role.
`data.contexts` contains up to 100 records with a unique `id`, optional `segmentId`,
required `situation` and optional text fields `entry`, `known`, `criteria`, `purpose`,
`message`, `proof`. These are manually described audience contexts, not measurements
of an individual's consideration set. Existing channel audience/offer links remain.

Materials use the existing artifact writer and report storage. Optional brief fields
are `keyMessage`, `criterion`, `proof`, `contextId`, `rubricId`. Context and rubric IDs
must belong to one of the material's assigned channels. Each material currently has
one primary context and rubric; channels support multiple audience contexts and
materials retain their existing many-to-many use in contacts. A page block uses format
`Блок страницы`. `channel.data.contentOrder` stores material IDs for display order;
reordering does not rewrite the material. This first version edits a list of semantic
blocks, not a deployed page layout or a complete multi-page website tree.

Channels show readable materials and page block ordering. Rubrics have their own tab.
Content and rubric changes start with a short AI instruction and the existing launcher.
The writer retains context, brief and body persistence; audience contexts remain editable. Observations
on posts with a direct rubric assignment include that rubric in immutable attribution,
without requiring an artificial journey/contact. Publication and evidence retain their
separate meanings. Unsaved text survives view switches in memory; leaving the page
with unsaved forms prompts the browser's standard warning.

`withDesign: true` adds a fictional landing and Telegram example to the disposable
preview fixture. The ordinary test fixture and real product workspaces receive no
automatic content. `visual-tests/communications-channels.spec.js` verifies the new
channel entry, readable materials, rubric visibility, AI context, converging job branches
and narrow layout. Writer tests cover persistence and relationship validation.


## Jobs before Core Job and simplified content flow

The primary tabs are Каналы, Пути и контакты, Материалы. Observations remain in the
stored graph and API, but have no primary UI tab. Materials open as readable text;
creating or revising one opens a single instruction field and the existing AI launcher.
Issuing the task does not mean it has executed. The disposable preview disables agents.

Each journey may carry `data.jobGraph`:

```json
{"coreJobId":"job-core","jobIds":["job-find","job-check","job-core"],"transitions":[{"from":"job-find","to":"job-check"},{"from":"job-check","to":"job-core"}]}
```

These are canonical job IDs. `in_order_to` expresses motivation/hierarchy, not time.
All jobs in an individual variant must reach its Core Job, without cycles. The Core
must be performed by the journey's segment and served by one of its offers through
`competes_for`. Criteria come from `performs.data.criteria` and `judged_by`.

The Paths view is independent of the segment filter in other tabs. “Все пути” lists
paths in the product scope; the “Путь” selector opens its touchpoints, materials and explicit contact transitions.
Each path shows all associated segments as audience labels. `journey_segment` accepts one or more segments; the Core must be performed
by at least one linked segment when a research job graph is retained. A shared path is not copied per segment. The same segment
can occur in several paths. Contact transitions can branch and converge.

Channels attach through touchpoint `contact_job` / `contact_channel`; materials through
`uses_material`, preserving reuse. Missing chronology is displayed as missing, never
inferred from hierarchy or contact order. SVG connections and positioned job cards
provide selection, zoom and scrolling without introducing a React runtime.

Reference inspected: makers-test/apps/web-aura job graph types, graph-layout.ts,
JobNodeV2.tsx and resolve-job-graphs.ts. Its distinction between motivation, Core/small
jobs and execution context informs this model; no real workspace data is copied.


The Paths UI lists all journeys in the product scope, independent of the segment filter. It displays touchpoints, channels, materials and explicit journey.data.transitions, never infers contact order from jobGraph. Segments are many-to-many audience labels. Job graphs remain research context. Website content is labelled «Тексты для сайта»: draft copy to review and transfer, not published pages.

A retained journey.jobGraph must have a Core Job belonging to at least one linked segment; it does not constrain every audience of the shared contact path to that same job.


Paths are displayed together as horizontal contact diagrams, one row per journey. Arrows follow explicit contact transitions, not storage order or job graphs. Step details open in a modal over the diagram, without changing the row layout. Closing the modal returns focus to the same step and preserves horizontal scroll. touchpoint.data.intent records what the person was looking for at that contact.

## Визуалы контента

`product-visual-style` и `product-visual` доступны в каталоге продвижения. Профиль
(`visual-profile`) и результат (`visual-pack`) — версионные artifact, описанные в
GRAPH-WRITES «Visual assets». Исходный материал хранит visualArtifactIds; просмотр
материала в библиотеке показывает ссылки на отчёты визуалов и отдельно их decision
и readiness. Короткая надпись картинки не заменяет label/body материала.

В просмотрщике отчётов локальные Markdown-изображения PNG/JPEG/WebP/GIF из reports/
и sources/ отображаются с адаптивной шириной. Локальные ссылки ведут к связанным
отчётам или исходникам. `/asset?path=…` отдаёт растровые изображения; SVG/HTML/JS/JSON
показываются как неисполняемый текст. Путь проверяется после realpath, с запретом
выхода из workspace и перехода в другие его каталоги через symlink. Внешние изображения
автоматически не встраиваются. Это просмотр существующих файлов, не новое хранилище.

Channel presentation resolves explicit `contentMode` (`page`, `feed`, `resource`) first.
Without an explicit mode, website/landing aliases use page content, known publishing
platforms use feed content, and unknown platforms use related materials without a feed.
Only matching material formats appear as page blocks or feed publications. Other linked
artifacts remain accessible as related materials, including audits and unspecified formats.
This does not change graph links, artifact formats or publication status.
