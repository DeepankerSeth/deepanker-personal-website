# Release, recovery and publication

The README is the starting point. This guide covers the boundary between a locally verified release and the real website. **No production action is authorized by the commands or checklist here.** Pushing Git may trigger deployment and requires explicit approval too.

## Local development and verification

`npm ci`, `npm run setup:local -- --review-writing`, `npm run build`, and `npm run serve:local` reproduce the public reading experience and a private synthetic draft in a clean checkout. The default state is ignored `.local/state`; setup refuses to overwrite existing state. Omit `--review-writing` to start empty. `schema.sql` is the complete fresh schema; applying incremental migrations afterward would duplicate columns.

`npm run verify` performs local build, checks, tests, no-upload packaging and read-only route/payload audits. Browser instructions and their scope are in [the harness README](../scripts/review-harness/README.md). The current [verification record](VERIFICATION.md) distinguishes final evidence from earlier comparison material.

For a sample migration rehearsal, `scripts/release-rehearsal.py --help` describes its protected local paths. It opens the input read-only, makes a consistent SQLite backup, applies migration 0003 only to a separate candidate, and compares all original post columns. The optional `--project-legacy` is explicitly a sample projection. The actual-production rehearsal described below restores the real SQL export; the sample is not its substitute.

## Private recovery bundle

This workspace's recovery root is **`../website-recovery/2026-10-29-maintenance/`**, outside the publishable project. Keep it private and do not commit, upload or serve it. It contains local credentials and databases.

- `before-maintenance/` preserves candidate O intact: the accepted public experience, generated pages, dependencies, Git state, complete local source, original artwork masters, local review databases and evidence.
- `history/` preserves unique source material from the explicitly approved obsolete directories. File manifests resolve content either from the preserved release or compressed, hashed objects. Generated old builds, dependency installs and tool scratch were omitted. This is historical reference, not another supported implementation.
- `final/` contains the finished maintenance source, exact build, installed dependencies, Git/dirty state, artwork masters and an independent consistent local review database. Its post-capture restore receipt lives in `evidence/final-restore/`, outside the immutable artifact.
- `evidence/` contains detailed recordings, failed inspection attempts and successful final checks. Current summaries remain in this project.

Verify the finished recovery artifact without opening its databases for writing:

```sh
python3 ../website-recovery/2026-10-29-maintenance/final/verify.py
```

Restore into a **new** private directory rather than replacing the working project:

```sh
python3 ../website-recovery/2026-10-29-maintenance/final/restore.py \
  --out /tmp/a-new-website-restore --port 4221
/tmp/a-new-website-restore/RUN.sh
```

The helper refuses existing output and locations inside the active project or recovery bundle. It verifies every payload before and after copying, keeps independent local state, and prepares a loopback-only launcher. Preserve any later work or writing before replacing a checkout. Use the retained build for exact comparison; rebuilding can create a new Astro manifest encryption key and requires a new artifact identity. Installed Mac dependencies are preserved for this machine; a clean install is the portable reproduction path.

To compare or return to the accepted pre-maintenance design, verify `before-maintenance/verify.py`, then use `before-maintenance/prepare.py --restore --out /tmp/a-new-accepted-restore --port 4217`. Do not overwrite newer work. For one historical source tree, `restore-history.py --list` lists archive IDs; `--source ID --out /tmp/a-new-history-extract` extracts and verifies its files. Historical builds/dependencies were intentionally omitted; it is reference material, not another supported website.

Each SQLite backup is transactionally consistent. Separate databases are not one atomic cross-database snapshot. These are **local** review/development databases, not a backup of the actual public website. Captured HTML fixture rows are not recoverable production Markdown and must never be imported into production.

## Production preflight — 29 October 2026

Read-only production discovery and a private database export were authorized and completed. **Go-live is not yet approved. No Git push, deployment, production migration, content write or production setting change has occurred in this pass.** Authentication was renewed through the normal Cloudflare flow; secret values were not retrieved or replaced.

The verified target is repository `DeepankerSeth/deepanker-personal-website`, Worker `deepanker-personal-website`, custom domain `deepankerseth.com`, and binding `DB` to `personal-site-db` (`c3e46cae-f0b8-45f6-9c45-6a1db9861144`). Runtime secret names are `ADMIN_PASSWORD_HASH` and `JWT_SECRET`. The active pre-release version is **`85ffa45c-f0a6-4f26-bec5-252fb0b2930f`**. Its downloaded code ETag matches the active-version metadata; deployment state was unchanged across the read. This identifies the actual rollback application, not a guessed Git commit.

Private evidence lives in `../website-recovery/2026-10-29-production/` (outside this repository). `CLOUDFLARE-DISCOVERY.md` records the account, routing, build settings and access observations; `production-export-receipt.json` identifies the actual D1 export at **08:46:15 UTC**, SHA-256 `19a03b62a01343dda2623e70347dac006cc5e3cc88e01dfabc41d97c310fb451`. The export was restored separately and only `0003_editor_working_copies.sql` was needed. All **four published posts and fourteen original columns**, including original Markdown and rendered HTML, remained exact. The schema has no migration ledger. **Do not use `wrangler d1 migrations apply` or replay earlier migrations:** after a fresh schema comparison, apply only the approved, rehearsed SQL file. Never run `schema.sql` or import captured HTML fixtures into production.

