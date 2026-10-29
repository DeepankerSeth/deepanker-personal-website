/** Read-only checks against an explicitly selected LOCAL release server. */
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const opts={'--base-url':null,'--report':'docs/verification/evidence/integrated-http.json','--auth-vars':null,'--private-id':null};
const args=process.argv.slice(2);
for(let i=0;i<args.length;i+=2){
	assert.ok(Object.hasOwn(opts,args[i])&&args[i+1]&&!args[i+1].startsWith('--'),'Expected known --option VALUE pairs');
	opts[args[i]]=args[i+1];
}
assert.ok(opts['--base-url'],'Pass --base-url explicitly; no server is started by this check.');
const base=new URL(opts['--base-url']);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname)&&['http:','https:'].includes(base.protocol),'Localhost servers only');
assert.ok(!base.username&&!base.password,'Do not put credentials in the URL');
const reportPath=resolve(root,opts['--report']);
assert.ok(reportPath.startsWith(resolve(root,'docs/verification/evidence')+'/'),'Report must stay under release evidence');
const xmlRequire=createRequire(import.meta.resolve('@astrojs/rss'));
const {XMLParser,XMLValidator}=xmlRequire('fast-xml-parser');
const xmlParser=new XMLParser();
const array=value=>value==null?[]:Array.isArray(value)?value:[value];
const sha=value=>createHash('sha256').update(value).digest('hex');
const text=node=>node.type==='text'?node.value:(node.children??[]).map(text).join('');
const normalized=value=>value.replace(/\s+/g,' ').trim();
const elements=node=>[...(node.type==='element'?[node]:[]),...(node.children??[]).flatMap(elements)];
const canonical=all=>all.find(node=>node.tagName==='link'&&node.properties.rel?.includes('canonical'))?.properties.href;
const noindex=all=>all.some(node=>node.tagName==='meta'&&node.properties.name==='robots'&&String(node.properties.content).includes('noindex'));
const urlPath=value=>new URL(value).pathname.replace(/\/$/,'')||'/';
const get=async(path,cookie)=>{
	const response=await fetch(new URL(path,base),{redirect:'manual',signal:AbortSignal.timeout(20_000),headers:cookie?{cookie}:{}});
	return {response,body:await response.text()};
};
const evidence={checkedAt:new Date().toISOString(),baseUrl:base.origin,scope:'Read-only integrated HTTP checks; local fixture only. No browser or production proof.',public:[],checks:[],errors:[]};
async function check(label,fn){try{await fn();evidence.checks.push({label,passed:true});}catch(error){evidence.errors.push({label,error:error instanceof Error?error.message:String(error)});}}
const articles=[['meditations','meditations'],['war','war'],['abstractions','abstractions-of-illusion'],['i-am','i-am']];
const expectedUrls=['https://deepankerseth.com/','https://deepankerseth.com/writing',...articles.map(([,slug])=>`https://deepankerseth.com/writing/${slug}`)].sort();
await check('Reading font URLs resolve relative to their actual stylesheet',async()=>{
	const home=await get('/');assert.equal(home.response.status,200);
	const styles=elements(fromHtml(home.body)).filter(node=>node.tagName==='link'&&node.properties.rel?.includes('stylesheet'));
	const urls=new Set();
	for(const style of styles){
		const cssUrl=new URL(style.properties.href,base);assert.equal(cssUrl.origin,base.origin,'Styles must stay self-hosted');
		const response=await fetch(cssUrl);assert.equal(response.status,200);
		for(const match of (await response.text()).matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)){
			const url=new URL(match[1],cssUrl);if(url.pathname.endsWith('.woff2'))urls.add(url.href);
		}
	}
	assert.equal(urls.size,6,'Expected all six self-hosted font faces across the linked stylesheets');
	for(const href of urls){
		const url=new URL(href);
		assert.equal(url.origin,base.origin,'Fonts must stay self-hosted');
		const font=await fetch(url);assert.equal(font.status,200,url.pathname);
		const data=Buffer.from(await font.arrayBuffer());assert.equal(data.subarray(0,4).toString(),'wOF2',url.pathname);
	}
});
await check('Unused optimizer is closed while direct artwork remains byte-exact',async()=>{
	for(const path of ['/_image','/_image/','/_image?href=https%3A%2F%2Fexample.invalid%2Ftest.avif']){
		const {response}=await get(path);assert.equal(response.status,404,path);
		assert.match(response.headers.get('x-robots-tag')||'',/noindex/);
	}
	const path='/literary/art/material/meditations-960.webp';
	const response=await fetch(new URL(path,base));assert.equal(response.status,200);
	assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(await readFile(resolve(root,'public'+path))));
});
for(const[file,slug]of articles)await check(`Exact public essay: ${slug}`,async()=>{
	const capture=JSON.parse(await readFile(resolve(root,`tests/fixtures/public-captures/${file}.json`),'utf8'));
	const{response,body}=await get(`/writing/${slug}`);
	assert.equal(response.status,200);
	const all=elements(fromHtml(body));
	const prose=all.find(node=>Object.hasOwn(node.properties,'dataEssayProse'));
	assert.ok(prose,'Missing shared prose hook');
	const actual=toHtml({type:'root',children:prose.children.filter(node=>!(node.type==='comment'&&['original-body:start','original-body:end'].includes(node.value.trim())))});
	const expected=toHtml(fromHtml(capture.html,{fragment:true}));
	assert.equal(actual,expected,'Stored essay subtree changed');
	const br=elements(prose).filter(node=>node.tagName==='br').length;
	if(slug==='i-am')assert.equal(br,68);
	const headings=all.filter(node=>node.tagName==='h1');
	assert.equal(headings.length,1);
	assert.equal(normalized(text(headings[0])),normalized(capture.title),'Full title changed');
	assert.equal(canonical(all),`https://deepankerseth.com/writing/${slug}`);
	assert.ok(!noindex(all),'Published essay must be indexable');
	assert.equal(all.find(node=>node.tagName==='meta'&&node.properties.property==='og:url')?.properties.content,canonical(all));
	evidence.public.push({slug,canonical:canonical(all),normalizedHtmlSha256:sha(actual),sourceCaptureSha256:sha(capture.html),normalizedBytes:Buffer.byteLength(actual),brCount:br,exact:true});
});
await check('Runtime sitemap has exactly the current four essays and public index routes',async()=>{
	const{response,body}=await get('/sitemap.xml');
	assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/xml/);
	assert.equal(XMLValidator.validate(body),true);
	assert.deepEqual(array(xmlParser.parse(body).urlset.url).map(entry=>entry.loc).sort(),expectedUrls);
});
await check('Robots and legacy sitemap index point at runtime canonical sitemap',async()=>{
	const robots=await get('/robots.txt');assert.equal(robots.response.status,200);
	assert.match(robots.body,/^Sitemap: https:\/\/deepankerseth\.com\/sitemap\.xml$/m);
	const index=await get('/sitemap-index.xml');assert.equal(index.response.status,200);
	assert.equal(XMLValidator.validate(index.body),true);
	assert.deepEqual(array(xmlParser.parse(index.body).sitemapindex.sitemap).map(entry=>entry.loc),['https://deepankerseth.com/sitemap.xml']);
	const obsolete=await get('/sitemap-0.xml');
	assert.equal(obsolete.response.status,404,'Old generated sitemap must not survive the clean release build');
});
await check('RSS contains original canonical-origin entries and stable GUIDs only',async()=>{
	const{response,body}=await get('/rss.xml');assert.equal(response.status,200);
	assert.equal(XMLValidator.validate(body),true);
	const items=array(xmlParser.parse(body).rss.channel.item);
	assert.equal(items.length,4);
	assert.deepEqual(items.map(item=>urlPath(item.link)).sort(),articles.map(([,slug])=>`/writing/${slug}`).sort());
	for(const item of items){assert.equal(new URL(item.link).origin,'https://deepankerseth.com');assert.equal(item.guid,item.link);assert.ok(item.link.endsWith('/'),'Existing feed GUID slash changed');}
});
for(const path of ['/writing/qa-no-such-essay','/classic/writing/qa-no-such-essay','/qa-no-such-page'])await check(`Missing route is404 and noindex: ${path}`,async()=>{
	const{response,body}=await get(path);assert.equal(response.status,404);
	const all=elements(fromHtml(body));
	assert.ok(noindex(all)||response.headers.get('x-robots-tag')?.includes('noindex'),'Missing noindex policy on404');
	assert.ok(all.find(node=>node.tagName==='title')&&all.find(node=>node.tagName==='h1'),'404 must be a readable HTML document');
	assert.ok(all.some(node=>node.tagName==='a'&&node.properties.href==='/writing'),'404 must retain a native route to the writing');
	assert.ok(!all.some(node=>node.tagName==='a'&&node.properties.href==='/writing'&&Object.hasOwn(node.properties,'dataContents')),'404 must not intercept navigation with an empty Contents dialog');
});
await check('Unauthenticated editor API rejects access privately',async()=>{
	const{response}=await get('/api/editor/posts');assert.equal(response.status,401);
	assert.equal(response.headers.get('cache-control'),'private, no-store');
});
if(opts['--auth-vars']){
	const vars=await readFile(resolve(root,opts['--auth-vars']),'utf8');
	const found=vars.match(/^\s*JWT_SECRET\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#\r\n]*))/m);
	const secret=found&&(found[1]??found[2]??found[3]).trim();
	assert.ok(secret,'A local JWT_SECRET is required in the explicitly selected vars file');
	const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
	const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:'admin',exp:Math.floor(Date.now()/1000)+300})}`;
	const cookie=`admin_token=${token}.${createHmac('sha256',secret).update(token).digest('base64url')}`;
	const paths=['/admin/preview',...(opts['--private-id']?[`/admin/posts/${encodeURIComponent(opts['--private-id'])}/preview`]:[])];
	for(const path of paths)await check(`Private preview metadata and hooks: ${path}`,async()=>{
		const{response,body}=await get(path,cookie);assert.equal(response.status,200);
		assert.equal(response.headers.get('cache-control'),'private, no-store');
		const all=elements(fromHtml(body));assert.ok(noindex(all));
		for(const key of ['dataPreviewTitle','dataPreviewMinutes','dataEssayProse'])assert.ok(all.some(node=>Object.hasOwn(node.properties,key)),`Missing ${key}`);
	});
	evidence.privatePreviewAuthenticated=true;
}else evidence.privatePreviewAuthenticated=false;
evidence.passed=evidence.errors.length===0;
await mkdir(dirname(reportPath),{recursive:true});
await writeFile(reportPath,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({passed:evidence.passed,checks:evidence.checks.length,errors:evidence.errors,report:opts['--report']},null,2));
if(!evidence.passed)process.exitCode=1;
