// Camera rig: fixed yaw (looking toward -z), pitch below horizontal, fits a Box3 into the safe viewport.
import * as THREE from 'three';

const PAD = 0.05; // fraction of the safe viewport kept free around the framed box
const DEG = Math.PI / 180;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createCameraRig(G) {
  const camera = G.camera;
  camera.near = 5;
  camera.far = 600;

  const view = { w: 1, h: 1, margin: { top: 0, right: 0, bottom: 0, left: 0 } };
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const tq = new THREE.Quaternion();
  const tv = new THREE.Vector3();
  const tv2 = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // pose = {pos, quat, fov}
  const from = { pos: new THREE.Vector3(0, 60, 60), quat: new THREE.Quaternion(), fov: 38 };
  const to = { pos: new THREE.Vector3(0, 60, 60), quat: new THREE.Quaternion(), fov: 38 };
  const cur = { pos: new THREE.Vector3(0, 60, 60), quat: new THREE.Quaternion(), fov: 38 };
  let tr = 1; // transition progress
  let trDur = 1;
  let hasPose = false;

  let box = null; // Box3 being framed
  let boxKey = null; // name in G.layout.frames if the box came from there (re-resolved on layout change)
  let opts = {};

  const focus = { target: new THREE.Vector3(), amount: 0, cur: new THREE.Vector3() };
  const shake = { amp: 0, t: 0, off: new THREE.Vector3() };

  const rig = {
    camera,
    center: new THREE.Vector3(0, 0, 0),
    box: null,
    frame,
    focusOffset(vec, amount = 0.25) {
      if (!vec || !amount) {
        focus.amount = 0;
        return;
      }
      focus.target.copy(vec);
      focus.amount = Math.max(0, Math.min(1, amount));
    },
    shake(amount = 0.4) {
      shake.amp = Math.min(3, Math.max(shake.amp, amount));
    },
    worldToScreen(v, out = { x: 0, y: 0 }) {
      tv.copy(v).project(camera);
      out.x = (tv.x * 0.5 + 0.5) * view.w;
      out.y = (-tv.y * 0.5 + 0.5) * view.h;
      return out;
    },
    resize(w, h, margin) {
      view.w = Math.max(1, w);
      view.h = Math.max(1, h);
      if (margin) Object.assign(view.margin, margin);
      camera.aspect = view.w / view.h;
      camera.updateProjectionMatrix();
      // re-fit immediately with the current box (resolved from the new layout if possible)
      if (box) {
        if (boxKey && G.layout && G.layout.frames && G.layout.frames[boxKey]) box = G.layout.frames[boxKey];
        solve(box, opts, to);
        if (tr >= 1 || !hasPose) {
          copyPose(cur, to);
          copyPose(from, to);
          tr = 1;
        }
        rig.box = box;
        box.getCenter(rig.center);
      }
      apply();
    },
    update(dt) {
      if (tr < 1) {
        tr = Math.min(1, tr + dt / trDur);
        const k = ease(tr);
        cur.pos.lerpVectors(from.pos, to.pos, k);
        cur.quat.slerpQuaternions(from.quat, to.quat, k);
        cur.fov = from.fov + (to.fov - from.fov) * k;
      }
      // eased look offset (translation toward the target, projected on the ground plane)
      const goal = tv2.set(0, 0, 0);
      if (focus.amount > 0) {
        goal.subVectors(focus.target, rig.center).multiplyScalar(focus.amount);
        goal.y = 0;
      }
      focus.cur.lerp(goal, 1 - Math.exp(-dt * 2.5));
      // shake: decaying jitter
      if (shake.amp > 0.002) {
        shake.t += dt;
        const a = shake.amp;
        shake.off.set(
          Math.sin(shake.t * 71) * a * 0.5,
          Math.sin(shake.t * 53 + 1) * a * 0.35,
          Math.sin(shake.t * 61 + 2) * a * 0.3
        );
        shake.amp *= Math.exp(-dt / 0.09);
      } else {
        shake.amp = 0;
        shake.off.set(0, 0, 0);
      }
      apply();
    },
  };

  function copyPose(a, b) {
    a.pos.copy(b.pos);
    a.quat.copy(b.quat);
    a.fov = b.fov;
  }

  function apply() {
    camera.position.copy(cur.pos).add(focus.cur).add(shake.off);
    camera.quaternion.copy(cur.quat);
    if (Math.abs(camera.fov - cur.fov) > 1e-4) {
      camera.fov = cur.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }

  // compute the pose that fits `b` into the safe viewport
  function solve(b, o, out) {
    const L = G.layout || {};
    const pitch = (o.pitch != null ? o.pitch : L.camPitch != null ? L.camPitch : 55) * DEG;
    const fov = o.fov != null ? o.fov : L.camFov != null ? L.camFov : 38;
    euler.set(-pitch, 0, 0, 'YXZ');
    tq.setFromEuler(euler);
    right.set(1, 0, 0).applyQuaternion(tq);
    up.set(0, 1, 0).applyQuaternion(tq);
    fwd.set(0, 0, -1).applyQuaternion(tq);

    const ty = Math.tan((fov * DEG) / 2);
    const tx = ty * (view.w / view.h);
    const m = view.margin;
    // safe rect in ndc, padded
    const sw = Math.max(0.1, view.w - m.left - m.right);
    const sh = Math.max(0.1, view.h - m.top - m.bottom);
    const x0 = -1 + (2 * (m.left + sw * PAD)) / view.w;
    const x1 = -1 + (2 * (m.left + sw * (1 - PAD))) / view.w;
    const y0 = 1 - (2 * (m.top + sh * (1 - PAD))) / view.h; // bottom
    const y1 = 1 - (2 * (m.top + sh * PAD)) / view.h; // top
    const cxT = (x0 + x1) / 2;
    const cyT = (y0 + y1) / 2;

    const c = b.getCenter(new THREE.Vector3());
    const mn = b.min;
    const mx = b.max;
    for (let i = 0; i < 8; i++) corners[i].set(i & 1 ? mx.x : mn.x, i & 2 ? mx.y : mn.y, i & 4 ? mx.z : mn.z);

    // camera-space coords of corner relative to the centre: (r, u, f) components
    const rel = corners.map((p) => {
      tv.subVectors(p, c);
      return [tv.dot(right), tv.dot(up), tv.dot(fwd)];
    });

    // for distance d and lateral shift (sx, sy): ndc of corner
    const bounds = (d, sx, sy, res) => {
      let ax = Infinity;
      let bx = -Infinity;
      let ay = Infinity;
      let by = -Infinity;
      for (const [r, u, f] of rel) {
        const z = d + f;
        if (z < camera.near + 0.5) return false;
        const nx = (r - sx) / (z * tx);
        const ny = (u - sy) / (z * ty);
        ax = Math.min(ax, nx);
        bx = Math.max(bx, nx);
        ay = Math.min(ay, ny);
        by = Math.max(by, ny);
      }
      res[0] = ax;
      res[1] = bx;
      res[2] = ay;
      res[3] = by;
      return true;
    };
    const res = [0, 0, 0, 0];
    const fitAt = (d, shift) => {
      let sx = 0;
      let sy = 0;
      for (let it = 0; it < 4; it++) {
        if (!bounds(d, sx, sy, res)) return false;
        // shift so the projected box centre lands on the safe-rect centre
        sx += (((res[0] + res[1]) / 2 - cxT) * d * tx);
        sy += (((res[2] + res[3]) / 2 - cyT) * d * ty);
      }
      if (!bounds(d, sx, sy, res)) return false;
      shift[0] = sx;
      shift[1] = sy;
      return res[1] - res[0] <= x1 - x0 + 1e-4 && res[3] - res[2] <= y1 - y0 + 1e-4;
    };
    const shift = [0, 0];
    let lo = 1;
    let hi = 2000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fitAt(mid, shift)) hi = mid;
      else lo = mid;
    }
    fitAt(hi, shift);
    out.pos.copy(c).addScaledVector(fwd, -hi).addScaledVector(right, shift[0]).addScaledVector(up, shift[1]);
    out.quat.copy(tq);
    out.fov = fov;
  }

  function frame(b, o = {}) {
    if (typeof b === 'string') {
      boxKey = b;
      b = G.layout && G.layout.frames ? G.layout.frames[b] : null;
    } else {
      boxKey = null;
      const fr = G.layout && G.layout.frames;
      if (fr) for (const k in fr) if (fr[k] === b) boxKey = k;
    }
    if (!b || !b.isBox3) return;
    box = b;
    opts = o || {};
    rig.box = b;
    b.getCenter(rig.center);
    solve(b, opts, to);
    const dur = opts.dur != null ? opts.dur : 1.2;
    if (!hasPose || dur <= 0) {
      copyPose(cur, to);
      copyPose(from, to);
      tr = 1;
      hasPose = true;
      apply();
      return;
    }
    copyPose(from, cur);
    tr = 0;
    trDur = dur;
  }

  return rig;
}
