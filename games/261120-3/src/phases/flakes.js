// Phase 'flakes': a wooden bowl of katsuobushi (+ aonori). Held over the balls, it is tipped and flakes flutter
// down, land and dance in the heat of the balls.
import * as THREE from 'three';
import { canon, dressBalls, dressHit, ballTopY, platterTopY, syncPlatter, keepWarm, clampToPlatter, serpentineOrder, nearestBall } from './common.js';

const FLAKE_RATE = 24;
const NORI_RATE = 30;
const NEED = 5;
const NEED_TOTAL = 80;
const UP = new THREE.Vector3(0, 1, 0);

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const E = new THREE.Vector3(); // where flakes leave the bowl rim
const em = new THREE.Vector3();
const vel = new THREE.Vector3();
const cTmp = new THREE.Vector3();
const nrm = new THREE.Vector3();
const restPos = new THREE.Vector3();
const restQuat = new THREE.Quaternion();
const heldPos = new THREE.Vector3();
const heldQuat = new THREE.Quaternion();
const qTmp = new THREE.Quaternion();
const axis = new THREE.Vector3();
const u = new THREE.Vector3();
const rim = new THREE.Vector3();
const eul = new THREE.Euler();
const tgtPts = Array.from({ length: 12 }, () => new THREE.Vector3());
const demoPts = Array.from({ length: 6 }, () => new THREE.Vector3());
const list = [];

const S = {
  flakes: new Uint16Array(12),
  nori: new Uint16Array(12),
  sum: 0,
  accF: 0,
  accN: 0,
  emitted: 0,
  countT: 0,
  flutT: 0,
  distT: 0,
  tilt: 0,
  done: -1,
};

function emitPoint(G, target, out) {
  clampToPlatter(G, v1.copy(target), 2.2);
  const h = dressHit(G, v1);
  clampToPlatter(G, out.copy(h.point), 3.4);
  out.y = platterTopY(G) + 9.5;
  return out;
}

function bowlHeld(G, target, t) {
  emitPoint(G, target, E);
  // tipped toward the finger; the bowl body stays up-screen / right so it does not hide the balls below
  u.set(-0.72, 0, 0.7).normalize();
  const tilt = 0.12 + 0.55 * S.tilt;
  axis.crossVectors(UP, u).normalize();
  heldQuat.setFromAxisAngle(axis, tilt);
  // a slow shake while pouring
  if (S.tilt > 0.5) {
    eul.set(Math.sin((t ? t.time : 0) * 21) * 0.025, 0, Math.sin((t ? t.time : 0) * 17 + 1) * 0.025);
    heldQuat.multiply(qTmp.setFromEuler(eul));
  }
  rim.set(u.x * 5.4, 4.3, u.z * 5.4).applyQuaternion(heldQuat);
  heldPos.copy(E).sub(rim);
  return { pos: heldPos, quat: heldQuat };
}

function needyIdx(G) {
  const out = [];
  for (const b of dressBalls(G, list)) if (S.flakes[b.index] < NEED) out.push(b.index);
  return serpentineOrder(out);
}

function placeOn(G, b, kind) {
  const R = G.cfg.BALL_R;
  b.mesh.getWorldPosition(cTmp);
  const a = Math.random() * Math.PI * 2;
  const th = Math.sqrt(Math.random()) * 0.9;
  nrm.set(Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th));
  v2.copy(nrm).multiplyScalar(R).add(cTmp);
  const tp = b.topPointAt(v2.x, v2.z, v1);
  if (tp) v2.y = tp.y;
  G.bits.place(kind, v2, nrm, b);
}

