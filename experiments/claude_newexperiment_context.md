# How to build a new experiment — the process, end to end

> This document lives in `experiments/` alongside the other `claude_*_context.md` files.
> **Paths in this doc are relative to `experiments/`.**
> It is the ENTRY POINT: if you are setting up a new experiment, start here.

Every experiment follows the same path: **save the client page from the browser**,
apply the **anti-phishing cleanup**, apply the **nav-fx**, build the new effect on top
of it, and link it from the index.

Docs to keep at hand (not duplicated here):
- `claude_antiphishing_context.md` — mandatory cleanup rules + verification sweep.
  **Not optional**: on 2026-09-02 Google flagged the site as deceptive because this
  was skipped.
- `claude_navfx_context.md` — the menu effect, shared by all pages.
- The doc of whichever experiment you copy the mechanics from (`claude_globe_context.md`,
  `claude_datacore_context.md`, `claude_3dbook_context.md`, `claude_videoscroll_context.md`).
- Shared libraries live in `lib/` (three.min.js, three-post.js, sprite.js, Poppins,
  IBM Plex Mono, gsap.min.js + ScrollTrigger.min.js 3.5.1, tilt-parallax.js, inert-form.*,
  page-shell.css): load them as
  `../lib/...`, never copy them into the experiment folder and never load them from a CDN
  (every request must be same-origin, and the pages must work from `file://`).

---

## 1. Save the page from the browser

In Chrome, on the real page (e.g. `https://www.celonis.com/<path>/`):
`Cmd+S` → format **"Webpage, Complete"**. This produces two things:

```
<Page name>.html
<Page name>_files/        CSS, layout JS, images, video
```

- Do **not** use "HTML Only" or print to PDF: without the layout CSS/JS and the assets
  the prototype cannot be judged in context, which is its whole purpose.
- Save directly inside the new experiment folder (step 2).
- If the page has a hero video, check that the `.mp4` was downloaded: it is the
  reference for contrast and pacing when replicating it.

## 2. Folder and naming

The folder is named after **what the experiment IS**, in English and in kebab-case,
never after the client page (`3d-globe`, not `celonis-home`).

```
experiments/<experiment-name>/
  original.html        UNTOUCHED copy (with video), only stripped of tracking
  index.html           working copy: the experiment goes here
  original/            the browser assets (the `<Name>_files/` folder, renamed)
  <topic>-fx/          our own JS (or anime-<topic>/, as in the current ones)
```

Both pages (`index.html` and `original.html`) share the assets folder, so they can be
compared side by side: the original with video and the replica.

⚠️ Historical variation: `datacore/` kept the browser names
(`Data Core _ Celonis.html` + `Data Core _ Celonis_files/`) and `3d-globe/` renamed the
folder to `original/`. For new experiments, use `original/`.

## 3. Anti-phishing cleanup — BEFORE the first push

Apply **all** of section 2 of `claude_antiphishing_context.md`. Since 2026-09-04 there
is a script that does it in one go — run it first, then check the list below:

```bash
cd experiments/<name>
python3 ../clean-saved-page.py original.html "<Page name>_files" original \
  "Vibecoding prototype - <what it is> (unofficial)" --report
```

`--report` prints the files in `original/` that the page no longer references: that
list goes into `.gitignore` with the `/experiments/<name>/original/` prefix. The script
also resets the nav to its resting state (a page saved while scrolled carries
`nav-hidden` + a cloned CTA) and removes the widget styles/DOM (Qualified, OneTrust).
Details in `claude_3dbook_context.md` §7. The most frequently forgotten items, in
order of risk:

1. The `<script type="application/ld+json">` blocks (they declare the brand identity).
2. `<link rel="canonical">` and the `<meta property="og:*">` / `<meta name="twitter:*">` tags.
3. `<meta name="robots" content="noindex,nofollow">` + our own `<title>`/`description`
   (`Vibecoding prototype - <what it is> (unofficial)`).
