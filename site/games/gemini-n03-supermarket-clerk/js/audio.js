// Procedural Web Audio API foley & realistic supermarket checkout sounds

class SupermarketAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.scanCombo = 0;
    this.lastScanTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      this._createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  _ready() {
    this.unlock();
    return Boolean(this.ctx && this.master && !this.muted);
  }

  // Authentic crisp Japanese supermarket barcode scanner "PI!"
  playScanBeep(isSpecial = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    if (t - this.lastScanTime < 2.4) {
      this.scanCombo = Math.min(this.scanCombo + 1, 7);
    } else {
      this.scanCombo = 0;
    }
    this.lastScanTime = t;

    // Gentle pentatonic lift on rapid combo scans while staying unmistakably a real POS beep
    const comboSemis = [0, 0.5, 1.0, 2.0, 2.5, 3.5, 4.5, 5.5][this.scanCombo] || 0;
    const baseFreq = 2420 * Math.pow(2, comboSemis / 12);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreq, t);
    osc2.frequency.setValueAtTime(baseFreq * 2, t);

    const g2 = this.ctx.createGain();
    g2.gain.value = 0.14;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.32, t + 0.004);
    g.gain.setValueAtTime(0.30, t + 0.068);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);

    osc1.connect(g);
    osc2.connect(g2);
    g2.connect(g);
    g.connect(this.master);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.105);
    osc2.stop(t + 0.105);

    // Subtle crisp glass contact click
    this._noiseBurst(t, 0.018, 3200, 'bandpass', 2.0, 0.08);

    // If special golden discount sticker item, add sparkling chime tail!
    if (isSpecial) {
      const notes = [1046.5, 1318.5, 1568.0, 2093.0];
      notes.forEach((f, idx) => {
        const nt = t + 0.055 + idx * 0.045;
        const o = this.ctx.createOscillator();
        const ng = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, nt);
        ng.gain.setValueAtTime(0.0001, nt);
        ng.gain.linearRampToValueAtTime(0.13, nt + 0.01);
        ng.gain.exponentialRampToValueAtTime(0.0001, nt + 0.36);
        o.connect(ng);
        ng.connect(this.master);
        o.start(nt);
        o.stop(nt + 0.38);
      });
    }
  }

  // Handheld laser gun double-chirp "PI-PI!"
  playGunBeep() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [0, 0.075].forEach((offset, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? 2680 : 3020, t + offset);
      g.gain.setValueAtTime(0.0001, t + offset);
      g.gain.linearRampToValueAtTime(0.24, t + offset + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.058);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.065);
    });
  }

  // Playful double-chirp if re-scanning an already scanned item
  playRescanChirp() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    [0, 0.055].forEach((offset, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(i === 0 ? 1850 : 2250, t + offset);
      g.gain.setValueAtTime(0.0001, t + offset);
      g.gain.linearRampToValueAtTime(0.12, t + offset + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.045);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.05);
    });
  }

  // Material-specific pickup sound
  playPickup(material = 'carton') {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    switch (material) {
      case 'glass':
        this._tone(t, 2400, 0.08, 0.07, 'sine');
        this._tone(t, 3850, 0.06, 0.05, 'sine');
        break;
      case 'metal':
        this._tone(t, 1650, 0.06, 0.06, 'triangle');
        this._noiseBurst(t, 0.025, 4200, 'highpass', 1.2, 0.06);
        break;
      case 'crinkle':
        this._noiseBurst(t, 0.075, 4800, 'bandpass', 1.8, 0.14);
        this._noiseBurst(t + 0.03, 0.055, 6200, 'highpass', 1.4, 0.09);
        break;
      case 'plastic':
        this._noiseBurst(t, 0.04, 2400, 'bandpass', 2.4, 0.11);
        this._tone(t, 680, 0.04, 0.06, 'sine', 920);
        break;
      case 'pudding':
        this._tone(t, 280, 0.14, 0.11, 'sine', 420);
        this._tone(t + 0.06, 390, 0.10, 0.07, 'sine', 310);
        break;
      case 'liquid':
        this._noiseBurst(t, 0.09, 900, 'bandpass', 3.0, 0.10);
        this._tone(t, 340, 0.09, 0.08, 'sine', 520);
        break;
      case 'produce':
        this._tone(t, 290, 0.05, 0.09, 'sine', 390);
        break;
      default: // carton
        this._noiseBurst(t, 0.04, 1400, 'bandpass', 1.5, 0.10);
        this._tone(t, 210, 0.05, 0.08, 'sine', 280);
        break;
    }
  }

  // Material-specific counter placement sound
  playPlace(material = 'carton', weight = 0.5) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const low = 175 - weight * 65;
    switch (material) {
      case 'glass':
        this._tone(t, 2180, 0.16, 0.10, 'sine');
        this._tone(t, 3620, 0.11, 0.07, 'sine');
        this._tone(t, 160, 0.06, 0.12, 'sine', 95);
        break;
      case 'metal':
        this._tone(t, 1420, 0.13, 0.09, 'triangle');
        this._tone(t, 2680, 0.09, 0.05, 'sine');
        this._tone(t, 190, 0.06, 0.13, 'sine', 110);
        break;
      case 'crinkle':
        this._noiseBurst(t, 0.11, 5200, 'bandpass', 1.5, 0.15);
        this._tone(t, 190, 0.05, 0.06, 'sine', 130);
        break;
      case 'plastic':
        this._noiseBurst(t, 0.045, 2900, 'bandpass', 2.2, 0.13);
        this._tone(t, 440, 0.05, 0.08, 'triangle', 260);
        break;
      case 'pudding':
        this._tone(t, 220, 0.16, 0.11, 'sine', 320);
        this._tone(t + 0.07, 290, 0.12, 0.07, 'sine', 210);
        break;
      case 'liquid':
        this._tone(t, low, 0.08, 0.15, 'sine', 75);
        this._noiseBurst(t + 0.02, 0.12, 750, 'bandpass', 3.5, 0.11);
        break;
      default:
        this._tone(t, low, 0.075, 0.14 + weight * 0.06, 'sine', 70);
        this._noiseBurst(t, 0.04, 1200, 'lowpass', 1.0, 0.09);
        break;
    }
  }

  // Dropping an item into the shopping bag (paper/canvas rustle + weighted thump)
  playBagDrop(weight = 0.5, material = 'carton') {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    // Bag paper rustle
    this._noiseBurst(t, 0.18, 2200, 'bandpass', 1.1, 0.22);
    this._noiseBurst(t + 0.04, 0.14, 3800, 'bandpass', 1.4, 0.13);
    // Weighted bass thump
    const thumpFreq = 145 - weight * 50;
    this._tone(t + 0.015, thumpFreq, 0.11, 0.20 + weight * 0.08, 'sine', 55);
    // Subtle material hint inside bag
    if (material === 'glass') {
      this._tone(t + 0.02, 2320, 0.11, 0.06, 'sine');
    } else if (material === 'crinkle') {
      this._noiseBurst(t + 0.02, 0.12, 5600, 'highpass', 1.2, 0.12);
    } else if (material === 'metal') {
      this._tone(t + 0.02, 1520, 0.09, 0.06, 'triangle');
    }
    // Warm tiny confirmation pop
    this._tone(t + 0.03, 520 + weight * 140, 0.09, 0.07, 'sine', 660 + weight * 140);
  }

  // Friendly soft bounce when trying to bag an unscanned item
  playScanFirstBounce() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 320, 0.09, 0.12, 'sine', 240);
    this._tone(t + 0.09, 280, 0.11, 0.11, 'sine', 370);
  }

  // Thermal receipt printer step feed
  playReceiptFeed() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.085, 3400, 'bandpass', 3.5, 0.065);
    this._tone(t, 640, 0.075, 0.025, 'sawtooth', 620);
  }

  // Tearing off the paper receipt "RRRIIIP!"
  playReceiptTear() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.2;
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(6400, t + 0.22);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.24, t + 0.03);
    g.gain.setValueAtTime(0.22, t + 0.17);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.26);
  }

  // Gold sticker peel & stick "peta!"
  playStickerStick() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.045, 4200, 'highpass', 1.2, 0.11);
    this._tone(t + 0.02, 580, 0.07, 0.12, 'sine', 880);
    this._tone(t + 0.04, 1320, 0.16, 0.08, 'sine');
  }

  // Conveyor belt motor whir
  playBeltWhir(duration = 0.55) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(78, t);
    osc.frequency.linearRampToValueAtTime(92, t + duration * 0.4);
    osc.frequency.linearRampToValueAtTime(70, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.08);
    g.gain.setValueAtTime(0.08, t + duration - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);

    this._noiseBurst(t, duration, 320, 'bandpass', 1.4, 0.045);
  }

  // Cash register KA-CHING + bell + metallic coin clinks!
  playKaChing(extraCoins = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    // Mechanical drawer slide
    this._noiseBurst(t, 0.14, 1400, 'bandpass', 1.6, 0.18);
    this._tone(t + 0.02, 160, 0.08, 0.16, 'triangle', 110);

    // Classic brass register bell "DING!"
    const bellT = t + 0.09;
    [1760, 3520, 4698, 5274].forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, bellT);
      const amp = [0.22, 0.11, 0.06, 0.04][i];
      const dec = [0.85, 0.55, 0.35, 0.25][i];
      g.gain.setValueAtTime(0.0001, bellT);
      g.gain.linearRampToValueAtTime(amp, bellT + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, bellT + dec);
      o.connect(g);
      g.connect(this.master);
      o.start(bellT);
      o.stop(bellT + dec + 0.02);
    });

    // Metallic coin cascade "jara-jara!"
    const coinCount = extraCoins ? 9 : 5;
    for (let i = 0; i < coinCount; i++) {
      const ct = t + 0.15 + i * 0.052 + Math.random() * 0.02;
      this.playCoinClinkAt(ct, 0.85 + Math.random() * 0.35);
    }
  }

  playCoinClink(pitchScale = 1.0) {
    if (!this._ready()) return;
    this.playCoinClinkAt(this.ctx.currentTime, pitchScale);
  }

  playCoinClinkAt(t, pitchScale = 1.0) {
    const f1 = 4150 * pitchScale;
    const f2 = 6380 * pitchScale;
    this._tone(t, f1, 0.14, 0.085, 'sine');
    this._tone(t, f2, 0.09, 0.055, 'sine');
  }

  // Cash drawer slide shut
  playDrawerClose() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._noiseBurst(t, 0.12, 1100, 'bandpass', 1.4, 0.14);
    this._tone(t + 0.09, 130, 0.08, 0.18, 'triangle', 75);
  }

  // Warm wordless customer happy melody when receiving bag
  playCustomerHappy(bonus = false) {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    const notes = bonus
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const nt = t + idx * 0.075;
      this._tone(nt, f, 0.28, 0.12, 'sine');
      this._tone(nt, f * 2, 0.14, 0.035, 'triangle');
    });
  }

  // Gentle tactile poke sound for inactive/background props
  playSoftTap() {
    if (!this._ready()) return;
    const t = this.ctx.currentTime;
    this._tone(t, 420, 0.045, 0.07, 'sine', 340);
  }

  // Helper: simple envelope tone
  _tone(t, freq, dur, amp, type = 'sine', endFreq = null) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq !== null) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Helper: filtered noise burst
  _noiseBurst(t, dur, freq, filterType = 'bandpass', q = 1.5, amp = 0.12) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const audio = new SupermarketAudio();
