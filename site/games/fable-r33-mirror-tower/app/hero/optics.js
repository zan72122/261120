// 鏡と光線の数式（純粋関数。{x,y,z} を持つ物なら何でもよい＝THREE.Vector3 でも素のオブジェクトでも動く）。
//   鏡の法線   n(θ) = n0 cosθ + (a × n0) sinθ      （a ⟂ n0、ロドリゲスの回転）
//   反射       r = d − 2(d·n)n
// リアルタイムレイトレーシングはしない。1本の光線を最大 5 回の反射まで CPU でたどるだけ。

const EPS = 1e-4;
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b, o = v3()) => {
  const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
  o.x = x; o.y = y; o.z = z; return o;
};
export const sub = (a, b, o = v3()) => { o.x = a.x - b.x; o.y = a.y - b.y; o.z = a.z - b.z; return o; };
export const addScaled = (a, b, s, o = v3()) => { o.x = a.x + b.x * s; o.y = a.y + b.y * s; o.z = a.z + b.z * s; return o; };
export const len = (a) => Math.sqrt(dot(a, a));
// 長さ 0 のベクトルは normalize しない（NaN 防止）。fallback を返す
export function norm(a, o = v3(), fx = 0, fy = 1, fz = 0) {
  const l = len(a);
  if (!(l > 1e-9)) { o.x = fx; o.y = fy; o.z = fz; return o; }
  o.x = a.x / l; o.y = a.y / l; o.z = a.z / l; return o;
}

// 鏡 m = { c, a, n0, b, n, u, halfU, halfA }。角度 θ から法線 n と面内の横方向 u = a × n を更新
export function setMirrorAngle(m, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  m.n.x = m.n0.x * c + m.b.x * s;
  m.n.y = m.n0.y * c + m.b.y * s;
  m.n.z = m.n0.z * c + m.b.z * s;
  cross(m.a, m.n, m.u);
}

// 入射 dIn を dOut へ反射する鏡の角度。必要な法線は (dOut − dIn) に平行。軸 a に垂直な成分だけ使う。
// near に最も近い π 周期の解を返す。解けないとき（差が軸方向だけ）は null。
export function aimAngle(m, dIn, dOut, near = 0) {
  let x = dOut.x - dIn.x, y = dOut.y - dIn.y, z = dOut.z - dIn.z;
  const k = x * m.a.x + y * m.a.y + z * m.a.z;
  x -= k * m.a.x; y -= k * m.a.y; z -= k * m.a.z;
  if (x * x + y * y + z * z < 1e-10) return null;
  let th = Math.atan2(x * m.b.x + y * m.b.y + z * m.b.z, x * m.n0.x + y * m.n0.y + z * m.n0.z);
  let d = (th - near) % Math.PI;
  if (d > Math.PI / 2) d -= Math.PI;
  if (d < -Math.PI / 2) d += Math.PI;
  return near + d;
}

// 長方形の鏡との交差。t（> EPS）か Infinity
export function hitRect(m, o, d) {
  const denom = dot(d, m.n);
  if (Math.abs(denom) < 1e-6) return Infinity;
  const t = ((m.c.x - o.x) * m.n.x + (m.c.y - o.y) * m.n.y + (m.c.z - o.z) * m.n.z) / denom;
  if (!(t > EPS)) return Infinity;
  const px = o.x + d.x * t - m.c.x, py = o.y + d.y * t - m.c.y, pz = o.z + d.z * t - m.c.z;
  if (Math.abs(px * m.u.x + py * m.u.y + pz * m.u.z) > m.halfU) return Infinity;
  if (Math.abs(px * m.a.x + py * m.a.y + pz * m.a.z) > m.halfA) return Infinity;
  return t;
}

export function hitSphere(c, r, o, d) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const disc = b * b - (ox * ox + oy * oy + oz * oz - r * r);
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t > EPS ? t : Infinity;
}

// 縦の円柱（側面だけ、y0..y1）
export function hitCylinderY(c, r, y0, y1, o, d) {
  const A = d.x * d.x + d.z * d.z;
  if (A < 1e-10) return Infinity;
  const ox = o.x - c.x, oz = o.z - c.z;
  const B = ox * d.x + oz * d.z;
  const disc = B * B - A * (ox * ox + oz * oz - r * r);
  if (disc < 0) return Infinity;
  const t = (-B - Math.sqrt(disc)) / A;
  if (!(t > EPS)) return Infinity;
  const y = o.y + d.y * t;
  return y >= y0 && y <= y1 ? t : Infinity;
}

