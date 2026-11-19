// fishtex.js — 金魚のテクスチャの「画素の計算」だけ（DOM・three を使わない純粋な計算）。
// メインスレッドでも Worker（texworker.js）でも同じ関数で同じ画素を作る。
//   bodyPixels(kind, seed) -> { rgba, bump }  胴の色（512x256 RGBA）とバンプ（同サイズ RGBA）
//   finPixels(kind, seed)  -> rgba            ひれ（128x128 RGBA）
//   eyePixels()            -> rgba            目（64x64 RGBA）
// うろこの網目などの canvas 2D での描き足しは fish.js 側（メインスレッド）で行う。
export const TEX = { BODY_W: 512, BODY_H: 256, FIN_W: 128, FIN_H: 128, EYE_W: 64, EYE_H: 64 };
export const S_END = 1.05;

// ---------- 小さな乱数・ノイズ ----------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
export function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function fbm3(x, y, z, s, oct = 4) {
  let a = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { a += amp * vnoise3(x * f, y * f, z * f, s + i * 17); n += amp; amp *= 0.5; f *= 2.03; }
  return a / n;
}
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
export const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ---------- 色 ----------
export const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
export function bodyColor(kind, s, d, v, n, n2) {
  // d: 1=背 0=腹, n,n2: 0..1 ノイズ
  if (kind === 'wakin') {
    let c = mix3(C(0xe8903a), C(0xd23c10), sstep(0.08, 0.42, d));
    c = mix3(c, C(0x9a1c06), sstep(0.58, 1.0, d) * 0.85);
    // 頭の下（あご）は少し黄色、えらぶた周りは赤
    c = mix3(c, C(0xf2a050), sstep(0.18, 0.0, s) * sstep(0.45, 0.1, d) * 0.6);
    const k = 0.93 + 0.14 * n;
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  if (kind === 'sarasa') {
    const white = mix3(C(0xf4efe6), C(0xe9e2d6), n2 * 0.6);
    const red = mix3(C(0xd2361a), C(0xb8260f), sstep(0.6, 1, d) * 0.7);
    let bias = 0.30 * sstep(0.35, 0.95, d) - 0.55 * sstep(0.42, 0.08, d);
    bias += 0.30 * sstep(0.26, 0.12, s) * sstep(0.35, 0.8, d); // 頭の上は赤
    bias -= 0.6 * sstep(0.06, 0.0, s);                        // 口先は白
    bias -= 0.25 * sstep(0.85, 1.02, s);                      // 尾柄は白っぽい
    const r = sstep(0.47, 0.55, n + bias);
    const c = mix3(white, red, r);
    const k = 0.95 + 0.08 * n2;
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  // ryukin: 赤主体、腹と下側面に白
  const white = mix3(C(0xf5f0e8), C(0xeae2d4), n2 * 0.5);
  const red = mix3(C(0xe0461c), C(0xbe2c10), sstep(0.55, 1, d) * 0.8);
  let bias = 0.55 * sstep(0.12, 0.62, d) - 0.22;
  bias -= 0.35 * sstep(0.05, 0.0, s);
  const r = sstep(0.45, 0.53, n * 0.75 + 0.12 + bias);
  const c = mix3(white, red, r);
  const k = 0.94 + 0.1 * n2;
  return [c[0] * k, c[1] * k, c[2] * k];
}

// 胴: 色（RGBA）とバンプ（グレー RGBA）
export function bodyPixels(kind, seed) {
  const W = TEX.BODY_W, H = TEX.BODY_H;
  const rgba = new Uint8ClampedArray(W * H * 4), bump = new Uint8ClampedArray(W * H * 4);
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H, ang = Math.PI * 2 * v;
    const cy = Math.cos(ang), sy = Math.sin(ang);
    const d = 1 - Math.abs(v - 0.5) * 2;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W, s = u * S_END;
      const n = fbm3(s * 3.4, cy * 1.25 + 3, sy * 1.25, seed, 4);
      const n2 = fbm3(s * 14, cy * 5, sy * 5, seed + 99, 3);
      const col = bodyColor(kind, s, d, v, n, n2);
      const i = (py * W + px) * 4;
      rgba[i] = clamp(col[0], 0, 255); rgba[i + 1] = clamp(col[1], 0, 255); rgba[i + 2] = clamp(col[2], 0, 255); rgba[i + 3] = 255;
      const bb = 128 + (n2 - 0.5) * 18;
      bump[i] = bump[i + 1] = bump[i + 2] = bb; bump[i + 3] = 255;
    }
  }
  return { rgba, bump };
}

