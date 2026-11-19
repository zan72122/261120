import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sound } from './audio.js';
import { BatterTextureController } from './textures.js';
import { ParticleSystem } from './particles.js';
import {
  createKitchenEnvironment,
  createMixingBowl,
  createWhisk,
  createEggInCup,
  createMilkJug,
  createSkilletStation,
  createLadle,
  createSpatula,
  createServingPlate,
  createPancakeMesh,
  createButterDish,
  createMeltableButterPat,
  createSyrupPitcher,
  createSyrupDrip,
  createCreamBag,
  createCreamSwirl,
  createStrawberry,
  createBlueberry,
  createBerryBowl,
  createWovenCoaster,
  createAnimalGuest,
} from './meshes.js';

// ---------- Renderer & Scene Setup (Photorealistic Morning Sunlit Kitchen) ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.94;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xead6bc);
scene.fog = new THREE.Fog(0xead6bc, 6.2, 13.5);

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.50;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 1.85, 2.55);

// Warm golden morning sunlight from left-front window (rich real-life shadows!)
const sunLight = new THREE.DirectionalLight(0xffe7c2, 3.15);
sunLight.position.set(-3.2, 3.6, 1.8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 12;
const d = 2.9;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.00045;
sunLight.shadow.normalBias = 0.018;
scene.add(sunLight);

// Soft cool morning skylight + warm oak bounce fill (balanced for crisp form)
const hemiLight = new THREE.HemisphereLight(0xeef4ff, 0x8b5e36, 0.44);
scene.add(hemiLight);

// Soft golden backlight rim from kitchen window behind left
const rimLight = new THREE.DirectionalLight(0xffd49a, 0.95);
rimLight.position.set(-2.0, 2.4, -2.8);
scene.add(rimLight);

// ---------- World & Props ----------
createKitchenEnvironment(scene);
const particles = new ParticleSystem(scene);

// Woven coaster & rotating animal guests
const coaster = createWovenCoaster();
coaster.position.set(0, 0.002, -0.58);
scene.add(coaster);

const GUEST_TYPES = ['kitten', 'bunny', 'puppy'];
let guestIndex = 0;
let guest = null;

function spawnGuest(type) {
  if (guest) scene.remove(guest.root);
  guest = createAnimalGuest(type);
  guest.root.position.set(0, 0, -1.24);
  guest.root.scale.setScalar(0.01);
  scene.add(guest.root);
}
spawnGuest(GUEST_TYPES[0]);

// Mixing station
const batterTex = new BatterTextureController();
const bowlObj = createMixingBowl(batterTex);
scene.add(bowlObj.group);

const whisk = createWhisk();
bowlObj.group.add(whisk);
whisk.position.set(0.05, 0.16, 0);
whisk.rotation.set(0.15, 0, -0.32);

const eggObj = createEggInCup();
scene.add(eggObj.group);

const milkObj = createMilkJug();
scene.add(milkObj.group);

// Skillet & tools
const skilletObj = createSkilletStation();
scene.add(skilletObj.group);

const ladleObj = createLadle();
scene.add(ladleObj.group);
ladleObj.group.visible = false;

const spatula = createSpatula();
scene.add(spatula);
spatula.visible = false;

// Serving plate & pancake tower container
const plateObj = createServingPlate();
scene.add(plateObj.group);

const towerGroup = new THREE.Group();
towerGroup.position.y = 0.032;
plateObj.group.add(towerGroup);

// Toppings station
const butterDish = createButterDish();
scene.add(butterDish);

const syrupObj = createSyrupPitcher();
scene.add(syrupObj.group);

const creamBagObj = createCreamBag();
scene.add(creamBagObj.group);

const berryBowl = createBerryBowl();
scene.add(berryBowl);

// ---------- Game State ----------
const STAGES = { MIX: 'mix', BAKE: 'bake', DECORATE: 'decorate', SERVE: 'serve' };

const state = {
  stage: STAGES.MIX,
  time: 0,
  idleTime: 0,
  nextHintAt: 8.5,
  isPortrait: window.innerHeight > window.innerWidth * 1.08,

  // Mixing
  hasEgg: false,
  eggAnim: 0, // 0 idle, >0 animating crack
  hasMilk: false,
  milkAnim: 0,
  mixProgress: 0,
  swirlAngle: 0,
  whiskSpeed: 0,
  whiskTarget: new THREE.Vector2(0.05, 0),
  whiskPos: new THREE.Vector2(0.05, 0),
  mixDoneTimer: 0,

  // Baking
  pouringBatter: false,
  pourDuration: 0,
  panCake: null, // { meshObj, cookBottom, cookTop, flipped, flipAnim, radius, thickness, readyToStack, steamTimer, seed }
  pancakeSeed: 1,
  spatulaAnim: 0,
  spatulaMode: 'idle', // 'idle' | 'flip' | 'carry'
  carryingCake: null,

  // Stacked Tower
  stack: [], // array of { meshObj, y, offX, offZ, wX, wZ, vX, vZ, squash, squashV, radius, thickness, cookAvg, toppings:[], drips:[] }
  totalSyrup: 0,
  syrupPouring: false,
  syrupTargetWorld: new THREE.Vector3(),
  syrupDripTimer: 0,
  hasButter: false,
  hasCream: false,
  hasBerry: false,
  berryToggle: 0,
  butterPats: [], // meltable pats on tower
  plateSyrupScale: 0,
  plateDragOffset: new THREE.Vector2(0, 0),

  // Serving & Eating
  serveSlide: 0,
  eatingTimer: 0,
  munchAnim: 0,
  lickAnim: 0,
  hasNoseCream: false,
  finishedEating: false,
  finishTimer: 0,
  guestScale: 0.01,
  guestLookTarget: new THREE.Vector3(0, 0.3, 0.25),
  guestHappy: 0,
  guestBlink: 0,
  guestNextBlink: 2.8,
  guestClap: 0,
};

// Smooth camera state
const camPos = new THREE.Vector3(0, 1.75, 2.2);
const camLook = new THREE.Vector3(0, 0.22, 0.1);
const camTargetPos = new THREE.Vector3();
const camTargetLook = new THREE.Vector3();

// Smooth prop resting positions
const propTargets = {
  bowl: new THREE.Vector3(),
  egg: new THREE.Vector3(),
  milk: new THREE.Vector3(),
  skillet: new THREE.Vector3(),
  plate: new THREE.Vector3(),
  butter: new THREE.Vector3(),
  syrup: new THREE.Vector3(),
  cream: new THREE.Vector3(),
  berry: new THREE.Vector3(),
};

function computeLayoutTargets() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  state.isPortrait = aspect < 0.92;
  const P = state.isPortrait;

  // Dynamic FOV & distance multiplier so portrait & landscape both frame cleanly
  const targetFov = P ? 46 : 38;
  camera.fov += (targetFov - camera.fov) * 0.12;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  // Portrait narrow-screen pull-back helper (guarantees egg & milk jug never clip on 390x844!)
  const pScale = P ? Math.max(1.06, 0.59 / Math.max(0.36, aspect)) : Math.max(1.0, 1.24 / Math.max(0.92, aspect));

  const towerH = getTowerHeight();
  const hasAnyCake = state.stack.length > 0;

  if (state.stage === STAGES.MIX) {
    if (P) {
      propTargets.bowl.set(0.0, 0, 0.14);
      propTargets.egg.set(-0.40, 0, 0.74);
      propTargets.milk.set(0.38, 0, 0.74);
      propTargets.skillet.set(1.85, 0, -0.1);
      propTargets.plate.set(2.5, 0, 0.3);
      propTargets.butter.set(2.8, 0, 0.9);
      propTargets.syrup.set(2.8, 0, 0.5);
      propTargets.cream.set(2.8, 0, 0.1);
      propTargets.berry.set(2.8, 0, -0.3);
      camTargetPos.set(0, 2.02 * pScale, 2.62 * pScale);
      camTargetLook.set(0, 0.22, 0.08);
    } else {
      propTargets.bowl.set(0.0, 0, 0.30);
      propTargets.egg.set(-0.76, 0, 0.44);
      propTargets.milk.set(0.76, 0, 0.44);
      propTargets.skillet.set(2.15, 0, -0.02);
      propTargets.plate.set(2.75, 0, 0.38);
      propTargets.butter.set(3.2, 0, 0.7);
      propTargets.syrup.set(3.2, 0, 0.2);
      propTargets.cream.set(3.2, 0, -0.3);
      propTargets.berry.set(3.2, 0, -0.7);
      camTargetPos.set(0, 1.82 * pScale, 2.52 * pScale);
      camTargetLook.set(0, 0.30, -0.06);
    }
  } else if (state.stage === STAGES.BAKE) {
    if (P) {
      propTargets.bowl.set(-0.50, 0, -0.22);
      propTargets.skillet.set(0.0, 0, 0.42);
      propTargets.plate.set(0.52, 0, -0.22);
      propTargets.egg.set(-2.4, 0, 0.6);
      propTargets.milk.set(-2.4, 0, 0.1);
      if (hasAnyCake) {
        propTargets.butter.set(-0.42, 0, 1.02);
        propTargets.syrup.set(0.42, 0, 1.02);
      } else {
        propTargets.butter.set(2.4, 0, 0.9);
        propTargets.syrup.set(2.4, 0, 0.4);
      }
      propTargets.cream.set(2.6, 0, 0.2);
      propTargets.berry.set(2.6, 0, -0.3);
      camTargetPos.set(0, 2.38 * pScale, 2.95 * pScale);
      camTargetLook.set(0, 0.16, 0.14);
    } else {
      propTargets.bowl.set(-1.02, 0, 0.3);
      propTargets.skillet.set(0.0, 0, 0.24);
      propTargets.plate.set(1.04, 0, 0.28);
      propTargets.egg.set(-2.6, 0, 0.5);
      propTargets.milk.set(-2.6, 0, -0.1);
      if (hasAnyCake) {
        propTargets.butter.set(0.95, 0, 0.92);
        propTargets.syrup.set(1.52, 0, 0.72);
      } else {
        propTargets.butter.set(2.8, 0, 0.8);
        propTargets.syrup.set(2.8, 0, 0.3);
      }
      propTargets.cream.set(2.9, 0, 0.1);
      propTargets.berry.set(2.9, 0, -0.4);
      camTargetPos.set(0.08, 1.98 * pScale, 2.66 * pScale);
      camTargetLook.set(0.08, 0.22, 0.10);
    }
  } else if (state.stage === STAGES.DECORATE) {
    if (P) {
      propTargets.bowl.set(-2.2, 0, -0.4);
      propTargets.skillet.set(-1.95, 0, 0.3);
      propTargets.egg.set(-2.8, 0, 0.6);
      propTargets.milk.set(-2.8, 0, 0.1);
      propTargets.plate.set(0.0 + state.plateDragOffset.x, 0, 0.14 + state.plateDragOffset.y);
      propTargets.butter.set(-0.50, 0, 0.72);
      propTargets.syrup.set(-0.18, 0, 1.00);
      propTargets.cream.set(0.18, 0, 1.00);
      propTargets.berry.set(0.50, 0, 0.72);
      camTargetPos.set(0, (1.82 + towerH * 0.45) * pScale, (2.68 + towerH * 0.25) * pScale);
      camTargetLook.set(0, 0.24 + towerH * 0.35, -0.04);
    } else {
      propTargets.bowl.set(-2.35, 0, 0.4);
      propTargets.skillet.set(-1.92, 0, -0.15);
      propTargets.egg.set(-3.0, 0, 0.5);
      propTargets.milk.set(-3.0, 0, -0.1);
      propTargets.plate.set(0.0 + state.plateDragOffset.x, 0, 0.30 + state.plateDragOffset.y);
      propTargets.butter.set(-1.05, 0, -0.02);
      propTargets.syrup.set(-0.84, 0, 0.58);
      propTargets.cream.set(0.86, 0, 0.56);
      propTargets.berry.set(1.05, 0, -0.02);
      camTargetPos.set(0, (1.44 + towerH * 0.42) * pScale, (2.34 + towerH * 0.25) * pScale);
      camTargetLook.set(0, 0.30 + towerH * 0.35, -0.08);
    }
  } else {
    // SERVE
    propTargets.bowl.set(-2.4, 0, 0.2);
    propTargets.skillet.set(-2.1, 0, -0.2);
    propTargets.egg.set(-3.0, 0, 0.6);
    propTargets.milk.set(-3.0, 0, 0.0);
    propTargets.plate.set(0.0, 0.015, -0.58);
    propTargets.butter.set(-1.75, 0, 0.85);
    propTargets.syrup.set(-1.5, 0, 1.2);
    propTargets.cream.set(1.5, 0, 1.2);
    propTargets.berry.set(1.75, 0, 0.85);
    if (P) {
      camTargetPos.set(0.0, (1.16 + towerH * 0.3) * pScale, (1.52 + towerH * 0.2) * pScale);
      camTargetLook.set(0.0, 0.36 + towerH * 0.25, -0.82);
    } else {
      camTargetPos.set(0.16, (0.98 + towerH * 0.3) * pScale, (1.12 + towerH * 0.2) * pScale);
      camTargetLook.set(0.0, 0.38 + towerH * 0.25, -0.86);
    }
  }
}

