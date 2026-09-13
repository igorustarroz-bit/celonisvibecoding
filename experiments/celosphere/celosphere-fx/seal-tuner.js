/* =========================================================================
   Seal tuning panel (experiment 5, Celosphere).

   The knobs are wired to window.SEAL, which seal-knit.js reads every frame,
   so everything is live. "Copy settings" exports the JSON to paste as the new
   defaults; "Reset" restores the shipped values.

   2026-09-13 — rebuilt on ../../lib/tuner-ui.js, shared with every other
   experiment. The panel is built on load again, collapsed: it went behind the
   ?tuner gate on 2026-09-09 because its 59 <input type="range"> sliders were
   live in the DOM of a published replica of the client's site, which
   anti-phishing rule 12 forbids. The shared kit builds its controls from
   <div>s, so the handles come back and the page still audits clean. T hides
   and shows it as before.

   Double-click a row to reset that knob (amber = changed); the variable each
   knob writes to is printed under its label.

   Note this page has a .secondary-menu-container, so nav-fx deliberately does
   not run here — see claude_navfx_context.md.
   ========================================================================= */
(function () {
  'use strict';

  var onoff = function (v) { return +v >= 0.5 ? 'on' : 'off'; };
  var one = function (v) { return (+v).toFixed(1); };
  var ms = function (v) { return (+v).toFixed(0); };

  function build() {
    var T = window.SEAL;
    if (!T || !window.TunerUI) { setTimeout(build, 300); return; }

    var p = window.TunerUI.create({
      id: 'sl-tuner',
      title: 'SEAL TUNER',
      accent: '#5cfe50',
      target: T,
      onChange: function () { /* seal-knit.js reads T every frame */ }
    });

    // Scrub the sequence by hand. It drives the real page scroll, so it goes
    // through exactly the same code path a reader does — not a preview mode.
    // A live control: no default, so no reset and never amber.
    p.section('Scrub');
    p.live('sequence T', 'SEAL_SCROLL(t)', 0, 1, 0.001,
      function () { return window.SEAL_INFO ? window.SEAL_INFO().T : 0; },
      function (v) { if (window.SEAL_SCROLL) window.SEAL_SCROLL(v); });

    p.section('Timeline');
    p.slider('knit length (vh)', 'knitVH', 0.2, 3, 0.05);
    p.slider('hold 1 (vh)', 'hold1VH', 0, 4, 0.05);
    p.slider('shift length (vh)', 'shiftVH', 0.1, 3, 0.05);
    p.slider('hold 2 (vh)', 'hold2VH', 0, 4, 0.05);
    p.slider('settle length (vh)', 'settleVH', 0.2, 3, 0.05);
    p.slider('auto-play on load', 'autoPlay', 0, 1, 1, { fmt: onoff });
    p.slider('auto-play ms', 'autoPlayMs', 800, 6000, 100, { fmt: ms });
    p.slider('formation', 'formation', 0, 1, 1,
      { fmt: function (v) { return +v >= 0.5 ? 'fly-in' : 'knit'; } });
    p.slider('fly-in ease', 'flyEase', 0, 1, 0.01);
    p.slider('grow duration', 'growDur', 0.05, 0.8, 0.01);
    p.slider('order: row mix', 'orderMix', 0, 1, 0.01);
    p.slider('travel ease', 'travelEase', 0, 1, 0.01);
    p.slider('bg fade start', 'bgFadeStart', 0, 1, 0.01);
    p.slider('bg fade end', 'bgFadeEnd', 0, 1, 0.01);
    p.slider('wordmark from', 'wordmarkFrom', 0, 1, 0.01);

    p.section('Digits');
    p.slider('matrix / count-up', 'digitMode', 0, 1, 1,
      { fmt: function (v) { return +v >= 0.5 ? 'matrix' : 'count'; } });
    p.slider('lead after front', 'digitLead', 0, 0.3, 0.01);
    p.slider('flicker length', 'flickerLen', 0.02, 0.5, 0.01);
    p.slider('flicker rate (Hz)', 'flickerRate', 2, 40, 1);
    p.slider('digit size', 'digitScale', 0.6, 1.6, 0.01);
    p.choice('digit weight', 'digitWeight', [400, 500, 600]);

    p.section('Geometry');
    p.slider('foreground radius', 'fgRadius', 0.15, 0.48, 0.01);
    p.slider('frame 1 x', 'fgX', 0.2, 0.85, 0.01);
    p.slider('frame 1 y', 'fgY', 0.3, 0.7, 0.01);
    p.slider('frame 2 x', 'fgX2', 0.3, 0.9, 0.01);
    p.slider('frame 2 y', 'fgY2', 0.3, 0.7, 0.01);
    p.slider('frame 2 scale', 'fgScale2', 0.5, 1.2, 0.01);
    p.slider('phone: frame 2 x', 'fgX2Mobile', 0.2, 0.8, 0.01);
    p.slider('phone: frame 2 y', 'fgY2Mobile', 0.3, 0.8, 0.01);
    p.slider('phone: title y', 'titleYMobile', 0.1, 0.5, 0.01);
    p.slider('phone: seal lands at', 'mobile.sealLandAt', 0.3, 1, 0.01);
    p.slider('phone: dates from left (vw)', 'mobile.datesDist', 0, 1.5, 0.01);
    p.slider('stripe thickness', 'thicknessScale', 0.5, 1.5, 0.01);
    p.slider('show target', 'showTarget', 0, 1, 1, { fmt: onoff });

    p.section('Pointer / tilt reaction');
    p.slider('reach (radii)', 'hover.radius', 0.2, 2, 0.01);
    p.slider('reach beyond rim', 'hover.reachOut', 0.05, 2, 0.01);
    p.slider('thick under pointer', 'hover.thick', 1, 3, 0.01);
    p.slider('thin far away', 'hover.thin', 0.1, 1, 0.01);
    p.slider('smoothing', 'hover.smoothing', 0.02, 0.5, 0.01);
    p.slider('fly-out at rim (R)', 'hover.fly', 0, 1.5, 0.01);
    p.slider('fly-out from (R)', 'hover.flyEdge', 0, 0.9, 0.01);
    p.slider('fly-out near ×', 'hover.flyNear', 0, 2, 0.01);
    p.slider('fly-out far ×', 'hover.flyFar', 0, 2, 0.01);
    p.slider('fly-out zone (R)', 'hover.flyRadius', 0.05, 1.5, 0.01);
    p.slider('stretch share', 'hover.stretchMix', 0, 1, 0.01);
    p.slider('stretch width (R)', 'hover.stretchWidth', 0.05, 1, 0.01);
    p.slider('tilt reach (phone)', 'hover.tiltReach', 0.3, 2.5, 0.01);

    p.section('Hero parallax (travel)');
    p.slider('title fade (of shift)', 'parallax.titleFade', 0.05, 1, 0.01);
    p.slider('dates distance', 'parallax.extraDist', 0, 3, 0.01);
    p.slider('dates speed', 'parallax.extraSpeed', 0.5, 3, 0.01);
    p.slider('card distance (vw, from right)', 'parallax.cardDist', 0, 1.5, 0.01);
    p.slider('card speed', 'parallax.cardSpeed', 0.5, 3, 0.01);
    p.slider('CTA distance', 'parallax.ctaDist', 0, 3, 0.01);
    p.slider('CTA speed', 'parallax.ctaSpeed', 0.5, 3, 0.01);
    p.slider('fade from', 'parallax.fadeFrom', 0, 1, 0.01);
    p.slider('risers ease (0 = 1:1)', 'parallax.ease', 0, 1, 0.01);

    // This effect is Canvas 2D, so there is no MSAA or FXAA to report — but the
    // read-out is still here, saying so, because Igor's rule is that a panel
    // always tells you what the antialiasing is actually doing.
    p.section('Antialias (Canvas 2D)');
    p.slider('max pixel ratio', 'quality.dprMax', 0.5, 3, 0.25);
    p.slider('soft blur (px)', 'quality.softBlur', 0, 2, 0.1, { fmt: one });
    p.readout(function () {
      if (!window.SEAL_INFO) return '…';
      var i = window.SEAL_INFO();
      return 'in effect: Canvas 2D, no MSAA/FXAA · dpr ' + i.dpr.toFixed(2) +
             ' · ' + i.canvasPx + ' px · blur ' + (+i.softBlur).toFixed(1) +
             'px · target R ' + i.target.R.toFixed(1) + 'px';
    });

    p.actions();
    p.hint();
    p.mount();
    window.TunerUI.hotkey(p, 't');

    window.SEAL_TUNER = {
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
