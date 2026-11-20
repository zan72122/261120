// WebAudio の合成効果音（音声ファイルなし）。最初のタッチで起こす（iOS の制約）。
// 名前の一覧は HERO-SPEC §5。
const MIN_GAP = { tick: 0.05, beam: 0.12, hit: 0.08, hint: 0.8, default: 0.03 };
const MAX_VOICES = 24;
export const SOUND_NAMES = ['grab', 'release', 'tick', 'beam', 'hit', 'awaken', 'bloom', 'spin', 'stage', 'complete', 'pop', 'hint'];

export function createAudio({ onWarn } = {}) {
  let ctx = null, master = null, voices = 0;
  const last = new Map();
  let muted = false;

  function ensure() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(comp).connect(ctx.destination);
    // iOS の解錠：無音を1回鳴らす
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }

  function out(pan) {
    if (ctx.createStereoPanner && pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(master);
      return p;
    }
    return master;
  }

  // 1音：波形・周波数（終わりの周波数）・音量・長さ
  function tone(dest, { type = 'sine', f, f2, t0, a = 0.005, d, g }) {
    const o = ctx.createOscillator();
    const e = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + d);
    e.gain.setValueAtTime(0.0001, t0);
    e.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t0 + a);
    e.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    o.connect(e).connect(dest);
    o.start(t0); o.stop(t0 + a + d + 0.05);
    voices++;
    o.onended = () => { voices--; e.disconnect(); };
  }
  function bell(dest, f, t0, g, d = 1.6) {
    tone(dest, { f, t0, d, g });
    tone(dest, { f: f * 2.76, t0, d: d * 0.5, g: g * 0.35 });
    tone(dest, { f: f * 5.4, t0, d: d * 0.25, g: g * 0.15 });
  }
  const NOTE = (semi) => 523.25 * Math.pow(2, semi / 12); // C5 基準

  const SYNTH = {
    grab(d, t, k, g) { tone(d, { type: 'triangle', f: 460 * k, f2: 340 * k, t0: t, d: 0.11, g: 0.28 * g }); },
    release(d, t, k, g) { tone(d, { type: 'triangle', f: 330 * k, f2: 240 * k, t0: t, d: 0.13, g: 0.22 * g }); },
    tick(d, t, k, g) { tone(d, { type: 'square', f: 2100 * k, t0: t, a: 0.002, d: 0.025, g: 0.035 * g }); },
    beam(d, t, k, g) { tone(d, { f: 700 * k, f2: 1500 * k, t0: t, a: 0.02, d: 0.28, g: 0.12 * g }); tone(d, { f: 1050 * k, f2: 2250 * k, t0: t + 0.03, a: 0.02, d: 0.25, g: 0.05 * g }); },
    hit(d, t, k, g) { tone(d, { f: 1568 * k, t0: t, d: 0.3, g: 0.1 * g }); },
    awaken(d, t, k, g) { bell(d, 523.25 * k, t, 0.3 * g); },
    bloom(d, t, k, g) { [0, 4, 7].forEach((s, i) => tone(d, { type: 'triangle', f: NOTE(s) * k, t0: t + i * 0.12, d: 0.6, g: 0.18 * g })); },
    spin(d, t, k, g) { tone(d, { f: 220 * k, f2: 340 * k, t0: t, a: 0.25, d: 1.0, g: 0.14 * g }); tone(d, { f: 330 * k, f2: 510 * k, t0: t, a: 0.3, d: 0.9, g: 0.06 * g }); },
    stage(d, t, k, g) { bell(d, NOTE(7) * k, t, 0.22 * g, 1.0); bell(d, NOTE(12) * k, t + 0.18, 0.22 * g, 1.3); },
    complete(d, t, k, g) {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(d, { type: 'triangle', f: NOTE(s) * k, t0: t + i * 0.13, d: 0.7, g: 0.16 * g }));
      [0, 4, 7].forEach((s) => tone(d, { f: NOTE(s - 12) * k, t0: t + 0.9, a: 0.6, d: 2.6, g: 0.1 * g }));
      bell(d, NOTE(24) * k, t + 1.0, 0.12 * g, 2.5);
    },
    pop(d, t, k, g) { tone(d, { f: 520 * k, f2: 880 * k, t0: t, a: 0.004, d: 0.08, g: 0.16 * g }); },
    hint(d, t, k, g) { tone(d, { f: 2093 * k, t0: t, d: 0.35, g: 0.03 * g }); tone(d, { f: 2637 * k, t0: t + 0.08, d: 0.35, g: 0.025 * g }); },
  };

  return {
    unlock: ensure,
    get state() { return ctx ? ctx.state : 'none'; },
    get voices() { return voices; },
    setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.7; },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); },
    resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); },
    play(name, { gain = 1, pitch = 0, pan = 0 } = {}) {
      let fn = SYNTH[name];
      if (!fn) { onWarn && onWarn('知らない音の名前: ' + name); fn = SYNTH.tick; name = 'tick'; }
      if (!ctx || muted || ctx.state !== 'running') return false;
      const now = ctx.currentTime;
      const gap = MIN_GAP[name] ?? MIN_GAP.default;
      if (now - (last.get(name) ?? -1) < gap) return false;
      if (voices > MAX_VOICES) return false;
      last.set(name, now);
      const g = Math.max(0, Math.min(1, Number.isFinite(gain) ? gain : 1));
      const k = Math.pow(2, (Number.isFinite(pitch) ? pitch : 0) / 12);
      fn(out(pan), now + 0.005, k, g);
      return true;
    },
  };
}