// Initialize initial positions immediately (no awkward fly-in on load)
computeLayoutTargets();
bowlObj.group.position.copy(propTargets.bowl);
eggObj.group.position.copy(propTargets.egg);
milkObj.group.position.copy(propTargets.milk);
skilletObj.group.position.copy(propTargets.skillet);
plateObj.group.position.copy(propTargets.plate);
butterDish.position.copy(propTargets.butter);
syrupObj.group.position.copy(propTargets.syrup);
creamBagObj.group.position.copy(propTargets.cream);
berryBowl.position.copy(propTargets.berry);
camPos.copy(camTargetPos);
camLook.copy(camTargetLook);
camera.position.copy(camPos);
camera.lookAt(camLook);

// ---------- Helper Functions ----------
function getTowerHeight() {
  let h = 0;
  for (const layer of state.stack) h += layer.thickness;
  return h;
}

function getTopLayer() {
  return state.stack.length > 0 ? state.stack[state.stack.length - 1] : null;
}

function impulseTower(ix = 0.25, iz = 0.15, squash = -0.14) {
  for (let i = 0; i < state.stack.length; i++) {
    const l = state.stack[i];
    const mult = (i + 1) / Math.max(1, state.stack.length);
    l.vX += ix * mult;
    l.vZ += iz * mult;
    l.squashV += squash * (0.6 + mult * 0.4);
  }
}

// ---------- Stage Actions ----------
function triggerEggCrack() {
  if (state.hasEgg || state.eggAnim > 0) return;
  state.eggAnim = 0.001;
  sound.eggCrack();
}

function triggerMilkPour() {
  if (state.hasMilk || state.milkAnim > 0) return;
  state.milkAnim = 0.001;
  sound.milkPour();
}

function startBatterPour() {
  if (state.panCake || state.carryingCake) return;
  state.pouringBatter = true;
  state.pourDuration = 0;
  sound.batterPour();

  const seed = state.pancakeSeed++;
  const meshObj = createPancakeMesh(0.22, 0.056, seed);
  meshObj.root.position.set(0, 0.085, 0);
  meshObj.root.scale.set(0.25, 0.28, 0.25);
  skilletObj.panGroup.add(meshObj.root);

  state.panCake = {
    meshObj,
    cookBottom: 0,
    cookTop: 0,
    flipped: false,
    flipAnim: 0,
    flipHeight: 0.65,
    flipSpins: 1,
    radius: 0.22,
    targetRadius: 0.23,
    thickness: 0.056,
    steamTimer: 0,
    seed,
    puffScale: 1,
  };
}

function flipPanCake(fastSwipe = false) {
  const c = state.panCake;
  if (!c || c.flipAnim > 0 || state.carryingCake) return;
  c.flipAnim = 0.001;
  c.flipHeight = fastSwipe ? 1.48 : 0.68;
  c.flipSpins = fastSwipe ? 3 : 1; // odd number of 180-deg flips = always lands on opposite side!
  c.startRotX = c.meshObj.root.rotation.x;
  state.spatulaMode = 'flip';
  state.spatulaAnim = 0.001;
  sound.flipWhoosh(fastSwipe);
  if (fastSwipe) {
    particles.emitSparkles(skilletObj.group.position.clone().add(new THREE.Vector3(0, 0.45, 0)), 10, 0xffe6a3);
    state.guestClap = 0.9;
  }
}

function carryPanCakeToPlate(offsetX = 0, offsetZ = 0) {
  const c = state.panCake;
  if (!c || c.flipAnim > 0 || state.carryingCake) return;
  state.panCake = null;
  sound.setSizzle(0);

  // Detach from skillet into scene world space for smooth spatula carry arc
  const worldPos = new THREE.Vector3();
  c.meshObj.root.getWorldPosition(worldPos);
  const worldQuat = new THREE.Quaternion();
  c.meshObj.root.getWorldQuaternion(worldQuat);
  skilletObj.panGroup.remove(c.meshObj.root);
  scene.add(c.meshObj.root);
  c.meshObj.root.position.copy(worldPos);
  c.meshObj.root.quaternion.copy(worldQuat);

  // Hide any lingering uncooked bubbles
  for (const b of c.meshObj.bubbles) b.mesh.visible = false;

  // Compute forgiving natural stack offset (slight realistic imperfection + playful lean!)
  const maxOff = Math.min(0.065, 0.025 + state.stack.length * 0.006);
  const clampedX = Math.max(-maxOff, Math.min(maxOff, offsetX));
  const clampedZ = Math.max(-maxOff, Math.min(maxOff, offsetZ));

  state.carryingCake = {
    cake: c,
    t: 0,
    startPos: worldPos.clone(),
    offX: clampedX + (Math.random() - 0.5) * 0.022,
    offZ: clampedZ + (Math.random() - 0.5) * 0.022,
  };
  state.spatulaMode = 'carry';
  state.spatulaAnim = 0.001;
  sound.flipWhoosh(false);
}

