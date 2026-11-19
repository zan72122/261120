// Phase 'sprinkle': small dish of green onion / tenkasu / red ginger. Held over the plate, bits rain down.
import * as THREE from 'three';
import { RIM_Y, BALL_COUNT, holeCenter } from '../config.js';
import { canon, serpentineOrder, nearestBall } from './common.js';

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const KINDS = ['negi', 'negi', 'tenkasu', 'beni'];
const NEED = 5;
const RATE = 40;
const SPREAD = 2.3;
const HOLD_H = 6.5;
const SAFETY = 320;
const BUDGET = 420; // dish level reaches its minimum here

const centres = Array.from({ length: BALL_COUNT }, (_, i) => holeCenter(i, new THREE.Vector3()));
const _q = new THREE.Quaternion();
const _qt = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _v = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _src = new THREE.Vector3();
const restOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const heldOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

const S = {
  emitted: 0,
  acc: 0,
  tickT: 0,
  countT: 0,
  counts: new Int16Array(BALL_COUNT),
  done: false,
  doneT: 0,
  safety: false,
  steamT: 0,
  tapT: -9,
  tapPos: new THREE.Vector3(),
};

function countAll(G) {
  for (const b of G.balls) {
    S.counts[b.index] = G.bits.countOn(b, 'negi') + G.bits.countOn(b, 'tenkasu') + G.bits.countOn(b, 'beni');
  }
}

const lacking = (b) => S.counts[b.index] < NEED;

function emitAt(G, src, bias) {
  const kind = KINDS[(Math.random() * KINDS.length) | 0];
  const a = Math.random() * Math.PI * 2;
  let r;
  _v.copy(src);
  if (bias && Math.random() < 0.6) {
    const c = centres[bias.index];
    r = Math.sqrt(Math.random()) * 1.3;
    _v.x = c.x + Math.cos(a) * r;
    _v.z = c.z + Math.sin(a) * r;
  } else {
    r = Math.sqrt(Math.random()) * SPREAD;
    _v.x += Math.cos(a) * r;
    _v.z += Math.sin(a) * r;
  }
  _v.y -= Math.random() * 0.8;
  _vel.set((Math.random() - 0.5) * 2, -2 - Math.random() * 4, (Math.random() - 0.5) * 2);
  if (G.bits.emit(kind, _v, _vel) >= 0) S.emitted++;
}

// the clumsy-child safety net: place bits straight onto the balls still lacking
function placeMissing(G) {
  for (const b of G.balls) {
    const c = centres[b.index];
    for (let k = S.counts[b.index]; k < NEED; k++) {
      const a = Math.random() * 6.283;
      const d = Math.sqrt(Math.random()) * 1.4;
      _v.set(c.x + Math.cos(a) * d, RIM_Y + 0.15, c.z + Math.sin(a) * d);
      const top = b.topPointAt(_v.x, _v.z, _src);
      if (top) _v.y = top.y;
      G.bits.place(KINDS[k % KINDS.length], _v, UP, b);
    }
  }
}

