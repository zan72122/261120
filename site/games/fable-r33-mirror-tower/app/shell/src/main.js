// 鏡の塔：シェル（土台）。場面・入力・音・カメラ・性能・デバッグ・コンテキスト喪失を受け持ち、hero を呼ぶ。
import THREE from './three.js';
import { detectTier, pixelRatioFor, createTierGovernor, TIERS } from './tier.js';
import { createTextureStore, makeBlobTexture, makeRingTexture, makeHandTexture, makeEnvTexture } from './textures.js';
import { createWorld, TOWER } from './world.js';
import { createCameraRig, VIEWS } from './camera.js';
import { createInput, HINT_DELAY } from './input.js';
import { createAudio } from './audio.js';
import { createHintMarker } from './hint.js';
import { createErrorLog, createFrameTimer, createCpuTimer, createDebugOverlay } from './debug.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const errorLog = createErrorLog();
const warnOnce = new Set();
function warn(msg) { if (warnOnce.has(msg)) return; warnOnce.add(msg); errorLog.push('warn: ' + msg); console.warn('[shell]', msg); }

const canvas = document.getElementById('c');
const veil = document.getElementById('veil');
const againBtn = document.getElementById('again');
const det = detectTier(params);

const state = {
  tier: det.tier, isMobile: det.isMobile, dpr: 1, tti: 0, firstFrame: 0,
  stage: 0, count: 0, complete: false, completeAt: 0, finaleSeconds: 6, finaleView: 'all', againAt: 0, busy: false,
  ctx: 'ok', time: 0, events: [], sounds: {},
};

// ---- レンダラ（MSAA なし、影なし） ----
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const rig = createCameraRig(window.innerWidth / Math.max(1, window.innerHeight));
const camera = rig.camera;

const textures = createTextureStore(renderer, state.tier, (e) => errorLog.push(e.message || String(e)));
const shared = { blobShadow: makeBlobTexture() };
const ringTex = makeRingTexture();
const handTex = makeHandTexture();
const envTex = makeEnvTexture();
scene.environment = envTex;
scene.environmentIntensity = 0.9;

const world = createWorld({ scene, textures, tier: state.tier, shared });
const hintMarker = createHintMarker({ scene, ringTexture: ringTex, handTexture: handTex });
const audio = createAudio({ onWarn: warn });

// ---- 解像度 ----
function resize() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  state.dpr = pixelRatioFor(state.tier, state.isMobile, w, h);
  renderer.setPixelRatio(state.dpr);
  renderer.setSize(w, h, false);
  rig.setAspect(w / h);
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

const governor = createTierGovernor(state.tier, (t, fps) => {
  state.tier = t;
  errorLog.push(`info: tier を ${t} に下げた（平均 ${fps.toFixed(0)}fps）`);
  resize();
  world.setTier(t);
}, { enabled: !det.forced && params.get('autotier') !== '0' });

// ---- hero ----
let hero = null;
function onHeroEvent(e) {
  if (!e || typeof e.type !== 'string') return;
  if (e.type !== 'sound') state.events.push({ t: +state.time.toFixed(2), type: e.type, index: e.index, name: e.name, id: e.id });
  if (state.events.length > 200) state.events.shift();
  switch (e.type) {
    case 'sound': {
      state.sounds[e.name] = (state.sounds[e.name] || 0) + 1;
      let pan = 0;
      if (e.position && e.position.isVector3) pan = THREE.MathUtils.clamp(e.position.clone().project(camera).x * 0.6, -0.8, 0.8);
      audio.play(e.name, { gain: e.gain, pitch: e.pitch, pan });
      break;
    }
    case 'stage': state.stage = e.index | 0; break;
    case 'awaken': break;
    case 'view': rig.request(e.name); break;
    case 'busy': state.busy = !!e.value; break;
    case 'complete':
      state.complete = true; state.completeAt = state.time;
      state.finaleSeconds = Number.isFinite(e.finaleSeconds) ? e.finaleSeconds : 6;
      // 見せ場は hero の望む view（例 'high'）で寄って見せ、「もういちど」が出る頃に全景へ戻る
      state.finaleView = e.view && VIEWS[e.view] ? e.view : 'all';
      state.againAt = 0;
      rig.request(state.finaleView);
      break;
    default: warn('知らない hero イベント: ' + e.type);
  }
}

function createHeroSafe() {
  const mod = window.MirrorTowerHero;
  if (!mod || typeof mod.createHero !== 'function') { errorLog.push('hero/hero.bundle.js が読み込まれていない（npm run pack:hero）'); return null; }
  try {
    const h = mod.createHero(THREE, {
      tier: state.tier, isMobile: state.isMobile, debug: DEBUG,
      onEvent: onHeroEvent,
      loadTexture: (name) => textures.loadHeroTexture(name),
      shared,
      world: {
        towerInnerRadius: TOWER.inner, towerHeight: TOWER.height, floorY: 0,
        volume: { min: [-3.6, 0, -3.6], max: [3.6, 7.0, 2.0] },
      },
    });
    for (const k of ['root', 'update', 'getHandles', 'getHint', 'getState', 'reset', 'debugAdvance', 'onContextRestored', 'dispose']) {
      if (!(k in h)) errorLog.push('hero API が足りない: ' + k);
    }
    scene.add(h.root);
    state.count = h.stageCount | 0;
    return h;
  } catch (e) {
    errorLog.push('createHero 失敗: ' + (e && e.stack || e));
    return null;
  }
}
hero = createHeroSafe();

