// 周辺の場面：空・地面・丘・木・塔（奥半分の円筒）・旗・光。すべて低ポリ。
// 座標：メートル、+Y 上、原点は塔の床の中心。塔の壁は z ≤ 0 側だけ（HERO-SPEC §1）。
import THREE from './three.js';
import { grid, merge, tint, scaleUV, rng } from './geo.js';

export const TOWER = { inner: 4.2, outer: 4.6, height: 7.6 };
const TILE = 2.0; // 石テクスチャ1枚 = 2m 角

export function createWorld({ scene, textures, tier, shared }) {
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  // ---- 光 ----
  const hemi = new THREE.HemisphereLight(0xdde8ff, 0x7f9a62, 1.7);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
  sun.position.set(6, 11, 9);
  root.add(hemi, sun);

  scene.background = new THREE.Color(0xf2d2c4);
  scene.fog = new THREE.Fog(0xeccfc2, 45, 280);

  // ---- 空：半球の内側に夕方の空（横は鏡映繰り返しで継ぎ目なし） ----
  const skyTex = textures.loadFile('sky_dusk_512.jpg').clone();
  keep(skyTex);
  skyTex.wrapS = THREE.MirroredRepeatWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;
  skyTex.repeat.set(4, 1);
  const skyGeo = keep(new THREE.SphereGeometry(320, 24, 9, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const skyMat = keep(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  sky.name = 'sky';
  root.add(sky);

  // ---- 地面：芝の円盤 ----
  const grassTex = keep(textures.loadFile('lawn_grass_512.jpg').clone());
  grassTex.repeat.set(110, 110);
  const groundGeo = keep(new THREE.CircleGeometry(230, 40));
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(groundGeo, keep(new THREE.MeshLambertMaterial({ map: grassTex, color: 0xd8e8c0 })));
  ground.position.y = -0.02;
  ground.name = 'ground';
  root.add(ground);

  // ---- 丘：2重のリング（頂点カラーのみ、テクスチャなし） ----
  const r = rng(7);
  function hillRing(r0, r1, r2, hMin, hMax, phase, cLow, cTop) {
    const seg = 64;
    const hs = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = 0.5 + 0.28 * Math.sin(a * 3 + phase) + 0.16 * Math.sin(a * 7 + phase * 2.1) + 0.06 * Math.sin(a * 13 + phase * 0.7);
      hs.push(hMin + (hMax - hMin) * Math.max(0, Math.min(1, n)));
    }
    hs[seg] = hs[0];
    return grid(seg, 2, (u, v) => {
      const i = Math.round(u * seg), a = u * Math.PI * 2;
      const rad = v === 0 ? r0 : v < 1 ? r1 : r2;
      const y = v === 0 ? -1 : v < 1 ? hs[i] : hs[i] * 0.5;
      const sx = Math.sin(a), cz = Math.cos(a);
      const k = v === 0 ? 0 : 1;
      const c = [cLow[0] + (cTop[0] - cLow[0]) * k, cLow[1] + (cTop[1] - cLow[1]) * k, cLow[2] + (cTop[2] - cLow[2]) * k];
      return { p: [sx * rad, y, cz * rad], n: [-sx * 0.5, 0.85, -cz * 0.5], uv: [u, v], c };
    });
  }
  const hillsGeo = keep(merge([
    hillRing(85, 105, 125, 5, 17, 1.3, [0.36, 0.55, 0.30], [0.55, 0.72, 0.42]),
    hillRing(150, 175, 205, 14, 42, 4.1, [0.45, 0.55, 0.62], [0.62, 0.66, 0.78]),
  ]));
  const hills = new THREE.Mesh(hillsGeo, keep(new THREE.MeshLambertMaterial({ vertexColors: true })));
  hills.name = 'hills';
  root.add(hills);

  // ---- 木：Instanced（円錐の木・丸い木・幹）。low では作らない ----
  const trees = new THREE.Group();
  trees.name = 'trees';
  root.add(trees);
  function buildTrees() {
    const coneGeo = keep(new THREE.ConeGeometry(1, 1, 7, 1));
    coneGeo.translate(0, 0.5, 0);
    const ballGeo = keep(new THREE.IcosahedronGeometry(1, 1));
    const trunkGeo = keep(new THREE.CylinderGeometry(0.12, 0.17, 1, 5, 1, true));
    trunkGeo.translate(0, 0.5, 0);
    const N = 72;
    const leafMat = keep(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const cones = new THREE.InstancedMesh(coneGeo, leafMat, N);
    const balls = new THREE.InstancedMesh(ballGeo, leafMat, N);
    const trunks = new THREE.InstancedMesh(trunkGeo, keep(new THREE.MeshLambertMaterial({ color: 0x8a6448 })), N * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const greens = [0x5f9a4a, 0x77ad55, 0x4f8a48, 0x8cbc5e, 0x6aa66a];
    let nc = 0, nb = 0, nt = 0;
    for (let k = 0; k < N * 2 && (nc < N || nb < N); k++) {
      const a = r() * Math.PI * 2, rad = 20 + r() * 52;
      const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
      if (z > -2 && Math.abs(x) < 16) continue; // カメラの前と手前の芝は空ける
      const h = 3 + r() * 4, w = 1.2 + r() * 1.3;
      const col = new THREE.Color(greens[Math.floor(r() * greens.length)]);
      const trunkH = h * 0.35;
      if (r() < 0.55 && nc < N) {
        p.set(x, trunkH * 0.6, z); s.set(w, h, w); m.compose(p, q.identity(), s);
        cones.setMatrixAt(nc, m); cones.setColorAt(nc, col); nc++;
      } else if (nb < N) {
        p.set(x, trunkH + w * 0.9, z); s.set(w, w * 1.05, w); m.compose(p, q.identity(), s);
        balls.setMatrixAt(nb, m); balls.setColorAt(nb, col); nb++;
      } else continue;
      p.set(x, 0, z); s.set(1, trunkH + 0.5, 1); m.compose(p, q.identity(), s);
      trunks.setMatrixAt(nt++, m);
    }
    cones.count = nc; balls.count = nb; trunks.count = nt;
    for (const im of [cones, balls, trunks]) { im.computeBoundingSphere(); trees.add(im); }
  }

  // ---- 茂み：塔のまわり（Instanced） ----
  const bushGeo = keep(new THREE.IcosahedronGeometry(1, 1));
  const bushes = new THREE.InstancedMesh(bushGeo, keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), 16);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < 16; i++) {
      const a = Math.PI * 0.42 + (i / 15) * Math.PI * 1.16 + (r() - 0.5) * 0.08;
      const rad = 5.15 + r() * 0.5, sc = 0.45 + r() * 0.45;
      p.set(Math.sin(a) * rad, sc * 0.45, Math.cos(a) * rad);
      s.set(sc * 1.2, sc, sc * 1.2);
      m.compose(p, q.identity(), s);
      bushes.setMatrixAt(i, m);
      bushes.setColorAt(i, new THREE.Color().setHSL(0.26 + r() * 0.06, 0.45, 0.36 + r() * 0.1));
    }
    bushes.computeBoundingSphere();
  }
  bushes.name = 'bushes';
  root.add(bushes);

  // ---- 塔：奥半分の円筒の壁＋床＋胸壁を1つの形に結合（石テクスチャ1枚、頂点カラーで陰影） ----
  const { inner: RI, outer: RO, height: H } = TOWER;
  const A0 = Math.PI / 2, A1 = Math.PI * 1.5; // x = r sinθ, z = r cosθ → z ≤ 0 側
  const SEG = 36;
  const parts = [];
  // 外壁
  parts.push(grid(SEG, 1, (u, v) => {
    const a = A0 + (A1 - A0) * u, sx = Math.sin(a), cz = Math.cos(a);
    return { p: [sx * RO, v * H, cz * RO], n: [sx, 0, cz], uv: [(RO * (a - A0)) / TILE, (v * H) / TILE], c: [0.95, 0.93, 0.9] };
  }, true));
  // 内壁（床際を暗くして疑似の陰）
  parts.push(grid(SEG, 4, (u, v) => {
    const a = A0 + (A1 - A0) * u, sx = Math.sin(a), cz = Math.cos(a);
    const y = v * v * H;
    const ao = 0.66 + 0.34 * Math.min(1, y / 2.6);
    return { p: [sx * RI, y, cz * RI], n: [-sx, 0, -cz], uv: [(RI * (a - A0)) / TILE, y / TILE], c: [ao * 1.0, ao * 0.96, ao * 0.92] };
  }));
  // 上端
  parts.push(grid(SEG, 1, (u, v) => {
    const a = A0 + (A1 - A0) * u, rad = RI + (RO - RI) * v;
    return { p: [Math.sin(a) * rad, H, Math.cos(a) * rad], n: [0, 1, 0], uv: [(rad * (a - A0)) / TILE, v * 0.2], c: [0.9, 0.88, 0.85] };
  }));
  // 切り口（手前を向く2面）
  for (const side of [1, -1]) {
    parts.push(grid(1, 1, (u, v) => {
      const rad = RI + (RO - RI) * u;
      return { p: [side * rad, v * H, 0], n: [0, 0, 1], uv: [u * 0.2, (v * H) / TILE], c: [0.86, 0.84, 0.8] };
    }, side > 0));
  }
  // 床（円盤）＋側面
  parts.push(grid(40, 1, (u, v) => {
    const a = u * Math.PI * 2, rad = v * RO;
    const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
    const k = 0.78 + 0.1 * (1 - v);
    return { p: [x, 0, z], n: [0, 1, 0], uv: [x / TILE, z / TILE], c: [k, k * 0.95, k * 0.9] };
  }));
  parts.push(grid(40, 1, (u, v) => {
    const a = u * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
    return { p: [sx * RO, -0.45 + v * 0.45, cz * RO], n: [sx, 0, cz], uv: [(RO * a) / TILE, v * 0.22], c: [0.8, 0.77, 0.72] };
  }, true));
  // 胸壁（凸凹）
  const merlons = 9;
  for (let i = 0; i < merlons; i++) {
    const a = A0 + (A1 - A0) * ((i + 0.5) / merlons);
    const b = new THREE.BoxGeometry(0.62, 0.62, RO - RI + 0.08);
    scaleUV(b, 0.31, 0.31);
    tint(b, 0.93, 0.9, 0.86);
    b.rotateY(a);
    b.translate(Math.sin(a) * (RI + RO) / 2, H + 0.31, Math.cos(a) * (RI + RO) / 2);
    parts.push(b);
  }
  // 旗の竿（3本）
  const FLAG_A = [A0 + (A1 - A0) * (1.5 / 9), Math.PI, A0 + (A1 - A0) * (7.5 / 9)];
  for (const a of FLAG_A) {
    const pole = new THREE.CylinderGeometry(0.04, 0.05, 1.3, 5, 1, true);
    tint(pole, 0.35, 0.26, 0.2);
    pole.translate(Math.sin(a) * (RI + RO) / 2, H + 0.62 + 0.65, Math.cos(a) * (RI + RO) / 2);
    parts.push(pole);
  }
  const stoneTex = keep(textures.loadFile('stone_blocks_512.jpg').clone());
  const towerGeo = keep(merge(parts));
  const tower = new THREE.Mesh(towerGeo, keep(new THREE.MeshLambertMaterial({ map: stoneTex, vertexColors: true, side: THREE.FrontSide })));
  tower.name = 'tower';
  root.add(tower);

  // 旗（Instanced、ゆっくりそよぐ）
  const flagGeo = keep(new THREE.BufferGeometry());
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0.85, -0.25, 0], 3));
  flagGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const flags = new THREE.InstancedMesh(flagGeo, keep(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })), 3);
  const flagCol = [0xff8fb1, 0xffd45c, 0x7fdcc4];
  const flagBase = FLAG_A.map((a) => new THREE.Vector3(Math.sin(a) * (RI + RO) / 2, H + 1.9, Math.cos(a) * (RI + RO) / 2));
  flagBase.forEach((_, i) => flags.setColorAt(i, new THREE.Color(flagCol[i])));
  flags.name = 'flags';
  root.add(flags);

  // 塔の足もとの疑似影
  const blob = new THREE.Mesh(keep(new THREE.PlaneGeometry(12.5, 12.5)),
    keep(new THREE.MeshBasicMaterial({ map: shared.blobShadow, color: 0x203018, transparent: true, opacity: 0.32, depthWrite: false })));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.012; // 芝(-0.02)より上、塔の床(0)より下：床と重ならない
  blob.renderOrder = -1;
  blob.name = 'tower-shadow';
  root.add(blob);

  // ---- 毎フレーム ----
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fs = new THREE.Vector3(1, 1, 1), fe = new THREE.Euler();
  function update(t) {
    for (let i = 0; i < 3; i++) {
      fe.set(0, -Math.PI / 2 + 0.35 * Math.sin(t * 0.7 + i * 2.1), 0.05 * Math.sin(t * 1.1 + i));
      fq.setFromEuler(fe);
      fm.compose(flagBase[i], fq, fs);
      flags.setMatrixAt(i, fm);
    }
    flags.instanceMatrix.needsUpdate = true;
  }
  update(0);
  flags.computeBoundingSphere();

  // 木の GPU 資源は木だけで持つ（low に下がったら捨てる。ティアは下がるだけなので作り直さない）
  let treesBuilt = false;
  const treeRes = [];
  function setTier(t) {
    tier = t;
    if (tier !== 'low' && !treesBuilt) {
      const n = disposables.length;
      buildTrees(); treesBuilt = true;
      treeRes.push(...disposables.splice(n));
    }
    if (tier === 'low' && treeRes.length) {
      for (const o of [...trees.children]) { trees.remove(o); if (o.isInstancedMesh) o.dispose(); }
      for (const d of treeRes) d.dispose();
      treeRes.length = 0;
    }
    trees.visible = tier !== 'low';
  }

  return {
    root,
    update,
    setTier,
    // 起動を速くするため、木は最初のフレームの後に作る
    deferred() { setTier(tier); },
    dispose() { scene.remove(root); for (const d of [...disposables, ...treeRes]) d.dispose(); },
  };
}
