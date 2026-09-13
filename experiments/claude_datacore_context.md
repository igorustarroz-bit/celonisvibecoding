# Celonis Data Core hero — experiment 3 specification

> **New experiment?** The complete process (save the page from the browser →
> anti-phishing cleanup → nav-fx → index → publish) is in
> `claude_newexperiment_context.md`.

> This document lives in `experiments/` alongside the other `claude_*_context.md`
> files (all uploaded there on 2026-09-03). **The paths in this doc are relative to
> `experiments/`.**

Reference document for maintaining this hero or REBUILDING IT IN ANOTHER
TECHNOLOGY (Three.js, raw WebGL, SVG, Rive, Lottie…). It describes WHAT is seen
and with which exact data, separating the design (technology-agnostic) from the
current implementation notes. Status: v19 (2026-09-01).

Igor's rule for the whole project: everything is delivered in English — the
experiments' UI, the context files (`claude_*_context.md`) and the comments
inside the code. Orders may come in Spanish; the output does not.

## 1. What it is

Animated replica of the "Data Core" from the hero of
https://www.celonis.com/platform/datacore — originally the video
`Data Core _ Celonis_files/media_1d4cef74d99f6c45beccfa206d959b14c6b09d142.mp4`
(1280×720 @50fps, 17 s) with reference still
`Celonis_DataCore_Still.png` (3840×2160). It replaces the `<video>` with a
`<canvas id="datacore-canvas">` inside
`<div class="auto-player-wrapper" id="datacore-stage">` (aspect-ratio 16/9).

Two variants:
- A (Canvas 2D + anime.js): `datacore/index.html` + `anime-datacore/datacore.js`
  — fake 3D.
- B (real 3D, the main one): `datacore/index3d.html` +
  `anime-datacore/datacore-3d.js` — the one
  this document describes.

## 2. The scene (technology-agnostic)

2:1 isometric view of a stack of THREE FLOORS of almost-black smoked glass
on a black background, each floor with its pill label. From bottom to top:
DATA INTEGRATION, DATA TRANSFORMATION, PROCESS QUERY ENGINE.

- Isometric orthographic camera: azimuth 45°, elevation 31.3°.
- Scale: A = min(widthPx·K, heightPx/5.4) · 1.10, with K = 0.17 on desktop and
  K = 0.205 below 900px (v26). On MOBILE the stage additionally goes from
  16/9 to 5/6 via CSS (`@media (max-width:900px)` in the <style id=datacore-exp>
  of both index files): with 16/9 the height dominated the min() and the figure
  came out tiny (A≈40 at 390px width); now A≈79, exactly double, and the
  figure takes up ~94% of the width. Same rule in both variants. In the 3D variant,
  pixels-per-world-unit = √2·A. The vertical separation between floors is
  multiplied by SEPK = 1/(cos 31.3°·√2) to match the elevation of the
  2D variant.
- Mouse parallax: rotates the root up to ±0.22 rad in Y and ±0.05 in X,
  smoothed with lerp 0.055/frame. On phones the same input comes from the
  gyroscope through the shared `lib/tilt-parallax.js` (v29, 2026-09-04) —
  see the rule in §12 and `claude_newexperiment_context.md`.
- Cursor: custom crosshair (4 arms with a central gap, 3px black stroke
  with a 1.5px white border, 28px, SVG data-URI); only with a fine pointer.

### The floors (lines)

Each floor has a rounded-diamond-shaped FRAME LINE (extent
1.04, corners r 0.10) that acts as its transparent FLOOR. The line is
RIGIDLY BOUND to its floor: pieces and line always move together, nothing
runs ahead or lags behind (the line is a child of the floor's group, with no
offsets of its own). In the implementation it is a ~2px mesh ribbon (a 1px
Line cannot be thickened in WebGL).

### The cycle (timeline, 11.5 s loop, ease inOutQuart)

