// 鏡のステーション：鏡（枠＋軸＋従動歯車）、ハンドル（輪＋軸＋駆動歯車）、支え。
// ハンドル角 φ と鏡の角 θ は歯車比で結ぶ： φ = −σ·θ·z2/z1 （σ = 従動歯車の軸の向き・鏡の軸 = ±1）
// 軸が奥行き方向に近い鏡は平歯車、そうでなければ 90° のかさ歯車（ハンドルがカメラの方を向くように選ぶ）。
import { bevelCones, pitchRadius, centerDistance } from './mech.js';

export function buildStation(ctx, m, P) {
  const { THREE, G, mats, col, staticB } = ctx;
  const { vadd, vsub, vmul, vmad, vdot, vcross, vnorm } = G;
  const cfg = m.cfg, gp = P.gearing, mp = P.mirror, cp = P.crank;
  const isTurn = cfg.kind === 'turntable';
  const c = [m.c.x, m.c.y, m.c.z], a = [m.a.x, m.a.y, m.a.z], n0 = [m.n0.x, m.n0.y, m.n0.z];
  const u0 = vcross(a, n0);
  const toLocal = (v) => [vdot(v, u0), vdot(v, a), vdot(v, n0)]; // 世界の方向 → 鏡ローカル（θ=0 の姿勢）
  const sEnd = isTurn ? -1 : 1;          // 歯車の付く端：回転台は下、フォークはカメラ側
  const aEnd = vmul(a, sEnd);
  const frameEnd = cfg.along / 2 + mp.frameBar;
  const mod = gp.module, z1 = gp.z1, z2 = gp.z2;
  const r2 = pitchRadius(mod, z2);
  const bevel = Math.abs(aEnd[2]) < 0.6;

  // ---- 歯車列の配置 ----
  let crankO, crankX, crankZ, hw, sigma, gear2M, gear2Spec, bearing, apex = null, cones = null;
  if (bevel) {
    cones = bevelCones(mod, z1, z2);
    const { d1, d2, R } = cones;
    const A1 = vnorm(vsub([0, 0, 1], vmul(aEnd, aEnd[2]))); // ハンドルの軸：鏡の軸に垂直で、できるだけカメラ向き
    let A2;
    if (isTurn) { apex = vmad(c, aEnd, frameEnd + 0.30); A2 = aEnd; }             // 歯が上（鏡側）を向く
    else { apex = vmad(c, aEnd, frameEnd + 0.20 + R * Math.cos(d2)); A2 = vmul(aEnd, -1); } // 歯が外を向く
    crankO = apex; crankX = A2; crankZ = A1;
    hw = R * Math.cos(d1) + 0.30;
    sigma = vdot(A2, a);
    gear2M = G.frame(toLocal(vsub(apex, c)), toLocal(A1), null, toLocal(A2));
    gear2Spec = { mod, z: z2, face: gp.face, cone: d2, R, phase: Math.PI / z2 };
    bearing = vmad(apex, A1, R * Math.cos(d1) + 0.14);
  } else {
    const down = vnorm(vsub([0, -1, 0], vmul(aEnd, -aEnd[1])));
    const Gc = vmad(c, aEnd, frameEnd + 0.20);
    const Pc = vmad(Gc, down, centerDistance(mod, z1, z2));
    crankO = Pc; crankX = vmul(down, -1); crankZ = aEnd;
    hw = 0.27;
    sigma = sEnd;
    gear2M = G.frame(toLocal(vsub(Gc, c)), toLocal(down), null, toLocal(aEnd));
    gear2Spec = { mod, z: z2, face: gp.face, phase: Math.PI / z2 };
    bearing = vmad(Pc, aEnd, -0.13);
  }
  const crankY = vcross(crankZ, crankX);

  // ---- 鏡の剛体（枠＋軸＋従動歯車）。ローカル：X = 面内の横、Y = 回転軸、Z = 法線 ----
  const mb = new G.Builder();
  const bar = mp.frameBar, dep = mp.frameDepth, hx = cfg.across / 2, hy = cfg.along / 2;
  for (const s of [1, -1]) {
    G.box(mb, [cfg.across + 2 * bar, bar, dep], G.mt(0, s * (hy + bar / 2), 0), col.brass);
    G.box(mb, [bar, cfg.along, dep], G.mt(s * (hx + bar / 2), 0, 0), col.brass);
    for (const t of [1, -1]) G.ball(mb, [s * (hx + bar / 2), t * (hy + bar / 2), 0], 0.058, col.bright, { ws: 8, hs: 6 });
  }
  const gearLocalY = toLocal(vsub(bevel ? apex : crankO, c))[1];
  const shaftTo = bevel ? gearLocalY + (isTurn ? sEnd * 0.26 : -sEnd * 0.12) : sEnd * (frameEnd + 0.26);
  G.rod(mb, [0, sEnd * (hy + bar * 0.5), 0], [0, shaftTo, 0], mp.shaftRadius * (isTurn ? 1.35 : 1), col.iron, { caps: true });
  if (!isTurn) G.rod(mb, [0, -sEnd * (hy + bar * 0.5), 0], [0, -sEnd * (frameEnd + 0.13), 0], mp.shaftRadius, col.iron, { caps: true });
  G.gear(mb, gear2Spec, gear2M, col.bright, { webCol: col.brass, hubR: 0.07, holes: 6, holeCol: col.bronze });
  const mirrorGeo = ctx.own(mb.build());
  const pivot = new THREE.Mesh(mirrorGeo, mats.brass);
  pivot.name = cfg.id + '-mirror';
  pivot.position.set(c[0], c[1], c[2]);
  ctx.root.add(pivot);

  // ---- ハンドルの剛体（輪＋スポーク＋軸＋駆動歯車）。ローカル：Z = ハンドルの軸 ----
  const cb = new G.Builder();
  if (bevel) {
    G.gear(cb, { mod, z: z1, face: gp.face, cone: cones.d1, R: cones.R, phase: 0 }, null, col.bright, { webCol: col.brass, hubR: 0.045 });
    G.rod(cb, [0, 0, (cones.R - gp.face) * Math.cos(cones.d1) - 0.01], [0, 0, hw + 0.05], mp.shaftRadius, col.iron, { caps: true });
  } else {
    G.gear(cb, { mod, z: z1, face: gp.face * 1.15, phase: 0 }, null, col.bright, { webCol: col.brass, hubR: 0.045 });
    G.rod(cb, [0, 0, -0.17], [0, 0, hw + 0.05], mp.shaftRadius, col.iron, { caps: true });
  }
  const Rw = cp.wheelRadius;
  G.torus(cb, Rw, cp.rimTube, G.mt(0, 0, hw), col.bright, { rs: 7, ts: 26 });
  for (let i = 0; i < cp.spokes; i++) {
    const an = (i / cp.spokes) * Math.PI * 2 + Math.PI / 2;
    G.rod(cb, [0.04 * Math.cos(an), 0.04 * Math.sin(an), hw], [Rw * Math.cos(an), Rw * Math.sin(an), hw], 0.024, col.brass, { seg: 6 });
  }
  G.ball(cb, [0, 0, hw], 0.08, col.bright, { ws: 10, hs: 6, squash: 0.7, m: G.mrx(Math.PI / 2) });
  G.rod(cb, [0, Rw, hw], [0, Rw, hw + 0.1], 0.02, col.iron, { seg: 6 });
  const crankGeo = ctx.own(cb.build());
  const crankMat = ctx.own(mats.brass.clone());
  crankMat.emissive = new THREE.Color(0xffc45a);
  crankMat.emissiveIntensity = 0;
  const crank = new THREE.Mesh(crankGeo, crankMat);
  crank.name = cfg.id + '-crank';
  crank.position.set(crankO[0], crankO[1], crankO[2]);
  const crankBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...crankX), new THREE.Vector3(...crankY), new THREE.Vector3(...crankZ)));
  crank.quaternion.copy(crankBase);
  ctx.root.add(crank);
  const wheelCenter = vmad(crankO, crankZ, hw);

  // ---- 支え（動かない部分は全部 staticB にまとめる）----
  G.rod(staticB, vmad(bearing, crankZ, -0.055), vmad(bearing, crankZ, 0.055), 0.066, col.bright, { caps: true, seg: 10 });
  let shadowAt;
  if (isTurn) {
    const back = cones.R * Math.cos(cones.d2) + 1.25 * mod * Math.sin(cones.d2);
    const yTop = apex[1] - back - 0.035;
    const rc = yTop > 2 ? 0.1 : 0.085;
    G.lathe(staticB, [[0.48, 0], [0.48, 0.045], [0.34, 0.1], [0.16, 0.21], [rc + 0.02, 0.36], [rc, yTop - 0.2], [0.17, yTop - 0.1], [0.17, yTop], [0, yTop]],
      G.mt(c[0], 0, c[2]), col.bronze, { seg: 14 });
    const bd = [bearing[0], yTop - 0.15, bearing[2]];
    G.rod(staticB, bearing, bd, 0.034, col.bronze);
    G.rod(staticB, bd, [c[0], yTop - 0.15, c[2]], 0.034, col.bronze);
    G.ball(staticB, bd, 0.05, col.bright, { ws: 8, hs: 6 });
    shadowAt = [c[0], c[2], 1.25];
  } else {
    const dnS = cfg.hang ? 1 : -1;
    const dn = vnorm(vsub([0, dnS, 0], vmul(a, dnS * a[1])));
    const Rc = cfg.across / 2 + bar + 0.13;
    const Bp = [1, -1].map((s) => vmad(c, a, s * (frameEnd + 0.07)));
    const ends = Bp.map((p) => vmad(p, dn, Rc));
    for (let i = 0; i < 2; i++) {
      G.rod(staticB, Bp[i], ends[i], 0.042, col.bronze);
      G.torus(staticB, 0.075, 0.032, G.frameZ(Bp[i], a), col.bright, { rs: 6, ts: 12 });
      G.ball(staticB, ends[i], 0.062, col.bright, { ws: 8, hs: 6 });
    }
    G.rod(staticB, ends[0], ends[1], 0.042, col.bronze);
    const Cb = vmad(c, dn, Rc);
    if (cfg.hang) {
      const [mx, mz] = cfg.mast;
      const yM = Cb[1] + 0.3;
      G.rod(staticB, Cb, [Cb[0], yM, Cb[2]], 0.05, col.bronze);
      G.lathe(staticB, [[0.44, 0], [0.44, 0.045], [0.3, 0.1], [0.15, 0.22], [0.11, 0.4], [0.085, yM - 0.1], [0.12, yM - 0.04], [0.12, yM + 0.05], [0, yM + 0.12]],
        G.mt(mx, 0, mz), col.bronze, { seg: 12 });
      G.rod(staticB, [mx, yM, mz], [Cb[0], yM, Cb[2]], 0.06, col.bronze);
      G.rod(staticB, [mx, yM - 0.75, mz], vmad([mx, yM, mz], vsub([Cb[0], yM, Cb[2]], [mx, yM, mz]), 0.7), 0.03, col.brass);
      G.ball(staticB, [Cb[0], yM, Cb[2]], 0.085, col.bright, { ws: 10, hs: 7 });
      shadowAt = [mx, mz, 1.1];
    } else {
      G.lathe(staticB, [[0.44, 0], [0.44, 0.045], [0.3, 0.1], [0.14, 0.2], [0.095, 0.33], [0.075, Cb[1] - 0.1], [0.11, Cb[1] - 0.05], [0.11, Cb[1] + 0.02], [0, Cb[1] + 0.045]],
        G.mt(Cb[0], 0, Cb[2]), col.bronze, { seg: 12 });
      shadowAt = [Cb[0], Cb[2], 1.2];
    }
    if (bevel) {
      const p1 = vmad(apex, dn, Rc), p2 = vmad(p1, crankZ, vdot(vsub(bearing, apex), crankZ));
      G.rod(staticB, ends[0], p1, 0.03, col.bronze);
      G.rod(staticB, p1, p2, 0.03, col.bronze);
      G.rod(staticB, p2, bearing, 0.03, col.bronze);
      G.ball(staticB, p1, 0.04, col.bright, { ws: 6, hs: 5 });
      G.ball(staticB, p2, 0.04, col.bright, { ws: 6, hs: 5 });
    } else {
      G.rod(staticB, Bp[0], bearing, 0.036, col.bronze);
    }
  }

  // ---- 当たり形状（見えない球：鏡とハンドル）----
  const hit = new THREE.Group();
  hit.name = cfg.id + '-hit';
  const hMirror = new THREE.Mesh(ctx.hitGeo, mats.hit);
  hMirror.position.set(c[0], c[1], c[2]);
  hMirror.scale.setScalar(0.62);
  const hWheel = new THREE.Mesh(ctx.hitGeo, mats.hit);
  hWheel.position.set(wheelCenter[0], wheelCenter[1], wheelCenter[2]);
  hWheel.scale.setScalar(0.5);
  hMirror.visible = hWheel.visible = false;
  hit.add(hMirror, hWheel);
  ctx.root.add(hit);

  // ---- ドラッグの向き：カメラに一番近い点が指についてくる向き ----
  // 軸 a まわりに dθ 回すと、カメラ側の点 (+Z) は a × Z = (a.y, −a.x, 0) の向きに動く
  let fx = a[1], fy = -a[0];
  const fl = Math.hypot(fx, fy);
  if (fl > 1e-3) { fx /= fl; fy /= fl; } else { fx = 1; fy = 0; }
  const drag = Math.abs(fx) >= Math.abs(fy) ? 'x' : 'y';
  const k = P.drive.crossGain;
  const gx = fx + k * fy, gy = fy - k * fx;
  // 輪を掴んだ時は、輪が指についてくる向き（右へ引くと時計回り）にする
  const wheelFlip = drag === 'x' && sigma * Math.sign(crankZ[2] || 1) * Math.sign(gx) < 0 ? -1 : 1;

  return {
    id: cfg.id, m, cfg, pivot, crank, crankMat, crankBase, sigma, ratio: z2 / z1,
    wheelCenter: new THREE.Vector3(...wheelCenter), mirrorCenter: new THREE.Vector3(...c),
    knobLocal: new THREE.Vector3(0, Rw, hw + 0.13),
    gx, gy, wheelFlip, drag, shadowAt, bevel, gear2M, gear2Spec, cones,
    handle: { id: cfg.id, object: hit, drag, enabled: true },
    // 状態
    theta: m.theta0, raw: m.theta0, target: m.theta0, phi: 0, tickAt: m.theta0, grabSign: 1, hint: 0, dim: 0,
  };
}
