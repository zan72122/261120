// Shared helpers for the phase scripts + the canonical end states used when a phase is fast-forwarded
// (restoring a save / starting from a checkpoint).
import * as THREE from 'three';
import { RIM_Y, BALL_COUNT, COLS, ROWS, holeCenter, platterSlot } from '../config.js';

const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Which filling goes into which hole this round (8 octopus, 2 cheese, 2 sausage), kept in the save.
export function planFillings(G) {
  const s = G.state;
  if (!Array.isArray(s.fillings) || s.fillings.length !== BALL_COUNT || s.fillings.some((f) => !f)) {
    const kinds = ['octopus', 'octopus', 'octopus', 'octopus', 'octopus', 'octopus', 'octopus', 'octopus', 'cheese', 'cheese', 'sausage', 'sausage'];
    const r = rng(1234 + (s.round || 0) * 77);
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    s.fillings = kinds;
  }
  return s.fillings;
}

// Hole/slot indices ordered as a lazy serpentine (far row left→right, next row right→left, …).
export function serpentineOrder(indices) {
  const set = new Set(indices);
  const out = [];
  for (let row = 0; row < ROWS; row++) {
    for (let c = 0; c < COLS; c++) {
      const col = row % 2 === 0 ? c : COLS - 1 - c;
      const i = row * COLS + col;
      if (set.has(i)) out.push(i);
    }
  }
  return out;
}

