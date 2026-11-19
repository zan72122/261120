// Procedural Web Audio for the takoyaki game. No samples, no dependencies.
// Soft, warm, child-friendly. Every public method is a silent no-op until unlock()
// has created an AudioContext, and nothing here ever throws.

export function createAudio() {
  const MAX_VOICES = 24;
  const TAU = 0.1; // glide constant for continuous layers

  let ctx = null;
  let bus = null; // all sound → bus (highpass) → master gain → limiter → destination
  let white = null, pink = null;
  let crackBus = null;
  let suspended = false;
  let timer = 0;
  let schedT = 0;
  let burstUntil = 0, burstAmt = 0;
  const live = []; // active one-shot voices
  const lv = { sizzle: 0, pour: 0, squeeze: 0, brush: 0, roll: 0, bubble: 0 };
  const L = {}; // continuous layers: name → { g: GainNode, scale }

  const fin = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const clamp = (v, a, b, d) => Math.min(b, Math.max(a, fin(v, d)));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hz = (f) => Math.min(16000, Math.max(30, f));
  const safe = (fn) => (...a) => { try { return fn(...a); } catch (e) { return undefined; } };

  // ---------- context / master ----------
  function makeNoise(isPink) {
    const sr = ctx.sampleRate, n = Math.floor(sr * 2);
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, peak = 1e-6;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      let x = w;
      if (isPink) { // Paul Kellet's pink filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        x = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      }
      d[i] = x;
      const a = Math.abs(x); if (a > peak) peak = a;
    }
    const k = 0.9 / peak;
    // short crossfade so the loop seam is inaudible
    const fade = Math.min(2000, n >> 3);
    for (let i = 0; i < n; i++) d[i] *= k;
    for (let i = 0; i < fade; i++) { const m = i / fade; d[n - fade + i] = d[n - fade + i] * (1 - m) + d[i] * m; }
    return buf;
  }

  function build() {
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } }
    if (!ctx) return false;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 12;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    const master = ctx.createGain(); master.gain.value = 0.8; master.connect(comp);
    bus = ctx.createBiquadFilter(); bus.type = 'highpass'; bus.frequency.value = 90; bus.Q.value = 0.5;
    bus.connect(master);
    white = makeNoise(false); pink = makeNoise(true);
    crackBus = ctx.createBiquadFilter(); crackBus.type = 'bandpass'; crackBus.frequency.value = 3600; crackBus.Q.value = 0.7;
    crackBus.connect(bus);
    buildLayers();
    return true;
  }

  // ---------- continuous layers ----------
  function lfo(freq, depth, param, type) {
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start();
    return o;
  }
  function filt(type, f, q, dest) {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b;
  }
  function gainNode(v, dest) { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; }
  function loopNoise(buf, dest) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(dest); s.start(0, Math.random() * 1.5); return s;
  }

  function buildLayers() {
    // Sizzle "juuu": bright band of noise with slow irregular flutter.
    const sz = gainNode(0, bus), szB = gainNode(0, bus);
    const fl = ctx.createGain(); fl.gain.value = 0.7; fl.connect(sz); fl.connect(szB);
    lfo(0.37, 0.14, fl.gain); lfo(0.83, 0.1, fl.gain); lfo(2.3, 0.06, fl.gain);
    const szLp = filt('lowpass', 8500, 0.5, fl);
    const szBp = filt('bandpass', 5200, 0.6, szLp);
    const szHp = filt('highpass', 2800, 0.6, szBp);
    lfo(0.21, 600, szBp.frequency);
    loopNoise(white, szHp);
    L.sizzle = { g: sz, scale: 0.085 }; L.burst = szB;

    // Pour: low gurgling glug with 7–9 Hz pulsing.
    const po = gainNode(0, bus);
    const pam = gainNode(0.55, po); lfo(7.2, 0.3, pam.gain); lfo(8.9, 0.15, pam.gain, 'triangle');
    loopNoise(pink, filt('lowpass', 650, 1, pam));
    const gur = ctx.createOscillator(); gur.type = 'sine'; gur.frequency.value = 240;
    lfo(7.2, 70, gur.frequency); lfo(0.6, 40, gur.frequency);
    gur.connect(gainNode(0.12, pam)); gur.start();
    L.pour = { g: po, scale: 0.4 };

    // Squeeze: soft wet squelch.
    const sq = gainNode(0, bus);
    const sam = gainNode(0.5, sq); lfo(11.3, 0.3, sam.gain, 'triangle'); lfo(17.1, 0.18, sam.gain);
    const sbp = filt('bandpass', 900, 2.2, sam); lfo(2.1, 300, sbp.frequency); lfo(5.3, 120, sbp.frequency);
    loopNoise(pink, sbp);
    L.squeeze = { g: sq, scale: 0.35 };

    // Brush: gentle swish.
    const br = gainNode(0, bus);
    const bam = gainNode(0.8, br); lfo(3.1, 0.15, bam.gain);
    const blp = filt('lowpass', 4500, 0.5, bam);
    const bbp = filt('bandpass', 2000, 0.7, blp); lfo(1.7, 400, bbp.frequency);
    loopNoise(pink, bbp);
    L.brush = { g: br, scale: 0.22 };

    // Roll: low playful rumble "korokoro".
    const ro = gainNode(0, bus);
    const ram = gainNode(0.5, ro); lfo(6, 0.42, ram.gain, 'triangle'); lfo(9.7, 0.12, ram.gain);
    const rhp = filt('highpass', 140, 0.7, ram);
    loopNoise(pink, filt('lowpass', 420, 1.2, rhp));
    const body = ctx.createOscillator(); body.type = 'triangle'; body.frequency.value = 260;
    lfo(0.9, 25, body.frequency); body.connect(gainNode(0.05, ram)); body.start();
    L.roll = { g: ro, scale: 0.45 };

    for (const k in L) if (L[k] && L[k].g) L[k].g.gain.value = lv[k] * L[k].scale;
  }

  function setLevel(name, v) {
    lv[name] = clamp(v, 0, 1, 0);
    const l = L[name];
    if (!ctx || !l) return;
    l.g.gain.setTargetAtTime(lv[name] * l.scale, ctx.currentTime, TAU);
  }

  // ---------- sparse schedulers (crackles, bubbles) ----------
  function count(x) { const n = Math.floor(x); return n + (Math.random() < x - n ? 1 : 0); }

  function crackle(t, level) {
    const s = ctx.createBufferSource(); s.buffer = white;
    const g = ctx.createGain(); s.connect(g); g.connect(crackBus);
    const peak = rnd(0.02, 0.07) * (0.4 + 0.6 * level), d = rnd(0.002, 0.006);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.0008);
    g.gain.exponentialRampToValueAtTime(peak * 0.001, t + d + 0.0008);
    s.onended = () => { try { s.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
    s.start(t, Math.random() * 1.9); s.stop(t + d + 0.01);
  }

  function puku(t, level) {
    const f0 = rnd(280, 340);
    const o = ctx.createOscillator(); o.type = 'sine';
    const g = ctx.createGain(); o.connect(g); g.connect(bus);
    const peak = 0.09 * (0.5 + 0.5 * level);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * rnd(1.8, 2.2), t + 0.045);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(peak * 0.001, t + 0.08);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ } };
    o.start(t); o.stop(t + 0.1);
  }

  function tick() {
    try {
      if (!ctx || suspended || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (schedT < now) schedT = now;
      const end = now + 0.15, dt = end - schedT;
      if (dt <= 0.005) return;
      const burst = now < burstUntil ? burstAmt : 0;
      const cRate = lv.sizzle * 22 + burst * 30;
      const nc = Math.min(8, count(cRate * dt));
      for (let i = 0; i < nc; i++) crackle(schedT + Math.random() * dt, Math.max(lv.sizzle, burst));
      const nb = Math.min(2, count(lv.bubble * 4.5 * dt));
      for (let i = 0; i < nb; i++) {
        const t = schedT + Math.random() * dt;
        puku(t, lv.bubble);
        if (Math.random() < 0.3) puku(t + rnd(0.05, 0.09), lv.bubble * 0.7);
      }
      schedT = end;
    } catch (e) { /* ignore */ }
  }
  function startTimer() { if (!timer && typeof setInterval !== 'undefined') timer = setInterval(tick, 40); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }

  // ---------- one-shot voices ----------
  function purge() {
    const now = ctx.currentTime;
    for (let i = live.length - 1; i >= 0; i--) if (live[i].endAt < now - 1) live[i].end();
  }

  function voice(o) {
    if (live.length >= MAX_VOICES) return null;
    const vol = clamp(o.vol, 0, 2, 1);
    if (vol <= 0) return null;
    const t = ctx.currentTime + 0.01 + clamp(o.delay, 0, 10, 0);
    const out = ctx.createGain(); out.gain.value = vol;
    const nodes = [out];
    const pan = clamp(o.pan, -1, 1, 0);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(bus); nodes.push(p);
    } else out.connect(bus);
    let pending = 0, done = false;
    const v = { t, out, p: clamp(o.pitch, 0.25, 4, 1), endAt: t + 0.1 };
    v.end = () => {
      if (done) return; done = true;
      const i = live.indexOf(v); if (i >= 0) live.splice(i, 1);
      for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    };
    v.finish = () => { if (pending <= 0) v.end(); };
    v.add = (n) => { nodes.push(n); return n; };
    v.run = (s, t0, t1, off) => {
      pending++;
      s.onended = () => { if (--pending <= 0) v.end(); };
      if (off !== undefined) s.start(t0, off); else s.start(t0);
      s.stop(t1);
      if (t1 > v.endAt) v.endAt = t1;
    };
    v.g = (dest, val) => { const g = v.add(ctx.createGain()); g.gain.value = val || 0; g.connect(dest || out); return g; };
    v.f = (type, f, q, dest) => {
      const b = v.add(ctx.createBiquadFilter()); b.type = type; b.frequency.value = hz(f); b.Q.value = q; b.connect(dest || out); return b;
    };
    v.osc = (type, f, t0, t1, dest) => {
      const s = v.add(ctx.createOscillator()); s.type = type; s.frequency.setValueAtTime(hz(f), t0);
      s.connect(dest || out); v.run(s, t0, t1); return s;
    };
    v.noise = (t0, t1, dest, isPink) => {
      const s = v.add(ctx.createBufferSource()); s.buffer = isPink ? pink : white; s.loop = true;
      s.connect(dest || out); v.run(s, t0, t1, Math.random() * 1.5); return s;
    };
    v.lfo = (freq, depth, param, t0, t1, type) => {
      const g = v.g(null, depth); g.disconnect(); g.connect(param);
      v.osc(type || 'sine', freq, t0, t1, g);
    };
    live.push(v);
    return v;
  }

  // attack (linear) then exponential decay to silence
  function env(pr, t0, a, peak, d) {
    pr.setValueAtTime(0, t0);
    pr.linearRampToValueAtTime(peak, t0 + a);
    pr.exponentialRampToValueAtTime(Math.max(peak * 0.0005, 1e-6), t0 + a + d);
    pr.linearRampToValueAtTime(0, t0 + a + d + 0.02);
  }
  // pitched blip with optional glide
  function tone(v, type, f0, f1, t0, a, d, peak, glide, dest) {
    const g = v.g(dest); env(g.gain, t0, a, peak, d);
    const o = v.osc(type, f0, t0, t0 + a + d + 0.05, g);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(hz(f1), t0 + (glide || a + d));
    return o;
  }
  // filtered noise burst with optional filter sweep
  function hiss(v, t0, a, d, peak, type, f0, q, f1, glide, isPink, dest) {
    const g = v.g(dest); env(g.gain, t0, a, peak, d);
    const fl = v.f(type, f0, q, g);
    if (f1) fl.frequency.exponentialRampToValueAtTime(hz(f1), t0 + (glide || a + d));
    v.noise(t0, t0 + a + d + 0.05, fl, isPink);
    return fl;
  }
  function mallet(v, f, t0, peak, d) {
    tone(v, 'sine', f, 0, t0, 0.004, d, peak);
    if (f * 3.93 < 7000) tone(v, 'sine', f * 3.93, 0, t0, 0.003, d * 0.18, peak * 0.22);
    tone(v, 'triangle', f * 2, 0, t0, 0.003, d * 0.1, peak * 0.12);
  }
  function bell(v, f, t0, peak, d) {
    tone(v, 'sine', f, 0, t0, 0.005, d, peak);
    if (f * 2.76 < 7500) tone(v, 'sine', f * 2.76, 0, t0, 0.004, d * 0.45, peak * 0.28);
    if (f * 5.4 < 7500) tone(v, 'sine', f * 5.4, 0, t0, 0.003, d * 0.18, peak * 0.1);
  }
  function mbox(v, f, t0, peak, d) {
    tone(v, 'sine', f, 0, t0, 0.005, d, peak);
    tone(v, 'sine', f * 2, 0, t0, 0.004, d * 0.35, peak * 0.22);
    if (f * 5.95 < 7500) tone(v, 'sine', f * 5.95, 0, t0, 0.003, 0.05, peak * 0.06);
  }

  const S = {
    slide(v, p, t) {
      const fl = hiss(v, t, 0.3, 0.32, 0.22, 'bandpass', 700 * p, 0.9, 1100 * p, 0.45, true);
      v.lfo(13, 120, fl.frequency, t, t + 0.7);
      hiss(v, t + 0.05, 0.25, 0.3, 0.06, 'bandpass', 2600 * p, 1.2, 0, 0, false);
      // soft set-down
      tone(v, 'triangle', 200 * p, 120 * p, t + 0.52, 0.004, 0.12, 0.3);
      tone(v, 'sine', 420 * p, 300 * p, t + 0.52, 0.004, 0.05, 0.1);
      hiss(v, t + 0.52, 0.003, 0.05, 0.15, 'lowpass', 900, 0.7, 0, 0, true);
    },
    pick(v, p, t) {
      tone(v, 'sine', 900 * p, 1300 * p, t, 0.004, 0.035, 0.12);
      hiss(v, t, 0.003, 0.015, 0.04, 'bandpass', 3000, 1.5, 0, 0, false);
    },
    put(v, p, t) {
      tone(v, 'triangle', 300 * p, 200 * p, t, 0.004, 0.07, 0.22);
      hiss(v, t, 0.003, 0.04, 0.1, 'lowpass', 1200, 0.7, 0, 0, true);
    },
    plop(v, p, t) {
      tone(v, 'sine', 380 * p, 900 * p, t, 0.004, 0.09, 0.3, 0.05);
      tone(v, 'sine', 600 * p, 1150 * p, t + 0.065, 0.004, 0.05, 0.12, 0.04);
      hiss(v, t, 0.004, 0.05, 0.08, 'lowpass', 900, 0.8, 0, 0, true);
    },
    sprinkle(v, p, t) {
      const n = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        hiss(v, t + rnd(0, 0.28), 0.002, rnd(0.008, 0.02), rnd(0.08, 0.16), 'bandpass', rnd(3500, 6000) * p, 2, 0, 0, false);
      }
    },
    flip(v, p, t) {
      // airy upward whoosh
      hiss(v, t, 0.06, 0.08, 0.2, 'bandpass', 600 * p, 1.6, 2400 * p, 0.12, true);
      // soft rounded pop
      const tp = t + 0.105;
      tone(v, 'sine', 520 * p, 260 * p, tp, 0.004, 0.09, 0.38, 0.07);
      tone(v, 'sine', 1040 * p, 520 * p, tp, 0.003, 0.03, 0.06, 0.03);
    },
    wobble(v, p, t) {
      const o = tone(v, 'sine', 330 * p, 270 * p, t, 0.008, 0.25, 0.3);
      v.lfo(10, 40 * p, o.frequency, t, t + 0.3);
      tone(v, 'triangle', 660 * p, 540 * p, t, 0.008, 0.12, 0.04);
    },
    hop(v, p, t) {
      tone(v, 'triangle', 300 * p, 900 * p, t, 0.005, 0.15, 0.26, 0.12);
      tone(v, 'sine', 600 * p, 1500 * p, t, 0.004, 0.06, 0.05, 0.1);
    },
    land(v, p, t) {
      tone(v, 'triangle', 220 * p, 120 * p, t, 0.004, 0.1, 0.32, 0.08);
      hiss(v, t, 0.003, 0.04, 0.1, 'lowpass', 500, 0.8, 0, 0, true);
    },
    pon(v, p, t) {
      tone(v, 'sine', 1800 * p, 1750 * p, t, 0.003, 0.05, 0.12);
      tone(v, 'sine', 2900 * p, 0, t, 0.003, 0.03, 0.05);
      tone(v, 'triangle', 230 * p, 140 * p, t, 0.004, 0.09, 0.3, 0.08);
    },
    kotsun(v, p, t) {
      const knock = (t0, k) => {
        tone(v, 'triangle', 620 * p, 560 * p, t0, 0.003, 0.08, 0.28 * k);
        tone(v, 'sine', 940 * p, 900 * p, t0, 0.003, 0.05, 0.12 * k);
        hiss(v, t0, 0.003, 0.025, 0.12 * k, 'bandpass', 800 * p, 6, 0, 0, false);
      };
      knock(t, 1); knock(t + 0.1, 0.35);
    },
    stab(v, p, t) {
      hiss(v, t, 0.002, 0.008, 0.08, 'highpass', 3000, 0.7, 0, 0, false);
      tone(v, 'sine', 2200 * p, 1800 * p, t, 0.003, 0.015, 0.06);
    },
    click(v, p, t) {
      hiss(v, t, 0.002, 0.006, 0.18, 'bandpass', 2500 * p, 2, 0, 0, false);
      tone(v, 'triangle', 1200 * p, 900 * p, t, 0.003, 0.015, 0.12);
      hiss(v, t + 0.035, 0.002, 0.006, 0.12, 'bandpass', 1800 * p, 2, 0, 0, false);
      tone(v, 'triangle', 800 * p, 600 * p, t + 0.035, 0.003, 0.02, 0.1);
    },
    ding(v, p, t) {
      bell(v, 660 * p, t, 0.5, 0.5);
    },
    allDone(v, p, t) {
      const n = [523, 659, 784, 1047];
      n.forEach((f, i) => mallet(v, f * p, t + i * 0.09, 0.24, 0.35));
      bell(v, 1047 * p, t + 0.36, 0.16, 0.8);
      bell(v, 784 * p, t + 0.36, 0.1, 0.7);
    },
    giggle(v, p, t) {
      const n = [784, 659, 988];
      n.forEach((f, i) => {
        const t0 = t + i * 0.11;
        const o = tone(v, 'triangle', f * p * 0.96, f * p, t0, 0.004, 0.16, 0.22, 0.04);
        tone(v, 'sine', f * p * 3.93, 0, t0, 0.003, 0.03, 0.04);
        if (i === 2) v.lfo(9, 18, o.frequency, t0, t0 + 0.2);
      });
    },
    start(v, p, t) {
      mallet(v, 784 * p, t, 0.2, 0.3); bell(v, 784 * p, t, 0.08, 0.3);
      mallet(v, 1047 * p, t + 0.14, 0.22, 0.45); bell(v, 1047 * p, t + 0.14, 0.1, 0.5);
    },
    hint(v, p, t) {
      const a = (f, t0) => {
        const g = v.g(); env(g.gain, t0, 0.012, 0.05, 0.6);
        v.osc('sine', f * p, t0, t0 + 0.7, g);
        tone(v, 'sine', f * p * 2.76, 0, t0, 0.01, 0.2, 0.008);
      };
      a(784, t); a(1047, t + 0.18);
    },
    ending(v, p, t) {
      const mel = [[659, 1], [784, 1], [1047, 1], [988, 1], [880, 1], [784, 2], [698, 1], [659, 1], [587, 1], [659, 1], [523, 3]];
      const bass = { 0: [262, 392], 4: [349, 440], 6: [392, 494], 10: [262, 330] };
      let tt = t, beat = 0.36;
      mel.forEach(([f, b], i) => {
        mbox(v, f * p, tt, i === mel.length - 1 ? 0.22 : 0.18, i === mel.length - 1 ? 2.2 : 1.1);
        if (bass[i]) bass[i].forEach((bf, k) => mbox(v, bf * p, tt + k * 0.02, 0.07, 1.6));
        tt += beat * b;
        beat *= 1.045; // gently slowing
      });
    },
    blow(v, p, t) {
      const g = v.g(); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.36, t + 0.15);
      g.gain.linearRampToValueAtTime(0.26, t + 0.25);
      g.gain.linearRampToValueAtTime(0, t + 0.38);
      const fl = v.f('bandpass', 1100 * p, 1.2, g);
      fl.frequency.linearRampToValueAtTime(hz(1700 * p), t + 0.35);
      v.noise(t, t + 0.42, fl, true);
    },
    bite(v, p, t) {
      hiss(v, t, 0.003, 0.03, 0.22, 'bandpass', 1500 * p, 1.5, 0, 0, false);
      hiss(v, t + 0.028, 0.003, 0.025, 0.14, 'bandpass', 1300 * p, 1.5, 0, 0, false);
      tone(v, 'sine', 480 * p, 240 * p, t + 0.01, 0.004, 0.08, 0.3, 0.06);
    },
    munch(v, p, t) {
      [0, 0.22].forEach((d, i) => {
        const k = i ? 0.8 : 1;
        hiss(v, t + d, 0.008, 0.06, 0.13 * k, 'bandpass', 1200 * p, 1, 0, 0, true);
        tone(v, 'triangle', 240 * p, 170 * p, t + d, 0.006, 0.07, 0.18 * k);
      });
    },
    yum(v, p, t) {
      const g = v.g();
      // two "mm" swells
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.04);
      g.gain.linearRampToValueAtTime(0.13, t + 0.24);
      g.gain.linearRampToValueAtTime(0.05, t + 0.3);
      g.gain.linearRampToValueAtTime(0.19, t + 0.36);
      g.gain.setTargetAtTime(0, t + 0.62, 0.07);
      const lp = v.f('lowpass', 2400, 0.5, g);
      const bp = v.f('bandpass', 800, 0.9, lp);
      const direct = v.g(lp, 0.5);
      const mk = (type, mul, dest) => {
        const o = v.osc(type, 330 * p * mul, t, t + 1.1, dest);
        o.frequency.setTargetAtTime(hz(392 * p * mul), t + 0.29, 0.03);
        v.lfo(5.5, 330 * p * mul * 0.015, o.frequency, t, t + 1.1);
        return o;
      };
      mk('triangle', 1, bp); mk('sine', 1, direct);
    },
    hot(v, p, t) {
      const o = tone(v, 'sine', 220 * p, 700 * p, t, 0.008, 0.3, 0.26, 0.24);
      v.lfo(14, 30, o.frequency, t, t + 0.35);
      tone(v, 'triangle', 440 * p, 1400 * p, t, 0.008, 0.15, 0.04, 0.24);
      hiss(v, t + 0.3, 0.02, 0.1, 0.18, 'bandpass', 1200, 1.2, 0, 0, true); // "ha"
      hiss(v, t + 0.48, 0.05, 0.18, 0.15, 'bandpass', 1800, 1.4, 2200, 0.2, true); // "fu"
    },
    cheese(v, p, t) {
      const g = v.g(); env(g.gain, t, 0.05, 0.12, 0.32);
      const lp = v.f('lowpass', 800 * p, 5, g);
      lp.frequency.linearRampToValueAtTime(hz(1300 * p), t + 0.35);
      const o = v.osc('sawtooth', 180 * p, t, t + 0.42, lp);
      o.frequency.exponentialRampToValueAtTime(hz(420 * p), t + 0.36);
      v.lfo(28, 0.05, g.gain, t, t + 0.4, 'square'); // creaky grain
      hiss(v, t + 0.37, 0.002, 0.012, 0.14, 'highpass', 2500, 0.7, 0, 0, false);
      tone(v, 'sine', 1400 * p, 700 * p, t + 0.37, 0.003, 0.03, 0.12);
    },
    sputter(v, p, t) {
      const ts = [0, 0.17, 0.31, 0.5];
      ts.forEach((d, i) => {
        const t0 = t + d, k = 1 - i * 0.12, pp = p * rnd(0.9, 1.15);
        // wet "pu"
        const g = v.g(); env(g.gain, t0, 0.005, 0.26 * k, 0.09);
        const fl = v.f('bandpass', 800 * pp, 2, g);
        v.noise(t0, t0 + 0.14, fl, true);
        v.lfo(30 * pp, 0.12 * k, g.gain, t0, t0 + 0.12, 'triangle'); // raspberry flutter
        tone(v, 'sine', 260 * pp, 170 * pp, t0, 0.005, 0.06, 0.14 * k);
        // airy "su"
        hiss(v, t0 + 0.04, 0.015, 0.06, 0.05 * k, 'bandpass', 3500, 1.2, 0, 0, false);
      });
    },
    flutter(v, p, t) {
      for (let i = 0; i < 9; i++) {
        hiss(v, t + rnd(0, 0.38), 0.003, rnd(0.012, 0.03), rnd(0.05, 0.12), 'bandpass', rnd(2000, 5000) * p, 0.9, 0, 0, false);
      }
    },
  };

  // ---------- public api ----------
  const audio = {
    unlock: safe(() => {
      if (!ctx && !build()) return;
      suspended = false;
      if (ctx.state !== 'running') {
        try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ }
        try { // iOS: play a 1-sample silent buffer inside the gesture
          const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050);
          s.connect(ctx.destination); s.start(0);
        } catch (e) { /* ignore */ }
      }
      startTimer();
    }),
    suspend: safe(() => {
      if (!ctx) return;
      suspended = true; stopTimer();
      const r = ctx.suspend && ctx.suspend(); if (r && r.catch) r.catch(() => {});
    }),
    resume: safe(() => {
      if (!ctx) return;
      suspended = false;
      const r = ctx.resume && ctx.resume(); if (r && r.catch) r.catch(() => {});
      schedT = ctx.currentTime;
      startTimer();
    }),
    play: safe((name, opts) => {
      if (!ctx || suspended) return;
      const fn = S[name];
      if (typeof fn !== 'function') return;
      purge();
      const v = voice(opts || {});
      if (!v) return;
      try { fn(v, v.p, v.t); } catch (e) { /* ignore */ }
      v.finish();
    }),
    setSizzle: safe((x) => setLevel('sizzle', x)),
    sizzleBurst: safe((amount) => {
      const a = clamp(amount, 0, 1.5, 0.6);
      if (!ctx || suspended || a <= 0) return;
      const now = ctx.currentTime, g = L.burst.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(a * 0.12, now, 0.06);
      g.setTargetAtTime(0, now + 0.22, 0.14);
      burstAmt = Math.max(now < burstUntil ? burstAmt : 0, Math.min(1, a));
      burstUntil = now + 0.6;
    }),
    setPour: safe((x) => setLevel('pour', x)),
    setSqueeze: safe((x) => setLevel('squeeze', x)),
    setBrush: safe((x) => setLevel('brush', x)),
    setRoll: safe((x) => setLevel('roll', x)),
    setBubble: safe((x) => { lv.bubble = clamp(x, 0, 1, 0); }),
  };
  return audio;
}
