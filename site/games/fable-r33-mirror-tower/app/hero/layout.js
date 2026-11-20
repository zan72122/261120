// 配置と寸法のパラメータ（ここを変えると形も連動も変わる）。単位：メートル・秒・ラジアン。
// 座標：+Y 上、+Z 手前（カメラ側）、原点は床の中心（docs/HERO-SPEC.md §1）。
// 純粋データ＋導出（THREE に依存しない）。
import { v3, sub, cross, norm, dot, addScaled, aimAngle } from './optics.js';

const DEG = Math.PI / 180;

export const PARAMS = {
  world: { radius: 4.2, height: 7.6, floor: 0, front: 2.0, side: 4.4, skyExtra: 3.0, maxBounces: 5, maxLength: 30 },

  beam: {
    radius: 0.05,             // 光のロッドの半径
    growSpeed: 6,             // 先端が伸びる速さ m/s
    wakeSeconds: 0.6,         // 照らされ続けて起きるまで
    // 区間ごとの色（鏡で跳ね返るたびに色相が少しずれる）
    colors: [0xfff2a8, 0xffc4dc, 0xb0ecff, 0xcfffb8, 0xe6ccff, 0xffd9a8],
  },

  drive: {
    dragTurn: Math.PI,        // キャンバス高さ 1.0 のドラッグ = 鏡 180°
    crossGain: 0.3,           // 主方向と直交するドラッグも少しだけ効かせる（小さな指向け）
    maxSpeed: 90 * DEG,       // 鏡の角速度の上限（酔い防止）
    follow: 8,                // 目標角への追従の速さ 1/s
    coast: 0.35,              // 離した時の速度 × この秒数だけ惰性で進む
    detent: 7 * DEG,          // 離した時、狙いの角度がこの範囲にあれば「カチッ」と止まる
    hintRock: 4 * DEG,        // 合図でハンドルを揺らす角度
  },

  // 鏡を回す歯車対（ハンドル側 z1、鏡側 z2）。θ鏡 = −σ·φハンドル·z1/z2
  gearing: { module: 0.035, z1: 12, z2: 24, face: 0.09 },
  crank: { wheelRadius: 0.36, rimTube: 0.034, spokes: 5, knobRadius: 0.075 },
  mirror: { frameBar: 0.07, frameDepth: 0.07, glassDepth: 0.024, shaftRadius: 0.042 },

  lamp: { p0: [-2.9, 1.5, 0.5], d0: [1, 0, 0], radius: 0.35, rays: 12, rayLength: 0.3 },

  // 鏡。kind: turntable = 縦軸の回転台、yoke = 横軸のフォーク（hang: 上から吊る）
  // aims: この鏡から光を届けたい相手（受け手 or 次の鏡）。回転軸はこの相手から導く。
  // initToward: 最初に反射光が向かう点（どの受け手にも当たらない向き）
  mirrors: [
    { id: 'mirror-1', kind: 'turntable', c: [2.7, 1.5, 0.5], across: 1.0, along: 1.3, aims: ['pillar', 'mirror-2'], initToward: [3.22, 1.5, -2.46] },
    { id: 'mirror-2', kind: 'yoke', c: [2.0, 1.5, -2.2], across: 1.0, along: 1.2, aims: ['gem', 'mirror-3'], initToward: [1.62, 4.1, -3.65] },
    { id: 'mirror-3', kind: 'yoke', hang: true, mast: [2.0, -3.15], c: [2.0, 5.4, -2.2], across: 1.0, along: 1.2, aims: ['flower', 'mirror-4'], initToward: [-0.6, 7.0, 0.2] },
    { id: 'mirror-4', kind: 'turntable', c: [-1.5, 5.4, 1.15], across: 1.0, along: 1.3, aims: ['crown'], initToward: [-3.4, 5.4, -2.5] },
  ],

  // 受け手。起きる順のおすすめ（合図と debugAdvance の順）もこの並び。
  pillar: {
    id: 'pillar', base: [-2.8, 0, -1.9], drums: 7, drumRadius: 0.3, drumHeight: 0.26, firstDrumY: 0.52, gap: 0.03,
    drumTeeth: 12, hitRadius: 0.36, stepDelay: 0.16,
    colors: [0xff6f91, 0xff9a5c, 0xffd35c, 0x8fe07a, 0x5cd6c8, 0x6fa8ff, 0xb48cff],
    cam: { baseRadius: 0.1, lift: 0.13, lobes: 2, zMotor: 10, zCam: 20, module: 0.02, motorSpeed: 220 * DEG },
    pitch: 0,
  },
  gem: {
    id: 'gem', along: 0.55, y: 3.6,   // 鏡1→鏡2 の線の上（鏡2 の回転面の中）
    radius: 0.3, facets: 8, crownAngle: 34 * DEG, pavilionAngle: 41 * DEG, table: 0.55,
    tilt: 25 * DEG, hitRadius: 0.4,
    zMotor: 12, zGem: 36, module: 0.02, motorSpeed: 150 * DEG,   // ω宝石 = ωモーター·zMotor/zGem = 50°/秒
    postOffset: 1.05, pitch: 4,
  },
  flower: {
    id: 'flower', along: 3.3, y: 3.1,  // 鏡3→鏡4 の線の下（鏡3 の回転面の中）
    scale: 0.8, petals: 8, tilt: 20 * DEG, hitRadius: 0.42, color: 0xff8fb8, color2: 0xffa6c8, pitch: 7, view: 'low',
  },
  crown: {
    id: 'crown', c: [0, 5.4, -2.35],
    scale: 1.1, petals: 10, tilt: 30 * DEG, hitRadius: 0.5, color: 0xffcf5a, color2: 0xff9ec4, pitch: 12,
    // 遊星歯車：太陽（固定）zs、遊星 zp、n 個。ω遊星 = ωキャリア·(1 + zs/zp)
    planet: { module: 0.05, zs: 26, zp: 12, count: 5, planeY: -0.3, face: 0.07, gemRadius: 0.15, speedAwake: 6 * DEG, speedFinale: 18 * DEG },
  },

  // 花の機械（scale=1 の寸法。花の原点＝花びらのちょうつがいの輪の中心、+Y＝花の軸）
  flowerMachine: {
    petalLength: 1.0, petalWidth: 0.25, petalBulge: 0.17, petalCup: 0.3,
    hingeRadius: 0.233, alphaMax: 80 * DEG,
    crankRadius: 0.10, rodLength: 0.34, crankY: -0.62, crankZ: 0.17, discRadius: 0.16,
    tubeRadius: 0.065, tubeBottom: -1.5, rackModule: 0.022,
    openSeconds: 1.3, breatheAmp: 0.55, breatheHz: 0.22,
  },

  // 見せ場の後光（てっぺんの花の後ろの光条。横長のだ円に並ぶ）
  burst: { rays: 14, radius: 1.25, long: 0.9, short: 0.5, squash: 0.62, back: 0.7, spin: -0.2 },

  // 見せ場：光路を流れる光の玉と、てっぺんの花から噴き出す光の粒（放物線 p = p0 + v·τ − g·τ²/2 を式で）
  flow: { beads: 10, speed: 3.2, radius: 0.11 },
  fountain: { sparks: 36, period: 2.0, gravity: 3.6, up: [2.1, 2.9], out: [0.4, 1.3], radius: 0.09, depthSquash: 0.55 },

  finaleSeconds: 7,
};

