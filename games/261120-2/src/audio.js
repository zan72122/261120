/*
 * audio.js — Web Audio だけで作る手続き合成の音（音声ファイル・外部素材なし、依存なし）
 *
 * ── 公開 API ─────────────────────────────────────────────
 *   import { createAudio } from './audio.js'
 *   const audio = createAudio()
 *
 *   audio.unlock()              最初の pointerdown（とその後の任意のタッチ）で呼ぶ。AudioContext をここで生成し
 *                               resume() と無音バッファ再生で iOS のロックを外す。何度呼んでも安全・軽い。
 *   audio.suspend()             画面非表示時。ctx.suspend()
 *   audio.resume()              画面復帰時。unlock 済みなら ctx.resume()
 *   audio.setMaster(v)          全体音量 0..1（既定 0.9）。60ms でなめらかに変わる
 *   audio.play(name, { gain = 1, pitch = 1, pan = 0, delay = 0 } = {})
 *                               ワンショット。gain 0..2 目安（倍率）、pitch 周波数倍率（0.5..2）、
 *                               pan -1(左)..1(右)、delay 秒。unlock 前に呼ばれたら何もしない。
 *   audio.setLoop(name, gain, pitch = 1)
 *                               持続音。初回呼び出しでノード生成。gain 0..1 / pitch 倍率に約 60〜100ms で追従。
 *                               gain 0 で無音（ノードは残る）。毎フレーム呼んでよい。
 *   audio.music.playEnding()    おしまいの曲（約 35 秒、BPM 70、ハ長調、オルゴール/カリンバ風 + パッド）。
 *                               ループしない。再生中に再度呼んでも無視。終わった後/stop 後はもう一度鳴らせる。
 *   audio.music.stop()          曲を 0.4 秒ほどでフェードアウトして止める
 *   audio.music.playing         (getter) 曲が鳴っている間 true
 *
 *   AudioContext が作れない・拒否された・closed の場合、すべての関数は黙って何もしない（例外を投げない）。
 *
 * ── ワンショット name ─────────────────────────────────────
 *   tapGlass  ガラスを指でこつん          plopSmall 小魚がちゃぽん        plopBig   太った魚がどぼん（しぶき続く）
 *   splash    水しぶき（gain で大きさ）    bubble    泡ひとつぷくっ（pitch でばらつき）
 *   bubbleBurst 泡まとめてぷくぷく(0.5s)   squish    手押しポンプしゅぽっ    gurgle    管をごぼごぼ(0.6s)
 *   click     エアポンプのボタンかちっ     sparkle   水が澄んだきらきら(1.2s) chime     1段階できた合図(木琴3音)
 *   hintPing  ヒントの小さなぽろん         eat       えさをぱくっ            burp      けぷっ + 泡
 *   pop       鉢の口からぽんっ（コルク）   squeeze   つかえてむぎゅ…        netSwish  あみが水にさばっ
 *   drip      水滴ぽたっ                   setDown   テーブルに置くことっ    pickUp    持ち上げるすっ
 *   marble    ビー玉ころん/ちりん          flakes    えささらさら            canShake  えさ缶しゃかっ
 *
 * ── 持続音 name（setLoop）────────────────────────────────
 *   ambience  部屋の静けさ + ごく小さな水音（常時うっすら。gain 1 で控えめな音量になるよう調整済み）
 *   wipe      スポンジでガラスきゅっきゅっ。gain=こする速さ(0..1)、pitch=速いほど高く(0.8..1.6 目安)
 *   flow      ポンプの管を流れる細い水「じゃー」  pitch で流れの明るさ
 *   pour      ピッチャーから注ぐ「じょぼじょぼ」  pitch を水位に応じて 1→1.6 程度上げると満ちていく感じ
 *   airPump   エアポンプの低い「ぶーん」（ごく小さく）
 *   bubbling  エアストーンの連続泡「ぷくぷく…」（ランダムな泡粒、周期感なし）
 *   drain     バケツへ落ちる水「たぱたぱ」
 *
 * ── 内部構成 ─────────────────────────────────────────────
 *   voice → (StereoPanner) → mix → DynamicsCompressor → tanh ソフトリミッタ → master → destination
 *                         └→ reverb send → Convolver(手続き IR 約1.1s の部屋) → mix
 *   ワンショットの同時発音は 24 まで（超えたら古い順に 30ms でフェードして間引く）。
 *   持続音の粒（泡・しずく）は 40ms 周期の先読みスケジューラで ~120ms 先まで予約する。
 *
 * ── 契約からの差分 ───────────────────────────────────────
 *   ・music.playing（読み取り専用）を追加。
 *   ・AudioContext は createAudio() では作らず、最初の unlock() で作る（iOS のユーザー操作要件のため）。
 */

const MAX_VOICES = 24;

