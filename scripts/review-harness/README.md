# Local browser verification

These tools exercise the built website and controlled local failures. They are development tools, excluded from the public assets and Worker bundle. They do not start the application, publish writing, reuse a personal browser profile or contact production.

## Prepare a repeatable comparison

From the project root, install the pinned test dependencies and their Chromium build:

```sh
npm ci
npx playwright install chromium
```

Follow the project README to build and serve the candidate on **127.0.0.1:4194**. Serve the preserved baseline separately on **127.0.0.1:4217**, using its own build and isolated data. Keep both versions unchanged during a comparison. Record their source/build identities in the release evidence; a responding port is not proof of which build it serves.

The browser runners require `--authorized-local-browser-review` as an explicit local execution acknowledgement. Existing user authorization remains valid; this flag does not authorize publication. They only allow fixed loopback origins and read-only requests, block service workers where configured, and use fresh browser contexts. Check listener ownership before starting the proxies below; stop only processes you started.

```sh
# Separate terminals; the candidate must already be running.
node scripts/review-harness/server.mjs --base-port 4290 --build-kind production
node scripts/review-harness/mobile/server.mjs --profile touch --port 4306
node scripts/review-harness/mobile/server.mjs --profile storage-denied --port 4307

# The full public matrix, including equivalent baseline viewports.
node scripts/review-harness/final-browser.mjs --authorized-local-browser-review --group=all --baseline=http://127.0.0.1:4217
node scripts/review-harness/final-ordinary.mjs --authorized-local-browser-review
node scripts/review-harness/final-dialog-lifecycle.mjs --authorized-local-browser-review
```

The runners print their evidence directories. Defaults are fresh private directories under the operating system's temporary directory. Copy the relevant reports, screenshots and videos into the release evidence before temporary cleanup. `final-browser` also accepts `--out=/absolute/temporary/path`; lifecycle requires that an explicitly supplied output directory not already exist.

Run groups separately when diagnosing a failure: `journeys`, `dialogs`, `focus`, `widths`, `motion`, `touch` or `resilience`. The first five need the candidate; `widths` also needs the baseline, `touch` needs 4306, and `resilience` needs 4290–4295 and 4307. `final-ordinary` accepts `--case=CASE_NAME` for one named journey. Preserve failed attempts and repeat affected journeys after fixing their cause.

`final-browser --browser=chrome` uses an already installed Chrome channel. To test the independent WebKit engine, first run `npx playwright install webkit`, then select a non-touch group with `--browser=webkit`. The continuous-touch group uses Chromium CDP and is rejected for WebKit. No private cache path or alternate executable workaround is needed. An unavailable engine is a coverage gap, never a passing result.

## What the evidence establishes

- The public matrix compares all four complete pieces and eight passages against preserved content fixtures; exercises dialogs, focus, reduced motion, rapid changes, failure states and phone-to-desktop widths; records rendered screenshots, diagnostics and lab timings.
- The ordinary journeys cover reading size/tone, saved paragraphs, reload, history, long titles, poetry, tablet rotation and exploration. The lifecycle regression stresses queued native dialog-close events, scroll locking and restored focus.
- All three runners fingerprint the complete `src`, `public`, migrations and build configuration before and after. This includes the artwork registry, shared poetry renderer and all styles. A changed source invalidates the run's final-version claim; matching hashes alone do not establish visual fidelity or the identity of the running build.

Inspect equivalent baseline/candidate screenshots and the motion recordings. Experience the site directly, including sustained reading. Assertions cannot establish intimacy, balance, comfort or artistic quality. Controlled touch input is emulation, not physical-device testing. Viewport rotation is not hardware orientation; reading font size or CSS scaling is not native browser zoom. Native zoom, screen-reader and physical-device results require their own actual observations. Report unperformed coverage plainly.

## Controlled public resource failures

The public proxy only forwards GET/HEAD published pages and an explicit asset allowlist to 4194. It rejects admin/API paths, arbitrary upstreams, writes and external redirects; it forwards no credentials. Use `--build-kind development` only for an Astro dev server. A detected Vite client always marks the evidence as development; HMR WebSockets are not proxied.

| Port | Profile | Controlled fault |
| --- | --- | --- |
| 4290 | control | Same diagnostic overhead, no resource fault. |
| 4291 | slow-media | Fonts and material WebPs wait 2,500 ms. |
| 4292 | fonts-fail | Font requests return 503. |
| 4293 | large-art-fail | 960/1536 px WebPs return 503; 320 px remains available. |
| 4294 | all-art-fail | Every material WebP returns 503. |
| 4295 | app-js-fail | Application JavaScript returns 503; the diagnostic observer remains available. |

Responses use `no-store`. Existing CSP is preserved: when safe injection cannot be established, the proxy omits its observer and records `X-Review-Probe: omitted-existing-csp`. Do not claim observation from an omitted probe. Each injected document records the **upstream HTML hash before injection**, observer hash, run ID and declared/detected build kind. Manifests and request logs default to the OS temporary directory under `deepanker-review-harness/<run-id>`; `--out DIRECTORY` changes that parent.

For direct review, open a profile URL and wait for loading to settle. Exercise the product, then open **QA report**; measurements freeze before that modal appears. `?__review_report=1` opens the frozen report automatically after settling, establishing loading evidence only. It does not prove an interaction. The proxy strips diagnostic flags before forwarding to the app.

## Accessibility and measurement limits

Pinned `axe-core` is a development dependency resolved from this checkout. Its version, license and script hash are recorded in the proxy manifest. It is not a deployable website asset. `?__review_a11y=1` audits after loading; `?__review_a11y=manual` waits for **Alt+Shift+A** or the QA button so an actual product dialog can be audited first. No product node or rule is blanket-excluded. Library failures are reported as errors, not zero violations; incomplete checks remain manual work.

Loading measurements freeze before axe starts. CLS uses session windows, excludes recent-input shifts and reports missing APIs as unsupported. Observed event durations are not INP. Local request interception, diagnostic observers and loopback latency make these controlled lab observations, not production field metrics, bandwidth/CPU throttling or a claim about the 75th percentile of Core Web Vitals. Compare fault runs with the same route and viewport on 4290, and inspect the proxy log to confirm the actual injected failures.

HTTP-only proxy checks (no browser is launched):

```sh
node scripts/review-harness/test-http.mjs --base-port 4290 --out /tmp/public-harness-http.json
node --test scripts/review-harness/mobile/test-policy.mjs
```

[Mobile and private-editor fixtures](mobile/README.md) describe continuous input observation, storage denial and bounded editor failure tests. Those fixtures preserve authentication and refuse document mutations.
