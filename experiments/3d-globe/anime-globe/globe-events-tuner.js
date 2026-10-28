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
      ["Marker", [
        ["dotSizeRatio", "Dot size (× globe radius)", 0.008, 0.06, 0.001],
        ["dotMinPx", "Smallest dot (px)", 4, 20, 1],
        ["dotMaxPx", "Largest dot (px)", 8, 40, 1],
        ["hoverGrow", "Grow on hover / open", 1, 2.5, 0.05],
        ["limbFadeZ", "Fade-in depth at the limb", 0.02, 0.6, 0.01]
      ]],
      ["Pulse", [
        ["pulse", "Pulsing halo", [0, 1]],
        ["pulseMs", "Pulse period (ms)", 600, 5000, 100],
        ["haloScale", "Halo size (× dot)", 1.4, 5, 0.1]
      ]],
      ["Card", [
        ["cardOffsetPx", "Gap from the dot (px)", 0, 80, 1],
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
