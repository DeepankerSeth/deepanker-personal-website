# V1 Extraction Map

This project now treats the classic public site as the canonical V1 presentation layer and keeps the public route files thin.

## Canonical Route Wrappers

- `src/pages/index.astro` -> `src/v1/screens/HomeScreen.astro`
- `src/pages/writing/index.astro` -> `src/v1/screens/WritingIndexScreen.astro`
- `src/pages/writing/[slug].astro` -> `src/v1/screens/WritingPostScreen.astro`

## Extracted V1 Presentation Surfaces

- `src/v1/components/*` mirrors the classic public UI components previously used directly under `src/components/*`
- `src/v1/layouts/*` contains the canonical public layouts for the extracted classic experience
- `src/v1/screens/*` holds the route-level V1 screens now consumed by the canonical wrappers
- `src/v1/styles/global.css` preserves the classic public styling surface

## Current Boundary Shape

- The extraction is additive: legacy top-level public files still exist in the repo, but the canonical public routes now render through `src/v1/**`.
- `src/v1/**` and `src/v2/**` are protected by [`scripts/check-version-boundaries.mjs`](/Users/deepankerseth/Documents/Antigravity IDE/deepanker-personal-website/scripts/check-version-boundaries.mjs).
- Shared public contracts live in `src/shared/public/**`, not in either presentation layer.
