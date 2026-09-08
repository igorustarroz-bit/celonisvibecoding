/* =========================================================================
   seal-knit.js — experiment 5 (celosphere): the "Celosphere 26" seal knits itself
   in the foreground and travels into its slot in the hero as you scroll.

   What it does
   - A spacer (#seal-intro-space, the sum of the phase lengths in viewport heights) is inserted at the top of
     <main>, so the page starts on a black stage with only the fixed nav. Everything
     below is a pure function of the scroll position T = scrollY / spacer height
     (0 → 1), so scrolling back up plays it in reverse — nothing is time-based.
   - KNIT (knitVH), then HOLD (hold1VH — nothing moves while scrolling). The 57 stripe segments of the original seal (geometry in
     seal-data.js, extracted from the client's PNG: real thick-to-thin gradient, real
     positions) grow along their stripe from bottom-left to top-right, in order of
     position. The 37 numbers appear where the knitting front passes: 'matrix' mode
     cycles random digits for a moment before settling on the real value, 'countup'
     mode counts from 0 up to it.
   - SHIFT (shiftVH), then HOLD (hold2VH). The finished seal slides right, at full size, and
     the title "Celosphere 2026" rises from below to sit vertically centred — the two
     share the black stage (Igor's frame 2).
   - SETTLE (settleVH). The seal shrinks into the exact circle of the hero's
     <img> (the square-value picture tile, measured live from the DOM), the title rises
     to its layout position, the CTA / dates / countdown card rise in from below, the
     black stage fades out and the "Celosphere 26" wordmark (a crop of the original
     artwork) fades in beneath the seal (Igor's frame 3 = the untouched hero).
   - T ≥ 1: the seal is drawn over the (hidden) <img> at its live position, so it
     scrolls with the hero like the original picture did.
   - Canvas 2D, white on black, one fixed <canvas> (pointer-events: none, z-index 8:
     under the site's fixed header, which sits in a z-index 9 context).
   - Rendering is on demand (v22): a frame is drawn only when the scroll, the pointer / tilt,
     a knob, the layout or a loading font / image changed, or while a smoothed value is still
     travelling; at rest nothing is drawn. The viewport height used for the spacer and the
     geometry is the stable 100vh (a probe element), not innerHeight, so the address bar
     collapsing on phones no longer resizes the sequence mid-scroll.
   - While the title is on the stage (frames 2–3) it is position: fixed with a same-size
     placeholder holding its room in the hero (v23): a fixed element is not moved by the
     compositor scroll, so it stays as still as the canvas (a per-frame translate lagged one
     frame behind the scroll and made the title vibrate).

   Tuning: every knob lives on window.SEAL (read every frame) — see seal-tuner.js.
   window.SEAL_INFO() reports what is really in effect (dpr, canvas px, blur).
   Igor's rules honoured here: works from file:// (the wordmark is a data URI; the
   digits use ../lib/plex-mono.css, an OFL mono face with the dotted zero of the
   artwork), tuner with the antialias read-out, English everywhere.
   ========================================================================= */