4. Every `<a href>` starting with `http`, `//` or `/` → `href="#"`. The
   **login and signup ones first** (copied branding + login link = textbook phishing).
5. Remove form and chat iframes, and **all** analytics scripts and pixels, including
   inline snippets. Keep `aem.js`, `scripts.js`, `main.*.js`, `*.chunk.js` (layout,
   not tracking). Where the page had a form, put back an **inert visual replica**
   (`../lib/inert-form.css` + `../lib/inert-form.js`, markup as in `3d-book/`): the
   form must look and feel real but have no `<form>`, no `action`, no `name`s, no
   email/password types — Igor's rule, details in the anti-phishing doc rule 9.
6. Tracking files are NOT deleted from disk: `git rm --cached` + an explicit rule in
   `.gitignore` (the `.gitignore` paths carry the prefix
   `/experiments/<name>/...`; renaming or moving a folder means updating them).
7. Do **not** put a banner on the experiment page; the disclaimer goes only in the index.

Plus the **verification sweep** from section 4 of that doc before every push, and the
browser check that all network requests are same-origin.

## 4. Apply nav-fx

Add to **all** saved pages in the folder (index and original), right before `</body>`:

```html
<script src="../nav-fx.js?v=N"></script>
```

- The script is single and shared: `experiments/nav-fx.js`. Do not copy it into the folder.
- Requirement: the saved `header.css` must already contain `.nav-hidden` and
  `.cloned-cta` — celonis.com's does; if a new page does not have them, see
  `claude_navfx_context.md`.
- When you touch the JS you must **bump the `?v=`** on all 6+ pages: Pages caches for
  about 10 min.

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

## 4b. Page shell — one wrapper around everything in `<body>` (Igor's rule, 2026-09-07)

Every experiment page (`index.html` and its variants, not `original.html`) wraps ALL of its
body content in one `<div class="page-shell">` and loads `../lib/page-shell.css`:

```html
<link rel="stylesheet" href="../lib/page-shell.css">   <!-- in <head> -->
…
<body class="…"><div class="page-shell">
  … everything the saved page had in <body>, plus our <script>s …
</div></body>
```

```css
.page-shell { position: relative; width: 100%; max-width: 100%; overflow-x: clip; }
```

Why: on phones the browser sizes the layout viewport to the widest content. Anything an
effect pushes past the right edge — a parallax riser, a fly-in, a card waiting off-screen —
widens the document, and the phone zooms the WHOLE page out, then back in when the element
arrives ("the page gets big and small", Igor, celosphere v21: the countdown card translated
right by 0.4 vw made a 390 px page 504 px wide during the sequence). The shell clips the
horizontal overflow at the document level so the layout viewport stays at the device width
and every page behaves the same. Rules of the shell: `overflow-x: clip`, NOT `hidden`
(hidden would make the shell a scroll container and break `position: sticky` inside it — the
video stages of experiment 1 — and no `hidden` fallback for the same reason); no `z-index`
(it must not create a stacking context: the hero-above-canvas tricks rely on the root
context); fixed elements (nav, canvases, tuners) are unaffected, their containing block is
the viewport. Scripts that append to `document.body` (canvas, tuner, sprite) land outside
the shell — fine, they are fixed.

Two more phone rules learned with the same bug, for any scroll-driven effect:
- Never derive geometry or scroll distances from `window.innerHeight` on every resize: the
  address bar collapsing/expanding fires `resize` with the same width and a different
  height, and the sequence jumps or the figure changes size mid-scroll. Read the stable
  height from a `position: fixed; height: 100vh` probe, re-read it only when the width (or
  the height by more than ~25 %) changes, and let only the canvas backing store follow the
  live `innerHeight` (celosphere `seal-knit.js` v22, `layout()`).
