// 形を作る道具：パラメータから BufferGeometry を生成し、同じ動きをする部品は 1 つに結合する。
import { TAU } from './util.js';

export function createKit(THREE, A, quality) {
  const owned = [];
  const own = (x) => { owned.push(x); return x; };
  const detail = (quality && quality.detail) || 1;
  const seg = (n, min) => Math.max(min || 3, Math.round(n * detail));
  const _c = new THREE.Color();
  const _m = new THREE.Matrix4();

  function ensureIndex(g) {
    if (!g.index) {
      const n = g.attributes.position.count;
      const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    return g;
  }
  function keepOnly(g, names) {
    for (const k of Object.keys(g.attributes)) if (names.indexOf(k) < 0) g.deleteAttribute(k);
    return g;
  }

  // 「硬い物」用：頂点ごとに色と (metalness, roughness, emissive の強さ) を持たせる。UV は捨てる。
  function paint(g, hex, metal, rough, emis) {
    ensureIndex(g); keepOnly(g, ['position', 'normal']);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3), mre = new Float32Array(n * 3);
    _c.set(hex);
    const e = emis == null ? 1 : emis;
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      mre[i * 3] = metal || 0; mre[i * 3 + 1] = rough == null ? 0.5 : rough; mre[i * 3 + 2] = e;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aMRE', new THREE.BufferAttribute(mre, 3));
    return g;
  }
  // テクスチャを貼る物用：position / normal / uv だけ残す
  function textured(g) { ensureIndex(g); return keepOnly(g, ['position', 'normal', 'uv']); }

  function at(g, x, y, z) { g.translate(x || 0, y || 0, z || 0); return g; }
  function rot(g, rx, ry, rz) { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); return g; }
  // ローカルの X・Z 軸を、与えた向きへ（Y = Z × X）
  function orient(g, xTo, zTo) {
    const X = new THREE.Vector3().fromArray(xTo).normalize(), Z = new THREE.Vector3().fromArray(zTo).normalize();
    const Y = new THREE.Vector3().crossVectors(Z, X);
    g.applyMatrix4(_m.makeBasis(X, Y, Z));
    return g;
  }
  function merge(list) {
    const g = A.mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    if (!g) throw new Error('hero: mergeGeometries failed (attribute mismatch)');
    return own(g);
  }

  // ---- 基本形 ----
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const rbox = (w, h, d, r, s) => new A.RoundedBoxGeometry(w, h, d, s == null ? 2 : s, r);
  // 軸 'x' | 'y' | 'z' の円柱（中心が原点）
  function cyl(r0, r1, h, n, axis, open) {
    const g = new THREE.CylinderGeometry(r1, r0, h, n, 1, !!open); // r0=下（軸の負側）、r1=上
    if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
    return g;
  }
  const sphere = (r, a, b) => new THREE.SphereGeometry(r, a, b);
  const torus = (R, r, a, b) => new THREE.TorusGeometry(R, r, a, b);

  // ---- 手作りの面（面ごとに平らな法線） ----
  function builder() {
    const pos = [], nrm = [], idx = [];
    const api = {
      vert(p, n) { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); return pos.length / 3 - 1; },
      tri(a, b, c) { idx.push(a, b, c); },
      // 4 点（外から見て反時計回り）。center を渡すと外向きになるよう自動で裏返す。
      quad(a, b, c, d, center) {
        let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        let vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
        if (Math.abs(ux) + Math.abs(uy) + Math.abs(uz) < 1e-12) { ux = c[0] - a[0]; uy = c[1] - a[1]; uz = c[2] - a[2]; }
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        let flip = false;
        if (center) {
          const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - center[0], my = (a[1] + b[1] + c[1] + d[1]) / 4 - center[1], mz = (a[2] + b[2] + c[2] + d[2]) / 4 - center[2];
          if (nx * mx + ny * my + nz * mz < 0) { flip = true; nx = -nx; ny = -ny; nz = -nz; }
        }
        const n = [nx, ny, nz];
        const i0 = api.vert(a, n), i1 = api.vert(b, n), i2 = api.vert(c, n), i3 = api.vert(d, n);
        if (flip) idx.push(i0, i2, i1, i0, i3, i2); else idx.push(i0, i1, i2, i0, i2, i3);
      },
      done() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        g.setIndex(idx);
        return g;
      },
    };
    return api;
  }

  // 8 点の六面体（下 0-3、上 4-7、同じ順）。skipBottom で底を省く。
  function hexa(p, skipBottom, b) {
    const B = b || builder();
    const c = [0, 0, 0];
    for (let i = 0; i < 8; i++) { c[0] += p[i][0] / 8; c[1] += p[i][1] / 8; c[2] += p[i][2] / 8; }
    if (!skipBottom) B.quad(p[0], p[1], p[2], p[3], c);
    B.quad(p[4], p[5], p[6], p[7], c);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; B.quad(p[i], p[j], p[j + 4], p[i + 4], c); }
    return b ? null : B.done();
  }

  // ---- 歯車 ----
  // 平歯車の輪郭（XY 平面、反時計回り）。1 歯 4 点の台形歯。internal=true で内歯車（歯が内向き）。
  // phase は歯 0 の中心の角度。モジュール m、歯数 Z → ピッチ半径 m·Z/2、歯先 ±m、歯底 ∓1.25m。
  function gearOutline(Z, m, internal, phase) {
    const rp = m * Z / 2, tau = TAU / Z, pts = [];
    const rTip = internal ? rp - m : rp + m, rRoot = internal ? rp + 1.25 * m : rp - 1.25 * m;
    const ph = phase || 0;
    for (let k = 0; k < Z; k++) {
      const c = ph + k * tau;
      pts.push([rRoot * Math.cos(c - 0.30 * tau), rRoot * Math.sin(c - 0.30 * tau)]);
      pts.push([rTip * Math.cos(c - 0.13 * tau), rTip * Math.sin(c - 0.13 * tau)]);
      pts.push([rTip * Math.cos(c + 0.13 * tau), rTip * Math.sin(c + 0.13 * tau)]);
      pts.push([rRoot * Math.cos(c + 0.30 * tau), rRoot * Math.sin(c + 0.30 * tau)]);
    }
    return pts;
  }
  // 輪郭を z0→z1 へ押し出す（軸は Z）。s0・s1 は両端での拡大率（かさ歯車は先細り）。
  // outerR を渡すと内歯車：輪郭が穴になり、外側は半径 outerR の円筒。
  function prism(outline, z0, z1, s0, s1, outerR) {
    const B = builder(), n = outline.length;
    const a0 = s0 == null ? 1 : s0, a1 = s1 == null ? 1 : s1;
    const P0 = outline.map((p) => [p[0] * a0, p[1] * a0, z0]), P1 = outline.map((p) => [p[0] * a1, p[1] * a1, z1]);
    if (outerR == null) {
      for (let k = 0; k < n; k++) { const j = (k + 1) % n; B.quad(P0[k], P0[j], P1[j], P1[k]); }
      const c1 = B.vert([0, 0, z1], [0, 0, 1]), c0 = B.vert([0, 0, z0], [0, 0, -1]);
      const t1 = P1.map((p) => B.vert(p, [0, 0, 1])), t0 = P0.map((p) => B.vert(p, [0, 0, -1]));
      for (let k = 0; k < n; k++) { const j = (k + 1) % n; B.tri(c1, t1[k], t1[j]); B.tri(c0, t0[j], t0[k]); }
    } else {
      const O = outline.map((p) => { const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l]; });
      for (let k = 0; k < n; k++) { const j = (k + 1) % n; B.quad(P0[k], P1[k], P1[j], P0[j]); } // 内向きの面
      const o0 = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z0], [d[0], d[1], 0]));
      const o1 = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z1], [d[0], d[1], 0]));
      for (let k = 0; k < n; k++) { const j = (k + 1) % n; B.tri(o0[k], o0[j], o1[j]); B.tri(o0[k], o1[j], o1[k]); }
      const ti = P1.map((p) => B.vert(p, [0, 0, 1])), to = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z1], [0, 0, 1]));
      const bi = P0.map((p) => B.vert(p, [0, 0, -1])), bo = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z0], [0, 0, -1]));
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n;
        B.tri(ti[k], to[k], to[j]); B.tri(ti[k], to[j], ti[j]);
        B.tri(bi[k], bo[j], bo[k]); B.tri(bi[k], bi[j], bo[j]);
      }
    }
    return B.done();
  }
  // 冠歯車の歯（円盤の面 z=zf から +Z へ立つ、放射状の台形の歯）。歯 k の中心は角度 phase + k·2π/Z。
  function crownTeeth(Z, m, rPitch, faceW, zf, phase) {
    const B = builder(), tau = TAU / Z, ht = 2.25 * m;
    const ra = rPitch - faceW / 2, rb = rPitch + faceW / 2;
    for (let k = 0; k < Z; k++) {
      const c = (phase || 0) + k * tau, cx = Math.cos(c), cy = Math.sin(c);
      const pt = (r, w, z) => [r * cx - w * cy, r * cy + w * cx, z];
      const wb = (r) => 0.30 * tau * r, wt = (r) => 0.13 * tau * r;
      hexa([
        pt(ra, -wb(ra), zf), pt(rb, -wb(rb), zf), pt(rb, wb(rb), zf), pt(ra, wb(ra), zf),
        pt(ra, -wt(ra), zf + ht), pt(rb, -wt(rb), zf + ht), pt(rb, wt(rb), zf + ht), pt(ra, wt(ra), zf + ht),
      ], true, B);
    }
    return B.done();
  }

  // ---- 管（点列に沿う。radius は数か、t(0..1) → [ru, rv] の関数） ----
  function tube(pts, radius, radial, caps) {
    const n = pts.length, R = radial || 6;
    const pos = [], nrm = [], uv = [], idx = [];
    const T = new THREE.Vector3(), N = new THREE.Vector3(), Bv = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const rad = typeof radius === 'function' ? radius : () => [radius, radius];
    for (let k = 0; k < n; k++) {
      a.fromArray(pts[Math.max(0, k - 1)]); b.fromArray(pts[Math.min(n - 1, k + 1)]);
      T.subVectors(b, a); if (T.lengthSq() < 1e-16) T.set(0, 1, 0); T.normalize();
      if (k === 0) {
        N.set(0, 1, 0); if (Math.abs(T.y) > 0.9) N.set(1, 0, 0);
      }
      N.addScaledVector(T, -N.dot(T)); if (N.lengthSq() < 1e-12) N.set(T.z, T.x, T.y).addScaledVector(T, -N.dot(T)); N.normalize();
      Bv.crossVectors(T, N);
      const r = rad(n > 1 ? k / (n - 1) : 0), p = pts[k];
      for (let j = 0; j < R; j++) {
        const ang = j / R * TAU, c = Math.cos(ang), s = Math.sin(ang);
        pos.push(p[0] + N.x * c * r[0] + Bv.x * s * r[1], p[1] + N.y * c * r[0] + Bv.y * s * r[1], p[2] + N.z * c * r[0] + Bv.z * s * r[1]);
        nrm.push(N.x * c + Bv.x * s, N.y * c + Bv.y * s, N.z * c + Bv.z * s);
        uv.push(Math.abs(2 * j / R - 1), k / Math.max(1, n - 1));
      }
      if (caps && (k === 0 || k === n - 1)) {
        const ring0 = pos.length / 3 - R;
        const sgn = k === 0 ? -1 : 1, base = pos.length / 3;
        pos.push(p[0], p[1], p[2]); nrm.push(T.x * sgn, T.y * sgn, T.z * sgn); uv.push(0.5, k ? 1 : 0);
        for (let j = 0; j < R; j++) {
          const q = (ring0 + j) * 3;
          pos.push(pos[q], pos[q + 1], pos[q + 2]); nrm.push(T.x * sgn, T.y * sgn, T.z * sgn); uv.push(0.5, k ? 1 : 0);
        }
        for (let j = 0; j < R; j++) { const j1 = (j + 1) % R; if (k === 0) idx.push(base, base + 1 + j1, base + 1 + j); else idx.push(base, base + 1 + j, base + 1 + j1); }
      }
    }
    // caps で頂点を足したので、輪 k の先頭番号を計算し直す
    const ringStart = [];
    { let o = 0; for (let k = 0; k < n; k++) { ringStart.push(o); o += R; if (caps && (k === 0 || k === n - 1)) o += R + 1; } }
    for (let k = 0; k < n - 1; k++) for (let j = 0; j < R; j++) {
      const j1 = (j + 1) % R, p0 = ringStart[k] + j, p1 = ringStart[k] + j1, q0 = ringStart[k + 1] + j, q1 = ringStart[k + 1] + j1;
      idx.push(p0, p1, q0, p1, q1, q0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  // ---- 回転体（Y 軸まわり）。profile = [[r, y], …] を「底の中心 → 外側を上へ → 縁 → 内側を下へ」の順に。
  // x = r·cosθ、z = r·sinθ。fn(pt, theta, out) で θ ごとに半径・高さを変えられる（縦リブ・注ぎ口）。
  // UV：u = 周（×uRep）、v = 輪郭に沿った長さ ÷ vLen。swapUV で入れ替え（木目を軸方向に）。
  function lathe(profile, segs, opt) {
    const o = opt || {}, K = profile.length, S = segs;
    const pos = new Float32Array(K * (S + 1) * 3), uv = new Float32Array(K * (S + 1) * 2), idx = [];
    const arc = [0];
    for (let k = 1; k < K; k++) arc.push(arc[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
    const out = { r: 0, y: 0 };
    const uRep = o.uRep || 1, vLen = o.vLen || (arc[K - 1] || 1);
    for (let k = 0; k < K; k++) for (let j = 0; j <= S; j++) {
      const th = (j % S) / S * TAU;
      out.r = profile[k][0]; out.y = profile[k][1];
      if (o.fn) o.fn(profile[k], th, out, k);
      const i = k * (S + 1) + j;
      pos[i * 3] = out.r * Math.cos(th); pos[i * 3 + 1] = out.y; pos[i * 3 + 2] = out.r * Math.sin(th);
      const u = j / S * uRep, v = arc[k] / vLen;
      if (o.swapUV) { uv[i * 2] = v; uv[i * 2 + 1] = u; } else { uv[i * 2] = u; uv[i * 2 + 1] = v; }
    }
    for (let k = 0; k < K - 1; k++) for (let j = 0; j < S; j++) {
      const a = k * (S + 1) + j, b = (k + 1) * (S + 1) + j, c = a + 1, d = b + 1;
      idx.push(a, b, c, c, b, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    // 継ぎ目（j=0 と j=S）と軸上の点の法線をそろえる
    const N = g.attributes.normal.array;
    for (let k = 0; k < K; k++) {
      const a = (k * (S + 1)) * 3, b = (k * (S + 1) + S) * 3;
      let nx = N[a] + N[b], ny = N[a + 1] + N[b + 1], nz = N[a + 2] + N[b + 2];
      if (profile[k][0] < 1e-7) {
        nx = 0; nz = 0; ny = 0;
        for (let j = 0; j <= S; j++) ny += N[(k * (S + 1) + j) * 3 + 1];
        ny = ny >= 0 ? 1 : -1;
        for (let j = 0; j <= S; j++) { const q = (k * (S + 1) + j) * 3; N[q] = 0; N[q + 1] = ny; N[q + 2] = 0; }
        continue;
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      N[a] = N[b] = nx / l; N[a + 1] = N[b + 1] = ny / l; N[a + 2] = N[b + 2] = nz / l;
    }
    return g;
  }

  // 角丸の四角（Shape または Path）
  function rrPath(Cls, x0, y0, x1, y1, r) {
    const s = new Cls(), h = Math.PI / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -h, 0, false);
    s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, h, false);
    s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, h, 2 * h, false);
    s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, 2 * h, 3 * h, false);
    return s;
  }
  // Shape を Z へ押し出す（面取りつき）。できた形は z∈[0, depth]、輪郭は shape そのまま（面取りは内側へ）。
  function extrude(shape, depth, bevel, curveSegs, bevelSegs) {
    const bv = bevel || 0;
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(1e-5, depth - 2 * bv), bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelOffset: -bv,
      bevelSegments: bevelSegs || seg(3, 1), curveSegments: curveSegs || seg(6, 2), steps: 1,
    });
    g.translate(0, 0, bv);
    return g;
  }

  return { THREE, A, own, owned, detail, seg, paint, textured, ensureIndex, at, rot, orient, merge, box, rbox, cyl, sphere, torus, builder, hexa, gearOutline, prism, crownTeeth, tube, lathe, rrPath, extrude };
}
