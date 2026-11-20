/* 自動生成: node tools/build.mjs --hero （直接編集しない） */
var SouffleHero = (() => {
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
    createHero: () => createHero
  });

  // app/hero/util.js
  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  var lerp = (a, b, t) => a + (b - a) * t;
  var smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  var ease = (t) => {
    t = clamp(t, 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  };
  var wrapPi = (a) => {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
  };
  var fin = (x, d) => Number.isFinite(x) ? x : d || 0;
  function springTo(s, goal, w0, zeta, dt) {
    const n = Math.max(1, Math.ceil(dt * w0 / 0.25)), h = dt / n;
    for (let i = 0; i < n; i++) {
      s.v += (w0 * w0 * (goal - s.x) - 2 * zeta * w0 * s.v) * h;
      s.x += s.v * h;
    }
    if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) {
      s.x = fin(goal, 0);
      s.v = 0;
    }
  }
  function hash(i, j) {
    let h = i * 374761393 + j * 668265263 | 0;
    h = (h ^ h >>> 13) * 1274126177 | 0;
    return ((h ^ h >>> 16) >>> 0) / 4294967295;
  }
  var polarIndex = (i, j, NS) => i === 0 ? 0 : 1 + (i - 1) * NS + j;
  function polarTriangles(NR, NS) {
    const idx = [];
    for (let j = 0; j < NS; j++) {
      const j1 = (j + 1) % NS;
      idx.push(0, polarIndex(1, j1, NS), polarIndex(1, j, NS));
      for (let i = 1; i < NR; i++) {
        const a = polarIndex(i, j, NS), b = polarIndex(i + 1, j, NS), c = polarIndex(i, j1, NS), d = polarIndex(i + 1, j1, NS);
        idx.push(a, c, b, c, d, b);
      }
    }
    return idx;
  }
  function polarNormals(P2, N, NR, NS) {
    let sx = 0, sy = 0, sz = 0;
    for (let i = 1; i <= NR; i++) {
      for (let j = 0; j < NS; j++) {
        const k = polarIndex(i, j, NS) * 3;
        const kp = polarIndex(i, (j + 1) % NS, NS) * 3, km = polarIndex(i, (j + NS - 1) % NS, NS) * 3;
        const ko = (i < NR ? polarIndex(i + 1, j, NS) : polarIndex(i, j, NS)) * 3;
        const ki = polarIndex(i - 1, j, NS) * 3;
        const tx = P2[kp] - P2[km], ty = P2[kp + 1] - P2[km + 1], tz = P2[kp + 2] - P2[km + 2];
        const rx = P2[ko] - P2[ki], ry = P2[ko + 1] - P2[ki + 1], rz = P2[ko + 2] - P2[ki + 2];
        let nx = ty * rz - tz * ry, ny = tz * rx - tx * rz, nz = tx * ry - ty * rx;
        const l2 = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (l2 > 1e-12) {
          nx /= l2;
          ny /= l2;
          nz /= l2;
        } else {
          nx = 0;
          ny = 1;
          nz = 0;
        }
        N[k] = nx;
        N[k + 1] = ny;
        N[k + 2] = nz;
        if (i === 1) {
          sx += nx;
          sy += ny;
          sz += nz;
        }
      }
    }
    const l = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (l > 1e-9) {
      N[0] = sx / l;
      N[1] = sy / l;
      N[2] = sz / l;
    } else {
      N[0] = 0;
      N[1] = 1;
      N[2] = 0;
    }
  }

  // app/hero/params.js
  var STAGES = ["whisk", "pour", "load", "close", "bake", "open", "wobble", "scoop", "finale"];
  var BAKE_VIEW = { position: [0.47, 0.33, 0.68], target: [0.47, 0.135, 0] };
  var VIEW = { whisk: "mixer", pour: "pour", load: "counter", close: "oven", bake: BAKE_VIEW, open: "counter", wobble: "serve", scoop: "serve", finale: "wide" };
  var TARGET_OF = { whisk: "crank", pour: "bowl", load: "ramekin", close: "door", bake: "knob", open: "door", wobble: "souffle", scoop: "spoon" };
  var P = {
    // ---- 配置（ワールド） ----
    MIXER: [-0.34, 0, 0],
    // ボウルの底の中心（泡立て中）
    OVEN: [0.48, 0, -0.08],
    // オーブンの底の中心
    // ---- 色 ----
    col: {
      enamel: 15894431,
      // ミキサー（いちご色のほうろう）
      enamelDark: 14246013,
      cream: 16774108,
      brass: 14726234,
      steel: 14673130,
      iron: 4869976,
      oven: 8376530,
      // オーブン（ミント水色のほうろう）
      ovenIn: 3351581,
      red: 15222847,
      glow: 16762977,
      // 次に触る部品の脈動の色
      heat: 16734750,
      liquid: 16769138,
      // 泡立てる前（うすい黄色）
      foam: 16315626,
      // 泡立てた後（白）
      inside: 16770458
      // スフレの中（気泡の断面）
    },
    // ---- ミキサー（手回しの遊星ミキサー）。寸法はミキサーのローカル座標（原点＝MIXER） ----
    mixer: {
      base: { x0: -0.16, x1: 0.215, z0: -0.262, z1: 0.115, h: 0.018, r: 0.05 },
      columnW: 0.05,
      hingeY: 0.272,
      hingeZ: -0.19,
      // チルトヘッドの蝶番（X 軸）
      liftMax: 50 * DEG,
      // pour で頭を上げる角度
      shaftY: 0.3,
      // 横軸（X 軸）とクランク軸（Z 軸）の高さ
      crankX: 0.17,
      // クランク軸の x（縦軸は x=0, z=0）
      ringY: 0.203,
      ringT: 0.012
      // 固定内歯車の下面の高さと厚み
    },
    gear: {
      Z1: 40,
      m: 22e-4,
      // 冠歯車（クランクと同軸）：ピッチ半径 r1 = m·Z1/2 = 0.044
      Z2: 10,
      // ピニオン（横軸）：縦軸はクランク 1 回転で Z1/Z2 = 4 回転
      faceW: 9e-3,
      // 冠歯車の歯幅
      Zb: 16,
      mb: 2e-3,
      // かさ歯車（1:1、横軸→縦軸）
      Zr: 48,
      Zp: 12,
      // 固定内歯車と遊星歯車：自転 = 公転·(1 − Zr/Zp) = −3·公転
      Rc: 0.035
      // 公転半径（＝ (Zr−Zp)/2 × 遊星のモジュール）
    },
    crank: {
      Lc: 0.075,
      gripR: 0.014,
      gripL: 0.05,
      w0: 14,
      zeta: 0.7,
      // 指の角度を追うばね
      coastTau: 0.35,
      // 離した後の惰性の時定数
      turns: 6,
      // 泡立て完了までの回転数
      tapTurn: 0.75 * TAU,
      tapTime: 0.8,
      // タップ 1 回の自動回転
      hitR: 0.1
    },
    whisk: { Nw: 8, rw: 0.032, hw: 0.11, wire: 13e-4, tipY: 0.041, collarR: 7e-3 },
    // ---- ボウル（銅）とそり ----
    bowl: {
      Rr: 0.136,
      Rf: 0.066,
      // 内側の半径：上端・底
      depth: 0.1,
      thk: 4e-3,
      // 深さ・肉厚（外径 0.14）
      e: 1.6,
      // 壁の曲線 y = depth·((r−Rf)/(Rr−Rf))^e
      roll: 35e-4,
      // 縁の巻きの半径
      lip: 0.014,
      // 注ぎ口の出っ張り
      segs: 64,
      baseY: 0.032,
      // ボウルの底の高さ（そりの上面）
      travel: 0.1,
      // そりが +X へ出る距離（泡立て器の下 → 注ぐ位置）
      spoutYaw: 22.4 * DEG,
      // 注ぎ口の向き（+X から +Z へ）
      tiltMax: 60 * DEG,
      flowStart: 25 * DEG,
      flowFull: 55 * DEG,
      flowRate: 0.45,
      // p' = flowRate·smoothstep(25°,55°,φ)
      dragGain: 60 * DEG / 170,
      // 指の移動（px）→ 傾き
      w0: 7,
      zeta: 0.75,
      pourDist: 0.222
      // ボウル中心 → ココット中心（注ぐとき）
    },
    batter: {
      NR: 24,
      NS: 64,
      // 表面の格子（半径 × 周）
      h0: 0.03,
      h1: 0.045,
      // 高さ h(w) = h0 + h1·smoothstep(w)
      waveA: 9e-3,
      // うねりの振幅（×(1−w)×速さ）
      rep0: 1.5,
      rep1: 5.5,
      // 泡の細かさ rep(w) = rep0 + rep1·w
      uvSize: 0.3,
      // foam テクスチャ 1 枚ぶんの長さ（rep=1 のとき）
      peakH: 0.046,
      // 角の高さ ×k(w)、k = smoothstep(0.7,1,w)（仕様の 0.035 より少し高く：画面で小さかった）
      peakR: 0.03
    },
    // ---- ココット・台車・レール ----
    ramekin: { Ro: 0.052, Ri: 0.044, H: 0.054, floor: 6e-3, ribs: 24, foot: 0.046 },
    cart: {
      L: 0.118,
      W: 0.1,
      plateT: 6e-3,
      gauge: 0.112,
      wheelR: 0.012,
      wheelT: 6e-3,
      axleX: 0.036,
      railR: 2e-3,
      railTop: 7e-3,
      // カウンター上のレール上面の高さ（出発点）
      deckH: 0.02,
      // レール上面 → 台車の上面
      loadTime: 2.2,
      outTime: 2,
      serveS: 0.059
      // 取り出した後に止まる位置（レール沿いの距離）
    },
    // ---- スフレ（ココットの中の生地 → ドーム） ----
    souffle: {
      NR: 22,
      NS: 48,
      H0: 0.012,
      H1: 0.055,
      // ドームの高さ H(b) = H0 + H1·smoothstep(0.05,0.85,b)（縁から上）
      flare: 1.22,
      // 縁の上でのはみ出し（マフィン形）
      wobK: 180,
      wobC: 6,
      // ぷるぷる x'' = −k·x − c·x'
      scoopR: 0.026,
      // すくった跡（球）の半径
      insideRep: 22
    },
    // ---- オーブン（寸法はオーブンのローカル座標、原点＝OVEN） ----
    oven: {
      W: 0.44,
      H: 0.3,
      D: 0.34,
      foot: 0.012,
      r: 0.028,
      cav: { x0: -0.2, x1: 0.1, y0: 0.02, y1: 0.262, zBack: -0.15 },
      railTop: 0.035,
      // 庫内のレール上面
      zIn: 0.04,
      // 焼くときの台車の位置（オーブンローカル z）
      door: { w: 0.32, h: 0.238, t: 0.018, open: 85 * DEG, winHW: 0.115, winU0: 0.066, winU1: 0.198, arcR: 0.14, w0: 9, zeta: 0.55, bounce: 0.25 },
      knob: { x: 0.17, y: 0.15, r: 0.03, t: 0.022, grooves: 12, w0: 16, zeta: 0.8, turns: 4, clickDeg: 30, hitR: 0.085 },
      rods: 9
    },
    spoon: { Rs: 0.024, depth: 8e-3, len: 0.13 }
  };
  function derive(p) {
    const g = p.gear, b = p.bowl, o = p.oven, d = o.door;
    const D = {};
    D.r1 = g.m * g.Z1 / 2;
    D.r2 = g.m * g.Z2 / 2;
    D.rb = g.mb * g.Zb / 2;
    D.mp = g.Rc / ((g.Zr - g.Zp) / 2);
    D.rr = D.mp * g.Zr / 2;
    D.rp = D.mp * g.Zp / 2;
    D.zf = -(D.r2 + 1.25 * g.m);
    D.kH = -g.Z1 / g.Z2;
    D.kS = D.kH;
    D.kP = -g.Zr / g.Zp;
    D.bowlTop = b.thk + b.depth;
    D.pivR = b.Rr + b.thk + 4e-3;
    D.pivY = D.bowlTop - 0.012;
    D.lipR = b.Rr + b.thk + b.lip * 0.8;
    D.sx = Math.cos(b.spoutYaw);
    D.sz = Math.sin(b.spoutYaw);
    D.bowlOut = [p.MIXER[0] + b.travel, 0, p.MIXER[2]];
    D.pourAt = [D.bowlOut[0] + D.sx * b.pourDist, 0, D.bowlOut[2] + D.sz * b.pourDist];
    const rr = p.cart.railR;
    D.doorRailW = -(d.t / 2 + 2 * rr);
    D.hingeY = o.railTop + D.doorRailW * Math.sin(d.open);
    D.hingeZ = o.D / 2 + d.t / 2;
    D.cavX = (o.cav.x0 + o.cav.x1) / 2;
    D.hingeW = [p.OVEN[0] + D.cavX, D.hingeY, p.OVEN[2] + D.hingeZ];
    D.inOven = [p.OVEN[0] + D.cavX, o.railTop, p.OVEN[2] + o.zIn];
    return D;
  }

  // app/hero/kit.js
  function createKit(THREE, A, quality) {
    const owned = [];
    const own = (x) => {
      owned.push(x);
      return x;
    };
    const detail = quality && quality.detail || 1;
    const seg = (n, min) => Math.max(min || 3, Math.round(n * detail));
    const _c = new THREE.Color();
    const _m = new THREE.Matrix4();
    function ensureIndex(g) {
      if (!g.index) {
        const n = g.attributes.position.count;
        const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      return g;
    }
    function keepOnly(g, names) {
      for (const k of Object.keys(g.attributes)) if (names.indexOf(k) < 0) g.deleteAttribute(k);
      return g;
    }
    function paint(g, hex, metal, rough, emis) {
      ensureIndex(g);
      keepOnly(g, ["position", "normal"]);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3), mre = new Float32Array(n * 3);
      _c.set(hex);
      const e = emis == null ? 1 : emis;
      for (let i = 0; i < n; i++) {
        col[i * 3] = _c.r;
        col[i * 3 + 1] = _c.g;
        col[i * 3 + 2] = _c.b;
        mre[i * 3] = metal || 0;
        mre[i * 3 + 1] = rough == null ? 0.5 : rough;
        mre[i * 3 + 2] = e;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("aMRE", new THREE.BufferAttribute(mre, 3));
      return g;
    }
    function textured(g) {
      ensureIndex(g);
      return keepOnly(g, ["position", "normal", "uv"]);
    }
    function at(g, x, y, z) {
      g.translate(x || 0, y || 0, z || 0);
      return g;
    }
    function rot(g, rx, ry, rz) {
      if (rx) g.rotateX(rx);
      if (ry) g.rotateY(ry);
      if (rz) g.rotateZ(rz);
      return g;
    }
    function orient(g, xTo, zTo) {
      const X = new THREE.Vector3().fromArray(xTo).normalize(), Z = new THREE.Vector3().fromArray(zTo).normalize();
      const Y = new THREE.Vector3().crossVectors(Z, X);
      g.applyMatrix4(_m.makeBasis(X, Y, Z));
      return g;
    }
    function merge(list) {
      const g = A.mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      if (!g) throw new Error("hero: mergeGeometries failed (attribute mismatch)");
      return own(g);
    }
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const rbox = (w, h, d, r, s) => new A.RoundedBoxGeometry(w, h, d, s == null ? 2 : s, r);
    function cyl(r0, r1, h, n, axis, open) {
      const g = new THREE.CylinderGeometry(r1, r0, h, n, 1, !!open);
      if (axis === "x") g.rotateZ(-Math.PI / 2);
      else if (axis === "z") g.rotateX(Math.PI / 2);
      return g;
    }
    const sphere = (r, a, b) => new THREE.SphereGeometry(r, a, b);
    const torus = (R, r, a, b) => new THREE.TorusGeometry(R, r, a, b);
    function builder() {
      const pos = [], nrm = [], idx = [];
      const api = {
        vert(p, n) {
          pos.push(p[0], p[1], p[2]);
          nrm.push(n[0], n[1], n[2]);
          return pos.length / 3 - 1;
        },
        tri(a, b, c) {
          idx.push(a, b, c);
        },
        // 4 点（外から見て反時計回り）。center を渡すと外向きになるよう自動で裏返す。
        quad(a, b, c, d, center) {
          let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
          let vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
          if (Math.abs(ux) + Math.abs(uy) + Math.abs(uz) < 1e-12) {
            ux = c[0] - a[0];
            uy = c[1] - a[1];
            uz = c[2] - a[2];
          }
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const l = Math.hypot(nx, ny, nz) || 1;
          nx /= l;
          ny /= l;
          nz /= l;
          let flip = false;
          if (center) {
            const mx = (a[0] + b[0] + c[0] + d[0]) / 4 - center[0], my = (a[1] + b[1] + c[1] + d[1]) / 4 - center[1], mz = (a[2] + b[2] + c[2] + d[2]) / 4 - center[2];
            if (nx * mx + ny * my + nz * mz < 0) {
              flip = true;
              nx = -nx;
              ny = -ny;
              nz = -nz;
            }
          }
          const n = [nx, ny, nz];
          const i0 = api.vert(a, n), i1 = api.vert(b, n), i2 = api.vert(c, n), i3 = api.vert(d, n);
          if (flip) idx.push(i0, i2, i1, i0, i3, i2);
          else idx.push(i0, i1, i2, i0, i2, i3);
        },
        done() {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
          g.setIndex(idx);
          return g;
        }
      };
      return api;
    }
    function hexa(p, skipBottom, b) {
      const B = b || builder();
      const c = [0, 0, 0];
      for (let i = 0; i < 8; i++) {
        c[0] += p[i][0] / 8;
        c[1] += p[i][1] / 8;
        c[2] += p[i][2] / 8;
      }
      if (!skipBottom) B.quad(p[0], p[1], p[2], p[3], c);
      B.quad(p[4], p[5], p[6], p[7], c);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        B.quad(p[i], p[j], p[j + 4], p[i + 4], c);
      }
      return b ? null : B.done();
    }
    function gearOutline(Z, m, internal, phase) {
      const rp = m * Z / 2, tau = TAU / Z, pts = [];
      const rTip = internal ? rp - m : rp + m, rRoot = internal ? rp + 1.25 * m : rp - 1.25 * m;
      const ph = phase || 0;
      for (let k = 0; k < Z; k++) {
        const c = ph + k * tau;
        pts.push([rRoot * Math.cos(c - 0.3 * tau), rRoot * Math.sin(c - 0.3 * tau)]);
        pts.push([rTip * Math.cos(c - 0.13 * tau), rTip * Math.sin(c - 0.13 * tau)]);
        pts.push([rTip * Math.cos(c + 0.13 * tau), rTip * Math.sin(c + 0.13 * tau)]);
        pts.push([rRoot * Math.cos(c + 0.3 * tau), rRoot * Math.sin(c + 0.3 * tau)]);
      }
      return pts;
    }
    function prism(outline, z0, z1, s0, s1, outerR) {
      const B = builder(), n = outline.length;
      const a0 = s0 == null ? 1 : s0, a1 = s1 == null ? 1 : s1;
      const P0 = outline.map((p) => [p[0] * a0, p[1] * a0, z0]), P1 = outline.map((p) => [p[0] * a1, p[1] * a1, z1]);
      if (outerR == null) {
        for (let k = 0; k < n; k++) {
          const j = (k + 1) % n;
          B.quad(P0[k], P0[j], P1[j], P1[k]);
        }
        const c1 = B.vert([0, 0, z1], [0, 0, 1]), c0 = B.vert([0, 0, z0], [0, 0, -1]);
        const t1 = P1.map((p) => B.vert(p, [0, 0, 1])), t0 = P0.map((p) => B.vert(p, [0, 0, -1]));
        for (let k = 0; k < n; k++) {
          const j = (k + 1) % n;
          B.tri(c1, t1[k], t1[j]);
          B.tri(c0, t0[j], t0[k]);
        }
      } else {
        const O = outline.map((p) => {
          const l = Math.hypot(p[0], p[1]) || 1;
          return [p[0] / l, p[1] / l];
        });
        for (let k = 0; k < n; k++) {
          const j = (k + 1) % n;
          B.quad(P0[k], P1[k], P1[j], P0[j]);
        }
        const o0 = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z0], [d[0], d[1], 0]));
        const o1 = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z1], [d[0], d[1], 0]));
        for (let k = 0; k < n; k++) {
          const j = (k + 1) % n;
          B.tri(o0[k], o0[j], o1[j]);
          B.tri(o0[k], o1[j], o1[k]);
        }
        const ti = P1.map((p) => B.vert(p, [0, 0, 1])), to = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z1], [0, 0, 1]));
        const bi = P0.map((p) => B.vert(p, [0, 0, -1])), bo = O.map((d) => B.vert([d[0] * outerR, d[1] * outerR, z0], [0, 0, -1]));
        for (let k = 0; k < n; k++) {
          const j = (k + 1) % n;
          B.tri(ti[k], to[k], to[j]);
          B.tri(ti[k], to[j], ti[j]);
          B.tri(bi[k], bo[j], bo[k]);
          B.tri(bi[k], bi[j], bo[j]);
        }
      }
      return B.done();
    }
    function crownTeeth(Z, m, rPitch, faceW, zf, phase) {
      const B = builder(), tau = TAU / Z, ht = 2.25 * m;
      const ra = rPitch - faceW / 2, rb = rPitch + faceW / 2;
      for (let k = 0; k < Z; k++) {
        const c = (phase || 0) + k * tau, cx = Math.cos(c), cy = Math.sin(c);
        const pt = (r, w, z) => [r * cx - w * cy, r * cy + w * cx, z];
        const wb = (r) => 0.3 * tau * r, wt = (r) => 0.13 * tau * r;
        hexa([
          pt(ra, -wb(ra), zf),
          pt(rb, -wb(rb), zf),
          pt(rb, wb(rb), zf),
          pt(ra, wb(ra), zf),
          pt(ra, -wt(ra), zf + ht),
          pt(rb, -wt(rb), zf + ht),
          pt(rb, wt(rb), zf + ht),
          pt(ra, wt(ra), zf + ht)
        ], true, B);
      }
      return B.done();
    }
    function tube(pts, radius, radial, caps) {
      const n = pts.length, R = radial || 6;
      const pos = [], nrm = [], uv = [], idx = [];
      const T = new THREE.Vector3(), N = new THREE.Vector3(), Bv = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
      const rad = typeof radius === "function" ? radius : () => [radius, radius];
      for (let k = 0; k < n; k++) {
        a.fromArray(pts[Math.max(0, k - 1)]);
        b.fromArray(pts[Math.min(n - 1, k + 1)]);
        T.subVectors(b, a);
        if (T.lengthSq() < 1e-16) T.set(0, 1, 0);
        T.normalize();
        if (k === 0) {
          N.set(0, 1, 0);
          if (Math.abs(T.y) > 0.9) N.set(1, 0, 0);
        }
        N.addScaledVector(T, -N.dot(T));
        if (N.lengthSq() < 1e-12) N.set(T.z, T.x, T.y).addScaledVector(T, -N.dot(T));
        N.normalize();
        Bv.crossVectors(T, N);
        const r = rad(n > 1 ? k / (n - 1) : 0), p = pts[k];
        for (let j = 0; j < R; j++) {
          const ang = j / R * TAU, c = Math.cos(ang), s = Math.sin(ang);
          pos.push(p[0] + N.x * c * r[0] + Bv.x * s * r[1], p[1] + N.y * c * r[0] + Bv.y * s * r[1], p[2] + N.z * c * r[0] + Bv.z * s * r[1]);
          nrm.push(N.x * c + Bv.x * s, N.y * c + Bv.y * s, N.z * c + Bv.z * s);
          uv.push(Math.abs(2 * j / R - 1), k / Math.max(1, n - 1));
        }
        if (caps && (k === 0 || k === n - 1)) {
          const ring0 = pos.length / 3 - R;
          const sgn = k === 0 ? -1 : 1, base = pos.length / 3;
          pos.push(p[0], p[1], p[2]);
          nrm.push(T.x * sgn, T.y * sgn, T.z * sgn);
          uv.push(0.5, k ? 1 : 0);
          for (let j = 0; j < R; j++) {
            const q = (ring0 + j) * 3;
            pos.push(pos[q], pos[q + 1], pos[q + 2]);
            nrm.push(T.x * sgn, T.y * sgn, T.z * sgn);
            uv.push(0.5, k ? 1 : 0);
          }
          for (let j = 0; j < R; j++) {
            const j1 = (j + 1) % R;
            if (k === 0) idx.push(base, base + 1 + j1, base + 1 + j);
            else idx.push(base, base + 1 + j, base + 1 + j1);
          }
        }
      }
      const ringStart = [];
      {
        let o = 0;
        for (let k = 0; k < n; k++) {
          ringStart.push(o);
          o += R;
          if (caps && (k === 0 || k === n - 1)) o += R + 1;
        }
      }
      for (let k = 0; k < n - 1; k++) for (let j = 0; j < R; j++) {
        const j1 = (j + 1) % R, p0 = ringStart[k] + j, p1 = ringStart[k] + j1, q0 = ringStart[k + 1] + j, q1 = ringStart[k + 1] + j1;
        idx.push(p0, p1, q0, p1, q1, q0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    }
    function lathe(profile, segs, opt) {
      const o = opt || {}, K = profile.length, S = segs;
      const pos = new Float32Array(K * (S + 1) * 3), uv = new Float32Array(K * (S + 1) * 2), idx = [];
      const arc = [0];
      for (let k = 1; k < K; k++) arc.push(arc[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
      const out = { r: 0, y: 0 };
      const uRep = o.uRep || 1, vLen = o.vLen || (arc[K - 1] || 1);
      for (let k = 0; k < K; k++) for (let j = 0; j <= S; j++) {
        const th = j % S / S * TAU;
        out.r = profile[k][0];
        out.y = profile[k][1];
        if (o.fn) o.fn(profile[k], th, out, k);
        const i = k * (S + 1) + j;
        pos[i * 3] = out.r * Math.cos(th);
        pos[i * 3 + 1] = out.y;
        pos[i * 3 + 2] = out.r * Math.sin(th);
        const u = j / S * uRep, v = arc[k] / vLen;
        if (o.swapUV) {
          uv[i * 2] = v;
          uv[i * 2 + 1] = u;
        } else {
          uv[i * 2] = u;
          uv[i * 2 + 1] = v;
        }
      }
      for (let k = 0; k < K - 1; k++) for (let j = 0; j < S; j++) {
        const a = k * (S + 1) + j, b = (k + 1) * (S + 1) + j, c = a + 1, d = b + 1;
        idx.push(a, b, c, c, b, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const N = g.attributes.normal.array;
      for (let k = 0; k < K; k++) {
        const a = k * (S + 1) * 3, b = (k * (S + 1) + S) * 3;
        let nx = N[a] + N[b], ny = N[a + 1] + N[b + 1], nz = N[a + 2] + N[b + 2];
        if (profile[k][0] < 1e-7) {
          nx = 0;
          nz = 0;
          ny = 0;
          for (let j = 0; j <= S; j++) ny += N[(k * (S + 1) + j) * 3 + 1];
          ny = ny >= 0 ? 1 : -1;
          for (let j = 0; j <= S; j++) {
            const q = (k * (S + 1) + j) * 3;
            N[q] = 0;
            N[q + 1] = ny;
            N[q + 2] = 0;
          }
          continue;
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        N[a] = N[b] = nx / l;
        N[a + 1] = N[b + 1] = ny / l;
        N[a + 2] = N[b + 2] = nz / l;
      }
      return g;
    }
    function rrPath(Cls, x0, y0, x1, y1, r) {
      const s = new Cls(), h = Math.PI / 2;
      s.moveTo(x0 + r, y0);
      s.lineTo(x1 - r, y0);
      s.absarc(x1 - r, y0 + r, r, -h, 0, false);
      s.lineTo(x1, y1 - r);
      s.absarc(x1 - r, y1 - r, r, 0, h, false);
      s.lineTo(x0 + r, y1);
      s.absarc(x0 + r, y1 - r, r, h, 2 * h, false);
      s.lineTo(x0, y0 + r);
      s.absarc(x0 + r, y0 + r, r, 2 * h, 3 * h, false);
      return s;
    }
    function extrude(shape, depth, bevel, curveSegs, bevelSegs) {
      const bv = bevel || 0;
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(1e-5, depth - 2 * bv),
        bevelEnabled: bv > 0,
        bevelThickness: bv,
        bevelSize: bv,
        bevelOffset: -bv,
        bevelSegments: bevelSegs || seg(3, 1),
        curveSegments: curveSegs || seg(6, 2),
        steps: 1
      });
      g.translate(0, 0, bv);
      return g;
    }
    return { THREE, A, own, owned, detail, seg, paint, textured, ensureIndex, at, rot, orient, merge, box, rbox, cyl, sphere, torus, builder, hexa, gearOutline, prism, crownTeeth, tube, lathe, rrPath, extrude };
  }

  // app/hero/materials.js
  function createMaterials(THREE, opts, own, P2) {
    const T = opts.textures;
    const foamTex = T.get("whipped_foam");
    const copperTex = T.get("hammered_copper");
    const ceramicTex = T.get("ceramic_glaze");
    function hard(extra) {
      const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, metalness: 1, roughness: 1 }, extra || {}));
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 aMRE;\nvarying vec3 vMRE;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvMRE = aMRE;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vMRE;").replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = clamp( roughnessFactor * vMRE.y, 0.05, 1.0 );").replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = clamp( metalnessFactor * vMRE.x, 0.0, 1.0 );").replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vMRE.z;");
      };
      m.customProgramCacheKey = () => "souffle-hard";
      return own(m);
    }
    function food(kind, U) {
      const m = new THREE.MeshStandardMaterial({ map: foamTex, bumpMap: foamTex, bumpScale: 0, color: 16777215, roughness: 0.5, metalness: 0 });
      const souffle2 = kind === "souffle";
      if (souffle2) m.defines = Object.assign({}, m.defines, { SOUFFLE: "" });
      m.userData.U = U;
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace("#include <common>", [
          "#include <common>",
          "uniform float uRep;",
          "#ifdef SOUFFLE",
          "attribute float aTop;",
          "varying float vTop;",
          "varying vec3 vObj;",
          "varying vec2 vCrustUv;",
          "uniform vec2 uBake;",
          "#endif"
        ].join("\n")).replace("#include <uv_vertex>", [
          "#include <uv_vertex>",
          "#ifdef USE_MAP",
          "  vMapUv = vMapUv * uRep;",
          "#endif",
          "#ifdef USE_BUMPMAP",
          "  vBumpMapUv = vMapUv;",
          "#endif",
          "#ifdef SOUFFLE",
          "  vTop = aTop; vObj = position; vCrustUv = uv;",
          "  #ifdef USE_BUMPMAP",
          "    vBumpMapUv = mix( vMapUv, vCrustUv, uBake.y );",
          "  #endif",
          "#endif"
        ].join("\n"));
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", [
          "#include <common>",
          "uniform vec2 uFoam;",
          // x = 泡の模様の濃さ（0=なめらかな液体）、y = 明るさ
          "#ifdef SOUFFLE",
          "uniform sampler2D uCrust;",
          "uniform vec2 uBake;",
          // x = 焼き色の進み、y = バンプを crust に切り替え
          "uniform vec3 uCrustTint;",
          "uniform vec4 uScoop;",
          // xyz = すくった跡の球の中心（ローカル）、w = 半径（0 で無効）
          "uniform vec3 uInside;",
          // x = 断面の模様の繰り返し、y = 断面の濃さ（0..1）
          "uniform vec3 uInsideTint;",
          "varying float vTop;",
          "varying vec3 vObj;",
          "varying vec2 vCrustUv;",
          "#endif"
        ].join("\n")).replace("#include <map_fragment>", [
          "#ifdef USE_MAP",
          "  vec3 fTex = texture2D( map, vMapUv ).rgb;",
          "  vec3 fCol = diffuseColor.rgb * mix( vec3( 1.0 ), clamp( fTex * uFoam.y, 0.0, 1.0 ), uFoam.x );",
          "  #ifdef SOUFFLE",
          "    vec3 cTex = texture2D( uCrust, vCrustUv ).rgb;",
          "    float cLum = dot( cTex, vec3( 0.3333 ) );",
          "    float bm = uBake.x * ( 0.30 + 0.95 * vTop ) + ( cLum - 0.5 ) * 0.4 * uBake.x;",
          "    bm = smoothstep( 0.12, 0.80, clamp( bm, 0.0, 1.0 ) );",
          "    fCol = mix( fCol, cTex * uCrustTint, bm );",
          "    float ins = ( 1.0 - smoothstep( uScoop.w * 1.02, uScoop.w * 1.10 + 1e-5, distance( vObj, uScoop.xyz ) ) ) * uInside.y;",
          "    vec3 iTex = texture2D( map, vObj.xz * uInside.x + vObj.y * vec2( 0.61, 0.37 ) * uInside.x ).rgb;",
          "    fCol = mix( fCol, iTex * uInsideTint, ins );",
          "  #endif",
          "  diffuseColor.rgb = fCol;",
          "#endif"
        ].join("\n"));
      };
      m.customProgramCacheKey = () => "souffle-food-" + kind;
      return own(m);
    }
    const col = P2.col;
    const batterU = { uRep: { value: P2.batter.rep0 }, uFoam: { value: new THREE.Vector2(0, 1) } };
    const batter = food("batter", batterU);
    batter.vertexColors = true;
    const souffleU = {
      uRep: { value: (P2.batter.rep0 + P2.batter.rep1) * (2 * P2.ramekin.Ri / P2.batter.uvSize) },
      uFoam: { value: new THREE.Vector2(1, 1) },
      uCrust: { value: foamTex },
      // golden_crust は pour 段階で読み込んでから差し替える
      uBake: { value: new THREE.Vector2(0, 0) },
      uCrustTint: { value: new THREE.Color(1.08, 1, 0.92) },
      uScoop: { value: new THREE.Vector4(0, 0, 0, 0) },
      uInside: { value: new THREE.Vector3(P2.souffle.insideRep, 0, 0) },
      uInsideTint: { value: new THREE.Color(col.inside) }
    };
    const souffle = food("souffle", souffleU);
    const scoopU = { uRep: { value: 2.6 }, uFoam: { value: new THREE.Vector2(1, 1.04) } };
    const scoop = food("batter", scoopU);
    scoop.color.set(col.inside);
    scoop.roughness = 0.9;
    scoop.bumpScale = 0.6;
    const copper = own(new THREE.MeshStandardMaterial({ map: copperTex, bumpMap: copperTex, bumpScale: 0.9, color: 16777215, metalness: 1, roughness: 0.24 }));
    const ceramic = own(new THREE.MeshStandardMaterial({ map: ceramicTex, color: 16777215, metalness: 0, roughness: 0.16 }));
    const wood = () => own(new THREE.MeshStandardMaterial({ map: opts.shared.wood, color: 16771535, metalness: 0, roughness: 0.55 }));
    const glass = own(new THREE.MeshStandardMaterial({ color: 4862498, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.16, depthWrite: false, emissive: col.heat, emissiveIntensity: 0 }));
    const blob = own(new THREE.MeshBasicMaterial({ map: opts.shared.blob, color: 3810320, transparent: true, opacity: 0.42, depthWrite: false }));
    const hit = own(new THREE.MeshBasicMaterial({ color: 16711935, wireframe: true }));
    return {
      foamTex,
      copperTex,
      ceramicTex,
      hard,
      wood,
      batter,
      batterU,
      souffle,
      souffleU,
      scoop,
      scoopU,
      copper,
      ceramic,
      glass,
      blob,
      hit,
      setCrust(tex) {
        souffleU.uCrust.value = tex;
        souffle.crustMap = tex;
      }
      // crustMap は数え上げ用（debug のテクスチャ集計に載せる）
    };
  }

  // app/hero/mixer.js
  function buildMixer(ctx) {
    const { THREE, K, M, P: P2, D } = ctx;
    const mx = P2.mixer, g = P2.gear, c = P2.col, wk = P2.whisk, ck = P2.crank;
    const EN = [c.enamel, 0, 0.3], END = [c.enamelDark, 0, 0.34], CR = [c.cream, 0, 0.36], BR = [c.brass, 1, 0.3], ST = [c.steel, 1, 0.2];
    const pt = (geo, m) => K.paint(geo, m[0], m[1], m[2]);
    const HX4 = Math.PI / 2;
    const group = new THREE.Group();
    group.name = "mixer";
    group.position.fromArray(P2.MIXER);
    const st = [];
    {
      const b = mx.base;
      const geo = K.extrude(K.rrPath(THREE.Shape, b.x0, -b.z1, b.x1, -b.z0, b.r), b.h, 4e-3, K.seg(8, 3));
      geo.rotateX(-HX4);
      st.push(pt(geo, EN));
      const s = new THREE.Shape();
      s.moveTo(-0.118, 0.014);
      s.quadraticCurveTo(-0.152, 0.05, -0.16, 0.15);
      s.lineTo(-0.164, 0.262);
      s.lineTo(-0.216, 0.262);
      s.quadraticCurveTo(-0.222, 0.12, -0.252, 0.014);
      s.closePath();
      const col = K.extrude(s, mx.columnW, 7e-3, K.seg(8, 3));
      col.rotateY(-HX4);
      col.translate(mx.columnW / 2, 0, 0);
      st.push(pt(col, EN));
      for (const sx of [-1, 1]) {
        st.push(pt(K.at(K.cyl(0.026, 0.026, 0.012, K.seg(20, 8), "x"), sx * (mx.columnW / 2 - 6e-3), mx.hingeY, mx.hingeZ), END));
        st.push(pt(K.at(K.cyl(6e-3, 6e-3, 4e-3, 10, "x"), sx * (mx.columnW / 2 + 2e-3), mx.hingeY, mx.hingeZ), BR));
      }
      for (const sz of [-1, 1]) {
        st.push(pt(K.at(K.cyl(3e-3, 3e-3, 0.27, 8, "x"), 0.06, b.h + 35e-4, sz * 0.04), ST));
        for (const ex of [-0.078, 0.198]) st.push(pt(K.at(K.rbox(8e-3, 0.01, 0.014, 2e-3, 1), ex, b.h + 4e-3, sz * 0.04), BR));
      }
    }
    const staticMesh = new THREE.Mesh(K.merge(st), M.hard());
    group.add(staticMesh);
    const head = new THREE.Group();
    head.position.set(0, mx.hingeY, mx.hingeZ);
    group.add(head);
    const body = new THREE.Group();
    body.position.set(0, -mx.hingeY, -mx.hingeZ);
    head.add(body);
    const hd = [];
    {
      const s = new THREE.Shape();
      s.moveTo(-0.207, 0.262);
      s.quadraticCurveTo(-0.204, 0.318, -0.13, 0.334);
      s.lineTo(-0.05, 0.346);
      s.quadraticCurveTo(-0.03, 0.348, -0.03, 0.328);
      s.lineTo(-0.03, 0.27);
      s.quadraticCurveTo(-0.03, 0.258, -0.046, 0.258);
      s.quadraticCurveTo(-0.12, 0.264, -0.176, 0.25);
      s.closePath();
      const arm = K.extrude(s, 0.044, 7e-3, K.seg(8, 3));
      arm.rotateY(-HX4);
      arm.translate(0.022, 0, 0);
      hd.push(pt(arm, EN));
      hd.push(pt(K.at(K.cyl(0.0265, 0.0265, mx.columnW - 0.026, K.seg(20, 8), "x"), 0, mx.hingeY, mx.hingeZ), EN));
      hd.push(pt(K.at(K.rbox(0.29, 0.094, 0.012, 5e-3, 2), 0.078, mx.shaftY, -0.036), EN));
      for (const x of [0.048, 0.098]) hd.push(pt(K.at(K.rbox(0.012, 0.026, 0.04, 3e-3, 1), x, mx.shaftY, -0.012), CR));
      hd.push(pt(K.at(K.rbox(0.026, 0.012, 0.04, 3e-3, 1), 0, mx.shaftY - 0.042, -0.012), CR));
      hd.push(pt(K.at(K.cyl(0.013, 0.013, D.zf - 65e-4 + 0.03, K.seg(14, 8), "z"), mx.crankX, mx.shaftY, (-0.03 + D.zf - 65e-4) / 2), CR));
      hd.push(pt(K.at(K.rbox(0.03, 0.062, 0.02, 4e-3, 1), 0, mx.ringY + 0.031, -(D.rr + 1.25 * D.mp + 6e-3) - 6e-3), EN));
      hd.push(pt(K.at(K.rbox(0.03, 0.016, 0.046, 4e-3, 1), 0, mx.shaftY - 0.044, -0.05), EN));
      const ring = K.prism(K.gearOutline(g.Zr, D.mp, true, TAU / g.Zr / 2), 0, mx.ringT, 1, 1, D.rr + 1.25 * D.mp + 6e-3);
      ring.rotateX(-HX4);
      ring.translate(0, mx.ringY, 0);
      hd.push(pt(ring, BR));
    }
    const headMesh = new THREE.Mesh(K.merge(hd), M.hard());
    body.add(headMesh);
    const crank = new THREE.Group();
    crank.position.set(mx.crankX, mx.shaftY, 0);
    body.add(crank);
    const crankSpin = new THREE.Group();
    crank.add(crankSpin);
    const zf = D.zf, zb = zf - 6e-3, zh = zf + 0.031, Rw = D.r1 + g.faceW / 2 + 25e-4;
    const cr = [];
    {
      const prof = [
        [0, zb],
        [Rw - 1e-3, zb],
        [Rw, zb + 1e-3],
        [Rw, zf - 5e-4],
        [Rw - 12e-4, zf],
        [D.r1 - g.faceW / 2 - 2e-3, zf],
        [D.r1 - g.faceW / 2 - 4e-3, zf - 2e-3],
        [0.018, zf - 2e-3],
        [0.0135, zf + 3e-3],
        [0.011, zf + 5e-3],
        [0.011, zh],
        [0, zh]
      ];
      const wheel = K.lathe(prof, K.seg(40, 16));
      wheel.rotateX(HX4);
      cr.push(pt(wheel, BR));
      cr.push(pt(K.crownTeeth(g.Z1, g.m, D.r1, g.faceW, zf, 0), BR));
      const s = new THREE.Shape();
      s.moveTo(0, -0.012);
      s.lineTo(ck.Lc, -85e-4);
      s.absarc(ck.Lc, 0, 85e-4, -HX4, HX4, false);
      s.lineTo(0, 0.012);
      s.absarc(0, 0, 0.012, HX4, 3 * HX4, false);
      cr.push(pt(K.at(K.extrude(s, 6e-3, 15e-4, K.seg(8, 3), 1), 0, 0, zh), ST));
      cr.push(pt(K.at(K.cyl(35e-4, 35e-4, ck.gripL + 6e-3, 8, "z"), ck.Lc, 0, zh + 6e-3 + (ck.gripL + 6e-3) / 2), ST));
      cr.push(pt(K.at(K.cyl(8e-3, 7e-3, 3e-3, 12, "z"), ck.Lc, 0, zh + 0.0135 + ck.gripL), BR));
      cr.push(pt(K.at(K.cyl(6e-3, 5e-3, 4e-3, 12, "z"), 0, 0, zh + 8e-3), BR));
    }
    const crankMat = M.hard();
    crankSpin.add(new THREE.Mesh(K.merge(cr), crankMat));
    const gripMat = M.wood();
    {
      const L = ck.gripL, r = ck.gripR, prof = [[0, 0], [r * 0.7, 0], [r * 0.88, 3e-3]];
      const n = K.seg(6, 3);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        prof.push([r * (0.88 + 0.12 * Math.sin(Math.PI * t)), 3e-3 + (L - 6e-3) * t]);
      }
      prof.push([r * 0.88, L - 3e-3], [r * 0.7, L], [0, L]);
      const grip = K.textured(K.lathe(prof, K.seg(16, 8), { swapUV: true, uRep: 0.5, vLen: 0.16 }));
      grip.rotateX(HX4);
      grip.translate(ck.Lc, 0, zh + 75e-4);
      crankSpin.add(new THREE.Mesh(K.own(grip), gripMat));
    }
    const hshaft = new THREE.Group();
    hshaft.position.set(0, mx.shaftY, 0);
    body.add(hshaft);
    const hB = 6e-3, sB = (D.rb - hB) / D.rb;
    {
      const hs = [];
      const bev = K.prism(K.gearOutline(g.Zb, g.mb, false, 0), 0, hB, 1, sB);
      K.orient(bev, [0, -1, 0], [-1, 0, 0]);
      bev.translate(D.rb, 0, 0);
      hs.push(pt(bev, BR));
      hs.push(pt(K.at(K.cyl(9e-3, 9e-3, 5e-3, 12, "x"), D.rb + 25e-4, 0, 0), BR));
      const x1 = mx.crankX - D.r1 + 9e-3;
      hs.push(pt(K.at(K.cyl(35e-4, 35e-4, x1 - D.rb, 8, "x"), (x1 + D.rb) / 2, 0, 0), ST));
      const pin = K.prism(K.gearOutline(g.Z2, g.m, false, TAU / g.Z2 / 2), -6e-3, 6e-3);
      K.orient(pin, [0, 0, -1], [1, 0, 0]);
      pin.translate(mx.crankX - D.r1, 0, 0);
      hs.push(pt(pin, BR));
      for (const x of [0.037, 0.109]) hs.push(pt(K.at(K.cyl(6e-3, 6e-3, 4e-3, 10, "x"), x, 0, 0), ST));
      hshaft.add(new THREE.Mesh(K.merge(hs), M.hard()));
    }
    const vshaft = new THREE.Group();
    body.add(vshaft);
    const carrierY = mx.ringY + mx.ringT + 55e-4;
    {
      const vs = [];
      const bev = K.prism(K.gearOutline(g.Zb, g.mb, false, TAU / g.Zb / 2), 0, hB, 1, sB);
      bev.rotateX(-HX4);
      bev.translate(0, mx.shaftY - D.rb, 0);
      vs.push(pt(bev, BR));
      vs.push(pt(K.at(K.cyl(9e-3, 9e-3, 5e-3, 12, "y"), 0, mx.shaftY - D.rb - 25e-4, 0), BR));
      const y0 = carrierY, y1 = mx.shaftY - D.rb;
      vs.push(pt(K.at(K.cyl(38e-4, 38e-4, y1 - y0, 8, "y"), 0, (y0 + y1) / 2, 0), ST));
      vs.push(pt(K.at(K.cyl(0.01, 0.01, 0.01, 14, "y"), 0, carrierY, 0), BR));
      vs.push(pt(K.at(K.rbox(g.Rc + 0.03, 6e-3, 0.013, 2e-3, 1), (g.Rc + 0.012 - 0.018) / 2, carrierY, 0), BR));
      vs.push(pt(K.at(K.cyl(9e-3, 9e-3, 9e-3, 12, "y"), -0.02, carrierY, 0), BR));
      vs.push(pt(K.at(K.cyl(45e-4, 45e-4, 4e-3, 10, "y"), g.Rc, carrierY + 5e-3, 0), ST));
      vshaft.add(new THREE.Mesh(K.merge(vs), M.hard()));
    }
    const pivotY = mx.ringY + mx.ringT / 2;
    const planetPos = new THREE.Group();
    planetPos.position.set(g.Rc, pivotY, 0);
    vshaft.add(planetPos);
    const flex = new THREE.Group();
    planetPos.add(flex);
    const spin = new THREE.Group();
    flex.add(spin);
    const yTop = wk.tipY + wk.hw;
    {
      const pl = [];
      const gear = K.prism(K.gearOutline(g.Zp, D.mp, false, 0), 0, mx.ringT - 2e-3);
      gear.rotateX(-HX4);
      gear.translate(0, mx.ringY + 1e-3, 0);
      pl.push(pt(gear, BR));
      pl.push(pt(K.at(K.cyl(3e-3, 3e-3, 0.012, 8, "y"), 0, mx.ringY + mx.ringT + 4e-3, 0), ST));
      pl.push(pt(K.at(K.cyl(35e-4, 35e-4, mx.ringY - yTop + 2e-3, 8, "y"), 0, (mx.ringY + yTop) / 2, 0), ST));
      pl.push(pt(K.at(K.cyl(wk.collarR, 5e-3, 0.014, 12, "y"), 0, yTop - 4e-3, 0), ST));
      const n = K.seg(18, 8), pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const y = wk.tipY + wk.hw * (1 - (0.5 * t + 0.5 * Math.sin(HX4 * t)));
        const r = wk.collarR * 0.8 * (1 - t) * (1 - t) + wk.rw * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.35))), 0.9);
        pts.push([r, y, 0]);
      }
      for (let k = 0; k < wk.Nw; k++) {
        const w = K.tube(pts, wk.wire, K.seg(5, 4), false);
        w.rotateY(k * TAU / wk.Nw);
        pl.push(pt(w, ST));
      }
      const geo = K.merge(pl);
      geo.translate(0, -pivotY, 0);
      spin.add(new THREE.Mesh(geo, M.hard()));
    }
    const bellyY = wk.tipY + 0.034;
    const clump = new THREE.Group();
    clump.position.set(0, bellyY - pivotY, 0);
    spin.add(clump);
    {
      const n = K.seg(10, 5), prof = [[0, wk.tipY - 0.012], [4e-3, wk.tipY - 4e-3]];
      for (let i = 1; i < n; i++) {
        const s = i / n;
        prof.push([0.024 * Math.pow(Math.sin(Math.PI * s), 0.7) * (1 - 0.3 * s), wk.tipY + 2e-3 + s * 0.064]);
      }
      prof.push([0, wk.tipY + 0.066]);
      const geo = K.textured(K.lathe(prof, K.seg(14, 8), { uRep: 0.5, vLen: 0.3 }));
      geo.translate(0, -bellyY, 0);
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(0.94), 3));
      clump.add(new THREE.Mesh(K.own(geo), M.batter));
    }
    clump.visible = false;
    const crankHit = new THREE.Mesh(K.own(K.cyl(ck.hitR, ck.hitR, 0.12, 14, "z")), M.hit);
    crankHit.visible = false;
    crankHit.position.set(0, 0, 0.03);
    crank.add(crankHit);
    return {
      group,
      head,
      body,
      crank,
      crankSpin,
      hshaft,
      vshaft,
      planetPos,
      flex,
      spin,
      clump,
      crankHit,
      glow: [crankMat, gripMat],
      pivotY,
      whiskTipLocalY: wk.tipY - pivotY
    };
  }

  // app/hero/bowl.js
  function buildBowl(ctx, mixerGroup) {
    const { THREE, K, M, P: P2, D } = ctx;
    const b = P2.bowl, c = P2.col, top = D.bowlTop;
    const pt = (geo, m) => K.paint(geo, m[0], m[1], m[2]);
    const CR = [c.cream, 0, 0.36], END = [c.enamelDark, 0, 0.34], ST = [c.steel, 1, 0.2], BR = [c.brass, 1, 0.3];
    const sled = new THREE.Group();
    sled.name = "sled";
    mixerGroup.add(sled);
    {
      const sl = [];
      sl.push(pt(K.at(K.cyl(0.078, 0.078, 8e-3, K.seg(28, 12), "y"), 0, b.baseY - 4e-3, 0), CR));
      for (const sz of [-1, 1]) sl.push(pt(K.at(K.rbox(0.1, 8e-3, 0.018, 3e-3, 1), 0, b.baseY - 0.0105, sz * 0.04), END));
      const yk = [];
      for (const sz of [-1, 1]) {
        yk.push(pt(K.at(K.rbox(0.105, 6e-3, 0.01, 2e-3, 1), 0.106, b.baseY - 3e-3, sz * 0.028), END));
        const h = D.pivY + 8e-3;
        yk.push(pt(K.at(K.cyl(45e-4, 4e-3, h, 8, "y"), D.pivR + 4e-3, b.baseY + h / 2 - 2e-3, sz * 0.028), END));
        yk.push(pt(K.at(K.sphere(55e-4, 8, 6), D.pivR + 4e-3, b.baseY + D.pivY, sz * 0.028), BR));
      }
      yk.push(pt(K.at(K.cyl(28e-4, 28e-4, 0.06, 8, "z"), D.pivR, b.baseY + D.pivY, 0), ST));
      yk.forEach((g) => {
        g.rotateY(-b.spoutYaw);
        sl.push(g);
      });
      sled.add(new THREE.Mesh(K.merge(sl), M.hard()));
    }
    const yaw = new THREE.Group();
    yaw.position.set(0, b.baseY, 0);
    yaw.rotation.y = -b.spoutYaw;
    sled.add(yaw);
    const tilt = new THREE.Group();
    tilt.position.set(D.pivR, D.pivY, 0);
    yaw.add(tilt);
    const bowl = new THREE.Group();
    bowl.position.set(-D.pivR, -D.pivY, 0);
    tilt.add(bowl);
    const rinAt = (y) => b.Rf + (b.Rr - b.Rf) * Math.pow(clamp((y - b.thk) / b.depth, 0, 1), 1 / b.e);
    const yin = (r) => r <= b.Rf ? b.thk : b.thk + b.depth * Math.pow(Math.min(1, (r - b.Rf) / (b.Rr - b.Rf)), b.e);
    {
      const prof = [[0, 0], [b.Rf * 0.6, 0], [b.Rf + b.thk - 7e-3, 0], [b.Rf + b.thk - 2e-3, 12e-4]];
      const no = K.seg(9, 5), ni = K.seg(11, 6), ro = b.Rr + b.thk, k = b.roll;
      for (let i = 1; i < no; i++) {
        const q = Math.pow(i / no, 1.6);
        prof.push([b.Rf + b.thk + (b.Rr - b.Rf) * Math.pow(q, 1 / b.e), top * q]);
      }
      prof.push([ro + k * 0.2, top - k * 1.2], [ro + k * 0.75, top - k * 0.3], [ro + k * 0.55, top + k * 0.65], [(ro + b.Rr) / 2, top + k], [b.Rr - k * 0.35, top + k * 0.45], [b.Rr, top - k * 0.6]);
      for (let i = ni - 1; i >= 0; i--) {
        const q = Math.pow(i / ni, 1.6);
        prof.push([b.Rf + (b.Rr - b.Rf) * Math.pow(q, 1 / b.e), b.thk + b.depth * q]);
      }
      prof.push([b.Rf * 0.5, b.thk], [0, b.thk]);
      const fn = (p, th, out) => {
        const a = wrapPi(th), wt = Math.exp(-(a / 0.3) * (a / 0.3)), wy = smooth(top - 0.035, top, p[1]);
        out.r += b.lip * wt * wy;
        out.y -= 3e-3 * wt * wy;
      };
      const parts = [K.textured(K.lathe(prof, K.seg(b.segs, 28), { fn, uRep: 6, vLen: 0.13 }))];
      const rH = rinAt(top - 0.03) + b.thk;
      for (const sz of [-1, 1]) {
        parts.push(K.textured(K.at(K.rot(K.torus(0.019, 42e-4, K.seg(8, 5), K.seg(20, 10)), sz * 0.25, 0, 0), 0, top - 0.04, sz * (rH + 6e-3))));
        parts.push(K.textured(K.at(K.cyl(6e-3, 6e-3, 0.011, 8, "z"), 0, top - 0.022, sz * (rH + 85e-4))));
      }
      parts.push(K.textured(K.at(K.cyl(58e-4, 58e-4, 0.03, 10, "z"), D.pivR, D.pivY, 0)));
      parts.push(K.textured(K.at(K.box(0.012, 0.012, 0.026), D.pivR - 5e-3, D.pivY + 4e-3, 0)));
      bowl.add(new THREE.Mesh(K.merge(parts), M.copper));
    }
    const hit = new THREE.Mesh(K.own(K.box(0.38, 0.24, 0.34)), M.hit);
    hit.visible = false;
    hit.position.set(0.015, b.baseY + 0.085, 0);
    sled.add(hit);
    const pivot = new THREE.Object3D();
    pivot.position.set(0, b.baseY + top, 0);
    sled.add(pivot);
    const bt = P2.batter;
    const NR = K.seg(bt.NR, 12), NS = K.seg(bt.NS, 28), NV = 1 + NR * NS;
    const pos = new Float32Array(NV * 3), nrm = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), col = new Float32Array(NV * 3).fill(1);
    const sgeo = K.own(new THREE.BufferGeometry());
    sgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    sgeo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
    sgeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
    sgeo.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    sgeo.setIndex(polarTriangles(NR, NS));
    sgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.06, 0), 0.22);
    const surface = new THREE.Mesh(sgeo, M.batter);
    bowl.add(surface);
    const cosT = new Float32Array(NS), sinT = new Float32Array(NS), rb = new Float32Array(NS);
    for (let j = 0; j < NS; j++) {
      cosT[j] = Math.cos(j / NS * TAU);
      sinT[j] = Math.sin(j / NS * TAU);
      rb[j] = b.Rf;
    }
    const ho = new Float32Array((NR + 1) * NS);
    const lump = new Float32Array((NR + 1) * NS);
    for (let i = 1; i <= NR; i++) for (let j = 0; j < NS; j++) {
      const rho = i / NR, th = j / NS * TAU, x = rho * Math.cos(th), z = rho * Math.sin(th);
      lump[i * NS + j] = 0.5 * Math.sin(x * 9.1 + 1.3) * Math.cos(z * 7.7 - 0.4) + 0.3 * Math.sin((x + z) * 13.3 + 2.1) + 0.2 * Math.sin(x * 19 - z * 17 + hash(3, 7) * 6);
    }
    const yMax = top - 5e-3;
    const ringOff = new Float32Array(NR + 1);
    const sim = { theta: 0, phase: 0, scroll: 0, peakI: 1, peakJ: 0 };
    const PEAKS = [[0, 0, 1], [5, 9, 0.5], [-4, -13, 0.42], [7, -6, 0.36], [3, 21, 0.3]];
    const pkX = new Float32Array(PEAKS.length), pkZ = new Float32Array(PEAKS.length);
    function resetSurface() {
      ho.fill(0);
      ringOff.fill(0);
      sim.theta = 0;
      sim.phase = 0;
      sim.scroll = 0;
    }
    function setPeakAt(x, z) {
      const r = Math.hypot(x, z), th = Math.atan2(z, x);
      sim.peakJ = (Math.round(th / TAU * NS) % NS + NS) % NS;
      sim.peakI = clamp(Math.round(r / Math.max(1e-4, rb[sim.peakJ]) * NR), 1, NR - 2);
    }
    function updateSurface(dt, s) {
      const w = s.w, hNow = (bt.h0 + bt.h1 * smooth(0, 1, w)) * (1 - s.p);
      surface.visible = hNow > 15e-4;
      if (!surface.visible) return;
      const cL = b.thk + hNow;
      if (s.stir > 1e-3) {
        const amp = lerp(4e-3, 0.012, w), rate = Math.min(1, 9 * dt * s.stir), rm = rb[0] / NR;
        for (let i = 1; i <= NR; i++) {
          const co = Math.cos(ringOff[i]), so = Math.sin(ringOff[i]), r = i * rm;
          for (let j = 0; j < NS; j++) {
            const dx = r * (cosT[j] * co - sinT[j] * so) - s.whiskX, dz = r * (sinT[j] * co + cosT[j] * so) - s.whiskZ, d2 = dx * dx + dz * dz;
            if (d2 > 34e-4) continue;
            const q = Math.sqrt(d2) / 0.033;
            const f = -Math.exp(-q * q * 1.6) + 0.75 * Math.exp(-(q - 1.3) * (q - 1.3) * 5);
            const k = i * NS + j;
            ho[k] += (f * amp - ho[k]) * rate * (1 - smooth(1.45, 1.76, q));
          }
        }
      }
      const drag = 0.2 * (1 - 0.6 * w);
      if (Math.abs(s.omega) > 1e-4) {
        for (let i = 1; i <= NR; i++) {
          const rho = i / NR, gi = 0.86 + 0.14 * Math.sin(Math.PI * Math.min(1, rho * 1.25));
          ringOff[i] = (ringOff[i] + s.omega * drag * gi * dt) % TAU;
        }
        sim.theta += s.omega * drag * 0.5 * dt;
        sim.phase += s.omega * drag * dt;
      }
      const keep = Math.exp(-dt / lerp(0.3, 9, smooth(0.25, 1, w)));
      for (let k = NS; k < ho.length; k++) ho[k] *= keep;
      sim.scroll += s.flow * dt * 0.35;
      const mx = Math.tan(clamp(s.sigma, 0, 1.15)) + s.sloshX, mz = s.sloshZ;
      for (let j = 0; j < NS; j++) {
        const mj = mx * cosT[j] + mz * sinT[j];
        let lo = 0, hi = b.Rr;
        for (let it = 0; it < 11; it++) {
          const mid = (lo + hi) / 2, yp = Math.min(cL + mj * mid, yMax);
          if (yp - yin(mid) > 0) lo = mid;
          else hi = mid;
        }
        rb[j] = lo;
      }
      const wa = bt.waveA * (1 - w) * s.speed;
      const vort = 0.016 * s.speed * s.speed * Math.pow(1 - w, 1.5);
      const lumpA = 42e-4 * smooth(0.3, 0.95, w) * (1 - 0.7 * s.p);
      const dome = 4e-3 * smooth(0.6, 1, w) * (1 - s.p);
      const ph = sim.phase, lshift = Math.round(sim.theta / TAU * NS);
      const Rp = bt.peakR, hp = s.peakH, nPk = hp > 1e-5 ? PEAKS.length : 0;
      for (let n = 0; n < nPk; n++) {
        const pi = clamp(sim.peakI + PEAKS[n][0], 2, NR - 3), pj = ((sim.peakJ + PEAKS[n][1]) % NS + NS) % NS, pr = pi / NR * rb[pj];
        pkX[n] = pr * cosT[pj];
        pkZ[n] = pr * sinT[pj];
      }
      const cth = Math.cos(sim.theta), sth = Math.sin(sim.theta), us = 1 / bt.uvSize;
      let cSum = 0;
      for (let j = 0; j < NS; j++) {
        const cs = cosT[j], sn = sinT[j], mj = mx * cs + mz * sn, th = j / NS * TAU;
        const jl = ((j - lshift) % NS + NS) % NS;
        for (let i = 1; i <= NR; i++) {
          const rho = i / NR, r = rho * rb[j];
          let x = r * cs, z = r * sn;
          let fa = (th - ringOff[i]) / TAU * NS;
          fa -= Math.floor(fa / NS) * NS;
          const j0 = Math.floor(fa) % NS, j1 = (j0 + 1) % NS, ff = fa - Math.floor(fa);
          const hoV = ho[i * NS + j0] * (1 - ff) + ho[i * NS + j1] * ff;
          const fl = yin(r) + 6e-4;
          let yb = cL + mj * r;
          if (yb > yMax) yb = yMax;
          const fade = clamp((yb - fl) / 6e-3, 0, 1) * (1 - 0.85 * rho * rho * rho * rho);
          const wave = wa * rho * (1.25 - rho) * (0.6 * Math.sin(2 * (th - ph) + 9 * rho) + 0.4 * Math.sin(5 * (th - 1.7 * ph) - 6 * rho));
          const rel = (hoV + lumpA * lump[i * NS + jl] + wave) * fade;
          let y = yb + rel + (dome * (1 - rho * rho) + vort * (rho * rho - 0.45)) * fade;
          if (i === 1) cSum += y;
          let sh = 0.74 + 0.26 * smooth(-6e-3, 4e-3, rel);
          for (let n = 0; n < nPk; n++) {
            const dx = x - pkX[n], dz = z - pkZ[n], d2 = dx * dx + dz * dz, sc = PEAKS[n][2], R1 = Rp * (0.55 + 0.45 * sc);
            if (d2 > R1 * R1 * 2.9) continue;
            const d = Math.sqrt(d2), hh = hp * sc;
            if (d < R1) {
              const q = 1 - d / R1, q2 = q * q;
              y += hh * q2 * (0.3 + 0.7 * q);
              x += s.curlX * hh * q2 * q2;
              z += s.curlZ * hh * q2 * q2;
              sh = Math.min(1.05, sh + 0.3 * q2 * Math.min(1, hh * 60));
            } else sh -= 0.16 * (1 - (d - R1) / (R1 * 0.7)) * Math.min(1, hh * 60);
          }
          if (y < fl) y = fl;
          const k = polarIndex(i, j, NS);
          pos[k * 3] = x;
          pos[k * 3 + 1] = y;
          pos[k * 3 + 2] = z;
          col[k * 3] = sh;
          col[k * 3 + 1] = sh * (0.985 + 0.015 * sh);
          col[k * 3 + 2] = sh * (0.93 + 0.07 * sh);
          uv[k * 2] = (x * cth - z * sth) * us + 0.5 - sim.scroll;
          uv[k * 2 + 1] = (x * sth + z * cth) * us + 0.5;
        }
      }
      pos[0] = 0;
      pos[1] = Math.max(b.thk + 6e-4, cSum / NS);
      pos[2] = 0;
      uv[0] = 0.5 - sim.scroll;
      uv[1] = 0.5;
      col[0] = 0.93;
      col[1] = 0.925;
      col[2] = 0.9;
      polarNormals(pos, nrm, NR, NS);
      sgeo.attributes.position.needsUpdate = true;
      sgeo.attributes.normal.needsUpdate = true;
      sgeo.attributes.uv.needsUpdate = true;
      sgeo.attributes.color.needsUpdate = true;
    }
    function lipWorld(out, slide, tiltA, back) {
      const rx = D.lipR - (back || 0) - D.pivR, ry = top - 4e-3 - D.pivY, ct = Math.cos(tiltA), st = Math.sin(tiltA);
      const x = D.pivR + rx * ct + ry * st, y = D.pivY - rx * st + ry * ct;
      out.set(P2.MIXER[0] + slide * b.travel + x * D.sx, P2.MIXER[1] + b.baseY + y, P2.MIXER[2] + x * D.sz);
      return out;
    }
    return { sled, yaw, tilt, bowl, hit, pivot, surface, updateSurface, resetSurface, setPeakAt, lipWorld, rinAt, yin, NR, NS };
  }
  function buildStream(ctx, root) {
    const { THREE, K, M } = ctx;
    const NSEG = K.seg(22, 10), NRAD = K.seg(8, 6), NV = (NSEG + 1) * NRAD;
    const pos = new Float32Array(NV * 3), nrm = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), idx = [];
    for (let k = 0; k < NSEG; k++) for (let j = 0; j < NRAD; j++) {
      const j1 = (j + 1) % NRAD, a = k * NRAD + j, b2 = k * NRAD + j1, c2 = (k + 1) * NRAD + j, d2 = (k + 1) * NRAD + j1;
      idx.push(a, b2, c2, b2, d2, c2);
    }
    for (let i = 0; i < NV; i++) nrm[i * 3 + 1] = 1;
    const geo = K.own(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(NV * 3).fill(1), 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, M.batter);
    mesh.frustumCulled = false;
    mesh.visible = false;
    root.add(mesh);
    const st = { t0: 0, t1: 0, rf: 0, scroll: 0, landed: false };
    const cosA = new Float32Array(NRAD), sinA = new Float32Array(NRAD);
    for (let j = 0; j < NRAD; j++) {
      cosA[j] = Math.cos(j / NRAD * TAU);
      sinA[j] = Math.sin(j / NRAD * TAU);
    }
    function update(dt, time, flow, lip, land, tiltA) {
      if (flow > 0.02) {
        st.t1 = Math.min(1, st.t1 + dt * 3);
        st.t0 = 0;
        st.rf += (flow - st.rf) * Math.min(1, dt * 8);
      } else if (st.t1 > 0) {
        st.t0 += dt * 3.4;
        if (st.t0 >= st.t1) {
          st.t0 = st.t1 = 0;
          st.rf = 0;
        }
      }
      st.landed = st.t1 >= 0.999 && st.t0 <= 1e-3;
      mesh.visible = st.t1 - st.t0 > 0.02;
      if (!mesh.visible) return st.landed;
      st.scroll += dt * (0.9 + 0.8 * flow);
      let hx = land.x - lip.x, hz = land.z - lip.z;
      const Dh = Math.hypot(hx, hz);
      if (!(Dh > 1e-5)) {
        mesh.visible = false;
        return st.landed;
      }
      hx /= Dh;
      hz /= Dh;
      const drop = Math.max(0.01, lip.y - land.y);
      const a = clamp(Math.tan(Math.max(0, tiltA - 0.2)) * Dh / drop, 0.08, 0.8) * 0.6;
      const R0 = 0.013 * Math.sqrt(Math.max(0.05, st.rf));
      for (let k = 0; k <= NSEG; k++) {
        const t = st.t0 + (st.t1 - st.t0) * k / NSEG;
        const s = -0.2 + 1.2 * t, sc = Math.max(0, s);
        let cx, cy, cz, tx, ty, tz;
        if (s < 0) {
          cx = lip.x + hx * Dh * s;
          cz = lip.z + hz * Dh * s;
          cy = lip.y - drop * a * s;
          tx = hx * Dh;
          tz = hz * Dh;
          ty = -drop * a;
        } else {
          cx = lip.x + hx * Dh * s;
          cz = lip.z + hz * Dh * s;
          cy = lip.y - drop * (a * s + (1 - a) * s * s);
          tx = hx * Dh;
          tz = hz * Dh;
          ty = -drop * (a + 2 * (1 - a) * s);
        }
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl;
        ty /= tl;
        tz /= tl;
        const bx = -hz, bz = hx;
        const nx = -bz * ty, ny = bz * tx - bx * tz, nz = bx * ty;
        const sway = Math.sin(time * 6.5 + sc * 8) * 18e-4 * sc;
        cx += bx * sway;
        cz += bz * sway;
        let r = R0 * (0.6 + 0.4 / (1 + 2.5 * sc));
        const e = 1 - Math.min(1, sc * 3.3), e3 = e * e * e;
        const wB = 1 + 1.3 * e3, wN = 1 - 0.5 * e3;
        if (k === 0 && st.t0 > 1e-3) r *= 0.35;
        if (k === NSEG && st.t1 < 0.999) r *= 0.45;
        if (k === NSEG - 1 && st.t1 < 0.999) r *= 1.15;
        for (let j = 0; j < NRAD; j++) {
          const i = (k * NRAD + j) * 3, ca = cosA[j], sa = sinA[j];
          pos[i] = cx + (nx * ca * wN + bx * sa * wB) * r;
          pos[i + 1] = cy + ny * ca * wN * r;
          pos[i + 2] = cz + (nz * ca * wN + bz * sa * wB) * r;
          nrm[i] = nx * ca + bx * sa;
          nrm[i + 1] = ny * ca;
          nrm[i + 2] = nz * ca + bz * sa;
          const q = (k * NRAD + j) * 2;
          uv[q] = Math.abs(2 * j / NRAD - 1) * 0.25;
          uv[q + 1] = t * 0.5 - st.scroll;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      geo.attributes.uv.needsUpdate = true;
      return st.landed;
    }
    function reset() {
      st.t0 = st.t1 = 0;
      st.rf = 0;
      st.landed = false;
      mesh.visible = false;
    }
    return { mesh, update, reset, state: st };
  }

  // app/hero/cart.js
  var HX = Math.PI / 2;
  function buildPath(P2, D) {
    const o = P2.oven, d = o.door, ct = P2.cart;
    const cd = Math.cos(d.open), sd = Math.sin(d.open);
    const [HXw, HYw, HZw] = D.hingeW;
    const doorPt = (x, u) => [HXw + x, HYw + u * cd - D.doorRailW * sd, HZw + u * sd + D.doorRailW * cd];
    const R = d.arcR, E = doorPt(-d.w / 2, R);
    const back = 0.05;
    const P0 = [D.pourAt[0] - D.sx * back, D.pourAt[2] - D.sz * back];
    const L1 = 0.21, L2 = 0.12;
    const C1 = [P0[0] + D.sx * L1, P0[1] + D.sz * L1], C2 = [E[0] - L2, E[2]], P3 = [E[0], E[2]];
    const pts = [], nrm = [], doorLocal = [];
    const nC = 44;
    for (let i = 0; i <= nC; i++) {
      const t = i / nC, m = 1 - t;
      const x = m * m * m * P0[0] + 3 * m * m * t * C1[0] + 3 * m * t * t * C2[0] + t * t * t * P3[0];
      const z = m * m * m * P0[1] + 3 * m * m * t * C1[1] + 3 * m * t * t * C2[1] + t * t * t * P3[1];
      pts.push([x, lerp(ct.railTop, E[1], smooth(0.34, 1, t)), z]);
      nrm.push(null);
    }
    const iDoor = pts.length - 1;
    doorLocal.push([-d.w / 2, R]);
    for (let i = 1; i <= 2; i++) {
      const x = -d.w / 2 + (d.w / 2 - R) * i / 2;
      pts.push(doorPt(x, R));
      nrm.push([0, sd, -cd]);
      doorLocal.push([x, R]);
    }
    const nA = 18;
    for (let i = 1; i <= nA; i++) {
      const ph = HX * (1 - i / nA), x = -R + R * Math.cos(ph), u = R * Math.sin(ph);
      pts.push(doorPt(x, u));
      nrm.push([0, sd, -cd]);
      doorLocal.push([x, u]);
    }
    const iHinge = pts.length - 1;
    const zIn = D.inOven[2], zH = pts[iHinge][2];
    for (let i = 1; i <= 4; i++) {
      pts.push([HXw, o.railTop, zH + (zIn - 0.07 - zH) * i / 4]);
      nrm.push([0, 1, 0]);
    }
    const n = pts.length, s = [0];
    for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    const tanAt = (i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l];
    };
    for (let i = 0; i < n; i++) if (!nrm[i]) {
      const t = tanAt(i), hl = Math.hypot(t[0], t[2]) || 1, lx = -t[2] / hl, lz = t[0] / hl;
      const nx = -(lz * t[1]), ny = lz * t[0] - lx * t[2], nz = lx * t[1], l = Math.hypot(nx, ny, nz) || 1;
      nrm[i] = [nx / l, ny / l, nz / l];
    }
    for (let pass = 0; pass < 2; pass++) {
      const c = nrm.map((v) => v.slice());
      for (let i = 1; i < n - 1; i++) for (let k = 0; k < 3; k++) nrm[i][k] = (c[i - 1][k] + 2 * c[i][k] + c[i + 1][k]) / 4;
    }
    const sPour = back, sDoor = s[iDoor], sHinge = s[iHinge], sIn = s[iHinge] + (zH - zIn), len = s[n - 1];
    function at(sv, outP, outT, outN) {
      const q = clamp(sv, 0, len - 1e-6);
      let i = 0, lo = 0, hi = n - 1;
      while (hi - lo > 1) {
        const m = lo + hi >> 1;
        if (s[m] <= q) lo = m;
        else hi = m;
      }
      i = lo;
      const f = (q - s[i]) / Math.max(1e-9, s[i + 1] - s[i]), a = pts[i], b = pts[i + 1];
      outP.set(lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f));
      const t0 = tanAt(i), t1 = tanAt(i + 1);
      outT.set(lerp(t0[0], t1[0], f), lerp(t0[1], t1[1], f), lerp(t0[2], t1[2], f));
      if (outT.lengthSq() < 1e-12) outT.set(1, 0, 0);
      outT.normalize();
      outN.set(lerp(nrm[i][0], nrm[i + 1][0], f), lerp(nrm[i][1], nrm[i + 1][1], f), lerp(nrm[i][2], nrm[i + 1][2], f));
      outN.addScaledVector(outT, -outN.dot(outT));
      if (outN.lengthSq() < 1e-12) outN.set(0, 1, 0);
      outN.normalize();
    }
    return { pts, nrm, s, n, iDoor, iHinge, doorLocal, sPour, sServe: sPour + ct.serveS, sDoor, sHinge, sIn, len, at, tanAt };
  }
  function buildTrack(ctx, root, path) {
    const { THREE, K, M, P: P2 } = ctx;
    const ct = P2.cart, c = P2.col, half = ct.gauge / 2;
    const L = [], Rr = [], wood = [], steel = [];
    const lat = (i) => {
      const t = path.tanAt(i), n = path.nrm[i];
      return [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]];
    };
    for (let i = 0; i <= path.iDoor; i++) {
      const p = path.pts[i], l = lat(i), n = path.nrm[i];
      L.push([p[0] - l[0] * half - n[0] * ct.railR, p[1] - l[1] * half - n[1] * ct.railR, p[2] - l[2] * half - n[2] * ct.railR]);
      Rr.push([p[0] + l[0] * half - n[0] * ct.railR, p[1] + l[1] * half - n[1] * ct.railR, p[2] + l[2] * half - n[2] * ct.railR]);
    }
    steel.push(K.paint(K.tube(L, ct.railR, K.seg(5, 4), true), c.steel, 1, 0.22));
    steel.push(K.paint(K.tube(Rr, ct.railR, K.seg(5, 4), true), c.steel, 1, 0.22));
    const step = 0.038, P3 = new THREE.Vector3(), T3 = new THREE.Vector3(), N3 = new THREE.Vector3();
    for (let sv = 0.012; sv < path.sDoor - 0.01; sv += step) {
      path.at(sv, P3, T3, N3);
      const lx = T3.y * N3.z - T3.z * N3.y, ly = T3.z * N3.x - T3.x * N3.z, lz = T3.x * N3.y - T3.y * N3.x;
      const yTop = P3.y - 2 * ct.railR;
      const tie = K.box(0.013, 4e-3, ct.gauge + 0.026);
      K.orient(tie, [T3.x, T3.y, T3.z], [lx, ly, lz]);
      tie.translate(P3.x, yTop - 2e-3, P3.z);
      wood.push(K.textured(tie));
      const h = yTop - 4e-3;
      if (h > 4e-3) for (const sgn of [-1, 1]) {
        const post = K.box(0.011, h, 0.011);
        post.rotateY(-Math.atan2(T3.z, T3.x));
        post.translate(P3.x + lx * sgn * half, h / 2, P3.z + lz * sgn * half);
        wood.push(K.textured(post));
      }
    }
    {
      const p = path.pts[0], t = path.tanAt(0), l = lat(0);
      const stop = K.rbox(8e-3, 0.014, ct.gauge + 0.02, 2e-3, 1);
      K.orient(stop, t, l);
      stop.translate(p[0] - t[0] * 6e-3, 7e-3, p[2] - t[2] * 6e-3);
      steel.push(K.paint(stop, c.enamelDark, 0, 0.34));
    }
    const rails = new THREE.Mesh(K.merge(steel), M.hard());
    root.add(rails);
    const woodGeo = K.merge(wood);
    {
      const uv = woodGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.35 + i % 7 * 0.09, uv.getY(i) * 0.2 + i % 5 * 0.13);
    }
    const ties = new THREE.Mesh(woodGeo, M.wood());
    ties.material.color.set(15913901);
    root.add(ties);
    return { rails, ties };
  }
  function buildCart(ctx, root, path) {
    const { THREE, K, M, P: P2, D } = ctx;
    const ct = P2.cart, R = P2.ramekin, S = P2.souffle, c = P2.col;
    const pt = (geo, m) => K.paint(geo, m[0], m[1], m[2]);
    const CR = [c.cream, 0, 0.36], ST = [c.steel, 1, 0.2], BR = [c.brass, 1, 0.3], EN = [c.enamel, 0, 0.3], IR = [c.iron, 0.3, 0.5];
    const cart = new THREE.Group();
    cart.name = "cart";
    root.add(cart);
    {
      const g = [];
      g.push(pt(K.at(K.rbox(ct.L, ct.plateT, ct.W, 28e-4, 2), 0, ct.deckH - ct.plateT / 2, 0), CR));
      g.push(pt(K.at(K.cyl(R.foot + 6e-3, R.foot + 6e-3, 2e-3, K.seg(24, 12), "y"), 0, ct.deckH + 6e-4, 0), EN));
      for (const sx of [-1, 1]) {
        g.push(pt(K.at(K.cyl(22e-4, 22e-4, ct.gauge + ct.wheelT, 6, "z"), sx * ct.axleX, ct.wheelR, 0), ST));
        g.push(pt(K.at(K.box(0.012, ct.deckH - ct.plateT - ct.wheelR + 4e-3, ct.W - 0.012), sx * ct.axleX, (ct.deckH - ct.plateT + ct.wheelR) / 2, 0), EN));
      }
      cart.add(new THREE.Mesh(K.merge(g), M.hard()));
    }
    const wheelGeo = (() => {
      const g = [pt(K.cyl(ct.wheelR, ct.wheelR, ct.wheelT, K.seg(16, 10), "z"), BR)];
      g.push(pt(K.cyl(ct.wheelR * 0.36, ct.wheelR * 0.36, ct.wheelT + 2e-3, 8, "z"), ST));
      for (let k = 0; k < 3; k++) {
        const a = k * TAU / 3;
        g.push(pt(K.at(K.cyl(ct.wheelR * 0.2, ct.wheelR * 0.2, ct.wheelT + 12e-4, 6, "z"), Math.cos(a) * ct.wheelR * 0.66, Math.sin(a) * ct.wheelR * 0.66, 0), IR));
      }
      return K.merge(g);
    })();
    const wheels = new THREE.InstancedMesh(wheelGeo, M.hard(), 4);
    wheels.frustumCulled = false;
    cart.add(wheels);
    const wheelPos = [[ct.axleX, 1], [ct.axleX, -1], [-ct.axleX, 1], [-ct.axleX, -1]];
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
    function setWheels(sv) {
      _q.setFromEuler(_e.set(0, 0, -sv / ct.wheelR));
      for (let i = 0; i < 4; i++) {
        _m.compose(_v.set(wheelPos[i][0], ct.wheelR, wheelPos[i][1] * ct.gauge / 2), _q, _one);
        wheels.setMatrixAt(i, _m);
      }
      wheels.instanceMatrix.needsUpdate = true;
    }
    const ramekin = new THREE.Group();
    ramekin.position.set(0, ct.deckH, 0);
    cart.add(ramekin);
    const wiggle = new THREE.Group();
    ramekin.add(wiggle);
    {
      const H = R.H, prof = [[0, 0, 0], [R.foot - 5e-3, 0, 0], [R.foot - 1e-3, 12e-4, 0], [R.foot + 5e-4, 5e-3, 0.5]];
      const nw = K.seg(5, 3);
      for (let i = 1; i <= nw; i++) {
        const t = i / nw;
        prof.push([lerp(R.foot + 1e-3, R.Ro - 5e-4, t), lerp(6e-3, H - 0.013, t), 1]);
      }
      prof.push(
        [R.Ro + 12e-4, H - 0.011, 0],
        [R.Ro + 2e-3, H - 6e-3, 0],
        [R.Ro + 15e-4, H - 15e-4, 0],
        [R.Ro - 1e-3, H, 0],
        [R.Ri + 15e-4, H, 0],
        [R.Ri, H - 2e-3, 0],
        [R.Ri - 8e-4, R.floor + 6e-3, 0],
        [R.Ri - 4e-3, R.floor, 0],
        [0, R.floor, 0]
      );
      const fn = (p, th, out) => {
        if (p[2]) out.r *= 1 - 0.05 * p[2] * (1 - Math.abs(Math.cos(R.ribs * th / 2)));
      };
      const geo = K.textured(K.lathe(prof, K.seg(R.ribs * 4, R.ribs * 2), { fn, uRep: 3, vLen: 0.1 }));
      wiggle.add(new THREE.Mesh(K.own(geo), M.ceramic));
    }
    const NR = K.seg(S.NR, 12), NS = K.seg(S.NS, 24), NV = 1 + NR * NS;
    const pos = new Float32Array(NV * 3), nrm = new Float32Array(NV * 3), uv = new Float32Array(NV * 2), aTop = new Float32Array(NV);
    const tTab = new Float32Array(NR + 1), cosT = new Float32Array(NS), sinT = new Float32Array(NS), lumpR = new Float32Array(NS), lumpS = new Float32Array((NR + 1) * NS);
    for (let j = 0; j < NS; j++) {
      const th = j / NS * TAU;
      cosT[j] = Math.cos(th);
      sinT[j] = Math.sin(th);
      lumpR[j] = Math.sin(th * 3 + 0.7) * 0.6 + Math.sin(th * 7 + 2.3) * 0.4;
    }
    uv[0] = 0.5;
    uv[1] = 0.5;
    aTop[0] = 1;
    for (let i = 1; i <= NR; i++) {
      const t = Math.pow(i / NR, 0.85);
      tTab[i] = t;
      for (let j = 0; j < NS; j++) {
        const k = polarIndex(i, j, NS), rad = 0.5 * Math.pow(t, 0.9);
        uv[k * 2] = 0.5 + rad * cosT[j];
        uv[k * 2 + 1] = 0.5 + rad * sinT[j];
        aTop[k] = clamp(1 - 0.62 * smooth(0.5, 0.98, t) + (hash(i, j) - 0.5) * 0.12, 0, 1);
        const x = t * cosT[j], z = t * sinT[j];
        lumpS[i * NS + j] = 0.55 * Math.sin(x * 5.3 + 0.9) * Math.cos(z * 4.7 + 1.8) + 0.45 * Math.sin((x - z) * 8.1 + 0.3);
      }
    }
    const sgeo = K.own(new THREE.BufferGeometry());
    sgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    sgeo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
    sgeo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    sgeo.setAttribute("aTop", new THREE.BufferAttribute(aTop, 1));
    sgeo.setIndex(polarTriangles(NR, NS));
    sgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.06, 0), 0.14);
    const souffle = new THREE.Mesh(sgeo, M.souffle);
    souffle.visible = false;
    wiggle.add(souffle);
    const info = { top: R.H, base: R.floor };
    function updateSouffle(s) {
      souffle.visible = s.p > 0.01;
      if (!souffle.visible) return;
      const yF = R.floor, yR = R.H, Ri = R.Ri - 6e-4;
      const yb = yF + (yR - 4e-3 - yF) * Math.pow(Math.min(1, s.p), 0.85);
      const sb = smooth(0, 1, s.b), baked = s.p >= 1;
      const Hc = baked ? S.H0 + S.H1 * smooth(0.05, 0.85, s.b) : S.H0 * smooth(0.45, 1, s.p);
      const yTop = yb + Hc, rise = Math.max(1e-4, yTop - yR);
      const ex = 2 / lerp(2, 4, smooth(0.08, 0.9, s.b)), grow = smooth(0.15, 1, s.b);
      const rs = S.scoopR, rs2 = rs * rs, hRef = S.H0 + S.H1;
      info.top = yTop;
      info.base = yb;
      for (let i = 1; i <= NR; i++) {
        const a = tTab[i] * HX, cr = Math.pow(Math.sin(a), ex), cy = Math.pow(Math.max(0, Math.cos(a)), ex);
        const y0 = yb + Hc * cy, q = (y0 - yR) / rise;
        const F = 1 + (S.flare - 1) * sb * smooth(0, 0.22, q) * (1 - 0.16 * smooth(0.5, 1, q));
        const r0 = Ri * F * cr, edge = smooth(0, 0.3, q), pile = baked ? 0 : s.pile * Math.exp(-(r0 / 0.02) * (r0 / 0.02));
        for (let j = 0; j < NS; j++) {
          const cs = cosT[j], sn = sinT[j];
          const r = r0 * (1 + 0.035 * sb * lumpR[j] * edge);
          let x = r * cs, z = r * sn;
          let y = y0 + pile + Hc * grow * cy * (0.08 * (cs * 0.62 + sn * 0.78) * cr + 0.06 * lumpS[i * NS + j]);
          const hq = clamp((y - (yR - 6e-3)) / hRef, 0, 1.3);
          x += s.wobX * hq * hq;
          z += s.wobZ * hq * hq;
          y += (x * s.wobX + z * s.wobZ) * 5 * (1 - sb);
          const yq = y - (yR - 4e-3);
          if (yq > 0) {
            y -= yq * s.sq;
            x *= 1 + 0.45 * s.sq * hq;
            z *= 1 + 0.45 * s.sq * hq;
          }
          if (s.dent > 0) {
            const ddx = x - s.dx, ddz = z - s.dz, d2 = ddx * ddx + ddz * ddz;
            if (d2 < rs2) {
              const ys = s.dy - Math.sqrt(rs2 - d2);
              if (y > ys) y = Math.max(ys, yF + 2e-3);
            }
          }
          const k = polarIndex(i, j, NS) * 3;
          pos[k] = x;
          pos[k + 1] = y;
          pos[k + 2] = z;
        }
      }
      let yc = yTop + (baked ? 0 : s.pile);
      {
        const hq = clamp((yc - (yR - 6e-3)) / hRef, 0, 1.3);
        pos[0] = s.wobX * hq * hq;
        pos[2] = s.wobZ * hq * hq;
        const yq = yc - (yR - 4e-3);
        if (yq > 0) yc -= yq * s.sq;
        if (s.dent > 0) {
          const ddx = pos[0] - s.dx, ddz = pos[2] - s.dz, d2 = ddx * ddx + ddz * ddz;
          if (d2 < rs2) {
            const ys = s.dy - Math.sqrt(rs2 - d2);
            if (yc > ys) yc = ys;
          }
        }
        pos[1] = yc;
      }
      polarNormals(pos, nrm, NR, NS);
      sgeo.attributes.position.needsUpdate = true;
      sgeo.attributes.normal.needsUpdate = true;
    }
    const ramekinHit = new THREE.Mesh(K.own(K.box(0.17, 0.15, 0.17)), M.hit);
    ramekinHit.visible = false;
    ramekinHit.position.set(0, ct.deckH + 0.045, 0);
    cart.add(ramekinHit);
    const souffleHit = new THREE.Mesh(K.own(K.box(0.17, 0.19, 0.17)), M.hit);
    souffleHit.visible = false;
    souffleHit.position.set(0, ct.deckH + 0.075, 0);
    cart.add(souffleHit);
    const ramekinPivot = new THREE.Object3D();
    ramekinPivot.position.set(0, ct.deckH + R.H * 0.6, 0);
    cart.add(ramekinPivot);
    const soufflePivot = new THREE.Object3D();
    soufflePivot.position.set(0, ct.deckH + R.H + 0.03, 0);
    cart.add(soufflePivot);
    const serveFrame = new THREE.Group();
    serveFrame.position.set(0, ct.deckH, 0);
    cart.add(serveFrame);
    const spoon = new THREE.Group();
    spoon.visible = false;
    serveFrame.add(spoon);
    const spoonWiggle = new THREE.Group();
    spoon.add(spoonWiggle);
    const sp = P2.spoon, spoonMat = M.hard();
    {
      const g = [], Rs = sp.Rs, th = 11e-4, amax = Math.acos((Rs - sp.depth) / Rs), na = K.seg(7, 4), prof = [];
      for (let i = 0; i <= na; i++) {
        const a = amax * i / na;
        prof.push([Rs * Math.sin(a), Rs * (1 - Math.cos(a))]);
      }
      for (let i = na; i >= 0; i--) {
        const a = amax * i / na;
        prof.push([(Rs - th) * Math.sin(a), Rs - (Rs - th) * Math.cos(a)]);
      }
      const bowl = K.lathe(prof, K.seg(18, 10));
      bowl.scale(1.28, 1, 1);
      bowl.computeVertexNormals();
      g.push(pt(bowl, ST));
      const rimX = 1.28 * Rs * Math.sin(amax), pts = [], n = K.seg(10, 5);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push([rimX - 4e-3 + (sp.len - rimX) * t, sp.depth - 1e-3 + 0.03 * Math.sin(t * HX) - 4e-3 * t * t, 0]);
      }
      g.push(pt(K.tube(pts, (t) => [13e-4, lerp(34e-4, 68e-4, smooth(0.1, 1, t))], 6, true), ST));
      spoonWiggle.add(new THREE.Mesh(K.merge(g), spoonMat));
    }
    const bite = (() => {
      const Rs = sp.Rs - 11e-4, prof = [[0, 11e-4]], amax = Math.asin(0.0165 / Rs), na = 4, nt = K.seg(6, 4);
      for (let i = 1; i <= na; i++) {
        const a = amax * i / na;
        prof.push([Rs * Math.sin(a), sp.Rs - Rs * Math.cos(a)]);
      }
      const r1 = Rs * Math.sin(amax), y1 = sp.Rs - Rs * Math.cos(amax);
      for (let i = 1; i <= nt; i++) {
        const a = HX * i / nt;
        prof.push([r1 * Math.cos(a) * (1 + 0.12 * Math.sin(a * 2)), y1 + 0.015 * Math.sin(a)]);
      }
      const geo = K.textured(K.lathe(prof, K.seg(14, 8), { uRep: 1, vLen: 0.05 }));
      geo.scale(1.25, 1, 1);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(K.own(geo), M.scoop);
      m.visible = false;
      spoonWiggle.add(m);
      return m;
    })();
    const spoonHit = new THREE.Mesh(K.own(K.box(0.2, 0.2, 0.14)), M.hit);
    spoonHit.visible = false;
    spoonHit.position.set(0.04, 0.02, 0);
    spoon.add(spoonHit);
    const blob = new THREE.Mesh(K.own(new THREE.PlaneGeometry(0.19, 0.17)), M.blob);
    blob.rotation.x = -HX;
    blob.renderOrder = -1;
    root.add(blob);
    const _p = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _l = new THREE.Vector3(), _b = new THREE.Matrix4();
    function place(sv) {
      path.at(sv, _p, _t, _n);
      _l.crossVectors(_t, _n);
      _b.makeBasis(_t, _n, _l);
      cart.quaternion.setFromRotationMatrix(_b);
      cart.position.copy(_p);
      setWheels(sv);
      blob.visible = sv < path.sDoor - 0.02;
      blob.position.set(_p.x, 16e-4, _p.z);
      blob.rotation.z = Math.atan2(_t.z, _t.x) * -1;
    }
    path.at(path.sServe, _p, _t, _n);
    const serveYaw = Math.atan2(_t.z, _t.x);
    serveFrame.rotation.y = serveYaw;
    return {
      cart,
      ramekin,
      wiggle,
      souffle,
      updateSouffle,
      info,
      place,
      serveYaw,
      serveFrame,
      ramekinHit,
      souffleHit,
      ramekinPivot,
      soufflePivot,
      spoon,
      spoonWiggle,
      spoonHit,
      bite,
      spoonMat,
      blob,
      NR,
      NS
    };
  }

  // app/hero/oven.js
  var HX2 = Math.PI / 2;
  function buildOven(ctx, root, path) {
    const { THREE, K, M, P: P2, D } = ctx;
    const o = P2.oven, d = o.door, kb = o.knob, c = P2.col, ct = P2.cart;
    const group = new THREE.Group();
    group.name = "oven";
    group.position.fromArray(P2.OVEN);
    root.add(group);
    const cavW = o.cav.x1 - o.cav.x0, cavH = o.cav.y1 - o.cav.y0, front = o.D / 2;
    const body = [];
    {
      const shape = K.rrPath(THREE.Shape, -o.W / 2, o.foot, o.W / 2, o.H, o.r);
      shape.holes.push(K.rrPath(THREE.Path, o.cav.x0, o.cav.y0, o.cav.x1, o.cav.y1, 0.01));
      const shell = K.extrude(shape, o.D, 8e-3, K.seg(8, 3));
      shell.translate(0, 0, -o.D / 2);
      K.paint(shell, c.oven, 0, 0.3, 0);
      const pos = shell.attributes.position, col = shell.attributes.color, mre = shell.attributes.aMRE, k = new THREE.Color(c.ovenIn);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (x > o.cav.x0 - 2e-3 && x < o.cav.x1 + 2e-3 && y > o.cav.y0 - 2e-3 && y < o.cav.y1 + 2e-3 && Math.abs(z) < front - 4e-3) {
          col.setXYZ(i, k.r, k.g, k.b);
          mre.setXYZ(i, 0, 0.8, 0.3);
        }
      }
      body.push(shell);
      body.push(K.paint(K.at(K.box(cavW + 0.01, cavH + 0.01, 4e-3), D.cavX, (o.cav.y0 + o.cav.y1) / 2, o.cav.zBack), c.ovenIn, 0, 0.8, 0.3));
      for (const y of [o.cav.y1 - 0.014, o.cav.y0 + 6e-3]) {
        const pts = [], hw = 0.09, zc = 0.05, n = K.seg(10, 5);
        pts.push([D.cavX - hw, y, o.cav.zBack + 4e-3], [D.cavX - hw, y, zc]);
        for (let i = 1; i < n; i++) {
          const a = Math.PI * i / n;
          pts.push([D.cavX - hw * Math.cos(a), y, zc + hw * Math.sin(a)]);
        }
        pts.push([D.cavX + hw, y, zc], [D.cavX + hw, y, o.cav.zBack + 4e-3]);
        body.push(K.paint(K.tube(pts, 32e-4, 6, false), 6963252, 0.2, 0.6, 3.2));
      }
      for (let i = 0; i < o.rods; i++) {
        body.push(K.paint(K.at(K.cyl(14e-4, 14e-4, cavW - 4e-3, 5, "x"), D.cavX, o.railTop - 2 * ct.railR - 14e-4, -0.13 + i * (0.26 / (o.rods - 1))), c.steel, 1, 0.3, 0));
      }
      for (const sx of [-1, 1]) body.push(K.paint(K.at(K.cyl(ct.railR, ct.railR, 0.283, 5, "z"), D.cavX + sx * ct.gauge / 2, o.railTop - ct.railR, 0.0165), c.steel, 1, 0.22, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.push(K.paint(K.at(K.cyl(0.013, 0.016, o.foot + 2e-3, 10, "y"), sx * (o.W / 2 - 0.04), o.foot / 2, sz * (o.D / 2 - 0.04)), c.iron, 0.4, 0.5, 0));
      body.push(K.paint(K.at(K.rbox(0.082, 0.21, 5e-3, 24e-4, 1), kb.x, 0.156, front + 12e-4), c.cream, 0, 0.36, 0));
      body.push(K.paint(K.at(K.rbox(o.W - 0.07, 7e-3, 6e-3, 28e-4, 1), 0, o.H - 0.0145, front + 5e-4), c.steel, 1, 0.2, 0));
      for (let i = 0; i < 7; i++) {
        const a = (225 - i * 45) * Math.PI / 180, r = 22e-4 + i * 45e-5;
        body.push(K.paint(K.at(K.cyl(r, r, 3e-3, 8, "z"), kb.x + Math.cos(a) * (kb.r + 95e-4), kb.y + Math.sin(a) * (kb.r + 95e-4), front + 4e-3), c.red, 0, 0.4, 0));
      }
      body.push(K.paint(K.at(K.sphere(85e-4, 10, 8), kb.x, 0.236, front + 3e-3), 9058858, 0, 0.25, 5));
      body.push(K.paint(K.at(K.cyl(0.0115, 0.0115, 3e-3, 12, "z"), kb.x, 0.236, front + 4e-3), c.steel, 1, 0.2, 0));
    }
    const bodyMat = M.hard();
    bodyMat.emissive.set(c.heat);
    bodyMat.emissiveIntensity = 0;
    group.add(new THREE.Mesh(K.merge(body), bodyMat));
    const door = new THREE.Group();
    door.position.set(D.cavX, D.hingeY, D.hingeZ);
    group.add(door);
    const doorWiggle = new THREE.Group();
    door.add(doorWiggle);
    const doorMat = M.hard(), handleMat = M.wood();
    {
      const g = [];
      const shape = K.rrPath(THREE.Shape, -d.w / 2, 0, d.w / 2, d.h, 0.016);
      shape.holes.push(K.rrPath(THREE.Path, -d.winHW, d.winU0, d.winHW, d.winU1, 0.012));
      const frame = K.extrude(shape, d.t, 4e-3, K.seg(6, 3));
      frame.translate(0, 0, -d.t / 2);
      g.push(K.paint(frame, c.cream, 0, 0.34));
      for (const sx of [-1, 1]) g.push(K.paint(K.at(K.cyl(45e-4, 45e-4, 0.028, 8, "z"), sx * 0.085, d.h - 0.02, d.t / 2 + 0.013), c.steel, 1, 0.2));
      g.push(K.paint(K.at(K.cyl(6e-3, 6e-3, d.w - 0.03, 8, "x"), 0, 0, 0), c.steel, 1, 0.25));
      const half = ct.gauge / 2, L = [], R2 = [], dl = path.doorLocal, zr = -(d.t / 2 + ct.railR);
      for (let i = 0; i < dl.length; i++) {
        const a = dl[Math.max(0, i - 1)], b = dl[Math.min(dl.length - 1, i + 1)];
        let tx = b[0] - a[0], tu = b[1] - a[1];
        const l = Math.hypot(tx, tu) || 1;
        tx /= l;
        tu /= l;
        L.push([dl[i][0] - tu * half, dl[i][1] + tx * half, zr]);
        R2.push([dl[i][0] + tu * half, dl[i][1] - tx * half, zr]);
      }
      const glassParts = [];
      const inWin = (p) => Math.abs(p[0]) < d.winHW + 3e-3 && p[1] > d.winU0 - 3e-3 && p[1] < d.winU1 + 3e-3;
      for (const line of [L, R2]) {
        const fine = [];
        for (let i = 0; i < line.length - 1; i++) for (let k = 0; k < 5; k++) {
          const f = k / 5, a = line[i], b = line[i + 1];
          fine.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, zr]);
        }
        fine.push(line[line.length - 1]);
        let run = [fine[0]], cur = inWin(fine[0]);
        const flush = () => {
          if (run.length > 1) {
            if (cur) glassParts.push(K.textured(K.tube(run, ct.railR, 5, true)));
            else g.push(K.paint(K.tube(run, ct.railR, 5, true), c.iron, 0.5, 0.45));
          }
        };
        for (let i = 1; i < fine.length; i++) {
          const w = inWin(fine[i]);
          run.push(fine[i]);
          if (w !== cur) {
            flush();
            run = [fine[i]];
            cur = w;
          }
        }
        flush();
      }
      doorWiggle.add(new THREE.Mesh(K.merge(g), doorMat));
      const bar = K.textured(K.lathe([[0, -0.11], [6e-3, -0.11], [85e-4, -0.104], [85e-4, 0.104], [6e-3, 0.11], [0, 0.11]], K.seg(12, 8), { swapUV: true, uRep: 0.4, vLen: 0.3 }));
      bar.rotateZ(-HX2);
      bar.translate(0, d.h - 0.02, d.t / 2 + 0.027);
      doorWiggle.add(new THREE.Mesh(K.own(bar), handleMat));
      glassParts.push(K.textured(K.at(K.box(2 * d.winHW + 8e-3, d.winU1 - d.winU0 + 8e-3, 3e-3), 0, (d.winU0 + d.winU1) / 2, 0)));
      const glass = new THREE.Mesh(K.merge(glassParts), M.glass);
      glass.renderOrder = 3;
      doorWiggle.add(glass);
    }
    const doorHit = new THREE.Mesh(K.own(K.box(d.w + 0.06, d.h + 0.06, 0.13)), M.hit);
    doorHit.visible = false;
    doorHit.position.set(0, d.h / 2, 0.02);
    door.add(doorHit);
    const doorPivot = new THREE.Object3D();
    doorPivot.position.set(0, d.h * 0.55, 0);
    door.add(doorPivot);
    const knob = new THREE.Group();
    knob.position.set(kb.x, kb.y, front + 4e-3);
    group.add(knob);
    const knobWiggle = new THREE.Group();
    knob.add(knobWiggle);
    const knobSpin = new THREE.Group();
    knobWiggle.add(knobSpin);
    const knobMat = M.hard();
    {
      const g = [], r = kb.r, t = kb.t;
      const prof = [[0, 0, 0], [r + 5e-3, 0, 0], [r + 5e-3, 3e-3, 0], [r + 1e-3, 5e-3, 0], [r, 7e-3, 1], [r * 0.95, t, 1], [r * 0.86, t + 3e-3, 0], [0, t + 3e-3, 0]];
      const fn = (p, th, out) => {
        if (p[2]) out.r *= 1 - 0.1 * (1 - Math.abs(Math.cos(kb.grooves * th / 2)));
      };
      const geo = K.lathe(prof, K.seg(kb.grooves * 6, kb.grooves * 3), { fn });
      geo.rotateX(HX2);
      g.push(K.paint(geo, c.cream, 0, 0.3));
      g.push(K.paint(K.at(K.rbox(65e-4, r * 0.72, 4e-3, 18e-4, 1), 0, r * 0.5, t + 35e-4), c.red, 0, 0.35));
      g.push(K.paint(K.at(K.cyl(6e-3, 5e-3, 4e-3, 10, "z"), 0, 0, t + 4e-3), c.brass, 1, 0.3));
      knobSpin.add(new THREE.Mesh(K.merge(g), knobMat));
    }
    const knobHit = new THREE.Mesh(K.own(K.cyl(kb.hitR, kb.hitR, 0.09, 14, "z")), M.hit);
    knobHit.visible = false;
    knobHit.position.set(0, 0, 0.02);
    knob.add(knobHit);
    void TAU;
    return { group, bodyMat, door, doorWiggle, doorMat, handleMat, doorHit, doorPivot, knob, knobWiggle, knobSpin, knobMat, knobHit };
  }

  // app/hero/hero.js
  var HX3 = Math.PI / 2;
  var DONE_WAIT = { whisk: 2.3, pour: 1, load: 0.6, close: 0.7, bake: 1.3, open: 0.6, wobble: 0.9, scoop: 1.5 };
  function createHero(THREE, opts) {
    const emit = (ev) => {
      try {
        opts.onEvent && opts.onEvent(ev);
      } catch (e) {
      }
    };
    const sound = (name, gain, pitch) => emit({ type: "sound", name, gain, pitch });
    const K = createKit(THREE, opts.addons, opts.quality || { detail: 1 });
    const M = createMaterials(THREE, opts, K.own, P);
    const D = derive(P);
    const root = new THREE.Group();
    root.name = "hero";
    const ctx = { THREE, K, M, P, D };
    const mixer = buildMixer(ctx);
    root.add(mixer.group);
    const bowl = buildBowl(ctx, mixer.group);
    const stream = buildStream(ctx, root);
    const path = buildPath(P, D);
    buildTrack(ctx, root, path);
    const cart = buildCart(ctx, root, path);
    const oven = buildOven(ctx, root, path);
    {
      const a = new THREE.PlaneGeometry(0.5, 0.5);
      a.rotateX(-HX3);
      a.translate(P.MIXER[0] + 0.02, 15e-4, P.MIXER[2] - 0.07);
      const b = new THREE.PlaneGeometry(0.58, 0.46);
      b.rotateX(-HX3);
      b.translate(P.OVEN[0], 15e-4, P.OVEN[2]);
      const m = new THREE.Mesh(K.merge([a, b]), M.blob);
      m.renderOrder = -1;
      root.add(m);
    }
    const mx = P.mixer, ck = P.crank, bw = P.bowl, bt = P.batter, ct = P.cart, dr = P.oven.door, kb = P.oven.knob, sf = P.souffle;
    const targets = [
      { id: "crank", object: mixer.crankHit, pivot: mixer.crank, kind: "rotate", gesture: { type: "circle" }, enabled: false },
      { id: "bowl", object: bowl.hit, pivot: bowl.pivot, kind: "drag", gesture: { type: "drag", dir: [0.71, -0.71] }, enabled: false },
      { id: "ramekin", object: cart.ramekinHit, pivot: cart.ramekinPivot, kind: "tap", gesture: { type: "tap" }, enabled: false },
      { id: "door", object: oven.doorHit, pivot: oven.doorPivot, kind: "drag", gesture: { type: "drag", dir: [0, 1] }, enabled: false },
      { id: "knob", object: oven.knobHit, pivot: oven.knob, kind: "rotate", gesture: { type: "circle" }, enabled: false },
      { id: "souffle", object: cart.souffleHit, pivot: cart.soufflePivot, kind: "tap", gesture: { type: "tap" }, enabled: false },
      { id: "spoon", object: cart.spoonHit, pivot: cart.spoon, kind: "drag", gesture: { type: "drag", dir: [0, -1] }, enabled: false }
    ];
    const byId = {};
    targets.forEach((t) => {
      byId[t.id] = t;
    });
    const glowOf = { crank: mixer.glow, bowl: [M.copper], ramekin: [M.ceramic], door: [oven.doorMat, oven.handleMat], knob: [oven.knobMat], souffle: [M.souffle], spoon: [cart.spoonMat] };
    const GLOW = new THREE.Color(P.col.glow), HEAT = new THREE.Color(P.col.heat);
    const LIQ = new THREE.Color(P.col.liquid), FOAM = new THREE.Color(P.col.foam), PALE = new THREE.Color(16773314), GOLD = new THREE.Color(14262346);
    const loops = { whisk: { level: 0, rate: 1 }, pour: { level: 0, rate: 1 }, oven: { level: 0, rate: 1 } };
    const sp = () => ({ x: 0, v: 0 });
    let S, crustTex = null, crustAsked = false;
    function fresh() {
      return {
        stageIndex: 0,
        stageT: 0,
        done: false,
        doneT: 0,
        ready: false,
        time: 0,
        glowT: 0,
        w: 0,
        p: 0,
        b: 0,
        crank: sp(),
        crankGoal: 0,
        crankCoast: 0,
        crankAuto: 0,
        crankDir: 1,
        clickAcc: 0,
        speedS: 0,
        fluidOm: 0,
        carOm: 0,
        flex: sp(),
        sloshX: sp(),
        sloshZ: sp(),
        lift: sp(),
        liftGoal: 0,
        slide: sp(),
        slideGoal: 0,
        peak: sp(),
        peakPhase: 0,
        curlX: 0,
        curlZ: 1,
        tipOK: false,
        tipX: 0,
        tipZ: 0,
        tilt: sp(),
        tiltGoal: 0,
        tiltPulse: 0,
        sigma: 0,
        flow: 0,
        pile: 0,
        landed: false,
        cartS: path.sPour,
        cartFrom: 0,
        cartTo: 0,
        cartDur: 1,
        cartU: 1,
        cartMode: "pour",
        tieAcc: 0,
        door: { x: 1, v: 0 },
        doorGoal: 1,
        doorHeld: false,
        dragAcc: 0,
        doorSnd: false,
        knob: sp(),
        knobGoal: 0,
        knobCoast: 0,
        knobAuto: 0,
        knobDir: 1,
        knobClick: 0,
        heat: 0,
        glowI: 0,
        puffs: 0,
        wobX: sp(),
        wobZ: sp(),
        sq: sp(),
        taps: 0,
        idleJig: 0,
        d: 0,
        dGoal: 0,
        scoopU: -1,
        spoonIn: 0,
        dentOn: 0,
        dentX: 0,
        dentY: 0,
        dentZ: 0,
        inside: 0
      };
    }
    const stageName = () => STAGES[S.stageIndex];
    const activeId = () => S.done || !S.ready ? null : TARGET_OF[stageName()] || null;
    function startStage(i) {
      S.stageIndex = i;
      S.stageT = 0;
      S.done = false;
      S.doneT = 0;
      S.dragAcc = 0;
      S.glowT = 0;
      S.doorHeld = false;
      const st = stageName();
      S.ready = !(st === "pour" || st === "scoop");
      targets.forEach((t) => {
        t.enabled = S.ready && t.id === TARGET_OF[st];
      });
      byId.door.gesture = { type: "drag", dir: st === "open" ? [0, -1] : [0, 1] };
      if (st === "pour") {
        S.slideGoal = 1;
        sound("slide", 0.8, 0.9);
        if (!crustAsked) {
          crustAsked = true;
          opts.textures.ready("golden_crust").then((t) => {
            crustTex = t;
            M.setCrust(t);
          }).catch(() => {
          });
        }
      }
      if (st === "load") {
        S.slideGoal = 0;
        sound("slide", 0.5, 0.8);
      }
      if (st === "scoop") {
        cart.spoon.visible = true;
        S.spoonIn = 0;
        sound("whoosh", 0.6);
      }
      emit({ type: "stage", stage: st, index: i, view: VIEW[st] });
      if (st === "finale") emit({ type: "complete" });
    }
    function finishStage() {
      if (S.done) return;
      S.done = true;
      S.doneT = 0;
      targets.forEach((t) => {
        t.enabled = false;
      });
      emit({ type: "stageDone", stage: stageName(), index: S.stageIndex });
    }
    function makeReady() {
      S.ready = true;
      const id = TARGET_OF[stageName()];
      targets.forEach((t) => {
        t.enabled = t.id === id;
      });
    }
    const v1 = new THREE.Vector3(), tipW = new THREE.Vector3(), tipL = new THREE.Vector3(), lipV = new THREE.Vector3(), landV = new THREE.Vector3();
    const surfIn = { w: 0, p: 0, sigma: 0, sloshX: 0, sloshZ: 0, speed: 0, stir: 0, whiskX: 0, whiskZ: 0, omega: 0, flow: 0, peakH: 0, curlX: 0, curlZ: 0 };
    const sfIn = { p: 0, b: 0, pile: 0, wobX: 0, wobZ: 0, sq: 0, dent: 0, dx: 0, dy: 0, dz: 0 };
    const sfLast = new Float64Array(10).fill(NaN);
    let lastCartS = NaN;
    function fingerAngle(obj, input) {
      const cam = opts.camera;
      if (!cam) return null;
      obj.getWorldPosition(v1).project(cam);
      const dx = (input.pointer.x - v1.x) * (cam.aspect || 1), dy = input.pointer.y - v1.y;
      if (!(dx * dx + dy * dy > 16e-4)) return null;
      return Math.atan2(dy, dx);
    }
    function cartGo(to, dur, mode) {
      S.cartFrom = S.cartS;
      S.cartTo = to;
      S.cartDur = dur;
      S.cartU = 0;
      S.cartMode = mode;
      S.tieAcc = 0;
      sound("slide", 1, 1);
      const dir = to > S.cartS ? 1 : -1;
      S.wobX.v -= dir * 0.05;
    }
    function update(dtIn, input) {
      const dt = clamp(fin(dtIn, 0), 0, 0.05);
      if (S.done) {
        S.doneT += dt;
        if (S.stageIndex < STAGES.length - 1 && S.doneT >= DONE_WAIT[stageName()] && settled()) startStage(S.stageIndex + 1);
      }
      const st = stageName(), live = !S.done;
      S.stageT += dt;
      S.glowT += dt;
      S.time += dt;
      const held = (id) => live && S.ready && input.isDown && input.grabId === id;
      const tap = live && S.ready ? input.tapId : null;
      const idle = fin(input.idle, 0);
      const rot = fin(input.rotate, 0), dpx = fin(input.dragPx.x, 0), dpy = fin(input.dragPx.y, 0);
      const act = activeId(), touching = act && input.isDown && input.grabId === act;
      let wig = 0, wigStart = false;
      if (act && !touching && idle >= 2.5) {
        const ph = (idle - 2.5) % 2;
        if (ph < 1) wig = Math.sin(ph * TAU * 1.5) * 3 * DEG;
        wigStart = ph < dt + 1e-4;
      }
      const cranking = st === "whisk" && held("crank");
      if (cranking) {
        if (input.pressed) {
          const fa = fingerAngle(mixer.crank, input);
          if (fa !== null) S.crankGoal = S.crank.x + wrapPi(fa - S.crank.x);
        }
        S.crankGoal += rot;
        if (Math.abs(rot) > 1e-5) S.crankDir = rot > 0 ? 1 : -1;
        S.crankCoast += (rot / Math.max(dt, 1e-3) - S.crankCoast) * Math.min(1, dt * 10);
      } else {
        S.crankGoal += S.crankCoast * dt;
        S.crankCoast *= Math.exp(-dt / ck.coastTau);
      }
      if (st === "whisk" && tap === "crank") S.crankAuto += ck.tapTurn;
      if (S.crankAuto > 0) {
        const k = Math.min(S.crankAuto, dt * ck.tapTurn / ck.tapTime);
        S.crankGoal += k * S.crankDir;
        S.crankAuto -= k;
      }
      S.crankGoal = clamp(fin(S.crankGoal, S.crank.x), S.crank.x - 9, S.crank.x + 9);
      S.crankCoast = clamp(fin(S.crankCoast, 0), -60, 60);
      const c0 = S.crank.x;
      springTo(S.crank, S.crankGoal, ck.w0 * (1 - 0.2 * S.w), ck.zeta, dt);
      const dC = S.crank.x - c0;
      if (st === "whisk" && live) {
        S.w = clamp(S.w + Math.abs(dC) / (TAU * ck.turns), 0, 1);
        S.clickAcc += Math.abs(dC) * P.gear.Z1 / TAU;
        if (S.clickAcc >= 4) {
          S.clickAcc -= 4;
          if (S.clickAcc > 4) S.clickAcc = 0;
          sound("click", 0.45, 0.9 + S.w * 0.4);
        }
        if (Math.random() < Math.abs(S.crank.v) * dt * 0.35 * (0.3 + S.w)) sound("pop", 0.3, 0.8 + S.w);
        if (S.w >= 1) {
          S.crankAuto = 0;
          finishStage();
        }
      }
      const thC = S.crank.x + (act === "crank" ? wig : 0);
      const thH = D.kH * thC, thS = thH;
      mixer.crankSpin.rotation.z = thC;
      mixer.hshaft.rotation.x = thH;
      mixer.vshaft.rotation.y = thS;
      mixer.spin.rotation.y = D.kP * thS;
      const carOm = D.kH * S.crank.v, carAl = (carOm - S.carOm) / Math.max(dt, 1e-3);
      S.carOm = carOm;
      {
        const n = 2, h = dt / n, tgt = clamp(-16e-4 * carOm * S.w, -0.06, 0.06);
        for (let i = 0; i < n; i++) {
          S.flex.v += (800 * (tgt - S.flex.x) - 14 * S.flex.v - 0.25 * carAl) * h;
          S.flex.x += S.flex.v * h;
        }
        S.flex.x = clamp(fin(S.flex.x), -0.1, 0.1);
        S.flex.v = clamp(fin(S.flex.v), -8, 8);
        mixer.flex.rotation.x = S.flex.x;
      }
      const speedN = clamp(Math.abs(S.crank.v) / 12, 0, 1);
      S.speedS += (speedN - S.speedS) * Math.min(1, dt / (speedN > S.speedS ? 0.12 : 0.15 + 0.5 * (1 - S.w)));
      S.fluidOm += (-carOm - S.fluidOm) * Math.min(1, dt / 0.45);
      loops.whisk.level = speedN;
      loops.whisk.rate = 0.8 + 0.8 * S.w;
      if (S.stageIndex === 0 && S.done && S.doneT > 0.45 && S.liftGoal === 0) {
        S.liftGoal = 1;
        S.peakPhase = 1;
        sound("whoosh", 0.8, 0.9);
      }
      if (S.stageIndex >= 2 && S.liftGoal === 1 && S.slide.x < 0.06) {
        S.liftGoal = 0;
        sound("whoosh", 0.5, 0.8);
      }
      springTo(S.lift, S.liftGoal, 5.2, 0.85, dt);
      mixer.head.rotation.x = -S.lift.x * mx.liftMax;
      const sl0 = S.slide.x;
      springTo(S.slide, S.slideGoal, 6.5, 0.9, dt);
      if (S.slideGoal === 1 && sl0 < 0.985 && S.slide.x >= 0.985 || S.slideGoal === 0 && sl0 > 0.015 && S.slide.x <= 0.015) sound("clack", 0.5, 1.1);
      bowl.sled.position.x = S.slide.x * bw.travel;
      if (st === "pour" && !S.ready && live && S.slide.x > 0.96) makeReady();
      if (st === "pour" && live) {
        if (held("bowl")) S.tiltGoal = clamp(S.tiltGoal + (dpx * 0.71 - dpy * 0.71) * bw.dragGain, 0, bw.tiltMax);
        else if (S.tiltPulse <= 0) S.tiltGoal = 0;
        if (tap === "bowl") S.tiltPulse = 1.5;
        if (S.tiltPulse > 0) {
          S.tiltPulse -= dt;
          S.tiltGoal = S.tiltPulse > 0 ? 0.9 * bw.tiltMax : 0;
        }
      } else {
        S.tiltGoal = 0;
        S.tiltPulse = 0;
      }
      {
        const up = S.tiltGoal > S.tilt.x;
        springTo(S.tilt, S.tiltGoal, up ? bw.w0 + 2 * S.p : 4.5, up ? bw.zeta : 1, dt);
        if (S.tilt.x < 0) {
          if (S.tilt.v < -0.6) sound("clack", clamp(-S.tilt.v / 4, 0.2, 0.8), 0.8);
          S.tilt.x = 0;
          S.tilt.v = -S.tilt.v * 0.2;
        }
      }
      const tiltA = S.tilt.x + (act === "bowl" ? Math.abs(wig) : 0);
      bowl.tilt.rotation.z = -tiltA;
      S.sigma += (tiltA - S.sigma) * Math.min(1, dt / lerp(0.12, 0.4, S.w));
      S.flow = st === "pour" && live && S.tilt.x > bw.flowStart ? smooth(bw.flowStart, bw.flowFull, S.tilt.x) : 0;
      if (S.flow > 0) {
        S.p = clamp(S.p + bw.flowRate * S.flow * dt, 0, 1);
        if (S.p >= 1) {
          finishStage();
        }
      }
      bowl.lipWorld(lipV, S.slide.x, tiltA, 0);
      landV.set(D.pourAt[0], ct.railTop + ct.deckH + cart.info.base - 3e-3, D.pourAt[2]);
      const landed = stream.update(dt, S.time, S.done ? 0 : S.flow, lipV, landV, tiltA);
      if (landed && !S.landed) sound("plop", 0.9, 0.9 + 0.3 * S.p);
      S.landed = landed;
      S.pile += ((landed ? 0.011 * S.flow : 0) - S.pile) * Math.min(1, dt * (landed ? 6 : 3));
      loops.pour.level = landed ? S.flow : S.flow * 0.25;
      loops.pour.rate = 0.8 + 0.5 * S.p;
      if (S.stageIndex <= 2 || Math.abs(S.slide.v) > 1e-3) {
        mixer.spin.updateWorldMatrix(true, false);
        tipW.set(0, mixer.whiskTipLocalY, 0).applyMatrix4(mixer.spin.matrixWorld);
        tipL.copy(tipW);
        bowl.bowl.worldToLocal(tipL);
        const level = bw.thk + (bt.h0 + bt.h1 * smooth(0, 1, S.w)) * (1 - S.p), sub = level - tipL.y;
        const inBowl = sub > -2e-3 && Math.hypot(tipL.x, tipL.z) < 0.12 && S.slide.x < 0.05;
        let tipV = 0;
        if (S.tipOK && dt > 1e-4) tipV = Math.hypot(tipL.x - S.tipX, tipL.z - S.tipZ) / dt;
        const kPeak = smooth(0.7, 1, S.w), pMax = bt.peakH * kPeak;
        let pTarget = 0;
        if (S.peakPhase === 1 && sub < 0) {
          S.peakPhase = 2;
          bowl.setPeakAt(tipL.x, tipL.z);
          const vx = tipL.x - S.tipX, vz = tipL.z - S.tipZ, vl = Math.hypot(vx, vz);
          if (vl > 1e-6) {
            S.curlX = vx / vl;
            S.curlZ = vz / vl;
          }
        }
        if (S.peakPhase === 2) {
          pTarget = Math.min(-sub, pMax);
          if (-sub > pMax * 1.05) {
            S.peakPhase = 3;
            S.peak.v -= 0.2;
            sound("pop", 0.7, 1.3);
          }
        }
        if (S.peakPhase === 3) pTarget = pMax * 0.9;
        springTo(S.peak, pTarget, S.peakPhase === 2 ? 45 : 17, S.peakPhase === 2 ? 1 : 0.28, dt);
        S.tipOK = true;
        S.tipX = tipL.x;
        S.tipZ = tipL.z;
        const sw = 0.1 * S.speedS * (1 - 0.8 * S.w), rr = Math.hypot(tipL.x, tipL.z) || 1;
        springTo(S.sloshX, inBowl ? -sw * tipL.x / rr : 0, 10, lerp(0.16, 0.6, S.w), dt);
        springTo(S.sloshZ, inBowl ? -sw * tipL.z / rr : 0, 10, lerp(0.16, 0.6, S.w), dt);
        surfIn.w = S.w;
        surfIn.p = S.p;
        surfIn.sigma = S.sigma;
        surfIn.sloshX = S.sloshX.x;
        surfIn.sloshZ = S.sloshZ.x;
        surfIn.speed = S.speedS;
        surfIn.stir = inBowl ? clamp(tipV / 0.5, 0, 1) : 0;
        surfIn.whiskX = tipL.x;
        surfIn.whiskZ = tipL.z;
        surfIn.omega = S.fluidOm;
        surfIn.flow = S.flow;
        const slump = 1 - smooth(0, 0.5, S.p);
        surfIn.peakH = Math.max(0, S.peak.x) * slump;
        const curl = 0.42 + 0.35 * clamp(S.peak.v / 0.3, -1, 1);
        surfIn.curlX = S.curlX * curl;
        surfIn.curlZ = S.curlZ * curl;
        bowl.updateSurface(dt, surfIn);
      }
      {
        const cs = smooth(0.5, 1, S.w);
        mixer.clump.visible = cs > 0.02;
        if (mixer.clump.visible) mixer.clump.scale.setScalar(0.35 + 0.65 * cs);
      }
      M.batterU.uRep.value = bt.rep0 + bt.rep1 * S.w;
      M.batterU.uFoam.value.x = smooth(0.08, 0.6, S.w);
      M.batter.color.copy(LIQ).lerp(FOAM, smooth(0.05, 0.75, S.w));
      M.batter.roughness = lerp(0.15, 0.75, smooth(0.1, 0.9, S.w));
      M.batter.bumpScale = 0.9 * smooth(0.25, 0.9, S.w);
      if (st === "load" && live && S.cartMode === "pour") {
        if (held("ramekin")) S.dragAcc += Math.abs(dpx) + Math.abs(dpy);
        if (tap === "ramekin" || S.dragAcc > 40) cartGo(path.sIn, ct.loadTime, "in");
      }
      if (S.cartU < 1) {
        S.cartU = Math.min(1, S.cartU + dt / S.cartDur);
        const s0 = S.cartS;
        S.cartS = lerp(S.cartFrom, S.cartTo, ease(S.cartU));
        S.tieAcc += Math.abs(S.cartS - s0);
        if (S.tieAcc > 0.076) {
          S.tieAcc = 0;
          sound("click", 0.3, 0.6);
        }
        if (S.cartU >= 1) {
          const dir = S.cartTo > S.cartFrom ? 1 : -1;
          sound("clack", 0.7, 0.9);
          S.wobX.v += dir * 0.07;
          S.sq.v += 0.6;
          if (S.cartMode === "in") {
            S.cartMode = "oven";
            if (st === "load") finishStage();
          } else if (S.cartMode === "out") {
            S.cartMode = "serve";
            if (st === "open") finishStage();
          }
        }
      }
      if (S.cartS !== lastCartS) {
        cart.place(S.cartS);
        lastCartS = S.cartS;
      }
      cart.wiggle.rotation.z = act === "ramekin" ? wig : 0;
      if (st === "close" && live) {
        if (held("door")) {
          S.doorHeld = true;
          S.dragAcc += dpy;
          S.doorGoal = clamp(1 - S.dragAcc / 170, 0, 1);
          if (S.doorGoal < 0.1) S.doorGoal = 0;
        } else if (S.doorHeld) {
          S.doorHeld = false;
          S.doorGoal = S.doorGoal < 0.62 ? 0 : 1;
          S.dragAcc = 0;
        }
        if (tap === "door") S.doorGoal = 0;
      }
      if (st === "open" && live && S.cartMode === "oven") {
        if (held("door")) {
          S.doorHeld = true;
          S.dragAcc -= dpy;
          S.doorGoal = clamp(S.dragAcc / 170, 0, 1);
          if (S.doorGoal > 0.9) S.doorGoal = 1;
        } else if (S.doorHeld) {
          S.doorHeld = false;
          S.doorGoal = S.doorGoal > 0.38 ? 1 : 0;
          S.dragAcc = 0;
        }
        if (tap === "door") S.doorGoal = 1;
        if (S.doorGoal > 0.05 && !S.doorSnd) {
          S.doorSnd = true;
          sound("doorOpen");
        }
      }
      {
        const hd = S.doorHeld;
        springTo(S.door, S.doorGoal, hd ? 14 : dr.w0, hd ? 0.9 : dr.zeta, dt);
        if (S.door.x < 0) {
          if (S.door.v < -0.3) {
            sound("door", clamp(-S.door.v / 3, 0.3, 1));
            S.sq.v += 0.5;
            S.wobZ.v -= 0.03;
          }
          S.door.x = 0;
          S.door.v = -S.door.v * dr.bounce;
        }
        if (S.door.x > 1) {
          if (S.door.v > 0.5) sound("clack", clamp(S.door.v / 4, 0.2, 0.7), 0.7);
          S.door.x = 1;
          S.door.v = -S.door.v * 0.2;
        }
        const wd = act === "door" ? Math.abs(wig) * (st === "open" ? 1 : -1) : 0;
        oven.door.rotation.x = clamp(S.door.x * dr.open + wd, 0, dr.open);
        if (st === "close" && live && S.doorGoal === 0 && S.door.x < 0.02 && Math.abs(S.door.v) < 0.25) finishStage();
        if (st === "open" && live && S.cartMode === "oven" && S.doorGoal === 1 && S.door.x > 0.93) cartGo(path.sServe, ct.outTime, "out");
      }
      const knobbing = st === "bake" && held("knob");
      if (knobbing) {
        if (input.pressed) {
          const fa = fingerAngle(oven.knob, input);
          if (fa !== null) S.knobGoal = S.knob.x + wrapPi(fa - HX3 - S.knob.x);
        }
        S.knobGoal += rot;
        if (Math.abs(rot) > 1e-5) S.knobDir = rot > 0 ? 1 : -1;
        S.knobCoast += (rot / Math.max(dt, 1e-3) - S.knobCoast) * Math.min(1, dt * 10);
      } else {
        S.knobGoal += S.knobCoast * dt;
        S.knobCoast *= Math.exp(-dt / 0.12);
      }
      if (st === "bake" && tap === "knob") S.knobAuto += ck.tapTurn;
      if (S.knobAuto > 0) {
        const k = Math.min(S.knobAuto, dt * ck.tapTurn / ck.tapTime);
        S.knobGoal += k * S.knobDir;
        S.knobAuto -= k;
      }
      S.knobGoal = clamp(fin(S.knobGoal, S.knob.x), S.knob.x - 9, S.knob.x + 9);
      S.knobCoast = clamp(fin(S.knobCoast, 0), -60, 60);
      const k0 = S.knob.x;
      springTo(S.knob, S.knobGoal, kb.w0, kb.zeta, dt);
      const dK = S.knob.x - k0;
      {
        const nDet = 360 / kb.clickDeg, th = S.knob.x + (act === "knob" ? wig : 0);
        oven.knobSpin.rotation.z = th - 0.55 / nDet * Math.sin(nDet * th);
      }
      if (st === "bake" && live) {
        S.b = clamp(S.b + Math.abs(dK) / (TAU * kb.turns), 0, 1);
        S.knobClick += Math.abs(dK);
        if (S.knobClick >= kb.clickDeg * DEG) {
          S.knobClick = 0;
          sound("click", 0.7, 0.7);
        }
        const pf = Math.floor(S.b * 4);
        if (pf > S.puffs && pf < 4) {
          S.puffs = pf;
          sound("puff", 0.9, 0.9 + 0.1 * pf);
          S.sq.v -= 0.9;
        }
        if (S.b >= 1) {
          S.knobAuto = 0;
          sound("ding");
          S.sq.v -= 1.2;
          finishStage();
        }
      }
      {
        const goal = st === "bake" && live ? clamp(Math.abs(S.knob.v) / 6, 0, 1) : 0;
        S.heat += (goal - S.heat) * Math.min(1, dt * (goal > S.heat ? 6 : 1));
        const gI = (st === "bake" && live ? 0.2 : 0) + 0.8 * S.heat;
        S.glowI += (gI - S.glowI) * Math.min(1, dt * 5);
        oven.bodyMat.emissiveIntensity = 1.6 * S.glowI;
        M.glass.emissiveIntensity = 0.3 * S.glowI;
        loops.oven.level = S.heat;
        loops.oven.rate = 0.8 + 0.6 * S.b;
      }
      if (st === "wobble" && tap === "souffle") {
        let wx = 0.7, wz = -0.7;
        if (input.grabPoint) {
          cart.soufflePivot.getWorldPosition(v1);
          const ax = v1.x - input.grabPoint.x, az = v1.z - input.grabPoint.z, al = Math.hypot(ax, az);
          if (al > 1e-4) {
            wx = ax / al;
            wz = az / al;
          }
        }
        const cy = Math.cos(cart.serveYaw), sy = Math.sin(cart.serveYaw);
        S.wobX.v += (wx * cy + wz * sy) * 0.11;
        S.wobZ.v += (-wx * sy + wz * cy) * 0.11;
        S.sq.v += 2.2;
        S.taps += 1;
        sound("wobble", 1, 0.9 + S.taps * 0.08);
        if (S.taps >= 3) finishStage();
      }
      if (act === "souffle" && wigStart) {
        S.wobX.v += 0.035;
        S.sq.v += 0.5;
      }
      if (st === "finale") {
        S.idleJig += dt;
        if (S.idleJig > 2.6) {
          S.idleJig = 0;
          S.wobZ.v += 0.03;
          S.sq.v += 0.5;
        }
      }
      {
        const w0 = Math.sqrt(sf.wobK), z = sf.wobC / (2 * w0);
        springTo(S.wobX, 0, w0, z, dt);
        springTo(S.wobZ, 0, w0, z, dt);
        springTo(S.sq, 0, 17, 0.2, dt);
        S.sq.x = clamp(S.sq.x, -0.2, 0.3);
      }
      const top = cart.info.top;
      if (st === "scoop") {
        if (!S.ready) {
          S.spoonIn = Math.min(1, S.spoonIn + dt / 0.7);
          if (S.spoonIn >= 1 && live) makeReady();
        }
        if (live) {
          if (held("spoon")) S.dGoal = clamp(S.dGoal + Math.max(0, -dpy) / 150, 0, 1);
          if (tap === "spoon") S.dGoal = clamp(S.dGoal + 0.34, 0, 1);
          S.d += (S.dGoal - S.d) * Math.min(1, dt * 8);
          if (S.d > 0.98 && S.scoopU < 0) {
            S.d = 1;
            S.dGoal = 1;
            S.scoopU = 0;
            sound("scoop");
            S.sq.v -= 0.8;
          }
        }
      }
      if (S.scoopU >= 0) {
        S.scoopU = Math.min(1, S.scoopU + dt / 1.1);
        if (S.scoopU > 0.4 && st === "scoop") finishStage();
      }
      if (cart.spoon.visible) {
        const a = ease(S.spoonIn), dE = S.d * S.d * (3 - 2 * S.d), u = S.scoopU < 0 ? 0 : ease(S.scoopU);
        const px = 0.014, py = top - 0.017, pz = 0.018;
        let x = lerp(0.046, px, dE), y = lerp(top + 0.05, py, dE), z = lerp(0.036, pz, dE);
        x += (1 - a) * 0.22;
        y += (1 - a) * 0.12;
        z += (1 - a) * 0.06;
        x += 0.05 * u - 0.014 * Math.sin(Math.PI * Math.min(1, u * 2));
        y += 0.085 * u;
        z += 0.07 * u;
        cart.spoon.position.set(x, y, z);
        cart.spoon.rotation.set(0.25 * u, -0.6 - 0.25 * u, lerp(0.62, 0.5, dE) - 0.42 * u);
        cart.spoonWiggle.rotation.z = act === "spoon" ? wig : 0;
        cart.bite.visible = S.scoopU > 0.06;
        const cy = Math.cos(cart.serveYaw), sy = Math.sin(cart.serveYaw);
        const dxw = S.scoopU >= 0 ? px : x, dyw = (S.scoopU >= 0 ? py : y) + sf.scoopR - 2e-3, dzw = S.scoopU >= 0 ? pz : z;
        S.dentOn = 1;
        S.dentX = dxw * cy + dzw * sy;
        S.dentY = dyw;
        S.dentZ = -dxw * sy + dzw * cy;
        S.inside = S.scoopU < 0 ? 0 : smooth(0, 0.25, S.scoopU);
      }
      sfIn.p = S.p;
      sfIn.b = S.b;
      sfIn.pile = S.pile;
      sfIn.wobX = S.wobX.x;
      sfIn.wobZ = S.wobZ.x;
      sfIn.sq = S.sq.x;
      sfIn.dent = S.dentOn;
      sfIn.dx = S.dentX;
      sfIn.dy = S.dentY;
      sfIn.dz = S.dentZ;
      {
        let dirty = false, i = 0;
        for (const k in sfIn) {
          const v = sfIn[k];
          if (!(Math.abs(v - sfLast[i]) < 1e-6)) dirty = true;
          sfLast[i++] = v;
        }
        if (dirty) cart.updateSouffle(sfIn);
      }
      {
        const brown = smooth(0.35, 1, S.b), U = M.souffleU;
        U.uBake.value.x = crustTex ? brown : 0;
        const useCrust = !!crustTex && brown > 0.5;
        U.uBake.value.y = useCrust ? 1 : 0;
        const bm = useCrust ? crustTex : M.foamTex;
        if (M.souffle.bumpMap !== bm) M.souffle.bumpMap = bm;
        M.souffle.bumpScale = useCrust ? 1.5 * smooth(0.5, 0.85, brown) : 0.8 * (1 - smooth(0.15, 0.5, brown));
        M.souffle.roughness = lerp(0.75, 0.88, brown);
        M.souffle.color.copy(FOAM).lerp(PALE, smooth(0.05, 0.5, S.b));
        if (!crustTex) M.souffle.color.lerp(GOLD, brown);
        U.uScoop.value.set(S.dentX, S.dentY, S.dentZ, S.scoopU >= 0 ? sf.scoopR : 0);
        U.uInside.value.y = S.inside;
      }
      const pulse = 0.5 - 0.5 * Math.cos(S.glowT * TAU / 1.6);
      for (let i = 0; i < targets.length; i++) {
        const id = targets[i].id, mats = glowOf[id], k = id === act && !touching ? 0.35 * pulse : 0;
        for (let j = 0; j < mats.length; j++) {
          mats[j].emissive.copy(GLOW);
          mats[j].emissiveIntensity = k;
        }
      }
      if (act !== "souffle" && S.cartMode === "oven") {
        M.souffle.emissive.copy(HEAT);
        M.souffle.emissiveIntensity = 0.3 * S.glowI;
      }
    }
    function settled() {
      const st = stageName();
      if (st === "whisk") return S.lift.x > 0.93 && S.peakPhase !== 2;
      if (st === "pour") return S.tilt.x < 0.06 && !stream.mesh.visible;
      return true;
    }
    function reset() {
      S = fresh();
      bowl.resetSurface();
      stream.reset();
      cart.spoon.visible = false;
      cart.bite.visible = false;
      sfLast.fill(NaN);
      lastCartS = NaN;
      sfIn.p = 0;
      sfIn.b = 0;
      sfIn.dent = 0;
      cart.place(S.cartS);
      cart.updateSouffle(sfIn);
      M.souffle.bumpMap = M.foamTex;
      startStage(0);
    }
    S = fresh();
    reset();
    const hero = {
      root,
      stages: STAGES.slice(),
      get stage() {
        return stageName();
      },
      get stageIndex() {
        return S.stageIndex;
      },
      get progress() {
        switch (stageName()) {
          case "whisk":
            return S.w;
          case "pour":
            return S.p;
          case "load":
            return S.cartMode === "pour" ? 0 : S.cartU;
          case "close":
            return 1 - S.door.x;
          case "bake":
            return S.b;
          case "open":
            return S.cartMode === "serve" ? 1 : S.door.x * 0.5;
          case "wobble":
            return S.taps / 3;
          case "scoop":
            return S.d;
          default:
            return 1;
        }
      },
      get view() {
        return VIEW[stageName()];
      },
      targets,
      get activeTargetId() {
        return activeId();
      },
      loops,
      update,
      reset,
      onContextRestored() {
      },
      dispose() {
        root.removeFromParent();
        root.traverse((o) => {
          if (o.isInstancedMesh) o.dispose();
        });
        K.owned.forEach((x) => x.dispose && x.dispose());
        K.owned.length = 0;
      },
      getState() {
        return { w: S.w, p: S.p, b: S.b, d: S.d, taps: S.taps, door: S.door.x, tilt: S.tilt.x, lift: S.lift.x, slide: S.slide.x, cart: S.cartMode, ready: S.ready };
      },
      debugSkip() {
        const st = stageName();
        if (S.done || st === "finale") return;
        if (st === "whisk") {
          S.w = 1;
          finishStage();
        } else if (st === "pour") {
          S.p = 1;
          finishStage();
        } else if (st === "load") {
          if (S.cartMode === "pour") cartGo(path.sIn, ct.loadTime, "in");
        } else if (st === "close") S.doorGoal = 0;
        else if (st === "bake") {
          S.b = 1;
          finishStage();
        } else if (st === "open") S.doorGoal = 1;
        else if (st === "wobble") {
          S.taps = 3;
          finishStage();
        } else if (st === "scoop") {
          if (!S.ready) {
            S.spoonIn = 1;
            makeReady();
          }
          S.dGoal = 1;
        }
      }
    };
    return hero;
  }
  return __toCommonJS(hero_exports);
})();
