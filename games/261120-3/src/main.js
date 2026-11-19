// Boot: renderer, scene, camera, shared context G, main loop. Nothing game-specific lives here.
import * as THREE from 'three';
import * as cfg from './config.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world/index.js';
import { createTako } from './tako/index.js';
import phases from './phases/index.js';
import { createInput } from './core/input.js';
import { createCameraRig } from './core/camera.js';
import { createTools } from './core/tools.js';
import { createHints } from './core/hints.js';
import { createFx } from './core/fx.js';
import { createSave, freshState } from './core/save.js';
import { createFlow } from './core/flow.js';
import { budgetScale, createShadowGate, warmUpGen } from './core/perf.js';
import { createBackground } from './core/background.js';

const canvas = document.getElementById('stage');
let stopped = false;

function noGL() {
  stopped = true;
  try {
    document.body.classList.add('nogl');
  } catch (e) {
    /* ignore */
  }
}

// ---------- page hardening: no scroll / zoom / long-press / selection ----------
function harden() {
  const pd = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  const opt = { passive: false };
  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) pd(e);
    else if (e.target === canvas) pd(e);
  }, opt);
  document.addEventListener('touchmove', pd, opt);
  document.addEventListener('gesturestart', pd, opt);
  document.addEventListener('gesturechange', pd, opt);
  document.addEventListener('gestureend', pd, opt);
  document.addEventListener('dblclick', pd, opt);
  document.addEventListener('contextmenu', pd, opt);
  document.addEventListener('selectstart', pd, opt);
  document.addEventListener('dragstart', pd, opt);
  document.addEventListener('wheel', (e) => {
    if (e.ctrlKey) pd(e);
  }, opt);
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const t = performance.now();
    if (t - lastEnd < 320 && e.target !== canvas) pd(e); // double-tap zoom outside the canvas
    lastEnd = t;
  }, opt);
}

// ---------- safe-area insets via a hidden probe ----------
let probe = null;
function safeArea() {
  try {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
        'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
        'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px)';
      document.body.appendChild(probe);
    }
    const cs = getComputedStyle(probe);
    const v = (k) => parseFloat(cs[k]) || 0;
    return { top: v('paddingTop'), right: v('paddingRight'), bottom: v('paddingBottom'), left: v('paddingLeft') };
  } catch (e) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

// audio proxy: missing methods become no-ops, errors are swallowed
function safeAudio() {
  let a = null;
  try {
    a = createAudio();
  } catch (e) {
    console.warn('[main] audio unavailable:', e);
  }
  const noop = () => undefined;
  const cache = {};
  return new Proxy(
    {},
    {
      get(_, k) {
        if (cache[k]) return cache[k];
        const f = a && a[k];
        if (typeof f !== 'function') return a && k in a ? a[k] : noop;
        cache[k] = (...args) => {
          try {
            return f.apply(a, args);
          } catch (e) {
            return undefined;
          }
        };
        return cache[k];
      },
    }
  );
}

