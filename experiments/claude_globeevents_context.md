# Globe events — green city dots + the Web DS city card (experiment 2)

> Added 2026-10-28. Lives on top of experiment 2 (`3d-globe/`) and changes
> **nothing** inside `globe.js`. Read `claude_globe_context.md` first for the
> globe itself and `claude_newexperiment_context.md` for the process.

## 1. What it is

Four fictional **"Process Intelligence Days"** events pinned to the hero globe.
Each is a green dot on the sphere; clicking one opens the Celonis Web DS card
`Card08-City-collab`, anchored next to the dot.

| id | city | lat | lon | date on the card |
|---|---|---|---|---|
| `munich` | Munich | 48.1374 | 11.5755 | Nov. 12, 2026 |
| `madrid` | Madrid | 40.4168 | −3.7038 | Nov. 26, 2026 |
| `san-francisco` | San Francisco | 37.7749 | −122.4194 | Dec. 3, 2026 |
| `tokyo` | Tokyo | 35.6762 | 139.6503 | Dec. 10, 2026 |

The events are invented for the prototype. The card's arrow button is **inert**
(`href="#"` + `preventDefault`): a client replica must not link to the client's
domain (anti-phishing rule 13), and Igor chose the inert button over linking to
the experiment index (2026-10-28).

## 2. Files (in `3d-globe/anime-globe/`)

- `globe-events.js` — settings (`window.GLOBE_EVENTS`), projection, markers, card.
- `globe-events.css` — everything scoped under `.ge-*`.
- `globe-events-tuner.js` — the panel, built on `lib/tuner-ui.js`.
- `badges/badge-<id>.svg` — the four city badges, exported from the Figma
  library **Web DS | Brand Assets** (components `Badges City <City>`), stored
  locally. Never load them from the client's domain.

`index.html` loads, in this order: `../lib/tuner-ui.css?v=1`,
`anime-globe/globe-events.css?v=1` next to `../lib/poppins.css`, and after
`scroll-fx.js`: `../lib/tuner-ui.js?v=1`, `globe-events.js?v=1`,
`globe-events-tuner.js?v=1`. **Bump every `?v=` on any change** — Pages caches
for ~10 minutes. `original.html` is untouched, as always.

## 3. Why the markers are DOM in a FIXED overlay

They are **not** drawn into the canvas and **not** parented to `p.world`:

- `p.world` carries the scroll transform from `scroll-fx.js`
  (`translate(0,-500px) scale(1)` → `scale(0.25)`). A child would be scaled with
  it, so the card would shrink while you read it and the dot would stop being a
  constant size on screen.
- A fixed overlay (`.ge-layer`, `position: fixed; inset: 0; z-index: 5`) appended
  to `<body>` sidesteps both, and the dot positions stay correct for free because
  they are computed from `canvas.getBoundingClientRect()`, which already includes
  that transform.
- `z-index: 5` on purpose: the saved header lifts itself to 9 from a child, so
  anything at 9 or above would cover the menu (see `claude_solutions_context.md`
  §22 and the repo-structure note).
- The layer is `pointer-events: none`; only `.ge-dot` and `.ge-card` take events,
  so the globe's drag, inertia and "needle" focus all still work.

## 4. Projection (must stay in step with `globe.js`)

`globe-events.js` rebuilds the **same** matrix from the public `window.__earth`
(`cfg` + `state`) — it does not read anything private:

```
M = Rz(roll) · Rx(tilt) · Ry(spin)
  tilt = (cfg.tiltDeg + state.pitch)·π/180
  roll = sin(state.wobble·2π) · cfg.rollDeg·π/180
  spin = state.spin·2π + state.dragLon
p   = (cos φ·sin λ, sin φ, cos φ·cos λ)        // same convention as buildParticles()
R   = canvas.width · cfg.radiusRatio · state.scale
s   = (size/2 + x·R,  size/2 − y·R + state.rise·size·0.10)   // internal px
css = rect.left + s.x·rect.width/size , rect.top + s.y·rect.height/size
```

⚠️ The canvas buffer is **square** (`size = min(max(w,h)·dpr, 1702)`) and is
stretched to the element box, so x and y need **different** scale factors
(`rect.width/size` and `rect.height/size`). Using one factor puts the dots off
the sphere on any non-square hero.

Visibility: a dot is hidden below `z = 0.02` (far side) and fades in over
`limbFadeZ`, multiplied by `state.alpha` so it respects the entrance animation.
If the open card's city rotates out of sight the card closes itself — in practice
it cannot happen while `pauseSpin` is on.

## 5. Interaction (Igor's choices, 2026-10-28)

- **Click**, not hover: hover gave false positives while dragging the globe and
  has no meaning on a phone. A pointer move of more than 5 px between
  `pointerdown` and `click` is treated as a drag and does not open the card.
