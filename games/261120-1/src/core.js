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
    // 隠れている物（パパなど）のシェーダも最初に作っておき、登場の瞬間に止まらないようにする
    try { renderer.compile(scene, camera); } catch (e) { report('compile', e); }
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
      try { shadows.update(); } catch (e) { report('shadows', e); shadows.invalidate(); scene.traverse(function (o) { if (o.isLight && o.shadow) o.shadow.autoUpdate = true; }); }
      try { renderer.render(scene, camera); } catch (e) { report('render', e); }
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
