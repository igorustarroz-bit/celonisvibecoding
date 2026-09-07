/* people-module-lite.js — desktop hover behaviour of the "Speaker sneak peak" block.
   Port of the runtime part of celonis.com/dist/blocks/people-module/people-module.js
   (functions b / x / S / k of the minified source, read 2026-09-07). The CSS
   (people-module.css) already reveals the photo on :hover; the JS only moves it:
   the picture's <p> gets `translate: X% Y%` following the pointer, with X in
   [-100, 0] and Y in [0, 25] (the two `.person.last` rows anchor the photo above
   the row and measure from its bottom edge instead). The element's page position
   is cached in data-left / data-top / data-bottom on the first move, because the
   picture itself is what is being translated. Desktop only (>= 1200px), throttled
   to one update per 10 ms, reset to `translate: 0 0` on mouseleave. */
(function () {
  'use strict';
  var DESKTOP = '(min-width: 1200px)';
  var MAX_Y = 25;

  function isDesktop() { return window.matchMedia(DESKTOP).matches; }

  function throttle(fn, ms) {
    var last = 0, timer = null, pendingArgs = null;
    return function () {
      var now = Date.now(); pendingArgs = arguments;
      if (now - last >= ms) { last = now; fn.apply(null, pendingArgs); return; }
      if (!timer) timer = setTimeout(function () { timer = null; last = Date.now(); fn.apply(null, pendingArgs); }, ms - (now - last));
    };
  }

  function offsets(e, pic, last) {
    var r = pic.getBoundingClientRect();
    var dx = e.pageX - Number(pic.dataset.left);
    var dy = last ? Number(pic.dataset.bottom) - e.pageY : e.pageY - Number(pic.dataset.top);
    return { x: dx / r.width * 100, y: dy / r.height * 100 };
  }

  function onMove(e) {
    if (!isDesktop()) return;
    var item = e.currentTarget;
    var pic = item.querySelector('p:has(picture)');
    if (!pic) return;
    var person = item.querySelector('.person');
    var last = !!(person && person.classList.contains('last'));
    if (!pic.dataset.left) pic.dataset.left = String(pic.getBoundingClientRect().left);
    if (!pic.dataset.top && !pic.dataset.bottom) {
      if (last) pic.dataset.bottom = String(pic.getBoundingClientRect().bottom + window.scrollY);
      else pic.dataset.top = String(pic.getBoundingClientRect().top + window.scrollY);
    }
    var o = offsets(e, pic, last), x = o.x, y = o.y;
    if (x > 0) x = 0; else if (x < -100) x = -100;
    if (last) { if (y > 0) y = 0; else if (y < MAX_Y) y = MAX_Y; }   // as on the live site
    else { if (y < 0) y = 0; else if (y > MAX_Y) y = MAX_Y; }
    pic.setAttribute('style', 'translate: ' + x + '% ' + y + '%');
  }

  function markLast(block) {
    var items = block.querySelectorAll(':scope > div:not(.load-more-item-hidden, .is-filtered-out, .load-more-wrapper)');
    block.querySelectorAll('.person.last').forEach(function (p) { p.classList.remove('last'); });
    Array.prototype.slice.call(items, -2).forEach(function (it) {
      var p = it.querySelector('.person'); if (p) p.classList.add('last');
    });
  }

  function clearCache(block) {
    block.querySelectorAll('p:has(picture)').forEach(function (pic) {
      delete pic.dataset.left; delete pic.dataset.top; delete pic.dataset.bottom;
      pic.setAttribute('style', 'translate: 0 0');
    });
  }

  function init() {
    document.querySelectorAll('.people-module.block').forEach(function (block) {
      markLast(block);
      var move = throttle(onMove, 10);
      block.querySelectorAll(':scope > div:not(.load-more-wrapper)').forEach(function (item) {
        var pic = item.querySelector('p:has(picture)');
        if (!pic) return;
        item.addEventListener('mousemove', move, { passive: true });
        item.addEventListener('mouseleave', function () { pic.setAttribute('style', 'translate: 0 0'); });
      });
      // the cached page positions are only valid for one layout
      var t;
      window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { clearCache(block); }, 150); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
