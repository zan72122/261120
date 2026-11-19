// engine.js — 描画ループ・カメラ構図・入力・品質・保存・指のお手本(ghost)
// 単位: メートル / 秒。座標は layout.js の L に従う（Y 上、カメラは +Z 側から -Z を見る）。
//
// 公開 API
// ---------------------------------------------------------------------------
// createEngine({ canvas, fallbackEl }) -> engine | null
//   WebGL が作れなければ fallbackEl を display:block にして null を返す。
//   webglcontextlost は preventDefault し描画を止め、webglcontextrestored で再開（three が GL 状態を作り直す）。
//
// engine.THREE / engine.renderer / engine.scene / engine.camera (PerspectiveCamera, near 0.05, far 20)
//   ライト・環境マップ・背景は engine では足さない（world 担当）。
// engine.onUpdate(fn(dt, t))   毎フレーム。dt 秒（0.05 上限）、t は一時停止を除いた経過秒。登録順に呼ぶ。
// engine.start()               rAF ループ開始（何度呼んでもよい）
// engine.onPause(fn) / engine.onResume(fn)
//   document.hidden / pagehide / blur で停止、visible / pageshow / focus で再開。復帰直後の dt は跳ねない。
// engine.onResize(fn(w, h, aspect))  w,h は CSS px。登録時に現在値で1回呼ぶ。
// engine.size -> { w, h, aspect, dpr, safe:{top,right,bottom,left} }（CSS px, 読み取り専用として使う）
//
// カメラ構図
// engine.setFrame(frame, { duration = 1.4, immediate = false } = {})
//   frame = { min:[x,y,z], max:[x,y,z], pitch = 0.2 (rad, 正で見下ろし), yaw = 0 (rad, 正で +X 側から見る), pad = 1.06 }
//   カメラは箱の中心を注視。箱の8頂点が Safe Area を除いた表示域に入る最小距離を求める。
//   Safe Area が非対称なときは setViewOffset で「注視点が安全域の中心に来る」ように投影をずらす。
//   fov は縦 30°（縦長画面では aspect に応じて最大 40° まで広げる）。resize/回転のたびに現在の構図を再適用。
//   遷移は ease-in-out（smootherstep）で位置・注視点を補間。遷移中に別の setFrame を呼ぶと現在位置から続ける。
//   setFrame を一度も呼ばない間はカメラは (0, 0.30, 1.2) から (0, 0.12, 0) を見る。
// engine.cameraShake(amount)   amount はメートル（0.002〜0.006 くらいが「ほんの小さな揺れ」）。約0.35秒で減衰。
// engine.cameraTarget -> THREE.Vector3  現在の注視点（読み取り専用として使う）
//
// 入力（Pointer Events。指1本だけ追跡、2本目以降は1本目が離れるまで無視）
// engine.input.onDown(fn(p)) / onMove(fn(p)) / onUp(fn(p))   ※onMove は押している間だけ呼ぶ
//   p = { x, y (CSS px, canvas 左上原点), ndc: THREE.Vector2(新規), ray: THREE.Ray (world), t, cancelled?: boolean }
//   ※ p.ray は engine 内で1つの Ray を使い回している。後で使うなら ray.clone() すること。
//   pointercancel / lostpointercapture も Up として扱い、その場合 cancelled: true。
// engine.input.isDown (boolean), engine.input.x / y (最後の CSS px)
// engine.input.idleTime()  最後の操作からの秒（一時停止中は進まない）
// engine.input.poke()      外部から「操作があった」ことにする（idleTime を 0 に）
// engine.input.rayAt(x, y, outRay?) -> THREE.Ray  任意の CSS px 座標からの光線（out 省略時は内部の使い回し Ray）
//
// 便利関数
// engine.rayPlane(ray, planePoint, planeNormal, outVec3) -> Vector3|null   平面との交点（後ろ側/平行は null）
// engine.raySphere(ray, center, radius) -> 距離|null   ray 原点から球面までの距離（原点が内側なら 0）
// engine.project(worldVec3, outVec2) -> outVec2（CSS px, canvas 左上原点）。outVec2 省略時は新規。
//
// 指のお手本（半透明の手、常に最前面）
// engine.ghost.play(points: Vector3[], { duration = 1.8, loop = true, tap = false, pause = 0.6 })
//   指先が基準点。points に沿って Catmull-Rom でなめらかに移動（duration 秒）。開始でフェードイン＋押し込み、
//   終点でフェードアウト、pause 秒おいて繰り返す。tap:true は points[0] でトントンと2回押す。
//   画面上で指先の幅が約 50 CSS px になるよう距離に応じてスケール。不透明度 0.45。
// engine.ghost.stop()   フェードアウトして止まる
// engine.ghost.active  再生中なら true
//
// 品質
// engine.quality = { low, scale, particleBudget, onChange(fn(quality)) }
//   devicePixelRatio 上限 2（画面の短辺 >= 700 CSS px の大画面は 1.5）× scale(0.6〜1.0, 動的解像度)。
//   それでも重いと low=true（renderer.shadowMap 無効、シーン内ライトの castShadow=false、particleBudget 半分）にして
//   onChange を呼ぶ。low から戻しはしない。particleBudget は通常 800、low で 400（粒子の目安上限数）。
//   目標はなめらかな 60fps。解像度を下げても速くならない（30fps 上限の省電力モード等）ときはそれ以上下げない。
//   影の地図は 60fps 付近では 2 フレームに 1 回だけ描き直す（renderer.shadowMap.autoUpdate=false で engine が管理）。
//   最初の数フレームで、見えていない物も含めてシェーダを先に用意しておく（遊んでいる途中の初回表示でつかえない）。
//   world 担当: low 後に足すライトは castShadow を付けないこと（engine.quality.low を見る）。
//
// 保存（localStorage キー 'gf-261120-2'。例外・拒否・壊れた JSON でも落ちない）
// engine.save.load() -> object|null
// engine.save.write(obj)   0.5 秒に1回まで間引き（最後の値を書く）。pagehide/hidden で即書き込み。
// engine.save.clear()
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const SAVE_KEY = 'gf-261120-2';

