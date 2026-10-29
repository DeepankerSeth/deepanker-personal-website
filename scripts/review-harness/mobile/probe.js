/* Isolated QA only. No synthesized input; no product state is changed except
   the explicit storage-denied profile, installed before application scripts. */
(() => {
  'use strict';
  const config = JSON.parse(atob(document.currentScript.dataset.mobileConfig));
  const storage = {requested: config.profile === 'storage-denied', installed: false, failures: 0};
  if (storage.requested) {
    try {
      Object.defineProperty(window, 'localStorage', {configurable: true, get() {
        storage.failures++;
        throw new DOMException('Local-only QA storage denial', 'SecurityError');
      }});
      storage.installed = true;
    } catch (error) { storage.installError = error.name; }
  }
  const started = performance.now(), max = 1800;
  const events = [], errors = [];
  let dropped = 0, frozen = false, sequence = 0;
  const own = node => node instanceof Element && !!node.closest('#mobile-qa-button,#mobile-qa-report');
  const label = node => !(node instanceof Element) ? (node === document ? 'document' : null) : node.id ? '#' + node.id : node.tagName.toLowerCase() + (node.classList.length ? '.' + [...node.classList].slice(0, 3).join('.') : '');
  const round = value => Math.round(value * 1000) / 1000;
  const geometry = node => ({target: label(node), scrollTop: round(node.scrollTop || 0), scrollHeight: node.scrollHeight, clientHeight: node.clientHeight});
  const state = () => ({scrollY: round(scrollY), activeElement: label(document.activeElement), selectedPiece: document.body?.dataset.piece ?? null,
    dialogs: [...document.querySelectorAll('dialog[open]')].filter(n => !own(n)).map(geometry)});
  const record = event => {
    if (frozen || own(event.target)) return;
    const row = {sequence: ++sequence, at: round(performance.now()), eventTimeStamp: round(event.timeStamp), type: event.type, trusted: event.isTrusted,
      target: label(event.target), pointerType: event.pointerType, pointerId: event.pointerId, buttons: event.buttons, x: event.clientX, y: event.clientY,
      defaultPreventedAtCapture: event.defaultPrevented, ...state()};
    if (event.changedTouches) row.changedTouches = [...event.changedTouches].map(t => ({id: t.identifier, x: t.clientX, y: t.clientY}));
    if (event.type === 'scroll' && event.target instanceof Element) row.scroller = geometry(event.target);
    if (events.length >= max) { events.shift(); dropped++; }
    events.push(row);
    queueMicrotask(() => {row.defaultPreventedAfterDispatch = event.defaultPrevented; row.after = state();});
  };
  const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'click', 'scroll', 'focusin'];
  types.forEach(type => addEventListener(type, record, {capture: true, passive: true}));
  addEventListener('error', event => { if (!frozen) errors.push({type: 'error', message: event.message || null, resource: event.target instanceof Element ? label(event.target) : null}); }, true);
  addEventListener('unhandledrejection', event => { if (!frozen) errors.push({type: 'unhandledrejection', name: event.reason?.name || typeof event.reason}); });
  const report = () => {
    const result = {schema: 'mobile-local-review/v1', recordedAt: new Date().toISOString(), ...config,
      started, stopped: performance.now(), storage, environment: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio, maxTouchPoints: navigator.maxTouchPoints,
        coarse: matchMedia('(pointer: coarse)').matches, hover: matchMedia('(hover: hover)').matches, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches},
      final: state(), dropped, events, errors,
      limitations: ['This is browser observation with injected diagnostic overhead, not physical-device or field-performance evidence.',
        'Trusted scroll alone does not establish a swipe. Inspect trusted touchmove coordinates, pointer cancellation, focus and scroll ordering, plus the actual rendered movement.',
        'Storage denial replaces the localStorage getter before app execution. It exercises the application failure branch, not an actual browser privacy setting.',
        'Save faults are injected before any document write reaches the separate local editor. A 401/409 does not establish actual session expiry or a database race.',
        'No input events are dispatched. The QA report is opened only after the observation is frozen. Navigation starts a new observation; save each required page state before leaving.']};
    frozen = true;
    types.forEach(type => removeEventListener(type, record, true));
    return result;
  };
  const open = () => {
    if (frozen) return;
    const result = report(), dialog = document.createElement('dialog');
    dialog.id = 'mobile-qa-report'; dialog.setAttribute('aria-label', 'Isolated local QA evidence');
    dialog.style.cssText = 'color:#111;background:#fff;width:min(900px,95vw);max-height:90dvh;padding:20px;border:2px solid #333;overflow:auto;font:14px/1.5 monospace;';
    const title = document.createElement('h2'); title.textContent = 'Local QA: ' + config.profile;
    const close = document.createElement('button'); close.textContent = 'Close report'; close.onclick = () => dialog.close();
    const download = document.createElement('a'); download.textContent = 'Download JSON evidence'; download.download = `${config.profile}-${Date.now()}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2) + '\n'], {type: 'application/json'})); download.href = url; download.style.margin = '0 20px';
    const pre = document.createElement('pre'); pre.textContent = JSON.stringify(result, null, 2); pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
    dialog.append(title, close, download, pre); document.body.append(dialog); dialog.showModal(); close.focus();
  };
  addEventListener('keydown', event => {if (event.altKey && event.shiftKey && event.code === 'KeyM') {event.preventDefault(); open();}});
  addEventListener('DOMContentLoaded', () => {
    const button = document.createElement('button'); button.id = 'mobile-qa-button'; button.textContent = 'QA: ' + config.profile;
    button.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:2147483647;background:#fff;color:#111;border:1px solid #333;padding:8px;font:11px/1.2 sans-serif;min-height:44px;max-width:140px;';
    button.addEventListener('click', open); document.body.append(button);
  }, {once: true});
})();
