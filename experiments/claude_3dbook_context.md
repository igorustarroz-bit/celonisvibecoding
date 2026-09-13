# eBook hero with a 3D book — experiment 4 specification

> **New experiment?** The complete process (save the page from the browser →
> anti-phishing cleanup → nav-fx → index → publish) is in
> `claude_newexperiment_context.md`. Since 2026-09-04 the cleanup is a script:
> `clean-saved-page.py` (see §7).

> This document lives in `experiments/` alongside the other `claude_*_context.md`
> files. **Paths in this doc are relative to `experiments/`.**

Status: **DEFINITIVE (2026-09-04, Igor: "esta es la versión definitiva del libro") — now v11:
editorial interior pages on the turning leaves (v9), plain black cover until the artwork
loads (v10), images bundled as data URIs so it works from `file://` (v11).**
`index.html` + `book-fx/book-3d.js` + `book-fx/book-tuner.js`. The other versions were
removed from the repo on Igor's instruction (the frozen v5 copy `index-v5.html` /
`book-3d-v5.js` and its link in the root index); history keeps them: git tag
`3d-book-v5` (commit `4c00fc3`) and the commits below. `BOOK.present = 0` still gives
the v5 flat-lay behaviour from the definitive build.
v1 `ec88f1a`, v2 `7c54417`, v3 `33388d0`, v4 `1903e1f`, v5 `4c00fc3`.

Igor's rule for the whole project: everything is delivered in English — the
experiments' UI, the context files and the comments inside the code. Orders may
come in Spanish; the output does not.

## 0. Igor's reviews (2026-09-04), CLOSED decisions

### v5 → v6 (fifth review) — rise and face the camera ("final test")

