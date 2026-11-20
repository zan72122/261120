// オーブン：角丸の箱（前から見た形に庫内の穴をあけて奥へ押し出す）、下の蝶番で手前へ開く扉、つまみ。
// 扉の内側にはレールがあり、開くとカウンターのレールと庫内のレールをつなぐ「跳ね橋」になる。
// 窓は中が見えるガラス（うすい色つきの板）。庫内の壁・ヒーター・ランプは、熱で光る（emissive の強さを頂点で持つ）。
import { TAU } from './util.js';

const HX = Math.PI / 2;

export function buildOven(ctx, root, path) {
  const { THREE, K, M, P, D } = ctx;
  const o = P.oven, d = o.door, kb = o.knob, c = P.col, ct = P.cart;
  const group = new THREE.Group(); group.name = 'oven'; group.position.fromArray(P.OVEN); root.add(group);
  const cavW = o.cav.x1 - o.cav.x0, cavH = o.cav.y1 - o.cav.y0, front = o.D / 2;

  // ---------- 本体（静止、1 メッシュ） ----------
  const body = [];
  {
    const shape = K.rrPath(THREE.Shape, -o.W / 2, o.foot, o.W / 2, o.H, o.r);
    shape.holes.push(K.rrPath(THREE.Path, o.cav.x0, o.cav.y0, o.cav.x1, o.cav.y1, 0.01));
    const shell = K.extrude(shape, o.D, 0.008, K.seg(8, 3)); shell.translate(0, 0, -o.D / 2);
    K.paint(shell, c.oven, 0, 0.3, 0);
    // 庫内の面は暗い色にして、熱で光るようにする
    const pos = shell.attributes.position, col = shell.attributes.color, mre = shell.attributes.aMRE, k = new THREE.Color(c.ovenIn);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (x > o.cav.x0 - 0.002 && x < o.cav.x1 + 0.002 && y > o.cav.y0 - 0.002 && y < o.cav.y1 + 0.002 && Math.abs(z) < front - 0.004) {
        col.setXYZ(i, k.r, k.g, k.b); mre.setXYZ(i, 0, 0.8, 0.3);
      }
    }
    body.push(shell);
    body.push(K.paint(K.at(K.box(cavW + 0.01, cavH + 0.01, 0.004), D.cavX, (o.cav.y0 + o.cav.y1) / 2, o.cav.zBack), c.ovenIn, 0, 0.8, 0.3));
    // ヒーター：上下に U 字の管
    for (const y of [o.cav.y1 - 0.014, o.cav.y0 + 0.006]) {
      const pts = [], hw = 0.09, zc = 0.05, n = K.seg(10, 5);
      pts.push([D.cavX - hw, y, o.cav.zBack + 0.004], [D.cavX - hw, y, zc]);
      for (let i = 1; i < n; i++) { const a = Math.PI * i / n; pts.push([D.cavX - hw * Math.cos(a), y, zc + hw * Math.sin(a)]); }
      pts.push([D.cavX + hw, y, zc], [D.cavX + hw, y, o.cav.zBack + 0.004]);
      body.push(K.paint(K.tube(pts, 0.0032, 6, false), 0x6a4034, 0.2, 0.6, 3.2));
    }
    // 網：細い棒（9 本）と、台車が載るレール
    for (let i = 0; i < o.rods; i++) {
      body.push(K.paint(K.at(K.cyl(0.0014, 0.0014, cavW - 0.004, 5, 'x'), D.cavX, o.railTop - 2 * ct.railR - 0.0014, -0.13 + i * (0.26 / (o.rods - 1))), c.steel, 1, 0.3, 0));
    }
    for (const sx of [-1, 1]) body.push(K.paint(K.at(K.cyl(ct.railR, ct.railR, 0.283, 5, 'z'), D.cavX + sx * ct.gauge / 2, o.railTop - ct.railR, 0.0165), c.steel, 1, 0.22, 0));
    // 脚・前面の飾り・操作パネル
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.push(K.paint(K.at(K.cyl(0.013, 0.016, o.foot + 0.002, 10, 'y'), sx * (o.W / 2 - 0.04), o.foot / 2, sz * (o.D / 2 - 0.04)), c.iron, 0.4, 0.5, 0));
    body.push(K.paint(K.at(K.rbox(0.082, 0.21, 0.005, 0.0024, 1), kb.x, 0.156, front + 0.0012), c.cream, 0, 0.36, 0));
    body.push(K.paint(K.at(K.rbox(o.W - 0.07, 0.007, 0.006, 0.0028, 1), 0, o.H - 0.0145, front + 0.0005), c.steel, 1, 0.2, 0));
    // 目盛り（文字なし、点がだんだん大きくなる）
    for (let i = 0; i < 7; i++) {
      const a = (225 - i * 45) * Math.PI / 180, r = 0.0022 + i * 0.00045;
      body.push(K.paint(K.at(K.cyl(r, r, 0.003, 8, 'z'), kb.x + Math.cos(a) * (kb.r + 0.0095), kb.y + Math.sin(a) * (kb.r + 0.0095), front + 0.004), c.red, 0, 0.4, 0));
    }
    // ランプ（熱で光る）
    body.push(K.paint(K.at(K.sphere(0.0085, 10, 8), kb.x, 0.236, front + 0.003), 0x8a3a2a, 0, 0.25, 5));
    body.push(K.paint(K.at(K.cyl(0.0115, 0.0115, 0.003, 12, 'z'), kb.x, 0.236, front + 0.004), c.steel, 1, 0.2, 0));
  }
  const bodyMat = M.hard(); bodyMat.emissive.set(c.heat); bodyMat.emissiveIntensity = 0;
  group.add(new THREE.Mesh(K.merge(body), bodyMat));

  // ---------- 扉（下の蝶番。rotation.x = 0 で閉、+open で手前へ開く） ----------
  const door = new THREE.Group(); door.position.set(D.cavX, D.hingeY, D.hingeZ); group.add(door);
  const doorWiggle = new THREE.Group(); door.add(doorWiggle);
  const doorMat = M.hard(), handleMat = M.wood();
  {
    const g = [];
    const shape = K.rrPath(THREE.Shape, -d.w / 2, 0, d.w / 2, d.h, 0.016);
    shape.holes.push(K.rrPath(THREE.Path, -d.winHW, d.winU0, d.winHW, d.winU1, 0.012));
    const frame = K.extrude(shape, d.t, 0.004, K.seg(6, 3)); frame.translate(0, 0, -d.t / 2);
    g.push(K.paint(frame, c.cream, 0, 0.34));
    for (const sx of [-1, 1]) g.push(K.paint(K.at(K.cyl(0.0045, 0.0045, 0.028, 8, 'z'), sx * 0.085, d.h - 0.02, d.t / 2 + 0.013), c.steel, 1, 0.2));
    g.push(K.paint(K.at(K.cyl(0.006, 0.006, d.w - 0.03, 8, 'x'), 0, 0, 0), c.steel, 1, 0.25)); // 蝶番の軸
    // 内側のレール（開いたとき、カウンター → 庫内へつながる）
    const half = ct.gauge / 2, L = [], R2 = [], dl = path.doorLocal, zr = -(d.t / 2 + ct.railR);
    for (let i = 0; i < dl.length; i++) {
      const a = dl[Math.max(0, i - 1)], b = dl[Math.min(dl.length - 1, i + 1)];
      let tx = b[0] - a[0], tu = b[1] - a[1]; const l = Math.hypot(tx, tu) || 1; tx /= l; tu /= l;
      L.push([dl[i][0] - tu * half, dl[i][1] + tx * half, zr]); R2.push([dl[i][0] + tu * half, dl[i][1] - tx * half, zr]);
    }
    // 枠の上は鉄のレール、窓の上はガラスのレール（閉じたとき、窓ごしにスフレの前を横切って見えないように）
    const glassParts = [];
    const inWin = (p) => Math.abs(p[0]) < d.winHW + 0.003 && p[1] > d.winU0 - 0.003 && p[1] < d.winU1 + 0.003;
    for (const line of [L, R2]) {
      const fine = [];
      for (let i = 0; i < line.length - 1; i++) for (let k = 0; k < 5; k++) { const f = k / 5, a = line[i], b = line[i + 1]; fine.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, zr]); }
      fine.push(line[line.length - 1]);
      let run = [fine[0]], cur = inWin(fine[0]);
      const flush = () => { if (run.length > 1) { if (cur) glassParts.push(K.textured(K.tube(run, ct.railR, 5, true))); else g.push(K.paint(K.tube(run, ct.railR, 5, true), c.iron, 0.5, 0.45)); } };
      for (let i = 1; i < fine.length; i++) {
        const w = inWin(fine[i]);
        run.push(fine[i]);
        if (w !== cur) { flush(); run = [fine[i]]; cur = w; }
      }
      flush();
    }
    doorWiggle.add(new THREE.Mesh(K.merge(g), doorMat));
    // 木の取っ手
    const bar = K.textured(K.lathe([[0, -0.11], [0.006, -0.11], [0.0085, -0.104], [0.0085, 0.104], [0.006, 0.11], [0, 0.11]], K.seg(12, 8), { swapUV: true, uRep: 0.4, vLen: 0.3 }));
    bar.rotateZ(-HX); bar.translate(0, d.h - 0.02, d.t / 2 + 0.027);
    doorWiggle.add(new THREE.Mesh(K.own(bar), handleMat));
    // 窓ガラス
    glassParts.push(K.textured(K.at(K.box(2 * d.winHW + 0.008, d.winU1 - d.winU0 + 0.008, 0.003), 0, (d.winU0 + d.winU1) / 2, 0)));
    const glass = new THREE.Mesh(K.merge(glassParts), M.glass);
    glass.renderOrder = 3; doorWiggle.add(glass);
  }
  const doorHit = new THREE.Mesh(K.own(K.box(d.w + 0.06, d.h + 0.06, 0.13)), M.hit); doorHit.visible = false; doorHit.position.set(0, d.h / 2, 0.02); door.add(doorHit);
  const doorPivot = new THREE.Object3D(); doorPivot.position.set(0, d.h * 0.55, 0); door.add(doorPivot);

  // ---------- つまみ（Z 軸。握りの溝 12 本、赤い指針） ----------
  const knob = new THREE.Group(); knob.position.set(kb.x, kb.y, front + 0.004); group.add(knob);
  const knobWiggle = new THREE.Group(); knob.add(knobWiggle);
  const knobSpin = new THREE.Group(); knobWiggle.add(knobSpin);
  const knobMat = M.hard();
  {
    const g = [], r = kb.r, t = kb.t;
    const prof = [[0, 0, 0], [r + 0.005, 0, 0], [r + 0.005, 0.003, 0], [r + 0.001, 0.005, 0], [r, 0.007, 1], [r * 0.95, t, 1], [r * 0.86, t + 0.003, 0], [0, t + 0.003, 0]];
    const fn = (p, th, out) => { if (p[2]) out.r *= 1 - 0.1 * (1 - Math.abs(Math.cos(kb.grooves * th / 2))); };
    const geo = K.lathe(prof, K.seg(kb.grooves * 6, kb.grooves * 3), { fn }); geo.rotateX(HX);
    g.push(K.paint(geo, c.cream, 0, 0.3));
    g.push(K.paint(K.at(K.rbox(0.0065, r * 0.72, 0.004, 0.0018, 1), 0, r * 0.5, t + 0.0035), c.red, 0, 0.35));
    g.push(K.paint(K.at(K.cyl(0.006, 0.005, 0.004, 10, 'z'), 0, 0, t + 0.004), c.brass, 1, 0.3));
    knobSpin.add(new THREE.Mesh(K.merge(g), knobMat));
  }
  const knobHit = new THREE.Mesh(K.own(K.cyl(kb.hitR, kb.hitR, 0.09, 14, 'z')), M.hit); knobHit.visible = false; knobHit.position.set(0, 0, 0.02); knob.add(knobHit);

  void TAU;
  return { group, bodyMat, door, doorWiggle, doorMat, handleMat, doorHit, doorPivot, knob, knobWiggle, knobSpin, knobMat, knobHit };
}
