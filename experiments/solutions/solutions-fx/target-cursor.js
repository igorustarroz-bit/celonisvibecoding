/* =========================================================================
   Solutions — target cursor (experiment 7).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   A dot plus four corner brackets that spin slowly and, when the pointer is
   over a button, fly apart and frame it. Vanilla port of react-bits'
   TargetCursor: same shape, same four corners, same idle spin, same snap.

   Three deliberate differences from the original, all for this repo:
     * no GSAP. The original tweens x/y through gsap and reads them back with
       gsap.getProperty every tick; here one rAF loop holds the state and
       smooths it, and it stops dead when nothing is moving.
     * THE IDLE SPIN IS A CSS ANIMATION ON AN INNER GROUP, not a rotation
       applied to each bracket's offset. Rotating the four offsets while
       leaving the brackets themselves upright is what turned the reticle into
       a pinwheel — the corners orbited but never turned, so the four "L"s
       pointed the wrong way (Igor, 2026-09-14: "parece más una esvástica que
       un cuadrado"). The brackets have to turn as one rigid body. Doing it in
       CSS on a child of the translated wrapper also keeps the spin on the
       compositor and off the main thread, so it can run continuously without
       costing a frame.
     * the class is put on the targets from here (`.cursor-target`), so the
       saved client pages are not edited to carry our markup.

   Settings: window.SOLUTIONS.cursor. Console: SOLUTIONS_CURSOR().
   ========================================================================= */
