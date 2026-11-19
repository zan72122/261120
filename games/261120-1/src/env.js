/* env.js — 部屋・小物・照明: G.createStage(ctx)
   床（オークのフローリング）、アイロンマット、籐のかご、奥の壁と巾木、ドアと廊下、
   壁のペグと木のハンガー、照明（朝日+影、天空光、窓の光だまり、注目の光）。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};

  // ---- 周期つき値ノイズ（タイルの継ぎ目が出ない） ----
  function hsh(x, y, s) { var n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); }
  function pnoise(x, y, P, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
    var a = hsh(x0, y0, s), b = hsh(x1, y0, s), c = hsh(x0, y1, s), d = hsh(x1, y1, s);
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
