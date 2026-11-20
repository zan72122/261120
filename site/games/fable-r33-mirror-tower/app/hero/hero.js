// 鏡の塔：主役の仕掛け（hero）。API は docs/HERO-SPEC.md。
//
//   指 → ハンドル φ →（歯車 z1:z2）→ 鏡 θ → 法線 n(θ) → 反射 r = d − 2(d·n)n → 光路 → 受け手の機械
//
//   受け手：色の柱（歯車のドラム＋カム）、回る宝石（歯車列）、花（スライダ・クランク＋ラック＆ピニオン）、
//           てっぺんの大きな花（同じ花の機械＋遊星歯車）。全部起きたら、てっぺんで見せ場。
//
// ファイル：layout.js（寸法・配置）、mech.js（機構の式）、optics.js（鏡と光線の式）、geom.js（形の生成）、
//           station.js（鏡・歯車・ハンドル）、receivers.js（ランプ・柱・宝石）、flower.js（花・遊星歯車）。
import { PARAMS, deriveLayout } from './layout.js';
import { createGeom } from './geom.js';
import { trace, makePath, setMirrorAngle } from './optics.js';
import { TAU, clamp, clamp01, smooth, nearestHalfTurn } from './mech.js';
import { buildStation } from './station.js';
import { buildLamp, buildPillar, buildGemStand } from './receivers.js';
import { createFlowers, buildPlanetary } from './flower.js';

export { PARAMS };

