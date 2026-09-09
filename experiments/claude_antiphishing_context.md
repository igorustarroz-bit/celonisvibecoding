# Anti-phishing strategy — instructions for Claude

> **New experiment?** The full process (save the page from the browser →
> anti-phishing cleanup → nav-fx → index → publish) is in
> `claude_newexperiment_context.md`.

> This document lives in `experiments/` alongside the other `claude_*_context.md`
> files (all uploaded there on 2026-09-03). **The paths in this doc are relative to
> `experiments/`.**

> Operational document for future Claude sessions in this repo.
> Written on 2026-09-03, after Google lifted the "deceptive site" warning
> on `https://igorustarroz-bit.github.io/celonisvibecoding/`.
> Applies to **the whole repo**, not just `experiments/3d-globe/`.

---

## 1. What happened

On 2026-09-02 Chrome started flagging the site as dangerous. The cause was **not** the
outbound links (that was the user's first hypothesis and it was wrong). The cause was that
the saved copies of celonis.com **presented themselves as the original site**:

- `<link rel="canonical" href="https://www.celonis.com/">`
- `og:title` / `og:url` / `twitter:*` carrying Celonis titles and URLs
- JSON-LD (`schema.org` Organization / WebSite / VideoObject) declaring the brand's identity
- `<meta name="robots" content="index">`, i.e. indexable
- brand logo, images and copy served from an unrelated free domain
- an "Account" link to `id.celonis.cloud/user/ui/login` and a "Try for free" link to `signup.celonis.com`
- an iframe with a lead-capture form (Pardot) and third-party widgets with pixels

Copied branding + login link + data capture + indexable = the exact signature the Safe
Browsing social-engineering classifier looks for. It was fixed by removing the
impersonation, not the links.

---

## 2. Mandatory rules when saving a new client page

Every time a new copy of a celonis.com page is downloaded for an experiment,
apply **all** of this before the first push:

### 2.1 Identity — what triggers the classifier

1. Delete `<link rel="canonical">` and any `<link>` whose `href` points to
   `celonis.com` / `celonis.cloud` (including `rel="alternate"` with hreflang).
2. Delete every `<meta property="og:*">` and `<meta name="twitter:*">`.
3. Delete **all** `<script type="application/ld+json">` blocks. This is the one that gets
   forgotten: it declares Organization / WebSite / VideoObject with the brand's name and URL.
4. Set `<meta name="robots" content="noindex,nofollow">` on every page.
5. Use your own `<title>` and `<meta name="description">`, along the lines of
   `Vibecoding prototype - <what it is> (unofficial)`.

### 2.2 Links

6. Every `<a href>` starting with `http://`, `https://`, `//` or `/` becomes
   `href="#"`. Root-relative ones too, because on GitHub Pages they resolve against the
   host root and return 404.
7. Absolute priority: the links to `id.celonis.cloud` ("Account") and `signup.celonis.com`
   ("Try for free"). Copied branding + a login link is textbook phishing.
8. Do **not** touch image/video `src`, `<link rel="stylesheet">` or SVG `<use href>`:
   without them the prototypes cannot be judged, and they are not an impersonation signal.

### 2.3 Data capture and third parties

9. Remove the iframes for: the Pardot forms (`3nkvm5.html`, `3lrqx1.html`), the Qualified
   chat (`messenger.html`, `q-messenger-frame`), CrazyEgg (`saved_resource*.html`), the
   Vidyard player (`cq3Rs2m6ZoJGv1b3krtPze*.html`). The HTML files behind those iframes are
   either gitignored (3d-book) or replaced by a `noindex` stub reading "Third-party widget
   disabled in this unofficial design prototype."
   **Forms — Igor's decision (2026-09-04): the form stays visible and interactive, with
   all its functionality removed.** A prototype without the form cannot be judged, so
   the iframe is replaced by an INERT VISUAL REPLICA built with the shared
   `lib/inert-form.css` + `lib/inert-form.js` (first used in `3d-book/`, both pages):
   - NO `<form>` element, NO `action`, NO `name` attributes, `autocomplete="off"`.
   - NO `type="email"` / `type="password"` — every field is `type="text"` (the sweep in
     §4 counts `<form` and email/password inputs as signals; the replica adds none).
   - The button is `type="button"` and only reveals a note for 3.5 s: "Form disabled in
     this unofficial design prototype — nothing is sent or stored." Enter does the same.
   - Labels and layout copied from the site's `external-forms-style.css` (the CSS the
     iframe loaded); the copy in the consent line says "the company", not the brand.
   - Markup: `<div class="inert-form form light-base-theme">` with the site's
     `form-field` / `field-label` / `input.text` / `select.select` classes, placed in the
     `.pnf` block (it takes the `form` grid area the iframe had); the footer newsletter
     uses `inert-form form footer-newsletter__form dark-base-theme`.
