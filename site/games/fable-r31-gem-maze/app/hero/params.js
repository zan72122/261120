// hero の全パラメータ。部品はここの寸法・歯数・角度から作る（寸法の直書きをしない）。
// 単位：1 = 約 10cm、角度はラジアン。HERO-SPEC §7 の初期値から変えた所は docs/hero-notes.md に書いた。
const DEG = Math.PI / 180;

export const P = {
  G: [0, 1.75, 0],          // ジンバル中心（ワールド）
  s: 0.42,                  // レール格子の間隔
  h: 0.56,                  // 立方体の骨組みの半辺

  ring: {
    R: [1.44, 1.26, 1.08],  // 外・中・内リングの中心線半径
    t: [0.065, 0.06, 0.055],// 管の半径
    band: 0.09,             // ヒット代理の管半径（幅 0.18 ≈ 44px）
    colors: [0xff5c9a, 0xffc21f, 0x2fc7a0],   // 外：ピンク、中：きいろ、内：ミント
    stud: { count: [16, 12, 12], r: 0.022 },  // 前後の面の飾り鋲（外周はローラーが通るので付けない）
    grip: [0.0, 0.085, 0.08],                 // 中・内リングの握り玉（＝軸受け）の半径
    handle: { angle: 45 * DEG, stem: 0.05, ball: 0.07 }, // 外リングの正面ハンドル
    pin: 0.028,             // リングどうしをつなぐピンの半径
  },

  roller: { r: 0.12, angle: 33 * DEG, flange: 0.03, halfWidth: 0.078 }, // 溝の底の半径 r、底からの角度
  base: { rBottom: 0.99, rSide: 1.02, rTop: 0.965, height: 0.18 },
  tray: { r0: 0.78, r1: 0.985, yLow: 0.2, yHigh: 0.37, halfArc: 37 * DEG, lampGap: 0.2, lampR: 0.06 },

  frame: { bar: 0.02, corner: 0.036 },
  rail: { r: 0.019, hub: 0.036, glowR: 0.046 },
  gem: { r: 0.075, colors: [0xff3d7f, 0x3d8bff, 0x2fd67a, 0xffb520, 0xa55cff, 0x22cfe0] },

  // 切替：ノブ → 中間歯車 → 回転台。θ_t = θ_k·z_k/z_t、θ_i = −θ_k·z_k/z_i
  gear: {
    zk: 12, zi: 10, zt: 24, m: 0.02, pressure: 20 * DEG, thickness: 0.03,
    knobDir: -45 * DEG,     // 回転台から見たノブの方向（前面の右下の角）
    knobDist: 0.552,        // 回転台の中心からノブの軸まで（≤ 歯車の中心距離の和 0.56）
    ringInner: 0.185,       // 回転台の歯車は輪（内側が抜けている）
  },
  knob: { r: 0.105, wing: 0.27, lift: 0.1, hit: 0.2, tapTime: 0.6, color: 0x9b7bff },

  chest: { size: 0.3, bodyTop: 0.06, lidRise: 0.09, open: 110 * DEG, openTime: 0.45, funnel: 0.058, color: 0x8f6ae6, lidColor: 0xb18cff },

  // 宝石の運動（レールに拘束）
  phys: {
    A: 3.0,                 // 加速度 = A·(g·e) − μ
    mu: 0.4,
    vMax: 1.4,
    vMin: 0.22,             // 辺の途中では止まらない（必ず次のノードまで進む）
    thr: 0.72,              // g·e がこれを超えたら動き出す（> cos45° なので向きは常に 1 つに決まる）
    cMin: 0.3,              // 辺に乗ったあとの最小の駆動（重力が横を向いても惰性で進む）
    keepStraight: 0.92,     // ノードをまっすぐ通るときの速度の倍率
    keepTurn: 0.8,          // 曲がるとき
    clear: 0.4,             // 出発した宝石が辺のこの割合まで進むと、後ろの宝石がそのノードへ入れる
    sinkAt: 0.6, goneAt: 0.86, // 宝箱へ入る辺：縮み始める位置／回収の位置
  },

  // 回し方（HERO-SPEC §4）
  rotor: {
    follow: 14, settle: 5, maxW: 2.5, coast: 3, settleBelow: 0.6, autoW: 1.0, reverseGap: 0.5,
    commit: 0.26,           // つかんだ刻みからこれ以上（約 15°）回して離すと、その向きの次の刻みへ進む。0 で無効（最寄りだけ）
    farSide: 0.5,           // つかんだ点が球の奥（(p−C)·レイ > farSide·R）なら向こう側の交点で追う。0 で無効（§4 そのまま）
  },

  hint: { glowLo: 0.1, glowHi: 0.6, wiggle: 4 * DEG, after: 2.0 },
  finale: { minWait: 0.9, show: 2.3, orbitY: 0.8, orbitR: 0.36, orbitW: 1.2 },
};

export const TAU = Math.PI * 2;
export const QUARTER = Math.PI / 2;
