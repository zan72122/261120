import * as THREE from 'three';
import { createSunlitEnvTexture } from './textures.js';
import { SoundEngine } from './audio.js';
import { ParticleSystem } from './particles.js';
import { buildKitchen } from './kitchen.js';
import { buildMomScene } from './momScene.js';

// ============================================================================
// RENDERER, SCENE, PHOTOREALISTIC LIGHTING & SUNLIT ENVIRONMENT
// ============================================================================
const container = document.getElementById('app');
const hintHandEl = document.getElementById('hint-hand');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe5d8c5);
scene.fog = new THREE.FogExp2(0xe5d8c5, 0.048);

// Procedural sunlit room environment map for realistic metal/ceramic/liquid reflections
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = createSunlitEnvTexture();
scene.environment = pmrem.fromEquirectangular(envTex).texture;
scene.environmentIntensity = 0.72;
envTex.dispose();
pmrem.dispose();

// Warm morning sun directional light casting crisp soft shadows across counter & Mom's alcove
const sunLight = new THREE.DirectionalLight(0xffe8c6, 2.05);
sunLight.position.set(-2.9, 3.1, 1.9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 11;
sunLight.shadow.camera.left = -3.0;
sunLight.shadow.camera.right = 3.6;
sunLight.shadow.camera.top = 2.6;
sunLight.shadow.camera.bottom = -2.0;
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.015;
scene.add(sunLight);

// Soft cool sky bounce fill from kitchen window
const hemiLight = new THREE.HemisphereLight(0xeef4ff, 0x6e533c, 0.46);
scene.add(hemiLight);

// Subtle warm interior kitchen pendant fill
const warmFill = new THREE.PointLight(0xffe2b5, 0.42, 6.5, 1.6);
warmFill.position.set(0.6, 1.85, 0.75);
scene.add(warmFill);

// Cozy sunlit alcove fill light behind pass-through so Mom glows warmly with soft depth
const alcoveLight = new THREE.PointLight(0xffebd0, 0.85, 4.2, 1.5);
alcoveLight.position.set(-0.75, 1.25, -1.55);
scene.add(alcoveLight);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.08, 22);

// ============================================================================
// BUILD WORLD, AUDIO, PARTICLES
// ============================================================================
const sound = new SoundEngine();
const particles = new ParticleSystem(scene);
const kitchen = buildKitchen(scene);
const momScene = buildMomScene(scene);

// ============================================================================
// GAME STATE & PHYSICAL CAUSALITY MODEL
// ============================================================================
const state = {
  phase: 'cook', // 'cook' | 'mom_deliver' | 'mom_eat' | 'hanamaru' | 'to_sink' | 'wash' | 'celebrate_reset'
  roundsCompleted: 0,

  // Prep
  chopStage: 0, // 0: whole, 1: carrot half-cut, 2: carrot sliced, 3: broccoli cut, 4: veggies in pot!
  veggiesInPot: false,
  soupLevel: 0, // 0..1 broth filled
  pouringBroth: false,
  pourTimer: 0,
  eggState: 'in_cup', // 'in_cup' | 'cracked_hover' | 'cracking' | 'in_pan' | 'plated'
  eggCrackAnim: 0,

  // Gas Stove Knobs (0 = OFF, 1 = Low, 2 = Med, 3 = High; continuous 0..1 flame level)
  knob: {
    left: { level: 0, targetLevel: 0, angle: 0, sparkTimer: 0, clickStep: 0 },
    right: { level: 0, targetLevel: 0, angle: 0, sparkTimer: 0, clickStep: 0 },
  },

  // Thermal & Cooking Simulation
  soupTemp: 0, // 0..1
  soupCook: 0, // 0..1
  soupSeasoned: false,
  stirAngle: 0,
  stirVel: 0,
  soupPlated: false,
  ladleAnim: 0, // > 0 during plating scoop animation

  panTemp: 0, // 0..1
  butterMelted: 0, // 0..1
  eggCook: 0, // 0..1
  eggCrisp: 0, // 0..1
  eggSeasoned: false,
  yolkWobble: 0,
  eggPlated: false,
  spatulaAnim: 0, // > 0 during spatula plating animation

  // Delivery & Mom Recovery
  trayMoveT: 0,
  trayFromPos: new THREE.Vector3(),
  trayToPos: new THREE.Vector3(),
  momAteSoup: false,
  momAteEgg: false,
  momFeedAnim: 0,
  momFeedKind: null, // 'soup' | 'egg'
  momHealth: 0, // 0 = sleepy unwell, 0.5 = warm rosy, 1.0 = bright & joyful!
  coolingPadPeel: 0,

  // Hanamaru Reward
  hanamaruProgress: 0, // 0..1 live drawing
  hanamaruDoneTime: 0,
  hanamaruCardScale: 0,

  // Dishwashing at Sink
  faucetOn: false,
  faucetAnim: 0,
  bowlDirt: 0, // 0..1
  plateDirt: 0, // 0..1
  bowlScrubbed: false,
  plateScrubbed: false,
  bowlClean: false,
  plateClean: false,
  spongeDragging: false,
  spongeTarget: new THREE.Vector3(),
  washCompleteTimer: 0,

  // Subtle animations
  knifeAnim: 0,
  shakerAnim: 0,
  shakerTarget: new THREE.Vector3(),
  wobbles: new Map(), // mesh -> { amp, phase }
  idleTimer: 0,
  hintPlaying: false,
  hintAnimT: 0,
};

// Floating 3D veggies inside the soup pot
const potVeggies = [];
function populatePotVeggies() {
  while (kitchen.potVeggiesGroup.children.length > 0) {
    kitchen.potVeggiesGroup.remove(kitchen.potVeggiesGroup.children[0]);
  }
  potVeggies.length = 0;

  for (let i = 0; i < 6; i++) {
    const isCarrot = i < 4;
    const mesh = isCarrot
      ? new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 0.009, 14),
          [kitchen.mats.carrotOuter, kitchen.mats.carrotCut, kitchen.mats.carrotCut]
        )
      : new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), kitchen.mats.broccoli);

    const a = (i / 6) * Math.PI * 2 + 0.3;
    const r = 0.032 + (i % 3) * 0.024;
    mesh.position.set(Math.cos(a) * r, 0.022, Math.sin(a) * r);
    mesh.rotation.set(Math.random() * 0.4, Math.random() * 6, Math.random() * 0.4);
    mesh.castShadow = true;
    kitchen.potVeggiesGroup.add(mesh);
    potVeggies.push({ mesh, baseA: a, baseR: r, phase: i * 1.1 });
  }
}

// Add a wobble reaction to any object (playful tactile feedback!)
function triggerWobble(obj, amp = 0.14) {
  if (!obj) return;
  state.wobbles.set(obj, {
    amp,
    phase: 0,
    baseRotZ: obj.userData.baseRotZ ?? obj.rotation.z,
  });
  if (obj.userData.baseRotZ === undefined) {
    obj.userData.baseRotZ = obj.rotation.z;
  }
}

// ============================================================================
// ADAPTIVE RESPONSIVE CAMERA (IPHONE PORTRAIT + IPAD LANDSCAPE + DESKTOP)
// ============================================================================
const camCurTarget = new THREE.Vector3(-0.08, 0.24, -0.14);
const camCurPos = new THREE.Vector3(-0.08, 1.35, 1.75);
const camDesiredTarget = new THREE.Vector3();
const camDesiredPos = new THREE.Vector3();

function computeResponsiveCamera(target, dirVec, viewW, viewH, outPos) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const vFovRad = THREE.MathUtils.degToRad(camera.fov);
  const tanHalfV = Math.tan(vFovRad * 0.5);
  const tanHalfH = tanHalfV * aspect;

  // Pick distance large enough to keep both viewW and viewH comfortably inside viewport
  const distForH = (viewH * 0.5) / tanHalfV;
  const distForW = (viewW * 0.5) / tanHalfH;
  const dist = Math.max(distForH, distForW);

  const dir = dirVec.clone().normalize();
  outPos.copy(target).addScaledVector(dir, dist);
}

function getCameraGoal() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const isPortrait = aspect < 0.85;

  if (state.phase === 'cook') {
    const bothCooked = state.soupCook >= 0.98 && state.eggCook >= 0.98;
    const readyToPlate = state.soupCook >= 0.95 || state.eggCook >= 0.95;

    if (bothCooked || state.soupPlated || state.eggPlated) {
      // Frame stove + full serving tray + Mom's full head cleanly without clipping!
      return {
        target: new THREE.Vector3(isPortrait ? 0.14 : 0.12, 0.30, -0.10),
        dir: new THREE.Vector3(0.0, isPortrait ? 0.72 : 0.68, 1.38),
        viewW: isPortrait ? 2.02 : 2.18,
        viewH: isPortrait ? 1.24 : 1.16,
      };
    }
    if (!state.veggiesInPot || state.soupLevel < 0.85) {
      // Full opening view: cutting board + broth pitcher + 2-burner stove + egg cup + full serving tray + Mom!
      return {
        target: new THREE.Vector3(0.02, 0.30, -0.10),
        dir: new THREE.Vector3(0.0, isPortrait ? 0.70 : 0.68, 1.38),
        viewW: isPortrait ? 2.18 : 2.24,
        viewH: isPortrait ? 1.26 : 1.18,
      };
    }
    // Active cooking on both burners + full tray + Mom clearly framed
    return {
      target: new THREE.Vector3(readyToPlate ? 0.08 : 0.04, 0.30, -0.10),
      dir: new THREE.Vector3(0.0, isPortrait ? 0.72 : 0.68, 1.38),
      viewW: isPortrait ? 2.10 : 2.22,
      viewH: isPortrait ? 1.24 : 1.18,
    };
  }

  if (state.phase === 'mom_deliver' || state.phase === 'mom_eat' || state.phase === 'hanamaru') {
    return {
      target: new THREE.Vector3(0.0, 0.38, -1.52),
      dir: new THREE.Vector3(0.0, isPortrait ? 0.42 : 0.36, 1.05),
      viewW: isPortrait ? 1.04 : 1.28,
      viewH: isPortrait ? 1.02 : 0.90,
    };
  }

  // Sink dishwashing view (to_sink, wash, celebrate_reset) — shows full stainless basin + faucet + sponge + rack!
  return {
    target: new THREE.Vector3(isPortrait ? 1.88 : 1.92, 0.06, -0.06),
    dir: new THREE.Vector3(0.0, isPortrait ? 0.88 : 0.80, 1.18),
    viewW: isPortrait ? 1.48 : 1.66,
    viewH: isPortrait ? 1.02 : 0.90,
  };
}

