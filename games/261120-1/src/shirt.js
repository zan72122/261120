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

    function regenWrinkles() {
      genWrinkles(WN, 1000 + seedN * 7919, wrkData);
      seedN++;
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