10. Remove **all** analytics and advertising scripts and pixels, both the local
    `<script src>` files inside `*_files/` or `original/` and **the inline snippets**:
    Adobe Launch (`_satellite["_runScriptN"]`), Facebook (`fbq`), LinkedIn Insight
    (`_linkedin_partner_id`, `lintrk`), Bing UET (`uetq`), AdRoll, RudderStack, StackAdapt,
    Oktopost, HockeyStack, Qualtrics, factors.ai, OneTrust/Optanon, `<img>` pixels pointing to
    `px.ads.linkedin.com` and the like.
11. Only these are **kept**: `aem.js` and `scripts.js` — they are the site's layout code.
    **Correction 2026-09-04:** this rule used to keep `main.*.js` and `*.chunk.js` too. That
    was wrong. `main.<hash>.js` (loaded with a `data-id="CUHH…"` attribute) is the **TikTok
    Pixel SDK** (`analytics.tiktok.com/i18n/pixel/static/main.*.js`; it defines
    `TiktokAnalyticsObject` and throws `Object._ttq_create is not a function` in the console),
    and `10.*.chunk.js` / `11.*.chunk.js` are the **Qualtrics** site-intercept bundle (their
    header says so). Both had been published in `Concept-Video-Scroll/` for months; removed
    from the four pages there and gitignored. Rule of thumb: if a script is not one of the two
    AEM files or ours, open it and read its first lines before keeping it.
11b. Two more things the first cleanup left behind, found the same day, both in the
    third-party category rather than the identity one:
    - **`<picture><source srcset="https://delivery-…adobeaemcloud.com/…">`** — the CDN
      candidates the browser keeps when it saves the page. They are the only remaining
      *third-party network requests* on the page (Chromium picks the `<source>` over the local
      `<img>`). Delete every `<source>` whose `srcset` points off-site; the local `<img>`
      fallback stays. `clean-saved-page.py` already does this for new pages. Still present in
      `3d-globe/` and `datacore/` (plus one `<video src="https://www.celonis.com/…mp4">`
      each) as of 2026-09-04 — pending.
    - **Tracking pixels saved as extension-less files**: `<img src="./…_files/out">`,
      `out-1` … `out-12`, and the Bing UET `<div id="batBeacon…">` with its two `<img
      src="./…_files/0">` / `0-1`. Zero-byte or 1×1 files; remove the tags and gitignore the
      files. The GTM container saved as a file literally named `js` (340 KB) and AdRoll's
      `sendrolling.js` were also still published, unreferenced: gitignore them too.
12. The tracking files are not deleted from disk, they just stop being published:
    `git rm --cached` + an explicit list in `.gitignore`. In the original cleanup there were 184.

### 2.4 Visible notice

13. The index (`/index.html`) carries the full disclaimer as text, at the top and visible.
14. Experiment pages carry **no** banner. A fixed banner on every page was tried and the
    user removed it because it spoils the visual assessment of the prototype. Do not put it
    back unless asked.

---

## 3. How to word the disclaimer

Hanzo (hanzo.es) is the design studio that built celonis.com; Celonis is a client.
That changes the wording:

- Do **NOT** write "not affiliated with, authorised by, or endorsed by Celonis SE". It is false.
- Do **NOT** claim that Celonis has authorised this publication. There is nothing in writing.
- **DO** say this, which is true and sufficient: these are Hanzo design experiments on a
  client website, **it is not an official brand page and the brand neither publishes nor
  endorses it**.
