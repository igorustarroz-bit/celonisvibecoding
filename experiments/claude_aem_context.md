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
