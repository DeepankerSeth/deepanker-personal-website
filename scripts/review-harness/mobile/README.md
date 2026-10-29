# Touch, storage and private-editor fixtures

These local test origins are excluded from the website and deployment. Public profiles have a fixed upstream of **127.0.0.1:4194**; editor profiles use the separate disposable fixture on **127.0.0.1:4195**. There is no configurable remote upstream. Start the isolated applications using the project README, then choose only the profiles needed:

For editor profiles, obtain the ID from the separate 4195 fixture's `private-qa-fixture.json` (adjust this example to that fixture's state directory):

```sh
REVIEW_DRAFT_ID=$(node -p "JSON.parse(require('node:fs').readFileSync('/tmp/editor-review-state/private-qa-fixture.json','utf8')).id")
node scripts/review-harness/mobile/server.mjs --profile touch --port 4306
node scripts/review-harness/mobile/server.mjs --profile storage-denied --port 4307
node scripts/review-harness/mobile/server.mjs --draft-id "$REVIEW_DRAFT_ID" --profile save-unavailable --port 4308
node scripts/review-harness/mobile/server.mjs --draft-id "$REVIEW_DRAFT_ID" --profile save-expired --port 4309
node scripts/review-harness/mobile/server.mjs --draft-id "$REVIEW_DRAFT_ID" --profile save-conflict --port 4310
node scripts/review-harness/mobile/server.mjs --draft-id "$REVIEW_DRAFT_ID" --profile save-disconnect --port 4311
```

Check port ownership first. Stop only your foreground processes with Ctrl-C. The proxy binds loopback and rejects a different Host, arbitrary absolute upstream URL or cross-origin request. Publishing, unpublishing, discard, deletion and document writes are never forwarded. The only forwarded POSTs are disposable local login, Markdown parsing and unsaved preview. Protected routes require the real local session. No credentials are embedded, read from disk, printed or logged.

Request logs omit bodies, query strings, cookies and authentication headers. Manifests and logs default to new private directories beneath `deepanker-mobile-harness` in the operating system's temporary directory; use `--out DIRECTORY` to choose a parent. Each response records the upstream HTML hash before injection. Pair this with the actual release source/build identity, not an earlier run's claim. Existing CSP remains intact; `X-Mobile-QA-Injection: omitted-existing-csp` means that response cannot establish storage denial or input observation.

## Continuous touch movement

Use 4306 with real browser touch emulation or available physical hardware. A narrow mouse viewport is not touch. Make a continuous swipe away from navigation links and observe the intended scrolling. Record separate document, Contents and artwork-dialog journeys, including start/end states and absence of accidental navigation.

Open **QA: touch**, or press **Alt+Shift+M** when a product dialog makes the button inert. Measurements freeze before the QA modal appears. Download the JSON and preserve the rendered movement evidence before navigating or reloading. Verify trusted `touchmove` events with changing coordinates, subsequent movement of the intended scroller, pointer cancellation/focus ordering and no unintended click. A trusted scroll event alone is insufficient: programmatic or focus scrolling can also be trusted. A truncated event buffer cannot establish a complete gesture; dropped records are counted.

The passive observer never dispatches input, drives scrolling, changes artwork selection or alters media preferences. Fields named `after` and `defaultPreventedAfterDispatch` are sampled in a queued microtask after the window capture listener, which can precede later application listeners. They do not establish the final state after every handler. Use subsequent input/scroll/focus events and observed movement to establish the outcome.

The [public browser runner](../README.md) has a `touch` group that sends a continuous trusted CDP stream to these three scrollers. This is controlled Chromium emulation, not physical or human input. Diagnostic overhead cannot establish animation performance.

## Denied storage

On 4307, the fixture replaces the `window.localStorage` getter with a `SecurityError` before application scripts run. The report must show `storage.installed: true` and nonzero `storage.failures` to establish the fault occurred. Actual stored data and sessionStorage remain unchanged.

Exercise reading size/tone, saving a place and navigation. Inspect the visible fallback messages, then reload and check the expected lack of persistence. Compare with 4194 or 4306, which have no injected storage denial. This tests a real application failure branch under a controlled fault; it does not change browser privacy permissions or prove every browser storage policy.

## Private-editor recovery

Use only `/admin/posts/{fixture-id}/edit`, where `{fixture-id}` is the UUID from the disposable state's `private-qa-fixture.json`. Editor profiles require that exact ID via `--draft-id`; the manifest records it. Setup generates a new ID each time, so never reuse a historical one. All other document IDs remain refused.

Sign in through the ordinary login form using the disposable 4195 fixture credentials. Use an isolated browser context: localhost cookies are shared across ports. Only `admin_token` is forwarded; unrelated cookies and Authorization headers are removed.

| Port | Save outcome | What this does not establish |
| --- | --- | --- |
| 4308 | 503, `editor_unavailable` | Actual upstream outage. |
| 4309 | 401, expired-session recovery | Real expiration of the local session. |
| 4310 | 409, compare/download conflict recovery | A real database race. |
| 4311 | Connection closed before forwarding | Physical network disconnection. |

All four profiles intercept saves before they reach 4195. Other documents' edit/export/API routes and every publish/unpublish/discard/delete request are refused. Import and unsaved preview use the real parser/renderer; their non-mutation and byte-exact downloads still require separate evidence.

Make a recognizable unsaved synthetic edit, attempt save, inspect retained text and the actual recovery controls, then download the Markdown and compare its bytes. A successful retry requires the separate 4195 fixture directly; a permanent-fault profile cannot prove successful saving. Never substitute an author document for the synthetic fixture.

## Reproduce the fixture checks

```sh
node --test scripts/review-harness/mobile/test-policy.mjs
# Requires touch 4306, save-unavailable 4308 and their fixed upstreams already running.
node scripts/review-harness/mobile/test-http.mjs --out /tmp/mobile-harness-http.json
```

The policy suite checks forwarding boundaries, credential filtering, failure contracts and pre-application storage injection. The HTTP suite checks actual upstream identity, injection ordering, unauthenticated editor protection, refused mutations/cross-origin requests and save interception without logging the submitted body. It never launches a browser and does not establish touch movement or rendered recovery. Reports describe the current run; completed old checks are not evidence for a changed build.