function boot() {
  harden();

  // ---------- renderer (context created by hand so failure never reaches three's console.error) ----------
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
  } catch (e) {
    gl = null;
  }
  if (!gl) return noGL();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return noGL();
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 5, 600);

  // ---------- quality ----------
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bigScreen = Math.max(screen.width || 0, screen.height || 0) * dpr >= 2000;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 && bigScreen;
  // start within the pixel budget (core/perf.js); dynamic resolution may climb up to dpr if frames allow
  const start0 = budgetScale(window.innerWidth || 1, window.innerHeight || 1, dpr);
  const quality = { low: false, dpr, particleScale: 1, scale: weak ? Math.max(0.6, Math.min(start0, dpr * 0.75)) : start0 };

  const layoutListeners = [];
  const G = {
    renderer,
    scene,
    camera,
    canvas,
    cfg,
    layout: cfg.layout((window.innerWidth || 1) / (window.innerHeight || 1)),
    quality,
    time: 0,
    dt: 0,
    audio: null,
    world: null,
    balls: [],
    bits: null,
    tako: null,
    fx: null,
    cam: null,
    tools: null,
    hints: null,
    input: null,
    save: null,
    flow: null,
    bg: createBackground(), // work deferred until the first frames are on screen (core/background.js)
    state: freshState(),
    onLayout(fn) {
      if (typeof fn === 'function') layoutListeners.push(fn);
    },
  };

  G.save = createSave();
  G.cam = createCameraRig(G);
  G.fx = createFx(G);
  G.tools = createTools(G);
  G.hints = createHints(G);
  G.input = createInput(G);
  G.audio = safeAudio();

  G.world = buildWorld(G);
  const tako = createTako(G);
  G.tako = tako;
  G.balls = tako.balls;
  G.bits = tako.bits;
  G.flow = createFlow(G, phases);

  // ---------- low-quality mode (one-way latch) ----------
  function goLow() {
    if (quality.low) return;
    quality.low = true;
    quality.particleScale = 0.5;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.autoUpdate = true;
    scene.traverse((o) => {
      if (o.isLight) o.castShadow = false;
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) m.needsUpdate = true;
    });
  }
  if (weak) quality.particleScale = 0.7;

  // ---------- resize ----------
  let cssW = 0;
  let cssH = 0;
  function applySize(force) {
    const w = Math.max(1, window.innerWidth || canvas.clientWidth || 1);
    const h = Math.max(1, window.innerHeight || canvas.clientHeight || 1);
    const changed = w !== cssW || h !== cssH;
    if (changed) {
      // a bigger canvas (e.g. leaving iPad split view) must not blow past the pixel budget
      const b = budgetScale(w, h, dpr);
      if (quality.scale > b && cssW * cssH < w * h) quality.scale = Math.max(0.6, b);
    }
    if (Math.abs(renderer.getPixelRatio() - quality.scale) > 1e-3) renderer.setPixelRatio(quality.scale);
    if (!changed && !force) return;
    const portraitBefore = G.layout && G.layout.portrait;
    cssW = w;
    cssH = h;
    renderer.setSize(w, h, false);
    G.layout = cfg.layout(w / h);
    for (const fn of layoutListeners) {
      try {
        fn(G.layout, portraitBefore !== G.layout.portrait);
      } catch (e) {
        console.warn('[main] onLayout listener failed:', e);
      }
    }
    G.cam.resize(w, h, safeArea());
  }
  let rT = 0;
  const onResize = () => {
    clearTimeout(rT);
    rT = setTimeout(() => applySize(false), 120);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => {
    onResize();
    setTimeout(() => applySize(false), 450);
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  applySize(true);

  // ---------- start: saved checkpoint or ?phase= ----------
  let startIndex = 0;
  try {
    const q = new URLSearchParams(location.search).get('phase');
    let fromUrl = -1;
    if (q != null && q !== '') {
      fromUrl = /^\d+$/.test(q) ? parseInt(q, 10) : cfg.PHASES.indexOf(q);
      if (!(fromUrl >= 0 && fromUrl < phases.length)) fromUrl = -1;
    }
    if (fromUrl >= 0) {
      startIndex = fromUrl;
    } else {
      const s = G.save.load();
      if (s) {
        Object.assign(G.state, s);
        startIndex = s.phase;
      }
    }
  } catch (e) {
    startIndex = 0;
  }
  G.flow.start(startIndex);
  if (!G.cam.box && G.layout.frames) G.cam.frame(G.layout.frames.cook, { dur: 0 });

  // ---------- shadow-map gating + background warm-up ----------
  // The first frame compiles only what it shows; full-resolution textures and the remaining shaders
  // are prepared while the player is already looking at (and playing) the first scene.
  const shadowGate = createShadowGate(renderer, scene);
  let warm = null;
  try {
    warm = warmUpGen(renderer, scene, camera, shadowGate);
  } catch (e) {
    warm = null;
  }
  scene.matrixWorldAutoUpdate = false; // shadowGate.update() runs the single world-matrix pass per frame

  // ---------- main loop ----------
  const warned = new Set();
  const step = (tag, fn) => {
    try {
      fn();
    } catch (e) {
      if (!warned.has(tag)) {
        warned.add(tag);
        console.warn('[main] ' + tag + ' failed:', e);
      }
    }
  };

  let raf = 0;
  let last = -1;
  let smoothMs = 16.7;
  let slowT = 0;
  let fastT = 0;
  let vsyncMs = 16.7; // estimated refresh interval (60 Hz, 120 Hz ProMotion, 30 Hz Low Power Mode, ...)
  let failScale = Infinity; // a scale that recently proved too slow: don't climb back to it too soon
  let failT = 0;
  let trial = null; // a pending downscale whose benefit is being checked
  let graceT = 1.2; // ignore start-up / resume hitches
  let frames = 0;
  const MIN_SCALE = 0.6;

  // Dynamic resolution: aim for (near) the display refresh, not just "above 28 fps".
  // A downscale that does not speed frames up means the display / OS caps the rate
  // (e.g. Low Power Mode at 30 Hz): it is undone and that rate is taken as the refresh.
  function setScale(ns) {
    quality.scale = ns;
    renderer.setPixelRatio(ns);
  }
  function adapt(realMs, dt) {
    if (graceT > 0) {
      graceT -= dt;
      return;
    }
    const ms = Math.min(realMs, 120);
    smoothMs += (ms - smoothMs) * 0.06;
    vsyncMs = Math.min(vsyncMs + dt * 0.1, Math.max(6.5, smoothMs));
    failT += dt;
    if (trial) {
      trial.t += dt;
      if (trial.t < 1.5) return;
      if (smoothMs > trial.ms * 0.92) {
        setScale(trial.from); // no gain: not GPU-bound
        vsyncMs = Math.max(vsyncMs, smoothMs);
        failScale = Infinity;
      }
      trial = null;
      slowT = fastT = 0;
      return;
    }
    const slowMs = Math.max(vsyncMs * 1.4, 21.5);
    const fastMs = Math.max(vsyncMs * 1.12, 17.8);
    if (smoothMs > slowMs) {
      slowT += dt;
      fastT = 0;
    } else if (smoothMs < fastMs) {
      fastT += dt;
      slowT = 0;
    } else {
      slowT = 0;
      fastT = 0;
    }
    if (slowT > 1.0) {
      slowT = 0;
      const ns = Math.max(MIN_SCALE, quality.scale * 0.85);
      if (ns < quality.scale - 1e-3) {
        trial = { from: quality.scale, ms: smoothMs, t: 0 };
        failScale = quality.scale;
        failT = 0;
        setScale(ns);
      } else if (smoothMs > 30 && vsyncMs < 25) goLow(); // still < ~33 fps at the minimum scale
    }
    if (fastT > 3) {
      fastT = 0;
      const ns = Math.min(dpr, quality.scale / 0.85);
      const blocked = ns >= failScale - 1e-3 && failT < 45;
      if (ns > quality.scale + 1e-3 && !blocked) setScale(ns);
    }
  }

  // Background work once the first frames are shown: one shader warm-up batch (not while a finger is
  // dragging something: a compile hitch would be felt), then texture jobs for the rest of a small budget.
  function background() {
    if (++frames < 3) return;
    let spent = 0;
    const held = !!(G.input && G.input.pointer);
    if (warm && !held) {
      try {
        const r = warm.next();
        if (r.done) warm = null;
        spent += r.value || 0;
      } catch (e) {
        warm = null;
        console.warn('[main] warm-up failed:', e);
      }
    }
    if (G.bg.pending) {
      const budget = Math.max(1.5, Math.min(5, vsyncMs * 0.25)) * (held ? 0.5 : 1);
      if (spent < budget) spent += G.bg.run(budget - spent);
    }
    if (spent > 8) graceT = Math.max(graceT, 0.25); // our own work must not read as "GPU too slow"
  }

  function frame(now) {
    raf = 0;
    if (stopped || document.hidden) return;
    raf = requestAnimationFrame(frame);
    const realMs = last < 0 ? 16.7 : now - last;
    last = now;
    const dt = Math.min(Math.max(realMs / 1000, 0), 1 / 20);
    G.dt = dt;
    G.time += dt;
    adapt(realMs, dt);

    step('input', () => G.input.update(dt));
    step('flow', () => G.flow.update(dt));
    step('tools', () => G.tools.update(dt));
    step('hints', () => G.hints.update(dt));
    step('tako', () => {
      if (tako.update) tako.update(dt);
      else if (G.bits && G.bits.update) G.bits.update(dt);
    });
    step('world', () => G.world && G.world.update && G.world.update(dt));
    step('fx', () => G.fx.update(dt));
    step('cam', () => G.cam.update(dt));
    step('shadow', () => shadowGate.update());
    step('background', () => background());
    step('render', () => renderer.render(scene, camera));
  }

  function resume() {
    if (stopped || raf || document.hidden) return;
    last = -1; // no dt spike
    graceT = Math.max(graceT, 0.6);
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
      G.audio.suspend();
      G.save.flush();
    } else {
      G.audio.resume();
      applySize(false);
      resume();
    }
  });
  window.addEventListener('pagehide', () => G.save.flush());
  window.addEventListener('pageshow', () => {
    if (!document.hidden) resume();
  });

  // ---------- context loss ----------
  let lostTimer = 0;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    pause();
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => {
      noGL();
      pause();
    }, 3000);
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(lostTimer);
    if (stopped) return;
    applySize(true);
    shadowGate.invalidate();
    resume();
  }, false);

  resume();
}

try {
  boot();
} catch (e) {
  console.error('[main] boot failed:', e);
  noGL();
}