(function () {
  'use strict';
  var DATA = window.SEAL_DATA;
  if (!DATA) { console.warn('seal-knit: SEAL_DATA missing'); return; }

  var SEAL = window.SEAL = {
    // Timeline, as scroll distances in viewport heights (the spacer is their sum). The two holds are
    // dwell ranges where nothing moves while the visitor keeps scrolling (Igor: "hold ~3 s more" after
    // the seal forms and after it sits right of the title — at a normal scroll pace 1.2 vh ≈ that).
    knitVH: 0.85,          // KNIT: the seal forms, centred (frame 1) — Igor's tuned value (v20; 0.8 → 1.6 → 0.85)
    hold1VH: 0.25,         // … holds (Igor's tuned value, v20; 1.2 → 0.5 → 0.25)
    shiftVH: 0.5,          // SHIFT: seal slides right, title rises to the centre (frame 2)
    hold2VH: 1.2,          // … holds
    settleVH: 0.7,         // SETTLE: into the hero (frame 3)
    formation: 1,          // how the seal forms: 0 = KNIT (segments grow along their stripe — the approved v12
                           //   option, kept), 1 = FLY-IN (odd rows arrive from off-screen bottom-left, even rows
                           //   from off-screen top-right, sliding along their stripe into place)
    flyEase: 1,            // fly-in: 0 = linear, 1 = ease-out (fast arrival, soft stop)
    growDur: 0.28,         // how long (in K units, 0..1) one segment takes to grow / fly in
    orderMix: 0.15,        // 0 = order purely along the stripe direction, 1 = purely by row
    digitMode: 1,          // 1 = matrix (random digits settle), 0 = count-up
    digitLead: 0.06,       // digits start this much (K) after the front passes them
    flickerLen: 0.16,      // duration (K) of the matrix / count-up phase per number
    flickerRate: 18,       // digit changes per second in matrix mode
    fgRadius: 0.34,        // foreground radius, fraction of min(viewport w, h)
    fgX: 0.5,              // frame 1: the seal forms here (fraction of the viewport width)
    fgY: 0.5,              //          … and here (fraction of the viewport height)
    fgX2: 0.735,           // frame 2: where it has slid to, making way for the title (desktop)
    fgY2: 0.52,
    fgScale2: 1,           //          size in frame 2 relative to frame 1
    fgX2Mobile: 0.5,       // phones: frame 2 puts the seal lower and the title above it
    fgY2Mobile: 0.62,
    titleYMobile: 0.2,     // phones: title centre in frame 2 (fraction of the viewport height)
    mobile: {              // phones (< 768 px): the dates block used to rise straight through the seal
      sealLandAt: 0.7,     //   the seal reaches its slot at this fraction of the settle, leaving room …
      datesDist: 0.7       //   … for the dates to slide in FROM THE LEFT afterwards (distance in viewport widths)
    },
    hover: {               // reaction to the pointer (desktop) / the tilt (phones)
      radius: 0.75,        //   reach of the influence inside the seal, in seal radii
      reachOut: 0.6,       //   how far beyond the rim the pointer still counts (radii); further out the seal is at rest
      thick: 1.5,          //   stripe width multiplier right under the pointer (proportional: the thin lower-right
                           //     lines fatten less in absolute terms — an absolute width was tried in v18 and Igor
                           //     preferred this) …
      thin: 0.55,          //   … and far from it (1 = as drawn)
      smoothing: 0.14,     //   per-frame lerp toward the target width
      fly: 0.45,           //   hover "un-forms" the seal: with the pointer near the RIM the rows slide out along
      flyEdge: 0.25,       //     their stripe the way they arrived (odd rows toward bottom-left, even toward
      flyNear: 1,          //     top-right), up to `fly` radii at the rim; nothing at the centre (< flyEdge R);
      flyFar: 0.1,         //     rows near the pointer move `flyNear`× that, rows far from it `flyFar`× …
      flyRadius: 0.3,      //     … "near" measured across the rows, fading out over this many radii (tight, so
                           //     the zone under the pointer opens up clearly more than the rest — Igor)
      stretchMix: 0.8,     //   share of that movement that is a STRETCH of the row around the pointer (segments on
                           //     either side of it move apart, most where they are nearest it) vs. a rigid shift of
                           //     the whole row in its formation direction. A stretch is monotonic along the row,
                           //     so gaps only ever widen — no collisions (a bump that moved the near part more
                           //     in ONE direction would push it into its neighbours)
      stretchWidth: 0.22,  //     how tight the stretch is around the pointer (radii along the row)
      tiltReach: 1.2       //   phones: full tilt puts the virtual pointer this far from the centre (radii)
    },
    parallax: {            // hero elements rise into place during the travel, at different speeds
      titleFade: 0.4,                       // fraction of the shift over which the title fades in while sliding
      extraDist: 0.6, extraSpeed: 1.0,      // settle phase: distance in viewport heights, speed = how much sooner it finishes
      cardDist: 0.4, cardSpeed: 1.0,        // the countdown card comes in from the RIGHT: distance in viewport widths
      ease: 0,                              // 0 = the risers move linearly with the scroll (1:1 feel), 1 = smoothstep (accelerates mid-way)
      ctaDist: 0.8, ctaSpeed: 1.15,
      fadeFrom: 0                           // opacity of those elements at the start of the settle
    },
    travelEase: 0.8,       // 0 = linear settle travel, 1 = fully eased (smoothstep)
    bgFadeStart: 0.78,     // black stage fades between these two T values
    bgFadeEnd: 0.96,
    wordmarkFrom: 0.82,    // wordmark fades in from this T to 1
    thicknessScale: 1,     // multiplies the original stripe thickness (1 = as in the artwork)
    digitScale: 1,         // multiplies the digit size (1 = as in the artwork)
    digitWeight: 500,
    showTarget: 0,         // debug: outline the target circle
    autoPlay: 1,           // on load, if nobody scrolls, scroll the page itself through the knit …
    autoPlayMs: 2600,      // … over this long (the user's first wheel/touch/key cancels it)
    autoPlayTo: -1,        // … up to this T; −1 = the end of the knit
    quality: { dprMax: 2, softBlur: 0 }
  };

  var SQ = Math.SQRT1_2, D = [SQ, SQ], N = [-SQ, SQ];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function outCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- precompute the knitting order ---------- */
  // the 19 stripe rows (distinct v, lower right → upper left) → row index, for the odd/even fly-in
  var rowsV = []; DATA.stripes.forEach(function (s) { if (!rowsV.some(function (v) { return Math.abs(v - s.v) < 0.03; })) rowsV.push(s.v); });
  rowsV.sort(function (a, b) { return a - b; });
  function rowIndex(v) { var best = 0; for (var r = 1; r < rowsV.length; r++) if (Math.abs(rowsV[r] - v) < Math.abs(rowsV[best] - v)) best = r; return best; }
  var stripes = DATA.stripes.map(function (s, i) {
    var row = (s.v + 1) / 2;                         // 0 (lower right) .. 1 (upper left)
    var ri = rowIndex(s.v);
    return { u0: s.u0, u1: s.u1, v: s.v, th: s.th, order: (s.u0 + 1) / 2, mid: ((s.u0 + s.u1) / 2 + 1) / 2, row: row, ri: ri, rowPos: 1 - ri / Math.max(1, rowsV.length - 1), i: i };
  });
  var digits = DATA.digits.map(function (d, i) {
    var u = d.x * D[0] + d.y * D[1], v = d.x * N[0] + d.y * N[1];
    var ri = rowIndex(v);
    return { x: d.x, y: d.y, t: d.t, val: parseInt(d.t, 10), order: (u + 1) / 2, mid: (u + 1) / 2, row: (v + 1) / 2, ri: ri, rowPos: 1 - ri / Math.max(1, rowsV.length - 1), i: i };
  });
  // hover displacement along the stripe for an item of row `ri` whose centre along the stripe is `um`
  // (seal units): a rigid shift of the row in its formation direction + a monotonic stretch around the
  // pointer (items beyond the pointer move up-right, items before it down-left, saturating with distance)
  function hoverShift(ri, um, amount, pu) {
    var H = SEAL.hover, rigid = amount * (1 - H.stretchMix) * (ri % 2 ? -1 : 1);
    var stretch = amount * H.stretchMix * Math.tanh((um - pu) / Math.max(0.02, H.stretchWidth));
    return rigid + stretch;
  }
  // fly-in offset along the stripe (seal units) for a row: odd rows from bottom-left (−), even from top-right (+)
  function flyOffset(ri, g, R) {
    var far = Math.hypot(vw, vh) / R * 1.1;            // enough to start outside the viewport whatever the seal's size
    var e = lerp(g, outCubic(g), SEAL.flyEase);
    return (ri % 2 ? -1 : 1) * far * (1 - e);
  }

  /* ---------- pointer (mouse / touch) and tilt (phones) ---------- */
  // The canvas has pointer-events: none, so the pointer is read from the window. In seal units
  // (centre 0, radius 1) it is recomputed every frame against the seal's current centre/radius.
  var pointer = null, touchUntil = 0, tilt = null;     // touchUntil: Infinity while a finger is down, then a short hold
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse' || touchUntil > performance.now()) pointer = [e.clientX, e.clientY];
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { pointer = [e.clientX, e.clientY]; touchUntil = Infinity; } }, { passive: true });
  window.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') touchUntil = performance.now() + 900; }, { passive: true });
  window.addEventListener('pointercancel', function () { touchUntil = 0; pointer = null; });
  document.addEventListener('mouseleave', function () { pointer = null; });
  if (window.TiltParallax) {
    TiltParallax.start(function (x, y) { tilt = [x, y]; }, { range: 14 });   // only does anything on coarse-pointer devices
  }
  // the pointer in seal units (centre 0, radius 1, y up) for this frame, or null
  function sealPointer(cx, cy, R) {
    if (touchUntil && touchUntil < performance.now()) { touchUntil = 0; pointer = null; }   // hold after the finger lifted has expired
    if (pointer) return [(pointer[0] - cx) / R, -(pointer[1] - cy) / R];
    if (tilt) return [tilt[0] * SEAL.hover.tiltReach, -tilt[1] * SEAL.hover.tiltReach];
    return null;
  }
  function segDist(p, s) {   // distance from the pointer (seal units) to a stripe segment
    var pu = p[0] * D[0] + p[1] * D[1], pv = p[0] * N[0] + p[1] * N[1];
    var du = pu < s.u0 ? s.u0 - pu : pu > s.u1 ? pu - s.u1 : 0;
    return Math.hypot(du, pv - s.v);
  }
  function startOf(item) {
    var o;
    if (SEAL.formation >= 0.5) {
      // fly-in: within a row, the segment FARTHEST along the direction of travel starts first, so a
      // later one (same speed, same path) always trails behind it and nothing ever collides (Igor:
      // "fill the far end of the journey first"). Odd rows travel up-right, even rows down-left.
      var within = item.ri % 2 ? 1 - item.mid : item.mid;
      o = lerp(within, item.rowPos, SEAL.orderMix);
    } else o = lerp(item.order, 1 - item.row, SEAL.orderMix);
    return o * (1 - SEAL.growDur);
  }

  /* ---------- DOM ---------- */
  var main = document.querySelector('main');
  var img = document.querySelector('.hero-landing .square-value img');
  if (!main || !img) { console.warn('seal-knit: hero image not found'); return; }
  img.style.visibility = 'hidden';

  var spacer = document.createElement('div');
  spacer.id = 'seal-intro-space';
  // main>div has margin:40px 16px on this site, and the page's base colour is white (the hero is
  // dark only through its own wrapper) — the stage under the fading canvas must stay black
  spacer.style.cssText = 'margin:0;padding:0;width:100%;pointer-events:none;background:#000;';
  main.insertBefore(spacer, main.firstChild);

  var canvas = document.createElement('canvas');
  canvas.id = 'seal-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:8;pointer-events:none;display:block;';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var wordmark = new Image(); wordmark.src = DATA.wordmarkSrc;

  /* hero elements that rise into place during the travel (parallax). The site's own entrance
     keyframes (move-up on the CTA / dates, per-span delays on the h1) would fight the inline
     transforms, so they are switched off here and the same motion is driven from the scroll. */
  var hero = document.querySelector('.hero-landing');
  var heroCSS = document.createElement('style');
  heroCSS.textContent = '.hero-landing h1 span,.hero-landing .extra-section,.hero-landing .button-container,.hero-landing .buttons-container{animation:none!important;opacity:1;transform:none}' +
    '.hero-landing h1,.hero-landing .extra-section,.hero-landing .square-wrapper.rotation-ready,.hero-landing .buttons-container{will-change:transform,opacity}' +
    // the site eases every transform change on the countdown card (`.square-wrapper{transition:transform
    // 300ms ease}`), so our per-frame values arrived 300 ms late — the card trailed the scroll (Igor, v24:
    // "it should feel like everything else on screen, just advancing and reversing with the scroll")
    '.seal-stage .hero-landing h1,.seal-stage .hero-landing .extra-section,.seal-stage .hero-landing .square-wrapper,.seal-stage .hero-landing .buttons-container{transition:none!important}' +
    // while the sequence runs (body.seal-stage): the hero content must be able to leave its box (the
    // title sits in the middle of the viewport in frame 2, far above the hero) and must paint ABOVE
    // the fixed canvas (z-index 8) — the black stage stays under the text, the dotted background of
    // the wrapper stays under the stage. The class is dropped at T = 1: the hero is then untouched.
    '.seal-stage .hero-landing{overflow:visible;position:relative;z-index:9}';
  document.head.appendChild(heroCSS);
  var PX = SEAL.parallax;
  var title = hero ? hero.querySelector('h1') : null;
  var risers = hero ? [
    { el: hero.querySelector('.extra-section'), dist: 'extraDist', speed: 'extraSpeed' },
    { el: hero.querySelector('.square-wrapper.rotation-ready'), dist: 'cardDist', speed: 'cardSpeed', axis: 'x' },
    { el: hero.querySelector('.buttons-container'), dist: 'ctaDist', speed: 'ctaSpeed' }
  ].filter(function (r) { return r.el; }) : [];
  /* The title while it is on the stage (frames 2–3) is taken OUT of the page flow and made
     position: fixed (v23). Until v22 it stayed in the flow and was pushed to the viewport centre with
     a per-frame translate computed from getBoundingClientRect: the compositor scrolls the document
     first and the main thread corrects the transform a frame later, so during a scroll the title
     moved with the page and snapped back every frame — Igor: "the seal stays still but the title
     vibrates and bounces". A fixed element is not moved by the scroll at all, exactly like the
     canvas, so it is rock steady; a placeholder of the same size keeps the hero layout (and thus
     the natural slot the title returns to) unchanged. */
  var titleHold = null;   // the placeholder that keeps the title's room in the hero while it is fixed
  if (title) { titleHold = document.createElement('div'); titleHold.style.display = 'none'; titleHold.setAttribute('aria-hidden', 'true'); title.parentNode.insertBefore(titleHold, title); }
  var titleFixed = false;
  function fixTitle(on, r) {                  // r = the title's natural rect (only read when switching on)
    if (on === titleFixed) return;
    titleFixed = on;
    if (on) {
      var cs = getComputedStyle(title);
      titleHold.style.cssText = 'display:block;height:' + r.height + 'px;margin:' + cs.marginTop + ' ' + cs.marginRight + ' ' + cs.marginBottom + ' ' + cs.marginLeft + ';';
      title.style.position = 'fixed'; title.style.left = r.left + 'px'; title.style.width = r.width + 'px'; title.style.margin = '0';
    } else {
      titleHold.style.display = 'none';
      title.style.position = ''; title.style.left = ''; title.style.top = ''; title.style.width = ''; title.style.margin = '';
    }
  }
  /* s = shift progress (0..1), u = settle progress (0..1). */
  function parallax(T, s, u) {
    if (title) {
      if (T >= 1 || T < marks().shiftStart) { fixTitle(false); title.style.opacity = T >= 1 ? '' : '0'; }
      else {
        var mobile = vw < 768;
        // the natural slot: the placeholder while the title is fixed, the title itself otherwise
        var r = (titleFixed ? titleHold : title).getBoundingClientRect(), natY = r.top;
        var wantY = mobile ? vh * SEAL.titleYMobile - r.height / 2 : vh / 2 - r.height / 2;   // frame 2: vertically centred
        var top, op;
        if (u <= 0) {                                    // shift: rise from below the viewport to the centred position
          fixTitle(true, r);
          top = lerp(vh + 40, wantY, smooth(s)); op = clamp(s / PX.titleFade, 0, 1);
        } else {                                         // settle: stays centred until its slot scrolls up to meet it,
          op = 1;                                        // then goes back into the flow and rides with the page (never moves down)
          if (natY <= wantY) { fixTitle(false); top = null; }
          else { fixTitle(true, r); top = wantY; }
        }
        if (top !== null && top !== undefined) title.style.top = top.toFixed(1) + 'px';
        title.style.opacity = op.toFixed(3);
      }
    }
    for (var i = 0; i < risers.length; i++) {
      var rs = risers[i];
      if (T >= 1) { rs.el.style.transform = ''; rs.el.style.opacity = ''; continue; }
      var lin = clamp(u * PX[rs.speed], 0, 1), p = lerp(lin, smooth(lin), PX.ease);
      if (vw < 768 && rs.dist === 'extraDist') {          // phones: the dates wait for the seal to land, then come from the left
        var la = SEAL.mobile.sealLandAt; p = clamp((u - la) / Math.max(0.05, 1 - la), 0, 1);
        rs.el.style.transform = 'translateX(' + (-vw * SEAL.mobile.datesDist * (1 - p)).toFixed(1) + 'px)';
        rs.el.style.opacity = lerp(PX.fadeFrom, 1, p).toFixed(3); continue;
      }
      rs.el.style.transform = rs.axis === 'x' ? 'translateX(' + (vw * PX[rs.dist] * (1 - p)).toFixed(1) + 'px)'
                                              : 'translateY(' + (vh * PX[rs.dist] * (1 - p)).toFixed(1) + 'px)';
      rs.el.style.opacity = lerp(PX.fadeFrom, 1, p).toFixed(3);
    }
  }

  /* Viewport size. `vh` is the STABLE viewport height — the height of a 100vh probe, i.e. the
     largest viewport on phones — not window.innerHeight, which changes every time the browser's
     address bar collapses or expands while scrolling. Deriving the spacer and the geometry from
     innerHeight made the whole sequence jump (T and the seal's size changed mid-scroll) on phones
     (v22). Only the canvas backing store follows the live height (`ch`), so nothing is stretched. */
  var vw = 0, vh = 0, ch = 0, dpr = 1, spacerH = 1;
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  function layout() {
    var nw = window.innerWidth, nh = probe.offsetHeight || window.innerHeight;
    // the stable height is re-read only on a real change of shape (width, orientation, a big window
    // resize); browsers where 100vh still follows the address bar cannot move the sequence either
    if (nw !== vw || !vh || Math.abs(nh - vh) > vh * 0.25) vh = nh;
    vw = nw; ch = window.innerHeight;
    dpr = Math.min(SEAL.quality.dprMax, window.devicePixelRatio || 1);
    var w = Math.round(vw * dpr), h = Math.round(ch * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    canvas.style.filter = SEAL.quality.softBlur > 0 ? 'blur(' + SEAL.quality.softBlur + 'px)' : '';
    spacerH = REDUCED ? 0 : Math.round(vh * totalVH());
    spacer.style.height = spacerH + 'px';
    if (titleFixed) fixTitle(false);          // its left/width were measured for the old layout; the next frame re-fixes it
    dirty = true;
  }
  function totalVH() { return SEAL.knitVH + SEAL.hold1VH + SEAL.shiftVH + SEAL.hold2VH + SEAL.settleVH; }
  // phase boundaries as fractions of the whole sequence
  function marks() {
    var t = totalVH(), a = SEAL.knitVH / t, b = a + SEAL.hold1VH / t, c = b + SEAL.shiftVH / t, d = c + SEAL.hold2VH / t;
    return { knitEnd: a, shiftStart: b, shiftEnd: c, settleStart: d };
  }
  var lastTotalVH = totalVH(), lastDpr = SEAL.quality.dprMax, lastBlur = SEAL.quality.softBlur;

  /* target circle: where the seal sits inside the hero <img> (fractions from the PNG) */
  function targetCircle() {
    var r = img.getBoundingClientRect(), b = DATA.imgBox;
    return { x: r.left + b.cx * r.width, y: r.top + b.cy * r.height, R: b.r * r.width };
  }

  /* ---------- digits ---------- */
  function digitText(d, K, now) {
    var start = startOf(d) + SEAL.digitLead, p = (K - start) / SEAL.flickerLen;
    if (p <= 0) return null;
    if (p >= 1) return { text: d.t, alpha: 1 };
    var alpha = clamp(p / 0.25, 0, 1), text;
    if (SEAL.digitMode >= 0.5) {
      var tick = Math.floor(now * SEAL.flickerRate) + d.i * 7, s = '';
      for (var k = 0; k < d.t.length; k++) s += String(Math.floor(hash(tick + k * 13 + d.i) * 10));
      text = s;
    } else {
      var v = Math.round(d.val * outCubic(p)); text = String(v);
      if (d.t.length > 1 && text.length < 2) text = '0' + text;
    }
    return { text: text, alpha: alpha };
  }


  /* ---------- draw ---------- */
  var lastNow = 0, settling = false, EPS = 1e-4;   // settling: some smoothed value has not reached its target yet
  function draw(now) {
    var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016; lastNow = now;
    settling = false;
    var T = spacerH > 0 ? clamp(window.scrollY / spacerH, 0, 1) : 1;
    var M = marks();
    var K = clamp(T / Math.max(1e-3, M.knitEnd), 0, 1);                                            // knit
    var sh = clamp((T - M.shiftStart) / Math.max(1e-3, M.shiftEnd - M.shiftStart), 0, 1);        // shift (after hold 1)
    var u = clamp((T - M.settleStart) / Math.max(1e-3, 1 - M.settleStart), 0, 1);                // settle (after hold 2)
    var uSeal = vw < 768 ? clamp(u / Math.max(0.05, SEAL.mobile.sealLandAt), 0, 1) : u;   // phones: the seal lands early
    var e = lerp(uSeal, smooth(uSeal), SEAL.travelEase);
    parallax(T, sh, u);
    document.body.classList.toggle('seal-stage', T < 1);

    var tgt = targetCircle(), mobile = vw < 768, R0 = Math.min(vw, vh) * SEAL.fgRadius;
    var fg1 = { x: vw * SEAL.fgX, y: vh * SEAL.fgY, R: R0 };
    var fg2 = { x: vw * (mobile ? SEAL.fgX2Mobile : SEAL.fgX2), y: vh * (mobile ? SEAL.fgY2Mobile : SEAL.fgY2), R: R0 * SEAL.fgScale2 };
    var e2 = smooth(sh);
    var cx = lerp(fg1.x, fg2.x, e2), cy = lerp(fg1.y, fg2.y, e2), R = lerp(fg1.R, fg2.R, e2);
    if (u > 0) { cx = lerp(fg2.x, tgt.x, e); cy = lerp(fg2.y, tgt.y, e); R = lerp(fg2.R, tgt.R, e); }
    if (uSeal >= 1) { cx = tgt.x; cy = tgt.y; R = tgt.R; }
    if (T >= 1) { cx = tgt.x; cy = tgt.y; R = tgt.R; }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, ch);
    var bg = 1 - smooth((T - SEAL.bgFadeStart) / (SEAL.bgFadeEnd - SEAL.bgFadeStart));
    if (bg > 0) { ctx.globalAlpha = bg; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, ch); }

    // off screen after landing → nothing to draw
    if (T >= 1 && (cy + R * 1.8 < 0 || cy - R > ch)) { ctx.globalAlpha = 1; return; }

    function sx(u, v) { return cx + (u * D[0] + v * N[0]) * R; }
    function sy(u, v) { return cy - (u * D[1] + v * N[1]) * R; }

    // pointer / tilt reaction: stripes swell under the pointer and thin out far from it;
    // digits far from it roll downward (Matrix-like), the near ones stay readable
    var H = SEAL.hover, k = 1 - Math.pow(1 - H.smoothing, dt * 60);
    var P = K >= 1 ? sealPointer(cx, cy, R) : null;   // no reaction until the seal is fully formed (Igor)
    // the reaction only counts while the pointer is on or near the seal; a pointer elsewhere on the
    // page leaves the seal at rest (otherwise every stripe would thin out and every digit roll)
    var on = P ? smooth(1 - (Math.hypot(P[0], P[1]) - 1) / H.reachOut) : 0;
    if (on <= 0) P = null;
    var edge = P ? smooth((Math.hypot(P[0], P[1]) - H.flyEdge) / (1 - H.flyEdge)) : 0;   // 0 at the centre … 1 at the rim
    var pv = P ? P[0] * N[0] + P[1] * N[1] : 0;                                           // pointer's across-stripe coordinate
    var pu = P ? P[0] * D[0] + P[1] * D[1] : 0;                                           // … and along-stripe coordinate

    ctx.lineCap = 'butt'; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.globalAlpha = 1;
    for (var i = 0; i < stripes.length; i++) {
      var s = stripes[i], g = smooth((K - startOf(s)) / SEAL.growDur);
      var wt = 1;
      // target width in R units: far from the pointer the line thins (× thin), under it it fattens (× thick)
      var wt = s.th;
      if (P) { var near = smooth(1 - segDist(P, s) / H.radius); wt = s.th * lerp(1, lerp(H.thin, H.thick, near), on); }
      s.wcur = (s.wcur == null ? s.th : s.wcur) + (wt - (s.wcur == null ? s.th : s.wcur)) * k;
      if (Math.abs(wt - s.wcur) > EPS) settling = true;
      // hover displacement: the row slides out along its stripe as in the formation, more the closer
      // the pointer is to the rim, more for rows near the pointer
      var ft = 0;
      // weighted by the pointer's distance to the ROW (not the segment), so a whole row moves as one
      // rigid piece and nothing inside it can collide
      if (P && K >= 1) { var nearS = smooth(1 - Math.abs(pv - s.v) / H.flyRadius); ft = hoverShift(s.ri, (s.u0 + s.u1) / 2, on * edge * H.fly * lerp(H.flyFar, H.flyNear, nearS), pu); }
      s.fly = (s.fly || 0) + (ft - (s.fly || 0)) * k;
      if (Math.abs(ft - s.fly) > EPS) settling = true;
      if (g <= 0) continue;
      ctx.lineWidth = Math.max(0.6, s.wcur * SEAL.thicknessScale * R);
      if (SEAL.formation >= 0.5) {                       // fly-in: whole segment slides along its stripe into place
        var fo = flyOffset(s.ri, g, R) + s.fly;
        ctx.beginPath(); ctx.moveTo(sx(s.u0 + fo, s.v), sy(s.u0 + fo, s.v)); ctx.lineTo(sx(s.u1 + fo, s.v), sy(s.u1 + fo, s.v)); ctx.stroke();
      } else {                                           // knit: grows from its lower-left end
        var u1 = lerp(s.u0, s.u1, g), fk = s.fly;
        ctx.beginPath(); ctx.moveTo(sx(s.u0 + fk, s.v), sy(s.u0 + fk, s.v)); ctx.lineTo(sx(u1 + fk, s.v), sy(u1 + fk, s.v)); ctx.stroke();
      }
    }

    var px = DATA.glyphH * R * 1.43 * SEAL.digitScale;          // glyph height is ~0.70 of the font size
    ctx.font = SEAL.digitWeight + ' ' + px.toFixed(2) + 'px "IBM Plex Mono", Menlo, Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var j = 0; j < digits.length; j++) {
      var d = digits[j], dtx = digitText(d, K, now / 1000);
      var x = cx + d.x * R, y = cy - d.y * R + px * 0.04;
      if (SEAL.formation >= 0.5 && K < 1) {                // fly-in: the digit rides with its row
        var gd = smooth((K - startOf(d)) / SEAL.growDur), fd = flyOffset(d.ri, gd, R);
        x += fd * D[0] * R; y -= fd * D[1] * R;
      }
      // hover: digits stay white and keep their value (Igor, v15); they only ride with their row
      var dft = 0;
      if (P && K >= 1) { var nearD = smooth(1 - Math.abs(pv - rowsV[d.ri]) / H.flyRadius); dft = hoverShift(d.ri, d.x * D[0] + d.y * D[1], on * edge * H.fly * lerp(H.flyFar, H.flyNear, nearD), pu); }
      d.fly = (d.fly || 0) + (dft - (d.fly || 0)) * k;
      if (Math.abs(dft - d.fly) > EPS) settling = true;
      x += d.fly * D[0] * R; y -= d.fly * D[1] * R;
      if (!dtx) continue;
      if (dtx.alpha < 1 || dtx.text !== d.t) settling = true;   // matrix flicker / count-up still running → keep animating
      ctx.globalAlpha = dtx.alpha; ctx.fillText(dtx.text, x, y);
    }

    // wordmark (crop of the original artwork) beneath the seal
    var wa = smooth((T - SEAL.wordmarkFrom) / (1 - SEAL.wordmarkFrom));
    if (wa > 0 && wordmark.complete && wordmark.naturalWidth) {
      var wm = DATA.wordmark, w = wm.w * R, h = wm.h * R;
      ctx.globalAlpha = wa;
      ctx.drawImage(wordmark, cx + wm.x * R - w / 2, cy - wm.y * R - h / 2, w, h);
    }
    if (SEAL.showTarget) { ctx.globalAlpha = 0.6; ctx.strokeStyle = '#5cfe50'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(tgt.x, tgt.y, tgt.R, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  /* Render on demand (v22). A frame is drawn only when something can have changed: the scroll, the
     pointer / tilt, a knob (the tuner calls SEAL_INVALIDATE), the layout, a font or the wordmark
     arriving, or a smoothed value still travelling toward its target (`settling`). At rest — the
     normal state once the seal has landed — nothing is drawn at all, which is what keeps phones cool;
     before, the full canvas was cleared and redrawn 60 times a second forever. */
  var dirty = true, lastScrollY = -1, lastPointerKey = '';
  function pointerKey() {
    return (pointer ? pointer[0] + ',' + pointer[1] : '-') + '|' + (tilt ? tilt[0].toFixed(3) + ',' + tilt[1].toFixed(3) : '-') + '|' + (touchUntil ? 1 : 0);
  }
  window.SEAL_INVALIDATE = function () { dirty = true; };
  function frame(now) {
    if (totalVH() !== lastTotalVH || SEAL.quality.dprMax !== lastDpr || SEAL.quality.softBlur !== lastBlur) {
      lastTotalVH = totalVH(); lastDpr = SEAL.quality.dprMax; lastBlur = SEAL.quality.softBlur; layout();
    }
    var pk = pointerKey(), sy = window.scrollY;
    if (sy !== lastScrollY || pk !== lastPointerKey) { dirty = true; lastScrollY = sy; lastPointerKey = pk; }
    if (dirty || settling) { dirty = false; draw(now); }
    requestAnimationFrame(frame);
  }
  layout();
  // the address bar collapsing / expanding on phones fires resize with the same width: only the canvas
  // backing store follows it (inside layout, via `ch`); vh and the spacer stay put (probe = 100vh)
  window.addEventListener('resize', layout);
  wordmark.onload = function () { dirty = true; };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dirty = true; });   // first frames may have used the fallback font
  requestAnimationFrame(frame);

  /* auto-play: the page is a stage at T = 0, so unless the visitor scrolls within half a second we
     scroll it for them, through the knit — same code path as a real scroll, so it stays reversible.
     Any wheel / touch / key input hands control back immediately. */
  (function autoPlay() {
    if (REDUCED || !SEAL.autoPlay || window.scrollY > 2) return;
    var cancelled = false, t0 = null;
    function cancel() { cancelled = true; ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) { window.removeEventListener(ev, cancel); }); }
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) { window.addEventListener(ev, cancel, { passive: true }); });
    function step(now) {
      if (cancelled || !SEAL.autoPlay) return;
      if (t0 === null) t0 = now;
      var p = clamp((now - t0) / SEAL.autoPlayMs, 0, 1), eased = 1 - Math.pow(1 - p, 2.2);
      var to = SEAL.autoPlayTo < 0 ? marks().knitEnd : SEAL.autoPlayTo;
      window.scrollTo({ top: Math.round(eased * to * spacerH), behavior: 'instant' });
      if (p < 1) requestAnimationFrame(step); else cancel();
    }
    setTimeout(function () { if (!cancelled && window.scrollY <= 2) requestAnimationFrame(step); else cancel(); }, 500);
  })();

  window.SEAL_INFO = function () {
    return { dpr: dpr, canvasPx: canvas.width + '×' + canvas.height, softBlur: SEAL.quality.softBlur,
             T: spacerH > 0 ? clamp(window.scrollY / spacerH, 0, 1) : 1, spacerPx: spacerH, target: targetCircle() };
  };
  window.SEAL_SCROLL = function (T) { window.scrollTo({ top: Math.round(clamp(T, 0, 1) * spacerH), behavior: 'instant' }); };
})();
