# Write product memory

Commands are executed by the tools of the selected installation: `node <tools>/bin/product-os.js`,
where `<tools>` is the absolute path to the user’s local or shared runtime.
Folder `<workspace>` contains product-specific data and is transferred separately.

Save the original first, then the structured information. For regular
material use `product-os import <workspace> <file>`: command copies
no bytes changed, checks for re-import and registers artifact.

If you need additions to already known information, prepare a JSON package:

```json
{
  "schemaVersion": 1,
  "expectedRevision": 1,
  "source": "PRODUCT.md",
  "operations": [
    {
      "op": "node",
      "node": {
        "id": "product",
        "type": "product",
        "label": "Product name",
        "status": "hypothesis",
        "data": {
          "description": {
            "what": "Description from the owner's passport",
            "forWhom": null,
            "outcome": null
          }
        }
      }
    }
  ]
}
```

Take the real expectedRevision and the existing ID from the current graph;
the number and ID in the example are not blindly substituted. The source must exist.

```sh
node <tools>/bin/product-os.js graph-write <workspace> <operations.json> --dry
node <tools>/bin/product-os.js graph-write <workspace> <operations.json>
node <tools>/bin/graph-write.js <workspace> --check
```

Typed operations node, edge, evidence, transition, move,
 are supported
receipt and other compatible writer operations. Their circuits are defined in
`bin/graph/writer.js` and `bin/graph/schema.js`. To save a document for the first time
additional nodes, connections and actions are not needed.

- evidence requires a specific target, text, source and origin of the observation.
For the source file, specify the exact location: line, fragment or page.
- transition refers to already recorded evidenceIds; contradictions persist.
- move is created only for the selected or assigned action. Don't write down
advice as an accepted task and do not edit MOVES.md bypassing the shared writer.
- receipt is needed for a task launched from the console: save it runId, nodeId and
skill; indicate the actual outcome and the existing report or short summary.
Do not pass off saving the file as analysis completed.

Writer performs validation, locking and consistent writing of graph and actions.
If there is a revision conflict, re-read the necessary records and agree on the change with them.
Do not disable the check and do not overwrite newer information.

Simply reading through product-status does not create a report, receipt, task or record.
The reading result remains in the response to the owner.

## Skill reports

Skill report - Markdown in `reports/` with frontmatter: `title`, `date` (YYYY-MM-DD),
`skill` (skill slug), `nodeId` target, `outcome: completed|partial|failed`, `summary`.
The list of studies in the console is built from these fields; `visibility: internal` removes
Work materials from the list without deleting the file. Link the report to the node operation
`complete`: `{op:"complete", nodeId, skill, report:"reports/…​.md", outcome}`.

## Strategic job map

The product has one valid `artifact` with `data.artifactKind: "strategic-job-map"`,
`version: 1`, `productId` and `mapPath` to existing `reports/job-map/<run>/map.json`
(plus `mapSha256` exact bytes). Clearly leave the previous active card aside. Format
cards - in skill `product-job-map` (`references/map-format.md`); there is also a script
checks. Optional `scope.edition: "full"|"public"` selects coverage
offers; the missing field reads `full`. Read in the console under
“Map of works”.

## Deferred audience ideas

Save promising but not yet selected applications as `artifact` with
`data.artifactKind: "audience-ideas"`, `version: 1` and `data.ideas:
[{id, title, focus: "deferred", benefit, deferredReason, report}]`; `report` —
existing `reports/*.md` of this idea. Don't make up complete profiles; console
Shows ideas below the segment map.

## Brand identity

`artifact` with `data.kind: "visual-profile"`, `artifactKind: "brand-identity"`,
`productId`, `profileFile` on identity.json, `version`, `decision: proposed|accepted`
(`accepted` - only with `decisionSource` - explicit owner decision). Format
identity.json and validator - in skill `product-brand-identity`. Console reads
profile in the “Library” → “Identity” section; proposed and accepted versions
shown separately.

## Reference library

`artifact` with `data.kind: "content-pack"`, `artifactKind: "product-reference-library"`,
`productId`, `manifestFile` on manifest schemaVersion 1 (`tracks[].cardsPath/
sourcesPath/…`). File formats are defined by the skill contract for `product-reference-library`.
Library without independent verification is saved with `readiness: "draft"`.
Read in the “Library” → “References” section and via `product-os references read`.
