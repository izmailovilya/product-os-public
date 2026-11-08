# Format for the standard job map viewer

Read before saving map. This is a data format, not a way to come up with job.
UI and API already exist: do not create new HTML, React Flow prototype or console copy.

The working file `reports/job-map/<run>/map.json` is a regular JSON that the console reads;
It cannot be replaced by a compressed diagnostic archive. One narrative report nearby.
Diagnostics and review - separate internal materials, sources are not rewritten.

Root:

```json
{
  "version": 1,
  "title": "Product job map",
  "basis": "Hypotheses from the product description; real cases have not yet been studied.",
  "scope": {"productId": "product-id", "goal": "Select jobs for research", "edition": "full"},
  "editions": {"full": "Current product", "public": "Separate version not described"},
  "jobs": {},
  "graphs": [],
  "contexts": [],
  "sources": {},
  "inventory": [],
  "review": {"status": "unreviewed", "sourceRefs": []}
}
```

`jobs` - object by stable ID. One entry:

```json
{
  "id": "job-choice", "label": "Select next episode",
  "kind": "original", "originalLabel": "original wording if available",
  "description": "What a person is trying to change and in what situation.",
  "input": "What is needed for this job.", "output": "Verified job result.",
  "mechanism": "How the product contribution can improve the result and under what conditions.",
  "alternatives": "Current method; if unknown - clearly a hypothesis or gap.",
  "basis": "hypothesis", "sourceRefs": ["product-description"],
  "full": {"state": "assist", "contribution": "Product specific help.",
    "limit": "What is not provided.", "sources": ["product-description"]},
  "public": {"state": "unknown", "contribution": "Separate version not described.",
    "limit": "Features of this version are unknown.", "sources": []}
}
```

`kind`: `original` (input list), `higher` (top fragment job), `bridge`
(added linking job), `external` (external execution), `proposed` (idea
extensions). This is a role in the document, **not** level Big/Core/Small/Micro.
`basis`: `hypothesis`, `owner`, `source`; it describes origin, not quality.
`sourceRefs` references existing entries `sources`.

`full` and `public` are offering slots: `full` describes the main current offering;
`public` describes a separately defined free/public edition, if one exists.
Optional `scope.edition: "full"|"public"` selects the slot the viewer displays.
For a product with one offering, use `"edition": "full"`, record its contribution
in `full`, and leave `public` unknown. Choose `public` only when the owner explicitly
investigates that actual offering. Do not invent a paid tier or copy slot values
because they seem similar. Preserve both slots and the saved edition during updates.
Legacy maps without `scope.edition` default to `full`.

`state`: `ready` - there is a named valid procedure; `assist` - help with part;
`change` - needs improvement; `external` - action required outside the product;
`unknown` - capabilities not established. For `change` add `change` with specific
change. The presence of a procedure does not prove a better result for the buyer.

`graphs`: `{id,title,jobIds,edges,note,boundary}`. `id` matches the ID of the top job
this fragment, it is included in `jobIds`. Edges `{from,to,why,basis,sourceRefs,condition?}`
go **from means to ends**. Any job shown must have a path to the top;
no reliable connection - a separate fragment with an explanation, not a fictitious edge.
Don't make a loop of alternatives, don't write down the calendar sequence
as in "to". `condition` stores the conditions of a specific path. `boundary` explains,
What end result is the product not fulfilling here? One job ID can occur
in several fragments; equal words in themselves are not a basis for combining jobs.

`contexts`: `{id,segmentId?,ideaId?,graphs,jobIds,excludedJobIds?,reason}`.
An empty array is acceptable when segments have not yet been created. New groups of people before their
save designs in the report, and not as links to non-existent profiles.
`segmentId` - real profile ID; `ideaId` - real ID of the deferred idea
(`artifactId:ideaId`). Exactly one of them. `reason` explains exactly this connection.
Communication via `graphs` remains provisional and does not imply ownership of each
jobs. `jobIds` - separately proposed connections with specific jobs.
Do not write general ones here `criteria`: reader takes conditions and criteria from the exact
current segment profile. Its criteria do not become the criteria of every job.

`sources`: object by ID, records `{kind,title,text,path?,url?,document?}`.
The text describes the source and the extent of its application. `path` - exact existing path
in workspace, without the prefix “(lines...)”. `document` - optional exact local
snapshot, not a retelling under the guise of the original. Do not download the source for the sake of filling out the diagram.

If the input was a job list, `inventory` stores **every** item:
`{id,text,jobIds,reason}`. When combined, multiple origins may have
one job ID, but the equality of meaning needs to be explained. For explicitly excluded from scope
items: `decision: "out_of_scope"`, empty `jobIds` and specific reason; show it
in the report. Don't silently shorten the list because of length. If there was no list, `inventory: []`.

In an existing study, the original list is supplemented with all jobs from
`research-inputs.json` according to [coverage rule](evidence-coverage.md). For each
save exported `id` (`research:<recordId>`), `text` and object `evidence`
no change; add `jobIds`, `reason`, `sourceRefs`. `evidence` saves version
records, case, actor and cited reasons. `sourceRefs` should lead to
corresponding snapshot/evidence from `sources` and present in the related job.
For such lines `out_of_scope` is not valid: the job remains on the map even if
the product does not fulfill it. One row for each case is also saved for the general
job ID. Individual hypotheses do not require fictitious references to respondents.

`review`: `status: unreviewed|reviewed`, `sourceRefs` for saved analysis. Not
Pass off the self-test as an independent review. The inspector must name objections and
their decisions; a valid scheme and model agreement do not mean confirmed demand.

## Verification and registration

From checkout Product OS:

```sh
node skills/product-job-map/scripts/check-map.cjs <workspace> reports/job-map/<run>/map.json
```

With the skill installed, run the same script inside its `scripts/`. General runtime
allowed by installer; Do not hard-code paths from another machine. `--inventory <relative.json>`
Checks the map against the exact input array `{id,text}`. `--require-reviewed` checks
presence of a review record, but does not evaluate its quality.

`--research-inputs reports/job-map/<run>/research-inputs.json` checks saved
input with the current research revision. If workspace checker is available, automatically
checks all currently registered product jobs: skip, exception,
substitution of the source text/case/base or lack of connection with the node gives an error.
Checking without a workspace/registry does not confirm the completeness of the respondents’ jobs.
Incomplete interview extraction remains a separate warning. Saved
historical maps remain readable; the new requirement does not overwrite their data.

After the semantic check, save the report and apply the usual `graph-write`:

```json
{
  "schemaVersion": 1,
  "expectedRevision": 7,
  "source": "reports/job-map/run/report.md",
  "operations": [{"op":"node","node":{
    "id":"artifact-job-map-product","type":"artifact","label":"Job map",
    "status":"hypothesis",
    "data":{"confidence":"ai","artifactKind":"strategic-job-map","version":1,
      "productId":"product-id","mapPath":"reports/job-map/run/map.json",
      "mapSha256":"SHA256 exact bytes map.json"}
  }}]
}
```

Get the real ID, revision and SHA from the workspace. Use the ID of the previous active
artifact during update: the pointer to the new version changes, the old file remains.
If there are several active maps, resolve the conflict explicitly. Check the existence of the product,
segments and ideas via the passed graph; do not create them to pass verification.
`graph-write --dry`, then apply and `--check`. Check GET `/api/strategic-jobs` and
open the “Job Map” section in the console (`#jobs`): all jobs, connections, source and return. Successful JSON without
verified reader - incomplete delivery to the console.
