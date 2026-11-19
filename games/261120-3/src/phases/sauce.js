// Phase 'sauce': a bowl of takoyaki sauce with a brush is handed in. Brush over the balls → glossy sauce
// stays exactly where the bristles passed. Balls that got a fair share slowly flood to full by themselves.
import * as THREE from 'three';
import { canon, dressBalls, dressHit, ballTopY, syncPlatter, keepWarm, clampToPlatter, serpentineOrder } from './common.js';

const DONE = 0.5; // coverage that counts as "sauced"
const ASSIST = 0.3; // above this a ball floods to full on its own
const PAINT_R = 1.9;
const STEP = 0.45; // cm between paint samples along the stroke
const UP = new THREE.Vector3(0, 1, 0);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const tip = new THREE.Vector3();
const lastTip = new THREE.Vector3();
const sample = new THREE.Vector3();
const cTmp = new THREE.Vector3();
const restPos = new THREE.Vector3();
const restQuat = new THREE.Quaternion();
const heldPos = new THREE.Vector3();
const heldQuat = new THREE.Quaternion();
const lean = new THREE.Vector3();
const bx = new THREE.Vector3();
const bz = new THREE.Vector3();
const mtx = new THREE.Matrix4();
const FACE = new THREE.Vector3(0.15, 0.85, 0.5).normalize(); // flat side of the brush faces the viewer
// quaternion with local +y along `y` and the flat side (local +z) turned toward `face`
function orient(q, y, face) {
  bz.copy(face).addScaledVector(y, -face.dot(y)).normalize();
  bx.crossVectors(y, bz);
  mtx.makeBasis(bx, y, bz);
  return q.setFromRotationMatrix(mtx);
}
const bowlOff = new THREE.Vector3(-1.9, 0.95, -0.4); // brush tip inside the bowl (bowl local)
const tgtPts = Array.from({ length: 12 }, () => new THREE.Vector3());
const demoPts = Array.from({ length: 6 }, () => new THREE.Vector3());
const list = [];

const S = {
  cov: new Float32Array(12),
  flow: new Float32Array(12), // >0: flooding time
  doneB: new Uint8Array(12),
  doneCount: 0,
  hasLast: false,
  loaded: 1,
  covT: 0,
  finished: -1,
  dabT: 0,
  speed: 0,
};

function brushRest(G) {
  const bowl = G.world.props.sauceBowl;
  restPos.copy(bowlOff).add(bowl.position);
  // handle rests on the rim toward the player's right
  lean.set(0.84, 0.36, 0.42).normalize();
  orient(restQuat, lean, FACE);
  return { pos: restPos, quat: restQuat };
}

// brush tip on the surface under the finger; handle leaning to the right/toward the player
function brushHeld(G, target, t) {
  clampToPlatter(G, v1.copy(target), -1.5);
  const h = dressHit(G, v1);
  heldPos.copy(h.point);
  if (!h.ball && h.onPlatter) {
    // in a gap between balls the bristles ride on the balls rather than diving down
    for (const b of G.balls) {
      if (b.mode !== 'slot') continue;
      b.mesh.getWorldPosition(cTmp);
      if (Math.hypot(cTmp.x - heldPos.x, cTmp.z - heldPos.z) < 3.0) {
        heldPos.y = Math.max(heldPos.y, cTmp.y + 1.0);
        break;
      }
    }
  }
  const vx = t && t.vel ? t.vel.x : 0;
  const vz = t && t.vel ? t.vel.z : 0;
  // bristles trail behind the motion a little
  lean.set(0.62 - Math.max(-0.25, Math.min(0.25, vx * 0.006)), 0.68, 0.42 - Math.max(-0.25, Math.min(0.25, vz * 0.006))).normalize();
  orient(heldQuat, lean, FACE);
  return { pos: heldPos, quat: heldQuat };
}

function paintAt(G, p, amount) {
  const R = G.cfg.BALL_R;
  for (const b of G.balls) {
    if (b.mode !== 'slot' && b.mode !== 'free') continue;
    b.mesh.getWorldPosition(cTmp);
    if (cTmp.distanceTo(p) < R + PAINT_R) b.paintSauce(p, PAINT_R, amount);
  }
}

function needy(G) {
  const out = [];
  for (const b of dressBalls(G, list)) if (!S.doneB[b.index]) out.push(b.index);
  return serpentineOrder(out);
}

