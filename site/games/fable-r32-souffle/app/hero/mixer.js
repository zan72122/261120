// 手回しの遊星ミキサー。歯車の列はすべて見える場所に置く：
//   クランク（Z 軸）＋冠歯車 Z1 → ピニオン Z2（横軸・X 軸）→ かさ歯車 1:1 → 縦軸＝遊星キャリア
//   → 固定内歯車 Zr の中を転がる遊星歯車 Zp → 泡立て器（公転しながら逆向きに自転）
// 寸法は params.js。座標はミキサーのローカル（原点＝ボウルの底の中心の真下、台の下面）。
import { TAU } from './util.js';

export function buildMixer(ctx) {
  const { THREE, K, M, P, D } = ctx;
  const mx = P.mixer, g = P.gear, c = P.col, wk = P.whisk, ck = P.crank;
  const EN = [c.enamel, 0, 0.3], END = [c.enamelDark, 0, 0.34], CR = [c.cream, 0, 0.36], BR = [c.brass, 1, 0.3], ST = [c.steel, 1, 0.2];
  const pt = (geo, m) => K.paint(geo, m[0], m[1], m[2]);
  const HX = Math.PI / 2;

  const group = new THREE.Group(); group.name = 'mixer'; group.position.fromArray(P.MIXER);

  // ---------- 静止部：台・柱・そりのレール ----------
  const st = [];
  {
    const b = mx.base;
    const geo = K.extrude(K.rrPath(THREE.Shape, b.x0, -b.z1, b.x1, -b.z0, b.r), b.h, 0.004, K.seg(8, 3));
    geo.rotateX(-HX); st.push(pt(geo, EN));
    const s = new THREE.Shape();
    s.moveTo(-0.118, 0.014); s.quadraticCurveTo(-0.152, 0.05, -0.160, 0.15); s.lineTo(-0.164, 0.262); s.lineTo(-0.216, 0.262);
    s.quadraticCurveTo(-0.222, 0.12, -0.252, 0.014); s.closePath();
    const col = K.extrude(s, mx.columnW, 0.007, K.seg(8, 3)); col.rotateY(-HX); col.translate(mx.columnW / 2, 0, 0);
    st.push(pt(col, EN));
    for (const sx of [-1, 1]) { // 蝶番の耳
      st.push(pt(K.at(K.cyl(0.026, 0.026, 0.012, K.seg(20, 8), 'x'), sx * (mx.columnW / 2 - 0.006), mx.hingeY, mx.hingeZ), END));
      st.push(pt(K.at(K.cyl(0.006, 0.006, 0.004, 10, 'x'), sx * (mx.columnW / 2 + 0.002), mx.hingeY, mx.hingeZ), BR));
    }
    for (const sz of [-1, 1]) { // そりのレール
      st.push(pt(K.at(K.cyl(0.003, 0.003, 0.27, 8, 'x'), 0.06, b.h + 0.0035, sz * 0.04), ST));
      for (const ex of [-0.078, 0.198]) st.push(pt(K.at(K.rbox(0.008, 0.01, 0.014, 0.002, 1), ex, b.h + 0.004, sz * 0.04), BR));
    }
  }
  const staticMesh = new THREE.Mesh(K.merge(st), M.hard()); group.add(staticMesh);

  // ---------- 頭（チルトヘッド）。蝶番は後ろの柱の上、X 軸 ----------
  const head = new THREE.Group(); head.position.set(0, mx.hingeY, mx.hingeZ); group.add(head);
  const body = new THREE.Group(); body.position.set(0, -mx.hingeY, -mx.hingeZ); head.add(body); // この中はミキサーのローカル座標で組む
  const hd = [];
  {
    const s = new THREE.Shape();
    s.moveTo(-0.207, 0.262); s.quadraticCurveTo(-0.204, 0.318, -0.13, 0.334); s.lineTo(-0.05, 0.346);
    s.quadraticCurveTo(-0.03, 0.348, -0.03, 0.328); s.lineTo(-0.03, 0.27); s.quadraticCurveTo(-0.03, 0.258, -0.046, 0.258);
    s.quadraticCurveTo(-0.12, 0.264, -0.176, 0.25); s.closePath();
    const arm = K.extrude(s, 0.044, 0.007, K.seg(8, 3)); arm.rotateY(-HX); arm.translate(0.022, 0, 0);
    hd.push(pt(arm, EN));
    hd.push(pt(K.at(K.cyl(0.0265, 0.0265, mx.columnW - 0.026, K.seg(20, 8), 'x'), 0, mx.hingeY, mx.hingeZ), EN));
    // 背板（歯車の軸受けを支える板）
    hd.push(pt(K.at(K.rbox(0.29, 0.094, 0.012, 0.005, 2), 0.078, mx.shaftY, -0.036), EN));
    // 軸受け：横軸 ×2、縦軸 ×1、クランク軸
    for (const x of [0.048, 0.098]) hd.push(pt(K.at(K.rbox(0.012, 0.026, 0.04, 0.003, 1), x, mx.shaftY, -0.012), CR));
    hd.push(pt(K.at(K.rbox(0.026, 0.012, 0.04, 0.003, 1), 0, mx.shaftY - 0.042, -0.012), CR));
    hd.push(pt(K.at(K.cyl(0.013, 0.013, (D.zf - 0.0065) + 0.03, K.seg(14, 8), 'z'), mx.crankX, mx.shaftY, (-0.03 + D.zf - 0.0065) / 2), CR));
    // 内歯車を吊る腕
    hd.push(pt(K.at(K.rbox(0.03, 0.062, 0.02, 0.004, 1), 0, mx.ringY + 0.031, -(D.rr + 1.25 * D.mp + 0.006) - 0.006), EN));
    hd.push(pt(K.at(K.rbox(0.03, 0.016, 0.046, 0.004, 1), 0, mx.shaftY - 0.044, -0.05), EN));
    // 固定内歯車 Zr（歯のすき間が +X に来る位相。遊星の歯 0 と噛み合う）
    const ring = K.prism(K.gearOutline(g.Zr, D.mp, true, TAU / g.Zr / 2), 0, mx.ringT, 1, 1, D.rr + 1.25 * D.mp + 0.006);
    ring.rotateX(-HX); ring.translate(0, mx.ringY, 0);
    hd.push(pt(ring, BR));
  }
  const headMesh = new THREE.Mesh(K.merge(hd), M.hard()); body.add(headMesh);

  // ---------- クランク＋冠歯車（Z 軸、子どもの方を向く） ----------
  const crank = new THREE.Group(); crank.position.set(mx.crankX, mx.shaftY, 0); body.add(crank);
  const crankSpin = new THREE.Group(); crank.add(crankSpin);
  const zf = D.zf, zb = zf - 0.006, zh = zf + 0.031, Rw = D.r1 + g.faceW / 2 + 0.0025;
  const cr = [];
  {
    const prof = [[0, zb], [Rw - 0.001, zb], [Rw, zb + 0.001], [Rw, zf - 0.0005], [Rw - 0.0012, zf], [D.r1 - g.faceW / 2 - 0.002, zf],
      [D.r1 - g.faceW / 2 - 0.004, zf - 0.002], [0.018, zf - 0.002], [0.0135, zf + 0.003], [0.011, zf + 0.005], [0.011, zh], [0, zh]];
    const wheel = K.lathe(prof, K.seg(40, 16)); wheel.rotateX(HX);
    cr.push(pt(wheel, BR));
    cr.push(pt(K.crownTeeth(g.Z1, g.m, D.r1, g.faceW, zf, 0), BR));
    const s = new THREE.Shape();
    s.moveTo(0, -0.012); s.lineTo(ck.Lc, -0.0085); s.absarc(ck.Lc, 0, 0.0085, -HX, HX, false); s.lineTo(0, 0.012); s.absarc(0, 0, 0.012, HX, 3 * HX, false);
    cr.push(pt(K.at(K.extrude(s, 0.006, 0.0015, K.seg(8, 3), 1), 0, 0, zh), ST));
    cr.push(pt(K.at(K.cyl(0.0035, 0.0035, ck.gripL + 0.006, 8, 'z'), ck.Lc, 0, zh + 0.006 + (ck.gripL + 0.006) / 2), ST));
    cr.push(pt(K.at(K.cyl(0.008, 0.007, 0.003, 12, 'z'), ck.Lc, 0, zh + 0.0135 + ck.gripL), BR));
    cr.push(pt(K.at(K.cyl(0.006, 0.005, 0.004, 12, 'z'), 0, 0, zh + 0.008), BR));
  }
  const crankMat = M.hard();
  crankSpin.add(new THREE.Mesh(K.merge(cr), crankMat));
  // 木の握り
  const gripMat = M.wood();
  {
    const L = ck.gripL, r = ck.gripR, prof = [[0, 0], [r * 0.7, 0], [r * 0.88, 0.003]];
    const n = K.seg(6, 3);
    for (let i = 1; i < n; i++) { const t = i / n; prof.push([r * (0.88 + 0.12 * Math.sin(Math.PI * t)), 0.003 + (L - 0.006) * t]); }
    prof.push([r * 0.88, L - 0.003], [r * 0.7, L], [0, L]);
    const grip = K.textured(K.lathe(prof, K.seg(16, 8), { swapUV: true, uRep: 0.5, vLen: 0.16 }));
    grip.rotateX(HX); grip.translate(ck.Lc, 0, zh + 0.0075);
    crankSpin.add(new THREE.Mesh(K.own(grip), gripMat));
  }

  // ---------- 横軸（X 軸）：ピニオン Z2 と、かさ歯車 ----------
  const hshaft = new THREE.Group(); hshaft.position.set(0, mx.shaftY, 0); body.add(hshaft);
  const hB = 0.006, sB = (D.rb - hB) / D.rb;
  {
    const hs = [];
    const bev = K.prism(K.gearOutline(g.Zb, g.mb, false, 0), 0, hB, 1, sB);
    K.orient(bev, [0, -1, 0], [-1, 0, 0]); bev.translate(D.rb, 0, 0);
    hs.push(pt(bev, BR));
    hs.push(pt(K.at(K.cyl(0.009, 0.009, 0.005, 12, 'x'), D.rb + 0.0025, 0, 0), BR));
    const x1 = mx.crankX - D.r1 + 0.009;
    hs.push(pt(K.at(K.cyl(0.0035, 0.0035, x1 - D.rb, 8, 'x'), (x1 + D.rb) / 2, 0, 0), ST));
    const pin = K.prism(K.gearOutline(g.Z2, g.m, false, TAU / g.Z2 / 2), -0.006, 0.006);
    K.orient(pin, [0, 0, -1], [1, 0, 0]); pin.translate(mx.crankX - D.r1, 0, 0);
    hs.push(pt(pin, BR));
    for (const x of [0.037, 0.109]) hs.push(pt(K.at(K.cyl(0.006, 0.006, 0.004, 10, 'x'), x, 0, 0), ST));
    hshaft.add(new THREE.Mesh(K.merge(hs), M.hard()));
  }

  // ---------- 縦軸＝遊星キャリア（Y 軸） ----------
  const vshaft = new THREE.Group(); body.add(vshaft);
  const carrierY = mx.ringY + mx.ringT + 0.0055;
  {
    const vs = [];
    const bev = K.prism(K.gearOutline(g.Zb, g.mb, false, TAU / g.Zb / 2), 0, hB, 1, sB);
    bev.rotateX(-HX); bev.translate(0, mx.shaftY - D.rb, 0);
    vs.push(pt(bev, BR));
    vs.push(pt(K.at(K.cyl(0.009, 0.009, 0.005, 12, 'y'), 0, mx.shaftY - D.rb - 0.0025, 0), BR));
    const y0 = carrierY, y1 = mx.shaftY - D.rb;
    vs.push(pt(K.at(K.cyl(0.0038, 0.0038, y1 - y0, 8, 'y'), 0, (y0 + y1) / 2, 0), ST));
    vs.push(pt(K.at(K.cyl(0.010, 0.010, 0.010, 14, 'y'), 0, carrierY, 0), BR));
    vs.push(pt(K.at(K.rbox(g.Rc + 0.03, 0.006, 0.013, 0.002, 1), (g.Rc + 0.012 - 0.018) / 2, carrierY, 0), BR));
    vs.push(pt(K.at(K.cyl(0.009, 0.009, 0.009, 12, 'y'), -0.02, carrierY, 0), BR));
    vs.push(pt(K.at(K.cyl(0.0045, 0.0045, 0.004, 10, 'y'), g.Rc, carrierY + 0.005, 0), ST));
    vshaft.add(new THREE.Mesh(K.merge(vs), M.hard()));
  }

  // ---------- 遊星歯車＋泡立て器（キャリアの腕の先、Y 軸で自転） ----------
  const pivotY = mx.ringY + mx.ringT / 2;
  const planetPos = new THREE.Group(); planetPos.position.set(g.Rc, pivotY, 0); vshaft.add(planetPos);
  const flex = new THREE.Group(); planetPos.add(flex);          // 泡立て器のしなり（止めたときに先が揺れる）
  const spin = new THREE.Group(); flex.add(spin);
  const yTop = wk.tipY + wk.hw;
  {
    const pl = [];
    const gear = K.prism(K.gearOutline(g.Zp, D.mp, false, 0), 0, mx.ringT - 0.002);
    gear.rotateX(-HX); gear.translate(0, mx.ringY + 0.001, 0);
    pl.push(pt(gear, BR));
    pl.push(pt(K.at(K.cyl(0.003, 0.003, 0.012, 8, 'y'), 0, mx.ringY + mx.ringT + 0.004, 0), ST));
    pl.push(pt(K.at(K.cyl(0.0035, 0.0035, mx.ringY - yTop + 0.002, 8, 'y'), 0, (mx.ringY + yTop) / 2, 0), ST));
    pl.push(pt(K.at(K.cyl(wk.collarR, 0.005, 0.014, 12, 'y'), 0, yTop - 0.004, 0), ST));
    // ワイヤー：1 本の曲線を回転コピー
    const n = K.seg(18, 8), pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = wk.tipY + wk.hw * (1 - (0.5 * t + 0.5 * Math.sin(HX * t)));
      const r = wk.collarR * 0.8 * (1 - t) * (1 - t) + wk.rw * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.35))), 0.9);
      pts.push([r, y, 0]);
    }
    for (let k = 0; k < wk.Nw; k++) {
      const w = K.tube(pts, wk.wire, K.seg(5, 4), false); w.rotateY(k * TAU / wk.Nw);
      pl.push(pt(w, ST));
    }
    const geo = K.merge(pl); geo.translate(0, -pivotY, 0);
    spin.add(new THREE.Mesh(geo, M.hard()));
  }
  // 泡立て器にからんだ泡（泡立つにつれて大きくなる。持ち上げると見える）
  const bellyY = wk.tipY + 0.034;
  const clump = new THREE.Group(); clump.position.set(0, bellyY - pivotY, 0); spin.add(clump);
  {
    const n = K.seg(10, 5), prof = [[0, wk.tipY - 0.012], [0.004, wk.tipY - 0.004]];
    for (let i = 1; i < n; i++) { const s = i / n; prof.push([0.024 * Math.pow(Math.sin(Math.PI * s), 0.7) * (1 - 0.3 * s), wk.tipY + 0.002 + s * 0.064]); }
    prof.push([0, wk.tipY + 0.066]);
    const geo = K.textured(K.lathe(prof, K.seg(14, 8), { uRep: 0.5, vLen: 0.3 })); geo.translate(0, -bellyY, 0);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(0.94), 3));
    clump.add(new THREE.Mesh(K.own(geo), M.batter));
  }
  clump.visible = false;

  // ---------- 当たり判定（見えない大きめの円柱） ----------
  const crankHit = new THREE.Mesh(K.own(K.cyl(ck.hitR, ck.hitR, 0.12, 14, 'z')), M.hit);
  crankHit.visible = false; crankHit.position.set(0, 0, 0.03); crank.add(crankHit);

  return {
    group, head, body, crank, crankSpin, hshaft, vshaft, planetPos, flex, spin, clump, crankHit,
    glow: [crankMat, gripMat],
    pivotY, whiskTipLocalY: wk.tipY - pivotY,
  };
}
