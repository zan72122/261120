// スフレ：主役の仕掛け（hero）。docs/HERO-SPEC.md の API を満たす。
// three は import しない（THREE は引数で渡る）。部品は params.js のパラメータから生成し、連動は数式で保つ。
//
//   whisk : クランク θc →（冠歯車 Z1 / ピニオン Z2）→ 横軸 → かさ歯車 → キャリア θs →（内歯車 Zr / 遊星 Zp）→ 泡立て器
//           → 生地がうねり、泡立ち（w）、最後に頭が上がって角が立つ
//   pour  : そりが出る → ボウルを傾ける（ばね）→ 生地が流れる（p）→ ココットにたまる
//   load  : 台車がレールを走り、開いた扉（跳ね橋）を渡って庫内へ
//   close / bake / open : 扉（ばね＋跳ね返り）、つまみ → ヒーター → ふくらみ・焼き色（b）
//   wobble / scoop : ぷるぷる（ばね）、スプーンですくう（くぼみと断面）
import { TAU, DEG, clamp, lerp, smooth, ease, wrapPi, fin, springTo } from './util.js';
import { P, STAGES, VIEW, TARGET_OF, derive } from './params.js';
import { createKit } from './kit.js';
import { createMaterials } from './materials.js';
import { buildMixer } from './mixer.js';
import { buildBowl, buildStream } from './bowl.js';
import { buildPath, buildTrack, buildCart } from './cart.js';
import { buildOven } from './oven.js';

const HX = Math.PI / 2;
const DONE_WAIT = { whisk: 2.3, pour: 1.0, load: 0.6, close: 0.7, bake: 1.3, open: 0.6, wobble: 0.9, scoop: 1.5 };