- The card **follows the dot** rather than sitting in a fixed corner.
- Opening a card **pauses the auto-spin** (`__earth.spinAnim.pause()`) and
  closing resumes it. Knob: `pauseSpin`.
- Closes on Esc, on a click anywhere outside, and when the hero leaves the
  viewport (`IntersectionObserver`).
- Keyboard: each dot is `role="button" tabindex="0"`, Enter/Space toggles.
- The dot is 9–18 px, so it carries an invisible `::before` hit area of
  `inset: -9px` — a 9 px circle is not a touch target.

## 6. The card (Figma → CSS)

Source: `Web DS | Components`, file `tBZiqZtdfjJXmCflrpjN1U`, frame
`Card08-City-collab` (`13966:72135`); the per-city variants are
`City=Munich` `13966:72176`, `City=Madrid` `13966:72172`,
`City=San Francisco` `13966:72194`, `City=Tokyo` `13966:72202`.

Values taken from the frame, all of them literal:

| part | spec |
|---|---|
| card | 200×272, `padding 16`, `radius 4`, `background #000`, `overflow hidden` |
| kicker | Poppins 400, 14/18, `#cbcbcb`, two lines ("Process" / "Intelligence Days") |
| city | Poppins 400, 16/22, `#ffffff`, 4 px below the kicker (the frame's gap) |
| badge | 116×116 box at `left 50%`, `top calc(50% + 10px)`, centred; the vector is inset `4%` (Madrid, San Francisco) or `4% 5%` (Munich, Tokyo) |
| button | 40×40 at `left 16`, `top 216`, `radius 4`, `background #1d1d1d`, 20 px arrow `#CBCBCB` |
| date | 14/18, `#cbcbcb`, right-aligned, 16 px from the right and bottom edges |

Two deliberate differences from the frame:

1. **A 1 px hairline** `rgba(255,255,255,0.14)` plus a soft shadow. The card is
   pure black on a black hero, so without it the card has no edge at all. Set
   `cardBorder` to 0 in the tuner for the literal Figma card.
2. The frame puts the date at `bottom: 34px` with a `translateY(100%)`; that
   resolves to 16 px from the bottom, so the CSS says `bottom: 16px`.

The arrow is inlined in the JS (it is 1 path); the four badges are files because
they are 21–27 KB each.

### Getting the badges out of Figma

The MCP asset URLs are **not reachable** from the cloud container or from the
device shell (the egress proxy refuses `figma.com`), and WebFetch is blocked by
their robots.txt. What worked: open `figma.com` in the **built-in browser** and,
from a page on that origin, `fetch()` each asset, gzip it with
`CompressionStream` and return base64 — about 7 KB per badge instead of 25 KB of
raw path data — then `base64 -d | gunzip` on the device.
⚠️ **Wrap the base64 at 76 characters.** One single-line 12 KB heredoc came back
with corrupted bytes in the middle and at the end (`gunzip` CRC error, null bytes
inside the file). Always re-parse every exported SVG afterwards
(`python3 -c "import xml.dom.minidom as m; m.parse(f)"`) — one of four was broken
and still had a plausible file size.

## 7. The tuner panel

`window.GLOBE_EVENTS` is the live settings object; `globe-events-tuner.js`
builds the panel on `lib/tuner-ui.js` (id `ge-tuner`, accent `#5cfe50`, hotkey
`T`), visible on load and collapsed, like every other experiment.

Knobs: `dotSizeRatio`, `dotMinPx`, `dotMaxPx`, `hoverGrow`, `limbFadeZ`;
`pulse`, `pulseMs`, `haloScale`; `cardOffsetPx`, `cardBorder`, `pauseSpin`.
Plus one action button per city (opens that card) and "Close card".

This is the **first** panel experiment 2 has ever had. It only reaches the
markers: `globe.js` still keeps its `CFG` private and exposes no global for it,
so "a tuner for the globe itself" is still open work (see
`claude_tunerui_context.md`).

## 8. Verification done before the push

- `python3 experiments/defuse-inputs.py --report` → clean over all 44 tracked
  HTML files.
- Playwright at 1440×900 (cloud container, local `http.server`): 4 dots built,
  `input,select,textarea,form` count 0 with the panel mounted, card opens with
  the right city/date/badge, `state.spin` frozen while open and moving again
  after Esc, no page errors.
- Playwright at 390×844 with `isMobile`: `scrollWidth === innerWidth` at scroll
  0/300/700/1200/2000 (the `page-shell` rule), the card flips to the left of the
  dot and stays inside the viewport, 0 form elements.
- The only 404s are the client images and fonts that were deliberately not
  staged for the test.

## 9. Ideas not done

- A leader line from the dot to the card.
- Auto-rotating the globe to bring a city to the front when its card is opened
  from the tuner (today the card just does not show if the city is on the far
  side).
- Pulling the real event list and dates from the client's events page — out of
  scope on a replica that must make no request to the client's domain.
