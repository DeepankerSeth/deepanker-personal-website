# Verification and production preflight — 29 October 2026

**The accepted experience is preserved; the production candidate has been checked locally and the real database has been exported and rehearsed in isolation. Publication still requires approval and live verification.** The authoritative project is this repository; the review server is `http://127.0.0.1:4194/`. No push, merge, deployment, production migration, content write or production setting change occurred in this preflight. Authenticated discovery and the private export were explicitly authorized.

## Current production candidate

The candidate was rebuilt with **Node 24.22.1 and npm 11.19.1**, matching the committed `.node-version`, in a fresh copy installed from the lockfile before adding any development credentials or fixture database. Its record is `../website-recovery/2026-10-29-production/final-candidate/evidence/FINAL-LOCAL-VERIFICATION.md`; `source-copy.json` and `clean-build-identity.json` identify the 191-file source snapshot and 156-file build. These were captured before this documentation-only handover update, not asserted to be the eventual Git commit or hosted CI artifact.

- Compiled entry SHA-256: `26d8e63eac62f518af65cc44d22db426dd39f596f59f83dc3318d4a7d6415c0d`.
- Build inventory SHA-256: `c5a5a66abfd115e7a76a6a73555ce40ef201e17106d76a58be19340cf41a122a`; the report defines its serialization.
- All **39 client files**, including artwork, fonts, CSS and JavaScript, remain byte-identical to the accepted maintenance release. This pass changes release/transport handling, not the design.
- Generated configuration has empty `vars`, only `../client` as public assets, the verified D1 binding, and `workers_dev: false` / `preview_urls: false`. Those are prepared artifact settings, **not** claims that the live account has changed.

| Final-candidate check | Observed result |
| --- | --- |
| Clean build and packaging | Locked offline install; boundaries, Astro build, TypeScript and generated-config dry-run packaging passed without development variables or an upload. |
| Focused tests | 30 editor, 23 editor/preview client, 6 metadata, 18 passage, 13 literary VM and 9 local-proxy-policy reported checks passed. |
| Transport and boundaries | 17 compiled-Worker checks covered exact HTTP redirects, unsafe-method rejection and local/HTTPS login. Six server-boundary groups checked private paths, auth/cache/noindex, 37 byte-exact served assets and absence of transport-induced writes/cookies. |
| Public and private HTTP | Smoke, archive/payload audit and 15 integrated checks passed for complete fixture writing, assets, metadata/feed/sitemap and synthetic private preview. |
| Fresh Chromium | 12 journeys, 6 focus/rotation cases and 10 ordinary-reading cases passed. They include the complete long title, poem, eight passages, keyboard Contents, saved place, reload/history, 320 px large reading type, intermediate/tablet widths and touch-style exploration. Representative final screenshots were inspected. |
| Login aliases | 30 local raw-path probes established accepted trailing-slash, encoded-letter, dot and repeated-slash login forms; neighboring protected aliases remained denied. This requires normalized edge matching, not raw-path equality. |

A local development proxy initially rewrote an HTTPS Location header to HTTP. Its failed assertion was retained; direct execution of the same compiled entry in workerd/Miniflare, with outbound requests blocked, passed the transport checks. This does not prove hosted edge behavior. The source/build identity was checked again after the browser runs. Historical comparison evidence below remains separate; it was not relabelled as a new run.

## Actual production-data preparation

Read-only dashboard/API discovery matched the Worker, domain, D1 and secret names in [Operations](OPERATIONS.md). The active rollback version is `85ffa45c-f0a6-4f26-bec5-252fb0b2930f`; the downloaded deployed code ETag matched its version metadata and deployment state did not change during retrieval.

The actual D1 export at **08:46:15 UTC** has SHA-256 `19a03b62a01343dda2623e70347dac006cc5e3cc88e01dfabc41d97c310fb451`. Its isolated restore required only migration **0003**, with no migration ledger to replay. All **four published posts and fourteen original columns** remained exact, including **21,892 bytes of original Markdown** and **22,141 bytes of rendered HTML**. This is real-export evidence; it does not come from the public HTML fixtures. The input export remained unchanged.

