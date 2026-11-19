// fish.js — 写実的な金魚（和金・更紗・琉金）とその泳ぎ。
//
// ============================== 公開 API ==============================
// import { createFish, createSwimmer } from './fish.js'
//
// createFish(kind) -> fish        kind: 'wakin'（和金 全長6.5cm）| 'sarasa'（更紗 6cm）| 'ryukin'（琉金 7cm, 丸い太っちょ）
//   fish.group   THREE.Group。原点 = 体（尾びれを除く胴）の中心。頭が +X、背が +Y、魚の右側が +Z。
//                子に inner（つぶし用スケール）→ 胴・ひれ・目・口 が入る。group の position/rotation は外（または swimmer）が書く。
//   fish.kind    'wakin' | 'sarasa' | 'ryukin'
//   fish.length  全長 m（尾びれ先まで）
//   fish.radius  当たり判定の目安 m（球）
//   fish.mouth   Object3D: 口先（inner のローカル）。world 位置は fish.mouth.getWorldPosition(v)
//   fish.swim    0..1 泳ぐ強さ（外から書く。swimmer が毎フレーム書く）。既定 0.3
//   fish.turn    -1..1 曲がり（+ = 左 = 上から見て反時計回りへ曲がる）。既定 0
//   fish.update(dt, t)  ひれ・体のくねり（頭は安定、尾ほど振幅が大きい S 字）・胸びれ・えらの呼吸・口のぱくぱく・目の追従。
//                       同じ t で 2 回呼ばれても 2 回目は何もしない（swimmer.update も内部で呼ぶので二重呼び出しは無害）。
//   fish.gulp()         口をぱくっと開ける（約 0.35 秒）
//   fish.lookAt(worldPos | null)  瞳がその方向をわずかに追う（最大 ~0.35rad）。null で正面
//   fish.setSquash(v)   0..1 体が前後につぶれて太る（鉢の口につかえる演出）。inner.scale で行う
//   fish.setMurk(color, amount)   にごり色に少し寄せる（材質色の乗算、amount*0.45）。水の層だけで十分なら呼ばなくてよい
//   fish.setVisible(bool)
//   ※ 透明なひれは depthWrite=false。fish.update が毎フレーム world z から renderOrder を
//     water.js の murkOrderForZ(z) で決める（にごりの層の間に差し込まれる。水槽外でも 19.5 前後で安全）。
//   fish.finOrder  null | number。number を入れると ひれの renderOrder をその値に固定（水槽の水の外では 40 = にごり・水面・コケ(30)より後、
//                  前面ガラス(45)・鉢(50+)より前）。null で murkOrderForZ（既定）。story が水の内外で毎フレーム切り替える。
//   ※ 胴・目は不透明 MeshPhysicalMaterial。胴は castShadow=true。
//
// createSwimmer(fish, opts?) -> swimmer   泳ぎの挙動。fish.group は scene 直下（親が単位行列）にある前提で world 座標を書く。
//   opts: { speed=1, seed }  初期位置は作成時の fish.group.position
//   swimmer.setBounds({ min: Vector3, max: Vector3 })            world AABB（水槽: L.swim + 水面-0.02 を上限に）
//   swimmer.setSphereBounds(center: Vector3, radius, maxY)       金魚鉢の中（球の内側 かつ y <= maxY）
//   swimmer.mode   'wander' | 'seek' | 'watch' | 'held'（説明は下）。既定 'wander'
//       wander: 気ままに泳ぐ。ときどき止まる・向きを変える・底をつつく（つつく時 gulp）
//       seek:   swimmer.target へ向かい、近づくと減速して周りをゆっくりうろうろ（えさ・泡に寄る）
//       watch:  その場でホバリングし target の方へ体ごと向き、瞳で見つめる
//       held:   位置・回転を一切書かない（外が fish.group を動かす）。ひれだけ動く（fish.swim は外から書いてよい）
//   swimmer.target   THREE.Vector3（world）
//   swimmer.speed    基本速度の倍率（既定 opts.speed ?? 1）
//   swimmer.startle(fromWorldPos, strength=1)   ぴゅっと逃げて（~0.5秒）すぐ落ち着く。held 中は無視
//   swimmer.teleport(pos)        位置を即時に置き、速度リセット
//   swimmer.setHeading(yaw)      向き（rotation.y, 0 = +X 向き）を即時に設定
//   swimmer.heading              現在の yaw (rad)
//   swimmer.position             現在位置（THREE.Vector3, 読み取り用）
//   swimmer.speedNow             現在の速さ m/s
//   swimmer.arrived              seek で target から 0.03m 以内なら true
//   swimmer.update(dt, t)        速度・向きをなめらかに更新し fish.group に書き、fish.swim/turn を書いて fish.update を呼ぶ。
//                                壁の手前でやわらかく曲がる + 最後に境界へクランプ（壁抜けなし）。
//                                常にほぼ水平（ピッチ ±0.35rad 以内、上下移動で少し頭が上下）、旋回でわずかにロール。
// ======================================================================
import * as THREE from 'three';
import { L } from './layout.js';
import { murkOrderForZ } from './water.js';

void L; // 座標は呼び出し側が L から渡す（ここでは参照のみ）

