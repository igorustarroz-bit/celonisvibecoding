/* =========================================================================
   Solutions — the three text effects, on both pages (experiment 7).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

     decrypt   a hero heading resolves out of noise — "Celonis Solutions" on
               the home page, the overtitle and the heading on the supply
               chain page (react-bits DecryptedText, sequential, on view)
     scramble  the hero standfirst of each page scrambles under the pointer,
               character by character, strongest at the cursor and fading out
               over a radius (react-bits ScrambledText, which is gsap's
               ScrambleTextPlugin)
     count     the 30% / 20% / 1000s figures spring up from zero when the
               block reaches the viewport (react-bits CountUp)

   No GSAP and no plugins: ScrambleTextPlugin and SplitText are Club plugins
   and are not in lib/, and rule 13 forbids fetching them. The three effects
   are small enough to own, and owning them buys the two things the originals
   do not have — both of them layout problems that only show up on display
   type, which is exactly where these effects are being used here:

     * NOTHING MOVES WHILE THE TEXT IS SCRAMBLED. Each character becomes
           <span class="sfx-char"><i class="sfx-real">T</i><i class="sfx-sub"></i></span>
       where the real glyph always stays in the flow and only turns invisible,
       so the span keeps its exact width, and the substitute is drawn over it,
       centred and out of flow. A substitute is almost never the same width as
       the letter it stands in for; left to reflow, a three-line heading
       re-wraps on nearly every frame.
     * THE WRAPPING IS THE PAGE'S OWN. Characters are inline-block, which
       otherwise lets a line break between any two of them ("Ma / ke
       Enterprise AI"). Each word is wrapped in a `white-space: nowrap` span
       and the spaces between words are left as plain text nodes, so the lines
       break where they always did.

   One rAF loop drives all of them and stops the moment nothing is animating.

   Settings: window.SOLUTIONS.decrypt / .scramble / .count.
   Console: SOLUTIONS_TEXT().
   ========================================================================= */
