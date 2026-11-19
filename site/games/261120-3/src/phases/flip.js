// Phase 'flip' — the core. Bamboo pick; swipe across ready balls → "kuru!" they roll over; again → round & golden.
import * as THREE from 'three';
import { RIM_Y, BALL_R, BALL_COUNT, holeCenter } from '../config.js';
import { canon } from './common.js';

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const LEAN = (40 * Math.PI) / 180;
const HIT = 2.8; // stroke reach around a ball centre (xz)
const MIN_STEP = 0.15;
const FIRST = 0.4;
const STAGGER = 0.35;
const WAIT_ASSIST = 1.2; // nothing to flip for this long → help the most advanced ball along
// 'ding' pitches (E5 base) on a major pentatonic, capped at 2
const DING = [0.75, 0.84, 0.94, 1.125, 1.26, 1.5, 1.68, 1.89, 2.25, 2.52, 3, 3.36].map((p) => (p > 2 ? p / 2 : p));

const centres = Array.from({ length: BALL_COUNT }, (_, i) => holeCenter(i, new THREE.Vector3()));
const tops = Array.from({ length: BALL_COUNT }, () => new THREE.Vector3());
const leanDir = new THREE.Vector3(Math.sin(LEAN) * Math.SQRT1_2, Math.cos(LEAN), Math.sin(LEAN) * Math.SQRT1_2);
const leanQ = new THREE.Quaternion().setFromUnitVectors(UP, leanDir);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _tap = new THREE.Vector3(0, 0, -1);
const restOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const heldOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

const S = {
  t: 0,
  order: [],
  released: 0,
  prev: new THREE.Vector3(),
  down: new THREE.Vector3(),
  downT: 0,
  moved: 0,
  inside: new Uint8Array(BALL_COUNT),
  doneCount: 0,
  allDone: false,
  allT: 0,
  powerOff: false,
  wait: 0,
  helped: null,
  sizzle: 0.45,
  puff: new Float32Array(BALL_COUNT),
};

function topOf(G, b, out) {
  const c = centres[b.index];
  const tp = b.topPointAt(c.x, c.z, out);
  if (!tp) out.set(c.x, RIM_Y + 0.2, c.z);
  return out;
}

const flippable = (b) => b.mode === 'hole' && b.ready && !b.done && !b.spinning;

// tip height under the finger: on the surface of the nearest ball (or just above the plate)
function surfaceY(G, x, z) {
  let y = RIM_Y + 0.6;
  for (const b of G.balls) {
    const c = centres[b.index];
    if (Math.abs(x - c.x) > BALL_R + 0.3 || Math.abs(z - c.z) > BALL_R + 0.3) continue;
    const tp = b.topPointAt(x, z, _v);
    if (tp && tp.y - 0.25 > y) y = tp.y - 0.25;
  }
  return y;
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 1e-8 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function defineTool(G) {
  const pick = G.world.props.pick;
  G.tools.define('pick', {
    object: pick,
    rest() {
      // lying on the table, tip toward the plate, handle toward the player's right hand
      restOut.pos.copy(G.layout.toolRest);
      restOut.pos.y = 0.46;
      restOut.quat.setFromAxisAngle(UP, G.layout.portrait ? 0.7 : 0.2).multiply(_q.setFromAxisAngle(X, Math.PI / 2));
      return restOut;
    },
    held(target) {
      heldOut.quat.copy(leanQ);
      heldOut.pos.set(target.x, surfaceY(G, target.x, target.z), target.z);
      return heldOut;
    },
  });
}

function stroke(G, from, to, speed) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  for (const b of G.balls) {
    const c = centres[b.index];
    const dNow = Math.hypot(to.x - c.x, to.z - c.z);
    if (S.inside[b.index] && dNow > HIT + 0.4) S.inside[b.index] = 0;
    if (len < MIN_STEP || S.inside[b.index] || b.mode !== 'hole') continue;
    if (segDist(c.x, c.z, from.x, from.z, to.x, to.z) > HIT) continue;
    _dir.set(dx / len, 0, dz / len);
    const r = b.swipe(_dir, speed);
    if (r) S.inside[b.index] = 1;
    if (r === 'flip' || r === 'hop') G.hints.poke();
  }
}

