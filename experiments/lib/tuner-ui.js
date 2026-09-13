/* =========================================================================
   tuner-ui.js — the shared tuner panel used by every experiment.
   Companion stylesheet: lib/tuner-ui.css.

   Why it exists (2026-09-13)
   --------------------------
   Each experiment had grown its own copy of the same panel, and on 2026-09-09
   all of them were put behind a "?tuner" gate because they were built from
   <input type="range"> — which anti-phishing rule 12 forbids on a page that
   replicates the client's site. Hiding the handles is not an option: Igor's
   standing rule is that the finished version of an experiment always ships
   them, and always shows what the antialias is really doing.

   So the controls are rebuilt from <div>s. The panel contains no <input>,
   <select>, <textarea> or <form> — mount() asserts that — and can therefore
   be visible on load again, collapsed, exactly as it was before the gate.

   Two behaviours Igor asked to have everywhere, 2026-09-13:
     * double-click a row to put that single knob back to its default. The
       value turns amber while it differs, so a glance says what was touched.
     * the variable the knob writes to is printed under its label, so a value
       read on screen can be found by name in the code or in a settings JSON.

   Usage
   -----
     var t = TunerUI.create({ title: 'CONTEXT TUNER', target: CFG,
                              accent: '#7fd7c4', onChange: apply });
     t.section('Lens');
     t.slider('radius', 'lensRadius', 0.1, 1, 0.001);
     t.choice('MSAA', 'quality.msaa', [0, 2, 4, 8]);
     t.colour('sky top', 'skyTop');
     t.readout(function () { return 'in effect: ' + …; });
     t.actions();
     t.mount();

   `target` is the live settings object the render loop reads; paths may be
   dotted ('quality.msaa'). Defaults are deep-cloned at create() time unless
   an explicit `defaults` object is passed. onChange(path, value, tag) runs on
   every change, where `tag` is whatever was handed to the knob as `extra` —
   the experiments use it to flag the changes that need a geometry rebuild.
   ========================================================================= */
