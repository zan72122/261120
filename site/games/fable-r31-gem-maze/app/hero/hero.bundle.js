/* 生成物: node tools/build.mjs --hero で app/hero/hero.js から作る。手で編集しない。 */
var GemHero = (() => {
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
  var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

  // app/hero/hero.js
  var hero_exports = {};
  __export(hero_exports, {
    createHero: () => createHero
  });

  // app/hero/params.js
  var DEG = Math.PI / 180;
  var P = {
    G: [0, 1.75, 0],
    // ジンバル中心（ワールド）
    s: 0.42,
    // レール格子の間隔
    h: 0.56,
    // 立方体の骨組みの半辺
    ring: {
      R: [1.44, 1.26, 1.08],
      // 外・中・内リングの中心線半径
      t: [0.065, 0.06, 0.055],
      // 管の半径
      band: 0.09,
      // ヒット代理の管半径（幅 0.18 ≈ 44px）
      colors: [16735386, 16761375, 3131296],
      // 外：ピンク、中：きいろ、内：ミント
      stud: { count: [16, 12, 12], r: 0.022 },
      // 前後の面の飾り鋲（外周はローラーが通るので付けない）
      grip: [0, 0.085, 0.08],
      // 中・内リングの握り玉（＝軸受け）の半径
      handle: { angle: 45 * DEG, stem: 0.05, ball: 0.07 },
      // 外リングの正面ハンドル
      pin: 0.028
      // リングどうしをつなぐピンの半径
    },
    roller: { r: 0.12, angle: 33 * DEG, flange: 0.03, halfWidth: 0.078 },
    // 溝の底の半径 r、底からの角度
    base: { rBottom: 0.99, rSide: 1.02, rTop: 0.965, height: 0.18 },
    tray: { r0: 0.78, r1: 0.985, yLow: 0.2, yHigh: 0.37, halfArc: 37 * DEG, lampGap: 0.2, lampR: 0.06 },
    frame: { bar: 0.02, corner: 0.036 },
    rail: { r: 0.019, hub: 0.036, glowR: 0.046 },
    gem: { r: 0.075, colors: [16727423, 4033535, 3135098, 16758048, 10837247, 2281440] },
    // 切替：ノブ → 中間歯車 → 回転台。θ_t = θ_k·z_k/z_t、θ_i = −θ_k·z_k/z_i
    gear: {
      zk: 12,
      zi: 10,
      zt: 24,
      m: 0.02,
      pressure: 20 * DEG,
      thickness: 0.03,
      knobDir: -45 * DEG,
      // 回転台から見たノブの方向（前面の右下の角）
      knobDist: 0.552,
      // 回転台の中心からノブの軸まで（≤ 歯車の中心距離の和 0.56）
      ringInner: 0.185
      // 回転台の歯車は輪（内側が抜けている）
    },
    knob: { r: 0.105, wing: 0.27, lift: 0.1, hit: 0.2, tapTime: 0.6, color: 10189823 },
    chest: { size: 0.3, bodyTop: 0.06, lidRise: 0.09, open: 110 * DEG, openTime: 0.45, funnel: 0.058, color: 9399014, lidColor: 11635967 },
    // 宝石の運動（レールに拘束）
    phys: {
      A: 3,
      // 加速度 = A·(g·e) − μ
      mu: 0.4,
      vMax: 1.4,
      vMin: 0.22,
      // 辺の途中では止まらない（必ず次のノードまで進む）
      thr: 0.72,
      // g·e がこれを超えたら動き出す（> cos45° なので向きは常に 1 つに決まる）
      cMin: 0.3,
      // 辺に乗ったあとの最小の駆動（重力が横を向いても惰性で進む）
      keepStraight: 0.92,
      // ノードをまっすぐ通るときの速度の倍率
      keepTurn: 0.8,
      // 曲がるとき
      clear: 0.4,
      // 出発した宝石が辺のこの割合まで進むと、後ろの宝石がそのノードへ入れる
      sinkAt: 0.6,
      goneAt: 0.86
      // 宝箱へ入る辺：縮み始める位置／回収の位置
    },
    // 回し方（HERO-SPEC §4）
    rotor: {
      follow: 14,
      settle: 5,
      maxW: 2.5,
      coast: 3,
      settleBelow: 0.6,
      autoW: 1,
      reverseGap: 0.5,
      commit: 0.26,
      // つかんだ刻みからこれ以上（約 15°）回して離すと、その向きの次の刻みへ進む。0 で無効（最寄りだけ）
      farSide: 0.5
      // つかんだ点が球の奥（(p−C)·レイ > farSide·R）なら向こう側の交点で追う。0 で無効（§4 そのまま）
    },
    hint: { glowLo: 0.1, glowHi: 0.6, wiggle: 4 * DEG, after: 2 },
    finale: { minWait: 0.9, show: 2.3, orbitY: 0.8, orbitR: 0.36, orbitW: 1.2 }
  };
  var TAU = Math.PI * 2;
  var QUARTER = Math.PI / 2;

  // app/hero/maze.js
  var CENTER = 13;
  var DIR_VEC = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  var MOVE_KNOB = 6;
  var MOVE_IDS = ["ring-outer", "ring-middle", "ring-inner", "knob"];
  var nodeIndex = (i, j, k) => i + 3 * j + 9 * k;
  var nodeCoord = (n) => [n % 3, (n / 3 | 0) % 3, n / 9 | 0];
  function neighbor(n, d) {
    const c = nodeCoord(n), v = DIR_VEC[d];
    const i = c[0] + v[0], j = c[1] + v[1], k = c[2] + v[2];
    if (i < 0 || i > 2 || j < 0 || j > 2 || k < 0 || k > 2) return -1;
    return nodeIndex(i, j, k);
  }
  var edgeKey = (a, axis) => a * 3 + axis;
  var edgeOfKey = (key) => {
    const a = key / 3 | 0, axis = key % 3;
    return { a, axis, b: neighbor(a, axis * 2) };
  };
  var RZ = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
  var RX = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
  var RY = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
  var I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function mul(A, B) {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r][c] = A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c];
    return C;
  }
  function pow(M, n) {
    let R = I3;
    for (let i = 0; i < (n & 3); i++) R = mul(R, M);
    return R;
  }
  function dirOf(x, y, z) {
    return x > 0 ? 0 : x < 0 ? 1 : y > 0 ? 2 : y < 0 ? 3 : z > 0 ? 4 : 5;
  }
  var poseIndex = (a, b, c) => (a & 3) + 4 * (b & 3) + 16 * (c & 3);
  var poseAngles = (p) => [p & 3, p >> 2 & 3, p >> 4 & 3];
  var POSE_GRAV = new Uint8Array(64);
  var POSE_FRONT = new Uint8Array(64);
  var POSE_MOVE = new Uint8Array(64 * 6);
  for (let p = 0; p < 64; p++) {
    const [a, b, c] = poseAngles(p);
    const R = mul(mul(pow(RZ, a), pow(RX, b)), pow(RY, c));
    POSE_GRAV[p] = dirOf(-R[1][0], -R[1][1], -R[1][2]);
    POSE_FRONT[p] = dirOf(R[2][0], R[2][1], R[2][2]);
    const ang = [a, b, c];
    for (let m = 0; m < 6; m++) {
      const q = ang.slice();
      q[m >> 1] += m & 1 ? -1 : 1;
      POSE_MOVE[p * 6 + m] = poseIndex(q[0], q[1], q[2]);
    }
  }
  function compileLayout(def) {
    const sw = def.switch;
    const planeAxes = [0, 1, 2].filter((x) => x !== sw.axis);
    const next = [new Int8Array(162).fill(-1), new Int8Array(162).fill(-1)];
    const hasNode = new Uint8Array(27);
    const edges = [];
    for (const key of def.edges) {
      const { a, axis, b } = edgeOfKey(key);
      if (b < 0) continue;
      let gate = -1;
      if ((a === sw.node || b === sw.node) && axis !== sw.axis) gate = planeAxes.indexOf(axis);
      edges.push({ key, a, b, axis, gate });
      hasNode[a] = hasNode[b] = 1;
      for (let s = 0; s < 2; s++) {
        if (gate >= 0 && gate !== s) continue;
        next[s][a * 6 + axis * 2] = b;
        next[s][b * 6 + axis * 2 + 1] = a;
      }
    }
    const nodes = [];
    for (let n = 0; n < 27; n++) if (hasNode[n] && n !== CENTER) nodes.push(n);
    return { def, name: def.name, next, hasNode, nodes, edges, switchNode: sw.node, switchAxis: sw.axis, planeAxes, knobFace: def.knobFace };
  }
  var _ord = [];
  function slide(L, gems, d, sw, paths) {
    const nx = L.next[sw];
    const v = DIR_VEC[d];
    const out = gems.slice();
    _ord.length = 0;
    for (let i = 0; i < gems.length; i++) if (gems[i] >= 0) _ord.push(i);
    _ord.sort((x, y) => {
      const cx = nodeCoord(gems[x]), cy = nodeCoord(gems[y]);
      return cy[0] * v[0] + cy[1] * v[1] + cy[2] * v[2] - (cx[0] * v[0] + cx[1] * v[1] + cx[2] * v[2]);
    });
    for (const i of _ord) {
      let n = out[i];
      const path = paths ? paths[i] = [n] : null;
      for (; ; ) {
        const m = nx[n * 6 + d];
        if (m < 0) break;
        if (m === CENTER) {
          n = -1;
          if (path) path.push(CENTER);
          break;
        }
        let occupied = false;
        for (let j = 0; j < out.length; j++) if (j !== i && out[j] === m) {
          occupied = true;
          break;
        }
        if (occupied) break;
        n = m;
        out[i] = n;
        if (path) path.push(n);
      }
      out[i] = n;
    }
    return out;
  }
  var knobUsable = (L, pose) => POSE_FRONT[pose] === L.knobFace;
  function applyMove(L, st, m, paths) {
    let pose = st.pose, sw = st.sw;
    if (m === MOVE_KNOB) {
      if (!knobUsable(L, pose)) return null;
      sw ^= 1;
    } else pose = POSE_MOVE[pose * 6 + m];
    return { pose, sw, gems: slide(L, st.gems, POSE_GRAV[pose], sw, paths) };
  }
  var _sorted = [];
  function stateKey(st) {
    _sorted.length = 0;
    for (const g of st.gems) if (g >= 0) _sorted.push(g);
    _sorted.sort((x, y) => x - y);
    let k = st.pose * 2 + st.sw;
    for (let i = 0; i < 6; i++) k = k * 32 + (i < _sorted.length ? _sorted[i] : 31);
    return k;
  }
  var remaining = (gems) => {
    let c = 0;
    for (const g of gems) if (g >= 0) c++;
    return c;
  };
  function findPlan(L, st, maxStates = 6e3, maxDepth = 12) {
    const start = remaining(st.gems);
    if (start === 0) return null;
    const seen = /* @__PURE__ */ new Set([stateKey(st)]);
    let frontier = [{ st, first: -1, prev: null, move: -1 }];
    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
      const nextFrontier = [];
      for (const node of frontier) {
        for (let m = 0; m <= MOVE_KNOB; m++) {
          const ns = applyMove(L, node.st, m);
          if (!ns) continue;
          const child = { st: ns, prev: node, move: m };
          if (remaining(ns.gems) < start) {
            const moves = [];
            for (let x = child; x.prev; x = x.prev) moves.unshift(x.move);
            return { moves, states: seen.size };
          }
          const key = stateKey(ns);
          if (seen.has(key)) continue;
          seen.add(key);
          if (seen.size > maxStates) return null;
          nextFrontier.push(child);
        }
      }
      frontier = nextFrontier;
    }
    return null;
  }
  function tracePlan(L, st, moves) {
    const segs = [], collected = [];
    let cur = st;
    moves.forEach((m, step) => {
      const paths = [];
      const ns = applyMove(L, cur, m, paths);
      if (!ns) return;
      paths.forEach((p, gem) => {
        if (!p) return;
        for (let i = 1; i < p.length; i++) segs.push({ from: p[i - 1], to: p[i], gem, step });
        if (p[p.length - 1] === CENTER) collected.push(gem);
      });
      cur = ns;
    });
    return { segs, collected };
  }
  function checkAnyState(L) {
    const N = 27 * 64 * 2, GOAL = N;
    const id = (n, pose, sw) => (n * 64 + pose) * 2 + sw;
    const rev = Array.from({ length: N + 1 }, () => []);
    const one = [0];
    for (const n of L.nodes) for (let pose = 0; pose < 64; pose++) for (let sw = 0; sw < 2; sw++) {
      const from = id(n, pose, sw);
      for (let m = 0; m <= MOVE_KNOB; m++) {
        one[0] = n;
        const ns = applyMove(L, { pose, sw, gems: one }, m);
        if (!ns) continue;
        const to = ns.gems[0] < 0 ? GOAL : id(ns.gems[0], ns.pose, ns.sw);
        if (to !== from) rev[to].push(from);
      }
    }
    const dist = new Int16Array(N + 1).fill(-1);
    dist[GOAL] = 0;
    let q = [GOAL], worst = 0;
    while (q.length) {
      const nq = [];
      for (const x of q) for (const y of rev[x]) if (dist[y] < 0) {
        dist[y] = dist[x] + 1;
        worst = Math.max(worst, dist[y]);
        nq.push(y);
      }
      q = nq;
    }
    let bad = 0;
    for (const n of L.nodes) for (let pose = 0; pose < 64; pose++) for (let sw = 0; sw < 2; sw++) if (dist[id(n, pose, sw)] < 0) bad++;
    return { ok: bad === 0, worst, bad, dist, id };
  }

  // app/hero/layouts.js
  var SWITCH = { node: 22, axis: 2 };
  var KNOB_FACE = 4;
  var LAYOUTS = [
    {
      name: "s1-1923",
      edges: [1, 2, 3, 4, 5, 7, 8, 10, 11, 13, 14, 16, 21, 26, 27, 31, 36, 39, 41, 43, 44, 45, 47, 48, 50, 54, 58, 63, 64, 66, 70, 72, 75],
      starts: { 3: [[10, 12, 19], [2, 12, 19]], 4: [[0, 12, 15, 18], [9, 14, 16, 18]], 5: [[9, 11, 12, 14, 19], [9, 12, 14, 19, 23]], 6: [[2, 12, 14, 16, 18, 25], [9, 10, 12, 15, 18, 25]] }
      // ヒントどおりの手順（0,1=外± 2,3=中± 4,5=内± 6=ノブ）: 3個 1162 / 11620030、4個 1005504462 / 0001620030、5個 000162112 / 000162231、6個 0000050040000162 / 11016223112
    },
    {
      name: "s1-3852",
      edges: [2, 4, 5, 10, 14, 16, 17, 18, 20, 21, 26, 27, 31, 34, 36, 37, 38, 39, 41, 43, 45, 48, 53, 54, 58, 63, 64, 66, 72, 75],
      starts: { 3: [[12, 16, 19], [12, 16, 18]], 4: [[5, 12, 18, 23], [7, 12, 18, 22]], 5: [[1, 9, 12, 19, 23], [1, 10, 12, 19, 26]], 6: [[7, 10, 12, 16, 19, 25], [0, 1, 7, 9, 12, 18]] }
      // 3個 1162221 / 1162221、4個 14444162 / 1020001362、5個 1131111262 / 113262221、6個 1162221033002000 / 11352462221
    },
    {
      name: "s1-2203",
      edges: [0, 1, 2, 3, 4, 5, 7, 8, 9, 14, 16, 17, 21, 26, 28, 29, 31, 32, 36, 37, 38, 39, 41, 43, 44, 50, 63, 64, 66, 67, 75],
      starts: { 3: [[7, 14, 26], [14, 16, 21]], 4: [[2, 14, 22, 26], [0, 1, 14, 16]], 5: [[7, 14, 22, 23, 25], [2, 14, 19, 21, 26]], 6: [[2, 14, 16, 18, 21, 22], [14, 16, 19, 21, 22, 23]] }
      // 3個 01631131 / 04402262、4個 0440220162 / 0030112163、5個 0444132463 / 0440220162、6個 0440220162214 / 04402204403363
    },
    {
      name: "s1-2813",
      edges: [0, 1, 3, 7, 8, 10, 11, 12, 14, 17, 20, 21, 23, 26, 27, 31, 32, 34, 36, 38, 39, 41, 44, 45, 48, 50, 53, 55, 58, 63, 67, 75],
      starts: { 3: [[10, 12, 25], [7, 11, 12]], 4: [[8, 12, 22, 23], [1, 8, 10, 12]], 5: [[4, 8, 12, 18, 23], [4, 8, 9, 12, 18]], 6: [[0, 7, 10, 12, 19, 22], [0, 1, 8, 10, 11, 12]] }
      // 3個 1111633 / 11165111、4個 155505633 / 111514633、5個 1441155514633 / 11055505633、6個 11231514633 / 1115500505633
    }
  ];
  function layoutForRound(round) {
    const r = Math.max(1, round | 0);
    const index = (r - 1) % LAYOUTS.length;
    const count = Math.min(6, r + 2);
    const sets = LAYOUTS[index].starts[count];
    const variant = Math.floor((r - 1) / LAYOUTS.length) % sets.length;
    return { index, count, starts: sets[variant] };
  }

  // app/hero/geo.js
  var Builder = class {
    constructor(THREE) {
      this.T = THREE;
      this.parts = [[], []];
      this._m = new THREE.Matrix4();
      this._n = new THREE.Matrix3();
      this._v = new THREE.Vector3();
      this._c = new THREE.Color();
    }
    // g：BufferGeometry（この中で dispose する）。matrix：置き場所（null で原点）。color：16 進か [r,g,b]（線形）。
    add(g, matrix, color = 16777215, mat = 0) {
      const v = this._v;
      const src = g.index ? g.toNonIndexed() : g;
      const P2 = src.attributes.position, N = src.attributes.normal, U = src.attributes.uv;
      const part = this.parts[mat];
      const m = matrix || this._m.identity();
      this._n.getNormalMatrix(m);
      const flip = m.determinant() < 0;
      const c = Array.isArray(color) ? color : (this._c.set(color), [this._c.r, this._c.g, this._c.b]);
      const n = P2.count;
      for (let t = 0; t < n; t += 3) {
        for (let k = 0; k < 3; k++) {
          const i = t + (flip ? 2 - k : k);
          v.fromBufferAttribute(P2, i).applyMatrix4(m);
          part.push(v.x, v.y, v.z);
          if (N) {
            v.fromBufferAttribute(N, i).applyMatrix3(this._n);
            const l = v.length();
            if (l > 1e-9) v.multiplyScalar(1 / l);
            else v.set(0, 1, 0);
          } else v.set(0, 1, 0);
          part.push(v.x, v.y, v.z);
          part.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
          part.push(c[0], c[1], c[2]);
        }
      }
      if (src !== g) src.dispose();
      g.dispose();
      return this;
    }
    // 位置と向きを作る小道具
    at(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
      const T = this.T;
      return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
    }
    // a → b の向きに Y 軸の形（Cylinder など）を置く行列。長さで Y を伸ばす（unit=true のとき形の高さは 1）。
    along(a, b, unit = true) {
      const T = this.T;
      const d = new T.Vector3().subVectors(b, a), len = d.length();
      const q = new T.Quaternion();
      if (len > 1e-9) q.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().multiplyScalar(1 / len));
      return new T.Matrix4().compose(new T.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new T.Vector3(1, unit ? len : 1, 1));
    }
    // 棒（a→b、半径 r、seg 角形、両端はふたなし）
    rod(a, b, r, seg, color, mat = 0) {
      return this.add(new this.T.CylinderGeometry(r, r, 1, seg, 1, true), this.along(a, b), color, mat);
    }
    ball(p, r, color, mat = 0, w = 8, h = 6, sx = 1, sy = 1, sz = 1) {
      return this.add(new this.T.SphereGeometry(r, w, h), this.at(p.x, p.y, p.z, 0, 0, 0, sx, sy, sz), color, mat);
    }
    build() {
      const T = this.T;
      const total = this.parts[0].length + this.parts[1].length;
      const n = total / 11;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
      let o = 0;
      const g = new T.BufferGeometry();
      this.parts.forEach((part, mi) => {
        const start = o;
        for (let i = 0; i < part.length; i += 11, o++) {
          pos[o * 3] = part[i];
          pos[o * 3 + 1] = part[i + 1];
          pos[o * 3 + 2] = part[i + 2];
          nor[o * 3] = part[i + 3];
          nor[o * 3 + 1] = part[i + 4];
          nor[o * 3 + 2] = part[i + 5];
          uv[o * 2] = part[i + 6];
          uv[o * 2 + 1] = part[i + 7];
          col[o * 3] = part[i + 8];
          col[o * 3 + 1] = part[i + 9];
          col[o * 3 + 2] = part[i + 10];
        }
        if (o > start && this.parts[1].length) g.addGroup(start, o - start, mi);
      });
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setAttribute("normal", new T.BufferAttribute(nor, 3));
      g.setAttribute("uv", new T.BufferAttribute(uv, 2));
      g.setAttribute("color", new T.BufferAttribute(col, 3));
      g.computeBoundingSphere();
      return g;
    }
  };
  function gearGeometry(THREE, { z, m, alpha, thickness, bore, samples = 3 }) {
    const rp = m * z / 2, ra = rp + m, rf = Math.max(rp - 1.25 * m, bore + m * 0.4), rb = rp * Math.cos(alpha);
    const inv = (x) => Math.tan(x) - x;
    const beta = (r) => {
      const c = Math.min(1, rb / r);
      return Math.PI / (2 * z) + inv(alpha) - inv(Math.acos(c));
    };
    const r0 = Math.max(rf, rb);
    const outline = [];
    const pitch = 2 * Math.PI / z;
    for (let k = 0; k < z; k++) {
      const c = k * pitch;
      const pts = [];
      pts.push([rf, -Math.min(pitch / 2 * 0.98, beta(r0) + (r0 - rf) * 0.25 / rf + 0.012)]);
      for (let j = 0; j <= samples; j++) {
        const r = r0 + (ra - r0) * (j / samples);
        pts.push([r, -Math.max(beta(r), 4e-3)]);
      }
      for (const [r, a] of pts) outline.push([r, c + a]);
      for (let i = pts.length - 1; i >= 0; i--) outline.push([pts[i][0], c - pts[i][1]]);
    }
    const n = outline.length, hz = thickness / 2;
    const pos = [], nor = [], uv = [];
    const P2 = (r, a, zz) => [r * Math.cos(a), r * Math.sin(a), zz];
    const tri = (a, b, c, nx, ny, nz) => {
      for (const p of [a, b, c]) {
        pos.push(p[0], p[1], p[2]);
        nor.push(nx, ny, nz);
        uv.push(p[0] / (2 * ra) + 0.5, p[1] / (2 * ra) + 0.5);
      }
    };
    for (let i = 0; i < n; i++) {
      const [r1, a1] = outline[i], [r2, a2raw] = outline[(i + 1) % n];
      const a2 = i === n - 1 ? a2raw + 2 * Math.PI : a2raw;
      tri(P2(bore, a1, hz), P2(r1, a1, hz), P2(r2, a2, hz), 0, 0, 1);
      tri(P2(bore, a1, hz), P2(r2, a2, hz), P2(bore, a2, hz), 0, 0, 1);
      tri(P2(bore, a1, -hz), P2(r2, a2, -hz), P2(r1, a1, -hz), 0, 0, -1);
      tri(P2(bore, a1, -hz), P2(bore, a2, -hz), P2(r2, a2, -hz), 0, 0, -1);
      const p1 = P2(r1, a1, 0), p2 = P2(r2, a2, 0);
      let nx = p2[1] - p1[1], ny = -(p2[0] - p1[0]);
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      tri(P2(r1, a1, -hz), P2(r2, a2, -hz), P2(r2, a2, hz), nx, ny, 0);
      tri(P2(r1, a1, -hz), P2(r2, a2, hz), P2(r1, a1, hz), nx, ny, 0);
      const am = (a1 + a2) / 2;
      tri(P2(bore, a1, -hz), P2(bore, a2, hz), P2(bore, a2, -hz), -Math.cos(am), -Math.sin(am), 0);
      tri(P2(bore, a1, -hz), P2(bore, a1, hz), P2(bore, a2, hz), -Math.cos(am), -Math.sin(am), 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  function meshPhase(zA, thetaA, zB, dir) {
    return dir + Math.PI - 2 * Math.PI / zB * (0.5 - (dir - thetaA) * zA / (2 * Math.PI));
  }
  function gemGeometry(THREE, r, sides = 8) {
    const rings = [[0, r, 0], [r * 0.5, r * 0.72, 0.5], [r * 0.82, r * 0.4, 0]];
    const pos = [];
    for (const sgn of [1, -1]) {
      const pt = ([x, rad, off], k) => {
        const a = (k + off) * 2 * Math.PI / sides;
        return [sgn * x, rad * Math.cos(a), rad * Math.sin(a)];
      };
      const tri = (a, b, c2) => {
        for (const p of sgn > 0 ? [a, b, c2] : [a, c2, b]) pos.push(p[0], p[1], p[2]);
      };
      for (let j = 0; j < rings.length - 1; j++) {
        const L = rings[j], U = rings[j + 1];
        for (let k = 0; k < sides; k++) {
          if (U[2] > L[2]) {
            tri(pt(L, k), pt(L, k + 1), pt(U, k));
            tri(pt(U, k + 1), pt(U, k), pt(L, k + 1));
          } else {
            tri(pt(L, k), pt(L, k + 1), pt(U, k + 1));
            tri(pt(U, k + 1), pt(U, k), pt(L, k));
          }
        }
      }
      const top = rings[rings.length - 1], c = [sgn * (top[0] + r * 0.03), 0, 0];
      for (let k = 0; k < sides; k++) tri(c, pt(top, k), pt(top, k + 1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const uv = new Float32Array(pos.length / 3 * 2);
    for (let i = 0; i < pos.length / 3; i++) {
      uv[i * 2] = pos[i * 3 + 1] / (2 * r) + 0.5;
      uv[i * 2 + 1] = pos[i * 3 + 2] / (2 * r) + 0.5;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return g;
  }
  function arcSweepGeometry(THREE, section, halfArc, segs) {
    const pos = [], uv = [];
    const P2 = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
    const quad = (a, b, c, d) => {
      for (const p of [a, b, c, a, c, d]) pos.push(p[0], p[1], p[2]);
    };
    const n = section.length;
    for (let i = 0; i < segs; i++) {
      const a0 = -halfArc + 2 * halfArc * i / segs, a1 = -halfArc + 2 * halfArc * (i + 1) / segs;
      for (let k = 0; k < n; k++) {
        const [r0, y0] = section[k], [r1, y1] = section[(k + 1) % n];
        quad(P2(r0, y0, a0), P2(r0, y0, a1), P2(r1, y1, a1), P2(r1, y1, a0));
      }
    }
    for (const [a, flip] of [[-halfArc, false], [halfArc, true]]) {
      for (let k = 1; k < n - 1; k++) {
        const p0 = P2(section[0][0], section[0][1], a), p1 = P2(section[k][0], section[k][1], a), p2 = P2(section[k + 1][0], section[k + 1][1], a);
        for (const p of flip ? [p0, p1, p2] : [p0, p2, p1]) pos.push(p[0], p[1], p[2]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] * 0.6 + 0.5, pos[i + 2] * 0.6 + pos[i + 1]);
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  function archGeometry(THREE, chord, rise, width, segs) {
    const rho = (chord * chord / 4 + rise * rise) / (2 * rise), cy = rise - rho, half = Math.asin(Math.min(1, chord / (2 * rho)));
    const prof = [];
    for (let i = 0; i <= segs; i++) {
      const a = -half + 2 * half * i / segs;
      prof.push([rho * Math.sin(a), cy + rho * Math.cos(a)]);
    }
    const pos = [], nor = [], uv = [], hx = width / 2;
    const push = (x, y, z, nx, ny, nz, u, v) => {
      pos.push(x, y, z);
      nor.push(nx, ny, nz);
      uv.push(u, v);
    };
    for (let i = 0; i < segs; i++) {
      const [z0, y0] = prof[i], [z1, y1] = prof[i + 1];
      const n0 = [(y0 - cy) / rho, z0 / rho], n1 = [(y1 - cy) / rho, z1 / rho];
      push(-hx, y0, z0, 0, n0[0], n0[1], 0, i / segs);
      push(hx, y0, z0, 0, n0[0], n0[1], 1, i / segs);
      push(hx, y1, z1, 0, n1[0], n1[1], 1, (i + 1) / segs);
      push(-hx, y0, z0, 0, n0[0], n0[1], 0, i / segs);
      push(hx, y1, z1, 0, n1[0], n1[1], 1, (i + 1) / segs);
      push(-hx, y1, z1, 0, n1[0], n1[1], 0, (i + 1) / segs);
      push(hx, 0, z0, 1, 0, 0, 0, 0);
      push(hx, y1, z1, 1, 0, 0, 0, 0);
      push(hx, y0, z0, 1, 0, 0, 0, 0);
      push(hx, 0, z0, 1, 0, 0, 0, 0);
      push(hx, 0, z1, 1, 0, 0, 0, 0);
      push(hx, y1, z1, 1, 0, 0, 0, 0);
      push(-hx, 0, z0, -1, 0, 0, 0, 0);
      push(-hx, y0, z0, -1, 0, 0, 0, 0);
      push(-hx, y1, z1, -1, 0, 0, 0, 0);
      push(-hx, 0, z0, -1, 0, 0, 0, 0);
      push(-hx, y1, z1, -1, 0, 0, 0, 0);
      push(-hx, 0, z1, -1, 0, 0, 0, 0);
    }
    const zA = prof[0][0], zB = prof[segs][0];
    push(-hx, 0, zA, 0, -1, 0, 0, 0);
    push(hx, 0, zB, 0, -1, 0, 1, 1);
    push(hx, 0, zA, 0, -1, 0, 1, 0);
    push(-hx, 0, zA, 0, -1, 0, 0, 0);
    push(-hx, 0, zB, 0, -1, 0, 0, 1);
    push(hx, 0, zB, 0, -1, 0, 1, 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }

  // app/hero/parts.js
  var WHITE = 16774890;
  var PEARL = 16777215;
  var GOLD = [1.5, 1.38, 1.15];
  var ROSE = [1.7, 1, 0.95];
  var SILVER = 14083839;
  var HUB = 16762970;
  function makeMaterials(THREE, opts, keep) {
    const brassTex = opts.getTexture("brass_ring");
    const m = {};
    m.brass = keep(new THREE.MeshStandardMaterial({ map: brassTex, vertexColors: true, metalness: 0.7, roughness: 0.34 }));
    m.enamel = keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.3 }));
    m.steel = keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.22 }));
    const lit = (c) => new THREE.Color(c).lerp(new THREE.Color(16777215), 0.35);
    m.rings = P.ring.colors.map((c) => keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.28, emissive: lit(c), emissiveIntensity: 0 })));
    m.knob = keep(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.2, roughness: 0.28, emissive: lit(P.knob.color), emissiveIntensity: 0 }));
    m.wood = keep(new THREE.MeshStandardMaterial({ map: opts.getTexture("wood_table"), color: 16771798, roughness: 0.7, metalness: 0 }));
    m.gem = keep(new THREE.MeshStandardMaterial({ color: 16777215, metalness: 0.5, roughness: 0.1, envMapIntensity: 1.7 }));
    m.lamp = keep(new THREE.MeshStandardMaterial({ color: 16777215, metalness: 0, roughness: 0.18 }));
    const gemTex = opts.getTexture("gem_facets");
    m.treasure = keep(new THREE.MeshStandardMaterial({ map: gemTex, emissive: 16777215, emissiveMap: gemTex, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.25 }));
    m.hit = keep(new THREE.MeshBasicMaterial({ visible: false }));
    m.glow = keep(new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(1, 0.8, 0.3) } },
      vertexShader: `
      attribute vec2 aGlow;
      varying vec2 vGlow; varying vec3 vN; varying vec3 vV;
      void main() {
        vGlow = aGlow;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalMatrix * normal; vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
      fragmentShader: `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vGlow; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN + vec3(0.0, 0.0, 1e-5)), normalize(vV + vec3(0.0, 0.0, 1e-5))));
        float core = pow(max(facing, 1e-4), 1.2);
        float wave = 0.5 + 0.5 * sin(6.2832 * (vGlow.y * 0.75 - uTime * 1.3));
        float a = clamp(vGlow.x, 0.0, 1.5) * core * (0.4 + 0.6 * wave * wave);
        gl_FragColor = vec4(uColor, a);
      }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }));
    m.beam = keep(new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(1, 0.9, 0.55) } },
      vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalMatrix * normal; vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
      fragmentShader: `
      uniform float uAlpha; uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = abs(dot(normalize(vN + vec3(0.0, 0.0, 1e-5)), normalize(vV + vec3(0.0, 0.0, 1e-5))));
        float fade = pow(max(1.0 - vUv.y, 1e-4), 1.4);
        float rays = 0.75 + 0.25 * sin(vUv.x * 62.83 + uTime * 1.5);
        gl_FragColor = vec4(uColor, uAlpha * fade * rays * (0.25 + 0.75 * facing));
      }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }));
    const N = 32, data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1, d = Math.hypot(dx, dy);
      const soft = Math.max(0, 1 - d) ** 2.2, cross = Math.max(0, 1 - Math.min(Math.abs(dx), Math.abs(dy)) * 9) * Math.max(0, 1 - d);
      const a = Math.min(1, soft + cross * 0.9), o = (y * N + x) * 4;
      data[o] = 255;
      data[o + 1] = 250;
      data[o + 2] = 235;
      data[o + 3] = Math.round(a * 255);
    }
    m.sparkTex = keep(new THREE.DataTexture(data, N, N, THREE.RGBAFormat));
    m.sparkTex.colorSpace = THREE.SRGBColorSpace;
    m.sparkTex.magFilter = THREE.LinearFilter;
    m.sparkTex.minFilter = THREE.LinearFilter;
    m.sparkTex.needsUpdate = true;
    m.spark = keep(new THREE.PointsMaterial({ map: m.sparkTex, size: 0.21, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true }));
    return m;
  }
  function makeFinaleFx(THREE, mats, low) {
    const c = P.chest, F = P.finale;
    const h = F.orbitY + 0.25 - c.bodyTop;
    const beamGeo = new THREE.CylinderGeometry(F.orbitR * 1.15, c.size * 0.36, h, low ? 14 : 24, 1, true);
    const beam = new THREE.Mesh(beamGeo, mats.beam);
    beam.position.y = c.bodyTop + h / 2;
    beam.visible = false;
    beam.renderOrder = 6;
    const count = low ? 28 : 48;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const col = new Float32Array(count * 3), tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      tmp.set(P.gem.colors[i % 6]).lerp(new THREE.Color(16777215), 0.45);
      col[i * 3] = tmp.r;
      col[i * 3 + 1] = tmp.g;
      col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const sparks = new THREE.Points(geo, mats.spark);
    sparks.visible = false;
    sparks.frustumCulled = false;
    sparks.renderOrder = 7;
    const seeds = [];
    for (let i = 0; i < count; i++) {
      const a = i * 2.399963, u = i * 0.618034 % 1;
      seeds.push({ a, out: 0.18 + 0.42 * u, up: 1.5 + 0.9 * (i * 0.381966 % 1), phase: i / count });
    }
    return { beam, sparks, seeds, count };
  }
  function makeBase(THREE, mats, low) {
    const group = new THREE.Group();
    const b = P.base, tr = P.tray, G = P.G;
    const lathe = new THREE.LatheGeometry([
      new THREE.Vector2(1e-3, 0),
      new THREE.Vector2(b.rBottom, 0),
      new THREE.Vector2(b.rSide, 0.025),
      new THREE.Vector2(b.rSide, b.height * 0.72),
      new THREE.Vector2((b.rSide + b.rTop) / 2 + 0.012, b.height * 0.93),
      new THREE.Vector2(b.rTop, b.height),
      new THREE.Vector2(1e-3, b.height)
    ], low ? 36 : 64);
    const section = [[tr.r0, b.height - 0.01], [tr.r1, b.height - 0.01], [tr.r1, tr.yLow], [tr.r0 + 0.045, tr.yHigh], [tr.r0, tr.yHigh]];
    const wood = new Builder(THREE);
    wood.add(lathe, null);
    wood.add(arcSweepGeometry(THREE, section, tr.halfArc, low ? 12 : 22), null);
    const woodGeo = wood.build();
    {
      const p = woodGeo.attributes.position, uv = woodGeo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.48 + 0.5, p.getZ(i) * 0.48 + 0.5 + p.getY(i) * 0.6);
    }
    const woodMesh = new THREE.Mesh(woodGeo, mats.wood);
    group.add(woodMesh);
    const ro = P.roller, R1 = P.ring.R[0], t1 = P.ring.t[0];
    const dist = R1 + t1 + ro.r;
    const rollerPos = [-1, 1].map((sx) => new THREE.Vector3(G[0] + sx * dist * Math.sin(ro.angle), G[1] - dist * Math.cos(ro.angle), G[2]));
    const prof = [new THREE.Vector2(1e-3, -ro.halfWidth), new THREE.Vector2(ro.r + ro.flange, -ro.halfWidth)];
    const gs = low ? 4 : 7, psiMax = Math.acos(1 - ro.flange / t1);
    for (let i = 0; i <= gs; i++) {
      const psi = -psiMax + 2 * psiMax * i / gs;
      prof.push(new THREE.Vector2(ro.r + t1 - t1 * Math.cos(psi), t1 * Math.sin(psi)));
    }
    prof.push(new THREE.Vector2(ro.r + ro.flange, ro.halfWidth), new THREE.Vector2(1e-3, ro.halfWidth));
    const rb = new Builder(THREE);
    rb.add(new THREE.LatheGeometry(prof, low ? 14 : 24), rb.at(0, 0, 0, Math.PI / 2, 0, 0), WHITE);
    for (let k = 0; k < 3; k++) for (const sz of [-1, 1]) {
      const a = k * TAU / 3;
      rb.add(new THREE.CylinderGeometry(0.026, 0.026, 0.012, low ? 8 : 12), rb.at(0.075 * Math.cos(a), 0.075 * Math.sin(a), sz * ro.halfWidth, Math.PI / 2, 0, 0), P.ring.colors[0]);
    }
    const rollers = new THREE.InstancedMesh(rb.build(), mats.enamel, 2);
    rollers.frustumCulled = false;
    group.add(rollers);
    const br = new Builder(THREE);
    for (const c of rollerPos) {
      const top = c.y + 0.05, hgt = top - b.height;
      for (const sz of [-1, 1]) br.add(new THREE.BoxGeometry(0.08, hgt, 0.024), br.at(c.x, b.height + hgt / 2, sz * (ro.halfWidth + 0.02)), GOLD);
      br.add(new THREE.CylinderGeometry(0.024, 0.024, 2 * (ro.halfWidth + 0.045), low ? 8 : 12), br.at(c.x, c.y, 0, Math.PI / 2, 0, 0), GOLD);
      br.add(new THREE.BoxGeometry(0.14, 0.02, 2 * (ro.halfWidth + 0.05)), br.at(c.x, b.height + 0.01, 0), GOLD);
    }
    group.add(new THREE.Mesh(br.build(), mats.brass));
    const dome = new THREE.SphereGeometry(tr.lampR, low ? 10 : 14, low ? 4 : 6, 0, TAU, 0, Math.PI / 2);
    dome.scale(1, 0.75, 1);
    const lamps = new THREE.InstancedMesh(dome, mats.lamp, 6);
    const bezelGeo = new THREE.TorusGeometry(tr.lampR * 1.1, 0.013, low ? 5 : 6, low ? 12 : 18);
    bezelGeo.rotateX(Math.PI / 2);
    const bz = new Builder(THREE);
    bz.add(bezelGeo, null, GOLD);
    const bezels = new THREE.InstancedMesh(bz.build(), mats.brass, 6);
    lamps.frustumCulled = bezels.frustumCulled = false;
    group.add(lamps, bezels);
    const rMid = (tr.r0 + 0.045 + tr.r1) / 2, yMid = (tr.yLow + tr.yHigh) / 2;
    const slope = new THREE.Vector2(tr.yHigh - tr.yLow, tr.r1 - (tr.r0 + 0.045)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    function lampSlot(i, total, pos, quat) {
      const phi = (i - (total - 1) / 2) * tr.lampGap / rMid;
      const n = new THREE.Vector3(slope.x * Math.sin(phi), slope.y, slope.x * Math.cos(phi));
      pos.set(rMid * Math.sin(phi), yMid, rMid * Math.cos(phi)).addScaledVector(n, 4e-3);
      quat.setFromUnitVectors(up, n);
    }
    return { group, rollers, rollerPos, lamps, bezels, lampSlot, instanced: [rollers, lamps, bezels] };
  }
  function makeRing(THREE, i, mats, low) {
    const r = P.ring, R = r.R[i], t = r.t[i], color = r.colors[i];
    const B = new Builder(THREE);
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
    B.add(new THREE.TorusGeometry(R, t, low ? 8 : 14, low ? 64 : 128), null, color, 0);
    const n = r.stud.count[i];
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) * TAU / n;
      for (const sz of [-1, 1]) B.add(new THREE.SphereGeometry(r.stud.r, low ? 6 : 8, low ? 4 : 6), B.at(R * Math.cos(a), R * Math.sin(a), sz * t * 0.82), GOLD, 1);
    }
    const seg = low ? 8 : 12;
    if (i === 0) {
      const a = r.handle.angle, hx = R * Math.cos(a), hy = R * Math.sin(a);
      B.rod(new THREE.Vector3(hx, hy, t * 0.7), new THREE.Vector3(hx, hy, t + r.handle.stem), 0.022, seg, GOLD, 1);
      B.ball(new THREE.Vector3(hx, hy, t + r.handle.stem + r.handle.ball * 0.8), r.handle.ball, PEARL, 0, low ? 10 : 16, low ? 8 : 12);
      for (const sx of [-1, 1]) B.add(new THREE.CylinderGeometry(0.045, 0.045, 0.04, seg), B.at(sx * (R - t - 4e-3), 0, 0, 0, 0, Math.PI / 2), GOLD, 1);
    } else {
      const far = i === 1 ? Y : X, axis = i === 1 ? X : Y;
      const Rout = r.R[i - 1], tout = r.t[i - 1];
      for (const sg of [-1, 1]) {
        const p = far.clone().multiplyScalar(sg * R);
        B.ball(p, r.grip[i], PEARL, 0, low ? 10 : 16, low ? 8 : 12, i === 1 ? 1.3 : 1, i === 1 ? 1 : 1.3, 1);
        B.rod(axis.clone().multiplyScalar(sg * (R + t - 0.012)), axis.clone().multiplyScalar(sg * (Rout - tout + 0.02)), r.pin, seg, GOLD, 1);
      }
    }
    if (i === 2) {
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const d = new THREE.Vector3(sx, sy, 0).normalize();
        B.rod(d.clone().multiplyScalar(P.h * Math.SQRT2), d.clone().multiplyScalar(R - t * 0.5), 0.024, seg, GOLD, 1);
      }
    }
    const mesh = new THREE.Mesh(B.build(), [mats.rings[i], mats.brass]);
    const hitGeo = new THREE.TorusGeometry(R, r.band, 6, low ? 24 : 32);
    hitGeo.rotateZ(0.37);
    hitGeo.rotateX(0.011);
    const hit = new THREE.Mesh(hitGeo, mats.hit);
    return { mesh, hit };
  }
  function gearLayout(THREE) {
    const g = P.gear;
    const dTI = (g.zt + g.zi) * g.m / 2, dIK = (g.zi + g.zk) * g.m / 2;
    const T = new THREE.Vector2(0, 0);
    const u = new THREE.Vector2(Math.cos(g.knobDir), Math.sin(g.knobDir));
    const K = u.clone().multiplyScalar(g.knobDist);
    const a = (dTI * dTI - dIK * dIK + g.knobDist * g.knobDist) / (2 * g.knobDist);
    const hgt = Math.sqrt(Math.max(0, dTI * dTI - a * a));
    const I = u.clone().multiplyScalar(a).add(new THREE.Vector2(-u.y, u.x).multiplyScalar(hgt));
    const dirTI = Math.atan2(I.y - T.y, I.x - T.x), dirIK = Math.atan2(K.y - I.y, K.x - I.x);
    const phaseI = meshPhase(g.zt, 0, g.zi, dirTI);
    const phaseK = meshPhase(g.zi, phaseI, g.zk, dirIK);
    const ra = g.m * g.zt / 2 + g.m;
    return { T, I, K, phaseI, phaseK, ra, z: P.s };
  }
  function makeFrame(THREE, mats, low, GL) {
    const h = P.h, f = P.frame;
    const B = new Builder(THREE);
    const seg = low ? 6 : 8;
    for (let ax = 0; ax < 3; ax++) for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const p0 = [0, 0, 0], p1 = [0, 0, 0];
      p0[ax] = -h;
      p1[ax] = h;
      p0[(ax + 1) % 3] = p1[(ax + 1) % 3] = a * h;
      p0[(ax + 2) % 3] = p1[(ax + 2) % 3] = b * h;
      B.rod(new THREE.Vector3(...p0), new THREE.Vector3(...p1), f.bar, seg, WHITE, 0);
    }
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) B.ball(new THREE.Vector3(x * h, y * h, z * h), f.corner, GOLD, 1, low ? 6 : 10, low ? 4 : 8);
    const corner = new THREE.Vector3(h, -h, h), k3 = new THREE.Vector3(GL.K.x, GL.K.y, h), i3 = new THREE.Vector3(GL.I.x, GL.I.y, h);
    B.rod(corner, i3, 0.022, seg, GOLD, 1);
    B.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, low ? 10 : 16), B.at(k3.x, k3.y, h, Math.PI / 2, 0, 0), GOLD, 1);
    B.add(new THREE.CylinderGeometry(0.032, 0.032, 0.03, low ? 8 : 12), B.at(i3.x, i3.y, h, Math.PI / 2, 0, 0), GOLD, 1);
    B.rod(new THREE.Vector3(i3.x, i3.y, GL.z - 0.03), i3, 0.014, seg, GOLD, 1);
    return new THREE.Mesh(B.build(), [mats.enamel, mats.brass]);
  }
  function makeGears(THREE, mats, low, GL) {
    const g = P.gear, kn = P.knob, samples = low ? 2 : 3;
    const tb = new Builder(THREE);
    tb.add(gearGeometry(THREE, { z: g.zt, m: g.m, alpha: g.pressure, thickness: g.thickness, bore: g.ringInner, samples }), null, GOLD, 0);
    tb.rod(new THREE.Vector3(-GL.ra, 0, 0), new THREE.Vector3(GL.ra, 0, 0), P.rail.r * 1.25, low ? 6 : 8, SILVER, 1);
    tb.ball(new THREE.Vector3(0, 0, 0), P.rail.hub * 1.15, HUB, 1, low ? 8 : 10, low ? 6 : 8);
    for (const sx of [-1, 1]) tb.ball(new THREE.Vector3(sx * (g.ringInner + GL.ra) / 2, 0, 0), 0.03, HUB, 1, 8, 6);
    const turntable = new THREE.Mesh(tb.build(), [mats.brass, mats.steel]);
    turntable.position.set(GL.T.x, GL.T.y, GL.z);
    const ib = new Builder(THREE);
    ib.add(gearGeometry(THREE, { z: g.zi, m: g.m, alpha: g.pressure, thickness: g.thickness, bore: 0.016, samples }), null, ROSE);
    for (let k = 0; k < 3; k++) for (const sz of [-1, 1]) ib.add(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 8), ib.at(0.05 * Math.cos(k * TAU / 3), 0.05 * Math.sin(k * TAU / 3), sz * g.thickness / 2, Math.PI / 2, 0, 0), GOLD);
    const idler = new THREE.Mesh(ib.build(), mats.brass);
    idler.position.set(GL.I.x, GL.I.y, GL.z);
    const knobPivot = new THREE.Group();
    knobPivot.position.set(GL.K.x, GL.K.y, 0);
    const zTop = P.h + kn.lift;
    const kb = new Builder(THREE);
    kb.add(gearGeometry(THREE, { z: g.zk, m: g.m, alpha: g.pressure, thickness: g.thickness, bore: 0.016, samples }), kb.at(0, 0, GL.z), GOLD);
    kb.rod(new THREE.Vector3(0, 0, GL.z - 0.02), new THREE.Vector3(0, 0, zTop), 0.022, low ? 6 : 10, GOLD);
    const knobGear = new THREE.Mesh(kb.build(), mats.brass);
    const hb = new Builder(THREE);
    hb.add(new THREE.CylinderGeometry(kn.r * 0.82, kn.r, 0.07, low ? 14 : 24), hb.at(0, 0, zTop, Math.PI / 2, 0, 0), kn.color);
    hb.add(new THREE.SphereGeometry(kn.r * 0.82, low ? 12 : 20, low ? 4 : 6, 0, TAU, 0, Math.PI / 2), hb.at(0, 0, zTop + 0.035, Math.PI / 2, 0, 0, 1, 0.35, 1), kn.color);
    for (const sx of [-1, 1]) hb.ball(new THREE.Vector3(sx * kn.wing / 2 * 0.74, 0, zTop + 0.01), 0.05, PEARL, 0, low ? 8 : 12, low ? 6 : 8, 1.25, 0.85, 0.8);
    const handle = new THREE.Mesh(hb.build(), mats.knob);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(kn.hit, 10, 8), mats.hit);
    hit.position.set(0, 0, zTop);
    knobPivot.add(knobGear, handle, hit);
    return { turntable, idler, knobPivot, handle, hit, knobTop: zTop };
  }
  function makeChest(THREE, mats, low) {
    const c = P.chest, S = c.size, hs = S / 2;
    const group = new THREE.Group();
    const bodyH = hs + c.bodyTop;
    const B = new Builder(THREE);
    B.add(new THREE.BoxGeometry(S, bodyH, S), B.at(0, (c.bodyTop - hs) / 2, 0), c.color, 0);
    B.add(new THREE.BoxGeometry(S + 0.016, 0.03, S + 0.016), B.at(0, -hs + 0.015, 0), GOLD, 1);
    B.add(new THREE.BoxGeometry(S + 0.012, 0.018, S + 0.012), B.at(0, c.bodyTop - 9e-3, 0), GOLD, 1);
    for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(0.032, bodyH, S + 0.012), B.at(sx * S * 0.3, (c.bodyTop - hs) / 2, 0), GOLD, 1);
    const ringGeo = () => new THREE.TorusGeometry(c.funnel * 0.8, 0.014, low ? 5 : 8, low ? 12 : 20);
    const holeGeo = () => new THREE.CircleGeometry(c.funnel * 0.8, low ? 12 : 20);
    const faces = [[1, 0, 0, 0, Math.PI / 2, 0], [-1, 0, 0, 0, -Math.PI / 2, 0], [0, -1, 0, Math.PI / 2, 0, 0], [0, 0, 1, 0, 0, 0], [0, 0, -1, 0, Math.PI, 0]];
    for (const [x, y, z, rx, ry, rz] of faces) {
      B.add(ringGeo(), B.at(x * (hs + 8e-3), y * (hs + 8e-3), z * (hs + 8e-3), rx, ry, rz), GOLD, 1);
      B.add(holeGeo(), B.at(x * (hs + 4e-3), y * (hs + 4e-3), z * (hs + 4e-3), rx, ry, rz), 2758224, 0);
    }
    const body = new THREE.Mesh(B.build(), [mats.enamel, mats.brass]);
    group.add(body);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, c.bodyTop, -hs);
    const L = new Builder(THREE);
    const fwd = L.at(0, 0, hs);
    L.add(archGeometry(THREE, S + 0.01, c.lidRise, S + 0.01, low ? 6 : 12), fwd, c.lidColor, 0);
    for (const sx of [-1, 1]) L.add(archGeometry(THREE, S + 0.022, c.lidRise + 6e-3, 0.032, low ? 6 : 12), L.at(sx * S * 0.3, 0, hs), GOLD, 1);
    L.add(new THREE.SphereGeometry(0.03, low ? 8 : 12, low ? 6 : 8), L.at(0, 0.012, S + 8e-3, 0, 0, 0, 1, 1.25, 0.6), GOLD, 1);
    L.add(new THREE.BoxGeometry(S - 0.03, 6e-3, S - 0.03), L.at(0, -2e-3, hs), 16765158, 0);
    for (const sx of [-1, 1]) L.add(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), L.at(sx * S * 0.3, 0, -4e-3, 0, 0, Math.PI / 2), GOLD, 1);
    const lid = new THREE.Mesh(L.build(), [mats.enamel, mats.brass]);
    lidPivot.add(lid);
    group.add(lidPivot);
    const pile = new THREE.SphereGeometry(1, low ? 10 : 16, low ? 4 : 6, 0, TAU, 0, Math.PI / 2);
    pile.scale(hs * 0.86, c.lidRise * 0.6, hs * 0.86);
    const treasure = new THREE.Mesh(pile, mats.treasure);
    treasure.position.y = c.bodyTop;
    treasure.visible = false;
    group.add(treasure);
    return { group, lidPivot, treasure };
  }
  var nodePosition = (THREE, n, out) => {
    const c = nodeCoord(n);
    return out.set((c[0] - 1) * P.s, (c[1] - 1) * P.s, (c[2] - 1) * P.s);
  };
  function makeRails(THREE, L, mats, low, GL) {
    const s = P.s, h = P.h, rr = P.rail;
    const B = new Builder(THREE);
    const seg = low ? 5 : 6;
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), d = new THREE.Vector3();
    const glow = [];
    const edgeInfo = /* @__PURE__ */ new Map();
    const rim = GL.ra + 0.014;
    for (const e of L.edges) {
      nodePosition(THREE, e.a, pa);
      nodePosition(THREE, e.b, pb);
      let t0 = 0, t1 = 1;
      if (e.a === CENTER) t0 = P.chest.size / 2 / s;
      else if (e.b === CENTER) t1 = 1 - P.chest.size / 2 / s;
      if (e.gate >= 0) {
        if (e.a === L.switchNode) t0 = rim / s;
        else t1 = 1 - rim / s;
      }
      d.subVectors(pb, pa);
      const A = pa.clone().addScaledVector(d, t0), Bp = pa.clone().addScaledVector(d, t1);
      B.rod(A, Bp, rr.r, seg, SILVER);
      glow.push({ key: e.key, a: e.a, b: e.b, A: pa.clone(), B: pb.clone(), t0, t1 });
    }
    for (const n of L.nodes) {
      if (n === L.switchNode) continue;
      nodePosition(THREE, n, pa);
      B.ball(pa, rr.hub, HUB, 0, low ? 6 : 8, low ? 4 : 6);
      const c = nodeCoord(n);
      if (c[0] !== 1 && c[1] !== 1 && c[2] !== 1) {
        pb.set((c[0] - 1) * h, (c[1] - 1) * h, (c[2] - 1) * h);
        B.rod(pa, pb, rr.r, seg, SILVER);
      }
    }
    const rails = B.build();
    const side = 6, per = side * 2;
    const pos = new Float32Array(glow.length * per * 3), nor = new Float32Array(glow.length * per * 3), tau = new Float32Array(glow.length * per);
    const idx = [];
    const u = new THREE.Vector3(), v = new THREE.Vector3(), ax = new THREE.Vector3();
    glow.forEach((gl, gi) => {
      ax.subVectors(gl.B, gl.A).normalize();
      u.set(ax.y, ax.z, ax.x).cross(ax).normalize();
      v.crossVectors(ax, u);
      for (let end = 0; end < 2; end++) {
        const t = end ? gl.t1 : gl.t0;
        for (let k = 0; k < side; k++) {
          const a = k * TAU / side, o = gi * per + end * side + k;
          const nx = u.x * Math.cos(a) + v.x * Math.sin(a), ny = u.y * Math.cos(a) + v.y * Math.sin(a), nz = u.z * Math.cos(a) + v.z * Math.sin(a);
          pos[o * 3] = gl.A.x + (gl.B.x - gl.A.x) * t + nx * rr.glowR;
          pos[o * 3 + 1] = gl.A.y + (gl.B.y - gl.A.y) * t + ny * rr.glowR;
          pos[o * 3 + 2] = gl.A.z + (gl.B.z - gl.A.z) * t + nz * rr.glowR;
          nor[o * 3] = nx;
          nor[o * 3 + 1] = ny;
          nor[o * 3 + 2] = nz;
          tau[o] = t;
        }
      }
      for (let k = 0; k < side; k++) {
        const a0 = gi * per + k, a1 = gi * per + (k + 1) % side, b0 = a0 + side, b1 = a1 + side;
        idx.push(a0, a1, b1, a0, b1, b0);
      }
      edgeInfo.set(gl.key, { start: gi * per, count: per, a: gl.a, b: gl.b });
    });
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    glowGeo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    const aGlow = new THREE.BufferAttribute(new Float32Array(glow.length * per * 2), 2);
    aGlow.setUsage(THREE.DynamicDrawUsage);
    glowGeo.setAttribute("aGlow", aGlow);
    glowGeo.setIndex(idx);
    glowGeo.computeBoundingSphere();
    return { rails, glowGeo, aGlow, tau, edgeInfo };
  }
  function makePieceGlow(THREE, GL) {
    const side = 6, rr = P.rail, s = P.s;
    const pos = [], nor = [], tau = [], idx = [];
    for (let half = 0; half < 2; half++) {
      const sx = half ? -1 : 1;
      for (let end = 0; end < 2; end++) {
        const x = end ? 0 : sx * (GL.ra + 0.014);
        for (let k = 0; k < side; k++) {
          const a = k * TAU / side;
          pos.push(x, Math.cos(a) * rr.glowR, Math.sin(a) * rr.glowR);
          nor.push(0, Math.cos(a), Math.sin(a));
          tau.push(end ? 1 : 1 - (GL.ra + 0.014) / s);
        }
      }
      for (let k = 0; k < side; k++) {
        const a0 = half * side * 2 + k, a1 = half * side * 2 + (k + 1) % side, b0 = a0 + side, b1 = a1 + side;
        idx.push(a0, a1, b1, a0, b1, b0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    const aGlow = new THREE.BufferAttribute(new Float32Array(side * 4 * 2), 2);
    aGlow.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aGlow", aGlow);
    g.setIndex(idx);
    return { geo: g, aGlow, tau, perHalf: side * 2 };
  }
  function makeGems(THREE, mats, low) {
    const mesh = new THREE.InstancedMesh(gemGeometry(THREE, P.gem.r, low ? 6 : 8), mats.gem, 6);
    mesh.frustumCulled = false;
    return mesh;
  }

  // app/hero/hero.js
  var IDS = ["ring-outer", "ring-middle", "ring-inner"];
  var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  var wrap = (x) => {
    x = (x + Math.PI) % TAU;
    if (x < 0) x += TAU;
    return x - Math.PI;
  };
  var smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  var mod = (a, n) => (a % n + n) % n;
  function createHero(THREE, opts) {
    const V3 = THREE.Vector3;
    const low = opts.quality === "low";
    const emit = (type, payload) => {
      try {
        opts.emit(type, payload);
      } catch (e) {
      }
    };
    const sound = (name, gain = 1, rate = 1, pan = 0) => emit("sound", { name, gain, rate, pan });
    const own = [];
    const keep = (x) => {
      own.push(x);
      return x;
    };
    const mats = makeMaterials(THREE, opts, keep);
    const G = new V3(P.G[0], P.G[1], P.G[2]);
    const layoutCache = /* @__PURE__ */ new Map();
    function getLayout(index) {
      for (let k = 0; k < LAYOUTS.length; k++) {
        const def = LAYOUTS[(index + k) % LAYOUTS.length];
        if (!layoutCache.has(def.name)) {
          const Lx2 = compileLayout({ ...def, switch: SWITCH, knobFace: KNOB_FACE });
          Lx2.ok = checkAnyState(Lx2).ok;
          Lx2.nextNone = new Int8Array(162);
          for (let i = 0; i < 162; i++) Lx2.nextNone[i] = Lx2.next[0][i] === Lx2.next[1][i] ? Lx2.next[0][i] : -1;
          Lx2.edgeGate = new Set(Lx2.edges.filter((e) => e.gate >= 0).map((e) => e.key));
          layoutCache.set(def.name, Lx2);
        }
        const Lx = layoutCache.get(def.name);
        if (Lx.ok) return Lx;
      }
      throw new Error("hero: \u4F7F\u3048\u308B\u914D\u7F6E\u304C\u306A\u3044");
    }
    const root = new THREE.Group();
    root.name = "hero";
    const base = makeBase(THREE, mats, low);
    root.add(base.group);
    const gimbal = new THREE.Group();
    gimbal.position.copy(G);
    root.add(gimbal);
    const pivots = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
    gimbal.add(pivots[0]);
    pivots[0].add(pivots[1]);
    pivots[1].add(pivots[2]);
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
    gears.hit.userData.heroId = "knob";
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
    function buildRails(layout2) {
      if (railMesh) {
        railGroup.remove(railMesh, glowMesh);
        railMesh.geometry.dispose();
        glowMesh.geometry.dispose();
      }
      L = layout2;
      rails = makeRails(THREE, L, mats, low, GL);
      railMesh = new THREE.Mesh(rails.rails, mats.steel);
      glowMesh = new THREE.Mesh(rails.glowGeo, mats.glow);
      glowMesh.renderOrder = 5;
      railGroup.add(railMesh, glowMesh);
    }
    const mkRotor = (i, step, R) => ({ i, step, R, theta: 0, target: 0, w: 0, mode: "rest", e1: new V3(), prevPtr: NaN, far: false, tick: 0, wiggle: 0, lastSign: 0, lastRev: -9, armed: true, grabDetent: 0 });
    const rings = [0, 1, 2].map((i) => mkRotor(i, QUARTER, P.ring.R[i]));
    const knob = mkRotor(3, Math.PI, P.knob.r);
    knob.tw = { from: 0, to: 0, t: 1 };
    knob.queued = false;
    knob.tooth = 0;
    const S = {
      stage: "play",
      round: Math.max(1, opts.round | 0 || 1),
      collected: 0,
      total: 3,
      started: false,
      gems: [],
      roundHint: true,
      hint: { id: IDS[0], sign: 1 },
      planKey: -1,
      glowDirty: true,
      settled: false,
      finaleT: 0,
      finalePhase: 0,
      lid: 0,
      lidKick: 9,
      completeSent: false,
      appear: 1,
      roll: 0,
      lamps: [],
      lampQueue: [],
      time: 0
    };
    const state = { stage: "play", round: S.round, collected: 0, total: 3 };
    const audio = { roll: 0, spin: 0 };
    const syncState = () => {
      state.stage = S.stage;
      state.round = S.round;
      state.collected = S.collected;
      state.total = S.total;
    };
    const wv = { a: new V3(), c: new V3(), q: new V3(), u: new V3(), t: new V3(), e2: new V3(), n: new V3(), cam: new V3(), p: new V3(), g: new V3(), d: new V3(), x: new V3() };
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qCube = new THREE.Quaternion(), qInv = new THREE.Quaternion();
    const m4 = new THREE.Matrix4(), s3 = new V3();
    const AX = new V3(1, 0, 0), AY = new V3(0, 1, 0), AZ = new V3(0, 0, 1);
    const Q_AXIS = [new THREE.Quaternion(), new THREE.Quaternion().setFromAxisAngle(AZ, Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(AY, -Math.PI / 2)];
    const occ = new Int8Array(27), order = [];
    const byKeyDesc = (a, b) => b.key - a.key;
    const ringsAtRest = () => rings[0].mode === "rest" && rings[1].mode === "rest" && rings[2].mode === "rest";
    let lastCam = null, lastView = null;
    function layout(round) {
      const pick = layoutForRound(round);
      const target = getLayout(pick.index);
      const starts = target.name === LAYOUTS[pick.index].name ? pick.starts : target.def.starts[pick.count][0];
      if (target !== L || !railMesh) buildRails(target);
      S.round = round;
      S.total = starts.length;
      S.collected = 0;
      S.gems = starts.map((node, i) => ({
        i,
        node,
        state: "rest",
        from: node,
        to: node,
        dir: 0,
        t: 0,
        v: 0,
        roll: i * 1.7 % TAU,
        axis: restAxis(node),
        pos: nodePos[node].clone(),
        base: new THREE.Quaternion(),
        scale: 0,
        born: 0.12 + i * 0.09,
        fx: 0,
        fz: 0,
        launch: 0
      }));
      for (const g of S.gems) g.base.copy(Q_AXIS[g.axis]);
      S.lamps = starts.map(() => ({ lit: false, pop: 9, color: 0 }));
      S.lampQueue.length = 0;
      S.planKey = -1;
      S.glowDirty = true;
      S.settled = false;
      S.appear = 0;
      for (let i = 0; i < 6; i++) {
        const on = i < S.total;
        if (on) base.lampSlot(i, S.total, wv.p, qa);
        else wv.p.set(0, -5, 0);
        m4.compose(wv.p, on ? qa : qb.identity(), s3.setScalar(on ? 1 : 0));
        base.bezels.setMatrixAt(i, m4);
      }
      base.bezels.instanceMatrix.needsUpdate = true;
      syncState();
      replan();
    }
    function restAxis(node) {
      for (let d = 0; d < 6; d++) if (L.next[0][node * 6 + d] >= 0 || L.next[1][node * 6 + d] >= 0) return d >> 1;
      return 0;
    }
    function ringAxisWorld(i, out) {
      if (i === 3) return out.copy(AZ).applyQuaternion(cube.getWorldQuaternion(qa)).normalize();
      pivots[i].getWorldQuaternion(qa);
      return out.copy(AXES[i]).applyQuaternion(qa).normalize();
    }
    const rotorCenter = (r, out) => r.i === 3 ? gears.hit.getWorldPosition(out) : out.copy(G);
    function pointerAngle(ray2, C, a, R, e1, far) {
      const oc = wv.t.copy(ray2.origin).sub(C);
      const b = oc.dot(ray2.direction), c = oc.lengthSq() - R * R, disc = b * b - c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        let t = far ? -b + sq : -b - sq;
        if (t < 0) t = -b + sq;
        wv.q.copy(ray2.direction).multiplyScalar(Math.max(0, t)).add(ray2.origin);
      } else {
        wv.q.copy(ray2.direction).multiplyScalar(-b).add(ray2.origin).sub(C);
        const l = wv.q.length();
        if (l < 1e-6) return null;
        wv.q.multiplyScalar(R / l).add(C);
      }
      wv.u.copy(wv.q).sub(C);
      wv.u.addScaledVector(a, -wv.u.dot(a));
      if (wv.u.length() < 0.05 * R) return null;
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
      r.far = false;
      if (P.rotor.farSide > 0 && r.i < 3 && input.grab && input.grab.point) {
        pivots[r.i].worldToLocal(wv.p.copy(input.grab.point));
        const l = Math.hypot(wv.p.x, wv.p.y);
        if (l > 1e-6) {
          wv.p.set(wv.p.x * r.R / l, wv.p.y * r.R / l, 0);
          pivots[r.i].localToWorld(wv.p).sub(C);
          r.far = wv.p.dot(input.pointer.ray.direction) > P.rotor.farSide * r.R;
        }
      }
      r.armed = r.i < 3;
      r.prevPtr = NaN;
      if (r.armed) {
        const ang = pointerAngle(input.pointer.ray, C, a, r.R, r.e1, r.far);
        r.prevPtr = ang === null ? NaN : ang;
      }
      r.mode = "grab";
      r.target = r.theta;
      r.grabDetent = Math.round(r.theta / r.step);
      S.roundHint = false;
      sound("grab", 0.9, r.i < 3 ? 1 + r.i * 0.12 : 1.5);
    }
    function spring(r, W, maxW, dt) {
      let w = r.w + (W * W * (r.target - r.theta) - 2 * W * r.w) * dt;
      w = clamp(w, -maxW, maxW);
      const sg = w > 0.08 ? 1 : w < -0.08 ? -1 : 0;
      if (sg && r.lastSign && sg !== r.lastSign) {
        if (S.time - r.lastRev < P.rotor.reverseGap) w = 0;
        else {
          r.lastRev = S.time;
          r.lastSign = sg;
        }
      } else if (sg && !r.lastSign) r.lastSign = sg;
      r.w = w;
      r.theta += w * dt;
    }
    function stepRotor(r, dt, grabbed, locked) {
      const R = P.rotor;
      if (grabbed) {
        if (locked) r.w = 0;
        else spring(r, R.follow, R.maxW, dt);
      } else if (r.mode === "grab" || r.mode === "coast") {
        r.mode = "coast";
        r.w *= Math.exp(-R.coast * dt);
        if (!locked) r.theta += r.w * dt;
        if (Math.abs(r.w) < R.settleBelow) {
          let k = Math.round(r.theta / r.step);
          const d = r.theta - r.grabDetent * r.step;
          if (R.commit > 0 && k === r.grabDetent && Math.abs(d) >= R.commit) k += Math.sign(d);
          r.mode = "settle";
          r.target = k * r.step;
        }
      } else if (r.mode === "auto") {
        const x = r.target - r.theta, want = clamp(6 * x, -R.autoW, R.autoW);
        r.w = Math.abs(want) > Math.abs(r.w) ? r.w + clamp(want - r.w, -4 * dt, 4 * dt) : want;
        r.theta += r.w * dt;
        if (Math.abs(x) < 0.01) {
          r.theta = r.target;
          r.w = 0;
          r.mode = "rest";
          r.lastSign = 0;
        }
      } else if (r.mode === "settle") {
        if (!locked) spring(r, R.settle, R.maxW, dt);
        if (Math.abs(r.target - r.theta) < 2e-3 && Math.abs(r.w) < 0.02) {
          r.theta = r.target;
          r.w = 0;
          r.mode = "rest";
          r.lastSign = 0;
        }
      } else if (r.mode === "tween") {
        if (!locked) {
          const before = r.theta;
          r.tw.t = Math.min(1, r.tw.t + dt / P.knob.tapTime);
          r.theta = r.tw.from + (r.tw.to - r.tw.from) * smooth(r.tw.t);
          r.w = dt > 0 ? (r.theta - before) / dt : 0;
          if (r.tw.t >= 1) {
            r.theta = r.target = r.tw.to;
            r.w = 0;
            r.mode = "rest";
          }
        }
      }
    }
    function updateRotor(r, dt, input, locked) {
      const id = r.i < 3 ? IDS[r.i] : "knob";
      const grabbed = S.stage === "play" && r.mode === "grab" && input.grab && input.grab.id === id;
      if (grabbed) {
        if (!r.armed && Math.hypot(input.totalDX, input.totalDY) > 14) r.armed = true;
        if (r.armed) {
          const a = ringAxisWorld(r.i, wv.a), C = rotorCenter(r, wv.c);
          const ang = pointerAngle(input.pointer.ray, C, a, r.R, r.e1, r.far);
          if (ang !== null) {
            if (Number.isFinite(r.prevPtr)) r.target += wrap(ang - r.prevPtr);
            r.prevPtr = ang;
          }
        }
      }
      const n = Math.max(1, Math.ceil(dt / 9e-3));
      for (let k = 0; k < n; k++) stepRotor(r, dt / n, grabbed, locked);
      if (!Number.isFinite(r.theta) || !Number.isFinite(r.w)) {
        r.theta = Math.round((r.target || 0) / r.step) * r.step || 0;
        r.target = r.theta;
        r.w = 0;
        r.mode = "rest";
      }
      const idx = Math.round(r.theta / r.step);
      if (idx !== r.tick) {
        r.tick = idx;
        if (S.stage === "play") {
          if (r.i < 3) sound("tick", 0.8, 1 + r.i * 0.15);
          else sound("switch", 0.9);
        }
        S.glowDirty = true;
      }
    }
    function tapKnob() {
      if (knob.mode === "tween") return;
      knob.queued = false;
      knob.tw.from = knob.theta;
      knob.tw.to = (Math.round(knob.theta / Math.PI) + 1) * Math.PI;
      knob.tw.t = 0;
      knob.mode = "tween";
      S.roundHint = false;
    }
    const tableAngle = () => knob.theta * P.gear.zk / P.gear.zt;
    function tableState() {
      const th = tableAngle(), k = Math.round(th / QUARTER);
      return Math.abs(th - k * QUARTER) < 0.03 ? mod(k, 2) : -1;
    }
    const discreteSw = () => mod(Math.round(knob.theta / Math.PI), 2);
    const discretePose = () => poseIndex(Math.round(rings[0].theta / QUARTER), Math.round(rings[1].theta / QUARTER), Math.round(rings[2].theta / QUARTER));
    function stepGems(dt, gl) {
      const ph = P.phys, s = P.s;
      let dom = -1;
      for (let d = 0; d < 6; d++) {
        const v = DIR_VEC[d];
        if (gl.x * v[0] + gl.y * v[1] + gl.z * v[2] > ph.thr) dom = d;
      }
      const ts = tableState();
      const nx = ts < 0 ? L.nextNone : L.next[ts];
      occ.fill(-1);
      order.length = 0;
      for (const g of S.gems) {
        if (g.state === "rest") occ[g.node] = g.i;
        else if (g.state === "move") {
          if (g.to !== CENTER) occ[g.to] = g.i;
          if (g.t < ph.clear) occ[g.from] = g.i;
        }
        if (g.state === "rest" || g.state === "move") {
          g.key = g.pos.dot(gl);
          order.push(g);
        }
      }
      order.sort(byKeyDesc);
      let moving = 0, speed = 0, busy = false;
      for (const g of order) {
        if (g.state === "rest") {
          if (dom < 0 || g.born > 0) continue;
          const m = nx[g.node * 6 + dom];
          if (m >= 0 && (m === CENTER || occ[m] < 0)) {
            g.state = "move";
            g.from = g.node;
            g.to = m;
            g.dir = dom;
            g.t = 0;
            g.v = 0;
            g.axis = dom >> 1;
            if (m !== CENTER) occ[m] = g.i;
            S.glowDirty = true;
            S.settled = false;
          }
          continue;
        }
        const e = DIR_VEC[g.dir];
        const drive = Math.max(gl.x * e[0] + gl.y * e[1] + gl.z * e[2], ph.cMin);
        g.v = clamp(g.v + (ph.A * drive - ph.mu) * dt, ph.vMin, ph.vMax);
        const ds = g.v * dt;
        g.t += ds / s;
        g.roll += (g.dir & 1 ? -1 : 1) * ds / P.gem.r;
        moving++;
        speed = Math.max(speed, g.v);
        if (L.edgeGate.has(edgeKeyOf(g.from, g.to))) busy = true;
        if (g.to === CENTER) {
          if (g.t >= ph.goneAt) collect(g);
        } else if (g.t >= 1) {
          const node = g.to;
          const m = dom >= 0 ? nx[node * 6 + dom] : -1;
          if (m >= 0 && (m === CENTER || occ[m] < 0)) {
            const straight = dom === g.dir;
            g.v *= straight ? ph.keepStraight : ph.keepTurn;
            g.from = node;
            g.to = m;
            g.dir = dom;
            g.t = Math.min(g.t - 1, 0.3);
            g.axis = dom >> 1;
            g.node = node;
            if (m !== CENTER) occ[m] = g.i;
            if (!straight) sound("clack", 0.25, 1.3);
          } else {
            g.state = "rest";
            g.node = node;
            g.t = 0;
            sound("clack", clamp(0.3 + 0.7 * g.v / ph.vMax, 0, 1), 0.9 + 0.2 * (g.i % 3), clamp(gemWorldX(g) / 1.2, -1, 1));
            g.v = 0;
          }
          S.glowDirty = true;
        }
      }
      for (const g of S.gems) {
        if (g.state === "rest") g.pos.copy(nodePos[g.node]);
        else if (g.state === "move") g.pos.lerpVectors(nodePos[g.from], nodePos[g.to], clamp(g.t, 0, 1));
      }
      S.gatedBusy = busy;
      const target = moving ? clamp(0.35 + 0.65 * speed / ph.vMax, 0, 1) : 0;
      S.roll += (target - S.roll) * (1 - Math.exp(-dt * 10));
      return moving;
    }
    const edgeKeyOf = (a, b) => {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const d = hi - lo;
      return edgeKey(lo, d === 1 ? 0 : d === 3 ? 1 : 2);
    };
    const gemWorldX = (g) => wv.x.copy(g.pos).applyQuaternion(qCube).x;
    function collect(g) {
      if (g.state === "gone") return;
      g.state = "gone";
      g.scale = 0;
      const k = S.collected;
      S.collected++;
      syncState();
      sound("drop", 1, 1 + k * 0.07);
      S.lidKick = 0;
      S.lampQueue.push({ slot: k, color: g.i, at: 0.28 });
      emit("progress", { collected: S.collected, total: S.total });
      S.glowDirty = true;
      S.planKey = -1;
      if (S.collected >= S.total) startFinale();
    }
    function replan() {
      const st = { pose: discretePose(), sw: discreteSw(), gems: S.gems.map((g) => g.state === "gone" ? -1 : g.state === "move" ? g.to === CENTER ? g.from : g.to : g.node) };
      let plan = findPlan(L, st);
      if (!plan) {
        for (let i = 0; i < st.gems.length && !plan; i++) if (st.gems[i] >= 0) plan = findPlan(L, { pose: st.pose, sw: st.sw, gems: [st.gems[i]] });
      }
      S.planTrace = plan ? tracePlan(L, st, plan.moves) : null;
      if (plan && plan.moves.length) {
        const m = plan.moves[0];
        S.hint = m === MOVE_KNOB ? { id: "knob", sign: 1 } : { id: MOVE_IDS[m >> 1], sign: m & 1 ? -1 : 1 };
      }
      S.glowDirty = true;
      hintCache.valid = false;
    }
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
        if (d < 0 || d >> 1 === L.switchAxis) return;
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
    function nodeDir(a, b) {
      for (let d = 0; d < 6; d++) if (neighbor(a, d) === b) return d;
      return -1;
    }
    function refreshGlow(gl) {
      S.glowDirty = false;
      rails.aGlow.array.fill(0);
      pieceGlow.aGlow.array.fill(0);
      let any = false;
      if (S.stage === "play") {
        let dom = -1;
        for (let d = 0; d < 6; d++) {
          const v = DIR_VEC[d];
          if (gl.x * v[0] + gl.y * v[1] + gl.z * v[2] > P.phys.thr) dom = d;
        }
        const ts = tableState(), nx = ts < 0 ? L.nextNone : L.next[ts];
        for (const g of S.gems) {
          if (g.state !== "move") continue;
          any = true;
          let k = 0, n = g.to;
          setSeg(g.from, g.to, 1.4, k++);
          while (dom >= 0 && n !== CENTER && k < 4) {
            const m = nx[n * 6 + dom];
            if (m < 0) break;
            setSeg(n, m, 1.4, k++);
            n = m;
          }
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
      rails.aGlow.needsUpdate = true;
      pieceGlow.aGlow.needsUpdate = true;
      glowMesh.visible = any;
      pieceGlowMesh.visible = any;
    }
    function startFinale() {
      S.stage = "finale";
      S.finaleT = 0;
      S.finalePhase = 0;
      S.completeSent = false;
      syncState();
      const cost = [0, 0];
      for (let c = 0; c < 2; c++) for (const r of rings) cost[c] = Math.max(cost[c], Math.abs(wrap(r.theta - c * Math.PI)));
      const home = cost[0] <= cost[1] ? 0 : Math.PI;
      for (const r of rings) {
        r.mode = "auto";
        r.target = r.theta - wrap(r.theta - home);
        r.lastSign = 0;
      }
      emit("stage", { stage: "finale", focus: G.clone() });
      sound("whoosh");
      S.glowDirty = true;
    }
    function updateFinale(dt) {
      const F = P.finale, c = P.chest;
      S.finaleT += dt;
      if (S.finalePhase === 0) {
        S.lid = 0.05 * Math.max(0, Math.sin(S.finaleT * 22)) * smooth(S.finaleT / 0.5);
        if (ringsAtRest() && S.finaleT >= F.minWait) {
          S.finalePhase = 1;
          S.finaleT = 0;
          sound("chest");
          for (const g of S.gems) {
            g.state = "show";
            g.launch = 0.12 + g.i * 0.13;
            g.scale = 0;
          }
        }
        return;
      }
      const T = S.finaleT;
      const t = clamp(T / c.openTime, 0, 1), c1 = 1.70158, c3 = c1 + 1;
      S.lid = (1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)) * c.open;
      const n = S.gems.length;
      for (const g of S.gems) {
        const i = g.i, u = clamp((T - g.launch) / 0.95, 0, 1);
        if (T < g.launch) {
          g.scale = 0;
          continue;
        }
        const ang = i * TAU / n + T * F.orbitW;
        const k = smooth(u);
        const bob = 0.04 * Math.sin(T * 2.6 + i * 1.3) * k;
        g.pos.set(Math.cos(ang) * F.orbitR * k, c.bodyTop + (F.orbitY - c.bodyTop) * u + 0.34 * Math.sin(Math.PI * u) + bob, Math.sin(ang) * F.orbitR * k);
        g.scale = 0.4 + 1.1 * smooth(u * 2);
        g.roll += dt * (5 - 2.5 * k);
        g.axis = 1;
      }
      if (Math.floor((T - dt) / 0.55) !== Math.floor(T / 0.55) && T < F.show) sound("sparkle", 0.7, 1 + 0.1 * Math.floor(T / 0.55));
      mats.beam.uniforms.uAlpha.value = 0.85 * smooth(T / 0.5) * (0.85 + 0.15 * Math.sin(T * 5));
      mats.beam.uniforms.uTime.value = T;
      fx.beam.visible = fx.sparks.visible = true;
      const sp = fx.sparks.geometry.attributes.position;
      for (let i = 0; i < fx.count; i++) {
        const sd = fx.seeds[i], tau = (T / 1.3 + sd.phase) % 1 * 1.3;
        if (T < sd.phase * 1.3 * 0.35) {
          sp.setXYZ(i, 0, -9, 0);
          continue;
        }
        sp.setXYZ(i, Math.cos(sd.a) * sd.out * tau, c.bodyTop + 0.03 + sd.up * tau - 0.5 * 1.9 * tau * tau, Math.sin(sd.a) * sd.out * tau);
      }
      sp.needsUpdate = true;
      if (T > F.show && !S.completeSent) {
        S.completeSent = true;
        S.stage = "complete";
        syncState();
        emit("stage", { stage: "complete" });
      }
    }
    function update(dt, input) {
      if (!S.started) {
        S.started = true;
        emit("stage", { stage: "play" });
        emit("progress", { collected: S.collected, total: S.total });
      }
      if (!(dt > 0)) dt = 0;
      S.time = input.time;
      lastCam = input.camera;
      lastView = input.viewport;
      if (S.stage === "play") {
        if (input.pressedId) {
          const i = IDS.indexOf(input.pressedId);
          if (i >= 0) startGrab(rings[i], input);
          else if (input.pressedId === "knob" && knob.mode !== "tween") startGrab(knob, input);
        }
        if (input.releasedId) sound("release", 0.7);
        if (input.tapId === "knob") {
          if (knob.mode === "grab") knob.mode = "rest";
          knob.queued = true;
        }
      }
      if (knob.queued && !S.gatedBusy && S.stage === "play") tapKnob();
      for (const r of rings) updateRotor(r, dt, input, false);
      updateRotor(knob, dt, input, !!S.gatedBusy);
      const tooth = Math.floor(knob.theta / (TAU / P.gear.zk));
      if (tooth !== knob.tooth) {
        knob.tooth = tooth;
        if (S.stage === "play") sound("gear", 0.6);
      }
      qCube.setFromAxisAngle(AZ, rings[0].theta).multiply(qa.setFromAxisAngle(AX, rings[1].theta)).multiply(qa.setFromAxisAngle(AY, rings[2].theta));
      qInv.copy(qCube).invert();
      const gl = wv.g.set(0, -1, 0).applyQuaternion(qInv);
      for (const g of S.gems) if (g.born > 0) {
        g.born -= dt;
        if (g.born <= 0 && S.stage === "play") sound("pop", 0.35, 1.2 + g.i * 0.1);
      }
      let moving = 0;
      if (S.stage === "play") {
        moving = stepGems(dt, gl);
        const quiet = !moving && knob.mode === "rest" && ringsAtRest();
        if (quiet && S.stage === "play") {
          const key = discretePose() * 2 + discreteSw();
          if (!S.settled || key !== S.planKey) {
            S.settled = true;
            S.planKey = key;
            replan();
          }
        } else if (!quiet) S.settled = false;
      } else {
        S.roll += (0 - S.roll) * (1 - Math.exp(-dt * 10));
        updateFinale(dt);
      }
      S.appear = Math.min(1, S.appear + dt / 0.5);
      const glowOn = S.stage === "play" && !input.grab && (S.roundHint || input.idle >= P.hint.after);
      const pulse = P.hint.glowLo + (P.hint.glowHi - P.hint.glowLo) * (0.5 + 0.5 * Math.sin(input.time * Math.PI));
      const party = S.stage !== "play" && S.finalePhase === 1;
      for (const r of rings) {
        const on = glowOn && S.hint.id === IDS[r.i];
        mats.rings[r.i].emissiveIntensity = on ? pulse : party ? 0.32 * (0.5 + 0.5 * Math.sin(input.time * 4.5 - r.i * 1.4)) : 0;
        const wt = on && !opts.reducedMotion && r.mode === "rest" ? Math.sin(input.time * TAU) * P.hint.wiggle : 0;
        r.wiggle += (wt - r.wiggle) * (1 - Math.exp(-dt * 8));
      }
      const knobOn = glowOn && S.hint.id === "knob";
      mats.knob.emissiveIntensity = knobOn ? pulse : 0;
      gears.handle.position.z = knobOn && !opts.reducedMotion ? 0.012 * (0.5 + 0.5 * Math.sin(input.time * TAU)) : 0;
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
      root.updateMatrixWorld();
      gears.hit.getWorldPosition(wv.p);
      wv.n.copy(AZ).applyQuaternion(cube.getWorldQuaternion(qa));
      wv.cam.copy(input.camera.position).sub(wv.p);
      const cl = wv.cam.length();
      gears.hit.userData.heroEnabled = S.stage === "play" && cl > 1e-6 && wv.n.dot(wv.cam) / cl > 0.2;
      S.lidKick += dt;
      const kick = S.stage === "play" ? 0.3 * Math.sin(Math.PI * clamp(S.lidKick / 0.28, 0, 1)) : 0;
      chest.lidPivot.rotation.x = -(S.stage === "play" ? kick : S.lid);
      chest.treasure.visible = -chest.lidPivot.rotation.x > 0.02;
      for (let q = S.lampQueue.length - 1; q >= 0; q--) {
        const it = S.lampQueue[q];
        it.at -= dt;
        if (it.at <= 0) {
          const lp = S.lamps[it.slot];
          if (lp) {
            lp.lit = true;
            lp.pop = 0;
            lp.color = it.color;
          }
          sound("pop", 0.6, 1 + it.slot * 0.12);
          S.lampQueue.splice(q, 1);
        }
      }
      for (let i = 0; i < 6; i++) {
        const lp = S.lamps[i];
        if (!lp) {
          m4.compose(wv.p.set(0, -5, 0), qb.identity(), s3.setScalar(0));
          base.lamps.setMatrixAt(i, m4);
          continue;
        }
        lp.pop += dt;
        base.lampSlot(i, S.total, wv.p, qa);
        const bump = lp.lit ? 1 + 0.45 * Math.sin(Math.PI * clamp(lp.pop / 0.35, 0, 1)) : 1;
        m4.compose(wv.p, qa, s3.setScalar(bump * smooth(S.appear * 1.5)));
        base.lamps.setMatrixAt(i, m4);
        if (lp.lit) {
          const tw = 2.1 + 0.25 * Math.sin(input.time * 3 + i);
          colorTmp.set(P.gem.colors[lp.color]).multiplyScalar(tw);
        } else colorTmp.setRGB(0.2, 0.17, 0.24);
        base.lamps.setColorAt(i, colorTmp);
      }
      base.lamps.instanceMatrix.needsUpdate = true;
      if (base.lamps.instanceColor) base.lamps.instanceColor.needsUpdate = true;
      const tAng = tableAngle();
      for (let i = 0; i < 6; i++) {
        const g = S.gems[i];
        if (!g || g.state === "gone") {
          m4.compose(wv.p.set(0, 0, 0), qb.identity(), s3.setScalar(0));
          gemMesh.setMatrixAt(i, m4);
          continue;
        }
        let scale = g.scale;
        if (g.state === "rest" || g.state === "move") {
          scale = g.born > 0 ? 0 : 1 + 0.35 * Math.sin(Math.PI * clamp(-g.born / 0.3, 0, 1));
          if (g.state === "move" && g.to === CENTER) scale *= 1 - 0.8 * smooth((g.t - P.phys.sinkAt) / (P.phys.goneAt - P.phys.sinkAt));
        }
        if (g.state === "rest" && g.node === L.switchNode && g.axis !== L.switchAxis) qa.setFromAxisAngle(AZ, tAng);
        else qa.copy(Q_AXIS[g.axis]);
        if (g.base.dot(qa) < 0) {
          qa.x = -qa.x;
          qa.y = -qa.y;
          qa.z = -qa.z;
          qa.w = -qa.w;
        }
        g.base.slerp(qa, 1 - Math.exp(-dt * 14));
        qb.setFromAxisAngle(AX, g.roll);
        qa.copy(g.base).multiply(qb);
        m4.compose(g.pos, qa, s3.setScalar(Math.max(0, scale)));
        gemMesh.setMatrixAt(i, m4);
      }
      gemMesh.instanceMatrix.needsUpdate = true;
      railGroup.scale.setScalar(0.9 + 0.1 * smooth(S.appear * 1.4));
      if (S.glowDirty) refreshGlow(gl);
      mats.glow.uniforms.uTime.value = input.time % 1e3;
      audio.roll = S.roll;
      audio.spin = clamp(Math.max(Math.abs(rings[0].w), Math.abs(rings[1].w), Math.abs(rings[2].w), Math.abs(knob.w) * 0.5) / P.rotor.maxW, 0, 1);
    }
    const hintCache = { valid: false, id: -1, sign: 0, th: [9, 9, 9], cam: new V3(), w: 0, point: new V3(), dir: new V3(), axis: new V3(), axisOk: false };
    const hintOut = { id: IDS[0], point: new V3(), dir: new V3(), axis: null, center: G.clone() };
    const hintTap = { id: "knob", point: new V3(), dir: null };
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
      for (let pass = 0; pass < 2 && bestScore < 0; pass++) {
        for (let k = 0; k < N; k++) {
          const al = k * TAU / N;
          p.set(R * Math.cos(al), R * Math.sin(al), 0);
          pivots[i].localToWorld(p);
          rel.subVectors(p, G);
          tv.crossVectors(a, rel).multiplyScalar(sign);
          if (tv.length() / R < 0.5) continue;
          const depth = rel.dot(vC) / R;
          if (depth < -0.3) continue;
          let px = R * ppu;
          if (lastCam && lastView) {
            s0.copy(p).project(lastCam);
            s1.copy(p).addScaledVector(tv, 0.2).project(lastCam);
            px = Math.hypot((s1.x - s0.x) * lastView.width / 2, (s1.y - s0.y) * lastView.height / 2) / 0.2;
          }
          const toward = tv.dot(vC) / R;
          const nice = 0.06 * (rel.x * 0.6 + rel.y * 0.8) / R;
          let score = -1, tangent = false;
          if (toward > 0.55 && Math.abs(depth) < 0.45) score = 1.2 + toward + nice;
          else if (px >= 0.35 * R * ppu && depth > -0.15) {
            score = px / (R * ppu) + 0.3 * depth + nice;
            tangent = true;
          }
          if (score <= bestScore || score < 0) continue;
          if (pass === 0) {
            ray.set(cam, s0.subVectors(p, cam).normalize());
            const hits = ray.intersectObjects(hitList, false);
            if (!hits.length || hits[0].object.userData.heroId !== IDS[i]) {
              fallbackScore = Math.max(fallbackScore, score);
              continue;
            }
          }
          bestScore = score;
          bestTangent = tangent;
          hv.bestP.copy(p);
          hv.bestT.copy(tv);
        }
        if (fallbackScore < 0) break;
      }
      if (bestScore < 0) {
        hv.bestP.set(R * 0.707, R * 0.707, 0);
        pivots[i].localToWorld(hv.bestP);
        bestTangent = false;
      }
      hintCache.point.copy(hv.bestP);
      if (bestTangent) hintCache.dir.copy(hv.bestT);
      else hintCache.dir.subVectors(G, hv.bestP);
      if (hintCache.dir.lengthSq() < 1e-10) hintCache.dir.set(0, -1, 0);
      hintCache.dir.normalize();
      hintCache.axisOk = bestScore >= 0;
      hintCache.axis.copy(a).multiplyScalar(sign);
    }
    function getHint() {
      if (S.stage !== "play") return null;
      let id = S.hint.id, sign = S.hint.sign;
      root.updateMatrixWorld();
      if (id === "knob" && gears.hit.userData.heroEnabled === false) {
        id = IDS[0];
        sign = 1;
      }
      if (id === "knob") {
        gears.hit.getWorldPosition(hintTap.point);
        return hintTap;
      }
      const i = IDS.indexOf(id), c = hintCache;
      const cam = lastCam ? lastCam.position : wv.cam.set(0, 0, 0), w = lastView ? lastView.width : 0;
      const same = c.valid && c.id === i && c.sign === sign && c.w === w && c.cam.distanceToSquared(cam) < 1e-6 && Math.abs(c.th[0] - rings[0].theta) < 0.01 && Math.abs(c.th[1] - rings[1].theta) < 0.01 && Math.abs(c.th[2] - rings[2].theta) < 0.01;
      if (!same) {
        c.valid = true;
        c.id = i;
        c.sign = sign;
        c.w = w;
        c.cam.copy(cam);
        for (let k = 0; k < 3; k++) c.th[k] = rings[k].theta;
        ringHint(i, sign);
      }
      hintOut.id = id;
      hintOut.point.copy(c.point);
      hintOut.dir.copy(c.dir);
      hintOut.axis = c.axisOk ? c.axis : null;
      return hintOut;
    }
    function reset(o = {}) {
      S.stage = "play";
      S.finaleT = 0;
      S.finalePhase = 0;
      S.completeSent = false;
      S.roundHint = true;
      S.lid = 0;
      S.lidKick = 9;
      S.gatedBusy = false;
      fx.beam.visible = fx.sparks.visible = false;
      for (const r of rings) {
        r.theta = r.target = Math.round(r.theta / QUARTER) * QUARTER;
        r.w = 0;
        r.mode = "rest";
        r.tick = Math.round(r.theta / r.step);
        r.wiggle = 0;
        r.lastSign = 0;
      }
      const dp = discretePose();
      if (dp !== poseIndex(0, 0, 0) && dp !== poseIndex(2, 2, 2)) for (const r of rings) {
        r.theta = r.target = 0;
        r.tick = 0;
      }
      knob.queued = false;
      knob.w = 0;
      knob.mode = "rest";
      knob.theta = knob.target = Math.round(knob.theta / Math.PI) * Math.PI;
      if (discreteSw() === 1) {
        knob.tw.from = knob.theta;
        knob.tw.to = knob.theta + Math.PI;
        knob.tw.t = 0;
        knob.mode = "tween";
      }
      knob.tick = Math.round(knob.theta / knob.step);
      layout(Math.max(1, o.round | 0 || S.round + 1));
      emit("stage", { stage: "play" });
      emit("progress", { collected: S.collected, total: S.total });
      sound("whoosh", 0.6);
    }
    function debugAdvance() {
      if (S.stage === "play") {
        const g = S.gems.find((x) => x.state === "move") || S.gems.find((x) => x.state === "rest");
        if (g) collect(g);
      } else if (S.stage === "finale") {
        for (const r of rings) {
          r.theta = r.target;
          r.w = 0;
          r.mode = "rest";
        }
        if (S.finalePhase === 0) {
          S.finalePhase = 1;
          for (const g of S.gems) {
            g.state = "show";
            g.launch = 0.12 + g.i * 0.13;
          }
        }
        S.finaleT = P.finale.show + 0.01;
        updateFinale(0);
      }
    }
    function dispose() {
      root.removeFromParent();
      const geos = /* @__PURE__ */ new Set();
      root.traverse((o) => {
        if (o.geometry) geos.add(o.geometry);
      });
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
      onContextRestored() {
      }
    };
  }
  return __toCommonJS(hero_exports);
})();
