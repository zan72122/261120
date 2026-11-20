// 主役の仕掛けのパラメータ（寸法・歯数・角度・ばね）。部品はすべてここから生成する。
// 単位：メートル・秒・ラジアン。+Y 上、+X 右、+Z 手前。docs/HERO-SPEC.md §2・§7 の初期値が出発点。
import { DEG, TAU } from './util.js';

export const STAGES = ['whisk', 'pour', 'load', 'close', 'bake', 'open', 'wobble', 'scoop', 'finale'];
// bake だけは定位置より寄る（窓の中でふくらむ様子が主役なので）。HERO-SPEC §2「例外的に使う」
export const BAKE_VIEW = { position: [0.47, 0.33, 0.68], target: [0.47, 0.135, 0.0] };
export const VIEW = { whisk: 'mixer', pour: 'pour', load: 'counter', close: 'oven', bake: BAKE_VIEW, open: 'counter', wobble: 'serve', scoop: 'serve', finale: 'wide' };
export const TARGET_OF = { whisk: 'crank', pour: 'bowl', load: 'ramekin', close: 'door', bake: 'knob', open: 'door', wobble: 'souffle', scoop: 'spoon' };

export const P = {
  // ---- 配置（ワールド） ----
  MIXER: [-0.34, 0, 0.0],          // ボウルの底の中心（泡立て中）
  OVEN: [0.48, 0, -0.08],          // オーブンの底の中心

  // ---- 色 ----
  col: {
    enamel: 0xf2879f,              // ミキサー（いちご色のほうろう）
    enamelDark: 0xd9607d,
    cream: 0xfff3dc,
    brass: 0xe0b45a,
    steel: 0xdfe4ea,
    iron: 0x4a4f58,
    oven: 0x7fd0d2,                // オーブン（ミント水色のほうろう）
    ovenIn: 0x33241d,
    red: 0xe8483f,
    glow: 0xffc861,                // 次に触る部品の脈動の色
    heat: 0xff5a1e,
    liquid: 0xffe072,              // 泡立てる前（うすい黄色）
    foam: 0xf8f4ea,                // 泡立てた後（白）
    inside: 0xffe59a,              // スフレの中（気泡の断面）
  },

  // ---- ミキサー（手回しの遊星ミキサー）。寸法はミキサーのローカル座標（原点＝MIXER） ----
  mixer: {
    base: { x0: -0.16, x1: 0.215, z0: -0.262, z1: 0.115, h: 0.018, r: 0.05 },
    columnW: 0.05,
    hingeY: 0.272, hingeZ: -0.19,  // チルトヘッドの蝶番（X 軸）
    liftMax: 50 * DEG,             // pour で頭を上げる角度
    shaftY: 0.30,                  // 横軸（X 軸）とクランク軸（Z 軸）の高さ
    crankX: 0.17,                  // クランク軸の x（縦軸は x=0, z=0）
    ringY: 0.203, ringT: 0.012,    // 固定内歯車の下面の高さと厚み
  },
  gear: {
    Z1: 40, m: 0.0022,             // 冠歯車（クランクと同軸）：ピッチ半径 r1 = m·Z1/2 = 0.044
    Z2: 10,                        // ピニオン（横軸）：縦軸はクランク 1 回転で Z1/Z2 = 4 回転
    faceW: 0.009,                  // 冠歯車の歯幅
    Zb: 16, mb: 0.002,             // かさ歯車（1:1、横軸→縦軸）
    Zr: 48, Zp: 12,                // 固定内歯車と遊星歯車：自転 = 公転·(1 − Zr/Zp) = −3·公転
    Rc: 0.035,                     // 公転半径（＝ (Zr−Zp)/2 × 遊星のモジュール）
  },
  crank: {
    Lc: 0.075, gripR: 0.014, gripL: 0.05,
    w0: 14, zeta: 0.7,             // 指の角度を追うばね
    coastTau: 0.35,                // 離した後の惰性の時定数
    turns: 6,                      // 泡立て完了までの回転数
    tapTurn: 0.75 * TAU, tapTime: 0.8, // タップ 1 回の自動回転
    hitR: 0.10,
  },
  whisk: { Nw: 8, rw: 0.032, hw: 0.11, wire: 0.0013, tipY: 0.041, collarR: 0.007 },

  // ---- ボウル（銅）とそり ----
  bowl: {
    Rr: 0.136, Rf: 0.066,          // 内側の半径：上端・底
    depth: 0.10, thk: 0.004,       // 深さ・肉厚（外径 0.14）
    e: 1.6,                        // 壁の曲線 y = depth·((r−Rf)/(Rr−Rf))^e
    roll: 0.0035,                  // 縁の巻きの半径
    lip: 0.014,                    // 注ぎ口の出っ張り
    segs: 64,
    baseY: 0.032,                  // ボウルの底の高さ（そりの上面）
    travel: 0.10,                  // そりが +X へ出る距離（泡立て器の下 → 注ぐ位置）
    spoutYaw: 22.4 * DEG,          // 注ぎ口の向き（+X から +Z へ）
    tiltMax: 60 * DEG,
    flowStart: 25 * DEG, flowFull: 55 * DEG, flowRate: 0.45, // p' = flowRate·smoothstep(25°,55°,φ)
    dragGain: 60 * DEG / 170,      // 指の移動（px）→ 傾き
    w0: 7, zeta: 0.75,
    pourDist: 0.222,               // ボウル中心 → ココット中心（注ぐとき）
  },
  batter: {
    NR: 24, NS: 64,                // 表面の格子（半径 × 周）
    h0: 0.030, h1: 0.045,          // 高さ h(w) = h0 + h1·smoothstep(w)
    waveA: 0.009,                  // うねりの振幅（×(1−w)×速さ）
    rep0: 1.5, rep1: 5.5,          // 泡の細かさ rep(w) = rep0 + rep1·w
    uvSize: 0.30,                  // foam テクスチャ 1 枚ぶんの長さ（rep=1 のとき）
    peakH: 0.046,                  // 角の高さ ×k(w)、k = smoothstep(0.7,1,w)（仕様の 0.035 より少し高く：画面で小さかった）
    peakR: 0.03,
  },

  // ---- ココット・台車・レール ----
  ramekin: { Ro: 0.052, Ri: 0.044, H: 0.054, floor: 0.006, ribs: 24, foot: 0.046 },
  cart: {
    L: 0.118, W: 0.10, plateT: 0.006,
    gauge: 0.112, wheelR: 0.012, wheelT: 0.006, axleX: 0.036,
    railR: 0.002, railTop: 0.007,  // カウンター上のレール上面の高さ（出発点）
    deckH: 0.020,                  // レール上面 → 台車の上面
    loadTime: 2.2, outTime: 2.0,
    serveS: 0.059,                 // 取り出した後に止まる位置（レール沿いの距離）
  },

  // ---- スフレ（ココットの中の生地 → ドーム） ----
  souffle: {
    NR: 22, NS: 48,
    H0: 0.012, H1: 0.055,          // ドームの高さ H(b) = H0 + H1·smoothstep(0.05,0.85,b)（縁から上）
    flare: 1.22,                   // 縁の上でのはみ出し（マフィン形）
    wobK: 180, wobC: 6,            // ぷるぷる x'' = −k·x − c·x'
    scoopR: 0.026,                 // すくった跡（球）の半径
    insideRep: 22,
  },

  // ---- オーブン（寸法はオーブンのローカル座標、原点＝OVEN） ----
  oven: {
    W: 0.44, H: 0.30, D: 0.34, foot: 0.012, r: 0.028,
    cav: { x0: -0.20, x1: 0.10, y0: 0.020, y1: 0.262, zBack: -0.15 },
    railTop: 0.035,                // 庫内のレール上面
    zIn: 0.04,                     // 焼くときの台車の位置（オーブンローカル z）
    door: { w: 0.32, h: 0.238, t: 0.018, open: 85 * DEG, winHW: 0.115, winU0: 0.066, winU1: 0.198, arcR: 0.14, w0: 9, zeta: 0.55, bounce: 0.25 },
    knob: { x: 0.17, y: 0.150, r: 0.03, t: 0.022, grooves: 12, w0: 16, zeta: 0.8, turns: 4, clickDeg: 30, hitR: 0.085 },
    rods: 9,
  },

  spoon: { Rs: 0.024, depth: 0.008, len: 0.13 },
};

