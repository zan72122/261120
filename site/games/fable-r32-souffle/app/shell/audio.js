// スフレ シェル: WebAudio の効果音（音声ファイルなし、すべて合成）
// 最初のタッチで AudioContext を作る／再開する（iOS の制約）。
(function (S) {
  'use strict';
  let ctx = null, master = null, noiseBuf = null;
  const loops = {};
  const lastShot = {};

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.75;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      buildLoops();
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }

  function noiseSrc() {
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    n.loopStart = Math.random(); n.loopEnd = 2;
    return n;
  }

  // ---- 続く音（hero.loops を読む） ----
  function buildLoops() {
    // whisk: 金属のしゃかしゃか（帯域ノイズ＋トレモロ）
    {
      const src = noiseSrc(), bp = ctx.createBiquadFilter(), trem = ctx.createGain(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.4;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 9; lfoG.gain.value = 0.45; trem.gain.value = 0.55;
      lfo.connect(lfoG); lfoG.connect(trem.gain);
      g.gain.value = 0;
      src.connect(bp); bp.connect(trem); trem.connect(g); g.connect(master);
      src.start(); lfo.start();
      loops.whisk = { g, bp, lfo, max: 0.22 };
    }
    // pour: とろとろ（低めのノイズをゆっくり揺らす）
    {
      const src = noiseSrc(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 6;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 3.1; lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(lp.frequency);
      g.gain.value = 0;
      src.connect(lp); lp.connect(g); g.connect(master); src.start(); lfo.start();
      loops.pour = { g, bp: lp, lfo, max: 0.35 };
    }
    // oven: うなり（低いのこぎり波）＋こもったノイズ
    {
      const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 62; lp.type = 'lowpass'; lp.frequency.value = 240;
      const src = noiseSrc(), nlp = ctx.createBiquadFilter(), ng = ctx.createGain();
      nlp.type = 'lowpass'; nlp.frequency.value = 900; ng.gain.value = 0.25;
      g.gain.value = 0;
      osc.connect(lp); lp.connect(g); src.connect(nlp); nlp.connect(ng); ng.connect(g); g.connect(master);
      osc.start(); src.start();
      loops.oven = { g, bp: lp, osc, max: 0.3 };
    }
  }

  S.audioUnlock = ensure;

  // hero.loops = { whisk:{level,rate}, ... } を毎フレーム反映
  S.audioLoops = function (state) {
    if (!ctx || ctx.state !== 'running' || !state) return;
    const t = ctx.currentTime;
    for (const k in loops) {
      const L = loops[k], s = state[k];
      const level = s ? Math.max(0, Math.min(1, +s.level || 0)) : 0;
      const rate = s ? Math.max(0.5, Math.min(2, +s.rate || 1)) : 1;
      L.g.gain.setTargetAtTime(level * L.max, t, 0.06);
      if (k === 'whisk') { L.bp.frequency.setTargetAtTime(2400 * rate, t, 0.1); L.lfo.frequency.setTargetAtTime(5 + 14 * level, t, 0.1); }
      if (k === 'pour') L.bp.frequency.setTargetAtTime(500 * rate + 300 * level, t, 0.1);
      if (k === 'oven') { L.bp.frequency.setTargetAtTime(160 + 300 * level, t, 0.1); L.osc.frequency.setTargetAtTime(55 + 20 * rate, t, 0.2); }
      if (k === 'oven' && level > 0.15 && Math.random() < level * 0.18) crackle(level);
    }
  };

  function crackle(level) {
    const t = ctx.currentTime, n = noiseSrc(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 2500 + Math.random() * 3000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * level, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(hp); hp.connect(g); g.connect(master); n.start(t); n.stop(t + 0.05);
  }

  // ---- 単発音の部品 ----
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f0, f1, t, a, peak, d, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    env(g, t, a, peak, d); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + a + d + 0.05);
  }
  function noise(t, type, freq, q, a, peak, d, f1) {
    const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    env(g, t, a, peak, d); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + a + d + 0.05);
  }
  function bell(f, t, peak, d) {
    tone('sine', f, f, t, 0.005, peak, d);
    tone('sine', f * 2.76, f * 2.76, t, 0.003, peak * 0.25, d * 0.4);
  }

  const SHOTS = {
    click(g, p, t) { tone('square', 1800 * p, 900 * p, t, 0.001, 0.08 * g, 0.025); noise(t, 'highpass', 3000, 0.7, 0.001, 0.12 * g, 0.02); },
    clack(g, p, t) { tone('triangle', 520 * p, 380 * p, t, 0.002, 0.25 * g, 0.12); tone('sine', 1430 * p, 1400 * p, t, 0.002, 0.12 * g, 0.2); },
    slide(g, p, t) { noise(t, 'bandpass', 900 * p, 1.2, 0.08, 0.25 * g, 0.6, 500 * p); },
    door(g, p, t) { tone('sine', 140 * p, 70 * p, t, 0.004, 0.6 * g, 0.25); noise(t, 'lowpass', 800, 0.8, 0.002, 0.4 * g, 0.12); tone('triangle', 700 * p, 650 * p, t + 0.03, 0.002, 0.12 * g, 0.25); },
    doorOpen(g, p, t) { noise(t, 'bandpass', 1400 * p, 3, 0.05, 0.12 * g, 0.35, 700 * p); tone('triangle', 520 * p, 600 * p, t + 0.25, 0.003, 0.1 * g, 0.2); },
    plop(g, p, t) { tone('sine', 520 * p, 180 * p, t, 0.004, 0.45 * g, 0.16); },
    pop(g, p, t) { tone('sine', 900 * p, 1600 * p, t, 0.002, 0.25 * g, 0.06); },
    puff(g, p, t) { noise(t, 'lowpass', 300 * p, 0.7, 0.12, 0.35 * g, 0.5, 1200 * p); tone('sine', 180 * p, 330 * p, t, 0.1, 0.2 * g, 0.4); },
    ding(g, p, t) { bell(1568 * p, t, 0.35 * g, 1.6); bell(2093 * p, t + 0.18, 0.25 * g, 1.6); },
    wobble(g, p, t) { const o = ctx.createOscillator(), gg = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 300 * p; l.frequency.value = 11; lg.gain.value = 60 * p; l.connect(lg); lg.connect(o.frequency);
      env(gg, t, 0.01, 0.4 * g, 0.55); o.connect(gg); gg.connect(master); o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7); },
    scoop(g, p, t) { noise(t, 'bandpass', 600 * p, 2, 0.05, 0.3 * g, 0.3, 1800 * p); tone('sine', 300 * p, 520 * p, t + 0.12, 0.01, 0.22 * g, 0.25); },
    whoosh(g, p, t) { noise(t, 'bandpass', 400 * p, 1.5, 0.25, 0.18 * g, 0.5, 1600 * p); },
    chime(g, p, t) { [0, 4, 7, 12].forEach((s, i) => bell(784 * p * Math.pow(2, s / 12), t + i * 0.09, 0.22 * g, 0.9)); },
    fanfare(g, p, t) {
      const seq = [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42], [7, 0.62], [12, 0.76], [16, 0.95]];
      seq.forEach(([s, dt]) => { const f = 523 * p * Math.pow(2, s / 12); tone('triangle', f, f, t + dt, 0.01, 0.22 * g, 0.5); bell(f * 2, t + dt, 0.08 * g, 0.6); });
      tone('triangle', 523 * p * 2, 523 * p * 2, t + 0.95, 0.01, 0.2 * g, 1.4);
    },
    tap(g, p, t) { tone('sine', 660 * p, 880 * p, t, 0.003, 0.12 * g, 0.08); },
  };
  S.SOUND_NAMES = Object.keys(SHOTS);

  S.playSound = function (name, gain, pitch) {
    if (!ctx || ctx.state !== 'running') return;
    const f = SHOTS[name];
    if (!f) { S.pushError('unknown sound: ' + name); return; }
    const now = ctx.currentTime;
    // 同じ音は 1 秒に 12 回まで
    if (lastShot[name] && now - lastShot[name] < 1 / 12) return;
    lastShot[name] = now;
    const g = gain == null ? 1 : Math.max(0, Math.min(1, gain));
    const p = pitch == null ? 1 : Math.max(0.5, Math.min(2, pitch));
    try { f(g, p, now + 0.005); } catch (e) { S.pushError('sound ' + name + ': ' + e.message); }
  };

  S.audioSuspend = function (on) {
    if (!ctx) return;
    if (on) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  };
})(window.Souffle = window.Souffle || {});