State `spread` 0=compact / 1=exploded and `label` 0/1:
- 600→3000 ms: spread 0→1 (explosion).
- 1900→2600 ms: label 0→1 (the THREE labels appear).
- hold exploded until 7600 ms.
- 7600→8100 ms: label→0 (ALL the texts disappear BEFORE the floors come together).
- 7900→10100 ms: spread→0 (collapse); hold compact until 11500.
- Separately: `wave` 0→1 over 9 s, linear loop (driver of the middle layer's morph).
- Separation between floors: sep = (0.004 + (1.28 − 0.004)·spread)·SEPK.
  When compact, 0.004 ≈ <1px: the three floors coincide and the three lines LOOK
  LIKE A SINGLE ONE (the epsilon avoids z-fighting from being exactly coplanar).
- Bob: sinusoidal floating with a COMMON PHASE across floors, amplitude
  (0.009+0.003·li)·spread, only when exploded.
- Initial pop-in (once, not in the loop): per-tile appearance based on Manhattan
  distance to the center, 0.5 s window, scale 0.75→1 + alpha.
- `prefers-reduced-motion`: static exploded state, no animations.

### Concentric fusion (compact state)

On collapse, the three floors distribute themselves IN PLAN without overlapping:
- Top floor: shrinks to the CENTER (topScale = 1 − 0.52·inv, with
  inv = 1 − spread).
- Middle floor: shrinks a little (midScale = 1 − 0.22·inv) and EMPTIES its core
  (midHole = 0.68·inv): it remains as a ring around the top floor.
- Bottom floor: its plates MORPH into an outer diamond ring (§3).

## 3. Bottom floor — DATA INTEGRATION (plates with morph)

SOURCE OF TRUTH: the SVG drawn by Igor
`datacore/Data Core _ Celonis_files/piso_inferior_forma_poligonos.svg` (in the
repo). It contains TWO diagrams: left = EXPLODED state (4 shields),
right = COMPACT state (diamond ring with V-shaped notches). There is NO central
box: the rectangular gap between the shields stays empty, framed by
their edges.

Normalization of the SVG to screen coords (a,b) ∈ [−1,1] over the diamond:
a = (x − cx)/298.34, b = (y − 153)/149.17, with cx = 305.74 (left diagram) and
cx = 1012.74 (right). Afterwards, each state's set is CENTERED by subtracting the
center of its bounding box (the drawing sits ~0.034 to the north). Conversion to
the world plane: u = 1.04·(a+b), v = 1.04·(b−a)  [equivalent to (a,b)·1.471 and
a 45° rotation with 1/√2].

Coordinates (a,b) ALREADY normalized, BEFORE centering, order S, N, W, E:

EXPLODED:
- S: [0.222,0.201] [−0.22,0.201] [−0.385,0.355] [−0.385,0.459] [−0.059,0.778] [0.056,0.778] [0.375,0.459] [0.375,0.355]
- N: [0.222,−0.268] [−0.22,−0.268] [−0.385,−0.422] [−0.385,−0.526] [−0.059,−0.845] [0.056,−0.845] [0.375,−0.526] [0.375,−0.422]
- W: [−0.22,−0.245] [−0.22,0.184] [−0.385,0.339] [−0.5,0.339] [−0.824,0.017] [−0.824,−0.08] [−0.5,−0.409] [−0.395,−0.409]
- E: [0.225,−0.245] [0.225,0.184] [0.39,0.339] [0.505,0.339] [0.829,0.017] [0.829,−0.08] [0.505,−0.409] [0.4,−0.409]

COMPACT:
- S: [0.394,0.371] [0.395,0.484] [0.065,0.814] [−0.056,0.815] [−0.393,0.484] [−0.393,0.372] [−0.325,0.308] [0.002,0.637] [0.331,0.307]
- N: [0.058,−0.882] [0.395,−0.551] [0.395,−0.439] [0.329,−0.377] [0.002,−0.704] [−0.328,−0.373] [−0.393,−0.439] [−0.393,−0.551] [−0.063,−0.882]
- W: [−0.412,−0.432] [−0.338,−0.363] [−0.666,−0.034] [−0.336,0.297] [−0.401,0.359] [−0.523,0.359] [−0.862,0.02] [−0.862,−0.086] [−0.524,−0.432]
- E: [0.518,−0.432] [0.857,−0.086] [0.857,0.02] [0.518,0.358] [0.397,0.359] [0.336,0.302] [0.671,−0.034] [0.338,−0.367] [0.407,−0.432]

MORPH tied to spread (spread 1 = exploded, 0 = compact). Reproducible recipe
in any technology:
1. Round each polygon with radius 0.035 (in u,v units).
2. Resample both contours to 96 points EQUALLY SPACED by arc length.
3. Unify the winding (positive signed area in both).
4. Align the compact loop against the exploded one by trying all 96 cyclic
   offsets and keeping the one with the minimum sum of squared distances.
5. Interpolate linearly vertex by vertex. The current implementation
   precomputes 13 steps and picks by index round(inv·12); a continuous morph
   also works.
Plate height: 0.05 units (HEX_H), with a 0.018 bevel.

## 4. Middle floor — DATA TRANSFORMATION (square↔circle morph)

10×10 grid, extent 0.8 (in u,v), gap 18%, tile height 0.04 (TILE_H).
Each tile morphs between a rounded square and a circle (13 precomputed shared
geometries). A DIAGONAL FRONT sweeps across the grid: circles on
one side, squares on the other, oscillating on its own:
p = clamp01(0.5 + (front − aScr + (seed−0.5)·0.18)·2.6 + hoverP), with
aScr = (u−v)/1.6 (horizontal screen axis) and
front = sin(wave·2π)·0.85. When compact, tiles with
ring < midHole disappear (the core empties out into a ring).

## 5. Top floor — PROCESS QUERY ENGINE (shapes and flips)

6×6 grid, extent 0.8, gap 16%. Per-tile shape from a deterministic RNG
(mulberry32, seed 20260831): 42% rounded square (r 0.22), 18% "leaf /"
(corner radii [1,0.12,1,0.12]), 18% "leaf \\", 22% circle.

- GROWTH 4×4→6×6: visible radius reach = 0.62 + 0.52·spread against
  d = (|u|+|v|)/1.6 + per-tile jitter; scale pop 0.55→1 when crossing the
  threshold. When compact, only the inner 4×4 remains.
- FLIPS: every ~520 ms (ambient every 900 ms), if spread>0.75, a random
  tile (max 2 at a time) rotates 180° about the X or Z axis with a sinusoidal
  lift of 0.16, 1050 ms inOutSine; halfway through the turn it changes to
  ANOTHER shape from the pool.
  NO JUMPS: rotating 180° mirrors the shape (leafA↔leafB), so at the
  edge-on crossing relative to the camera (zero crossing of dot(rotated normal, view))
  the MIRROR of the target is installed, and on landing rotation→0 + target shape
  (pixel-identical silhouette). The piece shrinks by ×(1−0.22·sin(pπ)) during the
  turn. The geometries are centered in Y so they can flip about their own axis.

## 6. Labels

Pills with the text in ENGLISH: almost-black background rgba(2,2,2,.92), white
2.5px border, Poppins 500, letter-spacing 14%, white text. One per floor, centered
(x=z=0), at floor height + 0.06. Pill height: 0.1275 world units
(+50% over the original 0.085); the width follows the text's aspect ratio.
HORIZONTAL PADDING (v25, Igor's rule): at least the width of one letter
"o" per side. Implemented as pad = ceil(1.5·measureText('o').width) on
the pill's canvas (at fs 34 → "o" is 21.7 px, pad 33 px, real measured gap
ink↔border 38 px ≈ 1.75 "o"). The 1.5 is not arbitrary: with less, the text
starts inside the rounded cap (radius = height/2 = 32 px) and looks
cramped even though the number checks out. Additionally the text is drawn at
c.width/2 + letterSpacing/2: letter-spacing adds a gap AFTER the last
letter and shifted the pill off-center to the left.
- All THREE follow `state.label`: they appear when exploded and DISAPPEAR before
  the floors come together. None is permanent.
- They are drawn as an OVERLAY: crisp on top of everything, outside the effects
  pipeline (in three: sprites on layer 1, extra render after the composer with
  autoClear=false + clearDepth).

## 7. Interaction (hover, raycast with 60 ms throttle and cooldowns)

- Top floor: hover = tile flip (same mechanism as §5).
- Middle floor: hover = square→circle pulse (hoverP 0→1→0, 320/900 ms).
- Bottom floor: hover = smooth lift of the plate (+0.11 in Y, 360/750 ms).

## 8. The material (glass) — what it must look like

POLISHED almost-black smoked glass with white LIGHT EDGES (the key trait
of the video): each piece draws its edges (>20°) in translucent
white (opacity 0.16–0.48 by seed, rim multiplier). Clean, transparent top
faces; milky bevels and sides (fresnel).
You SEE THROUGH the pieces: the pieces behind, refracted and blurred
(frost). Left→right luminosity gradient (the right half is
lighter, like the still): g = 0.5 + centroid_a·0.31 per piece/tile. Subtle
bloom only for the glare of the edges. Opaque black background.

Defaults calibrated by Igor (window.DATACORE, editable live):
tint {1.8,1.8,1.8}; transmission 0.43 (+0.14 when exploding); refract 0.13;
frost 0.61; frostRadius 0.98; pieceMag 0.71; pieceShift 0.11; fresnel 0.44;
topClear 0.92; topDarken 0.43; edgeWhite 0.44; skyTop #eef4ff;
skyHorizon #8e9aad; iri 0.08; body 0.87; rim 1.16; pre 0.79;
backdrop #e6ecf5; bloom {strength 0.16, radius 0.26, threshold 0.35};
quality {fxaa 0, msaa 4, dprMax 2, preRes 1}; blur 0. CLOSED by Igor
(2026-09-01, v24): the pixelation was fixed with MSAA 4 + a full-resolution
pre-pass, WITHOUT FXAA and WITHOUT blur. The blur control (blurs the final
scene without touching the labels — two H/V iterations of a 9-tap gaussian at
the end of the composer, the label overlay comes after) stays at 0 as a
testing tool.

ANTIALIASING (v23) — two types, combinable from the tuner:
- Real sample-based MSAA (quality.msaa: 0/2/4/8, default 4): in WebGL2 the
  composer's render targets accept .samples; setMsaa() sets them on
  renderTarget1/2 and disposes so that the next render reallocates the
  FBOs. This is "3D" AA: crisp edges without blurring. (The renderer's
  antialias:true only applies to the direct canvas, the composer cancels it — hence
  the need for this.)
- FXAA (quality.fxaa 0/1, default 0): a post-processing pass, softer;
  it remains as a comparison option.

### Current glass implementation (three.js r147) — summary

- It is NOT MeshPhysicalMaterial (physical transmission with a black background has
  nothing to refract): it is a custom ShaderMaterial with screen-space refraction
  over a PRE-PASS of the scene.
- Per-frame pre-pass to an RT (0.6×dpr): procedural studio background + pieces
  with their simple dark twin + edges → what is seen THROUGH the glass.
  Without this the glass comes out gray and dull.
- Frost: separable gaussian blur of the pre-pass at quarter resolution
  (9 taps, 2 passes); the shader mixes crisp/blurred with uFrost.
- PER-PIECE LENS: each piece is its own lens — per-mesh uniforms uCenter
  (center projected to screen uv, updated PER FRAME) and uOffset by
  seed; buv = uCenter + rel·uMag + N.xy·uRefract + uOffset·uShift.
- Zones by world normal: topness = smoothstep(0.55,0.95,up). Top face =
  real transparency; milky white ONLY on bevel/sides; a 3-stop fresnel
  toward skyTop/skyHorizon attenuated on the top face; iridescence as a
  cosine palette with phase by normal.
- Post-processing: RenderPass + UnrealBloomPass + GammaCorrection (the composer
  works in LINEAR space: without the gamma pass everything comes out flat and dark);
  shader output in pow(col, 2.2). At the end, an FXAA pass (v20): the render
  targets of the composer do NOT have MSAA — the renderer's antialias:true only
  applies to the direct canvas — so without FXAA the edges come out pixelated.
  FXAA goes AFTER the gamma pass (it expects sRGB input) and its resolution uniform
  is updated on resize with 1/(W·dpr). devicePixelRatio capped at 2.
- Environment for the bevel reflections of plateMat: procedural equirect with
  horizontal softbox-style bands; the y=168 band is the one the
  top faces reflect.

## 9. Glass tuner (variant B only)

`datacore-tuner.js`: tuning panel IN ENGLISH, fixed at bottom-right
(right/bottom 18px), STARTS COLLAPSED as a "● GLASS TUNER" pill and
EXPANDS UPWARDS (flex column-reverse: header at the bottom, body
above, max-height 70vh). 2026-09-04 (aligned with the book tuner, v25): the
× in the header HIDES the panel completely, the **T key** or
`DATACORE_TUNER.show()` brings it back; the header is a `<div class="hd">`,
not a `<header>` (the site's CSS gives every `<header>` 88 px and the
collapsed pill came out tall); no `backdrop-filter` (with border + radius
Chrome drew broken corners); and the Sharpness section ends with an
"in effect" read-out fed by `window.DATACORE_INFO()` (WebGL2 or not, the
render targets' MSAA samples, FXAA on/off, pixel ratio) — Igor's rule. Sliders and color pickers hooked to
window.DATACORE (applied every frame), Copy settings (exports the
JSON) and Reset buttons. Igor's workflow: tune live, export the JSON and
paste it as the new defaults in datacore-3d.js. Sharpness section (v21):
FXAA 0/1 (enables/disables the pass), max pixel ratio (dpr cap,
0.5–3) and pre-pass res (resolution of the pre-pass RT, 0.2–1) — changes to
dpr/preRes trigger resize() from applyTune; they live in DATACORE.quality
{fxaa:1, dprMax:2, preRes:0.6}.

## 10. Menu like the real site (nav-fx.js)

`nav-fx.js` — top menu effect (hide on scroll down + CTA clone).
A COMMON file unified in `experiments/nav-fx.js`, loaded by the 6 pages
as `../nav-fx.js?v=N`. Full specification, exact values and mistakes already
made: **`experiments/claude_navfx_context.md`** — read that doc, do not duplicate
the information here.

## 11. Files

In `datacore/anime-datacore/`: `datacore.js` (variant A), `datacore-3d.js`
(variant B), `datacore-tuner.js`, `anime.umd.min.js` (v4.5.0).

SHARED, in `lib/` since 2026-09-04 (moved with `git mv` when experiment 4 started
using them; the pages load them as `../lib/...`): `sprite.js` (placeholder
spritemap from experiment 1: real logo + replacement icons; rewrites the <use>
elements to local symbols), `three.min.js` (r147 UMD, from npm — CDNs are
blocked from the Cowork sandbox), `three-post.js` (concatenation of examples/js
from r147: CopyShader, LuminosityHighPassShader, Pass/MaskPass/ShaderPass,
RenderPass, EffectComposer, UnrealBloomPass, GammaCorrectionShader, FXAAShader).
`lib/poppins.css` (+ `lib/fonts/`) is also there; the datacore pages do NOT load
it yet — see `claude_3dbook_context.md` §5.

In `datacore/`: `index.html` (A) and `index3d.html` (B) — pages saved and
cleaned (no trackers or external scripts, root URLs rewritten to
https://www.celonis.com/...); `original.html` (untouched copy with the video);
`Data Core _ Celonis_files/` (assets, video, still and the SVG of the
plates). NO A↔B switch (removed in v19; navigation is the root index).

> **IGOR'S RULE (2026-09-04) — the definitive version ALWAYS ships with tuning handles,
> and ALWAYS with the antialiasing controls.** Every experiment's final page carries a
> tuner panel like the Data Core's glass tuner (bottom-right, collapsed pill, expands
> upwards, sliders wired to the `window.<KNOBS>` object the render loop reads every
> frame, Copy settings / Reset), and that panel always includes the antialias section:
> MSAA samples (0/2/4/8 on the composer's render targets, WebGL2), FXAA 0/1, max pixel
> ratio — plus a read-out of what is REALLY in effect (WebGL2 or not, samples, FXAA,
> dpr), because Igor cannot tell from the picture whether it is applied. The panel must
> be hideable (× in its header; the T key / `<X>_TUNER.show()` brings it back), its
> header is a `<div>` (the site's CSS makes every `<header>` 88 px) and it uses no
> `backdrop-filter` (broken corners in Chrome). Reference implementations, identical in
> behaviour: `3d-book/book-fx/book-tuner.js` (+ `BOOK_INFO()`) and
> `datacore/anime-datacore/datacore-tuner.js` (+ `DATACORE_INFO()`).

> **IGOR'S RULE (2026-09-04) — the hover parallax of the 3D figures must exist on mobile
> too, driven by the gyroscope.** On desktop the figure turns a little as the pointer
> moves around it (root ±0.22 rad Y, ±0.05 X, lerp 0.055) — "it heightens the sense of
> depth". Phones have no hover, so the same input comes from the device orientation
> sensor through the shared **`lib/tilt-parallax.js`**: `TiltParallax.start(function (x, y)
> { mouse.x = x * 0.6; mouse.y = y * 0.6; })` — one line after the pointer handler, same
> range as the pointer. Facts the file works around: only on coarse-pointer devices; the
> neutral attitude is how the phone is held when readings start and slowly follows the
> user; landscape swaps the axes via `screen.orientation.angle`; **iOS 13+ needs
> `DeviceOrientationEvent.requestPermission()` from a user gesture** — the first tap
> anywhere asks once, silently, and a refusal just leaves the figure still; needs https
> (Pages) or `file://`. Full deflection at 14° of tilt (`opts.range`). Load it before the
> experiment's script: `<script src="../lib/tilt-parallax.js?v=N">`. Used by the Data Core
> (`index3d.html`, datacore-3d v29) and the book (v12).

## 12. CLOSED decisions — do not reopen

- Opaque tops in variant A; in B, transmission ALWAYS low
  (base 0.43): at ≥0.5 when exploded the tiles swallow the background and end up
  flat; at ≥0.4 the compact state turns milky.
- roughness ~0.10: the video is POLISHED glass; 0.30 "frost" grays it out and kills
  the reflections. The frosted look is achieved with the backdrop blur (frost), not
  with roughness.
- The pre-pass backdrop must be in MID TONES: large white areas
  blow out the stack.
- No visible volumetric light beams (tried and removed by Igor:
  "it doesn't affect the materials, it looks terrible").
- Front wall of 2D prisms PER EDGE with winding (the "chain between
  endpoints" produces bowties).
- No central box on the bottom floor (removed in v16).
- No permanent labels (since v16).
- Refraction lives off the frost, not off the displacement (low refract, 0.13).
- The glass tuner stays in the definitive page, with its Sharpness section (MSAA,
  FXAA, pixel ratio, pre-pass res) and the "in effect" read-out (`DATACORE_INFO()`,
  added 2026-09-04) — Igor's rule above.

## 13. Performance and publishing

~60 fps in Chromium at 1440×900. No network dependencies at runtime other than
fonts/images from the site itself.

GitHub Pages of the repo `igorustarroz-bit/celonisvibecoding` (main branch, root):
- A: https://igorustarroz-bit.github.io/celonisvibecoding/experiments/datacore/index.html
- B: https://igorustarroz-bit.github.io/celonisvibecoding/experiments/datacore/index3d.html
- Original: .../experiments/datacore/original.html
The root index lists this experiment as "Experiment 3". The scripts of
index3d.html are versioned (?v=N — bump it on every publish, Pages caches the
JS for 10 min). The token is in `github-token.txt` (gitignored — NEVER upload it).
Cowork note: git cannot delete its .lock files in the mounted folder —
move the stale .lock files to `_to_delete/` (gitignored) before commit/push.

## 14. Condensed history

v12 figure +10%, ribbon outlines, first plates from the still, hover ·
v13 octagons and automatic diagonal front · v14 arrow-shaped plates and
concentric fusion · v15 EXACT shapes from Igor's SVG + shields↔ring morph ·
v16 no central box, centered plates, line=rigidly bound floor, non-permanent
labels · v17 coincident floors when compact (the 3 lines = one,
sepMin 0.004) · v18 labels +50% · v19 no A↔B switch, glass tuner
bottom-right collapsed and expanding upwards, in English · nav-fx.js menu like the site ·
v20 antialiasing: FXAA at the end of the composer + dpr up to 2 (FXAAShader r147
added to three-post.js) · v21 Sharpness section in the tuner
(DATACORE.quality: fxaa/dprMax/preRes live) · v22 Igor's defaults
(fxaa 0, preRes 1) + scene blur control that respects the labels ·
v23 real sample-based MSAA (0/2/4/8, default 4) via samples on the composer's
RTs · v24 Igor's FINAL settings: msaa 4, fxaa 0, preRes 1, blur 0 —
pixelation resolved · v25 horizontal padding of the pills ≥ one "o" (1.5·oW) and
centering corrected for the letter-spacing · v26 mobile: stage 5/6 and K 0.205
(figure ×2 in both variants) + nav-fx with a live breakpoint and
restored in index3d · v27→v28 (2026-09-04) tuner aligned with the book's: hideable (× / T), div header,
no backdrop-filter, antialias read-out (`DATACORE_INFO`) · v29 gyroscope parallax on phones
(`lib/tilt-parallax.js`).

---

## The tuner moved onto the shared kit, 2026-09-13

`datacore/anime-datacore/datacore-tuner.js` (?v=28) is now a knob list on top of `lib/tuner-ui.js`; it builds nothing itself. The
panel is **built on load again, collapsed**, as it was before the 2026-09-09 `?tuner` gate:
the kit's sliders, chips and colour swatches are `<div>`s, so the page still contains zero
`<input>`, `<select>`, `<textarea>` or `<form>` and anti-phishing rule 12 holds. `×` and the
`T` key hide and show it; `?tuner` still works and is now a no-op convenience.

Two behaviours arrived with the move, on every panel in the repo: **double-click a row** to
reset that one knob (the value is amber while it differs from the default), and **the variable
each knob writes to is printed under its label**.

All 29 knob paths were checked to resolve against window.DATACORE, and the panel was built in a browser
against the real settings object: every value real, 0 form elements, 0 after "Copy settings".

Read `claude_tunerui_context.md` before changing anything in it, and
`claude_antiphishing_context.md` §8 for why the gate is gone.