Igor's Photoshop sketch: on opening, the book should end up standing, presented
frontally as a wide V with the spine at the back and both pages angled toward the
viewer, zoomed in — "to sell the 3D turn and the zoom". Implemented as a rotation of
the whole `book` group that grows with the open fraction (`pres = present ·
open^presentEase`): book +y (the spread's normal) → the camera direction leaned back by
`presentTilt` (12°), book −z (top of the pages) → screen up; quaternion slerp from the
table pose. The V widens from `vAngle` (7°, table) to `presentV` (34°, presented). The
live camera fit does the zoom. Knobs: `present` (0 = v5 flat-lay), `presentV`,
`presentTilt`, `presentEase`.
Mistake made on the way: building the target basis with the third axis pointing the
wrong way gives a LEFT-handed matrix; `setFromRotationMatrix` on it yields a ~45°
skewed pose. Third axis = X × Y, always.
Frame check redone in this pose (13 + 13 frames): nothing crosses.

### v4 → v5 (fourth review) — the left page must be the LAST sheet to land

Igor saw the left page covered by a blank leaf on his machine ("la página final se
superpone con otra") and diagnosed it himself: the loose leaves were modelled BETWEEN
the two final pages, when they must be the FIRST sheets to turn and the spread the
last two. The v4 model had the left page on the flipped block's bottom face and the
leaves rigidly rotated (+ε inside the upper half → −ε inside the flipped block, hidden);
on a real GPU with the 16-bit MSAA depth the block face and a leaf 1–4 mm apart
resolved the wrong way. Fixed by making the model physically right instead of relying
on depth:

- The upper half's bottom face is BLANK paper. **The left page is the BACK of the last
  loose leaf to land** (`layoutLeaves()` puts `leftMat` on the back plane of leaf
  n−1; each leaf is two single-sided planes, back 0.2 mm outward).
- A leaf's offset from the split is **not rigid: ε·cos(angle)** — +ε inside the upper
  half when closed, 0 standing, −ε when landed = ε ABOVE the flipped block's face. So
  the leaves land ON TOP of the left stack in landing order (leaf i lags (i+1)·leafLag
  and sits (i+1)·LEAF_GAP deep, LEAF_GAP 2.2 mm: deeper sheet = turns later = lands
  higher), content sheet on top. Closing, the content sheet lifts first, as it should.
- Frame check redone (13 + 13 frames): nothing crosses, the left face stays blank until
  the leaves land.

### v3 → v4 (third review)

- **Open = a slight V, not flat.** Seen edge-on the open book makes a shallow V about
  the spine: both halves rise by `vAngle` (7°). Implemented by hanging everything from a
  `rightHalf` group hinged at the spine's bottom edge (rotation `open·v`), with the flip
  group as its child rotating `open·(π − 2v)`, so the left half ends at π − v absolute;
  the spine bisects (`open·(π/2 − v)`). Leaves are children of the same frame.
- **The cover is the ORIGINAL artwork**, not a drawn replica: the four corners of the
  book in the product shot (`commercial_sustainable-Supply-Chain-eBook.png`, 750×499)
  were unwarped with a perspective transform (OpenCV `getPerspectiveTransform`, corners
  TL (101,181) TR (342,37) BR (641,287) BL (392,455) → 1024×1414, 14 px border cropped) into
  `book-fx/spread/cover.jpg`. The photo's own lighting stays baked in — Igor prefers it.
  `BOOK.coverSource = 'drawn'` switches back to the canvas replica (kept as fallback,
  also used until the JPG loads). Igor's rule: **use the client's real artwork when it
  exists; do not reinvent it.**
- **The camera may zoom during the animation** so the model is never cut: it is now
  re-fitted EVERY FRAME to the world-space corners of every part in its current pose
  (`fitPoints()` → bounds → distance + target, 3 passes), then eased with `camSmooth`
  (0.12). It zooms out while a half stands up mid-flip and back in when the book is flat.
- **Frame-by-frame check is part of delivery.** `window.BOOK_SET_OPEN(t, closing)`
  freezes the open fraction (leaves get their lag as `lag/openMs`); a headless run
  captured 13 frames opening and 13 closing (`frames.js` in the session, sheet checked
  visually): no page crosses another in either direction. Redo it after any change to
  the flip, the leaves or the V.

### v2 → v3 (second review)

- **Less perspective.** The camera is a long lens: `fov 11` (was 24), i.e. almost
  orthographic but still a photo, not the isometric Data Core view. Consequence for the
  code: the composer's multisampled render targets carry a 16-bit depth buffer, and at
  the resulting distance (~9 units) a 0.1…200 near/far range cannot separate the 9 mm
  cover from the page block — the cover z-fought into stripes. `placeCamera()` now sets
  near/far to ±2.5 around the book. Keep it if the camera is ever changed.
- **No floor line.** The rounded-rectangle ribbon under the book is gone (code removed).
- **Bug fixed: pages showing above the closed cover.** The loose leaves lagged behind
  the cover on close, so they were still turning when the cover was flat. Rule now:
  a leaf's angle is always ≤ the flipping half's angle — opening they trail it, closing
  they run ahead of it (`Math.min(open, openAt(isOpen ? ms − lag : ms + lag))`).
- **Click opens the book AT THE MIDDLE and shows a two-page spread** with invented
  editorial content (§2b). The front cover and the upper half of the page block flip
  180° about the spine as one piece; the loose leaves turn behind it; the spine
  flattens (pivots by half the angle). Another click closes it. The camera pans from a
  framing centred on the closed book to one centred on the open spread.

### v1 → v2 (first review)

- **No pill label.** The "EBOOK · ENGLISH" sprite is gone (code removed, not hidden).
- **Not the isometric Data Core angle.** The book must respect the point of view of the
  original product shot: a perspective camera placed where the photographer was —
  on the book's lower-left, high up (`TUNE.camera = {az: -50, el: 50, fov: 24}`;
  az measured from +z toward +x, so negative = the spine side). The spine sits
  lower-left, the bottom edge runs up-right, the title reads rising to the right, the
  near corner is the biggest. The Data Core look stays in the MATERIALS and effects
  (softbox environment, light edges, floor line, bloom), not in the camera.
- **The book only opens on CLICK** (and closes on the next click; Enter/Space on the
  focused canvas do the same). No loop. Hover only lifts the cover a few degrees as an
  affordance (`hoverLift`, now 4°, set to 0 to remove it).
- **The forms come back as inert replicas** (page-level decision, see the anti-phishing
  doc rule 9 and `lib/inert-form.*`): the gated download form in the `.pnf` block and
  the footer newsletter, typable but with no `<form>`, no action, no names, no
  email/password types; the button shows a "disabled in this prototype" note.

## 1. What it is

The eBook detail page `https://www.celonis.com/insights/ebooks/supply-chain-sustainability`
("The Realist's Guide to Sustainable Supply Chains") with the hero's product shot — a
rendered PNG of the printed guide lying at an angle on black, 750×499 — replaced by a
**real 3D book** built with the Data Core technology (experiment 3): Three.js r147 UMD +
the post stack in `lib/three-post.js`. The idea: the same 3D language the site uses for
the Data Core, applied to a content asset.

- Folder: `3d-book/` — `original.html` (saved copy, cleaned), `index.html` (the
  experiment), `original/` (the browser's assets, 17 files published, 75 tracking files
  gitignored), `book-fx/book-3d.js` (our code), `book-fx/spread/` (the two photos of the spread).
- URLs: https://igorustarroz-bit.github.io/celonisvibecoding/experiments/3d-book/index.html
  and `.../3d-book/original.html`. Listed in the root index as **Experiment 4**.
- In the page: the `<picture>` inside `.detail-page-hero-media-container` becomes
  `<div class="auto-player-wrapper" id="book-stage"><canvas id="book-canvas">`; the
  `<style id="book-exp">` gives the stage `aspect-ratio: 3/2` (the ratio the hero CSS
  gives the image), `border-radius: var(--fnd-radius-m)` and a black background.

## 2. The scene (technology-agnostic)

Black background. A closed paperback lying flat, seen from a **perspective camera
placed like the product shot's photographer** (see §0; v1 used the Data Core isometric
camera and Igor rejected it). Orientation copied from the product shot: the spine sits
lower-left, the title reads rising to the right, the near corner is the biggest.

