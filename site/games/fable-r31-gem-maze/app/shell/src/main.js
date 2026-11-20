// シェル：起動・描画ループ・カメラ・段階の進行・入力→hero・音・ヒント・デバッグ・コンテキスト喪失。
import { THREE } from './three.js';
import { detectTier, pixelRatioFor, AutoTier } from './tiers.js';
import { loadSharedTextures } from './textures.js';
import { buildEnvironment, makeEnvMap } from './scene.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { HintFinger, ripple } from './hint.js';
import { ErrorLog, FrameStats, DebugOverlay, countResources, framebufferBytes, fmtMiB } from './debug.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const AUTO_TIER = params.get('autotier') !== '0';    // ?autotier=0：自動降格を止める（計測用）
const errors = new ErrorLog();
const game = (window.__game = { ready: false, stage: 'boot', round: 1, errors: errors.list, contextLost: 0, contextRestored: 0 });

const VFOV = 38;                                  // 縦の画角（度）
const ELEV = THREE.MathUtils.degToRad(12);        // 見下ろし角
const MARGIN = 1.05;                              // 外接球の余白
const CAM_MOVE = 2.2;                             // 定位置間の移動秒
const RESET_DELAY = 1.5;                          // complete → 次の回
const HINT_FIRST = 1.0, HINT_AFTER = 3.0;         // 指の絵を出すまでの待ち（最初の1回だけ短い。hero の光は 2 秒）

boot().catch((e) => { errors.add('boot', (e && e.stack) || e); showFatal(); });

