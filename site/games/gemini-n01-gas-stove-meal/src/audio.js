export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.master = null;
    this.started = false;

    // Continuous loop nodes
    this.gasGain = null;
    this.gasFilter = null;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.waterGain = null;
    this.waterFilter = null;
    this.bubbleTimer = 0;
    this.sizzlePopTimer = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);

      // Build 2-second white noise buffer
      const sr = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, sr * 2, sr);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this._initContinuousLoops();
      this.started = true;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _initContinuousLoops() {
    const ctx = this.ctx;
    const makeNoiseLoop = (filterType, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
      return { filter, gain };
    };

    // Gas burner hiss
    const gas = makeNoiseLoop('bandpass', 720, 0.9);
    this.gasFilter = gas.filter;
    this.gasGain = gas.gain;

    // Pan oil sizzle
    const siz = makeNoiseLoop('highpass', 3200, 0.7);
    this.sizzleFilter = siz.filter;
    this.sizzleGain = siz.gain;

    // Sink running water
    const wat = makeNoiseLoop('bandpass', 1150, 0.65);
    this.waterFilter = wat.filter;
    this.waterGain = wat.gain;
  }

  updateContinuous(dt, { gasLevel = 0, soupHeat = 0, soupHasLiquid = false, panSizzle = 0, faucetLevel = 0 }) {
    if (!this.started || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Smooth gas hiss
    const gTarget = Math.max(0.0001, Math.min(0.14, gasLevel * 0.11));
    this.gasGain.gain.setTargetAtTime(gTarget, now, 0.06);
    this.gasFilter.frequency.setTargetAtTime(520 + gasLevel * 780, now, 0.08);

    // Smooth frying pan sizzle
    const sTarget = Math.max(0.0001, Math.min(0.16, panSizzle * 0.14));
    this.sizzleGain.gain.setTargetAtTime(sTarget, now, 0.08);
    this.sizzleFilter.frequency.setTargetAtTime(2800 + panSizzle * 1600, now, 0.1);

    // Occasional tiny oil crackle pops
    if (panSizzle > 0.2) {
      this.sizzlePopTimer -= dt;
      if (this.sizzlePopTimer <= 0) {
        this.sizzlePopTimer = 0.06 + Math.random() * (0.22 / Math.max(0.25, panSizzle));
        this._playTinyCrack(panSizzle * 0.08);
      }
    }

    // Soup simmering / boiling kotokoto bubbles
    if (soupHasLiquid && soupHeat > 0.35) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        const rate = 0.06 + (1.1 - Math.min(1, soupHeat)) * 0.34;
        this.bubbleTimer = rate * (0.5 + Math.random());
        this.playSoupBubble(soupHeat);
      }
    }

    // Running faucet water
    const wTarget = Math.max(0.0001, Math.min(0.16, faucetLevel * 0.15));
    this.waterGain.gain.setTargetAtTime(wTarget, now, 0.05);
    this.waterFilter.frequency.setTargetAtTime(900 + faucetLevel * 650, now, 0.08);
  }

  _playTinyCrack(vol) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4200 + Math.random() * 2800;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.5, 0.022);
  }

  playChop(pitchShift = 1) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Crisp wood cutting board "ton!"
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 * pitchShift, now);
    osc.frequency.exponentialRampToValueAtTime(92 * pitchShift, now + 0.065);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.08);

    // Crisp vegetable snap
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400 * pitchShift;
    f.Q.value = 2.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    src.connect(f); f.connect(ng); ng.connect(this.master);
    src.start(now, Math.random(), 0.04);
  }

  playPlop(pitch = 1) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(620 * pitch, now + 0.085);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.12);
  }

  playWaterPourGlug(progress = 0.5) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const base = 320 + progress * 360;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.48, now + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.1);
  }

  playEggTap(broken = false) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Crisp shell knock "kon!"
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(broken ? 920 : 1280, now);
    osc.frequency.exponentialRampToValueAtTime(broken ? 340 : 620, now + 0.045);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.06);

    if (broken) {
      // Wet glossy drop "purun!"
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(190, now + 0.09);
      o2.frequency.exponentialRampToValueAtTime(340, now + 0.19);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.001, now);
      g2.gain.setValueAtTime(0.22, now + 0.09);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      o2.connect(g2); g2.connect(this.master);
      o2.start(now + 0.08); o2.stop(now + 0.25);
    }
  }

  playKnobClick(step = 1) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Mechanical spring detent "kachi!"
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400 + step * 180, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.025);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    osc.connect(f); f.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.036);
  }

  playGasIgnite() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Double piezo spark "kachi-kachi"
    [0, 0.075].forEach((delay) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2600, now + delay);
      osc.frequency.exponentialRampToValueAtTime(420, now + delay + 0.022);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, now + delay);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.026);
      osc.connect(g); g.connect(this.master);
      osc.start(now + delay); osc.stop(now + delay + 0.03);
    });
    // Warm gas "BOFF!" ignition whoosh
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(680, now + 0.12);
    lp.frequency.exponentialRampToValueAtTime(190, now + 0.38);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now + 0.11);
    g.gain.linearRampToValueAtTime(0.32, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(now + 0.11, 0, 0.35);
  }

  playSoupBubble(intensity = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f0 = 190 + Math.random() * 210;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f0 * 2.1, now + 0.065);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05 + intensity * 0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.08);
  }

  playSteamBurst() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 3400;
    hp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(hp); hp.connect(g); g.connect(this.master);
    src.start(now, Math.random(), 0.4);
  }

  playStirSwish() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(600, now);
    f.frequency.linearRampToValueAtTime(1100, now + 0.12);
    f.Q.value = 2.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(now, Math.random(), 0.16);
  }

  playShaker() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    [0, 0.085].forEach((d) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, now + d);
      g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.055);
      src.connect(hp); hp.connect(g); g.connect(this.master);
      src.start(now + d, Math.random(), 0.06);
    });
  }

  playCeramicClink(pitch = 1) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    [1320, 2680].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * pitch;
      const g = ctx.createGain();
      g.gain.setValueAtTime(i === 0 ? 0.14 : 0.07, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(g); g.connect(this.master);
      osc.start(now); osc.stop(now + 0.15);
    });
  }

  playWoodTap(pitch = 1) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, now + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.065);
  }

  playWarmChime(notes = [523.25, 659.25, 783.99]) {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const t = now + i * 0.095;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = freq * 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.04, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g); g.connect(this.master);
      o2.connect(g2); g2.connect(this.master);
      osc.start(t); osc.stop(t + 0.48);
      o2.start(t); o2.stop(t + 0.2);
    });
  }

  playMomYum(stage = 1) {
    // Soft musical warm happy sigh / smile chord
    const notes = stage === 1
      ? [440, 554.37, 659.25]
      : [523.25, 659.25, 783.99, 1046.5];
    this.playWarmChime(notes);
  }

  playCrayonSwish() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900 + Math.random() * 500;
    bp.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(now, Math.random(), 0.09);
  }

  playHanamaruFanfare() {
    this.playWarmChime([523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5]);
  }

  playScrubSqueak() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.linearRampToValueAtTime(2900, now + 0.08);
    bp.Q.value = 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(now, Math.random(), 0.1);
  }

  playBubblePop() {
    this.unlock();
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const f = 520 + Math.random() * 480;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 2.3, now + 0.045);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.06);
  }

  playSqueakyClean() {
    this.playWarmChime([880, 1174.66, 1318.5, 1760]);
  }
}
