// 銅のボウル（そりに載って泡立て器の下から出てくる）、ボウルの中の生地の表面、注がれる流れ。
// 生地は 1 つの状態（w=泡立て、p=注ぎ）から、高さ・うねり・泡の跡・角・傾きを毎フレーム頂点変形で作る。
import { TAU, clamp, lerp, smooth, wrapPi, hash, polarIndex, polarTriangles, polarNormals } from './util.js';

export function buildBowl(ctx, mixerGroup) {
  const { THREE, K, M, P, D } = ctx;
  const b = P.bowl, c = P.col, top = D.bowlTop;
  const pt = (geo, m) => K.paint(geo, m[0], m[1], m[2]);
  const CR = [c.cream, 0, 0.36], END = [c.enamelDark, 0, 0.34], ST = [c.steel, 1, 0.2], BR = [c.brass, 1, 0.3];

  // ---- そり（ミキサーの台のレールの上を +X へすべる） ----
  const sled = new THREE.Group(); sled.name = 'sled'; mixerGroup.add(sled);
  {
    const sl = [];
    sl.push(pt(K.at(K.cyl(0.078, 0.078, 0.008, K.seg(28, 12), 'y'), 0, b.baseY - 0.004, 0), CR));
    for (const sz of [-1, 1]) sl.push(pt(K.at(K.rbox(0.10, 0.008, 0.018, 0.003, 1), 0, b.baseY - 0.0105, sz * 0.04), END));
    // 注ぎ口の下の支え（二股）とピン：ボウルはこのピンを軸に傾く
    const yk = [];
    for (const sz of [-1, 1]) {
      yk.push(pt(K.at(K.rbox(0.105, 0.006, 0.010, 0.002, 1), 0.106, b.baseY - 0.003, sz * 0.028), END));
      const h = D.pivY + 0.008;
      yk.push(pt(K.at(K.cyl(0.0045, 0.004, h, 8, 'y'), D.pivR + 0.004, b.baseY + h / 2 - 0.002, sz * 0.028), END));
      yk.push(pt(K.at(K.sphere(0.0055, 8, 6), D.pivR + 0.004, b.baseY + D.pivY, sz * 0.028), BR));
    }
    yk.push(pt(K.at(K.cyl(0.0028, 0.0028, 0.06, 8, 'z'), D.pivR, b.baseY + D.pivY, 0), ST));
    yk.forEach((g) => { g.rotateY(-b.spoutYaw); sl.push(g); });
    sled.add(new THREE.Mesh(K.merge(sl), M.hard()));
  }
  const yaw = new THREE.Group(); yaw.position.set(0, b.baseY, 0); yaw.rotation.y = -b.spoutYaw; sled.add(yaw);
  const tilt = new THREE.Group(); tilt.position.set(D.pivR, D.pivY, 0); yaw.add(tilt);
  const bowl = new THREE.Group(); bowl.position.set(-D.pivR, -D.pivY, 0); tilt.add(bowl);

  // ---- ボウル本体（回転体：外側 → 巻いた縁 → 内側）＋注ぎ口＋取っ手 ----
  const rinAt = (y) => b.Rf + (b.Rr - b.Rf) * Math.pow(clamp((y - b.thk) / b.depth, 0, 1), 1 / b.e);
  const yin = (r) => (r <= b.Rf ? b.thk : b.thk + b.depth * Math.pow(Math.min(1, (r - b.Rf) / (b.Rr - b.Rf)), b.e));
  {
    const prof = [[0, 0], [b.Rf * 0.6, 0], [b.Rf + b.thk - 0.007, 0], [b.Rf + b.thk - 0.002, 0.0012]];
    const no = K.seg(9, 5), ni = K.seg(11, 6), ro = b.Rr + b.thk, k = b.roll;
    for (let i = 1; i < no; i++) { const q = Math.pow(i / no, 1.6); prof.push([b.Rf + b.thk + (b.Rr - b.Rf) * Math.pow(q, 1 / b.e), top * q]); }
    prof.push([ro + k * 0.2, top - k * 1.2], [ro + k * 0.75, top - k * 0.3], [ro + k * 0.55, top + k * 0.65], [(ro + b.Rr) / 2, top + k], [b.Rr - k * 0.35, top + k * 0.45], [b.Rr, top - k * 0.6]);
    for (let i = ni - 1; i >= 0; i--) { const q = Math.pow(i / ni, 1.6); prof.push([b.Rf + (b.Rr - b.Rf) * Math.pow(q, 1 / b.e), b.thk + b.depth * q]); }
    prof.push([b.Rf * 0.5, b.thk], [0, b.thk]);
    const fn = (p, th, out) => {
      const a = wrapPi(th), wt = Math.exp(-(a / 0.3) * (a / 0.3)), wy = smooth(top - 0.035, top, p[1]);
      out.r += b.lip * wt * wy; out.y -= 0.003 * wt * wy;
    };
    const parts = [K.textured(K.lathe(prof, K.seg(b.segs, 28), { fn, uRep: 6, vLen: 0.13 }))];
    const rH = rinAt(top - 0.03) + b.thk;
    for (const sz of [-1, 1]) {
      parts.push(K.textured(K.at(K.rot(K.torus(0.019, 0.0042, K.seg(8, 5), K.seg(20, 10)), sz * 0.25, 0, 0), 0, top - 0.04, sz * (rH + 0.006))));
      parts.push(K.textured(K.at(K.cyl(0.006, 0.006, 0.011, 8, 'z'), 0, top - 0.022, sz * (rH + 0.0085))));
    }
    // 注ぎ口の下の軸受け（ピンにかぶさる）
    parts.push(K.textured(K.at(K.cyl(0.0058, 0.0058, 0.03, 10, 'z'), D.pivR, D.pivY, 0)));
    parts.push(K.textured(K.at(K.box(0.012, 0.012, 0.026), D.pivR - 0.005, D.pivY + 0.004, 0)));
    bowl.add(new THREE.Mesh(K.merge(parts), M.copper));
  }

  // ---- 当たり判定とヒントの中心 ----
  const hit = new THREE.Mesh(K.own(K.box(0.38, 0.24, 0.34)), M.hit); hit.visible = false; hit.position.set(0.015, b.baseY + 0.085, 0); sled.add(hit);
  const pivot = new THREE.Object3D(); pivot.position.set(0, b.baseY + top, 0); sled.add(pivot);

  // ---- 生地の表面（中心 1 点＋ NR×NS の格子。CPU で頂点変形） ----
  const bt = P.batter;
  const NR = K.seg(bt.NR, 12), NS = K.seg(bt.NS, 28), NV = 1 + NR * NS;
  const pos = new Float32Array(NV * 3), nrm = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), col = new Float32Array(NV * 3).fill(1);
  const sgeo = K.own(new THREE.BufferGeometry());
  sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  sgeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
  sgeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
  sgeo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  sgeo.setIndex(polarTriangles(NR, NS));
  sgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.06, 0), 0.22);
  const surface = new THREE.Mesh(sgeo, M.batter); bowl.add(surface);

  const cosT = new Float32Array(NS), sinT = new Float32Array(NS), rb = new Float32Array(NS);
  for (let j = 0; j < NS; j++) { cosT[j] = Math.cos(j / NS * TAU); sinT[j] = Math.sin(j / NS * TAU); rb[j] = b.Rf; }
  const ho = new Float32Array((NR + 1) * NS);      // 泡立て器が残した跡（＋盛り上がり、−くぼみ）
  const lump = new Float32Array((NR + 1) * NS);    // 泡のでこぼこ（決まった乱数をなめらかにした物）
  for (let i = 1; i <= NR; i++) for (let j = 0; j < NS; j++) {
    const rho = i / NR, th = j / NS * TAU, x = rho * Math.cos(th), z = rho * Math.sin(th);
    lump[i * NS + j] = 0.5 * Math.sin(x * 9.1 + 1.3) * Math.cos(z * 7.7 - 0.4) + 0.3 * Math.sin((x + z) * 13.3 + 2.1) + 0.2 * Math.sin(x * 19 - z * 17 + hash(3, 7) * 6);
  }
  const yMax = top - 0.005;
  const ringOff = new Float32Array(NR + 1);        // 輪ごとの回った角度（跡 ho は輪といっしょに回る座標で持つ＝ぼけない）
  const sim = { theta: 0, phase: 0, scroll: 0, peakI: 1, peakJ: 0 };
  // 角：主の 1 本＋まわりの小さな角（[半径方向の輪のずれ, 周方向のずれ, 高さの比]）
  const PEAKS = [[0, 0, 1], [5, 9, 0.5], [-4, -13, 0.42], [7, -6, 0.36], [3, 21, 0.3]];
  const pkX = new Float32Array(PEAKS.length), pkZ = new Float32Array(PEAKS.length);

  function resetSurface() { ho.fill(0); ringOff.fill(0); sim.theta = 0; sim.phase = 0; sim.scroll = 0; }

  // 角を立てる位置（泡立て器の先の真下にいちばん近い格子点）
  function setPeakAt(x, z) {
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    sim.peakJ = ((Math.round(th / TAU * NS) % NS) + NS) % NS;
    sim.peakI = clamp(Math.round(r / Math.max(1e-4, rb[sim.peakJ]) * NR), 1, NR - 2);
  }

  // s: { w, p, sigma, sloshX, sloshZ, speed, stir, whiskX, whiskZ, omega, flow, peakH, curlX, curlZ }
  function updateSurface(dt, s) {
    const w = s.w, hNow = (bt.h0 + bt.h1 * smooth(0, 1, w)) * (1 - s.p);
    surface.visible = hNow > 0.0015;
    if (!surface.visible) return;
    const cL = b.thk + hNow;
    // --- 泡立て器の跡：通った所はくぼみ、まわりは盛り上がる。液体のうちはすぐ消え、泡立つほど残る ---
    if (s.stir > 1e-3) {
      const amp = lerp(0.004, 0.012, w), rate = Math.min(1, 9 * dt * s.stir), rm = rb[0] / NR;
      for (let i = 1; i <= NR; i++) {
        const co = Math.cos(ringOff[i]), so = Math.sin(ringOff[i]), r = i * rm;
        for (let j = 0; j < NS; j++) {
          const dx = r * (cosT[j] * co - sinT[j] * so) - s.whiskX, dz = r * (sinT[j] * co + cosT[j] * so) - s.whiskZ, d2 = dx * dx + dz * dz;
          if (d2 > 0.0034) continue;
          const q = Math.sqrt(d2) / 0.033;
          const f = -Math.exp(-q * q * 1.6) + 0.75 * Math.exp(-(q - 1.3) * (q - 1.3) * 5);
          const k = i * NS + j;
          ho[k] += (f * amp - ho[k]) * rate * (1 - smooth(1.45, 1.76, q));
        }
      }
    }
    // --- うず：輪ごとに角度方向へ流す（内側ほど速い → 跡が渦巻きになる） ---
    const drag = 0.2 * (1 - 0.6 * w);
    if (Math.abs(s.omega) > 1e-4) {
      for (let i = 1; i <= NR; i++) {
        const rho = i / NR, gi = 0.86 + 0.14 * Math.sin(Math.PI * Math.min(1, rho * 1.25)); // ほぼ一体で回る（ずれが大きいと跡が砕ける）
        ringOff[i] = (ringOff[i] + s.omega * drag * gi * dt) % TAU;
      }
      sim.theta += s.omega * drag * 0.5 * dt;
      sim.phase += s.omega * drag * dt;
    }
    const keep = Math.exp(-dt / lerp(0.3, 9, smooth(0.25, 1, w)));
    for (let k = NS; k < ho.length; k++) ho[k] *= keep;
    sim.scroll += s.flow * dt * 0.35;

    // --- 面：ボウルに対して σ だけ傾いた平面（＝世界ではほぼ水平）＋ゆれ。壁との交線を角度ごとに解く ---
    const mx = Math.tan(clamp(s.sigma, 0, 1.15)) + s.sloshX, mz = s.sloshZ;
    for (let j = 0; j < NS; j++) {
      const mj = mx * cosT[j] + mz * sinT[j];
      let lo = 0, hi = b.Rr;
      for (let it = 0; it < 11; it++) {
        const mid = (lo + hi) / 2, yp = Math.min(cL + mj * mid, yMax);
        if (yp - yin(mid) > 0) lo = mid; else hi = mid;
      }
      rb[j] = lo;
    }
    const wa = bt.waveA * (1 - w) * s.speed;                         // うねりの振幅 a(w)
    const vort = 0.016 * s.speed * s.speed * Math.pow(1 - w, 1.5);   // うずのくぼみ
    const lumpA = 0.0042 * smooth(0.3, 0.95, w) * (1 - 0.7 * s.p);
    const dome = 0.004 * smooth(0.6, 1, w) * (1 - s.p);
    const ph = sim.phase, lshift = Math.round(sim.theta / TAU * NS);
    const Rp = bt.peakR, hp = s.peakH, nPk = hp > 1e-5 ? PEAKS.length : 0;
    for (let n = 0; n < nPk; n++) {
      const pi = clamp(sim.peakI + PEAKS[n][0], 2, NR - 3), pj = ((sim.peakJ + PEAKS[n][1]) % NS + NS) % NS, pr = pi / NR * rb[pj];
      pkX[n] = pr * cosT[pj]; pkZ[n] = pr * sinT[pj];
    }
    const cth = Math.cos(sim.theta), sth = Math.sin(sim.theta), us = 1 / bt.uvSize;
    let cSum = 0;
    for (let j = 0; j < NS; j++) {
      const cs = cosT[j], sn = sinT[j], mj = mx * cs + mz * sn, th = j / NS * TAU;
      const jl = ((j - lshift) % NS + NS) % NS;
      for (let i = 1; i <= NR; i++) {
        const rho = i / NR, r = rho * rb[j];
        let x = r * cs, z = r * sn;
        let fa = (th - ringOff[i]) / TAU * NS; fa -= Math.floor(fa / NS) * NS;       // 輪といっしょに回った跡を読む
        const j0 = Math.floor(fa) % NS, j1 = (j0 + 1) % NS, ff = fa - Math.floor(fa);
        const hoV = ho[i * NS + j0] * (1 - ff) + ho[i * NS + j1] * ff;
        const fl = yin(r) + 0.0006;
        let yb = cL + mj * r; if (yb > yMax) yb = yMax;
        const fade = clamp((yb - fl) / 0.006, 0, 1) * (1 - 0.85 * rho * rho * rho * rho);
        const wave = wa * rho * (1.25 - rho) * (0.6 * Math.sin(2 * (th - ph) + 9 * rho) + 0.4 * Math.sin(5 * (th - 1.7 * ph) - 6 * rho));
        const rel = (hoV + lumpA * lump[i * NS + jl] + wave) * fade;       // 細かい起伏（谷は少し暗く＝立体感）
        let y = yb + rel + (dome * (1 - rho * rho) + vort * (rho * rho - 0.45)) * fade;
        if (i === 1) cSum += y;
        let sh = 0.74 + 0.26 * smooth(-0.006, 0.004, rel);
        for (let n = 0; n < nPk; n++) {
          const dx = x - pkX[n], dz = z - pkZ[n], d2 = dx * dx + dz * dz, sc = PEAKS[n][2], R1 = Rp * (0.55 + 0.45 * sc);
          if (d2 > R1 * R1 * 2.9) continue;
          const d = Math.sqrt(d2), hh = hp * sc;
          if (d < R1) { const q = 1 - d / R1, q2 = q * q; y += hh * q2 * (0.3 + 0.7 * q); x += s.curlX * hh * q2 * q2; z += s.curlZ * hh * q2 * q2; sh = Math.min(1.05, sh + 0.3 * q2 * Math.min(1, hh * 60)); }
          else sh -= 0.16 * (1 - (d - R1) / (R1 * 0.7)) * Math.min(1, hh * 60);     // 角の根元の影
        }
        if (y < fl) y = fl;
        const k = polarIndex(i, j, NS);
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
        col[k * 3] = sh; col[k * 3 + 1] = sh * (0.985 + 0.015 * sh); col[k * 3 + 2] = sh * (0.93 + 0.07 * sh);
        uv[k * 2] = (x * cth - z * sth) * us + 0.5 - sim.scroll; uv[k * 2 + 1] = (x * sth + z * cth) * us + 0.5;
      }
    }
    pos[0] = 0; pos[1] = Math.max(b.thk + 0.0006, cSum / NS); pos[2] = 0;
    uv[0] = 0.5 - sim.scroll; uv[1] = 0.5;
    col[0] = 0.93; col[1] = 0.925; col[2] = 0.9;
    polarNormals(pos, nrm, NR, NS);
    sgeo.attributes.position.needsUpdate = true; sgeo.attributes.normal.needsUpdate = true; sgeo.attributes.uv.needsUpdate = true; sgeo.attributes.color.needsUpdate = true;
  }

  // ---- 注ぎ口の先（ワールド座標）。slide=そりの位置 0..1、tiltA=傾き ----
  function lipWorld(out, slide, tiltA, back) {
    const rx = D.lipR - (back || 0) - D.pivR, ry = top - 0.004 - D.pivY, ct = Math.cos(tiltA), st = Math.sin(tiltA);
    const x = D.pivR + rx * ct + ry * st, y = D.pivY - rx * st + ry * ct;
    out.set(P.MIXER[0] + slide * b.travel + x * D.sx, P.MIXER[1] + b.baseY + y, P.MIXER[2] + x * D.sz);
    return out;
  }

  return { sled, yaw, tilt, bowl, hit, pivot, surface, updateSurface, resetSurface, setPeakAt, lipWorld, rinAt, yin, NR, NS };
}

