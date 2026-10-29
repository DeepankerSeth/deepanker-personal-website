#!/usr/bin/env node
// A deliberately isolated test origin, never imported or deployed by Astro.
import http from 'node:http';
import {readFile, mkdir, appendFile, writeFile} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {gunzipSync, brotliDecompressSync, inflateSync} from 'node:zlib';
import {profiles, editorProfile, upstreamFor, cleanPath, route, saveFailure, requestHeaders, isFixtureId} from './policy.mjs';

const args = process.argv.slice(2), arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const profile = arg('--profile', ''), port = Number(arg('--port', '0'));
if (!profiles.includes(profile) || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Supply --profile ' + profiles.join('|') + ' and an explicitly owned --port.');
const draftId = editorProfile(profile) ? arg('--draft-id', '') : null;
if (editorProfile(profile) && !isFixtureId(draftId)) throw new Error('Supply --draft-id UUID from the disposable local private-qa-fixture.json; no historical draft ID is assumed.');
const origin = `http://127.0.0.1:${port}`, upstream = upstreamFor(profile);
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
const output = resolve(arg('--out', join(tmpdir(), 'deepanker-mobile-harness')), runId);
await mkdir(output, {recursive: true, mode: 0o700});
const here = dirname(fileURLToPath(import.meta.url)), sha = value => createHash('sha256').update(value).digest('hex');
const probe = await readFile(resolve(here, 'probe.js'));
const manifest = {runId, profile, origin, upstream, output, syntheticDraft: draftId,
  probeSHA256: sha(probe), policySHA256: sha(await readFile(resolve(here, 'policy.mjs'))), serverSHA256: sha(await readFile(fileURLToPath(import.meta.url))),
  note: 'No production access. No editor document write is forwarded. HTML identity is recorded per response; source/build identity must be verified separately by the release owner.'};
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {mode: 0o600});
let logQueue = Promise.resolve();
const log = value => {logQueue = logQueue.then(() => appendFile(resolve(output, 'requests.jsonl'), JSON.stringify({at: new Date().toISOString(), ...value}) + '\n', {mode: 0o600}));};
const respond = (res, status, body, type = 'text/plain; charset=utf-8', head = false, extra = {}) => {
  res.writeHead(status, {'content-type': type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'x-mobile-qa': profile, ...extra});
  res.end(head ? undefined : body);
};
const readBody = req => new Promise((done, fail) => {
  const chunks = []; let size = 0;
  req.on('data', chunk => {size += chunk.length; if (size > 5_000_000) {fail(new Error('Request too large')); req.destroy();} else chunks.push(chunk);});
  req.on('end', () => done(Buffer.concat(chunks))); req.on('error', fail);
});
const forward = (path, method, headers, body) => new Promise((done, fail) => {
  const request = http.request(upstream + path, {method, headers}, response => {
    const chunks = []; let size = 0;
    response.on('data', chunk => {size += chunk.length; if (size > 16 * 1024 * 1024) request.destroy(new Error('Response too large')); else chunks.push(chunk);});
    response.on('end', () => done({status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks)}));
    response.on('error', fail);
  });
  request.on('error', fail); request.setTimeout(20000, () => request.destroy(new Error('Local upstream timeout'))); request.end(body);
});
const server = http.createServer(async (req, res) => {
  const started = Date.now(), method = req.method, head = method === 'HEAD';
  const url = new URL(req.url || '/', origin), path = cleanPath(url.pathname);
  const record = (status, detail = {}) => log({method, path, status, durationMs: Date.now() - started, ...detail});
  // No remote browser request, arbitrary Host, absolute-form proxy or cross-origin mutation.
  if (req.headers.host !== `127.0.0.1:${port}` || url.origin !== origin || (req.headers.origin && req.headers.origin !== origin)) return respond(res, 403, 'This QA origin accepts same-origin loopback requests only.');
  if (!path) return respond(res, 400, 'Invalid path.');
  if ((method === 'GET' || head) && path === '/__mobile/probe.js') return respond(res, 200, probe, 'text/javascript; charset=utf-8', head);
  if ((method === 'GET' || head) && path === '/__mobile/config') return respond(res, 200, JSON.stringify(manifest), 'application/json', head);
  const action = route(profile, method, path, draftId);
  if (action === 'refuse') {record(403, {action}); return respond(res, 403, 'Outside this isolated QA profile. Publishing, unpublishing, deleting and document saves are never forwarded.');}
  if (!['GET', 'HEAD'].includes(method) && req.headers.origin !== origin) {record(403, {action: 'missing-local-origin'}); return respond(res, 403, 'A same-origin browser request is required.');}
  try {
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(req);
    if (action === 'save-fault') {
      const fault = saveFailure(profile); record(fault.status || 0, {action: 'injected-save-fault', forwarded: false, disconnect: !!fault.disconnect});
      if (fault.disconnect) return req.socket.destroy();
      return respond(res, fault.status, JSON.stringify(fault.body), 'application/json; charset=utf-8');
    }
    const result = await forward(url.pathname + url.search, method, requestHeaders(profile, req.headers, origin), body);
    const headers = {...result.headers};
    for (const key of ['connection', 'transfer-encoding', 'content-length', 'etag', 'last-modified', 'content-encoding', 'keep-alive']) delete headers[key];
    if (!editorProfile(profile)) delete headers['set-cookie'];
    headers['cache-control'] = 'private, no-store'; headers['x-mobile-qa'] = profile;
    if (headers.location) {
      const destination = new URL(headers.location, upstream);
      if (destination.origin !== upstream) {record(502, {action: 'external-redirect-refused'}); return respond(res, 502, 'External redirect refused.');}
      headers.location = destination.pathname + destination.search + destination.hash;
    }
    let responseBody = result.body;
    if (!head) {
      if (result.headers['content-encoding'] === 'gzip') responseBody = gunzipSync(responseBody);
      else if (result.headers['content-encoding'] === 'br') responseBody = brotliDecompressSync(responseBody);
      else if (result.headers['content-encoding'] === 'deflate') responseBody = inflateSync(responseBody);
    }
    let htmlSHA256 = null, injection = null;
    if (!head && String(headers['content-type']).includes('text/html')) {
      htmlSHA256 = sha(responseBody); const html = responseBody.toString('utf8');
      if (headers['content-security-policy'] || /<meta[^>]+http-equiv\s*=\s*["']?content-security-policy/i.test(html)) injection = 'omitted-existing-csp';
      else if (/<head(?:\s[^>]*)?>/i.test(html)) {
        const config = Buffer.from(JSON.stringify({runId, profile, upstream, originalHTMLSHA256: htmlSHA256, probeSHA256: sha(probe)})).toString('base64');
        responseBody = Buffer.from(html.replace(/<head(?:\s[^>]*)?>/i, match => match + `<script src="/__mobile/probe.js" data-mobile-config="${config}"></script>`)); injection = 'before-app-scripts';
      }
      headers['x-mobile-qa-injection'] = injection || 'no-head'; headers['x-mobile-qa-original-html-sha256'] = htmlSHA256;
    }
    record(result.status, {action: 'forwarded', htmlSHA256, injection, bytes: responseBody.length});
    res.writeHead(result.status, headers); res.end(head ? undefined : responseBody);
  } catch (error) {record(502, {action: 'local-upstream-error', error: error.name}); if (!res.destroyed) respond(res, 502, 'Local QA upstream unavailable.');}
});
server.on('error', error => {process.stderr.write(error.message + '\n'); process.exitCode = 1;});
server.listen(port, '127.0.0.1', () => process.stdout.write(`${profile}: ${origin}\nEvidence: ${output}\n`));
const close = () => server.close(() => logQueue.finally(() => process.exit(0)));
process.on('SIGINT', close); process.on('SIGTERM', close);
