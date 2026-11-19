// Phase 'plate': the platter slides in; spear a ball with the pick, release → it hops onto the platter.
// Gag: the last ball rolls off, trundles across the table and bumps the hot plate; fetch it back.
import * as THREE from 'three';
import { RIM_Y, BALL_R, BALL_COUNT, PLATTER, holeCenter, platterSlot } from '../config.js';
import { canon, slotWorld } from './common.js';

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const LEAN = (40 * Math.PI) / 180;
const SLIDE = 0.8;
const LIFT_Y = RIM_Y + 3.4; // speared ball centre height
const PICK_R = 3.4; // cm on the plane
const PICK_PX = 70; // screen fallback
const RUN_PX = 95;
const SLOT_Y = PLATTER.surfaceY + BALL_R * 0.97;

const centres = Array.from({ length: BALL_COUNT }, (_, i) => holeCenter(i, new THREE.Vector3()));
const tops = Array.from({ length: BALL_COUNT }, () => new THREE.Vector3());
const leanDir = new THREE.Vector3(Math.sin(LEAN) * Math.SQRT1_2, Math.cos(LEAN), Math.sin(LEAN) * Math.SQRT1_2);
const leanQ = new THREE.Quaternion().setFromUnitVectors(UP, leanDir);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _scr = { x: 0, y: 0 };
const restOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const heldOut = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const S = {
  slideT: 1,
  slideFrom: new THREE.Vector3(),
  held: null, // speared ball
  heldPos: new THREE.Vector3(),
  slotOf: new Int8Array(BALL_COUNT).fill(-1), // ball index → platter slot
  taken: new Uint8Array(BALL_COUNT), // slot reserved
  landed: 0,
  gag: 'none', // none | beat | tip | roll | rock | wait | back | done
  gagT: 0,
  runner: null,
  path: null,
  rockT: 9,
  doneT: 0,
};

// ---------- runaway path ----------
function buildPath(G, ball) {
  const L = G.layout;
  const plat = L.platter;
  const p0 = ball.group.getWorldPosition(new THREE.Vector3());
  const stop = new THREE.Vector3(L.runawayStop.x, BALL_R, L.runawayStop.z);
  // leave the platter heading for the stop: where does that line cross the rim?
  const lx = p0.x - plat.x;
  const lz = p0.z - plat.z;
  const dx = stop.x - p0.x;
  const dz = stop.z - p0.z;
  const hw = PLATTER.w / 2 - 0.9;
  const hd = PLATTER.d / 2 - 0.9;
  let t = Infinity;
  if (dx > 1e-4) t = Math.min(t, (hw - lx) / dx);
  if (dx < -1e-4) t = Math.min(t, (-hw - lx) / dx);
  if (dz > 1e-4) t = Math.min(t, (hd - lz) / dz);
  if (dz < -1e-4) t = Math.min(t, (-hd - lz) / dz);
  if (!isFinite(t) || t < 0) t = 0;
  t = Math.min(t, 0.9);
  const edge = new THREE.Vector3(p0.x + dx * t, SLOT_Y, p0.z + dz * t);
  const dirLen = Math.hypot(dx, dz) || 1;
  const ux = dx / dirLen;
  const uz = dz / dirLen;
  const off = new THREE.Vector3(edge.x + ux * 2.2, BALL_R, edge.z + uz * 2.2); // where it lands on the table
  // gentle curve: control point pushed sideways
  const ctrl = new THREE.Vector3((off.x + stop.x) / 2 - uz * 3.2, BALL_R, (off.z + stop.z) / 2 + ux * 3.2);
  // sample: platter part (straight), drop, table part (quadratic bezier)
  const pts = [];
  const n1 = 10;
  for (let i = 0; i <= n1; i++) pts.push(new THREE.Vector3().lerpVectors(p0, edge, i / n1));
  const n2 = 6;
  for (let i = 1; i <= n2; i++) {
    const k = i / n2;
    const p = new THREE.Vector3().lerpVectors(edge, off, k);
    // over the low rim, then down onto the table
    p.y = SLOT_Y + 0.75 * Math.sin(Math.min(1, k * 2) * Math.PI * 0.5) * (1 - k) + (BALL_R - SLOT_Y) * Math.pow(k, 2.2);
    pts.push(p);
  }
  const n3 = 24;
  for (let i = 1; i <= n3; i++) {
    const k = i / n3;
    const a = (1 - k) * (1 - k);
    const b = 2 * (1 - k) * k;
    const c = k * k;
    pts.push(new THREE.Vector3(a * off.x + b * ctrl.x + c * stop.x, BALL_R, a * off.z + b * ctrl.z + c * stop.z));
  }
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, acc, len: acc[acc.length - 1], s: 0, v: 3, dropS: acc[n1], landS: acc[n1 + n2], bounced: false, back: new THREE.Vector3(-ux, 0, -uz) };
}

