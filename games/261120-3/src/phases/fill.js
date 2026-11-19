// Phase 'fill': bowl of cut octopus (+ cheese, sausage). Passing over a hole drops one piece in.
import * as THREE from 'three';
import { RIM_Y, BALL_COUNT, holeCenter } from '../config.js';
import { canon, planFillings, serpentineOrder, nearestBall } from './common.js';

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const YAW = 0.5;
const TILT = (24 * Math.PI) / 180;
const HOLD_H = 5.5; // rim height above the rim plane while held
const REACH = 3.2;
const HOP = 0.28;
const GAP = 0.13;
const SLOT_ORDER = [0, 1, 2, 3, 4, 5, 6, 15, 16, 17, 18, 19]; // a compact heap (lifted ones on top)

const centres = Array.from({ length: BALL_COUNT }, (_, i) => holeCenter(i, new THREE.Vector3()));
const _q = new THREE.Quaternion();
const _qt = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _v = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const restOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const heldOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

const S = {
  pieces: [], // { obj, kind, used }
  flying: [], // { obj, kind, ball, from, t, spinAxis }
  pending: new Set(), // hole indices with a piece on the way
  lastDrop: -9,
  downBall: null,
  dropped: false,
  done: false,
  doneT: 0,
  steamT: 0,
};

function disposePiece(obj) {
  if (!obj) return;
  if (obj.parent) obj.parent.remove(obj);
  const mats = obj.userData && obj.userData.mats;
  if (mats) for (const m of mats) m.dispose?.();
}

function clearPieces() {
  for (const p of S.pieces) disposePiece(p.obj);
  for (const f of S.flying) disposePiece(f.obj);
  S.pieces.length = 0;
  S.flying.length = 0;
  S.pending.clear();
}

function needs(b) {
  return b.mode === 'hole' && !b.filling && !S.pending.has(b.index);
}

function fillPieces(G) {
  clearPieces();
  const bowl = G.world.props.fillBowl;
  const slots = bowl.userData.slots;
  const yaws = bowl.userData.slotYaws || [];
  const plan = planFillings(G);
  // only pieces for holes that still need one
  const kinds = [];
  for (const b of G.balls) if (!b.filling) kinds.push(plan[b.index]);
  for (let k = 0; k < kinds.length; k++) {
    const si = SLOT_ORDER[k] != null && slots[SLOT_ORDER[k]] ? SLOT_ORDER[k] : k % slots.length;
    const obj = G.tako.makeFilling(kinds[k]);
    obj.position.copy(slots[si]);
    obj.rotation.set((Math.random() - 0.5) * 0.8, yaws[si] || Math.random() * 6.28, (Math.random() - 0.5) * 0.8);
    bowl.add(obj);
    S.pieces.push({ obj, kind: kinds[k], used: false, y: slots[si].y });
  }
}

// pick the topmost unused piece of this kind (else any)
function takePiece(kind) {
  let best = null;
  for (const p of S.pieces) {
    if (p.used) continue;
    if (!best || (p.kind === kind && (best.kind !== kind || p.y > best.y)) || (best.kind !== kind && p.kind !== kind && p.y > best.y)) best = p;
  }
  if (best) best.used = true;
  return best;
}

function drop(G, ball) {
  if (!ball || !needs(ball)) return false;
  const plan = planFillings(G);
  const kind = plan[ball.index];
  const piece = takePiece(kind);
  S.pending.add(ball.index);
  S.lastDrop = G.time;
  let obj = piece ? piece.obj : null;
  const from = new THREE.Vector3();
  if (obj) {
    obj.getWorldPosition(from);
    G.scene.attach(obj);
  } else G.tools.actionPoint(from);
  S.flying.push({
    obj,
    kind,
    ball,
    from,
    t: 0,
    axis: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
  });
  G.audio.play('pick', { vol: 0.35, pitch: 1.4 });
  return true;
}

function land(G, f) {
  disposePiece(f.obj);
  S.pending.delete(f.ball.index);
  f.ball.setFilling(f.kind);
  const c = centres[f.ball.index];
  _v.set(c.x, RIM_Y + f.ball.level() + 0.1, c.z);
  G.audio.play('plop', { vol: 0.9, pitch: 0.86 + 0.035 * f.ball.index + Math.random() * 0.04, pan: c.x / 12 });
  G.fx.splash(_v, { color: 0xe6cf98, count: 4, power: 0.45, size: 0.8 });
  G.hints.poke();
}

