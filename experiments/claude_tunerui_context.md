# `lib/tuner-ui.js` — the shared tuner panel

Every experiment ships a tuner panel. Igor's standing rule: **the finished version of an
experiment always carries its handles, and always says what the antialiasing is really
doing.** Before 2026-09-13 each experiment had grown its own copy of the same panel; this is
the one implementation all of them use now.

Files: `experiments/lib/tuner-ui.js` (`?v=2` since the chip repaint fix,
2026-10-28) and `experiments/lib/tuner-ui.css` (`?v=1`).
Read `claude_antiphishing_context.md` §8 first if you are touching anything about *why* the
controls are built the way they are.

## The one hard constraint

A page that replicates the client's site must contain no `<input>`, `<select>`, `<textarea>`
or `<form>` — anti-phishing rule 12. That is a rule about **tags**, not about controls. Every
control in this kit is built from `<div>`s:

| what it replaces            | what the kit builds                                          |
|-----------------------------|--------------------------------------------------------------|
| `<input type="range">`      | `.tu-track` + `.tu-fill` + `.tu-thumb`, `role="slider"`, pointer drag, arrow keys, Home/End, Shift for ×10 |
| `<select>`                  | `.tu-chips` — one `.tu-chip` per value                        |
| `<input type="color">`      | `.tu-swatch` that opens three R/G/B channel sliders            |
| `<textarea>` (settings dump)| `<pre class="tu-dump">`, selected programmatically so `execCommand('copy')` still works |

So the panels are built **on load** again, collapsed, and `document.querySelectorAll(
'input,select,textarea,form').length` is still 0. `mount()` warns to the console if that ever
stops being true; `TunerUI.audit()` returns the count for the whole document.

`touch-action: none` on the track matters: without it a drag on a phone scrolls the page, and
most of these experiments are scroll-driven.

## The two behaviours Igor asked for on every panel (2026-09-13)

1. **Double-click a row to reset that one knob** to the value it started at. The value cell
   turns amber (`--tu-amber`, `#f2b266`) with a `↺` while it differs from the default, and the
   slider's fill and thumb turn amber with it, so one look at a long panel says what was
   touched. "Reset" still puts everything back at once.
2. **The variable is printed under the label** (`.tu-key`, monospace, dimmed). A value read on
   screen can be found by name in the code or in a copied settings JSON without guessing which
   knob "frame 2 scale" was.

## API

```js
var p = TunerUI.create({
  id: 'dc-tuner',            // element id
  title: 'GLASS TUNER',
  accent: '#5cfe50',         // sets --tu-accent on the panel
  target: window.DATACORE,   // the LIVE settings object the render loop reads
  defaults: SOMETHING,       // optional; otherwise target is deep-cloned at create()
  onChange: function (path, value, tag) { … },   // tag = the knob's `extra`
  onReset: function () { … }                     // after the Reset button
});

p.section('Transparency');
p.slider('refraction', 'refract', 0, 3, 0.01);        // dotted paths are fine
p.choice('MSAA samples', 'quality.msaa', [0, 2, 4, 8]);
p.colour('sky top', 'skyTop');                        // #rrggbb in the settings object
p.button('Open / close book', fn, true);              // an action, not a knob
p.live('sequence T', 'SEAL_SCROLL(t)', 0, 1, 0.001, read, write);   // see below
p.readout(function () { return '…'; });               // refreshed every 500 ms
p.actions();                                          // Copy settings + Reset
p.hint();                                             // the standard one-line explainer
p.mount();
TunerUI.hotkey(p, 't');
```

`slider`'s last argument is either the `extra` tag or an options object:

```js
p.slider('book opening', 'presentV', 60, 180, 1, {
  fmt:   deg,                                   // how to print the shown number
  read:  function (v) { return 180 - 2 * v; },  // stored  -> shown
  write: function (o) { return (180 - o) / 2; } // shown   -> stored
});
```

`read`/`write` exist for the knobs where what a designer thinks in is not what the scene
stores — the book's opening angle is one number on screen and half of its complement in the
scene graph. `min`/`max`/`step` are in **shown** units.

`live()` is for a control that is not a setting: the celosphere scrub drives the real page
scroll, so it has no default, no double-click reset, never goes amber, and follows the scene
on a 150 ms timer while nobody is dragging it.

## Who uses it

| experiment | panel file | global | id | accent |
|---|---|---|---|---|
| 2 globe events | `3d-globe/anime-globe/globe-events-tuner.js` | `window.GLOBE_EVENTS` | `ge-tuner` | `#5cfe50` |
| 3 Data Core | `datacore/anime-datacore/datacore-tuner.js` | `window.DATACORE` | `dc-tuner` | `#5cfe50` |
| 4 3D book | `3d-book/book-fx/book-tuner.js` | `window.BOOK` | `bk-tuner` | `#5cfe50` |
| 5 celosphere | `celosphere/celosphere-fx/seal-tuner.js` | `window.SEAL` | `sl-tuner` | `#5cfe50` |
| 6 Context Model | `context-model/context-fx/context-tuner.js` | `window.CONTEXT` | `context-tuner` | `#7fd7c4` |

Experiment 2 got a panel on 2026-10-28, but only for the **event markers** it gained that
day (`window.GLOBE_EVENTS`). `globe.js` itself still keeps its `CFG` private and exposes no
global for it. Giving the globe one means exposing `CFG` and deciding which changes need a
geometry rebuild — open work, not a port.