- The public banner **does not name the client** (the user's decision: publishing a client
  reference needs their sign-off). In the Google form it is named, because that form is
  private.

Current text in `/index.html` and in `README.md`:

> Unofficial prototype. Front-end design experiments by Hanzo exploring improvements to a
> client website. This is not an official page of the brand shown, it is not published or
> endorsed by them, and it is not a working product. The experiment pages embed locally
> saved copies of public pages purely as a visual backdrop: every outbound link in them is
> disabled, no data is collected and no third-party scripts run. All trademarks belong to
> their respective owners.

---

### 3.1 The meta descriptions count too

2026-09-03: the 11 pages still carried `<meta name="description">` reading
"Not affiliated with or endorsed by Celonis" — exactly the sentence section 3
forbids, left behind because the original cleanup only fixed the visible
disclaimer. Now replaced by "Not an official page of the brand shown, and not
published or endorsed by them", which is true and does not name the client.
When rewriting a page's title/description, apply the section 3 wording rules to
the meta tags as well, not just to the visible text.

## 4. Verification sweep

Run it **before every push** that touches saved HTML, and always before requesting a review
from Google. It must come out clean: only Google's verification file
(no robots tag, which is correct) and the index (4 legitimate external links: hanzo.es x2,
animejs.com and the repo).

```bash
cd ~/repo/celonistvibecoding && python3 - <<'PY'
import subprocess,re,io
files=[f for f in subprocess.check_output(["git","ls-files"]).decode().split("\n") if f.lower().endswith(".html")]
bad=0
for f in files:
    h=io.open(f,encoding="utf-8",errors="surrogateescape").read()
    ck={"canonical":len(re.findall(r'rel="canonical"',h,re.I)),
        "og/twitter":len(re.findall(r'property="og:|name="twitter:',h,re.I)),
        "ldjson":len(re.findall(r'application/ld\+json',h,re.I)),
        "iframe":len(re.findall(r'<iframe',h,re.I)),
        "form":len(re.findall(r'<form',h,re.I)),
        "login":len(re.findall(r'type="(?:password|email)"',h,re.I))}
    ext=re.findall(r'<a [^>]*href="((?:https?:|//|/)[^"]*)"',h,re.I)
    rob=len(re.findall(r'name="robots"',h,re.I))
    flags=["%s:%d"%(k,v) for k,v in ck.items() if v]
    if not rob: flags.append("NO-ROBOTS")
    if ext: flags.append("ext:%d %s"%(len(ext),ext[:3]))
    if flags: bad+=1; print("  !!",f,"->"," | ".join(flags))
print("\npublished html: %d | with signals: %d"%(len(files),bad))
PY
```

The sweep above only looks at identity tags, iframes, forms and `<a href>`. It is **blind**
to the leftovers of rules 11/11b, so run this second pass as well; it must print nothing:

```bash
cd ~/repo/celonistvibecoding && python3 - <<'PYCHECK'
import subprocess,re,io
files=[f for f in subprocess.check_output(["git","ls-files","-z"]).decode().split("\0") if f.lower().endswith(".html")]
for f in files:
    h=io.open(f,encoding="utf-8",errors="surrogateescape").read()
    scripts=sorted(set(re.findall(r'<script[^>]*\bsrc="([^"]+)"',h,re.I)))
    saved=[s for s in scripts if ('_files/' in s or '/original/' in s) and not re.search(r'/(aem|scripts)\.js$',s)]
    ext=re.findall(r'<(?!a\b|use\b)[a-z]+ [^>]*(?:src|srcset|poster)="((?:https?:)?//[^"]+)"',h,re.I)
    pix=re.findall(r'<img[^>]*src="[^"]*/(?:out(?:-\d+)?|\d+(?:-\d+)?)"',h,re.I)
    if saved or ext or pix:
        print(f); print('   saved-page scripts:',saved); print('   external src/srcset:',len(ext),ext[:2]); print('   pixels:',len(pix))
PYCHECK
```

(`<use href="https://www.celonis.com/…spritemap.svg#…">` is deliberately excluded: browsers
do not fetch cross-origin `<use>` targets, and `lib/sprite.js` rewrites them anyway.)
Then the browser check: open the published page with the Network panel open — **every request
must be same-origin**. On 2026-09-04 that check is what exposed the `<source>` CDN requests.

