#!/usr/bin/env node
/**
 * Local regression harness. The flag acknowledges an authorized local review;
 * existing user authorization remains valid. It never authorizes publication.
 *
 * Example (no build/server/profile changes):
 * node scripts/review-harness/final-browser.mjs --authorized-local-browser-review --group=focus
 * Groups: journeys, dialogs, focus, widths, motion, touch, resilience, all.
 * touch requires the 4306 observer; resilience requires 4307 and 4290–95.
 * This runner never starts a server. Each case is isolated;
 * failed assertions remain failures and do not prevent independent cases.
 * Output defaults to a fresh private OS temporary directory. Touch input is
 * controlled emulation, not physical-device or human input evidence.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { sourceFingerprints as fingerprints } from './source-fingerprint.mjs';

const args = process.argv.slice(2);
if (!args.includes('--authorized-local-browser-review')) {
  console.error('Not run. Add --authorized-local-browser-review to acknowledge the authorized local-only review.');
  process.exit(2);
}
const option = (name, fallback) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const group = option('group', 'all');
const browserKind = option('browser', 'chromium');
assert.ok(['chromium', 'chrome', 'webkit'].includes(browserKind), 'Unknown installed browser');
assert.ok(['all', 'journeys', 'dialogs', 'focus', 'widths', 'motion', 'touch', 'resilience'].includes(group), 'Unknown group');
assert.ok(browserKind !== 'webkit' || !['all', 'touch'].includes(group), 'The CDP touch group requires Chromium; select a non-touch group for WebKit.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const candidate = 'http://127.0.0.1:4194';
const baseline = option('baseline', 'http://127.0.0.1:4217');
assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(baseline), 'Comparison must be an explicit loopback origin');
const allowedOrigins = new Set([candidate, baseline, ...[4290, 4291, 4292, 4293, 4294, 4295, 4306, 4307].map(port => `http://127.0.0.1:${port}`)]);
const output = option('out', '') ? resolve(option('out', '')) : await mkdtemp(join(tmpdir(), 'deepanker-final-browser-'));
assert.ok(output.startsWith('/tmp/') || output.startsWith('/private/tmp/') || output.startsWith(tmpdir()), 'Evidence must be in a private temporary directory');
await mkdir(output, { recursive: true, mode: 0o700 });
await chmod(output, 0o700);
const sha = value => createHash('sha256').update(value).digest('hex');
const normalize = value => String(value).replace(/\s+/g, ' ').trim();
const slugFile = [['meditations', 'meditations'], ['war', 'war'], ['abstractions-of-illusion', 'abstractions'], ['i-am', 'i-am']];
const fixtures = await Promise.all(slugFile.map(async ([slug, file]) => {
  const bytes = await readFile(join(root, 'tests/fixtures/public-captures', `${file}.json`));
  return { slug, ...JSON.parse(bytes), captureSHA256: sha(bytes) };
}));
const report = {
  startedAt: new Date().toISOString(), group, candidate, baseline, output,
  scope: 'Automated browser in fresh temporary contexts against fixed local origins; engine/version recorded below. Existing fault observers preserve CSP. No personal profile or production requests.',
  manualPostRunReviewRequired: 'Inspect screenshots/videos and diagnostic incompletes. Passing assertions do not establish visual quality, comfortable motion, physical-device compatibility or universal accessibility.',
  performanceLimit: 'Fresh contexts, request interception and local observer overhead make these diagnostic lab samples, not field performance or a production benchmark.',
  notPerformed: ['Physical-device testing or human touch/swipes; the optional touch group is controlled CDP input only', 'Native browser zoom', 'Screen-reader testing', 'Production validation', 'Publishing', 'A twenty-minute human reading session', ...(!['all', 'touch'].includes(group) ? ['CDP touch group not selected'] : [])],
  sourceBefore: await fingerprints(), fixtures: fixtures.map(({ slug, captureSHA256 }) => ({ slug, captureSHA256 })), cases: [],
};
let browser;
const writeReport = () => writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
const safeName = value => value.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
const included = name => group === 'all' || group === name;
const viewport = (width, height) => ({ width, height });

async function runCase(name, options, work) {
  const result = { name, startedAt: new Date().toISOString(), status: 'running', observations: {}, screenshots: [], diagnostics: { console: [], pageErrors: [], requestFailures: [], httpErrors: [], blockedRequests: [] } };
  report.cases.push(result);
  let context, page;
  try {
    context = await browser.newContext({
      viewport: options.viewport ?? viewport(375, 667), deviceScaleFactor: 1,
      hasTouch: options.touch ?? false, isMobile: options.touch ?? false,
      javaScriptEnabled: options.javascript !== false,
      reducedMotion: options.reduced ?? 'no-preference', serviceWorkers: 'block',
      ...(options.video ? { recordVideo: { dir: join(output, 'video') } } : {}),
    });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if ((url.protocol === 'data:' || url.protocol === 'blob:') || (allowedOrigins.has(url.origin) && ['GET', 'HEAD'].includes(request.method()))) return route.continue();
      result.diagnostics.blockedRequests.push({ url: request.url(), method: request.method() });
      return route.abort('blockedbyclient');
    });
    if (options.javascript !== false) await context.addInitScript(() => {
      window.__localBrowserReview = { shifts: [] };
      try { new PerformanceObserver(list => {
        for (const item of list.getEntries()) window.__localBrowserReview.shifts.push({ value: item.value, recentInput: item.hadRecentInput, startTime: item.startTime });
      }).observe({ type: 'layout-shift', buffered: true }); } catch {}
    });
    page = await context.newPage();
    page.setDefaultTimeout(7000); page.setDefaultNavigationTimeout(15000);
    page.on('console', message => result.diagnostics.console.push({ type: message.type(), text: message.text() }));
    page.on('pageerror', error => result.diagnostics.pageErrors.push(String(error)));
    page.on('requestfailed', request => result.diagnostics.requestFailures.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('response', response => { if (response.status() >= 400) result.diagnostics.httpErrors.push({ url: response.url(), status: response.status() }); });
    const shot = async (label, fullPage = false) => {
      const path = join(output, `${safeName(name)}-${safeName(label)}.png`);
      await page.screenshot({ path, fullPage, timeout: 10000 }); result.screenshots.push(path); return path;
    };
    await work({ page, result, shot });
    assert.equal(result.diagnostics.pageErrors.length, 0, 'Uncaught page errors occurred; see diagnostics');
    assert.equal(result.diagnostics.blockedRequests.length, 0, 'Unexpected non-local or mutating request was blocked');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) {
      try { const path = join(output, `${safeName(name)}-failure.png`); await page.screenshot({ path, timeout: 5000 }); result.screenshots.push(path); } catch (captureError) { result.captureError = String(captureError); }
    }
  } finally {
    if (page && !page.isClosed()) {
      try { result.final = await page.evaluate(() => ({ url: location.href, width: innerWidth, height: innerHeight, scrollY, active: document.activeElement?.outerHTML?.slice(0, 600), layoutShifts: window.__localBrowserReview?.shifts, navigation: performance.getEntriesByType('navigation').map(entry => ({ duration: entry.duration, domContentLoaded: entry.domContentLoadedEventEnd, load: entry.loadEventEnd, transferSize: entry.transferSize })), resources: performance.getEntriesByType('resource').map(entry => ({ name: entry.name, duration: entry.duration, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })) })); } catch (error) { result.finalCaptureError = String(error); }
    }
    if (context) { await context.close(); if (page?.video()) result.video = await page.video().path(); }
    result.diagnosticReviewRequired = result.diagnostics.console.some(item => item.type === 'error') || !!result.diagnostics.requestFailures.length || !!result.diagnostics.httpErrors.length;
    result.finishedAt = new Date().toISOString(); await writeReport();
    console.log(JSON.stringify({ case: name, status: result.status, error: result.error?.message, output }));
  }
}

async function load(page, url, result, { enhanced = true } = {}) {
  assert.ok(allowedOrigins.has(new URL(url).origin), 'Only approved local origins');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `Load ${url}`);
  result.observations.documents ??= [];
  const headers = await response.allHeaders();
  result.observations.documents.push({ url, sha256: sha(await response.body()), probe: headers['x-review-probe'], mobileInjection: headers['x-mobile-qa-injection'], upstreamHTMLSHA256: headers['x-review-original-html-sha256'] || headers['x-mobile-qa-original-html-sha256'] });
  if (enhanced) await page.waitForFunction(() => document.documentElement.classList.contains('js'));
  const fontsDeadline = Date.now() + 15000;
  while (await page.evaluate(() => document.fonts.status) !== 'loaded') {
    assert.ok(Date.now() < fontsDeadline, 'Fonts did not settle within15000ms');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
async function corpus(page) {
  const data = await page.locator('#writing-data').evaluate(node => JSON.parse(node.textContent));
  assert.deepEqual(data.map(item => item.slug).sort(), fixtures.map(item => item.slug).sort());
  return data;
}
async function openPiece(page, index) {
  const control = page.locator(`.writing-index [data-preview="${index}"]`);
  if (page.viewportSize().width > 620 || await control.getAttribute('aria-expanded') !== 'true') await control.click();
  const panel = page.locator(`[data-passage="${index}"]`);
  await panel.waitFor({ state: 'visible' });
  if (await panel.locator('svg.material-print').count()) await panel.locator('svg.material-print[data-art-state="ready"]').waitFor({ state: 'visible' });
  // The authored entrance/atmosphere lasts at most500ms. This wait is for a
  // settled screenshot, not evidence of the animation's quality.
  await page.waitForTimeout(550);
  return panel;
}
async function assertOverflow(page) {
  const geometry = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
  assert.ok(geometry.documentWidth <= geometry.width + 1 && geometry.bodyWidth <= geometry.width + 1, JSON.stringify(geometry));
  return geometry;
}
async function focusState(locator) {
  return locator.evaluate(node => { const box = node.getBoundingClientRect(), style = getComputedStyle(node); return { focused: document.activeElement === node, visible: box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth, box: { x: box.x, y: box.y, width: box.width, height: box.height }, focusVisible: node.matches(':focus-visible'), outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth }; });
}
async function keyboardTo(page, target) {
  for (let attempt = 0; attempt < 16; attempt++) {
    if ((await focusState(target)).focused) return;
    await page.keyboard.press('Tab');
  }
  assert.fail('Keyboard Tab sequence did not reach target within16 stops');
}

try {
  const { chromium, webkit } = await import('playwright');
  browser = await (browserKind === 'webkit' ? webkit : chromium).launch({ headless: true, ...(browserKind === 'chrome' ? { channel: 'chrome' } : {}) });
  report.browserKind = browserKind;
  report.browserVersion = browser.version();

  if (included('journeys')) for (const fixture of fixtures) {
    await runCase(`body-${fixture.slug}-375`, { touch: true }, async ({ page, result, shot }) => {
      await load(page, `${candidate}/writing/${fixture.slug}`, result);
      assert.equal(normalize(await page.locator('h1').innerText()), normalize(fixture.title));
      const body = await page.locator('[data-essay-prose]').evaluate((node, expectedHTML) => {
        const actual = node.cloneNode(true), expected = new DOMParser().parseFromString(expectedHTML, 'text/html').body;
        actual.querySelectorAll('.verse-line').forEach(line => line.replaceWith(...line.childNodes));
        for (const child of [...actual.childNodes]) if (child.nodeType === Node.COMMENT_NODE && /^original-body:(start|end)$/.test(child.nodeValue.trim())) child.remove();
        return { actualHTML: actual.innerHTML.trim(), expectedHTML: expected.innerHTML.trim(), breaks: node.querySelectorAll('br').length, ending: node.textContent.trim().slice(-220) };
      }, fixture.html);
      assert.equal(body.actualHTML, body.expectedHTML, 'Browser DOM must preserve the complete original body after removing only authored verse wrappers');
      if (fixture.slug === 'i-am') assert.equal(body.breaks, 68);
      result.observations.body = { exact: true, sha256: sha(body.actualHTML), breaks: body.breaks, ending: body.ending };
      result.observations.overflow = await assertOverflow(page); await shot('opening');
      await page.locator('.essay-next').scrollIntoViewIfNeeded(); await shot('ending');
      const next = page.locator('.essay-next .next-piece'), nextURL = new URL(await next.getAttribute('href'), candidate).href;
      await next.click(); await page.waitForURL(nextURL); await page.waitForFunction(() => document.fonts.status === 'loaded');
      assert.notEqual(new URL(page.url()).pathname, `/writing/${fixture.slug}`);
      await page.locator('.next-index').click(); await page.waitForURL(url => url.pathname === '/');
      await page.locator('.writing-index').waitFor({ state: 'visible' });
      result.observations.discoveryAndReturn = true;
    });
    for (let passage = 0; passage < 2; passage++) await runCase(`context-${fixture.slug}-${passage}-375`, { touch: true }, async ({ page, result, shot }) => {
      await load(page, candidate, result); const items = await corpus(page), index = items.findIndex(item => item.slug === fixture.slug), item = items[index];
      assert.equal(item.quotes.length, 2); const panel = await openPiece(page, index);
      if (Number(await panel.getAttribute('data-reading')) !== passage) await panel.locator('[data-another]').click();
      assert.equal(normalize(await panel.locator('[data-quote]').textContent()), normalize(item.quotes[passage]));
      assert.equal(await panel.getAttribute('data-reading'), String(passage));
      const contextURL = new URL(await panel.locator('[data-context]').getAttribute('href'), candidate);
      assert.equal(contextURL.searchParams.get('passage'), item.passageIds[passage]);
      await shot('encounter'); await panel.locator('[data-context]').click();
      await page.waitForURL(url => url.pathname === item.route);
      await page.waitForFunction(quote => { const active = document.activeElement; return active?.parentElement?.matches('[data-essay-prose]') && active.textContent.replace(/\s+/g, ' ').includes(quote); }, normalize(item.quotes[passage]));
      const destination = await page.evaluate(() => ({ text: document.activeElement.textContent, query: location.search, highlight: window.CSS?.highlights?.has('living-passage') ?? null }));
      assert.ok(!new URLSearchParams(destination.query).has('passage')); result.observations.destination = destination; await shot('exact-context');
    });
  }

  if (included('dialogs')) await runCase('art-scroll-reopen-same-and-different', { touch: true, video: true }, async ({ page, result, shot }) => {
    await load(page, candidate, result); const items = await corpus(page); result.observations.cycles = [];
    for (const slug of ['war', 'war', 'abstractions-of-illusion', 'meditations', 'i-am']) {
      const index = items.findIndex(item => item.slug === slug), panel = await openPiece(page, index), trigger = panel.locator('[data-look]');
      await trigger.focus(); await page.keyboard.press('Enter'); const dialog = page.locator('.art-dialog'); await dialog.waitFor({ state: 'visible' });
      const start = await dialog.evaluate(node => ({ scrollTop: node.scrollTop, closeFocused: document.activeElement?.matches('[data-close-art]'), svgTop: node.querySelector('section:not([hidden]) svg').getBoundingClientRect().top, barBottom: node.querySelector('.dialog-bar').getBoundingClientRect().bottom }));
      assert.equal(start.scrollTop, 0); assert.ok(start.closeFocused); assert.ok(start.svgTop >= start.barBottom - 2, 'New artwork is clipped beneath dialog header');
      const study = dialog.locator('section:not([hidden]) [data-study-detail]'); await study.click(); assert.equal(await study.getAttribute('aria-pressed'), 'true');
      await dialog.hover(); await page.mouse.wheel(0, 650); await page.waitForFunction(() => document.querySelector('.art-dialog').scrollTop > 80);
      const scrolled = await dialog.evaluate(node => node.scrollTop); await shot(`${slug}-${result.observations.cycles.length}-scrolled`);
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      const returned = await focusState(trigger); assert.ok(returned.focused && returned.visible, 'Closing should return visible focus');
      assert.equal(await study.getAttribute('aria-pressed'), 'false');
      result.observations.cycles.push({ slug, start, scrolled, returned, input: 'Keyboard opening/Escape; mouse click and wheel. Not touch/swipe evidence.' });
    }
  });

  if (included('focus')) {
    for (const [from, to] of [[620, 621], [621, 620]]) for (const selector of ['[data-another]', '[data-look]']) await runCase(`focus-${from}-${to}-${selector}`, { viewport: viewport(from, 800), video: true }, async ({ page, result, shot }) => {
      await load(page, candidate, result); const items = await corpus(page), index = items.findIndex(item => item.slug === 'abstractions-of-illusion');
      const panel = await openPiece(page, index), target = panel.locator(selector);
      if (from <= 620) { await page.locator(`[data-preview="${index}"]`).focus(); await keyboardTo(page, target); }
      else { await target.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); }
      result.observations.before = await focusState(target); assert.ok(result.observations.before.focused);
      assert.ok(result.observations.before.focusVisible && result.observations.before.outlineStyle !== 'none' && parseFloat(result.observations.before.outlineWidth) > 0, 'Keyboard focus lacks a visible outline'); await shot('before');
      await page.setViewportSize(viewport(to, 800)); await page.waitForTimeout(450);
      result.observations.after = await focusState(target); result.observations.visiblePanels = await page.locator('[data-passage]:visible').count(); await shot('after');
      assert.ok(result.observations.after.focused, 'Focused node was lost during breakpoint reparenting');
      assert.equal(result.observations.visiblePanels, 1); await page.keyboard.press('Tab'); result.observations.afterTab = await page.locator(':focus').evaluate(node => node.outerHTML.slice(0, 600));
    });
    for (const [from, to] of [[768, 375], [375, 768]]) await runCase(`dialog-rotation-${from}-${to}`, { viewport: viewport(from, from === 375 ? 667 : 1024), video: true }, async ({ page, result, shot }) => {
      await load(page, candidate, result); const items = await corpus(page), index = items.findIndex(item => item.slug === 'abstractions-of-illusion');
      const panel = await openPiece(page, index), trigger = panel.locator('[data-look]'); await trigger.focus(); await page.keyboard.press('Enter'); await page.locator('.art-dialog').waitFor({ state: 'visible' });
      await page.setViewportSize(viewport(to, to === 375 ? 667 : 1024)); await page.waitForTimeout(450); await page.keyboard.press('Escape'); await page.locator('.art-dialog').waitFor({ state: 'hidden' });
      result.observations.returned = await focusState(trigger); await shot('return');
      assert.ok(result.observations.returned.focused, 'Modal lost return focus'); assert.ok(result.observations.returned.visible, 'Modal returned focus outside the resized viewport');
    });
  }

  if (included('widths')) {
    const sizes = [[320, 667], [375, 667], [390, 844], [430, 900], [540, 900], [620, 900], [621, 900], [697, 900], [768, 1024], [834, 1112], [900, 900], [1100, 900], [1101, 900], [1280, 900], [1440, 900], [667, 375], [844, 390]];
    for (const [width, height] of sizes) for (const [label, origin] of [['candidate', candidate], ['baseline', baseline]]) await runCase(`${label}-${width}x${height}`, { viewport: viewport(width, height), touch: width <= 620 }, async ({ page, result, shot }) => {
      await load(page, origin, result); const items = await corpus(page);
      result.observations.arrivalOverflow = await assertOverflow(page); await shot('arrival');
      for (const item of items) {
        const title = page.locator(`.writing-index [data-essay-id="${item.id}"] .entry-title`);
        assert.equal(normalize(await title.textContent()), normalize(item.title));
        const titleGeometry = await title.evaluate(node => {
          // Tight authored leading lets glyph bounds exceed the line box. That
          // is not clipping when overflow is visible; inspect real clip edges.
          const range = document.createRange(); range.selectNodeContents(node);
          const lines = [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
          const clips = [];
          for (let ancestor = node; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor), rect = ancestor.getBoundingClientRect();
            const x = ['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX);
            const y = ['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY);
            if (x || y) clips.push({ tag: ancestor.tagName, class: ancestor.className, x, y, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
          }
          return { lines, clips, viewportWidth: innerWidth };
        });
        result.observations.titleGeometry ??= []; result.observations.titleGeometry.push({ title: item.title, ...titleGeometry });
        assert.ok(titleGeometry.lines.length > 0, 'Title has no rendered text');
        for (const line of titleGeometry.lines) {
          assert.ok(line.left >= -1 && line.right <= titleGeometry.viewportWidth + 1, 'Title extends beyond the horizontal viewport');
          for (const clip of titleGeometry.clips) assert.ok((!clip.x || (line.left >= clip.left - 1 && line.right <= clip.right + 1)) && (!clip.y || (line.top >= clip.top - 1 && line.bottom <= clip.bottom + 1)), 'Title crosses an actual clipping ancestor');
        }
      }
      const index = items.findIndex(item => item.slug === 'abstractions-of-illusion'), panel = await openPiece(page, index);
      await panel.locator('[data-another]').click(); result.observations.encounterOverflow = await assertOverflow(page); await shot('long-title-encounter');
      if (width > 620) {
        result.observations.plane = await page.evaluate(() => { const row = document.querySelector('.writing-index li.chosen').getBoundingClientRect(), plane = document.querySelector('.selection-plane').getBoundingClientRect(); return { rowTop: row.top, planeTop: plane.top, rowHeight: row.height, planeHeight: plane.height }; });
        const p = result.observations.plane; assert.ok(Math.abs(p.rowTop - p.planeTop) <= 2 && Math.abs(p.rowHeight - p.planeHeight) <= 2, 'Settled selection plane does not match chosen row');
      }
    });
  }

  if (included('motion')) for (const width of [375, 768, 1280]) await runCase(`reduced-motion-${width}`, { viewport: viewport(width, 800), reduced: 'reduce', video: true }, async ({ page, result, shot }) => {
    await load(page, candidate, result); assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion:reduce)').matches));
    const items = await corpus(page), panel = await openPiece(page, items.findIndex(item => item.slug === 'war'));
    await panel.locator('[data-another]').focus();
    if (await panel.getAttribute('data-reading') !== '1') await page.keyboard.press('Enter');
    const svg = panel.locator('svg.material-print');
    await page.waitForFunction(() => { const svg = document.querySelector('[data-passage]:not([hidden]) svg.material-print'); return Number(svg.querySelector('[data-material-light]').getAttribute('cx')) === Number(svg.getAttribute('data-light-1').split(' ')[0]); });
    result.observations.motion = await panel.evaluate(node => ({ reading: node.dataset.reading, quoteAnimation: getComputedStyle(node.querySelector('blockquote')).animationName, bodyTransition: getComputedStyle(document.body).transitionDuration, focusVisible: document.activeElement.matches(':focus-visible') }));
    assert.equal(result.observations.motion.quoteAnimation, 'none'); assert.equal(result.observations.motion.bodyTransition, '0s'); assert.equal(result.observations.motion.reading, '1');
    const before = await svg.locator('[data-material-light]').getAttribute('cx'); await page.waitForTimeout(250); assert.equal(await svg.locator('[data-material-light]').getAttribute('cx'), before);
    await shot('settled-alternate'); await panel.locator('[data-look]').focus(); await page.keyboard.press('Enter');
    const study = page.locator('.art-dialog section:not([hidden]) [data-study-detail]'); await study.focus(); await page.keyboard.press('Enter');
    assert.equal(await study.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.art-dialog section:not([hidden]) svg').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    await shot('detail');
  });
  if (included('touch') || included('resilience')) {
    const { runFaultCases } = await import('./final-fault-cases.mjs');
    await runFaultCases({ included, runCase, load, output, normalize, assertOverflow, fixtures });
  }
} catch (error) {
  report.runnerError = { message: error.message, stack: error.stack };
} finally {
  if (browser) await browser.close();
  report.sourceAfter = await fingerprints();
  report.sourceUnchanged = JSON.stringify(report.sourceBefore) === JSON.stringify(report.sourceAfter);
  report.finishedAt = new Date().toISOString();
  report.summary = { passed: report.cases.filter(item => item.status === 'passed').length, failed: report.cases.filter(item => item.status === 'failed').length, diagnosticReviewRequired: report.cases.filter(item => item.diagnosticReviewRequired).length, runnerError: !!report.runnerError };
  await writeReport(); console.log(JSON.stringify({ ...report.summary, output, sourceUnchanged: report.sourceUnchanged }));
  process.exitCode = report.summary.failed || report.runnerError || !report.sourceUnchanged ? 1 : 0;
}