Using that migrated copy and the final compiled candidate, 12 current-handler checks and 15 full-built Chromium checks passed; two additional real wheel-scroll cases verified private reading preview at desktop and phone widths. Original application rows were unchanged, and the synthetic private draft was cleaned up. The private evidence is under `../website-recovery/2026-10-29-production/data-rehearsal/`, particularly `actual-production-restore/rehearsal.json`, `actual-production-editor-node24/editor-rehearsal.json`, and `actual-built-runtime/browser/`.

The exact downloaded pre-release Worker then passed **nine isolated compatibility checks** on the migrated actual data, with zero outbound requests. Public reading, login, legacy writer/revision behavior and cleanup were exercised. Its source-map comparison matched eleven of eleven database helpers to the earlier source rehearsal; the actual bundle execution supplies the stronger evidence. Static assets were stubbed, so neither production rollback nor the old site's visual recovery is claimed tested. The old editor cannot show private-only drafts, and its deletion/slug operations bypass newer safeguards: authoring must remain paused on rollback. The initial DELETE check correctly received 403 because the harness omitted Origin; that failed attempt remains preserved beside the corrected browser-equivalent run in `actual-deployed-worker-rehearsal-final/report.json`.

The public-before baseline independently rendered all four live pieces at phone and desktop sizes and matched their prose to the preserved captures, including the full long title and 68 authored poem breaks. It also found the live HTTP login form, missing HTTPS forcing and unsuitable old sitemap inventory. The candidate addresses the application-side metadata/transport behavior; the approved release must apply and verify the edge controls.

## Preserved maintenance baseline — historical evidence

[The maintenance product identity](verification/evidence/final-product-identity.json) lists every included file and digest **for the earlier maintenance artifact**, not the current production candidate. Its source set contains `src`, `public`, migrations and seven build/configuration files; its build set contains that exact artifact. Documentation, tests, masters, Git/dirty state and dependencies are additionally preserved by the maintenance recovery bundle's full repository manifest.

- Source: **112 files**, SHA-256 `86a7e4811160e529ceff542008c4d082ec85f399442e0c2ec3af388d49a5a2cd`.
- Build: **157 files**, SHA-256 `89cd91124ee311241653f46246961a77f771354ce4dea2fee2e69952d4940b2f`.
- Server entry: `f34b40dea4485d69cee9465da89d34d65d4ef72dcc294b4706da0f283e5f199c`.
- Clean reproduction used Node 26.0.0, npm 11.12.1 and Python 3.14.3. The package's supported minimum Node version is 22.23.4; that minimum was not a second runtime test.

A fresh copy without Git history, installed dependencies, credentials, build output or a database followed the then-current README: `npm ci`, `setup:local -- --review-writing`, build/type/boundary checks and no-upload packaging. Subsequent configuration and print corrections were rebuilt there. Browser checks below refer to that print-corrected maintenance build. Its ordinary public writing is complete captured HTML, separate from the subsequently exported production Markdown/database.

## Maintenance changes retained

Removed the retired public implementations and parallel study files, obsolete selectors, duplicated fonts, unused MDX integration and obsolete documentation. Nineteen explicitly approved obsolete directories were archived and removed; unrelated GitHub-profile work was untouched. Large historical evidence belongs in the private recovery bundle, not the active project.

The public implementation now lives in `src/site`. One artwork registry supplies passages, descriptions and light foci. Shared title/poetry rules keep saved pages and private preview aligned. The preview controller is separate from its template, including stale-response protection. Existing `/classic` links redirect to the canonical writing while missing pieces remain 404. Retired mutation APIs return 410 instead of bypassing guarded draft/publication operations.

Meaningful data/schema/revision protections, exact content fixtures, artwork masters/provenance, font licences and failure handling remain. The README is the current starting point; the artwork guide and design learnings carry useful knowledge forward. Superseded art integration notes are archived rather than presented as current instructions.

Two last release defects were corrected: the source Wrangler asset root now explicitly names `dist/client`; print clears the root canvas and restores authored poetry line flow with widow/orphan protection. The print change preserves every non-print CSS declaration and its order. It does not reduce type or compress the poem to fit fewer pages.

## Maintenance verification retained

