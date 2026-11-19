// Procedural Web Audio Foley & Warm Patisserie Chimes

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.spreadNode = null;
    this.spreadGain = null;
    this.spreadFilter = null;
    this.unlocked = false;
    this.lastSpreadTime = 0;
    this.lastTickTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);
      this._createNoiseBuffer();
      this._setupSpreadLoop();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2.0;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Pink-ish soft noise for creamy organic textures
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buf;
  }

  _setupSpreadLoop() {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 650;
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();

    this.spreadNode = src;
    this.spreadFilter = filter;
    this.spreadGain = gain;
  }

  updateCreamSpread(intensity) {
    if (!this.ctx || !this.spreadGain) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, intensity));
    const targetGain = clamped > 0.02 ? 0.06 + clamped * 0.24 : 0.0001;
    const targetFreq = 420 + clamped * 920;
    this.spreadGain.gain.setTargetAtTime(targetGain, now, 0.035);
    this.spreadFilter.frequency.setTargetAtTime(targetFreq, now, 0.04);
  }

  stopCreamSpread() {
    if (!this.ctx || !this.spreadGain) return;
    this.spreadGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
  }

  playCreamScoop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft wet creamy bloop
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(410, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(290, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);

    this._noiseBurst(0.12, 780, 1.5, 0.16);
  }

  playRosettePop(count = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft puff of piped cream
    this._noiseBurst(0.085, 1100, 1.8, 0.15);

    // Warm upward pop
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = scale[count % scale.length];
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.62, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.075);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playSpongeSquish() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(125, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.19);
    this._noiseBurst(0.06, 380, 1.0, 0.08);
  }

  playTurntableTick(speed) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTickTime < 0.09) return;
    this.lastTickTime = now;
    const vol = Math.min(0.055, 0.015 + Math.abs(speed) * 0.008);
    this._noiseBurst(0.035, 1600, 3.0, vol);
  }

  playCeramicClink() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [1780, 2940];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 60, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.07 : 0.035, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.13);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.15);
    });
  }

  playBerryPick(isSpecial = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = isSpecial ? 784 : 460;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.48, now + 0.07);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.13, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playBerryDrop(stackLevel = 0, onCream = true, isSpecial = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Cushioned creamy squish
    if (onCream) {
      this._noiseBurst(0.075, 620, 1.5, 0.14);
    }
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
    const freq = notes[Math.min(notes.length - 1, stackLevel + (isSpecial ? 3 : 0))];
    // Soft marimba-like landing tone
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.78, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.045);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.30);

    if (isSpecial) {
      this._chime(freq * 1.5, now + 0.05, 0.12, 0.35);
    }
  }

  playBerryTumble() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [340, 260, 210].forEach((f, i) => {
      const t = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.75, t + 0.06);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11 - i * 0.025, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

  playSugarShake() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Delicate shimmering snow sound
    this._noiseBurst(0.18, 4200, 1.2, 0.12);
    [1318.5, 1567.98, 2093.0].forEach((f, i) => {
      this._chime(f + Math.random() * 40, now + i * 0.045, 0.045, 0.24);
    });
  }

  playCreamReadyChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._chime(f, now + i * 0.07, 0.09, 0.45);
    });
  }

  playForkTap() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Double porcelain-silver tink-tink
    [0, 0.16].forEach((delay) => {
      const t = now + delay;
      [2150, 3480].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(idx === 0 ? 0.09 : 0.04, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    });
  }

  playServeCake() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._noiseBurst(0.32, 520, 1.2, 0.09);
    const notes = [523.25, 587.33, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this._chime(f, now + i * 0.065, 0.10, 0.55);
    });
  }

  playEatBite(biteIndex = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Soft juicy bite crunch/squish
    this._noiseBurst(0.07, 980, 1.3, 0.15);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 + biteIndex * 35, now);
    osc.frequency.exponentialRampToValueAtTime(420 + biteIndex * 55, now + 0.08);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.17);

    // Warm musical yummy chord
    const baseNotes = [523.25, 659.25, 783.99, 880.0];
    const base = baseNotes[biteIndex % baseNotes.length];
    this._chime(base, now + 0.09, 0.11, 0.35);
    this._chime(base * 1.25, now + 0.16, 0.09, 0.38);
  }

  playNoseCreamGiggle() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Playful bubbly ascending giggle pops
    [660, 880, 1046.5, 1318.5].forEach((f, i) => {
      const t = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.85, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.055);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.11);
    });
  }

  playCelebrate() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, t: 0.00, v: 0.13 },
      { f: 659.25, t: 0.09, v: 0.13 },
      { f: 783.99, t: 0.18, v: 0.14 },
      { f: 1046.5, t: 0.28, v: 0.16 },
      { f: 880.00, t: 0.40, v: 0.12 },
      { f: 1046.5, t: 0.50, v: 0.16 },
      { f: 1318.5, t: 0.50, v: 0.11 },
      { f: 1567.98, t: 0.62, v: 0.10 },
    ];
    melody.forEach((n) => this._chime(n.f, now + n.t, n.v, 0.7));
  }

  playGuestArrive() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this._chime(587.33, now, 0.09, 0.35);
    this._chime(783.99, now + 0.11, 0.10, 0.42);
  }

  _chime(freq, startTime, volume, duration) {
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    osc2.frequency.setValueAtTime(freq * 2.0, startTime);

    const g2 = this.ctx.createGain();
    g2.gain.value = 0.14;

    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(volume, startTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    osc.connect(g);
    osc2.connect(g2);
    g2.connect(g);
    g.connect(this.master);

    osc.start(startTime);
    osc2.start(startTime);
    osc.stop(startTime + duration + 0.05);
    osc2.stop(startTime + duration + 0.05);
  }

  _noiseBurst(duration, freq, Q, volume) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(Q, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);

    src.start(now, Math.random() * 1.2);
    src.stop(now + duration + 0.02);
  }
}

export const sound = new SoundEngine();
