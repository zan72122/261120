// 立体レール網の離散モデル（THREE に依存しない純粋な論理。hero と dev/ の探索道具の両方が使う）。
//
// ・ノード：3×3×3 格子。番号 n = i + 3j + 9k（i,j,k ∈ {0,1,2} が x,y,z）。中心 13 が宝箱。
// ・向き d：0:+X 1:−X 2:+Y 3:−Y 4:+Z 5:−Z（立方体ローカル）。
// ・姿勢：リング角を 90° 刻みで (a,b,c) ∈ Z4³。R_cube = Rz(a)·Rx(b)·Ry(c)、立方体ローカルの重力 g = R^T·(0,−1,0)。
// ・切替（回転台）：switch.node の、switch.axis に垂直な 2 軸のうち、状態 0 で第1軸・状態 1 で第2軸の辺だけが通れる。
// ・1 手 = リング 1 本を ±90°、またはノブ 1 回。そのあと宝石は重力の向きへ「止まるまで」滑る（決定的）。

export const CENTER = 13;
export const DIR_VEC = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
export const OPP = [1, 0, 3, 2, 5, 4];
export const MOVE_KNOB = 6;                       // 手の番号：0..5 = リング(i = m>>1) の +/−（m&1）、6 = ノブ
export const MOVE_IDS = ['ring-outer', 'ring-middle', 'ring-inner', 'knob'];

export const nodeIndex = (i, j, k) => i + 3 * j + 9 * k;
export const nodeCoord = (n) => [n % 3, ((n / 3) | 0) % 3, (n / 9) | 0];
export function neighbor(n, d) {
  const c = nodeCoord(n), v = DIR_VEC[d];
  const i = c[0] + v[0], j = c[1] + v[1], k = c[2] + v[2];
  if (i < 0 || i > 2 || j < 0 || j > 2 || k < 0 || k > 2) return -1;
  return nodeIndex(i, j, k);
}
// 無向辺のキー：小さい方のノード a と軸（0:X 1:Y 2:Z）で a*3+axis。
export const edgeKey = (a, axis) => a * 3 + axis;
export const edgeOfKey = (key) => { const a = (key / 3) | 0, axis = key % 3; return { a, axis, b: neighbor(a, axis * 2) }; };

// ---------- 姿勢の表（64 通り）
const RZ = [[0, -1, 0], [1, 0, 0], [0, 0, 1]], RX = [[1, 0, 0], [0, 0, -1], [0, 1, 0]], RY = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function mul(A, B) {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r][c] = A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c];
  return C;
}
function pow(M, n) { let R = I3; for (let i = 0; i < (n & 3); i++) R = mul(R, M); return R; }
function dirOf(x, y, z) { return x > 0 ? 0 : x < 0 ? 1 : y > 0 ? 2 : y < 0 ? 3 : z > 0 ? 4 : 5; }

export const poseIndex = (a, b, c) => (a & 3) + 4 * (b & 3) + 16 * (c & 3);
export const poseAngles = (p) => [p & 3, (p >> 2) & 3, (p >> 4) & 3];
export const POSE_GRAV = new Uint8Array(64);      // 姿勢 → 立方体ローカルの重力の向き
export const POSE_FRONT = new Uint8Array(64);     // 姿勢 → ワールド +Z（カメラ側）を向く立方体ローカルの向き
export const POSE_MOVE = new Uint8Array(64 * 6);  // 姿勢 × リングの手 → 次の姿勢
for (let p = 0; p < 64; p++) {
  const [a, b, c] = poseAngles(p);
  const R = mul(mul(pow(RZ, a), pow(RX, b)), pow(RY, c));
  POSE_GRAV[p] = dirOf(-R[1][0], -R[1][1], -R[1][2]);      // R^T·(0,−1,0) = −(R の第2行)
  POSE_FRONT[p] = dirOf(R[2][0], R[2][1], R[2][2]);         // R^T·(0,0,1) = R の第3行
  const ang = [a, b, c];
  for (let m = 0; m < 6; m++) {
    const q = ang.slice(); q[m >> 1] += (m & 1) ? -1 : 1;
    POSE_MOVE[p * 6 + m] = poseIndex(q[0], q[1], q[2]);
  }
}

