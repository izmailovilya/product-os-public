# Interface Product OS

The console shows saved information. Changes and launch of skills are performed
in Codex or Claude Code in the product folder.

## Sections

Main menu: Product, Segments, Job map, Competitors, Library.
Research is available from the product and segment pages. The library contains
identity and references. Documents and sources are opened and returned to the console.

## Common components

Colors and sizes are set to `bin/console/public/ui-tokens.css`, fonts are set to
`fonts.css`. The components are located in `ui-components.js` and `ui-components.css`.
Pages use common headings, open sections, lists and text links.
One main heading per page; the result has substantive restrictions.
Sources retain their own links. The guess is not indicated as success.

Body text - 18px, captions and controls - 16px; minimum coverage area—
44px. Uses Onest and Source Serif 4, supplied with their own licenses.
Text is wrapped without reducing the size. On a narrow screen and with text enlarged
up to 200% main actions, signatures, sources and returns remain available.

The map has graphical and list views of some saved data.
Coverage is taken from a saved map area; missing data is shown explicitly.
The identity preserves the versions and differences between proposed and accepted solutions.
References retain their area, filters, sources and return to selection.

## Check

`npm run test:design-system` creates a separate fictitious product, checks everything
five sections, sources and returns, desktop/390px/200%, keyboard, empty and
Data not available. Skills and agents are not launched in this test.
User results are not used as fixtures and are not modified.

Checking buttons and sizes is not a substitute for reading the actual page: please understand
what result is shown, what it is based on and where the next action leads.
