---
name: os-setup
description: Create or repair a Product OS workspace, capture its product profile from known context, and open the local console. Use for "set up the workspace", "start a product" or "os setup".
---

# Set up Product OS

Create a product workspace, save the known context and show it in the console.
Do not start market research or invent customer information.

Read [the operating rules](../CONTRACT.md) and
[the memory writing guide](../GRAPH-WRITES.md). Work in a separate product folder,
not the toolkit repository.

## Context

Use the conversation and existing PRODUCT.md first. Clarify only missing information
needed to continue: the product, stage, goal, constraints and market. Do not ask
for known answers. Record unknowns explicitly. Distinguish owner statements,
source observations and your assumptions.

## Create or repair

`<tools>` is the absolute path to the installed `product-os-tools` directory.
Check the product-local runtime first, then the user's shared installation.
Claude Code normally uses `.claude/skills/product-os-tools`; Codex uses
`.agents/product-os-tools`. These paths may be inside the product folder or the
user's home directory. Check the other agent's environment or a toolkit checkout
if needed. Resolve the home directory separately from the product folder.

Use Node.js and the absolute path to `<tools>/bin/product-os.js`. With a shared
installation, do not copy the runtime into each product or run `install` there;
`init` and saving the starting context are sufficient.

1. Save PRODUCT.md: what the product does, for whom, its stage and available
   materials, the owner's goal, constraints, market and unverified claims.
   During repair, preserve existing text and update only agreed information.
2. Run `node <tools>/bin/product-os.js init <workspace> --agent both`.
   It creates missing files and directories, preserves user instructions and
   initializes the graph through the shared transactional writer.
3. Check `node <tools>/bin/graph-write.js <workspace> --check`.
4. If materials were supplied, use [product-context](../product-context/SKILL.md)
   to preserve originals and source-backed information.
5. Run `node <tools>/bin/product-os.js <workspace>`. Check the console is available
   and show its address. If a browser is unavailable, state what was not verified.

This edition also includes [product-research](../product-research/SKILL.md) for one
question using public sources, [product-segment-hypotheses](../product-segment-hypotheses/SKILL.md)
for potential customers, [product-job-map](../product-job-map/SKILL.md) for customer
jobs, [product-brand-identity](../product-brand-identity/SKILL.md) and
[product-reference-library](../product-reference-library/SKILL.md).

Do not refer to missing skills or promise specialized interview processing, deep
market research, content production or implementation. Discuss ordinary questions
using the materials the owner provided.

Done means the product profile is saved, originals are preserved, the graph is
valid and the console is available.