export function createAudio() {
  let ctx = null;
  let dead = false;           // 生成に失敗したら以後何もしない
  let mix, master, revIn, dry;
  let W, P, B, SLOW8, SLOW30; // 共有ノイズバッファ
  let hasPanner = false;
  let masterLevel = 0.9;
  let timer = 0;
  const voices = [];
  const loops = {};

  // ───────── 小道具 ─────────
  const R = (a, b) => a + Math.random() * (b - a);
  const LR = (a, b) => a * Math.pow(b / a, Math.random()); // 対数一様
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const safe = (fn) => (...args) => { try { return fn(...args); } catch (e) { return undefined; } };

  function makeBuf(sec, fill) {
    const n = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    fill(b.getChannelData(0), n);
    return b;
  }
  function normalize(d, n, peak = 0.95) {
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i]));
    if (m > 0) for (let i = 0; i < n; i++) d[i] *= peak / m;
  }
  // ゆっくり揺れる滑らかなランダム（-1..1）。rate = 1秒あたりの折り返し点数
  function slowNoise(rate, sec) {
    return makeBuf(sec, (d, n) => {
      const step = Math.max(1, Math.floor(ctx.sampleRate / rate));
      let a = Math.random() * 2 - 1, b = Math.random() * 2 - 1;
      for (let i = 0; i < n; i++) {
        const k = i % step;
        if (k === 0 && i > 0) { a = b; b = Math.random() * 2 - 1; }
        const x = k / step;
        const s = (1 - Math.cos(Math.PI * x)) * 0.5;
        d[i] = a + (b - a) * s;
      }
      // ループ境界を滑らかに
      const fade = Math.min(step, n >> 2);
      for (let i = 0; i < fade; i++) {
        const w = i / fade;
        d[n - fade + i] = d[n - fade + i] * (1 - w) + d[i] * w;
      }
    });
  }

  function build() {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { dead = true; return false; }
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      try { ctx = new AC(); } catch (e2) { dead = true; return false; }
    }
    hasPanner = typeof ctx.createStereoPanner === 'function';

    // ノイズ
    W = makeBuf(4, (d, n) => { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; });
    P = makeBuf(4, (d, n) => { // pink (Paul Kellet)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      }
      normalize(d, n);
    });
    B = makeBuf(4, (d, n) => { // brown
      let l = 0;
      for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l; }
      normalize(d, n);
    });
    SLOW8 = slowNoise(8, 5);
    SLOW30 = slowNoise(30, 3);

    // マスター系
    mix = ctx.createGain(); mix.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    const shaper = ctx.createWaveShaper();
    const N = 2048, curve = new Float32Array(N), k = 1.4, tk = Math.tanh(k);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / tk; }
    shaper.curve = curve; shaper.oversample = '2x';
    master = ctx.createGain(); master.gain.value = masterLevel;
    mix.connect(comp); comp.connect(shaper); shaper.connect(master); master.connect(ctx.destination);
    dry = mix;

    // 部屋のリバーブ（手続き IR）
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        const e = Math.pow(1 - x, 2.2) * Math.exp(-x * 3);
        lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.4 * x); // 後ろほど暗く
        d[i] = lp * e * (i < ctx.sampleRate * 0.008 ? i / (ctx.sampleRate * 0.008) : 1);
      }
    }
    conv.buffer = ir;
    revIn = ctx.createGain(); revIn.gain.value = 1;
    const revOut = ctx.createGain(); revOut.gain.value = 0.32;
    const revHP = ctx.createBiquadFilter(); revHP.type = 'highpass'; revHP.frequency.value = 180;
    revIn.connect(revHP); revHP.connect(conv); conv.connect(revOut); revOut.connect(mix);

    timer = setInterval(safe(tick), 40);
    return true;
  }

  // ───────── 合成の部品 ─────────
  function env(g, t, a, amp, hold, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + a);
    if (hold > 0) g.gain.setValueAtTime(amp, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + dcy);
    return t + a + hold + dcy + 0.02;
  }
  function cleanup(src, nodes) {
    src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } } };
  }
  // 正弦などの単音。f2 があれば ft 秒で指数的にスイープ
  function tone(d, t, f, amp, dcy, o = {}) {
    const os = ctx.createOscillator();
    os.type = o.type || 'sine';
    os.frequency.setValueAtTime(f, t);
    if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.ft || dcy));
    if (o.det) os.detune.value = o.det;
    const g = ctx.createGain();
    const end = env(g, t, o.a || 0.002, amp, o.hold || 0, dcy);
    os.connect(g); g.connect(d);
    os.start(t); os.stop(end);
    cleanup(os, [os, g]);
    return end;
  }
  function nsrc(buf) {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    return s;
  }
  // フィルタを通したノイズの一発
  function nz(d, t, o) {
    const s = nsrc(o.b || W);
    const fl = ctx.createBiquadFilter();
    fl.type = o.type || 'bandpass';
    fl.frequency.setValueAtTime(o.f, t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + (o.ft || o.dcy));
    fl.Q.value = o.q == null ? 1 : o.q;
    const g = ctx.createGain();
    const end = env(g, t, o.a || 0.002, o.amp, o.hold || 0, o.dcy);
    s.connect(fl); fl.connect(g); g.connect(d);
    s.start(t, Math.random() * 3.5); s.stop(end);
    cleanup(s, [s, fl, g]);
    return end;
  }
  // 泡の共鳴（Minnaert 共鳴: 上がっていく正弦）
  function bub(d, t, f, amp, dur, rise = 1.9) {
    return tone(d, t, f, amp, dur, { f2: f * rise, ft: dur, a: 0.0015 });
  }
  // 固有振動の和（ガラス・木・金属）
  function modal(d, t, f, parts, amp, a = 0.0008) {
    let end = t;
    for (const [r, pa, dc] of parts) end = Math.max(end, tone(d, t, f * r, amp * pa, dc, { a }));
    return end;
  }
  function drops(d, t, n, spread, fa, fb, aa, ab) {
    for (let i = 0; i < n; i++) {
      const tt = t + Math.pow(Math.random(), 1.4) * spread;
      bub(d, tt, LR(fa, fb), R(aa, ab), R(0.03, 0.07), R(1.6, 2.4));
    }
  }

  // ───────── ワンショットのレシピ: [リバーブ送り量, 長さ秒, fn(dest, t, pitch, gain)] ─────────
  const RECIPES = {
    tapGlass: [0.18, 0.6, (d, t, p) => {
      nz(d, t, { type: 'highpass', f: 2600, q: 0.7, amp: 0.22, a: 0.0005, dcy: 0.014 });
      tone(d, t, 250 * p, 0.32, 0.06, { f2: 150 * p, ft: 0.05, a: 0.001 });
      nz(d, t, { type: 'lowpass', f: 700, q: 0.8, amp: 0.18, a: 0.001, dcy: 0.03 });
      modal(d, t, 1750 * p * R(0.97, 1.03),
        [[1, 0.14, 0.45], [2.41, 0.08, 0.28], [4.13, 0.045, 0.16], [6.2, 0.025, 0.09]], 1);
    }],
    plopSmall: [0.2, 0.6, (d, t, p) => {
      const f0 = R(380, 470) * p;
      tone(d, t, f0, 0.42, 0.11, { f2: f0 * 2.6, ft: 0.05, a: 0.003 });
      tone(d, t, 140 * p, 0.14, 0.05, { f2: 90 * p });
      nz(d, t + 0.005, { f: 2600, f2: 1200, q: 0.8, amp: 0.11, a: 0.004, dcy: 0.16 });
      drops(d, t + 0.05, 3, 0.25, 900 * p, 1900 * p, 0.04, 0.09);
    }],
    plopBig: [0.25, 1.2, (d, t, p) => {
      const f0 = R(165, 205) * p;
      tone(d, t, f0, 0.6, 0.26, { f2: f0 * 2.4, ft: 0.13, a: 0.004 });
      nz(d, t, { type: 'lowpass', b: B, f: 600, f2: 180, q: 0.7, amp: 0.5, a: 0.003, dcy: 0.22 });
      nz(d, t + 0.01, { f: 1900, f2: 800, q: 0.6, amp: 0.24, a: 0.012, dcy: 0.5 });
      nz(d, t + 0.02, { type: 'highpass', f: 3800, q: 0.5, amp: 0.07, a: 0.01, dcy: 0.4 });
      drops(d, t + 0.1, 9, 0.85, 600 * p, 2100 * p, 0.05, 0.12);
    }],
    splash: [0.22, 0.8, (d, t, p, g) => {
      nz(d, t, { f: 1600 * p, f2: 750 * p, q: 0.5, amp: 0.3, a: 0.008, dcy: 0.32 });
      nz(d, t, { type: 'highpass', f: 4200, q: 0.5, amp: 0.09, a: 0.004, dcy: 0.26 });
      nz(d, t, { type: 'lowpass', b: B, f: 400, q: 0.7, amp: 0.2, a: 0.004, dcy: 0.12 });
      drops(d, t + 0.03, 3 + Math.round(5 * clamp(g, 0, 1.5)), 0.5, 700 * p, 2300 * p, 0.04, 0.1);
    }],
    bubble: [0.22, 0.2, (d, t, p) => {
      bub(d, t, R(560, 880) * p, 0.34, R(0.05, 0.09), R(1.7, 2.2));
    }],
    bubbleBurst: [0.22, 0.7, (d, t, p) => {
      for (let i = 0; i < 11; i++) {
        bub(d, t + Math.pow(Math.random(), 1.2) * 0.46, LR(380, 1300) * p, R(0.12, 0.28), R(0.04, 0.09), R(1.6, 2.3));
      }
    }],
    squish: [0.15, 0.5, (d, t, p) => {
      nz(d, t, { f: 900 * p, f2: 2300 * p, ft: 0.1, q: 1.2, amp: 0.24, a: 0.03, dcy: 0.2 });
      tone(d, t, 95 * p, 0.34, 0.11, { f2: 58 * p, a: 0.004 });
      nz(d, t, { type: 'lowpass', b: B, f: 320, q: 0.7, amp: 0.25, a: 0.005, dcy: 0.08 });
      nz(d, t + 0.04, { f: 600 * p, q: 2, amp: 0.1, a: 0.05, dcy: 0.18 });
      bub(d, t + 0.06, R(300, 420) * p, 0.16, 0.08, 1.5);
      bub(d, t + 0.13, R(380, 520) * p, 0.1, 0.07, 1.6);
    }],
    gurgle: [0.18, 0.85, (d, t, p) => {
      for (let i = 0; i < 8; i++) {
        bub(d, t + (i / 8) * 0.5 + R(0, 0.05), LR(140, 380) * p, R(0.15, 0.3), R(0.06, 0.14), R(1.3, 1.7));
      }
      nz(d, t, { type: 'lowpass', b: B, f: 520, q: 0.8, amp: 0.13, a: 0.06, hold: 0.25, dcy: 0.3 });
    }],
    click: [0.08, 0.15, (d, t, p) => {
      nz(d, t, { type: 'highpass', f: 3000, q: 0.7, amp: 0.32, a: 0.0004, dcy: 0.006 });
      tone(d, t, 3200 * p, 0.07, 0.025, { a: 0.0005 });
      tone(d, t, 900 * p, 0.1, 0.018, { a: 0.0005 });
      nz(d, t + 0.045, { type: 'highpass', f: 2500, q: 0.7, amp: 0.16, a: 0.0004, dcy: 0.005 });
      tone(d, t + 0.045, 2700 * p, 0.035, 0.02, { a: 0.0005 });
    }],
    sparkle: [0.55, 1.9, (d, t, p) => {
      const notes = [1318.5, 1661.2, 1975.5, 2637.0, 2217.5];
      const times = [0, 0.09, 0.19, 0.31, 0.46];
      notes.forEach((f, i) => {
        const tt = t + times[i] + R(0, 0.012), ff = f * p, amp = 0.085 * (1 - i * 0.08);
        tone(d, tt, ff, amp, 1.15, { a: 0.005 });
        tone(d, tt, ff * 1.0025, amp * 0.45, 1.0, { a: 0.008 }); // ゆらぎ
        tone(d, tt, ff * 2.0, amp * 0.1, 0.45, { a: 0.004 });
        tone(d, tt, ff * 3.0, amp * 0.035, 0.22, { a: 0.003 });
      });
    }],
    chime: [0.25, 1.1, (d, t, p) => {
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const tt = t + i * 0.14, ff = f * p;
        modal(d, tt, ff, [[1, 1, 0.7], [3.93, 0.16, 0.12], [9.2, 0.035, 0.035]], 0.17, 0.0015);
        nz(d, tt, { type: 'lowpass', f: 2000, q: 0.7, amp: 0.04, a: 0.0005, dcy: 0.012 });
      });
    }],
    hintPing: [0.45, 0.8, (d, t, p) => {
      tone(d, t, 900 * p, 0.11, 0.14, { f2: 1700 * p, ft: 0.035, a: 0.002 });
      tone(d, t + 0.22, 1150 * p, 0.05, 0.16, { f2: 2000 * p, ft: 0.03, a: 0.002 });
    }],
    eat: [0.1, 0.12, (d, t, p) => {
      tone(d, t, 320 * p, 0.24, 0.05, { f2: 650 * p, ft: 0.025, a: 0.0015 });
      nz(d, t, { f: 1800, q: 1.5, amp: 0.09, a: 0.0008, dcy: 0.02 });
    }],
    burp: [0.15, 0.7, (d, t, p) => {
      nz(d, t, { f: 2500, q: 1.2, amp: 0.08, a: 0.0008, dcy: 0.015 });
      const os = ctx.createOscillator(); os.type = 'sawtooth';
      os.frequency.setValueAtTime(330 * p, t + 0.01);
      os.frequency.exponentialRampToValueAtTime(240 * p, t + 0.12);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.7;
      const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 900; bp.Q.value = 2; bp.gain.value = 8;
      const g = ctx.createGain();
      const end = env(g, t + 0.01, 0.012, 0.16, 0.03, 0.08);
      os.connect(lp); lp.connect(bp); bp.connect(g); g.connect(d);
      os.start(t + 0.01); os.stop(end);
      cleanup(os, [os, lp, bp, g]);
      for (let i = 0; i < 3; i++) bub(d, t + 0.16 + i * R(0.07, 0.11), LR(500, 950) * p, R(0.1, 0.16), R(0.05, 0.08));
    }],
    pop: [0.25, 0.55, (d, t, p) => {
      nz(d, t, { type: 'highpass', f: 1500, q: 0.7, amp: 0.3, a: 0.0004, dcy: 0.008 });
      tone(d, t, 420 * p, 0.5, 0.13, { f2: 840 * p, ft: 0.03, a: 0.001 });
      tone(d, t, 210 * p, 0.2, 0.06, { f2: 300 * p, a: 0.001 });
      drops(d, t + 0.08, 3, 0.25, 700 * p, 1300 * p, 0.07, 0.11);
    }],
    squeeze: [0.12, 0.55, (d, t, p) => {
      const os = ctx.createOscillator(); os.type = 'sawtooth';
      os.frequency.setValueAtTime(255 * p, t);
      os.frequency.linearRampToValueAtTime(345 * p, t + 0.36);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200 * p; lp.Q.value = 3;
      const am = ctx.createGain(); am.gain.value = 0.55;
      const mod = nsrc(SLOW30); const modG = ctx.createGain(); modG.gain.value = 0.45;
      mod.connect(modG); modG.connect(am.gain);
      const g = ctx.createGain();
      const end = env(g, t, 0.06, 0.2, 0.2, 0.12);
      os.connect(lp); lp.connect(am); am.connect(g); g.connect(d);
      os.start(t); os.stop(end); mod.start(t, Math.random() * 2.5); mod.stop(end);
      cleanup(os, [os, lp, am, g]); cleanup(mod, [mod, modG]);
    }],
    netSwish: [0.2, 0.8, (d, t, p) => {
      nz(d, t, { f: 700 * p, f2: 2400 * p, ft: 0.14, q: 0.9, amp: 0.26, a: 0.06, dcy: 0.28 });
      nz(d, t, { type: 'lowpass', b: B, f: 420, q: 0.7, amp: 0.16, a: 0.03, dcy: 0.2 });
      drops(d, t + 0.2, 3, 0.35, 900 * p, 2000 * p, 0.03, 0.06);
    }],
    drip: [0.35, 0.35, (d, t, p) => {
      const f = R(1100, 1400) * p;
      tone(d, t, f, 0.24, 0.07, { f2: f * 2.3, ft: 0.03, a: 0.001 });
      nz(d, t, { type: 'highpass', f: 4000, q: 0.7, amp: 0.04, a: 0.0004, dcy: 0.004 });
    }],
    setDown: [0.12, 0.3, (d, t, p) => {
      nz(d, t, { type: 'lowpass', f: 900, q: 0.8, amp: 0.38, a: 0.001, dcy: 0.035 });
      modal(d, t, 190 * p * R(0.95, 1.05), [[1, 0.35, 0.12], [2.3, 0.17, 0.07], [3.9, 0.09, 0.04], [6.1, 0.045, 0.025]], 1);
      nz(d, t, { f: 2500, q: 1, amp: 0.06, a: 0.0005, dcy: 0.01 });
    }],
    pickUp: [0.08, 0.22, (d, t, p) => {
      nz(d, t, { f: 1500 * p, f2: 3000 * p, ft: 0.08, q: 0.7, amp: 0.07, a: 0.04, dcy: 0.09 });
      tone(d, t, 620 * p, 0.03, 0.02, { a: 0.0008 });
    }],
    marble: [0.3, 0.65, (d, t, p) => {
      const f = 3100 * p * R(0.96, 1.04);
      nz(d, t, { type: 'highpass', f: 5000, q: 0.7, amp: 0.08, a: 0.0003, dcy: 0.004 });
      modal(d, t, f, [[1, 0.18, 0.32], [2.6, 0.09, 0.16], [4.9, 0.05, 0.08]], 1);
      modal(d, t + 0.13, f * 1.03, [[1, 0.08, 0.22], [2.6, 0.04, 0.1]], 1);
      nz(d, t + 0.01, { f: 420, q: 1, amp: 0.05, a: 0.02, dcy: 0.28 });
    }],
    flakes: [0.12, 0.65, (d, t) => {
      nz(d, t, { f: 6000, q: 0.6, amp: 0.045, a: 0.08, dcy: 0.35 });
      for (let i = 0; i < 34; i++) {
        const x = Math.random();
        nz(d, t + x * 0.45, { type: 'highpass', f: R(4000, 7000), q: 0.8, amp: R(0.03, 0.08) * (1 - x * 0.6), a: 0.0004, dcy: R(0.002, 0.006) });
      }
    }],
    canShake: [0.12, 0.35, (d, t, p) => {
      [0, 0.11].forEach((dt, i) => {
        const tt = t + dt, k = i ? 0.7 : 1;
        nz(d, tt, { f: 4500, q: 0.8, amp: 0.28 * k, a: 0.003, dcy: 0.05 });
        for (let j = 0; j < 7; j++) nz(d, tt + R(0, 0.04), { type: 'highpass', f: 5000, q: 0.7, amp: R(0.03, 0.07) * k, a: 0.0003, dcy: 0.003 });
        modal(d, tt, 1150 * p, [[1, 0.05, 0.06], [2.7, 0.03, 0.05]], k);
      });
    }],
  };

  // ───────── ワンショット再生と発音管理 ─────────
  function prune(now) {
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end < now) voices.splice(i, 1);
    while (voices.length >= MAX_VOICES) {
      const v = voices.shift();
      try {
        v.out.gain.cancelScheduledValues(now);
        v.out.gain.setValueAtTime(v.out.gain.value, now);
        v.out.gain.linearRampToValueAtTime(0, now + 0.03);
      } catch (e) { /* */ }
    }
  }
  function play(name, opts) {
    if (!ctx || ctx.state === 'closed') return;
    const r = RECIPES[name];
    if (!r) return;
    const o = opts || {};
    const g = clamp(num(o.gain, 1), 0, 3);
    if (g <= 0.0001) return;
    const p = clamp(num(o.pitch, 1), 0.25, 4);
    const pan = clamp(num(o.pan, 0), -1, 1);
    const now = ctx.currentTime;
    const t = now + 0.005 + Math.max(0, num(o.delay, 0));
    prune(now);
    const out = ctx.createGain(); out.gain.value = g;
    const nodes = [out];
    let node = out;
    if (hasPanner && pan !== 0) {
      const pn = ctx.createStereoPanner(); pn.pan.value = pan;
      out.connect(pn); node = pn; nodes.push(pn);
    }
    node.connect(dry);
    const send = ctx.createGain(); send.gain.value = r[0];
    node.connect(send); send.connect(revIn); nodes.push(send);
    r[2](out, t, p, g);
    const end = t + r[1];
    voices.push({ out, end });
    const release = () => {
      if (ctx && ctx.currentTime < end + 0.1) { setTimeout(release, 500); return; }
      for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } }
    };
    setTimeout(release, (end - now) * 1000 + 400);
  }

  // ───────── 持続音 ─────────
  // 各ループ: { g(出力), base, level, pitch, next, setP(p,t), onLevel(l,t), grain(t,p,l), rate(l,p) }
  function loopOut(base, rev = 0.1) {
    const g = ctx.createGain(); g.gain.value = 0;
    g.connect(dry);
    if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(revIn); }
    return { g, base, level: 0, pitch: 1, next: 0 };
  }
  function bed(buf, type, f, q, amp, dest) {
    const s = nsrc(buf); const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = amp;
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(ctx.currentTime, Math.random() * 3.5);
    return { s, fl, g };
  }
  // AM（ゆっくり揺らす）。gain = base + depth * slowNoise
  function wobble(dest, base, depth, buf) {
    const am = ctx.createGain(); am.gain.value = base;
    const m = nsrc(buf); const mg = ctx.createGain(); mg.gain.value = depth;
    m.connect(mg); mg.connect(am.gain); m.start(ctx.currentTime, Math.random() * 2.5);
    am.connect(dest);
    return am;
  }
  const TC = 0.03; // setTargetAtTime 時定数（~90ms で 95%）

  const LOOPS = {
    ambience() {
      const L = loopOut(1, 0.25);
      bed(B, 'lowpass', 320, 0.5, 0.05, L.g);
      bed(P, 'bandpass', 900, 0.4, 0.006, L.g);
      L.rate = () => 0.45;
      L.grain = (t, p) => {
        if (Math.random() < 0.7) bub(L.g, t, LR(500, 1100) * p, R(0.015, 0.04), R(0.05, 0.09));
        else tone(L.g, t, R(1100, 1500) * p, 0.02, 0.07, { f2: 2600 * p, ft: 0.03, a: 0.001 });
      };
      return L;
    },
    wipe() {
      const L = loopOut(1, 0.12);
      const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = 650;
      const fm = nsrc(SLOW30); const fmG = ctx.createGain(); fmG.gain.value = 70;
      fm.connect(fmG); fmG.connect(os.frequency);
      const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 1300; bp1.Q.value = 4;
      const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 2500; bp2.Q.value = 5;
      const sq = ctx.createGain(); sq.gain.value = 0;
      os.connect(bp1); os.connect(bp2);
      const am = wobble(sq, 0.55, 0.45, SLOW30);
      bp1.connect(am); bp2.connect(am);
      sq.connect(L.g);
      os.start(); fm.start(ctx.currentTime, Math.random() * 2);
      const bedG = ctx.createGain(); bedG.gain.value = 0; bedG.connect(L.g);
      const bd = bed(W, 'bandpass', 1800, 0.9, 1, wobble(bedG, 0.7, 0.3, SLOW8));
      L.onLevel = (l, t) => {
        sq.gain.setTargetAtTime(0.11 * Math.pow(l, 1.4), t, TC);
        bedG.gain.setTargetAtTime(0.12 * l, t, TC);
      };
      L.setP = (p, t) => {
        os.frequency.setTargetAtTime(650 * p, t, TC);
        fmG.gain.setTargetAtTime(70 * p, t, TC);
        bp1.frequency.setTargetAtTime(1300 * p, t, TC);
        bp2.frequency.setTargetAtTime(2500 * p, t, TC);
        bd.fl.frequency.setTargetAtTime(1800 * Math.sqrt(p), t, TC);
      };
      return L;
    },
    flow() {
      const L = loopOut(1, 0.12);
      const am = wobble(L.g, 0.75, 0.25, SLOW8);
      const a = bed(W, 'bandpass', 1700, 1.1, 0.16, am);
      const b = bed(P, 'lowpass', 450, 0.7, 0.08, am);
      L.rate = () => 7;
      L.grain = (t, p) => bub(L.g, t, LR(250, 700) * p, R(0.03, 0.08), R(0.04, 0.1), R(1.4, 1.9));
      L.setP = (p, t) => {
        a.fl.frequency.setTargetAtTime(1700 * p, t, TC);
        b.fl.frequency.setTargetAtTime(450 * p, t, TC);
      };
      return L;
    },
    pour() {
      const L = loopOut(1, 0.15);
      const am = wobble(L.g, 0.7, 0.3, SLOW8);
      const a = bed(W, 'bandpass', 520, 1.2, 0.2, am);
      const b = bed(B, 'lowpass', 260, 0.7, 0.14, am);
      const c = bed(W, 'highpass', 3500, 0.5, 0.025, am);
      L.rate = () => 34;
      L.grain = (t, p) => {
        if (Math.random() < 0.8) bub(L.g, t, LR(230, 900) * p, R(0.05, 0.14), R(0.03, 0.09), R(1.4, 2));
        else nz(L.g, t, { f: R(900, 2200) * p, q: 1.2, amp: R(0.05, 0.1), a: 0.002, dcy: R(0.02, 0.05) });
      };
      L.setP = (p, t) => {
        a.fl.frequency.setTargetAtTime(520 * p, t, TC);
        b.fl.frequency.setTargetAtTime(260 * p, t, TC);
        c.fl.frequency.setTargetAtTime(3500 * p, t, TC);
      };
      return L;
    },
    airPump() {
      const L = loopOut(0.6, 0.02);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
      const am = wobble(lp, 0.85, 0.15, SLOW8);
      lp.connect(L.g);
      const oscs = [[100, 'sine', 0.12], [50, 'triangle', 0.08], [200, 'sine', 0.035], [300, 'sine', 0.012]].map(([f, ty, a]) => {
        const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = a; o.connect(g); g.connect(am); o.start();
        return [o, f];
      });
      // ダイヤフラムのビビり（100Hz 付近をノイズで少しざらつかせる）
      bed(W, 'bandpass', 100, 3, 0.05, am);
      bed(P, 'lowpass', 700, 0.5, 0.012, L.g);
      L.setP = (p, t) => { for (const [o, f] of oscs) o.frequency.setTargetAtTime(f * p, t, TC); };
      return L;
    },
    bubbling() {
      const L = loopOut(1, 0.2);
      const fizz = bed(W, 'bandpass', 2600, 0.6, 0.012, wobble(L.g, 0.6, 0.4, SLOW8));
      L.rate = () => 9;
      L.grain = (t, p) => {
        const n = Math.random() < 0.35 ? 1 + Math.floor(Math.random() * 3) : 1;
        for (let i = 0; i < n; i++) {
          bub(L.g, t + i * R(0.015, 0.05), LR(420, 1500) * p, R(0.06, 0.17), R(0.035, 0.085), R(1.6, 2.4));
        }
      };
      L.setP = (p, t) => fizz.fl.frequency.setTargetAtTime(2600 * p, t, TC);
      return L;
    },
    drain() {
      const L = loopOut(1, 0.18);
      const a = bed(W, 'bandpass', 750, 0.7, 0.07, wobble(L.g, 0.7, 0.3, SLOW8));
      L.rate = () => 20;
      L.grain = (t, p) => {
        if (Math.random() < 0.78) nz(L.g, t, { f: LR(800, 2600) * p, q: 1.5, amp: R(0.06, 0.15), a: 0.0015, dcy: R(0.015, 0.05) });
        else bub(L.g, t, LR(200, 450) * p, R(0.06, 0.12), R(0.05, 0.1), 1.5);
      };
      L.setP = (p, t) => a.fl.frequency.setTargetAtTime(750 * p, t, TC);
      return L;
    },
  };

  function setLoop(name, gain, pitch) {
    if (!ctx || ctx.state === 'closed') return;
    let L = loops[name];
    if (!L) {
      const mk = LOOPS[name];
      if (!mk) return;
      L = loops[name] = mk();
    }
    const now = ctx.currentTime;
    const l = clamp(num(gain, 0), 0, 1);
    const p = clamp(num(pitch, 1), 0.25, 4);
    if (l !== L.level) {
      L.g.gain.setTargetAtTime(l * L.base, now, TC);
      if (L.onLevel) L.onLevel(l, now);
      L.level = l;
    }
    if (p !== L.pitch) {
      if (L.setP) L.setP(p, now);
      L.pitch = p;
    }
  }

  // ───────── 先読みスケジューラ（ループの粒と音楽） ─────────
  function tick() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime, until = now + 0.12;
    for (const k in loops) {
      const L = loops[k];
      if (!L.grain) continue;
      if (L.next < now) L.next = now + Math.random() * 0.03;
      if (L.level < 0.003) { L.next = until; continue; }
      while (L.next < until) {
        L.grain(L.next, L.pitch, L.level);
        L.next += -Math.log(1 - Math.random() * 0.999) / L.rate(L.level, L.pitch);
      }
    }
    musicTick(now, until + 0.2);
  }

  // ───────── 音楽 ─────────
  const BEAT = 60 / 70;
  let mus = null; // { bus, start, events, idx, endAt }
  const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function kalimba(d, t, m, vel) {
    const f = mf(m);
    const low = clamp((72 - m) / 24, 0, 1); // 低い音ほど長く
    const dec = 1.5 + low * 1.2;
    tone(d, t, f, 0.5 * vel, dec, { a: 0.003 });
    tone(d, t, f * 2.01, 0.07 * vel, dec * 0.3, { a: 0.002 });
    tone(d, t, f * 5.4, 0.03 * vel, 0.12, { a: 0.001 });
    nz(d, t, { f: Math.min(f * 3, 7000), q: 1.5, amp: 0.025 * vel, a: 0.0005, dcy: 0.006 });
  }
  function pad(d, t, notes, dur) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 850; lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03, t + 1.1);
    g.gain.setValueAtTime(0.03, t + dur);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.55);
    lp.connect(g); g.connect(d);
    const end = t + dur + 3;
    const nodes = [lp, g];
    let first = null;
    for (const m of notes) for (const det of [-5, 5]) {
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = mf(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(end);
      nodes.push(o);
      if (!first) first = o;
    }
    cleanup(first, nodes);
  }

  function buildSong() {
    // [midi, 拍, 長さ拍]（オリジナル旋律・ハ長調）
    const mel = [
      [76, 0], [79, 1], [81, 2], [79, 3],
      [76, 4], [72, 5], [74, 6],
      [69, 8], [72, 9], [77, 10], [76, 11],
      [74, 12], [67, 15],
      [76, 16], [79, 17], [84, 18], [83, 19],
      [81, 20], [79, 21], [76, 22],
      [77, 24], [81, 25], [79, 26], [74, 27],
      [76, 28], [72, 30],
      [69, 32], [72, 33], [77, 34],
      [76, 36], [74, 37], [72, 38],
    ];
    const CH = {
      C: { arp: [48, 55, 60, 64], pad: [60, 64, 67] },
      Am: { arp: [45, 52, 57, 60], pad: [57, 60, 64] },
      F: { arp: [41, 48, 53, 57], pad: [57, 60, 65] },
      G: { arp: [43, 50, 55, 59], pad: [55, 59, 62] },
    };
    // [和音, 開始拍, 長さ拍]
    const prog = [['C', 0, 4], ['Am', 4, 4], ['F', 8, 4], ['G', 12, 4], ['C', 16, 4], ['Am', 20, 4],
      ['F', 24, 2], ['G', 26, 2], ['C', 28, 4], ['F', 32, 4], ['C', 36, 4]];
    const ev = [];
    for (const [m, b] of mel) {
      const vel = (b % 4 === 0 ? 1 : 0.85) * R(0.9, 1.05) * (b >= 36 ? 0.85 : 1);
      ev.push([b, (d, t) => kalimba(d, t + R(-0.006, 0.006), m, 0.55 * vel)]);
    }
    const pat = [0, 1, 2, 3, 2, 1, 2, 1];
    for (const [name, b0, len] of prog) {
      const c = CH[name];
      ev.push([b0, (d, t) => pad(d, t, c.pad, len * BEAT + (b0 >= 36 ? 2.5 : 0.4))]);
      if (b0 >= 36) {
        // 最後: ゆっくり分散和音で閉じる
        [48, 55, 60, 64, 67].forEach((m, i) => ev.push([b0 + i * 0.5, (d, t) => kalimba(d, t, m, 0.2 * (1 - i * 0.08))]));
        ev.push([b0 + 3, (d, t) => kalimba(d, t, 84, 0.1)]);
        continue;
      }
      for (let i = 0; i < len * 2; i++) {
        const m = c.arp[pat[i % 8]];
        ev.push([b0 + i * 0.5, (d, t) => kalimba(d, t + R(-0.008, 0.008), m, (i === 0 ? 0.24 : 0.15) * R(0.85, 1.05))]);
      }
    }
    ev.sort((a, b) => a[0] - b[0]);
    return ev;
  }

  function musicTick(now, until) {
    if (!mus) return;
    if (mus.events) {
      while (mus.idx < mus.events.length) {
        const [b, fn] = mus.events[mus.idx];
        const t = mus.start + b * BEAT;
        if (t > until) break;
        if (t >= now - 0.05) fn(mus.bus, Math.max(t, now));
        mus.idx++;
      }
    }
    if (now > mus.endAt) {
      const old = mus.bus; mus = null;
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* */ } }, 500);
    }
  }

  const music = {
    playEnding: safe(() => {
      if (!ctx || ctx.state === 'closed' || mus) return;
      const bus = ctx.createGain(); bus.gain.value = 0.9;
      bus.connect(dry);
      const send = ctx.createGain(); send.gain.value = 0.4; bus.connect(send); send.connect(revIn);
      const start = ctx.currentTime + 0.25;
      mus = { bus, start, events: buildSong(), idx: 0, endAt: start + 40 * BEAT + 6 };
    }),
    stop: safe(() => {
      if (!ctx || !mus) return;
      const now = ctx.currentTime, old = mus.bus;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.setTargetAtTime(0, now, 0.12);
      mus = null;
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* */ } }, 4000);
    }),
    get playing() { return !!mus; },
  };

  // ───────── 公開 ─────────
  return {
    unlock: safe(() => {
      if (dead) return;
      if (!ctx && !build()) return;
      if (ctx.state === 'closed') return;
      if (ctx.state !== 'running') {
        const pr = ctx.resume();
        if (pr && pr.catch) pr.catch(() => {});
        // iOS 用: 無音バッファを1つ鳴らしてロック解除
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination); s.start(0);
        s.onended = () => { try { s.disconnect(); } catch (e) { /* */ } };
      }
    }),
    suspend: safe(() => {
      if (ctx && ctx.state === 'running') { const pr = ctx.suspend(); if (pr && pr.catch) pr.catch(() => {}); }
    }),
    resume: safe(() => {
      if (ctx && ctx.state !== 'closed' && ctx.state !== 'running') { const pr = ctx.resume(); if (pr && pr.catch) pr.catch(() => {}); }
    }),
    setMaster: safe((v) => {
      masterLevel = clamp(num(v, masterLevel), 0, 1);
      if (ctx && master) master.gain.setTargetAtTime(masterLevel, ctx.currentTime, 0.02);
    }),
    play: safe(play),
    setLoop: safe(setLoop),
    music,
  };
}
