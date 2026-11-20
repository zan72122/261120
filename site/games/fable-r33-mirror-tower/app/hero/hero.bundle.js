/* 自動生成（tools/build.mjs）。直接編集しない。src-hash:0401baa019 */
var MirrorTowerHero = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // app/hero/hero.js
  var hero_exports = {};
  __export(hero_exports, {
    PARAMS: () => PARAMS,
    createHero: () => createHero
  });

  // app/hero/optics.js
  var EPS = 1e-4;
  var v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
  var dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  var cross = (a, b, o = v3()) => {
    const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
    o.x = x;
    o.y = y;
    o.z = z;
    return o;
  };
  var sub = (a, b, o = v3()) => {
    o.x = a.x - b.x;
    o.y = a.y - b.y;
    o.z = a.z - b.z;
    return o;
  };
  var addScaled = (a, b, s, o = v3()) => {
    o.x = a.x + b.x * s;
    o.y = a.y + b.y * s;
    o.z = a.z + b.z * s;
    return o;
  };
  var len = (a) => Math.sqrt(dot(a, a));
  function norm(a, o = v3(), fx = 0, fy = 1, fz = 0) {
    const l = len(a);
    if (!(l > 1e-9)) {
      o.x = fx;
      o.y = fy;
      o.z = fz;
      return o;
    }
    o.x = a.x / l;
    o.y = a.y / l;
    o.z = a.z / l;
    return o;
  }
  function setMirrorAngle(m, theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    m.n.x = m.n0.x * c + m.b.x * s;
    m.n.y = m.n0.y * c + m.b.y * s;
    m.n.z = m.n0.z * c + m.b.z * s;
    cross(m.a, m.n, m.u);
  }
  function aimAngle(m, dIn, dOut, near = 0) {
    let x = dOut.x - dIn.x, y = dOut.y - dIn.y, z = dOut.z - dIn.z;
    const k = x * m.a.x + y * m.a.y + z * m.a.z;
    x -= k * m.a.x;
    y -= k * m.a.y;
    z -= k * m.a.z;
    if (x * x + y * y + z * z < 1e-10) return null;
    let th = Math.atan2(x * m.b.x + y * m.b.y + z * m.b.z, x * m.n0.x + y * m.n0.y + z * m.n0.z);
    let d = (th - near) % Math.PI;
    if (d > Math.PI / 2) d -= Math.PI;
    if (d < -Math.PI / 2) d += Math.PI;
    return near + d;
  }
  function hitRect(m, o, d) {
    const denom = dot(d, m.n);
    if (Math.abs(denom) < 1e-6) return Infinity;
    const t = ((m.c.x - o.x) * m.n.x + (m.c.y - o.y) * m.n.y + (m.c.z - o.z) * m.n.z) / denom;
    if (!(t > EPS)) return Infinity;
    const px = o.x + d.x * t - m.c.x, py = o.y + d.y * t - m.c.y, pz = o.z + d.z * t - m.c.z;
    if (Math.abs(px * m.u.x + py * m.u.y + pz * m.u.z) > m.halfU) return Infinity;
    if (Math.abs(px * m.a.x + py * m.a.y + pz * m.a.z) > m.halfA) return Infinity;
    return t;
  }
  function hitSphere(c, r, o, d) {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
    const b = ox * d.x + oy * d.y + oz * d.z;
    const disc = b * b - (ox * ox + oy * oy + oz * oz - r * r);
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t > EPS ? t : Infinity;
  }
  function hitCylinderY(c, r, y0, y1, o, d) {
    const A = d.x * d.x + d.z * d.z;
    if (A < 1e-10) return Infinity;
    const ox = o.x - c.x, oz = o.z - c.z;
    const B = ox * d.x + oz * d.z;
    const disc = B * B - A * (ox * ox + oz * oz - r * r);
    if (disc < 0) return Infinity;
    const t = (-B - Math.sqrt(disc)) / A;
    if (!(t > EPS)) return Infinity;
    const y = o.y + d.y * t;
    return y >= y0 && y <= y1 ? t : Infinity;
  }
  function hitBounds(w, o, d, end) {
    let t = Infinity, kind = "air";
    let nx = -d.x, ny = -d.y, nz = -d.z;
    if (d.z > 1e-6) {
      const tf = (w.front - o.z) / d.z;
      if (tf > 0 && tf < t) {
        t = tf;
        kind = "air";
      }
    }
    if (Math.abs(d.x) > 1e-6) {
      const ts = ((d.x > 0 ? w.side : -w.side) - o.x) / d.x;
      if (ts > 0 && ts < t && o.z + d.z * ts > 0) {
        t = ts;
        kind = "air";
      }
    }
    const A = d.x * d.x + d.z * d.z;
    if (A > 1e-10) {
      const B = o.x * d.x + o.z * d.z, C = o.x * o.x + o.z * o.z - w.radius * w.radius;
      const disc = B * B - A * C;
      if (disc >= 0) {
        const tc = (-B + Math.sqrt(disc)) / A;
        if (tc > 0 && tc < t && o.z + d.z * tc <= 0) {
          t = tc;
          kind = "wall";
          nx = -(o.x + d.x * tc) / w.radius;
          ny = 0;
          nz = -(o.z + d.z * tc) / w.radius;
        }
      }
    }
    if (d.y > 1e-6) {
      const tt = (w.height - o.y) / d.y;
      if (tt < t) {
        t = Math.max(tt, 0) + w.skyExtra;
        kind = "sky";
        nx = -d.x;
        ny = -d.y;
        nz = -d.z;
      }
    }
    if (d.y < -1e-6) {
      const tf = (w.floor - o.y) / d.y;
      if (tf > 0 && tf < t) {
        t = tf;
        kind = "floor";
        nx = 0;
        ny = 1;
        nz = 0;
      }
    }
    if (!(t < 1e9)) {
      t = w.maxLength;
      kind = "air";
    }
    end.kind = kind;
    end.n.x = nx;
    end.n.y = ny;
    end.n.z = nz;
    return Math.max(0, t);
  }
  function makePath(maxBounces) {
    const pts = [];
    for (let i = 0; i <= maxBounces + 2; i++) pts.push(v3());
    return {
      pts,
      hits: [],
      count: 0,
      len: 0,
      end: { kind: "air", n: v3(0, 1, 0), receiver: null },
      // 鏡ごとの入射（当たっていれば lit=true、入射方向 d と当たった点 p）
      incoming: []
    };
  }
  function trace(scene, path) {
    const w = scene.world;
    const o = path._o || (path._o = v3()), d = path._d || (path._d = v3());
    o.x = scene.origin.x;
    o.y = scene.origin.y;
    o.z = scene.origin.z;
    d.x = scene.dir.x;
    d.y = scene.dir.y;
    d.z = scene.dir.z;
    path.hits.length = 0;
    for (let i = 0; i < scene.mirrors.length; i++) {
      const inc = path.incoming[i] || (path.incoming[i] = { lit: false, d: v3(), p: v3() });
      inc.lit = false;
    }
    const p0 = path.pts[0];
    p0.x = o.x;
    p0.y = o.y;
    p0.z = o.z;
    let n = 0, total = 0, from = -1;
    path.end.receiver = null;
    for (let k = 0; k <= w.maxBounces; k++) {
      let best = hitBounds(w, o, d, path.end), what = null, isMirror = false;
      for (let i = 0; i < scene.mirrors.length; i++) {
        if (i === from) continue;
        const t = hitRect(scene.mirrors[i], o, d);
        if (t < best) {
          best = t;
          what = scene.mirrors[i];
          isMirror = true;
        }
      }
      for (let i = 0; i < scene.receivers.length; i++) {
        const r = scene.receivers[i];
        const t = r.shape === "cylinder" ? hitCylinderY(r.c, r.r, r.y0, r.y1, o, d) : hitSphere(r.c, r.r, o, d);
        if (t < best) {
          best = t;
          what = r;
          isMirror = false;
        }
      }
      let clipped = false;
      if (best > w.maxLength - total) {
        best = Math.max(0, w.maxLength - total);
        clipped = true;
      }
      o.x += d.x * best;
      o.y += d.y * best;
      o.z += d.z * best;
      total += best;
      const p = path.pts[++n];
      p.x = o.x;
      p.y = o.y;
      p.z = o.z;
      if (clipped) {
        path.end.kind = "air";
        path.end.n.x = -d.x;
        path.end.n.y = -d.y;
        path.end.n.z = -d.z;
        break;
      }
      if (what && isMirror) {
        const inc = path.incoming[what.index];
        inc.lit = true;
        inc.d.x = d.x;
        inc.d.y = d.y;
        inc.d.z = d.z;
        inc.p.x = o.x;
        inc.p.y = o.y;
        inc.p.z = o.z;
        path.hits.push(what.id);
        if (k === w.maxBounces) {
          path.end.kind = "mirror";
          path.end.n.x = -d.x;
          path.end.n.y = -d.y;
          path.end.n.z = -d.z;
          break;
        }
        const dn = 2 * dot(d, what.n);
        d.x -= dn * what.n.x;
        d.y -= dn * what.n.y;
        d.z -= dn * what.n.z;
        const l = len(d);
        if (l > 1e-9) {
          d.x /= l;
          d.y /= l;
          d.z /= l;
        }
        from = what.index;
        continue;
      }
      if (what) {
        path.hits.push(what.id);
        path.end.kind = "receiver";
        path.end.receiver = what.id;
        path.end.n.x = -d.x;
        path.end.n.y = -d.y;
        path.end.n.z = -d.z;
      }
      break;
    }
    path.count = n;
    path.len = total;
    return path;
  }

  // app/hero/layout.js
  var DEG = Math.PI / 180;
  var PARAMS = {
    world: { radius: 4.2, height: 7.6, floor: 0, front: 2, side: 4.4, skyExtra: 3, maxBounces: 5, maxLength: 30 },
    beam: {
      radius: 0.05,
      // 光のロッドの半径
      growSpeed: 6,
      // 先端が伸びる速さ m/s
      wakeSeconds: 0.6,
      // 照らされ続けて起きるまで
      // 区間ごとの色（鏡で跳ね返るたびに色相が少しずれる）
      colors: [16773800, 16762076, 11595007, 13631416, 15125759, 16767400]
    },
    drive: {
      dragTurn: Math.PI,
      // キャンバス高さ 1.0 のドラッグ = 鏡 180°
      crossGain: 0.3,
      // 主方向と直交するドラッグも少しだけ効かせる（小さな指向け）
      maxSpeed: 90 * DEG,
      // 鏡の角速度の上限（酔い防止）
      follow: 8,
      // 目標角への追従の速さ 1/s
      coast: 0.35,
      // 離した時の速度 × この秒数だけ惰性で進む
      detent: 7 * DEG,
      // 離した時、狙いの角度がこの範囲にあれば「カチッ」と止まる
      hintRock: 4 * DEG
      // 合図でハンドルを揺らす角度
    },
    // 鏡を回す歯車対（ハンドル側 z1、鏡側 z2）。θ鏡 = −σ·φハンドル·z1/z2
    gearing: { module: 0.035, z1: 12, z2: 24, face: 0.09 },
    crank: { wheelRadius: 0.36, rimTube: 0.034, spokes: 5, knobRadius: 0.075 },
    mirror: { frameBar: 0.07, frameDepth: 0.07, glassDepth: 0.024, shaftRadius: 0.042 },
    lamp: { p0: [-2.9, 1.5, 0.5], d0: [1, 0, 0], radius: 0.35, rays: 12, rayLength: 0.3 },
    // 鏡。kind: turntable = 縦軸の回転台、yoke = 横軸のフォーク（hang: 上から吊る）
    // aims: この鏡から光を届けたい相手（受け手 or 次の鏡）。回転軸はこの相手から導く。
    // initToward: 最初に反射光が向かう点（どの受け手にも当たらない向き）
    mirrors: [
      { id: "mirror-1", kind: "turntable", c: [2.7, 1.5, 0.5], across: 1, along: 1.3, aims: ["pillar", "mirror-2"], initToward: [3.22, 1.5, -2.46] },
      { id: "mirror-2", kind: "yoke", c: [2, 1.5, -2.2], across: 1, along: 1.2, aims: ["gem", "mirror-3"], initToward: [1.62, 4.1, -3.65] },
      { id: "mirror-3", kind: "yoke", hang: true, mast: [2, -3.15], c: [2, 5.4, -2.2], across: 1, along: 1.2, aims: ["flower", "mirror-4"], initToward: [-0.6, 7, 0.2] },
      { id: "mirror-4", kind: "turntable", c: [-1.5, 5.4, 1.15], across: 1, along: 1.3, aims: ["crown"], initToward: [-3.4, 5.4, -2.5] }
    ],
    // 受け手。起きる順のおすすめ（合図と debugAdvance の順）もこの並び。
    pillar: {
      id: "pillar",
      base: [-2.8, 0, -1.9],
      drums: 7,
      drumRadius: 0.3,
      drumHeight: 0.26,
      firstDrumY: 0.52,
      gap: 0.03,
      drumTeeth: 12,
      hitRadius: 0.36,
      stepDelay: 0.16,
      colors: [16740241, 16751196, 16765788, 9429114, 6084296, 7317759, 11832575],
      cam: { baseRadius: 0.1, lift: 0.13, lobes: 2, zMotor: 10, zCam: 20, module: 0.02, motorSpeed: 220 * DEG },
      pitch: 0
    },
    gem: {
      id: "gem",
      along: 0.55,
      y: 3.6,
      // 鏡1→鏡2 の線の上（鏡2 の回転面の中）
      radius: 0.3,
      facets: 8,
      crownAngle: 34 * DEG,
      pavilionAngle: 41 * DEG,
      table: 0.55,
      tilt: 25 * DEG,
      hitRadius: 0.4,
      zMotor: 12,
      zGem: 36,
      module: 0.02,
      motorSpeed: 150 * DEG,
      // ω宝石 = ωモーター·zMotor/zGem = 50°/秒
      postOffset: 1.05,
      pitch: 4
    },
    flower: {
      id: "flower",
      along: 3.3,
      y: 3.1,
      // 鏡3→鏡4 の線の下（鏡3 の回転面の中）
      scale: 0.8,
      petals: 8,
      tilt: 20 * DEG,
      hitRadius: 0.42,
      color: 16748472,
      color2: 16754376,
      pitch: 7,
      view: "low"
    },
    crown: {
      id: "crown",
      c: [0, 5.4, -2.35],
      scale: 1.1,
      petals: 10,
      tilt: 30 * DEG,
      hitRadius: 0.5,
      color: 16764762,
      color2: 16752324,
      pitch: 12,
      // 遊星歯車：太陽（固定）zs、遊星 zp、n 個。ω遊星 = ωキャリア·(1 + zs/zp)
      planet: { module: 0.05, zs: 26, zp: 12, count: 5, planeY: -0.3, face: 0.07, gemRadius: 0.15, speedAwake: 6 * DEG, speedFinale: 18 * DEG }
    },
    // 花の機械（scale=1 の寸法。花の原点＝花びらのちょうつがいの輪の中心、+Y＝花の軸）
    flowerMachine: {
      petalLength: 1,
      petalWidth: 0.25,
      petalBulge: 0.17,
      petalCup: 0.3,
      hingeRadius: 0.233,
      alphaMax: 80 * DEG,
      crankRadius: 0.1,
      rodLength: 0.34,
      crankY: -0.62,
      crankZ: 0.17,
      discRadius: 0.16,
      tubeRadius: 0.065,
      tubeBottom: -1.5,
      rackModule: 0.022,
      openSeconds: 1.3,
      breatheAmp: 0.55,
      breatheHz: 0.22
    },
    // 見せ場の後光（てっぺんの花の後ろの光条。横長のだ円に並ぶ）
    burst: { rays: 14, radius: 1.25, long: 0.9, short: 0.5, squash: 0.62, back: 0.7, spin: -0.2 },
    // 見せ場：光路を流れる光の玉と、てっぺんの花から噴き出す光の粒（放物線 p = p0 + v·τ − g·τ²/2 を式で）
    flow: { beads: 10, speed: 3.2, radius: 0.11 },
    fountain: { sparks: 36, period: 2, gravity: 3.6, up: [2.1, 2.9], out: [0.4, 1.3], radius: 0.09, depthSquash: 0.55 },
    finaleSeconds: 7
  };
  function deriveLayout(P = PARAMS) {
    const V = (a) => v3(a[0], a[1], a[2]);
    const byId = {};
    const mirrors = P.mirrors.map((cfg, index) => {
      const m = { id: cfg.id, index, cfg, c: V(cfg.c), halfU: cfg.across / 2, halfA: cfg.along / 2, a: v3(), n0: v3(), b: v3(), n: v3(), u: v3() };
      byId[cfg.id] = m;
      return m;
    });
    const [m1, m2, m3] = mirrors;
    const g = P.gem;
    const gemC = v3(m1.c.x + (m2.c.x - m1.c.x) * g.along, g.y, m1.c.z + (m2.c.z - m1.c.z) * g.along);
    const m4 = mirrors[3];
    const h3 = norm(v3(m4.c.x - m3.c.x, 0, m4.c.z - m3.c.z));
    const f = P.flower;
    const flowerC = v3(m3.c.x + h3.x * f.along, f.y, m3.c.z + h3.z * f.along);
    const crownC = V(P.crown.c);
    const p = P.pillar;
    const pillarTop = p.firstDrumY + p.drums * (p.drumHeight + p.gap);
    const receivers = [
      { id: p.id, shape: "cylinder", c: v3(p.base[0], 0, p.base[2]), r: p.hitRadius, y0: p.firstDrumY - 0.1, y1: pillarTop, aim: v3(p.base[0], P.lamp.p0[1], p.base[2]), cfg: p },
      { id: g.id, shape: "sphere", c: gemC, r: g.hitRadius, aim: gemC, cfg: g },
      { id: f.id, shape: "sphere", c: flowerC, r: f.hitRadius, aim: flowerC, cfg: f },
      { id: P.crown.id, shape: "sphere", c: crownC, r: P.crown.hitRadius, aim: crownC, cfg: P.crown }
    ];
    for (const r of receivers) byId[r.id] = r;
    const lamp = { p0: V(P.lamp.p0), d0: norm(V(P.lamp.d0)) };
    lamp.origin = addScaled(lamp.p0, lamp.d0, P.lamp.radius);
    const aimPoint = (id) => byId[id].aim || byId[id].c;
    mirrors.forEach((m, i) => {
      m.dIn = i === 0 ? v3(lamp.d0.x, lamp.d0.y, lamp.d0.z) : norm(sub(m.c, mirrors[i - 1].c));
      m.targets = m.cfg.aims.map((id) => ({ id, point: aimPoint(id), dOut: norm(sub(aimPoint(id), m.c)) }));
      const q1 = sub(m.targets[0].dOut, m.dIn);
      let a;
      if (m.targets.length > 1) a = norm(cross(q1, sub(m.targets[1].dOut, m.dIn)));
      else {
        const up = v3(0, 1, 0);
        const k = dot(up, norm(q1));
        a = norm(addScaled(up, norm(q1), -k));
      }
      if (m.cfg.kind === "turntable") {
        if (a.y < 0) {
          a.x = -a.x;
          a.y = -a.y;
          a.z = -a.z;
        }
      } else if (a.z < 0 || Math.abs(a.z) < 1e-6 && a.x > 0) {
        a.x = -a.x;
        a.y = -a.y;
        a.z = -a.z;
      }
      m.a = a;
      const ref = m.cfg.kind === "turntable" ? v3(0, 0, 1) : v3(0, 1, 0);
      m.n0 = norm(addScaled(ref, a, -dot(ref, a)));
      m.b = cross(a, m.n0);
      for (const t of m.targets) t.theta = aimAngle(m, m.dIn, t.dOut, 0);
      const init = aimAngle(m, m.dIn, norm(sub(V(m.cfg.initToward), m.c)), 0);
      m.theta0 = init === null ? 0.3 : init;
    });
    const plans = {};
    mirrors.forEach((m, i) => {
      for (const t of m.targets) {
        if (byId[t.id].shape) {
          const chain = [];
          for (let k = 0; k < i; k++) chain.push({ mirror: k, to: mirrors[k + 1].id });
          chain.push({ mirror: i, to: t.id });
          plans[t.id] = chain;
        }
      }
    });
    return { mirrors, receivers, lamp, plans, byId, h3 };
  }

  // app/hero/mech.js
  var TAU = Math.PI * 2;
  var clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  var clamp01 = (x) => clamp(x, 0, 1);
  var smooth = (x) => {
    x = clamp01(x);
    return x * x * (3 - 2 * x);
  };
  var easeOutBack = (x) => {
    x = clamp01(x);
    const c = 1.4;
    return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  };
  function meshAngle(phi1, z1, z2) {
    return Math.PI / z2 - phi1 * z1 / z2;
  }
  var pitchRadius = (m, z) => m * z / 2;
  var centerDistance = (m, z1, z2) => m * (z1 + z2) / 2;
  function bevelCones(m, z1, z2, sigma = Math.PI / 2) {
    const d1 = Math.atan2(Math.sin(sigma), z2 / z1 + Math.cos(sigma));
    const d2 = sigma - d1;
    const R = m * z1 / (2 * Math.sin(d1));
    return { d1, d2, R };
  }
  function sliderPos(phi, r, l) {
    const sn = Math.sin(phi);
    return r * Math.cos(phi) + Math.sqrt(Math.max(l * l - r * r * sn * sn, 1e-9));
  }
  var rackPinionRadius = (r, alphaMax) => 2 * r / alphaMax;
  function camLift(phi, hmax, k) {
    return hmax * (1 - Math.cos(k * phi)) / 2;
  }
  function camRadius(psi, rb, hmax, k) {
    return rb + camLift(psi, hmax, k);
  }
  function planetToothAngle(carrier, k, n, zs, zp) {
    const th = carrier + TAU * k / n;
    return th * (1 + zs / zp) + Math.PI - Math.PI / zp;
  }
  function nearestHalfTurn(th, near) {
    let d = (th - near) % Math.PI;
    if (d > Math.PI / 2) d -= Math.PI;
    if (d < -Math.PI / 2) d += Math.PI;
    return near + d;
  }

  // app/hero/geom.js
  function createGeom(THREE) {
    const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
    const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
    const ID = new THREE.Matrix4();
    const rgb = (hex) => {
      const c = new THREE.Color(hex);
      return [c.r, c.g, c.b];
    };
    class Builder {
      constructor() {
        this.p = [];
        this.n = [];
        this.uv = [];
        this.c = [];
      }
      get tris() {
        return this.p.length / 9;
      }
      _v(p, n, u, v, c) {
        this.p.push(p[0], p[1], p[2]);
        this.n.push(n[0], n[1], n[2]);
        this.uv.push(u, v);
        this.c.push(c[0], c[1], c[2]);
      }
      // 平らな三角形（法線は面から）。ref があれば法線が ref から遠ざかる向きにそろえる
      tri(a, b, c, col, ref, m) {
        if (m) {
          a = xf(m, a);
          b = xf(m, b);
          c = xf(m, c);
          if (ref) ref = xf(m, ref);
        }
        let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
        let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        const l = Math.hypot(nx, ny, nz);
        if (!(l > 1e-12)) return;
        nx /= l;
        ny /= l;
        nz /= l;
        if (ref) {
          const cx = (a[0] + b[0] + c[0]) / 3 - ref[0], cy = (a[1] + b[1] + c[1]) / 3 - ref[1], cz = (a[2] + b[2] + c[2]) / 3 - ref[2];
          if (nx * cx + ny * cy + nz * cz < 0) {
            const t = b;
            b = c;
            c = t;
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
        }
        const n = [nx, ny, nz];
        for (const q of [a, b, c]) this._v(q, n, (q[0] + q[2]) * 0.9, q[1] * 0.9 + q[2] * 0.35, col);
      }
      quad(a, b, c, d, col, ref, m) {
        this.tri(a, b, c, col, ref, m);
        this.tri(a, c, d, col, ref, m);
      }
      // THREE の既製の形を、行列をかけて取り込む（色は頂点カラー）。geo は dispose する
      add(geo, m, col, uvScale = 1) {
        const g = geo.index ? geo.toNonIndexed() : geo;
        const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
        m = m || ID;
        _nm.getNormalMatrix(m);
        for (let i = 0; i < P.count; i++) {
          _p.fromBufferAttribute(P, i).applyMatrix4(m);
          _n.fromBufferAttribute(N, i).applyMatrix3(_nm);
          const l = _n.length();
          if (l > 1e-9) _n.multiplyScalar(1 / l);
          else _n.set(0, 1, 0);
          this.p.push(_p.x, _p.y, _p.z);
          this.n.push(_n.x, _n.y, _n.z);
          this.uv.push(U ? U.getX(i) * uvScale : 0, U ? U.getY(i) * uvScale : 0);
          this.c.push(col[0], col[1], col[2]);
        }
        if (g !== geo) g.dispose();
        geo.dispose();
        return this;
      }
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.p), 3));
        g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(this.n), 3));
        g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(this.uv), 2));
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.c), 3));
        g.computeBoundingSphere();
        g.computeBoundingBox();
        this.p = this.n = this.uv = this.c = null;
        return g;
      }
    }
    function xf(m, a) {
      _p.set(a[0], a[1], a[2]).applyMatrix4(m);
      return [_p.x, _p.y, _p.z];
    }
    const A = (v) => Array.isArray(v) ? v : [v.x, v.y, v.z];
    function perp(v) {
      v = A(v);
      const ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2]);
      const o = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
      const d = o[0] * v[0] + o[1] * v[1] + o[2] * v[2];
      const r = [o[0] - d * v[0], o[1] - d * v[1], o[2] - d * v[2]];
      const l = Math.hypot(r[0], r[1], r[2]) || 1;
      return [r[0] / l, r[1] / l, r[2] / l];
    }
    function frame(o, x, y, z, s = 1) {
      o = A(o);
      if (x) _x.fromArray(A(x)).normalize();
      if (y) _y.fromArray(A(y)).normalize();
      if (z) _z.fromArray(A(z)).normalize();
      if (!x) _x.crossVectors(_y, _z).normalize();
      if (!y) _y.crossVectors(_z, _x).normalize();
      if (!z) _z.crossVectors(_x, _y).normalize();
      const m = new THREE.Matrix4().makeBasis(_x, _y, _z);
      if (s !== 1) m.scale(_p.set(s, s, s));
      m.setPosition(o[0], o[1], o[2]);
      return m;
    }
    function frameY(o, dir) {
      const y = A(dir);
      const x = perp(y);
      return frame(o, x, y, null);
    }
    function frameZ(o, dir) {
      const z = A(dir);
      const x = perp(z);
      return frame(o, x, null, z);
    }
    const compose = (...ms) => {
      const m = new THREE.Matrix4();
      for (const k of ms) m.multiply(k);
      return m;
    };
    const mt = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    const mrx = (a) => new THREE.Matrix4().makeRotationX(a);
    const mry = (a) => new THREE.Matrix4().makeRotationY(a);
    const mrz = (a) => new THREE.Matrix4().makeRotationZ(a);
    const mscale = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);
    function rod(b, p0, p1, r0, col, { r1 = r0, seg = 8, caps = false } = {}) {
      p0 = A(p0);
      p1 = A(p1);
      const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const L = Math.hypot(d[0], d[1], d[2]);
      if (!(L > 1e-6)) return;
      const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, !caps);
      g.translate(0, L / 2, 0);
      b.add(g, frameY(p0, [d[0] / L, d[1] / L, d[2] / L]), col);
    }
    function ball(b, p, r, col, { ws = 10, hs = 7, m = null, squash = 1 } = {}) {
      const g = new THREE.SphereGeometry(r, ws, hs);
      if (squash !== 1) g.scale(1, squash, 1);
      b.add(g, m ? compose(mt(...A(p)), m) : mt(...A(p)), col);
    }
    function box(b, size, m, col) {
      b.add(new THREE.BoxGeometry(size[0], size[1], size[2]), m, col, 0.5);
    }
    function torus(b, R, tube, m, col, { rs = 6, ts = 20, arc = TAU } = {}) {
      b.add(new THREE.TorusGeometry(R, tube, rs, ts, arc), m, col);
    }
    function lathe(b, profile, m, col, { seg = 16, colors = null } = {}) {
      m = m || ID;
      for (let j = 0; j < profile.length - 1; j++) {
        const [r0, y0] = profile[j], [r1, y1] = profile[j + 1];
        let nr = y1 - y0, ny = -(r1 - r0);
        const nl = Math.hypot(nr, ny);
        if (!(nl > 1e-9)) continue;
        nr /= nl;
        ny /= nl;
        const c = colors ? colors[j] : col;
        for (let i = 0; i < seg; i++) {
          const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
          const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
          const va = [r0 * c0, y0, r0 * s0], vb = [r0 * c1, y0, r0 * s1], vc = [r1 * c1, y1, r1 * s1], vd = [r1 * c0, y1, r1 * s0];
          const na = [nr * c0, ny, nr * s0], nb = [nr * c1, ny, nr * s1];
          const pushV = (v, n, u, w) => {
            _p.set(v[0], v[1], v[2]).applyMatrix4(m);
            _n.set(n[0], n[1], n[2]).transformDirection(m);
            b._v([_p.x, _p.y, _p.z], [_n.x, _n.y, _n.z], u, w, c);
          };
          const u0 = i / seg * 2, u1 = (i + 1) / seg * 2;
          if (r1 > 1e-6) {
            pushV(va, na, u0, y0);
            pushV(vd, na, u0, y1);
            pushV(vc, nb, u1, y1);
          }
          if (r0 > 1e-6) {
            pushV(va, na, u0, y0);
            pushV(vc, nb, u1, y1);
            pushV(vb, nb, u1, y0);
          }
        }
      }
    }
    function gear(b, spec, m, col, opt = {}) {
      const { mod, z, face = 0.08, cone = 0, R = 0, phase = 0 } = spec;
      const { webCol = col, hubR = mod * 2.2, teeth = null, holes = 0, holeCol = col, web = true } = opt;
      const tau = TAU / z;
      const eR = 0.29 * tau, eT = 0.14 * tau;
      let EA, EB;
      if (cone > 0) {
        const sd = Math.sin(cone), cd = Math.cos(cone);
        const end = (rho) => {
          const k = rho / R;
          return { rr: rho * sd - k * 1.25 * mod * cd, zr: rho * cd + k * 1.25 * mod * sd, rt: rho * sd + k * mod * cd, zt: rho * cd - k * mod * sd };
        };
        EA = end(R - face);
        EB = end(R);
      } else {
        const r = mod * z / 2;
        EA = { rr: r - 1.25 * mod, zr: -face / 2, rt: r + mod, zt: -face / 2 };
        EB = { rr: r - 1.25 * mod, zr: face / 2, rt: r + mod, zt: face / 2 };
      }
      const P = (r, a, zz) => [r * Math.cos(a), r * Math.sin(a), zz];
      const zc = (EA.zr + EB.zr) / 2;
      const body = [0, 0, zc];
      const k0 = teeth ? teeth[0] : 0, k1 = teeth ? teeth[1] : z;
      for (let k = k0; k < k1; k++) {
        const a = phase + k * tau;
        const inner = P((EA.rr + EA.rt) / 2, a, zc);
        const ArL = P(EA.rr, a - eR, EA.zr), AtL = P(EA.rt, a - eT, EA.zt), AtR = P(EA.rt, a + eT, EA.zt), ArR = P(EA.rr, a + eR, EA.zr);
        const BrL = P(EB.rr, a - eR, EB.zr), BtL = P(EB.rt, a - eT, EB.zt), BtR = P(EB.rt, a + eT, EB.zt), BrR = P(EB.rr, a + eR, EB.zr);
        b.quad(ArL, AtL, BtL, BrL, col, inner, m);
        b.quad(ArR, AtR, BtR, BrR, col, inner, m);
        b.quad(AtL, AtR, BtR, BtL, col, inner, m);
        b.quad(ArL, AtL, AtR, ArR, col, inner, m);
        b.quad(BrL, BtL, BtR, BrR, col, inner, m);
        if (!teeth || k < k1 - 1) {
          const ArN = P(EA.rr, a + tau - eR, EA.zr), BrN = P(EB.rr, a + tau - eR, EB.zr);
          b.quad(ArR, ArN, BrN, BrR, col, body, m);
          if (web) {
            b.quad(ArR, ArN, P(hubR, a + tau - eR, EA.zr), P(hubR, a + eR, EA.zr), webCol, body, m);
            b.quad(BrR, BrN, P(hubR, a + tau - eR, EB.zr), P(hubR, a + eR, EB.zr), webCol, body, m);
          }
        }
        if (web) {
          b.quad(ArL, ArR, P(hubR, a + eR, EA.zr), P(hubR, a - eR, EA.zr), webCol, body, m);
          b.quad(BrL, BrR, P(hubR, a + eR, EB.zr), P(hubR, a - eR, EB.zr), webCol, body, m);
        }
      }
      if (holes > 0) {
        const rin = hubR, rout = Math.min(EA.rr, EB.rr);
        const rc = (rin + rout) / 2, hr = Math.min((rout - rin) * 0.32, rc * Math.PI / holes * 0.7);
        for (const E of cone > 0 ? [EB] : [EA, EB]) {
          const sgn = E === EA ? -1 : 1;
          for (let h = 0; h < holes; h++) {
            const a = phase + (h + 0.5) * (TAU / holes);
            const g = new THREE.CircleGeometry(hr, 8);
            if (sgn < 0) g.rotateY(Math.PI);
            const lm = compose(m || ID, mt(rc * Math.cos(a), rc * Math.sin(a), E.zr + sgn * 4e-3));
            b.add(g, lm, holeCol);
          }
        }
      }
      return { EA, EB, zc };
    }
    function gem(b, { R = 0.3, n = 8, table = 0.55, crownAngle = 0.6, pavilionAngle = 0.72 }, col) {
      const rt = R * table, hc = (R - rt) * Math.tan(crownAngle), hp = R * Math.tan(pavilionAngle);
      const T = [], G = [];
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU;
        T.push([rt * Math.cos(a), hc, rt * Math.sin(a)]);
      }
      for (let j = 0; j < 2 * n; j++) {
        const a = (j - 0.5) / (2 * n) * TAU + TAU / (2 * n) * 0.5;
        G.push([R * Math.cos(a), 0, R * Math.sin(a)]);
      }
      const culet = [0, -hp, 0], top = [0, hc, 0], ref = [0, -hp * 0.2, 0];
      const tri = (a, c, d) => {
        const before = b.p.length;
        b.tri(a, c, d, col, ref);
        for (let k = before / 3, q = 0; k < b.p.length / 3; k++, q++) {
          const px = b.p[k * 3], py = b.p[k * 3 + 1], pz = b.p[k * 3 + 2];
          b.uv[k * 2] = 0.5 + px / R * 0.42 + py * 0.3;
          b.uv[k * 2 + 1] = 0.5 + pz / R * 0.42 - py * 0.2;
        }
      };
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        tri(top, T[i], T[j]);
        const g0 = G[2 * i % (2 * n)], g1 = G[(2 * i + 1) % (2 * n)], g2 = G[(2 * i + 2) % (2 * n)];
        tri(T[i], g0, g1);
        tri(T[i], g1, T[j]);
        tri(T[j], g1, g2);
        tri(culet, g0, g1);
        tri(culet, g1, g2);
      }
      return { hc, hp };
    }
    function petal(b, f, { nu = 4, nv = 7, bladeCol = [1, 1, 1], gearCol = [1, 0.8, 0.3], rho = 0.14, zPin = 13 } = {}) {
      const L = f.petalLength, W = f.petalWidth, Rh = f.hingeRadius;
      const pt = (s, t) => {
        const w = W * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.75) + 0.012;
        const cx = f.petalBulge * Math.sin(Math.PI * Math.min(1, t * 1.05)) - (Rh - 0.03) * t * t;
        return [cx - f.petalCup * w * s * s, L * t, w * s];
      };
      const grid = [];
      for (let j = 0; j <= nv; j++) {
        const row = [];
        for (let i = 0; i <= nu; i++) row.push(pt(i / nu * 2 - 1, j / nv));
        grid.push(row);
      }
      const nrm = (i, j) => {
        const a = grid[j][Math.max(0, i - 1)], c = grid[j][Math.min(nu, i + 1)], d = grid[Math.max(0, j - 1)][i], e = grid[Math.min(nv, j + 1)][i];
        const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = e[0] - d[0], vy = e[1] - d[1], vz = e[2] - d[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz);
        if (!(l > 1e-9)) return [1, 0, 0];
        return [nx / l, ny / l, nz / l];
      };
      const V = (i, j) => b._v(grid[j][i], nrm(i, j), i / nu, j / nv, bladeCol);
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        V(i, j);
        V(i + 1, j);
        V(i + 1, j + 1);
        V(i, j);
        V(i + 1, j + 1);
        V(i, j + 1);
      }
      const span = Math.ceil((f.alphaMax + 0.5) / TAU * zPin);
      const before = b.uv.length;
      gear(b, { mod: 2 * rho / zPin, z: zPin, face: 0.034, phase: Math.PI }, null, gearCol, { teeth: [-1, span + 1], hubR: 0.012 });
      for (let k = before; k < b.uv.length; k += 2) {
        b.uv[k] = 0.5;
        b.uv[k + 1] = 0.96;
      }
    }
    function cam(b, radiusFn, t, m, col, seg = 28) {
      const P = (a, zz) => {
        const r = radiusFn(a);
        return [r * Math.cos(a), r * Math.sin(a), zz];
      };
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
        b.quad(P(a0, -t / 2), P(a1, -t / 2), P(a1, t / 2), P(a0, t / 2), col, [0, 0, 0], m);
        b.tri([0, 0, t / 2], P(a0, t / 2), P(a1, t / 2), col, [0, 0, 0], m);
        b.tri([0, 0, -t / 2], P(a0, -t / 2), P(a1, -t / 2), col, [0, 0, 0], m);
      }
    }
    const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
    const vmad = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
    const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const vnorm = (a, fb = [0, 1, 0]) => {
      const l = Math.hypot(a[0], a[1], a[2]);
      return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fb.slice();
    };
    return { vadd, vsub, vmul, vmad, vdot, vcross, vnorm, Builder, rgb, perp, frame, frameY, frameZ, compose, mt, mrx, mry, mrz, mscale, rod, ball, box, torus, lathe, gear, gem, petal, cam, A };
  }

  // app/hero/station.js
  function buildStation(ctx, m, P) {
    const { THREE, G, mats, col, staticB } = ctx;
    const { vadd, vsub, vmul, vmad, vdot, vcross, vnorm } = G;
    const cfg = m.cfg, gp = P.gearing, mp = P.mirror, cp = P.crank;
    const isTurn = cfg.kind === "turntable";
    const c = [m.c.x, m.c.y, m.c.z], a = [m.a.x, m.a.y, m.a.z], n0 = [m.n0.x, m.n0.y, m.n0.z];
    const u0 = vcross(a, n0);
    const toLocal = (v) => [vdot(v, u0), vdot(v, a), vdot(v, n0)];
    const sEnd = isTurn ? -1 : 1;
    const aEnd = vmul(a, sEnd);
    const frameEnd = cfg.along / 2 + mp.frameBar;
    const mod = gp.module, z1 = gp.z1, z2 = gp.z2;
    const r2 = pitchRadius(mod, z2);
    const bevel = Math.abs(aEnd[2]) < 0.6;
    let crankO, crankX, crankZ, hw, sigma, gear2M, gear2Spec, bearing, apex = null, cones = null;
    if (bevel) {
      cones = bevelCones(mod, z1, z2);
      const { d1, d2, R } = cones;
      const A1 = vnorm(vsub([0, 0, 1], vmul(aEnd, aEnd[2])));
      let A2;
      if (isTurn) {
        apex = vmad(c, aEnd, frameEnd + 0.3);
        A2 = aEnd;
      } else {
        apex = vmad(c, aEnd, frameEnd + 0.2 + R * Math.cos(d2));
        A2 = vmul(aEnd, -1);
      }
      crankO = apex;
      crankX = A2;
      crankZ = A1;
      hw = R * Math.cos(d1) + 0.3;
      sigma = vdot(A2, a);
      gear2M = G.frame(toLocal(vsub(apex, c)), toLocal(A1), null, toLocal(A2));
      gear2Spec = { mod, z: z2, face: gp.face, cone: d2, R, phase: Math.PI / z2 };
      bearing = vmad(apex, A1, R * Math.cos(d1) + 0.14);
    } else {
      const down = vnorm(vsub([0, -1, 0], vmul(aEnd, -aEnd[1])));
      const Gc = vmad(c, aEnd, frameEnd + 0.2);
      const Pc = vmad(Gc, down, centerDistance(mod, z1, z2));
      crankO = Pc;
      crankX = vmul(down, -1);
      crankZ = aEnd;
      hw = 0.27;
      sigma = sEnd;
      gear2M = G.frame(toLocal(vsub(Gc, c)), toLocal(down), null, toLocal(aEnd));
      gear2Spec = { mod, z: z2, face: gp.face, phase: Math.PI / z2 };
      bearing = vmad(Pc, aEnd, -0.13);
    }
    const crankY = vcross(crankZ, crankX);
    const mb = new G.Builder();
    const bar = mp.frameBar, dep = mp.frameDepth, hx = cfg.across / 2, hy = cfg.along / 2;
    for (const s of [1, -1]) {
      G.box(mb, [cfg.across + 2 * bar, bar, dep], G.mt(0, s * (hy + bar / 2), 0), col.brass);
      G.box(mb, [bar, cfg.along, dep], G.mt(s * (hx + bar / 2), 0, 0), col.brass);
      for (const t of [1, -1]) G.ball(mb, [s * (hx + bar / 2), t * (hy + bar / 2), 0], 0.058, col.bright, { ws: 8, hs: 6 });
    }
    const gearLocalY = toLocal(vsub(bevel ? apex : crankO, c))[1];
    const shaftTo = bevel ? gearLocalY + (isTurn ? sEnd * 0.26 : -sEnd * 0.12) : sEnd * (frameEnd + 0.26);
    G.rod(mb, [0, sEnd * (hy + bar * 0.5), 0], [0, shaftTo, 0], mp.shaftRadius * (isTurn ? 1.35 : 1), col.iron, { caps: true });
    if (!isTurn) G.rod(mb, [0, -sEnd * (hy + bar * 0.5), 0], [0, -sEnd * (frameEnd + 0.13), 0], mp.shaftRadius, col.iron, { caps: true });
    G.gear(mb, gear2Spec, gear2M, col.bright, { webCol: col.brass, hubR: 0.07, holes: 6, holeCol: col.bronze });
    const mirrorGeo = ctx.own(mb.build());
    const pivot = new THREE.Mesh(mirrorGeo, mats.brass);
    pivot.name = cfg.id + "-mirror";
    pivot.position.set(c[0], c[1], c[2]);
    ctx.root.add(pivot);
    const cb = new G.Builder();
    if (bevel) {
      G.gear(cb, { mod, z: z1, face: gp.face, cone: cones.d1, R: cones.R, phase: 0 }, null, col.bright, { webCol: col.brass, hubR: 0.045 });
      G.rod(cb, [0, 0, (cones.R - gp.face) * Math.cos(cones.d1) - 0.01], [0, 0, hw + 0.05], mp.shaftRadius, col.iron, { caps: true });
    } else {
      G.gear(cb, { mod, z: z1, face: gp.face * 1.15, phase: 0 }, null, col.bright, { webCol: col.brass, hubR: 0.045 });
      G.rod(cb, [0, 0, -0.17], [0, 0, hw + 0.05], mp.shaftRadius, col.iron, { caps: true });
    }
    const Rw = cp.wheelRadius;
    G.torus(cb, Rw, cp.rimTube, G.mt(0, 0, hw), col.bright, { rs: 7, ts: 26 });
    for (let i = 0; i < cp.spokes; i++) {
      const an = i / cp.spokes * Math.PI * 2 + Math.PI / 2;
      G.rod(cb, [0.04 * Math.cos(an), 0.04 * Math.sin(an), hw], [Rw * Math.cos(an), Rw * Math.sin(an), hw], 0.024, col.brass, { seg: 6 });
    }
    G.ball(cb, [0, 0, hw], 0.08, col.bright, { ws: 10, hs: 6, squash: 0.7, m: G.mrx(Math.PI / 2) });
    G.rod(cb, [0, Rw, hw], [0, Rw, hw + 0.1], 0.02, col.iron, { seg: 6 });
    const crankGeo = ctx.own(cb.build());
    const crankMat = ctx.own(mats.brass.clone());
    crankMat.emissive = new THREE.Color(16761946);
    crankMat.emissiveIntensity = 0;
    const crank = new THREE.Mesh(crankGeo, crankMat);
    crank.name = cfg.id + "-crank";
    crank.position.set(crankO[0], crankO[1], crankO[2]);
    const crankBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...crankX),
      new THREE.Vector3(...crankY),
      new THREE.Vector3(...crankZ)
    ));
    crank.quaternion.copy(crankBase);
    ctx.root.add(crank);
    const wheelCenter = vmad(crankO, crankZ, hw);
    G.rod(staticB, vmad(bearing, crankZ, -0.055), vmad(bearing, crankZ, 0.055), 0.066, col.bright, { caps: true, seg: 10 });
    let shadowAt;
    if (isTurn) {
      const back = cones.R * Math.cos(cones.d2) + 1.25 * mod * Math.sin(cones.d2);
      const yTop = apex[1] - back - 0.035;
      const rc = yTop > 2 ? 0.1 : 0.085;
      G.lathe(
        staticB,
        [[0.48, 0], [0.48, 0.045], [0.34, 0.1], [0.16, 0.21], [rc + 0.02, 0.36], [rc, yTop - 0.2], [0.17, yTop - 0.1], [0.17, yTop], [0, yTop]],
        G.mt(c[0], 0, c[2]),
        col.bronze,
        { seg: 14 }
      );
      const bd = [bearing[0], yTop - 0.15, bearing[2]];
      G.rod(staticB, bearing, bd, 0.034, col.bronze);
      G.rod(staticB, bd, [c[0], yTop - 0.15, c[2]], 0.034, col.bronze);
      G.ball(staticB, bd, 0.05, col.bright, { ws: 8, hs: 6 });
      shadowAt = [c[0], c[2], 1.25];
    } else {
      const dnS = cfg.hang ? 1 : -1;
      const dn = vnorm(vsub([0, dnS, 0], vmul(a, dnS * a[1])));
      const Rc = cfg.across / 2 + bar + 0.13;
      const Bp = [1, -1].map((s) => vmad(c, a, s * (frameEnd + 0.07)));
      const ends = Bp.map((p) => vmad(p, dn, Rc));
      for (let i = 0; i < 2; i++) {
        G.rod(staticB, Bp[i], ends[i], 0.042, col.bronze);
        G.torus(staticB, 0.075, 0.032, G.frameZ(Bp[i], a), col.bright, { rs: 6, ts: 12 });
        G.ball(staticB, ends[i], 0.062, col.bright, { ws: 8, hs: 6 });
      }
      G.rod(staticB, ends[0], ends[1], 0.042, col.bronze);
      const Cb = vmad(c, dn, Rc);
      if (cfg.hang) {
        const [mx, mz] = cfg.mast;
        const yM = Cb[1] + 0.3;
        G.rod(staticB, Cb, [Cb[0], yM, Cb[2]], 0.05, col.bronze);
        G.lathe(
          staticB,
          [[0.44, 0], [0.44, 0.045], [0.3, 0.1], [0.15, 0.22], [0.11, 0.4], [0.085, yM - 0.1], [0.12, yM - 0.04], [0.12, yM + 0.05], [0, yM + 0.12]],
          G.mt(mx, 0, mz),
          col.bronze,
          { seg: 12 }
        );
        G.rod(staticB, [mx, yM, mz], [Cb[0], yM, Cb[2]], 0.06, col.bronze);
        G.rod(staticB, [mx, yM - 0.75, mz], vmad([mx, yM, mz], vsub([Cb[0], yM, Cb[2]], [mx, yM, mz]), 0.7), 0.03, col.brass);
        G.ball(staticB, [Cb[0], yM, Cb[2]], 0.085, col.bright, { ws: 10, hs: 7 });
        shadowAt = [mx, mz, 1.1];
      } else {
        G.lathe(
          staticB,
          [[0.44, 0], [0.44, 0.045], [0.3, 0.1], [0.14, 0.2], [0.095, 0.33], [0.075, Cb[1] - 0.1], [0.11, Cb[1] - 0.05], [0.11, Cb[1] + 0.02], [0, Cb[1] + 0.045]],
          G.mt(Cb[0], 0, Cb[2]),
          col.bronze,
          { seg: 12 }
        );
        shadowAt = [Cb[0], Cb[2], 1.2];
      }
      if (bevel) {
        const p1 = vmad(apex, dn, Rc), p2 = vmad(p1, crankZ, vdot(vsub(bearing, apex), crankZ));
        G.rod(staticB, ends[0], p1, 0.03, col.bronze);
        G.rod(staticB, p1, p2, 0.03, col.bronze);
        G.rod(staticB, p2, bearing, 0.03, col.bronze);
        G.ball(staticB, p1, 0.04, col.bright, { ws: 6, hs: 5 });
        G.ball(staticB, p2, 0.04, col.bright, { ws: 6, hs: 5 });
      } else {
        G.rod(staticB, Bp[0], bearing, 0.036, col.bronze);
      }
    }
    const hit = new THREE.Group();
    hit.name = cfg.id + "-hit";
    const hMirror = new THREE.Mesh(ctx.hitGeo, mats.hit);
    hMirror.position.set(c[0], c[1], c[2]);
    hMirror.scale.setScalar(0.62);
    const hWheel = new THREE.Mesh(ctx.hitGeo, mats.hit);
    hWheel.position.set(wheelCenter[0], wheelCenter[1], wheelCenter[2]);
    hWheel.scale.setScalar(0.5);
    hMirror.visible = hWheel.visible = false;
    hit.add(hMirror, hWheel);
    ctx.root.add(hit);
    let fx = a[1], fy = -a[0];
    const fl = Math.hypot(fx, fy);
    if (fl > 1e-3) {
      fx /= fl;
      fy /= fl;
    } else {
      fx = 1;
      fy = 0;
    }
    const drag = Math.abs(fx) >= Math.abs(fy) ? "x" : "y";
    const k = P.drive.crossGain;
    const gx = fx + k * fy, gy = fy - k * fx;
    const wheelFlip = drag === "x" && sigma * Math.sign(crankZ[2] || 1) * Math.sign(gx) < 0 ? -1 : 1;
    return {
      id: cfg.id,
      m,
      cfg,
      pivot,
      crank,
      crankMat,
      crankBase,
      sigma,
      ratio: z2 / z1,
      wheelCenter: new THREE.Vector3(...wheelCenter),
      mirrorCenter: new THREE.Vector3(...c),
      knobLocal: new THREE.Vector3(0, Rw, hw + 0.13),
      gx,
      gy,
      wheelFlip,
      drag,
      shadowAt,
      bevel,
      gear2M,
      gear2Spec,
      cones,
      handle: { id: cfg.id, object: hit, drag, enabled: true },
      // 状態
      theta: m.theta0,
      raw: m.theta0,
      target: m.theta0,
      phi: 0,
      tickAt: m.theta0,
      grabSign: 1,
      hint: 0,
      dim: 0
    };
  }

  // app/hero/receivers.js
  function buildLamp(ctx, L, P) {
    const { THREE, G, mats, col, staticB } = ctx;
    const p0 = L.lamp.p0, r = P.lamp.radius;
    G.lathe(
      staticB,
      [[0.44, 0], [0.44, 0.045], [0.3, 0.1], [0.14, 0.2], [0.09, 0.34], [0.075, p0.y - 0.64], [0.2, p0.y - 0.52], [0.31, p0.y - 0.36], [0.335, p0.y - 0.2], [0.3, p0.y - 0.2]],
      G.mt(p0.x, 0, p0.z),
      col.bronze,
      { seg: 14 }
    );
    const geo = ctx.own(new THREE.SphereGeometry(r, 20, 14));
    const ball = new THREE.Mesh(geo, mats.lamp);
    ball.name = "lamp";
    ball.position.set(p0.x, p0.y, p0.z);
    ctx.root.add(ball);
    ctx.shadows.push([p0.x, p0.z, 1.15]);
    return { ball };
  }
  function buildPillar(ctx, R, P) {
    const { THREE, G, mats, col, staticB } = ctx;
    const p = P.pillar, cm = p.cam;
    const bx = p.base[0], bz = p.base[2];
    const pitchY = p.drumHeight + p.gap;
    const yT = p.firstDrumY + p.drums * pitchY;
    G.lathe(
      staticB,
      [[0.52, 0], [0.52, 0.06], [0.42, 0.13], [0.42, 0.3], [0.35, 0.37], [0.35, p.firstDrumY - 0.02], [0, p.firstDrumY - 0.02]],
      G.mt(bx, 0, bz),
      col.bronze,
      { seg: 16 }
    );
    G.rod(staticB, [bx, p.firstDrumY - 0.02, bz], [bx, yT, bz], 0.13, col.iron, { seg: 10 });
    G.lathe(staticB, [[0.3, yT - 0.01], [0.37, yT + 0.03], [0.37, yT + 0.08], [0, yT + 0.08]], G.mt(bx, 0, bz), col.bronze, { seg: 16 });
    const y0 = yT + 0.08;
    const camY = y0 + cm.baseRadius + cm.lift + 0.06;
    const cd = centerDistance(cm.module, cm.zMotor, cm.zCam);
    const zGear = -0.035, zCam = 0.05;
    G.box(staticB, [cd + 0.62, 0.66, 0.035], G.mt(bx + cd / 2, y0 + 0.33, bz - 0.1), col.brass);
    const guideY = camY + cm.baseRadius + cm.lift + 0.1;
    G.box(staticB, [0.17, 0.05, 0.1 + zCam + 0.06], G.mt(bx, guideY, bz - 0.1 + (0.1 + zCam + 0.06) / 2), col.bronze);
    G.rod(staticB, [bx + cd, camY, bz - 0.1], [bx + cd, camY, bz - 0.3], 0.095, col.bronze, { caps: true, seg: 10 });
    const db = new G.Builder();
    const white = [1, 1, 1];
    G.gear(db, { mod: 2 * p.drumRadius / p.drumTeeth, z: p.drumTeeth, face: p.drumHeight }, G.mrx(-Math.PI / 2), white, { hubR: 0.13, webCol: [0.8, 0.8, 0.8] });
    const drumGeo = ctx.own(db.build());
    const drums = new THREE.InstancedMesh(drumGeo, mats.paint, p.drums);
    drums.name = "pillar-drums";
    drums.frustumCulled = false;
    ctx.root.add(drums);
    const cb = new G.Builder();
    G.cam(cb, (a) => camRadius(a, cm.baseRadius, cm.lift, cm.lobes), 0.06, G.mt(0, 0, zCam), col.copper);
    G.gear(cb, { mod: cm.module, z: cm.zCam, face: 0.045 }, G.mt(0, 0, zGear), col.bright, { webCol: col.brass, hubR: 0.04, holes: 5, holeCol: col.bronze });
    G.rod(cb, [0, 0, -0.1], [0, 0, zCam + 0.05], 0.028, col.iron, { caps: true, seg: 6 });
    const camBody = new THREE.Mesh(ctx.own(cb.build()), mats.brass);
    camBody.position.set(bx, camY, bz);
    camBody.name = "pillar-cam";
    const pb = new G.Builder();
    G.gear(pb, { mod: cm.module, z: cm.zMotor, face: 0.05 }, G.mt(0, 0, zGear), col.bright, { webCol: col.brass, hubR: 0.03 });
    G.rod(pb, [0, 0, -0.1], [0, 0, zGear + 0.05], 0.026, col.iron, { caps: true, seg: 6 });
    const pinion = new THREE.Mesh(ctx.own(pb.build()), mats.brass);
    pinion.position.set(bx + cd, camY, bz);
    pinion.name = "pillar-pinion";
    const fb = new G.Builder();
    G.ball(fb, [0, 0.035, 0], 0.035, col.iron, { ws: 8, hs: 6 });
    const rodTop = cm.baseRadius + cm.lift + 0.34;
    G.rod(fb, [0, 0.05, 0], [0, rodTop, 0], 0.022, col.iron, { seg: 6 });
    G.ball(fb, [0, rodTop + 0.1, 0], 0.11, col.bright, { ws: 12, hs: 8 });
    G.lathe(fb, [[0.02, rodTop - 0.02], [0.15, rodTop + 0.08], [0.02, rodTop + 0.12]], null, col.copper, { seg: 8 });
    const follower = new THREE.Mesh(ctx.own(fb.build()), mats.brass);
    follower.position.set(bx, camY, bz + zCam);
    follower.name = "pillar-follower";
    ctx.root.add(camBody, pinion, follower);
    ctx.shadows.push([bx, bz, 1.45]);
    const asleep = new THREE.Color(12895442);
    const colors = p.colors.map((h) => new THREE.Color(h));
    const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const st = { phi: 0, speed: 0, popped: 0, glow: new Float32Array(p.drums), bump: new Float32Array(p.drums) };
    function update(dt, rx, env) {
      const awakeT = rx.awake ? rx.wakeT : -1;
      const want = rx.awake ? cm.motorSpeed * (env.finale > 0 ? 1.5 : 1) : 0;
      st.speed += (want - st.speed) * Math.min(1, dt * 2.5);
      st.phi += st.speed * dt;
      const psi = meshAngle(st.phi, cm.zMotor, cm.zCam);
      camBody.rotation.z = psi;
      pinion.rotation.z = Math.PI + st.phi;
      follower.position.y = camY + camRadius(Math.PI / 2 - psi, cm.baseRadius, cm.lift, cm.lobes);
      for (let k = 0; k < p.drums; k++) {
        const on = awakeT >= k * p.stepDelay;
        if (on && st.popped <= k) {
          st.popped = k + 1;
          st.bump[k] = 1;
          env.sound("pop", { gain: 0.55, pitch: [0, 2, 4, 7, 9, 12, 14][k % 7], position: rx.pos });
        }
        st.glow[k] += ((on ? 1 : 0) - st.glow[k]) * Math.min(1, dt * 7);
        st.bump[k] = Math.max(0, st.bump[k] - dt * 3.5);
        const pre = rx.awake ? 0 : clamp01(rx.charge * 1.4 - k * 0.12) * 0.35;
        let target = colors[k % colors.length];
        if (env.finale > 0) {
          const f = (env.time * 1.6 - k * 0.5) % colors.length, i0 = Math.floor((f + colors.length) % colors.length);
          target = tmpC2.copy(colors[i0]).lerp(colors[(i0 + 1) % colors.length], smooth(f - Math.floor(f)));
        }
        tmpC.copy(asleep).lerp(target, Math.max(st.glow[k], pre));
        drums.setColorAt(k, tmpC);
        const s = 1 + 0.14 * Math.sin(st.bump[k] * Math.PI) * st.bump[k];
        q.setFromAxisAngle(up, (k % 2 ? -1 : 1) * psi * 0.5 + k * 0.26);
        pos.set(bx, p.firstDrumY + (k + 0.5) * pitchY, bz);
        sc.set(s, 1, s);
        m4.compose(pos, q, sc);
        drums.setMatrixAt(k, m4);
      }
      drums.instanceMatrix.needsUpdate = true;
      if (drums.instanceColor) drums.instanceColor.needsUpdate = true;
    }
    function reset() {
      st.phi = 0;
      st.speed = 0;
      st.popped = 0;
      st.glow.fill(0);
      st.bump.fill(0);
    }
    return { update, reset, drums };
  }
  function buildGemStand(ctx, R, P) {
    const { THREE, G, mats, col, staticB } = ctx;
    const g = P.gem;
    const Gc = [R.c.x, R.c.y, R.c.z];
    const A = [0, Math.cos(g.tilt), Math.sin(g.tilt)];
    const M = G.frame(Gc, [1, 0, 0], A, null);
    const hp = g.radius * Math.tan(g.pavilionAngle);
    const yG = -hp - 0.1;
    const cd = centerDistance(g.module, g.zMotor, g.zGem);
    const X = (x, y, z) => {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(M);
      return [v.x, v.y, v.z];
    };
    const cb = new G.Builder();
    G.lathe(cb, [[0.05, -hp - 0.07], [0.13, -hp + 0.02], [0.2, -hp * 0.5], [0.215, -hp * 0.5 + 0.02]], null, col.bright, { seg: 12 });
    for (let i = 0; i < 4; i++) {
      const an = i / 4 * TAU + 0.4;
      G.rod(cb, [0.2 * Math.cos(an), -hp * 0.5, 0.2 * Math.sin(an)], [g.radius * 1.02 * Math.cos(an), 0.02, g.radius * 1.02 * Math.sin(an)], 0.016, col.bright, { seg: 5 });
    }
    G.gear(cb, { mod: g.module, z: g.zGem, face: 0.05 }, G.compose(G.mt(0, yG, 0), G.mrx(-Math.PI / 2)), col.bright, { webCol: col.brass, hubR: 0.05, holes: 6, holeCol: col.bronze });
    G.rod(cb, [0, yG - 0.16, 0], [0, -hp - 0.05, 0], 0.035, col.iron, { seg: 8 });
    const carrier = new THREE.Mesh(ctx.own(cb.build()), mats.brass);
    carrier.name = "gem-carrier";
    const baseQ = new THREE.Quaternion().setFromRotationMatrix(M);
    carrier.position.set(Gc[0], Gc[1], Gc[2]);
    const pb = new G.Builder();
    G.gear(pb, { mod: g.module, z: g.zMotor, face: 0.06 }, G.mrx(-Math.PI / 2), col.bright, { webCol: col.brass, hubR: 0.035 });
    G.rod(pb, [0, -0.12, 0], [0, 0.05, 0], 0.03, col.iron, { caps: true, seg: 6 });
    const pinion = new THREE.Mesh(ctx.own(pb.build()), mats.brass);
    pinion.name = "gem-pinion";
    pinion.position.fromArray(X(cd, yG, 0));
    ctx.root.add(carrier, pinion);
    G.rod(staticB, X(0, yG - 0.3, 0), X(0, yG - 0.12, 0), 0.07, col.bronze, { caps: true, seg: 10 });
    G.rod(staticB, X(cd, yG - 0.3, 0), X(cd, yG - 0.08, 0), 0.085, col.bronze, { caps: true, seg: 10 });
    G.rod(staticB, X(-0.02, yG - 0.24, 0), X(cd + 0.02, yG - 0.24, 0), 0.04, col.brass);
    const hb = X(cd, yG - 0.3, 0);
    const post = [Gc[0] + g.postOffset, hb[1] - 0.18, hb[2]];
    G.rod(staticB, hb, [hb[0], post[1], hb[2]], 0.04, col.brass);
    G.rod(staticB, [hb[0], post[1], hb[2]], post, 0.045, col.bronze);
    G.ball(staticB, [hb[0], post[1], hb[2]], 0.06, col.bright, { ws: 8, hs: 6 });
    G.lathe(
      staticB,
      [[0.4, 0], [0.4, 0.045], [0.28, 0.1], [0.13, 0.2], [0.09, 0.34], [0.07, post[1] - 0.1], [0.1, post[1] - 0.04], [0.1, post[1] + 0.04], [0, post[1] + 0.09]],
      G.mt(post[0], 0, post[2]),
      col.bronze,
      { seg: 12 }
    );
    ctx.shadows.push([post[0], post[2], 1.05]);
    const qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(Gc[0], Gc[1], Gc[2]), sc = new THREE.Vector3(), q = new THREE.Quaternion();
    const dull = new THREE.Color(7304322), bright = new THREE.Color(1.02, 1.02, 1.1), tmpC = new THREE.Color();
    const st = { phi: 0, speed: 0, glow: 0, pop: 0 };
    const slot = ctx.gems.alloc(1);
    function update(dt, rx, env) {
      const want = rx.awake ? g.motorSpeed * smooth(rx.wakeT / 1.5) : 0;
      st.speed = want;
      st.phi += st.speed * dt;
      const psi = meshAngle(st.phi, g.zMotor, g.zGem);
      carrier.quaternion.copy(baseQ).multiply(qy.setFromAxisAngle(up, psi));
      pinion.quaternion.copy(baseQ).multiply(qy.setFromAxisAngle(up, Math.PI + st.phi));
      st.glow += ((rx.awake ? 1 : clamp01(rx.charge) * 0.45) - st.glow) * Math.min(1, dt * 6);
      st.pop = rx.awake ? Math.max(0, 1 - rx.wakeT / 0.6) : 0;
      const s = 1 + 0.22 * Math.sin(st.pop * Math.PI) + (env.finale > 0 ? 0.05 * Math.sin(env.time * 4) : 0);
      q.copy(carrier.quaternion);
      sc.set(s, s, s);
      m4.compose(pos, q, sc);
      ctx.gems.mesh.setMatrixAt(slot, m4);
      ctx.gems.mesh.setColorAt(slot, tmpC.copy(dull).lerp(bright, st.glow));
      ctx.gems.dirty = true;
    }
    function reset() {
      st.phi = 0;
      st.speed = 0;
      st.glow = 0;
      st.pop = 0;
    }
    return { update, reset };
  }

  // app/hero/flower.js
  function createFlowers(ctx, P, maxFlowers, maxPetals) {
    const { THREE, G, mats, col, staticB, paintB } = ctx;
    const f = P.flowerMachine;
    const r = f.crankRadius, l = f.rodLength;
    const rho = rackPinionRadius(r, f.alphaMax);
    const zPin = Math.max(8, Math.round(2 * rho / f.rackModule));
    const rackMod = 2 * rho / zPin, pitch = Math.PI * rackMod;
    const Rc = f.hingeRadius - rho;
    const D = -f.crankY + (l + r);
    const rodZ = f.crankZ + 0.045;
    const pb = new G.Builder();
    G.petal(pb, f, { rho, zPin, gearCol: [1, 0.72, 0.22] });
    const petalGeo = ctx.own(pb.build());
    const petals = new THREE.InstancedMesh(petalGeo, mats.petal, maxPetals);
    petals.name = "petals";
    const sb = new G.Builder();
    const yb = -(2 * r + 2.5 * pitch), yt = 1.2 * pitch;
    const prof = [[0.03, yb], [Rc - 1.25 * rackMod, yb + 0.01]];
    for (let k = Math.ceil(yb / pitch); (k + 0.5) * pitch < yt - 0.3 * pitch; k++) {
      const yc = (k + 0.5) * pitch;
      if (yc - 0.29 * pitch < yb + 0.012) continue;
      prof.push([Rc - 1.25 * rackMod, yc - 0.29 * pitch], [Rc + rackMod, yc - 0.14 * pitch], [Rc + rackMod, yc + 0.14 * pitch], [Rc - 1.25 * rackMod, yc + 0.29 * pitch]);
    }
    prof.push([Rc - 1.25 * rackMod, yt], [0.075, yt + 0.02], [0.09, yt + 0.07], [0.055, yt + 0.13], [0, yt + 0.155]);
    G.lathe(sb, prof, null, col.pollen, { seg: 12 });
    G.rod(sb, [0, -D, 0], [0, yb, 0], 0.03, col.iron, { seg: 6 });
    const tr = f.tubeRadius;
    G.lathe(sb, [[tr + 0.01, -D - 0.055], [tr + 0.04, -D - 0.04], [tr + 0.04, -D + 0.04], [tr + 0.01, -D + 0.055]], null, col.bright, { seg: 12 });
    G.rod(sb, [0, -D, tr], [0, -D, rodZ + 0.025], 0.021, col.iron, { seg: 6, caps: true });
    const sliders = new THREE.InstancedMesh(ctx.own(sb.build()), mats.brass, maxFlowers);
    sliders.name = "flower-sliders";
    const db = new G.Builder();
    G.gear(db, { mod: 2 * f.discRadius / 20, z: 20, face: 0.035 }, null, col.bright, { webCol: col.brass, hubR: 0.03, holes: 4, holeCol: col.bronze });
    G.rod(db, [0, -r, 0], [0, -r, 0.075], 0.022, col.iron, { seg: 6, caps: true });
    G.ball(db, [0, 0, 0.02], 0.04, col.bright, { ws: 8, hs: 5 });
    const discs = new THREE.InstancedMesh(ctx.own(db.build()), mats.brass, maxFlowers);
    discs.name = "flower-cranks";
    const rb = new G.Builder();
    G.box(rb, [0.042, l, 0.018], G.mt(0, l / 2, 0), col.copper);
    for (const y of [0, l]) G.rod(rb, [0, y, -0.012], [0, y, 0.012], 0.036, col.copper, { seg: 8, caps: true });
    const rods = new THREE.InstancedMesh(ctx.own(rb.build()), mats.brass, maxFlowers);
    rods.name = "flower-rods";
    for (const im of [petals, sliders, discs, rods]) {
      im.frustumCulled = false;
      im.count = 0;
      ctx.root.add(im);
    }
    const flowers = [];
    const tmp = new THREE.Matrix4(), out = new THREE.Matrix4();
    const cA = new THREE.Color(), cB = new THREE.Color();
    function add({ H, A, S, count, color, color2 }) {
      const X = [1, 0, 0];
      const M = G.frame(H, X, A, null, S);
      const P3 = (x, y, z) => {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(M);
        return [v.x, v.y, v.z];
      };
      const fl = { M, S, index: flowers.length, petal0: petals.count, count, phi: 0, lastPhi: NaN, u: 0, base: [], P3 };
      flowers.push(fl);
      petals.count += count;
      sliders.count = discs.count = rods.count = flowers.length;
      cA.set(color);
      cB.set(color2 === void 0 ? color : color2);
      for (let k = 0; k < count; k++) {
        const beta = (k + 0.5) / count * TAU;
        fl.base.push(G.compose(M, G.mry(beta), G.mt(f.hingeRadius, 0, 0)));
        petals.setColorAt(fl.petal0 + k, k % 2 ? cB : cA);
      }
      fl.discBase = G.compose(M, G.mt(0, f.crankY, f.crankZ));
      G.rod(paintB, P3(0, f.tubeBottom, 0), P3(0, yb - 0.02, 0), tr * S, col.stem, { seg: 10 });
      G.lathe(staticB, [[tr, yb - 0.09], [tr + 0.035, yb - 0.07], [tr + 0.035, yb - 0.02], [0.04, yb - 0.02]], M, col.bright, { seg: 10 });
      G.torus(staticB, f.hingeRadius, 0.024, G.compose(M, G.mrx(Math.PI / 2)), col.bright, { rs: 5, ts: Math.max(12, count * 2) });
      const struts = Math.max(3, Math.floor(count / 2));
      for (let i = 0; i < struts; i++) {
        const an = Math.round(i / struts * count) / count * TAU;
        G.rod(staticB, P3((tr + 0.02) * Math.cos(an), yb - 0.05, -(tr + 0.02) * Math.sin(an)), P3(f.hingeRadius * Math.cos(an), 0, -f.hingeRadius * Math.sin(an)), 0.016 * S, col.brass, { seg: 5 });
      }
      G.rod(staticB, P3(0, f.crankY, -0.12), P3(0, f.crankY, f.crankZ - 0.02), 0.04 * S, col.bronze, { seg: 8 });
      G.ball(staticB, P3(0, f.crankY, -0.13), 0.1 * S, col.bronze, { ws: 10, hs: 7 });
      apply(fl, true);
      return fl;
    }
    function apply(fl, force) {
      if (!force && fl.phi === fl.lastPhi) return;
      fl.lastPhi = fl.phi;
      const s = sliderPos(fl.phi, r, l);
      const rise = l + r - s;
      const u = clamp01(rise / (2 * r));
      fl.u = u;
      const alpha = rise / rho;
      tmp.makeRotationZ(-alpha);
      for (let k = 0; k < fl.count; k++) petals.setMatrixAt(fl.petal0 + k, out.multiplyMatrices(fl.base[k], tmp));
      tmp.makeTranslation(0, rise, 0);
      sliders.setMatrixAt(fl.index, out.multiplyMatrices(fl.M, tmp));
      tmp.makeRotationZ(fl.phi);
      discs.setMatrixAt(fl.index, out.multiplyMatrices(fl.discBase, tmp));
      const gamma = -Math.asin(Math.max(-1, Math.min(1, r * Math.sin(fl.phi) / l)));
      tmp.makeRotationZ(gamma).setPosition(0, f.crankY - s, rodZ);
      rods.setMatrixAt(fl.index, out.multiplyMatrices(fl.M, tmp));
      petals.instanceMatrix.needsUpdate = sliders.instanceMatrix.needsUpdate = discs.instanceMatrix.needsUpdate = rods.instanceMatrix.needsUpdate = true;
    }
    function makeState(fl) {
      const st = { openT: -1, wink: 0, winkGoal: 0, pre: 0 };
      return {
        st,
        update(dt, rx, env) {
          if (rx.awake) {
            if (st.openT < 0) st.openT = 0;
            st.openT += dt;
            const k = clamp01(st.openT / f.openSeconds);
            const breathe = st.openT > f.openSeconds ? f.breatheAmp * Math.sin(TAU * f.breatheHz * (st.openT - f.openSeconds)) : 0;
            st.wink += (st.winkGoal - st.wink) * Math.min(1, dt * 1.6);
            if (Math.abs(st.winkGoal - st.wink) < 1e-3) st.wink = st.winkGoal;
            const from = st.pre * 0.5;
            fl.phi = from + (Math.PI - from) * easeOutBack(k) + breathe + st.wink;
          } else {
            st.pre += (clamp01(rx.charge) - st.pre) * Math.min(1, dt * 5);
            fl.phi = st.pre * 0.5 + (st.pre > 0.02 ? 0.05 * Math.sin(env.time * 18) * st.pre : 0);
          }
          apply(fl);
        },
        wink() {
          st.winkGoal += TAU;
        },
        reset() {
          st.openT = -1;
          st.wink = 0;
          st.winkGoal = 0;
          st.pre = 0;
          fl.phi = 0;
          apply(fl, true);
        }
      };
    }
    return { add, apply, makeState, petals, sliders, discs, rods, flowers, D, rho, zPin, yb };
  }
  function buildPlanetary(ctx, P, H, A) {
    const { THREE, G, mats, col, staticB } = ctx;
    const pl = P.crown.planet, g = P.gem;
    const M = G.frame(H, [1, 0, 0], A, null);
    const baseQ = new THREE.Quaternion().setFromRotationMatrix(M);
    const Rorb = centerDistance(pl.module, pl.zs, pl.zp);
    const toY = G.mrx(-Math.PI / 2);
    const tubeR = P.flowerMachine.tubeRadius * P.crown.scale;
    G.gear(staticB, { mod: pl.module, z: pl.zs, face: pl.face }, G.compose(M, G.mt(0, pl.planeY, 0), toY), col.bright, { webCol: col.brass, hubR: tubeR + 0.03, holes: 8, holeCol: col.bronze });
    G.lathe(staticB, [[tubeR, pl.planeY - pl.face / 2 - 0.03], [tubeR + 0.06, pl.planeY - pl.face / 2], [tubeR + 0.06, pl.planeY + pl.face / 2], [tubeR, pl.planeY + pl.face / 2 + 0.03]], M, col.bronze, { seg: 10 });
    const yArm = pl.planeY - pl.face / 2 - 0.075;
    const cb = new G.Builder();
    G.lathe(cb, [[tubeR + 0.012, yArm - 0.045], [tubeR + 0.075, yArm - 0.035], [tubeR + 0.075, yArm + 0.035], [tubeR + 0.012, yArm + 0.045]], null, col.copper, { seg: 12 });
    for (let k = 0; k < pl.count; k++) {
      const an = k / pl.count * TAU, cx = Math.cos(an), cz = -Math.sin(an);
      G.rod(cb, [(tubeR + 0.06) * cx, yArm, (tubeR + 0.06) * cz], [Rorb * cx, yArm, Rorb * cz], 0.03, col.copper, { seg: 6 });
      G.rod(cb, [Rorb * cx, yArm - 0.03, Rorb * cz], [Rorb * cx, pl.planeY, Rorb * cz], 0.034, col.iron, { seg: 6, caps: true });
    }
    const carrier = new THREE.Mesh(ctx.own(cb.build()), mats.brass);
    carrier.name = "crown-carrier";
    carrier.position.set(H[0], H[1], H[2]);
    carrier.quaternion.copy(baseQ);
    ctx.root.add(carrier);
    const pb = new G.Builder();
    G.gear(pb, { mod: pl.module, z: pl.zp, face: pl.face }, toY, col.bright, { webCol: col.brass, hubR: 0.05, holes: 3, holeCol: col.bronze });
    G.lathe(pb, [[0.05, pl.face / 2], [0.11, pl.face / 2 + 0.03], [0.12, pl.face / 2 + 0.07]], null, col.copper, { seg: 8 });
    const planets = new THREE.InstancedMesh(ctx.own(pb.build()), mats.brass, pl.count);
    planets.name = "crown-planets";
    planets.frustumCulled = false;
    ctx.root.add(planets);
    const gemS = pl.gemRadius / g.radius;
    const gemLift = pl.face / 2 + 0.05 + g.radius * Math.tan(g.pavilionAngle) * gemS;
    const slot0 = ctx.gems.alloc(pl.count);
    const st = { theta: 0, speed: 0, glow: 0 };
    const tmp = new THREE.Matrix4(), out = new THREE.Matrix4(), qy = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Matrix4();
    const dull = new THREE.Color(7304322), tmpC = new THREE.Color();
    const tints = [16752324, 10479871, 16773280, 12124080, 14271231].map((h) => new THREE.Color(h).multiplyScalar(1.15));
    function update(dt, rx, env) {
      const want = !rx.awake ? 0 : env.finale > 0 ? pl.speedFinale : pl.speedAwake;
      st.speed += (want - st.speed) * Math.min(1, dt * 1.2);
      st.theta += st.speed * dt;
      carrier.quaternion.copy(baseQ).multiply(qy.setFromAxisAngle(up, st.theta));
      st.glow += ((rx.awake ? 1 : clamp01(rx.charge) * 0.4) - st.glow) * Math.min(1, dt * 4);
      for (let k = 0; k < pl.count; k++) {
        const th = st.theta + k / pl.count * TAU;
        const psi = planetToothAngle(st.theta, k, pl.count, pl.zs, pl.zp);
        tmp.makeRotationY(psi).setPosition(Rorb * Math.cos(th), pl.planeY, -Rorb * Math.sin(th));
        planets.setMatrixAt(k, out.multiplyMatrices(M, tmp));
        tmp.setPosition(Rorb * Math.cos(th), pl.planeY + gemLift, -Rorb * Math.sin(th));
        const s = gemS * (1 + (env.finale > 0 ? 0.12 * Math.sin(env.time * 3 + k * 1.3) : 0));
        out.multiplyMatrices(M, tmp).multiply(sc.makeScale(s, s, s));
        ctx.gems.mesh.setMatrixAt(slot0 + k, out);
        ctx.gems.mesh.setColorAt(slot0 + k, tmpC.copy(dull).lerp(tints[k % tints.length], st.glow));
      }
      planets.instanceMatrix.needsUpdate = true;
      ctx.gems.dirty = true;
    }
    function reset() {
      st.theta = 0;
      st.speed = 0;
      st.glow = 0;
    }
    return { update, reset, Rorb, M };
  }

  // app/hero/hero.js
  function createHero(THREE, opts) {
    opts = opts || {};
    const P = PARAMS, D = P.drive;
    const L = deriveLayout(P);
    const G = createGeom(THREE);
    const emit = (e) => {
      try {
        if (opts.onEvent) opts.onEvent(e);
      } catch (_) {
      }
    };
    const sound = (name, extra) => emit(Object.assign({ type: "sound", name }, extra));
    const loadTex = (n) => {
      try {
        return opts.loadTexture ? opts.loadTexture(n) : null;
      } catch (_) {
        return null;
      }
    };
    const root = new THREE.Group();
    root.name = "hero";
    const owned = [];
    const own = (x) => {
      owned.push(x);
      return x;
    };
    const brassTex = loadTex("brass_frame");
    const prismTex = loadTex("prism_rainbow");
    const petalTex = own(makePetalTexture());
    const mats = {
      brass: own(new THREE.MeshStandardMaterial({ map: brassTex, vertexColors: true, metalness: 0.62, roughness: 0.42 })),
      paint: own(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.5 })),
      glass: own(new THREE.MeshStandardMaterial({ color: 15923199, metalness: 1, roughness: 0.05 })),
      gem: own(new THREE.MeshStandardMaterial({ map: prismTex, metalness: 0.2, roughness: 0.12 })),
      petal: own(new THREE.MeshStandardMaterial({ map: petalTex, vertexColors: true, side: THREE.DoubleSide, metalness: 0, roughness: 0.62 })),
      glow: own(new THREE.MeshBasicMaterial({ color: 16777215, toneMapped: false })),
      lamp: own(new THREE.MeshBasicMaterial({ color: 16770448, toneMapped: false })),
      shadow: own(new THREE.MeshBasicMaterial({ map: opts.shared ? opts.shared.blobShadow : null, color: 1709064, transparent: true, opacity: 0.34, depthWrite: false })),
      hit: own(new THREE.MeshBasicMaterial())
    };
    const col = {
      brass: [1, 1, 1],
      bright: [1.35, 1.45, 1.9],
      bronze: [0.5, 0.52, 0.95],
      iron: [0.42, 0.72, 4.2],
      copper: [1.3, 0.72, 1.1],
      pollen: [1.6, 1.9, 1.6],
      stem: G.rgb(6270570),
      leaf: G.rgb(7652470)
    };
    const ctx = {
      THREE,
      G,
      mats,
      col,
      root,
      own,
      P,
      staticB: new G.Builder(),
      paintB: new G.Builder(),
      shadows: [],
      hitGeo: own(new THREE.SphereGeometry(1, 10, 8)),
      gems: null
    };
    {
      const gb = new G.Builder(), g = P.gem;
      G.gem(gb, { R: g.radius, n: g.facets, table: g.table, crownAngle: g.crownAngle, pavilionAngle: g.pavilionAngle }, [1, 1, 1]);
      const mesh = new THREE.InstancedMesh(own(gb.build()), mats.gem, 1 + P.crown.planet.count);
      mesh.name = "gems";
      mesh.frustumCulled = false;
      mesh.count = 0;
      root.add(mesh);
      ctx.gems = { mesh, dirty: true, alloc(n) {
        const i = mesh.count;
        mesh.count += n;
        return i;
      } };
    }
    buildLamp(ctx, L, P);
    const stations = L.mirrors.map((m) => buildStation(ctx, m, P));
    const stationById = {};
    for (const st of stations) {
      stationById[st.id] = st;
      ctx.shadows.push(st.shadowAt);
    }
    const handles = stations.map((st) => st.handle);
    const receivers = L.receivers.map((def) => ({
      id: def.id,
      def,
      cfg: def.cfg,
      lit: 0,
      charge: 0,
      awake: false,
      wakeT: 0,
      machine: null,
      pos: new THREE.Vector3(def.c.x, def.shape === "cylinder" ? def.y1 + 0.35 : def.c.y, def.c.z)
    }));
    const rxById = {};
    for (const rx of receivers) rxById[rx.id] = rx;
    rxById.pillar.machine = buildPillar(ctx, rxById.pillar.def, P);
    rxById.gem.machine = buildGemStand(ctx, rxById.gem.def, P);
    const flowers = createFlowers(ctx, P, 2, P.flower.petals + P.crown.petals);
    const fm = P.flowerMachine;
    function plantFlower(cfg, center) {
      const A = [0, Math.cos(cfg.tilt), Math.sin(cfg.tilt)];
      const k = 0.45 * fm.petalLength * cfg.scale;
      const H = [center.x - A[0] * k, center.y - A[1] * k, center.z - A[2] * k];
      const fl = flowers.add({ H, A, S: cfg.scale, count: cfg.petals, color: cfg.color, color2: cfg.color2 });
      return { fl, H, A, state: flowers.makeState(fl), foot: fl.P3(0, fm.tubeBottom, 0) };
    }
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
    const crn = plantFlower(P.crown, rxById.crown.def.c);
    const planetary = buildPlanetary(ctx, P, crn.H, crn.A);
    {
      const tb = crn.foot;
      G.lathe(
        ctx.staticB,
        [[0.5, 0], [0.5, 0.06], [0.37, 0.13], [0.19, 0.27], [0.125, 0.46], [0.1, tb[1] - 0.2], [0.15, tb[1] - 0.1], [0.15, tb[1] + 0.02], [0, tb[1] + 0.07]],
        G.mt(tb[0], 0, tb[2]),
        col.bronze,
        { seg: 14 }
      );
      ctx.shadows.push([tb[0], tb[2], 1.3]);
    }
    rxById.crown.machine = {
      update(dt, rx, env2) {
        crn.state.update(dt, rx, env2);
        planetary.update(dt, rx, env2);
      },
      reset() {
        crn.state.reset();
        planetary.reset();
      }
    };
    const staticMesh = new THREE.Mesh(own(ctx.staticB.build()), mats.brass);
    staticMesh.name = "hero-static";
    const paintMesh = new THREE.Mesh(own(ctx.paintB.build()), mats.paint);
    paintMesh.name = "hero-paint";
    root.add(staticMesh, paintMesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), tmpC = new THREE.Color();
    const vU = new THREE.Vector3(), vA = new THREE.Vector3(), vN = new THREE.Vector3(), basis = new THREE.Matrix4(), qz = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
    {
      const geo = own(new THREE.PlaneGeometry(1, 1));
      geo.rotateX(-Math.PI / 2);
      const sh = new THREE.InstancedMesh(geo, mats.shadow, ctx.shadows.length);
      sh.name = "hero-shadows";
      ctx.shadows.forEach(([x, z, s], i) => {
        m4.compose(pos.set(x, 0.012, z), q.identity(), sc.set(s, 1, s));
        sh.setMatrixAt(i, m4);
      });
      sh.renderOrder = -1;
      sh.frustumCulled = false;
      root.add(sh);
    }
    const knobB = new G.Builder();
    G.ball(knobB, [0, 0, 0], P.crank.knobRadius, [1, 1, 1], { ws: 10, hs: 8 });
    const knobs = new THREE.InstancedMesh(own(knobB.build()), mats.paint, stations.length);
    knobs.name = "knobs";
    const glass = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), mats.glass, stations.length);
    glass.name = "mirror-glass";
    const knobColor = new THREE.Color(16734564), knobHot = new THREE.Color(16765088);
    const maxRods = P.world.maxBounces + 1;
    const rodGeo = own(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true));
    rodGeo.translate(0, 0.5, 0);
    const rods = new THREE.InstancedMesh(rodGeo, mats.glow, maxRods);
    rods.name = "beam";
    const SPOTS = maxRods + 2 + P.flow.beads + P.fountain.sparks;
    const spots = new THREE.InstancedMesh(own(new THREE.IcosahedronGeometry(1, 1)), mats.glow, SPOTS);
    spots.name = "beam-spots";
    const LAMP_RAYS = P.lamp.rays, BURST_RAYS = P.burst.rays;
    const rayGeo = own(new THREE.ConeGeometry(1, 1, 4, 1));
    rayGeo.translate(0, 0.5, 0);
    const rays = new THREE.InstancedMesh(rayGeo, mats.glow, LAMP_RAYS + BURST_RAYS);
    rays.name = "rays";
    for (const im of [knobs, glass, rods, spots, rays]) {
      im.frustumCulled = false;
      root.add(im);
    }
    const rodColors = P.beam.colors.map((h) => new THREE.Color(h));
    const white = new THREE.Color(1, 1, 1), rayColor = new THREE.Color(16766842);
    for (let i = 0; i < LAMP_RAYS + BURST_RAYS; i++) rays.setColorAt(i, i < LAMP_RAYS ? rayColor : tmpC.set(i % 2 ? 16774084 : 16766574));
    for (let i = 0; i < SPOTS; i++) spots.setColorAt(i, white);
    for (let i = 0; i < maxRods; i++) rods.setColorAt(i, rodColors[i % rodColors.length]);
    for (let i = 0; i < stations.length; i++) knobs.setColorAt(i, knobColor);
    const scene = { origin: L.lamp.origin, dir: L.lamp.d0, mirrors: L.mirrors, receivers: L.receivers, world: P.world };
    const path = makePath(P.world.maxBounces);
    const code = {};
    L.mirrors.forEach((m, i) => {
      code[m.id] = i + 1;
    });
    L.receivers.forEach((r, i) => {
      code[r.id] = i + 8;
    });
    const prevHits = [], prevSeg = [], segLen = [];
    const toothStep = TAU / P.gearing.z2;
    const S = { t: 0, stage: 0, complete: false, busy: false, busyT: 0, finaleT: 0, reveal: 0, sig: -1, grabbed: null, viewBackT: 0, burst: 0, hintSt: stations[0] };
    const lampPos = new THREE.Vector3(L.lamp.p0.x, L.lamp.p0.y, L.lamp.p0.z);
    const crownPos = rxById.crown.pos;
    const fountainPos = new THREE.Vector3(crownPos.x + crn.A[0] * 0.45, crownPos.y + crn.A[1] * 0.45, crownPos.z + crn.A[2] * 0.45);
    const frac = (x) => x - Math.floor(x);
    const env = { time: 0, finale: 0, sound };
    function setBusy(v) {
      if (S.busy !== v) {
        S.busy = v;
        emit({ type: "busy", value: v });
      }
    }
    function warp(st, raw) {
      const w = D.detent * 0.9;
      for (const t of st.m.targets) {
        if (t.theta === null) continue;
        const aim = nearestHalfTurn(t.theta, raw), d = raw - aim;
        if (Math.abs(d) < w) return aim + d * d * d / (w * w);
      }
      return raw;
    }
    function snap(st) {
      let best = null, bestD = D.detent;
      for (const t of st.m.targets) {
        if (t.theta === null) continue;
        const aim = nearestHalfTurn(t.theta, st.raw), d = Math.abs(st.raw - aim);
        if (d < bestD) {
          bestD = d;
          best = aim;
        }
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
          sound("grab", { position: st.wheelCenter });
        }
      }
      if (g && S.grabbed && S.grabbed.id === g.id) {
        const st = S.grabbed;
        const turn = D.dragTurn * (g.ddx * st.gx + g.ddy * st.gy) * st.grabSign;
        if (Number.isFinite(turn)) st.raw += turn;
        st.raw = clamp(st.raw, st.theta - 1, st.theta + 1);
      }
      const rel = input.released;
      if (rel) {
        for (let i = 0; i < rel.length; i++) {
          const st = stationById[rel[i].id];
          if (!st) continue;
          const w = clamp(D.dragTurn * (rel[i].vx * st.gx + rel[i].vy * st.gy) * st.grabSign, -D.maxSpeed, D.maxSpeed);
          if (Number.isFinite(w)) st.raw += w * D.coast;
          snap(st);
          sound("release", { position: st.wheelCenter });
          if (S.grabbed === st) S.grabbed = null;
        }
      }
      if (!g) S.grabbed = null;
    }
    function nextStation() {
      let best = null, bestDepth = -1;
      for (const rx of receivers) {
        if (rx.awake) continue;
        const chain = L.plans[rx.id];
        let depth = 0, need = null;
        for (const step of chain) {
          if (path.hits[step.mirror] !== L.mirrors[step.mirror].id || path.hits[step.mirror + 1] !== step.to) {
            need = stations[step.mirror];
            break;
          }
          depth++;
        }
        if (!need) return null;
        if (depth > bestDepth) {
          bestDepth = depth;
          best = need;
        }
      }
      return best;
    }
    function wake(rx) {
      rx.awake = true;
      rx.wakeT = 0;
      S.stage++;
      emit({ type: "awaken", id: rx.id, position: rx.pos.clone() });
      sound("awaken", { pitch: rx.cfg.pitch, position: rx.pos });
      emit({ type: "stage", index: S.stage, count: receivers.length });
      if (rx.id === "gem") sound("spin", { position: rx.pos });
      if (rx.id === "flower" || rx.id === "crown") sound("bloom", { position: rx.pos });
      if (S.stage >= receivers.length) {
        S.complete = true;
        S.finaleT = 0;
        setBusy(true);
        S.busyT = P.finaleSeconds - 1;
        if (rx.id !== "crown") crn.state.wink();
        if (rx.id !== "flower") flo.state.wink();
        sound("complete");
        emit({ type: "complete", finaleSeconds: P.finaleSeconds, view: "high" });
      } else {
        sound("stage", { gain: 0.6 });
        setBusy(true);
        if (rx.cfg.view) {
          emit({ type: "view", name: rx.cfg.view });
          S.viewBackT = 2.8;
          S.busyT = Math.max(S.busyT, 5.6);
        } else S.busyT = Math.max(S.busyT, 1.6);
      }
    }
    function update(dt, input) {
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
      S.t += dt;
      const t = S.t;
      const hl = input ? input.hintLevel | 0 : 0;
      if (input) handleInput(input);
      for (const st of stations) {
        st.target = warp(st, st.raw);
        const maxStep = D.maxSpeed * dt;
        st.theta += clamp((st.target - st.theta) * Math.min(1, dt * D.follow), -maxStep, maxStep);
        if (Math.abs(st.theta - st.tickAt) >= toothStep) {
          st.tickAt += Math.sign(st.theta - st.tickAt) * toothStep;
          sound("tick", { position: st.wheelCenter });
        }
        const m = st.m;
        setMirrorAngle(m, st.theta);
        basis.makeBasis(vU.set(m.u.x, m.u.y, m.u.z), vA.set(m.a.x, m.a.y, m.a.z), vN.set(m.n.x, m.n.y, m.n.z));
        st.pivot.quaternion.setFromRotationMatrix(basis);
        st.phi = -st.sigma * st.theta * st.ratio;
      }
      trace(scene, path);
      let sig = 0;
      for (let i = 0; i < path.hits.length; i++) sig = sig * 16 + code[path.hits[i]];
      sig = sig * 8 + path.count;
      for (let i = 0; i < path.count; i++) {
        const a = path.pts[i], b = path.pts[i + 1];
        segLen[i] = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      }
      if (sig !== S.sig) {
        let k = 0;
        while (k < prevHits.length && k < path.hits.length && prevHits[k] === path.hits[k]) k++;
        let keep = 0;
        for (let i = 0; i < k && i < path.count; i++) keep += segLen[i];
        if (k < path.count) keep += Math.min(segLen[k], prevSeg[k] || 0);
        S.reveal = Math.min(S.reveal, keep);
        if (S.sig !== -1) {
          const h = path.hits[k];
          sound(h && code[h] < 8 ? "hit" : "beam", { gain: 0.7, position: path.pts[Math.min(k + 1, path.count)] && pos.copy(path.pts[Math.min(k + 1, path.count)]) });
        }
        S.sig = sig;
        prevHits.length = 0;
        for (let i = 0; i < path.hits.length; i++) prevHits.push(path.hits[i]);
      }
      prevSeg.length = path.count;
      for (let i = 0; i < path.count; i++) prevSeg[i] = segLen[i];
      S.reveal = Math.min(path.len, S.reveal + P.beam.growSpeed * dt);
      const full = S.reveal >= path.len - 1e-3;
      env.time = t;
      env.finale = S.complete ? Math.max(S.finaleT, 1e-3) : 0;
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
        if (i < path.count - 1) {
          m4.compose(pos.set(b.x, b.y, b.z), q, sc.set(0.075, 0.075, 0.075));
          spots.setMatrixAt(ns++, m4);
        }
      }
      if (!tip && used > 0) {
        const e = path.pts[path.count], end = path.end;
        const pulse2 = 1 + 0.12 * Math.sin(t * 5);
        dir.set(end.n.x, end.n.y, end.n.z);
        if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
        dir.normalize();
        q.setFromUnitVectors(up, dir);
        pos.set(e.x, e.y, e.z).addScaledVector(dir, 0.02);
        if (end.kind === "floor" || end.kind === "wall") sc.set(0.3 * pulse2, 0.02, 0.3 * pulse2);
        else if (end.kind === "receiver") {
          const s = litRx && !litRx.awake ? 0.1 + 0.26 * litRx.charge : 0.12 * pulse2;
          sc.set(s, s, s);
        } else {
          const s = 0.11 * pulse2;
          sc.set(s, s, s);
        }
        m4.compose(pos, q, sc);
        spots.setMatrixAt(ns++, m4);
      }
      for (let i = 0; i < ns; i++) spots.setColorAt(i, white);
      if (S.complete && path.len > 1e-3) {
        const F = P.flow;
        for (let k = 0; k < F.beads; k++) {
          let s = (t * F.speed + k * path.len / F.beads) % path.len;
          if (s > S.reveal) continue;
          let i = 0;
          while (i < path.count - 1 && s > segLen[i]) {
            s -= segLen[i];
            i++;
          }
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
          if (n === 0 && i > 0) continue;
          const h1 = frac(i * 0.618 + n * 0.37), h2 = frac(i * 0.371 + n * 0.59);
          const az = i * 2.399963 + n * 1.3;
          const vo = F.out[0] + (F.out[1] - F.out[0]) * h1, vu = F.up[0] + (F.up[1] - F.up[0]) * h2;
          pos.set(fountainPos.x + Math.cos(az) * vo * tau, fountainPos.y + vu * tau - 0.5 * F.gravity * tau * tau, fountainPos.z + Math.sin(az) * vo * tau * F.depthSquash);
          const r = F.radius * Math.sqrt(Math.max(0, Math.sin(Math.PI * tau / F.period))) * S.burst * (0.7 + 0.6 * h1);
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
      S.hintSt = !S.busy && !S.complete ? nextStation() : null;
      const pulse = 0.5 + 0.5 * Math.cos(t * TAU * 0.6);
      for (let i = 0; i < stations.length; i++) {
        const st = stations[i];
        const isNext = st === S.hintSt && hl >= 1 && S.grabbed !== st;
        st.hint += ((isNext ? 1 : 0) - st.hint) * Math.min(1, dt * 8);
        st.dim += ((hl >= 2 && S.hintSt && !isNext ? 1 : 0) - st.dim) * Math.min(1, dt * 4);
        st.crankMat.emissiveIntensity = st.hint * (hl >= 2 ? 1 : 0.6) * pulse;
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
      S.burst += ((S.complete ? 1 : 0) - S.burst) * Math.min(1, dt * 1.5);
      for (let i = 0; i < LAMP_RAYS; i++) {
        const an = i / LAMP_RAYS * TAU + t * 0.25;
        const len2 = P.lamp.rayLength * (0.75 + 0.3 * Math.sin(t * 2.3 + i * 2.1)) * (1 + 0.5 * S.burst);
        dir.set(Math.cos(an), Math.sin(an), 0);
        q.setFromUnitVectors(up, dir);
        m4.compose(pos.copy(lampPos).addScaledVector(dir, P.lamp.radius + 0.03), q, sc.set(0.07, len2, 0.07));
        rays.setMatrixAt(i, m4);
      }
      const showBurst = S.burst > 0.01;
      if (showBurst) {
        const B = P.burst;
        for (let j = 0; j < BURST_RAYS; j++) {
          const an = j / BURST_RAYS * TAU + t * B.spin;
          const len2 = (j % 2 ? B.short : B.long) * (0.8 + 0.2 * Math.sin(t * 2.6 + j * 1.9)) * S.burst;
          const cx = Math.cos(an), sy = Math.sin(an) * B.squash;
          dir.set(cx, sy, 0).normalize();
          q.setFromUnitVectors(up, dir);
          pos.set(crownPos.x + cx * B.radius, crownPos.y + 0.05 + sy * B.radius, crownPos.z - B.back);
          m4.compose(pos, q, sc.set(0.13 * S.burst, len2, 0.13 * S.burst));
          rays.setMatrixAt(LAMP_RAYS + j, m4);
        }
      }
      rays.count = showBurst ? LAMP_RAYS + BURST_RAYS : LAMP_RAYS;
      rays.instanceMatrix.needsUpdate = true;
      if (S.viewBackT > 0) {
        S.viewBackT -= dt;
        if (S.viewBackT <= 0 && !S.complete) emit({ type: "view", name: "all" });
      }
      if (S.busy) {
        S.busyT -= dt;
        if (S.busyT <= 0) {
          S.busyT = 0;
          setBusy(false);
        }
      }
      if (S.complete) S.finaleT += dt;
    }
    function reset() {
      for (const st of stations) {
        st.theta = st.raw = st.target = st.tickAt = st.m.theta0;
        st.hint = 0;
        st.dim = 0;
        st.grabSign = 1;
      }
      for (const rx of receivers) {
        rx.awake = false;
        rx.lit = 0;
        rx.charge = 0;
        rx.wakeT = 0;
        rx.machine.reset();
      }
      S.stage = 0;
      S.complete = false;
      S.busy = false;
      S.busyT = 0;
      S.finaleT = 0;
      S.reveal = 0;
      S.sig = -1;
      S.grabbed = null;
      S.viewBackT = 0;
      S.burst = 0;
      prevHits.length = 0;
      prevSeg.length = 0;
      update(0, null);
    }
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
        if (Math.abs(aim - st.raw) > 1e-4) {
          st.raw = aim;
          changed = true;
        }
      }
      return changed;
    }
    const stateOut = { stage: 0, count: receivers.length, complete: false, busy: false };
    const hintOut = { id: "", position: new THREE.Vector3(), radius: 0.5, drag: "x" };
    reset();
    return {
      root,
      stageCount: receivers.length,
      update,
      getHandles: () => handles,
      getHint() {
        const st = S.hintSt;
        if (S.busy || S.complete || !st) return null;
        hintOut.id = st.id;
        hintOut.position.copy(st.wheelCenter);
        hintOut.drag = st.drag;
        return hintOut;
      },
      getState() {
        stateOut.stage = S.stage;
        stateOut.complete = S.complete;
        stateOut.busy = S.busy;
        return stateOut;
      },
      reset,
      debugAdvance,
      onContextRestored() {
      },
      dispose() {
        root.removeFromParent();
        root.traverse((o) => {
          if (o.isInstancedMesh) o.dispose();
        });
        for (const x of owned) x.dispose();
        owned.length = 0;
      },
      params: P,
      layout: L,
      stations
      // 調査用（シェルは使わない）
    };
    function makePetalTexture() {
      const W = 64, H = 128;
      const data = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++) {
        const v = y / (H - 1);
        for (let x = 0; x < W; x++) {
          const s = x / (W - 1) * 2 - 1;
          const k = smooth(v / 0.42);
          let r = 1, g = 0.8 + 0.2 * k, b = 0.42 + 0.58 * k;
          const fan = s / (0.3 + 0.7 * v);
          const vein = Math.pow(Math.max(0, Math.cos(fan * 7.5)), 10) * (1 - smooth((v - 0.55) / 0.45)) * 0.16;
          const edge = 0.06 * s * s;
          r = clamp01(r - vein * 0.6 + edge * 0.2);
          g = clamp01(g - vein - edge);
          b = clamp01(b - vein - edge * 0.5);
          const i = (y * W + x) * 4;
          data[i] = Math.round(r * 255);
          data[i + 1] = Math.round(g * 255);
          data[i + 2] = Math.round(b * 255);
          data[i + 3] = 255;
        }
      }
      const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
      tex.name = "petal (hero)";
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.needsUpdate = true;
      return tex;
    }
  }
  return __toCommonJS(hero_exports);
})();
(globalThis.__mtSrcHash=globalThis.__mtSrcHash||{})["MirrorTowerHero"]="0401baa019";
