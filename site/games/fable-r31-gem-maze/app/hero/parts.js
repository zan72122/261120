// 部品。すべて params.js の値から手続きで作る。make〜(THREE, …) → メッシュや位置の情報。
// 同じ材料の動かない部分は Builder で 1 つの形にまとめ、同じ形のくり返しは InstancedMesh にする。
import { P, TAU } from './params.js';
import { Builder, gearGeometry, meshPhase, gemGeometry, arcSweepGeometry, archGeometry } from './geo.js';
import { CENTER, nodeCoord } from './maze.js';

// 色（頂点色）。配列は線形の倍率（真鍮のテクスチャを明るく持ち上げる）。
const WHITE = 0xfff6ea, PEARL = 0xffffff, GOLD = [1.5, 1.38, 1.15], ROSE = [1.7, 1.0, 0.95], SILVER = 0xd6e6ff, HUB = 0xffc85a;

// ---------- 材料（共有）。使うのは MeshStandard / MeshBasic / ShaderMaterial だけ。
export function makeMaterials(THREE, opts, keep) {
  const brassTex = opts.getTexture('brass_ring');
  const m = {};
  m.brass = keep(new THREE.MeshStandardMaterial({ map: brassTex, vertexColors: true, metalness: 0.7, roughness: 0.34 }));
  m.enamel = keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.3 }));
  m.steel = keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.22 }));
  // 光るとき（ヒント）は、そのリングの色を白に寄せた色で光る
  const lit = (c) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.35);
  m.rings = P.ring.colors.map((c) => keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.28, emissive: lit(c), emissiveIntensity: 0 })));
  m.knob = keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.28, emissive: lit(P.knob.color), emissiveIntensity: 0 }));
  m.wood = keep(new THREE.MeshStandardMaterial({ map: opts.getTexture('wood_table'), color: 0xffead6, roughness: 0.7, metalness: 0 }));
  m.gem = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.1, envMapIntensity: 1.7 }));
  m.lamp = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.18 }));
  const gemTex = opts.getTexture('gem_facets');
  m.treasure = keep(new THREE.MeshStandardMaterial({ map: gemTex, emissive: 0xffffff, emissiveMap: gemTex, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.25 }));
  m.hit = keep(new THREE.MeshBasicMaterial({ visible: false }));
  // レールの光の筋（加算）。aGlow = (強さ, 経路に沿った位置)。NaN 防止：pow の底と normalize の中身を 0 にしない。
  m.glow = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.8, 0.3) } },
    vertexShader: `
      attribute vec2 aGlow;
      varying vec2 vGlow; varying vec3 vN; varying vec3 vV;
      void main() {
        vGlow = aGlow;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalMatrix * normal; vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vGlow; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN + vec3(0.0, 0.0, 1e-5)), normalize(vV + vec3(0.0, 0.0, 1e-5))));
        float core = pow(max(facing, 1e-4), 1.2);
        float wave = 0.5 + 0.5 * sin(6.2832 * (vGlow.y * 0.75 - uTime * 1.3));
        float a = clamp(vGlow.x, 0.0, 1.5) * core * (0.4 + 0.6 * wave * wave);
        gl_FragColor = vec4(uColor, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  // 見せ場の光の柱（加算）。uv.y：0 = 箱の口、1 = 上端。
  m.beam = keep(new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(1.0, 0.9, 0.55) } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalMatrix * normal; vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uAlpha; uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN + vec3(0.0, 0.0, 1e-5)), normalize(vV + vec3(0.0, 0.0, 1e-5))));
        float fade = pow(max(1.0 - vUv.y, 1e-4), 1.4);
        float rays = 0.75 + 0.25 * sin(vUv.x * 62.83 + uTime * 1.5);
        gl_FragColor = vec4(uColor, uAlpha * fade * rays * (0.25 + 0.75 * facing));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  // きらきら（点）。手続きの 32² テクスチャ 1 枚（星形のにじみ）。
  const N = 32, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1, d = Math.hypot(dx, dy);
    const soft = Math.max(0, 1 - d) ** 2.2, cross = Math.max(0, 1 - Math.min(Math.abs(dx), Math.abs(dy)) * 9) * Math.max(0, 1 - d);
    const a = Math.min(1, soft + cross * 0.9), o = (y * N + x) * 4;
    data[o] = 255; data[o + 1] = 250; data[o + 2] = 235; data[o + 3] = Math.round(a * 255);
  }
  m.sparkTex = keep(new THREE.DataTexture(data, N, N, THREE.RGBAFormat));
  m.sparkTex.colorSpace = THREE.SRGBColorSpace; m.sparkTex.magFilter = THREE.LinearFilter; m.sparkTex.minFilter = THREE.LinearFilter; m.sparkTex.needsUpdate = true;
  m.spark = keep(new THREE.PointsMaterial({ map: m.sparkTex, size: 0.21, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true }));
  return m;
}

// ---------- 見せ場の飾り：光の柱と、きらきらの噴水（点 count 個）。立方体ローカルに置く。
export function makeFinaleFx(THREE, mats, low) {
  const c = P.chest, F = P.finale;
  const h = F.orbitY + 0.25 - c.bodyTop;
  const beamGeo = new THREE.CylinderGeometry(F.orbitR * 1.15, c.size * 0.36, h, low ? 14 : 24, 1, true);
  const beam = new THREE.Mesh(beamGeo, mats.beam);
  beam.position.y = c.bodyTop + h / 2;
  beam.visible = false; beam.renderOrder = 6;
  const count = low ? 28 : 48;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const col = new Float32Array(count * 3), tmp = new THREE.Color();
  for (let i = 0; i < count; i++) { tmp.set(P.gem.colors[i % 6]).lerp(new THREE.Color(0xffffff), 0.45); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const sparks = new THREE.Points(geo, mats.spark);
  sparks.visible = false; sparks.frustumCulled = false; sparks.renderOrder = 7;
  // 粒 i の決まった初速（乱数は使わず黄金角でばらす）
  const seeds = [];
  for (let i = 0; i < count; i++) { const a = i * 2.399963, u = (i * 0.618034) % 1; seeds.push({ a, out: 0.18 + 0.42 * u, up: 1.5 + 0.9 * ((i * 0.381966) % 1), phase: (i / count) }); }
  return { beam, sparks, seeds, count };
}

// ---------- 台座：ろくろ挽きの丸い板 ＋ 前の宝石皿（ランプが並ぶ斜面）＋ ローラーの支え。
export function makeBase(THREE, mats, low) {
  const group = new THREE.Group();
  const b = P.base, tr = P.tray, G = P.G;
  const lathe = new THREE.LatheGeometry([
    new THREE.Vector2(0.001, 0), new THREE.Vector2(b.rBottom, 0), new THREE.Vector2(b.rSide, 0.025), new THREE.Vector2(b.rSide, b.height * 0.72),
    new THREE.Vector2((b.rSide + b.rTop) / 2 + 0.012, b.height * 0.93), new THREE.Vector2(b.rTop, b.height), new THREE.Vector2(0.001, b.height),
  ], low ? 36 : 64);
  const section = [[tr.r0, b.height - 0.01], [tr.r1, b.height - 0.01], [tr.r1, tr.yLow], [tr.r0 + 0.045, tr.yHigh], [tr.r0, tr.yHigh]];
  const wood = new Builder(THREE);
  wood.add(lathe, null);
  wood.add(arcSweepGeometry(THREE, section, tr.halfArc, low ? 12 : 22), null);
  const woodGeo = wood.build();
  { // 木目は上から貼る（ろくろの UV は伸びるので）
    const p = woodGeo.attributes.position, uv = woodGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.48 + 0.5, p.getZ(i) * 0.48 + 0.5 + p.getY(i) * 0.6);
  }
  const woodMesh = new THREE.Mesh(woodGeo, mats.wood);
  group.add(woodMesh);

  // ローラー（溝付き）。中心は外リングの外周に接する：G から (R1 + t1 + r) の距離、底から ±angle。
  const ro = P.roller, R1 = P.ring.R[0], t1 = P.ring.t[0];
  const dist = R1 + t1 + ro.r;
  const rollerPos = [-1, 1].map((sx) => new THREE.Vector3(G[0] + sx * dist * Math.sin(ro.angle), G[1] - dist * Math.cos(ro.angle), G[2]));
  const prof = [new THREE.Vector2(0.001, -ro.halfWidth), new THREE.Vector2(ro.r + ro.flange, -ro.halfWidth)];
  const gs = low ? 4 : 7, psiMax = Math.acos(1 - ro.flange / t1);       // 溝は外リングの管と同じ丸み
  for (let i = 0; i <= gs; i++) { const psi = -psiMax + 2 * psiMax * i / gs; prof.push(new THREE.Vector2(ro.r + t1 - t1 * Math.cos(psi), t1 * Math.sin(psi))); }
  prof.push(new THREE.Vector2(ro.r + ro.flange, ro.halfWidth), new THREE.Vector2(0.001, ro.halfWidth));
  const rb = new Builder(THREE);
  rb.add(new THREE.LatheGeometry(prof, low ? 14 : 24), rb.at(0, 0, 0, Math.PI / 2, 0, 0), WHITE);
  for (let k = 0; k < 3; k++) for (const sz of [-1, 1]) {               // 回るのが見える印（3 つの丸）
    const a = k * TAU / 3;
    rb.add(new THREE.CylinderGeometry(0.026, 0.026, 0.012, low ? 8 : 12), rb.at(0.075 * Math.cos(a), 0.075 * Math.sin(a), sz * ro.halfWidth, Math.PI / 2, 0, 0), P.ring.colors[0]);
  }
  const rollers = new THREE.InstancedMesh(rb.build(), mats.enamel, 2);
  rollers.frustumCulled = false;
  group.add(rollers);

  // 支え（左右の頬板と軸）とランプの縁をまとめた真鍮
  const br = new Builder(THREE);
  for (const c of rollerPos) {
    const top = c.y + 0.05, hgt = top - b.height;
    for (const sz of [-1, 1]) br.add(new THREE.BoxGeometry(0.08, hgt, 0.024), br.at(c.x, b.height + hgt / 2, sz * (ro.halfWidth + 0.02)), GOLD);
    br.add(new THREE.CylinderGeometry(0.024, 0.024, 2 * (ro.halfWidth + 0.045), low ? 8 : 12), br.at(c.x, c.y, 0, Math.PI / 2, 0, 0), GOLD);
    br.add(new THREE.BoxGeometry(0.14, 0.02, 2 * (ro.halfWidth + 0.05)), br.at(c.x, b.height + 0.01, 0), GOLD);
  }
  group.add(new THREE.Mesh(br.build(), mats.brass));

  // ランプ（回収の数だけともる。数字は使わない）
  const dome = new THREE.SphereGeometry(tr.lampR, low ? 10 : 14, low ? 4 : 6, 0, TAU, 0, Math.PI / 2);
  dome.scale(1, 0.75, 1);
  const lamps = new THREE.InstancedMesh(dome, mats.lamp, 6);
  const bezelGeo = new THREE.TorusGeometry(tr.lampR * 1.1, 0.013, low ? 5 : 6, low ? 12 : 18);
  bezelGeo.rotateX(Math.PI / 2);
  const bz = new Builder(THREE); bz.add(bezelGeo, null, GOLD);
  const bezels = new THREE.InstancedMesh(bz.build(), mats.brass, 6);
  lamps.frustumCulled = bezels.frustumCulled = false;
  group.add(lamps, bezels);
  const rMid = (tr.r0 + 0.045 + tr.r1) / 2, yMid = (tr.yLow + tr.yHigh) / 2;
  const slope = new THREE.Vector2(tr.yHigh - tr.yLow, tr.r1 - (tr.r0 + 0.045)).normalize();   // 斜面の法線 (r, y)
  const up = new THREE.Vector3(0, 1, 0);
  function lampSlot(i, total, pos, quat) {
    const phi = (i - (total - 1) / 2) * tr.lampGap / rMid;
    const n = new THREE.Vector3(slope.x * Math.sin(phi), slope.y, slope.x * Math.cos(phi));
    pos.set(rMid * Math.sin(phi), yMid, rMid * Math.cos(phi)).addScaledVector(n, 0.004);
    quat.setFromUnitVectors(up, n);
  }
  return { group, rollers, rollerPos, lamps, bezels, lampSlot, instanced: [rollers, lamps, bezels] };
}

// ---------- リング（i = 0 外・1 中・2 内）。XY 面の円環。材料 0 = そのリングの色、1 = 真鍮。
export function makeRing(THREE, i, mats, low) {
  const r = P.ring, R = r.R[i], t = r.t[i], color = r.colors[i];
  const B = new Builder(THREE);
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  B.add(new THREE.TorusGeometry(R, t, low ? 8 : 14, low ? 64 : 128), null, color, 0);
  // 前後の面の飾り鋲（握り・ピン・ハンドルの所は空ける）
  const n = r.stud.count[i];
  for (let k = 0; k < n; k++) {
    const a = (k + 0.5) * TAU / n;
    for (const sz of [-1, 1]) B.add(new THREE.SphereGeometry(r.stud.r, low ? 6 : 8, low ? 4 : 6), B.at(R * Math.cos(a), R * Math.sin(a), sz * t * 0.82), GOLD, 1);
  }
  const seg = low ? 8 : 12;
  if (i === 0) {
    // 正面のハンドル（+Z へ出る。外周はローラーが転がるので何も付けない）
    const a = r.handle.angle, hx = R * Math.cos(a), hy = R * Math.sin(a);
    B.rod(new THREE.Vector3(hx, hy, t * 0.7), new THREE.Vector3(hx, hy, t + r.handle.stem), 0.022, seg, GOLD, 1);
    B.ball(new THREE.Vector3(hx, hy, t + r.handle.stem + r.handle.ball * 0.8), r.handle.ball, PEARL, 0, low ? 10 : 16, low ? 8 : 12);
    // 中リングのピンを受ける軸受け（内側）
    for (const sx of [-1, 1]) B.add(new THREE.CylinderGeometry(0.045, 0.045, 0.04, seg), B.at(sx * (R - t - 0.004), 0, 0, 0, 0, Math.PI / 2), GOLD, 1);
  } else {
    // 握り玉（回す軸からいちばん遠い 2 点。次のリングのピンの軸受けを兼ねる）と、外側のリングへのピン
    const far = i === 1 ? Y : X, axis = i === 1 ? X : Y;
    const Rout = r.R[i - 1], tout = r.t[i - 1];
    for (const sg of [-1, 1]) {
      const p = far.clone().multiplyScalar(sg * R);
      B.ball(p, r.grip[i], PEARL, 0, low ? 10 : 16, low ? 8 : 12, i === 1 ? 1.3 : 1, i === 1 ? 1 : 1.3, 1);
      B.rod(axis.clone().multiplyScalar(sg * (R + t - 0.012)), axis.clone().multiplyScalar(sg * (Rout - tout + 0.02)), r.pin, seg, GOLD, 1);
    }
  }
  if (i === 2) {
    // 立方体の骨組みを内リングに固定する 4 本の斜めの支柱（骨組みの縦の辺の中点 → リング）
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const d = new THREE.Vector3(sx, sy, 0).normalize();
      B.rod(d.clone().multiplyScalar(P.h * Math.SQRT2), d.clone().multiplyScalar(R - t * 0.5), 0.024, seg, GOLD, 1);
    }
  }
  const mesh = new THREE.Mesh(B.build(), [mats.rings[i], mats.brass]);
  // ヒット代理（見えない太い管）。継ぎ目が上下左右の真上に来ないよう少し回しておく
  // （レイが三角形の辺をちょうど通ると当たり判定を取りこぼすことがある）。
  const hitGeo = new THREE.TorusGeometry(R, r.band, 6, low ? 24 : 32);
  hitGeo.rotateZ(0.37); hitGeo.rotateX(0.011);
  const hit = new THREE.Mesh(hitGeo, mats.hit);
  return { mesh, hit };
}

// ---------- 立方体の骨組み（内リングに固定）と、ノブの歯車列を支える腕。
// 歯車の位置（立方体ローカルの XY、歯車の面は z = s）：回転台 T、中間 I、ノブ K。
export function gearLayout(THREE) {
  const g = P.gear;
  const dTI = (g.zt + g.zi) * g.m / 2, dIK = (g.zi + g.zk) * g.m / 2;       // 中心距離 = (z1 + z2)·m/2
  const T = new THREE.Vector2(0, 0);
  const u = new THREE.Vector2(Math.cos(g.knobDir), Math.sin(g.knobDir));
  const K = u.clone().multiplyScalar(g.knobDist);
  const a = (dTI * dTI - dIK * dIK + g.knobDist * g.knobDist) / (2 * g.knobDist);
  const hgt = Math.sqrt(Math.max(0, dTI * dTI - a * a));
  const I = u.clone().multiplyScalar(a).add(new THREE.Vector2(-u.y, u.x).multiplyScalar(hgt));
  const dirTI = Math.atan2(I.y - T.y, I.x - T.x), dirIK = Math.atan2(K.y - I.y, K.x - I.x);
  const phaseI = meshPhase(g.zt, 0, g.zi, dirTI);                           // 回転台の歯 0 は +X（レール片の向き）
  const phaseK = meshPhase(g.zi, phaseI, g.zk, dirIK);
  const ra = g.m * g.zt / 2 + g.m;                                           // 回転台の歯先の半径
  return { T, I, K, phaseI, phaseK, ra, z: P.s };
}

export function makeFrame(THREE, mats, low, GL) {
  const h = P.h, f = P.frame;
  const B = new Builder(THREE);
  const seg = low ? 6 : 8;
  for (let ax = 0; ax < 3; ax++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const p0 = [0, 0, 0], p1 = [0, 0, 0];
    p0[ax] = -h; p1[ax] = h; p0[(ax + 1) % 3] = p1[(ax + 1) % 3] = a * h; p0[(ax + 2) % 3] = p1[(ax + 2) % 3] = b * h;
    B.rod(new THREE.Vector3(...p0), new THREE.Vector3(...p1), f.bar, seg, WHITE, 0);
  }
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) B.ball(new THREE.Vector3(x * h, y * h, z * h), f.corner, GOLD, 1, low ? 6 : 10, low ? 4 : 8);
  // ノブの腕：前面の角 (h,−h,h) からノブの軸と中間歯車の軸へ
  const corner = new THREE.Vector3(h, -h, h), k3 = new THREE.Vector3(GL.K.x, GL.K.y, h), i3 = new THREE.Vector3(GL.I.x, GL.I.y, h);
  B.rod(corner, i3, 0.022, seg, GOLD, 1);
  B.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, low ? 10 : 16), B.at(k3.x, k3.y, h, Math.PI / 2, 0, 0), GOLD, 1);
  B.add(new THREE.CylinderGeometry(0.032, 0.032, 0.03, low ? 8 : 12), B.at(i3.x, i3.y, h, Math.PI / 2, 0, 0), GOLD, 1);
  B.rod(new THREE.Vector3(i3.x, i3.y, GL.z - 0.03), i3, 0.014, seg, GOLD, 1);          // 中間歯車の軸
  return new THREE.Mesh(B.build(), [mats.enamel, mats.brass]);
}

// ---------- 歯車列：回転台（輪歯車＋レール片）、中間歯車、ノブ（歯車＋軸＋つまみ）。
export function makeGears(THREE, mats, low, GL) {
  const g = P.gear, kn = P.knob, samples = low ? 2 : 3;
  // 回転台：歯 0（+X）の向きにレール片。中心のハブは宝箱へ続く軸（Z のレール）に通っている。
  const tb = new Builder(THREE);
  tb.add(gearGeometry(THREE, { z: g.zt, m: g.m, alpha: g.pressure, thickness: g.thickness, bore: g.ringInner, samples }), null, GOLD, 0);
  tb.rod(new THREE.Vector3(-GL.ra, 0, 0), new THREE.Vector3(GL.ra, 0, 0), P.rail.r * 1.25, low ? 6 : 8, SILVER, 1);
  tb.ball(new THREE.Vector3(0, 0, 0), P.rail.hub * 1.15, HUB, 1, low ? 8 : 10, low ? 6 : 8);
  for (const sx of [-1, 1]) tb.ball(new THREE.Vector3(sx * (g.ringInner + GL.ra) / 2, 0, 0), 0.03, HUB, 1, 8, 6);
  const turntable = new THREE.Mesh(tb.build(), [mats.brass, mats.steel]);
  turntable.position.set(GL.T.x, GL.T.y, GL.z);

  const ib = new Builder(THREE);
  ib.add(gearGeometry(THREE, { z: g.zi, m: g.m, alpha: g.pressure, thickness: g.thickness, bore: 0.016, samples }), null, ROSE);
  for (let k = 0; k < 3; k++) for (const sz of [-1, 1]) ib.add(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 8), ib.at(0.05 * Math.cos(k * TAU / 3), 0.05 * Math.sin(k * TAU / 3), sz * g.thickness / 2, Math.PI / 2, 0, 0), GOLD);
  const idler = new THREE.Mesh(ib.build(), mats.brass);
  idler.position.set(GL.I.x, GL.I.y, GL.z);

  // ノブ：軸でつながった歯車とつまみ（蝶ナットの形。回ると向きが分かる）
  const knobPivot = new THREE.Group();
  knobPivot.position.set(GL.K.x, GL.K.y, 0);
  const zTop = P.h + kn.lift;
  const kb = new Builder(THREE);
  kb.add(gearGeometry(THREE, { z: g.zk, m: g.m, alpha: g.pressure, thickness: g.thickness, bore: 0.016, samples }), kb.at(0, 0, GL.z), GOLD);
  kb.rod(new THREE.Vector3(0, 0, GL.z - 0.02), new THREE.Vector3(0, 0, zTop), 0.022, low ? 6 : 10, GOLD);
  const knobGear = new THREE.Mesh(kb.build(), mats.brass);
  const hb = new Builder(THREE);
  hb.add(new THREE.CylinderGeometry(kn.r * 0.82, kn.r, 0.07, low ? 14 : 24), hb.at(0, 0, zTop, Math.PI / 2, 0, 0), kn.color);
  hb.add(new THREE.SphereGeometry(kn.r * 0.82, low ? 12 : 20, low ? 4 : 6, 0, TAU, 0, Math.PI / 2), hb.at(0, 0, zTop + 0.035, Math.PI / 2, 0, 0, 1, 0.35, 1), kn.color);
  for (const sx of [-1, 1]) hb.ball(new THREE.Vector3(sx * kn.wing / 2 * 0.74, 0, zTop + 0.01), 0.05, PEARL, 0, low ? 8 : 12, low ? 6 : 8, 1.25, 0.85, 0.8);
  const handle = new THREE.Mesh(hb.build(), mats.knob);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(kn.hit, 10, 8), mats.hit);
  hit.position.set(0, 0, zTop);
  knobPivot.add(knobGear, handle, hit);
  return { turntable, idler, knobPivot, handle, hit, knobTop: zTop };
}

// ---------- 宝箱（中心ノード）。本体・ふた（後ろの蝶番）・中の宝の山。入口は 5 面の丸い口。
export function makeChest(THREE, mats, low) {
  const c = P.chest, S = c.size, hs = S / 2;
  const group = new THREE.Group();
  const bodyH = hs + c.bodyTop;
  const B = new Builder(THREE);
  B.add(new THREE.BoxGeometry(S, bodyH, S), B.at(0, (c.bodyTop - hs) / 2, 0), c.color, 0);
  B.add(new THREE.BoxGeometry(S + 0.016, 0.03, S + 0.016), B.at(0, -hs + 0.015, 0), GOLD, 1);
  B.add(new THREE.BoxGeometry(S + 0.012, 0.018, S + 0.012), B.at(0, c.bodyTop - 0.009, 0), GOLD, 1);
  for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(0.032, bodyH, S + 0.012), B.at(sx * S * 0.3, (c.bodyTop - hs) / 2, 0), GOLD, 1);
  // 入口：金の輪と暗い口。向き d（上以外の 5 面）
  const ringGeo = () => new THREE.TorusGeometry(c.funnel * 0.8, 0.014, low ? 5 : 8, low ? 12 : 20);
  const holeGeo = () => new THREE.CircleGeometry(c.funnel * 0.8, low ? 12 : 20);
  const faces = [[1, 0, 0, 0, Math.PI / 2, 0], [-1, 0, 0, 0, -Math.PI / 2, 0], [0, -1, 0, Math.PI / 2, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, -1, 0, Math.PI, 0]];
  for (const [x, y, z, rx, ry, rz] of faces) {
    B.add(ringGeo(), B.at(x * (hs + 0.008), y * (hs + 0.008), z * (hs + 0.008), rx, ry, rz), GOLD, 1);
    B.add(holeGeo(), B.at(x * (hs + 0.004), y * (hs + 0.004), z * (hs + 0.004), rx, ry, rz), 0x2a1650, 0);
  }
  const body = new THREE.Mesh(B.build(), [mats.enamel, mats.brass]);
  group.add(body);

  // ふた：蝶番は本体の上の後ろの辺（X 軸まわり）。形の原点を蝶番に合わせる。
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, c.bodyTop, -hs);
  const L = new Builder(THREE);
  const fwd = L.at(0, 0, hs);
  L.add(archGeometry(THREE, S + 0.01, c.lidRise, S + 0.01, low ? 6 : 12), fwd, c.lidColor, 0);
  for (const sx of [-1, 1]) L.add(archGeometry(THREE, S + 0.022, c.lidRise + 0.006, 0.032, low ? 6 : 12), L.at(sx * S * 0.3, 0, hs), GOLD, 1);
  L.add(new THREE.SphereGeometry(0.03, low ? 8 : 12, low ? 6 : 8), L.at(0, 0.012, S + 0.008, 0, 0, 0, 1, 1.25, 0.6), GOLD, 1);   // 留め金
  L.add(new THREE.BoxGeometry(S - 0.03, 0.006, S - 0.03), L.at(0, -0.002, hs), 0xffd0e6, 0);                                        // ふたの裏（開くと見える）
  for (const sx of [-1, 1]) L.add(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), L.at(sx * S * 0.3, 0, -0.004, 0, 0, Math.PI / 2), GOLD, 1); // 蝶番
  const lid = new THREE.Mesh(L.build(), [mats.enamel, mats.brass]);
  lidPivot.add(lid);
  group.add(lidPivot);

  const pile = new THREE.SphereGeometry(1, low ? 10 : 16, low ? 4 : 6, 0, TAU, 0, Math.PI / 2);
  pile.scale(hs * 0.86, c.lidRise * 0.6, hs * 0.86);
  const treasure = new THREE.Mesh(pile, mats.treasure);
  treasure.position.y = c.bodyTop;
  treasure.visible = false;
  group.add(treasure);
  return { group, lidPivot, treasure };
}

// ---------- レール網（配置ごとに作り直す）。細い管を 1 つに結合し、光の筋用の管も同じ辺の並びで作る。
export const nodePosition = (THREE, n, out) => { const c = nodeCoord(n); return out.set((c[0] - 1) * P.s, (c[1] - 1) * P.s, (c[2] - 1) * P.s); };

export function makeRails(THREE, L, mats, low, GL) {
  const s = P.s, h = P.h, rr = P.rail;
  const B = new Builder(THREE);
  const seg = low ? 5 : 6;
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), d = new THREE.Vector3();
  const glow = [];      // {key, A, B, t0, t1}：光の筋の管（A→B の t0..t1 の部分）
  const edgeInfo = new Map();
  const rim = GL.ra + 0.014;                       // 回転台の外で固定レールが終わる所
  for (const e of L.edges) {
    nodePosition(THREE, e.a, pa); nodePosition(THREE, e.b, pb);
    let t0 = 0, t1 = 1;
    if (e.a === CENTER) t0 = (P.chest.size / 2) / s; else if (e.b === CENTER) t1 = 1 - (P.chest.size / 2) / s;
    if (e.gate >= 0) { if (e.a === L.switchNode) t0 = rim / s; else t1 = 1 - rim / s; }
    d.subVectors(pb, pa);
    const A = pa.clone().addScaledVector(d, t0), Bp = pa.clone().addScaledVector(d, t1);
    B.rod(A, Bp, rr.r, seg, SILVER);
    glow.push({ key: e.key, a: e.a, b: e.b, A: pa.clone(), B: pb.clone(), t0, t1 });
  }
  for (const n of L.nodes) {
    if (n === L.switchNode) continue;
    nodePosition(THREE, n, pa);
    B.ball(pa, rr.hub, HUB, 0, low ? 6 : 8, low ? 4 : 6);
    const c = nodeCoord(n);
    if (c[0] !== 1 && c[1] !== 1 && c[2] !== 1) {  // 角のノードは骨組みの角に留める
      pb.set((c[0] - 1) * h, (c[1] - 1) * h, (c[2] - 1) * h);
      B.rod(pa, pb, rr.r, seg, SILVER);
    }
  }
  const rails = B.build();

  // 光の筋：辺ごとに 6 角の管。aGlow は実行時に書き換える。
  const side = 6, per = side * 2;
  const pos = new Float32Array(glow.length * per * 3), nor = new Float32Array(glow.length * per * 3), tau = new Float32Array(glow.length * per);
  const idx = [];
  const u = new THREE.Vector3(), v = new THREE.Vector3(), ax = new THREE.Vector3();
  glow.forEach((gl, gi) => {
    ax.subVectors(gl.B, gl.A).normalize();
    u.set(ax.y, ax.z, ax.x).cross(ax).normalize(); v.crossVectors(ax, u);
    for (let end = 0; end < 2; end++) {
      const t = end ? gl.t1 : gl.t0;
      for (let k = 0; k < side; k++) {
        const a = k * TAU / side, o = (gi * per + end * side + k);
        const nx = u.x * Math.cos(a) + v.x * Math.sin(a), ny = u.y * Math.cos(a) + v.y * Math.sin(a), nz = u.z * Math.cos(a) + v.z * Math.sin(a);
        pos[o * 3] = gl.A.x + (gl.B.x - gl.A.x) * t + nx * rr.glowR; pos[o * 3 + 1] = gl.A.y + (gl.B.y - gl.A.y) * t + ny * rr.glowR; pos[o * 3 + 2] = gl.A.z + (gl.B.z - gl.A.z) * t + nz * rr.glowR;
        nor[o * 3] = nx; nor[o * 3 + 1] = ny; nor[o * 3 + 2] = nz;
        tau[o] = t;
      }
    }
    for (let k = 0; k < side; k++) {
      const a0 = gi * per + k, a1 = gi * per + (k + 1) % side, b0 = a0 + side, b1 = a1 + side;
      idx.push(a0, a1, b1, a0, b1, b0);
    }
    edgeInfo.set(gl.key, { start: gi * per, count: per, a: gl.a, b: gl.b });
  });
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  glowGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const aGlow = new THREE.BufferAttribute(new Float32Array(glow.length * per * 2), 2);
  aGlow.setUsage(THREE.DynamicDrawUsage);
  glowGeo.setAttribute('aGlow', aGlow);
  glowGeo.setIndex(idx);
  glowGeo.computeBoundingSphere();
  return { rails, glowGeo, aGlow, tau, edgeInfo };
}

// 回転台のレール片の光（片側ずつ 2 本。回転台と一緒に回る）。half 0 = +X 側、1 = −X 側。τ は「外のノード → 中心」で rim/s..1。
export function makePieceGlow(THREE, GL) {
  const side = 6, rr = P.rail, s = P.s;
  const pos = [], nor = [], tau = [], idx = [];
  for (let half = 0; half < 2; half++) {
    const sx = half ? -1 : 1;
    for (let end = 0; end < 2; end++) {
      const x = end ? 0 : sx * (GL.ra + 0.014);
      for (let k = 0; k < side; k++) {
        const a = k * TAU / side;
        pos.push(x, Math.cos(a) * rr.glowR, Math.sin(a) * rr.glowR); nor.push(0, Math.cos(a), Math.sin(a));
        tau.push(end ? 1 : 1 - (GL.ra + 0.014) / s);
      }
    }
    for (let k = 0; k < side; k++) {
      const a0 = half * side * 2 + k, a1 = half * side * 2 + (k + 1) % side, b0 = a0 + side, b1 = a1 + side;
      idx.push(a0, a1, b1, a0, b1, b0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const aGlow = new THREE.BufferAttribute(new Float32Array(side * 4 * 2), 2);
  aGlow.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aGlow', aGlow);
  g.setIndex(idx);
  return { geo: g, aGlow, tau, perHalf: side * 2 };
}

export function makeGems(THREE, mats, low) {
  const mesh = new THREE.InstancedMesh(gemGeometry(THREE, P.gem.r, low ? 6 : 8), mats.gem, 6);
  mesh.frustumCulled = false;
  return mesh;
}

