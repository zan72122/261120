/* common.js — 全モジュール共通: 名前空間 G、世界の配置、ちいさな道具
   単位はメートル。Y が上、+X が画面右、+Z が手前(画面下)、-Z が奥(壁)。床は y=0。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};

  // ---- 世界の配置（全モジュールがこれを読む。数値を各自で持たない） ----
  G.L = {
    matTop: 0.012,                       // アイロンマット上面の高さ
    mat: { w: 1.25, d: 1.05 },           // マット（中心は原点）
    shirt: { halfW: 0.47, top: -0.40, bottom: 0.40 }, // 平置きシャツの範囲（えりが -Z 側）
    stand: { x: 0.27, z: 0.72 },         // コードレスアイロンの充電台（床の上）
    basket: { x: -0.26, z: 0.74, r: 0.17, h: 0.20 }, // 洗濯かご（床の上）
    wallZ: -1.15,                        // 奥の壁（+Z 向きの面）
    hook: { x: 0, y: 1.42, z: -1.12 },   // 壁のフック（ハンガーを掛ける点）
    door: { x: 1.05, w: 0.82, h: 2.0 },  // 壁のドア（中心 x）
    papa: { x: 0.0, z: -0.70 },          // パパが立つ位置（+Z を向く）
    sun: [-1.6, 3.2, 1.4]                // 朝日の来る方向（この位置から原点へ）
  };

  // シャツの色（1周ごとに変わる）。sRGB hex
  G.SHIRT_COLORS = [0xa9c6e8, 0xf4f2ec, 0xf2c4cf, 0xbfe0c8];

  // ---- 数学の小道具 ----
  G.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.smooth = function (a, b, x) { var t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // フレームレートに依らない追従: v = G.damp(v, target, 12, dt)
  G.damp = function (a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); };
  G.easeInOut = function (t) { t = G.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  G.easeOut = function (t) { t = G.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  G.easeOutBack = function (t) { t = G.clamp(t, 0, 1); var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  G.rng = function (seed) { // mulberry32
    var a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };
  // 値ノイズ（0..1）と fbm
  function hash2(x, y, s) { var n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
  G.noise2 = function (x, y, seed) {
    seed = seed || 0;
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  G.fbm2 = function (x, y, oct, seed) {
    var s = 0, a = 0.5, f = 1, n = 0;
    for (var i = 0; i < (oct || 4); i++) { s += a * G.noise2(x * f, y * f, (seed || 0) + i * 13); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };

  // ---- canvas / texture ----
  G.makeCanvas = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  // opts: {srgb:true, repeat:[x,y], mirror:false, aniso:4}
  G.canvasTexture = function (canvas, opts) {
    opts = opts || {};
    var t = new THREE.CanvasTexture(canvas);
    if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (opts.repeat) {
      t.wrapS = t.wrapT = opts.mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
      t.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    t.anisotropy = opts.aniso || 4;
    t.needsUpdate = true;
    return t;
  };
  // やわらかい丸（湯気・接地影・光だまり用）。白の放射グラデーション
  var _dot = null;
  G.softDotTexture = function () {
    if (_dot) return _dot;
    var c = G.makeCanvas(128, 128), g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    _dot = new THREE.CanvasTexture(c); _dot.colorSpace = THREE.SRGBColorSpace;
    return _dot;
  };

  // ---- 環境マップ（朝の部屋: 左手前に明るい窓、白い天井、木の床）----
  G.makeEnvMap = function (renderer) {
    var c = G.makeCanvas(512, 256), g = c.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#f6f1e8'); sky.addColorStop(0.45, '#e9e0d2'); sky.addColorStop(0.55, '#b99a78'); sky.addColorStop(1, '#8a6a4a');
    g.fillStyle = sky; g.fillRect(0, 0, 512, 256);
    // 窓（明るい四角）: 左手前
    g.fillStyle = '#ffffff'; g.shadowColor = '#fff6dc'; g.shadowBlur = 30;
    g.fillRect(70, 48, 96, 74); g.fillRect(190, 56, 50, 60);
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(380, 60, 70, 60);
    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
    var pm = new THREE.PMREMGenerator(renderer);
    var rt = pm.fromEquirectangular(tex);
    tex.dispose(); pm.dispose();
    return rt.texture;
  };

  // ---- プレビュー用の既定ライト（本番の照明は env.js が持つ。これに近い見え方にする）----
  G.makeDefaultLights = function (scene) {
    var hemi = new THREE.HemisphereLight(0xfff4e2, 0xb89a78, 0.55);
    var sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    sun.position.set(G.L.sun[0], G.L.sun[1], G.L.sun[2]);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera; sc.left = -1.8; sc.right = 1.8; sc.top = 2.2; sc.bottom = -1.8; sc.near = 0.5; sc.far = 9;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.012; sun.shadow.radius = 5;
    scene.add(hemi, sun, sun.target);
    return { hemi: hemi, sun: sun };
  };
})();
