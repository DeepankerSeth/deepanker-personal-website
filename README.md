# Deepanker Personal Website

Personal writing website and built-in CMS for essays and long-form pieces. The project is a single Astro server-rendered application deployed to Cloudflare Workers, with Cloudflare D1 as the only content store.

> Important current truth
>
> The current implementation serves:
>
> - `Observatory` at `/`, `/writing`, `/writing/:slug`
> - `Classic` at `/classic`, `/classic/writing`, `/classic/writing/:slug`
>
> If you see any older mention of `V2` living at `/v2`, or the classic site being the canonical/root experience, treat that as historical and outdated. This README reflects the current codebase.

## At a Glance

- One deployable Astro SSR app
- One D1 `posts` table as the editorial source of truth
- Two public presentations over the same published posts:
  - `Observatory` at the root
  - `Classic` under `/classic`
- One built-in admin CMS at `/admin`
- One protected JSON API surface at `/api/auth/*` and `/api/posts/*`
- Markdown is rendered at write time and stored in D1 as HTML
- Public pages render by querying D1 directly during SSR; they do not call the internal API to build the page
- Astro content collections are not used; all real content lives in D1

## Mental Model

Think of the system as one editorial engine with two skins.

The editorial engine is:

- `src/lib/db.ts` for reads and writes
- `src/lib/markdown.ts` for markdown rendering, read-time estimates, and slug generation
- `src/lib/auth.ts` plus `src/middleware.ts` for admin authentication
- Cloudflare D1 for persistence

The two skins are:

- `src/v2/*` for the current root `Observatory` experience
- `src/v1/*` for the alternate `/classic` experience

The admin panel and preview flow are separate from both public skins and still depend on the legacy top-level layout/component layer in `src/layouts/*`, `src/components/*`, and `src/styles/*`.

## Current Route Map

### Public routes

| Route | Purpose | Presentation layer |
| --- | --- | --- |
| `/` | Observatory home | `src/v2/screens/HomeScreen.astro` |
| `/writing` | Observatory library | `src/v2/screens/WritingIndexScreen.astro` |
| `/writing/:slug` | Observatory essay page | `src/v2/screens/EssayScreen.astro` |
| `/classic` | Classic home | `src/v1/screens/HomeScreen.astro` |
| `/classic/writing` | Classic writing index | `src/v1/screens/WritingIndexScreen.astro` |
| `/classic/writing/:slug` | Classic essay page | `src/v1/screens/WritingPostScreen.astro` |
| `/rss.xml` | RSS feed for published posts | `src/pages/rss.xml.js` |

### Admin routes

| Route | Purpose |
| --- | --- |
| `/admin/login` | Admin sign-in |
| `/admin` | Post dashboard |
| `/admin/posts/new` | New post editor |
| `/admin/posts/:id/edit` | Edit post editor |
| `/admin/posts/:id/preview` | Full preview page |

### API routes

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Verify password and set `admin_token` |
| `/api/auth/logout` | `POST` | Clear `admin_token` |
| `/api/posts` | `GET`, `POST` | List all posts or create a post |
| `/api/posts/:id` | `GET`, `PUT`, `DELETE` | Read, update, or delete a post |

## How the System Works

1. A request hits an Astro route in `src/pages/*`.
2. The route reads Cloudflare bindings from `Astro.locals.runtime.env`.
3. The route queries D1 through shared helpers in `src/lib/db.ts`.
4. The route passes plain `Post` objects into a V1 screen, a V2 screen, an admin page, or an RSS response.
5. Astro server-renders the HTML.
6. Small inline scripts progressively enhance the page for:
   - theme toggles
   - Observatory library search
   - Classic search and tag filtering
   - Observatory reading preferences and progress
   - admin login/save/delete actions

Publishing flow:

