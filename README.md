# Product OS

Skills and shared product memory for you and your AI agent. Save product context,
customer segments, competitors and sources as local files, then browse them in a
visual console or use them in your next conversation with Claude Code or Codex.

**Free, open source, and no subscription. No telemetry.** Product OS does not track
installations, updates or skill use.

For example, bring notes from customer conversations and ask `product-context` to
save them with their sources. You can then review the saved context in the console
and continue discussing it with your agent. Assumptions remain assumptions;
saving a conversation does not turn it into validated research.

| Skill | Purpose |
| --- | --- |
| `os-setup` | Set up a product workspace using the context you already have |
| `product-context` | Save materials and facts with sources |
| `product-status` | Review progress and identify a grounded next step |
| `product-research` | Investigate one question using public sources |
| `product-segment-hypotheses` | Map potential customers with an independent critique |
| `product-job-map` | Map customer jobs and the product's contribution and limits |
| `product-brand-identity` | Develop a brand brief, directions, logo and identity system |
| `product-reference-library` | Collect sourced examples of how other products solve a problem |

Specialized interview processing, deep market research, content production and
implementation skills are outside this edition. Your agent's other capabilities
remain available.

## Get started

You need Git and Node.js 22 or later. Skills run in Claude Code or Codex.
Browsing the console and saving files do not require an AI connection.

### Install once

Ask your agent to run:

```sh
npx --yes --package=github:izmailovilya/product-os-public product-os install --agent both
```

Skills install in `~/.agents/skills` for Codex and `~/.claude/skills` for Claude Code.
The runtime lives in `~/.agents/product-os-tools` or
`~/.claude/skills/product-os-tools`, respectively. You do not need to clone the
repository. Installation does not create product data in your home directory.

Use `--agent codex` or `--agent claude` to install for one agent. Run the same
command to update. Custom skills and product data are preserved. If newly installed
skills do not appear in your current conversation, start a new conversation in
your product folder.

### Set up each product

Open a separate product folder in your agent and ask:

> Set up Product OS using the context of our conversation through os-setup and show me the console.

The agent saves the known context, asks for missing information when needed, and
opens the local console. Its address appears in the terminal. Each product keeps
its own context and materials; several products can share one installation.
Repeating setup preserves existing materials and user instructions. The console
listens on localhost.

The console has five sections: **Product**, **Segments**, **Job map**,
**Competitors** and **Library**. Research reports are linked from products and
segments. The library contains brand identities and reference collections.
Ask your agent to add or update the saved context; the console displays it.
BB is not required.

A project-local installation is also supported:
`product-os install <workspace> --agent both`. The older `setup <workspace>`
command remains compatible with existing installations. `init <workspace>` creates
only product data and instructions, without copying skills. To call tools directly,
use `node <tools>/bin/product-os.js`, where `<tools>` is the absolute runtime path.
You do not need to add a permanent command to PATH for the skills to work.

## Add materials and review context

Ask your agent:

> Save this material through product-context.

Or import a file directly:

```sh
node <tools>/bin/product-os.js import ../my-product /path/to/notes.md
node <tools>/bin/product-os.js sources ../my-product
```

Import preserves the original bytes and avoids duplicate copies of identical
content. It saves the file and registers its source; analysis is a separate step.

Ask `product-status` where you left off and what to do next. It reads saved context
without changing the plan or starting research. Ask `product-research` to check one
specific question and save a report with sources.

Read a registered reference library without an agent:

```sh
node <tools>/bin/product-os.js references read ../my-product productId=<id> track=onboarding
```

## Custom skills

Ask your agent to add an existing skill or create one for your task. Custom skills
are kept separately and survive Product OS updates. Publishing a skill is optional
and starts only when you ask. You can review the entire contribution package before
it is sent; authorship is preserved and product data is never published automatically.
See [Custom skills](CUSTOM-SKILLS.md) and [Contributing](CONTRIBUTING.md).

## Share the console with your team

Ask your agent to share the console. Choose public access or a shared password,
then review the snapshot before publishing. Colleagues only need a browser;
your computer can be turned off after deployment. Publish a new snapshot to show
updates. Original files in `sources/` are excluded by default.

Hosting uses Cloudflare Workers and is subject to its quotas. Password protection
works without a paid hosting protection feature. See [Sharing](SHARING.md).

## Your data

```text
my-product/
  PRODUCT.md           product description, goals and constraints
  AGENTS.md            Codex instructions
  CLAUDE.md            Claude Code instructions
  sources/             original materials
  reports/             sourced notes and reports
  research-graph.json  structured product memory
  MOVES.md             chosen actions
  IDEAS.md             ideas not yet selected
```

The repository contains no real customer research or product workspaces. Product OS
sends no usage events. Your chosen AI agent processes materials when you ask it to;
its own access and retention settings apply. Existing materials and quotations stay
in their original language. Shipped instructions, templates and interface labels
are in English; you can ask your agent to respond in your preferred language.

## Development checks

```sh
npm install
npm test
npm run test:design-system
```

UI checks use an installed Google Chrome. Development dependencies are not needed
to run the normal console.

`PUBLIC-RELEASE.json` lists release files and their checksums. Private development
history is excluded. Future updates have no guaranteed schedule.

MIT licensed. Bundled fonts and libraries retain their own licenses beside the
files in `bin/console/public/assets/`.
