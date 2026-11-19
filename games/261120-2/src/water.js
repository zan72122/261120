// water.js — 水槽の水（にごり・水面・水際線・コケ・泡・コースティクス・きらきら・もや）と、世界全体の水しぶき等の FX。
//
// ============================== 公開 API ==============================
// import { createTankWater, createFX, murkOrderForZ } from './water.js'
// engine = { THREE, renderer, scene, camera, quality }   quality.particleBudget（既定 300, low は 150 程度）を粒子上限に使う
//
// createTankWater(engine) -> tw          L.tank の内側の水。tw.group は呼び出し側が scene.add（原点のまま。子は world 座標）
//   tw.level, tw.murk                    現在値（初期値: level = L.tank.waterFull, murk = 1）
//   tw.setLevel(y)                       水面の高さ world y（L.tank.waterLow..waterFull 想定、0.02..waterFull+0.01 にクランプ）
//                                        にごりの層・水面・水際線（メニスカス）・コースティクスの見え方が追従
//   tw.setMurk(v)                        0 = すっきり透明（ごく淡い水色の体積感）, 1 = 抹茶色ににごり奥が見えない
//   tw.algae.wipeAt(worldPoint, radius m, strength 0..1) -> number
//                                        前面ガラス内側（z ≒ L.tank.maxZ - glass - 0.0005）の点をやわらかい円ブラシでふく。
//                                        x,y だけ使う（z は無視）。戻り値 = 今回ふき取れた量（初期の全コケ量に対する割合 0..1）
//   tw.algae.coverage() -> 0..1          残っているコケの割合
//   tw.algae.clearAll(fadeSec = 0.8)     残りをすっと消す
//   tw.algae.reset()                     最初の全面コケに戻す
//   tw.algae.serialize() -> string       20×13 グリッド（260 文字, 各 '0'..'z' = 残量 0..1）
//   tw.algae.restore(str)
//   tw.ripple(x, z, strength = 1)        水面に同心円の波紋（最大 8 個同時）
//   tw.surfaceGlint(v = 1)               水面のさざ波の強さ（0 = 鏡のよう, 1 = ふつう, 2 = 強め）
//   tw.bubbles.emit(pos, count, { size = 0.004, spread = 0.01, speed = 1 })   水中を上る泡（size = 直径 m）。水面で消える
//   tw.bubbles.setStream(on, pos, rate = 14)   エアストーンからの連続泡（大小まざり、ゆらゆら）
//   tw.onBubblePop = (pos) => {}         任意。泡が水面で消えた時に呼ぶ（最短 0.12 秒間隔に間引き）。pos は使い回しの Vector3
//   tw.caustics.set(v 0..1)              砂利の上の光の網。実際の明るさ = v × (1-murk)^2
//   tw.sparkle(durationSec = 2.5)        水全体にきらきらの粒が舞って消える（澄みきった瞬間に）
//   tw.swirl(pos, strength = 1)          にごりの中に澄んだ水が混ざる白っぽいもや（注水点に毎秒数回呼ぶ想定）
//   tw.update(dt, t)
//   tw.inner = { x0, x1, z0, z1, yBottom }   水の内寸（world）
//
// createFX(engine) -> fx                 世界全体の粒子。fx.group を呼び出し側が scene.add（原点のまま）
//   fx.splash(pos, size = 1 /*0.5 小 .. 2 大*/, colorHex = 0xffffff)   しぶきが弧を描いて飛び、pos.y より少し下で消える
//   fx.drips(posOrObject3D, count = 5, toY = pos.y - 0.25)   ぽたぽた（0.18〜0.45 秒おき）。Object3D を渡すと毎滴その world 位置から落ちる
//   fx.onDripLand = (pos) => {}          任意。水滴が toY に着いた時（水面の波紋などに使う）
//   fx.stream.set(id, from: Vector3 | null, toY, { width = 0.006, colorHex = 0xcfe8ff, opacity = 0.7 })
//                                        id ごとの落水。毎フレーム呼んで from を動かしてよい。null で上から切れて消える
//   fx.onStreamLand = (id, pos, dt) => {}  任意。落水が toY に届いている間、毎フレーム（泡・波紋をここで出すとよい）
//   fx.flakes.surfaceY                   水面 y（既定 L.tank.waterFull）。外から書く
//   fx.flakes.emit(pos, count)           えさのフレーク。ひらひら落ち → 水槽の上なら水面に浮く（2.5〜5 秒）→ ゆっくり沈んで砂利の上で止まる
//                                        水槽の外なら y=0（テーブル）に落ちて止まる
//   fx.flakes.items                      [{ pos: Vector3, alive: boolean, state: 'fall'|'float'|'sink'|'rest' }] 添字は eat 用（空きは再利用）
//   fx.flakes.eat(index)
//   fx.update(dt, t)
//
// murkOrderForZ(zWorld) -> renderOrder   水中の透明物（ひれ・泡）を、にごりの層の間に差し込むための値（fish.js が使用）
//
// ---------- 描画順（renderOrder）一覧 ----------
//   10        コースティクス（砂利の上、加算）
//   11..19    にごりの層 9 枚（奥 → 手前）。水中の透明物は murkOrderForZ で 11+k+0.5（層 k と k+1 の間）。水槽より手前 = 19.5
//   26        水面（上面の板）
//   27        水際線（メニスカス）
//   28        きらきら（加算）
//   29        落水の筋
//   30        前面ガラス内側のコケ、しぶき・水滴（水槽外の粒子）
//   ※ world 側のガラス（透明）は renderOrder 40 以上にしてもらう前提。水関連はすべて depthWrite=false。
//   ※ えさのフレークは不透明（renderOrder 0）。
// 契約からの差分: fx.drips に第 3 引数 toY と Object3D 受け付けを追加。tw.algae.reset / tw.inner / fx.onDripLand / fx.onStreamLand を追加。
// ======================================================================
import * as THREE from 'three';
import { L } from './layout.js';

const T = L.tank;
const IN = {
  x0: T.minX + T.glass, x1: T.maxX - T.glass,
  z0: T.minZ + T.glass, z1: T.maxZ - T.glass,
  yBottom: T.glass,
};
const NLAYER = 9;
const LAYER_Z = [];
for (let k = 0; k < NLAYER; k++) LAYER_Z.push(IN.z0 + 0.004 + (k * (IN.z1 - IN.z0 - 0.007)) / (NLAYER - 1));

export function murkOrderForZ(z) {
  let k = -1;
  for (let i = 0; i < NLAYER; i++) if (z > LAYER_Z[i]) k = i;
  return 11 + k + 0.5;
}

