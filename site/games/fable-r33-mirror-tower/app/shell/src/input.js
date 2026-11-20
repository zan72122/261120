// 入力：指1本だけを追う。掴む・ドラッグ・タップ・離すを、毎フレームの input オブジェクトにまとめる（HERO-SPEC §4）。
import THREE from './three.js';

export const HINT_DELAY = 3.0;
export const HINT_STRONG = 8.0;
const TAP_MOVE_PX = 12, TAP_SECONDS = 0.4, NEAR_PX = 70;

export function createInput({ canvas, camera, getHandles, onEmptyTap, onAnyDown, onAnyUp }) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const box = new THREE.Box3(), center = new THREE.Vector3(), tmpP = new THREE.Vector3();
  let rect = canvas.getBoundingClientRect();
  let time = 0;
  let idle = HINT_DELAY; // 起動直後から合図を出す
  let ptr = null; // { id, x0, y0, x, y, t0, handle, lastX, lastY, vx, vy, moved }
  const taps = [], released = [];
  let fdx = 0, fdy = 0; // このフレームの移動（キャンバス高さ単位）
  let justStarted = false;

  const input = {
    time: 0, camera, idle, hintLevel: 0,
    pointer: { active: false, x: 0, y: 0, ndcX: 0, ndcY: 0 },
    ray: { origin: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, -1) },
    grab: null,
    released, taps,
  };
  const grab = { id: '', dx: 0, dy: 0, ddx: 0, ddy: 0, vx: 0, vy: 0, point: new THREE.Vector3(), duration: 0, justStarted: false };

  function local(e) { return [e.clientX - rect.left, e.clientY - rect.top]; }
  function setRay(x, y) {
    ndc.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }

  function pick(x, y) {
    setRay(x, y);
    const hs = (getHandles() || []).filter((h) => h && h.enabled && h.object);
    if (!hs.length) return null;
    const hits = raycaster.intersectObjects(hs.map((h) => h.object), true);
    if (hits.length) {
      for (const hit of hits) {
        let o = hit.object;
        while (o) { const h = hs.find((hh) => hh.object === o); if (h) return { handle: h, point: hit.point.clone() }; o = o.parent; }
      }
    }
    // 外れても、画面上で近い操作部を掴む（小さな指向け）。操作部の中の当たり形状（子の Mesh）ごとに測る
    // （箱の中心だと、離れた2つの当たり＝鏡とハンドルの間を測ってしまう）。
    let best = null, bestD = NEAR_PX;
    const consider = (h, wp) => {
      const p = tmpP.copy(wp).project(camera);
      if (p.z > 1) return;
      const sx = (p.x + 1) / 2 * rect.width, sy = (1 - p.y) / 2 * rect.height;
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) { bestD = d; best = { handle: h, point: wp.clone() }; }
    };
    for (const h of hs) {
      let n = 0;
      h.object.traverse((o) => { if (o.isMesh) { n++; consider(h, o.getWorldPosition(center)); } });
      if (!n) {
        box.setFromObject(h.object, true);
        if (box.isEmpty()) h.object.getWorldPosition(center); else box.getCenter(center);
        consider(h, center);
      }
    }
    return best;
  }

  function down(e) {
    if (ptr) return; // 2本目以降の指は無視
    e.preventDefault();
    rect = canvas.getBoundingClientRect();
    const [x, y] = local(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const hit = pick(x, y);
    ptr = { id: e.pointerId, x0: x, y0: y, x, y, t0: time, handle: hit ? hit.handle : null, vx: 0, vy: 0, moved: 0, lastT: performance.now() };
    if (hit) {
      grab.id = hit.handle.id; grab.dx = grab.dy = grab.ddx = grab.ddy = grab.vx = grab.vy = 0;
      grab.point.copy(hit.point); grab.duration = 0;
      justStarted = true;
    }
    idle = 0;
    onAnyDown && onAnyDown(!!hit);
  }
  function move(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    e.preventDefault();
    const [x, y] = local(e);
    const H = Math.max(1, rect.height);
    const ddx = (x - ptr.x) / H, ddy = -(y - ptr.y) / H;
    const now = performance.now(), dts = Math.max(1e-3, (now - ptr.lastT) / 1000);
    const k = Math.min(1, dts / 0.1);
    ptr.vx += (ddx / dts - ptr.vx) * k; ptr.vy += (ddy / dts - ptr.vy) * k;
    ptr.lastT = now;
    fdx += ddx; fdy += ddy;
    ptr.moved = Math.max(ptr.moved, Math.hypot(x - ptr.x0, y - ptr.y0));
    ptr.x = x; ptr.y = y;
    idle = 0;
  }
  function up(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    e.preventDefault();
    const isTap = ptr.moved < TAP_MOVE_PX && time - ptr.t0 < TAP_SECONDS && e.type === 'pointerup';
    // 最後の動きから時間が経っていたら速度は0（止めてから離した）
    const still = (performance.now() - ptr.lastT) > 90;
    if (ptr.handle) {
      released.push({ id: ptr.handle.id, vx: still ? 0 : ptr.vx, vy: still ? 0 : ptr.vy });
      if (isTap) {
        taps.push({ id: ptr.handle.id, point: grab.point.clone() });
        idle = HINT_DELAY; // 操作部をトンと触っただけ（回していない）→ すぐ「こう動かすよ」の合図を見せる
      }
    } else if (isTap) {
      taps.push({ id: null, point: null });
      idle = HINT_DELAY; // 何もない所を触ったら、すぐ合図
      onEmptyTap && onEmptyTap();
    }
    if (!ptr.handle && !isTap) idle = 0;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    ptr = null;
    onAnyUp && onAnyUp();
  }

  const opts = { passive: false };
  canvas.addEventListener('pointerdown', down, opts);
  canvas.addEventListener('pointermove', move, opts);
  canvas.addEventListener('pointerup', up, opts);
  canvas.addEventListener('pointercancel', up, opts);
  canvas.addEventListener('lostpointercapture', (e) => { if (ptr && e.pointerId === ptr.id) up(Object.assign({}, e, { type: 'pointercancel', preventDefault() {} , pointerId: e.pointerId })); });
  window.addEventListener('resize', () => { rect = canvas.getBoundingClientRect(); });

  return {
    input,
    // 毎フレームの最初に呼ぶ
    frame(dt) {
      time += dt;
      if (!ptr || !ptr.handle) idle += dt;
      input.time = time;
      input.idle = idle;
      input.hintLevel = ptr && ptr.handle ? 0 : idle >= HINT_STRONG ? 2 : idle >= HINT_DELAY ? 1 : 0;
      const pa = input.pointer;
      pa.active = !!ptr;
      if (ptr) {
        pa.x = ptr.x; pa.y = ptr.y;
        setRay(ptr.x, ptr.y);
        pa.ndcX = ndc.x; pa.ndcY = ndc.y;
        input.ray.origin.copy(raycaster.ray.origin);
        input.ray.direction.copy(raycaster.ray.direction);
      }
      if (ptr && ptr.handle) {
        grab.ddx = fdx; grab.ddy = fdy; grab.dx += fdx; grab.dy += fdy;
        grab.vx = ptr.vx; grab.vy = ptr.vy;
        grab.duration = time - ptr.t0;
        grab.justStarted = justStarted;
        input.grab = grab;
      } else input.grab = null;
      justStarted = false;
      fdx = fdy = 0;
      return input;
    },
    // hero.update の後に呼ぶ（このフレームの出来事を消す）
    endFrame() { taps.length = 0; released.length = 0; },
    setIdle(v) { idle = v; },
    get grabbing() { return !!(ptr && ptr.handle); },
    cancel() { ptr = null; },
  };
}
