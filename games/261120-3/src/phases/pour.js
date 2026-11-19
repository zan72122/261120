// Phase 'pour': the batter pitcher. Held over the plate it tilts and pours; holes fill, overflow makes the skirt.
import * as THREE from 'three';
import { RIM_Y, HOLE_R, BALL_COUNT, holeCenter } from '../config.js';
import { canon, serpentineOrder } from './common.js';

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const YAW = 0.5; // spout toward -x/+z: the jug body sits up-right of the stream
const TILT = (55 * Math.PI) / 180;
const RATE = 2.3; // fill/s directly under the stream
const REACH = 3.6;
const LIM_X = 7.6;
const LIM_Z = 10.3;
const TOTAL = BALL_COUNT * 1.28; // pitcher "content" in fill units

const centres = Array.from({ length: BALL_COUNT }, (_, i) => holeCenter(i, new THREE.Vector3()));
const _q = new THREE.Quaternion();
const _qt = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _land = new THREE.Vector3();
const _from = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const restOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const heldOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const w = new Float32Array(BALL_COUNT);

function clampTarget(t, out) {
  return out.set(Math.max(-LIM_X, Math.min(LIM_X, t.x)), t.y, Math.max(-LIM_Z, Math.min(LIM_Z, t.z)));
}

// batter surface height under (x, z)
function surfaceAt(G, x, z) {
  for (const b of G.balls) {
    const c = centres[b.index];
    if (Math.hypot(x - c.x, z - c.z) < HOLE_R) return RIM_Y + (b.level ? b.level() : 0) + 0.05;
  }
  return RIM_Y + 0.08;
}

const S = {
  tilt: 0, // 0..1
  pouring: false,
  done: false,
  doneT: 0,
  fxT: 0,
  steamT: 0,
  stream: null,
};

function total(G) {
  let t = 0;
  for (const b of G.balls) t += b.fill + b.skirt * 0.4;
  return t;
}

// overflow of ball `src` spreads: own skirt + nearest holes that still take batter
function spill(G, src, amt) {
  if (amt <= 0) return;
  src.addSkirt(amt * 0.7);
  const c = centres[src.index];
  let sum = 0;
  for (const b of G.balls) {
    w[b.index] = 0;
    if (b === src || b.fill >= 1) continue;
    const d = c.distanceTo(centres[b.index]);
    if (d < 8) sum += w[b.index] = 1 / d;
  }
  if (sum > 0) {
    for (const b of G.balls) if (w[b.index] > 0) b.addBatter((amt * 0.55 * w[b.index]) / sum);
    return;
  }
  // everything around is full: the sheet creeps on to the nearest hole that still needs batter
  let best = null;
  let bd = Infinity;
  for (const b of G.balls) {
    if (b.fill >= 1) continue;
    const d = c.distanceTo(centres[b.index]);
    if (d < bd) (bd = d), (best = b);
  }
  if (best) best.addBatter(amt * 0.35);
}

function pour(G, dt, land) {
  let sum = 0;
  let near = null;
  let nd = Infinity;
  for (const b of G.balls) {
    const d = Math.hypot(land.x - centres[b.index].x, land.z - centres[b.index].z);
    w[b.index] = d < REACH ? 1 - d / REACH : 0;
    sum += w[b.index];
    if (d < nd) (nd = d), (near = b);
  }
  // batter landing between holes runs into the nearest one (and makes a sheet)
  if (sum < 0.35 && near) {
    w[near.index] += 0.35 - sum;
    near.addSkirt(0.25 * dt);
  }
  for (const b of G.balls) {
    const k = w[b.index];
    if (k <= 0) continue;
    const over = b.addBatter(RATE * k * dt);
    spill(G, b, over);
  }
  // all full: remaining skirts top up quickly
  if (allFull(G)) for (const b of G.balls) b.addSkirt(1.6 * dt);
}

function allFull(G) {
  for (const b of G.balls) if (b.fill < 1) return false;
  return true;
}

function isDone(G) {
  for (const b of G.balls) if (b.fill < 1 || b.skirt < 0.7) return false;
  return true;
}