export function createEngine({ canvas, fallbackEl }) {
  // ---------- renderer ----------
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!renderer.getContext()) throw new Error('no context');
  } catch (e) {
    console.warn('[engine] WebGL unavailable', e);
    if (fallbackEl) fallbackEl.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
    return null;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // 更新は frame() で間引いて行う
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor(0x2b2420, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  camera.position.set(0, 0.3, 1.2);
  const camTarget = new THREE.Vector3(0, 0.12, 0);
  camera.lookAt(camTarget);
  scene.add(camera);

  const engine = { THREE, renderer, scene, camera, cameraTarget: camTarget };

  // ---------- callbacks ----------
  const updateFns = [], pauseFns = [], resumeFns = [], resizeFns = [], qualityFns = [];
  const errored = new WeakSet();
  function safeCall(fn, ...args) {
    try { fn(...args); } catch (e) {
      if (!errored.has(fn)) { errored.add(fn); console.error('[engine] callback error', e); }
    }
  }
  engine.onUpdate = (fn) => { updateFns.push(fn); };
  engine.onPause = (fn) => { pauseFns.push(fn); };
  engine.onResume = (fn) => { resumeFns.push(fn); };
  engine.onResize = (fn) => { resizeFns.push(fn); safeCall(fn, size.w, size.h, size.aspect); };

  // ---------- size / safe area ----------
  const safeProbe = document.createElement('div');
  safeProbe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
    'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
  document.body.appendChild(safeProbe);

  const size = { w: 1, h: 1, aspect: 1, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
  engine.size = size;

  function readSafe() {
    try {
      const cs = getComputedStyle(safeProbe);
      size.safe.top = parseFloat(cs.paddingTop) || 0;
      size.safe.right = parseFloat(cs.paddingRight) || 0;
      size.safe.bottom = parseFloat(cs.paddingBottom) || 0;
      size.safe.left = parseFloat(cs.paddingLeft) || 0;
    } catch (e) { /* ignore */ }
  }

  // ---------- quality ----------
  const quality = {
    low: false,
    scale: 1.0,
    particleBudget: 800,
    onChange: (fn) => { qualityFns.push(fn); },
  };
  engine.quality = quality;

  function basePixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const cap = Math.min(size.w, size.h) >= 700 ? 1.5 : 2;
    return Math.min(dpr, cap);
  }
  function applyPixelRatio() {
    size.dpr = Math.max(0.5, basePixelRatio() * quality.scale);
    renderer.setPixelRatio(size.dpr);
    renderer.setSize(size.w, size.h, false);
  }

  function measure() {
    let w = window.innerWidth, h = window.innerHeight;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) { w = rect.width; h = rect.height; }
    return [Math.max(1, Math.round(w)), Math.max(1, Math.round(h))];
  }

  function handleResize() {
    const [w, h] = measure();
    readSafe();
    const changed = w !== size.w || h !== size.h;
    size.w = w; size.h = h; size.aspect = w / h;
    applyPixelRatio();
    camera.aspect = size.aspect;
    reapplyFrame();
    if (changed) for (const fn of resizeFns) safeCall(fn, w, h, size.aspect);
  }
  let resizeTimers = [];
  function scheduleResize() {
    handleResize();
    // iOS は回転・アドレスバー伸縮の値が遅れて確定するので少し後にも測り直す
    for (const t of resizeTimers) clearTimeout(t);
    resizeTimers = [120, 350, 700].map((ms) => setTimeout(handleResize, ms));
  }
  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);

  // ---------- camera framing ----------
  let curFrame = null;
  const tr = {
    active: false, p: 1, dur: 1.4,
    fromPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(),
    toPos: new THREE.Vector3(), toTgt: new THREE.Vector3(),
  };
  const basePos = camera.position.clone();
  const baseTgt = camTarget.clone();
  const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _b = new THREE.Vector3();
  const _f = new THREE.Vector3(), _c = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function fovForAspect(aspect) {
    if (aspect >= 1) return 30;
    const k = Math.min(1, (1 - aspect) / 0.5); // aspect 0.5 で最大
    return 30 + 10 * k;
  }

  // frame から「カメラ位置・注視点」を計算（現在の画面サイズ・safe area で）
  function solveFrame(frame, outPos, outTgt) {
    const mn = frame.min, mx = frame.max;
    const pitch = frame.pitch != null ? frame.pitch : 0.2;
    const yaw = frame.yaw || 0;
    const pad = frame.pad || 1.06;
    _c.set((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2);
    _b.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)); // 注視点→カメラ
    _f.copy(_b).negate();
    _r.crossVectors(_f, UP).normalize();
    _u.crossVectors(_r, _f).normalize();

    const s = size.safe;
    const sx = Math.max(0.2, (size.w - s.left - s.right) / size.w);
    const sy = Math.max(0.2, (size.h - s.top - s.bottom) / size.h);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanH = tanV * size.aspect;
    const limX = (tanH * sx) / pad, limY = (tanV * sy) / pad;

    let dist = 0;
    for (let i = 0; i < 8; i++) {
      _v.set(i & 1 ? mx[0] : mn[0], i & 2 ? mx[1] : mn[1], i & 4 ? mx[2] : mn[2]).sub(_c);
      const x = Math.abs(_v.dot(_r)), y = Math.abs(_v.dot(_u)), z = _v.dot(_b);
      // depth = dist - z が x/limX, y/limY, near*2 以上
      dist = Math.max(dist, z + x / limX, z + y / limY, z + camera.near * 2);
    }
    outTgt.copy(_c);
    outPos.copy(_c).addScaledVector(_b, dist);
  }

  function applyViewOffset() {
    const s = size.safe;
    const cx = (s.left - s.right) / 2, cy = (s.top - s.bottom) / 2;
    if (Math.abs(cx) < 0.5 && Math.abs(cy) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(size.w, size.h, -cx, -cy, size.w, size.h);
  }

  function reapplyFrame() {
    camera.fov = fovForAspect(size.aspect);
    camera.aspect = size.aspect;
    applyViewOffset();
    camera.updateProjectionMatrix();
    if (!curFrame) return;
    solveFrame(curFrame, tr.toPos, tr.toTgt);
    if (!tr.active) { basePos.copy(tr.toPos); baseTgt.copy(tr.toTgt); }
  }

  engine.setFrame = (frame, { duration = 1.4, immediate = false } = {}) => {
    if (!frame || !frame.min || !frame.max) return;
    const first = !curFrame;
    curFrame = frame;
    camera.fov = fovForAspect(size.aspect);
    camera.updateProjectionMatrix();
    solveFrame(frame, tr.toPos, tr.toTgt);
    if (immediate || first || duration <= 0) {
      tr.active = false; tr.p = 1;
      basePos.copy(tr.toPos); baseTgt.copy(tr.toTgt);
    } else {
      tr.fromPos.copy(basePos); tr.fromTgt.copy(baseTgt);
      tr.dur = duration; tr.p = 0; tr.active = true;
    }
  };

  const ease = (x) => x * x * x * (x * (x * 6 - 15) + 10);
  let shakeAmt = 0, shakeT = 0;
  engine.cameraShake = (amount) => { shakeAmt = Math.max(shakeAmt, amount || 0.003); shakeT = 0; };

  function updateCamera(dt, t) {
    if (tr.active) {
      tr.p = Math.min(1, tr.p + dt / tr.dur);
      const k = ease(tr.p);
      basePos.lerpVectors(tr.fromPos, tr.toPos, k);
      baseTgt.lerpVectors(tr.fromTgt, tr.toTgt, k);
      if (tr.p >= 1) tr.active = false;
    }
    camera.position.copy(basePos);
    camTarget.copy(baseTgt);
    if (shakeAmt > 0) {
      shakeT += dt;
      const fall = Math.max(0, 1 - shakeT / 0.35);
      const a = shakeAmt * fall * fall;
      camera.position.x += Math.sin(t * 61.0) * a;
      camera.position.y += Math.sin(t * 47.0 + 1.3) * a;
      if (fall <= 0) shakeAmt = 0;
    }
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
  }

  // ---------- input ----------
  const raycaster = new THREE.Raycaster();
  const sharedRay = raycaster.ray; // 使い回しの Ray（p.ray）
  const _ndc = new THREE.Vector2();
  let activeId = null, idle = 0, elapsed = 0;
  const downFns = [], moveFns = [], upFns = [];
  const input = {
    isDown: false, x: 0, y: 0,
    onDown: (fn) => { downFns.push(fn); },
    onMove: (fn) => { moveFns.push(fn); },
    onUp: (fn) => { upFns.push(fn); },
    idleTime: () => idle,
    poke: () => { idle = 0; },
    rayAt: (x, y, outRay) => {
      _ndc.set((x / size.w) * 2 - 1, -(y / size.h) * 2 + 1);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(_ndc, camera);
      return outRay ? outRay.copy(raycaster.ray) : raycaster.ray;
    },
  };
  engine.input = input;

  function makeP(e, cancelled) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    input.x = x; input.y = y;
    const ndc = new THREE.Vector2((x / (rect.width || size.w)) * 2 - 1, -(y / (rect.height || size.h)) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const p = { x, y, ndc, ray: sharedRay, t: elapsed };
    if (cancelled) p.cancelled = true;
    return p;
  }
  function onPointerDown(e) {
    if (activeId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activeId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    input.isDown = true; idle = 0;
    const p = makeP(e, false);
    for (const fn of downFns) safeCall(fn, p);
  }
  function onPointerMove(e) {
    if (e.pointerId !== activeId) return;
    idle = 0;
    const p = makeP(e, false);
    for (const fn of moveFns) safeCall(fn, p);
  }
  function endPointer(e, cancelled) {
    if (e.pointerId !== activeId) return;
    activeId = null; input.isDown = false; idle = 0;
    try { if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = makeP(e, cancelled);
    for (const fn of upFns) safeCall(fn, p);
  }
  const opt = { passive: false };
  canvas.addEventListener('pointerdown', (e) => { if (e.cancelable) e.preventDefault(); onPointerDown(e); }, opt);
  canvas.addEventListener('pointermove', (e) => { if (e.cancelable) e.preventDefault(); onPointerMove(e); }, opt);
  canvas.addEventListener('pointerup', (e) => endPointer(e, false), opt);
  canvas.addEventListener('pointercancel', (e) => endPointer(e, true), opt);
  canvas.addEventListener('lostpointercapture', (e) => endPointer(e, true), opt);

  // ---------- helpers ----------
  const _plane = new THREE.Plane();
  const _n = new THREE.Vector3();
  engine.rayPlane = (ray, planePoint, planeNormal, outVec3) => {
    _n.copy(planeNormal).normalize();
    _plane.setFromNormalAndCoplanarPoint(_n, planePoint);
    return ray.intersectPlane(_plane, outVec3 || new THREE.Vector3());
  };
  engine.raySphere = (ray, center, radius) => {
    _v.subVectors(center, ray.origin);
    const tca = _v.dot(ray.direction);
    const d2 = _v.lengthSq() - tca * tca;
    const r2 = radius * radius;
    if (_v.lengthSq() <= r2) return 0;
    if (d2 > r2) return null;
    const t0 = tca - Math.sqrt(r2 - d2);
    return t0 >= 0 ? t0 : null;
  };
  const _pv = new THREE.Vector3();
  engine.project = (worldVec3, outVec2) => {
    const out = outVec2 || new THREE.Vector2();
    _pv.copy(worldVec3).project(camera);
    return out.set((_pv.x * 0.5 + 0.5) * size.w, (-_pv.y * 0.5 + 0.5) * size.h);
  };

  // ---------- ghost hand ----------
  engine.ghost = createGhost(scene, camera, size);

  // ---------- save ----------
  let pendingSave = null, lastWrite = -1e9, saveTimer = null;
  function storage() { try { return window.localStorage; } catch (e) { return null; } }
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (pendingSave === null) return;
    const data = pendingSave; pendingSave = null;
    lastWrite = performance.now();
    try { const s = storage(); if (s) s.setItem(SAVE_KEY, data); } catch (e) { /* quota / private mode */ }
  }
  engine.save = {
    load() {
      try {
        const s = storage(); if (!s) return null;
        const raw = s.getItem(SAVE_KEY); if (!raw) return null;
        const obj = JSON.parse(raw);
        return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
      } catch (e) { return null; }
    },
    write(obj) {
      try { pendingSave = JSON.stringify(obj); } catch (e) { return; }
      if (pendingSave === undefined) { pendingSave = null; return; }
      const since = performance.now() - lastWrite;
      if (since >= 500) flushSave();
      else if (!saveTimer) saveTimer = setTimeout(flushSave, 500 - since);
    },
    clear() {
      pendingSave = null;
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      try { const s = storage(); if (s) s.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    },
  };

  // ---------- quality control ----------
  // 目標 60fps。1 段下げても速くならなければ（30Hz 上限・CPU 律速）解像度はそれ以上下げない。
  let ftAvg = 1 / 60, qWarm = 0, slowFor = 0, fastFor = 0, cooldown = 0;
  let stepFt = 0, noGain = false; // 直前に解像度を下げた時の ftAvg / 下げても効かなかった
  function goLow() {
    if (quality.low) return;
    quality.low = true;
    quality.particleBudget = Math.round(quality.particleBudget / 2);
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => {
      if (o.isLight) o.castShadow = false;
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => { mm.needsUpdate = true; });
    });
    for (const fn of qualityFns) safeCall(fn, quality);
  }
  function setScale(v) {
    quality.scale = v;
    applyPixelRatio();
    for (const fn of qualityFns) safeCall(fn, quality);
  }
  function updateQuality(rawDt) {
    if (rawDt <= 0 || rawDt > 0.25) return; // 一時的なつかえは無視
    qWarm += rawDt;
    ftAvg += (rawDt - ftAvg) * 0.05;
    if (qWarm < 2) return; // 開始・復帰直後は様子見
    cooldown -= rawDt;
    const SLOW = 1 / 48, FAST = 1 / 57, VERY_SLOW = 1 / 26;
    if (ftAvg > SLOW) { slowFor += rawDt; fastFor = 0; }
    else if (ftAvg < FAST) { fastFor += rawDt; slowFor = 0; }
    else { slowFor = 0; fastFor = 0; }
    if (cooldown > 0) return;
    // 直前の段下げの効き目を確認（5% 以上速くならなければ解像度はやめる）
    if (stepFt > 0) {
      if (ftAvg > stepFt * 0.95 && ftAvg > SLOW) {
        noGain = true;
        if (quality.scale < 1.0 - 1e-3) setScale(Math.min(1.0, quality.scale + 0.1)); // 効かない分は戻す
      }
      stepFt = 0;
    }
    if (slowFor > 1.0) {
      if (!noGain && quality.scale > 0.6 + 1e-3) {
        stepFt = ftAvg;
        setScale(Math.max(0.6, quality.scale - 0.1));
      } else if (!quality.low && ftAvg > VERY_SLOW) {
        goLow();
      }
      slowFor = 0; cooldown = 1.5;
    } else if (fastFor > 4.0 && quality.scale < 1.0 - 1e-3) {
      setScale(Math.min(1.0, quality.scale + 0.05));
      fastFor = 0; cooldown = 3.0;
    }
  }

  // ---------- shader warm-up ----------
  // 見えていない物（後で出てくる道具・粒子・お手本の手）も一度 visible にして compile し、途中の初回表示のつかえをなくす。
  function warmUp() {
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try { renderer.compile(scene, camera); } catch (e) { /* ignore */ }
    for (const o of hidden) o.visible = false;
  }

  // ---------- loop / pause ----------
  let running = false, paused = false, rafId = 0, lastTs = null, contextLost = false, loopErrLogged = false;
  let frameNo = 0, warmed = false, shadowSkip = 0;
  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    if (paused) return;
    if (lastTs === null) { lastTs = ts; }
    const raw = Math.max(0, (ts - lastTs) / 1000);
    lastTs = ts;
    const dt = Math.min(raw, 0.05);
    elapsed += dt;
    idle += dt;
    try {
      updateQuality(raw);
      updateCamera(dt, elapsed);
      for (const fn of updateFns) safeCall(fn, dt, elapsed);
      engine.ghost._update(dt);
      if (!contextLost) {
        frameNo++;
        if (!warmed && frameNo >= 2) { warmed = true; warmUp(); }
        // 影: 速い画面（ほぼ 60fps 以上）では 2 フレームに 1 回。遅い時は毎フレーム（動きが粗く見えないように）
        if (renderer.shadowMap.enabled) {
          if (shadowSkip > 0 && raw < 1 / 45) shadowSkip--;
          else { renderer.shadowMap.needsUpdate = true; shadowSkip = 1; }
        }
        renderer.render(scene, camera);
      }
    } catch (e) {
      if (!loopErrLogged) { loopErrLogged = true; console.error('[engine] frame error', e); }
    }
  }
  engine.start = () => {
    if (running) return;
    running = true; lastTs = null;
    rafId = requestAnimationFrame(frame);
  };
  engine.isPaused = () => paused;

  function pause() {
    if (paused) return;
    paused = true;
    flushSave();
    if (input.isDown) { // 押しっぱなしで隠れたら離したことにする
      const id = activeId; activeId = null; input.isDown = false;
      const p = { x: input.x, y: input.y, ndc: new THREE.Vector2(), ray: sharedRay, t: elapsed, cancelled: true };
      for (const fn of upFns) safeCall(fn, p);
      try { canvas.releasePointerCapture(id); } catch (e) { /* ignore */ }
    }
    for (const fn of pauseFns) safeCall(fn);
  }
  function resume() {
    if (!paused || document.hidden) return;
    paused = false;
    lastTs = null; qWarm = 0; // 復帰直後の dt を 0 から
    scheduleResize();
    for (const fn of resumeFns) safeCall(fn);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else resume(); });
  window.addEventListener('pagehide', () => { flushSave(); pause(); });
  window.addEventListener('pageshow', resume);
  window.addEventListener('blur', pause);
  window.addEventListener('focus', resume);
  // iOS で focus が来ないことがあるので、触れたら再開
  window.addEventListener('pointerdown', resume, true);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    renderer.shadowMap.needsUpdate = true;
    applyPixelRatio();
  }, false);

  handleResize();
  return engine;
}

