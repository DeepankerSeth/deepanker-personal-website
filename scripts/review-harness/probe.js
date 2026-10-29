/* Test-only observer. It never drives the page or changes an app setting. */
(() => {
'use strict';
const script=document.currentScript;
let config;try{config=JSON.parse(atob(script.dataset.reviewConfig))}catch{return}
const started=performance.now(),initialVisibility=document.visibilityState;
const observed={},unsupported=[],errors=[],resourceErrors=[],resources=[],shiftEvents=[],longTasks=[],events=[],pointerEvents=[],visibility=[];
const observers=[];let frozen=false,snapshot=null,lastResource=started,fontsReadyAt=null;
let lcp=null,fcp=null,cls=0,windowScore=0,windowStart=0,lastShift=0,ignoredRecentInput=0;
const round=value=>Number.isFinite(value)?Math.round(value*1000)/1000:null;
const safeUrl=value=>{if(!value)return null;try{const url=new URL(value,location.href);return url.origin===location.origin?url.pathname+url.search:url.origin+url.pathname}catch{return String(value)}};
const targetName=node=>{if(!(node instanceof Element))return null;return node.id?'#'+node.id:node.tagName.toLowerCase()+(node.classList.length?'.'+[...node.classList].slice(0,3).join('.'):'')};
const own=node=>node instanceof Element&&Boolean(node.closest('#review-probe-report,#review-probe-button'));
const observe=(type,callback,extra={})=>{
 if(typeof PerformanceObserver==='undefined'||!PerformanceObserver.supportedEntryTypes?.includes(type)){unsupported.push(type);return}
 try{const observer=new PerformanceObserver((list,observer,options)=>{if(options?.droppedEntriesCount)observed[type+'DroppedEntries']=(observed[type+'DroppedEntries']||0)+options.droppedEntriesCount;if(!frozen)callback(list.getEntries())});observer.observe({type,buffered:true,...extra});observers.push(observer);observed[type]=true}catch(error){unsupported.push(type+': '+error.message)}
};
performance.setResourceTimingBufferSize?.(3000);
observe('paint',entries=>{for(const entry of entries)if(entry.name==='first-contentful-paint')fcp=entry.startTime});
observe('largest-contentful-paint',entries=>{for(const entry of entries){if(own(entry.element))continue;lcp={startTime:round(entry.startTime),renderTime:round(entry.renderTime),loadTime:round(entry.loadTime),size:entry.size,element:targetName(entry.element),url:safeUrl(entry.url)}}});
observe('layout-shift',entries=>{for(const entry of entries){
 const sources=(entry.sources||[]).map(source=>({node:targetName(source.node),previousRect:{x:round(source.previousRect.x),y:round(source.previousRect.y),width:round(source.previousRect.width),height:round(source.previousRect.height)},currentRect:{x:round(source.currentRect.x),y:round(source.currentRect.y),width:round(source.currentRect.width),height:round(source.currentRect.height)}}));
 if((entry.sources||[]).some(source=>own(source.node)))continue;
 shiftEvents.push({startTime:round(entry.startTime),value:round(entry.value),hadRecentInput:entry.hadRecentInput,sources});
 if(entry.hadRecentInput){ignoredRecentInput++;continue}
 if(windowScore&&entry.startTime-lastShift<1000&&entry.startTime-windowStart<5000)windowScore+=entry.value;
 else{windowScore=entry.value;windowStart=entry.startTime}
 lastShift=entry.startTime;cls=Math.max(cls,windowScore);
}});
observe('resource',entries=>{for(const entry of entries){if(entry.name.includes('/__review/'))continue;lastResource=performance.now();resources.push({url:safeUrl(entry.name),initiatorType:entry.initiatorType,startTime:round(entry.startTime),duration:round(entry.duration),responseStart:round(entry.responseStart),responseEnd:round(entry.responseEnd),transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize,responseStatus:entry.responseStatus??null,deliveryType:entry.deliveryType??null})}});
observe('longtask',entries=>{for(const entry of entries)longTasks.push({startTime:round(entry.startTime),duration:round(entry.duration),name:entry.name})});
observe('event',entries=>{for(const entry of entries){if(own(entry.target))continue;events.push({name:entry.name,interactionId:entry.interactionId,startTime:round(entry.startTime),duration:round(entry.duration),inputDelay:round(entry.processingStart-entry.startTime),processingTime:round(entry.processingEnd-entry.processingStart),target:targetName(entry.target)})}},{durationThreshold:16});
addEventListener('pointerdown',event=>{if(!frozen&&!own(event.target))pointerEvents.push({at:round(performance.now()),pointerType:event.pointerType,isTrusted:event.isTrusted,target:targetName(event.target)})},{capture:true,passive:true});
addEventListener('visibilitychange',()=>{if(!frozen)visibility.push({at:round(performance.now()),state:document.visibilityState})});
addEventListener('error',event=>{if(frozen)return;if(event.target!==window){const target=event.target;resourceErrors.push({at:round(performance.now()),tag:target?.tagName,url:safeUrl(target?.src||target?.href?.baseVal||target?.href||target?.getAttribute?.('href'))});return}errors.push({at:round(performance.now()),message:event.message,file:safeUrl(event.filename),line:event.lineno,column:event.colno})},true);
addEventListener('unhandledrejection',event=>{if(!frozen)errors.push({at:round(performance.now()),message:'Unhandled rejection: '+String(event.reason?.message||event.reason)})});
const fontFailures=[];
document.fonts?.addEventListener('loadingerror',event=>{if(!frozen)fontFailures.push(...[...event.fontfaces].map(font=>({family:font.family,style:font.style,weight:font.weight,status:font.status}))) });
// At head-start document.fonts.ready may resolve before any stylesheet has
// registered a face. Observe readiness only after parsing, and later font loads
// separately through loadingdone; fontStatus remains the authoritative state.
const observeFontReadiness=()=>document.fonts?.ready.then(()=>{if(!frozen)fontsReadyAt=performance.now()});
document.fonts?.addEventListener('loadingdone',()=>{if(!frozen)fontsReadyAt=performance.now()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observeFontReadiness,{once:true});else observeFontReadiness();
const navigation=()=>{const entry=performance.getEntriesByType('navigation')[0];if(!entry)return null;return{type:entry.type,requestStart:round(entry.requestStart),responseStart:round(entry.responseStart),responseEnd:round(entry.responseEnd),domInteractive:round(entry.domInteractive),domContentLoaded:round(entry.domContentLoadedEventEnd),loadEventEnd:round(entry.loadEventEnd),transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,decodedBodySize:entry.decodedBodySize}};
const capture=()=>({
 schema:'local-review-probe/v1',recordedAt:new Date().toISOString(),...config,
 url:location.href,timeOrigin:performance.timeOrigin,probeStartedAt:round(started),measurementStoppedAt:round(performance.now()),initialVisibility,visibilityTransitions:visibility,
 environment:{userAgent:navigator.userAgent,innerWidth,innerHeight,outerWidth,outerHeight,devicePixelRatio,visualViewport:window.visualViewport?{width:round(visualViewport.width),height:round(visualViewport.height),scale:visualViewport.scale}:null,maxTouchPoints:navigator.maxTouchPoints,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,coarsePointer:matchMedia('(pointer: coarse)').matches,hover:matchMedia('(hover: hover)').matches,observedPointerEvents:pointerEvents.slice(-30),horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)},
 metrics:{fcpMs:round(fcp),lcp,cls:observed['layout-shift']?round(cls):null,clsMethod:'maximum session window, <1000ms gap, <5000ms duration; excludes hadRecentInput',ignoredRecentInputShifts:ignoredRecentInput,navigation:navigation(),fontsReadyMs:round(fontsReadyAt),longTaskCount:longTasks.length,longestTaskMs:longTasks.length?Math.max(...longTasks.map(task=>task.duration)):null,observedEventCount:events.length,maxObservedEventDurationMs:events.length?Math.max(...events.map(event=>event.duration)):null},
 fontStatus:[...(document.fonts||[])].map(font=>({family:font.family,style:font.style,weight:font.weight,status:font.status})),fontFailures,
 timingSupport:observed,unsupportedTimingTypes:unsupported,
 layoutShifts:shiftEvents.slice(-60),longTasks:longTasks.slice(-30),slowEvents:[...events].sort((a,b)=>b.duration-a.duration).slice(0,20),resourceErrors,runtimeErrors:errors,resources,
 limitations:[
  'Local lab observation with injected instrumentation, not field Core Web Vitals, a Lighthouse score, or production performance proof.',
  'Declared build kind is operator supplied. A detected Vite client forces effectiveBuildKind=development.',
  'Event durations are observed samples, not an INP calculation. No CPU or bandwidth throttling is claimed.',
  'The proxy injects resource latency or HTTP503; this is not a real offline network or mobile radio.',
  'Browser zoom is not inferred from CSS or DPR. Verify actual browser zoom separately. Pointer and media flags are observed, never mocked.',
  'Resource transferSize=0 alone does not prove cache use; consult the proxy request log. The proxy sends no-store and omits request cache validators.',
  'The measurement stops before the diagnostic dialog opens. Reload for another independent measurement.',
  'If automaticReport=true, the test-only URL flag opened this report after resource quiet. That path measures loading only and establishes no user-interaction result.',
  'In development, HMR WebSockets are not proxied and local dev module processing can dominate timings.'
 ]
});
let button,dialog,reportOpening=false;
const accessibilityAudit=async()=>{
 const auditStarted=performance.now();
 try{
  if(!config.axe)throw new Error('The local axe-core library is unavailable.');
  if(!window.axe)await new Promise((resolve,reject)=>{const library=document.createElement('script');library.src='/__review/axe.min.js';library.onload=resolve;library.onerror=()=>reject(new Error('The local axe-core script failed to load.'));document.head.append(library)});
  const labelDiagnostics=[];
  window.axe.configure({checks:[{id:'review-label-diagnostic',evaluate(node){
   if(!node.getClientRects().length)return true;
   const entry={element:targetName(node),href:node.getAttribute('href'),ariaLabel:node.getAttribute('aria-label'),innerText:node.innerText,textContent:node.textContent};
   try{entry.accessibleText=window.axe.commons.text.accessibleText(node);entry.axeVisibleText=window.axe.commons.text.visibleVirtual(node,false,false,{ignoreIconLigature:true});}catch(error){entry.diagnosticError=error.message}
   labelDiagnostics.push(entry);return true;
  }}],rules:[{id:'review-label-diagnostic',selector:'.title-link,.art-open,.next-piece',any:['review-label-diagnostic'],enabled:true,tags:['review-diagnostic']}]});
  // Audit the real current product DOM before opening our own modal. Only the
  // observation tool's UI is excluded; no application rule or node is suppressed.
  const result=await window.axe.run({exclude:[['#review-probe-button'],['#review-probe-report']]},{});
  const trim=rule=>({id:rule.id,impact:rule.impact,description:rule.description,help:rule.help,helpUrl:rule.helpUrl,tags:rule.tags,nodes:rule.nodes.map(node=>({target:node.target,html:node.html,impact:node.impact,failureSummary:node.failureSummary,any:node.any,all:node.all,none:node.none}))});
  return{status:'completed',durationMs:round(performance.now()-auditStarted),testEngine:result.testEngine,testEnvironment:result.testEnvironment,timestamp:result.timestamp,url:result.url,toolOptions:result.toolOptions,excludedSelectors:['#review-probe-button','#review-probe-report'],labelDiagnostics,violations:result.violations.map(trim),incomplete:result.incomplete.map(trim),passes:result.passes.filter(rule=>rule.id!=='review-label-diagnostic').map(rule=>({id:rule.id,nodeCount:rule.nodes.length})),inapplicable:result.inapplicable.filter(rule=>rule.id!=='review-label-diagnostic').map(rule=>rule.id),limitations:['Automated rendered-DOM audit, not a keyboard, touch, screen-reader, motion or complete accessibility certification.','Incomplete results require manual review; zero reported violations is not universal conformance.','The loading measurement was frozen before loading and running axe; axe execution is excluded from those timing samples.','A fixture-only always-passing diagnostic check records the exact accessible/visible label strings during the real axe tree lifecycle. It does not disable or modify any existing rule and is omitted from pass totals.']};
 }catch(error){return{status:'error',message:error.message,durationMs:round(performance.now()-auditStarted)}}
};
const openReport=async()=>{
 if(reportOpening||dialog?.open)return;reportOpening=true;
 if(!snapshot){snapshot=capture();frozen=true;observers.forEach(observer=>observer.disconnect());
  if(config.accessibilityMode)snapshot.accessibilityAudit=await accessibilityAudit();
  try{const response=await fetch('/__review/requests?since='+Math.floor(performance.timeOrigin),{cache:'no-store'});const evidence=await response.json();snapshot.proxyRequests=evidence.requests;snapshot.verifiedInjectedFaults=evidence.requests.filter(row=>row.fault)}catch(error){snapshot.proxyLogError=error.message}
 }
 if(!dialog){dialog=document.createElement('dialog');dialog.id='review-probe-report';dialog.setAttribute('aria-labelledby','review-probe-title');
  const title=document.createElement('h2');title.id='review-probe-title';title.textContent='Local review diagnostics';
  const summary=document.createElement('p');summary.textContent=`${config.profile} · ${snapshot.effectiveBuildKind} build · measurement frozen before this panel. FCP ${snapshot.metrics.fcpMs??'unsupported'}ms; LCP ${snapshot.metrics.lcp?.startTime??'unsupported'}ms; CLS ${snapshot.metrics.cls??'unsupported'}.`+(snapshot.accessibilityAudit?` Accessibility audit: ${snapshot.accessibilityAudit.status}; ${snapshot.accessibilityAudit.violations?.length??'unknown'} violations; ${snapshot.accessibilityAudit.incomplete?.length??'unknown'} checks need review.`:'');
  const close=document.createElement('button');close.textContent='Close report';close.addEventListener('click',()=>dialog.close());
  const download=document.createElement('button');download.textContent='Download JSON evidence';download.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(snapshot,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`review-${config.profile}-${location.pathname.replace(/[^a-z0-9]+/gi,'-')}-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
  const pre=document.createElement('pre');pre.id='review-probe-json';pre.textContent=JSON.stringify(snapshot,null,2);
  dialog.append(title,summary,close,download,pre);document.body.append(dialog);dialog.addEventListener('close',()=>button.focus({preventScroll:true}));
 }
 dialog.showModal();dialog.querySelector('button').focus({preventScroll:true});reportOpening=false;
};
if(config.accessibilityMode==='manual')addEventListener('keydown',event=>{if(event.altKey&&event.shiftKey&&event.code==='KeyA'){event.preventDefault();openReport()}},true);
const mount=()=>{if(button||!document.body)return;button=document.createElement('button');button.id='review-probe-button';button.type='button';button.textContent='QA report';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label','Open local review diagnostics');button.addEventListener('click',openReport);document.body.append(button)};
// Only the small fixed trigger appears after settling. No automatic modal or
// in-flow UI can itself push the writing or invalidate the initial CLS reading.
const settle=setInterval(()=>{if((document.readyState==='complete'&&performance.now()-lastResource>650)||(performance.now()-started>12000)){clearInterval(settle);mount();if(config.automaticReport)openReport()}},250);
})();
