# celonisvibecoding — unofficial design prototypes

Front-end design experiments by [Hanzo](https://hanzo.es/), a design studio, exploring
improvements to a client website: replacing background videos with generative Canvas 2D /
WebGL animations, scroll-driven video scrubbing, and similar ideas.

**These pages are not official pages of the brand shown, and they are neither published
nor endorsed by them.**

The HTML pages under `experiments/` (`3d-globe/`, `datacore/`, `Concept-Video-Scroll/`, `3d-book/`, `celosphere/`) are
locally saved copies of public web pages, kept only as a static visual backdrop so the
animation prototypes can be judged in context. They are **not** functional websites:

- all outbound links are disabled (`href="#"`);
- all analytics, advertising and tracking scripts, pixels and iframes have been removed;
- all newsletter / lead-capture forms and chat widgets have been removed;
- no login, sign-up or payment flow exists or is linked;
- no data of any kind is collected;
- every page is served with `<meta name="robots" content="noindex,nofollow">` and carries
  a visible "unofficial prototype" notice.

All trademarks, logos and brand assets belong to their respective owners and are used
here only as reference material for design experimentation.

Index of experiments: [`index.html`](./index.html)

## Repo layout

- root: `index.html` (experiment index), `README.md`, `hanzo_logo.svg`, the Search Console
  verification file, `.nojekyll`.
- `experiments/<name>/` — one folder per experiment (`3d-globe/`, `datacore/`,
  `Concept-Video-Scroll/`, `3d-book/`, `celosphere/`). `3d-globe/` was named `celonis-home/` until 2026-09-03.
- `experiments/` also holds what is shared: `nav-fx.js` (the common nav effect),
  `lib/` (three.js r147 + post-processing, GSAP 3.5.1 + ScrollTrigger, the placeholder
  spritemap, Poppins and IBM Plex Mono, the inert forms, the gyroscope parallax for phones),
  `clean-saved-page.py` (the anti-impersonation cleanup as a script), `bundle-assets.py`
  (images → data-URI bundle so WebGL textures also work from `file://`) and
  **all** the `claude_*_context.md` engineering notes, one per topic, kept together at
  that level rather than inside the experiment folders. Paths inside those notes are
  relative to `experiments/`.
- Start with `experiments/claude_newexperiment_context.md`: it documents the whole
  process for adding an experiment — saving the page from the browser, the mandatory
  anti-impersonation cleanup, wiring the shared nav effect, indexing and publishing.