// ---- 入力 ----
const input = createInput({
  canvas, camera,
  getHandles: () => (hero ? safe(() => hero.getHandles(), []) : []),
  onEmptyTap: () => audio.play('pop', { gain: 0.6 }),
  onAnyDown: () => audio.unlock(),
  onAnyUp: () => audio.unlock(), // iOS Safari は指を離した時（touchend）を音の解錠に数えることがある
});

function safe(fn, fallback) {
  try { return fn(); } catch (e) { const m = 'hero エラー: ' + (e && e.message || e); if (!warnOnce.has(m)) { warnOnce.add(m); errorLog.push(m); console.error(e); } return fallback; }
}

// ---- 「もういちど」ボタン ----
function resetGame() {
  if (hero) safe(() => hero.reset());
  state.stage = 0; state.complete = false; state.busy = false; state.finaleView = 'all'; state.againAt = 0;
  rig.request('all');
  input.setIdle(HINT_DELAY);
  againBtn.hidden = true;
}
againBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  audio.unlock();
  audio.play('pop');
  resetGame();
});

// ---- iPad のジェスチャ（拡大・スクロール）を止める ----
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else audio.resume(); });

// ---- コンテキスト喪失：止めて、戻ったら GPU 資源を作り直す（状態は JS 側にあるので保たれる） ----
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  state.ctx = 'lost';
  veil.classList.remove('hide');
  input.cancel();
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  // three は自分のリスナで状態を作り直し、geometry/texture は次の描画で再転送する。環境マップの PMREM も自動で作り直される。
  for (const t of [...textures.all(), shared.blobShadow, ringTex, handTex, envTex]) if (t.image) t.needsUpdate = true;
  if (hero) safe(() => hero.onContextRestored());
  state.ctx = 'ok';
  resize();
  veil.classList.add('hide');
}, false);

// ---- デバッグ ----
const frames = createFrameTimer();
const cpu = createCpuTimer();
const overlay = createDebugOverlay({
  enabled: DEBUG, renderer, scene, camera, envTexture: envTex, sharedTextures: [shared.blobShadow], frames, cpu, errors: errorLog.errors,
  getHeroRoot: () => hero && hero.root,
  getInfo: () => ({ ...state, view: rig.view, idle: input.input.idle, audio: audio.state }),
});

// ---- ループ ----
const VEIL_MAX_MS = 1500;
let last = performance.now(), frameNo = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const rawMs = now - last;
  last = now;
  if (state.ctx !== 'ok') return;
  const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
  state.time += dt;
  if (frameNo > 0) frames.add(rawMs);

  const tf0 = performance.now();
  const inp = input.frame(dt);
  if (hero) safe(() => hero.update(dt, inp));
  const tf1 = performance.now();
  input.endFrame();
  if (hero) {
    const st = safe(() => hero.getState(), null);
    if (st) { state.busy = !!st.busy; if (st.complete && !state.complete) onHeroEvent({ type: 'complete' }); }
  }

  rig.update(dt);
  world.update(state.time);
  camera.updateMatrixWorld();
  const hint = hero && !state.busy && !state.complete ? safe(() => hero.getHint(), null) : null;
  const appeared = hintMarker.update(dt, camera, inp.hintLevel >= 1 && !input.grabbing, hint, inp.hintLevel);
  if (appeared && frameNo > 30) audio.play('hint');

  // 寄った見せ場：寄り終えてから 3.5 秒は見せ、全景へ戻り終えた頃に「もういちど」
  const backAt = Math.max(6, state.finaleSeconds - 2.5);
  if (state.complete && state.finaleView !== 'all' && state.time - state.completeAt > backAt) {
    state.finaleView = 'all';
    state.againAt = backAt + 2.5;
    rig.request('all');
  }
  if (state.complete && againBtn.hidden && state.time - state.completeAt > Math.max(state.finaleSeconds, state.againAt)) againBtn.hidden = false;

  const tr0 = performance.now();
  renderer.render(scene, camera);
  const tr1 = performance.now();
  cpu.add('hero', tf1 - tf0); cpu.add('render', tr1 - tr0); cpu.add('frame', tr1 - tf0); cpu.tick();
  governor.frame(dt);
  overlay.update(dt);

  frameNo++;
  if (frameNo === 1) state.firstFrame = performance.now();
  if (frameNo === 3) world.deferred(); // 木などは最初の画面が出てから作る
  // 幕（お日さま）を上げる＝触れる状態：最初の描画の後、テクスチャが届いたら（遅い回線でも最初の描画から 1.5 秒まで）。
  // 届く前は真鍮や空が黒く見えるため。届いた画像は次の描画で転送され、幕は 0.6 秒かけて消えるので黒は見えない。
  // 指はその前から受け付けている。
  if (!state.tti && (textures.pendingCount === 0 || performance.now() - state.firstFrame > VEIL_MAX_MS)) {
    state.tti = performance.now();
    veil.classList.add('hide');
    document.documentElement.dataset.ready = '1';
  }
}
requestAnimationFrame(loop);

// ---- 煙テストと調査用の窓口 ----
window.__mt = {
  THREE, renderer, scene, camera, rig, state, textures,
  get hero() { return hero; },
  errors: errorLog.errors,
  stats: () => overlay.snapshot(),
  tiers: TIERS,
  loseContext: () => renderer.forceContextLoss(),
  restoreContext: () => renderer.forceContextRestore(),
  // 操作部の画面上の位置（CSS px）
  handleScreen(id) {
    const h = hero && hero.getHandles().find((x) => x.id === id);
    if (!h) return null;
    const b = new THREE.Box3().setFromObject(h.object, true), c = new THREE.Vector3();
    if (b.isEmpty()) h.object.getWorldPosition(c); else b.getCenter(c);
    c.project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height };
  },
  resetGame,
};