// 塔の境界で止める：床 y=0、z≤0 側は半径 R の円筒の内壁、上は高さ H を越えたら空へ skyExtra 伸ばす、
// 手前は z=front、z>0 の左右は |x|=side。end に種類と面の法線を書く。
export function hitBounds(w, o, d, end) {
  let t = Infinity, kind = 'air';
  let nx = -d.x, ny = -d.y, nz = -d.z;
  if (d.z > 1e-6) { const tf = (w.front - o.z) / d.z; if (tf > 0 && tf < t) { t = tf; kind = 'air'; } }
  if (Math.abs(d.x) > 1e-6) {
    const ts = ((d.x > 0 ? w.side : -w.side) - o.x) / d.x;
    if (ts > 0 && ts < t && o.z + d.z * ts > 0) { t = ts; kind = 'air'; }
  }
  const A = d.x * d.x + d.z * d.z;
  if (A > 1e-10) {
    const B = o.x * d.x + o.z * d.z, C = o.x * o.x + o.z * o.z - w.radius * w.radius;
    const disc = B * B - A * C;
    if (disc >= 0) {
      const tc = (-B + Math.sqrt(disc)) / A;
      if (tc > 0 && tc < t && o.z + d.z * tc <= 0) {
        t = tc; kind = 'wall';
        nx = -(o.x + d.x * tc) / w.radius; ny = 0; nz = -(o.z + d.z * tc) / w.radius;
      }
    }
  }
  // 壁より先に塔の上端を越えるなら空へ
  if (d.y > 1e-6) {
    const tt = (w.height - o.y) / d.y;
    if (tt < t) { t = Math.max(tt, 0) + w.skyExtra; kind = 'sky'; nx = -d.x; ny = -d.y; nz = -d.z; }
  }
  if (d.y < -1e-6) {
    const tf = (w.floor - o.y) / d.y;
    if (tf > 0 && tf < t) { t = tf; kind = 'floor'; nx = 0; ny = 1; nz = 0; }
  }
  if (!(t < 1e9)) { t = w.maxLength; kind = 'air'; }
  end.kind = kind; end.n.x = nx; end.n.y = ny; end.n.z = nz;
  return Math.max(0, t);
}

export function makePath(maxBounces) {
  const pts = [];
  for (let i = 0; i <= maxBounces + 2; i++) pts.push(v3());
  return {
    pts, hits: [], count: 0, len: 0,
    end: { kind: 'air', n: v3(0, 1, 0), receiver: null },
    // 鏡ごとの入射（当たっていれば lit=true、入射方向 d と当たった点 p）
    incoming: [],
  };
}

// 光路をたどる。scene = { origin, dir, mirrors[], receivers[], world }
//   receivers: { id, shape:'sphere'|'cylinder', c, r, y0, y1 }
export function trace(scene, path) {
  const w = scene.world;
  const o = path._o || (path._o = v3()), d = path._d || (path._d = v3());
  o.x = scene.origin.x; o.y = scene.origin.y; o.z = scene.origin.z;
  d.x = scene.dir.x; d.y = scene.dir.y; d.z = scene.dir.z;
  path.hits.length = 0;
  for (let i = 0; i < scene.mirrors.length; i++) {
    const inc = path.incoming[i] || (path.incoming[i] = { lit: false, d: v3(), p: v3() });
    inc.lit = false;
  }
  const p0 = path.pts[0]; p0.x = o.x; p0.y = o.y; p0.z = o.z;
  let n = 0, total = 0, from = -1;
  path.end.receiver = null;
  for (let k = 0; k <= w.maxBounces; k++) {
    let best = hitBounds(w, o, d, path.end), what = null, isMirror = false;
    for (let i = 0; i < scene.mirrors.length; i++) {
      if (i === from) continue;
      const t = hitRect(scene.mirrors[i], o, d);
      if (t < best) { best = t; what = scene.mirrors[i]; isMirror = true; }
    }
    for (let i = 0; i < scene.receivers.length; i++) {
      const r = scene.receivers[i];
      const t = r.shape === 'cylinder' ? hitCylinderY(r.c, r.r, r.y0, r.y1, o, d) : hitSphere(r.c, r.r, o, d);
      if (t < best) { best = t; what = r; isMirror = false; }
    }
    let clipped = false;
    if (best > w.maxLength - total) { best = Math.max(0, w.maxLength - total); clipped = true; }
    o.x += d.x * best; o.y += d.y * best; o.z += d.z * best;
    total += best;
    const p = path.pts[++n]; p.x = o.x; p.y = o.y; p.z = o.z;
    if (clipped) { path.end.kind = 'air'; path.end.n.x = -d.x; path.end.n.y = -d.y; path.end.n.z = -d.z; break; }
    if (what && isMirror) {
      const inc = path.incoming[what.index];
      inc.lit = true; inc.d.x = d.x; inc.d.y = d.y; inc.d.z = d.z; inc.p.x = o.x; inc.p.y = o.y; inc.p.z = o.z;
      path.hits.push(what.id);
      if (k === w.maxBounces) { path.end.kind = 'mirror'; path.end.n.x = -d.x; path.end.n.y = -d.y; path.end.n.z = -d.z; break; }
      const dn = 2 * dot(d, what.n);
      d.x -= dn * what.n.x; d.y -= dn * what.n.y; d.z -= dn * what.n.z; // r = d − 2(d·n)n
      const l = len(d);
      if (l > 1e-9) { d.x /= l; d.y /= l; d.z /= l; }
      from = what.index;
      continue;
    }
    if (what) {
      path.hits.push(what.id);
      path.end.kind = 'receiver'; path.end.receiver = what.id;
      path.end.n.x = -d.x; path.end.n.y = -d.y; path.end.n.z = -d.z;
    }
    break;
  }
  path.count = n;
  path.len = total;
  return path;
}
