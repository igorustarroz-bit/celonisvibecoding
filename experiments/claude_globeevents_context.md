# Globe events — green city dots + the Web DS city card (experiment 2)

> Added 2026-10-28. Lives on top of experiment 2 (`3d-globe/`) and changes
> **nothing** inside `globe.js`. Read `claude_globe_context.md` first for the
> globe itself and `claude_newexperiment_context.md` for the process.

## 1. What it is

Four fictional **"Process Intelligence Days"** events pinned to the hero globe.
Each one is a **very flat 3D cylinder** standing on the sphere, the cities are
laced together by **flight arcs**, and clicking a marker opens the Celonis Web DS
card `Card08-City-collab`, anchored next to it.

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

- `globe-events.js` — settings (`window.GLOBE_EVENTS`), projection, the canvas
  that draws the markers and the arcs, the hit areas and the card.
- `globe-events.css` — everything scoped under `.ge-*`: it only places the
  overlay canvas, the invisible hit areas and the card.
- `globe-events-tuner.js` — the panel, built on `lib/tuner-ui.js`.
- `badges/badge-<id>.svg` — the four city badges, exported from the Figma
  library **Web DS | Brand Assets** (components `Badges City <City>`), stored
  locally. Never load them from the client's domain.

`index.html` loads, in this order: `../lib/tuner-ui.css?v=1`,
`anime-globe/globe-events.css?v=1` next to `../lib/poppins.css`, and after
`scroll-fx.js`: `../lib/tuner-ui.js?v=1`, `globe-events.js?v=1`,
`globe-events-tuner.js?v=1`. **Bump every `?v=` on any change** — Pages caches
for ~10 minutes. `original.html` is untouched, as always.

## 3. Two layers, on purpose

**`.ge-canvas` — the visuals.** A second canvas inserted right after
`#earth-canvas`, inside `p.world`, `position: absolute; inset: 0`, with the
**same buffer size** as the globe's (`canvas.width`), so a point computed in the
globe's internal coordinates lands on the same pixel. It is `pointer-events:
none`, so the globe keeps its drag, its inertia and its "needle" focus, and it
deliberately carries **no CSS filter** — `#earth-canvas` has `blur(0.6px)` and
the markers have to stay sharp.
`p.world` is given `position: relative` if it is still static; in practice the
scroll transform already makes it a containing block.

**`.ge-layer` — the interaction.** A `position: fixed; inset: 0; z-index: 5`
layer appended to `<body>`, holding one invisible `.ge-hit` circle per marker
(sized from the cylinder's footprint, with a 24 px touch floor) and the card.

Why the card and the hit areas are not inside `p.world`:

- `p.world` carries the scroll transform from `scroll-fx.js`
  (`translate(0,-500px) scale(1)` → `scale(0.25)`). A child would be scaled with
  it, so the card would shrink while you read it.
- A fixed overlay sidesteps that, and the positions stay correct for free
  because they are computed from `canvas.getBoundingClientRect()`, which already
  includes that transform.
- `z-index: 5` on purpose: the saved header lifts itself to 9 from a child, so
  anything at 9 or above would cover the menu (see `claude_solutions_context.md`
  §22 and the repo-structure note).

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

Everything drawn on `.ge-canvas` stops at the internal coordinates, because that
canvas shares the globe's buffer. Only the **viewport** positions — the hit areas
and the card — go through the last line.

⚠️ There, the canvas buffer is **square** (`size = min(max(w,h)·dpr, 1702)`) and
is stretched to the element box, so x and y need **different** scale factors
(`rect.width/size` and `rect.height/size`). Using one factor puts the hit areas
off the markers on any non-square hero.

Visibility: a marker is hidden below `z = 0.02` (far side) and fades in over
`limbFadeZ`, multiplied by `state.alpha` so it respects the entrance animation.
If the open card's city rotates out of sight the card closes itself — in practice
it cannot happen while `pauseSpin` is on.

## 5. The marker — a flat cylinder, not a dot

Igor, 2026-10-28: the green dots had to become **flat 3D cylinder pieces**.

Drawn in three passes, all from the marker's rotated normal `v` (= its unit
position in view space):

1. **Glow** — a radial gradient under the marker, itself squashed by `v.z`.
2. **Ripple** — the old CSS halo, now an expanding ellipse *in the tangent
   plane*, so it foreshortens with the globe instead of staying a flat circle.
3. **The cylinder** — bottom centre at `v·R`, top centre at `v·(1+discHeight)·R`.

The geometry that matters: under an orthographic camera the circle of radius `r`
in the tangent plane projects to an **ellipse** whose minor axis is `r·v.z`,
along the screen direction of the normal (`atan2(-v.y, v.x)`), and whose major
axis is `r`. The **silhouette of the cylinder is the convex hull of the bottom
and top ellipses** — the union of a convex shape and a copy of it offset by the
extrusion vector *is* their convex hull, so a 20-line monotone chain over 56
sampled points gives the exact outline. Then: fill the hull with the darkened
wall colour, fill the top ellipse over it, stroke the rim.