// ひれ（RGBA、アルファあり）
export function finPixels(kind, seed) {
  const W = TEX.FIN_W, H = TEX.FIN_H;
  const rgba = new Uint8ClampedArray(W * H * 4);
  const rays = kind === 'ryukin' ? 22 : 18;
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W; // 付け根 0 → 先 1
      const n = fbm3(u * 3, v * 3, 0.5, seed, 3);
      // 鰭条（すじ）: v 方向に並ぶ。先へ行くと 2 本に分かれる雰囲気
      const nr = rays * (u > 0.55 ? 2 : 1);
      const ray = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * 2 * v * nr + (u > 0.55 ? Math.PI : 0)), 5);
      const joint = 0.85 + 0.15 * Math.pow(0.5 + 0.5 * Math.cos(u * 70), 8);
      let col, a;
      if (kind === 'wakin') {
        col = mix3(C(0xe0541c), C(0xf08a48), sstep(0.2, 1, u));
        a = mix(0.8, 0.28, Math.pow(u, 1.1));
      } else if (kind === 'sarasa') {
        col = mix3(C(0xd9583a), C(0xf2e6dc), sstep(0.05, 0.45, u + (n - 0.5) * 0.4));
        a = mix(0.7, 0.24, Math.pow(u, 1.0));
      } else {
        col = mix3(C(0xd8441c), C(0xf3e8e0), sstep(0.25, 0.75, u + (n - 0.5) * 0.5));
        a = mix(0.82, 0.22, Math.pow(u, 0.9));
      }
      a *= 0.75 + 0.45 * ray * joint;
      const dk = 1 - 0.18 * ray;
      a *= 1 - sstep(0.9, 1.0, u) * 0.55;
      a *= 0.9 + 0.2 * n;
      const i = (py * W + px) * 4;
      rgba[i] = col[0] * dk; rgba[i + 1] = col[1] * dk; rgba[i + 2] = col[2] * dk;
      rgba[i + 3] = clamp(a, 0, 1) * 255;
    }
  }
  return rgba;
}

// 目（RGBA）
export function eyePixels() {
  const W = TEX.EYE_W, H = TEX.EYE_H;
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let py = 0; py < H; py++) {
    const a = ((py + 0.5) / H) * Math.PI; // 極からの角度
    for (let px = 0; px < W; px++) {
      const az = (px / W) * Math.PI * 2;
      const n = fbm3(Math.cos(az) * 3, Math.sin(az) * 3, a * 4, 5, 3);
      let c;
      if (a < 0.52) c = [6, 6, 8];
      else if (a < 0.57) c = mix3([6, 6, 8], [120, 90, 40], (a - 0.52) / 0.05);
      else if (a < 0.86) {
        const t = (a - 0.57) / 0.29;
        c = mix3([205, 150, 70], [150, 96, 44], t);
        const streak = 0.85 + 0.3 * n;
        c = [c[0] * streak, c[1] * streak, c[2] * streak];
      } else if (a < 0.95) c = mix3([120, 90, 50], [60, 52, 46], (a - 0.86) / 0.09);
      else c = [70, 62, 56];
      const i = (py * W + px) * 4;
      rgba[i] = clamp(c[0], 0, 255); rgba[i + 1] = clamp(c[1], 0, 255); rgba[i + 2] = clamp(c[2], 0, 255); rgba[i + 3] = 255;
    }
  }
  return rgba;
}
