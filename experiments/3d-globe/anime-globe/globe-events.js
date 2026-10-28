/* Event markers on the hero globe (experiment 2, 3d-globe).
   Four fictional "Process Intelligence Days" events are pinned to the sphere as
   green dots; clicking one opens the Web DS "Card08-City-collab" card next to it.

   It does NOT touch globe.js: the dots are projected with the same matrix,
   rebuilt here from the public window.__earth (cfg + state), and drawn as DOM
   in a fixed overlay so they never inherit the hero's scroll transform.

   The card is a static look-alike: no form elements, no cross-origin request
   and no link to the client's domain (anti-phishing rules 12 and 13). */
(function () {
  'use strict';

  var GE = window.GLOBE_EVENTS = {
    // marker
    dotColor: '#5cfe50',
    dotSizeRatio: 0.02,    // dot diameter / globe radius on screen
    dotMinPx: 9,
    dotMaxPx: 18,
    hoverGrow: 1.35,       // dot scale on hover / while open
    pulse: 1,              // 0 = static dot, 1 = pulsing halo
    pulseMs: 2200,
    haloScale: 2.6,
    limbFadeZ: 0.18,       // dots fade out below this view-space z (0 = none)
    // card
    cardOffsetPx: 20,      // gap between the dot and the card edge
    cardBorder: 1,         // 0 = pure Figma black card with no hairline
    pauseSpin: 1,          // 1 = the auto-spin stops while a card is open
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

  // ---------- DOM ----------
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

  var markers = GE.events.map(function (ev) {
    var el = document.createElement('div');
    el.className = 'ge-dot';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', GE.kicker.join(' ') + ', ' + ev.city + ', ' + ev.date);
    layer.insertBefore(el, card);
    return { ev: ev, el: el, visible: false, x: 0, y: 0, scale: 1 };
  });

  document.body.appendChild(layer);

  // ---------- projection (same matrix as globe.js draw()) ----------
  function earth() { return window.__earth; }

  function project(m, lat, lon) {
    var phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
    var cphi = Math.cos(phi);
    var px = cphi * Math.sin(lam), py = Math.sin(phi), pz = cphi * Math.cos(lam);
    return {
      x: m[0] * px + m[1] * py + m[2] * pz,
      y: m[3] * px + m[4] * py + m[5] * pz,
      z: m[6] * px + m[7] * py + m[8] * pz
    };
  }

  function viewMatrix(cfg, st) {
    var tilt = (cfg.tiltDeg + st.pitch) * Math.PI / 180;
    var roll = Math.sin(st.wobble * 2 * Math.PI) * cfg.rollDeg * Math.PI / 180;
    var spin = st.spin * 2 * Math.PI + st.dragLon;
    var cs = Math.cos(spin), ss = Math.sin(spin);
    var ct = Math.cos(tilt), stt = Math.sin(tilt);
    var cr = Math.cos(roll), sr = Math.sin(roll);
    // Ry(spin)
    var a00 = cs, a02 = ss, a20 = -ss, a22 = cs;
    // Rx(tilt) * Ry(spin)
    var b00 = a00, b01 = 0, b02 = a02;
    var b10 = -stt * a20, b11 = ct, b12 = -stt * a22;
    var b20 = ct * a20, b21 = stt, b22 = ct * a22;
    // Rz(roll) * (Rx*Ry)
    return [
      cr * b00 - sr * b10, cr * b01 - sr * b11, cr * b02 - sr * b12,
      sr * b00 + cr * b10, sr * b01 + cr * b11, sr * b02 + cr * b12,
      b20, b21, b22
    ];
  }

  // ---------- open / close ----------
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
    markers.forEach(function (o) { o.el.classList.toggle('is-open', o === m); });
    spin(false);
    frame(true);
    requestAnimationFrame(function () { card.classList.add('is-open'); });
  }

  function closeCard() {
    if (openId === null) return;
    openId = null;
    card.classList.remove('is-open');
    markers.forEach(function (o) { o.el.classList.remove('is-open'); });
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
    m.el.addEventListener('pointerenter', function () { m.el.classList.add('is-hover'); });
    m.el.addEventListener('pointerleave', function () { m.el.classList.remove('is-hover'); });
  });

  card.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', closeCard);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(); });

  // ---------- frame ----------
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
    if (x + w + pad > vw) x = m.x - GE.cardOffsetPx - w;       // flip to the left edge
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

    var m3 = viewMatrix(cfg, st);
    var R = size * cfg.radiusRatio * st.scale;
    var c = size / 2;
    var yOffset = st.rise * size * 0.10;
    var kx = rect.width / size, ky = rect.height / size;
    var Rcss = R * kx;
    var dot = Math.max(GE.dotMinPx, Math.min(GE.dotMaxPx, Rcss * GE.dotSizeRatio));
    var fade = GE.limbFadeZ > 0 ? GE.limbFadeZ : 0.0001;

    for (var i = 0; i < markers.length; i++) {
      var mk = markers[i];
      var p = project(m3, mk.ev.lat, mk.ev.lon);
      var vis = p.z > 0.02 && st.alpha > 0.05;
      var op = vis ? Math.min(1, (p.z - 0.02) / fade) * st.alpha : 0;
      if (op < 0.02) {
        if (mk.visible) { mk.el.style.display = 'none'; mk.visible = false; }
        if (openId === mk.ev.id) closeCard();
        continue;
      }
      if (!mk.visible) { mk.el.style.display = 'block'; mk.visible = true; }
      mk.x = rect.left + (c + p.x * R) * kx;
      mk.y = rect.top + (c - p.y * R + yOffset) * ky;
      var grow = (openId === mk.ev.id || mk.el.classList.contains('is-hover')) ? GE.hoverGrow : 1;
      mk.el.style.width = dot.toFixed(1) + 'px';
      mk.el.style.height = dot.toFixed(1) + 'px';
      mk.el.style.opacity = op.toFixed(3);
      mk.el.style.transform = 'translate(' + mk.x.toFixed(1) + 'px,' + mk.y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + grow.toFixed(2) + ')';
      if (openId === mk.ev.id) placeCard(mk);
    }
  }

  function applyStyle() {
    layer.style.setProperty('--ge-pulse-ms', GE.pulseMs + 'ms');
    layer.style.setProperty('--ge-halo', GE.haloScale);
    markers.forEach(function (m) {
      m.el.classList.toggle('is-pulsing', !!GE.pulse);
      m.el.style.background = GE.dotColor || '#5cfe50';
    });
    card.classList.toggle('no-border', !GE.cardBorder);
  }

  function loop() { frame(false); requestAnimationFrame(loop); }

  // globe.js may still be booting (it is loaded after us on some pages)
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
