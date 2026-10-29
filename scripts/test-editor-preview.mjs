import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Execute the real preview controller. These doubles establish message and
// response ordering, not browser layout, typography or assistive technology.
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/editor/editor-preview.ts', import.meta.url))],
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
});
const client = new Script(bundled.outputFiles[0].text, { filename: 'editor-preview.test-bundle.js' });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const response = (status, value) => ({ status, ok: status >= 200 && status < 300, json: async () => value });

function boot() {
  const selectors = ['[data-preview-status]', '[data-preview-title]', '.reading-header', '[data-preview-kind]', '[data-preview-minutes]', '[data-essay-prose]'];
  const controls = new Map(selectors.map(selector => {
    const classes = new Set();
    return [selector, {
      textContent: 'Initial', innerHTML: '<p>Previous writing</p>',
      classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) },
    }];
  }));
  const messages = [];
  const calls = [];
  const events = new Map();
  const documentEvents = new Map();
  const parent = { postMessage: (message, origin) => messages.push({ message, origin }) };
  const origin = 'http://preview.test';
  client.runInNewContext({
    Error, AbortController, parent, location: { origin },
    document: {
      querySelector(selector) { assert.ok(controls.has(selector), selector); return controls.get(selector); },
      addEventListener(type, callback) { documentEvents.set(type, callback); },
    },
    addEventListener(type, callback) { events.set(type, callback); },
    fetch(url, options) {
      const completion = deferred();
      calls.push({ url, options, ...completion });
      return completion.promise;
    },
  });
  const send = (document, override = {}) => events.get('message')({
    origin, source: parent, data: { type: 'editor:preview', document }, ...override,
  });
  return { controls, calls, messages, documentEvents, parent, origin, send };
}

test('preview accepts only its same-origin parent and forwards Save without saving', async () => {
  const frame = boot();
  const document = { title: 'A title', content: 'Exact source\r\n' };
  await frame.send(document, { origin: 'https://elsewhere.test' });
  await frame.send(document, { source: {} });
  await frame.send(document, { data: { type: 'unrelated', document } });
  await frame.send({ title: 'Missing content' });
  assert.equal(frame.calls.length, 0);
  assert.equal(frame.messages.length, 1, 'Only the initial ready message is sent.');
  let prevented = false;
  frame.documentEvents.get('keydown')({ ctrlKey: true, key: 's', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(frame.messages.at(-1).message.type, 'editor:save');
  assert.equal(frame.messages.at(-1).origin, frame.origin);
  assert.equal(frame.calls.length, 0, 'The preview has no writing or publication request.');
});

test('dynamic preview applies the public long-title and poetry rules in both directions', async () => {
  const frame = boot();
  for (const [length, breaks, long, kind] of [[40, 7, false, 'Essay'], [41, 8, true, 'Poem'], [12, 0, false, 'Essay']]) {
    const document = { title: 'T'.repeat(length), content: '\uFEFFUntouched\r\nsource' };
    const html = `<p>${'Line<br>'.repeat(breaks)}Last line</p>`;
    const pending = frame.send(document);
    const call = frame.calls.at(-1);
    assert.equal(call.url, '/api/editor/preview');
    assert.equal(call.options.method, 'POST');
    assert.deepEqual(JSON.parse(call.options.body), { document });
    call.resolve(response(200, { renderedHtml: html, readingMinutes: 3 }));
    await pending;
    for (const selector of ['[data-preview-title]', '.reading-header']) {
      assert.equal(frame.controls.get(selector).classList.contains('long-title'), long);
    }
    assert.equal(frame.controls.get('[data-preview-kind]').textContent, kind);
    assert.equal(frame.controls.get('[data-preview-title]').textContent, document.title);
    assert.equal(frame.controls.get('[data-preview-minutes]').textContent, '3 min read');
    assert.equal(frame.controls.get('[data-essay-prose]').innerHTML, html);
  }
});

test('late success, expired-session and failed responses cannot replace a newer preview', async t => {
  for (const [status, result] of [
    [200, { renderedHtml: '<p>Obsolete success</p>', readingMinutes: 8 }],
    [401, { error: 'Expired old session' }],
    [500, { error: 'Obsolete error' }],
  ]) {
    await t.test(`late ${status} body is ignored after newer success`, async () => {
      const frame = boot();
      const old = frame.send({ title: 'Old', content: 'Old writing' });
      const body = deferred();
      const decoding = deferred();
      frame.calls[0].resolve({ status, ok: status === 200, json() { decoding.resolve(); return body.promise; } });
      await decoding.promise;
      const latest = frame.send({ title: 'Latest', content: 'Latest writing' });
      assert.equal(frame.calls[0].options.signal.aborted, true);
      frame.calls[1].resolve(response(200, { renderedHtml: '<p>Latest writing</p>', readingMinutes: 1 }));
      await latest;
      const readyCount = frame.messages.length;
      body.resolve(result);
      await old;
      assert.equal(frame.controls.get('[data-preview-title]').textContent, 'Latest');
      assert.equal(frame.controls.get('[data-essay-prose]').innerHTML, '<p>Latest writing</p>');
      assert.equal(frame.controls.get('[data-preview-status]').textContent, 'Private preview · nothing here is saved or published');
      assert.equal(frame.messages.length, readyCount, 'Obsolete responses must not send parent errors or ready events.');
    });
  }
});

test('a stale rejected fetch is silent while a current expiry is actionable and keeps prose', async () => {
  const frame = boot();
  const old = frame.send({ content: 'Old writing' });
  const latest = frame.send({ content: 'Current writing' });
  frame.calls[1].resolve(response(401, { error: 'Expired' }));
  await latest;
  const count = frame.messages.length;
  frame.calls[0].reject(new Error('Late disconnected request'));
  await old;
  assert.equal(frame.messages.length, count);
  assert.equal(frame.messages.at(-1).message.type, 'editor:preview:error');
  assert.equal(frame.messages.at(-1).message.status, 401);
  assert.equal(frame.controls.get('[data-preview-status]').textContent, 'Your session expired. Sign in again to preview.');
  assert.equal(frame.controls.get('[data-essay-prose]').innerHTML, '<p>Previous writing</p>');
});
