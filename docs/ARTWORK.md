# Giving a new piece its visual interpretation

Writing can be published safely before it has bespoke artwork. Read the whole piece first. Its interpretation should arise from something particular in the words, while leaving room for another reader's interpretation. The existing paper-and-ink world offers material presence, depth, quiet surfaces, uneven openings and purposeful light; it is not a requirement to make every essay another folded object.

## From reading to composition

1. **Find the tension.** Note a few exact passages, a contradiction or a recurring image. Read the ending and caveats before deciding what the image means. Distinguish the writer's words from your interpretation and avoid inferring a personal identity or belief.
2. **Choose the pairing.** The current encounter supports two exact passages. Explain what each reveals in the composition and why a change of attention belongs. Do not rewrite a quotation or invent a second merely to fill a control. A different passage count needs a deliberate component change; publishing can use the safe plain fallback meanwhile.
3. **Develop the material.** Judge silhouette and negative space at phone size, then depth, edges and selective detail up close. Let the same material behave differently under compression, light or overlap. Uniform distress and excessive finish can be less convincing than quiet surfaces. Consider another medium when it serves the writing better.
4. **Keep a real source.** Preserve editable drawing/layer files when available, an approved lossless master, source licence and attribution, generation/edit specifications when applicable, and a record of the selected revision. A prompt is not a reproducible image master. Do not borrow, trace or embed work without verified permission and the required attribution.

## The actual implementation

Current illustrations are original AI-assisted transparent PNGs depicting imagined constructions. They were not physically made or scanned. The site discloses AI assistance. Their masters and original provenance are in `artwork/masters/imagegen/`; historical notes there describe origin, not current build instructions. No external artwork is embedded.

`src/site/literary/artworks.ts` holds each slug, exact passage pair, interpretation title/note, accessible image title/description and two light foci. Keep its entries in stable order: their indexes identify existing atmosphere and detail-crop CSS, independently of publication order.

`MaterialArt.astro` wraps the raster in an accessible 640×500 SVG envelope. A masked duplicate and small shadow create responsive light; the painted geometry does not deform. `material-motion.js` moves light toward the selected passage, allows bounded mouse response and stops. Reduced motion receives the selected state immediately. The optional detail control deliberately zooms a region; thumbnails and reading-page art stay still.

The display tiers are 320px for small/static views, 960px for selected previews and 1536px for requested detail. A failed upgrade retains the smaller loaded image; total failure keeps the words and reading link with an accessible unavailable state. The standalone `public/literary/art/{slug}.svg` is the native link destination without enhancement. It references local WebPs and is not a self-contained vector download.

## Worked example: Abstractions of Illusion

The passages are “Even the thought “I see the layers” can become another layer of illusion if I hold on to it.” and “we experience ourselves as the chooser, yet the chooser is shaped by the very pattern it thinks it is choosing from.” Copy their exact strings from the registry, including punctuation and initial lowercase.

The nearest veil's cut edge suggests a profile: the observer belongs to the layers. An earlier conspicuous eye was rejected because it implied mystical surveillance. The second light focus moves attention into the receding openings without promising a final position outside them. This is the design's reading of the essay, not an author-authored explanation.

Reproduce the three display files into an unused staging directory:

```sh
python3 -m venv .venv-artwork
.venv-artwork/bin/pip install -r requirements-artwork.txt
.venv-artwork/bin/python scripts/prepare-artwork.py \
  --source artwork/masters/imagegen/abstractions-of-illusion.png \
  --slug abstractions-of-illusion --out /tmp/abstractions-art-proof
```

The tool reads the master without changing it, uses Lanczos, WebP quality 83 for 320/960 and 85 for 1536, method 6 and exact transparent RGB preservation. It refuses existing outputs unless explicitly given `--replace`; inspect staged results before replacing approved assets. Pillow 12.3.0 with libwebp 1.6.0 reproduced all 12 current WebPs byte-for-byte during maintenance. The generated manifest records encoder versions, dimensions, sizes and hashes; another encoder build may differ.

## Connect and verify

For new bespoke work, append its registry entry; supply its three WebPs and accessible standalone SVG; choose its atmosphere in `styles/home.css` and detail origin in `styles/material-motion.css`. Preserve unique SVG IDs, truthful descriptions and contrast in every selected state. Index, Contents, essay opening, detail and next-piece views consume the same registry-backed association. A different medium needs an explicit component extension and equivalent fallbacks, not pretend raster settings.

The author's optional **Index passage** takes precedence. Curated art appears only while both supported quotations still occur in current published HTML and the chosen passage is unset or matches that pair. A different chosen passage suppresses the unsupported illustration. An unillustrated piece uses its selected passage or a bounded opening-paragraph excerpt; it keeps its complete title and direct route. Exact context links exist only for text found in the body.

Run `npm run test:reading` and `npm run test:literary-client`, then inspect the real piece on desktop, intermediate widths and phones: complete title, both passages, detail, exact context, keyboard focus, touch scrolling, reduced motion and failed image/font/script loading. Check colour contrast and resource cost, not just file size. Preserve the accepted comparison until the new relationship earns its place. Font licences remain alongside the self-hosted fonts; artwork optimisation must not remove provenance.
