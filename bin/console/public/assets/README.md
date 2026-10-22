# Console assets

The console serves these local assets under `/assets/`. No CDN scripts or fonts
are required by the reading interface.

- `brand/` — Product OS mark, wordmark, favicon and app icons. Original geometry
  and usage: `brand/README.md` and the repository's `BRAND.md`.
- `fonts/onest/` — Onest variable WOFF2 for body and controls.
- `fonts/source-serif-4/` — Source Serif 4 variable WOFF2 for headings.
  Both fonts include their SIL OFL licenses. Runtime declarations: `../fonts.css`.
- `job-flow.js`, `job-flow.css` — prebuilt job graphs and strategic job board.
  React, React DOM and React Flow (`@xyflow/react`) use MIT licenses; the bundled
  notices are in `job-flow.js.LEGAL.txt`.

Fictional images, identity/reference examples and sample map data used by the
verification harness live in `scripts/fixtures/`, outside the served UI and npm
runtime. They contain no real product research.
