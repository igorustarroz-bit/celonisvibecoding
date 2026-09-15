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

  function start() {
    measure();

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
