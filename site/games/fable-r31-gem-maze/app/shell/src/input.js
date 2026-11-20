import { THREE } from './three.js';

// 1 本指の入力。hero には HERO-SPEC §3.1 の input オブジェクトを毎フレーム渡す。
// 5 歳の指は「ゆっくり押して離す」「押している間に少しずれる」ことが多いので、タップの判定は大人向けより広め。
const TAP_TIME = 0.8, TAP_DIST = 18;

export class Input {
  constructor(canvas, { onPress, onEmptyTap } = {}) {
    this.canvas = canvas;
    this.onPress = onPress || (() => {});
    this.onEmptyTap = onEmptyTap || (() => {});
    this.raycaster = new THREE.Raycaster();
    this.camera = null;
    this.getTargets = () => [];
    this.pointerId = null;
    this.lastActivity = 0;
    this.clock = 0;
    this.hasGrabbed = false; // 一度でも操作部をつかんだか（指の絵の待ち時間に使う）
    this.pending = { pressedId: null, releasedId: null, tapId: null, dx: 0, dy: 0 };
    this.press = null; // {x, y, time, hit}
    this.state = {
      time: 0, idle: 0,
      pointer: { down: false, x: 0, y: 0, ndc: new THREE.Vector2(), ray: new THREE.Ray() },
      grab: null,
      dragDX: 0, dragDY: 0, totalDX: 0, totalDY: 0,
      pressedId: null, releasedId: null, tapId: null,
      camera: null,
      viewport: { width: 1, height: 1, pxPerUnit: 1 },
    };
    this._ndc = new THREE.Vector2();

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this._down(e), opts);
    canvas.addEventListener('pointermove', (e) => this._move(e), opts);
    canvas.addEventListener('pointerup', (e) => this._up(e, false), opts);
    canvas.addEventListener('pointercancel', (e) => this._up(e, true), opts);
    canvas.addEventListener('lostpointercapture', (e) => { if (e.pointerId === this.pointerId) this._up(e, true); });
    // ピンチ・長押しメニュー・スクロールを止める
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'contextmenu', 'dblclick']) {
      canvas.addEventListener(ev, (e) => e.preventDefault(), opts);
    }
  }

  resetIdle() { this.lastActivity = this.clock; }

  _xy(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width || 1, h: r.height || 1 };
  }

  _pick(x, y, w, h) {
    if (!this.camera) return null;
    this._ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
    this.raycaster.setFromCamera(this._ndc, this.camera);
    let targets;
    try { targets = this.getTargets() || []; } catch (e) { targets = []; }
    const list = targets.filter((o) => o && enabled(o));
    if (!list.length) return null;
    const hits = this.raycaster.intersectObjects(list, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !(o.userData && typeof o.userData.heroId === 'string')) o = o.parent;
      if (o && enabled(o)) return { id: o.userData.heroId, point: h.point.clone() };
    }
    return null;
  }

  _down(e) {
    e.preventDefault();
    if (this.pointerId !== null) return; // 2 本目以降は無視
    this.pointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const { x, y, w, h } = this._xy(e);
    const p = this.state.pointer;
    p.down = true; p.x = x; p.y = y;
    this.lastActivity = this.clock;
    const hit = this._pick(x, y, w, h);
    this.press = { x, y, time: this.clock, hit };
    if (hit) {
      this.hasGrabbed = true;
      this.state.grab = { id: hit.id, point: hit.point, startX: x, startY: y, startTime: this.clock };
      this.state.totalDX = 0; this.state.totalDY = 0;
      this.pending.pressedId = hit.id;
    }
    this.onPress(x, y, !!hit);
  }

  _move(e) {
    if (e.pointerId !== this.pointerId) {
      if (this.pointerId === null && e.pointerType === 'mouse') { const { x, y } = this._xy(e); this.state.pointer.x = x; this.state.pointer.y = y; }
      return;
    }
    e.preventDefault();
    const { x, y } = this._xy(e);
    const p = this.state.pointer;
    const dx = x - p.x, dy = y - p.y;
    p.x = x; p.y = y;
    this.lastActivity = this.clock;
    if (this.state.grab) {
      this.pending.dx += dx; this.pending.dy += dy;
      this.state.totalDX += dx; this.state.totalDY += dy;
    }
  }

  _up(e, cancelled) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    const p = this.state.pointer;
    p.down = false;
    this.lastActivity = this.clock;
    const pr = this.press; this.press = null;
    const isTap = !cancelled && pr && this.clock - pr.time <= TAP_TIME && Math.hypot(p.x - pr.x, p.y - pr.y) <= TAP_DIST;
    if (this.state.grab) {
      const id = this.state.grab.id;
      this.pending.releasedId = id;
      if (isTap) this.pending.tapId = id;
      this.state.grab = null;
    } else if (isTap) {
      this.onEmptyTap(p.x, p.y);
    }
  }

  // update の直前に呼ぶ。pending の一回きりの値を state に移す。
  // time と idle は実時間（フレームが遅れても指の絵が出るまでの秒数は変わらない）。
  beginFrame(realDt, camera, viewport) {
    this.clock += Math.min(realDt, 1);
    const s = this.state;
    s.time = this.clock;
    s.idle = Math.max(0, this.clock - this.lastActivity);
    s.camera = camera; this.camera = camera;
    s.viewport.width = viewport.width; s.viewport.height = viewport.height; s.viewport.pxPerUnit = viewport.pxPerUnit;
    s.pressedId = this.pending.pressedId; s.releasedId = this.pending.releasedId; s.tapId = this.pending.tapId;
    s.dragDX = this.pending.dx; s.dragDY = this.pending.dy;
    this.pending.pressedId = this.pending.releasedId = this.pending.tapId = null;
    this.pending.dx = this.pending.dy = 0;
    const p = s.pointer;
    p.ndc.set((p.x / Math.max(1, viewport.width)) * 2 - 1, -(p.y / Math.max(1, viewport.height)) * 2 + 1);
    this.raycaster.setFromCamera(p.ndc, camera);
    p.ray.copy(this.raycaster.ray);
    return s;
  }
}

function enabled(o) {
  for (let x = o; x; x = x.parent) if (x.userData && x.userData.heroEnabled === false) return false;
  return true;
}
