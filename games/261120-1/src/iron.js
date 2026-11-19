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
      pa.needsUpdate = sa.needsUpdate = al.needsUpdate = ro.needsUpdate = ce.needsUpdate = true;
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