- Render on demand. A `requestAnimationFrame` loop that clears and redraws a full-screen
  canvas 60 times a second forever is what makes phones warm. Keep the loop but draw only
  when something can have changed — scroll position, pointer / tilt, a knob (the tuner calls
  a `<KNOBS>_INVALIDATE()` hook), layout, a font or image arriving — or while a smoothed value
  is still travelling toward its target (`settling` flag). At rest: zero draws
  (`seal-knit.js` v22, `frame()`).

Verification (headless Chromium, `isMobile: true`, 390 px): `document.documentElement.scrollWidth
=== innerWidth` at every point of the sequence, and the draw count over 1 s at rest is 0.

## 5. Build the effect

Our own JS goes in the experiment subfolder, loaded from `index.html` with its own
`?v=`. The method that has always worked (detailed in `claude_sitefx_context.md`): the
live site is AEM Edge Delivery, so read the blocks at
`celonis.com/dist/blocks/<block>/<block>.js` and the motion tokens from
`dist/chunks/tokens.js`, and REIMPLEMENT them in vanilla JS; then compare by sampling
transforms every 50 ms, live vs replica, at 1440×900.

Igor's rules: **everything is delivered in English** — UI, context files
(`claude_*_context.md`) and code comments; orders may come in Spanish, the output does
not. And visual parameters are tuned in the DevTools console before being fixed in the
code.

## 6. Link it from the root index

In `/index.html`, one block per experiment:

```html
<article class="exp">
  <span class="date">Sep 3, 2026</span>
  <div class="num">Experiment N</div>
  <h2>Short title of what was done</h2>
  <p>Two or three lines: what is being replaced and with what.</p>
  <div class="links">
    <a href="experiments/<name>/index.html" target="_blank" rel="noopener">Open experiment</a>
    <a class="alt" href="experiments/<name>/original.html" target="_blank" rel="noopener">Saved original (with video)</a>
  </div>
</article>
```

All index links open in a **new window** (`target="_blank" rel="noopener"`). The index
is the only navigation: experiment pages are not linked to each other.

## 7. Publish

```bash
cd ~/repo/celonistvibecoding
git add -A && git commit -m "..."
TOK=$(tr -d ' \n\r' < github-token.txt)
git push "https://x-access-token:${TOK}@github.com/igorustarroz-bit/celonisvibecoding.git" main
```

`github-token.txt` is a fine-grained PAT and is **never** pushed (it is in `.gitignore`).
Resulting URL: `https://igorustarroz-bit.github.io/celonisvibecoding/experiments/<name>/index.html`.

From Cowork: `rm` in the mounted folder is blocked by default (you have to request
delete permission); `mv` and `git mv` work. And to check a recent publish, use the
browser — WebFetch caches for 15 min per URL.

## 8. Document the experiment

Create `experiments/claude_<topic>_context.md` with the settled decisions, the exact
values and the mistakes already made. **All context docs live in `experiments/`**, at
the same level as the folders, never inside one of them, and their paths are relative
to `experiments/`.

## Final checklist before saying "published"

- [ ] Anti-phishing sweep clean (section 4 of the anti-phishing doc).
- [ ] Network requests of the published page: all same-origin.
- [ ] `<script src="../nav-fx.js?v=N">` on every page in the folder, with the `?v=`
      bumped if the JS was touched.
- [ ] `<div class="page-shell">` around the whole body + `../lib/page-shell.css` (section 4b);
      at 390 px in mobile emulation `scrollWidth === innerWidth` through the whole effect.
- [ ] The effect draws nothing at rest (0 frames in 1 s once settled) and does not read
      `innerHeight` on every resize (section 4b).
- [ ] New links in the index, with `target="_blank" rel="noopener"`.
- [ ] `.gitignore` rules with the correct prefix for the new folder's tracking files.
- [ ] The published page opened in the browser and checked at 1440×900 and on mobile.
- [ ] The page also opened LOCALLY from `file://` — textures visible (data-URI bundle).
- [ ] On a phone: the figure tilts with the device (`../lib/tilt-parallax.js` loaded; on
      iPhone the first tap grants the sensor).
- [ ] `experiments/claude_<topic>_context.md` written.
