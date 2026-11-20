// Procedural realistic acoustic foley engine (Web Audio API) — zero external audio files needed.
// Produces natural paper, adhesive peel, vinyl press, cardboard slide, porcelain teacup, wood pencil,
// and warm acoustic applause + harp celebration sounds.

export function createFoleyAudio() {
  let ctx = null;
  let noiseBuf = null;
  let lastStretchTime = 0;

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // Create 2-second reusable white noise buffer
      const sr = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, sr * 2, sr);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function makeNoiseSource(ac, offset = 0) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  return {
    unlock() {
      ensureContext();
    },

    // Crisp micro-tick when fingernail catches the glossy sticker corner
    playPeelStart() {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;
      const src = makeNoiseSource(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3400, now);
      bp.frequency.exponentialRampToValueAtTime(5200, now + 0.045);
      bp.Q.value = 3.2;

      const g = ac.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);

      src.connect(bp).connect(g).connect(ac.destination);
      src.start(now, Math.random() * 1.2);
      src.stop(now + 0.06);
    },

    // Granular sticky adhesive peel crinkle as sticker curls off the silicone liner
    playPeelStretch(speed = 1.0) {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;
      if (now - lastStretchTime < 0.042) return;
      lastStretchTime = now;

      const src = makeNoiseSource(ac);
      const hp = ac.createBiquadFilter();
      hp.type = 'bandpass';
      const baseFreq = 2600 + Math.min(2200, speed * 900) + Math.random() * 700;
      hp.frequency.setValueAtTime(baseFreq, now);
      hp.Q.value = 2.4;

      const g = ac.createGain();
      const peak = Math.min(0.085, 0.032 + speed * 0.028);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);

      src.connect(hp).connect(g).connect(ac.destination);
      src.start(now, Math.random() * 1.4);
      src.stop(now + 0.05);
    },

    // Satisfying crisp vinyl separation pop when sticker lifts completely free
    playPeelPop() {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;

      // Short papery snap
      const src = makeNoiseSource(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2800, now);
      bp.frequency.exponentialRampToValueAtTime(1400, now + 0.065);
      bp.Q.value = 1.8;

      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.14, now + 0.005);
      ng.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);
      src.connect(bp).connect(ng).connect(ac.destination);
      src.start(now, Math.random() * 1.2);
      src.stop(now + 0.075);

      // Tiny hollow elastic pop harmonic
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(860, now + 0.045);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.001, now);
      og.gain.linearRampToValueAtTime(0.055, now + 0.006);
      og.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);
      osc.connect(og).connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    },

    // Tactile press-down sound when sticking onto drawing paper (or oak table!)
    playStickPress(onWood = false) {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;

      // Soft body thump
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(onWood ? 210 : 155, now);
      osc.frequency.exponentialRampToValueAtTime(onWood ? 95 : 68, now + 0.065);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.001, now);
      og.gain.linearRampToValueAtTime(onWood ? 0.14 : 0.11, now + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
      osc.connect(og).connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.08);

      // Crisp paper-smooth settle brush
      const src = makeNoiseSource(ac);
      const lp = ac.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.setValueAtTime(onWood ? 1500 : 1950, now);
      lp.Q.value = 1.2;
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.095, now + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);
      src.connect(lp).connect(ng).connect(ac.destination);
      src.start(now, Math.random() * 1.2);
      src.stop(now + 0.10);
    },

    // Soft satin finger rub smoothing down a stuck sticker
    playStickerRub() {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;
      const src = makeNoiseSource(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200, now);
      bp.frequency.linearRampToValueAtTime(1700, now + 0.11);
      bp.Q.value = 1.6;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.13);
      src.connect(bp).connect(g).connect(ac.destination);
      src.start(now, Math.random() * 1.2);
      src.stop(now + 0.14);
    },

    // Smooth cardstock slide when switching between sticker sheets
    playSheetSlide() {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;
      const src = makeNoiseSource(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1150, now);
      bp.frequency.exponentialRampToValueAtTime(2400, now + 0.14);
      bp.frequency.exponentialRampToValueAtTime(1100, now + 0.24);
      bp.Q.value = 1.4;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.10, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.26);
      src.connect(bp).connect(g).connect(ac.destination);
      src.start(now, Math.random() * 1.0);
      src.stop(now + 0.27);
    },

    // Realistic thick drawing paper page flip + tiny metallic wire ring whisper
    playPageFlip() {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;

      // Sweeping paper rustle
      const src = makeNoiseSource(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(900, now);
      bp.frequency.exponentialRampToValueAtTime(2600, now + 0.18);
      bp.frequency.exponentialRampToValueAtTime(750, now + 0.36);
      bp.Q.value = 1.1;

      const g = ac.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.13, now + 0.08);
      g.gain.linearRampToValueAtTime(0.08, now + 0.24);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.40);

      src.connect(bp).connect(g).connect(ac.destination);
      src.start(now, Math.random() * 1.0);
      src.stop(now + 0.42);

      // Soft paper settle flop at end
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(125, now + 0.28);
      osc.frequency.exponentialRampToValueAtTime(58, now + 0.38);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.001, now + 0.28);
      og.gain.linearRampToValueAtTime(0.075, now + 0.295);
      og.gain.exponentialRampToValueAtTime(0.0008, now + 0.39);
      osc.connect(og).connect(ac.destination);
      osc.start(now + 0.28);
      osc.stop(now + 0.40);
    },

    // Delicate real porcelain bone-china teacup clink
    playTeacupClink(bright = false) {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;
      const freqs = bright ? [2340, 3510, 4880] : [2180, 3290];
      freqs.forEach((f, idx) => {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        const g = ac.createGain();
        const amp = (idx === 0 ? 0.08 : 0.032);
        g.gain.setValueAtTime(0.0005, now);
        g.gain.linearRampToValueAtTime(amp, now + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0004, now + (idx === 0 ? 0.42 : 0.22));
        osc.connect(g).connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      });
    },

    // Wooden pencil tap/roll or soft rubber eraser nudge
    playPropTap(kind = 'pencil') {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      if (kind === 'pencil') {
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);
      } else {
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(82, now + 0.055);
      }
      const g = ac.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(kind === 'pencil' ? 0.09 : 0.08, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.065);
      osc.connect(g).connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    },

    // Warm acoustic celebration when showing a filled page to Mom (soft applause + warm harp + foil seal press)
    playShowMomCelebration() {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;

      // 1. Warm acoustic harp / celesta welcoming chord (C5 - E5 - G5 - B5 - D6)
      const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
      notes.forEach((freq, i) => {
        const t = now + 0.08 + i * 0.075;
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        const osc2 = ac.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, t);

        const g = ac.createGain();
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(0.065, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0004, t + 0.95);

        const g2 = ac.createGain();
        g2.gain.setValueAtTime(0.0005, t);
        g2.gain.linearRampToValueAtTime(0.014, t + 0.008);
        g2.gain.exponentialRampToValueAtTime(0.0004, t + 0.35);

        osc.connect(g).connect(ac.destination);
        osc2.connect(g2).connect(ac.destination);
        osc.start(t);
        osc2.start(t);
        osc.stop(t + 1.0);
        osc2.stop(t + 0.4);
      });

      // 2. Soft joyful Mom handclaps (5 natural warm claps!)
      const clapTimes = [0.22, 0.40, 0.57, 0.75, 0.93];
      clapTimes.forEach((dt) => {
        const t = now + dt;
        const src = makeNoiseSource(ac);
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1150 + Math.random() * 280, t);
        bp.Q.value = 1.4;

        const g = ac.createGain();
        g.gain.setValueAtTime(0.0008, t);
        g.gain.linearRampToValueAtTime(0.095, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.085);

        src.connect(bp).connect(g).connect(ac.destination);
        src.start(t, Math.random() * 1.1);
        src.stop(t + 0.095);
      });
    },

    // Crisp metallic foil star seal landing chime + press
    playGoldSealLand() {
      const ac = ensureContext();
      if (!ac) return;
      const now = ac.currentTime;
      this.playStickPress(false);
      // Tiny sparkling gold shimmer
      [1567.98, 2093.0].forEach((freq, i) => {
        const t = now + i * 0.055;
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0004, t + 0.45);
        osc.connect(g).connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.48);
      });
    },
  };
}
