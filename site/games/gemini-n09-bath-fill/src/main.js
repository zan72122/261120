import * as THREE from 'three';
import { loadBathroomAssets } from './materials.js';
import { buildBathroomScene, TUB } from './bathroom.js';
import { BathWaterSystem } from './water.js';
import { BathAudio } from './audio.js';

const canvas = document.getElementById('scene');
const params = new URLSearchParams(window.location.search);
const previewMode = params.get('preview'); // null in normal live game!

// WebGL2 Renderer with AgX tone mapping (verified cleaner than ACESFilmic on porcelain, chrome & foam)
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: params.has('preview') || params.has('capture'),
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = params.get('tonemap') === 'aces'
  ? THREE.ACESFilmicToneMapping
  : THREE.AgXToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1f1d1b);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 18);
const camTarget = new THREE.Vector3();

// Adaptive DPR cap for smooth mobile performance on iPhone / iPad
let dynamicDprCap = 1.5;

function updateCameraLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const dpr = Math.min(window.devicePixelRatio || 1, dynamicDprCap);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // Dedicated Portrait (iPhone 390x844) diagonal first-person POV:
    // Faucet lever + rose bottle top-left, wooden bowl center-back, tub & steam center, folded towel right rim, floor puddle bottom!
    camera.fov = 48;
    camera.position.set(1.32, 1.72, 1.56);
    camTarget.set(0.02, 0.40, -0.20);
  } else {
    // Dedicated Landscape (iPad 1024x768) first-person bathroom POV
    camera.fov = 42;
    camera.position.set(0.28, 1.28, 1.32);
    camTarget.set(-0.08, 0.44, -0.22);
  }
  camera.lookAt(camTarget);
  camera.updateProjectionMatrix();
}

updateCameraLayout();
window.addEventListener('resize', updateCameraLayout);

// Single shadow-casting directional key light matching frosted left bathroom window
const keyLight = new THREE.DirectionalLight(0xfff6e6, 2.45);
keyLight.position.set(-1.85, 2.05, 0.82);
keyLight.target.position.set(-0.05, 0.35, -0.22);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.4;
keyLight.shadow.camera.far = 5.2;
keyLight.shadow.camera.left = -1.6;
keyLight.shadow.camera.right = 1.6;
keyLight.shadow.camera.top = 1.4;
keyLight.shadow.camera.bottom = -1.2;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.012;
scene.add(keyLight);
scene.add(keyLight.target);

// Subtle warm ceiling downlight bounce & restrained hemisphere ambient for real shadow depth
const ceilFill = new THREE.PointLight(0xfff4e0, 0.65, 4.5, 1.8);
ceilFill.position.set(-0.12, 2.25, -0.10);
scene.add(ceilFill);

const hemi = new THREE.HemisphereLight(0xf6f3ee, 0x70685e, 0.18);
scene.add(hemi);

// ============================================================================
// PHYSICAL SIMULATION STATE
// ============================================================================
const state = {
  // Core bath physics
  fill: 0.0,           // 0..1.02
  flow: 0.0,           // 0..1 (target faucet flow)
  flowActual: 0.0,     // smoothed actual flow
  foam: 0.0,           // 0..1
  tint: 0.0,           // 0..1 (bath additive concentration)
  plugged: true,       // rubber drain plug seated?
  vortex: 0.0,         // 0..1 swirling drain funnel intensity
  slosh: 0.0,          // 0..1 brim agitation
  overflowRate: 0.0,   // 0..1 active water cascading over front rim
  floorWetness: 0.0,   // 0..1 mirror-reflective puddle on floor tiles
  rimWetness: 0.0,     // 0..1 glossy water film on tub rim
  steamLevel: 0.0,     // 0..1 curling hot bath steam
  wallFog: 0.0,        // 0..1 condensation haze on back tiles
  mirrorFog: 0.0,      // 0..1 steam condensation on framed mirror
  fizzLevel: 0.0,      // 0..1 effervescent bath additive fizz
  towelDampness: 0.0,  // 0..1 towel darkens gently as it wipes up water
  wipeSpeed: 0.0,

  // Dynamic object states
  bottleTapTimer: 0.0,
  bowlFloating: false,
  bowlPos: new THREE.Vector3(-0.08, TUB.rimY + 0.001, -0.535),
  bowlVel: new THREE.Vector2(0, 0),
  bowlRotY: 0,
  bowlTapTimer: 0.0,

  // Active first-person interaction
  stirPos: null,
  stirVel: new THREE.Vector2(),
  pourOrigin: null,
  lastInteractTime: 0,
  dripPhase: 0,
};

// Apply deterministic preview presets ONLY if ?preview=... is specified
if (previewMode === 'hero') {
  state.fill = 0.88;
  state.flow = 0.78;
  state.flowActual = 0.78;
  state.foam = 0.48;
  state.tint = 0.12;
  state.slosh = 0.18;
  state.steamLevel = 0.96;
  state.rimWetness = 0.25;
  state.wallFog = 0.16;
  state.mirrorFog = 0.42;
} else if (previewMode === 'overflow') {
  state.fill = 1.015;
  state.flow = 0.88;
  state.flowActual = 0.88;
  state.foam = 0.86;
  state.tint = 0.52;
  state.slosh = 0.45;
  state.overflowRate = 0.95;
  state.floorWetness = 0.92;
  state.rimWetness = 0.85;
  state.steamLevel = 0.95;
  state.mirrorFog = 0.58;
} else if (previewMode === 'vortex') {
  state.fill = 0.64;
  state.flow = 0.0;
  state.flowActual = 0.0;
  state.foam = 0.68;
  state.tint = 0.38;
  state.plugged = false;
  state.vortex = 0.96;
  state.steamLevel = 0.68;
  state.mirrorFog = 0.35;
  state.bowlFloating = true;
  state.bowlPos.set(-0.34, 0.37, -0.14);
} else if (previewMode === 'empty') {
  state.fill = 0.0;
  state.flow = 0.0;
}

