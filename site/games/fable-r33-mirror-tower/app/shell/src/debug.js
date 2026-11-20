// ?debug=1 の小さなオーバーレイ：tier・キャンバス・fps(平均/p95)・draw call・三角形・テクスチャ・GPU見積もり・エラー
import { estimate, countNaN } from './stats.js';

export function createErrorLog() {
  const errors = [];
  const push = (msg) => { errors.push(String(msg).slice(0, 300)); if (errors.length > 50) errors.shift(); };
  window.addEventListener('error', (e) => push(e.message || e.error || 'error'));
  window.addEventListener('unhandledrejection', (e) => push('promise: ' + (e.reason && e.reason.message || e.reason)));
  const origErr = console.error.bind(console);
  console.error = (...a) => { push(a.map(String).join(' ')); origErr(...a); };
  return { errors, push };
}

export function createFrameTimer() {
  const N = 180;
  const buf = new Float32Array(N);
  let i = 0, n = 0;
  return {
    add(ms) { buf[i] = ms; i = (i + 1) % N; n = Math.min(N, n + 1); },
    get() {
      if (!n) return { avg: 0, p95: 0 };
      const a = Array.from(buf.subarray(0, n)).sort((x, y) => x - y);
      const mean = a.reduce((s, v) => s + v, 0) / n;
      const p95ms = a[Math.min(n - 1, Math.floor(n * 0.95))];
      return { avg: 1000 / Math.max(0.1, mean), p95: 1000 / Math.max(0.1, p95ms) };
    },
  };
}

// JS 側の1フレームの時間（ms、指数平均）：hero.update、renderer.render（GL 命令を出す時間）、ループ全体
export function createCpuTimer() {
  const v = { hero: 0, render: 0, frame: 0 };
  let n = 0;
  return {
    add(k, ms) { const a = n < 30 ? 0.3 : 0.05; v[k] += (ms - v[k]) * a; },
    tick() { n++; },
    get: () => ({ ...v }),
  };
}

export function createDebugOverlay({ enabled, renderer, scene, camera, getHeroRoot, envTexture, sharedTextures, frames, cpu, errors, getInfo }) {
  let el = null, acc = 0;
  if (enabled) {
    el = document.createElement('pre');
    el.id = 'debug';
    el.style.cssText = 'position:fixed;left:6px;top:6px;margin:0;padding:6px 8px;background:rgba(0,0,0,.62);color:#e8ffe8;font:11px/1.35 ui-monospace,Menlo,monospace;z-index:20;pointer-events:none;border-radius:6px;white-space:pre;max-width:96vw;overflow:hidden';
    document.body.appendChild(el);
  }
  let lastStats = null;
  function snapshot() {
    const st = estimate({ renderer, scene, heroRoot: getHeroRoot(), envTexture, sharedTextures });
    const info = renderer.info;
    st.frameCalls = info.render.calls;
    st.frameTris = info.render.triangles;
    st.glTextures = info.memory.textures;
    st.glGeometries = info.memory.geometries;
    st.fps = frames.get();
    st.cpu = cpu ? cpu.get() : null;
    st.nan = countNaN(scene, camera);
    lastStats = st;
    return st;
  }
  return {
    snapshot,
    get last() { return lastStats; },
    update(dt) {
      if (!el) return;
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      const s = snapshot();
      const i = getInfo();
      const f = (x) => x.toFixed(1);
      el.textContent = [
        `tier ${i.tier}${i.isMobile ? ' (mobile)' : ''}  canvas ${s.drawingBuffer[0]}x${s.drawingBuffer[1]} dpr ${f(i.dpr)}  tti ${i.tti ? Math.round(i.tti) + 'ms' : '-'}`,
        `fps avg ${f(s.fps.avg)}  p95 ${f(s.fps.p95)}` + (s.cpu ? `  cpu ms: hero ${s.cpu.hero.toFixed(2)} render ${s.cpu.render.toFixed(2)} frame ${s.cpu.frame.toFixed(2)}` : ''),
        `draw ${s.frameCalls} (hero ${s.calls.hero} / other ${s.calls.other})`,
        `tris ${s.frameTris} (hero ${s.tris.hero} / other ${s.tris.other})`,
        `tex gl ${s.glTextures}  hero ${s.textures.hero.length}/4: ${s.textures.hero.join(', ') || '-'}`,
        `     other ${s.textures.other.length}: ${s.textures.other.join(', ')}`,
        `gpu≈ ${f(s.mb.total)}MB (fb ${f(s.mb.framebuffer)} heroTex ${f(s.mb.heroTex)} tex ${f(s.mb.otherTex)} pmrem ${f(s.mb.pmrem)} geo ${f(s.mb.heroGeo + s.mb.otherGeo)})`,
        `stage ${i.stage}/${i.count}${i.complete ? ' complete' : ''}${i.busy ? ' busy' : ''}  view ${i.view}  idle ${f(i.idle)}  audio ${i.audio}  ctx ${i.ctx}`,
        `nan ${s.nan}  errors ${errors.length}${errors.length ? ': ' + errors[errors.length - 1] : ''}`,
      ].join('\n');
    },
  };
}