function landCakeOnTower(carry) {
  const c = carry.cake;
  scene.remove(c.meshObj.root);
  towerGroup.add(c.meshObj.root);

  const prevY = getTowerHeight();
  const actualThick = c.thickness * c.meshObj.root.scale.y;
  const actualRadius = c.radius * c.meshObj.root.scale.x;

  // Ensure seared side faces nicely upward if flipped at least once
  c.meshObj.root.rotation.set(c.flipped ? Math.PI : 0, Math.random() * Math.PI * 2, 0);
  c.meshObj.root.position.set(carry.offX, prevY + actualThick * 0.5, carry.offZ);
  // Orient maple syrup glaze so it always sits cleanly on the upward-facing side!
  c.meshObj.glaze.position.y = (c.flipped ? -1 : 1) * (c.thickness * 0.5 + 0.014);
  c.meshObj.glaze.rotation.x = c.flipped ? Math.PI : 0;

  const layer = {
    meshObj: c.meshObj,
    y: prevY + actualThick * 0.5,
    offX: carry.offX,
    offZ: carry.offZ,
    wX: 0,
    wZ: 0,
    vX: (Math.random() - 0.5) * 0.16,
    vZ: (Math.random() - 0.5) * 0.16,
    squash: -0.22,
    squashV: 0.4,
    baseScaleX: c.meshObj.root.scale.x,
    baseScaleY: c.meshObj.root.scale.y,
    radius: actualRadius,
    thickness: actualThick,
    flipped: c.flipped,
    cookAvg: (c.cookBottom + c.cookTop) * 0.5,
    toppings: [],
    drips: [],
  };
  state.stack.push(layer);

  // Propagate soft wobble down the tower!
  impulseTower((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, -0.12);
  sound.stackPlop(state.stack.length - 1);

  const topWorld = new THREE.Vector3();
  c.meshObj.root.getWorldPosition(topWorld);
  particles.emitSteam(topWorld, 1.0);
  if (state.stack.length >= 3) {
    particles.emitSparkles(topWorld.clone().add(new THREE.Vector3(0, 0.1, 0)), 8, 0xffe4a0);
    state.guestClap = 0.7;
  }
}

// ---------- Topping Actions ----------
function enterDecorateIfNeeded() {
  if (state.stage === STAGES.BAKE && state.stack.length > 0 && !state.panCake && !state.carryingCake) {
    state.stage = STAGES.DECORATE;
    sound.softNudge();
  }
}

function addButterPat(localX = 0, localZ = 0) {
  const top = getTopLayer();
  if (!top) return;
  const pat = createMeltableButterPat();
  const r = Math.min(top.radius * 0.26, Math.hypot(localX, localZ));
  const ang = Math.atan2(localZ, localX);
  const px = r > 0.001 ? Math.cos(ang) * r : (Math.random() - 0.5) * 0.04;
  const pz = r > 0.001 ? Math.sin(ang) * r : (Math.random() - 0.5) * 0.04;

  // Position on top face of the top pancake (in towerGroup space attached to a holder)
  const holder = new THREE.Group();
  holder.position.set(top.offX + px, top.y + top.thickness * 0.5 + 0.006, top.offZ + pz);
  holder.rotation.y = Math.random() * Math.PI;
  holder.add(pat.group);
  towerGroup.add(holder);

  pat.holder = holder;
  pat.layer = top;
  pat.relX = px;
  pat.relZ = pz;
  pat.dropAnim = 0.001;
  pat.group.position.y = 0.42;

  top.toppings.push(holder);
  state.butterPats.push(pat);
  state.hasButter = true;
  sound.butterPlop();
  impulseTower((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, -0.09);
}

function addCreamSwirl(localX = 0, localZ = 0) {
  const top = getTopLayer();
  if (!top) return;
  const swirl = createCreamSwirl();
  const maxR = top.radius * 0.72;
  const dist = Math.hypot(localX, localZ);
  let px = localX, pz = localZ;
  if (dist > maxR) {
    px = (localX / dist) * maxR;
    pz = (localZ / dist) * maxR;
  } else if (dist < 0.001) {
    const a = Math.random() * Math.PI * 2;
    const d = 0.03 + Math.random() * (maxR * 0.65);
    px = Math.cos(a) * d;
    pz = Math.sin(a) * d;
  }

  const holder = new THREE.Group();
  holder.position.set(top.offX + px, top.y + top.thickness * 0.5 + 0.005, top.offZ + pz);
  holder.scale.setScalar(0.01);
  holder.userData = { popAnim: 0.001, layer: top, relX: px, relZ: pz };
  holder.add(swirl);
  towerGroup.add(holder);
  top.toppings.push(holder);

  state.hasCream = true;
  sound.creamPipe();
  impulseTower(0, 0, -0.06);
}

function addBerry(localX = 0, localZ = 0) {
  const top = getTopLayer();
  if (!top) return;
  const isStrawberry = state.berryToggle % 3 !== 2;
  state.berryToggle++;

  const berry = isStrawberry ? createStrawberry(0.95 + Math.random() * 0.15) : createBlueberry(1.0 + Math.random() * 0.2);
  const maxR = top.radius * 0.76;
  const dist = Math.hypot(localX, localZ);
  let px = localX, pz = localZ;
  if (dist > maxR) {
    px = (localX / dist) * maxR;
    pz = (localZ / dist) * maxR;
  } else if (dist < 0.001) {
    const a = Math.random() * Math.PI * 2;
    const d = 0.04 + Math.random() * (maxR * 0.72);
    px = Math.cos(a) * d;
    pz = Math.sin(a) * d;
  }

  const holder = new THREE.Group();
  holder.position.set(top.offX + px, top.y + top.thickness * 0.5 + 0.005, top.offZ + pz);
  if (isStrawberry) {
    berry.rotation.set((Math.random() - 0.5) * 0.45, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.45);
  }
  holder.userData = { dropAnim: 0.001, layer: top, relX: px, relZ: pz };
  berry.position.y = 0.45;
  holder.add(berry);
  towerGroup.add(holder);
  top.toppings.push(holder);

  state.hasBerry = true;
  sound.berryPlop();
  impulseTower((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, -0.07);
}

function spawnSyrupDripOnTower() {
  if (state.stack.length === 0) return;
  const top = getTopLayer();
  const totalH = getTowerHeight();
  const a = Math.random() * Math.PI * 2;
  const dripH = Math.min(totalH + 0.02, 0.06 + Math.random() * (totalH * 0.95));
  const drip = createSyrupDrip(dripH);
  drip.position.set(
    top.offX + Math.cos(a) * (top.radius * 0.97),
    top.y + top.thickness * 0.5 + 0.005,
    top.offZ + Math.sin(a) * (top.radius * 0.97)
  );
  drip.scale.set(1, 0.05, 1);
  drip.userData = { grow: 0.05, targetGrow: 1.0, layer: top, angle: a };
  towerGroup.add(drip);
  top.drips.push(drip);
}

// ---------- Serve & Eating ----------
function startServe() {
  if (state.stage !== STAGES.DECORATE || state.stack.length === 0) return;
  state.stage = STAGES.SERVE;
  state.plateDragOffset.set(0, 0);
  state.serveSlide = 0;
  state.eatingTimer = 0.95;
  state.finishedEating = false;
  state.finishTimer = 0;
  state.hasNoseCream = false;
  if (guest) guest.noseCreamDab.visible = false;
  sound.plateSlide();
  setTimeout(() => {
    sound.guestGreet(guest.type);
    if (state.stack.length >= 4) state.guestClap = 1.2;
  }, 320);
}

function triggerGuestMunch() {
  if (state.stage !== STAGES.SERVE || state.finishedEating) return;
  const top = getTopLayer();
  if (!top) return;

  state.munchAnim = 0.001;
  const isCrispy = top.cookAvg > 0.92;
  sound.guestMunch(isCrispy);

  const worldPos = new THREE.Vector3();
  top.meshObj.root.getWorldPosition(worldPos);
  particles.emitCrumbs(worldPos, 8);

  // Secret Discovery: Cream gets on guest's nose!
  if (state.hasCream && !state.hasNoseCream && Math.random() < 0.72) {
    state.hasNoseCream = true;
    guest.noseCreamDab.visible = true;
  }

  // First bite eats toppings on top layer; next bite eats the pancake layer!
  if (top.toppings.length > 0) {
    const removeCount = Math.min(top.toppings.length, 2);
    for (let i = 0; i < removeCount; i++) {
      const t = top.toppings.pop();
      towerGroup.remove(t);
    }
    particles.emitSparkles(worldPos.clone().add(new THREE.Vector3(0, 0.14, 0)), 7, 0xffc8cf);
  } else {
    // Shrink/consume the pancake layer!
    if (!top.bites) top.bites = 0;
    top.bites++;
    if (top.bites === 1) {
      top.meshObj.root.scale.multiplyScalar(0.68);
      top.squash = -0.18;
    } else {
      // Remove drips & layer completely
      for (const d of top.drips) towerGroup.remove(d);
      towerGroup.remove(top.meshObj.root);
      state.stack.pop();
      if (state.stack.length === 0) {
        // Finished entire tower!!
        state.finishedEating = true;
        state.finishTimer = 0;
        state.guestHappy = 1.0;
        sound.guestDelight();
        particles.emitSparkles(new THREE.Vector3(0, 0.55, -0.95), 22, 0xffe488);
        // If nose still has cream, lick it off happily after a short moment
        if (state.hasNoseCream) {
          setTimeout(() => triggerNoseLick(), 950);
        }
      }
    }
  }
}

function triggerNoseLick() {
  if (!state.hasNoseCream || state.lickAnim > 0) return;
  state.lickAnim = 0.001;
  sound.guestLick();
  particles.emitSparkles(new THREE.Vector3(0, 0.58, -0.88), 10, 0xfff0c2);
}

function startNewRound() {
  // Clean up remaining items
  for (const l of state.stack) {
    for (const t of l.toppings) towerGroup.remove(t);
    for (const d of l.drips) towerGroup.remove(d);
    towerGroup.remove(l.meshObj.root);
  }
  state.stack = [];
  state.butterPats = [];
  state.totalSyrup = 0;
  state.plateSyrupScale = 0;
  plateObj.plateSyrup.visible = false;
  plateObj.plateSyrup.scale.set(0.001, 0.001, 1);

  state.hasEgg = false;
  state.eggAnim = 0;
  eggObj.eggRoot.visible = true;
  eggObj.eggRoot.position.set(0, 0.15, 0);
  eggObj.topHalf.position.set(0, 0, 0);
  eggObj.topHalf.rotation.set(0, 0, 0);
  eggObj.bottomHalf.position.set(0, 0, 0);
  eggObj.bottomHalf.rotation.set(0, 0, 0);
  eggObj.yolkGroup.visible = false;

  state.hasMilk = false;
  state.milkAnim = 0;
  milkObj.jugRoot.position.set(0, 0, 0);
  milkObj.jugRoot.rotation.set(0, 0, 0);
  milkObj.milkInner.scale.set(1, 1, 1);
  milkObj.milkInner.position.y = 0.105;
  milkObj.milkInner.visible = true;
  milkObj.stream.visible = false;

  state.mixProgress = 0;
  state.swirlAngle = 0;
  state.mixDoneTimer = 0;
  bowlObj.batterMesh.position.y = 0.17;
  bowlObj.batterMat.roughness = 0.65;
  bowlObj.batterMat.clearcoat = 0.08;
  batterTex.render({ hasEgg: false, hasMilk: false, mixProgress: 0, swirlAngle: 0 });
  whisk.visible = true;
  ladleObj.group.visible = false;
  spatula.visible = false;

  state.hasButter = false;
  state.hasCream = false;
  state.hasBerry = false;
  state.hasNoseCream = false;
  state.finishedEating = false;
  state.guestHappy = 0;
  state.plateDragOffset.set(0, 0);

  // Rotate to next adorable sunlit animal friend!
  guestIndex = (guestIndex + 1) % GUEST_TYPES.length;
  spawnGuest(GUEST_TYPES[guestIndex]);
  state.guestScale = 0.01;

  state.stage = STAGES.MIX;
  state.idleTime = 0;
  sound.guestGreet(guest.type);
}

// ---------- Single-Finger Input Controller ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.18);
const rayHit = new THREE.Vector3();

let activePointerId = null;
let dragMode = null; // 'whisk' | 'egg' | 'milk' | 'ladle' | 'pan' | 'cake' | 'butter' | 'syrup' | 'cream' | 'berry' | 'plate'
let pointerDownScreen = new THREE.Vector2();
let pointerPrevScreen = new THREE.Vector2();
let pointerDownTime = 0;
let dragGhost = null;

function setNdc(ev) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}

function getTablePoint(ev, yHeight = 0.18) {
  setNdc(ev);
  raycaster.setFromCamera(ndc, camera);
  tablePlane.constant = -yHeight;
  raycaster.ray.intersectPlane(tablePlane, rayHit);
  return rayHit.clone();
}

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function hitTestObject(worldPt, targetPos, radius) {
  return distXZ(worldPt, targetPos) <= radius;
}

// Generous screen-space + 3D proximity hit helper for 5-year-old fingers!
function screenDistToWorld(ev, worldPos) {
  const p = worldPos.clone().project(camera);
  const rect = canvas.getBoundingClientRect();
  const sx = (p.x * 0.5 + 0.5) * rect.width;
  const sy = (-p.y * 0.5 + 0.5) * rect.height;
  return Math.hypot(ev.clientX - rect.left - sx, ev.clientY - rect.top - sy);
}

function clearDragGhost() {
  if (dragGhost) {
    scene.remove(dragGhost);
    dragGhost = null;
  }
}

canvas.addEventListener('pointerdown', (ev) => {
  if (activePointerId !== null) return; // Ignore accidental second finger!
  activePointerId = ev.pointerId;
  canvas.setPointerCapture(ev.pointerId);
  sound.unlock();
  state.idleTime = 0;
  state.nextHintAt = 9.0;

  pointerDownScreen.set(ev.clientX, ev.clientY);
  pointerPrevScreen.set(ev.clientX, ev.clientY);
  pointerDownTime = performance.now();

  const pt = getTablePoint(ev, 0.16);
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  const tapR = minDim * 0.145; // Generous 5-year-old hitbox!

  // Check if tapping guest nose when cream dab is on it!
  if (state.hasNoseCream && guest) {
    const noseWorld = new THREE.Vector3();
    guest.noseCreamDab.getWorldPosition(noseWorld);
    if (screenDistToWorld(ev, noseWorld) < tapR * 0.9) {
      triggerNoseLick();
      return;
    }
  }

  if (state.stage === STAGES.MIX) {
    // 1. Egg?
    if (!state.hasEgg && state.eggAnim === 0 && (hitTestObject(pt, eggObj.group.position, 0.34) || screenDistToWorld(ev, eggObj.group.position.clone().add(new THREE.Vector3(0, 0.15, 0))) < tapR)) {
      dragMode = 'egg';
      sound.softNudge();
      return;
    }
    // 2. Milk jug?
    if (!state.hasMilk && state.milkAnim === 0 && (hitTestObject(pt, milkObj.group.position, 0.36) || screenDistToWorld(ev, milkObj.group.position.clone().add(new THREE.Vector3(0, 0.15, 0))) < tapR)) {
      dragMode = 'milk';
      sound.softNudge();
      return;
    }
    // 3. Whisk / Bowl?
    if (hitTestObject(pt, bowlObj.group.position, 0.56) || screenDistToWorld(ev, bowlObj.group.position.clone().add(new THREE.Vector3(0, 0.2, 0))) < tapR * 1.45) {
      dragMode = 'whisk';
      if (!state.hasEgg && !state.hasMilk) {
        sound.flourPuff();
        particles.emitFlourPuff(bowlObj.group.position.clone().add(new THREE.Vector3(0, 0.22, 0)));
      }
      return;
    }
    // Gentle non-dead feedback if tapping guest
    if (guest && screenDistToWorld(ev, guest.root.position.clone().add(new THREE.Vector3(0, 0.55, 0))) < tapR * 1.2) {
      sound.guestGreet(guest.type);
      state.guestClap = 0.5;
    }
    return;
  }

  if (state.stage === STAGES.BAKE) {
    // Check if touching Butter or Syrup (visible once >= 1 pancake is stacked!) -> Enter DECORATE!
    if (state.stack.length > 0 && !state.panCake && !state.carryingCake) {
      if (hitTestObject(pt, butterDish.position, 0.34) || screenDistToWorld(ev, butterDish.position) < tapR) {
        enterDecorateIfNeeded();
        addButterPat();
        return;
      }
      if (hitTestObject(pt, syrupObj.group.position, 0.34) || screenDistToWorld(ev, syrupObj.group.position.clone().add(new THREE.Vector3(0, 0.18, 0))) < tapR) {
        enterDecorateIfNeeded();
        dragMode = 'syrup';
        state.syrupPouring = true;
        return;
      }
    }

    // Touching Skillet?
    const skilletHit = hitTestObject(pt, skilletObj.group.position, 0.58) || screenDistToWorld(ev, skilletObj.group.position.clone().add(new THREE.Vector3(0, 0.12, 0))) < tapR * 1.35;
    if (skilletHit) {
      if (!state.panCake && !state.carryingCake) {
        dragMode = 'pour';
        startBatterPour();
      } else if (state.panCake && state.panCake.flipAnim === 0) {
        dragMode = 'panCake';
      }
      return;
    }

    // Touching Batter Bowl / Ladle?
    const bowlHit = hitTestObject(pt, bowlObj.group.position, 0.52) || screenDistToWorld(ev, bowlObj.group.position.clone().add(new THREE.Vector3(0, 0.22, 0))) < tapR * 1.2;
    if (bowlHit && !state.panCake && !state.carryingCake) {
      dragMode = 'ladle';
      sound.softNudge();
      return;
    }

    // Touching Plate?
    const plateHit = hitTestObject(pt, plateObj.group.position, 0.54) || screenDistToWorld(ev, plateObj.group.position.clone().add(new THREE.Vector3(0, 0.1 + getTowerHeight() * 0.5, 0))) < tapR * 1.25;
    if (plateHit) {
      if (state.panCake && state.panCake.flipped && state.panCake.flipAnim === 0) {
        carryPanCakeToPlate(0, 0);
      } else if (state.stack.length > 0) {
        // Poke the pancake tower -> joyful jiggle!
        impulseTower((Math.random() - 0.5) * 0.38, (Math.random() - 0.5) * 0.38, -0.16);
        sound.wobbleBoing();
      }
      return;
    }
    return;
  }

  if (state.stage === STAGES.DECORATE) {
    const topY = 0.05 + getTowerHeight();
    const plateTopWorld = plateObj.group.position.clone().add(new THREE.Vector3(0, topY, 0));

    // Pick nearest topping cleanly so adjacent props never steal hits!
    const toppingChoices = [
      { id: 'butter', pos: butterDish.position.clone().add(new THREE.Vector3(0, 0.05, 0)) },
      { id: 'syrup', pos: syrupObj.group.position.clone().add(new THREE.Vector3(0, 0.14, 0)) },
      { id: 'cream', pos: creamBagObj.group.position.clone().add(new THREE.Vector3(0, 0.10, 0)) },
      { id: 'berry', pos: berryBowl.position.clone().add(new THREE.Vector3(0, 0.08, 0)) },
    ];
    let bestTopping = null;
    let bestDist = tapR * 0.92;
    for (const tc of toppingChoices) {
      const sd = screenDistToWorld(ev, tc.pos);
      if (sd < bestDist) {
        bestDist = sd;
        bestTopping = tc.id;
      }
    }

    if (bestTopping === 'butter') {
      dragMode = 'butter';
      sound.softNudge();
      dragGhost = createMeltableButterPat().group;
      dragGhost.position.copy(pt).setY(topY + 0.18);
      scene.add(dragGhost);
      return;
    }
    if (bestTopping === 'syrup') {
      dragMode = 'syrup';
      state.syrupPouring = true;
      state.syrupTargetWorld.copy(plateTopWorld);
      return;
    }
    if (bestTopping === 'cream') {
      dragMode = 'cream';
      sound.softNudge();
      dragGhost = createCreamSwirl();
      dragGhost.position.copy(pt).setY(topY + 0.14);
      scene.add(dragGhost);
      return;
    }
    if (bestTopping === 'berry') {
      dragMode = 'berry';
      sound.softNudge();
      dragGhost = state.berryToggle % 3 !== 2 ? createStrawberry(1.0) : createBlueberry(1.1);
      dragGhost.position.copy(pt).setY(topY + 0.16);
      scene.add(dragGhost);
      return;
    }
    // 5. Woven Coaster OR Guest -> Serve the pancakes!
    const coasterHit = hitTestObject(pt, coaster.position, 0.48) || screenDistToWorld(ev, coaster.position) < tapR * 1.15;
    const guestHit = guest && screenDistToWorld(ev, guest.root.position.clone().add(new THREE.Vector3(0, 0.45, 0))) < tapR * 1.35;
    if (coasterHit || guestHit) {
      startServe();
      return;
    }
    // 6. Skillet far left -> Go back to bake one more pancake!
    if (state.stack.length < 10 && screenDistToWorld(ev, skilletObj.group.position) < tapR * 0.9) {
      state.stage = STAGES.BAKE;
      sound.softNudge();
      return;
    }
    // 7. Plate / Pancake Tower -> Drag forward to serve, OR tap to jiggle!
    if (hitTestObject(pt, plateObj.group.position, 0.56) || screenDistToWorld(ev, plateTopWorld) < tapR * 1.3) {
      dragMode = 'plate';
      return;
    }
    return;
  }

  if (state.stage === STAGES.SERVE) {
    if (state.finishedEating) {
      if (state.finishTimer > 0.7) startNewRound();
    } else {
      triggerGuestMunch();
    }
  }
});

canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerId !== activePointerId) return;
  state.idleTime = 0;

  const dx = ev.clientX - pointerPrevScreen.x;
  const dy = ev.clientY - pointerPrevScreen.y;
  const moveSpd = Math.hypot(dx, dy);
  pointerPrevScreen.set(ev.clientX, ev.clientY);

  const pt = getTablePoint(ev, 0.18);

  if (dragMode === 'whisk') {
    const relX = pt.x - bowlObj.group.position.x;
    const relZ = pt.z - bowlObj.group.position.z;
    const r = Math.hypot(relX, relZ);
    const maxR = 0.24;
    if (r > maxR) {
      state.whiskTarget.set((relX / r) * maxR, (relZ / r) * maxR);
    } else {
      state.whiskTarget.set(relX, relZ);
    }

    const spdNorm = Math.min(1.5, moveSpd / 16);
    state.whiskSpeed = Math.max(state.whiskSpeed, spdNorm);

    if (state.hasEgg || state.hasMilk) {
      const wetness = (state.hasEgg ? 0.5 : 0) + (state.hasMilk ? 0.5 : 0);
      const step = spdNorm * 0.011 * wetness;
      state.swirlAngle += spdNorm * 0.085 * (dx >= 0 ? 1 : -1);
      // Only allow completing full mix when BOTH egg & milk are in (so she discovers both ingredients!)
      const cap = state.hasEgg && state.hasMilk ? 1.0 : 0.42;
      state.mixProgress = Math.min(cap, state.mixProgress + step);
      batterTex.render({
        hasEgg: state.hasEgg,
        hasMilk: state.hasMilk,
        mixProgress: state.mixProgress,
        swirlAngle: state.swirlAngle,
      });
    } else if (moveSpd > 9 && Math.random() < 0.25) {
      sound.flourPuff();
      particles.emitFlourPuff(bowlObj.group.position.clone().add(new THREE.Vector3(0, 0.22, 0)));
    }
    return;
  }

  if (dragMode === 'egg') {
    if (hitTestObject(pt, bowlObj.group.position, 0.54)) {
      dragMode = null;
      triggerEggCrack();
    }
    return;
  }

  if (dragMode === 'milk') {
    if (hitTestObject(pt, bowlObj.group.position, 0.54)) {
      dragMode = null;
      triggerMilkPour();
    }
    return;
  }

  if (dragMode === 'ladle') {
    if (hitTestObject(pt, skilletObj.group.position, 0.62)) {
      dragMode = 'pour';
      startBatterPour();
    }
    return;
  }

  if (dragMode === 'panCake' && state.panCake) {
    const totalDy = ev.clientY - pointerDownScreen.y;
    const totalDx = ev.clientX - pointerDownScreen.x;
    // Fast upward flick -> SKY HIGH FLIP!
    if (totalDy < -44) {
      const fast = dy < -14 || totalDy < -95;
      dragMode = null;
      flipPanCake(fast);
      return;
    }
    // Drag toward plate if already flipped -> stack onto plate!
    if (state.panCake.flipped && (hitTestObject(pt, plateObj.group.position, 0.62) || totalDx > 85)) {
      const offX = pt.x - plateObj.group.position.x;
      const offZ = pt.z - plateObj.group.position.z;
      dragMode = null;
      carryPanCakeToPlate(offX * 0.35, offZ * 0.35);
      return;
    }
  }

  if (dragMode === 'syrup') {
    const topY = 0.05 + getTowerHeight();
    const p = getTablePoint(ev, topY);
    const dxP = p.x - plateObj.group.position.x;
    const dzP = p.z - plateObj.group.position.z;
    const r = Math.hypot(dxP, dzP);
    const maxR = 0.26;
    const cx = r > maxR ? (dxP / r) * maxR : dxP;
    const cz = r > maxR ? (dzP / r) * maxR : dzP;
    state.syrupTargetWorld.set(plateObj.group.position.x + cx, topY, plateObj.group.position.z + cz);
    return;
  }

  if (dragGhost && (dragMode === 'butter' || dragMode === 'cream' || dragMode === 'berry')) {
    const topY = 0.05 + getTowerHeight();
    const p = getTablePoint(ev, topY);
    dragGhost.position.set(p.x, topY + 0.14, p.z);
    return;
  }

  if (dragMode === 'plate') {
    const dyTotal = ev.clientY - pointerDownScreen.y;
    const dxTotal = ev.clientX - pointerDownScreen.x;
    // Slide plate forward toward coaster/kitten!
    const pullZ = Math.max(-0.72, Math.min(0.15, dyTotal * 0.0045));
    const pullX = Math.max(-0.22, Math.min(0.22, dxTotal * 0.0025));
    state.plateDragOffset.set(pullX, pullZ);
    if (pullZ < -0.34) {
      dragMode = null;
      startServe();
    }
  }
});