// 受け手の当たりの中心と、鏡の回転軸・基準法線・最初の角度を導く
export function deriveLayout(P = PARAMS) {
  const V = (a) => v3(a[0], a[1], a[2]);
  const byId = {};
  const mirrors = P.mirrors.map((cfg, index) => {
    const m = { id: cfg.id, index, cfg, c: V(cfg.c), halfU: cfg.across / 2, halfA: cfg.along / 2, a: v3(), n0: v3(), b: v3(), n: v3(), u: v3() };
    byId[cfg.id] = m;
    return m;
  });
  const [m1, m2, m3] = mirrors;

  // 宝石：鏡1→鏡2 の線上（水平位置）、高さ y
  const g = P.gem;
  const gemC = v3(m1.c.x + (m2.c.x - m1.c.x) * g.along, g.y, m1.c.z + (m2.c.z - m1.c.z) * g.along);
  // 花：鏡3→鏡4 の水平方向に along メートル、高さ y
  const m4 = mirrors[3];
  const h3 = norm(v3(m4.c.x - m3.c.x, 0, m4.c.z - m3.c.z));
  const f = P.flower;
  const flowerC = v3(m3.c.x + h3.x * f.along, f.y, m3.c.z + h3.z * f.along);
  const crownC = V(P.crown.c);
  const p = P.pillar;
  const pillarTop = p.firstDrumY + p.drums * (p.drumHeight + p.gap);
  const receivers = [
    { id: p.id, shape: 'cylinder', c: v3(p.base[0], 0, p.base[2]), r: p.hitRadius, y0: p.firstDrumY - 0.1, y1: pillarTop, aim: v3(p.base[0], P.lamp.p0[1], p.base[2]), cfg: p },
    { id: g.id, shape: 'sphere', c: gemC, r: g.hitRadius, aim: gemC, cfg: g },
    { id: f.id, shape: 'sphere', c: flowerC, r: f.hitRadius, aim: flowerC, cfg: f },
    { id: P.crown.id, shape: 'sphere', c: crownC, r: P.crown.hitRadius, aim: crownC, cfg: P.crown },
  ];
  for (const r of receivers) byId[r.id] = r;

  const lamp = { p0: V(P.lamp.p0), d0: norm(V(P.lamp.d0)) };
  lamp.origin = addScaled(lamp.p0, lamp.d0, P.lamp.radius);
  const aimPoint = (id) => (byId[id].aim || byId[id].c);

  // 入射方向（設計上）：ランプ→鏡1、鏡k→鏡k+1 は中心どうし
  mirrors.forEach((m, i) => {
    m.dIn = i === 0 ? v3(lamp.d0.x, lamp.d0.y, lamp.d0.z) : norm(sub(m.c, mirrors[i - 1].c));
    m.targets = m.cfg.aims.map((id) => ({ id, point: aimPoint(id), dOut: norm(sub(aimPoint(id), m.c)) }));
    // 回転軸：必要な法線 (t − d) がすべて軸に垂直になる向き。a ∝ (t1 − d) × (t2 − d)
    const q1 = sub(m.targets[0].dOut, m.dIn);
    let a;
    if (m.targets.length > 1) a = norm(cross(q1, sub(m.targets[1].dOut, m.dIn)));
    else { const up = v3(0, 1, 0); const k = dot(up, norm(q1)); a = norm(addScaled(up, norm(q1), -k)); } // 相手が1つなら、できるだけ縦
    if (m.cfg.kind === 'turntable') { if (a.y < 0) { a.x = -a.x; a.y = -a.y; a.z = -a.z; } }
    else if (a.z < 0 || (Math.abs(a.z) < 1e-6 && a.x > 0)) { a.x = -a.x; a.y = -a.y; a.z = -a.z; } // フォーク：+a がカメラ側（歯車の付く端）
    m.a = a;
    // 基準法線 n0 ⟂ a：回転台はカメラ向き、フォークは上向き
    const ref = m.cfg.kind === 'turntable' ? v3(0, 0, 1) : v3(0, 1, 0);
    m.n0 = norm(addScaled(ref, a, -dot(ref, a)));
    m.b = cross(a, m.n0);
    for (const t of m.targets) t.theta = aimAngle(m, m.dIn, t.dOut, 0);
    const init = aimAngle(m, m.dIn, norm(sub(V(m.cfg.initToward), m.c)), 0);
    m.theta0 = init === null ? 0.3 : init;
  });

  // 受け手ごとの「答え」：通る鏡と、それぞれの狙う相手
  const plans = {};
  mirrors.forEach((m, i) => {
    for (const t of m.targets) {
      if (byId[t.id].shape) {
        const chain = [];
        for (let k = 0; k < i; k++) chain.push({ mirror: k, to: mirrors[k + 1].id });
        chain.push({ mirror: i, to: t.id });
        plans[t.id] = chain;
      }
    }
  });
  return { mirrors, receivers, lamp, plans, byId, h3 };
}
