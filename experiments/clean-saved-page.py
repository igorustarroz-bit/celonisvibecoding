#!/usr/bin/env python3
"""Anti-phishing cleanup for a page saved from the browser ("Webpage, Complete").

Implements section 2 of experiments/claude_antiphishing_context.md:
  - removes the identity tags (canonical, og:*, twitter:*, JSON-LD, site verification)
  - removes EVERY <script> (external and inline), every <iframe>, <noscript> and pixel <img>
  - removes preload/preconnect/modulepreload <link>s pointing outside the page and the
    <style> blocks injected by third-party widgets that reference external urls
  - removes the <source> elements of <picture> (their srcsets point to the CDN);
    the local <img> fallback stays
  - rewrites every <a href> starting with http(s):, // or / to href="#"
  - adds <meta name="robots" content="noindex,nofollow">, our own <title> and description
  - resets the nav to its resting state (drops nav-hidden and the cloned CTA that
    get saved when the page was scrolled at save time)
  - renames the assets folder reference (./<Page>_files/ -> ./original/)

Usage:
  python3 clean-saved-page.py <page.html> "<Page>_files" original "<title>" [--out cleaned.html]

The output keeps the layout CSS and the local images, which is all a prototype needs.
Tracking files are not deleted from disk: list them in .gitignore (see --report).
"""
import re, sys, io, os

DESCRIPTION = ("Unofficial design prototype for vibecoding experiments. Not an official page "
               "of the brand shown, and not published or endorsed by them.")

def remove_div(h, marker):
    """Remove a <div ...marker...> element with everything nested in it."""
    while True:
        m = re.search(r'<div\b[^>]*' + re.escape(marker) + r'[^>]*>', h, re.I)
        if not m: return h
        i, depth, pos = m.start(), 0, m.start()
        for t in re.finditer(r'<div\b|</div\s*>', h[m.start():], re.I):
            depth += 1 if t.group(0).lower().startswith('<div') else -1
            if depth == 0:
                pos = m.start() + t.end(); break
        else:
            return h
        h = h[:i] + h[pos:]

def strip_head_divs(h):
    """Remove <div> elements a widget left inside <head> (see the call site)."""
    i = h.lower().find('</head>')
    if i < 0:
        return h
    head, rest = h[:i], h[i:]
    head = re.sub(r'<div\b[^>]*>\s*</div>\s*', '', head, flags=re.I)
    return head + rest


