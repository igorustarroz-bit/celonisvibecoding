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

   Limitation, stated rather than hidden: context-core.js binds to the element
   ids `context-stage` / `context-sticky` / `context-scroll`, so one instance
   per page. A second one renders a notice instead of a second scene. Making
   the scene instance-scoped is the next change, and it is the same change
   that would let it be authored twice on one page.
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

  let mounted = false;

  function notice(target, text) {
    const box = document.createElement("div");
    box.className = "interactive-asset-error";
    const p = document.createElement("p");
    p.textContent = text;
    box.append(p);
    target.replaceChildren(box);
  }

  /* The stage context-core.js expects: a tall scroll container, a sticky box
     inside it, and the canvas. Identical to the markup experiment 6 injects
     into the saved page — the ids are what the effect binds to. */
  function buildStage(target) {
    const scroll = document.createElement("div");
    scroll.id = "context-scroll";
    const sticky = document.createElement("div");
    sticky.id = "context-sticky";
    const canvas = document.createElement("canvas");
    canvas.id = "context-stage";
    sticky.append(canvas);
    scroll.append(sticky);
    target.replaceChildren(scroll);
    return canvas;
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

  function applySettings(props) {
    const api = window.CONTEXT;
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

    if (mounted) {
      notice(target, "Context Model is already running on this page — the scene binds to fixed element ids, so it can only be placed once.");
      return;
    }
    mounted = true;

    this.target = target;
    this.props = props;

    const loadCSS = window.EDSLite.loadCSS;
    const loadScript = window.EDSLite.loadScript;

    buildStage(target);
    SCENE_CSS.forEach(loadCSS);

    // Strictly sequential: three.js has to be there before the scene runs, and
    // the tuner before it reads window.CONTEXT.
    this.ready = SCENE_JS.reduce(function (chain, src) {
      return chain.then(function () { return loadScript(src); });
    }, Promise.resolve())
      .then(function () {
        applySettings(props);
        const wantsTuner = String(props.tuner || "on").toLowerCase() !== "off";
        return wantsTuner ? loadScript(TUNER_JS) : null;
      })
      .catch(function (err) {
        mounted = false;
        console.error("[ContextModel] failed to start", err);
        notice(target, "Context Model could not start: " + err.message);
      });
  }

  ContextModel.prototype.destroy = function () {
    // The scene's own teardown is still to be written: context-core.js takes
    // the page for the life of the document. Clearing the stage is enough for
    // the block's error path; a real unmount comes with the instance-scoped
    // rewrite noted at the top of this file.
    this.target.replaceChildren();
    mounted = false;
  };

  window.AssetRegistry.register("ContextModel", ContextModel);
})();