| Area | Final evidence and result |
|---|---|
| Build and focused tests | Clean build, source boundaries, TypeScript and generated-configuration dry run passed. 29 editor, 23 editor/preview client, 6 metadata, 18 passage, 13 reader-client and 9 harness-policy reported checks passed. No upload. |
| Public presentation | 34 viewport cases across 17 sizes, all four complete pieces, eight passage destinations, full long title, all 68 authored poem breaks and endings. Before the print-only correction, 34 settled home pairs and 16 title/print pairs were pixel-identical to accepted O. Final screen behavior was rerun; changed print is separately judged below. |
| Final Chromium | 81 matrix cases, 10 ordinary journeys and 72 dialog lifecycle cases passed after the last product change. Covers mouse, actual continuous emulated touch movement/scrolling, visible focus, breakpoint crossing, rotation, reduced motion, rapid interruption, reading settings, saved places, reload/history and controlled failures. |
| Final WebKit | 23 content, focus, motion and ordinary cases passed. This macOS WebKit uses Option-Tab to include links/buttons; real key traversal passed after diagnosing five plain-Tab attempts. Failures and key traces remain recorded. No OS preference or product tabindex was changed. |
| Private publishing | 17 UI/lifecycle checks plus six accepted-baseline comparisons: byte-preserving Markdown import/download, unsaved preview without writes, private saving, explicit synthetic publication/unpublication, conflict/session/network recovery and mobile behavior. Original posts and the pre-existing QA draft were unchanged. Final rebuilt HTTP runs passed 13 public and 15 authenticated checks. |
| Failure/accessibility checks | 18 rendered axe audits reported no violations. All incomplete contrast targets received bounded follow-up across 17 actual states (minimum measured 5.12:1). Storage-denied controls clearly report that changes cannot persist; positive controls retain preferences/place after reload. Failed media, fonts and script keep usable reading routes. This is bounded evidence, not a declaration of universal accessibility. |
| Actual PDF output | The long-title essay and poem each passed A4 and Letter output checks: complete text, authored breaks, white canvas and a closing heart kept with writing. First and last pages were visually inspected. These are generated PDFs, not a physical printer test. |
| Delivery and exposure | Default local smoke/audit launchers pass; CSS 34.7 KiB and public JavaScript approximately 25 KiB remain under retained budgets. Exact served assets and runtime references resolve; private/configuration paths are denied. npm's dated advisory check reported zero known vulnerabilities; it is not a security proof. |
| Migration/tooling | The portable local rehearsal preserved every original column of four projected rows and left its source unchanged. Twelve artwork variants reproduced byte-for-byte from preserved masters with the documented encoder. Both checks have precise scope limits. |

Detailed maintenance reports are [public comparison](verification/evidence/public-maintenance-20261029.md), [private workflow](verification/evidence/private-maintenance-20261029.md), [clean runtime](verification/evidence/clean-runtime-20261029.md), [final Chromium](verification/evidence/final-chromium-20261029.md), and [print/resilience/measurements](verification/evidence/refinement-20261029.md). Full screenshots, recordings, failed attempts, scripts and verified copy manifests are outside the project in `../website-recovery/2026-10-29-maintenance/evidence/`.

Local performance is a controlled lab observation. The final quiet sample used three fresh loads of home, long-title essay and poem at 390 and 1280 px; exact timings/transfer counts are in the refinement note. It does not establish real-network performance, INP, field Core Web Vitals or a population percentile. Screen comparisons and assertions do not prove literary quality or twenty minutes of human reading.

## Recovery and remaining release gates

[Operations](OPERATIONS.md) gives exact verify/restore commands. The private recovery root contains the accepted pre-maintenance O artifact, hashed historical source objects, the finished `final/` artifact and detailed evidence. The final independent restore receipt is kept under `evidence/final-restore/` **outside** the immutable artifact, so it can record the test of that artifact without changing it. Local recovery preserves source/build and development data; it cannot replace a production backup. All generated local state and credentials remain private.

The remaining gates are explicit: obtain approval for the concrete source/delivery/configuration/migration sequence; refresh data/remote-state checks before cutover; apply and verify HTTPS, normalized login rate limiting and alternate-route closure; pass required remote build/checks before promotion; verify the resulting live version, reading and legitimate private publishing. Any live draft test and bounded application rollback require inclusion in that approval. No local result establishes that these live actions have occurred. [Operations](OPERATIONS.md) records the proposed order and keeps database restoration separate from application rollback.

Physical phones/tablets, native Safari, a screen reader, a physical printer and native browser zoom were not newly tested in this maintenance pass. Browser-engine emulation and narrow/rotated layouts are identified as such. Earlier evidence remains recoverable but is not silently relabelled as a fresh device test. No unresolved product defect is knowingly being treated as a passing check.