// Initialize camera right at opening goal
{
  const g = getCameraGoal();
  camCurTarget.copy(g.target);
  computeResponsiveCamera(g.target, g.dir, g.viewW, g.viewH, camCurPos);
  camera.position.copy(camCurPos);
  camera.lookAt(camCurTarget);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// ONE-FINGER RAYCASTING & GESTURE ENGINE
// ============================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
const planeHit = new THREE.Vector3();

let activePointerId = null;
let dragKind = null; // 'knob_left' | 'knob_right' | 'stir' | 'sponge' | 'veggie_swipe' | 'tray_drag' | 'tap_only'
let downTargetId = null;
let downScreenX = 0;
let downScreenY = 0;
let lastScreenX = 0;
let lastScreenY = 0;
let dragDistance = 0;
let knobStartLevel = 0;
let scrubAudioCooldown = 0;
let stirAudioCooldown = 0;

function updateNDC(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
}

function hitTest(clientX, clientY) {
  updateNDC(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    let cur = h.object;
    while (cur) {
      if (cur.userData && cur.userData.interactive) {
        return { id: cur.userData.interactive, hit: h, object: cur };
      }
      cur = cur.parent;
    }
  }
  return null;
}

function projectToPlane(clientX, clientY, yHeight) {
  updateNDC(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, camera);
  dragPlane.constant = -yHeight;
  return raycaster.ray.intersectPlane(dragPlane, planeHit);
}

function resetIdle() {
  state.idleTimer = 0;
  if (state.hintPlaying) {
    state.hintPlaying = false;
    hintHandEl.style.opacity = '0';
  }
}

// ============================================================================
// CORE PHYSICAL ACTIONS
// ============================================================================
function setKnobTarget(side, newLevel, playSnap = true) {
  const k = state.knob[side];
  const prev = k.targetLevel;
  const clamped = Math.max(0, Math.min(1, newLevel));
  k.targetLevel = clamped;

  const newStep = clamped < 0.08 ? 0 : clamped < 0.42 ? 1 : clamped < 0.78 ? 2 : 3;
  if (prev < 0.08 && clamped >= 0.08) {
    // Ignition! Piezo sparks + realistic gas BOFF!
    k.sparkTimer = 0.25;
    sound.playGasIgnite();
    const bPos = kitchen.burners[side].worldPos.clone();
    bPos.y += 0.02;
    particles.spawnSpark(bPos, 8);
  } else if (newStep !== k.clickStep && playSnap) {
    sound.playKnobClick(newStep);
  }
  k.clickStep = newStep;
}

function cycleKnobTap(side) {
  const k = state.knob[side];
  if (k.targetLevel < 0.08) {
    setKnobTarget(side, 0.66, true); // Medium-high crisp ignition!
  } else if (k.targetLevel < 0.85) {
    setKnobTarget(side, 1.0, true); // Full high flame!
  } else {
    setKnobTarget(side, 0.0, true); // Crisp OFF!
  }
}

function advanceChopOrSweepVeggies() {
  if (state.veggiesInPot) {
    sound.playWoodTap(1.1);
    triggerWobble(kitchen.board, 0.04);
    return;
  }
  state.knifeAnim = 1.0;

  if (state.chopStage < 3) {
    state.chopStage += 1;
    sound.playChop(0.95 + state.chopStage * 0.1);
    particles.spawnDroplets(new THREE.Vector3(-0.78, 0.06, 0.05), { count: 4, kind: 'water', spread: 0.16 });
    if (state.chopStage === 1) {
      // Split first 2 carrot slices outward cleanly
      kitchen.carrotSlices[3].position.x += 0.016;
      kitchen.carrotSlices[4].position.x += 0.026;
      kitchen.carrotSlices[4].position.z += 0.012;
      triggerWobble(kitchen.carrotGroup, 0.08);
    } else if (state.chopStage === 2) {
      // Scatter all 5 carrot coins nicely on board
      kitchen.carrotSlices.forEach((s, idx) => {
        s.position.x = s.userData.homePos.x + (idx - 2) * 0.012;
        s.position.z = ((idx % 2) * 2 - 1) * 0.016;
        s.rotation.x = (idx - 2) * 0.14;
      });
    } else if (state.chopStage === 3) {
      // Separate broccoli florets cleanly
      kitchen.broccoliFlorets.forEach((f, idx) => {
        f.position.x = f.userData.homePos.x + (idx - 1) * 0.022;
        f.position.z = f.userData.homePos.z + (idx === 1 ? -0.02 : 0.018);
      });
      triggerWobble(kitchen.broccoliGroup, 0.12);
    }
  } else {
    // Stage 4: Sweep chopped carrot coins & broccoli florets right into the soup pot!
    state.chopStage = 4;
    state.veggiesInPot = true;
    kitchen.carrotGroup.visible = false;
    kitchen.broccoliGroup.visible = false;
    populatePotVeggies();
    sound.playPlop(0.95);
    setTimeout(() => sound.playPlop(1.12), 90);
    setTimeout(() => sound.playPlop(1.26), 180);
    const potTop = new THREE.Vector3(-0.22, 0.25, -0.05);
    if (state.soupLevel > 0.1) {
      particles.spawnDroplets(potTop, { count: 8, kind: 'water', spread: 0.18 });
    }
    if (state.soupTemp > 0.45) {
      particles.spawnSteam(potTop, { count: 4, scale: 0.12, opacity: 0.35 });
    }
    triggerWobble(kitchen.potGroup, 0.06);
  }
}

function triggerPourBroth() {
  if (state.pouringBroth) return;
  state.pouringBroth = true;
  state.pourTimer = 0;
  sound.playWaterPourGlug(state.soupLevel);
}

function advanceEggAction() {
  if (state.eggState === 'in_cup') {
    state.eggState = 'cracked_hover';
    kitchen.eggCrackRing.visible = true;
    sound.playEggTap(false);
    triggerWobble(kitchen.rawEggGroup, 0.22);
  } else if (state.eggState === 'cracked_hover') {
    state.eggState = 'cracking';
    state.eggCrackAnim = 0;
    sound.playEggTap(true);
  }
}

function triggerSeasoning() {
  state.shakerAnim = 1.0;
  // Sprinkle into soup if soup needs love, else onto egg in pan!
  if (!state.soupSeasoned && (state.veggiesInPot || state.soupLevel > 0.2)) {
    state.soupSeasoned = true;
    state.shakerTarget.set(-0.22, 0.36, -0.05);
    setTimeout(() => {
      particles.spawnDroplets(new THREE.Vector3(-0.22, 0.31, -0.05), { count: 10, kind: 'spice' });
      particles.spawnDroplets(new THREE.Vector3(-0.22, 0.31, -0.05), { count: 6, kind: 'herb' });
      particles.spawnGoldSparkle(new THREE.Vector3(-0.22, 0.27, -0.05), 5, 0.12);
    }, 180);
  } else if (state.eggState === 'in_pan') {
    state.eggSeasoned = true;
    state.shakerTarget.set(0.22, 0.32, -0.05);
    setTimeout(() => {
      particles.spawnDroplets(new THREE.Vector3(0.22, 0.27, -0.05), { count: 10, kind: 'spice' });
      particles.spawnDroplets(new THREE.Vector3(0.22, 0.27, -0.05), { count: 7, kind: 'herb' });
      kitchen.eggHerbsGroup.visible = true;
    }, 180);
  } else {
    state.shakerTarget.set(0.0, 0.26, -0.22);
    setTimeout(() => {
      particles.spawnDroplets(new THREE.Vector3(0.0, 0.20, -0.22), { count: 8, kind: 'spice' });
    }, 160);
  }
  sound.playShaker();
}

function triggerPlateSoup() {
  if (state.soupCook < 0.92 || state.soupPlated || state.ladleAnim > 0) return;
  state.ladleAnim = 0.001;
  // Safely click left burner OFF as you serve!
  if (state.knob.left.targetLevel > 0.05) {
    setKnobTarget('left', 0, true);
  }
  sound.playStirSwish();
}

function triggerPlateEgg() {
  if (state.eggCook < 0.92 || state.eggPlated || state.spatulaAnim > 0) return;
  state.spatulaAnim = 0.001;
  // Safely click right burner OFF as you serve!
  if (state.knob.right.targetLevel > 0.05) {
    setKnobTarget('right', 0, true);
  }
  sound.playCeramicClink(0.95);
}

function startDeliverToMom() {
  if (state.phase !== 'cook' || !state.soupPlated || !state.eggPlated) return;
  state.phase = 'mom_deliver';
  state.trayMoveT = 0;
  state.trayFromPos.copy(kitchen.trayGroup.position);
  state.trayToPos.copy(momScene.trayTargetPos);
  sound.playWarmChime([523.25, 659.25, 783.99]);
}

function triggerFeedMom(kind) {
  if (state.phase !== 'mom_eat' || state.momFeedAnim > 0) return;
  if (kind === 'soup' && state.momAteSoup) return;
  if (kind === 'egg' && state.momAteEgg) return;
  state.momFeedKind = kind;
  state.momFeedAnim = 0.001;
  sound.playCeramicClink(1.1);
}

function startMoveToSink() {
  if (state.phase !== 'hanamaru') return;
  state.phase = 'to_sink';
  state.trayMoveT = 0;

  // Add permanent miniature keepsake Hanamaru card onto the kitchen windowsill!
  addKeepsakeCardToWindowsill();

  // Hide big Hanamaru card cleanly
  momScene.hanamaruCardGroup.visible = false;
  momScene.crayonGroup.visible = false;

  // Prepare dirty dishes for sink washing!
  state.bowlDirt = 1.0;
  state.plateDirt = 1.0;
  kitchen.bowlSmudgeDyn.update(1.0);
  kitchen.plateSmudgeDyn.update(1.0);
  state.bowlScrubbed = false;
  state.plateScrubbed = false;
  state.bowlClean = false;
  state.plateClean = false;
  state.faucetOn = false;
  state.washCompleteTimer = 0;

  // Move empty tray back to counter edge and dirty bowl+plate into sink basin
  state.trayFromPos.copy(kitchen.trayGroup.position);
  state.trayToPos.set(1.20, 0.0, 0.10);
  sound.playWoodTap(1.05);
}

function addKeepsakeCardToWindowsill() {
  const idx = state.roundsCompleted;
  // Clone current canvas texture snapshot into a keepsake card standing proudly on the sill!
  const snapCanvas = document.createElement('canvas');
  snapCanvas.width = 256;
  snapCanvas.height = 256;
  const sctx = snapCanvas.getContext('2d');
  sctx.drawImage(momScene.hanamaruDyn.texture.image, 0, 0, 256, 256);
  const snapTex = new THREE.CanvasTexture(snapCanvas);
  snapTex.colorSpace = THREE.SRGBColorSpace;

  const miniCard = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.11, 0.006),
    [
      new THREE.MeshStandardMaterial({ color: 0xf7efe0 }),
      new THREE.MeshStandardMaterial({ color: 0xf7efe0 }),
      new THREE.MeshStandardMaterial({ color: 0xf7efe0 }),
      new THREE.MeshStandardMaterial({ color: 0xf7efe0 }),
      new THREE.MeshStandardMaterial({ map: snapTex, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0xf7efe0 }),
    ]
  );
  const slot = idx % 6;
  miniCard.position.set(slot * 0.125, 0.055, 0.0);
  miniCard.rotation.x = -0.14;
  miniCard.rotation.y = (slot - 2) * 0.06;
  miniCard.castShadow = true;
  kitchen.keepsakeCardsGroup.add(miniCard);
}

