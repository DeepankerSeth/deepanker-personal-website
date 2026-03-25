# Shared Contract Note

This note records the shared contracts that downstream V2 work depends on.

## Routing Contract

- The public route helper is [`src/shared/public/routes.ts`](/Users/deepankerseth/Documents/Antigravity IDE/deepanker-personal-website/src/shared/public/routes.ts).
- `publicUrl(version, kind, slug?)` is the shared route constructor used by both public presentation layers.
- Supported versions are `v1` and `v2`.
- Supported route kinds are `home`, `writing`, and `post`.

## Shared Post Contract

- The persisted post shape lives in [`src/lib/db.ts`](/Users/deepankerseth/Documents/Antigravity IDE/deepanker-personal-website/src/lib/db.ts).
- V2-specific additions are additive and optional:
  - `cover_variant`
  - `cover_accent`
- These fields are nullable across DB, API, and admin surfaces, so existing posts continue to render without editorial backfill.

## Cover Metadata Contract

- Allowed variants and accents are defined in [`src/shared/public/covers.ts`](/Users/deepankerseth/Documents/Antigravity IDE/deepanker-personal-website/src/shared/public/covers.ts).
- Input is normalized before persistence through:
  - `normalizeCoverVariant(value)`
  - `normalizeCoverAccent(value)`
- Fallback semantics are deterministic:
  - V2 derives a seeded fallback from `slug`, `title`, and `tags`
  - editor-provided metadata overrides the seeded fallback when valid

## Cover Rendering Contract

- The reusable V2 artifact component is [`src/v2/features/covers/V2Cover.astro`](/Users/deepankerseth/Documents/Antigravity IDE/deepanker-personal-website/src/v2/features/covers/V2Cover.astro).
- Supported modes:
  - `feature`
  - `card`
  - `masthead`
  - `stamp`
- The deterministic cover model is derived in [`src/v2/features/covers/cover.ts`](/Users/deepankerseth/Documents/Antigravity IDE/deepanker-personal-website/src/v2/features/covers/cover.ts).
