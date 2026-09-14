/* =========================================================================
   Solutions — Fluid Glass over the hero circles (experiment 7).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   What it does
   ------------
   react-bits' FluidGlass in "lens" mode: a thick glass lens follows the
   pointer and refracts whatever is behind it. It has TWO sources, because
   Igor moved it once:

     source: 'video'    (default, supply chain page) — the lens sits over the
                        hero video and bends it. This is the closest thing to
                        the original component, which refracts images.
     source: 'circles'  (the home page until 2026-09-14) — the lens sits over
                        the hero's three pairs of decorative circles, which
                        are redrawn inside the canvas so there is something
                        for it to refract. Kept because it works and is one
                        line away; the home hero now runs splash-cursor.js.

   Why the source has to be redrawn inside the canvas
   --------------------------------------------------
   FluidGlass renders its own content into a frame buffer and the lens
   samples that buffer. WebGL cannot sample the DOM, so anything the lens is
   to refract has to be inside the canvas — there is no way to put a lens
   "over" a DOM element and have it bend what is underneath.

   For the VIDEO that is easy: the <video> element keeps playing (it is the
   only thing that can decode the file) and becomes a THREE.VideoTexture; the
   canvas, sized to the same box, draws the frame and the lens over it. The
   video is same-origin, so the texture never taints.

   The <video> underneath is deliberately LEFT VISIBLE. It was hidden at first,
   which is tidier and costs nothing when everything works — but every way the
   canvas can fail quietly (a texture the driver declines, a context that is
   never restored) then leaves a black rectangle where the video was, and that
   is exactly what happened on Igor's machine while every check here passed.
   The canvas is opaque where it draws, so the element underneath is invisible
   anyway when things go well, and is the fallback when they do not.

   For the CIRCLES it means owning them: six arcs with a known geometry
   (viewBox 1440x732, centres and radii straight out of the markup), which
   also means the dash-in and the endless turn are ours to tune. The <svg>
   stays in the page as the fallback and is only hidden once this file
   reports it is drawing.

   Both the dash timeline and the group rotations are the page's own:
     circle-l  cx -108 cy 366 r 462, group rotated  90deg
     circle-m  cx  720 cy 366 r 366, group rotated -90deg
     circle-s  cx 1286 cy 366 r 200, group rotated -90deg
     -1 strokes #333    dashoffset 1 -> 2    3 s ease-in-out   (full ring)
     -2 strokes #767676 dashoffset 1 -> 0.5 (m) / 1.5 (l, s)
                        2 s ease-in-out after 3 s, then a 10 s linear turn,
                        forwards for m, backwards for l and s.

   The arcs are drawn analytically (distance to the circle, antialiased with
   fwidth) rather than as ring geometry: a 2 px stroke is exactly the case
   where MSAA is not enough and a signed distance is free.

   Two traps this file already fell into, both silent — nothing is drawn and
   nothing is logged:
     * the arc camera has top = 0 and bottom = H so that y runs down the page,
       and the lens writes gl_Position itself with the same flip. A flipped
       projection REVERSES the triangle winding, so with the default
       THREE.FrontSide every quad is back-face culled. Both materials are
       THREE.DoubleSide for that reason; do not "tidy" it away.
     * smoothstep(a, b, x) with a > b is undefined in GLSL, not a reversed
       ramp. The soft end of an arc is 1.0 - smoothstep(lo, hi, m).

   The hero TEXT is in the buffer too (Igor, 2026-09-14: the lens has to affect
   the text as well). Same reason as the circles — WebGL cannot sample the DOM —
   so "Celonis Solutions" and its standfirst are rasterised into a 2D canvas and
   uploaded as a texture that is drawn over the arcs before the lens samples
   them. The layout is not reproduced: each WORD is wrapped in a span, its own
   `getBoundingClientRect()` says where it goes, and the font, colour and
   letter-spacing come from `getComputedStyle`, so the browser's own wrapping,
   line-height and clamping are what end up on screen. The DOM text then goes
   `color: transparent` rather than `visibility: hidden`, which keeps it
   selectable, keeps it in the accessibility tree, and — the reason it matters
   here — keeps the `::before` white square of the standfirst visible, since
   that square is a background colour and not text.

   Stack: three.js r147 from ../../lib, an orthographic camera in CSS pixels
   (top = 0, so y runs down like the page), one MSAA render target for the
   arcs, a screen pass that blits it and draws the lens over it, and an
   optional FXAA blit. No textures, no GLB, no external request: it works
   from file:// as well as over http.

   Settings: window.SOLUTIONS.glass. Console: SOLUTIONS_GLASS().
   ========================================================================= */
