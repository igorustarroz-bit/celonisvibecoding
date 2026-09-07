# Experiment 5 — Celosphere 2026 event page (`celosphere/`)

> Lives in `experiments/` like every other `claude_*_context.md`; paths below are relative
> to `experiments/`. Process reference: `claude_newexperiment_context.md`. Anti-phishing
> rules: `claude_antiphishing_context.md`.

**Status (2026-09-07): FINISHED and PUBLISHED** (v21 of `seal-knit.js`, Igor's approved values).
Published at `https://igorustarroz-bit.github.io/celonisvibecoding/experiments/celosphere/index.html`
and linked from the root index as Experiment 5. Igor's rule for this experiment while it was
being built was "nothing goes to GitHub until it is finished locally"; it was finished and pushed
in one go on 2026-09-07. Anything new goes through the tuner → Copy settings → paste into `SEAL`.

## 1. What is in the folder

```
celosphere/
  original.html                 saved page, cleaned (anti-phishing) — the reference copy
  index.html                    working copy for the experiment (identical to original.html today)
  original/                     the browser's "<Page>_files/" folder, renamed (387 files,
                                45 of them referenced and publishable; the rest is gitignored)
  celosphere-fx/
    secondary-menu-lite.js      sticky sub-nav: desktop row / phone dropdown (see §4)
    people-module-lite.js       "Speaker sneak peak": photo follows the pointer (see §4)
    carousel-lite.js            quotes carousel ("You arrived excited…") (see §4)
    seal-data.js                geometry of the seal extracted from the client's PNG (§6)
    seal-knit.js                THE EFFECT: scroll-driven knit + travel into the hero (§7)
    seal-tuner.js               tuner panel for seal-knit (Igor's rule)
  (shared, in ../lib/: plex-mono.css + fonts/ibm-plex-mono-latin-500-normal.woff2 — the
   digits' face; index.html loads it after poppins.css)
```

Source page: `https://www.celonis.com/celosphere` ("Celosphere 2026 | Celonis RoAI Conference"),
saved by Igor with Chrome → "Webpage, Complete" on 2026-09-07. No hero video on this page:
the hero is a dark section with a dotted texture, the "Celosphere 26" seal, a countdown card
("Celosphere starts in 84 days", frozen at save time — it was JS-driven) and a "Get your
ticket" CTA. Other blocks on the page: `secondary-menu` (sticky sub-nav), `square-value`
(the "Leave with RoAI → Come for AI" marquee), `question` + `collapse-expand` (accordion),
`basic-module` (Game Changer Awards), `people-module` (speakers, `load-more`), `cards plans`
(ticket prices), `career-benefits`, `cards carousel insights`, `quotes carousel`, footer with
newsletter `pnf`, and four `<dialog class="modal">` fragments (see §3).

`original/260624_Celosphere26_Website-Meta-Image_JH_V1_1620x1212.avif` is the page's social
image, saved separately by Igor — kept and NOT gitignored (client artwork, may be useful for
the effect), although the page does not reference it.

## 2. Cleanup applied (anti-phishing, section 2 of the doc)

```bash
cd experiments/celosphere
python3 ../clean-saved-page.py original.html "Celosphere 2026 _ Celonis RoAI Conference_files" \
  original "Vibecoding prototype - Celosphere 2026 event page (unofficial)" --report
```

Then a second, page-specific pass (kept as a one-off script, not in the repo) that the
generic script does not cover — worth folding into `clean-saved-page.py` if it shows up again:

- **Qualified chat widget DOM**: `<q-root data-q-host>…</q-root>`,
  `<q-focus-sentinel>…</q-focus-sentinel>` (with Spanish aria-labels "AI asistente" — the
  saved browser was in Spanish; the UI must have no Spanish) and the widget's
  `<style>#q-messenger-frame-skip-link…</style>`.
- **Bing UET beacon**: `<div id="batBeacon…">`.
- `<style>.imageye-selected…</style>` — a browser-extension artefact, not the site's.
- Inert form replicas (rule 9) put back where the four Pardot iframes were, built from the
  fields of the saved iframes (`3nkvm5.html` newsletter, `3nr2y5.html` livestream ×2,
  `3p5xz7.html` interest): markup as in `3d-book/`, shared `../lib/inert-form.css/.js`,
  every input `type="text"`, no `<form>`, no `name`, consent copy says "the company".
- **Cvent ticket registration** (`register.html`, iframe of `web.cvent.com/embedded-registration/…`,
  a paid checkout with prices and a payment step): NOT replicated — replaced by a neutral
  stub `<div class="inert-embed">` "Third-party ticket registration widget disabled in this
  unofficial design prototype." A fake checkout is exactly what must never be published.
- `<link rel="stylesheet" href="../lib/poppins.css">` + `../lib/inert-form.css` before
  `</head>`; before `</body>`: `../lib/sprite.js?v=15`, `../lib/inert-form.js?v=1`,
  `./celosphere-fx/secondary-menu-lite.js?v=1`, `../nav-fx.js?v=28`.

Verification sweep (section 4, both passes) on `original.html`/`index.html`: CLEAN — no
canonical/og/twitter/ld+json, no iframe, no `<form>`, no email/password inputs, robots
noindex present, zero `<a href>` to http/`//`/`/`, no saved-page scripts, no external
src/srcset, no pixels. The only absolute URL left is the `<!-- saved from url=… -->` comment
that every saved page keeps. Headless Chromium (1440×900, 390×844, and `file://`): every
request same-origin; the two same-origin 404s are the known `/dist/assets/spritemap.svg`
(rewritten by `lib/sprite.js`) and `/src/assets/fonts/Poppins-Regular.woff2` from the site's
`fonts.css` (Poppins comes from `lib/poppins.css` instead — computed font-family confirmed).
24 images, none broken, from http and from `file://`.

`.gitignore`: block "experiment 5 (celosphere)" with 342 rules
`/experiments/celosphere/original/<file>` — everything the `--report` listed as unreferenced
(tracking JS, the iframe HTML files, Cvent CSS chunks, the 250+ Twemoji flag SVGs of the
country selector). `git add --dry-run -A experiments/celosphere` → 47 files: the two pages
and 45 assets (17 images + 27 CSS + the .avif).

## 3. Things to know about this page (gotchas)

- **nav-fx does not activate here, by design.** `nav-fx.js` returns early when
  `.secondary-menu-container` exists (see `claude_navfx_context.md`). On this page the
  secondary menu is `position: sticky` (`top: 0` in extensive/desktop mode, `top:
  var(--nav-height)` in compact mode) and takes over the role of the persistent bar. If the
  experiment needs the header to hide on scroll, that is a new behaviour, not a nav-fx bug.
- **The secondary menu's layout mode is set by JS, not CSS.** The saved DOM carries
  `secondary-menu-extensive` on the section (row of links, `secondary-menu-selection`
  hidden). The site's `dist/blocks/secondary-menu/secondary-menu.js` toggles that class at
  runtime: compact (selection row + dropdown) when `isMobile() || isTablet() ||
  (isDesktop() && links > 6)`. With all site JS removed, phones showed the links squeezed into
  vertical letters → `celosphere-fx/secondary-menu-lite.js` (§4).
- **The four modals never open in the prototype.** They are `<dialog class="modal">`
  fragments at the end of `<main>`: `#register` (Cvent ticket checkout → stub),
  `#modal-get-your-celosphere-livestream-ticket` (+ Japanese twin) and
  `#~~celosphere-26-~~save-the-date-2026` ("Register your interest"). The site opened them
  from `href="…/celosphere#register"` links via its modal JS; the cleanup turned those hrefs
  into `#`. The five "Get your ticket" CTAs are therefore inert. If the experiment needs a
  modal, reimplement `dialog.showModal()` on the `data-modal-hash` sections — but keep the
  ticket checkout as the stub.
- The countdown ("84 days") is static text now; if it stays in the design, drive it from
  `new Date('2026-12-02')` in our own JS.
- Everything else interactive on the page (accordion, speakers "load more", language and
  country selectors, the insights cards carousel — which has only 2 cards, so the site
  rendered no arrows for it) is static, as in every other experiment: only the layout CSS
  survives the cleanup. Reimplement in vanilla JS whatever the effect needs. Restored so far
  (Igor asked for them on 2026-09-07): the speaker photo that follows the mouse and the
  quotes carousel — §4.
- `main > div { margin: 40px 16px }` and the 88 px header (64 px on phones) apply here as on
  every saved Celonis page — see `claude_newexperiment_context.md`.

## 4. `celosphere-fx/secondary-menu-lite.js` (v1)

Minimal re-implementation of the block's runtime switch: on load and on resize (debounced
250 ms) it sets `secondary-menu-extensive` when `matchMedia('(min-width: 1200px)')` and there
are ≤ 6 links; otherwise compact mode with `.secondary-menu-links.hidden` until the selection
button is clicked (`open` on the section — which draws the dark backdrop via
`.secondary-menu-container.open:after` — and on the button, which swaps the +/− icon).
Clicking a link closes it. Verified at 390, 1024 and 1440 px wide. Bump the `?v=` in both
pages whenever it changes.

