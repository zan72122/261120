// Procedural textures (DataTextures generated at startup; all tileable).
import * as THREE from 'three';
import { rng } from './geom.js';

// ---------- periodic value noise ----------
function hash(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// value noise with period px, py (lattice units)
export function vnoise(x, y, px, py, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % px) + px) % px, x1 = (x0 + 1) % px;
  const y0 = ((iy % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hash(x0, y0, seed), b = hash(x1, y0, seed), c = hash(x0, y1, seed), d = hash(x1, y1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(u, v, fx, fy, oct, seed) {
  let s = 0, amp = 0.5, n = 0;
  for (let o = 0; o < oct; o++) {
    s += amp * vnoise(u * fx, v * fy, fx, fy, seed + o * 17);
    n += amp; amp *= 0.5; fx *= 2; fy *= 2;
  }
  return s / n;
}

function tex(data, size, { srgb = false, repeat = [1, 1], aniso = 4 } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// Height array -> tangent-space normal map (RGBA)
function heightToNormal(h, size, strength) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const xl = (x - 1 + size) % size, xr = (x + 1) % size, yu = (y - 1 + size) % size, yd = (y + 1) % size;
      const dx = (h[y * size + xr] - h[y * size + xl]) * strength;
      const dy = (h[yd * size + x] - h[yu * size + x]) * strength;
      const l = Math.hypot(dx, dy, 1);
      const k = (y * size + x) * 4;
      out[k] = (-dx / l * 0.5 + 0.5) * 255;
      out[k + 1] = (dy / l * 0.5 + 0.5) * 255; // DataTexture is not flipped: +v = +y rows
      out[k + 2] = (1 / l * 0.5 + 0.5) * 255;
      out[k + 3] = 255;
    }
  return out;
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// ---------- table wood: planks along u (x), seams along u ----------
// Texture covers tileU x tileV cm. Returns { map, roughnessMap, bumpMap }
export function tableWood(size, aniso) {
  const N = size * size;
  const col = new Uint8Array(N * 4), rough = new Uint8Array(N * 4), bump = new Uint8Array(N * 4);
  const planks = 6; // across v
  const R = rng(7);
  const pk = [];
  for (let p = 0; p < planks; p++) pk.push({ tint: R() * 0.16 - 0.08, hue: R() * 0.06 - 0.03, ring: 5 + R() * 6, off: R() * 10, seed: p * 31 + 3, smudge: R() });
  // two-tone walnut/oak colour (sRGB 0..1)
  const light = [0.56, 0.37, 0.22], dark = [0.32, 0.19, 0.105];
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const pv = v * planks;
    const pi = Math.floor(pv), lv = pv - pi;
    const P = pk[pi];
    const edge = Math.min(lv, 1 - lv) * (140 / planks); // in ~cm-ish units across plank
    const seam = Math.max(0, 1 - edge / 0.12); // dark seam line
    const bevel = Math.max(0, 1 - edge / 0.5);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warp = fbm(u, v, 3, 6, 3, P.seed) - 0.5;
      const rings = (lv * P.ring + warp * 2.2 + P.off) % 1;
      const late = Math.pow(Math.abs(Math.sin(rings * Math.PI)), 6); // latewood bands
      const streak = vnoise(u * 24, v * 220, 24, 220, P.seed + 5);
      const fine = vnoise(u * 64, v * 700, 64, 700, P.seed + 9);
      const poreN = vnoise(u * 180, v * 1300, 180, 1300, P.seed + 11);
      const pore = poreN > 0.78 ? (poreN - 0.78) / 0.22 : 0;
      const smudge = fbm(u, v, 4, 4, 2, 99) ;
      let t = 0.45 + late * 0.35 + (streak - 0.5) * 0.35 + (fine - 0.5) * 0.18 + P.tint * 2;
      t = Math.min(1, Math.max(0, t));
      const k = (y * size + x) * 4;
      let r = light[0] + (dark[0] - light[0]) * t, g = light[1] + (dark[1] - light[1]) * t, b = light[2] + (dark[2] - light[2]) * t;
      r += P.hue; b -= P.hue * 0.5;
      const pd = 1 - pore * 0.45 - seam * 0.7;
      col[k] = clamp255(r * pd * 255); col[k + 1] = clamp255(g * pd * 255); col[k + 2] = clamp255(b * pd * 255); col[k + 3] = 255;
      // satin finish: base 0.42, pores/seams rougher, faint smudges glossier/rougher
      const rr = 0.4 + pore * 0.25 + seam * 0.3 + (smudge - 0.5) * 0.22 + late * 0.05;
      rough[k] = rough[k + 1] = rough[k + 2] = clamp255(rr * 255); rough[k + 3] = 255;
      const hh = 0.6 - pore * 0.35 - bevel * bevel * 0.6 + (fine - 0.5) * 0.08 + late * 0.04;
      bump[k] = bump[k + 1] = bump[k + 2] = clamp255(hh * 255); bump[k + 3] = 255;
    }
  }
  const o = { srgb: false, aniso };
  return { map: tex(col, size, { ...o, srgb: true }), roughnessMap: tex(rough, size, o), bumpMap: tex(bump, size, o) };
}

// ---------- turned / small wood (grain along v) ----------
export function smallWood(size, base = [0.62, 0.45, 0.28], darkC = [0.42, 0.27, 0.15], seed = 3) {
  const col = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const w = fbm(u, v, 4, 2, 3, seed) - 0.5;
      const rings = (u * 9 + w * 2) % 1;
      const late = Math.pow(Math.abs(Math.sin(rings * Math.PI)), 5);
      const fine = vnoise(u * 90, v * 8, 90, 8, seed + 4);
      let t = 0.35 + late * 0.45 + (fine - 0.5) * 0.3;
      t = Math.min(1, Math.max(0, t));
      const k = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) col[k + c] = clamp255((base[c] + (darkC[c] - base[c]) * t) * 255);
      col[k + 3] = 255;
    }
  return tex(col, size, { srgb: true });
}

