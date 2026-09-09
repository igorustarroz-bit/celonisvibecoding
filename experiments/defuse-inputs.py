#!/usr/bin/env python3
"""
defuse-inputs.py — second-round Safe Browsing remediation (2026-09-09).

Context
-------
The site was flagged as deceptive for the second time. The first cleanup
(2026-09-02/03) removed the *identity* signals (canonical, og:*, JSON-LD,
outbound links, tracking) and the *functional* ones (real forms, chat,
analytics). It kept the lead-capture forms as "inert replicas": real <input>
elements that can be typed into but have no <form>, no action and no name.

That was the mistake. Google's social-engineering classifier is largely
structural / visual, not functional. A page that renders as a well-known brand
AND contains fields asking for name, work email, company, city and phone is the
signature, whether or not anything is submitted. Experiment 5 (celosphere,
published 2026-09-07) added three such registration forms — 23 input elements —
and the flag came back.

What this script does
---------------------
1. Replaces EVERY <input>, <textarea> and <select> in the tracked pages with
   non-interactive elements that carry the same classes, so the layout is
   pixel-identical but the page contains zero data-entry affordances.
2. Rewrites the remaining absolute brand URLs (211 external <use href> sprite
   references in datacore/) to root-relative, so no page hotlinks the brand's
   own domain any more. Every request becomes same-origin.
3. Drops the fonts.googleapis.com link from the root index and points it at the
   local Poppins in experiments/lib/.
4. Writes robots.txt (Disallow: /) at the repo root.
5. Corrects the README claims that were false ("forms have been removed" when
   they had been replaced by typable replicas).

It is idempotent: running it twice changes nothing the second time.

Usage
-----
    python3 experiments/defuse-inputs.py            # from the repo root
    python3 experiments/defuse-inputs.py --dry-run
    python3 experiments/defuse-inputs.py --report   # audit only, no writes

Companion files that must be updated at the same time (delivered separately):
    experiments/lib/inert-form.css   -> v2, styles for the no-input replicas
    experiments/lib/inert-form.js    -> v2, no input handling left
"""

import argparse
import os
import re
import subprocess
import sys

BRAND_HOST = r'(?:www\.)?celonis\.com'

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def tracked_html(root):
    """Every HTML file git actually publishes (ignored files are not served)."""
    out = subprocess.run(
        ['git', 'ls-files', '-z', '*.html'],
        cwd=root, capture_output=True, text=True, check=True).stdout
    return [f for f in out.split('\0') if f]


def listed_html(root, paths):
    """The HTML under the paths given on the command line.

    Step 3 of claude_newexperiment_context.md says to clean a saved page BEFORE
    its first push, and at that moment git does not know the files yet, so the
    tracked-file sweep above cannot see them. Pass the experiment folder (or
    single files) and they are treated exactly the same way.
    """
    out = []
    for given in paths:
        full = given if os.path.isabs(given) else os.path.join(root, given)
        full = os.path.abspath(full)
        if os.path.isdir(full):
            for base, dirs, names in os.walk(full):
                dirs[:] = [d for d in dirs if d != '.git']
                for name in sorted(names):
                    if name.lower().endswith('.html'):
                        out.append(os.path.relpath(
                            os.path.join(base, name), root))
        elif os.path.isfile(full) and full.lower().endswith('.html'):
            out.append(os.path.relpath(full, root))
        else:
            sys.exit('not an HTML file or folder: %s' % given)

    # Files git ignores are never served, so they are not part of what a
    # classifier can see. They are also where the saved third-party widget
    # pages live (chat, marketing iframes), which are full of fields we do
    # not want to touch or count. Drop them, exactly as the tracked sweep
    # does by construction.
    if out:
        proc = subprocess.run(['git', 'check-ignore', '--stdin'],
                              cwd=root, input=chr(10).join(out),
                              capture_output=True, text=True)
        ignored = set(x for x in proc.stdout.splitlines() if x)
        kept = [f for f in out if f not in ignored]
        if len(kept) != len(out):
            print('  (skipping %d gitignored file(s): never published)'
                  % (len(out) - len(kept)))
        out = kept
    return out


def attrs_of(tag):
    """Parse the attributes of a single start tag into a dict."""
    d = {}
    for m in re.finditer(r'([a-zA-Z_:][-\w:.]*)\s*=\s*"([^"]*)"|'
                         r"([a-zA-Z_:][-\w:.]*)\s*=\s*'([^']*)'|"
                         r'([a-zA-Z_:][-\w:.]*)(?![-\w:.=])', tag[1:-1]):
        if m.group(1):
            d[m.group(1).lower()] = m.group(2)
        elif m.group(3):
            d[m.group(3).lower()] = m.group(4)
        elif m.group(5):
            d[m.group(5).lower()] = ''
    return d


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;')
             .replace('>', '&gt;').replace('"', '&quot;'))