export function createHero(THREE, opts) {
  const emit = (ev) => { try { opts.onEvent && opts.onEvent(ev); } catch (e) { /* シェル側の失敗で止めない */ } };
  const sound = (name, gain, pitch) => emit({ type: 'sound', name, gain, pitch });

  const K = createKit(THREE, opts.addons, opts.quality || { detail: 1 });
  const M = createMaterials(THREE, opts, K.own, P);
  const D = derive(P);
  const root = new THREE.Group(); root.name = 'hero';
  const ctx = { THREE, K, M, P, D };

  const mixer = buildMixer(ctx); root.add(mixer.group);
  const bowl = buildBowl(ctx, mixer.group);
  const stream = buildStream(ctx, root);
  const path = buildPath(P, D);
  buildTrack(ctx, root, path);
  const cart = buildCart(ctx, root, path);
  const oven = buildOven(ctx, root, path);
  { // 置き物の疑似影（ミキサーとオーブン、1 メッシュ）
    const a = new THREE.PlaneGeometry(0.50, 0.50); a.rotateX(-HX); a.translate(P.MIXER[0] + 0.02, 0.0015, P.MIXER[2] - 0.07);
    const b = new THREE.PlaneGeometry(0.58, 0.46); b.rotateX(-HX); b.translate(P.OVEN[0], 0.0015, P.OVEN[2]);
    const m = new THREE.Mesh(K.merge([a, b]), M.blob); m.renderOrder = -1; root.add(m);
  }

  const mx = P.mixer, ck = P.crank, bw = P.bowl, bt = P.batter, ct = P.cart, dr = P.oven.door, kb = P.oven.knob, sf = P.souffle;

  // ---- 当たり判定（HERO-SPEC §4） ----
  const targets = [
    { id: 'crank', object: mixer.crankHit, pivot: mixer.crank, kind: 'rotate', gesture: { type: 'circle' }, enabled: false },
    { id: 'bowl', object: bowl.hit, pivot: bowl.pivot, kind: 'drag', gesture: { type: 'drag', dir: [0.71, -0.71] }, enabled: false },
    { id: 'ramekin', object: cart.ramekinHit, pivot: cart.ramekinPivot, kind: 'tap', gesture: { type: 'tap' }, enabled: false },
    { id: 'door', object: oven.doorHit, pivot: oven.doorPivot, kind: 'drag', gesture: { type: 'drag', dir: [0, 1] }, enabled: false },
    { id: 'knob', object: oven.knobHit, pivot: oven.knob, kind: 'rotate', gesture: { type: 'circle' }, enabled: false },
    { id: 'souffle', object: cart.souffleHit, pivot: cart.soufflePivot, kind: 'tap', gesture: { type: 'tap' }, enabled: false },
    { id: 'spoon', object: cart.spoonHit, pivot: cart.spoon, kind: 'drag', gesture: { type: 'drag', dir: [0, -1] }, enabled: false },
  ];
  const byId = {}; targets.forEach((t) => { byId[t.id] = t; });
  const glowOf = { crank: mixer.glow, bowl: [M.copper], ramekin: [M.ceramic], door: [oven.doorMat, oven.handleMat], knob: [oven.knobMat], souffle: [M.souffle], spoon: [cart.spoonMat] };
  const GLOW = new THREE.Color(P.col.glow), HEAT = new THREE.Color(P.col.heat);
  const LIQ = new THREE.Color(P.col.liquid), FOAM = new THREE.Color(P.col.foam), PALE = new THREE.Color(0xfff0c2), GOLD = new THREE.Color(0xd9a04a);

  // ---- 状態 ----
  const loops = { whisk: { level: 0, rate: 1 }, pour: { level: 0, rate: 1 }, oven: { level: 0, rate: 1 } };
  const sp = () => ({ x: 0, v: 0 });
  let S, crustTex = null, crustAsked = false;
  function fresh() {
    return {
      stageIndex: 0, stageT: 0, done: false, doneT: 0, ready: false, time: 0, glowT: 0,
      w: 0, p: 0, b: 0,
      crank: sp(), crankGoal: 0, crankCoast: 0, crankAuto: 0, crankDir: 1, clickAcc: 0, speedS: 0, fluidOm: 0, carOm: 0,
      flex: sp(), sloshX: sp(), sloshZ: sp(),
      lift: sp(), liftGoal: 0, slide: sp(), slideGoal: 0,
      peak: sp(), peakPhase: 0, curlX: 0, curlZ: 1, tipOK: false, tipX: 0, tipZ: 0,
      tilt: sp(), tiltGoal: 0, tiltPulse: 0, sigma: 0, flow: 0, pile: 0, landed: false,
      cartS: path.sPour, cartFrom: 0, cartTo: 0, cartDur: 1, cartU: 1, cartMode: 'pour', tieAcc: 0,
      door: { x: 1, v: 0 }, doorGoal: 1, doorHeld: false, dragAcc: 0, doorSnd: false,
      knob: sp(), knobGoal: 0, knobCoast: 0, knobAuto: 0, knobDir: 1, knobClick: 0, heat: 0, glowI: 0, puffs: 0,
      wobX: sp(), wobZ: sp(), sq: sp(), taps: 0, idleJig: 0,
      d: 0, dGoal: 0, scoopU: -1, spoonIn: 0, dentOn: 0, dentX: 0, dentY: 0, dentZ: 0, inside: 0,
    };
  }
  const stageName = () => STAGES[S.stageIndex];
  const activeId = () => (S.done || !S.ready ? null : (TARGET_OF[stageName()] || null));

  function startStage(i) {
    S.stageIndex = i; S.stageT = 0; S.done = false; S.doneT = 0; S.dragAcc = 0; S.glowT = 0; S.doorHeld = false;
    const st = stageName();
    S.ready = !(st === 'pour' || st === 'scoop');     // この 2 つは準備の動き（そり・スプーン）が済んでから触れる
    targets.forEach((t) => { t.enabled = S.ready && t.id === TARGET_OF[st]; });
    byId.door.gesture = { type: 'drag', dir: st === 'open' ? [0, -1] : [0, 1] };  // 閉めるは上へ、開けるは下へ
    if (st === 'pour') {
      S.slideGoal = 1; sound('slide', 0.8, 0.9);
      if (!crustAsked) { crustAsked = true; opts.textures.ready('golden_crust').then((t) => { crustTex = t; M.setCrust(t); }).catch(() => {}); }
    }
    if (st === 'load') { S.slideGoal = 0; sound('slide', 0.5, 0.8); }
    if (st === 'scoop') { cart.spoon.visible = true; S.spoonIn = 0; sound('whoosh', 0.6); }
    emit({ type: 'stage', stage: st, index: i, view: VIEW[st] });
    if (st === 'finale') emit({ type: 'complete' });
  }
  function finishStage() {
    if (S.done) return;
    S.done = true; S.doneT = 0;
    targets.forEach((t) => { t.enabled = false; });
    emit({ type: 'stageDone', stage: stageName(), index: S.stageIndex });
  }
  function makeReady() { S.ready = true; const id = TARGET_OF[stageName()]; targets.forEach((t) => { t.enabled = t.id === id; }); }

  // ---- 使い回す一時変数 ----
  const v1 = new THREE.Vector3(), tipW = new THREE.Vector3(), tipL = new THREE.Vector3(), lipV = new THREE.Vector3(), landV = new THREE.Vector3();
  const surfIn = { w: 0, p: 0, sigma: 0, sloshX: 0, sloshZ: 0, speed: 0, stir: 0, whiskX: 0, whiskZ: 0, omega: 0, flow: 0, peakH: 0, curlX: 0, curlZ: 0 };
  const sfIn = { p: 0, b: 0, pile: 0, wobX: 0, wobZ: 0, sq: 0, dent: 0, dx: 0, dy: 0, dz: 0 };
  const sfLast = new Float64Array(10).fill(NaN);
  let lastCartS = NaN;

  // 指が、部品の中心（画面投影）から見てどの角度にいるか（画面で反時計回りが正）
  function fingerAngle(obj, input) {
    const cam = opts.camera;
    if (!cam) return null;
    obj.getWorldPosition(v1).project(cam);
    const dx = (input.pointer.x - v1.x) * (cam.aspect || 1), dy = input.pointer.y - v1.y;
    if (!(dx * dx + dy * dy > 0.0016)) return null;
    return Math.atan2(dy, dx);
  }
  function cartGo(to, dur, mode) {
    S.cartFrom = S.cartS; S.cartTo = to; S.cartDur = dur; S.cartU = 0; S.cartMode = mode; S.tieAcc = 0;
    sound('slide', 1, 1);
    const dir = to > S.cartS ? 1 : -1;
    S.wobX.v -= dir * 0.05;                                   // 出だしで生地が後ろへ寄る
  }

  // =====================================================================
  function update(dtIn, input) {
    const dt = clamp(fin(dtIn, 0), 0, 0.05);
    if (S.done) { S.doneT += dt; if (S.stageIndex < STAGES.length - 1 && S.doneT >= DONE_WAIT[stageName()] && settled()) startStage(S.stageIndex + 1); }
    const st = stageName(), live = !S.done;
    S.stageT += dt; S.glowT += dt; S.time += dt;
    const held = (id) => live && S.ready && input.isDown && input.grabId === id;
    const tap = live && S.ready ? input.tapId : null;
    const idle = fin(input.idle, 0);
    const rot = fin(input.rotate, 0), dpx = fin(input.dragPx.x, 0), dpy = fin(input.dragPx.y, 0); // 入力は有限の数だけ使う
    // 止まっているときの小さな揺れ（±3°、1.5Hz、1 秒揺れて 1 秒休む）。部品ごとに下で使う。
    const act = activeId(), touching = act && input.isDown && input.grabId === act;
    let wig = 0, wigStart = false;
    if (act && !touching && idle >= 2.5) {
      const ph = (idle - 2.5) % 2;
      if (ph < 1) wig = Math.sin(ph * TAU * 1.5) * 3 * DEG;
      wigStart = ph < dt + 1e-4;
    }

    // ------------------------------------------------ クランクと歯車の列
    const cranking = st === 'whisk' && held('crank');
    if (cranking) {
      if (input.pressed) { const fa = fingerAngle(mixer.crank, input); if (fa !== null) S.crankGoal = S.crank.x + wrapPi(fa - S.crank.x); }
      S.crankGoal += rot;
      if (Math.abs(rot) > 1e-5) S.crankDir = rot > 0 ? 1 : -1;
      S.crankCoast += (rot / Math.max(dt, 1e-3) - S.crankCoast) * Math.min(1, dt * 10);
    } else { S.crankGoal += S.crankCoast * dt; S.crankCoast *= Math.exp(-dt / ck.coastTau); } // 離すと惰性で少し回って止まる
    if (st === 'whisk' && tap === 'crank') S.crankAuto += ck.tapTurn;
    if (S.crankAuto > 0) { const k = Math.min(S.crankAuto, dt * ck.tapTurn / ck.tapTime); S.crankGoal += k * S.crankDir; S.crankAuto -= k; }
    S.crankGoal = clamp(fin(S.crankGoal, S.crank.x), S.crank.x - 9, S.crank.x + 9); S.crankCoast = clamp(fin(S.crankCoast, 0), -60, 60);
    const c0 = S.crank.x;
    springTo(S.crank, S.crankGoal, ck.w0 * (1 - 0.2 * S.w), ck.zeta, dt);   // 泡が固くなるほど少し重い
    const dC = S.crank.x - c0;
    if (st === 'whisk' && live) {
      S.w = clamp(S.w + Math.abs(dC) / (TAU * ck.turns), 0, 1);            // クランク 6 回転で w=1
      S.clickAcc += Math.abs(dC) * P.gear.Z1 / TAU;                         // 歯 4 枚ごとにカチッ
      if (S.clickAcc >= 4) { S.clickAcc -= 4; if (S.clickAcc > 4) S.clickAcc = 0; sound('click', 0.45, 0.9 + S.w * 0.4); }
      if (Math.random() < Math.abs(S.crank.v) * dt * 0.35 * (0.3 + S.w)) sound('pop', 0.3, 0.8 + S.w);
      if (S.w >= 1) { S.crankAuto = 0; finishStage(); }
    }
    const thC = S.crank.x + (act === 'crank' ? wig : 0);                    // 揺れは歯車の列ごと伝わる
    const thH = D.kH * thC, thS = thH;                                      // 横軸、縦軸（かさ歯車 1:1）
    mixer.crankSpin.rotation.z = thC;
    mixer.hshaft.rotation.x = thH;
    mixer.vshaft.rotation.y = thS;                                          // キャリア（公転）
    mixer.spin.rotation.y = D.kP * thS;                                     // 遊星（キャリアに対して。絶対では (1−Zr/Zp)·θs）
    const carOm = D.kH * S.crank.v, carAl = (carOm - S.carOm) / Math.max(dt, 1e-3); S.carOm = carOm;
    // 泡立て器のしなり：加減速で先が遅れ、止めると少し揺れて止まる。泡が固いほど引きずられる
    {
      const n = 2, h = dt / n, tgt = clamp(-0.0016 * carOm * S.w, -0.06, 0.06);
      for (let i = 0; i < n; i++) { S.flex.v += (800 * (tgt - S.flex.x) - 14 * S.flex.v - 0.25 * carAl) * h; S.flex.x += S.flex.v * h; }
      S.flex.x = clamp(fin(S.flex.x), -0.1, 0.1); S.flex.v = clamp(fin(S.flex.v), -8, 8);
      mixer.flex.rotation.x = S.flex.x;
    }
    const speedN = clamp(Math.abs(S.crank.v) / 12, 0, 1);
    S.speedS += (speedN - S.speedS) * Math.min(1, dt / (speedN > S.speedS ? 0.12 : 0.15 + 0.5 * (1 - S.w)));
    S.fluidOm += (-carOm - S.fluidOm) * Math.min(1, dt / 0.45);
    loops.whisk.level = speedN; loops.whisk.rate = 0.8 + 0.8 * S.w;

    // ------------------------------------------------ 頭（チルト）とそり
    if (S.stageIndex === 0 && S.done && S.doneT > 0.45 && S.liftGoal === 0) { S.liftGoal = 1; S.peakPhase = 1; sound('whoosh', 0.8, 0.9); }
    if (S.stageIndex >= 2 && S.liftGoal === 1 && S.slide.x < 0.06) { S.liftGoal = 0; sound('whoosh', 0.5, 0.8); }
    springTo(S.lift, S.liftGoal, 5.2, 0.85, dt);
    mixer.head.rotation.x = -S.lift.x * mx.liftMax;
    const sl0 = S.slide.x;
    springTo(S.slide, S.slideGoal, 6.5, 0.9, dt);
    if ((S.slideGoal === 1 && sl0 < 0.985 && S.slide.x >= 0.985) || (S.slideGoal === 0 && sl0 > 0.015 && S.slide.x <= 0.015)) sound('clack', 0.5, 1.1);
    bowl.sled.position.x = S.slide.x * bw.travel;
    if (st === 'pour' && !S.ready && live && S.slide.x > 0.96) makeReady();

    // ------------------------------------------------ ボウルの傾き → 流れ
    if (st === 'pour' && live) {
      if (held('bowl')) S.tiltGoal = clamp(S.tiltGoal + (dpx * 0.71 - dpy * 0.71) * bw.dragGain, 0, bw.tiltMax);
      else if (S.tiltPulse <= 0) S.tiltGoal = 0;                            // 離すとゆっくり戻る
      if (tap === 'bowl') S.tiltPulse = 1.5;                                // タップ：少し傾いて少し注ぎ、戻る
      if (S.tiltPulse > 0) { S.tiltPulse -= dt; S.tiltGoal = S.tiltPulse > 0 ? 0.9 * bw.tiltMax : 0; }
    } else { S.tiltGoal = 0; S.tiltPulse = 0; }
    {
      const up = S.tiltGoal > S.tilt.x;
      springTo(S.tilt, S.tiltGoal, up ? bw.w0 + 2 * S.p : 4.5, up ? bw.zeta : 1.0, dt);  // 生地が減ると軽くなる
      if (S.tilt.x < 0) { if (S.tilt.v < -0.6) sound('clack', clamp(-S.tilt.v / 4, 0.2, 0.8), 0.8); S.tilt.x = 0; S.tilt.v = -S.tilt.v * 0.2; }
    }
    const tiltA = S.tilt.x + (act === 'bowl' ? Math.abs(wig) : 0);
    bowl.tilt.rotation.z = -tiltA;
    S.sigma += (tiltA - S.sigma) * Math.min(1, dt / lerp(0.12, 0.4, S.w));  // 泡はボウルに遅れて水平に戻る（とろり）
    S.flow = st === 'pour' && live && S.tilt.x > bw.flowStart ? smooth(bw.flowStart, bw.flowFull, S.tilt.x) : 0;
    if (S.flow > 0) { S.p = clamp(S.p + bw.flowRate * S.flow * dt, 0, 1); if (S.p >= 1) { finishStage(); } }
    bowl.lipWorld(lipV, S.slide.x, tiltA, 0);
    landV.set(D.pourAt[0], ct.railTop + ct.deckH + cart.info.base - 0.003, D.pourAt[2]);
    const landed = stream.update(dt, S.time, S.done ? 0 : S.flow, lipV, landV, tiltA);
    if (landed && !S.landed) sound('plop', 0.9, 0.9 + 0.3 * S.p);
    S.landed = landed;
    S.pile += ((landed ? 0.011 * S.flow : 0) - S.pile) * Math.min(1, dt * (landed ? 6 : 3));
    loops.pour.level = landed ? S.flow : S.flow * 0.25; loops.pour.rate = 0.8 + 0.5 * S.p;

    // ------------------------------------------------ 生地の表面（ボウル）
    if (S.stageIndex <= 2 || Math.abs(S.slide.v) > 1e-3) {
      mixer.spin.updateWorldMatrix(true, false);
      tipW.set(0, mixer.whiskTipLocalY, 0).applyMatrix4(mixer.spin.matrixWorld);
      tipL.copy(tipW); bowl.bowl.worldToLocal(tipL);
      const level = bw.thk + (bt.h0 + bt.h1 * smooth(0, 1, S.w)) * (1 - S.p), sub = level - tipL.y;
      const inBowl = sub > -0.002 && Math.hypot(tipL.x, tipL.z) < 0.12 && S.slide.x < 0.05;
      let tipV = 0;
      if (S.tipOK && dt > 1e-4) tipV = Math.hypot(tipL.x - S.tipX, tipL.z - S.tipZ) / dt;
      // 角：頭を上げると、泡が泡立て器の先について伸び、離れてぷるんと立つ
      const kPeak = smooth(0.7, 1, S.w), pMax = bt.peakH * kPeak;
      let pTarget = 0;
      if (S.peakPhase === 1 && sub < 0) {
        S.peakPhase = 2; bowl.setPeakAt(tipL.x, tipL.z);
        const vx = tipL.x - S.tipX, vz = tipL.z - S.tipZ, vl = Math.hypot(vx, vz);
        if (vl > 1e-6) { S.curlX = vx / vl; S.curlZ = vz / vl; }
      }
      if (S.peakPhase === 2) { pTarget = Math.min(-sub, pMax); if (-sub > pMax * 1.05) { S.peakPhase = 3; S.peak.v -= 0.2; sound('pop', 0.7, 1.3); } }
      if (S.peakPhase === 3) pTarget = pMax * 0.9;
      springTo(S.peak, pTarget, S.peakPhase === 2 ? 45 : 17, S.peakPhase === 2 ? 1 : 0.28, dt);
      S.tipOK = true; S.tipX = tipL.x; S.tipZ = tipL.z;
      // 液体のゆれ：泡立て器のいる側へ面が傾き、止めると揺れ戻る
      const sw = 0.10 * S.speedS * (1 - 0.8 * S.w), rr = Math.hypot(tipL.x, tipL.z) || 1;
      springTo(S.sloshX, inBowl ? -sw * tipL.x / rr : 0, 10, lerp(0.16, 0.6, S.w), dt);
      springTo(S.sloshZ, inBowl ? -sw * tipL.z / rr : 0, 10, lerp(0.16, 0.6, S.w), dt);
      surfIn.w = S.w; surfIn.p = S.p; surfIn.sigma = S.sigma; surfIn.sloshX = S.sloshX.x; surfIn.sloshZ = S.sloshZ.x;
      surfIn.speed = S.speedS; surfIn.stir = inBowl ? clamp(tipV / 0.5, 0, 1) : 0; surfIn.whiskX = tipL.x; surfIn.whiskZ = tipL.z;
      surfIn.omega = S.fluidOm; surfIn.flow = S.flow;
      const slump = 1 - smooth(0, 0.5, S.p);
      surfIn.peakH = Math.max(0, S.peak.x) * slump; const curl = 0.42 + 0.35 * clamp(S.peak.v / 0.3, -1, 1);                 // 先が少しおじぎして揺れる
      surfIn.curlX = S.curlX * curl; surfIn.curlZ = S.curlZ * curl;
      bowl.updateSurface(dt, surfIn);
    }
    // 泡立て器にからんだ泡
    { const cs = smooth(0.5, 1, S.w); mixer.clump.visible = cs > 0.02; if (mixer.clump.visible) mixer.clump.scale.setScalar(0.35 + 0.65 * cs); }
    // 生地の見た目：色・艶・泡の細かさ（1 つの状態値 w から）
    M.batterU.uRep.value = bt.rep0 + bt.rep1 * S.w;
    M.batterU.uFoam.value.x = smooth(0.08, 0.6, S.w);
    M.batter.color.copy(LIQ).lerp(FOAM, smooth(0.05, 0.75, S.w));
    M.batter.roughness = lerp(0.15, 0.75, smooth(0.1, 0.9, S.w));
    M.batter.bumpScale = 0.9 * smooth(0.25, 0.9, S.w);

    // ------------------------------------------------ 台車（load / open）
    if (st === 'load' && live && S.cartMode === 'pour') {
      if (held('ramekin')) S.dragAcc += Math.abs(dpx) + Math.abs(dpy);
      if (tap === 'ramekin' || S.dragAcc > 40) cartGo(path.sIn, ct.loadTime, 'in');
    }
    if (S.cartU < 1) {
      S.cartU = Math.min(1, S.cartU + dt / S.cartDur);
      const s0 = S.cartS; S.cartS = lerp(S.cartFrom, S.cartTo, ease(S.cartU));
      S.tieAcc += Math.abs(S.cartS - s0);
      if (S.tieAcc > 0.076) { S.tieAcc = 0; sound('click', 0.3, 0.6); }    // 枕木を越える音
      if (S.cartU >= 1) {
        const dir = S.cartTo > S.cartFrom ? 1 : -1;
        sound('clack', 0.7, 0.9); S.wobX.v += dir * 0.07; S.sq.v += 0.6;     // 止まると生地がぷるんと揺れる
        if (S.cartMode === 'in') { S.cartMode = 'oven'; if (st === 'load') finishStage(); }
        else if (S.cartMode === 'out') { S.cartMode = 'serve'; if (st === 'open') finishStage(); }
      }
    }
    if (S.cartS !== lastCartS) { cart.place(S.cartS); lastCartS = S.cartS; }
    cart.wiggle.rotation.z = act === 'ramekin' ? wig : 0;

    // ------------------------------------------------ 扉（close / open）
    if (st === 'close' && live) {
      if (held('door')) { S.doorHeld = true; S.dragAcc += dpy; S.doorGoal = clamp(1 - S.dragAcc / 170, 0, 1); if (S.doorGoal < 0.1) S.doorGoal = 0; }
      else if (S.doorHeld) { S.doorHeld = false; S.doorGoal = S.doorGoal < 0.62 ? 0 : 1; S.dragAcc = 0; }
      if (tap === 'door') S.doorGoal = 0;
    }
    if (st === 'open' && live && S.cartMode === 'oven') {
      if (held('door')) { S.doorHeld = true; S.dragAcc -= dpy; S.doorGoal = clamp(S.dragAcc / 170, 0, 1); if (S.doorGoal > 0.9) S.doorGoal = 1; }
      else if (S.doorHeld) { S.doorHeld = false; S.doorGoal = S.doorGoal > 0.38 ? 1 : 0; S.dragAcc = 0; }
      if (tap === 'door') S.doorGoal = 1;
      if (S.doorGoal > 0.05 && !S.doorSnd) { S.doorSnd = true; sound('doorOpen'); }
    }
    {
      const hd = S.doorHeld;
      springTo(S.door, S.doorGoal, hd ? 14 : dr.w0, hd ? 0.9 : dr.zeta, dt);
      if (S.door.x < 0) {                                                   // ばたん → 小さく跳ね返る
        if (S.door.v < -0.3) { sound('door', clamp(-S.door.v / 3, 0.3, 1)); S.sq.v += 0.5; S.wobZ.v -= 0.03; }
        S.door.x = 0; S.door.v = -S.door.v * dr.bounce;
      }
      if (S.door.x > 1) { if (S.door.v > 0.5) sound('clack', clamp(S.door.v / 4, 0.2, 0.7), 0.7); S.door.x = 1; S.door.v = -S.door.v * 0.2; }
      const wd = act === 'door' ? Math.abs(wig) * (st === 'open' ? 1 : -1) : 0;
      oven.door.rotation.x = clamp(S.door.x * dr.open + wd, 0, dr.open);
      if (st === 'close' && live && S.doorGoal === 0 && S.door.x < 0.02 && Math.abs(S.door.v) < 0.25) finishStage();
      if (st === 'open' && live && S.cartMode === 'oven' && S.doorGoal === 1 && S.door.x > 0.93) cartGo(path.sServe, ct.outTime, 'out');
    }

    // ------------------------------------------------ つまみ → 熱 → ふくらみ・焼き色
    const knobbing = st === 'bake' && held('knob');
    if (knobbing) {
      if (input.pressed) { const fa = fingerAngle(oven.knob, input); if (fa !== null) S.knobGoal = S.knob.x + wrapPi(fa - HX - S.knob.x); }
      S.knobGoal += rot;
      if (Math.abs(rot) > 1e-5) S.knobDir = rot > 0 ? 1 : -1;
      S.knobCoast += (rot / Math.max(dt, 1e-3) - S.knobCoast) * Math.min(1, dt * 10);
    } else { S.knobGoal += S.knobCoast * dt; S.knobCoast *= Math.exp(-dt / 0.12); }
    if (st === 'bake' && tap === 'knob') S.knobAuto += ck.tapTurn;
    if (S.knobAuto > 0) { const k = Math.min(S.knobAuto, dt * ck.tapTurn / ck.tapTime); S.knobGoal += k * S.knobDir; S.knobAuto -= k; }
    S.knobGoal = clamp(fin(S.knobGoal, S.knob.x), S.knob.x - 9, S.knob.x + 9); S.knobCoast = clamp(fin(S.knobCoast, 0), -60, 60);
    const k0 = S.knob.x;
    springTo(S.knob, S.knobGoal, kb.w0, kb.zeta, dt);
    const dK = S.knob.x - k0;
    {
      // 30° ごとの「カチッ」：見た目の角度も刻みに少し吸いつく
      const nDet = 360 / kb.clickDeg, th = S.knob.x + (act === 'knob' ? wig : 0);
      oven.knobSpin.rotation.z = th - (0.55 / nDet) * Math.sin(nDet * th);
    }
    if (st === 'bake' && live) {
      S.b = clamp(S.b + Math.abs(dK) / (TAU * kb.turns), 0, 1);            // つまみ 4 回転で b=1
      S.knobClick += Math.abs(dK);
      if (S.knobClick >= kb.clickDeg * DEG) { S.knobClick = 0; sound('click', 0.7, 0.7); }
      const pf = Math.floor(S.b * 4);
      if (pf > S.puffs && pf < 4) { S.puffs = pf; sound('puff', 0.9, 0.9 + 0.1 * pf); S.sq.v -= 0.9; } // ぐんっ、と一息ふくらむ
      if (S.b >= 1) { S.knobAuto = 0; sound('ding'); S.sq.v -= 1.2; finishStage(); }
    }
    {
      const goal = st === 'bake' && live ? clamp(Math.abs(S.knob.v) / 6, 0, 1) : 0;
      S.heat += (goal - S.heat) * Math.min(1, dt * (goal > S.heat ? 6 : 1));   // 止めると 1 秒で冷める
      const gI = (st === 'bake' && live ? 0.2 : 0) + 0.8 * S.heat;
      S.glowI += (gI - S.glowI) * Math.min(1, dt * 5);
      oven.bodyMat.emissiveIntensity = 1.6 * S.glowI;                       // 庫内の壁・ヒーター・ランプ
      M.glass.emissiveIntensity = 0.3 * S.glowI;                            // 窓の橙色
      loops.oven.level = S.heat; loops.oven.rate = 0.8 + 0.6 * S.b;
    }

    // ------------------------------------------------ ぷるぷる（wobble）
    if (st === 'wobble' && tap === 'souffle') {
      // 触った所と反対へ押される
      let wx = 0.7, wz = -0.7;
      if (input.grabPoint) {
        cart.soufflePivot.getWorldPosition(v1);
        const ax = v1.x - input.grabPoint.x, az = v1.z - input.grabPoint.z, al = Math.hypot(ax, az);
        if (al > 1e-4) { wx = ax / al; wz = az / al; }
      }
      const cy = Math.cos(cart.serveYaw), sy = Math.sin(cart.serveYaw);
      S.wobX.v += (wx * cy + wz * sy) * 0.11; S.wobZ.v += (-wx * sy + wz * cy) * 0.11; S.sq.v += 2.2;
      S.taps += 1; sound('wobble', 1, 0.9 + S.taps * 0.08);
      if (S.taps >= 3) finishStage();
    }
    if (act === 'souffle' && wigStart) { S.wobX.v += 0.035; S.sq.v += 0.5; }   // 止まっていたら自分で小さくぷるん
    if (st === 'finale') { S.idleJig += dt; if (S.idleJig > 2.6) { S.idleJig = 0; S.wobZ.v += 0.03; S.sq.v += 0.5; } }
    {
      const w0 = Math.sqrt(sf.wobK), z = sf.wobC / (2 * w0);                // x'' = −k·x − c·x'
      springTo(S.wobX, 0, w0, z, dt); springTo(S.wobZ, 0, w0, z, dt); springTo(S.sq, 0, 17, 0.2, dt);
      S.sq.x = clamp(S.sq.x, -0.2, 0.3);
    }

    // ------------------------------------------------ スプーン（scoop）
    const top = cart.info.top;
    if (st === 'scoop') {
      if (!S.ready) { S.spoonIn = Math.min(1, S.spoonIn + dt / 0.7); if (S.spoonIn >= 1 && live) makeReady(); }
      if (live) {
        if (held('spoon')) S.dGoal = clamp(S.dGoal + Math.max(0, -dpy) / 150, 0, 1);
        if (tap === 'spoon') S.dGoal = clamp(S.dGoal + 0.34, 0, 1);
        S.d += (S.dGoal - S.d) * Math.min(1, dt * 8);
        if (S.d > 0.98 && S.scoopU < 0) { S.d = 1; S.dGoal = 1; S.scoopU = 0; sound('scoop'); S.sq.v -= 0.8; }
      }
    }
    if (S.scoopU >= 0) {
      S.scoopU = Math.min(1, S.scoopU + dt / 1.1);
      if (S.scoopU > 0.4 && st === 'scoop') finishStage();
    }
    if (cart.spoon.visible) {
      const a = ease(S.spoonIn), dE = S.d * S.d * (3 - 2 * S.d), u = S.scoopU < 0 ? 0 : ease(S.scoopU);
      const px = 0.014, py = top - 0.017, pz = 0.018;                       // 押しこんだ位置
      let x = lerp(0.046, px, dE), y = lerp(top + 0.05, py, dE), z = lerp(0.036, pz, dE);
      x += (1 - a) * 0.22; y += (1 - a) * 0.12; z += (1 - a) * 0.06;
      x += 0.05 * u - 0.014 * Math.sin(Math.PI * Math.min(1, u * 2)); y += 0.085 * u; z += 0.07 * u;
      cart.spoon.position.set(x, y, z);
      cart.spoon.rotation.set(0.25 * u, -0.6 - 0.25 * u, lerp(0.62, 0.5, dE) - 0.42 * u);
      cart.spoonWiggle.rotation.z = act === 'spoon' ? wig : 0;
      cart.bite.visible = S.scoopU > 0.06;
      // くぼみ：スプーンの底の丸みがそのまま生地を押す。すくった後は跡が残る
      const cy = Math.cos(cart.serveYaw), sy = Math.sin(cart.serveYaw);
      const dxw = S.scoopU >= 0 ? px : x, dyw = (S.scoopU >= 0 ? py : y) + sf.scoopR - 0.002, dzw = S.scoopU >= 0 ? pz : z;
      S.dentOn = 1; S.dentX = dxw * cy + dzw * sy; S.dentY = dyw; S.dentZ = -dxw * sy + dzw * cy;
      S.inside = S.scoopU < 0 ? 0 : smooth(0, 0.25, S.scoopU);
    }

    // ------------------------------------------------ スフレ（ココットの中）
    sfIn.p = S.p; sfIn.b = S.b; sfIn.pile = S.pile; sfIn.wobX = S.wobX.x; sfIn.wobZ = S.wobZ.x; sfIn.sq = S.sq.x;
    sfIn.dent = S.dentOn; sfIn.dx = S.dentX; sfIn.dy = S.dentY; sfIn.dz = S.dentZ;
    {
      let dirty = false, i = 0;
      for (const k in sfIn) { const v = sfIn[k]; if (!(Math.abs(v - sfLast[i]) < 1e-6)) dirty = true; sfLast[i++] = v; }
      if (dirty) cart.updateSouffle(sfIn);
    }
    {
      const brown = smooth(0.35, 1.0, S.b), U = M.souffleU;                 // 焼き色：生地色 → golden_crust
      U.uBake.value.x = crustTex ? brown : 0;
      const useCrust = !!crustTex && brown > 0.5;
      U.uBake.value.y = useCrust ? 1 : 0;
      const bm = useCrust ? crustTex : M.foamTex; if (M.souffle.bumpMap !== bm) M.souffle.bumpMap = bm;
      M.souffle.bumpScale = useCrust ? 1.5 * smooth(0.5, 0.85, brown) : 0.8 * (1 - smooth(0.15, 0.5, brown));
      M.souffle.roughness = lerp(0.75, 0.88, brown);
      M.souffle.color.copy(FOAM).lerp(PALE, smooth(0.05, 0.5, S.b));
      if (!crustTex) M.souffle.color.lerp(GOLD, brown);                     // テクスチャが届く前でも色は変わる
      U.uScoop.value.set(S.dentX, S.dentY, S.dentZ, S.scoopU >= 0 ? sf.scoopR : 0);
      U.uInside.value.y = S.inside;
    }

    // ------------------------------------------------ 次に触る部品の光（脈動）。触っている間と終了後は消す
    const pulse = 0.5 - 0.5 * Math.cos(S.glowT * TAU / 1.6);
    for (let i = 0; i < targets.length; i++) {
      const id = targets[i].id, mats = glowOf[id], k = id === act && !touching ? 0.35 * pulse : 0;
      for (let j = 0; j < mats.length; j++) { mats[j].emissive.copy(GLOW); mats[j].emissiveIntensity = k; }
    }
    if (act !== 'souffle' && S.cartMode === 'oven') { M.souffle.emissive.copy(HEAT); M.souffle.emissiveIntensity = 0.3 * S.glowI; } // 庫内の熱の色
  }

  // 次の段階へ進んでよいか（前の段階の動きが落ち着いたか）
  function settled() {
    const st = stageName();
    if (st === 'whisk') return S.lift.x > 0.93 && S.peakPhase !== 2;
    if (st === 'pour') return S.tilt.x < 0.06 && !stream.mesh.visible;
    return true;
  }

  function reset() {
    S = fresh();
    bowl.resetSurface(); stream.reset();
    cart.spoon.visible = false; cart.bite.visible = false;
    sfLast.fill(NaN); lastCartS = NaN;
    sfIn.p = 0; sfIn.b = 0; sfIn.dent = 0;
    cart.place(S.cartS); cart.updateSouffle(sfIn);
    M.souffle.bumpMap = M.foamTex;
    startStage(0);
  }
  S = fresh();
  reset();

  const hero = {
    root,
    stages: STAGES.slice(),
    get stage() { return stageName(); },
    get stageIndex() { return S.stageIndex; },
    get progress() {
      switch (stageName()) {
        case 'whisk': return S.w; case 'pour': return S.p; case 'load': return S.cartMode === 'pour' ? 0 : S.cartU;
        case 'close': return 1 - S.door.x; case 'bake': return S.b; case 'open': return S.cartMode === 'serve' ? 1 : S.door.x * 0.5;
        case 'wobble': return S.taps / 3; case 'scoop': return S.d; default: return 1;
      }
    },
    get view() { return VIEW[stageName()]; },
    targets,
    get activeTargetId() { return activeId(); },
    loops,
    update,
    reset,
    onContextRestored() { /* RenderTarget は持たない。頂点・テクスチャは three が次の描画で送り直す */ },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      K.owned.forEach((x) => x.dispose && x.dispose());
      K.owned.length = 0;
    },
    getState() { return { w: S.w, p: S.p, b: S.b, d: S.d, taps: S.taps, door: S.door.x, tilt: S.tilt.x, lift: S.lift.x, slide: S.slide.x, cart: S.cartMode, ready: S.ready }; },
    debugSkip() {
      const st = stageName();
      if (S.done || st === 'finale') return;
      if (st === 'whisk') { S.w = 1; finishStage(); }
      else if (st === 'pour') { S.p = 1; finishStage(); }
      else if (st === 'load') { if (S.cartMode === 'pour') cartGo(path.sIn, ct.loadTime, 'in'); }
      else if (st === 'close') S.doorGoal = 0;
      else if (st === 'bake') { S.b = 1; finishStage(); }
      else if (st === 'open') S.doorGoal = 1;
      else if (st === 'wobble') { S.taps = 3; finishStage(); }
      else if (st === 'scoop') { if (!S.ready) { S.spoonIn = 1; makeReady(); } S.dGoal = 1; }
    },
  };
  return hero;
}
