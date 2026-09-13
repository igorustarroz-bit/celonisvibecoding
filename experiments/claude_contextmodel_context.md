# Experiment 6 — Context Model (`experiments/context-model/`)

Replaces the hero video of the client's `/platform/context-model` page with a WebGL study of
the same animation. Saved page cleaned 2026-09-09; the effect ported in on 2026-09-13.

**Published 2026-09-13** (commit `5cc2ced`), as experiment 6 in the root `index.html`.

This overrode a standing recommendation, and the reasoning should stay on the record: a second
Safe Browsing review is open (`claude_antiphishing_context.md` §7, "Open decision"), and the
advice there was to hold a fresh replica back until the warning lifts. Igor decided to publish
anyway, having been told twice. What makes it defensible rather than reckless is that this page
is the first one built clean from the start — rules 12 and 13 were applied before its first
push, not retrofitted: zero data-entry elements, zero cross-origin requests, `noindex`, no link
to the brand's domain, and the saved page's 30-odd tracking files never entered git. If the
warning does come back, this page is not the thing to look at first; the four older replicas
are, and the hosting decision in §7 is still the real answer.

## What it draws

Read bottom to top, which is how the reference animation reads (Igor, 2026-09-11):

1. Scattered dots rise and sort themselves into columns.
2. Where a column meets the underside of a thick glass magnifier it becomes a rounded-square
   chip.
3. Above the lens, a rocket-flame glow — orange on the left, near-white in the middle, blue on
   the right — breathing at two different rates.
4. The data leaves upwards as thin signal traces drawn by bright heads, some with a
   crenellated jog with rounded corners.

Defaults are Igor's own, from the 12th pass of his Copy-settings JSON (2026-09-13, 136
values). Framing, elevation, wall height and the aurora envelope were measured on a
1440 × 1602 reference frame: lens at 83 % of the width, centre at 51 % of the height,
elevation 18.5°.

## Files

```
context-model/
  index.html            the cleaned saved page, with the video block replaced
  original.html         the saved page as it was
  original/             the browser's saved assets (gitignored where they are tracking)
  context-fx/
    context-core.js     the effect            ?v=1
    context-tuner.js    the knob list         ?v=1
    context.css         the block and the box ?v=1
```

Shared, loaded from `../lib/`: `three.min.js?v=14` (r147 UMD — never a CDN),
`tilt-parallax.js?v=1`, `tuner-ui.js?v=1` + `tuner-ui.css?v=1`, `page-shell.css`,
`inert-form.*`, `poppins.css`, `sprite.js`, and `../nav-fx.js?v=28`.

## Stack

The same as experiment 3 (Data Core): three.js with an orthographic camera, our own glass
`ShaderMaterial` with a refraction pre-pass, our own post chain (MSAA on the render targets
where WebGL2 is available, bright pass + two-level bloom, optional FXAA, capped device pixel
ratio), and pointer parallax on desktop / gyroscope parallax on phones.

## The port, 2026-09-13 — what changed from the standalone study

The study was one self-contained HTML file that filled the window and owned the page scroll.
Five changes, and nothing else:

1. **The stage is the page's own block, not the window.** The `<video>` in
   `.video-wrap-autoplay` is gone; in its place `#context-scroll > #context-sticky >
   #context-stage`. Everything that used to read `window.innerWidth/innerHeight` now reads the
   box: `resize()`, the camera aspect, and the pointer parallax, which is measured on the
   canvas rect and only counts while the pointer is actually over it.
2. **The timeline is scrubbed by the block crossing the viewport** — the same shape of driver
   as experiment 1's `test1` (`#gaita`, sticky + spacer, `top top` → `bottom bottom`).
   Lengths are in **box heights**, not `vh`, so the phone address bar resizing the viewport
   cannot jump the sequence.
