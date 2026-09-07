/* carousel-lite.js — slide navigation for the carousels already laid out in the saved
   page (the "You arrived excited. And left inspired." quotes and the insights cards).
   Port of celonis.com/dist/chunks/carousel.js (read 2026-09-07), working on the DOM the
   site's JS had already built at save time instead of rebuilding it:
     .carousel > .carousel-slides-wrapper > ul > li.carousel-slide-width-N
     .carousel-bottom-nav-wrapper > .carousel-line-wrapper > span.carousel-line(.active)
                                  > .carousel-navigations-wrapper > button ×2 (prev, next)
   Behaviour kept from the original: the <ul> is moved with `translate: -Xpx 0` where X
   is the distance between the previous and the new slide's left edges times the new
   index; slides get .active / aria-hidden and their focusables tabindex -1; the prev
   button is disabled on the first slide and next on the last "swap"; the line for the
   current slide gets .active; swipe (touch) and drag (mouse) with a 50 px threshold;
   on phones (< 768px, 4-column grid) every slide is full width (carousel-slide-width-4)
   and the line strip scrolls when there are more than 4 lines. Autoplay (.autoplay on
   the block) is ported too although no carousel on this page uses it.
   The quotes' word-by-word reveal (.p-quote.visible) is re-armed on an
   IntersectionObserver so it plays when the block scrolls into view, as on the site. */