// ---------- non-stick coated metal: micro speckle normal + roughness ----------
export function coatedMetal(size) {
  const N = size * size;
  const h = new Float32Array(N);
  const rough = new Uint8Array(N * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const s1 = vnoise(u * 160, v * 160, 160, 160, 5);
      const s2 = vnoise(u * 60, v * 60, 60, 60, 6);
      const blot = fbm(u, v, 5, 5, 3, 8);
      h[y * size + x] = s1 * 0.6 + s2 * 0.4;
      const k = (y * size + x) * 4;
      // oil sheen: glossier blotches
      const r = 0.42 + (s1 - 0.5) * 0.12 - Math.max(0, blot - 0.52) * 0.9;
      rough[k] = rough[k + 1] = rough[k + 2] = clamp255(r * 255); rough[k + 3] = 255;
    }
  return { normalMap: tex(heightToNormal(h, size, 1.6), size), roughnessMap: tex(rough, size) };
}

// ---------- speckled stoneware glaze ----------
export function stoneware(size, base = [0.93, 0.91, 0.86], seed = 21) {
  const col = new Uint8Array(size * size * 4), rough = new Uint8Array(size * size * 4);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const sp = vnoise(u * 220, v * 220, 220, 220, seed);
      const sp2 = vnoise(u * 90, v * 90, 90, 90, seed + 1);
      const cloud = fbm(u, v, 3, 3, 3, seed + 2);
      const dot = sp > 0.86 ? Math.min(1, (sp - 0.86) / 0.06) : 0;
      const dot2 = sp2 > 0.9 ? Math.min(1, (sp2 - 0.9) / 0.05) * 0.6 : 0;
      const k = (y * size + x) * 4;
      const shade = 1 - (cloud - 0.5) * 0.06;
      const dd = Math.max(dot, dot2);
      col[k] = clamp255((base[0] * shade * (1 - dd * 0.55)) * 255);
      col[k + 1] = clamp255((base[1] * shade * (1 - dd * 0.6)) * 255);
      col[k + 2] = clamp255((base[2] * shade * (1 - dd * 0.68)) * 255);
      col[k + 3] = 255;
      const r = 0.16 + (cloud - 0.5) * 0.08 + dd * 0.1;
      rough[k] = rough[k + 1] = rough[k + 2] = clamp255(r * 255); rough[k + 3] = 255;
      h[y * size + x] = cloud * 0.6 + dd * 0.2;
    }
  return { map: tex(col, size, { srgb: true }), roughnessMap: tex(rough, size), normalMap: tex(heightToNormal(h, size, 0.9), size) };
}

