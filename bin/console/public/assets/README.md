# Console assets

Static files served by the Atlas console under `/assets/`. Everything is local: the
console loads no CDN scripts, fonts, models, textures or audio at runtime.

- `brand/` — Opora mark, outlined signature, favicon and raster app icons.
  Original geometry for Product OS; source and usage are in `brand/README.md` and
  the repository's `BRAND.md`.
- `fonts/onest/` — Onest variable WOFF2, 84,052 bytes, body and controls.
- `fonts/source-serif-4/` — Source Serif 4 variable WOFF2, 427,432 bytes, headings.
  Both retain all original glyphs and axes; compressed with FontTools/Brotli from
  Google Fonts TTF files retrieved on 26 September 2026. Original directories:
  https://github.com/google/fonts/tree/main/ofl/onest and
  https://github.com/google/fonts/tree/main/ofl/sourceserif4. SIL OFL 1.1 licenses
  are bundled in each folder. Runtime declarations are in `../fonts.css`.
- `fonts/inter/` — Inter 5.2.8 as `woff2` subsets (latin, latin-ext, cyrillic,
  cyrillic-ext; weights 400–700, about 330 KB total). SIL Open Font License 1.1, see
  `fonts/inter/LICENSE.txt`. Retained legacy asset; no longer requested by the console font sheet.
- `job-flow.js`, `job-flow.css` — the prebuilt job-flow diagram (React, React DOM and
  React Flow from `@xyflow/react`, MIT). Generated from `ui/job-flow.jsx` by
  `scripts/build-job-flow.js`; do not edit by hand. Third-party license notices are in
  `job-flow.js.LEGAL.txt`.

If another binary asset or third-party bundle is added, record its source, license and
optimized size in this file before shipping it.
