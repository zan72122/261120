// Pure Web Audio synthesizer for Little Pixel Kitchen — zero external audio files
(function () {
  class KitchenAudio {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this.sizzleGain = null;
      this.boilGain = null;
      this.sizzleTarget = 0;
      this.boilTarget = 0;
      this.boilTimer = 0;
      this.noiseBuf = null;
    }

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._buildNoiseBuffer();
        this._setupContinuousLoops();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = true;
    }

    _buildNoiseBuffer() {
      const sr = this.ctx.sampleRate;
      const len = sr * 2;
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.28) * 0.5;
      }
      this.noiseBuf = buf;
    }

    _setupContinuousLoops() {
      if (!this.ctx || !this.noiseBuf) return;
      // Continuous frying pan sizzle (high-passed pink/white noise)
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;

      const hp = this.ctx.createBiquadFilter();
      hp.type = "bandpass";
      hp.frequency.value = 3800;
      hp.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;

      src.connect(hp);
      hp.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
      this.sizzleGain = gain;
    }

    updateLoops(dt, sizzleAmt, boilAmt) {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      if (this.sizzleGain) {
        const target = Math.max(0.0001, Math.min(0.16, sizzleAmt * 0.14));
        this.sizzleGain.gain.setTargetAtTime(target, now, 0.08);
      }
      if (boilAmt > 0.05) {
        this.boilTimer -= dt;
        if (this.boilTimer <= 0) {
          this.boilTimer = (0.28 - Math.min(0.18, boilAmt * 0.16)) * (0.65 + Math.random() * 0.7);
          this.playBubble(boilAmt);
        }
      }
    }

    playBubble(intensity) {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const base = 240 + Math.random() * 190;
      osc.type = "sine";
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 2.1, now + 0.075);
      const vol = 0.03 + intensity * 0.045;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    playPick() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(590, now + 0.065);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.085);
    }

    playDrop(surface = "wood") {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      if (surface === "soup") {
        // Liquid plop!
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.11);
        g.gain.setValueAtTime(0.16, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        return;
      }
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      if (surface === "plate") {
        // Crisp ceramic clink
        osc.type = "sine";
        osc.frequency.setValueAtTime(1180, now);
        osc.frequency.exponentialRampToValueAtTime(860, now + 0.07);
        g.gain.setValueAtTime(0.09, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      } else if (surface === "pan") {
        // Metallic skillet thump
        osc.type = "triangle";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      } else {
        // Warm wooden thud
        osc.type = "triangle";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(135, now + 0.065);
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      }
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playChop(step = 0) {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      // Crisp wooden cutting board "TON!"
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const pitch = 390 + (step % 3) * 45 + Math.random() * 25;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.055);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);

      // Tiny crisp slice transient
      if (this.noiseBuf) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = "highpass";
        bp.frequency.value = 2600;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.09, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        n.connect(bp);
        bp.connect(ng);
        ng.connect(this.ctx.destination);
        n.start(now, Math.random() * 1.2, 0.04);
      }
    }

    playCrack() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      if (this.noiseBuf) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 3400;
        bp.Q.value = 1.5;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.20, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        n.connect(bp);
        bp.connect(g);
        g.connect(this.ctx.destination);
        n.start(now, Math.random(), 0.06);
      }
      // Wet egg plop right after crack
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(280, now + 0.035);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);
      og.gain.setValueAtTime(0.11, now + 0.035);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(og);
      og.connect(this.ctx.destination);
      osc.start(now + 0.035);
      osc.stop(now + 0.14);
    }

    playKnob(level) {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      // Mechanical "KACHI" click
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(level === 0 ? 520 : 720 + level * 140, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.03);
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);

      // Gas ignition "BOFF!" when turning ON
      if (level > 0 && this.noiseBuf) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(650 + level * 260, now);
        lp.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.18, now + 0.015);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
        n.connect(lp);
        lp.connect(ng);
        ng.connect(this.ctx.destination);
        n.start(now + 0.015, Math.random(), 0.22);
      }
    }

    playFlip() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(290, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);
      g.gain.setValueAtTime(0.11, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playStir() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      if (this.noiseBuf) {
        const n = this.ctx.createBufferSource();
        n.buffer = this.noiseBuf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(520, now);
        bp.frequency.linearRampToValueAtTime(920, now + 0.12);
        bp.Q.value = 2.0;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.09, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        n.connect(bp);
        bp.connect(g);
        g.connect(this.ctx.destination);
        n.start(now, Math.random(), 0.16);
      }
    }

    playSalt() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      if (!this.noiseBuf) return;
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 5000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      n.connect(hp);
      hp.connect(g);
      g.connect(this.ctx.destination);
      n.start(now, Math.random(), 0.09);
    }

    playKetchup() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sawtooth";
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.10);
      g.gain.setValueAtTime(0.10, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    }

    playBell() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const freqs = [1568, 3136, 4704]; // Crisp bright brass bell G6 harmonics
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);
        const amp = idx === 0 ? 0.16 : idx === 1 ? 0.07 : 0.03;
        const dur = idx === 0 ? 0.85 : 0.42;
        g.gain.setValueAtTime(amp, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + dur + 0.02);
      });
    }

    playPopTransform() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        const t = now + i * 0.045;
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.10, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    }

    playMunch() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320 + Math.random() * 80, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.05);
      g.gain.setValueAtTime(0.11, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }

    playHappyFanfare(grand = false) {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const notes = grand
        ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0]
        : [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        const t = now + i * 0.075;
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.13, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.30);
      });
    }

    playSurprised() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(840, now + 0.14);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    }

    playSoftChime() {
      if (!this.ctx || !this.unlocked) return;
      const now = this.ctx.currentTime;
      [659.25, 880].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "sine";
        const t = now + i * 0.06;
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    }
  }

  window.KitchenAudio = KitchenAudio;
})();
