#!/usr/bin/env node
/** HTTP assertions only; this does not launch or drive a browser. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
const base=Number(arg('--base-port','4290')),results=[];
let appScript;
async function check(name,fn){const started=performance.now();await fn();results.push({name,passed:true,durationMs:Math.round(performance.now()-started)})}
const get=(offset,path,options={})=>fetch(`http://127.0.0.1:${base+offset}${path}`,{redirect:'manual',...options});
await check('control serves the actual app and identifies diagnostics',async()=>{const response=await get(0,'/');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store, max-age=0');const html=await response.text();assert.match(html,/Meditations/);assert.match(html,/The Hidden War/);assert.match(html,/\/__review\/probe\.js/);const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match=>new URL(match[1],`http://127.0.0.1:${base}`));appScript=scripts.find(url=>url.origin===`http://127.0.0.1:${base}`&&!url.pathname.startsWith('/__review/')&&(/\/_astro\/.+\.js$/.test(url.pathname)||url.pathname.startsWith('/src/site/')));assert.ok(appScript,'The actual HTML must expose a local application script');assert.match(response.headers.get('x-review-original-html-sha256'),/^[a-f0-9]{64}$/)});
await check('private and arbitrary source routes refused',async()=>{for(const path of['/admin','/admin/preview','/api/editor/posts','/src/lib/db.ts','/.dev.vars','/literary/%2e%2e/%2e%2e/.dev.vars'])assert.ok([400,403].includes((await get(0,path)).status),path)});
await check('write methods refused before forwarding',async()=>{for(const method of['POST','PUT','DELETE','PATCH'])assert.equal((await get(0,'/',{method})).status,405)});
await check('font failure is an explicit503',async()=>{const response=await get(2,'/literary/fonts/newsreader-regular.woff2');assert.equal(response.status,503);assert.equal(response.headers.get('x-review-fault'),'fonts-fail')});
await check('large-art failure leaves the320px base intact',async()=>{assert.equal((await get(3,'/literary/art/material/meditations-960.webp')).status,503);assert.equal((await get(3,'/literary/art/material/meditations-1536.webp')).status,503);const response=await get(3,'/literary/art/material/meditations-320.webp');assert.equal(response.status,200);assert.ok((await response.arrayBuffer()).byteLength>1000)});
await check('all-art profile also fails320px',async()=>assert.equal((await get(4,'/literary/art/material/meditations-320.webp')).status,503));
await check('app-script fails while diagnostic remains available',async()=>{assert.equal((await get(5,appScript.pathname+appScript.search)).status,503);assert.equal((await get(5,'/__review/probe.js')).status,200)});
await check('slow font response has measured minimum delay',async()=>{const start=performance.now(),response=await get(1,'/literary/fonts/newsreader-regular.woff2');await response.arrayBuffer();assert.equal(response.status,200);assert.ok(performance.now()-start>=2450)});
await check('HEAD returns status/headers without body',async()=>{const response=await get(0,'/literary/fonts.css',{method:'HEAD'});assert.equal(response.status,200);assert.equal(await response.text(),'')});
await check('injected failures have exact request evidence',async()=>{const response=await get(3,'/__review/requests');const data=await response.json();assert.ok(data.requests.some(row=>row.path==='/literary/art/material/meditations-960.webp'&&row.status===503&&row.fault==='injected-resource-failure'))});
const report={recordedAt:new Date().toISOString(),scope:'HTTP fixture contracts only; browser behavior and performance not tested here',passed:results.length,results};
const out=arg('--out',null);if(out)await writeFile(out,JSON.stringify(report,null,2)+'\n');
process.stdout.write(JSON.stringify(report,null,2)+'\n');