const audio = new BathAudio();
let bathroom = null;
let water = null;

// Raycasting & one-finger embodied drag state
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlaneHoriz = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TUB.rimY);
const dragPlaneFront = new THREE.Plane(new THREE.Vector3(0, 0.65, 0.76).normalize(), -0.22);
const hitPoint = new THREE.Vector3();

let activePointerId = null;
let activeTool = null; // 'faucet' | 'bottle' | 'bowl' | 'plug' | 'towel' | 'water'
let pointerDownXY = { x: 0, y: 0 };
let lastPointerXY = { x: 0, y: 0 };
let dragMovedDist = 0;
let initialFaucetFlow = 0;
let lastSplashAudioTime = 0;
let lastPourAudioTime = 0;
let lastRippleTime = 0;
let elapsed = 3.4;

// Subtle spring wobble states for tactile feedback on props
const propWobble = {
  bottle: 0,
  bowl: 0,
  towel: 0,
  faucet: 0,
};

function setNDC(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function hitTestTarget(clientX, clientY) {
  setNDC(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, camera);

  // Generous forgiving world-space bounding boxes/spheres for a 5-year-old's one-finger touch!
  const candidates = [];
  const checkBox = (name, min, max, priority = 0) => {
    const box = new THREE.Box3(min, max);
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectBox(box, pt)) {
      candidates.push({ name, dist: pt.distanceTo(camera.position) - priority * 0.25, pt });
    }
  };

  // 1. Chrome Faucet & Lever (left wall)
  checkBox('faucet', new THREE.Vector3(-0.88, 0.56, -0.35), new THREE.Vector3(-0.46, 0.80, -0.04), 1.4);

  // 2. Rose Ceramic Bath-Foam Bottle (back-left rim)
  const bp = bathroom.bathBottle.position;
  checkBox('bottle', new THREE.Vector3(bp.x - 0.10, bp.y - 0.02, bp.z - 0.10), new THREE.Vector3(bp.x + 0.10, bp.y + 0.27, bp.z + 0.10), 1.3);

  // 3. Carved Wooden Bath-Salt Bowl (rim OR floating in tub!)
  const wp = bathroom.woodenBowl.position;
  checkBox('bowl', new THREE.Vector3(wp.x - 0.12, wp.y - 0.03, wp.z - 0.12), new THREE.Vector3(wp.x + 0.12, wp.y + 0.11, wp.z + 0.12), 1.2);

  // 4. Folded Cotton Towel (right rim)
  const tp = bathroom.towel.position;
  checkBox('towel', new THREE.Vector3(tp.x - 0.14, tp.y - 0.03, tp.z - 0.17), new THREE.Vector3(tp.x + 0.14, tp.y + 0.12, tp.z + 0.17), 1.35);

  // 5. Drain Plug & Chrome Overflow/Chain (high forgiveness so child can yank plug easily even underwater!)
  const pp = bathroom.drainSystem.plugGroup.position;
  checkBox('plug', new THREE.Vector3(pp.x - 0.09, pp.y - 0.03, pp.z - 0.09), new THREE.Vector3(pp.x + 0.09, pp.y + 0.12, pp.z + 0.09), 1.15);
  // Overflow plate & hanging chain area on left inner wall
  checkBox('plug', new THREE.Vector3(-0.74, 0.26, -0.30), new THREE.Vector3(-0.56, 0.50, -0.09), 1.05);

  // 6. Tub Water Surface / Interior Basin
  const waterY = THREE.MathUtils.lerp(TUB.floorY + 0.01, TUB.rimY, Math.min(1, state.fill));
  checkBox('water', new THREE.Vector3(TUB.innerMinX, TUB.floorY, TUB.innerMinZ), new THREE.Vector3(TUB.innerMaxX, Math.max(TUB.rimY, waterY + 0.04), TUB.innerMaxZ), 0.2);

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0];
}

