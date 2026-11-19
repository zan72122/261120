// Phase 'mayo': a soft squeeze bottle. Drag → a piped mayonnaise line is laid exactly along the finger's path
// (blob chain on the balls / the platter). When enough is on, the bottle sputters empty ("pusu-pusu").
import * as THREE from 'three';
import { canon, dressBalls, dressHit, ballTopY, syncPlatter, keepWarm, clampToPlatter, surfaceBelowXZ, serpentineOrder } from './common.js';

const SPACING = 0.26;
const NEED = 6; // blobs per ball
const UP = new THREE.Vector3(0, 1, 0);

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const land = new THREE.Vector3();
const last = new THREE.Vector3();
const q1 = new THREE.Vector3();
const nrm = new THREE.Vector3();
const cTmp = new THREE.Vector3();
const nozzle = new THREE.Vector3();
const restPos = new THREE.Vector3();
const restQuat = new THREE.Quaternion();
const heldPos = new THREE.Vector3();
const heldQuat = new THREE.Quaternion();
const qTmp = new THREE.Quaternion();
const eul = new THREE.Euler();
const lean = new THREE.Vector3();
const bowlFrom = new THREE.Vector3();
const tgtPts = Array.from({ length: 12 }, () => new THREE.Vector3());
const demoPts = Array.from({ length: 12 }, () => new THREE.Vector3());
const list = [];

const S = {
  blobs: new Uint16Array(12),
  total: 0,
  hasLast: false,
  pileT: 0,
  heldT: 0,
  sq: 0,
  speed: 0,
  sputter: -1,
  drops: 0,
  bowlT: -1,
  stream: null,
};

const easeIn = (t) => t * t * t;

function mayoRest(G) {
  // lying on its side on the table, nozzle toward the platter side (−x), slightly turned
  restPos.copy(G.layout.dressRest);
  restPos.y = 2.72;
  if (G.layout.portrait) {
    restPos.x -= 9.5;
    restPos.z += 0.6;
    eul.set(0, -0.22, -Math.PI / 2, 'YXZ');
  } else {
    restPos.z -= 8;
    eul.set(Math.PI / 2, 0.25, 0, 'YXZ');
  }
  restQuat.setFromEuler(eul);
  return { pos: restPos, quat: restQuat };
}

function landingPoint(G, target, out) {
  clampToPlatter(G, v1.copy(target), 1.2);
  const h = dressHit(G, v1);
  out.copy(h.point);
  return h;
}

function mayoHeld(G, target, t) {
  landingPoint(G, target, land);
  heldPos.copy(land);
  heldPos.y = Math.max(land.y + 1.2, ballTopY(G) + 0.7);
  lean.set(0.8, 0.56, -0.22).normalize(); // lies over to the right / up-screen so the nozzle and the line stay visible
  heldQuat.setFromUnitVectors(UP, lean);
  if (S.sputter >= 0) {
    // shudder while it runs empty
    const k = Math.max(0, 1 - S.sputter / 0.8);
    eul.set(Math.sin(S.sputter * 47) * 0.07 * k, 0, Math.sin(S.sputter * 39 + 1) * 0.08 * k);
    heldQuat.multiply(qTmp.setFromEuler(eul));
    heldPos.y += Math.abs(Math.sin(S.sputter * 25)) * 0.4 * k;
  }
  return { pos: heldPos, quat: heldQuat };
}

function layBlob(G, x, z) {
  if (S.total >= 470) return;
  const b = surfaceBelowXZ(G, x, z, q1);
  if (b) {
    b.mesh.getWorldPosition(cTmp);
    nrm.subVectors(q1, cTmp).normalize();
    if (G.bits.place('mayo', q1, nrm, b) >= 0) {
      S.blobs[b.index]++;
      S.total++;
    }
  } else if (G.bits.place('mayo', q1, UP, null) >= 0) S.total++;
}

function needyIdx(G) {
  const out = [];
  for (const b of dressBalls(G, list)) if (S.blobs[b.index] < NEED) out.push(b.index);
  return serpentineOrder(out);
}

function progress() {
  let ok = 0;
  for (let i = 0; i < 12; i++) if (S.blobs[i] >= NEED) ok++;
  return Math.max(S.total / 480, Math.min(S.total / 200, ok / 12));
}

