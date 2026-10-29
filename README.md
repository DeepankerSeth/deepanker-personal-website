# Deepanker Seth — essays and poetry

A personal place to encounter writing, then settle into it. Complete titles make choosing immediate. Selected passages, material artwork and changing colour give each piece an atmosphere; the essay itself offers a quiet reading surface. On phones, a passage opens within its title's row before the artwork. Exploration is optional.

**This repository is the authoritative implementation.** `src/site` contains the public experience; there are no alternate versions to choose between. The `/classic` addresses remain as redirects to the same writing. The private writing room shares the reader's rendering and keeps drafts separate from published text.

Start here for setup and structure. [Artwork](docs/ARTWORK.md), [design learnings](docs/DESIGN-LEARNINGS.md), [release and recovery](docs/OPERATIONS.md), and [verification status](docs/VERIFICATION.md) supply the focused detail. Historical prototypes and large evidence recordings live in the private recovery bundle outside this repository, not in the public project.

## Run a clean checkout

Use Node **24.22.1**, npm **11.19.1** and Python 3. The official Node distribution used for this release includes that npm version; check both with `node --version` and `npm --version`. `.node-version` pins Node, while `package.json`'s `packageManager` pins npm for Cloudflare Builds, which otherwise selects npm independently. An older npm can reject this unchanged lockfile as out of sync. The package's supported minimum remains Node 22.23.4; use the exact release pins when reproducing it. The lockfile pins Astro 7, its Cloudflare adapter and Wrangler. No global Astro/Wrangler installation, personal browser profile, Git history or remote database is required.

```sh
npm ci
npm run setup:local -- --review-writing
npm run build
npm run serve:local
```

Open **http://127.0.0.1:4194/**. The setup creates a new, private `.local/state` database and refuses to overwrite existing state. The optional `--review-writing` loads complete captured public HTML for the four published pieces plus one unpublished synthetic test draft. **Those captures are not original Markdown or a production backup. Never republish those fixture rows.** Omit `--review-writing` for an empty local writing room.

When `.dev.vars` is absent, setup generates strong development-only credentials and saves the password in ignored `.local/development-login.txt`; it never prints the secret. Sign in at `/admin/login`. Existing credentials are left alone. [.dev.vars.example](.dev.vars.example) documents the variable names without real values.

For development with automatic rebuilding:

```sh
npm run dev
```

The development URL is normally http://localhost:4321/. Both modes use `.local/state`. For a separate state directory, setup/serve accept `--state /tmp/a-new-site-state`; development/build tooling uses `DEEPANKER_D1_PERSIST_TO` when needed. Only choose a new directory for setup. Stopping a server does not delete its state. Never run `schema.sql` against an existing production database.

## Work on the project

| Location | Responsibility |
|---|---|
| `src/pages` | Public routes, compatibility redirects, private admin pages and API entry points |
| `src/site/screens`, `layouts`, `components` | Compose the index, archive, essay and shared reading layout |
| `src/site/literary` | Artwork registry, passages, responsive index, dialogs, motion and reading controls |
| `src/components/editor` | Writing room, import/export, recovery and unsaved preview controller |
| `src/lib/editor` | Validation, sanitized Markdown and guarded draft/publication operations |
| `src/lib/db.ts`, `src/lib/auth.ts`, `src/middleware.ts` | Published reads, signed author sessions and access/cache boundaries |
| `public/literary` | Served artwork variants and self-hosted fonts with licences |
| `artwork/masters` | Unserved lossless art masters, origin notes and generation specifications |
| `schema.sql`, `migrations` | Fresh local schema and additive changes for existing databases |
| `tests/fixtures`, `scripts` | Exact public captures, synthetic test data and reproducible local checks |

The database is Cloudflare D1. Public pages render directly from `posts` with `status='published'`; they do not call the private editor API or use file-based Astro content collections. `post_drafts` stores private working copies. Original Markdown and sanitized rendered HTML have distinct purposes and must not be interchanged.

Keep `site.js`'s state transitions explicit: selection, responsive passage placement, dialogs, reading preferences and saved places are related but separate. In particular, a delayed native dialog close event can arrive after reopening; its guard protects the new session's query, focus and scroll state. Tests exercise this race. Shared poetry and title rules keep live previews consistent with published reading.

## Write, preview and publish