### `celosphere-fx/people-module-lite.js` (v1)

Port of the runtime part of `celonis.com/dist/blocks/people-module/people-module.js`
(functions `b`/`x`/`S`/`k` in the minified source; `a()` from `device.js` taken as
"desktop ≥ 1200px", `p(x, 10)` from `core.js` as a 10 ms throttle). The CSS already does
the reveal on `:hover` (`visibility`, the `picture:after` curtain sliding down, the
`mix-blend-mode: difference` name, the other rows dimmed to .3); the JS only moves the
photo: `<p>` holding the `<picture>` gets `translate: X% Y%` where
`X = (pageX − pictureLeft) / pictureWidth × 100` clamped to **[−100, 0]** (the photo
follows the pointer only leftwards, up to its own width) and
`Y = (pageY − pictureTop) / pictureHeight × 100` clamped to **[0, 25]**. The last two
visible rows carry `.person.last`: their photo is anchored above the row (`bottom: 100%`)
and Y is measured from the picture's bottom edge and clamped the other way round
(`y > 0 → 0, else y < 25 → 25` — copied as is, that is what the live code does).
`translate` animates with the site's `--fnd-motion-duration-informative-slow` (.6s
linear). The picture's page position is cached in `data-left` / `data-top` /
`data-bottom` on the first move (the picture itself moves, so it cannot be re-measured);
we clear that cache on resize. `mouseleave` → `translate: 0 0`. Verified at 1440×900:
photo appears on hover, x runs 1046 → 845 px over .6 s when the pointer is left of it,
Y follows between 0 and 25 %, `.last` rows show the photo above.

