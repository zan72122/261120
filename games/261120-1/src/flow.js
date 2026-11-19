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
    var papa = G.createPapa(ctx); scene.add(papa.group); papa.group.visible = false;
    // 回避: papa.js が makeFabricMaterial に repeat を配列で渡し、法線マップの repeat が NaN（シャツが真っ黒）になる
    papa.group.traverse(function (o) {
      var ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (var i = 0; i < ms.length; i++) {
        var nm = ms[i] && ms[i].normalMap;
        if (nm && !(isFinite(nm.repeat.x) && isFinite(nm.repeat.y))) nm.repeat.set(24, 24);
      }
    });
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
      after(4.0, function () {
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

      // パパ
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
      onUserGesture: function () { try { if (!audio.ready) audio.unlock(); } catch (e) { /* noop */ } }
    };
    Object.defineProperty(api, 'state', { enumerable: true, get: function () { return S.state; } });
    return api;
  };
})();
