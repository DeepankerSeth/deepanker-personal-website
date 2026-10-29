import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const worker = `
import * as sitemap from './src/pages/sitemap.xml.ts';
import * as index from './src/pages/sitemap-index.xml.ts';
import * as robots from './src/pages/robots.txt.ts';
import * as rss from './src/pages/rss.xml.js';
export default { async fetch(request, env) {
 const path = new URL(request.url).pathname;
 const routes = {'/sitemap.xml':sitemap,'/sitemap-index.xml':index,'/robots.txt':robots,'/rss.xml':rss};
 return routes[path]?.GET({request,site:new URL('https://deepankerseth.com'),locals:{}})
  ?? new Response('Not found',{status:404});
}};`;

// Exercise actual endpoint code and actual SQLite filtering. No Astro page UI,
// production access, credentials, fixture database, or remote binding is used.
test('runtime public metadata reflects only current published D1 rows', {timeout:30_000}, async t => {
	const storage = await mkdtemp(join(tmpdir(), 'material-metadata-test-'));
	const compiled = await build({ stdin:{ contents:worker,resolveDir:root,sourcefile:'metadata-test-worker.ts' },
		bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'] });
	const mf = new Miniflare(convertV4MiniflareOptions({modules:true,script:compiled.outputFiles[0].text,
		compatibilityDate:'2025-10-08',compatibilityFlags:['nodejs_compat'],
		d1Databases:{DB:'metadata-isolated-tests'},d1Persist:join(storage,'d1')}));
	t.after(async()=>{await mf.dispose();await rm(storage,{recursive:true,force:true});});
	const db = await mf.getD1Database('DB');
	const schema = await readFile(join(root,'schema.sql'),'utf8');
	await db.batch(unstable_splitSqlQuery(schema).map(sql=>db.prepare(sql)));
	const request = route => mf.dispatchFetch(`http://local.test${route}`);
	const locs = xml => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match=>match[1]);
	const insert = (id,slug,status) => db.prepare(`INSERT INTO posts
		(id,slug,title,description,content,rendered_html,status,created_at,updated_at,published_at)
		VALUES (?,?,?,'A summary','Original Markdown','<p>Original HTML</p>',?,'2026-03-01','2026-03-01','2026-03-01')`)
		.bind(id,slug,`Title & ${slug}`,status).run();
	await t.test('empty collection still has only canonical home and writing URLs',async()=>{
		const response=await request('/sitemap.xml');
		assert.equal(response.status,200);
		assert.match(response.headers.get('content-type'),/^application\/xml/);
		assert.match(response.headers.get('cache-control'),/max-age=0/);
		assert.deepEqual(locs(await response.text()),['https://deepankerseth.com/','https://deepankerseth.com/writing']);
	});
	await insert('public','public-essay','published');
	await insert('legacy-private','legacy-private','draft');
	await db.prepare(`INSERT INTO post_drafts(id,title,slug,content,created_at,updated_at)
		VALUES ('working-copy','Private title','private-essay','Private body','2026-03-01','2026-03-01')`).run();
	await t.test('private rows and private routes never appear; published slugs are discovered',async()=>{
		const xml=await(await request('/sitemap.xml')).text();
		assert.deepEqual(locs(xml),['https://deepankerseth.com/','https://deepankerseth.com/writing','https://deepankerseth.com/writing/public-essay']);
		assert.doesNotMatch(xml,/private|admin|classic|local\.test/);
	});
	await t.test('RSS uses production canonical writing routes and stable slash GUIDs',async()=>{
		const response=await request('/rss.xml');
		assert.equal(response.status,200);
		const xml=await response.text();
		assert.equal([...xml.matchAll(/<item>/g)].length,1);
		assert.match(xml,/<link>https:\/\/deepankerseth\.com\/writing\/public-essay\/<\/link>/);
		assert.match(xml,/<guid isPermaLink="true">https:\/\/deepankerseth\.com\/writing\/public-essay\/<\/guid>/);
		assert.doesNotMatch(xml,/legacy-private|private-essay|local\.test|\/classic\//);
	});
	await t.test('visibility changes are reflected at request time without a rebuild',async()=>{
		await db.prepare("UPDATE posts SET status='published' WHERE id='legacy-private'").run();
		assert.equal(locs(await(await request('/sitemap.xml')).text()).length,4);
		await db.prepare("UPDATE posts SET status='draft' WHERE id='public'").run();
		const xml=await(await request('/sitemap.xml')).text();
		assert.ok(locs(xml).includes('https://deepankerseth.com/writing/legacy-private'));
		assert.doesNotMatch(xml,/public-essay/);
		assert.doesNotMatch(await(await request('/rss.xml')).text(),/public-essay/);
	});
	await t.test('robots and the existing sitemap-index route point to runtime canonical inventory',async()=>{
		const response=await request('/robots.txt');
		assert.match(response.headers.get('content-type'),/^text\/plain/);
		assert.match(await response.text(),/^Sitemap: https:\/\/deepankerseth\.com\/sitemap\.xml$/m);
		assert.deepEqual(locs(await(await request('/sitemap-index.xml')).text()),['https://deepankerseth.com/sitemap.xml']);
	});
});
