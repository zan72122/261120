/**
 * Procedural realistic Foley audio engine (Web Audio API, zero external files)
 * Unlocks cleanly on first user gesture.
 */
class FoleyAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.ambienceStarted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.noiseBuf = this._createNoiseBuffer(2.0);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.ambienceStarted && this.ctx) {
      this.ambienceStarted = true;
      this._startGentleMorningAir();
    }
  }

  _createNoiseBuffer(seconds) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // Soft pink-ish filtered noise for natural cloth/breeze/wood Foley
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.12) * 0.55;
    }
    return buf;
  }

  _startGentleMorningAir() {
    // Very quiet natural morning breeze bed
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 340;
    filter.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.014;
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start();
  }

  playClothRustle({ wet = false, duration = 0.24, volume = 0.22 } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = wet ? 0.72 + Math.random() * 0.14 : 1.12 + Math.random() * 0.22;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(wet ? 580 : 1450, now);
    filter.frequency.exponentialRampToValueAtTime(wet ? 340 : 920, now + duration);
    filter.Q.value = wet ? 1.1 : 0.85;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now, Math.random() * 0.8, duration + 0.05);
  }

  playClothespinSnap() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Crisp wooden click transient ("kachin!")
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1650 + Math.random() * 180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.032);

    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.24, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g1).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);

    // 2. Tiny steel torsion spring metallic tick
    const spring = this.ctx.createOscillator();
    spring.type = 'sine';
    spring.frequency.setValueAtTime(3400 + Math.random() * 300, now + 0.008);
    spring.frequency.exponentialRampToValueAtTime(2200, now + 0.055);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.08, now + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    spring.connect(g2).connect(this.ctx.destination);
    spring.start(now + 0.008);
    spring.stop(now + 0.065);
  }

  playWaterDrop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const base = 680 + Math.random() * 440;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.65, now + 0.055);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playBreezeGust() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.95;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(860, now + 0.28);
    filter.frequency.exponentialRampToValueAtTime(320, now + dur);
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now, Math.random() * 0.5, dur + 0.05);
  }

  playDryChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft sunlit glass/aluminum wind-chime harmonic
    const notes = [1046.5, 1318.5, 1568.0];
    notes.forEach((freq, idx) => {
      const t0 = now + idx * 0.075;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.065, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.65);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.7);
    });
  }

  playDrawerSlide(opening = true) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.34;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opening ? 320 : 420, now);
    filter.frequency.linearRampToValueAtTime(opening ? 480 : 260, now + dur);
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now, 0.2, dur + 0.05);

    // Soft wooden stop thump
    const thump = this.ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(145, now + dur * 0.82);
    thump.frequency.exponentialRampToValueAtTime(62, now + dur * 0.82 + 0.07);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.14, now + dur * 0.82);
    tg.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.82 + 0.08);
    thump.connect(tg).connect(this.ctx.destination);
    thump.start(now + dur * 0.82);
    thump.stop(now + dur * 0.82 + 0.09);
  }

  playPolePing() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.28);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.30);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  playLeafRustle() {
    this.playClothRustle({ wet: false, duration: 0.16, volume: 0.12 });
  }

  playMomHappyMelody() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Warm sunlit wooden marimba pentatonic chord (C5-E5-G5-A5-C6)
    const freqs = [523.25, 659.25, 783.99, 880.0, 1046.5];
    freqs.forEach((f, i) => {
      const t = now + i * 0.095;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const overtone = this.ctx.createOscillator();
      overtone.type = 'triangle';
      overtone.frequency.value = f * 2;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.72);

      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.025, t);
      g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);

      osc.connect(g).connect(this.ctx.destination);
      overtone.connect(g2).connect(this.ctx.destination);
      osc.start(t);
      overtone.start(t);
      osc.stop(t + 0.75);
      overtone.stop(t + 0.22);
    });
  }
}

export const audio = new FoleyAudio();