Load order on a page: `tuner-ui.css` with the other shared stylesheets, then
`lib/tuner-ui.js` **before** the experiment's own tuner file. Each tuner also polls for its
global with a `setTimeout`, so it survives the effect starting late.

## The repaint bug (2026-10-28) — read this before adding a control

`Panel._commit()` writes the value, the read-out and the amber mark. It does
**not** repaint the control. Every control had been getting away with it for a
different reason: a slider repaints itself from inside its own drag, and
`colour()` calls `entry.paint()` explicitly in its write callback. **`choice()`
had neither**, so clicking a chip moved the value and the number on the right
while the highlight stayed on the old chip — in every experiment, since the
kit landed. Igor spotted it as "the selected state of the toggles is wrong".

`choice()` now calls `entry.paint()` after `_commit`. **A new control must
repaint itself after committing**, or do it from `_commit` — which was left
alone on purpose, because calling a slider's `paint()` mid-drag would fight the
drag.

Verification that catches it: click *every* chip of *every* row and assert the
highlight lands on the one you clicked and that exactly one is lit.

## Gotchas that cost time

- **The saved client pages style almost every tag.** Everything is scoped under `.tu-panel`,
  and the properties that bite are reset there: `button` gets `width: 100%; height: 48px` from
  the site's CSS, `<header>` gets 88 px (so the panel header is a `<div>`, never a `<header>`),
  and `box-sizing` is re-declared.
- **No `backdrop-filter`.** With a border plus a radius Chrome draws the corners wrong. This
  was already learnt on the book and Data Core panels in September.
- **The panel is `position: fixed; bottom`**, so it grows upwards as it opens — no
  `column-reverse` needed, unlike the older hand-rolled panels.
- **Re-typing a knob list is where the bugs are.** `check-paths.js`-style verification pays
  for itself: pull the settings literal out of the effect source with a brace scan, `eval` it,
  and assert every path a tuner writes to exists. On 2026-09-13 that checked 116 paths across
  the three ported panels.

## Verifying a change to this file

1. `node --check` on the kit and on every tuner that uses it.
2. Every knob path resolves (see above). A knob whose path is wrong shows `undefined` in the
   page and silently writes a property nobody reads.
3. In a browser, with the panel **open**: 0 form elements in the document, before and after
   clicking "Copy settings"; a drag turns the value amber; a double-click puts it back.
4. Bump `?v=` on `tuner-ui.js`/`tuner-ui.css` and on every tuner that changed — Pages caches
   for about 10 minutes.

## `panel.aem(spec)` — the AEM block section (2026-10-28)

The **last section of every panel**, Igor's call. The client's site runs on AEM Edge
Delivery, where a module is authored as a table of *label / value* rows and the block reads
its settings from that table and nothing else (`claude_aem_context.md`). The panel already
knows every knob and which ones were moved, so it is the natural place to hand that table
over — and it keeps one source of truth per experiment instead of a copy in a page and
another in a library.

```js
p.actions();
p.aem({
  block: 'Interactive Asset',            // the block's name in their library
  variants: ['dark-base-theme', 'full-bleed'],  // classes, written in parentheses
  rows: [['name', 'ContextModel']],      // the rows the block always carries
  include: 'changed'                     // default; 'declared' emits only `rows`
});
p.hint();
p.mount();
```

What it renders: the section header, a hint, two buttons and the same selected
`<pre class="tu-dump">` the Copy settings button uses. Built from `<div>`s and a `<pre>`,
so rule 12 still holds — `mount()`'s own assertion covers it.

The two copies exist because the two readers are different people:

- **Copy as table** — tab separated, first line the block title with its variants in
  parentheses. Pasted into the authoring document it lands as a real table, which is how an
  author writes a block.
- **Copy as HTML** — the decorated shape EDS produces
  (`<div class="interactive-asset …" data-block-name="interactive-asset">` with one
  `<div><div>key</div><div>value</div></div>` per row), for whoever wires it up.

Rows are the declared ones **plus every knob that differs from its default** (that is what
`include: 'changed'` means, and it is the default). A moved knob replaces a declared row of
the same name, so a seed value in `rows` is overwritten by what you actually tuned. That is
the point: tune on the page, copy, paste into the document. Values are written the shortest
way that parses back to the same number — `0.72`, not `fmt()`'s padded `0.720` — and
booleans come out as `on` / `off`.

`panel.aemSpec` exposes the same thing to code (`rows()`, `table()`, `html()`, plus `block`
and `variants`), so the block library page can read every experiment's block without
opening a panel.

### Who declares what

| Experiment | Tuner | Asset name |
| --- | --- | --- |
| 2 — globe event markers | `globe-events-tuner.js` | `GlobeEvents` |
| 3 — Data Core | `datacore-tuner.js` | `DataCore` |
| 4 — 3D book | `book-tuner.js` | `Book3D` |
| 5 — Celosphere seal | `seal-tuner.js` | `CelosphereSeal` |
| 6 — Context Model | `context-tuner.js` | `ContextModel` |
| 7 — Solutions | `solutions-tuner.js` | `SolutionsFX` |

All six declare `block: 'Interactive Asset'`, because that is the proposal we are making:
our scenes registered by name in their asset registry. The module-level mapping (which of
their M-numbered blocks each experiment belongs to) is a different question and lives in the
overlap table in `claude_aem_context.md` §3.3. Experiment 1 has no tuner and no entry here —
it maps to their own `M64 - Video Scroll` block rather than to an asset.
