// TAKO module entry: 12 takoyaki balls + toppings.
import * as THREE from 'three';
import { BALL_COUNT } from '../config.js';
import { createBall } from './ball.js';
import { createBits } from './bits.js';
import { makeFilling } from './filling.js';

const W_SEG = 28, H_SEG = 20;

function sharedSphere() {
  const sg = new THREE.SphereGeometry(1, W_SEG, H_SEG);
  const p = sg.attributes.position;
  const N = p.count;
  const base = new Float32Array(N * 3);
  const area = new Float32Array(N);
  const canon = new Int32Array(N);
  const keyMap = new Map();
  for (let i = 0; i < N; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    x /= l; y /= l; z /= l;
    base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z;
    const iy = Math.floor(i / (W_SEG + 1));
    area[i] = Math.max(0.02, Math.sin((iy / H_SEG) * Math.PI));
    const k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (keyMap.has(k)) canon[i] = keyMap.get(k);
    else { keyMap.set(k, i); canon[i] = i; }
  }
  // duplicated seam/pole vertices should not count twice
  for (let i = 0; i < N; i++) if (canon[i] !== i) area[i] = 0;
  const idx = sg.index.array;
  const tris = idx instanceof Uint16Array ? idx : Uint16Array.from(idx);
  return {
    N, base, area, canon, tris,
    index: new THREE.BufferAttribute(tris, 1),
    aObj: new THREE.BufferAttribute(base.slice(), 3),
    wS: W_SEG, hS: H_SEG,
    bits: null,
  };
}

export function createTako(G) {
  if (G.renderer) G.renderer.localClippingEnabled = true; // bitten balls clip with a per-ball plane
  const S = sharedSphere();
  const balls = [];
  for (let i = 0; i < BALL_COUNT; i++) balls.push(createBall(G, i, S));
  const bits = createBits(G, balls);
  S.bits = bits;

  return {
    balls,
    bits,
    makeFilling,
    update(dt) {
      const t = G.time || 0;
      for (let i = 0; i < balls.length; i++) balls[i].update(dt, t);
      bits.update(dt);
    },
    resetAll() {
      bits.clear();
      for (const b of balls) b.reset();
    },
  };
}
