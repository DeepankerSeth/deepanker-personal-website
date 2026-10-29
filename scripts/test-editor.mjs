import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fromHtml } from 'hast-util-from-html';
import { unstable_splitSqlQuery } from 'wrangler';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const originalColumns = 'id,slug,title,description,content,rendered_html,tags,status,featured,cover_variant,cover_accent,created_at,updated_at,published_at';
const legacySchema = await readFile(join(root, 'tests/fixtures/pre-working-copy-schema.sql'), 'utf8');

const worker = String.raw`
import { withEnv } from 'cloudflare:workers';
import { onRequest } from './src/middleware.ts';
import * as posts from './src/pages/api/editor/posts/index.ts';
import * as document from './src/pages/api/editor/posts/[id]/index.ts';
import * as publish from './src/pages/api/editor/posts/[id]/publish.ts';
import * as unpublish from './src/pages/api/editor/posts/[id]/unpublish.ts';
import * as discard from './src/pages/api/editor/posts/[id]/discard.ts';
import * as exportPost from './src/pages/api/editor/posts/[id]/export.ts';
import * as preview from './src/pages/api/editor/preview.ts';
import * as importPost from './src/pages/api/editor/import.ts';
import * as legacyPosts from './src/pages/api/posts/index.ts';
import * as legacyPost from './src/pages/api/posts/[id].ts';
import * as login from './src/pages/api/auth/login.ts';
import * as logout from './src/pages/api/auth/logout.ts';
export default { async fetch(request, env) {
 const url = new URL(request.url);
 const match = url.pathname.match(/^\/api\/editor\/posts\/([^/]+)(?:\/(publish|unpublish|discard|export))?$/);
 const legacyMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
 // Force another writer immediately after the handler's first committed write.
 // A response must describe its own committed snapshot, even if a later write
 // already exists by the time that response reaches the editor.
 const concurrentContent = request.headers.get('x-test-concurrent-content');
 let database = env.DB;
 if (concurrentContent && match) {
  let injected = false;
  const statements = new WeakMap();
  const afterWrite = async (sql) => {
   if (injected || !sql.some((query) => /^\s*(?:INSERT|UPDATE|DELETE)\b/i.test(query))) return;
   injected = true;
   await env.DB.prepare('UPDATE post_drafts SET content=?, version=version+1 WHERE id=?').bind(concurrentContent, match[1]).run();
  };
  const wrap = (statement, sql) => {
   const proxy = new Proxy(statement, { get(target, property) {
    if (property === 'bind') return (...values) => wrap(target.bind(...values), sql);
    if (property === 'run') return async () => { const result = await target.run(); await afterWrite([sql]); return result; };
    const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
   }});
   statements.set(proxy, { statement, sql }); return proxy;
  };
  database = new Proxy(env.DB, { get(target, property) {
   if (property === 'prepare') return (sql) => wrap(target.prepare(sql), sql);
   if (property === 'batch') return async (batch) => {
    const records = batch.map((statement) => statements.get(statement));
    const results = await target.batch(records.map((record, index) => record?.statement ?? batch[index]));
    await afterWrite(records.map((record) => record?.sql ?? '')); return results;
   };
   const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
  }});
 }
 const operations = {publish,unpublish,discard,export:exportPost};
 const route = match ? (operations[match[2]] || document) :
  url.pathname === '/api/editor/posts' ? posts :
  url.pathname === '/api/editor/preview' ? preview :
  url.pathname === '/api/editor/import' ? importPost :
  url.pathname === '/api/posts' ? legacyPosts :
  legacyMatch ? legacyPost :
  url.pathname === '/api/auth/login' ? login :
  url.pathname === '/api/auth/logout' ? logout : null;
 const context = { request, url, params: {id: match?.[1] ?? legacyMatch?.[1]}, locals: {},
  redirect: (location) => new Response(null, {status:302,headers:{Location:location}}) };
 return withEnv({...env, DB: database}, () => onRequest(context, async () => route?.[request.method]
  ? route[request.method](context) : new Response('Not found', {status:404})));
}};`;

// Check the navigable graph, not just renderer markup: every footnote and
// repeated reference must have one unique target and a corresponding way back.
function footnoteGraph(html) {
	const elements = [];
	const visit = (node) => {
		if (node.type === 'element') elements.push(node);
		for (const child of node.children ?? []) visit(child);
	};
	visit(fromHtml(html, { fragment: true }));
	const named = elements.filter((node) => node.properties.id);
	const ids = new Map(named.map((node) => [node.properties.id, node]));
	assert.equal(ids.size, named.length, 'All rendered IDs are unique.');
	for (const id of ids.keys()) assert.match(id, /^essay-footnote-(?:label|(?:ref-)?[1-9][0-9]*(?:-[1-9][0-9]*)?)$/);
	const refs = elements.filter((node) => Object.hasOwn(node.properties, 'dataFootnoteRef'));
	const backrefs = elements.filter((node) => Object.hasOwn(node.properties, 'dataFootnoteBackref'));
	for (const reference of refs) {
		assert.equal(ids.get(reference.properties.href.slice(1))?.tagName, 'li', 'Each reference reaches a footnote.');
		assert.deepEqual(reference.properties.ariaDescribedBy, ['essay-footnote-label']);
		assert.equal(ids.get('essay-footnote-label')?.tagName, 'h2');
		assert.equal(backrefs.filter((link) => link.properties.href === `#${reference.properties.id}`).length, 1,
			'Each occurrence has exactly one return link.');
	}
	for (const backref of backrefs) {
		assert.ok(refs.includes(ids.get(backref.properties.href.slice(1))), 'Return links reach actual references.');
		assert.match(backref.properties.ariaLabel, /^Back to reference [1-9][0-9]*(?:, occurrence [1-9][0-9]*)?$/);
	}
	assert.equal(refs.length, backrefs.length);
	return { ids, refs, backrefs, elements };
}

