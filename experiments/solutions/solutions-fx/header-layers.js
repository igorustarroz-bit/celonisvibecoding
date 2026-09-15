/* =========================================================================
   Solutions — header layering (experiment 7).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   One job: publish the measured height of the fixed header bar as
   `--sfx-nav-h` on <html>, so the CSS can park the sticky section menu below
   it instead of on top of it.

   Why it is a measurement and not a number. The saved page's header is 88 px
   on desktop and 64 px on phones, and the saved CSS parks the sticky
   `.anchor-secondary-menu-wrapper` differently at each breakpoint: `top: 64px`
   with `z-index: 2` on phones — below the header, correct — and `top: 0` with
   `z-index: 10` on desktop, which puts the white menu exactly where the black
   header is and ranks it above. The header then paints none of its own box and
   reads as transparent, with the page sliding past in the strip it does not
   cover. (Igor, 2026-09-15; the untouched `original.html` does it too.)

   solutions.css parks the menu at `var(--sfx-nav-h, 88px)` and lifts the header
   above it. This file keeps that variable honest across breakpoints and
   orientation changes. The fallback in the CSS is the desktop value, so the
   page is already right before this script runs and merely becomes exact.

   Console: SOLUTIONS_HEADER().
   ========================================================================= */
(function () {
  "use strict";

  var SEL = '.nav-wrapper';
  var last = -1;
  var wayBack = false;

  function measure() {
    var bar = document.querySelector(SEL);
    if (!bar) return;
    /* offsetHeight rather than the rect: the bar is faded out by nav-fx
       (`nav-hidden` is opacity, not display), so it always has a box, and a
       transform on an ancestor must not scale the number we publish. */
    var h = bar.offsetHeight;
    if (!h || h === last) return;
    last = h;
    document.documentElement.style.setProperty('--sfx-nav-h', h + 'px');
  }

  /* nav-fx owns the bar's visibility and marks it with its own classes. The
     sticky section menu is a COUSIN of the bar, not a descendant, so no CSS
     selector can read that state — mirror it onto <html> and the stylesheet
     can park the menu under the bar while it is down and at the very top while
     it is away, which is what stops the strip the bar occupies from ever being
     an empty gap. No class at all means the bar has not been touched yet:
     that is its visible state, so "shown" is the default. */
  function mirror() {
    var bar = document.querySelector(SEL);
    document.documentElement.setAttribute(
      'data-sfx-nav', bar && bar.classList.contains('nav-hidden') ? 'hidden' : 'shown');
  }

  /* The way back. The header's "Solutions" is a <button> that opens a mega-menu
     the saved page can no longer open — the site's own JS is stripped on every
     experiment in this repo — so on the detail page it is the obvious way back
     to the section home and it does nothing at all.

     Give it the navigation and leave the element exactly as saved. Converting
     it to an <a> would hand it anchor styling instead of the nav's own, and
     would drop it out of the target cursor, which frames it as a `button`.
     A scripted navigation still runs the cross-document view transition —
     measured 3/3, the same as a real click — so the way back looks like the way
     in. Igor, 2026-09-15. */
  function backLink() {
    if (document.documentElement.getAttribute('data-sfx-page') !== 'supply-chain') return;
    var btn = document.querySelector(SEL + ' li.nav-drop button[aria-controls="solutions"]');
    if (!btn) return;

    /* It no longer opens anything, and saying otherwise to a screen reader is
       worse than saying nothing. */
    btn.removeAttribute('aria-haspopup');
    btn.removeAttribute('aria-expanded');
    btn.removeAttribute('aria-controls');
    btn.setAttribute('title', 'Solutions');
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      location.href = '../home/index.html';
    });
    wayBack = true;
  }

  function start() {
    measure();
    mirror();
    backLink();

    var bar0 = document.querySelector(SEL);
    if (bar0 && window.MutationObserver) {
      new MutationObserver(mirror).observe(bar0, { attributes: true, attributeFilter: ['class'] });
    }

    /* The height changes at the breakpoint, and the breakpoint is crossed by
       resizing, by rotating a phone, and by a font finishing loading. */
    if (window.ResizeObserver) {
      var bar = document.querySelector(SEL);
      if (bar) new ResizeObserver(measure).observe(bar);
    }
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('orientationchange', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure, measure);
  }

  window.SOLUTIONS_HEADER = function () {
    var bar = document.querySelector(SEL);
    var menu = document.querySelector('.anchor-secondary-menu-wrapper');
    return {
      navHeight: last,
      navState: document.documentElement.getAttribute('data-sfx-nav'),
      wayBackWired: wayBack,
      published: document.documentElement.style.getPropertyValue('--sfx-nav-h') || null,
      navZ: bar ? getComputedStyle(bar).zIndex : null,
      headerZ: (function () {
        var w = document.querySelector('.header-wrapper');
        return w ? getComputedStyle(w).zIndex : null;
      })(),
      stickyMenu: menu ? {
        top: getComputedStyle(menu).top,
        z: getComputedStyle(menu).zIndex,
        offsetFromViewportTop: Math.round(menu.getBoundingClientRect().top)
      } : 'none on this page'
    };
  };

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
