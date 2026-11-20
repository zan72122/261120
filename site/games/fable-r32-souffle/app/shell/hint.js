// スフレ シェル: 止まったときの「指」のヒントと、最後の「もう一回」ボタン（文字なし）
(function (S) {
  'use strict';
  const HAND_IDLE = 4.0;        // 一度さわった後に止まったとき
  const HAND_IDLE_FIRST = 1.5;  // その段階でまだ一度もさわっていないとき（最初の画面・段階が変わった直後）は早めに見せる

  S.createHint = function (handEl, replayEl, onReplay) {
    let alpha = 0, t = 0, replayShown = false;
    function setHand(x, y, a, s) {
      handEl.style.opacity = a.toFixed(3);
      handEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
    }
    replayEl.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!replayShown) return;
      hideReplay();
      onReplay();
    });
    function hideReplay() {
      replayShown = false;
      replayEl.classList.remove('show');
      setTimeout(() => { if (!replayShown) replayEl.style.display = 'none'; }, 600);
    }
    return {
      // target: hero の Target（有効なもの）か null。idle: 秒。untouched: この段階でまだ一度もさわっていない
      update(dt, target, idle, cameraMoving, untouched) {
        t += dt;
        const want = target && !cameraMoving && idle >= (untouched ? HAND_IDLE_FIRST : HAND_IDLE) ? 0.85 : 0;
        alpha += (want - alpha) * Math.min(1, dt * (want > alpha ? 2 : 6));
        if (alpha < 0.01 || !target) { if (handEl.style.opacity !== '0') handEl.style.opacity = '0'; if (!target) alpha = 0; return; }
        const s = S.pivotScreen(target);
        const g = target.gesture || { type: 'tap' };
        let x = s.x, y = s.y, sc = 1;
        if (g.type === 'circle') {
          const a = t * 3.2; x += Math.cos(a) * 46; y -= Math.sin(a) * 46;
        } else if (g.type === 'drag') {
          const k = (t * 0.7) % 1, e = k < 0.75 ? (k / 0.75) : 1;
          const dx = (g.dir && g.dir[0]) || 0, dy = (g.dir && g.dir[1]) || -1;
          x += dx * (e * 110 - 20); y -= dy * (e * 110 - 20);
          sc = k < 0.1 ? 0.9 : 1;
        } else {
          const k = (t * 1.3) % 1; sc = k < 0.25 ? 1 - Math.sin(k / 0.25 * Math.PI) * 0.18 : 1; y += k < 0.25 ? 6 : 0;
        }
        setHand(x, y, alpha, sc);
      },
      showReplay() {
        replayShown = true;
        replayEl.style.display = 'block';
        requestAnimationFrame(() => requestAnimationFrame(() => replayEl.classList.add('show')));
      },
      hideReplay,
      get replayShown() { return replayShown; },
    };
  };
})(window.Souffle = window.Souffle || {});
