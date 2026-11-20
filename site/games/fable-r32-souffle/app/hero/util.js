// 小さな数式の道具（three に依存しない）。
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const ease = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export const wrapPi = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const fin = (x, d) => (Number.isFinite(x) ? x : (d || 0));

// 2 階のばね（質量 1）。s = {x, v} を goal へ。w0=固有角振動数、zeta=減衰比。半陰的オイラーを細かく刻む。
export function springTo(s, goal, w0, zeta, dt) {
  const n = Math.max(1, Math.ceil(dt * w0 / 0.25)), h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (w0 * w0 * (goal - s.x) - 2 * zeta * w0 * s.v) * h;
    s.x += s.v * h;
  }
  if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) { s.x = fin(goal, 0); s.v = 0; }
}

// 決まった乱数（毎回同じ形になるように）
export function hash(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// 極座標の格子（中心 1 点＋ NR 本の輪 × NS 分割）の頂点番号
export const polarIndex = (i, j, NS) => (i === 0 ? 0 : 1 + (i - 1) * NS + j);

// 極座標の格子の三角形（上から見て反時計回り＝上向きが表）
export function polarTriangles(NR, NS) {
  const idx = [];
  for (let j = 0; j < NS; j++) {
    const j1 = (j + 1) % NS;
    idx.push(0, polarIndex(1, j1, NS), polarIndex(1, j, NS));
    for (let i = 1; i < NR; i++) {
      const a = polarIndex(i, j, NS), b = polarIndex(i + 1, j, NS), c = polarIndex(i, j1, NS), d = polarIndex(i + 1, j1, NS);
      idx.push(a, c, b, c, d, b);
    }
  }
  return idx;
}

// 極座標の格子の法線を、となりの頂点との差分から作り直す（頂点変形のあとに呼ぶ）。
// P・N は Float32Array（xyz）。長さ 0 の法線は上向きにする（NaN 防止）。
export function polarNormals(P, N, NR, NS) {
  let sx = 0, sy = 0, sz = 0;
  for (let i = 1; i <= NR; i++) {
    for (let j = 0; j < NS; j++) {
      const k = polarIndex(i, j, NS) * 3;
      const kp = polarIndex(i, (j + 1) % NS, NS) * 3, km = polarIndex(i, (j + NS - 1) % NS, NS) * 3;
      const ko = (i < NR ? polarIndex(i + 1, j, NS) : polarIndex(i, j, NS)) * 3;
      const ki = polarIndex(i - 1, j, NS) * 3;
      const tx = P[kp] - P[km], ty = P[kp + 1] - P[km + 1], tz = P[kp + 2] - P[km + 2];
      const rx = P[ko] - P[ki], ry = P[ko + 1] - P[ki + 1], rz = P[ko + 2] - P[ki + 2];
      let nx = ty * rz - tz * ry, ny = tz * rx - tx * rz, nz = tx * ry - ty * rx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (l > 1e-12) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
      N[k] = nx; N[k + 1] = ny; N[k + 2] = nz;
      if (i === 1) { sx += nx; sy += ny; sz += nz; }
    }
  }
  const l = Math.sqrt(sx * sx + sy * sy + sz * sz);
  if (l > 1e-9) { N[0] = sx / l; N[1] = sy / l; N[2] = sz / l; } else { N[0] = 0; N[1] = 1; N[2] = 0; }
}