function onPointerDown(e) {
  if (activePointerId !== null) return; // Single-finger focus, immune to multi-touch glitches!
  activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  audio.unlock();
  state.lastInteractTime = elapsed;

  pointerDownXY = { x: e.clientX, y: e.clientY };
  lastPointerXY = { x: e.clientX, y: e.clientY };
  dragMovedDist = 0;

  const hit = hitTestTarget(e.clientX, e.clientY);
  if (!hit) {
    activeTool = null;
    return;
  }

  activeTool = hit.name;
  canvas.classList.add('dragging');

  if (activeTool === 'faucet') {
    initialFaucetFlow = state.flow;
    propWobble.faucet = 1.0;
  } else if (activeTool === 'bottle') {
    state.bottleTapTimer = 0;
    audio.playCeramicClink(1.05);
  } else if (activeTool === 'bowl') {
    state.bowlTapTimer = 0;
    audio.playWoodKnock();
  } else if (activeTool === 'towel') {
    propWobble.towel = 1.0;
  } else if (activeTool === 'water') {
    if (state.fill > 0.03) {
      water.addRipple(hit.pt.x, hit.pt.z, 1.0, elapsed);
      audio.playSplash(0.45);
      state.slosh = Math.min(1.0, state.slosh + 0.35);
      // Poking brimming full water makes an exhilarating extra splash over the front rim!
      if (state.fill >= 0.94) {
        state.overflowRate = Math.min(1.0, state.overflowRate + 0.55);
        state.floorWetness = Math.min(1.0, state.floorWetness + 0.14);
        state.rimWetness = Math.min(1.0, state.rimWetness + 0.25);
        audio.playSplash(0.85);
      }
      if (state.tint > 0.05) {
        state.foam = Math.min(1.0, state.foam + 0.04);
      }
    } else {
      audio.playCeramicClink(0.72);
    }
  }
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId || !activeTool) return;
  const dx = e.clientX - lastPointerXY.x;
  const dy = e.clientY - lastPointerXY.y;
  dragMovedDist += Math.hypot(dx, dy);
  lastPointerXY = { x: e.clientX, y: e.clientY };
  state.lastInteractTime = elapsed;

  setNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(pointerNDC, camera);

  if (activeTool === 'faucet') {
    // Dragging UP opens faucet smoothly, DOWN closes it!
    const deltaY = pointerDownXY.y - e.clientY;
    const prevOpen = state.flow > 0.04;
    state.flow = THREE.MathUtils.clamp(initialFaucetFlow + deltaY / 110, 0, 1);
    const nowOpen = state.flow > 0.04;
    if (prevOpen !== nowOpen) audio.playLeverClick(nowOpen);
  } else if (activeTool === 'bottle') {
    // Lift ceramic bath-foam bottle in first-person right over the bathtub & tilt to pour!
    dragPlaneHoriz.constant = -(TUB.rimY + 0.14);
    if (raycaster.ray.intersectPlane(dragPlaneHoriz, hitPoint)) {
      const tx = THREE.MathUtils.clamp(hitPoint.x, TUB.innerMinX + 0.04, TUB.innerMaxX - 0.06);
      const tz = THREE.MathUtils.clamp(hitPoint.z, -0.54, 0.06);
      bathroom.bathBottle.position.lerp(new THREE.Vector3(tx, TUB.rimY + 0.16, tz), 0.32);
      const overTub = tz > TUB.innerMinZ - 0.03;
      const targetTilt = overTub ? -1.18 : -0.18;
      bathroom.bathBottle.rotation.x = THREE.MathUtils.lerp(bathroom.bathBottle.rotation.x, targetTilt, 0.22);
      bathroom.bathBottle.rotation.z = THREE.MathUtils.lerp(bathroom.bathBottle.rotation.z, overTub ? -0.35 : 0, 0.2);

      if (overTub) {
        triggerBottlePour();
      } else {
        state.pourOrigin = null;
      }
    }
  } else if (activeTool === 'bowl') {
    // Drag wooden bath bowl over the water to float it or tip bath salts!
    const waterY = THREE.MathUtils.lerp(TUB.floorY + 0.015, TUB.rimY - 0.005, Math.min(1, state.fill));
    dragPlaneHoriz.constant = -(TUB.rimY + 0.08);
    if (raycaster.ray.intersectPlane(dragPlaneHoriz, hitPoint)) {
      const tx = THREE.MathUtils.clamp(hitPoint.x, TUB.innerMinX + 0.08, TUB.innerMaxX - 0.08);
      const tz = THREE.MathUtils.clamp(hitPoint.z, -0.55, 0.02);
      const overWater = tz > TUB.innerMinZ + 0.02 && state.fill > 0.12;
      const targetY = overWater ? Math.max(waterY + 0.05, TUB.rimY + 0.04) : TUB.rimY + 0.07;
      bathroom.woodenBowl.position.lerp(new THREE.Vector3(tx, targetY, tz), 0.34);
      state.bowlPos.copy(bathroom.woodenBowl.position);
      if (overWater) {
        // Gently sprinkle mineral salts as you tilt over water
        bathroom.woodenBowl.rotation.x = THREE.MathUtils.lerp(bathroom.woodenBowl.rotation.x, 0.42, 0.18);
        state.tint = Math.min(1, state.tint + 0.006);
        state.foam = Math.min(1, state.foam + 0.009 * (1 + state.flowActual));
        state.fizzLevel = Math.min(1, state.fizzLevel + 0.08);
        if (elapsed - lastPourAudioTime > 0.28) {
          audio.playBubblePop();
          lastPourAudioTime = elapsed;
        }
      } else {
        bathroom.woodenBowl.rotation.x = THREE.MathUtils.lerp(bathroom.woodenBowl.rotation.x, 0, 0.2);
      }
    }
  } else if (activeTool === 'plug') {
    // Dragging upward pulls plug out; dragging downward pushes plug back in!
    const pullUp = pointerDownXY.y - e.clientY;
    if (state.plugged && pullUp > 24) {
      setPlugState(false);
    } else if (!state.plugged && pullUp < -24) {
      setPlugState(true);
    }
  } else if (activeTool === 'towel') {
    // Embodied first-person wiping! Towel glides over wet rim, floor puddles, tub, and steamy wall/mirror!
    const speed = Math.hypot(dx, dy) / 22;
    state.wipeSpeed = Math.min(1.5, speed);

    // Intersect either horizontal plane near floor/rim OR slanted front plane depending on vertical cursor pos
    let targetPos = null;
    if (pointerNDC.y < -0.18) {
      // Lower screen -> wiping checkerboard floor puddles right in front of bathtub!
      dragPlaneHoriz.constant = -0.028;
      if (raycaster.ray.intersectPlane(dragPlaneHoriz, hitPoint)) {
        targetPos = new THREE.Vector3(
          THREE.MathUtils.clamp(hitPoint.x, -0.78, 0.72),
          0.022,
          THREE.MathUtils.clamp(hitPoint.z, 0.20, 0.88)
        );
      }
    } else if (pointerNDC.y > 0.32) {
      // Upper screen -> wiping steamy back wall tiles & framed mirror!
      const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.54);
      if (raycaster.ray.intersectPlane(wallPlane, hitPoint)) {
        targetPos = new THREE.Vector3(
          THREE.MathUtils.clamp(hitPoint.x, -0.68, 0.65),
          THREE.MathUtils.clamp(hitPoint.y, 0.60, 1.32),
          -0.54
        );
      }
    } else {
      // Middle screen -> wiping wet porcelain tub rim & interior!
      dragPlaneHoriz.constant = -(TUB.rimY + 0.015);
      if (raycaster.ray.intersectPlane(dragPlaneHoriz, hitPoint)) {
        targetPos = new THREE.Vector3(
          THREE.MathUtils.clamp(hitPoint.x, -0.74, 0.56),
          TUB.rimY + 0.014,
          THREE.MathUtils.clamp(hitPoint.z, -0.52, 0.19)
        );
      }
    }

    if (targetPos) {
      bathroom.towel.position.lerp(targetPos, 0.38);
      // Tactile lean & soft squash into wipe direction
      const tiltX = THREE.MathUtils.clamp(dy * 0.015, -0.35, 0.35);
      const tiltZ = THREE.MathUtils.clamp(-dx * 0.015, -0.35, 0.35);
      bathroom.towel.rotation.x = THREE.MathUtils.lerp(bathroom.towel.rotation.x, targetPos.z < -0.45 ? -1.15 : tiltX, 0.25);
      bathroom.towel.rotation.z = THREE.MathUtils.lerp(bathroom.towel.rotation.z, tiltZ, 0.25);
      bathroom.towel.scale.y = THREE.MathUtils.lerp(bathroom.towel.scale.y, 0.84, 0.25);

      const cleanDelta = Math.min(0.08, speed * 0.045);
      if (cleanDelta > 0.002) {
        let absorbed = 0;
        if (targetPos.y < 0.25) {
          // Wiping floor puddles!
          const prev = state.floorWetness;
          state.floorWetness = Math.max(0, state.floorWetness - cleanDelta * 1.45);
          state.overflowRate = Math.max(0, state.overflowRate - cleanDelta * 1.2);
          absorbed += prev - state.floorWetness;
        } else if (targetPos.z < -0.42) {
          // Wiping steamy mirror & wall tiles!
          const prev = state.mirrorFog + state.wallFog;
          state.mirrorFog = Math.max(0, state.mirrorFog - cleanDelta * 1.8);
          state.wallFog = Math.max(0, state.wallFog - cleanDelta * 1.6);
          absorbed += prev - (state.mirrorFog + state.wallFog);
        } else {
          // Wiping wet porcelain rim & residual foam!
          const prev = state.rimWetness;
          state.rimWetness = Math.max(0, state.rimWetness - cleanDelta * 1.7);
          if (state.fill < 0.12) {
            state.foam = Math.max(0, state.foam - cleanDelta * 1.8);
          }
          // Also gently helps clean nearby floor edge so a 5yo never struggles to reach every pixel!
          state.floorWetness = Math.max(0, state.floorWetness - cleanDelta * 0.45);
          absorbed += prev - state.rimWetness;
        }
        if (absorbed > 0.001) {
          state.towelDampness = Math.min(1.0, state.towelDampness + absorbed * 0.75);
        }
      }
    }
  } else if (activeTool === 'water' && state.fill > 0.03) {
    // Swirling finger in water -> wakes, foam whipping, parting steam, & brim overflow splashing!
    const waterY = THREE.MathUtils.lerp(TUB.floorY + 0.01, TUB.rimY, Math.min(1, state.fill));
    dragPlaneHoriz.constant = -waterY;
    if (raycaster.ray.intersectPlane(dragPlaneHoriz, hitPoint)) {
      const wx = THREE.MathUtils.clamp(hitPoint.x, TUB.innerMinX + 0.03, TUB.innerMaxX - 0.03);
      const wz = THREE.MathUtils.clamp(hitPoint.z, TUB.innerMinZ + 0.03, TUB.innerMaxZ - 0.03);
      const moveMag = Math.hypot(dx, dy);

      if (!state.stirPos) state.stirPos = new THREE.Vector3(wx, waterY, wz);
      state.stirVel.set((wx - state.stirPos.x) * 18, (wz - state.stirPos.z) * 18);
      state.stirPos.set(wx, waterY, wz);

      if (moveMag > 3 && elapsed - lastRippleTime > 0.09) {
        water.addRipple(wx, wz, Math.min(1.2, moveMag / 16), elapsed);
        lastRippleTime = elapsed;
      }

      // Whipping up rich creamy foam by swirling water!
      const whip = Math.min(0.012, moveMag * 0.00045) * (0.28 + state.tint * 1.8);
      state.foam = Math.min(1.0, state.foam + whip);
      state.slosh = Math.min(1.0, state.slosh + moveMag * 0.008);

      // Sloshing full water spills big shimmering waves over the porcelain rim!
      if (state.fill >= 0.93 && moveMag > 4) {
        state.overflowRate = Math.min(1.0, state.overflowRate + moveMag * 0.018);
        state.floorWetness = Math.min(1.0, state.floorWetness + moveMag * 0.0038);
        state.rimWetness = Math.min(1.0, state.rimWetness + moveMag * 0.008);
      }

      if (moveMag > 9 && elapsed - lastSplashAudioTime > 0.22) {
        audio.playSplash(Math.min(0.9, moveMag / 34));
        if (state.foam > 0.25 && Math.random() < 0.5) audio.playBubblePop();
        lastSplashAudioTime = elapsed;
      }
    }
  }
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  canvas.classList.remove('dragging');

  const wasTap = dragMovedDist < 16;

  if (activeTool === 'faucet' && wasTap) {
    // Effortless single-tap toggles faucet between cozy warm fill and closed!
    const opening = state.flow < 0.15;
    state.flow = opening ? 0.82 : 0.0;
    audio.playLeverClick(opening);
  } else if (activeTool === 'bottle' && wasTap) {
    // Single-tap gracefully pours a generous splash of rose bath-foam essence automatically!
    state.bottleTapTimer = 1.45;
  } else if (activeTool === 'bowl') {
    if (wasTap) {
      if (state.bowlFloating) {
        // Tap floating bowl -> put neatly back on the tub ledge
        state.bowlFloating = false;
        audio.playWoodKnock();
      } else if (state.fill > 0.15) {
        // Tap bowl on rim when tub has water -> sprinkle salts & launch floating in the bath!
        state.bowlTapTimer = 0.85;
      } else {
        propWobble.bowl = 1.0;
        audio.playWoodKnock();
      }
    } else {
      // Released after drag: if over water with enough depth, float it; otherwise return to rim!
      const p = bathroom.woodenBowl.position;
      const inTub = p.z > TUB.innerMinZ + 0.01 && p.x > TUB.innerMinX + 0.04 && p.x < TUB.innerMaxX - 0.04;
      if (inTub && state.fill > 0.12) {
        state.bowlFloating = true;
        state.bowlPos.copy(p);
        audio.playSplash(0.5);
        water.addRipple(p.x, p.z, 0.9, elapsed);
      } else {
        state.bowlFloating = false;
        audio.playWoodKnock();
      }
    }
  } else if (activeTool === 'plug' && wasTap) {
    // Effortless single-tap pops rubber plug out or presses it back in!
    setPlugState(!state.plugged);
  }

  state.stirPos = null;
  state.stirVel.set(0, 0);
  state.pourOrigin = null;
  state.wipeSpeed = 0;
  activeTool = null;
  activePointerId = null;
}