- Book: width 1.0 × height 1.38 (portrait, like the printed guide), page block 0.062
  thick with a 0.012 inset, covers 0.009 thick, spine wraps the left side.
- Cover artwork (canvas texture 1024×1414): near-black paper `#0d0d0f` with a faint
  diagonal grain, a chain of 11 overlapping white ring outlines (r 118, 3.2 px) in the
  upper half, one blue disc `#0f5bff` in the left ring of the middle row, the title in
  Poppins 600 66 px on three lines, the subtitle in Poppins 400 31 px, a neutral ring
  mark bottom-right (NOT the brand logo — deliberate, see the anti-phishing doc).
- Material: near-black with a clearcoat (roughness 0.52, clearcoat 0.45), lit by the
  **same banded softbox environment** as the Data Core (`makeEnvTexture`, copied
  verbatim) so the flat cover picks up the same soft light band. Pages `#d9d9d9`,
  fore-edge with a horizontal line texture (the stacked sheets).
- Data Core traits carried over: translucent **white light edges** on the covers and the
  page halves (EdgesGeometry, additive, opacity 0.30 / 0.15), subtle bloom (0.14 / 0.26
  / threshold 0.78), MSAA 4 through the composer's render targets (WebGL2), dpr capped
  at 2, mouse parallax (root ±0.22 rad Y, ±0.05 X, lerp 0.055), the crosshair cursor,
  pop-in scale 0.75→1 over 600 ms. (The floor frame line of v1/v2 was removed by Igor.)
- Sizing (`fitCamera`, v4): the camera sits on the az/el direction (`az −50, el 50,
  fov 11`); every frame the corners of every part (back, lower half, upper half, cover,
  spine, visible leaves) are projected in their CURRENT pose and distance + target are
  re-solved (3 passes) so the book fills `fit` (0.90) of the stage and is centred; the
  camera eases toward that with `camSmooth` (0.12). Snap (no easing) on resize.
  near/far are ±3 around the book (see §0 v3).