function holeNear(G, pos) {
  return nearestBall(G, pos, needs, REACH);
}

export default {
  id: 'fill',
  enter(G) {
    S.lastDrop = -9;
    S.downBall = null;
    S.dropped = false;
    S.done = false;
    S.doneT = 0;
    G.cam.frame('cook');
    planFillings(G);
    const bowl = G.world.props.fillBowl;
    fillPieces(G);
    G.tools.define('fillBowl', {
      object: bowl,
      rest() {
        restOut.pos.copy(G.layout.toolRest);
        restOut.quat.setFromAxisAngle(UP, 0.4);
        return restOut;
      },
      held(target) {
        _tgt.copy(target);
        _q.setFromAxisAngle(UP, YAW);
        _qt.setFromAxisAngle(Z, TILT);
        heldOut.quat.copy(_q).multiply(_qt);
        _a.copy(bowl.userData.action).applyQuaternion(heldOut.quat);
        heldOut.pos.set(_tgt.x, RIM_Y + HOLD_H, _tgt.z).sub(_a);
        return heldOut;
      },
    });
    G.tools.bring('fillBowl');
    G.hints.set({
      tool: 'fillBowl',
      targets: () => {
        const out = [];
        for (const b of G.balls) if (needs(b)) out.push(centres[b.index]);
        return out;
      },
      demo: () => {
        const ord = serpentineOrder(G.balls.filter(needs).map((b) => b.index));
        return ord.slice(0, 5).map((i) => centres[i]);
      },
    });
  },

  update(G, dt) {
    const T = G.tools;
    // drop while passing over holes
    if (!S.done && T.active === 'fillBowl' && T.held && T.arrived > 0.6 && G.time - S.lastDrop > GAP) {
      if (drop(G, holeNear(G, T.target))) S.dropped = true;
    }
    // pieces in flight
    for (let i = S.flying.length - 1; i >= 0; i--) {
      const f = S.flying[i];
      f.t += dt / HOP;
      const c = centres[f.ball.index];
      const e = Math.min(1, f.t);
      if (f.obj) {
        const ty = RIM_Y + f.ball.level() + 0.15;
        f.obj.position.lerpVectors(f.from, _v.set(c.x, ty, c.z), e);
        f.obj.position.y += 2.2 * 4 * e * (1 - e);
        f.obj.rotateOnWorldAxis(f.axis, dt * 9);
      }
      if (f.t >= 1) {
        S.flying.splice(i, 1);
        land(G, f);
      }
    }
    G.audio.setSizzle(0.45);
    S.steamT -= dt;
    if (S.steamT < 0) {
      S.steamT = 0.6 + Math.random() * 0.6;
      const c = centres[(Math.random() * BALL_COUNT) | 0];
      G.fx.steam(_v.copy(c).setY(RIM_Y + 0.3), { count: 1, spread: 1, rise: 4, size: 1.8, life: 1.3 });
    }

    if (!S.done && S.flying.length === 0 && G.balls.every((b) => b.filling || b.mode !== 'hole')) {
      S.done = true;
      S.doneT = 0;
      G.hints.set(null);
    }
    if (S.done) {
      S.doneT += dt;
      if (S.doneT > 0.3 && T.active === 'fillBowl') {
        T.dismiss('fillBowl');
        G.flow.complete();
      }
    }
  },

  exit(G) {
    G.audio.setSizzle(0);
    // anything left in the air lands now
    for (const f of S.flying.splice(0)) land(G, f);
  },

  onDown(G, p) {
    S.dropped = false;
    S.downBall = holeNear(G, p.world);
  },
  onMove() {},
  onUp(G) {
    // a quick tap on a hole: drop there even if the bowl never arrived
    if (!S.dropped && S.downBall && !S.done) drop(G, S.downBall);
    S.downBall = null;
  },
  fastForward(G) {
    canon.filled(G);
  },
  reset() {
    clearPieces();
    S.done = false;
  },
};
