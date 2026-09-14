/* =========================================================================
   Solutions — the tuner panel (experiment 7).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   Only the knob list lives here; every control is built by lib/tuner-ui.js,
   which contains no <input>, <select> or <textarea> (anti-phishing rule 12),
   so the panel is built on load, collapsed, like every other experiment.
   Each row prints the variable it writes to underneath its label, the value
   turns amber once it differs from the default, and a double-click on the row
   puts that single default back.

   The two pages share one panel definition and show the sections that apply:
   the home page gets the hero glass, the supply chain page gets the three
   text effects. The cursor and the view transitions are on both.

   SPEC entry: [path, label, min, max, step, extra]
               or [path, label, [choices], , , extra]
   `extra` is handed back to onChange and says what has to be rebuilt:
     "targets" = new render targets (MSAA / FXAA / pixel ratio)
   ========================================================================= */
(function () {
  "use strict";

  function start() {
    var S = window.SOLUTIONS, T = window.TunerUI;
    if (!S || !T) { setTimeout(start, 200); return; }

    var page = document.documentElement.getAttribute('data-sfx-page');
    if (!page) return;

    var SPEC = [], COLOURS = [];

    if (page === 'home') {
      SPEC.push(['Splash cursor (hero fluid)', [
        ['splash.enabled', 'On', [0, 1]],
        ['splash.fullPage', 'Across the whole page', [0, 1]],
        ['splash.intensity', 'Dye intensity', 0.02, 0.6, 0.01],
        ['splash.splatRadius', 'Splat radius', 0.02, 1, 0.01],
        ['splash.splatForce', 'Splat force', 500, 15000, 100],
        ['splash.curl', 'Curl (swirl)', 0, 30, 0.5],
        ['splash.densityDissipation', 'Colour fade', 0.2, 8, 0.1],
        ['splash.velocityDissipation', 'Motion fade', 0.1, 6, 0.1],
        ['splash.pressure', 'Pressure', 0, 1, 0.01],
        ['splash.pressureIterations', 'Pressure iterations', 4, 40, 1],
        ['splash.shading', 'Shading', [0, 1]],
        ['splash.simResolution', 'Simulation grid', [64, 128, 256]],
        ['splash.dyeResolution', 'Dye resolution', [256, 512, 1024, 1440]],
        ['splash.idleSeconds', 'Keep drawing after the pointer stops (s)', 0.5, 8, 0.1],
        ['splash.maxDpr', 'Max pixel ratio', 1, 3, 0.25]
      ]]);
      COLOURS.push(['Fluid colour', 'splash.colour']);
    }

    if (page === 'supply-chain') {
      SPEC.push(['Lens over the hero video', [
        ['glass.enabled', 'On (off = the plain video)', [0, 1]],
        ['glass.radius', 'Radius (px)', 40, 420, 2],
        ['glass.radiusCap', 'Cap (× the shorter side)', 0.1, 0.9, 0.01],
        ['glass.ior', 'Index of refraction', 1.01, 2.2, 0.01],
        ['glass.thickness', 'Refraction offset (px)', 0, 220, 1],
        ['glass.bulge', 'Curvature (0 = flat)', 0, 2, 0.01],
        ['glass.chroma', 'Chromatic aberration', 0, 0.6, 0.005],
        ['glass.rim', 'Fresnel rim', 0, 2, 0.01],
        ['glass.rimPower', 'Rim falloff', 1, 8, 0.1],
        ['glass.spec', 'Highlight', 0, 1.5, 0.01],
        ['glass.specSize', 'Highlight size', 0.05, 1.2, 0.01],
        ['glass.body', 'Body (darkens the glass)', 0, 0.5, 0.005],
        ['glass.edge', 'Inner contour', 0, 1.5, 0.01],
        ['glass.followTau', 'Pointer damping (s)', 0, 0.5, 0.005],
        ['glass.videoGain', 'Video brightness', 0.2, 2, 0.01],
        ['glass.videoFit', 'Cover the box', [0, 1], 0, 0, 'targets'],
        ['glass.autoDrift', 'Drift by itself on touch', [0, 1]],
        ['glass.driftSeconds', 'Drift period (s)', 4, 40, 0.5]
      ]]);
      SPEC.push(['Antialiasing (the lens)', [
        ['glass.msaa', 'MSAA samples (WebGL2)', [0, 2, 4, 8], 0, 0, 'targets'],
        ['glass.fxaa', 'FXAA', [0, 1], 0, 0, 'targets'],
        ['glass.maxDpr', 'Max pixel ratio', 1, 3, 0.25, 'targets']
      ]]);
    }

    /* Both heroes carry the same two text effects; only the supply chain page
       has figures to count up. */
    SPEC.push(['Decrypted heading', [
      ['decrypt.enabled', 'On', [0, 1]],
      ['decrypt.speed', 'Reveal step (ms)', 8, 120, 1],
      ['decrypt.delay', 'Start delay (ms)', 0, 1500, 10],
      ['decrypt.scrambleEvery', 'Re-roll every N ticks', 1, 6, 1],
      ['decrypt.speedPivot', 'Full speed up to N characters (0 = off)', 0, 200, 5],
      ['decrypt.speedMax', 'Fastest interval (ms)', 2, 30, 1],
      ['decrypt.hoverReplay', 'Replay on hover', [0, 1]],
      ['decrypt.colourMode', 'Noise colour', ['own', 'custom']]
    ]]);
    COLOURS.push(['Noise, when custom', 'decrypt.colour']);

    SPEC.push(['Scrambled paragraph', [
      ['scramble.enabled', 'On', [0, 1]],
      ['scramble.radius', 'Pointer radius (px)', 20, 320, 5],
      ['scramble.duration', 'Time to come back (s)', 0.1, 3, 0.05],
      ['scramble.flipsPerSecond', 'Character flips / s', 4, 60, 1],
      ['textHover.pad', 'Hover tolerance around the text (px)', 0, 40, 1]
    ]]);

    if (page === 'supply-chain') {
      SPEC.push(['Count up', [
        ['count.enabled', 'On', [0, 1]],
        ['count.duration', 'Spring duration (s)', 0.4, 6, 0.1],
        ['count.damping', 'Damping (1 = react-bits)', 0.2, 1.4, 0.01],
        ['count.delay', 'Delay (s)', 0, 3, 0.05]
      ]]);
    }

    SPEC.push(['View transition (both pages)', [
      ['vt.fadeOut', 'Outgoing page clears (ms)', 0, 900, 10],
      ['vt.fadeIn', 'Incoming page fades up (ms)', 0, 1200, 10],
      ['vt.title', 'The title travels (ms)', 120, 1600, 10],
      ['vt.lift', 'Incoming page drift (px)', 0, 48, 1]
    ]]);

    SPEC.push(['Target cursor', [
      ['cursor.enabled', 'On', [0, 1]],
      ['cursor.spinSeconds', 'Idle spin (s per turn)', 0, 8, 0.1],
      ['cursor.cornerSize', 'Bracket size (px)', 6, 32, 1],
      ['cursor.borderWidth', 'Bracket thickness (px)', 1, 8, 1],
      ['cursor.restRadius', 'Idle radius (px)', 6, 60, 1],
      ['cursor.padding', 'Padding around the target (px)', 0, 24, 1],
      ['cursor.followTau', 'Follow damping (s)', 0, 0.3, 0.005],
      ['cursor.snapTau', 'Snap damping (s)', 0, 0.4, 0.005],
      ['cursor.hideSystemCursor', 'Hide the system cursor', [0, 1]]
    ]]);

    var panel = T.create({
      id: 'solutions-tuner',
      title: 'SOLUTIONS TUNER',
      target: S,
      accent: '#5cfe50',
      onChange: function (path, value, extra) {
        if (path.indexOf('vt.') === 0) { S.vtApply && S.vtApply(); return; }
        if (path.indexOf('splash.') === 0) { S.splashApply && S.splashApply(); return; }
        if (path.indexOf('cursor.') === 0) { S.cursorApply && S.cursorApply(); return; }
        if (path.indexOf('glass.') === 0) { S.glassApply && S.glassApply(extra === 'targets'); return; }
        if (path.indexOf('decrypt.') === 0 || path.indexOf('count.') === 0) {
          S.textReplay && S.textReplay();
        }
      },
      onReset: function () {
        S.vtApply && S.vtApply();
        S.splashApply && S.splashApply();
        S.cursorApply && S.cursorApply();
        S.glassApply && S.glassApply(true);
        S.textReplay && S.textReplay();
      }
    });

    SPEC.forEach(function (block) {
      panel.section(block[0]);
      block[1].forEach(function (k) {
        if (Array.isArray(k[2])) panel.choice(k[1], k[0], k[2], k[5]);
        else panel.slider(k[1], k[0], k[2], k[3], k[4], k[5]);
      });
    });

    if (COLOURS.length) {
      panel.section('Colour');
      COLOURS.forEach(function (c) { panel.colour(c[0], c[1]); });
    }

    panel.button('Replay the text', function () { S.textReplay && S.textReplay(); });

    /* Igor's rule: the panel always says what is REALLY in effect, because
       none of it can be read off the picture. */
    panel.readout(function () {
      var out = [];
      if (window.SOLUTIONS_GLASS) {
        var g = window.SOLUTIONS_GLASS();
        out.push('lens: webgl' + (g.webgl2 ? '2' : '1') +
                 ' · msaa ' + g.msaaInEffect + '/' + g.msaaRequested +
                 ' · fxaa ' + (g.fxaa ? 'on' : 'off') +
                 ' · dpr ' + g.dpr.toFixed(2) +
                 ' · ' + g.size[0] + '×' + g.size[1] +
                 ' · ' + (g.looping ? 'drawing' : 'at rest'));
        if (g.video) {
          out.push('video: ' + g.video.file + ' · ' + g.video.size[0] + '×' + g.video.size[1] +
                   ' · ' + (g.video.paused ? 'paused' : 'playing') +
                   ' · texture ' + (g.video.texture ? 'yes' : 'no'));
        }
        if (g.error) out.push('lens error: ' + g.error);
      }
      if (window.SOLUTIONS_SPLASH) {
        var sp = window.SOLUTIONS_SPLASH();
        out.push('splash: webgl' + (sp.webgl2 ? '2' : '1') +
                 (sp.dye ? ' · dye ' + sp.dye[0] + '×' + sp.dye[1] : '') +
                 ' · ' + sp.splats + ' splats' +
                 ' · ' + (sp.looping ? 'drawing' : 'at rest'));
        if (sp.error) out.push('splash error: ' + sp.error);
      }
      if (window.SOLUTIONS_TEXT) {
        var t = window.SOLUTIONS_TEXT();
        var m = t.made || { decrypt: 0, scramble: 0, count: [] };
        out.push('decrypt ' + m.decrypt + ' · scramble ' + m.scramble +
                 ' · count ' + JSON.stringify(m.count) +
                 ' · ' + (t.running ? t.running + ' animating' : 'at rest'));
      }
      if (window.SOLUTIONS_CURSOR) {
        var c = window.SOLUTIONS_CURSOR();
        out.push('cursor targets ' + c.targetsTagged +
                 (c.over ? ' · over "' + c.over + '"' : ''));
      }
      if (window.SOLUTIONS_VT) {
        var v = window.SOLUTIONS_VT();
        out.push('view transition: ' + (v.willRun ? 'armed' : 'off — ' + v.whyNot) +
                 (v.arrivedByTransition ? ' · arrived with one' : ''));
      }
      out.push('form elements on this page: ' + window.TunerUI.audit());
      return out.join('\n');
    }, 500);

    panel.actions();
    panel.hint('T hides and shows this panel · double-click a row to reset it');
    panel.mount();
    T.hotkey(panel, 't');

    window.SOLUTIONS_TUNER = panel;
  }

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
