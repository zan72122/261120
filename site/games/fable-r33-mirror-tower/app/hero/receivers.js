// 光源のランプ、色の柱（カムと歯車）、回る宝石（歯車列）。
// 動かない部分は ctx.staticB / ctx.paintB にまとめ、動く剛体だけ Mesh にする。
import { TAU, meshAngle, camRadius, centerDistance, smooth, clamp01 } from './mech.js';

// ---- 光源：太陽のような球（光条は hero.js の共有 InstancedMesh）----
export function buildLamp(ctx, L, P) {
  const { THREE, G, mats, col, staticB } = ctx;
  const p0 = L.lamp.p0, r = P.lamp.radius;
  G.lathe(staticB, [[0.44, 0], [0.44, 0.045], [0.3, 0.1], [0.14, 0.2], [0.09, 0.34], [0.075, p0.y - 0.64], [0.2, p0.y - 0.52], [0.31, p0.y - 0.36], [0.335, p0.y - 0.2], [0.3, p0.y - 0.2]],
    G.mt(p0.x, 0, p0.z), col.bronze, { seg: 14 });
  const geo = ctx.own(new THREE.SphereGeometry(r, 20, 14));
  const ball = new THREE.Mesh(geo, mats.lamp);
  ball.name = 'lamp';
  ball.position.set(p0.x, p0.y, p0.z);
  ctx.root.add(ball);
  ctx.shadows.push([p0.x, p0.z, 1.15]);
  return { ball };
}

