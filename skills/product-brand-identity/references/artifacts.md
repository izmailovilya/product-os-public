# Result, versions and shared memory

## Launch files

One report `reports/product-brand-identity/<timestamp>_<slug>.md`, next to one of the same name
folder. It contains `identity.json`, masters/, exports/, previews/ and ordered documents.
These are recommended folders, not required empty directories. PDF presentation and brand guidelines —
output branded artifacts, analytical report remains alone. Sources by user
remain in place; if necessary, exact copies with origin - in sources/.

Each version completed or shown to the user is immutable. To continue
make a new timestamp/version and basedOn, save the selected direction and bases.
You can edit current working exports before display; after change update SHA-256 and
repeat QA. When waiting for a choice, save draft + waitingFor so that another agent can
continue. The proposed options have not yet been rejected; only explicitly included in IDEAS
pending decisions on CONTRACT.

## identity.json

Copy assets/identity.template.json and fill it in, don't leave the template as the result.
All `path`, `renderPath` and `basedOn.manifestFile` are relative to the workspace root,
no JSON folders. Selected examples below are diagrams and not product specific data.

- `schemaVersion`: 3 for new versions; saved `presentation` is described in
[presentation.md](presentation.md). Validator accepts 1, 2 and 3: for 2/3 no `check`,
`demoFileIds`, page locator for the method and small sign preview - error, for 1
(previously released versions) - warning only; in the version folders with scheme 1 it is nothing
does not write.
- `product`: `{id, name}`; id exists in the graph or null when working without a graph.
- `version`: positive integer. `basedOn`: null or `{manifestFile, artifactId?}`;
previous version of the same product, without cycles, with a lower number.
- `scope`: logo / brand / system. `stage`: brief / directions / system / handoff.
- `readiness`: draft / ready-for-review. `decision`: proposed / accepted.
accepted requires `decisionSource` with real selection of the entire version. Choice of concept
in `selectionSource` itself does not accept files of the new system that have not yet been shown.
- `selectedDirection`: ID of the selected direction or null. For existing system
one direction can be written with the original assets; repeated alternatives are not needed.
`selectionSource`: exact locator for selecting or instructing the agent to select independently.
`waitingFor`: string with remaining input/solution or null.
- `requestedDeliverables`: ordered subset brief/concepts/identity-system/
logobook/asset-pack/applications. Don't cut it for the sake of a green check.
- `sources`: `{id, kind, locator, viewed, note?}`; kind: user-requirement,
product-evidence, style-reference, existing-brand-asset, method. URL/locator is valid;
copies of files, if made, are also registered in files. Methodological source not
turns into proof of demand, reference into product data. Source
`method` specifies locator to page or principle (`…/pages/0097.txt`,
`…ch02.xhtml#lev853`, or “Johnson, p. 93" without base), and not the entire base index;
Index is only valid as a separate source for "read synthesis X". Screenshots
alternatives from the category - `style-reference` with URL, date and copy in sources/.
- `assumptions`: `{id, statement, basis, fatal, status, check?, checkResult?}`; status
open / checked / withdrawn. For `fatal: true`, the `check` field is required: specific
cheap protocol with a threshold that can be completed in a day without a new study -
“show the cover for 5 seconds to five people from the segment, ask what kind of company and what
does; threshold: 3 out of 5 call payment for subscriptions.” `checkResult` is filled in at
transition to checked/withdrawn with date and observation. The number of open/fatal outputs
validator; the presence of zeros does not prove the market. When a complete order is completed, report
puts each open fatal assumption into the “Next cheap move” block: `check` as
proposed move (what checks, threshold, what closes) or as a check task
people from the segment (segment, number of people, question, threshold). This is an offer, not
obligation: it gets into MOVES.md through the common writer only when selecting the owner
or within the already permitted volume; otherwise it is parked in IDEAS.md via CONTRACT - one
a line with a link to the report and a return condition, without a copy of the protocol. Assumption,
open three versions in a row without `check`, a process defect, not a “known risk”.
- `rules`: `{id, topic, value, rationale, sourceIds, strength, scope?, exceptions?,
demoFileIds?, pairs?}`; strength required/preferred/candidate. Direct limitation
user remains required even in the proposed version; observation of someone else
work is not a requirement. Rule `required` has `demoFileIds` - at least one file from
`files`, where the rule is visible (layout, brand guidelines page, preview); rule without
demonstrations - candidate. If `required` relies on source `method`, this source is
has a locator to a page or principle. For `topic: color` pair “text on background”
written to `pairs: [{fg, bg, role, minRatio}]` in hex; validator prints
contrast ratio, threshold `minRatio` sets the product. Old versions without these fields
remain valid; requirement applies to new versions.
- `presentation`: author's composition from visual blocks associated with files.
For schema 3, required before `ready-for-review`; in draft, null is allowed.
The order and set of blocks depends on the brand; mandatory rules, sources and scope
Acceptances are saved. The console does not regenerate anything when reading.
- `directions`: `{id, label, rationale, fileIds, tradeoffs}`. fileIds point to real
visuals for comparison; selectedDirection refers to one of the entries.
- `files`: `{id, role, path, sha256, purpose?}`. role: source / concept-board / logo / palette /
  typography / application / presentation / logobook / delivery-index / preview.
SHA-256 is counted by actual bytes, for example via shasum -a 256. Digital
media (icon, favicon, avatar, og-image, letter) - role application with `purpose`
  (`app-icon-32`, `favicon`, `avatar-round`, `og-image`, `email-header`, `dark-theme`);
small preview of the sign from the validator - role preview in `previews/`.
- `deliverables`: `{kind, fileIds}`. Material result of each ordered type.
brief can point to a single report, identity-system can point to the same report,
diagrams and samples; logobook - for a real document, asset-pack - for a master, exports
and index. One user source does not count as a result produced.
- `qa`: `{fileId, sha256, viewed, viewSize, result, issues, renderPath?}`.
issues: `{severity: blocking|minor, detail}`. The view refers to the specified hash.
For PDF/PPTX, the page list/viewing conditions are reflected in result; no
blocking comments does not equal automatic acceptance of the design.

Before ready-for-review, all ordered deliverables exist; visuals (concept-board,
logo, application, presentation and visual brand guidelines) actually viewed, version
QA matches file; there are no blocking questions; each fatal assumption has
`check`; each `required` has a demonstrating file; sign preview 16/32/64 px have
QA records. The broad search and discarded ideas table are stored in the report, not in JSON. For system/handoff you need
selected direction. The brief and concept stage can be ready to review on their own,
but this is not completing a complete order with missing files. In ready-for-review for
Complete order includes all requested kit and inspection; the direction itself remains
proposed, if the user did not accept the result.

## Partial selection and feedback

`decision` applies to the entire version. For partial selection, save in the same
identity.json `selectionHistory`: `{target, decision, source}` records for specific
direction, sign or application. `target` is uniquely associated with real files
or the rules of this version; for the sign you can use `selectedLogo` and
`selectedLogoFiles`. `source` is the owner's exact decision, not an agent's recommendation.
No need to add empty fields or migrate older versions where there are no partial solutions.
This is supporting data: the file validator does not check the meaning and authority of the selection.

When continuing, read the solutions and subsequent clarifications in their area, save
accepted assets and mark proposed ones. Do not expand the acceptance of the sign to the entire system,
refusal of one application - on the sign itself, and positive feedback on the form - on everything
its placement. Failure of the selection form does not cancel the clear answer in the message.

For correction, save `feedback` with source, subject, area and action.
First find a specific element by file or user fragment. Then determine,
Which applications are included in the edit and which remain the same. The report contains enough
short entry: request → affected files → check performed. Check everything
Ordered set including cover, guide, gallery and ZIP if they contain this item.
If the area is undefined, make an obvious local edit; the general rule is leave
by proposal, do not announce a global ban.

Collect the new version from the current list of submitted files. Check that rejected
Applications were not returned from old exports or generator. The historical versions themselves
saved. QA applies to new bytes; immutable assets can be verified by hash,
without attributing them a second visual viewing.

## Graph and further application

In the existing graph - regular `artifact`, `data.kind: visual-profile`, additionally
`artifactKind: brand-identity`, `productId`, `segmentIds`, `version`, `decision`,
`decisionSource` with accepted, `readiness`, `profileFile` on identity.json. **Without channelId:**
This is a brand system. `source` is the path of a single report without fragment. `supersedes`—
only previous brand-identity of the same product; basedOn indicates previous
identity.json version, other inputs are stored in sources. Do not replace arbitrary product-level visual-profile only
because it also does not have a channelId. The node remains hypothesis: design approval is not
increases its market status.

Writer operations by GRAPH-WRITES: `node` profile, optionally selected `move`,
and `complete` for precise triggering. First the files and validate.cjs, then dry run the package
with expectedRevision and application. If there is a conflict, re-read the revision, do not overdo it. Without
a graph, deliver files with product.id=null; do not create a second PRODUCT.md or
fictional segments. If registration was requested, but runtime is not available, report that gap.

To apply the brand, use registered ready-made files (`files` with `purpose`)
and the required rules of the accepted version. Changing one medium does not change the brand
and does not become a general rebranding.

A short summary in the chat contains main images, links to files, completed volume,
choice/status and remaining questions. Do not provide only JSON or future production plan.