// ---------- katsuobushi flake: streaky colour + ragged alpha ----------
export function flakeTex(size) {
  const col = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const streak = vnoise(u * 3, v * 40, 3, 40, 41);
      const fine = vnoise(u * 8, v * 120, 8, 120, 42);
      // ragged elliptical outline
      const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
      const ang = Math.atan2(dy, dx);
      const rag = 0.82 + (vnoise(Math.cos(ang) * 2.5 + 8, Math.sin(ang) * 2.5 + 8, 64, 64, 43) - 0.5) * 0.4;
      const d = Math.hypot(dx * 0.95, dy * 1.05);
      const a = d < rag ? 255 : 0;
      const t = streak * 0.6 + fine * 0.4;
      const edge = Math.max(0, d / rag - 0.7) / 0.3;
      const k = (y * size + x) * 4;
      // pink-tan with darker streaks, paler (thinner) at edges
      col[k] = clamp255((0.80 - t * 0.22 + edge * 0.08) * 255);
      col[k + 1] = clamp255((0.56 - t * 0.2 + edge * 0.1) * 255);
      col[k + 2] = clamp255((0.43 - t * 0.17 + edge * 0.1) * 255);
      col[k + 3] = a;
    }
  const t = tex(col, size, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------- 1D gradient alpha (ghost finger: opaque at v=0 -> 0 at v=1) ----------
export function fadeAlpha(size = 128, from = 0.45, to = 0.92) {
  const col = new Uint8Array(4 * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const t = Math.min(1, Math.max(0, (v - from) / (to - from)));
    const a = (1 - t * t * (3 - 2 * t)) * 255;
    for (let x = 0; x < 4; x++) {
      const k = (y * 4 + x) * 4;
      col[k] = col[k + 1] = col[k + 2] = a; col[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(col, 4, size, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// ---------- dusk window ----------
export function windowTex(size = 256) {
  const col = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = y / size, u = x / size;
      // bottom (v=0) warm hazy horizon -> top deep blue
      const t = v;
      let r = 0.42 * (1 - t) + 0.07 * t, g = 0.36 * (1 - t) + 0.12 * t, b = 0.42 * (1 - t) + 0.28 * t;
      // a few blurred distant lights low in the window
      const l = vnoise(u * 18, v * 18, 18, 18, 77);
      if (v < 0.3 && l > 0.83) { const s = (l - 0.83) * 5; r += s * 0.5; g += s * 0.35; b += s * 0.1; }
      const k = (y * size + x) * 4;
      col[k] = clamp255(r * 255); col[k + 1] = clamp255(g * 255); col[k + 2] = clamp255(b * 255); col[k + 3] = 255;
    }
  const t = tex(col, size, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------- linen weave (bump) ----------
export function linen(size = 256) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const wx = Math.sin(u * Math.PI * 2 * 64), wy = Math.sin(v * Math.PI * 2 * 64);
      const slub = vnoise(u * 8, v * 64, 8, 64, 3) * 0.5 + vnoise(u * 64, v * 8, 64, 8, 4) * 0.5;
      h[y * size + x] = (Math.abs(wx) * 0.5 + Math.abs(wy) * 0.5) * 0.6 + slub * 0.4;
    }
  return tex(heightToNormal(h, size, 1.2), size);
}

// ---------- generic soft noise (roughness variation / smudges) ----------
export function smudge(size = 256, lo = 0.3, hi = 0.5, seed = 5) {
  const col = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = fbm(x / size, y / size, 4, 4, 4, seed);
      const k = (y * size + x) * 4;
      col[k] = col[k + 1] = col[k + 2] = clamp255((lo + (hi - lo) * n) * 255); col[k + 3] = 255;
    }
  return tex(col, size);
}
