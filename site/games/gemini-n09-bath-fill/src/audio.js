// Procedural Web Audio API realistic bathroom foley & water acoustics
// All sounds respond continuously to physical state (flow rate, water depth, foam, splash, vortex, wipe).

export class BathAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.muted = false;

    // Continuous nodes
    this.faucetGain = null;
    this.faucetFilter = null;
    this.faucetSplashGain = null;
    this.faucetSplashFilter = null;

    this.drainGain = null;
    this.drainFilter = null;
    this.drainLfo = null;

    this.overflowGain = null;
    this.overflowFilter = null;

    this.wipeGain = null;
    this.wipeFilter = null;

    this.fizzGain = null;
    this.fizzFilter = null;

    this.noiseBuffer = null;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.unlocked = true;

    // 3-second seamless pink/white noise buffer
    const sr = this.ctx.sampleRate;
    const len = sr * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sr);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.07;
      b6 = white * 0.115926;
    }

    // Master compressor & slight bathroom early-reflection delay
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.82;

    const delay = this.ctx.createDelay(0.15);
    delay.delayTime.value = 0.038;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.22;
    const damp = this.ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2600;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.18;

    this.master.connect(this.ctx.destination);
    this.master.connect(delay);
    delay.connect(damp);
    damp.connect(fb);
    fb.connect(delay);
    damp.connect(wet);
    wet.connect(this.ctx.destination);

    // 1. Faucet body stream (bandpass noise that shifts pitch as tub fills)
    const fSrc = this._loopNoise();
    this.faucetFilter = this.ctx.createBiquadFilter();
    this.faucetFilter.type = 'bandpass';
    this.faucetFilter.frequency.value = 800;
    this.faucetFilter.Q.value = 0.9;
    this.faucetGain = this.ctx.createGain();
    this.faucetGain.gain.value = 0;
    fSrc.connect(this.faucetFilter).connect(this.faucetGain).connect(this.master);

    // 1b. Faucet surface splash sparkle (highpass noise)
    const fsSrc = this._loopNoise();
    this.faucetSplashFilter = this.ctx.createBiquadFilter();
    this.faucetSplashFilter.type = 'highpass';
    this.faucetSplashFilter.frequency.value = 1800;
    this.faucetSplashGain = this.ctx.createGain();
    this.faucetSplashGain.gain.value = 0;
    fsSrc.connect(this.faucetSplashFilter).connect(this.faucetSplashGain).connect(this.master);

    // 2. Drain vortex gurgle (resonant bandpass modulated by LFO)
    const dSrc = this._loopNoise();
    this.drainFilter = this.ctx.createBiquadFilter();
    this.drainFilter.type = 'bandpass';
    this.drainFilter.frequency.value = 340;
    this.drainFilter.Q.value = 4.2;
    this.drainGain = this.ctx.createGain();
    this.drainGain.gain.value = 0;

    this.drainLfo = this.ctx.createOscillator();
    this.drainLfo.frequency.value = 5.5;
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.value = 140;
    this.drainLfo.connect(lfoDepth).connect(this.drainFilter.frequency);
    this.drainLfo.start();
    dSrc.connect(this.drainFilter).connect(this.drainGain).connect(this.master);

    // 3. Overflow cascade trickle
    const oSrc = this._loopNoise();
    this.overflowFilter = this.ctx.createBiquadFilter();
    this.overflowFilter.type = 'bandpass';
    this.overflowFilter.frequency.value = 2100;
    this.overflowFilter.Q.value = 1.4;
    this.overflowGain = this.ctx.createGain();
    this.overflowGain.gain.value = 0;
    oSrc.connect(this.overflowFilter).connect(this.overflowGain).connect(this.master);

    // 4. Towel wiping cloth friction
    const wSrc = this._loopNoise();
    this.wipeFilter = this.ctx.createBiquadFilter();
    this.wipeFilter.type = 'bandpass';
    this.wipeFilter.frequency.value = 950;
    this.wipeFilter.Q.value = 1.8;
    this.wipeGain = this.ctx.createGain();
    this.wipeGain.gain.value = 0;
    wSrc.connect(this.wipeFilter).connect(this.wipeGain).connect(this.master);

    // 5. Effervescent bath foam fizz
    const zSrc = this._loopNoise();
    this.fizzFilter = this.ctx.createBiquadFilter();
    this.fizzFilter.type = 'highpass';
    this.fizzFilter.frequency.value = 4200;
    this.fizzGain = this.ctx.createGain();
    this.fizzGain.gain.value = 0;
    zSrc.connect(this.fizzFilter).connect(this.fizzGain).connect(this.master);
  }

  _loopNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.start(0, Math.random() * 2.5);
    return src;
  }

  updateContinuous({ flow, fill, draining, overflowRate, wipeSpeed, fizzLevel }) {
    if (!this.unlocked || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const tau = 0.08;

    // Faucet pitch rises subtly as water gets closer to spout, plus deeper resonance at low fill
    const fAmp = flow > 0.01 ? (0.12 + 0.55 * flow) : 0;
    const fFreq = 420 + fill * 540 + flow * 280;
    this.faucetGain.gain.setTargetAtTime(fAmp, t, tau);
    this.faucetFilter.frequency.setTargetAtTime(fFreq, t, tau);

    const fsAmp = flow > 0.01 ? (0.04 + 0.22 * flow * (1 - fill * 0.35)) : 0;
    this.faucetSplashGain.gain.setTargetAtTime(fsAmp, t, tau);
    this.faucetSplashFilter.frequency.setTargetAtTime(1600 + fill * 900, t, tau);

    // Drain gurgle intensifies when water gets shallow (air-sucking vortex!)
    const dStrength = draining > 0.01 ? draining : 0;
    const shallowBoost = fill < 0.28 && fill > 0.01 ? (1.0 + (0.28 - fill) * 3.5) : 1.0;
    this.drainGain.gain.setTargetAtTime(Math.min(0.65, dStrength * 0.28 * shallowBoost), t, 0.1);
    this.drainFilter.frequency.setTargetAtTime(260 + (1 - fill) * 260, t, 0.12);
    this.drainLfo.frequency.setTargetAtTime(3.8 + (1 - fill) * 6.5, t, 0.15);

    // Overflow trickle
    const oAmp = Math.min(0.35, overflowRate * 0.45);
    this.overflowGain.gain.setTargetAtTime(oAmp, t, 0.1);

    // Towel cloth wipe
    const wAmp = Math.min(0.28, wipeSpeed * 0.22);
    this.wipeGain.gain.setTargetAtTime(wAmp, t, 0.05);
    this.wipeFilter.frequency.setTargetAtTime(750 + Math.min(1200, wipeSpeed * 700), t, 0.06);

    // Bath additive fizz
    this.fizzGain.gain.setTargetAtTime(Math.min(0.16, fizzLevel * 0.18), t, 0.12);
  }

  playLeverClick(opening) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(opening ? 320 : 250, t);
    osc.frequency.exponentialRampToValueAtTime(opening ? 520 : 150, t + 0.055);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  playSplash(intensity = 0.6) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    const amp = Math.min(0.45, 0.1 + intensity * 0.35);

    // Filtered noise burst
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900 + Math.random() * 500, t);
    bp.frequency.exponentialRampToValueAtTime(380, t + 0.24);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2.0, 0.3);

    // Liquid bloop undertone
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    const baseF = 240 + Math.random() * 140;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseF, t);
    osc.frequency.exponentialRampToValueAtTime(baseF * 1.9, t + 0.11);
    og.gain.setValueAtTime(amp * 0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  playBubblePop() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = 520 + Math.random() * 680;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 2.1, t + 0.032);
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.042);
  }

  playPlugPop(pulledOut) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    if (pulledOut) {
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(480, t + 0.085);
    } else {
      osc.frequency.setValueAtTime(310, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    }
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  playCeramicClink(pitch = 1.0) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    [1420 * pitch, 2680 * pitch].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(idx === 0 ? 0.09 : 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + (idx === 0 ? 0.18 : 0.09));
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  playWoodKnock() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(125, t + 0.075);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playPourGlug() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = 320 + Math.random() * 140;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.07);
    osc.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.13);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }
}
