#!/usr/bin/env node
// Explicitly authorized local-only regression for queued native dialog close events.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {sourceFingerprints as fingerprint} from './source-fingerprint.mjs';
import {chromium} from 'playwright';
if(!process.argv.includes('--authorized-local-browser-review'))throw Error('Add --authorized-local-browser-review to acknowledge the authorized local-only review.');
const origin='http://127.0.0.1:4194';
const requestedOut=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
const out=requestedOut?path.resolve(requestedOut):await fs.mkdtemp(path.join(tmpdir(),'deepanker-final-dialog-lifecycle-'));
assert.ok([tmpdir(),'/tmp','/private/tmp'].some(base=>{const relative=path.relative(base,out);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)}),'Use a fresh private temporary output directory');
if(requestedOut)await fs.mkdir(out,{recursive:false,mode:0o700});
const report={startedAt:new Date().toISOString(),sourceBefore:await fingerprint(),scope:'Trusted keyboard against local built website, fresh Chromium contexts. Read-only event observers record queued native close ordering; no behavior injection. Emulated viewport, not physical-device or human speed.',cases:[]};
const browser=await chromium.launch({headless:true});report.browser=browser.version();
try{
 for(const kind of ['contents','art'])for(let trial=0;trial<36;trial++){
  const row={kind,trial,status:'running',errors:[],blocked:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:768,height:1024},recordVideo:trial<2?{dir:out+'/video'}:undefined});
  await context.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();row.blocked.push(r.url());return route.abort()});
  const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));page.setDefaultTimeout(8000);
  try{
   await page.goto(origin+(kind==='contents'?'/writing/meditations':'/'));await page.waitForFunction(()=>document.documentElement?.classList.contains('js')&&document.fonts?.status==='loaded');
   await page.evaluate(()=>{window.__dialogCloseTrace=[];document.addEventListener('close',e=>{if(e.target.matches('dialog'))window.__dialogCloseTrace.push({at:performance.now(),dialog:e.target.className,open:e.target.open,overflow:document.body.style.overflow,query:document.querySelector('#contents-query')?.value})},true)});
   row.before=await page.evaluate(()=>({overflow:document.body.style.overflow,scrollY}));
   let opener,dialog;
   if(kind==='contents'){
    opener=page.locator('.reading-rail [data-contents]');dialog=page.locator('.contents');await opener.click();await page.keyboard.press('Tab');await page.keyboard.type('gory');await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(250);await page.keyboard.press('Escape');
    assert.equal(await page.locator('#contents-query').inputValue(),'');await page.keyboard.press('Escape');
    // Deliberately immediate: native focus restoration can precede the queued close event.
    await page.keyboard.press('Enter');await page.keyboard.press('Tab');await page.keyboard.type('gory');await page.keyboard.press('Tab');
    assert.equal(await page.locator('#contents-query').inputValue(),'gory');assert.ok(await page.locator('.contents a[href="/writing/war"]').evaluate(n=>document.activeElement===n));assert.equal(await page.locator('.contents li:not([hidden])').count(),1);
   }else{
    const i=trial%4;await page.locator(`[data-preview="${i}"]`).click();opener=page.locator(`[data-passage="${i}"] [data-look]`);dialog=page.locator('.art-dialog');await opener.focus();row.before=await page.evaluate(()=>({overflow:document.body.style.overflow,scrollY}));await page.keyboard.press('Enter');
    const study=dialog.locator('section:not([hidden]) [data-study-detail]');await study.click();assert.equal(await study.getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');await page.keyboard.press('Enter');
    assert.ok(await dialog.evaluate(n=>n.open));assert.equal(await study.getAttribute('aria-pressed'),'false');assert.equal(await dialog.evaluate(n=>n.scrollTop),0);
    await study.press('Enter');await page.waitForTimeout(40);assert.equal(await study.getAttribute('aria-pressed'),'true','A delayed old close reset the reopened study');
   }
   assert.ok(await dialog.evaluate(n=>n.open));assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','Reopened dialog lost outer-page scroll lock');
   if(trial<2)await page.screenshot({path:path.join(out,kind+'-'+trial+'-reopened.png')});
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForFunction(expected=>document.body.style.overflow===expected,row.before.overflow);
   assert.ok(await opener.evaluate(n=>n===document.activeElement));row.after=await page.evaluate(()=>({overflow:document.body.style.overflow,scrollY,trace:window.__dialogCloseTrace}));assert.equal(row.after.overflow,row.before.overflow);assert.ok(Math.abs(row.after.scrollY-row.before.scrollY)<=1,'Outer page did not return to its original scroll');assert.deepEqual(row.errors,[]);assert.deepEqual(row.blocked,[]);row.status='passed';
  }catch(error){row.status='failed';row.error=String(error);await page.screenshot({path:path.join(out,kind+'-'+trial+'-failed.png')}).catch(()=>{});row.trace=await page.evaluate(()=>window.__dialogCloseTrace).catch(()=>null)}
  finally{await context.close();if(page.video())row.video=await page.video().path();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2))}
 }
}finally{report.sourceAfter=await fingerprint();report.sourceUnchanged=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);report.finishedAt=new Date().toISOString();report.summary={passed:report.cases.filter(c=>c.status==='passed').length,failed:report.cases.filter(c=>c.status==='failed').length,staleCloseEventsObserved:report.cases.flatMap(c=>c.after?.trace||[]).filter(e=>e.open).length};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({out,...report.summary,sourceUnchanged:report.sourceUnchanged}));process.exitCode=!report.sourceUnchanged||report.summary.failed?1:0}