function samplePath(P, s, out) {
  const { pts, acc } = P;
  if (s <= 0) return out.copy(pts[0]);
  if (s >= P.len) return out.copy(pts[pts.length - 1]);
  let i = 1;
  while (i < pts.length - 1 && acc[i] < s) i++;
  const seg = acc[i] - acc[i - 1] || 1;
  return out.lerpVectors(pts[i - 1], pts[i], (s - acc[i - 1]) / seg);
}

// ---------- helpers ----------
function platter(G) {
  return G.world.props.platter;
}

function freeSlotNear(G, x, z) {
  const plat = G.layout.platter;
  const lx = x - plat.x;
  const lz = z - plat.z;
  const over = Math.abs(lx) < PLATTER.w / 2 + 3 && Math.abs(lz) < PLATTER.d / 2 + 3;
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < BALL_COUNT; i++) {
    if (S.taken[i]) continue;
    if (!over) return i; // next free slot in order
    platterSlot(i, _v2);
    const d = Math.hypot(_v2.x - lx, _v2.z - lz);
    if (d < bd) (bd = d), (best = i);
  }
  return best;
}

function remaining(G) {
  let n = 0;
  for (const b of G.balls) if (b.mode === 'hole') n++;
  return n;
}

function ballTop(b, out) {
  return b.group.getWorldPosition(out).add(_v2.set(0, BALL_R * 0.95, 0));
}

function canGrab(b) {
  if (b.mode === 'hole') return true;
  return b === S.runner && b.mode === 'free' && (S.gag === 'roll' || S.gag === 'rock' || S.gag === 'wait');
}

function choose(G, p) {
  // runaway: generous screen-space test
  if (S.runner && canGrab(S.runner)) {
    G.cam.worldToScreen(S.runner.group.getWorldPosition(_v), _scr);
    if (Math.hypot(_scr.x - p.x, _scr.y - p.y) < RUN_PX) return S.runner;
    const d = Math.hypot(_v.x - p.world.x, _v.z - p.world.z);
    if (d < PICK_R + 1.5) return S.runner;
  }
  let best = null;
  let bd = PICK_R;
  for (const b of G.balls) {
    if (b.mode !== 'hole') continue;
    const c = centres[b.index];
    const d = Math.hypot(c.x - p.world.x, c.z - p.world.z);
    if (d < bd) (bd = d), (best = b);
  }
  if (best) return best;
  let bp = PICK_PX;
  for (const b of G.balls) {
    if (b.mode !== 'hole') continue;
    G.cam.worldToScreen(ballTop(b, _v), _scr);
    const d = Math.hypot(_scr.x - p.x, _scr.y - p.y);
    if (d < bp) (bp = d), (best = b);
  }
  return best;
}

function sendToSlot(G, ball, slot, back) {
  S.taken[slot] = 1;
  S.slotOf[ball.index] = slot;
  const plat = platter(G);
  ball.flyTo(slotWorld(G, slot, _v), {
    slot,
    parent: plat,
    dur: back ? 0.6 : 0.5,
    height: back ? 7 : 5,
    spin: 0.6,
    onLand: (b) => {
      // land exactly in the slot of the platter's current placement
      platterSlot(slot, b.group.position);
      b.group.getWorldPosition(_v);
      G.audio.play('pon', { vol: 0.9, pitch: 0.95 + Math.random() * 0.1, pan: Math.max(-1, Math.min(1, _v.x / 25)) });
      G.fx.steam(_v.setY(_v.y + BALL_R * 0.8), { count: 2, spread: 0.6, rise: 5, size: 2, life: 1.3 });
      G.hints.poke();
      if (back) {
        G.audio.play('yum', { vol: 0.8, delay: 0.15 });
        S.gag = 'done';
        S.doneT = 0;
        G.cam.focusOffset(null);
        return;
      }
      S.landed++;
      if (S.landed >= BALL_COUNT && S.gag === 'none') {
        S.gag = 'beat';
        S.gagT = 0;
        S.runner = b;
      }
    },
  });
}