function handlePointerEnd(ev) {
  if (ev.pointerId !== activePointerId) return;
  activePointerId = null;

  const totalMove = Math.hypot(ev.clientX - pointerDownScreen.x, ev.clientY - pointerDownScreen.y);
  const tapDuration = performance.now() - pointerDownTime;
  const isTap = totalMove < 26 && tapDuration < 380;

  if (dragMode === 'egg') {
    triggerEggCrack();
  } else if (dragMode === 'milk') {
    triggerMilkPour();
  } else if (dragMode === 'ladle' && isTap) {
    startBatterPour();
    // Auto-stop quick tap pour after short moment
    setTimeout(() => {
      state.pouringBatter = false;
    }, 340);
  } else if (dragMode === 'pour') {
    state.pouringBatter = false;
  } else if (dragMode === 'panCake' && state.panCake) {
    if (!state.panCake.flipped) {
      flipPanCake(false);
    } else if (state.panCake.cookTop > 0.35 || isTap) {
      // Cooked on both sides -> carry to plate!
      carryPanCakeToPlate(0, 0);
    }
  } else if (dragMode === 'syrup') {
    state.syrupPouring = false;
  } else if (dragMode === 'butter' || dragMode === 'cream' || dragMode === 'berry') {
    const topY = 0.05 + getTowerHeight();
    const p = getTablePoint(ev, topY);
    const localX = isTap ? 0 : p.x - plateObj.group.position.x;
    const localZ = isTap ? 0 : p.z - plateObj.group.position.z;
    if (dragMode === 'butter') addButterPat(localX, localZ);
    if (dragMode === 'cream') addCreamSwirl(localX, localZ);
    if (dragMode === 'berry') addBerry(localX, localZ);
    clearDragGhost();
  } else if (dragMode === 'plate') {
    if (isTap) {
      impulseTower((Math.random() - 0.5) * 0.36, (Math.random() - 0.5) * 0.36, -0.15);
      sound.wobbleBoing();
    }
    state.plateDragOffset.set(0, 0);
  }

  dragMode = null;
}

