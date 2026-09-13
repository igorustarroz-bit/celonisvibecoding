/* =========================================================================
   Context Model — the effect (experiment 6).

   Unofficial design prototype. Not an official page of the brand shown, and
   not published or endorsed by them.

   What it draws, read bottom to top: scattered dots rise and sort themselves
   into columns; where a column lands on the underside of a thick glass
   magnifier it becomes a rounded-square chip; above the lens a rocket-flame
   glow (orange / white / blue) and the data leaves as thin signal traces drawn
   upwards by bright heads, some with a crenellation jog.

   Stack, the same as experiment 3 (Data Core): three.js r147 from ../../lib,
   an orthographic camera, our own glass ShaderMaterial with a refraction
   pre-pass, our own post chain (MSAA render targets on WebGL2, bright pass +
   two-level bloom, optional FXAA, capped device pixel ratio), and pointer +
   gyroscope parallax.

   Ported from the standalone study on 2026-09-13. The study filled the window;
   here the effect replaces the <video> in the page's own block, keeps that
   box's 16:9 proportion, and is scrubbed by the block crossing the viewport —
   the same shape of driver as experiment 1's test1. It never scrolls the page
   itself.

   The tuner lives in context-tuner.js and talks to window.CONTEXT.
   Console: CONTEXT_INFO(), CONTEXT_SCROLL(t), CONTEXT_BEAMS().
   ========================================================================= */
