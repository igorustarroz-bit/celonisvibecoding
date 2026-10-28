# AEM / Edge Delivery Services context (started 2026-10-28)

Why this doc: the client asked that our experiments carry "AEM tech" so that migrating
them into their system is easy later. This is what we learned from their own block
library, and the contract an experiment has to honour to be portable.

Source of truth we were given:
`https://develop--commercial--celonis.aem.page/tools/sidekick/library.html?plugin=blocks`
(the AEM Sidekick block library of the `commercial` site, branch `develop`).

## 1. What the Celonis site actually runs on

AEM **Edge Delivery Services** (EDS, aem.live) — the same thing our process doc already
pointed at in step 5. Confirmed from the live preview:

- Blocks are plain ES modules + CSS, one folder per block, loaded per block on the page.
- **They do NOT ship the stock EDS boilerplate layout.** There is a build step: sources
  live in `src/`, output is served from `/dist/`. Rolldown is the bundler (see
  `/dist/chunks/rolldown-runtime.js`), with path aliases `@scripts/…` and `@helpers/…`.
  `src/scripts/scripts.ts` is TypeScript; block code is JS.
- Served layout:
  - `/dist/scripts/aem.js`, `/dist/scripts/scripts.js`, `/dist/styles/styles.css`
  - `/dist/blocks/<block-name>/<block-name>.js` + `.css`
  - `/dist/chunks/*.js` — shared code split out (`block.js`, `dom.js`, `event.js`,
    `gsap.js`, `tokens.js`, `timeline-registry.js`, `animated-words.js`,
    `intersection-pool.js`, `purify.es.js`, …)
- Source layout, recovered from the source maps (they publish `.js.map` with full
  `sourcesContent` on the preview host): `src/blocks/<block-name>/<block-name>.js`.
- **They already use GSAP**, plus a timeline registry and a shared IntersectionObserver
  pool. Our experiments use GSAP too — same family, no conflict.
- Third-party on their pages (Adobe Launch, OneTrust, GTM) is theirs, not ours, and must
  never appear in our replicas (anti-phishing rule 13).

## 2. The authoring contract — this is the part that matters

A block is authored as a table in a document. After EDS decorates it, the block element is:

```
<div class="<block-name> [variant] [variant]" data-block-name="<block-name>">
  <div><div>label</div><div>value</div></div>   <- one row per option
  <div><div>label</div><div>value</div></div>
</div>
```

and `getOptionsFromBlock()` (source: `src/scripts/helpers/getters/block.js`, shipped as
`/dist/chunks/block.js`) turns those rows into a config object:

- the first cell is the key, **camelCased** (`modalHash`, `videoAnimation`);
- the second cell is the value: `textContent`, or the `href` if it holds a link, or an
  array if it holds a `<ul>`;
- a row with fewer than two cells is ignored.

Variants are extra CSS classes on the block element, written by the author in parentheses
in the block title — e.g. `Embed Code (full-screen)` → `class="embed-code full-screen"`,
`Interactive Asset (dark-base-theme, full-width)`. Themes travel the same way
(`dark-base-theme`).

Consequence for us: **an experiment is portable when its effect reads its settings from a
key/value DOM structure and nothing else.** No hard-coded ids, no `querySelector('#hero')`,
no settings baked into the script. That is the single change that makes a migration cheap,
and it costs us almost nothing because our tuner panels already centralise every knob.

Their block catalogue is 61 entries, named `M02`…`M64` plus a few utilities. Full list is
in `/tools/sidekick/library.json` under `blocks`.

## 3. Where OUR experiments would plug in

Two real integration surfaces, and we should aim at the first one.

### 3.1 `interactive-asset` — the intended door for custom interactive work

`src/blocks/interactive-asset/asset-registry.js`, verbatim from their source map:

```js
import PeriodicTable from '@celonis/c-web-interactives/PeriodicTable';

const ASSET_REGISTRY = {
  PeriodicTable,
  // Add more assets here as they become available
  // NetworkDiagram,
  // TimelineViz,
  // DataExplorer,
};
```