function defineTool(G) {
  const def = {
    object: G.world.props.pick,
    rest() {
      const L = G.layout;
      restOut.pos.copy(L.pickRestPlate);
      restOut.pos.y = 0.46;
      // handle pointing away from the runaway stop (the ball must not end up on the pick)
      restOut.quat.setFromAxisAngle(UP, (L.pickRestPlateYaw || 0) + Math.PI).multiply(_q.setFromAxisAngle(X, Math.PI / 2));
      return restOut;
    },
    held(target) {
      heldOut.quat.copy(leanQ);
      if (S.held) heldOut.pos.copy(S.heldPos).addScaledVector(leanDir, -0.3);
      else {
        let y = RIM_Y + 0.8;
        for (const b of G.balls) {
          if (b.mode !== 'hole') continue;
          const c = centres[b.index];
          if (Math.hypot(target.x - c.x, target.z - c.z) < BALL_R) y = Math.max(y, RIM_Y + BALL_R * 0.85);
        }
        heldOut.pos.set(target.x, y, target.z);
      }
      return heldOut;
    },
  };
  const T = G.tools;
  const d = T.defs.pick;
  if (d && T.active === 'pick' && d.mode !== 'hidden' && d.mode !== 'slideOut') d.def = def; // keep the pick from 'flip'
  else {
    T.define('pick', def);
    T.bring('pick');
  }
}