canvas.addEventListener('pointerup', handlePointerEnd);
canvas.addEventListener('pointercancel', handlePointerEnd);

// ---------- Main Update Loop ----------
const clock = new THREE.Clock();

function lerpVec(cur, target, alpha) {
  cur.x += (target.x - cur.x) * alpha;
  cur.y += (target.y - cur.y) * alpha;
  cur.z += (target.z - cur.z) * alpha;
}

function updateMixStage(dt) {
  // Egg crack animation
  if (state.eggAnim > 0) {
    state.eggAnim += dt * 1.45;
    const t = state.eggAnim;
    const bPos = bowlObj.group.position;
    if (t < 0.35) {
      // Lift egg to rim of bowl
      const k = t / 0.35;
      const targetLocal = bPos.clone().sub(eggObj.group.position).add(new THREE.Vector3(-0.34, 0.42, 0));
      eggObj.eggRoot.position.lerpVectors(new THREE.Vector3(0, 0.15, 0), targetLocal, k);
      eggObj.eggRoot.rotation.z = -0.35 * k;
    } else if (t < 0.72) {
      // Crack apart & drop yolk!
      const k = (t - 0.35) / 0.37;
      const rim = bPos.clone().sub(eggObj.group.position).add(new THREE.Vector3(-0.08, 0.46, 0));
      eggObj.eggRoot.position.lerp(rim, 0.25);
      eggObj.topHalf.position.set(0.08 * k, 0.05 * k, 0);
      eggObj.topHalf.rotation.z = -0.95 * k;
      eggObj.bottomHalf.position.set(-0.08 * k, 0.02 * k, 0);
      eggObj.bottomHalf.rotation.z = 0.85 * k;

      eggObj.yolkGroup.visible = true;
      const startY = rim.clone().add(new THREE.Vector3(0, -0.04, 0));
      const endY = bPos.clone().sub(eggObj.group.position).add(new THREE.Vector3(0.04, 0.19, -0.02));
      eggObj.yolkGroup.position.lerpVectors(startY, endY, Math.min(1, k * 1.25));
    } else if (t < 1.05) {
      if (!state.hasEgg) {
        state.hasEgg = true;
        eggObj.yolkGroup.visible = false;
        bowlObj.batterMesh.position.y = Math.max(bowlObj.batterMesh.position.y, 0.185);
        batterTex.render({
          hasEgg: state.hasEgg,
          hasMilk: state.hasMilk,
          mixProgress: state.mixProgress,
          swirlAngle: state.swirlAngle,
        });
      }
      eggObj.eggRoot.visible = false;
    } else {
      state.eggAnim = 0;
    }
  }

  // Milk pour animation
  if (state.milkAnim > 0) {
    state.milkAnim += dt * 0.95;
    const t = state.milkAnim;
    const bPos = bowlObj.group.position;
    const pourSpot = bPos.clone().sub(milkObj.group.position).add(new THREE.Vector3(0.28, 0.48, 0));
    if (t < 0.28) {
      const k = t / 0.28;
      milkObj.jugRoot.position.lerpVectors(new THREE.Vector3(0, 0, 0), pourSpot, k);
      milkObj.jugRoot.rotation.z = 0.92 * k;
    } else if (t < 0.82) {
      const k = (t - 0.28) / 0.54;
      milkObj.jugRoot.position.copy(pourSpot);
      milkObj.jugRoot.rotation.z = 0.92 + Math.sin(k * Math.PI) * 0.25;
      milkObj.stream.visible = true;
      milkObj.stream.position.set(pourSpot.x - 0.16, pourSpot.y - 0.14, pourSpot.z);
      milkObj.milkInner.scale.y = Math.max(0.05, 1 - k * 0.88);
      milkObj.milkInner.position.y = 0.02 + 0.085 * milkObj.milkInner.scale.y;
      bowlObj.batterMesh.position.y = 0.175 + k * 0.032;
      if (k > 0.35 && !state.hasMilk) {
        state.hasMilk = true;
        batterTex.render({
          hasEgg: state.hasEgg,
          hasMilk: state.hasMilk,
          mixProgress: state.mixProgress,
          swirlAngle: state.swirlAngle,
        });
      }
    } else if (t < 1.12) {
      const k = (t - 0.82) / 0.3;
      milkObj.stream.visible = false;
      milkObj.milkInner.visible = false;
      milkObj.jugRoot.position.lerpVectors(pourSpot, new THREE.Vector3(0, 0, 0), k);
      milkObj.jugRoot.rotation.z = 0.92 * (1 - k);
    } else {
      milkObj.jugRoot.position.set(0, 0, 0);
      milkObj.jugRoot.rotation.z = 0;
      state.milkAnim = 0;
    }
  }

  // Smooth whisk motion & sound
  state.whiskPos.lerp(state.whiskTarget, Math.min(1, dt * 16));
  whisk.position.set(state.whiskPos.x, 0.185 + state.mixProgress * 0.02, state.whiskPos.y);
  whisk.rotation.set(
    0.16 + state.whiskPos.y * 1.15,
    state.swirlAngle * 0.4,
    -0.24 - state.whiskPos.x * 1.15
  );

  // Batter gets creamier & glossier as it mixes!
  bowlObj.batterMat.roughness = 0.65 - state.mixProgress * 0.46;
  bowlObj.batterMat.clearcoat = 0.08 + state.mixProgress * 0.72;

  const wetness = (state.hasEgg ? 0.5 : 0) + (state.hasMilk ? 0.5 : 0);
  sound.updateWhisk(state.whiskSpeed, wetness);
  state.whiskSpeed = Math.max(0, state.whiskSpeed - dt * 3.8);

  // Transition to BAKE once batter is silky smooth!
  if (state.stage === STAGES.MIX && state.mixProgress >= 0.99) {
    if (state.mixDoneTimer === 0) {
      sound.batterReady();
      particles.emitSparkles(bowlObj.group.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 14, 0xffe49e);
    }
    state.mixDoneTimer += dt;
    if (state.mixDoneTimer > 0.78) {
      state.stage = STAGES.BAKE;
      whisk.visible = false;
      ladleObj.group.visible = true;
      spatula.visible = true;
      sound.updateWhisk(0, 0);
    }
  }
}

