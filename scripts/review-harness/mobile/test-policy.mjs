import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {QA_ID, profiles, upstreamFor, cleanPath, route, saveFailure, requestHeaders} from './policy.mjs';

test('all destinations are fixed loopback fixtures', () => {
  for (const profile of profiles) assert.ok(['http://127.0.0.1:4194', 'http://127.0.0.1:4195'].includes(upstreamFor(profile)));
});
test('public profiles refuse admin/API and every mutation', () => {
  for (const profile of ['touch', 'storage-denied']) {
    for (const path of ['/admin', '/admin/login', '/api/auth/login', `/api/editor/posts/${QA_ID}`, '/.dev.vars', '/@fs/private/tmp/file']) {
      for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'DELETE']) assert.equal(route(profile, method, path), 'refuse');
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) assert.equal(route(profile, method, '/'), 'refuse');
    assert.equal(route(profile, 'GET', '/writing/abstractions-of-illusion'), 'forward');
  }
});
test('editor profiles only inject failures for the synthetic draft or first-create endpoint', () => {
  for (const profile of profiles.filter(p => p.startsWith('save-'))) {
    assert.equal(route(profile, 'PUT', `/api/editor/posts/${QA_ID}`), 'save-fault');
    assert.equal(route(profile, 'POST', '/api/editor/posts'), 'save-fault');
    for (const path of [`/api/editor/posts/${QA_ID}/publish`, `/api/editor/posts/${QA_ID}/unpublish`, `/api/editor/posts/${QA_ID}/discard`, '/api/posts', '/api/editor/posts/original-piece']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(route(profile, method, path), 'refuse');
    }
    assert.equal(route(profile, 'GET', '/admin/posts/original-piece/edit'), 'refuse');
    assert.equal(route(profile, 'GET', `/admin/posts/${QA_ID}/edit`), 'forward');
    assert.equal(route(profile, 'POST', '/api/editor/preview'), 'forward');
    assert.equal(route(profile, 'POST', '/api/editor/import'), 'forward');
  }
});
test('traversal and control paths are refused; real asset paths survive', () => {
  for (const path of ['/../.dev.vars', '/literary/%2e%2e/.dev.vars', '/literary/a%00b', '/literary/%5csecret', '/bad%']) assert.equal(cleanPath(path), null);
  assert.equal(route('touch', 'GET', cleanPath('/literary/%252e%252e/.dev.vars')), 'refuse');
  assert.equal(route('touch', 'GET', cleanPath('/literary/art/material/meditations-320.webp')), 'forward');
});
test('cookies and authorization are never forwarded by public profiles', () => {
  const incoming = {cookie: 'secret=private; admin_token=local.jwt.signature', authorization: 'Bearer sensitive', origin: 'http://127.0.0.1:4306'};
  const headers = requestHeaders('touch', incoming, incoming.origin);
  assert.equal(headers.cookie, undefined); assert.equal(headers.authorization, undefined); assert.equal(headers.origin, undefined);
});
test('editor only forwards the existing local admin cookie and maps a validated local origin', () => {
  const incoming = {cookie: 'secret=private; admin_token=local.jwt.signature', authorization: 'Bearer sensitive', origin: 'http://127.0.0.1:4308', 'content-type': 'application/json'};
  const headers = requestHeaders('save-conflict', incoming, incoming.origin);
  assert.equal(headers.cookie, 'admin_token=local.jwt.signature'); assert.equal(headers.authorization, undefined); assert.equal(headers.origin, 'http://127.0.0.1:4195');
  assert.equal(requestHeaders('save-conflict', incoming, 'http://127.0.0.1:9999').origin, undefined);
});
test('injected responses match actual client recovery branches', () => {
  assert.equal(saveFailure('save-expired').status, 401);
  assert.deepEqual([saveFailure('save-conflict').status, saveFailure('save-conflict').body.code], [409, 'version_conflict']);
  assert.equal(saveFailure('save-unavailable').status, 503);
  assert.deepEqual(saveFailure('save-disconnect'), {disconnect: true});
});
test('storage denial is installed before any DOM-ready or input action, without changing sessionStorage', async () => {
  const source = await readFile(new URL('./probe.js', import.meta.url), 'utf8');
  const listeners = [], storage = {getItem() {return 'existing';}}, session = {getItem() {return 'session';}};
  const context = {atob: value => Buffer.from(value, 'base64').toString(), document: {currentScript: {dataset: {mobileConfig: Buffer.from(JSON.stringify({profile: 'storage-denied'})).toString('base64')}}},
    performance: {now: () => 0}, DOMException, addEventListener: (...args) => listeners.push(args), localStorage: storage, sessionStorage: session};
  context.window = context; vm.runInNewContext(source, context);
  assert.throws(() => context.localStorage, {name: 'SecurityError'});
  assert.equal(context.sessionStorage, session); assert.equal(storage.getItem(), 'existing');
  assert.ok(listeners.some(([name]) => name === 'touchmove')); assert.ok(listeners.some(([name]) => name === 'scroll'));
});


test('an explicit synthetic fixture ID replaces the old one without widening document access', () => {
  const current = '349f7b79-089b-4516-be0c-2a979f0d78c3';
  assert.equal(route('save-unavailable', 'GET', `/admin/posts/${current}/edit`, current), 'forward');
  assert.equal(route('save-unavailable', 'PUT', `/api/editor/posts/${current}`, current), 'save-fault');
  assert.equal(route('save-unavailable', 'GET', `/admin/posts/${QA_ID}/edit`, current), 'refuse');
  assert.equal(route('save-unavailable', 'PUT', `/api/editor/posts/${QA_ID}`, current), 'refuse');
  assert.equal(route('save-unavailable', 'PUT', `/api/editor/posts/${current}/publish`, current), 'refuse');
  for (const invalid of ['', 'original-piece', '../admin', current + '/publish']) {
    assert.equal(route('save-unavailable', 'POST', '/api/auth/login', invalid), 'refuse');
    assert.equal(route('save-unavailable', 'PUT', `/api/editor/posts/${invalid}`, invalid), 'refuse');
  }
});
