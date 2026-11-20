import * as THREE from 'three';
import { createAssetLoader, createContactShadowTexture } from './assets.js';
import { buildKitchen } from './kitchen.js';
import { buildFridge } from './fridge.js';
import { createKraftShoppingBag, createGroceries } from './groceries.js';
import { createAudioEngine } from './audio.js';
import { createGameController } from './game.js';

const params = new URLSearchParams(window.location.search);
const container = document.getElementById('app');
const veil = document.getElementById('veil');

// --- 1. RENDERER (WebGL2, AgX Tone Mapping, sRGB, Dynamic Mobile PixelRatio) ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
const maxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
let currentDpr = maxDpr;
renderer.setPixelRatio(currentDpr);
container.appendChild(renderer.domElement);

// --- 2. SCENE & DEDICATED PORTRAIT vs LANDSCAPE CAMERA LAYOUT ---
const scene = new THREE.Scene();
scene.background = new THREE.Color('#dbd2c6');

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 18);
const layoutCamPos = new THREE.Vector3();
const layoutCamTarget = new THREE.Vector3();
let lastW = 0;
let lastH = 0;

function syncViewportSize() {
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  if (w === lastW && h === lastH) return;
  lastW = w;
  lastH = h;
  const aspect = w / Math.max(1, h);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // Dedicated Portrait framing (e.g. iPhone 390x844):
    camera.fov = 46;
    layoutCamPos.set(0.01, 0.43, 1.84);
    layoutCamTarget.set(0.02, 0.21, 0.08);
  } else {
    // Dedicated Landscape framing (e.g. iPad 1024x768):
    camera.fov = 40;
    layoutCamPos.set(-0.04, 0.41, 1.56);
    layoutCamTarget.set(0.04, 0.20, 0.06);
  }
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
syncViewportSize();
window.addEventListener('resize', syncViewportSize);

// --- 3. LIGHTING (HDRI Environment + Single Shadow-Casting Morning Sun Key Light) ---
const keyLight = new THREE.DirectionalLight('#fff5e6', 2.0);
keyLight.position.set(-1.55, 2.35, 1.95);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 6.2;
keyLight.shadow.camera.left = -1.25;
keyLight.shadow.camera.right = 1.25;
keyLight.shadow.camera.top = 1.25;
keyLight.shadow.camera.bottom = -1.05;
keyLight.shadow.bias = -0.00045;
keyLight.shadow.normalBias = 0.016;
keyLight.shadow.radius = 2.6;
scene.add(keyLight);

const hemiBounce = new THREE.HemisphereLight('#f2ede4', '#857462', 0.30);
scene.add(hemiBounce);

// --- 4. LOAD ALL BUNDLED CC0 ASSETS & START INTERACTIVE KITCHEN ---
const loader = createAssetLoader(renderer);
const pbr = loader.loadPBRSets();
const contactShadowTex = createContactShadowTexture();
const audio = createAudioEngine();

async function init() {
  const modelKeys = [
    'food_apple_01',
    'food_pears_asian_01',
    'lemon',
    'food_lime_01',
    'bananas',
    'food_avocado_01',
    'yellow_onion',
    'sweet_potato',
    'food_ginger_01',
    'wooden_cutting_board',
  ];

  // Load HDRI first, then models in small batches of 4 to avoid HTTP/1.1 connection bursts on mobile
  const envRT = await loader.loadHDRI('./assets/hdri/blinds_1k.hdr');
  const models = {};
  for (let i = 0; i < modelKeys.length; i += 4) {
    const slice = modelKeys.slice(i, i + 4);
    const loaded = await Promise.all(slice.map((k) => loader.loadGLTF(`./assets/models/${k}/${k}_1k.gltf`)));
    slice.forEach((k, idx) => { models[k] = loaded[idx]; });
  }

  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.72;

  const kitchenBundle = buildKitchen(pbr, models.wooden_cutting_board, contactShadowTex);
  scene.add(kitchenBundle.kitchen);

  const fridge = buildFridge(pbr);
  fridge.setCrisperTarget(0.095);
  scene.add(fridge.root);

  const bag = createKraftShoppingBag(pbr, contactShadowTex);
  bag.position.set(-0.135, 0.0, 0.555);
  bag.rotation.y = 0.24;
  scene.add(bag);

  const groceries = createGroceries(models, pbr, contactShadowTex);
  for (const item of groceries) {
    scene.add(item.root);
  }

  const game = createGameController({
    scene,
    camera,
    renderer,
    fridge,
    kitchenBundle,
    bag,
    groceries,
    audio,
  });

  // Optional showcase preview states via URL query (zero text, strictly for visual QA of mid-game & pour states!)
  const demoState = params.get('demo');
  if (demoState === 'stored') {
    game.__test.storeSampleGroceries();
  } else if (demoState === 'pour') {
    game.__test.storeSampleGroceries();
    game.__test.setFilledMilk(0.62);
    game.__test.triggerPour();
  }

  veil.classList.add('hidden');
  setTimeout(() => { veil.style.display = 'none'; }, 700);

  let fpsAvg = 60;
  let lowFpsTimer = 0;
  window.__PERF__ = () => ({
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
    pixelRatio: renderer.getPixelRatio(),
    fps: Math.round(fpsAvg),
    ...game.getState(),
  });

  const showPerfTitle = params.get('perf') === '1';
  let prev = performance.now();
  let lastPerfPush = 0;
  let warmupFrames = 6;

  function animate(now) {
    requestAnimationFrame(animate);
    syncViewportSize();

    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    if (dt > 0) fpsAvg = fpsAvg * 0.92 + (1 / dt) * 0.08;

    // Dynamic mobile PixelRatio safeguard (drops cleanly toward 1.0 if sustained < 28fps)
    if (fpsAvg < 28 && currentDpr > 1.0) {
      lowFpsTimer += dt;
      if (lowFpsTimer > 2.0) {
        currentDpr = Math.max(1.0, Number((currentDpr - 0.25).toFixed(2)));
        renderer.setPixelRatio(currentDpr);
        lowFpsTimer = 0;
      }
    } else {
      lowFpsTimer = 0;
    }

    const fridgeMoved = fridge.update(dt);
    const gameMoved = game.update(dt, now / 1000, layoutCamPos, layoutCamTarget);
    if (warmupFrames > 0 || fridgeMoved || gameMoved) {
      renderer.shadowMap.needsUpdate = true;
      if (warmupFrames > 0) warmupFrames--;
    }
    renderer.render(scene, camera);

    if (showPerfTitle && now - lastPerfPush > 400) {
      lastPerfPush = now;
      const p = window.__PERF__();
      document.title = `PERF tris=${p.triangles} calls=${p.calls} tex=${p.textures} geo=${p.geometries} dpr=${p.pixelRatio} fps=${p.fps} stored=${p.storedCount} milk=${p.milkFill} phase=${p.handoverPhase}`;
    }
  }
  requestAnimationFrame(animate);
}

init().catch((err) => {
  console.error('Scene init failed:', err);
});
