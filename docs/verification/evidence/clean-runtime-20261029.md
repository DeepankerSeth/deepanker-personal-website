# Clean-copy runtime and asset verification — 29 October 2026

No product code changed for this review. The documented clean reproduction at `/private/tmp/deepanker-maintenance-clean-20261029` ran both checks using their default, owned local launchers:

| Command | Result |
| --- | --- |
| `npm run smoke` | Passed on 4323: home, archive, representative essay, Classic 308 redirects preserving queries and missing-piece 404s. |
| `npm run audit` | Passed on 4324: all four pieces, canonical metadata, reading controls, archive GET search/filter/count/empty states, RSS, compatibility redirects and missing-piece 404s. |

Payload budgets were unchanged. Each canonical page measured **34.5 KiB CSS raw / 8.0 KiB gzip estimate**; JavaScript was **25.0 KiB / 8.9 KiB** on collection pages and **25.2 KiB / 9.1 KiB** on essays, including inline and imported code. These code totals exclude font/image binaries and are not field performance measurements.

Both helper ports were subsequently connection-refused; the user-review website on **4194 still returned 200**. No unrelated process was stopped.

## Runtime assets and private boundaries

A separate read-only HTTP review against 4194 compared its files with the clean build:

- **37/37 served static files** matched the clean build byte-for-byte, including compiled public/private-editor client assets, all six font binaries, all 12 material WebPs, four standalone SVGs, favicons and public font licences/source notes. The two additional build files, `_headers` and `.assetsignore`, are Cloudflare configuration and correctly return 404.
- **33/33 distinct runtime asset references** resolved, including the dynamically constructed 320/960/1536 artwork variants and SVG fallback references. Seven canonical/login documents were checked. No external runtime-resource reference was found in this bounded extraction.
- **25/25 private/configuration paths** returned 404, including local credentials/state, Git files, source, migrations, editorial masters, documentation, test fixtures, Worker source and obsolete checkpoint locations.
- **5/5 protected routes** denied unauthenticated access: admin pages redirect to login; editorial/legacy read APIs return 401. Every response uses `private, no-store`.
- The generated runtime configuration serves **only `dist/client`**, which contains no symlinks or client source maps. Its `vars` object is empty. Exact local credential values from both the clean reproduction and authoritative checkout were absent from every static file and checked document; no value was printed or saved in the evidence.

The public database queries still select `status = 'published'`; private working copies are not joined into public rendering. This is source inspection, separate from the authenticated publishing-workflow checks.

The source `wrangler.json` still names `./dist`, while Astro's generated configuration names `../client`. The verified `deploy`, `package:check` and local serving commands explicitly select **`dist/server/wrangler.json`**. Direct deployment using the source configuration is not the verified release procedure.

## Evidence, correction and limits

Full logs, reports and replay scripts are retained outside the publishable project in [`website-recovery/2026-10-29-maintenance/evidence/public-runtime`](../../../../website-recovery/2026-10-29-maintenance/evidence/public-runtime/), with nine copied files verified by the SHA-256 manifest. `static-surface-r3/report.json` is the final exposure report; earlier attempts remain for traceability. The first attempt wrongly expected `.assetsignore` to be publicly served. Its 404 is correct; the diagnostic was corrected to classify it as configuration, then repeated successfully. The final repetition also checked both sets of local credentials.

This establishes bounded local artifact/route behavior, not universal security, a deployed-production inspection or production-secret validation. Actual production bindings, data backup/migration rehearsal, deployed rollback identity and explicit publication approval remain governed by the release instructions. No production request, publication or data mutation occurred in this lane.
