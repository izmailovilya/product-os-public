# Saved visual presentation

Presentation is part of the result of the identity: a person sees the whole brand, understands
Apply elements and pick up the required files. The agent authorizes it during production;
The console shows the saved composition without a new AI request. No mandatory
a set of sections or the same order for all brands. Do not create empty
“Character” if the brand does not have one. JSON random field cards do not replace display.

## Authoring rules

- Before filling in repeating blocks, select according to the audience task that person
should understand from the first sample which file to take for your media.
Compose this fragment in the reader: the image and its signature are read together,
enlarging helps to see it, downloading gives the desired option. If the task is
Reading, she doesn't need to come up with a separate main CTA. Only after verification
spread the compositional technique this way. Write the desired output in the usual form
report; no additional data schema or separate approval is needed.
- Be the first to show a complete image: the existing sign/name, the desired description and
characteristic graphics. Brand colors act inside the visuals and do not change the shell.
- Choose a sequence based on the material: sign, character, color, font, voice,
composition and media - possible topics. The title explains the content.
- Link the image, caption and rule. Each required action has a source
file. All required rules are reflected through `ruleIds`; semantic restrictions remain
next to the example. Sources, other rules, versions and a complete list of files are available
in a separate window "Versions and bases".
- Use real registered assets. For the sprite sheet, keep the exact ones
coordinates from index, don't guess pose and don't declare cell as separate PNG.
Before placement, distinguish master/sample application and technical check/export.
Size, background and crop must match the selected role. Readable favicon at 16px —
Full result for the tab, but not a large brand sample. Technical
options remain available in the kit; their presence does not oblige you to repeat them
in the main gallery. Unknown destination is not established by file order.
- Arrangements from existing ingredients are suggestions. They do not inherit
adoption of a sign or character. The saved acceptance area is not expanded.
- Check the presentation itself on desktop, 390px and with text enlarged: images
loaded, signatures are clear, sections are accessible, the source opens and closes,
The required file can be obtained. Separately, evaluate the current page: does selection help
understand the system and choose the application, whether the signature and sample are not the same
official actions. If not, correct the composition in the already selected direction;
a valid profile and accepted sign do not close this representation defect.

## Format

New profiles use `schemaVersion: 3` and `presentation` in identity.json.
In draft, `null` is allowed; `ready-for-review` requires a saved presentation.
Version 2 fields are retained. Old versions 1/2 remain readable.

```json
{
  "schemaVersion": 1,
  "title": "Brand name",
  "description": "Saved description",
  "theme": {"background": "#FFFDF4", "foreground": "#121212"},
  "cover": {
    "title": "Brand name",
    "logoFileId": "logo",
    "description": "Stored handle",
    "image": {"fileId": "character", "alt": "Image description"}
  },
  "sections": [
    {"id": "mark", "type": "showcase", "title": "Sign", "ruleIds": ["logo-rule"],
     "items": [{"title": "Main version", "description": "Where to apply",
                "image": {"fileId": "logo", "alt": "Main character"}}]},
    {"id": "files", "type": "downloads", "title": "Get to work",
     "items": [{"fileId": "logo", "title": "Logo", "description": "Vector source"}]}
  ]
}
```

`fileId`, `logoFileId`, `fontFileId` refer exclusively to `files` of the current
profile; `ruleIds` - to his `rules`. Paths, HTML, scripts, CSS and external images
not specified in the presentation. Hex colors — `#rrggbb`; text contrast of each pair ≥4.5:1.
Optional `cover.theme` only changes the cover. Optional `caption` - meaningful
signature, not version/history. `cover.title` or `logoFileId` are required.

Blocks are open, the order is set by the author. Each one has a unique `id` from the Latin
letters/numbers/hyphens, `title`, optional `description` and `ruleIds`.

| type | Contents |
| --- | --- |
| `showcase` / `gallery` | `items: [{title, description?, image, ruleIds?}]` |
| `palette` | `colors: [{value: "#rrggbb", label}]` |
| `typography` | `family`, `sample`, optional `fontFileId` for real font and `fontWeightRange: [min, max]` for file metadata; `specimen` for a composition of typographic roles |
| `text` | `body` with paragraphs; only meaningful saved text |
| `applications` | `items: [{title, heading, supportingText?, logoFileId?, image?, theme?, proposed: true, description?, ruleIds?}]` - demo compositions |
| `downloads` | `items: [{fileId, title, description?}]` |

`image: {fileId, alt, region?}`; `region: {columns, rows, column, row}` - positive
grid sizes up to 12x12 and cell numbering from scratch. Viewing is prohibited outside the grid.
Incomplete font or inaccessible file remains an explicit condition, preview failed.

The image in `showcase` / `gallery` can be set to `item.theme` with the same
a contrasting pair, like the cover: for example, a dark background for a light version of the sign.
The title and explanation remain on the normal interface surface. Same background
Saved when opening an image. Don't enlarge the favicon to illustration:
select a vector master or export of a suitable size.

The file archive is not an identity gallery. Include only
 in the main show
selected variants of the system and examples that explain its application. Old
leave concepts, check pictures and size sets in “Versions and Bases”.
The product screen is appropriate here as a signed example of the style; screen catalogue,
scripts and components refers to "Our Elements".

`typography.specimen` - calm composition against the background of the brand: `glyphs`, optional
`secondaryGlyphs`, `title`, optional `heading`, `body`, `characters` (1-8 lines
characters). The text of each level is set by the author, the reader does not transform an arbitrary first one
old `sample` line in header. Without `specimen`, the saved `sample` remains intact.
The font and style range are taken from the registered file; text styles
Consoles should not replace its own dimensions and typeface. Check it out by
Computed styles on the actual page, not just a separate layout.

Cutting a sheet along a grid is allowed only after viewing each boundary: figure
must fit entirely into the cell, without trimmed parts or adjacent fragments.
If characters cross boundaries, show the entire source sheet. Don't mask
defect narrower crop and do not call cells as separate exported files.

Text next to the sample explains the specific application or limitation. Remove
metatext about the availability/saving of materials and an obvious description of the interface itself.
`ruleIds` associates composition with bases; reader does not repeat the original rule
verbatim under each example of the author's presentation. Significant rules must be
transmitted in the author's text; the original wording remains in Versions and Reasons.
Scope, exceptions and offer status are saved near the application.

Version adoption history (numbers of previous releases, what has not yet been released and which
no future actions taken) is stored in "Versions and Reasons" rather than shared
in paragraph above downloads. The list of files contains just the name, format and composition:
for example, “3 sheets of 6 emotions · ZIP.” Conditions that change acceptable use
the file itself (license, prohibited use, incompatibility), remain next to it.
Call the status of the new application with the word “Sketch”, understandable to the reader; don't repeat
history of approvals under each example.

## Profiles released

In the absence of an author's composition, the reader collects a conservative compatible
representation from existing rules and files, without AI and writing to the product. Its
The origin is visible in the bases. For a full submission already accepted unchangeable
versions can be saved as a separate JSON and registered in its node
`data.presentationFile` and `data.presentationSha256` via a common graph writer.
Document: `{schemaVersion:1, productId, artifactId, profileSha256, presentation}`.
Hashes bind it to the exact bytes of the previous profile. This is an editorial submission,
It does not change the acceptance of assets. Mismatch, damage and inaccessibility clearly
showing; reader returns to the source materials, does not pass them off as the author's layout.

Structural check one: `bin/brand-presentation.js`. It is used by production-reader
and `scripts/validate.cjs`; do not create divergent validators for producer and UI.
