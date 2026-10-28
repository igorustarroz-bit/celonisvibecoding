/* =========================================================================
   eds-lite.js — a minimal stand-in for the AEM Edge Delivery decoration step.

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   On the real site, EDS turns an authored table into
   `<div class="<name> [variants]" data-block-name="<name>">` wrapped in a
   `<div class="<name>-wrapper">`, then loads `<name>.js` + `<name>.css` and
   calls the module's default export with the block element.

   This file does the same three things for a static page, so a block written
   against the real contract runs here unchanged:

     1. finds every `[data-block]` element and gives it the EDS shape,
     2. loads the block's CSS and JS,
     3. calls its decorator with the block element.

   Why not ES modules, which is what EDS really uses: a `<script type="module">`
   cannot be imported from `file://` (the origin is `null` and the request is
   blocked), and every page in this repo has to open from the filesystem. So a
   block here registers itself on `window.EDSBlocks` instead of exporting a
   default. Each block file carries, at its top, the two-line diff back to the
   real `export default` form — see blocks/interactive-asset/interactive-asset.js.
   ========================================================================= */
(function () {
  "use strict";

  window.EDSBlocks = window.EDSBlocks || {};
  const HERE = new URL(".", document.currentScript.src);

  /* ----------------------------------------------------------------------
     getOptionsFromBlock — ported from the site's own
     src/scripts/helpers/getters/block.js (recovered from the published source
     maps on the preview host). Keep this in step with theirs: it is the
     contract every block reads its configuration through.

     A row is `<div><div>label</div><div>value</div></div>`. The label is
     camelCased into the key. The value is the link's href if the cell holds a
     link, an array if it holds a list, and the trimmed text otherwise. Rows
     with fewer than two cells are ignored.
     ---------------------------------------------------------------------- */
  function toCamelCase(str) {
    return String(str || "")
      .split(/[-_ ]/)
      .map(function (part, i) {
        const t = part.trim();
        if (!t) return "";
        return i === 0
          ? t.charAt(0).toLowerCase() + t.slice(1)
          : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      })
      .join("");
  }

  function readList(ul) {
    return [...ul.children].map(function (li) {
      const a = li.querySelector("a");
      return a ? a.getAttribute("href") : (li.textContent || "").trim();
    });
  }

  function getOptionsFromBlock(block, defaults) {
    const options = Object.assign({}, defaults || {});
    [...block.children].forEach(function (row) {
      if (row.children.length < 2) return;
      const key = toCamelCase((row.children[0].textContent || "").trim());
      const cell = row.children[1];
      const list = cell.querySelector(":scope > ul");
      const link = cell.querySelector(":scope > a");
      if (list) options[key] = readList(list);
      else if (link) options[key] = link.getAttribute("href");
      else options[key] = (cell.textContent || "").trim();
    });
    return options;
  }

  window.EDSLite = { getOptionsFromBlock: getOptionsFromBlock, toCamelCase: toCamelCase };

  /* ---------------------------------------------------------------- loading */
  const loaded = {};

  function loadCSS(href) {
    if (loaded[href]) return Promise.resolve();
    loaded[href] = true;
    return new Promise(function (resolve) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = link.onerror = function () { resolve(); };
      document.head.append(link);
    });
  }

  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.append(s);
    });
    return loaded[src];
  }

  window.EDSLite.loadScript = loadScript;
  window.EDSLite.loadCSS = loadCSS;

  /* ---------------------------------------------------------------- decorate */
  async function decorateBlock(el) {
    const name = el.dataset.block;
    el.classList.add(name);
    el.dataset.blockName = name;
    el.dataset.blockStatus = "loading";
    delete el.dataset.block;

    // EDS wraps every block in `<div class="<name>-wrapper">`; the site's own
    // CSS is written against that wrapper, so the shape has to be there.
    if (!el.parentElement.classList.contains(name + "-wrapper")) {
      const wrapper = document.createElement("div");
      wrapper.classList.add(name + "-wrapper");
      el.parentElement.insertBefore(wrapper, el);
      wrapper.append(el);
    }

    const base = new URL("blocks/" + name + "/" + name, HERE).href;
    await Promise.all([loadCSS(base + ".css?v=1"), loadScript(base + ".js?v=1")]);

    const decorate = window.EDSBlocks[name];
    if (typeof decorate !== "function") {
      el.dataset.blockStatus = "error";
      console.error('[eds-lite] block "' + name + '" did not register a decorator');
      return;
    }
    try {
      await decorate(el);
      el.dataset.blockStatus = "loaded";
    } catch (err) {
      el.dataset.blockStatus = "error";
      console.error('[eds-lite] block "' + name + '" failed to decorate', err);
    }
  }

  function run() {
    document.querySelectorAll("[data-block]").forEach(decorateBlock);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