export default {
  id: 'plate',
  enter(G) {
    S.held = null;
    S.slotOf.fill(-1);
    S.taken.fill(0);
    S.landed = 0;
    S.gag = 'none';
    S.runner = null;
    S.path = null;
    S.doneT = 0;
    // balls already on the platter (restored state) keep their slots
    for (const b of G.balls) {
      if (b.mode === 'slot') {
        S.taken[b.index] = 1;
        S.slotOf[b.index] = b.index;
        S.landed++;
      }
    }
    const plat = platter(G);
    if (!plat.parent) G.scene.add(plat);
    plat.visible = true;
    plat.rotation.set(0, 0, 0);
    S.slideFrom.copy(G.layout.platterSlideFrom);
    plat.position.copy(S.slideFrom);
    S.slideT = 0;
    G.audio.play('slide', { vol: 1, pitch: 0.9 });
    G.cam.frame('plate');
    G.input.planeY = RIM_Y + 1;
    defineTool(G);
    G.hints.set({
      tool: 'pick',
      targets: () => {
        const out = [];
        if (S.runner && (S.gag === 'wait' || S.gag === 'rock')) {
          out.push(ballTop(S.runner, tops[S.runner.index]));
          return out;
        }
        for (const b of G.balls) if (b.mode === 'hole') out.push(tops[b.index].copy(centres[b.index]).setY(RIM_Y + BALL_R * 0.95));
        return out;
      },
      demo: () => {
        let b = null;
        if (S.runner && S.gag === 'wait') b = S.runner;
        else b = G.balls.find((x) => x.mode === 'hole');
        if (!b) return null;
        const slot = b === S.runner ? S.slotOf[b.index] : freeSlotNear(G, 1e4, 1e4);
        if (slot < 0) return null;
        return [ballTop(b, new THREE.Vector3()), slotWorld(G, slot).setY(SLOT_Y + BALL_R)];
      },
    });
    this._layout ||= (L) => {
      if (G.flow.current !== this) return;
      if (S.slideT >= 1) platter(G).position.copy(L.platter);
      if (S.runner && (S.gag === 'wait' || S.gag === 'rock' || S.gag === 'roll')) {
        S.runner.group.position.set(L.runawayStop.x, BALL_R, L.runawayStop.z);
        S.gag = 'wait';
        S.gagT = 0;
        G.audio.setRoll(0);
        G.cam.focusOffset(S.runner.group.position, 0.2);
      }
    };
    if (!this._hooked) {
      this._hooked = true;
      G.onLayout((L) => this._layout(L));
    }
  },

  update(G, dt) {
    const plat = platter(G);
    // platter slides in
    if (S.slideT < 1) {
      S.slideT = Math.min(1, S.slideT + dt / SLIDE);
      plat.position.lerpVectors(S.slideFrom, G.layout.platter, easeOut(S.slideT));
    }

    // speared ball follows the finger
    if (S.held) {
      const T = G.tools;
      _v.set(T.target.x, LIFT_Y, T.target.z);
      S.heldPos.lerp(_v, 1 - Math.exp(-dt * 22));
      S.held.group.position.copy(S.heldPos);
    }

    // ---------- the runaway gag ----------
    const R = S.runner;
    if (S.gag !== 'none' && S.gag !== 'done') S.gagT += dt;
    if (S.gag === 'beat' && S.gagT > 0.7) {
      S.gag = 'tip';
      S.gagT = 0;
      // off the platter into the scene, free to roll
      G.scene.attach(R.group);
      R.mode = 'free';
      S.taken[S.slotOf[R.index]] = 1; // its place stays reserved
      S.path = buildPath(G, R);
    }
    if (S.gag === 'tip') {
      // it teeters... then goes
      const P = S.path;
      const k = S.gagT / 0.55;
      const want = Math.sin(Math.min(1, k) * Math.PI * 2.5) * 0.18 * (1 - k * 0.5);
      samplePath(P, Math.max(0, want), _v);
      R.rollBy(_v.x - R.group.position.x, _v.z - R.group.position.z);
      if (k >= 1) {
        S.gag = 'roll';
        S.gagT = 0;
        P.s = Math.max(0, want);
        P.v = 3;
      }
    } else if (S.gag === 'roll') {
      const P = S.path;
      // speeds up down the rim, then trundles and slows a little toward the housing
      const onTable = P.s > P.landS;
      const goal = onTable ? 11 - 4 * Math.min(1, (P.s - P.landS) / Math.max(1, P.len - P.landS)) : P.s > P.dropS ? 14 : 9;
      P.v += (goal - P.v) * Math.min(1, dt * 2.5);
      P.s = Math.min(P.len, P.s + P.v * dt);
      samplePath(P, P.s, _v);
      R.rollBy(_v.x - R.group.position.x, _v.z - R.group.position.z);
      let y = _v.y;
      if (onTable && !P.bounced) {
        P.bounced = true;
        P.bt = 0;
        G.audio.play('land', { vol: 0.7, pitch: 0.9 });
      }
      if (P.bounced && P.bt < 0.3) {
        P.bt += dt;
        y += Math.sin(Math.min(1, P.bt / 0.3) * Math.PI) * 0.4;
      }
      R.group.position.y = y;
      G.audio.setRoll(Math.min(1, P.v / 12) * 0.8);
      G.cam.focusOffset(R.group.position, 0.25);
      if (P.s >= P.len) {
        S.gag = 'rock';
        S.gagT = 0;
        G.audio.play('kotsun', { vol: 0.9 });
        G.audio.setRoll(0);
        G.cam.shake(0.35);
        S.rockT = 0;
        S.rockPrev = 0;
      }
    } else if (S.gag === 'rock' || S.gag === 'wait') {
      // bounce back ~0.6 cm and settle; then a little wobble every ~2 s
      S.rockT += dt;
      let off;
      if (S.gag === 'rock') {
        const t = S.rockT;
        off = 0.6 * (1 - Math.exp(-t / 0.12)) + 0.18 * Math.sin(t * 13) * Math.exp(-t / 0.25);
        if (t > 1.1) {
          S.gag = 'wait';
          S.gagT = 0;
          S.rockT = 0;
          G.audio.play('giggle', { vol: 0.85 });
        }
      } else {
        const t = S.rockT % 2;
        off = 0.6 + (t < 0.6 ? 0.28 * Math.sin(t * 18) * (1 - t / 0.6) : 0);
      }
      const d = off - (S.rockPrev || 0);
      S.rockPrev = off;
      const P = S.path;
      R.rollBy(P.back.x * d, P.back.z * d);
      R.group.position.y = BALL_R;
      G.cam.focusOffset(R.group.position, 0.2);
    } else if (S.gag === 'done') {
      S.doneT += dt;
      if (S.doneT > 0.4) G.flow.complete();
    }
  },

  exit(G) {
    G.audio.setRoll(0);
    G.cam.focusOffset(null);
    if (S.held) S.held = null;
  },

  onDown(G, p) {
    if (S.held || S.gag === 'done') return;
    const b = choose(G, p);
    if (!b) return;
    if (b === S.runner) {
      S.gag = 'back';
      G.audio.setRoll(0);
    }
    b.hold();
    S.held = b;
    b.group.getWorldPosition(S.heldPos);
    G.audio.play('stab', { vol: 0.9 });
    G.hints.poke();
  },
  onMove() {},
  onUp(G, p) {
    const b = S.held;
    if (!b) return;
    S.held = null;
    if (b === S.runner) {
      sendToSlot(G, b, S.slotOf[b.index], true);
      return;
    }
    // where was it released? (ray on the platter-top plane)
    let x = 1e4;
    let z = 1e4;
    const o = p.ray.origin;
    const dd = p.ray.direction;
    if (dd.y < -1e-3) {
      const t = (SLOT_Y + BALL_R - o.y) / dd.y;
      x = o.x + dd.x * t;
      z = o.z + dd.z * t;
    }
    const slot = freeSlotNear(G, x, z);
    if (slot >= 0) sendToSlot(G, b, slot, false);
  },
  fastForward(G) {
    canon.plated(G);
  },
  reset(G) {
    S.held = null;
    S.gag = 'none';
    S.runner = null;
    G.cam?.focusOffset?.(null);
  },
};