function setPlugState(plugged) {
  if (state.plugged === plugged) return;
  state.plugged = plugged;
  audio.playPlugPop(!plugged);
  if (!plugged && state.fill > 0.06) {
    water.addRipple(TUB.drainPos.x, TUB.drainPos.z, 1.1, elapsed);
  }
}

function triggerBottlePour() {
  // Compute world-space spout tip of tilted rose ceramic bottle
  const nozzleLocal = new THREE.Vector3(0.025, 0.228, 0);
  const nozzleWorld = nozzleLocal.applyMatrix4(bathroom.bathBottle.matrixWorld);
  state.pourOrigin = nozzleWorld;

  if (state.fill > 0.04) {
    const flowBoost = 1.0 + state.flowActual * 1.45;
    state.foam = Math.min(1.0, state.foam + 0.011 * flowBoost);
    state.tint = Math.min(1.0, state.tint + 0.008);
    state.fizzLevel = Math.min(1.0, state.fizzLevel + 0.12);
    if (elapsed - lastRippleTime > 0.14) {
      water.addRipple(nozzleWorld.x, nozzleWorld.z, 0.55, elapsed);
      lastRippleTime = elapsed;
    }
  }
  if (elapsed - lastPourAudioTime > 0.22) {
    audio.playPourGlug();
    lastPourAudioTime = elapsed;
  }
}

