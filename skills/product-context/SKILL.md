---
name: product-context
description: Save new product materials and facts with exact sources, update the product profile and reconcile supplied evidence with existing context. Use for "add context", "save this material", "here is new data" or "accept these results". Read-only status and next-step questions belong to product-status.
user-invocable: true
---

# Add product context

Save incoming information so it can be found, checked and used in later decisions.
Saving a source and analyzing it are separate outcomes.

Read [CONTRACT.md](../CONTRACT.md), [GRAPH.md](../GRAPH.md) and
[GRAPH-WRITES.md](../GRAPH-WRITES.md). Find the installed runtime in the agent's
product folder or home directory, or use a toolkit checkout. Resolve `<tools>`
to its absolute path; `<workspace>` is always the selected product folder.
A shared installation does not require a local copy in each product.

## Save and reconcile

1. Read PRODUCT.md and only the relevant graph records. Identify the incoming
   material: a note, interview, analytics, sales, economics, competitor information
   or an existing report.
2. Preserve the original in `sources/`. For a file, run
   `node <tools>/bin/product-os.js import <workspace> <file>`.
   For supplied text, create a source file first and then import it. The command
   returns its ID and path, checks bytes and deduplicates identical material.
3. Within the requested scope, add a short note or extract relevant facts. Keep
   exact pointers to the original: a passage, line or page. Distinguish the author's
   words, direct observations, the researcher's conclusions and hypotheses.
4. Update existing records using stable IDs. Do not infer links from similar words
   or treat a saved file as evidence of demand.
5. Write graph changes as typed operations through
   `node <tools>/bin/product-os.js graph-write <workspace> <operations.json>`.
   Use the current `expectedRevision`; individual research also requires
   `expectedResearchRevision`. Save originals and reports before updating shared
   memory. On a revision conflict, reread the relevant slice and reconcile it.

A request to save material does not authorize full interview analysis, synthesis
of the entire archive or a new study. Save the supplied sources and information
within the capabilities of this edition.

## Update and finish

Update PRODUCT.md only when new information concerns the product itself. Preserve
contradictions and their history; status changes need suitable linked evidence.
An idea remains an idea. Add an action to MOVES.md only when chosen by the owner
or required by an already assigned task.

Report the actual change: what was saved, added or clarified; what conflicts with
previous information; and what remains unknown. Link to the files. Use
`product-status` for a separate status review.

If a task was launched from the console, preserve its `runId`, `nodeId` and `skill`.
Save a `receipt` through the shared writer with an existing report or a concrete
summary and the actual outcome. Never reuse another run's report or claim analysis
is complete merely because a source was saved.

Done means originals are preserved, extracted information has been checked against
sources, changes are valid and unfinished work is stated. Saving context does not
include publication.
