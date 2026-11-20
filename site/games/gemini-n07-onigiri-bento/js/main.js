import { buildBentoScene } from './scene.js';
import { createBentoGame } from './game.js';

const canvas = document.getElementById('app-canvas');
buildBentoScene(canvas)
  .then((sceneCtx) => {
    createBentoGame(sceneCtx);
  })
  .catch((err) => {
    console.error('Onigiri Bento init failed:', err);
  });