1. Open `/admin` and create a piece or edit an existing one. Write Markdown in the editor, import `.md`, or combine both. Download preserves the imported Markdown bytes until editing; line endings and a BOM are not silently normalized.
2. Set the title and topics. Description supplies search/sharing copy. **Index passage** is optional: choose a passage that introduces the piece, without assuming every excerpt is a verbatim quotation.
3. **Preview** or **Side by side** renders unsaved text through the same sanitized renderer and reading layout. Preview does not save or publish. Footnotes, repeated references, poetry breaks, code and tables are supported.
4. **Save private draft** (or Cmd/Ctrl-S) saves privately. It does not change the public piece. Tab-local recovery is a convenience, not a substitute for saving or downloading your writing.
5. **Publish now / Publish changes** is an explicit guarded operation. A first publication fixes the address and publication date. Later title edits do not silently change the published slug.
6. If another tab changed the piece, a stale save/publication is rejected. Keep your text, download it and inspect the saved version. A failed or expired session retains unsaved text; sign in in another tab and retry. Unpublish removes public visibility while retaining the working copy.

On localhost these actions affect only local state. Publication to the real website, pushing Git, deployment and production access require separate approval. The obsolete `/api/posts` mutation methods return 410; writing goes through `/api/editor/*` so it cannot bypass revisions or private drafts. Protected legacy reads remain for compatibility.

Published URLs are `/writing/{slug}`. The index, archive, RSS and runtime sitemap all read published records, so publishing new writing does not require rebuilding the presentation. Canonical and sharing URLs use `https://deepankerseth.com`. Private pages/preview are noindex and protected responses are private/no-store. Bespoke artwork and code changes do require a build and release review.

## Give new writing its own artistic treatment

Read the entire piece before making an image. Find a particular passage, tension or contradiction; explain why it belongs beside the proposed composition. The relationship matters more than a reusable visual formula. Keep your interpretation distinct from the author's stated meaning.

Develop material presence, depth, light, negative space and a clear silhouette at actual phone size. Preserve a lossless master, editable sources where available, and verified rights/attribution. The current artwork is openly AI-assisted raster imagery inside accessible SVG envelopes: light responds, but the painted paper does not physically unfold.

The practical [artwork guide](docs/ARTWORK.md) covers the complete process, exact passages, responsive variants, registry, accessible descriptions, atmosphere, detail states, failure handling and a reproducible *Abstractions of Illusion* example. `artworks.ts` is the shared source of the artistic association; existing entries retain stable slots for their colour/detail CSS. Do not scatter new passage or image arrays across components.

A new piece does **not** need bespoke art to publish. Its full title, own index passage or opening-paragraph excerpt and direct reading route remain available. Curated artwork is withheld if its supported quotations no longer match the writing. A new medium is welcome when it serves the text and receives equally careful keyboard, touch, reduced-motion and loading fallbacks.

Optional artwork tooling is separate from the website runtime:

```sh
python3 -m venv .venv-artwork
.venv-artwork/bin/pip install -r requirements-artwork.txt
.venv-artwork/bin/python scripts/prepare-artwork.py --help
```

## Verify changes

After initializing review-writing state:

```sh
npm run verify
```

This builds and type-checks, enforces source boundaries, packages the Worker **without uploading**, runs publishing/client/content/metadata tests, then checks routes, archive behavior and delivery budgets. `npm run package:check` uses the generated configuration explicitly; only `dist/client` is public. `dist/server` can contain private development variables and must never be served as static files.

Browser verification is separate and necessary for changes affecting presentation or interaction:

```sh
npx playwright install chromium
npm run serve:local
# In another terminal, with the local site running:
npm run test:browser -- --group=journeys
```

[Browser verification instructions](scripts/review-harness/README.md) cover equivalent-size baseline comparisons, ordinary reading/history, continuous emulated touch, keyboard focus, reduced motion and resource failures. Inspect the generated screenshots and motion; passing assertions alone do not establish visual quality. The pinned Playwright and axe packages are development dependencies, not public assets.

Check the full long title, all four pieces, poetry, both passages, endings, return paths and private preview whenever their shared code changes. Use only synthetic local text for publication tests. Preserve a verified comparison before consequential changes.

## Release and return later

The current [verification record](docs/VERIFICATION.md) separates the production candidate from the preserved maintenance baseline. [Operations](docs/OPERATIONS.md) records the read-only production discovery, actual database export and isolated rehearsal, delivery gates and rollback target. Local fixtures remain separate from that private production backup.

Source configuration sets `workers_dev: false` and `preview_urls: false` for the approved release, closing alternate public Cloudflare URLs. These settings are prepared locally; their live application and the edge HTTPS/login protections require the release approval and subsequent verification. Git `main` already triggers Cloudflare deployment, so use the single delivery sequence in Operations.

Do not push, merge, deploy, change production access or modify production data without explicit approval. A Git push may trigger publication. Return here first next time; historical notes do not override these instructions or the actual current code.