export function createHero(THREE, opts) {
  opts = opts || {};
  const P = PARAMS, D = P.drive;
  const L = deriveLayout(P);
  const G = createGeom(THREE);
  const emit = (e) => { try { if (opts.onEvent) opts.onEvent(e); } catch (_) { /* シェル側の失敗で止めない */ } };
  const sound = (name, extra) => emit(Object.assign({ type: 'sound', name }, extra));
  const loadTex = (n) => { try { return opts.loadTexture ? opts.loadTexture(n) : null; } catch (_) { return null; } };

  const root = new THREE.Group();
  root.name = 'hero';
  const owned = []; // hero が作った geometry / material / texture（dispose するもの）
  const own = (x) => { owned.push(x); return x; };

  // ---- テクスチャ：真鍮・虹（シェルの持ち物）＋花びら（hero が作る 64×128）----
  const brassTex = loadTex('brass_frame');
  const prismTex = loadTex('prism_rainbow');
  const petalTex = own(makePetalTexture());

  // ---- 材質 ----
  const mats = {
    brass: own(new THREE.MeshStandardMaterial({ map: brassTex, vertexColors: true, metalness: 0.62, roughness: 0.42 })),
    paint: own(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.5 })),
    glass: own(new THREE.MeshStandardMaterial({ color: 0xf2f7ff, metalness: 1.0, roughness: 0.05 })),
    gem: own(new THREE.MeshStandardMaterial({ map: prismTex, metalness: 0.2, roughness: 0.12 })),
    petal: own(new THREE.MeshStandardMaterial({ map: petalTex, vertexColors: true, side: THREE.DoubleSide, metalness: 0.0, roughness: 0.62 })),
    glow: own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
    lamp: own(new THREE.MeshBasicMaterial({ color: 0xffe590, toneMapped: false })),
    shadow: own(new THREE.MeshBasicMaterial({ map: opts.shared ? opts.shared.blobShadow : null, color: 0x1a1408, transparent: true, opacity: 0.34, depthWrite: false })),
    hit: own(new THREE.MeshBasicMaterial()),
  };
  // 真鍮テクスチャ（黄土色）に掛ける色。1 より大きい値で明るい金、青を上げると鉄色になる
  const col = {
    brass: [1, 1, 1], bright: [1.35, 1.45, 1.9], bronze: [0.5, 0.52, 0.95], iron: [0.42, 0.72, 4.2],
    copper: [1.3, 0.72, 1.1], pollen: [1.6, 1.9, 1.6], stem: G.rgb(0x5fae6a), leaf: G.rgb(0x74c476),
  };

  const ctx = {
    THREE, G, mats, col, root, own, P,
    staticB: new G.Builder(), paintB: new G.Builder(), shadows: [],
    hitGeo: own(new THREE.SphereGeometry(1, 10, 8)),
    gems: null,
  };

  // ---- 宝石（共有 InstancedMesh：大きな宝石1＋遊星の上の小さな宝石）----
  {
    const gb = new G.Builder(), g = P.gem;
    G.gem(gb, { R: g.radius, n: g.facets, table: g.table, crownAngle: g.crownAngle, pavilionAngle: g.pavilionAngle }, [1, 1, 1]);
    const mesh = new THREE.InstancedMesh(own(gb.build()), mats.gem, 1 + P.crown.planet.count);
    mesh.name = 'gems';
    mesh.frustumCulled = false;
    mesh.count = 0;
    root.add(mesh);
    ctx.gems = { mesh, dirty: true, alloc(n) { const i = mesh.count; mesh.count += n; return i; } };
  }

  // ---- 組み立て ----
  buildLamp(ctx, L, P);
  const stations = L.mirrors.map((m) => buildStation(ctx, m, P));
  const stationById = {};
  for (const st of stations) { stationById[st.id] = st; ctx.shadows.push(st.shadowAt); }
  const handles = stations.map((st) => st.handle);

  const receivers = L.receivers.map((def) => ({
    id: def.id, def, cfg: def.cfg, lit: 0, charge: 0, awake: false, wakeT: 0, machine: null,
    pos: new THREE.Vector3(def.c.x, def.shape === 'cylinder' ? def.y1 + 0.35 : def.c.y, def.c.z),
  }));
  const rxById = {};
  for (const rx of receivers) rxById[rx.id] = rx;

  rxById.pillar.machine = buildPillar(ctx, rxById.pillar.def, P);
  rxById.gem.machine = buildGemStand(ctx, rxById.gem.def, P);

  const flowers = createFlowers(ctx, P, 2, P.flower.petals + P.crown.petals);
  const fm = P.flowerMachine;
  function plantFlower(cfg, center) {
    const A = [0, Math.cos(cfg.tilt), Math.sin(cfg.tilt)];
    const k = 0.45 * fm.petalLength * cfg.scale; // つぼみの中心 = 当たりの中心
    const H = [center.x - A[0] * k, center.y - A[1] * k, center.z - A[2] * k];
    const fl = flowers.add({ H, A, S: cfg.scale, count: cfg.petals, color: cfg.color, color2: cfg.color2 });
    return { fl, H, A, state: flowers.makeState(fl), foot: fl.P3(0, fm.tubeBottom, 0) };
  }
  // 花：茎は途中から真っすぐ床へ。葉が2枚
  const flo = plantFlower(P.flower, rxById.flower.def.c);
  {
    const tb = flo.foot;
    G.rod(ctx.paintB, tb, [tb[0], 0.26, tb[2]], 0.05, col.stem, { seg: 8 });
    G.ball(ctx.paintB, tb, 0.062, col.stem, { ws: 8, hs: 6 });
    G.lathe(ctx.staticB, [[0.36, 0], [0.36, 0.045], [0.24, 0.1], [0.1, 0.2], [0.065, 0.3], [0, 0.3]], G.mt(tb[0], 0, tb[2]), col.bronze, { seg: 12 });
    for (const [y, yaw, side] of [[0.75, 0.5, 1], [1.12, 2.6, -1]]) {
      const m = G.compose(G.mry(yaw), G.mrz(0.5), G.mscale(1, 0.14, 0.48));
      G.ball(ctx.paintB, [tb[0] + Math.cos(yaw) * 0.26, y + 0.12, tb[2] - Math.sin(yaw) * 0.26 * side], 0.3, col.leaf, { ws: 8, hs: 5, m });
    }
    ctx.shadows.push([tb[0], tb[2], 0.95]);
  }
  rxById.flower.machine = { update: flo.state.update, reset: flo.state.reset };
  // てっぺんの大きな花：奥の柱の上。まわりに遊星歯車
  const crn = plantFlower(P.crown, rxById.crown.def.c);
  const planetary = buildPlanetary(ctx, P, crn.H, crn.A);
  {
    const tb = crn.foot;
    G.lathe(ctx.staticB, [[0.5, 0], [0.5, 0.06], [0.37, 0.13], [0.19, 0.27], [0.125, 0.46], [0.1, tb[1] - 0.2], [0.15, tb[1] - 0.1], [0.15, tb[1] + 0.02], [0, tb[1] + 0.07]],
      G.mt(tb[0], 0, tb[2]), col.bronze, { seg: 14 });
    ctx.shadows.push([tb[0], tb[2], 1.3]);
  }
  rxById.crown.machine = {
    update(dt, rx, env) { crn.state.update(dt, rx, env); planetary.update(dt, rx, env); },
    reset() { crn.state.reset(); planetary.reset(); },
  };

  // 動かない部分は 2 draw call（真鍮／塗装）
  const staticMesh = new THREE.Mesh(own(ctx.staticB.build()), mats.brass);
  staticMesh.name = 'hero-static';
  const paintMesh = new THREE.Mesh(own(ctx.paintB.build()), mats.paint);
  paintMesh.name = 'hero-paint';
  root.add(staticMesh, paintMesh);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), tmpC = new THREE.Color();
  const vU = new THREE.Vector3(), vA = new THREE.Vector3(), vN = new THREE.Vector3(), basis = new THREE.Matrix4(), qz = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);

  // 疑似影（共有のぼかし円、1 draw call）
  {
    const geo = own(new THREE.PlaneGeometry(1, 1));
    geo.rotateX(-Math.PI / 2);
    const sh = new THREE.InstancedMesh(geo, mats.shadow, ctx.shadows.length);
    sh.name = 'hero-shadows';
    ctx.shadows.forEach(([x, z, s], i) => { m4.compose(pos.set(x, 0.012, z), q.identity(), sc.set(s, 1, s)); sh.setMatrixAt(i, m4); });
    sh.renderOrder = -1;
    sh.frustumCulled = false;
    root.add(sh);
  }
  // ハンドルの赤い握り玉、鏡のガラス
  const knobB = new G.Builder();
  G.ball(knobB, [0, 0, 0], P.crank.knobRadius, [1, 1, 1], { ws: 10, hs: 8 });
  const knobs = new THREE.InstancedMesh(own(knobB.build()), mats.paint, stations.length);
  knobs.name = 'knobs';
  const glass = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), mats.glass, stations.length);
  glass.name = 'mirror-glass';
  const knobColor = new THREE.Color(0xff5964), knobHot = new THREE.Color(0xffd0a0);
  // 光のロッド、節と光だまり、光条
  const maxRods = P.world.maxBounces + 1;
  const rodGeo = own(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true));
  rodGeo.translate(0, 0.5, 0);
  const rods = new THREE.InstancedMesh(rodGeo, mats.glow, maxRods);
  rods.name = 'beam';
  const SPOTS = maxRods + 2 + P.flow.beads + P.fountain.sparks;
  const spots = new THREE.InstancedMesh(own(new THREE.IcosahedronGeometry(1, 1)), mats.glow, SPOTS);
  spots.name = 'beam-spots';
  const LAMP_RAYS = P.lamp.rays, BURST_RAYS = P.burst.rays;
  const rayGeo = own(new THREE.ConeGeometry(1, 1, 4, 1));
  rayGeo.translate(0, 0.5, 0);
  const rays = new THREE.InstancedMesh(rayGeo, mats.glow, LAMP_RAYS + BURST_RAYS);
  rays.name = 'rays';
  for (const im of [knobs, glass, rods, spots, rays]) { im.frustumCulled = false; root.add(im); }
  const rodColors = P.beam.colors.map((h) => new THREE.Color(h));
  const white = new THREE.Color(1, 1, 1), rayColor = new THREE.Color(0xffd77a);
  for (let i = 0; i < LAMP_RAYS + BURST_RAYS; i++) rays.setColorAt(i, i < LAMP_RAYS ? rayColor : tmpC.set(i % 2 ? 0xfff3c4 : 0xffd66e));
  for (let i = 0; i < SPOTS; i++) spots.setColorAt(i, white);
  for (let i = 0; i < maxRods; i++) rods.setColorAt(i, rodColors[i % rodColors.length]);
  for (let i = 0; i < stations.length; i++) knobs.setColorAt(i, knobColor);

  // ---- 光路 ----
  const scene = { origin: L.lamp.origin, dir: L.lamp.d0, mirrors: L.mirrors, receivers: L.receivers, world: P.world };
  const path = makePath(P.world.maxBounces);
  const code = {};
  L.mirrors.forEach((m, i) => { code[m.id] = i + 1; });
  L.receivers.forEach((r, i) => { code[r.id] = i + 8; });
  const prevHits = [], prevSeg = [], segLen = [];
  const toothStep = TAU / P.gearing.z2; // 歯1枚ぶん＝カチ1回

  // ---- 状態（全部 JS 側。GPU には持たない）----
  const S = { t: 0, stage: 0, complete: false, busy: false, busyT: 0, finaleT: 0, reveal: 0, sig: -1, grabbed: null, viewBackT: 0, burst: 0, hintSt: stations[0] };
  const lampPos = new THREE.Vector3(L.lamp.p0.x, L.lamp.p0.y, L.lamp.p0.z);
  const crownPos = rxById.crown.pos;
  const fountainPos = new THREE.Vector3(crownPos.x + crn.A[0] * 0.45, crownPos.y + crn.A[1] * 0.45, crownPos.z + crn.A[2] * 0.45);
  const frac = (x) => x - Math.floor(x);
  const env = { time: 0, finale: 0, sound };

  function setBusy(v) { if (S.busy !== v) { S.busy = v; emit({ type: 'busy', value: v }); } }

  // 狙いの角度の近くでは鏡がゆっくり動く（吸い付き）。raw：指の通りの角度、戻り値：鏡の目標角
  function warp(st, raw) {
    const w = D.detent * 0.9;
    for (const t of st.m.targets) {
      if (t.theta === null) continue;
      const aim = nearestHalfTurn(t.theta, raw), d = raw - aim;
      if (Math.abs(d) < w) return aim + (d * d * d) / (w * w);
    }
    return raw;
  }
  // 離した時、狙いの角度が近ければ「カチッ」とそこへ
  function snap(st) {
    let best = null, bestD = D.detent;
    for (const t of st.m.targets) {
      if (t.theta === null) continue;
      const aim = nearestHalfTurn(t.theta, st.raw), d = Math.abs(st.raw - aim);
      if (d < bestD) { bestD = d; best = aim; }
    }
    if (best !== null) st.raw = best;
  }

  function handleInput(input) {
    const g = input.grab;
    if (g && g.justStarted) {
      const st = stationById[g.id] || null;
      S.grabbed = st;
      if (st) {
        const p = g.point;
        const nearWheel = p && p.distanceToSquared(st.wheelCenter) < p.distanceToSquared(st.mirrorCenter);
        st.grabSign = nearWheel ? st.wheelFlip : 1;
        sound('grab', { position: st.wheelCenter });
      }
    }
    if (g && S.grabbed && S.grabbed.id === g.id) {
      const st = S.grabbed;
      const turn = D.dragTurn * (g.ddx * st.gx + g.ddy * st.gy) * st.grabSign;
      if (Number.isFinite(turn)) st.raw += turn; // NaN を角度に入れない
      st.raw = clamp(st.raw, st.theta - 1.0, st.theta + 1.0); // 指が速すぎても、鏡は後からゆっくり追いつく
    }
    const rel = input.released;
    if (rel) {
      for (let i = 0; i < rel.length; i++) {
        const st = stationById[rel[i].id];
        if (!st) continue;
        const w = clamp(D.dragTurn * (rel[i].vx * st.gx + rel[i].vy * st.gy) * st.grabSign, -D.maxSpeed, D.maxSpeed);
        if (Number.isFinite(w)) st.raw += w * D.coast; // 惰性
        snap(st);
        sound('release', { position: st.wheelCenter });
        if (S.grabbed === st) S.grabbed = null;
      }
    }
    if (!g) S.grabbed = null;
  }

  // 次にさわる所：まだ起きていない受け手のうち、いまの光が一番奥まで合っているものの、最初にずれている鏡
  function nextStation() {
    let best = null, bestDepth = -1;
    for (const rx of receivers) {
      if (rx.awake) continue;
      const chain = L.plans[rx.id];
      let depth = 0, need = null;
      for (const step of chain) {
        if (path.hits[step.mirror] !== L.mirrors[step.mirror].id || path.hits[step.mirror + 1] !== step.to) { need = stations[step.mirror]; break; }
        depth++;
      }
      if (!need) return null; // もう届いている（起きるのを待つだけ）
      if (depth > bestDepth) { bestDepth = depth; best = need; }
    }
    return best;
  }

  function wake(rx) {
    rx.awake = true; rx.wakeT = 0;
    S.stage++;
    emit({ type: 'awaken', id: rx.id, position: rx.pos.clone() });
    sound('awaken', { pitch: rx.cfg.pitch, position: rx.pos });
    emit({ type: 'stage', index: S.stage, count: receivers.length });
    if (rx.id === 'gem') sound('spin', { position: rx.pos });
    if (rx.id === 'flower' || rx.id === 'crown') sound('bloom', { position: rx.pos });
    if (S.stage >= receivers.length) {
      // 見せ場：てっぺんの花が大きく開き（もう開いていたら一度すぼんで開き直す）、遊星の宝石が速く回り、光条が広がる
      S.complete = true; S.finaleT = 0;
      setBusy(true); S.busyT = P.finaleSeconds - 1;
      if (rx.id !== 'crown') crn.state.wink();
      if (rx.id !== 'flower') flo.state.wink();
      sound('complete');
      emit({ type: 'complete', finaleSeconds: P.finaleSeconds, view: 'high' }); // てっぺんの見せ場は寄って見せる（シェルが後で全景へ戻す）
    } else {
      sound('stage', { gain: 0.6 });
      setBusy(true);
      if (rx.cfg.view) { emit({ type: 'view', name: rx.cfg.view }); S.viewBackT = 2.8; S.busyT = Math.max(S.busyT, 5.6); }
      else S.busyT = Math.max(S.busyT, 1.6);
    }
  }

  function update(dt, input) {
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    S.t += dt;
    const t = S.t;
    const hl = input ? input.hintLevel | 0 : 0;
    if (input) handleInput(input);

    // 1) 鏡：目標角へ慣性付きで（最大 90°/秒）。ハンドルは歯車比で決まる
    for (const st of stations) {
      st.target = warp(st, st.raw);
      const maxStep = D.maxSpeed * dt;
      st.theta += clamp((st.target - st.theta) * Math.min(1, dt * D.follow), -maxStep, maxStep);
      if (Math.abs(st.theta - st.tickAt) >= toothStep) {
        st.tickAt += Math.sign(st.theta - st.tickAt) * toothStep;
        sound('tick', { position: st.wheelCenter });
      }
      const m = st.m;
      setMirrorAngle(m, st.theta);
      basis.makeBasis(vU.set(m.u.x, m.u.y, m.u.z), vA.set(m.a.x, m.a.y, m.a.z), vN.set(m.n.x, m.n.y, m.n.z));
      st.pivot.quaternion.setFromRotationMatrix(basis);
      st.phi = -st.sigma * st.theta * st.ratio; // φ = −σ·θ·z2/z1
    }

    // 2) 光路（毎フレーム、数式で）
    trace(scene, path);
    let sig = 0;
    for (let i = 0; i < path.hits.length; i++) sig = sig * 16 + code[path.hits[i]];
    sig = sig * 8 + path.count;
    for (let i = 0; i < path.count; i++) {
      const a = path.pts[i], b = path.pts[i + 1];
      segLen[i] = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    }
    if (sig !== S.sig) {
      // 行き先が変わった所から先を、先端から伸ばし直す
      let k = 0;
      while (k < prevHits.length && k < path.hits.length && prevHits[k] === path.hits[k]) k++;
      let keep = 0;
      for (let i = 0; i < k && i < path.count; i++) keep += segLen[i];
      if (k < path.count) keep += Math.min(segLen[k], prevSeg[k] || 0);
      S.reveal = Math.min(S.reveal, keep);
      if (S.sig !== -1) {
        const h = path.hits[k];
        sound(h && code[h] < 8 ? 'hit' : 'beam', { gain: 0.7, position: path.pts[Math.min(k + 1, path.count)] && pos.copy(path.pts[Math.min(k + 1, path.count)]) });
      }
      S.sig = sig;
      prevHits.length = 0;
      for (let i = 0; i < path.hits.length; i++) prevHits.push(path.hits[i]);
    }
    prevSeg.length = path.count;
    for (let i = 0; i < path.count; i++) prevSeg[i] = segLen[i];
    S.reveal = Math.min(path.len, S.reveal + P.beam.growSpeed * dt);
    const full = S.reveal >= path.len - 1e-3;

    // 3) 受け手：照らされ続けたら起きる。機械は式で動く
    env.time = t; env.finale = S.complete ? Math.max(S.finaleT, 1e-3) : 0;
    let litRx = null;
    for (const rx of receivers) {
      const lit = full && path.end.receiver === rx.id;
      rx.lit = lit ? rx.lit + dt : 0;
      rx.charge = rx.awake ? 1 : clamp01(rx.lit / P.beam.wakeSeconds);
      if (lit) litRx = rx;
      if (!rx.awake && rx.lit >= P.beam.wakeSeconds) wake(rx);
      if (rx.awake) rx.wakeT += dt;
      rx.machine.update(dt, rx, env);
    }
    if (ctx.gems.dirty) {
      ctx.gems.mesh.instanceMatrix.needsUpdate = true;
      if (ctx.gems.mesh.instanceColor) ctx.gems.mesh.instanceColor.needsUpdate = true;
      ctx.gems.dirty = false;
    }

    // 4) 光のロッド（区間ごとの円柱）、節、先端、光だまり
    const R = P.beam.radius;
    let acc = 0, used = 0, ns = 0, tip = false;
    for (let i = 0; i < path.count && used < maxRods; i++) {
      const a = path.pts[i], b = path.pts[i + 1];
      const show = Math.min(segLen[i], S.reveal - acc);
      if (show <= 1e-3) break;
      dir.set(b.x - a.x, b.y - a.y, b.z - a.z).multiplyScalar(1 / Math.max(segLen[i], 1e-6));
      q.setFromUnitVectors(up, dir);
      m4.compose(pos.set(a.x, a.y, a.z), q, sc.set(R, show, R));
      rods.setMatrixAt(used, m4);
      if (S.complete) rods.setColorAt(used, tmpC.setHSL((i * 0.13 + t * 0.22) % 1, 1, 0.78));
      else rods.setColorAt(used, rodColors[i % rodColors.length]);
      used++;
      acc += segLen[i];
      if (show < segLen[i] - 1e-3) {
        const s = 0.085 * (1 + 0.2 * Math.sin(t * 14));
        m4.compose(pos.addScaledVector(dir, show), q, sc.set(s, s, s));
        spots.setMatrixAt(ns++, m4);
        tip = true;
        break;
      }
      if (i < path.count - 1) { // 鏡で跳ね返る所の節
        m4.compose(pos.set(b.x, b.y, b.z), q, sc.set(0.075, 0.075, 0.075));
        spots.setMatrixAt(ns++, m4);
      }
    }
    if (!tip && used > 0) {
      const e = path.pts[path.count], end = path.end;
      const pulse = 1 + 0.12 * Math.sin(t * 5);
      dir.set(end.n.x, end.n.y, end.n.z);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      dir.normalize();
      q.setFromUnitVectors(up, dir);
      pos.set(e.x, e.y, e.z).addScaledVector(dir, 0.02);
      if (end.kind === 'floor' || end.kind === 'wall') sc.set(0.3 * pulse, 0.02, 0.3 * pulse); // 光だまり（円板）
      else if (end.kind === 'receiver') { const s = litRx && !litRx.awake ? 0.1 + 0.26 * litRx.charge : 0.12 * pulse; sc.set(s, s, s); }
      else { const s = 0.11 * pulse; sc.set(s, s, s); }
      m4.compose(pos, q, sc);
      spots.setMatrixAt(ns++, m4);
    }
    // 見せ場：光路を光の玉が流れ、てっぺんの花から光の粒が噴き出す
    for (let i = 0; i < ns; i++) spots.setColorAt(i, white);
    if (S.complete && path.len > 1e-3) {
      const F = P.flow;
      for (let k = 0; k < F.beads; k++) {
        let s = (t * F.speed + (k * path.len) / F.beads) % path.len;
        if (s > S.reveal) continue;
        let i = 0;
        while (i < path.count - 1 && s > segLen[i]) { s -= segLen[i]; i++; }
        const a = path.pts[i], b = path.pts[i + 1], f = clamp01(s / Math.max(segLen[i], 1e-6));
        const r = F.radius * (0.85 + 0.15 * Math.sin(t * 9 + k)) * S.burst;
        m4.compose(pos.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f), q.identity(), sc.set(r, r, r));
        spots.setMatrixAt(ns, m4);
        spots.setColorAt(ns++, white);
      }
    }
    if (S.burst > 0.01) {
      const F = P.fountain, N = F.sparks;
      for (let i = 0; i < N; i++) {
        const cyc = S.finaleT / F.period + i / N, n = Math.floor(cyc), tau = (cyc - n) * F.period;
        if (n === 0 && i > 0) continue; // 最初の一巡は、順番に噴き出し始める
        const h1 = frac(i * 0.618 + n * 0.37), h2 = frac(i * 0.371 + n * 0.59);
        const az = i * 2.399963 + n * 1.3;
        const vo = F.out[0] + (F.out[1] - F.out[0]) * h1, vu = F.up[0] + (F.up[1] - F.up[0]) * h2;
        pos.set(fountainPos.x + Math.cos(az) * vo * tau, fountainPos.y + vu * tau - 0.5 * F.gravity * tau * tau, fountainPos.z + Math.sin(az) * vo * tau * F.depthSquash);
        const r = F.radius * Math.sqrt(Math.max(0, Math.sin((Math.PI * tau) / F.period))) * S.burst * (0.7 + 0.6 * h1);
        m4.compose(pos, q.identity(), sc.set(r, r, r));
        spots.setMatrixAt(ns, m4);
        spots.setColorAt(ns++, tmpC.setHSL(frac(i * 0.137 + t * 0.1), 1, 0.74));
      }
    }
    rods.count = used;
    spots.count = ns;
    if (spots.instanceColor) spots.instanceColor.needsUpdate = true;
    rods.instanceMatrix.needsUpdate = true;
    spots.instanceMatrix.needsUpdate = true;
    if (rods.instanceColor) rods.instanceColor.needsUpdate = true;

    // 5) 合図：次のハンドルを光らせ、息をさせ、±4°揺らす。ハンドル角・握り玉・ガラスの姿勢
    S.hintSt = !S.busy && !S.complete ? nextStation() : null;
    const pulse = 0.5 + 0.5 * Math.cos(t * TAU * 0.6);
    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      const isNext = st === S.hintSt && hl >= 1 && S.grabbed !== st;
      st.hint += ((isNext ? 1 : 0) - st.hint) * Math.min(1, dt * 8);
      st.dim += ((hl >= 2 && S.hintSt && !isNext ? 1 : 0) - st.dim) * Math.min(1, dt * 4);
      st.crankMat.emissiveIntensity = st.hint * (hl >= 2 ? 1.0 : 0.6) * pulse;
      st.crankMat.color.setScalar(1 - 0.35 * st.dim);
      const rock = st.hint * D.hintRock * Math.sin(t * TAU * 0.45);
      st.crank.quaternion.copy(st.crankBase).multiply(qz.setFromAxisAngle(zAxis, st.phi + rock));
      st.crank.scale.setScalar(1 + 0.06 * st.hint * pulse);
      st.crank.updateMatrix();
      m4.copy(st.crank.matrix);
      pos.copy(st.knobLocal).applyMatrix4(m4);
      const ks = 1 + 0.25 * st.hint * pulse;
      m4.compose(pos, st.crank.quaternion, sc.set(ks, ks, ks));
      knobs.setMatrixAt(i, m4);
      knobs.setColorAt(i, tmpC.copy(knobColor).lerp(knobHot, st.hint * pulse).multiplyScalar(1 - 0.35 * st.dim));
      m4.compose(st.pivot.position, st.pivot.quaternion, sc.set(st.cfg.across, st.cfg.along, P.mirror.glassDepth));
      glass.setMatrixAt(i, m4);
    }
    knobs.instanceMatrix.needsUpdate = true;
    glass.instanceMatrix.needsUpdate = true;
    if (knobs.instanceColor) knobs.instanceColor.needsUpdate = true;

    // 6) 光条：ランプのまわり（いつも）と、見せ場のてっぺん
    S.burst += ((S.complete ? 1 : 0) - S.burst) * Math.min(1, dt * 1.5);
    for (let i = 0; i < LAMP_RAYS; i++) {
      const an = (i / LAMP_RAYS) * TAU + t * 0.25;
      const len = P.lamp.rayLength * (0.75 + 0.3 * Math.sin(t * 2.3 + i * 2.1)) * (1 + 0.5 * S.burst);
      dir.set(Math.cos(an), Math.sin(an), 0);
      q.setFromUnitVectors(up, dir);
      m4.compose(pos.copy(lampPos).addScaledVector(dir, P.lamp.radius + 0.03), q, sc.set(0.07, len, 0.07));
      rays.setMatrixAt(i, m4);
    }
    const showBurst = S.burst > 0.01;
    if (showBurst) {
      const B = P.burst;
      for (let j = 0; j < BURST_RAYS; j++) {
        const an = (j / BURST_RAYS) * TAU + t * B.spin;
        const len = (j % 2 ? B.short : B.long) * (0.8 + 0.2 * Math.sin(t * 2.6 + j * 1.9)) * S.burst;
        const cx = Math.cos(an), sy = Math.sin(an) * B.squash;
        dir.set(cx, sy, 0).normalize();
        q.setFromUnitVectors(up, dir);
        pos.set(crownPos.x + cx * B.radius, crownPos.y + 0.05 + sy * B.radius, crownPos.z - B.back);
        m4.compose(pos, q, sc.set(0.13 * S.burst, len, 0.13 * S.burst));
        rays.setMatrixAt(LAMP_RAYS + j, m4);
      }
    }
    rays.count = showBurst ? LAMP_RAYS + BURST_RAYS : LAMP_RAYS;
    rays.instanceMatrix.needsUpdate = true;

    // 7) 自動演出の時間
    if (S.viewBackT > 0) { S.viewBackT -= dt; if (S.viewBackT <= 0 && !S.complete) emit({ type: 'view', name: 'all' }); }
    if (S.busy) { S.busyT -= dt; if (S.busyT <= 0) { S.busyT = 0; setBusy(false); } }
    if (S.complete) S.finaleT += dt;
  }

  function reset() {
    for (const st of stations) { st.theta = st.raw = st.target = st.tickAt = st.m.theta0; st.hint = 0; st.dim = 0; st.grabSign = 1; }
    for (const rx of receivers) { rx.awake = false; rx.lit = 0; rx.charge = 0; rx.wakeT = 0; rx.machine.reset(); }
    S.stage = 0; S.complete = false; S.busy = false; S.busyT = 0; S.finaleT = 0; S.reveal = 0; S.sig = -1;
    S.grabbed = null; S.viewBackT = 0; S.burst = 0;
    prevHits.length = 0; prevSeg.length = 0;
    update(0, null);
  }

  // 次の受け手に届く「答え」の角度へ、通り道の鏡を全部向ける（子どもが回したのと同じ速さで動く）
  function debugAdvance() {
    if (S.complete) return false;
    const rx = receivers.find((x) => !x.awake);
    if (!rx) return false;
    let changed = false;
    for (const step of L.plans[rx.id]) {
      const st = stations[step.mirror];
      const tg = st.m.targets.find((x) => x.id === step.to);
      if (!tg || tg.theta === null) continue;
      const aim = nearestHalfTurn(tg.theta, st.raw);
      if (Math.abs(aim - st.raw) > 1e-4) { st.raw = aim; changed = true; }
    }
    return changed;
  }

  const stateOut = { stage: 0, count: receivers.length, complete: false, busy: false };
  const hintOut = { id: '', position: new THREE.Vector3(), radius: 0.5, drag: 'x' };

  reset();

  return {
    root,
    stageCount: receivers.length,
    update,
    getHandles: () => handles,
    getHint() {
      const st = S.hintSt;
      if (S.busy || S.complete || !st) return null;
      hintOut.id = st.id; hintOut.position.copy(st.wheelCenter); hintOut.drag = st.drag;
      return hintOut;
    },
    getState() { stateOut.stage = S.stage; stateOut.complete = S.complete; stateOut.busy = S.busy; return stateOut; },
    reset,
    debugAdvance,
    onContextRestored() { /* RenderTarget は使っていない。状態は JS 側にあるので何もしなくてよい */ },
    dispose() {
      root.removeFromParent();
      root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      for (const x of owned) x.dispose();
      owned.length = 0;
    },
    params: P,
    layout: L,
    stations, // 調査用（シェルは使わない）
  };

  // 花びらのテクスチャ（手続き。DOM に触らない DataTexture、mip あり）：根元が黄色、先は白、うすい筋
  function makePetalTexture() {
    const W = 64, H = 128;
    const data = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) {
      const v = y / (H - 1);
      for (let x = 0; x < W; x++) {
        const s = (x / (W - 1)) * 2 - 1;
        const k = smooth(v / 0.42);
        let r = 1.0, g = 0.8 + 0.2 * k, b = 0.42 + 0.58 * k;
        const fan = s / (0.3 + 0.7 * v);
        const vein = Math.pow(Math.max(0, Math.cos(fan * 7.5)), 10) * (1 - smooth((v - 0.55) / 0.45)) * 0.16;
        const edge = 0.06 * s * s;
        r = clamp01(r - vein * 0.6 + edge * 0.2); g = clamp01(g - vein - edge); b = clamp01(b - vein - edge * 0.5);
        const i = (y * W + x) * 4;
        data[i] = Math.round(r * 255); data[i + 1] = Math.round(g * 255); data[i + 2] = Math.round(b * 255); data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    tex.name = 'petal (hero)';
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }
}