function stepPhysics(dt) {
  // 1. Smooth faucet lever & flow rate
  state.flowActual = THREE.MathUtils.lerp(state.flowActual, state.flow, Math.min(1, dt * 8));
  bathroom.faucet.leverPivot.rotation.z = state.flowActual * 0.44 + Math.sin(elapsed * 22) * propWobble.faucet * 0.03;
  propWobble.faucet = Math.max(0, propWobble.faucet - dt * 4);

  // 2. Water filling, brim overflow, & vortex draining
  const fillRate = state.flowActual * 0.078; // ~13 seconds from empty to full at max flow (satisfying pace for a 5yo!)
  const drainRate = !state.plugged && state.fill > 0.001
    ? (0.045 + 0.055 * Math.sqrt(Math.max(0, state.fill)))
    : 0.0;

  state.fill = Math.max(0, state.fill + (fillRate - drainRate) * dt);

  // Brim overflow physics!
  if (state.fill > 0.995) {
    const excess = (state.fill - 0.995) * 14.0 + state.flowActual * 0.85;
    state.overflowRate = Math.min(1.0, Math.max(state.overflowRate, excess));
    state.fill = Math.min(1.015, state.fill);
    state.floorWetness = Math.min(1.0, state.floorWetness + dt * 0.095 * (0.4 + state.overflowRate));
    state.rimWetness = Math.min(1.0, state.rimWetness + dt * 0.18);
  } else {
    state.overflowRate = Math.max(0, state.overflowRate - dt * 0.55);
  }

  // Running faucet splashes add mild rim dampness & build foam when bath additive is present
  if (state.flowActual > 0.05 && state.fill > 0.05) {
    if (state.tint > 0.04) {
      state.foam = Math.min(1.0, state.foam + state.flowActual * state.tint * dt * 0.065);
    } else {
      // Natural clean tap-water aeration micro-froth (capped low at 0.14 until bath soap is added!)
      state.foam = Math.min(Math.max(state.foam, 0.14), state.foam + state.flowActual * dt * 0.025);
    }
    state.slosh = Math.min(0.35, Math.max(state.slosh, state.flowActual * 0.18));
  }

  // 3. Swirling Drain Vortex physics
  const targetVortex = (!state.plugged && state.fill > 0.03)
    ? THREE.MathUtils.clamp(0.45 + state.fill * 0.65, 0, 1)
    : 0.0;
  state.vortex = THREE.MathUtils.lerp(state.vortex, targetVortex, Math.min(1, dt * 3.2));

  // As tub empties, foam & tint drain down cleanly leaving subtle clinging soap trace until wiped or rinsed
  if (!state.plugged && state.fill < 0.25) {
    state.foam = Math.max(0, state.foam - dt * 0.16);
    if (state.fill < 0.02) {
      state.tint = Math.max(0, state.tint - dt * 0.5);
    }
  }

  // 4. Steam & Mirror/Wall Condensation
  const targetSteam = state.fill > 0.08
    ? Math.min(1.0, 0.22 + state.fill * 0.62 + state.flowActual * 0.35)
    : 0.0;
  state.steamLevel = THREE.MathUtils.lerp(state.steamLevel, targetSteam, Math.min(1, dt * 0.9));

  if (state.steamLevel > 0.25 && activeTool !== 'towel') {
    state.mirrorFog = Math.min(0.62, state.mirrorFog + dt * 0.022 * state.steamLevel);
    state.wallFog = Math.min(0.24, state.wallFog + dt * 0.010 * state.steamLevel);
  } else if (state.steamLevel < 0.05) {
    state.mirrorFog = Math.max(0, state.mirrorFog - dt * 0.012);
    state.wallFog = Math.max(0, state.wallFog - dt * 0.012);
  }

  state.slosh = Math.max(0, state.slosh - dt * 0.48);
  state.fizzLevel = Math.max(0, state.fizzLevel - dt * 0.45);

  // 5. Rubber Drain Plug & Articulated Chrome Ball Chain animation
  const plugTargetPos = state.plugged
    ? new THREE.Vector3(TUB.drainPos.x, TUB.drainPos.y + 0.001, TUB.drainPos.z)
    : new THREE.Vector3(-0.74, TUB.rimY + 0.002, -0.34);
  bathroom.drainSystem.plugGroup.position.lerp(plugTargetPos, Math.min(1, dt * 11));
  const targetPlugRotZ = state.plugged ? 0 : 0.36;
  bathroom.drainSystem.plugGroup.rotation.z = THREE.MathUtils.lerp(
    bathroom.drainSystem.plugGroup.rotation.z,
    targetPlugRotZ,
    Math.min(1, dt * 10)
  );
  const waterY = THREE.MathUtils.lerp(TUB.floorY + 0.006, TUB.rimY - 0.002, Math.min(1.01, state.fill));
  bathroom.drainSystem.updateChain(bathroom.drainSystem.plugGroup.position, waterY, elapsed * (1.8 + state.vortex * 3.5));

  // 6. Rose Ceramic Bath-Foam Bottle animation (tap-pour or smooth return to rim)
  if (activeTool !== 'bottle') {
    if (state.bottleTapTimer > 0) {
      state.bottleTapTimer = Math.max(0, state.bottleTapTimer - dt);
      const pourPos = new THREE.Vector3(-0.38, TUB.rimY + 0.16, -0.26);
      bathroom.bathBottle.position.lerp(pourPos, Math.min(1, dt * 8));
      bathroom.bathBottle.rotation.x = THREE.MathUtils.lerp(bathroom.bathBottle.rotation.x, -1.18, Math.min(1, dt * 9));
      bathroom.bathBottle.rotation.z = THREE.MathUtils.lerp(bathroom.bathBottle.rotation.z, -0.32, Math.min(1, dt * 9));
      if (state.bottleTapTimer > 0.2) {
        triggerBottlePour();
      } else {
        state.pourOrigin = null;
      }
    } else {
      state.pourOrigin = null;
      bathroom.bathBottle.position.lerp(bathroom.bathBottle.userData.restPos, Math.min(1, dt * 8));
      bathroom.bathBottle.rotation.x = THREE.MathUtils.lerp(bathroom.bathBottle.rotation.x, 0, Math.min(1, dt * 10));
      bathroom.bathBottle.rotation.z = THREE.MathUtils.lerp(bathroom.bathBottle.rotation.z, 0, Math.min(1, dt * 10));
    }
  }
  const bottleLift = Math.max(0, bathroom.bathBottle.position.y - TUB.rimY);
  bathroom.bottleShadow.material.opacity = THREE.MathUtils.clamp(1.0 - bottleLift * 5.0, 0, 1);

  // 7. Carved Wooden Bath Bowl (floating on water & spinning in vortex, or resting neatly on rim!)
  if (activeTool !== 'bowl') {
    if (state.bowlTapTimer > 0) {
      state.bowlTapTimer = Math.max(0, state.bowlTapTimer - dt);
      const tipPos = new THREE.Vector3(-0.10, TUB.rimY + 0.11, -0.26);
      bathroom.woodenBowl.position.lerp(tipPos, Math.min(1, dt * 9));
      bathroom.woodenBowl.rotation.x = THREE.MathUtils.lerp(bathroom.woodenBowl.rotation.x, 0.72, Math.min(1, dt * 10));
      state.tint = Math.min(1, state.tint + dt * 0.22);
      state.foam = Math.min(1, state.foam + dt * 0.28 * (1 + state.flowActual));
      state.fizzLevel = Math.min(1, state.fizzLevel + dt * 1.2);
      if (state.bowlTapTimer <= 0.02) {
        // After sprinkling bath salts, gently plop wooden bowl into the warm water to float!
        state.bowlFloating = state.fill > 0.14;
        state.bowlPos.set(-0.10, waterY, -0.22);
        audio.playSplash(0.5);
        water.addRipple(-0.10, -0.22, 0.85, elapsed);
      }
    } else if (state.bowlFloating && state.fill > 0.05) {
      // Real buoyant wooden bath bowl riding waves & spiraling in the drain whirlpool!
      const depthT = Math.max(0, Math.min(1, (TUB.rimY - waterY) / (TUB.rimY - TUB.floorY)));
      const minX = TUB.innerMinX + depthT * 0.035 + 0.11;
      const maxX = TUB.innerMaxX - depthT * 0.145 - 0.11;
      const minZ = TUB.innerMinZ + depthT * 0.025 + 0.10;
      const maxZ = TUB.innerMaxZ - depthT * 0.025 - 0.10;

      // Pushed gently by faucet splash
      if (state.flowActual > 0.02) {
        const dx = state.bowlPos.x - TUB.spoutTip.x;
        const dz = state.bowlPos.z - TUB.spoutTip.z;
        const d = Math.hypot(dx, dz) + 0.04;
        if (d < 0.35) {
          state.bowlVel.x += (dx / d) * state.flowActual * dt * 0.25;
          state.bowlVel.y += (dz / d) * state.flowActual * dt * 0.25;
        }
      }
      // Pushed by finger stirring
      if (state.stirPos) {
        const dx = state.bowlPos.x - state.stirPos.x;
        const dz = state.bowlPos.z - state.stirPos.z;
        const d = Math.hypot(dx, dz) + 0.03;
        if (d < 0.22) {
          state.bowlVel.x += (state.stirVel.x * 0.6 + dx / d * 0.2) * dt * 3.0;
          state.bowlVel.y += (state.stirVel.y * 0.6 + dz / d * 0.2) * dt * 3.0;
        }
      }
      // Spirals joyfully around the whirlpool vortex!
      if (state.vortex > 0.05) {
        const dx = state.bowlPos.x - TUB.drainPos.x;
        const dz = state.bowlPos.z - TUB.drainPos.z;
        const r = Math.hypot(dx, dz) + 0.04;
        const targetR = 0.14;
        const radial = (r - targetR) * 0.85;
        state.bowlVel.x += (-dx / r * radial - dz / r * 0.72) * state.vortex * dt * 2.2;
        state.bowlVel.y += (-dz / r * radial + dx / r * 0.72) * state.vortex * dt * 2.2;
        state.bowlRotY += state.vortex * dt * 3.4;
      } else {
        state.bowlRotY += dt * 0.18;
      }

      state.bowlVel.multiplyScalar(Math.exp(-dt * 2.2));
      state.bowlPos.x = THREE.MathUtils.clamp(state.bowlPos.x + state.bowlVel.x * dt, minX, maxX);
      state.bowlPos.z = THREE.MathUtils.clamp(state.bowlPos.z + state.bowlVel.y * dt, minZ, maxZ);

      const dDr = Math.hypot(state.bowlPos.x - TUB.drainPos.x, state.bowlPos.z - TUB.drainPos.z);
      const funnelDip = state.vortex > 0.01 ? -0.045 * state.vortex / (1 + Math.pow(dDr / 0.09, 2)) : 0;
      const bob = Math.sin(elapsed * 2.6) * 0.004 * (1 + state.slosh * 2);

      bathroom.woodenBowl.position.lerp(
        new THREE.Vector3(state.bowlPos.x, Math.max(TUB.floorY + 0.004, waterY - 0.016 + funnelDip + bob), state.bowlPos.z),
        Math.min(1, dt * 10)
      );
      bathroom.woodenBowl.rotation.set(
        Math.sin(elapsed * 2.3) * 0.06 * (1 + state.slosh + state.vortex),
        state.bowlRotY,
        Math.cos(elapsed * 2.1) * 0.06 * (1 + state.slosh + state.vortex)
      );
    } else {
      // Resting cleanly back on back porcelain ledge
      if (state.fill <= 0.05) state.bowlFloating = false;
      const wob = Math.sin(elapsed * 24) * propWobble.bowl * 0.08;
      propWobble.bowl = Math.max(0, propWobble.bowl - dt * 4);
      bathroom.woodenBowl.position.lerp(bathroom.woodenBowl.userData.restPos, Math.min(1, dt * 8));
      bathroom.woodenBowl.rotation.x = THREE.MathUtils.lerp(bathroom.woodenBowl.rotation.x, wob, Math.min(1, dt * 10));
      bathroom.woodenBowl.rotation.z = THREE.MathUtils.lerp(bathroom.woodenBowl.rotation.z, 0, Math.min(1, dt * 10));
    }
  }
  const bowlLift = Math.hypot(
    bathroom.woodenBowl.position.x - bathroom.woodenBowl.userData.restPos.x,
    bathroom.woodenBowl.position.z - bathroom.woodenBowl.userData.restPos.z
  );
  bathroom.bowlShadow.material.opacity = THREE.MathUtils.clamp(1.0 - bowlLift * 8.0, 0, 1);

  // 8. Folded Terrycloth Towel smooth return & subtle wet absorption darkening
  if (activeTool !== 'towel') {
    state.wipeSpeed = Math.max(0, state.wipeSpeed - dt * 6);
    bathroom.towel.position.lerp(bathroom.towel.userData.restPos, Math.min(1, dt * 8));
    bathroom.towel.rotation.x = THREE.MathUtils.lerp(bathroom.towel.rotation.x, 0, Math.min(1, dt * 10));
    bathroom.towel.rotation.y = THREE.MathUtils.lerp(bathroom.towel.rotation.y, bathroom.towel.userData.restRotY, Math.min(1, dt * 10));
    bathroom.towel.rotation.z = THREE.MathUtils.lerp(bathroom.towel.rotation.z, 0, Math.min(1, dt * 10));
    bathroom.towel.scale.y = THREE.MathUtils.lerp(bathroom.towel.scale.y, 1.0, Math.min(1, dt * 10));
    state.towelDampness = Math.max(0, state.towelDampness - dt * 0.04);
  }
  const towelDist = bathroom.towel.position.distanceTo(bathroom.towel.userData.restPos);
  bathroom.towelShadow.material.opacity = THREE.MathUtils.clamp(1.0 - towelDist * 8.0, 0, 1);

  // Subtle realistic cotton darkening when damp from wiping up spilled water
  const dryCol = new THREE.Color(0xdccbb5);
  const wetCol = new THREE.Color(0xb8a389);
  bathroom.towel.children[0].material.color.copy(dryCol).lerp(wetCol, state.towelDampness * 0.75);

  // 9. Update wet porcelain rim sheen, tile haze & steamy mirror shader
  bathroom.rimWetMat.opacity = state.rimWetness * 0.48;
  bathroom.wallFogMat.opacity = state.wallFog * 0.24;
  bathroom.mirrorUniforms.uFog.value = state.mirrorFog;
  bathroom.mirrorUniforms.uTime.value = elapsed;

  // 10. Subtle natural idle faucet droplet (ONLY after 7.5s idle on empty tub — zero arrows/icons!)
  const idleSec = elapsed - state.lastInteractTime;
  if (!previewMode && idleSec > 7.5 && state.fill < 0.04 && state.flow < 0.02) {
    state.dripPhase = (state.dripPhase + dt * 0.42) % 1.0;
    water.idleDrip.visible = true;
    if (state.dripPhase < 0.55) {
      // Swelling droplet clinging to chrome aerator nozzle
      const swell = state.dripPhase / 0.55;
      water.idleDrip.position.set(TUB.spoutTip.x, TUB.spoutTip.y - 0.005 - swell * 0.008, TUB.spoutTip.z);
      water.idleDrip.scale.setScalar(0.4 + swell * 0.7);
    } else {
      // Falling straight down into empty porcelain basin
      const fallT = (state.dripPhase - 0.55) / 0.45;
      const y = TUB.spoutTip.y - 0.013 - fallT * fallT * (TUB.spoutTip.y - TUB.floorY - 0.02);
      water.idleDrip.position.set(TUB.spoutTip.x, Math.max(TUB.floorY + 0.005, y), TUB.spoutTip.z);
      water.idleDrip.scale.set(0.85, 1.35, 0.85);
      if (fallT > 0.94 && elapsed - lastSplashAudioTime > 0.6) {
        audio.playBubblePop();
        lastSplashAudioTime = elapsed;
      }
    }
  } else {
    water.idleDrip.visible = false;
  }

  // 11. Continuous realistic Web Audio foley update
  audio.updateContinuous({
    flow: state.flowActual,
    fill: Math.min(1, state.fill),
    draining: state.vortex,
    overflowRate: state.overflowRate,
    wipeSpeed: state.wipeSpeed,
    fizzLevel: state.fizzLevel,
  });
}

