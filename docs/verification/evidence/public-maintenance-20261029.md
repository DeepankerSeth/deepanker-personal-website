# Public implementation preservation — 29 October 2026

The maintenance candidate on `127.0.0.1:4194` preserves the accepted O presentation served separately on `127.0.0.1:4217`. No product defect was found in this lane; no product code changed during verification. The release record establishes the identity of those running builds separately.

## Completed evidence

| Check | Result | What it establishes |
| --- | --- | --- |
| Ordinary-motion width matrix | 34/34 cases; no diagnostic errors | Candidate and O at 17 equivalent viewport sizes, arrival and selected alternate passage; full titles, actual clipping edges, document overflow and selection-plane alignment. |
| Complete writing and passage journeys | 12/12 cases; no diagnostic errors | Exact complete rendered bodies for all four pieces, all 68 authored poem breaks, endings, next-piece discovery, return to the index and all eight exact passage destinations. |
| Settled homepage equivalence | 34/34 paired states | Under reduced motion, identical title/passage/art geometry, foreground/background colours and SVG light parameters. All 34 decoded-RGB screenshot pairs are pixel-identical. |
| Long-title cascade equivalence | 16/16 paired states | Identical title/header computed properties and line rectangles, with 16 pixel-identical screenshot pairs, including print CSS. |
| Source stability | Passed for every completed run | Complete source, public assets, migrations and build configuration fingerprints match before/after. This is separate from visual verification. |

The main matrix uses `320×667`, `375×667`, `390×844`, `430×900`, `540×900`, `620×900`, `621×900`, `697×900`, `768×1024`, `834×1112`, `900×900`, `1100×900`, `1101×900`, `1280×900`, `1440×900`, `667×375` and `844×390`.

The title comparison uses screen widths 320, 375, 620, 621, 800, 801, 896, 897, 1280, 1395, 1396 and 1440; print CSS at 620, 621, 1280 and 1440. The old effective rule is preserved: 35px through 620px; then `clamp(43px, 4.8vw, 67px)`, line-height 1.06 and letter-spacing −.045em. Its precedence over the generic print title rule was already present in O.

## Visual assessment

Equivalent phone arrival/encounter, the 620/621px layout transition, tablet arrival, desktop selection and long-title openings were inspected. Representative essay openings/endings, poetry and print were also inspected. The full title remains legible and complete; the art/passage relationship and colour atmospheres retain their proportions; the reading page keeps its original calmer rhythm. The 621px two-column layout is denser than the wider tablet layout, exactly as in O; this maintenance pass introduces no redesign there.

The ordinary-motion desktop screenshots sometimes capture different instants of the shared entrance fade and light settling. They were **not** treated as exact pixel comparisons. The supplemental reduced-motion pairs isolate static preservation; they do not substitute for motion or interaction checks.

## Attempts, tools and limits

Playwright **1.62.1** used its isolated Chromium **151.0.7922.34** build. Fresh contexts allowed only GET/HEAD requests to fixed loopback origins; no personal profile or production request was used. Pixel comparison used Pillow 12.3.0.

The first browser launch failed before opening any page because the macOS sandbox denied Chromium's Mach port registration. The authorized isolated run succeeded outside that sandbox. The first supplemental comparison stopped on Astro's filename-derived scope attribute: renaming `src/v2` to `src/site` changes that opaque identifier. Its corrected assertion compares actual gradient coordinates/radius instead. Both incomplete attempts are retained beside the successful evidence.

These are desktop-engine viewport/touch emulation results, not physical-device evidence. Print means emulated print CSS, not a native print dialog or printed sheet. This lane does not establish native browser zoom, screen-reader use, production behavior, field performance, or twenty minutes of human reading. Other release checks remain separate.

## Evidence and reproduction

Full reports, screenshots, supplemental scripts and the verified copy manifest are retained outside the publishable project in [`website-recovery/2026-10-29-maintenance/evidence/public-maintenance`](../../../../website-recovery/2026-10-29-maintenance/evidence/public-maintenance/). Its `files.sha256.json` covers **208 files / 28,781,072 bytes**, verified after copying from private temporary outputs. The reports retain their original temporary capture paths; corresponding files now live in the named archive subfolders.

From the authoritative project root with candidate and O servers already running:

```sh
node scripts/review-harness/final-browser.mjs --authorized-local-browser-review --group=widths --baseline=http://127.0.0.1:4217
node scripts/review-harness/final-browser.mjs --authorized-local-browser-review --group=journeys
```

The archive's `reproduce/` scripts resolve the pinned Playwright package from the current project directory. They generate fresh temporary evidence for the focused title/home comparisons; their fixed temporary output names should be changed for a new dated run. `compare-pngs-20261029.py DIRECTORY` compares matching `candidate-*.png` / `baseline-*.png` files using Pillow. See [the browser harness instructions](../../../scripts/review-harness/README.md) for installation, isolation and other coverage groups.