function updateBakeStage(dt) {
  // Subtle warm pulse on burner ring
  skilletObj.glowMat.opacity = 0.36 + Math.sin(state.time * 3.2) * 0.09;

  // Ladle resting vs pouring batter
  if (ladleObj.group.visible) {
    if (state.pouringBatter && state.panCake) {
      const pourPos = skilletObj.group.position.clone().add(new THREE.Vector3(0.12, 0.52, 0));
      lerpVec(ladleObj.group.position, pourPos, Math.min(1, dt * 12));
      ladleObj.group.rotation.z += (0.78 - ladleObj.group.rotation.z) * Math.min(1, dt * 10);
      ladleObj.pourStream.visible = true;
      ladleObj.pourStream.position.set(-0.08, -0.22, 0);
      ladleObj.pourStream.rotation.z = -0.78;

      // Grow pancake size continuously while holding! (Small -> Giant fluffy!)
      state.pourDuration += dt;
      const sizeScale = Math.min(1.62, 0.92 + state.pourDuration * 0.55);
      state.panCake.meshObj.root.scale.x += (sizeScale - state.panCake.meshObj.root.scale.x) * Math.min(1, dt * 8);
      state.panCake.meshObj.root.scale.z = state.panCake.meshObj.root.scale.x;
      state.panCake.meshObj.root.scale.y += (0.85 - state.panCake.meshObj.root.scale.y) * Math.min(1, dt * 6);
      if (state.pourDuration > 1.35) state.pouringBatter = false;
    } else {
      const restPos = bowlObj.group.position.clone().add(new THREE.Vector3(0.06, 0.23, 0.02));
      lerpVec(ladleObj.group.position, restPos, Math.min(1, dt * 8));
      ladleObj.group.rotation.z += (-0.28 - ladleObj.group.rotation.z) * Math.min(1, dt * 8);
      ladleObj.pourStream.visible = false;
    }
  }

  // Active pancake baking in the skillet
  const c = state.panCake;
  if (c) {
    if (c.flipAnim > 0) {
      // 3D Parabolic Flip Arc!
      const speed = c.flipSpins > 1 ? 1.15 : 1.75;
      c.flipAnim += dt * speed;
      const t = Math.min(1, c.flipAnim);
      const arc = 4 * t * (1 - t) * c.flipHeight;
      c.meshObj.root.position.y = 0.085 + arc;
      c.meshObj.root.rotation.x = c.startRotX + t * Math.PI * c.flipSpins;
      // Subtle skillet toss tilt
      skilletObj.panGroup.rotation.x = Math.sin(t * Math.PI) * -0.14;

      // Guest tracks flying pancake with wide eyes!
      const wp = new THREE.Vector3();
      c.meshObj.root.getWorldPosition(wp);
      state.guestLookTarget.copy(wp);

      if (t >= 1) {
        c.flipAnim = 0;
        c.flipped = !c.flipped;
        c.meshObj.root.position.y = 0.085;
        c.meshObj.root.rotation.x = c.flipped ? Math.PI : 0;
        skilletObj.panGroup.rotation.x = 0;
        // Hide bubbles on bottom now
        for (const b of c.meshObj.bubbles) b.mesh.visible = false;
        sound.panLand(c.cookBottom > 0.9 || c.cookTop > 0.9);
        const worldPos = skilletObj.group.position.clone().add(new THREE.Vector3(0, 0.14, 0));
        particles.emitSteam(worldPos, 1.25);
        particles.emitSteam(worldPos, 1.0);
      }
    } else {
      // Settle scale after pour stops
      if (!state.pouringBatter) {
        const targetY = c.flipped ? 1.18 : 1.0; // Puffs fluffier after flipping!
        c.meshObj.root.scale.y += (targetY - c.meshObj.root.scale.y) * Math.min(1, dt * 2.2);
        if (c.meshObj.root.scale.x < 0.85) {
          c.meshObj.root.scale.x += (0.9 - c.meshObj.root.scale.x) * Math.min(1, dt * 6);
          c.meshObj.root.scale.z = c.meshObj.root.scale.x;
        }
      }

      // Cook whichever face is currently touching the hot iron!
      if (!c.flipped) {
        c.cookBottom = Math.min(1.22, c.cookBottom + dt * 0.28);
        c.meshObj.bottomTex.update(c.cookBottom);
        // Slightly warm top edge too
        c.meshObj.topTex.update(Math.min(0.2, c.cookBottom * 0.22));

        // 3D Batter Bubbles rise and pop when ready to flip!
        if (c.cookBottom > 0.22) {
          for (const b of c.meshObj.bubbles) {
            b.phase += dt * (0.28 + c.cookBottom * 0.35);
            if (b.phase >= 1) {
              if (b.active && Math.random() < 0.6) sound.bubblePop();
              b.phase = 0;
              b.active = true;
            }
            if (b.active) {
              b.mesh.visible = true;
              const s = Math.sin(b.phase * Math.PI) * (0.75 + Math.min(0.8, c.cookBottom));
              b.mesh.scale.set(s, s * 0.72, s);
            }
          }
        }
      } else {
        c.cookTop = Math.min(1.22, c.cookTop + dt * 0.36);
        c.meshObj.topTex.update(c.cookTop);
      }

      // Continuous realistic sizzle & warm curling steam!
      const sizzleLevel = c.flipped ? Math.max(0.25, 0.75 - c.cookTop * 0.35) : Math.max(0.35, 0.9 - c.cookBottom * 0.35);
      sound.setSizzle(sizzleLevel);

      c.steamTimer += dt;
      const steamRate = c.cookBottom > 0.95 || c.cookTop > 0.95 ? 0.16 : 0.32;
      if (c.steamTimer > steamRate) {
        c.steamTimer = 0;
        particles.emitSteam(skilletObj.group.position.clone().add(new THREE.Vector3(0, 0.14, 0)), 0.95);
      }
    }
  } else {
    sound.setSizzle(0);
  }

  // Carrying cooked pancake over to plate
  if (state.carryingCake) {
    const carry = state.carryingCake;
    carry.t += dt * 1.55;
    const t = Math.min(1, carry.t);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const endPos = plateObj.group.position.clone().add(new THREE.Vector3(carry.offX, 0.04 + getTowerHeight() + 0.03, carry.offZ));
    carry.cake.meshObj.root.position.lerpVectors(carry.startPos, endPos, ease);
    carry.cake.meshObj.root.position.y += Math.sin(t * Math.PI) * 0.52;

    // Spatula travels smoothly right underneath the pancake!
    spatula.position.copy(carry.cake.meshObj.root.position).add(new THREE.Vector3(0.06, -0.035, 0));
    spatula.rotation.set(0, -0.25, 0);

    if (t >= 1) {
      landCakeOnTower(carry);
      state.carryingCake = null;
      state.spatulaMode = 'idle';
    }
  } else if (spatula.visible) {
    if (state.spatulaMode === 'flip') {
      state.spatulaAnim += dt * 2.8;
      const t = Math.min(1, state.spatulaAnim);
      const base = skilletObj.group.position.clone().add(new THREE.Vector3(0.05, 0.13 + Math.sin(t * Math.PI) * 0.16, 0.05));
      spatula.position.lerp(base, 0.35);
      spatula.rotation.z = Math.sin(t * Math.PI) * 0.48;
      if (t >= 1) state.spatulaMode = 'idle';
    } else {
      const rest = skilletObj.group.position.clone().add(new THREE.Vector3(0.45, 0.055, 0.44));
      lerpVec(spatula.position, rest, Math.min(1, dt * 8));
      spatula.rotation.set(0, -0.75, 0);
    }
  }
}