export default {
  id: 'mayo',

  enter(G) {
    S.blobs.fill(0);
    S.total = 0;
    S.hasLast = false;
    S.pileT = 0;
    S.heldT = 0;
    S.sq = 0;
    S.speed = 0;
    S.sputter = -1;
    S.drops = 0;
    const W = G.world.props;
    syncPlatter(G);
    G.cam.frame('dress');
    // the sauce bowl leaves together with the brush
    if (W.sauceBowl.visible) {
      S.bowlT = 0;
      bowlFrom.copy(W.sauceBowl.position);
    } else S.bowlT = -1;
    W.mayo.setLevel(1);
    W.mayo.squeeze(0);
    S.stream = G.fx.stream('mayo');
    S.stream.setColor(0xf3e3ad);
    G.tools.define('mayo', {
      object: W.mayo,
      rest: () => mayoRest(G),
      held: (target, t) => mayoHeld(G, target, t),
      workWhile: () => S.sq > 0.3,
    });
    G.tools.bring('mayo');
    G.input.planeY = ballTopY(G);
    G.hints.set({
      tool: 'mayo',
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
        // zigzag across the row of the first ball that still wants mayo
        G.balls[n[0]].mesh.getWorldPosition(v2);
        const pc = G.layout.platter;
        const y = ballTopY(G) - 0.2;
        const pts = [];
        for (let k = 0; k < 8; k++) {
          const x = pc.x - 6.6 + k * (13.2 / 7);
          demoPts[k].set(x, y, v2.z + (k % 2 ? 1.1 : -1.1));
          pts.push(demoPts[k]);
        }
        return pts;
      },
    });
  },

  update(G, dt) {
    syncPlatter(G);
    keepWarm(G, 0.65);
    const W = G.world.props;
    const T = G.tools;

    // sauce bowl slides away
    if (S.bowlT >= 0) {
      S.bowlT = Math.min(1, S.bowlT + dt / 0.6);
      const e = easeIn(S.bowlT);
      W.sauceBowl.position.lerpVectors(bowlFrom, G.layout.toolSlideFrom, e);
      W.sauceBowl.position.y = 0;
      if (S.bowlT >= 1) {
        W.sauceBowl.visible = false;
        S.bowlT = -1;
      }
    }

    const working = T.active === 'mayo' && T.held && T.arrived > 0.6 && S.sputter < 0;
    let moved = 0;
    if (working) {
      const h = landingPoint(G, T.target, land);
      const ok = h.ball || h.onPlatter;
      if (!S.hasLast) {
        last.copy(land);
        S.hasLast = true;
        // first contact: a little squirt so a plain tap shows something
        for (let k = 0; k < 3; k++) layBlob(G, land.x + (Math.random() - 0.5) * 0.25, land.z + (Math.random() - 0.5) * 0.25);
        G.hints.poke();
      }
      const dx = land.x - last.x;
      const dz = land.z - last.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= SPACING && ok) {
        const step = Math.max(SPACING, dist / 18);
        const n = Math.floor(dist / step);
        for (let k = 1; k <= n; k++) layBlob(G, last.x + (dx * k * step) / dist, last.z + (dz * k * step) / dist);
        const f = (n * step) / dist;
        last.x += dx * f;
        last.z += dz * f;
        moved = n * step;
        if (n > 0) G.hints.poke();
      } else if (!ok) last.copy(land);
      // still finger: slow pile
      S.pileT += dt;
      if (moved === 0 && S.pileT > 0.33 && ok) {
        S.pileT = 0;
        layBlob(G, land.x + (Math.random() - 0.5) * 0.2, land.z + (Math.random() - 0.5) * 0.2);
      }
      if (moved > 0) S.pileT = 0;
      S.heldT += dt;
      const sp = dt > 0 ? moved / dt : 0;
      S.speed += (sp - S.speed) * Math.min(1, dt * 10);
    } else {
      S.hasLast = false;
      S.speed *= Math.exp(-dt * 10);
    }

    // squeeze visuals + sound
    let sqGoal = working ? 0.75 + 0.25 * Math.min(1, S.speed / 20) : 0;
    if (S.sputter >= 0) sqGoal = 0.5 + 0.5 * Math.abs(Math.sin(S.sputter * 18));
    S.sq += (sqGoal - S.sq) * Math.min(1, dt * 14);
    W.mayo.squeeze(S.sq);
    G.audio.setSqueeze(working ? 0.25 + 0.75 * Math.min(1, S.speed / 18) : 0);
    T.actionPoint(nozzle);
    S.stream.set(nozzle, land, working, 0.17);
    W.mayo.setLevel(1 - 0.85 * Math.min(1, progress()));

    // done → sputter empty
    if (S.sputter < 0) {
      let ok = 0;
      for (let i = 0; i < 12; i++) if (S.blobs[i] >= NEED) ok++;
      const alive = dressBalls(G, list).length;
      if ((ok >= alive && S.total >= 200) || S.total >= 480 || S.heldT > 30) {
        S.sputter = 0;
        G.audio.play('sputter', { vol: 1 });
        G.audio.play('giggle', { vol: 0.5, delay: 0.75 });
      }
    } else {
      S.sputter += dt;
      const at = [0.18, 0.42];
      if (S.drops < 2 && S.sputter > at[S.drops]) {
        S.drops++;
        if (T.held) {
          landingPoint(G, T.target, land);
          layBlob(G, land.x + 0.15 * S.drops, land.z);
        }
        T.actionPoint(nozzle);
        G.fx.splash(nozzle, { color: 0xf3e3ad, count: 2 });
      }
      if (S.sputter > 0.95 && T.active === 'mayo') T.dismiss('mayo');
      if (S.sputter > 1.2) G.flow.complete();
    }
  },

  exit(G) {
    G.audio.setSqueeze(0);
    if (S.stream) S.stream.set(nozzle, land, false);
    G.world.props.mayo.squeeze(0);
    if (S.bowlT >= 0) {
      G.world.props.sauceBowl.visible = false;
      S.bowlT = -1;
    }
  },
  onDown() {},
  onMove() {},
  onUp() {},
  fastForward(G) {
    canon.mayoed(G);
  },
  reset(G) {
    S.sputter = -1;
    S.bowlT = -1;
  },
};
