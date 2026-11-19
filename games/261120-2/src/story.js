// story.js — 場面進行と操作（intro → scoop → wipe → pump → pour → air → back → feed → ending → free）
//
// 公開 API
//   createStory({ engine, world, tw, fx, audio, fishes }) -> story
//     fishes = { wakin:{fish, sw}, sarasa:{fish, sw}, ryukin:{fish, sw} }（fish.group は scene 直下）
//   story.update(dt, t)    毎フレーム（swimmer/world/water より先に呼ぶ）
//   story.stage            今の段階名（文字列）
//   story.targetPoint()    今の主役の world 位置（Vector3, 新規）
//   story.destPoint()      運ぶ先があればその world 位置（Vector3 | null）
//
// 方針: 各段階は「状態から毎フレーム見た目を決める」。時間は update の経過時間で進める（setTimeout は使わない）。
import * as THREE from 'three';
import { L } from './layout.js';
import { murkOrderForZ } from './water.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
const approach = (cur, tgt, maxStep) => (cur < tgt ? Math.min(tgt, cur + maxStep) : Math.max(tgt, cur - maxStep));
const ORDER = ['wakin', 'sarasa', 'ryukin'];
const STAGES = ['intro', 'scoop', 'wipe', 'pump', 'pour', 'air', 'back', 'feed', 'ending', 'free'];
const sIdx = (s) => STAGES.indexOf(s);

const T = L.tank;
const RIM = T.h;
const FULL = T.waterFull, LOW = T.waterLow;
const IN = { x0: T.minX + T.glass, x1: T.maxX - T.glass, z0: T.minZ + T.glass, z1: T.maxZ - T.glass };
const NZ = 0.025;              // scoop 中のあみの面（前面ガラス寄り）
const CARRY_TRAVEL = 0.11;     // 魚を入れたあみ: 指をこれだけ下へ動かすと鉢の上
const MURK_SHOW = 0.84;        // 最初のにごり（論理値 1）の見え方
const MURK_MID = 0.32;         // pour 後
const showMurk = (m) => (m <= MURK_MID ? m : MURK_MID + (m - MURK_MID) * (MURK_SHOW - MURK_MID) / (1 - MURK_MID));
const ORDER_OUT_TANK = 40;     // 水槽の中だが水の外（にごり・水面・コケより後、前面ガラスより前）
const ORDER_OUTSIDE = 49;      // 水槽の外（前面ガラスより後、鉢より前）