export default {
  id: 'pour',
  enter(G) {
    S.tilt = 0;
    S.pouring = false;
    S.done = false;
    S.doneT = 0;
    S.fxT = 0;
    S.steamT = 0;
    G.cam.frame('cook');
    G.world.setPower(true);
    G.state.heat = true;
    for (const b of G.balls) b.cookCap = 0.42;
    G.input.planeY = RIM_Y + 0.5;
    if ((G.state.round | 0) >= 1) G.audio.play('start', { vol: 0.8 });
    S.stream = G.fx.stream('batter');
    S.stream.setColor(0xe6cf98);

    const pitcher = G.world.props.pitcher;
    pitcher.setLevel(Math.max(0.12, 1 - total(G) / TOTAL));
    G.tools.define('pitcher', {
      object: pitcher,
      rest() {
        restOut.pos.copy(G.layout.toolRest);
        restOut.quat.setFromAxisAngle(UP, G.layout.portrait ? -0.25 : 0.35);
        return restOut;
      },
      held(target, t) {
        clampTarget(target, _tgt);
        const k = S.tilt;
        _q.setFromAxisAngle(UP, YAW);
        _qt.setFromAxisAngle(Z, TILT * k);
        heldOut.quat.copy(_q).multiply(_qt);
        // spout height above the batter: high while upright (body clear of the plate), low while pouring
        const h = 14 - 9 * k;
        _a.copy(pitcher.userData.action).applyQuaternion(heldOut.quat);
        heldOut.pos.set(_tgt.x, surfaceAt(G, _tgt.x, _tgt.z) + h, _tgt.z).sub(_a);
        return heldOut;
      },
      workWhile: () => S.pouring,
    });
    G.tools.bring('pitcher');

    G.hints.set({
      tool: 'pitcher',
      targets: () => {
        const out = [];
        for (const b of G.balls) if (b.fill < 1) out.push(centres[b.index]);
        return out;
      },
      demo: () => {
        const ord = serpentineOrder(G.balls.filter((b) => b.fill < 1).map((b) => b.index));
        return ord.slice(0, 6).map((i) => centres[i]);
      },
    });
  },

  update(G, dt) {
    const T = G.tools;
    const holding = T.active === 'pitcher' && T.held && !S.done;
    // tilt toward the pour (ghost demo: a gentle hint of the tilt, no batter)
    const goal = holding && T.arrived > 0.45 ? 1 : T.ghost ? 0.35 : 0;
    const rate = goal > S.tilt ? 4 : 5;
    S.tilt += Math.sign(goal - S.tilt) * Math.min(Math.abs(goal - S.tilt), rate * dt);

    S.pouring = holding && S.tilt > 0.8;
    if (S.pouring) {
      T.actionPoint(_from);
      clampTarget(T.target, _land);
      _land.set(_from.x, surfaceAt(G, _from.x, _from.z), _from.z);
      S.stream.set(_from, _land, true, 0.34);
      const before = total(G);
      pour(G, dt, _land);
      if (total(G) > before + 1e-4) G.hints.poke();
      S.fxT -= dt;
      if (S.fxT < 0) {
        S.fxT = 0.22 + Math.random() * 0.15;
        G.fx.splash(_v.copy(_land).setY(_land.y + 0.05), { color: 0xe6cf98, count: 2, power: 0.35, size: 0.7 });
      }
    } else if (S.stream) S.stream.set(_from, _land, false);
    // spreading after everything is full (no need to keep pouring)
    if (!S.done && allFull(G)) for (const b of G.balls) b.addSkirt(0.7 * dt);

    G.world.props.pitcher.setLevel(Math.max(0.12, 1 - total(G) / TOTAL));
    G.audio.setPour(S.pouring ? 0.85 : 0);
    const frac = total(G) / TOTAL;
    G.audio.setSizzle(frac > 0.01 ? 0.22 + 0.36 * Math.min(1, frac) : 0);

    // heat wisps from filled holes
    S.steamT -= dt;
    if (S.steamT < 0) {
      S.steamT = 0.5 + Math.random() * 0.5;
      const b = G.balls[(Math.random() * BALL_COUNT) | 0];
      if (b.fill > 0.4) G.fx.steam(_v.copy(centres[b.index]).setY(RIM_Y + 0.3), { count: 1, spread: 1, rise: 4, size: 1.8, life: 1.3 });
    }

    if (!S.done && isDone(G)) {
      S.done = true;
      S.doneT = 0;
      S.pouring = false;
      S.stream.set(_from, _land, false);
      G.hints.set(null);
    }
    if (S.done) {
      S.doneT += dt;
      if (S.doneT > 0.35 && T.active === 'pitcher') {
        T.dismiss('pitcher');
        G.flow.complete();
      }
    }
  },

  exit(G) {
    S.pouring = false;
    if (S.stream) S.stream.set(_from, _land, false);
    G.audio.setPour(0);
    G.audio.setSizzle(0);
  },
  onDown() {},
  onMove() {},
  onUp() {},
  fastForward(G) {
    canon.poured(G);
  },
  reset(G) {
    S.done = false;
    S.tilt = 0;
    G.world.props.pitcher.setLevel?.(1);
  },
};