function updateTowerAndToppings(dt) {
  // Soft-body damped spring wobble for every pancake layer!
  let cumX = 0, cumZ = 0;
  for (let i = 0; i < state.stack.length; i++) {
    const l = state.stack[i];
    // Damped spring
    const k = 38;
    const damp = 6.2;
    l.vX += (-k * l.wX - damp * l.vX) * dt;
    l.vZ += (-k * l.wZ - damp * l.vZ) * dt;
    l.wX += l.vX * dt;
    l.wZ += l.vZ * dt;

    l.squashV += (-52 * l.squash - 7.5 * l.squashV) * dt;
    l.squash += l.squashV * dt;

    cumX += l.wX * 0.14;
    cumZ += l.wZ * 0.14;

    l.meshObj.root.position.set(l.offX + cumX, l.y, l.offZ + cumZ);
    l.meshObj.root.rotation.z = -cumX * 0.75;
    l.meshObj.root.rotation.x = (l.flipped ? Math.PI : 0) + cumZ * 0.75;
    const sqY = Math.max(0.7, 1 + l.squash);
    const sqXZ = 1 - l.squash * 0.25;
    l.meshObj.root.scale.set(l.baseScaleX * sqXZ, l.baseScaleY * sqY, l.baseScaleX * sqXZ);

    // Move toppings & syrup drips with the wobbling pancake!
    for (const h of l.toppings) {
      const d = h.userData;
      if (d && d.relX !== undefined) {
        h.position.x = l.offX + cumX + d.relX;
        h.position.z = l.offZ + cumZ + d.relZ;
      }
      if (d && d.popAnim > 0 && d.popAnim < 1) {
        d.popAnim = Math.min(1, d.popAnim + dt * 4.5);
        const s = Math.sin(d.popAnim * Math.PI * 0.5) * (1 + Math.sin(d.popAnim * Math.PI) * 0.22);
        h.scale.setScalar(s);
      }
      if (d && d.dropAnim > 0 && d.dropAnim < 1) {
        d.dropAnim = Math.min(1, d.dropAnim + dt * 3.8);
        const ease = 1 - Math.pow(1 - d.dropAnim, 3);
        if (h.children[0]) h.children[0].position.y = 0.45 * (1 - ease);
      }
    }
    for (const dr of l.drips) {
      const d = dr.userData;
      if (d.grow < d.targetGrow) {
        d.grow = Math.min(d.targetGrow, d.grow + dt * 0.65);
        dr.scale.y = d.grow;
      }
      dr.position.x = l.offX + cumX + Math.cos(d.angle) * (l.radius * 0.97);
      dr.position.z = l.offZ + cumZ + Math.sin(d.angle) * (l.radius * 0.97);
    }
  }

  // Physically melting cold butter pats!
  for (const pat of state.butterPats) {
    if (pat.dropAnim > 0 && pat.dropAnim < 1) {
      pat.dropAnim = Math.min(1, pat.dropAnim + dt * 3.6);
      const ease = 1 - Math.pow(1 - pat.dropAnim, 3);
      pat.group.position.y = 0.42 * (1 - ease);
    } else {
      pat.melt = Math.min(1, pat.melt + dt * 0.24);
      const m = pat.melt;
      // Cold pat softens & settles gently while compact glossy golden puddle spreads!
      pat.cube.scale.set(1 + m * 0.12, Math.max(0.42, 1 - m * 0.58), 1 + m * 0.12);
      pat.cube.position.y = 0.021 * pat.cube.scale.y;
      pat.puddle.visible = m > 0.08;
      const ps = Math.min(1.05, m * 1.05);
      pat.puddle.scale.set(ps, ps, 1);
    }
    if (pat.layer && pat.holder) {
      pat.holder.position.x = pat.layer.meshObj.root.position.x + pat.relX;
      pat.holder.position.z = pat.layer.meshObj.root.position.z + pat.relZ;
    }
  }

  // Continuous Overflowing Maple Syrup pouring!
  if (state.syrupPouring && state.stack.length > 0) {
    const top = getTopLayer();
    const pourPos = state.syrupTargetWorld.clone().add(new THREE.Vector3(0.22, 0.56, 0.04));
    lerpVec(syrupObj.group.position, pourPos, Math.min(1, dt * 11));
    syrupObj.pitcherRoot.rotation.z += (1.05 - syrupObj.pitcherRoot.rotation.z) * Math.min(1, dt * 10);
    syrupObj.stream.visible = true;
    syrupObj.stream.position.set(-0.22, -0.18, -0.02);
    syrupObj.stream.scale.set(1, 1.15, 1);

    state.totalSyrup = Math.min(2.5, state.totalSyrup + dt * 0.75);
    sound.setSyrupPour(true, Math.min(1, state.totalSyrup / 2));

    // Expand glossy maple glaze on top pancake!
    top.meshObj.glaze.visible = true;
    const glazeS = Math.min(1.04, 0.18 + state.totalSyrup * 0.72);
    top.meshObj.glaze.scale.set(glazeS, 1, glazeS);

    // Overflow drips down the sides of the pancake tower!
    state.syrupDripTimer += dt;
    if (state.totalSyrup > 0.42 && state.syrupDripTimer > 0.18 && top.drips.length < 18) {
      state.syrupDripTimer = 0;
      spawnSyrupDripOnTower();
    }

    // Overflow lake on the white porcelain plate!
    if (state.totalSyrup > 0.85) {
      plateObj.plateSyrup.visible = true;
      state.plateSyrupScale = Math.min(1.12, (state.totalSyrup - 0.85) * 0.72);
      plateObj.plateSyrup.scale.set(state.plateSyrupScale, state.plateSyrupScale, 1);
    }
  } else {
    sound.setSyrupPour(false);
    syrupObj.stream.visible = false;
    syrupObj.pitcherRoot.rotation.z += (0 - syrupObj.pitcherRoot.rotation.z) * Math.min(1, dt * 9);
  }

  // Warm gentle steam rising from fresh pancake tower
  if (state.stack.length > 0 && state.stage !== STAGES.SERVE && Math.random() < dt * 1.4) {
    const p = plateObj.group.position.clone().add(new THREE.Vector3(0, 0.08 + getTowerHeight(), 0));
    particles.emitSteam(p, 0.75);
  }
}

