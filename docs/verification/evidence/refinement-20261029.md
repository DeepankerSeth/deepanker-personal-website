# Final print, resilience and local measurements

All final compiled print/performance runs identify server entry `f34b40dea4485d69cee9465da89d34d65d4ef72dcc294b4706da0f283e5f199c`. Source fingerprints were unchanged during them. The [full record and raw evidence](../../../../website-recovery/2026-10-29-maintenance/evidence/remaining-public/FINAL-REVIEW-NOTE.md) distinguish earlier runs from these final results and preserve failed inspection attempts.

Four actual PDFs cover the long-title essay and poem, each on A4 and Letter with 16 mm margins. Complete titles/body characters and the poem's 68 authored breaks remain. First and last pages were rendered and inspected: the canvas is white and the heart stays with preceding writing. All are three pages; type/leading were not compressed. The CSS change affects print only; every non-print declaration and its order stayed identical.

Seventeen rendered contrast follow-ups resolved incomplete axe findings (minimum 5.12:1). Normal storage restores reading preferences and the saved paragraph; denied storage applies settings for the visit, visibly reports the inability to persist and reloads with honest defaults. The final unobscured-notice screenshots hide only the observer's QA button. Final Chromium checks repeat the ordinary failures and interactions on the finished source.

## Quiet local loading sample

Three fresh Chromium contexts per route/width, sequentially after other verification browsers closed: 18 loads, no runtime/resource errors or horizontal overflow. Each observation waits two seconds after load. Read-only interception disables cache and adds overhead; no CPU/network throttle was applied.

| Width | Page | Median LCP ms | Maximum CLS | Transfer bytes | Requests |
|---|---|---:|---:|---:|---:|
| 390 | Index | 72 | 0 | 343,607 | 12 |
| 390 | Long title | 84 | 0 | 346,222 | 12 |
| 390 | Poem | 68 | 0 | 344,178 | 12 |
| 1280 | Index | 124 | 0.01970 | 512,353 | 13 |
| 1280 | Long title | 72 | 0.00031 | 346,222 | 12 |
| 1280 | Poem | 76 | 0.00083 | 344,178 | 12 |

These are loopback lab observations, not physical phones, real-network performance, INP, production field data or percentile Core Web Vitals. Transfers are observed Resource Timing totals, not the entire release size. Physical devices, native zoom, screen readers and physical printers remain outside this pass's evidence.

Representative final renders (phone/desktop captured after settling in the quiet sample; tablet from the final viewport matrix): [phone](current-phone.png), [tablet](current-tablet.png), [desktop](current-desktop.png). Full motion, failure, keyboard and print evidence lives in the private archive; three pictures do not stand in for those journeys.
