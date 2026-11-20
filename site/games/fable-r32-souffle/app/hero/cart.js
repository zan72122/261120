// レールと台車（天板）、ココット、ココットの中の生地＝スフレ、スプーン。
// 台車はレール沿いの距離 s で位置が決まり、車輪は s / 車輪半径 だけ回る。
// レールは「カウンター → 開いた扉の内側（跳ね橋）→ 庫内」と 1 本につながる。
import { TAU, clamp, lerp, smooth, hash, polarIndex, polarTriangles, polarNormals } from './util.js';

const HX = Math.PI / 2;

// ---- レールの道筋（点列＋法線＋道のり） ----
export function buildPath(P, D) {
  const o = P.oven, d = o.door, ct = P.cart;
  const cd = Math.cos(d.open), sd = Math.sin(d.open);
  const [HXw, HYw, HZw] = D.hingeW;
  // 開いた扉の上の点：扉ローカル (x, u=蝶番からの高さ) のレール上面
  const doorPt = (x, u) => [HXw + x, HYw + u * cd - D.doorRailW * sd, HZw + u * sd + D.doorRailW * cd];
  const R = d.arcR, E = doorPt(-d.w / 2, R);
  const back = 0.05;                                    // 出発点の後ろへ少し延ばす（後輪の下）
  const P0 = [D.pourAt[0] - D.sx * back, D.pourAt[2] - D.sz * back];
  const L1 = 0.21, L2 = 0.12;
  const C1 = [P0[0] + D.sx * L1, P0[1] + D.sz * L1], C2 = [E[0] - L2, E[2]], P3 = [E[0], E[2]];
  const pts = [], nrm = [], doorLocal = [];
  const nC = 44;
  for (let i = 0; i <= nC; i++) {
    const t = i / nC, m = 1 - t;
    const x = m * m * m * P0[0] + 3 * m * m * t * C1[0] + 3 * m * t * t * C2[0] + t * t * t * P3[0];
    const z = m * m * m * P0[1] + 3 * m * m * t * C1[1] + 3 * m * t * t * C2[1] + t * t * t * P3[1];
    pts.push([x, lerp(ct.railTop, E[1], smooth(0.34, 1.0, t)), z]); nrm.push(null);
  }
  const iDoor = pts.length - 1;                         // ここから扉の上
  doorLocal.push([-d.w / 2, R]);
  for (let i = 1; i <= 2; i++) { const x = -d.w / 2 + (d.w / 2 - R) * i / 2; pts.push(doorPt(x, R)); nrm.push([0, sd, -cd]); doorLocal.push([x, R]); }
  const nA = 18;
  for (let i = 1; i <= nA; i++) { const ph = HX * (1 - i / nA), x = -R + R * Math.cos(ph), u = R * Math.sin(ph); pts.push(doorPt(x, u)); nrm.push([0, sd, -cd]); doorLocal.push([x, u]); }
  const iHinge = pts.length - 1;
  const zIn = D.inOven[2], zH = pts[iHinge][2];
  for (let i = 1; i <= 4; i++) { pts.push([HXw, o.railTop, zH + (zIn - 0.07 - zH) * i / 4]); nrm.push([0, 1, 0]); }
  const n = pts.length, s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  // カウンター部分の法線：進む向きに垂直で、横は水平
  const tanAt = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l]; };
  for (let i = 0; i < n; i++) if (!nrm[i]) {
    const t = tanAt(i), hl = Math.hypot(t[0], t[2]) || 1, lx = -t[2] / hl, lz = t[0] / hl; // 横（水平）
    const nx = -(lz * t[1]), ny = lz * t[0] - lx * t[2], nz = lx * t[1], l = Math.hypot(nx, ny, nz) || 1;
    nrm[i] = [nx / l, ny / l, nz / l];
  }
  for (let pass = 0; pass < 2; pass++) { // つなぎ目で法線が急に変わらないようにならす
    const c = nrm.map((v) => v.slice());
    for (let i = 1; i < n - 1; i++) for (let k = 0; k < 3; k++) nrm[i][k] = (c[i - 1][k] + 2 * c[i][k] + c[i + 1][k]) / 4;
  }
  const sPour = back, sDoor = s[iDoor], sHinge = s[iHinge], sIn = s[iHinge] + (zH - zIn), len = s[n - 1];
  // 道のり s での位置・進む向き・法線
  function at(sv, outP, outT, outN) {
    const q = clamp(sv, 0, len - 1e-6);
    let i = 0, lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m] <= q) lo = m; else hi = m; }
    i = lo;
    const f = (q - s[i]) / Math.max(1e-9, s[i + 1] - s[i]), a = pts[i], b = pts[i + 1];
    outP.set(lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f));
    const t0 = tanAt(i), t1 = tanAt(i + 1);
    outT.set(lerp(t0[0], t1[0], f), lerp(t0[1], t1[1], f), lerp(t0[2], t1[2], f));
    if (outT.lengthSq() < 1e-12) outT.set(1, 0, 0); outT.normalize();
    outN.set(lerp(nrm[i][0], nrm[i + 1][0], f), lerp(nrm[i][1], nrm[i + 1][1], f), lerp(nrm[i][2], nrm[i + 1][2], f));
    outN.addScaledVector(outT, -outN.dot(outT)); if (outN.lengthSq() < 1e-12) outN.set(0, 1, 0); outN.normalize();
  }
  return { pts, nrm, s, n, iDoor, iHinge, doorLocal, sPour, sServe: sPour + ct.serveS, sDoor, sHinge, sIn, len, at, tanAt };
}