The inert form replicas (rule 9) must keep the sweep clean: they contain no `<form>` and
no email/password inputs by design — if the sweep ever flags one, the replica was built
wrong, not the sweep.

A complementary check, more reliable than reading the HTML: open the published page in the
browser and look at the network requests. **They must all be same-origin.** If any
third-party host shows up, some tracking is still there.

---

## 5. The process with Google Search Console

What worked, in this order:

1. **Clean up first.** Do not request a review with anything outstanding: a denied review
   costs days and risks *Repeat Offender* status.
2. **Verify ownership.** URL prefix `https://igorustarroz-bit.github.io/celonisvibecoding/`,
   "HTML file" method. The file (`google2f66358341be38aa.html`) goes in the repo root and is
   served at `/celonisvibecoding/google....html`. **Never delete it**: if it is deleted, the
   property becomes unverified.
   - Note: verifying the host root `https://igorustarroz-bit.github.io/` would require a
     repo named exactly `igorustarroz-bit.github.io`. It was not necessary.
   - A domain property (`github.io`) is impossible: the DNS is not Igor's.
3. **Read Security issues** (Security & Manual Actions) and check that the example URLs all
   fall under `/celonisvibecoding/`. There are four more Pages sites on the same host
   (`joselito-design-to-code`, `Joselito-Opus-version`, `template-cowork-001`,
   `Test-IA-update`); if any example URL pointed there, that one would have to be cleaned too.
4. **Request a review** describing the problem and the measures taken. The text that was
   submitted, to reuse if it happens again:

> I work at Hanzo (hanzo.es), the design studio that built the website in question. This
> repository holds internal front-end prototypes in which we explore proposed improvements
> to that site for our client. It is prototyping work, not a commercial site and not a live
> product.
>
> The flag was our mistake. The prototype pages embed locally saved copies of the client's
> public pages as a visual backdrop, and those copies were still being served with the
> original site's canonical URL, Open Graph/Twitter tags and JSON-LD structured data, so
> they presented themselves as the original site. That was an oversight in how the pages
> were saved, never an attempt to impersonate anyone.
>
> Across all published pages we have: removed every canonical, og:*, twitter:* and JSON-LD
> identity tag; set `<meta name="robots" content="noindex,nofollow">` on every page;
> disabled every outbound link (`href="#"`), including the ones that previously pointed to
> the client's login and sign-up pages; removed all lead-capture forms, chat widgets and
> embedded video players; and removed all third-party analytics and advertising scripts and
> pixels. The pages now issue no third-party network requests and collect no user data of
> any kind. There is no login, sign-up or payment flow anywhere on the site.

5. **Wait without touching the published pages.** Resolved in ~1 day.

---

## 6. Mistakes Claude must not repeat

- **Do not add a JavaScript login.** It was requested (`hanzo` / `hanzo2026`) and rejected,
  rightly so: on GitHub Pages there is no server, so the credentials end up in the source
  code and the files remain reachable by direct URL. But above all, **a login screen in
  front of pages that replicate celonis.com is exactly the phishing signature**: it would
  have sunk the review. If it comes up again, the answer is real Basic Auth on another host,
  never an HTML form here.
- **Do not turn GitHub Pages off while a review is pending.** Claude recommended it and had
  to backtrack: the reviewer needs to recrawl and see the already-cleaned pages. If they get
  a 404, you are making it harder for them.
- **Do not create a new repo or a new address to escape the warning.** The flag operates at
  host level (`igorustarroz-bit.github.io`), not path level, because `github.io` is on the
  Public Suffix List. A new repo under the same account gets flagged the same way. And a new
  account will not help either: the classifier looks at the content.
- **Do not use "I don't see the warning in Safari/Chrome" as evidence of anything.** Safari
  works against a local copy of hash prefixes on Apple's refresh cadence and lags in both
  directions. The source of truth is Search Console.
- **Watch out for Repeat Offender status**: flip-flopping between publishing and removing
  the impersonation blocks the ability to request a review for 30 days.