// ---- 流れ（注ぎ口 → ココット）：放物線に沿う管。太さは流量、foam の模様が流れる ----
export function buildStream(ctx, root) {
  const { THREE, K, M } = ctx;
  const NSEG = K.seg(22, 10), NRAD = K.seg(8, 6), NV = (NSEG + 1) * NRAD;
  const pos = new Float32Array(NV * 3), nrm = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), idx = [];
  for (let k = 0; k < NSEG; k++) for (let j = 0; j < NRAD; j++) {
    const j1 = (j + 1) % NRAD, a = k * NRAD + j, b2 = k * NRAD + j1, c2 = (k + 1) * NRAD + j, d2 = (k + 1) * NRAD + j1;
    idx.push(a, b2, c2, b2, d2, c2);
  }
  for (let i = 0; i < NV; i++) nrm[i * 3 + 1] = 1;
  const geo = K.own(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NV * 3).fill(1), 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, M.batter); mesh.frustumCulled = false; mesh.visible = false; root.add(mesh);
  const st = { t0: 0, t1: 0, rf: 0, scroll: 0, landed: false };
  const cosA = new Float32Array(NRAD), sinA = new Float32Array(NRAD);
  for (let j = 0; j < NRAD; j++) { cosA[j] = Math.cos(j / NRAD * TAU); sinA[j] = Math.sin(j / NRAD * TAU); }

  // lip・land は THREE.Vector3（ワールド）。flow 0..1、tiltA は注ぎ口の傾き。戻り値：流れがココットに届いているか
  function update(dt, time, flow, lip, land, tiltA) {
    if (flow > 0.02) { st.t1 = Math.min(1, st.t1 + dt * 3.0); st.t0 = 0; st.rf += (flow - st.rf) * Math.min(1, dt * 8); }
    else if (st.t1 > 0) { st.t0 += dt * 3.4; if (st.t0 >= st.t1) { st.t0 = st.t1 = 0; st.rf = 0; } }
    st.landed = st.t1 >= 0.999 && st.t0 <= 0.001;
    mesh.visible = st.t1 - st.t0 > 0.02;
    if (!mesh.visible) return st.landed;
    st.scroll += dt * (0.9 + 0.8 * flow);
    let hx = land.x - lip.x, hz = land.z - lip.z;
    const Dh = Math.hypot(hx, hz);
    if (!(Dh > 1e-5)) { mesh.visible = false; return st.landed; }
    hx /= Dh; hz /= Dh;
    const drop = Math.max(0.01, lip.y - land.y);
    const a = clamp(Math.tan(Math.max(0, tiltA - 0.2)) * Dh / drop, 0.08, 0.8) * 0.6; // 出だしの下向きの傾き
    const R0 = 0.013 * Math.sqrt(Math.max(0.05, st.rf));
    for (let k = 0; k <= NSEG; k++) {
      const t = st.t0 + (st.t1 - st.t0) * k / NSEG;
      const s = -0.2 + 1.2 * t, sc = Math.max(0, s);
      let cx, cy, cz, tx, ty, tz;
      if (s < 0) { // 注ぎ口の中（出だしの向きにまっすぐ）
        cx = lip.x + hx * Dh * s; cz = lip.z + hz * Dh * s; cy = lip.y - drop * a * s;
        tx = hx * Dh; tz = hz * Dh; ty = -drop * a;
      } else {
        cx = lip.x + hx * Dh * s; cz = lip.z + hz * Dh * s; cy = lip.y - drop * (a * s + (1 - a) * s * s);
        tx = hx * Dh; tz = hz * Dh; ty = -drop * (a + 2 * (1 - a) * s);
      }
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const bx = -hz, bz = hx;                                   // 横（水平）
      const nx = -bz * ty, ny = bz * tx - bx * tz, nz = bx * ty; // N = B × T
      const sway = Math.sin(time * 6.5 + sc * 8) * 0.0018 * sc;
      cx += bx * sway; cz += bz * sway;
      let r = R0 * (0.6 + 0.4 / (1 + 2.5 * sc));
      const e = 1 - Math.min(1, sc * 3.3), e3 = e * e * e;
      const wB = 1 + 1.3 * e3, wN = 1 - 0.5 * e3;                // 注ぎ口では平たいリボン
      if (k === 0 && st.t0 > 0.001) r *= 0.35;
      if (k === NSEG && st.t1 < 0.999) r *= 0.45;
      if (k === NSEG - 1 && st.t1 < 0.999) r *= 1.15;
      for (let j = 0; j < NRAD; j++) {
        const i = (k * NRAD + j) * 3, ca = cosA[j], sa = sinA[j];
        pos[i] = cx + (nx * ca * wN + bx * sa * wB) * r; pos[i + 1] = cy + (ny * ca * wN) * r; pos[i + 2] = cz + (nz * ca * wN + bz * sa * wB) * r;
        nrm[i] = nx * ca + bx * sa; nrm[i + 1] = ny * ca; nrm[i + 2] = nz * ca + bz * sa;
        const q = (k * NRAD + j) * 2;
        uv[q] = Math.abs(2 * j / NRAD - 1) * 0.25; uv[q + 1] = t * 0.5 - st.scroll;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.uv.needsUpdate = true;
    return st.landed;
  }
  function reset() { st.t0 = st.t1 = 0; st.rf = 0; st.landed = false; mesh.visible = false; }
  return { mesh, update, reset, state: st };
}
