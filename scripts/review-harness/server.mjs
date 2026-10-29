#!/usr/bin/env node
/** Local public-read-only fault fixture. Never imported by Astro or deployed. */
import http from 'node:http';
import {createRequire} from 'node:module';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync, brotliDecompressSync, inflateSync } from 'node:zlib';

const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../..');
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
const basePort=Number(arg('--base-port','4290'));
const declaredBuildKind=arg('--build-kind','development');
if(!Number.isInteger(basePort)||basePort<1024||basePort>65529)throw new Error('Invalid base port');
if(!['development','production','unknown'].includes(declaredBuildKind))throw new Error('Invalid build kind');
const upstream='http://127.0.0.1:4194'; // Deliberately not configurable: never proxy production.
const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const output=resolve(arg('--out',join(tmpdir(),'deepanker-review-harness')),runId);
await mkdir(output,{recursive:true,mode:0o700});
const profiles=[
 {name:'control',description:'No injected resource faults.'},
 {name:'slow-media',description:'Every font and material image response waits2500ms.',delay:2500},
 {name:'fonts-fail',description:'All local font files return503.'},
 {name:'large-art-fail',description:'960/1536px material images return503;320px images remain available.'},
 {name:'all-art-fail',description:'All material images return503.'},
 {name:'app-js-fail',description:'Application JavaScript returns503; the diagnostic probe still runs.'},
];
const sha=value=>createHash('sha256').update(value).digest('hex');
const probe=await readFile(resolve(here,'probe.js'));
const probeCSS=await readFile(resolve(here,'probe.css'));
let axe=null,axeMetadata=null;
try{const axePath=dirname(createRequire(import.meta.url).resolve('axe-core/package.json'));axe=await readFile(resolve(axePath,'axe.min.js'));const pkg=JSON.parse(await readFile(resolve(axePath,'package.json'),'utf8'));axeMetadata={version:pkg.version,license:pkg.license,sha256:sha(axe)}}catch{}
const requests=[];let writeQueue=Promise.resolve();
const record=entry=>{const row={at:new Date().toISOString(),...entry};requests.push(row);if(requests.length>4000)requests.shift();writeQueue=writeQueue.then(()=>appendFile(resolve(output,'requests.jsonl'),JSON.stringify(row)+'\n')).catch(error=>process.stderr.write('Log write failed: '+error.message+'\n'));};
const safePath=pathname=>{try{const path=decodeURIComponent(pathname);return !path.includes('\\')&&!path.includes('\0')&&!path.split('/').includes('..')?path:null}catch{return null}};
const publicPath=(path,url)=>{
 if(path==='/'||path==='/writing'||/^\/writing\/[a-zA-Z0-9_%\-]+\/?$/.test(path))return true;
 if(/^\/(?:literary|_astro)\//.test(path))return true;
 if(['/favicon.svg','/rss.xml','/robots.txt','/sitemap.xml','/sitemap-index.xml'].includes(path))return true;
 // When explicitly reviewing an Astro development server, these are its public
 // client modules, not a general /src or /@fs pass-through.
 if(declaredBuildKind!=='production'){
  if(path==='/@vite/client'||path==='/@vite/env')return true;
  if(path==='/src/site/layouts/BaseLayout.astro'&&url.searchParams.has('astro')&&url.searchParams.get('type')==='script')return true;
  if(/^\/src\/site\/literary\/(?:site\.js|material-motion\.js|reading-enhancement\.ts|styles\/[a-z-]+\.css)$/.test(path))return true;
  if(path.startsWith('/node_modules/.vite/deps/'))return true;
  if(path.startsWith('/@fs/'+repo+'/node_modules/vite/dist/client/'))return true;
  if(path.startsWith('/@fs/'+repo+'/node_modules/astro/dist/runtime/client/'))return true;
  if(/^\/@id\/(?:__x00__)?astro:scripts\//.test(path))return true;
 }
 return false;
};
const response=(res,status,body,type='text/plain; charset=utf-8',head=false,extra={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store, max-age=0','x-review-harness':'local-only','x-content-type-options':'nosniff',...extra});res.end(head?undefined:body)};
const font=path=>/\.(woff2?|ttf|otf)$/.test(path);
const art=path=>/^\/literary\/art\/material\/.+\.webp$/.test(path);
const js=(path,url)=>/\.(?:m?js|ts)$/.test(path)||path==='/@vite/client'||path.startsWith('/@id/')||(path.endsWith('.astro')&&url.searchParams.get('type')==='script');
const faultFor=(profile,path,url)=>{
 if(profile.name==='slow-media'&&(font(path)||art(path)))return {delay:2500};
 if(profile.name==='fonts-fail'&&font(path))return {status:503};
 if(profile.name==='large-art-fail'&&art(path)&&/-(?:960|1536)\.webp$/.test(path))return {status:503};
 if(profile.name==='all-art-fail'&&art(path))return {status:503};
 if(profile.name==='app-js-fail'&&js(path,url))return {status:503};
 return {};
};
const fetchUpstream=(path,method)=>new Promise((resolveRequest,reject)=>{
 const request=http.request(upstream+path,{method,headers:{accept:'*/*','accept-encoding':'identity','cache-control':'no-cache'}},upstreamResponse=>{
  const parts=[];let bytes=0;
  upstreamResponse.on('data',chunk=>{bytes+=chunk.length;if(bytes>16*1024*1024){request.destroy(new Error('Response exceeds16MiB limit'));return}parts.push(chunk)});
  upstreamResponse.on('end',()=>resolveRequest({status:upstreamResponse.statusCode,headers:upstreamResponse.headers,body:Buffer.concat(parts)}));
 });request.on('error',reject);request.setTimeout(20000,()=>request.destroy(new Error('Local upstream timed out')));request.end();
});
const servers=profiles.map((profile,index)=>{
 const port=basePort+index;
 const server=http.createServer(async(req,res)=>{
  const started=Date.now(),url=new URL(req.url||'/',`http://127.0.0.1:${port}`),path=safePath(url.pathname),head=req.method==='HEAD';
  const log=(status,details={})=>record({profile:profile.name,port,method:req.method,path:url.pathname,query:path?.startsWith('/__review/')?'':url.search,status,durationMs:Date.now()-started,...details});
  if(!['GET','HEAD'].includes(req.method)){log(405,{reason:'read-only'});return response(res,405,'Only GET and HEAD are allowed.','text/plain',head,{allow:'GET, HEAD'})}
  if(!path){log(400,{reason:'invalid-path'});return response(res,400,'Invalid path.','text/plain',head)}
  if(path==='/__review/probe.js')return response(res,200,probe,'text/javascript; charset=utf-8',head);
  if(path==='/__review/probe.css')return response(res,200,probeCSS,'text/css; charset=utf-8',head);
  if(path==='/__review/axe.min.js')return axe?response(res,200,axe,'text/javascript; charset=utf-8',head):response(res,404,'Local axe-core test library is unavailable.','text/plain',head);
  if(path==='/__review/requests'){
   const since=Number(url.searchParams.get('since')||0);
   const rows=requests.filter(row=>row.profile===profile.name&&Date.parse(row.at)>=since);
   return response(res,200,JSON.stringify({runId,profile:profile.name,requests:rows}),'application/json',head);
  }
  if(path==='/__review/config')return response(res,200,JSON.stringify({runId,upstream,profile,declaredBuildKind,output,ports:profiles.map((p,i)=>({name:p.name,url:`http://127.0.0.1:${basePort+i}/`}))}),'application/json',head);
  if(!publicPath(path,url)){log(403,{reason:'outside-public-allowlist'});return response(res,403,'This local harness only forwards published public pages and their assets.','text/plain',head)}
  const fault=faultFor(profile,path,url);
  if(fault.status){log(fault.status,{fault:'injected-resource-failure'});return response(res,fault.status,'Deliberate local review fault: '+profile.name,'text/plain',head,{'x-review-fault':profile.name})}
  try{
   // A test-only report trigger must never reach the real application's router.
   const upstreamURL=new URL(url);upstreamURL.searchParams.delete('__review_report');upstreamURL.searchParams.delete('__review_a11y');
   const result=await fetchUpstream(upstreamURL.pathname+upstreamURL.search,req.method);
   if(fault.delay)await new Promise(done=>setTimeout(done,fault.delay));
   if(res.destroyed){log(499,{fault:fault.delay?'delayed-client-disconnected':null});return}
   const headers={...result.headers};
   for(const key of['connection','transfer-encoding','content-length','etag','last-modified','set-cookie','content-encoding','keep-alive'])delete headers[key];
   headers['cache-control']='no-store, max-age=0';headers.pragma='no-cache';headers['x-review-harness']='local-only';headers['x-review-profile']=profile.name;
   if(headers.location){const destination=new URL(headers.location,upstream);if(destination.origin!==upstream){log(502,{reason:'external-redirect-refused'});return response(res,502,'External redirect refused.','text/plain',head)}headers.location=destination.pathname+destination.search+destination.hash}
   let body=result.body;
   if(!head){const encoding=result.headers['content-encoding'];if(encoding==='gzip')body=gunzipSync(body);else if(encoding==='br')body=brotliDecompressSync(body);else if(encoding==='deflate')body=inflateSync(body)}
   let instrumented=false,htmlSHA=null,detectedDevelopment=false;
   if(!head&&String(headers['content-type']).includes('text/html')){
    const html=body.toString('utf8');htmlSHA=sha(body);detectedDevelopment=html.includes('/@vite/client');
    const hasCSP=Boolean(headers['content-security-policy'])||/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy/i.test(html);
    if(hasCSP){headers['x-review-probe']='omitted-existing-csp';}
    else if(/<head(?:\s[^>]*)?>/i.test(html)){
     const accessibilityMode=url.searchParams.get('__review_a11y')==='1'?'automatic':url.searchParams.get('__review_a11y')==='manual'?'manual':null;
     const config=Buffer.from(JSON.stringify({runId,profile:profile.name,description:profile.description,upstream,declaredBuildKind,effectiveBuildKind:detectedDevelopment?'development':declaredBuildKind,htmlSHA,probeSHA:sha(probe),requestStarted:started,automaticReport:url.searchParams.get('__review_report')==='1'||accessibilityMode==='automatic',accessibilityMode,axe:accessibilityMode?axeMetadata:null})).toString('base64');
     body=Buffer.from(html.replace(/<head(?:\s[^>]*)?>/i,match=>match+`<script src="/__review/probe.js" data-review-config="${config}"></script><link rel="stylesheet" href="/__review/probe.css">`));instrumented=true;headers['x-review-probe']='injected';
    }
    headers['x-review-original-html-sha256']=htmlSHA;
   }
   log(result.status,{fault:fault.delay?'delayed-resource':null,delayMs:fault.delay||0,bytes:body.length,instrumented,htmlSHA,detectedDevelopment});
   res.writeHead(result.status,headers);res.end(head?undefined:body);
  }catch(error){log(502,{reason:'upstream-error',message:error.message});response(res,502,'Local upstream unavailable: '+error.message,'text/plain',head)}
 });server.listen(port,'127.0.0.1',()=>process.stdout.write(`${profile.name}: http://127.0.0.1:${port}/\n`));return server;
});
await appendFile(resolve(output,'manifest.json'),JSON.stringify({runId,upstream,declaredBuildKind,profiles:profiles.map((profile,i)=>({...profile,port:basePort+i})),probeSHA:sha(probe),axe:axeMetadata},null,2)+'\n');
process.stdout.write('Read-only localhost review harness. Request evidence: '+output+'\n');
const close=()=>{servers.forEach(server=>server.close());writeQueue.finally(()=>process.exit(0));};
process.on('SIGINT',close);process.on('SIGTERM',close);