(function (global) {
  'use strict';

  var EPS = 1e-9;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* Enough digits to see a change, few enough to fit the 46 px value column. */
  function fmt(v) {
    if (typeof v === 'string') return v;
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    var a = Math.abs(n);
    if (a >= 100 || Number.isInteger(n)) return String(n);
    return a < 0.02 ? n.toFixed(4) : (a < 1 ? n.toFixed(3) : n.toFixed(2));
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function getPath(obj, path) {
    return String(path).split('.').reduce(function (o, k) {
      return (o === null || o === undefined) ? undefined : o[k];
    }, obj);
  }

  function setPath(obj, path, val) {
    var ks = String(path).split('.'), o = obj, i;
    for (i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] === null || o[ks[i]] === undefined) o[ks[i]] = {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
  }

  /* Functions do not survive JSON, which is what we want: the defaults copy
     holds values only. */
  function plain(o) {
    return JSON.parse(JSON.stringify(o, function (k, v) {
      return typeof v === 'function' ? undefined : v;
    }));
  }

  function deepAssign(dst, src) {
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) &&
          dst[k] && typeof dst[k] === 'object') deepAssign(dst[k], src[k]);
      else dst[k] = src[k];
    }
    return dst;
  }

  function same(a, b) {
    if (typeof a === 'number' || typeof b === 'number') {
      return Math.abs(Number(a) - Number(b)) <= EPS;
    }
    return String(a) === String(b);
  }

  /* ---- colours: the swatch and its three channels work in #rrggbb -------- */
  function hexToRgb(hex) {
    var h = String(hex).trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!isFinite(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    function p(x) { var s = clamp(Math.round(x), 0, 255).toString(16); return s.length < 2 ? '0' + s : s; }
    return '#' + p(r) + p(g) + p(b);
  }

  /* =======================================================================
     The slider. A track, a fill and a thumb; pointer drag, arrow keys,
     Home/End, Shift for ten steps at a time. touch-action:none in the CSS
     keeps a drag on a phone from scrolling the (scroll-driven) page.
     ======================================================================= */
  function makeSlider(min, max, step, read, write) {
    var track = el('div', 'tu-track');
    var fill = el('div', 'tu-fill');
    var thumb = el('div', 'tu-thumb');
    track.appendChild(fill);
    track.appendChild(thumb);
    track.setAttribute('role', 'slider');
    track.setAttribute('tabindex', '0');
    track.setAttribute('aria-valuemin', String(min));
    track.setAttribute('aria-valuemax', String(max));

    function tidy(v) { return Number(Number(v).toFixed(6)); }

    function snap(v) {
      if (!step) return clamp(v, min, max);
      return clamp(tidy(min + Math.round((v - min) / step) * step), min, max);
    }

    function paint() {
      var v = Number(read());
      var t = (max === min) ? 0 : clamp((v - min) / (max - min), 0, 1);
      fill.style.width = (t * 100) + '%';
      thumb.style.left = (t * 100) + '%';
      track.setAttribute('aria-valuenow', String(v));
    }

    function fromEvent(e) {
      var r = track.getBoundingClientRect();
      var t = r.width ? (e.clientX - r.left) / r.width : 0;
      write(snap(min + clamp(t, 0, 1) * (max - min)));
      paint();
    }

    var dragging = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* older Safari */ }
      fromEvent(e);
      e.preventDefault();
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      fromEvent(e);
      e.preventDefault();
    });
    function release(e) {
      if (!dragging) return;
      dragging = false;
      try { track.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);

    track.addEventListener('keydown', function (e) {
      var dir = 0;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') dir = -1;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') dir = 1;
      else if (e.key === 'Home') { write(min); paint(); e.preventDefault(); return; }
      else if (e.key === 'End') { write(max); paint(); e.preventDefault(); return; }
      else return;
      var s = (step || (max - min) / 100) * (e.shiftKey ? 10 : 1);
      write(snap(Number(read()) + dir * s));
      paint();
      e.preventDefault();
    });

    paint();
    return { node: track, paint: paint, busy: function () { return dragging; } };
  }

  /* =======================================================================
     The panel
     ======================================================================= */
  function Panel(opts) {
    opts = opts || {};
    var self = this;

    this.target = opts.target || {};
    this.defaults = plain(opts.defaults || this.target);
    this.onChange = opts.onChange || function () {};
    this.onReset = opts.onReset || null;      // called after a full Reset
    this.rows = [];
    this.timers = [];

    var panel = el('div', 'tu-panel tu-closed');
    panel.id = opts.id || 'tuner';
    if (opts.accent) panel.style.setProperty('--tu-accent', opts.accent);
    this.root = panel;

    var head = el('div', 'tu-head');
    head.appendChild(el('span', 'tu-dot', '●'));
    head.appendChild(el('div', 'tu-title', opts.title || 'TUNER'));
    var toggle = el('button', 'tu-icon', '▲');
    toggle.type = 'button';
    toggle.title = 'Expand / collapse';
    var close = el('button', 'tu-icon', '×');
    close.type = 'button';
    close.title = 'Hide the panel (press T to bring it back)';
    var ctl = el('div', 'tu-ctl');
    ctl.appendChild(toggle);
    ctl.appendChild(close);
    head.appendChild(ctl);
    panel.appendChild(head);
    this.toggleBtn = toggle;

    var body = el('div', 'tu-body');
    panel.appendChild(body);
    this.body = body;

    head.addEventListener('click', function (e) {
      if (e.target === close) { self.hide(); return; }
      self.setOpen(panel.classList.contains('tu-closed'));
    });
  }

  Panel.prototype.setOpen = function (open) {
    this.root.classList.toggle('tu-closed', !open);
    this.toggleBtn.textContent = open ? '▼' : '▲';
    return this;
  };
  Panel.prototype.open = function () { return this.setOpen(true); };
  Panel.prototype.collapse = function () { return this.setOpen(false); };
  Panel.prototype.show = function () { this.root.classList.remove('tu-hidden'); return this; };
  Panel.prototype.hide = function () { this.root.classList.add('tu-hidden'); return this; };
  Panel.prototype.toggle = function () { this.root.classList.toggle('tu-hidden'); return this; };

  Panel.prototype.section = function (name) {
    this.body.appendChild(el('div', 'tu-section', name));
    return this;
  };

  Panel.prototype.note = function (text) {
    this.body.appendChild(el('div', 'tu-hint', text));
    return this;
  };

  /* The shared skeleton of every knob: label, variable name underneath,
     value at the right, amber while it differs from the default, and a
     double-click anywhere on the row to put that default back. */
  Panel.prototype._row = function (label, path) {
    var self = this;
    var row = el('div', 'tu-row');
    var lab = el('div', 'tu-label');
    lab.appendChild(el('div', 'tu-name', label));
    lab.appendChild(el('div', 'tu-key', path));
    var val = el('div', 'tu-val');
    row.appendChild(lab);
    row.appendChild(val);

    var entry = {
      path: path, row: row, val: val, extra: null,
      paint: function () {},          // filled in by the concrete control
      show: function (v) { return fmt(v); }
    };

    entry.mark = function () {
      var now = getPath(self.target, path);
      var def = getPath(self.defaults, path);
      var changed = !same(now, def);
      val.classList.toggle('tu-changed', changed);
      row.classList.toggle('tu-dirty', changed);
      row.title = changed
        ? 'Double-click to reset ' + path + ' to ' + entry.show(def)
        : path + ' — at its default';
    };

    entry.refresh = function () {
      val.textContent = entry.show(getPath(self.target, path));
      entry.paint();
      entry.mark();
    };

    row.addEventListener('dblclick', function (e) {
      e.preventDefault();
      self.reset(path);
    });

    this.rows.push(entry);
    this.body.appendChild(row);
    return entry;
  };

  Panel.prototype._commit = function (entry, value, extra) {
    setPath(this.target, entry.path, value);
    entry.val.textContent = entry.show(value);
    entry.mark();
    this.onChange(entry.path, value, extra);
  };

  /* A continuous knob.

     `opts` is either the `extra` tag handed back to onChange, or an object:
       extra  — the tag (what has to be rebuilt, usually)
       read   — stored value  -> the number the slider shows
       write  — the number the slider shows -> stored value
       fmt    — how to print the shown number (e.g. degrees)
     read/write exist for the knobs whose natural control is not what the code
     stores: the book's "opening angle" is one number to a designer and half of
     its complement in the scene graph. min/max/step are in shown units. */
  Panel.prototype.slider = function (label, path, min, max, step, opts) {
    var self = this;
    opts = (opts && typeof opts === 'object' && !Array.isArray(opts)) ? opts : { extra: opts };
    var rd = opts.read || function (v) { return v; };
    var wr = opts.write || function (v) { return v; };
    var entry = this._row(label, path);
    entry.extra = opts.extra;
    if (opts.fmt || opts.read) {
      entry.show = function (v) { return (opts.fmt || fmt)(rd(v)); };
    }
    var s = makeSlider(min, max, step, function () {
      return rd(getPath(self.target, path));
    }, function (v) {
      self._commit(entry, wr(v), opts.extra);
    });
    entry.paint = s.paint;
    entry.row.appendChild(s.node);
    entry.refresh();
    return this;
  };

  /* A plain action — "open / close the book", and the like. Not a knob: it has
     no value, no default and no double-click reset. */
  Panel.prototype.button = function (label, fn, primary) {
    var wrap = el('div', 'tu-actions');
    var b = el('button', 'tu-btn' + (primary ? ' tu-primary' : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    wrap.appendChild(b);
    this.body.appendChild(wrap);
    return this;
  };

  /* A short list of discrete values, as chips. Replaces <select>. */
  Panel.prototype.choice = function (label, path, values, extra) {
    var self = this;
    var entry = this._row(label, path);
    entry.extra = extra;
    var wrap = el('div', 'tu-chips');
    var chips = values.map(function (v) {
      var chip = el('div', 'tu-chip', String(v));
      chip.addEventListener('click', function () { self._commit(entry, v, extra); });
      wrap.appendChild(chip);
      return chip;
    });
    entry.paint = function () {
      var now = getPath(self.target, path);
      chips.forEach(function (chip, i) { chip.classList.toggle('tu-on', same(values[i], now)); });
    };
    entry.row.appendChild(wrap);
    entry.refresh();
    return this;
  };

  /* A colour, as a swatch that opens three channel sliders. Replaces
     <input type=color>, which is a data-entry element like any other. */
  Panel.prototype.colour = function (label, path, extra) {
    var self = this;
    var entry = this._row(label, path);
    entry.extra = extra;
    entry.show = function (v) { return String(v).toUpperCase(); };

    var swatch = el('div', 'tu-swatch');
    swatch.title = 'Click to open the R / G / B channels';
    var channels = el('div', 'tu-channels');
    entry.row.appendChild(swatch);
    entry.row.appendChild(channels);

    swatch.addEventListener('click', function () { entry.row.classList.toggle('tu-open'); });

    var parts = [];
    ['r', 'g', 'b'].forEach(function (ch) {
      var line = el('div', 'tu-chan');
      line.appendChild(el('div', 'tu-name', ch.toUpperCase()));
      var num = el('div', 'tu-val');
      var s = makeSlider(0, 255, 1, function () {
        return hexToRgb(getPath(self.target, path))[ch];
      }, function (v) {
        var rgb = hexToRgb(getPath(self.target, path));
        rgb[ch] = v;
        self._commit(entry, rgbToHex(rgb.r, rgb.g, rgb.b), extra);
        entry.paint();
      });
      line.appendChild(s.node);
      line.appendChild(num);
      channels.appendChild(line);
      parts.push({ ch: ch, slider: s, num: num });
    });

    entry.paint = function () {
      var hex = getPath(self.target, path);
      var rgb = hexToRgb(hex);
      swatch.style.background = hex;
      parts.forEach(function (p) { p.num.textContent = String(rgb[p.ch]); p.slider.paint(); });
    };
    entry.refresh();
    return this;
  };

  /* A control that is not a setting: it reads and writes something live in the
     scene — the celosphere scrub, which drives the real page scroll so the effect
     goes through exactly the same code path as a reader scrolling. It has no
     default, so no double-click reset and it never goes amber; instead it follows
     the scene on a timer while nobody is dragging it. */
  Panel.prototype.live = function (label, name, min, max, step, read, write, show) {
    show = show || fmt;
    var row = el('div', 'tu-row');
    var lab = el('div', 'tu-label');
    lab.appendChild(el('div', 'tu-name', label));
    lab.appendChild(el('div', 'tu-key', name));
    var val = el('div', 'tu-val');
    row.appendChild(lab);
    row.appendChild(val);
    var s = makeSlider(min, max, step, read, function (v) {
      write(v);
      val.textContent = show(v);
    });
    row.appendChild(s.node);
    row.title = name + ' — live, not a stored setting';
    val.textContent = show(read());
    this.body.appendChild(row);
    this.timers.push(setInterval(function () {
      if (s.busy()) return;
      s.paint();
      val.textContent = show(read());
    }, 150));
    return this;
  };

  /* A live text read-out — the experiments use it for "what the antialias is
     really doing", which Igor wants on every panel. */
  Panel.prototype.readout = function (fn, everyMs) {
    var box = el('div', 'tu-readout');
    this.body.appendChild(box);
    function tick() {
      try { box.textContent = fn(); } catch (e) { box.textContent = '…'; }
    }
    tick();
    this.timers.push(setInterval(tick, everyMs || 500));
    return this;
  };

  /* Copy settings / Reset.

     The dump is a <pre>, not a <textarea> (rule 12). It is selected
     programmatically, so the legacy execCommand path still copies it and
     Cmd+C works when neither route is allowed — which is the normal case
     from file://, where the async clipboard API needs a secure context. */
  Panel.prototype.actions = function (opts) {
    var self = this;
    opts = opts || {};
    var wrap = el('div', 'tu-actions');
    var copy = el('button', 'tu-btn', 'Copy settings');
    copy.type = 'button';
    var reset = el('button', 'tu-btn', 'Reset');
    reset.type = 'button';
    wrap.appendChild(copy);
    wrap.appendChild(reset);
    this.body.appendChild(wrap);

    var status = el('div', 'tu-status');
    this.body.appendChild(status);
    var dump = null;

    function serialise() {
      return JSON.stringify(opts.serialise ? opts.serialise() : self.target, function (k, v) {
        return typeof v === 'function' ? undefined : v;
      }, 2);
    }

    function showDump(txt) {
      if (!dump) { dump = el('pre', 'tu-dump'); self.body.appendChild(dump); }
      dump.textContent = txt;
      var sel = global.getSelection && global.getSelection();
      if (!sel) return;
      var range = document.createRange();
      range.selectNodeContents(dump);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    copy.addEventListener('click', function () {
      var txt = serialise();
      console.log(txt);
      showDump(txt);                                   // selected and ready for Cmd+C
      var changed = self.changedPaths();
      var stamp = new Date().toTimeString().slice(0, 8);
      function done(ok) {
        copy.textContent = ok ? 'Copied' : 'Select & copy ↓';
        status.textContent = (ok ? 'Copied ' : 'Not copied — the text below is selected · ') +
          stamp + ' · ' + (changed.length
            ? changed.length + ' changed from defaults: ' + changed.join(', ')
            : 'all values are the defaults');
        setTimeout(function () { copy.textContent = 'Copy settings'; }, 1600);
      }
      function legacy() {
        try { return document.execCommand('copy'); } catch (e) { return false; }
      }
      if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { done(true); },
                                                function () { done(legacy()); });
      } else done(legacy());
    });

    reset.addEventListener('click', function () {
      deepAssign(self.target, self.defaults);
      self.refresh();
      self.onChange(null, null, null);
      if (self.onReset) self.onReset();
      status.textContent = 'All knobs back to their defaults.';
    });
    return this;
  };

  Panel.prototype.hint = function (text) {
    this.body.appendChild(el('div', 'tu-hint', text ||
      'Double-click a row to reset that knob — amber means it differs from the default. ' +
      'The line under each label is the variable it writes to. T hides or shows this panel.'));
    return this;
  };

  Panel.prototype.changedPaths = function () {
    var self = this;
    return this.rows.filter(function (r) {
      return !same(getPath(self.target, r.path), getPath(self.defaults, r.path));
    }).map(function (r) { return r.path; });
  };

  Panel.prototype.reset = function (path) {
    var def = getPath(this.defaults, path);
    setPath(this.target, path, def);
    var entry = null;
    this.rows.forEach(function (r) { if (r.path === path) entry = r; });
    if (entry) entry.refresh();
    this.onChange(path, def, entry ? entry.extra : null);
    return this;
  };

  /* Repaint every knob from the live object — after a Reset, or after the
     experiment changed a value on its own. */
  Panel.prototype.refresh = function () {
    this.rows.forEach(function (r) { r.refresh(); });
    return this;
  };

  /* Put the panel on the page and check the rule-12 promise holds. */
  Panel.prototype.mount = function (parent) {
    (parent || document.body).appendChild(this.root);
    var bad = this.root.querySelectorAll('input, select, textarea, form');
    if (bad.length) {
      console.warn('[tuner-ui] ' + bad.length + ' data-entry element(s) inside the panel — ' +
                   'anti-phishing rule 12 says there must be none', bad);
    }
    return this;
  };

  Panel.prototype.destroy = function () {
    this.timers.forEach(clearInterval);
    this.timers.length = 0;
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    return this;
  };

  /* =======================================================================
     Module surface
     ======================================================================= */
  var TunerUI = {
    create: function (opts) { return new Panel(opts); },
    fmt: fmt,
    get: getPath,
    set: setPath,

    /* Wire the T key to a panel. No INPUT/TEXTAREA/SELECT guard is needed any
       more — there are none on these pages — but a modifier still passes
       through so browser shortcuts keep working. */
    hotkey: function (panel, key) {
      var k = (key || 't').toLowerCase();
      document.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (String(e.key).toLowerCase() !== k) return;
        panel.toggle();
      });
      return panel;
    },

    /* What a browser check should report on a published page: zero. */
    audit: function () {
      return document.querySelectorAll('input, select, textarea, form').length;
    },

    ready: function (fn) {
      if (document.readyState !== 'loading') fn();
      else document.addEventListener('DOMContentLoaded', fn);
    }
  };

  global.TunerUI = TunerUI;
})(typeof window !== 'undefined' ? window : this);
