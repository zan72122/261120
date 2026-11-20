// 機構の数式（純粋関数。THREE に依存しない）。
// hero の動きはすべてここの式を通る：歯車比、かさ歯車の円すい角、スライダ・クランク、
// ラック＆ピニオン、カム、遊星歯車。物理エンジンは使わない。

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const clamp01 = (x) => clamp(x, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
// 0→1 を少し行き過ぎてから戻す（ぱっと開く感じ）。x は 0..1
export const easeOutBack = (x) => { x = clamp01(x); const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

// ---- 歯車 ----
// 外歯車どうしのかみ合い。駆動側（歯数 z1）の角度 phi1、従動側（歯数 z2）の角度 phi2。
// どちらも「自分の軸まわり・相手との接点方向から測った、歯0の中心の角度」。
// 接点で駆動側の歯の中心と従動側の谷の中心が向かい合う： phi2 = π/z2 − phi1·z1/z2
export function meshAngle(phi1, z1, z2) { return Math.PI / z2 - phi1 * z1 / z2; }
export const pitchRadius = (m, z) => (m * z) / 2;
export const centerDistance = (m, z1, z2) => (m * (z1 + z2)) / 2;

// かさ歯車（軸角 sigma）。ピッチ円すい半角 d1, d2 と円すい距離 R。
//   tan d1 = sin Σ / (z2/z1 + cos Σ),  d2 = Σ − d1,  R = m·z1 / (2 sin d1)
export function bevelCones(m, z1, z2, sigma = Math.PI / 2) {
  const d1 = Math.atan2(Math.sin(sigma), z2 / z1 + Math.cos(sigma));
  const d2 = sigma - d1;
  const R = (m * z1) / (2 * Math.sin(d1));
  return { d1, d2, R };
}

// ---- スライダ・クランク（直線上のスライダ） ----
// クランク半径 r、連接棒 l (> r)、クランク角 phi（0 でスライダが最も遠い）。
//   s(phi) = r cos phi + sqrt(l² − r² sin² phi)   … クランク中心からスライダのピンまで
export function sliderPos(phi, r, l) {
  const sn = Math.sin(phi);
  return r * Math.cos(phi) + Math.sqrt(Math.max(l * l - r * r * sn * sn, 1e-9));
}
// 開き率 u = (s_max − s) / (2r)  （0 = 閉、1 = 全開）
export function bloomRatio(phi, r, l) { return clamp01((l + r - sliderPos(phi, r, l)) / (2 * r)); }
// ラック＆ピニオン：ラックの移動 ds → ピニオン（ピッチ半径 rho）の回転 ds / rho。
// 全ストローク 2r で花びらが alphaMax 開くピッチ半径は rho = 2r / alphaMax。
export const rackPinionRadius = (r, alphaMax) => (2 * r) / alphaMax;

// ---- カム ----
// 山が k 個の調和カム。従動節の持ち上げ量 y(phi) = hmax · (1 − cos(k·phi)) / 2
export function camLift(phi, hmax, k) { return (hmax * (1 - Math.cos(k * phi))) / 2; }
// カムの輪郭（極座標）。基円 rb に持ち上げ量を足したもの
export function camRadius(psi, rb, hmax, k) { return rb + camLift(psi, hmax, k); }

// ---- 遊星歯車（太陽歯車は固定、腕＝キャリアが回る） ----
// 遊星の自転角（絶対）= キャリア角 · (1 + zs/zp)
export const planetSpin = (carrier, zs, zp) => carrier * (1 + zs / zp);
// k 番目（全 n 個）の遊星の、世界から見た歯0の角度。太陽歯車の歯0が角度0にあるとき、かみ合いが合う位相。
export function planetToothAngle(carrier, k, n, zs, zp) {
  const th = carrier + (TAU * k) / n;
  return th * (1 + zs / zp) + Math.PI - Math.PI / zp;
}

// 角度を near に最も近い π 周期の値にする（鏡は両面なので θ と θ+π は同じ）
export function nearestHalfTurn(th, near) {
  let d = (th - near) % Math.PI;
  if (d > Math.PI / 2) d -= Math.PI;
  if (d < -Math.PI / 2) d += Math.PI;
  return near + d;
}