The block reads three options (`name`, `modalHash`, `videoAnimation`), looks the name up in
that registry and instantiates it:

```js
const assetInstance = new AssetClass({
  target: container,                       // a <div class="interactive-asset-container">
  props: { modalHash, videoAnimation },
});
```

Authored, it looks like this (from their own library page):

```
Interactive Asset (dark-base-theme, full-width)
  name            | PeriodicTable
  modalHash       | #report
  videoAnimation  | /src/assets/videos/periodic-table-galaxy.mp4
```

Notes:

- `{ target, props }` is the **Svelte component constructor signature**, and the Svelte
  runtime is bundled into that chunk, so `@celonis/c-web-interactives` is a Svelte package.
- **But the block never asks for Svelte.** It only calls `new X({target, props})` and keeps
  the instance. A plain ES class with that constructor signature satisfies the contract,
  which means our vanilla-JS scenes can be delivered as interactive assets without adopting
  Svelte. **To confirm with the client** before we build on it — if they want real Svelte
  components, the wrapper is thin either way, because the scene stays vanilla inside.
- The registry is a manual, static import list with an explicit "add more assets here"
  comment. Adding ours is a one-line change in their repo — that is the handover.

### 3.2 `M64 - Video Scroll` — experiment 1 already is this block

Their `video-scroll` block is authored as scenes with exactly the parameters we invented
independently: `sequence`, then per scene `subtitle`, `title`, `button`, `Range` (frame
range, e.g. `1-70`), `position` (`top-left`…), `Theme` (`light`/`dark`), `Animation`
(`fade`), plus a `Title Variant` and `percentage`. Our `Concept-Video-Scroll` experiment
should be re-expressed against these option names rather than its own.

### 3.3 Catalogue overlap with what we have built

| Our experiment | Their module |
| --- | --- |
| 1 — Concept Video Scroll | M64 - Video Scroll |
| 2 — 3D globe (home hero) | M02 - Home Hero (+ `interactive-asset` for the globe itself) |
| 3 — Data Core | `interactive-asset` |
| 4 — 3D book | M35 - Detail Page Hero / `interactive-asset` |
| 5 — Celosphere seal | `interactive-asset`; its lite ports map to M03, M39, and a carousel |
| 6 — Context Model | `interactive-asset` |
| 7 — Solutions (2 pages) | M09 - Solutions, M15 - Secondary hero |

`Embed Code` and `Code snippet` also exist, and `Embed Code (full-screen)` accepts raw
`<script>` + `<iframe>`. It is the lowest-effort escape hatch, and the wrong target for us:
an iframe is not a migration, it is a postponement. Use `interactive-asset`.

## 4. What this does NOT change

- Everything stays static HTML/CSS/JS on GitHub Pages. An EDS block is an ES module and a
  stylesheet; nothing here needs a server, a build or AEM to run.
- The anti-phishing rules are untouched and still win: no cross-origin request, no CDN,
  no data-entry element, works from `file://`. We do not pull `/dist/` from their preview
  host at runtime — it is a reference, not a dependency.
- `main` and everything published from it are untouched. Safety net in place:
  tag **`before-aem`** at `dfeb2a2` and branch **`before-aem-main`**; work happens on
  branch **`aem-blocks`**.

## 5. Open questions for the client

1. Is `interactive-asset` the surface they want our experiments to land on, and does the
   registry accept a plain ES class, or must it be a Svelte component from
   `@celonis/c-web-interactives`?
2. Can we get read access to the site repo (or at least to `src/blocks/interactive-asset/`
   and one `src/blocks/<module>/` of their choice)? The source maps give us the shipped
   code, not the project conventions, the lint rules or the token layer.
3. Do they want the experiments authored as documents in their own library (so they open in
   the Sidekick block library), or just delivered as block-shaped code?

## 6. Method note — how we read their code

The preview host is `robots.txt`-disallowed, so WebFetch and the cloud container cannot
reach it. What works is the built-in browser: open the library page, then `fetch()`
same-origin from its JavaScript tool. The preview host serves `.js.map` files **with full
`sourcesContent`**, so the original, commented source of any block is recoverable:

```js
const m = await (await fetch('/dist/blocks/<name>/<name>.js.map')).json();
m.sourcesContent[0];   // original src/blocks/<name>/<name>.js
```

Keep the output small (slice it, or filter `m.sources` first) — a whole map is ~700 KB and
will blow the tool-result limit.

## 7. The pilot — `experiments/aem-blocks/` (2026-10-28)

Experiment 6 placed through the site's own `interactive-asset` block, with **no change to
the effect**. `context-core.js` is still loaded from `experiments/context-model/context-fx/`
— never copied — and the pilot is only the wrapper around it.

```
experiments/aem-blocks/
  index.html                                  the demo page: block + the authored rows
  eds-lite.js / .css                          stand-in for the EDS decoration step
  blocks/interactive-asset/
    interactive-asset.js                      THEIR block, ported line for line
    interactive-asset.css                     THEIR stylesheet, re-expanded
  assets/
    asset-registry.js                         THEIR registry
    context-model.js                          ours: the ContextModel asset class
```

What each piece proves:

- **`eds-lite.js`** turns `[data-block]` into the EDS shape (`<div class="<name>-wrapper">`
  around `<div class="<name>" data-block-name="<name>">`), loads the block's CSS and JS, and
  calls its decorator. Its `getOptionsFromBlock()` is a port of theirs, so the option parsing
  is the real one.
- **`blocks/interactive-asset/`** is their code. Two deviations, both commented in the file:
  the module form (a global registration instead of `export default`, because a module cannot
  be imported from `file://`), and **CHANGE #1** — one line that forwards every authored
  option to the asset. Theirs forwards only `modalHash` and `videoAnimation`, so an asset can
  be placed but not configured. That one line is the thing worth proposing upstream.
- **`assets/context-model.js`** is the deliverable shape: a class whose constructor is
  `({ target, props })`. It builds the stage, loads the scene in order, then pushes every
  authored key that exists in `window.CONTEXT.defaults` into the live settings, coerced to the
  type of that default. Unknown or unparseable keys are logged and ignored rather than
  silently dropped. **It is a plain class, not a Svelte component, and the block accepts it** —
  which is the hypothesis in §3.1, now tested at least against our port of their block.

### Instance scoping (2026-10-28, the change that followed the pilot)

The pilot's first version could only be placed once, because `context-core.js` looked its
three elements up by fixed id. That is fixed, and it is the change the block library page
depends on:

- `context-core.js` now exposes **`window.ContextModelScene.create({ canvas, sticky,
  scrollBox })`**, which returns the same control surface the tuner has always read
  (`cfg`, `defaults`, `apply`, `rebuild`, `info`, `readout`) plus `beams`, `scroll` and a
  real **`destroy()`** — it stops the loop, removes all five listeners, disposes the
  geometries, materials and renderer, and clears the canvas.
- **The old page is untouched.** When the three ids are present on load, the file boots
  itself and publishes `window.CONTEXT`, `CONTEXT_INFO`, `CONTEXT_BEAMS` and
  `CONTEXT_SCROLL` exactly as before, so experiment 6 and its tuner did not change.
- `context.css` carries both spellings: the ids for that page, the classes
  (`.context-scroll` / `.context-sticky` / `.context-stage`) for scenes built through
  `create()`.
- The body of the file was deliberately **not re-indented** into the new function. The
  shaders are template literals and the change stays reviewable as a dozen lines instead
  of a whole-file reflow.

One thing stays single: the tuner reads `window.CONTEXT`, and there is only one of those.
The first instance that asks for a tuner takes it; later ones render without one.

### Verification (cloud container, Playwright, served over http)

- block decorates: `data-block-status="loaded"`, wrapper present,
  `data-asset-name="ContextModel"`, registry reports `["ContextModel"]`;
- authored values reach the scene: `camAz` 34 against a default of 25, `bloomStrength` 0.72;
- scene runs: WebGL2, MSAA 4, 1440×804 buffer, ~57 fps under SwiftShader, renders correctly
  mid-scroll;
