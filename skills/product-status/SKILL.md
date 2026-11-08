---
name: product-status
description: Read saved product context and explain where we are, what is known and one grounded next step. Use for "where are we", "what's next", "where did we stop", status or tool-choice questions. Does not ingest materials, change plans or start research.
user-invocable: true
---

# Review product status

Answer from existing information. This skill does not change product memory or
execute the next step it recommends.

Follow [CONTRACT.md](../CONTRACT.md). Find the runtime in the current agent's
product folder, its home directory or the toolkit checkout. Use its absolute path
as `<tools>` and read data from the selected `<workspace>`, never another product
or the shared installation directory.

## Read only the relevant context

1. Read the goal, stage, resources and constraints from PRODUCT.md and chosen
   actions from MOVES.md. Do not ask for information already saved.
2. Start with the current synthesis for the topic, if available. Check its scope,
   revision, coverage and limitations. Stop when sufficient; open individual
   records only to resolve a remaining question.
3. Without a synthesis, use the relevant graph slice and available documents.
   Do not generate a synthesis, process interviews in bulk or start a web search.
   Open an original to answer a specific question, check a contradiction or fulfill
   the owner's request to see it. State gaps in the available evidence.

## Respond

Briefly explain the goal, what is known and its basis, where work stopped, the
current constraint and the most useful next step. Preserve the chosen action
unless there is a reason to revisit it.

For a proposed step, name its intended result and how to check it. Do not invent
budgets, deadlines or guaranteed profit. Distinguish observations, hypotheses,
payment and profit. Linking to a saved quotation does not mean its original was
reread in this session. Check that a suggested skill is installed; a tool catalog
does not authorize running it.

## Reading and execution

Send new materials to `product-context`. An ordinary status question creates no
report, task, evidence, synthesis or PRODUCT.md/MOVES.md entry. If the same request
also assigns a specific next step, finish the status review and then carry out
that instruction with an appropriate tool outside this skill.

For a console-launched task, save only execution metadata: JSON with `runId`,
`nodeId`, actual `summary` and `outcome: completed|failed`, then run
`node <tools>/bin/product-os.js status-receipt <workspace> <receipt.json>`.
The command checks the registered run and writes only `.product-os/runs/`.
The graph, product profile and plan remain unchanged. Ordinary chat needs no receipt.

Done means the owner understands the status, limitations and reason for the next
step. Product memory is unchanged and no new study has started.