3. **No scroll hijacking.** The study scrolled the window by itself (`scrollAuto`) if nobody
   touched it. Inside a real page that steals the reader's scroll; it is gone, along with the
   knob. `scrollLead` replaces it.
4. **The phone parallax comes from `../lib/tilt-parallax.js`** instead of an inline copy —
   same ±1 range as the pointer, iOS permission handled there (port note 3).
5. **The tuner is `context-tuner.js` on `lib/tuner-ui.js`** instead of inline, so the panel is
   visible on load and contains no form elements. See `claude_tunerui_context.md`.

`three.js` still feature-detects `WebGLRenderTarget.samples`, so r147 from `lib/` needed no
other change.

## The scroll geometry — the part worth understanding before touching it

```
layoutScroll()          runs first inside resize(), because everything sizes off boxW/boxH
  boxH   = min(width / boxRatio, innerHeight - navHeight() - 32)
  sticky.top    = navHeight()          measured from .nav-wrapper, never hard-coded
  container.height = boxH + travel
  travel = max(boxH * 0.2, timeline - leadPx())
  timeline = (scrollIn + scrollHold + scrollOut) * boxH

leadPx()   how much scrolling happens BEFORE the box sticks and the arrival may start
  = min( (innerHeight - boxH - navHeight()) + scrollLead * boxH,
         timeline * scrollLeadCap )

scrollT()  T = 0 → 1 arrival, the hold sits at 1, 1 → 2 exit
  y = max(0, navHeight() - container.top + leadPx())
```

Three things this shape is fixing, each of which was visibly wrong before it:

- **The lead-in exists** because without it the block is a plain black rectangle for the whole
  ~800 px it spends rising up the screen — `T` is 0 until it sticks, and `T = 0` renders
  nothing. The lead lets the arrival begin while the box is still travelling.
- **`scrollLeadCap` exists** because on a phone the box is a fraction of the viewport, so the
  approach alone (≈ 580 px at 390 × 844) is longer than the whole timeline and the arrival
  would be over before the box ever reached the top. Capped at 35 % of the timeline, a phone
  now sees the sequence from the start.
- **The container is `boxH + travel`, not `boxH × (1 + in + hold + out)`.** Sized the naive
  way the exit finishes `leadPx()` early and leaves a blank box sitting there before it
  unsticks.

**`overflow` on the wrapper.** The saved page sets `overflow: clip` on `.video-wrap-autoplay`.
A sticky child inside a clipping container has nowhere to stick, so `context.css` puts
`overflow: visible` back on that one element. Same family of problem as the rule in
`lib/page-shell.css`: `overflow-x: clip`, never `hidden`.

## Knobs worth knowing

136 of them, in the panel. The ones that came out of this port:

| knob | default | what it is |
|---|---|---|
| `scrollIn` / `scrollHold` / `scrollOut` | 1.2 / 1.0 / 1.2 | timeline, in box heights |
| `scrollLead` | 0.25 | extra lead-in beyond the box's own approach |
| `scrollLeadCap` | 0.35 | most of the timeline the lead may take |
| `boxRatio` | 1.778 | the box's proportion — 16:9, what the video was |
| `boxRatioNarrow` | 0.5 | 1:2 under 700 px — a tall block on a phone |
| `viewWMin` | 2.4 | smallest visible width in world units (see below) |
| `lensMinPx` | 400 | the lens is never narrower than this on screen (0 = off) |
| `scrollPreview` / `scrollScrub` | 0 / 1 | ignore the page scroll and drive `T` by hand |

### The phone format, 2026-09-13

Igor, after seeing the first port: on a phone **the whole animation has to take up more room**
— at 390 px a 16:9 box is a 350 x 197 stamp and the lens reads as a detail. Two changes, which
only work together:

- **`boxRatioNarrow` is 1:2 under 700 px.** The block becomes 350 x 700 at 390 px: a tall
  frame, which suits a composition that is vertical anyway (dots rising from below, traces
  leaving above). `layoutScroll()` still clamps to what is left of the viewport under the
  header, so on a short phone the box simply gets a little wider than 1:2 rather than
  overflowing — a sticky box taller than its scrollport does not stick.
