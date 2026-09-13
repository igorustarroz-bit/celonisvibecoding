/* =========================================================================
   Glass tuning panel (experiment 3, Data Core).

   The knobs are wired to window.DATACORE, which the render loop in
   datacore-3d.js reads every frame, so everything is live. "Copy settings"
   exports the JSON to hand over as-is.

   2026-09-13 — rebuilt on ../../lib/tuner-ui.js, which every experiment now
   shares. Two consequences:

   * The panel is built on load again, collapsed, as it was before 2026-09-09.
     It went behind the ?tuner gate that day because it was made of <input
     type="range"> and <input type="color">, which anti-phishing rule 12
     forbids on a page that replicates the client's site. The shared kit builds
     its controls from <div>s instead, so the handles can be on the page
     permanently — Igor's standing rule — and the page still contains zero
     data-entry elements. ?tuner and the T key still work; T now hides and
     shows a panel that is already there.
   * Double-click any row to put that one knob back to its default; the value
     is amber while it differs. The variable each knob writes to is printed
     under its label.

   The Sharpness section still reports what is REALLY in effect (DATACORE_INFO:
   WebGL2, MSAA samples, FXAA, dpr) — Igor's other standing rule.
   ========================================================================= */
(function () {
  'use strict';

  function build() {
    var T = window.DATACORE;
    if (!T || !window.TunerUI) { setTimeout(build, 300); return; }

    var p = window.TunerUI.create({
      id: 'dc-tuner',
      title: 'GLASS TUNER',
      accent: '#5cfe50',                 // the client's green, as before
      target: T,
      onChange: function () { /* the render loop reads T every frame */ }
    });

    p.section('Glass tint');
    p.slider('tint R', 'tint.r', 0.4, 1.8, 0.01);
    p.slider('tint G', 'tint.g', 0.4, 1.8, 0.01);
    p.slider('tint B', 'tint.b', 0.4, 1.8, 0.01);

    p.section('Transparency');
    p.slider('transmission', 'transmission', 0, 1, 0.01);
    p.slider('+ on explode', 'transmissionSpread', 0, 0.5, 0.01);
    p.slider('refraction', 'refract', 0, 3, 0.01);
    p.slider('frost blur', 'frost', 0, 1, 0.01);
    p.slider('blur radius', 'frostRadius', 0, 4, 0.01);
    p.slider('piece magnify', 'pieceMag', 0.6, 1.2, 0.01);
    p.slider('piece shift', 'pieceShift', 0, 1.5, 0.01);
    p.slider('body (tops)', 'body', 0, 3, 0.01);
    p.slider('see-through (pre)', 'pre', 0, 3, 0.01);

    p.section('Clear tops');
    p.slider('top clarity', 'topClear', 0, 1, 0.01);
    p.slider('through glow', 'topDarken', 0, 1.5, 0.01);
    p.slider('edge white', 'edgeWhite', 0, 1.2, 0.01);

    p.section('Edges & glow');
    p.slider('fresnel', 'fresnel', 0, 1.5, 0.01);
    p.colour('sky top', 'skyTop');
    p.colour('sky horizon', 'skyHorizon');
    p.slider('light rims', 'rim', 0, 3, 0.01);
    p.slider('iridescence', 'iri', 0, 0.6, 0.01);

    p.section('Sharpness');
    p.choice('MSAA samples', 'quality.msaa', [0, 2, 4, 8]);
    p.choice('FXAA', 'quality.fxaa', [0, 1]);
    p.slider('max pixel ratio', 'quality.dprMax', 0.5, 3, 0.25);
    p.slider('pre-pass res', 'quality.preRes', 0.2, 1, 0.05);
    p.slider('blur (not labels)', 'blur', 0, 8, 0.1);
    // MSAA needs WebGL2, and the number is the render target's actual samples —
    // what was asked for and what the driver gave are not always the same thing.
    p.readout(function () {
      if (!window.DATACORE_INFO) return '…';
      var i = window.DATACORE_INFO();
      return 'in effect: ' + (i.webgl2 ? 'WebGL2, MSAA ' + i.msaaSamples + 'x' : 'WebGL1, no MSAA') +
             ', FXAA ' + (i.fxaa ? 'on' : 'off') + ', dpr ' + i.pixelRatio.toFixed(2);
    });

    p.section('Backdrop & bloom');
    p.colour('studio backdrop', 'backdrop');
    p.slider('bloom strength', 'bloom.strength', 0, 1.5, 0.01);
    p.slider('bloom radius', 'bloom.radius', 0, 1, 0.01);
    p.slider('bloom threshold', 'bloom.threshold', 0, 1, 0.01);

    p.actions();
    p.hint();
    p.mount();
    window.TunerUI.hotkey(p, 't');

    window.DATACORE_TUNER = {
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
