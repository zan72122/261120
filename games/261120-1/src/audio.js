/* audio.js — 効果音のすべて（外部音源なし。WebAudio で合成）
   G.createAudio() → { unlock, ready, suspend, resume, setAmbient, setSteam, setSlide, setRoll, play }
   AudioContext は unlock()（最初のタッチの中）で初めて作る。作れなければ以後すべて何もしない。 */
(function () {
  'use strict';
  var G = window.G = window.G || {};

  G.createAudio = function () {
    var ctx = null, failed = false, userSuspended = false;
    var master = null, sfxBus = null, loopBus = null, ambBus = null;
    var bufW = null, bufP = null, bufB = null;
    var oddWave = null;
    var loops = null;
    var lastPlay = {}, recent = [];
    var ambientOn = false, birdTimer = 0, rollTimer = 0;
    var rollSpeed = 0, rollNext = 0;
    var D = null, R = 1; // いま鳴らしている単発音の出口と高さ倍率

    function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function alive() { return !!ctx && !failed; }
    function running() { return alive() && ctx.state === 'running' && !userSuspended; }

    // ---------- 準備 ----------
    function makeNoise(kind) {
      var len = Math.floor(ctx.sampleRate * 2), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      var i, w, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (i = 0; i < len; i++) {
        w = Math.random() * 2 - 1;
        if (kind === 'w') d[i] = w * 0.7;
        else if (kind === 'p') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      }
      // ループのつなぎ目をなめらかに
      var f = Math.min(2000, len >> 3);
      for (i = 0; i < f; i++) { var k = i / f; d[i] = d[i] * k + d[len - f + i] * (1 - k); }
      return b;
    }

    function build() {
      master = ctx.createGain(); master.gain.value = 0.5;
      var comp = ctx.createDynamicsCompressor();
      try {
        comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6;
        comp.attack.value = 0.004; comp.release.value = 0.2;
      } catch (e) {}
      var lim = ctx.createGain(); lim.gain.value = 0.9;
      master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      loopBus = ctx.createGain(); loopBus.gain.value = 1; loopBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
      bufW = makeNoise('w'); bufP = makeNoise('p'); bufB = makeNoise('b');
      try {
        var sinT = new Float32Array([0, 1, 0, 0.36, 0, 0.2, 0, 0.1, 0, 0.05]), cosT = new Float32Array(sinT.length);
        oddWave = ctx.createPeriodicWave(cosT, sinT); // 奇数倍音（クラリネット風）
      } catch (e) { oddWave = null; }
      buildLoops();
    }

    function loopSrc(buf) {
      var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      s.start(0, Math.random() * 1.5); return s;
    }

    function buildLoops() {
      loops = {};
      // 湯気「しゅわーー」
      var st = loopSrc(bufW), stHp = ctx.createBiquadFilter(), stLp = ctx.createBiquadFilter(), stG = ctx.createGain(), stMod = ctx.createGain();
      stHp.type = 'highpass'; stHp.frequency.value = 900; stHp.Q.value = 0.5;
      stLp.type = 'lowpass'; stLp.frequency.value = 2500; stLp.Q.value = 0.6;
      stG.gain.value = 0; stMod.gain.value = 1;
      st.connect(stHp); stHp.connect(stLp); stLp.connect(stMod); stMod.connect(stG); stG.connect(loopBus);
      var lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lfo.frequency.value = 3.1; lfoG.gain.value = 0.12; lfo.connect(lfoG); lfoG.connect(stMod.gain); lfo.start();
      loops.steam = { g: stG, lp: stLp };
      // 布を滑る「すーっ」
      var sl = loopSrc(bufP), slLp = ctx.createBiquadFilter(), slHp = ctx.createBiquadFilter(), slG = ctx.createGain();
      slLp.type = 'lowpass'; slLp.frequency.value = 400; slLp.Q.value = 0.4;
      slHp.type = 'highpass'; slHp.frequency.value = 90;
      slG.gain.value = 0;
      sl.connect(slHp); slHp.connect(slLp); slLp.connect(slG); slG.connect(loopBus);
      loops.slide = { g: slG, lp: slLp };
      // 朝の部屋の静けさ
      var rm = loopSrc(bufB), rmLp = ctx.createBiquadFilter(), rmG = ctx.createGain();
      rmLp.type = 'lowpass'; rmLp.frequency.value = 260; rmG.gain.value = 0.05;
      rm.connect(rmLp); rmLp.connect(rmG); rmG.connect(ambBus);
    }

    // ---------- 音のかけら ----------
    // ノイズ: o = {buf, type, f, f2, q, a, h, r, peak, at(=f2 までの時間)}
    function noise(t, o) {
      var s = ctx.createBufferSource(); s.buffer = o.buf || bufW; s.loop = true;
      var fl = ctx.createBiquadFilter(); fl.type = o.type || 'bandpass';
      var f = (o.f || 1000) * R;
      fl.frequency.setValueAtTime(f, t); fl.Q.value = o.q == null ? 1 : o.q;
      var a = o.a || 0.005, h = o.h || 0, r = o.r || 0.05, end = t + a + h + r * 6;
      if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2 * R), t + (o.at || (a + h + r)));
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.peak || 0.2, t + a);
      if (h) g.gain.setValueAtTime(o.peak || 0.2, t + a + h);
      g.gain.setTargetAtTime(0, t + a + h, r);
      s.connect(fl); fl.connect(g); g.connect(o.dest || D);
      s.start(t, Math.random() * 1.6); s.stop(end + 0.02);
    }
    // 音程: o = {f, f2, gt, type, wave, a, h, r, peak, lp}
    function tone(t, o) {
      var os = ctx.createOscillator();
      if (o.wave) os.setPeriodicWave(o.wave); else os.type = o.type || 'sine';
      var f = o.f * R; os.frequency.setValueAtTime(f, t);
      if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2 * R, t + (o.gt || 0.05));
      var a = o.a || 0.003, h = o.h || 0, r = o.r || 0.1, end = t + a + h + r * 6;
      var g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.peak || 0.2, t + a);
      if (h) g.gain.setValueAtTime(o.peak || 0.2, t + a + h);
      g.gain.setTargetAtTime(0, t + a + h, r);
      var last = os;
      if (o.lp) { var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = 0.5; os.connect(fl); last = fl; }
      last.connect(g); g.connect(o.dest || D);
      os.start(t); os.stop(end + 0.02);
    }
    // 木の当たり
    function knock(t, f, peak, body) {
      tone(t, { f: f, f2: f * 0.82, gt: 0.03, a: 0.001, r: body || 0.025, peak: peak });
      noise(t, { f: f * 2.4, q: 3, a: 0.001, r: 0.008, peak: peak * 0.6 });
    }
    // 木琴（マリンバ風）
    function mallet(t, f, peak, r) {
      tone(t, { f: f, a: 0.002, r: r || 0.22, peak: peak });
      tone(t, { f: f * 3.93, a: 0.001, r: 0.035, peak: peak * 0.22 });
      noise(t, { f: f * 4, q: 2, a: 0.001, r: 0.006, peak: peak * 0.15 });
    }
    // オルゴール/鉄琴
    function bell(t, f, peak, r) {
      tone(t, { f: f, a: 0.002, r: r || 0.5, peak: peak });
      tone(t, { f: f * 2, a: 0.002, r: (r || 0.5) * 0.35, peak: peak * 0.18 });
      tone(t, { f: f * 3, a: 0.001, r: 0.06, peak: peak * 0.06 });
      noise(t, { f: 3000, q: 2, a: 0.001, r: 0.004, peak: peak * 0.08 });
    }
    // 布のこすれ（細かい粒）
    function rustle(t, dur, f, peak, n) {
      for (var i = 0; i < n; i++) {
        noise(t + Math.random() * dur, { f: f * rnd(0.7, 1.4), q: rnd(0.7, 1.6), a: 0.003, r: rnd(0.008, 0.025), peak: peak * rnd(0.4, 1) });
      }
    }

    // ---------- 単発音 ----------
    var S = {
      pickup: function (t) {
        rustle(t, 0.09, 2200, 0.16, 6);
        noise(t, { buf: bufP, type: 'bandpass', f: 1400, q: 0.7, a: 0.01, h: 0.03, r: 0.04, peak: 0.14 });
      },
      unfurl: function (t) {
        noise(t, { buf: bufP, type: 'bandpass', f: 380, f2: 1300, at: 0.2, q: 0.8, a: 0.12, h: 0.08, r: 0.08, peak: 0.42 });
        rustle(t + 0.05, 0.25, 1800, 0.12, 9);
        var l = t + 0.34; // 着地 ぽふ
        noise(l, { buf: bufP, type: 'lowpass', f: 420, q: 0.5, a: 0.006, r: 0.06, peak: 0.5 });
        tone(l, { f: 95, f2: 60, gt: 0.08, a: 0.004, r: 0.05, peak: 0.22 });
      },
      puff: function (t) {
        noise(t, { type: 'bandpass', f: 2600, f2: 3600, at: 0.1, q: 0.9, a: 0.012, h: 0.04, r: 0.06, peak: 0.16 });
      },
      burst: function (t) {
        noise(t, { type: 'bandpass', f: 1800, f2: 3800, at: 0.5, q: 0.6, a: 0.32, h: 0.3, r: 0.18, peak: 0.26 });
        noise(t, { buf: bufP, type: 'lowpass', f: 700, q: 0.4, a: 0.25, h: 0.3, r: 0.2, peak: 0.16 });
      },
      pin: function (t) {
        tone(t, { f: 880, f2: 1046, gt: 0.03, a: 0.002, r: 0.12, peak: 0.16 });
        tone(t, { f: 2092, a: 0.002, r: 0.04, peak: 0.03 });
        noise(t, { buf: bufP, type: 'bandpass', f: 1300, q: 1, a: 0.002, r: 0.02, peak: 0.28 });
      },
      crease: function (t) {
        noise(t, { type: 'bandpass', f: 3600, f2: 2400, at: 0.04, q: 1.8, a: 0.002, h: 0.015, r: 0.025, peak: 0.2 });
        noise(t + 0.045, { type: 'bandpass', f: 2800, q: 1.8, a: 0.002, r: 0.02, peak: 0.12 });
        mallet(t + 0.01, 1175, 0.05, 0.08);
      },
      panel: function (t) { mallet(t, 659, 0.24, 0.25); },
      alldone: function (t) {
        var n = [523.25, 659.25, 783.99, 1046.5];
        for (var i = 0; i < n.length; i++) {
          mallet(t + i * 0.14, n[i], 0.2, i === 3 ? 0.4 : 0.22);
          bell(t + i * 0.14, n[i], 0.05, i === 3 ? 0.7 : 0.3);
        }
      },
      kotsun: function (t) {
        knock(t, 980, 0.34, 0.035);
        noise(t, { buf: bufP, type: 'lowpass', f: 700, a: 0.002, r: 0.02, peak: 0.18 });
      },
      pop: function (t) {
        tone(t, { f: 320, f2: 760, gt: 0.04, a: 0.003, r: 0.05, peak: 0.24 });
        noise(t, { buf: bufP, type: 'bandpass', f: 900, q: 1, a: 0.002, r: 0.015, peak: 0.16 });
      },
      tok: function (t) { knock(t, 1350 * rnd(0.94, 1.06), 0.26, 0.02); },
      tick: function (t) {
        noise(t, { type: 'bandpass', f: 2600, q: 3, a: 0.001, r: 0.005, peak: 0.07 });
        tone(t, { f: 1700, a: 0.001, r: 0.008, peak: 0.025 });
      },
      lift: function (t) {
        noise(t, { type: 'bandpass', f: 2100, q: 2.2, a: 0.001, r: 0.009, peak: 0.18 });
        tone(t, { f: 880, a: 0.001, r: 0.012, peak: 0.05 });
        noise(t + 0.035, { type: 'bandpass', f: 1500, q: 2, a: 0.001, r: 0.013, peak: 0.12 });
      },
      rest: function (t) {
        tone(t, { f: 330, f2: 240, gt: 0.05, a: 0.002, r: 0.05, peak: 0.26 });
        noise(t, { buf: bufP, type: 'lowpass', f: 1300, a: 0.001, r: 0.018, peak: 0.22 });
      },
      dock: function (t) {
        noise(t, { type: 'bandpass', f: 2400, q: 2.5, a: 0.001, r: 0.007, peak: 0.2 });
        noise(t + 0.018, { type: 'bandpass', f: 1600, q: 2, a: 0.001, r: 0.01, peak: 0.12 });
        tone(t + 0.16, { f: 987.8, a: 0.006, h: 0.06, r: 0.025, peak: 0.07 });
        tone(t + 0.27, { f: 1318.5, a: 0.006, h: 0.08, r: 0.04, peak: 0.07 });
      },
      pocket: function (t) {
        tone(t, { f: 230, f2: 160, gt: 0.05, a: 0.003, r: 0.045, peak: 0.22 });
        noise(t, { buf: bufP, type: 'lowpass', f: 650, a: 0.003, r: 0.03, peak: 0.22 });
      },
      swish: function (t) {
        noise(t, { buf: bufP, type: 'bandpass', f: 600, f2: 1700, at: 0.15, q: 0.9, a: 0.08, h: 0.04, r: 0.07, peak: 0.24 });
      },
      clink: function (t) {
        knock(t, 720, 0.22, 0.03);
        tone(t + 0.004, { f: 1870, a: 0.001, r: 0.09, peak: 0.035 });
        tone(t + 0.004, { f: 2630, a: 0.001, r: 0.06, peak: 0.02 });
        knock(t + 0.045, 560, 0.14, 0.03);
      },
      flop: function (t) {
        noise(t, { buf: bufP, type: 'lowpass', f: 900, q: 0.5, a: 0.02, h: 0.04, r: 0.07, peak: 0.36 });
        tone(t + 0.03, { f: 85, f2: 60, gt: 0.06, a: 0.004, r: 0.05, peak: 0.12 });
      },
      door: function (t) {
        noise(t, { type: 'bandpass', f: 1300, q: 3, a: 0.002, r: 0.02, peak: 0.12 });
        tone(t, { f: 560, f2: 480, gt: 0.03, a: 0.002, r: 0.03, peak: 0.06 });
        knock(t + 0.13, 820, 0.14, 0.03);
        noise(t + 0.15, { buf: bufP, type: 'lowpass', f: 500, q: 0.4, a: 0.18, h: 0.2, r: 0.2, peak: 0.07 });
      },
      step: function (t) {
        noise(t, { buf: bufP, type: 'lowpass', f: 1500, q: 0.6, a: 0.003, r: 0.025, peak: 0.24 });
        tone(t, { f: 120, f2: 90, gt: 0.04, a: 0.003, r: 0.03, peak: 0.1 });
        noise(t + 0.05, { buf: bufP, type: 'lowpass', f: 1100, q: 0.6, a: 0.003, r: 0.02, peak: 0.08 });
      },
      whisk: function (t) {
        noise(t, { buf: bufP, type: 'bandpass', f: 1100, f2: 2600, at: 0.18, q: 1.1, a: 0.05, h: 0.07, r: 0.05, peak: 0.22 });
        rustle(t + 0.02, 0.15, 2400, 0.07, 5);
      },
      chuckle: function (t) {
        var n = [293.66, 246.94, 261.63, 220.0], dt = 0.15;
        for (var i = 0; i < n.length; i++) {
          var tt = t + i * dt, f = n[i];
          var o = { f: f * 0.96, f2: f, gt: 0.03, a: 0.02, h: 0.035, r: 0.04, peak: i === 3 ? 0.17 : 0.2, lp: 1300 };
          if (oddWave) o.wave = oddWave; else { o.type = 'triangle'; }
          tone(tt, o);
          tone(tt, { f: f * 0.5, a: 0.02, h: 0.03, r: 0.04, peak: 0.05 });
          noise(tt, { buf: bufP, type: 'bandpass', f: 900, q: 0.8, a: 0.015, r: 0.03, peak: 0.025 });
        }
      },
      basket: function (t) {
        for (var i = 0; i < 5; i++) noise(t + i * 0.014 + Math.random() * 0.008, { type: 'bandpass', f: rnd(1500, 2200), q: 4, a: 0.001, r: 0.006, peak: rnd(0.08, 0.14) });
        knock(t, 520, 0.1, 0.03);
      },
      tap: function (t) {
        tone(t, { f: 480, f2: 380, gt: 0.03, a: 0.002, r: 0.02, peak: 0.08 });
        noise(t, { buf: bufP, type: 'lowpass', f: 1800, a: 0.001, r: 0.008, peak: 0.06 });
      },
      ending: function (t) {
        var b = 0.46;
        var mel = [[0, 659.25], [1, 783.99], [2, 1046.5], [3, 783.99], [4, 880.0], [5, 783.99], [6, 659.25], [7, 698.46],
                   [8, 587.33], [9, 659.25], [10, 587.33], [11, 523.25]];
        for (var i = 0; i < mel.length; i++) bell(t + mel[i][0] * b, mel[i][1], 0.12, i === mel.length - 1 ? 1.1 : 0.55);
        var bass = [[0, 261.63], [2, 329.63], [4, 349.23], [6, 261.63], [8, 196.0], [10, 196.0], [11, 261.63]];
        for (var j = 0; j < bass.length; j++) tone(t + bass[j][0] * b, { f: bass[j][1], a: 0.004, r: j === bass.length - 1 ? 1.0 : 0.45, peak: 0.06 });
      }
    };
    var noThrottleCap = { alldone: 1, ending: 1, chuckle: 1 };

    // ---------- 鳥と部屋 ----------
    function chirp() {
      if (!running() || !ambientOn) return;
      var t = ctx.currentTime + 0.02, out = ctx.createGain(), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 4200; out.gain.value = 1;
      var pan = null;
      if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = rnd(-0.8, 0.2); out.connect(pan); pan.connect(lp); }
      else out.connect(lp);
      lp.connect(ambBus);
      var kind = Math.random(), n = 2 + Math.floor(Math.random() * 3), base = rnd(2300, 3100), vol = rnd(0.02, 0.035);
      var saveD = D, saveR = R; D = out; R = 1;
      for (var i = 0; i < n; i++) {
        var tt = t + i * rnd(0.09, 0.14);
        if (kind < 0.5) tone(tt, { f: base, f2: base * 1.35, gt: 0.045, a: 0.008, h: 0.02, r: 0.015, peak: vol });
        else tone(tt, { f: base * 1.3, f2: base * 0.9, gt: 0.06, a: 0.01, h: 0.03, r: 0.02, peak: vol });
      }
      D = saveD; R = saveR;
      setTimeout(function () { try { out.disconnect(); lp.disconnect(); if (pan) pan.disconnect(); } catch (e) {} }, 2000);
    }
    function birdLoop() {
      birdTimer = 0;
      if (!ambientOn || failed) return;
      try { if (Math.random() < 0.85) chirp(); } catch (e) {}
      birdTimer = setTimeout(birdLoop, rnd(2500, 7000));
    }

    // ---------- どんぐりの ころころ ----------
    function rollLoop() {
      rollTimer = 0;
      if (!alive() || rollSpeed < 0.02) return;
      try {
        if (running()) {
          var now = ctx.currentTime, horizon = now + 0.1;
          if (rollNext < now) rollNext = now + 0.005;
          var saveD = D, saveR = R; D = sfxBus; R = 1;
          while (rollNext < horizon) {
            var v = rollSpeed;
            noise(rollNext, { type: 'bandpass', f: rnd(1600, 2800), q: 3.5, a: 0.001, r: rnd(0.004, 0.008), peak: 0.07 * v * rnd(0.5, 1) });
            if (Math.random() < 0.3) tone(rollNext, { f: rnd(900, 1300), a: 0.001, r: 0.008, peak: 0.025 * v });
            rollNext += (0.11 - 0.075 * v) * rnd(0.6, 1.4);
          }
          D = saveD; R = saveR;
        }
      } catch (e) {}
      rollTimer = setTimeout(rollLoop, 40);
    }

    // ---------- 公開 API ----------
    var api = {
      unlock: function () {
        if (failed) return;
        try {
          if (!ctx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) { failed = true; return; }
            ctx = new AC();
            build();
          }
          if (!userSuspended && ctx.state !== 'running') {
            var p = ctx.resume(); if (p && p.catch) p.catch(function () {});
          }
          // iOS: タッチの中で無音を1つ鳴らして解錠
          var s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
        } catch (e) { failed = true; ctx = null; }
      },
      suspend: function () {
        userSuspended = true;
        if (!alive()) return;
        try { var p = ctx.suspend(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      },
      resume: function () {
        userSuspended = false;
        if (!alive()) return;
        try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      },
      setAmbient: function (on) {
        on = !!on;
        if (on === ambientOn) return;
        ambientOn = on;
        if (on && !birdTimer) birdTimer = setTimeout(birdLoop, rnd(800, 2500));
        if (!on && birdTimer) { clearTimeout(birdTimer); birdTimer = 0; }
        if (!alive()) return;
        try { ambBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.6); } catch (e) {}
      },
      setSteam: function (level) {
        if (!alive() || !loops) return;
        try {
          var l = G.clamp(+level || 0, 0, 1), t = ctx.currentTime;
          loops.steam.g.gain.setTargetAtTime(0.2 * Math.pow(l, 1.2), t, 0.07);
          loops.steam.lp.frequency.setTargetAtTime(2200 + 3300 * l, t, 0.1);
        } catch (e) {}
      },
      setSlide: function (speed) {
        if (!alive() || !loops) return;
        try {
          var v = G.clamp(+speed || 0, 0, 1), t = ctx.currentTime;
          loops.slide.g.gain.setTargetAtTime(0.28 * Math.pow(v, 0.9), t, 0.05);
          loops.slide.lp.frequency.setTargetAtTime(320 + 700 * v, t, 0.08);
        } catch (e) {}
      },
      setRoll: function (speed) {
        rollSpeed = G.clamp(+speed || 0, 0, 1);
        if (!alive()) return;
        if (rollSpeed >= 0.02 && !rollTimer) rollLoop();
      },
      play: function (name, opts) {
        // 解錠直後（resume 完了待ち）でも予約する: 最初のタッチの音を落とさない
        if (!alive() || userSuspended || ctx.state === 'closed' || !S.hasOwnProperty(name)) return;
        try {
          var ms = nowMs();
          if (lastPlay[name] && ms - lastPlay[name] < 40) return;
          while (recent.length && ms - recent[0] > 120) recent.shift();
          if (recent.length >= 10 && !noThrottleCap[name]) return;
          lastPlay[name] = ms; recent.push(ms);
          opts = opts || {};
          var vol = opts.vol == null ? 1 : G.clamp(+opts.vol || 0, 0, 1);
          if (vol <= 0.001) return;
          var rate = opts.rate == null ? 1 : G.clamp(+opts.rate || 1, 0.25, 4);
          var out = ctx.createGain(); out.gain.value = vol; out.connect(sfxBus);
          D = out; R = rate;
          S[name](ctx.currentTime + 0.005);
          D = null; R = 1;
          setTimeout(function () { try { out.disconnect(); } catch (e) {} }, name === 'ending' ? 14000 : 3000);
        } catch (e) { D = null; R = 1; }
      }
    };
    Object.defineProperty(api, 'ready', {
      enumerable: true,
      get: function () { return !!ctx && !failed && ctx.state === 'running'; }
    });
    return api;
  };
})();