### `celosphere-fx/carousel-lite.js` (v1)

Port of `celonis.com/dist/chunks/carousel.js` working on the DOM the site had already
built (slides `ul > li.carousel-slide-width-N`, `.carousel-line` strip, prev/next
buttons). `slidesWidth` is read from the first slide's class (12 for the quotes = one
slide per view; the insights cards have 4 but only 2 cards → 1 "swap" → no nav, like the
site). Kept from the original: `ul.style.translate = -(|x_new − x_prev| × index) px`
(1384 px per step at 1440 = 1328 slide + 56 gap), `.active` + `aria-hidden` +
`tabindex=-1` on off-screen slides, prev disabled at 0 / next disabled at the last swap,
active `.carousel-line` follows the index (and the strip scrolls on phones when > 4
lines), swipe/drag with the 50 px `screenX` threshold, autoplay via the line's
`animationend` (ported, unused here), phone (< 768 px, 4-column grid) slides re-classed to
`carousel-slide-width-4`. Extra: the first quote's word-by-word reveal (`.p-quote.visible`,
spans with staggered `animation-delay`) is re-armed on an IntersectionObserver so it plays
when the block scrolls into view instead of at page load. Verified: 5 slides forward and
back at 1440 and 390, swipe/drag in both directions, no console errors.