function placeDishesIntoSink() {
  // Detach bowl & plate from tray into world-space sink basin!
  scene.attach(kitchen.bowlGroup);
  scene.attach(kitchen.plateGroup);
  kitchen.bowlGroup.position.set(1.63, -0.165, -0.02);
  kitchen.plateGroup.position.set(1.88, -0.165, 0.04);
  kitchen.bowlGroup.rotation.set(0, 0, 0);
  kitchen.plateGroup.rotation.set(0, 0, 0);
}

function scrubDishAtWorldPos(worldPos) {
  if (state.phase !== 'wash') return;
  const targets = [
    { key: 'bowl', group: kitchen.bowlGroup, dirtKey: 'bowlDirt', scrubKey: 'bowlScrubbed', cleanKey: 'bowlClean', smudge: kitchen.bowlSmudgeDyn },
    { key: 'plate', group: kitchen.plateGroup, dirtKey: 'plateDirt', scrubKey: 'plateScrubbed', cleanKey: 'plateClean', smudge: kitchen.plateSmudgeDyn },
  ];

  for (const t of targets) {
    if (state[t.cleanKey]) continue;
    const dist = Math.hypot(worldPos.x - t.group.position.x, worldPos.z - t.group.position.z);
    if (dist < 0.19) {
      state[t.dirtKey] = Math.max(0, state[t.dirtKey] - 0.085);
      t.smudge.update(state[t.dirtKey]);
      particles.spawnSoapBubble(
        new THREE.Vector3(t.group.position.x, t.group.position.y + 0.05, t.group.position.z),
        { count: 2, floatUp: true, radiusMin: 0.010, radiusMax: 0.024 }
      );
      if (scrubAudioCooldown <= 0) {
        scrubAudioCooldown = 0.12;
        sound.playScrubSqueak();
        if (Math.random() > 0.45) sound.playBubblePop();
      }
      if (state[t.dirtKey] <= 0.02 && !state[t.scrubKey]) {
        state[t.scrubKey] = true;
        // If faucet is already running, rinse & finish immediately!
        if (state.faucetOn) {
          finishCleanDish(t.key);
        } else {
          // Turn faucet on slightly or invite faucet tap; also give cheerful bubble chime!
          sound.playBubblePop();
          particles.spawnSoapBubble(
            new THREE.Vector3(t.group.position.x, t.group.position.y + 0.08, t.group.position.z),
            { count: 6, floatUp: true }
          );
        }
      }
    }
  }
}

function finishCleanDish(key) {
  if (key === 'bowl' && !state.bowlClean) {
    state.bowlClean = true;
    state.bowlDirt = 0;
    kitchen.bowlSmudgeDyn.update(0);
    sound.playSqueakyClean();
    particles.spawnGoldSparkle(new THREE.Vector3(2.36, 0.12, -0.04), 10, 0.22);
    particles.spawnDroplets(new THREE.Vector3(1.76, -0.06, -0.05), { count: 8, kind: 'water' });
  }
  if (key === 'plate' && !state.plateClean) {
    state.plateClean = true;
    state.plateDirt = 0;
    kitchen.plateSmudgeDyn.update(0);
    sound.playSqueakyClean();
    particles.spawnGoldSparkle(new THREE.Vector3(2.50, 0.12, 0.04), 10, 0.22);
    particles.spawnDroplets(new THREE.Vector3(1.76, -0.06, -0.05), { count: 8, kind: 'water' });
  }
}

function resetForNextRound() {
  state.roundsCompleted += 1;
  state.phase = 'cook';

  // Reattach clean bowl & plate back to the oak tray and return tray to kitchen!
  kitchen.trayGroup.position.copy(kitchen.trayKitchenHome);
  kitchen.trayGroup.attach(kitchen.bowlGroup);
  kitchen.trayGroup.attach(kitchen.plateGroup);
  kitchen.bowlGroup.position.copy(kitchen.bowlTrayPos);
  kitchen.bowlGroup.rotation.set(0, 0, 0);
  kitchen.plateGroup.position.copy(kitchen.plateTrayPos);
  kitchen.plateGroup.rotation.set(0, 0, 0);
  kitchen.bowlSoupGroup.visible = false;
  kitchen.platedEggGroup.visible = false;
  kitchen.bowlSmudgeDyn.update(0);
  kitchen.plateSmudgeDyn.update(0);

  // Fresh veggies on cutting board
  state.chopStage = 0;
  state.veggiesInPot = false;
  kitchen.carrotGroup.visible = true;
  kitchen.carrotSlices.forEach((s) => {
    s.position.copy(s.userData.homePos);
    s.rotation.set(0, 0, -Math.PI / 2);
  });
  kitchen.broccoliGroup.visible = true;
  kitchen.broccoliFlorets.forEach((f) => f.position.copy(f.userData.homePos));
  while (kitchen.potVeggiesGroup.children.length > 0) {
    kitchen.potVeggiesGroup.remove(kitchen.potVeggiesGroup.children[0]);
  }
  potVeggies.length = 0;

  // Fresh broth pitcher & empty pot
  state.soupLevel = 0;
  state.pouringBroth = false;
  kitchen.soupMesh.visible = false;
  kitchen.pitcherLiquid.scale.y = 1;
  kitchen.pitcherLiquid.position.y = 0.064;

  // Fresh brown egg in egg cup & clean pan with fresh butter pat
  state.eggState = 'in_cup';
  state.eggCrackAnim = 0;
  kitchen.rawEggGroup.visible = true;
  kitchen.rawEggGroup.position.copy(kitchen.rawEggHome);
  kitchen.eggTopHalf.position.set(0, 0, 0);
  kitchen.eggTopHalf.rotation.set(0, 0, 0);
  kitchen.eggBottomHalf.position.set(0, 0, 0);
  kitchen.eggBottomHalf.rotation.set(0, 0, 0);
  kitchen.eggCrackRing.visible = false;
  kitchen.friedEggInPan.visible = false;
  kitchen.eggHerbsGroup.visible = false;
  kitchen.butterPat.visible = true;
  kitchen.butterPat.scale.set(1, 1, 1);
  kitchen.eggWhiteDyn.update(0, 0);

  // Reset stove & cooking values
  setKnobTarget('left', 0, false);
  setKnobTarget('right', 0, false);
  state.soupTemp = 0;
  state.soupCook = 0;
  state.soupSeasoned = false;
  state.soupPlated = false;
  state.panTemp = 0;
  state.butterMelted = 0;
  state.eggCook = 0;
  state.eggCrisp = 0;
  state.eggSeasoned = false;
  state.eggPlated = false;

  // Reset Mom for another loving home-cooked meal!
  state.momAteSoup = false;
  state.momAteEgg = false;
  state.momHealth = 0;
  state.coolingPadPeel = 0;
  momScene.coolingPad.visible = true;
  momScene.coolingPad.position.set(0, 0.072, 0.148);
  momScene.coolingPad.rotation.set(-0.22, 0, 0);
  momScene.sleepyEyesGroup.visible = true;
  momScene.happyEyesGroup.visible = false;
  momScene.sleepyMouth.visible = true;
  momScene.happyMouth.visible = false;
  momScene.hanamaruDyn.reset();
  state.hanamaruProgress = 0;
  state.hanamaruDoneTime = 0;
  state.faucetOn = false;
  kitchen.spongeGroup.position.copy(kitchen.spongeHome);
}

// ============================================================================
// POINTER EVENT HANDLERS (STRICT SINGLE-FINGER SAFE, ZERO MULTI-TOUCH GLITCHES)
// ============================================================================
const dom = renderer.domElement;

