# Final prompt set and selected outputs

Built-in `image_gen` mode was used, with transparent backgrounds. No fallback CLI or user API key was used. These are consolidated, reusable production specifications from the generation and revision requests, not a verbatim tool-call transcript. The selected master files and exact source identifiers are recorded in `provenance.json`.

## Common art direction

Create a wide 3:2 transparent literary illustration, with the presence of an imagined paper construction seen in directional light. Use ivory rag paper, indigo drypoint/aquatint-like impressions, thin vellum, sparse restrained copper traces and convincing unequal thickness. Distinguish quiet broad material from one dense area of incised marks. Make a cut edge, a curled reverse and a translucent overlap behave differently. Keep genuine open air in the composition. The object should reward both a roughly 500px website preview and a larger detail view.

No lettering, floor, backdrop, frame, halo, plastic surface, flat-vector outline, luxury gilding, symmetric badge or ornamental marks covering every surface. Do not imitate a named artist or borrow an existing composition. The illustration is an interpretation, not a portrait or a doctrinal explanation.

## 1. Meditations — selected generation

One continuous asymmetrical ivory paper band enters a dense knot low on the left, crosses convincingly under itself, and rises into an open loop on the right. Indigo gathers beneath compressed crossings; the broader faces remain comparatively quiet. Leave unresolved tails. Engraved marks should turn the material rather than decorate it evenly. A little uneven wear can belong at a strained fold. Avoid a perfectly solved knot, a wellness emblem, a sacred sign or a chair.

Grounding: “Another layer, another issue, another knot.” The second passage contrasts flattering abstraction with direct observation. Repeated observation does not guarantee a final untangling.

Selected master: `meditations.png`, generated as `exec-7d0798cb-dec1-4c96-bf9e-7f2fda14166a.png`.

## 2. The Hidden War — initial generation and selected edit

Initial generation: two incomplete human masks emerge from one folded paper strip; opposing impressions, one offset lower, share indigo recesses and restrained copper edges. No separate person wearing a mask, perfect theatre logo, moral black/white division or plant standing for hope.

Critique: the result still looked like two exquisite, separate masks with too much shared polish and copper distress.

Revision specification: make the same face pressed into ONE continuous sheet folded back on itself. Let two impressions turn away from each other; one is incomplete, its cheek and jaw returning to unpressed paper. Use fragile shallow embossing, crease pressure and a visibly shared buckled fold. Preserve quiet paper. Reduce marbling and copper to one or two small traces. Do not make porcelain beauty masks or ring every contour with decorative damage. The viewer should trace the same material between both roles.

Grounding: “The protagonist and the antagonist swap masks.” The second passage hopes to gather what is fractured into something whole. Neither face represents innocence; the face is fictional.

Edit input: `exec-ca07b488-9fdd-4527-81d8-d3a9ef285e2a.png`.
Selected master: `war.png`, edited as `exec-50929288-7c8c-4ba0-a64d-565779f17bd4.png`.

## 3. Abstractions of Illusion — initial generation and selected edit

Initial generation: five unequal paper veils recede across a shallow diagonal. Curling apertures expose further openings. Place a small observer/eye on the nearer sheet and a faint recurrence farther in; avoid an isometric software diagram or a perfectly aligned tunnel.

Critique: the printed eye suggested mystical surveillance and the heavy copper rims made the leaves read as precious ceramics.

Revision specification: remove the printed eye. Suggest a small human profile through the cut edge of the foreground aperture so the observer belongs to the leaf. Use quiet ivory vellum at the front, one middle sheet with rubbed indigo and a few incised threads, and paler, silvery translucent leaves farther back. Let openings overlap unequally; let one edge interrupt the view through another. Reduce copper to a single restrained crease. No final window into pure light, solved tunnel, conspicuous eye symbol or ornate metallic rims.

Grounding: seeing the layers can itself become another layer; the chooser is shaped by the pattern it believes it chooses from. The composition must not place the observer outside all layers.

Edit input: `exec-6822e8d4-de11-4292-84ca-f1a8ce9293e1.png`.
Selected master: `abstractions-of-illusion.png`, edited as `exec-cb6fc0ce-72e7-404e-b02b-21731b6f4875.png`.

## 4. I am — selected generation

An asymmetric moth enters diagonally above one bowed lily, long leaves and a small patch of snow. One wing is lower and the other lifted. Give the wings thin ivory-and-indigo paper membranes, fine directional veins, a legible body and delicate antennae. The flower is softer and denser. Make the air between flower and moth important. The moth may seem capable of landing or leaving. Avoid a generic butterfly, specimen symmetry, jewel-like badge, halo or sacred emblem.

Grounding: “I am boundless and yet I belong,” “I am a magnificent moth of devotion to the absolute,” and the poem's lily/snow imagery. The arrangement is invented; it does not establish the author's religious identity.

Selected master: `i-am.png`, generated as `exec-767ca7a0-4685-4be1-90c6-dcc570195af3.png`.

## Output processing

All selected originals are 1536×1024 RGBA PNGs with real alpha. The website uses local WebP versions at widths 320, 960 and 1536. Resize uses Lanczos; WebP quality is 83 for the smaller tiers and 85 for the full tier, with method 6 and exact alpha/RGB preservation. This processing changes size and encoding only. Creative image edits used the built-in image tool.
