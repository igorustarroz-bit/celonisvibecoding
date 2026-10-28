/* Event markers on the hero globe (experiment 2, 3d-globe).

   Four fictional "Process Intelligence Days" events are pinned to the sphere.
   Each one is a very flat 3D cylinder lying on the surface (not a CSS dot), and
   the cities are laced together by great-circle arcs with a flight travelling
   along each of them. Clicking a marker opens the Web DS city card next to it.

   It does NOT touch globe.js. The visuals go on their own canvas stacked over
   #earth-canvas inside p.world (same buffer, same projection, no blur filter);
   the clickable areas and the card stay in a fixed DOM overlay so they never
   inherit the hero's scroll transform.

   The card is a static look-alike: no form elements, no cross-origin request
   and no link to the client's domain (anti-phishing rules 12 and 13). */
(function () {
  'use strict';

  var GE = window.GLOBE_EVENTS = {
    // ---- marker: a very flat cylinder standing on the sphere
    // (the numbers below are the set Igor copied out of the tuner, 2026-10-28)
    discRadiusDeg: 0.7,     // radius on the sphere, in degrees of arc
    discHeight: 0.009,      // extrusion along the normal, as a fraction of R
    discColor: '#5cfe50',
    discWall: 0.42,         // how much darker the side wall is (0 = same, 1 = black)
    discEdge: 0,            // rim around the top face (0 = none; it reads as a hard line)
    discShade: 0.35,        // light/shadow across the top face (0 = flat colour)
    discGlow: 0.45,         // soft glow under the marker (0 = none)
    // Two layers of blur. Igor asked for everything green to sit softer, but at
    // this size a single heavy blur turns the cylinder into a blob, so the glow,
    // the ripple and the arcs go on a heavily blurred canvas and the cylinder
    // itself on a nearly sharp one above it.
    blurPx: 1.9,            // blur of the soft layer (glow, ripple, arcs)
    discBlurPx: 0.6,        // blur of the marker layer (0 = fully sharp)
    hoverGrow: 1.35,        // radius multiplier on hover / while open
    limbFadeZ: 0.18,        // markers fade in over this view-space z
    // ---- the pulse: an ultra-flat ghost cylinder growing out of the marker
    pulse: 1,
    pulseMs: 2400,
    pulseCount: 1,          // how many are in flight at once, evenly staggered
    rippleScale: 3.6,       // how far it grows, as a multiple of the marker radius
    rippleFlat: 0.25,       // its height, as a fraction of the marker's
    rippleOpacity: 0.45,
    // ---- flight arcs between the cities
    arcs: 1,
    // How many flights. The list is ordered ring-first, so with four cities
    // arcCount 4 gives every destination exactly one flight in and one out;
    // 5 and 6 add the diagonals, below 4 it opens into a chain.
    arcCount: 4,
    arcAltitude: 0.075,     // peak height: fraction of the angular distance, x R.
                            // The flights hug the globe; much above ~0.09 and they
                            // arch out of the hero.
    arcWidthRatio: 0.002,   // stroke width / canvas buffer size
    // Stripe's globe does not keep the arc on screen: the line is drawn by the
    // flight's own tail and then it is gone. arcPersist 0 is that; 1 brings the
    // steady line back.
    arcPersist: 0,
    arcOpacity: 0.55,       // opacity of the steady line, when it is on
    arcColor: '#5cfe50',
    arcColor2: '#b7ffae',   // a lighter green — no white anywhere on the globe
    arcSamples: 72,
    // ---- the "flight" travelling along each arc
    flights: 1,
    flightMs: 5200,
    flightTrail: 0.34,      // length of the comet tail, as a fraction of the arc
                            // (long, because with arcPersist 0 the tail IS the arc)
    flightSize: 1.4,        // head size, as a multiple of the arc stroke width
    // ---- card
    cardOffsetPx: 20,       // gap between the marker and the card edge
    cardBorder: 1,          // 0 = pure Figma black card with no hairline
    pauseSpin: 1,           // 1 = the auto-spin stops while a card is open
    events: [
      { id: 'munich',        city: 'Munich',        lat: 48.1374, lon:   11.5755, date: 'Nov. 12, 2026' },
      { id: 'madrid',        city: 'Madrid',        lat: 40.4168, lon:   -3.7038, date: 'Nov. 26, 2026' },
      { id: 'san-francisco', city: 'San Francisco', lat: 37.7749, lon: -122.4194, date: 'Dec. 3, 2026'  },
      { id: 'tokyo',         city: 'Tokyo',         lat: 35.6762, lon:  139.6503, date: 'Dec. 10, 2026' }
    ],
    kicker: ['Process', 'Intelligence Days']
  };

  // per-city inset of the badge vector inside its 116px box (from the Figma frame)
  var BADGE_INSET = {
    'munich': '4% 5%',
    'madrid': '4%',
    'san-francisco': '4%',
    'tokyo': '4% 5%'
  };

  var ARROW = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M10.1614 1.72394L18.3333 9.99748L18.3308 10L18.3333 10.0025L10.1614 18.2761L9.43899 17.5447L16.4146 10.4823H1.66667L1.66667 9.44798H16.3458L9.43899 2.45533L10.1614 1.72394Z" fill="#CBCBCB"/></svg>';

  var canvas = document.getElementById('earth-canvas');
  if (!canvas) return;

  /* ===================================================================
     The overlay canvas — stacked on #earth-canvas, same buffer, no blur
     =================================================================== */
  var world = canvas.parentNode;
  if (world && window.getComputedStyle(world).position === 'static') world.style.position = 'relative';
  function overlay(cls, after) {
    var el = document.createElement('canvas');
    el.className = 'ge-canvas ' + cls;
    el.setAttribute('aria-hidden', 'true');
    world.insertBefore(el, after.nextSibling);   // stacking order IS the DOM order here
    return el;
  }
  var soft = overlay('ge-canvas--soft', canvas); // glow, ripple, flight arcs — heavily blurred
  var fx = overlay('ge-canvas--disc', soft);     // the cylinders — nearly sharp, on top
  var sctx = soft.getContext('2d');
  var fctx = fx.getContext('2d');

  /* ===================================================================
     The DOM layer — invisible hit areas + the card
     =================================================================== */
  var layer = document.createElement('div');
  layer.className = 'ge-layer';

  var card = document.createElement('div');
  card.className = 'ge-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Event details');
  card.style.display = 'none';
  card.innerHTML =
    '<p class="ge-card__kicker">' + GE.kicker[0] + '<br>' + GE.kicker[1] + '</p>' +
    '<p class="ge-card__city"></p>' +
    '<span class="ge-card__badge"><img alt=""></span>' +
    '<a class="ge-card__btn" href="#" role="button" aria-label="Event details">' + ARROW + '</a>' +
    '<p class="ge-card__date"></p>';
  layer.appendChild(card);

  var cardCity = card.querySelector('.ge-card__city');
  var cardDate = card.querySelector('.ge-card__date');
  var cardBadge = card.querySelector('.ge-card__badge img');
  card.querySelector('.ge-card__btn').addEventListener('click', function (e) {
    e.preventDefault(); // inert on a client replica — nothing links out (rule 13)
  });

  function unitVec(lat, lon) {
    var phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
    var cphi = Math.cos(phi);
    return [cphi * Math.sin(lam), Math.sin(phi), cphi * Math.cos(lam)];
  }

  var markers = GE.events.map(function (ev) {
    var el = document.createElement('div');
    el.className = 'ge-hit';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', GE.kicker.join(' ') + ', ' + ev.city + ', ' + ev.date);
    layer.insertBefore(el, card);
    return { ev: ev, el: el, p: unitVec(ev.lat, ev.lon), shown: false, hover: false, x: 0, y: 0 };
  });

  document.body.appendChild(layer);

  /* ===================================================================
     Maths — the same matrix globe.js builds in draw()
     =================================================================== */
  function earth() { return window.__earth; }

  function viewMatrix(cfg, st) {
    var tilt = (cfg.tiltDeg + st.pitch) * Math.PI / 180;
    var roll = Math.sin(st.wobble * 2 * Math.PI) * cfg.rollDeg * Math.PI / 180;
    var spin = st.spin * 2 * Math.PI + st.dragLon;
    var cs = Math.cos(spin), ss = Math.sin(spin);
    var ct = Math.cos(tilt), stt = Math.sin(tilt);
    var cr = Math.cos(roll), sr = Math.sin(roll);
    var a00 = cs, a02 = ss, a20 = -ss, a22 = cs;           // Ry(spin)
    var b00 = a00, b01 = 0, b02 = a02;                      // Rx(tilt) * Ry(spin)
    var b10 = -stt * a20, b11 = ct, b12 = -stt * a22;
    var b20 = ct * a20, b21 = stt, b22 = ct * a22;
    return [                                                // Rz(roll) * (Rx*Ry)
      cr * b00 - sr * b10, cr * b01 - sr * b11, cr * b02 - sr * b12,
      sr * b00 + cr * b10, sr * b01 + cr * b11, sr * b02 + cr * b12,
      b20, b21, b22
    ];
  }

  function rot(m, p) {
    return [
      m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
      m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
      m[6] * p[0] + m[7] * p[1] + m[8] * p[2]
    ];
  }

  function slerp(a, b, t, omega, sinw) {
    if (sinw < 1e-6) return [a[0], a[1], a[2]];
    var k0 = Math.sin((1 - t) * omega) / sinw;
    var k1 = Math.sin(t * omega) / sinw;
    return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
  }

  function rgb(hex) {
    var h = (hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!isFinite(n)) return [92, 254, 80];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function mix(c, k) {
    return [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
  }

  // globe.js lights the sphere from here; the marker has to agree with it
  var LD = (function () {
    var l = [-0.30, 0.62, 0.72], n = Math.hypot(l[0], l[1], l[2]);
    return [l[0] / n, l[1] / n, l[2] / n];
  })();

  // Andrew's monotone chain — the silhouette of the cylinder is the convex hull
  // of the two ellipses (the union of a convex shape and a copy of it offset by
  // the extrusion vector IS their convex hull).
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var lo = [], hi = [], i;
    function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    for (i = 0; i < pts.length; i++) {
      while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop();
      lo.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], pts[i]) <= 0) hi.pop();
      hi.push(pts[i]);
    }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }

  /* ===================================================================
     Drawing
     =================================================================== */
  // A point above the sphere is hidden only when it is behind the centre plane
  // AND inside the silhouette — that is exact for an orthographic camera.
  function occluded(v) { return v[2] < 0 && (v[0] * v[0] + v[1] * v[1]) < 1; }

  // Geometry of a flat cylinder standing on the sphere at v. Under an
  // orthographic camera the circle of radius rPx in the tangent plane projects
  // to an ellipse: minor axis rPx·v.z along the normal's screen direction,
  // major axis rPx. Shared by the marker and by the pulse.
  function cyl(v, R, cx, cy, yOff, rPx, hFrac) {
    var h = hFrac * R;
    var bx = cx + v[0] * R, by = cy - v[1] * R + yOff;
    return {
      ang: Math.atan2(-v[1], v[0]), nz: v[2], r: rPx,
      bx: bx, by: by,
      tx: bx + v[0] * h, ty: by - v[1] * h,
      minor: Math.max(0.35, rPx * v[2])
    };
  }

  // The silhouette is the convex hull of the bottom and top ellipses — the
  // union of a convex shape and a copy of it offset by the extrusion vector IS
  // their convex hull.
  function cylPath(g, c) {
    var pts = [], i, ca = Math.cos(c.ang), sa = Math.sin(c.ang);
    for (i = 0; i < 28; i++) {
      var a = i / 28 * 2 * Math.PI;
      var ex = Math.cos(a) * c.minor, ey = Math.sin(a) * c.r;
      var px = ex * ca - ey * sa, py = ex * sa + ey * ca;
      pts.push([c.bx + px, c.by + py], [c.tx + px, c.ty + py]);
    }
    var hl = hull(pts), j;
    g.beginPath();
    g.moveTo(hl[0][0], hl[0][1]);
    for (j = 1; j < hl.length; j++) g.lineTo(hl[j][0], hl[j][1]);
    g.closePath();
  }

  function drawDisc(g, gs, v, R, cx, cy, yOff, rPx, col, alpha, t) {
    var c = cyl(v, R, cx, cy, yOff, rPx, GE.discHeight);
    var i;

    if (GE.discGlow > 0) {                       // glow, on the soft layer
      var gl = gs.createRadialGradient(c.tx, c.ty, 0, c.tx, c.ty, rPx * 4.2);
      gl.addColorStop(0, rgba(col, 0.42 * GE.discGlow * alpha));
      gl.addColorStop(1, rgba(col, 0));
      gs.fillStyle = gl;
      gs.beginPath();
      gs.ellipse(c.tx, c.ty, rPx * 4.2, Math.max(0.5, rPx * 4.2 * c.nz), c.ang, 0, 2 * Math.PI);
      gs.fill();
    }

    if (GE.pulse) {
      // The pulse Igor asked back for: not a stroked ring (that read as an
      // orbit) but an ULTRA-FLAT ghost cylinder growing horizontally out of the
      // marker and fading. It is drawn on the soft layer, so it is blurred and
      // it passes under the marker instead of covering it.
      var n = Math.max(1, Math.round(GE.pulseCount));
      for (i = 0; i < n; i++) {
        var ph = ((t / GE.pulseMs) + i / n) % 1;
        var fadeP = (1 - ph) * (1 - ph);
        var aP = GE.rippleOpacity * fadeP * alpha;
        if (aP <= 0.004) continue;
        var rr = rPx * (1 + (GE.rippleScale - 1) * ph);
        var cp = cyl(v, R, cx, cy, yOff, rr, GE.discHeight * GE.rippleFlat);
        cylPath(gs, cp);
        gs.fillStyle = rgba(col, aP * 0.75);     // the wall of the ghost
        gs.fill();
        gs.beginPath();                          // its top face
        gs.ellipse(cp.tx, cp.ty, cp.minor, cp.r, cp.ang, 0, 2 * Math.PI);
        gs.fillStyle = rgba(mix(col, 1.15), aP);
        gs.fill();
      }
    }

    cylPath(g, c);                               // the side wall
    g.fillStyle = rgba(mix(col, 1 - GE.discWall), alpha);
    g.fill();

    g.beginPath();                               // the lit top face
    g.ellipse(c.tx, c.ty, c.minor, c.r, c.ang, 0, 2 * Math.PI);
    if (GE.discShade > 0) {
      var ls = Math.hypot(LD[0], LD[1]) || 1;
      var sx = LD[0] / ls, sy = -LD[1] / ls;     // light direction on screen
      var sg = g.createLinearGradient(c.tx - sx * rPx, c.ty - sy * rPx, c.tx + sx * rPx, c.ty + sy * rPx);
      sg.addColorStop(0, rgba(mix(col, 1 - 0.45 * GE.discShade), alpha));
      sg.addColorStop(1, rgba(mix(col, 1 + 0.30 * GE.discShade), alpha));
      g.fillStyle = sg;
    } else {
      g.fillStyle = rgba(col, alpha);
    }
    g.fill();

    if (GE.discEdge > 0) {
      g.strokeStyle = rgba(mix(col, 1.35), GE.discEdge * alpha * 0.8);
      g.lineWidth = Math.max(0.8, rPx * 0.1);
      g.stroke();
    }
    return [c.tx, c.ty];
  }

  // Ordered ring first: with four cities, the first four pairs give every
  // destination exactly one flight in and one out. Then the diagonals.
  // arcCount takes the first N — that is the "more or less flights" handle.
  function arcPairs() {
    var n = markers.length, out = [], i, j;
    for (i = 0; i < n; i++) out.push([i, (i + 1) % n]);
    for (i = 0; i < n; i++) {
      for (j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;    // that one is already the ring's last leg
        out.push([i, j]);
      }
    }
    return out.slice(0, Math.max(0, Math.round(GE.arcCount)));
  }

  function drawArcs(g, m3, R, cx, cy, yOff, size, alpha, t) {
    var pairs = arcPairs();
    var c1 = rgb(GE.arcColor), c2 = rgb(GE.arcColor2);
    var lw = Math.max(1, size * GE.arcWidthRatio);
    var N = Math.max(16, Math.round(GE.arcSamples));

    for (var k = 0; k < pairs.length; k++) {
      var A = markers[pairs[k][0]].p, B = markers[pairs[k][1]].p;
      var dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
      var omega = Math.acos(dot), sinw = Math.sin(omega);
      var lift = GE.arcAltitude * (omega / Math.PI);

      var pts = [], vis = [], i;
      for (i = 0; i <= N; i++) {
        var u = i / N;
        var s = slerp(A, B, u, omega, sinw);
        var r = 1 + lift * Math.sin(Math.PI * u);
        var v = rot(m3, s);
        pts.push([cx + v[0] * r * R, cy - v[1] * r * R + yOff]);
        vis.push(!occluded([v[0] * r, v[1] * r, v[2]]));
      }

      g.lineCap = 'round';
      g.lineJoin = 'round';

      if (GE.arcPersist) {                        // the steady line, off by default
        var grad = g.createLinearGradient(pts[0][0], pts[0][1], pts[N][0], pts[N][1]);
        grad.addColorStop(0, rgba(c1, GE.arcOpacity * alpha));
        grad.addColorStop(0.5, rgba(c2, GE.arcOpacity * 0.75 * alpha));
        grad.addColorStop(1, rgba(c1, GE.arcOpacity * alpha));
        g.strokeStyle = grad;
        g.lineWidth = lw;
        var open = false;                         // stroke each visible run
        g.beginPath();
        for (i = 0; i <= N; i++) {
          if (!vis[i]) { open = false; continue; }
          if (!open) { g.moveTo(pts[i][0], pts[i][1]); open = true; }
          else g.lineTo(pts[i][0], pts[i][1]);
        }
        g.stroke();
      }

      if (!GE.flights) continue;
      // The flight. With arcPersist 0 this tail is the only thing that ever
      // draws the arc: it paints it on the way and it is gone behind the head.
      var ph = ((t / GE.flightMs) + k / pairs.length) % 1;
      var head = Math.round(ph * N);
      var span = Math.max(1, Math.round(GE.flightTrail * N));
      var tail = head - span;
      for (i = Math.max(0, tail); i < head; i++) {
        if (!vis[i] || !vis[i + 1]) continue;
        var f = (i - tail) / span;                // 0 at the end of the tail, 1 at the head
        var aT = Math.min(1, 0.95 * f * f * f * alpha);
        if (aT <= 0.004) continue;
        g.strokeStyle = rgba(c2, aT);
        g.lineWidth = lw * (0.45 + 0.75 * f);     // the tail tapers into nothing
        g.beginPath();
        g.moveTo(pts[i][0], pts[i][1]);
        g.lineTo(pts[i + 1][0], pts[i + 1][1]);
        g.stroke();
      }
      if (vis[head] && GE.flightSize > 0) {
        g.fillStyle = rgba(c2, 0.9 * alpha);
        g.beginPath();
        g.arc(pts[head][0], pts[head][1], lw * GE.flightSize, 0, 2 * Math.PI);
        g.fill();
      }
    }
  }

  /* ===================================================================
     Open / close
     =================================================================== */
  var openId = null;

  function spin(play) {
    var e = earth();
    if (!e || !e.spinAnim || !GE.pauseSpin) return;
    try { play ? e.spinAnim.play() : e.spinAnim.pause(); } catch (err) {}
  }

  function openCard(m) {
    openId = m.ev.id;
    cardCity.textContent = m.ev.city;
    cardDate.textContent = m.ev.date;
    cardBadge.src = 'anime-globe/badges/badge-' + m.ev.id + '.svg';
    cardBadge.style.inset = BADGE_INSET[m.ev.id] || '4%';
    card.classList.toggle('no-border', !GE.cardBorder);
    card.style.display = 'block';
    spin(false);
    frame(true);
    requestAnimationFrame(function () { card.classList.add('is-open'); });
  }

  function closeCard() {
    if (openId === null) return;
    openId = null;
    card.classList.remove('is-open');
    setTimeout(function () { if (openId === null) card.style.display = 'none'; }, 200);
    spin(true);
  }

  markers.forEach(function (m) {
    var downX = 0, downY = 0;
    m.el.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; });
    m.el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return; // it was a drag
      if (openId === m.ev.id) closeCard(); else openCard(m);
    });
    m.el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (openId === m.ev.id) closeCard(); else openCard(m);
    });
    m.el.addEventListener('pointerenter', function () { m.hover = true; });
    m.el.addEventListener('pointerleave', function () { m.hover = false; });
  });

  card.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', closeCard);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(); });

  /* ===================================================================
     Frame
     =================================================================== */
  var inView = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (!inView) closeCard();
    }, { rootMargin: '10% 0px' }).observe(canvas);
  }

  function placeCard(m) {
    var w = card.offsetWidth || 200, h = card.offsetHeight || 272;
    var pad = 12;
    var vw = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
    var vh = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
    var x = m.x + GE.cardOffsetPx;
    if (x + w + pad > vw) x = m.x - GE.cardOffsetPx - w;       // flip to the left
    if (x < pad) x = Math.min(pad, Math.max(0, vw - w - pad));
    var y = m.y - h / 2;
    if (y + h + pad > vh) y = vh - h - pad;
    if (y < pad) y = pad;
    card.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }

  function frame(force) {
    var e = earth();
    if (!e) return;
    if (!inView && !force) return;
    var cfg = e.cfg, st = e.state;
    var size = canvas.width;
    if (!size) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    if (fx.width !== size || fx.height !== canvas.height) {
      fx.width = soft.width = size;
      fx.height = soft.height = canvas.height;
    }
    fctx.clearRect(0, 0, fx.width, fx.height);
    sctx.clearRect(0, 0, soft.width, soft.height);

    var m3 = viewMatrix(cfg, st);
    var R = size * cfg.radiusRatio * st.scale;
    var c = size / 2;
    var yOff = st.rise * size * 0.10;
    var kx = rect.width / size, ky = rect.height / size;
    var alpha = st.alpha;
    var t = performance.now();
    var col = rgb(GE.discColor);
    var fade = GE.limbFadeZ > 0 ? GE.limbFadeZ : 0.0001;

    if (alpha <= 0.02) { markers.forEach(hide); return; }
    if (GE.arcs) drawArcs(sctx, m3, R, c, c, yOff, size, alpha, t);

    for (var i = 0; i < markers.length; i++) {
      var mk = markers[i];
      var v = rot(m3, mk.p);
      var op = v[2] > 0.02 ? Math.min(1, (v[2] - 0.02) / fade) * alpha : 0;
      if (op < 0.02) {
        hide(mk);
        if (openId === mk.ev.id) closeCard();
        continue;
      }
      var grow = (openId === mk.ev.id || mk.hover) ? GE.hoverGrow : 1;
      var rPx = Math.sin(GE.discRadiusDeg * Math.PI / 180) * R * grow;
      var top = drawDisc(fctx, sctx, v, R, c, c, yOff, rPx, col, op, t);

      mk.x = rect.left + top[0] * kx;             // viewport position of the top face
      mk.y = rect.top + top[1] * ky;
      var hit = Math.max(24, 2.2 * rPx * kx);
      if (!mk.shown) { mk.el.style.display = 'block'; mk.shown = true; }
      mk.el.style.width = hit.toFixed(1) + 'px';
      mk.el.style.height = hit.toFixed(1) + 'px';
      mk.el.style.transform = 'translate(' + mk.x.toFixed(1) + 'px,' + mk.y.toFixed(1) + 'px) translate(-50%,-50%)';
      if (openId === mk.ev.id) placeCard(mk);
    }
  }

  function hide(mk) { if (mk.shown) { mk.el.style.display = 'none'; mk.shown = false; } }

  function applyStyle() {
    card.classList.toggle('no-border', !GE.cardBorder);
    soft.style.filter = GE.blurPx > 0 ? 'blur(' + GE.blurPx + 'px)' : '';
    fx.style.filter = GE.discBlurPx > 0 ? 'blur(' + GE.discBlurPx + 'px)' : '';
  }

  function loop() { frame(false); requestAnimationFrame(loop); }

  // globe.js may still be booting
  (function waitForEarth(tries) {
    if (window.__earth) {
      applyStyle();
      frame(true);
      requestAnimationFrame(loop);
      return;
    }
    if (tries > 100) return;
    setTimeout(function () { waitForEarth(tries + 1); }, 50);
  })(0);

  GE.apply = applyStyle;
  GE.close = closeCard;
  GE.open = function (id) {
    var m = markers.filter(function (o) { return o.ev.id === id; })[0];
    if (m) openCard(m);
  };
})();