export default {
  id: 'sauce',

  enter(G) {
    S.cov.fill(0);
    S.flow.fill(0);
    S.doneB.fill(0);
    S.doneCount = 0;
    S.hasLast = false;
    S.loaded = 1;
    S.covT = 0;
    S.finished = -1;
    S.speed = 0;
    const W = G.world.props;
    syncPlatter(G);
    G.cam.frame('dress');
    G.cam.focusOffset(null, 0);
    // bowl slides in together with the brush (rigidly: bowl follows the brush during the slide)
    const bowl = W.sauceBowl;
    if (!bowl.parent) G.scene.add(bowl);
    bowl.visible = true;
    bowl.setLevel(1);
    bowl.position.copy(G.layout.dressRest);
    bowl.rotation.set(0, 0, 0);
    W.brush.setLoaded(1);
    G.tools.define('brush', {
      object: W.brush,
      rest: () => brushRest(G),
      held: (target, t) => brushHeld(G, target, t),
      workWhile: () => S.hasLast,
    });
    G.tools.bring('brush');
    G.input.planeY = ballTopY(G);
    G.hints.set({
      tool: 'brush',
      targets: () => {
        const n = needy(G);
        const out = [];
        for (let k = 0; k < n.length && k < 12; k++) {
          G.balls[n[k]].mesh.getWorldPosition(tgtPts[k]);
          tgtPts[k].y += G.cfg.BALL_R;
          out.push(tgtPts[k]);
        }
        return out;
      },
      demo: () => {
        const n = needy(G);
        if (!n.length) return null;
        const b = G.balls[n[0]];
        b.mesh.getWorldPosition(v2);
        const y = v2.y + G.cfg.BALL_R;
        const xs = [-2.6, 2.6, -2.2, 2.2];
        for (let k = 0; k < 4; k++) demoPts[k].set(v2.x + xs[k], y - 0.3, v2.z + (k - 1.5) * 0.5);
        return demoPts.slice(0, 4);
      },
    });
  },

  update(G, dt) {
    syncPlatter(G);
    keepWarm(G, 0.65);
    const W = G.world.props;
    const bowl = W.sauceBowl;
    // bowl rides with the brush while it slides in, then sits at the layout spot
    const d = G.tools.defs.brush;
    if (d && d.mode === 'slideIn') {
      brushRest(G);
      v1.subVectors(restPos, G.layout.dressRest);
      bowl.position.copy(W.brush.position).sub(v1);
      bowl.position.y = 0;
    } else bowl.position.copy(G.layout.dressRest);

    const T = G.tools;
    const working = T.active === 'brush' && T.held && T.arrived > 0.6 && S.finished < 0;
    let moved = 0;
    if (working) {
      T.actionPoint(tip);
      if (!S.hasLast) {
        lastTip.copy(tip);
        S.hasLast = true;
      }
      const dist = tip.distanceTo(lastTip);
      {
        const n = Math.min(24, Math.floor(dist / STEP));
        for (let k = 1; k <= n; k++) {
          sample.lerpVectors(lastTip, tip, k / n);
          paintAt(G, sample, 0.55 * (0.6 + 0.4 * S.loaded));
        }
        if (n > 0) {
          lastTip.copy(tip);
          moved = dist;
        }
      }
      // holding still / tapping dabs sauce on the spot
      S.dabT += dt;
      if (S.dabT > 0.06) {
        S.dabT = 0;
        paintAt(G, tip, 0.22);
      }
      S.loaded = Math.max(0.45, S.loaded - moved * 0.012);
      const sp = dt > 0 ? moved / dt : 0;
      S.speed += (sp - S.speed) * Math.min(1, dt * 12);
    } else {
      S.hasLast = false;
      S.speed *= Math.exp(-dt * 10);
      if (!T.held) S.loaded = Math.min(1, S.loaded + dt * 1.2);
    }
    W.brush.setLoaded(S.loaded);
    G.audio.setBrush(working ? Math.min(1, S.speed / 40) : 0);

    // coverage + assist flood
    S.covT -= dt;
    const R = G.cfg.BALL_R;
    for (const b of dressBalls(G, list)) {
      const i = b.index;
      if (S.flow[i] > 0) {
        S.flow[i] += dt;
        const thMax = Math.min(0.86, 0.45 + S.flow[i] * 0.25);
        b.mesh.getWorldPosition(cTmp);
        for (let k = 0; k < 2; k++) {
          const th = Math.sqrt(Math.random()) * thMax;
          const a = Math.random() * Math.PI * 2;
          v2.set(Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th)).multiplyScalar(R).add(cTmp);
          b.paintSauce(v2, 1.25, 0.22);
        }
      }
    }
    if (S.covT <= 0) {
      S.covT = 0.15;
      for (const b of dressBalls(G, list)) {
        const i = b.index;
        const c = b.sauceCoverage();
        S.cov[i] = c;
        if (c >= ASSIST && S.flow[i] === 0) S.flow[i] = 1e-3;
        if (S.flow[i] > 3.5) S.flow[i] = -1; // flooded: stop
        if ((c >= DONE || S.flow[i] < 0) && !S.doneB[i]) {
          S.doneB[i] = 1;
          G.audio.play('ding', { pitch: Math.pow(2, PENTA[S.doneCount % 12] / 12) * 0.9, vol: 0.55 });
          b.mesh.getWorldPosition(v2);
          v2.y += R;
          G.fx.sparkle(v2, { count: 4 });
          S.doneCount++;
          G.hints.poke();
        }
      }
      if (S.finished < 0 && dressBalls(G, list).every((b) => S.doneB[b.index])) {
        S.finished = 0;
        G.audio.play('allDone', { vol: 0.8 });
      }
    }
    if (S.finished >= 0) {
      S.finished += dt;
      if (S.finished > 0.9) G.flow.complete();
    }
  },

  exit(G) {
    G.audio.setBrush(0);
  },
  onDown() {},
  onMove() {},
  onUp() {},
  fastForward(G) {
    canon.sauced(G);
  },
  reset(G) {
    const W = G.world.props;
    if (W.sauceBowl) W.sauceBowl.visible = false;
    S.finished = -1;
  },
};
