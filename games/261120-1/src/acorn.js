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
