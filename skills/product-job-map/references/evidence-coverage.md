# When interviews or other research already exist

Read this when building or updating a map from existing customer materials.
Explaining one saved job does not initiate this process. Without research, build
explicit hypotheses from the product; interviews are not a prerequisite.

## Establish coverage before drawing

Start with the current synthesis through the shared reader:
`node <tools>/bin/product-os.js research summary <workspace> segmentId=<id> topic=jobs`.
Use `research read` and `research source` for specific records. This edition has no
interview-processing skill; these instructions apply when a research registry
already exists in the workspace.

Record scope, revision, superseded material and gaps. Then assemble the complete
list of individual jobs for the task, not merely examples in the synthesis or
current segments. Reuse extracted jobs, cases, criteria, statements and source
references instead of rereading every transcript. Open an original for a specific
omission, conflict or unclear wording.

For a typed registry, prepare one snapshot before generation:

```sh
node <skill>/scripts/research-inputs.cjs <workspace> productId=<id> > <workspace>/reports/job-map/<run>/research-inputs.json
```

The script uses the shared read-only registry snapshot and includes **all current
JobInstance records for the product**, regardless of segment focus. Superseded
versions do not become extra people. It includes original/normalized wording,
actors and cases, cited evidence, criteria, statement states, saved relationships
and field provenance. It excludes full transcripts and unrelated respondent data.

Duplicate quotations and notes appear once in `evidence` and `notes` dictionaries;
`evidenceRefIds` and `noteId` preserve exact links. Read the full `jobs` list first,
then expand relevant cases by ID. Give an independent reviewer the complete snapshot
as an accessible file, not examples selected by the generator.

An empty registry does not prove interviews are absent. Check saved indexes and
analyses: older jobs may exist only in the graph or reports. Add them to the input
inventory with exact sources. Unprocessed interviews remain outside this edition's
capabilities; report the gap and leave completeness unverified. Do not extract a
competing second version of individual research facts.

If records are unavailable or only part of the corpus is accounted for, save a
partial map with exact scope. Do not retroactively narrow the inputs to the drawn
nodes. Resolve unknown product ownership through saved research relationships;
a read error does not mean zero jobs.

## Connect evidence and hypotheses

Each snapshot job gets an `inventory` row. Preserve `id`, `text` and `evidence`
unchanged; add `jobIds`, the mapping rationale and `sourceRefs`. The same evidence
must be available on its corresponding map job.

Several cases can share a node if the outcome matches. Their contexts, alternatives,
criteria and sources remain separate in snapshots and profiles. Split different
outcomes even when their names are similar.

New hypotheses, higher outcomes and connecting jobs are allowed. Their proximity
to an interview job does not validate them or their causal edges. An analytical
formulation is not a verbatim quote; respondent wording remains in `evidenceRefs`.

Keep external jobs visible. Missing product capabilities, diagram complexity or
current focus do not justify dropping known jobs from a product-wide map. For an
explicitly narrow task, retain the remaining jobs in the overall coverage registry
and state the uncovered scope. A fragment is not a complete map.

## Verify

Run check-map with `--research-inputs reports/job-map/<run>/research-inputs.json`.
With a registry, the validator also checks current records without that flag;
a supplied snapshot is additionally checked for freshness. `--inventory` alone
does not replace registry reconciliation.

The critic receives the original snapshot, map and mappings. They check each merge
and the basis of each title. The structural validator checks record/link integrity,
not semantic equivalence. Report known-job coverage, extraction gaps and map
hypotheses separately. Complete coverage does not prove demand or product advantage.
