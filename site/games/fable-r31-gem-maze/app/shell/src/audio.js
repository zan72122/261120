// WebAudio の合成効果音（音声ファイルなし）。最初のタッチで AudioContext を作る（iOS の制約）。
// 名前は HERO-SPEC §3.3 の一覧。連続音 roll / spin は hero.audio の値で毎フレーム音量を変える。

const MIN_GAP = 0.04; // 同じ音は 40ms に 1 回まで

export class Sound {
  constructor() {
    this.ctx = null; this.master = null; this.last = Object.create(null);
    this.loops = null; this.enabled = true; this.count = 0;
  }

  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { this.enabled = false; return; }
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        this.noise = this._noiseBuffer();
        this._startLoops();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.enabled = false; }
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  _noiseBuffer() {
    const len = this.ctx.sampleRate * 1.0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.35 + b * 2.0; }
    return buf;
  }

  _startLoops() {
    const c = this.ctx;
    const mk = (freq, q) => {
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return { g, f };
    };
    this.loops = { roll: mk(520, 2.5), spin: mk(240, 1.2) };
  }

  // 連続音の強さ 0..1
  setLoops(roll, spin) {
    if (!this.ctx || !this.loops) return;
    const t = this.ctx.currentTime;
    const r = clamp01(roll), s = clamp01(spin);
    this.loops.roll.g.gain.setTargetAtTime(r * 0.22, t, 0.06);
    this.loops.roll.f.frequency.setTargetAtTime(380 + r * 420, t, 0.08);
    this.loops.spin.g.gain.setTargetAtTime(s * 0.10, t, 0.08);
  }

  play(name, opt = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.last[name] !== undefined && now - this.last[name] < MIN_GAP) return;
    this.last[name] = now;
    const gain = clamp(opt.gain ?? 1, 0, 1.5);
    const rate = clamp(opt.rate ?? 1, 0.5, 2);
    const pan = clamp(opt.pan ?? 0, -1, 1);
    const fn = VOICES[name];
    if (!fn) return;
    let out = this.master;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = pan; p.connect(this.master); out = p;
    }
    this.count++;
    try { fn(this, out, now, gain, rate); } catch (e) { /* 音は失敗しても遊びは続ける */ }
  }

  // ---- 小さな部品
  tone(out, t, { type = 'sine', f0, f1 = f0, dur, gain, attack = 0.005 }) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  burst(out, t, { freq, q = 1, dur, gain, type = 'bandpass', f1 }) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
}

const VOICES = {
  grab: (S, o, t, g, r) => S.tone(o, t, { f0: 320 * r, f1: 640 * r, dur: 0.09, gain: 0.35 * g }),
  release: (S, o, t, g, r) => S.tone(o, t, { f0: 600 * r, f1: 340 * r, dur: 0.1, gain: 0.25 * g }),
  tick: (S, o, t, g, r) => { S.tone(o, t, { type: 'triangle', f0: 1700 * r, dur: 0.035, gain: 0.18 * g }); S.burst(o, t, { freq: 3000 * r, q: 4, dur: 0.02, gain: 0.12 * g }); },
  clack: (S, o, t, g, r) => { S.burst(o, t, { freq: 1100 * r, q: 3, dur: 0.07, gain: 0.5 * g }); S.tone(o, t, { f0: 420 * r, f1: 300 * r, dur: 0.09, gain: 0.3 * g }); },
  switch: (S, o, t, g, r) => { S.burst(o, t, { freq: 2200 * r, q: 5, dur: 0.03, gain: 0.35 * g }); S.burst(o, t + 0.07, { freq: 1500 * r, q: 5, dur: 0.04, gain: 0.4 * g }); S.tone(o, t + 0.07, { f0: 660 * r, dur: 0.15, gain: 0.15 * g }); },
  gear: (S, o, t, g, r) => S.burst(o, t, { freq: 2600 * r, q: 6, dur: 0.018, gain: 0.12 * g }),
  drop: (S, o, t, g, r) => { S.tone(o, t, { f0: 1046 * r, dur: 0.5, gain: 0.3 * g }); S.tone(o, t + 0.06, { f0: 1568 * r, dur: 0.6, gain: 0.22 * g }); },
  chest: (S, o, t, g, r) => {
    [523, 659, 784, 1046, 1318].forEach((f, i) => S.tone(o, t + i * 0.11, { type: 'triangle', f0: f * r, dur: 0.5, gain: 0.28 * g }));
    S.burst(o, t + 0.5, { freq: 6000, q: 0.8, dur: 0.6, gain: 0.08 * g, type: 'highpass' });
  },
  sparkle: (S, o, t, g, r) => { for (let i = 0; i < 4; i++) S.tone(o, t + i * 0.06, { f0: (1800 + Math.random() * 1600) * r, dur: 0.25, gain: 0.08 * g }); },
  hint: (S, o, t, g, r) => { S.tone(o, t, { f0: 784 * r, dur: 0.35, gain: 0.13 * g }); S.tone(o, t + 0.16, { f0: 1046 * r, dur: 0.45, gain: 0.12 * g }); },
  whoosh: (S, o, t, g, r) => S.burst(o, t, { freq: 300 * r, f1: 1800 * r, q: 0.9, dur: 0.55, gain: 0.22 * g }),
  pop: (S, o, t, g, r) => S.tone(o, t, { f0: 500 * r, f1: 900 * r, dur: 0.07, gain: 0.22 * g }),
};
export const SOUND_NAMES = Object.keys(VOICES);

function clamp(v, a, b) { return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a; }
function clamp01(v) { return clamp(v, 0, 1); }