// ---- 色の柱：歯車形のドラムを積んだ柱。上にカムで上下する飾り ----
//   モーターの小歯車 φm → カム軸 ψ = π/zCam − φm·zMotor/zCam → 従動節 y = rb + hmax(1 − cos(k·(π/2 − ψ)))/2
//   ドラムは カム軸から 1:2 で回り、隣どうしは逆回転。
export function buildPillar(ctx, R, P) {
  const { THREE, G, mats, col, staticB } = ctx;
  const p = P.pillar, cm = p.cam;
  const bx = p.base[0], bz = p.base[2];
  const pitchY = p.drumHeight + p.gap;
  const yT = p.firstDrumY + p.drums * pitchY;
  G.lathe(staticB, [[0.52, 0], [0.52, 0.06], [0.42, 0.13], [0.42, 0.3], [0.35, 0.37], [0.35, p.firstDrumY - 0.02], [0, p.firstDrumY - 0.02]],
    G.mt(bx, 0, bz), col.bronze, { seg: 16 });
  G.rod(staticB, [bx, p.firstDrumY - 0.02, bz], [bx, yT, bz], 0.13, col.iron, { seg: 10 });
  G.lathe(staticB, [[0.3, yT - 0.01], [0.37, yT + 0.03], [0.37, yT + 0.08], [0, yT + 0.08]], G.mt(bx, 0, bz), col.bronze, { seg: 16 });
  const y0 = yT + 0.08;
  const camY = y0 + cm.baseRadius + cm.lift + 0.06;
  const cd = centerDistance(cm.module, cm.zMotor, cm.zCam);
  const zGear = -0.035, zCam = 0.05;
  // 歯車箱の背板と、従動節の案内
  G.box(staticB, [cd + 0.62, 0.66, 0.035], G.mt(bx + cd / 2, y0 + 0.33, bz - 0.1), col.brass);
  const guideY = camY + cm.baseRadius + cm.lift + 0.1;
  G.box(staticB, [0.17, 0.05, 0.1 + zCam + 0.06], G.mt(bx, guideY, bz - 0.1 + (0.1 + zCam + 0.06) / 2), col.bronze);
  G.rod(staticB, [bx + cd, camY, bz - 0.1], [bx + cd, camY, bz - 0.3], 0.095, col.bronze, { caps: true, seg: 10 });

  // ドラム（歯車形）。Y 軸
  const db = new G.Builder();
  const white = [1, 1, 1];
  G.gear(db, { mod: (2 * p.drumRadius) / p.drumTeeth, z: p.drumTeeth, face: p.drumHeight }, G.mrx(-Math.PI / 2), white, { hubR: 0.13, webCol: [0.8, 0.8, 0.8] });
  const drumGeo = ctx.own(db.build());
  const drums = new THREE.InstancedMesh(drumGeo, mats.paint, p.drums);
  drums.name = 'pillar-drums';
  drums.frustumCulled = false;
  ctx.root.add(drums);

  // カム軸（カム＋歯車）。Z 軸
  const cb = new G.Builder();
  G.cam(cb, (a) => camRadius(a, cm.baseRadius, cm.lift, cm.lobes), 0.06, G.mt(0, 0, zCam), col.copper);
  G.gear(cb, { mod: cm.module, z: cm.zCam, face: 0.045 }, G.mt(0, 0, zGear), col.bright, { webCol: col.brass, hubR: 0.04, holes: 5, holeCol: col.bronze });
  G.rod(cb, [0, 0, -0.1], [0, 0, zCam + 0.05], 0.028, col.iron, { caps: true, seg: 6 });
  const camBody = new THREE.Mesh(ctx.own(cb.build()), mats.brass);
  camBody.position.set(bx, camY, bz);
  camBody.name = 'pillar-cam';
  const pb = new G.Builder();
  G.gear(pb, { mod: cm.module, z: cm.zMotor, face: 0.05 }, G.mt(0, 0, zGear), col.bright, { webCol: col.brass, hubR: 0.03 });
  G.rod(pb, [0, 0, -0.1], [0, 0, zGear + 0.05], 0.026, col.iron, { caps: true, seg: 6 });
  const pinion = new THREE.Mesh(ctx.own(pb.build()), mats.brass);
  pinion.position.set(bx + cd, camY, bz);
  pinion.name = 'pillar-pinion';
  // 従動節（ころ＋棒＋飾りの玉）。原点 = カムに触れる点
  const fb = new G.Builder();
  G.ball(fb, [0, 0.035, 0], 0.035, col.iron, { ws: 8, hs: 6 });
  const rodTop = cm.baseRadius + cm.lift + 0.34;
  G.rod(fb, [0, 0.05, 0], [0, rodTop, 0], 0.022, col.iron, { seg: 6 });
  G.ball(fb, [0, rodTop + 0.1, 0], 0.11, col.bright, { ws: 12, hs: 8 });
  G.lathe(fb, [[0.02, rodTop - 0.02], [0.15, rodTop + 0.08], [0.02, rodTop + 0.12]], null, col.copper, { seg: 8 });
  const follower = new THREE.Mesh(ctx.own(fb.build()), mats.brass);
  follower.position.set(bx, camY, bz + zCam);
  follower.name = 'pillar-follower';
  ctx.root.add(camBody, pinion, follower);
  ctx.shadows.push([bx, bz, 1.45]);

  const asleep = new THREE.Color(0xc4c4d2);
  const colors = p.colors.map((h) => new THREE.Color(h));
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const st = { phi: 0, speed: 0, popped: 0, glow: new Float32Array(p.drums), bump: new Float32Array(p.drums) };

  function update(dt, rx, env) {
    const awakeT = rx.awake ? rx.wakeT : -1;
    const want = rx.awake ? cm.motorSpeed * (env.finale > 0 ? 1.5 : 1) : 0;
    st.speed += (want - st.speed) * Math.min(1, dt * 2.5);
    st.phi += st.speed * dt;
    const psi = meshAngle(st.phi, cm.zMotor, cm.zCam);
    camBody.rotation.z = psi;
    pinion.rotation.z = Math.PI + st.phi;
    follower.position.y = camY + camRadius(Math.PI / 2 - psi, cm.baseRadius, cm.lift, cm.lobes);
    for (let k = 0; k < p.drums; k++) {
      const on = awakeT >= k * p.stepDelay;
      if (on && st.popped <= k) { st.popped = k + 1; st.bump[k] = 1; env.sound('pop', { gain: 0.55, pitch: [0, 2, 4, 7, 9, 12, 14][k % 7], position: rx.pos }); }
      st.glow[k] += ((on ? 1 : 0) - st.glow[k]) * Math.min(1, dt * 7);
      st.bump[k] = Math.max(0, st.bump[k] - dt * 3.5);
      // 色：眠っている間は灰色（照らされると下から少し明るむ）、起きたら虹色。見せ場では色が上へ流れる
      const pre = rx.awake ? 0 : clamp01(rx.charge * 1.4 - k * 0.12) * 0.35;
      let target = colors[k % colors.length];
      if (env.finale > 0) {
        const f = (env.time * 1.6 - k * 0.5) % colors.length, i0 = Math.floor((f + colors.length) % colors.length);
        target = tmpC2.copy(colors[i0]).lerp(colors[(i0 + 1) % colors.length], smooth(f - Math.floor(f)));
      }
      tmpC.copy(asleep).lerp(target, Math.max(st.glow[k], pre));
      drums.setColorAt(k, tmpC);
      const s = 1 + 0.14 * Math.sin(st.bump[k] * Math.PI) * st.bump[k];
      q.setFromAxisAngle(up, (k % 2 ? -1 : 1) * psi * 0.5 + k * 0.26);
      pos.set(bx, p.firstDrumY + (k + 0.5) * pitchY, bz);
      sc.set(s, 1, s);
      m4.compose(pos, q, sc);
      drums.setMatrixAt(k, m4);
    }
    drums.instanceMatrix.needsUpdate = true;
    if (drums.instanceColor) drums.instanceColor.needsUpdate = true;
  }
  function reset() { st.phi = 0; st.speed = 0; st.popped = 0; st.glow.fill(0); st.bump.fill(0); }
  return { update, reset, drums };
}

