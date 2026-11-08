# Check visual result

Open real files, don't evaluate prompt/description only. For PDF/PPTX - render
all submitted pages; for SVG and rasters - original and preview in the target size.
Technical validator checks links, hashes, small sign previews and contrast number, but
does not assert that the character is readable.

- Meaning: the title and promise are accurate, the requirements of the brief are preserved, unconfirmed facts
did not hit the layouts. The first page of the brand guidelines answers “why” and “what we value.” Based on mockup
growth in awareness or sales cannot be claimed.
- Sign: no deformation/cutting, language and color versions correspond to the master file;
The descriptor is read at the intended size. Check the required light/dark backgrounds.
- Typography: real fonts/replacements, Cyrillic and special characters, short and long lines,
hyphens, hierarchy, no overlays and missing glyphs; paragraph on real
media line length with selected leading; title in capitals checked
separately; body text tracking is not changed without a recorded reason.
- Digital media: icon 16/32/64 px and favicon viewed in real size (1:1),
not from the enlarged preview; an avatar with a round cut does not cut the sign; dark sign theme
and palette steam is open; og-image and letter - with real text.
- Contrast: each text-on-background pair from the `topic: color` rules has a number
(WCAG relative brightness) and comparison with rule threshold; the pair below the threshold is marked
as decorative or replaced. This is an application check, not a site accessibility audit.
- System: several different media are recognized by a common logic; fixed
Constant elements are met, variability has conditions. One logo on mockup
does not show the entire system yet.
- Files: source exists, export matches it, transparency/background and dimensions
correct, relative links are opened, the document describes exactly the transferred versions.
The shown animation/AI editability cannot be promised if there is only a static export.
- Use: another participant finds the desired option and understands how to apply it.
Purpose unclear - transmission defect. Mark the unverified seal or resource separately.

## System check for task

For a full identity or its audit, write in the same report: criterion → specific
file/page → observation → checked / open / not applicable → desired action.
To edit one character or export, leave only the criteria related to it.

1. **Fidelity to the brief.** Match the promise, title, essential texts and diagrams with
source. Saved items must have a reason for being saved; at changes
contents - an order or a separate decision. Check the editing in the entire set,
Including covers and ZIP, not just in the one layout shown.
2. **Distinctiveness.** Place the media next to the collected alternative materials from
categories (workflow.md, “Competitors and environment”); Separately close the sign and name.
Name what remains your own: type of sign, composition, typographic technique,
graphics, image, voice. No comparison - open assumption with `check`, and
not proof of weakness or uniqueness. Don't run a recognition study
instead of local review. Johnson, p. 38–45; Wheeler, p. 44; Budelmann and Kim, 70–72.
3. **Variations.** Check applicable formats and different content densities. For main
reception show the conditions for mandatory, permissible and unnecessary use. Change
Only header length checks for wraps, not system flexibility yet. Look for general
family for different tasks, not necessarily repeating one decoration.
Wheeler, p. 36–38; Budelmann and Kim, principles 25–27.
4. **Purpose of the form.** Compare the declared graphics function with what is actually
visible. An abstraction doesn't have to explain the product, but if it promises to do so, check it out
objects, signatures and connections. Distinguish between sign, secondary graphics and function diagram.
Applied Strategy Compliance Check: Budelmann and Kim, Principle 51.
5. **Blind re-release.** Performed by a separate subagent, not the author of the kit.
He receives only the kit folder (copy) and a task like “assemble the cover with such and such
text in the specified tool" - without access to correspondence, report and this checklist.
It selects the source by index, substitutes text, receives export, checks
characters, hyphens and fonts and writes that required a guess or external
dependencies. His comments are included in the report as is, without editing by the author; author
responds to each with an action or a “accepted as constraint” mark. If subagent
unavailable, the author performs the check and writes: this is not an independent check.
If a third-party editor did not open, do not promise its compatibility.
Johnson, p. 266, 272; Budelmann and Kim, principles 58–60, 62; Korolkova, s. 84, 134, 184.

This is an applied review on [foundations](knowledge.md), not a universal exam on
Match all books. Unidentified recognition leaves the hypothesis open;
it in itself does not prohibit showing the design. Missed ordered sign, substitution
contents or broken promised template - unfinished part of the order. Save
the difference between “files are OK”, “the system has been tested in operation” and “the owner has accepted”.

For each checked visual file, save in identity.json: fileId,
viewed=true, viewing size/conditions, result and open defects; if original
Cannot directly open existing renderPath. For sign preview 16/32/64 px,
created by validator in `previews/`, QA record is required. Check again after
file changes; the entry refers to the SHA-256 scanned version. Do not replace check
agent's overall rating threshold. A blocking defect or lack of viewing leaves draft.

Publication, registration of a trademark, purchase of fonts and change of the current website
Not part of local visual inspection. The report does not state their implementation;
list of owner actions - in workflow.md.
# Presentation in the library

Check the saved composition against [presentation.md](presentation.md) in the current
Console viewer, including path collected before repeating sections. Read sample
together with the signature, select the file for the named media, open the source and return.
The first screen shows the brand; selection and sections explain its application. Images
and the font should load. Check for inaccessible file and affected view on
narrow screen with enlarged text; alternative structure - when changing reader.

In the same report, divide the result: serviceability of files/links; suitability of current
compositions for the task; the actual choice of the owner and his area. For composition
name a visible fact and consequence: for example, technical export took the place of sample
or the enlargement has torn the signature from the drawing. This is a reason to correct the display even with
successful validation. Missing view leaves this part unchecked;
Asset QA records alone are not enough for her. History and pipeline metadata not
Visuals are supplanted. Composition of accepted ingredients does not become accepted
medium. For local export, its target size and application are sufficient.