dom.addEventListener('pointerdown', (e) => {
  if (activePointerId !== null) return; // Ignore extra fingers safely!
  activePointerId = e.pointerId;
  dom.setPointerCapture(e.pointerId);

  sound.unlock();
  resetIdle();

  downScreenX = lastScreenX = e.clientX;
  downScreenY = lastScreenY = e.clientY;
  dragDistance = 0;
  dragKind = 'tap_only';

  const res = hitTest(e.clientX, e.clientY);
  downTargetId = res ? res.id : null;

  if (!res) return;

  if (state.phase === 'cook') {
    if (res.id === 'knob_left' || res.id === 'knob_right') {
      dragKind = res.id;
      const side = res.id === 'knob_left' ? 'left' : 'right';
      knobStartLevel = state.knob[side].targetLevel;
    } else if (res.id === 'soup_pot' && (state.soupLevel > 0.15 || state.veggiesInPot)) {
      dragKind = 'stir';
    } else if (res.id === 'veggies' || res.id === 'cutting_board') {
      dragKind = 'veggie_swipe';
    } else if (res.id === 'tray' || ((res.id === 'soup_bowl' || res.id === 'egg_plate') && state.soupPlated && state.eggPlated)) {
      dragKind = 'tray_drag';
    }
  } else if (state.phase === 'wash') {
    if (res.id === 'sponge' || res.id === 'soup_bowl' || res.id === 'egg_plate') {
      dragKind = 'sponge';
      state.spongeDragging = true;
      const p = projectToPlane(e.clientX, e.clientY, -0.08);
      if (p) {
        state.spongeTarget.set(
          THREE.MathUtils.clamp(p.x, 1.44, 2.08),
          -0.11,
          THREE.MathUtils.clamp(p.z, -0.22, 0.22)
        );
        scrubDishAtWorldPos(state.spongeTarget);
      }
    }
  } else if (state.phase === 'hanamaru' && res.id === 'hanamaru_card' && state.hanamaruProgress >= 0.98) {
    // Playful bonus: tap the finished Hanamaru card to stamp cute flower stickers!
    if (res.hit.uv) {
      momScene.hanamaruDyn.addFlowerStamp(res.hit.uv.x, res.hit.uv.y);
      sound.playWarmChime([783.99, 1046.5]);
      particles.spawnGoldSparkle(res.hit.point, 8, 0.12);
    }
  }
});

dom.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId) return;
  const dx = e.clientX - lastScreenX;
  const dy = e.clientY - lastScreenY;
  dragDistance += Math.hypot(dx, dy);
  lastScreenX = e.clientX;
  lastScreenY = e.clientY;
  resetIdle();

  if (dragKind === 'knob_left' || dragKind === 'knob_right') {
    const side = dragKind === 'knob_left' ? 'left' : 'right';
    // Natural intuitive one-finger turning: dragging left OR down turns the flame UP (CCW), right/up turns it DOWN!
    const totalDx = e.clientX - downScreenX;
    const totalDy = e.clientY - downScreenY;
    const delta = (-totalDx + totalDy * 0.85) / 115;
    if (dragDistance > 10) {
      setKnobTarget(side, knobStartLevel + delta, true);
    }
  } else if (dragKind === 'stir' && state.phase === 'cook') {
    if (dragDistance > 14 && state.soupCook < 0.99) {
      const speed = Math.min(8, Math.hypot(dx, dy) * 0.22);
      state.stirVel = Math.min(7.5, state.stirVel + speed * 0.35);
      if (state.soupTemp > 0.35 && state.veggiesInPot && state.soupLevel > 0.4) {
        state.soupCook = Math.min(1, state.soupCook + 0.003);
      }
      if (stirAudioCooldown <= 0 && speed > 0.8) {
        stirAudioCooldown = 0.22;
        sound.playStirSwish();
      }
    }
  } else if (dragKind === 'sponge' && state.phase === 'wash') {
    const p = projectToPlane(e.clientX, e.clientY, -0.08);
    if (p) {
      state.spongeTarget.set(
        THREE.MathUtils.clamp(p.x, 1.44, 2.08),
        -0.11,
        THREE.MathUtils.clamp(p.z, -0.22, 0.22)
      );
      if (Math.hypot(dx, dy) > 2.5) {
        scrubDishAtWorldPos(state.spongeTarget);
      }
    }
  }
});

dom.addEventListener('pointerup', (e) => {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;

  const isTap = dragDistance < 22;
  const endHit = hitTest(e.clientX, e.clientY);
  const endId = endHit ? endHit.id : null;

  if (dragKind === 'sponge') {
    state.spongeDragging = false;
    // Also allow generous tap-to-scrub on a dirty dish!
    if (isTap && (downTargetId === 'soup_bowl' || downTargetId === 'egg_plate')) {
      const targetPos = downTargetId === 'soup_bowl' ? kitchen.bowlGroup.position : kitchen.plateGroup.position;
      state.spongeTarget.set(targetPos.x, -0.10, targetPos.z);
      scrubDishAtWorldPos(targetPos);
      scrubDishAtWorldPos(targetPos);
      scrubDishAtWorldPos(targetPos);
    }
  } else if (state.phase === 'cook') {
    handleCookPointerUp(isTap, downTargetId, endId);
  } else if (state.phase === 'mom_eat') {
    handleMomEatPointerUp(downTargetId, endId);
  } else if (state.phase === 'hanamaru') {
    if (state.hanamaruProgress >= 0.98 && (downTargetId === 'tray' || downTargetId === 'soup_bowl' || downTargetId === 'egg_plate')) {
      startMoveToSink();
    }
  } else if (state.phase === 'wash') {
    handleWashPointerUp(downTargetId);
  }

  dragKind = null;
  downTargetId = null;
});

dom.addEventListener('pointercancel', (e) => {
  if (e.pointerId === activePointerId) {
    activePointerId = null;
    state.spongeDragging = false;
    dragKind = null;
  }
});

function handleCookPointerUp(isTap, startId, endId) {
  if (!startId) return;

  // Gas stove knobs: tap cycles cleanly if user didn't drag-turn
  if (startId === 'knob_left' && isTap) {
    cycleKnobTap('left');
    return;
  }
  if (startId === 'knob_right' && isTap) {
    cycleKnobTap('right');
    return;
  }

  // Cutting board & veggies (tap OR swipe!)
  if (startId === 'veggies' || startId === 'cutting_board') {
    advanceChopOrSweepVeggies();
    return;
  }

  // Broth/Water pitcher (tap OR drag toward pot!)
  if (startId === 'pitcher') {
    triggerPourBroth();
    return;
  }

  // Fresh brown egg (tap to crack → tap or drag to frying pan!)
  if (startId === 'raw_egg') {
    if (!isTap && (endId === 'frying_pan' || dragDistance > 36) && state.eggState === 'in_cup') {
      // One smooth drag straight to pan cracks & drops it right in!
      state.eggState = 'cracked_hover';
      kitchen.eggCrackRing.visible = true;
      advanceEggAction();
    } else {
      advanceEggAction();
    }
    return;
  }

  // Seasoning shaker (playful discovery anytime!)
  if (startId === 'shaker') {
    triggerSeasoning();
    return;
  }

  // Soup pot / Ladle / Soup bowl plating OR playful wobble
  if (startId === 'soup_pot' || startId === 'ladle') {
    if (state.soupCook >= 0.92 && !state.soupPlated) {
      triggerPlateSoup();
    } else if (state.soupLevel > 0.15 || state.veggiesInPot) {
      // Give a fun ladle stir swirl on tap too!
      state.stirVel = Math.max(state.stirVel, 4.2);
      sound.playStirSwish();
      triggerWobble(kitchen.potGroup, 0.05);
    } else {
      sound.playCeramicClink(0.75);
      triggerWobble(kitchen.potGroup, 0.07);
    }
    return;
  }

  // Frying pan / Spatula plating OR raw yolk wobble!
  if (startId === 'frying_pan' || startId === 'spatula') {
    if (state.eggCook >= 0.92 && !state.eggPlated) {
      triggerPlateEgg();
    } else if (state.eggState === 'in_pan') {
      state.yolkWobble = 1.0;
      sound.playPlop(1.3);
      triggerWobble(kitchen.panGroup, 0.04);
    } else {
      sound.playWoodTap(0.85);
      triggerWobble(kitchen.panGroup, 0.06);
    }
    return;
  }

  // Empty bowl or plate on tray (also allows tapping bowl/plate directly when food is cooked!)
  if (startId === 'soup_bowl') {
    if (state.soupPlated && state.eggPlated) {
      startDeliverToMom();
    } else if (state.soupCook >= 0.92 && !state.soupPlated) {
      triggerPlateSoup();
    } else {
      sound.playCeramicClink(1.1);
      triggerWobble(kitchen.bowlGroup, 0.1);
    }
    return;
  }

  if (startId === 'egg_plate') {
    if (state.soupPlated && state.eggPlated) {
      startDeliverToMom();
    } else if (state.eggCook >= 0.92 && !state.eggPlated) {
      triggerPlateEgg();
    } else {
      sound.playCeramicClink(1.25);
      triggerWobble(kitchen.plateGroup, 0.09);
    }
    return;
  }

  // Carrying the loaded serving tray to Mom!
  if (startId === 'tray') {
    if (state.soupPlated && state.eggPlated) {
      startDeliverToMom();
    } else {
      sound.playWoodTap(1.0);
      triggerWobble(kitchen.trayGroup, 0.04);
    }
    return;
  }

  // Playful pokes on Mom through pass-through or shelf jars!
  if (startId === 'mom') {
    sound.playWarmChime([440, 523.25]);
    triggerWobble(momScene.headPivot, 0.12);
    return;
  }

  if (startId.startsWith('prop_jar_')) {
    const idx = parseInt(startId.split('_')[2], 10);
    sound.playCeramicClink(1.15 + idx * 0.14);
    triggerWobble(kitchen.shelfJars[idx], 0.14);
  }
}

function handleMomEatPointerUp(startId, endId) {
  if (!startId) return;
  if (startId === 'soup_bowl' || (startId === 'mom' && !state.momAteSoup)) {
    triggerFeedMom('soup');
  } else if (startId === 'egg_plate' || (startId === 'mom' && !state.momAteEgg)) {
    triggerFeedMom('egg');
  } else if (endId === 'mom') {
    if (!state.momAteSoup) triggerFeedMom('soup');
    else if (!state.momAteEgg) triggerFeedMom('egg');
  }
}