// ---------- 配置の準備
// def = { name, edges:[key…], switch:{node, axis}, knobFace: 向き, starts:{ '3':[[n…]…], … } }
export function compileLayout(def) {
  const sw = def.switch;
  const planeAxes = [0, 1, 2].filter((x) => x !== sw.axis);       // 状態 0 で planeAxes[0]、状態 1 で planeAxes[1] が通る
  const next = [new Int8Array(162).fill(-1), new Int8Array(162).fill(-1)];
  const hasNode = new Uint8Array(27);
  const edges = [];
  for (const key of def.edges) {
    const { a, axis, b } = edgeOfKey(key);
    if (b < 0) continue;
    let gate = -1;                                                // −1：いつも通れる。0/1：その切替状態のときだけ
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

// ---------- 滑り（止まるまで）。gems は各宝石のノード（回収済みは −1）。同じ配列の順で結果を返す。
// 戻り値 paths[i] = 通ったノードの列（今いるノードから。動かなければ長さ 1）。最後が CENTER なら回収。
const _ord = [];
export function slide(L, gems, d, sw, paths) {
  const nx = L.next[sw];
  const v = DIR_VEC[d];
  const out = gems.slice();
  _ord.length = 0;
  for (let i = 0; i < gems.length; i++) if (gems[i] >= 0) _ord.push(i);
  // 重力の向きに進んでいるものから処理（同じ直線上の前の宝石が先に動く）
  _ord.sort((x, y) => {
    const cx = nodeCoord(gems[x]), cy = nodeCoord(gems[y]);
    return (cy[0] * v[0] + cy[1] * v[1] + cy[2] * v[2]) - (cx[0] * v[0] + cx[1] * v[1] + cx[2] * v[2]);
  });
  for (const i of _ord) {
    let n = out[i];
    const path = paths ? (paths[i] = [n]) : null;
    for (;;) {
      const m = nx[n * 6 + d];
      if (m < 0) break;
      if (m === CENTER) { n = -1; if (path) path.push(CENTER); break; }
      let occupied = false;
      for (let j = 0; j < out.length; j++) if (j !== i && out[j] === m) { occupied = true; break; }
      if (occupied) break;
      n = m; out[i] = n;
      if (path) path.push(n);
    }
    out[i] = n;
  }
  return out;
}

export const knobUsable = (L, pose) => POSE_FRONT[pose] === L.knobFace;

// 1 手を当てる。st = {pose, sw, gems}（gems は順序つき、回収済み −1）。使えない手は null。
export function applyMove(L, st, m, paths) {
  let pose = st.pose, sw = st.sw;
  if (m === MOVE_KNOB) { if (!knobUsable(L, pose)) return null; sw ^= 1; } else pose = POSE_MOVE[pose * 6 + m];
  return { pose, sw, gems: slide(L, st.gems, POSE_GRAV[pose], sw, paths) };
}

// 状態のキー（宝石は区別しない）。姿勢 6bit・切替 1bit・宝石 5bit×6。2^53 未満の数。
const _sorted = [];
export function stateKey(st) {
  _sorted.length = 0;
  for (const g of st.gems) if (g >= 0) _sorted.push(g);
  _sorted.sort((x, y) => x - y);
  let k = st.pose * 2 + st.sw;
  for (let i = 0; i < 6; i++) k = k * 32 + (i < _sorted.length ? _sorted[i] : 31);
  return k;
}
export const remaining = (gems) => { let c = 0; for (const g of gems) if (g >= 0) c++; return c; };

// ---------- ヒント用の探索：今の状態から「回収数が増える」最短の手順（幅優先）。
// 手の並び（外+ 外− 中+ 中− 内+ 内− ノブ）の順に調べるので、同じ長さなら 外→中→内→ノブ を優先する。
export function findPlan(L, st, maxStates = 6000, maxDepth = 12) {
  const start = remaining(st.gems);
  if (start === 0) return null;
  const seen = new Set([stateKey(st)]);
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

// 手順をたどって、各宝石が通る辺（有向：from → to）を集める。光の筋に使う。
// 戻り値 { segs:[{from,to,gem,step}], collected:[gem…] }
export function tracePlan(L, st, moves) {
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

// ---------- 保証：宝石 1 個がどのノード・どの姿勢・どの切替状態にあっても、宝箱へ届く手順がある。
// （26 ノード × 64 姿勢 × 2 切替 = 3,328 状態の逆向き到達。1ms 程度）
// 戻り値 { ok, worst: いちばん遠い状態の手数, bad: 届かない状態の数 }
export function checkAnyState(L) {
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
    for (const x of q) for (const y of rev[x]) if (dist[y] < 0) { dist[y] = dist[x] + 1; worst = Math.max(worst, dist[y]); nq.push(y); }
    q = nq;
  }
  let bad = 0;
  for (const n of L.nodes) for (let pose = 0; pose < 64; pose++) for (let sw = 0; sw < 2; sw++) if (dist[id(n, pose, sw)] < 0) bad++;
  return { ok: bad === 0, worst, bad, dist, id };
}
