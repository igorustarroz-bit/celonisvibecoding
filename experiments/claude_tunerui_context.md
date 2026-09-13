# `lib/tuner-ui.js` — the shared tuner panel

Every experiment ships a tuner panel. Igor's standing rule: **the finished version of an
experiment always carries its handles, and always says what the antialiasing is really
doing.** Before 2026-09-13 each experiment had grown its own copy of the same panel; this is
the one implementation all of them use now.

Files: `experiments/lib/tuner-ui.js` and `experiments/lib/tuner-ui.css` (`?v=1`).
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
| 3 Data Core | `datacore/anime-datacore/datacore-tuner.js` | `window.DATACORE` | `dc-tuner` | `#5cfe50` |
| 4 3D book | `3d-book/book-fx/book-tuner.js` | `window.BOOK` | `bk-tuner` | `#5cfe50` |
| 5 celosphere | `celosphere/celosphere-fx/seal-tuner.js` | `window.SEAL` | `sl-tuner` | `#5cfe50` |
| 6 Context Model | `context-model/context-fx/context-tuner.js` | `window.CONTEXT` | `context-tuner` | `#7fd7c4` |

Experiment 2 (`3d-globe/`) has **no tuner at all** and never did: `globe.js` keeps its `CFG`
private and exposes no global. Giving it one means exposing `CFG` and deciding which changes
need a geometry rebuild — open work, not a port.

Load order on a page: `tuner-ui.css` with the other shared stylesheets, then
`lib/tuner-ui.js` **before** the experiment's own tuner file. Each tuner also polls for its
global with a `setTimeout`, so it survives the effect starting late.

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