### Structure of the book (for the flip)

```
rightHalf         hinge at the spine's bottom edge (−BW/2, 0), rotation.z = open·v   (v = vAngle)
  back cover      y ∈ [0, CT]
  lower half      y ∈ [CT, CT+PT/2]                        — its TOP face is the RIGHT page
  spine           hinge at its bottom edge, rotation.z = open·(π/2 − v) (bisects the V)
  flip group      pivot (−BW/2, CT+PT/2), rotation.z = open·(π − 2v)
    upper half    local y ∈ [0, PT/2]                      — bottom face BLANK (v5)
    front cover   local y ∈ [PT/2, PT/2+CT], own hinge for the hover lift
  leaves (5)      hinge at (−BW/2, CT+PT/2); two planes per leaf at offset ε·cos(angle),
                  ε = (i+1)·2.2 mm; the back plane of the LAST leaf is the LEFT page (v5)
```

With v = 0 the flip puts the front cover face-down at x ∈ [−1.5, −0.5] and the upper
half on it, both pages at y = CT+PT/2; with v = 7° both halves rise from the spine. The left
page texture is turned 180° (`leftTex.rotation = π`) because the −y face's u runs along
−x after the flip. Mistakes already made: an offset on the leaf PIVOT does not
mirror; a leaf that lags the cover on close pokes through it; and putting the left page
on the block face with the leaves rigidly inside it reads fine in software rendering but
fails on a real GPU — and is physically wrong anyway (see §0 v5).

### Motion

- Click on the book (raycast on cover / halves / back / spine) toggles open ↔ closed:
  the flip group goes 0→180° over 1400 ms (inOutQuart), the 5 loose leaves follow it
  with 110 ms more lag each, never beyond it. Closing reverses from wherever it is.
- While open: a slight float of the whole book (amplitude 0.006). The camera pans to
  the open framing.
- Hover (raycast, 60 ms throttle) lifts the front cover 4° while closed — the only
  motion before the click. Mouse parallax and the pop-in are kept; on phones the
  parallax comes from the gyroscope (`lib/tilt-parallax.js`, v12 — see the rule in §3).
- `prefers-reduced-motion`: no parallax, no float, no pop-in, the open/close is
  instant on click.

## 2b. The spread (invented editorial content — English)

Two portrait canvas textures 1024×1414, drawn with the same helpers as the cover
(`para()` word-wrap, `coverImg()` cover-fit). All copy lives in **`window.BOOK_SPREAD`**
(edit it in the console, then `BOOK_REDRAW()`); colours in `BOOK.pageColor` (paper
`#e6e4df`) and `BOOK.green` (the site's CTA green `#5cfe50`, used for the chapter
label, the pull-quote rule and the folio rules).

- **Left page (24):** full-bleed photo on the top 58 % with a dark gradient, "CHAPTER 03"
  in green, headline "Where the emissions actually hide" (Poppins 600 62 px), running
  head + hairline, a standfirst (500 33 px), a photo caption. Photo:
  `book-fx/spread/containers.jpg` — aerial of a container terminal.
- **Right page (25):** running head, two columns of body copy (400 21 px / 30), a pull
  quote with a green rule and attribution, a three-KPI strip (−12 % transport
  emissions · 3.4 days shorter inbound lead time · 1 process to start with), a second
  photo bottom-right with a caption to its left. Photo: `book-fx/spread/solar.jpg` — a
  worker on a solar array.
- `book-fx/spread/cover.jpg` is the unwarped original cover (see §0 v4).
- **`book-fx/spread/assets.js` (v11)** = the three images as data URIs
  (`window.BOOK_ASSETS`), generated by `experiments/bundle-assets.py`, loaded before
  `book-3d.js`; `loadImg()` reads it first and falls back to the plain file. This is what
  makes the page work from `file://` (see the rule above). Re-run the bundler after
  replacing any JPG.
