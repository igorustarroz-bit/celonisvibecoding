/* =========================================================================
   Book tuning panel (experiment 4) — same recipe as the Data Core's glass tuner:
   sliders wired to window.BOOK, which book-3d.js reads every frame, so
   everything is live. Bottom-right, starts collapsed as a "● BOOK TUNER" pill,
   expands upwards; the × in its header hides it completely (press T, or call
   BOOK_TUNER.show(), to bring it back). "Copy settings" exports the JSON to
   paste as the new defaults in book-3d.js; "Reset" restores the shipped values.
   Igor's workflow: tune live in the page, copy, hand over the JSON.
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
    var T = window.BOOK;
    if (!T) { setTimeout(build, 300); return; }
    if (built) return;
    built = true;

    var css = document.createElement('style');
    css.textContent = [
      '#bk-tuner{position:fixed;right:18px;bottom:18px;z-index:99999;width:264px;',
      'display:flex;flex-direction:column-reverse;',
      'font-family:Poppins,Arial,sans-serif;font-size:11px;color:#eee;',
      'background:rgba(6,6,8,.92);border:1px solid rgba(255,255,255,.25);',
      // no backdrop-filter (with a border + radius Chrome drew the corners wrong) and
      // a plain <div> for the header: the site's CSS gives every <header> 88 px
      'border-radius:12px;overflow:hidden;user-select:none;line-height:1.3}',
      '#bk-tuner .hd{display:flex;justify-content:space-between;align-items:center;',
      'padding:9px 12px;cursor:pointer;font-weight:600;letter-spacing:.6px;height:auto;min-height:0}',
      '#bk-tuner .hd span.dot{color:#5cfe50}',
      '#bk-tuner .hd .ctl{display:flex;gap:10px;align-items:center}',
      '#bk-tuner .hd .ctl span{cursor:pointer;padding:0 2px;color:#aaa}',
      '#bk-tuner .hd .ctl span:hover{color:#5cfe50}',
      '#bk-tuner .body{padding:2px 12px 10px;max-height:70vh;overflow:auto}',
      '#bk-tuner .row{display:grid;grid-template-columns:96px 1fr 38px;gap:6px;',
      'align-items:center;margin:5px 0}',
      '#bk-tuner .row label{color:#aaa;white-space:nowrap;overflow:hidden}',
      '#bk-tuner input[type=range]{width:100%;accent-color:#5cfe50;height:14px}',
      '#bk-tuner input[type=color]{width:100%;height:20px;border:none;background:none;padding:0}',
      '#bk-tuner .val{text-align:right;color:#5cfe50;font-variant-numeric:tabular-nums}',
      '#bk-tuner h4{margin:10px 0 2px;font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1.2px}',
      '#bk-tuner .btns{display:flex;gap:6px;margin-top:10px}',
      '#bk-tuner button{flex:1;padding:6px 0;border-radius:7px;border:1px solid rgba(255,255,255,.3);',
      'background:transparent;color:#eee;font:inherit;cursor:pointer}',
      '#bk-tuner button:hover{border-color:#5cfe50;color:#5cfe50}',
      '#bk-tuner button.primary{border-color:#5cfe50;color:#5cfe50}',
      '#bk-tuner.min .body{display:none}'
    ].join('');
    document.head.appendChild(css);

    var DEFAULTS = JSON.parse(JSON.stringify(T, function (k, v) {
      return typeof v === 'function' ? undefined : v;
    }));

    var panel = document.createElement('div');
    panel.id = 'bk-tuner';
    panel.className = 'min';   // starts collapsed
    panel.innerHTML = '<div class="hd"><span><span class="dot">●</span> BOOK TUNER</span>' +
      '<span class="ctl"><span id="bk-tgl" title="Expand / collapse">+</span><span id="bk-hide" title="Hide the panel (press T to bring it back)">×</span></span></div><div class="body"></div>';
    document.body.appendChild(panel);
    var body = panel.querySelector('.body');
    panel.querySelector('.hd').addEventListener('click', function (e) {
      if (e.target.id === 'bk-hide') { hide(); return; }
      panel.classList.toggle('min');
      panel.querySelector('#bk-tgl').textContent = panel.classList.contains('min') ? '+' : '—';
    });
    // hide / show: the × in the header hides the panel entirely (Igor: it must be able
    // to disappear for a clean look); the T key or BOOK_TUNER.show() brings it back
    function hide() { panel.style.display = 'none'; }
    function show() { panel.style.display = ''; }
    window.BOOK_TUNER = { show: show, hide: hide, toggle: function () { panel.style.display === 'none' ? show() : hide(); } };

    function get(path) { return path.split('.').reduce(function (o, k) { return o[k]; }, T); }
    function set(path, val) {
      var ks = path.split('.'), o = T;
      for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]];
      o[ks[ks.length - 1]] = val;
    }

    var updaters = [];
    // slider bound to a path; opts: {step, fmt, read, write} — read/write map the
    // slider value to the stored one (used for "book opening" ↔ presentV)
    function slider(label, path, min, max, opts) {
      opts = opts || {};
      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<label title="' + path + '">' + label + '</label><input type="range"><span class="val"></span>';
      var inp = row.querySelector('input'), val = row.querySelector('.val');
      inp.min = min; inp.max = max; inp.step = opts.step || 0.01;
      var read = opts.read || function (v) { return v; }, write = opts.write || function (v) { return v; };
      var fmt = opts.fmt || function (v) { return (+v).toFixed(opts.step && opts.step >= 1 ? 0 : 2); };
      function refresh() { var v = read(get(path)); inp.value = v; val.textContent = fmt(v); }
      refresh();
      inp.addEventListener('input', function () { set(path, write(+inp.value)); val.textContent = fmt(+inp.value); });
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
    function section(t) { var h = document.createElement('h4'); h.textContent = t; body.appendChild(h); }
    var deg = function (v) { return (+v).toFixed(0) + '°'; };

    // open / close the book from the panel (the click on the canvas still works)
    var top = document.createElement('div');
    top.className = 'btns';
    top.innerHTML = '<button id="bk-open" class="primary">Open / close book</button>';
    body.appendChild(top);
    top.querySelector('#bk-open').addEventListener('click', function () { if (window.BOOK_TOGGLE) window.BOOK_TOGGLE(); });

    section('Presented pose (open)');
    slider('rise to camera', 'present', 0, 1);                                  // 0 = stays on the table (v5)
    // the book's total opening angle between the two pages: 180° = flat, smaller = tighter V.
    // Stored as presentV (how much each half angles toward the viewer) = (180 − opening) / 2
    slider('book opening', 'presentV', 60, 180, { step: 1, fmt: deg,
      read: function (v) { return 180 - 2 * v; }, write: function (o) { return (180 - o) / 2; } });
    slider('lean back', 'presentTilt', -45, 45, { step: 1, fmt: deg });        // negative = leans toward you
    slider('rise lag', 'presentEase', 0.5, 3);                                 // >1 = rises later than it flips

    section('Table pose (open, present = 0)');
    slider('V per half', 'vAngle', 0, 30, { step: 1, fmt: deg });

    section('Camera');
    slider('azimuth', 'camera.az', -90, 0, { step: 1, fmt: deg });             // −90 = from the spine side
    slider('elevation', 'camera.el', 10, 85, { step: 1, fmt: deg });
    slider('focal (fov)', 'camera.fov', 5, 40, { step: 1, fmt: deg });         // small = no perspective
    slider('fit', 'fit', 0.5, 1);
    slider('cam smoothing', 'camSmooth', 0.02, 0.4);

    section('Motion');
    slider('open time (ms)', 'openMs', 400, 3000, { step: 50 });
    slider('loose leaves', 'leaves', 0, 8, { step: 1 });
    slider('leaf lag (ms)', 'leafLag', 0, 300, { step: 5 });
    slider('hover lift', 'hoverLift', 0, 15, { step: 1, fmt: deg });
    slider('float', 'bob', 0, 0.03, { step: 0.001, fmt: function (v) { return (+v).toFixed(3); } });

    section('Look');
    slider('light edges', 'edgeOpacity', 0, 1);
    slider('environment', 'envIntensity', 0, 2);
    slider('key light', 'keyLight', 0, 2);
    slider('ambient', 'ambient', 0, 1);
    slider('cover roughness', 'roughness', 0, 1);
    slider('cover clearcoat', 'clearcoat', 0, 1);
    color('paper', 'pageColor');
    color('accent green', 'green');

    section('Bloom & sharpness');
    slider('bloom strength', 'bloom.strength', 0, 1.5);
    slider('bloom radius', 'bloom.radius', 0, 1);
    slider('bloom threshold', 'bloom.threshold', 0, 1);
    slider('MSAA samples', 'quality.msaa', 0, 8, { step: 2 });
    slider('FXAA (0/1)', 'quality.fxaa', 0, 1, { step: 1 });
    slider('max pixel ratio', 'quality.dprMax', 0.5, 3, { step: 0.25 });
    // what is actually in effect right now (MSAA needs WebGL2; the number is the RT's samples)
    var info = document.createElement('div');
    info.className = 'row'; info.style.gridTemplateColumns = '1fr';
    info.innerHTML = '<label id="bk-info" style="color:#777">…</label>';
    body.appendChild(info);
    function refreshInfo() {
      if (!window.BOOK_INFO) return;
      var i = window.BOOK_INFO();
      info.querySelector('#bk-info').textContent = 'in effect: ' + (i.webgl2 ? 'WebGL2, MSAA ' + i.msaaSamples + 'x' : 'WebGL1, no MSAA') +
        ', FXAA ' + (i.fxaa ? 'on' : 'off') + ', dpr ' + i.pixelRatio.toFixed(2);
    }
    setInterval(refreshInfo, 500); refreshInfo();

    var btns = document.createElement('div');
    btns.className = 'btns';
    btns.innerHTML = '<button id="bk-copy">Copy settings</button><button id="bk-reset">Reset</button>';
    body.appendChild(btns);
    btns.querySelector('#bk-copy').addEventListener('click', function () {
      var out = JSON.stringify(T, function (k, v) { return typeof v === 'function' ? undefined : v; }, 2);
      (navigator.clipboard ? navigator.clipboard.writeText(out) : Promise.reject()).then(function () {
        btns.querySelector('#bk-copy').textContent = 'Copied!';
      }, function () { console.log(out); btns.querySelector('#bk-copy').textContent = 'In console'; });
      setTimeout(function () { btns.querySelector('#bk-copy').textContent = 'Copy settings'; }, 1500);
    });
    btns.querySelector('#bk-reset').addEventListener('click', function () {
      (function apply(dst, src) {
        for (var k in src) {
          if (typeof src[k] === 'object' && src[k] !== null) apply(dst[k], src[k]);
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
        else if (window.BOOK_TUNER) window.BOOK_TUNER.toggle();
      }
    });
    if (/[?&]tuner/.test(location.search)) build();
  });
})();
