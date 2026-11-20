import * as THREE from 'three';
import { loadAllAssets } from './assets.js';
import { createPhotorealScene } from './scene.js';
import { createFoleyAudio } from './audio.js';
import { setupInteraction } from './interaction.js';

async function init() {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });

  const params = new URLSearchParams(window.location.search);
  const tmParam = params.get('tm') || 'aces';
  renderer.toneMapping = tmParam === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = tmParam === 'agx' ? 1.06 : 1.00;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let currentDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(currentDpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  document.body.appendChild(renderer.domElement);

  const assets = await loadAllAssets(renderer);
  const world = createPhotorealScene(renderer, assets);
  const audio = createFoleyAudio();
  const interaction = setupInteraction(renderer, world, assets, audio);

  // Live canvas size sync (handles window resize, iOS Safari toolbar collapse, and responsive orientation changes)
  let lastW = 0;
  let lastH = 0;
  function syncViewportSize() {
    const w = renderer.domElement.clientWidth || window.innerWidth;
    const h = renderer.domElement.clientHeight || window.innerHeight;
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      renderer.setPixelRatio(currentDpr);
      renderer.setSize(w, h, false);
      world.applyResponsiveLayout(w, h);
    }
  }
  syncViewportSize();
  window.addEventListener('resize', syncViewportSize);

  // Dynamic DPR governor for smooth 30–60fps on iPhone/iPad
  const clock = new THREE.Clock();
  let frameCount = 0;
  let fpsAccum = 0;
  let fpsFrames = 0;

  function animate() {
    requestAnimationFrame(animate);
    syncViewportSize();

    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    world.stickerStack.update(dt, elapsed);
    world.notebook.update(dt);
    interaction.update(dt, elapsed);

    renderer.render(world.scene, world.camera);

    frameCount++;
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum >= 1.5) {
      const avgFps = fpsFrames / fpsAccum;
      const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (avgFps < 36 && currentDpr > 1.0) {
        currentDpr = Math.max(1.0, +(currentDpr - 0.15).toFixed(2));
        renderer.setPixelRatio(currentDpr);
        renderer.setSize(lastW, lastH, false);
      } else if (avgFps > 54 && currentDpr < maxDpr) {
        currentDpr = Math.min(maxDpr, +(currentDpr + 0.1).toFixed(2));
        renderer.setPixelRatio(currentDpr);
        renderer.setSize(lastW, lastH, false);
      }
      fpsAccum = 0;
      fpsFrames = 0;
    }

    if (frameCount === 5) {
      window.__SCENE_READY__ = {
        toneMapping: tmParam,
        triangles: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        dpr: currentDpr,
        width: lastW,
        height: lastH,
      };
    }
  }
  animate();
}

init().catch((err) => {
  console.error('Init failed:', err);
});
