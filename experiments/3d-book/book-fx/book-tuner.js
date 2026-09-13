/* =========================================================================
   Book tuning panel (experiment 4).

   The knobs are wired to window.BOOK, which book-3d.js reads every frame, so
   everything is live. "Copy settings" exports the JSON to paste as the new
   defaults in book-3d.js; "Reset" restores the shipped values. Igor's
   workflow: tune live in the page, copy, hand over the JSON.

   2026-09-13 — rebuilt on ../../lib/tuner-ui.js, shared with every other
   experiment. The panel is built on load again, collapsed as a "● BOOK TUNER"
   pill: it went behind the ?tuner gate on 2026-09-09 because it was made of
   <input type="range"> and <input type="color">, which anti-phishing rule 12
   forbids on a replica of the client's site, and the shared kit builds its
   controls from <div>s instead. T still hides and shows it.

   Double-click a row to reset that knob (amber = changed); the variable each
   knob writes to is printed under its label.
   ========================================================================= */
(function () {
  'use strict';

  var deg = function (v) { return (+v).toFixed(0) + '°'; };
  var ms = function (v) { return (+v).toFixed(0); };

  function build() {
    var T = window.BOOK;
    if (!T || !window.TunerUI) { setTimeout(build, 300); return; }

    var p = window.TunerUI.create({
      id: 'bk-tuner',
      title: 'BOOK TUNER',
      accent: '#5cfe50',
      target: T,
      onChange: function () { /* book-3d.js reads T every frame */ }
    });

    // open / close the book from the panel (the click on the canvas still works)
    p.button('Open / close book', function () {
      if (window.BOOK_TOGGLE) window.BOOK_TOGGLE();
    }, true);

    p.section('Presented pose (open)');
    p.slider('rise to camera', 'present', 0, 1, 0.01);            // 0 = stays on the table (v5)
    // The book's total opening angle between the two pages: 180° = flat, smaller = a
    // tighter V. That is the number a designer thinks in; the scene stores presentV,
    // how much each half angles toward the viewer = (180 − opening) / 2. read/write
    // keep the slider in the designer's units and the scene in its own.
    p.slider('book opening', 'presentV', 60, 180, 1, {
      fmt: deg,
      read: function (v) { return 180 - 2 * v; },
      write: function (o) { return (180 - o) / 2; }
    });
    p.slider('lean back', 'presentTilt', -45, 45, 1, { fmt: deg });  // negative = leans toward you
    p.slider('rise lag', 'presentEase', 0.5, 3, 0.01);               // >1 = rises later than it flips

    p.section('Table pose (open, present = 0)');
    p.slider('V per half', 'vAngle', 0, 30, 1, { fmt: deg });

    p.section('Camera');
    p.slider('azimuth', 'camera.az', -90, 0, 1, { fmt: deg });       // −90 = from the spine side
    p.slider('elevation', 'camera.el', 10, 85, 1, { fmt: deg });
    p.slider('focal (fov)', 'camera.fov', 5, 40, 1, { fmt: deg });   // small = no perspective
    p.slider('fit', 'fit', 0.5, 1, 0.01);
    p.slider('cam smoothing', 'camSmooth', 0.02, 0.4, 0.01);

    p.section('Motion');
    p.slider('open time (ms)', 'openMs', 400, 3000, 50, { fmt: ms });
    p.slider('loose leaves', 'leaves', 0, 8, 1);
    p.slider('leaf lag (ms)', 'leafLag', 0, 300, 5, { fmt: ms });
    p.slider('hover lift', 'hoverLift', 0, 15, 1, { fmt: deg });
    p.slider('float', 'bob', 0, 0.03, 0.001);

    p.section('Look');
    p.slider('light edges', 'edgeOpacity', 0, 1, 0.01);
    p.slider('environment', 'envIntensity', 0, 2, 0.01);
    p.slider('key light', 'keyLight', 0, 2, 0.01);
    p.slider('ambient', 'ambient', 0, 1, 0.01);
    p.slider('cover roughness', 'roughness', 0, 1, 0.01);
    p.slider('cover clearcoat', 'clearcoat', 0, 1, 0.01);
    p.colour('paper', 'pageColor');
    p.colour('accent green', 'green');

    p.section('Bloom & sharpness');
    p.slider('bloom strength', 'bloom.strength', 0, 1.5, 0.01);
    p.slider('bloom radius', 'bloom.radius', 0, 1, 0.01);
    p.slider('bloom threshold', 'bloom.threshold', 0, 1, 0.01);
    p.choice('MSAA samples', 'quality.msaa', [0, 2, 4, 8]);
    p.choice('FXAA', 'quality.fxaa', [0, 1]);
    p.slider('max pixel ratio', 'quality.dprMax', 0.5, 3, 0.25);
    p.readout(function () {
      if (!window.BOOK_INFO) return '…';
      var i = window.BOOK_INFO();
      return 'in effect: ' + (i.webgl2 ? 'WebGL2, MSAA ' + i.msaaSamples + 'x' : 'WebGL1, no MSAA') +
             ', FXAA ' + (i.fxaa ? 'on' : 'off') + ', dpr ' + i.pixelRatio.toFixed(2);
    });

    p.actions();
    p.hint();
    p.mount();
    window.TunerUI.hotkey(p, 't');

    window.BOOK_TUNER = {
      show: function () { p.show(); },
      hide: function () { p.hide(); },
      open: function () { p.show().open(); },
      toggle: function () { p.toggle(); }
    };
  }

  window.TunerUI ? window.TunerUI.ready(build)
                 : (document.readyState !== 'loading' ? build()
                    : document.addEventListener('DOMContentLoaded', build));
})();
