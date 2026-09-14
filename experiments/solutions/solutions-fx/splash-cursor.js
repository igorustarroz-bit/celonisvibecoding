/* =========================================================================
   Solutions — splash cursor on the home hero (experiment 7).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   react-bits' SplashCursor: a real-time fluid simulation that the pointer
   drags colour through. It is the classic Navier-Stokes-on-a-GPU sketch
   (advect -> curl -> vorticity -> divergence -> Jacobi pressure solve ->
   gradient subtract), ported here from the component's own source with the
   React shell taken off. Raw WebGL, no three.js: the simulation is a chain of
   full-screen shader passes over half-float render targets, which is nothing
   three.js would help with.

   Three deliberate differences from the original:

     * IT LIVES IN THE HERO, NOT OVER THE WHOLE PAGE. The original is a
       `position: fixed` canvas across the viewport. Here it takes the hero's
       own box — the slot the decorative <svg> sits in — so the fluid plays
       over the black hero and its circles and never runs onto the white
       sections below, where a green splash would read as a mistake rather
       than as an effect. `splash.fullPage = 1` in the tuner puts it back
       across the viewport.
     * GREEN, NOT RAINBOW. `RAINBOW_MODE` off and the colour fixed to the
       site's own accent (Igor, 2026-09-14). The original's `hexToRGB` scales
       by 0.15 before handing the colour to the simulation, because the dye
       accumulates; that factor is kept as `splash.intensity`.
     * IT STOPS. The original loops for ever. Here the loop runs while the
       pointer is moving and for `idleSeconds` afterwards — by then the dye
       has dissipated and there is nothing left to draw — and it is gated on
       an IntersectionObserver and on document.hidden. Igor's "0 draws at
       rest" rule.

   Settings: window.SOLUTIONS.splash. Console: SOLUTIONS_SPLASH().
   ========================================================================= */