## 5. How the effect was decided (2026-09-07)

Two moodboards (Claude artifacts, English): the first turned the seal into a sphere — **Igor
rejected every sphere idea, do not propose it again**. The second started from the four
illustration principles of the Celonis brand guide (Data dump, Connective tissue, Stepped
connections, Lines and particles) with the seal kept flat. Igor picked **"Knit, then unravel"**
with these conditions: respect the original seal exactly (its thick-to-thin stripes, the
circle, the digits), digits appear with a count-up or a Matrix-style code effect, the page
starts with a scroll-driven formation of the seal in the foreground that ends in the seal's
place in the hero, and the whole thing plays in reverse when scrolling up.

## 6. `seal-data.js` — the seal's geometry, extracted from the artwork

Igor's rule: the original artwork, not an invented replica. So the 57 stripe segments and the
37 numbers come straight out of `original/260511_Celosphere 26_Logo_KIT_RGB_Logo_white_RGB_Large.png`
(6251×6251, white on transparent): alpha > 128 → mask → `scipy.ndimage.label` → 113
components. Rotated frame `u = (x − y)/√2, v = (x + y)/√2`: a component whose pixel count
fills > 80 % of its (u-extent × v-extent) box is a stripe (57); area < 2000 px² is the dot of
a dotted zero (5); the rest are digit glyphs (51, all ≈ 115×167 px). Glyphs on the same line
closer than 1.6 glyph widths form one number (37); the values were transcribed by hand from a
labelled render and checked against the artwork. Circle = the stripes' bounding box
(centre 3112, 2540 px; R = 2288 px). Facts that matter for the look:

- Stripes sit on 19 rows at a pitch of ≈ 0.143 R; **thickness is a gradient**, from 0.079 R at
  the upper left to 0.015 R at the lower right — not two classes, a slope. Kept as measured.
- Segments have square-cut ends → `lineCap = 'butt'`.
- Digits: mono face with a dotted zero and a flagged, seriffed 1. The site has no mono face,
  so `lib/plex-mono.css` ships IBM Plex Mono 500 (OFL, from `@fontsource/ibm-plex-mono`),
  the closest match; glyph height 0.0734 R (→ font-size ≈ 1.43 × that), advance 0.0626 R.
- `imgBox` = where the circle sits inside the square PNG (cx 0.4978, cy 0.40625, r 0.366 of
  the side): the saved page's `<img>` is that PNG in a 200 px (160 px on phones) square with
  `object-fit: cover`, so the target circle on screen is `img.left + 0.4978·w`,
  `img.top + 0.40625·h`, `R = 0.366·w`.
- The "Celosphere 26" wordmark is a crop of the PNG (1400 px wide, PNG data URI, 45 KB) with
  its box relative to the circle — the original artwork, not text.

## 7. `seal-knit.js` (v21) + `seal-tuner.js` — the effect