def clean(html, old_assets, new_assets, title):
    h = html
    # assets folder rename
    h = h.replace('./' + old_assets + '/', './' + new_assets + '/')
    h = h.replace(old_assets + '/', new_assets + '/')
    # identity
    h = re.sub(r'<link[^>]*rel="canonical"[^>]*>\s*', '', h, flags=re.I)
    h = re.sub(r'<link[^>]*rel="(?:alternate|preload|modulepreload|preconnect|dns-prefetch|prefetch)"[^>]*>\s*', '', h, flags=re.I)
    h = re.sub(r'<meta[^>]*(?:property="og:|name="twitter:|name="naver-site-verification"|name="google-site-verification")[^>]*>\s*', '', h, flags=re.I)
    h = re.sub(r'<meta[^>]*name="(?:description|robots)"[^>]*>\s*', '', h, flags=re.I)
    h = re.sub(r'<title>.*?</title>', '', h, flags=re.S | re.I)
    # scripts, iframes, noscript, pixels
    h = re.sub(r'<script\b[^>]*>.*?</script>\s*', '', h, flags=re.S | re.I)
    h = re.sub(r'<iframe\b[^>]*>.*?</iframe>\s*', '', h, flags=re.S | re.I)
    h = re.sub(r'<iframe\b[^>]*/?>\s*', '', h, flags=re.I)
    h = re.sub(r'<noscript\b[^>]*>.*?</noscript>\s*', '', h, flags=re.S | re.I)
    h = re.sub(r'<img\b[^>]*src="(?:https?:)?//[^"]*"[^>]*>\s*', '', h, flags=re.I)
    # tracking pixels saved as local extension-less files ("out", "out(3)", "0"...)
    h = re.sub(r'<img\b[^>]*src="\./' + re.escape(new_assets) + r'/[^"./]*"[^>]*>\s*', '', h, flags=re.I)
    # <style> blocks injected by third-party widgets (Qualified messenger: Inter
    # @font-face from js.qualified.com) — the only inline styles that reach out
    h = re.sub(r'<style\b[^>]*>(?:(?!</style>).)*?url\([\'"]?(?:https?:)?//(?:(?!</style>).)*?</style>\s*', '', h, flags=re.S | re.I)
    # third-party widget DOM left in the page: the OneTrust cookie banner
    h = remove_div(h, 'id="onetrust-consent-sdk"')
    # ...and the 1x1 measuring divs some widgets leave INSIDE <head>. A <div>
    # there is invalid, so the parser closes the head at that point and starts
    # the body: everything appended before </head> afterwards (a stylesheet, a
    # <link rel="expect">) silently becomes a body element. Found 2026-09-14,
    # when it was half the reason the view transitions of experiment 7 only
    # fired sometimes. Only <div> is stripped, and only inside the head.
    h = strip_head_divs(h)
    # <picture><source srcset="https://cdn..."> -> keep only the local <img>
    h = re.sub(r'<source\b[^>]*srcset="(?:https?:)?//[^"]*"[^>]*>\s*', '', h, flags=re.I)
    h = re.sub(r'\s(?:srcset|data-src)="(?:https?:)?//[^"]*"', '', h, flags=re.I)
    # scroll state at save time: if the nav was hidden (scrolled down) the copy
    # carries class nav-hidden and a cloned CTA; nav-fx.js expects the resting state
    h = re.sub(r'<a\b[^>]*\bcloned-cta\b[^>]*>.*?</a>\s*', '', h, flags=re.S | re.I)
    h = re.sub(r'(class="[^"]*?)\s*\bnav-hidden\b', r'\1', h)
    # links
    h = re.sub(r'(<a\b[^>]*?\shref=")(?:https?:|//|/)[^"]*(")', r'\1#\2', h, flags=re.I)
    # our own head tags, right after <head>
    head = ('<head>\n<meta name="robots" content="noindex,nofollow">\n'
            '<meta name="description" content="%s">\n<title>%s</title>\n' % (DESCRIPTION, title))
    h = re.sub(r'<head\b[^>]*>', head, h, count=1, flags=re.I)
    return h

def referenced_assets(html, css_dir):
    """Files inside the assets folder that the cleaned page (and its CSS) still needs."""
    refs = set(re.findall(r'\./' + re.escape(os.path.basename(css_dir)) + r'/([^"\'?#]+)', html))
    for f in list(refs):
        p = os.path.join(css_dir, f)
        if f.lower().endswith('.css') and os.path.exists(p):
            css = io.open(p, encoding='utf-8', errors='surrogateescape').read()
            for u in re.findall(r'url\(["\']?([^"\')]+)', css):
                if not u.startswith(('http', '/', 'data:')):
                    refs.add(u.split('?')[0].split('#')[0])
    return refs

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    page, old_assets, new_assets, title = args[:4]
    out = args[4] if len(args) > 4 else page
    html = io.open(page, encoding='utf-8', errors='surrogateescape').read()
    cleaned = clean(html, old_assets, new_assets, title)
    io.open(out, 'w', encoding='utf-8', errors='surrogateescape').write(cleaned)
    assets_dir = os.path.join(os.path.dirname(page) or '.', new_assets)
    if '--report' in sys.argv and os.path.isdir(assets_dir):
        keep = referenced_assets(cleaned, assets_dir)
        print('# referenced (publish):'); [print('  ', f) for f in sorted(keep)]
        print('# NOT referenced (add to .gitignore):')
        for f in sorted(os.listdir(assets_dir)):
            if f not in keep and f != '.DS_Store': print(f)
