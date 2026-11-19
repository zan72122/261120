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