export default {
  id: 'sprinkle',
  enter(G) {
    S.emitted = 0;
    S.acc = 0;
    S.done = false;
    S.doneT = 0;
    S.safety = false;
    S.countT = 0;
    S.tapT = -9;
    countAll(G);
    G.cam.frame('cook');
    const dish = G.world.props.toppingDish;
    dish.setLevel(1);
    G.tools.define('toppingDish', {
      object: dish,
      rest() {
        restOut.pos.copy(G.layout.toolRest);
        restOut.quat.setFromAxisAngle(UP, 0.6);
        return restOut;
      },
      held(target, t) {
        // tilted toward the plate (far/left rim down), with a little shake while it works
        const sh = Math.sin((t.time || 0) * 31) * 0.05;
        _q.setFromAxisAngle(UP, 0.6);
        _qt.setFromAxisAngle(Z, 0.42 + sh);
        heldOut.quat.copy(_q).multiply(_qt).multiply(_qt.setFromAxisAngle(X, -0.18));
        _a.copy(dish.userData.action).applyQuaternion(heldOut.quat);
        heldOut.pos.set(target.x + 1.2, RIM_Y + HOLD_H, target.z - 0.8).sub(_a);
        return heldOut;
      },
    });
    G.tools.bring('toppingDish');
    G.hints.set({
      tool: 'toppingDish',
      targets: () => {
        const out = [];
        for (const b of G.balls) if (lacking(b)) out.push(centres[b.index]);
        return out;
      },
      demo: () => {
        const ord = serpentineOrder(G.balls.filter(lacking).map((b) => b.index));
        return ord.slice(0, 6).map((i) => centres[i]);
      },
    });
  },

  update(G, dt) {
    const T = G.tools;
    const working = !S.done && T.active === 'toppingDish' && T.held && T.arrived > 0.6;
    if (working) {
      // emit around the finger target, from the dish height
      T.actionPoint(_src);
      _src.x = T.target.x;
      _src.z = T.target.z;
      const bias = nearestBall(G, T.target, lacking, 6);
      S.acc += RATE * dt;
      let n = 0;
      while (S.acc >= 1 && n < 6) {
        S.acc -= 1;
        n++;
        emitAt(G, _src, bias);
      }
      if (S.acc > 3) S.acc = 3;
      S.tickT -= dt;
      if (S.tickT < 0) {
        S.tickT = 1 / 12;
        G.audio.play('sprinkle', { vol: 0.45 + Math.random() * 0.2, pitch: 0.9 + Math.random() * 0.25, pan: T.target.x / 12 });
      }
      G.world.props.toppingDish.setLevel(Math.max(0.15, 1 - S.emitted / BUDGET));
    } else S.acc = 0;

    S.countT -= dt;
    if (S.countT < 0) {
      S.countT = 0.2;
      const before = S.counts.reduce((a, b) => a + Math.min(NEED, b), 0);
      countAll(G);
      const after = S.counts.reduce((a, b) => a + Math.min(NEED, b), 0);
      if (after > before) G.hints.poke();
      if (!S.safety && S.emitted >= SAFETY) {
        S.safety = true;
        placeMissing(G);
        countAll(G);
      }
      if (!S.done && G.balls.every((b) => !lacking(b))) {
        S.done = true;
        S.doneT = 0;
        G.hints.set(null);
      }
    }

    G.audio.setSizzle(0.45);
    S.steamT -= dt;
    if (S.steamT < 0) {
      S.steamT = 0.6 + Math.random() * 0.6;
      const c = centres[(Math.random() * BALL_COUNT) | 0];
      G.fx.steam(_v.copy(c).setY(RIM_Y + 0.3), { count: 1, spread: 1, rise: 4, size: 1.8, life: 1.3 });
    }

    if (S.done) {
      S.doneT += dt;
      // let the last bits land first
      if (S.doneT > 0.6 && T.active === 'toppingDish') {
        T.dismiss('toppingDish');
        G.flow.complete();
      }
    }
  },

  exit(G) {
    G.audio.setSizzle(0);
  },
  onDown(G, p) {
    S.tapT = G.time;
    S.tapPos.copy(p.world);
  },
  onMove() {},
  onUp(G) {
    // a quick tap still rains a pinch where it touched
    if (G.tools.active !== 'toppingDish' || S.done || G.time - S.tapT > 0.3) return;
    const bias = nearestBall(G, S.tapPos, lacking, 6);
    _src.set(S.tapPos.x, RIM_Y + HOLD_H - 1, S.tapPos.z);
    for (let k = 0; k < 14; k++) emitAt(G, _src, bias);
    G.audio.play('sprinkle', { vol: 0.6, pitch: 1 });
  },
  fastForward(G) {
    canon.sprinkled(G);
  },
  reset() {
    S.done = false;
    S.emitted = 0;
  },
};
