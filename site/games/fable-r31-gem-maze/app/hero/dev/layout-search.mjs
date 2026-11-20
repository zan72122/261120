// 開発用の道具（実行時には読まれない）：レール網の配置を乱数で作り、幅優先探索でふるいにかけ、
// app/hero/layouts.js に貼るデータを出す。
//   node app/hero/dev/layout-search.mjs [試す数=4000] [seed=1]
// ふるい：
//   1. 宝石 1 個がどのノード・姿勢・切替状態からも宝箱へ届く（checkAnyState）。
//   2. ノブ（切替）を使わないと届かない出発点がある（レバーに意味がある）。
//   3. 出発点の組（3〜6 個）ごとに、ヒントどおりに進めて全部集まること（手数・ノブの回数・最初の 1 手も見る）。
// 注（補題）：1 が成り立てば、宝石が何個あっても、どの状態からも必ず 1 個は回収できる。
//   ある宝石 x が 1 個だけのときの手順をそのまま実行する。途中で x が前の宝石 y に止められても、
//   y（列の先頭）は x が 1 個のとき止まるはずの壁で止まるので、「x の予定位置」には必ずどれかの宝石がいる。
//   最後の 1 手でその位置の宝石（か、その前の宝石）が宝箱へ入る（宝箱は詰まらない）。これを繰り返せば全部集まる。
//   3〜4 個の組では、到達しうる全状態の数え上げ（fullCheck）でも同じ結論になることを照合する。
import {
  CENTER, MOVE_KNOB, compileLayout, checkAnyState, findPlan, applyMove, stateKey, remaining,
  neighbor, edgeKey,
} from '../maze.js';

const TRIES = +(process.argv[2] || 4000), SEED = +(process.argv[3] || 1);
const SWITCH = { node: 22, axis: 2 };     // 前面の中心 (1,1,2)。回転台の軸は Z
const KNOB_FACE = 4;                      // ノブは +Z の面
const REMOVED = new Set([20]);            // ノブと歯車が入る角 (2,0,2) にはレールを置かない
const FORCED = [14, 31, 36, 39, 41];      // 宝箱の入口（後・下・左・右・前＝回転台の軸）
const FORBIDDEN = new Set([40]);          // 宝箱の上（ふたが開く側）には入口を作らない

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const OPTIONAL = [];
for (let a = 0; a < 27; a++) for (let axis = 0; axis < 3; axis++) {
  const b = neighbor(a, axis * 2);
  if (b < 0 || REMOVED.has(a) || REMOVED.has(b)) continue;
  const key = edgeKey(a, axis);
  if (FORCED.includes(key) || FORBIDDEN.has(key)) continue;
  if (a === CENTER || b === CENTER) continue;
  OPTIONAL.push(key);
}

function connected(L) {
  const adj = new Map();
  for (const e of L.edges) { (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e.b); (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e.a); }
  const seen = new Set([CENTER]); const q = [CENTER];
  while (q.length) { const x = q.pop(); for (const y of adj.get(x) || []) if (!seen.has(y)) { seen.add(y); q.push(y); } }
  return seen.size === adj.size;
}

// ヒントどおりに最後まで進める
function playout(L, gems) {
  let st = { pose: 0, sw: 0, gems: gems.slice() };
  const moves = [], lens = [];
  for (let guard = 0; guard < 60 && remaining(st.gems) > 0; guard++) {
    const plan = findPlan(L, st);      // 実行時と同じ上限
    if (!plan) return null;
    lens.push(plan.moves.length);
    for (const m of plan.moves) { st = applyMove(L, st, m); moves.push(m); }
  }
  return remaining(st.gems) === 0 ? { moves, lens } : null;
}

// 到達しうる全状態から全部集まるか
function fullCheck(L, gems, cap = 250000) {
  const start = { pose: 0, sw: 0, gems: gems.slice() };
  const ids = new Map([[stateKey(start), 0]]);
  const states = [start], rev = [[]], goal = [];
  for (let i = 0; i < states.length; i++) {
    const st = states[i];
    if (remaining(st.gems) === 0) { goal.push(i); continue; }
    for (let m = 0; m <= MOVE_KNOB; m++) {
      const ns = applyMove(L, st, m);
      if (!ns) continue;
      const key = stateKey(ns);
      let j = ids.get(key);
      if (j === undefined) { j = states.length; ids.set(key, j); states.push(ns); rev.push([]); if (states.length > cap) return { ok: false, states: states.length, capped: true }; }
      rev[j].push(i);
    }
  }
  const ok = new Uint8Array(states.length);
  const q = goal.slice(); for (const g of q) ok[g] = 1;
  while (q.length) { const x = q.pop(); for (const y of rev[x]) if (!ok[y]) { ok[y] = 1; q.push(y); } }
  let bad = 0; for (let i = 0; i < states.length; i++) if (!ok[i]) bad++;
  return { ok: bad === 0, states: states.length, bad };
}