// ---- カウンターの上のレール（静止）：鋼のレール 2 本＋木の枕木と橋げた ----
export function buildTrack(ctx, root, path) {
  const { THREE, K, M, P } = ctx;
  const ct = P.cart, c = P.col, half = ct.gauge / 2;
  const L = [], Rr = [], wood = [], steel = [];
  const lat = (i) => { const t = path.tanAt(i), n = path.nrm[i]; return [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]]; };
  for (let i = 0; i <= path.iDoor; i++) {
    const p = path.pts[i], l = lat(i), n = path.nrm[i];
    L.push([p[0] - l[0] * half - n[0] * ct.railR, p[1] - l[1] * half - n[1] * ct.railR, p[2] - l[2] * half - n[2] * ct.railR]);
    Rr.push([p[0] + l[0] * half - n[0] * ct.railR, p[1] + l[1] * half - n[1] * ct.railR, p[2] + l[2] * half - n[2] * ct.railR]);
  }
  steel.push(K.paint(K.tube(L, ct.railR, K.seg(5, 4), true), c.steel, 1, 0.22));
  steel.push(K.paint(K.tube(Rr, ct.railR, K.seg(5, 4), true), c.steel, 1, 0.22));
  // 枕木：一定の間隔で。高い所は橋げたで支える
  const step = 0.038, P3 = new THREE.Vector3(), T3 = new THREE.Vector3(), N3 = new THREE.Vector3();
  for (let sv = 0.012; sv < path.sDoor - 0.01; sv += step) {
    path.at(sv, P3, T3, N3);
    const lx = T3.y * N3.z - T3.z * N3.y, ly = T3.z * N3.x - T3.x * N3.z, lz = T3.x * N3.y - T3.y * N3.x;
    const yTop = P3.y - 2 * ct.railR;
    const tie = K.box(0.013, 0.004, ct.gauge + 0.026);
    K.orient(tie, [T3.x, T3.y, T3.z], [lx, ly, lz]); tie.translate(P3.x, yTop - 0.002, P3.z);
    wood.push(K.textured(tie));
    const h = yTop - 0.004;
    if (h > 0.004) for (const sgn of [-1, 1]) {
      const post = K.box(0.011, h, 0.011); post.rotateY(-Math.atan2(T3.z, T3.x));
      post.translate(P3.x + lx * sgn * half, h / 2, P3.z + lz * sgn * half);
      wood.push(K.textured(post));
    }
  }
  { // 車止め
    const p = path.pts[0], t = path.tanAt(0), l = lat(0);
    const stop = K.rbox(0.008, 0.014, ct.gauge + 0.02, 0.002, 1);
    K.orient(stop, t, l); stop.translate(p[0] - t[0] * 0.006, 0.007, p[2] - t[2] * 0.006);
    steel.push(K.paint(stop, c.enamelDark, 0, 0.34));
  }
  const rails = new THREE.Mesh(K.merge(steel), M.hard()); root.add(rails);
  const woodGeo = K.merge(wood);
  { const uv = woodGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.35 + (i % 7) * 0.09, uv.getY(i) * 0.2 + (i % 5) * 0.13); }
  const ties = new THREE.Mesh(woodGeo, M.wood()); ties.material.color.set(0xf2d3ad); root.add(ties);
  return { rails, ties };
}