// ---------------------------------------------------------------------------
// 指のお手本
function makeHandTexture() {
  const W = 256, H = 384;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const tipX = 128, tipY = 14, fingerW = 50;

  function rr(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function shape() {
    // 人差し指
    rr(tipX - fingerW / 2, tipY, fingerW, 200, fingerW / 2); g.fill();
    // にぎった手（甲）
    rr(66, 168, 150, 150, 56); g.fill();
    // 曲げた指の関節のふくらみ
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(160 + i * 22 - 8, 176 + i * 6, 26, 30, 0, 0, Math.PI * 2); g.fill(); }
    // 親指（左側に添える）
    g.save(); g.translate(78, 236); g.rotate(-0.55);
    rr(-22, -62, 44, 110, 22); g.fill(); g.restore();
    // 手首
    rr(92, 280, 104, 104, 40); g.fill();
  }

  // 1) 形をやわらかい縁で塗る
  g.save();
  g.fillStyle = '#efc2a2';
  g.shadowColor = 'rgba(120,70,50,0.35)';
  g.shadowBlur = 10;
  shape();
  g.restore();
  g.fillStyle = '#efc2a2';
  shape();

  // 2) 陰影（形の内側だけ）
  g.globalCompositeOperation = 'source-atop';
  let gr = g.createLinearGradient(40, 0, 230, 0);
  gr.addColorStop(0, 'rgba(255,236,220,0.55)');
  gr.addColorStop(0.45, 'rgba(255,225,205,0.0)');
  gr.addColorStop(1, 'rgba(150,85,60,0.35)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 指の中央のハイライト
  gr = g.createLinearGradient(tipX - fingerW / 2, 0, tipX + fingerW / 2, 0);
  gr.addColorStop(0, 'rgba(160,90,70,0.18)');
  gr.addColorStop(0.4, 'rgba(255,240,228,0.35)');
  gr.addColorStop(1, 'rgba(150,85,60,0.28)');
  g.fillStyle = gr; g.fillRect(tipX - fingerW / 2, 0, fingerW, 175);
  // 爪（ほんのり明るく）
  g.fillStyle = 'rgba(255,232,224,0.55)';
  rr(tipX - 15, tipY + 8, 30, 36, 14); g.fill();
  // 指の付け根・関節の影
  const rad = (x, y, r, a) => {
    const q = g.createRadialGradient(x, y, 0, x, y, r);
    q.addColorStop(0, `rgba(140,78,58,${a})`); q.addColorStop(1, 'rgba(140,78,58,0)');
    g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  rad(tipX, 180, 40, 0.22);
  rad(tipX, 110, 26, 0.08);
  rad(150, 205, 30, 0.14);
  rad(175, 212, 26, 0.14);
  rad(98, 250, 34, 0.12);
  // 手首側は消えていく
  g.globalCompositeOperation = 'destination-out';
  gr = g.createLinearGradient(0, 270, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, 270, W, H - 270);
  g.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, W, H, tipX, tipY, fingerW };
}

function createGhost(scene, camera, size) {
  let hand = null, sprite = null, mat = null;
  const BASE_OPACITY = 0.62;
  const state = {
    playing: false, stopping: false, points: null, curve: null,
    duration: 1.8, loop: true, tap: false, pause: 0.6, t: 0, fade: 0,
  };
  const pos = new THREE.Vector3(), camUp = new THREE.Vector3();

  function ensure() {
    if (sprite) return;
    hand = makeHandTexture();
    mat = new THREE.SpriteMaterial({
      map: hand.tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false,
    });
    sprite = new THREE.Sprite(mat);
    sprite.center.set(hand.tipX / hand.W, 1 - hand.tipY / hand.H); // 指先が基準点
    sprite.renderOrder = 10000;
    sprite.frustumCulled = false;
    sprite.visible = false;
    scene.add(sprite);
  }

  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  ensure(); // 最初から作っておく（シェーダの準備を開始時に済ませる）
  const ghost = {
    get active() { return state.playing && !state.stopping; },
    play(points, { duration = 1.8, loop = true, tap = false, pause = 0.6 } = {}) {
      if (!points || !points.length) return;
      ensure();
      state.points = points.map((p) => p.clone());
      state.curve = state.points.length >= 2 ? new THREE.CatmullRomCurve3(state.points, false, 'centripetal') : null;
      state.duration = Math.max(0.2, duration);
      state.loop = loop; state.tap = tap; state.pause = Math.max(0, pause);
      state.t = 0; state.playing = true; state.stopping = false;
      sprite.visible = true;
    },
    stop() {
      if (!state.playing) return;
      state.stopping = true;
    },
    _update(dt) {
      if (!sprite || !state.playing) return;
      const FIN = 0.3, PRESS = 0.25, FOUT = 0.35;
      const moveDur = state.tap ? 1.0 : state.duration;
      const cycle = FIN + PRESS + moveDur + FOUT + state.pause;
      state.t += dt;
      if (state.t >= cycle) {
        if (state.loop && !state.stopping) state.t -= cycle;
        else { state.playing = false; sprite.visible = false; return; }
      }
      const t = state.t;
      let alpha, lift, press = 0, u = 0;
      if (t < FIN) { alpha = smooth(t / FIN); lift = 1; }
      else if (t < FIN + PRESS) { alpha = 1; lift = 1 - smooth((t - FIN) / PRESS); press = 1 - lift; }
      else if (t < FIN + PRESS + moveDur) {
        alpha = 1; lift = 0; press = 1;
        const m = (t - FIN - PRESS) / moveDur;
        if (state.tap) {
          // トントン: 2回持ち上げて押す
          lift =Math.abs(Math.sin(Math.min(1, m) * Math.PI * 2)) * 0.9;
          press = 1 - lift;
        } else {
          u = smooth(m);
        }
      } else if (t < FIN + PRESS + moveDur + FOUT) {
        const m = (t - FIN - PRESS - moveDur) / FOUT;
        alpha = 1 - smooth(m); lift = smooth(m) * 0.6; press = 1 - lift; u = state.tap ? 0 : 1;
      } else { alpha = 0; lift = 1; u = state.tap ? 0 : 1; }

      if (state.stopping) state.fadeOut = Math.max(0, (state.fadeOut == null ? 1 : state.fadeOut) - dt / 0.3);
      else state.fadeOut = 1;
      if (state.stopping && state.fadeOut <= 0) { state.playing = false; state.stopping = false; sprite.visible = false; return; }

      if (state.curve && !state.tap) state.curve.getPoint(u, pos);
      else pos.copy(state.points[0]);

      // 距離に応じたスケール: 指先の幅 ≒ 50 CSS px
      const dist = Math.max(0.05, camera.position.distanceTo(pos));
      const worldPerPx = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, size.h);
      const pxScale = 32 / hand.fingerW; // テクスチャ px → CSS px
      const pressScale = 1 - 0.08 * press;
      const sx = hand.W * pxScale * worldPerPx * pressScale;
      const sy = hand.H * pxScale * worldPerPx * pressScale;
      sprite.scale.set(sx, sy, 1);
      // 持ち上げ: 画面の上方向へ少し浮かせる（押し込むと基準点に着く）
      camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      sprite.position.copy(pos).addScaledVector(camUp, lift * 14 * worldPerPx);
      mat.opacity = BASE_OPACITY * alpha * state.fadeOut;
    },
  };
  return ghost;
}