- **Do not tell the client to skip the interstitial.** If the client has to open it on their
  own machine, the only valid option is for the flag to be lifted, or to serve it from a
  clean host with authentication.

---

## 7. If it has to be shared with the client without exposing it publicly

Decided but not yet built:

- **Cloudflare Pages** with Basic Auth in `functions/_middleware.js`. Free, a new host with
  no history, and the password in a Cloudflare environment variable — **never in the repo**.
- **The `labs.hanzo.es` domain**, not the default `*.pages.dev`: a corporate filter will let
  a company subdomain with reputation through long before a random `pages.dev`.
- **Native browser Basic Auth**, not a styled form. The browser dialog on a Hanzo domain
  reads as "the vendor is protecting its environment".
- Warn the client contact through another channel before sending the link. A Celonis
  employee receiving a link that looks like Celonis and asks for a password is going to
  think the worst.

---

## 8. Repo operational notes

- The published repo is **`celonisvibecoding`**; the local folder is **`celonistvibecoding`**
  (with a T). The link in the index footer points to the correct one — do not "fix" it the
  other way round.
- `github-token.txt` is in `.gitignore` and **never entered the history** (verified with
  `git log --all -- github-token.txt`). Never push it.
- Push:
  ```bash
  T=$(tr -d ' \n\r' < github-token.txt)
  git push "https://x-access-token:$T@github.com/igorustarroz-bit/celonisvibecoding.git" main
  ```
  The token is a *fine-grained* PAT: **it cannot create repositories** (403). If a new repo
  is needed, Igor creates it by hand.
- In the mounted folder git cannot delete files. When `.git/index.lock` shows up:
  ```bash
  mv .git/index.lock _to_delete/index.lock.$(date +%s)
  ```
  before continuing. The `warning: unable to unlink .git/objects/tmp_obj_*` messages are harmless.
- GitHub Pages takes ~60 s to rebuild. To check the published URL you have to use the
  browser: `curl` to `github.io` does not work from the local machine or from the container.

---

## 9. Status as of 2026-09-03

- Safe Browsing warning **lifted**.
- 34 published HTML pages: 0 canonical, 0 og/twitter, 0 JSON-LD, 0 iframes, 0
  forms, 0 username or password fields, `noindex,nofollow` on all of them.
- Only outbound links: hanzo.es and the GitHub repo, both in the index.
- Zero third-party requests on the published pages (verified in the browser).

## 6. Log — 2026-09-07, leftovers found by the second sweep while publishing experiment 5

Running the §4 second pass before pushing `celosphere/` showed leftovers in the OLDER pages
(they predate the second pass): `3d-globe/index.html` + `original.html` had 39 `<picture>`
`<source srcset="https://delivery-…adobeaemcloud.com/…">` each (CDN requests) and the original 17
saved tracking pixels; the four `datacore/` pages had 3 such `<source>`s and 2 pixels each; and a
`<video src="https://www.celonis.com/assets/videos/media_….mp4">` in 3d-globe (both pages) and
datacore (`Data Core _ Celonis.html`, `original.html`). Fixed in the same push (Igor's rule: apply
the measures the moment a page is seen without them): sources / pixels removed with the same
regexes as `clean-saved-page.py`; the datacore video re-pointed to its local copy
(`Data Core _ Celonis_files/media_1d4c….mp4`, already tracked); the 3d-globe video
(`media_112a…`, never saved locally) lost its `src` — the element stays for layout, plays nothing.
Both sweeps clean after that. Experiment 5's pages were clean from the start (§2 + the extra
Qualified/Bing pass described in `claude_celosphere_context.md` §2).