1. The author logs in at `/admin/login`.
2. The editor sends JSON to `/api/posts` or `/api/posts/:id`.
3. The API renders markdown to HTML with `marked` plus `highlight.js`.
4. The API stores both raw markdown (`content`) and rendered HTML (`rendered_html`) in D1.
5. If the post is published, it becomes visible on both public experiences immediately because both read the same `posts` table.
6. RSS pulls from that same published-post query.

## Current Feature Set

### Observatory (root)

- Current canonical public experience
- Dedicated V2 visual system, typography, motion, and chrome
- Home page uses the most recent published post as the lead artifact
- Writing library uses client-side substring search with `?q=` URL sync
- Essay page adds:
  - procedural cover art
  - reading progress
  - tone and type-size controls
  - local preference persistence
  - a link back to the Classic version

### Classic (`/classic`)

- Alternate typography-first presentation
- Home page shows:
  - up to 5 featured published posts
  - latest published posts
- Writing index supports:
  - client-side substring search over title and description
  - client-side tag filtering
- Essay page renders the same stored HTML in a simpler article shell

### Admin CMS

- Password-protected single-user admin model
- Create, edit, publish, unpublish, and delete posts from the browser
- Draft vs published workflow
- Optional `featured` flag
- Optional Observatory cover metadata:
  - `cover_variant`
  - `cover_accent`

### What is not currently implemented

- No file-based publishing through Astro content collections
- No multi-user accounts, users table, or roles system
- No third-party CMS
- No upload or object-storage pipeline
- No fuzzy full-text search engine; search is simple case-insensitive substring matching
- No tag filtering or sort controls on the Observatory library page
- No separate `/v2` route tree in the current implementation

## Tech Stack

- Framework: Astro 5 SSR
- Deployment target: Cloudflare Workers
- Database: Cloudflare D1
- Auth: custom SHA-256 password verification plus HMAC-signed JWT cookie
- Markdown rendering: `marked`
- Code highlighting: `highlight.js`
- Styling: Vanilla CSS
- Public presentation layers:
  - `src/v1/*` for Classic
  - `src/v2/*` for Observatory
- MDX: installed, but not used for content in the current project
- TypeScript: strict Astro/TypeScript setup
- Verification tooling:
  - version boundary guard
  - route smoke tests
  - QA and performance audit script

## Data Model

All content lives in one D1 table: `posts`.

Key fields:

- `id`: UUID primary key
- `slug`: unique URL slug
- `title`
- `description`
- `content`: raw markdown
- `rendered_html`: stored HTML generated at write time
- `tags`: JSON string array
- `status`: `draft` or `published`
- `featured`: integer flag
- `cover_variant`: optional Observatory override
- `cover_accent`: optional Observatory override
- `created_at`
- `updated_at`
- `published_at`

Important behavioral details:

- Public queries only return `status = 'published'`
- `published_at` is set the first time a post is published
- Unpublishing a post does not clear `published_at`
- Observatory cover metadata is optional; when absent, Observatory derives a deterministic cover from `slug`, `title`, and `tags`
- Classic pages ignore cover metadata completely

## Project Structure

```text
.
├── README.md
├── astro.config.mjs
├── wrangler.json
├── package.json
├── schema.sql
├── seed.sql
├── migrations/
├── docs/
│   └── architecture/
│       └── system-source-of-truth.md
├── scripts/
├── public/
└── src/
    ├── content.config.ts          # Placeholder only; Astro collections are unused
    ├── env.d.ts                   # Cloudflare env typing
    ├── middleware.ts              # Admin/API auth gate
    ├── consts.ts                  # Site constants
    ├── lib/                       # Shared server logic
    ├── shared/public/             # Shared route and cover contracts
    ├── pages/                     # Real request entry points
    │   ├── admin/                 # Admin UI routes
    │   ├── api/                   # Auth + post CRUD API
    │   ├── classic/               # Classic public routes
    │   ├── writing/               # Observatory public routes
    │   ├── index.astro            # Observatory home
    │   └── rss.xml.js             # RSS feed
    ├── v1/                        # Classic presentation layer
    ├── v2/                        # Observatory presentation layer
    ├── components/                # Legacy top-level UI still used by admin/preview
    ├── layouts/                   # Legacy top-level layouts still used by admin/preview
    └── styles/                    # Legacy top-level global CSS
```

