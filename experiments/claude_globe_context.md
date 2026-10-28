# Celonis hero globe — full specification

> **New experiment?** The complete process (save the page from the browser →
> anti-phishing cleanup → nav-fx → index → publish) is in
> `claude_newexperiment_context.md`.

> **Event markers (2026-10-28):** the green city dots and the Web DS city card
> added on top of this globe are documented in
> `claude_globeevents_context.md`. They do not change `globe.js`.

> This document lives in `experiments/` alongside the other `claude_*_context.md`
> files (all uploaded there on 2026-09-03). **The paths in this doc are relative to
> `experiments/`.**
> This experiment's folder used to be called `celonis-home/`;
> since 2026-09-03 it is `3d-globe/`.

Context for Claude (or any dev) who needs to maintain this globe or
**rebuild it in another technology** (Three.js, WebGL, shaders, SVG…). Everything
visual is described with exact formulas and final values approved by
Igor; the current implementation (Canvas 2D + anime.js v4) is only one of the
possible ones.

## What it is

Interactive replica of the black-and-white 3D world in the celonis.com hero
(originally the video `https://www.celonis.com/src/assets/videos/commercial-earth-hero.mp4`,
1702×1702 @60fps, 13.9s — a copy is kept in `3d-globe/original/`).
It replaces the `<video>` with a `<canvas id="earth-canvas">` inside `<p class="world">`.

## Files (in `3d-globe/anime-globe/`)