// ---------- utils ----------
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
// 周期 (px, py) の 2D value noise
function pnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a, p) => ((a % p) + p) % p;
  const h = (dx, dy) => hash2(m(xi + dx, px), m(yi + dy, py), s);
  return mix(mix(h(0, 0), h(1, 0), u), mix(h(0, 1), h(1, 1), u), v);
}
function pfbm(x, y, px, py, s, oct = 4) {
  let a = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { a += amp * pnoise(x * f, y * f, px * f, py * f, s + i * 31); n += amp; amp *= 0.5; f *= 2; }
  return a / n;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

let NOISE_TEX = null;
function noiseTexture() {
  if (NOISE_TEX) return NOISE_TEX;
  const S = 128, cv = canvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = pfbm((x / S) * 4, (y / S) * 4, 4, 4, 7, 4);
    const n2 = pfbm((x / S) * 8, (y / S) * 8, 8, 8, 19, 3);
    const i = (y * S + x) * 4;
    img.data[i] = n * 255; img.data[i + 1] = n2 * 255; img.data[i + 2] = 128; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  NOISE_TEX = new THREE.CanvasTexture(cv);
  NOISE_TEX.wrapS = NOISE_TEX.wrapT = THREE.RepeatWrapping;
  NOISE_TEX.colorSpace = THREE.NoColorSpace;
  return NOISE_TEX;
}

function halfHeight(renderer, v2) {
  if (!renderer || !renderer.getDrawingBufferSize) return 400;
  renderer.getDrawingBufferSize(v2);
  return v2.y * 0.5 || 400;
}

// 丸い粒（Points）用シェーダ。style: 0=泡, 1=水滴, 2=もや, 3=きらきら
function pointsMaterial(style, blending = THREE.NormalBlending) {
  return new THREE.ShaderMaterial({
    uniforms: { uHalfH: { value: 400 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
      varying float vA; varying vec3 vC;
      uniform float uHalfH;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * projectionMatrix[1][1] * uHalfH / max(-mv.z, 0.01), 1.5, 256.0);
        vA = aAlpha; vC = aColor;
      }`,
    fragmentShader: /* glsl */`
      varying float vA; varying vec3 vC;
      void main(){
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float r = length(c);
        if (r > 1.0) discard;
        float a; vec3 col;
        #if STYLE == 0
          float rim = smoothstep(0.55, 0.92, r) * (1.0 - smoothstep(0.92, 1.0, r));
          float hl = 1.0 - smoothstep(0.0, 0.32, length(c - vec2(-0.35, -0.38)));
          a = (0.07 + rim * 0.75 + hl * 0.85) * vA;
          col = mix(vC, vec3(1.0), hl * 0.8 + rim * 0.2);
        #elif STYLE == 1
          float hl = 1.0 - smoothstep(0.0, 0.4, length(c - vec2(-0.3, -0.35)));
          float edge = smoothstep(0.6, 1.0, r);
          a = (0.45 + 0.35 * edge + hl * 0.5) * (1.0 - smoothstep(0.85, 1.0, r)) * vA;
          col = mix(vC * 0.85, vec3(1.0), hl);
        #elif STYLE == 2
          a = pow(1.0 - r * r, 2.0) * vA;
          col = vC;
        #else
          float core = pow(max(0.0, 1.0 - r), 3.0);
          float star = max(0.0, 1.0 - abs(c.x) * 6.0) * max(0.0, 1.0 - abs(c.y) * 1.2) + max(0.0, 1.0 - abs(c.y) * 6.0) * max(0.0, 1.0 - abs(c.x) * 1.2);
          a = (core + star * 0.5) * vA;
          col = vC;
        #endif
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    defines: { STYLE: style },
    transparent: true, depthWrite: false, blending,
  });
}

// 粒子プール（Points 1 個）
function makePool(max, style, blending) {
  const geo = new THREE.BufferGeometry();
  const P = new Float32Array(max * 3), S = new Float32Array(max), A = new Float32Array(max), Cc = new Float32Array(max * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(S, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(A, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(Cc, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mat = pointsMaterial(style, blending);
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const list = [];
  return {
    pts, list, max, mat,
    add(o) { if (list.length >= max) return null; list.push(o); return o; },
    flush() {
      const n = list.length;
      for (let i = 0; i < n; i++) {
        const o = list[i];
        P[i * 3] = o.p.x; P[i * 3 + 1] = o.p.y; P[i * 3 + 2] = o.p.z;
        S[i] = o.size; A[i] = o.alpha;
        Cc[i * 3] = o.c.r; Cc[i * 3 + 1] = o.c.g; Cc[i * 3 + 2] = o.c.b;
      }
      geo.setDrawRange(0, n);
      for (const k of ['position', 'aSize', 'aAlpha', 'aColor']) geo.attributes[k].needsUpdate = true;
    },
    meanZ() { if (!list.length) return 0; let z = 0; for (const o of list) z += o.p.z; return z / list.length; },
  };
}

// ======================================================================
export function createTankWater(engine = {}) {
  const renderer = engine.renderer;
  const budget = Math.max(60, engine.quality?.particleBudget ?? 300);
  const group = new THREE.Group();
  group.name = 'tankWater';
  const W = IN.x1 - IN.x0, D = IN.z1 - IN.z0, CX = (IN.x0 + IN.x1) / 2, CZ = (IN.z0 + IN.z1) / 2;
  const uTime = { value: 0 };
  const v2 = new THREE.Vector2();
  let time = 0;

  const tw = { group, level: T.waterFull, murk: 1, inner: { ...IN }, onBubblePop: null };

  // ---------- にごりの層 ----------
  const murkClear = new THREE.Color(0xd4ecf0);
  const murkFront = new THREE.Color(0x8a9c48);
  const murkBack = new THREE.Color(0x4f6a2a);
  const layerGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const layers = [];
  const layerVS = /* glsl */`
    varying vec3 vW;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const layerFS = /* glsl */`
    uniform sampler2D uNoise; uniform float uTime, uOpacity, uK, uMurk, uLevel;
    uniform vec3 uColA, uColB;
    varying vec3 vW;
    void main(){
      vec2 p = vW.xy;
      float n = texture2D(uNoise, p * 2.6 + vec2(uTime * 0.0035 + uK * 0.37, uTime * 0.0016 + uK * 0.11)).r;
      float n2 = texture2D(uNoise, p * 6.5 + vec2(-uTime * 0.005 + uK * 0.23, uK * 0.41)).g;
      float m = n * 0.65 + n2 * 0.35;
      float a = uOpacity * mix(1.0, 0.72 + 0.6 * m, uMurk);
      a *= 1.0 + 0.3 * uMurk * clamp((0.09 - vW.y) / 0.07, 0.0, 1.0);
      float topFade = smoothstep(0.0, 0.004, uLevel - vW.y);
      vec3 col = mix(uColA, uColB, m);
      col *= mix(1.0, 1.08, clamp((vW.y - uLevel + 0.06) / 0.06, 0.0, 1.0) * uMurk);
      gl_FragColor = vec4(col, clamp(a * topFade, 0.0, 1.0));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  for (let k = 0; k < NLAYER; k++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uNoise: { value: noiseTexture() }, uTime, uOpacity: { value: 0.1 }, uK: { value: k }, uMurk: { value: 1 }, uLevel: { value: T.waterFull },
        uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() },
      },
      vertexShader: layerVS, fragmentShader: layerFS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(layerGeo, mat);
    m.position.set(CX, IN.yBottom, LAYER_Z[k]);
    m.renderOrder = 11 + k;
    m.frustumCulled = false;
    group.add(m);
    layers.push(m);
  }

  // ---------- 水面 ----------
  const rip = [];
  for (let i = 0; i < 8; i++) rip.push(new THREE.Vector4(0, 0, -100, 0));
  let ripI = 0;
  const surfU = { uTime, uRip: { value: rip }, uWave: { value: 1 }, uMurkS: { value: 1 } };
  const surfMat = new THREE.MeshStandardMaterial({
    color: 0xcfe6ee, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.18,
    depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.3,
  });
  surfMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, surfU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPosW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPosW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPosW; uniform float uTime; uniform vec4 uRip[8]; uniform float uWave; uniform float uMurkS;
        vec2 wv(vec2 p, vec2 d, float k, float w, float a){ return d * (a * k * cos(dot(d, p) * k + uTime * w)); }`)
      .replace('#include <normal_fragment_maps>', `
        {
          vec2 p = vWPosW.xz;
          vec2 g = vec2(0.0);
          g += wv(p, normalize(vec2(1.0, 0.3)), 160.0, 2.1, 0.00011);
          g += wv(p, normalize(vec2(-0.4, 1.0)), 230.0, 2.9, 0.00007);
          g += wv(p, normalize(vec2(-1.0, -0.6)), 330.0, 3.7, 0.00004);
          g += wv(p, normalize(vec2(0.7, -1.0)), 470.0, 4.6, 0.000025);
          g *= uWave;
          for (int i = 0; i < 8; i++) {
            vec4 r = uRip[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 3.0 || r.w <= 0.0) continue;
            vec2 dp = p - r.xy; float d = length(dp) + 1e-4;
            float R = age * 0.11; float x = d - R;
            float env = exp(-x * x / (0.00012 + age * 0.0005)) * exp(-age * 1.3) * r.w;
            g += (cos(x * 300.0) * 0.12 * env) * dp / d;
          }
          vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz) * faceDirection;
        }`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          float fres = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 4.0);
          gl_FragColor.a = clamp(diffuseColor.a + fres * 0.75, 0.0, 0.95);
        }`);
  };
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), surfMat);
  surf.position.set(CX, T.waterFull, CZ);
  surf.renderOrder = 26;
  group.add(surf);

  // ---------- 水際線（メニスカス） ----------
  const menCv = canvas(4, 32), mctx = menCv.getContext('2d');
  const mg = mctx.createLinearGradient(0, 0, 0, 32);
  mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(0.45, 'rgba(255,255,255,1)'); mg.addColorStop(0.6, 'rgba(230,245,255,0.7)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = mg; mctx.fillRect(0, 0, 4, 32);
  const menTex = new THREE.CanvasTexture(menCv);
  const menMat = new THREE.MeshBasicMaterial({ map: menTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const menH = 0.0024;
  const menisci = [];
  const addMen = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, menH), menMat);
    m.position.set(x, T.waterFull, z); m.rotation.y = ry; m.renderOrder = 27;
    group.add(m); menisci.push(m);
  };
  addMen(W, CX, IN.z1 - 0.0004, 0);
  addMen(W, CX, IN.z0 + 0.0004, 0);
  addMen(D, IN.x0 + 0.0004, CZ, Math.PI / 2);
  addMen(D, IN.x1 - 0.0004, CZ, Math.PI / 2);

  // ---------- コースティクス ----------
  const causU = { uTime, uI: { value: 0 } };
  const causMat = new THREE.ShaderMaterial({
    uniforms: causU,
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uI; varying vec3 vW;
      float caust(vec2 q, float t){
        vec2 i = q; float c = 1.0; float inten = 0.005;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1.0 - (3.5 / float(n + 1)));
          i = q + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(q.x / (sin(i.x + tt) / inten), q.y / (cos(i.y + tt) / inten)));
        }
        c /= 4.0; c = 1.17 - pow(c, 1.4);
        return pow(abs(c), 8.0);
      }
      void main(){
        vec2 p = vW.xz;
        float a = caust(p * 85.0 + vec2(250.0 + uTime * 0.05, 250.0 + uTime * 0.02), uTime * 0.35 + 23.0);
        float b = caust(p.yx * 68.0 + vec2(260.0 - uTime * 0.04, 243.0 + uTime * 0.03), uTime * 0.28 + 7.0);
        float c = pow(clamp(min(a, 1.0) * 0.6 + min(b, 1.0) * 0.4, 0.0, 1.0), 1.6);
        vec2 e = min(vW.xz - vec2(${IN.x0.toFixed(4)}, ${IN.z0.toFixed(4)}), vec2(${IN.x1.toFixed(4)}, ${IN.z1.toFixed(4)}) - vW.xz);
        float edge = smoothstep(0.0, 0.03, min(e.x, e.y));
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.86) * c * uI * edge * 0.3, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const caus = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), causMat);
  caus.position.set(CX, T.gravelH + 0.004, CZ);
  caus.renderOrder = 10;
  caus.visible = false;
  group.add(caus);
  let causTarget = 0, causNow = 0;
  tw.caustics = { set(v) { causTarget = clamp(v, 0, 1); }, get value() { return causTarget; } };

  // ---------- コケ ----------
  const AW = 256, AH = 160;
  const AY0 = IN.yBottom + 0.001, AY1 = T.waterFull + 0.009;
  const AZ = T.maxZ - T.glass - 0.0005;
  const m0 = new Float32Array(AW * AH), mm = new Float32Array(AW * AH), streak = new Float32Array(AW * AH);
  let total0 = 0, totalNow = 0;
  const colCv = canvas(AW, AH), cctx = colCv.getContext('2d'), cimg = cctx.createImageData(AW, AH);
  const maskCv = canvas(AW, AH), kctx = maskCv.getContext('2d'), kimg = kctx.createImageData(AW, AH);
  const yAt = (py) => AY1 - ((py + 0.5) / AH) * (AY1 - AY0);
  {
    const rnd = mulberry32(77);
    for (let py = 0; py < AH; py++) {
      const y = yAt(py);
      for (let px = 0; px < AW; px++) {
        const fx = px / AW, fy = py / AH;
        const n = pfbm(fx * 5, fy * 3.2, 1000, 1000, 3, 5);
        const n2 = pfbm(fx * 22, fy * 14, 1000, 1000, 9, 3);
        const spot = pfbm(fx * 95, fy * 60, 1000, 1000, 13, 2);
        // 量: 斑で、水際と底の近くが濃い。水面より上はぎざぎざに薄れる
        let a = 0.6 + (n - 0.5) * 0.7 + (n2 - 0.5) * 0.22;
        a += 0.2 * Math.exp(-((y - (T.waterFull - 0.006)) ** 2) / 0.00006);
        a += 0.12 * sstep(0.06, IN.yBottom + 0.01, y);
        const top = T.waterFull + 0.002 + (n2 - 0.5) * 0.008 + (n - 0.5) * 0.006;
        a *= sstep(top + 0.002, top - 0.002, y);
        if (spot > 0.7) a = Math.min(1, a + 0.25 * sstep(0.7, 0.8, spot));
        a = clamp(a, 0, 1) * 0.6;
        const i = py * AW + px;
        m0[i] = a; mm[i] = a; total0 += a;
        streak[i] = 0.72 + 0.28 * pfbm(fx * 60, fy * 6, 1000, 1000, 21, 2);
        // 色: くすんだ緑の膜に、濃い点（群体）と茶色みのむら
        let r = 74 + 26 * (n2 - 0.5), g = 92 + 30 * (n2 - 0.5) + 14 * (n - 0.5), b = 40 + 10 * (n - 0.5);
        const br = sstep(0.12, 0.04, y) * 0.5 + (n - 0.5) * 0.4;
        r += 26 * br; g += 4 * br; b -= 6 * br;
        if (spot > 0.7) { const k = sstep(0.7, 0.82, spot); r *= 1 - 0.3 * k; g *= 1 - 0.22 * k; b *= 1 - 0.25 * k; }
        if (rnd() < 0.006) { r *= 0.62; g *= 0.68; b *= 0.6; }
        const j = i * 4;
        cimg.data[j] = clamp(r, 0, 255); cimg.data[j + 1] = clamp(g, 0, 255); cimg.data[j + 2] = clamp(b, 0, 255); cimg.data[j + 3] = 255;
      }
    }
    cctx.putImageData(cimg, 0, 0);
    totalNow = total0;
  }
  let dirty = [0, 0, AW, AH];
  const writeMask = () => {
    if (!dirty) return;
    const [x0, y0, x1, y1] = dirty;
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = py * AW + px, v = mm[i] * 255, j = i * 4;
      kimg.data[j] = kimg.data[j + 1] = kimg.data[j + 2] = v; kimg.data[j + 3] = 255;
    }
    kctx.putImageData(kimg, 0, 0, x0, y0, x1 - x0, y1 - y0);
    maskTex.needsUpdate = true;
    dirty = null;
  };
  const colTex = new THREE.CanvasTexture(colCv); colTex.colorSpace = THREE.SRGBColorSpace;
  const maskTex = new THREE.CanvasTexture(maskCv); maskTex.colorSpace = THREE.NoColorSpace;
  writeMask();
  const algaeMat = new THREE.MeshStandardMaterial({
    map: colTex, alphaMap: maskTex, transparent: true, depthWrite: false, roughness: 1, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.6,
    color: 0xffffff,
  });
  const algaeMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, AY1 - AY0), algaeMat);
  algaeMesh.position.set(CX, (AY0 + AY1) / 2, AZ);
  algaeMesh.renderOrder = 30;
  group.add(algaeMesh);
  let fade = null;
  const markDirty = (x0, y0, x1, y1) => {
    if (!dirty) dirty = [x0, y0, x1, y1];
    else dirty = [Math.min(dirty[0], x0), Math.min(dirty[1], y0), Math.max(dirty[2], x1), Math.max(dirty[3], y1)];
  };
  const GX = 20, GY = 13, DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
  tw.algae = {
    mesh: algaeMesh,
    wipeAt(pt, radius = 0.02, strength = 1) {
      const cx = ((pt.x - IN.x0) / W) * AW, cy = ((AY1 - pt.y) / (AY1 - AY0)) * AH;
      const rx = (radius / W) * AW, ry = (radius / (AY1 - AY0)) * AH;
      const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(AW, Math.ceil(cx + rx) + 1);
      const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(AH, Math.ceil(cy + ry) + 1);
      if (x0 >= x1 || y0 >= y1) return 0;
      const s = clamp(strength, 0, 1);
      let removed = 0;
      for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
        const dx = (px + 0.5 - cx) / rx, dy = (py + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        const fall = 1 - sstep(0.45, 1.0, d);
        const i = py * AW + px;
        const before = mm[i];
        if (before <= 0) continue;
        let after = before * (1 - s * fall * 0.88 * streak[i]);
        if (after < 0.025) after = 0;
        mm[i] = after; removed += before - after;
      }
      totalNow -= removed;
      markDirty(x0, y0, x1, y1);
      return total0 > 0 ? removed / total0 : 0;
    },
    coverage() { return total0 > 0 ? clamp((totalNow / total0) * (fade ? 1 - fade.t / fade.dur : 1), 0, 1) : 0; },
    clearAll(fadeSec = 0.8) { fade = { t: 0, dur: Math.max(0.01, fadeSec) }; },
    reset() { mm.set(m0); totalNow = total0; fade = null; algaeMat.opacity = 1; markDirty(0, 0, AW, AH); },
    serialize() {
      let s = '';
      for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
        let a = 0, b = 0;
        const px0 = Math.floor((gx * AW) / GX), px1 = Math.floor(((gx + 1) * AW) / GX);
        const py0 = Math.floor((gy * AH) / GY), py1 = Math.floor(((gy + 1) * AH) / GY);
        for (let py = py0; py < py1; py++) for (let px = px0; px < px1; px++) { a += mm[py * AW + px]; b += m0[py * AW + px]; }
        const r = b > 1e-4 ? a / b : 0;
        s += DIG[Math.round(clamp(r, 0, 1) * 35)];
      }
      return s;
    },
    restore(str) {
      if (typeof str !== 'string' || str.length < GX * GY) return;
      const g = new Float32Array(GX * GY);
      for (let i = 0; i < GX * GY; i++) g[i] = Math.max(0, DIG.indexOf(str[i])) / 35;
      totalNow = 0;
      for (let py = 0; py < AH; py++) for (let px = 0; px < AW; px++) {
        const fx = clamp(((px + 0.5) / AW) * GX - 0.5, 0, GX - 1), fy = clamp(((py + 0.5) / AH) * GY - 0.5, 0, GY - 1);
        const ix = Math.min(GX - 2, Math.floor(fx)), iy = Math.min(GY - 2, Math.floor(fy));
        const tx = fx - ix, ty = fy - iy;
        const r = mix(mix(g[iy * GX + ix], g[iy * GX + ix + 1], tx), mix(g[(iy + 1) * GX + ix], g[(iy + 1) * GX + ix + 1], tx), ty);
        const i = py * AW + px;
        mm[i] = r < 0.03 ? 0 : m0[i] * r; totalNow += mm[i];
      }
      fade = null; algaeMat.opacity = 1;
      markDirty(0, 0, AW, AH);
    },
  };

  // ---------- 泡 ----------
  const bub = makePool(budget, 0);
  group.add(bub.pts);
  const rnd = mulberry32(5);
  const bubCol = new THREE.Color(0xcfe6f2);
  let popCD = 0;
  const popPos = new THREE.Vector3();
  const spawnBubble = (pos, size, spread, speed) => {
    const d = size * (0.6 + rnd() * 0.8);
    bub.add({
      p: new THREE.Vector3(pos.x + (rnd() - 0.5) * spread * 2, pos.y + (rnd() - 0.5) * spread * 0.5, pos.z + (rnd() - 0.5) * spread * 2),
      size: d, alpha: 0, age: 0,
      vy: (0.07 + d * 14) * speed * (0.85 + rnd() * 0.3),
      ph: rnd() * 6.28, fr: 5 + rnd() * 6, wob: 0.0015 + d * 0.25, c: bubCol, grow: 1 + rnd() * 0.4,
    });
  };
  let stream = { on: false, pos: new THREE.Vector3(L.airStone.x, L.airStone.y, L.airStone.z), rate: 14, acc: 0 };
  tw.bubbles = {
    emit(pos, count = 6, o = {}) {
      const size = o.size ?? 0.004, spread = o.spread ?? 0.01, speed = o.speed ?? 1;
      for (let i = 0; i < count; i++) spawnBubble(pos, size, spread, speed);
    },
    setStream(on, pos, rate = 14) {
      stream.on = !!on;
      if (pos) stream.pos.copy(pos);
      stream.rate = rate;
    },
    get count() { return bub.list.length; },
  };

  // ---------- きらきら ----------
  const spk = makePool(140, 3, THREE.AdditiveBlending);
  spk.pts.renderOrder = 28;
  group.add(spk.pts);
  tw.sparkle = (dur = 2.5) => {
    const n = 120;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color().setHSL(0.52 + rnd() * 0.12, 0.4, 0.85);
      spk.add({
        p: new THREE.Vector3(mix(IN.x0 + 0.01, IN.x1 - 0.01, rnd()), mix(T.gravelH + 0.01, tw.level - 0.005, rnd()), mix(IN.z0 + 0.01, IN.z1 - 0.01, rnd())),
        size: 0.003 + rnd() * 0.004, alpha: 0, age: -rnd() * dur * 0.5, life: dur * (0.4 + rnd() * 0.5), ph: rnd() * 6.28, c,
        vy: 0.004 + rnd() * 0.006,
      });
    }
  };

  // ---------- もや ----------
  const sw = makePool(60, 2);
  group.add(sw.pts);
  const swCol = new THREE.Color(0xe6eee0);
  tw.swirl = (pos, strength = 1) => {
    const n = Math.max(1, Math.round(3 * strength));
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28;
      sw.add({
        p: new THREE.Vector3(pos.x + (rnd() - 0.5) * 0.01, Math.min(pos.y, tw.level - 0.004) - rnd() * 0.01, pos.z + (rnd() - 0.5) * 0.01),
        v: new THREE.Vector3(Math.cos(a) * 0.012, -0.015 - rnd() * 0.02, Math.sin(a) * 0.012),
        size: 0.012, alpha: 0, age: 0, life: 2.2 + rnd() * 1.4, peak: 0.22 * clamp(strength, 0.2, 2), c: swCol, grow: 0.03 + rnd() * 0.03,
      });
    }
  };

  // ---------- 水位・にごり ----------
  tw.setLevel = (y) => {
    tw.level = clamp(y, 0.02, T.waterFull + 0.01);
    const h = tw.level - IN.yBottom;
    for (const m of layers) { m.scale.set(W, h, 1); m.material.uniforms.uLevel.value = tw.level; }
    surf.position.y = tw.level;
    for (const m of menisci) m.position.y = tw.level - menH * 0.15;
  };
  tw.setMurk = (v) => {
    tw.murk = clamp(v, 0, 1);
    const m = tw.murk;
    const alpha = 0.022 + 0.53 * Math.pow(m, 1.35);
    for (let k = 0; k < NLAYER; k++) {
      const u = layers[k].material.uniforms;
      const f = k / (NLAYER - 1);
      const mc = murkBack.clone().lerp(murkFront, Math.pow(f, 0.8));
      u.uColA.value.copy(murkClear).lerp(mc, sstep(0, 0.35, m));
      u.uColB.value.copy(murkClear).lerp(mc.clone().multiplyScalar(1.12).lerp(new THREE.Color(0x9aa858), 0.25), sstep(0, 0.35, m));
      // 手前の層ほど薄く（奥は見えないが、前面ガラス寄りの魚・あみは形と色がうっすら分かる）
      u.uOpacity.value = Math.min(0.95, alpha * mix(1.5, 0.42, f));
      u.uMurk.value = m;
    }
    surfMat.color.set(0xcfe6ee).lerp(new THREE.Color(0x6c8238), sstep(0.0, 0.6, m));
    surfMat.opacity = mix(0.1, 0.55, m);
    surfU.uMurkS.value = m;
  };
  tw.ripple = (x, z, strength = 1) => {
    rip[ripI].set(x, z, time, clamp(strength, 0, 3));
    ripI = (ripI + 1) % 8;
  };
  let glint = 1;
  tw.surfaceGlint = (v = 1) => { glint = clamp(v, 0, 3); };

  tw.update = (dt, t) => {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    time += dt;
    uTime.value = time;
    surfU.uWave.value += (glint - surfU.uWave.value) * (1 - Math.exp(-dt * 2));
    const hh = halfHeight(renderer, v2);
    bub.mat.uniforms.uHalfH.value = hh; spk.mat.uniforms.uHalfH.value = hh; sw.mat.uniforms.uHalfH.value = hh;

    // コースティクス
    const ct = causTarget * Math.pow(1 - tw.murk, 2);
    causNow += (ct - causNow) * (1 - Math.exp(-dt * 1.5));
    causU.uI.value = causNow * clamp((tw.level - T.gravelH - 0.01) / 0.04, 0, 1);
    caus.visible = causU.uI.value > 0.002;

    // コケのフェード
    if (fade) {
      fade.t += dt;
      algaeMat.opacity = clamp(1 - fade.t / fade.dur, 0, 1);
      if (fade.t >= fade.dur) { mm.fill(0); totalNow = 0; markDirty(0, 0, AW, AH); fade = null; algaeMat.opacity = 1; }
    }
    writeMask();

    // 泡
    if (stream.on) {
      stream.acc += dt * stream.rate;
      while (stream.acc >= 1) {
        stream.acc -= 1;
        const big = rnd() < 0.25;
        spawnBubble(stream.pos, big ? 0.0055 : 0.0018 + rnd() * 0.0022, 0.006, 1);
      }
    }
    popCD -= dt;
    const L2 = bub.list;
    for (let i = L2.length - 1; i >= 0; i--) {
      const b = L2[i];
      b.age += dt;
      b.p.y += b.vy * dt;
      b.p.x += Math.cos(b.age * b.fr + b.ph) * b.wob * dt * b.fr * 0.5;
      b.p.z += Math.sin(b.age * b.fr * 0.8 + b.ph) * b.wob * dt * b.fr * 0.35;
      b.p.x = clamp(b.p.x, IN.x0 + 0.002, IN.x1 - 0.002); b.p.z = clamp(b.p.z, IN.z0 + 0.002, IN.z1 - 0.002);
      b.size *= 1 + dt * 0.12 * b.grow;
      b.alpha = Math.min(1, b.age * 6);
      if (b.p.y >= tw.level - b.size * 0.3) {
        if (popCD <= 0) {
          popCD = 0.12;
          if (b.size > 0.003 && rnd() < 0.5) tw.ripple(b.p.x, b.p.z, 0.25);
          if (tw.onBubblePop) tw.onBubblePop(popPos.copy(b.p));
        }
        L2[i] = L2[L2.length - 1]; L2.pop();
      } else if (b.age > 12) { L2[i] = L2[L2.length - 1]; L2.pop(); }
    }
    bub.flush();
    bub.pts.renderOrder = murkOrderForZ(bub.meanZ());

    // きらきら
    const S2 = spk.list;
    for (let i = S2.length - 1; i >= 0; i--) {
      const s = S2[i];
      s.age += dt;
      if (s.age < 0) { s.alpha = 0; continue; }
      const k = s.age / s.life;
      if (k >= 1) { S2[i] = S2[S2.length - 1]; S2.pop(); continue; }
      s.p.y += s.vy * dt;
      s.alpha = Math.sin(Math.PI * k) * (0.55 + 0.45 * Math.sin(s.age * 14 + s.ph)) * 1.2;
    }
    spk.flush();

    // もや
    const W2 = sw.list;
    for (let i = W2.length - 1; i >= 0; i--) {
      const s = W2[i];
      s.age += dt;
      const k = s.age / s.life;
      if (k >= 1) { W2[i] = W2[W2.length - 1]; W2.pop(); continue; }
      s.p.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - dt * 0.6);
      s.size += s.grow * dt;
      s.alpha = s.peak * Math.sin(Math.PI * Math.min(1, k * 1.4)) * (1 - k) * (0.4 + 0.6 * tw.murk);
    }
    sw.flush();
    sw.pts.renderOrder = murkOrderForZ(sw.meanZ());
  };

  tw.setLevel(T.waterFull);
  tw.setMurk(1);
  return tw;
}