- rule 12: `document.querySelectorAll('input,select,textarea,form').length === 0`;
- tuner panel present and collapsed on load (`tu-panel tu-closed`);
- legacy boot: a page carrying the three ids still starts by itself and publishes
  `window.CONTEXT` + the three console helpers, with the tuner attached;
- two instances on one page: independent settings (`camAz` 34 and −12 at once), and
  `destroy()` on the second removes its canvas and leaves the first running, no errors;
- `scrollWidth === innerWidth` at six scroll depths, at 1440 px and at 390 px.

Still to check on the published URL, as every experiment must be: same-origin resources and
the mobile sweep with a `?nocache=` query string.

## 8. The AEM box, in every tuner (2026-10-28)

Igor's call: rather than a separate page to copy blocks from, the block **is the last
section of the experiment's own tuner panel**. `panel.aem(spec)` is part of the shared kit —
the API is documented in `claude_tunerui_context.md`.

Why there: the panel already holds every knob and knows which ones moved, so the table it
emits is the state you are looking at, not a snapshot someone has to keep in step. Tune on
the page, hit **Copy as table**, paste into the authoring document. The experiment stops
being a demo and becomes the authoring tool for its own block.

All six tuners now declare one, each with its own asset name (`ContextModel`, `DataCore`,
`Book3D`, `CelosphereSeal`, `GlobeEvents`, `SolutionsFX`) and all of them under
`block: 'Interactive Asset'` — the proposal of §3.1, applied across the board. Experiment 1
has no tuner; it maps to their own `M64 - Video Scroll` block rather than to an asset, and
is the one to express against their option names when we get to it.

`panel.aemSpec` gives the same rows to code, which is what the block library page will read
when we build it: one source of truth per experiment, declared beside the knobs.

Versions bumped with this change: `tuner-ui.js` 4, `context-core.js` 8, `context.css` 3,
`context-tuner.js` 6, `datacore-tuner.js` 29, `book-tuner.js` 7, `seal-tuner.js` 21,
`globe-events-tuner.js` 15, `solutions-tuner.js` 20.

### Verified and published (2026-10-28)

All six tuners driven in a browser. The five that are not Context Model were checked on a
harness page — the tuner plus `tuner-ui.js` plus a stub of the effect's global — because
their real pages carry the whole saved client copy. Each one: the panel mounts, **AEM block**
is the last section, "Copy as table" emits the title line with its variants and the declared
row, and 0 form elements with the panel open.

| harness | rows | emitted |
| --- | --- | --- |
| globe events | 52 | `Interactive Asset (full-width)` / `GlobeEvents` |
| datacore | 29 | `Interactive Asset (dark-base-theme, full-bleed)` / `DataCore` |
| 3d book | 29 | `Interactive Asset (dark-base-theme)` / `Book3D` |
| celosphere | 59 | `Interactive Asset (dark-base-theme)` / `CelosphereSeal` |
| solutions, home | 44 | `Interactive Asset (dark-base-theme)` / `SolutionsFX` |
| solutions, supply-chain | 53 | `Interactive Asset (dark-base-theme)` / `SolutionsFX` |

Two harness gaps that are worth knowing for the next one: `globe-events-tuner.js` reads
`G.events`, and `solutions-tuner.js` returns early unless `<html data-sfx-page>` is set. Both
are preconditions of the tuner, not of the AEM section.

`python3 experiments/defuse-inputs.py --report` clean over all 45 tracked HTML files.

**Merged into `main` and published.** Checked on the live URL with a `?nocache=` query
string (`experiments/3d-globe/index.html`): `tuner-ui.js?v=4` served, **AEM block** is the
last section, "Copy as table" emits `Interactive Asset (full-width)` / `GlobeEvents`, 0 form
elements and every resource same-origin.

The safety net stays: tag `before-aem` at `dfeb2a2`, branch `before-aem-main`.

### Still to do

- The 390 px sweep on the published pages, which this round did not re-run.
- Experiment 1 against their own `M64 - Video Scroll` option names.
- The block library page, reading `panel.aemSpec` from each experiment.