function handleWashPointerUp(startId) {
  if (!startId) return;
  if (startId === 'faucet') {
    state.faucetOn = !state.faucetOn;
    sound.playKnobClick(state.faucetOn ? 2 : 0);
    if (state.faucetOn) {
      particles.spawnDroplets(new THREE.Vector3(1.76, -0.14, -0.08), { count: 8, kind: 'water' });
      // Auto-rinse any already-scrubbed dishes!
      if (state.bowlScrubbed && !state.bowlClean) finishCleanDish('bowl');
      if (state.plateScrubbed && !state.plateClean) finishCleanDish('plate');
    }
  } else if (startId === 'soap_bottle') {
    sound.playBubblePop();
    triggerWobble(kitchen.soapGroup, 0.14);
    particles.spawnSoapBubble(new THREE.Vector3(1.94, 0.16, -0.26), { count: 7, floatUp: true });
  }
}

// ============================================================================
// GENTLE IDLE HAND HINT (SILENT 0..9s, DEMONSTRATES ONCE ONLY IF IDLE)
// ============================================================================
function getHintWorldEndpoints() {
  if (state.phase === 'cook') {
    if (!state.veggiesInPot) {
      return {
        a: new THREE.Vector3(-0.82, 0.06, 0.08),
        b: state.chopStage < 3 ? new THREE.Vector3(-0.74, 0.06, 0.02) : new THREE.Vector3(-0.22, 0.22, -0.05),
      };
    }
    if (state.soupLevel < 0.8) {
      return { a: new THREE.Vector3(-0.62, 0.12, -0.25), b: new THREE.Vector3(-0.22, 0.24, -0.05) };
    }
    if (state.soupCook < 0.92 && state.knob.left.targetLevel < 0.1) {
      return { a: new THREE.Vector3(-0.22, 0.06, 0.29), b: new THREE.Vector3(-0.34, 0.01, 0.29) };
    }
    if (state.eggState === 'in_cup' || state.eggState === 'cracked_hover') {
      return { a: kitchen.rawEggGroup.position.clone(), b: new THREE.Vector3(0.22, 0.18, -0.05) };
    }
    if (state.eggCook < 0.92 && state.knob.right.targetLevel < 0.1) {
      return { a: new THREE.Vector3(0.22, 0.06, 0.29), b: new THREE.Vector3(0.10, 0.01, 0.29) };
    }
    if (state.soupCook >= 0.92 && !state.soupPlated) {
      return { a: new THREE.Vector3(-0.22, 0.22, -0.05), b: new THREE.Vector3(0.75, 0.08, 0.05) };
    }
    if (state.eggCook >= 0.92 && !state.eggPlated) {
      return { a: new THREE.Vector3(0.22, 0.18, -0.05), b: new THREE.Vector3(0.97, 0.06, 0.05) };
    }
    if (state.soupPlated && state.eggPlated) {
      return { a: new THREE.Vector3(0.86, 0.06, 0.04), b: new THREE.Vector3(0.15, 0.28, -0.85) };
    }
  } else if (state.phase === 'mom_eat') {
    if (!state.momAteSoup) {
      return { a: new THREE.Vector3(-0.11, 0.22, -1.23), b: new THREE.Vector3(0.0, 0.56, -1.78) };
    }
    if (!state.momAteEgg) {
      return { a: new THREE.Vector3(0.11, 0.20, -1.23), b: new THREE.Vector3(0.0, 0.56, -1.78) };
    }
  } else if (state.phase === 'wash') {
    if (!state.faucetOn) {
      return { a: new THREE.Vector3(1.82, 0.08, -0.34), b: new THREE.Vector3(1.88, 0.16, -0.34) };
    }
    if (!state.bowlClean) {
      return { a: new THREE.Vector3(1.56, -0.10, -0.04), b: new THREE.Vector3(1.70, -0.10, 0.02) };
    }
    if (!state.plateClean) {
      return { a: new THREE.Vector3(1.82, -0.10, 0.02), b: new THREE.Vector3(1.94, -0.10, 0.06) };
    }
  }
  return null;
}

