// スフレ シェル: 入力（指1本のドラッグとタップだけ）
// HERO-SPEC §5 の input オブジェクトを毎フレーム作る。2本目以降の指は無視する。
(function (S) {
  'use strict';
  S.createInput = function (THREE, canvas, camera, getTargets, onFirstTouch) {
    const TAP_TIME = 0.35, TAP_MOVE = 12, NEAR_PX = 70, ROT_MIN_PX = 20;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const tmpV = new THREE.Vector3();
    const input = {
      time: 0,
      pointer: { x: 0, y: 0 },
      isDown: false, pressed: false, released: false,
      grabId: null, grabPoint: null,
      tapId: null,
      dragPx: { x: 0, y: 0 }, dragNDC: { x: 0, y: 0 },
      rotate: 0,
      ray: raycaster.ray,
      idle: 0,
    };
    const grabPoint = new THREE.Vector3();
    let pid = null, downTime = 0, moved = 0, lastX = 0, lastY = 0, accX = 0, accY = 0, rot = 0, prevAng = null;
    let pendingPress = false, pendingRelease = false, pendingTap = null, grabTarget = null;

    function rect() { return canvas.getBoundingClientRect(); }
    function toNDC(cx, cy) {
      const r = rect();
      return { x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1, px: cx - r.left, py: cy - r.top, w: r.width, h: r.height };
    }
    function pivotScreen(t) {
      const r = rect();
      t.pivot.getWorldPosition(tmpV); tmpV.project(camera);
      return { x: (tmpV.x + 1) / 2 * r.width, y: (1 - tmpV.y) / 2 * r.height, behind: tmpV.z > 1 };
    }
    S.pivotScreen = pivotScreen;

    function pick(p) {
      const targets = getTargets().filter((t) => t.enabled);
      if (!targets.length) return null;
      ndc.set(p.x, p.y); raycaster.setFromCamera(ndc, camera);
      let best = null, bestD = Infinity;
      for (const t of targets) {
        const hits = raycaster.intersectObject(t.object, true);
        if (hits.length && hits[0].distance < bestD) { bestD = hits[0].distance; best = t; grabPoint.copy(hits[0].point); }
      }
      if (best) return best;
      // 小さな指のため：画面上で近ければつかんだことにする
      let near = null, nd = NEAR_PX;
      for (const t of targets) {
        const s = pivotScreen(t);
        if (s.behind) continue;
        const d = Math.hypot(s.x - p.px, s.y - p.py);
        if (d < nd) { nd = d; near = t; }
      }
      if (near) near.pivot.getWorldPosition(grabPoint);
      return near;
    }

    function angleAt(t, p) {
      const s = pivotScreen(t);
      const dx = p.px - s.x, dy = s.y - p.py; // 画面で +y 上
      if (Math.hypot(dx, dy) < ROT_MIN_PX) return null;
      return Math.atan2(dy, dx);
    }

    function onDown(e) {
      if (pid !== null) return;           // 2本目の指は無視
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      pid = e.pointerId;
      try { canvas.setPointerCapture(pid); } catch (err) { /* ignore */ }
      onFirstTouch && onFirstTouch();
      const p = toNDC(e.clientX, e.clientY);
      input.pointer.x = p.x; input.pointer.y = p.y;
      input.isDown = true; pendingPress = true;
      downTime = performance.now(); moved = 0; lastX = e.clientX; lastY = e.clientY;
      grabTarget = pick(p);
      input.grabId = grabTarget ? grabTarget.id : null;
      input.grabPoint = grabTarget ? grabPoint : null;
      prevAng = grabTarget ? angleAt(grabTarget, p) : null;
      input.idle = 0;
    }
    function moveTo(cx, cy) {
      const dx = cx - lastX, dy = cy - lastY;
      lastX = cx; lastY = cy;
      accX += dx; accY += -dy;
      moved += Math.hypot(dx, dy);
      const p = toNDC(cx, cy);
      input.pointer.x = p.x; input.pointer.y = p.y;
      if (grabTarget) {
        const a = angleAt(grabTarget, p);
        if (a !== null && prevAng !== null) {
          let d = a - prevAng;
          if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
          rot += d;
        }
        prevAng = a;
      }
      if (Math.abs(dx) + Math.abs(dy) > 0) input.idle = 0;
    }
    function onMove(e) {
      if (e.pointerId !== pid) return;
      e.preventDefault();
      // 低 fps のときブラウザは pointermove をまとめる。回転角が折り返さないよう、まとめられた点を全部たどる
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (list && list.length) for (const c of list) moveTo(c.clientX, c.clientY);
      else moveTo(e.clientX, e.clientY);
    }
    function onUp(e) {
      if (e.pointerId !== pid) return;
      e.preventDefault();
      const dt = (performance.now() - downTime) / 1000;
      if (grabTarget && dt < TAP_TIME && moved < TAP_MOVE) pendingTap = grabTarget.id;
      pid = null; input.isDown = false; pendingRelease = true;
      onFirstTouch && onFirstTouch();   // iOS Safari はタッチの pointerdown では音を解錠できない（pointerup で解錠される）
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      input.idle = 0;
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false });
    canvas.addEventListener('pointermove', onMove, { passive: false });
    canvas.addEventListener('pointerup', onUp, { passive: false });
    canvas.addEventListener('pointercancel', onUp, { passive: false });
    // iOS のピンチ・ダブルタップ拡大・長押しメニューを止める
    ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault(), { passive: false }));
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    return {
      input,
      // hero.update の直前に呼ぶ：このフレームの量を確定
      begin(dt, time) {
        input.time = time;
        input.pressed = pendingPress; input.released = pendingRelease; input.tapId = pendingTap;
        const r = rect();
        input.dragPx.x = accX; input.dragPx.y = accY;
        input.dragNDC.x = accX / r.width * 2; input.dragNDC.y = accY / r.height * 2;
        input.rotate = rot;
        ndc.set(input.pointer.x, input.pointer.y); raycaster.setFromCamera(ndc, camera);
        if (!input.isDown && !pendingRelease) input.idle += dt;
      },
      // hero.update の直後に呼ぶ：単発の量を消す
      end() {
        pendingPress = pendingRelease = false; pendingTap = null;
        accX = accY = 0; rot = 0;
        input.pressed = input.released = false; input.tapId = null;
        input.dragPx.x = input.dragPx.y = 0; input.dragNDC.x = input.dragNDC.y = 0; input.rotate = 0;
        if (!input.isDown) { input.grabId = null; input.grabPoint = null; grabTarget = null; }
      },
      resetIdle() { input.idle = 0; },
      cancel() { pid = null; input.isDown = false; grabTarget = null; input.grabId = null; },
    };
  };
})(window.Souffle = window.Souffle || {});