(function () {
  "use strict";


  // ---------------------------------------------------------------- settings
  const DEFAULTS = {
    // camera
    // We look UP at the lens (Igor, definitive): the underside is the face we see, the
    // rising columns pass in front of it and the glow rises behind the far rim.
    camAz: 25, camEl: -15, viewH: 2.85, camY: -0.04, parallax: 0.81,
    // magnifier: flat top, convex underside (bulge = sag at the centre)
    // discH = height of the frame (× holderH); lensH = thickness of the glass inside it,
    // always centred in the frame's height
    discH: 0.125, lensH: 0.01, bulge: -0.025, ior: 1.1, refract: 0.038, glassBlur: 1.0,
    tint: 0.75, absorb: 0.45, rim: 0.12, edge: 0.18, sheen: 0.29,
    // light of the aurora coming THROUGH the glass onto the underside: warm on the left,
    // cool on the right, a white core behind the far half — the wash the reference face has
    wash: 0.72, washCore: 0.10, underEnv: 0.2,   // the underside reflects the rig less (it faces the dark)
    lensContrast: 1.55, lensSat: 0.55,   // same S-curve as the frame: blacks very black
    lensEdgeDark: 0.8, lensEdgeWidth: 0.25,   // the glass goes black in a gradient where it meets the frame
    ringTop: 1, ringBottom: 0,
    // the frame that holds the glass: a Data Core top plate (experiment 3, Igor's closed
    // values of 2026-08-31 / v24) bent into a ring — same extrude + bevel geometry, same
    // Codrops-style glass shader, same white light edges, same studio backdrop behind it
    holderMargin: 0.02, holderH: 1.0, holderRound: 1,
    frameTransmission: 0.74, frameRefract: 1.69, frameFrost: 0.6, frameMag: 1.22, frameShift: 0.24,
    frameFresnel: 1.5, frameTopClear: 1, frameTopDarken: 0.23, frameEdgeWhite: 0,
    frameIri: 0.2, frameBody: 1.21, frameTint: 0.72, frameRim: 0, frameBackdrop: 0.75,
    frameFire: 1.08,       // the flames, refracted inside the frame (their own small pass)
    // where the fire lights the frame (glow, not refraction): by face. Inner = the wall
    // that faces the axis (the far side of it looks at the camera, right under the chips),
    // outer = the visible outside wall, top / bottom = the rims. Bottom stays dark.
    frameFireInner: 0.88, frameFireOuter: 0.35, frameFireTop: 0.2, frameFireBottom: 0,
    frameFireFacing: 0.7,  // how much the glow prefers faces turned to the camera
    // the glow is the LIVE flames (the fire pass), mirrored onto the frame: every point of
    // the frame samples the flames at its own x, over a band of the screen just above the
    // rim. Inner and outer wall each choose WHERE in the flames they look (Lift = how far
    // above the rim the band starts, Band = how tall a slice of the flames they take) and
    // how strongly they refract the flames and the scene (Refr).
    frameInnerBand: 0.17, frameInnerLift: 0.06, frameInnerRefr: 0.3,
    frameOuterBand: 0.14, frameOuterLift: 0, frameOuterRefr: 1.0,
    frameContrast: 2.65,   // S-curve on the frame's colour: whites whiter, blacks blacker
    frameSat: 0.85,        // saturation of the frame (the flames inside it above all)
    refractScene: 0,      // 0 = neither the lens nor the frame refract the dots or the traces
                          //     (the chips and their light shafts, inside the glass, always show)
    // impacts of the rising dots on the underside — inverted rain
    impactCount: 25, impactSize: 0.058, impactRate: 0.6, impactOpacity: 0.9,
    impactGrow: 0.45,     // how much a square swells over its life (0 = fixed chip)
    // light entering the glass where a column lands: a vertical shaft that fades upwards
    shaftH: 0.21, shaftW: 2, shaftOpacity: 0.87,
    impactOnColumns: 1,   // 1 = every square is born where a column of dots lands
    impactSpreadZ: 4,     // how far off the centre line a chip may land, in chip widths
    // banded softbox environment (the Data Core light rig)
    env: 0.55, envBands: 5, envSoft: 0.44, envRot: 0.4,
    // aurora
    // two flames — orange → white on the left, blue → white on the right — each breathing
    // (growing and shrinking) at its own rate
    auroraInt: 1.18, auroraSpread: 0.9, auroraHeight: 1.54, auroraWidth: 1.0,
    flameHeightA: 0.59, flameHeightB: 0.65,   // orange / blue, × auroraHeight
    auroraFlame: 0.09, auroraFlow: 0.035, auroraSat: 1.47,
    flameSep: 0.18, flameWhite: 0.19, flamePulse: 0.28, flameRateA: 0.33, flameRateB: 0.14,
    // traces
    // Each trace is an independent beam: it climbs and steps sideways following the SVG's
    // zipper (up, S right, up, S left…) and can bend its own path to avoid the pointer.
    // Only the beam's trail is visible; when the head leaves the frame the beam restarts
    // at its column after traceGap seconds.
    traceCount: 15, traceRadius: 0.003, traceSpeed: 0.295, traceGlow: 2.0,
    traceTail: 0.58, traceFadeIn: 0.15, traceGap: 0.1,
    // path = a castle crenellation turned 90°: vertical run, horizontal jog, vertical run,
    // jog back… with rounded corners. Light beams travel up the path and die behind
    // themselves; the front of each beam is a dot bigger than the line.
    // zipper: up, right, up, left, up, right… as many jogs as the height allows, from the
    // same line the dots come from (one trace per column; traceLineZ moves them off it).
    // Proportions from Igor's Vector_1.svg (39×281): the jog is two quarter circles of
    // radius 16 back to back with a 5.5 straight between them (offset 37.5 ≈ 2.3 R), the
    // vertical runs 102 / 45 / 69. Scaled to the scene: R 0.06, offset 0.13, run ≈ 0.25.
    // The path is Igor's Vector_1.svg LOOPED upwards: run 102, S to the right, run 45,
    // S back to the left, run 69, and again. Everything is scaled from the jog offset
    // (37.5 in the SVG = traceJogLen); traceRun stretches the runs only. Each trace starts
    // at a random point of the loop so they are not in step. The columns are 0.12 apart,
    // so the offset stays under that and every trace turns right first (traceSameDir).
    traceJogLen: 0.1, traceCornerR: 0.043, traceRun: 1.0, traceSameDir: 1, traceLineZ: 0,
    traceBeams: 1, traceHeadSize: 0.034,
    // data rain
    // 14 funnels on the centre line of the lens: a 3-D cone of loose dots at the bottom
    // narrowing into one ordered line at the top
    partSpan: 0.85,    // width of the row of columns, × the lens (0.85 = pulled in 15 %)
    partCount: 800, partColumns: 14, partSize: 0.008, partSpeed: 0.08,
    partFall: 1.65, partSpread: 0.42, partJitter: 0.02, partOpacity: 1, partLineZ: 0,
    // order: the last `partOrder` of the climb is a clean column (no dispersion, no jitter);
    // below that the dots scatter with `partScatter` as exponent (2 = quadratic).
    // partSpeedVar > 0 lets dots within a column drift apart (0 = beads, evenly spaced).
    partOrder: 0.3, partScatter: 1.0, partSpeedVar: 0,
    // motion — 1 = data rises into the lens and leaves as signal, 0 = the reverse
    // reaction to the pointer (desktop) or the phone's tilt: the dots under the pointer
    // break into chaos, the traces bend away from it; shaking the phone scatters everything
    hoverOn: 1, hoverRadius: 0.15, hoverChaos: 0.2, hoverDodge: 0.35, hoverThick: 2.5, tiltChaos: 2.6,
    // Scroll choreography (in viewport heights). Arrival: the lens appears as a perfect
    // circle facing us with the flames right behind it (seen through it, never past its
    // edge), tumbles two full turns into place while the flames move to the rim, then the
    // dots, then the traces. Exit: the dots go, then the traces, the lens tumbles back into
    // the circle with the flames behind it, and everything slides up out of the frame.
    // Lengths are in box heights, not viewport heights: the effect is scrubbed by its
    // own block crossing the viewport. scrollLead starts the arrival before the box
    // has finished travelling up.
    scrollIn: 1.2, scrollHold: 1.0, scrollOut: 1.2, scrollLead: 0.25,
    scrollLeadCap: 0.35,                // most of the timeline the lead-in may use
    boxRatio: 1.778,                    // the box the video had: 16:9
    boxRatioNarrow: 0.5,                // …and under 700 px: 1:2, a tall phone block
    viewWMin: 2.4,                      // smallest visible width, in world units
    lensMinPx: 400,                     // the lens is never narrower than this on screen
    // the arrival: how much bigger it starts, how far below, and over how much of the
    // arrival it shrinks into place (1 = the whole of it)
    entryZoom: 5.7, entryRise: 6, entryLen: 0.55,
    // the lens profile, so the crease can be tested from the panel. These four
    // reproduce today's geometry exactly.
    lensChamfer: 0, lensCrease: 1, lensSegments: 180, lensRings: 26,
    // the exit: when the turn back to the circle starts and how long it takes. The
    // departure begins exactly where those two end — it is not a third number.
    exitTurnFrom: 0.30, exitTurnLen: 0.35, exitLift: 2.2, exitFadeFrom: 0.6,
    scrollPreview: 0, scrollScrub: 1,   // preview: 0 → 1 arrival, 1 → 2 exit (ignores the page scroll)
    flowUp: 1, timeScale: 1,
    // bloom + sharpness
    bloom: 1, bloomThresh: 0.52, bloomStrength: 0.55, bloomRadius: 1.2,
    msaa: 4, fxaa: 0, dprCap: 2, prePass: 1
  };
  const CFG = Object.assign({}, DEFAULTS);

  // The study ran in the whole window. Here it lives in the box the page's
  // <video> occupied, so every measurement comes from that box.
  const canvas = document.getElementById("context-stage");
  const sticky = document.getElementById("context-sticky");
  const scrollBox = document.getElementById("context-scroll");
  let boxW = 1, boxH = 1;
  function navHeight() {
    // measured, never hard-coded: 88 px on desktop, 64 on phones, and the saved
    // pages move it about (repo rule, experiments/claude_newexperiment_context.md)
    const nav = document.querySelector(".nav-wrapper") || document.querySelector("header");
    const h = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
    return h || 64;
  }

  // ---------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, stencil: false });
  renderer.setClearColor(0x000000, 1);
  const isWebGL2 = !!(renderer.capabilities && renderer.capabilities.isWebGL2);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  const target = new THREE.Vector3(0, CFG.camY, 0);

  // Fullscreen quad used by every post pass.
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
  quadScene.add(quad);
  function blit(material, rt) {
    quad.material = material;
    renderer.setRenderTarget(rt || null);
    renderer.clear();
    renderer.render(quadScene, quadCam);
  }

  // ---------------------------------------------------------------- palette
  const AURORA_A = new THREE.Color(0xff7a26); // left, warm
  const AURORA_B = new THREE.Color(0xffc2d8); // centre, near-white pink
  const AURORA_C = new THREE.Color(0x2f78ff); // right, cool

  // Shared GLSL: the banded softbox the lens reflects. Same idea as the Data Core rig —
  // horizontal light strips plus one big box overhead, warm on one side, cool on the other.
  // It is what makes the glass read as glass and draws the white light edges.
  const ENV_GLSL = `
    vec3 envCol(vec3 d, float bands, float soft, float rot) {
      float a = atan(d.z, d.x) + rot;
      float el = clamp(d.y, -1.0, 1.0);
      float b = abs(sin((el * 0.5 + 0.5) * bands * 3.14159));
      float strip = smoothstep(1.0 - clamp(soft, 0.02, 0.98), 1.0, b);
      float box = smoothstep(0.55, 0.95, el) * 0.10;
      float horizon = exp(-el * el * 120.0) * 0.30;
      vec3 warm = vec3(1.00, 0.94, 0.86);
      vec3 cool = vec3(0.86, 0.93, 1.00);
      vec3 c = mix(cool, warm, 0.5 + 0.5 * cos(a));
      return c * (strip * 0.45 + box + horizon);
    }`;

  // Shared GLSL: the colour of the aurora as a function of world X.
  const AURORA_GLSL = `
    vec3 auroraCol(float x, vec3 cA, vec3 cB, vec3 cC) {
      vec3 c = mix(cA, cC, smoothstep(-0.95, 0.95, x));
      return mix(c, cB, exp(-x * x * 5.0) * 0.6);
    }`;

  // ---------------------------------------------------------------- hover / tilt reaction
  // Shared by the dots (the beams read the same values on the CPU). uHover is the pointer (or the tilt)
  // in NDC, uChaosGlobal the phone-shake amount; hoverField() is the influence at a
  // world position, judged in screen space so it follows what the eye sees.
  const hoverUniforms = {
    uHover: { value: new THREE.Vector2(0, 0) }, uHoverR: { value: CFG.hoverRadius },
    uAspect: { value: 1 }, uHoverOn: { value: 0 }, uChaosGlobal: { value: 0 },
    uHoverChaos: { value: CFG.hoverChaos }, uHoverDodge: { value: CFG.hoverDodge }
  };
  const HOVER_GLSL = `
    uniform vec2 uHover; uniform float uHoverR, uAspect, uHoverOn, uChaosGlobal, uHoverChaos, uHoverDodge;
    // 0..1 influence of the pointer at a world position, plus the signed screen offset
    float hoverField(vec3 wp, out vec2 offs) {
      vec4 c = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      vec2 nd = c.xy / max(c.w, 1e-4);
      offs = (nd - uHover) * vec2(uAspect, 1.0);
      float d2 = dot(offs, offs) / max(uHoverR * uHoverR, 1e-4);
      return exp(-d2) * uHoverOn;
    }
    // traces: slide sideways away from the pointer, smoothly (the whole S bends)
    vec3 hoverDodge(vec3 wp) {
      vec2 o; float f = hoverField(wp, o);
      float side = o.x / (abs(o.x) + 0.12);
      return wp + vec3(side * uHoverDodge * f, 0.0, 0.0);
    }`;

  // ---------------------------------------------------------------- aurora
  const auroraUniforms = {
    uInt: { value: CFG.auroraInt }, uSpread: { value: CFG.auroraSpread },
    uHeight: { value: CFG.auroraHeight },
    uSep: { value: CFG.flameSep }, uWhite: { value: CFG.flameWhite }, uPulse: { value: CFG.flamePulse },
    uHA: { value: CFG.flameHeightA }, uHB: { value: CFG.flameHeightB },
    uRateA: { value: CFG.flameRateA }, uRateB: { value: CFG.flameRateB },
    uFlame: { value: CFG.auroraFlame }, uFlow: { value: CFG.auroraFlow },
    uSat: { value: CFG.auroraSat }, uWidth: { value: CFG.auroraWidth }, uTime: { value: 0 },
    uFloorY: { value: 0.065 },
    cA: { value: AURORA_A }, cB: { value: AURORA_B }, cC: { value: AURORA_C }
  };

  // Value noise, three octaves, warped by itself — enough for a slow flame.
  const NOISE_GLSL = `
    float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
                 mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float a = 0.5, s = 0.0;
      for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
      return s;
    }`;
  const aurora = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 3.6, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: auroraUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv; varying vec3 vWP;
        void main() {
          vUv = uv;
          // "world" position as the flames see it = the quad's own space at its resting
          // place (0, 1.2, -0.1): the stage can then move, scale and turn the quad freely
          vWP = position + vec3(0.0, 1.2, -0.1);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: AURORA_GLSL + NOISE_GLSL + `
        varying vec2 vUv; varying vec3 vWP;
        uniform float uInt, uSpread, uHeight, uFlame, uFlow, uSat, uWidth, uTime, uFloorY;
        uniform float uSep, uWhite, uPulse, uRateA, uRateB, uHA, uHB;
        uniform vec3 cA, cB, cC;

        // one flame: a dome centred at xc; pulse scales its height and strength,
        // its own colour turning white towards the core
        vec3 flameLobe(float x, float y, float xc, float pulse, float hMul, vec3 cLobe, float n) {
          float h = max(uHeight, 0.05) * hMul * pulse;
          vec2 q = vec2((x - xc) / max(uSpread, 0.05), y / h);
          float r = length(q);
          float dome = exp(-r * r * 3.0);
          float flame = mix(1.0, 0.30 + 1.35 * n, uFlame);
          float white = exp(-r * r * 2.2) * uWhite;
          vec3 col = mix(cLobe, vec3(1.0, 0.97, 0.96), white);
          return col * dome * flame * (0.6 + 0.4 * pulse);
        }

        void main() {
          // world coordinates: x across, y measured from the top of the lens
          float x = vWP.x;
          float y = vWP.y - uFloorY;

          // flame noise scrolling upwards, warped by itself
          vec2 q = vec2(x * 1.6, y * 1.6 - uTime * uFlow * 6.0);
          float n = fbm(q + vec2(fbm(q * 0.6) * 0.9, 0.0));

          // the two flames breathe at different rates (never in step)
          float pA = 1.0 + uPulse * sin(uTime * uRateA * 6.2832);
          float pB = 1.0 + uPulse * sin(uTime * uRateB * 6.2832 + 2.1);
          vec3 col = flameLobe(x, y, -uSep, pA, uHA, cA, n) + flameLobe(x, y, uSep, pB, uHB, cC, n);
          col *= uInt;

          col *= smoothstep(uFloorY - 0.04, uFloorY + 0.06, vWP.y);    // nothing below the rim
          col *= smoothstep(uWidth + 0.35, uWidth - 0.15, abs(x));    // the glow belongs to the lens
          col *= smoothstep(-0.03, 0.05, vUv.x) * smoothstep(1.03, 0.95, vUv.x);
          col *= smoothstep(-0.03, 0.05, vUv.y) * smoothstep(1.03, 0.95, vUv.y);
          col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, uSat);  // hold the hue
          gl_FragColor = vec4(col, 1.0);
        }`
    })
  );
  aurora.position.set(0, 1.2, -0.10);
  aurora.renderOrder = -2;
  aurora.layers.enable(1);                      // also drawn by the frame's fire pass
  const fireGroup = new THREE.Group();          // the stage moves the flames through this
  fireGroup.add(aurora);
  scene.add(fireGroup);

  // ---------------------------------------------------------------- glass lens
  const DISC_R = 1.0;

  const glassUniforms = {
    tScene: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uIor: { value: CFG.ior }, uRefract: { value: CFG.refract }, uBlur: { value: CFG.glassBlur },
    uTint: { value: CFG.tint }, uAbsorb: { value: CFG.absorb },
    uRim: { value: CFG.rim }, uEdge: { value: CFG.edge }, uSheen: { value: CFG.sheen },
    uWash: { value: CFG.wash }, uWashCore: { value: CFG.washCore }, uUnderEnv: { value: CFG.underEnv },
    uContrast: { value: CFG.lensContrast }, uSatL: { value: CFG.lensSat },
    uEdgeDark: { value: CFG.lensEdgeDark }, uEdgeWidth: { value: CFG.lensEdgeWidth },
    tFire: { value: null }, uFireThrough: { value: 0 },
    uEnv: { value: CFG.env }, uBands: { value: CFG.envBands },
    uBandSoft: { value: CFG.envSoft }, uEnvRot: { value: CFG.envRot },
    cA: { value: AURORA_A }, cB: { value: AURORA_B }, cC: { value: AURORA_C }
  };
  // Profile of the lens, revolved with LatheGeometry: flat top face, straight rim wall,
  // convex underside with `bulge` of sag at the centre. Corner points are duplicated so
  // the averaged normals keep the rim crisp.
  function lensProfile() {
    const h = Math.min(CFG.lensH, CFG.discH * CFG.holderH), R = DISC_R, b = CFG.bulge;  // never taller than the frame
    const crease = CFG.lensCrease >= 0.5;          // duplicated point = hard edge
    const c = Math.max(0, Math.min(CFG.lensChamfer, R * 0.5, h * 0.49));
    const pts = [new THREE.Vector2(0.0001, h / 2)];
    if (c > 0) {
      // quarter-round bevel from the top face into the rim wall, so the normals turn
      // over a few degrees instead of all at once
      pts.push(new THREE.Vector2(R - c, h / 2));
      const M = 6;
      for (let i = 1; i <= M; i++) {
        const a = (i / M) * Math.PI * 0.5;
        pts.push(new THREE.Vector2(R - c + c * Math.sin(a), h / 2 - c * (1 - Math.cos(a))));
      }
    } else {
      pts.push(new THREE.Vector2(R, h / 2));
      if (crease) pts.push(new THREE.Vector2(R, h / 2));
    }
    pts.push(new THREE.Vector2(R, -h / 2));
    if (crease) pts.push(new THREE.Vector2(R, -h / 2));
    const N = Math.max(4, Math.round(CFG.lensRings));
    for (let i = 1; i <= N; i++) {
      const rr = R * (1 - i / N);
      pts.push(new THREE.Vector2(Math.max(0.0001, rr), -h / 2 - b * (1 - (rr / R) * (rr / R))));
    }
    return pts;
  }
  function lensGeometry() {
    return new THREE.LatheGeometry(lensProfile(), Math.max(24, Math.round(CFG.lensSegments)));
  }
  function lensBottomY(r) { return -Math.min(CFG.lensH, CFG.discH * CFG.holderH) / 2 - CFG.bulge * (1 - (r / DISC_R) * (r / DISC_R)); }

  const glass = new THREE.Mesh(
    lensGeometry(),
    new THREE.ShaderMaterial({
      uniforms: glassUniforms,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vWN; varying vec3 vWP;
        void main() {
          vWN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: AURORA_GLSL + ENV_GLSL + `
        varying vec3 vWN; varying vec3 vWP;
        uniform sampler2D tScene; uniform vec2 uRes;
        uniform float uIor, uRefract, uBlur, uTint, uAbsorb, uRim, uEdge, uSheen;
        uniform float uWash, uWashCore, uUnderEnv, uEnv, uBands, uBandSoft, uEnvRot, uContrast, uSatL;
        uniform float uEdgeDark, uEdgeWidth, uFireThrough; uniform sampler2D tFire;
        uniform vec3 cA, cB, cC;

        vec3 sampleScene(vec2 uv) {
          uv = clamp(uv, vec2(0.001), vec2(0.999));
          if (uBlur <= 0.01) return texture2D(tScene, uv).rgb;
          vec2 e = vec2(uBlur) / uRes;
          vec3 s = texture2D(tScene, uv).rgb * 0.36;
          s += texture2D(tScene, clamp(uv + vec2(e.x, 0.0), vec2(0.001), vec2(0.999))).rgb * 0.16;
          s += texture2D(tScene, clamp(uv - vec2(e.x, 0.0), vec2(0.001), vec2(0.999))).rgb * 0.16;
          s += texture2D(tScene, clamp(uv + vec2(0.0, e.y), vec2(0.001), vec2(0.999))).rgb * 0.16;
          s += texture2D(tScene, clamp(uv - vec2(0.0, e.y), vec2(0.001), vec2(0.999))).rgb * 0.16;
          return s;
        }

        void main() {
          vec3 N = normalize(vWN);
          vec3 V = normalize(cameraPosition - vWP);
          if (dot(N, V) < 0.0) N = -N;              // lathe winding is not guaranteed
          vec2 uv = gl_FragCoord.xy / uRes;

          float f = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);

          // refraction through the body, absorbed over the path length
          float path = mix(1.0, 2.4, 1.0 - abs(dot(N, vec3(0.0, 1.0, 0.0))));
          vec3 Rf = refract(-V, N, 1.0 / max(uIor, 1.001));
          vec3 col = sampleScene(uv + Rf.xy * uRefract) * uTint * exp(-uAbsorb * path);
          // stage 1 (the lens is a circle facing us): the flames right behind it, seen
          // through the glass and contained by it
          col += texture2D(tFire, clamp(uv + Rf.xy * uRefract * 2.0, vec2(0.001), vec2(0.999))).rgb * uFireThrough;

          // reflections of the banded softbox: the white light edges of the Data Core rig
          float faceness = smoothstep(0.72, 0.99, abs(dot(N, vec3(0.0, 1.0, 0.0))));
          float underside = step(dot(N, vec3(0.0, 1.0, 0.0)), 0.0);

          // the underside faces the dark below, so it reflects the rig far less than
          // the top face and the wall — that is what keeps it deep instead of grey
          vec3 env = envCol(normalize(reflect(-V, N)), uBands, uBandSoft, uEnvRot);
          col += env * uEnv * (0.10 + f * 1.7) * mix(1.0, uUnderEnv, underside * faceness);

          col += f * uRim * vec3(1.0, 0.99, 1.02);

          // both faces pick up the colour of the aurora: the top by reflection, the
          // underside by the light that made it through the glass (weaker, warmer)
          float toEdge = smoothstep(0.45, 1.0, length(vWP.xz));
          col += auroraCol(vWP.x, cA, cB, cC) * uSheen * faceness *
                 toEdge * toEdge * mix(1.0, 0.8, underside);

          // the wash: aurora light that crossed the glass, seen on the underside. Looking up
          // from below, the NEAR half of the lens (z > 0) is the upper part of the ellipse on
          // screen — that is where the reference face carries the brown / steel-blue wash;
          // the far rim (bottom of the ellipse) stays black. Soft white core near the centre.
          float nearW = smoothstep(-0.75, 0.45, vWP.z);
          vec3 washCol = auroraCol(vWP.x * 0.9, cA, cB, cC);
          float core = exp(-(vWP.x * vWP.x * 1.6 + (vWP.z - 0.30) * (vWP.z - 0.30) * 4.0));
          col += underside * faceness * uWash *
                 (washCol * (0.02 + 0.6 * nearW) + cB * core * uWashCore);

          // rim wall: warm arc on the left, cool arc on the right, white along the near
          // edge — the three highlights that carry the reference frame
          float side = 1.0 - abs(dot(N, vec3(0.0, 1.0, 0.0)));
          vec2 d = normalize(vec2(N.x, N.z) + vec2(1e-5));
          float front = pow(max(0.0, dot(d, vec2(0.0, 1.0))), 3.0);
          float back = pow(max(0.0, dot(d, vec2(0.0, -1.0))), 6.0);
          float lft = pow(max(0.0, dot(d, vec2(-1.0, 0.0))), 6.0);
          float rgt = pow(max(0.0, dot(d, vec2(1.0, 0.0))), 6.0);
          col += side * uEdge * (front * vec3(1.0, 0.97, 0.92)
                               + back * auroraCol(vWP.x, cA, cB, cC) * 0.55
                               + lft * cA * 1.1 + rgt * cC * 1.1);

          // where the glass meets the frame it goes black, in a radial gradient
          float rr = length(vWP.xz);              // DISC_R is 1
          col *= 1.0 - uEdgeDark * smoothstep(1.0 - uEdgeWidth, 1.0, rr);

          // same finish as the frame: saturation, then an S-curve around mid grey with a
          // soft knee — the body of the glass goes really black, the chips stay bright
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(lum), col, uSatL);
          col = clamp(0.5 + (col - 0.5) * uContrast, 0.0, 1.0);
          col = col * col * (3.0 - 2.0 * col);

          gl_FragColor = vec4(col, 1.0);
        }`
    })
  );
  const lensGroup = new THREE.Group();
  scene.add(lensGroup);
  lensGroup.add(glass);

  // A real magnifier is two parts: the glass, and the frame that holds it. The frame is
  // the Data Core's top-layer plate (the tiles that flip), bent into a ring: ExtrudeGeometry
  // with a 3-step bevel, EdgesGeometry light edges, and the Codrops "Xylophone" glass —
  // screen-space refraction of a pre-blurred studio backdrop plus the scene, Fresnel toward
  // a two-stop sky, white only on the bevel ring, cosine-palette iridescence.
  // Values are Igor's closed Data Core defaults (TUNE in datacore-3d.js, 3rd pass).
  function makeBackdropTexture() {
    // the Data Core's milky "studio backdrop": gradient + soft blobs, born already blurred
    const c = document.createElement("canvas"); c.width = 512; c.height = 512;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#33373d"); grad.addColorStop(0.45, "#1c1f24");
    grad.addColorStop(0.8, "#0d0f12"); grad.addColorStop(1, "#060708");
    g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    function blob(x, y, r, col, a) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(" + col + "," + a + ")");
      rg.addColorStop(1, "rgba(" + col + ",0)");
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    blob(170, 150, 170, "245,248,252", 0.95);  // main highlight (contrast)
    blob(410, 330, 150, "225,230,236", 0.35);  // fill
    blob(256, 470, 260, "10,11,13", 0.8);      // dark base
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
  const FRAME_SEED = 0.5;
  const frameTintBase = 0.055 + 0.075 * FRAME_SEED + 0.055 * 0.5;
  const holderUniforms = {
    tScene: { value: null }, uBackdrop: { value: makeBackdropTexture() },
    tFire: { value: null }, uFire: { value: CFG.frameFire },
    uFireFaces: { value: new THREE.Vector4(CFG.frameFireInner, CFG.frameFireOuter, CFG.frameFireTop, CFG.frameFireBottom) },
    uFireFacing: { value: CFG.frameFireFacing },
    uInnerBL: { value: new THREE.Vector3(CFG.frameInnerBand, CFG.frameInnerLift, CFG.frameInnerRefr) },
    uOuterBL: { value: new THREE.Vector3(CFG.frameOuterBand, CFG.frameOuterLift, CFG.frameOuterRefr) },
    uRimUv: { value: 0.5 },     // screen-v of the lens' top rim, set every frame
    cA: { value: AURORA_A }, cB: { value: AURORA_B }, cC: { value: AURORA_C },
    uContrast: { value: CFG.frameContrast }, uSat: { value: CFG.frameSat }, uScene: { value: CFG.refractScene },
    uRes: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uOffset: { value: new THREE.Vector2(Math.sin(FRAME_SEED * 78.233) * 0.03, Math.sin(FRAME_SEED * 127.1) * 0.03) },
    uMag: { value: CFG.frameMag }, uShift: { value: CFG.frameShift },
    uBody: { value: new THREE.Color(frameTintBase * 0.95, frameTintBase * 0.98, frameTintBase * 1.05) },
    uTransmission: { value: CFG.frameTransmission },
    uRefract: { value: (0.13 + 0.06 * FRAME_SEED) * CFG.frameRefract },
    uFrost: { value: CFG.frameFrost }, uBlurPx: { value: 1.0 },
    uSeed: { value: FRAME_SEED }, uIri: { value: CFG.frameIri }, uFres: { value: CFG.frameFresnel },
    uTopClear: { value: CFG.frameTopClear }, uTopDarken: { value: CFG.frameTopDarken },
    uEdgeWhite: { value: CFG.frameEdgeWhite }, uBackdropMix: { value: CFG.frameBackdrop },
    uSkyTop: { value: new THREE.Color("#eef4ff") }, uSkyHz: { value: new THREE.Color("#8e9aad") },
    uTint: { value: new THREE.Color(CFG.frameTint, CFG.frameTint, CFG.frameTint) }
  };
  // Section of the frame: an annulus from the glass edge (R) out to R + margin, extruded
  // to the glass height × holderH with the plate's bevel (3 segments), like `extrude()`
  // in datacore-3d.js. holderRound scales the bevel.
  function holderGeometry() {
    const R = DISC_R, m = Math.max(0.01, CFG.holderMargin), h = CFG.discH * CFG.holderH;
    const bev = Math.min(m, h) * 0.45 * Math.max(0.02, CFG.holderRound);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, R + m - bev, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, R + bev - 0.002, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev,
      bevelSegments: 3, curveSegments: 180
    });
    geo.rotateX(-Math.PI / 2);                 // XZ plane, height on Y
    geo.computeBoundingBox();
    geo.translate(0, -(geo.boundingBox.max.y + geo.boundingBox.min.y) / 2, 0);
    return geo;
  }
  const holder = new THREE.Mesh(holderGeometry(), new THREE.ShaderMaterial({
    uniforms: holderUniforms,
    vertexShader: `
      varying vec3 vN; varying vec3 vWN; varying vec3 vWP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vWN = normalize(mat3(modelMatrix) * normal);
        vWP = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: AURORA_GLSL + `
      uniform vec3 cA, cB, cC; uniform vec4 uFireFaces; uniform float uFireFacing, uRimUv;
      uniform vec3 uInnerBL, uOuterBL;   // (band, lift, refraction ×) per wall
      varying vec3 vWP;
      uniform sampler2D tScene, uBackdrop, tFire; uniform vec2 uRes, uCenter, uOffset;
      uniform float uMag, uShift, uTransmission, uRefract, uFrost, uBlurPx, uSeed, uIri, uFres, uFire;
      uniform float uContrast, uSat, uScene;
      uniform float uTopClear, uTopDarken, uEdgeWhite, uBackdropMix;
      uniform vec3 uBody, uSkyTop, uSkyHz, uTint;
      varying vec3 vN; varying vec3 vWN;
      vec3 scene(vec2 uv) { return texture2D(tScene, clamp(uv, vec2(0.001), vec2(0.999))).rgb; }
      void main() {
        vec3 N = normalize(vN);
        // the plate's "up" is the face that looks at the camera; seen from below that
        // is the underside of the ring, so the test is symmetric
        float up = clamp(abs(normalize(vWN).y), 0.0, 1.0);
        // which face of the ring this is: inner wall / outer wall / top / bottom
        vec3 wn = normalize(vWN);
        vec2 radial = normalize(vWP.xz + vec2(1e-5, 0.0));
        float nr = dot(wn.xz, radial);                          // +1 outer wall, -1 inner wall
        float wall = 1.0 - smoothstep(0.3, 0.8, abs(wn.y));
        float wInner = smoothstep(0.0, 0.7, -nr) * wall;
        float wOuter = smoothstep(0.0, 0.7, nr) * wall;
        float wTop = smoothstep(0.3, 0.8, wn.y);
        float wBottom = smoothstep(0.3, 0.8, -wn.y);
        // per-wall refraction strength (rims keep 1)
        float refrMul = mix(1.0, uInnerBL.z, wInner) * mix(1.0, uOuterBL.z, wOuter);

        // screen-space refraction (Xylophone): per-piece lens around the piece centre
        vec2 suv = gl_FragCoord.xy / uRes;
        vec2 rel = suv - uCenter;
        vec2 buv = uCenter + rel * uMag + N.xy * uRefract * refrMul + uOffset * uShift;
        // frost: the backdrop is born blurred; the scene gets a 5-tap blur mixed by uFrost
        vec2 e = vec2(uBlurPx * 2.0) / uRes;
        vec3 sharp = scene(buv);
        vec3 soft = sharp * 0.36 + (scene(buv + vec2(e.x, 0.0)) + scene(buv - vec2(e.x, 0.0))
                  + scene(buv + vec2(0.0, e.y)) + scene(buv - vec2(0.0, e.y))) * 0.16;
        vec3 trans = texture2D(uBackdrop, clamp(buv, vec2(0.001), vec2(0.999))).rgb * uBackdropMix
                   + mix(sharp, soft, uFrost) * uScene
                   + texture2D(tFire, clamp(buv, vec2(0.001), vec2(0.999))).rgb * uFire * refrMul;  // the flames, inside
        float topness = smoothstep(0.55, 0.95, up);
        vec3 milky = mix(uBody, trans, uTransmission);          // bevel and sides
        vec3 seeThru = trans * uTopDarken + uBody * 0.12;        // the clear face
        vec3 col = mix(milky, seeThru, topness * uTopClear);
        float ndv = abs(N.z);
        float fres = pow(1.0 - ndv, 3.0);
        vec3 sky = mix(uSkyHz, uSkyTop, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));
        col = mix(col, sky, fres * uFres * (1.0 - 0.7 * topness * uTopClear));
        float bevel = smoothstep(0.02, 0.45, up) * (1.0 - topness);   // white on the bevel ring
        col += sky * bevel * uEdgeWhite;
        float ph = N.x * 1.7 + N.y * 2.3 + N.z * 1.1 + uSeed * 6.2831;
        vec3 iri = 0.5 + 0.5 * cos(6.2831 * vec3(0.0, 0.33, 0.67) + ph * 3.0);
        col += iri * fres * uIri;
        // the fire's glow on the frame, placed by face (uFireFaces), stronger on the faces
        // that look at the camera (uFireFacing). It is a mirror of the LIVE flames: same
        // screen x, a slice of the flames above the rim mapped over the frame's own height.
        // Inner and outer wall each pick their slice: Lift moves it up the flames, Band is
        // how tall it is.
        float place = wInner * uFireFaces.x + wOuter * uFireFaces.y + wTop * uFireFaces.z + wBottom * uFireFaces.w;
        float facing = mix(1.0, max(0.0, N.z), uFireFacing);
        float hFrac = clamp(vWP.y / max(2.0 * 0.5 * 0.125, 0.02) + 0.5, 0.0, 1.0);
        float band = mix(mix(uOuterBL.x, uInnerBL.x, wInner), uOuterBL.x, wOuter * (1.0 - wInner));
        float lift = mix(mix(uOuterBL.y, uInnerBL.y, wInner), uOuterBL.y, wOuter * (1.0 - wInner));
        vec2 fuv = vec2(suv.x, uRimUv + lift + band * (0.15 + 0.85 * hFrac));
        vec3 live = texture2D(tFire, clamp(fuv, vec2(0.001), vec2(0.999))).rgb;
        col += live * place * facing;
        col *= uTint;
        // Igor: whites very white, blacks very black, flames very saturated — an S-curve
        // around mid grey, then saturation, both after the whole glass model
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(lum), col, uSat);
        col = 0.5 + (col - 0.5) * uContrast;
        col = clamp(col, 0.0, 1.0);
        col = col * col * (3.0 - 2.0 * col);                     // soft knee at both ends
        // (the Data Core applies pow 2.2 here because its composer ends in a gamma pass;
        //  this chain has none, so the sRGB-authored colours go out as they are)
        gl_FragColor = vec4(col, 1.0);
      }`
  }));
  lensGroup.add(holder);
  // light edges: white edges from the geometry — the key trait of the Data Core plates
  const FRAME_RIM_BASE = 0.20 + 0.28 * FRAME_SEED;
  const frameRim = new THREE.LineSegments(new THREE.EdgesGeometry(holder.geometry, 20),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: Math.min(1, FRAME_RIM_BASE * CFG.frameRim) }));
  holder.add(frameRim);

  // Rim rings: the bright ellipse on the top edge and the lit lower edge.
  function makeRing(y, dir, color, intensity, sharp) {
    const uniforms = {
      uCol: { value: new THREE.Color(color) }, uInt: { value: intensity },
      uDir: { value: new THREE.Vector2(dir[0], dir[1]) }, uSharp: { value: sharp }
    };
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(DISC_R + CFG.holderMargin + 0.001, 0.0045, 8, 240),
      new THREE.ShaderMaterial({
        uniforms: uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          varying vec3 vWP;
          void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `
          varying vec3 vWP;
          uniform vec3 uCol; uniform float uInt, uSharp; uniform vec2 uDir;
          void main() {
            vec2 d = normalize(vec2(vWP.x, vWP.z) + vec2(1e-5));
            float lobe = pow(max(0.0, dot(d, normalize(uDir))), uSharp);
            float back = pow(max(0.0, dot(d, -normalize(uDir))), uSharp * 2.0) * 0.25;
            float a = uInt * (0.10 + lobe + back);
            gl_FragColor = vec4(uCol * a, a);
          }`
      })
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    mesh.userData.uniforms = uniforms;
    return mesh;
  }
  const ringTop = makeRing(CFG.discH * CFG.holderH / 2, [0, -1], 0xfff3e6, CFG.ringTop, 3.0);
  const ringBottom = makeRing(-CFG.discH * CFG.holderH / 2, [0, 1], 0xdfeaff, CFG.ringBottom, 2.0);
  lensGroup.add(ringTop, ringBottom);

  function rebuildLens() {
    glass.geometry.dispose();
    glass.geometry = lensGeometry();
    holder.geometry.dispose();
    holder.geometry = holderGeometry();
    frameRim.geometry.dispose();
    frameRim.geometry = new THREE.EdgesGeometry(holder.geometry, 20);
    const hh = CFG.discH * CFG.holderH * 0.5;
    auroraUniforms.uFloorY.value = hh;
    ringTop.position.y = hh;
    ringBottom.position.y = -hh;
    partUniforms.uY0.value = lensBottomY(DISC_R) - 0.012;
    buildTraces();
    buildImpacts();
  }

  // Impacts: every dot that reaches the lens leaves a rounded-square ripple on the
  // underside — inverted rain. They sit just inside the glass, so like the dots they are
  // only ever seen through the refraction pre-pass, which is what embeds them in it.
  // fills of the chips (the outline is always pale white): amber, brick, blue, white
  const impactColors = [0xff8a3d, 0xc8623f, 0x4f8dff, 0x4f8dff, 0xffe0c8, 0xffffff];
  let impactGroup = new THREE.Group();
  lensGroup.add(impactGroup);
  let impacts = [];
  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  }
  // A rounded square ring (outer shape with a rounded square hole), unit sized.
  function roundedSquareRing(thick) {
    const outer = roundedRectShape(1, 1, 0.26);
    const inner = roundedRectShape(1 - thick * 2, 1 - thick * 2, 0.26 * (1 - thick * 2));
    outer.holes.push(new THREE.Path(inner.getPoints(40)));
    return outer;
  }

  const impactRnd = seeded(21);
  let columnXZ = [];                              // filled by buildParticles()
  function seatImpact(im) {
    let x, z;
    if (columnXZ.length && impactRnd() < CFG.impactOnColumns) {
      // where a column of dots lands: the square grows out of the dot's arrival point
      const c = columnXZ[(impactRnd() * columnXZ.length) | 0];
      x = c[0] + (impactRnd() - 0.5) * 0.02;
      // triangular spread in depth: most chips on the line, a few up to N widths away
      z = c[1] + (impactRnd() - impactRnd()) * CFG.impactSpreadZ * CFG.impactSize;
    } else {
      const a = impactRnd() * Math.PI * 2;
      const r0 = 0.08 + Math.sqrt(impactRnd()) * 0.82;
      x = Math.cos(a) * r0; z = Math.sin(a) * r0;
    }
    const r = Math.min(0.97, Math.hypot(x, z));
    const y = lensBottomY(r) + 0.010;              // hugging the curved underside
    im.ring.position.set(x, y, z);
    im.core.position.set(x, y + 0.002, z);
    if (im.shaft) im.shaft.position.set(x, y - 0.004, z);
    im.ring.rotation.y = 0;                        // chips sit square, never turned
    im.core.rotation.y = 0;
    const col = impactColors[(impactRnd() * impactColors.length) | 0];
    im.ring.material.color.setHex(0xe6efff);
    im.core.material.color.setHex(col);
    if (im.shaft) im.shaft.material.uniforms.uCol.value.setHex(col).lerp(new THREE.Color(0xffffff), 0.45);
    im.rate = 0.55 + impactRnd() * 0.9;
    im.scale = 0.7 + impactRnd() * 0.8;
  }

  // The shaft of light that enters the glass where a column lands: a vertical quad
  // facing the camera, bright at the underside, fading upwards past the top face.
  const SHAFT_MAT = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(0xffffff) }, uOp: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform vec3 uCol; uniform float uOp;
      void main() {
        float xw = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));       // soft across
        float yw = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.08, vUv.y); // bright at the foot
        float a = xw * yw * uOp;
        gl_FragColor = vec4(uCol * a, a);
      }`
  });

  function buildImpacts() {
    disposeGroup(impactGroup);
    impacts = [];
    const shaftGeo = new THREE.PlaneGeometry(1, 1);
    shaftGeo.translate(0, 0.5, 0);                 // pivot at the foot
    const ringGeo = new THREE.ShapeGeometry(roundedSquareRing(0.16), 10);
    ringGeo.rotateX(-Math.PI / 2);
    const coreGeo = new THREE.ShapeGeometry(roundedRectShape(1, 1, 0.26), 10);
    coreGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < Math.round(CFG.impactCount); i++) {
      const mk = function (geo) {
        return new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
          transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
          depthWrite: false, side: THREE.DoubleSide
        }));
      };
      const shaft = new THREE.Mesh(shaftGeo.clone(), SHAFT_MAT.clone());
      shaft.rotation.x = 0;                        // the quad stands in the x-y plane, facing +z
      const im = { ring: mk(ringGeo), core: mk(coreGeo), shaft: shaft, t: impactRnd(), rate: 1, scale: 1 };
      seatImpact(im);
      impactGroup.add(im.ring, im.core, im.shaft);
      impacts.push(im);
    }
    ringGeo.dispose();
    coreGeo.dispose();
    shaftGeo.dispose();
  }

  function updateImpacts(dt) {
    for (let i = 0; i < impacts.length; i++) {
      const im = impacts[i];
      im.t += dt * CFG.impactRate * im.rate * CFG.timeScale;
      if (im.t >= 1) { im.t -= Math.floor(im.t); seatImpact(im); }
      const t = im.t;
      const fade = Math.pow(1 - t, 1.7) * Math.min(1, t / 0.06);
      const s = CFG.impactSize * im.scale * (1.0 + t * CFG.impactGrow);
      im.ring.scale.set(s, 1, s);
      im.ring.material.opacity = CFG.impactOpacity * fade * stage.chip;
      const cs = CFG.impactSize * im.scale * (0.92 - t * 0.12);
      im.core.scale.set(cs, 1, cs);
      im.core.material.opacity = CFG.impactOpacity * 0.6 * Math.pow(1 - t, 1.4) * Math.min(1, t / 0.04) * stage.chip;
      // the shaft flares as the column lands, then decays with the chip
      im.shaft.scale.set(CFG.impactSize * im.scale * CFG.shaftW, CFG.shaftH * (0.7 + 0.3 * im.scale), 1);
      im.shaft.material.uniforms.uOp.value = CFG.shaftOpacity * Math.pow(1 - t, 1.2) * Math.min(1, t / 0.05) * stage.chip;
    }
  }

  // ---------------------------------------------------------------- signal traces
  // Beams are simulated on the CPU. Each one walks a live path: vertical run, quarter
  // circle, short horizontal, quarter circle, vertical run… with the SVG's rhythm
  // (Vector_1.svg: offset 37.5 = traceJogLen, runs 102 / 45 / 69). The pointer pushes the
  // head sideways while it climbs, so the path itself bends around the hand; with no
  // pointer the motion is exactly the old one. What is drawn is the head (a point sprite)
  // and its trail (a camera-facing ribbon that fades along traceTail).
  const TRAIL_N = 96;                              // trail samples kept per beam
  const traceShared = { uGlow: { value: CFG.traceGlow } };
  let traceGroup = new THREE.Group();              // holds the ribbon mesh
  scene.add(traceGroup);
  let beams = [], ribbon = null, heads = null;
  const headUniforms = { uSize: { value: CFG.traceHeadSize }, uPx: { value: 300 }, uGlow: { value: CFG.traceGlow } };

  // world height of the viewport's top edge on the x-y plane, plus room for parallax
  function traceTopY() {
    const el = THREE.MathUtils.degToRad(Math.abs(CFG.camEl) + 8);
    return CFG.camY + (CFG.viewH / 2) / Math.cos(el) + 0.35;
  }
  const beamRnd = seeded(77);

  // the path programme of one beam: a list of segments the head consumes in order
  function planSegments(b) {
    const R = CFG.traceCornerR, unit = CFG.traceJogLen * CFG.traceRun;
    const dx = Math.max(CFG.traceJogLen, 2 * R + 0.005);
    const RUN_A = 2.72 * unit, RUN_B = 1.2 * unit, RUN_C = 1.84 * unit;
    b.segs = [];
    // a random entry point of the loop, then S, B, S, (C + A), S, B, S…
    b.segs.push({ k: "run", len: b.phase * (RUN_C + RUN_A) + 0.04 });
    let dir = b.dir;
    for (let i = 0; i < 40; i++) {
      b.segs.push({ k: "s", dir: dir, dx: dx, R: R, len: Math.PI * R + dx - 2 * R });
      dir = -dir;
      b.segs.push({ k: "run", len: (i % 2 === 0) ? RUN_B : RUN_C + RUN_A });
    }
    b.si = 0; b.sp = 0;                             // segment index, progress along it
  }
  function spawnBeam(b, warm) {
    const c = columnXZ.length ? columnXZ[b.slot % columnXZ.length]
                              : [(-0.78 + 1.56 * (b.slot + 0.5) / Math.max(1, CFG.traceCount)) * CFG.partSpan, 0];
    b.x = c[0]; b.z = c[1] + (beamRnd() * 2 - 1) * CFG.traceLineZ;
    b.y = Math.min(CFG.lensH, CFG.discH * CFG.holderH) / 2 + 0.02;
    b.y0 = b.y;
    b.phase = beamRnd();
    b.dir = CFG.traceSameDir ? 1 : (b.slot % 2 === 0 ? 1 : -1);
    b.speed = (0.6 + beamRnd() * 0.5) * 4;          // × traceSpeed → world units per second
    b.wait = warm ? 0 : CFG.traceGap * (0.5 + beamRnd());
    b.n = 0; b.head = 0;
    planSegments(b);
    for (let i = 0; i < TRAIL_N; i++) { b.tx[i] = b.x; b.ty[i] = b.y; b.tz[i] = b.z; }
  }
  // position within an S-step at arc length t, relative to its start
  function sPos(sg, t) {
    const q = Math.PI / 2 * sg.R, st = sg.dx - 2 * sg.R;
    if (t <= q) { const a = t / sg.R; return [sg.dir * sg.R * (1 - Math.cos(a)), sg.R * Math.sin(a)]; }
    if (t <= q + st) return [sg.dir * (sg.R + (t - q)), sg.R];
    const a = Math.min(Math.PI / 2, (t - q - st) / sg.R);
    return [sg.dir * (sg.R + st + sg.R * Math.sin(a)), sg.R + sg.R * (1 - Math.cos(a))];
  }
  // advance the head along its programme by `d` world units (may cross segments)
  function advance(b, d) {
    while (d > 1e-6 && b.si < b.segs.length) {
      const sg = b.segs[b.si];
      const left = sg.len - b.sp, step = Math.min(left, d);
      if (sg.k === "run") { b.y += step; }
      else {
        const p0 = sPos(sg, b.sp), p1 = sPos(sg, b.sp + step);
        b.x += p1[0] - p0[0]; b.y += p1[1] - p0[1];
      }
      b.sp += step; d -= step;
      if (b.sp >= sg.len - 1e-6) { b.si++; b.sp = 0; }
    }
  }
  function stepBeam(b, dt, warm) {
    if (b.wait > 0) { b.wait -= dt; return; }
    b.cool = Math.max(0, (b.cool || 0) - dt);
    if (!warm && hoverUniforms.uHoverOn.value > 0.001 && CFG.hoverDodge > 0 && b.cool <= 0) {
      // dodge: never a diagonal. When the pointer is close and the beam is on a vertical
      // run, the run is cut here and an extra S-step AWAY from the pointer is inserted in
      // the programme (wider the closer the pointer), then a short run, then the zipper
      // resumes with its alternation re-phased. The only curves are still the corners.
      const sg = b.segs[b.si];
      if (sg && sg.k === "run") {
        const hv = hoverUniforms.uHover.value, asp = hoverUniforms.uAspect.value;
        _tmp.set(b.x, b.y, b.z).project(camera);
        const ox = (_tmp.x - hv.x) * asp, oy = _tmp.y - hv.y;
        const f = Math.exp(-(ox * ox + oy * oy) / Math.max(CFG.hoverRadius * CFG.hoverRadius, 1e-4)) * hoverUniforms.uHoverOn.value;
        if (f > 0.12) {
          const away = ox >= 0 ? 1 : -1;
          const R = CFG.traceCornerR;
          const dx = Math.max(CFG.traceJogLen, 2 * R + 0.005) * (1 + 3.0 * CFG.hoverDodge * f);
          sg.len = Math.max(b.sp + 0.005, 0.01);              // finish this run right here
          b.segs.splice(b.si + 1, 0,
            { k: "s", dir: away, dx: dx, R: R, len: Math.PI * R + dx - 2 * R },
            { k: "run", len: 1.2 * CFG.traceJogLen * CFG.traceRun });
          let dir = -away;                                     // re-phase what follows
          for (let i = b.si + 3; i < b.segs.length; i++) if (b.segs[i].k === "s") { b.segs[i].dir = dir; dir = -dir; }
          b.cool = 0.35;                                       // one decision at a time
        }
      }
    }
    advance(b, b.speed * CFG.traceSpeed * dt);
    b.head = (b.head + 1) % TRAIL_N;
    b.tx[b.head] = b.x; b.ty[b.head] = b.y; b.tz[b.head] = b.z;
    if (b.n < TRAIL_N) b.n++;
    if (b.y - CFG.traceTail > traceTopY()) spawnBeam(b, warm);   // out at the top: restart
  }
  function updateBeams(dt) {
    if (!beams.length) return;
    beams.forEach(function (b) { stepBeam(b, dt, false); });
    writeRibbon();
  }
  // the ribbon: 2 vertices per trail sample per beam, camera-facing, alpha fading along the tail
  const _p = new THREE.Vector3(), _q2 = new THREE.Vector3(), _nrm = new THREE.Vector3(), _camDir = new THREE.Vector3();
  function writeRibbon() {
    if (!ribbon) return;
    const pos = ribbon.geometry.attributes.position.array;
    const alp = ribbon.geometry.attributes.aAlpha.array;
    const hp = heads.geometry.attributes.position.array;
    const ha = heads.geometry.attributes.aAlpha.array;
    const w0 = CFG.traceRadius;
    camera.getWorldDirection(_camDir);
    // thickening near the pointer: field of the pointer at a world point, 0..1
    const hv = hoverUniforms.uHover.value, asp = hoverUniforms.uAspect.value, hOn = hoverUniforms.uHoverOn.value;
    const R2 = Math.max(CFG.hoverRadius * CFG.hoverRadius, 1e-4), thick = CFG.hoverThick;
    const near = function (x, y, z) {
      if (hOn <= 0.001 || thick <= 0) return 0;
      _tmp.set(x, y, z).project(camera);
      const ox = (_tmp.x - hv.x) * asp, oy = _tmp.y - hv.y;
      return Math.exp(-(ox * ox + oy * oy) / R2) * hOn;
    };
    const hs = heads.geometry.attributes.aSize.array;
    let vi = 0;
    beams.forEach(function (b, bi) {
      hp[bi * 3] = b.x; hp[bi * 3 + 1] = b.y; hp[bi * 3 + 2] = b.z;
      const fadeInHead = Math.min(1, Math.max(0, (b.y - b.y0) / Math.max(CFG.traceFadeIn, 0.01)));
      ha[bi] = b.wait > 0 ? 0 : fadeInHead;
      hs[bi] = 1 + thick * near(b.x, b.y, b.z);         // the head swells with the line
      let dist = 0;
      for (let k = 0; k < TRAIL_N; k++) {
        const i = (b.head - k + TRAIL_N) % TRAIL_N;
        if (k > 0) {
          const i2 = (b.head - k + 1 + TRAIL_N) % TRAIL_N;
          dist += Math.hypot(b.tx[i] - b.tx[i2], b.ty[i] - b.ty[i2], b.tz[i] - b.tz[i2]);
        }
        let a = b.wait > 0 ? 0 : Math.max(0, 1 - dist / Math.max(CFG.traceTail, 0.01));
        a *= Math.min(1, Math.max(0, (b.ty[i] - b.y0) / Math.max(CFG.traceFadeIn, 0.01)));  // fades in above the lens
        if (k >= b.n) a = 0;
        // direction along the trail (towards the head) → side vector facing the camera
        const j = (b.head - Math.max(0, k - 1) + TRAIL_N) % TRAIL_N;
        _p.set(b.tx[i], b.ty[i], b.tz[i]);
        _q2.set(b.tx[j], b.ty[j], b.tz[j]).sub(_p);
        if (_q2.lengthSq() < 1e-10) _q2.set(0, 1, 0);
        const w = w0 * (1 + thick * near(_p.x, _p.y, _p.z));   // fatter the closer to the pointer
        _nrm.crossVectors(_q2, _camDir).normalize().multiplyScalar(w);
        pos[vi * 3] = _p.x + _nrm.x; pos[vi * 3 + 1] = _p.y + _nrm.y; pos[vi * 3 + 2] = _p.z + _nrm.z; alp[vi] = a; vi++;
        pos[vi * 3] = _p.x - _nrm.x; pos[vi * 3 + 1] = _p.y - _nrm.y; pos[vi * 3 + 2] = _p.z - _nrm.z; alp[vi] = a; vi++;
      }
    });
    ribbon.geometry.attributes.position.needsUpdate = true;
    ribbon.geometry.attributes.aAlpha.needsUpdate = true;
    heads.geometry.attributes.position.needsUpdate = true;
    heads.geometry.attributes.aAlpha.needsUpdate = true;
    heads.geometry.attributes.aSize.needsUpdate = true;
  }
  function buildTraces() {
    disposeGroup(traceGroup);
    if (heads) { heads.geometry.dispose(); scene.remove(heads); heads = null; }
    const nTr = Math.max(0, Math.round(CFG.traceCount));
    const count = nTr * Math.max(1, Math.round(CFG.traceBeams));
    beams = [];
    for (let i = 0; i < count; i++) {
      const b = { slot: i % Math.max(1, nTr),
                  tx: new Float32Array(TRAIL_N), ty: new Float32Array(TRAIL_N), tz: new Float32Array(TRAIL_N) };
      spawnBeam(b, true);
      beams.push(b);
    }
    if (!count) { ribbon = null; return; }
    // ribbon geometry: one indexed strip per beam
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * TRAIL_N * 2 * 3), 3));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count * TRAIL_N * 2), 1));
    const idx = [];
    for (let b = 0; b < count; b++) {
      const base = b * TRAIL_N * 2;
      for (let k = 0; k < TRAIL_N - 1; k++) {
        const a0 = base + k * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
        idx.push(a0, a1, b0, a1, b1, b0);
      }
    }
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 8);
    ribbon = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: traceShared, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `
        attribute float aAlpha; varying float vA;
        void main() { vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uGlow; varying float vA;
        void main() {
          float a = vA * vA * uGlow * 1.2;                  // bright at the head, gone at the tail
          if (a <= 0.003) discard;
          gl_FragColor = vec4(vec3(1.0, 0.985, 0.96) * a, a);
        }`
    }));
    ribbon.frustumCulled = false;
    traceGroup.add(ribbon);
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    hg.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    hg.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count).fill(1), 1));
    hg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 8);
    heads = new THREE.Points(hg, new THREE.ShaderMaterial({
      uniforms: headUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uSize, uPx; attribute float aAlpha, aSize; varying float vA;
        void main() {
          vA = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(2.0, uSize * uPx * aSize);
        }`,
      fragmentShader: `
        uniform float uGlow; varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c) * 4.0;
          float a = (smoothstep(0.25, 0.0, d) * 1.2 + exp(-d * 6.0) * 0.6) * uGlow * vA;
          if (a <= 0.003) discard;
          gl_FragColor = vec4(vec3(1.0, 0.99, 0.97) * a, a);
        }`
    }));
    heads.frustumCulled = false;
    scene.add(heads);
    // warm start: each beam has already travelled a different share of the climb, so the
    // frame is populated from the first moment (as the old phase-offset tubes were)
    const dt = 1 / 60, climb = traceTopY() / Math.max(0.02, 0.85 * 4 * CFG.traceSpeed);
    beams.forEach(function (b, i) {
      const n = Math.round(climb * 60 * (0.15 + 0.85 * ((i * 7) % 11) / 11));
      for (let k = 0; k < n; k++) stepBeam(b, dt, true);
    });
    writeRibbon();
  }

  // ---------------------------------------------------------------- data rain
  const partUniforms = {
    uTime: { value: 0 }, uSpeed: { value: CFG.partSpeed }, uFall: { value: CFG.partFall },
    uSpread: { value: CFG.partSpread }, uJitter: { value: CFG.partJitter },
    uSize: { value: CFG.partSize }, uPx: { value: 300 }, uOpacity: { value: CFG.partOpacity },
    uUp: { value: CFG.flowUp }, uY0: { value: -(0.13 / 2 + 0.012) },
    uOrder: { value: CFG.partOrder }, uScatter: { value: CFG.partScatter }
  };
  Object.assign(partUniforms, hoverUniforms);
  let points = null;

  function buildParticles() {
    if (points) { points.geometry.dispose(); scene.remove(points); }
    const n = CFG.partCount, cols = Math.max(3, Math.round(CFG.partColumns));
    const per = Math.max(1, Math.floor(n / cols));
    const total = per * cols;
    const rnd = seeded(3);
    const pos = new Float32Array(total * 3);      // unused placeholder, kept for gl_Position path
    const aCol = new Float32Array(total * 2);
    const aOff = new Float32Array(total * 2);
    const aPhase = new Float32Array(total);
    const aSpd = new Float32Array(total);
    const aSize = new Float32Array(total);
    let k = 0;
    columnXZ = [];
    for (let c = 0; c < cols; c++) {
      const cx = (cols === 1) ? 0 : (-0.78 + (1.56 * c) / (cols - 1)) * CFG.partSpan;
      const cz = (rnd() * 2 - 1) * CFG.partLineZ;               // 0 = all on the centre line
      columnXZ.push([cx, cz]);
      const colSpd = 0.92 + rnd() * 0.18;         // one speed per column keeps the beads spaced
      for (let j = 0; j < per; j++, k++) {
        aCol[k * 2] = cx;                           // the ordered row is one dot thick
        aCol[k * 2 + 1] = cz;
        // a point in the unit disc: the mouth of the funnel is a real 3-D cone
        const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
        aOff[k * 2] = Math.cos(a) * rr;
        aOff[k * 2 + 1] = Math.sin(a) * rr;
        aPhase[k] = j / per + (rnd() - 0.5) * 0.006;
        aSpd[k] = colSpd * (1 + (rnd() - 0.5) * 0.2 * CFG.partSpeedVar);
        aSize[k] = 0.7 + rnd() * 0.7;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aCol", new THREE.BufferAttribute(aCol, 2));
    geo.setAttribute("aOff", new THREE.BufferAttribute(aOff, 2));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
    geo.setAttribute("aSpd", new THREE.BufferAttribute(aSpd, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1.2, 0), 4);

    const mat = new THREE.ShaderMaterial({
      uniforms: partUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec2 aCol; attribute vec2 aOff;
        attribute float aPhase; attribute float aSpd; attribute float aSize;
        uniform float uTime, uSpeed, uFall, uSpread, uJitter, uSize, uPx, uUp, uY0, uOrder, uScatter;
        ` + HOVER_GLSL + `
        varying float vA;
        void main() {
          // u = how far the dot still is from the lens. uUp = 1 makes it shrink over time,
          // so the rain rises: scattered far below, in tight columns as it reaches the lens.
          float t = fract(aPhase + uTime * uSpeed * aSpd);
          float u = mix(t, 1.0 - t, uUp);
          // w = disorder: 0 through the ordered stretch next to the lens, then growing
          float w = pow(smoothstep(uOrder, 1.0, u), uScatter);
          float s = uSpread * w;
          vec3 p = vec3(
            aCol.x + aOff.x * s + sin(u * 9.0 + aPhase * 40.0) * uJitter * w,
            uY0 - u * uFall,
            aCol.y + aOff.y * s + cos(u * 7.0 + aPhase * 31.0) * uJitter * w
          );
          // chaos: under the pointer (or when the phone is shaken) the dot leaves its
          // column along its own funnel direction and trembles
          vec2 ho; float hf = hoverField(p, ho);
          float chaos = (hf + uChaosGlobal) * uHoverChaos;
          float tr = sin(uTime * 9.0 + aPhase * 60.0);
          p += vec3(aOff.x, 0.25 * tr, aOff.y) * chaos * (0.7 + 0.3 * tr);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.0, uSize * aSize * uPx);
          float aIn = mix(smoothstep(0.0, 0.03, u), 1.0 - smoothstep(0.90, 1.0, u), uUp);
          float aOut = mix(1.0 - smoothstep(0.40, 1.0, u), smoothstep(0.0, 0.04, u), uUp);
          vA = aIn * aOut * mix(1.0, 0.55 + 0.65 * (1.0 - u), uUp);
        }`,
      fragmentShader: `
        varying float vA;
        uniform float uOpacity;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.25, 0.03, dot(c, c)) * vA * uOpacity;
          if (a <= 0.003) discard;
          gl_FragColor = vec4(vec3(1.0), a);
        }`
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
  }

  // ---------------------------------------------------------------- post chain
  // Our own pipeline: MSAA on the render targets (WebGL2) + bright pass + 2-level
  // bloom + optional FXAA. Nothing here depends on three's examples/ bundles.
  let fireRT = null, preRT = null, mainRT = null, brightRT = null, blurRT = null, downRT = null, downRT2 = null, outRT = null;
  const supportsSamples = (function () {
    const rt = new THREE.WebGLRenderTarget(2, 2);
    const ok = ("samples" in rt) && isWebGL2;
    rt.dispose();
    return ok;
  })();

  function makeRT(w, h, samples, depth) {
    const rt = new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: !!depth, stencilBuffer: false
    });
    if (supportsSamples && samples > 0) rt.samples = samples;
    return rt;
  }

  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uThresh: { value: CFG.bloomThresh } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uThresh;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = max(c.r, max(c.g, c.b));
        float k = max(0.0, l - uThresh) / max(l, 1e-4);
        gl_FragColor = vec4(c * k, 1.0);
      }`
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir;
      void main() {
        vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
        s += (texture2D(tDiffuse, vUv + uDir * 1.3846153846).rgb +
              texture2D(tDiffuse, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
        s += (texture2D(tDiffuse, vUv + uDir * 3.2307692308).rgb +
              texture2D(tDiffuse, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
        gl_FragColor = vec4(s, 1.0);
      }`
  });
  const copyMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse;
      void main(){ gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }`
  });
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      tBase: { value: null }, tBloom: { value: null }, tBloom2: { value: null },
      uStrength: { value: CFG.bloomStrength }, uOn: { value: CFG.bloom }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D tBase, tBloom, tBloom2; uniform float uStrength, uOn;
      void main() {
        vec3 base = texture2D(tBase, vUv).rgb;
        vec3 bl = texture2D(tBloom, vUv).rgb + texture2D(tBloom2, vUv).rgb * 0.75;
        gl_FragColor = vec4(base + bl * uStrength * uOn, 1.0);
      }`
  });
  const fxaaMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uRes;
      float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      void main() {
        vec2 px = 1.0 / uRes;
        float lNW = luma(texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * px).rgb);
        float lNE = luma(texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * px).rgb);
        float lSW = luma(texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * px).rgb);
        float lSE = luma(texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * px).rgb);
        vec3 rgbM = texture2D(tDiffuse, vUv).rgb;
        float lM = luma(rgbM);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
        float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float red = max((lNW + lNE + lSW + lSE) * 0.25 * 0.125, 0.0078125);
        float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
        dir = clamp(dir * rcp, -8.0, 8.0) * px;
        vec3 rgbA = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
                           texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
        vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb +
                                         texture2D(tDiffuse, vUv + dir * 0.5).rgb);
        float lB = luma(rgbB);
        gl_FragColor = vec4((lB < lMin || lB > lMax) ? rgbA : rgbB, 1.0);
      }`
  });

  // ---------------------------------------------------------------- sizing
  let W = 2, H = 2, dpr = 1;
  function resize() {
    layoutScroll();                    // boxW / boxH first: everything below sizes off them
    const cw = Math.max(1, boxW);
    const ch = Math.max(1, boxH);
    dpr = Math.min(window.devicePixelRatio || 1, CFG.dprCap);
    W = Math.round(cw * dpr);
    H = Math.round(ch * dpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cw, ch, false);

    const pre = Math.max(0.4, CFG.prePass);
    const half = { w: Math.max(2, W >> 1), h: Math.max(2, H >> 1) };
    const quarter = { w: Math.max(2, W >> 2), h: Math.max(2, H >> 2) };
    [fireRT, preRT, mainRT, brightRT, blurRT, downRT, downRT2, outRT].forEach(function (rt) { if (rt) rt.dispose(); });
    preRT = makeRT(W * pre, H * pre, CFG.msaa, true);
    fireRT = makeRT(W * 0.25, H * 0.25, 0, false);   // the flames alone, quarter res
    mainRT = makeRT(W, H, CFG.msaa, true);
    brightRT = makeRT(half.w, half.h, 0, false);
    blurRT = makeRT(half.w, half.h, 0, false);
    downRT = makeRT(quarter.w, quarter.h, 0, false);
    downRT2 = makeRT(quarter.w, quarter.h, 0, false);
    outRT = makeRT(W, H, 0, false);

    glassUniforms.uRes.value.set(W, H);
    fxaaMat.uniforms.uRes.value.set(W, H);
    updateCamera();
    partUniforms.uPx.value = H / viewHeight();   // pixels per world unit (orthographic)
    headUniforms.uPx.value = H / viewHeight();
    hoverUniforms.uAspect.value = W / H;
  }

  let camAzRad = 0;
  // How much world height the camera shows. The lens is 2 world units across, so this
  // is what decides how big it lands on screen. Two guards, and the ORDER matters:
  //
  //   1. zoom IN until the lens is at least lensMinPx across. At a fixed viewH the lens
  //      holds ~40 % of the width of a 16:9 box whatever the size of that box, so on a
  //      small window it is a few hundred pixels and the animation reads as a detail.
  //      The cap works out to lensWorld x boxH / lensMinPx — it depends only on the
  //      box HEIGHT, which is why it still fires on a window that is short but wide,
  //      where the box proportion alone cannot help.
  //   2. never past viewWMin of visible width, or a tall box crops the lens sideways:
  //      the visible width is h x aspect, and at 1:2 a fixed viewH leaves only 1.4
  //      world units of width for a 2-unit lens. This floor wins over the cap above,
  //      so guard 1 can never cut the lens off.
  //
  // A full-size desktop is untouched: there the cap sits above viewH and neither fires.
  function viewHeight() {
    const aspect = Math.max(0.2, boxW / Math.max(1, boxH));
    const lensWorld = 2 * (1 + CFG.holderMargin);
    const cap = CFG.lensMinPx > 0 ? (lensWorld * boxH / CFG.lensMinPx) : Infinity;
    return Math.max(Math.min(CFG.viewH, cap), CFG.viewWMin / aspect);
  }
  function updateCamera() {
    const el = THREE.MathUtils.degToRad(CFG.camEl + tilt.y * CFG.parallax * 7.0);
    const az = THREE.MathUtils.degToRad(CFG.camAz + tilt.x * CFG.parallax * 9.0);
    camAzRad = az;
    const d = 14;
    target.set(0, CFG.camY + stage.camLift, 0);
    camera.position.set(
      d * Math.cos(el) * Math.sin(az),
      d * Math.sin(el) + target.y,
      d * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(target);
    const aspect = Math.max(0.2, boxW / Math.max(1, boxH));
    const h = viewHeight(), w = h * aspect;
    camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2;
    camera.near = 0.1; camera.far = 60;
    camera.updateProjectionMatrix();
    partUniforms.uPx.value = H / viewHeight();
    headUniforms.uPx.value = H / viewHeight();
    hoverUniforms.uAspect.value = W / H;
  }

  // ---------------------------------------------------------------- parallax (pointer + gyroscope)
  // Inline stand-in for experiments/lib/tilt-parallax.js: both inputs land in the same
  // ±0.6 range; on a phone the neutral pose is how the device is being held.
  const tilt = { x: 0, y: 0 }, tiltTarget = { x: 0, y: 0 };
  let hoverSeen = false, hoverPresence = 0, shakeLevel = 0, gyroActive = false;
  window.addEventListener("pointermove", function (e) {
    // relative to the canvas, and the hover only counts while the pointer is over
    // it — in the page the rest of the window belongs to the article, not to us
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    tiltTarget.x = ((e.clientX - r.left) / r.width - 0.5) * 1.2;
    tiltTarget.y = ((e.clientY - r.top) / r.height - 0.5) * -1.2;
    hoverSeen = e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top && e.clientY <= r.bottom;
  }, { passive: true });
  window.addEventListener("pointerleave", function () { hoverSeen = false; });
  document.addEventListener("mouseleave", function () { hoverSeen = false; });
  window.addEventListener("blur", function () { hoverSeen = false; });

  // On a phone the parallax comes from ../../lib/tilt-parallax.js, shared with
  // experiments 3 and 4: same plus/minus 1 range as the pointer, the neutral pose is
  // however the device is being held, and the iOS permission prompt is handled there.
  // The study carried its own copy of all that inline; this is port note 3.
  if (window.TiltParallax) {
    window.TiltParallax.start(function (x, y) {
      tiltTarget.x = THREE.MathUtils.clamp(x * 0.6, -0.6, 0.6);
      tiltTarget.y = THREE.MathUtils.clamp(y * 0.6, -0.6, 0.6);
      gyroActive = true;
      hoverSeen = true;                          // on a phone the tilt is the pointer
    }, { range: 22 });
  }

  // ---------------------------------------------------------------- helpers
  function seeded(seed) {
    let s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function disposeGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  function applyAll() {
    auroraUniforms.uInt.value = CFG.auroraInt;
    auroraUniforms.uSpread.value = CFG.auroraSpread;
    auroraUniforms.uHeight.value = CFG.auroraHeight;
    auroraUniforms.uFlame.value = CFG.auroraFlame;
    auroraUniforms.uFlow.value = CFG.auroraFlow;
    auroraUniforms.uSat.value = CFG.auroraSat;

    glassUniforms.uIor.value = CFG.ior;
    glassUniforms.uRefract.value = CFG.refract;
    glassUniforms.uBlur.value = CFG.glassBlur;
    glassUniforms.uTint.value = CFG.tint;
    glassUniforms.uAbsorb.value = CFG.absorb;
    glassUniforms.uEnv.value = CFG.env;
    glassUniforms.uBands.value = CFG.envBands;
    glassUniforms.uBandSoft.value = CFG.envSoft;
    glassUniforms.uEnvRot.value = CFG.envRot;
    holderUniforms.uTransmission.value = CFG.frameTransmission;
    holderUniforms.uRefract.value = (0.13 + 0.06 * FRAME_SEED) * CFG.frameRefract;
    holderUniforms.uFrost.value = CFG.frameFrost;
    holderUniforms.uMag.value = CFG.frameMag;
    holderUniforms.uShift.value = CFG.frameShift;
    holderUniforms.uFres.value = CFG.frameFresnel;
    holderUniforms.uTopClear.value = CFG.frameTopClear;
    holderUniforms.uTopDarken.value = CFG.frameTopDarken;
    holderUniforms.uEdgeWhite.value = CFG.frameEdgeWhite;
    holderUniforms.uIri.value = CFG.frameIri;
    holderUniforms.uBody.value.setRGB(frameTintBase * 0.95, frameTintBase * 0.98, frameTintBase * 1.05).multiplyScalar(CFG.frameBody);
    holderUniforms.uTint.value.setRGB(CFG.frameTint, CFG.frameTint, CFG.frameTint);
    holderUniforms.uBackdropMix.value = CFG.frameBackdrop;
    holderUniforms.uFire.value = CFG.frameFire;
    holderUniforms.uFireFaces.value.set(CFG.frameFireInner, CFG.frameFireOuter, CFG.frameFireTop, CFG.frameFireBottom);
    holderUniforms.uFireFacing.value = CFG.frameFireFacing;
    holderUniforms.uInnerBL.value.set(CFG.frameInnerBand, CFG.frameInnerLift, CFG.frameInnerRefr);
    holderUniforms.uOuterBL.value.set(CFG.frameOuterBand, CFG.frameOuterLift, CFG.frameOuterRefr);
    holderUniforms.uContrast.value = CFG.frameContrast;
    holderUniforms.uSat.value = CFG.frameSat;
    holderUniforms.uScene.value = CFG.refractScene;
    frameRim.material.opacity = Math.min(1, FRAME_RIM_BASE * CFG.frameRim);
    glassUniforms.uRim.value = CFG.rim;
    glassUniforms.uEdge.value = CFG.edge;
    glassUniforms.uSheen.value = CFG.sheen;
    glassUniforms.uWash.value = CFG.wash;
    glassUniforms.uWashCore.value = CFG.washCore;
    glassUniforms.uUnderEnv.value = CFG.underEnv;
    glassUniforms.uContrast.value = CFG.lensContrast;
    glassUniforms.uSatL.value = CFG.lensSat;
    glassUniforms.uEdgeDark.value = CFG.lensEdgeDark;
    glassUniforms.uEdgeWidth.value = CFG.lensEdgeWidth;
    auroraUniforms.uWidth.value = CFG.auroraWidth;
    auroraUniforms.uSep.value = CFG.flameSep;
    auroraUniforms.uHA.value = CFG.flameHeightA;
    auroraUniforms.uHB.value = CFG.flameHeightB;
    auroraUniforms.uWhite.value = CFG.flameWhite;
    auroraUniforms.uPulse.value = CFG.flamePulse;
    auroraUniforms.uRateA.value = CFG.flameRateA;
    auroraUniforms.uRateB.value = CFG.flameRateB;
    headUniforms.uSize.value = CFG.traceHeadSize;
    headUniforms.uGlow.value = CFG.traceGlow;
    ringTop.userData.uniforms.uInt.value = CFG.ringTop;
    ringBottom.userData.uniforms.uInt.value = CFG.ringBottom;

    traceShared.uGlow.value = CFG.traceGlow;

    partUniforms.uSpeed.value = CFG.partSpeed;
    partUniforms.uFall.value = CFG.partFall;
    partUniforms.uSpread.value = CFG.partSpread;
    partUniforms.uJitter.value = CFG.partJitter;
    partUniforms.uSize.value = CFG.partSize;
    partUniforms.uOpacity.value = CFG.partOpacity;
    partUniforms.uOrder.value = CFG.partOrder;
    hoverUniforms.uHoverR.value = CFG.hoverRadius;
    layoutScroll();
    hoverUniforms.uHoverChaos.value = CFG.hoverChaos;
    hoverUniforms.uHoverDodge.value = CFG.hoverDodge;
    partUniforms.uScatter.value = CFG.partScatter;
    partUniforms.uUp.value = CFG.flowUp;

    brightMat.uniforms.uThresh.value = CFG.bloomThresh;
    compositeMat.uniforms.uStrength.value = CFG.bloomStrength;
    compositeMat.uniforms.uOn.value = CFG.bloom;

    updateCamera();
  }

  function rebuild(kind) {
    if (kind === "lens") rebuildLens();
    else if (kind === "traces") buildTraces();
    else if (kind === "particles") { buildParticles(); buildTraces(); }
    else if (kind === "impacts") buildImpacts();
    else if (kind === "targets") resize();
  }

  window.CONTEXT_INFO = function () {
    const info = {
      webgl2: isWebGL2,
      msaaRequested: CFG.msaa,
      msaaInEffect: supportsSamples ? (mainRT.samples || 0) : 0,
      fxaa: !!CFG.fxaa,
      devicePixelRatio: window.devicePixelRatio || 1,
      dprInEffect: dpr,
      buffer: W + "x" + H,
      prePass: Math.round(CFG.prePass * 100) + "%",
      traces: beams.length,
      particles: points ? points.geometry.getAttribute("aPhase").count : 0,
      drawCalls: renderer.info.render.calls,
      fps: Math.round(fps)
    };
    console.log(info);
    return info;
  };

  // ---------------------------------------------------------------- loop
  let simTime = 0, last = performance.now(), fps = 0;

  // ---------------------------------------------------------------- scroll stages
  const stage = { rain: 1, order: 1, chaos: 0, lensScale: 1, lensLift: 0, chip: 1, flame: 1, trace: 1,
                  camLift: 0, fade: 1, pose: 1, fireThrough: 0, appear: 1,
                  entryScale: 1, entryLift: 0 };
  // pose: 0 = circle facing the camera, flames behind; 1 = resting position
  const _qFace = new THREE.Quaternion(), _qSpin = new THREE.Quaternion(), _qPose = new THREE.Quaternion();
  const _dir = new THREE.Vector3(), _right = new THREE.Vector3(), _upC = new THREE.Vector3(), _tmp = new THREE.Vector3();
  const _qFire0 = new THREE.Quaternion(), _qFire = new THREE.Quaternion(), _qI = new THREE.Quaternion();
  function poseLens(pose) {
    // camera direction (target → camera) and its screen axes
    _dir.copy(camera.position).sub(target).normalize();
    _right.crossVectors(camera.up, _dir).normalize();
    _upC.crossVectors(_dir, _right).normalize();
    // the underside (-y) turned to the camera = a perfect circle
    _qFace.setFromUnitVectors(_tmp.set(0, -1, 0), _dir);
    // one full turn about the screen's horizontal axis on the way in (a coin flip)
    _qSpin.setFromAxisAngle(_right, Math.PI * 2 * (1 - pose));
    _qPose.copy(_qFace).slerp(_qI, pose);
    lensGroup.quaternion.copy(_qSpin).multiply(_qPose);
    // the flames: behind the disc, facing the camera, scaled into the circle → resting
    _qFire0.setFromUnitVectors(_tmp.set(0, 0, 1), _dir);
    _qFire.copy(_qFire0).slerp(_qI, pose);
    fireGroup.quaternion.copy(_qFire);
    const k = 1 - pose;
    fireGroup.position.copy(_dir).multiplyScalar(-0.7 * k).addScaledVector(_upC, -0.02 * k);
    fireGroup.scale.setScalar(1 - 0.45 * k);
    aurora.position.set(0, 1.2 - 0.95 * k, -0.10);   // flame cluster centred on the disc
  }
  const stageEl = canvas;
  let lastOpacity = "";
  function ss(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a))); return x * x * (3 - 2 * x); }
  function easeOut(x) { x = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - x, 3); }
  // The sticky box keeps the video's proportion (boxRatio, 16:9 as the video was) and
  // never grows past what is left of the viewport under the header — a sticky box
  // taller than its scrollport does not stick. The timeline is measured in box
  // heights, not in vh, so the phone address bar resizing the viewport cannot jump
  // the sequence.
  function layoutScroll() {
    const navH = navHeight();
    const w = Math.max(1, scrollBox.clientWidth);
    const room = Math.max(180, window.innerHeight - navH - 32);
    boxW = w;
    // narrow screens get their own proportion: at 390 px a 16:9 box is a 200 px
    // stamp, and the page itself switches media to a taller ratio there
    const ratio = Math.max(0.2, w < 700 ? CFG.boxRatioNarrow : CFG.boxRatio);
    boxH = Math.min(Math.round(w / ratio), room);
    sticky.style.top = navH + "px";
    sticky.style.height = boxH + "px";
    // The block is scrubbed over the lead-in (while it is still rising into view) plus
    // the sticky travel, so the container only has to be long enough for what is left
    // of the timeline once the lead is spent. Sized this way the exit finishes exactly
    // as the box unsticks, instead of ending early and leaving a blank box behind.
    const timeline = (CFG.scrollIn + CFG.scrollHold + CFG.scrollOut) * boxH;
    const travel = Math.max(boxH * 0.2, timeline - leadPx());
    scrollBox.style.height = Math.round(boxH + travel) + "px";
  }

  // How much scrolling happens before the box reaches its sticky position and the
  // arrival is allowed to start: the distance it spends rising into view, plus
  // scrollLead. Without it the block is a black rectangle all the way up the screen.
  function leadPx() {
    const approach = Math.max(0, window.innerHeight - boxH - navHeight());
    const timeline = (CFG.scrollIn + CFG.scrollHold + CFG.scrollOut) * boxH;
    // …but never more than scrollLeadCap of the timeline. On a phone the box is a
    // fraction of the viewport, so the approach alone is longer than the whole
    // sequence and the arrival would be over before the box ever reached the top.
    return Math.min(approach + CFG.scrollLead * boxH, timeline * CFG.scrollLeadCap);
  }
  // T: 0 → 1 arrival, 1 → 2 exit (the hold sits at 1)
  function scrollT() {
    if (CFG.scrollPreview) return CFG.scrollScrub;
    const r = scrollBox.getBoundingClientRect();
    // 0 when the box reaches its sticky position. scrollLead starts the arrival a
    // little earlier, while the box is still travelling up the screen, so the block
    // is never a plain black rectangle on its way in.
    const y = Math.max(0, (navHeight() - r.top) + leadPx());
    const a = CFG.scrollIn * boxH, h = CFG.scrollHold * boxH, o = CFG.scrollOut * boxH;
    if (y <= a) return a > 0 ? y / a : 1;
    if (y <= a + h) return 1;
    return 1 + Math.min(1, o > 0 ? (y - a - h) / o : 1);
  }
  function computeStage(T) {
    const tin = Math.min(1, T), tout = Math.max(0, T - 1);
    // arrival: 1. the circle with the flames behind fades in  2. two turns into place
    // 3. the dots  4. the traces
    const appear = ss(0.0, 0.12, tin);
    // the turn always brakes into its final position: ease-out on the way in…
    let pose = easeOut((tin - 0.14) / 0.38);
    let lensScale = 0.6 + 0.4 * appear;
    let flame = appear;
    let rain = ss(0.52, 0.72, tin);
    let order = ss(0.56, 0.82, tin);
    let chip = ss(0.62, 0.82, tin);
    let trace = ss(0.8, 1.0, tin);
    let camLift = 0, fade = 1, lensLift = 0;
    // the same ease-out as the turn, so the size, the height and the spin all brake
    // into their final position together instead of finishing at three different times
    const entry = easeOut(tin / Math.max(0.05, CFG.entryLen));
    const entryScale = 1 + (CFG.entryZoom - 1) * (1 - entry);
    const entryLift = -CFG.entryRise * (1 - entry);
    // exit: the dots go, then the traces, the lens turns back into the circle with the
    // flames behind it, and everything rises out of the frame
    if (tout > 0) {
      rain *= 1 - ss(0.0, 0.3, tout);
      order *= 1 - ss(0.0, 0.3, tout);
      chip *= 1 - ss(0.05, 0.3, tout);
      trace *= 1 - ss(0.2, 0.5, tout);
      // …and on the way back to the circle
      pose *= 1 - easeOut((tout - CFG.exitTurnFrom) / Math.max(0.05, CFG.exitTurnLen));
      // the first moment the disc is a full circle again — and only from there does it
      // begin to leave: the camera looks lower, so the scene rises out of the frame
      const circleAt = Math.min(0.9, CFG.exitTurnFrom + CFG.exitTurnLen);
      camLift = -CFG.exitLift * ss(circleAt, 1.0, tout);
      fade = 1 - ss(circleAt + (1 - circleAt) * CFG.exitFadeFrom, 1.0, tout);
    }
    stage.rain = rain; stage.order = order; stage.chaos = (1 - order) * 1.2;
    stage.lensScale = lensScale; stage.lensLift = lensLift; stage.chip = chip;
    stage.flame = flame; stage.trace = trace; stage.camLift = camLift; stage.fade = fade;
    stage.pose = pose; stage.appear = appear;
    stage.entryScale = entryScale; stage.entryLift = entryLift;
    stage.fireThrough = (1 - pose) * 0.9 * appear;    // the flames show through the circle
  }
  function applyStage() {
    lensGroup.visible = stage.lensScale > 0.05;
    lensGroup.scale.setScalar(stage.lensScale);
    lensGroup.position.y = stage.lensLift;
    poseLens(stage.pose);
    // the arrival, applied to the lens and the flame cluster together so they travel
    // as one object — poseLens has just written fireGroup's scale and position
    if (stage.entryScale !== 1 || stage.entryLift !== 0) {
      lensGroup.scale.multiplyScalar(stage.entryScale);
      lensGroup.position.y += stage.entryLift;
      fireGroup.scale.multiplyScalar(stage.entryScale);
      fireGroup.position.y += stage.entryLift;
    }
    glassUniforms.uFireThrough.value = stage.fireThrough;
    partUniforms.uY0.value = lensBottomY(DISC_R) - 0.012 + stage.lensLift;
    partUniforms.uOpacity.value = CFG.partOpacity * stage.rain;
    partUniforms.uOrder.value = CFG.partOrder * stage.order;
    partUniforms.uSpread.value = CFG.partSpread * (1 + 1.5 * (1 - stage.order));
    auroraUniforms.uInt.value = CFG.auroraInt * stage.flame;
    auroraUniforms.uHA.value = CFG.flameHeightA;
    auroraUniforms.uHB.value = CFG.flameHeightB;
    // the lens itself fades in at the very start through the canvas (it has no alpha)
    // written only when it changes: a per-frame style write forces the compositor to
    // re-layer the canvas every frame (it stalled the loop under SwiftShader)
    const op = (stage.fade * stage.appear).toFixed(3);
    if (op !== lastOpacity) { stageEl.style.opacity = op; lastOpacity = op; }
    traceShared.uGlow.value = CFG.traceGlow * stage.trace;
    headUniforms.uGlow.value = CFG.traceGlow * stage.trace;
  }
  // The standalone study scrolled the window by itself if nobody touched it. Inside
  // the real page that would hijack the reader, so it is gone: the block simply plays
  // as it is scrolled past, which is what a reader of the page expects.
  window.CONTEXT_BEAMS = function () { return beams.map(function (b) { return { x: b.x, y: b.y, wait: b.wait, segment: b.si }; }); };
  window.CONTEXT_SCROLL = function (T) { CFG.scrollPreview = 1; CFG.scrollScrub = T; };
  layoutScroll();

  const _ctr = new THREE.Vector3();
  function render() {
    // 1. refraction pre-pass: everything except the lens itself
    glass.visible = false; holder.visible = false;
    ringTop.visible = false; ringBottom.visible = false;
    // 0. the flames alone, for the frame to refract (the lens face never sees them)
    if (CFG.frameFire > 0 || stage.fireThrough > 0) {
      aurora.visible = true;
      camera.layers.set(1);
      renderer.setRenderTarget(fireRT);
      renderer.clear();
      renderer.render(scene, camera);
      camera.layers.set(0);
    }
    aurora.visible = false;                    // never refract the glow: the lens body stays dark
    // Igor: the glass shows the chips and their light, never the dots or the traces
    const showScene = CFG.refractScene > 0;
    if (points) points.visible = showScene;
    traceGroup.visible = showScene;
    if (heads) heads.visible = showScene;
    renderer.setRenderTarget(preRT);
    renderer.clear();
    renderer.render(scene, camera);
    if (points) points.visible = true;
    traceGroup.visible = true;
    if (heads) heads.visible = true;

    // 2. main pass: the lens reads the pre-pass through its own shader
    glass.visible = true; holder.visible = true;
    ringTop.visible = true; ringBottom.visible = true;
    aurora.visible = true;
    glassUniforms.tScene.value = preRT.texture;
    holderUniforms.tScene.value = preRT.texture;
    holderUniforms.tFire.value = fireRT.texture;
    glassUniforms.tFire.value = fireRT.texture;
    holderUniforms.uRes.value.copy(glassUniforms.uRes.value);
    _ctr.set(0, 0, 0).project(camera);          // per-piece lens centre, in screen uv
    holderUniforms.uCenter.value.set(_ctr.x * 0.5 + 0.5, _ctr.y * 0.5 + 0.5);
    _ctr.set(0, CFG.discH * CFG.holderH * 0.5, -0.3).project(camera);   // top rim, a little past centre
    holderUniforms.uRimUv.value = _ctr.y * 0.5 + 0.5;
    renderer.setRenderTarget(mainRT);
    renderer.clear();
    renderer.render(scene, camera);

    // 3. bloom: bright pass → blur at half res → blur again at quarter res
    if (CFG.bloom) {
      brightMat.uniforms.tDiffuse.value = mainRT.texture;
      blit(brightMat, brightRT);

      const r = CFG.bloomRadius;
      blurMat.uniforms.tDiffuse.value = brightRT.texture;
      blurMat.uniforms.uDir.value.set(r / brightRT.width, 0);
      blit(blurMat, blurRT);
      blurMat.uniforms.tDiffuse.value = blurRT.texture;
      blurMat.uniforms.uDir.value.set(0, r / brightRT.height);
      blit(blurMat, brightRT);

      copyMat.uniforms.tDiffuse.value = brightRT.texture;
      blit(copyMat, downRT);
      blurMat.uniforms.tDiffuse.value = downRT.texture;
      blurMat.uniforms.uDir.value.set((r * 2) / downRT.width, 0);
      blit(blurMat, downRT2);
      blurMat.uniforms.tDiffuse.value = downRT2.texture;
      blurMat.uniforms.uDir.value.set(0, (r * 2) / downRT.height);
      blit(blurMat, downRT);
    }

    // 4. composite (+ FXAA when it is on)
    compositeMat.uniforms.tBase.value = mainRT.texture;
    compositeMat.uniforms.tBloom.value = brightRT.texture;
    compositeMat.uniforms.tBloom2.value = downRT.texture;
    if (CFG.fxaa) {
      blit(compositeMat, outRT);
      fxaaMat.uniforms.tDiffuse.value = outRT.texture;
      blit(fxaaMat, null);
    } else {
      blit(compositeMat, null);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    fps = fps ? fps * 0.9 + (1 / Math.max(dt, 0.0001)) * 0.1 : 1 / Math.max(dt, 0.0001);

    simTime += dt * CFG.timeScale;
    partUniforms.uTime.value = simTime;
    auroraUniforms.uTime.value = simTime;

    updateImpacts(dt);
    updateBeams(dt * CFG.timeScale);
    const prevX = tilt.x, prevY = tilt.y;
    tilt.x += (tiltTarget.x - tilt.x) * Math.min(1, dt * 3.5);
    tilt.y += (tiltTarget.y - tilt.y) * Math.min(1, dt * 3.5);
    // hover / tilt reaction: the pointer (or the tilt) in NDC, presence fading in and
    // out, and a shake amount from how fast the tilt is changing (phones)
    hoverUniforms.uHover.value.set(tilt.x / 0.6, tilt.y / 0.6);
    hoverPresence += ((CFG.hoverOn && hoverSeen) ? 1 : 0) - hoverPresence > 0 ? Math.min(1, dt * 4) : -Math.min(1, dt * 2.5);
    hoverPresence = THREE.MathUtils.clamp(hoverPresence, 0, 1);
    hoverUniforms.uHoverOn.value = hoverPresence;
    const shake = Math.hypot(tilt.x - prevX, tilt.y - prevY) / Math.max(dt, 1e-3);
    shakeLevel = Math.max(shakeLevel * Math.exp(-dt * 2.2), Math.min(1, shake * 0.6));
    hoverUniforms.uChaosGlobal.value = (CFG.hoverOn ? shakeLevel * CFG.tiltChaos * (gyroActive ? 1 : 0) : 0) + stage.chaos;
    computeStage(scrollT());
    applyStage();
    updateCamera();
    aurora.rotation.set(0, camAzRad, 0);   // vertical, behind the lens, facing the camera

    render();

  }

  // ---------------------------------------------------------------- start
  window.addEventListener("resize", resize);
  buildParticles();   // first: the impacts seat themselves on its columns
  buildImpacts();
  buildTraces();
  partUniforms.uY0.value = lensBottomY(DISC_R) - 0.012;
  resize();
  applyAll();
  requestAnimationFrame(frame);
  // ---------------------------------------------------------------- exported surface
  // context-tuner.js drives the effect entirely through this: the live settings, the
  // values they started from, and the two calls that push a change into the scene.
  window.CONTEXT = {
    cfg: CFG,
    defaults: DEFAULTS,
    apply: applyAll,
    rebuild: rebuild,
    t: scrollT,                 // where the block currently is on its timeline, 0..2
    info: window.CONTEXT_INFO,
    readout: function () {
      return "in effect\n" +
        "WebGL" + (isWebGL2 ? "2" : "1") +
        "   MSAA " + (supportsSamples ? (mainRT.samples || 0) : "n/a") +
        "   FXAA " + (CFG.fxaa ? "on" : "off") + "\n" +
        "dpr " + dpr.toFixed(2) + " of " + (window.devicePixelRatio || 1).toFixed(2) +
        "   buffer " + W + "x" + H + "\n" +
        "pre-pass " + Math.round(CFG.prePass * 100) + "%" +
        "   draws " + renderer.info.render.calls +
        "   " + Math.round(fps) + " fps";
    }
  };

})();