(function () {
  "use strict";

  var S = (window.SOLUTIONS = window.SOLUTIONS || {});

  var DEC = S.decrypt = {
    enabled: 1,
    speed: 26,             // ms between reveals
    delay: 160,            // ms after the block appears AND after any view
                           // transition has finished (see S.vtReady)
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
    scrambleEvery: 2,      // re-roll the unrevealed characters every N ticks
    /* The colour of the characters still encrypted. 'own' means each element's
       noise takes that element's own colour — grey on the grey overtitle, white
       on the white heading — which is what Igor asked for in two steps
       (2026-09-14: not green; then: the heading in white). 'custom' forces
       `colour` on every one of them. */
    colourMode: 'own',     // 'own' | 'custom'
    colour: '#ffffff',
    hoverReplay: 1,        // hovering the heading runs it again

    /* Length compensation. `speed` is the interval between reveals for a short
       piece of text; left alone, a 120-character paragraph simply takes twice
       as long as a 60-character heading, and on the page that reads as the
       long ones dragging. Above `speedPivot` characters the interval is
       divided by length / pivot, so every piece of text longer than the pivot
       finishes in the SAME time — pivot x speed, 1.56 s at the current values.
       Igor, 2026-09-14: "hasta 60 caracteres a la velocidad actual; 120, al
       doble de velocidad". `speedMax` stops a very long block from asking for
       an impossible interval: 8 ms is already under a frame, and below that
       the reveal is bounded by the frame rate rather than by this number. */
    speedPivot: 60,        // characters. 0 turns the compensation off.
    speedMax: 6            // fastest interval in ms, whatever the length
  };

  var SCR = S.scramble = {
    enabled: 1,
    radius: 60,            // px from the pointer (Igor, 2026-09-14: half of the
                           // original's 100-120 — the effect was reaching too far)
    duration: 0.275,       // s of noise at the very centre, scaled by distance.
                           // A QUARTER of the original's 1.2: Igor asked for
                           // double the recovery speed twice on 2026-09-14.

    flipsPerSecond: 22,    // how fast a character cycles while scrambled
    chars: '.:'
  };

  var CNT = S.count = {
    enabled: 1,
    duration: 1.2,         // s — drives the spring exactly as the original does
    damping: 0.55,         // 1 = react-bits' own damping; below 1 is snappier
    delay: 0,
    separator: ''          // '' | ',' | '.'
  };

  /* ---------------------------------------------------------------- runtime */
  var raf = 0, last = 0;
  var jobs = [];           // anything that wants a tick: { step(dt) -> bool }

  function kick() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    for (var i = jobs.length - 1; i >= 0; i--) {
      if (!jobs[i].step(dt)) jobs.splice(i, 1);
    }
    if (jobs.length) kick();
  }

  function add(job) {
    if (jobs.indexOf(job) === -1) jobs.push(job);
    kick();
  }

  function rand(set) { return set.charAt(Math.floor(Math.random() * set.length)); }

  function inView(node, fn, margin) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        fn();
      });
    }, { threshold: 0.15, rootMargin: margin || '0px' });
    io.observe(node);
  }

  /* -----------------------------------------------------------------------
     split — one span per character, words kept unbreakable
     -----------------------------------------------------------------------
     Markup per character:
         <span class="sfx-char"><i class="sfx-real">T</i><i class="sfx-sub"></i></span>
     `sfx-real` stays in the flow for ever and only loses its visibility, so
     the character's width never changes; `sfx-sub` is absolutely positioned
     and centred over it and carries whatever noise is on screen. Words are
     wrapped in a nowrap span and the spaces between them stay as text nodes,
     so the element wraps exactly where it did before it was split.
     ----------------------------------------------------------------------- */
  /* Is this text node already owned by another effect? Two effects can be
     asked for on nested elements — the accordion columns want the <strong>
     headings decrypted and the copy around them scrambled — and without this
     the second one would split the first one's characters all over again,
     nesting spans inside spans and leaving both fighting over the same glyph. */
  function claimed(t, root) {
    var p = t.parentNode;
    while (p && p !== root && p.nodeType === 1) {
      if (p.classList.contains('sfx-char') ||
          p.dataset.sfxDecrypt || p.dataset.sfxScramble) return true;
      p = p.parentNode;
    }
    return false;
  }

  /* -----------------------------------------------------------------------
     0. The hover gate — "is the pointer ON the text?"
     -----------------------------------------------------------------------
     A block element's box is far wider than the text inside it. A two-word
     heading centred in a full-width column leaves most of its box empty, and
     both effects listened on that box: `pointerenter` on an <h2> fired from
     the far side of the column, and the scramble radius measured from a
     pointer that was nowhere near a glyph. Igor, 2026-09-14: "se ven
     afectados desde muy lejos".

     A Range over the element's contents reports one rect per rendered line
     fragment, tight to the glyphs — so this asks the real question without
     caring how the markup is shaped, and keeps working after split() has
     replaced the text with spans. Rects are viewport-relative, so the cache
     is dropped on scroll and resize. */
  var HOV = S.textHover = {
    pad: 3               // px of tolerance around each line box
  };

  function lineRects(node) {
    var range = document.createRange();
    range.selectNodeContents(node);
    var list = range.getClientRects(), out = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i].width > 0.5 && list[i].height > 0.5) out.push(list[i]);
    }
    /* No rects at all means the element is not rendering text right now
       (display:none, an empty node). Falling back to the border box would
       reintroduce the very bug this replaces, so report "not on the text". */
    return out;
  }

  function onText(rects, x, y) {
    var p = HOV.pad, i, b;
    for (i = 0; i < rects.length; i++) {
      b = rects[i];
      if (x >= b.left - p && x <= b.right + p &&
          y >= b.top - p && y <= b.bottom + p) return true;
    }
    return false;
  }

  function split(node) {
    /* Walk the TEXT NODES rather than reading textContent: these headings and
       paragraphs carry <strong> and <br>, and flattening the element to a
       string would throw that markup away. Each text node is replaced in
       place, so the structure around it survives untouched — which also means
       a heading can be targeted directly instead of having to aim at the
       <strong> inside it. */
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var texts = [], t;
    while ((t = walker.nextNode())) { if (!claimed(t, node)) texts.push(t); }

    var spans = [], i;
    texts.forEach(function (tn) {
      var text = tn.nodeValue;
      if (!text) return;
      var frag = document.createDocumentFragment(), word = null;
      for (i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (ch === ' ' || ch === '\n' || ch === '\t') {
          word = null;
          frag.appendChild(document.createTextNode(ch));
          continue;
        }
        if (!word) {
          word = document.createElement('span');
          word.className = 'sfx-word';
          frag.appendChild(word);
        }
        var s = document.createElement('span');
        s.className = 'sfx-char';
        var real = document.createElement('i');
        real.className = 'sfx-real';
        real.textContent = ch;
        var sub = document.createElement('i');
        sub.className = 'sfx-sub';
        s.appendChild(real);
        s.appendChild(sub);
        s.real = real; s.sub = sub; s.ch = ch;
        word.appendChild(s);
        spans.push(s);
      }
      tn.parentNode.replaceChild(frag, tn);
    });
    return spans;
  }

  /* Show the real glyph, or a substitute drawn over it. */
  function show(s, sub) {
    if (sub === null) {
      if (s.sub.textContent !== '') s.sub.textContent = '';
      if (s.real.style.visibility) s.real.style.visibility = '';
    } else {
      if (s.sub.textContent !== sub) s.sub.textContent = sub;
      if (!s.real.style.visibility) s.real.style.visibility = 'hidden';
    }
  }

  /* -----------------------------------------------------------------------
     1. Decrypted text
     ----------------------------------------------------------------------- */
  /* With no custom property set, the noise character inherits the colour of
     the element it stands in (see the `inherit` fallback in solutions.css). */
  function applyColour(node) {
    if (DEC.colourMode === 'custom') node.style.setProperty('--sfx-encrypted-color', DEC.colour);
    else node.style.removeProperty('--sfx-encrypted-color');
  }

  function decrypt(node) {
    if (!node || node.dataset.sfxDecrypt) return null;
    node.dataset.sfxDecrypt = '1';

    var spans = split(node);
    if (!spans.length) return null;
    applyColour(node);

    var revealed = 0, acc = 0, ticks = 0, live = false;

    /* Read every tick rather than cached, so dragging the tuner sliders retimes
       a run already in flight. */
    function interval() {
      var n = spans.length, pivot = DEC.speedPivot | 0, step = DEC.speed;
      if (pivot > 0 && n > pivot) step = step * pivot / n;
      return Math.max(DEC.speedMax, step);
    }

    function paint() {
      var roll = ticks % Math.max(1, DEC.scrambleEvery) === 0;
      for (var i = 0; i < spans.length; i++) {
        var s = spans[i];
        if (i < revealed) {
          show(s, null);
          s.classList.remove('sfx-encrypted');
        } else {
          if (roll || s.sub.textContent === '') show(s, rand(DEC.chars));
          s.classList.add('sfx-encrypted');
        }
      }
    }

    var job = {
      step: function (dt) {
        acc += dt * 1000;
        var step = interval();
        var moved = false;
        while (acc >= step) {
          acc -= step;
          ticks++;
          revealed++;
          moved = true;
        }
        if (moved) paint();
        if (revealed >= spans.length) {
          for (var i = 0; i < spans.length; i++) {
            show(spans[i], null);
            spans[i].classList.remove('sfx-encrypted');
          }
          live = false;
          return false;
        }
        return true;
      }
    };

    function run() {
      if (live) return;
      live = true;
      revealed = 0; acc = 0; ticks = 0;
      paint();
      add(job);
    }

    function arm() {
      /* Hold the finished text until the block is in view, and until the page
         has finished arriving: on a click from the Solutions page the browser
         is still morphing this very overtitle into place, and scrambling it
         mid-morph reads as a bug. S.vtReady resolves immediately on a plain
         load (view-transitions.js). */
      revealed = spans.length;
      inView(node, function () {
        var go = function () { setTimeout(run, DEC.delay); };
        if (S.vtReady && S.vtReady.then) S.vtReady.then(go, go); else go();
      });
      if (DEC.hoverReplay) {
        /* pointerenter fires on the element's BOX. What replays the heading is
           the pointer reaching the letters themselves. */
        var hrects = null;
        /* One replay per visit. Without this the effect re-fires on the next
           pointermove after it finishes, so resting the cursor on a heading
           loops it. Re-arming on pointerleave means the pointer has to leave
           the ELEMENT — not merely the letters — before it can run again.
           Igor, 2026-09-14: "hasta que saques el ratón del elemento y luego
           vuelvas". */
        var armed = true;
        /* Scroll and resize invalidate the measured rects but are NOT a visit:
           re-arming there would let a scroll under a resting cursor replay the
           heading without the pointer having gone anywhere. */
        var drop = function () { hrects = null; };
        var leave = function () { hrects = null; armed = true; };
        node.addEventListener('pointermove', function (e) {
          if (!DEC.hoverReplay || live || !armed) return;
          if (!hrects) hrects = lineRects(node);
          if (!onText(hrects, e.clientX, e.clientY)) return;
          armed = false;
          run();
        });
        node.addEventListener('pointerleave', leave);
        window.addEventListener('scroll', drop, { passive: true });
        window.addEventListener('resize', drop);
      }
    }

    arm();
    return { node: node, run: run, spans: spans };
  }

  /* -----------------------------------------------------------------------
     2. Scrambled text — proximity driven
     ----------------------------------------------------------------------- */
  function scramble(node) {
    if (!node || node.dataset.sfxScramble) return null;
    node.dataset.sfxScramble = '1';
    node.classList.add('sfx-scramble');

    var spans = split(node);
    if (!spans.length) return null;

    /* state per span: t = seconds left scrambled, f = seconds to next flip */
    var st = spans.map(function () { return { t: 0, f: 0 }; });
    var boxes = null, rects = null;

    function measure() {
      boxes = spans.map(function (s) {
        var r = s.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    }

    var job = {
      step: function (dt) {
        var busy = false;
        for (var i = 0; i < spans.length; i++) {
          var s = st[i];
          if (s.t <= 0) continue;
          busy = true;
          s.t -= dt;
          s.f -= dt;
          if (s.t <= 0) {
            show(spans[i], null);
          } else if (s.f <= 0) {
            s.f = 1 / Math.max(1, SCR.flipsPerSecond);
            show(spans[i], rand(SCR.chars));
          }
        }
        return busy;
      }
    };

    function onMove(e) {
      if (!SCR.enabled) return;
      if (!boxes) measure();
      /* The radius shapes the falloff ALONG the line; it is not a licence to
         reach the paragraph from the empty half of its box. */
      if (!rects) rects = lineRects(node);
      if (!onText(rects, e.clientX, e.clientY)) return;
      var r = SCR.radius, touched = false;
      for (var i = 0; i < spans.length; i++) {
        var b = boxes[i];
        var d = Math.hypot(e.clientX - b.x, e.clientY - b.y);
        if (d >= r) continue;
        var dur = SCR.duration * (1 - d / r);
        if (dur > st[i].t) { st[i].t = dur; st[i].f = 0; }
        touched = true;
      }
      if (touched) add(job);
    }

    node.addEventListener('pointermove', onMove);
    var forget = function () { boxes = null; rects = null; };
    node.addEventListener('pointerleave', forget);
    window.addEventListener('scroll', forget, { passive: true });
    window.addEventListener('resize', forget);

    return { node: node, spans: spans };
  }

  /* -----------------------------------------------------------------------
     3. Count up — the same spring the original gets from framer-motion
     -----------------------------------------------------------------------
     mass 1, stiffness = 100/duration, damping = 20 + 40/duration. Integrated
     here in fixed sub-steps so the result does not depend on the frame rate.
     ----------------------------------------------------------------------- */
  function countUp(node) {
    if (!node || node.dataset.sfxCount) return null;

    var raw = node.textContent.trim();
    var m = raw.match(/^([^\d\-+]*)([-+]?[\d.,]+)(.*)$/);
    if (!m) return null;
    var prefix = m[1], suffix = m[3];
    var digits = m[2];
    var decimals = (digits.split('.')[1] || '').length;
    var to = parseFloat(digits.replace(/,/g, ''));
    if (!isFinite(to)) return null;

    node.dataset.sfxCount = '1';
    node.classList.add('sfx-count');

    /* Hold the final width so the block does not step as the digits grow. */
    var w = node.getBoundingClientRect().width;
    if (w) node.style.minWidth = Math.ceil(w) + 'px';
    node.style.display = 'inline-block';

    var x = 0, v = 0;

    function fmt(n) {
      var s = n.toFixed(decimals);
      if (CNT.separator) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, CNT.separator);
      return prefix + s + suffix;
    }
    node.textContent = fmt(0);

    var job = {
      step: function (dt) {
        var k = 100 / Math.max(0.1, CNT.duration);
        var c = (20 + 40 / Math.max(0.1, CNT.duration)) * Math.max(0.05, CNT.damping);
        var n = 6, h = dt / n;
        for (var i = 0; i < n; i++) {
          var a = -k * (x - to) - c * v;
          v += a * h;
          x += v * h;
        }
        /* Stop when the DISPLAYED number can no longer change: at that point
           the snap to the exact value is invisible, which is not true of a
           relative epsilon (1000 would jump 998 -> 1000 on the last frame). */
        if (Math.abs(to - x) < 0.5 * Math.pow(10, -decimals)) {
          x = to; node.textContent = fmt(x); return false;
        }
        node.textContent = fmt(x);
        return true;
      }
    };

    inView(node, function () {
      setTimeout(function () { x = 0; v = 0; add(job); }, CNT.delay * 1000);
    });

    return { node: node, to: to };
  }

  /* -----------------------------------------------------------------------
     Wiring — which element of the saved page gets which effect
     ----------------------------------------------------------------------- */
  var made = { decrypt: [], scramble: [], count: [] };

  function q(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  /* Per-page opt-outs, applied to every effect. A single element is far easier
     to name than to carve out of a selector that is right about everything
     else on the page. Matching is by id here; if a future re-save of the page
     drops the id the effect simply comes back, which is the harmless
     direction to fail in. */
  function excluded(node, list) {
    if (!list || !list.length) return false;
    for (var i = 0; i < list.length; i++) {
      try { if (node.matches(list[i])) return true; } catch (e) {}
    }
    return false;
  }

  /* Which element of which saved page gets which effect. Both heroes are
     wired the same way — a heading that resolves out of noise and a
     standfirst that scrambles under the pointer — so the journey reads as one
     piece rather than as two different experiments. */
  var TARGETS = {
    'home': {
      decrypt: [
        '.secondary-hero .secondary-hero-title',      // Celonis Solutions
        '.title.block h2',                            // By transformation / function / industry, Featured Stories
        '.card-grid-item h3.heading',                 // every story card's title
        '.footer-heading'                             // Newsletter. / Monthly news and updates.
      ],
      scramble: ['.secondary-hero .secondary-hero-body-copy'],
      count: []
    },
    'supply-chain': {
      decrypt: [
        '.detail-page-hero .overtitle',
        '.detail-page-hero h1.title',
        '.title.block h2',                            // Make Enterprise AI… / Some of the world's… / Ready to learn more?
        '.title.block p.subtitle-box',                // Get the latest supply chain transformation insights here:
        '.basic-module.block h2',                     // Give your Enterprise AI the essential context…
        '.collapse-expand.block h2',                  // What does supply chain transformation… / Frequently Asked Questions
        '.card-grid-item h3.heading',
        '.footer-heading'
        /* NOTHING inside the accordions (Igor, 2026-09-14, final): not the item
           summaries and not the three columns of the open panel. Both were
           tried; the block reads better still. */
      ],
      scramble: [
        '.detail-page-hero .detail-text-content'
      ],
      count: ['.numbers.block p'],
      /* Removed one at a time rather than by narrowing the selectors above:
         the customer-logo strip's heading is a `.title.block h2` exactly like
         the two we want, and the only thing that separates it is which one it
         is. Igor, 2026-09-14: "mejor sin efecto" — it sits directly over a row
         of other companies' marks, and animating the sentence that introduces
         them draws the eye to the wrong half of the block. */
      exclude: [
        '#some-of-the-worlds-leading-companies-use-celonis-to-enable-ai-across-their-supply-chains'
      ]
    }
  };

  function start() {
    var page = document.documentElement.getAttribute('data-sfx-page');
    var T = TARGETS[page];
    if (!T) return;

    var skip = T.exclude;

    if (DEC.enabled) {
      T.decrypt.forEach(function (sel) {
        q(sel).forEach(function (n) {
          if (excluded(n, skip)) return;
          var r = decrypt(n); if (r) made.decrypt.push(r);
        });
      });
    }

    if (SCR.enabled) {
      T.scramble.forEach(function (sel) {
        q(sel).forEach(function (n) {
          if (excluded(n, skip)) return;
          var r = scramble(n); if (r) made.scramble.push(r);
        });
      });
    }

    if (CNT.enabled) {
      T.count.forEach(function (sel) {
        q(sel).forEach(function (n) {
          if (!/^\s*[^\d]{0,2}[\d.,]+/.test(n.textContent)) return;
          if (n.querySelector('img, picture, svg, a')) return;
          var r = countUp(n); if (r) made.count.push(r);
        });
      });
    }

    S.textMade = {
      decrypt: made.decrypt.length,
      scramble: made.scramble.length,
      count: made.count.map(function (c) { return c.to; })
    };
  }

  /* The tuner calls this to see a change straight away. */
  S.textReplay = function () {
    made.decrypt.forEach(function (d) { applyColour(d.node); d.run(); });
    made.count.forEach(function (c) {
      c.node.dataset.sfxCount = '';
      c.node.style.minWidth = '';
    });
  };

  window.SOLUTIONS_TEXT = function () {
    return {
      made: S.textMade || null,
      running: jobs.length,
      decrypt: DEC, scramble: SCR, count: CNT
    };
  };

  /* Fonts change the measured widths, so lock them after the webfont lands. */
  function boot() {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
