// Synthesized tactile kitchen Foley & cozy vocal feedback (Web Audio API)

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.whiskGain = null;
    this.whiskFilter = null;
    this.syrupGain = null;
    this.syrupOsc = null;
    this.syrupFilter = null;
    this.lastClinkTime = 0;
    this.lastSyrupDrop = 0;
    this.sizzleTarget = 0;
    this.syrupActive = false;
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
      this._setupContinuousLoops();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Warm pink-ish noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 1.4;
    }
    this.noiseBuf = buf;
  }

  _setupContinuousLoops() {
    const now = this.ctx.currentTime;

    // 1. Pan sizzle loop
    const sizSrc = this.ctx.createBufferSource();
    sizSrc.buffer = this.noiseBuf;
    sizSrc.loop = true;
    const sizHp = this.ctx.createBiquadFilter();
    sizHp.type = 'bandpass';
    sizHp.frequency.value = 3400;
    sizHp.Q.value = 0.85;
    const sizGain = this.ctx.createGain();
    sizGain.gain.setValueAtTime(0.0001, now);
    sizSrc.connect(sizHp);
    sizHp.connect(sizGain);
    sizGain.connect(this.master);
    sizSrc.start();
    this.sizzleFilter = sizHp;
    this.sizzleGain = sizGain;

    // 2. Whisk slosh loop
    const wSrc = this.ctx.createBufferSource();
    wSrc.buffer = this.noiseBuf;
    wSrc.loop = true;
    const wBp = this.ctx.createBiquadFilter();
    wBp.type = 'bandpass';
    wBp.frequency.value = 650;
    wBp.Q.value = 1.6;
    const wGain = this.ctx.createGain();
    wGain.gain.setValueAtTime(0.0001, now);
    wSrc.connect(wBp);
    wBp.connect(wGain);
    wGain.connect(this.master);
    wSrc.start();
    this.whiskFilter = wBp;
    this.whiskGain = wGain;

    // 3. Maple syrup pour loop
    const sySrc = this.ctx.createBufferSource();
    sySrc.buffer = this.noiseBuf;
    sySrc.loop = true;
    const syBp = this.ctx.createBiquadFilter();
    syBp.type = 'bandpass';
    syBp.frequency.value = 520;
    syBp.Q.value = 3.2;
    const syGain = this.ctx.createGain();
    syGain.gain.setValueAtTime(0.0001, now);
    sySrc.connect(syBp);
    syBp.connect(syGain);
    syGain.connect(this.master);
    sySrc.start();
    this.syrupFilter = syBp;
    this.syrupGain = syGain;
  }

  setSizzle(intensity) {
    this.sizzleTarget = Math.max(0, Math.min(1, intensity));
    if (!this.ctx || !this.sizzleGain) return;
    const now = this.ctx.currentTime;
    const g = this.sizzleTarget > 0.01 ? 0.018 + this.sizzleTarget * 0.11 : 0.0001;
    this.sizzleGain.gain.setTargetAtTime(g, now, 0.08);
    this.sizzleFilter.frequency.setTargetAtTime(2800 + this.sizzleTarget * 2200, now, 0.12);
  }

  updateWhisk(speed, wetness) {
    if (!this.ctx || !this.whiskGain) return;
    const now = this.ctx.currentTime;
    const clamped = Math.min(1, speed);
    const g = clamped > 0.03 ? clamped * (0.04 + wetness * 0.14) : 0.0001;
    this.whiskGain.gain.setTargetAtTime(g, now, 0.05);
    this.whiskFilter.frequency.setTargetAtTime(380 + clamped * 520 + wetness * 260, now, 0.06);

    // Occasional soft ceramic-wire clink when whisking briskly
    if (clamped > 0.45 && now - this.lastClinkTime > 0.28 + Math.random() * 0.25) {
      this.lastClinkTime = now;
      this._playTone(1850 + Math.random() * 450, 0.06, 'sine', 0.035, 1200);
    }
  }

  setSyrupPour(active, fullness = 0) {
    this.syrupActive = active;
    if (!this.ctx || !this.syrupGain) return;
    const now = this.ctx.currentTime;
    if (active) {
      this.syrupGain.gain.setTargetAtTime(0.11, now, 0.06);
      this.syrupFilter.frequency.setTargetAtTime(420 + fullness * 360 + Math.sin(now * 9) * 65, now, 0.05);
      if (now - this.lastSyrupDrop > 0.14 + Math.random() * 0.1) {
        this.lastSyrupDrop = now;
        const base = 320 + fullness * 240 + Math.random() * 90;
        this._playTone(base, 0.075, 'sine', 0.06, base * 1.45);
      }
    } else {
      this.syrupGain.gain.setTargetAtTime(0.0001, now, 0.08);
    }
  }

  _playTone(freq, dur, type = 'sine', vol = 0.15, endFreq = null, delay = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + Math.min(0.012, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _playNoiseBurst(dur, freq = 1500, Q = 1.0, vol = 0.15, delay = 0) {
    if (!this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(freq, now);
    filt.Q.value = Q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + Math.min(0.015, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random() * 1.2, dur + 0.02);
  }

  eggCrack() {
    this.unlock();
    // Crisp shell crack on ceramic rim
    this._playNoiseBurst(0.055, 4200, 1.8, 0.28, 0);
    this._playNoiseBurst(0.04, 2400, 2.2, 0.20, 0.045);
    this._playTone(1350, 0.05, 'triangle', 0.12, 680, 0);
    // Wet plop of yolk into bowl
    this._playTone(230, 0.11, 'sine', 0.18, 460, 0.22);
    this._playNoiseBurst(0.08, 600, 1.4, 0.08, 0.23);
  }

  milkPour() {
    this.unlock();
    this._playNoiseBurst(0.72, 1100, 1.2, 0.14, 0.05);
    for (let i = 0; i < 6; i++) {
      const f = 310 + i * 55 + Math.random() * 40;
      this._playTone(f, 0.09, 'sine', 0.07, f * 1.42, 0.08 + i * 0.1);
    }
  }

  flourPuff() {
    this.unlock();
    this._playNoiseBurst(0.22, 900, 0.7, 0.12, 0);
  }

  batterReady() {
    this.unlock();
    // Gentle warm marimba-like triad
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this._playTone(n, 0.34, 'sine', 0.08, n, idx * 0.075);
      this._playTone(n * 2, 0.16, 'triangle', 0.025, n * 2, idx * 0.075);
    });
  }

  batterPour() {
    this.unlock();
    this._playTone(210, 0.14, 'sine', 0.13, 330, 0);
    this._playTone(260, 0.13, 'sine', 0.11, 390, 0.11);
    this._playNoiseBurst(0.26, 2600, 1.0, 0.09, 0.15);
  }

  bubblePop() {
    if (!this.ctx) return;
    const f = 540 + Math.random() * 340;
    this._playTone(f, 0.045, 'sine', 0.055, f * 1.55);
  }

  flipWhoosh(high = false) {
    this.unlock();
    this._playNoiseBurst(high ? 0.32 : 0.18, high ? 1400 : 1050, 1.2, 0.16, 0);
    this._playTone(260, high ? 0.28 : 0.16, 'sine', 0.11, high ? 680 : 460, 0);
    if (high) {
      this._playTone(880, 0.22, 'sine', 0.06, 1174, 0.12);
    }
  }

  panLand(crispy = false) {
    this.unlock();
    this._playTone(155, 0.11, 'sine', 0.2, 85, 0);
    this._playNoiseBurst(0.24, crispy ? 4200 : 3100, 0.9, crispy ? 0.18 : 0.12, 0.02);
  }

  stackPlop(layerIndex = 0) {
    this.unlock();
    const lift = Math.min(layerIndex, 8) * 28;
    this._playTone(170 + lift, 0.14, 'sine', 0.21, 110 + lift * 0.5, 0);
    this._playTone(290 + lift, 0.09, 'triangle', 0.07, 410 + lift, 0.04);
  }

  wobbleBoing() {
    this.unlock();
    this._playTone(185, 0.16, 'sine', 0.09, 245, 0);
    this._playTone(245, 0.14, 'sine', 0.07, 175, 0.11);
  }

  butterPlop() {
    this.unlock();
    this._playTone(220, 0.09, 'sine', 0.16, 145, 0);
    this._playNoiseBurst(0.35, 3600, 1.1, 0.075, 0.06);
  }

  creamPipe() {
    this.unlock();
    this._playNoiseBurst(0.16, 2200, 1.4, 0.12, 0);
    this._playTone(460, 0.09, 'sine', 0.07, 680, 0.04);
  }

  berryPlop() {
    this.unlock();
    const base = 480 + Math.random() * 140;
    this._playTone(base, 0.08, 'sine', 0.12, base * 1.38, 0);
  }

  plateSlide() {
    this.unlock();
    this._playNoiseBurst(0.42, 650, 1.3, 0.11, 0);
    this._playTone(260, 0.25, 'triangle', 0.04, 190, 0.04);
  }

  guestGreet(type = 'kitten') {
    this.unlock();
    if (type === 'kitten') {
      // Soft happy trill "mrrp!"
      this._playTone(540, 0.16, 'sine', 0.11, 780, 0);
      this._playTone(620, 0.14, 'triangle', 0.05, 860, 0.04);
    } else if (type === 'bunny') {
      // Soft delicate happy squeak-chirp
      this._playTone(760, 0.08, 'sine', 0.08, 980, 0);
      this._playTone(840, 0.09, 'sine', 0.07, 1080, 0.1);
    } else {
      // Cozy puppy warm yip
      this._playTone(460, 0.11, 'triangle', 0.11, 690, 0);
      this._playTone(520, 0.11, 'sine', 0.09, 760, 0.14);
    }
  }

  guestMunch(crispy = false) {
    this.unlock();
    this._playNoiseBurst(0.085, crispy ? 2600 : 1200, 1.4, crispy ? 0.17 : 0.11, 0);
    this._playTone(210, 0.07, 'sine', 0.09, 130, 0.01);
    this._playNoiseBurst(0.07, crispy ? 2900 : 1400, 1.5, crispy ? 0.13 : 0.08, 0.12);
  }

  guestLick() {
    this.unlock();
    this._playTone(420, 0.09, 'sine', 0.09, 740, 0);
    this._playNoiseBurst(0.06, 1800, 2.0, 0.05, 0.02);
  }

  guestDelight() {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    notes.forEach((f, i) => {
      this._playTone(f, 0.45, 'sine', 0.085, f, i * 0.085);
      this._playTone(f * 2, 0.2, 'triangle', 0.025, f * 2, i * 0.085);
    });
    // Warm cozy purr rumble
    for (let i = 0; i < 4; i++) {
      this._playTone(95, 0.18, 'sine', 0.06, 82, 0.15 + i * 0.22);
    }
  }

  softNudge() {
    this.unlock();
    this._playTone(680 + Math.random() * 140, 0.055, 'sine', 0.05, 520);
  }
}

export const sound = new SoundEngine();
