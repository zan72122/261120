/* papa.js — パパ（首から下。ワイシャツ・ネクタイ・ズボン・スリッパ、両手はズボンのポケット）と どんぐり
   G.createPapa(ctx), G.createAcorn(ctx)
   座標: group の原点は床の両足の間。+Z を向いて立つ。パパの左 = +X。 */
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

  // ================================================================ パパ
  G.createPapa = function (ctx) {
    ctx = ctx || {};
    var low = !!ctx.lowPower, aniso = ctx.aniso || 4;
    var Q = low ? 0.6 : 1;
    function seg(n) { return Math.max(8, Math.round(n * Q)); }

    var group = new THREE.Group(); group.name = 'papa';
    var body = new THREE.Group(); group.add(body);                       // 歩きの上下・左右
    var upper = new THREE.Group(); upper.position.y = 0.98; body.add(upper); // 腰から上（呼吸・笑い）
    var upperIn = new THREE.Group(); upperIn.position.y = -0.98; upper.add(upperIn);
    var meshes = [];
    function addMesh(parent, geo, mat, part) {
      var m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.userData.part = part || 'body';
      parent.add(m); meshes.push(m); return m;
    }

    // ---------------- 材質
    var shirtMats = [];
    var hasFabric = typeof G.makeFabricMaterial === 'function';
    function newShirtMat() {
      var m = null;
      if (hasFabric) { try { m = G.makeFabricMaterial({ color: G.SHIRT_COLORS[0], repeat: 24 }); } catch (e) { m = null; } }
      if (!m) {
        var tb = getTex('shirtBump', aniso).clone(); tb.repeat.set(26, 26); tb.needsUpdate = true;
        var tm = getTex('shirtTone', aniso).clone(); tm.repeat.set(9, 9); tm.needsUpdate = true;
        m = new THREE.MeshStandardMaterial({ color: G.SHIRT_COLORS[0], roughness: 0.85, map: tm, bumpMap: tb, bumpScale: 0.35 });
      }
      shirtMats.push(m); return m;
    }
    var shirtMat = newShirtMat();
    var collarMat = newShirtMat(); collarMat.side = THREE.DoubleSide;
    var pocketMat = newShirtMat(); pocketMat.polygonOffset = true; pocketMat.polygonOffsetFactor = -1; pocketMat.polygonOffsetUnits = -2;
    var placketMat = newShirtMat(); placketMat.polygonOffset = true; placketMat.polygonOffsetFactor = -1; placketMat.polygonOffsetUnits = -2;
    var pocketInMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    var stitchTex = getTex('stitch', aniso);
    var stitchMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, transparent: true, opacity: 0.22, alphaMap: stitchTex, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });

    var woolTex = getTex('wool', aniso).clone(); woolTex.repeat.set(14, 14); woolTex.needsUpdate = true;
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x272b38, roughness: 0.93, map: woolTex });
    var pantsDark = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    var leatherTex = getTex('leather', aniso).clone(); leatherTex.repeat.set(30, 30); leatherTex.needsUpdate = true;
    var beltMat = new THREE.MeshPhysicalMaterial({ color: 0x2a1c13, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.5, bumpMap: leatherTex, bumpScale: 0.5 });
    var metalMat = new THREE.MeshStandardMaterial({ color: 0xd2d3d6, metalness: 1, roughness: 0.24 });
    var tieTex = getTex('tie', aniso).clone(); tieTex.repeat.set(7, 7); tieTex.needsUpdate = true;
    var tieMat = new THREE.MeshPhysicalMaterial({ map: tieTex, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x8090b8) });
    var skinTex = getTex('skin', aniso).clone(); skinTex.repeat.set(4, 4); skinTex.needsUpdate = true;
    var skinMat = new THREE.MeshPhysicalMaterial({ color: 0xc99a82, roughness: 0.6, map: skinTex, sheen: 0.25, sheenColor: new THREE.Color(0xffd0b8), sheenRoughness: 0.6 });
    var knitTex = getTex('knit', aniso).clone(); knitTex.repeat.set(1, 3); knitTex.needsUpdate = true;
    var sockMat = new THREE.MeshStandardMaterial({ color: 0x8d8f94, roughness: 0.96, map: knitTex });
    var terryTex = getTex('terry', aniso).clone(); terryTex.repeat.set(3, 3); terryTex.needsUpdate = true;
    var slipMat = new THREE.MeshStandardMaterial({ color: 0x8a7258, roughness: 0.97, map: terryTex, side: THREE.DoubleSide });
    var soleMat = new THREE.MeshStandardMaterial({ color: 0x4b3d31, roughness: 0.85 });
    var pipeMat = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.8 });
    var buttonMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f1ea, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });

    // ---------------- 胴（シャツ）
    var TORSO = makeProfile([
      [0.90, 0.158, 0.098, 0.108, 2.3, 0.0],
      [0.98, 0.160, 0.100, 0.108, 2.3, 0.0],
      [1.04, 0.169, 0.110, 0.112, 2.3, 0.0],
      [1.12, 0.171, 0.113, 0.110, 2.4, 0.0],
      [1.22, 0.179, 0.123, 0.112, 2.5, 0.0],
      [1.30, 0.189, 0.124, 0.114, 2.6, 0.0],
      [1.37, 0.196, 0.114, 0.112, 2.6, 0.0],
      [1.405, 0.194, 0.104, 0.106, 2.6, -0.002],
      [1.432, 0.178, 0.093, 0.097, 2.5, -0.004],
      [1.455, 0.146, 0.082, 0.088, 2.3, -0.006],
      [1.474, 0.104, 0.071, 0.077, 2.1, -0.008],
      [1.49, 0.076, 0.066, 0.068, 2.0, -0.009]
    ]);
    var _p = new THREE.Vector3();
    var torsoGeo = gridGeom(seg(72), seg(70), function (u, v, out) {
      var th = u * Math.PI * 2, y = G.lerp(0.905, 1.49, v);
      TORSO.point(y, th, out);
      // すそ上のふんわり（ベルトの上でわずかにたるむ）と脇の自然なしわ
      var blouse = G.smooth(0.99, 1.02, y) * (1 - G.smooth(1.05, 1.13, y));
      var m = blouse * (0.010 * Math.sin(th * 7 + 1.1) + 0.006 * Math.sin(th * 13 + 0.4));
      var side = Math.abs(Math.sin(th));
      m += 0.006 * Math.pow(side, 6) * Math.sin(y * 70 + th) * G.smooth(1.06, 1.15, y) * (1 - G.smooth(1.26, 1.32, y));
      out.x *= 1 + m; out.z = (out.z) * (1 + m);
    }, { closedU: true, axisY: true });
    addMesh(upperIn, torsoGeo, shirtMat);

    // ---------------- 首
    var neckGeo = gridGeom(seg(32), 10, function (u, v, out) {
      var th = u * Math.PI * 2, y = G.lerp(1.44, 1.66, v);
      var r = 0.056 - 0.004 * G.smooth(1.46, 1.58, y) + 0.001 * G.smooth(1.6, 1.66, y);
      out.set(Math.sin(th) * r, y, -0.012 + Math.cos(th) * r * 0.93 + 0.012 * G.smooth(1.48, 1.66, y));
    }, { closedU: true, axisY: true });
    addMesh(upperIn, neckGeo, skinMat);

    // ---------------- 台えり
    var bandGeo = gridGeom(seg(56), 6, function (u, v, out) {
      var th = u * Math.PI * 2, c = Math.cos(th);
      var front = G.smooth(0.2, 1, c);
      var y = G.lerp(1.462, 1.538 - 0.012 * front, v);
      var r = 0.0675 - 0.004 * v;
      out.set(Math.sin(th) * r, y, -0.009 + c * r * 0.96);
    }, { closedU: true, axisY: true });
    addMesh(upperIn, bandGeo, collarMat);

    // ---------------- えりの羽根（左右）
    var _cn = new THREE.Vector3();
    function collarLeaf(sx) {
      return gridGeom(seg(40), 7, function (u, v, out) {
        // u: 0=背中の中心 → 1=前の先端,  v: 0=折り山 → 1=外のふち
        var s = u;
        var thT = G.lerp(Math.PI, 0.30, s), thB = G.lerp(Math.PI, 0.62, Math.pow(s, 1.15));
        var front = G.smooth(0.62, 1, s);
        var yT = 1.540 - 0.018 * front;
        var yB = G.lerp(1.488, 1.476, G.smooth(0, 0.6, s)) - 0.050 * Math.pow(front, 1.4);
        var th = G.lerp(thT, thB, v * v * 0.6 + v * 0.4);
        var y = G.lerp(yT, yB, v);
        // 折り山の半径（台えりの外）→ 外のふちは肩の面の少し上
        var rT = 0.0705 + 0.012 * front;
        var cth = Math.cos(th), sth = Math.sin(th);
        var top = _cn.set(sth * rT, yT, -0.009 + cth * rT * 0.96);
        TORSO.point(Math.min(y, 1.488), th, _p);
        TORSO.normal(Math.min(y, 1.488), th, out);
        var bx = _p.x + out.x * 0.004, bz = _p.z + out.z * 0.004;
        var rr = Math.sqrt(bx * bx + (bz + 0.009) * (bz + 0.009));
        var rB = Math.max(rr, rT + 0.006) + 0.003;
        var r = G.lerp(rT, rB, v) + 0.006 * Math.sin(Math.PI * v) + 0.010 * front * Math.sin(Math.PI * v);
        void top;
        out.set(sx * sth * r, y, -0.009 + cth * r * 0.96);
      }, { out: function (P, o) { o.set(P.x, 0.4, P.z + 0.009); } });
    }
    addMesh(upperIn, collarLeaf(1), collarMat);
    addMesh(upperIn, collarLeaf(-1), collarMat);

    // ---------------- そで
    var _d = new THREE.Vector3();
    function sleeve(sx) {
      var pts = [
        new THREE.Vector3(sx * 0.125, 1.386, -0.006),
        new THREE.Vector3(sx * 0.180, 1.392, -0.006),
        new THREE.Vector3(sx * 0.218, 1.330, -0.012),
        new THREE.Vector3(sx * 0.238, 1.225, -0.024),
        new THREE.Vector3(sx * 0.240, 1.120, -0.028),
        new THREE.Vector3(sx * 0.224, 1.030, 0.006),
        new THREE.Vector3(sx * 0.195, 0.962, 0.040),
        new THREE.Vector3(sx * 0.160, 0.912, 0.050),
        new THREE.Vector3(sx * 0.140, 0.886, 0.040)
      ];
      var path = makePath(pts, 160, new THREE.Vector3(0, 0, 1));
      return sweepGeom(path, seg(28), seg(130), function (t, D, r) {
        var base;
        if (t < 0.08) base = G.lerp(0.046, 0.053, t / 0.08);
        else if (t < 0.25) base = 0.053;
        else if (t < 0.5) base = G.lerp(0.053, 0.046, (t - 0.25) / 0.25);
        else if (t < 0.86) base = G.lerp(0.046, 0.0395, (t - 0.5) / 0.36);
        else base = 0.0425;                       // カフス
        if (t > 0.855 && t < 0.865) base = G.lerp(0.0395, 0.0425, (t - 0.855) / 0.01);
        r.a = base; r.b = base * 0.93;
        var outw = D.x * sx, fwd = D.z;
        var m = 0;
        // 外側の折り目（アイロンの線）
        m += 0.035 * Math.exp(-(1 - outw) * 90) * G.smooth(0.28, 0.36, t) * (1 - G.smooth(0.8, 0.85, t));
        // ひじの内側のしわ
        m += 0.035 * gauss(t - 0.53, 0.06) * Math.pow(Math.max(0, fwd), 2) * Math.sin(t * 110 + Math.atan2(D.y, D.x) * 2);
        // カフスの上のたるみ
        m += 0.045 * gauss(t - 0.82, 0.03) * Math.sin(Math.atan2(D.z, D.x) * 5 + 1.0);
        // 肩口
        m += 0.02 * gauss(t - 0.2, 0.05) * Math.sin(Math.atan2(D.z, D.y) * 4);
        r.m = m;
      }, { uvScale: [1, 1] });
    }
    addMesh(upperIn, sleeve(1), shirtMat);
    addMesh(upperIn, sleeve(-1), shirtMat);
    // カフスのふち（ステッチ）は省略、カフス境目はジオメトリの段差で表現

    // ---------------- 前立て
    var Y_PLK0 = 0.955, Y_PLK1 = 1.47;
    var placketGeo = gridGeom(8, seg(60), function (u, v, out) {
      var x = G.lerp(-0.0195, 0.0195, u), y = G.lerp(Y_PLK0, Y_PLK1, v);
      var th = TORSO.thAtX(x, y);
      TORSO.point(y, th, _p); TORSO.normal(y, th, _d);
      var off = 0.0006 + 0.0016 * (1 - G.smooth(0.0145, 0.0195, Math.abs(x)));
      out.copy(_p).addScaledVector(_d, off);
    }, { out: function (P, o) { o.set(0, 0, 1); } });
    addMesh(upperIn, placketGeo, placketMat);

    // ステッチの帯
    function stitchStrip(points, normals, width, period) {
      var n = points.length, pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [], acc = 0;
      var side = new THREE.Vector3(), tan = new THREE.Vector3();
      for (var i = 0; i < n; i++) {
        var p = points[i], nn = normals[i];
        tan.subVectors(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]).normalize();
        side.crossVectors(nn, tan).normalize().multiplyScalar(width * 0.5);
        if (i > 0) acc += p.distanceTo(points[i - 1]);
        pos.set([p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z], i * 6);
        uv.set([acc / period, 0, acc / period, 1], i * 4);
        if (i < n - 1) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      // 法線を表面の向きに
      var na = g.attributes.normal;
      for (i = 0; i < n; i++) { na.setXYZ(i * 2, normals[i].x, normals[i].y, normals[i].z); na.setXYZ(i * 2 + 1, normals[i].x, normals[i].y, normals[i].z); }
      g.computeBoundingSphere();
      return g;
    }
    function torsoLine(x, y0, y1, n, off) {
      var P = [], Nn = [];
      for (var i = 0; i <= n; i++) {
        var y = G.lerp(y0, y1, i / n), th = TORSO.thAtX(x, y);
        var p = TORSO.point(y, th, new THREE.Vector3()), nn = TORSO.normal(y, th, new THREE.Vector3());
        p.addScaledVector(nn, off); P.push(p); Nn.push(nn);
      }
      return [P, Nn];
    }
    var stA = torsoLine(0.0135, Y_PLK0, Y_PLK1, 50, 0.0026), stB = torsoLine(-0.0135, Y_PLK0, Y_PLK1, 50, 0.0026);
    var stMesh1 = new THREE.Mesh(stitchStrip(stA[0], stA[1], 0.0012, 0.0032), stitchMat);
    var stMesh2 = new THREE.Mesh(stitchStrip(stB[0], stB[1], 0.0012, 0.0032), stitchMat);
    upperIn.add(stMesh1, stMesh2);

    // ボタン
    var btnGeo = new THREE.CylinderGeometry(0.0054, 0.0054, 0.0019, 18);
    var holeGeo = new THREE.CircleGeometry(0.0007, 8);
    var holeMat = new THREE.MeshBasicMaterial({ color: 0x8c877c });
    [1.062, 1.158, 1.254, 1.350, 1.446].forEach(function (y) {
      var th = TORSO.thAtX(0, y), p = TORSO.point(y, th, new THREE.Vector3()), nn = TORSO.normal(y, th, new THREE.Vector3());
      var b = addMesh(upperIn, btnGeo, buttonMat);
      b.position.copy(p).addScaledVector(nn, 0.0032);
      b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nn);
      for (var h = 0; h < 4; h++) {
        var hm = new THREE.Mesh(holeGeo, holeMat);
        hm.position.set((h % 2 ? 1 : -1) * 0.0013, 0.00097, (h < 2 ? 1 : -1) * 0.0013); hm.rotation.x = -Math.PI / 2;
        b.add(hm);
      }
    });

    // ---------------- 胸ポケット（パパの左 = +X）
    var PK = { x0: 0.050, x1: 0.160, yb: 1.210, yt: 1.330, cx: 0.105 };
    var PNU = low ? 16 : 26, PNV = low ? 18 : 28, MARG = 0.0045;
    var pkBase = [], pkNor = [], pkXY = [];
    (function () {
      for (var j = 0; j <= PNV; j++) for (var i = 0; i <= PNU; i++) {
        var x = G.lerp(PK.x0 - MARG, PK.x1 + MARG, i / PNU), y = G.lerp(PK.yt, PK.yb - MARG - 0.004, j / PNV);
        var th = TORSO.thAtX(x, y);
        pkBase.push(TORSO.point(y, th, new THREE.Vector3())); pkNor.push(TORSO.normal(y, th, new THREE.Vector3())); pkXY.push([x, y]);
      }
    })();
    function pkBottom(x) { // 下の角を斜めに落とす
      var e = Math.abs((x - PK.cx) / ((PK.x1 - PK.x0) * 0.5));
      return PK.yb + 0.012 * G.clamp((e - 0.78) / 0.22, 0, 1);
    }
    var pkState = { bulge: -1, gap: -1, peek: -1, wig: -1 };
    function pkOffset(x, y, bulge, gap, peek, wig) {
      var dOut = Math.max(PK.x0 - x, x - PK.x1, pkBottom(x) - y, 0);
      var inside = 1 - G.smooth(0, MARG, dOut);
      var u = (x - PK.x0) / (PK.x1 - PK.x0), v = (PK.yt - y) / (PK.yt - PK.yb); // v: 0=口 1=底
      var uc = G.clamp(u, 0, 1), vc = G.clamp(v, 0, 1);
      var off = 0.0021;
      off += 0.0007 * (1 - G.smooth(0.10, 0.15, v));                    // 口の折り返し
      var bx = 0.5 + wig * 0.10;
      off += bulge * 0.011 * gauss(uc - bx, 0.30) * Math.sin(Math.PI * G.clamp((vc - 0.12) / 0.88, 0, 1));
      off += peek * 0.016 * gauss(uc - 0.5, 0.24) * gauss(vc, 0.42);
      off += gap * (1 - G.smooth(0, 0.45, vc)) * (1 - Math.pow(Math.abs(uc * 2 - 1), 4));
      return off * inside + 0.00025;
    }
    var pkPos = new Float32Array((PNU + 1) * (PNV + 1) * 3), pkUV = new Float32Array((PNU + 1) * (PNV + 1) * 2), pkIdx = [];
    for (var pj = 0; pj < PNV; pj++) for (var pi = 0; pi < PNU; pi++) {
      var a0 = pj * (PNU + 1) + pi, b0 = a0 + 1, c0 = a0 + PNU + 1, d0 = c0 + 1;
      pkIdx.push(a0, b0, c0, b0, d0, c0);
    }
    for (var q = 0; q < pkXY.length; q++) { pkUV[q * 2] = pkXY[q][0] * 26; pkUV[q * 2 + 1] = pkXY[q][1] * 26; }
    var pkGeo = new THREE.BufferGeometry();
    pkGeo.setAttribute('position', new THREE.BufferAttribute(pkPos, 3));
    pkGeo.setAttribute('uv', new THREE.BufferAttribute(pkUV, 2));
    pkGeo.setIndex(pkIdx);
    var pocketMesh = addMesh(upperIn, pkGeo, pocketMat, 'pocket');
    // ポケットの中（口から見える暗いところ）
    var pinGeo = gridGeom(10, 4, function (u, v, out) {
      var x = G.lerp(PK.x0 + 0.003, PK.x1 - 0.003, u), y = G.lerp(PK.yt - 0.0005, PK.yt - 0.03, v);
      var th = TORSO.thAtX(x, y); TORSO.point(y, th, out); TORSO.normal(y, th, _d); out.addScaledVector(_d, 0.0007);
    }, { out: function (P, o) { o.set(0, 0, 1); } });
    var pocketIn = new THREE.Mesh(pinGeo, pocketInMat); upperIn.add(pocketIn);
    // ポケットのステッチ
    var pkStitch = new THREE.Mesh(new THREE.BufferGeometry(), stitchMat); upperIn.add(pkStitch);
    var pkHem = new THREE.Mesh(new THREE.BufferGeometry(), stitchMat); upperIn.add(pkHem);
    function surfPt(x, y, bulge, gap, peek, wig, extra, outP, outN) {
      var th = TORSO.thAtX(x, y); TORSO.point(y, th, outP); TORSO.normal(y, th, outN);
      outP.addScaledVector(outN, pkOffset(x, y, bulge, gap, peek, wig) + extra);
    }
    // 頂点数が同じなら GPU のバッファを作り直さず中身だけ差し替える（ポケットが動くたびの確保・破棄を避ける）
    function swapStrip(mesh, ng) {
      var og = mesh.geometry, oa = og.attributes;
      if (oa.position && oa.position.count === ng.attributes.position.count && og.index && og.index.count === ng.index.count) {
        ['position', 'uv', 'normal'].forEach(function (k) { oa[k].copyArray(ng.attributes[k].array); oa[k].needsUpdate = true; });
        og.boundingSphere = ng.boundingSphere;
      } else { og.dispose(); mesh.geometry = ng; }
    }
    function rebuildPocket(bulge, gap, peek, wig) {
      for (var k = 0; k < pkXY.length; k++) {
        var o = pkOffset(pkXY[k][0], pkXY[k][1], bulge, gap, peek, wig), b = pkBase[k], n = pkNor[k];
        pkPos[k * 3] = b.x + n.x * o; pkPos[k * 3 + 1] = b.y + n.y * o; pkPos[k * 3 + 2] = b.z + n.z * o;
      }
      pkGeo.attributes.position.needsUpdate = true;
      pkGeo.computeVertexNormals(); pkGeo.computeBoundingSphere();
      // 縁のステッチ: 左辺→底→右辺
      var P = [], Nn = [], ins = 0.0032, i2, x, y;
      var L = 24;
      for (i2 = 0; i2 <= L; i2++) { y = G.lerp(PK.yt - 0.002, pkBottom(PK.x0 + ins) + ins, i2 / L); P.push(new THREE.Vector3()); Nn.push(new THREE.Vector3()); surfPt(PK.x0 + ins, y, bulge, gap, peek, wig, 0.0004, P[P.length - 1], Nn[Nn.length - 1]); }
      for (i2 = 1; i2 <= L; i2++) { x = G.lerp(PK.x0 + ins, PK.x1 - ins, i2 / L); y = pkBottom(x) + ins; P.push(new THREE.Vector3()); Nn.push(new THREE.Vector3()); surfPt(x, y, bulge, gap, peek, wig, 0.0004, P[P.length - 1], Nn[Nn.length - 1]); }
      for (i2 = 1; i2 <= L; i2++) { y = G.lerp(pkBottom(PK.x1 - ins) + ins, PK.yt - 0.002, i2 / L); P.push(new THREE.Vector3()); Nn.push(new THREE.Vector3()); surfPt(PK.x1 - ins, y, bulge, gap, peek, wig, 0.0004, P[P.length - 1], Nn[Nn.length - 1]); }
      swapStrip(pkStitch, stitchStrip(P, Nn, 0.0011, 0.0032));
      var P2 = [], N2 = [];
      for (i2 = 0; i2 <= L; i2++) { x = G.lerp(PK.x0 + 0.002, PK.x1 - 0.002, i2 / L); P2.push(new THREE.Vector3()); N2.push(new THREE.Vector3()); surfPt(x, PK.yt - 0.0145, bulge, gap, peek, wig, 0.0004, P2[i2], N2[i2]); }
      swapStrip(pkHem, stitchStrip(P2, N2, 0.0011, 0.0032));
      // 巻き順の確認（初回）
      if (!rebuildPocket.checked) {
        rebuildPocket.checked = true;
        var nz = pkGeo.attributes.normal.getZ(Math.floor(pkXY.length / 2));
        if (nz < 0) { for (var t = 0; t < pkIdx.length; t += 3) { var tmp = pkIdx[t + 1]; pkIdx[t + 1] = pkIdx[t + 2]; pkIdx[t + 2] = tmp; } pkGeo.setIndex(pkIdx); pkGeo.computeVertexNormals(); }
      }
    }
    rebuildPocket(0, 0, 0, 0);
    // ポケットの口の中心（upperIn ローカル）
    var pkMouthLocal = new THREE.Vector3(), pkMouthN = new THREE.Vector3(), pkUp = new THREE.Vector3();
    (function () {
      var th = TORSO.thAtX(PK.cx, PK.yt); TORSO.point(PK.yt, th, pkMouthLocal); TORSO.normal(PK.yt, th, pkMouthN);
      var th2 = TORSO.thAtX(PK.cx, PK.yt - 0.02), p2 = TORSO.point(PK.yt - 0.02, th2, new THREE.Vector3());
      pkUp.subVectors(pkMouthLocal, p2).normalize();
    })();
    // 顔を出すどんぐり
    var peekAcorn = buildAcornMesh(aniso, low);
    var peekHolder = new THREE.Group(); peekHolder.add(peekAcorn); upperIn.add(peekHolder);
    peekHolder.visible = false;
    (function () {
      var m = new THREE.Matrix4(), xAxis = new THREE.Vector3().crossVectors(pkUp, pkMouthN).normalize();
      var zAxis = new THREE.Vector3().crossVectors(xAxis, pkUp).normalize();
      m.makeBasis(xAxis, pkUp, zAxis); peekHolder.quaternion.setFromRotationMatrix(m);
    })();
    peekAcorn.rotation.z = 0.12; peekAcorn.rotation.y = 0.6;
    peekAcorn.traverse(function (m) { if (m.isMesh) m.userData.part = 'pocket'; });

    // ---------------- ネクタイ
    function frontZ(y) { return TORSO.point(y, 0, _p).z; }
    var KNOT_Y = 1.468, TIP_Y = 1.088, CHEST_Y = 1.26;
    var knotZ = 0.072;
    var knotGeo = gridGeom(seg(24), 10, function (u, v, out) {
      var th = u * Math.PI * 2, y = G.lerp(1.517, 1.462, v);
      var w = G.lerp(0.024, 0.0135, v) * (1 + 0.08 * Math.sin(Math.PI * v));
      var d = G.lerp(0.0125, 0.0085, v);
      var zc = G.lerp(0.066, 0.080, v);
      var c = Math.cos(th), s = Math.sin(th);
      var dimple = 1 - 0.25 * gauss(s, 0.25) * Math.max(0, c) * gauss(v - 0.55, 0.25);
      out.set(s * w * (1 + 0.1 * Math.max(0, c)), y, zc + c * d * dimple);
    }, { closedU: true, axisY: true });
    var tieKnot = addMesh(upperIn, knotGeo, tieMat, 'tie');
    var tiePivot = new THREE.Group(); tiePivot.position.set(0, KNOT_Y, knotZ + 0.006); upperIn.add(tiePivot);
    var zChest = frontZ(CHEST_Y) + 0.004;
    var tieGeo = gridGeom(seg(20), seg(64), function (u, v, out) {
      var y = G.lerp(KNOT_Y + 0.008, TIP_Y, v);
      var tipStart = TIP_Y + 0.040;
      var w = G.lerp(0.034, 0.084, G.smooth(KNOT_Y, TIP_Y + 0.08, y) * 0.6 + G.clamp((KNOT_Y - y) / (KNOT_Y - tipStart), 0, 1) * 0.4);
      if (y < tipStart) w *= Math.max(0.0001, (y - TIP_Y) / (tipStart - TIP_Y));
      var zc = frontZ(y) + 0.0045;
      if (y < CHEST_Y) zc = Math.max(zc, zChest - 0.08 * (CHEST_Y - y));
      if (y > 1.42) zc = Math.max(zc, G.lerp(zc, knotZ + 0.010, G.smooth(1.42, KNOT_Y + 0.008, y)));
      var th = u * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      var thick = c > 0 ? 0.0032 : 0.0014;
      out.set(s * w * 0.5, y, zc + c * thick + 0.0012 * (1 - s * s));
    }, { closedU: true });
    tieGeo.translate(0, -KNOT_Y, -(knotZ + 0.006));
    var tieBlade = addMesh(tiePivot, tieGeo, tieMat, 'tie');

    // ---------------- ズボン（腰まわり）
    var PELVIS = makeProfile([
      [0.740, 0.030, 0.024, 0.024, 2.0, 0.0],
      [0.772, 0.085, 0.064, 0.034, 2.0, 0.0],
      [0.792, 0.132, 0.084, 0.085, 2.4, 0.0],
      [0.820, 0.168, 0.101, 0.122, 3.0, -0.004],
      [0.845, 0.176, 0.108, 0.128, 3.0, -0.005],
      [0.870, 0.181, 0.110, 0.130, 2.8, -0.005],
      [0.930, 0.180, 0.108, 0.122, 2.4, 0.0],
      [0.970, 0.175, 0.107, 0.116, 2.3, 0.0],
      [0.999, 0.172, 0.106, 0.113, 2.3, 0.0],
      [1.006, 0.168, 0.104, 0.110, 2.3, 0.0],
      [1.008, 0.160, 0.099, 0.107, 2.3, 0.0]
    ]);
    var pelvisGeo = gridGeom(seg(72), seg(40), function (u, v, out) {
      var th = u * Math.PI * 2, y = G.lerp(0.740, 1.008, v);
      PELVIS.point(y, th, out);
    }, { closedU: true, axisY: true });
    addMesh(body, pelvisGeo, pantsMat);
    // ポケットの口（斜め）と、中の手のふくらみ
    function pelvisLine(pts2, off) {
      var P = [], Nn = [];
      for (var i = 0; i < pts2.length; i++) {
        var th = PELVIS.thAtX(pts2[i][0], pts2[i][1]);
        var p = PELVIS.point(pts2[i][1], th, new THREE.Vector3()), nn = PELVIS.normal(pts2[i][1], th, new THREE.Vector3());
        p.addScaledVector(nn, off); P.push(p); Nn.push(nn);
      }
      return [P, Nn];
    }
    var slitMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 });
    [1, -1].forEach(function (sx) {
      var pts2 = [];
      for (var i = 0; i <= 20; i++) { var t = i / 20; pts2.push([sx * G.lerp(0.118, 0.177, Math.pow(t, 1.25)), G.lerp(0.998, 0.842, t)]); }
      pts2 = pts2.map(function (p) { return [p[0], p[1]]; });
      var L1 = pelvisLine(pts2.map(function (p) { return [Math.abs(p[0]), p[1]]; }), 0.0009);
      if (sx < 0) L1[0].forEach(function (p, k) { p.x = -p.x; L1[1][k].x = -L1[1][k].x; });
      body.add(new THREE.Mesh(stitchStrip(L1[0], L1[1], 0.0034, 1), slitMat));
      // 口のふち（少し開いた感じ）
      var L2 = pelvisLine(pts2.map(function (p) { return [Math.abs(p[0]) - 0.005, p[1] - 0.001]; }), 0.0012);
      if (sx < 0) L2[0].forEach(function (p, k) { p.x = -p.x; L2[1][k].x = -L2[1][k].x; });
      var stl = new THREE.Mesh(stitchStrip(L2[0], L2[1], 0.0011, 0.0034), stitchMat); body.add(stl);
      // 手のふくらみ
      var hy = 0.872, hx = 0.150;
      var th = PELVIS.thAtX(hx, hy), hp = PELVIS.point(hy, th, new THREE.Vector3()), hn = PELVIS.normal(hy, th, new THREE.Vector3());
      var bul = addMesh(body, new THREE.SphereGeometry(1, seg(20), seg(14)), pantsMat);
      bul.scale.set(0.030, 0.050, 0.017);
      bul.position.copy(hp).addScaledVector(hn, -0.0075); bul.position.x *= sx;
      var nq = hn.clone(); nq.x *= sx;
      bul.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nq);
      bul.rotateZ(sx * 0.35);
    });
    // 前のファスナーの縫い目
    (function () {
      var pts2 = [];
      for (var i = 0; i <= 18; i++) { var t = i / 18; var y = G.lerp(0.966, 0.858, t); var x = 0.021 - 0.021 * Math.pow(G.smooth(0.72, 1, t), 0.7); pts2.push([x, y]); }
      var L = pelvisLine(pts2, 0.0008);
      body.add(new THREE.Mesh(stitchStrip(L[0], L[1], 0.0011, 0.0034), stitchMat));
      var pts3 = []; for (i = 0; i <= 12; i++) pts3.push([0.0, G.lerp(0.966, 0.86, i / 12)]);
      var L3 = pelvisLine(pts3, 0.0008);
      body.add(new THREE.Mesh(stitchStrip(L3[0], L3[1], 0.0016, 1), new THREE.MeshStandardMaterial({ color: 0x202126, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 })));
    })();

    // ---------------- ベルト
    var BELT_Y = 0.982, BELT_H = 0.032;
    var beltGeo = gridGeom(seg(90), 7, function (u, v, out) {
      var th = u * Math.PI * 2;
      var prof = [[0.0015, -1], [0.0055, -1], [0.0068, -0.82], [0.0068, 0.82], [0.0055, 1], [0.0015, 1]];
      var f = v * 5, i = Math.min(4, Math.floor(f)), t = f - i;
      var off = G.lerp(prof[i][0], prof[i + 1][0], t), yy = BELT_Y + G.lerp(prof[i][1], prof[i + 1][1], t) * BELT_H * 0.5;
      PELVIS.point(yy, th, out); PELVIS.normal(yy, th, _d);
      _d.y = 0; _d.normalize();
      out.addScaledVector(_d, off);
    }, { closedU: true, axisY: true });
    addMesh(body, beltGeo, beltMat);
    // ベルト通し
    var loopGeo = new THREE.BoxGeometry(0.011, 0.042, 0.003);
    [0.62, -0.62, 1.45, -1.45, 2.55, -2.55, Math.PI].forEach(function (th) {
      var p = PELVIS.point(BELT_Y, th, new THREE.Vector3()), nn = PELVIS.normal(BELT_Y, th, new THREE.Vector3()); nn.y = 0; nn.normalize();
      var m = addMesh(body, loopGeo, pantsMat);
      m.position.copy(p).addScaledVector(nn, 0.0085); m.lookAt(m.position.clone().add(nn));
    });
    // 剣先（パパの左へ）
    var tongueGeo = gridGeom(14, 3, function (u, v, out) {
      var x = G.lerp(0.012, 0.078, u);
      var hh = BELT_H * 0.5 * 0.86 * (u > 0.8 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.8) / 0.2, 2))) : 1);
      var yy = BELT_Y + G.lerp(-hh, hh, v);
      var th = PELVIS.thAtX(x, yy); PELVIS.point(yy, th, out); PELVIS.normal(yy, th, _d); _d.y = 0; _d.normalize();
      out.addScaledVector(_d, 0.0092);
    }, { out: function (P, o) { o.set(0, 0, 1); } });
    addMesh(body, tongueGeo, beltMat);
    // バックル
    var buckle = new THREE.Group();
    var bz = PELVIS.point(BELT_Y, 0, new THREE.Vector3()).z + 0.0105;
    buckle.position.set(0.004, BELT_Y, bz);
    var BW = 0.050, BH = 0.040, BT = 0.0048;
    [[0, BH / 2 - BT / 2, BW, BT], [0, -BH / 2 + BT / 2, BW, BT], [-BW / 2 + BT / 2, 0, BT, BH], [BW / 2 - BT / 2, 0, BT, BH]].forEach(function (b) {
      var m = addMesh(buckle, new THREE.BoxGeometry(b[2], b[3], 0.004), metalMat); m.position.set(b[0], b[1], 0);
    });
    body.add(buckle);

    // ---------------- 脚（もも→すね→足）
    var legs = [];
    [1, -1].forEach(function (sx) {
      var hip = new THREE.Group(); hip.position.set(sx * 0.088, 0.88, 0); body.add(hip);
      var thighPath = makePath([new THREE.Vector3(0, 0.03, -0.006), new THREE.Vector3(0, -0.10, -0.002), new THREE.Vector3(sx * 0.002, -0.25, 0.002), new THREE.Vector3(sx * 0.004, -0.415, 0.006), new THREE.Vector3(sx * 0.0045, -0.45, 0.006)], 60, new THREE.Vector3(0, 0, 1));
      var thighGeo = sweepGeom(thighPath, seg(36), seg(40), function (t, D, r) {
        var y = 0.91 - t * 0.48;
        var ax = y > 0.78 ? G.lerp(0.094, 0.070, G.smooth(0.78, 0.87, y)) : G.lerp(0.067, 0.095, G.smooth(0.46, 0.80, y));   // 横: 上端は腰の中に隠す
        var az = G.lerp(0.067, 0.105, G.smooth(0.46, 0.80, y)) * (1 - 0.10 * G.smooth(0.86, 0.91, y));   // 前後: 腰の前の面とつながる（境目を作らない）
        var hem = 1 - 0.13 * G.smooth(0.90, 1.0, t);   // すその端はすねの筒の内側へ入れる（ひざに段差を作らない）
        r.a = az * hem; r.b = ax * 0.95 * hem;
        r.m = 0.05 * Math.exp(-(1 - D.z) * 140) * G.smooth(0.82, 0.76, y) + 0.012 * Math.max(0, -D.z) * Math.sin(t * 40);
      });
      addMesh(hip, thighGeo, pantsMat);
      var knee = new THREE.Group(); knee.position.set(sx * 0.004, -0.40, 0.006); hip.add(knee);
      var shinPath = makePath([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, -0.12, -0.003), new THREE.Vector3(sx * 0.003, -0.28, -0.006), new THREE.Vector3(sx * 0.006, -0.408, -0.008)], 60, new THREE.Vector3(0, 0, 1));
      var shinGeo = sweepGeom(shinPath, seg(36), seg(36), function (t, D, r) {
        var a = G.lerp(0.0655, 0.0575, G.smooth(0.08, 0.7, t)) - 0.006 * (1 - G.smooth(0.02, 0.12, t)) + 0.0035 * G.smooth(0.9, 1, t);
        r.a = a * (1 + 0.04 * G.smooth(0.88, 1, t) * Math.max(0, D.z)); r.b = a * 0.95;
        r.m = 0.05 * Math.exp(-(1 - D.z) * 140) * (1 - G.smooth(0.9, 1, t) * 0.5) + 0.02 * Math.exp(-(1 + D.z) * 140);
      });
      addMesh(knee, shinGeo, pantsMat);
      var ankle = new THREE.Group(); ankle.position.set(sx * 0.006, -0.402, -0.010); knee.add(ankle);
      // 足（ankle の原点は地面から 0.078 上）
      var foot = new THREE.Group(); foot.rotation.y = sx * 0.12; ankle.add(foot);
      var sock = addMesh(foot, new THREE.CylinderGeometry(0.039, 0.042, 0.10, seg(20), 1, true), sockMat); sock.position.set(0, 0.0, -0.004);
      var sockFoot = addMesh(foot, new THREE.SphereGeometry(1, seg(24), seg(16)), sockMat);
      sockFoot.scale.set(0.040, 0.025, 0.110); sockFoot.position.set(0, -0.054, 0.056);
      var heel = addMesh(foot, new THREE.SphereGeometry(1, seg(18), seg(12)), sockMat);
      heel.scale.set(0.039, 0.040, 0.044); heel.position.set(0, -0.040, -0.010);
      // スリッパの底
      var sh = new THREE.Shape();
      var Lh = -0.060, Lt = 0.212;
      sh.moveTo(0, -Lh);
      sh.bezierCurveTo(0.044, -Lh, 0.046, -(Lh + 0.05), 0.046, -0.04);
      sh.bezierCurveTo(0.047, -0.10, 0.056, -0.15, 0.052, -0.18);
      sh.bezierCurveTo(0.046, -Lt, 0.010, -Lt - 0.004, -0.004, -Lt - 0.002);
      sh.bezierCurveTo(-0.040, -Lt, -0.050, -0.18, -0.050, -0.15);
      sh.bezierCurveTo(-0.050, -0.10, -0.044, -0.06, -0.044, -0.04);
      sh.bezierCurveTo(-0.044, -(Lh + 0.05), -0.044, -Lh, 0, -Lh);
      var soleGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: seg(14) });
      soleGeo.rotateX(-Math.PI / 2);
      soleGeo.translate(0, -0.078 + 0.003, 0);
      if (sx < 0) soleGeo.scale(-1, 1, 1);
      var sole = addMesh(foot, soleGeo, soleMat);
      // 中敷き（パイル）
      var padGeo = new THREE.ShapeGeometry(sh, seg(14)); padGeo.rotateX(-Math.PI / 2); padGeo.translate(0, -0.078 + 0.0185, 0);
      if (sx < 0) padGeo.scale(-1, 1, 1);
      var pad = addMesh(foot, padGeo, slipMat); pad.scale.set(0.96, 1, 0.97);
      // 甲（前半分を覆う）
      var upGeo = new THREE.SphereGeometry(1, seg(28), seg(14), 0, Math.PI, 0, Math.PI / 2);
      var up = addMesh(foot, upGeo, slipMat);
      up.scale.set(0.057, 0.044, 0.112); up.position.set(sx * 0.002, -0.078 + 0.017, 0.084);
      // 甲の口のふち
      var edge = addMesh(foot, new THREE.TorusGeometry(1, 0.075, 6, seg(28), Math.PI), pipeMat);
      edge.scale.set(0.057, 0.044, 0.06); edge.position.copy(up.position);
      void sole; void pad;
      legs.push({ sx: sx, hip: hip, knee: knee, ankle: ankle, foot: foot });
    });

    // 足もとのやわらかい影
    var blobMat = new THREE.MeshBasicMaterial({ map: G.softDotTexture(), color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    var blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat);
    blob.rotation.x = -Math.PI / 2; blob.scale.set(0.52, 0.42, 1); blob.position.set(0, 0.0015, 0.04); blob.renderOrder = -1;
    group.add(blob);

    // ---------------- 状態
    var api = {
      group: group, neckY: 1.52, pocketBulge: 0, acornPeek: 0
    };
    var colorIdx = 0, pulse = false, pulseT = 0, peekCur = 0, bulgeCur = 0, wigCur = 0, gapCur = 0;
    var chuckleT = -1, tieZ = 0, tieZv = 0, tieX = 0, tieXv = 0, tieSign = 1;
    var walk = null, turn = null, phase = 0, amp = 0, lastHipL = 0;
    var tmpV = new THREE.Vector3(), rc = new THREE.Raycaster();

    api.setShirtColor = function (i) {
      colorIdx = ((i % G.SHIRT_COLORS.length) + G.SHIRT_COLORS.length) % G.SHIRT_COLORS.length;
      var hex = G.SHIRT_COLORS[colorIdx];
      // 明るい部屋で白く飛ばないよう、少しだけ濃く（床で見たシャツと同じ色に見せる）
      shirtMats.forEach(function (m) {
        if (!m.color) return;
        m.color.setHex(hex);
        m.color.r = Math.pow(m.color.r, 1.4); m.color.g = Math.pow(m.color.g, 1.4); m.color.b = Math.pow(m.color.b, 1.4);
        if (m.sheen !== undefined) m.sheen = 0.2;
      });
      pocketInMat.color.setHex(hex).multiplyScalar(0.28);
    };
    api.setShirtColor(0);
    api.pocketWorld = function (out) {
      out = out || new THREE.Vector3();
      group.updateMatrixWorld(true);
      out.copy(pkMouthLocal).addScaledVector(pkMouthN, 0.008).addScaledVector(pkUp, -0.004);
      return upperIn.localToWorld(out);
    };
    api.setPulse = function (on) { pulse = !!on; };
    api.chuckle = function () { chuckleT = 0; api.tieSwing(0.25); };
    api.tieSwing = function (impulse) {
      impulse = impulse == null ? 1 : impulse;
      tieSign = -tieSign;
      tieZv += tieSign * impulse * 2.4; tieXv += Math.abs(impulse) * 1.6;
    };
    api.walkTo = function (x, z, dur, cb) {
      var p = group.position;
      var dx = x - p.x, dz = z - p.z, dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1e-4) { if (cb) cb(); return; }
      walk = { x0: p.x, z0: p.z, x1: x, z1: z, dist: dist, dur: Math.max(0.3, dur || dist / 0.7), t: 0, cb: cb, yaw: Math.atan2(dx, dz), s: 0 };
      turn = null;
    };
    api.faceTo = function (yaw, dur) {
      var y0 = group.rotation.y, d = yaw - y0;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      turn = { y0: y0, d: d, dur: Math.max(0.05, dur == null ? 0.6 : dur), t: 0 };
    };
    api.hitTest = function (ray) {
      group.updateMatrixWorld(true);
      var pw = api.pocketWorld(tmpV);
      var dPocket = ray.distanceSqToPoint(pw);
      rc.ray.copy(ray); rc.near = 0; rc.far = 100;
      var hits = rc.intersectObjects(meshes, false);
      if (hits.length && hits[0].object.userData.part === 'tie' && dPocket > 0.06 * 0.06) return 'tie';
      if (dPocket < 0.11 * 0.11) return 'pocket';
      if (hits.length) return hits[0].object.userData.part === 'tie' ? 'tie' : (hits[0].object.userData.part === 'pocket' ? 'pocket' : 'body');
      return null;
    };

    function setLegs(hipL, hipR, kneeL, kneeR) {
      var vals = [[hipL, kneeL], [hipR, kneeR]];
      for (var i = 0; i < 2; i++) {
        var L = legs[i], h = vals[i][0], k = vals[i][1];
        L.hip.rotation.x = h; L.knee.rotation.x = k;
        L.ankle.rotation.x = -(h + k) * 0.85 + (k > 0.05 ? -0.0 : 0);
      }
    }

    api.update = function (dt, t) {
      dt = G.clamp(dt || 0, 0, 0.05); t = t || 0;
      // --- 歩き / 向き
      var moving = false, stepAmp = 0;
      if (walk) {
        walk.t += dt;
        var k = G.clamp(walk.t / walk.dur, 0, 1), e = G.easeInOut(k);
        var nx = G.lerp(walk.x0, walk.x1, e), nz = G.lerp(walk.z0, walk.z1, e);
        var ds = Math.sqrt(Math.pow(nx - group.position.x, 2) + Math.pow(nz - group.position.z, 2));
        group.position.x = nx; group.position.z = nz;
        phase += ds / 0.92 * Math.PI * 2;
        var dy = walk.yaw - group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        group.rotation.y += dy * (1 - Math.exp(-8 * dt));
        moving = true; stepAmp = G.smooth(0, 0.18, k) * (1 - G.smooth(0.85, 1, k));
        stepAmp = Math.max(stepAmp, 0.25 * (1 - G.smooth(0.92, 1, k)));
        if (k >= 1) { var cb = walk.cb; walk = null; if (cb) cb(); }
      } else if (turn) {
        turn.t += dt;
        var kt = G.clamp(turn.t / turn.dur, 0, 1), et = G.easeInOut(kt), prevY = group.rotation.y;
        group.rotation.y = turn.y0 + turn.d * et;
        phase += Math.abs(group.rotation.y - prevY) * 2.2;
        stepAmp = Math.abs(turn.d) > 0.3 ? 0.35 * Math.sin(Math.PI * kt) : 0;
        moving = stepAmp > 0;
        if (kt >= 1) turn = null;
      }
      amp = G.damp(amp, stepAmp, moving ? 6 : 8, dt);
      if (!moving && amp < 0.02) {
        // 止まる時は位相を近い「そろい」に寄せる
        var target = Math.round(phase / Math.PI) * Math.PI; phase = G.damp(phase, target, 6, dt);
      }
      var A = 0.30 * amp, s = Math.sin(phase), c = Math.cos(phase);
      var hipL = -A * s, hipR = A * s;
      var kneeL = 0.55 * amp * Math.pow(Math.max(0, c), 1.6) + 0.06 * amp, kneeR = 0.55 * amp * Math.pow(Math.max(0, -c), 1.6) + 0.06 * amp;
      setLegs(hipL, hipR, kneeL, kneeR);
      var drop = 0.86 * (1 - Math.cos(Math.max(Math.abs(hipL), Math.abs(hipR)))) * 0.85 + 0.004 * amp;
      body.position.set(0.011 * amp * c, -drop, 0);   // 立脚側へ小さくゆれる
      body.rotation.y = 0.05 * amp * s;
      body.rotation.z = -0.012 * amp * c;
      if (moving && Math.abs(hipL - lastHipL) > 0) { tieZv += (hipL - lastHipL) * 1.2; }
      lastHipL = hipL;

      // --- 呼吸・笑い
      var br = Math.sin(t * Math.PI * 2 / 4.3);
      var by = 0.0022 * br, sz = 1 + 0.008 * br, sxs = 1 + 0.003 * br, pitch = 0;
      if (chuckleT >= 0) {
        chuckleT += dt;
        var ck = chuckleT / 1.25;
        if (ck >= 1) chuckleT = -1;
        else {
          var env = Math.pow(1 - ck, 0.8);
          var b = Math.abs(Math.sin(ck * Math.PI * 3.6)) * env;
          by += 0.0085 * b; sz += 0.010 * b; pitch = 0.025 * b + 0.02 * Math.sin(Math.PI * ck);
          tieZv += Math.sin(ck * Math.PI * 7.2) * env * dt * 1.5;
        }
      }
      upper.position.y = 0.98 + by;
      upper.scale.set(sxs, 1, sz);
      upper.rotation.x = pitch;

      // --- ネクタイ
      tieZv += (-28 * tieZ - 2.0 * tieZv) * dt; tieZ += tieZv * dt;
      tieXv += (-36 * tieX - 3.5 * tieXv) * dt; tieX += tieXv * dt;
      if (tieX < 0) { tieX = 0; if (tieXv < 0) tieXv *= -0.2; }
      var idle = 0.006 * Math.sin(t * 0.9) + 0.004 * br;
      tiePivot.rotation.z = G.clamp(tieZ + idle, -0.5, 0.5);
      tiePivot.rotation.x = -G.clamp(tieX, 0, 0.5) - pitch * 0.6;

      // --- ポケット
      peekCur = G.damp(peekCur, G.clamp(api.acornPeek || 0, 0, 1), 7, dt);
      bulgeCur = G.damp(bulgeCur, G.clamp(api.pocketBulge || 0, 0, 1), 8, dt);
      var wig = 0, extra = 0;
      if (pulse) {
        pulseT += dt;
        var pp = pulseT % 1.7;
        if (pp < 0.6) { var wv = Math.sin(pp / 0.6 * Math.PI); wig = Math.sin(pp * 26) * wv; extra = 0.35 * wv; }
      } else pulseT = 0;
      wigCur = G.damp(wigCur, wig, 20, dt);
      var bul = Math.min(1.3, bulgeCur + extra * (bulgeCur > 0.05 ? 0.7 : 0.5));
      gapCur = 0.0015 + peekCur * 0.012 + bulgeCur * 0.002;
      if (Math.abs(bul - pkState.bulge) > 0.002 || Math.abs(gapCur - pkState.gap) > 0.0002 || Math.abs(peekCur - pkState.peek) > 0.002 || Math.abs(wigCur - pkState.wig) > 0.01) {
        pkState.bulge = bul; pkState.gap = gapCur; pkState.peek = peekCur; pkState.wig = wigCur;
        rebuildPocket(bul, gapCur, peekCur, wigCur);
      }
      var glow = pulse ? (0.5 + 0.5 * Math.sin(pulseT * Math.PI * 2 / 1.7 - 1.2)) : 0;
      if (pocketMat.emissive) {
        var hex = G.SHIRT_COLORS[colorIdx];
        pocketMat.emissive.setHex(hex); pocketMat.emissiveIntensity = 0.10 * glow;
      }
      // 顔を出すどんぐり
      if (peekCur > 0.01) {
        peekHolder.visible = true;
        peekHolder.position.copy(pkMouthLocal).addScaledVector(pkMouthN, 0.0035 + peekCur * 0.0075);
        peekHolder.position.addScaledVector(pkUp, -0.040 + peekCur * 0.058);
        peekAcorn.rotation.z = 0.12 + 0.06 * Math.sin(t * 2.1) * peekCur;
      } else peekHolder.visible = false;
    };
    api.update(0, 0);
    return api;
  };

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
})();