function authCookie(secret, payload = { sub: 'admin', exp: Math.floor(Date.now() / 1000) + 600 }, header = { alg: 'HS256', typ: 'JWT' }) {
	const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
	const input = `${encode(header)}.${encode(payload)}`;
	return `admin_token=${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

test('private editor: real D1 migration, routes, publication, and recovery', { timeout: 120_000 }, async (t) => {
	const storage = await mkdtemp(join(tmpdir(), 'personal-editor-test-'));
	const secret = randomBytes(32).toString('hex');
	const password = randomBytes(24).toString('hex');
	const compiled = await build({
		stdin: { contents: worker, resolveDir: root, sourcefile: 'editor-test-worker.ts' },
		bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
		external: ['cloudflare:workers'],
		plugins: [{ name: 'astro-middleware-contract', setup(plugin) {
			plugin.onResolve({ filter: /^astro:middleware$/ }, () => ({ path: 'middleware', namespace: 'astro-test' }));
			plugin.onLoad({ filter: /.*/, namespace: 'astro-test' }, () => ({ contents: 'export const defineMiddleware = (handler) => handler;' }));
		} }],
	});
	const mf = new Miniflare(convertV4MiniflareOptions({
		modules: true, script: compiled.outputFiles[0].text,
		compatibilityDate: '2025-10-08', compatibilityFlags: ['nodejs_compat'],
		d1Databases: { DB: 'editor-isolated-tests', FRESH: 'editor-fresh-tests' }, d1Persist: join(storage, 'd1'),
		bindings: { JWT_SECRET: secret, ADMIN_PASSWORD_HASH: createHash('sha256').update(password).digest('hex') },
	}));
	t.after(async () => { await mf.dispose(); await rm(storage, { recursive: true, force: true }); });
	const db = await mf.getD1Database('DB');
	// Use the same SQLite-aware splitter as Wrangler, preserving quoted
	// newlines and entire trigger bodies. D1 exec() is line-oriented.
	const applySql = (database, sql) => database.batch(unstable_splitSqlQuery(sql).map((statement) => database.prepare(statement)));
	const cookie = authCookie(secret);
	const request = (path, method = 'GET', body, headers = {}) => mf.dispatchFetch(`http://editor.test${path}`, {
		method, headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const json = async (path, method = 'GET', body, status = 200) => {
		const response = await request(path, method, body);
		const result = await response.json();
		assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
		return result;
	};
	const snapshot = () => db.prepare(`SELECT ${originalColumns} FROM posts ORDER BY id`).all();
	const essay = (title = 'A private essay') => ({
		title, slug: title.toLowerCase().replaceAll(' ', '-'), description: 'A deliberate summary.',
		reading_excerpt: null, content: 'An essay in progress.', tags: ['Attention'], featured: false,
		cover_variant: null, cover_accent: null,
	});
	const create = (document, id = randomUUID()) => json('/api/editor/posts', 'POST', { id, document }, 201);
	const versionBody = (item) => ({ expectedDraftVersion: item.draftVersion, expectedPublishedRevision: item.publishedRevision });
	const existingId = '550e8400-e29b-41d4-a716-446655440001';
	const existingUrl = `/api/editor/posts/${existingId}`;
	let original;

	await t.test('additive migration preserves every legacy column and creates no drafts', async () => {
		await applySql(db, legacySchema);
		await applySql(db, await readFile(join(root, 'tests/fixtures/sample-posts.sql'), 'utf8'));
		original = (await snapshot()).results;
		await applySql(db, await readFile(join(root, 'migrations/0003_editor_working_copies.sql'), 'utf8'));
		assert.deepEqual((await snapshot()).results, original);
		assert.equal((await db.prepare('SELECT count(*) AS n FROM post_drafts').first()).n, 0);
		assert.ok((await db.prepare('SELECT revision, reading_excerpt FROM posts').all()).results.every((row) => row.revision === 1 && row.reading_excerpt === null));
	});

	await t.test('editor endpoints are authenticated, private, and origin-checked', async () => {
		const denied = await mf.dispatchFetch('http://editor.test/api/editor/posts');
		assert.equal(denied.status, 401);
		const own = await request('/api/editor/posts');
		assert.equal(own.headers.get('cache-control'), 'private, no-store');
		const cross = await request('/api/editor/posts', 'POST', { document: essay() }, { origin: 'https://elsewhere.test' });
		assert.equal(cross.status, 403);
		assert.equal((await db.prepare('SELECT count(*) AS n FROM post_drafts').first()).n, 0);
	});

	await t.test('legacy manuscript responses and session-dependent redirects are not stored', async () => {
		const draft = original.find(row => row.status === 'draft');
		assert.ok(draft, 'The legacy fixture includes an unpublished manuscript.');
		for (const path of ['/api/posts', `/api/posts/${draft.id}`]) {
			const response = await request(path);
			assert.equal(response.status, 200);
			assert.equal(response.headers.get('cache-control'), 'private, no-store', path);
			const body = await response.json();
			const document = Array.isArray(body) ? body.find(row => row.id === draft.id) : body;
			assert.equal(document.content, draft.content, 'Exercise a real private manuscript response.');
		}
		const missing = await request('/api/posts/missing-local-piece');
		assert.equal(missing.status, 404);
		assert.equal(missing.headers.get('cache-control'), 'private, no-store');
		for (const path of ['/admin', '/admin/posts/new']) {
			const response = await mf.dispatchFetch(`http://editor.test${path}`, { redirect: 'manual' });
			assert.equal(response.status, 302);
			assert.equal(response.headers.get('location'), '/admin/login');
			assert.equal(response.headers.get('cache-control'), 'private, no-store', path);
		}
		assert.deepEqual((await snapshot()).results, original, 'Reading legacy routes does not change source rows.');
	});

	await t.test('retired direct writers cannot alter public rows, drafts, or stable URLs', async () => {
		const beforePosts = (await db.prepare('SELECT * FROM posts ORDER BY id').all()).results;
		const beforeDrafts = (await db.prepare('SELECT * FROM post_drafts ORDER BY id').all()).results;
		for (const [path, method] of [
			['/api/posts', 'POST'],
			[`/api/posts/${existingId}`, 'PUT'],
			[`/api/posts/${existingId}`, 'DELETE'],
		]) {
			const response = await request(path, method, {
				title: 'Must not be saved', slug: 'must-not-replace-the-url',
				content: '<script>mustNotPublish()</script>', status: 'published',
			});
			assert.equal(response.status, 410);
			assert.equal(response.headers.get('cache-control'), 'private, no-store');
			const body = await response.json();
			assert.equal(body.code, 'legacy_write_retired');
			assert.match(body.error, /private draft.*explicitly publish/);
			const denied = await mf.dispatchFetch(`http://editor.test${path}`, { method });
			assert.equal(denied.status, 401, 'Retirement does not remove authentication.');
			const cross = await request(path, method, {}, { origin: 'https://elsewhere.test' });
			assert.equal(cross.status, 403, 'Origin checks still happen before the retired endpoint.');
		}
		assert.deepEqual((await db.prepare('SELECT * FROM posts ORDER BY id').all()).results, beforePosts);
		assert.deepEqual((await db.prepare('SELECT * FROM post_drafts ORDER BY id').all()).results, beforeDrafts);
	});

	await t.test('production HTTP redirects only safe reads and rejects writes before authentication', async () => {
		for (const method of ['GET', 'HEAD']) {
			for (const path of ['/', '/writing/a%20title?from=index&passage=2', '/admin/login?return=%2Fadmin', '/_image']) {
				const response = await mf.dispatchFetch(`http://deepankerseth.com${path}`, { method, redirect: 'manual' });
				assert.equal(response.status, 308);
				assert.equal(response.headers.get('location'), `https://deepankerseth.com${path}`);
				assert.equal(response.headers.has('set-cookie'), false);
				assert.equal(await response.text(), '');
			}
		}
		const beforePosts = (await snapshot()).results;
		const beforeDrafts = (await db.prepare('SELECT * FROM post_drafts ORDER BY id').all()).results;
		for (const [method, path, body] of [
			['POST', '/api/auth/login', { password }],
			['POST', '/api/auth/logout', {}],
			['POST', '/api/editor/posts', { id: randomUUID(), document: essay('Must remain absent') }],
			['PUT', '/api/posts/transport-test', {}],
			['PATCH', '/api/editor/posts/transport-test', {}],
			['DELETE', '/api/posts/transport-test', {}],
		]) {
			const response = await mf.dispatchFetch(`http://deepankerseth.com${path}`, {
				method, redirect: 'manual', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body),
			});
			assert.equal(response.status, 403);
			assert.equal(response.headers.get('cache-control'), 'private, no-store');
			assert.equal(response.headers.has('location'), false, 'Never replay an insecure submitted body through a redirect.');
			assert.equal(response.headers.has('set-cookie'), false, 'Insecure requests cannot issue or clear a session.');
			assert.equal((await response.json()).code, 'insecure_transport');
		}
		assert.deepEqual((await snapshot()).results, beforePosts);
		assert.deepEqual((await db.prepare('SELECT * FROM post_drafts ORDER BY id').all()).results, beforeDrafts);
		for (const origin of ['http://127.0.0.1', 'http://localhost', 'https://deepankerseth.com']) {
			const response = await mf.dispatchFetch(`${origin}/api/auth/login`, {
				method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
			});
			assert.equal(response.status, 200);
			assert.equal(response.headers.get('set-cookie')?.includes('; Secure'), origin.startsWith('https:'));
		}
		// Unknown hosts and aliases are not silently assigned a new routing policy.
		for (const origin of ['http://www.deepankerseth.com', 'http://editor.test']) {
			const response = await mf.dispatchFetch(`${origin}/`, { redirect: 'manual' });
			assert.equal(response.status, 404);
			assert.equal(response.headers.has('location'), false);
		}
	});

	await t.test('HTTPS login/logout set Secure cookies while local HTTP remains usable', async () => {
		for (const protocol of ['http', 'https']) {
			const login = await mf.dispatchFetch(`${protocol}://editor.test/api/auth/login`, {
				method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }),
			});
			assert.equal(login.status, 200);
			const cookie = login.headers.get('set-cookie') ?? '';
			assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'), 'Login uses private, same-site cookies.');
			assert.equal(cookie.includes('; Secure'), protocol === 'https', 'Secure is enabled exactly on HTTPS.');
			assert.equal(login.headers.get('cache-control'), 'no-store');
			const logout = await mf.dispatchFetch(`${protocol}://editor.test/api/auth/logout`, { method: 'POST' });
			assert.equal(logout.status, 200);
			const cleared = logout.headers.get('set-cookie') ?? '';
			assert.ok(cleared.includes('Max-Age=0'), 'Logout expires the auth cookie.');
			assert.equal(cleared.includes('; Secure'), protocol === 'https', 'Logout uses matching Secure policy.');
		}
		await json('/api/auth/login', 'POST', { password: { unexpected: 'object' } }, 400);
	});

	await t.test('auth rejects expired/non-admin/malformed signed sessions and cross-origin logout', async () => {
		const future = Math.floor(Date.now() / 1000) + 600;
		for (const [payload, header] of [
			[{ sub: 'admin', exp: Math.floor(Date.now() / 1000) }, undefined],
			[{ sub: 'admin' }, undefined],
			[{ sub: 'reader', exp: future }, undefined],
			[{ sub: 'admin', exp: String(future) }, undefined],
			[{ sub: 'admin', exp: future }, { alg: 'none', typ: 'JWT' }],
		]) {
			const response = await request('/api/editor/posts', 'GET', undefined, { cookie: authCookie(secret, payload, header) });
			assert.equal(response.status, 401);
		}
		const blocked = await request('/api/auth/logout', 'POST', {}, { origin: 'https://elsewhere.test' });
		assert.equal(blocked.status, 403);
		assert.equal(blocked.headers.has('set-cookie'), false);
	});

	await t.test('preview and Markdown import preserve poetry and Unicode without database writes', async () => {
		const content = '\uFEFF# māyā, avidyā\r\n\r\nI am light, sound, taste, touch, and heard<br>\r\nOr not?<br>\r\nMadhurādhipate akhilaṁ madhuram\r\n\r\n1. First\r\n2. Second\r\n\r\n[An ordinary link](https://example.com)\r\n';
		const imported = await json('/api/editor/import', 'POST', { content });
		assert.equal(imported.document.content, content);
		const before = (await snapshot()).results;
		const document = { ...essay(), content };
		for (let count = 0; count < 3; count++) {
			const preview = await json('/api/editor/preview', 'POST', { document });
			assert.match(preview.renderedHtml, /<h1>māyā, avidyā<\/h1>/, 'A UTF-8 BOM must not turn the opening heading into literal Markdown.');
			assert.match(preview.renderedHtml, /Madhurādhipate akhilaṁ madhuram/);
			assert.equal((preview.renderedHtml.match(/<br>/g) ?? []).length, 2);
			assert.match(preview.renderedHtml, /<ol>/);
			assert.match(preview.renderedHtml, /href="https:\/\/example.com"/);
		}
		assert.deepEqual((await snapshot()).results, before);
		assert.equal((await db.prepare('SELECT count(*) AS n FROM post_drafts').first()).n, 0);
	});

	await t.test('preview sanitizes executable HTML while keeping editorial formats', async () => {
		const content = '<script>alert(1)</script><style>body{display:none}</style><iframe src="https://example.com"></iframe>\n\n<a href="javascript:alert(1)" onclick="alert(2)">Link</a><img src="https://example.com/image.png" alt="An image" onerror="alert(3)"><br>\n\n```js\nconst idea = "māyā";\n```\n\n| One | Two |\n| --- | --- |\n| 1 | 2 |';
		const preview = await json('/api/editor/preview', 'POST', { document: { ...essay(), content } });
		assert.doesNotMatch(preview.renderedHtml, /script|onclick|onerror|javascript:|iframe|<style/);
		assert.match(preview.renderedHtml, /<img[^>]+alt="An image"/);
		assert.match(preview.renderedHtml, /class="hljs language-js"/);
		assert.match(preview.renderedHtml, /<table>/);
	});

	await t.test('footnote previews preserve rich note bodies, repeated references, and Unicode without writes', async () => {
		const source = '\uFEFFA thought[^māyā]. Again[^māyā]. Another[^two].\r\n\r\n[^māyā]: The first line.<br>\r\n    Madhurādhipate akhilaṁ madhuram\r\n\r\n    A second paragraph with *emphasis*.\r\n\r\n    - A list item\r\n    - [A source](https://example.com)\r\n\r\n[^two]: Another note with a nested reference[^nested].\r\n\r\n[^nested]: A nested note.\r\n';
		const before = (await snapshot()).results;
		const beforeDrafts = (await db.prepare('SELECT * FROM post_drafts ORDER BY id').all()).results;
		const document = { ...essay(), content: source };
		const first = await json('/api/editor/preview', 'POST', { document });
		const graph = footnoteGraph(first.renderedHtml);
		assert.equal(graph.refs.length, 4);
		assert.equal(graph.ids.size, 8, 'Three notes, four occurrences, and the footnote heading.');
		assert.equal(graph.ids.get('essay-footnote-1').tagName, 'li');
		assert.match(first.renderedHtml, /Madhurādhipate akhilaṁ madhuram/);
		assert.match(first.renderedHtml, /<br>/);
		assert.match(first.renderedHtml, /<p>A second paragraph with <em>emphasis<\/em>\.<\/p>/);
		assert.match(first.renderedHtml, /<ul>/);
		assert.match(first.renderedHtml, /href="https:\/\/example.com"/);
		const imported = await json('/api/editor/import', 'POST', { content: source });
		assert.equal(imported.document.content, source);
		const plain = await json('/api/editor/preview', 'POST', { document: { ...essay(), content: 'Undefined[^missing]. `Code[^literal]`.' } });
		assert.match(plain.renderedHtml, /Undefined\[\^missing\]/);
		assert.match(plain.renderedHtml, /<code>Code\[\^literal\]<\/code>/);
		assert.equal(footnoteGraph(plain.renderedHtml).refs.length, 0);
		const other = await json('/api/editor/preview', 'POST', { document: { ...essay(), content: 'Independent[^new].\n\n[^new]: Its own first note.' } });
		assert.equal(footnoteGraph(other.renderedHtml).refs[0].properties.id, 'essay-footnote-ref-1');
		const again = await json('/api/editor/preview', 'POST', { document });
		assert.equal(again.renderedHtml, first.renderedHtml, 'Output is deterministic across unrelated previews.');
		assert.doesNotMatch(again.renderedHtml, /generated-footnote-/);
		assert.deepEqual((await snapshot()).results, before);
		assert.deepEqual((await db.prepare('SELECT * FROM post_drafts ORDER BY id').all()).results, beforeDrafts);
	});

	await t.test('footnote labels and raw HTML cannot inject attributes, clobber IDs, or hijack generated targets', async () => {
		const content = [
			'<p id="location" name="constructor">Raw HTML.</p>',
			'<h2 id="essay-footnote-label">False heading</h2>',
			'<ol><li id="essay-footnote-1">False note</li></ol>',
			'<a id="essay-footnote-ref-1" data-footnote-ref aria-describedby="essay-footnote-label">False reference</a>',
			'<a href="javascript:alert(1)" data-footnote-backref onclick="alert(1)">False return</a>',
			'First[^a]. Again[^a]. Collision[^ref-a]. Another[^a-2]. Hostile[^x" onmouseover="alert(1)].',
			'[^a]: Real first note.\n[^ref-a]: Real second note.\n[^a-2]: Real third note.\n[^x" onmouseover="alert(1)]: Safe body.<img src="https://example.com/p.png" onerror="alert(1)" alt="An image">',
		].join('\n\n');
		const { renderedHtml } = await json('/api/editor/preview', 'POST', { document: { ...essay(), content } });
		const graph = footnoteGraph(renderedHtml);
		assert.equal(graph.refs.length, 5);
		assert.equal(graph.ids.size, 10, 'Four notes, five occurrences, and their heading; no author IDs survive.');
		assert.match(renderedHtml, /<h2>False heading<\/h2>/);
		assert.match(renderedHtml, /<li>False note<\/li>/);
		assert.match(renderedHtml, /<a>False reference<\/a>/);
		assert.match(renderedHtml, /<a>False return<\/a>/);
		assert.doesNotMatch(renderedHtml, /onmouseover|onerror|onclick|javascript:|name=|id="location"/);
		assert.match(renderedHtml, /alt="An image"/);
		assert.ok(graph.elements.every((node) => !Object.keys(node.properties).some((key) => /^on/i.test(key))));
	});

	await t.test('saving a working copy leaves the live row and public listing unchanged; stale saves conflict', async () => {
		const loaded = await json(existingUrl);
		assert.equal(loaded.draftVersion, 0);
		const before = (await snapshot()).results;
		const document = { ...loaded.document, title: 'A private revision', reading_excerpt: 'A passage chosen by its author.', content: '\r\nPrivate māyā.<br>\r\nSecond line.\r\n' };
		const saved = await json(existingUrl, 'PUT', { ...versionBody(loaded), document });
		assert.equal(saved.draftVersion, 1);
		assert.equal(saved.hasUnpublishedChanges, true);
		assert.equal(saved.document.content, document.content);
		assert.deepEqual((await snapshot()).results, before);
		const conflict = await json(existingUrl, 'PUT', { ...versionBody(loaded), document: { ...document, content: 'stale overwrite' } }, 409);
		assert.equal(conflict.code, 'version_conflict');
		assert.equal((await json(existingUrl)).document.content, document.content);
		const exported = await request(`${existingUrl}/export`);
		assert.equal(await exported.text(), document.content);
	});

	await t.test('publish commits the exact preview, rebases atomically, retains identity/date, and rejects duplicate clicks', async () => {
		const draft = await json(existingUrl);
		const preview = await json('/api/editor/preview', 'POST', { document: draft.document });
		const published = await json(`${existingUrl}/publish`, 'POST', versionBody(draft));
		const row = await db.prepare('SELECT * FROM posts WHERE id=?').bind(existingId).first();
		assert.equal(row.rendered_html, preview.renderedHtml);
		assert.equal(row.content, draft.document.content);
		assert.equal(row.reading_excerpt, draft.document.reading_excerpt);
		assert.equal(row.slug, original[0].slug);
		assert.equal(row.created_at, original[0].created_at);
		assert.equal(row.published_at, original[0].published_at);
		assert.equal(published.publishedRevision, 2);
		assert.equal(published.baseRevision, 2);
		assert.equal(published.hasConflict, false);
		assert.equal(published.hasUnpublishedChanges, false);
		await json(`${existingUrl}/publish`, 'POST', versionBody(draft), 409);
		assert.equal((await db.prepare('SELECT revision FROM posts WHERE id=?').bind(existingId).first()).revision, 2);
	});

	await t.test('unpublish and republish retain first-publication date and keep a private revision usable', async () => {
		const live = await json(existingUrl);
		const draft = await json(existingUrl, 'PUT', { ...versionBody(live), document: { ...live.document, content: 'The next private version.' } });
		const hidden = await json(`${existingUrl}/unpublish`, 'POST', versionBody(draft));
		assert.equal(hidden.publicationStatus, 'draft');
		assert.equal(hidden.hasUnpublishedChanges, true);
		assert.equal(hidden.hasConflict, false);
		assert.equal((await db.prepare("SELECT count(*) AS n FROM posts WHERE id=? AND status='published'").bind(existingId).first()).n, 0);
		const restored = await json(`${existingUrl}/publish`, 'POST', versionBody(hidden));
		assert.equal(restored.publicationStatus, 'published');
		assert.equal(restored.publishedAt, original[0].published_at);
	});

	await t.test('unpublish rejects an unseen private draft version before changing public visibility', async () => {
		const created = await create(essay('Unpublish version guard'));
		const path = `/api/editor/posts/${created.id}`;
		const firstTab = await json(`${path}/publish`, 'POST', versionBody(created));
		const secondTab = await json(path, 'PUT', { ...versionBody(firstTab), document: { ...firstTab.document, content: 'Another tab saved this private text.' } });
		const conflict = await json(`${path}/unpublish`, 'POST', versionBody(firstTab), 409);
		assert.equal(conflict.code, 'version_conflict');
		assert.equal((await json(path)).publicationStatus, 'published');
		assert.equal((await json(path)).document.content, secondTab.document.content);
		const hidden = await json(`${path}/unpublish`, 'POST', versionBody(secondTab));
		assert.equal(hidden.draftVersion, secondTab.draftVersion);
		assert.equal(hidden.document.content, secondTab.document.content);
	});

	await t.test('visibility changes preserve a pre-existing legacy publication conflict', async () => {
		const created = await create(essay('Legacy conflict visibility'));
		const path = `/api/editor/posts/${created.id}`;
		const live = await json(`${path}/publish`, 'POST', versionBody(created));
		const draft = await json(path, 'PUT', { ...versionBody(live), document: { ...live.document, content: 'An older private branch.' } });
		await db.prepare('UPDATE posts SET content=? WHERE id=?').bind('A newer legacy publication.', created.id).run();
		const conflicted = await json(path);
		assert.equal(conflicted.hasConflict, true);
		const hidden = await json(`${path}/unpublish`, 'POST', versionBody(conflicted));
		assert.equal(hidden.hasConflict, true, 'Changing visibility must not imply that divergent content was reviewed.');
		assert.equal(hidden.baseRevision, draft.baseRevision);
		assert.equal(hidden.publishedRevision, conflicted.publishedRevision + 1);
		assert.equal(hidden.document.content, draft.document.content);
		await json(`${path}/publish`, 'POST', versionBody(hidden), 409);
	});

	await t.test('save and publish responses return their own transaction snapshot despite an immediate competing write', async () => {
		for (const operation of ['save', 'publish']) {
			const created = await create(essay(`Response snapshot ${operation}`));
			const path = `/api/editor/posts/${created.id}`;
			const ownContent = operation === 'save' ? 'The exact text this tab saved.' : created.document.content;
			const response = await request(operation === 'save' ? path : `${path}/publish`, operation === 'save' ? 'PUT' : 'POST', {
				...versionBody(created), ...(operation === 'save' ? { document: { ...created.document, content: ownContent } } : {}),
			}, { 'x-test-concurrent-content': 'A competing tab wrote after this transaction.' });
			assert.equal(response.status, 200);
			const committed = await response.json();
			assert.equal(committed.document.content, ownContent);
			assert.equal(committed.draftVersion, created.draftVersion + (operation === 'save' ? 1 : 0));
			const latest = await json(path);
			assert.equal(latest.document.content, 'A competing tab wrote after this transaction.');
			assert.equal(latest.draftVersion, committed.draftVersion + 1);
			await json(`${path}/publish`, 'POST', versionBody(committed), 409);
		}
	});

	await t.test('published slugs are immutable and malformed fields fail before writes', async () => {
		const before = await json(existingUrl);
		const badSlug = await json(existingUrl, 'PUT', { ...versionBody(before), document: { ...before.document, slug: 'a-different-url' } }, 422);
		assert.ok(badSlug.fields.slug);
		for (const patch of [{ tags: [123] }, { featured: 'yes' }, { title: 3 }, { content: null }, { cover_variant: 'unknown' }, { reading_excerpt: 'x'.repeat(1201) }]) {
			await json(existingUrl, 'PUT', { ...versionBody(before), document: { ...before.document, ...patch } }, 422);
		}
		assert.deepEqual(await json(existingUrl), before);
	});

	await t.test('new drafts remain private; publication validation and slug collisions are atomic', async () => {
		const before = (await snapshot()).results;
		const blank = await create({ ...essay(''), content: '' });
		assert.equal(blank.publicationStatus, 'unpublished');
		assert.equal(blank.publishedRevision, 0);
		await json(`/api/editor/posts/${blank.id}/publish`, 'POST', versionBody(blank), 422);
		assert.deepEqual(await json(`/api/editor/posts/${blank.id}/discard`, 'POST', versionBody(blank)), { deleted: true });
		await json(`/api/editor/posts/${blank.id}`, 'GET', undefined, 404);
		const collision = await create({ ...essay('A collision'), slug: original[0].slug });
		await json(`/api/editor/posts/${collision.id}/publish`, 'POST', versionBody(collision), 409);
		assert.deepEqual((await snapshot()).results, before);
		assert.equal((await json(`/api/editor/posts/${collision.id}`)).baseRevision, 0);
		const source = '\r\nA new essay about avidyā.\r\n';
		const draft = await create({ ...essay('A new essay'), content: source });
		const published = await json(`/api/editor/posts/${draft.id}/publish`, 'POST', versionBody(draft));
		assert.equal(published.id, draft.id);
		assert.equal(published.baseRevision, 1);
		assert.equal(published.hasUnpublishedChanges, false);
		assert.equal((await db.prepare('SELECT content FROM posts WHERE id=?').bind(draft.id).first()).content, source);
	});

	await t.test('first-create retries and simultaneous submissions return one unchanged private snapshot', async () => {
		const before = (await db.prepare('SELECT count(*) AS n FROM post_drafts').first()).n;
		const id = randomUUID();
		const document = { ...essay('  Replayable creation  '), slug: '', content: '\uFEFF# māyā\r\n\r\nUntouched source.\r\n', tags: [' Attention ', 'Attention'] };
		// The caller loses the first response; only its creation ID and request survive.
		await request('/api/editor/posts', 'POST', { id, document });
		const retried = await create(document, id);
		assert.equal(retried.id, id);
		assert.equal(retried.document.content, document.content);
		assert.equal(retried.document.title, 'Replayable creation');
		assert.equal(retried.document.slug, 'replayable-creation');
		assert.deepEqual(retried.document.tags, ['Attention']);
		assert.equal(retried.draftVersion, 1);
		assert.equal(retried.publishedRevision, 0);
		assert.deepEqual(await create(document, id), retried, 'Replay retains the original version and timestamp.');
		assert.equal((await db.prepare('SELECT count(*) AS n FROM post_drafts').first()).n, before + 1);
		const concurrentId = randomUUID();
		const responses = await Promise.all([1, 2].map(() => create(essay('Concurrent creation'), concurrentId)));
		assert.deepEqual(responses[0], responses[1]);
		assert.equal(responses[0].id, concurrentId);
		assert.equal((await db.prepare('SELECT count(*) AS n FROM post_drafts WHERE id=?').bind(concurrentId).first()).n, 1);
	});

	await t.test('creation replay never adopts different, edited, or published writing under the same ID', async () => {
		const document = essay('Creation collision protection');
		const created = await create(document);
		const path = `/api/editor/posts/${created.id}`;
		const collision = await json('/api/editor/posts', 'POST', { id: created.id, document: { ...document, content: 'Different request content.' } }, 409);
		assert.equal(collision.code, 'creation_conflict');
		assert.deepEqual(await json(path), created);
		const edited = await json(path, 'PUT', { ...versionBody(created), document });
		assert.equal(edited.draftVersion, 2);
		const newer = await json('/api/editor/posts', 'POST', { id: created.id, document }, 409);
		assert.equal(newer.code, 'creation_conflict');
		assert.deepEqual(await json(path), edited, 'Even identical content at a later version is not silently adopted.');
		const published = await json(`${path}/publish`, 'POST', versionBody(edited));
		const live = await json('/api/editor/posts', 'POST', { id: created.id, document }, 409);
		assert.equal(live.code, 'creation_conflict');
		assert.deepEqual(await json(path), published);
	});

	await t.test('invalid creation IDs and invalid first-create documents fail before any insert', async () => {
		const before = (await db.prepare('SELECT count(*) AS n FROM post_drafts').first()).n;
		for (const id of [undefined, '', 'not-a-uuid', 123]) {
			const rejected = await json('/api/editor/posts', 'POST', { id, document: essay('Invalid creation') }, 400);
			assert.equal(rejected.code, 'invalid_input');
		}
		const id = randomUUID();
		await json('/api/editor/posts', 'POST', { id, document: { ...essay('Invalid document'), content: null } }, 422);
		assert.equal((await db.prepare('SELECT count(*) AS n FROM post_drafts').first()).n, before);
		const corrected = await create(essay('Corrected document'), id);
		assert.equal(corrected.id, id);
	});

	await t.test('legacy public writers advance versions; conflicted draft survives until explicit discard', async () => {
		const loaded = await json(existingUrl);
		const draft = await json(existingUrl, 'PUT', { ...versionBody(loaded), document: { ...loaded.document, content: 'Keep this private recovery text.' } });
		await db.prepare('UPDATE posts SET content=?, updated_at=? WHERE id=?').bind('A legacy API publication.', new Date().toISOString(), existingId).run();
		const changed = await json(existingUrl);
		assert.equal(changed.publishedRevision, draft.publishedRevision + 1);
		assert.equal(changed.hasConflict, true);
		await json(`${existingUrl}/publish`, 'POST', versionBody(changed), 409);
		await json(existingUrl, 'PUT', { ...versionBody(changed), document: changed.document }, 409);
		assert.equal(await (await request(`${existingUrl}/export`)).text(), 'Keep this private recovery text.');
		const restored = await json(`${existingUrl}/discard`, 'POST', versionBody(changed));
		assert.equal(restored.document.content, 'A legacy API publication.');
		assert.equal(restored.draftVersion, changed.draftVersion + 1);
		assert.equal(restored.hasConflict, false);
	});

	await t.test('a failed publication of an existing draft preserves its complete previous row', async () => {
		const id = '550e8400-e29b-41d4-a716-446655440003';
		const path = `/api/editor/posts/${id}`;
		const loaded = await json(path);
		const previous = await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
		const draft = await json(path, 'PUT', { ...versionBody(loaded), document: { ...loaded.document, slug: original[0].slug, content: 'Still private after the failed publication.' } });
		await json(`${path}/publish`, 'POST', versionBody(draft), 409);
		assert.deepEqual(await db.prepare('SELECT * FROM posts WHERE id=?').bind(id).first(), previous);
		assert.deepEqual(await json(path), draft);
	});

	await t.test('discard and re-edit cannot reuse a version held by an older conflicted tab', async () => {
		const created = await create(essay('Discard version continuity'));
		const path = `/api/editor/posts/${created.id}`;
		await json(`${path}/publish`, 'POST', versionBody(created));
		await db.prepare('UPDATE posts SET content=? WHERE id=?').bind('The newer public version.', created.id).run();
		const oldTab = await json(path);
		assert.equal(oldTab.hasConflict, true);
		const restored = await json(`${path}/discard`, 'POST', versionBody(oldTab));
		assert.equal(restored.document.content, 'The newer public version.');
		assert.equal(restored.hasConflict, false);
		const edited = await json(path, 'PUT', { ...versionBody(restored), document: { ...restored.document, content: 'Reviewed replacement working copy.' } });
		await json(path, 'PUT', { ...versionBody(oldTab), document: { ...oldTab.document, content: 'Unreviewed stale overwrite.' } }, 409);
		assert.equal((await json(path)).document.content, edited.document.content);
		assert.ok(restored.draftVersion > oldTab.draftVersion, 'Discard keeps the version sequence monotonic.');
	});

	await t.test('concurrent first-publication requests have one winner and one complete public snapshot', async () => {
		const draft = await create(essay('Concurrent publication'));
		const path = `/api/editor/posts/${draft.id}`;
		const responses = await Promise.all([1, 2].map(() => request(`${path}/publish`, 'POST', versionBody(draft))));
		assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
		const row = await db.prepare('SELECT * FROM posts WHERE id=?').bind(draft.id).first();
		assert.equal(row.revision, 1);
		assert.equal(row.content, draft.document.content);
		assert.equal((await json(path)).hasConflict, false);
	});

	await t.test('guarded concurrent saves have one winner and keep the winning document', async () => {
		const loaded = await json(existingUrl);
		const responses = await Promise.all(['First edit', 'Second edit'].map((content) =>
			request(existingUrl, 'PUT', { ...versionBody(loaded), document: { ...loaded.document, content } })));
		assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
		const winner = await responses.find((response) => response.status === 200).json();
		assert.equal((await json(existingUrl)).document.content, winner.document.content);
	});

	await t.test('footnote publication matches its private preview and preserves imported Markdown exactly', async () => {
		const source = '\uFEFF# Imported heading\r\n\r\nAn imported thought[^note]. Again[^note].\r\n\r\n[^note]: māyā and avidyā.<br>\r\n    A second line.\r\n';
		const document = { ...essay('Footnote publication'), content: source };
		const before = (await snapshot()).results;
		const preview = await json('/api/editor/preview', 'POST', { document });
		assert.match(preview.renderedHtml, /<h1>Imported heading<\/h1>/);
		const draft = await create(document);
		assert.deepEqual((await snapshot()).results, before, 'The private draft has not changed any public row.');
		const path = `/api/editor/posts/${draft.id}`;
		const published = await json(`${path}/publish`, 'POST', versionBody(draft));
		const row = await db.prepare('SELECT content, rendered_html FROM posts WHERE id=?').bind(draft.id).first();
		assert.equal(row.content, source);
		assert.equal(row.rendered_html, preview.renderedHtml);
		assert.equal(footnoteGraph(row.rendered_html).refs.length, 2);
		assert.equal(published.document.content, source);
		const exported = Buffer.from(await (await request(`${path}/export`)).arrayBuffer());
		assert.deepEqual(exported, Buffer.from(source), 'Export bytes preserve the BOM as well as CRLF and Unicode.');
	});

	await t.test('fresh-install schema has the same editor tables and trigger behavior', async () => {
		const fresh = await mf.getD1Database('FRESH');
		await applySql(fresh, await readFile(join(root, 'schema.sql'), 'utf8'));
		await applySql(fresh, await readFile(join(root, 'tests/fixtures/sample-posts.sql'), 'utf8'));
		assert.deepEqual((await fresh.prepare(`SELECT ${originalColumns} FROM posts ORDER BY id`).all()).results, original);
		// Reapplying the canonical schema is safe and leaves seeded content alone.
		await applySql(fresh, await readFile(join(root, 'schema.sql'), 'utf8'));
		assert.deepEqual((await fresh.prepare(`SELECT ${originalColumns} FROM posts ORDER BY id`).all()).results, original);
		const triggerNames = (await fresh.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all()).results.map((row) => row.name);
		assert.deepEqual(triggerNames, ['posts_editor_first_publication', 'posts_editor_revision']);
		await fresh.prepare('UPDATE posts SET title=? WHERE id=?').bind('Updated title', existingId).run();
		assert.equal((await fresh.prepare('SELECT revision FROM posts WHERE id=?').bind(existingId).first()).revision, 2);
		await fresh.prepare(`INSERT INTO post_drafts
			(id, base_revision, version, title, slug, description, content, tags, featured, created_at, updated_at)
			SELECT id, revision, 1, title, slug, description, content, tags, featured, created_at, updated_at
			FROM posts WHERE id=?`).bind(existingId).run();
		await fresh.prepare('UPDATE posts SET content=? WHERE id=?').bind('A divergent publication.', existingId).run();
		await fresh.prepare("UPDATE posts SET status='draft' WHERE id=?").bind(existingId).run();
		assert.equal((await fresh.prepare('SELECT base_revision FROM post_drafts WHERE id=?').bind(existingId).first()).base_revision, 2,
			'Fresh-schema visibility changes preserve an existing content conflict, just like the migration.');
	});
});