// ======================================================================
export function createFX(engine = {}) {
  const renderer = engine.renderer;
  const budget = Math.max(60, engine.quality?.particleBudget ?? 300);
  const group = new THREE.Group();
  group.name = 'fx';
  const v2 = new THREE.Vector2();
  const rnd = mulberry32(91);
  const G = 9.8;
  let time = 0;
  const fx = { group, onDripLand: null, onStreamLand: null };

  // 水滴・しぶき
  const drops = makePool(budget, 1);
  drops.pts.renderOrder = 30;
  group.add(drops.pts);
  const foam = makePool(Math.floor(budget * 0.4), 0);
  foam.pts.renderOrder = 30;
  group.add(foam.pts);
  const colCache = new Map();
  const colOf = (hex) => { if (!colCache.has(hex)) colCache.set(hex, new THREE.Color(hex)); return colCache.get(hex); };

  fx.splash = (pos, size = 1, colorHex = 0xffffff) => {
    const n = Math.round(10 + 14 * size);
    const c = colOf(colorHex);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const up = (0.35 + rnd() * 0.6) * Math.sqrt(size);
      const out = (0.08 + rnd() * 0.3) * Math.sqrt(size);
      drops.add({
        p: new THREE.Vector3(pos.x + Math.cos(a) * 0.004 * size, pos.y, pos.z + Math.sin(a) * 0.004 * size),
        v: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out),
        size: (0.0015 + rnd() * 0.0025) * Math.sqrt(size), alpha: 0.95, age: 0, life: 1.4, floorY: pos.y - 0.004, c, kind: 0,
      });
    }
    for (let i = 0; i < Math.round(6 * size); i++) {
      const a = rnd() * Math.PI * 2;
      foam.add({ p: new THREE.Vector3(pos.x, pos.y + 0.001, pos.z), v: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.03 + rnd() * 0.04 * size), size: 0.002 + rnd() * 0.003, alpha: 0.8, age: 0, life: 0.5 + rnd() * 0.4, c: colOf(0xf4fbff) });
    }
  };

  const dripQ = [];
  const tmpW = new THREE.Vector3();
  fx.drips = (src, count = 5, toY) => {
    const isObj = src && src.isObject3D;
    const p0 = isObj ? src.getWorldPosition(new THREE.Vector3()) : src.clone();
    dripQ.push({ src: isObj ? src : p0, isObj, left: count, timer: 0, toY: toY ?? p0.y - 0.25 });
  };

  // 落水の筋
  const streams = new Map();
  const streamGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 40, true).translate(0, -0.5, 0);
  const streamVS = /* glsl */`
    uniform float uLen, uR, uTime, uSeed;
    varying float vY; varying vec3 vN; varying vec3 vV; varying float vAng;
    void main(){
      vec3 p = position;
      float yy = -p.y * uLen;
      float thin = 1.0 / pow(1.0 + yy * 7.0, 0.3);
      float wob = sin(yy * 85.0 - uTime * 22.0 + uSeed) * 0.0005 + sin(yy * 31.0 + uTime * 11.0 + uSeed) * 0.0008;
      float wk = clamp(yy * 12.0, 0.0, 1.0);
      float bulge = 1.0 + 0.14 * sin(yy * 150.0 - uTime * 38.0 + uSeed);
      p.xz *= uR * thin * bulge;
      p.x += wob * wk; p.z += wob * 0.6 * wk;
      p.y = -yy;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vV = -mv.xyz; vN = normalize(normalMatrix * vec3(position.x, 0.0, position.z)); vY = yy;
      vAng = atan(position.z, position.x);
      gl_Position = projectionMatrix * mv;
    }`;
  const streamFS = /* glsl */`
    uniform vec3 uColor; uniform float uOpacity, uTime, uSeed;
    varying float vY; varying vec3 vN; varying vec3 vV; varying float vAng;
    void main(){
      float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
      float st = 0.5 + 0.5 * sin(vAng * 5.0 + sin(vY * 40.0 - uTime * 12.0) * 1.5 + uSeed);
      float flow = 0.5 + 0.5 * sin(vY * 220.0 - uTime * 60.0 + vAng * 2.0);
      vec3 col = uColor * (0.75 + 0.35 * f) + vec3(1.0) * pow(st, 6.0) * 0.5 + vec3(0.15) * flow;
      float a = uOpacity * (0.4 + 0.6 * pow(f, 1.2)) * (0.85 + 0.15 * flow);
      col *= 0.8 + 0.2 * (1.0 - f) ;
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  fx.stream = {
    set(id, from, toY, o = {}) {
      let s = streams.get(id);
      if (!from) { if (s && s.active) { s.active = false; } return; }
      if (!s) {
        const mat = new THREE.ShaderMaterial({
          uniforms: { uLen: { value: 0.001 }, uR: { value: 0.003 }, uTime: { value: 0 }, uSeed: { value: rnd() * 10 }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0.7 } },
          vertexShader: streamVS, fragmentShader: streamFS, transparent: true, depthWrite: false,
        });
        const mesh = new THREE.Mesh(streamGeo, mat);
        mesh.renderOrder = 29; mesh.frustumCulled = false; mesh.visible = false;
        group.add(mesh);
        s = { mesh, mat, from: new THREE.Vector3(), toY: 0, head: 0, cut: 0, active: false, vHead: 0, vCut: 0, landAcc: 0 };
        streams.set(id, s);
      }
      if (!s.active) { s.active = true; s.head = from.y; s.vHead = 0.3; s.cut = null; }
      s.from.copy(from); s.toY = toY;
      s.mat.uniforms.uR.value = (o.width ?? 0.006) * 0.5;
      s.mat.uniforms.uColor.value.set(o.colorHex ?? 0xcfe8ff);
      s.mat.uniforms.uOpacity.value = o.opacity ?? 0.7;
    },
    isOn(id) { const s = streams.get(id); return !!(s && s.active); },
  };

  // えさのフレーク
  const MAXF = 48;
  const flakeShape = new THREE.Shape();
  {
    const r = mulberry32(3);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, rr = 0.0013 + r() * 0.001;
      const x = Math.cos(a) * rr * 1.25, y = Math.sin(a) * rr;
      if (i === 0) flakeShape.moveTo(x, y); else flakeShape.lineTo(x, y);
    }
    flakeShape.closePath();
  }
  const flakeGeo = new THREE.ShapeGeometry(flakeShape).rotateX(-Math.PI / 2);
  const flakeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide });
  const flakeMesh = new THREE.InstancedMesh(flakeGeo, flakeMat, MAXF);
  flakeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flakeMesh.frustumCulled = false;
  const fcol = new THREE.Color();
  for (let i = 0; i < MAXF; i++) {
    fcol.setHSL(0.03 + rnd() * 0.04, 0.6 + rnd() * 0.2, 0.28 + rnd() * 0.14);
    flakeMesh.setColorAt(i, fcol);
  }
  flakeMesh.count = 0;
  group.add(flakeMesh);
  const fdata = [];
  const items = [];
  const inTankXZ = (p) => p.x > IN.x0 && p.x < IN.x1 && p.z > IN.z0 && p.z < IN.z1;
  fx.flakes = {
    surfaceY: T.waterFull,
    items,
    emit(pos, count = 6) {
      for (let c = 0; c < count; c++) {
        let idx = items.findIndex((it) => !it.alive);
        if (idx < 0) { if (items.length >= MAXF) return; idx = items.length; items.push({ pos: new THREE.Vector3(), alive: false, state: 'fall' }); fdata.push({}); }
        const it = items[idx];
        it.pos.set(pos.x + (rnd() - 0.5) * 0.012, pos.y + (rnd() - 0.5) * 0.004, pos.z + (rnd() - 0.5) * 0.012);
        it.alive = true; it.state = 'fall';
        Object.assign(fdata[idx], {
          vx: (rnd() - 0.5) * 0.05, vz: (rnd() - 0.5) * 0.05, vy: -0.05 * rnd(), rx: rnd() * 6, rz: rnd() * 6, wr: 4 + rnd() * 5,
          floatT: 2.5 + rnd() * 2.5, sc: 0.8 + rnd() * 0.5, ph: rnd() * 6.28, yaw: rnd() * 6.28, age: 0,
        });
      }
    },
    eat(i) { if (items[i]) { items[i].alive = false; } },
  };
  const fm = new THREE.Matrix4(), fq = new THREE.Quaternion(), fe = new THREE.Euler(), fs = new THREE.Vector3();

  fx.update = (dt, t) => {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    time += dt;
    const hh = halfHeight(renderer, v2);
    drops.mat.uniforms.uHalfH.value = hh; foam.mat.uniforms.uHalfH.value = hh;

    // ぽたぽた
    for (let i = dripQ.length - 1; i >= 0; i--) {
      const q = dripQ[i];
      q.timer -= dt;
      if (q.timer <= 0) {
        const p = q.isObj ? q.src.getWorldPosition(tmpW).clone() : q.src.clone();
        drops.add({ p, v: new THREE.Vector3((rnd() - 0.5) * 0.01, 0, (rnd() - 0.5) * 0.01), size: 0.0028 + rnd() * 0.0012, alpha: 0.95, age: 0, life: 3, floorY: q.toY, c: colOf(0xeaf6ff), kind: 1 });
        q.left--; q.timer = 0.18 + rnd() * 0.27;
        if (q.left <= 0) dripQ.splice(i, 1);
      }
    }
    const D = drops.list;
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i];
      d.age += dt;
      d.v.y -= G * dt;
      d.p.addScaledVector(d.v, dt);
      const dead = d.age > d.life || (d.p.y < d.floorY && d.v.y < 0);
      if (dead) {
        if (d.kind === 1 && d.p.y < d.floorY + 0.01) {
          d.p.y = d.floorY;
          for (let k = 0; k < 3; k++) { const a = rnd() * 6.28; drops.add({ p: d.p.clone(), v: new THREE.Vector3(Math.cos(a) * 0.08, 0.25 + rnd() * 0.2, Math.sin(a) * 0.08), size: 0.0012, alpha: 0.8, age: 0, life: 0.5, floorY: d.floorY - 0.002, c: d.c, kind: 0 }); }
          if (fx.onDripLand) fx.onDripLand(d.p.clone());
        }
        D[i] = D[D.length - 1]; D.pop();
      } else d.alpha = 0.95 * (1 - Math.max(0, d.age - d.life + 0.3) / 0.3);
    }
    const F = foam.list;
    for (let i = F.length - 1; i >= 0; i--) {
      const f = F[i];
      f.age += dt;
      if (f.age > f.life) { F[i] = F[F.length - 1]; F.pop(); continue; }
      f.p.addScaledVector(f.v, dt); f.v.multiplyScalar(1 - dt * 4);
      f.alpha = 0.8 * (1 - f.age / f.life);
    }

    // 落水
    for (const [id, s] of streams) {
      const u = s.mat.uniforms;
      u.uTime.value = time;
      if (s.active) {
        s.vHead += G * dt;
        s.head = Math.max(s.toY, s.head - s.vHead * dt);
        s.cut = null;
      } else {
        if (s.cut === null) { s.cut = s.from.y; s.vCut = 0.4; }
        s.vCut += G * dt;
        s.cut -= s.vCut * dt;
        s.head = Math.max(s.toY, s.head - (s.vHead += G * dt) * dt);
        if (s.cut <= s.toY + 0.001) { s.mesh.visible = false; streams.delete(id); s.mat.dispose(); group.remove(s.mesh); continue; }
      }
      const topY = s.cut === null ? s.from.y : Math.min(s.from.y, s.cut);
      const len = Math.max(0.0005, topY - s.head);
      s.mesh.position.set(s.from.x, topY, s.from.z);
      u.uLen.value = len;
      s.mesh.visible = true;
      if (s.head <= s.toY + 0.0005 && (s.active || s.cut > s.toY)) {
        s.landAcc += dt * 24;
        while (s.landAcc >= 1) {
          s.landAcc -= 1;
          const a = rnd() * 6.28;
          foam.add({ p: new THREE.Vector3(s.from.x + Math.cos(a) * 0.002, s.toY + 0.0008, s.from.z + Math.sin(a) * 0.002), v: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.03 + rnd() * 0.03), size: 0.0015 + rnd() * 0.0025, alpha: 0.8, age: 0, life: 0.35 + rnd() * 0.35, c: colOf(0xf4fbff) });
          if (rnd() < 0.25) drops.add({ p: new THREE.Vector3(s.from.x, s.toY, s.from.z), v: new THREE.Vector3((rnd() - 0.5) * 0.2, 0.2 + rnd() * 0.3, (rnd() - 0.5) * 0.2), size: 0.0012 + rnd() * 0.001, alpha: 0.9, age: 0, life: 0.6, floorY: s.toY - 0.002, c: u.uColor.value, kind: 0 });
        }
        if (fx.onStreamLand) fx.onStreamLand(id, tmpW.set(s.from.x, s.toY, s.from.z), dt);
      }
    }
    drops.flush(); foam.flush();

    // フレーク
    let n = 0;
    const sy = fx.flakes.surfaceY;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], d = fdata[i];
      if (!it.alive) continue;
      d.age += dt;
      const p = it.pos;
      const inTank = inTankXZ(p);
      const floorY = inTank ? T.gravelH + 0.004 : 0.0006;
      if (it.state === 'fall') {
        d.vy = Math.max(-0.28, d.vy - G * 0.6 * dt);
        p.x += (d.vx + Math.sin(d.age * d.wr + d.ph) * 0.03) * dt;
        p.z += (d.vz + Math.cos(d.age * d.wr * 0.8 + d.ph) * 0.02) * dt;
        p.y += d.vy * dt;
        d.rx += dt * d.wr; d.rz += dt * d.wr * 0.7;
        if (inTank && p.y <= sy && p.y > sy - 0.02) { p.y = sy; it.state = 'float'; d.age = 0; }
        else if (p.y <= floorY) { p.y = floorY; it.state = 'rest'; }
      } else if (it.state === 'float') {
        p.x += Math.sin(d.age * 0.7 + d.ph) * 0.002 * dt; p.z += Math.cos(d.age * 0.5 + d.ph) * 0.002 * dt;
        p.y = sy + 0.0002 + Math.sin(d.age * 3 + d.ph) * 0.0002;
        d.rx *= 1 - dt * 3; d.rz *= 1 - dt * 3; d.yaw += dt * 0.15;
        if (d.age > d.floatT) { it.state = 'sink'; d.age = 0; }
      } else if (it.state === 'sink') {
        const v = Math.min(0.007, 0.0015 + d.age * 0.002);
        p.y -= v * dt;
        p.x += Math.sin(d.age * 1.6 + d.ph) * 0.003 * dt;
        d.rx = Math.sin(d.age * 1.3 + d.ph) * 0.6; d.rz = Math.cos(d.age * 1.1 + d.ph) * 0.4;
        if (p.y <= floorY) { p.y = floorY; it.state = 'rest'; }
      } else { d.rx *= 1 - dt * 4; d.rz *= 1 - dt * 4; }
      if (inTank) { p.x = clamp(p.x, IN.x0 + 0.003, IN.x1 - 0.003); p.z = clamp(p.z, IN.z0 + 0.003, IN.z1 - 0.003); }
      fe.set(d.rx, d.yaw, d.rz); fq.setFromEuler(fe); fs.setScalar(d.sc);
      fm.compose(p, fq, fs);
      flakeMesh.setMatrixAt(i, fm);
      n = i + 1;
    }
    // 死んだ枠は 0 スケール
    fs.setScalar(0);
    for (let i = 0; i < n; i++) if (!items[i].alive) { fm.compose(items[i].pos, fq, fs); flakeMesh.setMatrixAt(i, fm); }
    flakeMesh.count = n;
    flakeMesh.instanceMatrix.needsUpdate = true;
  };

  return fx;
}
