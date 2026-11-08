# Product OS · Opora

The owner chose the "Opora" direction on September 26, 2026. This system is applied to the Product OS itself. The names, data and identity of the researched products remain separate.

## Meaning

Product OS helps the product owner understand the materials, make decisions and take the next verifiable step. His values ​​are clarity, staying grounded, and an honest approach to the unknown. The identity expresses an attentive product partner; it does not promise proven demand or profits.

Sign brackets hold the context, a square highlights the subject of the work. Warm surfaces and editorial headlines support reading. Terracotta marks a transition or choice. The sign itself is not a button and does not indicate the status of the study.

- **Always:** preserve sign proportions, readable text, and Product OS/workspace product distinction. Example - signature in console navigation.
- **Sometimes:** brackets and a square take up a large area on the cover where there is room for brand expression. Example - Study Cover Template.
- **Never:** We don't put decorative brackets around every fact, we don't paint warnings in a corporate color, we don't hide disclaimers for the sake of composition.

## Sign and signature

Masters are located in `bin/console/public/assets/brand/`.

| File | Usage |
| --- | --- |
| `mark-ink.svg` | Main sign on a light background |
| `mark-accent.svg` | Terracotta sign on paper background |
| `mark-inverse.svg` | Light sign on a dark background |
| `wordmark-ink.svg` / `wordmark-inverse.svg` | Signature with font part in curves; does not require installed fonts |
| `favicon.svg` | Adapts to light and dark browser tab |
| `app-icon.svg` | Square icon with round crop box |
| `app-icon-16/32/64/180/512.png` | Raster exports in the specified size |

The sign is built in a 64x64 field. External boundaries - 6...58, main strokes - 8 units. Leave at least 8 units of free space around the visible form; adjacent text or character is not included in this field. The UI signature uses a compact composition from the `brandSignature` component; its spacing is 8 px with a sign of 32 px.

Sign checked at 16, 32 and 64 px. 16 px - favicon/small identifier only; the usual sign in the interface is 32 px. Use a signature with a title starting at 160 px in width. Do not stretch, trace, rotate, or change the square to a circle. Do not create separate characters for the sections “Segments”, “Competitors” and “Reports”.

SVG retains exact shape. The signature is a typed name with a sign, and not a statement about the exclusivity of the typeface. Editing compatibility with Figma and Illustrator has not been tested separately.

## Color

Executable values belong to `ui-tokens.css`; pages use roles rather than copy hex.

| Role | Meaning | Application |
| --- | --- | --- |
| Paper | `#F7F4ED` | Main surface |
| Light surface | `#FFFCF5` | Fields, editors, sources |
| Ink | `#272D28` | Main text, main button |
| Secondary text | `#5B6057` | Metadata and explanations |
| Terracotta | `#963B25` | Links, selected topics, highlights |
| Selection | `#EAD7C7` | Selected item background |
| Navigation | `#F0EBE0` | Permanent environment of the working material |
| Line/control | `#D4CDBF` / `#818575` | Field separators/borders |

The contrast of the main text on paper is 12.81:1, the secondary text is 5.87:1; terracotta on a light surface - 6.95:1. Plain text threshold is 4.5:1. A faint dividing line does not replace the visible boundary of the interactive field. Warnings, errors and interview support save individual semantic pairs from tokens.

Inversion of the sign for a dark background is included in the branding kit. Full dark console theme is not implemented: do not enable it by switching just the background color.

## Typography and composition

Source Serif 4 - headers; Onest - body text, controls and metadata. Local variables WOFF2 contain Cyrillic and Latin alphabet. SIL OFL 1.1 licenses are included in the font folders. The originals were obtained from the official Google Fonts directory; references and dimensions are indicated in `assets/README.md`.

| Role | Standard size / leading |
| --- | --- |
| Page | 40 px / 1.25, Source Serif 4, 600 |
| Section | 28 px / 1.35, Source Serif 4, 600 |
| Post title | 24 px / 1.4, Source Serif 4, 600 |
| Body text | 18 px / 1.6, Onest, 400 |
| Controls and metadata | 16 px / 1.5, Onest, 400–600 |

Dimensions are set in rem and grow along with the root text. Don't make your font smaller for the sake of placement. Long reading width - up to 68ch. Reference dimensions, captions and secondary text remain legible. Sections are separated by a margin and a line; the card is needed for an independent surface, and not for each paragraph.

Main menu - Onest. The Product OS name is accompanied by a sign; The title of the workspace product is shown separately. In the interface we do not repeat the large graphics of the cover. Focus, history, sources, conflicting data and unknown values retain the same behavior.

## Release and check

Common components, their expanded states, and catalog `/design-system` use the same system. After changes, run `npm run test:design-system`, affected threads and viewing wide/narrow screens with 200% text. Full requirements are in `DESIGN-SYSTEM.md`.

The cover template and portable set are issued with the identity report version. Cover 1200x630 is a fixed format, not a universal adaptive template. For a new material, use the complete `scripts/render.cjs` and open export. Long text is edited rather than compressed. Files from past accepted issues are not overwritten.

Product OS trademark and geometric symbol, domain and nickname checks were not performed. The kit does not claim legal uniqueness or market recognition. No third party contractors were involved; there were no purchases of fonts or publications.