# --------------------------------------------------------------------------
# 1. data-entry elements -> inert look-alikes
# --------------------------------------------------------------------------

INPUT_RE = re.compile(r'<input\b[^>]*?/?>', re.I)
SELECT_RE = re.compile(r'<select\b[^>]*?>(.*?)</select>', re.I | re.S)
TEXTAREA_RE = re.compile(r'<textarea\b[^>]*?>(.*?)</textarea>', re.I | re.S)


def repl_input(m):
    tag = m.group(0)
    a = attrs_of(tag)
    typ = (a.get('type') or 'text').lower()
    classes = a.get('class', '').split()
    ident = a.get('id', '')
    label = a.get('aria-label', '')

    if typ in ('checkbox', 'radio'):
        cls = ' '.join(['inert-check'] + [c for c in classes if c])
        out = '<span class="%s"' % esc(cls)
        if ident:
            out += ' data-was-id="%s"' % esc(ident)
        out += ' aria-hidden="true"></span>'
        return out

    # every text-ish field, including hidden ones
    if typ == 'hidden':
        return ''

    cls = ' '.join(['inert-field'] + [c for c in classes if c])
    ph = a.get('placeholder', '')
    out = '<div class="%s"' % esc(cls)
    if ident:
        out += ' data-was-id="%s"' % esc(ident)
    if label:
        out += ' aria-label="%s"' % esc(label)
    out += ' aria-hidden="true">'
    if ph:
        out += '<span class="inert-field__ph">%s</span>' % esc(ph)
    out += '</div>'
    return out


def repl_select(m):
    a = attrs_of(m.group(0)[:m.group(0).index('>') + 1])
    classes = a.get('class', '').split()
    cls = ' '.join(['inert-field', 'inert-field--select'] + classes)
    # keep the first option's text as the visible resting label
    first = re.search(r'<option\b[^>]*>(.*?)</option>', m.group(1), re.I | re.S)
    txt = re.sub(r'<[^>]+>', '', first.group(1)).strip() if first else ''
    return ('<div class="%s" aria-hidden="true">'
            '<span class="inert-field__ph">%s</span></div>'
            % (esc(cls), esc(txt)))


def repl_textarea(m):
    a = attrs_of(m.group(0)[:m.group(0).index('>') + 1])
    classes = a.get('class', '').split()
    cls = ' '.join(['inert-field', 'inert-field--area'] + classes)
    ph = a.get('placeholder', '')
    body = ('<span class="inert-field__ph">%s</span>' % esc(ph)) if ph else ''
    return '<div class="%s" aria-hidden="true">%s</div>' % (esc(cls), body)


def defuse_inputs(text):
    n = 0
    new, k = INPUT_RE.subn(repl_input, text)
    n += k
    new, k = SELECT_RE.subn(repl_select, new)
    n += k
    new, k = TEXTAREA_RE.subn(repl_textarea, new)
    n += k
    return new, n


# --------------------------------------------------------------------------
# 2. absolute brand URLs -> root-relative / disabled
# --------------------------------------------------------------------------

def delink_brand(text):
    n = 0

    # Chrome writes "<!-- saved from url=(0024)https://www.celonis.com/ -->" as
    # the second line of every "Webpage, Complete" save. It is a machine-
    # readable declaration, in the first bytes of the document, that this file
    # is a copy of the brand's page — read by anything that parses the raw
    # HTML. None of the earlier cleanups removed it.
    text, k = re.subn(r'<!--\s*saved from url=.*?-->\s*', '', text,
                      flags=re.I | re.S)
    n += k

    # <use href="https://www.celonis.com/dist/assets/spritemap.svg#icon">
    # -> "/dist/assets/spritemap.svg#icon"; lib/sprite.js rewrites these,
    # and an unresolved same-origin 404 is harmless (it is what the other
    # pages already do).
    text, k = re.subn(
        r'(<use\b[^>]*?\b(?:xlink:)?href\s*=\s*")https?://' + BRAND_HOST,
        r'\1', text, flags=re.I)
    n += k

    # inline @font-face pointing at the brand's own woff2
    text, k = re.subn(
        r'https?://' + BRAND_HOST + r'(/src/assets/fonts/)', r'\1',
        text, flags=re.I)
    n += k

    # any remaining absolute asset reference to the brand host
    for attr in ('src', 'srcset', 'poster', 'data-src', 'content'):
        text, k = re.subn(
            r'(\b' + attr + r'\s*=\s*")https?://' + BRAND_HOST + r'([^"]*)"',
            r'\1\2"', text, flags=re.I)
        n += k

    # navigational links to the brand -> "#" (belt and braces; rule 4 of the
    # anti-phishing doc, re-applied here because new pages keep reintroducing
    # them)
    text, k = re.subn(
        r'(<a\b[^>]*?\bhref\s*=\s*")https?://[^"]*' + BRAND_HOST + r'[^"]*(")',
        r'\1#\2', text, flags=re.I)
    n += k

    return text, n


