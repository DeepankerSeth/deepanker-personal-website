/** Prepared cases only; imported by final-browser.mjs after its authorization guard.
 * Existing observers are read through their own visible report UI. No CSP bypass,
 * observer patch, JS-dispatched input, server startup or production access.
 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export async function runFaultCases({ included, runCase, load, output, normalize, assertOverflow, fixtures }) {
  const sha = value => createHash('sha256').update(value).digest('hex');
  const name = value => value.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const evidence = async (result, label, data) => {
    const bytes = JSON.stringify(data, null, 2), path = join(output, `${name(result.name)}-${label}.json`);
    await writeFile(path, bytes); result.observations.evidence ??= []; result.observations.evidence.push({ label, path, sha256: sha(bytes) });
    return data;
  };
  function injection(result, kind) {
    const document = result.observations.documents.at(-1), status = kind === 'mobile' ? document.mobileInjection : document.probe;
    assert.equal(status, kind === 'mobile' ? 'before-app-scripts' : 'injected', `Existing ${kind} observer was not injected (${status}); evidence is unverified. Never weaken CSP to make this pass.`);
  }
  async function mobileReport(page, result, label) {
    await page.keyboard.press('Alt+Shift+M');
    const pre = page.locator('#mobile-qa-report pre'); await pre.waitFor({ state: 'visible', timeout: 10000 });
    const report = JSON.parse(await pre.textContent()); assert.equal(report.schema, 'mobile-local-review/v1');
    await evidence(result, label, report); return report;
  }
  async function closeMobileReport(page) {
    await page.locator('#mobile-qa-report button').filter({ hasText: 'Close report' }).click();
    await page.locator('#mobile-qa-report').waitFor({ state: 'hidden' });
  }
  async function resourceReport(page, result, label) {
    await page.locator('#review-probe-button').waitFor({ state: 'visible', timeout: 20000 });
    await page.keyboard.press('Alt+Shift+A');
    const pre = page.locator('#review-probe-json'); await pre.waitFor({ state: 'visible', timeout: 30000 });
    const report = JSON.parse(await pre.textContent()); assert.equal(report.schema, 'local-review-probe/v1');
    await evidence(result, label, report);
    assert.equal(report.accessibilityAudit?.status, 'completed', 'Accessibility audit unavailable or failed; not zero violations');
    result.observations.accessibility = { violations: report.accessibilityAudit.violations.length, incomplete: report.accessibilityAudit.incomplete.length, manualReviewRequired: true, state: label };
    return report;
  }
  const assertA11y = report => assert.equal(report.accessibilityAudit.violations.length, 0, 'Rendered accessibility violations require review; full details retained');
  const safeTouchStart = async (page, selector) => page.evaluate(selector => {
    const scroller = selector ? document.querySelector(selector) : document.scrollingElement;
    const box = selector ? scroller.getBoundingClientRect() : { left: 0, right: innerWidth, top: 0, bottom: innerHeight, width: innerWidth };
    const low = Math.min(box.bottom, innerHeight) - 90, high = Math.max(box.top + 110, 140);
    for (const y of [low, low - 55, low - 110]) for (const x of [box.left + box.width * .5, box.left + 12, box.right - 18]) {
      const target = document.elementFromPoint(x, y);
      if (y <= high + 60 || !target || (selector && !scroller.contains(target)) || target.closest('a,button,input,select,summary,#mobile-qa-button,#mobile-qa-report')) continue;
      return { x, y, endY: Math.max(high, y - 285), target: target.tagName + '.' + target.className, scrollTop: selector ? scroller.scrollTop : scrollY, maxScroll: scroller.scrollHeight - scroller.clientHeight, pageY: scrollY, selectedPiece: document.body.dataset.piece, url: location.href };
    }
    return null;
  }, selector);
  const scrollState = (page, selector) => page.evaluate(selector => ({ at: performance.now(), scrollTop: selector ? document.querySelector(selector).scrollTop : scrollY, pageY: scrollY, url: location.href, selectedPiece: document.body.dataset.piece }), selector);

  if (included('touch')) for (const scroller of ['document', 'contents', 'art']) await runCase(`touch-stream-${scroller}`, { viewport: { width: 375, height: 667 }, touch: true, video: true }, async ({ page, result, shot }) => {
    const origin = 'http://127.0.0.1:4306';
    await load(page, `${origin}/writing/meditations`, result); injection(result, 'mobile');
    let selector = null;
    if (scroller === 'contents') { await page.locator('.site-header [data-contents]').tap(); selector = '.contents'; }
    if (scroller === 'art') { await page.locator('.reader-opening-art').tap(); selector = '.art-dialog'; }
    if (selector) await page.locator(selector).waitFor({ state: 'visible' });
    const start = await safeTouchStart(page, selector); assert.ok(start, 'No non-interactive start region; do not silently substitute a click or wheel');
    assert.ok(start.maxScroll - start.scrollTop > 30, 'This state has insufficient overflow to establish scrolling');
    await shot('before'); const cdp = await page.context().newCDPSession(page);
    const samples = [], first = await scrollState(page, selector), wallStart = Date.now();
    const point = y => [{ id: 1, x: start.x, y, radiusX: 2, radiusY: 2, force: 1 }];
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(start.y) });
      for (let step = 1; step <= 20; step++) {
        await page.waitForTimeout(50);
        const y = start.y + (start.endY - start.y) * step / 20;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(y) });
        samples.push({ step, sentX: start.x, sentY: y, ...await scrollState(page, selector) });
      }
    } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    const wallInputDuration = Date.now() - wallStart;
    await page.waitForTimeout(650); const last = await scrollState(page, selector); await shot('after');
    const report = await mobileReport(page, result, 'trusted-touch-observer');
    const events = report.events.filter(event => event.at >= first.at && event.at <= last.at);
    const moves = events.filter(event => event.type === 'touchmove' && event.trusted);
    const positions = new Set(moves.flatMap(event => event.changedTouches ?? []).map(point => `${point.x},${point.y}`));
    const touchStart = events.find(event => event.type === 'touchstart' && event.trusted), touchEnd = events.findLast(event => event.type === 'touchend' && event.trusted);
    const duration = touchStart && touchEnd ? touchEnd.eventTimeStamp - touchStart.eventTimeStamp : null;
    const clicks = events.filter(event => event.type === 'click');
    result.observations.gesture = { source: 'Chromium CDP Input.dispatchTouchEvent;20 changing touchMove samples spaced50ms. Not JS dispatch, physical hardware or a human swipe.', start, samples, first, last, wallInputDuration, trustedMoves: moves.length, distinctPositions: positions.size, inputEventDurationMs: duration, clicks, dropped: report.dropped, scrollEventCount: events.filter(event => event.type === 'scroll').length, manualVideoReviewRequired: true };
    await evidence(result, 'gesture-analysis', result.observations.gesture);
    assert.ok(report.environment.maxTouchPoints > 0 && report.environment.coarse && !report.environment.hover);
    assert.equal(report.dropped, 0, 'Truncated event evidence cannot establish the gesture');
    assert.ok(moves.length >= 10 && positions.size >= 10 && duration >= 750, 'Not a sustained changing-coordinate trusted movement stream');
    assert.ok(last.scrollTop - first.scrollTop >= Math.min(80, (start.maxScroll - start.scrollTop) * .45), 'Intended scroller did not move enough');
    assert.ok(events.some(event => event.type === 'scroll' && event.trusted), 'No observed scrolling');
    assert.equal(clicks.length, 0, 'Gesture caused an unintended click'); assert.equal(last.url, start.url); assert.equal(last.selectedPiece, start.selectedPiece);
    if (selector) assert.ok(Math.abs(last.pageY - first.pageY) <= 1, 'Modal gesture leaked into document scrolling');
    assert.equal(report.errors.length, 0); await cdp.detach();
  });

  if (!included('resilience')) return;
  await runCase('storage-denied-contents-another-piece-return', { viewport: { width: 375, height: 667 }, touch: true, video: true }, async ({ page, result, shot }) => {
    const origin = 'http://127.0.0.1:4307';
    await load(page, `${origin}/writing/meditations`, result); injection(result, 'mobile');
    await page.locator('.site-header [data-contents]').tap(); await page.locator('.contents').waitFor({ state: 'visible' }); await shot('contents');
    const first = await mobileReport(page, result, 'meditations-denial'); assert.ok(first.storage.installed && first.storage.failures > 0); await closeMobileReport(page);
    await page.locator('.contents a.title-link[href="/writing/war"]').tap(); await page.waitForURL(url => url.pathname === '/writing/war');
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    assert.equal(normalize(await page.locator('h1').innerText()), fixtures.find(item => item.slug === 'war').title); await shot('war');
    const second = await mobileReport(page, result, 'war-denial'); assert.ok(second.storage.installed && second.storage.failures > 0); await closeMobileReport(page);
    await page.locator('.next-index').tap(); await page.waitForURL(url => url.pathname === '/'); await page.locator('.writing-index').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.writing-index .title-link').count(), 4); await shot('returned-index');
    const final = await mobileReport(page, result, 'returned-index-denial'); assert.ok(final.storage.installed && final.storage.failures > 0);
    assert.equal(first.errors.length + second.errors.length + final.errors.length, 0);
    result.observations.navigation = 'Contents → The Hidden War → Return to writing index completed under the installed getter-denial fixture; real browser privacy settings unchanged.';
  });

  for (const width of [390, 620, 621]) await runCase(`no-javascript-search-${width}`, { viewport: { width, height: 844 }, javascript: false }, async ({ page, result, shot }) => {
    const origin = 'http://127.0.0.1:4290'; await load(page, `${origin}/writing`, result, { enhanced: false });
    assert.equal(await page.locator('html').evaluate(node => node.classList.contains('js')), false);
    assert.equal(await page.locator('[data-preview]:visible').count(), 0);
    await page.locator('#index-query').pressSequentially('illusion'); await page.locator('#index-search button[type="submit"]').click();
    await page.waitForURL(url => url.pathname === '/writing' && url.searchParams.get('q') === 'illusion');
    const data = await page.locator('#writing-data').evaluate(node => JSON.parse(node.textContent));
    const expected = data.filter(item => normalize([item.title, item.description, ...item.tags, item.text].join(' ')).toLowerCase().includes('illusion'));
    assert.equal(await page.locator('.writing-index li:not([hidden])').count(), expected.length);
    result.observations.overflow = await assertOverflow(page); await shot('server-search');
    await page.locator('.writing-index .title-link[href="/writing/abstractions-of-illusion"]').click(); await page.waitForURL(url => url.pathname === '/writing/abstractions-of-illusion');
    assert.equal(normalize(await page.locator('h1').innerText()), normalize(fixtures.find(item => item.slug === 'abstractions-of-illusion').title));
    await shot('full-title'); result.observations.noJS = 'Browser JavaScript disabled. Native GET search and full essay link exercised; no observer/a11y execution claimed.';
  });

  const profiles = ['control', 'slow-media', 'fonts-fail', 'large-art-fail', 'all-art-fail', 'app-js-fail'];
  for (const width of [390, 1280]) for (const [offset, profile] of profiles.entries()) await runCase(`fault-load-${profile}-${width}`, { viewport: { width, height: 844 }, touch: width === 390, video: profile === 'slow-media' }, async ({ page, result, shot }) => {
    const origin = `http://127.0.0.1:${4290 + offset}`;
    await load(page, `${origin}/?__review_a11y=manual`, result, { enhanced: profile !== 'app-js-fail' }); injection(result, 'resource');
    await page.locator('#review-probe-button').waitFor({ state: 'visible', timeout: 20000 });
    assert.equal(await page.locator('.writing-index .title-link').count(), 4); result.observations.overflow = await assertOverflow(page); await shot('settled-product');
    const report = await resourceReport(page, result, 'home-loading-and-a11y'); assert.equal(report.profile, profile);
    result.observations.loading = { metrics: report.metrics, fontStatus: report.fontStatus, errors: report.runtimeErrors, injectedFaults: report.verifiedInjectedFaults, incomplete: report.accessibilityAudit.incomplete.length, comparison: `fault-load-control-${width}`, reviewRequired: true };
    if (profile === 'slow-media') assert.ok(report.proxyRequests.some(row => row.delayMs >= 2500 && row.fault === 'delayed-resource'));
    if (profile === 'fonts-fail') assert.ok(report.proxyRequests.some(row => /\.(woff2?|ttf|otf)$/.test(row.path) && row.status === 503));
    if (profile === 'all-art-fail') assert.ok(report.proxyRequests.some(row => /material\/.+\.webp$/.test(row.path) && row.status === 503));
    if (profile === 'app-js-fail') { assert.ok(report.proxyRequests.some(row => /\.(m?js|ts)$/.test(row.path) && row.status === 503)); assert.equal(await page.locator('html').evaluate(node => node.classList.contains('js')), false); }
    assertA11y(report);
  });

  // Loading a collapsed phone index does not request960/1536px art. These
  // separate cases deliberately exercise those URLs and audit the product modal.
  for (const width of [390, 1280]) for (const [port, profile] of [[4290, 'control'], [4293, 'large-art-fail'], [4294, 'all-art-fail']]) await runCase(`fault-art-${profile}-${width}`, { viewport: { width, height: 844 }, touch: width === 390, video: true }, async ({ page, result, shot }) => {
    await load(page, `http://127.0.0.1:${port}/?__review_a11y=manual`, result); injection(result, 'resource');
    await page.locator('.writing-index [data-preview="0"]').click(); const panel = page.locator('[data-passage="0"]'); await panel.waitFor({ state: 'visible' });
    await panel.locator('[data-look]').click(); const detail = page.locator('.art-dialog section:not([hidden])'); await detail.waitFor({ state: 'visible' });
    await page.waitForFunction(() => [...document.querySelectorAll('.art-dialog section:not([hidden]) svg.material-print')].every(svg => ['ready', 'failed'].includes(svg.dataset.artState)));
    await page.waitForLoadState('networkidle', { timeout: 10000 }); await shot('art-fallback');
    result.observations.art = await detail.locator('svg.material-print').evaluate(svg => ({ state: svg.dataset.artState, image: svg.querySelector('image').getAttribute('href'), fallbackVisible: getComputedStyle(svg.querySelector('.material-fallback')).display !== 'none' }));
    const report = await resourceReport(page, result, 'art-modal-and-a11y');
    if (profile === 'large-art-fail') {
      for (const size of [960, 1536]) assert.ok(report.proxyRequests.some(row => row.path.endsWith(`-${size}.webp`) && row.status === 503), `${size}px failure was not actually requested`);
      assert.equal(result.observations.art.state, 'ready'); assert.ok(result.observations.art.image.endsWith('-320.webp'));
    } else if (profile === 'all-art-fail') {
      assert.equal(result.observations.art.state, 'failed'); assert.ok(result.observations.art.fallbackVisible);
      assert.equal(await detail.locator('[data-study-detail]').isVisible(), false);
    } else assert.equal(result.observations.art.state, 'ready');
    assertA11y(report);
  });
}
