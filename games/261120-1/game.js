/* common.js */
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

  // ---- 後から読み込む部品（最初の場面に要らない物は、遊んでいる間に裏で読む） ----
  //   G.LATE = { papa: 'late.js' } は index.html が決める。部品がすでに入っていれば何もしない。
  var needState = {};
  G.need = function (name) {
    var src = G.LATE && G.LATE[name];
    if (!src || needState[name]) return;
    needState[name] = 1;
    var tries = 0;
    (function load() {
      var el = document.createElement('script');
      el.src = src; el.async = true;
      el.onerror = function () { // 通信が切れた時など: 間をあけて読み直す
        if (el.parentNode) el.parentNode.removeChild(el);
        if (++tries < 20) setTimeout(load, Math.min(8000, 1000 * tries));
      };
      (document.head || document.body).appendChild(el);
    })();
  };

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
  // 格子点の値は seed ごとに最近のマス（8 つまで）を覚えておく。隣の画素はほぼ同じマスを引くので、
  // テクスチャ作りで重い Math.sin を何度も呼ばずに済む（結果は覚えない時と同じ）
  var nCache = {};
  G.noise2 = function (x, y, seed) {
    seed = seed || 0;
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var k = nCache[seed];
    if (!k) { k = nCache[seed] = { xy: new Float64Array(16).fill(NaN), v: new Float64Array(32) }; }
    var sl = ((xi * 3 + yi * 5) & 7), o = sl * 4, q = sl * 2;
    if (k.xy[q] !== xi || k.xy[q + 1] !== yi) {
      k.xy[q] = xi; k.xy[q + 1] = yi;
      k.v[o] = hash2(xi, yi, seed); k.v[o + 1] = hash2(xi + 1, yi, seed); k.v[o + 2] = hash2(xi, yi + 1, seed); k.v[o + 3] = hash2(xi + 1, yi + 1, seed);
    }
    var a = k.v[o], b = k.v[o + 1], c = k.v[o + 2], d = k.v[o + 3];
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

/* core.js */
/* core.js — 起動・描画ループ・入力・カメラ・保存・代替画面・お手本の指
   公開: G.app, G.input, G.cam, G.save, G.createGhostFinger
   flow.js が G.createFlow(ctx) を定義していれば、それを呼んで進行を任せる。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};
  var DEG = Math.PI / 180;

  // ======================================================================
  // 保存
  // ======================================================================
  var SAVE_KEY = 'gf-261120-1', SAVE_V = 1;
  G.save = (function () {
    var pending = null, timer = 0, lastWrite = 0;
    function ls() { try { return window.localStorage || null; } catch (e) { return null; } }
    function write() {
      timer = 0;
      if (!pending) return;
      var s = ls(); var data = pending; pending = null; lastWrite = Date.now();
      if (!s) return;
      try { s.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* 握りつぶす */ }
    }
    return {
      load: function () {
        var s = ls(); if (!s) return null;
        try {
          var raw = s.getItem(SAVE_KEY); if (!raw) return null;
          var o = JSON.parse(raw);
          if (!o || typeof o !== 'object' || o.v !== SAVE_V) return null;
          return o;
        } catch (e) { return null; }
      },
      store: function (obj) {
        var o = { v: SAVE_V };
        if (obj) for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && k !== 'v') o[k] = obj[k];
        pending = o;
        if (timer) return;
        var wait = Math.max(0, 1000 - (Date.now() - lastWrite));
        if (wait === 0) write(); else timer = setTimeout(write, wait);
      },
      flush: function () { if (timer) { clearTimeout(timer); timer = 0; } write(); },
      clear: function () {
        pending = null; if (timer) { clearTimeout(timer); timer = 0; }
        var s = ls(); if (!s) return;
        try { s.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
      }
    };
  })();

  // ======================================================================
  // flow 呼び出し（例外で全体を止めない。同じエラーは繰り返し出さない）
  // ======================================================================
  var seenErr = {};
  function report(where, e) {
    var key = where + ':' + (e && e.message ? e.message : String(e));
    if (seenErr[key]) return;
    seenErr[key] = 1;
    try { console.error('[core] ' + where, e); } catch (x) { /* noop */ }
  }
  function callFlow(name, a, b) {
    var f = G.flow;
    if (!f || typeof f[name] !== 'function') return;
    try { f[name](a, b); } catch (e) { report('flow.' + name, e); }
  }

  // ======================================================================
  // カメラ
  // ======================================================================
  function makeCam() {
    var camera = null;
    var cur = { look: new THREE.Vector3(0, 0, -0.1), yaw: 0, pitch: Math.atan2(2.0, 1.5) / DEG, dist: 2.5, fov: 50, bx: 0, by: 0 };
    var from = { look: new THREE.Vector3(), yaw: 0, pitch: 0, dist: 0, fov: 50, bx: 0, by: 0 };
    var spec = { look: [0, 0, -0.1], pitch: cur.pitch, yaw: 0, fov: 50, dist: 2.5 };
    var tLook = new THREE.Vector3();
    var tr = { t: 1, dur: 0 };
    var sh = { amp: 0, dur: 0, t: 0, seed: 0 };
    var dir = new THREE.Vector3(), tmp = new THREE.Vector3(), shk = new THREE.Vector3();
    var right = new THREE.Vector3(), up = new THREE.Vector3();

    // 今の画面比・Safe Area で fit の四角が収まる距離
    function fitDist(s, fovDeg, bx, by) {
      var app = G.app, W = (app && app.size.w) || window.innerWidth || 1, H = (app && app.size.h) || window.innerHeight || 1;
      var safe = (app && app.safe) || { top: 0, right: 0, bottom: 0, left: 0 };
      var aspect = W / H, tv = Math.tan(fovDeg * DEG / 2), th = tv * aspect;
      var m = 0.03; // ふちの余白（NDC）
      var xmin = -1 + 2 * safe.left / W + m, xmax = 1 - 2 * safe.right / W - m;
      var ymin = -1 + 2 * safe.bottom / H + m, ymax = 1 - 2 * safe.top / H - m;
      var cx = bx, cy = -by;
      var ax = Math.max(0.05, Math.min(xmax - cx, cx - xmin));
      var ay = Math.max(0.05, Math.min(ymax - cy, cy - ymin));
      var w = Math.max(0.001, s.fit.w), h = Math.max(0.001, s.fit.h);
      return Math.max((w / 2) / (th * ax), (h / 2) / (tv * ay));
    }
    function target() {
      var s = spec, fov = s.fov != null ? s.fov : 50;
      var bx = s.bias ? s.bias[0] || 0 : 0, by = s.bias ? s.bias[1] || 0 : 0;
      var d = s.fit ? fitDist(s, fov, bx, by) : (s.dist != null ? s.dist : cur.dist);
      if (s.look) tLook.set(s.look[0], s.look[1], s.look[2]);
      return { yaw: s.yaw != null ? s.yaw : 0, pitch: s.pitch != null ? s.pitch : 45, dist: d, fov: fov, bx: bx, by: by };
    }
    function wrapDeg(a) { while (a > 180) a -= 360; while (a < -180) a += 360; return a; }

    function apply() {
      if (!camera) return;
      var yaw = cur.yaw * DEG, pit = G.clamp(cur.pitch, -89.9, 89.9) * DEG;
      dir.set(Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit));
      camera.position.copy(cur.look).addScaledVector(dir, cur.dist);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(-pit, yaw, 0);
      if (sh.t < sh.dur && sh.amp > 0) {
        var k = 1 - sh.t / sh.dur; k = k * k * sh.amp; var tt = sh.t * 31 + sh.seed;
        right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        shk.copy(right).multiplyScalar((G.noise2(tt, 1.3) - 0.5) * 2 * k).addScaledVector(up, (G.noise2(tt, 7.9) - 0.5) * 2 * k);
        camera.position.add(shk);
      }
      if (camera.fov !== cur.fov) camera.fov = cur.fov;
      camera.updateProjectionMatrix();
      // 注視点を画面中心からずらす（投影の中心をずらす。camera.projectionMatrix を直接）
      if (cur.bx || cur.by) {
        var e = camera.projectionMatrix.elements;
        e[8] = -cur.bx; e[9] = cur.by;
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      }
      camera.updateMatrixWorld(true);
    }

    var api = {
      busy: false,
      _bind: function (cam) { camera = cam; apply(); },
      spec: function () { return spec; },
      shot: function (s, dur) {
        s = s || {};
        from.look.copy(cur.look); from.yaw = cur.yaw; from.pitch = cur.pitch; from.dist = cur.dist;
        from.fov = cur.fov; from.bx = cur.bx; from.by = cur.by;
        spec = s;
        tr.dur = Math.max(0, dur || 0); tr.t = 0;
        if (tr.dur === 0) { api._snap(); }
        else api.busy = true;
      },
      _snap: function () {
        var g = target();
        cur.look.copy(tLook); cur.yaw = g.yaw; cur.pitch = g.pitch; cur.dist = g.dist; cur.fov = g.fov; cur.bx = g.bx; cur.by = g.by;
        tr.t = tr.dur = 0; api.busy = false; apply();
      },
      update: function (dt) {
        var g = target();
        if (tr.dur > 0 && tr.t < tr.dur) {
          tr.t = Math.min(tr.dur, tr.t + dt);
          var k = G.easeInOut(tr.t / tr.dur);
          cur.look.copy(from.look).lerp(tLook, k);
          cur.yaw = from.yaw + wrapDeg(g.yaw - from.yaw) * k;
          cur.pitch = G.lerp(from.pitch, g.pitch, k);
          // 距離は対数で補間（寄り・引きが自然）
          cur.dist = Math.exp(G.lerp(Math.log(Math.max(1e-3, from.dist)), Math.log(Math.max(1e-3, g.dist)), k));
          cur.fov = G.lerp(from.fov, g.fov, k);
          cur.bx = G.lerp(from.bx, g.bx, k); cur.by = G.lerp(from.by, g.by, k);
          api.busy = tr.t < tr.dur;
        } else {
          cur.look.copy(tLook); cur.yaw = g.yaw; cur.pitch = g.pitch; cur.dist = g.dist; cur.fov = g.fov; cur.bx = g.bx; cur.by = g.by;
          api.busy = false;
        }
        if (sh.t < sh.dur) sh.t += dt;
        apply();
      },
      shake: function (amp, dur) { sh.amp = Math.max(0, amp || 0.004); sh.dur = Math.max(0.01, dur || 0.3); sh.t = 0; sh.seed = Math.random() * 100; },
      toScreen: function (v3, out) {
        out = out || { x: 0, y: 0 };
        if (!camera) { out.x = out.y = 0; return out; }
        tmp.copy(v3).project(camera);
        var s = G.app.size;
        out.x = (tmp.x + 1) / 2 * s.w; out.y = (1 - tmp.y) / 2 * s.h; out.behind = tmp.z > 1;
        return out;
      },
      // 今の状態（読み取り専用の目安）
      state: cur
    };
    return api;
  }
  G.cam = makeCam();

  // ======================================================================
  // お手本の指
  // ======================================================================
  var _fingerTex = null;
  function fingerTexture() {
    if (_fingerTex) return _fingerTex;
    var W = 256, H = 640, c = G.makeCanvas(W, H), g = c.getContext('2d');
    var cx = W / 2, tipY = 14, fw = 150; // 指先側の幅
    function outline() {
      // 指の輪郭: 丸い指先 → 根元へ少し太くなる
      var r = fw / 2, y0 = tipY + r * 1.05;
      g.beginPath();
      g.moveTo(cx - r, y0);
      g.bezierCurveTo(cx - r, tipY + r * 0.25, cx - r * 0.55, tipY, cx, tipY);
      g.bezierCurveTo(cx + r * 0.55, tipY, cx + r, tipY + r * 0.25, cx + r, y0);
      g.bezierCurveTo(cx + r + 3, 260, cx + r + 12, 420, cx + r + 16, H + 10);
      g.lineTo(cx - r - 16, H + 10);
      g.bezierCurveTo(cx - r - 12, 420, cx - r - 3, 260, cx - r, y0);
      g.closePath();
    }
    // 本体（円柱っぽい陰影: 左上から光）
    outline();
    var gr = g.createLinearGradient(cx - fw / 2 - 16, 0, cx + fw / 2 + 16, 0);
    gr.addColorStop(0, '#c98b6c'); gr.addColorStop(0.18, '#e9b496'); gr.addColorStop(0.42, '#f7d2b9');
    gr.addColorStop(0.62, '#f1c3a6'); gr.addColorStop(0.86, '#d99c7d'); gr.addColorStop(1, '#b97a5d');
    g.fillStyle = gr; g.fill();
    g.save(); outline(); g.clip();
    // 指先のほんのり赤み
    var rg = g.createRadialGradient(cx, tipY + 60, 5, cx, tipY + 60, 110);
    rg.addColorStop(0, 'rgba(240,150,130,0.28)'); rg.addColorStop(1, 'rgba(240,150,130,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, 260);
    // 肌のきめ（ごく弱いノイズ）
    var id = g.getImageData(0, 0, W, H), d = id.data;
    for (var y = 0; y < H; y += 1) for (var x = 0; x < W; x += 1) {
      var i = (y * W + x) * 4; if (!d[i + 3]) continue;
      var n = (G.noise2(x * 0.15, y * 0.15, 3) - 0.5) * 10 + (G.noise2(x * 0.6, y * 0.6, 9) - 0.5) * 5;
      d[i] = G.clamp(d[i] + n, 0, 255); d[i + 1] = G.clamp(d[i + 1] + n * 0.9, 0, 255); d[i + 2] = G.clamp(d[i + 2] + n * 0.8, 0, 255);
    }
    g.putImageData(id, 0, 0);
    // 爪
    var nw = fw * 0.56, nTop = tipY + 16, nBot = tipY + 120;
    function nail() {
      g.beginPath();
      g.moveTo(cx - nw / 2, nBot - 18);
      g.bezierCurveTo(cx - nw / 2, nTop + 22, cx - nw * 0.36, nTop, cx, nTop);
      g.bezierCurveTo(cx + nw * 0.36, nTop, cx + nw / 2, nTop + 22, cx + nw / 2, nBot - 18);
      g.bezierCurveTo(cx + nw / 2, nBot - 2, cx + nw * 0.25, nBot + 3, cx, nBot + 3);
      g.bezierCurveTo(cx - nw * 0.25, nBot + 3, cx - nw / 2, nBot - 2, cx - nw / 2, nBot - 18);
      g.closePath();
    }
    // 爪まわりの溝の影
    g.save(); g.shadowColor = 'rgba(150,80,60,0.55)'; g.shadowBlur = 7; nail(); g.fillStyle = '#f0c0ad'; g.fill(); g.restore();
    nail();
    var ng = g.createLinearGradient(cx - nw / 2, 0, cx + nw / 2, 0);
    ng.addColorStop(0, '#e9b3a6'); ng.addColorStop(0.35, '#fbd9d0'); ng.addColorStop(0.7, '#f5c9bd'); ng.addColorStop(1, '#dea295');
    g.fillStyle = ng; g.fill();
    // 爪の先の白い部分
    g.save(); nail(); g.clip();
    var wg = g.createLinearGradient(0, nTop, 0, nTop + 24);
    wg.addColorStop(0, 'rgba(255,246,238,0.95)'); wg.addColorStop(1, 'rgba(255,246,238,0)');
    g.fillStyle = wg; g.fillRect(0, nTop - 2, W, 30);
    // 根元の半月
    var lg = g.createRadialGradient(cx, nBot + 10, 4, cx, nBot + 10, nw * 0.45);
    lg.addColorStop(0, 'rgba(255,240,236,0.55)'); lg.addColorStop(1, 'rgba(255,240,236,0)');
    g.fillStyle = lg; g.fillRect(0, nBot - 50, W, 60);
    // つや
    g.globalAlpha = 0.55; g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(cx - nw * 0.17, nTop + 46, nw * 0.07, 26, -0.08, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1; g.restore();
    // 甘皮のライン
    g.strokeStyle = 'rgba(170,95,75,0.35)'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx - nw / 2 + 4, nBot - 10); g.quadraticCurveTo(cx, nBot + 12, cx + nw / 2 - 4, nBot - 10); g.stroke();
    // 第一関節・第二関節のしわ（うっすら）
    function crease(y, wdt, a) {
      g.strokeStyle = 'rgba(150,85,65,' + a + ')'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(cx - wdt, y + 6); g.quadraticCurveTo(cx, y - 6, cx + wdt, y + 6); g.stroke();
    }
    crease(212, 34, 0.22); crease(224, 26, 0.16);
    crease(396, 42, 0.2); crease(408, 50, 0.18); crease(420, 36, 0.14);
    // 関節のふくらみの影・光
    var kg = g.createRadialGradient(cx - 10, 405, 4, cx - 10, 405, 60);
    kg.addColorStop(0, 'rgba(255,230,210,0.25)'); kg.addColorStop(1, 'rgba(255,230,210,0)');
    g.fillStyle = kg; g.fillRect(0, 330, W, 160);
    // 縁の締まり（内側に影）
    g.lineWidth = 10; g.strokeStyle = 'rgba(150,85,62,0.22)'; outline(); g.stroke();
    g.restore();
    // 根元を透明にフェード（ちぎれて見えないように）
    g.globalCompositeOperation = 'destination-in';
    var fg = g.createLinearGradient(0, 0, 0, H);
    fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(0.5, 'rgba(0,0,0,1)'); fg.addColorStop(0.82, 'rgba(0,0,0,0.35)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    _fingerTex = new THREE.CanvasTexture(c);
    _fingerTex.colorSpace = THREE.SRGBColorSpace;
    _fingerTex.generateMipmaps = true;
    _fingerTex.minFilter = THREE.LinearMipmapLinearFilter;
    _fingerTex.userData = { tipV: 1 - (tipY + 4) / H, aspect: H / W };
    return _fingerTex;
  }

  G.createGhostFinger = function (ctx) {
    var camera = ctx.camera;
    var tex = fingerTexture();
    var group = new THREE.Group(); group.name = 'ghostFinger'; group.visible = false;
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, rotation: 0.22 });
    var sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, tex.userData.tipV);
    sprite.renderOrder = 1001;
    var smat = new THREE.SpriteMaterial({ map: G.softDotTexture(), color: 0x3a2618, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
    var shadow = new THREE.Sprite(smat); shadow.renderOrder = 1000;
    group.add(shadow, sprite);

    var MAXA = 0.55;
    var st = { phase: 'idle', t: 0, path: null, curve: null, single: false, opts: null, fade: 0, hover: 1, stopFrom: 0 };
    var P = new THREE.Vector3(), up = new THREE.Vector3(), toCam = new THREE.Vector3(), rgt = new THREE.Vector3();

    function sampleAt(u, out) {
      var pts = st.path;
      if (st.single || pts.length === 1) return out.copy(pts[0]);
      if (st.curve) return st.curve.getPointAt(G.clamp(u, 0, 1), out);
      return out.copy(pts[0]).lerp(pts[1], G.clamp(u, 0, 1));
    }

    var api = {
      group: group,
      active: false,
      play: function (points, opts) {
        if (!points || !points.length) return;
        var o = opts || {};
        st.opts = { dur: o.dur != null ? o.dur : 1.6, loop: o.loop !== false, pause: o.pause != null ? o.pause : 0.6, size: o.size || 0.11 };
        st.path = [];
        for (var i = 0; i < points.length; i++) st.path.push(points[i].clone());
        st.single = st.path.length === 1;
        st.curve = st.path.length > 2 ? new THREE.CatmullRomCurve3(st.path, false, 'centripetal') : null;
        st.phase = 'appear'; st.t = 0; st.hover = 1;
        api.active = true; group.visible = true;
      },
      stop: function () {
        if (!api.active) return;
        st.phase = 'stopping'; st.t = 0; st.stopFrom = st.fade;
      },
      update: function (dt) {
        if (!api.active) return;
        var o = st.opts, u = 0;
        st.t += dt;
        var D_APPEAR = 0.35, D_PRESS = 0.22, D_LIFT = 0.22, D_FADE = 0.35;
        var traceDur = st.single ? 0.45 : Math.max(0.2, o.dur);
        switch (st.phase) {
          case 'appear':
            st.fade = G.easeOut(st.t / D_APPEAR); st.hover = 1; u = 0;
            if (st.t >= D_APPEAR) { st.phase = 'press'; st.t = 0; }
            break;
          case 'press':
            st.fade = 1; st.hover = 1 - G.easeInOut(st.t / D_PRESS); u = 0;
            if (st.t >= D_PRESS) { st.phase = 'trace'; st.t = 0; }
            break;
          case 'trace':
            st.fade = 1; st.hover = 0;
            if (st.single) u = 0;
            else u = G.easeInOut(st.t / traceDur);
            if (st.t >= traceDur) { st.phase = 'lift'; st.t = 0; }
            break;
          case 'lift':
            st.fade = 1; st.hover = G.easeInOut(st.t / D_LIFT); u = 1;
            if (st.t >= D_LIFT) { st.phase = 'fade'; st.t = 0; }
            break;
          case 'fade':
            st.fade = 1 - G.easeInOut(st.t / D_FADE); st.hover = 1; u = 1;
            if (st.t >= D_FADE) {
              st.fade = 0;
              if (o.loop) { st.phase = 'wait'; st.t = 0; } else { api.active = false; group.visible = false; st.phase = 'idle'; return; }
            }
            break;
          case 'wait':
            st.fade = 0; u = 0;
            if (st.t >= o.pause) { st.phase = 'appear'; st.t = 0; }
            break;
          case 'stopping':
            st.fade = st.stopFrom * (1 - G.easeOut(st.t / 0.3));
            u = st._u || 0;
            if (st.t >= 0.3) { st.fade = 0; api.active = false; group.visible = false; st.phase = 'idle'; return; }
            break;
        }
        if (st.phase !== 'stopping') st._u = u;
        sampleAt(u, P);

        // カメラに対する向き
        up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        rgt.set(1, 0, 0).applyQuaternion(camera.quaternion);
        toCam.copy(camera.position).sub(P);
        var dist = toCam.length(); toCam.multiplyScalar(1 / Math.max(1e-4, dist));
        var size = o.size, h = st.hover;
        // 浮いている時: 指は少し手前（カメラ寄り）＆画面上で少し上へ、影は大きく薄く
        sprite.position.copy(P).addScaledVector(toCam, size * 0.5 * h).addScaledVector(up, size * 0.22 * h).addScaledVector(rgt, size * 0.08 * h);
        var press = st.phase === 'trace' ? 1 : 1 - h;
        var sc = 1 + 0.1 * h;
        sprite.scale.set(size * sc, size * tex.userData.aspect * sc * (1 - 0.03 * press), 1);
        mat.opacity = MAXA * st.fade;
        // 影: 指先の下。光は左上から → 影はわずかに右下へ
        shadow.position.copy(P).addScaledVector(rgt, size * (0.06 + 0.25 * h)).addScaledVector(up, -size * (0.02 + 0.12 * h));
        var ss = size * (0.55 + 0.9 * h);
        shadow.scale.set(ss * 1.25, ss, 1);
        smat.opacity = (0.42 - 0.26 * h) * st.fade;
      }
    };
    return api;
  };

  // ======================================================================
  // 影マップの使い回し
  //   影を落とす物が（そのライトの影の範囲で）動いた時だけ、そのライトの影マップを描き直す。
  //   頂点シェーダで形が変わる物は mesh.userData.shadowSig(arr) で形を決める値を arr に積む。
  // ======================================================================
  function makeShadowCache(scene) {
    var casters = [], lights = [], force = true;
    var mats = [];
    function collect(o) {
      if (o.isLight) { if (o.castShadow && o.shadow) lights.push(o); return; }
      if (o.castShadow && (o.isMesh || o.isLine || o.isPoints)) casters.push(o);
    }
    function sigOf(light, out) {
      var fr = light.shadow.getFrustum(), n = 0;
      for (var i = 0; i < casters.length; i++) {
        var c = casters[i];
        if (c.frustumCulled && !fr.intersectsObject(c)) continue;
        var e = c.matrixWorld.elements, g = c.geometry, pa = g && g.attributes ? g.attributes.position : null;
        out[n++] = c.id;
        for (var k = 0; k < 16; k++) out[n++] = e[k];
        out[n++] = g ? g.id : 0; out[n++] = pa ? pa.version : 0;
        var m = c.material;
        out[n++] = Array.isArray(m) ? m.length : (m && m.visible ? 1 : 0);
        if (c.userData.shadowSig) { mats.length = 0; c.userData.shadowSig(mats); for (var j = 0; j < mats.length; j++) out[n++] = mats[j]; }
      }
      out.length = n;
    }
    return {
      invalidate: function () { force = true; },
      // renderer.render の直前に呼ぶ
      update: function () {
        casters.length = 0; lights.length = 0;
        scene.updateMatrixWorld();
        scene.traverseVisible(collect);
        for (var i = 0; i < lights.length; i++) {
          var L = lights[i], sh = L.shadow, ud = L.userData;
          sh.autoUpdate = false;
          if (L.target) L.target.updateMatrixWorld();
          sh.updateMatrices(L);
          var cur = ud._shSigB || (ud._shSigB = []), prev = ud._shSig || [];
          sigOf(L, cur);
          var same = !force && prev.length === cur.length;
          if (same) for (var k = 0; k < cur.length; k++) if (cur[k] !== prev[k]) { same = false; break; }
          if (!same) sh.needsUpdate = true;
          ud._shSig = cur; ud._shSigB = prev;
        }
        force = false;
      }
    };
  }

  // ======================================================================
  // 起動
  // ======================================================================
  function showFallback(canvas) {
    try {
      if (canvas) canvas.style.display = 'none';
      if (G.hideSplash) G.hideSplash(true);
      var fb = document.getElementById('fallback');
      if (fb) {
        fb.style.display = 'block';
        if (G.FALLBACK_IMG) fb.style.backgroundImage = 'url("' + G.FALLBACK_IMG + '")';
      }
    } catch (e) { /* noop */ }
  }

  function readSafe(probe, out) {
    if (!probe) return out;
    try {
      var cs = getComputedStyle(probe);
      out.top = parseFloat(cs.paddingTop) || 0; out.right = parseFloat(cs.paddingRight) || 0;
      out.bottom = parseFloat(cs.paddingBottom) || 0; out.left = parseFloat(cs.paddingLeft) || 0;
    } catch (e) { /* noop */ }
    return out;
  }

  function boot() {
    var canvas = document.getElementById('stage');
    if (!canvas || typeof THREE === 'undefined') { showFallback(canvas); return; }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
      if (!renderer.getContext()) throw new Error('no gl');
    } catch (e) {
      try { console.warn('[core] WebGL unavailable', e); } catch (x) { /* noop */ }
      showFallback(canvas); return;
    }

    var app = G.app = {
      renderer: renderer, scene: null, camera: null, canvas: canvas, lowPower: false,
      size: { w: 1, h: 1, aspect: 1 }, safe: { top: 0, right: 0, bottom: 0, left: 0 },
      time: 0, paused: false
    };

    // 描画の解像度: 端末の倍率（最大 2）と、画素数の上限（iPad の大画面で塗りが重くなりすぎない）の小さい方。
    var MAX_PX = 2.6e6, MIN_PR = 0.7;
    function prCap() {
      var w = window.innerWidth || 1, h = window.innerHeight || 1;
      return Math.max(MIN_PR, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PX / (w * h))));
    }
    var basePR = prCap(), pr = basePR;
    try {
      renderer.setPixelRatio(pr);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (e) { report('renderer setup', e); }

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9c8ae);
    var envMap = null;
    try { envMap = G.makeEnvMap(renderer); scene.environment = envMap; } catch (e) { report('envMap', e); }
    var camera = new THREE.PerspectiveCamera(50, 1, 0.05, 30);
    app.scene = scene; app.camera = camera;

    // Safe Area probe
    var probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
    document.body.appendChild(probe);

    function applySize(force) {
      var w = window.innerWidth | 0, h = window.innerHeight | 0;
      if (w <= 0 || h <= 0) return;
      readSafe(probe, app.safe);
      if (!force && w === app.size.w && h === app.size.h) return;
      app.size.w = w; app.size.h = h; app.size.aspect = w / h;
      var cap = prCap();
      if (Math.abs(cap - basePR) > 1e-3) {
        basePR = cap; pr = Math.min(pr, basePR);
        if (!perf || !perf.down) pr = basePR;
        try { renderer.setPixelRatio(pr); } catch (e) { report('setPixelRatio', e); }
      }
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      G.cam.update(0);
      callFlow('onResize', app.size);
    }
    applySize(true);
    G.cam._bind(camera);

    var ctx = {
      renderer: renderer, scene: scene, camera: camera, lowPower: false,
      aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1),
      envMap: envMap
    };
    G.ctx = ctx;
    G.flow = null;
    if (typeof G.createFlow === 'function') {
      try { G.flow = G.createFlow(ctx) || null; } catch (e) { report('createFlow', e); G.flow = null; }
    }

    // ---------------- 入力 ----------------
    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), nrm = new THREE.Vector3();
    var p = {
      x: 0, y: 0, nx: 0, ny: 0, ray: raycaster.ray, t: 0, down: false, cancelled: false, id: -1,
      hitPlaneY: function (y, out) { nrm.set(0, 1, 0); plane.set(nrm, -y); return raycaster.ray.intersectPlane(plane, out || new THREE.Vector3()); },
      hitPlaneZ: function (z, out) { nrm.set(0, 0, 1); plane.set(nrm, -z); return raycaster.ray.intersectPlane(plane, out || new THREE.Vector3()); }
    };
    var activeId = null, firstTouch = false;
    G.input = {
      p: p, enabled: true,
      get active() { return activeId !== null; },
      cancel: function () { endPointer(true); }
    };
    function fillP(e) {
      var w = app.size.w || 1, h = app.size.h || 1;
      p.x = e.clientX; p.y = e.clientY;
      p.nx = (e.clientX / w) * 2 - 1; p.ny = -(e.clientY / h) * 2 + 1;
      p.t = app.time;
      ndc.set(p.nx, p.ny);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
    }
    function endPointer(cancelled, e) {
      if (activeId === null) return;
      var id = activeId; activeId = null;
      if (e) fillP(e);
      p.down = false; p.cancelled = !!cancelled;
      try { if (canvas.hasPointerCapture && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); } catch (x) { /* noop */ }
      callFlow('onUp', p);
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (e.cancelable) e.preventDefault();
      if (!firstTouch) { firstTouch = true; callFlow('onFirstTouch'); }
      if (activeId !== null || !G.input.enabled || app.paused) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      activeId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* noop */ }
      fillP(e); p.down = true; p.cancelled = false; p.id = e.pointerId;
      callFlow('onDown', p);
    }, { passive: false });
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerId !== activeId) return;
      if (e.cancelable) e.preventDefault();
      fillP(e); p.down = true;
      callFlow('onMove', p);
    }, { passive: false });
    canvas.addEventListener('pointerup', function (e) {
      if (e.pointerId === activeId) endPointer(false, e);
      callFlow('onUserGesture');
    }, { passive: false });
    canvas.addEventListener('pointercancel', function (e) { if (e.pointerId === activeId) endPointer(true, e); });
    canvas.addEventListener('lostpointercapture', function (e) { if (e.pointerId === activeId) endPointer(true, e); });
    window.addEventListener('blur', function () { endPointer(true); });

    // スクロール・ズーム・長押し・選択・ドラッグの抑止
    var nf = { passive: false };
    function prevent(e) { if (e.cancelable) e.preventDefault(); }
    document.addEventListener('touchmove', prevent, nf);
    document.addEventListener('touchend', function (e) {
      // ダブルタップズーム抑止（2本目の指が上がる時など）
      if (e.touches && e.touches.length > 0 && e.cancelable) e.preventDefault();
      callFlow('onUserGesture');
    }, nf);
    document.addEventListener('gesturestart', prevent, nf);
    document.addEventListener('gesturechange', prevent, nf);
    document.addEventListener('gestureend', prevent, nf);
    document.addEventListener('dblclick', prevent, nf);
    document.addEventListener('contextmenu', prevent, nf);
    document.addEventListener('selectstart', prevent, nf);
    document.addEventListener('dragstart', prevent, nf);
    document.addEventListener('wheel', function (e) { if (e.ctrlKey) prevent(e); }, nf);

    // ---------------- リサイズ ----------------
    var rsTimer = 0;
    function onResize() {
      applySize(false);
      clearTimeout(rsTimer);
      rsTimer = setTimeout(function () { applySize(true); }, 350); // iOS の回転は遅れて寸法が確定する
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

    // ---------------- ループ ----------------
    var rafId = 0, last = 0, running = false, ctxLost = false;
    var shadows = app.shadows = makeShadowCache(scene);
    // 行列の更新は shadows.update で 1 回だけ行う（render 側での 2 回目を省く）
    scene.matrixWorldAutoUpdate = false;
    // シェーダの用意: 最初の絵は見えている物だけで出す（隠れている物のぶんまで待たない）。
    // 隠れている物（どんぐり・湯気・パパなど）は最初の絵の後に裏で作り、登場の瞬間に止まらないようにする。
    // KHR_parallel_shader_compile があればドライバの裏で、無くても描画の合間に少しずつ進む。
    var warmQ = [], warmBusy = false;
    function warmNext() {
      if (warmBusy || !warmQ.length || ctxLost) return;
      var obj = warmQ.shift();
      warmBusy = true;
      var done = function () { warmBusy = false; setTimeout(warmNext, 30); };
      try {
        // 拡張が無い時の compileAsync は終わらない（r160）ので、その時は普通に作る
        var par = false;
        try { par = !!renderer.getContext().getExtension('KHR_parallel_shader_compile'); } catch (x) { par = false; }
        var pr0 = (par && renderer.compileAsync) ? renderer.compileAsync(obj, camera, scene) : (renderer.compile(obj, camera, scene), null);
        if (pr0 && pr0.then) pr0.then(done, function (e) { report('compileAsync', e); done(); }); else done();
      } catch (e) { report('compile', e); done(); }
    }
    app.warm = function (obj) { warmQ.push(obj || scene); if (frames > 1) warmNext(); };
    var frames = 0;
    function firstFrames() {
      if (frames === 2) {
        // 2 枚目を描いた後: 待ち画面を消し、残りの準備を始める
        try { if (G.hideSplash) G.hideSplash(); } catch (e) { /* noop */ }
        warmQ.unshift(scene);
        setTimeout(warmNext, 60);
        setTimeout(function () { callFlow('onReady'); }, 120);
      }
    }
    // 速度に応じた解像度の調整。
    //  - 48fps を切る状態が続いたら解像度を 1 段下げ、2 秒後に効いたかを確かめる。
    //    効かない（30fps 固定の省電力モードや CPU 側が重い）なら元に戻し、しばらく下げない。
    //  - 余裕が続いたら 1 段戻す。上げ下げを繰り返さないよう、戻す待ち時間は毎回のびる。
    var SLOW_MS = 21, FAST_MS = 18;
    var perf = { avg: 16.7, slow: 0, fast: 0, stuck: 0, warm: 0, lowCalled: false, down: 0, upWait: 4, trial: null, floor: 0, floorT: 0, floorWait: 30 };
    function setPR(v) {
      v = G.clamp(v, MIN_PR, basePR);
      if (Math.abs(v - pr) < 1e-3) return;
      pr = v;
      try { renderer.setPixelRatio(pr); renderer.setSize(app.size.w, app.size.h, false); } catch (e) { report('setPixelRatio', e); }
    }
    function perfStep(rawMs, dt) {
      if (perf.warm < 1.0) { perf.warm += dt; return; }
      if (rawMs > 250) return; // ひっかかり（タブ切替など）は数えない
      perf.avg += (rawMs - perf.avg) * 0.1;
      if (perf.floor > 0) { perf.floorT += dt; if (perf.floorT > perf.floorWait) { perf.floor = 0; perf.floorWait = Math.min(240, perf.floorWait * 2); } }
      var tr = perf.trial;
      if (tr) {
        tr.t += dt;
        if (tr.t < 2) return;
        perf.trial = null;
        if (perf.avg > tr.avg * 0.9) { // 下げても速くならない → 戻す
          setPR(tr.pr); perf.floor = tr.pr; perf.floorT = 0; perf.down = Math.max(0, perf.down - 1);
        }
        perf.slow = perf.fast = 0;
        return;
      }
      if (perf.avg > SLOW_MS) {
        perf.slow += dt; perf.fast = 0;
        var canDown = pr > MIN_PR + 1e-3 && (perf.floor === 0 || pr * 0.85 >= perf.floor - 1e-3);
        if (canDown) {
          perf.stuck = 0;
          if (perf.slow > 1.5) {
            perf.trial = { pr: pr, avg: perf.avg, t: 0 };
            setPR(pr * 0.85); perf.down++; perf.slow = 0;
          }
        } else if (pr <= MIN_PR + 1e-3) {
          perf.stuck += dt;
          if (perf.stuck > 5 && !perf.lowCalled && perf.avg > 40) {
            perf.lowCalled = true; app.lowPower = true; ctx.lowPower = true;
            callFlow('onLowPower');
          }
        }
      } else {
        perf.slow = 0; perf.stuck = 0;
        if (perf.avg < FAST_MS && pr < basePR - 1e-3) {
          perf.fast += dt;
          if (perf.fast > perf.upWait) {
            setPR(pr / 0.85); perf.fast = 0; perf.down = Math.max(0, perf.down - 1);
            perf.upWait = Math.min(60, perf.upWait * 2);
          }
        } else perf.fast = 0;
      }
    }
    function frame(now) {
      rafId = 0;
      if (!running) return;
      rafId = requestAnimationFrame(frame);
      var raw = now - last; last = now;
      if (raw < 0) raw = 0;
      var dt = Math.min(0.05, raw / 1000);
      app.time += dt;
      try { G.cam.update(dt); } catch (e) { report('cam.update', e); }
      callFlow('update', dt, app.time);
      try { shadows.update(); } catch (e) { report('shadows', e); shadows.invalidate(); scene.matrixWorldAutoUpdate = true; scene.traverse(function (o) { if (o.isLight && o.shadow) o.shadow.autoUpdate = true; }); }
      try { renderer.render(scene, camera); } catch (e) { report('render', e); }
      if (frames < 3) { frames++; firstFrames(); }
      perfStep(raw, dt);
    }
    function start() {
      if (running || ctxLost) return;
      running = true; last = performance.now(); perf.warm = 0; perf.slow = perf.fast = perf.stuck = 0;
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    }

    function pause() {
      if (app.paused) return;
      app.paused = true;
      endPointer(true);
      stop();
      G.save.flush();
      callFlow('onPause');
    }
    function resume() {
      if (!app.paused || ctxLost) return;
      if (document.hidden) return;
      app.paused = false;
      applySize(true);
      callFlow('onResume');
      start();
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else resume(); });
    window.addEventListener('pagehide', function () { G.save.flush(); pause(); });
    window.addEventListener('pageshow', function () { resume(); });

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); ctxLost = true; endPointer(true); stop();
      if (!app.paused) { app.paused = true; callFlow('onPause'); }
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      ctxLost = false; shadows.invalidate();
      if (!document.hidden) { app.paused = false; callFlow('onResume'); start(); }
    }, false);

    if (document.hidden) { app.paused = true; } else start();
  }

  function safeBoot() {
    try { boot(); } catch (e) {
      try { console.error('[core] boot failed', e); } catch (x) { /* noop */ }
      showFallback(document.getElementById('stage'));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot);
  else setTimeout(safeBoot, 0);
})();

/* env.js */
/* env.js — 部屋・小物・照明: G.createStage(ctx)
   床（オークのフローリング）、アイロンマット、籐のかご、奥の壁と巾木、ドアと廊下、
   壁のペグと木のハンガー、照明（朝日+影、天空光、窓の光だまり、注目の光）。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};

  // ---- 周期つき値ノイズ（タイルの継ぎ目が出ない） ----
  function hsh(x, y, s) { var n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
  var pCache = {}; // seed ごとに直前のマスの値を覚える（結果は同じ。Math.sin の呼び出しを減らす）
  function pnoise(x, y, P, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var k = pCache[s];
    if (!k) k = pCache[s] = { x: NaN, y: NaN, p: NaN, a: 0, b: 0, c: 0, d: 0 };
    if (k.x !== xi || k.y !== yi || k.p !== P) {
      var x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
      k.x = xi; k.y = yi; k.p = P;
      k.a = hsh(x0, y0, s); k.b = hsh(x1, y0, s); k.c = hsh(x0, y1, s); k.d = hsh(x1, y1, s);
    }
    var a = k.a, b = k.b, c = k.c, d = k.d;
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function c8(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }
  function newImg(w, h) { var c = G.makeCanvas(w, h); var g = c.getContext('2d'); return { c: c, g: g, d: g.createImageData(w, h) }; }
  function put(o) { o.g.putImageData(o.d, 0, 0); return o.c; }

  // ---------------- 床: オークのフローリング ----------------
  // 1タイル = 22枚 × 9cm = 1.98m 四方。板は v 方向（world Z）に流れる。
  function makeFloorMaps(S) {
    var planks = 22, pw = S / planks, R = G.rng(1207);
    var col = newImg(S, S), rgh = newImg(S, S), bmp = newImg(S, S);
    var cd = col.d.data, rd = rgh.d.data, bd = bmp.d.data;
    var pxPerM = S / 1.98;
    var segOf = [], startOf = [], distOf = [], segs = [];
    var i, y, x;
    for (i = 0; i < planks; i++) {
      var off = Math.floor(R() * S), cuts = [off], p = off;
      for (;;) { p += Math.floor((0.45 + R() * 1.0) * pxPerM); if (p >= off + S - 0.25 * pxPerM) break; cuts.push(p); }
      var so = new Int16Array(S), st = new Int16Array(S), di = new Float32Array(S);
      for (var k = 0; k < cuts.length; k++) {
        var a = cuts[k], b = (k + 1 < cuts.length) ? cuts[k + 1] : off + S, id = segs.length;
        var tone = 0.9 + R() * 0.17, warm = (R() - 0.5) * 0.08;
        if (R() < 0.12) tone *= 0.9; // ところどころ濃い板
        segs.push({ tone: tone, warm: warm, seed: R() * 1000 });
        for (var yy = a; yy < b; yy++) {
          var m = yy % S; so[m] = id; st[m] = a % S; di[m] = Math.min(yy - a, b - yy);
        }
      }
      segOf.push(so); startOf.push(st); distOf.push(di);
    }
    var base = [200, 168, 132];
    for (x = 0; x < S; x++) {
      i = Math.min(planks - 1, Math.floor(x / pw));
      var u = x - i * pw, edge = Math.min(u, pw - u);
      var so2 = segOf[i], st2 = startOf[i], di2 = distOf[i];
      for (y = 0; y < S; y++) {
        var sg = segs[so2[y]];
        var gv = ((y - st2[y] + S) % S) + sg.seed * 7.3, gu = u + sg.seed * 3.1;
        var w1 = G.noise2(gu * 0.05, gv * 0.0016, 1);
        var ph = gu * 0.38 + w1 * 10 + G.noise2(gu * 0.013, gv * 0.005, 2) * 7;
        var ln = 0.5 + 0.5 * Math.sin(ph); ln *= ln; ln *= ln; ln *= ln;
        var fl = G.noise2(gu * 0.8, gv * 0.06, 3);
        var f = sg.tone * (1 - 0.2 * ln - 0.08 * fl + 0.1 * (w1 - 0.5));
        var bev = 1, rr = 0.5 + 0.1 * ln + 0.06 * fl, bb = 205 - 30 * ln - 12 * fl;
        var dj = di2[y];
        if (edge < 0.9 || dj < 0.9) { bev = 0.42; rr = 0.85; bb = 30; }
        else if (edge < 1.9 || dj < 1.9) { bev = 0.86; rr = 0.62; bb = 150; }
        var o = (y * S + x) * 4;
        cd[o] = c8(base[0] * f * bev * (1 + sg.warm)); cd[o + 1] = c8(base[1] * f * bev); cd[o + 2] = c8(base[2] * f * bev * (1 - sg.warm * 1.4)); cd[o + 3] = 255;
        var rv = c8(rr * 255); rd[o] = rv; rd[o + 1] = rv; rd[o + 2] = rv; rd[o + 3] = 255;
        bd[o] = bd[o + 1] = bd[o + 2] = c8(bb); bd[o + 3] = 255;
      }
    }
    return { color: put(col), rough: put(rgh), bump: put(bmp) };
  }

  // ---------------- アイロンマット: キルティングの綿地 ----------------
  // 1タイル = 0.25m 四方。菱形ステッチ 128px（約6.25cm）。
  function makeMatMaps(S) {
    var col = newImg(S, S), bmp = newImg(S, S), cd = col.d.data, bd = bmp.d.data;
    var D = S / 4, base = [178, 165, 146];
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var a = ((x + y) % D) / D, b = ((x - y + S * 4) % D) / D;
        var h = Math.sqrt(Math.sin(Math.PI * a) * Math.sin(Math.PI * b));
        var wv = (((x >> 1) + (y >> 1)) & 1) ? 1 : 0;
        var fib = pnoise(x * 0.18, y * 0.18, S * 0.18, 4), fib2 = pnoise(x * 0.04, y * 0.04, S * 0.04, 5);
        var f = (0.9 + 0.1 * h) * (1 - 0.035 * wv) * (0.96 + 0.06 * fib) * (0.97 + 0.05 * fib2);
        var bb = 60 + 160 * h + 18 * wv + 10 * fib;
        var la = Math.min(a, 1 - a) * D, lb = Math.min(b, 1 - b) * D;
        if ((la < 1.1 && ((x + 1 >> 2) & 1)) || (lb < 1.1 && ((x >> 2) & 1))) { f *= 0.9; bb = 30; }
        var o = (y * S + x) * 4;
        cd[o] = c8(base[0] * f); cd[o + 1] = c8(base[1] * f); cd[o + 2] = c8(base[2] * f); cd[o + 3] = 255;
        bd[o] = bd[o + 1] = bd[o + 2] = c8(bb); bd[o + 3] = 255;
      }
    }
    return { color: put(col), bump: put(bmp) };
  }

  // ---------------- 籐の編み目 ----------------
  function makeWeaveMaps(S) {
    var col = newImg(S, S), bmp = newImg(S, S), cd = col.d.data, bd = bmp.d.data;
    var NC = 8, NR = 16, cw = S / NC, rh = S / NR, base = [196, 152, 92];
    for (var y = 0; y < S; y++) {
      var row = Math.floor(y / rh), fv = (y % rh) / rh, rowTone = 0.88 + 0.2 * hsh(row, 3, 9);
      for (var x = 0; x < S; x++) {
        var cx = Math.floor(x / cw), fu = (x % cw) / cw, h, tone, fibr;
        if (((cx + row) & 1) === 0) { // よこ糸が上
          h = Math.pow(Math.sin(Math.PI * fv), 0.6) * (0.72 + 0.28 * Math.sin(Math.PI * fu));
          tone = rowTone; fibr = pnoise(x * 0.04, y * 0.9, S * 0.04, 7);
        } else {
          var su = (fu - 0.5) / 0.24;
          if (Math.abs(su) < 1) { h = 0.8 * Math.sqrt(1 - su * su) * (0.8 + 0.2 * Math.sin(Math.PI * fv)); tone = 0.95 + 0.1 * hsh(cx, 5, 2); fibr = pnoise(x * 0.9, y * 0.04, S * 0.9, 8); }
          else { h = 0.22 * Math.sin(Math.PI * fv); tone = rowTone * 0.9; fibr = 0.5; }
        }
        var f = tone * (0.3 + 0.7 * h) * (0.9 + 0.2 * fibr);
        var o = (y * S + x) * 4;
        cd[o] = c8(base[0] * f); cd[o + 1] = c8(base[1] * f); cd[o + 2] = c8(base[2] * f * 0.95); cd[o + 3] = 255;
        bd[o] = bd[o + 1] = bd[o + 2] = c8(h * 240); bd[o + 3] = 255;
      }
    }
    return { color: put(col), bump: put(bmp) };
  }
  function makeWrapMaps(S) { // 縁の巻き（斜めの帯）
    var col = newImg(S, S), bmp = newImg(S, S), cd = col.d.data, bd = bmp.d.data, base = [190, 146, 88], P = S / 8;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var f0 = ((x + y) % P) / P, h = Math.pow(Math.sin(Math.PI * f0), 0.7);
      var k = Math.floor((x + y) / P), t = (0.9 + 0.18 * hsh(k, 1, 4)) * (0.35 + 0.65 * h) * (0.92 + 0.14 * pnoise((x - y) * 0.3, (x + y) * 0.02, 1e6, 3));
      var o = (y * S + x) * 4;
      cd[o] = c8(base[0] * t); cd[o + 1] = c8(base[1] * t); cd[o + 2] = c8(base[2] * t); cd[o + 3] = 255;
      bd[o] = bd[o + 1] = bd[o + 2] = c8(h * 240); bd[o + 3] = 255;
    }
    return { color: put(col), bump: put(bmp) };
  }

  // ---------------- 壁紙 ----------------
  function makeWallMaps(S) { // 1タイル = 0.5m
    var col = newImg(S, S), bmp = newImg(S, S), cd = col.d.data, bd = bmp.d.data, base = [238, 233, 224];
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var n1 = pnoise(x * 0.5, y * 0.5, S * 0.5, 11), n2 = pnoise(x * 0.12, y * 0.12, S * 0.12, 12), n3 = pnoise(x * 0.02, y * 0.02, S * 0.02, 13);
      var f = 0.985 + 0.02 * n1 + 0.012 * n2 + 0.01 * n3;
      var o = (y * S + x) * 4;
      cd[o] = c8(base[0] * f); cd[o + 1] = c8(base[1] * f); cd[o + 2] = c8(base[2] * f); cd[o + 3] = 255;
      bd[o] = bd[o + 1] = bd[o + 2] = c8(70 + 110 * n1 + 70 * n2); bd[o + 3] = 255;
    }
    return { color: put(col), bump: put(bmp) };
  }

  // ---------------- 木目（ドア・枠・ペグ・ハンガー） ----------------
  // 木目は v 方向。panels: ドアの框と鏡板の溝を描く
  function makeWoodMaps(W, H, base, seed, panels) {
    var col = newImg(W, H), bmp = newImg(W, H), cd = col.d.data, bd = bmp.d.data;
    var R = G.rng(seed), strips = 6, sw = W / strips, tones = [];
    for (var s = 0; s < strips; s++) tones.push(0.93 + R() * 0.12);
    var grooves = panels ? [
      [0.17, 0.08, 0.83, 0.50], [0.17, 0.57, 0.83, 0.93]
    ] : [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var si = Math.min(strips - 1, Math.floor(x / sw)), gu = x + si * 91, gv = y + si * 37;
      var w1 = G.noise2(gu * 0.03, gv * 0.002, 21);
      var ph = gu * 0.32 + w1 * 12 + G.noise2(gu * 0.01, gv * 0.004, 22) * 6;
      var ln = 0.5 + 0.5 * Math.sin(ph); ln *= ln; ln *= ln; ln *= ln;
      var fl = G.noise2(gu * 0.6, gv * 0.05, 23);
      var f = tones[si] * (1 - 0.16 * ln - 0.06 * fl + 0.06 * (w1 - 0.5)), bb = 200 - 30 * ln;
      for (var gi = 0; gi < grooves.length; gi++) {
        var q = grooves[gi], ux = x / W, vy = y / H;
        var dx = Math.min(Math.abs(ux - q[0]) * W, Math.abs(ux - q[2]) * W), dy = Math.min(Math.abs(vy - q[1]) * H, Math.abs(vy - q[3]) * H);
        var inX = ux > q[0] - 0.01 && ux < q[2] + 0.01, inY = vy > q[1] - 0.006 && vy < q[3] + 0.006;
        if ((inY && dx < 3.5) || (inX && dy < 3.5)) { var e = Math.min(inY ? dx : 9, inX ? dy : 9); f *= 0.72 + 0.08 * e; bb = 40 + 30 * e; }
      }
      var o = (y * W + x) * 4;
      cd[o] = c8(base[0] * f); cd[o + 1] = c8(base[1] * f); cd[o + 2] = c8(base[2] * f); cd[o + 3] = 255;
      bd[o] = bd[o + 1] = bd[o + 2] = c8(bb); bd[o + 3] = 255;
    }
    return { color: put(col), bump: put(bmp) };
  }

  // ---------------- 窓の形の光（SpotLight の cookie） ----------------
  function makeWindowCookie() {
    var s = 256, c = G.makeCanvas(s, s), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    var x0 = 34, y0 = 22, x1 = 222, y1 = 234, m = 11, fr = 6;
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    var gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#fff8e8'); gr.addColorStop(1, '#ffe7c2');
    g.fillStyle = gr;
    g.fillRect(x0 + fr, y0 + fr, mx - m / 2 - x0 - fr, my - m / 2 - y0 - fr);
    g.fillRect(mx + m / 2, y0 + fr, x1 - fr - mx - m / 2, my - m / 2 - y0 - fr);
    g.fillRect(x0 + fr, my + m / 2, mx - m / 2 - x0 - fr, y1 - fr - my - m / 2);
    g.fillRect(mx + m / 2, my + m / 2, x1 - fr - mx - m / 2, y1 - fr - my - m / 2);
    // 拡大してやわらかい縁に
    var S = 512, c2 = G.makeCanvas(S, S), g2 = c2.getContext('2d');
    g2.imageSmoothingEnabled = true; g2.imageSmoothingQuality = 'high';
    var tmp = G.makeCanvas(40, 40); tmp.getContext('2d').drawImage(c, 0, 0, 40, 40);
    g2.globalAlpha = 1; g2.drawImage(c, 0, 0, S, S);
    g2.globalAlpha = 0.3; g2.drawImage(tmp, 0, 0, S, S); g2.globalAlpha = 1;
    // まわりのぼんやりした明るさ（朝の空気感）
    var rg = g2.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.5);
    rg.addColorStop(0, 'rgba(255,236,200,0.10)'); rg.addColorStop(1, 'rgba(255,236,200,0)');
    g2.globalCompositeOperation = 'lighter'; g2.fillStyle = rg; g2.fillRect(0, 0, S, S);
    var t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function gradTex(w, h, stops, horiz) {
    var c = G.makeCanvas(w, h), g = c.getContext('2d');
    var gr = horiz ? g.createLinearGradient(0, 0, w, 0) : g.createLinearGradient(0, 0, 0, h);
    for (var i = 0; i < stops.length; i++) gr.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  function roundedRectShape(hw, hd, r) {
    var s = new THREE.Shape();
    s.moveTo(-hw + r, -hd); s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r);
    s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd);
    s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r);
    s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
    return s;
  }
  function shadowed(m, cast, recv) { m.castShadow = !!cast; m.receiveShadow = recv !== false; return m; }

  // ======================================================================
  G.createStage = function (ctx) {
    var L = G.L, low = !!ctx.lowPower, aniso = ctx.aniso || 4;
    var group = new THREE.Group(); group.name = 'stage';
    var tmpV = new THREE.Vector3();

    // ---------- 床 ----------
    var fm = makeFloorMaps(low ? 512 : 1024);
    var fRep = 6 / 1.98;
    var floorCol = G.canvasTexture(fm.color, { srgb: true, repeat: [fRep, fRep], aniso: aniso });
    var floorRgh = G.canvasTexture(fm.rough, { repeat: [fRep, fRep], aniso: aniso });
    var floorBmp = G.canvasTexture(fm.bump, { repeat: [fRep, fRep], aniso: aniso });
    var floorMat = new THREE.MeshStandardMaterial({ map: floorCol, roughnessMap: floorRgh, roughness: 1, bumpMap: floorBmp, bumpScale: 1.2, metalness: 0, envMapIntensity: 0.8 });
    var floor = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(6, 6), floorMat), false, true);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, L.wallZ + 3);
    floorCol.offset.set(0.13, 0.31); floorRgh.offset.copy(floorCol.offset); floorBmp.offset.copy(floorCol.offset);
    floor.name = 'floor'; group.add(floor);

    // ---------- アイロンマット ----------
    var mm = makeMatMaps(512);
    var matCol = G.canvasTexture(mm.color, { srgb: true, repeat: [4, 4], aniso: aniso });
    var matBmp = G.canvasTexture(mm.bump, { repeat: [4, 4], aniso: aniso });
    var matTopMat = new THREE.MeshStandardMaterial({ map: matCol, bumpMap: matBmp, bumpScale: 2.0, roughness: 0.93, metalness: 0, envMapIntensity: 0.6 });
    var matSideMat = new THREE.MeshStandardMaterial({ color: 0x8c7d6c, roughness: 0.9, envMapIntensity: 0.6 });
    var mhw = L.mat.w / 2 - 0.012, mhd = L.mat.d / 2 - 0.012, bev = 0.004;
    var matGeo = new THREE.ExtrudeGeometry(roundedRectShape(mhw, mhd, 0.05), { depth: L.matTop - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.006, bevelSegments: 3, curveSegments: 10 });
    var matMesh = shadowed(new THREE.Mesh(matGeo, [matTopMat, matSideMat]), false, true);
    matMesh.rotation.x = -Math.PI / 2; matMesh.position.y = bev; matMesh.name = 'mat';
    group.add(matMesh);
    // パイピング（縁の玉縁）
    var pipeShape = roundedRectShape(mhw + 0.006, mhd + 0.006, 0.056);
    var pts2 = pipeShape.getSpacedPoints(220), pts3 = [];
    for (var pi = 0; pi < pts2.length - 1; pi++) pts3.push(new THREE.Vector3(pts2[pi].x, L.matTop * 0.55, -pts2[pi].y));
    var pipeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3, true), 440, 0.0062, 8, true);
    var pipeMat = new THREE.MeshStandardMaterial({ color: 0x86776a, roughness: 0.82, envMapIntensity: 0.6 });
    group.add(shadowed(new THREE.Mesh(pipeGeo, pipeMat), false, true));

    // ---------- 洗濯かご ----------
    var B = L.basket;
    var wv = makeWeaveMaps(low ? 256 : 512), wr = makeWrapMaps(256);
    var wvCol = G.canvasTexture(wv.color, { srgb: true, repeat: [9, 2], aniso: aniso });
    var wvBmp = G.canvasTexture(wv.bump, { repeat: [9, 2], aniso: aniso });
    var wvColIn = G.canvasTexture(wv.color, { srgb: true, repeat: [8, 2], aniso: aniso });
    var wvBmpIn = G.canvasTexture(wv.bump, { repeat: [8, 2], aniso: aniso });
    var outerMat = new THREE.MeshStandardMaterial({ map: wvCol, bumpMap: wvBmp, bumpScale: 3, roughness: 0.72, envMapIntensity: 0.7 });
    var innerMat = new THREE.MeshStandardMaterial({ map: wvColIn, bumpMap: wvBmpIn, bumpScale: 3, roughness: 0.8, color: 0xa89580, side: THREE.BackSide, envMapIntensity: 0.4 });
    var basket = new THREE.Group(); basket.name = 'basket';
    basket.position.set(B.x, 0, B.z);
    var basketTilt = new THREE.Group(); basket.add(basketTilt);
    var prof = [], rTop = B.r, rBot = B.r * 0.86, hh = B.h - 0.008;
    for (var j = 0; j <= 12; j++) {
      var tt = j / 12, rr0 = rBot + (rTop - rBot) * Math.pow(tt, 0.9) + Math.sin(tt * Math.PI) * 0.006;
      prof.push(new THREE.Vector2(rr0, 0.004 + tt * (hh - 0.004)));
    }
    var outerGeo = new THREE.LatheGeometry(prof, 72);
    basketTilt.add(shadowed(new THREE.Mesh(outerGeo, outerMat), true, true));
    var profIn = prof.map(function (p) { return new THREE.Vector2(p.x - 0.009, p.y); });
    profIn[0].y = 0.014;
    var innerGeo = new THREE.LatheGeometry(profIn, 72);
    basketTilt.add(shadowed(new THREE.Mesh(innerGeo, innerMat), false, true));
    // 底（外の下面と内側の底）
    var bottomIn = new THREE.Mesh(new THREE.CircleGeometry(profIn[0].x, 48), new THREE.MeshStandardMaterial({ map: wvColIn, bumpMap: wvBmpIn, bumpScale: 3, color: 0x8c7a66, roughness: 0.85 }));
    bottomIn.rotation.x = -Math.PI / 2; bottomIn.position.y = 0.014; basketTilt.add(shadowed(bottomIn, false, true));
    var bottomOut = new THREE.Mesh(new THREE.CylinderGeometry(rBot + 0.002, rBot - 0.004, 0.008, 48), new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.8 }));
    bottomOut.position.y = 0.004; basketTilt.add(shadowed(bottomOut, true, true));
    // 厚い縁
    var wrCol = G.canvasTexture(wr.color, { srgb: true, repeat: [64, 1], aniso: aniso });
    var wrBmp = G.canvasTexture(wr.bump, { repeat: [64, 1], aniso: aniso });
    var rim = new THREE.Mesh(new THREE.TorusGeometry(rTop - 0.004, 0.0135, 12, 96), new THREE.MeshStandardMaterial({ map: wrCol, bumpMap: wrBmp, bumpScale: 3, roughness: 0.65, envMapIntensity: 0.7 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = hh + 0.004;
    basketTilt.add(shadowed(rim, true, true));
    group.add(basket);
    var basketMouth = new THREE.Vector3(B.x, 0.15, B.z);
    var bw = { a: 0, v: 0, phi: 0 };

    // ---------- 奥の壁・巾木 ----------
    var D = L.door, wallZ = L.wallZ, dx0 = D.x - D.w / 2, dx1 = D.x + D.w / 2, jt = 0.016;
    var wm = makeWallMaps(low ? 256 : 512);
    var wallCol = G.canvasTexture(wm.color, { srgb: true, repeat: [2, 2], aniso: aniso });
    var wallBmp = G.canvasTexture(wm.bump, { repeat: [2, 2], aniso: aniso });
    var wallMat = new THREE.MeshStandardMaterial({ map: wallCol, bumpMap: wallBmp, bumpScale: 0.6, roughness: 0.92, envMapIntensity: 0.5 });
    var wallShape = new THREE.Shape();
    wallShape.moveTo(-3, 0); wallShape.lineTo(3, 0); wallShape.lineTo(3, 2.6); wallShape.lineTo(-3, 2.6); wallShape.lineTo(-3, 0);
    var hole = new THREE.Path();
    hole.moveTo(dx0 - jt, 0); hole.lineTo(dx0 - jt, D.h + jt); hole.lineTo(dx1 + jt, D.h + jt); hole.lineTo(dx1 + jt, 0); hole.lineTo(dx0 - jt, 0);
    wallShape.holes.push(hole);
    var wall = shadowed(new THREE.Mesh(new THREE.ShapeGeometry(wallShape), wallMat), false, true);
    wall.position.z = wallZ; wall.name = 'wall'; group.add(wall);
    var whiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.42, envMapIntensity: 0.7 });
    var cas = 0.065;
    var bbL = (dx0 - cas) - (-3), bbR = 3 - (dx1 + cas);
    var bb1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(bbL, 0.07, 0.012), whiteMat), true, true);
    bb1.position.set(-3 + bbL / 2, 0.035, wallZ + 0.006); group.add(bb1);
    var bb2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(bbR, 0.07, 0.012), whiteMat), true, true);
    bb2.position.set(3 - bbR / 2, 0.035, wallZ + 0.006); group.add(bb2);
    // 巾木の上端の小さな面取り
    var bbTop = new THREE.Mesh(new THREE.BoxGeometry(bbL, 0.006, 0.008), whiteMat); bbTop.position.set(-3 + bbL / 2, 0.072, wallZ + 0.004); group.add(bbTop);
    var bbTop2 = new THREE.Mesh(new THREE.BoxGeometry(bbR, 0.006, 0.008), whiteMat); bbTop2.position.set(3 - bbR / 2, 0.072, wallZ + 0.004); group.add(bbTop2);

    // ---------- ドア・枠・廊下 ----------
    var dm = makeWoodMaps(low ? 256 : 512, low ? 512 : 1024, [196, 156, 110], 77, true);
    var doorCol = G.canvasTexture(dm.color, { srgb: true, aniso: aniso });
    var doorBmp = G.canvasTexture(dm.bump, { aniso: aniso });
    var doorMat = new THREE.MeshStandardMaterial({ map: doorCol, bumpMap: doorBmp, bumpScale: 1.5, roughness: 0.5, envMapIntensity: 0.8 });
    var wdm = makeWoodMaps(256, 256, [192, 152, 106], 31, false);
    var woodCol = G.canvasTexture(wdm.color, { srgb: true, aniso: aniso });
    var woodBmp = G.canvasTexture(wdm.bump, { aniso: aniso });
    var caseMat = new THREE.MeshStandardMaterial({ map: woodCol, bumpMap: woodBmp, bumpScale: 1, roughness: 0.5, envMapIntensity: 0.8 });
    function box(w, h, d, mat, x, y, z, cast) { var m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), cast !== false, true); m.position.set(x, y, z); group.add(m); return m; }
    // 化粧枠（壁の表）
    box(cas, D.h + jt + cas, 0.018, caseMat, dx0 - jt - cas / 2 + 0.004, (D.h + jt + cas) / 2, wallZ + 0.009);
    box(cas, D.h + jt + cas, 0.018, caseMat, dx1 + jt + cas / 2 - 0.004, (D.h + jt + cas) / 2, wallZ + 0.009);
    box(D.w + 2 * jt + 2 * cas - 0.008, cas, 0.018, caseMat, D.x, D.h + jt + cas / 2, wallZ + 0.009);
    // 枠の内側（壁の厚み）
    var jd = 0.13;
    box(jt, D.h + jt, jd, caseMat, dx0 - jt / 2, (D.h + jt) / 2, wallZ - jd / 2, false);
    box(jt, D.h + jt, jd, caseMat, dx1 + jt / 2, (D.h + jt) / 2, wallZ - jd / 2, false);
    box(D.w + 2 * jt, jt, jd, caseMat, D.x, D.h + jt / 2, wallZ - jd / 2, false);
    // 戸当たり
    box(0.012, D.h, 0.012, caseMat, dx0 + 0.006, D.h / 2, wallZ - 0.072, false);
    box(D.w, 0.012, 0.012, caseMat, D.x, D.h - 0.006, wallZ - 0.072, false);
    // ドア本体（右端の蝶番を軸に -Z へ開く）
    var doorPivot = new THREE.Group(); doorPivot.position.set(dx1 - 0.002, 0, wallZ - 0.045); group.add(doorPivot);
    var leafW = D.w - 0.006, leafH = D.h - 0.008, leafT = 0.036;
    var leaf = shadowed(new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, leafT), doorMat), true, true);
    leaf.position.set(-leafW / 2, 0.006 + leafH / 2, leafT / 2); doorPivot.add(leaf);
    var metal = new THREE.MeshStandardMaterial({ color: 0xc9c6c0, metalness: 1, roughness: 0.32, envMapIntensity: 1.0 });
    function handle(side) {
      var hg = new THREE.Group();
      var ros = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.027, 0.008, 32), metal); ros.rotation.x = Math.PI / 2; ros.position.z = 0.004; hg.add(ros);
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.05, 16), metal); neck.rotation.x = Math.PI / 2; neck.position.z = 0.03; hg.add(neck);
      var lev = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.11, 4, 12), metal); lev.rotation.z = Math.PI / 2; lev.position.set(0.055, 0, 0.055); lev.scale.set(1, 1, 0.8); hg.add(lev);
      var keyR = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 24), metal); keyR.rotation.x = Math.PI / 2; keyR.position.set(0, -0.085, 0.003); hg.add(keyR);
      hg.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      hg.position.set(-leafW + 0.065, 1.0, side > 0 ? leafT : 0);
      if (side < 0) hg.rotation.y = Math.PI;
      if (side < 0) hg.scale.x = -1;
      doorPivot.add(hg);
    }
    handle(1); handle(-1);
    // 蝶番
    for (var hi = 0; hi < 3; hi++) {
      var hy = [0.22, 1.0, 1.78][hi];
      var hn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 12), metal); hn.position.set(0.001, hy, leafT * 0.85); doorPivot.add(hn);
    }
    // 廊下（明るく暖かい。発光の面）
    var hallZ0 = wallZ - jd, hallDepth = 1.4, hallX0 = D.x - 1.2, hallX1 = D.x + 1.3, hallH = 2.45;
    var hallBack = new THREE.MeshBasicMaterial({ map: gradTex(16, 256, [[0, '#f6e4c6'], [0.55, '#fff1d8'], [1, '#e6c9a0']]) });
    hallBack.color.setScalar(1.15);
    var hb = new THREE.Mesh(new THREE.PlaneGeometry(hallX1 - hallX0, hallH), hallBack);
    hb.position.set((hallX0 + hallX1) / 2, hallH / 2, hallZ0 - hallDepth); group.add(hb);
    var hfMat = new THREE.MeshBasicMaterial({ map: G.canvasTexture(fm.color, { srgb: true, repeat: [1.25, 0.7] }) });
    hfMat.color.setRGB(1.12, 1.02, 0.88);
    var hf = new THREE.Mesh(new THREE.PlaneGeometry(hallX1 - hallX0, hallDepth), hfMat);
    hf.rotation.x = -Math.PI / 2; hf.position.set((hallX0 + hallX1) / 2, 0.001, hallZ0 - hallDepth / 2); group.add(hf);
    var hsMat = new THREE.MeshBasicMaterial({ map: gradTex(256, 16, [[0, '#d9bf98'], [1, '#f7e6c8']], true), side: THREE.DoubleSide });
    var hl = new THREE.Mesh(new THREE.PlaneGeometry(hallDepth, hallH), hsMat); hl.rotation.y = Math.PI / 2; hl.position.set(hallX0, hallH / 2, hallZ0 - hallDepth / 2); group.add(hl);
    var hr = new THREE.Mesh(new THREE.PlaneGeometry(hallDepth, hallH), hsMat); hr.rotation.y = -Math.PI / 2; hr.position.set(hallX1, hallH / 2, hallZ0 - hallDepth / 2); group.add(hr);
    var hc = new THREE.Mesh(new THREE.PlaneGeometry(hallX1 - hallX0, hallDepth), new THREE.MeshBasicMaterial({ color: 0xf2e2c8 }));
    hc.rotation.x = Math.PI / 2; hc.position.set((hallX0 + hallX1) / 2, hallH, hallZ0 - hallDepth / 2); group.add(hc);
    var hbb = new THREE.Mesh(new THREE.PlaneGeometry(hallX1 - hallX0, 0.07), new THREE.MeshBasicMaterial({ color: 0xfaf3e6 }));
    hbb.position.set((hallX0 + hallX1) / 2, 0.035, hallZ0 - hallDepth + 0.002); group.add(hbb);
    // 廊下の上から当たる光のあわい丸
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: G.softDotTexture(), color: 0xfff3dc, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(D.x - 0.1, 1.7, hallZ0 - hallDepth + 0.004); group.add(glow);

    // ---------- 壁のペグ ----------
    var H = L.hook;
    var pegMat = new THREE.MeshStandardMaterial({ map: woodCol, bumpMap: woodBmp, bumpScale: 1, roughness: 0.45, color: 0xf0e2cc, envMapIntensity: 0.8 });
    var pegBoard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.014), pegMat), true, true);
    pegBoard.position.set(H.x, H.y - 0.012, wallZ + 0.007); group.add(pegBoard);
    var pegY = H.y - 0.0103, pegR = 0.0085;
    var peg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(pegR, pegR, 0.052, 20), pegMat), true, true);
    peg.rotation.x = Math.PI / 2; peg.position.set(H.x, pegY, wallZ + 0.014 + 0.026); group.add(peg);
    var knob = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.0125, 20, 14), pegMat), true, true);
    knob.scale.z = 0.7; knob.position.set(H.x, pegY, wallZ + 0.066); group.add(knob);

    // ---------- 木のハンガー ----------
    var hangerGroup = new THREE.Group(); hangerGroup.name = 'hanger';
    hangerGroup.position.set(H.x, H.y, H.z); group.add(hangerGroup);
    var hs = new THREE.Shape();
    hs.moveTo(-0.212, -0.150);
    hs.quadraticCurveTo(-0.11, -0.080, 0, -0.070);
    hs.quadraticCurveTo(0.11, -0.080, 0.212, -0.150);
    hs.quadraticCurveTo(0.224, -0.163, 0.206, -0.173);
    hs.quadraticCurveTo(0.10, -0.120, 0, -0.113);
    hs.quadraticCurveTo(-0.10, -0.120, -0.206, -0.173);
    hs.quadraticCurveTo(-0.224, -0.163, -0.212, -0.150);
    var hgGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.010, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.0035, bevelSegments: 3, curveSegments: 28 });
    hgGeo.translate(0, 0, -0.005);
    var hwCol = woodCol.clone(); hwCol.needsUpdate = true; hwCol.wrapS = hwCol.wrapT = THREE.RepeatWrapping; hwCol.repeat.set(6, 2); hwCol.rotation = Math.PI / 2;
    var hwBmp = woodBmp.clone(); hwBmp.needsUpdate = true; hwBmp.wrapS = hwBmp.wrapT = THREE.RepeatWrapping; hwBmp.repeat.copy(hwCol.repeat); hwBmp.rotation = hwCol.rotation;
    var hangerMat = new THREE.MeshPhysicalMaterial({ map: hwCol, bumpMap: hwBmp, bumpScale: 0.6, color: 0xf6e6cf, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.9 });
    var hangerBody = shadowed(new THREE.Mesh(hgGeo, hangerMat), true, true); hangerGroup.add(hangerBody);
    var hp = [new THREE.Vector3(0, -0.080, 0), new THREE.Vector3(0, -0.058, 0), new THREE.Vector3(-0.003, -0.040, 0), new THREE.Vector3(-0.011, -0.025, 0)];
    var hookR = 0.0125, hcY = -0.0125;
    for (var ai = 0; ai <= 10; ai++) { var an = Math.PI - (ai / 10) * (Math.PI + 0.55); hp.push(new THREE.Vector3(Math.cos(an) * hookR, hcY + Math.sin(an) * hookR, 0)); }
    var hookGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 64, 0.0018, 8, false);
    var chrome = new THREE.MeshStandardMaterial({ color: 0xd8d8d6, metalness: 1, roughness: 0.22, envMapIntensity: 1.1 });
    hangerGroup.add(shadowed(new THREE.Mesh(hookGeo, chrome), true, true));
    var tip = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 10, 8), chrome); tip.position.copy(hp[hp.length - 1]); hangerGroup.add(tip);
    var ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0048, 0.01, 16), chrome); ferrule.position.set(0, -0.074, 0); hangerGroup.add(ferrule);
    var hsw = { th: 0, w: 0, ph: 0, pw: 0 };
    var hanger = {
      group: hangerGroup,
      pivot: new THREE.Vector3(H.x, H.y, H.z),
      collarAnchor: new THREE.Vector3(H.x, H.y - 0.09, H.z + 0.035),
      localAnchor: new THREE.Vector3(0, -0.09, 0.035), // hanger.group 内の座標（ゆれに追従させたい時）
      swing: function (impulse) { hsw.w += (impulse == null ? 1 : impulse); hsw.pw += 0.25 * (impulse == null ? 1 : impulse); }
    };

    // ---------- 照明 ----------
    var sunPos = new THREE.Vector3(L.sun[0], L.sun[1], L.sun[2]);
    var sunDir = sunPos.clone().normalize();
    var hemi = new THREE.HemisphereLight(0xfff2de, 0xb4936e, 0.55);
    group.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff0d8, 1.85);
    sun.position.copy(sunDir).multiplyScalar(6); sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    var sm = low ? 1024 : 2048; sun.shadow.mapSize.set(sm, sm);
    (function fitShadow() {
      var cam = new THREE.OrthographicCamera(); cam.position.copy(sun.position); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
      var inv = cam.matrixWorldInverse, mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9, mnz = 1e9, mxz = -1e9;
      var xs = [-1.8, 1.8], ys = [0, 2.0], zs = [-1.3, 1.3];
      for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) for (var c = 0; c < 2; c++) {
        tmpV.set(xs[a], ys[b], zs[c]).applyMatrix4(inv);
        mnx = Math.min(mnx, tmpV.x); mxx = Math.max(mxx, tmpV.x); mny = Math.min(mny, tmpV.y); mxy = Math.max(mxy, tmpV.y); mnz = Math.min(mnz, -tmpV.z); mxz = Math.max(mxz, -tmpV.z);
      }
      var sc = sun.shadow.camera;
      sc.left = mnx - 0.05; sc.right = mxx + 0.05; sc.bottom = mny - 0.05; sc.top = mxy + 0.05; sc.near = Math.max(0.1, mnz - 0.5); sc.far = mxz + 0.5;
      sc.updateProjectionMatrix();
    })();
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.012; sun.shadow.radius = 5; sun.shadow.blurSamples = 12;
    group.add(sun, sun.target);
    // 反対側からのやわらかい照り返し（影なし）
    var fill = new THREE.DirectionalLight(0xe8eef6, 0.22);
    fill.position.set(2.2, 1.6, 1.8); group.add(fill, fill.target);
    // 窓の光だまり（窓枠の形の cookie を投影するスポット）
    var patchTarget = new THREE.Vector3(0.62, 0, -0.98);
    var patch = new THREE.SpotLight(0xffe8c2, 2.2, 0, 0.09, 0.0, 0);
    patch.position.copy(patchTarget).addScaledVector(sunDir, 7);
    patch.target.position.copy(patchTarget);
    patch.map = makeWindowCookie();
    patch.castShadow = true; var pmz = low ? 512 : 1024; patch.shadow.mapSize.set(pmz, pmz);
    patch.shadow.bias = -0.0004; patch.shadow.normalBias = 0.01; patch.shadow.camera.near = 4; patch.shadow.camera.far = 9; patch.shadow.radius = 4;
    group.add(patch, patch.target);
    // いま触る物への光（影なし）
    var focus = new THREE.SpotLight(0xfff2e0, 0, 0, 0.4, 1.0, 0);
    group.add(focus, focus.target);
    // ドアから入る廊下の光
    var spill = new THREE.SpotLight(0xffe2b8, 0, 5, 0.75, 1.0, 1.6);
    spill.position.set(D.x - 0.1, 1.85, wallZ - 0.5); spill.target.position.set(D.x - 0.5, 0, wallZ + 1.6);
    group.add(spill, spill.target);

    var MOOD = {
      morning: { hemiSky: new THREE.Color(0xfff2de), hemiGnd: new THREE.Color(0xb4936e), hemiI: 0.55, sunC: new THREE.Color(0xfff0d8), sunI: 1.85, patchC: new THREE.Color(0xffe8c2), patchI: 2.2, fillI: 0.22 },
      warm: { hemiSky: new THREE.Color(0xffe8c8), hemiGnd: new THREE.Color(0xc0946a), hemiI: 0.66, sunC: new THREE.Color(0xffdcb0), sunI: 2.05, patchC: new THREE.Color(0xffd6a4), patchI: 2.5, fillI: 0.26 }
    };
    var st = {
      mood: 0, moodTarget: 0, focusAmt: 0, focusOn: false, fpos: new THREE.Vector3(), ftarget: new THREE.Vector3(),
      frad: 0.3, fradT: 0.3, door: 0
    };
    var cA = new THREE.Color(), cB = new THREE.Color();

    function setDoor(o) {
      st.door = G.clamp(o || 0, 0, 1);
      doorPivot.rotation.y = -G.easeInOut(st.door) * 1.48;
      spill.intensity = 3.2 * G.smooth(0.05, 0.7, st.door);
    }
    function focusOn(v, radius) {
      if (!v) { st.focusOn = false; return; }
      if (!st.focusOn && st.focusAmt < 0.05) st.fpos.copy(v);
      st.ftarget.copy(v); st.fradT = radius || 0.3;
      if (st.focusAmt < 0.05) st.frad = st.fradT;
      st.focusOn = true;
    }
    function setMood(name) { st.moodTarget = name === 'warm' ? 1 : 0; }
    function basketWobble() { bw.v += 2.2; bw.phi = Math.random() * Math.PI * 2; }

    function update(dt, t) {
      dt = Math.min(dt || 0.016, 0.05);
      // 照明
      st.mood = G.damp(st.mood, st.moodTarget, 1.2, dt);
      st.focusAmt = G.damp(st.focusAmt, st.focusOn ? 1 : 0, 4, dt);
      st.fpos.x = G.damp(st.fpos.x, st.ftarget.x, 5, dt); st.fpos.y = G.damp(st.fpos.y, st.ftarget.y, 5, dt); st.fpos.z = G.damp(st.fpos.z, st.ftarget.z, 5, dt);
      st.frad = G.damp(st.frad, st.fradT, 5, dt);
      var m = st.mood, a = MOOD.morning, b = MOOD.warm, dim = 1 - 0.26 * st.focusAmt;
      hemi.color.lerpColors(a.hemiSky, b.hemiSky, m); hemi.groundColor.lerpColors(a.hemiGnd, b.hemiGnd, m);
      hemi.intensity = G.lerp(a.hemiI, b.hemiI, m) * dim;
      sun.color.lerpColors(a.sunC, b.sunC, m); sun.intensity = G.lerp(a.sunI, b.sunI, m) * dim;
      patch.color.lerpColors(a.patchC, b.patchC, m); patch.intensity = G.lerp(a.patchI, b.patchI, m) * dim;
      fill.intensity = G.lerp(a.fillI, b.fillI, m) * dim;
      var fh = 2.3;
      focus.position.set(st.fpos.x + 0.12, st.fpos.y + fh, st.fpos.z + 0.45);
      focus.target.position.copy(st.fpos);
      focus.angle = G.clamp(Math.atan(st.frad * 2.0 / fh), 0.08, 0.9);
      focus.intensity = 2.5 * st.focusAmt;
      // かごのゆれ（ばね）
      if (bw.a !== 0 || bw.v !== 0) {
        bw.v += (-160 * bw.a - 7 * bw.v) * dt; bw.a += bw.v * dt;
        if (Math.abs(bw.a) < 1e-4 && Math.abs(bw.v) < 1e-3) { bw.a = 0; bw.v = 0; }
        var aa = G.clamp(bw.a, -0.25, 0.25);
        basketTilt.rotation.x = aa * Math.cos(bw.phi); basketTilt.rotation.z = aa * Math.sin(bw.phi);
        basketTilt.position.y = Math.abs(Math.sin(aa)) * B.r * 0.9;
      }
      // ハンガーのゆれ（減衰振り子）
      if (hsw.th !== 0 || hsw.w !== 0 || hsw.ph !== 0 || hsw.pw !== 0) {
        hsw.w += (-20 * Math.sin(hsw.th) - 1.3 * hsw.w) * dt; hsw.th += hsw.w * dt;
        hsw.pw += (-30 * hsw.ph - 3 * hsw.pw) * dt; hsw.ph += hsw.pw * dt;
        hsw.th = G.clamp(hsw.th, -0.6, 0.6);
        if (Math.abs(hsw.th) < 1e-4 && Math.abs(hsw.w) < 1e-3 && Math.abs(hsw.ph) < 1e-4 && Math.abs(hsw.pw) < 1e-3) { hsw.th = hsw.w = hsw.ph = hsw.pw = 0; }
        hangerGroup.rotation.z = hsw.th;
        hangerGroup.rotation.x = G.clamp(-Math.abs(hsw.ph), -0.2, 0); // 下端は手前へだけ振れる（壁側へ倒れない）
      }
    }
    setDoor(0);
    update(0.016, 0);

    return {
      group: group, update: update,
      floor: floor, mat: matMesh, basket: basket, wall: wall, door: doorPivot,
      basketMouth: basketMouth, basketWobble: basketWobble,
      hanger: hanger, setDoor: setDoor, focusOn: focusOn, setMood: setMood,
      lights: { hemi: hemi, sun: sun, fill: fill, patch: patch, focus: focus, spill: spill },
      colliders: [{ x: L.stand.x, z: L.stand.z, r: 0.17 }, { x: B.x, z: B.z, r: B.r + 0.02 }]
    };
  };
})();

/* shirt.js */
/* shirt.js — 主役のシャツ（しわ・アイロンで消える仕組み・形の変化）
   G.createShirt(ctx) / G.makeFabricMaterial(opts)
   方式: 平置きレイアウト上の格子メッシュ 1 枚 + シルエットのアルファ。
   頂点シェーダで「山 / 平置き / 持ち上げ / つるし」の姿を関数として計算し、2 つの姿の間をなめらかに混ぜる。
   しわは手続きの高さ場（勾配も焼き込み）× CPU のしわ量マスク（128²、変化した時だけ転送）。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};

  // ---- レイアウト（平置きのローカル座標 = メートル。えり -Z、すそ +Z） ----
  var X0 = -0.5, Z0 = -0.44, LW = 1.0, LD = 0.88;
  var ZC = -0.372;                         // えり中心（持ち上げ・つるしの基準点）
  var SA = [0.265, -0.26], SB = [0.43, 0.215]; // 右そでの軸（肩側 → カフス先）
  var SL = Math.sqrt((SB[0] - SA[0]) * (SB[0] - SA[0]) + (SB[1] - SA[1]) * (SB[1] - SA[1]));
  var SD = [(SB[0] - SA[0]) / SL, (SB[1] - SA[1]) / SL];
  var SN = [SD[1], -SD[0]];                // 外向きの法線
  var POCKET = { x0: 0.055, x1: 0.165, z0: -0.15, z1: -0.03 };
  var BULGE_C = [0.11, -0.082];
  var REG = ['collar', 'sleeveL', 'sleeveR', 'bodyL', 'bodyR'];
  var ST_HEAP = 0, ST_FLAT = 1, ST_LIFT = 2, ST_HUNG = 3;
  var MASK_N = 128;
  var DONE_AT = 0.78;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hw(a) { return lerp(0.075, 0.05, clamp(a / SL, 0, 1)); }
  function sPt(side, a, off) {
    var w = hw(a);
    return [side * (SA[0] + a * SD[0] + off * w * SN[0]), SA[1] + a * SD[1] + off * w * SN[1]];
  }
  function shoulderTop(ax) { return ax < 0.086 ? -0.392 : -0.392 + (ax - 0.086) / (0.249 - 0.086) * 0.055; }

  // ---- 色の小道具 ----
  function rgbOf(hex) { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; }
  function css(c, f, a) {
    f = f === undefined ? 1 : f;
    var r = Math.round(clamp(c[0] * f, 0, 255)), g = Math.round(clamp(c[1] * f, 0, 255)), b = Math.round(clamp(c[2] * f, 0, 255));
    return a === undefined ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function mixc(c, d, t) { return [lerp(c[0], d[0], t), lerp(c[1], d[1], t), lerp(c[2], d[2], t)]; }

  // ---- シャツの形（Path2D、メートル座標） ----
  var _paths = null;
  function paths() {
    if (_paths) return _paths;
    var P = {};
    var b = new Path2D();
    b.moveTo(0.086, -0.392); b.lineTo(0.249, -0.337); b.lineTo(0.252, 0.305);
    b.bezierCurveTo(0.252, 0.362, 0.17, 0.399, 0, 0.405);
    b.bezierCurveTo(-0.17, 0.399, -0.252, 0.362, -0.252, 0.305);
    b.lineTo(-0.249, -0.337); b.lineTo(-0.086, -0.392); b.closePath();
    P.body = b;
    function sleeve(s) {
      var p = new Path2D(), o0 = sPt(s, 0.025, 1), o1 = sPt(s, SL, 1), i1 = sPt(s, SL, -1), i0 = sPt(s, 0.035, -1);
      p.moveTo(s * 0.247, -0.338);
      p.quadraticCurveTo(s * 0.305, -0.322, o0[0], o0[1]);
      p.lineTo(o1[0], o1[1]); p.lineTo(i1[0], i1[1]); p.lineTo(i0[0], i0[1]);
      p.quadraticCurveTo(s * 0.198, -0.285, s * 0.247, -0.338); p.closePath();
      return p;
    }
    P.sleeveL = sleeve(-1); P.sleeveR = sleeve(1);
    function cuff(s) {
      var p = new Path2D(), a = SL - 0.06, q = [sPt(s, a, 1.04), sPt(s, SL, 1.04), sPt(s, SL, -1.04), sPt(s, a, -1.04)];
      p.moveTo(q[0][0], q[0][1]); p.lineTo(q[1][0], q[1][1]); p.lineTo(q[2][0], q[2][1]); p.lineTo(q[3][0], q[3][1]); p.closePath();
      return p;
    }
    P.cuffL = cuff(-1); P.cuffR = cuff(1);
    var c = new Path2D();
    c.moveTo(0, -0.406);
    c.bezierCurveTo(0.05, -0.407, 0.092, -0.401, 0.106, -0.383);
    c.bezierCurveTo(0.114, -0.37, 0.09, -0.31, 0.066, -0.284);
    c.lineTo(0.052, -0.287);
    c.bezierCurveTo(0.035, -0.3, 0.016, -0.322, 0.004, -0.344);
    c.lineTo(-0.004, -0.344);
    c.bezierCurveTo(-0.016, -0.322, -0.035, -0.3, -0.052, -0.287);
    c.lineTo(-0.066, -0.284);
    c.bezierCurveTo(-0.09, -0.31, -0.114, -0.37, -0.106, -0.383);
    c.bezierCurveTo(-0.092, -0.401, -0.05, -0.407, 0, -0.406);
    c.closePath();
    P.collar = c;
    var n = new Path2D(); n.ellipse(0, -0.367, 0.056, 0.016, 0, 0, Math.PI * 2); P.neck = n;
    var pk = new Path2D();
    pk.moveTo(POCKET.x0, POCKET.z0); pk.lineTo(POCKET.x1, POCKET.z0); pk.lineTo(POCKET.x1, POCKET.z1 - 0.012);
    pk.lineTo(0.11, POCKET.z1 + 0.002); pk.lineTo(POCKET.x0, POCKET.z1 - 0.012); pk.closePath();
    P.pocket = pk;
    var pl = new Path2D(); pl.rect(-0.015, -0.345, 0.03, 0.75); P.placket = pl;
    var yk = new Path2D();
    yk.moveTo(-0.26, -0.45); yk.lineTo(0.26, -0.45); yk.lineTo(0.26, shoulderTop(0.25) + 0.05);
    yk.lineTo(0.086, shoulderTop(0.086) + 0.05); yk.lineTo(-0.086, shoulderTop(0.086) + 0.05); yk.lineTo(-0.26, shoulderTop(0.25) + 0.05); yk.closePath();
    P.yokeArea = yk;
    _paths = P;
    return P;
  }
  function setM(g, cv) { g.setTransform(cv.width / LW, 0, 0, cv.height / LD, -X0 * cv.width / LW, -Z0 * cv.height / LD); }
  function silhouette(g) { var P = paths(); g.fill(P.body); g.fill(P.sleeveL); g.fill(P.sleeveR); g.fill(P.collar); }
  function buttonPos() { var a = []; for (var i = 0; i < 7; i++) a.push(-0.322 + i * 0.1); return a; }

  // 内側に一定距離ずらしたステッチ（太い破線を描き、内側を消して細い線だけ残す）
  function stitchInset(g, layer, path, inset, color, width, dash) {
    var L = layer.getContext('2d');
    L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, layer.width, layer.height);
    setM(L, layer);
    L.save(); L.clip(path);
    L.setLineDash(dash || [0.0026, 0.0013]);
    L.lineWidth = 2 * inset + width; L.strokeStyle = color; L.stroke(path);
    L.setLineDash([]);
    L.globalCompositeOperation = 'destination-out';
    L.lineWidth = Math.max(0.0001, 2 * inset - width); L.stroke(path);
    L.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layer, 0, 0); g.restore();
  }
  function dashLine(g, pts, color, width, dash) {
    g.save(); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.setLineDash(dash || [0.0026, 0.0013]); g.strokeStyle = color; g.lineWidth = width; g.stroke(); g.restore();
  }

  // ---- 色テクスチャ（アルファ = シルエット） ----
  var _speck = null;
  function speckCanvas() {
    if (_speck) return _speck;
    var c = G.makeCanvas(256, 256), g = c.getContext('2d'), im = g.createImageData(256, 256), R = G.rng(77);
    var row = new Float32Array(256);
    for (var y = 0; y < 256; y++) {
      for (var x = 0; x < 256; x++) row[x] = R();
      for (x = 0; x < 256; x++) {
        var slub = G.noise2(x * 0.05, y * 0.9, 3) * 0.6 + row[x] * 0.4;
        var v = 232 + slub * 23 - (((x + y) & 3) === 0 ? 6 : 0);
        var k = (y * 256 + x) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0); _speck = c; return c;
  }

  function drawColor(cv, layer, hex) {
    var g = cv.getContext('2d'), P = paths(), k = cv.width / 2048;
    var base = rgbOf(hex);
    var lum = (base[0] * 0.3 + base[1] * 0.59 + base[2] * 0.11) / 255;
    var thread = css(mixc(base, [250, 250, 248], 0.55), lum > 0.9 ? 0.93 : 1.02);
    var threadD = css(base, 0.72, 0.55);
    var seam = css(base, 0.8, 0.55);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    setM(g, cv);
    // 身ごろ
    g.fillStyle = css(base); g.fill(P.body);
    g.save(); g.clip(P.body);
    // 前立ての重なりの陰と折り山
    g.fillStyle = css(base, 0.985); g.fillRect(-0.015, -0.345, 0.03, 0.76);
    g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 5 * k; g.shadowOffsetX = 2 * k;
    g.fillStyle = css(base); g.fillRect(-0.0152, -0.345, 0.0304, 0.76);
    g.shadowColor = 'transparent';
    g.fillStyle = css(base, 1.035); g.fillRect(-0.0148, -0.345, 0.0012, 0.76);
    dashLine(g, [[-0.0125, -0.34], [-0.0125, 0.402]], thread, 0.0007);
    dashLine(g, [[0.0125, -0.34], [0.0125, 0.402]], thread, 0.0007);
    // 前ヨークの切り替え
    var yl = [[-0.249, shoulderTop(0.249) + 0.05], [-0.086, shoulderTop(0.086) + 0.05], [0.086, shoulderTop(0.086) + 0.05], [0.249, shoulderTop(0.249) + 0.05]];
    g.beginPath(); g.moveTo(yl[0][0], yl[0][1]); g.lineTo(yl[1][0], yl[1][1]); g.lineTo(yl[2][0], yl[2][1]); g.lineTo(yl[3][0], yl[3][1]);
    g.strokeStyle = seam; g.lineWidth = 0.0011; g.stroke();
    dashLine(g, [[yl[0][0], yl[0][1] + 0.004], [yl[1][0], yl[1][1] + 0.004], [yl[2][0], yl[2][1] + 0.004], [yl[3][0], yl[3][1] + 0.004]], thread, 0.0007);
    // ポケット（厚みの陰 → 布 → 口の折り返し）
    g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 4 * k; g.shadowOffsetX = 2.5 * k; g.shadowOffsetY = 2 * k;
    g.fillStyle = css(base); g.fill(P.pocket); g.restore();
    g.save(); g.clip(P.pocket);
    var pg = g.createLinearGradient(0, POCKET.z0, 0, POCKET.z1); pg.addColorStop(0, css(base, 0.96)); pg.addColorStop(0.2, css(base, 1.0)); pg.addColorStop(1, css(base, 0.985));
    g.fillStyle = pg; g.fillRect(POCKET.x0, POCKET.z0, 0.12, 0.13);
    g.fillStyle = css(base, 0.9, 0.6); g.fillRect(POCKET.x0, POCKET.z0, 0.11, 0.0016);
    g.fillStyle = css(base, 0.93); g.fillRect(POCKET.x0, POCKET.z0 + 0.022, 0.11, 0.001);
    g.restore();
    dashLine(g, [[POCKET.x0 + 0.002, POCKET.z0 + 0.019], [POCKET.x1 - 0.002, POCKET.z0 + 0.019]], thread, 0.0007);
    stitchInset(g, layer, P.pocket, 0.0028, thread, 0.0007);
    // 身ごろの縁のステッチ（すそ・脇）
    g.restore();
    stitchInset(g, layer, P.body, 0.006, thread, 0.0007);
    g.save(); g.clip(P.body); g.strokeStyle = css(base, 0.85, 0.5); g.lineWidth = 0.004; g.stroke(P.body); g.restore();

    // そで（身ごろに落ちる陰 → 布 → カフス）
    [['sleeveL', 'cuffL', -1], ['sleeveR', 'cuffR', 1]].forEach(function (it) {
      var sp = P[it[0]], cp = P[it[1]], s = it[2];
      g.save(); g.shadowColor = 'rgba(0,0,0,0.42)'; g.shadowBlur = 9 * k; g.shadowOffsetX = 4 * k; g.shadowOffsetY = 3 * k;
      g.fillStyle = css(base); g.fill(sp); g.restore();
      g.save(); g.clip(sp);
      // そで山の付け根に少しの陰影
      var a0 = sPt(s, 0, 0), a1 = sPt(s, SL, 0);
      var lg = g.createLinearGradient(a0[0], a0[1], a1[0], a1[1]);
      lg.addColorStop(0, css(base, 0.94)); lg.addColorStop(0.15, css(base, 1.0)); lg.addColorStop(1, css(base, 0.99));
      g.fillStyle = lg; g.fill(sp);
      g.strokeStyle = css(base, 0.84, 0.55); g.lineWidth = 0.004; g.stroke(sp);
      // 剣ボロ（カフス上の短い前立て）
      var q0 = sPt(s, SL - 0.06, 0.55), q1 = sPt(s, SL - 0.15, 0.55);
      g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.strokeStyle = css(base, 0.8, 0.55); g.lineWidth = 0.0012; g.stroke();
      var r0 = sPt(s, SL - 0.06, 0.72), r1 = sPt(s, SL - 0.14, 0.72);
      dashLine(g, [r0, r1], thread, 0.0006);
      // カフスへのタック（ひだ）
      for (var t = -1; t <= 1; t += 2) {
        var u0 = sPt(s, SL - 0.06, t * 0.3), u1 = sPt(s, SL - 0.1, t * 0.36);
        g.beginPath(); g.moveTo(u0[0], u0[1]); g.lineTo(u1[0], u1[1]); g.strokeStyle = css(base, 0.86, 0.5); g.lineWidth = 0.0016; g.stroke();
      }
      g.restore();
      // カフス
      g.save(); g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 3 * k; g.shadowOffsetY = -1.5 * k;
      g.fillStyle = css(base, 1.01); g.fill(cp); g.restore();
      stitchInset(g, layer, cp, 0.0045, thread, 0.0007);
      g.save(); g.clip(cp); g.strokeStyle = css(base, 0.82, 0.5); g.lineWidth = 0.0025; g.stroke(cp); g.restore();
    });
    stitchInset(g, layer, P.sleeveL, 0.005, thread, 0.0006);
    stitchInset(g, layer, P.sleeveR, 0.005, thread, 0.0006);

    // えり（身ごろに落ちる陰 → 布 → 首の内側 → ステッチ）
    g.save(); g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 8 * k; g.shadowOffsetX = 3 * k; g.shadowOffsetY = 3 * k;
    g.fillStyle = css(base); g.fill(P.collar); g.restore();
    g.save(); g.clip(P.collar);
    // 台えり（えりの V の奥に見える部分）
    g.fillStyle = css(base, 0.93); g.beginPath(); g.moveTo(-0.03, -0.355); g.lineTo(0.03, -0.355); g.lineTo(0.0, -0.33); g.closePath(); g.fill();
    // 首の内側（後ろの台えりの裏）
    var ng = g.createLinearGradient(0, -0.383, 0, -0.351);
    ng.addColorStop(0, css(base, 0.7)); ng.addColorStop(0.5, css(base, 0.84)); ng.addColorStop(1, css(base, 0.95));
    g.save(); g.clip(P.neck); g.fillStyle = ng; g.fillRect(-0.06, -0.39, 0.12, 0.05);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.0035; g.stroke(P.neck); g.restore();
    g.strokeStyle = css(base, 1.06); g.lineWidth = 0.0012; g.beginPath(); g.ellipse(0, -0.367, 0.057, 0.0168, 0, 0.15, Math.PI - 0.15); g.stroke();
    dashLine(g, [[-0.05, -0.373], [-0.02, -0.379], [0.02, -0.379], [0.05, -0.373]], threadD, 0.0006);
    g.strokeStyle = css(base, 0.84, 0.6); g.lineWidth = 0.0022; g.stroke(P.collar);
    g.restore();
    stitchInset(g, layer, P.collar, 0.0055, thread, 0.0007);
    // 羽根の折り山（光る線）
    g.save(); g.clip(P.collar);
    g.strokeStyle = css(base, 1.06, 0.8); g.lineWidth = 0.0014;
    g.beginPath(); g.moveTo(0.058, -0.371); g.bezierCurveTo(0.064, -0.355, 0.045, -0.33, 0.03, -0.31); g.stroke();
    g.beginPath(); g.moveTo(-0.058, -0.371); g.bezierCurveTo(-0.064, -0.355, -0.045, -0.33, -0.03, -0.31); g.stroke();
    g.restore();

    // ボタン（白い貝ボタン）
    var bp = buttonPos();
    for (var i = 0; i < bp.length; i++) drawButton(g, 0, bp[i], 0.0068, k, base);
    // カフスのボタン
    drawButton(g, sPt(-1, SL - 0.03, 0.62)[0], sPt(-1, SL - 0.03, 0.62)[1], 0.0058, k, base);
    drawButton(g, sPt(1, SL - 0.03, 0.62)[0], sPt(1, SL - 0.03, 0.62)[1], 0.0058, k, base);
    drawButton(g, sPt(-1, SL - 0.11, 0.62)[0], sPt(-1, SL - 0.11, 0.62)[1], 0.0045, k, base);
    drawButton(g, sPt(1, SL - 0.11, 0.62)[0], sPt(1, SL - 0.11, 0.62)[1], 0.0045, k, base);

    // 織りのむら（シルエットの上だけ）
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply';
    g.fillStyle = g.createPattern(speckCanvas(), 'repeat'); g.globalAlpha = 0.55; g.fillRect(0, 0, cv.width, cv.height);
    var L = layer.getContext('2d'); L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, layer.width, layer.height);
    setM(L, layer); L.fillStyle = '#fff'; silhouette(L);
    g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.drawImage(layer, 0, 0);
    g.restore();
  }
  function drawButton(g, x, z, r, k, base) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.38)'; g.shadowBlur = 3 * k; g.shadowOffsetX = 1.6 * k; g.shadowOffsetY = 1.6 * k;
    g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fillStyle = '#e8e4dc'; g.fill();
    g.restore();
    var gr = g.createRadialGradient(x - r * 0.35, z - r * 0.4, r * 0.05, x, z, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#f5f1ea'); gr.addColorStop(0.8, '#e2ddd4'); gr.addColorStop(1, '#c4beb3');
    g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
    // 貝の虹色をほんの少し
    var ir = g.createLinearGradient(x - r, z - r, x + r, z + r);
    ir.addColorStop(0, 'rgba(255,220,235,0.18)'); ir.addColorStop(0.5, 'rgba(220,240,255,0.16)'); ir.addColorStop(1, 'rgba(240,255,225,0.14)');
    g.fillStyle = ir; g.fill();
    g.beginPath(); g.arc(x, z, r * 0.7, 0, Math.PI * 2); g.strokeStyle = 'rgba(90,80,70,0.22)'; g.lineWidth = r * 0.12; g.stroke();
    g.beginPath(); g.arc(x - r * 0.05, z - r * 0.06, r * 0.66, Math.PI * 1.05, Math.PI * 1.65); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = r * 0.08; g.stroke();
    var hs = r * 0.27;
    g.strokeStyle = css(mixc(base, [235, 235, 230], 0.4), 0.95); g.lineWidth = r * 0.12;
    g.beginPath(); g.moveTo(x - hs, z - hs); g.lineTo(x + hs, z + hs); g.moveTo(x + hs, z - hs); g.lineTo(x - hs, z + hs); g.stroke();
    g.fillStyle = 'rgba(60,55,50,0.6)';
    for (var i = 0; i < 4; i++) { var a = Math.PI / 4 + i * Math.PI / 2; g.beginPath(); g.arc(x + Math.cos(a) * hs * 1.41, z + Math.sin(a) * hs * 1.41, r * 0.1, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.arc(x - r * 0.38, z - r * 0.42, r * 0.16, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.95)'; g.fill();
  }

  // ---- 細部テクスチャ（R=細部の高さ, G=えりの立体場, B=縁からの距離） ----
  function buildDetail(w, h) {
    var P = paths();
    var cR = G.makeCanvas(w, h), cG = G.makeCanvas(w, h), cB = G.makeCanvas(w, h), cS = G.makeCanvas(w, h), layer = G.makeCanvas(w, h);
    var k = w / 1024, sx = w / LW;
    // R: 細部の高さ
    var g = cR.getContext('2d');
    g.fillStyle = 'rgb(70,70,70)'; g.fillRect(0, 0, w, h);
    setM(g, cR);
    g.save(); g.clip(P.body); g.strokeStyle = 'rgb(92,92,92)'; g.lineWidth = 0.008; g.stroke(P.body); g.restore();
    g.fillStyle = 'rgb(96,96,96)'; g.fillRect(-0.015, -0.345, 0.03, 0.75);
    g.fillStyle = 'rgb(84,84,84)'; g.fillRect(-0.0152, -0.345, 0.0014, 0.75);
    g.fillStyle = 'rgb(100,100,100)'; g.fill(P.pocket);
    g.fillStyle = 'rgb(112,112,112)'; g.fillRect(POCKET.x0, POCKET.z0, 0.11, 0.02);
    ['sleeveL', 'sleeveR'].forEach(function (n) {
      g.fillStyle = 'rgb(92,92,92)'; g.fill(P[n]);
      g.save(); g.clip(P[n]); g.fillStyle = 'rgb(74,74,74)'; g.lineWidth = 0.006; g.strokeStyle = 'rgb(104,104,104)'; g.stroke(P[n]); g.restore();
    });
    g.fillStyle = 'rgb(108,108,108)'; g.fill(P.cuffL); g.fill(P.cuffR);
    g.fillStyle = 'rgb(100,100,100)'; g.fill(P.collar);
    g.save(); g.clip(P.collar); g.strokeStyle = 'rgb(112,112,112)'; g.lineWidth = 0.007; g.stroke(P.collar); g.restore();
    g.fillStyle = 'rgb(76,76,76)'; g.fill(P.neck);
    var dk = 'rgb(46,46,46)';
    stitchInset(g, layer, P.collar, 0.0055, dk, 0.0008);
    stitchInset(g, layer, P.cuffL, 0.0045, dk, 0.0008); stitchInset(g, layer, P.cuffR, 0.0045, dk, 0.0008);
    stitchInset(g, layer, P.pocket, 0.0028, dk, 0.0008);
    stitchInset(g, layer, P.body, 0.006, dk, 0.0008);
    dashLine(g, [[-0.0125, -0.34], [-0.0125, 0.402]], dk, 0.0008);
    dashLine(g, [[0.0125, -0.34], [0.0125, 0.402]], dk, 0.0008);
    var bp = buttonPos();
    function btn(x, z, r) {
      var gr = g.createRadialGradient(x, z, 0, x, z, r);
      gr.addColorStop(0, 'rgb(235,235,235)'); gr.addColorStop(0.55, 'rgb(215,215,215)'); gr.addColorStop(0.85, 'rgb(190,190,190)'); gr.addColorStop(1, 'rgb(120,120,120)');
      g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
    }
    for (var i = 0; i < bp.length; i++) btn(0, bp[i], 0.0068);
    [-1, 1].forEach(function (s) { var q = sPt(s, SL - 0.03, 0.62); btn(q[0], q[1], 0.0058); q = sPt(s, SL - 0.11, 0.62); btn(q[0], q[1], 0.0045); });
    // G: えりの立体場（外 0..0.5 は陰の広がり、内 0.5..1 は高さ）
    g = cG.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h); setM(g, cG);
    g.save(); g.shadowColor = 'rgb(127,127,127)'; g.shadowBlur = 0.012 * sx; g.fillStyle = 'rgb(150,150,150)'; g.fill(P.collar); g.restore();
    g.fillStyle = 'rgb(150,150,150)'; g.fill(P.collar);
    g.save(); g.clip(P.collar);
    g.shadowColor = 'rgb(255,255,255)'; g.shadowBlur = 0.012 * sx;
    g.strokeStyle = 'rgb(255,255,255)'; g.lineWidth = 0.014; g.stroke(P.neck);
    g.shadowBlur = 0; g.fillStyle = 'rgb(225,225,225)'; g.fill(P.neck);
    g.restore();
    // B: 縁からの距離（縁 1 → 内側 2cm で 0）
    var s2 = cS.getContext('2d'); setM(s2, cS); s2.fillStyle = '#fff'; silhouette(s2);
    var fr = G.makeCanvas(w, h), f2 = fr.getContext('2d');
    f2.fillStyle = '#fff'; f2.fillRect(0, 0, w, h); f2.globalCompositeOperation = 'destination-out'; f2.drawImage(cS, 0, 0);
    g = cB.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.shadowColor = '#fff'; g.shadowBlur = 0.014 * sx; g.drawImage(fr, 0, 0); g.drawImage(fr, 0, 0);
    var dR = cR.getContext('2d').getImageData(0, 0, w, h).data, dG = cG.getContext('2d').getImageData(0, 0, w, h).data, dB = cB.getContext('2d').getImageData(0, 0, w, h).data;
    var out = new Uint8Array(w * h * 4);
    for (var p = 0; p < w * h * 4; p += 4) { out[p] = dR[p]; out[p + 1] = dG[p]; out[p + 2] = dB[p]; out[p + 3] = 255; }
    var tex = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return { tex: tex, sil: cS };
  }

  // ---- しわの高さ場（R=高さ, G,B=勾配）----
  function genWrinkles(N, seed, data) {
    var R = G.rng(seed), H = new Float32Array(N * N), px = LW / N, pz = LD / N, i, j, x, z;
    var a0 = R() * Math.PI, ca = Math.cos(a0), sa = Math.sin(a0), so = seed % 97;
    for (j = 0; j < N; j++) {
      z = j * pz;
      for (i = 0; i < N; i++) {
        x = i * px;
        var u = x * ca + z * sa, v = -x * sa + z * ca;
        var broad = G.fbm2(u * 4.5, v * 11, 3, so) - 0.5;
        var mid = G.noise2(u * 18 + 3, v * 40, so + 5) - 0.5;
        var fine = 0.5 - Math.abs(G.noise2(x * 70, z * 52, so + 9) - 0.5);
        H[j * N + i] = broad * 0.3 + mid * 0.16 + fine * 0.14;
      }
    }
    function line(cx, cz, ang, len, w, amp, bend, radial) {
      var dx = Math.cos(ang), dz = Math.sin(ang), ext = len * 0.5 + w * 5 + Math.abs(bend);
      var ox = radial ? cx + dx * len * 0.5 : cx, oz = radial ? cz + dz * len * 0.5 : cz;
      var i0 = Math.max(0, Math.floor((ox - ext) / px)), i1 = Math.min(N - 1, Math.ceil((ox + ext) / px));
      var j0 = Math.max(0, Math.floor((oz - ext) / pz)), j1 = Math.min(N - 1, Math.ceil((oz + ext) / pz));
      var hl = len * 0.5;
      for (var jj = j0; jj <= j1; jj++) {
        for (var ii = i0; ii <= i1; ii++) {
          var qx = ii * px - ox, qz = jj * pz - oz;
          var s = qx * dx + qz * dz; if (s < -hl || s > hl) continue;
          var sn = s / hl, t = -qx * dz + qz * dx - bend * (1 - sn * sn);
          var tw = w * (radial ? (0.6 + 0.4 * (1 - (sn + 1) * 0.5)) : 1);
          var at = Math.abs(t); if (at > tw * 6) continue;
          var taper = radial ? Math.pow(1 - (sn + 1) * 0.5, 0.8) : Math.pow(1 - sn * sn, 0.65);
          H[jj * N + ii] += amp * taper * (0.55 * Math.exp(-at / tw) + 0.45 * Math.exp(-at * at / (tw * tw * 9)));
        }
      }
    }
    var n, c;
    var diag = R() < 0.5 ? 0.6 : -0.6;
    for (n = 0; n < 44; n++) {
      var ang = (R() < 0.65 ? diag + (R() - 0.5) * 0.9 : R() * Math.PI);
      line(R() * LW, R() * LD, ang, 0.12 + R() * 0.42, 0.005 + R() * 0.012, (R() < 0.62 ? 1 : -0.8) * (0.5 + R() * 0.7), (R() - 0.5) * 0.06, false);
    }
    for (n = 0; n < 14; n++) {
      var ang2 = (R() < 0.6 ? diag + (R() - 0.5) * 1.2 : R() * Math.PI);
      line(R() * LW, R() * LD, ang2, 0.22 + R() * 0.4, 0.02 + R() * 0.025, (R() < 0.6 ? 1 : -0.8) * (1.0 + R() * 0.7), (R() - 0.5) * 0.1, false);
    }
    for (c = 0; c < 8; c++) {
      var cx = 0.1 + R() * 0.8, cz = 0.1 + R() * 0.7, m = 4 + Math.floor(R() * 4), base = R() * 6.28;
      for (n = 0; n < m; n++) line(cx, cz, base + n * 6.28 / m + (R() - 0.5) * 0.7, 0.05 + R() * 0.12, 0.003 + R() * 0.005, 0.3 + R() * 0.4, (R() - 0.5) * 0.02, true);
    }
    var lo = 1e9, hi = -1e9;
    for (i = 0; i < N * N; i++) { if (H[i] < lo) lo = H[i]; if (H[i] > hi) hi = H[i]; }
    var sc = 1 / Math.max(1e-6, hi - lo);
    for (i = 0; i < N * N; i++) H[i] = (H[i] - lo) * sc;
    var AMP = 0.015, GMAX = 3.0;
    for (j = 0; j < N; j++) {
      for (i = 0; i < N; i++) {
        var iL = i > 0 ? i - 1 : i, iR = i < N - 1 ? i + 1 : i, jU = j > 0 ? j - 1 : j, jD = j < N - 1 ? j + 1 : j;
        var gx = (H[j * N + iR] - H[j * N + iL]) * AMP / ((iR - iL) * px);
        var gz = (H[jD * N + i] - H[jU * N + i]) * AMP / ((jD - jU) * pz);
        var p = (j * N + i) * 4;
        data[p] = Math.round(H[j * N + i] * 255);
        data[p + 1] = Math.round(clamp(0.5 + gx / (2 * GMAX), 0, 1) * 255);
        data[p + 2] = Math.round(clamp(0.5 + gz / (2 * GMAX), 0, 1) * 255);
        data[p + 3] = 255;
      }
    }
    // くぼみ（谷）の陰: ぼかした高さとの差
    var Bx = new Float32Array(N * N), rad = Math.max(2, Math.round(N / 60)), acc, cnt;
    for (j = 0; j < N; j++) { acc = 0; cnt = 0;
      for (i = -rad; i < N + rad; i++) {
        if (i + rad < N && i + rad >= 0) { acc += H[j * N + i + rad]; cnt++; }
        if (i - rad - 1 >= 0 && i - rad - 1 < N) { acc -= H[j * N + i - rad - 1]; cnt--; }
        if (i >= 0 && i < N) Bx[j * N + i] = acc / cnt;
      } }
    for (i = 0; i < N; i++) { acc = 0; cnt = 0;
      for (j = -rad; j < N + rad; j++) {
        if (j + rad < N && j + rad >= 0) { acc += Bx[(j + rad) * N + i]; cnt++; }
        if (j - rad - 1 >= 0 && j - rad - 1 < N) { acc -= Bx[(j - rad - 1) * N + i]; cnt--; }
        if (j >= 0 && j < N) { var cav = Math.max(0, acc / cnt - H[j * N + i]); data[(j * N + i) * 4 + 3] = Math.round(clamp(1 - cav * 9, 0, 1) * 255); }
      } }
  }

  // ---- 織り目の法線マップ（オックスフォード） ----
  var _weave = null;
  function weaveNormal() {
    if (_weave) return _weave;
    var S = 128, c = G.makeCanvas(S, S), g = c.getContext('2d'), im = g.createImageData(S, S), H = new Float32Array(S * S), p = 8, x, y;
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var tx = x / p, ty = y / (p * 0.5), cx = Math.floor(tx), cy = Math.floor(ty), fx = tx - cx, fy = ty - cy;
      var over = ((cx + (cy >> 1)) & 1) === 0;
      var wp = Math.sin(Math.PI * fx), wf = Math.sin(Math.PI * fy);
      H[y * S + x] = (over ? wp * (0.55 + 0.45 * wf) : wf * (0.55 + 0.45 * wp)) + 0.15 * G.noise2(x * 0.11, y * 0.6, 21);
    }
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var hx = H[y * S + ((x + 1) % S)] - H[y * S + ((x + S - 1) % S)], hy = H[((y + 1) % S) * S + x] - H[((y + S - 1) % S) * S + x];
      var nx = -hx * 1.2, ny = -hy * 1.2, nz = 1, l = Math.sqrt(nx * nx + ny * ny + nz * nz), q = (y * S + x) * 4;
      im.data[q] = (nx / l * 0.5 + 0.5) * 255; im.data[q + 1] = (ny / l * 0.5 + 0.5) * 255; im.data[q + 2] = (nz / l * 0.5 + 0.5) * 255; im.data[q + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    _weave = c;
    return c;
  }
  function weaveTexture(repeat) {
    var t = new THREE.CanvasTexture(weaveNormal());
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (repeat) t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  }

  // ---- 同じ綿の素材（パパのシャツ等） ----
  G.makeFabricMaterial = function (opts) {
    opts = opts || {};
    var col = new THREE.Color(opts.color !== undefined ? opts.color : 0xa9c6e8);
    var sheen = col.clone().lerp(new THREE.Color(0xffffff), 0.5);
    return new THREE.MeshPhysicalMaterial({
      color: col, roughness: 0.86, metalness: 0,
      sheen: 0.45, sheenRoughness: 0.7, sheenColor: sheen,
      normalMap: weaveTexture(opts.repeat || 40), normalScale: new THREE.Vector2(0.45, 0.45)
    });
  };

  // ---- シェーダ ----
  var GL_PARS = [
    'uniform sampler2D uWrk; uniform sampler2D uMask; uniform sampler2D uDet;',
    'uniform vec3 uBase; uniform vec4 uRect; uniform float uWAmp; uniform vec4 uShape; uniform float uShapeBR; uniform float uBulge;',
    'uniform float uStA; uniform float uStB; uniform float uMix; uniform float uStagger;',
    'uniform vec4 uHeap; uniform vec4 uLift; uniform vec4 uHung; uniform float uSwing2; uniform vec4 uMisc;',
    'varying vec2 vShFlat;',
    'const vec2 SH_SA = vec2(' + SA[0].toFixed(5) + ',' + SA[1].toFixed(5) + ');',
    'const vec2 SH_SD = vec2(' + SD[0].toFixed(5) + ',' + SD[1].toFixed(5) + ');',
    'const vec2 SH_SN = vec2(' + SN[0].toFixed(5) + ',' + SN[1].toFixed(5) + ');',
    'const float SH_SL = ' + SL.toFixed(5) + ';',
    'const float SH_ZC = ' + ZC.toFixed(4) + ';',
    'vec2 shUvOf(vec2 p){ return vec2((p.x - uRect.x) * uRect.z, (p.y - uRect.y) * uRect.w); }',
    'vec3 shSleeve(vec2 p){ vec2 q = vec2(abs(p.x), p.y) - SH_SA; float a = dot(q, SH_SD); float b = dot(q, SH_SN);',
    '  float w = mix(0.075, 0.05, clamp(a / SH_SL, 0.0, 1.0)); float inS = step(-0.02, a) * step(a, SH_SL + 0.004) * step(abs(b), w + 0.002); return vec3(a, b, inS); }'
  ].join('\n');

  var GL_VFUNCS = [
    'float shHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uMisc.w) * 43758.5453); }',
    'float shNoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(shHash(i), shHash(i + vec2(1.0, 0.0)), u.x), mix(shHash(i + vec2(0.0, 1.0)), shHash(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float shFlatH(vec2 p){',
    '  vec4 det = texture2D(uDet, shUvOf(p));',
    '  float cf = det.g; float cin = smoothstep(0.52, 0.565, cf); float ch = max(cf - 0.5, 0.0) * 2.0;',
    '  float cs = uShape.x; float csc = clamp(cs, 0.0, 1.0);',
    '  float h = 0.0015;',
    '#ifdef SH_COLLAR',
    '  h += 0.0009 + cin * (0.0025 + ch * 0.0105) * cs;',
    '  vec2 ap = vec2(abs(p.x), p.y);',
    '  float tip = cin * smoothstep(0.055, 0.0, length(ap - vec2(0.062, -0.29)));',
    '  float edge = cin * smoothstep(0.62, 0.5, cf);',
    '  h += (1.0 - csc) * (cin * 0.0015 + edge * 0.0025 * shNoise(p * 9.0 + 2.0) + tip * tip * (p.x > 0.0 ? 0.011 : 0.007));',
    '#endif',
    '  vec3 sc = shSleeve(p); float ss = clamp(p.x < 0.0 ? uShape.y : uShape.z, 0.0, 1.0);',
    '  float cuff = sc.z * smoothstep(SH_SL - 0.075, SH_SL - 0.055, sc.x);',
    '  h += (1.0 - ss) * cuff * (0.003 + 0.0025 * sin(sc.y * 40.0 + sc.x * 30.0 + p.x * 9.0));',
    '  h += cuff * ss * 0.0015;',
    '  vec2 bq = (p - vec2(' + BULGE_C[0] + ', ' + BULGE_C[1] + ')) / vec2(0.03, 0.04); float bb = max(0.0, 1.0 - dot(bq, bq));',
    '  h += uBulge * 0.025 * bb * bb * (3.0 - 2.0 * bb);',
    '  return h; }',
    'vec3 shHeapP(vec2 p, float fh){',
    '  vec2 d = p - vec2(0.0, -0.02); float r = length(d); float ang = atan(d.y, d.x);',
    '  float n1 = shNoise(p * 6.5 + 3.1); float n2 = shNoise(p * 13.0 + 7.3); float n3 = shNoise(p * 26.0 + 1.7); float n4 = shNoise(p.yx * 9.0 + 5.5);',
    '  float r1 = 1.0 - abs(2.0 * n1 - 1.0); float r2 = 1.0 - abs(2.0 * n2 - 1.0); float r4 = 1.0 - abs(2.0 * n4 - 1.0);',
    '  ang += (n4 - 0.5) * 1.8 * smoothstep(0.02, 0.3, r) + uHeap.w;',
    '  float rr = 0.132 * (1.0 - exp(-r / 0.13)); rr *= 0.86 + 0.26 * n2;',
    '  float k = clamp(rr / 0.15, 0.0, 1.0);',
    '  float y = 0.105 * pow(max(1.0 - k * k, 0.0), 0.55);',
    '  y += (r1 * 0.05 + r4 * 0.03 + r2 * 0.018 + (n3 - 0.5) * 0.012 - 0.045) * (1.0 - 0.45 * k) + fh * 0.6;',
    '  y = max(y, 0.004 + 0.01 * n3);',
    '  vec2 lat = vec2(cos(ang), sin(ang)) * rr + (vec2(n2, n4) - 0.5) * 0.03 * (1.0 - k);',
    '  return uHeap.xyz + vec3(lat.x, y, lat.y); }',
    'vec3 shLiftP(vec2 p, float fh){',
    '  float s = p.y - SH_ZC; float hg = max(uLift.y - 0.0015, 0.0);',
    '  float rb = min(0.05, hg * 0.5 + 0.0005); float hv = hg - rb; float arc = 1.5708 * rb;',
    '  float yy; float ff; float th;',
    '  if (s < hv) { yy = -s; ff = 0.0; th = 0.0; }',
    '  else if (s < hv + arc) { th = (s - hv) / rb; yy = -hv - rb * sin(th); ff = rb * (1.0 - cos(th)); }',
    '  else { th = 1.5708; yy = -hg; ff = rb + (s - hv - arc); }',
    '  float hang = 1.0 - th / 1.5708;',
    '  float xw = p.x * (1.0 - 0.1 * hang);',
    '  float off = fh + hang * smoothstep(0.0, 0.25, s) * 0.009 * sin(p.x * 36.0 + s * 7.0);',
    '  yy += off * sin(th); ff += off * cos(th);',
    '  vec3 fw = vec3(sin(uLift.w), 0.0, cos(uLift.w)); vec3 rt = vec3(cos(uLift.w), 0.0, -sin(uLift.w));',
    '  return uLift.xyz + rt * xw + vec3(0.0, yy, 0.0) + fw * ff; }',
    'vec3 shHungP(vec2 p, float fh){',
    '  vec3 sc = shSleeve(p); float sgn = p.x < 0.0 ? -1.0 : 1.0;',
    '  float sw = smoothstep(-0.01, 0.12, sc.x) * (1.0 - smoothstep(0.085, 0.11, abs(sc.y + 0.0)));',
    '  vec2 q = vec2(abs(p.x), p.y) - SH_SA; float an = 0.22 * sw; float c = cos(an); float sn = sin(an);',
    '  vec2 qr = vec2(c * q.x - sn * q.y, sn * q.x + c * q.y) + SH_SA;',
    '  vec2 pp = vec2(sgn * qr.x, qr.y);',
    '  float s = pp.y - SH_ZC; float ax = abs(pp.x);',
    '  float bodyW = (1.0 - smoothstep(0.235, 0.27, ax)) * (1.0 - sw);',
    '  float bul = 0.036 * cos(clamp(pp.x / 0.27, -1.0, 1.0) * 1.5708) * smoothstep(-0.01, 0.13, s);',
    '  float drape = 0.0045 * sin(pp.x * 31.0 + 0.7) * smoothstep(0.15, 0.7, s) * bodyW;',
    '  vec3 loc = vec3(pp.x, -s, bul * bodyW + drape + fh + 0.007 * sw - 0.003 * (1.0 - bodyW) * (1.0 - sw));',
    '  float a = uHung.w + uSwing2 * max(s, 0.0) * 2.0; float ca = cos(a); float sa = sin(a);',
    '  loc.xy = vec2(ca * loc.x - sa * loc.y, sa * loc.x + ca * loc.y);',
    '  return uHung.xyz + loc; }',
    'vec3 shState(float st, vec2 p, float fh){',
    '  if (st < 0.5) return shHeapP(p, fh);',
    '  if (st < 1.5) return vec3(p.x * (1.0 + uMisc.x), fh, p.y * (1.0 + uMisc.x));',
    '  if (st < 2.5) return shLiftP(p, fh);',
    '  return shHungP(p, fh); }',
    'vec3 shPos(vec2 p){',
    '  float fh = shFlatH(p);',
    '  vec3 a = shState(uStA, p, fh);',
    '  if (uMix > 0.0) {',
    '    vec3 b = shState(uStB, p, fh);',
    '    float m = uMix;',
    '    if (uStagger > 0.0) { float rn = clamp(length(p - vec2(0.0, -0.02)) / 0.55, 0.0, 1.0); m = clamp(uMix * (1.0 + uStagger) - rn * uStagger, 0.0, 1.0); m = m * m * (3.0 - 2.0 * m); }',
    '    a = mix(a, b, m); a.y += uMisc.y * sin(3.14159 * m);',
    '  }',
    '  a.x += uMisc.z;',
    '  return a; }',
    'void shEval(vec2 p, out vec3 P, out vec3 N, out vec3 T, out vec3 B){',
    '  const float E = 0.004;',
    '  P = shPos(p); vec3 px = shPos(p + vec2(E, 0.0)); vec3 pz = shPos(p + vec2(0.0, E));',
    '  T = normalize(px - P); B = normalize(pz - P); N = normalize(cross(B, T));',
    '  vec2 uv = shUvOf(p);',
    '  P += N * textureLod(uWrk, uv, 2.0).r * texture2D(uMask, uv).r * uWAmp; }'
  ].join('\n');

  var GL_FPARS = [
    'uniform sampler2D uWeave; uniform float uGradK; uniform vec2 uDetTexel; uniform float uGlow; uniform vec2 uSheen;',
    'varying vec3 vShT; varying vec3 vShB;'
  ].join('\n');

  var GL_FMAP = [
    'vec2 shP = vShFlat; vec2 shUv0 = shUvOf(shP);',
    'float shSide = step(0.0, shP.x);',
    'float shBodyS = clamp(mix(uShape.w, uShapeBR, shSide), 0.0, 1.0);',
    'float shPl = smoothstep(0.05, 0.0, abs(shP.x)) * smoothstep(-0.345, -0.3, shP.y);',
    'float shWarp = (1.0 - shBodyS) * shPl * 0.0055 * sin(shP.y * 19.0 + 1.7) * (0.6 + 0.4 * sin(shP.y * 5.0 + 0.3));',
    'vec2 shMuv = shUv0 + vec2(shWarp * uRect.z, 0.0);',
    'vec4 shTex = texture2D(map, shMuv);',
    'diffuseColor *= shTex;',
    'vec4 shMk = texture2D(uMask, shUv0); float shAmt = shMk.r; float shWet = shMk.g;',
    'vec4 shWr = texture2D(uWrk, shUv0);',
    'vec2 shG = (shWr.gb - 0.5) * 6.0 * shAmt * uGradK;',
    'vec4 shD = texture2D(uDet, shMuv);',
    'float shCf = texture2D(uDet, shUv0).g;',
    '#ifdef SH_COLLAR',
    'if (shCf < 0.535) discard;',
    '#else',
    'if (shCf > 0.535) diffuseColor.rgb = uBase * 0.42;',
    '#endif',
    'float shDl = texture2D(uDet, shMuv - vec2(uDetTexel.x, 0.0)).r; float shDr = texture2D(uDet, shMuv + vec2(uDetTexel.x, 0.0)).r;',
    'float shDu = texture2D(uDet, shMuv - vec2(0.0, uDetTexel.y)).r; float shDd = texture2D(uDet, shMuv + vec2(0.0, uDetTexel.y)).r;',
    'shG += vec2((shDr - shDl) / (2.0 * uDetTexel.x / uRect.z), (shDd - shDu) / (2.0 * uDetTexel.y / uRect.w)) * 0.0022;',
    // そでの折り目
    'vec3 shSc = shSleeve(shP); float shSs = shP.x < 0.0 ? uShape.y : uShape.z;',
    'float shAl = smoothstep(0.025, 0.07, shSc.x) * (1.0 - smoothstep(SH_SL - 0.08, SH_SL - 0.062, shSc.x));',
    'float shCw = shSc.z * shAl * clamp(shSs, 0.0, 1.3); float shTb = abs(shSc.y) / 0.0045;',
    'float shCrLine = 0.0;',
    'if (shCw > 0.0 && shTb < 1.0) { vec2 gq = -0.6 * shCw * sign(shSc.y) * SH_SN; gq.x *= (shP.x < 0.0 ? -1.0 : 1.0); shG += gq; shCrLine = shCw * (1.0 - smoothstep(0.0, 0.25, shTb)); }',
    // 織り目
    'vec3 shWv = texture2D(uWeave, shP * vec2(83.0, 83.0)).xyz * 2.0 - 1.0; shG += -shWv.xy / max(shWv.z, 0.3) * 0.16;',
    // しわの谷の陰・湿り・アイロン後の明るさ
    'float shAo = 1.0 - shAmt * (0.55 * (1.0 - shWr.a) + 0.18 * (1.0 - shWr.r) * (1.0 - shWr.r));',
    'float shCAo = 1.0 - 0.38 * clamp(uShape.x, 0.0, 1.0) * smoothstep(0.03, 0.49, shD.g) * (1.0 - step(0.5, shD.g));',
    'diffuseColor.rgb *= shAo * shCAo * (1.0 - 0.2 * shWet) * (1.0 + 0.035 * (1.0 - shAmt)) * (1.0 + 0.12 * shCrLine);',
    'if (!gl_FrontFacing) diffuseColor.rgb *= 0.8;'
  ].join('\n');

  // ---- 本体 ----
  G.createShirt = function (ctx) {
    ctx = ctx || {};
    var low = !!ctx.lowPower;
    var P = paths();
    var group = new THREE.Group();
    group.name = 'shirt';
    group.position.set(0, G.L.matTop, 0);

    // テクスチャ
    var CW = low ? 1024 : 2048, CH = Math.round(CW * LD / LW);
    var colorCv = G.makeCanvas(CW, CH), layerCv = G.makeCanvas(CW, CH);
    var colorTex = new THREE.CanvasTexture(colorCv);
    colorTex.colorSpace = THREE.SRGBColorSpace; colorTex.flipY = false;
    colorTex.anisotropy = Math.max(1, ctx.aniso || 4);
    var DW = low ? 512 : 1024, DH = Math.round(DW * LD / LW);
    var det = buildDetail(DW, DH);
    var WN = low ? 256 : 512;
    var wrkData = new Uint8Array(WN * WN * 4);
    var wrkTex = new THREE.DataTexture(wrkData, WN, WN, THREE.RGBAFormat, THREE.UnsignedByteType);
    wrkTex.magFilter = THREE.LinearFilter; wrkTex.minFilter = THREE.LinearMipmapLinearFilter; wrkTex.generateMipmaps = true;
    var maskData = new Uint8Array(MASK_N * MASK_N * 4);
    var maskTex = new THREE.DataTexture(maskData, MASK_N, MASK_N, THREE.RGBAFormat, THREE.UnsignedByteType);
    maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter;
    var weaveTex = weaveTexture(0);

    // しわ量・湿り・領域
    var amt = new Float32Array(MASK_N * MASK_N), wet = new Float32Array(MASK_N * MASK_N);
    var regionOf = new Int8Array(MASK_N * MASK_N), cover = new Uint8Array(MASK_N * MASK_N);
    var inPocket = new Uint8Array(MASK_N * MASK_N);
    var regCount = [0, 0, 0, 0, 0], regSum = [0, 0, 0, 0, 0], regCx = [0, 0, 0, 0, 0], regCz = [0, 0, 0, 0, 0];
    (function classify() {
      var g = G.makeCanvas(4, 4).getContext('2d');
      var raw = new Uint8Array(MASK_N * MASK_N);
      for (var j = 0; j < MASK_N; j++) for (var i = 0; i < MASK_N; i++) {
        var x = X0 + (i + 0.5) / MASK_N * LW, z = Z0 + (j + 0.5) / MASK_N * LD, id = j * MASK_N + i, r = -1;
        if (g.isPointInPath(P.sleeveL, x, z)) r = 1;
        else if (g.isPointInPath(P.sleeveR, x, z)) r = 2;
        else if (g.isPointInPath(P.collar, x, z)) r = 0;
        else if (g.isPointInPath(P.body, x, z)) r = (z < shoulderTop(Math.abs(x)) + 0.05) ? 0 : (x < 0 ? 3 : 4);
        regionOf[id] = r;
        if (r >= 0) { raw[id] = 1; regCount[r]++; regCx[r] += x; regCz[r] += z; }
        inPocket[id] = (x > POCKET.x0 - 0.004 && x < POCKET.x1 + 0.004 && z > POCKET.z0 - 0.004 && z < POCKET.z1 + 0.004) ? 1 : 0;
      }
      for (var r2 = 0; r2 < 5; r2++) { regCx[r2] /= Math.max(1, regCount[r2]); regCz[r2] /= Math.max(1, regCount[r2]); }
      // 甘めの判定用に 2 セル広げる
      for (j = 0; j < MASK_N; j++) for (i = 0; i < MASK_N; i++) {
        var c = 0;
        for (var dj = -2; dj <= 2 && !c; dj++) for (var di = -2; di <= 2; di++) {
          var ii = i + di, jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < MASK_N && jj < MASK_N && raw[jj * MASK_N + ii]) { c = 1; break; }
        }
        cover[j * MASK_N + i] = c;
      }
    })();
    var totalCells = regCount[0] + regCount[1] + regCount[2] + regCount[3] + regCount[4];

    // ユニフォーム（本体と影で共有）
    var U = {
      uWrk: { value: wrkTex }, uMask: { value: maskTex }, uDet: { value: det.tex }, uWeave: { value: weaveTex },
      uRect: { value: new THREE.Vector4(X0, Z0, 1 / LW, 1 / LD) }, uWAmp: { value: 0.012 },
      uShape: { value: new THREE.Vector4(0, 0, 0, 0) }, uShapeBR: { value: 0 }, uBulge: { value: 0 },
      uStA: { value: ST_HEAP }, uStB: { value: ST_FLAT }, uMix: { value: 0 }, uStagger: { value: 0 },
      uHeap: { value: new THREE.Vector4(0, 0, 0, 0) }, uLift: { value: new THREE.Vector4(0, 0.3, ZC, 0) },
      uHung: { value: new THREE.Vector4(0, 1, -1, 0) }, uSwing2: { value: 0 },
      uMisc: { value: new THREE.Vector4(0, 0, 0, 0) },
      uDetTexel: { value: new THREE.Vector2(1 / DW, 1 / DH) }, uBase: { value: new THREE.Color(1, 1, 1) }, uGradK: { value: 10.0 }, uGlow: { value: 0 }, uSheen: { value: new THREE.Vector2(-9, 0) }
    };
    function injectVertex(shader, withNormal) {
      for (var k in U) shader.uniforms[k] = U[k];
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + GL_PARS + '\n' + GL_VFUNCS + '\nvarying vec3 vShT; varying vec3 vShB;');
      var ev = 'vec3 shP3; vec3 shN; vec3 shT; vec3 shB; shEval(position.xz, shP3, shN, shT, shB); vShFlat = position.xz;';
      if (withNormal) {
        shader.vertexShader = shader.vertexShader
          .replace('#include <beginnormal_vertex>', ev + '\nvec3 objectNormal = shN;\nvShT = normalize((modelViewMatrix * vec4(shT, 0.0)).xyz); vShB = normalize((modelViewMatrix * vec4(shB, 0.0)).xyz);')
          .replace('#include <begin_vertex>', 'vec3 transformed = shP3;');
      } else {
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', ev + '\nvec3 transformed = shP3;');
      }
    }
    function makeMat(collar) {
      var pre = collar ? '#define SH_COLLAR\n' : '';
      var m = new THREE.MeshPhysicalMaterial({
        map: colorTex, color: 0xffffff, roughness: 0.88, metalness: 0,
        sheen: 0.22, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.42,
        side: THREE.DoubleSide, alphaTest: 0.5
      });
      m.onBeforeCompile = function (shader) {
        injectVertex(shader, true);
        shader.vertexShader = pre + shader.vertexShader;
        shader.fragmentShader = pre + shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + GL_PARS + '\n' + GL_FPARS)
          .replace('#include <map_fragment>', GL_FMAP)
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * (1.0 - 0.28 * shWet) * (1.0 - 0.07 * (1.0 - shAmt));')
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normalize(vNormal) - shG.x * normalize(vShT) - shG.y * normalize(vShB)) * faceDirection;')
          .replace('#include <emissivemap_fragment>', [
            '#include <emissivemap_fragment>',
            'float shBand = uSheen.y * exp(-pow((dot(shP, vec2(0.86, 0.5)) - uSheen.x) / 0.06, 2.0));',
            'totalEmissiveRadiance += diffuseColor.rgb * (uGlow * (0.06 + 0.3 * shD.b) + shBand * 0.22);'
          ].join('\n'));
      };
      m.customProgramCacheKey = function () { return collar ? 'shirt-collar' : 'shirt-main'; };
      var d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: colorTex, alphaTest: 0.5, side: THREE.DoubleSide });
      d.onBeforeCompile = function (shader) {
        injectVertex(shader, false);
        shader.vertexShader = pre + shader.vertexShader;
        if (collar) {
          shader.fragmentShader = 'uniform sampler2D uDet;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>',
            '#include <alphatest_fragment>\nif (texture2D(uDet, vMapUv).g < 0.535) discard;');
        }
      };
      d.customProgramCacheKey = function () { return collar ? 'shirt-collar-depth' : 'shirt-depth'; };
      return { mat: m, depth: d };
    }
    var mm = makeMat(false), mc = makeMat(true), mat = mm.mat;
    function sheetGeo(x0, z0, w, d, sx, sz) {
      var g = new THREE.PlaneGeometry(w, d, sx, sz);
      g.rotateX(-Math.PI / 2);
      var pa = g.attributes.position, ua = g.attributes.uv;
      for (var i = 0; i < pa.count; i++) {
        pa.setX(i, pa.getX(i) + x0 + w / 2); pa.setZ(i, pa.getZ(i) + z0 + d / 2); pa.setY(i, 0);
        ua.setXY(i, (pa.getX(i) - X0) / LW, (pa.getZ(i) - Z0) / LD);
      }
      g.computeBoundingSphere();
      return g;
    }
    var SEGX = low ? 120 : 180, SEGZ = low ? 106 : 160;
    var mesh = new THREE.Mesh(sheetGeo(X0, Z0, LW, LD, SEGX, SEGZ), mm.mat);
    mesh.customDepthMaterial = mm.depth;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    group.add(mesh);
    var collarMesh = new THREE.Mesh(sheetGeo(-0.125, -0.42, 0.25, 0.15, low ? 60 : 100, low ? 36 : 60), mc.mat);
    collarMesh.customDepthMaterial = mc.depth;
    collarMesh.castShadow = true; collarMesh.receiveShadow = true; collarMesh.frustumCulled = false;
    group.add(collarMesh);

    // 影マップの使い回し用: 頂点シェーダで形を決める値（core.js の影キャッシュが見る）
    var SIG_V = ['uShape', 'uHeap', 'uLift', 'uHung', 'uMisc'], SIG_F = ['uShapeBR', 'uBulge', 'uStA', 'uStB', 'uMix', 'uStagger', 'uSwing2', 'uWAmp'];
    function shadowSig(a) {
      for (var i = 0; i < SIG_V.length; i++) { var v = U[SIG_V[i]].value; a.push(v.x, v.y, v.z, v.w); }
      for (i = 0; i < SIG_F.length; i++) a.push(U[SIG_F[i]].value);
      a.push(wrkTex.version, maskTex.version, colorTex.version, det.tex.version);
    }
    mesh.userData.shadowSig = shadowSig; collarMesh.userData.shadowSig = shadowSig;

    // 山の芯（すき間から見える内側の布）
    var coreGeo = new THREE.SphereGeometry(1, 28, 16);
    (function () {
      var p = coreGeo.attributes.position;
      for (var i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        var n = G.noise2(x * 2.2 + 5, z * 2.2 + y * 1.7, 41) - 0.5, n2 = G.noise2(x * 6 + 1, z * 6 - y * 3, 42) - 0.5;
        var r = 1 + n * 0.35 + n2 * 0.12;
        p.setXYZ(i, x * r * 0.105, Math.max(0.02, (y * r * 0.05 + 0.035)), z * r * 0.105);
      }
      coreGeo.computeVertexNormals();
    })();
    var coreMat = G.makeFabricMaterial({ color: 0xa9c6e8, repeat: 6 });
    var core = new THREE.Mesh(coreGeo, coreMat);
    core.castShadow = true; core.receiveShadow = true;
    group.add(core);

    // 偽の接地影（平置き: シルエットをぼかした板 / 山: まるい影）
    var shCv = G.makeCanvas(256, Math.round(256 * LD / LW)), sg = shCv.getContext('2d');
    sg.shadowColor = 'rgba(255,255,255,1)'; sg.shadowBlur = 5; sg.shadowOffsetX = 2000;
    sg.drawImage(det.sil, -2000 + 2, -2, shCv.width, shCv.height);
    var shTex = new THREE.CanvasTexture(shCv); shTex.flipY = false;
    var shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(LW, LD),
      new THREE.MeshBasicMaterial({ color: 0x000000, map: shTex, transparent: true, opacity: 0.4, depthWrite: false }));
    (function () {
      var g2 = shadowPlane.geometry; g2.rotateX(-Math.PI / 2);
      var u = g2.attributes.uv, p = g2.attributes.position;
      for (var i = 0; i < p.count; i++) u.setXY(i, (p.getX(i) + LW / 2) / LW, (p.getZ(i) + LD / 2) / LD);
      g2.translate(X0 + LW / 2 + 0.003, 0.0006, Z0 + LD / 2 - 0.002);
    })();
    shadowPlane.renderOrder = -1;
    group.add(shadowPlane);
    var heapShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44),
      new THREE.MeshBasicMaterial({ color: 0x000000, map: G.softDotTexture(), transparent: true, opacity: 0.5, depthWrite: false }));
    heapShadow.rotation.x = -Math.PI / 2; heapShadow.renderOrder = -1;
    group.add(heapShadow);

    // ---- 状態 ----
    var self = {
      group: group, mode: 'heap', regions: [], progress: 0, allDone: false,
      onRegionDone: null, onAllDone: null, pocketBulge: 1
    };
    for (var r = 0; r < 5; r++) self.regions.push({ name: REG[r], progress: 0, done: false });
    var colorIndex = -1, seedN = 1;
    var shape = [0, 0, 0, 0, 0], shapeV = [0, 0, 0, 0, 0], finishing = [0, 0, 0, 0, 0];
    var maskDirty = true, wetActive = false, wetTimer = 0;
    var trans = null;            // { from, to, t, dur, kind, cb }
    var swingA = 0, swingV = 0, glow = 0, glowT = 0, sheenT = -1;
    var liftPrev = new THREE.Vector3(), liftHead = 0, liftHeadT = 0, liftHas = false;
    var tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpPlane = new THREE.Plane(), tmpSphere = new THREE.Sphere();
    var heapLocal = new THREE.Vector3(G.L.basket.x, 0.03 - G.L.matTop, G.L.basket.z);
    var hungLocal = new THREE.Vector3(0, 1.3, -1.1);

    function toLocal(x, y, z, out) {
      group.updateWorldMatrix(true, false);
      out.set(x, y, z); return group.worldToLocal(out);
    }
    function toWorld(v) { group.updateWorldMatrix(true, false); return group.localToWorld(v); }

    function writeMask() {
      for (var i = 0, p = 0; i < MASK_N * MASK_N; i++, p += 4) {
        maskData[p] = Math.round(amt[i] * 255); maskData[p + 1] = Math.round(wet[i] * 255); maskData[p + 2] = 0; maskData[p + 3] = 255;
      }
      maskTex.needsUpdate = true; maskDirty = false;
    }
    function recomputeRegions() {
      for (var r = 0; r < 5; r++) regSum[r] = 0;
      for (var i = 0; i < MASK_N * MASK_N; i++) { var rr = regionOf[i]; if (rr >= 0) regSum[rr] += amt[i]; }
      updateProgress();
    }
    function updateProgress() {
      var tot = 0;
      for (var r = 0; r < 5; r++) {
        var pr = regCount[r] ? 1 - regSum[r] / regCount[r] : 1;
        self.regions[r].progress = clamp(pr, 0, 1);
        tot += regSum[r];
      }
      self.progress = clamp(1 - tot / Math.max(1, totalCells), 0, 1);
    }
    function regionCenterWorld(r) { return posOf(regCx[r], regCz[r], new THREE.Vector3()); }
    function checkDone() {
      for (var r = 0; r < 5; r++) {
        var R = self.regions[r];
        if (!R.done && R.progress >= DONE_AT) {
          R.done = true; finishing[r] = 0.5;
          if (self.onRegionDone) { try { self.onRegionDone(R.name, regionCenterWorld(r)); } catch (e) { if (window.console) console.error(e); } }
          if (!self.allDone && self.regions.every(function (q) { return q.done; })) {
            self.allDone = true;
            if (self.onAllDone) { try { self.onAllDone(); } catch (e2) { if (window.console) console.error(e2); } }
          }
        }
      }
    }

    // 姿の点（CPU 版。当たり判定・ポケット位置・中心点に使う、ローカル → world）
    function flatH(x, z) {
      var h = 0.002;
      var bx = (x - BULGE_C[0]) / 0.03, bz = (z - BULGE_C[1]) / 0.04, bb = Math.max(0, 1 - bx * bx - bz * bz);
      return h + self.pocketBulge * 0.025 * bb * bb * (3 - 2 * bb);
    }
    function stateP(st, x, z, out) {
      var fh = flatH(x, z), hp = U.uHeap.value, lp = U.uLift.value, hu = U.uHung.value;
      if (st === ST_HEAP) {
        var dx = x, dz = z + 0.02, r = Math.sqrt(dx * dx + dz * dz), rr = 0.155 * (1 - Math.exp(-r / 0.14)), a = Math.atan2(dz, dx) + hp.w;
        var kk = clamp(rr / 0.165, 0, 1);
        return out.set(hp.x + Math.cos(a) * rr, hp.y + 0.122 * Math.pow(Math.max(1 - kk * kk, 0), 0.6), hp.z + Math.sin(a) * rr);
      }
      if (st === ST_FLAT) return out.set(x, fh, z);
      if (st === ST_LIFT) {
        var s = z - ZC, hg = Math.max(lp.y - 0.0015, 0), rb = Math.min(0.05, hg * 0.5 + 0.0005), hv = hg - rb, arc = 1.5708 * rb, yy, ff, th;
        if (s < hv) { yy = -s; ff = 0; th = 0; }
        else if (s < hv + arc) { th = (s - hv) / rb; yy = -hv - rb * Math.sin(th); ff = rb * (1 - Math.cos(th)); }
        else { th = 1.5708; yy = -hg; ff = rb + (s - hv - arc); }
        var xw = x * (1 - 0.1 * (1 - th / 1.5708));
        yy += fh * Math.sin(th); ff += fh * Math.cos(th);
        return out.set(lp.x + Math.cos(lp.w) * xw + Math.sin(lp.w) * ff, lp.y + yy, lp.z - Math.sin(lp.w) * xw + Math.cos(lp.w) * ff);
      }
      var s2 = z - ZC, bul = 0.036 * Math.cos(clamp(x / 0.27, -1, 1) * 1.5708) * G.smooth(-0.01, 0.13, s2);
      var lx = x, ly = -s2, ang = hu.w + U.uSwing2.value * Math.max(s2, 0) * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      return out.set(hu.x + ca * lx - sa * ly, hu.y + sa * lx + ca * ly, hu.z + bul + fh);
    }
    function posOf(x, z, out) {
      stateP(U.uStA.value, x, z, out);
      if (U.uMix.value > 0) { stateP(U.uStB.value, x, z, tmpV2); out.lerp(tmpV2, U.uMix.value); }
      out.x += U.uMisc.value.z;
      return toWorld(out);
    }
    function curState() { return U.uMix.value >= 0.5 ? U.uStB.value : U.uStA.value; }
    function startTrans(to, dur, kind, cb) {
      var from = trans ? (U.uMix.value >= 0.5 ? U.uStB.value : U.uStA.value) : U.uStA.value;
      if (trans && trans.cb && trans.kind !== kind) { var old = trans.cb; trans = null; try { old(); } catch (e) { if (window.console) console.error(e); } }
      U.uStA.value = from; U.uStB.value = to; U.uMix.value = 0; U.uStagger.value = 0;
      U.uMisc.value.x = 0; U.uMisc.value.y = 0;
      trans = { from: from, to: to, t: 0, dur: dur, kind: kind, cb: cb || null };
      if (from === to) { U.uMix.value = 0; }
    }
    function endTrans() {
      var tr = trans; trans = null;
      U.uStA.value = tr.to; U.uMix.value = 0; U.uStagger.value = 0; U.uMisc.value.x = 0; U.uMisc.value.y = 0;
      if (tr.kind === 'unfurl' || tr.kind === 'drop') self.mode = 'flat';
      if (tr.kind === 'pull') { self.mode = 'gone'; group.visible = false; }
      if (tr.cb) { try { tr.cb(); } catch (e) { if (window.console) console.error(e); } }
    }

    // しわの模様は次の update で作る（起動時のように reset が続けて呼ばれても、作るのは最後の 1 回だけ）
    var wrkSeed = -1;
    function regenWrinkles() {
      wrkSeed = 1000 + seedN * 7919;
      seedN++;
    }
    function flushWrinkles() {
      if (wrkSeed < 0) return;
      genWrinkles(WN, wrkSeed, wrkData);
      wrkSeed = -1;
      wrkTex.needsUpdate = true;
    }

    // ---- 公開 API ----
    function applyColor(ci) {
      if (ci === colorIndex) return;
      colorIndex = ci;
      drawColor(colorCv, layerCv, G.SHIRT_COLORS[ci]);
      colorTex.needsUpdate = true;
      coreMat.color.setHex(G.SHIRT_COLORS[ci]).multiplyScalar(0.8);
      coreMat.sheenColor.setHex(G.SHIRT_COLORS[ci]);
      mm.mat.sheenColor.setHex(G.SHIRT_COLORS[ci]).lerp(new THREE.Color(0xffffff), 0.4);
      mc.mat.sheenColor.copy(mm.mat.sheenColor);
      U.uBase.value.setHex(G.SHIRT_COLORS[ci]);
    }
    self.reset = function (ci) {
      ci = (ci | 0); var n = G.SHIRT_COLORS.length; ci = ((ci % n) + n) % n;
      applyColor(ci);
      regenWrinkles();
      for (var i = 0; i < amt.length; i++) { amt[i] = 1; wet[i] = 0; }
      for (var r = 0; r < 5; r++) { shape[r] = 0; shapeV[r] = 0; finishing[r] = 0; self.regions[r].done = false; }
      self.allDone = false; self.pocketBulge = 1;
      trans = null; swingA = swingV = 0; sheenT = -1; liftHas = false;
      U.uStA.value = ST_HEAP; U.uMix.value = 0; U.uStagger.value = 0; U.uMisc.value.set(0, 0, 0, (seedN * 0.37) % 10);
      U.uHeap.value.set(heapLocal.x, heapLocal.y, heapLocal.z, Math.random() * 6.28);
      self.mode = 'heap'; group.visible = true;
      recomputeRegions(); writeMask(); applyUniforms(0);
    };
    self.setHeap = function (x, y, z) {
      toLocal(x, y, z, heapLocal);
      U.uHeap.value.x = heapLocal.x; U.uHeap.value.y = heapLocal.y; U.uHeap.value.z = heapLocal.z;
      if (self.mode !== 'heap' || trans) { trans = null; U.uStA.value = ST_HEAP; U.uMix.value = 0; U.uMisc.value.z = 0; }
      self.mode = 'heap'; group.visible = true;
    };
    self.unfurl = function (cb) {
      if (curState() !== ST_HEAP) { self.mode = 'flat'; trans = null; U.uStA.value = ST_FLAT; U.uMix.value = 0; if (cb) cb(); return; }
      startTrans(ST_FLAT, 0.55, 'unfurl', cb);
      U.uStagger.value = 0.6;
    };
    self.ironAt = function (x, z, radius, amount) {
      var res = { on: false, region: null, removed: 0, bump: false };
      if (self.mode !== 'flat' || trans) return res;
      toLocal(x, G.L.matTop, z, tmpV);
      var lx = tmpV.x, lz = tmpV.z;
      radius = Math.max(0.005, +radius || 0.05); amount = clamp(+amount || 0, 0, 1);
      res.on = self.contains(x, z);
      var ci = Math.floor((lx - X0) / LW * MASK_N), cj = Math.floor((lz - Z0) / LD * MASK_N);
      if (ci >= 0 && cj >= 0 && ci < MASK_N && cj < MASK_N) {
        var rc = regionOf[cj * MASK_N + ci];
        if (rc < 0) { // 近くの領域
          var best = 1e9;
          for (var dj = -3; dj <= 3; dj++) for (var di = -3; di <= 3; di++) {
            var a2 = ci + di, b2 = cj + dj;
            if (a2 >= 0 && b2 >= 0 && a2 < MASK_N && b2 < MASK_N && regionOf[b2 * MASK_N + a2] >= 0 && di * di + dj * dj < best) { best = di * di + dj * dj; rc = regionOf[b2 * MASK_N + a2]; }
          }
        }
        if (rc >= 0 && res.on) res.region = REG[rc];
      }
      var block = self.pocketBulge > 0.5 &&
        lx > POCKET.x0 - radius * 0.5 && lx < POCKET.x1 + radius * 0.5 && lz > POCKET.z0 - radius * 0.5 && lz < POCKET.z1 + radius * 0.5;
      res.bump = block;
      var ri = Math.ceil(radius / LW * MASK_N) + 1, rj = Math.ceil(radius / LD * MASK_N) + 1, removed = 0, any = false;
      for (var j = Math.max(0, cj - rj); j <= Math.min(MASK_N - 1, cj + rj); j++) {
        for (var i = Math.max(0, ci - ri); i <= Math.min(MASK_N - 1, ci + ri); i++) {
          var cx = X0 + (i + 0.5) / MASK_N * LW, cz = Z0 + (j + 0.5) / MASK_N * LD;
          var d = Math.sqrt((cx - lx) * (cx - lx) + (cz - lz) * (cz - lz));
          if (d > radius) continue;
          var w = 1 - G.smooth(radius * 0.45, radius, d), id = j * MASK_N + i;
          if (w <= 0) continue;
          any = true;
          wet[id] = Math.max(wet[id], w * 0.9);
          if (block && inPocket[id]) continue;
          var o = amt[id], nv = Math.max(0, o - amount * w);
          if (nv < 0.02) nv = 0;
          if (o !== nv) {
            amt[id] = nv;
            var rr = regionOf[id];
            if (rr >= 0) { regSum[rr] -= (o - nv); removed += (o - nv); }
          }
        }
      }
      if (any) { maskDirty = true; wetActive = true; }
      res.removed = removed / Math.max(1, totalCells);
      if (removed > 0) { updateProgress(); checkDone(); }
      return res;
    };
    self.wrinkliestPoint = function () {
      var best = -1, bi = -1, bj = -1;
      for (var j = 2; j < MASK_N - 2; j += 2) for (var i = 2; i < MASK_N - 2; i += 2) {
        var id = j * MASK_N + i, r = regionOf[id];
        if (r < 0 || self.regions[r].done) continue;
        var s = amt[id] + amt[id - 2] + amt[id + 2] + amt[id - 2 * MASK_N] + amt[id + 2 * MASK_N];
        if (self.pocketBulge > 0.5 && inPocket[id]) s *= 0.3;
        if (s > best) { best = s; bi = i; bj = j; }
      }
      if (bi < 0 || best < 0.25) return null;
      return posOf(X0 + (bi + 0.5) / MASK_N * LW, Z0 + (bj + 0.5) / MASK_N * LD, new THREE.Vector3());
    };
    self.contains = function (x, z) {
      if (self.mode !== 'flat') return false;
      toLocal(x, G.L.matTop, z, tmpV);
      var i = Math.floor((tmpV.x - X0) / LW * MASK_N), j = Math.floor((tmpV.z - Z0) / LD * MASK_N);
      if (i < 0 || j < 0 || i >= MASK_N || j >= MASK_N) return false;
      return cover[j * MASK_N + i] === 1;
    };
    self.hitTest = function (ray) {
      if (!ray || self.mode === 'gone' || !group.visible) return false;
      var st = curState();
      group.updateWorldMatrix(true, false);
      if (st === ST_HEAP) {
        tmpV.set(U.uHeap.value.x, U.uHeap.value.y + 0.07, U.uHeap.value.z); toWorld(tmpV);
        tmpSphere.set(tmpV, 0.2); return ray.intersectsSphere(tmpSphere);
      }
      if (st === ST_FLAT) {
        tmpV.set(0, 0.005, 0); toWorld(tmpV);
        tmpPlane.set(new THREE.Vector3(0, 1, 0), -tmpV.y);
        if (!ray.intersectPlane(tmpPlane, tmpV2)) return false;
        var m = self.mode; self.mode = 'flat'; var c = self.contains(tmpV2.x, tmpV2.z); self.mode = m; return c;
      }
      if (st === ST_LIFT) {
        var lp = U.uLift.value; tmpV.set(lp.x, lp.y - Math.min(0.3, lp.y * 0.5), lp.z); toWorld(tmpV);
        tmpSphere.set(tmpV, 0.28); return ray.intersectsSphere(tmpSphere);
      }
      var hu = U.uHung.value; tmpV.set(hu.x, hu.y, hu.z + 0.02); toWorld(tmpV);
      tmpPlane.set(new THREE.Vector3(0, 0, 1), -tmpV.z);
      if (!ray.intersectPlane(tmpPlane, tmpV2)) return false;
      var dx = tmpV2.x - tmpV.x, dy = tmpV2.y - tmpV.y;
      return dx > -0.5 && dx < 0.5 && dy < 0.08 && dy > -0.85;
    };
    self.pocketWorld = function () {
      if (curState() === ST_HEAP) { tmpV.set(U.uHeap.value.x + 0.03, U.uHeap.value.y + 0.12, U.uHeap.value.z); return toWorld(tmpV.clone()); }
      return posOf(0.11, POCKET.z0 + 0.002, new THREE.Vector3());
    };
    self.setLift = function (x, y, z) {
      toLocal(x, y, z, tmpV);
      var lp = U.uLift.value;
      if (!liftHas) { liftPrev.copy(tmpV); liftHas = true; liftHead = 0; liftHeadT = 0; }
      lp.x = tmpV.x; lp.y = Math.max(tmpV.y, 0.0015); lp.z = tmpV.z;
      if (self.mode !== 'lift') {
        if (curState() !== ST_LIFT) startTrans(ST_LIFT, 0.25, 'lift', null);
        self.mode = 'lift';
      }
      group.visible = true;
    };
    self.dropFlat = function (cb) {
      liftHas = false;
      if (curState() === ST_FLAT && !trans) { self.mode = 'flat'; if (cb) cb(); return; }
      startTrans(ST_FLAT, 0.5, 'drop', cb);
    };
    self.hangAt = function (anchor, cb) {
      if (anchor) { toLocal(anchor.x, anchor.y, anchor.z, hungLocal); }
      U.uHung.value.x = hungLocal.x; U.uHung.value.y = hungLocal.y; U.uHung.value.z = hungLocal.z;
      liftHas = false; swingA = 0; swingV = 0;
      self.mode = 'hung'; group.visible = true;
      if (curState() === ST_HUNG && !trans) { if (cb) cb(); return; }
      startTrans(ST_HUNG, 0.5, 'hang', cb);
    };
    self.swing = function (impulse) {
      var v = +impulse || 0; swingV += clamp(v, -3, 3);
    };
    self.pullAway = function (dirX, cb) {
      var d = dirX < 0 ? -1 : 1;
      var from = curState();
      trans = null; U.uStA.value = from; U.uMix.value = 0;
      trans = { from: from, to: from, t: 0, dur: 0.7, kind: 'pull', cb: cb || null, dir: d };
    };
    self.sheen = function () { sheenT = 0; };
    self.setGlow = function (v) { glowT = clamp(+v || 0, 0, 1); };
    self.serialize = function () {
      var S = 24, bytes = '', i, j;
      for (j = 0; j < S; j++) for (i = 0; i < S; i++) {
        var s = 0, n = 0;
        for (var jj = Math.floor(j * MASK_N / S); jj < Math.floor((j + 1) * MASK_N / S); jj++)
          for (var ii = Math.floor(i * MASK_N / S); ii < Math.floor((i + 1) * MASK_N / S); ii++) { s += amt[jj * MASK_N + ii]; n++; }
        bytes += String.fromCharCode(Math.round(clamp(s / Math.max(1, n), 0, 1) * 255));
      }
      return {
        color: colorIndex < 0 ? 0 : colorIndex, mask: btoa(bytes),
        done: self.regions.filter(function (r) { return r.done; }).map(function (r) { return r.name; }),
        bulge: Math.round(clamp(self.pocketBulge, 0, 1) * 100) / 100
      };
    };
    self.restore = function (obj) {
      var ok = false;
      try {
        if (obj && typeof obj === 'object') {
          var ci = obj.color | 0;
          applyColor(((ci % G.SHIRT_COLORS.length) + G.SHIRT_COLORS.length) % G.SHIRT_COLORS.length);
          var S = 24, raw = typeof obj.mask === 'string' ? atob(obj.mask) : '';
          if (raw.length === S * S) {
            for (var j = 0; j < MASK_N; j++) for (var i = 0; i < MASK_N; i++) {
              var fx = clamp((i + 0.5) / MASK_N * S - 0.5, 0, S - 1), fz = clamp((j + 0.5) / MASK_N * S - 0.5, 0, S - 1);
              var x0 = Math.floor(fx), z0 = Math.floor(fz), x1 = Math.min(S - 1, x0 + 1), z1 = Math.min(S - 1, z0 + 1), tx = fx - x0, tz = fz - z0;
              var v = lerp(lerp(raw.charCodeAt(z0 * S + x0), raw.charCodeAt(z0 * S + x1), tx), lerp(raw.charCodeAt(z1 * S + x0), raw.charCodeAt(z1 * S + x1), tx), tz) / 255;
              amt[j * MASK_N + i] = v < 0.06 ? 0 : clamp(v, 0, 1); wet[j * MASK_N + i] = 0;
            }
            ok = true;
          }
          var dn = Array.isArray(obj.done) ? obj.done : [];
          for (var r = 0; r < 5; r++) {
            var d = dn.indexOf(REG[r]) >= 0;
            self.regions[r].done = d; shape[r] = d ? 1 : 0; shapeV[r] = 0; finishing[r] = 0;
            if (d) for (var k = 0; k < amt.length; k++) if (regionOf[k] === r) amt[k] = 0;
          }
          if (typeof obj.bulge === 'number' && isFinite(obj.bulge)) self.pocketBulge = clamp(obj.bulge, 0, 1);
        }
      } catch (e) { ok = false; }
      if (!ok) {
        for (var q = 0; q < amt.length; q++) { amt[q] = 1; wet[q] = 0; }
        for (var r2 = 0; r2 < 5; r2++) { self.regions[r2].done = false; shape[r2] = 0; shapeV[r2] = 0; finishing[r2] = 0; }
      }
      recomputeRegions();
      self.allDone = self.regions.every(function (q2) { return q2.done; });
      writeMask(); applyUniforms(0);
      group.visible = true;
      return ok;
    };

    // ---- 毎フレーム ----
    function applyUniforms() {
      U.uShape.value.set(shape[0], shape[1], shape[2], shape[3]); U.uShapeBR.value = shape[4];
      U.uBulge.value = clamp(self.pocketBulge, 0, 1);
    }
    self.update = function (dt, t) {
      flushWrinkles();
      dt = Math.min(dt || 0.016, 0.05);
      // 遷移
      if (trans) {
        trans.t += dt;
        var k = clamp(trans.t / trans.dur, 0, 1);
        if (trans.kind === 'unfurl') {
          U.uMix.value = G.easeOut(clamp(trans.t / 0.42, 0, 1));
          U.uMisc.value.y = 0.07 * (1 - k);
          var sp = clamp((trans.t - 0.3) / 0.25, 0, 1);
          U.uMisc.value.x = 0.035 * Math.sin(sp * Math.PI) * (1 - sp * 0.3);
        } else if (trans.kind === 'drop') {
          U.uMix.value = G.easeInOut(k); U.uMisc.value.y = 0.025 * (1 - k);
        } else if (trans.kind === 'pull') {
          var e = k * k;
          U.uMisc.value.z = trans.dir * 1.5 * e;
          if (U.uStA.value === ST_HUNG) U.uHung.value.w = -trans.dir * 0.12 * Math.sin(k * Math.PI);
        } else {
          U.uMix.value = G.easeInOut(k);
        }
        if (k >= 1) endTrans();
      }
      // 持ち上げ: 引きずる向き
      if (self.mode === 'lift' && liftHas) {
        var lp = U.uLift.value, vx = (lp.x - liftPrev.x) / Math.max(dt, 1e-3), vz = (lp.z - liftPrev.z) / Math.max(dt, 1e-3);
        if (vx * vx + vz * vz > 0.04) liftHeadT = clamp(Math.atan2(-vx, -vz), -0.6, 0.6);
        liftHead = G.damp(liftHead, liftHeadT, 3, dt); lp.w = liftHead;
        liftPrev.set(lp.x, lp.y, lp.z);
      }
      // つるしのゆれ
      if (self.mode === 'hung' && !(trans && trans.kind === 'pull')) {
        swingV += (-26 * swingA - 2.2 * swingV) * dt; swingA += swingV * dt;
        U.uHung.value.w = swingA; U.uSwing2.value = -swingV * 0.03;
      }
      // 仕上がった領域の残りを消す
      var changed = false;
      for (var r = 0; r < 5; r++) {
        if (finishing[r] > 0) {
          finishing[r] -= dt;
          var f = finishing[r] <= 0 ? 0 : Math.exp(-dt * 9);
          for (var i = 0; i < amt.length; i++) if (regionOf[i] === r && amt[i] > 0) { amt[i] *= f; if (amt[i] < 0.01) amt[i] = 0; }
          changed = true;
        }
        // 形が決まるバネ
        var tgt = self.regions[r].done ? 1 : 0;
        if (tgt === 1 && finishing[r] > 0.35) tgt = 0;
        shapeV[r] += ((tgt - shape[r]) * 120 - shapeV[r] * 11) * dt; shape[r] += shapeV[r] * dt;
        if (tgt === 0 && shape[r] < 0) { shape[r] = 0; shapeV[r] = 0; }
      }
      if (changed) { recomputeRegions(); maskDirty = true; }
      // 乾く
      if (wetActive) {
        wetTimer += dt;
        if (wetTimer > 0.066) {
          var dec = Math.exp(-wetTimer / 1.7), mx = 0;
          for (var w = 0; w < wet.length; w++) { if (wet[w] > 0) { wet[w] *= dec; if (wet[w] < 0.01) wet[w] = 0; if (wet[w] > mx) mx = wet[w]; } }
          wetTimer = 0; maskDirty = true;
          if (mx === 0) wetActive = false;
        }
      }
      if (maskDirty) writeMask();
      // 光
      glow = G.damp(glow, glowT, 6, dt); U.uGlow.value = glow * (0.85 + 0.15 * Math.sin((t || 0) * 3.2));
      if (sheenT >= 0) {
        sheenT += dt;
        var sk = sheenT / 0.9;
        U.uSheen.value.set(-0.55 + sk * 1.1, Math.sin(clamp(sk, 0, 1) * Math.PI));
        if (sk >= 1) { sheenT = -1; U.uSheen.value.set(-9, 0); }
      }
      applyUniforms();
      // 芯と接地影
      var st = curState(), wHeap = 0, wFlat = 0;
      var mA = 1 - U.uMix.value, mB = U.uMix.value;
      if (U.uStA.value === ST_HEAP) wHeap += mA; if (U.uStB.value === ST_HEAP && U.uMix.value > 0) wHeap += mB;
      if (U.uStA.value === ST_FLAT) wFlat += mA; if (U.uStB.value === ST_FLAT && U.uMix.value > 0) wFlat += mB;
      if (trans && trans.kind === 'unfurl') wHeap = 1 - clamp(trans.t / 0.16, 0, 1);
      core.visible = wHeap > 0.01 && self.mode !== 'gone';
      if (core.visible) {
        var hp = U.uHeap.value, cs = Math.pow(wHeap, 0.6);
        core.position.set(hp.x, hp.y, hp.z); core.rotation.y = hp.w; core.scale.set(cs, cs, cs);
      }
      heapShadow.visible = wHeap > 0.01;
      if (heapShadow.visible) { heapShadow.position.set(U.uHeap.value.x, U.uHeap.value.y + 0.002, U.uHeap.value.z); heapShadow.material.opacity = 0.55 * wHeap; }
      shadowPlane.visible = wFlat > 0.01 && U.uMisc.value.z === 0;
      shadowPlane.material.opacity = 0.42 * Math.pow(wFlat, 3);
      void st;
    };

    self._uniforms = U;
    self.reset(0);
    return self;
  };
})();

/* iron.js */
/* iron.js — コードレスのスチームアイロン、充電台、湯気
   G.createIron(ctx) / G.createSteam(ctx)
   アイロンのローカル原点 = かけ面中心の底。先端が -Z、本体が +Y。 */
(function () {
  'use strict';
  var G = window.G;
  var DEG = Math.PI / 180;
  var TILT = 12 * DEG;           // 台の上で先端を上げる角度
  var REST_PITCH = -94 * DEG;    // かかと立ち（かけ面がカメラ側を向く）
  var HEEL = 0.15;               // かけ面中心からかかとまで

  // ---------------------------------------------------------------- 形の道具
  function ironShape() {
    var s = new THREE.Shape();
    s.moveTo(0, 0.15);
    s.lineTo(0.040, 0.15);
    s.bezierCurveTo(0.067, 0.15, 0.075, 0.141, 0.075, 0.113);
    s.bezierCurveTo(0.076, 0.010, 0.036, -0.098, 0.0, -0.15);
    s.bezierCurveTo(-0.036, -0.098, -0.076, 0.010, -0.075, 0.113);
    s.bezierCurveTo(-0.075, 0.141, -0.067, 0.15, -0.040, 0.15);
    s.closePath();
    return s;
  }
  // しずく形の輪郭（x,z の組）。n 点、閉じた輪
  function ironOutline(n) {
    var pts = ironShape().getSpacedPoints(n), out = [];
    for (var i = 0; i < n; i++) out.push({ x: pts[i].x, z: pts[i].y });
    return out;
  }
  // 角丸長方形の輪郭（点数は大きさに依らず一定）
  function rrectOutline(hx, hz, r, nC, nX, nZ) {
    var out = [], k, a;
    var cx = hx - r, cz = hz - r;
    function seg(x0, z0, x1, z1, n) { for (k = 0; k < n; k++) { var t = k / n; out.push({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t }); } }
    function arc(ox, oz, a0) { for (k = 0; k < nC; k++) { a = a0 + (k / nC) * Math.PI / 2; out.push({ x: ox + r * Math.cos(a), z: oz + r * Math.sin(a) }); } }
    seg(hx, -cz, hx, cz, nZ); arc(cx, cz, 0);
    seg(cx, hz, -cx, hz, nX); arc(-cx, cz, Math.PI / 2);
    seg(-hx, cz, -hx, -cz, nZ); arc(-cx, -cz, Math.PI);
    seg(-cx, -hz, cx, -hz, nX); arc(cx, -cz, Math.PI * 1.5);
    return out;
  }

  // 輪（各 M 点、下から上へ）を張ってなめらかな殻にする
  // opt: { group(r,j)->int, capTop:int|undefined, capBottom:int|undefined, capLift }
  function loftGeometry(rings, M, opt) {
    opt = opt || {};
    var R = rings.length, i, j, r;
    var r0 = rings[0], cx = 0, cz = 0;
    for (j = 0; j < M; j++) { cx += r0[j * 3]; cz += r0[j * 3 + 2]; }
    cx /= M; cz /= M;
    var sum = 0;
    for (j = 0; j < M; j++) {
      var jn = (j + 1) % M;
      var dx = r0[jn * 3] - r0[j * 3], dz = r0[jn * 3 + 2] - r0[j * 3 + 2];
      sum += (-dz) * (r0[j * 3] - cx) + dx * (r0[j * 3 + 2] - cz);
    }
    var flip = sum < 0;
    var pos = [];
    for (r = 0; r < R; r++) for (j = 0; j < M * 3; j++) pos.push(rings[r][j]);
    var groups = [];
    function addTri(g, a, b, c) { (groups[g] = groups[g] || []).push(a, b, c); }
    for (r = 0; r < R - 1; r++) {
      for (j = 0; j < M; j++) {
        var a = r * M + j, b = r * M + (j + 1) % M, c = (r + 1) * M + j, d = (r + 1) * M + (j + 1) % M;
        var g = opt.group ? opt.group(r, j) : 0;
        if (!flip) { addTri(g, a, b, c); addTri(g, b, d, c); }
        else { addTri(g, a, c, b); addTri(g, b, c, d); }
      }
    }
    function cap(ring, g, wantUp, lift) {
      var base = pos.length / 3, mx = 0, my = 0, mz = 0;
      for (j = 0; j < M; j++) { mx += ring[j * 3]; my += ring[j * 3 + 1]; mz += ring[j * 3 + 2]; }
      pos.push(mx / M, my / M + (lift || 0), mz / M);
      for (j = 0; j < M * 3; j++) pos.push(ring[j]);
      // 向きの判定
      var ny = 0;
      for (j = 0; j < M; j++) {
        var p = base + 1 + j, q = base + 1 + (j + 1) % M;
        var ax = pos[p * 3] - pos[base * 3], az = pos[p * 3 + 2] - pos[base * 3 + 2];
        var bx = pos[q * 3] - pos[base * 3], bz = pos[q * 3 + 2] - pos[base * 3 + 2];
        ny += az * bx - ax * bz;
      }
      var sw = (ny > 0) !== wantUp;
      for (j = 0; j < M; j++) {
        var p1 = base + 1 + j, q1 = base + 1 + (j + 1) % M;
        if (!sw) addTri(g, base, p1, q1); else addTri(g, base, q1, p1);
      }
    }
    if (opt.capTop !== undefined) cap(rings[R - 1], opt.capTop, true, opt.capLift);
    if (opt.capBottom !== undefined) cap(rings[0], opt.capBottom, false, 0);
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    var index = [], start = 0;
    for (i = 0; i < groups.length; i++) {
      if (!groups[i]) continue;
      for (j = 0; j < groups[i].length; j++) index.push(groups[i][j]);
      geo.addGroup(start, groups[i].length, i);
      start += groups[i].length;
    }
    geo.setIndex(index);
    geo.computeVertexNormals();
    return geo;
  }

  // 輪郭 + 断面の手順 (s, y, ...) から輪を作る
  function makeRings(outline, profile, fn) {
    var rings = [], M = outline.length;
    for (var r = 0; r < profile.length; r++) {
      var a = new Float32Array(M * 3);
      for (var j = 0; j < M; j++) fn(a, j, outline[j], profile[r], r);
      rings.push(a);
    }
    return rings;
  }
  function splineProfile(pts, n) {
    var v = [];
    for (var i = 0; i < pts.length; i++) v.push(new THREE.Vector2(pts[i][0], pts[i][1]));
    return new THREE.SplineCurve(v).getPoints(n - 1).map(function (p) { return [p.x, p.y]; });
  }

  // 断面が楕円（やや四角）の曲線スイープ。曲線は YZ 平面内
  function sweepGeometry(curve, S, C, hwFn, hhFn, groupFn) {
    var pos = [], P = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3(1, 0, 0), N = new THREE.Vector3();
    for (var i = 0; i <= S; i++) {
      var u = i / S;
      curve.getPointAt(u, P); curve.getTangentAt(u, T);
      N.crossVectors(T, B).normalize();
      var hw = hwFn(u), hh = hhFn(u);
      for (var k = 0; k < C; k++) {
        var th = k / C * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        var cx = (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 0.75) * hw;
        var sn = (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), 0.75) * hh;
        pos.push(P.x + cx, P.y + N.y * sn, P.z + N.z * sn);
      }
    }
    var groups = [];
    // 向きの判定（最初の三角形の法線が外向きか）
    function v3(i) { return new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
    var a0 = v3(0), b0 = v3(1), c0 = v3(C);
    var nrm = new THREE.Vector3().subVectors(b0, a0).cross(new THREE.Vector3().subVectors(c0, a0));
    curve.getPointAt(0, P);
    var flip = nrm.dot(new THREE.Vector3().subVectors(a0, P)) < 0;
    for (i = 0; i < S; i++) {
      var g = groupFn ? groupFn((i + 0.5) / S) : 0;
      for (k = 0; k < C; k++) {
        var a = i * C + k, b = i * C + (k + 1) % C, c2 = (i + 1) * C + k, d = (i + 1) * C + (k + 1) % C;
        var L = (groups[g] = groups[g] || []);
        if (!flip) L.push(a, b, c2, b, d, c2); else L.push(a, c2, b, b, c2, d);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    var index = [], start = 0;
    for (i = 0; i < groups.length; i++) {
      if (!groups[i]) continue;
      for (var q = 0; q < groups[i].length; q++) index.push(groups[i][q]);
      geo.addGroup(start, groups[i].length, i); start += groups[i].length;
    }
    geo.setIndex(index);
    geo.computeVertexNormals();
    return geo;
  }

  // ---------------------------------------------------------------- テクスチャ
  // かけ面: ステンレス地 + スチーム穴（256x512 が x∈[-0.08,0.08], z∈[-0.16,0.16]）
  function soleTexture(outline, aniso) {
    var W = 256, H = 512, c = G.makeCanvas(W, H), g = c.getContext('2d');
    function px(x) { return (x / 0.16 + 0.5) * W; }
    function pz(z) { return (z / 0.32 + 0.5) * H; }
    g.fillStyle = '#c9cdd1'; g.fillRect(0, 0, W, H);
    var rnd = G.rng(77), i;
    // 細いヘアライン
    for (i = 0; i < 500; i++) {
      var y = rnd() * H, l = 20 + rnd() * 120, x0 = rnd() * W;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(90,95,100,0.05)';
      g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + l, y + (rnd() - 0.5) * 2); g.stroke();
    }
    // 縁に沿ったゆるい面取りの帯
    function path(sc, dz) {
      g.beginPath();
      for (var j = 0; j < outline.length; j++) {
        var o = outline[j], X = px(o.x * sc), Z = pz(o.z * sc + (dz || 0));
        if (j === 0) g.moveTo(X, Z); else g.lineTo(X, Z);
      }
      g.closePath();
    }
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.18)'; path(0.9); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(60,64,68,0.16)'; path(0.55, 0.01); g.stroke();
    function hole(x, z, r) {
      var X = px(x), Z = pz(z), R = r * 1600;
      g.fillStyle = 'rgba(235,238,240,0.9)'; g.beginPath(); g.arc(X, Z, R + 1.6, 0, 6.2832); g.fill();
      var gr = g.createRadialGradient(X - R * 0.2, Z - R * 0.2, 0, X, Z, R);
      gr.addColorStop(0, '#24282c'); gr.addColorStop(0.75, '#3a3f44'); gr.addColorStop(1, '#6c7277');
      g.fillStyle = gr; g.beginPath(); g.arc(X, Z, R, 0, 6.2832); g.fill();
    }
    // 輪郭に沿った2列（等間隔に置く）
    function row(sc, step, r, zMax) {
      var acc = step * 0.5, prev = null;
      for (var j = 0; j <= outline.length; j++) {
        var o = outline[j % outline.length], p = { x: o.x * sc, z: o.z * sc };
        if (prev) {
          var d = Math.hypot(p.x - prev.x, p.z - prev.z); acc += d;
          if (acc >= step) { acc -= step; if (p.z < zMax) hole(p.x, p.z, r); }
        }
        prev = p;
      }
    }
    row(0.86, 0.0135, 0.0021, 0.115);
    row(0.70, 0.0150, 0.0019, 0.09);
    // 先端の集まり
    for (i = 0; i < 4; i++) for (var k = 0; k <= i; k++) {
      hole((k - i / 2) * 0.011, -0.098 + i * 0.010, 0.0017);
    }
    var t = G.canvasTexture(c, { srgb: true, aniso: aniso || 4 });
    return t;
  }

  // 湯気のかたまり（2x2 のアトラス。ゆらいだ縁のやわらかい丸）
  var _puff = null;
  function puffTexture() {
    if (_puff) return _puff;
    var S = 256, c = G.makeCanvas(S, S), g = c.getContext('2d');
    var img = g.createImageData(S, S), d = img.data;
    for (var cy = 0; cy < 2; cy++) for (var cx = 0; cx < 2; cx++) {
      var cell = cy * 2 + cx;
      for (var y = 0; y < 128; y++) for (var x = 0; x < 128; x++) {
        var nx = (x - 63.5) / 64, ny = (y - 63.5) / 64;
        var r = Math.sqrt(nx * nx + ny * ny);
        var n1 = G.fbm2(nx * 1.8 + cell * 5.3, ny * 1.8 + cell * 2.1, 4, cell * 7 + 1);
        var rr = r * (0.9 + 0.9 * (n1 - 0.5));
        var base = Math.pow(G.clamp(1 - rr, 0, 1), 0.9);
        var n2 = G.fbm2(nx * 4.2 + cell * 3.7, ny * 4.2 - cell, 4, cell * 13 + 5);
        var a = base * (0.55 + 0.9 * n2) * G.smooth(1.0, 0.8, r);
        var o = ((cy * 128 + y) * S + cx * 128 + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(G.clamp(a, 0, 1) * 255);
      }
    }
    g.putImageData(img, 0, 0);
    _puff = new THREE.CanvasTexture(c);
    _puff.colorSpace = THREE.SRGBColorSpace;
    return _puff;
  }

  // ================================================================ 湯気
  G.createSteam = function (ctx) {
    var N = ctx.lowPower ? 130 : 260;
    var pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    var age = new Float32Array(N), life = new Float32Array(N), s0 = new Float32Array(N), s1 = new Float32Array(N);
    var a0 = new Float32Array(N), seed = new Float32Array(N), spin = new Float32Array(N), alive = new Uint8Array(N);
    var aSize = new Float32Array(N), aAlpha = new Float32Array(N), aRot = new Float32Array(N), aCell = new Float32Array(N);
    var free = new Int32Array(N), nFree = N, i;
    for (i = 0; i < N; i++) { free[i] = N - 1 - i; pos[i * 3 + 1] = -100; }
    var cursor = 0;
    var geo = new THREE.BufferGeometry();
    var pa = new THREE.BufferAttribute(pos, 3); pa.setUsage(THREE.DynamicDrawUsage);
    var sa = new THREE.BufferAttribute(aSize, 1); sa.setUsage(THREE.DynamicDrawUsage);
    var al = new THREE.BufferAttribute(aAlpha, 1); al.setUsage(THREE.DynamicDrawUsage);
    var ro = new THREE.BufferAttribute(aRot, 1); ro.setUsage(THREE.DynamicDrawUsage);
    var ce = new THREE.BufferAttribute(aCell, 1); ce.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa); geo.setAttribute('aSize', sa); geo.setAttribute('aAlpha', al);
    geo.setAttribute('aRot', ro); geo.setAttribute('aCell', ce);
    var mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: puffTexture() }, uScale: { value: 800 } },
      vertexShader: [
        'attribute float aSize; attribute float aAlpha; attribute float aRot; attribute float aCell;',
        'uniform float uScale;',
        'varying float vAlpha; varying float vRot; varying float vCell;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = aAlpha > 0.0 ? aSize * uScale / max(0.05, -mv.z) : 0.0;',
        '  vAlpha = aAlpha; vRot = aRot; vCell = aCell;',
        '}'].join('\n'),
      fragmentShader: [
        'uniform sampler2D uMap;',
        'varying float vAlpha; varying float vRot; varying float vCell;',
        'void main(){',
        '  vec2 p = gl_PointCoord - 0.5;',
        '  float c = cos(vRot), s = sin(vRot);',
        '  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);',
        '  vec2 uv = p + 0.5;',
        '  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);',
        '  uv = clamp(uv, 0.01, 0.99);',
        '  vec2 off = vec2(mod(vCell, 2.0), floor(vCell / 2.0)) * 0.5;',
        '  float a = texture2D(uMap, off + uv * 0.5).a * vAlpha * inside;',
        '  if (a < 0.004) discard;',
        '  float r = length(p) * 2.0;',
        '  vec3 col = mix(vec3(1.0), vec3(0.86, 0.885, 0.91), smoothstep(0.15, 0.95, r));',
        '  gl_FragColor = vec4(col, a);',
        '}'].join('\n'),
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 10;
    var rnd = G.rng(4242), t = 0, bufSize = new THREE.Vector2();

    var api = { points: points, count: 0 };
    var hadAlive = true;
    function take() {
      if (nFree > 0) return free[--nFree];
      // 空きがない: 古い順に上書き
      var k = cursor; cursor = (cursor + 1) % N;
      if (alive[k]) { alive[k] = 0; api.count--; }
      return k;
    }
    function spawn(x, y, z, vx, vy, vz, sz0, sz1, lf, alpha) {
      var k = take();
      alive[k] = 1; api.count++;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      vel[k * 3] = vx; vel[k * 3 + 1] = vy; vel[k * 3 + 2] = vz;
      age[k] = 0; life[k] = Math.max(0.2, lf); s0[k] = sz0; s1[k] = sz1; a0[k] = alpha;
      seed[k] = rnd(); spin[k] = (rnd() - 0.5) * 1.2;
      aCell[k] = Math.floor(rnd() * 4); aRot[k] = seed[k] * 6.2832;
      return k;
    }
    api._spawn = spawn;
    api.emit = function (x, y, z, vx, vy, vz, size, lf, alpha) {
      size = size || 0.1;
      spawn(x, y, z, vx || 0, vy || 0, vz || 0, size * 0.3, size, lf || 1.4, alpha === undefined ? 0.32 : alpha);
    };
    api.burst = function (x, y, z, strength) {
      var s = G.clamp(strength === undefined ? 1 : strength, 0, 1);
      var n = Math.round(10 + 30 * s);
      for (var q = 0; q < n; q++) {
        var a = rnd() * Math.PI * 2, rad = 0.04 + rnd() * 0.09;
        var sp = (0.25 + rnd() * 0.55) * (0.5 + 0.5 * s);
        var ca = Math.cos(a), sa2 = Math.sin(a);
        spawn(x + ca * rad, y + rnd() * 0.02, z + sa2 * rad,
          ca * sp, 0.08 + rnd() * 0.25, sa2 * sp,
          0.05 + rnd() * 0.04, (0.18 + rnd() * 0.18) * (0.6 + 0.4 * s), 1.3 + rnd() * 1.1, 0.34 + 0.2 * s);
      }
    };
    api.update = function (dt) {
      if (!(dt > 0)) dt = 0;
      t += dt;
      var kRel = 1 - Math.exp(-2.4 * dt);
      for (var k = 0; k < N; k++) {
        if (!alive[k]) { aAlpha[k] = 0; continue; }
        age[k] += dt;
        var f = age[k] / life[k];
        if (f >= 1) {
          alive[k] = 0; api.count--; aAlpha[k] = 0; pos[k * 3 + 1] = -100;
          free[nFree++] = k; continue;
        }
        var o = k * 3, px = pos[o], py = pos[o + 1], pz = pos[o + 2], sd = seed[k] * 17.0;
        // ゆらぎ + 浮力: 速度が「ゆっくり上がる流れ」へ緩む
        var tx = 0.055 * Math.sin(1.3 * t + sd + py * 9.0) + 0.035 * Math.sin(2.7 * t + sd * 1.7 + pz * 7.0);
        var tz = 0.055 * Math.cos(1.1 * t + sd * 1.3 + py * 8.0) + 0.035 * Math.sin(2.3 * t + sd * 0.7 + px * 7.0);
        var rise = 0.09 + 0.22 * f;
        vel[o] += (tx - vel[o]) * kRel;
        vel[o + 1] += (rise - vel[o + 1]) * kRel;
        vel[o + 2] += (tz - vel[o + 2]) * kRel;
        pos[o] = px + vel[o] * dt; pos[o + 1] = py + vel[o + 1] * dt; pos[o + 2] = pz + vel[o + 2] * dt;
        var g = 1 - (1 - f) * (1 - f);
        aSize[k] = s0[k] + (s1[k] - s0[k]) * g;
        aAlpha[k] = a0[k] * G.smooth(0, 0.12, f) * Math.pow(1 - f, 1.4);
        aRot[k] += spin[k] * dt;
      }
      // 粒が無い間は GPU へ送り直さない（最後の 1 回で全部 alpha 0 を送ってある）
      if (api.count > 0 || hadAlive) { pa.needsUpdate = sa.needsUpdate = al.needsUpdate = ro.needsUpdate = ce.needsUpdate = true; }
      hadAlive = api.count > 0;
      points.visible = hadAlive || api.count > 0;
      var cam = ctx.camera;
      if (ctx.renderer && cam && cam.isPerspectiveCamera) {
        ctx.renderer.getDrawingBufferSize(bufSize);
        mat.uniforms.uScale.value = bufSize.y / (2 * Math.tan(cam.fov * DEG / 2));
      }
    };
    return api;
  };

  // ================================================================ アイロン + 充電台
  G.createIron = function (ctx) {
    var aniso = ctx.aniso || 4;
    var M = 128;
    var outline = ironOutline(M);
    var group = new THREE.Group(); group.name = 'iron';
    var body = new THREE.Group(); group.add(body);

    // ---- 素材
    var matWhite = new THREE.MeshPhysicalMaterial({ color: 0xf6f6f3, roughness: 0.3, metalness: 0,
      clearcoat: 0.7, clearcoatRoughness: 0.14, side: THREE.DoubleSide });
    var matTank = new THREE.MeshPhysicalMaterial({ color: 0x3db7c0, roughness: 0.1, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
    var matWater = new THREE.MeshStandardMaterial({ color: 0x2f9fae, roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false });
    var matGrip = new THREE.MeshStandardMaterial({ color: 0x80878d, roughness: 0.78, metalness: 0 });
    var matMetal = new THREE.MeshStandardMaterial({ color: 0xd8dbde, roughness: 0.26, metalness: 0.8 });
    var matSole = new THREE.MeshStandardMaterial({ color: 0xffffff, map: soleTexture(outline, aniso), roughness: 0.32, metalness: 0.55 });
    var matDark = new THREE.MeshStandardMaterial({ color: 0x8e959b, roughness: 0.45 });
    var matAccent = new THREE.MeshPhysicalMaterial({ color: 0x3aa5b1, roughness: 0.3, clearcoat: 0.6 });
    var matLamp = new THREE.MeshStandardMaterial({ color: 0x302820, emissive: 0xffa040, emissiveIntensity: 1.2, roughness: 0.3 });

    // ---- かけ面（ステンレス）
    var soleProf = [[0.965, 0.0], [0.99, 0.0012], [1.0, 0.003], [1.0, 0.0085], [0.99, 0.0105], [0.975, 0.0113]];
    var soleRings = makeRings(outline, soleProf, function (a, j, o, p) {
      a[j * 3] = o.x * p[0]; a[j * 3 + 1] = p[1]; a[j * 3 + 2] = o.z * p[0];
    });
    var soleMesh = new THREE.Mesh(loftGeometry(soleRings, M, { capTop: 0 }), matMetal);
    body.add(soleMesh);
    // 底面（穴の模様）
    (function () {
      var p = [0, 0, 0], uv = [0.5, 0.5], idx = [], sc = soleProf[0][0];
      for (var j = 0; j < M; j++) {
        var x = outline[j].x * sc, z = outline[j].z * sc;
        p.push(x, 0, z); uv.push(x / 0.16 + 0.5, 0.5 - z / 0.32);
      }
      for (j = 0; j < M; j++) idx.push(0, 1 + j, 1 + (j + 1) % M);
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // 下向きにそろえる
      if (g.attributes.normal.getY(0) > 0) { idx = []; for (j = 0; j < M; j++) idx.push(0, 1 + (j + 1) % M, 1 + j); g.setIndex(idx); g.computeVertexNormals(); }
      body.add(new THREE.Mesh(g, matSole));
    })();

    // ---- 本体の殻（白 + 前の水色タンク）
    var bodyProf = splineProfile([[0.972, 0.0095], [0.988, 0.014], [0.99, 0.020], [0.982, 0.028], [0.962, 0.037],
      [0.925, 0.046], [0.87, 0.054], [0.79, 0.061], [0.69, 0.066], [0.57, 0.070], [0.43, 0.0728], [0.28, 0.0742], [0.14, 0.0748]], 26);
    function bodyXZ(a, j, o, s) {
      var sz = 1 - (1 - s) * 0.8, zc = 0.014 * (1 - s);
      a[j * 3] = o.x * s; a[j * 3 + 2] = o.z * sz + zc;
    }
    // 先端ほど低く（鼻先がすっと下がる）
    function noseH(z) { return 0.6 + 0.4 * G.smooth(-0.15, 0.06, z); }
    var bodyRings = makeRings(outline, bodyProf, function (a, j, o, p) {
      bodyXZ(a, j, o, p[0]); a[j * 3 + 1] = 0.0095 + (p[1] - 0.0095) * noseH(o.z);
    });
    var TANK_Z = -0.02;
    var bodyGeo = loftGeometry(bodyRings, M, {
      capTop: 0, capLift: 0.0012,
      group: function (r, j) { return (r >= 1 && outline[j].z < TANK_Z) ? 1 : 0; }
    });
    var bodyMesh = new THREE.Mesh(bodyGeo, [matWhite, matTank]);
    bodyMesh.renderOrder = 2;
    body.add(bodyMesh);
    // 中の水
    (function () {
      var prof = [];
      for (var r = 0; r < bodyProf.length; r++) if (bodyProf[r][1] <= 0.047) prof.push(bodyProf[r]);
      // 本体の輪 r の、ある z での半幅
      function halfW(ring, z) {
        var best = 0;
        for (var j = 0; j < M; j++) {
          var jn = (j + 1) % M, x0 = ring[j * 3], z0 = ring[j * 3 + 2], x1 = ring[jn * 3], z1 = ring[jn * 3 + 2];
          if ((z0 - z) * (z1 - z) <= 0 && z0 !== z1) {
            var xx = Math.abs(x0 + (x1 - x0) * (z - z0) / (z1 - z0));
            if (xx > best) best = xx;
          }
        }
        return best;
      }
      var rings = makeRings(outline, prof, function (a, j, o, p, r) {
        bodyXZ(a, j, o, p[0]);
        var z = Math.min(a[j * 3 + 2], TANK_Z + 0.002);
        var lim = halfW(bodyRings[Math.min(r + 1, bodyRings.length - 1)], z) * 0.9;
        a[j * 3] = G.clamp(a[j * 3] * 0.92, -lim, lim);
        a[j * 3 + 2] = Math.max(z, -0.135);
        a[j * 3 + 1] = Math.max(0.0095 + (p[1] - 0.0095) * noseH(z) * 0.85, 0.0125);
      });
      var w = new THREE.Mesh(loftGeometry(rings, M, { capTop: 0 }), matWater);
      w.renderOrder = 1;
      body.add(w);
    })();

    // ---- 取っ手（前後で本体につながるアーチ。上はグレーのグリップ）
    var hCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.048, -0.090), new THREE.Vector3(0, 0.094, -0.082), new THREE.Vector3(0, 0.130, -0.060),
      new THREE.Vector3(0, 0.146, -0.022), new THREE.Vector3(0, 0.148, 0.030), new THREE.Vector3(0, 0.141, 0.074),
      new THREE.Vector3(0, 0.118, 0.104), new THREE.Vector3(0, 0.086, 0.117), new THREE.Vector3(0, 0.052, 0.121)
    ], false, 'centripetal');
    function flare(u) { return G.smooth(0.22, 0.0, u) * 0.6 + G.smooth(0.70, 1.0, u) * 1.2; }
    var hGeo = sweepGeometry(hCurve, 64, 24,
      function (u) { return 0.0145 + flare(u) * 0.011; },
      function (u) { return 0.0115 + flare(u) * 0.010; },
      function (u) { return (u > 0.24 && u < 0.76) ? 1 : 0; });
    body.add(new THREE.Mesh(hGeo, [matWhite, matGrip]));

    // 取っ手の上のスチームボタン
    (function () {
      var u = 0.2, P = hCurve.getPointAt(u), T = hCurve.getTangentAt(u), B = new THREE.Vector3(1, 0, 0);
      var N = new THREE.Vector3().crossVectors(T, B).normalize();
      var hh = 0.0115 + flare(u) * 0.010;
      var btn = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), matAccent);
      btn.scale.set(0.0105, 0.0045, 0.015);
      btn.position.copy(P).addScaledVector(N, hh * 0.92);
      btn.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(B, N, T));
      body.add(btn);
    })();

    // 本体の上にのせる部品（レイで表面を探して置く）
    body.updateMatrixWorld(true);
    var rc = new THREE.Raycaster();
    function surfaceAt(x, z) {
      rc.set(new THREE.Vector3(x, 0.3, z), new THREE.Vector3(0, -1, 0));
      var h = rc.intersectObject(bodyMesh, false)[0];
      if (!h) return { p: new THREE.Vector3(x, 0.07, z), n: new THREE.Vector3(0, 1, 0) };
      var n = h.face.normal.clone(); if (n.y < 0) n.negate();
      return { p: h.point, n: n };
    }
    function placeOn(mesh, x, z, lift) {
      var s = surfaceAt(x, z);
      mesh.position.copy(s.p).addScaledVector(s.n, lift || 0);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.n);
      body.add(mesh);
    }
    // 温度ダイヤル
    var dial = new THREE.Group();
    var dialBase = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.024, 0.003, 48), matWhite);
    dialBase.position.y = 0.0005; dial.add(dialBase);
    var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.019, 0.007, 40), matDark);
    knob.position.y = 0.004; dial.add(knob);
    var grip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.004, 0.0055), matDark);
    grip.position.y = 0.009; grip.rotation.y = 0.5; dial.add(grip);
    var pointer = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.0012, 0.0022), matAccent);
    pointer.position.set(0.010, 0.0112, 0); pointer.rotation.y = 0.5;
    pointer.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5); dial.add(pointer);
    placeOn(dial, 0, 0.028, 0);
    // 表示ランプ
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), matLamp);
    lamp.scale.set(0.0042, 0.0018, 0.0042);
    placeOn(lamp, 0.034, 0.072, 0.0002);
    // 給水口のふた
    var lid = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), matWhite);
    lid.scale.set(0.014, 0.0028, 0.011);
    placeOn(lid, 0, -0.112, 0.0003);

    body.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // ================================================================ 充電台
    var stand = new THREE.Group(); stand.name = 'ironStand';
    stand.position.set(G.L.stand.x, 0, G.L.stand.z);
    var matStand = new THREE.MeshPhysicalMaterial({ color: 0xd9dbdb, roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    var matCradle = new THREE.MeshPhysicalMaterial({ color: 0x9ea4a9, roughness: 0.5, clearcoat: 0.2, emissive: 0xfff2d6, emissiveIntensity: 0 });
    var matStandLamp = new THREE.MeshStandardMaterial({ color: 0x202020, emissive: 0x7dff9a, emissiveIntensity: 1.4, roughness: 0.25 });
    var BASE_TOP = 0.020, HEEL_Y = 0.022, HEEL_Z = 0.115;
    var tanT = Math.tan(TILT);
    // 土台
    (function () {
      var prof = [[0.004, 0], [0.0, 0.003], [0.0, 0.013], [0.0025, 0.0185], [0.007, BASE_TOP]];
      var rings = [];
      for (var r = 0; r < prof.length; r++) {
        var d = prof[r][0], ol = rrectOutline(0.095 - d, 0.17 - d, 0.055 - d, 10, 10, 18), a = new Float32Array(ol.length * 3);
        for (var j = 0; j < ol.length; j++) { a[j * 3] = ol[j].x; a[j * 3 + 1] = prof[r][1]; a[j * 3 + 2] = ol[j].z; }
        rings.push(a);
      }
      stand.add(new THREE.Mesh(loftGeometry(rings, rings[0].length / 3, { capTop: 0 }), matStand));
    })();
    // 受け（アイロンの形の台。上面が 12° 傾く）
    var ORIGIN_Z = HEEL_Z - HEEL * Math.cos(TILT), ORIGIN_Y = HEEL_Y + HEEL * Math.sin(TILT);
    function planeY(z) { return Math.max(BASE_TOP + 0.0015, HEEL_Y + (HEEL_Z - z) * tanT); }
    var cradle;
    (function () {
      var prof = [[1.04, 0.017, 0], [1.065, -0.006, 1], [1.06, -0.0018, 1], [1.04, -0.0008, 1]];
      var rings = makeRings(outline, prof, function (a, j, o, p) {
        var x = o.x * p[0], z = o.z * p[0] * Math.cos(TILT) + ORIGIN_Z;
        a[j * 3] = x; a[j * 3 + 2] = z;
        a[j * 3 + 1] = p[2] ? Math.max(BASE_TOP + 0.0006, planeY(z) + p[1]) : p[1];
      });
      cradle = new THREE.Mesh(loftGeometry(rings, M, { capTop: 0 }), matCradle);
      stand.add(cradle);
    })();
    // 後ろの箱（ランプ付き）
    (function () {
      var prof = [[0.0, BASE_TOP - 0.002], [0.0, 0.044], [0.0035, 0.0515], [0.009, 0.0548], [0.016, 0.0556]];
      var rings = [];
      for (var r = 0; r < prof.length; r++) {
        var d = prof[r][0], ol = rrectOutline(0.088 - d, 0.024 - d, 0.022 - d, 8, 12, 4), a = new Float32Array(ol.length * 3);
        for (var j = 0; j < ol.length; j++) { a[j * 3] = ol[j].x; a[j * 3 + 1] = prof[r][1]; a[j * 3 + 2] = ol[j].z + 0.144; }
        rings.push(a);
      }
      stand.add(new THREE.Mesh(loftGeometry(rings, rings[0].length / 3, { capTop: 0, capLift: 0.0006 }), matStand));
    })();
    var standLamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.018, 4, 12), matStandLamp);
    standLamp.rotation.z = Math.PI / 2;
    standLamp.position.set(0, 0.034, 0.168);
    stand.add(standLamp);
    var glowMat = new THREE.SpriteMaterial({ map: G.softDotTexture(), color: 0x7dff9a, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false });
    var glow = new THREE.Sprite(glowMat);
    glow.scale.set(0.05, 0.035, 1); glow.position.set(0, 0.034, 0.172);
    stand.add(glow);
    stand.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // ================================================================ 動き
    var DOCK = { x: G.L.stand.x, y: ORIGIN_Y, z: G.L.stand.z + ORIGIN_Z, pitch: TILT, yaw: 0, roll: 0 };
    var P = { x: DOCK.x, y: DOCK.y, z: DOCK.z, pitch: DOCK.pitch, yaw: 0, roll: 0 };
    var A = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };   // 移り変わりの始まり
    var Tg = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };  // 移り変わりの終わり / held の姿
    var REST = { x: 0, y: 0, z: 0, pitch: REST_PITCH, yaw: Math.PI, roll: 0 };
    var REST_LIFT = HEEL * Math.abs(Math.sin(REST_PITCH)) + 0.0008;
    function copyPose(d, s) { d.x = s.x; d.y = s.y; d.z = s.z; d.pitch = s.pitch; d.yaw = s.yaw; d.roll = s.roll; }
    function lerpPose(d, a, b, e) {
      d.x = a.x + (b.x - a.x) * e; d.y = a.y + (b.y - a.y) * e; d.z = a.z + (b.z - a.z) * e;
      d.pitch = a.pitch + (b.pitch - a.pitch) * e; d.yaw = a.yaw + (b.yaw - a.yaw) * e; d.roll = a.roll + (b.roll - a.roll) * e;
    }
    var tw = { on: false, t: 0, dur: 0.15, kind: '' };
    var sp = new THREE.Vector3(), spv = new THREE.Vector3(), tgt = new THREE.Vector3();
    var hYaw = 0, hPitch = 0, hRoll = 0;
    var dockCb = null;
    // 重ねる揺れ（ばね）: y, pitch, roll
    var oY = { x: 0, v: 0, k: 320, c: 11 }, oP = { x: 0, v: 0, k: 260, c: 8 }, oR = { x: 0, v: 0, k: 260, c: 8 };
    function stepOsc(o, dt) { o.v += (-o.k * o.x - o.c * o.v) * dt; o.x += o.v * dt; }

    var steam = null;
    var rnd = G.rng(99);
    var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), prevSole = new THREE.Vector3();
    var sphere = new THREE.Sphere(new THREE.Vector3(), 0.17);
    var colAmber = new THREE.Color(0xffa040), colGreen = new THREE.Color(0x7dff9a), colTmp = new THREE.Color();
    var invite = false, standInvite = false, inviteT = 0, inviteSign = 1, wispT = 1.2, standGlow = 0;
    var emitAcc = 0, firstFrame = true;
    // held の湯気の出口（かけ面の縁、先端側の左右）
    var EMIT = [
      { x: 0.050, z: -0.075, dx: 0.85, dz: -0.5, w: 0.32 }, { x: -0.050, z: -0.075, dx: -0.85, dz: -0.5, w: 0.32 },
      { x: 0.070, z: 0.005, dx: 1, dz: 0, w: 0.18 }, { x: -0.070, z: 0.005, dx: -1, dz: 0, w: 0.18 }
    ];
    var EMIT_W = 0; for (var ei = 0; ei < EMIT.length; ei++) EMIT_W += EMIT[ei].w;

    var iron = {
      group: group, stand: stand, mode: 'docked',
      sole: new THREE.Vector3(), vel: new THREE.Vector3(), speed: 0, steamLevel: 0
    };

    function applyPose() {
      group.position.set(P.x, P.y + oY.x, P.z);
      group.rotation.set(P.pitch + oP.x, P.yaw, P.roll + oR.x);
      group.updateMatrixWorld(true);
    }

    iron.attachSteam = function (s) { steam = s; };

    iron.grab = function () {
      if (iron.mode === 'held') return;
      var fromDock = iron.mode === 'docked' || iron.mode === 'docking';
      copyPose(A, P);
      var surfaceY = fromDock ? 0 : (iron.mode === 'rest' ? REST.y - REST_LIFT : P.y);
      sp.set(P.x, surfaceY, P.z); spv.set(0, 0, 0);
      tgt.copy(sp);
      hYaw = 0; hPitch = 0; hRoll = 0;
      tw.on = true; tw.t = 0; tw.dur = 0.15; tw.kind = 'grab';
      dockCb = null;
      iron.mode = 'held';
    };
    iron.moveTo = function (x, z, y) {
      tgt.set(x, y === undefined ? tgt.y : y, z);
    };
    iron.release = function () {
      if (iron.mode !== 'held') return;
      copyPose(A, P);
      REST.x = sp.x; REST.z = sp.z; REST.y = tgt.y + REST_LIFT;
      REST.pitch = REST_PITCH; REST.roll = 0;
      REST.yaw = P.yaw >= 0 ? Math.PI : -Math.PI;
      tw.on = true; tw.t = 0; tw.dur = 0.32; tw.kind = 'release';
      iron.mode = 'rest';
    };
    iron.dock = function (cb) {
      copyPose(A, P);
      dockCb = cb || null;
      tw.on = true; tw.t = 0; tw.dur = 0.85; tw.kind = 'dock';
      iron.mode = 'docking';
    };
    iron.setDocked = function () {
      tw.on = false; dockCb = null; copyPose(P, DOCK); iron.mode = 'docked';
      oY.x = oY.v = oP.x = oP.v = oR.x = oR.v = 0; firstFrame = true; applyPose();
    };
    iron.setRestAt = function (x, z, y) {
      tw.on = false; dockCb = null;
      REST.x = x; REST.z = z; REST.y = (y || 0) + REST_LIFT; REST.yaw = Math.PI; REST.pitch = REST_PITCH; REST.roll = 0;
      copyPose(P, REST); iron.mode = 'rest';
      oY.x = oY.v = oP.x = oP.v = oR.x = oR.v = 0; firstFrame = true; applyPose();
    };
    iron.bump = function (strength) {
      var s = strength === undefined ? 1 : strength;
      oY.v += 0.22 * s;
      oP.v += (rnd() - 0.3) * 2.2 * s;
      oR.v += (rnd() - 0.5) * 2.6 * s;
    };
    iron.setInvite = function (on) { invite = !!on; if (invite) inviteT = 1.6; };
    iron.setStandInvite = function (on) { standInvite = !!on; };
    iron.burst = function (strength) {
      if (!steam) return;
      steam.burst(iron.sole.x, iron.sole.y + 0.008, iron.sole.z, strength === undefined ? 1 : strength);
    };
    iron.hitTest = function (ray) {
      group.localToWorld(sphere.center.set(0, 0.07, 0));
      return ray.intersectsSphere(sphere);
    };
    iron.nearStand = function (x, z) {
      var dx = x - G.L.stand.x, dz = z - G.L.stand.z;
      return dx * dx + dz * dz < 0.24 * 0.24;
    };

    // ローカル点から湯気を1粒
    function puffLocal(lx, ly, lz, dx, dy, dz, spd, up, sz0, sz1, lf, alpha) {
      tmp.set(lx, ly, lz).applyMatrix4(group.matrixWorld);
      tmp2.set(dx, dy, dz).transformDirection(group.matrixWorld);
      steam._spawn(tmp.x, tmp.y, tmp.z, tmp2.x * spd, tmp2.y * spd + up, tmp2.z * spd, sz0, sz1, lf, alpha);
    }

    iron.update = function (dt, t) {
      if (!(dt > 0)) dt = 0;
      var e;
      // ---- 姿勢
      if (iron.mode === 'held') {
        // ばね追従（小さな刻みで安定に）
        var n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n, W = 30, Z = 0.82;
        for (var i = 0; i < n; i++) {
          spv.x += (W * W * (tgt.x - sp.x) - 2 * Z * W * spv.x) * h;
          spv.y += (W * W * (tgt.y - sp.y) - 2 * Z * W * spv.y) * h;
          spv.z += (W * W * (tgt.z - sp.z) - 2 * Z * W * spv.z) * h;
          sp.x += spv.x * h; sp.y += spv.y * h; sp.z += spv.z * h;
        }
        hYaw = G.damp(hYaw, G.clamp(-spv.x * 0.38, -25 * DEG, 25 * DEG), 9, dt);
        hPitch = G.damp(hPitch, G.clamp(spv.z * 0.035, -3 * DEG, 3 * DEG), 9, dt);
        hRoll = G.damp(hRoll, G.clamp(-spv.x * 0.035, -3 * DEG, 3 * DEG), 9, dt);
        Tg.x = sp.x; Tg.z = sp.z;
        Tg.y = sp.y + HEEL * Math.abs(Math.sin(hPitch)) + 0.075 * Math.abs(Math.sin(hRoll));
        Tg.pitch = hPitch; Tg.yaw = hYaw; Tg.roll = hRoll;
        if (tw.on && tw.kind === 'grab') {
          tw.t += dt; e = G.easeOut(tw.t / tw.dur);
          lerpPose(P, A, Tg, e);
          if (tw.t >= tw.dur) tw.on = false;
        } else { tw.on = false; copyPose(P, Tg); }
      } else if (iron.mode === 'rest') {
        if (tw.on && tw.kind === 'release') {
          tw.t += dt; var f = G.clamp(tw.t / tw.dur, 0, 1); e = G.easeInOut(f);
          lerpPose(P, A, REST, e);
          P.y += Math.sin(Math.PI * f) * 0.035;
          if (f >= 1) { tw.on = false; copyPose(P, REST); oP.v += 0.9; oY.v -= 0.06; }
        } else copyPose(P, REST);
      } else if (iron.mode === 'docking') {
        tw.t += dt; var f2 = G.clamp(tw.t / tw.dur, 0, 1); e = G.easeInOut(f2);
        lerpPose(P, A, DOCK, e);
        P.y += Math.sin(Math.PI * f2) * 0.11;
        if (f2 >= 1) {
          tw.on = false; copyPose(P, DOCK); iron.mode = 'docked'; oP.v -= 0.5; oY.v -= 0.05;
          var cb = dockCb; dockCb = null; if (cb) cb();
        }
      } else {
        copyPose(P, DOCK);
      }

      // ---- 手がかり: ときどき身じろぎ + ぷしゅ
      if (invite && (iron.mode === 'docked' || iron.mode === 'rest')) {
        inviteT -= dt;
        if (inviteT <= 0) {
          inviteT = 2.6;
          inviteSign = -inviteSign;
          oP.v += 0.55 * inviteSign; oR.v += 0.35 * inviteSign; oY.v += 0.09;
          if (steam) for (var q = 0; q < 6; q++) {
            puffLocal((rnd() - 0.5) * 0.06, 0.002, -0.08 + rnd() * 0.05, (rnd() - 0.5), -0.6, (rnd() - 0.5) - 0.3,
              0.12, 0.10, 0.02, 0.07 + rnd() * 0.04, 0.9 + rnd() * 0.5, 0.26);
          }
        }
      }

      stepOsc(oY, dt); stepOsc(oP, dt); stepOsc(oR, dt);
      applyPose();

      // ---- かけ面の位置と速度
      iron.sole.copy(group.position);
      if (firstFrame || dt <= 0) { iron.vel.set(0, 0, 0); firstFrame = false; }
      else iron.vel.subVectors(iron.sole, prevSole).divideScalar(dt);
      prevSole.copy(iron.sole);
      iron.speed = Math.sqrt(iron.vel.x * iron.vel.x + iron.vel.z * iron.vel.z);

      // ---- 湯気
      if (steam) {
        if (iron.mode === 'held' && iron.steamLevel > 0) {
          var rate = G.clamp(iron.steamLevel, 0, 1) * (ctx.lowPower ? 70 : 140);
          emitAcc += rate * dt;
          while (emitAcc >= 1) {
            emitAcc -= 1;
            var pick = rnd() * EMIT_W, k = 0;
            while (k < EMIT.length - 1 && pick > EMIT[k].w) { pick -= EMIT[k].w; k++; }
            var em = EMIT[k];
            puffLocal(em.x + (rnd() - 0.5) * 0.02, 0.003, em.z + (rnd() - 0.5) * 0.03, em.dx, 0, em.dz,
              0.10 + rnd() * 0.18, 0.04 + rnd() * 0.06, 0.026 + rnd() * 0.014, 0.11 + rnd() * 0.12, 1.1 + rnd() * 0.9, 0.38);
          }
        } else emitAcc = 0;
        // 台・かかと立ちのときの細い湯気
        if ((iron.mode === 'docked' || iron.mode === 'rest') && !tw.on) {
          wispT -= dt;
          if (wispT <= 0) {
            wispT = 1.1 + rnd() * 1.8;
            var cnt = 1 + Math.floor(rnd() * 2);
            for (var w = 0; w < cnt; w++) {
              if (iron.mode === 'docked') {
                puffLocal((rnd() - 0.5) * 0.05, 0.0, -0.11 + rnd() * 0.04, 0, -1, 0, 0.02, 0.06, 0.01, 0.05 + rnd() * 0.03, 1.4 + rnd() * 0.6, 0.24);
              } else {
                puffLocal((rnd() - 0.5) * 0.06, -0.003, -0.06 + rnd() * 0.1, 0, -1, 0, 0.03, 0.05, 0.01, 0.05 + rnd() * 0.03, 1.4 + rnd() * 0.6, 0.24);
              }
            }
          }
        }
      }

      // ---- ランプ
      var docked = iron.mode === 'docked';
      var pulse = 0.5 + 0.5 * Math.sin((t || 0) * 2.6);
      colTmp.copy(docked ? colGreen : colAmber);
      matLamp.emissive.copy(colTmp);
      matLamp.emissiveIntensity = invite ? 0.4 + 2.2 * pulse : 1.3;
      var sp2 = 0.5 + 0.5 * Math.sin((t || 0) * 3.4);
      matStandLamp.emissive.copy(docked ? colGreen : colAmber);
      glowMat.color.copy(docked ? colGreen : colAmber);
      matStandLamp.emissiveIntensity = standInvite ? 0.5 + 2.6 * sp2 : 1.4;
      glowMat.opacity = standInvite ? 0.25 + 0.6 * sp2 : 0.45;
      standGlow = G.damp(standGlow, standInvite ? 0.08 + 0.32 * sp2 : 0, 6, dt);
      matCradle.emissiveIntensity = standGlow;
    };

    iron.setDocked();
    return iron;
  };
})();

/* acorn.js */
/* acorn.js — どんぐり と、パパ・どんぐりで共有する形とテクスチャの道具
   G.createAcorn(ctx)。道具は G.papaKit として papa.js（後から読む）に渡す。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};

  // ================================================================ 小道具
  function sgnPow(v, e) { return v < 0 ? -Math.pow(-v, e) : Math.pow(v, e); }
  function catmull(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  function gauss(x, w) { return Math.exp(-(x * x) / (w * w)); }

  // 楕円（超楕円）断面のロフト。keys: [y, rx, rzFront, rzBack, n, cz]
  function makeProfile(keys) {
    var tmp = [0, 0, 0, 0, 0, 0];
    function interp(y, out) {
      var n = keys.length, i = 0, j;
      if (y <= keys[0][0]) { for (j = 1; j < 6; j++) out[j] = keys[0][j]; return out; }
      if (y >= keys[n - 1][0]) { for (j = 1; j < 6; j++) out[j] = keys[n - 1][j]; return out; }
      while (i < n - 2 && y > keys[i + 1][0]) i++;
      var k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
      var t = (y - k1[0]) / (k2[0] - k1[0]);
      for (j = 1; j < 6; j++) out[j] = catmull(k0[j], k1[j], k2[j], k3[j], t);
      return out;
    }
    function point(y, th, out) {
      interp(y, tmp);
      var e = 2 / tmp[4], s = Math.sin(th), c = Math.cos(th);
      return out.set(tmp[1] * sgnPow(s, e), y, tmp[5] + (c >= 0 ? tmp[2] : tmp[3]) * sgnPow(c, e));
    }
    var pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), pd = new THREE.Vector3(), ta = new THREE.Vector3(), tb = new THREE.Vector3();
    function normal(y, th, out) {
      point(y, th + 0.002, pa); point(y, th - 0.002, pb); point(y + 0.002, th, pc); point(y - 0.002, th, pd);
      ta.subVectors(pa, pb); tb.subVectors(pc, pd);
      return out.crossVectors(ta, tb).normalize();
    }
    // 前面（|th|<pi/2）で x に対応する角度
    function thAtX(x, y) {
      var lo = -Math.PI / 2, hi = Math.PI / 2;
      for (var k = 0; k < 24; k++) {
        var m = (lo + hi) * 0.5;
        if (point(y, m, pa).x < x) lo = m; else hi = m;
      }
      return (lo + hi) * 0.5;
    }
    return { interp: interp, point: point, normal: normal, thAtX: thAtX };
  }

  // パラメトリック格子 → BufferGeometry（法線は差分、UV は弧長[m]）
  var _gA = new THREE.Vector3(), _gB = new THREE.Vector3(), _gC = new THREE.Vector3(), _gD = new THREE.Vector3(),
    _gU = new THREE.Vector3(), _gV = new THREE.Vector3(), _gN = new THREE.Vector3(), _gP = new THREE.Vector3(), _gO = new THREE.Vector3();
  function gridGeom(nu, nv, fn, o) {
    o = o || {};
    var closed = !!o.closedU, cols = nu + 1, rows = nv + 1, N = cols * rows;
    var pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), uv = new Float32Array(N * 2);
    var eu = 0.35 / nu, ev = 0.35 / nv, i, j, k;
    for (j = 0; j < rows; j++) {
      var v = j / nv;
      for (i = 0; i < cols; i++) {
        var u = i / nu; k = j * cols + i;
        fn(u, v, _gP);
        var u0 = closed ? u - eu : Math.max(0, u - eu), u1 = closed ? u + eu : Math.min(1, u + eu);
        var v0 = Math.max(0, v - ev), v1 = Math.min(1, v + ev);
        fn(u1, v, _gA); fn(u0, v, _gB); _gU.subVectors(_gA, _gB);
        fn(u, v1, _gC); fn(u, v0, _gD); _gV.subVectors(_gC, _gD);
        _gN.crossVectors(_gU, _gV);
        if (_gN.lengthSq() < 1e-24) _gN.set(0, 1, 0);
        _gN.normalize();
        pos[k * 3] = _gP.x; pos[k * 3 + 1] = _gP.y; pos[k * 3 + 2] = _gP.z;
        nor[k * 3] = _gN.x; nor[k * 3 + 1] = _gN.y; nor[k * 3 + 2] = _gN.z;
      }
    }
    // 向きの決定（外向き）
    var cx = 0, cy = 0, cz = 0;
    for (k = 0; k < N; k++) { cx += pos[k * 3]; cy += pos[k * 3 + 1]; cz += pos[k * 3 + 2]; }
    cx /= N; cy /= N; cz /= N;
    var vote = 0;
    for (k = 0; k < N; k++) {
      _gP.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      if (o.out) o.out(_gP, _gO);
      else if (closed) { // 断面の中心 = 向かい合う2点の中点
        var uu = (k % cols) / nu, vv = Math.floor(k / cols) / nv;
        fn(uu + 0.5, vv, _gA); _gO.set(_gP.x - _gA.x, _gP.y - _gA.y, _gP.z - _gA.z);
      }
      else _gO.set(_gP.x - cx, _gP.y - cy, _gP.z - cz);
      vote += (nor[k * 3] * _gO.x + nor[k * 3 + 1] * _gO.y + nor[k * 3 + 2] * _gO.z) > 0 ? 1 : -1;
    }
    if (vote < 0) for (k = 0; k < N * 3; k++) nor[k] = -nor[k];
    // 弧長 UV
    var su = o.uvScale ? o.uvScale[0] : 1, sv = o.uvScale ? o.uvScale[1] : 1;
    for (j = 0; j < rows; j++) {
      var acc = 0;
      for (i = 0; i < cols; i++) {
        k = j * cols + i;
        if (i > 0) { var q = k - 1; acc += Math.sqrt(Math.pow(pos[k * 3] - pos[q * 3], 2) + Math.pow(pos[k * 3 + 1] - pos[q * 3 + 1], 2) + Math.pow(pos[k * 3 + 2] - pos[q * 3 + 2], 2)); }
        uv[k * 2] = o.uvUnit ? i / nu : acc * su;
      }
    }
    for (i = 0; i < cols; i++) {
      var acc2 = 0;
      for (j = 0; j < rows; j++) {
        k = j * cols + i;
        if (j > 0) { var q2 = k - cols; acc2 += Math.sqrt(Math.pow(pos[k * 3] - pos[q2 * 3], 2) + Math.pow(pos[k * 3 + 1] - pos[q2 * 3 + 1], 2) + Math.pow(pos[k * 3 + 2] - pos[q2 * 3 + 2], 2)); }
        uv[k * 2 + 1] = o.uvUnit ? j / nv : acc2 * sv;
      }
    }
    // 巻き順を法線に合わせる
    var idx = [], wv = 0;
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = j * cols + i, b = a + 1, c = a + cols;
      _gA.set(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]);
      _gB.set(pos[b * 3] - _gA.x, pos[b * 3 + 1] - _gA.y, pos[b * 3 + 2] - _gA.z);
      _gC.set(pos[c * 3] - _gA.x, pos[c * 3 + 1] - _gA.y, pos[c * 3 + 2] - _gA.z);
      _gN.crossVectors(_gC, _gB);
      var dd = _gN.x * nor[a * 3] + _gN.y * nor[a * 3 + 1] + _gN.z * nor[a * 3 + 2];
      if (dd > 0) wv++; else if (dd < 0) wv--;
    }
    var flipW = wv < 0;
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a2 = j * cols + i, b2 = a2 + 1, c2 = a2 + cols, d2 = c2 + 1;
      if (!flipW) { idx.push(a2, c2, b2, b2, c2, d2); } else { idx.push(a2, b2, c2, b2, d2, c2); }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    return geo;
  }

  // 曲線に沿った平行移動フレーム
  function makePath(points, samples, initN) {
    var curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    var P = [], T = [], Nn = [], B = [], k;
    for (k = 0; k <= samples; k++) {
      var t = k / samples;
      P.push(curve.getPointAt(t)); T.push(curve.getTangentAt(t).normalize());
    }
    var n0 = initN.clone(); n0.addScaledVector(T[0], -n0.dot(T[0])).normalize();
    Nn.push(n0); B.push(new THREE.Vector3().crossVectors(T[0], n0));
    for (k = 1; k <= samples; k++) {
      var n = Nn[k - 1].clone(); n.addScaledVector(T[k], -n.dot(T[k])).normalize();
      Nn.push(n); B.push(new THREE.Vector3().crossVectors(T[k], n));
    }
    return {
      length: curve.getLength(),
      at: function (t, oP, oN, oB) {
        t = G.clamp(t, 0, 1) * samples;
        var i = Math.min(samples - 1, Math.floor(t)), f = t - i;
        oP.lerpVectors(P[i], P[i + 1], f); oN.lerpVectors(Nn[i], Nn[i + 1], f).normalize(); oB.lerpVectors(B[i], B[i + 1], f).normalize();
      }
    };
  }
  // チューブ: rf(t, dir, r) で r.a(N方向) r.b(B方向) r.m(膨らみ比) を返す
  function sweepGeom(path, nu, nv, rf, o) {
    var C = new THREE.Vector3(), Nv = new THREE.Vector3(), Bv = new THREE.Vector3(), D = new THREE.Vector3(), r = { a: 0, b: 0, m: 0 };
    return gridGeom(nu, nv, function (u, v, out) {
      path.at(v, C, Nv, Bv);
      var th = u * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      D.set(Nv.x * c + Bv.x * s, Nv.y * c + Bv.y * s, Nv.z * c + Bv.z * s);
      r.m = 0; rf(v, D, r);
      var k = 1 + r.m;
      out.set(C.x + (Nv.x * c * r.a + Bv.x * s * r.b) * k, C.y + (Nv.y * c * r.a + Bv.y * s * r.b) * k, C.z + (Nv.z * c * r.a + Bv.z * s * r.b) * k);
    }, Object.assign({ closedU: true }, o || {}));
  }

  // ================================================================ 手続きテクスチャ
  function tileNoise(x, y, W, H, f, seed) { // 継ぎ目なしノイズ
    var a = G.noise2(x * f, y * f, seed), b = G.noise2((x - W) * f, y * f, seed),
      c = G.noise2(x * f, (y - H) * f, seed), d = G.noise2((x - W) * f, (y - H) * f, seed);
    var u = x / W, v = y / H;
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  function texFromFn(size, fn, opts) {
    var cv = G.makeCanvas(size, size), g = cv.getContext('2d'), img = g.createImageData(size, size), d = img.data, rgb = [0, 0, 0];
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      fn(x, y, rgb); var k = (y * size + x) * 4;
      d[k] = G.clamp(rgb[0], 0, 255); d[k + 1] = G.clamp(rgb[1], 0, 255); d[k + 2] = G.clamp(rgb[2], 0, 255); d[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return G.canvasTexture(cv, opts);
  }
  var TEX = {};
  function getTex(name, aniso) {
    if (TEX[name]) return TEX[name];
    var S, t;
    if (name === 'shirtBump') { // 細かい平織り + ゆるいむら
      S = 256;
      t = texFromFn(S, function (x, y, o) {
        var w = 0.5 + 0.22 * Math.sin(x / S * Math.PI * 2 * 64) * Math.sin(y / S * Math.PI * 2 * 64);
        var n = tileNoise(x, y, S, S, 0.05, 3) * 0.5 + tileNoise(x, y, S, S, 0.012, 7) * 0.5;
        var v = (w * 0.45 + n * 0.55) * 255; o[0] = o[1] = o[2] = v;
      }, { repeat: [1, 1], aniso: aniso });
    } else if (name === 'shirtTone') { // 色むら（ごくわずか）
      S = 256;
      t = texFromFn(S, function (x, y, o) {
        var n = tileNoise(x, y, S, S, 0.02, 11) * 0.6 + tileNoise(x, y, S, S, 0.09, 5) * 0.4;
        var v = 236 + (n - 0.5) * 22; o[0] = o[1] = o[2] = v;
      }, { srgb: true, repeat: [1, 1], aniso: aniso });
    } else if (name === 'wool') { // ズボン: 杢の綾織り
      S = 256;
      t = texFromFn(S, function (x, y, o) {
        var tw = 0.5 + 0.5 * Math.sin(((x + y) / S) * Math.PI * 2 * 48);
        var n = tileNoise(x, y, S, S, 0.11, 21), n2 = tileNoise(x, y, S, S, 0.025, 9);
        var v = 200 + (tw - 0.5) * 22 + (n - 0.5) * 50 + (n2 - 0.5) * 30; o[0] = v; o[1] = v; o[2] = v * 1.02;
      }, { srgb: true, repeat: [1, 1], aniso: aniso });
    } else if (name === 'knit') { // 靴下のリブ
      S = 128;
      t = texFromFn(S, function (x, y, o) {
        var r = 0.5 + 0.5 * Math.cos(x / S * Math.PI * 2 * 16);
        var n = tileNoise(x, y, S, S, 0.2, 4);
        var v = 170 + r * 50 + (n - 0.5) * 40; o[0] = o[1] = o[2] = v;
      }, { srgb: true, repeat: [1, 1], aniso: aniso });
    } else if (name === 'terry') { // スリッパのパイル
      S = 128;
      t = texFromFn(S, function (x, y, o) {
        var n = tileNoise(x, y, S, S, 0.35, 31), n2 = tileNoise(x, y, S, S, 0.08, 2);
        var v = 190 + (n - 0.5) * 90 + (n2 - 0.5) * 40; o[0] = o[1] = o[2] = v;
      }, { srgb: true, repeat: [1, 1], aniso: aniso });
    } else if (name === 'leather') {
      S = 128;
      t = texFromFn(S, function (x, y, o) {
        var n = tileNoise(x, y, S, S, 0.3, 41), n2 = tileNoise(x, y, S, S, 0.07, 13);
        var v = 128 + (n - 0.5) * 80 + (n2 - 0.5) * 50; o[0] = o[1] = o[2] = v;
      }, { repeat: [1, 1], aniso: aniso });
    } else if (name === 'tie') { // 紺に細い斜めの縞
      S = 256;
      t = texFromFn(S, function (x, y, o) {
        var d = (x + y) % 64, d2 = (x + y + 26) % 64;
        var s1 = G.clamp(1.3 - Math.abs(d - 3), 0, 1), s2 = G.clamp(1.0 - Math.abs(d2 - 2), 0, 1);
        var silk = 0.94 + 0.06 * Math.sin((x - y) / S * Math.PI * 2 * 80);
        var r = 27, gg = 40, b = 72;
        r = G.lerp(r, 138, s1); gg = G.lerp(gg, 146, s1); b = G.lerp(b, 172, s1);
        r = G.lerp(r, 120, s2 * 0.9); gg = G.lerp(gg, 52, s2 * 0.9); b = G.lerp(b, 62, s2 * 0.9);
        o[0] = r * silk; o[1] = gg * silk; o[2] = b * silk;
      }, { srgb: true, repeat: [1, 1], aniso: aniso });
    } else if (name === 'stitch') { // ステッチの点線（alpha）
      var cv = G.makeCanvas(32, 8), g = cv.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 32, 8);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(16, 4, 10, 2.6, 0, 0, Math.PI * 2); g.fill();
      t = G.canvasTexture(cv, { repeat: [1, 1], aniso: aniso });
    } else if (name === 'skin') {
      S = 128;
      t = texFromFn(S, function (x, y, o) {
        var n = tileNoise(x, y, S, S, 0.15, 17);
        o[0] = 238 + (n - 0.5) * 18; o[1] = 236 + (n - 0.5) * 22; o[2] = 234 + (n - 0.5) * 22;
      }, { srgb: true, repeat: [1, 1], aniso: aniso });
    } else if (name === 'nut') { // どんぐりの実: u=周 v=先端→帽子
      S = 256;
      t = texFromFn(S, function (x, y, o) {
        var u = x / S, v = 1 - y / S;
        var n = tileNoise(x, y, S, S, 0.04, 5), streak = tileNoise(x * 4, y * 0.25, S * 4, S * 0.25, 0.35, 8);
        var line = Math.pow(Math.abs(Math.sin(u * Math.PI * 44 + n * 4)), 24);
        var r, gg, b;
        if (v < 0.1) { var k0 = v / 0.1; r = G.lerp(48, 92, k0); gg = G.lerp(30, 56, k0); b = G.lerp(16, 26, k0); }
        else if (v < 0.68) { var k1 = (v - 0.1) / 0.58; r = G.lerp(92, 128, k1); gg = G.lerp(56, 80, k1); b = G.lerp(26, 38, k1); }
        else if (v < 0.78) { var k2 = (v - 0.68) / 0.1; r = G.lerp(128, 176, k2); gg = G.lerp(80, 134, k2); b = G.lerp(38, 78, k2); }
        else { r = 186; gg = 150; b = 96; }
        var m = 0.82 + streak * 0.3 - line * 0.22;
        o[0] = r * m; o[1] = gg * m; o[2] = b * m;
      }, { srgb: true, aniso: aniso });
    } else if (name === 'cap') { // 殻斗のうろこ
      S = 256;
      var mk = function (bump) {
        return function (x, y, o) {
          var u = x / S, v = 1 - y / S, rowsN = 13, colsN = 34;
          var jit = (G.noise2(u * 9, v * 9, 3) - 0.5) * 0.5;
          var rv = v * rowsN + jit * 0.6, row = Math.floor(rv), cvv = rv - row;
          var cuRaw = u * colsN + (row % 2) * 0.5 + jit, cell = Math.floor(cuRaw), cu = cuRaw - cell;
          var hv = G.noise2(cell * 1.7, row * 2.3, 9);
          var w = 1 - Math.pow(Math.abs(cu * 2 - 1), 1.3 + hv);
          var h = G.clamp(w * Math.pow(cvv, 0.5) * (1.0 + 0.4 * hv), 0, 1);
          var n = tileNoise(x, y, S, S, 0.2, 19);
          if (bump) { o[0] = o[1] = o[2] = (h * 0.7 + n * 0.3) * 255; return; }
          var k = 0.55 + 0.55 * h + (n - 0.5) * 0.35 + (hv - 0.5) * 0.2;
          o[0] = 128 * k + 18; o[1] = 108 * k + 12; o[2] = 76 * k + 6;
        };
      };
      t = texFromFn(S, mk(false), { srgb: true, aniso: aniso });
      TEX.capBump = texFromFn(S, mk(true), { aniso: aniso });
    }
    TEX[name] = t;
    return t;
  }

  // ================================================================ どんぐりのメッシュ（長軸 Y、帽子が +Y、原点は重心）
  function buildAcornMesh(aniso, lowPower) {
    var grp = new THREE.Group();
    var seg = lowPower ? 28 : 44;
    var prof = [[0, 0], [0.0012, 0.0010], [0.0017, 0.0026], [0.0035, 0.0045], [0.0085, 0.0090], [0.0128, 0.0150],
      [0.0156, 0.0215], [0.0168, 0.0270], [0.0167, 0.0315], [0.0156, 0.0360], [0.0125, 0.0395], [0.0065, 0.0418], [0.0001, 0.0425]];
    var pts = []; var sp = new THREE.SplineCurve(prof.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
    var sm = sp.getSpacedPoints(48); for (var i = 0; i < sm.length; i++) pts.push(new THREE.Vector2(Math.max(0, sm[i].x), sm[i].y));
    pts[0].x = 0; pts[pts.length - 1].x = 0;
    var nutGeo = new THREE.LatheGeometry(pts, seg);
    // 縦の細い筋（わずかな凹凸）
    var pa = nutGeo.attributes.position;
    for (i = 0; i < pa.count; i++) {
      var x = pa.getX(i), z = pa.getZ(i), y = pa.getY(i), rr = Math.sqrt(x * x + z * z);
      if (rr < 1e-5) continue;
      var a = Math.atan2(z, x), k = 1 + 0.012 * Math.sin(a * 9 + y * 60) * G.smooth(0.004, 0.012, y);
      pa.setX(i, x * k); pa.setZ(i, z * k);
    }
    nutGeo.computeVertexNormals();
    var nutMat = new THREE.MeshPhysicalMaterial({ map: getTex('nut', aniso), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.32, bumpMap: getTex('nut', aniso), bumpScale: 0.4 });
    var nut = new THREE.Mesh(nutGeo, nutMat);
    // 帽子
    var cprof = [[0.0150, 0.0318], [0.0166, 0.0290], [0.0181, 0.0300], [0.0186, 0.0330], [0.0178, 0.0368], [0.0157, 0.0400], [0.0120, 0.0428], [0.0075, 0.0447], [0.0032, 0.0458], [0.0001, 0.0460]];
    var cpts = new THREE.SplineCurve(cprof.map(function (p) { return new THREE.Vector2(p[0], p[1]); })).getSpacedPoints(36);
    cpts[cpts.length - 1].x = 0;
    var capGeo = new THREE.LatheGeometry(cpts, seg + 8);
    var cpa = capGeo.attributes.position;
    for (i = 0; i < cpa.count; i++) {
      var cx = cpa.getX(i), cz = cpa.getZ(i), cy = cpa.getY(i), cr = Math.sqrt(cx * cx + cz * cz);
      if (cr < 1e-5) continue;
      var ca = Math.atan2(cz, cx);
      var ck = 1 + (0.03 * (G.noise2(ca * 6 + 9, cy * 900, 5) - 0.5) + 0.02 * (G.noise2(ca * 2, cy * 300, 8) - 0.5)) * G.smooth(0.0295, 0.032, cy);
      cpa.setX(i, cx * ck); cpa.setZ(i, cz * ck);
    }
    capGeo.computeVertexNormals();
    getTex('cap', aniso);
    var capMat = new THREE.MeshStandardMaterial({ map: TEX.cap, bumpMap: TEX.capBump, bumpScale: 1.2, roughness: 0.93, side: THREE.DoubleSide });
    var cap = new THREE.Mesh(capGeo, capMat);
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0022, 0.0075, 8), new THREE.MeshStandardMaterial({ color: 0x4e3a26, roughness: 0.9 }));
    stem.position.set(0.0004, 0.0490, 0); stem.rotation.z = -0.18;
    var off = -0.024;
    nut.position.y = cap.position.y = off; stem.position.y += off;
    grp.add(nut, cap, stem);
    grp.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return grp;
  }

  // ================================================================ どんぐり
  G.createAcorn = function (ctx) {
    ctx = ctx || {};
    var REST = 0.0172;
    var group = new THREE.Group(); group.name = 'acorn';
    var yawN = new THREE.Group(), layN = new THREE.Group(), rollN = new THREE.Group();
    group.add(yawN); yawN.add(layN); layN.add(rollN);
    rollN.add(buildAcornMesh(ctx.aniso || 4, !!ctx.lowPower));
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: G.softDotTexture(), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = -1; group.add(shadow);
    group.visible = false;

    var a = {
      group: group, pos: new THREE.Vector3(), vel: new THREE.Vector3(), radius: 0.02, mode: 'hidden', rollSpeed: 0,
      onBump: function () {}
    };
    var yaw = 0.4, roll = 0, tilt = 0.06, spinRoll = 0, spinYaw = 0, airTilt = 0;
    var rockAmp = 0, rockT = 0, surfY = 0, glint = false, glintT = 0, wasMoving = false, lastSpeed = 0;
    var holdTarget = new THREE.Vector3(), prevPos = new THREE.Vector3(), grounded = true;

    function bump(s) { if (s > 0.03 && a.onBump) { try { a.onBump(s); } catch (e) { /* 呼び出し側の誤りは無視 */ } } }
    function rock(amp) { rockAmp = Math.max(rockAmp * 0.5, amp); rockT = 0; }

    a.show = function (x, z, y) {
      surfY = y || 0; a.pos.set(x, surfY + REST, z); a.vel.set(0, 0, 0); a.mode = 'free'; group.visible = true;
      spinRoll = spinYaw = 0; grounded = true; rockAmp = 0; yaw = Math.random() * Math.PI * 2; roll = Math.random() * Math.PI * 2;
      apply();
    };
    a.hide = function () { a.mode = 'hidden'; group.visible = false; a.vel.set(0, 0, 0); a.rollSpeed = 0; };
    a.popFrom = function (x, y, z, vx, vy, vz) {
      a.pos.set(x, y, z); a.vel.set(vx || 0, vy || 0, vz || 0); a.mode = 'free'; group.visible = true; grounded = false;
      spinRoll = 12 + Math.random() * 6; spinYaw = (Math.random() - 0.5) * 6; airTilt = 0;
      yaw = Math.atan2(a.vel.x, a.vel.z) + Math.PI / 2;
    };
    a.kick = function (vx, vz) {
      if (a.mode === 'hidden') return;
      if (a.mode === 'held') a.mode = 'free';
      a.vel.x += vx || 0; a.vel.z += vz || 0;
    };
    a.hold = function (x, y, z) {
      if (a.mode !== 'held') { a.mode = 'held'; group.visible = true; a.vel.set(0, 0, 0); prevPos.copy(a.pos); if (a.pos.lengthSq() === 0) a.pos.set(x, y, z); }
      holdTarget.set(x, y, z);
    };
    a.release = function (vx, vz) {
      if (a.mode === 'hidden') return;
      a.mode = 'free'; a.vel.set(vx || 0, 0, vz || 0); grounded = false; spinRoll = (Math.random() - 0.5) * 4;
    };
    a.setGlint = function (on) { glint = !!on; if (!glint) glintT = 0; };
    a.hitTest = function (ray) { return a.mode !== 'hidden' && ray.distanceSqToPoint(a.pos) < 0.09 * 0.09; };

    function apply() {
      group.position.copy(a.pos);
      yawN.rotation.y = yaw;
      var rk = rockAmp * Math.sin(rockT * Math.PI * 2 * 3.4) * Math.exp(-rockT * 5.5);
      layN.rotation.z = -Math.PI / 2 + tilt + rk * 0.35;
      rollN.rotation.y = roll + rk;
      var h = Math.max(0, a.pos.y - surfY - REST);
      shadow.position.set(0, surfY + 0.0008 - a.pos.y, 0);
      var sc = 0.06 + h * 0.4; shadow.scale.set(sc, sc * 0.8, 1);
      shadow.material.opacity = 0.42 * G.clamp(1 - h * 6, 0, 1);
      shadow.visible = a.mode !== 'hidden';
    }

    var ax = new THREE.Vector3(), pz = new THREE.Vector3();
    a.update = function (dt, surfaceY, colliders, bounds) {
      if (a.mode === 'hidden') { a.rollSpeed = 0; return; }
      dt = G.clamp(dt || 0, 0, 0.05);
      if (surfaceY != null) surfY = surfaceY;
      var ground = surfY + REST;
      rockT += dt;
      if (glint && a.mode === 'free' && grounded && a.vel.lengthSq() < 1e-6) {
        var g0 = glintT % 1.8; glintT += dt; var g1 = glintT % 1.8;
        if (g1 < g0 || (g0 < 0.38 && g1 >= 0.38)) rock(g1 < g0 ? 0.16 : 0.10);
      }
      if (a.mode === 'held') {
        prevPos.copy(a.pos);
        a.pos.x = G.damp(a.pos.x, holdTarget.x, 22, dt); a.pos.y = G.damp(a.pos.y, holdTarget.y, 22, dt); a.pos.z = G.damp(a.pos.z, holdTarget.z, 22, dt);
        if (dt > 0) a.vel.subVectors(a.pos, prevPos).multiplyScalar(1 / dt);
        tilt = G.damp(tilt, 0.25 + 0.15 * G.clamp(a.vel.x * 2, -1, 1), 6, dt);
        roll += G.clamp(a.vel.z, -1, 1) * dt * 3;
        a.rollSpeed = 0; grounded = false;
        apply(); return;
      }
      // 空中
      if (!grounded || a.pos.y > ground + 0.0005 || a.vel.y > 0.001) {
        grounded = false;
        a.vel.y -= 9.8 * dt;
        a.pos.addScaledVector(a.vel, dt);
        roll += spinRoll * dt; yaw += spinYaw * dt;
        tilt = G.damp(tilt, 0.06 + 0.3 * Math.sin(roll * 0.5), 3, dt);
        if (a.pos.y <= ground) {
          a.pos.y = ground;
          var vy = -a.vel.y;
          if (vy > 0.45) {
            a.vel.y = vy * 0.3; a.vel.x *= 0.75; a.vel.z *= 0.75; spinRoll *= 0.5; spinYaw *= 0.5;
          } else { a.vel.y = 0; grounded = true; spinRoll = 0; spinYaw = 0; }
          bump(vy);
        }
        a.rollSpeed = 0;
      } else {
        a.pos.y = ground; a.vel.y = 0;
        ax.set(Math.cos(yaw), 0, -Math.sin(yaw)); pz.set(Math.sin(yaw), 0, Math.cos(yaw));
        var vA = a.vel.dot(ax), vP = a.vel.dot(pz);
        var sp = Math.sqrt(vA * vA + vP * vP);
        // 長軸方向の滑りはすぐ止まる
        vA *= Math.exp(-9 * dt);
        // ころがり摩擦
        var dec = 0.32 * dt + Math.abs(vP) * (1 - Math.exp(-0.7 * dt));
        vP = Math.abs(vP) <= dec ? 0 : vP - Math.sign(vP) * dec;
        // 軸を進行方向に垂直へ寄せる＋円すい形でゆるく曲がる
        if (sp > 0.01) {
          var vx = ax.x * vA + pz.x * vP, vz = ax.z * vA + pz.z * vP;
          var yt = Math.atan2(vx, vz) - 0; // pz を v に合わせる角
          var d1 = Math.atan2(Math.sin(yt - yaw), Math.cos(yt - yaw)), d2 = Math.atan2(Math.sin(yt + Math.PI - yaw), Math.cos(yt + Math.PI - yaw));
          var dd = Math.abs(d1) < Math.abs(d2) ? d1 : d2;
          var turnRate = 4 * G.clamp(sp / 0.15, 0.2, 1);
          var dyaw = dd * (1 - Math.exp(-turnRate * dt)) + 1.6 * vP * dt;
          // 速度は軸と一緒に回る（曲がって進む）
          var sinA = Math.sin(dyaw), cosA = Math.cos(dyaw);
          var nvx = vx * cosA + vz * sinA, nvz = -vx * sinA + vz * cosA;
          yaw += dyaw;
          ax.set(Math.cos(yaw), 0, -Math.sin(yaw)); pz.set(Math.sin(yaw), 0, Math.cos(yaw));
          vA = nvx * ax.x + nvz * ax.z; vP = nvx * pz.x + nvz * pz.z;
          vA *= Math.exp(-9 * dt);
        }
        a.vel.set(ax.x * vA + pz.x * vP, 0, ax.z * vA + pz.z * vP);
        a.pos.addScaledVector(a.vel, dt);
        roll += vP / REST * dt;
        tilt = G.damp(tilt, 0.06 + 0.05 * Math.sin(roll), 10, dt);
        a.pos.y = ground + 0.0006 * (1 - Math.cos(roll * 2));
        var spd = a.vel.length();
        a.rollSpeed = spd;
        if (spd > 0.015) { wasMoving = true; lastSpeed = Math.max(lastSpeed * 0.98, spd); }
        else if (wasMoving) { wasMoving = false; a.vel.set(0, 0, 0); rock(0.10 + 0.25 * G.clamp(lastSpeed / 0.4, 0, 1)); lastSpeed = 0; a.rollSpeed = 0; }
        else if (spd > 0) { a.vel.multiplyScalar(Math.exp(-6 * dt)); }
      }
      // 当たり
      var i, rr = a.radius;
      if (colliders) for (i = 0; i < colliders.length; i++) {
        var cc = colliders[i], dx = a.pos.x - cc.x, dz = a.pos.z - cc.z, d = Math.sqrt(dx * dx + dz * dz), md = cc.r + rr;
        if (d < md && d > 1e-6) {
          var nx = dx / d, nz = dz / d;
          a.pos.x = cc.x + nx * md; a.pos.z = cc.z + nz * md;
          var vn = a.vel.x * nx + a.vel.z * nz;
          if (vn < 0) { a.vel.x -= 1.45 * vn * nx; a.vel.z -= 1.45 * vn * nz; bump(-vn); spinYaw += (Math.random() - 0.5) * 2; }
        }
      }
      if (bounds) {
        if (a.pos.x < bounds.minX + rr) { a.pos.x = bounds.minX + rr; if (a.vel.x < 0) { bump(-a.vel.x); a.vel.x = -a.vel.x * 0.45; } }
        if (a.pos.x > bounds.maxX - rr) { a.pos.x = bounds.maxX - rr; if (a.vel.x > 0) { bump(a.vel.x); a.vel.x = -a.vel.x * 0.45; } }
        if (a.pos.z < bounds.minZ + rr) { a.pos.z = bounds.minZ + rr; if (a.vel.z < 0) { bump(-a.vel.z); a.vel.z = -a.vel.z * 0.45; } }
        if (a.pos.z > bounds.maxZ - rr) { a.pos.z = bounds.maxZ - rr; if (a.vel.z > 0) { bump(a.vel.z); a.vel.z = -a.vel.z * 0.45; } }
      }
      apply();
    };
    return a;
  };

  // papa.js（遊んでいる間に裏で読む）が使う道具
  G.papaKit = { sgnPow: sgnPow, catmull: catmull, gauss: gauss, makeProfile: makeProfile, gridGeom: gridGeom, makePath: makePath, sweepGeom: sweepGeom, tileNoise: tileNoise, texFromFn: texFromFn, getTex: getTex, buildAcornMesh: buildAcornMesh };
})();

/* audio.js */
/* audio.js — 効果音のすべて（外部音源なし。WebAudio で合成）
   G.createAudio() → { unlock, ready, suspend, resume, setAmbient, setSteam, setSlide, setRoll, play }
   AudioContext は unlock()（最初のタッチの中）で初めて作る。作れなければ以後すべて何もしない。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};

  G.createAudio = function () {
    var ctx = null, failed = false, userSuspended = false;
    var master = null, sfxBus = null, loopBus = null, ambBus = null;
    var bufW = null, bufP = null, bufB = null;
    var oddWave = null;
    var loops = null;
    var lastPlay = {}, recent = [];
    var ambientOn = false, birdTimer = 0, rollTimer = 0;
    var rollSpeed = 0, rollNext = 0;
    var D = null, R = 1; // いま鳴らしている単発音の出口と高さ倍率

    function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function alive() { return !!ctx && !failed; }
    function running() { return alive() && ctx.state === 'running' && !userSuspended; }

    // ---------- 準備 ----------
    function makeNoise(kind) {
      var len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      var i, w, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (i = 0; i < len; i++) {
        w = Math.random() * 2 - 1;
        if (kind === 'w') d[i] = w * 0.7;
        else if (kind === 'p') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      }
      // ループのつなぎ目をなめらかに
      var f = Math.min(2000, len >> 3);
      for (i = 0; i < f; i++) { var k = i / f; d[i] = d[i] * k + d[len - f + i] * (1 - k); }
      return b;
    }

    function build() {
      master = ctx.createGain(); master.gain.value = 0.5;
      var comp = ctx.createDynamicsCompressor();
      try {
        comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6;
        comp.attack.value = 0.004; comp.release.value = 0.2;
      } catch (e) {}
      var lim = ctx.createGain(); lim.gain.value = 0.9;
      master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      loopBus = ctx.createGain(); loopBus.gain.value = 1; loopBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
      bufW = makeNoise('w'); bufP = makeNoise('p'); bufB = makeNoise('b');
      try {
        var sinT = new Float32Array([0, 1, 0, 0.36, 0, 0.2, 0, 0.1, 0, 0.05]), cosT = new Float32Array(sinT.length);
        oddWave = ctx.createPeriodicWave(cosT, sinT); // 奇数倍音（クラリネット風）
      } catch (e) { oddWave = null; }
      buildLoops();
    }

    function loopSrc(buf) {
      var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      s.start(0, Math.random() * 1.5); return s;
    }

    function buildLoops() {
      loops = {};
      // 湯気「しゅわーー」
      var st = loopSrc(bufW), stHp = ctx.createBiquadFilter(), stLp = ctx.createBiquadFilter(), stG = ctx.createGain(), stMod = ctx.createGain();
      stHp.type = 'highpass'; stHp.frequency.value = 900; stHp.Q.value = 0.5;
      stLp.type = 'lowpass'; stLp.frequency.value = 2500; stLp.Q.value = 0.6;
      stG.gain.value = 0; stMod.gain.value = 1;
      st.connect(stHp); stHp.connect(stLp); stLp.connect(stMod); stMod.connect(stG); stG.connect(loopBus);
      var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 3.1; lfoG.gain.value = 0.12; lfo.connect(lfoG); lfoG.connect(stMod.gain); lfo.start();
      loops.steam = { g: stG, lp: stLp };
      // 布を滑る「すーっ」
      var sl = loopSrc(bufP), slLp = ctx.createBiquadFilter(), slHp = ctx.createBiquadFilter(), slG = ctx.createGain();
      slLp.type = 'lowpass'; slLp.frequency.value = 400; slLp.Q.value = 0.4;
      slHp.type = 'highpass'; slHp.frequency.value = 90;
      slG.gain.value = 0;
      sl.connect(slHp); slHp.connect(slLp); slLp.connect(slG); slG.connect(loopBus);
      loops.slide = { g: slG, lp: slLp };
      // 朝の部屋の静けさ
      var rm = loopSrc(bufB), rmLp = ctx.createBiquadFilter(), rmG = ctx.createGain();
      rmLp.type = 'lowpass'; rmLp.frequency.value = 260; rmG.gain.value = 0.05;
      rm.connect(rmLp); rmLp.connect(rmG); rmG.connect(ambBus);
    }

    // ---------- 音のかけら ----------
    // ノイズ: o = {buf, type, f, f2, q, a, h, r, peak, at(=f2 までの時間)}
    function noise(t, o) {
      var s = ctx.createBufferSource(); s.buffer = o.buf || bufW; s.loop = true;
      var fl = ctx.createBiquadFilter(); fl.type = o.type || 'bandpass';
      var f = (o.f || 1000) * R;
      fl.frequency.setValueAtTime(f, t); fl.Q.value = o.q == null ? 1 : o.q;
      var a = o.a || 0.005, h = o.h || 0, r = o.r || 0.05, end = t + a + h + r * 6;
      if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2 * R), t + (o.at || (a + h + r)));
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.peak || 0.2, t + a);
      if (h) g.gain.setValueAtTime(o.peak || 0.2, t + a + h);
      g.gain.setTargetAtTime(0, t + a + h, r);
      s.connect(fl); fl.connect(g); g.connect(o.dest || D);
      s.start(t, Math.random() * 1.6); s.stop(end + 0.02);
    }
    // 音程: o = {f, f2, gt, type, wave, a, h, r, peak, lp}
    function tone(t, o) {
      var os = ctx.createOscillator();
      if (o.wave) os.setPeriodicWave(o.wave); else os.type = o.type || 'sine';
      var f = o.f * R; os.frequency.setValueAtTime(f, t);
      if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2 * R, t + (o.gt || 0.05));
      var a = o.a || 0.003, h = o.h || 0, r = o.r || 0.1, end = t + a + h + r * 6;
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.peak || 0.2, t + a);
      if (h) g.gain.setValueAtTime(o.peak || 0.2, t + a + h);
      g.gain.setTargetAtTime(0, t + a + h, r);
      var last = os;
      if (o.lp) { var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = 0.5; os.connect(fl); last = fl; }
      last.connect(g); g.connect(o.dest || D);
      os.start(t); os.stop(end + 0.02);
    }
    // 木の当たり
    function knock(t, f, peak, body) {
      tone(t, { f: f, f2: f * 0.82, gt: 0.03, a: 0.001, r: body || 0.025, peak: peak });
      noise(t, { f: f * 2.4, q: 3, a: 0.001, r: 0.008, peak: peak * 0.6 });
    }
    // 木琴（マリンバ風）
    function mallet(t, f, peak, r) {
      tone(t, { f: f, a: 0.002, r: r || 0.22, peak: peak });
      tone(t, { f: f * 3.93, a: 0.001, r: 0.035, peak: peak * 0.22 });
      noise(t, { f: f * 4, q: 2, a: 0.001, r: 0.006, peak: peak * 0.15 });
    }
    // オルゴール/鉄琴
    function bell(t, f, peak, r) {
      tone(t, { f: f, a: 0.002, r: r || 0.5, peak: peak });
      tone(t, { f: f * 2, a: 0.002, r: (r || 0.5) * 0.35, peak: peak * 0.18 });
      tone(t, { f: f * 3, a: 0.001, r: 0.06, peak: peak * 0.06 });
      noise(t, { f: 3000, q: 2, a: 0.001, r: 0.004, peak: peak * 0.08 });
    }
    // 布のこすれ（細かい粒）
    function rustle(t, dur, f, peak, n) {
      for (var i = 0; i < n; i++) {
        noise(t + Math.random() * dur, { f: f * rnd(0.7, 1.4), q: rnd(0.7, 1.6), a: 0.003, r: rnd(0.008, 0.025), peak: peak * rnd(0.4, 1) });
      }
    }

    // ---------- 単発音 ----------
    var S = {
      pickup: function (t) {
        rustle(t, 0.09, 2200, 0.16, 6);
        noise(t, { buf: bufP, type: 'bandpass', f: 1400, q: 0.7, a: 0.01, h: 0.03, r: 0.04, peak: 0.14 });
      },
      unfurl: function (t) {
        noise(t, { buf: bufP, type: 'bandpass', f: 380, f2: 1300, at: 0.2, q: 0.8, a: 0.12, h: 0.08, r: 0.08, peak: 0.42 });
        rustle(t + 0.05, 0.25, 1800, 0.12, 9);
        var l = t + 0.34; // 着地 ぽふ
        noise(l, { buf: bufP, type: 'lowpass', f: 420, q: 0.5, a: 0.006, r: 0.06, peak: 0.5 });
        tone(l, { f: 95, f2: 60, gt: 0.08, a: 0.004, r: 0.05, peak: 0.22 });
      },
      puff: function (t) {
        noise(t, { type: 'bandpass', f: 2600, f2: 3600, at: 0.1, q: 0.9, a: 0.012, h: 0.04, r: 0.06, peak: 0.16 });
      },
      burst: function (t) {
        noise(t, { type: 'bandpass', f: 1800, f2: 3800, at: 0.5, q: 0.6, a: 0.32, h: 0.3, r: 0.18, peak: 0.26 });
        noise(t, { buf: bufP, type: 'lowpass', f: 700, q: 0.4, a: 0.25, h: 0.3, r: 0.2, peak: 0.16 });
      },
      pin: function (t) {
        tone(t, { f: 880, f2: 1046, gt: 0.03, a: 0.002, r: 0.12, peak: 0.16 });
        tone(t, { f: 2092, a: 0.002, r: 0.04, peak: 0.03 });
        noise(t, { buf: bufP, type: 'bandpass', f: 1300, q: 1, a: 0.002, r: 0.02, peak: 0.28 });
      },
      crease: function (t) {
        noise(t, { type: 'bandpass', f: 3600, f2: 2400, at: 0.04, q: 1.8, a: 0.002, h: 0.015, r: 0.025, peak: 0.2 });
        noise(t + 0.045, { type: 'bandpass', f: 2800, q: 1.8, a: 0.002, r: 0.02, peak: 0.12 });
        mallet(t + 0.01, 1175, 0.05, 0.08);
      },
      panel: function (t) { mallet(t, 659, 0.24, 0.25); },
      alldone: function (t) {
        var n = [523.25, 659.25, 783.99, 1046.5];
        for (var i = 0; i < n.length; i++) {
          mallet(t + i * 0.14, n[i], 0.2, i === 3 ? 0.4 : 0.22);
          bell(t + i * 0.14, n[i], 0.05, i === 3 ? 0.7 : 0.3);
        }
      },
      kotsun: function (t) {
        knock(t, 980, 0.34, 0.035);
        noise(t, { buf: bufP, type: 'lowpass', f: 700, a: 0.002, r: 0.02, peak: 0.18 });
      },
      pop: function (t) {
        tone(t, { f: 320, f2: 760, gt: 0.04, a: 0.003, r: 0.05, peak: 0.24 });
        noise(t, { buf: bufP, type: 'bandpass', f: 900, q: 1, a: 0.002, r: 0.015, peak: 0.16 });
      },
      tok: function (t) { knock(t, 1350 * rnd(0.94, 1.06), 0.26, 0.02); },
      tick: function (t) {
        noise(t, { type: 'bandpass', f: 2600, q: 3, a: 0.001, r: 0.005, peak: 0.07 });
        tone(t, { f: 1700, a: 0.001, r: 0.008, peak: 0.025 });
      },
      lift: function (t) {
        noise(t, { type: 'bandpass', f: 2100, q: 2.2, a: 0.001, r: 0.009, peak: 0.18 });
        tone(t, { f: 880, a: 0.001, r: 0.012, peak: 0.05 });
        noise(t + 0.035, { type: 'bandpass', f: 1500, q: 2, a: 0.001, r: 0.013, peak: 0.12 });
      },
      rest: function (t) {
        tone(t, { f: 330, f2: 240, gt: 0.05, a: 0.002, r: 0.05, peak: 0.26 });
        noise(t, { buf: bufP, type: 'lowpass', f: 1300, a: 0.001, r: 0.018, peak: 0.22 });
      },
      dock: function (t) {
        noise(t, { type: 'bandpass', f: 2400, q: 2.5, a: 0.001, r: 0.007, peak: 0.2 });
        noise(t + 0.018, { type: 'bandpass', f: 1600, q: 2, a: 0.001, r: 0.01, peak: 0.12 });
        tone(t + 0.16, { f: 987.8, a: 0.006, h: 0.06, r: 0.025, peak: 0.07 });
        tone(t + 0.27, { f: 1318.5, a: 0.006, h: 0.08, r: 0.04, peak: 0.07 });
      },
      pocket: function (t) {
        tone(t, { f: 230, f2: 160, gt: 0.05, a: 0.003, r: 0.045, peak: 0.22 });
        noise(t, { buf: bufP, type: 'lowpass', f: 650, a: 0.003, r: 0.03, peak: 0.22 });
      },
      swish: function (t) {
        noise(t, { buf: bufP, type: 'bandpass', f: 600, f2: 1700, at: 0.15, q: 0.9, a: 0.08, h: 0.04, r: 0.07, peak: 0.24 });
      },
      clink: function (t) {
        knock(t, 720, 0.22, 0.03);
        tone(t + 0.004, { f: 1870, a: 0.001, r: 0.09, peak: 0.035 });
        tone(t + 0.004, { f: 2630, a: 0.001, r: 0.06, peak: 0.02 });
        knock(t + 0.045, 560, 0.14, 0.03);
      },
      flop: function (t) {
        noise(t, { buf: bufP, type: 'lowpass', f: 900, q: 0.5, a: 0.02, h: 0.04, r: 0.07, peak: 0.36 });
        tone(t + 0.03, { f: 85, f2: 60, gt: 0.06, a: 0.004, r: 0.05, peak: 0.12 });
      },
      door: function (t) {
        noise(t, { type: 'bandpass', f: 1300, q: 3, a: 0.002, r: 0.02, peak: 0.12 });
        tone(t, { f: 560, f2: 480, gt: 0.03, a: 0.002, r: 0.03, peak: 0.06 });
        knock(t + 0.13, 820, 0.14, 0.03);
        noise(t + 0.15, { buf: bufP, type: 'lowpass', f: 500, q: 0.4, a: 0.18, h: 0.2, r: 0.2, peak: 0.07 });
      },
      step: function (t) {
        noise(t, { buf: bufP, type: 'lowpass', f: 1500, q: 0.6, a: 0.003, r: 0.025, peak: 0.24 });
        tone(t, { f: 120, f2: 90, gt: 0.04, a: 0.003, r: 0.03, peak: 0.1 });
        noise(t + 0.05, { buf: bufP, type: 'lowpass', f: 1100, q: 0.6, a: 0.003, r: 0.02, peak: 0.08 });
      },
      whisk: function (t) {
        noise(t, { buf: bufP, type: 'bandpass', f: 1100, f2: 2600, at: 0.18, q: 1.1, a: 0.05, h: 0.07, r: 0.05, peak: 0.22 });
        rustle(t + 0.02, 0.15, 2400, 0.07, 5);
      },
      chuckle: function (t) {
        var n = [293.66, 246.94, 261.63, 220.0], dt = 0.15;
        for (var i = 0; i < n.length; i++) {
          var tt = t + i * dt, f = n[i];
          var o = { f: f * 0.96, f2: f, gt: 0.03, a: 0.02, h: 0.035, r: 0.04, peak: i === 3 ? 0.17 : 0.2, lp: 1300 };
          if (oddWave) o.wave = oddWave; else { o.type = 'triangle'; }
          tone(tt, o);
          tone(tt, { f: f * 0.5, a: 0.02, h: 0.03, r: 0.04, peak: 0.05 });
          noise(tt, { buf: bufP, type: 'bandpass', f: 900, q: 0.8, a: 0.015, r: 0.03, peak: 0.025 });
        }
      },
      basket: function (t) {
        for (var i = 0; i < 5; i++) noise(t + i * 0.014 + Math.random() * 0.008, { type: 'bandpass', f: rnd(1500, 2200), q: 4, a: 0.001, r: 0.006, peak: rnd(0.08, 0.14) });
        knock(t, 520, 0.1, 0.03);
      },
      tap: function (t) {
        tone(t, { f: 480, f2: 380, gt: 0.03, a: 0.002, r: 0.02, peak: 0.08 });
        noise(t, { buf: bufP, type: 'lowpass', f: 1800, a: 0.001, r: 0.008, peak: 0.06 });
      },
      ending: function (t) {
        var b = 0.46;
        var mel = [[0, 659.25], [1, 783.99], [2, 1046.5], [3, 783.99], [4, 880.0], [5, 783.99], [6, 659.25], [7, 698.46],
                   [8, 587.33], [9, 659.25], [10, 587.33], [11, 523.25]];
        for (var i = 0; i < mel.length; i++) bell(t + mel[i][0] * b, mel[i][1], 0.12, i === mel.length - 1 ? 1.1 : 0.55);
        var bass = [[0, 261.63], [2, 329.63], [4, 349.23], [6, 261.63], [8, 196.0], [10, 196.0], [11, 261.63]];
        for (var j = 0; j < bass.length; j++) tone(t + bass[j][0] * b, { f: bass[j][1], a: 0.004, r: j === bass.length - 1 ? 1.0 : 0.45, peak: 0.06 });
      }
    };
    var noThrottleCap = { alldone: 1, ending: 1, chuckle: 1 };

    // ---------- 鳥と部屋 ----------
    function chirp() {
      if (!running() || !ambientOn) return;
      var t = ctx.currentTime + 0.02, out = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 4200; out.gain.value = 1;
      var pan = null;
      if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = rnd(-0.8, 0.2); out.connect(pan); pan.connect(lp); }
      else out.connect(lp);
      lp.connect(ambBus);
      var kind = Math.random(), n = 2 + Math.floor(Math.random() * 3), base = rnd(2300, 3100), vol = rnd(0.02, 0.035);
      var saveD = D, saveR = R; D = out; R = 1;
      for (var i = 0; i < n; i++) {
        var tt = t + i * rnd(0.09, 0.14);
        if (kind < 0.5) tone(tt, { f: base, f2: base * 1.35, gt: 0.045, a: 0.008, h: 0.02, r: 0.015, peak: vol });
        else tone(tt, { f: base * 1.3, f2: base * 0.9, gt: 0.06, a: 0.01, h: 0.03, r: 0.02, peak: vol });
      }
      D = saveD; R = saveR;
      setTimeout(function () { try { out.disconnect(); lp.disconnect(); if (pan) pan.disconnect(); } catch (e) {} }, 2000);
    }
    function birdLoop() {
      birdTimer = 0;
      if (!ambientOn || failed) return;
      try { if (Math.random() < 0.85) chirp(); } catch (e) {}
      birdTimer = setTimeout(birdLoop, rnd(2500, 7000));
    }

    // ---------- どんぐりの ころころ ----------
    function rollLoop() {
      rollTimer = 0;
      if (!alive() || rollSpeed < 0.02) return;
      try {
        if (running()) {
          var now = ctx.currentTime, horizon = now + 0.1;
          if (rollNext < now) rollNext = now + 0.005;
          var saveD = D, saveR = R; D = sfxBus; R = 1;
          while (rollNext < horizon) {
            var v = rollSpeed;
            noise(rollNext, { type: 'bandpass', f: rnd(1600, 2800), q: 3.5, a: 0.001, r: rnd(0.004, 0.008), peak: 0.07 * v * rnd(0.5, 1) });
            if (Math.random() < 0.3) tone(rollNext, { f: rnd(900, 1300), a: 0.001, r: 0.008, peak: 0.025 * v });
            rollNext += (0.11 - 0.075 * v) * rnd(0.6, 1.4);
          }
          D = saveD; R = saveR;
        }
      } catch (e) {}
      rollTimer = setTimeout(rollLoop, 40);
    }

    // ---------- 公開 API ----------
    var api = {
      unlock: function () {
        if (failed) return;
        try {
          if (!ctx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { failed = true; return; }
            ctx = new AC();
            build();
          }
          if (!userSuspended && ctx.state !== 'running') {
            var p = ctx.resume(); if (p && p.catch) p.catch(function () {});
          }
          // iOS: タッチの中で無音を1つ鳴らして解錠
          var s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
        } catch (e) { failed = true; ctx = null; }
      },
      suspend: function () {
        userSuspended = true;
        if (!alive()) return;
        try { var p = ctx.suspend(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      },
      resume: function () {
        userSuspended = false;
        if (!alive()) return;
        try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      },
      setAmbient: function (on) {
        on = !!on;
        if (on === ambientOn) return;
        ambientOn = on;
        if (on && !birdTimer) birdTimer = setTimeout(birdLoop, rnd(800, 2500));
        if (!on && birdTimer) { clearTimeout(birdTimer); birdTimer = 0; }
        if (!alive()) return;
        try { ambBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.6); } catch (e) {}
      },
      setSteam: function (level) {
        if (!alive() || !loops) return;
        try {
          var l = G.clamp(+level || 0, 0, 1), t = ctx.currentTime;
          loops.steam.g.gain.setTargetAtTime(0.2 * Math.pow(l, 1.2), t, 0.07);
          loops.steam.lp.frequency.setTargetAtTime(2200 + 3300 * l, t, 0.1);
        } catch (e) {}
      },
      setSlide: function (speed) {
        if (!alive() || !loops) return;
        try {
          var v = G.clamp(+speed || 0, 0, 1), t = ctx.currentTime;
          loops.slide.g.gain.setTargetAtTime(0.28 * Math.pow(v, 0.9), t, 0.05);
          loops.slide.lp.frequency.setTargetAtTime(320 + 700 * v, t, 0.08);
        } catch (e) {}
      },
      setRoll: function (speed) {
        rollSpeed = G.clamp(+speed || 0, 0, 1);
        if (!alive()) return;
        if (rollSpeed >= 0.02 && !rollTimer) rollLoop();
      },
      play: function (name, opts) {
        // 解錠直後（resume 完了待ち）でも予約する: 最初のタッチの音を落とさない
        if (!alive() || userSuspended || ctx.state === 'closed' || !S.hasOwnProperty(name)) return;
        try {
          var ms = nowMs();
          if (lastPlay[name] && ms - lastPlay[name] < 40) return;
          while (recent.length && ms - recent[0] > 120) recent.shift();
          if (recent.length >= 10 && !noThrottleCap[name]) return;
          lastPlay[name] = ms; recent.push(ms);
          opts = opts || {};
          var vol = opts.vol == null ? 1 : G.clamp(+opts.vol || 0, 0, 1);
          if (vol <= 0.001) return;
          var rate = opts.rate == null ? 1 : G.clamp(+opts.rate || 1, 0.25, 4);
          var out = ctx.createGain(); out.gain.value = vol; out.connect(sfxBus);
          D = out; R = rate;
          S[name](ctx.currentTime + 0.005);
          D = null; R = 1;
          setTimeout(function () { try { out.disconnect(); } catch (e) {} }, name === 'ending' ? 14000 : 3000);
        } catch (e) { D = null; R = 1; }
      }
    };
    Object.defineProperty(api, 'ready', {
      enumerable: true,
      get: function () { return !!ctx && !failed && ctx.state === 'running'; }
    });
    return api;
  };
})();

/* flow.js */
/* flow.js — お話の進行・手がかり・保存: G.createFlow(ctx)
   basket → iron → dock → acorn → hang → papa → ending →（次の色で basket）
   時間で進む演出は update(dt) の中の小さなシーケンサで進める（setTimeout に頼らない）。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};
  var DEG = Math.PI / 180;
  var STATES = ['basket', 'iron', 'dock', 'acorn', 'hang', 'papa', 'ending'];

  G.createFlow = function (ctx) {
    var L = G.L, scene = ctx.scene;

    // ------------------------------------------------------------ 部品
    var stage = G.createStage(ctx); scene.add(stage.group);
    var shirt = G.createShirt(ctx); scene.add(shirt.group);
    var steam = G.createSteam(ctx); scene.add(steam.points);
    var iron = G.createIron(ctx); scene.add(iron.group); scene.add(iron.stand); iron.attachSteam(steam);
    var acorn = G.createAcorn(ctx); scene.add(acorn.group);
    // パパは最初の場面に出ないので、起動を軽くするため遊んでいる間に裏で読み込んで作る（G.need('papa')）。
    // 作るまでは見えない仮のパパ（見えていない時の分岐はすべて papa.group.visible で避けられる）
    var papa = { group: { visible: false }, setPulse: function () {} }, papaLoaded = false;
    function attachPapa() {
      if (papaLoaded || typeof G.createPapa !== 'function') return papaLoaded;
      var p = G.createPapa(ctx); p.group.visible = false; scene.add(p.group);
      // 回避: papa.js が makeFabricMaterial に repeat を配列で渡し、法線マップの repeat が NaN（シャツが真っ黒）になる
      p.group.traverse(function (o) {
        var ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (var i = 0; i < ms.length; i++) {
          var nm = ms[i] && ms[i].normalMap;
          if (nm && !(isFinite(nm.repeat.x) && isFinite(nm.repeat.y))) nm.repeat.set(24, 24);
        }
      });
      papa = p; papaLoaded = true;
      try { if (G.app && G.app.warm) G.app.warm(p.group); } catch (e) { /* 登場時に作られるだけ */ }
      return true;
    }
    // 読み込みが済んだら、手が空いている時（ドラッグ中でない時）に作る。急ぐ時（パパの場面の直前）は force
    var papaWant = false;
    function preparePapa(force) {
      if (papaLoaded) return true;
      papaWant = true;
      if (typeof G.createPapa !== 'function') { if (G.need) G.need('papa'); return false; }
      if (!force && (held || (G.input && G.input.active))) return false;
      try { attachPapa(); } catch (e) { if (window.console) console.error('[flow] papa', e); }
      return papaLoaded;
    }
    var finger = G.createGhostFinger(ctx); scene.add(finger.group);
    var audio = G.createAudio();
    var NCOL = G.SHIRT_COLORS.length;

    // ------------------------------------------------------------ 配置の定数
    var MAT_B = { minX: -0.58, maxX: 0.58, minZ: -0.48, maxZ: 0.60 };
    var SHIRT_Y = L.matTop + 0.004;
    var HEAP_REST = new THREE.Vector3(L.basket.x, 0.03, L.basket.z);
    var HEAP_LAND = new THREE.Vector3(0, L.matTop, 0.0);
    var STAND_P = new THREE.Vector3(L.stand.x, 0.06, L.stand.z);
    var BASKET_P = new THREE.Vector3(L.basket.x, 0.12, L.basket.z);
    var HOOK_P = new THREE.Vector3(L.hook.x, L.hook.y - 0.10, L.hook.z + 0.03);
    var MAT_MID = new THREE.Vector3(0, L.matTop + 0.02, 0.04);
    var anchor = stage.hanger.collarAnchor;
    var COLLAR_FLAT = new THREE.Vector3(0, L.matTop + 0.01, -0.372);
    // えりを動かす斜めの面（平置きのえり位置とハンガーの anchor を通り X 軸に平行）
    var liftPlane = new THREE.Plane();
    (function () {
      var d = new THREE.Vector3().subVectors(anchor, COLLAR_FLAT);
      var n = new THREE.Vector3(0, -d.z, d.y).normalize();
      liftPlane.setFromNormalAndCoplanarPoint(n, COLLAR_FLAT);
    })();

    // ------------------------------------------------------------ カメラ
    var CAM_FLOOR = { look: [0, 0, 0.16], pitch: 55, yaw: 0, fov: 50, fit: { w: 1.03, h: 1.25 } };
    var CAM_HANG = { look: [0, 0.72, -0.55], pitch: 20, yaw: 0, fov: 50, fit: { w: 1.05, h: 1.75 } };
    // 縦長では幅で距離が決まるので、注視点を下げて少し見下ろし、マット上のシャツの全身も入れる
    var camAcorn = { look: [0, L.matTop, 0], pitch: 60, yaw: 0, fov: 50, fit: { w: 0.75, h: 0.6 } };
    var camPapa = { look: [0, 0.6, -0.58], pitch: -4, yaw: 0, fov: 36, dist: 2.5 };
    var camName = '';
    var PAPA_TOP = 1.49;          // パパの奥行き（首の後ろ）での画面上端の上限。neckY 1.52 より少し下
    // 横長の画面では床の場面を少し引いて、かごと充電台を画面内に入れる
    function adaptCams() {
      var s = G.app && G.app.size, asp = s && s.h > 0 ? s.w / s.h : 0.46, land = asp > 1.05;
      CAM_FLOOR.look[2] = land ? 0.25 : 0.16; CAM_FLOOR.fit.h = land ? 1.62 : 1.25; CAM_FLOOR.pitch = land ? 60 : 55;
      CAM_HANG.look[1] = land ? 0.60 : 0.60; CAM_HANG.look[2] = land ? -0.38 : -0.40; CAM_HANG.pitch = land ? 31 : 27; CAM_HANG.fit.h = land ? 2.1 : 1.75;
    }
    adaptCams();
    function shot(name, spec, dur) {
      if (camName === name && dur > 0) return;
      camName = name; G.cam.shot(spec, dur);
    }
    // u: 0=全身(PAPA_FULL) 1=胸の寄り(PAPA_CLOSE)。zCur: いまのパパの z（奥にいるほど上端は高く映るので厳しく）
    var papaU = 0, papaUAnim = null;
    function solvePapa(u, zCur) {
      var s = G.app && G.app.size, asp = s && s.h > 0 ? s.w / s.h : 0.46;
      var fov = G.lerp(36, 30, u), half = fov * DEG / 2, tv = Math.tan(half);
      // 画面上端の光線の仰角。全身は子どもの目線（ほぼ水平に見上げる）、寄りは目線を上げて少し見下ろす
      var a = G.lerp(20, 6, u) * DEG, th = half - a;
      var bottom = G.lerp(-0.05, 0.88, u), width = G.lerp(0.9, 0.36, u), cx = G.lerp(0, 0.055, u);
      var zF = L.papa.z + 0.12;                       // 構図を測る面（胸の前）
      var dF = Math.max(width / 2 / (tv * asp), (PAPA_TOP - bottom) / 2 / tv);
      var zc = zF + dF;                               // カメラの z
      var zBack = Math.min(L.papa.z, zCur) - 0.10;    // 首の後ろ（最も奥。奥にいるほど上端は高く映るので厳しく）
      // 上端の光線: y(z) = camY + (zc - z) * tan(a) を zBack で PAPA_TOP 以下に（手前ほど低い）
      var camY = PAPA_TOP - (zc - zBack) * Math.tan(a);
      // パパが奥（廊下）にいる間もカメラを床より下げない: 高さを保ち、上端の光線を寝かせて上端の保証を守る
      if (camY < 0.30) { camY = 0.30; a = Math.atan((PAPA_TOP - camY) / (zc - zBack)); th = half - a; }
      var ly = camY - dF * Math.tan(th);
      camPapa.fov = fov; camPapa.pitch = th / DEG; camPapa.dist = dF / Math.cos(th);
      camPapa.look[0] = cx; camPapa.look[1] = ly; camPapa.look[2] = zF;
    }

    // ------------------------------------------------------------ 状態
    var S = { state: 'basket', round: 0, color: 0 };
    var held = null;              // 'heap' | 'iron' | 'acorn' | 'shirt'
    var lock = false;             // 自動の流れの途中（主役の操作を受けない）
    var now = 0;
    var idle = 0, callT = 0, fingerOn = false, misses = 0;
    var seq = [];
    var popped = false, ironGrabbed = false, autoPop = false;
    var bumpCount = 0, lastBumpT = -9, wasBump = false;
    var stillT = 0, lastSide = 0, tickT = 0, kickT = 0, laughT = 0;
    var bulgeCur = 1, bulgeTarget = 1, bulgeOsc = { x: 0, v: 0 };
    var door = { v: 0, from: 0, to: 0, t: 0, dur: 0 };
    var heap = { pos: HEAP_REST.clone(), tgt: HEAP_REST.clone(), fly: null, hopT: 1.2, hop: -1, hopAmp: 0.012 };
    var walking = false, stepT = 0, papaReady = false, endT = 0, leaving = false, hangSwingT = 2;
    var down = { x: 0, y: 0, t: 0, moved: false };
    var dirty = false, saveT = 0;
    var steamOut = 0;

    // 使い回しのベクトル
    var hv = new THREE.Vector3(), tv3 = new THREE.Vector3(), tv4 = new THREE.Vector3(), lp = new THREE.Vector3();
    var pocketMouth = new THREE.Vector3(), papaPocket = new THREE.Vector3();
    var scr = { x: 0, y: 0 }, sphere = new THREE.Sphere();
    var accVel = { x: 0, z: 0, px: 0, pz: 0, pt: 0 };

    // ------------------------------------------------------------ 小道具
    function after(delay, fn) { seq.push({ t: now + delay, fn: fn }); }
    function play(name, opts) { try { audio.play(name, opts); } catch (e) { /* 音は無くても進む */ } }
    function screenDist(v, p) {
      G.cam.toScreen(v, scr);
      if (scr.behind) return 1e9;
      var dx = scr.x - p.x, dy = scr.y - p.y; return Math.sqrt(dx * dx + dy * dy);
    }
    function raySphere(ray, c, r) { sphere.center.copy(c); sphere.radius = r; return ray.intersectsSphere(sphere); }
    function onMat(x, z) { return Math.abs(x) < L.mat.w / 2 && Math.abs(z) < L.mat.d / 2; }
    function surfY(x, z) {
      if (shirt.mode === 'flat' && shirt.contains(x, z)) return SHIRT_Y;
      if (onMat(x, z)) return L.matTop;
      return 0;
    }
    function ironPos(out) { return out.copy(iron.group.position).setY(iron.group.position.y + 0.07); }
    function stopFinger() {
      fingerOn = false;
      if (finger.active) { finger.stop(); finger.group.visible = false; }
    }
    function touched() { idle = 0; callT = 0; stopFinger(); }
    function markDirty() { dirty = true; }

    // ------------------------------------------------------------ 保存
    function r3(v) { return Math.round(v * 1000) / 1000; }
    function save() {
      try {
        G.save.store({
          state: S.state, round: S.round, color: S.color, shirt: shirt.serialize(),
          iron: { mode: iron.mode, x: r3(iron.group.position.x), z: r3(iron.group.position.z) },
          acorn: { mode: acorn.mode, x: r3(acorn.pos.x), z: r3(acorn.pos.z) }
        });
      } catch (e) { /* 保存できなくても遊べる */ }
      dirty = false; saveT = 0;
    }

    // ------------------------------------------------------------ 場面に入る
    function focusIron() { stage.focusOn(ironPos(tv3), 0.2); }
    function setupAcornCam(snap) {
      var a = acorn.pos, m = pocketMouth;
      var mx = (a.x + m.x) / 2, mz = (a.z + m.z) / 2;
      var w = Math.max(0.75, Math.abs(a.x - m.x) + 0.38), h = Math.max(0.62, Math.abs(a.z - m.z) + 0.42);
      if (snap) {
        camAcorn.look[0] = mx; camAcorn.look[2] = mz + 0.02; camAcorn.fit.w = w; camAcorn.fit.h = h;
      } else {
        return { x: mx, z: mz + 0.02, w: w, h: h };
      }
      return null;
    }
    function enterState(name, instant) {
      S.state = name; lock = false; idle = 0; callT = 0; misses = 0; stopFinger();
      iron.setInvite(false); iron.setStandInvite(false); acorn.setGlint(false); shirt.setGlow(0); papa.setPulse(false);
      var d = instant ? 0 : 1.4;
      switch (name) {
        case 'basket':
          shot('floor', CAM_FLOOR, instant ? 0 : 1.8);
          popped = false; ironGrabbed = false; autoPop = false; bumpCount = 0;
          bulgeCur = bulgeTarget = 1;
          heap.pos.copy(HEAP_REST); heap.tgt.copy(HEAP_REST); heap.fly = null;
          if (shirt.mode !== 'heap') shirt.setHeap(HEAP_REST.x, HEAP_REST.y, HEAP_REST.z);
          stage.focusOn(stage.basketMouth, 0.24);
          shirt.setGlow(0.5);
          break;
        case 'iron':
          shot('floor', CAM_FLOOR, d);
          if (!ironGrabbed) { iron.setInvite(true); focusIron(); }
          else { var wp = shirt.wrinkliestPoint(); if (wp) stage.focusOn(wp, 0.22); else focusIron(); }
          break;
        case 'dock':
          shot('floor', CAM_FLOOR, d);
          iron.setStandInvite(true);
          stage.focusOn(STAND_P, 0.2);
          break;
        case 'acorn':
          pocketMouth.copy(shirt.pocketWorld());
          setupAcornCam(true);
          camName = ''; shot('acorn', camAcorn, d);
          acorn.setGlint(true);
          stage.focusOn(acorn.pos, 0.1);
          break;
        case 'hang':
          shot('hang', CAM_HANG, d);
          stage.focusOn(anchor, 0.3);
          shirt.setGlow(0.6);
          hangSwingT = 1.5;
          break;
        case 'papa':
          startPapa();
          break;
        case 'ending':
          startEnding();
          break;
      }
      save();
    }

    // ------------------------------------------------------------ papa / ending の自動の流れ
    function doorTo(v, dur) { door.from = door.v; door.to = v; door.t = 0; door.dur = Math.max(0.01, dur); }
    function startPapa() {
      lock = true; papaReady = false; leaving = false;
      stage.focusOn(null);
      play('door'); doorTo(1, 1.1);
      after(0.9, function () { shirt.pullAway(1); play('whisk'); stage.hanger.swing(0.9); });
      after(1.8, function () { play('pickup', { vol: 0.7 }); });
      after(2.25, function () { play('pickup', { vol: 0.6, rate: 1.12 }); });
      after(2.4, function () {
        papaU = 0; papaUAnim = null;
        solvePapa(0, L.wallZ - 0.6);
        camName = 'papa'; G.cam.shot(camPapa, 1.5);
      });
      after(4.0, function spawn() {
        if (!preparePapa(true)) { after(0.25, spawn); return; } // まだ届いていなければ少し待つ
        papa.setShirtColor(S.color); papa.pocketBulge = 1; papa.acornPeek = 0;
        var x0 = L.door.x, z0 = L.wallZ - 0.6;
        papa.group.position.set(x0, 0, z0);
        papa.group.rotation.y = Math.atan2(L.papa.x - x0, L.papa.z - z0);
        papa.group.visible = true;
        walking = true; stepT = 0.1;
        papa.walkTo(L.papa.x, L.papa.z, 2.4, function () {
          walking = false; papa.faceTo(0, 0.6);
          after(0.55, function () {
            papaUAnim = { from: papaU, to: 1, t: 0, dur: 1.4, cb: function () {
              papa.setPulse(true); papaReady = true; lock = false; idle = 0; callT = 0;
              stage.focusOn(papa.pocketWorld(papaPocket), 0.12);
            } };
          });
        });
      });
    }
    function papaLaugh(big) {
      if (now - laughT < 0.5) return;
      laughT = now;
      papa.chuckle(); play('chuckle', { vol: big ? 1 : 0.8 }); papa.tieSwing(big ? 0.6 : 0.35);
    }
    function startEnding() {
      papaReady = false; leaving = false; endT = 8;
      stage.setMood('warm'); play('ending');
      stage.focusOn(null);
      after(1.6, function () { if (!leaving) papaLaugh(false); });
    }
    function leave() {
      leaving = true; lock = true; stopFinger();
      papa.acornPeek = 0;
      papaUAnim = { from: papaU, to: 0, t: 0, dur: 1.2, cb: null };
      after(0.9, function () {
        walking = true; stepT = 0.15;
        papa.walkTo(L.door.x, L.wallZ - 0.6, 2.4, function () {
          walking = false; papa.group.visible = false;
          play('door', { vol: 0.8 }); doorTo(0, 1.0);
          after(1.1, function () {
            stage.setMood('morning');
            S.round++; S.color = (S.color + 1) % NCOL;
            acorn.hide();
            shirt.reset(S.color);       // 画面が止まっている間に（約300ms）
            after(0.1, function () { enterState('basket'); });
          });
        });
      });
    }

    // ------------------------------------------------------------ どんぐり
    function popAcorn() {
      if (popped) return;
      popped = true; bulgeTarget = 0; bulgeCur = 0;
      var m = shirt.pocketWorld();
      acorn.popFrom(m.x, m.y + 0.03, m.z, -1.15, 1.5, 0.95);
      play('pop'); play('kotsun', { vol: 0.6 });
      if (S.state !== 'papa' && S.state !== 'ending') G.cam.shake(0.006, 0.3);
      markDirty();
    }
    acorn.onBump = function (s) { play('tok', { vol: G.clamp(s * 1.2, 0.15, 1) }); };

    // ------------------------------------------------------------ シャツのできあがり
    var REG_SND = { collar: 'pin', sleeveL: 'crease', sleeveR: 'crease', bodyL: 'panel', bodyR: 'panel' };
    shirt.onRegionDone = function (name, c) {
      play(REG_SND[name] || 'panel');
      if (c) steam.burst(c.x, c.y + 0.01, c.z, 0.35);
      markDirty();
    };
    shirt.onAllDone = function () {
      play('alldone'); iron.burst(1); play('burst'); shirt.sheen();
      if (!popped && !autoPop) { autoPop = true; after(0.7, function () { if (!popped) { bulgeOsc.v += 14; popAcorn(); } }); }
      if (S.state === 'iron') enterState('dock');
    };

    // ------------------------------------------------------------ 手がかり
    function hintPath() {
      var st = S.state, pts = [];
      if (st === 'basket') { pts.push(BASKET_P.clone().setY(0.2), MAT_MID.clone()); }
      else if (st === 'iron') {
        var a = ironPos(new THREE.Vector3()), w = shirt.wrinkliestPoint() || new THREE.Vector3(0, SHIRT_Y, 0);
        w.y = SHIRT_Y;
        pts.push(a, w.clone().add(tv4.set(0.16, 0, 0)), w.clone().add(tv4.set(-0.16, 0, 0)), w.clone().add(tv4.set(0.16, 0, 0)), w.clone().add(tv4.set(-0.16, 0, 0)));
      } else if (st === 'dock') { pts.push(ironPos(new THREE.Vector3()), STAND_P.clone().setY(0.08)); }
      else if (st === 'acorn') { pts.push(acorn.pos.clone(), pocketMouth.clone()); }
      else if (st === 'hang') { pts.push(COLLAR_FLAT.clone(), anchor.clone()); }
      else if (st === 'papa') { pts.push(papa.pocketWorld(new THREE.Vector3())); }
      return pts;
    }
    function playHint() {
      var pts = hintPath();
      if (!pts.length) return;
      var size = S.state === 'papa' ? 0.075 : (S.state === 'acorn' ? 0.075 : (S.state === 'hang' ? 0.14 : 0.11));
      finger.play(pts, { dur: S.state === 'iron' ? 2.6 : 1.6, loop: true, pause: 1.0, size: size });
      fingerOn = true;
    }
    function callOut() { // 3.5s〜: 身じろぎ・明滅を強め、小さな音で呼ぶ
      var st = S.state;
      if (st === 'basket') { stage.basketWobble(); heap.hop = 0; heap.hopAmp = 0.03; play('basket', { vol: 0.55 }); }
      else if (st === 'iron') { iron.setInvite(true); focusIron(); play('puff', { vol: 0.5 }); }
      else if (st === 'dock') { if (iron.mode === 'rest') { iron.bump(0.7); iron.burst(0.2); } play('puff', { vol: 0.5 }); }
      else if (st === 'acorn') { if (acorn.mode === 'free') { if (acorn.rollSpeed < 0.05) acorn.popFrom(acorn.pos.x, acorn.pos.y, acorn.pos.z, 0, 0.75, 0); play('tok', { vol: 0.35 }); } }   // その場で ぴょこん
      else if (st === 'hang') { stage.hanger.swing(0.45); play('clink', { vol: 0.3 }); }
      else if (st === 'papa' && papaReady) { papa.tieSwing(0.15); play('pop', { vol: 0.25 }); }
    }
    function cueUpdate(dt) {
      var interactive = !lock && !held && S.state !== 'ending' && (S.state !== 'papa' || papaReady);
      if (!interactive) return;
      idle += dt;
      if (idle >= 3.5) { callT -= dt; if (callT <= 0) { callT = 3; callOut(); } }
      if (idle >= 7 && !fingerOn) playHint();
    }

    // ------------------------------------------------------------ 発見（主役でない物に触れた時）
    function discover(p) {
      var ray = p.ray;
      if (acorn.mode === 'free' && S.state !== 'acorn' && (acorn.hitTest(ray) || screenDist(acorn.pos, p) < 50)) {
        acorn.kick((Math.random() - 0.5) * 0.5, 0.15 + Math.random() * 0.2); play('tok', { vol: 0.5 }); return true;
      }
      if (iron.mode !== 'held' && (iron.hitTest(ray) || screenDist(ironPos(tv3), p) < 50)) {
        iron.bump(0.6); iron.burst(0.25); play('puff'); return true;
      }
      if (raySphere(ray, BASKET_P, 0.19)) { stage.basketWobble(); play('basket'); return true; }
      if (raySphere(ray, HOOK_P, 0.16) && shirt.mode !== 'hung') { stage.hanger.swing(0.6); play('clink', { vol: 0.45 }); return true; }
      if (shirt.mode === 'hung' && shirt.hitTest(ray)) { shirt.swing(1.0); stage.hanger.swing(0.5); play('swish', { vol: 0.6 }); return true; }
      if (papa.group.visible) {
        var h = papa.hitTest(ray);
        if (h === 'tie') { papa.tieSwing(1); play('tap', { vol: 0.5 }); return true; }
      }
      return false;
    }

    // ------------------------------------------------------------ 持つ・離す
    function grabIron(p) {
      held = 'iron';
      if (!ironGrabbed) { ironGrabbed = true; iron.setInvite(false); if (S.state === 'iron') stage.focusOn(null); }
      iron.setInvite(false);
      iron.grab();
      if (!p.hitPlaneY(L.matTop, hv)) hv.copy(iron.group.position);
      moveIronTo(hv);
      play('lift');
      stillT = 0; wasBump = false;
      misses = 0;
    }
    function moveIronTo(h) {
      var x = G.clamp(h.x, -0.78, 0.78), z = G.clamp(h.z - 0.05, -0.62, 0.95);
      var y = surfY(x, z);
      var dsx = x - L.stand.x, dsz = z - L.stand.z;
      if (dsx * dsx + dsz * dsz < 0.15 * 0.15) y = 0.05;
      iron.moveTo(x, z, y);
    }
    function releaseIron(cancelled) {
      held = null;
      var s = iron.sole;
      var dsx = s.x - L.stand.x, dsz = s.z - L.stand.z, d2 = dsx * dsx + dsz * dsz;
      var near = S.state === 'dock' ? d2 < 0.30 * 0.30 : iron.nearStand(s.x, s.z);
      iron.steamLevel = 0;
      if (near && !cancelled) {
        iron.dock(function () {
          play('dock'); iron.burst(0.3);
          if (S.state === 'dock') enterState('acorn'); else markDirty();
        });
      } else {
        iron.release(); play('rest');
        if (S.state === 'iron') {
          var wp = shirt.wrinkliestPoint();
          if (wp) stage.focusOn(wp, 0.22); else focusIron();
        } else if (S.state === 'dock') stage.focusOn(STAND_P, 0.2);
      }
      markDirty();
    }
    function releaseHeap() {
      held = null;
      heap.fly = { t: 0, dur: 0.42, from: heap.pos.clone(), to: HEAP_LAND.clone() };
      play('swish', { vol: 0.6 });
    }
    function liftPoint(p, out) {
      if (!p.ray.intersectPlane(liftPlane, out)) return false;
      var y = G.clamp(out.y, L.matTop + 0.02, anchor.y);
      var k = (y - COLLAR_FLAT.y) / (anchor.y - COLLAR_FLAT.y);
      out.set(G.clamp(out.x, -0.4, 0.4), y, G.lerp(COLLAR_FLAT.z, anchor.z, k));
      return true;
    }
    function releaseShirt(cancelled) {
      held = null;
      var d = lp.distanceTo(anchor);
      if (!cancelled && (d < 0.35 || lp.y >= anchor.y * 0.7)) {
        shirt.hangAt(anchor);
        play('clink'); stage.hanger.swing(0.8); shirt.swing(1.0);
        stage.focusOn(null); shirt.setGlow(0);
        lock = true;
        after(1.2, function () { enterState('papa'); });
      } else {
        shirt.dropFlat(); play('flop');
      }
    }
    function holdAcorn(p) {
      var y = L.matTop + 0.05;
      if (!p.hitPlaneY(y, hv)) return;
      acorn.hold(G.clamp(hv.x, MAT_B.minX, MAT_B.maxX), y, G.clamp(hv.z - 0.035, MAT_B.minZ, MAT_B.maxZ));
    }
    function releaseAcorn(cancelled) {
      held = null;
      acorn.setGlint(true);
      var dx = acorn.pos.x - pocketMouth.x, dz = acorn.pos.z - pocketMouth.z;
      if (!cancelled && dx * dx + dz * dz < 0.14 * 0.14) {
        acorn.hide(); play('pocket');
        bulgeTarget = 1; bulgeOsc.v += 10;
        stage.focusOn(pocketMouth, 0.12);
        lock = true;
        after(0.7, function () { enterState('hang'); });
        return;
      }
      if (!down.moved && !cancelled) {
        acorn.release(0, 0);
        acorn.kick((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.45); play('tok', { vol: 0.5 });
      } else {
        acorn.release(G.clamp(accVel.x * 0.5, -0.8, 0.8), G.clamp(accVel.z * 0.5, -0.8, 0.8));
      }
      stage.focusOn(acorn.pos, 0.1);
      markDirty();
    }

    // ------------------------------------------------------------ 入力
    function onDown(p) {
      touched();
      down.x = p.x; down.y = p.y; down.t = now; down.moved = false;
      if (held) return;
      var st = S.state, ray = p.ray;
      if (lock) { if (!discover(p)) play('tap', { vol: 0.35 }); return; }

      if (st === 'basket') {
        if (shirt.mode === 'heap' && !heap.fly && (shirt.hitTest(ray) || raySphere(ray, BASKET_P, 0.2) || screenDist(BASKET_P, p) < 80)) {
          held = 'heap'; misses = 0;
          play('pickup'); stage.basketWobble();
          if (p.hitPlaneY(0.2, hv)) heap.tgt.set(hv.x, 0.12, hv.z);
          return;
        }
        if (discover(p)) return;
        play('tap', { vol: 0.4 }); heap.hop = 0; heap.hopAmp = 0.03;
        if (++misses >= 2) idle = 7;
        return;
      }
      if (st === 'iron' || st === 'dock') {
        if (iron.mode !== 'docking' && (iron.hitTest(ray) || screenDist(ironPos(tv3), p) < 80)) { grabIron(p); return; }
        if (st === 'iron' && !popped && shirt.mode === 'flat' && screenDist(tv3.copy(shirt.pocketWorld()), p) < 40) {
          bulgeOsc.v += 14; play('kotsun'); popAcorn(); return;
        }
        if (discover(p)) return;
        if (shirt.mode === 'flat' && shirt.hitTest(ray)) {
          play('tap'); iron.bump(0.8); iron.burst(0.25); play('puff', { vol: 0.6 });
          if (++misses >= 2) idle = 7;
          return;
        }
        play('tap', { vol: 0.35 });
        return;
      }
      if (st === 'acorn') {
        if (acorn.mode !== 'hidden' && (acorn.hitTest(ray) || screenDist(acorn.pos, p) < 90)) {
          held = 'acorn'; misses = 0;
          acorn.setGlint(false);
          holdAcorn(p);
          accVel.x = accVel.z = 0; accVel.px = acorn.pos.x; accVel.pz = acorn.pos.z; accVel.pt = now;
          stage.focusOn(pocketMouth, 0.1);
          play('tok', { vol: 0.4 });
          return;
        }
        if (discover(p)) return;
        play('tap', { vol: 0.35 });
        if (++misses >= 2) idle = 7;
        return;
      }
      if (st === 'hang') {
        if (shirt.mode === 'flat' || shirt.mode === 'lift') {
          if (shirt.hitTest(ray) || screenDist(COLLAR_FLAT, p) < 80) {
            held = 'shirt'; misses = 0;
            play('swish');
            if (liftPoint(p, lp)) shirt.setLift(lp.x, lp.y, lp.z);
            return;
          }
        }
        if (discover(p)) return;
        play('tap', { vol: 0.35 });
        if (++misses >= 2) idle = 7;
        return;
      }
      if (st === 'papa') {
        if (!papaReady) { if (!discover(p)) play('tap', { vol: 0.35 }); return; }
        var h = papa.hitTest(ray);
        if (h === 'tie') { papa.tieSwing(1); play('tap', { vol: 0.5 }); return; }
        papa.acornPeek = 1; play('pop', { vol: 0.6 });
        papaLaugh(true);
        enterState('ending');
        return;
      }
      if (st === 'ending') {
        if (leaving) { if (!discover(p)) play('tap', { vol: 0.35 }); return; }
        var h2 = papa.hitTest(ray);
        if (h2 === 'tie') { papa.tieSwing(1); play('tap', { vol: 0.5 }); }
        else papaLaugh(false);
        endT = Math.max(endT, 3);
      }
    }
    function onMove(p) {
      if (!down.moved) { var dx = p.x - down.x, dy = p.y - down.y; if (dx * dx + dy * dy > 100) down.moved = true; }
      if (!held) return;
      idle = 0;
      if (held === 'heap') { if (p.hitPlaneY(0.2, hv)) heap.tgt.set(G.clamp(hv.x, -0.8, 0.8), 0.12, G.clamp(hv.z, -0.7, 1.0)); }
      else if (held === 'iron') { if (p.hitPlaneY(L.matTop, hv)) moveIronTo(hv); }
      else if (held === 'acorn') { holdAcorn(p); }
      else if (held === 'shirt') { if (liftPoint(p, lp)) shirt.setLift(lp.x, lp.y, lp.z); }
    }
    function onUp(p) {
      var c = !!p.cancelled;
      if (held === 'heap') releaseHeap();
      else if (held === 'iron') releaseIron(c);
      else if (held === 'acorn') releaseAcorn(c);
      else if (held === 'shirt') releaseShirt(c);
      held = null;
      idle = 0;
    }

    // ------------------------------------------------------------ アイロンがけ（毎フレーム、持っている時）
    function ironing(dt) {
      var s = iron.sole, spd = iron.speed;
      if (shirt.mode !== 'flat') { iron.steamLevel = 0.2; return; }
      var on = shirt.contains(s.x, s.z), mat = onMat(s.x, s.z);
      var amount = Math.min(0.5, dt * (2.6 + 2.2 * Math.min(spd, 1.5)));
      var r = shirt.ironAt(s.x, s.z, 0.10, amount);
      if (r.removed > 0) markDirty();
      // 湯気
      var lvl;
      if (spd < 0.04) lvl = 0.1;
      else if (on) lvl = 0.4 + 0.6 * Math.min(1, spd / 1.2);
      else if (mat) lvl = 0.2;
      else lvl = 0.05;
      iron.steamLevel = lvl;
      audio.setSteam(lvl); steamOut = lvl;
      audio.setSlide(mat ? Math.min(1, spd / 1.2) * (on ? 1 : 0.5) : 0);
      // 止めてから動かすと ぼふっ
      if (on && spd < 0.05) stillT += dt;
      else {
        if (stillT >= 0.9 && spd > 0.25) { iron.burst(0.8); play('burst'); }
        if (spd >= 0.05) stillT = 0;
      }
      // ポケットの こつん
      if (r.bump && !wasBump && now - lastBumpT >= 0.4) {
        lastBumpT = now; bumpCount++;
        iron.bump(1); play('kotsun'); bulgeOsc.v += 12;
        if (bumpCount >= 2) popAcorn();
      } else if (r.bump && now - lastBumpT > 0.8 && spd > 0.1) {
        lastBumpT = now; bumpCount++; iron.bump(0.8); play('kotsun'); bulgeOsc.v += 10;
        if (bumpCount >= 2) popAcorn();
      }
      wasBump = r.bump;
      // 前立てのボタン
      var side = s.x > 0.005 ? 1 : (s.x < -0.005 ? -1 : 0);
      if (on && side !== 0 && lastSide !== 0 && side !== lastSide && s.z > -0.33 && tickT <= 0) { play('tick'); tickT = 0.12; }
      if (side !== 0) lastSide = side;
      // どんぐりを押しのける
      if (acorn.mode === 'free' && kickT <= 0) {
        var dx = acorn.pos.x - s.x, dz = acorn.pos.z - s.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d < 0.095) {
          var v = Math.max(0.35, spd * 0.9); if (d < 1e-4) { dx = 0; dz = 1; d = 1; }
          acorn.kick(dx / d * v, dz / d * v); kickT = 0.25;
        }
      }
    }

    // ------------------------------------------------------------ 毎フレーム
    function update(dt, t) {
      dt = G.clamp(dt || 0, 0, 0.05);
      now += dt;
      // シーケンサ
      for (var i = 0; i < seq.length; i++) {
        if (seq[i].t <= now) { var f = seq[i].fn; seq.splice(i, 1); i--; try { f(); } catch (e) { if (window.console) console.error(e); } }
      }
      if (tickT > 0) tickT -= dt;
      if (kickT > 0) kickT -= dt;

      // ドア
      if (door.t < door.dur) { door.t = Math.min(door.dur, door.t + dt); door.v = G.lerp(door.from, door.to, door.t / door.dur); stage.setDoor(door.v); }

      // かごの山
      if (S.state === 'basket' && shirt.mode === 'heap') {
        if (heap.fly) {
          var fl = heap.fly; fl.t += dt;
          var k = G.clamp(fl.t / fl.dur, 0, 1), e = G.easeInOut(k);
          heap.pos.lerpVectors(fl.from, fl.to, e); heap.pos.y += Math.sin(Math.PI * k) * 0.16;
          shirt.setHeap(heap.pos.x, heap.pos.y, heap.pos.z);
          if (k >= 1) {
            heap.fly = null;
            shirt.setGlow(0); stage.focusOn(null);
            shirt.unfurl(); play('unfurl'); G.cam.shake(0.004, 0.25);
            enterState('iron');
          }
        } else {
          if (held !== 'heap') heap.tgt.copy(HEAP_REST);
          var lam = held === 'heap' ? 14 : 8;
          heap.pos.x = G.damp(heap.pos.x, heap.tgt.x, lam, dt); heap.pos.y = G.damp(heap.pos.y, heap.tgt.y, lam, dt); heap.pos.z = G.damp(heap.pos.z, heap.tgt.z, lam, dt);
          // ときどき もぞっ
          if (held !== 'heap') { heap.hopT -= dt; if (heap.hopT <= 0) { heap.hopT = 2.4; heap.hop = 0; heap.hopAmp = idle >= 3.5 ? 0.03 : 0.012; } }
          var off = 0;
          if (heap.hop >= 0) { heap.hop += dt; var hk = heap.hop / 0.36; if (hk >= 1) heap.hop = -1; else off = Math.sin(Math.PI * hk) * heap.hopAmp; }
          shirt.setHeap(heap.pos.x, heap.pos.y + off, heap.pos.z);
        }
      }

      // アイロン
      if (held === 'iron') { /* 目標は onMove で更新 */ }
      iron.update(dt, t);
      if (held === 'iron') ironing(dt);
      else if (steamOut > 0) { steamOut = 0; audio.setSteam(0); audio.setSlide(0); }
      steam.update(dt);

      // ポケットのこぶ
      bulgeOsc.v += (-300 * bulgeOsc.x - 9 * bulgeOsc.v) * dt; bulgeOsc.x += bulgeOsc.v * dt;
      bulgeCur = G.damp(bulgeCur, bulgeTarget, 9, dt);
      if (shirt.mode !== 'gone') shirt.pocketBulge = G.clamp(bulgeCur * (1 - 0.3 * Math.min(1, Math.abs(bulgeOsc.x) * 4)), 0, 1);

      // どんぐり
      if (acorn.mode !== 'hidden') {
        acorn.update(dt, acorn.mode === 'held' ? L.matTop : surfY(acorn.pos.x, acorn.pos.z), stage.colliders, MAT_B);
        audio.setRoll(G.clamp(acorn.rollSpeed / 0.5, 0, 1));
        if (held === 'acorn' && dt > 0) {
          accVel.x = G.damp(accVel.x, (acorn.pos.x - accVel.px) / dt, 10, dt); accVel.z = G.damp(accVel.z, (acorn.pos.z - accVel.pz) / dt, 10, dt);
          accVel.px = acorn.pos.x; accVel.pz = acorn.pos.z;
        }
        if (S.state === 'acorn' && !lock) {
          if (held !== 'acorn') {
            stage.focusOn(acorn.pos, 0.1);
            var want = setupAcornCam(false);
            camAcorn.look[0] = G.damp(camAcorn.look[0], want.x, 1.5, dt); camAcorn.look[2] = G.damp(camAcorn.look[2], want.z, 1.5, dt);
            camAcorn.fit.w = G.damp(camAcorn.fit.w, want.w, 1.5, dt); camAcorn.fit.h = G.damp(camAcorn.fit.h, want.h, 1.5, dt);
          }
        }
      } else audio.setRoll(0);

      // ハンガー
      if (S.state === 'hang' && !lock && !held) { hangSwingT -= dt; if (hangSwingT <= 0) { hangSwingT = 3.2; stage.hanger.swing(0.22); } }

      // パパ（裏で読み込み済みなら、手が空いた時に作っておく。ハンガーの場面に来たら待たずに作る）
      if (papaWant && !papaLoaded) preparePapa(S.state === 'hang' && !held);
      if (papa.group.visible) {
        papa.update(dt, t);
        if (walking) { stepT -= dt; if (stepT <= 0) { stepT = 0.46; play('step', { vol: 0.8 }); } }
      }
      if (S.state === 'papa' || S.state === 'ending') {
        if (papaUAnim) {
          papaUAnim.t += dt;
          var uk = G.clamp(papaUAnim.t / papaUAnim.dur, 0, 1);
          papaU = G.lerp(papaUAnim.from, papaUAnim.to, G.easeInOut(uk));
          if (uk >= 1) { var cb = papaUAnim.cb; papaUAnim = null; if (cb) cb(); }
        }
        if (camName === 'papa') {
          solvePapa(papaU, papa.group.visible ? papa.group.position.z : L.wallZ - 0.6);
          G.cam.update(0);
        }
        if (papaReady) stage.focusOn(papa.pocketWorld(papaPocket), 0.12);
        if (S.state === 'ending' && !leaving) { endT -= dt; if (endT <= 0) leave(); }
      }

      stage.update(dt, t);
      shirt.update(dt, t);
      cueUpdate(dt);
      finger.update(dt);

      if (dirty) { saveT += dt; if (saveT > 2) save(); }
    }

    // ------------------------------------------------------------ 復元
    function finite(v, a, b, d) { v = +v; return isFinite(v) ? G.clamp(v, a, b) : d; }
    function flatNow() {
      shirt.unfurl();
      for (var i = 0; i < 16; i++) shirt.update(0.05, 0);
    }
    function restore(o) {
      if (!o || typeof o !== 'object' || STATES.indexOf(o.state) < 0) return false;
      S.round = Math.max(0, Math.floor(finite(o.round, 0, 1e6, 0)));
      S.color = ((Math.floor(finite(o.color, 0, 1e6, 0)) % NCOL) + NCOL) % NCOL;
      var st = o.state;
      if (st === 'papa' || st === 'ending') { S.round++; S.color = (S.color + 1) % NCOL; st = 'basket'; }
      if (st === 'basket') { if (S.color !== 0) shirt.reset(S.color); enterState('basket', true); return true; }
      var okShirt = false;
      try { okShirt = !!(o.shirt && shirt.restore(o.shirt)); } catch (e) { okShirt = false; }
      if (!okShirt) { shirt.reset(S.color); st = 'iron'; }
      flatNow();
      var bul = shirt.pocketBulge;
      popped = bul < 0.5; ironGrabbed = true;
      if (st === 'hang') popped = false;
      if (st === 'acorn' && !popped) st = 'hang';
      bulgeCur = bulgeTarget = popped ? 0 : 1;
      // アイロン
      var im = o.iron && typeof o.iron === 'object' ? o.iron : null;
      if (im && (im.mode === 'rest' || im.mode === 'held')) {
        var ix = finite(im.x, -0.78, 0.78, 0), iz = finite(im.z, -0.62, 0.95, 0.3);
        iron.setRestAt(ix, iz, surfY(ix, iz));
      } else iron.setDocked();
      if (st === 'iron' && shirt.allDone) st = 'dock';
      if (st === 'dock' && iron.mode === 'docked') st = popped ? 'acorn' : 'hang';
      // どんぐり
      if (popped && st !== 'hang') {
        var am = o.acorn && typeof o.acorn === 'object' ? o.acorn : {};
        var ax = finite(am.x, MAT_B.minX + 0.03, MAT_B.maxX - 0.03, -0.45), az = finite(am.z, MAT_B.minZ + 0.03, MAT_B.maxZ - 0.03, 0.45);
        acorn.show(ax, az, surfY(ax, az));
      } else acorn.hide();
      enterState(st, true);
      return true;
    }

    var started = false;
    try { started = restore(G.save.load()); } catch (e) { started = false; }
    if (!started) {
      S.round = 0; S.color = 0; seq.length = 0;
      try { shirt.reset(0); } catch (e2) { /* noop */ }
      iron.setDocked(); acorn.hide();
      enterState('basket', true);
    }
    G.cam.update(0);

    // ------------------------------------------------------------ core からの呼び出し
    var api = {
      update: update,
      onDown: onDown,
      onMove: onMove,
      onUp: onUp,
      onResize: function () {
        adaptCams();
        if (camName === 'papa') { solvePapa(papaU, papa.group.visible ? papa.group.position.z : L.wallZ - 0.6); }
        G.cam.update(0);
      },
      onPause: function () {
        try { audio.setSteam(0); audio.setSlide(0); audio.setRoll(0); audio.suspend(); } catch (e) { /* noop */ }
        steamOut = 0;
        save();
      },
      onResume: function () { try { audio.resume(); } catch (e) { /* noop */ } },
      onLowPower: function () { /* 部品は ctx.lowPower を作る時に見る。ここでは何もしない */ },
      onFirstTouch: function () { try { audio.unlock(); audio.setAmbient(true); } catch (e) { /* noop */ } },
      // core: 最初の絵が出た後に呼ばれる。残りの部品（パパ）を裏で読み込み始める
      onReady: function () { preparePapa(false); },
      onUserGesture: function () { try { if (!audio.ready) audio.unlock(); } catch (e) { /* noop */ } }
    };
    Object.defineProperty(api, 'state', { enumerable: true, get: function () { return S.state; } });
    return api;
  };
})();
