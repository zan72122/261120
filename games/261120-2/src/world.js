// world.js — 部屋・サイドボード・水槽（入れ物）・世話道具のモデル（写実寄り PBR、手続きテクスチャのみ）
//
// ============================== 公開 API ==============================
// 単位: メートル / ラジアン。座標は layout.js の L（Y 上、テーブル天板上面 y=0、カメラは +Z 側から -Z を見る）。
//
// export function buildWorld(engine) -> world
//   engine = { THREE, renderer, scene, camera, quality:{ low, particleBudget, onChange(fn) } }
//   world.root を engine.scene に add し、scene.environment（RoomEnvironment の PMREM）と scene.background を設定する。
//   renderer.localClippingEnabled = true にする（ピッチャーの水を水平に切るため）。
//
// world.root                 THREE.Group
// world.update(dt, t)        毎フレーム呼ぶ（秒）。水草のゆれ、ハイライト脈動、光だまり、ポンプの流れ、エアポンプ振動、接地影の追従。
// world.setTimeOfDay(v)      0=昼のやわらかい自然光 … 1=夕方の金色の光。連続値で呼んでよい。
// world.halo.set(pos|null, radius=0.08)  pos(Vector3 world) に暖色の加算光だまり（カメラ向きスプライト、半径 m）。null でフェードアウト。
// world.sun / world.hemi     ライト（必要なら参照のみ）
//
// world.tank = { group, frontGlass, rimY, glassMeshes }
//   ガラス 5 面は厚み 5mm のボックス（透明 + 環境反射 + フレネル）。小口（上端・角）は緑がかったガラスの帯。
//   renderOrder: 奥・左右・底のガラス = -2（水より先）, 前面ガラス = 5（水より後）。水を作る側は renderOrder 0 前後で。
//   tank の底ガラス上面 y=0.008、砂利上面 ≒ L.tank.gravelH (0.028)。水槽の下に 3mm の黒いマット。
//
// world.props.* は共通で { group, home:Vector3（group の初期 position）, setHighlight(v 0..1) }。
//   setHighlight: 材質 emissive を暖色でやわらかく脈動（update 内）。0 で完全に元に戻る。
//
// props.pot     横倒しの素焼き鉢。group 原点 = 鉢の中心（L.pot の x,z、y=0.052）。口は左手前 (-X,+Z) 向き。
//               pot.mouth: Vector3 world（口の中心）。pot.axis: Vector3（口の向きの単位ベクトル）。
// props.marble  青いガラスのビー玉 直径 1.6cm。group 原点 = 球の中心 (L.marble.x, 0.031, L.marble.z)。
//               ※ L.marble.y=0.036 だと「半分うまる」に見えないので中心を 0.031 に下げた（契約からの変更点）。
//               marble.glint(v 0..1): 一瞬きらっと（v を入れると減衰しながら光る）。
// props.plants  水草 3 株（L.plants）。plants.group / plants.items[i].group（根元 = 砂利面）。
//               plants.poke(i, strength 0..1) 大きくゆれる / plants.setSway(v 0..1+) ゆれの強さ（初期 1）。
//               ゆれは頂点シェーダ（影は落とさない）。
// props.airStone 青灰色の円筒エアストーン。group 原点 = 石の中心 (L.airStone)。airStone.top: Vector3 world（泡の出口）。
//               透明シリコンチューブが左ガラスを越えてエアポンプ右側面の口へつながる（チューブは world 固定）。
//
// props.net     魚すくいあみ。group 原点 = 輪の中心（初期 L.net）。輪は水平・開口が上、半径 L.net.hoopR。
//               柄は輪の +X の点から +X 方向・仰角 35° に伸びる（長さ L.net.handle、先端に緑の持ち手）。
//               net.setSag(v 0..1) 袋が下に伸びる / net.bagBottom: Object3D（袋の底、ローカル y=-0.05*(1+0.6v)）
//               net.setWet(v 0..1) 網がしっとり暗く・つやが出る。
// props.bowl    ガラスの金魚鉢。group 原点 = 底面中心（L.bowl）。球 R=L.bowl.r を上下カットした形、口 ≒ L.bowl.mouthR。
//               bowl.tilt: Group（原点 = 球の中心、group ローカル y=0.0838）。ガラス・水は tilt の下。
//               bowl.setTilt(rad) tilt.rotation.z = rad（正で +X 側が上がり口が -X 側へ傾く）。水は逆回転して水面を水平に保つ。
//               bowl.setWaterLevel(v 0..1) 1=初期（水面 L.bowl.waterY）, 0=空 / bowl.waterSurfaceY() 水面の world y
//               bowl.mouth: Object3D（tilt の子、口の中心）/ bowl.inner = { centerY:0.0838, radius:0.074 }（group ローカル）
// props.sponge  group 原点 = スポンジの中心（テーブルに平置き、y = h/2）。黄色いセルロース（下 22mm）+ 上面に緑の研磨不織布 8mm。
// props.pump    水換え用手押しポンプ。group 原点 = (L.pump.x, 0, L.pump.z)（テーブル高さ、管の真下）。
//               透明の硬い吸い込み管 (直径2cm, y 0.04..0.30) + 赤いじゃばら (直径5cm, 高さ7cm, 中心 y=L.pump.bulbY) +
//               じゃばら横から透明ホースが右ガラスを越えてバケツの中へ。右ガラスのフチにクリップ。
//               pump.squeeze(v 0..1) じゃばらが下端固定で縦につぶれる（1 で高さ 55%）。
//               pump.setFlow(v 0..1) 管とホースの中を緑がかった水が流れる。pump.bulbCenter: Vector3 world（squeeze で更新）
//               pump.hoseEnd: Vector3 world（ホース出口、バケツの中）。
// props.pail    青いポリバケツ。group 原点 = 底面中心（L.pail）。上端 y=L.pail.h、上端の内半径 ≒ L.pail.r-0.003。
//               pail.setFill(v 0..1, colorHex=0x6f8a3c) 水面円盤の高さ（v=1 で y≈0.115）と色。0 で非表示。pail.waterY() world y。
// props.pitcher 透明な計量ピッチャー。group 原点 = 底面中心（L.pitcher）。注ぎ口は -X 側（水槽の中央寄り）、取っ手は +X 側。
//               pitcher.tilt: Group（原点 = 底面中心の真上 y=h/2=0.0875）。tilt.rotation.z を「正」にすると注ぎ口(-X)が下がる。
//               pitcher.setTilt(rad) 傾けても水面を水平に保つ（水はクリップ面で切る。group 自体は回さず tilt を使うこと）。
//               pitcher.setFill(v 0..1) 1=初期（底から 0.14m）/ pitcher.spout: Object3D（tilt の子、注ぎ口の先端）
// props.airPump エアポンプ。group 原点 = 底面中心（L.airPump）。青灰色の角丸の箱、ゴム足、上面に直径4cm の丸い押しボタン、緑ランプ。
//               airPump.setOn(bool) ボタンが 3mm 沈み、ランプ点灯、本体がごく細かく振動。airPump.press(v 0..1) 押し込み中の沈み（最大 3mm）。
//               airPump.buttonCenter: Vector3 world（ボタン上面の中心、押し込みで更新）。
// props.foodCan えさ缶。group 原点 = 底面中心（L.foodCan）。文字なしのオレンジのラベル（金魚シルエット柄）、中にフレーク。
//               foodCan.tilt: Group（原点 = 缶の中心 y=h/2）。正の rotation.z で口が -X 側へ傾く。foodCan.setTilt(rad)。
//               foodCan.mouth: Object3D（tilt の子、口の中心）。foodCan.lid: 外した黄色いふた（world.root 直下、缶の右奥に伏せずに置いてある）。
//
// 接地の暗がり: 各道具の下に小さな blob 影（group の world x,z に追従し、持ち上げると薄くなる）。quality.low では影を切り blob を濃くする。
// =====================================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { L } from './layout.js';

