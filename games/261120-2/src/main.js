// main.js — 組み立て: engine / audio / world / 水槽の水 / FX / 金魚 3 びき / story
import { createEngine } from './engine.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { createTankWater, createFX } from './water.js';
import { createFish, createSwimmer } from './fish.js';
import { createStory } from './story.js';

const engine = createEngine({ canvas: document.getElementById('c'), fallbackEl: document.getElementById('fb') });
if (engine) {
  const audio = createAudio();
  const world = buildWorld(engine);
  const tw = createTankWater(engine);
  engine.scene.add(tw.group);
  const fx = createFX(engine);
  engine.scene.add(fx.group);
  const fishes = {};
  for (const kind of ['wakin', 'sarasa', 'ryukin']) {
    const fish = createFish(kind);
    engine.scene.add(fish.group);
    fishes[kind] = { fish, sw: createSwimmer(fish) };
  }
  const story = createStory({ engine, world, tw, fx, audio, fishes });

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
}