async function boot() {
  const marks = (game.bootMarks = {});
  const mark = (k) => { marks[k] = Math.round(performance.now()); };
  mark('script');
  const app = document.getElementById('app');
  const tier = detectTier(params);
  const reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const canvas = document.createElement('canvas');
  canvas.id = 'view';
  app.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.antialias, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) { showFatal(); throw e; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false;
  const gl = renderer.getContext();
  const samples = gl.getParameter(gl.SAMPLES) || 0;
  const anisotropy = Math.max(1, Math.min(tier.anisotropy, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(VFOV, 1, 0.1, 200);

  // ---- 共有テクスチャ（ローカルなので数百 ms）。最初の場面だけ作る。
  const textures = await loadSharedTextures(anisotropy, (e) => errors.add('texture', e.message || e));
  mark('textures');
  let envRT = makeEnvMap(renderer);
  scene.environment = envRT.texture;
  const env = buildEnvironment(renderer, scene, textures);
  mark('env');

  // ---- 音・入力・ヒント
  const sound = new Sound();
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => sound.unlock(), { passive: true });
  const input = new Input(canvas, {
    onPress: (x, y, hit) => { ripple(app, x, y, hit); },
    onEmptyTap: () => sound.play('pop', { gain: 0.5 }),
  });
  const finger = new HintFinger(app);

  // ---- hero
  const createHero = await getHeroFactory();
  let hero = null;
  const pendingEvents = [];
  const emit = (type, payload) => { if (hero) onHeroEvent(type, payload || {}); else pendingEvents.push([type, payload || {}]); };
  const heroOpts = {
    quality: tier.heroQuality, round: 1, maxAnisotropy: anisotropy, reducedMotion, emit,
    getTexture: (name) => { const t = textures[name]; if (!t) throw new Error('unknown texture ' + name); return t; },
  };
  const tHero = performance.now();
  hero = createHero(THREE, heroOpts);
  game.heroCreateMs = performance.now() - tHero;
  mark('hero');
  scene.add(hero.root);
  const bounds = { center: new THREE.Vector3(0, 1.6, 0), radius: 1.9 };
  if (hero.bounds && hero.bounds.center && Number.isFinite(hero.bounds.radius)) { bounds.center.copy(hero.bounds.center); bounds.radius = Math.min(1.9, Math.max(0.5, hero.bounds.radius)); }
  input.getTargets = () => hero.getHitTargets();

  // ---- カメラの定位置（main / finale）
  const views = { main: { pos: new THREE.Vector3(), target: new THREE.Vector3(), dist: 1 }, finale: { pos: new THREE.Vector3(), target: new THREE.Vector3(), dist: 1 } };
  const focus = bounds.center.clone();
  const cam = { from: { pos: new THREE.Vector3(), target: new THREE.Vector3() }, to: 'main', t: CAM_MOVE, target: new THREE.Vector3() };
  const viewport = { width: 1, height: 1, pxPerUnit: 1 };
  function computeViews() {
    frameFor(bounds.center, bounds.radius * MARGIN, camera.aspect, views.main);
    frameFor(focus, bounds.radius * MARGIN * 0.72, camera.aspect, views.finale);
  }
  function goView(name) {
    if (cam.to === name) return;
    cam.from.pos.copy(camera.position); cam.from.target.copy(cam.target);
    cam.to = name; cam.t = 0;
  }
  function updateCamera(dt) {
    const v = views[cam.to];
    cam.t = Math.min(CAM_MOVE, cam.t + dt);
    const k = smooth(cam.t / CAM_MOVE);
    camera.position.lerpVectors(cam.from.pos, v.pos, k);
    cam.target.lerpVectors(cam.from.target, v.target, k);
    camera.lookAt(cam.target);
    viewport.pxPerUnit = viewport.height / (2 * Math.max(0.1, camera.position.distanceTo(bounds.center)) * Math.tan(THREE.MathUtils.degToRad(VFOV / 2)));
  }

  function resize() {
    const w = Math.max(1, app.clientWidth), h = Math.max(1, app.clientHeight);
    renderer.setPixelRatio(pixelRatioFor(tier, w, h));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    viewport.width = w; viewport.height = h;
    computeViews();
    if (cam.t >= CAM_MOVE) { cam.from.pos.copy(views[cam.to].pos); cam.from.target.copy(views[cam.to].target); }
  }
  resize();
  cam.from.pos.copy(views.main.pos); cam.from.target.copy(views.main.target);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ---- 段階の進行
  let resetTimer = -1, burstTimer = -1;
  function onHeroEvent(type, p) {
    if (type === 'sound') {
      sound.play(p.name, p);
      if (p.name === 'chest' && game.stage === 'finale' && burstTimer > 0.15) burstTimer = 0.15; // ふたが開いた直後にきらきら
      return;
    }
    if (type === 'progress') { game.progress = { collected: p.collected, total: p.total }; return; }
    if (type !== 'stage') return;
    game.stage = p.stage;
    if (p.stage === 'play') {
      goView('main'); env.setRainbow(0); input.resetIdle(); resetTimer = -1;
    } else if (p.stage === 'finale') {
      if (p.focus && p.focus.isVector3) focus.copy(p.focus); else focus.copy(bounds.center);
      computeViews(); goView('finale'); env.setRainbow(1); burstTimer = 6; // 予備。ふつうは hero の 'chest'（ふたが開く音）で出す
    } else if (p.stage === 'complete') {
      burstTimer = -1;
      game.completed = (game.completed || 0) + 1;
      resetTimer = RESET_DELAY;
    }
  }
  for (const [t, p] of pendingEvents.splice(0)) onHeroEvent(t, p);

  // ---- コンテキスト喪失（three も preventDefault する。状態は保ったまま止めて、戻ったら作り直す）
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLost = true; game.contextLost++; }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      envRT.dispose(); envRT = makeEnvMap(renderer); scene.environment = envRT.texture;
      if (hero.onContextRestored) hero.onContextRestored();
    } catch (e) { errors.add('restore', e.message || e); }
    contextLost = false; game.contextRestored++;
  }, false);
  const loseExtObj = gl.getExtension('WEBGL_lose_context'); // 喪失中は getExtension が null を返すので先に取っておく
  const loseExt = () => loseExtObj;

  // ---- 統計・デバッグ
  const stats = new FrameStats();
  const auto = new AutoTier(tier);
  let res = null, resAt = -1;
  function resources() {
    const now = performance.now();
    if (res && now - resAt < 1000) return res;
    resAt = now;
    const all = countResources(scene, [scene.environment]);
    const h = countResources(hero.root), e = countResources(env.group);
    // PMREM はキューブ RenderTarget（6 面、半精度 RGBA、粗さ用のミップ）
    const envBytes = envRT.width * envRT.height * (envRT.isWebGLCubeRenderTarget ? 6 : 1) * 8 * (4 / 3);
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    const fb = framebufferBytes(db.x, db.y, samples);
    res = { all, hero: h, env: e, envBytes, fb, db, gpu: all.texBytes + envBytes + all.geoBytes + fb };
    return res;
  }
  const overlay = DEBUG ? new DebugOverlay(app, {
    'ctx lose': () => { const x = loseExt(); if (x) { x.loseContext(); setTimeout(() => x.restoreContext(), 1200); } },
    'advance': () => hero.debugAdvance(),
    'hide': () => overlay.el.classList.toggle('min'),
  }) : null;
  function debugText() {
    const s = stats.summary(), r = resources();
    const last = errors.list.slice(-3).map((x) => `! ${x.kind}: ${x.msg.slice(0, 90)}`).join('\n');
    return [
      `tier ${tier.name}${auto.downgrades ? ' ↓' + auto.downgrades : ''}  touch ${navigator.maxTouchPoints || 0}  dpr ${renderer.getPixelRatio().toFixed(2)}  cap ${(tier.pixelCap / 1e6).toFixed(2)}M  msaa ${samples}`,
      `canvas ${r.db.x}x${r.db.y}  css ${viewport.width}x${viewport.height}`,
      `fps ${s.fps.toFixed(1)} avg  p95 ${s.p95ms.toFixed(1)}ms (${(s.p95fps || 0).toFixed(0)}fps)  cpu ${s.cpuMs.toFixed(1)}ms p95 ${s.cpuP95.toFixed(1)}ms`,
      `draw ${stats.calls}  tris ${stats.tris.toLocaleString()}  [hero ${r.hero.tris.toLocaleString()} / env ${r.env.tris.toLocaleString()} static]`,
      `tex ${r.all.textures} (hero ${r.hero.textures}, max ${r.all.maxTex}²)  GPU≈${fmtMiB(r.gpu)}MiB [tex ${fmtMiB(r.all.texBytes)} envmap ${fmtMiB(r.envBytes)} geo ${fmtMiB(r.all.geoBytes)} fb ${fmtMiB(r.fb)}]`,
      `stage ${game.stage} r${game.round} ${game.progress ? game.progress.collected + '/' + game.progress.total : ''}  boot→touch ${Math.round(game.bootMs || 0)}ms [js ${marks.script} tex ${marks.textures} env ${marks.env} hero ${marks.hero} (${Math.round(game.heroCreateMs)}) frame ${marks.firstFrame}]`,
      `errors ${errors.list.length}  warn ${errors.warnings}  nan ${countNaN()}  ctxlost ${game.contextLost} restored ${game.contextRestored}`,
      last,
    ].join('\n');
  }

  // ---- 煙テスト・デバッグ用の窓口
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  function toScreen(p, out) {
    tmpV.copy(p).project(camera);
    out.x = (tmpV.x + 1) / 2 * viewport.width; out.y = (1 - tmpV.y) / 2 * viewport.height; out.z = tmpV.z;
    return out;
  }
  // 指の絵の道すじ（画面の点の列）。
  //  ・hero の dir が接線の向き（外リングなど、画面の中でそのまま回す）で axis/center があるとき：
  //    その点を軸まわりに HINT_SWEEP 回した円弧を投影してなぞる（＝リングの同じ点が実際に通る道。なぞると 1 刻み進む）。
  //  ・dir が中心向き（リングを手前へ倒す回し方）、axis が無い、または円弧が画面でほとんど動かないとき：dir の向きへ 0.5·R の直線。
  //    hero の §4 の式では、輪郭の点から中心へ 0.5·R 引くと約 60° 回る（15° 以上なので離すと次の刻みへ進む）。
  const HINT_SWEEP = THREE.MathUtils.degToRad(50), HINT_STEPS = 16;
  const hp = { a: new THREE.Vector3(), rel: new THREE.Vector3(), ax: new THREE.Vector3(), o2: new THREE.Vector3(), o: { x: 0, y: 0, z: 0 } };
  function projectPath(h, R, arc) {
    const pts = [];
    for (let k = 0; k <= HINT_STEPS; k++) {
      const f = k / HINT_STEPS;
      if (arc) hp.a.copy(hp.rel.subVectors(h.point, h.center).applyAxisAngle(hp.ax, HINT_SWEEP * f)).add(h.center);
      else hp.a.copy(h.dir).normalize().multiplyScalar(0.5 * R * f).add(h.point);
      const b = toScreen(hp.a, hp.o);
      if (!(b.z < 1) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) break;
      pts.push({ x: b.x, y: b.y });
    }
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    return { pts, len };
  }
  function hintScreen() {
    let h = null;
    try { h = hero.getHint(); } catch (e) { errors.add('hint', e.message || e); }
    if (!h || !h.point) return null;
    const a = toScreen(h.point, { x: 0, y: 0, z: 0 });
    if (!(a.z < 1) || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
    const out = { id: h.id, x: a.x, y: a.y, dx: null, dy: null, path: null };
    if (!h.dir || h.dir.lengthSq() < 1e-8) return out;
    const axOk = !!(h.axis && h.center && h.axis.lengthSq() > 1e-8);
    if (axOk) hp.ax.copy(h.axis).normalize();
    const R = Math.max(0.3, h.point.distanceTo(axOk ? h.center : bounds.center));
    // hero の dir が円弧の接線の向き（＝そのまま回す）なら円弧、中心向き（＝手前へ倒す）なら直線
    let tangent = false;
    if (axOk) { hp.a.crossVectors(hp.ax, hp.rel.subVectors(h.point, h.center)); tangent = hp.a.lengthSq() > 1e-8 && Math.abs(hp.a.normalize().dot(hp.o2.copy(h.dir).normalize())) > 0.9; }
    let p = tangent ? projectPath(h, R, true) : null;
    if (!p || p.len < 0.35 * R * viewport.pxPerUnit) p = projectPath(h, R, false);
    if (p.pts.length < 2 || p.len < 8) return out; // 道すじが作れない（ふつうは起きない）：指の絵はタップの形で出す
    const last = p.pts[p.pts.length - 1], lx = last.x - a.x, ly = last.y - a.y, l = Math.hypot(lx, ly) || 1;
    out.dx = lx / l; out.dy = ly / l; out.path = p.pts;
    return out;
  }
  // NaN の見張り（?debug=1 と煙テスト用）：hero の行列とカメラに NaN が無いか
  function countNaN() {
    let n = 0;
    hero.root.traverse((o) => { const e = o.matrixWorld.elements; for (let i = 0; i < 16; i++) if (!Number.isFinite(e[i])) { n++; break; } });
    for (const v of camera.matrixWorld.elements) if (!Number.isFinite(v)) { n++; break; }
    return n;
  }
  Object.assign(game, {
    tier: tier.name, hero, renderer, scene, camera, THREE,
    hintScreen, countNaN, resources, stats: () => ({ ...stats.summary(), calls: stats.calls, tris: stats.tris }),
    advance: () => hero.debugAdvance(),
    loseContext: () => { const x = loseExt(); if (x) x.loseContext(); return !!x; },
    restoreContext: () => { const x = loseExt(); if (x) x.restoreContext(); return !!x; },
    isContextLost: () => contextLost,
  });

  // ---- ループ
  let last = performance.now(), first = true, hintOn = false, quietFor = 0;
  const hs = { x: 0, y: 0, path: null };
  let heroErrors = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const rawMs = Math.max(0, now - last); last = now;
    const dt = Math.min(rawMs / 1000, 0.05);
    if (contextLost) return;
    const tCpu = performance.now();
    if (AUTO_TIER && auto.sample(rawMs)) resize();

    // 次の回
    if (resetTimer >= 0) {
      resetTimer -= dt;
      if (resetTimer < 0) { game.round++; try { hero.reset({ round: game.round }); } catch (e) { errors.add('hero.reset', e.message || e); } }
    }
    if (burstTimer >= 0) { burstTimer -= dt; if (burstTimer < 0) { env.burst(focus.clone().add(new THREE.Vector3(0, 0.2, 0))); sound.play('sparkle'); } }

    updateCamera(dt);
    const inp = input.beginFrame(rawMs / 1000, camera, viewport);
    try { hero.update(dt, inp); }
    catch (e) { if (heroErrors++ < 5) errors.add('hero.update', (e && e.stack) || e); }
    env.update(dt);
    const a = hero.audio || {};
    sound.setLoops(a.roll || 0, a.spin || 0);

    // 指の絵
    const wait = input.hasGrabbed ? HINT_AFTER : HINT_FIRST;
    // 止まってから：宝石が転がっている・リングが刻みへ収まりきっていない間は出さない（hero が次の手を選び直す前の古いヒントを見せない）。
    // 静かな時間はゲーム内の時間（dt）で数える（フレームが遅い端末でも、hero が収まるのを待てるように）。
    const quiet = (a.roll || 0) < 0.02 && (a.spin || 0) < 0.01;
    if (!quiet) quietFor = 0; else quietFor += dt;
    const want = game.stage === 'play' && !inp.pointer.down && inp.idle >= wait && quietFor >= 0.6;
    let ok = false;
    if (want) {
      const h = hintScreen();
      if (h) { ok = true; hs.x = h.x; hs.y = h.y; hs.path = h.path; }
    }
    if (ok && !hintOn) sound.play('hint');
    hintOn = ok;
    finger.update(dt, ok, hs.x, hs.y, hs.path);

    renderer.render(scene, camera);
    stats.push(rawMs, renderer.info, performance.now() - tCpu);
    if (first) {
      first = false;
      game.bootMs = performance.now();
      mark('firstFrame');
      env.prepareLater();
      game.ready = true;
      const sp = document.getElementById('splash');
      if (sp) { sp.classList.add('gone'); setTimeout(() => sp.remove(), 600); }
    }
    if (overlay) overlay.update(dt, debugText);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sound.suspend(); else { sound.resume(); last = performance.now(); }
  });
  requestAnimationFrame((t) => { last = t; frame(t); });
}

async function getHeroFactory() {
  const isFile = location.protocol === 'file:';
  if (params.get('herosrc') === '1' && !isFile) {
    const mod = await import(new URL('hero/hero.js', location.href).href);
    return mod.createHero;
  }
  if (window.GemHero && typeof window.GemHero.createHero === 'function') return window.GemHero.createHero;
  if (!isFile) { const mod = await import(new URL('hero/hero.js', location.href).href); return mod.createHero; }
  throw new Error('hero が見つからない（app/hero/hero.bundle.js を npm run build:hero で作る）');
}

function frameFor(center, radius, aspect, out) {
  const vh = THREE.MathUtils.degToRad(VFOV / 2);
  const hh = Math.atan(Math.tan(vh) * aspect);
  const dist = radius / Math.sin(Math.min(vh, hh));
  out.dist = dist;
  out.target.copy(center);
  out.pos.set(0, Math.sin(ELEV), Math.cos(ELEV)).multiplyScalar(dist).add(center);
}

function smooth(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

function showFatal() {
  const sp = document.getElementById('splash');
  if (sp) sp.classList.add('fatal');
}
