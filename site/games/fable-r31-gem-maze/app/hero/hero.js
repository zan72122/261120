// 主役の仕掛け：三重ジンバル → 立方体の姿勢 → 重力 → レール上の宝石 → 宝箱。API は docs/HERO-SPEC.md §3。
//
// つながり（全部、式で保つ）：
//   外リング θ1 ─ ローラー角 = −θ1·(R1+t1)/r_r（転がり）
//   立方体の姿勢 R = Rz(θ1)·Rx(θ2)·Ry(θ3)、立方体ローカルの重力 g = R^T·(0,−1,0)
//   宝石：辺 e 上で 加速度 = A·(g·e) − μ、転がり角 = 進んだ距離 / r_gem
//   ノブ θ_k ─ 中間歯車 θ_i = −θ_k·z_k/z_i ─ 回転台 θ_t = θ_k·z_k/z_t（ノブ 180° で回転台 90°）
// 1 つの操作からの連鎖：リングを回す → ローラーが回る → 立方体が傾く → 宝石が転がる → 角でコトン →
//   宝箱へ（ふたがぴょこ）→ 台座のランプがともる → 全部そろうとリングが戻り、ふたが開いて宝石が噴き上がる。
import { P, TAU, QUARTER } from './params.js';
import { CENTER, DIR_VEC, MOVE_KNOB, MOVE_IDS, compileLayout, checkAnyState, findPlan, tracePlan, poseIndex, edgeKey, neighbor } from './maze.js';
import { LAYOUTS, SWITCH, KNOB_FACE, layoutForRound } from './layouts.js';
import { makeMaterials, makeBase, makeRing, gearLayout, makeFrame, makeGears, makeChest, makeRails, makePieceGlow, makeGems, makeFinaleFx, nodePosition } from './parts.js';

const IDS = ['ring-outer', 'ring-middle', 'ring-inner'];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (x) => { x = (x + Math.PI) % TAU; if (x < 0) x += TAU; return x - Math.PI; };
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

