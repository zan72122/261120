// 花の機械（スライダ・クランク＋ラック＆ピニオン）と、てっぺんの大きな花の遊星歯車。
//   クランク角 φ → スライダ s(φ) = r cosφ + √(l² − r² sin²φ) → 開き率 u = (s_max − s)/(2r)
//   スライダと一体の「めしべ」（輪のラック）が u·2r だけ上がり、花びらの根元の扇形ピニオン
//   （ピッチ半径 ρ = 2r/αmax）を回す → 花びら角 α = (u·2r)/ρ = αmax·u
// 花びら・めしべ・クランク円板・連接棒は、全部の花で共有の InstancedMesh（各 1 draw call）。
import { TAU, sliderPos, clamp01, rackPinionRadius, planetToothAngle, centerDistance, easeOutBack } from './mech.js';

export function createFlowers(ctx, P, maxFlowers, maxPetals) {
  const { THREE, G, mats, col, staticB, paintB } = ctx;
  const f = P.flowerMachine;
  const r = f.crankRadius, l = f.rodLength;
  const rho = rackPinionRadius(r, f.alphaMax);
  const zPin = Math.max(8, Math.round((2 * rho) / f.rackModule));
  const rackMod = (2 * rho) / zPin, pitch = Math.PI * rackMod;
  const Rc = f.hingeRadius - rho;           // めしべ（ラック）のピッチ半径
  const D = -f.crankY + (l + r);            // 閉じた時の、めしべの基準点から手首ピンまで
  const rodZ = f.crankZ + 0.045;

  // ---- 共有の形 ----
  const pb = new G.Builder();
  G.petal(pb, f, { rho, zPin, gearCol: [1.0, 0.72, 0.22] });
  const petalGeo = ctx.own(pb.build());
  const petals = new THREE.InstancedMesh(petalGeo, mats.petal, maxPetals);
  petals.name = 'petals';

  // めしべ（輪のラック）＋中の棒＋手首の輪とピン
  const sb = new G.Builder();
  const yb = -(2 * r + 2.5 * pitch), yt = 1.2 * pitch;
  const prof = [[0.03, yb], [Rc - 1.25 * rackMod, yb + 0.01]];
  for (let k = Math.ceil(yb / pitch); (k + 0.5) * pitch < yt - 0.3 * pitch; k++) {
    const yc = (k + 0.5) * pitch;
    if (yc - 0.29 * pitch < yb + 0.012) continue;
    prof.push([Rc - 1.25 * rackMod, yc - 0.29 * pitch], [Rc + rackMod, yc - 0.14 * pitch], [Rc + rackMod, yc + 0.14 * pitch], [Rc - 1.25 * rackMod, yc + 0.29 * pitch]);
  }
  prof.push([Rc - 1.25 * rackMod, yt], [0.075, yt + 0.02], [0.09, yt + 0.07], [0.055, yt + 0.13], [0, yt + 0.155]);
  G.lathe(sb, prof, null, col.pollen, { seg: 12 });
  G.rod(sb, [0, -D, 0], [0, yb, 0], 0.03, col.iron, { seg: 6 });
  const tr = f.tubeRadius;
  G.lathe(sb, [[tr + 0.01, -D - 0.055], [tr + 0.04, -D - 0.04], [tr + 0.04, -D + 0.04], [tr + 0.01, -D + 0.055]], null, col.bright, { seg: 12 });
  G.rod(sb, [0, -D, tr], [0, -D, rodZ + 0.025], 0.021, col.iron, { seg: 6, caps: true });
  const sliders = new THREE.InstancedMesh(ctx.own(sb.build()), mats.brass, maxFlowers);
  sliders.name = 'flower-sliders';

  // クランク円板（縁に歯のあるはずみ車）。Z 軸。クランクピンは φ=0 で下（スライダ側）
  const db = new G.Builder();
  G.gear(db, { mod: (2 * f.discRadius) / 20, z: 20, face: 0.035 }, null, col.bright, { webCol: col.brass, hubR: 0.03, holes: 4, holeCol: col.bronze });
  G.rod(db, [0, -r, 0], [0, -r, 0.075], 0.022, col.iron, { seg: 6, caps: true });
  G.ball(db, [0, 0, 0.02], 0.04, col.bright, { ws: 8, hs: 5 });
  const discs = new THREE.InstancedMesh(ctx.own(db.build()), mats.brass, maxFlowers);
  discs.name = 'flower-cranks';

  // 連接棒（原点 = 手首ピン、+Y へ長さ l）
  const rb = new G.Builder();
  G.box(rb, [0.042, l, 0.018], G.mt(0, l / 2, 0), col.copper);
  for (const y of [0, l]) G.rod(rb, [0, y, -0.012], [0, y, 0.012], 0.036, col.copper, { seg: 8, caps: true });
  const rods = new THREE.InstancedMesh(ctx.own(rb.build()), mats.brass, maxFlowers);
  rods.name = 'flower-rods';

  for (const im of [petals, sliders, discs, rods]) { im.frustumCulled = false; im.count = 0; ctx.root.add(im); }

  const flowers = [];
  const tmp = new THREE.Matrix4(), out = new THREE.Matrix4();
  const cA = new THREE.Color(), cB = new THREE.Color();

  // 花を1つ足す。H = ちょうつがいの輪の中心、A = 花の軸、S = 大きさ
  function add({ H, A, S, count, color, color2 }) {
    const X = [1, 0, 0];
    const M = G.frame(H, X, A, null, S);
    const P3 = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(M); return [v.x, v.y, v.z]; };
    const fl = { M, S, index: flowers.length, petal0: petals.count, count, phi: 0, lastPhi: NaN, u: 0, base: [], P3 };
    flowers.push(fl);
    petals.count += count;
    sliders.count = discs.count = rods.count = flowers.length;
    cA.set(color); cB.set(color2 === undefined ? color : color2);
    for (let k = 0; k < count; k++) {
      const beta = ((k + 0.5) / count) * TAU;
      fl.base.push(G.compose(M, G.mry(beta), G.mt(f.hingeRadius, 0, 0)));
      petals.setColorAt(fl.petal0 + k, k % 2 ? cB : cA);
    }
    fl.discBase = G.compose(M, G.mt(0, f.crankY, f.crankZ));
    // 動かない部分：茎の筒、ちょうつがいの輪、支え、クランクの軸受
    G.rod(paintB, P3(0, f.tubeBottom, 0), P3(0, yb - 0.02, 0), tr * S, col.stem, { seg: 10 });
    G.lathe(staticB, [[tr, yb - 0.09], [tr + 0.035, yb - 0.07], [tr + 0.035, yb - 0.02], [0.04, yb - 0.02]], M, col.bright, { seg: 10 });
    G.torus(staticB, f.hingeRadius, 0.024, G.compose(M, G.mrx(Math.PI / 2)), col.bright, { rs: 5, ts: Math.max(12, count * 2) });
    const struts = Math.max(3, Math.floor(count / 2));
    for (let i = 0; i < struts; i++) {
      const an = (Math.round((i / struts) * count) / count) * TAU;
      G.rod(staticB, P3((tr + 0.02) * Math.cos(an), yb - 0.05, -(tr + 0.02) * Math.sin(an)), P3(f.hingeRadius * Math.cos(an), 0, -f.hingeRadius * Math.sin(an)), 0.016 * S, col.brass, { seg: 5 });
    }
    G.rod(staticB, P3(0, f.crankY, -0.12), P3(0, f.crankY, f.crankZ - 0.02), 0.04 * S, col.bronze, { seg: 8 });
    G.ball(staticB, P3(0, f.crankY, -0.13), 0.1 * S, col.bronze, { ws: 10, hs: 7 });
    apply(fl, true);
    return fl;
  }

  // φ から全部の部品の姿勢を決める
  function apply(fl, force) {
    if (!force && fl.phi === fl.lastPhi) return;
    fl.lastPhi = fl.phi;
    const s = sliderPos(fl.phi, r, l);
    const rise = l + r - s;                       // めしべの上がり量 = 2r·u
    const u = clamp01(rise / (2 * r));
    fl.u = u;
    const alpha = rise / rho;                     // ラック＆ピニオン： α = 上がり量 / ρ （= αmax·u）
    tmp.makeRotationZ(-alpha);
    for (let k = 0; k < fl.count; k++) petals.setMatrixAt(fl.petal0 + k, out.multiplyMatrices(fl.base[k], tmp));
    tmp.makeTranslation(0, rise, 0);
    sliders.setMatrixAt(fl.index, out.multiplyMatrices(fl.M, tmp));
    tmp.makeRotationZ(fl.phi);
    discs.setMatrixAt(fl.index, out.multiplyMatrices(fl.discBase, tmp));
    const gamma = -Math.asin(Math.max(-1, Math.min(1, (r * Math.sin(fl.phi)) / l)));
    tmp.makeRotationZ(gamma).setPosition(0, f.crankY - s, rodZ);
    rods.setMatrixAt(fl.index, out.multiplyMatrices(fl.M, tmp));
    petals.instanceMatrix.needsUpdate = sliders.instanceMatrix.needsUpdate = discs.instanceMatrix.needsUpdate = rods.instanceMatrix.needsUpdate = true;
  }

  // 花の時間の進め方：眠り（照らされるとつぼみが少しふくらむ）→ ぱっと開く → 開いたまま息をする。
  // 見せ場では一度すぼんでもう一度開く（クランクが1回転）。
  function makeState(fl) {
    const st = { openT: -1, wink: 0, winkGoal: 0, pre: 0 };
    return {
      st,
      update(dt, rx, env) {
        if (rx.awake) {
          if (st.openT < 0) st.openT = 0;
          st.openT += dt;
          const k = clamp01(st.openT / f.openSeconds);
          const breathe = st.openT > f.openSeconds ? f.breatheAmp * Math.sin(TAU * f.breatheHz * (st.openT - f.openSeconds)) : 0;
          st.wink += (st.winkGoal - st.wink) * Math.min(1, dt * 1.6);
          if (Math.abs(st.winkGoal - st.wink) < 1e-3) st.wink = st.winkGoal;
          const from = st.pre * 0.5;
          fl.phi = from + (Math.PI - from) * easeOutBack(k) + breathe + st.wink;
        } else {
          st.pre += (clamp01(rx.charge) - st.pre) * Math.min(1, dt * 5);
          fl.phi = st.pre * 0.5 + (st.pre > 0.02 ? 0.05 * Math.sin(env.time * 18) * st.pre : 0);
        }
        apply(fl);
      },
      wink() { st.winkGoal += TAU; },
      reset() { st.openT = -1; st.wink = 0; st.winkGoal = 0; st.pre = 0; fl.phi = 0; apply(fl, true); },
    };
  }

  return { add, apply, makeState, petals, sliders, discs, rods, flowers, D, rho, zPin, yb };
}

