# Private publishing verification — 29 October 2026

The clean maintenance build passed **17 browser journey checks**, **six accepted-baseline comparisons**, and the read-only HTTP suite (**13 public checks; 15 with authenticated previews**). No product change was needed after these checks.

## Implementation and evidence

The candidate was built in `/private/tmp/deepanker-maintenance-clean-20261029` following a clean `npm ci`. Public checks used `http://127.0.0.1:4194`; publishing checks used a separate disposable database at `http://127.0.0.1:4195`. The accepted O editor was restored separately at port 4218. The aggregate source fingerprint for the browser-tested candidate is `7b71a5fd96787a6ddb928a667461340d55a4375baaff3cba17d48dfec9164453`; its complete file map is preserved with the evidence.

The durable evidence is outside the publishable project at [`website-recovery/2026-10-29-maintenance/evidence/private-maintenance`](../../../../website-recovery/2026-10-29-maintenance/evidence/private-maintenance/). `copy-verification.json` records 36 copied files, each reread and SHA-256 verified against its source. It includes browser reports, reproducible review scripts, screenshots, source fingerprints and HTTP reports. Those browser/HTTP files contain no credentials or databases. The separately added `private-rehearsal/` subtree contains protected local SQLite copies and its own verified manifest; keep the entire recovery directory private.

## Browser results

An isolated Playwright Chromium session exercised actual editor controls:

- UI login; BOM and CRLF Markdown import; byte-exact download; unsaved preview with no database writes.
- Shared 40/41-character title treatment and essay/poetry transitions, including clearing the previous state; Ctrl+S inside the preview.
- Explicit publication of one new synthetic local piece; identical published and saved-preview body, fonts, dimensions and line spacing; private edits remaining private.
- A real stale-tab 409 conflict with preserved text and exact download; failed-save retry; actual expired-session 401 followed by new-tab UI login and successful save.
- Failed-preview recovery; an interrupted slow preview unable to overwrite a newer result; cancel and confirm unpublication; unsaved text recovery after reload.
- Touch tab activation, continuous emulated touch scrolling (one start, ten moves, one end; scroll position 0→620), keyboard tablist behavior, and phone/tablet overflow checks. The editor axe scan found no WCAG A/AA violations. No uncaught page errors occurred; observed console errors came from the deliberately exercised failures.

The four original public rows and the pre-existing synthetic QA draft had identical before/after row fingerprints. The newly created test piece ends unpublished in the separate editor database. The public review database was not mutated.

The editor and saved preview were compared at **1440, 768 and 390 CSS pixels**. Tested geometry, typography, colors and full preview HTML match O. O’s QA fixture retains a historical publication date; the new fixture has never been published. Raw screenshots preserve that difference. For equal-state geometry comparisons, only that date element was removed from browser DOM on both sides; neither database was changed.

Two automation mistakes were corrected and their affected checks completed: an ambiguous imported `h1` locator and an iframe-navigation timing assumption. Neither was counted as a product pass before recovery.

## Portable migration rehearsal

The clean checkout ran `release-rehearsal.py --project-legacy` against its local database through a read-only SQLite connection. The preserved pre-working-copy fixture was independently checked byte-for-byte against repository commit `0e32b473231e27a4b664eecd8db7ed294efa544a`; the rehearsal itself needed no Git history. Migration 0003 preserved all original columns in four projected public rows, created the expected revision defaults and triggers, and passed SQLite integrity checks. The source database file hash and logical hashes of all four posts and the private draft were unchanged.

[Rehearsal report](maintenance-rehearsal-20261029.json) and [source guard](maintenance-rehearsal-source-guard-20261029.json) record these checks. The source backup and migration candidate are retained in the private recovery subtree. This projects already migrated local samples onto the historical schema; it does **not** establish compatibility with the unknown production schema or recover production Markdown.

## HTTP results and limits

[Public HTTP report](maintenance-public-http-20261029.json) and [authenticated HTTP report](maintenance-editor-http-20261029.json) verify all four complete rendered essay subtrees, the poem’s 68 authored breaks, full titles, canonical metadata, fonts, direct artwork bytes, closed optimizer, sitemap/RSS, missing-route behavior, and private preview headers/hooks. Missing Classic routes remain 404; existing Classic pieces retain their canonical redirect behavior.

This is local browser rendering, touch emulation and HTTP evidence—not physical-device testing, production-data verification, deployment approval or a production rollback rehearsal. The injected network failures supplement real session expiry and version conflict. They do not claim every possible failure mode. Production-specific gates remain in [Operations](../../OPERATIONS.md) and the current [verification record](../../VERIFICATION.md).

## Asset-directory rebuild (before the print correction)

After narrowing the source Wrangler asset root to `dist/client`, the rebuild preserved every client byte and every generated file except one serialized Astro manifest key in the server entry; the retained comparison documents that normalization. Both HTTP suites passed again: [13 public checks](maintenance-postbuild-public-http-20261029.json) and [15 authenticated checks](maintenance-postbuild-editor-http-20261029.json).

A fresh isolated Chromium run reopened the public index/artwork and essay, logged into the private editor, exercised unsaved title updates, and compared unsaved/saved rich previews at desktop, tablet and phone widths. All seven check groups passed, with no console errors, uncaught exceptions or resource failures. Sixteen requests across both origins confirmed private files and server code remain 404. Every post/draft row remained unchanged; the earlier mutation journeys did not need to be repeated because their code and assets are byte-identical.

The source fingerprint for that rebuild is `317ab6e7aa2ec96f7211ceb0c77bf393a692c5e5f5249b5b07d456031147a554`; the rebuilt server entry SHA-256 was `617f9bf30403f6e05a0d1a5e58cf76b93167fb3b1acd75b30c2a979a09551b92`. Evidence and its verified copy manifest are retained under `website-recovery/2026-10-29-maintenance/evidence/asset-boundarypost-build-private/`; the complete earlier lifecycle evidence remains in `private-maintenance/`.

## Final print rebuild and independent WebKit coverage

The final pagination correction changed only print-media rules in `base.css` and `reader.css`; retained PostCSS comparisons establish that all non-print rules are identical. Public and authenticated HTTP suites passed again against the final build ([13 checks](maintenance-final-public-http-20261029.json), [15 checks](maintenance-final-editor-http-20261029.json)). The full private lifecycle evidence remains applicable through that explicit equivalence; no publishing logic, DOM or screen rule changed.

The pinned **Playwright WebKit 26.5 engine** completed **23 final cases**: 12 complete-content/passage journeys, six focus/resize and modal-return cases, three reduced-motion cases, the 320px poem at maximum reading size, and 1280px index exploration. Representative screenshots were inspected. This is an independent engine check, not native Safari or physical-device testing.

The initial four focus failures and narrow-poem failure are retained. In this macOS engine, plain Tab skipped links/buttons; actual Option-Tab traversed them with visible focus. The affected cases then passed with all assertions unchanged. No browser/system preference or DOM tabindex was changed. This behavior is consistent with [Apple’s Safari keyboard guidance](https://support.apple.com/en-ie/guide/safari/cpsh003/27.0/mac/27); the evidence includes both key traces and the external runner adaptations.

Final source fingerprint: `1cdc99f4d42924ced03b4f569ae76181a6cc551cea36c66e1bfb1db6f2ea8f8b`. Final server entry SHA-256: `f34b40dea4485d69cee9465da89d34d65d4ef72dcc294b4706da0f283e5f199c`. Reports, screenshots, videos, initial failures and final passes are preserved in `website-recovery/2026-10-29-maintenance/evidence/webkit-final/`; its copy manifest verifies 95 files.