Same day, second pass (while adding the page shell): the Qualified chat host `<q-root …>` was still
sitting AFTER `</body>` in `3d-globe/index.html` + `original.html`, `3d-book/index.html` +
`original.html`, and the four `datacore/` pages — with `@font-face` rules pointing at
`js.qualified.com` (6 KB each in 3d-globe/datacore) and Spanish "AI asistente" aria-labels. The
generic script never looked past `</body>`. Removed (tail cut back to `</body></html>`). In the same pass the rest of the celosphere "extra" list was applied to the 12 older tracked
pages (`3d-globe`, `3d-book`, `datacore` ×4, `Concept-Video-Scroll` ×4): `<q-focus-sentinel>`
(Spanish "AI asistente" labels), the empty `<div id="batBeacon…">`, the Qualified
`<style>#q-messenger-frame-skip-link…</style>` (~8 KB each) and the browser-extension
`.imageye-selected` style. `3d-globe/index.html` also still loaded Poppins from
`fonts.googleapis.com` (preconnect + css2 link — an external request on every load): replaced by
`../lib/poppins.css`. Rule for sweeps: grep `q-root|q-focus|js.qualified.com|batBeacon|asistente|
googleapis` over EVERY tracked page, not only the new one. Left as is: a `cdn.cookielaw.org` logo
URL inside the saved OneTrust CSS (`.ot-floating-button__front`), which only loads if that element
exists — it does not on our pages.

---

# §7 — Second Safe Browsing flag, 2026-09-09

## What happened

Google flagged `igorustarroz-bit.github.io/celonisvibecoding/` as deceptive again, six days
after the first warning was lifted (2026-09-03) and one day after experiment 5
(`celosphere/`) was published. This is a **second offence on the same host**, which matters:
a host with a repeat classification is slower and harder to clear than a first-timer.

## Root cause: the inert forms were the wrong fix

The first cleanup removed the *identity* signals (canonical, `og:*`, JSON-LD, indexability,
outbound links to the brand's login and signup) and the *functional* ones (real Pardot
forms, chat, analytics, pixels). The forms were then reintroduced as "inert replicas": real
`<input>` elements that could be typed into, but with no `<form>`, no `action`, no `name`,
and no `email`/`password` input type. That was written up as rule 9 and treated as safe.

It is not safe. **Google's social-engineering classifier is structural and visual, not
functional.** It does not need to find a submit handler. A page that renders as a
recognisable brand and contains fields labelled First Name / Last Name / Work Email /
Company / City / Phone, with a "Register now" button, matches the pattern regardless of
where the data would go. Removing `name` attributes hides the fields from a form
serialiser; it does not hide them from a DOM scan or a screenshot.

Experiment 5 turned a small residual signal into a loud one. Counts at the moment of the
flag, across the tracked pages:

| Page | data-entry elements | notes |
|---|---|---|
| `celosphere/index.html` + `original.html` | 37 each | 3 registration forms (name, work email, company, city, phone, opt-in), newsletter field, "Register now" |
| `3d-book/index.html` + `original.html` | 13 each | gated-download form + newsletter |
| every other cloned page | 1 each | the site's own region-search box |

## Three other signals that had survived every previous sweep

1. **`<!-- saved from url=(0034)https://www.celonis.com/celosphere -->`** — Chrome writes
   this as the *second line* of every "Webpage, Complete" save. It is a machine-readable
   declaration, in the first bytes of the document, that the file is a copy of the brand's
   page. No earlier cleanup touched it. It was present on all 16 cloned pages.
2. **211 live hotlinks to the brand's own domain** in `datacore/index.html` and
   `index3d.html`: `<use href="https://www.celonis.com/dist/assets/spritemap.svg#…">`.
   Known since 2026-09-04 and filed as "optional — not a phishing signal". Wrong call: a
   replica page that fetches its icons live from the impersonated domain is a textbook
   phishing-kit behaviour, and it made the pages the only ones on the site with
   cross-origin requests.
3. **`fonts.googleapis.com`** in the root `index.html` (two `<link>`s), and the brand's own
   `Poppins-Regular.woff2` referenced from an inline `@font-face` in the datacore pages.

## The README was making a false claim

`README.md` stated that "all newsletter / lead-capture forms and chat widgets have been
removed" while the typable replicas were live. The lesson from the 2026-09-03 meta-tag
episode applies again, harder: **a reassuring claim that is false is a liability, and a
human reviewer who checks one bullet and finds 23 input fields will not trust the rest of
the page.** The README has been rewritten to describe what is actually true.

## What was done

`experiments/defuse-inputs.py` (new, idempotent, run from the repo root):