// ---- てっぺんの大きな花のまわりの遊星歯車 ----
//   太陽歯車（固定、zs）のまわりをキャリアが Θ 回ると、遊星（zp）は Θ·(1 + zs/zp) だけ自転する。
//   遊星の上に小さな宝石が乗る。
export function buildPlanetary(ctx, P, H, A) {
  const { THREE, G, mats, col, staticB } = ctx;
  const pl = P.crown.planet, g = P.gem;
  const M = G.frame(H, [1, 0, 0], A, null);
  const baseQ = new THREE.Quaternion().setFromRotationMatrix(M);
  const Rorb = centerDistance(pl.module, pl.zs, pl.zp);
  const toY = G.mrx(-Math.PI / 2);
  const tubeR = P.flowerMachine.tubeRadius * P.crown.scale;
  // 太陽歯車（固定）
  G.gear(staticB, { mod: pl.module, z: pl.zs, face: pl.face }, G.compose(M, G.mt(0, pl.planeY, 0), toY), col.bright, { webCol: col.brass, hubR: tubeR + 0.03, holes: 8, holeCol: col.bronze });
  G.lathe(staticB, [[tubeR, pl.planeY - pl.face / 2 - 0.03], [tubeR + 0.06, pl.planeY - pl.face / 2], [tubeR + 0.06, pl.planeY + pl.face / 2], [tubeR, pl.planeY + pl.face / 2 + 0.03]], M, col.bronze, { seg: 10 });
  // キャリア（腕）
  const yArm = pl.planeY - pl.face / 2 - 0.075;
  const cb = new G.Builder();
  G.lathe(cb, [[tubeR + 0.012, yArm - 0.045], [tubeR + 0.075, yArm - 0.035], [tubeR + 0.075, yArm + 0.035], [tubeR + 0.012, yArm + 0.045]], null, col.copper, { seg: 12 });
  for (let k = 0; k < pl.count; k++) {
    const an = (k / pl.count) * TAU, cx = Math.cos(an), cz = -Math.sin(an);
    G.rod(cb, [(tubeR + 0.06) * cx, yArm, (tubeR + 0.06) * cz], [Rorb * cx, yArm, Rorb * cz], 0.03, col.copper, { seg: 6 });
    G.rod(cb, [Rorb * cx, yArm - 0.03, Rorb * cz], [Rorb * cx, pl.planeY, Rorb * cz], 0.034, col.iron, { seg: 6, caps: true });
  }
  const carrier = new THREE.Mesh(ctx.own(cb.build()), mats.brass);
  carrier.name = 'crown-carrier';
  carrier.position.set(H[0], H[1], H[2]);
  carrier.quaternion.copy(baseQ);
  ctx.root.add(carrier);
  // 遊星歯車（Instanced）
  const pb = new G.Builder();
  G.gear(pb, { mod: pl.module, z: pl.zp, face: pl.face }, toY, col.bright, { webCol: col.brass, hubR: 0.05, holes: 3, holeCol: col.bronze });
  G.lathe(pb, [[0.05, pl.face / 2], [0.11, pl.face / 2 + 0.03], [0.12, pl.face / 2 + 0.07]], null, col.copper, { seg: 8 });
  const planets = new THREE.InstancedMesh(ctx.own(pb.build()), mats.brass, pl.count);
  planets.name = 'crown-planets';
  planets.frustumCulled = false;
  ctx.root.add(planets);

  const gemS = pl.gemRadius / g.radius;
  const gemLift = pl.face / 2 + 0.05 + g.radius * Math.tan(g.pavilionAngle) * gemS;
  const slot0 = ctx.gems.alloc(pl.count);
  const st = { theta: 0, speed: 0, glow: 0 };
  const tmp = new THREE.Matrix4(), out = new THREE.Matrix4(), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Matrix4();
  const dull = new THREE.Color(0x6f7482), tmpC = new THREE.Color();
  const tints = [0xff9ec4, 0x9fe8ff, 0xfff0a0, 0xb8ffb0, 0xd9c2ff].map((h) => new THREE.Color(h).multiplyScalar(1.15));

  function update(dt, rx, env) {
    const want = !rx.awake ? 0 : env.finale > 0 ? pl.speedFinale : pl.speedAwake;
    st.speed += (want - st.speed) * Math.min(1, dt * 1.2);
    st.theta += st.speed * dt;
    carrier.quaternion.copy(baseQ).multiply(qy.setFromAxisAngle(up, st.theta));
    st.glow += ((rx.awake ? 1 : clamp01(rx.charge) * 0.4) - st.glow) * Math.min(1, dt * 4);
    for (let k = 0; k < pl.count; k++) {
      const th = st.theta + (k / pl.count) * TAU;
      const psi = planetToothAngle(st.theta, k, pl.count, pl.zs, pl.zp);
      tmp.makeRotationY(psi).setPosition(Rorb * Math.cos(th), pl.planeY, -Rorb * Math.sin(th));
      planets.setMatrixAt(k, out.multiplyMatrices(M, tmp));
      tmp.setPosition(Rorb * Math.cos(th), pl.planeY + gemLift, -Rorb * Math.sin(th));
      const s = gemS * (1 + (env.finale > 0 ? 0.12 * Math.sin(env.time * 3 + k * 1.3) : 0));
      out.multiplyMatrices(M, tmp).multiply(sc.makeScale(s, s, s));
      ctx.gems.mesh.setMatrixAt(slot0 + k, out);
      ctx.gems.mesh.setColorAt(slot0 + k, tmpC.copy(dull).lerp(tints[k % tints.length], st.glow));
    }
    planets.instanceMatrix.needsUpdate = true;
    ctx.gems.dirty = true;
  }
  function reset() { st.theta = 0; st.speed = 0; st.glow = 0; }
  return { update, reset, Rorb, M };
}

