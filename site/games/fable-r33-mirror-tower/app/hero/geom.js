// 形を作る道具。全部「パラメータ → 頂点」の関数で、1つの剛体ぶんを Builder に貯めて 1 つの BufferGeometry にする
// （= 1 draw call）。THREE は引数でもらう（import しない）。
import { TAU } from './mech.js';

export function createGeom(THREE) {
  const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
  const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
  const ID = new THREE.Matrix4();

  // sRGB の 16進 → リニア [r,g,b]
  const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

  class Builder {
    constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
    get tris() { return this.p.length / 9; }
    _v(p, n, u, v, c) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(u, v); this.c.push(c[0], c[1], c[2]); }
    // 平らな三角形（法線は面から）。ref があれば法線が ref から遠ざかる向きにそろえる
    tri(a, b, c, col, ref, m) {
      if (m) { a = xf(m, a); b = xf(m, b); c = xf(m, c); if (ref) ref = xf(m, ref); }
      let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const l = Math.hypot(nx, ny, nz);
      if (!(l > 1e-12)) return; // つぶれた三角形は捨てる（NaN 防止）
      nx /= l; ny /= l; nz /= l;
      if (ref) {
        const cx = (a[0] + b[0] + c[0]) / 3 - ref[0], cy = (a[1] + b[1] + c[1]) / 3 - ref[1], cz = (a[2] + b[2] + c[2]) / 3 - ref[2];
        if (nx * cx + ny * cy + nz * cz < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
      }
      const n = [nx, ny, nz];
      for (const q of [a, b, c]) this._v(q, n, (q[0] + q[2]) * 0.9, q[1] * 0.9 + q[2] * 0.35, col);
    }
    quad(a, b, c, d, col, ref, m) { this.tri(a, b, c, col, ref, m); this.tri(a, c, d, col, ref, m); }
    // THREE の既製の形を、行列をかけて取り込む（色は頂点カラー）。geo は dispose する
    add(geo, m, col, uvScale = 1) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      m = m || ID;
      _nm.getNormalMatrix(m);
      for (let i = 0; i < P.count; i++) {
        _p.fromBufferAttribute(P, i).applyMatrix4(m);
        _n.fromBufferAttribute(N, i).applyMatrix3(_nm);
        const l = _n.length();
        if (l > 1e-9) _n.multiplyScalar(1 / l); else _n.set(0, 1, 0);
        this.p.push(_p.x, _p.y, _p.z); this.n.push(_n.x, _n.y, _n.z);
        this.uv.push(U ? U.getX(i) * uvScale : 0, U ? U.getY(i) * uvScale : 0);
        this.c.push(col[0], col[1], col[2]);
      }
      if (g !== geo) g.dispose();
      geo.dispose();
      return this;
    }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.c), 3));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      this.p = this.n = this.uv = this.c = null;
      return g;
    }
  }

  function xf(m, a) { _p.set(a[0], a[1], a[2]).applyMatrix4(m); return [_p.x, _p.y, _p.z]; }
  const A = (v) => (Array.isArray(v) ? v : [v.x, v.y, v.z]);

  // v に垂直な単位ベクトルをひとつ
  function perp(v) {
    v = A(v);
    const ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2]);
    const o = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
    const d = o[0] * v[0] + o[1] * v[1] + o[2] * v[2];
    const r = [o[0] - d * v[0], o[1] - d * v[1], o[2] - d * v[2]];
    const l = Math.hypot(r[0], r[1], r[2]) || 1;
    return [r[0] / l, r[1] / l, r[2] / l];
  }
  // 原点と 3 軸から行列（右手系にそろえること）。省いた軸は外積で補う
  function frame(o, x, y, z, s = 1) {
    o = A(o);
    if (x) _x.fromArray(A(x)).normalize();
    if (y) _y.fromArray(A(y)).normalize();
    if (z) _z.fromArray(A(z)).normalize();
    if (!x) _x.crossVectors(_y, _z).normalize();
    if (!y) _y.crossVectors(_z, _x).normalize();
    if (!z) _z.crossVectors(_x, _y).normalize();
    const m = new THREE.Matrix4().makeBasis(_x, _y, _z);
    if (s !== 1) m.scale(_p.set(s, s, s));
    m.setPosition(o[0], o[1], o[2]);
    return m;
  }
  // Y 軸を向きに合わせる行列（原点 o）
  function frameY(o, dir) { const y = A(dir); const x = perp(y); return frame(o, x, y, null); }
  function frameZ(o, dir) { const z = A(dir); const x = perp(z); return frame(o, x, null, z); }
  const compose = (...ms) => { const m = new THREE.Matrix4(); for (const k of ms) m.multiply(k); return m; };
  const mt = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const mrx = (a) => new THREE.Matrix4().makeRotationX(a);
  const mry = (a) => new THREE.Matrix4().makeRotationY(a);
  const mrz = (a) => new THREE.Matrix4().makeRotationZ(a);
  const mscale = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);

  // ---- 基本の形 ----
  // 2点を結ぶ丸棒（r0 → r1）
  function rod(b, p0, p1, r0, col, { r1 = r0, seg = 8, caps = false } = {}) {
    p0 = A(p0); p1 = A(p1);
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const L = Math.hypot(d[0], d[1], d[2]);
    if (!(L > 1e-6)) return;
    const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, !caps);
    g.translate(0, L / 2, 0);
    b.add(g, frameY(p0, [d[0] / L, d[1] / L, d[2] / L]), col);
  }
  function ball(b, p, r, col, { ws = 10, hs = 7, m = null, squash = 1 } = {}) {
    const g = new THREE.SphereGeometry(r, ws, hs);
    if (squash !== 1) g.scale(1, squash, 1);
    b.add(g, m ? compose(mt(...A(p)), m) : mt(...A(p)), col); // m は向きだけ（置く場所は p）
  }
  function box(b, size, m, col) { b.add(new THREE.BoxGeometry(size[0], size[1], size[2]), m, col, 0.5); }
  // 輪（トーラス）。軸 = m の Z
  function torus(b, R, tube, m, col, { rs = 6, ts = 20, arc = TAU } = {}) { b.add(new THREE.TorusGeometry(R, tube, rs, ts, arc), m, col); }
  // 回転体。profile = [[r, y], ...]（下から上へ）。軸 = m の Y。区間ごとに平らな法線（機械っぽい稜線）
  function lathe(b, profile, m, col, { seg = 16, colors = null } = {}) {
    m = m || ID;
    for (let j = 0; j < profile.length - 1; j++) {
      const [r0, y0] = profile[j], [r1, y1] = profile[j + 1];
      let nr = y1 - y0, ny = -(r1 - r0);
      const nl = Math.hypot(nr, ny);
      if (!(nl > 1e-9)) continue;
      nr /= nl; ny /= nl;
      const c = colors ? colors[j] : col;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
        const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const va = [r0 * c0, y0, r0 * s0], vb = [r0 * c1, y0, r0 * s1], vc = [r1 * c1, y1, r1 * s1], vd = [r1 * c0, y1, r1 * s0];
        const na = [nr * c0, ny, nr * s0], nb = [nr * c1, ny, nr * s1];
        const pushV = (v, n, u, w) => {
          _p.set(v[0], v[1], v[2]).applyMatrix4(m);
          _n.set(n[0], n[1], n[2]).transformDirection(m);
          b._v([_p.x, _p.y, _p.z], [_n.x, _n.y, _n.z], u, w, c);
        };
        const u0 = i / seg * 2, u1 = (i + 1) / seg * 2;
        if (r1 > 1e-6) { pushV(va, na, u0, y0); pushV(vd, na, u0, y1); pushV(vc, nb, u1, y1); }
        if (r0 > 1e-6) { pushV(va, na, u0, y0); pushV(vc, nb, u1, y1); pushV(vb, nb, u1, y0); }
      }
    }
  }

  // ---- 歯車（平歯車・かさ歯車を同じ関数で）----
  // 歯は台形。歯数 z、モジュール mod。歯先 = ピッチ + mod、歯底 = ピッチ − 1.25·mod。
  // 平歯車： 軸 = Z、z=0 が中心、歯幅 face。
  // かさ歯車： cone = ピッチ円すい半角、R = 円すい距離。頂点が原点、軸 = +Z（歯車は +Z 側にある）。
  // phase = 歯0の中心の角度（X 軸から）。teeth = [k0, k1) を作る（省略で全周）。
  // 戻り値：寸法（ピッチ半径など）
  function gear(b, spec, m, col, opt = {}) {
    const { mod, z, face = 0.08, cone = 0, R = 0, phase = 0 } = spec;
    const { webCol = col, hubR = mod * 2.2, teeth = null, holes = 0, holeCol = col, web = true } = opt;
    const tau = TAU / z;
    const eR = 0.29 * tau, eT = 0.14 * tau; // 歯底・歯先での歯の半角
    let EA, EB;
    if (cone > 0) {
      const sd = Math.sin(cone), cd = Math.cos(cone);
      const end = (rho) => { const k = rho / R; return { rr: rho * sd - k * 1.25 * mod * cd, zr: rho * cd + k * 1.25 * mod * sd, rt: rho * sd + k * mod * cd, zt: rho * cd - k * mod * sd }; };
      EA = end(R - face); EB = end(R);
    } else {
      const r = (mod * z) / 2;
      EA = { rr: r - 1.25 * mod, zr: -face / 2, rt: r + mod, zt: -face / 2 };
      EB = { rr: r - 1.25 * mod, zr: face / 2, rt: r + mod, zt: face / 2 };
    }
    const P = (r, a, zz) => [r * Math.cos(a), r * Math.sin(a), zz];
    const zc = (EA.zr + EB.zr) / 2;
    const body = [0, 0, zc];
    const k0 = teeth ? teeth[0] : 0, k1 = teeth ? teeth[1] : z;
    for (let k = k0; k < k1; k++) {
      const a = phase + k * tau;
      const inner = P((EA.rr + EA.rt) / 2, a, zc);
      const ArL = P(EA.rr, a - eR, EA.zr), AtL = P(EA.rt, a - eT, EA.zt), AtR = P(EA.rt, a + eT, EA.zt), ArR = P(EA.rr, a + eR, EA.zr);
      const BrL = P(EB.rr, a - eR, EB.zr), BtL = P(EB.rt, a - eT, EB.zt), BtR = P(EB.rt, a + eT, EB.zt), BrR = P(EB.rr, a + eR, EB.zr);
      b.quad(ArL, AtL, BtL, BrL, col, inner, m);
      b.quad(ArR, AtR, BtR, BrR, col, inner, m);
      b.quad(AtL, AtR, BtR, BtL, col, inner, m);
      b.quad(ArL, AtL, AtR, ArR, col, inner, m);
      b.quad(BrL, BtL, BtR, BrR, col, inner, m);
      if (!teeth || k < k1 - 1) {
        const ArN = P(EA.rr, a + tau - eR, EA.zr), BrN = P(EB.rr, a + tau - eR, EB.zr);
        b.quad(ArR, ArN, BrN, BrR, col, body, m);
        if (web) {
          b.quad(ArR, ArN, P(hubR, a + tau - eR, EA.zr), P(hubR, a + eR, EA.zr), webCol, body, m);
          b.quad(BrR, BrN, P(hubR, a + tau - eR, EB.zr), P(hubR, a + eR, EB.zr), webCol, body, m);
        }
      }
      if (web) {
        b.quad(ArL, ArR, P(hubR, a + eR, EA.zr), P(hubR, a - eR, EA.zr), webCol, body, m);
        b.quad(BrL, BrR, P(hubR, a + eR, EB.zr), P(hubR, a - eR, EB.zr), webCol, body, m);
      }
    }
    // 回っているのが見えるよう、腹に丸い「窓」を並べる（暗い色の円板）
    if (holes > 0) {
      const rin = hubR, rout = Math.min(EA.rr, EB.rr);
      const rc = (rin + rout) / 2, hr = Math.min((rout - rin) * 0.32, (rc * Math.PI) / holes * 0.7);
      for (const E of cone > 0 ? [EB] : [EA, EB]) {
        const sgn = E === EA ? -1 : 1;
        for (let h = 0; h < holes; h++) {
          const a = phase + (h + 0.5) * (TAU / holes);
          const g = new THREE.CircleGeometry(hr, 8);
          if (sgn < 0) g.rotateY(Math.PI);
          const lm = compose(m || ID, mt(rc * Math.cos(a), rc * Math.sin(a), E.zr + sgn * 0.004));
          b.add(g, lm, holeCol);
        }
      }
    }
    return { EA, EB, zc };
  }

  // 多面体の宝石（ブリリアント風）。n 回対称、ガードル半径 R、テーブル比、冠の角度、パビリオン角度。軸 = Y
  function gem(b, { R = 0.3, n = 8, table = 0.55, crownAngle = 0.6, pavilionAngle = 0.72 }, col) {
    const rt = R * table, hc = (R - rt) * Math.tan(crownAngle), hp = R * Math.tan(pavilionAngle);
    const T = [], G = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; T.push([rt * Math.cos(a), hc, rt * Math.sin(a)]); }
    for (let j = 0; j < 2 * n; j++) { const a = ((j - 0.5) / (2 * n)) * TAU + TAU / (2 * n) * 0.5; G.push([R * Math.cos(a), 0, R * Math.sin(a)]); }
    const culet = [0, -hp, 0], top = [0, hc, 0], ref = [0, -hp * 0.2, 0];
    const tri = (a, c, d) => {
      const before = b.p.length;
      b.tri(a, c, d, col, ref);
      // UV は上から見た平面投影（虹色の面が面ごとに違って見える）
      for (let k = before / 3, q = 0; k < b.p.length / 3; k++, q++) {
        const px = b.p[k * 3], py = b.p[k * 3 + 1], pz = b.p[k * 3 + 2];
        b.uv[k * 2] = 0.5 + (px / R) * 0.42 + py * 0.3; b.uv[k * 2 + 1] = 0.5 + (pz / R) * 0.42 - py * 0.2;
      }
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tri(top, T[i], T[j]);
      const g0 = G[(2 * i) % (2 * n)], g1 = G[(2 * i + 1) % (2 * n)], g2 = G[(2 * i + 2) % (2 * n)];
      tri(T[i], g0, g1);
      tri(T[i], g1, T[j]);
      tri(T[j], g1, g2);
      tri(culet, g0, g1);
      tri(culet, g1, g2);
    }
    return { hc, hp };
  }

  // 花びら。原点 = ちょうつがい、+Y = 花の軸（閉じた時の向き）、+X = 外向き、Z = ちょうつがいの軸。
  // 開くときは Z まわりに −α 回す。根元にラックとかみ合う扇形のピニオンが付く。
  function petal(b, f, { nu = 4, nv = 7, bladeCol = [1, 1, 1], gearCol = [1, 0.8, 0.3], rho = 0.14, zPin = 13 } = {}) {
    const L = f.petalLength, W = f.petalWidth, Rh = f.hingeRadius;
    const pt = (s, t) => {
      const w = W * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.75) + 0.012;
      const cx = f.petalBulge * Math.sin(Math.PI * Math.min(1, t * 1.05)) - (Rh - 0.03) * t * t;
      return [cx - f.petalCup * w * s * s, L * t, w * s];
    };
    const grid = [];
    for (let j = 0; j <= nv; j++) { const row = []; for (let i = 0; i <= nu; i++) row.push(pt((i / nu) * 2 - 1, j / nv)); grid.push(row); }
    const nrm = (i, j) => {
      const a = grid[j][Math.max(0, i - 1)], c = grid[j][Math.min(nu, i + 1)], d = grid[Math.max(0, j - 1)][i], e = grid[Math.min(nv, j + 1)][i];
      const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = e[0] - d[0], vy = e[1] - d[1], vz = e[2] - d[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz);
      if (!(l > 1e-9)) return [1, 0, 0];
      return [nx / l, ny / l, nz / l];
    };
    const V = (i, j) => b._v(grid[j][i], nrm(i, j), i / nu, j / nv, bladeCol);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { V(i, j); V(i + 1, j); V(i + 1, j + 1); V(i, j); V(i + 1, j + 1); V(i, j + 1); }
    // 扇形のピニオン（薄い板、歯はラック側＝−X 側から下へ）。歯0 を −X（角度 π）に合わせる
    const span = Math.ceil(((f.alphaMax + 0.5) / TAU) * zPin);
    const before = b.uv.length;
    gear(b, { mod: (2 * rho) / zPin, z: zPin, face: 0.034, phase: Math.PI }, null, gearCol, { teeth: [-1, span + 1], hubR: 0.012 });
    for (let k = before; k < b.uv.length; k += 2) { b.uv[k] = 0.5; b.uv[k + 1] = 0.96; } // テクスチャの白い所
  }

  // カム（調和カムの輪郭を押し出した板）。軸 = Z、厚み t
  function cam(b, radiusFn, t, m, col, seg = 28) {
    const P = (a, zz) => { const r = radiusFn(a); return [r * Math.cos(a), r * Math.sin(a), zz]; };
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      b.quad(P(a0, -t / 2), P(a1, -t / 2), P(a1, t / 2), P(a0, t / 2), col, [0, 0, 0], m);
      b.tri([0, 0, t / 2], P(a0, t / 2), P(a1, t / 2), col, [0, 0, 0], m);
      b.tri([0, 0, -t / 2], P(a0, -t / 2), P(a1, -t / 2), col, [0, 0, 0], m);
    }
  }

  // 配列ベクトルの小道具
  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const vmad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vnorm = (a, fb = [0, 1, 0]) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fb.slice(); };

  return { vadd, vsub, vmul, vmad, vdot, vcross, vnorm, Builder, rgb, perp, frame, frameY, frameZ, compose, mt, mrx, mry, mrz, mscale, rod, ball, box, torus, lathe, gear, gem, petal, cam, A };
}