- replaces every `<input>`, `<select>` and `<textarea>` in the tracked HTML files with
  non-interactive look-alikes — `<div class="inert-field">`, `<span class="inert-check">` —
  carrying the same classes, so the layout is unchanged and the prototype still reads as
  intended, but the page offers nowhere to type. Hidden inputs are deleted outright;
- strips the `saved from url` comment;
- rewrites every absolute brand URL: `<use href>` and `@font-face` to root-relative (which
  `lib/sprite.js` already handles, and where a same-origin 404 is harmless and intentional),
  `<a href>` to `#`, `src`/`srcset`/`poster` to relative;
- replaces the Google Fonts links in the root index with `experiments/lib/poppins.css`;
- writes `robots.txt` with `Disallow: /`;
- has a `--report` mode that audits every tracked page for data-entry elements, absolute
  brand URLs, external assets, `canonical`, `og:*`, JSON-LD, `<form>`, Qualified/Bing
  leftovers and a missing `noindex`.

`lib/inert-form.css` gained a v2 block restating the input styling for the look-alikes;
`lib/inert-form.js` is v2 — no input handling left, only the buttons, plus a safety net that
strips and warns about any real field that ever reappears inside a `.inert-form`.

## New mandatory rules

**Rule 12 — no data-entry elements on a client replica.** A page that reproduces a client's
visual identity contains no `<form>`, `<input>`, `<select>` or `<textarea>`. Not even
disabled, not even read-only, not even with `name` removed. The forms are rendered as static
look-alikes so the composition can still be judged. If a prototype genuinely needs typing,
build it on a page that does not carry the client's identity.

**Rule 13 — zero cross-origin requests, and nothing that names the source.** Every request a
published page makes must be same-origin: no CDN, no font service, and in particular nothing
fetched from the brand's own domain. Strip the `saved from url` comment. Run
`defuse-inputs.py --report` and confirm in a real browser that
`performance.getEntriesByType('resource')` is 100 % same-origin, over **every** tracked page,
not just the new one.

## Lessons

- Each cleanup so far fixed the signals we had just learnt about and declared the rest safe.
  Three times now — the meta descriptions (2026-09-03), the "layout code" that was the TikTok
  pixel (2026-09-04), the inert forms (today) — the residue was something previously
  inspected and consciously waved through. **Anything filed as "known, optional, not a real
  signal" is the first place to look next time.** The datacore sprite hotlinks had been
  sitting on that list for five days.
- The classifier does not reason about intent or architecture. Reducing our own reasoning to
  "but nothing is actually sent" was the error.
- A checklist only catches what it was written for. The reliable checks are mechanical:
  the audit script and the browser's resource list.

## Open decision — this host is the real problem

The prototypes are full-page visual replicas of a live commercial site, published
unauthenticated on a shared, well-crawled host. That is the input the classifier reacts to,
and every remediation so far has been a way of making the same input slightly less
suspicious. A third flag is likely.

The alternative was already decided and never built (see the "Open" section of
`claude/safe-browsing-cleanup.md`): **Cloudflare Pages with Basic Auth in
`functions/_middleware.js`, on `labs.hanzo.es`, the password in a Cloudflare environment
variable and never in the repo.** Behind auth there is no crawlable clone, so there is
nothing to classify; the client sees the prototypes with a password; the GitHub repo stays
private or keeps only the source. Recommendation: do the remediation above to clear the
current warning, then move the hosting before publishing experiment 6.

## Order of operations for clearing the warning

1. Run `python3 experiments/defuse-inputs.py` from the repo root; confirm the audit is clean.
2. Copy the v2 `lib/inert-form.css` block and `lib/inert-form.js`; bump their `?v=` on every
   page that loads them.
3. Replace `README.md`.
4. Serve locally (`python3 -m http.server`) and check every experiment page renders as before
   and the console is free of errors.
5. Open each published page in a real browser and confirm every entry of
   `performance.getEntriesByType('resource')` is same-origin.
6. Commit and push. **Leave GitHub Pages switched on** — the reviewer has to see the clean
   pages.
7. Only then request the review in Search Console (Security Issues → Request Review), and
   say plainly what the site is, what was found and what was changed. A second request on the
   same host gets read by a human more carefully than the first; a vague one wastes the round
   trip.
