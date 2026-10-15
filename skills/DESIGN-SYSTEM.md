# Product OS design system

This is the single UI contract for the Atlas reading console. Atlas is the only
console presentation. Private research is never a test fixture.

## Ownership

| Layer | Source | Responsibility |
| --- | --- | --- |
| Tokens | `bin/console/public/ui-tokens.css` | Colours, font roles, spacing, surfaces |
| Legacy reading adapters | `bin/console/public/design-system.css` | Transitional domain content and responsive reading layout |
| Shared interactive components | `bin/console/public/ui-components.css` | Dialogs, buttons, notices, badges, task facts, disclosures and their states |
| Component examples | `/design-system` | Executable examples using production classes; no live agent actions |
| Product behavior | Existing renderers and transactional writers | State, routing, validation and persistence |
| Development workflow | `skills/product-design/SKILL.md` + `references/console-ui.md` | Inspect, implement, verify and report |

Load component CSS after legacy CSS. New controls use the shared component roles;
legacy selector aliases are migration adapters, not permission for new hardcoded
colours or font sizes. Fix the owning component, not one screenshot with another
page-specific override. Foreground and background are one inseparable surface
contract. Metadata must not resemble a disabled button.

## Tokens

The Opora direction was selected by the owner on 26 September 2026.
Onest (body and controls) and Source Serif 4 (headings) are bundled locally as
variable WOFF2 files with Latin/Cyrillic and their SIL OFL licenses.
Brand assets and their application rules are described in BRAND.md.
No sibling checkout, online font service or private product data is required.

| Role | Token | At default root size |
| --- | --- | --- |
| Body / quotations | `--os-body` | 18px, line height1.6 |
| Labels / metadata / controls | `--os-label` | 16px, line height1.5 |
| Page / section / card heading | `--os-h1/h2/h3` | 40/28/24px, weight600 |
| Target | `--os-target` | At least44px |
| Spacing | `--os-space-1…4` | 8/16/24/32px |
| Control / tile / card radius | `--os-radius/tile-radius/card-radius` | 4/4/4px |

Use semantic `--os-*` colours from the code; do not copy their values into pages.
Ink-filled buttons are primary; terracotta identifies links and selection. Warm
paper surfaces and open, ruled collections express Opora; warning and evidence
status colours preserve their separate meanings. Headings use `--os-heading-font`;
reading text, controls and metadata use `--os-font`.
Use mono only for code. Match foreground/background and include focus/disabled/
error states. Shadows identify transient panels. Shared root scaling applies to
shell and embedded pages; no per-component zoom or shrinking to fit.

Landing annotations use the bright categorical `--os-marker-0…11` fills and
`--os-marker-ink` text. The default colour denotes a communication element (job,
context, value, alternative, mechanism, barrier, proof or first step). Job levels
and combinations such as “Core Job + ценность” are written in the detail card.
The optional segment view uses the same palette with a segment legend; colours
remain stable across filtering. In element view a dashed underline denotes an
inferred meaning; in segment view it denotes a probable segment link. Neutral
means general/company/service text or explicitly unclassified text in element
view, and no segment match in segment view. These meanings stay in the legend.
The Chrome landing highlighter omits menu/media controls and neutral service,
company, slogan and unclassified fragments from the page and fragment list.
Commercial CTA, pricing and claims with a communication meaning remain visible.
Only the active variant of rotating text is painted; text changes invalidate
that block while the rest of the saved analysis stays available.
Hover opens a compact annotation view with a type and at most two visible quote
lines. Click opens bounded detail with scrolling in its content and a persistent
close control. A pinned detail keeps its quote and position through text rotation;
Escape or closing it suppresses reopening until the pointer moves. Placement
is anchored to the source block and stays fixed while variants rotate. Whole
rotating phrases use their stable slot for hover while glyphs animate. Saved
highlights restore only to exact, unambiguous matching blocks after reload;
changed controls or text do not invalidate unrelated quotations. The view
is shared by Chrome and the executable `/design-system` example.
Multiple elements and all segment links are described in the detail card.
These colours do not encode quality, success, failure or evidence status. Reuse
`segmentMarker` and `annotationLegend`; their executable examples are in
`/design-system`. In segment view the graph assigns colours by order, including hidden
and archived records, and repeats the palette after twelve records.

## Navigation and information hierarchy

- One persistent primary menu, reading the whole workspace without a hidden product scope. Mobile content height
  follows actual navigation height; current navigation item stays visible.
- Each page: title → local topics / relevant filters → content. Headers have no
  explanatory subtitle or search field. Saved product/channel descriptions belong
  in their overview content, with sources intact; form guidance and evidence
  qualifications remain with their controls or claims. Overview, detail,
  evidence and editing are distinct roles. Do not repeat a collection as a second
  “connections” block or a product overview as a separate “full product” page.
- Addressable objects retain their parent return link and browser history. Changing
  a local tab must not change the parent. Embedded pages do not duplicate crumbs.
- Independent topics use local tabs. Small supporting detail uses disclosure.
  Never conceal a conflict needed to interpret a visible assertion.
