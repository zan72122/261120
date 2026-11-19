import * as THREE from 'three';
import { audio } from './audio.js';
import { createCheckoutCounter } from './counter.js';
import { createShoppingBag } from './bag.js';
import { createCustomer } from './customer.js';
import { createGameController } from './interaction.js';

// --- 1. WebGL Renderer with Photorealistic Tone Mapping & Soft Shadows ---
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.90;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c8baa6');
scene.fog = new THREE.Fog('#c8baa6', 4.8, 10.5);

// --- 2. Procedural Supermarket Ceiling Lightbox Environment Map (PMREM) ---
// Gives stainless steel, glass jars, clear berry packs, apples & coins authentic crisp store reflections!
function createSupermarketEnvMap() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#7a6e60');

  // Enclosing soft studio-store box
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(10, 6, 10),
    new THREE.MeshBasicMaterial({ color: '#9c8f7e', side: THREE.BackSide })
  );
  envScene.add(room);

  // Bright overhead supermarket linear LED light panels (create authentic specular strips!)
  const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 4.35, 4.0) });
  [-2.6, 0, 2.6].forEach((px) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 6.5), panelMat);
    strip.rotation.x = Math.PI / 2;
    strip.position.set(px, 2.95, 0);
    envScene.add(strip);
  });

  // Warm bakery-aisle soft bounce panel on left
  const warmBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.45, 0.95) })
  );
  warmBounce.rotation.y = Math.PI / 2;
  warmBounce.position.set(-4.9, 0.8, 0);
  envScene.add(warmBounce);

  // Cool refrigerated produce/dairy aisle bounce on right
  const coolBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.55, 1.95) })
  );
  coolBounce.rotation.y = -Math.PI / 2;
  coolBounce.position.set(4.9, 0.8, 0);
  envScene.add(coolBounce);

  // Soft overhead skylight front fill
  const frontFill = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 2.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 2.05) })
  );
  frontFill.rotation.y = Math.PI;
  frontFill.position.set(0, 1.8, 4.9);
  envScene.add(frontFill);

  const rt = pmrem.fromScene(envScene, 0.03);
  pmrem.dispose();
  return rt.texture;
}

scene.environment = createSupermarketEnvMap();
scene.environmentIntensity = 0.68;

// --- 3. Three-Point + Overhead Supermarket Lighting ---
const hemiLight = new THREE.HemisphereLight('#fff7e8', '#5e4e3e', 0.42);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight('#fff5e4', 1.85);
keyLight.position.set(1.4, 3.3, 2.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 8.0;
keyLight.shadow.camera.left = -1.6;
keyLight.shadow.camera.right = 1.6;
keyLight.shadow.camera.top = 1.4;
keyLight.shadow.camera.bottom = -1.2;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.normalBias = 0.015;
scene.add(keyLight);

const coolFill = new THREE.DirectionalLight('#c4e0ff', 0.48);
coolFill.position.set(-2.3, 2.0, 1.2);
scene.add(coolFill);

const rimLight = new THREE.DirectionalLight('#ffd7a6', 0.78);
rimLight.position.set(0.3, 2.2, -2.3);
scene.add(rimLight);

// --- 4. Responsive Camera (Tuned for iPad Landscape 4:3 AND iPhone Portrait!) ---
const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.08, 25);

function updateCameraLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  renderer.setSize(w, h);
  camera.aspect = aspect;

  // World counter spans approximately x in [-0.94, +0.76] (visual center ~ -0.09, half-width ~ 0.94)
  if (aspect >= 1.05) {
    // Landscape (iPad 4:3, desktop 16:9): intimate, crisp photorealistic product framing with friendly customer clearly visible!
    camera.fov = aspect < 1.45 ? 36 : 34;
    const halfFovV = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const neededHalfW = 0.98;
    const dist = Math.max(1.94, neededHalfW / (Math.tan(halfFovV) * aspect));
    const elev = 0.56; // ~32 deg natural clerk eye-level looking slightly down across counter & customer!
    const targetX = -0.07;
    const targetY = 0.22;
    const targetZ = -0.10;
    camera.position.set(targetX, targetY + Math.sin(elev) * dist, targetZ + Math.cos(elev) * dist);
    camera.lookAt(targetX, targetY, targetZ);
  } else {
    // Portrait (iPhone vertical, iPad vertical): centered & generous horizontal fit with zero clipping on belt & bag!
    camera.fov = 44;
    const halfFovV = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const neededHalfW = 1.06;
    const dist = Math.min(4.35, Math.max(2.45, neededHalfW / (Math.tan(halfFovV) * aspect)));
    const elev = 0.70; // ~40 deg so full customer head+hands + belt + scanner + bag all shine!
    const targetX = -0.10;
    const targetY = 0.16;
    const targetZ = -0.08;
    camera.position.set(targetX, targetY + Math.sin(elev) * dist, targetZ + Math.cos(elev) * dist);
    camera.lookAt(targetX, targetY, targetZ);
  }
  camera.updateProjectionMatrix();
}

updateCameraLayout();
window.addEventListener('resize', updateCameraLayout);

// --- 5. Subtle Realistic Sparkle Glints Particle Pool (scan bursts & golden glints) ---
const sparkles = [];
const sparkleGeo = new THREE.OctahedronGeometry(0.015, 0);

function spawnSparkles(origin, colorHex = 0xffe46b, count = 12) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(sparkleGeo, mat);
    m.position.copy(origin);
    const a = Math.random() * Math.PI * 2;
    const speed = 0.35 + Math.random() * 0.65;
    const vy = 0.45 + Math.random() * 0.75;
    scene.add(m);
    sparkles.push({
      mesh: m,
      vel: new THREE.Vector3(Math.cos(a) * speed, vy, Math.sin(a) * speed),
      life: 0,
      maxLife: 0.48 + Math.random() * 0.35,
      spin: (Math.random() - 0.5) * 14,
    });
  }
}

function updateSparkles(dt) {
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const sp = sparkles[i];
    sp.life += dt;
    if (sp.life >= sp.maxLife) {
      scene.remove(sp.mesh);
      sp.mesh.material.dispose();
      sparkles.splice(i, 1);
      continue;
    }
    const u = sp.life / sp.maxLife;
    sp.vel.y -= dt * 2.4;
    sp.mesh.position.addScaledVector(sp.vel, dt);
    sp.mesh.rotation.y += sp.spin * dt;
    sp.mesh.rotation.x += sp.spin * 0.7 * dt;
    sp.mesh.scale.setScalar(Math.sin(u * Math.PI) * 1.15);
    sp.mesh.material.opacity = 1 - u;
  }
}

// --- 6. Assemble Scene Entities ---
const counter = createCheckoutCounter(scene);
const bag = createShoppingBag(scene);
const customer = createCustomer(scene);
const game = createGameController({
  scene,
  camera,
  renderer,
  counter,
  bag,
  customer,
  spawnSparkles,
});

// Expose lightweight debug hook solely for verification screenshot framing if needed (no UI impact)
window.__supermarketGame = { game, counter, bag, customer, scene, camera, renderer };

// --- 7. Sound Mute Toggle Button (Zero Text — pure SVG icon) ---
const soundBtn = document.getElementById('sound-toggle');
const iconOn = document.getElementById('icon-sound-on');
const iconOff = document.getElementById('icon-sound-off');
if (soundBtn) {
  soundBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    audio.unlock();
    const nextMuted = !audio.muted;
    audio.setMuted(nextMuted);
    iconOn.style.display = nextMuted ? 'none' : 'block';
    iconOff.style.display = nextMuted ? 'block' : 'none';
  });
}

// --- 8. Smooth Animation Loop ---
let lastTime = performance.now();
function animate(nowMs) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (nowMs - lastTime) * 0.001);
  lastTime = nowMs;
  const now = nowMs * 0.001;

  game.update(dt, now);
  counter.update(dt, now);
  bag.update(dt, now);
  customer.update(dt, now);
  updateSparkles(dt);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