(function () {
  "use strict";

  var S = (window.SOLUTIONS = window.SOLUTIONS || {});

  var CFG = S.splash = {
    enabled: 1,
    fullPage: 0,           // 0 = the hero's box, 1 = the whole viewport
    colour: '#5cfe50',     // the site's accent green
    intensity: 0.4,        // the original's hexToRGB scale factor is 0.15, which
                           // is tuned for its own mid-grey demo page; over this
                           // black hero it reads as a smudge rather than green
    simResolution: 128,
    dyeResolution: 1024,   // 1440 in the original; 1024 is kinder to a phone
    densityDissipation: 3.5,
    velocityDissipation: 2,
    pressure: 0.1,
    pressureIterations: 20,
    curl: 3,
    splatRadius: 0.2,
    splatForce: 6000,
    shading: 1,
    idleSeconds: 2.5,      // keep drawing this long after the last movement
    maxDpr: 2
  };

  var host = null, canvas = null, gl = null, ext = null;
  var raf = 0, lastTime = 0, idle = 0, visible = true, started = false;
  var dye, velocity, divergence, curl, pressure;
  var copyProgram, clearProgram, splatProgram, advectionProgram, divergenceProgram,
      curlProgram, vorticityProgram, pressureProgram, gradientSubtractProgram, displayMaterial;
  var blit = null, frames = 0, splats = 0;
  var pointer = { x: 0, y: 0, px: 0, py: 0, dx: 0, dy: 0, moved: false, inside: false };

  /* ------------------------------------------------------------- context */
  function getContext(c) {
    var params = { alpha: true, depth: false, stencil: false, antialias: false,
                   preserveDrawingBuffer: false };
    var g = c.getContext('webgl2', params);
    var isWebGL2 = !!g;
    if (!isWebGL2) g = c.getContext('webgl', params) || c.getContext('experimental-webgl', params);
    if (!g) return null;

    var halfFloat, linear;
    if (isWebGL2) {
      g.getExtension('EXT_color_buffer_float');
      linear = g.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = g.getExtension('OES_texture_half_float');
      linear = g.getExtension('OES_texture_half_float_linear');
    }
    g.clearColor(0, 0, 0, 1);
    var type = isWebGL2 ? g.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);

    function supported(internalFormat, format) {
      var t = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, t);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texImage2D(g.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      var fb = g.createFramebuffer();
      g.bindFramebuffer(g.FRAMEBUFFER, fb);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
      return g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
    }
    function pick(internalFormat, format, fallbacks) {
      if (supported(internalFormat, format)) return { internalFormat: internalFormat, format: format };
      for (var i = 0; i < fallbacks.length; i++) {
        if (supported(fallbacks[i][0], fallbacks[i][1])) {
          return { internalFormat: fallbacks[i][0], format: fallbacks[i][1] };
        }
      }
      return null;
    }

    var e;
    if (isWebGL2) {
      e = {
        formatRGBA: pick(g.RGBA16F, g.RGBA, []),
        formatRG: pick(g.RG16F, g.RG, [[g.RGBA16F, g.RGBA]]),
        formatR: pick(g.R16F, g.RED, [[g.RG16F, g.RG], [g.RGBA16F, g.RGBA]])
      };
    } else {
      e = {
        formatRGBA: pick(g.RGBA, g.RGBA, []),
        formatRG: pick(g.RGBA, g.RGBA, []),
        formatR: pick(g.RGBA, g.RGBA, [])
      };
    }
    e.halfFloatTexType = type;
    e.supportLinearFiltering = !!linear;
    gl = g;
    return e;
  }

  /* ------------------------------------------------------------- shaders */
  function compile(type, source, keywords) {
    if (keywords) source = keywords.map(function (k) { return '#define ' + k + '\n'; }).join('') + source;
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) S.splashError = gl.getShaderInfoLog(sh);
    return sh;
  }

  function link(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) S.splashError = gl.getProgramInfoLog(p);
    return p;
  }

  function uniformsOf(program) {
    var u = {}, n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS), i;
    for (i = 0; i < n; i++) {
      var name = gl.getActiveUniform(program, i).name;
      u[name] = gl.getUniformLocation(program, name);
    }
    return u;
  }

  function Program(vs, fs) {
    this.program = link(vs, fs);
    this.uniforms = uniformsOf(this.program);
  }
  Program.prototype.bind = function () { gl.useProgram(this.program); };

  function Material(vs, fsSource) {
    this.vs = vs; this.src = fsSource; this.programs = {}; this.active = null; this.uniforms = {};
  }
  Material.prototype.setKeywords = function (keys) {
    var hash = keys.join('|');
    var p = this.programs[hash];
    if (!p) { p = link(this.vs, compile(gl.FRAGMENT_SHADER, this.src, keys)); this.programs[hash] = p; }
    if (p === this.active) return;
    this.uniforms = uniformsOf(p);
    this.active = p;
  };
  Material.prototype.bind = function () { gl.useProgram(this.active); };

  var BASE_VERT = [
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv, vL, vR, vT, vB;',
    'uniform vec2 texelSize;',
    'void main () {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  vL = vUv - vec2(texelSize.x, 0.0);',
    '  vR = vUv + vec2(texelSize.x, 0.0);',
    '  vT = vUv + vec2(0.0, texelSize.y);',
    '  vB = vUv - vec2(0.0, texelSize.y);',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  var COPY_FRAG = 'precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;void main(){gl_FragColor=texture2D(uTexture,vUv);}';
  var CLEAR_FRAG = 'precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}';

  var DISPLAY_FRAG = [
    'precision highp float;',
    'precision highp sampler2D;',
    'varying vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uTexture;',
    'uniform vec2 texelSize;',
    'void main () {',
    '  vec3 c = texture2D(uTexture, vUv).rgb;',
    '  #ifdef SHADING',
    '    vec3 lc = texture2D(uTexture, vL).rgb;',
    '    vec3 rc = texture2D(uTexture, vR).rgb;',
    '    vec3 tc = texture2D(uTexture, vT).rgb;',
    '    vec3 bc = texture2D(uTexture, vB).rgb;',
    '    float dx = length(rc) - length(lc);',
    '    float dy = length(tc) - length(bc);',
    '    vec3 n = normalize(vec3(dx, dy, length(texelSize)));',
    '    float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);',
    '    c *= diffuse;',
    '  #endif',
    '  float a = max(c.r, max(c.g, c.b));',
    '  gl_FragColor = vec4(c, a);',
    '}'
  ].join('\n');

  var SPLAT_FRAG = [
    'precision highp float;precision highp sampler2D;',
    'varying vec2 vUv;uniform sampler2D uTarget;uniform float aspectRatio;',
    'uniform vec3 color;uniform vec2 point;uniform float radius;',
    'void main(){',
    '  vec2 p = vUv - point.xy; p.x *= aspectRatio;',
    '  vec3 splat = exp(-dot(p, p) / radius) * color;',
    '  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);',
    '}'
  ].join('\n');

  var ADVECTION_FRAG = [
    'precision highp float;precision highp sampler2D;',
    'varying vec2 vUv;uniform sampler2D uVelocity;uniform sampler2D uSource;',
    'uniform vec2 texelSize, dyeTexelSize;uniform float dt, dissipation;',
    'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {',
    '  vec2 st = uv / tsize - 0.5; vec2 iuv = floor(st); vec2 fuv = fract(st);',
    '  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);',
    '  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);',
    '  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);',
    '  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);',
    '  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);',
    '}',
    'void main () {',
    '  #ifdef MANUAL_FILTERING',
    '    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;',
    '    vec4 result = bilerp(uSource, coord, dyeTexelSize);',
    '  #else',
    '    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
    '    vec4 result = texture2D(uSource, coord);',
    '  #endif',
    '  gl_FragColor = result / (1.0 + dissipation * dt);',
    '}'
  ].join('\n');

  var DIVERGENCE_FRAG = [
    'precision mediump float;precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;',
    '  float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;',
    '  vec2 C = texture2D(uVelocity, vUv).xy;',
    '  if (vL.x < 0.0) { L = -C.x; } if (vR.x > 1.0) { R = -C.x; }',
    '  if (vT.y > 1.0) { T = -C.y; } if (vB.y < 0.0) { B = -C.y; }',
    '  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var CURL_FRAG = [
    'precision mediump float;precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;',
    '  float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;',
    '  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var VORTICITY_FRAG = [
    'precision highp float;precision highp sampler2D;',
    'varying vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uVelocity;uniform sampler2D uCurl;uniform float curl;uniform float dt;',
    'void main () {',
    '  float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;',
    '  float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;',
    '  float C = texture2D(uCurl, vUv).x;',
    '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
    '  force /= length(force) + 0.0001;',
    '  force *= curl * C; force.y *= -1.0;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;',
    '  gl_FragColor = vec4(min(max(velocity, -1000.0), 1000.0), 0.0, 1.0);',
    '}'
  ].join('\n');

  var PRESSURE_FRAG = [
    'precision mediump float;precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uPressure;uniform sampler2D uDivergence;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
    '  float divergence = texture2D(uDivergence, vUv).x;',
    '  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var GRADIENT_FRAG = [
    'precision mediump float;precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uPressure;uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------------- FBOs */
  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      texture: texture, fbo: fbo, width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    var a = createFBO(w, h, internalFormat, format, type, param);
    var b = createFBO(w, h, internalFormat, format, type, param);
    return {
      width: w, height: h, texelSizeX: a.texelSizeX, texelSizeY: a.texelSizeY,
      read: a, write: b,
      swap: function () { var t = this.read; this.read = this.write; this.write = t; }
    };
  }

  function resolution(target) {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    var min = Math.round(target), max = Math.round(target * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min } : { width: min, height: max };
  }

  function initFramebuffers() {
    var sim = resolution(CFG.simResolution);
    var dyeRes = resolution(CFG.dyeResolution);
    var type = ext.halfFloatTexType;
    var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    gl.disable(gl.BLEND);
    dye = createDoubleFBO(dyeRes.width, dyeRes.height, ext.formatRGBA.internalFormat, ext.formatRGBA.format, type, filtering);
    velocity = createDoubleFBO(sim.width, sim.height, ext.formatRG.internalFormat, ext.formatRG.format, type, filtering);
    divergence = createFBO(sim.width, sim.height, ext.formatR.internalFormat, ext.formatR.format, type, gl.NEAREST);
    curl = createFBO(sim.width, sim.height, ext.formatR.internalFormat, ext.formatR.format, type, gl.NEAREST);
    pressure = createDoubleFBO(sim.width, sim.height, ext.formatR.internalFormat, ext.formatR.format, type, gl.NEAREST);
  }

  /* --------------------------------------------------------------- steps */
  function step(dt) {
    gl.disable(gl.BLEND);

    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, CFG.curl);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write); velocity.swap();

    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, CFG.pressure);
    blit(pressure.write); pressure.swap();

    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (var i = 0; i < CFG.pressureIterations; i++) {
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write); pressure.swap();
    }

    gradientSubtractProgram.bind();
    gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write); velocity.swap();

    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering) {
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    }
    var vid = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, vid);
    gl.uniform1i(advectionProgram.uniforms.uSource, vid);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, CFG.velocityDissipation);
    blit(velocity.write); velocity.swap();

    if (!ext.supportLinearFiltering) {
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    }
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.uniforms.dissipation, CFG.densityDissipation);
    blit(dye.write); dye.swap();
  }

  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    displayMaterial.bind();
    if (CFG.shading) {
      gl.uniform2f(displayMaterial.uniforms.texelSize,
                   1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
    }
    gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    blit(null);
  }

  /* --------------------------------------------------------------- input */
  function colour() {
    var hex = String(CFG.colour).replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var k = CFG.intensity;
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255 * k,
      g: parseInt(hex.slice(2, 4), 16) / 255 * k,
      b: parseInt(hex.slice(4, 6), 16) / 255 * k
    };
  }

  function correctRadius(r) {
    var aspect = canvas.width / canvas.height;
    return aspect > 1 ? r * aspect : r;
  }

  function splat(x, y, dx, dy, col) {
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
    gl.uniform1f(splatProgram.uniforms.radius, correctRadius(CFG.splatRadius / 100));
    blit(velocity.write); velocity.swap();

    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, col.r, col.g, col.b);
    blit(dye.write); dye.swap();
    splats++;
  }

  function onMove(e) {
    if (!CFG.enabled || !canvas) return;
    var box = canvas.getBoundingClientRect();
    var x = e.clientX - box.left, y = e.clientY - box.top;
    var inside = x >= 0 && y >= 0 && x <= box.width && y <= box.height;
    var tx = x / box.width, ty = 1 - y / box.height;
    if (!pointer.inside && inside) { pointer.px = tx; pointer.py = ty; }
    pointer.dx = (tx - pointer.px) * (box.width / box.height > 1 ? 1 : box.width / box.height);
    pointer.dy = (ty - pointer.py) * (box.width / box.height > 1 ? box.height / box.width : 1);
    pointer.px = tx; pointer.py = ty;
    pointer.inside = inside;
    if (!inside) return;
    if (Math.abs(pointer.dx) > 0 || Math.abs(pointer.dy) > 0) pointer.moved = true;
    idle = 0;
    kick();
  }

  function onDown(e) {
    if (!CFG.enabled || !canvas) return;
    onMove(e);
    if (!pointer.inside) return;
    var c = colour();
    splat(pointer.px, pointer.py, 10 * (Math.random() - 0.5), 30 * (Math.random() - 0.5),
          { r: c.r * 10, g: c.g * 10, b: c.b * 10 });
    idle = 0;
    kick();
  }

  /* ---------------------------------------------------------------- loop */
  function frame(now) {
    raf = 0;
    /* Two different clocks on purpose. The simulation gets a CLAMPED step,
       because a long frame would blow it up — that clamp is the original's.
       The idle counter gets the REAL elapsed time: on a slow renderer the
       loop may only manage three frames a second, and counting 16 ms per
       frame would mean "2.5 seconds idle" took the best part of a minute to
       reach, so the loop never stopped. */
    var real = (now - lastTime) / 1000 || 0.016;
    var dt = Math.min(0.016666, real);
    lastTime = now;

    if (resize()) initFramebuffers();

    if (pointer.moved) {
      pointer.moved = false;
      splat(pointer.px, pointer.py, pointer.dx * CFG.splatForce, pointer.dy * CFG.splatForce, colour());
      idle = 0;
    } else {
      idle += real;
    }

    step(dt);
    render();
    frames++;

    /* The dye dissipates on its own; once the pointer has been still for
       `idleSeconds` there is nothing left on screen, so the loop can stop. */
    if (idle < CFG.idleSeconds && visible && !document.hidden) kick();
  }

  function kick() {
    if (raf || !visible || document.hidden || !CFG.enabled) return;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, CFG.maxDpr));
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (w < 1 || h < 1) return false;
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w; canvas.height = h;
    return true;
  }

  /* ---------------------------------------------------------------- boot */
  function findHost() {
    if (CFG.fullPage) return document.body;
    var wrap = document.querySelector('.secondary-hero-wrapper');
    if (!wrap) return null;
    var svg = wrap.querySelector('svg.secondary-hero-background');
    return (svg && svg.parentElement) || wrap;
  }

  function start() {
    if (document.documentElement.getAttribute('data-sfx-page') !== 'home') return;
    host = findHost();
    if (!host) return;

    canvas = document.createElement('canvas');
    canvas.className = 'sfx-splash-canvas' + (CFG.fullPage ? ' sfx-splash-canvas--full' : '');
    host.appendChild(canvas);

    ext = getContext(canvas);
    if (!ext || !ext.formatRGBA) { canvas.remove(); S.splashError = 'no webgl'; return; }
    if (!ext.supportLinearFiltering) { CFG.dyeResolution = 256; CFG.shading = 0; }

    var vs = compile(gl.VERTEX_SHADER, BASE_VERT);
    copyProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, COPY_FRAG));
    clearProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, CLEAR_FRAG));
    splatProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, SPLAT_FRAG));
    advectionProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, ADVECTION_FRAG,
      ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']));
    divergenceProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, DIVERGENCE_FRAG));
    curlProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, CURL_FRAG));
    vorticityProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, VORTICITY_FRAG));
    pressureProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, PRESSURE_FRAG));
    gradientSubtractProgram = new Program(vs, compile(gl.FRAGMENT_SHADER, GRADIENT_FRAG));
    displayMaterial = new Material(vs, DISPLAY_FRAG);
    displayMaterial.setKeywords(CFG.shading ? ['SHADING'] : []);

    blit = (function () {
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      return function (target, clear) {
        if (!target) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    resize();
    initFramebuffers();
    started = true;

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('resize', function () { if (resize()) initFramebuffers(); kick(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) kick();
      }, { threshold: 0 }).observe(canvas);
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { if (resize()) initFramebuffers(); kick(); }).observe(host);
    }
  }

  S.splashApply = function () {
    if (!canvas) return;
    canvas.classList.toggle('sfx-splash-canvas--full', !!CFG.fullPage);
    canvas.style.display = CFG.enabled ? '' : 'none';
    if (displayMaterial) displayMaterial.setKeywords(CFG.shading ? ['SHADING'] : []);
    if (resize()) initFramebuffers();
    idle = 0;
    kick();
  };

  window.SOLUTIONS_SPLASH = function () {
    return {
      started: started,
      webgl2: !!(gl && gl.getParameter && typeof WebGL2RenderingContext !== 'undefined' &&
                 gl instanceof WebGL2RenderingContext),
      linearFiltering: ext && ext.supportLinearFiltering,
      size: canvas ? [canvas.width, canvas.height] : null,
      dye: dye ? [dye.width, dye.height] : null,
      framesDrawn: frames,
      splats: splats,
      looping: !!raf,
      visible: visible,
      error: S.splashError || null
    };
  };

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
