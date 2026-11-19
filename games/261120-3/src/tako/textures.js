// Procedural textures for the takoyaki surface and the toppings (generated once, cached).
import * as THREE from 'three';
import { pnoise2, mulberry } from './noise.js';

let detailTex = null;
let flakeTex = null;
let gradTex = null;
export const GRAD_K = 900; // slope encoding factor (slope per texel * GRAD_K)
export function getGradTexture() {
  if (!gradTex) getDetailTexture();
  return gradTex;
}

// Tileable RGBA data texture:
//  r = surface height (fine crust + pores), g = low-frequency mottle,
//  b = green onion fleck mask, a = red ginger fleck mask
export function getDetailTexture() {
  if (detailTex) return detailTex;
  const S = 256;
  const h = new Float32Array(S * S);
  const g = new Float32Array(S * S);
  const gb = new Float32Array(S * S);
  const ra = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const hh = 0.06 * pnoise2(u * 128, v * 128, 128, 4);
      h[y * S + x] = hh;
      g[y * S + x] = 0.6 * pnoise2(u * 3, v * 3, 3, 7) + 0.4 * pnoise2(u * 7, v * 7, 7, 8);
    }
  }
  const rnd = mulberry(1234);
  const wrapD = (d) => (d > S / 2 ? d - S : d < -S / 2 ? d + S : d);
  // isotropic soft lumps (no value-noise grid artifacts in the bump)
  for (let k = 0; k < 900; k++) {
    const cx = rnd() * S, cy = rnd() * S, rr = 3 + Math.pow(rnd(), 2.2) * 26, amp = (rnd() - 0.4) * (0.25 + rr / 40);
    const R = Math.ceil(rr * 2);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const px = ((Math.floor(cx) + dx) % S + S) % S, py = ((Math.floor(cy) + dy) % S + S) % S;
      const ddx = wrapD(px - cx), ddy = wrapD(py - cy);
      const d2 = (ddx * ddx + ddy * ddy) / (rr * rr);
      if (d2 < 4) h[py * S + px] += amp * Math.exp(-d2 * 1.5);
    }
  }
  // pores / tiny bubbles
  for (let k = 0; k < 240; k++) {
    const cx = rnd() * S, cy = rnd() * S, rr = 1.3 + rnd() * rnd() * 5, dep = 0.12 + rnd() * 0.28;
    const R = Math.ceil(rr + 1);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const px = ((Math.floor(cx) + dx) % S + S) % S, py = ((Math.floor(cy) + dy) % S + S) % S;
      const ddx = wrapD(px - cx), ddy = wrapD(py - cy);
      const d = Math.sqrt(ddx * ddx + ddy * ddy) / rr;
      if (d < 1) { const i = py * S + px; h[i] -= dep * (1 - d * d); }
      else if (d < 1.4) { const i = py * S + px; h[i] += dep * 0.25 * (1.4 - d); } // raised rim
    }
  }
  // blobs (irregular) into a mask
  const blob = (mask, cx, cy, ax, ay, ang, val, rough) => {
    const R = Math.ceil(Math.max(ax, ay) + 2);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ph = rnd() * 6.28;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const px = ((Math.floor(cx) + dx) % S + S) % S, py = ((Math.floor(cy) + dy) % S + S) % S;
      const ddx = wrapD(px - cx), ddy = wrapD(py - cy);
      const lx = (ddx * ca + ddy * sa) / ax, ly = (-ddx * sa + ddy * ca) / ay;
      const a = Math.atan2(ly, lx);
      const edge = 1 + rough * (Math.sin(a * 3 + ph) * 0.5 + Math.sin(a * 5 + ph * 2) * 0.3);
      const d = Math.sqrt(lx * lx + ly * ly) / edge;
      if (d < 1.15) {
        const i = py * S + px;
        mask[i] = Math.max(mask[i], val * Math.min(1, (1.15 - d) / 0.3));
      }
    }
  };
  for (let k = 0; k < 7; k++) {
    const s = 5 + rnd() * 9;
    blob(gb, rnd() * S, rnd() * S, s, s * (0.5 + rnd() * 0.5), rnd() * 6.28, 0.55 + rnd() * 0.45, 0.25);
  }
  for (let k = 0; k < 3; k++) {
    blob(ra, rnd() * S, rnd() * S, 9 + rnd() * 9, 1.6 + rnd() * 1.6, rnd() * 6.28, 0.6 + rnd() * 0.4, 0.15);
  }
  const data = new Uint8Array(S * S * 4);
  let mn = 1e9, mx = -1e9;
  for (let i = 0; i < S * S; i++) { mn = Math.min(mn, h[i]); mx = Math.max(mx, h[i]); }
  for (let i = 0; i < S * S; i++) {
    data[i * 4] = Math.round(((h[i] - mn) / (mx - mn)) * 255);
    data[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, g[i])) * 255);
    data[i * 4 + 2] = Math.round(gb[i] * 255);
    data[i * 4 + 3] = Math.round(ra[i] * 255);
  }
  // gradient texture: r,g = height slope (per texel, *GRAD_K, biased), b = height, a = mottle
  const gd = new Uint8Array(S * S * 4);
  const hn = (x, y) => (h[(((y % S) + S) % S) * S + (((x % S) + S) % S)] - mn) / (mx - mn);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const gx = (hn(x + 1, y) - hn(x - 1, y)) * 0.5, gy = (hn(x, y + 1) - hn(x, y - 1)) * 0.5;
    const i = (y * S + x) * 4;
    gd[i] = Math.max(0, Math.min(255, Math.round(128 + gx * GRAD_K)));
    gd[i + 1] = Math.max(0, Math.min(255, Math.round(128 + gy * GRAD_K)));
    gd[i + 2] = data[i];
    gd[i + 3] = data[i + 1];
  }
  gradTex = new THREE.DataTexture(gd, S, S, THREE.RGBAFormat);
  gradTex.wrapS = gradTex.wrapT = THREE.RepeatWrapping;
  gradTex.magFilter = THREE.LinearFilter;
  gradTex.minFilter = THREE.LinearMipmapLinearFilter;
  gradTex.generateMipmaps = true;
  gradTex.anisotropy = 4;
  gradTex.needsUpdate = true;
  detailTex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.magFilter = THREE.LinearFilter;
  detailTex.minFilter = THREE.LinearMipmapLinearFilter;
  detailTex.generateMipmaps = true;
  detailTex.anisotropy = 4;
  detailTex.needsUpdate = true;
  return detailTex;
}

