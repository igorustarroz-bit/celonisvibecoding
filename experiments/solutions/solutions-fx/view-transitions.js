/* =========================================================================
   Solutions — cross-document view transitions (experiment 7).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   The transition itself is pure CSS and lives in solutions.css:
   `@view-transition { navigation: auto }` on both pages, plus a shared
   `view-transition-name` on the two things that exist on both sides of the
   journey — the header, and the box that grows (the clicked card on one side,
   the hero block on the other).

   This file does the four things CSS cannot:
     * put `.sfx-vt-card` on the card that actually contains the link, so the
       card travels as one object rather than being part of the root snapshot.
       Doing it here keeps our class names out of the saved client markup.
     * hold the three timings and write them as custom properties, mirrored
       through sessionStorage so a value tuned on one page governs the
       transition seen on the other (only the INCOMING document's stylesheet
       drives the pseudo-elements).
     * expose S.vtReady, which settles once an incoming transition has
       finished, so the text effects do not start mid-morph.
     * report what the browser is doing, for the tuner read-out and the
       console — a cross-document transition silently does nothing when the
       browser does not support it, or when the page was opened from file://
       (every file:// document is its own opaque origin, so the navigation is
       never same-origin and the transition is skipped).

   Console: SOLUTIONS_VT().
   ========================================================================= */
(function () {
  "use strict";

  var S = (window.SOLUTIONS = window.SOLUTIONS || {});
  var state = { supported: false, sameOrigin: false, marked: 0, reducedMotion: false,
                arrivedByTransition: false };

  /* The three timings of the choreography, in ms. They are written as CSS
     custom properties, because the animations live in solutions.css. */
  var VT = S.vt = {
    fadeOut: 220,   // the outgoing page clears
    fadeIn: 420,    // the incoming page fades up
    title: 520,     // the title travels from the card to the hero overtitle
    lift: 8         // px the incoming page drifts up under it
  };

  var KEY = 'sfx-vt';

  /* The INCOMING document is the one whose stylesheet drives every
     ::view-transition-* pseudo-element, so a value tuned on one page would
     have no effect on the transition that page starts. Mirroring it through
     sessionStorage is what makes the panel usable: tune it here, and the page
     you land on applies the same numbers. sessionStorage throws on file://
     in some configurations, hence the try. */
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(VT)); } catch (e) {}
  }
  function load() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      ['fadeOut', 'fadeIn', 'title', 'lift'].forEach(function (k) {
        if (typeof o[k] === 'number') VT[k] = o[k];
      });
    } catch (e) {}
  }

  S.vtApply = function () {
    var s = document.documentElement.style;
    s.setProperty('--sfx-vt-out', VT.fadeOut + 'ms');
    s.setProperty('--sfx-vt-in', VT.fadeIn + 'ms');
    s.setProperty('--sfx-vt-title', VT.title + 'ms');
    s.setProperty('--sfx-vt-lift', VT.lift + 'px');
    save();
  };

  /* S.vtReady settles when the page is done arriving: immediately on a plain
     load, and only after the incoming view transition has finished when there
     was one. The hero text effects wait on it, because starting to scramble
     the overtitle while the browser is still morphing it into place looks
     like a glitch rather than an effect.

     `pagereveal` fires before the first render of the new document, which is
     after our scripts have parsed (they sit at the end of <body>), so this
     listener does catch it. The timeout is the safety net for the browsers
     where it does not fire at all. */
  S.vtReady = new Promise(function (resolve) {
    var settled = false;
    function done() { if (!settled) { settled = true; resolve(); } }

    function take(vt) {
      if (vt) {
        state.arrivedByTransition = true;
        vt.finished.then(done, done);
      } else {
        done();
      }
    }

    /* `window.__sfxReveal` is set by the inline script at the top of the page's
       <head>: it is the only listener guaranteed to be registered before
       `pagereveal` fires. This file runs at the end of <body>, behind the
       shared libraries, and on the page that loads three.js it misses the
       event entirely — which is how the incoming transition came to be
       reported as "did not happen" while it was plainly happening. */
    if (window.__sfxReveal !== null && window.__sfxReveal !== undefined) {
      take(window.__sfxReveal);
    } else if ('onpagereveal' in window) {
      window.addEventListener('pagereveal', function (e) { take(e.viewTransition); });
    } else {
      done();
    }
    setTimeout(done, 1600);
  });

  function start() {
    var page = document.documentElement.getAttribute('data-sfx-page');
    if (!page) return;

    load();
    S.vtApply();

    state.supported =
      typeof document.startViewTransition === 'function' &&
      CSS.supports && CSS.supports('view-transition-name', 'none');
    state.sameOrigin = location.protocol === 'http:' || location.protocol === 'https:';
    state.reducedMotion = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (page === 'home') {
      /* The travelling object is the card's HEADING — the words "Supply
         Chain", which exist verbatim on both sides of the journey as the hero
         overtitle. Naming the card's whole box instead (the first build) tweens
         two very differently proportioned rectangles into one another: a lot
         of motion for very little meaning, and it lands on top of the hero
         video rather than handing off to it.

         `#supply-chain` is the id Chrome saved on that <h3>. We read it, then
         put our own class on the element, so nothing downstream depends on
         the client's id surviving a future save. */
      var head = document.getElementById('supply-chain');
      /* It has to be the heading of a card that actually links to our copy —
         otherwise this is some other block that happens to share the id, and
         naming it would morph the wrong thing. Walk up only as far as a card:
         a hit above that means the id is not where we think it is. */
      var box = head, hops = 0;
      while (box && box !== document.body && hops < 6 &&
             !box.querySelector('a[href*="supply-chain/index.html"]')) {
        box = box.parentElement; hops++;
      }
      var ok = head && box && box !== document.body &&
               box.getBoundingClientRect().height < window.innerHeight * 1.2;
      if (ok) {
        head.classList.add('sfx-vt-title');
        state.marked = 1;
      }
    }
  }

  window.SOLUTIONS_VT = function () {
    return {
      page: document.documentElement.getAttribute('data-sfx-page'),
      supported: state.supported,
      willRun: state.supported && state.sameOrigin,
      whyNot: !state.supported ? 'this browser has no view transitions'
            : !state.sameOrigin ? 'opened from ' + location.protocol +
              ' — cross-document transitions need http(s)'
            : null,
      titleMarked: !!state.marked,
      arrivedByTransition: state.arrivedByTransition,
      timings: VT,
      reducedMotion: state.reducedMotion
    };
  };

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