export default {
  id: 'flakes',

  enter(G) {
    S.flakes.fill(0);
    S.nori.fill(0);
    S.sum = 0;
    S.accF = S.accN = 0;
    S.emitted = 0;
    S.countT = 0;
    S.tilt = 0;
    S.done = -1;
    const W = G.world.props;
    syncPlatter(G);
    G.cam.frame('dress');
    W.flakeBowl.setLevel(1);
    G.tools.define('flakeBowl', {
      object: W.flakeBowl,
      rest: () => {
        restPos.copy(G.layout.dressRest);
        restQuat.setFromAxisAngle(UP, 0.4);
        return { pos: restPos, quat: restQuat };
      },
      held: (target, t) => bowlHeld(G, target, t),
      workWhile: () => S.tilt > 0.5,
    });
    G.tools.bring('flakeBowl');
    G.input.planeY = ballTopY(G);
    G.hints.set({
      tool: 'flakeBowl',
      targets: () => {
        const n = needyIdx(G);
        const out = [];
        for (let k = 0; k < n.length && k < 12; k++) {
          G.balls[n[k]].mesh.getWorldPosition(tgtPts[k]);
          tgtPts[k].y += G.cfg.BALL_R;
          out.push(tgtPts[k]);
        }
        return out;
      },
      demo: () => {
        const n = needyIdx(G);
        if (!n.length) return null;
        G.balls[n[0]].mesh.getWorldPosition(v2);
        const y = ballTopY(G);
        // a slow little wave over the ball (hold it there)
        const xs = [-2, 1.5, -1.5, 2, 0];
        const zs = [-1, -0.5, 0.5, 1, 0];
        for (let k = 0; k < 5; k++) demoPts[k].set(v2.x + xs[k], y, v2.z + zs[k]);
        return demoPts.slice(0, 5);
      },
    });
  },

  update(G, dt) {
    syncPlatter(G);
    keepWarm(G, 0.7);
    const W = G.world.props;
    const T = G.tools;
    const working = T.active === 'flakeBowl' && T.held && T.arrived > 0.6 && S.done < 0;
    S.tilt += ((working ? 1 : 0) - S.tilt) * Math.min(1, dt * 8);

    if (working && S.tilt > 0.5) {
      emitPoint(G, T.target, E);
      // flakes
      S.accF += dt * FLAKE_RATE;
      while (S.accF >= 1) {
        S.accF -= 1;
        em.copy(E);
        let b = null;
        if (Math.random() < 0.65) b = nearestBall(G, E, (x) => (x.mode === 'slot' || x.mode === 'free') && S.flakes[x.index] < NEED, 6.5);
        if (b) {
          b.mesh.getWorldPosition(cTmp);
          em.x = cTmp.x + (Math.random() - 0.5) * 1.6;
          em.z = cTmp.z + (Math.random() - 0.5) * 1.6;
          em.y = E.y - 1;
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * 2.2;
          em.x += Math.cos(a) * r;
          em.z += Math.sin(a) * r;
        }
        vel.set((Math.random() - 0.5) * 3, -2 - Math.random() * 3, (Math.random() - 0.5) * 3);
        if (G.bits.emit('flake', em, vel) >= 0) S.emitted++;
      }
      // aonori: finer, falls faster
      S.accN += dt * NORI_RATE;
      while (S.accN >= 1) {
        S.accN -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 2.6;
        em.set(E.x + Math.cos(a) * r, E.y - 0.5, E.z + Math.sin(a) * r);
        vel.set((Math.random() - 0.5) * 2, -6 - Math.random() * 4, (Math.random() - 0.5) * 2);
        G.bits.emit('aonori', em, vel);
      }
      S.flutT -= dt;
      if (S.flutT <= 0) {
        S.flutT = 0.3 + Math.random() * 0.15;
        G.audio.play('flutter', { vol: 0.55, pitch: 0.9 + Math.random() * 0.2 });
      }
      W.flakeBowl.setLevel(Math.max(0.25, 1 - S.emitted / 420));
      // the finger stirs the air: landed flakes near it flutter
      S.distT -= dt;
      if (S.distT <= 0 && G.input.pointer && G.input.pointer.speed > 12) {
        S.distT = 0.25;
        G.bits.disturb(dressHit(G, v1.copy(T.target)).point, 2.2);
      }
    }

    // count landed flakes
    S.countT -= dt;
    if (S.countT <= 0 && S.done < 0) {
      S.countT = 0.2;
      let sum = 0;
      let allOk = true;
      const balls = dressBalls(G, list);
      for (const b of balls) {
        const n = G.bits.countOn(b, 'flake');
        if (n >= NEED && S.flakes[b.index] < NEED) G.hints.poke();
        S.flakes[b.index] = n;
        S.nori[b.index] = G.bits.countOn(b, 'aonori');
        sum += n;
        if (n < NEED) allOk = false;
      }
      S.sum = sum;
      // safety for clumsy pouring: after plenty of flakes, top up the balls still lacking
      if ((!allOk || sum < NEED_TOTAL) && S.emitted > 380) {
        for (const b of balls) for (let k = S.flakes[b.index]; k < NEED; k++) placeOn(G, b, 'flake');
        allOk = true;
        sum = Math.max(sum, NEED_TOTAL);
      }
      if (allOk && sum >= NEED_TOTAL && balls.length) {
        for (const b of balls) for (let k = S.nori[b.index]; k < 6; k++) placeOn(G, b, 'aonori');
        S.done = 0;
        G.audio.play('allDone', { vol: 0.7 });
      }
    }
    if (S.done >= 0) {
      S.done += dt;
      if (S.done > 0.7 && T.active === 'flakeBowl') T.dismiss('flakeBowl');
      if (S.done > 1.4) G.flow.complete();
    }
  },

  exit() {},
  onDown() {},
  onMove() {},
  onUp() {},
  fastForward(G) {
    canon.flaked(G);
  },
  reset() {
    S.done = -1;
  },
};