// ---- 台車＋ココット＋スフレ＋スプーン ----
export function buildCart(ctx, root, path) {
  const { THREE, K, M, P, D } = ctx;
  const ct = P.cart, R = P.ramekin, S = P.souffle, c = P.col;
  const pt = (geo, m) => K.paint(geo, m[0], m[1], m[2]);
  const CR = [c.cream, 0, 0.36], ST = [c.steel, 1, 0.2], BR = [c.brass, 1, 0.3], EN = [c.enamel, 0, 0.3], IR = [c.iron, 0.3, 0.5];

  const cart = new THREE.Group(); cart.name = 'cart'; root.add(cart);
  {
    const g = [];
    g.push(pt(K.at(K.rbox(ct.L, ct.plateT, ct.W, 0.0028, 2), 0, ct.deckH - ct.plateT / 2, 0), CR));
    g.push(pt(K.at(K.cyl(R.foot + 0.006, R.foot + 0.006, 0.002, K.seg(24, 12), 'y'), 0, ct.deckH + 0.0006, 0), EN));
    for (const sx of [-1, 1]) {
      g.push(pt(K.at(K.cyl(0.0022, 0.0022, ct.gauge + ct.wheelT, 6, 'z'), sx * ct.axleX, ct.wheelR, 0), ST));
      g.push(pt(K.at(K.box(0.012, ct.deckH - ct.plateT - ct.wheelR + 0.004, ct.W - 0.012), sx * ct.axleX, (ct.deckH - ct.plateT + ct.wheelR) / 2, 0), EN));
    }
    cart.add(new THREE.Mesh(K.merge(g), M.hard()));
  }
  // 車輪 ×4（InstancedMesh）。穴の模様で回転が見える
  const wheelGeo = (() => {
    const g = [pt(K.cyl(ct.wheelR, ct.wheelR, ct.wheelT, K.seg(16, 10), 'z'), BR)];
    g.push(pt(K.cyl(ct.wheelR * 0.36, ct.wheelR * 0.36, ct.wheelT + 0.002, 8, 'z'), ST));
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3;
      g.push(pt(K.at(K.cyl(ct.wheelR * 0.2, ct.wheelR * 0.2, ct.wheelT + 0.0012, 6, 'z'), Math.cos(a) * ct.wheelR * 0.66, Math.sin(a) * ct.wheelR * 0.66, 0), IR));
    }
    return K.merge(g);
  })();
  const wheels = new THREE.InstancedMesh(wheelGeo, M.hard(), 4); wheels.frustumCulled = false; cart.add(wheels);
  const wheelPos = [[ct.axleX, 1], [ct.axleX, -1], [-ct.axleX, 1], [-ct.axleX, -1]];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
  function setWheels(sv) {
    _q.setFromEuler(_e.set(0, 0, -sv / ct.wheelR));             // 進んだ距離 ÷ 半径 ＝ 回転角
    for (let i = 0; i < 4; i++) { _m.compose(_v.set(wheelPos[i][0], ct.wheelR, wheelPos[i][1] * ct.gauge / 2), _q, _one); wheels.setMatrixAt(i, _m); }
    wheels.instanceMatrix.needsUpdate = true;
  }

  // ---- ココット（白い陶器、外側に縦リブ） ----
  const ramekin = new THREE.Group(); ramekin.position.set(0, ct.deckH, 0); cart.add(ramekin);
  const wiggle = new THREE.Group(); ramekin.add(wiggle);
  {
    const H = R.H, prof = [[0, 0, 0], [R.foot - 0.005, 0, 0], [R.foot - 0.001, 0.0012, 0], [R.foot + 0.0005, 0.005, 0.5]];
    const nw = K.seg(5, 3);
    for (let i = 1; i <= nw; i++) { const t = i / nw; prof.push([lerp(R.foot + 0.001, R.Ro - 0.0005, t), lerp(0.006, H - 0.013, t), 1]); }
    prof.push([R.Ro + 0.0012, H - 0.011, 0], [R.Ro + 0.002, H - 0.006, 0], [R.Ro + 0.0015, H - 0.0015, 0], [R.Ro - 0.001, H, 0], [R.Ri + 0.0015, H, 0],
      [R.Ri, H - 0.002, 0], [R.Ri - 0.0008, R.floor + 0.006, 0], [R.Ri - 0.004, R.floor, 0], [0, R.floor, 0]);
    const fn = (p, th, out) => { if (p[2]) out.r *= 1 - 0.05 * p[2] * (1 - Math.abs(Math.cos(R.ribs * th / 2))); };
    const geo = K.textured(K.lathe(prof, K.seg(R.ribs * 4, R.ribs * 2), { fn, uRep: 3, vLen: 0.1 }));
    wiggle.add(new THREE.Mesh(K.own(geo), M.ceramic));
  }

  // ---- 生地 → スフレ（中心 1 点＋ NR×NS。上面 → 肩 → 側面の順に輪が並ぶ） ----
  const NR = K.seg(S.NR, 12), NS = K.seg(S.NS, 24), NV = 1 + NR * NS;
  const pos = new Float32Array(NV * 3), nrm = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), aTop = new Float32Array(NV);
  const tTab = new Float32Array(NR + 1), cosT = new Float32Array(NS), sinT = new Float32Array(NS), lumpR = new Float32Array(NS), lumpS = new Float32Array((NR + 1) * NS);
  for (let j = 0; j < NS; j++) { const th = j / NS * TAU; cosT[j] = Math.cos(th); sinT[j] = Math.sin(th); lumpR[j] = Math.sin(th * 3 + 0.7) * 0.6 + Math.sin(th * 7 + 2.3) * 0.4; }
  uv[0] = 0.5; uv[1] = 0.5; aTop[0] = 1;
  for (let i = 1; i <= NR; i++) {
    const t = Math.pow(i / NR, 0.85); tTab[i] = t;
    for (let j = 0; j < NS; j++) {
      const k = polarIndex(i, j, NS), rad = 0.5 * Math.pow(t, 0.9);
      uv[k * 2] = 0.5 + rad * cosT[j]; uv[k * 2 + 1] = 0.5 + rad * sinT[j];
      aTop[k] = clamp(1 - 0.62 * smooth(0.5, 0.98, t) + (hash(i, j) - 0.5) * 0.12, 0, 1);
      const x = t * cosT[j], z = t * sinT[j];
      lumpS[i * NS + j] = 0.55 * Math.sin(x * 5.3 + 0.9) * Math.cos(z * 4.7 + 1.8) + 0.45 * Math.sin((x - z) * 8.1 + 0.3);
    }
  }
  const sgeo = K.own(new THREE.BufferGeometry());
  sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  sgeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
  sgeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  sgeo.setAttribute('aTop', new THREE.BufferAttribute(aTop, 1));
  sgeo.setIndex(polarTriangles(NR, NS));
  sgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.06, 0), 0.14);
  const souffle = new THREE.Mesh(sgeo, M.souffle); souffle.visible = false; wiggle.add(souffle);
  const info = { top: R.H, base: R.floor };  // いまの頂上の高さ（ココットのローカル）

  // s: { p, b, pile, wobX, wobZ, sq, dent(0/1), dx, dy, dz }
  function updateSouffle(s) {
    souffle.visible = s.p > 0.01;
    if (!souffle.visible) return;
    const yF = R.floor, yR = R.H, Ri = R.Ri - 0.0006;
    const yb = yF + (yR - 0.004 - yF) * Math.pow(Math.min(1, s.p), 0.85);
    const sb = smooth(0, 1, s.b), baked = s.p >= 1;
    const Hc = baked ? S.H0 + S.H1 * smooth(0.05, 0.85, s.b) : S.H0 * smooth(0.45, 1, s.p);   // H(b)
    const yTop = yb + Hc, rise = Math.max(1e-4, yTop - yR);
    const ex = 2 / lerp(2.0, 4.0, smooth(0.08, 0.9, s.b)), grow = smooth(0.15, 1, s.b);
    const rs = S.scoopR, rs2 = rs * rs, hRef = S.H0 + S.H1;
    info.top = yTop; info.base = yb;
    for (let i = 1; i <= NR; i++) {
      const a = tTab[i] * HX, cr = Math.pow(Math.sin(a), ex), cy = Math.pow(Math.max(0, Math.cos(a)), ex);
      const y0 = yb + Hc * cy, q = (y0 - yR) / rise;
      const F = 1 + (S.flare - 1) * sb * smooth(0, 0.22, q) * (1 - 0.16 * smooth(0.5, 1, q)); // 縁の上で外へはみ出す
      const r0 = Ri * F * cr, edge = smooth(0, 0.3, q), pile = baked ? 0 : s.pile * Math.exp(-(r0 / 0.02) * (r0 / 0.02));
      for (let j = 0; j < NS; j++) {
        const cs = cosT[j], sn = sinT[j];
        const r = r0 * (1 + 0.035 * sb * lumpR[j] * edge);
        let x = r * cs, z = r * sn;
        let y = y0 + pile + Hc * grow * cy * (0.08 * (cs * 0.62 + sn * 0.78) * cr + 0.06 * lumpS[i * NS + j]);
        // ぷるぷる：高さの 2 乗に比例する横ずれ＋つぶれ。焼く前は面がゆれる
        const hq = clamp((y - (yR - 0.006)) / hRef, 0, 1.3);
        x += s.wobX * hq * hq; z += s.wobZ * hq * hq;
        y += (x * s.wobX + z * s.wobZ) * 5 * (1 - sb);
        const yq = y - (yR - 0.004);
        if (yq > 0) { y -= yq * s.sq; x *= 1 + 0.45 * s.sq * hq; z *= 1 + 0.45 * s.sq * hq; }
        // すくった跡：球の下半分に沿ってくぼませる
        if (s.dent > 0) {
          const ddx = x - s.dx, ddz = z - s.dz, d2 = ddx * ddx + ddz * ddz;
          if (d2 < rs2) { const ys = s.dy - Math.sqrt(rs2 - d2); if (y > ys) y = Math.max(ys, yF + 0.002); }
        }
        const k = polarIndex(i, j, NS) * 3;
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      }
    }
    let yc = yTop + (baked ? 0 : s.pile);
    { const hq = clamp((yc - (yR - 0.006)) / hRef, 0, 1.3); pos[0] = s.wobX * hq * hq; pos[2] = s.wobZ * hq * hq;
      const yq = yc - (yR - 0.004); if (yq > 0) yc -= yq * s.sq;
      if (s.dent > 0) { const ddx = pos[0] - s.dx, ddz = pos[2] - s.dz, d2 = ddx * ddx + ddz * ddz; if (d2 < rs2) { const ys = s.dy - Math.sqrt(rs2 - d2); if (yc > ys) yc = ys; } }
      pos[1] = yc; }
    polarNormals(pos, nrm, NR, NS);
    sgeo.attributes.position.needsUpdate = true; sgeo.attributes.normal.needsUpdate = true;
  }

  // ---- 当たり判定 ----
  const ramekinHit = new THREE.Mesh(K.own(K.box(0.17, 0.15, 0.17)), M.hit); ramekinHit.visible = false; ramekinHit.position.set(0, ct.deckH + 0.045, 0); cart.add(ramekinHit);
  const souffleHit = new THREE.Mesh(K.own(K.box(0.17, 0.19, 0.17)), M.hit); souffleHit.visible = false; souffleHit.position.set(0, ct.deckH + 0.075, 0); cart.add(souffleHit);
  const ramekinPivot = new THREE.Object3D(); ramekinPivot.position.set(0, ct.deckH + R.H * 0.6, 0); cart.add(ramekinPivot);
  const soufflePivot = new THREE.Object3D(); soufflePivot.position.set(0, ct.deckH + R.H + 0.03, 0); cart.add(soufflePivot);

  // ---- スプーン（serve の位置では、この枠の軸がワールドの軸と平行） ----
  const serveFrame = new THREE.Group(); serveFrame.position.set(0, ct.deckH, 0); cart.add(serveFrame);
  const spoon = new THREE.Group(); spoon.visible = false; serveFrame.add(spoon);
  const spoonWiggle = new THREE.Group(); spoon.add(spoonWiggle);
  const sp = P.spoon, spoonMat = M.hard();
  {
    const g = [], Rs = sp.Rs, th = 0.0011, amax = Math.acos((Rs - sp.depth) / Rs), na = K.seg(7, 4), prof = [];
    for (let i = 0; i <= na; i++) { const a = amax * i / na; prof.push([Rs * Math.sin(a), Rs * (1 - Math.cos(a))]); }
    for (let i = na; i >= 0; i--) { const a = amax * i / na; prof.push([(Rs - th) * Math.sin(a), Rs - (Rs - th) * Math.cos(a)]); }
    const bowl = K.lathe(prof, K.seg(18, 10)); bowl.scale(1.28, 1, 1); bowl.computeVertexNormals();
    g.push(pt(bowl, ST));
    const rimX = 1.28 * Rs * Math.sin(amax), pts = [], n = K.seg(10, 5);
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([rimX - 0.004 + (sp.len - rimX) * t, sp.depth - 0.001 + 0.03 * Math.sin(t * HX) - 0.004 * t * t, 0]); }
    g.push(pt(K.tube(pts, (t) => [0.0013, lerp(0.0034, 0.0068, smooth(0.1, 1, t))], 6, true), ST));
    spoonWiggle.add(new THREE.Mesh(K.merge(g), spoonMat));
  }
  // スプーンの上のひとすくい（気泡の断面と同じ模様）
  const bite = (() => {
    const Rs = sp.Rs - 0.0011, prof = [[0, 0.0011]], amax = Math.asin(0.0165 / Rs), na = 4, nt = K.seg(6, 4);
    for (let i = 1; i <= na; i++) { const a = amax * i / na; prof.push([Rs * Math.sin(a), sp.Rs - Rs * Math.cos(a)]); }
    const r1 = Rs * Math.sin(amax), y1 = sp.Rs - Rs * Math.cos(amax);
    for (let i = 1; i <= nt; i++) { const a = HX * i / nt; prof.push([r1 * Math.cos(a) * (1 + 0.12 * Math.sin(a * 2)), y1 + 0.015 * Math.sin(a)]); }
    const geo = K.textured(K.lathe(prof, K.seg(14, 8), { uRep: 1, vLen: 0.05 })); geo.scale(1.25, 1, 1); geo.computeVertexNormals();
    const m = new THREE.Mesh(K.own(geo), M.scoop); m.visible = false; spoonWiggle.add(m); return m;
  })();
  const spoonHit = new THREE.Mesh(K.own(K.box(0.2, 0.2, 0.14)), M.hit); spoonHit.visible = false; spoonHit.position.set(0.04, 0.02, 0); spoon.add(spoonHit);

  // ---- 影（疑似影の板。台車について動く） ----
  const blob = new THREE.Mesh(K.own(new THREE.PlaneGeometry(0.19, 0.17)), M.blob);
  blob.rotation.x = -HX; blob.renderOrder = -1; root.add(blob);

  // 台車をレールの道のり sv に置く
  const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _l = new THREE.Vector3(), _b = new THREE.Matrix4();
  function place(sv) {
    path.at(sv, _p, _t, _n);
    _l.crossVectors(_t, _n);
    _b.makeBasis(_t, _n, _l);
    cart.quaternion.setFromRotationMatrix(_b);
    cart.position.copy(_p);
    setWheels(sv);
    blob.visible = sv < path.sDoor - 0.02;
    blob.position.set(_p.x, 0.0016, _p.z);
    blob.rotation.z = Math.atan2(_t.z, _t.x) * -1;
  }
  // serve の位置での台車の向き（スプーンの枠をワールドに合わせる）
  path.at(path.sServe, _p, _t, _n);
  const serveYaw = Math.atan2(_t.z, _t.x);
  serveFrame.rotation.y = serveYaw;

  return {
    cart, ramekin, wiggle, souffle, updateSouffle, info, place, serveYaw, serveFrame,
    ramekinHit, souffleHit, ramekinPivot, soufflePivot, spoon, spoonWiggle, spoonHit, bite, spoonMat, blob, NR, NS,
  };
}