// ---- 回る宝石：ω宝石 = ωモーター·zMotor/zGem ----
export function buildGemStand(ctx, R, P) {
  const { THREE, G, mats, col, staticB } = ctx;
  const g = P.gem;
  const Gc = [R.c.x, R.c.y, R.c.z];
  const A = [0, Math.cos(g.tilt), Math.sin(g.tilt)];
  const M = G.frame(Gc, [1, 0, 0], A, null);
  const hp = g.radius * Math.tan(g.pavilionAngle);
  const yG = -hp - 0.1;
  const cd = centerDistance(g.module, g.zMotor, g.zGem);
  const X = (x, y, z) => { const v = new THREE.Vector3(x, y, z).applyMatrix4(M); return [v.x, v.y, v.z]; };

  // 宝石の受け皿＋歯車（宝石と一緒に回る）
  const cb = new G.Builder();
  G.lathe(cb, [[0.05, -hp - 0.07], [0.13, -hp + 0.02], [0.2, -hp * 0.5], [0.215, -hp * 0.5 + 0.02]], null, col.bright, { seg: 12 });
  for (let i = 0; i < 4; i++) {
    const an = (i / 4) * TAU + 0.4;
    G.rod(cb, [0.2 * Math.cos(an), -hp * 0.5, 0.2 * Math.sin(an)], [g.radius * 1.02 * Math.cos(an), 0.02, g.radius * 1.02 * Math.sin(an)], 0.016, col.bright, { seg: 5 });
  }
  G.gear(cb, { mod: g.module, z: g.zGem, face: 0.05 }, G.compose(G.mt(0, yG, 0), G.mrx(-Math.PI / 2)), col.bright, { webCol: col.brass, hubR: 0.05, holes: 6, holeCol: col.bronze });
  G.rod(cb, [0, yG - 0.16, 0], [0, -hp - 0.05, 0], 0.035, col.iron, { seg: 8 });
  const carrier = new THREE.Mesh(ctx.own(cb.build()), mats.brass);
  carrier.name = 'gem-carrier';
  const baseQ = new THREE.Quaternion().setFromRotationMatrix(M);
  carrier.position.set(Gc[0], Gc[1], Gc[2]);
  const pb = new G.Builder();
  G.gear(pb, { mod: g.module, z: g.zMotor, face: 0.06 }, G.mrx(-Math.PI / 2), col.bright, { webCol: col.brass, hubR: 0.035 });
  G.rod(pb, [0, -0.12, 0], [0, 0.05, 0], 0.03, col.iron, { caps: true, seg: 6 });
  const pinion = new THREE.Mesh(ctx.own(pb.build()), mats.brass);
  pinion.name = 'gem-pinion';
  pinion.position.fromArray(X(cd, yG, 0));
  ctx.root.add(carrier, pinion);

  // 支え：軸受、モーター、腕、柱
  G.rod(staticB, X(0, yG - 0.3, 0), X(0, yG - 0.12, 0), 0.07, col.bronze, { caps: true, seg: 10 });
  G.rod(staticB, X(cd, yG - 0.3, 0), X(cd, yG - 0.08, 0), 0.085, col.bronze, { caps: true, seg: 10 });
  G.rod(staticB, X(-0.02, yG - 0.24, 0), X(cd + 0.02, yG - 0.24, 0), 0.04, col.brass);
  const hb = X(cd, yG - 0.3, 0);
  const post = [Gc[0] + g.postOffset, hb[1] - 0.18, hb[2]];
  G.rod(staticB, hb, [hb[0], post[1], hb[2]], 0.04, col.brass);
  G.rod(staticB, [hb[0], post[1], hb[2]], post, 0.045, col.bronze);
  G.ball(staticB, [hb[0], post[1], hb[2]], 0.06, col.bright, { ws: 8, hs: 6 });
  G.lathe(staticB, [[0.4, 0], [0.4, 0.045], [0.28, 0.1], [0.13, 0.2], [0.09, 0.34], [0.07, post[1] - 0.1], [0.1, post[1] - 0.04], [0.1, post[1] + 0.04], [0, post[1] + 0.09]],
    G.mt(post[0], 0, post[2]), col.bronze, { seg: 12 });
  ctx.shadows.push([post[0], post[2], 1.05]);

  const qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(Gc[0], Gc[1], Gc[2]), sc = new THREE.Vector3(), q = new THREE.Quaternion();
  const dull = new THREE.Color(0x6f7482), bright = new THREE.Color(1.02, 1.02, 1.1), tmpC = new THREE.Color();
  const st = { phi: 0, speed: 0, glow: 0, pop: 0 };
  const slot = ctx.gems.alloc(1);

  function update(dt, rx, env) {
    const want = rx.awake ? g.motorSpeed * smooth(rx.wakeT / 1.5) : 0;
    st.speed = want;
    st.phi += st.speed * dt;
    const psi = meshAngle(st.phi, g.zMotor, g.zGem);
    carrier.quaternion.copy(baseQ).multiply(qy.setFromAxisAngle(up, psi));
    pinion.quaternion.copy(baseQ).multiply(qy.setFromAxisAngle(up, Math.PI + st.phi));
    st.glow += ((rx.awake ? 1 : clamp01(rx.charge) * 0.45) - st.glow) * Math.min(1, dt * 6);
    st.pop = rx.awake ? Math.max(0, 1 - rx.wakeT / 0.6) : 0;
    const s = 1 + 0.22 * Math.sin(st.pop * Math.PI) + (env.finale > 0 ? 0.05 * Math.sin(env.time * 4) : 0);
    q.copy(carrier.quaternion);
    sc.set(s, s, s);
    m4.compose(pos, q, sc);
    ctx.gems.mesh.setMatrixAt(slot, m4);
    ctx.gems.mesh.setColorAt(slot, tmpC.copy(dull).lerp(bright, st.glow));
    ctx.gems.dirty = true;
  }
  function reset() { st.phi = 0; st.speed = 0; st.glow = 0; st.pop = 0; }
  return { update, reset };
}

