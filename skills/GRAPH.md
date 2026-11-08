# Product memory

`research-graph.json` stores structured records and relationships. Original
materials are in sources/, derived texts are in reports/.
The file is created and modified only by the shared writer; don't rewrite JSON manually.

## Main entries

| Type | Contents |
| --- | --- |
| product | Product, Description, Stage, Purpose and Limitations |
| artifact | Saved material or derivative document |
| evidence | Specific observation with exact source |
| assumption | Testable assumption |
| move | Selected action |
| segment, job, criterion | Already known group of clients, its task and result criterion |
| competitor | Well-known alternative |

The ontology is closed. A complete list of compatible types and allowed relationships can be found in
to `bin/graph/schema.js`. You cannot invent new types or combine records only
similar words. To store a regular document, artifact.
 is enough

The entry has a stable id, type, label, status, source and data. source — relative
path to an existing original, specifying the location when needed. Product stores
`data.description = {what, forWhom, outcome}`; unknown value - null.

Statuses: hypothesis, evidenced, validated, contradicted, dropped. Source and
Fair attribution is more important than status. The saved file does not become verified output.
Do not change the status to validated just because the material contains the opinion of the author.
Associated certificates are required to change status; writer checks it.

Existing individual study data remains compatible with the console.
Commands `research read`, `research source`, `research summary`, `research audit`
read what is saved and do not research anything on their own. Strategic map
works - separate JSON document in reports/, registered as artifact
from `artifactKind: "strategic-job-map"` (see [GRAPH-WRITES.md](GRAPH-WRITES.md)).

Writing rules and example packet: [GRAPH-WRITES.md](GRAPH-WRITES.md).