- **`viewWMin` keeps a minimum visible WIDTH in frame.** This is the part that actually makes
  the animation bigger, and without it the 1:2 box would have made it *worse*. The camera is
  orthographic: the visible width is `viewH x aspect`. At 16:9 that is 2.85 x 1.78 = 5.06
  world units and the 2-unit lens fills 40 % of it; at 1:2 it would be 2.85 x 0.5 = 1.43 and
  the lens — 2 units across — would be **cropped**. So `viewHeight()` returns
  `max(viewH, viewWMin / aspect)`: on a narrow box the camera opens up vertically instead of
  cutting the sides off, and the lens holds ~85 % of the width at any proportion. That is the
  share measured on Igor's reference frame, and on a phone it is ~300 px of lens instead of
  ~140 px.

Desktop is untouched: at 16:9, `viewWMin / aspect` is 1.35, well under `viewH`, so the clamp
never fires. Point sizes follow `viewHeight()` too (`uPx` is pixels per world unit), so the
dots do not change size relative to the scene when the clamp does fire.

### …and the hole that left, found the same day

Igor, resizing Chrome on his Mac: the lens is still tiny in a small window. Correct, and the
reason is worth keeping, because it is the trap in reasoning about this in terms of
*proportion*.

**`viewWMin` only fires on a box that is taller than it is wide**, and a desktop window made
small is usually short as well as narrow. `layoutScroll()` clamps `boxH` to what is left under
the header, so on a short window the box goes back to a wide proportion — 720 x 405 at a
760 x 520 window — the narrow branch never gets a chance, and the lens is 40 % of the width
again. Measured before the fix:

```
win        box          aspect  viewH  visW   lens%   lens px
1440x900  1328x747      1.778   2.85   5.07    40%     535
 800x600   736x414      1.778   2.85   5.07    40%     296
 760x520   720x405      1.778   2.85   5.07    40%     290    <- "la lupa enana"
 390x844   350x700      0.500   4.80   2.40    85%     298
```

A fixed `viewH` gives the lens ~40 % of the width of a 16:9 box **at any size of box**, so the
share looks fine while the pixels do not. The complaint was about pixels, so the guard is
about pixels: `lensMinPx` zooms in until the lens is at least that many CSS pixels across.
The cap works out to `lensWorld x boxH / lensMinPx` — it depends only on the box HEIGHT,
which is exactly why it still fires on a window that is short but wide.

The two guards have to be applied in this order, and `viewHeight()` says so:

```js
Math.max( Math.min(CFG.viewH, cap), CFG.viewWMin / aspect )
```

The width floor wins, so the pixel cap can never crop the lens sideways on a phone. After it:

```
 800x600   736x414      1.778   2.11   3.75    54%     400
 760x520   720x405      1.778   2.07   3.67    56%     400
 700x500   660x403      1.638   2.06   3.37    61%     400
1440x900  1328x747      1.778   2.85   5.07    40%     535   (untouched)
 390x844   350x700      0.500   4.80   2.40    85%     298   (capped by the frame, correct)
```

The lens never goes below 400 px except where the box itself is narrower than that, and the
full-size desktop never moves. Zooming in does crop the composition vertically on a short
window — the dots below and the traces above — which is the trade being asked for, and it
already happened at 16:9 anyway.

**There is no caption on the block** (removed 2026-09-13, Igor): the disclaimer lives in the
root index, and a label over the prototype gets in the way of judging it — the same reason the
fixed per-page banner was removed in September.

Console: `CONTEXT_INFO()` prints what is in effect (WebGL2, MSAA samples actually granted, FXAA,
dpr, buffer, trace and particle counts, draw calls, fps). `CONTEXT_SCROLL(t)` drives `T`.
`CONTEXT_BEAMS()` dumps the traces. `window.CONTEXT` is the surface the tuner uses:
`{ cfg, defaults, apply, rebuild, t, info, readout }`.

