# Final Chromium and runtime verification — 29 October 2026

These checks ran **after the final print CSS fixes and asset-directory correction were rebuilt**. They supersede the earlier browser/runtime pass for final-source verification. No product code changed during these runs.

| Final check | Result |
| --- | --- |
| Full Chromium matrix | **81/81 passed**: all four complete pieces and eight passages; endings/discovery; artwork dialogs; breakpoint focus/rotation; 17 candidate/O viewport pairs; reduced motion; continuous touch; storage/resource failures and JavaScript-free search. |
| Ordinary reader journeys | **10/10 passed**: reading size/tone, save/resume/reload/history/clear, 320px poetry at maximum type size, long-title resizing, tablet Contents rotation and rapid title/passage exploration. |
| Native dialog lifecycle | **72/72 passed**, including **70** observed queued close events while a dialog was already reopened; focus and scroll lock remained correct. |
| Active `npm run smoke` / `npm run audit` | Both passed through their default owned launchers, 4323/4324. All four pieces, archive GET behavior, metadata, redirects, 404s and unchanged payload budgets passed. |
| Final static/private surface | 37 served assets exactly match the final build; 33 runtime references resolve; 25 private/config paths return 404; five protected routes deny unauthenticated access with private/no-store responses. |

All three browser runners recorded identical before/after fingerprints across **111 guarded source, public, migration and configuration files**. The full per-file hashes are preserved in each report; `summary.json` includes their sorted-JSON SHA-256. This is a run-stability guard, separate from the release-artifact and recovery manifests.

The 11 cases flagged for diagnostic review contained only deliberately injected HTTP 503 responses for fonts, artwork or application JavaScript. Their corresponding request failures were expected. Reviewing every case found **no uncaught page error, unexpected blocked request or unexpected resource error**. Failure behavior was inspected in the rendered artwork fallback as well as asserted.

## Continuous touch and rendered review

Chromium CDP sent 20 changing-coordinate move samples per gesture; the observer recorded 19 trusted move events and 19 distinct positions in each. This is touch **emulation**, not physical-device testing.

| Scroller | Observed movement | Accidental clicks | Outer-page movement during modal swipe |
| --- | --- | --- | --- |
| Essay | 0 → 270px | 0 | Not applicable |
| Contents | 0 → 104px | 0 | 0px |
| Artwork dialog | 0 → 99px | 0 | 0px |

Representative final reading, Contents, artwork scrolling and failure-state screenshots were inspected. An initial impression that the artwork Close button disappeared was a **visual misreading**: its original before/after pixel region is identical. A separate bounded replay confirmed unchanged visible 57.89×44px geometry, correct hit-testing, successful touch close, Enter/Escape close and restored focus. No corrective product change was made.

Screenshots and event/geometry traces support this review; the preserved videos are available for direct playback. The earlier exact static comparisons remain useful evidence of the accepted design. Their non-print preservation is additionally supported by the print-only CSS AST comparison; final print/PDF verification is recorded separately.

## Final runtime details

The final code payload is **34.7 KiB CSS raw / 8.1 KiB gzip estimate** per canonical page. JavaScript remains **25.0 KiB / 8.9 KiB** for the collection and **25.2 KiB / 9.1 KiB** for essays, including inline/imported code. Font and image binaries are outside these code budgets. Parallel functional runs were not used as quiet performance measurements.

Both source and generated runtime configurations now restrict assets to `dist/client`. That directory has no symlinks or public source maps. Exact local credential values from the active and clean-copy environments are absent from every checked static file/document; secret values are not recorded. The private-path test is bounded local evidence, not a universal security proof or production-secret validation.

Playwright 1.62.1 used isolated Chromium 151.0.7922.34 contexts and fixed loopback origins. No personal profile, production request, publication or data mutation was used. These checks do not establish physical-device compatibility, native browser zoom, screen-reader behavior, twenty minutes of human reading or production field performance. All owned browsers and smoke/audit helpers exited; the review server remains under the parent task's control.

## Preserved evidence

Full reports, screenshots, videos, logs, the diagnostic classification and bounded replay are in [`website-recovery/2026-10-29-maintenance/evidence/final-chromium`](../../../../website-recovery/2026-10-29-maintenance/evidence/final-chromium/). Its manifest covers **272 files / 34,937,585 bytes**, verified against the temporary originals. Capture paths in raw reports are historical; matching files live in the archive subfolders.

To repeat with the candidate on 4194, O on 4217 and the documented local failure proxies running:

```sh
node scripts/review-harness/final-browser.mjs --authorized-local-browser-review --group=all --baseline=http://127.0.0.1:4217
node scripts/review-harness/final-ordinary.mjs --authorized-local-browser-review
node scripts/review-harness/final-dialog-lifecycle.mjs --authorized-local-browser-review
npm run smoke
npm run audit
```

See [browser setup and limitations](../../../scripts/review-harness/README.md). Actual PDF, independent-engine, quiet performance, release reproduction and recovery verification remain separately identified evidence.