- The photos are two images that came down with the celonis.com home page saved for
  experiment 1 (`3d-globe/original/Image_Photo_commercial_squareValue_supply_chain.jpeg`
  and `…_manufacturing.jpeg`, 750×750), copied here. They load from
  `book-fx/spread/`; until they load a dark placeholder is drawn. To swap them, drop
  new JPGs with the same names (any size — they are cover-fitted).
- The copy is fictional and deliberately in the register of the real guide
  (process mining, event log, "green line", Scope 3, order-to-cash / procure-to-pay).
  No real customer, person or figure is quoted.
- **Interior pages (v9, Igor: "the pages that turn must have the same column structure
  and editorial look as the final two, without images").** Each loose leaf carries a
  real page on each side, drawn with the same grid as the spread (margins, running head
  + hairline, two columns, folio — even pages left / odd pages right, like 24 / 25) at
  3/4 resolution (768 × 1060, 10 textures). Four layout variants cycle: subhead across +
  two columns; body left + pull quote right (like page 25); standfirst across + hairline
  + two columns; numbered list ("01 02 03" in green) left + body right. Columns are
  filled with paragraphs down to the folio area (`fillCol`). Copy lives in
  `BOOK_SPREAD.interior` (subheads, standfirsts, quotes, list, body). Page numbers: leaf i
  = 15+2i (front) / 16+2i (back), so with 5 leaves the last back is 24 = the left page.
  Back-side textures are turned 180° like `leftTex`. `BOOK_LEAF_PAGES` exposes the
  canvases for checking.

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

> **IGOR'S RULE (2026-09-04) — every experiment must work LOCALLY too, opened from
> `file://` (double-click on the .html), not only on GitHub Pages.** The trap: Chrome
> gives every `file://` document a unique origin, so an image loaded from a sibling file
> and drawn on a canvas TAINTS it, and three.js cannot upload a tainted canvas as a
> texture → black cover / no photos locally while the published page is fine (exactly
> what happened with the 3D book). Therefore any image used as a WebGL texture (or drawn
> on a canvas that becomes one) is shipped as a **data URI** in a small JS bundle:
> `python3 bundle-assets.py <out.js> <GLOBAL> <files…>` (script in `experiments/`),
> loaded before the experiment's script; the code reads `window.<GLOBAL>[basename]` and
> falls back to the plain file. Keep the plain JPGs next to the bundle for editing and
> re-run the bundler after replacing one. CSS-loaded assets (stylesheets, `@font-face`
> woff2, `<img>` tags) are NOT affected and need nothing. Before delivering, open the
> page from `file://` as well as the Pages URL.

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

## 3. Live knobs — `window.BOOK` (edit in the DevTools console)

Applied every frame, Igor's workflow (tune live, then paste the values as the new
defaults in `book-fx/book-3d.js`):

`openMs 1400 · vAngle 7 · present 1 · presentV 16.5 (book opening 147°, Igor's value via
the tuner, 2026-09-04) · presentTilt 12 · presentEase 1 ·
coverSource 'photo' · hoverLift 4 · leaves 5 · leafLag 110 ·
bob 0.006 · edgeOpacity 0.30 ·
coverColor #0d0d0f · pageColor #e6e4df · accent #0f5bff · green #5cfe50 · clearcoat
0.45 · roughness 0.52 · envIntensity 0.65 · keyLight 0.55 · ambient 0.12 · bloom
{strength 0.14, radius 0.26, threshold 0.78} · camera {az −50, el 50, fov 11} · fit 0.90 ·
camSmooth 0.12 · quality {msaa 4, fxaa 0, dprMax 2}`

Changing `coverColor`/`accent`/`pageColor`/`green` redraws the cover and the spread;
`camera.*`, `fit` take effect on the next frame (the camera re-fits itself live). The camera is the knob to
match the photo more closely: `BOOK.camera.az = -45` turns toward the bottom edge, `el`
raises/lowers the photographer, `fov` is the amount of perspective (11 ≈ almost none).
The spread copy is `window.BOOK_SPREAD` + `BOOK_REDRAW()`.