const rnd = mulberry(SEED);
const found = [];
for (let t = 0; t < TRIES; t++) {
  const p = 0.45 + rnd() * 0.3;
  const edges = FORCED.slice();
  for (const k of OPTIONAL) if (rnd() < p) edges.push(k);
  const def = { name: `s${SEED}-${t}`, edges, switch: SWITCH, knobFace: KNOB_FACE };
  const L = compileLayout(def);
  if (L.edges.length < 30 || L.edges.length > 40 || L.nodes.length < 22) continue;
  if (!connected(L)) continue;
  // 回転台には X・Y の両方の辺が要る（合わせて 3 本以上）
  const sx = L.edges.filter((e) => (e.a === 22 || e.b === 22) && e.gate === 0).length;
  const sy = L.edges.filter((e) => (e.a === 22 || e.b === 22) && e.gate === 1).length;
  if (!sx || !sy || sx + sy < 3) continue;
  const any = checkAnyState(L);
  if (!any.ok || any.worst > 9) continue;
  // ノブなしで届かない出発点
  const noKnob = checkAnyState(compileLayout({ ...def, knobFace: -1 }));
  const rest = L.nodes.filter((n) => L.next[0][n * 6 + 3] < 0);          // 正位置（重力 −Y、切替 0）で止まっていられるノード
  const needKnob = rest.filter((n) => noKnob.dist[noKnob.id(n, 0, 0)] < 0);
  const easy = rest.filter((n) => any.dist[any.id(n, 0, 0)] <= 2 && !needKnob.includes(n));
  if (needKnob.length < 1 || easy.length < 3 || rest.length < 8) continue;

  // 出発点の組：外リング 1 手で入る宝石 1 個 ＋ ノブが要る宝石 1 個 ＋ 近い宝石（4 手以内）
  const home = { pose: 0, sw: 0, gems: [0] };
  const quick = rest.filter((n) => { home.gems[0] = n; return [0, 1].some((m) => applyMove(L, home, m).gems[0] < 0); });
  const knobs = needKnob.filter((n) => any.dist[any.id(n, 0, 0)] <= 6);
  const near = rest.filter((n) => any.dist[any.id(n, 0, 0)] <= 4 && !needKnob.includes(n));
  if (!quick.length || !knobs.length || near.length < 5) continue;
  const starts = {};
  let good = true;
  for (const N of [3, 4, 5, 6]) {
    const sets = [];
    for (let k = 0; k < 80 && sets.length < 2; k++) {
      const pick = [quick[(rnd() * quick.length) | 0], knobs[(rnd() * knobs.length) | 0]];
      const pool = near.filter((n) => !pick.includes(n));
      while (pick.length < N && pool.length) pick.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
      if (pick.length < N || new Set(pick).size < N) continue;
      pick.sort((x, y) => x - y);
      if (sets.some((s) => s.gems.join() === pick.join())) continue;
      const po = playout(L, pick);
      if (!po) continue;
      const nk = po.moves.filter((m) => m === MOVE_KNOB).length;
      const total = po.moves.length;
      if (nk < 1 || nk > 2) continue;
      if (po.moves[0] > 1 || po.lens[0] !== 1) continue;                  // 最初の 1 手は外リングで、すぐ 1 個入る
      if (Math.max(...po.lens) > 5) continue;
      if (total < N * 1.3 || total > N * 2.6 + 1) continue;
      // 照合：3〜4 個のときは到達しうる全状態を数え上げ、補題（下の注）と食い違わないことを見る
      const fc = N <= 4 ? fullCheck(L, pick) : { ok: true, states: 0, capped: true };
      if (!fc.ok && !fc.capped) { console.error('  補題に反する配置!?', def.name, pick.join()); continue; }
      sets.push({ gems: pick, moves: po.moves, lens: po.lens, states: fc.capped ? 0 : fc.states });
    }
    if (!sets.length) { good = false; break; }
    starts[N] = sets;
  }
  if (!good) continue;
  found.push({ def, L, any, starts, needKnob: needKnob.length, rest: rest.length });
  console.error(`found ${def.name}: edges ${L.edges.length} nodes ${L.nodes.length} worst ${any.worst} needKnob ${needKnob.length}/${rest.length}`);
}

console.error(`\n${found.length} layouts from ${TRIES} tries`);
for (const f of found) {
  const starts = {};
  for (const N in f.starts) starts[N] = f.starts[N].map((s) => s.gems);
  console.log(JSON.stringify({ name: f.def.name, edges: f.def.edges.slice().sort((a, b) => a - b), starts,
    info: { edges: f.L.edges.length, nodes: f.L.nodes.length, worst: f.any.worst, needKnob: f.needKnob, rest: f.rest,
      play: Object.fromEntries(Object.entries(f.starts).map(([N, s]) => [N, s.map((x) => ({ moves: x.moves.join(''), states: x.states }))])) } }));
}
