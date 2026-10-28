/* =========================================================================
   Globe events — the tuner panel (experiment 2).

   Only the knob list lives here; every control is built by lib/tuner-ui.js,
   which contains no <input>, <select> or <textarea> (anti-phishing rule 12),
   so the panel is built on load, collapsed.

   It tunes window.GLOBE_EVENTS — the event markers added on top of the globe.
   globe.js keeps its own CFG private and still has no panel of its own.

   SPEC entry: [key, label, min, max, step] — or [key, label, [choices]].
   ========================================================================= */
(function () {
  "use strict";

  function start() {
    var G = window.GLOBE_EVENTS;
    if (!G || !window.TunerUI) { setTimeout(start, 200); return; }

    var SPEC = [
      ["Marker (flat cylinder)", [
        ["discRadiusDeg", "Radius on the sphere (deg)", 0.5, 5, 0.1],
        ["discHeight", "Thickness (x globe radius)", 0.002, 0.06, 0.001],
        ["discWall", "Side wall darkening", 0, 0.9, 0.02],
        ["discEdge", "Rim on the top face", 0, 1.5, 0.05],
        ["discShade", "Shading across the top face", 0, 1, 0.05],
        ["discGlow", "Glow", 0, 2, 0.05],
        ["hoverGrow", "Grow on hover / open", 1, 2.5, 0.05],
        ["limbFadeZ", "Fade-in depth at the limb", 0.02, 0.6, 0.01]
      ]],
      ["Ripple", [
        ["pulse", "Ripple on the surface", [0, 1]],
        ["pulseMs", "Period (ms)", 600, 6000, 100],
        ["rippleScale", "Travel (x radius)", 1.4, 6, 0.1]
      ]],
      ["Flight arcs", [
        ["arcs", "Draw the arcs", [0, 1]],
        ["arcAll", "Every pair (0 = one chain)", [0, 1]],
        ["arcAltitude", "Arc height", 0.05, 1.2, 0.01],
        ["arcWidthRatio", "Stroke width (x buffer)", 0.0004, 0.004, 0.0001],
        ["arcOpacity", "Opacity", 0, 1, 0.02],
        ["arcSamples", "Samples per arc", 16, 160, 4]
      ]],
      ["Flights", [
        ["flights", "Comet along the arc", [0, 1]],
        ["flightMs", "Lap time (ms)", 1500, 15000, 100],
        ["flightTrail", "Tail length", 0.02, 0.5, 0.01],
        ["flightSize", "Head size (x stroke)", 0.5, 6, 0.1]
      ]],
      ["Card", [
        ["cardOffsetPx", "Gap from the marker (px)", 0, 80, 1],
        ["cardBorder", "Hairline border (0 = pure Figma black)", [0, 1]],
        ["pauseSpin", "Pause the spin while open", [0, 1]]
      ]]
    ];

    var panel = window.TunerUI.create({
      id: "ge-tuner",
      title: "EVENTS TUNER",
      accent: "#5cfe50",
      target: G,
      onChange: function () { G.apply(); },
      onReset: function () { G.apply(); }
    });

    SPEC.forEach(function (group) {
      panel.section(group[0]);
      group[1].forEach(function (item) {
        var key = item[0], label = item[1];
        if (Array.isArray(item[2])) panel.choice(label, key, item[2]);
        else panel.slider(label, key, item[2], item[3], item[4]);
      });
    });

    panel.section("Events");
    G.events.forEach(function (ev) {
      panel.button("Open " + ev.city, function () { G.open(ev.id); }, true);
    });
    panel.button("Close card", function () { G.close(); }, true);

    panel.readout(function () {
      var e = window.__earth;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cv = document.getElementById("earth-canvas");
      return "antialias: none (Canvas 2D, dashes stroked with round caps) · dpr " +
        dpr.toFixed(1) + " · buffer " + (cv ? cv.width : 0) + "px" +
        (e ? " · spin " + (e.state.spin).toFixed(3) : "");
    });
    panel.actions();
    panel.hint();
    panel.mount();
    window.TunerUI.hotkey(panel, "t");

    window.GLOBE_EVENTS_TUNER = {
      show: function () { panel.show(); },
      hide: function () { panel.hide(); },
      open: function () { panel.show().open(); }
    };
  }

  window.TunerUI ? window.TunerUI.ready(start)
                 : (document.readyState !== "loading" ? start()
                    : document.addEventListener("DOMContentLoaded", start));
})();
