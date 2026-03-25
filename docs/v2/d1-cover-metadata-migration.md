# D1 Cover Metadata Migration

Use this when an existing Cloudflare D1 database was created before `cover_variant` and `cover_accent` were added to the shared post model.

## Migration File

- [`migrations/0002_add_cover_metadata_columns.sql`](/Users/deepankerseth/Documents/Antigravity IDE/deepanker-personal-website/migrations/0002_add_cover_metadata_columns.sql)

## Recommended Remote Sequence

1. Inspect the deployed schema:
   `npx wrangler d1 execute personal-site-db --remote --command "PRAGMA table_info(posts);"`
2. If both `cover_variant` and `cover_accent` are missing, apply the migration file:
   `npx wrangler d1 execute personal-site-db --remote --file=./migrations/0002_add_cover_metadata_columns.sql`
3. If only one column is missing, execute only the corresponding `ALTER TABLE` statement manually.
4. Re-run the schema inspection command and confirm both columns are present.

## Current Status

- Attempted on March 25, 2026 from this workspace.
- Remote execution was blocked by Cloudflare authorization:
  - `The given account is not valid or is not authorized to access this service`
  - Cloudflare API error code: `7403`

## Why This Matters

- The admin UI and API already accept optional V2 cover metadata.
- Existing databases that were initialized before these fields existed will otherwise reject or ignore the new values.
