/* =========================================================================
   Context Model — the tuner panel (experiment 6).

   Only the knob list lives here; every control is built by lib/tuner-ui.js,
   which is shared with the other experiments and contains no <input>,
   <select> or <textarea> — anti-phishing rule 12. So the panel is built on
   load again, collapsed, instead of hiding behind the ?tuner gate.

   Each row reads: label, the variable it writes to underneath, and the value
   on the right — amber once it differs from the default, and a double-click
   anywhere on the row puts that default back.

   SPEC entry: [key, label, min, max, step, rebuild?]  — or, when the fourth
   item is an array, [key, label, [choices], , , rebuild?].
   `rebuild` names what has to be rebuilt when the value changes:
   "lens" | "traces" | "particles" | "impacts" | "targets".
   ========================================================================= */
(function () {
  "use strict";

  function start() {
    const C = window.CONTEXT;
    if (!C || !window.TunerUI) { setTimeout(start, 200); return; }

    const SPEC = [
      ["Camera", [
        ["camAz", "Azimuth (°)", -50, 50, 0.5],
        ["camEl", "Elevation (° — negative looks up)", -46, 46, 0.5, "traces"],
        ["viewH", "Zoom (view height)", 2.4, 7.5, 0.05, "traces"],
        ["viewWMin", "Smallest visible width (keeps the lens in frame)", 1.2, 4, 0.05, "traces"],
        ["lensMinPx", "Smallest lens on screen (px, 0 = off)", 0, 700, 10, "traces"],
        ["camY", "Look-at height", -0.6, 1.2, 0.01, "traces"],
        ["parallax", "Parallax amount", 0, 1.5, 0.01]
      ]],
      ["Lens", [
        ["discH", "Frame height", 0.04, 0.32, 0.005, "lens"],
        ["lensH", "Glass thickness (centred in the frame)", 0.01, 0.32, 0.005, "lens"],
        ["bulge", "Underside bulge", -0.45, 0.45, 0.005, "lens"],
        ["ior", "Index of refraction", 1.01, 1.9, 0.01],
        ["refract", "Refraction offset", 0, 0.2, 0.002],
        ["glassBlur", "Refraction blur (px)", 0, 6, 0.1],
        ["tint", "Body tint", 0, 1.2, 0.01],
        ["absorb", "Absorption", 0, 2.5, 0.01],
        ["rim", "Fresnel rim", 0, 2, 0.01],
        ["edge", "Wall highlights", 0, 2.5, 0.01],
        ["sheen", "Aurora on the top face", 0, 2, 0.01],
        ["wash", "Aurora through the underside", 0, 2.5, 0.01],
        ["washCore", "White core of the wash", 0, 1.5, 0.01],
        ["underEnv", "Underside reflection (× rig)", 0, 1, 0.01],
        ["lensContrast", "Contrast (blacks)", 0.5, 4, 0.05],
        ["lensEdgeDark", "Black towards the frame", 0, 1, 0.01],
        ["lensEdgeWidth", "Width of that gradient", 0.02, 0.8, 0.01],
        ["lensSat", "Saturation", 0, 4, 0.05],
        ["ringTop", "Top edge ring", 0, 2.5, 0.01],
        ["ringBottom", "Bottom edge ring", 0, 2.5, 0.01]
      ]],
      ["Frame (Data Core plate)", [
        ["holderMargin", "Frame thickness", 0.01, 0.2, 0.005, "lens"],
        ["holderH", "Height (× glass)", 0.8, 3.0, 0.05, "lens"],
        ["holderRound", "Bevel", 0.05, 1, 0.01, "lens"],
        ["frameTransmission", "Transmission", 0, 1, 0.01],
        ["frameRefract", "Refraction", 0, 2, 0.01],
        ["frameFrost", "Frost", 0, 1, 0.01],
        ["frameMag", "Piece magnifier", 0.4, 1.4, 0.01],
        ["frameShift", "Piece shift", 0, 1, 0.01],
        ["frameFresnel", "Fresnel (milky edges)", 0, 1.5, 0.01],
        ["frameTopClear", "Clear face", 0, 1, 0.01],
        ["frameTopDarken", "Face brightness", 0, 1.2, 0.01],
        ["frameEdgeWhite", "White on the bevel ring", 0, 1.2, 0.01],
        ["frameIri", "Iridescence", 0, 0.5, 0.005],
        ["frameBody", "Body brightness", 0, 2, 0.01],
        ["frameTint", "Global tint", 0.2, 3, 0.02],
        ["frameRim", "Light-edge lines", 0, 3, 0.02],
        ["frameBackdrop", "Studio backdrop", 0, 1.5, 0.01],
        ["frameFire", "Flames inside the frame", 0, 3, 0.02],
        ["frameFireInner", "Fire glow: inner wall", 0, 3, 0.02],
        ["frameFireOuter", "Fire glow: outer wall", 0, 3, 0.02],
        ["frameFireTop", "Fire glow: top rim", 0, 3, 0.02],
        ["frameFireBottom", "Fire glow: bottom rim", 0, 3, 0.02],
        ["frameFireFacing", "Glow prefers faces turned to us", 0, 1, 0.01],
        ["frameInnerBand", "Inner wall: flame slice height", 0.02, 0.5, 0.01],
        ["frameInnerLift", "Inner wall: flame slice lift", -0.2, 0.5, 0.01],
        ["frameInnerRefr", "Inner wall: refraction ×", 0, 3, 0.02],
        ["frameOuterBand", "Outer wall: flame slice height", 0.02, 0.5, 0.01],
        ["frameOuterLift", "Outer wall: flame slice lift", -0.2, 0.5, 0.01],
        ["frameOuterRefr", "Outer wall: refraction ×", 0, 3, 0.02],
        ["frameContrast", "Contrast (whites / blacks)", 0.5, 4, 0.05],
        ["frameSat", "Saturation", 0, 4, 0.05],
        ["refractScene", "Dots & traces through the glass", 0, 1, 1]
      ]],
      ["Impacts", [
        ["impactCount", "Count", 0, 40, 1, "impacts"],
        ["impactSize", "Size", 0.02, 0.2, 0.002],
        ["impactRate", "Rate", 0.05, 1.5, 0.01],
        ["impactOpacity", "Opacity", 0, 2, 0.01],
        ["impactOnColumns", "Born on the columns", 0, 1, 0.05],
        ["impactSpreadZ", "Off the line (chip widths)", 0, 12, 0.5],
        ["impactGrow", "Swell over life", 0, 2, 0.05],
        ["shaftH", "Light shaft height", 0, 1.2, 0.01],
        ["shaftW", "Light shaft width (× chip)", 0.1, 2, 0.05],
        ["shaftOpacity", "Light shaft strength", 0, 2.5, 0.01]
      ]],
      ["Light rig (banded softbox)", [
        ["env", "Reflection strength", 0, 2.5, 0.01],
        ["envBands", "Bands", 1, 14, 1],
        ["envSoft", "Band softness", 0.05, 0.95, 0.01],
        ["envRot", "Rotation", -3.2, 3.2, 0.02]
      ]],
      ["Aurora", [
        ["auroraInt", "Intensity", 0, 2.5, 0.01],
        ["auroraSpread", "Width", 0.4, 2.2, 0.01],
        ["auroraHeight", "Height", 0.4, 2.2, 0.01],
        ["flameHeightA", "Orange flame height (× height)", 0.3, 2.5, 0.01],
        ["flameHeightB", "Blue flame height (× height)", 0.3, 2.5, 0.01],
        ["flameSep", "Distance between the two flames", 0, 1.2, 0.01],
        ["flameWhite", "White core", 0, 1.5, 0.01],
        ["flamePulse", "Breathing depth", 0, 0.8, 0.01],
        ["flameRateA", "Orange breath (Hz)", 0.02, 1, 0.01],
        ["flameRateB", "Blue breath (Hz)", 0.02, 1, 0.01],
        ["auroraFlame", "Flame", 0, 1.5, 0.01],
        ["auroraFlow", "Flame speed", 0, 0.5, 0.005],
        ["auroraSat", "Colour", 0, 2.5, 0.01],
        ["auroraWidth", "Sideways limit", 0.6, 2.5, 0.01]
      ]],
      ["Signal traces", [
        ["traceCount", "Count", 0, 40, 1, "traces"],
        ["traceRadius", "Thickness", 0.002, 0.014, 0.0005],
        ["traceSpeed", "Beam speed", 0, 0.6, 0.005],
        ["traceTail", "Tail length", 0.05, 1.2, 0.01],
        ["traceFadeIn", "Fade-in above the lens", 0.02, 0.6, 0.01],
        ["traceGap", "Pause before restarting (s)", 0, 4, 0.1],
        ["traceGlow", "Glow", 0, 2.5, 0.01],
        ["traceRun", "Run stretch (× SVG rhythm)", 0.3, 3, 0.05, "traces"],
        ["traceSameDir", "All jog the same way first", 0, 1, 1, "traces"],
        ["traceLineZ", "Off the columns' line (depth)", 0, 0.8, 0.01, "traces"],
        ["traceJogLen", "Jog length", 0.05, 0.7, 0.01, "traces"],
        ["traceCornerR", "Corner radius", 0.02, 0.2, 0.005, "traces"],
        ["traceBeams", "Beams per trace", 1, 3, 1, "traces"],
        ["traceHeadSize", "Head dot size", 0.005, 0.08, 0.001]
      ]],
      ["Data rain", [
        ["partCount", "Count", 200, 9000, 100, "particles"],
        ["partColumns", "Columns", 5, 45, 1, "particles"],
        ["partSize", "Dot size", 0.003, 0.035, 0.0005],
        ["partSpeed", "Fall speed", 0, 0.25, 0.002],
        ["partFall", "Fall distance", 0.8, 4.5, 0.05],
        ["partSpread", "Dispersion", 0, 1.0, 0.01],
        ["partJitter", "Jitter", 0, 0.25, 0.005],
        ["partSpan", "Row width (× lens)", 0.3, 1.1, 0.01, "particles"],
        ["partLineZ", "Off the centre line (depth)", 0, 0.7, 0.01, "particles"],
        ["partOrder", "Ordered stretch (of climb)", 0, 0.9, 0.01],
        ["partScatter", "Scatter curve", 0.5, 4, 0.05],
        ["partSpeedVar", "Speed variation in a column", 0, 1, 0.05, "particles"],
        ["partOpacity", "Opacity", 0, 1.5, 0.01]
      ]],
      ["Scroll stages", [
        ["scrollIn", "Arrival length (box heights)", 0.2, 4, 0.1],
        ["scrollHold", "Hold length (box heights)", 0, 4, 0.1],
        ["scrollOut", "Exit length (box heights)", 0.2, 4, 0.1],
        ["scrollLead", "Lead-in before the box sticks", 0, 1, 0.05],
        ["scrollLeadCap", "Most of the timeline the lead-in may take", 0.1, 0.8, 0.05],
        ["boxRatio", "Box proportion (width / height)", 0.8, 2.4, 0.001],
        ["boxRatioNarrow", "Box proportion under 700 px", 0.35, 2.4, 0.001],
        ["scrollPreview", "Preview with the scrub (ignore scroll)", 0, 1, 1],
        ["scrollScrub", "Scrub: 0→1 arrival, 1→2 exit", 0, 2, 0.01]
      ]],
      ["Hover / tilt reaction", [
        ["hoverOn", "Enabled", 0, 1, 1],
        ["hoverRadius", "Reach (screen)", 0.05, 1, 0.01],
        ["hoverChaos", "Dots: chaos", 0, 2, 0.02],
        ["hoverDodge", "Traces: dodge (extra jog width)", 0, 2, 0.01],
        ["hoverThick", "Traces: thicken near the pointer (×)", 0, 8, 0.1],
        ["tiltChaos", "Phone shake: chaos", 0, 3, 0.05]
      ]],
      ["Motion", [
        ["flowUp", "Flow direction (1 up, 0 down)", [1, 0]],
        ["timeScale", "Global speed", 0, 3, 0.01]
      ]],
      ["Bloom & sharpness", [
        ["bloom", "Bloom", 0, 1, 1],
        ["bloomThresh", "Threshold", 0, 1.2, 0.01],
        ["bloomStrength", "Strength", 0, 2.5, 0.01],
        ["bloomRadius", "Radius", 0.4, 5, 0.05],
        ["msaa", "MSAA samples", [0, 2, 4, 8], null, null, "targets"],
        ["fxaa", "FXAA", [0, 1]],
        ["dprCap", "Max pixel ratio", 1, 3, 0.25, "targets"],
        ["prePass", "Pre-pass resolution", 0.4, 1, 0.05, "targets"]
      ]]
    ];

    const panel = window.TunerUI.create({
      id: "context-tuner",
      title: "CONTEXT TUNER",
      accent: "#7fd7c4",
      target: C.cfg,
      defaults: C.defaults,
      onChange: function (path, value, rebuild) {
        C.apply();
        if (rebuild) C.rebuild(rebuild);
      },
      onReset: function () { C.rebuild("particles"); C.rebuild("lens"); C.rebuild("targets"); }
    });

    SPEC.forEach(function (group) {
      panel.section(group[0]);
      group[1].forEach(function (item) {
        const key = item[0], label = item[1];
        if (Array.isArray(item[2])) panel.choice(label, key, item[2], item[5]);
        else panel.slider(label, key, item[2], item[3], item[4], item[5]);
      });
    });

    // Igor's rule: every panel says what the antialias is REALLY doing.
    panel.readout(function () { return C.readout(); });
    panel.actions();
    panel.hint();
    panel.mount();
    window.TunerUI.hotkey(panel, "t");

    window.CONTEXT_TUNER = {
      show: function () { panel.show(); },
      hide: function () { panel.hide(); },
      open: function () { panel.show().open(); }
    };
  }

  window.TunerUI ? window.TunerUI.ready(start)
                 : (document.readyState !== "loading" ? start()
                    : document.addEventListener("DOMContentLoaded", start));
})();
