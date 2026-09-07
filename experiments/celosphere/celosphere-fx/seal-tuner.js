/* =========================================================================
   Seal tuning panel (experiment 5) — same recipe as the Data Core / book tuners:
   sliders wired to window.SEAL, which seal-knit.js reads every frame, so everything
   is live. Bottom-right, starts collapsed as a "● SEAL TUNER" pill, expands upwards;
   the × in its header hides it (press T, or SEAL_TUNER.show(), to bring it back).
   "Copy settings" exports the JSON to paste as the new defaults in seal-knit.js;
   "Reset" restores the shipped values. The scrub slider drives the page scroll, so
   the whole sequence can be stepped through by hand and in reverse.
   Antialias section: Canvas 2D has no MSAA/FXAA — what decides edge quality here is
   the device pixel ratio the canvas renders at (dprMax) and the optional soft blur
   (CSS filter on the canvas). The read-out shows what is really in effect.
   ========================================================================= */
(function () {
  'use strict';
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function init() {
    var T = window.SEAL;
    if (!T) { setTimeout(init, 300); return; }

    var css = document.createElement('style');
    css.textContent = [
      '#sl-tuner{position:fixed;right:18px;bottom:18px;z-index:99999;width:268px;display:flex;flex-direction:column-reverse;',
      'font-family:Poppins,Arial,sans-serif;font-size:11px;color:#eee;background:rgba(6,6,8,.92);border:1px solid rgba(255,255,255,.25);',
      'border-radius:12px;overflow:hidden;user-select:none;line-height:1.3}',
      '#sl-tuner .hd{display:flex;justify-content:space-between;align-items:center;padding:9px 12px;cursor:pointer;font-weight:600;letter-spacing:.6px;height:auto;min-height:0}',
      '#sl-tuner .hd span.dot{color:#5cfe50}',
      '#sl-tuner .hd .ctl{display:flex;gap:10px;align-items:center}',
      '#sl-tuner .hd .ctl span{cursor:pointer;padding:0 2px;color:#aaa}',
      '#sl-tuner .hd .ctl span:hover{color:#5cfe50}',
      '#sl-tuner .body{padding:2px 12px 10px;max-height:70vh;overflow:auto}',
      '#sl-tuner .row{display:grid;grid-template-columns:96px 1fr 40px;gap:6px;align-items:center;margin:5px 0}',
      '#sl-tuner .row label{color:#aaa;white-space:nowrap;overflow:hidden}',
      '#sl-tuner input[type=range]{width:100%;accent-color:#5cfe50;height:14px}',
      '#sl-tuner .val{text-align:right;color:#5cfe50;font-variant-numeric:tabular-nums}',
      '#sl-tuner h4{margin:10px 0 2px;font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1.2px}',
      '#sl-tuner .btns{display:flex;gap:6px;margin-top:10px}',
      '#sl-tuner button{flex:1;padding:6px 0;border-radius:7px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#eee;font:inherit;cursor:pointer}',
      '#sl-tuner button:hover{border-color:#5cfe50;color:#5cfe50}',
      '#sl-tuner button.primary{border-color:#5cfe50;color:#5cfe50}',
      '#sl-tuner.min .body{display:none}'
    ].join('');
    document.head.appendChild(css);

    var DEFAULTS = JSON.parse(JSON.stringify(T));
    var panel = document.createElement('div');
    panel.id = 'sl-tuner'; panel.className = 'min';
    panel.innerHTML = '<div class="hd"><span><span class="dot">●</span> SEAL TUNER</span>' +
      '<span class="ctl"><span id="sl-tgl" title="Expand / collapse">+</span><span id="sl-hide" title="Hide the panel (press T to bring it back)">×</span></span></div><div class="body"></div>';
    document.body.appendChild(panel);
    var body = panel.querySelector('.body');
    panel.querySelector('.hd').addEventListener('click', function (e) {
      if (e.target.id === 'sl-hide') { hide(); return; }
      panel.classList.toggle('min');
      panel.querySelector('#sl-tgl').textContent = panel.classList.contains('min') ? '+' : '—';
    });
    function hide() { panel.style.display = 'none'; }
    function show() { panel.style.display = ''; }
    window.SEAL_TUNER = { show: show, hide: hide, toggle: function () { panel.style.display === 'none' ? show() : hide(); } };
    document.addEventListener('keydown', function (e) {
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) window.SEAL_TUNER.toggle();
    });

    function get(path) { return path.split('.').reduce(function (o, k) { return o[k]; }, T); }
    function set(path, val) { var ks = path.split('.'), o = T; for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = val; }
    var updaters = [];
    function slider(label, path, min, max, opts) {
      opts = opts || {};
      var row = document.createElement('div'); row.className = 'row';
      row.innerHTML = '<label title="' + path + '">' + label + '</label><input type="range"><span class="val"></span>';
      var inp = row.querySelector('input'), val = row.querySelector('.val');
      inp.min = min; inp.max = max; inp.step = opts.step || 0.01;
      var fmt = opts.fmt || function (v) { return (+v).toFixed(opts.step && opts.step >= 1 ? 0 : 2); };
      function refresh() { var v = get(path); inp.value = v; val.textContent = fmt(v); }
      refresh();
      inp.addEventListener('input', function () { set(path, +inp.value); val.textContent = fmt(+inp.value); });
      updaters.push(refresh); body.appendChild(row);
    }
    function section(t) { var h = document.createElement('h4'); h.textContent = t; body.appendChild(h); }
    var onoff = function (v) { return +v >= 0.5 ? 'on' : 'off'; };

    // scrub the sequence by hand (drives the real page scroll, so it is the same code path)
    section('Scrub');
    var scrub = document.createElement('div'); scrub.className = 'row';
    scrub.innerHTML = '<label>sequence T</label><input type="range" min="0" max="1" step="0.001"><span class="val">0.00</span>';
    body.appendChild(scrub);
    var scrubInp = scrub.querySelector('input'), scrubVal = scrub.querySelector('.val');
    scrubInp.addEventListener('input', function () { if (window.SEAL_SCROLL) window.SEAL_SCROLL(+scrubInp.value); });
    setInterval(function () { if (!window.SEAL_INFO) return; var t = window.SEAL_INFO().T; if (document.activeElement !== scrubInp) scrubInp.value = t; scrubVal.textContent = t.toFixed(2); }, 100);

    section('Timeline');
    slider('knit length (vh)', 'knitVH', 0.2, 3, { step: 0.05 });
    slider('hold 1 (vh)', 'hold1VH', 0, 4, { step: 0.05 });
    slider('shift length (vh)', 'shiftVH', 0.1, 3, { step: 0.05 });
    slider('hold 2 (vh)', 'hold2VH', 0, 4, { step: 0.05 });
    slider('settle length (vh)', 'settleVH', 0.2, 3, { step: 0.05 });
    slider('auto-play on load', 'autoPlay', 0, 1, { step: 1, fmt: onoff });
    slider('auto-play ms', 'autoPlayMs', 800, 6000, { step: 100 });
    slider('formation', 'formation', 0, 1, { step: 1, fmt: function (v) { return +v >= 0.5 ? 'fly-in' : 'knit'; } });
    slider('fly-in ease', 'flyEase', 0, 1);
    slider('grow duration', 'growDur', 0.05, 0.8);
    slider('order: row mix', 'orderMix', 0, 1);
    slider('travel ease', 'travelEase', 0, 1);
    slider('bg fade start', 'bgFadeStart', 0, 1);
    slider('bg fade end', 'bgFadeEnd', 0, 1);
    slider('wordmark from', 'wordmarkFrom', 0, 1);

    section('Digits');
    slider('matrix / count-up', 'digitMode', 0, 1, { step: 1, fmt: function (v) { return +v >= 0.5 ? 'matrix' : 'count'; } });
    slider('lead after front', 'digitLead', 0, 0.3);
    slider('flicker length', 'flickerLen', 0.02, 0.5);
    slider('flicker rate (Hz)', 'flickerRate', 2, 40, { step: 1 });
    slider('digit size', 'digitScale', 0.6, 1.6);
    slider('digit weight', 'digitWeight', 400, 600, { step: 100 });

    section('Geometry');
    slider('foreground radius', 'fgRadius', 0.15, 0.48);
    slider('frame 1 x', 'fgX', 0.2, 0.85);
    slider('frame 1 y', 'fgY', 0.3, 0.7);
    slider('frame 2 x', 'fgX2', 0.3, 0.9);
    slider('frame 2 y', 'fgY2', 0.3, 0.7);
    slider('frame 2 scale', 'fgScale2', 0.5, 1.2);
    slider('phone: frame 2 x', 'fgX2Mobile', 0.2, 0.8);
    slider('phone: frame 2 y', 'fgY2Mobile', 0.3, 0.8);
    slider('phone: title y', 'titleYMobile', 0.1, 0.5);
    slider('phone: seal lands at', 'mobile.sealLandAt', 0.3, 1);
    slider('phone: dates from left (vw)', 'mobile.datesDist', 0, 1.5);
    slider('stripe thickness', 'thicknessScale', 0.5, 1.5);
    slider('show target', 'showTarget', 0, 1, { step: 1, fmt: onoff });

    section('Pointer / tilt reaction');
    slider('reach (radii)', 'hover.radius', 0.2, 2);
    slider('reach beyond rim', 'hover.reachOut', 0.05, 2);
    slider('thick under pointer', 'hover.thick', 1, 3);
    slider('thin far away', 'hover.thin', 0.1, 1);
    slider('smoothing', 'hover.smoothing', 0.02, 0.5);
    slider('fly-out at rim (R)', 'hover.fly', 0, 1.5);
    slider('fly-out from (R)', 'hover.flyEdge', 0, 0.9);
    slider('fly-out near ×', 'hover.flyNear', 0, 2);
    slider('fly-out far ×', 'hover.flyFar', 0, 2);
    slider('fly-out zone (R)', 'hover.flyRadius', 0.05, 1.5);
    slider('stretch share', 'hover.stretchMix', 0, 1);
    slider('stretch width (R)', 'hover.stretchWidth', 0.05, 1);
    slider('tilt reach (phone)', 'hover.tiltReach', 0.3, 2.5);

    section('Hero parallax (travel)');
    slider('title fade (of shift)', 'parallax.titleFade', 0.05, 1);
    slider('dates distance', 'parallax.extraDist', 0, 3);
    slider('dates speed', 'parallax.extraSpeed', 0.5, 3);
    slider('card distance (vw, from right)', 'parallax.cardDist', 0, 1.5);
    slider('card speed', 'parallax.cardSpeed', 0.5, 3);
    slider('CTA distance', 'parallax.ctaDist', 0, 3);
    slider('CTA speed', 'parallax.ctaSpeed', 0.5, 3);
    slider('fade from', 'parallax.fadeFrom', 0, 1);
    slider('risers ease (0 = 1:1)', 'parallax.ease', 0, 1);

    section('Antialias (Canvas 2D)');
    slider('max pixel ratio', 'quality.dprMax', 0.5, 3, { step: 0.25 });
    slider('soft blur (px)', 'quality.softBlur', 0, 2, { step: 0.1, fmt: function (v) { return (+v).toFixed(1); } });
    var info = document.createElement('div'); info.className = 'row'; info.style.gridTemplateColumns = '1fr';
    info.innerHTML = '<label id="sl-info" style="color:#777">…</label>'; body.appendChild(info);
    function refreshInfo() {
      if (!window.SEAL_INFO) return; var i = window.SEAL_INFO();
      info.querySelector('#sl-info').textContent = 'in effect: Canvas 2D, no MSAA/FXAA · dpr ' + i.dpr.toFixed(2) + ' · ' + i.canvasPx + ' px · blur ' + (+i.softBlur).toFixed(1) + 'px · target R ' + i.target.R.toFixed(1) + 'px';
    }
    setInterval(refreshInfo, 500); refreshInfo();

    var btns = document.createElement('div'); btns.className = 'btns';
    btns.innerHTML = '<button id="sl-copy">Copy settings</button><button id="sl-reset">Reset</button>';
    body.appendChild(btns);
    btns.querySelector('#sl-copy').addEventListener('click', function () {
      var out = JSON.stringify(T, null, 2);
      (navigator.clipboard ? navigator.clipboard.writeText(out) : Promise.reject()).then(function () { btns.querySelector('#sl-copy').textContent = 'Copied!'; },
        function () { console.log(out); btns.querySelector('#sl-copy').textContent = 'In console'; });
      setTimeout(function () { btns.querySelector('#sl-copy').textContent = 'Copy settings'; }, 1500);
    });
    btns.querySelector('#sl-reset').addEventListener('click', function () {
      (function apply(dst, src) { for (var k in src) { if (typeof src[k] === 'object' && src[k] !== null) apply(dst[k], src[k]); else dst[k] = src[k]; } })(T, DEFAULTS);
      updaters.forEach(function (f) { f(); });
    });
  });
})();
