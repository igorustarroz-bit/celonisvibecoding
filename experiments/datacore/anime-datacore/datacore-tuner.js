/* =========================================================================
   Glass tuning panel (experiment 3, variant B).
   Sliders and color pickers wired to window.DATACORE — the render loop
   in datacore-3d.js reads those values every frame, so everything is
   live. "Copy" exports the settings JSON to hand over as-is.
   2026-09-04: × in the header hides the panel (T key / DATACORE_TUNER.show()
   restores it); Sharpness section shows what is REALLY in effect
   (DATACORE_INFO: WebGL2, MSAA samples, FXAA, dpr) — Igor's rule.
   ========================================================================= */
(function () {
  'use strict';
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  /* 2026-09-09 — rule 12 (see experiments/claude_antiphishing_context.md §7):
     a published page that replicates the client's site must contain no
     data-entry element at all, and this dev panel is built from <input
     type="range"> sliders. It is therefore no longer created on load. Add
     ?tuner to the URL, or press T on the page, to build and show it; a plain
     visit never puts a single input in the DOM. */
  var built = false;
  function build() {
    var T = window.DATACORE;
    if (!T) { setTimeout(build, 300); return; }
    if (built) return;
    built = true;

    var css = document.createElement('style');
    css.textContent = [
      // v19: where the A/B switch used to be (bottom-right), opening UPWARDS:
      // column-reverse keeps the header at the bottom, body opens above it
      '#dc-tuner{position:fixed;right:18px;bottom:18px;z-index:99999;width:252px;',
      'display:flex;flex-direction:column-reverse;',
      'font-family:Poppins,Arial,sans-serif;font-size:11px;color:#eee;',
      'background:rgba(6,6,8,.92);border:1px solid rgba(255,255,255,.25);',
      // 2026-09-04 (same as the book tuner): no backdrop-filter — with a border + radius
      // Chrome drew the corners wrong — and a plain <div> as header: the site's CSS
      // gives every <header> element 88 px, which made the collapsed pill tall
      'border-radius:12px;overflow:hidden;user-select:none;line-height:1.3}',
      '#dc-tuner .hd{display:flex;justify-content:space-between;align-items:center;',
      'padding:9px 12px;cursor:pointer;font-weight:600;letter-spacing:.6px;height:auto;min-height:0}',
      '#dc-tuner .hd span.dot{color:#5cfe50}',
      '#dc-tuner .hd .ctl{display:flex;gap:10px;align-items:center}',
      '#dc-tuner .hd .ctl span{cursor:pointer;padding:0 2px;color:#aaa}',
      '#dc-tuner .hd .ctl span:hover{color:#5cfe50}',
      '#dc-tuner .body{padding:2px 12px 10px;max-height:70vh;overflow:auto}',
      '#dc-tuner .row{display:grid;grid-template-columns:86px 1fr 34px;gap:6px;',
      'align-items:center;margin:5px 0}',
      '#dc-tuner .row label{color:#aaa;white-space:nowrap;overflow:hidden}',
      '#dc-tuner input[type=range]{width:100%;accent-color:#5cfe50;height:14px}',
      '#dc-tuner input[type=color]{width:100%;height:20px;border:none;background:none;padding:0}',
      '#dc-tuner .val{text-align:right;color:#5cfe50;font-variant-numeric:tabular-nums}',
      '#dc-tuner h4{margin:10px 0 2px;font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1.2px}',
      '#dc-tuner .btns{display:flex;gap:6px;margin-top:10px}',
      '#dc-tuner button{flex:1;padding:6px 0;border-radius:7px;border:1px solid rgba(255,255,255,.3);',
      'background:transparent;color:#eee;font:inherit;cursor:pointer}',
      '#dc-tuner button:hover{border-color:#5cfe50;color:#5cfe50}',
      '#dc-tuner.min .body{display:none}'
    ].join('');
    document.head.appendChild(css);

    var DEFAULTS = JSON.parse(JSON.stringify(T, function (k, v) {
      return typeof v === 'function' ? undefined : v;
    }));

    var panel = document.createElement('div');
    panel.id = 'dc-tuner';
    panel.className = 'min';   // v19: starts collapsed
    panel.innerHTML = '<div class="hd"><span><span class="dot">●</span> GLASS TUNER</span>' +
      '<span class="ctl"><span id="dc-tgl" title="Expand / collapse">+</span><span id="dc-hide" title="Hide the panel (press T to bring it back)">×</span></span></div><div class="body"></div>';
    document.body.appendChild(panel);
    var body = panel.querySelector('.body');
    panel.querySelector('.hd').addEventListener('click', function (e) {
      if (e.target.id === 'dc-hide') { hide(); return; }
      panel.classList.toggle('min');
      panel.querySelector('#dc-tgl').textContent = panel.classList.contains('min') ? '+' : '—';
    });
    // hide / show: the × hides the panel entirely; the T key or DATACORE_TUNER.show() brings it back
    function hide() { panel.style.display = 'none'; }
    function show() { panel.style.display = ''; }
    window.DATACORE_TUNER = { show: show, hide: hide, toggle: function () { panel.style.display === 'none' ? show() : hide(); } };

    function get(path) {
      return path.split('.').reduce(function (o, k) { return o[k]; }, T);
    }
    function set(path, val) {
      var ks = path.split('.'), o = T;
      for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
      o[ks[ks.length - 1]] = val;
    }

    var updaters = [];
    function slider(label, path, min, max, step) {
      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<label title="' + path + '">' + label + '</label><input type="range"><span class="val"></span>';
      var inp = row.querySelector('input'), val = row.querySelector('.val');
      inp.min = min; inp.max = max; inp.step = step || 0.01;
      function refresh() { inp.value = get(path); val.textContent = (+get(path)).toFixed(2); }
      refresh();
      inp.addEventListener('input', function () { set(path, +inp.value); val.textContent = (+inp.value).toFixed(2); });
      updaters.push(refresh);
      body.appendChild(row);
    }
    function color(label, path) {
      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<label title="' + path + '">' + label + '</label><input type="color"><span class="val"></span>';
      var inp = row.querySelector('input');
      function refresh() { inp.value = get(path); }
      refresh();
      inp.addEventListener('input', function () { set(path, inp.value); });
      updaters.push(refresh);
      body.appendChild(row);
    }
    function section(t) {
      var h = document.createElement('h4'); h.textContent = t; body.appendChild(h);
    }

    section('Glass tint');
    slider('tint R', 'tint.r', 0.4, 1.8);
    slider('tint G', 'tint.g', 0.4, 1.8);
    slider('tint B', 'tint.b', 0.4, 1.8);

    section('Transparency');
    slider('transmission', 'transmission', 0, 1);
    slider('+ on explode', 'transmissionSpread', 0, 0.5);
    slider('refraction', 'refract', 0, 3);
    slider('frost blur', 'frost', 0, 1);
    slider('blur radius', 'frostRadius', 0, 4);
    slider('piece magnify', 'pieceMag', 0.6, 1.2);
    slider('piece shift', 'pieceShift', 0, 1.5);
    slider('body (tops)', 'body', 0, 3);
    slider('see-through (pre)', 'pre', 0, 3);

    section('Clear tops');
    slider('top clarity', 'topClear', 0, 1);
    slider('through glow', 'topDarken', 0, 1.5);
    slider('edge white', 'edgeWhite', 0, 1.2);

    section('Edges & glow');
    slider('fresnel', 'fresnel', 0, 1.5);
    color('sky top', 'skyTop');
    color('sky horizon', 'skyHorizon');
    slider('light rims', 'rim', 0, 3);
    slider('iridescence', 'iri', 0, 0.6);

    section('Sharpness');
    slider('MSAA samples', 'quality.msaa', 0, 8, 2);
    slider('FXAA (0/1)', 'quality.fxaa', 0, 1, 1);
    slider('max pixel ratio', 'quality.dprMax', 0.5, 3, 0.25);
    slider('pre-pass res', 'quality.preRes', 0.2, 1, 0.05);
    slider('blur (not labels)', 'blur', 0, 8, 0.1);
    // what is actually in effect right now (MSAA needs WebGL2; the number is the RT's samples)
    var info = document.createElement('div');
    info.className = 'row'; info.style.gridTemplateColumns = '1fr';
    info.innerHTML = '<label id="dc-info" style="color:#777">…</label>';
    body.appendChild(info);
    function refreshInfo() {
      if (!window.DATACORE_INFO) return;
      var i = window.DATACORE_INFO();
      info.querySelector('#dc-info').textContent = 'in effect: ' + (i.webgl2 ? 'WebGL2, MSAA ' + i.msaaSamples + 'x' : 'WebGL1, no MSAA') +
        ', FXAA ' + (i.fxaa ? 'on' : 'off') + ', dpr ' + i.pixelRatio.toFixed(2);
    }
    setInterval(refreshInfo, 500); refreshInfo();

    section('Backdrop & bloom');
    color('studio backdrop', 'backdrop');
    slider('bloom strength', 'bloom.strength', 0, 1.5);
    slider('bloom radius', 'bloom.radius', 0, 1);
    slider('bloom threshold', 'bloom.threshold', 0, 1);

    var btns = document.createElement('div');
    btns.className = 'btns';
    btns.innerHTML = '<button id="dc-copy">Copy settings</button><button id="dc-reset">Reset</button>';
    body.appendChild(btns);
    btns.querySelector('#dc-copy').addEventListener('click', function () {
      var out = JSON.stringify(T, function (k, v) { return typeof v === 'function' ? undefined : v; }, 2);
      (navigator.clipboard ? navigator.clipboard.writeText(out) : Promise.reject()).then(function () {
        btns.querySelector('#dc-copy').textContent = 'Copied!';
      }, function () { console.log(out); btns.querySelector('#dc-copy').textContent = 'In console'; });
      setTimeout(function () { btns.querySelector('#dc-copy').textContent = 'Copy settings'; }, 1500);
    });
    btns.querySelector('#dc-reset').addEventListener('click', function () {
      (function apply(dst, src) {
        for (var k in src) {
          if (typeof src[k] === 'object') apply(dst[k], src[k]);
          else dst[k] = src[k];
        }
      })(T, DEFAULTS);
      updaters.forEach(function (f) { f(); });
    });
  }

  ready(function () {
    document.addEventListener('keydown', function (e) {
      if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey &&
          !/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) {
        if (!built) build();
        else if (window.DATACORE_TUNER) window.DATACORE_TUNER.toggle();
      }
    });
    if (/[?&]tuner/.test(location.search)) build();
  });
})();