**Book tuner (v7, Igor asked for it):** `book-fx/book-tuner.js`, same recipe as the Data
Core's glass tuner — fixed bottom-right, starts collapsed as "● BOOK TUNER", expands
upwards, sliders wired to `window.BOOK`, Copy settings (JSON to paste as defaults) and
Reset. v8 adds the antialias controls (MSAA samples, FXAA 0/1, max pixel ratio) and an
"in effect" read-out (WebGL2, samples, FXAA, dpr) fed by `window.BOOK_INFO()`; FXAA is a
real pass now (after the gamma pass, off by default), and changing max pixel ratio
re-sizes live. Sections: Presented pose (rise to camera, **book opening in degrees** — the total
angle between the two pages, 180° = flat, stored as `presentV = (180 − opening)/2` —,
lean back, rise lag), Table pose (V per half), Camera (azimuth, elevation, focal, fit,
smoothing), Motion (open time, leaves, leaf lag, hover lift, float), Look (edges,
environment, lights, cover roughness/clearcoat, paper and green colours), Bloom &
sharpness. An "Open / close book" button at the top drives the same toggle as the click
(`window.BOOK_TOGGLE`). Loaded after `book-3d.js` in `index.html`. v9 of the panel:
the × in the header HIDES it completely (Igor wants to be able to make it disappear),
the **T key** or `BOOK_TUNER.show()` brings it back; header is a `<div>` (the site's CSS
gives every `<header>` element 88 px, which made the collapsed pill tall) and there is
no `backdrop-filter` any more (with border + radius Chrome drew broken corners).

## 4. Implementation notes (three.js r147)

- Book built in its natural frame (width along X, spine at x = −0.5, top of the cover at
  z = −0.69, lying on y = 0); the camera, not the book, is turned to get the photo's
  orientation (v1 rotated the book 90° for the isometric camera). The **cover hinges
  about Z** (`coverPivot.rotation.z`, positive lifts the fore-edge); the very first
  build hinged about X and the cover opened along the wrong edge — do not repeat.
- The cover is a `BoxGeometry` with a material array; only the +y face (index 2)
  carries the artwork (`coverTopMat`, colour white so the texture carries the colour).
- Leaves are `PlaneGeometry` in their own pivots on the spine, 0.0012 apart.
- Floor line: `ShapeGeometry` of a rounded rectangle with a rounded-rectangle hole.
- The canvas is focusable (`tabindex=0`, `role=button`) so the click can also be a
  keyboard action.
- `document.fonts.ready` redraws the cover texture once Poppins is in.

## 5. Shared libraries — `lib/` (new on 2026-09-04)

Igor's rule: anything used by more than one experiment lives at the `experiments/`
level. Moved out of `datacore/anime-datacore/` with `git mv` and re-linked in
`datacore/index.html` and `datacore/index3d.html`:

- `lib/three.min.js` (r147 UMD), `lib/three-post.js` (composer + passes),
  `lib/sprite.js` (placeholder spritemap; rewrites the `<use>` refs).
- `lib/inert-form.css` + `lib/inert-form.js` — the inert form replicas (anti-phishing doc
  rule 9): styles copied from the site's `external-forms-style.css`, scoped under
  `.inert-form`; the JS strips `name`s, sets `autocomplete=off`, blocks Enter and makes
  every button show the "disabled" note. Any experiment whose page had a form uses them.
- `lib/poppins.css` + `lib/fonts/poppins-latin-{400,500,600}-normal.woff2` (OFL, from
  `@fontsource/poppins` 5.x — Google Fonts is blocked from the sandbox, npm is not).
  The site's `fonts.css` points at `/src/assets/fonts/…`, which is never saved offline,
  so every saved page had been falling back to the system font. `3d-book` loads it as
  `<link rel="stylesheet" href="../lib/poppins.css">` after the page's own CSS.
  **The datacore and 3d-globe pages do not load it yet** — one line each if Igor wants
  the real typeface there too.

## 6. Anti-phishing status of this copy

