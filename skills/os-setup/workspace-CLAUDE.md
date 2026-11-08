<!-- product-os:research:start -->
# Product OS

This folder is a product workspace. Use the goals, constraints and known context
in PRODUCT.md. Do not ask the owner to repeat information already saved.

## Available skills

- `os-setup`: create or repair the workspace while preserving existing data.
- `product-context`: save materials and context with their sources.
- `product-status`: review saved context and suggest a grounded next step.
- `product-research`: investigate one question using public sources and save a
  report with findings, counterarguments and unknowns.
- `product-segment-hypotheses`: map potential customers with an independent critique.
  Without an independent critic, label the result an unreviewed draft.
- `product-job-map`: map customer jobs and the product's contribution and limits.
- `product-brand-identity`: develop a brand brief, directions, logo and identity system.
- `product-reference-library`: collect sourced examples of how others solve a problem.

Specialized interview processing, deep market research, content production and
implementation skills are outside this edition.

## Custom skills and privacy

When asked to create, add, edit or publish a custom skill, read CUSTOM-SKILLS.md in
the installed runtime. `skills` commands keep extensions separate from bundled
skills and preserve them across updates. Do not suggest publishing automatically.
Prepare a PR only when asked, preserve authorship, and publish only after the
user authorizes the specific reviewed package. Do not send usage events.

## Files

PRODUCT.md holds the product profile; `sources/` holds originals; `reports/` holds
derived notes; research-graph.json holds structured memory; MOVES.md holds chosen
actions; IDEAS.md holds ideas not yet selected. Read only the relevant slice.

Distinguish facts, owner statements, observations and hypotheses. Keep exact sources.
Do not invent customers, payments, results or evidence of demand. Use the shared
writer for memory changes. Advice alone does not create a task. Preserve existing
instructions and data, including their original language. Use English for new
Product OS templates; respond in the user's requested language.

## Run and share

When asked to share the console, read SHARING.md in the runtime. Offer public access
or a password, recommending a password for private data. Respect an existing choice.
The team receives a read-only snapshot; local preparation does not publish it.
Request passwords through secure input, never in chat. Review the contents before
publishing within the user's authorization.

Look for the runtime in `.claude/skills/product-os-tools` in this product, then in
`~/.claude/skills/product-os-tools`. If absent, check the other agent's environment.
Verify `bin/product-os.js` exists and use its absolute path. A shared installation
does not need to be copied into each product folder.

Use `node <tools>/bin/product-os.js help` for commands and
`node <tools>/bin/product-os.js <workspace>` for the local console. The interface
reads shared product memory; do not create a separate dashboard for one report.

Finish assigned work with a verifiable result and state limitations honestly.
Questions about saved data remain read operations. Base next-step advice on the
owner's goal; do not start another study without an instruction.
<!-- product-os:research:end -->
