// 形を作る道具：結合（1 つの BufferGeometry にまとめて draw call を減らす）と、パラメータから作る基本の形。
// three の examples は使わない（BufferGeometryUtils の代わりに Builder を自前で持つ）。

// ---------- 結合。add() した形を position / normal / uv / color の 1 つの形にまとめる。
// group を使うと 1 メッシュで材料を 2 つまで塗り分けられる（materialIndex）。
export class Builder {
  constructor(THREE) {
    this.T = THREE;
    this.parts = [[], []];           // materialIndex ごとの {pos, nor, uv, col, idx}
    this._m = new THREE.Matrix4(); this._n = new THREE.Matrix3(); this._v = new THREE.Vector3(); this._c = new THREE.Color();
  }

  // g：BufferGeometry（この中で dispose する）。matrix：置き場所（null で原点）。color：16 進か [r,g,b]（線形）。
  add(g, matrix, color = 0xffffff, mat = 0) {
    const v = this._v;
    const src = g.index ? g.toNonIndexed() : g;
    const P = src.attributes.position, N = src.attributes.normal, U = src.attributes.uv;
    const part = this.parts[mat];
    const m = matrix || this._m.identity();
    this._n.getNormalMatrix(m);
    const flip = m.determinant() < 0;
    const c = Array.isArray(color) ? color : (this._c.set(color), [this._c.r, this._c.g, this._c.b]);
    const n = P.count;
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) {
        const i = t + (flip ? 2 - k : k);
        v.fromBufferAttribute(P, i).applyMatrix4(m);
        part.push(v.x, v.y, v.z);
        if (N) { v.fromBufferAttribute(N, i).applyMatrix3(this._n); const l = v.length(); if (l > 1e-9) v.multiplyScalar(1 / l); else v.set(0, 1, 0); } else v.set(0, 1, 0);
        part.push(v.x, v.y, v.z);
        part.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
        part.push(c[0], c[1], c[2]);
      }
    }
    if (src !== g) src.dispose();
    g.dispose();
    return this;
  }

  // 位置と向きを作る小道具
  at(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    const T = this.T;
    return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
  }

  // a → b の向きに Y 軸の形（Cylinder など）を置く行列。長さで Y を伸ばす（unit=true のとき形の高さは 1）。
  along(a, b, unit = true) {
    const T = this.T;
    const d = new T.Vector3().subVectors(b, a), len = d.length();
    const q = new T.Quaternion();
    if (len > 1e-9) q.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().multiplyScalar(1 / len));
    return new T.Matrix4().compose(new T.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new T.Vector3(1, unit ? len : 1, 1));
  }

  // 棒（a→b、半径 r、seg 角形、両端はふたなし）
  rod(a, b, r, seg, color, mat = 0) {
    return this.add(new this.T.CylinderGeometry(r, r, 1, seg, 1, true), this.along(a, b), color, mat);
  }

  ball(p, r, color, mat = 0, w = 8, h = 6, sx = 1, sy = 1, sz = 1) {
    return this.add(new this.T.SphereGeometry(r, w, h), this.at(p.x, p.y, p.z, 0, 0, 0, sx, sy, sz), color, mat);
  }

  build() {
    const T = this.T;
    const total = this.parts[0].length + this.parts[1].length;
    const n = total / 11;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    let o = 0;
    const g = new T.BufferGeometry();
    this.parts.forEach((part, mi) => {
      const start = o;
      for (let i = 0; i < part.length; i += 11, o++) {
        pos[o * 3] = part[i]; pos[o * 3 + 1] = part[i + 1]; pos[o * 3 + 2] = part[i + 2];
        nor[o * 3] = part[i + 3]; nor[o * 3 + 1] = part[i + 4]; nor[o * 3 + 2] = part[i + 5];
        uv[o * 2] = part[i + 6]; uv[o * 2 + 1] = part[i + 7];
        col[o * 3] = part[i + 8]; col[o * 3 + 1] = part[i + 9]; col[o * 3 + 2] = part[i + 10];
      }
      if (o > start && this.parts[1].length) g.addGroup(start, o - start, mi);
    });
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- 平歯車（外歯）。歯数 z・モジュール m・圧力角 α から、インボリュートの歯形を作って押し出す。
//   基準円 rp = m·z/2、歯先 ra = rp + m、歯底 rf = rp − 1.25m、基礎円 rb = rp·cosα
//   半径 r での歯の半角 β(r) = π/(2z) + inv(α) − inv(φ)、cosφ = rb/r、inv(x) = tan x − x
// 歯 0 の中心は +X。軸は Z。bore は中心の穴（輪歯車なら大きくする）。
export function gearGeometry(THREE, { z, m, alpha, thickness, bore, samples = 3 }) {
  const rp = m * z / 2, ra = rp + m, rf = Math.max(rp - 1.25 * m, bore + m * 0.4), rb = rp * Math.cos(alpha);
  const inv = (x) => Math.tan(x) - x;
  const beta = (r) => { const c = Math.min(1, rb / r); return Math.PI / (2 * z) + inv(alpha) - inv(Math.acos(c)); };
  const r0 = Math.max(rf, rb);
  const outline = [];                              // [r, θ] 反時計回り
  const pitch = 2 * Math.PI / z;
  for (let k = 0; k < z; k++) {
    const c = k * pitch;
    const pts = [];
    pts.push([rf, -Math.min(pitch / 2 * 0.98, beta(r0) + (r0 - rf) * 0.25 / rf + 0.012)]);
    for (let j = 0; j <= samples; j++) { const r = r0 + (ra - r0) * (j / samples); pts.push([r, -Math.max(beta(r), 0.004)]); }
    for (const [r, a] of pts) outline.push([r, c + a]);
    for (let i = pts.length - 1; i >= 0; i--) outline.push([pts[i][0], c - pts[i][1]]);
  }
  const n = outline.length, hz = thickness / 2;
  const pos = [], nor = [], uv = [];
  const P = (r, a, zz) => [r * Math.cos(a), r * Math.sin(a), zz];
  const tri = (a, b, c, nx, ny, nz) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); uv.push(p[0] / (2 * ra) + 0.5, p[1] / (2 * ra) + 0.5); } };
  for (let i = 0; i < n; i++) {
    const [r1, a1] = outline[i], [r2, a2raw] = outline[(i + 1) % n];
    const a2 = i === n - 1 ? a2raw + 2 * Math.PI : a2raw;
    // 表・裏（外形と穴の間の帯）
    tri(P(bore, a1, hz), P(r1, a1, hz), P(r2, a2, hz), 0, 0, 1); tri(P(bore, a1, hz), P(r2, a2, hz), P(bore, a2, hz), 0, 0, 1);
    tri(P(bore, a1, -hz), P(r2, a2, -hz), P(r1, a1, -hz), 0, 0, -1); tri(P(bore, a1, -hz), P(bore, a2, -hz), P(r2, a2, -hz), 0, 0, -1);
    // 歯の側面（面ごとの法線）
    const p1 = P(r1, a1, 0), p2 = P(r2, a2, 0);
    let nx = p2[1] - p1[1], ny = -(p2[0] - p1[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    tri(P(r1, a1, -hz), P(r2, a2, -hz), P(r2, a2, hz), nx, ny, 0); tri(P(r1, a1, -hz), P(r2, a2, hz), P(r1, a1, hz), nx, ny, 0);
    // 穴の内壁
    const am = (a1 + a2) / 2;
    tri(P(bore, a1, -hz), P(bore, a2, hz), P(bore, a2, -hz), -Math.cos(am), -Math.sin(am), 0); tri(P(bore, a1, -hz), P(bore, a1, hz), P(bore, a2, hz), -Math.cos(am), -Math.sin(am), 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// かみ合わせの位相：歯車 A（歯数 zA、角 θA で歯 0 が +X から θA）の、方向 dir にある相手 B（歯数 zB）の角。
// A の歯の山が B の谷に入る：θB = dir + π − (2π/zB)·(0.5 − (dir − θA)·zA/2π)
export function meshPhase(zA, thetaA, zB, dir) {
  return dir + Math.PI - (2 * Math.PI / zB) * (0.5 - (dir - thetaA) * zA / (2 * Math.PI));
}

// ---------- 宝石（そろばん玉形のカット）。軸は X（レールが通る向き）。r = ガードル半径。面ごとの法線（平らな面）。
export function gemGeometry(THREE, r, sides = 8) {
  // 輪：[軸方向の位置, 半径, 角度のずれ（0 か 0.5）]。ガードル → クラウン → テーブル
  const rings = [[0, r, 0], [r * 0.5, r * 0.72, 0.5], [r * 0.82, r * 0.4, 0]];
  const pos = [];
  for (const sgn of [1, -1]) {
    const pt = ([x, rad, off], k) => { const a = (k + off) * 2 * Math.PI / sides; return [sgn * x, rad * Math.cos(a), rad * Math.sin(a)]; };
    const tri = (a, b, c) => { for (const p of sgn > 0 ? [a, b, c] : [a, c, b]) pos.push(p[0], p[1], p[2]); };
    for (let j = 0; j < rings.length - 1; j++) {
      const L = rings[j], U = rings[j + 1];
      for (let k = 0; k < sides; k++) {
        if (U[2] > L[2]) { tri(pt(L, k), pt(L, k + 1), pt(U, k)); tri(pt(U, k + 1), pt(U, k), pt(L, k + 1)); }
        else { tri(pt(L, k), pt(L, k + 1), pt(U, k + 1)); tri(pt(U, k + 1), pt(U, k), pt(L, k)); }
      }
    }
    const top = rings[rings.length - 1], c = [sgn * (top[0] + r * 0.03), 0, 0];
    for (let k = 0; k < sides; k++) tri(c, pt(top, k), pt(top, k + 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();                        // 非 index なので面ごとの法線になる
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0; i < pos.length / 3; i++) { uv[i * 2] = pos[i * 3 + 1] / (2 * r) + 0.5; uv[i * 2 + 1] = pos[i * 3 + 2] / (2 * r) + 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---------- 弧に沿って断面（r,y の多角形）を掃いた形（台座の宝石皿）。中心角は +Z を 0 として ±halfArc。
export function arcSweepGeometry(THREE, section, halfArc, segs) {
  const pos = [], uv = [];
  const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
  const quad = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) pos.push(p[0], p[1], p[2]); };
  const n = section.length;
  for (let i = 0; i < segs; i++) {
    const a0 = -halfArc + 2 * halfArc * i / segs, a1 = -halfArc + 2 * halfArc * (i + 1) / segs;
    for (let k = 0; k < n; k++) {
      const [r0, y0] = section[k], [r1, y1] = section[(k + 1) % n];
      quad(P(r0, y0, a0), P(r0, y0, a1), P(r1, y1, a1), P(r1, y1, a0));
    }
  }
  // 両端のふた（断面は凸）
  for (const [a, flip] of [[-halfArc, false], [halfArc, true]]) {
    for (let k = 1; k < n - 1; k++) {
      const p0 = P(section[0][0], section[0][1], a), p1 = P(section[k][0], section[k][1], a), p2 = P(section[k + 1][0], section[k + 1][1], a);
      for (const p of flip ? [p0, p1, p2] : [p0, p2, p1]) pos.push(p[0], p[1], p[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 0.6 + 0.5, pos[i + 2] * 0.6 + pos[i + 1]);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// ---------- 弓形（円の切片）を X 方向に押し出した形（宝箱のふた）。弦 chord（Z 方向）、高さ rise、幅 width。
// 原点は弦の中点（底面の中心）。
export function archGeometry(THREE, chord, rise, width, segs) {
  const rho = (chord * chord / 4 + rise * rise) / (2 * rise), cy = rise - rho, half = Math.asin(Math.min(1, chord / (2 * rho)));
  const prof = [];                                  // [z, y]
  for (let i = 0; i <= segs; i++) { const a = -half + 2 * half * i / segs; prof.push([rho * Math.sin(a), cy + rho * Math.cos(a)]); }
  const pos = [], nor = [], uv = [], hx = width / 2;
  const push = (x, y, z, nx, ny, nz, u, v) => { pos.push(x, y, z); nor.push(nx, ny, nz); uv.push(u, v); };
  for (let i = 0; i < segs; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[i + 1];
    const n0 = [(y0 - cy) / rho, z0 / rho], n1 = [(y1 - cy) / rho, z1 / rho];   // [ny, nz]
    // 曲面
    push(-hx, y0, z0, 0, n0[0], n0[1], 0, i / segs); push(hx, y0, z0, 0, n0[0], n0[1], 1, i / segs); push(hx, y1, z1, 0, n1[0], n1[1], 1, (i + 1) / segs);
    push(-hx, y0, z0, 0, n0[0], n0[1], 0, i / segs); push(hx, y1, z1, 0, n1[0], n1[1], 1, (i + 1) / segs); push(-hx, y1, z1, 0, n1[0], n1[1], 0, (i + 1) / segs);
    // 側面（弓形）
    push(hx, 0, z0, 1, 0, 0, 0, 0); push(hx, y1, z1, 1, 0, 0, 0, 0); push(hx, y0, z0, 1, 0, 0, 0, 0);
    push(hx, 0, z0, 1, 0, 0, 0, 0); push(hx, 0, z1, 1, 0, 0, 0, 0); push(hx, y1, z1, 1, 0, 0, 0, 0);
    push(-hx, 0, z0, -1, 0, 0, 0, 0); push(-hx, y0, z0, -1, 0, 0, 0, 0); push(-hx, y1, z1, -1, 0, 0, 0, 0);
    push(-hx, 0, z0, -1, 0, 0, 0, 0); push(-hx, y1, z1, -1, 0, 0, 0, 0); push(-hx, 0, z1, -1, 0, 0, 0, 0);
  }
  // 底
  const zA = prof[0][0], zB = prof[segs][0];
  push(-hx, 0, zA, 0, -1, 0, 0, 0); push(hx, 0, zB, 0, -1, 0, 1, 1); push(hx, 0, zA, 0, -1, 0, 1, 0);
  push(-hx, 0, zA, 0, -1, 0, 0, 0); push(-hx, 0, zB, 0, -1, 0, 0, 1); push(hx, 0, zB, 0, -1, 0, 1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
