// main.js — 組み立て: engine / audio / world / 水槽の水 / FX / 金魚 3 びき / story
//
// 起動の順番（最初の場面をできるだけ早く出し、残りは遊んでいる間に裏で用意する）
//   0. HTML だけの下地（壁とテーブルの色 + ぷくぷく泡）がすぐ出る。重い処理はその絵が出てから始める。
//   1. 金魚のテクスチャの画素計算を Worker で裏に投げる（メインは並行して部屋を作る）。
//   2. 部屋・水槽・水・FX を作り、見えている物のシェーダを先に compile（GPU 側で並行して進む）。
//   3. Worker の画素で金魚を作り、story を作って描画開始。最初の絵が出たら下地をふわっと消す。
//   4. 隠れている物（後の道具の粒子・指のお手本など）のシェーダとテクスチャは engine が遊んでいる間に少しずつ用意。
import { createEngine } from './engine.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { createTankWater, createFX } from './water.js';
import { createFish, createSwimmer, startFishPixels } from './fish.js';
import { createStory } from './story.js';

const KINDS = ['wakin', 'sarasa', 'ryukin'];

// 1 回描かせてから続ける（下地の絵を先に出す）。rAF が来ない状況でも止まらないように時間でも進める
function nextPaint() {
  return new Promise((resolve) => {
    let done = false;
    const go = () => { if (!done) { done = true; resolve(); } };
    try { requestAnimationFrame(() => setTimeout(go, 0)); } catch (e) { /* ignore */ }
    setTimeout(go, 120);
  });
}
const nextTask = () => new Promise((r) => setTimeout(r, 0));

const loader = document.getElementById('ld');
function hideLoader(now) {
  if (!loader) return;
  if (now) { loader.remove(); return; }
  loader.classList.add('out');
  setTimeout(() => loader.remove(), 700);
}

async function boot() {
  const pixels = startFishPixels(KINDS); // 先に裏で計算を始める
  await nextPaint();
  await pixels.waitStart(60); // Worker が動き出すのを少しだけ待つ（メインが忙しいと起動しないブラウザがある）

  const engine = createEngine({ canvas: document.getElementById('c'), fallbackEl: document.getElementById('fb') });
  if (!engine) { hideLoader(true); return; }
  const audio = createAudio();
  const world = buildWorld(engine);
  await nextTask();
  const tw = createTankWater(engine);
  engine.scene.add(tw.group);
  const fx = createFX(engine);
  engine.scene.add(fx.group);
  engine.precompile(); // 部屋・水のシェーダを GPU へ。魚を作っている間に進む
  await nextTask();

  const fishes = {};
  for (const kind of KINDS) {
    const pre = await pixels.get(kind);
    const fish = createFish(kind, pre);
    engine.scene.add(fish.group);
    fishes[kind] = { fish, sw: createSwimmer(fish) };
  }
  const story = createStory({ engine, world, tw, fx, audio, fishes });
  engine.precompile();

  engine.onUpdate((dt, t) => {
    story.update(dt, t);
    for (const k in fishes) fishes[k].sw.update(dt, t);
    world.update(dt, t);
    tw.update(dt, t);
    fx.update(dt, t);
  });
  engine.onPause(() => audio.suspend());
  engine.onResume(() => audio.resume());
  window.__gf = { engine, world, story, audio, tw, fx, fish: fishes };
  engine.start();
  // engine の最初のフレーム（描画）のあとで下地を消す
  requestAnimationFrame(() => requestAnimationFrame(() => hideLoader(false)));
  setTimeout(() => hideLoader(false), 6000); // rAF が止まっていても下地が残り続けないように
}

boot().catch((e) => {
  console.error('[main] boot failed', e);
  const fb = document.getElementById('fb');
  if (fb) fb.style.display = 'block';
  const c = document.getElementById('c');
  if (c) c.style.display = 'none';
  hideLoader(true);
});
