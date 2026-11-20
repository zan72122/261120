// スフレ シェル: ?debug=1 の小さなオーバーレイ（tier・canvas・fps 平均/p95・draw call・三角形・テクスチャ・GPU 見積もり・エラー）
(function (S) {
  'use strict';
  // フレーム時間の記録（debug でなくてもティア自動降格に使う）
  S.createFrameStats = function () {
    const N = 180, buf = new Float32Array(N);
    let i = 0, n = 0;
    return {
      push(ms) { buf[i] = ms; i = (i + 1) % N; n = Math.min(N, n + 1); },
      get count() { return n; },
      avgFps() { if (!n) return 0; let s = 0; for (let k = 0; k < n; k++) s += buf[k]; return 1000 / (s / n); },
      p95Fps() {
        if (!n) return 0;
        const a = Array.from(buf.subarray(0, n)).sort((x, y) => x - y);
        return 1000 / a[Math.min(n - 1, Math.floor(n * 0.95))];
      },
      reset() { n = 0; i = 0; },
    };
  };

  S.createDebugOverlay = function (getStats, actions) {
    const el = document.createElement('div');
    el.id = 'dbg';
    const pre = document.createElement('div');
    el.appendChild(pre);
    const row = document.createElement('div');
    for (const [label, fn] of Object.entries(actions)) {
      const b = document.createElement('button'); b.textContent = label;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); fn(); });
      row.appendChild(b);
    }
    el.appendChild(row);
    document.body.appendChild(el);
    let acc = 0;
    return {
      update(dt) {
        acc += dt;
        if (acc < 0.25) return;
        acc = 0;
        const s = getStats();
        const lines = [
          `tier ${s.tier}  mobile ${s.mobile}  dpr ${s.pixelRatio}  canvas ${s.canvasW}x${s.canvasH}`,
          `ready ${s.readyMs} ms  programs ${s.programs}  ctx lost ${s.ctxLost} / restored ${s.ctxRestored}`,
          `fps avg ${s.fpsAvg.toFixed(1)}  p95 ${s.fpsP95.toFixed(1)}`,
          `draw ${s.calls}  tris ${s.tris} (hero ${s.heroTris} / env ${s.envTris})`,
          `tex gl ${s.glTextures}  hero ${s.heroTex} / env ${s.envTex} / shared ${s.sharedTex}`,
          `GPU ~${s.gpuMiB.toFixed(1)} MiB (tex ${s.texMiB.toFixed(1)}, geo ${s.geoMiB.toFixed(1)}, fb ${s.fbMiB.toFixed(1)}, env ${s.envMiB.toFixed(1)})`,
          `stage ${s.stage} ${s.progress.toFixed(2)}  idle ${s.idle.toFixed(1)}`,
          `hero ${s.heroState}`,
          `nan ${s.nan}  errors ${S.errors.length}${S.errors.length ? '\n  ' + S.errors.slice(-4).join('\n  ') : ''}`,
        ];
        pre.textContent = lines.join('\n');
      },
    };
  };
})(window.Souffle = window.Souffle || {});