- A spacer `#seal-intro-space` (`introVH` = 1.5 viewport heights, `margin: 0`, black
  background — the page's base colour is white, only the hero wrapper is dark) is inserted at
  the top of `<main>`; the original `<img>` is kept in the layout but `visibility: hidden`.
- One fixed `<canvas>` (`z-index: 8`, under the fixed header's z-index 9 context,
  `pointer-events: none`). Everything is a pure function of `T = scrollY / spacer height`, so
  scrolling up is the exact reverse; nothing is clock-based.
- **Knit** (T 0 → `knitEnd` 0.52): each segment grows from its lower-left end; start order =
  its position along the stripe direction (mixed 15 % with the row, `orderMix`), duration
  `growDur` 0.28 of the knit. Numbers appear `digitLead` after the front passes; for
  `flickerLen` they either cycle random digits at `flickerRate` Hz (`digitMode` 1, Matrix) or
  count up from 0 with an out-cubic (`digitMode` 0), then settle.
- **Travel** (T `knitEnd` → 1): centre and radius interpolate (80 % eased) from the foreground
  (`fgRadius` 0.34 × min(vw, vh), centred) to the live target circle measured from the `<img>`
  each frame; the black stage fades between `bgFadeStart` 0.55 and `bgFadeEnd` 0.85, the
  wordmark fades in from `wordmarkFrom` 0.72. At T ≥ 1 the seal is drawn at the img's live
  position, so it scrolls with the hero; when off screen nothing is drawn.
- **Auto-play**: at T = 0 the page is an empty stage, so if nobody scrolls within 0.5 s the
  script scrolls the page itself to the end of the knit over `autoPlayMs` 2.6 s (same code path
  → still reversible); wheel / touch / key / pointer cancels it. Off in the tuner if unwanted.
  ⚠️ `window.scrollTo` must use `behavior: 'instant'`: the site sets
  `html { scroll-behavior: smooth }`, and `'auto'` follows that CSS, so per-frame scrolls
  stalled and jumped (found on 2026-09-07).
- **v2 (same day, Igor's adjustments):**
  - *Pointer / tilt reaction* (`SEAL.hover`, digits part superseded by v3 below): the pointer is read from the window (the canvas
    has `pointer-events: none`) and converted to seal units against the seal's current
    centre/radius every frame, so it works in the foreground and after landing. Stripes swell
    under the pointer (`thick` ×1.5) and thin out away from it (`thin` ×0.55), by
    point-to-segment distance within `radius` 0.75 R, smoothed per frame. Digits far from
    the pointer (beyond `rollDead` 0.2 R) ROLL DOWNWARD like a Matrix column — the glyph
    slides out of a clipped box while a random one comes in from above — at up to
    `rollSpeed` 7 glyphs/s and dimmed to `rollFade`; the near ones stay readable. Settling
    finishes the current step so the TRUE value is the one that lands, and the knit's own
    flicker has priority while it runs. The whole reaction fades to nothing once the pointer
    is more than `reachOut` 0.6 R beyond the rim — otherwise a pointer anywhere on the page
    thinned every stripe and rolled every digit (first attempt, fixed). Touch: a finger acts
    as the pointer while down plus 0.9 s. Phones: `../lib/tilt-parallax.js` (loaded before
    seal-knit) feeds a virtual pointer at `tiltReach` 1.2 R × the tilt, same code path.
  - *Foreground position*: the seal forms at `fgX` 0.66 of the viewport width on ≥ 768 px
    (`fgXMobile` 0.5 on phones), no longer centred.
  - *Hero parallax* (`SEAL.parallax`): during the travel the h1, the dates
    (`.extra-section`), the countdown card (`.square-wrapper.rotation-ready`) and the CTA
    (`.buttons-container`) rise into place from `dist` viewport heights below at different
    `speed`s (progress = travel × speed, smoothstep) and fade from `fadeFrom`; at T ≥ 1 the
    inline styles are cleared so the layout is exactly the original. The site's own entrance
    keyframes on those elements (`move-up`, per-span h1 delays) are disabled with an injected
    `animation: none !important`, since they would fight the inline transforms.
  - **v3 corrections from Igor (same day):** (a) the digits do not roll random glyphs — they
    **count DOWN from their own value toward 0 and stop at 0** ("the starting value matters"):
    with the pointer on the seal every digit steps down, far ones at `countSpeed` 6 steps/s,
    central ones (within `countDead` 0.15 R) at `countBase` 0.15 × that; each step is drawn as
    the higher value sliding down out of a clipped box while the lower comes in from above;
    when the pointer leaves they count back UP at `restoreSpeed` 5 until the artwork's value.
    Two-digit numbers keep their width ("07", "00"). (b) The seal **forms in the centre**
    (`fgX` 0.5) and then travels right to its slot, making way for the title, which has to
    arrive almost together with it; all hero elements travel MUCH further: `h1Dist` 1.1 vh
    (speed 1.0 = arrives with the seal), dates 1.5 vh (1.05), card 0.9 vh (0.95), CTA 1.8 vh
    (1.1), `fadeFrom` 0.
  - `?v=`: seal-knit 3, seal-tuner 3 (sliders renamed: count-down speed, central digits ×,
    central zone, restore speed, stepping alpha; parallax distances up to 3 vh), seal-data 1,
    tilt-parallax 1.
- `prefers-reduced-motion`: spacer 0, T = 1, seal static in the hero.
- Tuner (`seal-tuner.js`, same glass pill as the book/Data Core, T key, Copy settings,
  Reset): a **scrub slider that drives the real page scroll**, timeline, digits, geometry, and
  the antialias section — Canvas 2D has no MSAA/FXAA, so the controls are `quality.dprMax`
  and `quality.softBlur`, and the read-out (`SEAL_INFO()`) shows the dpr, canvas pixel size,
  blur and target radius really in effect. `SEAL_SCROLL(T)` jumps the page to a T.
- Verified (headless Chromium, http and `file://`, 1440×900 and 390×844): landing matches the
  img circle by construction (target measured from the DOM), reverse scrub identical, no
  console errors of ours, all requests same-origin. Igor still has to tune the values visually.

### v2 → v11 (same day, Igor's corrections — the current behaviour)

- **Three frames, not two.** Igor supplied the frames: (1) the seal knits CENTRED on the black
  stage, alone; (2) the seal slides RIGHT at full size (`fgX2` 0.735, `fgY2` 0.52) while the
  title "Celosphere 2026" slides in from the left edge, vertically centred, still on black;
  (3) everything settles into the untouched hero: the seal shrinks into the img circle, the
  title rises to its layout slot, CTA / dates / countdown card rise in from below
  (`parallax.*Dist` in vh, `*Speed`), the stage fades (0.78–0.96) and the wordmark fades in.
  Timeline (v11): expressed as phase LENGTHS in viewport heights — `knitVH` 0.85 and `hold1VH` 0.25 (Igor's tuned values, v20 — knit went 0.8 → 1.6 → 0.85,
  hold 1.2 → 0.5 → 0.25), `shiftVH` 0.5, `hold2VH` 1.2, `settleVH` 0.7 (spacer = the sum, 3.5 vh). The two holds are
  dwell ranges where nothing moves while the visitor keeps scrolling: Igor asked for the seal to
  "hold about 3 s more" after it forms and after it sits right of the title; 1.2 vh of scroll is
  roughly that at a normal pace. Phase boundaries come from `marks()`. (v1–v10 used `introVH` +
  `knitEnd` / `shiftEnd` fractions.) Phones: frame 2 puts the seal lower
  (`fgY2Mobile`) and the title above it (`titleYMobile`). v5: the title rises FROM BELOW the
  viewport to the centred position (Igor: not from the left). v6: during the settle the title
  HOLDS the vertical centre and only moves when its layout slot scrolls up to meet it
  (`viewportY = min(centreY, naturalY)`) — an eased lerp toward the natural position first
  moved it DOWN (the slot starts below the viewport), which Igor rejected.
- **Title positioning**: the h1 is moved in viewport terms — natural rect = live rect minus the
  translate applied last frame — so frame 2 is independent of where the hero sits in the
  document. Two things had to give for that: `.hero-landing{overflow:hidden}` clips a child
  moved outside its box, and the fixed canvas (z 8) painted the black stage OVER the hero
  text. Both are handled by `body.seal-stage` (present while T < 1):
  `.seal-stage .hero-landing{overflow:visible;position:relative;z-index:9}` — text above the
  stage, the wrapper's dotted background still under it. The class is dropped at T = 1.
- **Pointer reaction (v15 — replaces the counting digits of v3–v14).** Digits are ALWAYS white
  and keep their value. Stripes keep the width reaction: ×`thick` 1.5 under the pointer, ×`thin` 0.55 far from it,
  PROPORTIONAL to each line's own thickness. (v18 tried an absolute width under the pointer so the
  thin lower-right lines would fatten as much as the thick upper-left ones — a ×1.5 adds 0.04 R
  to a 0.079 R line but only 0.007 R to a 0.015 R one; Igor asked for it, saw it, and asked to
  undo it: "it was better before". Do not retry.) and, in addition, "un-form" toward the rim: the closer the pointer is to the
  edge of the circle (`edge` = 0 inside `flyEdge` 0.25 R → 1 at the rim), the more each ROW slides
  out along its own stripe the way it arrived in the fly-in (odd rows toward bottom-left, even
  toward top-right), up to `hover.fly` 0.45 R; rows near the pointer move `flyNear` 1×, rows far
  from it `flyFar` 0.1×, "near" fading out over `flyRadius` 0.3 R across the rows (v16 — with the
  general 0.75 R radius the whole seal opened evenly; Igor wanted the zone under the pointer to
  open clearly more than the rest). The weight uses the pointer's distance to the ROW line (not to
  the segment). v17 — within a row the movement is mostly a **stretch around the pointer**
  (`stretchMix` 0.8): each item shifts by `amount × tanh((u − pu) / stretchWidth 0.22)`, i.e. items
  beyond the pointer move up-right and items before it down-left, saturating with distance, so the
  gap right under the pointer opens widest and the far parts of the row barely stretch (they
  translate). The remaining 0.2 is the rigid shift in the row's formation direction. **Why a
  stretch and not a bump:** Igor asked for the near part to move more than the far part of the
  same row; a bump that moves the near part more in ONE direction would drive it into its
  neighbours — the tanh field is monotonic along the row, so gaps only ever widen and order is
  preserved (digits, mapped by the same function at their own u, stay in their gaps). Collision-free
  by construction, like the fly-in ordering. Smoothed per row; pointer off → everything eases back. Gated by
  `reachOut` and by K ≥ 1 as before. Touch / tilt as before. History: v3 count-down, v5 up/down by
  distance with shade by value, v8 shade by distance, v9 0.3 s restore — all superseded.
