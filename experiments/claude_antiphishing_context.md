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