The top face carries a linear gradient along **`globe.js`' own light direction**
(`[-0.30, 0.62, 0.72]`, normalised, projected to screen). Without it the marker
reads as a flat circle whenever you look straight down on it — which is exactly
what the physics says, since the wall only becomes visible towards the limb.
`discShade` is that knob.

## 6. The flight arcs

Great circles between the cities — every pair (6 arcs) or a single chain
(`arcAll`). For each one: `slerp` between the two unit vectors, lifted by
`1 + arcAltitude·(ω/π)·sin(π·t)` so longer hops fly higher, sampled
`arcSamples` times, rotated by the same matrix and projected.

**Occlusion is exact for an orthographic camera**: a point above the sphere is
hidden only when `z < 0` **and** `x² + y² < 1` — behind the centre plane *and*
inside the silhouette. Testing `z < 0` alone would chop the arcs where they fly
past the limb. The polyline is stroked as visible runs with one gradient per arc
(`arcColor` → `arcColor2` → `arcColor`), and a comet (a short brightening tail
plus a head) travels along each arc, staggered by arc index.

## 7. Interaction (Igor's choices, 2026-10-28)

- **Click**, not hover: hover gave false positives while dragging the globe and
  has no meaning on a phone. A pointer move of more than 5 px between
  `pointerdown` and `click` is treated as a drag and does not open the card.
- The card **follows the marker** rather than sitting in a fixed corner.
- Opening a card **pauses the auto-spin** (`__earth.spinAnim.pause()`) and
  closing resumes it. Knob: `pauseSpin`.
- Closes on Esc, on a click anywhere outside, and when the hero leaves the
  viewport (`IntersectionObserver`).
- Keyboard: each hit area is `role="button" tabindex="0"`, Enter/Space toggles.
- The hit area is a separate invisible `.ge-hit` circle, `2.2 ×` the cylinder's
  screen radius with a **24 px floor** — the marker itself is painted on the
  canvas and a small puck is not a touch target.
- Hovering or opening grows the marker by `hoverGrow`; markers on the far side
  are not drawn, and the open card closes itself if its city rotates away (it
  cannot happen while `pauseSpin` is on).

## 8. The card (Figma → CSS)

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

## 9. The tuner panel

`window.GLOBE_EVENTS` is the live settings object; `globe-events-tuner.js`
builds the panel on `lib/tuner-ui.js` (id `ge-tuner`, accent `#5cfe50`, hotkey
`T`), visible on load and collapsed, like every other experiment.

Knobs, in five sections: **Marker** (`discRadiusDeg`, `discHeight`, `discWall`,
`discEdge`, `discShade`, `discGlow`, `hoverGrow`, `limbFadeZ`), **Ripple**
(`pulse`, `pulseMs`, `rippleScale`), **Flight arcs** (`arcs`, `arcAll`,
`arcAltitude`, `arcWidthRatio`, `arcOpacity`, `arcSamples`), **Flights**
(`flights`, `flightMs`, `flightTrail`, `flightSize`) and **Card**
(`cardOffsetPx`, `cardBorder`, `pauseSpin`). Plus one action button per city
(opens that card) and "Close card".

This is the **first** panel experiment 2 has ever had. It only reaches the
markers: `globe.js` still keeps its `CFG` private and exposes no global for it,
so "a tuner for the globe itself" is still open work (see
`claude_tunerui_context.md`).

## 10. Verification done before the push

- `python3 experiments/defuse-inputs.py --report` → clean over all 44 tracked
  HTML files.
- Playwright at 1440×900 (cloud container, local `http.server`): the overlay
  canvas shares the globe's box and buffer to the pixel and is actually painted
  (~30 k non-transparent pixels), 4 hit areas built,
  `input,select,textarea,form` count 0 with the panel mounted, card opens with
  the right city/date/badge, `state.spin` frozen while open and moving again
  after Esc, no page errors.
- Playwright at 390×844 with `isMobile`: `scrollWidth === innerWidth` at scroll
  0/300/700/1200/2000 (the `page-shell` rule), the card flips to the left of the
  dot and stays inside the viewport, 0 form elements.
- The only 404s are the client images and fonts that were deliberately not
  staged for the test.

## 11. Ideas not done

- A leader line from the marker to the card.
- Auto-rotating the globe to bring a city to the front when its card is opened
  from the tuner (today the card just does not show if the city is on the far
  side).
- Pulling the real event list and dates from the client's events page — out of
  scope on a replica that must make no request to the client's domain.
