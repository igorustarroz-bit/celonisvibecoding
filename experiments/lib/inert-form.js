/* inert-form.js v2 — 2026-09-09. Behaviour of the inert form replicas.

   v1 kept real <input> elements so the prototype felt real: nothing could be
   sent, but you could type. That is exactly what got the site flagged as
   deceptive a second time — Google's social-engineering classifier looks at
   what the page LOOKS like and what elements it contains, not at whether a
   submit handler exists. A brand replica containing fields for name, work
   email, company, city and phone is the signature on its own.

   v2 pages therefore contain no <input>, <select> or <textarea> at all. The
   fields are <div class="inert-field"> / <span class="inert-check">
   look-alikes styled by inert-form.css. This script only keeps the buttons
   honest: they never navigate, and they say what the page is.

   RULE: never reintroduce a data-entry element on a page that replicates a
   client site. If a prototype genuinely needs typing, build it on a page that
   does not carry the client's identity.

   Shared by every experiment: ../lib/inert-form.js */
(function () {
  'use strict';

  var NOTE = 'Form disabled in this unofficial design prototype — ' +
             'the fields are a static visual replica, nothing can be typed, ' +
             'sent or stored.';

  function init() {
    // Safety net: if a saved page or a future edit ever reintroduces a real
    // field inside a replica, strip it rather than let it render.
    document.querySelectorAll('.inert-form input, .inert-form select, ' +
                              '.inert-form textarea').forEach(function (el) {
      var d = document.createElement('div');
      d.className = 'inert-field ' + (el.className || '');
      d.setAttribute('aria-hidden', 'true');
      if (el.placeholder) {
        d.innerHTML = '<span class="inert-field__ph"></span>';
        d.firstChild.textContent = el.placeholder;
      }
      el.parentNode.replaceChild(d, el);
      if (window.console) {
        console.warn('inert-form: a real input was found and removed', d);
      }
    });

    document.querySelectorAll('.inert-form').forEach(function (box) {
      box.querySelectorAll('button, [role="button"]').forEach(function (b) {
        if (b.tagName === 'BUTTON') b.type = 'button';
        b.addEventListener('click', function (e) {
          e.preventDefault();
          show(box);
        });
      });
    });
  }

  function show(box) {
    var note = box.querySelector('.inert-form__note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'inert-form__note';
      (box.querySelector('.submit') || box).appendChild(note);
    }
    note.textContent = NOTE;
    note.classList.add('is-visible');
    clearTimeout(note._t);
    note._t = setTimeout(function () {
      note.classList.remove('is-visible');
    }, 4500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