(function () {
  "use strict";

  var S = (window.SOLUTIONS = window.SOLUTIONS || {});

  var CFG = S.cursor = {
    enabled: 1,
    targets: 1,            // put .cursor-target on the buttons automatically
    spinSeconds: 2,        // one full turn of the idle brackets
    cornerSize: 12,        // px, the length of each bracket arm
    borderWidth: 3,        // px
    restRadius: 18,        // how far the brackets sit from the dot when idle
    padding: 6,            // gap between the target's box and the brackets
    followTau: 0.045,      // pointer smoothing, seconds (0 = instant)
    snapTau: 0.075,        // bracket snap, seconds
    hideSystemCursor: 1,
    dotScaleDown: 0.7      // on mouse down
  };

  /* Everything on the saved pages that behaves like a control. Kept as one
     list so the tuner can report what it found and a new block can be added in
     one place.

     Every entry is scoped to `.page-shell`, which is the wrapper around the
     page's own body content. That is what keeps the bare `button` and
     `summary` entries safe: the tuner panel is appended to <body>, outside the
     shell, so its own buttons are never framed by the cursor.

     `button` and `summary` between them cover what Igor asked for on
     2026-09-14 — the +/- of the nav dropdowns and of the accordions, the
     carousel's back and forward arrows, "English" (`button.select-toggle`) and
     "Select your country" (`button.footer-country-selector`) in the footer,
     and the cards grid's "load more". */
  var TARGET_SELECTOR = [
    '.page-shell .button-container > a',
    '.page-shell a.button',
    '.page-shell a.link-with-arrow',
    '.page-shell .buttons-row a',
    '.page-shell .nav-cta a',
    '.page-shell a.blinking-square',
    '.page-shell button',
    '.page-shell summary'
  ].join(', ');

  var root = null, spinner = null, dot = null, corners = [], raf = 0, running = false;
  var px = 0, py = 0, tx = 0, ty = 0;      // pointer, smoothed and target
  var last = 0, moved = false;
  var active = null;                        // the element under the pointer
  var cur = [], dest = [];                  // bracket offsets, smoothed and target
  var press = 1;

  function coarse() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
           ('ontouchstart' in window && window.innerWidth <= 768);
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function build() {
    root = el('div', 'sfx-cursor');
    spinner = el('div', 'sfx-cursor__spin');
    dot = el('div', 'sfx-cursor__dot');
    ['tl', 'tr', 'br', 'bl'].forEach(function (k) {
      var c = el('div', 'sfx-cursor__corner sfx-cursor__corner--' + k);
      spinner.appendChild(c);
      corners.push(c);
    });
    root.appendChild(spinner);
    root.appendChild(dot);          // outside the spinner: a dot need not turn
    document.body.appendChild(root);
    for (var i = 0; i < 4; i++) { cur.push({ x: 0, y: 0 }); dest.push({ x: 0, y: 0 }); }
    restPositions();
    sizeCorners();
  }

  function sizeCorners() {
    root.style.setProperty('--sfx-corner', CFG.cornerSize + 'px');
    root.style.setProperty('--sfx-border', CFG.borderWidth + 'px');
    root.style.setProperty('--sfx-spin', Math.max(0.05, CFG.spinSeconds) + 's');
    root.classList.toggle('sfx-cursor--nospin', !(CFG.spinSeconds > 0));
  }

  /* Idle: the four brackets sit on the corners of a small square around the
     dot, which is what makes the spin read as a reticle rather than a blob. */
  function restPositions() {
    var r = CFG.restRadius, s = CFG.cornerSize;
    var p = [[-r, -r], [r - s, -r], [r - s, r - s], [-r, r - s]];
    for (var i = 0; i < 4; i++) { dest[i].x = p[i][0]; dest[i].y = p[i][1]; }
  }

  /* Snapped: the brackets take the corners of the target's box, expressed
     relative to the pointer, because the wrapper is translated to the pointer. */
  function targetPositions(rect) {
    var b = CFG.borderWidth, s = CFG.cornerSize, pad = CFG.padding;
    var l = rect.left - b - pad, t = rect.top - b - pad;
    var r = rect.right + b + pad - s, bo = rect.bottom + b + pad - s;
    var p = [[l, t], [r, t], [r, bo], [l, bo]];
    for (var i = 0; i < 4; i++) { dest[i].x = p[i][0] - px; dest[i].y = p[i][1] - py; }
  }

  function findTarget(node) {
    while (node && node !== document.body && node.nodeType === 1) {
      if (node.matches && node.matches('.cursor-target')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function tagTargets() {
    if (!CFG.targets) return 0;
    var n = document.querySelectorAll(TARGET_SELECTOR), i;
    for (i = 0; i < n.length; i++) n[i].classList.add('cursor-target');
    return n.length;
  }

  /* One exponential step. tau is the time it takes to cover ~63 % of the gap,
     so the smoothing is frame-rate independent. */
  function damp(a, b, tau, dt) {
    if (tau <= 0) return b;
    return a + (b - a) * (1 - Math.exp(-dt / tau));
  }

  function frame(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    var busy = false;

    var nx = damp(px, tx, CFG.followTau, dt);
    var ny = damp(py, ty, CFG.followTau, dt);
    if (Math.abs(nx - px) > 0.01 || Math.abs(ny - py) > 0.01) busy = true;
    px = nx; py = ny;

    if (active) {
      targetPositions(active.getBoundingClientRect());
    } else if (moved) {
      restPositions();
    }

    for (var i = 0; i < 4; i++) {
      var cx = damp(cur[i].x, dest[i].x, CFG.snapTau, dt);
      var cy = damp(cur[i].y, dest[i].y, CFG.snapTau, dt);
      if (Math.abs(cx - cur[i].x) > 0.05 || Math.abs(cy - cur[i].y) > 0.05) busy = true;
      cur[i].x = cx; cur[i].y = cy;
    }

    root.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
    for (i = 0; i < 4; i++) {
      corners[i].style.transform =
        'translate3d(' + cur[i].x.toFixed(2) + 'px,' + cur[i].y.toFixed(2) + 'px,0)';
    }
    dot.style.transform = 'scale(' + press.toFixed(3) + ')';

    if (busy) kick();
    else running = false;
  }

  function kick() {
    if (raf) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function onMove(e) {
    tx = e.clientX; ty = e.clientY;
    if (!moved) { moved = true; px = tx; py = ty; }
    kick();
  }

  /* Locked = framing a target: the CSS spin is switched off and the brackets
     are held upright while they sit on the target's corners. */
  function setLocked(on) {
    root.classList.toggle('sfx-cursor--locked', !!on);
  }

  function onOver(e) {
    var t = findTarget(e.target);
    if (t === active) return;
    active = t;
    setLocked(!!t);
    kick();
  }

  function onOut(e) {
    if (!active) return;
    if (e.relatedTarget && findTarget(e.relatedTarget) === active) return;
    active = null;
    setLocked(false);
    kick();
  }

  function setEnabled(on) {
    if (!root) return;
    root.style.display = on ? '' : 'none';
    document.documentElement.classList.toggle(
      'sfx-cursor-on', !!(on && CFG.hideSystemCursor));
    if (on) kick();
  }

  function start() {
    if (coarse()) return;                 // touch devices keep their own behaviour
    build();
    var found = tagTargets();
    S.cursorTargets = found;

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerout', onOut, { passive: true });
    window.addEventListener('scroll', function () { if (active) kick(); }, { passive: true });
    window.addEventListener('pointerdown', function () { press = CFG.dotScaleDown; kick(); });
    window.addEventListener('pointerup', function () { press = 1; kick(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    setEnabled(!!CFG.enabled);
    kick();
  }

  /* The tuner calls this after any cursor knob changes. */
  S.cursorApply = function () {
    if (!root) return;
    sizeCorners();
    setEnabled(!!CFG.enabled);
    kick();
  };

  window.SOLUTIONS_CURSOR = function () {
    return {
      running: running,
      locked: !!(root && root.classList.contains('sfx-cursor--locked')),
      targetsTagged: S.cursorTargets || 0,
      over: active ? (active.getAttribute('title') || active.textContent.trim().slice(0, 40)) : null,
      settings: CFG
    };
  };

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