- A segment has one fixed topic navigation: Profile, Job graph, Alternatives,
  Research, Search history and Verification plan, in that order on every topic.
  `segment-collection.js` composes it through `topicNav`; the job graph is directly
  addressable from every segment page. Do not repeat those destinations as buttons
  in the body or the right-hand contents. Long documents use `readingLayout` for
  their own sections only; sources, individual dossiers and working actions remain
  beside the content they belong to. Contents retain an accessible landmark name
  without a visible caption repeating the page context. Single-topic collections and the interactive
  graph do not need a second contents menu. The executable example is
  `/design-system#catalog-segment-navigation`; regressions live in
  `visual-tests/profile-reading-preview.spec.js`.
- The shell identifies the application by its visible brand mark and Product OS
  wordmark, with an accessible name. The workspace remains a separate ordinary text
  line, even when it also has the name Product OS. Product topic headers name the active topic; a differing product
  name remains compact context. Elements owns its list/detail header and topic nav:
  one main heading names the topic or the opened element. Saved distinct catalog names
  remain visible context; the legacy generic “Повторно используемые элементы <product>”
  label does not repeat the same topic. Equal names of separate objects are preserved.
  The catalogue uses one list with open role links (components, compositions, rules)
  when explicit roles exist. One short line explains the selected role; cards and
  documents name their role in text. Category, status and role remain separate.
  Legacy catalogues without roles retain their ordinary list; mixed catalogues expose
  their actual untyped group, and unknown explicit roles remain visible. Diagrams
  illustrate records. Role, category, status and page survive detail and parent return.
- Product topics: overview, goals, positioning, brief, development, elements, materials,
  references. Our saved texts, characters and visual designs belong to Materials,
  separate from competitor examples. References begins with one `filterBar`:
  labelled native direction/competitor selects, an optional library selector and
  one reset. URL selection, counts, pagination and parent return remain together.
  The executable example is `#catalog-product-references`; its production spec
  also exercises the `product/materials` topic, including empty and unavailable data.
  Development is a filterable compact list; selecting an idea opens its
  problem, outcome, dependencies, evidence and actions in place.
- Long text uses a readable measure (up to68ch) inside a useful responsive layout.
  Grid columns have minimum widths in rem and collapse with enlarged text. Do not
  leave one narrow column on a largely empty desktop or show all object fields at once.
- Do not manufacture summaries, priorities or inferred facts to improve appearance.
  Paragraph breaks in legacy prose are formatting, not a semantic synthesis.

## Components

- Dialog: `.os-dialog`, a labelled title, result/context, primary action, explicit
  close/cancel. Existing `.launch-sheet` and `.confirm-box` adapt to the same roles.
  `aria-modal`, keyboard trap and focus return are behavioral responsibilities.
- Buttons: primary, secondary, danger; disabled is a real state, not metadata.
  Close icons have accessible names and a target of at least 44pxs.
- Task facts: `.os-facts` uses label/value rows. Internal tool names and prompts do
  not dominate the main decision. Prompt text belongs in an explicit disclosure.
- Feedback: `.os-notice`, warning and error variants use text as well as colour;
  warnings and errors remain visible when relevant.
- Sources: a compact textual citation `[1]` beside its claim, with a descriptive
  accessible name and a44px minimum target. A named textual action uses the link
  variant. Neither variant has a square icon box. Source numbering is supplied by
  the domain adapter; components never infer source counts from a label or number.
  One transient panel shows attribution, exact text/context and original link;
  Escape closes and returns focus. Keep filenames inside the panel. Document-only
  links must not claim exact locators. Corrections preserve history.
- Dossier: company, job/criteria, choices, economy, UX and quality are distinct
  topics. Keep prompted observations and interpretations distinct. Unknown/negative/
  conflict states must remain distinguishable from zero or false.

## Verification gate

Run `npm run test:design-system` and affected flow tests. Use fictional long,
unknown and conflicting data. Inspect screenshots; passing assertions do not
establish a good composition.

Check each affected component in default, expanded, focused, empty, populated,
error and disabled states as applicable. Include desktop,390px and200% text
scaling. Actual browser zoom and screen readers need separate manual checks; never
claim certification from these tests.

Normal text contrast≥4.5:1, qualifying large text≥3:1, required control/focus
contrast≥3:1. Check every visible text node, including metadata, small labels,
close icons and expanded bodies. Backgrounds, opacity and gradients matter.
Buttons need keyboard operation, visible focus and a target of at least 44px.
Inline source text follows its surrounding reading line; it must remain keyboard
accessible with visible focus. Preview actions retain the 44px target. Respect reduced
motion. Tables/graphs may scroll in their own labelled region with a readable
alternative; the whole page should reflow.

Before reporting completion provide routes/states reviewed, screenshots, commands
and results, and remaining limitations. A representative case is not every record.
Do not seek or advertise a global10/10 score as evidence that all screens work.
An independent reviewer must name defects and inspected states, not just a score.

Useful suites: `ui-components.spec.js`, `design-system.spec.js`,
`readability.spec.js`, `section-consistency.spec.js`, `reading-composition.spec.js`,
`product-references.spec.js`, `navigation-flows.spec.js`, `product-tabs.spec.js`,
`research-registry.spec.js`.