## Local Development

### Requirements

- Node `>=22` (declared in `package.json`)
- `npm`
- Wrangler via project dependencies

### Install dependencies

```bash
npm install
```

### Create the local D1 database

```bash
npx wrangler d1 execute personal-site-db --local --file=./schema.sql
npx wrangler d1 execute personal-site-db --local --file=./seed.sql
```

### Create local secrets

Create `.dev.vars` in the project root:

```bash
ADMIN_PASSWORD_HASH=your_sha256_password_hash_here
JWT_SECRET=your_long_random_secret_here
```

Generate a password hash with Node:

```bash
node -e "const c=require('crypto');console.log(c.createHash('sha256').update('your-password').digest('hex'))"
```

Notes:

- `.dev.vars` is ignored by Git.
- The repo currently does not contain a checked-in `.dev.vars.example`, so create the file manually.

### Run the app

```bash
npm run dev
```

Admin login lives at:

```text
http://localhost:4321/admin/login
```

## Verification Commands

```bash
npm run check:boundaries
npm run smoke
npm run audit
npm run verify
```

What they do:

- `npm run check:boundaries`
  - ensures `src/v1/*` and `src/v2/*` do not import each other directly
- `npm run smoke`
  - boots the app locally and checks core Observatory plus Classic routes
- `npm run audit`
  - checks built client asset budgets and route structure/accessibility markers
- `npm run verify`
  - runs the whole sequence

Important current truth:

- `npm run smoke` passes when the environment can bind a local port
- `npm run audit` currently fails on the Observatory library page because the audit expects a polite live region with `id="library-count"`, but the implementation currently exposes `#library-empty` and not `#library-count`

## Deployment

The visible deployment path in this repo is Wrangler-driven Cloudflare deployment.

### D1

Create the production database:

```bash
npx wrangler d1 create personal-site-db
```

Apply the schema:

```bash
npx wrangler d1 execute personal-site-db --file=./schema.sql --remote
```

If the remote database predates the cover metadata fields, also apply:

```bash
npx wrangler d1 execute personal-site-db --file=./migrations/0002_add_cover_metadata_columns.sql --remote
```

### Secrets

```bash
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put JWT_SECRET
```

### Deploy

```bash
npm run build
npx wrangler deploy
```

Repository note:

- Older docs mentioned GitHub Actions, but no workflow files were present in the inspected repo when this README was updated. Treat direct Wrangler deployment as the documented path unless workflows are added later.

## Known Truths and Gotchas

- `publicUrl("v2", ...)` maps to the root routes, and `publicUrl("v1", ...)` maps to `/classic`
- Classic pages currently canonicalize to root Observatory routes
- RSS links point to the root Observatory essay URLs
- Only Classic has real tag filtering; Observatory only has query search
- Observatory search is simple substring matching across title, description, and joined tag text
- New-post inline preview is not a true ephemeral preview:
  - it sends a `POST` to `/api/posts`
  - then falls back to a regex-based client preview
- Edit-page inline preview is also regex-based and can differ from stored/public rendering
- The full preview page at `/admin/posts/:id/preview` uses stored `rendered_html`, but it renders through the legacy top-level layout rather than through Classic or Observatory
- The auth cookie is `HttpOnly` and `SameSite=Strict`, but the current code does not add a `Secure` attribute
- Astro MDX is installed but not used for content
- The top-level `src/components/*`, `src/layouts/*`, and `src/styles/*` are legacy but still important for admin and preview flows

## Read Next

For the complete technical walkthrough of the implemented architecture, data flow, runtime model, and code organization, read:

- `docs/architecture/system-source-of-truth.md`
