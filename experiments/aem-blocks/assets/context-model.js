/* =========================================================================
   ContextModel — experiment 6 packaged as an interactive asset.

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   This is the whole point of the pilot: the scene itself is untouched. The
   effect still lives in ../../context-model/context-fx/context-core.js and is
   loaded from there, never copied (repo rule: anything shared sits once, at
   the experiments/ level). What this file adds is the shape the site's
   `interactive-asset` block expects:

       new AssetClass({ target, props: { ... } })

   which is the Svelte component constructor signature. Their only registered
   asset today is a Svelte component, but the block never asks for Svelte — it
   constructs the class and keeps the instance. A plain class with this
   constructor satisfies the contract, which is what lets a vanilla WebGL
   scene of ours be registered beside theirs. CONFIRM WITH THE CLIENT before
   building the rest on it; if they want real Svelte components, only this
   wrapper changes and the scene below stays as it is.

   Authored options reach `props` as strings (the document is the source of
   truth). Anything whose key exists in `window.CONTEXT.defaults` is coerced
   to the type of that default and pushed into the live scene, so an author
   can write `camAz | 30` or `bloom | 0.4` in the block and see it. Unknown
   keys are reported and ignored rather than silently dropped.

   Since 2026-10-28 the scene is instance-scoped: context-core.js publishes
   `window.ContextModelScene.create({ canvas, sticky, scrollBox })` and returns
   a control surface with a real `destroy()`, so a page can hold more than one
   of these — which is what the block library page needs. The old fixed ids
   still boot experiment 6's own page by themselves; here the stage is built
   with classes instead.
   ========================================================================= */
(function () {
  "use strict";

  const HERE = new URL(".", document.currentScript.src);
  const url = function (rel) { return new URL(rel, HERE).href; };

  const SCENE_CSS = [url("../../context-model/context-fx/context.css?v=2"), url("../../lib/tuner-ui.css?v=1")];
  const SCENE_JS = [
    url("../../lib/three.min.js?v=14"),
    url("../../lib/tilt-parallax.js?v=1"),
    url("../../lib/tuner-ui.js?v=2"),
    url("../../context-model/context-fx/context-core.js?v=7"),
  ];
  const TUNER_JS = url("../../context-model/context-fx/context-tuner.js?v=5");

  /* The tuner reads window.CONTEXT, and there is only one of those. The first
     instance that asks for a tuner gets it; later ones render without one. */
  let tunerTaken = false;

  function notice(target, text) {
    const box = document.createElement("div");
    box.className = "interactive-asset-error";
    const p = document.createElement("p");
    p.textContent = text;
    box.append(p);
    target.replaceChildren(box);
  }

  /* The stage context-core.js expects: a tall scroll container, a sticky box
     inside it, and the canvas. Classes, not ids — the ids belong to experiment
     6's own page, which boots itself. */
  function buildStage(target) {
    const scroll = document.createElement("div");
    scroll.className = "context-scroll";
    const sticky = document.createElement("div");
    sticky.className = "context-sticky";
    const canvas = document.createElement("canvas");
    canvas.className = "context-stage";
    sticky.append(canvas);
    scroll.append(sticky);
    target.replaceChildren(scroll);
    return { canvas: canvas, sticky: sticky, scrollBox: scroll };
  }

  /* Authored values are strings. Coerce each one to the type of the default it
     overrides; a value that does not parse is left alone and reported. */
  function coerce(value, sample) {
    if (typeof sample === "number") {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof sample === "boolean") {
      const v = String(value).trim().toLowerCase();
      if (["true", "on", "yes", "1"].indexOf(v) !== -1) return true;
      if (["false", "off", "no", "0"].indexOf(v) !== -1) return false;
      return null;
    }
    return value;
  }

  /* Keys the block itself owns; never scene settings. */
  const RESERVED = ["name", "modalHash", "videoAnimation", "tuner", "theme"];

  function applySettings(api, props) {
    if (!api) return;
    const applied = [];
    const unknown = [];
    Object.keys(props).forEach(function (key) {
      if (RESERVED.indexOf(key) !== -1) return;
      if (!(key in api.defaults)) { unknown.push(key); return; }
      const value = coerce(props[key], api.defaults[key]);
      if (value === null) { unknown.push(key); return; }
      api.cfg[key] = value;
      applied.push(key + "=" + value);
    });
    if (applied.length) {
      api.apply();
      console.info("[ContextModel] authored settings applied: " + applied.join(", "));
    }
    if (unknown.length) {
      console.warn("[ContextModel] ignored authored keys (not a scene setting, or unparseable): " + unknown.join(", "));
    }
  }

  function ContextModel(args) {
    const options = args || {};
    const target = options.target;
    const props = options.props || {};

    if (!target) throw new Error("ContextModel needs a target element");

    this.target = target;
    this.props = props;
    this.scene = null;

    const loadCSS = window.EDSLite.loadCSS;
    const loadScript = window.EDSLite.loadScript;
    const self = this;

    const stage = buildStage(target);
    SCENE_CSS.forEach(loadCSS);

    const wantsTuner = String(props.tuner || "on").toLowerCase() !== "off";

    // Strictly sequential: three.js has to be there before the scene runs, and
    // the tuner before it reads window.CONTEXT.
    this.ready = SCENE_JS.reduce(function (chain, src) {
      return chain.then(function () { return loadScript(src); });
    }, Promise.resolve())
      .then(function () {
        self.scene = window.ContextModelScene.create(stage);
        applySettings(self.scene, props);
        if (wantsTuner && !tunerTaken) {
          tunerTaken = true;
          window.CONTEXT = self.scene;
          return loadScript(TUNER_JS);
        }
        return null;
      })
      .catch(function (err) {
        console.error("[ContextModel] failed to start", err);
        notice(target, "Context Model could not start: " + err.message);
      });
  }

  ContextModel.prototype.destroy = function () {
    if (this.scene) {
      this.scene.destroy();
      if (window.CONTEXT === this.scene) { window.CONTEXT = null; tunerTaken = false; }
      this.scene = null;
    }
    this.target.replaceChildren();
  };

  window.AssetRegistry.register("ContextModel", ContextModel);
})();