- **Phones, v21**: the dates block ("Main Conference December 2 → 3…") used to rise straight
  through the seal during the settle. Now on < 768 px the seal reaches its slot at
  `mobile.sealLandAt` 0.7 of the settle (its travel progress is `u / sealLandAt`, clamped) and only
  then do the dates slide in FROM THE LEFT over the remaining 0.3 (`mobile.datesDist` 0.7 vw,
  linear with the scroll, fading in). Desktop unchanged.
- Auto-play scrolls to the end of the knit (`autoPlayTo` −1 = knit end) and stops.
- The pointer reaction is off until the seal is fully formed (K ≥ 1) — Igor, v11.

## 8. Publish log and next steps

Published 2026-09-07: root `index.html` block "Experiment 5" (links open in a new window, the
`original.html` link labelled "Saved original (static seal)"), README updated (`celosphere/`,
IBM Plex Mono in `lib/`), both anti-phishing sweeps clean, `git add -A` (the celosphere folder,
this doc, `lib/plex-mono.css` + the woff2, `.gitignore`, index, README), push with the token.

1. Igor has tuned twice (2026-09-07: v12 `hold1VH` 1.2 → 0.5; v20 `knitVH` 1.6 → 0.85 and
   `hold1VH` 0.5 → 0.25); every other shipped `SEAL` value is his approved one. Further rounds: tuner → Copy settings
   → paste here.
2. Open points: digit face (Plex Mono vs the artwork's), whether the countdown card should
   also be part of the sequence, the empty stage at T = 0 (auto-play covers it today).
3. Only when finished: add the `<article class="exp">` block to the root `index.html`
   ("Experiment 5"), run both sweeps, `git add -A` (the lib font + css are untracked too),
   commit, push with the token, then check the published page's network panel (all
   same-origin) and `file://`.