// ---------- 小さな乱数・ノイズ ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440662683) ^ Math.imul(s | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, s);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3(x, y, z, s, oct = 4) {
  let a = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { a += amp * vnoise3(x * f, y * f, z * f, s + i * 17); n += amp; amp *= 0.5; f *= 2.03; }
  return a / n;
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 縦断面プロファイル（Hermite 補間）。pts: [s, top, bot, width, center]（SL 比）
function interp(pts, s, k) {
  const n = pts.length;
  if (s <= pts[0][0]) return pts[0][k];
  if (s >= pts[n - 1][0]) return pts[n - 1][k];
  let i = 0;
  while (s > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
  const h = p2[0] - p1[0];
  const tt = (s - p1[0]) / h;
  const m1 = ((p2[k] - p0[k]) / (p2[0] - p0[0])) * h;
  const m2 = ((p3[k] - p1[k]) / (p3[0] - p1[0])) * h;
  const t2 = tt * tt, t3 = t2 * tt;
  return (2 * t3 - 3 * t2 + 1) * p1[k] + (t3 - 2 * t2 + tt) * m1 + (-2 * t3 + 3 * t2) * p2[k] + (t3 - t2) * m2;
}

// ---------- 種類ごとの設定（長さは SL=体長 に対する比） ----------
const S_END = 1.05;
const WAKIN_PROF = [
  [0.00, 0.022, 0.020, 0.020, -0.012],
  [0.03, 0.044, 0.042, 0.038, -0.010],
  [0.08, 0.072, 0.070, 0.060, -0.004],
  [0.16, 0.106, 0.102, 0.086, 0.002],
  [0.27, 0.143, 0.130, 0.100, 0.006],
  [0.40, 0.165, 0.147, 0.105, 0.008],
  [0.55, 0.156, 0.136, 0.096, 0.005],
  [0.70, 0.120, 0.100, 0.071, 0.002],
  [0.82, 0.088, 0.075, 0.049, 0.001],
  [0.92, 0.070, 0.063, 0.035, 0.0],
  [1.00, 0.063, 0.059, 0.027, 0.0],
  [1.05, 0.020, 0.020, 0.010, 0.0],
];
const SARASA_PROF = WAKIN_PROF.map(([s, t, b, w, c]) => [s, t * 1.03, b * 1.03, w * 1.02, c]);
const RYUKIN_PROF = [
  [0.00, 0.024, 0.022, 0.024, -0.045],
  [0.03, 0.050, 0.046, 0.050, -0.044],
  [0.08, 0.090, 0.082, 0.086, -0.036],
  [0.15, 0.175, 0.140, 0.150, -0.020],
  [0.25, 0.315, 0.220, 0.208, 0.000],
  [0.38, 0.400, 0.282, 0.245, 0.012],
  [0.50, 0.392, 0.300, 0.245, 0.010],
  [0.62, 0.322, 0.262, 0.205, 0.004],
  [0.74, 0.215, 0.175, 0.140, 0.000],
  [0.86, 0.125, 0.100, 0.078, 0.0],
  [1.00, 0.080, 0.072, 0.040, 0.0],
  [1.05, 0.022, 0.022, 0.012, 0.0],
];

const KINDS = {
  wakin: {
    total: 0.065, SL: 0.046, prof: WAKIN_PROF, radius: 0.022,
    tail: { double: false, len: 0.41, spread: 0.52, fork: 0.42, hBase: 0.052, flut: 0.05, droop: 0.02 },
    dorsal: { s0: 0.38, s1: 0.74, h: 0.2 },
    pect: { s: 0.255, len: 0.2, wid: 0.105 },
    pelv: { s: 0.5, len: 0.15, wid: 0.075 },
    anal: { s0: 0.76, s1: 0.87, h: 0.13, double: false },
    eye: { s: 0.115, yf: 0.22, r: 0.05 },
    gillS: 0.235, freq: 1.0, amp: 1.0, scaleCols: 27, scaleRows: 22,
  },
  sarasa: {
    total: 0.06, SL: 0.042, prof: SARASA_PROF, radius: 0.02,
    tail: { double: false, len: 0.43, spread: 0.55, fork: 0.44, hBase: 0.054, flut: 0.06, droop: 0.03 },
    dorsal: { s0: 0.38, s1: 0.74, h: 0.22 },
    pect: { s: 0.255, len: 0.21, wid: 0.11 },
    pelv: { s: 0.5, len: 0.16, wid: 0.08 },
    anal: { s0: 0.76, s1: 0.87, h: 0.14, double: false },
    eye: { s: 0.115, yf: 0.22, r: 0.052 },
    gillS: 0.235, freq: 0.92, amp: 1.0, scaleCols: 27, scaleRows: 22,
  },
  ryukin: {
    total: 0.07, SL: 0.036, prof: RYUKIN_PROF, radius: 0.026,
    tail: { double: true, len: 0.94, spread: 0.62, fork: 0.36, hBase: 0.07, flut: 0.11, droop: 0.2, splay: 0.42 },
    dorsal: { s0: 0.33, s1: 0.70, h: 0.42 },
    pect: { s: 0.24, len: 0.25, wid: 0.13 },
    pelv: { s: 0.5, len: 0.21, wid: 0.1 },
    anal: { s0: 0.76, s1: 0.88, h: 0.2, double: true },
    eye: { s: 0.105, yf: 0.18, r: 0.064 },
    gillS: 0.215, freq: 0.68, amp: 0.75, scaleCols: 24, scaleRows: 24,
  },
};

// ---------- 色 ----------
const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
function bodyColor(kind, s, d, v, n, n2) {
  // d: 1=背 0=腹, n,n2: 0..1 ノイズ
  if (kind === 'wakin') {
    let c = mix3(C(0xe8903a), C(0xd23c10), sstep(0.08, 0.42, d));
    c = mix3(c, C(0x9a1c06), sstep(0.58, 1.0, d) * 0.85);
    // 頭の下（あご）は少し黄色、えらぶた周りは赤
    c = mix3(c, C(0xf2a050), sstep(0.18, 0.0, s) * sstep(0.45, 0.1, d) * 0.6);
    const k = 0.93 + 0.14 * n;
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  if (kind === 'sarasa') {
    const white = mix3(C(0xf4efe6), C(0xe9e2d6), n2 * 0.6);
    const red = mix3(C(0xd2361a), C(0xb8260f), sstep(0.6, 1, d) * 0.7);
    let bias = 0.30 * sstep(0.35, 0.95, d) - 0.55 * sstep(0.42, 0.08, d);
    bias += 0.30 * sstep(0.26, 0.12, s) * sstep(0.35, 0.8, d); // 頭の上は赤
    bias -= 0.6 * sstep(0.06, 0.0, s);                        // 口先は白
    bias -= 0.25 * sstep(0.85, 1.02, s);                      // 尾柄は白っぽい
    const r = sstep(0.47, 0.55, n + bias);
    const c = mix3(white, red, r);
    const k = 0.95 + 0.08 * n2;
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  // ryukin: 赤主体、腹と下側面に白
  const white = mix3(C(0xf5f0e8), C(0xeae2d4), n2 * 0.5);
  const red = mix3(C(0xe0461c), C(0xbe2c10), sstep(0.55, 1, d) * 0.8);
  let bias = 0.55 * sstep(0.12, 0.62, d) - 0.22;
  bias -= 0.35 * sstep(0.05, 0.0, s);
  const r = sstep(0.45, 0.53, n * 0.75 + 0.12 + bias);
  const c = mix3(white, red, r);
  const k = 0.94 + 0.1 * n2;
  return [c[0] * k, c[1] * k, c[2] * k];
}

function bodyTextures(kind, cfg, seed) {
  const W = 512, H = 256;
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  const bv = makeCanvas(W, H), bctx = bv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const bimg = bctx.createImageData(W, H);
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H, ang = Math.PI * 2 * v;
    const cy = Math.cos(ang), sy = Math.sin(ang);
    const d = 1 - Math.abs(v - 0.5) * 2;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W, s = u * S_END;
      const n = fbm3(s * 3.4, cy * 1.25 + 3, sy * 1.25, seed, 4);
      const n2 = fbm3(s * 14, cy * 5, sy * 5, seed + 99, 3);
      const col = bodyColor(kind, s, d, v, n, n2);
      const i = (py * W + px) * 4;
      img.data[i] = clamp(col[0], 0, 255); img.data[i + 1] = clamp(col[1], 0, 255); img.data[i + 2] = clamp(col[2], 0, 255); img.data[i + 3] = 255;
      const bb = 128 + (n2 - 0.5) * 18;
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = bb; bimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  // うろこの網目（尾側に向いた半円の縁）
  const rnd = mulberry32(seed * 7 + 3);
  const colsPerSL = cfg.scaleCols, rows = cfg.scaleRows;
  const cw = W / S_END / colsPerSL, ch = H / rows;
  const c0 = Math.floor((cfg.gillS - 0.06) * colsPerSL), c1 = Math.ceil(1.02 * colsPerSL);
  for (let c = c0; c <= c1; c++) {
    const s = c / colsPerSL;
    const fadeIn = 0.25 + 0.75 * sstep(cfg.gillS - 0.02, cfg.gillS + 0.12, s);
    for (let r = 0; r < rows; r++) {
      const cx = c * cw;
      const cyy = (r + (c % 2) * 0.5) * ch;
      for (const off of [-H, 0, H]) {
        const y = cyy + off;
        if (y < -ch || y > H + ch) continue;
        const rx = cw * 0.72, ry = ch * 0.68;
        // 色: 個々のうろこの明暗ゆらぎ（金属光沢のむら）
        const lv = rnd();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = `rgba(${lv > 0.5 ? 255 : 0},${lv > 0.5 ? 240 : 0},${lv > 0.5 ? 200 : 0},${(0.1 + 0.12 * Math.abs(lv - 0.5)) * fadeIn})`;
        ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        // 縁（暗い線）
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = `rgba(120,40,20,${0.3 * fadeIn})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        // 縁のすぐ内側の明るい線
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(255,235,200,${0.2 * fadeIn})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx - 1.2, y, rx, ry, 0, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
        // バンプ
        bctx.globalCompositeOperation = 'source-over';
        const g = bctx.createRadialGradient(cx - rx * 0.3, y, 0, cx - rx * 0.3, y, rx * 1.1);
        g.addColorStop(0, `rgba(175,175,175,${0.7 * fadeIn})`);
        g.addColorStop(1, `rgba(118,118,118,${0.7 * fadeIn})`);
        bctx.fillStyle = g;
        bctx.beginPath(); bctx.ellipse(cx, y, rx, ry, 0, -Math.PI * 0.5, Math.PI * 0.5); bctx.lineTo(cx - rx, y - ry); bctx.lineTo(cx - rx, y + ry); bctx.closePath(); bctx.fill();
        bctx.strokeStyle = `rgba(70,70,70,${0.8 * fadeIn})`;
        bctx.lineWidth = 1.2;
        bctx.beginPath(); bctx.ellipse(cx, y, rx, ry, 0, -Math.PI * 0.5, Math.PI * 0.5); bctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // えらぶたの線と側線
  const sx = (s) => (s / S_END) * W;
  for (const vc of [0.25, 0.75]) {
    for (const pass of [0, 1]) {
      ctx.beginPath();
      bctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const vv = vc - 0.14 + (0.28 * k) / 24;
        const q = (vv - vc) / 0.14;
        const s = cfg.gillS - 0.035 + 0.065 * Math.sqrt(Math.max(0, 1 - q * q)) + (pass ? 0.01 : 0);
        const X = sx(s), Y = vv * H;
        if (k === 0) { ctx.moveTo(X, Y); bctx.moveTo(X, Y); } else { ctx.lineTo(X, Y); bctx.lineTo(X, Y); }
      }
      if (pass === 0) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = 'rgba(130,50,30,0.2)'; ctx.lineWidth = 2.2; ctx.stroke();
        bctx.strokeStyle = 'rgba(55,55,55,0.9)'; bctx.lineWidth = 2.5; bctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = 'rgba(255,230,200,0.18)'; ctx.lineWidth = 3; ctx.stroke();
      }
    }
    // 側線: 体側中央やや上の小さな点列
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(110,50,30,0.25)';
    for (let c = Math.ceil((cfg.gillS + 0.05) * colsPerSL); c < colsPerSL * 0.98; c++) {
      const X = c * cw - cw * 0.2;
      const Y = (vc + (vc < 0.5 ? 0.035 : -0.035)) * H + Math.sin(c * 0.4) * 0.6;
      ctx.beginPath(); ctx.ellipse(X, Y, 1.4, 0.9, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;
  map.anisotropy = 4;
  const bump = new THREE.CanvasTexture(bv);
  bump.flipY = false;
  return { map, bump };
}

function finTexture(kind, seed) {
  const W = 128, H = 128;
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const rays = kind === 'ryukin' ? 22 : 18;
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W; // 付け根 0 → 先 1
      const n = fbm3(u * 3, v * 3, 0.5, seed, 3);
      // 鰭条（すじ）: v 方向に並ぶ。先へ行くと 2 本に分かれる雰囲気
      const nr = rays * (u > 0.55 ? 2 : 1);
      const ray = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * 2 * v * nr + (u > 0.55 ? Math.PI : 0)), 5);
      const joint = 0.85 + 0.15 * Math.pow(0.5 + 0.5 * Math.cos(u * 70), 8);
      let col, a;
      if (kind === 'wakin') {
        col = mix3(C(0xe0541c), C(0xf08a48), sstep(0.2, 1, u));
        a = mix(0.8, 0.28, Math.pow(u, 1.1));
      } else if (kind === 'sarasa') {
        col = mix3(C(0xd9583a), C(0xf2e6dc), sstep(0.05, 0.45, u + (n - 0.5) * 0.4));
        a = mix(0.7, 0.24, Math.pow(u, 1.0));
      } else {
        col = mix3(C(0xd8441c), C(0xf3e8e0), sstep(0.25, 0.75, u + (n - 0.5) * 0.5));
        a = mix(0.82, 0.22, Math.pow(u, 0.9));
      }
      a *= 0.75 + 0.45 * ray * joint;
      const dk = 1 - 0.18 * ray;
      a *= 1 - sstep(0.9, 1.0, u) * 0.55;
      a *= 0.9 + 0.2 * n;
      const i = (py * W + px) * 4;
      img.data[i] = col[0] * dk; img.data[i + 1] = col[1] * dk; img.data[i + 2] = col[2] * dk;
      img.data[i + 3] = clamp(a, 0, 1) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  return t;
}

let EYE_TEX = null;
function eyeTexture() {
  if (EYE_TEX) return EYE_TEX;
  const W = 64, H = 64;
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let py = 0; py < H; py++) {
    const a = ((py + 0.5) / H) * Math.PI; // 極からの角度
    for (let px = 0; px < W; px++) {
      const az = (px / W) * Math.PI * 2;
      const n = fbm3(Math.cos(az) * 3, Math.sin(az) * 3, a * 4, 5, 3);
      let c;
      if (a < 0.52) c = [6, 6, 8];
      else if (a < 0.57) c = mix3([6, 6, 8], [120, 90, 40], (a - 0.52) / 0.05);
      else if (a < 0.86) {
        const t = (a - 0.57) / 0.29;
        c = mix3([205, 150, 70], [150, 96, 44], t);
        const streak = 0.85 + 0.3 * n;
        c = [c[0] * streak, c[1] * streak, c[2] * streak];
      } else if (a < 0.95) c = mix3([120, 90, 50], [60, 52, 46], (a - 0.86) / 0.09);
      else c = [70, 62, 56];
      const i = (py * W + px) * 4;
      img.data[i] = clamp(c[0], 0, 255); img.data[i + 1] = clamp(c[1], 0, 255); img.data[i + 2] = clamp(c[2], 0, 255); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  EYE_TEX = new THREE.CanvasTexture(cv);
  EYE_TEX.colorSpace = THREE.SRGBColorSpace;
  return EYE_TEX;
}

// ---------- 汎用ひれ（u: 鰭条方向 0→1, v: 鰭条の並び 0→1） ----------
function makeFin(nu, nv, P, mat) {
  const count = (nu + 1) * (nv + 1);
  const rest = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const U = new Float32Array(count), V = new Float32Array(count);
  const o = [0, 0, 0];
  let k = 0;
  for (let iv = 0; iv <= nv; iv++) {
    for (let iu = 0; iu <= nu; iu++) {
      const u = iu / nu, v = iv / nv;
      P(u, v, o);
      rest[k * 3] = o[0]; rest[k * 3 + 1] = o[1]; rest[k * 3 + 2] = o[2];
      uv[k * 2] = u; uv[k * 2 + 1] = v; U[k] = u; V[k] = v;
      k++;
    }
  }
  const idx = [];
  for (let iv = 0; iv < nv; iv++) for (let iu = 0; iu < nu; iu++) {
    const a = iv * (nu + 1) + iu, b = a + nu + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(rest.slice(), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.08);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, rest, U, V, count, M: new THREE.Matrix4(), flutter: null };
}

// ======================================================================
const FISH_SCALE = 1.3;
export function createFish(kind = 'wakin') {
  const cfg = KINDS[kind] || KINDS.wakin;
  kind = KINDS[kind] ? kind : 'wakin';
  const SL = cfg.SL, prof = cfg.prof;
  const seed = { wakin: 11, sarasa: 23, ryukin: 37 }[kind];
  const top = (s) => interp(prof, s, 1) * SL;
  const bot = (s) => interp(prof, s, 2) * SL;
  const wid = (s) => interp(prof, s, 3) * SL;
  const cen = (s) => interp(prof, s, 4) * SL;
  const xOf = (s) => SL * 0.5 - s * SL;
  const tailLen = cfg.tail.len * SL;

  const group = new THREE.Group();
  group.name = 'fish-' + kind;
  const inner = new THREE.Group();
  group.add(inner);

  // ---------- 材質 ----------
  const tex = bodyTextures(kind, cfg, seed);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: tex.map, bumpMap: tex.bump, bumpScale: 0.9,
    roughness: 0.36, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.25,
    sheen: 0.08, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffe6c0),
    envMapIntensity: 1.0,
  });
  const finMat = new THREE.MeshPhysicalMaterial({
    map: finTexture(kind, seed + 5), transparent: true, side: THREE.DoubleSide, depthWrite: false,
    roughness: 0.45, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.3, alphaTest: 0.01,
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTexture(), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x6a2a1c, roughness: 0.6 });

  // ---------- 胴（ロフト） ----------
  const NL = 56, NR = 36;
  const ringS = new Float32Array(NL + 1), ringX = new Float32Array(NL + 1), ringC = new Float32Array(NL + 1);
  const vcount = (NL + 1) * (NR + 1);
  const pos = new Float32Array(vcount * 3), uvs = new Float32Array(vcount * 2);
  const y0 = new Float32Array(vcount), z0 = new Float32Array(vcount), latA = new Float32Array(vcount);
  const ex = 2 / 2.35;
  for (let i = 0; i <= NL; i++) {
    const t = i / NL;
    const s = (t - (0.1 * Math.sin(2 * Math.PI * t)) / (2 * Math.PI)) * S_END;
    ringS[i] = s; ringX[i] = xOf(s); const c = cen(s); ringC[i] = c;
    const tp = top(s), bt = bot(s), w = wid(s);
    for (let j = 0; j <= NR; j++) {
      const v = j / NR, ang = Math.PI * 2 * v;
      const up = -Math.cos(ang), lat = Math.sin(ang);
      const uy = Math.sign(up) * Math.pow(Math.abs(up), ex);
      const lz = Math.sign(lat) * Math.pow(Math.abs(lat), ex);
      const k = i * (NR + 1) + j;
      const y = c + (up > 0 ? tp : bt) * uy;
      const z = w * lz * (1 - 0.1 * up);
      pos[k * 3] = ringX[i]; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      y0[k] = y; z0[k] = z; latA[k] = Math.abs(lat);
      uvs[k * 2] = s / S_END; uvs[k * 2 + 1] = v;
    }
  }
  const bidx = [];
  for (let i = 0; i < NL; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + NR + 1;
    bidx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bodyGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  bodyGeo.setIndex(bidx);
  bodyGeo.computeVertexNormals();
  const nrm = bodyGeo.attributes.normal.array;
  for (let i = 0; i <= NL; i++) { // 継ぎ目（腹）の法線を平均
    const a = i * (NR + 1), b = a + NR;
    for (let q = 0; q < 3; q++) { const m = (nrm[a * 3 + q] + nrm[b * 3 + q]) * 0.5; nrm[a * 3 + q] = nrm[b * 3 + q] = m; }
  }
  const n0 = nrm.slice();
  bodyGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SL);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.frustumCulled = false;
  inner.add(body);

  // ---------- 口 ----------
  const mouthR0 = Math.max(top(0), wid(0));
  const mouthDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateY(Math.PI / 2), mouthMat);
  inner.add(mouthDisc);
  const mouth = new THREE.Object3D();
  mouth.position.set(xOf(0) + 0.0008, cen(0), 0);
  inner.add(mouth);

  // ---------- 目 ----------
  const eS = cfg.eye.s, eR = cfg.eye.r * SL;
  const eyeGeo = new THREE.SphereGeometry(eR, 24, 16).rotateX(Math.PI / 2); // 極(瞳)を +Z へ
  const eyes = [];
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(eyeGeo, eyeMat);
    const yy = cen(eS) + top(eS) * cfg.eye.yf;
    const fy = cfg.eye.yf;
    const zz = side * (wid(eS) * Math.sqrt(1 - fy * fy) * 1.02 - eR * 0.42);
    const rest = new THREE.Vector3(0.28, 0.12, side).normalize();
    const e = { mesh: m, side, base: new THREE.Vector3(xOf(eS), yy, zz), rest, dir: rest.clone(), q: new THREE.Quaternion() };
    inner.add(m);
    eyes.push(e);
  }

  // ---------- ひれ ----------
  const fins = [];
  const xPed = xOf(1.0);
  // 尾びれ
  const tc = cfg.tail;
  const tailFin = (side) => {
    const P = (u, v, o) => {
      const b = v * 2 - 1;
      const fork = tc.fork * Math.pow(1 - Math.abs(b), 1.5);
      const round = 1 - 0.24 * Math.pow(Math.abs(b), 7);
      const Lr = tailLen * (1 - fork) * round;
      const ang = b * tc.spread;
      const hb = tc.hBase * SL;
      const bx = xPed + 0.07 * SL, by = b * hb;
      const r = u * Lr;
      o[0] = bx - r * Math.cos(ang);
      o[1] = by + r * Math.sin(ang) - (tc.droop * r * r) / tailLen;
      o[2] = side ? side * (r * tc.splay * Math.pow(1 - v, 1.2) + 0.25 * hb * (1 - v)) : 0;
    };
    const f = makeFin(14, 16, P, finMat);
    f.kindName = 'tail';
    const amp = tc.flut * tailLen;
    f.flutter = (u, v, st) => amp * u * u * (0.35 + 0.65 * st.swim) * Math.sin(st.phase * 1.0 - u * 3.2 + v * 1.2) + amp * 0.5 * u * u * Math.sin(st.slow - u * 2.5 + v * 3.0);
    return f;
  };
  if (tc.double) { fins.push(tailFin(1)); fins.push(tailFin(-1)); } else fins.push(tailFin(0));
  // 背びれ
  {
    const dc = cfg.dorsal, H = dc.h * SL;
    const P = (u, vv, o) => {
      const v = 1 - vv; // v: 前 0 → 後 1（ここでは u=鰭条方向）
      const s = dc.s0 + v * (dc.s1 - dc.s0);
      const bx = xOf(s), by = cen(s) + top(s) * 0.93;
      const h = H * (0.88 * Math.pow(1 - v, 0.75) + 0.12) * (0.75 + 0.25 * sstep(0, 0.12, v + 0.06));
      const lean = 0.45 + 0.5 * v;
      o[0] = bx - u * h * lean; o[1] = by + u * h; o[2] = 0;
    };
    const f = makeFin(8, 16, P, finMat);
    f.flutter = (u, v, st) => H * 0.08 * u * u * Math.sin(st.phase - v * 2.5 - u * 1.5) * (0.4 + 0.6 * st.swim);
    fins.push(f);
  }
  // しりびれ
  {
    const ac = cfg.anal, H = ac.h * SL;
    const sides = ac.double ? [1, -1] : [0];
    for (const side of sides) {
      const P = (u, v, o) => {
        const s = ac.s0 + v * (ac.s1 - ac.s0);
        const bx = xOf(s), by = cen(s) - bot(s) * 0.9;
        const h = H * (0.85 * Math.pow(1 - v, 0.5) + 0.15);
        o[0] = bx - u * h * 0.75; o[1] = by - u * h; o[2] = side * u * h * 0.35;
      };
      const f = makeFin(6, 8, P, finMat);
      f.flutter = (u, v, st) => H * 0.1 * u * u * Math.sin(st.phase * 0.9 - v * 2 + side);
      fins.push(f);
    }
  }
  // 胸びれ・腹びれ（付け根の回転で動く）
  const paddle = (len, wd, wb) => (u, v, o) => {
    const b = v * 2 - 1;
    const Lr = len * (1 - 0.42 * b * b) * (1 - 0.1 * b);
    o[0] = -u * Lr;
    o[1] = (b * 0.5) * (wb + (wd - wb) * Math.min(1, u * 1.6)) ;
    o[2] = 0;
  };
  const pects = [], pelvs = [];
  for (const side of [1, -1]) {
    const pc = cfg.pect;
    const f = makeFin(8, 10, paddle(pc.len * SL, pc.wid * SL, pc.wid * SL * 0.3), finMat);
    const s = pc.s;
    f.hinge = new THREE.Vector3(xOf(s), cen(s) - bot(s) * 0.5, side * wid(s) * 0.82);
    f.side = side;
    f.flutter = (u, v, st) => pc.len * SL * 0.12 * u * u * Math.sin(st.pect - u * 2.5 + side);
    pects.push(f); fins.push(f);
    const pv = cfg.pelv;
    const g = makeFin(6, 8, paddle(pv.len * SL, pv.wid * SL, pv.wid * SL * 0.35), finMat);
    g.hinge = new THREE.Vector3(xOf(pv.s), cen(pv.s) - bot(pv.s) * 0.86, side * wid(pv.s) * 0.32);
    g.side = side;
    g.flutter = (u, v, st) => pv.len * SL * 0.1 * u * u * Math.sin(st.phase * 0.7 - u * 2 + side * 0.7);
    pelvs.push(g); fins.push(g);
  }
  for (const f of fins) inner.add(f.mesh);

  // ---------- アニメーション状態 ----------
  const st = { swim: 0.3, turn: 0, phase: 0, slow: 0, pect: 0, breath: 0 };
  let lastT = -1e9, gulpT = 10, squash = 0;
  let lookTarget = null;
  const span = SL * 0.78 + tailLen;
  const x0 = SL * 0.5 - 0.24 * SL;
  let amp = 0, waveK = Math.PI * 2 * 0.85, turnK = 0;
  function bendD(x) {
    const u = (x0 - x) / span;
    let A, tb;
    if (u >= 0) { A = amp * (0.1 + 0.9 * Math.pow(Math.min(u, 1.3), 1.7)); tb = u * u; }
    else { A = amp * 0.1 * Math.max(0, 1 + u * 3); tb = u * u * 0.6; }
    return A * Math.sin(st.phase - u * waveK) - turnK * tb * span;
  }
  const EPS = 0.0015;
  function bendAt(x, out) {
    const d = bendD(x);
    const dd = (bendD(x + EPS) - bendD(x - EPS)) / (2 * EPS);
    const th = Math.atan(dd);
    out.d = d; out.s = Math.sin(th); out.c = Math.cos(th); out.th = th;
    return out;
  }
  const bt = { d: 0, s: 0, c: 1, th: 0 };
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1), ONE = new THREE.Vector3(1, 1, 1);
  const worldP = new THREE.Vector3();
  const invM = new THREE.Matrix4();

  group.scale.setScalar(FISH_SCALE); // 画面で見やすいよう少し大きめの金魚（8〜9cm）
  const fish = {
    group, inner, kind, length: cfg.total * FISH_SCALE, radius: cfg.radius * FISH_SCALE, mouth,
    swim: 0.3, turn: 0,
    finOrder: null, // number なら ひれの renderOrder をこれに固定（水槽の水の外: あみで運ぶ間・鉢の中は 40 など）。null で murkOrderForZ
    update(dt, t) {
      if (t === lastT) return;
      lastT = t;
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      const kS = 1 - Math.exp(-dt * 4);
      st.swim += (clamp(fish.swim, 0, 1) - st.swim) * kS;
      st.turn += (clamp(fish.turn, -1, 1) - st.turn) * (1 - Math.exp(-dt * 5));
      const freq = (0.9 + 3.6 * st.swim) * cfg.freq;
      st.phase += dt * Math.PI * 2 * freq;
      st.slow += dt * Math.PI * 2 * 0.55 * cfg.freq;
      st.pect += dt * Math.PI * 2 * (1.5 - 0.5 * st.swim) * (0.8 + 0.2 * cfg.freq);
      st.breath += dt * Math.PI * 2 * 1.35;
      amp = SL * (0.04 + 0.15 * st.swim) * cfg.amp;
      turnK = st.turn * 0.32 * (kind === 'ryukin' ? 0.6 : 1);
      gulpT += dt;
      const br = 0.5 + 0.5 * Math.sin(st.breath);
      let open = 0.12 + 0.22 * br * br;
      if (gulpT < 0.1) open = Math.max(open, 1.1 * (gulpT / 0.1));
      else if (gulpT < 0.36) open = Math.max(open, 1.1 * (1 - (gulpT - 0.1) / 0.26));

      // 胴
      const P = bodyGeo.attributes.position.array, N = bodyGeo.attributes.normal.array;
      const gillS = cfg.gillS;
      for (let i = 0; i <= NL; i++) {
        const s = ringS[i];
        const sf = 1 + open * 0.75 * Math.exp(-s / 0.028);
        const fwd = open * 0.02 * SL * Math.exp(-s / 0.02);
        const gq = (s - gillS + 0.01) / 0.045;
        const gill = br * 0.07 * Math.exp(-gq * gq);
        const x = ringX[i];
        bendAt(x, bt);
        const c = ringC[i];
        for (let j = 0; j <= NR; j++) {
          const k = i * (NR + 1) + j;
          const y = c + (y0[k] - c) * sf;
          const z = z0[k] * sf * (1 + gill * latA[k]);
          P[k * 3] = x + fwd - z * bt.s;
          P[k * 3 + 1] = y;
          P[k * 3 + 2] = bt.d + z * bt.c;
          const nx = n0[k * 3], nz = n0[k * 3 + 2];
          N[k * 3] = nx * bt.c - nz * bt.s;
          N[k * 3 + 1] = n0[k * 3 + 1];
          N[k * 3 + 2] = nx * bt.s + nz * bt.c;
        }
      }
      bodyGeo.attributes.position.needsUpdate = true;
      bodyGeo.attributes.normal.needsUpdate = true;

      // 口
      bendAt(xOf(0), bt);
      const mx = xOf(0) + open * 0.02 * SL - 0.00015;
      mouthDisc.position.set(mx - 0 * bt.s, cen(0), bt.d);
      mouthDisc.rotation.set(0, -bt.th, 0);
      mouthDisc.scale.set(1, top(0) * (1 + open * 0.75) * 0.92, wid(0) * (1 + open * 0.75) * 0.92);
      mouth.position.set(mx + 0.0006, cen(0), bt.d);

      // 胸びれ・腹びれの付け根の姿勢
      const sw = st.swim;
      for (const f of pects) {
        const sd = f.side;
        const beta = mix(0.75, 0.18, sw) + mix(0.32, 0.12, sw) * Math.sin(st.pect + (sd > 0 ? 0 : 0.6));
        const alpha = mix(1.05, 0.7, sw) + 0.12 * Math.sin(st.pect * 1.0 + 1.2);
        qa.setFromAxisAngle(AY, sd * beta); qb.setFromAxisAngle(AZ, 0.38); qc.setFromAxisAngle(AX, sd * alpha);
        tmpQ.copy(qa).multiply(qb).multiply(qc);
        f.M.compose(f.hinge, tmpQ, ONE);
      }
      for (const f of pelvs) {
        const sd = f.side;
        qa.setFromAxisAngle(AY, sd * (0.32 + 0.06 * Math.sin(st.slow * 1.3))); qb.setFromAxisAngle(AZ, 0.75); qc.setFromAxisAngle(AX, sd * 0.55);
        tmpQ.copy(qa).multiply(qb).multiply(qc);
        f.M.compose(f.hinge, tmpQ, ONE);
      }
      // ひれ
      const me = f => f.M.elements;
      for (const f of fins) {
        const R = f.rest, A = f.mesh.geometry.attributes.position.array;
        const hasM = !!f.hinge;
        const e = me(f);
        for (let k = 0; k < f.count; k++) {
          let lx = R[k * 3], ly = R[k * 3 + 1], lz = R[k * 3 + 2];
          if (f.flutter) lz += f.flutter(f.U[k], f.V[k], st);
          let x = lx, y = ly, z = lz;
          if (hasM) {
            x = e[0] * lx + e[4] * ly + e[8] * lz + e[12];
            y = e[1] * lx + e[5] * ly + e[9] * lz + e[13];
            z = e[2] * lx + e[6] * ly + e[10] * lz + e[14];
          }
          bendAt(x, bt);
          A[k * 3] = x - z * bt.s;
          A[k * 3 + 1] = y;
          A[k * 3 + 2] = bt.d + z * bt.c;
        }
        f.mesh.geometry.attributes.position.needsUpdate = true;
        f.mesh.geometry.computeVertexNormals();
      }

      // 目
      group.updateWorldMatrix(true, true);
      let tl = null;
      if (lookTarget) { invM.copy(inner.matrixWorld).invert(); tl = tmpV.copy(lookTarget).applyMatrix4(invM); }
      for (const e of eyes) {
        bendAt(e.base.x, bt);
        e.mesh.position.set(e.base.x - e.base.z * bt.s, e.base.y, bt.d + e.base.z * bt.c);
        let want = e.rest;
        if (tl) {
          const dv = new THREE.Vector3().subVectors(tl, e.mesh.position).normalize();
          if (dv.dot(e.rest) > -0.2) {
            want = e.rest.clone().lerp(dv, 0.35).normalize();
            const ang = want.angleTo(e.rest);
            if (ang > 0.35) want = e.rest.clone().lerp(want, 0.35 / ang).normalize();
          }
        }
        e.dir.lerp(want, 1 - Math.exp(-dt * 8)).normalize();
        tmpQ2.setFromUnitVectors(AZ, e.dir);
        qa.setFromAxisAngle(AY, -bt.th);
        e.mesh.quaternion.copy(qa).multiply(tmpQ2);
      }

      // にごりの層との描画順
      group.getWorldPosition(worldP);
      const ro = typeof fish.finOrder === 'number' ? fish.finOrder : murkOrderForZ(worldP.z);
      for (const f of fins) f.mesh.renderOrder = ro;
    },
    gulp() { gulpT = 0; },
    lookAt(p) { lookTarget = p ? (lookTarget || new THREE.Vector3()).copy(p) : null; },
    setSquash(v) {
      squash = clamp(v, 0, 1);
      inner.scale.set(1 - 0.2 * squash, 1 + 0.13 * squash, 1 + 0.16 * squash);
    },
    setMurk(color, amount) {
      const a = clamp(amount || 0, 0, 1) * 0.45;
      const c = new THREE.Color(color ?? 0x6f8a40);
      bodyMat.color.setRGB(1, 1, 1).lerp(c, a);
      finMat.color.setRGB(1, 1, 1).lerp(c, a);
    },
    setVisible(b) { group.visible = !!b; },
  };
  fish.update(0, 0);
  return fish;
}

// ======================================================================
const SWIM_CFG = {
  wakin: { cruise: 0.055, maxYaw: 2.6, burst: 4.0 },
  sarasa: { cruise: 0.05, maxYaw: 2.4, burst: 3.6 },
  ryukin: { cruise: 0.03, maxYaw: 1.5, burst: 2.6 },
};
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function createSwimmer(fish, opts = {}) {
  const cfg = SWIM_CFG[fish.kind] || SWIM_CFG.wakin;
  const rnd = mulberry32(opts.seed ?? ({ wakin: 101, sarasa: 202, ryukin: 303 }[fish.kind] || 7));
  const p = fish.group.position.clone();
  let yaw = fish.group.rotation.y, yawRate = 0, pitch = 0, roll = 0, spd = 0, vy = 0;
  let bounds = { type: 'box', min: new THREE.Vector3(-0.15, 0.06, -0.12), max: new THREE.Vector3(0.15, 0.2, 0.04) };
  const wT = new THREE.Vector3().copy(p);
  let wTimer = 0, pauseT = 0, peckT = 0, peckGo = false, burstT = 0, burstYaw = 0, orbitA = rnd() * 6.28, hoverPh = rnd() * 6.28;
  let gulpCD = 0;

  function inside(v, pad) {
    if (bounds.type === 'box') {
      v.x = clamp(v.x, bounds.min.x + pad, bounds.max.x - pad);
      v.y = clamp(v.y, bounds.min.y + pad * 0.5, bounds.max.y - pad * 0.5);
      v.z = clamp(v.z, bounds.min.z + pad, bounds.max.z - pad);
    } else {
      const c = bounds.center, R = bounds.radius - pad;
      v.y = Math.min(v.y, bounds.maxY - pad * 0.5);
      const dx = v.x - c.x, dy = v.y - c.y, dz = v.z - c.z;
      const l = Math.hypot(dx, dy, dz);
      if (l > R && l > 1e-6) { const k = R / l; v.set(c.x + dx * k, c.y + dy * k, c.z + dz * k); }
      v.y = Math.min(v.y, bounds.maxY - pad * 0.5);
    }
    return v;
  }
  function randomPoint(v) {
    if (bounds.type === 'box') {
      const mn = bounds.min, mx = bounds.max, pd = 0.02;
      v.set(mix(mn.x + pd, mx.x - pd, rnd()), mix(mn.y + pd * 0.5, mx.y - pd * 0.5, 0.15 + 0.7 * rnd()), mix(mn.z + pd, mx.z - pd, rnd()));
    } else {
      const c = bounds.center, R = bounds.radius * 0.7;
      for (let i = 0; i < 12; i++) {
        v.set(c.x + (rnd() * 2 - 1) * R, c.y + (rnd() * 2 - 1) * R * 0.6, c.z + (rnd() * 2 - 1) * R);
        if (v.distanceTo(c) < R && v.y < bounds.maxY - 0.015) break;
      }
      inside(v, 0.012);
    }
    return v;
  }
  function bottomY() { return bounds.type === 'box' ? bounds.min.y + 0.002 : bounds.center.y - bounds.radius * 0.75; }
  function pickWander() {
    const r = rnd();
    if (r < 0.22) { pauseT = 1 + rnd() * 2.2; wTimer = 0; return; }
    randomPoint(wT);
    if (r < 0.36) { wT.y = bottomY(); peckGo = true; } else peckGo = false;
    // 今の向きからあまり真後ろにならない点を好む
    wTimer = 3 + rnd() * 4;
  }
  pickWander();

  const fwd = new THREE.Vector3(), rep = new THREE.Vector3(), la = new THREE.Vector3(), tgt = new THREE.Vector3();

  const sw = {
    mode: 'wander',
    target: new THREE.Vector3(),
    speed: opts.speed ?? 1,
    position: p,
    arrived: false,
    get heading() { return yaw; },
    get speedNow() { return spd; },
    setBounds(b) { bounds = { type: 'box', min: b.min.clone(), max: b.max.clone() }; inside(p, 0); inside(wT, 0.01); },
    setSphereBounds(center, radius, maxY) { bounds = { type: 'sphere', center: center.clone(), radius, maxY }; inside(p, 0.005); randomPoint(wT); },
    startle(from, strength = 1) {
      if (sw.mode === 'held') return;
      const dx = p.x - from.x, dz = p.z - from.z;
      burstYaw = Math.atan2(-dz, dx) + (rnd() - 0.5) * 0.6;
      burstT = 0.35 + 0.25 * Math.sqrt(clamp(strength, 0, 2));
      pauseT = 0; peckT = 0;
      wT.set(p.x + Math.cos(burstYaw) * 0.08, p.y + (rnd() - 0.5) * 0.03, p.z - Math.sin(burstYaw) * 0.08);
      inside(wT, 0.02);
      wTimer = 2;
    },
    teleport(v) { p.copy(v); spd = 0; vy = 0; yawRate = 0; burstT = 0; wT.copy(v); fish.group.position.copy(p); },
    setHeading(y) { yaw = y; yawRate = 0; fish.group.rotation.set(0, yaw, 0, 'YZX'); },
    update(dt, t) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      if (sw.mode === 'held') { fish.update(dt, t); return; }
      const sp = sw.speed;
      let desYaw = yaw, desSpd = 0, desY = p.y, pitchOverride = null;
      let maxYaw = cfg.maxYaw;
      fwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
      sw.arrived = false;

      if (sw.mode === 'wander') {
        fish.lookAt(null);
        if (pauseT > 0) {
          pauseT -= dt; desSpd = 0;
          desYaw = yaw + Math.sin(t * 0.7 + hoverPh) * 0.3;
          if (pauseT <= 0) pickWander();
        } else if (peckT > 0) {
          peckT -= dt; desSpd = 0; desY = bottomY();
          pitchOverride = -0.42 + 0.1 * Math.sin(t * 9);
          gulpCD -= dt;
          if (gulpCD <= 0) { fish.gulp(); gulpCD = 0.45 + rnd() * 0.4; }
          if (peckT <= 0) { pickWander(); wT.y = Math.max(wT.y, bottomY() + 0.03); }
        } else {
          tgt.copy(wT);
          const dx = tgt.x - p.x, dz = tgt.z - p.z, dh = Math.hypot(dx, dz);
          desYaw = dh > 0.004 ? Math.atan2(-dz, dx) : yaw;
          desSpd = cfg.cruise * sp * clamp(dh / 0.04, 0.35, 1);
          desY = tgt.y;
          wTimer -= dt;
          if (dh < 0.012 || wTimer < 0) {
            if (peckGo) { peckT = 1.4 + rnd() * 1.2; peckGo = false; } else pickWander();
          }
        }
      } else if (sw.mode === 'seek') {
        fish.lookAt(sw.target);
        const dx = sw.target.x - p.x, dz = sw.target.z - p.z, dh = Math.hypot(dx, dz);
        const d3 = Math.hypot(dh, sw.target.y - p.y);
        sw.arrived = d3 < 0.03;
        if (d3 > 0.035) {
          desYaw = Math.atan2(-dz, dx);
          desSpd = cfg.cruise * sp * 1.2 * clamp(d3 / 0.07, 0.25, 1.3);
          desY = sw.target.y;
        } else {
          orbitA += dt * 0.7;
          tgt.set(sw.target.x + Math.cos(orbitA) * 0.022, sw.target.y - 0.004, sw.target.z + Math.sin(orbitA) * 0.022);
          inside(tgt, 0.01);
          const ox = tgt.x - p.x, oz = tgt.z - p.z;
          desYaw = Math.hypot(ox, oz) > 0.003 ? Math.atan2(-oz, ox) : yaw;
          // 近くでは target 側へ頭を向けがち
          const ty = Math.atan2(-(sw.target.z - p.z), sw.target.x - p.x);
          desYaw = yaw + wrapA(desYaw - yaw) * 0.4 + wrapA(ty - yaw) * 0.6;
          desSpd = cfg.cruise * sp * 0.3;
          desY = sw.target.y - 0.003;
        }
      } else if (sw.mode === 'watch') {
        fish.lookAt(sw.target);
        const dx = sw.target.x - p.x, dz = sw.target.z - p.z;
        if (Math.hypot(dx, dz) > 0.005) desYaw = Math.atan2(-dz, dx);
        desSpd = 0;
        desY = p.y + clamp(sw.target.y - p.y, -0.01, 0.01) * 0.3;
        maxYaw = cfg.maxYaw * 0.8;
      }

      // 壁よけ（先読み点の近さで内向きに押す）
      la.copy(p).addScaledVector(fwd, 0.028 + spd * 0.4);
      rep.set(0, 0, 0);
      const m = 0.035;
      if (bounds.type === 'box') {
        const push = (dist, sgn, axis) => { if (dist < m) { const w = ((m - dist) / m) ** 2; rep[axis] += sgn * w; } };
        push(la.x - bounds.min.x, 1, 'x'); push(bounds.max.x - la.x, -1, 'x');
        push(la.z - bounds.min.z, 1, 'z'); push(bounds.max.z - la.z, -1, 'z');
      } else {
        const c = bounds.center;
        const dx = la.x - c.x, dz = la.z - c.z, dy = la.y - c.y;
        const l = Math.hypot(dx, dy, dz);
        const gap = bounds.radius - l;
        if (gap < m) { const w = ((m - gap) / m) ** 2; const lh = Math.hypot(dx, dz) || 1; rep.x -= (dx / lh) * w; rep.z -= (dz / lh) * w; }
      }
      if (rep.lengthSq() > 1e-6 && sw.mode !== 'watch') {
        const dv = new THREE.Vector3(Math.cos(desYaw), 0, -Math.sin(desYaw));
        dv.addScaledVector(rep, 2.5);
        desYaw = Math.atan2(-dv.z, dv.x);
        desSpd *= 1 - 0.4 * Math.min(1, rep.length());
      }

      if (burstT > 0) {
        burstT -= dt;
        desYaw = burstYaw;
        maxYaw = 9;
        desSpd = cfg.cruise * cfg.burst * sp;
      }

      // 旋回
      const diff = wrapA(desYaw - yaw);
      const yrDes = clamp(diff * 3.2, -maxYaw, maxYaw);
      yawRate += (yrDes - yawRate) * (1 - Math.exp(-dt * (burstT > 0 ? 14 : 6)));
      yaw = wrapA(yaw + yawRate * dt);
      // 速度
      desSpd *= 0.35 + 0.65 * Math.max(0, Math.cos(diff));
      spd += (desSpd - spd) * (1 - Math.exp(-dt * (burstT > 0 ? 10 : desSpd > spd ? 2.4 : 1.6)));
      // 上下
      let vyDes = clamp((desY - p.y) * 1.6, -0.03, 0.03) * Math.min(1.3, sp);
      if (sw.mode !== 'wander' || pauseT > 0) vyDes += Math.sin(t * 1.3 + hoverPh) * 0.0015;
      vy += (vyDes - vy) * (1 - Math.exp(-dt * 2.5));
      fwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
      p.addScaledVector(fwd, spd * dt);
      p.y += vy * dt;
      inside(p, 0);

      // 姿勢
      let pitchDes = clamp(Math.atan2(vy, Math.max(spd, 0.012)) * 0.8, -0.35, 0.35);
      if (pitchOverride !== null) pitchDes = pitchOverride;
      pitch += (pitchDes - pitch) * (1 - Math.exp(-dt * 3));
      const rollDes = clamp(-yawRate * 0.05, -0.12, 0.12);
      roll += (rollDes - roll) * (1 - Math.exp(-dt * 3));
      fish.group.position.copy(p);
      fish.group.rotation.set(roll, yaw, pitch, 'YZX');

      fish.swim = clamp(spd / (cfg.cruise * 1.5) + Math.abs(yawRate) * 0.06 + (burstT > 0 ? 0.6 : 0), 0, 1);
      fish.turn = clamp(yawRate / cfg.maxYaw, -1, 1);
      fish.update(dt, t);
    },
  };
  fish.group.rotation.order = 'YZX';
  return sw;
}