The real-export rehearsal and its manifests are in `data-rehearsal/actual-production-restore/`; current-application and browser checks are separate from the untouched export. D1 Time Travel showed seven-day retention at inspection. Its bookmark expires and does not replace the private export. Refresh the backup and compare production state immediately before the approved migration; pause authoring through cutover so a later edit is not overlooked.

## Proposed delivery sequence — requires approval

Keep the existing Cloudflare Git integration as the sole deployment owner. Its current root is `/`, production branch is `main`, build is `npm run build`, deployment is `npm run deploy`, and non-production builds run `npx wrangler versions upload`. A push to `main` publishes. Non-production upload does not promote traffic, but currently exposes version URLs using production resources; it is not an isolated database.

1. Review the exact source commit, clean-build evidence, real-data rehearsal and rollback target. Recheck remote heads and production drift. Approve the complete sequence, including conditional remote checks, edge changes and any disposable private-draft test.
2. Apply approved edge protection before pushing: Always Use HTTPS, the available Free-plan login rate-limit rule, and closure of public `workers.dev` and version URLs. The zone currently has one apex Worker DNS record, no other hosts, HTTPS forcing off and zero of one rate-limit rules used. Preserve Cloudflare incoming URL normalization. The proposed rule is `starts_with(http.request.uri.path, "/api/auth/login")`, two requests per ten seconds and a ten-second block; it includes trailing-slash aliases. Verify encoded, dot and repeated-slash aliases at the edge after approval. Do not add `www`, mail services or new access products incidentally.
3. Preserve `workers_dev: false` and `preview_urls: false` in both source and generated configuration. Set the non-production command to `npx wrangler versions upload --config dist/server/wrangler.json`; keep the existing production command, which already uses that generated file. Use the committed Node 24.22.1 pin. Do not switch this integration to the new Worker Previews system during release.
4. Push the reviewed feature branch, then wait for required GitHub checks and the Cloudflare upload build. Verify that alternate public URLs remain disabled. Resolve failures before migration or merge. Do not race the integration with a manual deployment.
5. During the agreed authoring pause, refresh the private backup and confirm the rehearsed schema still matches. Apply only migration 0003, verify preserved rows, then merge the approved commit to `main`. Let Cloudflare build/deploy and identify the actual version receiving traffic. A CI rebuild may change Astro's manifest key; trace source, configuration and resulting deployment instead of claiming the local entry hash identifies the hosted artifact.
6. Verify the actual domain: complete published writing, artwork/passages, mobile/desktop reading, history/settings/Contents, metadata/feed/sitemap, assets, redirects, HTTPS, rate-limit aliases, private caching and legitimate login/preview. Live write checks require the separately approved disposable **private** draft and its cleanup; never edit real essays to test the system.

Wrangler preserves deployed secrets; do not supply local `.dev.vars` or substitute development values. Ordinary dashboard variables have different overwrite semantics and must be checked separately. Only `dist/client` is publicly served; deploy using `dist/server/wrangler.json`, never a saved development build containing private variables. Workers/D1 CLI access does not authorize zone changes; approved zone settings can use the dashboard without broadening token scope.

## Application rollback

The pre-release rollback command, to run **only under the approved failure conditions**, is:

```sh
npx wrangler rollback 85ffa45c-f0a6-4f26-bec5-252fb0b2930f \
  --name deepanker-personal-website --config dist/server/wrangler.json
```

This changes the active application; it has not been exercised against production during preflight. Use it for the agreed availability, content, authentication or navigation failure triggers, then verify the serving version and public recovery. Retain HTTPS/rate-limit controls and disabled alternate routes; do not redeploy the old source configuration, which could reopen them. Keep the old editor closed to writes after rollback until compatibility with newer working copies has been reviewed.

The exact downloaded old Worker passed nine isolated compatibility checks against the migrated real-data copy, including complete public reads, synthetic login, writer/revision behavior and cleanup, with no outbound requests. Historical static assets were stubbed, so this is application/data evidence, not a live or visual rollback test. It also confirmed why the authoring pause matters: the old editor cannot show private-only drafts, and old deletion/slug edits bypass newer safeguards. Private evidence is in `../website-recovery/2026-10-29-production/data-rehearsal/actual-deployed-worker-rehearsal-final/`.

Application rollback and database restoration are separate decisions. Preserve additive columns, drafts, revision triggers and newer writing. Never automatically rewind D1: restoring an old database can erase work created after the export and requires a separate recovery decision. The old `/api/posts` writers are not an alternative to the new guarded workflow. Record final deployment IDs and live evidence in the private release receipt; a documentation-only push must not accidentally trigger a second deployment.

## What to preserve for the next release

Keep exact source and build identities, package lockfile, migrations, artwork masters/licences, complete local restore instructions and the evidence for consequential changes. Keep one current verification summary in the project; put large recordings and superseded reports in the private recovery bundle. Claims about physical devices, assistive technologies, field performance or production data require their own actual evidence.
