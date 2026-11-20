// Procedural Web Audio API realistic kitchen Foley sound engine (zero external audio files, zero text)
export function createAudioEngine() {
  let ctx = null;
  let noiseBuf = null;
  let fridgeHumGain = null;
  let pourNodes = null;

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      // Create 2-second white noise buffer for paper crinkles, liquid splashes, slides
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // Whisper-soft realistic refrigerator hum (60Hz + 120Hz subtle harmonic)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filt = ctx.createBiquadFilter();
      fridgeHumGain = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 60;
      osc2.type = 'triangle';
      osc2.frequency.value = 120;
      filt.type = 'lowpass';
      filt.frequency.value = 180;
      fridgeHumGain.gain.value = 0.012;
      osc1.connect(filt);
      osc2.connect(filt);
      filt.connect(fridgeHumGain);
      fridgeHumGain.connect(ctx.destination);
      osc1.start();
      osc2.start();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playNoiseBurst({ duration = 0.12, freq = 1200, q = 1.5, gain = 0.14, type = 'bandpass', pitchEnd = null }) {
    const c = ensureContext();
    if (!c || !noiseBuf) return;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, now);
    if (pitchEnd) filt.frequency.exponentialRampToValueAtTime(pitchEnd, now + duration);
    filt.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    src.connect(filt);
    filt.connect(g);
    g.connect(c.destination);
    src.start(now, Math.random() * 1.2, duration + 0.02);
  }

  function playTone({ freq = 220, freqEnd = 120, duration = 0.14, gain = 0.12, type = 'sine', delay = 0 }) {
    const c = ensureContext();
    if (!c) return;
    const now = c.currentTime + delay;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0008, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  return {
    unlock: ensureContext,

    setFridgeHum(openFactor) {
      if (!ctx || !fridgeHumGain) return;
      const target = 0.004 + 0.013 * openFactor;
      fridgeHumGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
    },

    // Tactile pickup sound tailored to material
    playPickup(category) {
      if (category === 'milk') {
        playTone({ freq: 155, freqEnd: 195, duration: 0.08, gain: 0.07 });
        playNoiseBurst({ duration: 0.09, freq: 950, q: 1.8, gain: 0.05 });
      } else if (category === 'eggs') {
        playNoiseBurst({ duration: 0.11, freq: 1400, q: 1.2, gain: 0.08 });
        playTone({ freq: 620, freqEnd: 520, duration: 0.045, gain: 0.03 });
      } else {
        playNoiseBurst({ duration: 0.07, freq: 1800, q: 1.4, gain: 0.05 });
        playTone({ freq: 260, freqEnd: 330, duration: 0.06, gain: 0.04 });
      }
    },

    // Surface-accurate landing / thud / clink sound
    playLand(category, surface, strength = 1.0) {
      const s = Math.min(1.3, Math.max(0.25, strength));
      if (surface === 'shelf') {
        // Crisp tempered glass shelf subtle clink + body thud
        playTone({ freq: 1380, freqEnd: 1320, duration: 0.075, gain: 0.045 * s });
        playTone({ freq: 210, freqEnd: 115, duration: 0.09, gain: 0.09 * s });
      } else if (surface === 'crisper') {
        // Hollow polycarbonate drawer soft resonant tap
        playTone({ freq: 310, freqEnd: 180, duration: 0.10, gain: 0.085 * s });
        playNoiseBurst({ duration: 0.07, freq: 780, q: 2.0, gain: 0.05 * s });
      } else if (surface === 'pocket') {
        // Door pocket plastic snug settle
        playTone({ freq: 260, freqEnd: 155, duration: 0.09, gain: 0.08 * s });
        if (category === 'milk') {
          // Liquid milk gentle weight slosh inside carton
          playNoiseBurst({ duration: 0.13, freq: 520, pitchEnd: 340, q: 3.0, gain: 0.065 * s });
        }
      } else {
        // Warm solid wood kitchen countertop thock
        playTone({ freq: 165, freqEnd: 88, duration: 0.10, gain: 0.11 * s });
        playNoiseBurst({ duration: 0.055, freq: 680, q: 1.5, gain: 0.05 * s });
      }
      if (category === 'eggs') {
        // Dry fibrous pulp rattle
        playNoiseBurst({ duration: 0.08, freq: 1250, q: 1.1, gain: 0.065 * s });
      }
    },

    // Soft collision click when rolling fruits bump each other or walls
    playBump(speed = 0.3) {
      const s = Math.min(1.0, Math.max(0.15, speed * 2.2));
      playTone({ freq: 320 + Math.random() * 90, freqEnd: 180, duration: 0.05, gain: 0.055 * s });
    },

    // Kraft paper bag crinkle & rustle
    playBagRustle() {
      playNoiseBurst({ duration: 0.16, freq: 2100, pitchEnd: 1350, q: 1.1, gain: 0.11 });
      playNoiseBurst({ duration: 0.10, freq: 3400, pitchEnd: 2200, q: 1.6, gain: 0.06 });
    },

    // Molded egg carton lid flip
    playEggLid(open) {
      playNoiseBurst({ duration: 0.11, freq: open ? 1500 : 1050, q: 1.3, gain: 0.09 });
      playTone({ freq: open ? 260 : 190, freqEnd: open ? 320 : 130, duration: 0.07, gain: 0.05 });
    },

    // Refrigerator door magnetic rubber gasket seal / unseal
    playDoor(closing) {
      if (closing) {
        playTone({ freq: 92, freqEnd: 46, duration: 0.19, gain: 0.18 });
        playNoiseBurst({ duration: 0.14, freq: 380, pitchEnd: 180, q: 2.0, gain: 0.09 });
      } else {
        playNoiseBurst({ duration: 0.13, freq: 620, pitchEnd: 1100, q: 2.4, gain: 0.08 });
        playTone({ freq: 110, freqEnd: 165, duration: 0.11, gain: 0.08 });
      }
    },

    // Vegetable crisper drawer roller slide
    playCrisper(opening) {
      playNoiseBurst({
        duration: 0.24,
        freq: opening ? 680 : 540,
        pitchEnd: opening ? 920 : 410,
        q: 2.2,
        gain: 0.075,
      });
    },

    // Continuous realistic pouring milk sound with rising resonant pitch as the glass fills!
    updatePour(active, fillLevel = 0) {
      const c = ensureContext();
      if (!c || !noiseBuf) return;
      if (active) {
        if (!pourNodes) {
          const src = c.createBufferSource();
          src.buffer = noiseBuf;
          src.loop = true;

          const bp = c.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 520;
          bp.Q.value = 4.2;

          const lp = c.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1800;

          const gain = c.createGain();
          gain.gain.value = 0.001;

          // Subtle bubbling glug LFO
          const lfo = c.createOscillator();
          const lfoGain = c.createGain();
          lfo.frequency.value = 9.5;
          lfoGain.gain.value = 110;
          lfo.connect(lfoGain);
          lfoGain.connect(bp.frequency);

          src.connect(bp);
          bp.connect(lp);
          lp.connect(gain);
          gain.connect(c.destination);
          src.start();
          lfo.start();
          pourNodes = { src, bp, gain, lfo };
        }
        // Authentic acoustic rising pitch of a glass filling with liquid (~440Hz -> ~1180Hz!)
        const targetFreq = 440 + fillLevel * 760;
        pourNodes.bp.frequency.setTargetAtTime(targetFreq, c.currentTime, 0.06);
        pourNodes.gain.gain.setTargetAtTime(0.16, c.currentTime, 0.05);
      } else if (pourNodes) {
        const nodes = pourNodes;
        pourNodes = null;
        nodes.gain.gain.setTargetAtTime(0.0005, c.currentTime, 0.04);
        setTimeout(() => {
          try { nodes.src.stop(); nodes.lfo.stop(); } catch (_) {}
        }, 180);
      }
    },

    // Clear drinking glass clink on wood/coaster
    playGlassClink() {
      playTone({ freq: 2150, freqEnd: 2120, duration: 0.22, gain: 0.065 });
      playTone({ freq: 3420, freqEnd: 3390, duration: 0.14, gain: 0.032 });
      playTone({ freq: 185, freqEnd: 110, duration: 0.08, gain: 0.065 });
    },

    // Warm cheerful sipping & happy appreciative non-verbal celebration!
    playHandoverDrink() {
      // Soft glass pickup clink
      playTone({ freq: 2180, freqEnd: 2150, duration: 0.16, gain: 0.055, delay: 0.05 });

      // 3 gentle realistic liquid gulps
      [0.55, 1.05, 1.55].forEach((t, idx) => {
        playTone({ freq: 260 + idx * 18, freqEnd: 420 + idx * 20, duration: 0.15, gain: 0.065, delay: t });
        playTone({ freq: 390, freqEnd: 220, duration: 0.11, gain: 0.045, delay: t + 0.12 });
      });

      // Soft warm appreciative acoustic marimba arpeggio (gentle joy, never loud toy fanfare!)
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      notes.forEach((n, i) => {
        playTone({ freq: n, freqEnd: n * 0.996, duration: 0.42, gain: 0.065, type: 'sine', delay: 2.15 + i * 0.11 });
      });

      // Satisfying glass set-back-down clink
      setTimeout(() => {
        playTone({ freq: 2050, freqEnd: 2020, duration: 0.18, gain: 0.06 });
        playTone({ freq: 170, freqEnd: 95, duration: 0.09, gain: 0.07 });
      }, 2850);
    },

    // Gentle wooden warm chime when a grocery settles happily into its home in the fridge
    playSettleHappy(count) {
      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const f = pentatonic[count % pentatonic.length];
      playTone({ freq: f, freqEnd: f * 0.995, duration: 0.24, gain: 0.042, delay: 0.04 });
    },
  };
}