export default {
  id: 'flip',
  enter(G) {
    S.t = 0;
    S.released = 0;
    S.inside.fill(0);
    S.doneCount = 0;
    S.allDone = false;
    S.allT = 0;
    S.powerOff = false;
    S.wait = 0;
    S.helped = null;
    S.sizzle = 0.45;
    G.cam.frame('cook');
    G.state.heat = true;
    G.world.setPower(true);
    for (const b of G.balls) if (b.done) S.doneCount++;
    // release cooking one after another, in a random order
    S.order = G.balls.map((b) => b.index);
    for (let i = S.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [S.order[i], S.order[j]] = [S.order[j], S.order[i]];
    }
    G.input.planeY = RIM_Y + 1.2;
    defineTool(G);
    G.tools.bring('pick');
    G.hints.set({
      tool: 'pick',
      targets: () => {
        const out = [];
        for (const b of G.balls) if (flippable(b)) out.push(topOf(G, b, tops[b.index]));
        return out;
      },
      demo: () => {
        const b = G.balls.find(flippable);
        if (!b) return null;
        const t = topOf(G, b, tops[b.index]);
        return [_v.set(t.x - 2.6, t.y, t.z + 0.4).clone(), new THREE.Vector3(t.x + 2.6, t.y, t.z - 0.4)];
      },
    });
  },

  update(G, dt) {
    S.t += dt;
    // staggered release of the cooking cap
    while (S.released < S.order.length && S.t >= FIRST + STAGGER * S.released) {
      const b = G.balls[S.order[S.released++]];
      b.cookCap = 1;
      b.precook?.();
    }

    let readyN = 0;
    let raw = 0;
    let inHole = 0;
    for (const b of G.balls) {
      if (flippable(b) && b.flips === 0) readyN++;
      else if (flippable(b)) readyN += 0.5;
      if (b.mode === 'hole') {
        inHole++;
        raw += b.done ? 0 : 1 - b.doneness();
      }
      // ready balls breathe a little extra steam (announce themselves)
      if (flippable(b)) {
        S.puff[b.index] -= dt;
        if (S.puff[b.index] < 0) {
          S.puff[b.index] = 1.1 + Math.random() * 0.6;
          G.fx.steam(topOf(G, b, _v), { count: 1, spread: 0.5, rise: 5, size: 2, life: 1.3 });
        }
      } else S.puff[b.index] = 0.2 + Math.random() * 0.4;
      if (b.justDone) {
        const n = S.doneCount++;
        G.audio.play('ding', { pitch: DING[Math.min(n, DING.length - 1)], vol: 0.85, pan: centres[b.index].x / 12 });
        G.fx.sparkle(topOf(G, b, _v), { count: 7 });
        b.pop?.(0.5);
        G.hints.poke();
      }
    }

    // never wait long with nothing to flip: help the ball closest to ready
    const any = G.balls.some(flippable);
    if (S.helped && (S.helped.ready || S.helped.done)) {
      S.helped.cookRate = 1;
      S.helped = null;
    }
    if (!any && S.released >= S.order.length && !S.allDone) {
      S.wait += dt;
      if (S.wait > WAIT_ASSIST && !S.helped) {
        let best = null;
        for (const b of G.balls) {
          if (b.mode !== 'hole' || b.done || b.spinning || b.cookCap < 1) continue;
          if (!best || b.readiness() > best.readiness()) best = b;
        }
        if (best) {
          best.cookRate = 3;
          S.helped = best;
        }
      }
    } else S.wait = 0;

    // sound: bubbling while balls wait to be turned; sizzle with raw batter on the hot plate
    G.audio.setBubble(Math.min(1, readyN / 4) * 0.75);
    const goal = S.powerOff ? 0 : 0.3 + 0.3 * (inHole ? Math.min(1, raw / inHole) : 0);
    S.sizzle += (goal - S.sizzle) * Math.min(1, dt * (S.powerOff ? 1.2 : 3));
    G.audio.setSizzle(S.sizzle);

    if (!S.allDone && G.balls.every((b) => b.done)) {
      S.allDone = true;
      S.allT = 0;
      G.audio.play('allDone', { vol: 0.9 });
      G.hints.set(null);
    }
    if (S.allDone) {
      S.allT += dt;
      if (!S.powerOff && S.allT > 0.9) {
        S.powerOff = true;
        G.world.setPower(false);
        G.state.heat = false;
        G.audio.play('click', { vol: 0.9 });
      }
      if (S.powerOff && S.allT > 1.6) G.flow.complete();
    }
  },

  exit(G) {
    G.audio.setBubble(0);
    G.audio.setSizzle(0);
    for (const b of G.balls) b.cookRate = 1;
  },

  onDown(G, p) {
    S.prev.copy(p.world);
    S.down.copy(p.world);
    S.downT = G.time;
    S.moved = 0;
    S.inside.fill(0);
  },
  onMove(G, p) {
    const T = G.tools;
    S.moved += Math.hypot(p.world.x - S.prev.x, p.world.z - S.prev.z);
    if (T.held && T.arrived > 0.35) stroke(G, S.prev, p.world, p.speed);
    S.prev.copy(p.world);
  },
  onUp(G) {
    // a plain tap on a ball = a normal swipe away from the player
    if (S.moved < 0.8 && G.time - S.downT < 0.45) {
      let best = null;
      let bd = HIT;
      for (const b of G.balls) {
        if (b.mode !== 'hole') continue;
        const d = Math.hypot(S.down.x - centres[b.index].x, S.down.z - centres[b.index].z);
        if (d < bd) (bd = d), (best = b);
      }
      if (best) {
        const r = best.swipe(_tap, 60);
        if (r === 'flip' || r === 'hop') G.hints.poke();
      }
    }
    S.inside.fill(0);
  },
  fastForward(G) {
    canon.cooked(G);
  },
  reset(G) {
    S.allDone = false;
    S.powerOff = false;
    S.helped = null;
  },
};
