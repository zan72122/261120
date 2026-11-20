import * as THREE from 'three';
import { buildBalconyScene } from './scene.js';
import { createLaundryGame } from './game.js';

const params = new URLSearchParams(window.location.search);

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.09;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let currentDPR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(currentDPR);

const camera = new THREE.PerspectiveCamera(45, 1, 0.08, 60);

let lastW = 0;
let lastH = 0;

function syncViewportSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w === lastW && h === lastH) return;
  lastW = w;
  lastH = h;
  renderer.setSize(w, h, true);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

syncViewportSize();
window.addEventListener('resize', syncViewportSize);

async function init() {
  const world = await buildBalconyScene(renderer, { hdriName: 'suburban_garden' });
  const game = await createLaundryGame({ world, camera, renderer });

  // Optional silent URL query stage preview for QA testing (normal play starts in basket)
  const previewStage = params.get('stage');
  if (previewStage && window.__GAME) {
    window.__GAME.fastForwardToStage(previewStage);
  }

  window.__SCENE_READY = true;
  window.__DEBUG_STATS = () => ({
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
    dpr: currentDPR,
  });

  const clock = new THREE.Clock();
  let slowFrames = 0;
  let loggedStats = false;

  function animate() {
    requestAnimationFrame(animate);
    syncViewportSize();

    const dt = clock.getDelta();
    const elapsed = clock.elapsedTime;

    // Gentle dynamic DPR guard for older mobile devices (keeps 30-60fps smoothly)
    if (dt > 0.042 && currentDPR > 1.0) {
      slowFrames++;
      if (slowFrames > 25) {
        currentDPR = Math.max(1.0, Number((currentDPR - 0.25).toFixed(2)));
        renderer.setPixelRatio(currentDPR);
        slowFrames = 0;
      }
    } else if (slowFrames > 0) {
      slowFrames--;
    }

    game.update(dt, elapsed);
    renderer.render(world.scene, camera);

    if (!loggedStats && params.get('debug') === '1' && elapsed > 0.6) {
      loggedStats = true;
      const st = window.__DEBUG_STATS();
      document.title = `STATS:${st.triangles}tri/${st.calls}calls/${st.textures}tex/dpr${st.dpr}`;
    }
  }
  animate();
}

init().catch((err) => {
  console.error('Laundry game init failed:', err);
});
