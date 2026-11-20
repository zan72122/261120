// カメラの定位置（HERO-SPEC §2）。指では動かない。hero の要求でゆっくり移るだけ。
import THREE from './three.js';

export const FOV = 40;
export const VIEWS = {
  all:  { target: [0, 4.1, -0.6], w: 10.0, h: 9.4, pitch: 7 },
  low:  { target: [0, 2.0, -0.6], w: 6.4, h: 4.4, pitch: 4 },
  high: { target: [0, 5.0, -0.6], w: 6.4, h: 4.4, pitch: 4 },
};
const MOVE_SECONDS = 2.5;
const MIN_INTERVAL = 4.0;
// 全景（all）へ戻るのは、いまの移動が終わりしだい（4 秒待たない）。寄った後に操作部が早く画面へ戻るように。
const canGoNow = (name, sinceMove, t) => t >= 1 && (sinceMove >= MIN_INTERVAL || name === 'all');

function poseFor(name, aspect) {
  const v = VIEWS[name];
  const tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  // 箱（幅 w × 高さ h）が必ず収まる距離。手前（z>0）に出る物のぶん少し余裕を持つ。
  const d = Math.max(v.h / 2 / tanH, v.w / 2 / (tanH * aspect)) * 1.06 + 0.4;
  const p = THREE.MathUtils.degToRad(v.pitch);
  const target = new THREE.Vector3(...v.target);
  const pos = new THREE.Vector3(0, Math.sin(p) * d, Math.cos(p) * d).add(target);
  return { pos, target };
}

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function createCameraRig(aspect) {
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 800);
  let current = 'all';
  let from = null, to = poseFor('all', aspect), t = 1, sinceMove = 1e9, queued = null;
  const curPos = to.pos.clone(), curTarget = to.target.clone();
  camera.position.copy(curPos);
  camera.lookAt(curTarget);

  function start(name) {
    from = { pos: curPos.clone(), target: curTarget.clone() };
    to = poseFor(name, camera.aspect);
    current = name; t = 0; sinceMove = 0;
  }
  return {
    camera,
    get view() { return current; },
    request(name, { immediate = false } = {}) {
      if (!VIEWS[name]) return false;
      if (immediate) {
        current = name; to = poseFor(name, camera.aspect); t = 1; queued = null;
        curPos.copy(to.pos); curTarget.copy(to.target);
        return true;
      }
      if (name === current && !queued) return true;
      if (!canGoNow(name, sinceMove, t)) { queued = name; return true; }
      queued = null;
      if (name !== current) start(name);
      return true;
    },
    setAspect(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      to = poseFor(current, aspect);
      if (t >= 1) { curPos.copy(to.pos); curTarget.copy(to.target); }
    },
    update(dt) {
      sinceMove += dt;
      if (queued && canGoNow(queued, sinceMove, t)) { const q = queued; queued = null; if (q !== current) start(q); }
      if (t < 1) {
        t = Math.min(1, t + dt / MOVE_SECONDS);
        const k = ease(t);
        curPos.lerpVectors(from.pos, to.pos, k);
        curTarget.lerpVectors(from.target, to.target, k);
      }
      camera.position.copy(curPos);
      camera.lookAt(curTarget);
    },
    get moving() { return t < 1; },
  };
}
