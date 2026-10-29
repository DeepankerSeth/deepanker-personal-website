// Run only against the explicitly owned touch4306 and save-unavailable4308 harnesses.
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {isFixtureId} from './policy.mjs';
const request = (port, path, method = 'GET', headers = {}, body) => new Promise((done, fail) => {
  const req = http.request({hostname: '127.0.0.1', port, path, method, headers}, res => {
    const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => done({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks)}));
  }); req.on('error', fail); req.setTimeout(10000, () => req.destroy(new Error('Local QA timeout'))); req.end(body);
});
const sha = value => createHash('sha256').update(value).digest('hex');
const results = [], check = async (name, run) => {await run(); results.push({name, status: 'pass'});};
let publicConfig, editorConfig, qaId;
await check('ports identify expected profiles and fixed local upstreams', async () => {
  publicConfig = JSON.parse((await request(4306, '/__mobile/config')).body);
  editorConfig = JSON.parse((await request(4308, '/__mobile/config')).body);
  assert.equal(publicConfig.profile, 'touch'); assert.equal(publicConfig.upstream, 'http://127.0.0.1:4194');
  assert.equal(editorConfig.profile, 'save-unavailable'); assert.equal(editorConfig.upstream, 'http://127.0.0.1:4195');
  qaId = editorConfig.syntheticDraft; assert.ok(isFixtureId(qaId), 'The profile must identify its disposable fixture draft');
});
await check('public HTML hash matches actual4194 and probe is before every app script', async () => {
  const direct = await request(4194, '/'), proxied = await request(4306, '/');
  assert.equal(direct.status, 200); assert.equal(proxied.status, 200);
  assert.equal(proxied.headers['x-mobile-qa-original-html-sha256'], sha(direct.body));
  assert.equal(proxied.headers['x-mobile-qa-injection'], 'before-app-scripts');
  assert.match(proxied.body.toString().match(/<script[^>]*>/i)[0], /\/__mobile\/probe.js/);
  assert.equal(proxied.headers['set-cookie'], undefined);
});
await check('public admin, API, POST, raw traversal and arbitrary destination refused', async () => {
  for (const [path, method] of [['/admin', 'GET'], ['/api/editor/preview', 'POST'], ['/', 'POST'], ['/literary/%2e%2e/.dev.vars', 'GET'], ['http://example.invalid/', 'GET']]) {
    assert.ok([400, 403].includes((await request(4306, path, method)).status));
  }
  assert.equal((await request(4306, '/', 'GET', {host: 'example.invalid'})).status, 403);
});
await check('editor login forwards but protected editor still requires actual local auth', async () => {
  assert.equal((await request(4308, '/admin/login')).status, 200);
  const protectedResponse = await request(4308, `/admin/posts/${qaId}/edit`);
  assert.ok([302, 303].includes(protectedResponse.status)); assert.equal(protectedResponse.headers.location, '/admin/login');
});
await check('synthetic save returns503 before upstream, with no request body recorded', async () => {
  const marker = 'PRIVATE_SENTINEL_NOT_TO_BE_LOGGED';
  const response = await request(4308, `/api/editor/posts/${qaId}`, 'PUT', {origin: 'http://127.0.0.1:4308', 'content-type': 'application/json'}, JSON.stringify({document: {content: marker}}));
  assert.equal(response.status, 503); assert.equal(JSON.parse(response.body).code, 'editor_unavailable');
  const logs = await readFile(editorConfig.output + '/requests.jsonl', 'utf8');
  assert.equal(logs.includes(marker), false);
  const fault = logs.trim().split('\n').map(JSON.parse).find(row => row.action === 'injected-save-fault');
  assert.equal(fault.forwarded, false);
});
await check('all destructive, other-document and cross-origin editor calls refused', async () => {
  for (const suffix of ['publish', 'unpublish', 'discard']) {
    assert.equal((await request(4308, `/api/editor/posts/${qaId}/${suffix}`, 'POST', {origin: 'http://127.0.0.1:4308'})).status, 403);
  }
  assert.equal((await request(4308, '/api/editor/posts/original-piece', 'PUT', {origin: 'http://127.0.0.1:4308'})).status, 403);
  assert.equal((await request(4308, `/api/editor/posts/${qaId}`, 'PUT', {origin: 'https://example.invalid'})).status, 403);
  assert.equal((await request(4308, `/api/editor/posts/${qaId}`, 'PUT')).status, 403);
});
const report = {checkedAt: new Date().toISOString(), kind: 'local HTTP harness isolation, not browser evidence', profiles: [publicConfig, editorConfig], results,
  limitations: ['No browser was operated. This HTTP test does not establish rendered touch movement, storage recovery or editor recovery.', 'Only touch and save-unavailable profiles ran; other policies were tested in pure unit tests.', 'No document write was forwarded. No actual credentials were supplied; protected-page redirects were checked unauthenticated.']};
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const out = process.argv[outIndex + 1];
  assert.ok(out && !out.startsWith('--'), 'Supply an output file after --out');
  await writeFile(out, JSON.stringify(report, null, 2) + '\n', {mode: 0o600});
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
