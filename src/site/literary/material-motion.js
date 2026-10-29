/* Material light only. The raster, its geometry and all reading links stay still.
 * SVG contract: 640x500 viewBox; data-piece=0..3; image or g.material-base;
 * g.material-light; radialGradient[data-material-light] in user space;
 * optional feDropShadow[data-material-shadow].
 * Optional SVG data-light-0 / data-light-1="cx,cy,r" override the crop's focus.
 */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  // Each SVG carries its authored light regions. New work is not limited to
  // the original four pieces, and motion never imports the editorial registry.
  const controllers = [];
  let suspended = document.hidden;

  function cropFocus(svg, reading) {
    const raw = svg.getAttribute('data-light-' + reading);
    if (!raw) return null;
    const numbers = raw.trim().split(/[\s,]+/).map(Number);
    if (numbers.length !== 3 || !numbers.every(Number.isFinite)) return null;
    return [clamp(numbers[0], 70, 570), clamp(numbers[1], 50, 450), clamp(numbers[2], 80, 420), reading ? 1 : .9];
  }

  function exposed(controller) {
    const svg = controller.svg;
    if (suspended || document.hidden || !svg.isConnected || !controller.inView) return false;
    if (svg.closest('[hidden]')) return false;
    const containingDialog = svg.closest('dialog');
    if (containingDialog && !containingDialog.open) return false;
    // Another visible modal makes the underlying artwork unavailable to the reader.
    const modal = document.querySelector('dialog[open]');
    if (modal && !modal.contains(svg)) return false;
    if (!svg.getClientRects().length) return false;
    const box = svg.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 && box.top < innerHeight && box.left < innerWidth;
  }

  function readingFor(controller) {
    return controller.owner?.getAttribute('data-reading') === '1' ? 1 : 0;
  }

  function baseTarget(controller) {
    return controller.foci[readingFor(controller)].slice();
  }

  function paint(controller) {
    const [x, y, radius, strength] = controller.current;
    const gradient = controller.gradient;
    gradient.setAttribute('cx', x.toFixed(2));
    gradient.setAttribute('cy', y.toFixed(2));
    gradient.setAttribute('fx', x.toFixed(2));
    gradient.setAttribute('fy', y.toFixed(2));
    gradient.setAttribute('r', radius.toFixed(2));
    controller.svg.style.setProperty('--material-light-level', strength.toFixed(4));
    if (controller.shadow) {
      // The source image already contains its material shadows; this adds only a small cast.
      // Preserve the authored static shadow and make only a relative lighting adjustment.
      const anchor = controller.foci[0];
      const [dx, dy, blur] = controller.shadowOrigin;
      controller.shadow.setAttribute('dx', (dx + clamp((anchor[0] - x) * .008, -2.5, 2.5)).toFixed(2));
      controller.shadow.setAttribute('dy', (dy + clamp((anchor[1] - y) * .008, -2.5, 2.5)).toFixed(2));
      controller.shadow.setAttribute('stdDeviation', clamp(blur + (radius - anchor[2]) * .004, 1, 9).toFixed(2));
    }
  }

  function stop(controller, settle = true) {
    if (controller.frame) cancelAnimationFrame(controller.frame);
    controller.frame = 0;
    if (settle) { controller.current = controller.target.slice(); paint(controller); }
  }

  function start(controller) {
    if (reduced.matches || !exposed(controller)) { stop(controller); return; }
    const distance = controller.current.reduce((sum, n, i) => sum + Math.abs(n - controller.target[i]), 0);
    if (distance < .03) { stop(controller); return; }
    if (controller.frame) return;
    controller.lastTime = performance.now();
    controller.started = controller.lastTime;
    controller.frame = requestAnimationFrame(now => tick(controller, now));
  }

  function tick(controller, now) {
    controller.frame = 0;
    if (reduced.matches || !exposed(controller)) { stop(controller); return; }
    const dt = clamp(now - controller.lastTime, 1, 64);
    controller.lastTime = now;
    const blend = 1 - Math.exp(-dt / 100);
    let remaining = 0;
    controller.current = controller.current.map((n, i) => {
      const next = n + (controller.target[i] - n) * blend;
      remaining += Math.abs(controller.target[i] - next);
      return next;
    });
    paint(controller);
    if (remaining < .06 || now - controller.started >= 850) { stop(controller); return; }
    controller.frame = requestAnimationFrame(time => tick(controller, time));
  }

  function update(controller, immediate = false) {
    controller.target = baseTarget(controller);
    if (controller.pointer && fine.matches && !reduced.matches) {
      controller.target[0] = clamp(controller.target[0] + controller.pointer[0], 70, 570);
      controller.target[1] = clamp(controller.target[1] + controller.pointer[1], 50, 450);
    }
    if (immediate || reduced.matches || !exposed(controller)) stop(controller);
    else start(controller);
  }

  function localPoint(svg, event) {
    // Respect preserveAspectRatio/letterboxing and the SVG's actual screen transform.
    try {
      const matrix = svg.getScreenCTM();
      if (matrix) {
        const point = svg.createSVGPoint();
        point.x = event.clientX; point.y = event.clientY;
        const local = point.matrixTransform(matrix.inverse());
        return [local.x, local.y];
      }
    } catch { /* A detached SVG or non-invertible matrix has no pointer light. */ }
    return null;
  }

  document.querySelectorAll('svg.material-print[data-piece]').forEach(svg => {
    const piece = Number(svg.dataset.piece);
    const gradient = svg.querySelector('[data-material-light]');
    const foci = [cropFocus(svg, 0), cropFocus(svg, 1)];
    // Incomplete authoring keeps the static illustration; it cannot start a malformed animation.
    if (!Number.isInteger(piece) || piece < 0 || !gradient || foci.some(focus => !focus)) return;
    const shadow = svg.querySelector('[data-material-shadow]');
    const shadowOrigin = ['dx', 'dy', 'stdDeviation'].map((name, i) => {
      const raw = shadow?.getAttribute(name);
      return raw != null && Number.isFinite(Number(raw)) ? Number(raw) : [3, 8, 5][i];
    });
    const controller = {
      svg, foci, gradient,
      shadow, shadowOrigin,
      owner: svg.closest('[data-reading]'),
      host: svg.closest('.artboard, .detail-art'),
      inView: !('IntersectionObserver' in window),
      current: [], target: [], pointer: null, frame: 0, lastTime: 0, started: 0,
    };
    controller.target = baseTarget(controller);
    controller.current = controller.target.slice();
    paint(controller);
    controllers.push(controller);
    if (!controller.host) return; // Contents thumbnails and reader prints stay composed.
    controller.host.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches || event.pointerType !== 'mouse' || !exposed(controller)) return;
      const point = localPoint(svg, event);
      if (!point) return;
      controller.pointer = [clamp((point[0] - 320) * .38, -120, 120), clamp((point[1] - 250) * .35, -90, 90)];
      // A real new input extends the settling deadline; resting never sustains a loop.
      controller.started = performance.now();
      update(controller);
    }, { passive: true });
    controller.host.addEventListener('pointerleave', () => {
      controller.pointer = null;
      controller.started = performance.now();
      update(controller);
    });
  });

  if (!controllers.length) return;

  if ('IntersectionObserver' in window) {
    const bySVG = new Map(controllers.map(controller => [controller.svg, controller]));
    const intersection = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const controller = bySVG.get(entry.target);
        if (!controller) return;
        controller.inView = entry.isIntersecting && entry.intersectionRatio > 0;
        controller.pointer = null;
        update(controller, true);
      });
    }, { threshold: [0, .01] });
    controllers.forEach(controller => intersection.observe(controller.svg));
  }

  // Passage panels move on phones, but their nearest data-reading owner remains intact.
  // Only this authored state is observed; there is no global API or style observer loop.
  const readingChanges = new MutationObserver(records => {
    const changed = new Set(records.map(record => record.target));
    controllers.forEach(controller => {
      if (!changed.has(controller.owner)) return;
      controller.pointer = null;
      controller.started = performance.now();
      update(controller);
    });
  });
  controllers.filter(controller => controller.owner).forEach(controller => {
    readingChanges.observe(controller.owner, { attributes: true, attributeFilter: ['data-reading'] });
  });

  function resetAll() {
    controllers.forEach(controller => { controller.pointer = null; update(controller, true); });
  }
  reduced.addEventListener('change', resetAll);
  fine.addEventListener('change', resetAll);
  document.addEventListener('visibilitychange', () => { suspended = document.hidden; resetAll(); });
  addEventListener('pagehide', () => { suspended = true; resetAll(); });
  addEventListener('pageshow', () => { suspended = document.hidden; resetAll(); });
  addEventListener('blur', resetAll);
  addEventListener('resize', resetAll);
  addEventListener('beforeprint', resetAll);
})();