// パラメータから決まる量（歯車比・位置）
export function derive(p) {
  const g = p.gear, b = p.bowl, o = p.oven, d = o.door;
  const D = {};
  D.r1 = g.m * g.Z1 / 2;                       // 冠歯車のピッチ半径
  D.r2 = g.m * g.Z2 / 2;                       // ピニオン
  D.rb = g.mb * g.Zb / 2;                      // かさ歯車
  D.mp = g.Rc / ((g.Zr - g.Zp) / 2);           // 遊星のモジュール（公転半径から逆算）
  D.rr = D.mp * g.Zr / 2;                      // 内歯車
  D.rp = D.mp * g.Zp / 2;                      // 遊星
  D.zf = -(D.r2 + 1.25 * g.m);                 // 冠歯車の歯の面（前面）の z。ピニオンの軸は z=0
  // 連動：クランク角 θc → 横軸 θh → 縦軸（キャリア） θs → 泡立て器の自転（キャリアに対して）
  D.kH = -g.Z1 / g.Z2;                         // θh = kH·θc（噛み合いの向きで負）
  D.kS = D.kH;                                 // θs = θh（かさ歯車 1:1）
  D.kP = -g.Zr / g.Zp;                         // キャリアに対する遊星の回転 = kP·θs（絶対では (1 − Zr/Zp)·θs）

  // ボウル（ボウルのローカル：原点＝外側の底の中心、注ぎ口は +X）
  D.bowlTop = b.thk + b.depth;                 // 縁の高さ
  D.pivR = b.Rr + b.thk + 0.004;               // 傾きの軸（注ぎ口の下のピン）
  D.pivY = D.bowlTop - 0.012;
  D.lipR = b.Rr + b.thk + b.lip * 0.8;         // 注ぎ口の先
  D.sx = Math.cos(b.spoutYaw); D.sz = Math.sin(b.spoutYaw);
  D.bowlOut = [p.MIXER[0] + b.travel, 0, p.MIXER[2]];
  D.pourAt = [D.bowlOut[0] + D.sx * b.pourDist, 0, D.bowlOut[2] + D.sz * b.pourDist]; // ココットの出発点

  // オーブンの扉（下の蝶番）。開いた扉の内側のレールが、庫内のレールと同じ高さでつながるように蝶番の高さを決める。
  const rr = p.cart.railR;
  D.doorRailW = -(d.t / 2 + 2 * rr);           // 扉ローカル（閉じたとき奥向き）でのレール上面
  D.hingeY = o.railTop + D.doorRailW * Math.sin(d.open);
  D.hingeZ = o.D / 2 + d.t / 2;
  D.cavX = (o.cav.x0 + o.cav.x1) / 2;          // 庫内の中心 x（オーブンローカル）
  D.hingeW = [p.OVEN[0] + D.cavX, D.hingeY, p.OVEN[2] + D.hingeZ]; // 蝶番の中心（ワールド）
  D.inOven = [p.OVEN[0] + D.cavX, o.railTop, p.OVEN[2] + o.zIn];
  return D;
}
