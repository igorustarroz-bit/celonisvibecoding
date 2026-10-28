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
        ["blurPx", "Blur of the glow / arcs layer (px)", 0, 6, 0.1],
        ["discBlurPx", "Blur of the cylinder itself (px)", 0, 3, 0.1],
        ["hoverGrow", "Grow on hover / open", 1, 2.5, 0.05],
        ["limbFadeZ", "Fade-in depth at the limb", 0.02, 0.6, 0.01],
        ["@colour", "Marker colour", "discColor"]
      ]],
      ["Pulse (ultra-flat ghost cylinder)", [
        ["pulse", "Pulse", [0, 1]],
        ["pulseMs", "Period (ms)", 600, 6000, 100],
        ["pulseCount", "How many at once", [1, 2, 3]],
        ["rippleScale", "How far it grows (x radius)", 1.4, 8, 0.1],
        ["rippleFlat", "How flat (x marker height)", 0.05, 1, 0.05],
        ["rippleOpacity", "Opacity", 0, 1, 0.05]
      ]],
      ["Destinations", [
        ["cityCount", "How many cities (1 = one flight round the world)", [1, 2, 3, 4]]
      ]],
      ["Flight arcs", [
        ["arcs", "Draw the arcs", [0, 1]],
        ["arcCount", "How many flights (4 = one in + one out)", 0, 20, 1],
        ["arcAltitude", "Arc height (hugs the globe)", 0.005, 0.5, 0.005],
        ["arcWidthRatio", "Stroke width (x buffer)", 0.0004, 0.004, 0.0001],
        ["arcPersist", "Keep the line on screen (0 = only the tail draws it)", [0, 1]],
        ["arcOpacity", "Opacity of that steady line", 0, 1, 0.02],
        ["arcSamples", "Samples per arc", 16, 160, 4],
        ["@colour", "Arc colour (ends)", "arcColor"],
        ["@colour", "Arc colour (middle + comet)", "arcColor2"]
      ]],
      ["Flights", [
        ["flights", "Comet along the arc", [0, 1]],
        ["flightMs", "Time for a half-world hop (ms)", 1000, 20000, 100],
        ["@pct", "Tail length (% of the trip)", "flightTrail", 2, 90, 1],
        ["flightSize", "Head size (x stroke)", 0, 6, 0.1],
        ["flightGlow", "Glow", 0, 3, 0.1],
        ["flightWaitMs", "Wait on the ground between laps (ms)", 0, 6000, 50]
      ]],
      ["Card", [
        ["cardOffsetPx", "Gap from the marker (px)", 0, 80, 1],
        ["cardGrowMs", "Grow out of the marker (ms)", 80, 900, 10],
        ["cardStaggerMs", "Contents, one after the other (ms)", 0, 300, 5],
        ["badgeDraw", "Draw the badge outline (0 = plain fade)", [0, 1]],
        ["badgeDrawMs", "Badge drawing time (ms)", 200, 3000, 50],
        ["badgeStroke", "Badge line weight", 0.2, 2.5, 0.05],
        ["badgeOrder", "Shapes: 0 all at once / 1 upwards / 2 downwards", [0, 1, 2]],
        ["@colour", "Badge line while drawing", "badgeDrawColor"],
        ["@colour", "Badge colour once drawn", "badgeFillColor"],
        ["badgeTintMs", "Line colour -> final colour (ms)", 0, 3000, 50],
        ["badgeGlow", "Badge glow (uses the line colour)", 0, 6, 0.1],
        ["badgeGlowLayers", "Glow layers stacked", [1, 2, 3]],
        ["badgeGlowDraw", "Glow only while drawing", [0, 1]],
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
        if (key === "@colour") panel.colour(label, item[2]);
        else if (key === "@pct") panel.slider(label, item[2], item[3], item[4], item[5], {
          fmt: function (v) { return v.toFixed(0) + " %"; },
          read: function (v) { return v * 100; },     // stored 0..1 -> shown 0..100
          write: function (o) { return o / 100; }
        });
        else if (Array.isArray(item[2])) panel.choice(label, key, item[2]);
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