function updateGuestAndServe(dt) {
  if (!guest) return;

  // Pop-in entrance scale for new animal guest
  if (state.guestScale < 1) {
    state.guestScale = Math.min(1, state.guestScale + dt * 2.8);
    const s = Math.sin(state.guestScale * Math.PI * 0.5);
    guest.root.scale.setScalar(s);
  }

  // Gentle breathing & tail sway
  guest.root.position.y = Math.sin(state.time * 2.1) * 0.012;
  const tailSpeed = state.stage === STAGES.SERVE || state.stack.length >= 2 ? 5.2 : 2.1;
  guest.tailPivot.rotation.z = Math.sin(state.time * tailSpeed) * (state.guestHappy > 0 ? 0.34 : 0.16);

  // Expressive ears wiggle
  for (let i = 0; i < guest.ears.length; i++) {
    const side = i === 0 ? -1 : 1;
    const baseZ = guest.type === 'kitten' ? side * -0.32 : side * -0.18;
    guest.ears[i].rotation.z = baseZ + Math.sin(state.time * 3.1 + i * 2.1) * (state.guestClap > 0 ? 0.14 : 0.04);
  }

  // Excited paw claps / eager coaster taps
  if (state.guestClap > 0) {
    state.guestClap = Math.max(0, state.guestClap - dt);
    guest.paws[0].position.y = 0.052 + Math.abs(Math.sin(state.time * 14)) * 0.07;
    guest.paws[1].position.y = 0.052 + Math.abs(Math.cos(state.time * 14)) * 0.07;
  } else {
    guest.paws[0].position.y += (0.052 - guest.paws[0].position.y) * Math.min(1, dt * 10);
    guest.paws[1].position.y += (0.052 - guest.paws[1].position.y) * Math.min(1, dt * 10);
  }

  // Head tracks active action!
  if (state.stage === STAGES.MIX) {
    state.guestLookTarget.lerp(bowlObj.group.position.clone().add(new THREE.Vector3(0, 0.25, 0)), dt * 4);
  } else if (state.stage === STAGES.BAKE && (!state.panCake || state.panCake.flipAnim === 0)) {
    state.guestLookTarget.lerp(skilletObj.group.position.clone().add(new THREE.Vector3(0, 0.2, 0)), dt * 4);
  } else if (state.stage === STAGES.DECORATE) {
    state.guestLookTarget.lerp(plateObj.group.position.clone().add(new THREE.Vector3(0, 0.15 + getTowerHeight(), 0)), dt * 5);
  } else if (state.stage === STAGES.SERVE) {
    state.guestLookTarget.lerp(plateObj.group.position.clone().add(new THREE.Vector3(0, 0.12 + getTowerHeight() * 0.7, 0)), dt * 6);
  }

  const dx = state.guestLookTarget.x - guest.root.position.x;
  const dy = state.guestLookTarget.y - (guest.root.position.y + 0.54);
  const dz = Math.max(0.25, state.guestLookTarget.z - guest.root.position.z);
  const yaw = Math.max(-0.55, Math.min(0.55, Math.atan2(dx, dz) * 0.65));
  const pitch = Math.max(-0.45, Math.min(0.42, -Math.atan2(dy, Math.hypot(dx, dz)) * 0.6));

  let munchPitch = 0;
  if (state.munchAnim > 0) {
    state.munchAnim += dt * 3.1;
    const t = Math.min(1, state.munchAnim);
    munchPitch = Math.sin(t * Math.PI) * 0.42;
    const jawOpen = Math.abs(Math.sin(t * Math.PI * 2));
    guest.mouthGroup.position.y = -0.11 - jawOpen * 0.035;
    guest.mouthInside.visible = jawOpen > 0.25;
    if (t >= 1) {
      state.munchAnim = 0;
      guest.mouthGroup.position.y = -0.11;
      guest.mouthInside.visible = false;
    }
  }

  // Tongue lick animation (licking whipped cream off nose!)
  if (state.lickAnim > 0) {
    state.lickAnim += dt * 2.4;
    const t = Math.min(1, state.lickAnim);
    guest.tongue.visible = true;
    guest.tongue.position.y = 0.02 + Math.sin(t * Math.PI) * 0.095;
    guest.tongue.position.z = 0.08 + Math.sin(t * Math.PI) * 0.04;
    if (t > 0.5 && state.hasNoseCream) {
      state.hasNoseCream = false;
      guest.noseCreamDab.visible = false;
    }
    if (t >= 1) {
      state.lickAnim = 0;
      guest.tongue.visible = false;
    }
  }

  guest.headGroup.rotation.y += (yaw - guest.headGroup.rotation.y) * Math.min(1, dt * 8);
  guest.headGroup.rotation.x += (pitch + munchPitch - guest.headGroup.rotation.x) * Math.min(1, dt * 10);

  // Blinking & happy smiling eyes (^_^)
  const smiling = state.guestHappy > 0 || state.lickAnim > 0;
  if (smiling) {
    for (const e of guest.eyes) e.visible = false;
    for (const l of guest.eyelids) l.visible = true;
  } else {
    state.guestNextBlink -= dt;
    if (state.guestNextBlink <= 0) {
      state.guestBlink = 0.14;
      state.guestNextBlink = 2.6 + Math.random() * 2.8;
    }
    if (state.guestBlink > 0) {
      state.guestBlink -= dt;
      for (const e of guest.eyes) e.scale.y = 0.12;
    } else {
      for (const e of guest.eyes) {
        e.visible = true;
        e.scale.y = 1.0;
      }
    }
    for (const l of guest.eyelids) l.visible = false;
  }

  // Serve auto-munch pacing & replay reset
  if (state.stage === STAGES.SERVE) {
    if (!state.finishedEating) {
      state.eatingTimer -= dt;
      if (state.eatingTimer <= 0) {
        triggerGuestMunch();
        state.eatingTimer = 1.15;
      }
    } else {
      state.finishTimer += dt;
      if (state.finishTimer > 3.6) {
        startNewRound();
      }
    }
  }
}

// Gentle environmental idle invitation (strictly silent for first 8.5s!)
function updateIdleEnvironmentalCue(dt) {
  state.idleTime += dt;
  if (state.idleTime < state.nextHintAt) return;
  state.nextHintAt = state.idleTime + 3.4;

  if (state.stage === STAGES.MIX) {
    if (!state.hasEgg) {
      eggObj.eggRoot.rotation.z = 0.24;
      setTimeout(() => (eggObj.eggRoot.rotation.z = 0), 220);
      sound.softNudge();
    } else if (!state.hasMilk) {
      milkObj.jugRoot.rotation.z = 0.18;
      setTimeout(() => (milkObj.jugRoot.rotation.z = 0), 260);
      sound.softNudge();
    } else {
      // Gently circle whisk once
      state.whiskTarget.set(0.16, 0.1);
      setTimeout(() => state.whiskTarget.set(-0.14, -0.08), 220);
      setTimeout(() => state.whiskTarget.set(0.05, 0), 460);
    }
  } else if (state.stage === STAGES.BAKE) {
    if (!state.panCake && !state.carryingCake) {
      ladleObj.group.position.y += 0.14;
      sound.softNudge();
    } else if (state.panCake && !state.panCake.flipped && state.panCake.cookBottom > 0.55) {
      particles.emitSteam(skilletObj.group.position.clone().add(new THREE.Vector3(0, 0.15, 0)), 1.3);
    }
  } else if (state.stage === STAGES.DECORATE) {
    if (!state.hasButter && state.totalSyrup === 0 && !state.hasCream && !state.hasBerry) {
      syrupObj.pitcherRoot.rotation.z = 0.16;
      setTimeout(() => (syrupObj.pitcherRoot.rotation.z = 0), 260);
    } else {
      // Guest eagerly taps paw on table to invite the decorated pancakes!
      state.guestClap = 0.8;
      sound.guestGreet(guest.type);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  state.time += dt;

  computeLayoutTargets();

  // Smoothly lerp props to active stage positions
  const alpha = Math.min(1, dt * 6.5);
  lerpVec(bowlObj.group.position, propTargets.bowl, alpha);
  lerpVec(eggObj.group.position, propTargets.egg, alpha);
  lerpVec(milkObj.group.position, propTargets.milk, alpha);
  lerpVec(skilletObj.group.position, propTargets.skillet, alpha);
  lerpVec(plateObj.group.position, propTargets.plate, alpha);
  lerpVec(butterDish.position, propTargets.butter, alpha);
  if (!state.syrupPouring) lerpVec(syrupObj.group.position, propTargets.syrup, alpha);
  lerpVec(creamBagObj.group.position, propTargets.cream, alpha);
  lerpVec(berryBowl.position, propTargets.berry, alpha);

  // Smooth cinematic camera glide
  lerpVec(camPos, camTargetPos, Math.min(1, dt * 4.2));
  lerpVec(camLook, camTargetLook, Math.min(1, dt * 4.8));
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  updateMixStage(dt);
  updateBakeStage(dt);
  updateTowerAndToppings(dt);
  updateGuestAndServe(dt);
  updateIdleEnvironmentalCue(dt);
  particles.update(dt, state.time);

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  computeLayoutTargets();
});

// Reveal sunlit kitchen smoothly on first rendered frame
requestAnimationFrame(() => {
  animate();
  const curtain = document.getElementById('curtain');
  if (curtain) {
    setTimeout(() => curtain.classList.add('ready'), 80);
  }
});