export function createHero(THREE, opts) {
  const V3 = THREE.Vector3;
  const low = opts.quality === 'low';
  const emit = (type, payload) => { try { opts.emit(type, payload); } catch (e) { /* シェル側の失敗で止めない */ } };
  const sound = (name, gain = 1, rate = 1, pan = 0) => emit('sound', { name, gain, rate, pan });

  const own = [];                                   // dispose するもの（材料）
  const keep = (x) => { own.push(x); return x; };
  const mats = makeMaterials(THREE, opts, keep);
  const G = new V3(P.G[0], P.G[1], P.G[2]);

  // ---------- 配置：使う前に「1 個がどの状態からも届く」ことを確かめる（1 配置 約 10ms、初めて使うときだけ）
  const layoutCache = new Map();
  function getLayout(index) {
    for (let k = 0; k < LAYOUTS.length; k++) {
      const def = LAYOUTS[(index + k) % LAYOUTS.length];
      if (!layoutCache.has(def.name)) {
        const Lx = compileLayout({ ...def, switch: SWITCH, knobFace: KNOB_FACE });
        Lx.ok = checkAnyState(Lx).ok;
        // 回転台が回っている間の表（切替の辺は全部閉じる）と、切替の辺の集合
        Lx.nextNone = new Int8Array(162);
        for (let i = 0; i < 162; i++) Lx.nextNone[i] = Lx.next[0][i] === Lx.next[1][i] ? Lx.next[0][i] : -1;
        Lx.edgeGate = new Set(Lx.edges.filter((e) => e.gate >= 0).map((e) => e.key));
        layoutCache.set(def.name, Lx);
      }
      const Lx = layoutCache.get(def.name);
      if (Lx.ok) return Lx;                           // 検査に落ちた配置は使わず、次の配置へ
    }
    throw new Error('hero: 使える配置がない');
  }

  // ---------- 組み立て
  const root = new THREE.Group();
  root.name = 'hero';
  const base = makeBase(THREE, mats, low);
  root.add(base.group);

  const gimbal = new THREE.Group();
  gimbal.position.copy(G);
  root.add(gimbal);
  const pivots = [new THREE.Group(), new THREE.Group(), new THREE.Group()];   // 外：Z、中：外の X、内：中の Y
  gimbal.add(pivots[0]); pivots[0].add(pivots[1]); pivots[1].add(pivots[2]);
  const AXES = [new V3(0, 0, 1), new V3(1, 0, 0), new V3(0, 1, 0)];
  const hitTargets = [];
  for (let i = 0; i < 3; i++) {
    const r = makeRing(THREE, i, mats, low);
    r.hit.userData.heroId = IDS[i];
    pivots[i].add(r.mesh, r.hit);
    hitTargets.push(r.hit);
  }
  const cube = pivots[2];
  const GL = gearLayout(THREE);
  cube.add(makeFrame(THREE, mats, low, GL));
  const gears = makeGears(THREE, mats, low, GL);
  gears.hit.userData.heroId = 'knob';
  hitTargets.push(gears.hit);
  cube.add(gears.turntable, gears.idler, gears.knobPivot);
  const chest = makeChest(THREE, mats, low);
  cube.add(chest.group);
  const railGroup = new THREE.Group();
  cube.add(railGroup);
  const pieceGlow = makePieceGlow(THREE, GL);
  const pieceGlowMesh = new THREE.Mesh(pieceGlow.geo, mats.glow);
  pieceGlowMesh.renderOrder = 5;
  gears.turntable.add(pieceGlowMesh);
  const gemMesh = makeGems(THREE, mats, low);
  cube.add(gemMesh);
  const fx = makeFinaleFx(THREE, mats, low);
  cube.add(fx.beam, fx.sparks);
  const colorTmp = new THREE.Color();
  for (let i = 0; i < 6; i++) gemMesh.setColorAt(i, colorTmp.set(P.gem.colors[i]));

  let L = null, rails = null, railMesh = null, glowMesh = null;
  const nodePos = [];
  for (let n = 0; n < 27; n++) nodePos.push(nodePosition(THREE, n, new V3()));
  function buildRails(layout) {
    if (railMesh) { railGroup.remove(railMesh, glowMesh); railMesh.geometry.dispose(); glowMesh.geometry.dispose(); }
    L = layout;
    rails = makeRails(THREE, L, mats, low, GL);
    railMesh = new THREE.Mesh(rails.rails, mats.steel);
    glowMesh = new THREE.Mesh(rails.glowGeo, mats.glow);
    glowMesh.renderOrder = 5;
    railGroup.add(railMesh, glowMesh);
  }

  // ---------- 状態
  const mkRotor = (i, step, R) => ({ i, step, R, theta: 0, target: 0, w: 0, mode: 'rest', e1: new V3(), prevPtr: NaN, far: false, tick: 0, wiggle: 0, lastSign: 0, lastRev: -9, armed: true, grabDetent: 0 });
  const rings = [0, 1, 2].map((i) => mkRotor(i, QUARTER, P.ring.R[i]));
  const knob = mkRotor(3, Math.PI, P.knob.r);
  knob.tw = { from: 0, to: 0, t: 1 }; knob.queued = false; knob.tooth = 0;
  const S = {
    stage: 'play', round: Math.max(1, opts.round | 0 || 1), collected: 0, total: 3, started: false,
    gems: [], roundHint: true, hint: { id: IDS[0], sign: 1 }, planKey: -1, glowDirty: true, settled: false,
    finaleT: 0, finalePhase: 0, lid: 0, lidKick: 9, completeSent: false, appear: 1, roll: 0,
    lamps: [], lampQueue: [], time: 0,
  };
  const state = { stage: 'play', round: S.round, collected: 0, total: 3 };
  const audio = { roll: 0, spin: 0 };
  const syncState = () => { state.stage = S.stage; state.round = S.round; state.collected = S.collected; state.total = S.total; };

  // ---------- 作業用（毎フレーム new しない）
  const wv = { a: new V3(), c: new V3(), q: new V3(), u: new V3(), t: new V3(), e2: new V3(), n: new V3(), cam: new V3(), p: new V3(), g: new V3(), d: new V3(), x: new V3() };
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qCube = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  const m4 = new THREE.Matrix4(), s3 = new V3();
  const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);
  const Q_AXIS = [new THREE.Quaternion(), new THREE.Quaternion().setFromAxisAngle(AZ, Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(AY, -Math.PI / 2)];
  const occ = new Int8Array(27), order = [];
  const byKeyDesc = (a, b) => b.key - a.key;
  const ringsAtRest = () => rings[0].mode === 'rest' && rings[1].mode === 'rest' && rings[2].mode === 'rest';
  let lastCam = null, lastView = null;

  // ---------- 回の準備
  function layout(round) {
    const pick = layoutForRound(round);
    const target = getLayout(pick.index);
    const starts = target.name === LAYOUTS[pick.index].name ? pick.starts : target.def.starts[pick.count][0];
    if (target !== L || !railMesh) buildRails(target);
    S.round = round; S.total = starts.length; S.collected = 0;
    S.gems = starts.map((node, i) => ({
      i, node, state: 'rest', from: node, to: node, dir: 0, t: 0, v: 0, roll: (i * 1.7) % TAU, axis: restAxis(node),
      pos: nodePos[node].clone(), base: new THREE.Quaternion(), scale: 0, born: 0.12 + i * 0.09, fx: 0, fz: 0, launch: 0,
    }));
    for (const g of S.gems) g.base.copy(Q_AXIS[g.axis]);
    S.lamps = starts.map(() => ({ lit: false, pop: 9, color: 0 }));
    S.lampQueue.length = 0;
    S.planKey = -1; S.glowDirty = true; S.settled = false; S.appear = 0;
    for (let i = 0; i < 6; i++) {
      const on = i < S.total;
      if (on) base.lampSlot(i, S.total, wv.p, qa); else wv.p.set(0, -5, 0);
      m4.compose(wv.p, on ? qa : qb.identity(), s3.setScalar(on ? 1 : 0));
      base.bezels.setMatrixAt(i, m4);
    }
    base.bezels.instanceMatrix.needsUpdate = true;
    syncState();
    replan();
  }
  // 止まっている宝石の軸：そのノードから出ている辺のどれか（レールが通っている向き）
  function restAxis(node) {
    for (let d = 0; d < 6; d++) if (L.next[0][node * 6 + d] >= 0 || L.next[1][node * 6 + d] >= 0) return d >> 1;
    return 0;
  }

  // ---------- §4 軸拘束アークボール
  function ringAxisWorld(i, out) {
    if (i === 3) return out.copy(AZ).applyQuaternion(cube.getWorldQuaternion(qa)).normalize();
    pivots[i].getWorldQuaternion(qa);                 // pivot 自身の軸は自分の回転で変わらない
    return out.copy(AXES[i]).applyQuaternion(qa).normalize();
  }
  const rotorCenter = (r, out) => (r.i === 3 ? gears.hit.getWorldPosition(out) : out.copy(G));
  // レイと球 |x−C| = R の交点 q（far なら向こう側。外れたら最近点を球面へ押し出す）→ 軸に垂直な面での角
  function pointerAngle(ray, C, a, R, e1, far) {
    const oc = wv.t.copy(ray.origin).sub(C);
    const b = oc.dot(ray.direction), c = oc.lengthSq() - R * R, disc = b * b - c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      let t = far ? -b + sq : -b - sq; if (t < 0) t = -b + sq;
      wv.q.copy(ray.direction).multiplyScalar(Math.max(0, t)).add(ray.origin);
    } else {
      wv.q.copy(ray.direction).multiplyScalar(-b).add(ray.origin).sub(C);
      const l = wv.q.length();
      if (l < 1e-6) return null;
      wv.q.multiplyScalar(R / l).add(C);
    }
    wv.u.copy(wv.q).sub(C);
    wv.u.addScaledVector(a, -wv.u.dot(a));
    if (wv.u.length() < 0.05 * R) return null;
    // e1 を今の軸に垂直に直す（他のリングがまだ動いていると軸が少し動く）
    wv.e2.copy(e1).addScaledVector(a, -e1.dot(a));
    const l1 = wv.e2.length();
    if (l1 < 1e-6) return null;
    wv.e2.multiplyScalar(1 / l1);
    wv.n.crossVectors(a, wv.e2);
    return Math.atan2(wv.n.dot(wv.u), wv.e2.dot(wv.u));
  }
  function pickE1(a, out) {
    out.set(0, 1, 0);
    if (Math.abs(a.y) > 0.9) out.set(1, 0, 0);
    out.addScaledVector(a, -out.dot(a));
    const l = out.length();
    return l > 1e-6 ? out.multiplyScalar(1 / l) : out.set(0, 0, 1);
  }
  function startGrab(r, input) {
    const a = ringAxisWorld(r.i, wv.a), C = rotorCenter(r, wv.c);
    pickE1(a, r.e1);
    // つかんだリングの点が球のはっきり向こう側（奥の弧）なら、向こう側の交点で追う。
    // 手前〜輪郭の近くは §4 のとおり手前側の交点（輪郭の点を中心へ引くと、その点が手前へ倒れる）。
    r.far = false;
    if (P.rotor.farSide > 0 && r.i < 3 && input.grab && input.grab.point) {
      pivots[r.i].worldToLocal(wv.p.copy(input.grab.point));
      const l = Math.hypot(wv.p.x, wv.p.y);
      if (l > 1e-6) {
        wv.p.set(wv.p.x * r.R / l, wv.p.y * r.R / l, 0);          // リングの中心線上のいちばん近い点
        pivots[r.i].localToWorld(wv.p).sub(C);
        r.far = wv.p.dot(input.pointer.ray.direction) > P.rotor.farSide * r.R;
      }
    }
    r.armed = r.i < 3;                                 // ノブは指が少し動くまで追わない（タップで暴れない）
    r.prevPtr = NaN;
    if (r.armed) { const ang = pointerAngle(input.pointer.ray, C, a, r.R, r.e1, r.far); r.prevPtr = ang === null ? NaN : ang; }
    r.mode = 'grab'; r.target = r.theta; r.grabDetent = Math.round(r.theta / r.step);
    S.roundHint = false;
    sound('grab', 0.9, r.i < 3 ? 1 + r.i * 0.12 : 1.5);
  }

  // 臨界減衰ばね（角速度の上限つき、反転は reverseGap 秒に 1 回まで）
  function spring(r, W, maxW, dt) {
    let w = r.w + (W * W * (r.target - r.theta) - 2 * W * r.w) * dt;
    w = clamp(w, -maxW, maxW);
    const sg = w > 0.08 ? 1 : w < -0.08 ? -1 : 0;
    if (sg && r.lastSign && sg !== r.lastSign) {
      if (S.time - r.lastRev < P.rotor.reverseGap) w = 0; else { r.lastRev = S.time; r.lastSign = sg; }
    } else if (sg && !r.lastSign) r.lastSign = sg;
    r.w = w; r.theta += w * dt;
  }
  function stepRotor(r, dt, grabbed, locked) {
    const R = P.rotor;
    if (grabbed) {
      if (locked) r.w = 0; else spring(r, R.follow, R.maxW, dt);
    } else if (r.mode === 'grab' || r.mode === 'coast') {
      r.mode = 'coast';
      r.w *= Math.exp(-R.coast * dt);
      if (!locked) r.theta += r.w * dt;
      if (Math.abs(r.w) < R.settleBelow) {
        // 最寄りの刻みへ。ただし、つかんだ刻みから commit 以上回していたら、その向きの次の刻みへ進める
        // （指の絵と同じ短いドラッグでも 1 刻み進む。戻したいときは元の近くで離せばよい）
        let k = Math.round(r.theta / r.step);
        const d = r.theta - r.grabDetent * r.step;
        if (R.commit > 0 && k === r.grabDetent && Math.abs(d) >= R.commit) k += Math.sign(d);
        r.mode = 'settle'; r.target = k * r.step;
      }
    } else if (r.mode === 'auto') {
      // 自動で正位置へ：速さ ≤ autoW（1 rad/s）。ゆっくり加速し、近づいたら比例して減速する。
      const x = r.target - r.theta, want = clamp(6 * x, -R.autoW, R.autoW);
      r.w = Math.abs(want) > Math.abs(r.w) ? r.w + clamp(want - r.w, -4 * dt, 4 * dt) : want;
      r.theta += r.w * dt;
      if (Math.abs(x) < 0.01) { r.theta = r.target; r.w = 0; r.mode = 'rest'; r.lastSign = 0; }
    } else if (r.mode === 'settle') {
      if (!locked) spring(r, R.settle, R.maxW, dt);
      if (Math.abs(r.target - r.theta) < 0.002 && Math.abs(r.w) < 0.02) { r.theta = r.target; r.w = 0; r.mode = 'rest'; r.lastSign = 0; }
    } else if (r.mode === 'tween') {
      if (!locked) {
        const before = r.theta;
        r.tw.t = Math.min(1, r.tw.t + dt / P.knob.tapTime);
        r.theta = r.tw.from + (r.tw.to - r.tw.from) * smooth(r.tw.t);
        r.w = dt > 0 ? (r.theta - before) / dt : 0;
        if (r.tw.t >= 1) { r.theta = r.target = r.tw.to; r.w = 0; r.mode = 'rest'; }
      }
    }
  }
  function updateRotor(r, dt, input, locked) {
    const id = r.i < 3 ? IDS[r.i] : 'knob';
    const grabbed = S.stage === 'play' && r.mode === 'grab' && input.grab && input.grab.id === id;
    if (grabbed) {
      if (!r.armed && Math.hypot(input.totalDX, input.totalDY) > 14) r.armed = true;
      if (r.armed) {
        const a = ringAxisWorld(r.i, wv.a), C = rotorCenter(r, wv.c);
        const ang = pointerAngle(input.pointer.ray, C, a, r.R, r.e1, r.far);
        if (ang !== null) { if (Number.isFinite(r.prevPtr)) r.target += wrap(ang - r.prevPtr); r.prevPtr = ang; }
      }
    }
    const n = Math.max(1, Math.ceil(dt / 0.009));       // 細かく刻んで積分（遅いフレームでもばねが暴れない）
    for (let k = 0; k < n; k++) stepRotor(r, dt / n, grabbed, locked);
    if (!Number.isFinite(r.theta) || !Number.isFinite(r.w)) { r.theta = Math.round((r.target || 0) / r.step) * r.step || 0; r.target = r.theta; r.w = 0; r.mode = 'rest'; }
    const idx = Math.round(r.theta / r.step);
    if (idx !== r.tick) {
      r.tick = idx;
      if (S.stage === 'play') { if (r.i < 3) sound('tick', 0.8, 1 + r.i * 0.15); else sound('switch', 0.9); }
      S.glowDirty = true;
    }
  }
  function tapKnob() {
    if (knob.mode === 'tween') return;
    knob.queued = false;
    knob.tw.from = knob.theta; knob.tw.to = (Math.round(knob.theta / Math.PI) + 1) * Math.PI; knob.tw.t = 0;
    knob.mode = 'tween';
    S.roundHint = false;
  }

  // ---------- 切替の状態。回転台が 90° 刻みに合っている間だけ辺が通る。
  const tableAngle = () => knob.theta * P.gear.zk / P.gear.zt;
  function tableState() {
    const th = tableAngle(), k = Math.round(th / QUARTER);
    return Math.abs(th - k * QUARTER) < 0.03 ? mod(k, 2) : -1;
  }
  const discreteSw = () => mod(Math.round(knob.theta / Math.PI), 2);
  const discretePose = () => poseIndex(Math.round(rings[0].theta / QUARTER), Math.round(rings[1].theta / QUARTER), Math.round(rings[2].theta / QUARTER));

  // ---------- 宝石の運動（レールに拘束。辺に乗ったら次のノードまで必ず進む）
  function stepGems(dt, gl) {
    const ph = P.phys, s = P.s;
    let dom = -1;
    for (let d = 0; d < 6; d++) { const v = DIR_VEC[d]; if (gl.x * v[0] + gl.y * v[1] + gl.z * v[2] > ph.thr) dom = d; }
    const ts = tableState();
    const nx = ts < 0 ? L.nextNone : L.next[ts];
    occ.fill(-1);
    order.length = 0;
    for (const g of S.gems) {
      if (g.state === 'rest') occ[g.node] = g.i;
      else if (g.state === 'move') { if (g.to !== CENTER) occ[g.to] = g.i; if (g.t < ph.clear) occ[g.from] = g.i; }
      if (g.state === 'rest' || g.state === 'move') { g.key = g.pos.dot(gl); order.push(g); }
    }
    order.sort(byKeyDesc);                            // 重力の向きに進んでいる宝石から（前が先に動く）
    let moving = 0, speed = 0, busy = false;
    for (const g of order) {
      if (g.state === 'rest') {
        if (dom < 0 || g.born > 0) continue;
        const m = nx[g.node * 6 + dom];
        if (m >= 0 && (m === CENTER || occ[m] < 0)) {
          g.state = 'move'; g.from = g.node; g.to = m; g.dir = dom; g.t = 0; g.v = 0; g.axis = dom >> 1;
          if (m !== CENTER) occ[m] = g.i;
          S.glowDirty = true; S.settled = false;
        }
        continue;
      }
      // 辺の上：加速度 = A·max(g·e, cMin) − μ
      const e = DIR_VEC[g.dir];
      const drive = Math.max(gl.x * e[0] + gl.y * e[1] + gl.z * e[2], ph.cMin);
      g.v = clamp(g.v + (ph.A * drive - ph.mu) * dt, ph.vMin, ph.vMax);
      const ds = g.v * dt;
      g.t += ds / s;
      g.roll += (g.dir & 1 ? -1 : 1) * ds / P.gem.r;   // 転がり：角 = 距離 / 半径
      moving++; speed = Math.max(speed, g.v);
      if (L.edgeGate.has(edgeKeyOf(g.from, g.to))) busy = true;
      if (g.to === CENTER) {
        if (g.t >= ph.goneAt) collect(g);
      } else if (g.t >= 1) {
        const node = g.to;
        const m = dom >= 0 ? nx[node * 6 + dom] : -1;
        if (m >= 0 && (m === CENTER || occ[m] < 0)) {
          const straight = dom === g.dir;
          g.v *= straight ? ph.keepStraight : ph.keepTurn;
          g.from = node; g.to = m; g.dir = dom; g.t = Math.min(g.t - 1, 0.3); g.axis = dom >> 1; g.node = node;
          if (m !== CENTER) occ[m] = g.i;
          if (!straight) sound('clack', 0.25, 1.3);
        } else {
          g.state = 'rest'; g.node = node; g.t = 0;
          sound('clack', clamp(0.3 + 0.7 * g.v / ph.vMax, 0, 1), 0.9 + 0.2 * (g.i % 3), clamp(gemWorldX(g) / 1.2, -1, 1));
          g.v = 0;
        }
        S.glowDirty = true;
      }
    }
    for (const g of S.gems) {
      if (g.state === 'rest') g.pos.copy(nodePos[g.node]);
      else if (g.state === 'move') g.pos.lerpVectors(nodePos[g.from], nodePos[g.to], clamp(g.t, 0, 1));
    }
    S.gatedBusy = busy;
    const target = moving ? clamp(0.35 + 0.65 * speed / ph.vMax, 0, 1) : 0;
    S.roll += (target - S.roll) * (1 - Math.exp(-dt * 10));
    return moving;
  }
  const edgeKeyOf = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); const d = hi - lo; return edgeKey(lo, d === 1 ? 0 : d === 3 ? 1 : 2); };
  const gemWorldX = (g) => wv.x.copy(g.pos).applyQuaternion(qCube).x;

  function collect(g) {
    if (g.state === 'gone') return;
    g.state = 'gone'; g.scale = 0;
    const k = S.collected;
    S.collected++;
    syncState();
    sound('drop', 1, 1 + k * 0.07);
    S.lidKick = 0;
    S.lampQueue.push({ slot: k, color: g.i, at: 0.28 });
    emit('progress', { collected: S.collected, total: S.total });
    S.glowDirty = true; S.planKey = -1;
    if (S.collected >= S.total) startFinale();
  }

  // ---------- ヒント：今の離散状態から「回収数が増える最短手順」を探し、最初の 1 手を覚える
  function replan() {
    const st = { pose: discretePose(), sw: discreteSw(), gems: S.gems.map((g) => (g.state === 'gone' ? -1 : g.state === 'move' ? (g.to === CENTER ? g.from : g.to) : g.node)) };
    let plan = findPlan(L, st);
    if (!plan) {
      // 念のため：1 個だけに注目した手順（どの状態からも必ずある）
      for (let i = 0; i < st.gems.length && !plan; i++) if (st.gems[i] >= 0) plan = findPlan(L, { pose: st.pose, sw: st.sw, gems: [st.gems[i]] });
    }
    S.planTrace = plan ? tracePlan(L, st, plan.moves) : null;
    if (plan && plan.moves.length) {
      const m = plan.moves[0];
      S.hint = m === MOVE_KNOB ? { id: 'knob', sign: 1 } : { id: MOVE_IDS[m >> 1], sign: m & 1 ? -1 : 1 };
    }
    S.glowDirty = true; hintCache.valid = false;
  }

  // ---------- レールの光：動いている宝石の行き先（強く）／止まっているときはヒントの手順で宝箱へ届く道（弱く）
  function setSeg(from, to, intensity, sIndex) {
    const info = rails.edgeInfo.get(edgeKeyOf(from, to));
    if (!info) return;
    const fwd = from === info.a, arr = rails.aGlow.array, tau = rails.tau;
    for (let j = info.start; j < info.start + info.count; j++) {
      arr[j * 2] = Math.max(arr[j * 2], intensity);
      arr[j * 2 + 1] = fwd ? sIndex + tau[j] : sIndex + 1 - tau[j];
    }
    if (from === L.switchNode || to === L.switchNode) {
      const outer = from === L.switchNode ? to : from;
      const d = nodeDir(L.switchNode, outer);
      if (d < 0 || (d >> 1) === L.switchAxis) return;
      // レール片の +X 側が今どの向きを指しているか（回転台 90° ごとに +X, +Y, −X, −Y）
      const k = mod(Math.round(tableAngle() / QUARTER), 4);
      const plus = [0, 2, 1, 3][k];
      const half = d === plus ? 0 : 1;
      const pa = pieceGlow.aGlow.array, pt = pieceGlow.tau, inward = from === outer;
      for (let j = half * pieceGlow.perHalf; j < (half + 1) * pieceGlow.perHalf; j++) {
        pa[j * 2] = Math.max(pa[j * 2], intensity);
        pa[j * 2 + 1] = inward ? sIndex + pt[j] : sIndex + 1 - pt[j];
      }
    }
  }
  function nodeDir(a, b) { for (let d = 0; d < 6; d++) if (neighbor(a, d) === b) return d; return -1; }
  function refreshGlow(gl) {
    S.glowDirty = false;
    rails.aGlow.array.fill(0); pieceGlow.aGlow.array.fill(0);
    let any = false;
    if (S.stage === 'play') {
      let dom = -1;
      for (let d = 0; d < 6; d++) { const v = DIR_VEC[d]; if (gl.x * v[0] + gl.y * v[1] + gl.z * v[2] > P.phys.thr) dom = d; }
      const ts = tableState(), nx = ts < 0 ? L.nextNone : L.next[ts];
      for (const g of S.gems) {
        if (g.state !== 'move') continue;
        any = true;
        let k = 0, n = g.to;
        setSeg(g.from, g.to, 1.4, k++);
        while (dom >= 0 && n !== CENTER && k < 4) { const m = nx[n * 6 + dom]; if (m < 0) break; setSeg(n, m, 1.4, k++); n = m; }
      }
      if (!any && S.planTrace) {
        const idx = [];
        for (const sg of S.planTrace.segs) {
          if (!S.planTrace.collected.includes(sg.gem)) continue;
          idx[sg.gem] = idx[sg.gem] || 0;
          setSeg(sg.from, sg.to, 0.75, idx[sg.gem]++);
          any = true;
        }
      }
    }
    rails.aGlow.needsUpdate = true; pieceGlow.aGlow.needsUpdate = true;
    glowMesh.visible = any; pieceGlowMesh.visible = any;
  }

  // ---------- 最後の見せ場
  function startFinale() {
    S.stage = 'finale'; S.finaleT = 0; S.finalePhase = 0; S.completeSent = false;
    syncState();
    // 正位置：(0,0,0) か (π,π,π)（どちらも R = 単位行列でリングは同じ面）。回す量の少ない方へ、≤ 1 rad/s。
    const cost = [0, 0];
    for (let c = 0; c < 2; c++) for (const r of rings) cost[c] = Math.max(cost[c], Math.abs(wrap(r.theta - c * Math.PI)));
    const home = cost[0] <= cost[1] ? 0 : Math.PI;
    for (const r of rings) { r.mode = 'auto'; r.target = r.theta - wrap(r.theta - home); r.lastSign = 0; }
    emit('stage', { stage: 'finale', focus: G.clone() });
    sound('whoosh');
    S.glowDirty = true;
  }
  function updateFinale(dt) {
    const F = P.finale, c = P.chest;
    S.finaleT += dt;
    if (S.finalePhase === 0) {
      // リングが戻るのを待つ間、ふたがかたかた鳴る
      S.lid = 0.05 * Math.max(0, Math.sin(S.finaleT * 22)) * smooth(S.finaleT / 0.5);
      if (ringsAtRest() && S.finaleT >= F.minWait) {
        S.finalePhase = 1; S.finaleT = 0;
        sound('chest');
        for (const g of S.gems) { g.state = 'show'; g.launch = 0.12 + g.i * 0.13; g.scale = 0; }
      }
      return;
    }
    const T = S.finaleT;
    // ふた：0.45 秒で開き、少し行き過ぎて戻る
    const t = clamp(T / c.openTime, 0, 1), c1 = 1.70158, c3 = c1 + 1;
    S.lid = (1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)) * c.open;
    // 宝石：放物線で噴き上がり、箱の上の輪に並んで回る
    const n = S.gems.length;
    for (const g of S.gems) {
      const i = g.i, u = clamp((T - g.launch) / 0.95, 0, 1);
      if (T < g.launch) { g.scale = 0; continue; }
      const ang = i * TAU / n + T * F.orbitW;
      const k = smooth(u);
      const bob = 0.04 * Math.sin(T * 2.6 + i * 1.3) * k;
      g.pos.set(Math.cos(ang) * F.orbitR * k, c.bodyTop + (F.orbitY - c.bodyTop) * u + 0.34 * Math.sin(Math.PI * u) + bob, Math.sin(ang) * F.orbitR * k);
      g.scale = 0.4 + 1.1 * smooth(u * 2);
      g.roll += dt * (5 - 2.5 * k);
      g.axis = 1;
    }
    if (Math.floor((T - dt) / 0.55) !== Math.floor(T / 0.55) && T < F.show) sound('sparkle', 0.7, 1 + 0.1 * Math.floor(T / 0.55));
    // 光の柱と、きらきらの噴水（粒は放物線：p = v·τ + ½·g·τ²、1.3 秒ごとにくり返す）
    mats.beam.uniforms.uAlpha.value = 0.85 * smooth(T / 0.5) * (0.85 + 0.15 * Math.sin(T * 5));
    mats.beam.uniforms.uTime.value = T;
    fx.beam.visible = fx.sparks.visible = true;
    const sp = fx.sparks.geometry.attributes.position;
    for (let i = 0; i < fx.count; i++) {
      const sd = fx.seeds[i], tau = ((T / 1.3 + sd.phase) % 1) * 1.3;
      if (T < sd.phase * 1.3 * 0.35) { sp.setXYZ(i, 0, -9, 0); continue; }
      sp.setXYZ(i, Math.cos(sd.a) * sd.out * tau, c.bodyTop + 0.03 + sd.up * tau - 0.5 * 1.9 * tau * tau, Math.sin(sd.a) * sd.out * tau);
    }
    sp.needsUpdate = true;
    if (T > F.show && !S.completeSent) {
      S.completeSent = true; S.stage = 'complete'; syncState();
      emit('stage', { stage: 'complete' });
    }
  }

  // ---------- 毎フレーム
  function update(dt, input) {
    if (!S.started) { S.started = true; emit('stage', { stage: 'play' }); emit('progress', { collected: S.collected, total: S.total }); }
    if (!(dt > 0)) dt = 0;
    S.time = input.time;
    lastCam = input.camera; lastView = input.viewport;

    if (S.stage === 'play') {
      if (input.pressedId) {
        const i = IDS.indexOf(input.pressedId);
        if (i >= 0) startGrab(rings[i], input); else if (input.pressedId === 'knob' && knob.mode !== 'tween') startGrab(knob, input);
      }
      if (input.releasedId) sound('release', 0.7);
      if (input.tapId === 'knob') { if (knob.mode === 'grab') knob.mode = 'rest'; knob.queued = true; }
    }
    if (knob.queued && !S.gatedBusy && S.stage === 'play') tapKnob();

    for (const r of rings) updateRotor(r, dt, input, false);
    updateRotor(knob, dt, input, !!S.gatedBusy);
    const tooth = Math.floor(knob.theta / (TAU / P.gear.zk));
    if (tooth !== knob.tooth) { knob.tooth = tooth; if (S.stage === 'play') sound('gear', 0.6); }

    // 姿勢 R = Rz(θ1)·Rx(θ2)·Ry(θ3) と、立方体ローカルの重力 g = R^T·(0,−1,0)
    qCube.setFromAxisAngle(AZ, rings[0].theta).multiply(qa.setFromAxisAngle(AX, rings[1].theta)).multiply(qa.setFromAxisAngle(AY, rings[2].theta));
    qInv.copy(qCube).invert();
    const gl = wv.g.set(0, -1, 0).applyQuaternion(qInv);

    // 宝石
    for (const g of S.gems) if (g.born > 0) { g.born -= dt; if (g.born <= 0 && S.stage === 'play') sound('pop', 0.35, 1.2 + g.i * 0.1); }
    let moving = 0;
    if (S.stage === 'play') {
      moving = stepGems(dt, gl);
      const quiet = !moving && knob.mode === 'rest' && ringsAtRest();
      if (quiet && S.stage === 'play') {
        const key = discretePose() * 2 + discreteSw();
        if (!S.settled || key !== S.planKey) { S.settled = true; S.planKey = key; replan(); }
      } else if (!quiet) S.settled = false;
    } else {
      S.roll += (0 - S.roll) * (1 - Math.exp(-dt * 10));
      updateFinale(dt);
    }
    S.appear = Math.min(1, S.appear + dt / 0.5);

    // 止まったときの見せ方：次に効く操作部を光らせ（0.5Hz）、軸まわりに ±4° 揺らす（1Hz）
    const glowOn = S.stage === 'play' && !input.grab && (S.roundHint || input.idle >= P.hint.after);
    const pulse = P.hint.glowLo + (P.hint.glowHi - P.hint.glowLo) * (0.5 + 0.5 * Math.sin(input.time * Math.PI));
    const party = S.stage !== 'play' && S.finalePhase === 1;                 // 見せ場：3 つのリングが順に光る
    for (const r of rings) {
      const on = glowOn && S.hint.id === IDS[r.i];
      mats.rings[r.i].emissiveIntensity = on ? pulse : party ? 0.32 * (0.5 + 0.5 * Math.sin(input.time * 4.5 - r.i * 1.4)) : 0;
      const wt = on && !opts.reducedMotion && r.mode === 'rest' ? Math.sin(input.time * TAU) * P.hint.wiggle : 0;
      r.wiggle += (wt - r.wiggle) * (1 - Math.exp(-dt * 8));
    }
    const knobOn = glowOn && S.hint.id === 'knob';
    mats.knob.emissiveIntensity = knobOn ? pulse : 0;
    gears.handle.position.z = knobOn && !opts.reducedMotion ? 0.012 * (0.5 + 0.5 * Math.sin(input.time * TAU)) : 0;

    // 形へ反映（連動は全部ここの式）
    pivots[0].rotation.z = rings[0].theta + rings[0].wiggle;
    pivots[1].rotation.x = rings[1].theta + rings[1].wiggle;
    pivots[2].rotation.y = rings[2].theta + rings[2].wiggle;
    const rollAngle = -(rings[0].theta + rings[0].wiggle) * (P.ring.R[0] + P.ring.t[0]) / P.roller.r;
    for (let k = 0; k < 2; k++) {
      m4.compose(base.rollerPos[k], qa.setFromAxisAngle(AZ, rollAngle), s3.setScalar(1));
      base.rollers.setMatrixAt(k, m4);
    }
    base.rollers.instanceMatrix.needsUpdate = true;
    gears.knobPivot.rotation.z = knob.theta + GL.phaseK;
    gears.idler.rotation.z = -knob.theta * P.gear.zk / P.gear.zi + GL.phaseI;
    gears.turntable.rotation.z = tableAngle();
    // ノブは手前を向いているときだけ押せる（n·v > 0.2）
    root.updateMatrixWorld();
    gears.hit.getWorldPosition(wv.p);
    wv.n.copy(AZ).applyQuaternion(cube.getWorldQuaternion(qa));
    wv.cam.copy(input.camera.position).sub(wv.p);
    const cl = wv.cam.length();
    gears.hit.userData.heroEnabled = S.stage === 'play' && cl > 1e-6 && wv.n.dot(wv.cam) / cl > 0.2;

    // 宝箱のふた（回収のたびにぴょこ）
    S.lidKick += dt;
    const kick = S.stage === 'play' ? 0.3 * Math.sin(Math.PI * clamp(S.lidKick / 0.28, 0, 1)) : 0;
    chest.lidPivot.rotation.x = -(S.stage === 'play' ? kick : S.lid);
    chest.treasure.visible = -chest.lidPivot.rotation.x > 0.02;

    // ランプ
    for (let q = S.lampQueue.length - 1; q >= 0; q--) {
      const it = S.lampQueue[q];
      it.at -= dt;
      if (it.at <= 0) { const lp = S.lamps[it.slot]; if (lp) { lp.lit = true; lp.pop = 0; lp.color = it.color; } sound('pop', 0.6, 1 + it.slot * 0.12); S.lampQueue.splice(q, 1); }
    }
    for (let i = 0; i < 6; i++) {
      const lp = S.lamps[i];
      if (!lp) { m4.compose(wv.p.set(0, -5, 0), qb.identity(), s3.setScalar(0)); base.lamps.setMatrixAt(i, m4); continue; }
      lp.pop += dt;
      base.lampSlot(i, S.total, wv.p, qa);
      const bump = lp.lit ? 1 + 0.45 * Math.sin(Math.PI * clamp(lp.pop / 0.35, 0, 1)) : 1;
      m4.compose(wv.p, qa, s3.setScalar(bump * smooth(S.appear * 1.5)));
      base.lamps.setMatrixAt(i, m4);
      if (lp.lit) { const tw = 2.1 + 0.25 * Math.sin(input.time * 3 + i); colorTmp.set(P.gem.colors[lp.color]).multiplyScalar(tw); } else colorTmp.setRGB(0.2, 0.17, 0.24);
      base.lamps.setColorAt(i, colorTmp);
    }
    base.lamps.instanceMatrix.needsUpdate = true;
    if (base.lamps.instanceColor) base.lamps.instanceColor.needsUpdate = true;

    // 宝石の描画（立方体ローカル）
    const tAng = tableAngle();
    for (let i = 0; i < 6; i++) {
      const g = S.gems[i];
      if (!g || g.state === 'gone') { m4.compose(wv.p.set(0, 0, 0), qb.identity(), s3.setScalar(0)); gemMesh.setMatrixAt(i, m4); continue; }
      let scale = g.scale;
      if (g.state === 'rest' || g.state === 'move') {
        scale = g.born > 0 ? 0 : 1 + 0.35 * Math.sin(Math.PI * clamp(-g.born / 0.3, 0, 1));
        if (g.state === 'move' && g.to === CENTER) scale *= 1 - 0.8 * smooth((g.t - P.phys.sinkAt) / (P.phys.goneAt - P.phys.sinkAt));
      }
      // 向き：レールの軸に通る。回転台の上で止まっているときは回転台と一緒に回る
      if (g.state === 'rest' && g.node === L.switchNode && g.axis !== L.switchAxis) qa.setFromAxisAngle(AZ, tAng);
      else qa.copy(Q_AXIS[g.axis]);
      if (g.base.dot(qa) < 0) { qa.x = -qa.x; qa.y = -qa.y; qa.z = -qa.z; qa.w = -qa.w; }
      g.base.slerp(qa, 1 - Math.exp(-dt * 14));
      qb.setFromAxisAngle(AX, g.roll);
      qa.copy(g.base).multiply(qb);
      m4.compose(g.pos, qa, s3.setScalar(Math.max(0, scale)));
      gemMesh.setMatrixAt(i, m4);
    }
    gemMesh.instanceMatrix.needsUpdate = true;
    railGroup.scale.setScalar(0.9 + 0.1 * smooth(S.appear * 1.4));

    if (S.glowDirty) refreshGlow(gl);
    mats.glow.uniforms.uTime.value = input.time % 1000;

    audio.roll = S.roll;
    audio.spin = clamp(Math.max(Math.abs(rings[0].w), Math.abs(rings[1].w), Math.abs(rings[2].w), Math.abs(knob.w) * 0.5) / P.rotor.maxW, 0, 1);
  }

  // ---------- getHint：触る場所とドラッグの向き（HERO-SPEC §6）
  // 候補＝リング上の点。その点が回したい向きに 1 rad あたり動く量 t = ±a×(p−C) を使う。
  //   ・t を画面に投影した長さが 0.35·R·pxPerUnit 以上 → その点を t の向きへドラッグ
  //   ・足りない（t が奥行き方向）→ 輪郭の点で t が手前向きのものを、中心へ向けてドラッグ（手前へ倒す）
  // 候補はレイを飛ばして「そのリングのヒット代理に最初に当たる」ことを確かめる。状態が変わったときだけ計算する。
  const hintCache = { valid: false, id: -1, sign: 0, th: [9, 9, 9], cam: new V3(), w: 0, point: new V3(), dir: new V3(), axis: new V3(), axisOk: false };
  // axis/center（任意の追加項目）：point を center まわりに axis で +角 回すと「回したい向き」に動く。シェルの指の絵が円弧をなぞるのに使う。
  const hintOut = { id: IDS[0], point: new V3(), dir: new V3(), axis: null, center: G.clone() };
  const hintTap = { id: 'knob', point: new V3(), dir: null };
  const ray = new THREE.Raycaster();
  const hv = { a: new V3(), vC: new V3(), p: new V3(), rel: new V3(), tv: new V3(), s0: new V3(), s1: new V3(), bestP: new V3(), bestT: new V3() };
  const hitList = [];
  function ringHint(i, sign) {
    const R = P.ring.R[i], a = ringAxisWorld(i, hv.a);
    const cam = lastCam ? lastCam.position : wv.cam.set(0, 2.9, 6.1);
    const vC = hv.vC.subVectors(cam, G).normalize();
    const ppu = lastView ? lastView.pxPerUnit : 245;
    const { p, rel, tv, s0, s1 } = hv;
    hitList.length = 0;
    for (const o of hitTargets) if (o.userData.heroEnabled !== false) hitList.push(o);
    const N = 24;
    let bestScore = -1, bestTangent = false, fallbackScore = -1;
    for (let pass = 0; pass < 2 && bestScore < 0; pass++) {         // 1 回目：当たりを確かめる。全部だめなら 2 回目：確かめずに選ぶ
      for (let k = 0; k < N; k++) {
        const al = k * TAU / N;
        p.set(R * Math.cos(al), R * Math.sin(al), 0);
        pivots[i].localToWorld(p);
        rel.subVectors(p, G);
        tv.crossVectors(a, rel).multiplyScalar(sign);
        if (tv.length() / R < 0.5) continue;                          // 軸に近い点は回しにくい
        const depth = rel.dot(vC) / R;                                // +1 手前、0 が輪郭、−1 向こう
        if (depth < -0.3) continue;                                   // 奥の弧は使わない
        let px = R * ppu;
        if (lastCam && lastView) {
          s0.copy(p).project(lastCam); s1.copy(p).addScaledVector(tv, 0.2).project(lastCam);
          px = Math.hypot((s1.x - s0.x) * lastView.width / 2, (s1.y - s0.y) * lastView.height / 2) / 0.2;
        }
        const toward = tv.dot(vC) / R;                                // 手前へ動く度合い
        const nice = 0.06 * (rel.x * 0.6 + rel.y * 0.8) / R;          // 同じなら右上（外リングのハンドルの側）
        let score = -1, tangent = false;
        if (toward > 0.55 && Math.abs(depth) < 0.45) score = 1.2 + toward + nice;
        else if (px >= 0.35 * R * ppu && depth > -0.15) { score = px / (R * ppu) + 0.3 * depth + nice; tangent = true; }
        if (score <= bestScore || score < 0) continue;
        if (pass === 0) {
          ray.set(cam, s0.subVectors(p, cam).normalize());
          const hits = ray.intersectObjects(hitList, false);
          if (!hits.length || hits[0].object.userData.heroId !== IDS[i]) { fallbackScore = Math.max(fallbackScore, score); continue; }
        }
        bestScore = score; bestTangent = tangent; hv.bestP.copy(p); hv.bestT.copy(tv);
      }
      if (fallbackScore < 0) break;
    }
    if (bestScore < 0) { hv.bestP.set(R * 0.707, R * 0.707, 0); pivots[i].localToWorld(hv.bestP); bestTangent = false; }
    hintCache.point.copy(hv.bestP);
    if (bestTangent) hintCache.dir.copy(hv.bestT); else hintCache.dir.subVectors(G, hv.bestP);
    if (hintCache.dir.lengthSq() < 1e-10) hintCache.dir.set(0, -1, 0);
    hintCache.dir.normalize();
    hintCache.axisOk = bestScore >= 0;
    hintCache.axis.copy(a).multiplyScalar(sign);
  }
  function getHint() {
    if (S.stage !== 'play') return null;
    let id = S.hint.id, sign = S.hint.sign;
    root.updateMatrixWorld();
    if (id === 'knob' && gears.hit.userData.heroEnabled === false) { id = IDS[0]; sign = 1; }
    if (id === 'knob') { gears.hit.getWorldPosition(hintTap.point); return hintTap; }
    const i = IDS.indexOf(id), c = hintCache;
    const cam = lastCam ? lastCam.position : wv.cam.set(0, 0, 0), w = lastView ? lastView.width : 0;
    const same = c.valid && c.id === i && c.sign === sign && c.w === w && c.cam.distanceToSquared(cam) < 1e-6
      && Math.abs(c.th[0] - rings[0].theta) < 0.01 && Math.abs(c.th[1] - rings[1].theta) < 0.01 && Math.abs(c.th[2] - rings[2].theta) < 0.01;
    if (!same) {
      c.valid = true; c.id = i; c.sign = sign; c.w = w; c.cam.copy(cam);
      for (let k = 0; k < 3; k++) c.th[k] = rings[k].theta;
      ringHint(i, sign);
    }
    hintOut.id = id; hintOut.point.copy(c.point); hintOut.dir.copy(c.dir);
    hintOut.axis = c.axisOk ? c.axis : null;
    return hintOut;
  }

  // ---------- 次の回・煙テスト用・後始末
  function reset(o = {}) {
    S.stage = 'play'; S.finaleT = 0; S.finalePhase = 0; S.completeSent = false; S.roundHint = true; S.lid = 0; S.lidKick = 9; S.gatedBusy = false;
    fx.beam.visible = fx.sparks.visible = false;
    // リングは正位置（R = 単位行列）のまま。角は 90° 刻みにそろえる。
    for (const r of rings) { r.theta = r.target = Math.round(r.theta / QUARTER) * QUARTER; r.w = 0; r.mode = 'rest'; r.tick = Math.round(r.theta / r.step); r.wiggle = 0; r.lastSign = 0; }
    const dp = discretePose();
    if (dp !== poseIndex(0, 0, 0) && dp !== poseIndex(2, 2, 2)) for (const r of rings) { r.theta = r.target = 0; r.tick = 0; }
    // 切替は状態 0 から始める（奇数回なら回して戻す）
    knob.queued = false; knob.w = 0; knob.mode = 'rest';
    knob.theta = knob.target = Math.round(knob.theta / Math.PI) * Math.PI;
    if (discreteSw() === 1) { knob.tw.from = knob.theta; knob.tw.to = knob.theta + Math.PI; knob.tw.t = 0; knob.mode = 'tween'; }
    knob.tick = Math.round(knob.theta / knob.step);
    layout(Math.max(1, (o.round | 0) || S.round + 1));
    emit('stage', { stage: 'play' });
    emit('progress', { collected: S.collected, total: S.total });
    sound('whoosh', 0.6);
  }

  function debugAdvance() {
    if (S.stage === 'play') {
      const g = S.gems.find((x) => x.state === 'move') || S.gems.find((x) => x.state === 'rest');
      if (g) collect(g);
    } else if (S.stage === 'finale') {
      for (const r of rings) { r.theta = r.target; r.w = 0; r.mode = 'rest'; }
      if (S.finalePhase === 0) { S.finalePhase = 1; for (const g of S.gems) { g.state = 'show'; g.launch = 0.12 + g.i * 0.13; } }
      S.finaleT = P.finale.show + 0.01;
      updateFinale(0);
    }
  }

  function dispose() {
    root.removeFromParent();
    const geos = new Set();
    root.traverse((o) => { if (o.geometry) geos.add(o.geometry); });
    for (const g of geos) g.dispose();
    for (const x of own) x.dispose();
    for (const im of [...base.instanced, gemMesh]) im.dispose();
  }

  layout(S.round);
  S.appear = 1;
  for (const g of S.gems) g.born = 0;

  return {
    root,
    bounds: { center: new V3(0, 1.6, 0), radius: 1.9 },
    update,
    getHitTargets: () => hitTargets,
    getHint,
    audio,
    state,
    reset,
    debugAdvance,
    dispose,
    onContextRestored() { /* 自前の RenderTarget は無い（形とテクスチャは three が再転送する） */ },
  };
}