async function init() {
  const assets = await loadBathroomAssets(renderer);
  scene.environment = assets.envMap;
  scene.environmentIntensity = 0.78;

  bathroom = buildBathroomScene(scene, assets);
  water = new BathWaterSystem(scene, assets.rawHdr);

  // Sync initial visual state
  bathroom.faucet.leverPivot.rotation.z = state.flowActual * 0.44;
  bathroom.rimWetMat.opacity = state.rimWetness * 0.48;
  bathroom.wallFogMat.opacity = state.wallFog * 0.24;
  bathroom.mirrorUniforms.uFog.value = state.mirrorFog;

  if (!state.plugged) {
    bathroom.drainSystem.plugGroup.position.set(-0.74, TUB.rimY + 0.002, -0.34);
    bathroom.drainSystem.plugGroup.rotation.z = 0.36;
    bathroom.drainSystem.updateChain(bathroom.drainSystem.plugGroup.position, 0.38, 0.8);
  }
  if (state.bowlFloating) {
    bathroom.woodenBowl.position.copy(state.bowlPos);
    bathroom.bowlShadow.material.opacity = 0;
  }

  // Bind one-finger pointer events
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // Pre-warm shaders & water/foam distribution
  for (let i = 0; i < 6; i++) {
    water.update(0.15, 2.5 + i * 0.15, state);
  }
  renderer.render(scene, camera);
  if (params.has('preview') || params.has('capture')) {
    renderer.render(scene, camera);
    renderer.getContext().finish();
  }

  window.__BATH_READY__ = true;
  window.__BATH_STATE__ = state;
  window.__BATH_STATS__ = () => ({
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    textures: renderer.info.memory.textures,
    geometries: renderer.info.memory.geometries,
  });
  console.log('BATH_READY', JSON.stringify(window.__BATH_STATS__()));

  let lastNow = performance.now();
  let slowFrames = 0;

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) * 0.001));
    lastNow = now;
    elapsed += dt;

    // Gentle adaptive DPR downgrade if mobile frame time consistently exceeds 42ms (<24fps)
    if (!previewMode && dt > 0.042) {
      slowFrames++;
      if (slowFrames > 45 && dynamicDprCap > 1.0) {
        dynamicDprCap = 1.0;
        updateCameraLayout();
      }
    } else {
      slowFrames = Math.max(0, slowFrames - 1);
    }

    if (!previewMode) {
      stepPhysics(dt);
    } else if (!state.plugged) {
      bathroom.drainSystem.updateChain(bathroom.drainSystem.plugGroup.position, 0.38, elapsed * 2.5);
    }

    water.update(dt, elapsed, state);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

init().catch((err) => {
  console.error('Failed to initialize bathroom scene:', err);
});