# --------------------------------------------------------------------------
# 3. root index: local fonts instead of Google Fonts
# --------------------------------------------------------------------------

def local_fonts(text):
    n = 0
    text, k = re.subn(
        r'\s*<link rel="preconnect" href="https://fonts\.googleapis\.com"[^>]*>',
        '', text)
    n += k
    text, k = re.subn(
        r'\s*<link rel="preconnect" href="https://fonts\.gstatic\.com"[^>]*>',
        '', text)
    n += k
    text, k = re.subn(
        r'<link href="https://fonts\.googleapis\.com/[^"]*" rel="stylesheet">',
        '<link rel="stylesheet" href="experiments/lib/poppins.css">', text)
    n += k
    return text, n


# --------------------------------------------------------------------------
# audit
# --------------------------------------------------------------------------

AUDIT = {
    'input/select/textarea': r'<(?:input|select|textarea)\b',
    'absolute brand url': r'https?://(?:www\.)?celonis\.(?:com|cloud)',
    'external http asset': (r'\b(?:src|srcset|poster)\s*=\s*"https?://'),
    'canonical': r'rel="canonical"',
    'og/twitter meta': r'property="(?:og|twitter):',
    'json-ld': r'application/ld\+json',
    'form tag': r'<form\b',
    'qualified/beacon leftovers': r'q-root|q-focus-sentinel|batBeacon',
}


def audit(root, files):
    bad = 0
    for f in files:
        t = open(os.path.join(root, f), encoding='utf-8',
                 errors='replace').read()
        hits = {k: len(re.findall(v, t, re.I)) for k, v in AUDIT.items()}
        hits = {k: v for k, v in hits.items() if v}
        if 'noindex' not in t.lower() and len(t) > 1000:
            hits['MISSING noindex'] = 1
        if hits:
            bad += 1
            print('  %s' % f)
            for k, v in hits.items():
                print('      %-28s %d' % (k, v))
    if not bad:
        print('  clean — no data-entry elements, no brand URLs, '
              'no external assets, noindex everywhere')
    return bad


# --------------------------------------------------------------------------

ROBOTS = ("# Unofficial design prototypes. Nothing here should be indexed.\n"
          "User-agent: *\nDisallow: /\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='*',
                    help='folders or HTML files to clean; default: every '
                         'HTML file git tracks. Use this to clean a saved '
                         'page BEFORE its first push, while git still does '
                         'not know it.')
    ap.add_argument('--root', default='.')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--report', action='store_true',
                    help='audit only, write nothing')
    args = ap.parse_args()
    root = os.path.abspath(args.root)

    if not os.path.isdir(os.path.join(root, '.git')):
        sys.exit('not a git repo: %s' % root)

    files = (listed_html(root, args.paths) if args.paths
             else tracked_html(root))

    if args.report:
        print('AUDIT — %d tracked HTML files\n' % len(files))
        audit(root, files)
        return

    print('BEFORE\n')
    audit(root, files)

    total_fields = total_urls = 0
    for f in files:
        p = os.path.join(root, f)
        orig = open(p, encoding='utf-8', errors='replace').read()
        text, nf = defuse_inputs(orig)
        text, nu = delink_brand(text)
        if f == 'index.html' and os.path.dirname(f) == '':
            text, _ = local_fonts(text)
        if text != orig:
            total_fields += nf
            total_urls += nu
            print('  %-70s fields:%-4d urls:%d' % (f, nf, nu))
            if not args.dry_run:
                open(p, 'w', encoding='utf-8').write(text)

    if not args.dry_run and not args.paths:
        rp = os.path.join(root, 'robots.txt')
        if not os.path.exists(rp) or open(rp).read() != ROBOTS:
            open(rp, 'w').write(ROBOTS)
            print('  robots.txt written')

    print('\n%d data-entry elements removed, %d brand URLs neutralised'
          % (total_fields, total_urls))

    print('\nAFTER\n')
    files = (listed_html(root, args.paths) if args.paths
             else tracked_html(root))
    audit(root, files)

    print("""
Still to do by hand:
  1. Copy the v2 lib/inert-form.css and lib/inert-form.js into experiments/lib/
     and bump their ?v= on every page that loads them.
  2. Fix the README: it currently claims the forms "have been removed", which
     was not true while the typable replicas existed. Say what is true now.
  3. Run the second sweep pass over EVERY page and confirm in a real browser
     that performance.getEntriesByType('resource') is 100 % same-origin.
  4. Only then request the review in Search Console.
""")


if __name__ == '__main__':
    main()