function worldToScreen(v) {
  const p = v.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * window.innerWidth,
    y: (-p.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function updateIdleHint(dt) {
  if (activePointerId !== null || state.phase === 'mom_deliver' || state.phase === 'to_sink' || state.phase === 'hanamaru' || state.phase === 'celebrate_reset') {
    hintHandEl.style.opacity = '0';
    state.hintPlaying = false;
    return;
  }

  state.idleTimer += dt;
  if (!state.hintPlaying && state.idleTimer >= 9.0) {
    const pts = getHintWorldEndpoints();
    if (pts) {
      state.hintPlaying = true;
      state.hintAnimT = 0;
    } else {
      state.idleTimer = 0;
    }
  }

  if (state.hintPlaying) {
    state.hintAnimT += dt / 1.7;
    const pts = getHintWorldEndpoints();
    if (!pts || state.hintAnimT >= 1.0) {
      state.hintPlaying = false;
      state.idleTimer = 0;
      hintHandEl.style.opacity = '0';
      return;
    }
    const t = state.hintAnimT;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const sa = worldToScreen(pts.a);
    const sb = worldToScreen(pts.b);
    const sx = THREE.MathUtils.lerp(sa.x, sb.x, ease);
    const sy = THREE.MathUtils.lerp(sa.y, sb.y, ease) - Math.sin(ease * Math.PI) * 18;
    const alpha = t < 0.18 ? t / 0.18 : t > 0.8 ? (1 - t) / 0.2 : 1;
    hintHandEl.style.opacity = String((alpha * 0.78).toFixed(3));
    hintHandEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
  }
}

// ============================================================================
// MAIN ANIMATION & REAL-TIME SIMULATION LOOP
// ============================================================================
const clock = new THREE.Clock();
let steamTimerLeft = 0;
let steamTimerRight = 0;
let steamTimerPlated = 0;
let oilPopTimer = 0;
let lastEggTexVal = -1;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  scrubAudioCooldown = Math.max(0, scrubAudioCooldown - dt);
  stirAudioCooldown = Math.max(0, stirAudioCooldown - dt);

  // --------------------------------------------------------------------------
  // 1. SMOOTH ADAPTIVE CAMERA GLIDE
  // --------------------------------------------------------------------------
  const camGoal = getCameraGoal();
  camDesiredTarget.copy(camGoal.target);
  computeResponsiveCamera(camGoal.target, camGoal.dir, camGoal.viewW, camGoal.viewH, camDesiredPos);
  const camLerp = 1 - Math.exp(-dt * 4.2);
  camCurTarget.lerp(camDesiredTarget, camLerp);
  camCurPos.lerp(camDesiredPos, camLerp);
  camera.position.copy(camCurPos);
  camera.lookAt(camCurTarget);

  // --------------------------------------------------------------------------
  // 2. GAS STOVE KNOBS & REALISTIC MULTI-JET BLUE GAS FLAMES
  // --------------------------------------------------------------------------
  ['left', 'right'].forEach((side) => {
    const k = state.knob[side];
    const b = kitchen.burners[side];
    k.level = THREE.MathUtils.lerp(k.level, k.targetLevel, 1 - Math.exp(-dt * 14));
    // Rotate counter-clockwise from 0 to 2.95 rad
    const targetAng = k.level * 2.95;
    k.angle = THREE.MathUtils.lerp(k.angle, targetAng, 1 - Math.exp(-dt * 16));
    b.knobRotor.rotation.z = k.angle;

    // Slight realistic push-in depression during ignition spark!
    if (k.sparkTimer > 0) {
      k.sparkTimer = Math.max(0, k.sparkTimer - dt);
      b.knobRotor.position.z = 0.011;
    } else {
      b.knobRotor.position.z = THREE.MathUtils.lerp(b.knobRotor.position.z, 0.018, dt * 12);
    }

    const active = k.level > 0.04;
    b.flameGroup.visible = active;
    if (active) {
      const f = k.level;
      const flicker = 0.92 + Math.sin(elapsed * 34 + (side === 'left' ? 0 : 2.1)) * 0.08;
      b.jets.forEach((j) => {
        const jFlick = 0.88 + Math.sin(elapsed * 42 + j.phase) * 0.14;
        const hScale = (0.35 + f * 0.95) * jFlick;
        const wScale = 0.65 + f * 0.55;
        j.holder.scale.set(wScale, hScale, wScale);
      });
      b.flameTipMat.opacity = Math.max(0, (f - 0.62) * 2.1) * flicker;
      b.glowRing.material.opacity = (0.28 + f * 0.45) * flicker;
      b.flameLight.intensity = (0.25 + f * 0.65) * flicker;
      b.flameLight.color.setHex(f > 0.78 ? 0x5ab0ff : 0x2a8eff);
    } else {
      b.flameLight.intensity = 0;
    }
  });

  // --------------------------------------------------------------------------
  // 3. KNIFE CHOP, BROTH POURING, EGG CRACKING, SHAKER ANIMATIONS
  // --------------------------------------------------------------------------
  if (state.knifeAnim > 0) {
    state.knifeAnim = Math.max(0, state.knifeAnim - dt * 4.5);
    const arc = Math.sin(state.knifeAnim * Math.PI);
    kitchen.knifeGroup.position.set(
      THREE.MathUtils.lerp(kitchen.knifeHome.x, -0.80, arc),
      kitchen.knifeHome.y + arc * 0.09,
      THREE.MathUtils.lerp(kitchen.knifeHome.z, 0.06, arc)
    );
    kitchen.knifeGroup.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 0.15, arc);
    kitchen.knifeGroup.rotation.z = 0.14 - arc * 0.35;
  } else {
    kitchen.knifeGroup.position.lerp(kitchen.knifeHome, dt * 10);
    kitchen.knifeGroup.rotation.x = THREE.MathUtils.lerp(kitchen.knifeGroup.rotation.x, Math.PI / 2, dt * 10);
  }

  if (state.pouringBroth) {
    state.pourTimer += dt;
    const dur = 1.25;
    const t = Math.min(1, state.pourTimer / dur);
    const lift = Math.sin(t * Math.PI);
    const pourTarget = new THREE.Vector3(-0.36, 0.36, -0.08);
    kitchen.pitcherGroup.position.lerpVectors(kitchen.pitcherHome, pourTarget, Math.min(1, lift * 1.4));
    kitchen.pitcherGroup.rotation.z = -lift * 1.08;

    const midPour = t > 0.18 && t < 0.82;
    kitchen.pourStream.visible = midPour;
    if (midPour) {
      kitchen.pourStream.position.set(-0.24, 0.28, -0.06);
      kitchen.pourStream.scale.set(0.9 + Math.sin(elapsed * 30) * 0.12, 1, 0.9 + Math.cos(elapsed * 26) * 0.12);
      const prevLevel = state.soupLevel;
      state.soupLevel = Math.min(1, state.soupLevel + dt * 1.25);
      if (Math.floor(state.soupLevel * 4) > Math.floor(prevLevel * 4)) {
        sound.playWaterPourGlug(state.soupLevel);
        particles.spawnDroplets(new THREE.Vector3(-0.22, 0.16 + state.soupLevel * 0.08, -0.05), { count: 4, kind: 'water', spread: 0.14 });
      }
      // If pouring into an already-hot pot, crisp steam puff!
      if (state.soupTemp > 0.45 && Math.random() < dt * 8) {
        particles.spawnSteam(new THREE.Vector3(-0.22, 0.25, -0.05), { count: 2, scale: 0.11, opacity: 0.32 });
      }
    }
    const remLiquid = Math.max(0.15, 1 - state.soupLevel * 0.78);
    kitchen.pitcherLiquid.scale.y = remLiquid;
    kitchen.pitcherLiquid.position.y = 0.008 + remLiquid * 0.056;

    if (t >= 1) {
      state.pouringBroth = false;
      kitchen.pourStream.visible = false;
      kitchen.pitcherGroup.position.copy(kitchen.pitcherHome);
      kitchen.pitcherGroup.rotation.z = 0;
    }
  }

  // Raw egg hover & split-shell crack over frying pan
  if (state.eggState === 'cracked_hover') {
    const hoverPos = new THREE.Vector3(0.22, 0.29, -0.05);
    kitchen.rawEggGroup.position.lerp(hoverPos, 1 - Math.exp(-dt * 11));
    kitchen.rawEggGroup.position.y += Math.sin(elapsed * 5) * 0.002;
  } else if (state.eggState === 'cracking') {
    state.eggCrackAnim += dt * 2.4;
    const t = Math.min(1, state.eggCrackAnim);
    kitchen.eggTopHalf.position.y = t * 0.045;
    kitchen.eggTopHalf.position.x = -t * 0.03;
    kitchen.eggTopHalf.rotation.z = t * 0.9;
    kitchen.eggBottomHalf.position.y = t * 0.03;
    kitchen.eggBottomHalf.position.x = t * 0.035;
    kitchen.eggBottomHalf.rotation.z = -t * 0.9;
    kitchen.eggCrackRing.visible = false;

    if (t >= 0.45 && !kitchen.friedEggInPan.visible) {
      kitchen.friedEggInPan.visible = true;
      state.yolkWobble = 1.0;
      if (state.panTemp > 0.35) {
        sound.playSteamBurst();
        particles.spawnSteam(new THREE.Vector3(0.22, 0.19, -0.05), { count: 4, scale: 0.11, opacity: 0.36 });
      }
    }
    if (t >= 1) {
      state.eggState = 'in_pan';
      kitchen.rawEggGroup.visible = false;
    }
  }

  // Seasoning shaker arc
  if (state.shakerAnim > 0) {
    state.shakerAnim = Math.max(0, state.shakerAnim - dt * 1.9);
    const arc = Math.sin(state.shakerAnim * Math.PI);
    kitchen.shakerGroup.position.lerpVectors(kitchen.shakerHome, state.shakerTarget, arc);
    kitchen.shakerGroup.rotation.z = arc * 2.35 + Math.sin(elapsed * 42) * 0.25 * arc;
  } else {
    kitchen.shakerGroup.position.lerp(kitchen.shakerHome, dt * 10);
    kitchen.shakerGroup.rotation.z = THREE.MathUtils.lerp(kitchen.shakerGroup.rotation.z, 0, dt * 10);
  }

  // --------------------------------------------------------------------------
  // 4. SOUP THERMAL SIMULATION, CONVECTION VORTEX, BOILING BUBBLES & STEAM
  // --------------------------------------------------------------------------
  const leftFlame = state.knob.left.level;
  if (leftFlame > 0.05) {
    state.soupTemp = Math.min(1, state.soupTemp + dt * (0.16 + leftFlame * 0.26));
  } else {
    state.soupTemp = Math.max(0, state.soupTemp - dt * 0.06);
  }

  const hasSoupLiquid = state.soupLevel > 0.05 && !state.soupPlated;
  kitchen.soupMesh.visible = hasSoupLiquid;
  if (hasSoupLiquid) {
    const baseY = 0.022 + state.soupLevel * 0.072;
    kitchen.soupMesh.position.y = baseY + Math.sin(elapsed * 8) * 0.0012 * state.soupTemp;

    // Advance soup cooking once hot with veggies & liquid!
    if (state.veggiesInPot && state.soupLevel > 0.45 && state.soupTemp > 0.45 && state.soupCook < 1) {
      const rate = (0.12 + leftFlame * 0.15) * (state.soupSeasoned ? 1.15 : 1.0);
      state.soupCook = Math.min(1, state.soupCook + dt * rate);
      if (state.soupCook >= 1) {
        sound.playWarmChime([523.25, 659.25, 783.99]);
        particles.spawnGoldSparkle(new THREE.Vector3(-0.22, 0.28, -0.05), 10, 0.18);
      }
    }

    // Color transitions from pale clear broth -> velvety creamy golden-orange veggie soup!
    const colRaw = new THREE.Color(0xfff0b8);
    const colCooked = new THREE.Color(0xf09d30);
    kitchen.soupMat.color.lerpColors(colRaw, colCooked, state.soupCook);
    kitchen.soupMat.opacity = 0.68 + state.soupCook * 0.30;

    // Stirring vortex decay & convection swirl of floating veggies
    state.stirVel = Math.max(0, state.stirVel - dt * 2.4);
    const convect = state.soupTemp > 0.55 ? (state.soupTemp - 0.55) * 1.1 : 0;
    state.stirAngle += dt * (state.stirVel + convect);

    for (const v of potVeggies) {
      const a = v.baseA + state.stirAngle;
      const bob = Math.sin(elapsed * (3 + state.soupTemp * 6) + v.phase) * (0.003 + state.soupTemp * 0.004);
      v.mesh.position.set(Math.cos(a) * v.baseR, baseY + bob, Math.sin(a) * v.baseR);
      v.mesh.rotation.y = a;
    }

    // Boiling bubbles on soup surface
    const showBoil = state.soupTemp > 0.45;
    kitchen.soupBubbles.forEach((bm) => {
      bm.visible = showBoil;
      if (showBoil) {
        const cycle = ((elapsed * (1.8 + state.soupTemp * 2.6) + bm.userData.phase) % 1);
        const s = Math.sin(cycle * Math.PI) * (0.4 + state.soupTemp * 0.9) * (leftFlame > 0.8 && state.soupCook >= 0.95 ? 1.45 : 1);
        bm.scale.setScalar(Math.max(0.01, s));
        const a = bm.userData.baseA + state.stirAngle * 0.4;
        bm.position.set(Math.cos(a) * bm.userData.baseR, baseY + 0.002 + s * 0.005, Math.sin(a) * bm.userData.baseR);
      }
    });

    // Fragrant steam curls rising from hot soup!
    if (state.soupTemp > 0.35) {
      steamTimerLeft -= dt;
      if (steamTimerLeft <= 0) {
        steamTimerLeft = 0.14 + (1 - state.soupTemp) * 0.25;
        particles.spawnSteam(new THREE.Vector3(-0.22, 0.24, -0.05), {
          count: 1,
          scale: 0.08 + state.soupTemp * 0.06,
          speed: 0.15 + state.soupTemp * 0.14,
          opacity: 0.16 + state.soupTemp * 0.22,
        });
      }
    }
  } else {
    kitchen.soupBubbles.forEach((bm) => { bm.visible = false; });
    kitchen.potVeggiesGroup.visible = state.veggiesInPot && !state.soupPlated;
  }

  // Ladle motion: stirring inside pot OR scooping & plating to ceramic bowl!
  if (state.ladleAnim > 0) {
    state.ladleAnim += dt * 0.72;
    const t = Math.min(1, state.ladleAnim);
    const potCenter = new THREE.Vector3(-0.22, 0.25, -0.05);
    const bowlCenter = new THREE.Vector3(0.675, 0.14, 0.05);

    if (t < 0.32) {
      const k = t / 0.32;
      kitchen.ladleGroup.position.lerpVectors(kitchen.ladleHome, potCenter, k);
      kitchen.ladleGroup.rotation.set(0, THREE.MathUtils.lerp(0.45, 0.1, k), -0.4 * k);
      kitchen.ladleSoupFill.visible = k > 0.7;
    } else if (t < 0.76) {
      const k = (t - 0.32) / 0.44;
      kitchen.ladleSoupFill.visible = true;
      kitchen.ladleGroup.position.lerpVectors(potCenter, bowlCenter, k);
      kitchen.ladleGroup.position.y += Math.sin(k * Math.PI) * 0.18;
      kitchen.ladleGroup.rotation.z = -0.2 + (k > 0.72 ? (k - 0.72) * 3.2 : 0);
    } else {
      if (!state.soupPlated) {
        state.soupPlated = true;
        kitchen.bowlSoupGroup.visible = true;
        kitchen.ladleSoupFill.visible = false;
        sound.playPlop(0.88);
        sound.playWarmChime([587.33, 783.99]);
        particles.spawnSteam(bowlCenter, { count: 4, scale: 0.09, opacity: 0.3 });
      }
      const k = (t - 0.76) / 0.24;
      kitchen.ladleGroup.position.lerpVectors(bowlCenter, kitchen.ladleHome, k);
      kitchen.ladleGroup.rotation.set(0, THREE.MathUtils.lerp(0.1, 0.45, k), THREE.MathUtils.lerp(0.5, 0, k));
    }
    if (t >= 1) {
      state.ladleAnim = 0;
      kitchen.ladleGroup.position.copy(kitchen.ladleHome);
      kitchen.ladleGroup.rotation.set(0, 0.45, 0);
    }
  } else if (state.stirVel > 0.15) {
    // Dip wooden ladle gracefully into pot while stirring!
    const stirPos = new THREE.Vector3(
      -0.25 + Math.cos(state.stirAngle) * 0.04,
      0.22,
      -0.05 + Math.sin(state.stirAngle) * 0.04
    );
    kitchen.ladleGroup.position.lerp(stirPos, dt * 10);
    kitchen.ladleGroup.rotation.z = THREE.MathUtils.lerp(kitchen.ladleGroup.rotation.z, -0.95, dt * 10);
  } else {
    kitchen.ladleGroup.position.lerp(kitchen.ladleHome, dt * 8);
    kitchen.ladleGroup.rotation.z = THREE.MathUtils.lerp(kitchen.ladleGroup.rotation.z, 0, dt * 8);
  }

  // --------------------------------------------------------------------------
  // 5. FRYING PAN THERMAL SIMULATION, BUTTER MELTING, FRIED EGG COOKING & SIZZLE
  // --------------------------------------------------------------------------
  const rightFlame = state.knob.right.level;
  if (rightFlame > 0.05) {
    state.panTemp = Math.min(1, state.panTemp + dt * (0.20 + rightFlame * 0.32));
  } else {
    state.panTemp = Math.max(0, state.panTemp - dt * 0.07);
  }

  // Butter pat melts smoothly into glistening golden oil (and tucks cleanly beneath the egg once dropped!)
  if (state.eggState === 'in_pan' || state.eggState === 'plated') {
    kitchen.butterPat.visible = false;
    kitchen.oilSheen.material.opacity = 0.44;
  } else if (state.panTemp > 0.20 && state.butterMelted < 1) {
    state.butterMelted = Math.min(1, state.butterMelted + dt * 0.9 * state.panTemp);
    const rem = Math.max(0.01, 1 - state.butterMelted);
    kitchen.butterPat.scale.set(1 + state.butterMelted * 0.6, rem, 1 + state.butterMelted * 0.6);
    kitchen.butterPat.position.y = 0.012 + rem * 0.006;
    kitchen.butterPat.visible = rem > 0.06;
    kitchen.oilSheen.material.opacity = 0.16 + state.butterMelted * 0.34;
  }

  let panSizzleIntensity = 0;
  if (state.eggState === 'in_pan' && !state.eggPlated) {
    if (state.panTemp > 0.32) {
      panSizzleIntensity = state.panTemp * (0.55 + rightFlame * 0.45);
      if (state.eggCook < 1) {
        state.eggCook = Math.min(1, state.eggCook + dt * (0.14 + rightFlame * 0.15));
        if (state.eggCook >= 1) {
          sound.playWarmChime([659.25, 783.99, 1046.5]);
          particles.spawnGoldSparkle(new THREE.Vector3(0.22, 0.22, -0.05), 10, 0.18);
        }
      } else if (rightFlame > 0.5) {
        // Extra crisp golden lacy edge if kept sizzling a bit longer (never burns/fails!)
        state.eggCrisp = Math.min(1, state.eggCrisp + dt * 0.22);
      }

      // Oil sizzle micro-pops & steam
      oilPopTimer -= dt;
      if (oilPopTimer <= 0) {
        oilPopTimer = 0.16 + Math.random() * 0.22;
        particles.spawnDroplets(new THREE.Vector3(0.22, 0.165, -0.05), { count: 2, kind: 'oil', spread: 0.12 });
      }
      steamTimerRight -= dt;
      if (steamTimerRight <= 0) {
        steamTimerRight = 0.22 + (1 - state.panTemp) * 0.25;
        particles.spawnSteam(new THREE.Vector3(0.22, 0.18, -0.05), {
          count: 1,
          scale: 0.065 + state.eggCrisp * 0.04,
          speed: 0.14,
          opacity: 0.18 + state.eggCrisp * 0.16,
        });
      }
    }

    // Update dynamic egg white canvas texture smoothly when cooking progresses
    const quantVal = Math.round(state.eggCook * 32) + Math.round(state.eggCrisp * 16) * 100;
    if (quantVal !== lastEggTexVal) {
      lastEggTexVal = quantVal;
      kitchen.eggWhiteDyn.update(state.eggCook, state.eggCrisp);
      // Egg white subtly puffs slightly as it cooks!
      kitchen.eggWhiteMesh.position.y = 0.002 + state.eggCook * 0.004;
    }

    // Plump glossy yolk jelly wobble!
    if (state.yolkWobble > 0.01) {
      state.yolkWobble = Math.max(0, state.yolkWobble - dt * 2.2);
      const w = Math.sin(elapsed * 26) * 0.12 * state.yolkWobble;
      kitchen.eggYolkMesh.scale.set(1 + w, 0.66 - w * 0.7, 1 + w);
    } else {
      kitchen.eggYolkMesh.scale.set(1, 0.66, 1);
    }
  }

  // Spatula plating fried egg smoothly onto ceramic plate!
  if (state.spatulaAnim > 0) {
    state.spatulaAnim += dt * 0.76;
    const t = Math.min(1, state.spatulaAnim);
    const panPos = new THREE.Vector3(0.22, 0.16, -0.05);
    const platePos = new THREE.Vector3(0.90, 0.06, 0.05);

    if (t < 0.30) {
      const k = t / 0.30;
      kitchen.spatulaGroup.position.lerpVectors(kitchen.spatulaHome, panPos, k);
      kitchen.spatulaGroup.rotation.y = THREE.MathUtils.lerp(-0.5, 0.15, k);
    } else if (t < 0.75) {
      const k = (t - 0.30) / 0.45;
      kitchen.spatulaGroup.position.lerpVectors(panPos, platePos, k);
      kitchen.spatulaGroup.position.y += Math.sin(k * Math.PI) * 0.16;
      // Lift fried egg right along with spatula!
      kitchen.friedEggInPan.visible = false;
      kitchen.platedEggGroup.visible = true;
      kitchen.platedEggGroup.position.set(
        kitchen.spatulaGroup.position.x - (kitchen.trayGroup.position.x + kitchen.plateGroup.position.x),
        kitchen.spatulaGroup.position.y - (kitchen.trayGroup.position.y + kitchen.plateGroup.position.y) + 0.014,
        kitchen.spatulaGroup.position.z - (kitchen.trayGroup.position.z + kitchen.plateGroup.position.z)
      );
      kitchen.platedEggYolk.scale.set(1 + Math.sin(elapsed * 22) * 0.06, 0.65, 1 + Math.cos(elapsed * 22) * 0.06);
    } else {
      if (!state.eggPlated) {
        state.eggPlated = true;
        state.eggState = 'plated';
        kitchen.platedEggGroup.visible = true;
        kitchen.platedEggGroup.position.set(0, 0.017, 0);
        kitchen.platedEggYolk.scale.set(1, 0.65, 1);
        sound.playCeramicClink(1.18);
        sound.playWarmChime([659.25, 880]);
        particles.spawnGoldSparkle(platePos, 8, 0.14);
      }
      const k = (t - 0.75) / 0.25;
      kitchen.spatulaGroup.position.lerpVectors(platePos, kitchen.spatulaHome, k);
      kitchen.spatulaGroup.rotation.y = THREE.MathUtils.lerp(0.15, -0.5, k);
    }
    if (t >= 1) {
      state.spatulaAnim = 0;
      kitchen.spatulaGroup.position.copy(kitchen.spatulaHome);
      kitchen.spatulaGroup.rotation.set(0, -0.5, 0);
    }
  }

  // Gentle hot steam rising from plated soup bowl while waiting to be delivered/eaten!
  if (state.soupPlated && !state.momAteSoup && (state.phase === 'cook' || state.phase === 'mom_deliver' || state.phase === 'mom_eat')) {
    steamTimerPlated -= dt;
    if (steamTimerPlated <= 0) {
      steamTimerPlated = 0.28;
      const wp = new THREE.Vector3();
      kitchen.bowlGroup.getWorldPosition(wp);
      wp.y += 0.07;
      particles.spawnSteam(wp, { count: 1, scale: 0.07, speed: 0.12, opacity: 0.22 });
    }
  }

  // --------------------------------------------------------------------------
  // 6. TRAY DELIVERY, MOM EATING, RECOVERY & LIVE HANAMARU DRAWING!
  // --------------------------------------------------------------------------
  if (state.phase === 'mom_deliver') {
    state.trayMoveT = Math.min(1, state.trayMoveT + dt * 0.9);
    const ease = 1 - Math.pow(1 - state.trayMoveT, 3);
    kitchen.trayGroup.position.lerpVectors(state.trayFromPos, state.trayToPos, ease);
    kitchen.trayGroup.position.y += Math.sin(ease * Math.PI) * 0.24;
    if (state.trayMoveT >= 1) {
      kitchen.trayGroup.position.copy(state.trayToPos);
      state.phase = 'mom_eat';
      sound.playWoodTap(0.95);
    }
  }

  // Mom feeding animation (warm sip of soup / happy bite of fried egg)
  if (state.momFeedAnim > 0) {
    state.momFeedAnim += dt * 1.15;
    const t = Math.min(1, state.momFeedAnim);
    const dishGrp = state.momFeedKind === 'soup' ? kitchen.bowlGroup : kitchen.plateGroup;
    const home = state.momFeedKind === 'soup' ? kitchen.bowlTrayPos : kitchen.plateTrayPos;
    const momLocalTarget = new THREE.Vector3(0, 0.24, -0.28);
    const arc = Math.sin(t * Math.PI);
    dishGrp.position.lerpVectors(home, momLocalTarget, arc * 0.85);
    dishGrp.position.y += arc * 0.08;

    if (t >= 0.52) {
      if (state.momFeedKind === 'soup' && !state.momAteSoup) {
        state.momAteSoup = true;
        kitchen.bowlSoupGroup.visible = false;
        kitchen.bowlSmudgeDyn.update(0.85);
        state.momHealth = Math.max(state.momHealth, 0.55);
        sound.playMomYum(1);
        particles.spawnGoldSparkle(new THREE.Vector3(0, 0.62, -1.72), 12, 0.28);
      } else if (state.momFeedKind === 'egg' && !state.momAteEgg) {
        state.momAteEgg = true;
        kitchen.platedEggGroup.visible = false;
        kitchen.plateSmudgeDyn.update(0.85);
        state.momHealth = Math.max(state.momHealth, state.momAteSoup ? 1.0 : 0.55);
        sound.playMomYum(2);
        particles.spawnGoldSparkle(new THREE.Vector3(0, 0.64, -1.72), 14, 0.30);
      }
      if (state.momAteSoup && state.momAteEgg) {
        state.momHealth = 1.0;
      }
    }
    if (t >= 1) {
      state.momFeedAnim = 0;
      dishGrp.position.copy(home);
      if (state.momAteSoup && state.momAteEgg && state.phase === 'mom_eat') {
        // Trigger Mom's big Hanamaru reward!
        state.phase = 'hanamaru';
        state.hanamaruProgress = 0;
        state.hanamaruDoneTime = 0;
        momScene.hanamaruCardGroup.visible = true;
        momScene.crayonGroup.visible = true;
        sound.playHanamaruFanfare();
      }
    }
  }

  // Mom living breathing, cooling pad peeling away, rosy cheeks & joyful recovery!
  const breath = Math.sin(elapsed * (state.momHealth > 0.8 ? 3.2 : 1.7));
  const targetTorsoPitch = state.momHealth > 0.8 ? 0.14 : -0.16;
  momScene.torsoPivot.rotation.x = THREE.MathUtils.lerp(momScene.torsoPivot.rotation.x, targetTorsoPitch, dt * 3.5);
  momScene.torsoPivot.position.y = -0.05 + breath * 0.008;

  if (state.momHealth >= 0.5) {
    // Peel cool blue forehead gel pack gently upward and away!
    state.coolingPadPeel = Math.min(1, state.coolingPadPeel + dt * 1.1);
    momScene.coolingPad.position.y = 0.072 + state.coolingPadPeel * 0.22;
    momScene.coolingPad.position.z = 0.148 + state.coolingPadPeel * 0.08;
    momScene.coolingPad.rotation.x = -0.22 - state.coolingPadPeel * 1.2;
    momScene.coolingPad.material.opacity = Math.max(0, 0.88 * (1 - state.coolingPadPeel));
    if (state.coolingPadPeel >= 1) momScene.coolingPad.visible = false;
  }

  // Rosy cheek warmth & happy smiling face transition
  momScene.blushMat.opacity = THREE.MathUtils.lerp(momScene.blushMat.opacity, 0.14 + state.momHealth * 0.42, dt * 3);
  if (state.momHealth >= 0.5) {
    momScene.sleepyEyesGroup.visible = false;
    momScene.happyEyesGroup.visible = true;
    momScene.sleepyMouth.visible = false;
    momScene.happyMouth.visible = true;
  }

  // Mom happy joyful arms & head nod when fully recovered
  const joyArm = state.momHealth >= 0.95 ? 0.55 + Math.sin(elapsed * 5.2) * 0.12 : state.momHealth * 0.2;
  momScene.leftArmPivot.rotation.x = THREE.MathUtils.lerp(momScene.leftArmPivot.rotation.x, -joyArm, dt * 4);
  momScene.rightArmPivot.rotation.x = THREE.MathUtils.lerp(momScene.rightArmPivot.rotation.x, -joyArm, dt * 4);
  momScene.headPivot.rotation.x = Math.sin(elapsed * (state.momHealth >= 0.95 ? 4.2 : 1.4)) * 0.06;

  // Live Hanamaru Drawing Animation!
  if (state.phase === 'hanamaru') {
    state.hanamaruCardScale = THREE.MathUtils.lerp(state.hanamaruCardScale, 1, 1 - Math.exp(-dt * 7));
    momScene.hanamaruCardGroup.scale.setScalar(state.hanamaruCardScale);
    momScene.hanamaruCardGroup.position.lerp(momScene.cardShowPos, 1 - Math.exp(-dt * 6));
    momScene.hanamaruCardGroup.rotation.x = -0.22;

    if (state.hanamaruProgress < 1) {
      const prev = state.hanamaruProgress;
      state.hanamaruProgress = Math.min(1, state.hanamaruProgress + dt * 0.48);
      momScene.hanamaruDyn.render(state.hanamaruProgress);

      const uv = momScene.hanamaruDyn.getTipUV(state.hanamaruProgress);
      momScene.crayonGroup.position.set(
        (uv.u - 0.5) * 0.36,
        (uv.v - 0.5) * 0.36,
        0.015
      );
      if (Math.floor(state.hanamaruProgress * 14) > Math.floor(prev * 14)) {
        sound.playCrayonSwish();
      }
      if (state.hanamaruProgress >= 1) {
        momScene.crayonGroup.visible = false;
        sound.playHanamaruFanfare();
        particles.spawnGoldSparkle(momScene.cardShowPos.clone().add(new THREE.Vector3(0, 0.04, 0.08)), 22, 0.45);
      }
    } else {
      state.hanamaruDoneTime += dt;
      // Gentle celebratory float of the finished Hanamaru card
      momScene.hanamaruCardGroup.position.y = momScene.cardShowPos.y + Math.sin(elapsed * 3.4) * 0.012;
      // Smoothly transition to post-meal dishwashing after child enjoys the Hanamaru (~4.2s)
      if (state.hanamaruDoneTime >= 4.2) {
        startMoveToSink();
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. POST-MEAL DISHWASHING AT THE SUNLIT STAINLESS SINK!
  // --------------------------------------------------------------------------
  if (state.phase === 'to_sink') {
    state.trayMoveT = Math.min(1, state.trayMoveT + dt * 1.1);
    const ease = 1 - Math.pow(1 - state.trayMoveT, 3);
    kitchen.trayGroup.position.lerpVectors(state.trayFromPos, state.trayToPos, ease);
    kitchen.trayGroup.position.y += Math.sin(ease * Math.PI) * 0.22;
    if (state.trayMoveT >= 1) {
      kitchen.trayGroup.position.copy(state.trayToPos);
      placeDishesIntoSink();
      state.phase = 'wash';
      sound.playCeramicClink(0.95);
    }
  }

  // Faucet lever & sparkling water stream
  state.faucetAnim = THREE.MathUtils.lerp(state.faucetAnim, state.faucetOn ? 1 : 0, 1 - Math.exp(-dt * 12));
  kitchen.faucetLeverPivot.rotation.z = state.faucetAnim * 0.55;
  kitchen.faucetStream.visible = state.faucetAnim > 0.08;
  kitchen.sinkSplashRing.visible = state.faucetAnim > 0.08;
  if (kitchen.faucetStream.visible) {
    const pulse = 0.88 + Math.sin(elapsed * 28) * 0.12;
    kitchen.faucetStream.scale.set(state.faucetAnim * pulse, 1, state.faucetAnim * pulse);
    const ringS = 0.7 + ((elapsed * 2.4) % 1) * 0.9;
    kitchen.sinkSplashRing.scale.setScalar(ringS);
    kitchen.sinkSplashRing.material.opacity = (1 - (ringS - 0.7) / 0.9) * 0.55;
  }

  // Sponge follows finger smoothly during dishwashing
  if (state.phase === 'wash') {
    if (state.spongeDragging) {
      kitchen.spongeGroup.position.lerp(state.spongeTarget, 1 - Math.exp(-dt * 20));
      kitchen.spongeGroup.rotation.y = Math.sin(elapsed * 18) * 0.18;
    } else {
      kitchen.spongeGroup.position.lerp(kitchen.spongeHome, 1 - Math.exp(-dt * 8));
      kitchen.spongeGroup.rotation.y = THREE.MathUtils.lerp(kitchen.spongeGroup.rotation.y, 0, dt * 8);
    }

    // Move clean sparkling dishes onto the wooden drying rack!
    if (state.bowlClean) {
      kitchen.bowlGroup.position.lerp(new THREE.Vector3(2.35, 0.02, -0.04), 1 - Math.exp(-dt * 6));
      kitchen.bowlGroup.rotation.z = THREE.MathUtils.lerp(kitchen.bowlGroup.rotation.z, 0.35, dt * 5);
    }
    if (state.plateClean) {
      kitchen.plateGroup.position.lerp(new THREE.Vector3(2.50, 0.09, 0.04), 1 - Math.exp(-dt * 6));
      kitchen.plateGroup.rotation.x = THREE.MathUtils.lerp(kitchen.plateGroup.rotation.x, 1.28, dt * 5);
    }

    if (state.bowlClean && state.plateClean) {
      state.washCompleteTimer += dt;
      if (state.washCompleteTimer > 0.5 && state.faucetOn) {
        state.faucetOn = false;
        sound.playKnobClick(0);
      }
      if (state.washCompleteTimer > 2.2) {
        state.phase = 'celebrate_reset';
        sound.playHanamaruFanfare();
        particles.spawnGoldSparkle(new THREE.Vector3(2.42, 0.18, 0.0), 18, 0.38);
        setTimeout(() => {
          resetForNextRound();
        }, 1450);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. PLAYFUL WOBBLES, PARTICLES, CONTINUOUS AUDIO & IDLE HAND HINT
  // --------------------------------------------------------------------------
  for (const [obj, w] of state.wobbles.entries()) {
    w.phase += dt * 22;
    w.amp *= Math.exp(-dt * 7);
    obj.rotation.z = w.baseRotZ + Math.sin(w.phase) * w.amp;
    if (w.amp < 0.004) {
      obj.rotation.z = w.baseRotZ;
      state.wobbles.delete(obj);
    }
  }

  particles.update(dt, elapsed);

  sound.updateContinuous(dt, {
    gasLevel: Math.min(1.4, state.knob.left.level + state.knob.right.level),
    soupHeat: state.soupTemp,
    soupHasLiquid: hasSoupLiquid,
    panSizzle: panSizzleIntensity,
    faucetLevel: state.faucetAnim,
  });

  updateIdleHint(dt);

  renderer.render(scene, camera);
}

animate();