`rebuild(kind)`: `"lens"` | `"traces"` | `"particles"` | `"impacts"` | `"targets"`. A knob
declares which one it needs as the 6th item of its SPEC entry; the tuner passes it through as
the `extra` tag and `onChange` calls it.

## Two things that cost time on 2026-09-13

**The `?v=` was not bumped after the second round of edits**, so Chrome on the Mac kept
serving the old `context-core.js?v=1` from cache and none of the changes appeared locally.
This is in the repo notes for GitHub Pages and it bites just as hard from `file://` and from a
local server. The context-fx assets are at `?v=2` now. Bump on every change, without waiting
to be told the page looks unchanged.

**`device_commit_files` reported `written` while the file on disk stayed at the old version.**
Caught by grepping the deployed file for a string that only exists in the new one: `wc -c`
said 92698 where the source said 94003. A second commit with `force: true` wrote it properly
and the md5 then matched. **Verify a commit by checksum or by size, not by the tool's own
success message** — a silent stale write looks exactly like a bug in the code you just wrote,
and will send you hunting in the wrong place.
## Verified 2026-09-13 (all three passes)

Headless Chromium against a served copy, at 1440 × 900 and at 390 × 844 (`isMobile`):

- Canvas 1328 × 747 (1.778) and 350 × 700 (0.500 exactly); sticky resolves to
  `position: sticky` with `top` = the measured nav height (89 px / 65 px); wrapper
  `overflow: visible`.
- `T` runs 0 → 2 across the block at both sizes, and the box unsticks as the exit ends.
- `scrollWidth === innerWidth` at every one of 11 scroll samples, both sizes — no overflow.
- WebGL2 with MSAA 4× actually granted; 56 fps at 1440 and 51 fps at 390 under SwiftShader,
  which is the slow path.
- `input,select,textarea,form` → **0**. `performance` resources → **100 % same-origin**. No
  page errors.
- Panel: 137 rows, every one with its variable printed underneath; a drag turns the value
  amber, a double-click puts it back.

Remaining 404s are same-origin and intentional: `/dist/assets/spritemap.svg` (placeholder
icons, rewritten by `lib/sprite.js`) and the assets not copied into the test tree.

## Open

- **The hosting decision is still open** (`claude_antiphishing_context.md` §7): these are
  full-page replicas of a live commercial site on a heavily crawled host, and every fix so far
  has only made that input slightly less suspicious. Moving to Cloudflare Pages behind Basic
  Auth on `labs.hanzo.es` remains the answer that removes the problem instead of reducing it.
- **Submit the Safe Browsing review** — the text is written and kept in the appendix of §7.
- **On desktop the composition still sits small in the 16:9 box**, with space left and right
  — it was framed on a portrait reference (1440 × 1602). The phone now fills its frame via
  `viewWMin`; the same lever would work on desktop by raising `viewWMin` past 5.06, but that
  crops the top and bottom of a 16:9 box, so reframing there means `viewH`, `camY` and
  `camEl`. A design decision for Igor, not a bug.

## Publish log

- **2026-09-13** — first push, commit `5cc2ced`. Verified on the published URL in a browser:
  `input,select,textarea,form` -> 0, `performance` resources 100 % same-origin, `noindex`
  present, no `<a>` to the brand's domain, no `<video>` left in the page, the tuner panel
  present and collapsed with 139 rows. The only 404 is the intentional same-origin
  `/dist/assets/spritemap.svg`, which `lib/sprite.js` rewrites.
  Layout and pixels were verified in headless Chromium at nine window sizes before the push,
  not on the live host: the built-in browser pane reports a 0 x 0 viewport and
  `document.hidden = true`, so it is good for JS state and network and useless for geometry.