// Katsuobushi shaving: fibrous pink-tan, ragged translucent edges (alpha). u across, v along length.
export function getFlakeTexture() {
  if (flakeTex) return flakeTex;
  const W = 64, H = 128;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const fib = pnoise2(u * 22, v * 2.5, 22, 11) * 0.6 + pnoise2(u * 50, v * 5, 50, 12) * 0.4;
      const edgeN = pnoise2(v * 14, 0.5, 14, 13) * 0.5 + pnoise2(v * 40, 1.5, 40, 14) * 0.5;
      const half = 0.5 - Math.abs(u - 0.5); // 0 at the side edges
      const tip = Math.min(v, 1 - v);
      let a = half * 2 - (0.1 + edgeN * 0.55);
      a = Math.min(a, tip * 7 - edgeN * 0.5);
      // a few holes / tears
      const hole = pnoise2(u * 9, v * 9, 9, 15);
      if (hole > 0.8) a -= (hole - 0.8) * 6;
      const alpha = a > 0 ? Math.min(1, a * 6) : 0;
      // colour: pale pink-tan with darker red-brown fibres
      const dark = fib;
      const r = 232 - dark * 45, gg = 186 - dark * 55, b = 160 - dark * 45;
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = gg; data[i + 2] = b; data[i + 3] = Math.round(alpha * 255);
    }
  }
  flakeTex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  flakeTex.colorSpace = THREE.SRGBColorSpace;
  flakeTex.magFilter = THREE.LinearFilter;
  flakeTex.minFilter = THREE.LinearMipmapLinearFilter;
  flakeTex.generateMipmaps = true;
  flakeTex.needsUpdate = true;
  return flakeTex;
}