// Nearest ball (xz distance) to a world point among balls passing `filter`. Returns null if none within maxDist.
export function nearestBall(G, pos, filter, maxDist = Infinity) {
  let best = null;
  let bd = maxDist;
  for (const b of G.balls) {
    if (filter && !filter(b)) continue;
    b.group.getWorldPosition(_v);
    const d = Math.hypot(_v.x - pos.x, _v.z - pos.z);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

// World position of platter slot i for the current layout.
export function slotWorld(G, i, out = new THREE.Vector3()) {
  return platterSlot(i, out).add(G.layout.platter);
}

export function showPlatter(G) {
  const p = G.world.props.platter;
  if (!p.parent) G.scene.add(p);
  p.visible = true;
  p.position.copy(G.layout.platter);
  p.rotation.set(0, 0, 0);
  return p;
}

export const canon = {
  // after 'pour': every hole full, overflow sheet everywhere, cooking held back
  poured(G) {
    G.state.heat = true;
    G.world.setPower?.(true);
    for (const b of G.balls) {
      b.fill = 1;
      b.skirt = 1;
      b.cookCap = 0.42;
    }
  },
  // after 'fill'
  filled(G) {
    const plan = planFillings(G);
    for (const b of G.balls) if (!b.filling) b.setFilling(plan[b.index]);
  },
  // after 'sprinkle': a few bits on every ball
  sprinkled(G) {
    const kinds = ['negi', 'tenkasu', 'beni'];
    const r = rng(99 + (G.state.round || 0));
    for (const b of G.balls) {
      const c = holeCenter(b.index, new THREE.Vector3());
      for (let k = 0; k < 6; k++) {
        const a = r() * 6.283;
        const d = Math.sqrt(r()) * 1.5;
        _v.set(c.x + Math.cos(a) * d, RIM_Y + 0.15, c.z + Math.sin(a) * d);
        G.bits.place(kinds[k % 3], _v, UP, b);
      }
    }
  },
  // after 'flip': 12 round golden balls, plate switched off
  cooked(G) {
    for (const b of G.balls) {
      b.cookCap = 1;
      b.cookAll();
    }
    G.state.heat = false;
    G.world.setPower?.(false);
  },
  // after 'plate': all balls resting on the platter
  plated(G) {
    const platter = showPlatter(G);
    for (const b of G.balls) {
      b.flyTo(slotWorld(G, b.index), { dur: 0.01, height: 0, spin: 0, slot: b.index, parent: platter });
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Dressing helpers (sauce / mayo / flakes / eat). Everything works on balls resting on the platter.
const _d = { o: new THREE.Vector3(), dir: new THREE.Vector3(), c: new THREE.Vector3(), l: new THREE.Vector3(), q: new THREE.Vector3() };

// Balls still on the platter (or landing there).
export function dressBalls(G, out = []) {
  out.length = 0;
  for (const b of G.balls) if (b.mode === 'slot' || b.mode === 'fly' || b.mode === 'free') out.push(b);
  return out;
}

// World y of the platter's inner surface / of the tops of the balls resting on it.
export function platterTopY(G) {
  const p = G.world.props.platter;
  return (p && p.visible ? p.position.y : 0) + G.cfg.PLATTER.surfaceY;
}
export function ballTopY(G) {
  return platterTopY(G) + G.cfg.BALL_R * 1.97;
}

// Keep the platter (and the balls parented to it) at the current layout spot.
export function syncPlatter(G) {
  const p = G.world.props.platter;
  if (p && p.visible && !p.position.equals(G.layout.platter)) p.position.copy(G.layout.platter);
}

// Takoyaki stay hot on the platter until eaten (steam + dancing flakes).
export function keepWarm(G, min = 0.6) {
  for (const b of G.balls) if (b.mode !== 'gone' && b.mode !== 'hole' && b.heat < min) b.heat = min;
}

// Finish the instant landing flights started by canon.plated so positions are final.
export function settleBalls(G) {
  for (const b of G.balls) if (b.mode === 'fly') b.update(0.05, G.time || 0);
}

// Clamp a world point (xz) into the platter rectangle shrunk by `inset`.
export function clampToPlatter(G, v, inset = 1) {
  const P = G.cfg.PLATTER;
  const c = G.layout.platter;
  const hx = P.w / 2 - inset;
  const hz = P.d / 2 - inset;
  v.x = Math.max(c.x - hx, Math.min(c.x + hx, v.x));
  v.z = Math.max(c.z - hz, Math.min(c.z + hz, v.z));
  return v;
}

// What is under the screen point through which the camera sees `target`?
// Returns the shared hit object { point, normal, ball|null, onPlatter, gapY }.
const HIT = { point: new THREE.Vector3(), normal: new THREE.Vector3(), ball: null, onPlatter: false };
export function dressHit(G, target) {
  const { o, dir, c, l } = _d;
  o.copy(G.camera.position);
  dir.subVectors(target, o).normalize();
  const R = G.cfg.BALL_R * 1.02;
  let best = Infinity;
  HIT.ball = null;
  for (const b of G.balls) {
    if (b.mode !== 'slot' && b.mode !== 'free' && b.mode !== 'fly') continue;
    if (!b.group.visible) continue;
    b.mesh.getWorldPosition(c);
    l.subVectors(c, o);
    const tca = l.dot(dir);
    const d2 = l.lengthSq() - tca * tca;
    if (d2 > R * R) continue;
    const t0 = tca - Math.sqrt(R * R - d2);
    if (t0 > 0 && t0 < best) {
      best = t0;
      HIT.ball = b;
    }
  }
  if (HIT.ball) {
    HIT.point.copy(o).addScaledVector(dir, best);
    HIT.ball.mesh.getWorldPosition(c);
    HIT.normal.subVectors(HIT.point, c).normalize();
    if (HIT.normal.y > 0.2) {
      const tp = HIT.ball.topPointAt(HIT.point.x, HIT.point.z, l);
      if (tp) HIT.point.y = tp.y;
    }
    HIT.onPlatter = true;
    return HIT;
  }
  const py = platterTopY(G);
  const t = dir.y < -1e-4 ? (py - o.y) / dir.y : 100;
  HIT.point.copy(o).addScaledVector(dir, t);
  HIT.normal.set(0, 1, 0);
  const P = G.cfg.PLATTER;
  const pc = G.layout.platter;
  HIT.onPlatter = Math.abs(HIT.point.x - pc.x) < P.w / 2 - 0.5 && Math.abs(HIT.point.z - pc.z) < P.d / 2 - 0.5;
  if (!HIT.onPlatter) {
    const t2 = dir.y < -1e-4 ? -o.y / dir.y : 100;
    HIT.point.copy(o).addScaledVector(dir, t2);
  }
  return HIT;
}

// Highest surface straight below (x, z): a ball top (returns it) or the platter. out.y is set.
export function surfaceBelowXZ(G, x, z, out) {
  let bestB = null;
  let by = -Infinity;
  for (const b of G.balls) {
    if (b.mode !== 'slot' && b.mode !== 'free') continue;
    b.mesh.getWorldPosition(_d.c);
    if (Math.abs(_d.c.x - x) > 2.3 || Math.abs(_d.c.z - z) > 2.3) continue;
    const tp = b.topPointAt(x, z, _d.q);
    if (tp && tp.y > by) {
      by = tp.y;
      bestB = b;
    }
  }
  out.set(x, bestB ? by : platterTopY(G), z);
  return bestB;
}

// Deterministic mayonnaise zigzag over every row (platter-local xz points, ~0.28 cm apart).
export function mayoZigzag(G) {
  const P = G.cfg.PLATTER;
  const pts = [];
  const pitch = P.slotPitch;
  for (let row = 0; row < ROWS; row++) {
    const z0 = (row - (ROWS - 1) / 2) * pitch;
    const dirX = row % 2 === 0 ? 1 : -1;
    const span = pitch * 1.5 + 0.8;
    let x = -span;
    while (x <= span) {
      const zz = z0 + Math.sin((x + row) * 1.9) * 1.15;
      pts.push(new THREE.Vector3(x * dirX, 0, zz));
      x += 0.2;
    }
  }
  return pts;
}

// Canonical end states of the dressing phases.
canon.sauced = (G) => {
  settleBalls(G);
  const R = G.cfg.BALL_R;
  for (const b of G.balls) {
    if (b.mode === 'gone') continue;
    b.mesh.getWorldPosition(_d.c);
    for (let th = 0; th <= 66; th += 13) {
      const n = th === 0 ? 1 : Math.round(th / 7);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + th;
        const s = Math.sin((th * Math.PI) / 180);
        _v.set(Math.cos(a) * s, Math.cos((th * Math.PI) / 180), Math.sin(a) * s).multiplyScalar(R).add(_d.c);
        b.paintSauce(_v, 1.5, 1);
      }
    }
  }
};
canon.mayoed = (G) => {
  settleBalls(G);
  const pc = G.layout.platter;
  for (const p of mayoZigzag(G)) {
    const b = surfaceBelowXZ(G, pc.x + p.x, pc.z + p.z, _v);
    if (b) {
      b.mesh.getWorldPosition(_d.c);
      _d.l.subVectors(_v, _d.c).normalize();
      G.bits.place('mayo', _v, _d.l, b);
    } else G.bits.place('mayo', _v, UP, null);
  }
};
canon.flaked = (G) => {
  settleBalls(G);
  const r = rng(555 + (G.state.round || 0));
  const R = G.cfg.BALL_R;
  for (const b of G.balls) {
    if (b.mode === 'gone') continue;
    b.mesh.getWorldPosition(_d.c);
    for (let k = 0; k < 20; k++) {
      const a = r() * Math.PI * 2;
      const th = Math.sqrt(r()) * (k < 8 ? 0.9 : 1.1);
      _d.l.set(Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th));
      _v.copy(_d.l).multiplyScalar(R).add(_d.c);
      const tp = b.topPointAt(_v.x, _v.z, _d.q);
      if (tp) _v.y = tp.y;
      G.bits.place(k < 8 ? 'flake' : 'aonori', _v, _d.l, b);
    }
  }
};
canon.eaten = (G) => {
  for (const b of G.balls) {
    if (b.mode === 'gone') continue;
    b.bite();
    b.bite();
    G.bits.removeOwner(b);
  }
};
