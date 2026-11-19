/* papa.js */
/* papa.js — パパ（首から下。ワイシャツ・ネクタイ・ズボン・スリッパ、両手はズボンのポケット）
   G.createPapa(ctx)
   座標: group の原点は床の両足の間。+Z を向いて立つ。パパの左 = +X。
   形とテクスチャの道具は acorn.js の G.papaKit を使う（papa.js は後から読み込まれる）。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};
  var K = G.papaKit;
  var sgnPow = K.sgnPow, catmull = K.catmull, gauss = K.gauss, makeProfile = K.makeProfile, gridGeom = K.gridGeom, makePath = K.makePath, sweepGeom = K.sweepGeom, tileNoise = K.tileNoise, texFromFn = K.texFromFn, getTex = K.getTex, buildAcornMesh = K.buildAcornMesh;

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
})();
