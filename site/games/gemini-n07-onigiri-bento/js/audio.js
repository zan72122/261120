// Pure Web Audio API tactile ASMR foley synthesizer (iOS Safari safe, zero external audio dependencies)
export class BentoAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      // Pre-generate 1.5s white noise buffer for tactile foley (rice, nori, cloth)
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.floor(sr * 1.5), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _noiseBurst({ duration = 0.12, freq = 1200, q = 1.2, filterType = 'bandpass', gain = 0.22, attack = 0.008, delay = 0 } = {}) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(q, now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.6, duration + 0.02);
  }

  _tone({ freq = 320, endFreq = null, duration = 0.14, type = 'sine', gain = 0.14, attack = 0.006, delay = 0 } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // Soft warm fluffy rice scoop from wooden bowl
  playRiceScoop() {
    this.unlock();
    this._noiseBurst({ duration: 0.19, freq: 950, q: 0.9, gain: 0.16, attack: 0.025 });
    this._noiseBurst({ duration: 0.14, freq: 2200, q: 1.4, gain: 0.07, attack: 0.03, delay: 0.04 });
    this._tone({ freq: 210, endFreq: 145, duration: 0.11, gain: 0.08 });
  }

  // Moist gentle hand-patting & squeezing onigiri ("kyu-ppan!")
  playRicePat(step = 0) {
    this.unlock();
    const pitch = 1 + step * 0.08;
    // Soft hollow palm cup pat
    this._tone({ freq: 165 * pitch, endFreq: 95, duration: 0.09, gain: 0.18, attack: 0.004 });
    // Moist sticky rice squish
    this._noiseBurst({ duration: 0.11, freq: 1450 * pitch, q: 1.6, gain: 0.15, attack: 0.01 });
    this._noiseBurst({ duration: 0.08, freq: 3100, q: 2.0, gain: 0.06, attack: 0.012, delay: 0.02 });
  }

  // Crisp dry roasted yakinori seaweed crinkle ("pari-pari!")
  playNoriCrinkle() {
    this.unlock();
    for (let i = 0; i < 4; i++) {
      this._noiseBurst({
        duration: 0.055 + Math.random() * 0.03,
        freq: 3200 + Math.random() * 1800,
        q: 1.8,
        filterType: 'highpass',
        gain: 0.11 - i * 0.015,
        attack: 0.003,
        delay: i * 0.048,
      });
    }
    this._noiseBurst({ duration: 0.18, freq: 1900, q: 1.2, gain: 0.09, delay: 0.03 });
  }

  // Soft nestling thud placing food into cedar bentwood box
  playPackFood(kind = 'onigiri') {
    this.unlock();
    if (kind === 'tomato') {
      // Crisp light hollow cherry tomato tap ("koton")
      this._tone({ freq: 440, endFreq: 290, duration: 0.07, gain: 0.13 });
      this._tone({ freq: 620, endFreq: 480, duration: 0.045, gain: 0.07, delay: 0.05 });
    } else if (kind === 'tamago') {
      // Soft pillowy egg settle ("fuka-pon")
      this._tone({ freq: 240, endFreq: 165, duration: 0.10, gain: 0.14 });
      this._noiseBurst({ duration: 0.07, freq: 1100, q: 1.0, gain: 0.06 });
    } else {
      // Plump onigiri resting into cedar box
      this._tone({ freq: 205, endFreq: 130, duration: 0.12, gain: 0.17 });
      this._noiseBurst({ duration: 0.09, freq: 1600, q: 1.3, gain: 0.08, delay: 0.02 });
    }
  }

  // Authentic hollow cedar magewappa wooden lid closing click ("katon!")
  playLidClose() {
    this.unlock();
    this._tone({ freq: 310, endFreq: 185, duration: 0.11, type: 'triangle', gain: 0.22 });
    this._tone({ freq: 520, endFreq: 380, duration: 0.06, type: 'sine', gain: 0.11, delay: 0.055 });
    this._noiseBurst({ duration: 0.06, freq: 1400, q: 2.2, gain: 0.12, delay: 0.05 });
  }

  // Crisp woven cotton gingham handkerchief fold rustle ("sara-sara")
  playClothFold(isKnot = false) {
    this.unlock();
    this._noiseBurst({ duration: 0.22, freq: 1750, q: 0.85, gain: 0.15, attack: 0.03 });
    this._noiseBurst({ duration: 0.18, freq: 3400, q: 1.1, gain: 0.07, attack: 0.04, delay: 0.06 });
    if (isKnot) {
      // Warm soft wooden marimba double-note when bow knot cinches!
      this._tone({ freq: 523.25, duration: 0.26, gain: 0.12, delay: 0.14 });
      this._tone({ freq: 659.25, duration: 0.34, gain: 0.13, delay: 0.24 });
    }
  }

  // Gentle tactile micro-feedback for non-active living props (wood knock / ceramic tink / wobble)
  playPropTap(material = 'wood') {
    this.unlock();
    if (material === 'ceramic') {
      this._tone({ freq: 1380, endFreq: 1340, duration: 0.16, gain: 0.07 });
      this._tone({ freq: 2420, endFreq: 2390, duration: 0.09, gain: 0.04 });
    } else if (material === 'wobble') {
      this._tone({ freq: 340, endFreq: 390, duration: 0.07, gain: 0.07 });
    } else {
      // Hollow cedar / oak knock
      this._tone({ freq: 290, endFreq: 210, duration: 0.075, type: 'triangle', gain: 0.12 });
    }
  }

  // Warm joyful morning acoustic chord when handing the wrapped bento to Papa!
  playPapaThanks() {
    this.unlock();
    // Warm rising major-9th acoustic marimba/harp bloom (no voice text, pure warmth!)
    const notes = [392.0, 493.88, 587.33, 739.99, 783.99]; // G4, B4, D5, F#5, G5
    notes.forEach((f, idx) => {
      this._tone({
        freq: f,
        duration: 0.65 - idx * 0.05,
        type: 'sine',
        gain: 0.11,
        attack: 0.014,
        delay: idx * 0.095,
      });
    });
    // Subtle cheerful morning birdsong trill in background
    this._tone({ freq: 2150, endFreq: 2680, duration: 0.09, gain: 0.032, delay: 0.52 });
    this._tone({ freq: 2580, endFreq: 2220, duration: 0.10, gain: 0.032, delay: 0.64 });
    this._tone({ freq: 2300, endFreq: 2840, duration: 0.11, gain: 0.028, delay: 0.78 });
  }
}