// ---------------------------------------------------------------- helpers
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, { srgb = true, rx = 1, ry = 1, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 透明体の質感: アルファにフレネルと鏡面ハイライトを足し、反射が薄まらないようにする（transmission なし）
function glassify(mat, edge = 0.5, spec = 0.9) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float gNv = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
      float gF = pow(1.0 - gNv, 3.0);
      vec3 gS = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
      float gA = diffuseColor.a + gF * ${edge.toFixed(3)} + dot(gS, vec3(0.299, 0.587, 0.114)) * ${spec.toFixed(3)}
               + dot(totalEmissiveRadiance, vec3(0.4));
      gl_FragColor = vec4(outgoingLight, clamp(gA, 0.0, 1.0));
    `);
  };
  mat.customProgramCacheKey = () => 'glassify' + edge + '_' + spec;
  return mat;
}
function glassMat(opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0xeaf3ef, roughness: opts.roughness ?? 0.03, metalness: 0,
    transparent: true, opacity: opts.opacity ?? 0.1, depthWrite: false,
    envMapIntensity: opts.env ?? 1.3, side: opts.side ?? THREE.FrontSide,
    clearcoat: opts.clearcoat ?? 0, clearcoatRoughness: 0.05, ior: 1.5, specularIntensity: 1,
  });
  return glassify(m, opts.edge ?? 0.5, opts.spec ?? 0.9);
}

// ハイライト（emissive 脈動）
const HL_COLOR = new THREE.Color(0xffa94d);
function makeHighlighter(mats, gain = 1) {
  const st = { target: 0, cur: 0, mats: mats.filter(Boolean), gain };
  st.mats.forEach((m) => { m.userData.baseEmissive = m.emissive ? m.emissive.clone() : new THREE.Color(0); });
  st.set = (v) => { st.target = Math.max(0, Math.min(1, v || 0)); };
  st.update = (dt, t) => {
    st.cur += (st.target - st.cur) * Math.min(1, dt * 6);
    if (st.target === 0 && st.cur < 0.002) st.cur = 0;
    const k = st.cur * (0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 3.6))) * st.gain;
    for (const m of st.mats) {
      if (!m.emissive) continue;
      const b = m.userData.baseEmissive; m.emissive.setRGB(b.r + HL_COLOR.r * k, b.g + HL_COLOR.g * k, b.b + HL_COLOR.b * k);
    }
  };
  return st;
}

// ---------------------------------------------------------------- textures
function woodTextures() {
  const S = 512, R = rng(11);
  const [c, g] = canvas(S, S);
  const [cr, gr] = canvas(S, S);
  g.fillStyle = '#c9a477'; g.fillRect(0, 0, S, S);
  gr.fillStyle = '#9a9a9a'; gr.fillRect(0, 0, S, S);
  // 幅広の色むら帯
  for (let i = 0; i < 14; i++) {
    const y = R() * S, h = 10 + R() * 60, a = 0.05 + R() * 0.08;
    const col = R() < 0.5 ? `rgba(150,105,60,${a})` : `rgba(230,200,150,${a})`;
    for (const o of [-S, 0, S]) { g.fillStyle = col; g.fillRect(0, y + o, S, h); }
  }
  // 細い直線的な木目
  for (let i = 0; i < 420; i++) {
    const y0 = R() * S, k = 1 + Math.floor(R() * 3), amp = R() * 2.5, ph = R() * 6.28;
    const w = 0.4 + R() * 1.6, dark = R() < 0.75;
    const a = 0.06 + R() * 0.22;
    g.strokeStyle = dark ? `rgba(110,70,35,${a})` : `rgba(240,215,170,${a * 0.7})`;
    gr.strokeStyle = dark ? `rgba(200,200,200,${a})` : `rgba(80,80,80,${a})`;
    g.lineWidth = gr.lineWidth = w;
    for (const o of [-S, 0, S]) {
      g.beginPath(); gr.beginPath();
      for (let x = 0; x <= S; x += 8) {
        const y = y0 + o + Math.sin((x / S) * 6.2832 * k + ph) * amp;
        if (x === 0) { g.moveTo(x, y); gr.moveTo(x, y); } else { g.lineTo(x, y); gr.lineTo(x, y); }
      }
      g.stroke(); gr.stroke();
    }
  }
  // 導管（細かいダッシュ）
  for (let i = 0; i < 2600; i++) {
    const x = R() * S, y = R() * S;
    g.fillStyle = `rgba(90,55,25,${0.1 + R() * 0.2})`;
    g.fillRect(x, y, 2 + R() * 6, 0.8);
  }
  return { map: toTex(c), rough: toTex(cr, { srgb: false }) };
}

function wallTextures() {
  const S = 256, R = rng(5);
  const [c, g] = canvas(S, S);
  const [cb, gb] = canvas(S, S);
  g.fillStyle = '#eee8de'; g.fillRect(0, 0, S, S);
  gb.fillStyle = '#808080'; gb.fillRect(0, 0, S, S);
  // 織り目（縦横の細かい糸）
  for (let y = 0; y < S; y += 2) {
    const a = 0.03 + R() * 0.05;
    g.fillStyle = `rgba(120,105,85,${a})`; g.fillRect(0, y, S, 1);
    gb.fillStyle = `rgba(40,40,40,${a * 3})`; gb.fillRect(0, y, S, 1);
  }
  for (let x = 0; x < S; x += 2) {
    const a = 0.02 + R() * 0.04;
    g.fillStyle = `rgba(255,255,250,${a})`; g.fillRect(x, 0, 1, S);
    gb.fillStyle = `rgba(220,220,220,${a * 3})`; gb.fillRect(x, 0, 1, S);
  }
  for (let i = 0; i < 1800; i++) {
    const x = R() * S, y = R() * S, d = R() < 0.5;
    g.fillStyle = d ? `rgba(150,135,110,${0.05 + R() * 0.08})` : `rgba(255,255,255,${0.08 + R() * 0.1})`;
    g.fillRect(x, y, 1 + R() * 3, 1);
    gb.fillStyle = d ? 'rgba(30,30,30,0.25)' : 'rgba(230,230,230,0.25)';
    gb.fillRect(x, y, 1 + R() * 3, 1);
  }
  return { map: toTex(c, { rx: 40, ry: 22 }), bump: toTex(cb, { srgb: false, rx: 40, ry: 22 }) };
}

function windowLightTexture() {
  // 窓枠形（2x2 の格子窓）のぼやけた光。Safari でも動くよう shadowBlur でぼかす。
  const W = 512, H = 512;
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  g.save();
  g.shadowColor = 'rgba(255,255,255,1)';
  g.shadowBlur = 22;
  g.shadowOffsetX = 2000;
  g.fillStyle = '#fff';
  g.setTransform(1, 0, -0.35, 1, 0, 0);
  const x0 = 140, y0 = 70, pw = 150, ph = 170, m = 16;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.fillRect(x0 + i * (pw + m) - 2000, y0 + j * (ph + m), pw, ph);
  }
  g.restore();
  // 全体を外周でもうひとまわりフェード
  const grd = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.55);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  return toTex(c, { wrap: false });
}

function radialTexture(stops, S = 128) {
  const [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return toTex(c, { wrap: false });
}

function gravelTexture() {
  const S = 256, R = rng(21);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#5c4d3c'; g.fillRect(0, 0, S, S);
  const cols = ['#cdbb9a', '#a88d6b', '#b9b0a0', '#8a7560', '#e0d5bf', '#9c7458', '#c4b294', '#7d7468'];
  for (let i = 0; i < 900; i++) {
    const x = R() * S, y = R() * S, r = 2.5 + R() * 4.5;
    const col = cols[Math.floor(R() * cols.length)];
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox < -10 || x + ox > S + 10 || y + oy < -10 || y + oy > S + 10) continue;
      g.save(); g.translate(x + ox, y + oy); g.rotate(R() * 3.14);
      g.fillStyle = 'rgba(40,30,20,0.5)';
      g.beginPath(); g.ellipse(0.8, 1.2, r * 1.15, r * 0.85, 0, 0, 6.283); g.fill();
      const grd = g.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r * 1.1);
      grd.addColorStop(0, '#fffaf0'); grd.addColorStop(0.15, col); grd.addColorStop(1, col);
      g.fillStyle = grd; g.globalAlpha = 0.95;
      g.beginPath(); g.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, 6.283); g.fill();
      g.globalAlpha = 1; g.restore();
    }
  }
  return toTex(c);
}

function terracottaTexture() {
  const S = 256, R = rng(31);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#b4613b'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) {
    const x = R() * S, y = R() * S, r = 10 + R() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const light = R() < 0.5;
    grd.addColorStop(0, light ? 'rgba(220,140,95,0.25)' : 'rgba(120,55,30,0.22)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = R() < 0.6 ? `rgba(90,40,20,${0.15 + R() * 0.3})` : `rgba(235,190,150,${0.2 + R() * 0.3})`;
    g.fillRect(R() * S, R() * S, 1 + R() * 1.5, 1 + R() * 1.5);
  }
  // ろくろ目
  for (let y = 0; y < S; y += 3 + R() * 5) {
    g.fillStyle = `rgba(100,45,20,${0.04 + R() * 0.06})`; g.fillRect(0, y, S, 1);
  }
  return toTex(c);
}

function spongeTextures() {
  const S = 256, R = rng(41);
  const [c, g] = canvas(S, S);
  const [cb, gb] = canvas(S, S);
  g.fillStyle = '#e9c23c'; g.fillRect(0, 0, S, S);
  gb.fillStyle = '#c8c8c8'; gb.fillRect(0, 0, S, S);
  for (let i = 0; i < 1500; i++) {
    const x = R() * S, y = R() * S, r = 0.8 + Math.pow(R(), 2.5) * 6;
    g.fillStyle = `rgba(160,115,20,${0.35 + R() * 0.4})`;
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + R() * 0.5), R() * 3, 0, 6.283); g.fill();
    gb.fillStyle = `rgba(0,0,0,${0.5 + R() * 0.4})`;
    gb.beginPath(); gb.ellipse(x, y, r, r * 0.8, 0, 0, 6.283); gb.fill();
  }
  for (let i = 0; i < 800; i++) {
    g.fillStyle = `rgba(255,235,140,${0.2 + R() * 0.3})`; g.fillRect(R() * S, R() * S, 1.5, 1.5);
  }
  const [c2, g2] = canvas(S, S);
  const [c2b, g2b] = canvas(S, S);
  g2.fillStyle = '#2b6b33'; g2.fillRect(0, 0, S, S);
  g2b.fillStyle = '#606060'; g2b.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = R() * S, y = R() * S, a = R() * 6.283, l = 4 + R() * 14;
    const light = R() < 0.5;
    g2.strokeStyle = light ? `rgba(110,170,90,${0.3 + R() * 0.4})` : `rgba(15,55,25,${0.3 + R() * 0.4})`;
    g2b.strokeStyle = light ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
    g2.lineWidth = g2b.lineWidth = 0.6 + R();
    g2.beginPath(); g2.moveTo(x, y); g2.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g2.stroke();
    g2b.beginPath(); g2b.moveTo(x, y); g2b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g2b.stroke();
  }
  return { y: toTex(c), yb: toTex(cb, { srgb: false }), g: toTex(c2), gb: toTex(c2b, { srgb: false }) };
}

function speckleTexture(base, dark, light, n = 3000, seed = 51) {
  const S = 128, R = rng(seed);
  const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    g.fillStyle = R() < 0.55 ? dark : light; g.globalAlpha = 0.3 + R() * 0.5;
    g.fillRect(R() * S, R() * S, 1 + R(), 1 + R());
  }
  g.globalAlpha = 1;
  return toTex(c);
}

function netTexture() {
  const S = 128;
  const [c, g] = canvas(S, S);
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 1.6;
  const n = 8, d = S / n;
  for (let i = -n; i <= 2 * n; i++) {
    g.beginPath(); g.moveTo(i * d, 0); g.lineTo(i * d + S, S); g.stroke();
    g.beginPath(); g.moveTo(i * d, 0); g.lineTo(i * d - S, S); g.stroke();
  }
  // 結び目
  g.fillStyle = '#fff';
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    g.beginPath(); g.arc(i * d + ((j % 2) ? d / 2 : 0), j * d, 1.4, 0, 6.283); g.fill();
  }
  return toTex(c);
}

function flowTexture() {
  const S = 128, R = rng(61);
  const [c, g] = canvas(S, S);
  g.fillStyle = 'rgb(120,140,70)'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 160; i++) {
    const x = R() * S, y = R() * S, r = 0.8 + R() * 3;
    g.fillStyle = R() < 0.5 ? `rgba(60,80,30,${0.3 + R() * 0.4})` : `rgba(210,225,170,${0.3 + R() * 0.5})`;
    g.beginPath(); g.ellipse(x, y, r * 2.2, r, 0, 0, 6.283); g.fill();
  }
  return toTex(c);
}

function labelTexture() {
  const W = 512, H = 160, R = rng(71);
  const [c, g] = canvas(W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#f08a24'); grd.addColorStop(0.55, '#e8651a'); grd.addColorStop(1, '#c94a12');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // 上下の帯
  g.fillStyle = '#f7e7c4'; g.fillRect(0, 6, W, 5); g.fillRect(0, H - 11, W, 5);
  // 波の帯
  g.fillStyle = 'rgba(255,240,210,0.35)';
  g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H * 0.78 + Math.sin(x / W * 6.283 * 4) * 6);
  g.lineTo(W, H); g.fill();
  // 泡
  g.strokeStyle = 'rgba(255,245,225,0.7)'; g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(R() * W, 20 + R() * 80, 2 + R() * 5, 0, 6.283); g.stroke(); }
  // 金魚のシルエット（単純）
  const fish = (x, y, s, flip, col) => {
    g.save(); g.translate(x, y); g.scale(flip ? -s : s, s); g.fillStyle = col;
    g.beginPath(); g.ellipse(0, 0, 22, 13, 0, 0, 6.283); g.fill();
    g.beginPath(); g.moveTo(16, 0); g.quadraticCurveTo(30, -4, 42, -16); g.quadraticCurveTo(36, 0, 42, 16); g.quadraticCurveTo(30, 4, 16, 0); g.fill();
    g.beginPath(); g.moveTo(-4, -11); g.quadraticCurveTo(6, -24, 14, -9); g.fill();
    g.restore();
  };
  fish(120, 70, 1.6, false, 'rgba(255,248,232,0.92)');
  fish(300, 58, 1.0, true, 'rgba(180,40,10,0.75)');
  fish(410, 92, 1.25, false, 'rgba(255,248,232,0.85)');
  fish(220, 112, 0.7, true, 'rgba(255,215,120,0.8)');
  return toTex(c, { wrap: true });
}

function knurlTexture() {
  const S = 128;
  const [c, g] = canvas(S, 32);
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, 32);
  for (let x = 0; x < S; x += 4) { g.fillStyle = '#ffffff'; g.fillRect(x, 0, 2, 32); }
  return toTex(c, { srgb: false, rx: 12, ry: 1 });
}

function bubbleBumpTexture() {
  const S = 128, R = rng(81);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
    g.beginPath(); g.arc(R() * S, R() * S, 0.6 + R() * 1.6, 0, 6.283); g.fill();
  }
  return toTex(c, { srgb: false });
}

// ---------------------------------------------------------------- geometry helpers
function lathe(points, seg = 48) {
  const g = new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(Math.max(x, 0), y)), seg);
  g.computeVertexNormals();
  return g;
}
function arcPts(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
function setShadow(o, cast = true, receive = true) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
  return o;
}

// ================================================================ buildWorld
export function buildWorld(engine) {
  const { renderer, scene } = engine;
  const quality = engine.quality || { low: false };
  const LOW = !!quality.low;
  renderer.localClippingEnabled = true;

  const root = new THREE.Group(); root.name = 'world';
  scene.add(root);
  const updaters = [];

  // ---------------- environment
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();
  const bgDay = new THREE.Color(0xf1ebe1), bgEve = new THREE.Color(0xe8cfae);
  scene.background = bgDay.clone();
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.85;

  // ---------------- lights
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.4);
  const sunTarget = new THREE.Object3D(); sunTarget.position.set(0, 0.08, -0.03);
  root.add(sunTarget); sun.target = sunTarget;
  sun.position.set(-1.05, 1.15, 0.7);
  sun.castShadow = !LOW;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -0.6; sc.right = 0.6; sc.top = 0.6; sc.bottom = -0.6; sc.near = 0.3; sc.far = 3.5;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012;
  root.add(sun);
  const hemi = new THREE.HemisphereLight(0xfff5e8, 0xa88a68, 0.55);
  root.add(hemi);

  // ---------------- wall
  const wt = wallTextures();
  const wallMat = new THREE.MeshStandardMaterial({ map: wt.map, bumpMap: wt.bump, bumpScale: 0.4, roughness: 0.92, metalness: 0, envMapIntensity: 0.5, color: 0xd9d4cc });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), wallMat);
  wall.position.set(0, 0.6, L.wallZ); wall.receiveShadow = true;
  root.add(wall);
  // 窓の光だまり
  const winTex = windowLightTexture();
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff1d8, opacity: 0.42 });
  const winPatch = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), winMat);
  winPatch.position.set(-0.12, 0.56, L.wallZ + 0.002);
  root.add(winPatch);
  // 床（横長画面でサイドボードの外が見えた時用）
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshStandardMaterial({ color: 0x8a6646, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.78, 1.5); root.add(floor);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, 0.012), new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: 0.6 }));
  skirting.position.set(0, -0.75, L.wallZ + 0.006); root.add(skirting);

  // ---------------- sideboard
  const wood = woodTextures();
  const T = L.table;
  const woodMat = new THREE.MeshStandardMaterial({ map: wood.map, roughnessMap: wood.rough, roughness: 0.55, metalness: 0, envMapIntensity: 0.7, bumpMap: wood.rough, bumpScale: 0.25 });
  wood.map.repeat.set(T.w / 0.42, T.d / 0.42 * 0.6); wood.rough.repeat.copy(wood.map.repeat);
  const top = new THREE.Mesh(new RoundedBoxGeometry(T.w, T.thick, T.d, 3, 0.004), woodMat);
  top.position.set(0, -T.thick / 2, T.cz); top.receiveShadow = true; top.castShadow = true;
  root.add(top);
  const bodyMat = woodMat.clone(); bodyMat.map = wood.map.clone(); bodyMat.map.repeat.set(2.5, 1.7); bodyMat.color = new THREE.Color(0xbfae98); bodyMat.bumpMap = null;
  const body = new THREE.Mesh(new THREE.BoxGeometry(T.w - 0.03, 0.75, T.d - 0.03), bodyMat);
  body.position.set(0, -T.thick - 0.375, T.cz - 0.005); body.receiveShadow = true; root.add(body);
  // 引き出しの目地
  const gapMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 });
  for (const y of [-0.075, -0.20]) {
    const gm = new THREE.Mesh(new THREE.BoxGeometry(T.w - 0.05, 0.003, 0.002), gapMat);
    gm.position.set(0, y, T.cz + (T.d - 0.03) / 2 + 0.0005); root.add(gm);
  }
  const vgap = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.7, 0.002), gapMat);
  vgap.position.set(0, -0.4, T.cz + (T.d - 0.03) / 2 + 0.0005); root.add(vgap);

  // ---------------- blob shadows
  const blobTex = radialTexture([[0, 'rgba(0,0,0,0.85)'], [0.45, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  const blobs = [];
  function addBlob(target, sx, sz, opacity, yOff = 0.0006) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); m.renderOrder = -5;
    root.add(m);
    const b = { target, mesh: m, base: opacity, homeY: null, y: yOff };
    blobs.push(b);
    return b;
  }
  const _v = new THREE.Vector3();
  function updateBlobs() {
    const k = sun.castShadow ? 0.55 : 1.0;
    for (const b of blobs) {
      if (b.target) {
        b.target.getWorldPosition(_v);
        if (b.homeY === null) b.homeY = _v.y;
        b.mesh.position.set(_v.x, b.y, _v.z);
        const lift = Math.max(0, _v.y - b.homeY);
        b.mesh.material.opacity = b.base * k * Math.max(0, 1 - lift / 0.12);
      } else {
        b.mesh.material.opacity = b.base * k;
      }
    }
  }

  // ================================================================ TANK
  const TK = L.tank;
  const tank = { group: new THREE.Group(), rimY: TK.h, glassMeshes: [] };
  tank.group.name = 'tank';
  root.add(tank.group);
  const matY = 0.003;
  const mat = new THREE.Mesh(new RoundedBoxGeometry(TK.w + 0.02, matY, TK.d + 0.02, 2, 0.001), new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.8 }));
  mat.position.set(TK.cx, matY / 2, TK.cz); mat.receiveShadow = true; tank.group.add(mat);
  { const b = addBlob(null, TK.w + 0.06, TK.d + 0.06, 0.5); b.mesh.position.set(TK.cx, 0.0005, TK.cz); }

  const G = TK.glass, y0 = matY, H = TK.h;
  const paneMat = glassMat({ opacity: 0.09, color: 0xe6f0ec, env: 1.4 });
  const frontMat = glassMat({ opacity: 0.08, color: 0xe6f0ec, env: 1.4 });
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0x6fae95, roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false, envMapIntensity: 1.2 });
  const x0 = TK.cx - TK.w / 2, x1 = TK.cx + TK.w / 2, z0 = TK.cz - TK.d / 2, z1 = TK.cz + TK.d / 2;
  function pane(w, h, d, x, y, z, m, ro) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.renderOrder = ro; tank.group.add(mesh); tank.glassMeshes.push(mesh);
    return mesh;
  }
  const ph = H - y0;
  pane(TK.w, G, TK.d, TK.cx, y0 + G / 2, TK.cz, paneMat, -2); // bottom
  pane(TK.w, ph, G, TK.cx, y0 + ph / 2, z0 + G / 2, paneMat, -2); // back
  pane(G, ph, TK.d - 2 * G, x0 + G / 2, y0 + ph / 2, TK.cz, paneMat, -2); // left
  pane(G, ph, TK.d - 2 * G, x1 - G / 2, y0 + ph / 2, TK.cz, paneMat, -2); // right
  tank.frontGlass = pane(TK.w, ph, G, TK.cx, y0 + ph / 2, z1 - G / 2, frontMat, 5);
  tank.frontGlass.name = 'frontGlass';
  // 小口（緑がかったガラスの縁）
  const edges = [];
  const eT = 0.0016;
  edges.push(new THREE.BoxGeometry(TK.w + 0.0004, eT, G + 0.0004).translate(TK.cx, H - eT / 2 + 0.0002, z1 - G / 2));
  edges.push(new THREE.BoxGeometry(TK.w + 0.0004, eT, G + 0.0004).translate(TK.cx, H - eT / 2 + 0.0002, z0 + G / 2));
  edges.push(new THREE.BoxGeometry(G + 0.0004, eT, TK.d).translate(x0 + G / 2, H - eT / 2 + 0.0002, TK.cz));
  edges.push(new THREE.BoxGeometry(G + 0.0004, eT, TK.d).translate(x1 - G / 2, H - eT / 2 + 0.0002, TK.cz));
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    const sx = x < 0 ? 1 : -1, sz = z < 0 ? 1 : -1;
    edges.push(new THREE.BoxGeometry(G + 0.0004, ph, 0.0016).translate(x + sx * G / 2, y0 + ph / 2, z - sz * 0.0006));
    edges.push(new THREE.BoxGeometry(0.0016, ph, G + 0.0004).translate(x - sx * 0.0006, y0 + ph / 2, z + sz * G / 2));
  }
  // 底の小口（前）
  edges.push(new THREE.BoxGeometry(TK.w, G, 0.0016).translate(TK.cx, y0 + G / 2, z1 + 0.0002));
  const edgeMesh = new THREE.Mesh(mergeGeometries(edges), edgeMat);
  edgeMesh.renderOrder = 6; tank.group.add(edgeMesh);
  // 内側の角のシリコン
  const silMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe8e4, roughness: 0.25, transparent: true, opacity: 0.22, depthWrite: false });
  const sils = [];
  for (const [x, z] of [[x0 + G, z0 + G], [x1 - G, z0 + G], [x0 + G, z1 - G], [x1 - G, z1 - G]]) {
    sils.push(new THREE.CylinderGeometry(0.0018, 0.0018, ph - 0.006, 6).translate(x, y0 + ph / 2 + 0.002, z));
  }
  const silMesh = new THREE.Mesh(mergeGeometries(sils), silMat); silMesh.renderOrder = -1; tank.group.add(silMesh);

  // ---------------- gravel
  const innerX0 = x0 + G, innerX1 = x1 - G, innerZ0 = z0 + G, innerZ1 = z1 - G;
  const gBottom = y0 + G, gTop = TK.gravelH;
  const gravTex = gravelTexture();
  gravTex.repeat.set(6, 1);
  const gravBaseMat = new THREE.MeshStandardMaterial({ map: gravTex, roughness: 0.85 });
  const gravBaseTopTex = gravTex.clone(); gravBaseTopTex.repeat.set(6, 4); gravBaseTopTex.needsUpdate = true;
  const gravBaseTopMat = new THREE.MeshStandardMaterial({ map: gravBaseTopTex, roughness: 0.9, color: 0xbbbbbb });
  const baseH = gTop - 0.006 - gBottom;
  const gravelBase = new THREE.Mesh(new THREE.BoxGeometry(innerX1 - innerX0, baseH, innerZ1 - innerZ0),
    [gravBaseMat, gravBaseMat, gravBaseTopMat, gravBaseMat, gravBaseMat, gravBaseMat]);
  gravelBase.position.set(TK.cx, gBottom + baseH / 2, TK.cz); gravelBase.receiveShadow = true;
  tank.group.add(gravelBase);
  const pebN = LOW ? 700 : 1400;
  const pebGeo = new THREE.SphereGeometry(1, 10, 7);
  const pebMat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, envMapIntensity: 0.8 });
  const pebbles = new THREE.InstancedMesh(pebGeo, pebMat, pebN);
  const pal = [0xc2ad88, 0xa08462, 0xaea494, 0x86705a, 0xcbbd9f, 0x94704f, 0xbba582, 0x7a7064, 0x6b5a48, 0xa98463];
  const R = rng(99);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), Sv = new THREE.Vector3();
  const marbleC = new THREE.Vector3(L.marble.x, 0.031, L.marble.z);
  const col = new THREE.Color();
  let pi = 0, tries = 0;
  while (pi < pebN && tries < pebN * 3) {
    tries++;
    const r = 0.0024 + Math.pow(R(), 1.5) * 0.0026;
    const x = innerX0 + r + R() * (innerX1 - innerX0 - 2 * r);
    const z = innerZ0 + r + R() * (innerZ1 - innerZ0 - 2 * r);
    const y = gTop - 0.0055 + R() * 0.004;
    P.set(x, y, z);
    if (P.distanceTo(marbleC) < 0.0085 + r * 0.6) continue;
    E.set((R() - 0.5) * 0.6, R() * 6.283, (R() - 0.5) * 0.6); Q.setFromEuler(E);
    Sv.set(r * (1.05 + R() * 0.35), r * (0.6 + R() * 0.25), r * (0.85 + R() * 0.25));
    M4.compose(P, Q, Sv); pebbles.setMatrixAt(pi, M4);
    col.setHex(pal[Math.floor(R() * pal.length)]).multiplyScalar(0.72 + R() * 0.25);
    pebbles.setColorAt(pi, col);
    pi++;
  }
  pebbles.count = pi;
  pebbles.castShadow = true; pebbles.receiveShadow = true;
  tank.group.add(pebbles);

  const props = {};

  // ---------------- pot（横倒しの素焼き鉢）
  {
    const terra = terracottaTexture();
    const potMat = new THREE.MeshStandardMaterial({ map: terra, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const potInMat = new THREE.MeshStandardMaterial({ map: terra, color: 0x9a7a6a, roughness: 0.95, side: THREE.DoubleSide });
    const len = 0.07, rb = 0.022, rm = 0.029, lip = 0.032, t = 0.004;
    const outer = [[0.004, 0], [rb - 0.002, 0], ...arcPts(rb - 0.002, 0.002, 0.002, -Math.PI / 2, 0, 3).slice(1), [rm, len - 0.012], [lip, len - 0.011], [lip, len - 0.001], [lip - 0.001, len]];
    const inner = [[rm - t, len], [rb - t + 0.001, t + 0.002], [0.004, t]];
    const potGeo = lathe([...outer, ...inner], 40);
    const pot = new THREE.Mesh(potGeo, potMat);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, t + 0.001, 16, 1, true), potInMat);
    hole.position.y = t / 2;
    const inside = new THREE.Mesh(lathe(inner.slice().reverse().map(([x, y]) => [x - 0.0003, y]), 40), new THREE.MeshStandardMaterial({ color: 0x6a3a24, roughness: 1, side: THREE.BackSide }));
    const tilt = Math.atan((lip - rb) / len);
    const dir = new THREE.Vector3(-Math.SQRT1_2 * Math.cos(tilt), Math.sin(tilt), Math.SQRT1_2 * Math.cos(tilt)).normalize();
    const group = new THREE.Group();
    group.position.set(L.pot.x, gTop - 0.004 + (rb + lip) / 2, L.pot.z);
    const axis = new THREE.Group();
    axis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const holder = new THREE.Group(); holder.position.y = -len / 2;
    holder.add(pot, hole, inside); axis.add(holder); group.add(axis);
    setShadow(group);
    tank.group.add(group);
    const mouth = group.position.clone().addScaledVector(dir, len / 2);
    const hl = makeHighlighter([potMat]);
    updaters.push(hl.update);
    props.pot = { group, home: group.position.clone(), setHighlight: hl.set, mouth, axis: dir.clone() };
  }

  // ---------------- marble
  {
    const mm = new THREE.MeshPhysicalMaterial({ color: 0x2f74d8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, emissive: 0x0a1c3a, emissiveIntensity: 1 });
    glassify(mm, 0.4, 0.6);
    const group = new THREE.Group(); group.position.copy(marbleC);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.008, 32, 20), mm);
    ball.renderOrder = 1;
    // 中の白い筋（ねじれ）
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.0042, 0.0007, 6, 32, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.3 }));
    swirl.rotation.set(0.6, 0.3, 0.2);
    const glintTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,250,230,0.8)'], [0.4, 'rgba(255,240,200,0.15)'], [1, 'rgba(255,240,200,0)']], 64);
    const glintMat = new THREE.SpriteMaterial({ map: glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false });
    const glint = new THREE.Sprite(glintMat); glint.scale.setScalar(0.03); glint.position.set(-0.003, 0.004, 0.005); glint.renderOrder = 15;
    group.add(swirl, ball, glint);
    ball.castShadow = true;
    tank.group.add(group);
    const hl = makeHighlighter([mm], 2);
    let g = 0;
    updaters.push((dt, t) => {
      hl.update(dt, t);
      g = Math.max(0, g - dt * 2.2);
      glintMat.opacity = g; glint.material.rotation = t * 1.5;
      glint.scale.setScalar(0.015 + g * 0.03);
    });
    props.marble = { group, home: group.position.clone(), setHighlight: hl.set, glint: (v = 1) => { g = Math.max(g, v); } };
  }

  // ---------------- plants（アナカリス風）
  {
    const plantsGroup = new THREE.Group(); tank.group.add(plantsGroup);
    const items = [];
    let swayAll = 1;
    const heights = [0.165, 0.14, 0.12];
    L.plants.forEach((p, idx) => {
      const Rp = rng(200 + idx * 17);
      const H = heights[idx % heights.length];
      const geos = [];
      const nStems = 6 + Math.floor(Rp() * 3);
      const c1 = new THREE.Color();
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.3, 0.2, 1, 0); leafShape.quadraticCurveTo(0.3, -0.2, 0, 0);
      const baseLeaf = new THREE.ShapeGeometry(leafShape, 4);
      baseLeaf.rotateX(Math.PI / 2);
      const addColor = (geo, c) => {
        const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        return geo;
      };
      for (let s = 0; s < nStems; s++) {
        const a = Rp() * 6.283, rr = Math.sqrt(Rp()) * 0.014;
        const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
        const h = H * (0.7 + Rp() * 0.3);
        const lean = (Rp() - 0.5) * 0.06, lean2 = (Rp() - 0.5) * 0.06;
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const f = i / 6;
          pts.push(new THREE.Vector3(bx + lean * f * f + Math.sin(f * 3 + a) * 0.003, -0.004 + h * f, bz + lean2 * f * f));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const stem = new THREE.TubeGeometry(curve, 18, 0.0012, 5, false);
        stem.deleteAttribute('uv');
        geos.push(addColor(stem, c1.setHSL(0.27, 0.45, 0.42)));
        const nW = Math.floor(h / 0.0055);
        for (let w = 1; w <= nW; w++) {
          const f = w / (nW + 1);
          const pt = curve.getPointAt(f);
          const leafLen = (0.017 - 0.008 * Math.pow(f, 3)) * (0.85 + Rp() * 0.3);
          const elev = 0.5 + f * 0.6 + Rp() * 0.2;
          for (let k = 0; k < 3; k++) {
            const ang = w * 1.1 + k * 2.094 + Rp() * 0.3;
            const lg = baseLeaf.clone();
            lg.deleteAttribute('uv');
            lg.scale(leafLen, 1, leafLen * 0.9);
            // ゆるく下向きに曲げる
            const pos = lg.attributes.position;
            for (let i = 0; i < pos.count; i++) { const xx = pos.getX(i); pos.setY(i, pos.getY(i) - xx * xx * 18); }
            lg.rotateZ(elev); lg.rotateY(ang);
            lg.translate(pt.x, pt.y, pt.z);
            lg.computeVertexNormals();
            geos.push(addColor(lg, c1.setHSL(0.24 + Rp() * 0.06, 0.6 + Rp() * 0.15, 0.24 + Rp() * 0.1 + f * 0.1)));
          }
        }
      }
      const geo = mergeGeometries(geos);
      const pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, emissive: 0x081c05, envMapIntensity: 0.5 });
      const uni = { uTime: { value: 0 }, uAmp: { value: 0.006 }, uPoke: { value: 0 }, uPhase: { value: idx * 2.1 }, uH: { value: H } };
      pm.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uni);
        sh.vertexShader = 'uniform float uTime, uAmp, uPoke, uPhase, uH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          float hN = clamp(position.y / uH, 0.0, 1.3);
          float sw = hN * hN;
          transformed.x += (sin(uTime * 1.3 + uPhase + position.y * 16.0) * uAmp + sin(uTime * 6.5 + uPhase) * uPoke) * sw;
          transformed.z += (cos(uTime * 1.05 + uPhase * 1.3 + position.y * 12.0) * uAmp * 0.7 + cos(uTime * 5.3 + uPhase) * uPoke * 0.6) * sw;
        `);
      };
      pm.customProgramCacheKey = () => 'plant' + idx;
      const mesh = new THREE.Mesh(geo, pm);
      mesh.receiveShadow = true; mesh.frustumCulled = false;
      const g = new THREE.Group(); g.position.set(p.x, gTop - 0.002, p.z); g.add(mesh);
      plantsGroup.add(g);
      items.push({ group: g, mesh, mat: pm, uni, poke: 0 });
    });
    const hl = makeHighlighter(items.map((i) => i.mat), 1.5);
    updaters.push((dt, t) => {
      hl.update(dt, t);
      for (const it of items) {
        it.poke *= Math.exp(-dt * 1.6);
        it.uni.uTime.value = t; it.uni.uAmp.value = 0.006 * swayAll; it.uni.uPoke.value = 0.022 * it.poke;
      }
    });
    props.plants = {
      group: plantsGroup, home: plantsGroup.position.clone(), items, setHighlight: hl.set,
      poke: (i, s = 1) => { const it = items[i]; if (it) it.poke = Math.min(1.5, it.poke + s); },
      setSway: (v) => { swayAll = v; },
    };
  }

  // ---------------- air stone + tube
  {
    const stoneMat = new THREE.MeshStandardMaterial({ map: speckleTexture('#7a8794', 'rgba(50,60,70,1)', 'rgba(200,210,220,1)', 3500, 52), roughness: 0.95, bumpMap: bubbleBumpTexture(), bumpScale: 1.2 });
    const group = new THREE.Group(); group.position.set(L.airStone.x, L.airStone.y, L.airStone.z);
    const sh = 0.025, sr = 0.0115;
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(sr, sr, sh, 32), stoneMat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0x3d4650, roughness: 0.5 }));
    cap.position.y = sh / 2 + 0.002;
    const nip = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.008, 12), new THREE.MeshStandardMaterial({ color: 0x3d4650, roughness: 0.5 }));
    nip.position.y = sh / 2 + 0.007;
    group.add(stone, cap, nip); setShadow(group);
    tank.group.add(group);
    const topW = new THREE.Vector3(L.airStone.x, L.airStone.y + sh / 2, L.airStone.z);
    // チューブ（world 固定）
    const ax = L.airStone.x, az = L.airStone.z;
    const AP = L.airPump;
    const nozzle = new THREE.Vector3(AP.x + AP.w / 2 + 0.008, 0.022, AP.z - 0.012);
    const pts = [
      new THREE.Vector3(ax, L.airStone.y + sh / 2 + 0.008, az),
      new THREE.Vector3(ax, L.airStone.y + 0.03, az),
      new THREE.Vector3(ax - 0.02, 0.09, az - 0.015),
      new THREE.Vector3(-0.188, 0.16, -0.12),
      new THREE.Vector3(-0.19, 0.235, -0.12),
      new THREE.Vector3(-0.194, 0.258, -0.118),
      new THREE.Vector3(-0.2, 0.2655, -0.115),
      new THREE.Vector3(-0.207, 0.258, -0.11),
      new THREE.Vector3(-0.21, 0.2, -0.09),
      new THREE.Vector3(-0.218, 0.08, -0.06),
      new THREE.Vector3(-0.235, 0.025, -0.04),
      new THREE.Vector3(nozzle.x + 0.012, 0.022, nozzle.z),
      nozzle.clone(),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const tubeMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f5f3, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.2 });
    glassify(tubeMat, 0.6, 0.6);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.0024, 10, false), tubeMat);
    tube.renderOrder = 2;
    root.add(tube);
    const hl = makeHighlighter([stoneMat]);
    updaters.push(hl.update);
    props.airStone = { group, home: group.position.clone(), setHighlight: hl.set, top: topW, tube };
  }

  // ================================================================ TOOLS
  // ---------------- net
  {
    const N = L.net;
    const group = new THREE.Group(); group.position.set(N.x, N.y, N.z); group.rotation.y = N.rotY || 0;
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x2f8a46, roughness: 0.38, metalness: 0.05, envMapIntensity: 0.9 });
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(N.hoopR, 0.0017, 8, 72), wireMat);
    hoop.rotation.x = Math.PI / 2;
    group.add(hoop);
    // 柄: 2 本よりのワイヤ
    const ang = 35 * Math.PI / 180;
    const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
    const side = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
    const zA = new THREE.Vector3(0, 0, 1);
    const start = new THREE.Vector3(N.hoopR, 0, 0);
    const wireLen = N.handle - 0.075;
    const strands = [];
    for (let s = 0; s < 2; s++) {
      const pts = [];
      for (let i = 0; i <= 120; i++) {
        const f = i / 120, l = f * wireLen;
        const a = l / 0.008 * 6.283 + s * Math.PI;
        const r = 0.0011 * smooth(0, 0.01, l);
        pts.push(start.clone().addScaledVector(dir, l).addScaledVector(side, Math.cos(a) * r).addScaledVector(zA, Math.sin(a) * r));
      }
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.00105, 6, false));
    }
    // 輪の付け根（輪の両側から柄へ）
    for (const sgn of [-1, 1]) {
      const a0 = sgn * 0.35;
      const p0 = new THREE.Vector3(Math.cos(a0) * N.hoopR, 0, Math.sin(a0) * N.hoopR);
      const p1 = start.clone().addScaledVector(dir, 0.012);
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p0.clone().lerp(p1, 0.5).add(new THREE.Vector3(0.002, 0, sgn * 0.002)), p1]), 20, 0.0012, 6, false));
    }
    const handleWire = new THREE.Mesh(mergeGeometries(strands), wireMat);
    group.add(handleWire);
    // 持ち手（緑のプラスチック）
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x2b7a3e, roughness: 0.35, metalness: 0, envMapIntensity: 1 });
    const gripLen = 0.075;
    const gripProf = [[0, 0], [0.0035, 0.001], [0.0048, 0.006], [0.0055, gripLen * 0.5], [0.005, gripLen - 0.006], [0.0042, gripLen - 0.0015], [0.0025, gripLen], [0, gripLen]];
    const grip = new THREE.Mesh(lathe(gripProf, 24), gripMat);
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    grip.position.copy(start).addScaledVector(dir, wireLen - 0.004);
    const holeR = new THREE.Mesh(new THREE.TorusGeometry(0.0028, 0.0012, 8, 20), gripMat);
    holeR.position.copy(start).addScaledVector(dir, N.handle - 0.0005); holeR.rotation.z = ang;
    group.add(grip, holeR);
    // 網の袋
    const nTex = netTexture(); nTex.repeat.set(10, 3);
    const bagMat = new THREE.MeshStandardMaterial({ map: nTex, color: 0xf6f6f2, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8, alphaTest: 0.02, opacity: 0.95 });
    const depth = 0.05;
    const bagProf = [];
    for (let i = 0; i <= 16; i++) {
      const f = i / 16; // 0=底 1=輪
      const y = -depth * (1 - f);
      const r = N.hoopR * (0.12 + 0.88 * Math.sin(f * Math.PI / 2) ** 0.8);
      bagProf.push([i === 0 ? 0.0005 : r * 0.99, y]);
    }
    const bag = new THREE.Mesh(lathe(bagProf, 48), bagMat);
    bag.renderOrder = 3; bag.castShadow = true;
    group.add(bag);
    const bagBottom = new THREE.Object3D(); bagBottom.position.y = -depth; group.add(bagBottom);
    setShadow(hoop); setShadow(handleWire); setShadow(grip);
    root.add(group);
    const hl = makeHighlighter([wireMat, gripMat, bagMat], 1.2);
    updaters.push(hl.update);
    props.net = {
      group, home: group.position.clone(), setHighlight: hl.set, bagBottom, bag,
      setSag: (v) => { const s = 1 + 0.6 * Math.max(0, Math.min(1, v)); bag.scale.set(1 - 0.08 * v, s, 1 - 0.08 * v); bagBottom.position.y = -depth * s; },
      setWet: (v) => { bagMat.color.setRGB(0.96 - 0.25 * v, 0.96 - 0.22 * v, 0.95 - 0.2 * v); bagMat.roughness = 0.8 - 0.5 * v; },
    };
  }

  // ---------------- bowl（金魚鉢）
  {
    const B = L.bowl, Rb = B.r, top = B.h, tG = 0.0035;
    const cy = top - 0.003 - Math.sqrt(Rb * Rb - B.mouthR * B.mouthR); // 球の中心高さ（≈0.0838）
    const Ri = Rb - tG;
    const group = new THREE.Group(); group.position.set(B.x, 0, B.z);
    const tilt = new THREE.Group(); tilt.position.y = cy; group.add(tilt);
    const holder = new THREE.Group(); holder.position.y = -cy; tilt.add(holder);
    const phi = (y, r) => Math.acos(Math.max(-1, Math.min(1, (cy - y) / r)));
    const prof = [];
    const p0 = phi(0, Rb), p1 = phi(top - 0.0025, Rb);
    prof.push([0, 0]);
    for (let i = 0; i <= 44; i++) { const a = p0 + (p1 - p0) * i / 44; prof.push([Rb * Math.sin(a), cy - Rb * Math.cos(a)]); }
    const oTop = prof[prof.length - 1];
    const q1 = phi(top - 0.0025, Ri), iBot = 0.009, q0 = phi(iBot, Ri);
    const iTop = [Ri * Math.sin(q1), cy - Ri * Math.cos(q1)];
    const lc = [(oTop[0] + iTop[0]) / 2, top - 0.0025];
    const lr = (oTop[0] - iTop[0]) / 2;
    prof.push(...arcPts(lc[0], lc[1], lr, 0, Math.PI, 8).slice(1, -1));
    for (let i = 0; i <= 44; i++) { const a = q1 + (q0 - q1) * i / 44; prof.push([Ri * Math.sin(a), cy - Ri * Math.cos(a)]); }
    prof.push([0, iBot]);
    const bowlMat = glassMat({ opacity: 0.1, color: 0xe8f2ee, env: 1.5, edge: 0.55, spec: 1.0 });
    const glass = new THREE.Mesh(lathe(prof, 64), bowlMat);
    glass.renderOrder = 4;
    holder.add(glass);
    // 口の小口（うっすら緑）
    const lipMat = new THREE.MeshPhysicalMaterial({ color: 0x8cc4ad, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 1.3 });
    const lip = new THREE.Mesh(new THREE.TorusGeometry(lc[0], lr * 1.02, 8, 64), lipMat);
    lip.rotation.x = Math.PI / 2; lip.position.y = lc[1]; lip.renderOrder = 4;
    holder.add(lip);
    // 底の厚いガラス
    const baseMat = new THREE.MeshPhysicalMaterial({ color: 0xa8d0c0, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
    const bRad = Math.sqrt(Rb * Rb - cy * cy);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(bRad * 0.98, bRad * 0.98, iBot - 0.001, 48), baseMat);
    base.position.y = iBot / 2; base.renderOrder = 3; holder.add(base);
    // 水（球のキャップ。tilt の逆回転で常に水平）
    const waterGroup = new THREE.Group(); tilt.add(waterGroup);
    const waterMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe9ee, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.2 });
    glassify(waterMat, 0.35, 0.7);
    const water = new THREE.Mesh(new THREE.BufferGeometry(), waterMat);
    water.renderOrder = 3; waterGroup.add(water);
    const Rw = Ri - 0.0006;
    let level = 1, wy = B.waterY;
    function rebuildWater() {
      wy = iBot + 0.0005 + (B.waterY - iBot) * level;
      water.visible = level > 0.003;
      if (!water.visible) return;
      const a0 = phi(iBot + 0.0005, Rw), a1 = phi(wy, Rw);
      const pr = [[0, iBot + 0.0005]];
      for (let i = 0; i <= 28; i++) { const a = a0 + (a1 - a0) * i / 28; pr.push([Rw * Math.sin(a), cy - Rw * Math.cos(a)]); }
      pr.push([0, wy]);
      water.geometry.dispose();
      water.geometry = lathe(pr, 56).translate(0, -cy, 0);
    }
    rebuildWater();
    const mouth = new THREE.Object3D(); mouth.position.set(0, top, 0); holder.add(mouth);
    root.add(group);
    addBlob(group, Rb * 1.4, Rb * 1.4, 0.45);
    const hl = makeHighlighter([bowlMat, lipMat, baseMat], 2.2);
    updaters.push(hl.update);
    const _w = new THREE.Vector3();
    props.bowl = {
      group, home: group.position.clone(), setHighlight: hl.set, tilt, mouth, glass,
      inner: { centerY: cy, radius: Ri - 0.01 },
      setTilt: (rad) => { tilt.rotation.z = rad; waterGroup.rotation.z = -rad; },
      setWaterLevel: (v) => { const nv = Math.max(0, Math.min(1, v)); if (Math.abs(nv - level) > 0.002 || (nv === 0) !== (level === 0)) { level = nv; rebuildWater(); } },
      waterSurfaceY: () => { _w.set(0, wy - cy, 0); waterGroup.localToWorld(_w); return _w.y; },
    };
  }

  // ---------------- sponge
  {
    const S = L.sponge, tex = spongeTextures();
    const group = new THREE.Group(); group.position.set(S.x, S.h / 2, S.z);
    group.rotation.y = 0.12;
    const yh = S.h - 0.008;
    tex.y.repeat.set(1.2, 1.2); tex.yb.repeat.copy(tex.y.repeat);
    const yMat = new THREE.MeshStandardMaterial({ map: tex.y, bumpMap: tex.yb, bumpScale: 2.5, roughness: 0.95, envMapIntensity: 0.5 });
    const gMat = new THREE.MeshStandardMaterial({ map: tex.g, bumpMap: tex.gb, bumpScale: 2, roughness: 0.9, envMapIntensity: 0.4 });
    const yBox = new THREE.Mesh(new RoundedBoxGeometry(S.w, yh, S.d, 3, 0.005), yMat);
    yBox.position.y = -S.h / 2 + yh / 2;
    const gBox = new THREE.Mesh(new RoundedBoxGeometry(S.w - 0.001, 0.0085, S.d - 0.001, 2, 0.0015), gMat);
    gBox.position.y = S.h / 2 - 0.004;
    group.add(yBox, gBox); setShadow(group);
    root.add(group);
    addBlob(group, S.w * 1.3, S.d * 1.4, 0.4);
    const hl = makeHighlighter([yMat, gMat], 1.0);
    updaters.push(hl.update);
    props.sponge = { group, home: group.position.clone(), setHighlight: hl.set };
  }

  // ---------------- pail
  {
    const P = L.pail;
    const rb = P.r - 0.016, rt = P.r - 0.002, h = P.h, t = 0.0025;
    const group = new THREE.Group(); group.position.set(P.x, 0, P.z);
    const pailMat = new THREE.MeshPhysicalMaterial({ color: 0x2c69b0, roughness: 0.42, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.9 });
    const rAt = (y) => rb + (rt - rb) * (y / h);
    const prof = [[0, 0.002], [rb - 0.006, 0.002], [rb - 0.004, 0], [rb, 0.004], [rAt(h - 0.004), h - 0.004], [rAt(h), h],
      [rAt(h) - t, h], [rAt(h - 0.006) - t, h - 0.006], [rb - t, 0.008], [0, 0.007]];
    const shell = new THREE.Mesh(lathe(prof, 56), pailMat);
    // 補強リブ
    const rib1 = new THREE.Mesh(new THREE.TorusGeometry(rAt(h - 0.022) + 0.0005, 0.0018, 8, 64), pailMat);
    rib1.rotation.x = Math.PI / 2; rib1.position.y = h - 0.022;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rt + 0.0015, 0.0032, 10, 64), pailMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = h - 0.001;
    // 取っ手（つる）
    const bailMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.35 });
    const earY = h - 0.012;
    const ears = [];
    for (const s of [-1, 1]) ears.push(new THREE.BoxGeometry(0.004, 0.014, 0.01).translate(s * (rAt(earY) + 0.002), earY, 0));
    const earMesh = new THREE.Mesh(mergeGeometries(ears), pailMat);
    const bailR = rAt(earY) + 0.006;
    const bailPts = [];
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * i / 40;
      bailPts.push(new THREE.Vector3(Math.cos(a) * bailR, Math.sin(a) * bailR * 0.75, 0));
    }
    const bail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bailPts), 60, 0.0016, 8, false), bailMat);
    const gripB = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.035, 16), bailMat);
    gripB.rotation.z = Math.PI / 2; gripB.position.y = bailR * 0.75;
    const bailG = new THREE.Group(); bailG.add(bail, gripB); bailG.position.y = earY; bailG.rotation.x = -1.25;
    group.add(shell, rib1, rim, earMesh, bailG);
    // 水面
    const wMat = new THREE.MeshPhysicalMaterial({ color: 0x6f8a3c, roughness: 0.08, transparent: true, opacity: 0.85, envMapIntensity: 1.1, depthWrite: false });
    const wDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), wMat);
    wDisc.rotation.x = -Math.PI / 2; wDisc.visible = false; wDisc.renderOrder = 2;
    group.add(wDisc);
    setShadow(group); wDisc.castShadow = false;
    root.add(group);
    addBlob(group, P.r * 2.3, P.r * 2.3, 0.5);
    const hl = makeHighlighter([pailMat, bailMat], 1.0);
    updaters.push(hl.update);
    const yMin = 0.012, yMax = 0.115;
    let wy = yMin;
    const _w = new THREE.Vector3();
    props.pail = {
      group, home: group.position.clone(), setHighlight: hl.set,
      setFill: (v, colorHex) => {
        v = Math.max(0, Math.min(1, v));
        wDisc.visible = v > 0.002;
        wy = yMin + (yMax - yMin) * v;
        const r = rAt(wy) - t - 0.0005;
        wDisc.position.y = wy; wDisc.scale.set(r, r, 1);
        if (colorHex !== undefined) wMat.color.setHex(colorHex);
      },
      waterY: () => { _w.set(0, wy, 0); group.localToWorld(_w); return _w.y; },
    };
  }

  const _bc = new THREE.Vector3();
  // ---------------- pump（手押しポンプ）
  {
    const PU = L.pump;
    const group = new THREE.Group(); group.position.set(PU.x, 0, PU.z);
    const tubeBot = 0.04, bulbH = 0.07, bulbR = 0.025;
    const bulbBot = PU.bulbY - bulbH / 2;
    const clearMat = glassMat({ opacity: 0.12, color: 0xf0f4f2, env: 1.4, edge: 0.6, spec: 0.9, roughness: 0.06 });
    const rigid = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, bulbBot - tubeBot + 0.006, 32, 1, true), clearMat);
    rigid.position.y = (bulbBot + tubeBot) / 2 + 0.003; rigid.renderOrder = 6;
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.0092, 0.0009, 6, 32), new THREE.MeshPhysicalMaterial({ color: 0xa8ccc0, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false }));
    rimRing.rotation.x = Math.PI / 2; rimRing.position.y = tubeBot; rimRing.renderOrder = 6;
    // 中を流れる水
    const fTex = flowTexture();
    const flowMat = new THREE.MeshStandardMaterial({ map: fTex, color: 0x9fb070, transparent: true, opacity: 0, depthWrite: false, roughness: 0.3 });
    fTex.repeat.set(1, 6);
    const flowIn = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0078, bulbBot - tubeBot, 20, 1, true), flowMat);
    flowIn.position.y = (bulbBot + tubeBot) / 2; flowIn.visible = false; flowIn.renderOrder = 5;
    group.add(rigid, rimRing, flowIn);
    // じゃばら
    const red = new THREE.MeshPhysicalMaterial({ color: 0x9c1813, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.9 });
    const bp = [[0.0102, 0], [0.012, 0.002], [0.019, 0.005]];
    const ribs = 8, r0 = 0.0065, r1 = bulbH - 0.0065;
    for (let i = 0; i <= ribs * 8; i++) {
      const f = i / (ribs * 8), y = r0 + (r1 - r0) * f;
      bp.push([bulbR - 0.0018 + 0.0018 * Math.cos(f * ribs * 2 * Math.PI), y]);
    }
    bp.push([0.019, bulbH - 0.004], [0.013, bulbH - 0.0012], [0.008, bulbH], [0, bulbH + 0.0005]);
    const bulbMesh = new THREE.Mesh(lathe(bp, 48), red);
    const bulbG = new THREE.Group(); bulbG.position.y = bulbBot; bulbG.add(bulbMesh);
    // 上の空気穴キャップ・根元の白いカラー
    const capMat = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.4 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0065, 0.004, 24), capMat);
    cap.position.y = bulbH + 0.002; bulbG.add(cap);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.008, 32), capMat);
    collar.position.y = bulbBot - 0.002;
    group.add(bulbG, collar);
    // 横の吐出口
    const nipY = bulbBot + 0.012;
    const nip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 16), capMat);
    nip.rotation.z = Math.PI / 2; nip.position.set(bulbR + 0.004, nipY - bulbBot, 0);
    bulbG.add(nip);
    // フチのクリップ
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.5 });
    const clipGeo = mergeGeometries([
      new THREE.BoxGeometry(0.022, 0.004, 0.016).translate(0.014 - 0.0, 0.002, 0),
      new THREE.BoxGeometry(0.003, 0.02, 0.016).translate(0.0275, -0.008, 0),
      new THREE.BoxGeometry(0.003, 0.016, 0.016).translate(0.0218, -0.006, 0),
      new THREE.CylinderGeometry(0.0115, 0.0115, 0.006, 24, 1, true).translate(0, 0.001, 0),
    ]);
    const clip = new THREE.Mesh(clipGeo, clipMat);
    clip.position.y = L.tank.h;
    group.add(clip);
    // ホース（world 座標で作って group ローカルへ）
    const gp = group.position;
    const nipW = new THREE.Vector3(PU.x + bulbR + 0.012, nipY, PU.z);
    const pa = L.pail;
    const hoseEndW = new THREE.Vector3(pa.x - 0.02, 0.075, pa.z + 0.005);
    const hp = [nipW, new THREE.Vector3(nipW.x + 0.02, nipY + 0.008, PU.z + 0.004), new THREE.Vector3(0.265, nipY - 0.0, PU.z + 0.018),
      new THREE.Vector3(0.3, nipY - 0.06, pa.z), new THREE.Vector3(hoseEndW.x - 0.004, 0.15, pa.z + 0.004), hoseEndW.clone()];
    const hCurve = new THREE.CatmullRomCurve3(hp.map((p) => p.clone().sub(gp)), false, 'centripetal');
    const hoseMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f7f5, roughness: 0.18, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.2 });
    glassify(hoseMat, 0.65, 0.7);
    const hose = new THREE.Mesh(new THREE.TubeGeometry(hCurve, 120, 0.0055, 12, false), hoseMat);
    hose.renderOrder = 6;
    const hfTex = fTex.clone(); hfTex.repeat.set(14, 1); hfTex.needsUpdate = true;
    const hFlowMat = flowMat.clone(); hFlowMat.map = hfTex;
    const hoseFlow = new THREE.Mesh(new THREE.TubeGeometry(hCurve, 120, 0.0038, 8, false), hFlowMat);
    hoseFlow.visible = false; hoseFlow.renderOrder = 5;
    group.add(hose, hoseFlow);
    setShadow(bulbG); clip.castShadow = true; collar.castShadow = true;
    root.add(group);
    const bulbCenter = new THREE.Vector3(PU.x, PU.bulbY, PU.z);
    const hl = makeHighlighter([red], 1.4);
    let flow = 0;
    updaters.push((dt, t) => {
      hl.update(dt, t);
      if (flow > 0) { fTex.offset.y -= dt * 1.6; hfTex.offset.x -= dt * 2.2; }
    });
    props.pump = {
      group, home: group.position.clone(), setHighlight: hl.set, bulbCenter, hoseEnd: hoseEndW,
      squeeze: (v) => {
        v = Math.max(0, Math.min(1, v));
        const sy = 1 - 0.45 * v, sxz = 1 + 0.12 * v;
        bulbMesh.scale.set(sxz, sy, sxz);
        cap.position.y = bulbH * sy + 0.002;
        _bc.set(0, bulbBot + bulbH * sy / 2, 0); group.localToWorld(_bc); bulbCenter.copy(_bc);
      },
      setFlow: (v) => {
        flow = Math.max(0, Math.min(1, v));
        flowMat.opacity = hFlowMat.opacity = 0.75 * flow;
        flowIn.visible = hoseFlow.visible = flow > 0.01;
      },
    };
  }


  // ---------------- pitcher
  {
    const PI = L.pitcher;
    const h = PI.h, rt = PI.r, rb = PI.r - 0.004, t = 0.002, baseT = 0.004;
    const pivotY = h / 2;
    const group = new THREE.Group(); group.position.set(PI.x, 0, PI.z);
    const tilt = new THREE.Group(); tilt.position.y = pivotY; group.add(tilt);
    const holder = new THREE.Group(); holder.position.y = -pivotY; tilt.add(holder);
    const rAt = (y) => rb + (rt - rb) * (y / h);
    const prof = [[0, 0], [rb - 0.004, 0], ...arcPts(rb - 0.004, 0.004, 0.004, -Math.PI / 2, 0, 4).slice(1), [rAt(h - 0.002), h - 0.002],
      ...arcPts(rAt(h) - t / 2, h - 0.002, t / 2, 0, Math.PI, 4).slice(1), [rAt(h - 0.004) - t, h - 0.004], [rb - t, baseT + 0.002], [rb - t - 0.002, baseT], [0, baseT]];
    const geo = lathe(prof, 64);
    // 注ぎ口（-X 側の上端を外へ引き出す）
    const pos = geo.attributes.position;
    const spoutAng = Math.atan2(-1, 0);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const hw = smooth(h - 0.045, h, y);
      if (hw <= 0) continue;
      const a = Math.atan2(x, z);
      let d = a - spoutAng; d = Math.atan2(Math.sin(d), Math.cos(d));
      const w = Math.exp(-((d / 0.36) ** 2)) * hw * hw;
      const r = Math.hypot(x, z), nr = r + 0.017 * w;
      if (r > 1e-5) { pos.setX(i, x / r * nr); pos.setZ(i, z / r * nr); }
      pos.setY(i, y + 0.005 * w);
    }
    geo.computeVertexNormals();
    const pMat = glassMat({ opacity: 0.1, color: 0xf2f5f4, env: 1.4, edge: 0.55, spec: 0.9, roughness: 0.05 });
    const body = new THREE.Mesh(geo, pMat); body.renderOrder = 4;
    holder.add(body);
    // 小口の縁取り（プラスチックのフチが少し白っぽく見える）
    const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xe8efee, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false });
    // 取っ手
    const hMat = new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.32, envMapIntensity: 1 });
    const hc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rAt(0.155) - 0.002, 0.155, 0), new THREE.Vector3(rAt(0.155) + 0.022, 0.158, 0), new THREE.Vector3(rAt(0.15) + 0.036, 0.135, 0),
      new THREE.Vector3(rAt(0.1) + 0.036, 0.09, 0), new THREE.Vector3(rAt(0.05) + 0.03, 0.045, 0), new THREE.Vector3(rAt(0.035) - 0.002, 0.03, 0)]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(hc, 64, 0.0055, 12, false), hMat);
    handle.scale.z = 1.5;
    holder.add(handle);
    // 目盛り（数字なしの短い横線）
    const marks = [];
    for (let i = 0; i < 6; i++) {
      const y = 0.035 + i * 0.022, long = i % 2 === 1;
      const len = long ? 0.014 : 0.008, r = rAt(y) + 0.0004;
      const a0 = -0.35; // 正面やや左
      const g = new THREE.BoxGeometry(len, 0.0011, 0.0005);
      g.rotateY(-a0); g.translate(Math.sin(a0) * r - (long ? 0 : 0.003) * Math.cos(a0), y, Math.cos(a0) * r);
      marks.push(g);
    }
    const markMat = new THREE.MeshStandardMaterial({ color: 0x5f86b0, roughness: 0.5, transparent: true, opacity: 0.85 });
    const markMesh = new THREE.Mesh(mergeGeometries(marks), markMat); markMesh.renderOrder = 5;
    holder.add(markMesh);
    // 水（world 水平のクリップ面で切る）
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const wMat = new THREE.MeshPhysicalMaterial({ color: 0xd4ecf2, roughness: 0.04, transparent: true, opacity: 0.17, depthWrite: false, envMapIntensity: 1.2, clippingPlanes: [clipPlane] });
    glassify(wMat, 0.35, 0.7);
    const innerH = h - baseT - 0.006;
    const wGeo = new THREE.CylinderGeometry(rAt(h) - t - 0.0008, rb - t - 0.0008, innerH, 40);
    wGeo.translate(0, baseT + 0.0005 + innerH / 2, 0);
    const water = new THREE.Mesh(wGeo, wMat); water.renderOrder = 3;
    holder.add(water);
    const sMat = new THREE.MeshPhysicalMaterial({ color: 0xd4ecf2, roughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.4, side: THREE.DoubleSide });
    glassify(sMat, 0.3, 0.9);
    const surf = new THREE.Mesh(new THREE.CircleGeometry(1, 48), sMat); surf.rotation.x = -Math.PI / 2; surf.renderOrder = 3;
    group.add(surf);
    const spout = new THREE.Object3D(); spout.position.set(-(rt + 0.017), h + 0.005, 0); holder.add(spout);
    root.add(group);
    handle.castShadow = true;
    addBlob(group, rt * 2.6, rt * 2.6, 0.35);
    let fill = 1, tiltA = 0;
    const _a = new THREE.Vector3();
    function syncWater() {
      const s = baseT + 0.0005 + innerH * fill;
      water.visible = surf.visible = fill > 0.005;
      _a.set(0, s - pivotY, 0); tilt.localToWorld(_a);
      clipPlane.constant = _a.y;
      group.worldToLocal(_a);
      surf.position.copy(_a);
      const r = rAt(s) - t - 0.0008;
      const c = Math.max(0.3, Math.cos(tiltA));
      surf.scale.set(r / c, r, 1);
    }
    syncWater();
    updaters.push(syncWater);
    const hl = makeHighlighter([pMat, hMat, markMat], 1.4);
    updaters.push(hl.update);
    props.pitcher = {
      group, home: group.position.clone(), setHighlight: hl.set, tilt, spout,
      setFill: (v) => { fill = Math.max(0, Math.min(1, v)); syncWater(); },
      setTilt: (rad) => { tiltA = rad; tilt.rotation.z = rad; syncWater(); },
    };
    void rimMat;
  }

  // ---------------- air pump
  {
    const A = L.airPump;
    const group = new THREE.Group(); group.position.set(A.x, 0, A.z);
    const bodyG = new THREE.Group(); group.add(bodyG);
    const feetH = 0.004;
    const shellMat = new THREE.MeshPhysicalMaterial({ color: 0x8394a3, roughness: 0.5, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.9 });
    const box = new THREE.Mesh(new RoundedBoxGeometry(A.w, A.h - feetH, A.d, 4, 0.009), shellMat);
    box.position.y = feetH + (A.h - feetH) / 2;
    // 上下の継ぎ目
    const seam = new THREE.Mesh(new RoundedBoxGeometry(A.w + 0.0006, 0.0012, A.d + 0.0006, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x4d5864, roughness: 0.7 }));
    seam.position.y = feetH + 0.014;
    const rubber = new THREE.MeshStandardMaterial({ color: 0x222224, roughness: 0.9 });
    const feet = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) feet.push(new THREE.CylinderGeometry(0.006, 0.0065, feetH, 16).translate(sx * (A.w / 2 - 0.012), feetH / 2, sz * (A.d / 2 - 0.011)));
    const feetMesh = new THREE.Mesh(mergeGeometries(feet), rubber);
    // ボタン
    const topY = A.h;
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x5b6773, roughness: 0.45 });
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0235, 0.002, 48), bezelMat);
    const bx = -0.008, bz = 0.002;
    bezel.position.set(bx, topY + 0.0008, bz);
    const btnMat = new THREE.MeshPhysicalMaterial({ color: 0xe6f3e4, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 1 });
    const btnProf = [[0, 0.0072], [0.012, 0.0068], [0.0175, 0.0058], [0.0195, 0.0042], [0.02, 0.0025], [0.02, -0.004], [0, -0.004]];
    const btn = new THREE.Mesh(lathe(btnProf, 48), btnMat);
    const btnG = new THREE.Group(); btnG.position.set(bx, topY + 0.0018, bz); btnG.add(btn);
    // ランプ
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x1f4a2a, roughness: 0.2, emissive: 0x000000 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lampMat);
    lamp.position.set(A.w / 2 - 0.014, topY, A.d / 2 - 0.013);
    const lampRing = new THREE.Mesh(new THREE.TorusGeometry(0.0031, 0.0006, 6, 20), bezelMat);
    lampRing.rotation.x = Math.PI / 2; lampRing.position.copy(lamp.position);
    const lampGlowTex = radialTexture([[0, 'rgba(160,255,160,1)'], [0.3, 'rgba(90,230,110,0.5)'], [1, 'rgba(60,200,80,0)']], 64);
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }));
    lampGlow.scale.setScalar(0.018); lampGlow.position.copy(lamp.position).add(new THREE.Vector3(0, 0.002, 0));
    // 吐出口（+X 側面）
    const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.003, 0.01, 12), bezelMat);
    nz.rotation.z = Math.PI / 2; nz.position.set(A.w / 2 + 0.004, 0.022, -0.012);
    bodyG.add(box, seam, feetMesh, bezel, btnG, lamp, lampRing, lampGlow, nz);
    setShadow(bodyG); lampGlow.castShadow = false;
    // 電源コード（後ろへ）
    const cordPts = [new THREE.Vector3(A.x - 0.02, 0.012, A.z - A.d / 2), new THREE.Vector3(A.x - 0.025, 0.004, A.z - A.d / 2 - 0.03),
      new THREE.Vector3(A.x - 0.045, 0.003, -0.2), new THREE.Vector3(A.x - 0.06, 0.003, -0.275), new THREE.Vector3(A.x - 0.065, -0.02, -0.293), new THREE.Vector3(A.x - 0.065, -0.3, -0.295)];
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 60, 0.0015, 8, false), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.6 }));
    setShadow(cord);
    root.add(cord);
    root.add(group);
    addBlob(group, A.w * 1.35, A.d * 1.5, 0.45);
    const btnTopLocal = new THREE.Vector3(bx, topY + 0.0018 + 0.0072, bz);
    const buttonCenter = btnTopLocal.clone().add(group.position);
    let on = false, pressV = 0, lampV = 0;
    const hl = makeHighlighter([btnMat, shellMat], 1.2);
    function syncBtn() {
      const d = Math.max(on ? 0.003 : 0, 0.003 * pressV);
      btnG.position.y = topY + 0.0018 - d;
      buttonCenter.set(bx, btnTopLocal.y - d, bz); group.localToWorld(buttonCenter);
    }
    updaters.push((dt, t) => {
      hl.update(dt, t);
      lampV += ((on ? 1 : 0) - lampV) * Math.min(1, dt * 10);
      lampMat.emissive.setRGB(0.2 * lampV, 1.6 * lampV, 0.35 * lampV);
      lampMat.color.setRGB(0.12 + 0.3 * lampV, 0.29 + 0.5 * lampV, 0.16 + 0.2 * lampV);
      lampGlow.material.opacity = 0.9 * lampV;
      if (on) bodyG.position.set(Math.sin(t * 377) * 0.00018, Math.abs(Math.sin(t * 311)) * 0.00012, Math.cos(t * 291) * 0.00012);
      else bodyG.position.set(0, 0, 0);
    });
    props.airPump = {
      group, home: group.position.clone(), setHighlight: hl.set, buttonCenter,
      setOn: (b) => { on = !!b; syncBtn(); },
      press: (v) => { pressV = Math.max(0, Math.min(1, v)); syncBtn(); },
    };
  }

  // ---------------- food can
  {
    const F = L.foodCan;
    const r = F.r, h = F.h;
    const group = new THREE.Group(); group.position.set(F.x, 0, F.z);
    const tilt = new THREE.Group(); tilt.position.y = h / 2; group.add(tilt);
    const holder = new THREE.Group(); holder.position.y = -h / 2; tilt.add(holder);
    const plastic = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.35, clearcoat: 0.3, envMapIntensity: 0.9 });
    const neckR = r - 0.003, t = 0.0015;
    const prof = [[0, 0.001], [r - 0.002, 0], [r, 0.002], [r, h - 0.012], [r - 0.0005, h - 0.0105], [neckR, h - 0.009], [neckR, h], [neckR - t, h], [neckR - t, 0.006], [0, 0.005]];
    const can = new THREE.Mesh(lathe(prof, 48), plastic);
    // ネジ山
    const threads = [];
    for (let i = 0; i < 2; i++) threads.push(new THREE.TorusGeometry(neckR + 0.0004, 0.0007, 6, 48).rotateX(Math.PI / 2).translate(0, h - 0.0065 + i * 0.003, 0));
    const thr = new THREE.Mesh(mergeGeometries(threads), plastic);
    // ラベル
    const lTex = labelTexture(); lTex.wrapT = THREE.ClampToEdgeWrapping;
    const labelMat = new THREE.MeshStandardMaterial({ map: lTex, roughness: 0.55, envMapIntensity: 0.8 });
    const label = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0004, r + 0.0004, h - 0.022, 48, 1, true), labelMat);
    label.position.y = 0.006 + (h - 0.022) / 2; label.rotation.y = -0.6;
    // フレーク
    const flakeY = h - 0.016;
    const fillDisc = new THREE.Mesh(new THREE.CircleGeometry(neckR - t, 32), new THREE.MeshStandardMaterial({ color: 0x6a3a1e, roughness: 0.9 }));
    fillDisc.rotation.x = -Math.PI / 2; fillDisc.position.y = flakeY;
    const Rf = rng(123);
    const flakeN = 140;
    const flakeGeo = new THREE.CircleGeometry(0.0028, 5);
    const flakes = new THREE.InstancedMesh(flakeGeo, new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide }), flakeN);
    const fc = [0x8a3b1c, 0xb4502a, 0x6e3a1f, 0xc9772f, 0x9c2f22, 0x7b5a2a];
    for (let i = 0; i < flakeN; i++) {
      const a = Rf() * 6.283, rr = Math.sqrt(Rf()) * (neckR - t - 0.003);
      P.set(Math.cos(a) * rr, flakeY + 0.0005 + Rf() * 0.003, Math.sin(a) * rr);
      E.set(-Math.PI / 2 + (Rf() - 0.5) * 1.0, (Rf() - 0.5) * 1.0, Rf() * 6.283); Q.setFromEuler(E);
      Sv.set(0.6 + Rf() * 0.8, 0.4 + Rf() * 0.8, 1);
      M4.compose(P, Q, Sv); flakes.setMatrixAt(i, M4);
      flakes.setColorAt(i, col.setHex(fc[Math.floor(Rf() * fc.length)]));
    }
    holder.add(can, thr, label, fillDisc, flakes);
    setShadow(holder);
    const mouth = new THREE.Object3D(); mouth.position.y = h; holder.add(mouth);
    root.add(group);
    addBlob(group, r * 2.8, r * 2.8, 0.45);
    // ふた（外して右奥に置いてある、口を上に向けて）
    const knurl = knurlTexture();
    const lidMat = new THREE.MeshPhysicalMaterial({ color: 0xf2c21b, roughness: 0.38, clearcoat: 0.3, bumpMap: knurl, bumpScale: 0.6, envMapIntensity: 0.9 });
    const lr = r + 0.0015, lh = 0.013;
    const lidProf = [[0, 0], [lr - 0.0015, 0], [lr, 0.0015], [lr, lh - 0.001], [lr - 0.001, lh], [lr - 0.0025, lh], [lr - 0.0025, 0.0025], [0, 0.0022]];
    const lid = new THREE.Mesh(lathe(lidProf, 48), lidMat);
    lid.position.set(F.x + 0.042, 0, F.z - 0.045);
    setShadow(lid);
    root.add(lid);
    const lidBlob = addBlob(null, lr * 2.6, lr * 2.6, 0.4); lidBlob.mesh.position.set(lid.position.x, 0.0006, lid.position.z);
    const hl = makeHighlighter([labelMat, plastic, lidMat], 1.2);
    updaters.push(hl.update);
    props.foodCan = {
      group, home: group.position.clone(), setHighlight: hl.set, tilt, mouth, lid,
      setTilt: (rad) => { tilt.rotation.z = rad; },
    };
  }

  // ================================================================ halo
  const haloTex = radialTexture([[0, 'rgba(255,214,150,1)'], [0.25, 'rgba(255,190,110,0.55)'], [0.6, 'rgba(255,160,80,0.16)'], [1, 'rgba(255,150,70,0)']], 128);
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true, opacity: 0, toneMapped: false });
  const haloSprite = new THREE.Sprite(haloMat); haloSprite.renderOrder = 20; haloSprite.visible = false;
  root.add(haloSprite);
  let haloOn = false, haloV = 0, haloR = 0.08;
  const halo = {
    sprite: haloSprite,
    set: (pos, radius = 0.08) => {
      if (pos) { haloSprite.position.copy(pos); haloR = radius; haloOn = true; haloSprite.visible = true; }
      else haloOn = false;
    },
  };
  updaters.push((dt, t) => {
    haloV += ((haloOn ? 1 : 0) - haloV) * Math.min(1, dt * 4);
    if (!haloOn && haloV < 0.003) { haloV = 0; haloSprite.visible = false; }
    const br = 0.5 + 0.5 * Math.sin(t * 2.4);
    haloMat.opacity = haloV * (0.45 + 0.3 * br);
    haloSprite.scale.setScalar(haloR * 2 * (0.94 + 0.1 * br));
  });

  // ================================================================ time of day
  const sunDay = new THREE.Color(0xfff4e6), sunEve = new THREE.Color(0xffb46a);
  const skyDay = new THREE.Color(0xfff5e8), skyEve = new THREE.Color(0xffd2a0);
  const gndDay = new THREE.Color(0xa88a68), gndEve = new THREE.Color(0x8a5a3a);
  const winDay = new THREE.Color(0.075, 0.072, 0.064), winEve = new THREE.Color(0.2, 0.11, 0.045);
  const posDay = new THREE.Vector3(-1.05, 1.15, 0.7), posEve = new THREE.Vector3(-1.45, 0.55, 0.75);
  function setTimeOfDay(v) {
    v = Math.max(0, Math.min(1, v));
    sun.color.copy(sunDay).lerp(sunEve, v);
    sun.intensity = 1.9 - 0.5 * v;
    sun.position.copy(posDay).lerp(posEve, v);
    hemi.color.copy(skyDay).lerp(skyEve, v);
    hemi.groundColor.copy(gndDay).lerp(gndEve, v);
    hemi.intensity = 0.4 - 0.15 * v;
    if ('environmentIntensity' in scene) scene.environmentIntensity = 0.62 - 0.27 * v;
    winMat.color.copy(winDay).lerp(winEve, v);
    winPatch.position.set(-0.12 + 0.14 * v, 0.56 - 0.12 * v, L.wallZ + 0.002);
    winPatch.scale.set(1 + 0.35 * v, 1 - 0.15 * v, 1);
    if (scene.background && scene.background.isColor) scene.background.copy(bgDay).lerp(bgEve, v);
  }
  setTimeOfDay(0);

  // ================================================================ quality
  function applyQuality() {
    const low = !!(engine.quality && engine.quality.low);
    sun.castShadow = !low;
    sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  if (quality.onChange) quality.onChange(() => applyQuality());

  // props.*.home を確定
  for (const k of Object.keys(props)) props[k].home = props[k].group.position.clone();
  props.sponge.setHighlight(0);

  const world = {
    root, tank, props, halo, sun, hemi,
    setTimeOfDay,
    update(dt, t) {
      dt = Math.min(dt || 0, 0.1);
      for (const u of updaters) u(dt, t);
      updateBlobs();
    },
  };
  updateBlobs();
  return world;
}