(function () {
  'use strict';
  var MOBILE = '(max-width: 767px)';
  var MOBILE_SLIDE_WIDTH = 4;
  function isMobile() { return window.matchMedia(MOBILE).matches; }

  function setup(block) {
    var ul = block.querySelector('.carousel-slides-wrapper > ul');
    if (!ul) return;
    var slides = Array.prototype.slice.call(ul.querySelectorAll(':scope > li'));
    if (!slides.length) return;
    var lines = Array.prototype.slice.call(block.querySelectorAll('.carousel-line'));
    var buttons = block.querySelectorAll('.carousel-navigations-wrapper button');
    var prevBtn = buttons[0] || null, nextBtn = buttons[1] || null;
    var autoplay = block.classList.contains('autoplay');

    // desktop slide width (columns of 12) from the saved class, e.g. carousel-slide-width-12
    var m = /carousel-slide-width-(\d+)/.exec(slides[0].className);
    var slidesWidth = m ? Number(m[1]) : 12;
    var count = slides.length;

    function swapCount() {
      if (isMobile() || slidesWidth > 6) return count;
      return slidesWidth * count <= 12 ? 1 : count - Math.floor(12 / slidesWidth) + 1;
    }
    function visibleCount() { return isMobile() ? 1 : Math.floor(12 / slidesWidth); }

    var index = 0, prevIndex = 0;

    function applyWidthClass() {
      var w = isMobile() ? MOBILE_SLIDE_WIDTH : slidesWidth;
      slides.forEach(function (li) {
        Array.prototype.slice.call(li.classList).forEach(function (c) { if (c.indexOf('carousel-slide-width-') === 0) li.classList.remove(c); });
        li.classList.add('carousel-slide-width-' + w);
      });
    }
    function setHidden(i) {
      slides.forEach(function (li, n) {
        var hidden = n < i || n >= i + visibleCount();
        li.setAttribute('aria-hidden', String(hidden));
        li.querySelectorAll('a[href], button, textarea, input, select, details').forEach(function (el) { el.setAttribute('tabindex', hidden ? '-1' : '0'); });
      });
    }
    function moveTo(i, from) {
      var next = slides[i], prev = slides[from];
      prev.classList.remove('active'); next.classList.add('active');
      var dx = Math.abs(next.getBoundingClientRect().x - prev.getBoundingClientRect().x);
      ul.style.translate = (dx * i * -1) + 'px 0';
      setHidden(i);
    }
    function updateButtons() {
      var hasPrev = index > 0, hasNext = index < swapCount() - 1;
      if (prevBtn) { if (hasPrev) prevBtn.removeAttribute('disabled'); else prevBtn.setAttribute('disabled', 'disabled'); }
      if (nextBtn) { if (hasNext) nextBtn.removeAttribute('disabled'); else nextBtn.setAttribute('disabled', 'disabled'); }
    }
    var lineActive = lines[0] || null;
    function autoplayNext() {
      if (lineActive && lineActive.nextSibling && !lineActive.nextSibling.classList.contains('line-extra-fill')) nextSlide();
      else goTo(0);
    }
    function armAutoplay() {
      lineActive = lines.filter(function (l) { return l.classList.contains('active'); })[0] || lineActive;
      if (!lineActive) return;
      lineActive.addEventListener('animationend', autoplayNext, { once: true });
      lineActive.classList.add('autoplay');
    }
    function updateLines() {
      if (!lines.length) return;
      var old = lineActive; lineActive = lines[index];
      if (old === lineActive) return;
      if (old) old.classList.remove('active', 'autoplay');
      lineActive.classList.add('active');
      if (isMobile() && lines.length > 4) {
        var wrap = lineActive.parentElement, forward = index > lines.indexOf(old);
        var cs = getComputedStyle(wrap);
        var lw = parseFloat(cs.getPropertyValue('--line-width')), gap = parseFloat(cs.getPropertyValue('--gap-between-lines'));
        var delta = index - Math.round(wrap.scrollLeft / (lw + gap));
        if (delta < 0 || delta > 3) wrap.scrollTo({ behavior: 'smooth', left: (index - (forward ? 3 : 0)) * (lw + gap) });
      }
      if (autoplay) { if (old) old.removeEventListener('animationend', autoplayNext); armAutoplay(); }
    }
    function change() { moveTo(index, prevIndex); updateButtons(); updateLines(); }
    function nextSlide() { if (index >= swapCount() - 1) return; prevIndex = index; index += 1; change(); }
    function prevSlide() { if (index === 0) return; prevIndex = index; index -= 1; change(); }
    function goTo(i) { if (i === index || i < 0 || i >= swapCount()) return; prevIndex = index; index = i; change(); }

    if (prevBtn) prevBtn.addEventListener('click', prevSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextSlide);

    // swipe / drag, as in the original (50 px threshold on screenX)
    var wrapper = block.querySelector('.carousel-slides-wrapper'), startX = 0, endX = 0, dragging = false;
    function judge() { if (endX < startX - 50) nextSlide(); else if (endX > startX + 50) prevSlide(); }
    wrapper.addEventListener('touchstart', function (e) { startX = e.changedTouches[0].screenX; }, { passive: true });
    wrapper.addEventListener('touchend', function (e) { endX = e.changedTouches[0].screenX; judge(); }, { passive: true });
    wrapper.addEventListener('mousedown', function (e) { startX = e.screenX; dragging = true; });
    wrapper.addEventListener('mouseup', function (e) { if (dragging) { endX = e.screenX; judge(); dragging = false; } });
    wrapper.addEventListener('mouseleave', function () { dragging = false; });

    // initial state
    applyWidthClass();
    slides.forEach(function (li, n) { li.classList.toggle('active', n === 0); });
    setHidden(0); updateButtons();
    if (lines.length) { lines.forEach(function (l, n) { l.classList.toggle('active', n === 0); l.classList.remove('autoplay'); }); lineActive = lines[0]; }
    if (autoplay) armAutoplay();

    // keep the translate consistent across the breakpoint / resizes
    var mobile = isMobile(), t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var nowMobile = isMobile();
        if (nowMobile !== mobile) { applyWidthClass(); mobile = nowMobile; }
        if (index >= swapCount()) { prevIndex = index; index = swapCount() - 1; }
        if (index === 0) { ul.style.translate = '0px 0'; setHidden(0); }
        else moveTo(index, index - 1);
        updateButtons();
      }, 150);
    });

    // quotes: word-by-word reveal of the first slide when it scrolls into view
    var quote = block.querySelector('.p-quote.visible');
    if (quote && 'IntersectionObserver' in window) {
      quote.classList.remove('visible'); quote.setAttribute('aria-hidden', 'true');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          quote.classList.add('visible'); quote.removeAttribute('aria-hidden'); io.disconnect();
        });
      }, { threshold: 0.2 });
      io.observe(quote);
    }
  }

  function init() { document.querySelectorAll('.carousel.block').forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