Cleaned with `clean-saved-page.py` (§7) + the sweep from `claude_antiphishing_context.md`
§4: 0 canonical/og/twitter/JSON-LD, 0 scripts other than ours, 0 iframes, 0 forms,
`noindex,nofollow`, 71 outbound `<a>` → `#`, CDN `<source>` srcsets removed, tracking
pixels saved as extension-less files (`out`, `out(3)`, `0`…) removed from the HTML, the
Qualified and OneTrust widget styles/DOM removed. The two Pardot iframes are replaced by
inert replicas (`lib/inert-form.*`, §5): 0 `<form>`, 0 email/password inputs, so the
sweep stays clean. Verified in the browser on the published page: every request is
same-origin (the only 404 is the intentional `/dist/assets/spritemap.svg`, which
`sprite.js` replaces).

## 7. `clean-saved-page.py` — the cleanup as a script

```
python3 clean-saved-page.py <page.html> "<Page>_files" original "<title>" [out.html] --report
```

Implements section 2 of the anti-phishing doc in one go (identity tags, all scripts,
iframes, noscript, pixel `<img>`s, external `<link>` preloads, widget `<style>` blocks
with external urls, the OneTrust div, CDN `<source>`s, links → `#`, robots + our title
and description, assets folder rename). Two things learnt on this page and now handled
by the script:

- **Saved scroll state.** The page was saved while scrolled, so the copy carried
  `class="… nav-hidden"` on the nav wrapper plus an already-cloned CTA: the header
  rendered as just a "Try for free" button. The script drops both so `nav-fx.js`
  starts from the resting state.
- **`--report`** prints which files in `original/` the cleaned page (and its CSS)
  still references and which do not — the second list is what goes into `.gitignore`
  with the `/experiments/<name>/original/` prefix (75 files here).

It is applied to `original.html` in place; `index.html` is then derived from it.

## 8. Open points / ideas for the next pass

- Igor has not tuned v6 yet: `presentV`/`presentTilt` against his sketch (it also has
  a slight roll and a view from a bit higher — `camera.el`), `vAngle`, camera az/el/fov
  against the photo for the closed state, leaf count,
  edge opacity, whether the hover lift stays, and the spread's copy/photos (both
  editable without touching the geometry: `BOOK_SPREAD` and `book-fx/spread/*.jpg`).
- The unwarped cover is ~400 source pixels wide stretched to 1024: soft up close. A
  flat export of the real cover from the client would replace `spread/cover.jpg`
  one-to-one.
- The spread is legible on a retina screen at 1440 px; on the page it is small by
  nature (the hero image is ~540 px wide). A "zoom into the spread" on second click
  would be the natural next step if the content matters.
- The saved page keeps the "■" square before the description (`.white-square`
  relies on a gif under `/src/assets/images/` that was not saved) — cosmetic, same in
  `original.html`.
- Possible variants: the book standing up; the cover fully opening to reveal a
  two-page spread with real content; a stack of the three eBooks from the cards below.

---

## The tuner moved onto the shared kit, 2026-09-13

`3d-book/book-fx/book-tuner.js` (?v=6) is now a knob list on top of `lib/tuner-ui.js`; it builds nothing itself. The
panel is **built on load again, collapsed**, as it was before the 2026-09-09 `?tuner` gate:
the kit's sliders, chips and colour swatches are `<div>`s, so the page still contains zero
`<input>`, `<select>`, `<textarea>` or `<form>` and anti-phishing rule 12 holds. `×` and the
`T` key hide and show it; `?tuner` still works and is now a no-op convenience.

Two behaviours arrived with the move, on every panel in the repo: **double-click a row** to
reset that one knob (the value is amber while it differs from the default), and **the variable
each knob writes to is printed under its label**.

All 29 knob paths were checked to resolve against window.BOOK, and the panel was built in a browser
against the real settings object: every value real, 0 form elements, 0 after "Copy settings".

Read `claude_tunerui_context.md` before changing anything in it, and
`claude_antiphishing_context.md` §8 for why the gate is gone.