Accessibility reference: [WCAG2.2](https://www.w3.org/TR/WCAG22/).

## Human reading contract

The reading console serves a person making a product decision. A storage schema
is not a page design. Never render arbitrary JSON fields, audit statuses, IDs or
pipeline messages as the primary content, even after translating their keys.

- Define the reader's task before building a view. On entry they must be able to
  identify the object, understand what the example shows and find the next action.
- Name sections by their content or the reader's question. Research labels such
  as “observation”, “sequence” and “provenance” do not explain an example to a reader.
- For a step-by-step reference, put the screenshot next to the explanation of that
  same step: what happens, what the person does and why the step matters. Keep
  interpretations identifiable; do not present a proposed purpose as a proven effect.
- A caption must help interpret the picture. Do not repeat the surrounding prose,
  print a locator or expose a pipeline placeholder underneath an image. Sources,
  capture conditions and audit details belong behind clearly named controls.
- Keep limitations that qualify a visible conclusion accessible and specific.
  Preserve unknown, negative and conflicting evidence; do not replace it with
  reassuring copy or add facts to make the page easier to read.
- Collections expose their scope, directions and one compact range/page line before the
  cards; do not repeat counts as introductory paragraphs. A reader must not infer the library's contents from its first page.
- Name exercise references by the observable action or mechanism. The topic of
  one sentence is an example, not its exercise type. Explain what the person does
  before presenting the screenshot; separate that explanation from the concrete
  stimulus. Do not infer pronunciation scoring, shadowing or a completed cycle
  from a taxonomy ID or a screenshot that shows only part of an exercise.
- A single captured exercise screen is an example image, not a multi-step flow.
  Do not promote a generic research wrapper or boilerplate purpose into a visible
  step. Show the task, its image and specific limits; retain the original record.
- Editorial descriptions may sit alongside source records, with explicit bindings
  to their current content. Keep original evidence unchanged; stale descriptions
  must fall back visibly instead of borrowing the source's verification status.

The review gate includes an unprompted reading scenario: enter a collection,
choose a direction, open an example, explain its first step from the screenshot,
open its source and return to the same collection. Record confusing wording and
unnecessary blocks as defects. Contrast and passing browser assertions alone
do not establish that the page is understandable.

## New page acceptance

A route or topic added to the reading console is accepted only when every item below runs;
the release gate re-checks them together.

1. The route or topic is listed in `test-support/console-routes.js`. `test/console-routes.test.js`
   fails while a declared route has no matrix entry or undocumented exclusion, and the page's
   own spec is part of `npm run test:design-system`.
2. Composition uses the shared factories: `pageHeader` with `collectionLayout`/`detailLayout`,
   `readingSection` for open rhythm, `paperSurface` for own-background surfaces,
   `filterLink` for link filters. Feature CSS sets neither page rhythm nor surface padding.
3. The main text is read end to end before review: decoded language and status codes, no
   repeated descriptions, concrete limits instead of rows of unknown values, no JSON keys,
   IDs or pipeline placeholders outside named source/technical disclosures.
4. The unprompted reading scenario (collection → direction → example → source → return) is
   performed at 1440 and 390 widths and 200% text. Report confusing wording and found defects,
   not only passing assertions.

## Collection and editor checks

The shared page header owns title spacing: no trailing margin on its last child,
and one `--os-space-3` gap before the next region. Do not add route-specific
header margins or reserve empty list rows. Open reading sections own section
rhythm (`readingSection`); a surface with its own background owns its padding
(`paperSurface`). Feature pages must not re-specify either in their CSS.
Collection search is removed by the owner’s decision (27 September 2026); filters
and pagination remain available. Two named exceptions keep search: the customer
catalog’s profile search and the research registry’s record search described
below. A new search control must be added to this exception list with its reason,
or it will not pass review.
Old query parameters must not silently filter a page without a matching control.
Expanded page counts survive refresh and navigation. Verify these rules through
`section-consistency.spec.js` and the affected collection flows.

Product headers and their structure action stay in the same place across topics.
At narrow widths, local tabs scroll horizontally and reveal the active topic;
filters share a row without overflowing. Research counts may expand separately
from segment cards. Do not hide empty-result feedback with introductory text.

Channel editing names the editing mode, groups address/format, audience/purpose
and product relationships, and keeps Save/Cancel visible while scrolling. Check
nested fieldset legends and textarea text as well as the main labels.

Ordinary saved prose and documents use open `readingSection` / `proseFacts`,
with complete text and saved paragraph boundaries visible immediately. Do not crop
the body or put its continuation behind “Читать полный контекст/текст”.
`summaryCard` represents an object that can be opened (segments, competitors,
channels, development ideas), not a border around a paragraph. Supporting sources,
archives and technical detail may use their existing disclosures; qualifications
needed to interpret the visible claim remain visible. This does not synthesize
new content or replace a source-backed structured goal model.

## Object hierarchy

The segment collection groups recognizable customer profiles by `customerProfile.group`.
Each full-width profile preview shows its main job, one saved criterion and one additional use.
Optional narrower customer profiles appear as linked rows. Groups are headings;
confidence is evidence metadata, never a navigation section. No parameter controls.

Product, Segments, Competitors and Communication channels are peer sections.
A collection card opens an addressable full page. Customer-catalog cards use their title link to that page, without a duplicate
footer action; their body holds selectable text and independent source controls. Other cards with a whole-card action keep the same destination for
their title/body and primary link. Keep independent secondary links operable.
Source evidence is a transient panel; an entity dossier is not.
All topic tabs share the same font, selection indicator and control dimensions.
The research registry uses “Респонденты”; do not relabel buying-group roles as
interview respondents. Do not add research totals as decorative dashboard metrics.

Job graphs use the shared React Flow adapter in `ui/job-flow.jsx`, bundled locally.
`JobFlow.segmentMarkup(segmentId)` loads the read-only `/api/segment-jobs` projection;
`JobFlow.markup(jobs, relations, 'unified', scope)` uses the same renderer for a dossier.
The executable fictional example is `/design-system#catalog-job-graph`; its regression
is `visual-tests/job-graph.spec.js`, included in the design-system gate.

One canvas shows purpose (`in_order_to`, lower → higher), decomposition (`part_of`),
time (`precedes`) and dependency/condition links with distinct labels. Source and
target follow the saved relation; changing a view must not reverse an arrow. Core and
Small occupy the same band; Big is above, explicitly labelled Micro below and hidden
by default. Hiding Micro removes its edges without synthesizing a shortcut. Levels
come only from saved product-relative placement, never layout depth or `kind=lower_level`.
An unclassified individual job stays “Уровень не определён”. Cycles stay visible.

Returning from a job page retains the chosen Episode, canvas/list choice, Micro
visibility and expanded list jobs within the current workspace session. Choices
must be checked against the current read model; a removed case cannot remain selected.

Common synthesis/hypotheses and individual evidence are separate variants. A case
means exactly one Episode, not every job of a Person. Preserve candidate membership,
stale synthesis, saved cohort conditions and exact sources; cohort selection never
silently re-synthesizes common nodes. The common graph follows recorded active job
links without importing another segment's jobs through a shared Big goal. Empty
common nodes or absent time links explain what is not recorded, while cases and
profile descriptions remain reachable. Profile prose is not converted into nodes.

Hover, focus and touch reveal context, all criteria (including priority, negative,
conflicting and prompted states) and sources in place. The shared source preview
opens from text; Escape closes the deepest panel and returns focus. Fullscreen
restores scrolling and focus when closed. The list is a reading alternative with
the same facts and source controls, default on narrow screens; it is not another
store. Graph geometry, node styles and reflow belong to the adapter and live tokens.
Product prices/payment are labelled explicitly; next actions live in What Next.

## Accepted reading reference

Product → Overview and Product → Goals and constraints remain the reading references for information hierarchy, readable content blocks and compact evidence controls. The owner-selected Opora identity replaces their previous colour and type styling while preserving those reading responsibilities.

The reading console currently works with the whole workspace: no product/direction selector or product-structure management entry points. Ignore previously saved product scope on entry so invisible filters cannot hide research. This removes UI complexity, not stored product relationships.

## Review coverage

Review each primary route and its local tabs: Product, Segments and a segment, Competitors and a competitor, Communications (channels, paths/contacts, materials, research), respondents and job details, What next, Reports, Skills. Include expanded filters, disclosures, source panels and editor states. Collection filters use `os-filter-bar`, `os-field`, and `os-filter-option` from ui-components.css, including 44px targets and the label text token. Verify the expanded filter state separately from the collapsed collection.

## Executable component and page contracts

`ui-tokens.css` owns semantic values; `ui-components.js` exports pure string renderers
and DOM lifecycle controllers. `ui-components.css` owns their styles. Import named
exports from ES modules; `window.OSUI` is a temporary bridge for existing feature
renderers. Text props are escaped; content/actions slots are trusted application
markup and must never receive unescaped stored values.

| Contract | Inputs and behavior | Production consumers |
| --- | --- | --- |
| `pageHeader` | title, description, context, actions, back, `backTight`; shared heading roles — `backTight` places the parent return tight above the title instead of a separate row | Product, segments, competitors, communications, respondents/jobs, next, reports, skills |
| `topicNav` | items, active, label; keyboard movement, visible active item | Product, segment, competitor, communication, respondent and job topics |
| `emptyState` | explicit first-use / no-results / unavailable; title, description, actions | Segment and competitor collections, communications, next, reports, skills |
| `loadingState` | page/section skeleton, optional title, one status label; caller owns busy state | Initial console and asynchronous reading sections |
| `collectionLayout` / `detailLayout` | header, navigation, filters/context, content slots | Reading collections and communications; remaining domain internals use adapters |
| `button` with `href` | Addressable action uses native anchor semantics with the same button geometry, focus, hover and disabled presentation; no feature-styled action links | Named profile/research actions; catalogue reading example |
| `readingSections` | Explicit section IDs/titles/content/attributes; combines open sections and one contents panel only when useful; no routing or data interpretation | Product, segment, competitor and channel documents; `#catalog-shared-pages` |
| `summaryCard` | Escaped title, optional title href, trusted meta/content/actions, heading level and attributes; owns shell spacing and readable heading, no stretched overlay over sources | Segment, competitor, channel and respondent lists; `#catalog-shared-pages` |
| `readingLayout` | Trusted reading content; escaped contents labels and target IDs; optional action slot. Shared columns, readable measure, sticky contents, narrow reflow. One current section has `aria-current="location"` with selection colour, weight and a rule. Tracks the actual scroll container, resize/disclosure changes, restored positions and the short last section. Scrolling never moves focus; contents buttons scroll and focus the heading without changing the object route. Removed layouts release observers | Opt-in customer reading (`?profile-reading=1`); `/design-system` `#catalog-customer-reading` |
| `readingSection` / `paperSurface` / `filterLink` | open section owns rhythm (escaped title/intro, trusted content); paper surface owns background, hairline and padding (`--os-space-3`, `--os-space-2` below 44rem); link filter with control geometry and `aria-current` selection | Reference reading pages, reading detail topics; executable examples in `/design-system` |
| `proseFacts` / `factLine` / `disclosure` | prose fact groups read label-above-value with a readable measure (labels and trusted value slots); a compact single fact renders as one line; collapsible archives come from `disclosure({title, content, className, bodyClassName, attributes, open})` — escaped title, trusted content, native `details` with the shared `+/−` summary and `.os-disclosure-body` compact rhythm (`--os-space-1`, direct-child margin reset owned by two classes). Feature code composes its own class via `className`/`bodyClassName` and must not write `os-disclosure` markup by hand or restyle these roles | Reference reading detail; executable example `/design-system` `#catalog-prose-reading` |
| `editorLayout` / `field` | form fields, persistent actions; labels, hints, errors | Communication editors and research correction form |
| `JobFlow` | unified purpose/order canvas, explicit levels, optional Micro, case selector, readable list, fullscreen and source/focus lifecycle; read-only segment projection keeps one Episode per case | Segment graph, respondent dossier; `/design-system#catalog-job-graph` |
| `dialog` | open/close/destroy, opener focus and scroll context return after overlay history settles (including anchored pages and Back); never overrides new input, dialog, chosen focus or destination; native and overlay variants | Task launch, confirmations, source documents, research sources/history/corrections; `/design-system#catalog-product-elements` |
| `sourceTrigger` / `sourceEntry` / `sourceList` | compact citation or named action; source identity, relation, attribution, exact quote and original | Product, segment, competitor and respondent evidence |
| `sourceText` / `mountSourcePreviews` | Selectable claim text, hover/focus/tap source preview, viewport positioning and dismissal | All evidence-bearing statements, including product, segment, competitor, respondent, communication and research-result views |
| `evidencePanel` / `popover` | shared modal/nonmodal lifecycle; source entries as content | Source documents, research answers and supporting evidence |

`atlas-route.js` owns URL/history operations. `atlas-shell.js` owns persistent
navigation and outlet visibility. `atlas-navigation.js` is the transition adapter
for feature lifecycle and serializable filter/scroll state. Reading pages mount in
`#atlasReadingPage`; there is no iframe or cross-document snapshot synchronization.
The standalone `/atlas-content` URL remains a compatibility entry.
`AtlasRouteState.overlays.whenSettled()` completes after pending transient history
and browser fragment processing. The shared dialog owns focus restoration on that
completion, including its saved scroll containers; feature callers must not add
timers or restore focus across routes. A new user action cancels the pending return.

The product and competitor detail adapters still group output of the existing
research dossier renderer into topics. This preserves source bindings and domain
semantics; it is not a second implementation of source or navigation components.
Graph geometry belongs to `ui/job-flow.jsx` and is not a page-layout primitive.

`design-system.css` retains scoped legacy reading adapters for domain content,
work-item cards, graph surroundings and old button aliases. These are explicitly
transitional consumers; new shared components must not gain feature-specific
selectors. Removed header, tab and source rules must not return here.
`scripts/ui-boundaries.js` freezes existing CSS debt by declaration fingerprint,
rejects copied composition markup and reverse component dependencies. A removed
violation does not authorize a different new violation; do not regenerate the
baseline to make a new violation pass.

The executable `/design-system` catalog renders production functions. Run
`npm run test:design-system`, `visual-tests/ui-library.spec.js` and affected flows.
Role checks must use body/label/heading tokens, not a single minimum for all text.


## Reusable source presentation

`sourceNote({text, title, content, attributes})` associates a saved statement with
its source content. It renders `sourceText` and an inert template; the shared
`mountSourcePreviews` controller handles hover, focus, click/tap, keyboard,
viewport placement, dismissal and focus return. Use the actual statement as the
trigger, with a quiet dotted underline. Do not append numbered citations or
separate source cards to reading content. All adapters share this lifecycle.

Keep caveats needed to interpret the statement visible (conflict, denial, prompted
answer, unresolved status). Move source attribution, detailed scope and saved
excerpts into the preview beside the statement. Product capability scope notes
belong here; pricing conflicts retain a short visible warning. Preserve exact
wording, every supplied excerpt and original links. Unlinked evidence remains
explicit; never infer support from having a document.

Panels stay nonmodal and selectable. Tap/click pins them; Escape or the close
button returns focus. Nested context uses the same panel with a back action;
loading, error and retry must not discard the original evidence. Abort/ignore
late responses after dismissal or back navigation. On source DOM replacement,
close stale content and restore focus to the matching surviving statement.
A standalone report/document reader and an editing dialog are primary workflows;
they remain addressable pages/actions. `sourceTrigger` is retained for legacy and
named actions inside a preview, not as the default citation pattern.

`sourceEntry({title, relation, author, meta, quote, quotes, href, linkLabel, context, details})`
is the single reading unit inside a source panel or source list. Title, relation,
author and metadata are independent optional text fields. A blockquote appears
only for a supplied nonempty quote. `quotes` preserves multiple saved excerpts from
one source without repeating its identity or nesting source cards. An empty quote does not produce placeholder
quotation marks or an invented excerpt. `href` accepts HTTP(S) originals and the
local `/source?…` reader; unsafe URLs do not become links. Its default link label
is “Открыть оригинал”.

`context` and `details` are trusted HTML slots supplied by the domain adapter; all
stored text inserted into those slots must be escaped first. Other props are
escaped by the component. `details` creates “Как получен вывод” only when supplied.
This disclosure holds provenance detail; a conflict, prompted response, inference
or unresolved check needed to interpret a visible claim stays visible in relation
or metadata. Document-only references, exact answers and external examples remain
different meanings.

`sourceList({entries, emptyText})` renders source-entry props in their supplied
order with simple separators, without a card around each entry. It does not merge
quotes, reconcile conflicting sources, assign authors or manufacture evidence.
Its empty message defaults to “Источник не связан.” Quotes and contextual reading
use the body role; labels and original links use the label role. Long filenames,
Russian excerpts and expanded provenance wrap without horizontal page scrolling.

The `/design-system` source examples exercise evidence attached to reading text, a whole
document without a quote, an answer with context, conflicting sources, a reference
and long provenance. The same `sourceList` functions render the inline examples
inside previews opened from their real statements.


## Loading and ownership checks

`loadingState({kind: 'page' | 'section', title, label, className})` renders immediate,
static loading structure. A page reserves a heading, navigation and reading lines;
a section reserves reading lines. A supplied title is a real heading rather than
a second placeholder. The skeleton is `aria-hidden`; the component has exactly
one `role="status"` label and no interactive controls. The caller sets `aria-busy`
on the region whose contents are changing and replaces the loading markup as soon
as the request resolves. No artificial delay or minimum display time is allowed.
There is no decorative loading animation; reduced-motion preferences are honored.
The executable catalog demonstrates both kinds using the production factory.

Canonical Button styles consume `--os-radius` and `--os-target` directly. Legacy
button aliases exclude `.os-button` and its variants; changing those tokens must
change the same component in both the catalog and communication screens. Visual
regressions verify deliberately different token values, not only the defaults.

The boundary gate checks shared component selectors outside their owning CSS,
copied factory markup including fields/buttons, HTML inline styles and color/type
style mutations, and static, side-effect, dynamic or re-exported feature imports
into the shared module. Legacy `:not(...)` exclusions may protect shared controls;
they are not treated as overrides. Module analysis ignores comment/string examples.
The existing baseline remains immutable: new rule failures are corrected in code.

The only HTML inline geometry exception is the contact-path renderer in
`communications.js`: `.comm-route-canvas` may use its calculated numeric width and
height, and `.comm-route-step` may use its calculated numeric left and top. The
exception does not permit colors, typography or arbitrary inline expressions.
Generated graph assets are checked at their source/build boundary rather than
rescanned as handwritten console code.


## Segment interview support

`segment-support.js` owns the shared interview-support presentation; `badge` in ui-components.js owns its label styling. Research summaries and legacy detail adapters use the derived `interviewSupport` projection, never participant count or a rewritten research status. The customer catalog and profile use the per-statement basis described below. «Поддержано интервью» means current client answers support this segment hypothesis; it does not mean verified demand. Linked respondents and supporting respondents remain separate counts. Stale and conflicting evidence stays visible. Sources open through the shared evidence panel. The executable catalog contains desk, supported/conflicting and stale examples.

`badge({label, tone})` supports neutral and positive tones. Positive uses the muted green `--os-positive`, `--os-positive-bg` and `--os-positive-line` tokens. Segment interview support uses positive; desk hypotheses stay neutral. The explicit text remains the meaning-bearing label; green does not upgrade the research status or suppress conflict warnings.

`segmentConfidence` remains a legacy detail adapter for research metadata. The current Segments collection uses `renderSegmentHierarchy` from `segment-collection.js`, grouping customer profiles and their recorded parent/child relationships. Confidence and interview support remain research metadata; they do not divide the collection into AI/expert hypothesis groups. Subsegments preserve their parent link and an independent profile; they do not inherit field validation.

### Переход из карточки

`OSUI.textLink({label, href, attributes})` — общий текстовый переход «Открыть … →» в подвале карточки, без рамки кнопки. Используется для конкурентов и записей категорий; пример расположен в `/design-system`. Это настоящий адресуемый link с видимым фокусом и общей минимальной зоной нажатия.

Превью конкурента показывает описание и не более двух дополнительных сохранённых фактов. Приоритет: история выбора, причина выбора в записи, условия в источнике, связанная задача. Фильтр сегмента ограничивает относящиеся к нему факты; общие условия обозначены отдельно. Заявление сервиса, непроверенные основания, расхождения и неизвестное покрытие задачи сохраняют свои подписи. Полные формулировки доступны в досье; короткое превью не создаёт новых исследовательских утверждений.

## Customer catalog and profile

`segment-collection.js` provides `renderSegmentHierarchy`, `renderCustomerProfile` and
`mountCustomerProfiles`; `ui-components.css` owns the catalog/profile styles. This is
a composition within Opora: it consumes the existing colour, type, spacing, radius
and target tokens, shared links, source triggers and evidence panel. It does not
introduce a separate visual identity or token set.

The catalog starts with its title, short purpose and search, then group headings and
full-width segment previews. A group may link to its retained research. Each preview
contains its summary, main job, the first saved success criterion and the first saved
additional job; this limit does not assert a ranking. The full profile retains every
saved criterion and job. Narrower profiles appear as linked rows in a tinted, ruled
section, with their own `whySeparate` assertion and source access. The title opens the addressable profile; no duplicate footer link or empty action
strip is rendered. Search matches parent/child names, the
parent summary and the child's boundary explanation, keeping a matching child's
parent visible.

The profile opens with summary and context, then recognition and the reason for its
boundary. Ruled sections hold jobs and product value; trigger, discovery, first use,
payment decision and retention; user, decision maker and payer; alternatives; narrower
profiles; and unresolved questions. Profile, Alternatives and Research are the three
primary tabs. A child returns to its parent. Checks, job graphs and channel history
remain addressable through Research; an opened secondary topic joins the local tabs.

Every profile assertion carries `text`, `basis` and `sourceRefs`. The assertion itself
uses `sourceText`: normal reading text with a quiet dotted underline, without a
separate information icon. Hover after a short delay or keyboard focus opens a
nonmodal source preview beside the text. Click/tap pins it; Enter, Space or ArrowDown
moves focus into it. Its contents remain selectable, scrollable and interactive.
The pointer can cross from the claim into the panel. Escape/close returns focus;
leaving an unpinned preview or clicking outside dismisses it without moving focus.
The text remains selectable. Inline reading triggers are exempt from standalone
44px button sizing; close controls and source links retain their normal targets.

A single visible profile status distinguishes authorship (AI proposal or expert
opinion) from current interview support, partial research, stale and conflicting
evidence. Its text opens the same preview with profile provenance and access to
retained research. Do not hide conflict or stale warnings in a hover state. Each
child uses its own evidence. Missing sources remain explicit. Document paths wrap
inside the panel at narrow width and enlarged text; long content scrolls within
the viewport. References remain document references, not invented quotations or
proof of demand. The shared `mountSourcePreviews` lifecycle owns positioning, pointer,
keyboard/touch behavior and dismissal; domain adapters supply saved content only.

Research places checks before the dossier registry. A registry longer than ten records
initially shows ten, supports search over all records and explicit expansion, and
states that several materials may describe one person. Existing group research stays with that
group; a new profile does not inherit its respondents or validation. Reports and agent
tasks live in the shell's Tools disclosure, which opens for an active tool route.

Preview/value columns and paired profile sections stack when their available container
is at most 48rem wide; child rows stack at the same threshold. Journey columns fit the
available width. Mobile uses the existing spacing tokens more compactly without
shrinking type or targets. Verify 390px, 200% text, keyboard source access and focus
return with actual claims and long references.

The active catalog has no parameter workspace, comparison of selected conditions or
save-selection action. Historical parameter data and compatibility adapters remain
available for audit; their presence is not a current composition contract. New brief
preparation and research workflows use the shared customer-profile contract in
`bin/customer-profile.js` and `skills/product-deep-research/references/customer-profile.md`.

The reading composition is the default customer profile inside the full console.
`?profile-reading=0` retains the prior composition for source-binding comparison.
The shell, icons, routing, source controllers, dossiers and actions keep their
production behavior; no exported snapshot replaces them. The reading model preserves exact profile facts and source
bindings, moves unknown journey fields into the open questions section with their
subjects, and uses shared button geometry for explicit navigation actions. Claim
text and inline names retain their reading/source semantics.

The research preview separates materials about clients from what those materials
support. Explain interview support alongside its exact answer control; stale and
conflicting warnings remain open. A material count does not validate a profile.
Related routes explain three different tasks: checking hypotheses, understanding
client jobs, and reading how clients found solutions. Client jobs must not appear
to be the researcher's work items. `/design-system#catalog-research-meaning` uses
fictional empty, survey-only, supported, stale and conflicting states.


### Общие списки и документы

`summaryCard({title, href, level, meta, content, actions, attributes})` — общая оболочка записи в списках сегментов, конкурентов и каналов. Заголовок экранируется; `meta/content/actions` — доверенные HTML-слоты. Карточка не выводит поля, которых нет в данных, и не накрывает источники общей кликабельной областью. Действие открытия использует `button({href})` или ссылку названия; служебные и редакторские действия остаются отдельными контролами. Вложенные карточки для одной и той же записи запрещены.

`readingSections({sections, contentsTitle})` собирает открытые `readingSection` и одно оглавление `readingLayout`, если разделов несколько. Идентификаторы задаются адаптером, не вычисляются из текста. Оглавление меняет положение в документе и текущий пункт, не маршрут. Общие компоненты владеют кеглем, отступами и зоной нажатия; доменные адаптеры — содержанием и источниками. Пример и регрессия: `/design-system#catalog-shared-pages`, `visual-tests/shared-pages.spec.js`.

Для всех объектов: заголовок и возврат → один набор верхних вкладок → содержимое активной вкладки → оглавление длинного документа справа. Отсутствие данных не удаляет вкладку и отображается как пробел. Переходы к соседним вкладкам не дублируются кнопками в теле и оглавлении. Общие наблюдения о группе решений не изображаются отдельным проверенным продуктом. Все сохранённые сведения, ограничения и исходники остаются доступны.


Чтение конкурентов: список использует `summaryCard({title,href})` с одним переходом в заголовке, без второй кнопки открытия. Одна группа содержит плоский список записей; категории показаны как контекст карточки, групповые наблюдения явно отличены от конкретного сервиса. Документ использует постоянные темы, `readingSections` и `pageHeader.actions` для сайта. Рабочая проверка и неизвестные сведения находятся в «Что уточнить». Адаптер переводит только известные сохранённые формулировки; оригиналы доступны у утверждения и в «Исходных формулировках». Связь с задачей не означает доказанного выполнения, упоминание не означает использования. Пример `/design-system#catalog-competitor-reading`, регрессия `visual-tests/competitor-reading.spec.js`.


Идеи развития используют тот же `summaryCard({title,href})`: название открывает адресуемый документ `#product/development/<id>`, без раскрытия карточки в списке. Фильтры по сегментам сняты; старые ссылки показывают полный список. Страница идеи собирается из `pageHeader`, постоянных вкладок продукта и `readingSections`; проблема, результат, сегменты, шаги, зависимости, риски, источники и сохранённые предложения проверок остаются доступны. Пробелы и проблемы связей показываются явно. Нового компонента карточки идеи нет. Пример `/design-system#catalog-development-reading`, регрессия `visual-tests/development-reading.spec.js`.

## Compact collection controls

Collection filters start collapsed behind the compact shared “Фильтры” disclosure, including Competitors list/map. An applied indication remains visible when conditions are selected, including URL entry. Opening/closing retains selection; changing conditions keeps the panel open through query rerenders. Fresh entry starts closed; disclosure state belongs to the current route, never a global preference. Result scope/counts and unknown/mixed/empty warnings remain outside the panel. Essential graph/source navigation stays visible and does not use a Filters caption. Direction/category options retain scope and counts; selected long context wraps with the results.

`pagination({page,pages,total,size,href,label,context})` composes existing buttons with one range/page line. Native links navigate, native disabled buttons mark boundaries; one-page lists show their count without “page 1 of 1” or inert controls. Repeat controls below a multi-page list. The owner is ui-components.js/.css; the executable example is #catalog-collection-controls and the production reference/element examples.

References reuse ready read-only library data in memory for five minutes, at most three product/library keys. Pending reads are shared across list/detail/materials route changes. Explicit refresh reads the API; errors and incomplete loading states are never retained as successful cache entries. No local/session storage or product writes. Request-count and cache race regressions are in product-references.spec.js and reference-library-cache.test.js.

### Обзорные области без запуска задач
Product, Segments, Competitors и Channels читают сохранённые данные. В них нет launch/edit/work controls; предложения проверок — текст, источники и неизвестности сохраняются. Задачи и редактор брифов доступны в Tools (`skills`), API/CLI не удаляются. Постоянная тема продукта `brief` открывает GET-only список/документ; временные темы не создаются. Capability statement сам является shared disclosure summary; источник открывается внутри, без вложенного интерактивного элемента в summary. Channels используют summaryCard title href, постоянные темы overview/content/rubrics/references, readingSections. Segment filters Development/Channels/Competitors отсутствуют; legacy query не скрывает данные. References показывают ограничения подборки и первоисточники; JSON manifests/AI controls отсутствуют. Ready refresh убран, retry остаётся для недоступных чтений. Production example #catalog-read-only-navigation; read-only-navigation.spec.js покрывает маршруты, keyboard, sources, stale/empty/error и отсутствие записей.

Сохранённый контекст в документе брифа — открытый `proseFacts`: полный текст виден сразу с сохранёнными абзацами. Источники и вспомогательные подробности сохраняют свои контролы.