(function () {
  "use strict";

  var S = (window.SOLUTIONS = window.SOLUTIONS || {});

  var CFG = S.glass = {
    enabled: 1,           // 0 hides the canvas and lets the DOM source paint on
                          //   its own — the two-second way to tell "the lens is
                          //   broken" from "the video is missing"
    source: 'video',      // 'video' | 'circles' — see the header

    // --- the lens -----------------------------------------------------
    radius: 190,          // px on screen
    radiusCap: 0.33,      // never wider than this fraction of the shorter side,
                          // so the lens does not swallow a 390 px hero
    ior: 1.22,            // index of refraction
    thickness: 62,        // px of screen-space displacement at the rim
    bulge: 1.0,           // 0 = flat disc, 1 = full hemisphere normal
    chroma: 0.10,         // chromatic aberration, r/b split
    rim: 0.45,            // Fresnel white at the edge
    rimPower: 3.0,
    spec: 0.20,           // highlight. Softer than the 0.35 that read well over
    specSize: 0.34,       //   the black hero: over a bright video the same
                          //   value washes the frame out under the glass.
    body: 0.03,           // faint dark body, so the glass reads on empty black
    edge: 0.30,           // bright inner contour
    followTau: 0.10,      // s, pointer damping (react-bits uses damp3 0.15)
    parkX: 0.62, parkY: 0.5,   // where it waits before the pointer arrives
    autoDrift: 1,         // on touch devices, drift by itself
    driftSeconds: 14,

    // --- video source ---------------------------------------------------
    videoGain: 1.0,       // brightness of the frame under the glass
    videoFit: 1,          // 1 = cover the canvas box, 0 = stretch

    // --- circles source: the hero text inside the canvas -----------------
    text: 1,              // draw the headline and the standfirst into the buffer
    textSharpen: 1,       // extra pixel ratio for the text raster only

    // --- the circles --------------------------------------------------
    stroke: 2,            // px in viewBox units
    colour1: '#333333',
    colour2: '#767676',
    intro: 1,             // play the draw-in
    spin: 1,              // 0 stops the endless turn (and lets the loop rest)
    spinSeconds: 10,
    arcDir: 1,            // flip if the arcs open the wrong way
    arcStart: 0,          // extra phase, turns

    // --- quality ------------------------------------------------------
    msaa: 4,              // 0 / 2 / 4 / 8 — WebGL2 only
    fxaa: 0,
    maxDpr: 2
  };

  var THREE = window.THREE;
  var host, canvas, svg, renderer, camScreen;
  var sceneArcs, sceneScreen, rtScene, rtOut, arcs = [], lens, quad, fxaaPass, fxaaScene;
  var textMesh, textCanvas, textCtx, textTex, textEls = [];
  var videoEl = null, videoTex = null, videoMesh = null;
  var W = 0, H = 0, dpr = 1, gl2 = false;
  var t0 = 0, raf = 0, visible = true, dirty = true, dead = false, painted = false;
  var probeTries = 0, probeOk = false;
  var lx = 0, ly = 0, tx = 0, ty = 0, havePointer = false, drift = 0;
  var lastFrame = 0, drawCount = 0, coarse = false;

  /* The three pairs, exactly as the markup has them. */
  var CIRCLES = [
    { cx: -108, cy: 366, r: 462, group: 90,  which: 1, mode: 'full' },
    { cx: -108, cy: 366, r: 462, group: 90,  which: 2, mode: 'half-rev', turn: -1 },
    { cx: 720,  cy: 366, r: 366, group: -90, which: 1, mode: 'full' },
    { cx: 720,  cy: 366, r: 366, group: -90, which: 2, mode: 'half',     turn: 1 },
    { cx: 1286, cy: 366, r: 200, group: -90, which: 1, mode: 'full' },
    { cx: 1286, cy: 366, r: 200, group: -90, which: 2, mode: 'half-rev', turn: -1 }
  ];

  var VIEWBOX = { w: 1440, h: 732 };

  /* ------------------------------------------------------------------ util */
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }

  function isCoarse() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
           ('ontouchstart' in window && window.innerWidth <= 900);
  }

  /* ----------------------------------------------------------- the shaders */
  var ARC_VERT = [
    'varying vec2 vP;',
    'uniform vec2 uSize;',
    'void main() {',
    '  vP = position.xy * uSize;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy * uSize, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* One circle. vP is in pixels from the centre; the visible part of the ring
     is the SVG dash pattern (dasharray 1, pathLength 1) resolved into a range
     of the normalised path parameter. */
  var ARC_FRAG = [
    'precision highp float;',
    'varying vec2 vP;',
    'uniform float uR, uHalf, uOffset, uPhase, uDir, uAlpha;',
    'uniform vec3 uCol;',
    'void main() {',
    '  float d = abs(length(vP) - uR) - uHalf;',
    '  float aa = max(fwidth(d), 0.0001);',
    '  float band = 1.0 - smoothstep(-aa, aa, d);',
    '  if (band <= 0.0) discard;',
    /* path parameter, 0..1, from the circle's start point, with the group
       rotation and the endless turn folded into uPhase */
    '  float ang = atan(vP.y, vP.x);',
    '  float u = fract(uDir * ang / 6.2831853 - uPhase);',
    /* dasharray 1 / pathLength 1: visible where (u + offset) mod 2 < 1 */
    '  float m = mod(u + uOffset, 2.0);',
    '  float on = 1.0 - step(1.0, m);',
    /* soften the two ends of the arc so they do not flicker while turning */
    '  float endAA = max(fwidth(u), 0.0002) * 1.5;',
    '  float soft = min(smoothstep(0.0, endAA, m), 1.0 - smoothstep(1.0 - endAA, 1.0, m));',
    '  on *= soft;',
    '  if (on <= 0.0) discard;',
    '  gl_FragColor = vec4(uCol, band * on * uAlpha);',
    '}'
  ].join('\n');

  var QUAD_VERT = [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  ].join('\n');

  var QUAD_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'void main() { gl_FragColor = texture2D(uTex, vUv); }'
  ].join('\n');

  /* The video frame, drawn to fill the canvas box. `cover` keeps the frame's
     own aspect ratio and crops, exactly as CSS `object-fit: cover` would, so
     the canvas copy matches what the <video> was showing. */
  var VIDEO_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uBox, uSrc;',
    'uniform float uGain, uFit;',
    'void main() {',
    '  vec2 uv = vUv;',
    '  if (uFit > 0.5) {',
    '    float boxA = uBox.x / uBox.y, srcA = uSrc.x / uSrc.y;',
    '    vec2 s = boxA > srcA ? vec2(1.0, srcA / boxA) : vec2(boxA / srcA, 1.0);',
    '    uv = (vUv - 0.5) * s + 0.5;',
    '  }',
    '  vec4 c = texture2D(uTex, uv);',
    '  gl_FragColor = vec4(c.rgb * uGain, c.a);',
    '}'
  ].join('\n');

  var LENS_VERT = [
    'varying vec2 vP;',
    'uniform float uR;',
    'uniform vec2 uCentre, uRes;',
    'void main() {',
    '  vP = position.xy * uR;',
    '  vec2 px = uCentre + vP;',
    '  vec2 ndc = vec2(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0);',
    '  gl_Position = vec4(ndc, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* Screen-space refraction of the arc buffer. Non-premultiplied output, so
     the lens composites over the page's own black instead of painting it. */
  var LENS_FRAG = [
    'precision highp float;',
    'varying vec2 vP;',
    'uniform sampler2D uTex;',
    'uniform vec2 uCentre, uRes;',
    'uniform float uR, uIor, uThick, uBulge, uChroma, uRim, uRimPow, uSpec, uSpecSize, uBody, uEdge;',
    'void main() {',
    '  float r = length(vP) / uR;',
    '  if (r > 1.0) discard;',
    '  float z = sqrt(max(0.0, 1.0 - r * r));',
    '  vec3 N = normalize(vec3(vP / uR * uBulge, max(z, 0.02)));',
    '  vec3 V = vec3(0.0, 0.0, 1.0);',
    '  vec3 Rr = refract(-V, N, 1.0 / max(uIor, 1.001));',
    '  vec2 base = (uCentre + vP) / uRes;',
    '  base.y = 1.0 - base.y;',
    '  vec2 off = vec2(Rr.x, -Rr.y) * uThick / uRes;',
    '  vec4 sr = texture2D(uTex, base + off * (1.0 + uChroma));',
    '  vec4 sg = texture2D(uTex, base + off);',
    '  vec4 sb = texture2D(uTex, base + off * (1.0 - uChroma));',
    '  vec3 col = vec3(sr.r, sg.g, sb.b);',
    '  float aTex = (sr.a + sg.a + sb.a) / 3.0;',
    /* the glass itself: Fresnel rim, a bright inner contour and one highlight */
    '  float fres = pow(1.0 - z, uRimPow);',
    '  float edge = smoothstep(1.0 - uEdge * 0.25, 1.0, r) * uEdge;',
    '  vec2 lp = vP / uR - vec2(-0.38, -0.42);',
    '  float hi = exp(-dot(lp, lp) / max(0.001, uSpecSize * uSpecSize)) * uSpec;',
    '  float glassA = clamp(fres * uRim + edge + hi + uBody, 0.0, 1.0);',
    '  vec3 glassC = vec3(1.0) * clamp(fres * uRim + edge + hi, 0.0, 1.0);',
    /* dark body: alpha without colour, so it deepens whatever is behind */
    '  float a = clamp(aTex + glassA, 0.001, 1.0);',
    '  vec3 rgb = (col * aTex + glassC) / a;',
    '  float aaR = max(fwidth(r), 0.001);',
    '  a *= 1.0 - smoothstep(1.0 - aaR * 1.5, 1.0, r);',
    '  gl_FragColor = vec4(rgb * a, a);',   // premultiplied: the canvas is transparent
    '}'
  ].join('\n');

  /* ------------------------------------------------------------ geometry */
  function findHost() {
    if (CFG.source === 'video') {
      videoEl = document.querySelector('.detail-page-hero video, .video-wrap-autoplay video');
      if (!videoEl) return null;
      return videoEl.parentElement;      // .auto-player-wrapper
    }
    var wrap = document.querySelector('.secondary-hero-wrapper');
    if (!wrap) return null;
    svg = wrap.querySelector('svg.secondary-hero-background');
    if (!svg) return null;
    return svg.parentElement || wrap;
  }

  /* viewBox units -> pixels inside the canvas. getScreenCTM is the exact
     mapping the browser used for the svg, including preserveAspectRatio and
     the fact that the svg is allowed to overflow its box horizontally. */
  function mapper() {
    var ctm = svg.getScreenCTM();
    var box = canvas.getBoundingClientRect();
    if (!ctm) {
      var k = box.height / VIEWBOX.h;
      return { s: k, ox: 0, oy: 0 };
    }
    return { s: ctm.a, ox: ctm.e - box.left, oy: ctm.f - box.top };
  }

  function build() {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setClearColor(0x000000, 0);
    gl2 = renderer.capabilities.isWebGL2;

    sceneArcs = new THREE.Scene();
    sceneScreen = new THREE.Scene();
    camScreen = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var plane = new THREE.PlaneGeometry(2, 2);

    CIRCLES.forEach(function (c) {
      var mat = new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: new THREE.Vector2(1, 1) },
          uR: { value: 1 }, uHalf: { value: 1 },
          uOffset: { value: 1 }, uPhase: { value: 0 },
          uDir: { value: 1 }, uAlpha: { value: 1 },
          uCol: { value: new THREE.Color(0x333333) }
        },
        vertexShader: ARC_VERT, fragmentShader: ARC_FRAG,
        transparent: true, depthTest: false, depthWrite: false,
        side: THREE.DoubleSide, extensions: { derivatives: true }
      });
      var m = new THREE.Mesh(plane, mat);
      m.frustumCulled = false;
      m.userData.def = c;
      sceneArcs.add(m);
      arcs.push(m);
    });

    quad = new THREE.Mesh(plane, new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null } },
      vertexShader: QUAD_VERT, fragmentShader: QUAD_FRAG,
      transparent: true, depthTest: false, depthWrite: false
    }));
    quad.frustumCulled = false;
    quad.visible = CFG.source !== 'video';
    sceneScreen.add(quad);

    lens = new THREE.Mesh(plane, new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: null },
        uCentre: { value: new THREE.Vector2() },
        uRes: { value: new THREE.Vector2() },
        uR: { value: CFG.radius }, uIor: { value: CFG.ior },
        uThick: { value: CFG.thickness }, uBulge: { value: CFG.bulge },
        uChroma: { value: CFG.chroma }, uRim: { value: CFG.rim },
        uRimPow: { value: CFG.rimPower }, uSpec: { value: CFG.spec },
        uSpecSize: { value: CFG.specSize }, uBody: { value: CFG.body },
        uEdge: { value: CFG.edge }
      },
      vertexShader: LENS_VERT, fragmentShader: LENS_FRAG,
      transparent: true, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide, extensions: { derivatives: true }
    }));
    lens.frustumCulled = false;
    lens.renderOrder = 2;
    sceneScreen.add(lens);

    /* the hero video, drawn into the buffer for the lens to refract */
    videoMesh = new THREE.Mesh(plane, new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: null },
        uBox: { value: new THREE.Vector2(1, 1) },
        uSrc: { value: new THREE.Vector2(16, 9) },
        uGain: { value: CFG.videoGain },
        uFit: { value: CFG.videoFit ? 1 : 0 }
      },
      vertexShader: QUAD_VERT, fragmentShader: VIDEO_FRAG,
      transparent: true, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide
    }));
    videoMesh.frustumCulled = false;
    videoMesh.visible = false;
    sceneArcs.add(videoMesh);

    /* the hero text, rasterised into a 2D canvas and drawn over the arcs */
    textCanvas = document.createElement('canvas');
    textCanvas.width = textCanvas.height = 2;   // never upload a 0 x 0 texture
    textCtx = textCanvas.getContext('2d');
    textTex = new THREE.CanvasTexture(textCanvas);
    textTex.minFilter = THREE.LinearFilter;
    textTex.magFilter = THREE.LinearFilter;
    textMesh = new THREE.Mesh(plane, new THREE.ShaderMaterial({
      uniforms: { uTex: { value: textTex } },
      vertexShader: QUAD_VERT, fragmentShader: QUAD_FRAG,
      transparent: true, depthTest: false, depthWrite: false,
      side: THREE.DoubleSide
    }));
    textMesh.frustumCulled = false;
    textMesh.renderOrder = 1;
    textMesh.visible = CFG.source !== 'video';
    sceneArcs.add(textMesh);

    if (THREE.FXAAShader) {
      fxaaScene = new THREE.Scene();
      fxaaPass = new THREE.Mesh(plane, new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(THREE.FXAAShader.uniforms),
        vertexShader: QUAD_VERT,
        fragmentShader: THREE.FXAAShader.fragmentShader
      }));
      fxaaPass.frustumCulled = false;
      fxaaScene.add(fxaaPass);
    }
  }

  function targets() {
    var wpx = Math.max(1, Math.round(W * dpr));
    var hpx = Math.max(1, Math.round(H * dpr));
    var samples = gl2 ? (CFG.msaa | 0) : 0;
    if (rtScene) rtScene.dispose();
    rtScene = new THREE.WebGLRenderTarget(wpx, hpx, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, samples: samples
    });
    if (rtOut) { rtOut.dispose(); rtOut = null; }
    if (CFG.fxaa && fxaaPass) {
      rtOut = new THREE.WebGLRenderTarget(wpx, hpx, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
      });
      fxaaPass.material.uniforms.tDiffuse.value = rtOut.texture;
      fxaaPass.material.uniforms.resolution.value.set(1 / wpx, 1 / hpx);
    }
    quad.material.uniforms.uTex.value = rtScene.texture;
    lens.material.uniforms.uTex.value = rtScene.texture;
  }

  function layout() {
    var box = host.getBoundingClientRect();
    W = Math.max(1, Math.round(box.width));
    H = Math.max(1, Math.round(box.height));
    dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, CFG.maxDpr));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    targets();

    /* Only the meshes of the active source are rendered. Leaving the text
       quad in the scene in video mode uploads a 0x0 canvas as a texture and
       three.js dies inside renderBufferDirect with an unrelated-looking
       "Cannot read properties of undefined (reading 'isXRRenderTarget')". */
    var isVideo = CFG.source === 'video';
    if (videoMesh) videoMesh.visible = isVideo && !!videoTex;
    if (textMesh) textMesh.visible = !isVideo;
    /* THE FIX, 2026-09-14. The full-screen quad repaints the whole source over
       the canvas. In circles mode that is the point — the svg underneath is
       hidden. Over the video it is pure downside: the canvas is opaque edge to
       edge, so the page shows the canvas's copy of the video instead of the
       video, and every frame the copy is not ready is a black rectangle. With
       the quad off, the canvas is transparent everywhere except the lens disc.
       Igor, 2026-09-14: "sfx-glass-canvas lo tapa". */
    if (quad) quad.visible = !isVideo;
    arcs.forEach(function (m) { m.visible = !isVideo; });

    if (isVideo) {
      var vu = videoMesh.material.uniforms;
      vu.uBox.value.set(W, H);
      vu.uSrc.value.set(videoEl.videoWidth || 16, videoEl.videoHeight || 9);
      vu.uGain.value = CFG.videoGain;
      vu.uFit.value = CFG.videoFit ? 1 : 0;
    } else {
      var map = mapper();
      arcs.forEach(function (m) {
        var c = m.userData.def;
        var R = c.r * map.s;
        var pad = R + 8 + CFG.stroke * map.s;
        var u = m.material.uniforms;
        u.uSize.value.set(pad, pad);
        u.uR.value = R;
        u.uHalf.value = Math.max(0.4, CFG.stroke * map.s / 2);
        m.position.set(map.ox + c.cx * map.s, map.oy + c.cy * map.s, 0);
      });
      S.glassTextWords = paintText();
    }

    if (!havePointer) {
      lx = tx = W * CFG.parkX;
      ly = ty = H * CFG.parkY;
    }
    lens.material.uniforms.uRes.value.set(W, H);
    dirty = true;
  }

  /* Orthographic camera for the arcs, in CSS pixels with y running down. */
  function arcCamera() {
    var cam = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
    cam.updateProjectionMatrix();
    return cam;
  }


  /* -----------------------------------------------------------------------
     The hero text, redrawn inside the canvas
     -----------------------------------------------------------------------
     The lens can only refract what is in the frame buffer, so the two hero
     texts are rasterised into a 2D canvas and uploaded as a texture. The
     layout is never recomputed: every word is wrapped in a span once, and its
     own bounding rect is where it is drawn, so the browser's wrapping, its
     line-height and its `-webkit-line-clamp` are exactly what appears.
     ----------------------------------------------------------------------- */
  var TEXT_SELECTORS = ['.secondary-hero-title', '.secondary-hero-body-copy'];

  /* One span per word; the spaces stay as text nodes so nothing about the
     wrapping changes. Idempotent — a second call reuses the spans. */
  function wordSpans(el) {
    if (el.__sfxWords) return el.__sfxWords;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    var out = [];
    nodes.forEach(function (node) {
      var parts = node.nodeValue.split(/(\s+)/);
      if (parts.length === 1 && !parts[0]) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        var s = document.createElement('span');
        s.className = 'sfx-gl-word';
        s.textContent = p;
        frag.appendChild(s);
        out.push(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
    el.__sfxWords = out;
    return out;
  }

  function fontOf(style) {
    var fs = style.fontStyle && style.fontStyle !== 'normal' ? style.fontStyle + ' ' : '';
    var fw = style.fontWeight && style.fontWeight !== '400' ? style.fontWeight + ' ' : '';
    return fs + fw + style.fontSize + ' ' + style.fontFamily;
  }

  function paintText() {
    if (!textCtx) return 0;
    /* Type is the one thing a designer will judge pixel by pixel, so the text
       raster never goes below 2x even when the screen is 1x; 3x is the ceiling,
       above which the texture costs more memory than the sharpness is worth. */
    var ratio = Math.min(3, Math.max(2, dpr * Math.max(1, CFG.textSharpen)));
    var wpx = Math.max(1, Math.round(W * ratio));
    var hpx = Math.max(1, Math.round(H * ratio));
    if (textCanvas.width !== wpx || textCanvas.height !== hpx) {
      textCanvas.width = wpx; textCanvas.height = hpx;
    }
    textCtx.setTransform(1, 0, 0, 1, 0, 0);
    textCtx.clearRect(0, 0, wpx, hpx);
    if (!CFG.text) { textTex.needsUpdate = true; return 0; }
    textCtx.scale(ratio, ratio);
    textCtx.textBaseline = 'alphabetic';

    var box = canvas.getBoundingClientRect();
    var drawn = 0;

    textEls.forEach(function (el) {
      var style = getComputedStyle(el);
      /* The colour has to be read BEFORE the element is made transparent, and
         remembered: every later repaint would otherwise read back the
         `color: transparent` this function itself installed and draw nothing.
         (It did exactly that, and the only clue was that the word count was
         right while the canvas stayed black.) */
      if (!el.__sfxColor) el.__sfxColor = style.color;
      textCtx.font = fontOf(style);
      textCtx.fillStyle = el.__sfxColor;
      try {
        textCtx.letterSpacing = (style.letterSpacing === 'normal' ? '0px' : style.letterSpacing);
      } catch (e) {}
      /* The rect of an inline span is the font's content box, so its top plus
         the font's own ascent is the baseline — no guessing from line-height,
         which is bigger than the glyphs and would sit the text too low. */
      var m = textCtx.measureText('Hxg');
      var ascent = (m && m.fontBoundingBoxAscent) || parseFloat(style.fontSize) * 0.8;
      wordSpans(el).forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (!r.width) return;
        textCtx.fillText(s.textContent, r.left - box.left, r.top - box.top + ascent);
        drawn++;
      });
      el.classList.add('sfx-glass-text');
    });

    textTex.needsUpdate = true;
    return drawn;
  }

  function findTextEls() {
    var hero = document.querySelector('.secondary-hero');
    if (!hero) return [];
    var out = [];
    TEXT_SELECTORS.forEach(function (sel) {
      var n = hero.querySelectorAll(sel), i;
      for (i = 0; i < n.length; i++) out.push(n[i]);
    });
    return out;
  }

  /* -------------------------------------------------------------- timeline */
  function offsetFor(c, tSec) {
    if (!CFG.intro) return c.mode === 'full' ? 2 : (c.mode === 'half' ? 0.5 : 1.5);
    if (c.mode === 'full') {
      return 1 + easeInOut(clamp01(tSec / 3)) * 1;
    }
    var p = easeInOut(clamp01((tSec - 3) / 2));
    return c.mode === 'half' ? 1 - 0.5 * p : 1 + 0.5 * p;
  }

  function phaseFor(c, tSec) {
    /* CSS rotate() is clockwise on screen and the canvas y runs down, so a
       positive group angle is a positive phase in the same direction. */
    var turns = c.group / 360 + CFG.arcStart;
    if (c.turn && CFG.spin) {
      var after = Math.max(0, tSec - (CFG.intro ? 3 : 0));
      turns += c.turn * (after / Math.max(0.1, CFG.spinSeconds));
    }
    return turns;
  }

  function introRunning(tSec) { return CFG.intro && tSec < 5.2; }

  /* The lens is a fixed number of pixels, but 190 px of it on a 390 px phone
     covers the whole hero, so it is also capped against the shorter side. */
  function lensRadius() {
    return Math.min(CFG.radius, Math.min(W, H) * Math.max(0.05, CFG.radiusCap));
  }

  /* ----------------------------------------------------------------- loop */
  function damp(a, b, tau, dt) {
    if (tau <= 0) return b;
    return a + (b - a) * (1 - Math.exp(-dt / tau));
  }

  function frame(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    var tSec = (now - t0) / 1000;

    if (coarse && CFG.autoDrift && !havePointer) {
      drift += dt / Math.max(1, CFG.driftSeconds) * Math.PI * 2;
      tx = W * (0.5 + 0.32 * Math.cos(drift));
      ty = H * (0.5 + 0.22 * Math.sin(drift * 1.7));
    }

    var nx = damp(lx, tx, CFG.followTau, dt);
    var ny = damp(ly, ty, CFG.followTau, dt);
    var moving = Math.abs(nx - lx) > 0.05 || Math.abs(ny - ly) > 0.05;
    lx = nx; ly = ny;

    var video = CFG.source === 'video';
    var broken = video && videoEl && videoEl.error;   // unsupported codec, 404…
    var playing = video && !broken && videoEl &&
                  !videoEl.paused && !videoEl.ended && videoEl.readyState >= 2;
    var spinning = !video && CFG.spin && CFG.spinSeconds > 0 && (!CFG.intro || tSec >= 3);
    var busy = moving || playing || spinning || (!video && introRunning(tSec)) || dirty;
    dirty = false;

    var cam = arcCamera();

    if (video) {
      if (!videoTex && videoEl && videoEl.readyState >= 2) {
        videoTex = new THREE.VideoTexture(videoEl);
        videoTex.minFilter = THREE.LinearFilter;
        videoTex.magFilter = THREE.LinearFilter;
        videoMesh.material.uniforms.uTex.value = videoTex;
        videoMesh.material.uniforms.uSrc.value.set(videoEl.videoWidth || 16, videoEl.videoHeight || 9);
        videoMesh.visible = true;
        layout();
      }
      var vu2 = videoMesh.material.uniforms;
      vu2.uGain.value = CFG.videoGain;
      vu2.uFit.value = CFG.videoFit ? 1 : 0;
    } else {
      arcs.forEach(function (m) {
        var c = m.userData.def, u = m.material.uniforms;
        u.uOffset.value = offsetFor(c, tSec);
        u.uPhase.value = phaseFor(c, tSec);
        u.uDir.value = CFG.arcDir >= 0 ? 1 : -1;
        u.uCol.value.set(c.which === 1 ? CFG.colour1 : CFG.colour2);
      });
    }

    /* Nothing to refract yet — the video has not decoded a frame, or cannot
       (a codec the browser does not have). Draw nothing at all: the canvas
       stays transparent, the DOM <video> keeps its poster, and the page looks
       exactly as it would without this file. */
    if (!rtScene || (video && !videoTex)) {
      if (busy && visible && !document.hidden) kick();
      return;
    }

    renderer.setRenderTarget(rtScene);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    try {
      renderer.render(sceneArcs, cam);
    } catch (err) {
      /* The one that actually happens: a <video> read from file:// taints the
         canvas and texImage2D throws SecurityError. Give up completely rather
         than leave the page with a hidden <video> behind a blank canvas — the
         plain video is a far better outcome than a black rectangle. */
      giveUp(err);
      return;
    }

    var lu = lens.material.uniforms;
    lu.uCentre.value.set(lx, ly);
    lu.uR.value = lensRadius();
    lu.uIor.value = CFG.ior;
    lu.uThick.value = CFG.thickness;
    lu.uBulge.value = CFG.bulge;
    lu.uChroma.value = CFG.chroma;
    lu.uRim.value = CFG.rim;
    lu.uRimPow.value = CFG.rimPower;
    lu.uSpec.value = CFG.spec;
    lu.uSpecSize.value = CFG.specSize;
    lu.uBody.value = CFG.body;
    lu.uEdge.value = CFG.edge;

    renderer.setRenderTarget(CFG.fxaa && fxaaPass ? rtOut : null);
    renderer.clear(true, true, true);
    try {
      renderer.render(sceneScreen, camScreen);
    } catch (err2) {
      giveUp(err2);
      return;
    }

    if (CFG.fxaa && fxaaPass) {
      renderer.setRenderTarget(null);
      renderer.clear(true, true, true);
      renderer.render(fxaaScene, camScreen);
    }

    drawCount++;

    /* Before the DOM source is told to stop painting, PROVE that the canvas
       has something on it. A drawn frame is not enough: WebGL can refuse the
       upload and leave the buffer black without throwing — a video read from
       file:// taints the canvas, and Chrome may decline the texture with a
       console warning rather than a SecurityError. Hiding the <video> then
       leaves a black rectangle where the video was, which is exactly what
       "no veo el vídeo" looks like.

       So: read four pixels out of the source buffer. If nothing is lit after
       ~20 tries (about a second of frames), give up and let the <video> play.  */
    if (!painted && !video) {
      /* The circles are ours; if they drew, they drew. */
      painted = true;
      document.documentElement.classList.add('sfx-glass-on');
    } else if (!painted) {
      if (!probeOk) probeOk = probe();
      if (probeOk) {
        painted = true;
        document.documentElement.classList.add('sfx-glass-on');
      } else if (++probeTries > 20) {
        giveUp('the source buffer stayed empty — the texture was refused ' +
               '(a file:// video taints the canvas; serve the folder over http)');
        return;
      }
    }
    if (busy && visible && !document.hidden) kick();
  }

  /* Is there anything at all in the source buffer? Four pixels from the middle
     is enough to tell "the video uploaded" from "the buffer is empty". */
  function probe() {
    try {
      var px = new Uint8Array(16);
      var x = Math.max(0, (rtScene.width / 2) | 0), y = Math.max(0, (rtScene.height / 2) | 0);
      renderer.readRenderTargetPixels(rtScene, x, y, 2, 2, px);
      for (var i = 0; i < px.length; i += 4) {
        if (px[i] || px[i + 1] || px[i + 2] || px[i + 3]) return true;
      }
    } catch (e) { return false; }
    return false;
  }

  /* Stand down for good: hide our canvas, let the DOM source paint again. */
  function giveUp(err) {
    var msg = String(err && err.message || err);
    /* One cause accounts for nearly every occurrence of this, and the browser's
       own wording does not say what to do about it. A page opened by
       double-clicking runs on the `file:` origin, where Chrome treats each
       file as its own origin: the <video> plays normally, but reading its
       pixels into WebGL is a cross-origin read and throws SecurityError. The
       lens is the only thing affected, and serving the folder over http — any
       local server, and GitHub Pages — makes it work. Measured 2026-09-14:
       file:// throws, http:// uploads cleanly, the same file either way. */
    if (location.protocol === 'file:' && /cross-origin|security|taint/i.test(msg)) {
      msg = 'this page is open from file://, and Chrome will not let WebGL read ' +
            'a video on that origin. The video itself is fine — only the lens ' +
            'is off. Serve the folder over http (a local server, or GitHub ' +
            'Pages) and the lens runs. [browser said: ' + msg + ']';
    }
    S.glassError = msg;
    if (window.console && console.warn) console.warn('[fluid-glass] ' + msg);
    dead = true;
    document.documentElement.classList.remove('sfx-glass-on');
    if (canvas) canvas.style.display = 'none';
  }

  function kick() {
    if (dead || !CFG.enabled || raf || !visible || document.hidden) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------- events */
  function onPointer(e) {
    var box = canvas.getBoundingClientRect();
    tx = e.clientX - box.left;
    ty = e.clientY - box.top;
    havePointer = true;
    kick();
  }

  function start() {
    var page = document.documentElement.getAttribute('data-sfx-page');
    var wants = CFG.source === 'video' ? 'supply-chain' : 'home';
    if (page !== wants) return;
    THREE = window.THREE;
    if (!THREE) return;

    host = findHost();
    if (!host) return;

    canvas = document.createElement('canvas');
    canvas.className = 'sfx-glass-canvas';
    try { build(); } catch (err) { S.glassError = String(err); return; }
    host.classList.add('sfx-glass-host');
    host.appendChild(canvas);

    coarse = isCoarse();
    if (CFG.source === 'circles') {
      textEls = findTextEls();
      /* the webfont changes every rect, so redraw once it has landed */
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { paintText(); dirty = true; kick(); });
      }
    }

    /* The hero's own box changes height without the window resizing — the
       webfont arriving, a video's metadata landing, the address bar on a
       phone. Watch the box rather than the window, or the canvas keeps the
       size it had at first paint and what it draws drifts out of register
       with the page. */
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () {
        var b = host.getBoundingClientRect();
        if (Math.abs(Math.round(b.width) - W) < 1 && Math.abs(Math.round(b.height) - H) < 1) return;
        layout(); kick();
      });
      ro.observe(host);
    }
    t0 = performance.now();
    if (videoEl) {
      ['loadeddata', 'play', 'playing', 'seeked', 'timeupdate'].forEach(function (ev) {
        videoEl.addEventListener(ev, function () { dirty = true; kick(); });
      });
      var pl = videoEl.play();
      if (pl && pl.catch) pl.catch(function () {});
    }

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('resize', function () { layout(); kick(); });
    window.addEventListener('scroll', function () { dirty = true; kick(); }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) kick();
      }, { threshold: 0 }).observe(canvas);
    }

    kick();
  }

  /* The tuner calls this; `hard` rebuilds the render targets. */
  S.glassApply = function (hard) {
    if (!renderer) return;
    if (canvas) canvas.style.display = CFG.enabled ? '' : 'none';
    document.documentElement.classList.toggle(
      'sfx-glass-on', !!(CFG.enabled && painted && !dead));
    if (!CFG.enabled) return;
    if (hard) { targets(); layout(); }
    else if (CFG.source === 'circles' && textEls.length) { paintText(); }
    else if (CFG.source === 'video') { layout(); }
    dirty = true;
    kick();
  };
  S.glassReplay = function () { t0 = performance.now(); dirty = true; kick(); };

  /* Handles on the internals, for the console. Nothing in the page uses them. */
  S.glassParts = function () {
    return { renderer: renderer, sceneArcs: sceneArcs, sceneScreen: sceneScreen,
             lens: lens, quad: quad, arcs: arcs, rtScene: rtScene, cam: camScreen,
             redraw: function () { dirty = true; kick(); } };
  };

  window.SOLUTIONS_GLASS = function () {
    return {
      webgl2: gl2,
      msaaRequested: CFG.msaa,
      msaaInEffect: gl2 ? (rtScene && rtScene.samples) || 0 : 0,
      fxaa: !!CFG.fxaa,
      dpr: dpr,
      size: [W, H],
      framesDrawn: drawCount,
      looping: !!raf,
      visible: visible,
      pointer: havePointer ? [Math.round(lx), Math.round(ly)] : null,
      source: CFG.source,
      video: videoEl ? {
        file: (videoEl.getAttribute('src') || '').split('/').pop(),
        error: videoEl.error ? videoEl.error.code : null,
        readyState: videoEl.readyState,
        paused: videoEl.paused,
        size: [videoEl.videoWidth, videoEl.videoHeight],
        texture: !!videoTex
      } : null,
      textWords: S.glassTextWords || 0,
      painted: painted,
      dead: dead,
      probeOk: probeOk,
      probeTries: probeTries,
      error: S.glassError || null
    };
  };

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
