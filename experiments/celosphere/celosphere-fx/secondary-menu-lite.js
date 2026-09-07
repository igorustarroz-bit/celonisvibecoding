/* secondary-menu-lite.js — minimal replacement for the site's secondary-menu block JS.
   The saved page was captured at desktop width, where the section carries the
   class `secondary-menu-extensive` (links laid out in a row). On the live site
   dist/blocks/secondary-menu/secondary-menu.js toggles that class at runtime:
   compact mode (a "selection" row + dropdown) on phones/tablets or when there are
   more than 6 links, extensive mode otherwise. Without it the row layout also
   applies on phones and the links collapse into vertical letters.
   This file only reproduces that switch and the open/close of the dropdown;
   it is loaded by index.html and original.html with its own ?v=. */
(function () {
  'use strict';
  var DESKTOP = '(min-width: 1200px)';
  var MAX_INLINE_LINKS = 6;

  function init() {
    var section = document.querySelector('.secondary-menu-container');
    if (!section) return;
    var links = section.querySelector('.secondary-menu-links');
    var button = section.querySelector('.secondary-menu-selection button');
    if (!links || !button) return;
    var count = links.querySelectorAll('a').length;

    function close() {
      section.classList.remove('open');
      button.classList.remove('open');
      button.setAttribute('aria-label', 'Open menu');
      if (!section.classList.contains('secondary-menu-extensive')) links.classList.add('hidden');
    }
    function apply() {
      var extensive = window.matchMedia(DESKTOP).matches && count <= MAX_INLINE_LINKS;
      section.classList.toggle('secondary-menu-extensive', extensive);
      if (extensive) links.classList.remove('hidden');
      close();
    }
    button.addEventListener('click', function () {
      if (section.classList.contains('secondary-menu-extensive')) return;
      var open = !section.classList.contains('open');
      section.classList.toggle('open', open);
      button.classList.toggle('open', open);
      links.classList.toggle('hidden', !open);
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(apply, 250); });
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
