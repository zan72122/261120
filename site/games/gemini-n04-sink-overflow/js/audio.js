// Procedural Web Audio API foley synthesizer for realistic tactile kitchen sounds

class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.initialized = false;

    // Continuous nodes
    this.streamGain = null;
    this.streamFilter = null;
    this.cavityFilter = null;
    this.cavityGain = null;
    this.overflowGain = null;
    this.vortexGain = null;
    this.vortexFilter = null;
    this.vortexLfo = null;

    this.lastScrubTime = 0;
    this.lastWipeTime = 0;
    this.lastSplashTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.65;

      // Subtle compressor to prevent clipping during wild splashing
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.005;
      comp.release.value = 0.15;

      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this._createNoiseBuffer();
      this._initContinuousLoops();
      this.initialized = true;
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
    // Pink-ish warm noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buf;
  }

  _initContinuousLoops() {
    const ctx = this.ctx;

    // 1. Running faucet water stream
    const srcStream = ctx.createBufferSource();
    srcStream.buffer = this.noiseBuffer;
    srcStream.loop = true;

    this.streamFilter = ctx.createBiquadFilter();
    this.streamFilter.type = 'bandpass';
    this.streamFilter.frequency.value = 1400;
    this.streamFilter.Q.value = 0.7;

    this.streamGain = ctx.createGain();
    this.streamGain.gain.value = 0;

    srcStream.connect(this.streamFilter);
    this.streamFilter.connect(this.streamGain);
    this.streamGain.connect(this.master);
    srcStream.start();

    // 2. Sink basin fill resonance (pitch climbs as water fills up!)
    const srcCavity = ctx.createBufferSource();
    srcCavity.buffer = this.noiseBuffer;
    srcCavity.loop = true;

    this.cavityFilter = ctx.createBiquadFilter();
    this.cavityFilter.type = 'bandpass';
    this.cavityFilter.frequency.value = 380;
    this.cavityFilter.Q.value = 5.5;

    this.cavityGain = ctx.createGain();
    this.cavityGain.gain.value = 0;

    srcCavity.connect(this.cavityFilter);
    this.cavityFilter.connect(this.cavityGain);
    this.cavityGain.connect(this.master);
    srcCavity.start();

    // 3. Overflow trickle
    const srcOver = ctx.createBufferSource();
    srcOver.buffer = this.noiseBuffer;
    srcOver.loop = true;

    const overFilter = ctx.createBiquadFilter();
    overFilter.type = 'highpass';
    overFilter.frequency.value = 2600;

    this.overflowGain = ctx.createGain();
    this.overflowGain.gain.value = 0;

    srcOver.connect(overFilter);
    overFilter.connect(this.overflowGain);
    this.overflowGain.connect(this.master);
    srcOver.start();

    // 4. Drain whirlpool vortex gurgle
    const srcVortex = ctx.createBufferSource();
    srcVortex.buffer = this.noiseBuffer;
    srcVortex.loop = true;

    this.vortexFilter = ctx.createBiquadFilter();
    this.vortexFilter.type = 'bandpass';
    this.vortexFilter.frequency.value = 320;
    this.vortexFilter.Q.value = 6.0;

    this.vortexLfo = ctx.createOscillator();
    this.vortexLfo.frequency.value = 6.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    this.vortexLfo.connect(lfoGain);
    lfoGain.connect(this.vortexFilter.frequency);
    this.vortexLfo.start();

    this.vortexGain = ctx.createGain();
    this.vortexGain.gain.value = 0;

    srcVortex.connect(this.vortexFilter);
    this.vortexFilter.connect(this.vortexGain);
    this.vortexGain.connect(this.master);
    srcVortex.start();
  }

  updateContinuous(flow, fillRatio, overflowIntensity, vortexAmount, dt) {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const smooth = 0.08;

    // Stream loudness & texture
    const targetStream = flow * 0.42;
    this.streamGain.gain.setTargetAtTime(targetStream, now, smooth);
    this.streamFilter.frequency.setTargetAtTime(1000 + flow * 900 + fillRatio * 500, now, smooth);

    // Acoustic cavity resonance rises as sink fills
    const targetCavity = flow * (0.14 + fillRatio * 0.2);
    const cavityFreq = 320 + Math.pow(fillRatio, 1.5) * 680;
    this.cavityGain.gain.setTargetAtTime(targetCavity, now, smooth);
    this.cavityFilter.frequency.setTargetAtTime(cavityFreq, now, smooth);

    // Overflow cascade shimmer
    this.overflowGain.gain.setTargetAtTime(Math.min(0.28, overflowIntensity * 0.22), now, 0.12);

    // Drain vortex gurgle
    this.vortexGain.gain.setTargetAtTime(vortexAmount * 0.48, now, 0.1);
    this.vortexFilter.frequency.setTargetAtTime(220 + (1 - fillRatio) * 320, now, 0.1);
    this.vortexLfo.frequency.setTargetAtTime(4.5 + (1 - fillRatio) * 7.5, now, 0.1);
  }

  playValveClick(opening) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(opening ? 320 : 250, now);
    osc.frequency.exponentialRampToValueAtTime(opening ? 680 : 140, now + 0.045);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playDrip(pitchMul = 1.0, volume = 0.16) {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = (860 + Math.random() * 260) * pitchMul;
    osc.frequency.setValueAtTime(base * 0.65, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.48, now + 0.055);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playSplash(intensity = 0.6) {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastSplashTime < 0.07) return;
    this.lastSplashTime = now;

    const ctx = this.ctx;
    const amp = Math.min(1, Math.max(0.15, intensity));

    // Noise burst
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520 + amp * 680, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.24);
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp * 0.42, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random() * 1.2, 0.3);

    // Resonant water plop
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sine';
    const startF = 180 + Math.random() * 90;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(startF * 2.1, now + 0.09);
    oGain.gain.setValueAtTime(amp * 0.24, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(oGain);
    oGain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playSoapSquirt() {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Viscous rising-then-popping squirt
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.19);

    // Airy pump noise
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(1600, now);
    flt.Q.value = 2.0;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.18, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(flt);
    flt.connect(nGain);
    nGain.connect(this.master);
    src.start(now, Math.random(), 0.14);
  }

  playBubblePop(size = 1.0) {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = (520 / Math.max(0.4, Math.min(1.8, size))) + Math.random() * 240;
    osc.frequency.setValueAtTime(base * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(base * 2.25, now + 0.042);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.17, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playScrub(speed = 0.5, cleanliness = 0.5) {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastScrubTime < 0.095) return;
    this.lastScrubTime = now;

    const ctx = this.ctx;
    // Soft foamy scrub noise
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(1200 + cleanliness * 1400, now);
    flt.Q.value = 1.6;

    const gain = ctx.createGain();
    const amp = Math.min(0.24, 0.06 + speed * 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    src.connect(flt);
    flt.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random(), 0.1);

    // Subtle squeaky-clean chirp when getting clean!
    if (cleanliness > 0.55) {
      const osc = ctx.createOscillator();
      const sGain = ctx.createGain();
      osc.type = 'sine';
      const f = 1400 + cleanliness * 950 + Math.random() * 200;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.18, now + 0.05);
      sGain.gain.setValueAtTime((cleanliness - 0.5) * 0.11, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(sGain);
      sGain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.065);
    }
  }

  playCleanSparkle() {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const notes = [880, 1174.66, 1567.98];
    notes.forEach((freq, i) => {
      const now = this.ctx.currentTime + i * 0.065;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  playWipe(speed = 0.5) {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.lastWipeTime < 0.11) return;
    this.lastWipeTime = now;

    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(950 + Math.random() * 350, now);
    flt.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.22, 0.07 + speed * 0.14), now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    src.connect(flt);
    flt.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random(), 0.13);
  }

  playDryShine() {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const notes = [1046.5, 1318.5, 1568.0, 2093.0];
    notes.forEach((freq, i) => {
      const now = this.ctx.currentTime + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = ctxGain(this.ctx, 0.11, now, 0.32);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.34);
    });
  }

  playDishClink(dishIndex = 0, onWood = false) {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Pleasant pentatonic ceramic / glass resonant fundamentals
    const fundamentals = [659.25, 783.99, 880.0, 1174.66, 987.77];
    const f0 = fundamentals[dishIndex % fundamentals.length];
    const isGlass = dishIndex === 3;

    const partials = isGlass ? [1, 2.32, 3.85] : [1, 1.88, 3.12];
    partials.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0 * ratio, now);
      const amp = (idx === 0 ? 0.18 : 0.08 / idx) * (isGlass ? 1.15 : 1.0);
      const decay = (isGlass ? 0.38 : 0.22) / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + decay);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + decay + 0.02);
    });

    if (onWood) {
      // Warm oak shelf hollow knock
      const wOsc = ctx.createOscillator();
      const wGain = ctx.createGain();
      wOsc.type = 'triangle';
      wOsc.frequency.setValueAtTime(215, now);
      wOsc.frequency.exponentialRampToValueAtTime(115, now + 0.055);
      wGain.gain.setValueAtTime(0.24, now);
      wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      wOsc.connect(wGain);
      wGain.connect(this.master);
      wOsc.start(now);
      wOsc.stop(now + 0.08);
    }
  }

  playPlugPop(pulled) {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pulled ? 190 : 380, now);
    osc.frequency.exponentialRampToValueAtTime(pulled ? 540 : 160, now + 0.075);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playSoftThud() {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.1);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playCelebration() {
    if (!this.initialized || this.ctx.state !== 'running') return;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5, 1567.98];
    notes.forEach((freq, i) => {
      const now = this.ctx.currentTime + i * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = ctxGain(this.ctx, 0.15, now, 0.55);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.6);

      // Gentle harmonic overtone
      const osc2 = this.ctx.createOscillator();
      const g2 = ctxGain(this.ctx, 0.05, now, 0.35);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now);
      osc2.connect(g2);
      g2.connect(this.master);
      osc2.start(now);
      osc2.stop(now + 0.38);
    });
  }
}

function ctxGain(ctx, peak, start, duration) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0008, start + duration);
  return g;
}

export const audio = new KitchenAudio();