- `globe.js` — renderer + interactions. No dependencies other than anime.js and landmask.
- `landmask.js` — ACTIVE continent mask (base64 bitfield, see below).
- `anime.umd.min.js` — anime.js v4.5.0 UMD; exposes `window.anime` ({animate, ...}).
- `scroll-fx.js` — scroll reaction (replica of the site's original home-hero.js).
- `site-fx.js` — restored site interactions: sprite/logo, cyclic char-by-char headline, rotating green square, Solutions tabs+accordion, stories carousel, grid reveal. (Replaces the old static-fixes.js.)
- `tools/mask-tools.py` — export/filter/tojs to edit the mask as a PNG.
- `tools/landmask-actual.png` — full corrected world map (white = land).
- `tools/landmask-propuesta.png` — the applied mask (without the Arctic islands).

## 1. Point grid (CLOSED DECISION — do not change without consulting Igor)

Rows of constant latitude, like the original video:

```
latStep = latStepDeg = 1.44°       // rows
lonStep = lonStepDeg = 1.08°       // arc between marks within the row
for lat = -90+latStep/2 … 90, in steps of latStep:
  n = max(1, round(360/lonStep · cos(lat)))   // uniform arc spacing
  for k = 0 … n-1:  lon = -180 + (k+0.5)·360/n
```

Values MEASURED on the original video (2026-08-31, frames t=2s and t=6s,
autocorrelation of the central bands; video disc R≈850px out of 1702):
rows every 21.1–21.7px → 1.42–1.46°; in-row step 16px → 1.08°. The grid
is anisotropic (denser along the row than between rows, ratio 3:4).
We previously used 0.8° on both axes (~58k marks); now ~26k marks.
Reference frames in `tools/ref-frames/`.

NO random per-row offset: columns end up almost aligned between neighbouring
rows and that produces the moiré characteristic of the original. Convergence at
the poles is ASSUMED (that is how the original video looks).

Alternatives TESTED AND REJECTED by Igor (do not retry):
- Fibonacci spiral (uniform): leaves a swirl of spiral arms at the poles.
- Fibonacci + random jitter: no artifacts but loses the moiré ("less pleasing").
- Fixed columns per row (same n on all of them): a bullseye of solid rings at the pole.

## 2. Continent mask

Equirectangular (plate carrée) 1440×720 (0.25°/cell), 1 bit per cell,
row 0 = lat +90, column 0 = lon −180. In `landmask.js` as
`LANDMASK = {W, H, data}` with `data` = base64 bitfield (bit i = cell
`y·W + x`, LSB first within each byte).

Source: `world-atlas` (npm) `land-50m.json` + our own scanline rasterization.
⚠️ KNOWN PITFALL: rings that cross the antimeridian (±180°) break the naive
even-odd fill and fill WHOLE ROWS in the Arctic ("phantom land"). Fix: unwrap
each ring's longitudes into a continuous domain and fill with per-ring XOR
(holes cancel themselves out).

Editing the visible land (Igor's request): the small northern islands are
treated as water; only Greenland survives in the Arctic. Applied filter:
connected components (with longitude wrap) whose centroid is above
58°N and whose REAL area (cells weighted by cos φ) is < 600,000 km² → water.

Manual editing flow: `tools/landmask-*.png` (white = land) is edited in
any editor and converted with
`python3 tools/mask-tools.py tojs editado.png landmask.js`.

## 3. Marks ("dashes")

- Shape: straight stroke with rounded caps; width = 0.0015 × canvas side.
- Orientation: the sphere's north tangent rotated 40° eastward on the
  surface (`dashAngleDeg`) → they read as "/" slashes. 3D direction:
  `d = cos(40°)·t_norte + sin(40°)·t_este`, with
  `t_norte = (−sinφ·sinλ, cosφ, −sinφ·cosλ)`, `t_este = (cosλ, 0, −sinλ)`.
- Length: max 0.85° of arc (`dashLenDeg`), scaled by brightness:
  `lf = 0.22 + 0.78·min(1, brillo·1.6)` (`dotFloor` 0.22) → faint water is
  almost a dot, coastlines the full slash. The stroke endpoints are
  computed in 3D (p ± d·length/2) and then projected, so the foreshortening is correct.

## 4. Projection and rotation

Orthographic. Radius = 0.4775 × canvas side (`radiusRatio`). Internal square
canvas of up to 1702px (capped for performance), dpr max 2.
Per-frame matrix: `M = Rz(roll) · Rx(tilt) · Ry(spin)` with
- tilt = 21° (+ the user's pitch from vertical dragging, limits −25°…+40°)
- roll = sin(wobble·2π) · 7°, wobble cycles in 26 s
- spin = progress·2π (full turn in 21.6 s, linear, looping) + the user's dragLon
Culling: points with z_view < 0.015 are discarded. Screen:
`sx = cx + x·R`, `sy = cy − y·R` (+ entrance offset).

## 5. Lighting (white on black; LIGHT LAND / DARK SEA — Igor's decision,
   the inverse of the original video)

Base brightness per mark (fixed seed mulberry32(1337) for reproducibility):
- Land: `0.55 · (0.45 + 1.2·v²)` with v = rand() → strong variance. (landBase
  0.30→0.55 on 2026-08-31, chosen by Igor after trying 0.36/0.42/0.55.)
  - Coastal band (land cells within ≤5 cells of water, Chebyshev distance
    on the mask): `+ 0.85 · (1 − (d−1)/5)² · (0.6 + 0.5·rand())`.
  - Mottling: `× (0.9 + 0.2·blotch(lon,lat))` with blotch = cheap sinusoidal noise.
- Water: `0.09 · (0.6 + 0.8·rand())` → almost invisible dots.

Per frame, each mark's alpha:
`alpha = base · (0.52 + 0.48·max(0,dot(n,L))^1.25) + (1−z)² · 0.42 · (0.5+base)`
with light `L = normalize(−0.30, 0.62, 0.72)` (diffuse + fresnel-style limb highlight).
Bucketed rendering: 14 alpha levels, one Path2D per level and frame.

## 6. Blur / bloom

- CSS `filter: blur(0.6px)` on the canvas (general soft focus).
- VECTOR bloom: buckets with brightness > 0.5 are re-stroked with width ×3.4 and
  alpha `0.55·0.16·nivel` in `lighter` mode → a halo around bright areas.
⚠️ DO NOT use a per-canvas gaussian blur (drawImage + filter): >100 ms/frame without
a GPU. The vector one costs ~1 ms and looks nearly identical.

## 7. Drag interaction (mouse + touch)

Pointer Events on the canvas, `touch-action: pan-y` (a vertical touch swipe
still scrolls the page).
- Horizontal: `dragLon += dx / R_css` (1:1 with the surface at the equator).
- Vertical: `pitch += (dy/R_css)·(180/π)·0.85`, limits −25°…+40° (it stays where you leave it).
- Grabbing pauses the auto-spin; on release, INERTIA: velocity estimated
  over a window of positions of ~160 ms (robust against slow frames; if you
  stop before releasing → velocity 0, no inertia). If |v| > 0.00008 rad/ms:
  animate v→0 with ease out(2), duration = clamp(|v|·900000, 350, 3200) ms,
  integrating `dragLon += v·dt` per frame. When it finishes, the auto-spin resumes.

## 8. 3D "needle" focus (desktop: hover · mobile: on touch)

The pointer is projected onto the sphere in view space
(`u=(x,y) → z=√(1−|u|²)`; if |u|>0.9995 it is clamped to the limb; if |u|>1.2 it turns off).
Every mark is affected by its geodesic distance to the cursor point:
`c = dot(p_vista, cursor)`; inside the cap (`c > cos(23°)`):
- `f = (c − cosA)/(1 − cosA)` ∈ [0,1] (1 at the centre).
- LIGHT: `alpha += 0.3 · smoothstep(f) · (tierra ? 1 : 0.1)` — gradient 100%→0.
- "Needle" ELEVATION: `mag = 0.045 · f^400` (an extremely sharp peak only at the centre);
  the point is raised along the normal `p → p·(1+mag)` and the mark grows ×(1+mag·1.5).
- Everything scales with `spot.on`, which fades over 250 ms as the pointer enters/leaves →
  when it is withdrawn the grid returns EXACTLY to its place.

Activation depends on the pointer (same formula and same intensity in both):
- Mouse (`pointerType === 'mouse'`, only if `FINE_POINTER`): hover — it follows the
  cursor on `pointermove` and turns off on `pointerleave`.
- Touch / stylus (any `pointerType` other than mouse, without depending on
  FINE_POINTER, so it also works on laptops with a touch screen):
  it turns on at `pointerdown` WHERE you touch, follows the finger while it is
  dragged (sharing the gesture with the globe's rotation) and when the finger is
  lifted it stays for `spotTouchHoldMs` (900 ms) before the fade, so that a quick tap
  is actually visible. `pointercancel` (e.g. when the browser takes over the
  gesture to scroll) also turns it off.
- Shared helpers `moveSpot(e)` and `fadeSpot(to, delayMs)`; the delay is only
  cancelled if you touch again before it expires.

## 9. Entrance and scroll

Entrance (on load): alpha fade 0→1, rise (vertical offset 10%→0) and scale
0.94→1 over 1.8 s ease outCubic.

Scroll (`scroll-fx.js`; replica of the site's real home-hero.js, linear 1:1 scrub):
- Elements: `p.world` (contains the canvas) and `.fragment-wrapper` (stats card).
- Rest state: **desktop (≥1200px): translate(0, −500px) scale(1) — FIXED, hand-picked
  by Igor**; tablet: y = −vh + 434; mobile: y = −vh + 386.
- Range: `E = altura(.home-hero)·1.75 + 88`; `start = max(0, 4/7·E − vh)`;
  `end = E − vh`.
- With progress p ∈ [0,1]: world `y = reposo − 0.75·vh·p`, `scale = 1 − 0.75·p`
  (ends at 0.25); wrapper `scale = max(0, 1 − p/0.8)`.
- rAF-throttled, passive listeners, recomputed on resize. Hook: `window.__heroScroll`.

## 10. Final CFG (approved by Igor, 2026-08-31)

```
latStepDeg 1.44 · lonStepDeg 1.08 · dashLenDeg 0.85 · dashAngleDeg 40 · dotFloor 0.22
dashWidthRatio 0.0021 · radiusRatio 0.4775 · tiltDeg 21 · rollDeg 7
spinPeriodMs 21600 · wobblePeriodMs 26000 · entranceMs 1800
landBase 0.55 · oceanBase 0.09 · coastBoost 0.85 (COAST_MAX 5 cells)
softBlurPx 0.6 · bloomStrength 0.55 · bloomWidth 3.4 · bloomFrom 0.5
spotAngleDeg 23 · spotStrength 0.3 · spotLandFactor 0.1 · spotBulge 0.045
spotNeedlePow 400 · spotFadeMs 250 · spotTouchHoldMs 900
dragPitchMin −25 · dragPitchMax 40 · inertiaMinMs 350 · inertiaMaxMs 3200
flickMinVel 0.00008
cursorColor #000000 · cursorOutline #ffffff · cursorOutlinePx 1.5
cursorSizePx 28 · cursorStrokePx 3
```

Everything is exposed on `window.__earth` (cfg, state, redraw, spinAnim, flick(v),
rebuild(), applyCursor()). The construction parameters (latStepDeg,
lonStepDeg, dashAngleDeg, dotFloor, landBase, oceanBase, coastBoost) are
tweaked live with `__earth.cfg.X = v; __earth.rebuild()` (regenerates the
~26k marks, fixed seed → same pattern); the cursor ones with
`__earth.applyCursor()`; the rest take effect on their own.

## 11. Performance

~26k marks in total (~13k visible) with the 1.44/1.08 grid. draw() ≈ 2–5 ms on pure CPU (no GPU);
on a modern laptop it holds 60fps with room to spare. Keys: no sqrt in the hot
paths where it could be avoided, alpha buckets (14 strokes per frame, not 29k),
vector bloom instead of filters, and the internal canvas capped at 1702px.

## 12. Decision history (so debates are not repeated)

- Light land / dark sea: Igor's decision (the original video is the other way round).
- "/" slashes and water as small dots: Igor's decision.
- The original's row grid > Fibonacci/jitter: Igor's decision.
- 2026-08-31: density corrected to that of the original video as measured on frames
  (lat 1.44° / lon 1.08°, previously 0.8°/0.8°) and stroke width 0.0021 (~4px
  at 1702, like the video). Verified by autocorrelation on a headless
  render: 1.41°/1.06°. Igor's request ("the original grid had
  fewer elements").
- Arctic islands as water, Greenland as land: Igor's decision (area filter).
- Small focus with an f^400 needle: values chosen by Igor experimenting in the console.
- 2026-09-01: the focus is no longer desktop-only and is activated ON TOUCH on mobile
  (Igor's request). The `FINE_POINTER` gate was removed from `spotActive` in
  draw() and the listeners were split by `pointerType`. The rest of the page's
  effects were left untouched.
- Desktop rest state fixed at −500px: value chosen by Igor.
- 2026-08-31: custom cursor over the canvas on desktop (fine pointer):
  an SVG crosshair reticle — 4 arms with NO centre dot (visual reference
  chosen by Igor, who asked for the dot to be removed). After trying solid Celonis
  green #5cfe50, Igor chose BLACK with a 1.5px WHITE OUTLINE wrapping
  each whole arm (visible against a black background and over bright areas).
  Geometry (s=size, sw=stroke, o=outline): outer arm at 0.04·s+o;
  inner at a1 = s/2 − sw/2 − 3o, so that the gap between one arm's white
  and that of the perpendicular arms is exactly o (Igor's request;
  he first asked for 1px and then for "the same distance as the outline width").
  Hotspot centred, fallback `crosshair`; on touch it is left alone. Same cursor
  during dragging (no grab/grabbing). To go back to green without an outline:
  cursorColor '#5cfe50', cursorOutline ''.
- Historical bug 1: using variables before declaring them inside draw() → silent
  NaN (`var` hoisting does not initialize). Compute yOffset at the start.
- Historical bug 2: antimeridian rasterizer (see §2).

## 13. Notes for porting to another technology

- WebGL/Three.js: instancing of ~58k quads or gl.LINES; the mask can be passed
  as a texture (equirect 1440×720, nearest) and the WHOLE brightness model (§5) and
  the focus (§8) fit in the vertex/fragment shader — the bloom would become a real
  post-process (UnrealBloomPass or similar).
- Keep EXACTLY: the row grid (§1), the brightness formulas (§5), the scroll
  curves (§9) and the CFG values (§10). They are the "look".
- The saved original video serves as a visual reference for contrast and rotation
  rhythm (~100° every 6 s).

## Menu like the real site (nav-fx.js)

`nav-fx.js` — top menu effect (hide on scroll down + CTA clone).
SHARED file unified in `experiments/nav-fx.js`, loaded by the 6 pages
as `../nav-fx.js?v=N`. Full specification, exact values and mistakes already
made: **`experiments/claude_navfx_context.md`** — read that doc, do not duplicate
the information here.