export function createStory({ engine, world, tw, fx, audio, fishes }) {
  const { camera } = engine;
  const input = engine.input;
  const P = world.props;
  const ghost = engine.ghost;
  const pk = () => clamp((engine.quality.particleBudget || 800) / 800, 0.3, 1);

  // ---------- 状態（残るもの） ----------
  const st = {
    level: FULL, murk: 1, pail: 0, pitcher: 1, airOn: false, cleared: false, fed: 0, done: false,
    peeked: false, bowlWater: 1,
  };

  // ---------- 小道具 ----------
  const _a = V(), _b = V(), _c = V(), _d = V(), _e = V();
  const _s2 = new THREE.Vector2();
  const ZN = V(0, 0, 1), YN = V(0, 1, 0);
  function wpp(pos) {
    const d = Math.max(0.05, camera.position.distanceTo(pos));
    return (2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, engine.size.h);
  }
  // 画面上の距離で判定（半径 r m の球、最小 minPx）。当たれば距離 px、外れたら -1
  function hitScreen(px, py, pos, r, minPx = 46) {
    engine.project(pos, _s2);
    const d = Math.hypot(px - _s2.x, py - _s2.y);
    return d <= Math.max(minPx, r / wpp(pos)) ? d : -1;
  }
  function screenDist(px, py, pos) { engine.project(pos, _s2); return Math.hypot(px - _s2.x, py - _s2.y); }
  function frontGlassHit(ray, out, yMax = RIM) {
    const h = engine.rayPlane(ray, _e.set(0, 0, T.maxZ), ZN, out);
    if (!h) return null;
    if (h.x < T.minX - 0.01 || h.x > T.maxX + 0.01 || h.y < 0.01 || h.y > yMax + 0.01) return null;
    return h;
  }
  const inTankXZ = (p, m = 0) => p.x > IN.x0 + m && p.x < IN.x1 - m && p.z > IN.z0 + m && p.z < IN.z1 - m;
  const bezier = (a, b, c, t, out) => {
    const u = 1 - t;
    return out.set(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z);
  };
  // 持ち上げて水槽の上へ運ぶ面: 手前の縦の面 → 高さ Y1 の水平面 → 奥の縦の面（どれも指の下に来る）
  function carryMap(ray, c, out) {
    const h = engine.rayPlane(ray, _e.set(0, 0, c.homeZ), ZN, _a);
    if (h && h.y <= c.Y1) {
      out.set(clamp(h.x, c.xMin, c.xMax), Math.max(h.y, c.yRest), c.homeZ);
      return 0.5 * clamp((out.y - c.yRest) / (c.Y1 - c.yRest), 0, 1);
    }
    if (ray.direction.y < -1e-4) {
      const g = engine.rayPlane(ray, _e.set(0, c.Y1, 0), YN, _a);
      if (g && g.z >= c.zMin && g.z <= c.homeZ + 0.001) {
        out.set(clamp(g.x, c.xMin, c.xMax), c.Y1, g.z);
        return 0.5 + 0.5 * (c.homeZ - g.z) / (c.homeZ - c.zMin);
      }
    }
    const v = engine.rayPlane(ray, _e.set(0, 0, c.zMin), ZN, _a);
    if (v) { out.set(clamp(v.x, c.xMin, c.xMax), clamp(v.y, c.Y1, c.yMax), c.zMin); return 1; }
    return -1;
  }
  // 折れ線に沿って戻る
  function makeMover(pts, speed = 0.55) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += pts[i].distanceTo(pts[i - 1]);
    return { pts, total: Math.max(total, 1e-4), d: 0, speed };
  }
  function stepMover(m, dt, out) {
    m.d = Math.min(m.total, m.d + m.speed * dt);
    let d = m.d;
    for (let i = 1; i < m.pts.length; i++) {
      const l = m.pts[i].distanceTo(m.pts[i - 1]);
      if (d <= l || i === m.pts.length - 1) { out.copy(m.pts[i - 1]).lerp(m.pts[i], l > 0 ? clamp(d / l, 0, 1) : 1); break; }
      d -= l;
    }
    return m.d >= m.total;
  }
  function homePath(from, home, yClear) {
    const pts = [from.clone()];
    if (Math.hypot(from.x - home.x, from.z - home.z) > 0.015) {
      const y = Math.max(from.y, yClear);
      pts.push(V(from.x, y, from.z), V(home.x, y, home.z));
    }
    pts.push(home.clone());
    return pts;
  }

  // ---------- 魚 ----------
  const F = {};
  for (const k of ORDER) {
    const { fish, sw } = fishes[k];
    F[k] = { k, fish, sw, loc: 'tank', anim: null, tapT: 0, tapP: V(), yaw: 0, pitch: 0, offs: V(), seekT: 0, seekP: V() };
  }
  const allF = () => ORDER.map((k) => F[k]);
  function hold(f) { if (f.sw.mode !== 'held') { f.yaw = f.sw.heading; f.sw.mode = 'held'; } }
  function release(f, mode = 'wander') {
    f.sw.teleport(f.fish.group.position);
    f.sw.setHeading(f.yaw);
    f.sw.mode = mode;
    f.anim = null;
    f.fish.setSquash(0);
  }
  function placeHeld(f, pos, yaw, pitch = 0, roll = 0) {
    f.fish.group.position.copy(pos);
    f.yaw = yaw; f.pitch = pitch;
    f.fish.group.rotation.set(roll, yaw, pitch, 'YZX');
  }
  let lastBoundsLevel = -1;
  function tankBounds() {
    return { min: V(L.swim.minX, L.swim.minY, L.swim.minZ), max: V(L.swim.maxX, Math.max(L.swim.minY + 0.01, st.level - 0.02), L.swim.maxZ) };
  }
  function bowlCenter(out) { return out.copy(P.bowl.group.position).add(_e.set(0, P.bowl.inner.centerY, 0)); }
  function toBowlBounds(f) { f.sw.setSphereBounds(bowlCenter(_d), P.bowl.inner.radius, P.bowl.waterSurfaceY() - 0.012); }
  function putInTank(f, pos, mode = 'wander') {
    f.loc = 'tank';
    f.sw.setBounds(tankBounds());
    f.sw.teleport(pos);
    f.sw.mode = mode;
    f.fish.finOrder = null;
  }
  function putInBowl(f, pos) {
    f.loc = 'bowl';
    toBowlBounds(f);
    f.sw.teleport(pos);
    f.sw.mode = 'wander';
    f.sw.speed = 0.6;
  }
  function want(f, mode, target, speed = 1) {
    if (f.sw.mode === 'held' || f.anim) return;
    f.sw.mode = mode;
    if (target) f.sw.target.copy(target);
    f.sw.speed = speed;
  }
  function tankFish() { return allF().filter((f) => f.loc === 'tank' && !f.anim); }
  function bowlFish() { return allF().filter((f) => f.loc === 'bowl' && !f.anim); }

  // ---------- 入力 ----------
  const ptr = { down: false, x: 0, y: 0, px: 0, py: 0, vpx: 0, ray: new THREE.Ray(), t0: 0 };
  let time = 0, stage = 'intro', stageT = 0, busy = 0;
  let S = {}; // 段階ごとの一時状態

  // ---------- 音の持続 ----------
  const loops = { wipe: [0, 1], flow: [0, 1], drain: [0, 1], pour: [0, 1] };
  const setLoop = (n, g, p = 1) => { loops[n][0] = Math.max(loops[n][0], g); loops[n][1] = p; };

  // ---------- 保存 ----------
  function moved() { return ORDER.filter((k) => F[k].loc === 'bowl' || F[k].loc === 'drop'); }
  function save() {
    if (sIdx(stage) >= sIdx('ending') && !st.done) return;
    engine.save.write({
      v: 1, stage: stage === 'intro' ? 'scoop' : stage, moved: moved(), algae: tw.algae.serialize(), level: st.level, murk: st.murk,
      pail: st.pail, pitcher: st.pitcher, airOn: st.airOn, cleared: st.cleared, fed: st.fed, done: st.done,
    });
  }

  // ---------- 道具の基本姿勢 ----------
  const net = P.net, bowl = P.bowl, sponge = P.sponge, pitcher = P.pitcher, pump = P.pump, can = P.foodCan, air = P.airPump;
  const NET_HOME = net.home.clone();
  const SP_HOME = sponge.home.clone();
  const SP_REST_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.12, 0));
  const PI_HOME = pitcher.home.clone(), BW_HOME = bowl.home.clone(), FC_HOME = can.home.clone();

  const NETS = { pos: NET_HOME.clone(), tgt: NET_HOME.clone(), p0: NET_HOME.clone(), rotY: L.net.rotY, rotZ: 0, bendZ: 0, bendX: 0,
    grabbed: false, mode: 'home', s: 0, vx: NET_HOME.x, vy: NET_HOME.y, off: V(), reanchor: false, wet: 0, sag: 0, inWater: false, mover: null, prev: NET_HOME.clone(), vel: V(), assist: false, hop: 0 };
  const SPS = { pos: SP_HOME.clone(), tgt: SP_HOME.clone(), stand: 0, mode: 'rest', last: null, vx: 0, speed: 0, mover: null, squash: 0, prev: SP_HOME.clone(), settle: 0 };
  const PIS = { pos: PI_HOME.clone(), tgt: PI_HOME.clone(), mode: 'rest', tilt: 0, u: 0, mover: null, prev: PI_HOME.clone(), vel: V(), settle: 0, landAcc: 0, swirlAcc: 0 };
  const BWS = { pos: BW_HOME.clone(), tgt: BW_HOME.clone(), mode: 'rest', tilt: 0, rotY: 0, u: 0, mover: null, prev: BW_HOME.clone(), vel: V(), settle: 0, shake: 0 };
  const FCS = { pos: FC_HOME.clone(), tgt: FC_HOME.clone(), mode: 'rest', tilt: 0, u: 0, mover: null, prev: FC_HOME.clone(), vel: V(), settle: 0, acc: 0, shakeCD: 0, soundCD: 0 };
  const PUMP = { sq: 0, sqv: 0, down: false, holdT: 0, presses: 0, siphon: false, pulse: 0, levelT: FULL, rippleAcc: 0, finished: false };
  const AIR = { press: 0, down: false };

  const CFG_PI = { homeZ: PI_HOME.z, yRest: 0.09, Y1: 0.36, zMin: -0.03, yMax: 0.5, xMin: -0.08, xMax: 0.25 };
  const CFG_BW = { homeZ: BW_HOME.z, yRest: 0.08, Y1: 0.355, zMin: 0.095, yMax: 0.42, xMin: -0.12, xMax: 0.12 };
  const CFG_FC = { homeZ: FC_HOME.z, yRest: 0.04, Y1: 0.31, zMin: 0.0, yMax: 0.45, xMin: -0.33, xMax: 0.15 };

  // ---------- hint ----------
  const hint = { pinged: false, ghostOn: false, hop: 0 };

  // ============================== 段階 ==============================
  function go(name) {
    stage = name; stageT = 0; busy = name === 'intro' ? 0 : 0.9;
    S = {};
    ghost.stop(); hint.ghostOn = false; hint.pinged = false;
    input.poke();
    const fr = { intro: 'wipe', scoop: 'whole', wipe: 'wipe', pump: 'pump', pour: 'pour', air: 'air', back: 'pour', feed: 'feed', ending: 'ending', free: 'feed' }[name];
    engine.setFrame(L.frames[fr], { duration: name === 'intro' ? 0 : name === 'free' ? 2.5 : 1.2, immediate: name === 'intro' });
    if (name === 'intro') engine.setFrame(L.frames.whole, { duration: 3.2 });
    if (name === 'ending') {
      st.done = true;
      audio.music.playEnding();
      tw.sparkle(1.6);
    }
    if (name !== 'intro') save();
  }
  const chime = () => audio.play('chime', { gain: 0.8 });

  // ---------- intro ----------
  function introUpdate(dt) {
    const wk = F.wakin;
    if (stageT > 0.9 && stageT < 3.2) want(wk, 'seek', _a.set(-0.02, 0.13, 0.04), 1.3);
    if (stageT > 2.3 && !S.knock) {
      S.knock = true;
      audio.play('tapGlass', { gain: 0.45, pitch: 0.9 });
      wk.fish.mouth.getWorldPosition(_b);
      tw.bubbles.emit(_b, 1, { size: 0.004, spread: 0.002 });
      audio.play('bubble', { gain: 0.6, delay: 0.15 });
    }
    if (stageT > 3.4) go('scoop');
  }

  // ---------- scoop ----------
  function nextScoopFish() { for (const k of ORDER) if (F[k].loc === 'tank' || F[k].loc === 'pot') return F[k]; return null; }
  function fishInNet() { return allF().find((f) => f.loc === 'net') || null; }
  const BOWL_DROP = () => { bowl.mouth.getWorldPosition(_c); return _c.set(_c.x, _c.y + 0.075, _c.z); };

  function netHit(p) {
    if (hitScreen(p.x, p.y, NETS.pos, 0.09, 50) >= 0) return true;
    const h = frontGlassHit(p.ray, _b, st.level);
    return !!h;
  }
  function scoopDown(p) {
    if (NETS.mode === 'return') return false;
    if (!fishInNet() && !netHit(p)) return false; // 魚を運んでいる間はどこを触っても続きができる
    if (NETS.mode === 'home') { NETS.vx = NETS.pos.x; NETS.vy = NETS.pos.y; }
    NETS.grabbed = true; NETS.assist = false; NETS.mode = 'free'; NETS.reanchor = true;
    audio.play('pickUp', { gain: 0.7 });
    return true;
  }
  function scoopUp() {
    if (!NETS.grabbed) return;
    NETS.grabbed = false;
    if (fishInNet()) NETS.assist = true;
  }
  // 指 → あみの「仮の位置」(vx, vy)。魚を運ぶ間は相対ドラッグ（つかみ直しで跳ばない）
  function netPointer(f) {
    const h = engine.rayPlane(ptr.ray, _e.set(0, 0, NZ), ZN, _b);
    if (!h) return;
    if (f) {
      if (NETS.reanchor) { NETS.off.set(h.x - NETS.vx, h.y - NETS.vy, 0); NETS.reanchor = false; }
      NETS.vx = clamp(h.x - NETS.off.x, -0.15, 0.12);
      NETS.vy = clamp(h.y - NETS.off.y, st.level + 0.04 - CARRY_TRAVEL - 0.02, RIM + 0.14);
    } else {
      NETS.vx = clamp(h.x, -0.15, 0.12);
      NETS.vy = clamp(h.y, T.gravelH + 0.062, RIM + 0.12);
    }
  }
  function updateNet(dt) {
    const f = fishInNet();
    const heavy = f && f.k === 'ryukin';
    const B = BOWL_DROP().clone();
    if (NETS.mode === 'return') {
      const done = stepMover(NETS.mover, dt, NETS.tgt);
      if (done && NETS.pos.distanceTo(NET_HOME) < 0.003) { NETS.mode = 'home'; NETS.pos.copy(NET_HOME); audio.play('setDown', { gain: 0.5, pitch: 1.2 }); }
    } else if (NETS.mode === 'free') {
      if (NETS.grabbed) netPointer(f);
      const lockY = st.level + 0.04;
      // 魚を入れたら: 指を下へ動かした分だけ、あみがフチを越えて鉢へ向かう（離せば自動で鉢まで）
      let sT = 0;
      if (f) sT = NETS.assist ? 1 : clamp((lockY - NETS.vy) / CARRY_TRAVEL, 0, 1);
      NETS.s = approach(NETS.s, sT, dt * (f ? (NETS.assist ? 0.9 : 2.2) : 1.1));
      if (!NETS.grabbed && !f && NETS.s < 0.01 && NETS.vy > st.level - 0.03) NETS.vy = approach(NETS.vy, st.level - 0.035, dt * 0.12);
      const p0 = _d.set(NETS.vx, f ? Math.max(NETS.vy, lockY) : NETS.vy, NZ);
      if (NETS.s > 0.001) {
        const c1 = _b.set((p0.x + B.x) / 2, 0.48, 0.09);
        bezier(p0, c1, B, sstep(0, 1, NETS.s), NETS.tgt);
      } else NETS.tgt.copy(p0);
    } else NETS.tgt.copy(NET_HOME);

    // 追従（重いとゆっくり）
    const rate = NETS.mode === 'free' ? (heavy ? 6 : f ? 10 : 15) : 12;
    NETS.prev.copy(NETS.pos);
    NETS.pos.x = damp(NETS.pos.x, NETS.tgt.x, rate, dt);
    NETS.pos.y = damp(NETS.pos.y, NETS.tgt.y, rate, dt);
    NETS.pos.z = damp(NETS.pos.z, NETS.tgt.z, rate, dt);
    if (dt > 0) NETS.vel.subVectors(NETS.pos, NETS.prev).divideScalar(dt);

    // 柄の角度: 左ガラスを越えるように持ち上げる
    let elevAdd = 0;
    const inside = NETS.pos.z < T.maxZ - 0.02 && inTankXZ(NETS.pos, -0.05);
    if (NETS.mode !== 'home' && inside) {
      const dx = NETS.pos.x - L.net.hoopR - (T.minX - 0.003);
      const rise = RIM + 0.02 - NETS.pos.y;
      if (rise > 0 && dx > 0.001) elevAdd = clamp(Math.atan2(rise, dx) - 35 * Math.PI / 180, 0, 0.75);
      else if (rise > 0) elevAdd = 0.75;
    }
    NETS.rotZ = damp(NETS.rotZ, elevAdd, 10, dt);
    const bendT = clamp(-NETS.vel.y * (heavy ? 0.9 : 0.4), -0.22, 0.22) + (heavy ? 0.06 : 0);
    NETS.bendZ = damp(NETS.bendZ, bendT, 8, dt);
    NETS.bendX = damp(NETS.bendX, clamp(NETS.vel.z * 0.5, -0.15, 0.15), 8, dt);
    const g = net.group;
    g.position.copy(NETS.pos);
    if (NETS.mode === 'home') g.position.y += hint.hop * 0.012 * (stage === 'scoop' || stage === 'intro' ? 1 : 0);
    g.rotation.set(NETS.bendX, NETS.rotY, NETS.rotZ + NETS.bendZ + (NETS.mode === 'home' ? hint.hop * 0.08 : 0));
    g.updateMatrixWorld(true);

    // 袋・濡れ
    NETS.sag = damp(NETS.sag, f ? (heavy ? 1 : 0.45) : 0, 6, dt);
    net.setSag(NETS.sag);
    const inWater = inTankXZ(NETS.pos) && NETS.pos.y < st.level;
    if (inWater !== NETS.inWater && NETS.mode !== 'home') {
      audio.play('netSwish', { gain: heavy ? 1 : 0.7, pitch: heavy ? 0.85 : 1 });
      tw.ripple(NETS.pos.x, NETS.pos.z, heavy ? 1.6 : 1);
      if (!inWater) {
        fx.drips(net.bagBottom, f ? (heavy ? 14 : 7) : 3, st.level);
        if (f) fx.splash(_a.set(NETS.pos.x, st.level, NETS.pos.z), heavy ? 0.8 : 0.4, 0xd8e6c8);
      }
    }
    NETS.inWater = inWater;
    if (inWater) NETS.wet = 1; else NETS.wet = Math.max(0, NETS.wet - dt * 0.04);
    net.setWet(NETS.wet);

    // 袋の描画順
    net.bagBottom.getWorldPosition(_a);
    const bagIn = inTankXZ(_a) && _a.y < st.level + 0.01;
    net.bag.renderOrder = bagIn ? murkOrderForZ(_a.z) : (inTankXZ(NETS.pos) && NETS.pos.y < RIM + 0.02 ? ORDER_OUT_TANK + 0.5 : 50);
  }
  function scoopUpdate(dt) {
    updateNet(dt);
    const f = fishInNet();
    // 魚が寄ってくる
    const cur = nextScoopFish();
    const hoop = NETS.pos;
    const netWet = !f && NETS.mode === 'free' && NETS.inWater;
    if (cur && cur.loc === 'tank' && !cur.anim) {
      if (cur.k !== 'ryukin') {
        if (netWet) want(cur, 'seek', _a.set(hoop.x, hoop.y - 0.004, hoop.z), 0.9);
      } else {
        const d = cur.sw.position.distanceTo(hoop);
        if (netWet && d < 0.17) want(cur, 'seek', _a.set(hoop.x, hoop.y - 0.004, hoop.z), 0.6);
        else want(cur, 'watch', hoop, 1);
      }
      if (netWet && cur.sw.position.distanceTo(hoop) < 0.05) {
        // すぽっ
        hold(cur);
        cur.loc = 'net';
        cur.anim = { type: 'toNet', t: 0, from: cur.fish.group.position.clone() };
        audio.play('netSwish', { gain: 0.5, pitch: 1.35 });
        audio.play('bubble', { gain: 0.5, pitch: 1.2, delay: 0.05 });
        tw.bubbles.emit(_a.copy(hoop), Math.round(5 * pk()), { size: 0.003, spread: 0.012 });
        NETS.vx = clamp(hoop.x, -0.15, 0.12); NETS.vy = st.level + 0.06; NETS.reanchor = true; // すくったら水面の上へ
      }
    }
    // 琉金が顔を出す
    if (F.ryukin.loc === 'pot' && F.wakin.loc === 'bowl' && F.sarasa.loc === 'bowl' && !F.ryukin.anim) {
      F.ryukin.anim = { type: 'backout', t: 0 };
    }
    // 鉢の口の上で ちゃぽん
    if (f && f.anim && f.anim.type === 'inNet' && NETS.s > 0.9) {
      bowl.mouth.getWorldPosition(_a);
      if (Math.hypot(NETS.pos.x - _a.x, NETS.pos.z - _a.z) < 0.07 && NETS.pos.y > _a.y) {
        f.loc = 'drop';
        f.anim = { type: 'drop', t: 0, vy: 0, splashed: false };
        NETS.assist = false;
        save();
      }
    }
    // 3 びき目が入ったら あみを戻す
    if (!S.allIn && ORDER.every((k) => F[k].loc === 'bowl')) {
      S.allIn = true; S.allInT = stageT;
      chime();
    }
    if (S.allIn && NETS.mode === 'free' && stageT - S.allInT > 0.5) {
      NETS.grabbed = false; NETS.assist = false;
      NETS.mode = 'return';
      NETS.mover = makeMover(homePath(NETS.pos.clone(), NET_HOME, 0.36), 0.5);
      NETS.s = 0;
    }
    if (S.allIn && NETS.mode === 'home' && NETS.rotZ < 0.02) go('wipe');
    // 鉢の魚は ふつうに泳ぐ
    for (const b of bowlFish()) want(b, 'wander', null, 0.6);
  }
  function scoopTarget() {
    if (S.allIn) return { pos: NETS.pos.clone(), r: 0.07, hl: {} };
    const f = fishInNet();
    if (f) return { pos: NETS.pos.clone(), r: 0.07, hl: { net: 0.3 }, dest: { pos: BOWL_DROP().clone().setY(bowl.mouth.getWorldPosition(_a).y + 0.02), r: 0.075 }, hlDest: { bowl: 0.6 } };
    return { pos: NETS.pos.clone(), r: 0.075, hl: { net: 1 } };
  }
  function scoopGhost() {
    const f = fishInNet();
    if (f) {
      bowl.mouth.getWorldPosition(_a);
      return { pts: [NETS.pos.clone(), V((NETS.pos.x + _a.x) / 2, 0.36, 0.08), _a.clone().setY(_a.y + 0.06)], opts: { duration: 2.0 } };
    }
    return { pts: [NETS.pos.clone(), V(-0.06, 0.2, NZ), V(0.0, 0.13, NZ)], opts: { duration: 2.0 } };
  }

  // ---------- wipe ----------
  const SP_Z = T.maxZ + L.sponge.h / 2 + 0.001;
  function wipeDown(p) {
    if (SPS.mode === 'return' || S.done) return false;
    const onSp = hitScreen(p.x, p.y, SPS.pos, 0.08, 50) >= 0;
    const onGlass = frontGlassHit(p.ray, _b, RIM);
    if (!onSp && !onGlass) return false;
    SPS.mode = 'drag'; SPS.last = null;
    audio.play('pickUp', { gain: 0.6, pitch: 1.1 });
    return true;
  }
  function wipeUp() {
    if (SPS.mode !== 'drag') return;
    if (S.done) startSpongeReturn();
    else SPS.mode = SPS.stand > 0.5 ? 'stuck' : 'rest';
  }
  function startSpongeReturn() {
    SPS.mode = 'return';
    const from = SPS.pos.clone();
    SPS.mover = makeMover([from, V(from.x, from.y, from.z + 0.05), V(lerp(from.x, SP_HOME.x, 0.6), 0.06, SP_HOME.z), SP_HOME.clone()], 0.5);
  }
  function wipeUpdate(dt) {
    const sp = sponge.group;
    if (SPS.mode === 'drag') {
      const h = engine.rayPlane(ptr.ray, _e.set(0, 0, SP_Z), ZN, _a);
      if (h) SPS.tgt.set(clamp(h.x, T.minX + 0.044, T.maxX - 0.044), clamp(h.y, 0.035, RIM - 0.028), SP_Z);
      SPS.stand = approach(SPS.stand, 1, dt * 6);
    } else if (SPS.mode === 'return') {
      const done = stepMover(SPS.mover, dt, SPS.tgt);
      SPS.stand = SPS.tgt.z > SP_Z + 0.03 ? approach(SPS.stand, 0, dt * 3) : SPS.stand;
      if (done && SPS.pos.distanceTo(SP_HOME) < 0.003) { SPS.mode = 'home'; SPS.stand = 0; audio.play('setDown', { gain: 0.6 }); SPS.settle = 0.15; }
    } else if (SPS.mode === 'rest' || SPS.mode === 'home') {
      SPS.tgt.copy(SP_HOME); SPS.stand = approach(SPS.stand, 0, dt * 4);
    }
    SPS.prev.copy(SPS.pos);
    const rate = SPS.mode === 'drag' ? (SPS.stand < 0.9 ? 12 : 22) : 12;
    SPS.pos.x = damp(SPS.pos.x, SPS.tgt.x, rate, dt);
    SPS.pos.y = damp(SPS.pos.y, SPS.tgt.y, rate, dt);
    SPS.pos.z = damp(SPS.pos.z, SPS.tgt.z, rate, dt);
    // 立ち上がる途中でガラスにめり込まない
    if (SPS.pos.z < SP_Z) SPS.pos.z = SP_Z;
    const vx = dt > 0 ? (SPS.pos.x - SPS.prev.x) / dt : 0, vy = dt > 0 ? (SPS.pos.y - SPS.prev.y) / dt : 0;
    const spd = Math.hypot(vx, vy);
    SPS.speed = damp(SPS.speed, spd, 10, dt);
    SPS.vx = damp(SPS.vx, vx, 8, dt);
    // ふく
    const onGlass = SPS.mode === 'drag' && SPS.stand > 0.85 && SPS.pos.z < SP_Z + 0.004;
    if (onGlass && !S.done) {
      const cur = SPS.pos.clone();
      if (!SPS.last) SPS.last = cur.clone();
      const d = cur.distanceTo(SPS.last);
      const n = Math.max(1, Math.ceil(d / 0.008));
      for (let i = 1; i <= n; i++) tw.algae.wipeAt(_a.copy(SPS.last).lerp(cur, i / n), 0.036, 1);
      SPS.last.copy(cur);
      const k = clamp(SPS.speed / 0.35, 0, 1);
      setLoop('wipe', k * 0.9, 0.8 + 0.8 * k);
    } else SPS.last = null;
    // 姿勢
    const tiltZ = clamp(-SPS.vx * 0.9, -0.35, 0.35);
    const qStand = _q1.setFromEuler(_eu.set(-Math.PI / 2, 0, 0));
    _q2.setFromAxisAngle(ZN, tiltZ);
    qStand.premultiply(_q2);
    sp.quaternion.copy(SP_REST_Q).slerp(qStand, sstep(0, 1, SPS.stand));
    SPS.squash = damp(SPS.squash, onGlass ? 0.12 + 0.1 * clamp(SPS.speed / 0.3, 0, 1) : 0, 12, dt);
    sp.scale.set(1 + SPS.squash * 0.3, 1 - SPS.squash, 1 + SPS.squash * 0.2);
    sp.position.copy(SPS.pos);
    if (SPS.stand > 0.5) sp.position.z = SPS.pos.z - (L.sponge.h / 2) * SPS.squash;
    if (SPS.settle > 0) { SPS.settle -= dt; sp.position.y -= 0.002 * Math.sin(Math.PI * clamp(1 - SPS.settle / 0.15, 0, 1)); }
    if ((SPS.mode === 'rest' || SPS.mode === 'stuck') && !S.done) sp.position.y += hint.hop * 0.01;

    // 鉢の魚がスポンジを見る
    for (const b of bowlFish()) want(b, SPS.mode === 'drag' || SPS.mode === 'stuck' ? 'watch' : 'wander', SPS.pos, 0.6);
    // おわり
    if (!S.done && tw.algae.coverage() < 0.12) {
      S.done = true; S.doneT = stageT;
      tw.algae.clearAll(0.8);
      chime();
      save();
      if (SPS.mode !== 'drag') startSpongeReturn();
    }
    if (S.done && SPS.mode === 'stuck') startSpongeReturn();
    if (S.done && SPS.mode === 'home' && stageT - S.doneT > 0.8) go('pump');
  }
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _eu = new THREE.Euler();
  function wipeTarget() { return { pos: SPS.mode === 'drag' ? SPS.pos.clone() : SPS.pos.clone(), r: 0.07, hl: { sponge: 1 } }; }
  function wipeGhost() {
    const z = SP_Z;
    return { pts: [SPS.pos.clone(), V(-0.12, 0.19, z), V(0.11, 0.165, z), V(-0.1, 0.12, z), V(0.12, 0.09, z)], opts: { duration: 2.4 } };
  }

  // ---------- pump ----------
  const STEP = (FULL - LOW) / 7;
  const SIPHON_RATE = (4 * STEP) / 12;
  function pumpDown(p) {
    if (PUMP.finished) return false;
    if (hitScreen(p.x, p.y, pump.bulbCenter, 0.085, 52) < 0) return false;
    PUMP.down = true; PUMP.holdT = 0.06;
    PUMP.presses++;
    audio.play('squish', { gain: 0.9, pitch: 0.95 + Math.random() * 0.1 });
    audio.play('gurgle', { gain: 0.7, delay: 0.22 });
    PUMP.levelT = Math.max(LOW, PUMP.levelT - STEP);
    PUMP.pulse = 1.1;
    if (PUMP.presses >= 3) PUMP.siphon = true;
    bowlCenter(_a);
    for (const b of bowlFish()) b.sw.startle(_b.copy(_a).add(_c.set(0.06, 0, 0)), 0.35);
    return true;
  }
  function pumpUp() { PUMP.down = false; }
  function pumpUpdate(dt) {
    // じゃばら
    if (PUMP.down || PUMP.holdT > 0) { PUMP.sq = approach(PUMP.sq, 1, dt / 0.06); PUMP.sqv = 0; PUMP.holdT -= dt; }
    else { PUMP.sqv += (-260 * PUMP.sq - 20 * PUMP.sqv) * dt; PUMP.sq += PUMP.sqv * dt; if (PUMP.sq < -0.08) { PUMP.sq = -0.08; PUMP.sqv = 0; } }
    pump.squeeze(Math.max(0, PUMP.sq) + (PUMP.presses === 0 ? hint.hop * 0.25 : hint.hop * 0.25));
    // 水位
    if (PUMP.siphon) PUMP.levelT = Math.max(LOW, PUMP.levelT - SIPHON_RATE * dt);
    const prevLevel = st.level;
    st.level = approach(st.level, PUMP.levelT, dt * 0.035);
    tw.setLevel(st.level);
    const draining = st.level > LOW + 0.0003 && (st.level < prevLevel - 1e-7 || PUMP.pulse > 0);
    PUMP.pulse = Math.max(0, PUMP.pulse - dt);
    let flow = 0;
    if (st.level > LOW + 0.0003) flow = Math.max(PUMP.pulse > 0 ? 0.45 + 0.55 * PUMP.pulse / 1.1 : 0, PUMP.siphon ? 0.4 : 0);
    if (!draining) flow = Math.min(flow, PUMP.pulse > 0 ? flow : 0);
    pump.setFlow(flow);
    st.pail = 0.9 * clamp((FULL - st.level) / (FULL - LOW), 0, 1);
    P.pail.setFill(st.pail, 0x6f8a3c);
    if (flow > 0.02) {
      fx.stream.set('hose', pump.hoseEnd, P.pail.waterY(), { width: 0.0035 + 0.003 * flow, colorHex: 0x93a35c, opacity: 0.75 });
      setLoop('flow', 0.4 + 0.5 * flow, 0.8 + 0.4 * flow);
      setLoop('drain', 0.35 + 0.55 * flow, 1);
      PUMP.rippleAcc += dt;
      if (PUMP.rippleAcc > 0.45) { PUMP.rippleAcc = 0; tw.ripple(L.pump.x - 0.006, L.pump.z, 0.35); }
    } else fx.stream.set('hose', null);
    if (!PUMP.finished && st.level <= LOW + 0.0003) {
      PUMP.finished = true; S.endT = stageT;
      audio.play('gurgle', { gain: 0.9, pitch: 0.85 });
      fx.stream.set('hose', null);
      chime();
      save();
    }
    if (PUMP.finished && stageT - S.endT > 1.4) go('pour');
    for (const b of bowlFish()) want(b, 'wander', null, 0.6);
  }
  function pumpTarget() { return { pos: pump.bulbCenter.clone(), r: 0.06, hl: { pump: PUMP.finished ? 0 : 1 } }; }
  function pumpGhost() { return { pts: [pump.bulbCenter.clone()], opts: { tap: true } }; }

  // ---------- 持ち上げる道具の共通 ----------
  function liftFollow(o, rate, dt) {
    o.prev.copy(o.pos);
    o.pos.x = damp(o.pos.x, o.tgt.x, rate, dt);
    o.pos.y = damp(o.pos.y, o.tgt.y, rate, dt);
    o.pos.z = damp(o.pos.z, o.tgt.z, rate, dt);
    if (dt > 0) { _a.subVectors(o.pos, o.prev).divideScalar(dt); o.vel.lerp(_a, 1 - Math.exp(-dt * 10)); }
  }
  function startReturn(o, home, yClear, speed = 0.6) {
    o.mode = 'return';
    o.mover = makeMover(homePath(o.pos.clone(), home, yClear), speed);
  }
  function stepReturn(o, home, dt) {
    const done = stepMover(o.mover, dt, o.tgt);
    if (done && o.pos.distanceTo(home) < 0.002) {
      o.mode = 'rest'; o.pos.copy(home); o.tgt.copy(home); o.settle = 0.16;
      audio.play('setDown', { gain: 0.75 });
      return true;
    }
    return false;
  }
  const settleY = (o, dt) => { if (o.settle > 0) { o.settle -= dt; return -0.0025 * Math.sin(Math.PI * clamp(1 - o.settle / 0.16, 0, 1)); } return 0; };

  // ---------- pour ----------
  const PI_GRAB = 0.09;
  function pourDown(p) {
    if (S.done) return false;
    if (hitScreen(p.x, p.y, _a.copy(PIS.pos).setY(PIS.pos.y + PI_GRAB), 0.09, 52) < 0) return false;
    PIS.mode = 'drag';
    audio.play('pickUp', { gain: 0.8 });
    return true;
  }
  function pourUp() { if (PIS.mode === 'drag') startReturn(PIS, PI_HOME, 0.28, 0.55); }
  function spoutRest(out) { return out.set(PIS.pos.x - (L.pitcher.r + 0.017), PIS.pos.y + L.pitcher.h + 0.005, PIS.pos.z); }
  function pourUpdate(dt) {
    if (PIS.mode === 'drag') {
      const u = carryMap(ptr.ray, CFG_PI, _b);
      if (u >= 0) {
        // 水槽の上では右のポンプに当たらないよう x を左へ寄せる
        _b.x = Math.min(_b.x, lerp(0.045, CFG_PI.xMax, sstep(0.1, 0.2, _b.z)));
        PIS.tgt.copy(_b).setY(_b.y - PI_GRAB); PIS.u = u;
      }
    } else if (PIS.mode === 'return') {
      if (stepReturn(PIS, PI_HOME, dt) && S.done) S.homeT = stageT;
    } else PIS.tgt.copy(PI_HOME);
    liftFollow(PIS, PIS.mode === 'drag' ? 11 : 12, dt);
    // 注ぎ口が水槽の上なら傾ける
    spoutRest(_c);
    const over = PIS.mode === 'drag' && inTankXZ(_c, 0.008) && _c.y > RIM + 0.02 && PIS.pos.y > RIM;
    const full = st.level >= FULL - 0.0005;
    const tiltT = over && !full && st.pitcher > 0.081 ? 1.05 : 0;
    PIS.tilt = approach(PIS.tilt, tiltT, dt * (tiltT > PIS.tilt ? 4.2 : 3));
    const sway = clamp(-PIS.vel.x * 0.5, -0.07, 0.07) * (PIS.mode === 'drag' ? 1 : 0.3);
    pitcher.setTilt(PIS.tilt + sway);
    const g = pitcher.group;
    g.position.copy(PIS.pos);
    g.position.y += settleY(PIS, dt) + (PIS.mode === 'rest' && !S.done ? hint.hop * 0.012 : 0);
    g.updateMatrixWorld(true);
    pitcher.setTilt(PIS.tilt + sway); // group を動かした後に水面を合わせ直す
    // 注ぐ
    const pouring = PIS.tilt > 0.75 && !full && st.pitcher > 0.081;
    if (pouring) {
      pitcher.spout.getWorldPosition(_d);
      st.level = Math.min(FULL, st.level + (FULL - LOW) / 6 * dt);
      const prog = (st.level - LOW) / (FULL - LOW);
      st.murk = Math.min(st.murk, 1 - (1 - MURK_MID) * prog);
      st.pitcher = 1 - 0.92 * prog;
      tw.setLevel(st.level);
      const hF = clamp((_d.y - st.level) / 0.2, 0.4, 1.6);
      fx.stream.set('pour', _d, st.level, { width: 0.007, colorHex: 0xdaf0ff, opacity: 0.6 });
      setLoop('pour', clamp(0.5 + 0.35 * hF, 0, 1), 1 + 0.6 * prog);
      S.hF = hF;
    } else fx.stream.set('pour', null);
    pitcher.setFill(st.pitcher);
    if (!S.done && full) {
      S.done = true; S.doneT = stageT;
      chime();
      save();
    }
    if (S.done && PIS.mode === 'drag' && stageT - S.doneT > 0.4) startReturn(PIS, PI_HOME, 0.28, 0.55);
    if (S.done && PIS.mode === 'rest' && stageT - S.doneT > 0.6) go('air');
  }
  function pourLand(pos, dt) {
    const hF = S.hF || 1;
    PIS.landAcc += dt * 8;
    if (PIS.landAcc > 1) { PIS.landAcc = 0; tw.ripple(pos.x, pos.z, 0.5 * hF); tw.bubbles.emit(_e.set(pos.x, pos.y - 0.01, pos.z), Math.max(1, Math.round(3 * hF * pk())), { size: 0.003, spread: 0.012, speed: 0.8 }); }
    PIS.swirlAcc += dt * 3;
    if (PIS.swirlAcc > 1) { PIS.swirlAcc = 0; tw.swirl(_e.set(pos.x, pos.y - 0.02, pos.z), hF); if (hF > 1.1) fx.splash(pos, 0.3 * hF, 0xe8f6ff); }
  }
  function pourTarget() {
    const r = { pos: _a.copy(PIS.pos).setY(PIS.pos.y + PI_GRAB).clone(), r: 0.07, hl: { pitcher: S.done ? 0 : 1 } };
    if (PIS.mode === 'drag' && !S.done && PIS.tilt < 0.3) r.dest = { pos: V(-0.02, RIM + 0.03, -0.03), r: 0.08 };
    if (PIS.tilt >= 0.3) { r.r = 0; r.hl = { pitcher: 0 }; } // 注いでいる間は光を消す
    return r;
  }
  function pourGhost() {
    const a = _a.copy(PIS.pos).setY(PIS.pos.y + PI_GRAB).clone();
    return { pts: [a, V(a.x, 0.34, a.z), V(0.06, 0.38, 0.06), V(0.04, 0.42, -0.02)], opts: { duration: 2.2 } };
  }

  // ---------- air ----------
  function airHit(p) { return hitScreen(p.x, p.y, air.buttonCenter, 0.075, 50) >= 0; }
  function airToggle() {
    st.airOn = !st.airOn;
    AIR.down = true;
    audio.play('click', { gain: 0.9 });
    air.setOn(st.airOn);
    if (st.airOn) {
      audio.play('bubbleBurst', { gain: 0.8, delay: 0.08 });
      tw.bubbles.emit(P.airStone.top, Math.round(14 * pk()), { size: 0.004, spread: 0.01 });
    }
    save();
  }
  function airDown(p) {
    if (S.done) return false;
    if (!airHit(p)) return false;
    airToggle();
    return true;
  }
  function airUpdate(dt) {
    if (st.airOn && st.murk > 0 && !st.cleared) {
      st.murk = Math.max(0, st.murk - (MURK_MID / 5) * dt);
    }
    if (!st.cleared && st.murk <= 0) {
      st.cleared = true; S.done = true; S.doneT = stageT;
      audio.play('sparkle', { gain: 0.9 });
      tw.sparkle(2.5);
      P.marble.glint(1);
      engine.setFrame(L.frames.whole, { duration: 1.4 });
      save();
    }
    if (S.done && stageT - S.doneT > 2.4) go('back');
  }
  function airTarget() { return { pos: air.buttonCenter.clone(), r: 0.05, hl: { airPump: S.done ? 0 : 1 } }; }
  function airGhost() { return { pts: [air.buttonCenter.clone()], opts: { tap: true } }; }
  function updateAirCommon(dt) {
    AIR.press = approach(AIR.press, AIR.down ? 1 : 0, dt / 0.06);
    const hop = stage === 'air' && !S.done ? hint.hop : 0;
    air.press(Math.max(AIR.press, hop * 0.5));
    air.setOn(st.airOn);
    tw.bubbles.setStream(st.airOn, P.airStone.top, 14 * pk() + 2);
    tw.caustics.set(st.cleared ? 1 : clamp(1 - st.murk / MURK_MID, 0, 1) * 0.8);
  }

  // ---------- back ----------
  const BW_GRAB = 0.08;
  function bowlGrabPos(out) { return out.copy(BWS.pos).setY(BWS.pos.y + BW_GRAB); }
  function backDown(p) {
    if (BWS.mode === 'return' || S.done) return false;
    if (hitScreen(p.x, p.y, bowlGrabPos(_a), 0.115, 60) < 0) return false;
    if (BWS.mode === 'rest') {
      bowlCenter(_b);
      for (const f of bowlFish()) {
        hold(f);
        f.offs.subVectors(f.fish.group.position, _b);
        if (f.offs.length() > 0.045) f.offs.setLength(0.045);
        f.offs.y = Math.min(f.offs.y, P.bowl.waterSurfaceY() - _b.y - 0.016);
        f.yaw0 = f.yaw; f.rot0 = BWS.rotY;
        f.loc = 'bowlHeld';
      }
      audio.play('pickUp', { gain: 0.9, pitch: 0.85 });
    }
    BWS.mode = 'drag';
    return true;
  }
  function backUp() {
    if (BWS.mode !== 'drag') return;
    if (BWS.u >= 0.5) BWS.mode = 'assist';
    else startReturn(BWS, BW_HOME, 0.27, 0.45);
  }
  function heldBowlFish() { return allF().filter((f) => f.loc === 'bowlHeld'); }
  function backUpdate(dt) {
    if (BWS.mode === 'drag') {
      const u = carryMap(ptr.ray, CFG_BW, _b);
      if (u >= 0) { BWS.tgt.copy(_b).setY(_b.y - BW_GRAB); BWS.u = u; }
    } else if (BWS.mode === 'assist') {
      BWS.tgt.set(clamp(BWS.pos.x, CFG_BW.xMin, CFG_BW.xMax), CFG_BW.Y1 - BW_GRAB, CFG_BW.zMin);
      if (BWS.pos.z > CFG_BW.homeZ - 0.01 && BWS.pos.y < CFG_BW.Y1 - BW_GRAB - 0.01) BWS.tgt.z = BWS.pos.z; // まず上へ
      BWS.u = 1;
    } else if (BWS.mode === 'return') {
      if (stepReturn(BWS, BW_HOME, dt)) {
        bowlCenter(_b);
        for (const f of heldBowlFish()) { f.loc = 'bowl'; release(f, 'wander'); toBowlBounds(f); }
        if (S.allOut) S.homeT = stageT;
      }
    } else BWS.tgt.copy(BW_HOME);
    liftFollow(BWS, 6.5, dt);
    // 向き（傾く先を水槽側へ）
    const lifted = BWS.pos.y > 0.03 || BWS.mode === 'drag' || BWS.mode === 'assist';
    BWS.rotY = damp(BWS.rotY, lifted && !S.allOut ? -Math.PI / 2 : 0, 4, dt);
    const atPour = BWS.pos.z < 0.13 && BWS.pos.y > RIM - 0.005 && (BWS.mode === 'drag' || BWS.mode === 'assist');
    const tiltT = atPour && !S.allOut ? 1.2 : 0;
    BWS.tilt = approach(BWS.tilt, tiltT, dt * 1.6);
    BWS.shake = Math.max(0, BWS.shake - dt);
    const g = bowl.group;
    g.position.copy(BWS.pos);
    g.position.y += settleY(BWS, dt) + (BWS.mode === 'rest' && !S.done ? hint.hop * 0.012 : 0);
    const jig = S.stuck ? Math.sin(time * 47) * 0.02 : 0;
    g.rotation.set(jig + clamp(BWS.vel.z * 0.15, -0.06, 0.06), BWS.rotY, clamp(-BWS.vel.x * 0.15, -0.06, 0.06));
    bowl.setTilt(BWS.tilt);
    g.updateMatrixWorld(true);
    // 鉢の水
    st.bowlWater = approach(st.bowlWater, S.waterT ?? 1, dt * 0.3);
    bowl.setWaterLevel(st.bowlWater);
    // 抱えた魚
    bowlCenter(_b);
    const ws = bowl.waterSurfaceY();
    for (const f of heldBowlFish()) {
      if (f.anim) continue;
      _c.copy(f.offs).applyAxisAngle(YN, BWS.rotY - f.rot0);
      _c.add(_b);
      _c.y = Math.min(_c.y, ws - 0.014) + Math.sin(time * 1.7 + f.k.length) * 0.002;
      placeHeld(f, _c, f.yaw0 + BWS.rotY - f.rot0 + Math.sin(time * 1.1 + f.k.length) * 0.15);
      f.fish.swim = 0.35;
    }
    // 注ぐ
    if (BWS.tilt > 0.95 && !S.allOut) {
      S.pourT = (S.pourT || 0) + dt;
      bowl.mouth.getWorldPosition(_d);
      fx.stream.set('bowl', _d, st.level, { width: 0.012, colorHex: 0xdcefff, opacity: 0.55 });
      setLoop('pour', 0.7, 0.9);
      const nextAt = 0.45 + (S.launched || 0) * 0.9;
      const busyRyu = F.ryukin.anim && F.ryukin.anim.type === 'pour' && F.ryukin.anim.phase !== 'fall';
      if (S.pourT > nextAt && !busyRyu) {
        const f = ORDER.map((k) => F[k]).find((x) => x.loc === 'bowlHeld' && !x.anim);
        if (f) {
          f.anim = { type: 'pour', t: 0, phase: 'toMouth', from: f.fish.group.position.clone(), vel: V() };
          S.launched = (S.launched || 0) + 1;
          S.waterT = Math.max(0.35, 1 - 0.22 * S.launched);
        }
      }
      if (ORDER.every((k) => F[k].loc === 'tank') && !S.allOut) { S.allOut = true; S.outT = stageT; chime(); save(); }
    } else if (!S.allOut || stageT - (S.outT || 0) > 0.4) fx.stream.set('bowl', null);
    if (S.allOut) fx.stream.set('bowl', null);
    if (S.allOut && (BWS.mode === 'drag' || BWS.mode === 'assist') && stageT - S.outT > 0.7) startReturn(BWS, BW_HOME, 0.27, 0.45);
    if (S.allOut && BWS.mode === 'rest' && S.homeT != null && stageT - S.homeT > 0.6) go('feed');
    // 鉢の魚は水槽側を見る
    for (const f of bowlFish()) {
      const i = ORDER.indexOf(f.k);
      want(f, 'seek', _c.copy(_b).add(_e.set((i - 1) * 0.022, -0.012 + (i % 2) * 0.01, -0.045)), 0.5);
    }
    // 水槽に帰った魚
    for (const f of tankFish()) {
      if (f.seekT > 0) want(f, 'seek', f.seekP, 1);
      else want(f, 'wander', null, 1);
    }
  }
  function backTarget() {
    const r = { pos: bowlGrabPos(_a).clone(), r: 0.065, hl: { bowl: S.done || S.allOut ? 0 : 1 } };
    if ((BWS.mode === 'drag') && !S.allOut && BWS.tilt < 0.25) r.dest = { pos: V(BWS.pos.x, RIM + 0.03, T.maxZ - 0.005), r: 0.08 };
    if (BWS.tilt >= 0.25) { r.r = 0; r.hl = { bowl: 0 }; } // 傾けて帰している間は光を消して金魚を見せる
    return r;
  }
  function backGhost() {
    const a = bowlGrabPos(_a).clone();
    return { pts: [a, V(a.x, 0.33, a.z), V(a.x * 0.6, 0.355, 0.12), V(a.x * 0.5, 0.37, 0.1)], opts: { duration: 2.4 } };
  }

  // ---------- feed ----------
  const FC_GRAB = 0.04;
  function feedDown(p) {
    if (FCS.mode === 'return' && FCS.pos.y > 0.05) { FCS.mode = 'drag'; return true; }
    if (hitScreen(p.x, p.y, _a.copy(FCS.pos).setY(FCS.pos.y + FC_GRAB), 0.085, 52) < 0) return false;
    FCS.mode = 'drag';
    audio.play('pickUp', { gain: 0.6, pitch: 1.2 });
    audio.play('canShake', { gain: 0.4, delay: 0.05 });
    return true;
  }
  function feedUp() { if (FCS.mode === 'drag') startReturn(FCS, FC_HOME, 0.27, 0.6); }
  function aliveFlakes() { let n = 0; for (const it of fx.flakes.items) if (it.alive) n++; return n; }
  function canUpdate(dt, endless) {
    if (FCS.mode === 'drag') {
      const u = carryMap(ptr.ray, CFG_FC, _b);
      if (u >= 0) { FCS.tgt.copy(_b).setY(_b.y - FC_GRAB); FCS.u = u; }
    } else if (FCS.mode === 'return') {
      if (stepReturn(FCS, FC_HOME, dt)) S.canHomeT = stageT;
    } else FCS.tgt.copy(FC_HOME);
    liftFollow(FCS, 12, dt);
    can.mouth.getWorldPosition(_c);
    const restMouth = _d.set(FCS.pos.x, FCS.pos.y + L.foodCan.h, FCS.pos.z);
    const over = FCS.mode === 'drag' && inTankXZ(restMouth, 0.01) && FCS.pos.y > RIM;
    FCS.tilt = approach(FCS.tilt, over ? -1.9 : 0, dt * 6);
    const spd = FCS.vel.length();
    const g = can.group;
    g.position.copy(FCS.pos);
    g.position.y += settleY(FCS, dt) + (FCS.mode === 'rest' && S.hopOK ? hint.hop * 0.012 : 0);
    g.rotation.set(clamp(FCS.vel.z * 0.3, -0.12, 0.12), 0, clamp(-FCS.vel.x * 0.3, -0.12, 0.12));
    can.setTilt(FCS.tilt + (over ? Math.sin(time * 18) * 0.04 * clamp(spd / 0.2, 0, 1) : 0));
    g.updateMatrixWorld(true);
    // ぱらぱら
    FCS.shakeCD -= dt; FCS.soundCD -= dt;
    let emitting = false;
    if (Math.abs(FCS.tilt) > 1.2 && FCS.mode === 'drag') {
      emitting = true;
      const cap = endless ? 26 : 34;
      FCS.acc += dt * (1.4 + Math.min(5, spd * 30));
      while (FCS.acc >= 1) {
        FCS.acc -= 1;
        if (aliveFlakes() < cap) {
          can.mouth.getWorldPosition(_c);
          fx.flakes.emit(_c, 1);
          if (FCS.soundCD <= 0) { FCS.soundCD = 0.28; audio.play('flakes', { gain: 0.5 + Math.min(0.5, spd) }); }
        }
      }
      if (spd > 0.22 && FCS.shakeCD <= 0) { FCS.shakeCD = 0.35; audio.play('canShake', { gain: 0.6 }); }
    }
    return emitting;
  }
  function fishEat(dt, begPoint) {
    fx.flakes.surfaceY = st.level;
    const items = fx.flakes.items;
    const claimed = new Set();
    // 琉金が先に選ぶ（いちばん食べる）
    for (const k of ['ryukin', 'wakin', 'sarasa']) {
      const f = F[k];
      if (f.loc !== 'tank' || f.anim) continue;
      let best = -1, bd = 1e9;
      const fp = f.sw.position;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.alive || claimed.has(i) || !inTankXZ(it.pos) || it.pos.y < T.gravelH + 0.008) continue;
        if (it.state === 'fall' && it.pos.y > st.level) continue;
        const d = fp.distanceTo(it.pos);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        claimed.add(best);
        const it = items[best];
        want(f, 'seek', _a.set(clamp(it.pos.x, L.swim.minX, L.swim.maxX), Math.min(it.pos.y - 0.004, st.level - 0.012), clamp(it.pos.z, L.swim.minZ, L.swim.maxZ)), k === 'ryukin' ? 1.7 : 0.85);
        f.fish.mouth.getWorldPosition(_b);
        if (_b.distanceTo(it.pos) < 0.02 || (f.sw.arrived && bd < 0.035)) {
          f.fish.gulp();
          audio.play('eat', { gain: 0.7, pitch: k === 'ryukin' ? 0.85 : 1.1 });
          fx.flakes.eat(best);
          st.fed++;
          S.eaten = (S.eaten || 0) + 1;
        }
      } else if (begPoint) {
        const i = ORDER.indexOf(k);
        want(f, 'seek', _a.set(begPoint.x + (i - 1) * 0.03, st.level - 0.022, begPoint.z + (i % 2) * 0.012), 0.8);
        f.begT = (f.begT || 0) - dt;
        if (f.begT <= 0) { f.fish.gulp(); f.begT = 0.5 + Math.random() * 0.6; }
      } else if (f.seekT > 0) want(f, 'seek', f.seekP, 1);
      else want(f, 'wander', null, 1);
    }
  }
  function feedUpdate(dt) {
    S.hopOK = true;
    const emitting = canUpdate(dt, false);
    if (emitting) S.feedT = (S.feedT || 0) + dt;
    fishEat(dt, V(-0.085, 0, 0.015));
    if (!S.done && ((S.eaten || 0) >= 8 || (S.feedT || 0) >= 6)) {
      S.done = true; S.doneT = stageT;
      S.burpAt = stageT + 0.6;
    }
    if (S.burpAt != null && stageT >= S.burpAt) {
      S.burpAt = null;
      audio.play('burp', { gain: 0.9 });
      F.ryukin.fish.mouth.getWorldPosition(_a);
      tw.bubbles.emit(_a, 1, { size: 0.007, spread: 0.001, speed: 0.7 });
      F.ryukin.fish.gulp();
      save();
    }
    if (S.done && FCS.mode === 'rest' && stageT - S.doneT > 1.2) go('ending');
  }
  function feedTarget() {
    const r = { pos: _a.copy(FCS.pos).setY(FCS.pos.y + FC_GRAB).clone(), r: 0.06, hl: { foodCan: S.done ? 0 : 1 } };
    if (FCS.mode === 'drag' && !S.done) r.dest = { pos: V(-0.06, RIM + 0.05, -0.01), r: 0.08 };
    return r;
  }
  function feedGhost() {
    const a = _a.copy(FCS.pos).setY(FCS.pos.y + FC_GRAB).clone();
    return { pts: [a, V(a.x, 0.3, a.z), V(-0.15, 0.34, 0.06), V(-0.08, 0.36, -0.01)], opts: { duration: 2.2 } };
  }

  // ---------- ending / free ----------
  function endingUpdate(dt) {
    world.setTimeOfDay(clamp(stageT / 6, 0, 1));
    const line = [V(-0.065, 0.12, 0.032), V(0.0, 0.13, 0.036), V(0.065, 0.118, 0.032)];
    ORDER.forEach((k, i) => {
      const f = F[k];
      if (stageT < 6.5) want(f, 'seek', line[i], 0.55);
      else if (stageT < 12) want(f, 'watch', camera.position, 1);
      else want(f, 'wander', null, 0.8);
    });
    canUpdate(dt, true);
    if (stageT > 12.5) go('free');
  }
  function freeUpdate(dt) {
    world.setTimeOfDay(1);
    const emitting = canUpdate(dt, true);
    const idle = input.isDown ? 0 : input.idleTime();
    S.hopOK = false;
    if (aliveFlakes() > 0 || emitting) fishEat(dt, null);
    else if (idle > 15) {
      ORDER.forEach((k, i) => want(F[k], idle < 18 ? 'seek' : 'watch', idle < 18 ? _a.set(-0.06 + i * 0.06, 0.125, 0.035) : camera.position, 0.7));
      if (!S.bubbled && idle > 18) { S.bubbled = true; F.wakin.fish.mouth.getWorldPosition(_a); tw.bubbles.emit(_a, 1, { size: 0.004 }); audio.play('bubble', { gain: 0.5 }); }
    } else {
      S.bubbled = false;
      for (const f of tankFish()) { if (f.seekT > 0) want(f, 'seek', f.seekP, 1); else want(f, 'wander', null, 1); }
    }
    if (idle > 25 && FCS.mode === 'rest') { can.setHighlight(0.5); S.canGlow = true; } else S.canGlow = false;
  }

  // ---------- いつでも遊べる反応 ----------
  function anytimeTap(p) {
    const after = (s) => sIdx(stage) > sIdx(s);
    if (after('air') && airHit(p)) { airToggle(); return; }
    if (st.cleared) {
      if (hitScreen(p.x, p.y, P.marble.group.position, 0.02, 34) >= 0) {
        audio.play('marble', { gain: 0.9 });
        P.marble.glint(1);
        S.marbleRoll = 0.6; S.marbleDir = P.marble.group.position.x > L.marble.x ? -1 : 1;
        const mp = P.marble.group.position;
        const f = tankFish().sort((a, b) => a.sw.position.distanceTo(mp) - b.sw.position.distanceTo(mp))[0];
        if (f) { f.seekT = 2.6; f.seekP.set(mp.x, Math.max(L.swim.minY, mp.y + 0.02), mp.z + 0.01); }
        return;
      }
      const items = P.plants.items;
      for (let i = 0; i < items.length; i++) {
        const pp = _a.copy(items[i].group.position).setY(T.gravelH + 0.07);
        if (hitScreen(p.x, p.y, pp, 0.035, 36) >= 0 && pp.y < st.level) {
          P.plants.poke(i, 1);
          tw.bubbles.emit(_b.copy(pp).setY(T.gravelH + 0.03), Math.round(4 * pk()), { size: 0.003, spread: 0.01 });
          audio.play('bubble', { gain: 0.5, pitch: 1.2 });
          return;
        }
      }
    }
    if (bowlFish().length && hitScreen(p.x, p.y, bowlCenter(_a), 0.09, 40) >= 0) {
      audio.play('tapGlass', { gain: 0.6, pitch: 1.5 });
      for (const f of bowlFish()) f.sw.startle(_b.copy(_a).add(_c.set(0, 0, 0.08)), 0.4);
      return;
    }
    const h = frontGlassHit(p.ray, _b, RIM);
    if (h) {
      audio.play('tapGlass', { gain: 0.7, pitch: 0.95 + Math.random() * 0.1 });
      for (const f of tankFish()) {
        f.seekT = 2.5;
        f.seekP.set(clamp(h.x, L.swim.minX, L.swim.maxX), clamp(h.y, L.swim.minY, st.level - 0.025), L.swim.maxZ - 0.008);
      }
    }
  }

  // ---------- 段階表 ----------
  const SD = {
    intro: { down: () => { go('scoop'); return false; }, update: introUpdate, target: () => ({ pos: NETS.pos.clone(), r: 0.075, hl: { net: 0.6 } }) },
    scoop: { down: scoopDown, up: scoopUp, update: scoopUpdate, target: scoopTarget, ghost: scoopGhost },
    wipe: { down: wipeDown, up: wipeUp, update: wipeUpdate, target: wipeTarget, ghost: wipeGhost },
    pump: { down: pumpDown, up: pumpUp, update: pumpUpdate, target: pumpTarget, ghost: pumpGhost },
    pour: { down: pourDown, up: pourUp, update: pourUpdate, target: pourTarget, ghost: pourGhost },
    air: { down: airDown, up: () => {}, update: airUpdate, target: airTarget, ghost: airGhost },
    back: { down: backDown, up: backUp, update: backUpdate, target: backTarget, ghost: backGhost },
    feed: { down: feedDown, up: feedUp, update: feedUpdate, target: feedTarget, ghost: feedGhost },
    ending: { down: feedDown, up: feedUp, update: endingUpdate, target: null },
    free: { down: feedDown, up: feedUp, update: freeUpdate, target: null },
  };

  input.onDown((p) => {
    audio.unlock();
    ghost.stop(); hint.ghostOn = false;
    ptr.down = true; ptr.x = ptr.px = p.x; ptr.y = ptr.py = p.y; ptr.vpx = 0; ptr.ray.copy(p.ray); ptr.t0 = time;
    let used = false;
    const sd = SD[stage];
    if (stage === 'intro') { go('scoop'); }
    if (busy <= 0 || stage === 'scoop') used = SD[stage].down ? !!SD[stage].down(p) : false;
    void sd;
    if (!used) anytimeTap(p);
  });
  input.onMove((p) => { ptr.x = p.x; ptr.y = p.y; ptr.ray.copy(p.ray); });
  input.onUp((p) => {
    ptr.down = false;
    AIR.down = false;
    const sd = SD[stage];
    if (sd.up) sd.up(p);
  });

  // ---------- 魚のアニメ（あみ・鉢・注ぐ） ----------
  function updateFishAnims(dt) {
    for (const f of allF()) {
      f.seekT = Math.max(0, f.seekT - dt);
      const a = f.anim;
      if (f.loc === 'pot' && !a) {
        // 琉金: 鉢の中に体、尾だけ口から出してゆれる
        const ax = P.pot.axis;
        _a.copy(P.pot.mouth).addScaledVector(ax, -0.021);
        placeHeld(f, _a, Math.atan2(ax.z, -ax.x), -Math.asin(clamp(ax.y, -1, 1)), Math.sin(time * 1.3) * 0.05);
        f.fish.swim = 0.32 + 0.12 * Math.sin(time * 0.9);
        continue;
      }
      if (!a) continue;
      a.t += dt;
      if (a.type === 'backout') {
        const ax = P.pot.axis;
        const k = sstep(0, 2.2, a.t);
        _a.copy(P.pot.mouth).addScaledVector(ax, lerp(-0.021, 0.034, k));
        placeHeld(f, _a, Math.atan2(ax.z, -ax.x), -Math.asin(clamp(ax.y, -1, 1)) * (1 - k), 0);
        f.fish.swim = 0.5;
        if (a.t > 2.3) { f.loc = 'tank'; st.peeked = true; release(f, 'watch'); f.sw.target.copy(NETS.pos); f.sw.setBounds(tankBounds()); }
      } else if (a.type === 'toNet' || a.type === 'inNet') {
        net.bagBottom.getWorldPosition(_a);
        _a.y += f.fish.radius * 0.55;
        const wig = f.k === 'ryukin' ? 0.6 : 1;
        _a.x += Math.sin(time * 9.3) * 0.0018 * wig;
        const yawT0 = Math.cos(f.yaw) < 0 ? Math.PI : 0;
        const yawT = f.yaw + Math.atan2(Math.sin(yawT0 - f.yaw), Math.cos(yawT0 - f.yaw));
        if (a.type === 'toNet') {
          const k = sstep(0, 0.35, a.t);
          _a.lerpVectors(a.from, _a, k);
          if (a.t > 0.35) { f.anim = { type: 'inNet', t: 0 }; }
        }
        const yaw = damp(f.yaw, yawT, 4, dt) + 0;
        placeHeld(f, _a, yaw, Math.sin(time * 6.1) * 0.15, Math.sin(time * 7.7) * 0.25 * wig);
        f.yaw = yaw;
        f.fish.swim = 0.75 + 0.25 * Math.sin(time * 3.1);
        f.fish.turn = Math.sin(time * 5) * 0.6;
      } else if (a.type === 'drop') {
        // 袋から鉢へ ちゃぽん
        const ws = bowl.waterSurfaceY();
        a.vy -= 5.5 * dt;
        const pos = f.fish.group.position;
        bowl.mouth.getWorldPosition(_b);
        pos.x = damp(pos.x, _b.x, 6, dt); pos.z = damp(pos.z, _b.z, 6, dt);
        pos.y += a.vy * dt;
        placeHeld(f, pos, f.yaw, Math.max(-0.6, a.vy * 1.5), 0);
        f.fish.swim = 0.9;
        if (!a.splashed && pos.y < ws) {
          a.splashed = true;
          const big = f.k === 'ryukin';
          audio.play(big ? 'plopBig' : 'plopSmall', { gain: 1 });
          fx.splash(_c.set(pos.x, ws, pos.z), big ? 1.6 : 0.6, 0xeaf6ff);
          a.vy *= 0.25;
          if (big) for (const o of bowlFish()) o.sw.startle(pos, 0.5);
        }
        if (a.splashed && (pos.y < ws - 0.03 || a.t > 1.5)) {
          f.anim = null;
          putInBowl(f, _c.copy(pos).setY(Math.min(pos.y, ws - 0.03)));
          f.sw.setHeading(f.yaw);
        }
      } else if (a.type === 'pour') {
        bowl.mouth.getWorldPosition(_b);
        const pos = f.fish.group.position;
        const isRyu = f.k === 'ryukin';
        const faceYaw = Math.PI / 2; // -Z 向き
        if (a.phase === 'toMouth') {
          const k = sstep(0, 0.35, a.t);
          _c.copy(_b).add(_e.set(0, -0.006, 0.012));
          pos.lerpVectors(a.from, _c, k);
          if (a.yaw0 == null) a.yaw0 = f.yaw;
          const dy = Math.atan2(Math.sin(faceYaw - a.yaw0), Math.cos(faceYaw - a.yaw0));
          placeHeld(f, pos, faceYaw - dy * (1 - k), -0.3 * k, 0);
          f.fish.swim = 0.8;
          if (a.t > 0.35) {
            if (isRyu) { a.phase = 'stuck'; a.t = 0; S.stuck = true; audio.play('squeeze', { gain: 1 }); }
            else { a.phase = 'fall'; a.t = 0; a.vel.set(0, 0.15, -0.32); }
          }
        } else if (a.phase === 'stuck') {
          _c.copy(_b).add(_e.set(0, -0.004, 0.006));
          pos.copy(_c);
          f.fish.setSquash(sstep(0, 0.3, a.t));
          placeHeld(f, pos, faceYaw + Math.sin(time * 14) * 0.08, -0.35, Math.sin(time * 11) * 0.1);
          f.fish.swim = 1; f.fish.turn = Math.sin(time * 9);
          const shook = ptr.down && ptr.vpx > 900 && a.t > 0.3;
          if (a.t > 1.3 || shook) {
            a.phase = 'fall'; a.t = 0; a.vel.set(0, 0.35, -0.5); S.stuck = false;
            f.fish.setSquash(0);
            audio.play('pop', { gain: 1 });
            fx.splash(_b, 1.0, 0xeaf6ff);
            engine.cameraShake(0.0025);
          }
        } else if (a.phase === 'fall') {
          a.vel.y -= 6 * dt;
          pos.addScaledVector(a.vel, dt);
          pos.z = Math.max(pos.z, IN.z0 + 0.03);
          placeHeld(f, pos, faceYaw, clamp(a.vel.y * 1.2, -0.9, 0.4), 0);
          f.fish.swim = 1;
          if (pos.y < st.level) {
            audio.play(isRyu ? 'plopBig' : 'plopSmall', { gain: 1 });
            fx.splash(_c.set(pos.x, st.level, pos.z), isRyu ? 1.9 : 0.6, 0xeaf6ff);
            tw.ripple(pos.x, pos.z, isRyu ? 2.2 : 1);
            tw.bubbles.emit(_c.set(pos.x, st.level - 0.02, pos.z), Math.round((isRyu ? 14 : 6) * pk()), { size: 0.004, spread: 0.015 });
            f.yaw = faceYaw;
            putInTank(f, _c.set(clamp(pos.x, L.swim.minX, L.swim.maxX), st.level - 0.04, clamp(pos.z, L.swim.minZ, L.swim.maxZ)));
            f.sw.setHeading(faceYaw);
            f.anim = null;
            if (isRyu) {
              for (const o of tankFish()) if (o !== f) { o.sw.startle(pos, 0.9); o.seekT = 3.2; o.seekP.copy(_c); }
            }
          }
        }
      }
    }
  }

  // ---------- 描画順（ひれ） ----------
  function updateFinOrders() {
    for (const f of allF()) {
      const p = f.fish.group.position;
      const inTankVol = inTankXZ(p) && p.y < RIM;
      if (inTankVol && p.y < st.level - 0.002) f.fish.finOrder = null;
      else f.fish.finOrder = inTankVol ? ORDER_OUT_TANK : ORDER_OUTSIDE;
    }
  }

  // ---------- ヒント ----------
  const HL_KEYS = ['net', 'sponge', 'pump', 'pitcher', 'airPump', 'bowl', 'foodCan'];
  function updateHints(dt) {
    const sd = SD[stage];
    const tgt = sd.target ? sd.target() : null;
    const grabbing = ptr.down;
    const idle = grabbing || busy > 0 ? 0 : Math.min(input.idleTime(), stageT);
    // ぴょこっ
    hint.hop = 0;
    if (tgt && idle >= 4) {
      const ph = (idle - 4) % 2.5;
      hint.hop = ph < 0.45 ? Math.sin(Math.PI * ph / 0.45) : 0;
      if (!hint.pinged) { hint.pinged = true; audio.play('hintPing', { gain: 0.6 }); }
    } else if (idle < 4) hint.pinged = false;
    // お手本
    if (tgt && sd.ghost && idle >= 8 && !hint.ghostOn && !ghost.active) {
      const g = sd.ghost();
      ghost.play(g.pts, g.opts);
      hint.ghostOn = true;
    }
    if (idle < 8 && hint.ghostOn) { ghost.stop(); hint.ghostOn = false; }
    // highlight
    const hl = {};
    if (tgt) {
      const k = idle >= 4 ? 1 : 0.55;
      for (const key in tgt.hl) hl[key] = tgt.hl[key] * k;
      if (tgt.dest && tgt.hlDest) for (const key in tgt.hlDest) hl[key] = tgt.hlDest[key];
    }
    for (const key of HL_KEYS) if (!(key === 'foodCan' && S.canGlow)) P[key].setHighlight(busy > 0 ? 0 : hl[key] || 0);
    // 光だまり
    if (busy > 0.3 || !tgt) world.halo.set(null);
    else if (tgt.dest && grabbing) world.halo.set(tgt.dest.pos, tgt.dest.r);
    else if (tgt.dest && !grabbing && tgt.hlDest) world.halo.set(tgt.dest.pos, tgt.dest.r);
    else if (tgt.hl && Object.values(tgt.hl).some((v) => v > 0)) world.halo.set(tgt.pos, tgt.r);
    else world.halo.set(null);
  }

  // ---------- 毎フレーム ----------
  let lastMurkShown = -1;
  function update(dt, t) {
    time = t;
    stageT += dt;
    busy = Math.max(0, busy - dt);
    for (const k in loops) loops[k][0] = 0;
    if (ptr.down) {
      input.rayAt(ptr.x, ptr.y, ptr.ray);
      const v = dt > 0 ? Math.hypot(ptr.x - ptr.px, ptr.y - ptr.py) / dt : 0;
      ptr.vpx = damp(ptr.vpx, v, 12, dt);
      ptr.px = ptr.x; ptr.py = ptr.y;
    }
    SD[stage].update(dt);
    // 段階をまたいで生きている道具
    if (stage !== 'scoop' && stage !== 'intro') { net.group.position.copy(NET_HOME); net.group.rotation.set(0, L.net.rotY, 0); net.bag.renderOrder = 3; NETS.wet = Math.max(0, NETS.wet - dt * 0.04); net.setWet(NETS.wet); net.setSag(0); }
    else if (stage === 'intro') updateNet(dt);
    if (stage !== 'air') AIR.down = AIR.down && ptr.down;
    updateAirCommon(dt);
    // 水槽の魚の既定のふるまい
    if (['intro', 'scoop'].includes(stage)) {
      for (const f of tankFish()) {
        if (stage === 'scoop' && f === nextScoopFish()) continue;
        if (f.seekT > 0) want(f, 'seek', f.seekP, 1);
        else if (stage === 'intro' && f.k === 'wakin' && stageT > 0.9) continue;
        else want(f, 'wander', null, 1);
      }
    }
    if (stage === 'scoop') { const c = nextScoopFish(); if (c && c.loc === 'tank' && c.seekT > 0 && !NETS.inWater) want(c, 'seek', c.seekP, 1); else if (c && c.loc === 'tank' && !NETS.inWater && c.k !== 'ryukin') want(c, 'wander', null, 1); }
    updateFishAnims(dt);
    if (Math.abs(st.level - lastBoundsLevel) > 0.002) { lastBoundsLevel = st.level; for (const f of tankFish()) f.sw.setBounds(tankBounds()); }
    // ビー玉ころん
    if (S.marbleRoll > 0) {
      S.marbleRoll -= dt;
      const m = P.marble.group;
      const sp = Math.max(0, S.marbleRoll) * 0.02;
      const dir = S.marbleDir || 1;
      m.position.x = clamp(m.position.x + sp * dt * dir * 1.5, IN.x0 + 0.03, IN.x1 - 0.03);
      m.rotation.z -= sp * dt * dir * 1.5 / 0.008;
    }
    // にごり
    const ms = showMurk(st.murk);
    if (Math.abs(ms - lastMurkShown) > 0.0005) { lastMurkShown = ms; tw.setMurk(ms); }
    fx.flakes.surfaceY = st.level;
    updateFinOrders();
    updateHints(dt);
    // 持続音
    audio.setLoop('ambience', 0.9);
    audio.setLoop('airPump', st.airOn ? 0.5 : 0);
    audio.setLoop('bubbling', st.airOn ? 0.6 : 0);
    for (const k in loops) audio.setLoop(k, loops[k][0], loops[k][1]);
  }

  // ---------- 着水 ----------
  fx.onStreamLand = (id, pos, dt) => {
    if (!inTankXZ(pos)) return;
    if (id === 'pour') pourLand(pos, dt);
    else if (id === 'bowl') { if (Math.random() < dt * 6) { tw.ripple(pos.x, pos.z, 0.6); tw.bubbles.emit(_e.set(pos.x, pos.y - 0.01, pos.z), 2, { size: 0.003, spread: 0.01 }); } }
  };
  fx.onDripLand = (pos) => {
    if (inTankXZ(pos) && Math.abs(pos.y - st.level) < 0.01) { tw.ripple(pos.x, pos.z, 0.3); audio.play('drip', { gain: 0.4, pitch: 0.9 + Math.random() * 0.3 }); }
  };

  // ---------- 起動: 保存から再開 or 最初から ----------
  function initFresh() {
    st.level = FULL; st.murk = 1; st.pail = 0; st.pitcher = 1; st.airOn = false; st.cleared = false; st.fed = 0; st.done = false; st.bowlWater = 1;
    tw.algae.reset();
    putInTank(F.wakin, V(-0.08, 0.12, -0.03)); F.wakin.sw.setHeading(0.3);
    putInTank(F.sarasa, V(0.04, 0.16, -0.07)); F.sarasa.sw.setHeading(2.6);
    F.ryukin.loc = 'pot'; hold(F.ryukin); F.ryukin.sw.setBounds(tankBounds());
    go('intro');
  }
  function tryRestore() {
    const s = engine.save.load();
    if (!s || s.v !== 1 || s.done) return false;
    const order = ['scoop', 'wipe', 'pump', 'pour', 'air', 'back', 'feed'];
    if (!order.includes(s.stage)) return false;
    const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : NaN);
    const level = num(s.level, LOW, FULL), murk = num(s.murk, 0, 1), pail = num(s.pail, 0, 1), pit = num(s.pitcher, 0, 1);
    if ([level, murk, pail, pit].some((x) => isNaN(x))) return false;
    if (!Array.isArray(s.moved) || s.moved.some((k) => !ORDER.includes(k))) return false;
    const mv = ORDER.filter((k) => s.moved.includes(k));
    const si = order.indexOf(s.stage);
    if (s.stage === 'scoop') { if (mv.join() !== ORDER.slice(0, mv.length).join() || mv.length >= 3) return false; }
    else if (si >= 1 && si <= 5 && mv.length !== 3) return false;
    st.level = level; st.murk = murk; st.pail = pail; st.pitcher = pit;
    st.airOn = !!s.airOn; st.cleared = !!s.cleared; st.fed = Math.max(0, Math.min(999, s.fed | 0)); st.done = false;
    if (s.stage === 'feed' && !st.cleared) return false;
    tw.setLevel(st.level);
    if (typeof s.algae === 'string' && s.algae.length >= 260) tw.algae.restore(s.algae);
    if (si >= 2) tw.algae.restore('0'.repeat(260));
    P.pail.setFill(st.pail, 0x6f8a3c);
    pitcher.setFill(st.pitcher);
    PUMP.levelT = st.level;
    if (si >= 3 && st.level <= LOW + 0.001) { /* pour から */ }
    st.bowlWater = s.stage === 'feed' ? 0.35 : 1;
    bowl.setWaterLevel(st.bowlWater);
    if (s.stage === 'feed') {
      putInTank(F.wakin, V(-0.08, 0.12, -0.02)); putInTank(F.sarasa, V(0.02, 0.15, -0.05)); putInTank(F.ryukin, V(0.06, 0.1, -0.03));
    } else {
      bowlCenter(_a);
      ORDER.forEach((k, i) => {
        if (mv.includes(k)) putInBowl(F[k], _b.copy(_a).add(_c.set((i - 1) * 0.025, -0.01, 0)));
        else if (k === 'ryukin') {
          if (mv.length === 2) { st.peeked = true; putInTank(F.ryukin, _b.copy(P.pot.mouth).addScaledVector(P.pot.axis, 0.034)); F.ryukin.sw.mode = 'watch'; }
          else { F.ryukin.loc = 'pot'; hold(F.ryukin); F.ryukin.sw.setBounds(tankBounds()); }
        } else putInTank(F[k], V(-0.05 + i * 0.06, 0.13, -0.04));
      });
    }
    // 段階の頭へ
    if (s.stage === 'pump' && st.level <= LOW + 0.001) { go('pour'); return true; }
    if (s.stage === 'pour' && st.level >= FULL - 0.001) { go('air'); return true; }
    if (s.stage === 'air' && st.cleared) { go('back'); return true; }
    if (s.stage === 'wipe' && tw.algae.coverage() < 0.12) { tw.algae.restore('0'.repeat(260)); go('pump'); return true; }
    go(s.stage);
    return true;
  }
  if (!tryRestore()) initFresh();
  lastMurkShown = -1;

  // ---------- 外への窓 ----------
  const story = {
    update,
    get stage() { return stage; },
    targetPoint() { const sd = SD[stage]; const t = sd.target ? sd.target() : null; return t ? t.pos.clone() : V(0, 0.15, 0); },
    destPoint() { const sd = SD[stage]; const t = sd.target ? sd.target() : null; return t && t.dest ? t.dest.pos.clone() : null; },
  };
  return story;
}
