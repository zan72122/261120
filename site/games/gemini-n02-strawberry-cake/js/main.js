import * as THREE from 'three';
import { sound } from './audio.js';
import { createBakeryEnvMap, createBokehTexture } from './textures.js';
import { ShortcakeSystem, CAKE_RADIUS, CAKE_HEIGHT } from './cake.js';
import {
  CreamBowlProp,
  BerryDishProp,
  SugarShakerProp,
  GuestPlaceSetting,
  buildBakeryEnvironment,
} from './props.js';
import { PlushGuest } from './guests.js';

// --- Renderer & Scene Setup ---
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xefdec7);
scene.fog = new THREE.FogExp2(0xefdec7, 0.028);

// Photorealistic Patisserie Studio Environment Map (creates real sunlit window catchlights!)
scene.environment = createBakeryEnvMap(renderer);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 40);

// --- Photorealistic Warm Morning Patisserie Lighting ---
const hemiLight = new THREE.HemisphereLight(0xfff4e2, 0x9c6d44, 0.44);
scene.add(hemiLight);

// Main sunlit café window key light (casts lush soft shadows across cake & wood)
const sunLight = new THREE.DirectionalLight(0xfff0d8, 2.45);
sunLight.position.set(-4.6, 7.2, 3.8);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1.0;
sunLight.shadow.camera.far = 18.0;
sunLight.shadow.camera.left = -4.6;
sunLight.shadow.camera.right = 4.6;
sunLight.shadow.camera.top = 4.6;
sunLight.shadow.camera.bottom = -4.6;
sunLight.shadow.bias = -0.00045;
sunLight.shadow.normalBias = 0.025;
scene.add(sunLight);

// Cool sky fill light from right so cream folds & shadows look sculptural, never muddy
const fillLight = new THREE.DirectionalLight(0xdcebff, 0.65);
fillLight.position.set(5.2, 3.6, 2.5);
scene.add(fillLight);

// Warm rim/backlight separating the plush guest & glossy berries cleanly from the background
const rimLight = new THREE.DirectionalLight(0xffe0b2, 0.85);
rimLight.position.set(1.2, 4.2, -5.0);
scene.add(rimLight);

// --- Build World, Cake, Props & Guests ---
const bakery = buildBakeryEnvironment(scene);

const cake = new ShortcakeSystem();
scene.add(cake.root);

const creamBowl = new CreamBowlProp();
scene.add(creamBowl.root);
scene.add(creamBowl.spatula);

const berryDish = new BerryDishProp();
scene.add(berryDish.root);

const sugarShaker = new SugarShakerProp();
scene.add(sugarShaker.root);

const guestSetting = new GuestPlaceSetting();
scene.add(guestSetting.root);

// Guest cycling roster: Honey Bear -> Calico Cat -> Cocoa Lop Bunny
const GUEST_ORDER = ['bear', 'cat', 'bunny'];
let guestIndex = 0;
let activeGuest = null;
const shelfGuests = []; // Satisfied guests sitting cozily on the sunlit café window shelf!

function spawnActiveGuest(type) {
  const g = new PlushGuest(type);
  g.root.position.set(0, 0.0, -2.75);
  g.root.scale.set(0.01, 0.01, 0.01);
  scene.add(g.root);
  return g;
}

activeGuest = spawnActiveGuest(GUEST_ORDER[0]);
activeGuest.root.scale.set(1, 1, 1);

// --- Optical Bokeh & Particle System (Crumbs, Powdered Sugar Snow, Sunbeam Bokeh) ---
const bokehTex = createBokehTexture();
const particles = [];

function spawnParticles(kind, origin, count = 12) {
  for (let i = 0; i < count; i++) {
    let mesh;
    if (kind === 'bokeh') {
      const mat = new THREE.SpriteMaterial({
        map: bokehTex,
        color: i % 3 === 0 ? 0xffdf99 : i % 3 === 1 ? 0xffeef4 : 0xfff8e2,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      mesh = new THREE.Sprite(mat);
      const s = 0.14 + Math.random() * 0.24;
      mesh.scale.set(s, s, 1);
      mesh.position.copy(origin).add(
        new THREE.Vector3((Math.random() - 0.5) * 1.1, Math.random() * 0.5, (Math.random() - 0.5) * 0.8)
      );
      scene.add(mesh);
      particles.push({
        kind,
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.45, 0.55 + Math.random() * 0.75, (Math.random() - 0.5) * 0.35),
        life: 1.4 + Math.random() * 1.1,
        maxLife: 2.5,
      });
    } else if (kind === 'sugar') {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.014 + Math.random() * 0.012, 6, 5), mat);
      mesh.position.copy(origin).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.48, (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.48)
      );
      scene.add(mesh);
      particles.push({
        kind,
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.16, -0.55 - Math.random() * 0.35, (Math.random() - 0.5) * 0.16),
        life: 0.95 + Math.random() * 0.4,
        maxLife: 1.35,
      });
    } else if (kind === 'crumb') {
      const mat = new THREE.MeshStandardMaterial({ color: 0xefc674, roughness: 0.9 });
      mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.022 + Math.random() * 0.014, 0), mat);
      mesh.position.copy(origin);
      scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const spd = 0.45 + Math.random() * 0.6;
      particles.push({
        kind,
        mesh,
        vel: new THREE.Vector3(Math.cos(a) * spd, 0.75 + Math.random() * 0.6, Math.sin(a) * spd),
        life: 0.55 + Math.random() * 0.25,
        maxLife: 0.8,
      });
    }
  }
}

// --- Responsive Layout Manager (iPhone Portrait & iPad Landscape) ---
const layout = {
  isPortrait: false,
  cakePos: new THREE.Vector3(0, 0, 0.35),
  bowlPos: new THREE.Vector3(-2.05, 0, 0.55),
  berryPos: new THREE.Vector3(2.05, 0, 0.55),
  sugarPos: new THREE.Vector3(1.92, 0, -0.78),
  guestPos: new THREE.Vector3(0, 0, -2.55),
  guestPlatePos: new THREE.Vector3(0, 0, -1.52),
  camRestPos: new THREE.Vector3(0, 3.35, 4.45),
  camRestLook: new THREE.Vector3(0, 0.65, -0.38),
  camEatPos: new THREE.Vector3(0, 2.35, 1.55),
  camEatLook: new THREE.Vector3(0, 0.88, -1.95),
};

const currentCamPos = new THREE.Vector3();
const currentCamLook = new THREE.Vector3();

function computeResponsiveLayout(immediate = false) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  layout.isPortrait = aspect < 1.0;

  if (layout.isPortrait) {
    // iPhone vertical: spacious stacked patisserie station, 100% of both bowls inside viewport margins!
    layout.cakePos.set(0, 0, 0.08);
    layout.bowlPos.set(-0.88, 0, 2.02);
    layout.berryPos.set(0.88, 0, 2.02);
    layout.sugarPos.set(1.26, 0, 0.36);
    layout.guestPos.set(0, 0.20, -2.55);
    layout.guestPlatePos.set(0, 0, -1.35);

    // Guarantee full horizontal clearance even on tall narrow iPhone screens (390x844, aspect 0.46)
    const distScale = THREE.MathUtils.clamp(0.68 / Math.max(0.42, aspect), 1.06, 1.50);
    layout.camRestPos.set(0, 4.45 * distScale, 5.15 * distScale);
    layout.camRestLook.set(0, 0.50, 0.14);
    layout.camEatPos.set(0.55, 3.05 * Math.min(1.22, distScale), 1.55 * Math.min(1.18, distScale));
    layout.camEatLook.set(0, 1.05, -1.85);
    camera.fov = 46;
  } else {
    // iPad / Desktop landscape (4:3, 16:10, 16:9): classic wide patisserie counter with zero rim clipping!
    const spreadX = THREE.MathUtils.clamp(1.78 + (aspect - 1.0) * 0.42, 1.82, 2.18);
    layout.cakePos.set(0, 0, 0.36);
    layout.bowlPos.set(-spreadX, 0, 0.48);
    layout.berryPos.set(spreadX, 0, 0.48);
    layout.sugarPos.set(spreadX - 0.12, 0, -0.84);
    layout.guestPos.set(0, 0.20, -2.55);
    layout.guestPlatePos.set(0, 0, -1.32);

    const zPull = aspect < 1.38 ? 5.12 : 4.65;
    layout.camRestPos.set(0, 3.55, zPull);
    layout.camRestLook.set(0, 0.65, -0.28);
    layout.camEatPos.set(0.62, 2.95, 1.48);
    layout.camEatLook.set(0, 1.08, -1.88);
    camera.fov = 39;
  }

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);

  cake.root.position.copy(layout.cakePos);
  creamBowl.root.position.copy(layout.bowlPos);
  berryDish.root.position.copy(layout.berryPos);
  sugarShaker.root.position.copy(layout.sugarPos);
  sugarShaker.restPos.copy(layout.sugarPos);
  guestSetting.root.position.copy(layout.guestPlatePos);
  if (activeGuest && activeGuest.mood !== 'shelf') {
    activeGuest.root.position.copy(layout.guestPos);
  }

  if (immediate) {
    currentCamPos.copy(layout.camRestPos);
    currentCamLook.copy(layout.camRestLook);
    camera.position.copy(currentCamPos);
    camera.lookAt(currentCamLook);
  }
}

computeResponsiveLayout(true);
window.addEventListener('resize', () => computeResponsiveLayout(false));

// --- Game State Machine ---
// Phases: 'frosting' -> 'decorating' -> 'serving' -> 'eating' -> 'celebrating' -> 'resetting'
const state = {
  phase: 'frosting',
  activePointerId: null,
  dragMode: null, // 'cream' | 'spin' | 'berry' | 'sugar' | 'slideServe' | null
  hasSpatulaCream: false,
  bareSpongePokes: 0,
  heldBerry: null, // { mesh, variant }
  pointerStartScreen: new THREE.Vector2(),
  pointerLastScreen: new THREE.Vector2(),
  pointerMovedDist: 0,
  holdTimer: 0,
  rosetteCooldown: 0,
  lastCakeLocalHit: null,
  idleTime: 0,
  hintPlayedForPhase: false,
  hintAnim: null, // { type, t }
  forkTapTimer: 4.0,
  serveProgress: 0,
  serveStartWorld: new THREE.Vector3(),
  serveEndWorld: new THREE.Vector3(),
  eatBiteCount: 0,
  eatBiteAnim: null, // { t, sliceMesh, hadCreamNose }
  eatAutoTimer: 4.6,
  celebrateTimer: 0,
  resetTimer: 0,
  cakesCompleted: 0,
};

// Spatula dynamic pose targets
const spatulaTargetPos = new THREE.Vector3();
const spatulaTargetRot = new THREE.Euler();
let spatulaInUse = false;

function getSpatulaRestWorld(outPos, outRot) {
  outPos.copy(creamBowl.root.position).add(creamBowl.spatulaRestOffset);
  outRot.copy(creamBowl.spatulaRestRot);
}
getSpatulaRestWorld(creamBowl.spatula.position, creamBowl.spatula.rotation);

// --- Raycasting Helpers ---
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlaneTop = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(CAKE_HEIGHT + 0.56));
const dragPlaneTable = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35);

function updateRay(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}

function getInteractiveTargets() {
  const list = [
    creamBowl.hitCollider,
    berryDish.hitCollider,
    sugarShaker.hitCollider,
    cake.hitCollider,
    guestSetting.hitCollider,
  ];
  if (activeGuest) list.push(activeGuest.hitCollider);
  return list;
}

function raycastCakeHit() {
  const hits = raycaster.intersectObject(cake.hitCollider, false);
  if (hits.length === 0) return null;
  const worldPt = hits[0].point.clone();
  const localPt = cake.cakeBodyGroup.worldToLocal(worldPt.clone());
  return { worldPt, localPt };
}

function worldToCakeTopLocal(worldPt) {
  return cake.cakeBodyGroup.worldToLocal(worldPt.clone());
}

// --- Core Transitions ---
function checkFrostingGraduation() {
  if (state.phase === 'frosting' && cake.overallCoverage >= 0.34) {
    state.phase = 'decorating';
    state.hintPlayedForPhase = false;
    state.idleTime = 0;
    sound.playCreamReadyChime();
    berryDish.triggerWiggle(0.95);
    if (activeGuest) {
      activeGuest.triggerHappyReaction();
      activeGuest.setLookTarget(berryDish.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)));
    }
    spawnParticles('bokeh', cake.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 8);
  }
}

function startServingCake() {
  if (state.phase !== 'decorating') return;
  state.phase = 'serving';
  state.dragMode = null;
  state.serveProgress = 0;
  spatulaInUse = false;
  creamBowl.setCreamLoaded(false);
  sound.stopCreamSpread();
  sound.playServeCake();

  // Detach servePlateGroup cleanly into scene world space so it glides across the wood counter!
  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  cake.servePlateGroup.getWorldPosition(worldPos);
  cake.servePlateGroup.getWorldQuaternion(worldQuat);
  scene.attach(cake.servePlateGroup);
  cake.servePlateGroup.position.copy(worldPos);
  cake.servePlateGroup.quaternion.copy(worldQuat);

  state.serveStartWorld.copy(worldPos);
  state.serveEndWorld.copy(layout.guestPlatePos).add(new THREE.Vector3(0, 0.085, 0));

  if (activeGuest) {
    activeGuest.setMood('eager');
    activeGuest.triggerHappyReaction();
  }
}

function triggerEatBite() {
  if (state.phase !== 'eating' || state.eatBiteAnim) return;
  if (state.eatBiteCount >= 4) return;

  const biteIdx = state.eatBiteCount;
  state.eatBiteCount++;
  state.eatAutoTimer = 4.6;

  // Cut real 3D wedge exposing double-layer sponge + cream + sliced strawberries!
  const sliceMesh = cake.cutNextSlice();
  sliceMesh.scale.setScalar(0.56);
  // Center wedge nicely on fork tines
  sliceMesh.position.set(-0.22, -0.18, -0.18);
  guestSetting.forkSliceMount.add(sliceMesh);

  // Cute surprise: if lots of cream or rosettes were added, bite #2 puts whipped cream on the guest's nose!
  const lotsOfCream = cake.rosettes.length >= 2 || cake.overallCoverage >= 0.68;
  const doNoseCream = biteIdx === 1 && lotsOfCream;

  state.eatBiteAnim = {
    t: 0,
    sliceMesh,
    biteIdx,
    chomped: false,
    doNoseCream,
  };
}

function startCelebration() {
  state.phase = 'celebrating';
  state.celebrateTimer = 3.1;
  sound.playCelebrate();
  if (activeGuest) {
    activeGuest.setMood('celebrating');
  }
  // Previous guests on the cozy sunlit shelf cheer too!
  shelfGuests.forEach((sg) => sg.triggerHappyReaction());
  spawnParticles('bokeh', layout.guestPos.clone().add(new THREE.Vector3(0, 1.35, 0.3)), 22);
}

function transitionToNextGuest() {
  state.phase = 'resetting';
  state.resetTimer = 0;
  state.cakesCompleted++;

  // Move satisfied guest to the sunlit back shelf (up to 3 friends watching cozily!)
  if (activeGuest) {
    if (shelfGuests.length < 3) {
      const slotIndex = shelfGuests.length;
      const shelfXs = [-1.65, 0.1, 1.85];
      activeGuest.setMood('shelf');
      activeGuest.clearNoseCream();
      activeGuest.root.position.set(shelfXs[slotIndex], bakery.shelfY - 0.04, bakery.shelfZ);
      activeGuest.root.scale.setScalar(0.68);
      activeGuest.root.rotation.y = -shelfXs[slotIndex] * 0.14;
      shelfGuests.push(activeGuest);
    } else {
      scene.remove(activeGuest.root);
    }
  }

  // Bring next adorable plush friend to the café table!
  guestIndex = (guestIndex + 1) % GUEST_ORDER.length;
  activeGuest = spawnActiveGuest(GUEST_ORDER[guestIndex]);
  activeGuest.root.position.copy(layout.guestPos);
  sound.playGuestArrive();

  // Reset cake with fresh golden bare sponge on the gleaming turntable!
  cake.resetForNewCake();
  berryDish.refillAll();
  state.hasSpatulaCream = false;
  state.bareSpongePokes = 0;
  state.eatBiteCount = 0;
  state.eatBiteAnim = null;
  state.hintPlayedForPhase = false;
  state.idleTime = 0;
  creamBowl.setCreamLoaded(false);
}

// --- One-Finger Pointer Handlers ---
function onPointerDown(e) {
  if (state.activePointerId !== null) return; // Multi-touch resilient: track single primary finger!
  state.activePointerId = e.pointerId;
  canvas.setPointerCapture?.(e.pointerId);

  sound.unlock();
  state.idleTime = 0;
  state.hintAnim = null;
  state.pointerStartScreen.set(e.clientX, e.clientY);
  state.pointerLastScreen.set(e.clientX, e.clientY);
  state.pointerMovedDist = 0;
  state.holdTimer = 0;

  // During eating phase: tapping anywhere on cake/guest/plate feeds the next yummy bite!
  if (state.phase === 'eating') {
    triggerEatBite();
    return;
  }
  if (state.phase === 'celebrating') {
    if (state.celebrateTimer < 2.2) {
      transitionToNextGuest();
    } else if (activeGuest) {
      activeGuest.triggerHappyReaction();
      spawnParticles('bokeh', layout.guestPos.clone().add(new THREE.Vector3(0, 1.3, 0.3)), 8);
    }
    return;
  }
  if (state.phase === 'serving' || state.phase === 'resetting') return;

  updateRay(e.clientX, e.clientY);
  const hits = raycaster.intersectObjects(getInteractiveTargets(), false);
  const hitKind = hits.length > 0 ? hits[0].object.userData.kind : null;

  // 1. Cream Bowl: scoop cream onto spatula (always works in frosting & decorating!)
  if (hitKind === 'creamBowl') {
    state.dragMode = 'cream';
    state.hasSpatulaCream = true;
    creamBowl.setCreamLoaded(true);
    creamBowl.stir(5.5);
    spatulaInUse = true;
    sound.playCreamScoop();

    const hitPt = hits[0].point;
    spatulaTargetPos.copy(hitPt).add(new THREE.Vector3(0, 0.14, 0));
    spatulaTargetRot.set(0.28, 0.4, -0.25);
    if (activeGuest) activeGuest.setLookTarget(hitPt);
    return;
  }

  // 2. Strawberry Dish
  if (hitKind === 'berryDish') {
    if (state.phase === 'frosting') {
      // Stage 1 hierarchy: berries aren't main focus yet -> cute ceramic wiggle + clink!
      berryDish.triggerWiggle(1.0);
      sound.playCeramicClink();
      if (activeGuest) activeGuest.setLookTarget(creamBowl.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
      return;
    }
    // Stage 2: Pick up a real gleaming strawberry (or rare pearl-white berry / mint)!
    const picked = berryDish.pickBerry();
    scene.add(picked.mesh);
    state.heldBerry = picked;
    state.dragMode = 'berry';
    sound.playBerryPick(picked.variant !== 'red');

    const worldPos = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlaneTop, worldPos);
    picked.mesh.position.copy(worldPos);
    if (activeGuest) activeGuest.setLookTarget(worldPos);
    return;
  }

  // 3. Powdered Sugar Shaker
  if (hitKind === 'sugarShaker') {
    if (state.phase === 'frosting' || cake.berries.length === 0) {
      sugarShaker.triggerWiggle();
      sound.playCeramicClink();
      return;
    }
    state.dragMode = 'sugar';
    sugarShaker.shaking = true;
    sound.playSugarShake();
    return;
  }

  // 4. Waiting Guest or Guest's Empty Plate -> Serve when ready, else friendly blink/bounce!
  if (hitKind === 'guest' || hitKind === 'guestPlate') {
    if (state.phase === 'decorating' && cake.berries.length >= 1) {
      startServingCake();
    } else if (activeGuest) {
      activeGuest.triggerHappyReaction();
      sound.playCeramicClink();
      if (state.phase === 'frosting') {
        activeGuest.setLookTarget(creamBowl.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
      } else {
        activeGuest.setLookTarget(berryDish.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
      }
    }
    return;
  }

  // 5. Cake / Turntable Direct Touch!
  if (hitKind === 'cake') {
    const cakeHit = raycastCakeHit();
    if (!cakeHit) return;

    // If cake is still bare AND spatula hasn't scooped cream yet -> realistic bouncy sponge poke!
    if (state.phase === 'frosting' && !state.hasSpatulaCream && cake.overallCoverage < 0.04) {
      cake.triggerSquish(0.085);
      sound.playSpongeSquish();
      spawnParticles('crumb', cakeHit.worldPt.clone().add(new THREE.Vector3(0, 0.05, 0)), 7);
      state.bareSpongePokes++;
      // Allow spinning turntable smoothly even on bare sponge!
      state.dragMode = 'spin';
      // Gently cue spatula shimmer if child pokes bare sponge twice without grabbing cream
      if (state.bareSpongePokes >= 2) {
        state.hintAnim = { type: 'cream', t: 0 };
        state.bareSpongePokes = 0;
      }
      return;
    }

    // If frosting OR holding spatula cream -> spread/smooth cream directly on the cake!
    if (state.hasSpatulaCream || state.phase === 'frosting') {
      state.dragMode = 'cream';
      spatulaInUse = true;
      creamBowl.setCreamLoaded(true);
      state.lastCakeLocalHit = cakeHit.localPt.clone();
      spatulaTargetPos.copy(cakeHit.worldPt).add(new THREE.Vector3(0, 0.06, 0));

      const res = cake.paintCreamAt(cakeHit.localPt, null, 0.34, 0.48);
      if (res.amountAdded > 0.01) {
        sound.updateCreamSpread(0.45);
      }
      checkFrostingGraduation();
      return;
    }

    // In decorating phase (with berries on cake): rubbing spins turntable OR upward slide serves cake!
    state.dragMode = 'cakeInteract';
    state.lastCakeLocalHit = cakeHit.localPt.clone();
    return;
  }

  // Touching near the steel turntable rim spins the cake smoothly!
  const tablePt = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(dragPlaneTable, tablePt)) {
    const dCake = Math.hypot(tablePt.x - layout.cakePos.x, tablePt.z - layout.cakePos.z);
    if (dCake < 1.65) {
      state.dragMode = 'spin';
    }
  }
}

function onPointerMove(e) {
  if (e.pointerId !== state.activePointerId || !state.dragMode) return;

  const dx = e.clientX - state.pointerLastScreen.x;
  const dy = e.clientY - state.pointerLastScreen.y;
  const stepDist = Math.hypot(dx, dy);
  state.pointerMovedDist += stepDist;
  state.pointerLastScreen.set(e.clientX, e.clientY);
  state.idleTime = 0;

  updateRay(e.clientX, e.clientY);

  // --- Mode 1: Spreading Real 3D Whipped Cream with Palette Knife ---
  if (state.dragMode === 'cream') {
    const cakeHit = raycastCakeHit();
    if (cakeHit) {
      const prev = state.lastCakeLocalHit;
      const strokeDir = prev ? cakeHit.localPt.clone().sub(prev) : new THREE.Vector3(1, 0, 0);
      const localSpeed = prev ? strokeDir.length() : 0.1;

      if (localSpeed > 0.012 || !prev) {
        cake.paintCreamAt(cakeHit.localPt, strokeDir, 0.35, 0.56);
        state.lastCakeLocalHit = cakeHit.localPt.clone();
        sound.updateCreamSpread(Math.min(1, localSpeed * 6.5));
        checkFrostingGraduation();
      }

      // Natural patissier assist: sweeping horizontally along the cake side gently turns the turntable!
      if (cakeHit.localPt.y < CAKE_HEIGHT - 0.14 && Math.abs(dx) > 1.5) {
        cake.spinVel += dx * 0.018;
        sound.playTurntableTick(cake.spinVel);
      }

      // Position palette knife smoothly right at the cream contact point!
      spatulaTargetPos.copy(cakeHit.worldPt).add(new THREE.Vector3(0, 0.04, 0));
      const yaw = Math.atan2(cakeHit.worldPt.x - layout.cakePos.x, cakeHit.worldPt.z - layout.cakePos.z);
      spatulaTargetRot.set(cakeHit.localPt.y < CAKE_HEIGHT - 0.14 ? 0.55 : 0.22, yaw * 0.35 + 0.3, -0.18);
      if (activeGuest) activeGuest.setLookTarget(cakeHit.worldPt);
    } else {
      // Hovering between bowl and cake
      const hoverPt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlaneTop, hoverPt)) {
        spatulaTargetPos.copy(hoverPt);
        spatulaTargetRot.set(0.26, 0.35, -0.2);
        if (activeGuest) activeGuest.setLookTarget(hoverPt);
      }
      // If stirring inside cream bowl
      const bowlHits = raycaster.intersectObject(creamBowl.hitCollider, false);
      if (bowlHits.length > 0 && stepDist > 2) {
        creamBowl.stir(stepDist * 0.25);
        sound.updateCreamSpread(0.35);
      } else {
        sound.stopCreamSpread();
      }
    }
    return;
  }

  // --- Mode 2: Carrying a Glossy Strawberry over the Cake ---
  if (state.dragMode === 'berry' && state.heldBerry) {
    const hoverPt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlaneTop, hoverPt)) {
      // Lift slightly higher over the cake so one finger never obscures landing!
      hoverPt.y += 0.16;
      state.heldBerry.mesh.position.lerp(hoverPt, 0.55);
      state.heldBerry.mesh.rotation.z = THREE.MathUtils.clamp(-dx * 0.025, -0.45, 0.45);
      if (activeGuest) activeGuest.setLookTarget(state.heldBerry.mesh.position);
    }
    return;
  }

  // --- Mode 3: Shaking Powdered Sugar over the Cake ---
  if (state.dragMode === 'sugar') {
    const hoverPt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlaneTop, hoverPt)) {
      hoverPt.y += 0.45;
      sugarShaker.root.position.lerp(hoverPt, 0.45);
      sugarShaker.root.rotation.z = Math.PI * 0.78 + Math.sin(performance.now() * 0.028) * 0.28;
      if (stepDist > 4) {
        const dCake = Math.hypot(hoverPt.x - layout.cakePos.x, hoverPt.z - layout.cakePos.z);
        if (dCake < CAKE_RADIUS + 0.55) {
          const localPt = worldToCakeTopLocal(hoverPt);
          cake.addPowderedSugarBurst(localPt.x, localPt.z);
          spawnParticles('sugar', sugarShaker.root.position.clone().add(new THREE.Vector3(0, -0.32, 0)), 5);
          if (Math.random() < 0.25) sound.playSugarShake();
        }
      }
    }
    return;
  }

  // --- Mode 4: Spinning the Stainless Steel Turntable ---
  if (state.dragMode === 'spin') {
    cake.spinVel += dx * 0.032;
    cake.spinVel = THREE.MathUtils.clamp(cake.spinVel, -8.5, 8.5);
    if (Math.abs(dx) > 2) sound.playTurntableTick(cake.spinVel);
    return;
  }

  // --- Mode 5: Cake interaction during Decorating (spin turntable OR slide upward to serve!) ---
  if (state.dragMode === 'cakeInteract') {
    const totalDx = e.clientX - state.pointerStartScreen.x;
    const totalDy = e.clientY - state.pointerStartScreen.y;
    // Deliberate upward push toward waiting guest serves the finished cake!
    if (cake.berries.length >= 1 && totalDy < -78 && Math.abs(totalDy) > Math.abs(totalDx) * 1.35) {
      startServingCake();
      return;
    }
    // Horizontal swipe spins the turntable effortlessly!
    if (Math.abs(dx) > 1.2) {
      cake.spinVel += dx * 0.028;
      cake.spinVel = THREE.MathUtils.clamp(cake.spinVel, -8.5, 8.5);
      sound.playTurntableTick(cake.spinVel);
    }
  }
}

function onPointerUp(e) {
  if (e.pointerId !== state.activePointerId) return;
  state.activePointerId = null;
  sound.stopCreamSpread();

  // --- Quick Tap Shortcuts (Forgiving for 5-year-olds!) ---
  if (state.dragMode === 'cream') {
    // Quick tap on cream bowl -> plops a generous creamy dollop straight onto the sponge!
    if (state.pointerMovedDist < 16) {
      updateRay(e.clientX, e.clientY);
      const bowlHits = raycaster.intersectObject(creamBowl.hitCollider, false);
      if (bowlHits.length > 0) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 0.55;
        cake.dropCreamDollop(Math.cos(ang) * rad, Math.sin(ang) * rad);
        sound.playCreamScoop();
        checkFrostingGraduation();
      } else {
        // Quick tap on already frosted cake -> pipes a sculpted 3D star-nozzle cream rosette!
        const cakeHit = raycastCakeHit();
        if (cakeHit && cake.hasCreamAtLocal(cakeHit.localPt.x, cakeHit.localPt.z)) {
          const added = cake.addRosette(cakeHit.localPt.x, cakeHit.localPt.z);
          if (added) sound.playRosettePop(cake.rosettes.length);
        }
      }
    }
    spatulaInUse = false;
  } else if (state.dragMode === 'berry' && state.heldBerry) {
    const berry = state.heldBerry;
    state.heldBerry = null;

    if (state.pointerMovedDist < 18) {
      // Quick tap on strawberry dish -> gracefully hops berry onto a lovely spot on the cake!
      const n = cake.berries.length;
      const ringAng = n * 2.39996; // golden-angle patisserie crown distribution!
      const ringR = n === 0 ? 0.0 : Math.min(CAKE_RADIUS * 0.68, 0.25 + (n % 7) * 0.085);
      const res = cake.placeBerry(berry.mesh, Math.cos(ringAng) * ringR, Math.sin(ringAng) * ringR, berry.variant);
      sound.playBerryDrop(res.stackLevel, res.onCream, berry.variant !== 'red');
      if (berry.variant === 'white') {
        spawnParticles('bokeh', cake.root.position.clone().add(new THREE.Vector3(0, 1.35, 0)), 10);
      }
      if (activeGuest && cake.berries.length === 1) {
        activeGuest.setMood('eager');
        activeGuest.triggerHappyReaction();
      }
    } else {
      // Dropped after dragging: check distance to cake (generous magnetic snap!)
      const dropWorld = berry.mesh.position.clone();
      const dCake = Math.hypot(dropWorld.x - layout.cakePos.x, dropWorld.z - layout.cakePos.z);
      if (dCake < CAKE_RADIUS + 0.65) {
        const localPt = worldToCakeTopLocal(dropWorld);
        const res = cake.placeBerry(berry.mesh, localPt.x, localPt.z, berry.variant);
        sound.playBerryDrop(res.stackLevel, res.onCream, berry.variant !== 'red');
        if (berry.variant === 'white') {
          spawnParticles('bokeh', dropWorld, 12);
        }
        if (activeGuest && cake.berries.length === 1) {
          activeGuest.setMood('eager');
          activeGuest.triggerHappyReaction();
        }
      } else {
        // Dropped far off the cake -> gently returns to bowl (never lost or punished)
        scene.remove(berry.mesh);
        berryDish.triggerWiggle(0.5);
        sound.playCeramicClink();
      }
    }
  } else if (state.dragMode === 'sugar') {
    // Quick tap on sugar shaker sprinkles a lovely snow shower right over the center of the cake!
    if (state.pointerMovedDist < 18) {
      for (let i = 0; i < 4; i++) {
        cake.addPowderedSugarBurst((Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.1);
      }
      spawnParticles('sugar', layout.cakePos.clone().add(new THREE.Vector3(0, CAKE_HEIGHT + 0.9, 0)), 26);
      sound.playSugarShake();
    }
    sugarShaker.shaking = false;
  } else if (state.dragMode === 'cakeInteract') {
    // Quick tap on frosted cake during decorating pipes a beautiful 3D whipped cream rosette!
    if (state.pointerMovedDist < 15) {
      updateRay(e.clientX, e.clientY);
      const cakeHit = raycastCakeHit();
      if (cakeHit) {
        const added = cake.addRosette(cakeHit.localPt.x, cakeHit.localPt.z);
        if (added) {
          sound.playRosettePop(cake.rosettes.length);
        } else {
          cake.triggerSquish(0.05);
          sound.playSpongeSquish();
        }
      }
    }
  }

  state.dragMode = null;
  state.lastCakeLocalHit = null;
}

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Main Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 1. Update Cake Physics (Turntable Inertia, Elastic Sponge, Rosettes, Berry Stacking/Tumble)
  cake.update(dt, () => {
    sound.playBerryTumble();
    if (activeGuest) activeGuest.triggerHappyReaction();
  });

  // 2. Update Interactive Props
  creamBowl.update(dt);
  berryDish.update(dt);
  sugarShaker.update(dt);

  // Smoothly return sugar shaker when not being dragged
  if (!sugarShaker.shaking) {
    sugarShaker.root.position.lerp(sugarShaker.restPos, Math.min(1, dt * 8));
    sugarShaker.root.rotation.z = THREE.MathUtils.lerp(sugarShaker.root.rotation.z, 0, Math.min(1, dt * 8));
  }

  // Hold-to-pipe cream rosette while holding finger steady on frosted cake!
  if (state.dragMode === 'cream' && state.lastCakeLocalHit && state.pointerMovedDist > 2) {
    state.holdTimer += dt;
    state.rosetteCooldown = Math.max(0, state.rosetteCooldown - dt);
  }

  // 3. Spatula Smooth Follow & Subtle Late Idle Environmental Cue (only after 11s idle!)
  if (spatulaInUse) {
    creamBowl.spatula.position.lerp(spatulaTargetPos, Math.min(1, dt * 18));
    creamBowl.spatula.rotation.x = THREE.MathUtils.lerp(creamBowl.spatula.rotation.x, spatulaTargetRot.x, Math.min(1, dt * 14));
    creamBowl.spatula.rotation.y = THREE.MathUtils.lerp(creamBowl.spatula.rotation.y, spatulaTargetRot.y, Math.min(1, dt * 14));
    creamBowl.spatula.rotation.z = THREE.MathUtils.lerp(creamBowl.spatula.rotation.z, spatulaTargetRot.z, Math.min(1, dt * 14));
  } else if (state.hintAnim && state.hintAnim.type === 'cream') {
    // One gentle wordless environmental gesture: spatula scoops & glides once over sponge, then rests
    state.hintAnim.t += dt;
    const t = state.hintAnim.t;
    const restP = new THREE.Vector3();
    const restR = new THREE.Euler();
    getSpatulaRestWorld(restP, restR);
    const cakeTopWorld = layout.cakePos.clone().add(new THREE.Vector3(0, CAKE_HEIGHT + 0.56, 0));

    if (t < 1.6) {
      const k = Math.sin((t / 1.6) * Math.PI);
      const arcPos = restP.clone().lerp(cakeTopWorld, k * 0.82);
      arcPos.y += Math.sin(k * Math.PI) * 0.45;
      creamBowl.spatula.position.lerp(arcPos, Math.min(1, dt * 10));
      creamBowl.setCreamLoaded(true);
    } else {
      creamBowl.setCreamLoaded(state.hasSpatulaCream);
      state.hintAnim = null;
    }
  } else {
    const restP = new THREE.Vector3();
    const restR = new THREE.Euler();
    getSpatulaRestWorld(restP, restR);
    creamBowl.spatula.position.lerp(restP, Math.min(1, dt * 8));
    creamBowl.spatula.rotation.x = THREE.MathUtils.lerp(creamBowl.spatula.rotation.x, restR.x, Math.min(1, dt * 8));
    creamBowl.spatula.rotation.y = THREE.MathUtils.lerp(creamBowl.spatula.rotation.y, restR.y, Math.min(1, dt * 8));
    creamBowl.spatula.rotation.z = THREE.MathUtils.lerp(creamBowl.spatula.rotation.z, restR.z, Math.min(1, dt * 8));
  }

  // 4. Slow Gentle Environmental Hints (0-10s nothing; only once when truly idle!)
  if (state.activePointerId === null && (state.phase === 'frosting' || state.phase === 'decorating')) {
    state.idleTime += dt;
    if (!state.hintPlayedForPhase && state.idleTime > 10.5) {
      state.hintPlayedForPhase = true;
      if (state.phase === 'frosting') {
        state.hintAnim = { type: 'cream', t: 0 };
        creamBowl.stir(3.0);
      } else if (state.phase === 'decorating' && cake.berries.length === 0) {
        berryDish.triggerWiggle(0.85);
        sound.playCeramicClink();
      }
    }
  }

  // 5. Eager Guest Gentle Fork-Tap Invitation (when cake has cream + berries!)
  if (state.phase === 'decorating' && cake.berries.length >= 1) {
    state.forkTapTimer -= dt;
    if (state.forkTapTimer <= 0) {
      state.forkTapTimer = 6.2;
      sound.playForkTap();
      if (activeGuest) activeGuest.triggerHappyReaction();
    }
    // Subtle physical fork tap lift animation right after sound
    const tapPulse = state.forkTapTimer > 5.75 ? Math.abs(Math.sin((6.2 - state.forkTapTimer) * 22)) * 0.12 : 0;
    guestSetting.fork.position.y = guestSetting.forkRestPos.y + tapPulse;
    guestSetting.fork.rotation.x = -tapPulse * 1.4;
  } else if (state.phase !== 'eating') {
    guestSetting.fork.position.lerp(guestSetting.forkRestPos, Math.min(1, dt * 8));
    guestSetting.fork.rotation.x = THREE.MathUtils.lerp(guestSetting.fork.rotation.x, guestSetting.forkRestRot.x, Math.min(1, dt * 8));
    guestSetting.fork.rotation.y = THREE.MathUtils.lerp(guestSetting.fork.rotation.y, guestSetting.forkRestRot.y, Math.min(1, dt * 8));
    guestSetting.fork.rotation.z = THREE.MathUtils.lerp(guestSetting.fork.rotation.z, guestSetting.forkRestRot.z, Math.min(1, dt * 8));
  }

  // 6. Serving Glide Animation (Cake Plate glides smoothly onto Guest's Placemat!)
  if (state.phase === 'serving') {
    state.serveProgress += dt * 1.12;
    const t = Math.min(1, state.serveProgress);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    cake.servePlateGroup.position.lerpVectors(state.serveStartWorld, state.serveEndWorld, ease);
    cake.servePlateGroup.position.y += Math.sin(t * Math.PI) * 0.34;
    if (activeGuest) {
      activeGuest.setLookTarget(cake.servePlateGroup.position.clone().add(new THREE.Vector3(0, 0.7, 0)));
    }
    if (t >= 1) {
      state.phase = 'eating';
      state.eatAutoTimer = 1.6; // Invite first joyful bite smoothly!
      cake.triggerSquish(0.045);
      spawnParticles('bokeh', state.serveEndWorld.clone().add(new THREE.Vector3(0, 1.0, 0)), 10);
    }
  }

  // 7. Interactive Eating Phase (Fork lifts YOUR exact 3D layered cake slice to Guest's mouth!)
  if (state.phase === 'eating') {
    if (state.eatBiteAnim) {
      const anim = state.eatBiteAnim;
      anim.t += dt;

      const mouthWorld = activeGuest ? activeGuest.getMouthWorldPosition() : layout.guestPos.clone().add(new THREE.Vector3(0, 1.15, 0.5));
      const mouthLocal = guestSetting.root.worldToLocal(mouthWorld.clone());
      const cakeTopLocal = new THREE.Vector3(0.18, 0.92, 0.18);

      if (anim.t < 0.58) {
        // Lift real 3D layered slice smoothly from cake up to guest's happy mouth!
        const k = anim.t / 0.58;
        const ease = 1 - Math.pow(1 - k, 3);
        const targetPos = cakeTopLocal.clone().lerp(mouthLocal.clone().add(new THREE.Vector3(0.06, -0.05, 0.25)), ease);
        targetPos.y += Math.sin(k * Math.PI) * 0.24;
        guestSetting.fork.position.lerp(targetPos, Math.min(1, dt * 16));
        guestSetting.fork.rotation.x = THREE.MathUtils.lerp(guestSetting.fork.rotation.x, 0.28, Math.min(1, dt * 12));
        guestSetting.fork.rotation.y = THREE.MathUtils.lerp(guestSetting.fork.rotation.y, 0.12, Math.min(1, dt * 12));
        if (activeGuest) activeGuest.setLookTarget(mouthWorld);
      } else if (!anim.chomped) {
        // CHOMP! Joyful yummy bite!
        anim.chomped = true;
        guestSetting.forkSliceMount.remove(anim.sliceMesh);
        sound.playEatBite(anim.biteIdx);
        if (activeGuest) {
          activeGuest.triggerBite(anim.doNoseCream);
          if (anim.doNoseCream) {
            setTimeout(() => sound.playNoseCreamGiggle(), 240);
          }
        }
        spawnParticles('bokeh', mouthWorld.clone().add(new THREE.Vector3(0, 0.15, 0.1)), 12);
      } else if (anim.t < 1.25) {
        // Return fork gently back beside plate
        guestSetting.fork.position.lerp(guestSetting.forkRestPos, Math.min(1, dt * 8));
        guestSetting.fork.rotation.x = THREE.MathUtils.lerp(guestSetting.fork.rotation.x, 0, Math.min(1, dt * 8));
      } else {
        state.eatBiteAnim = null;
        if (state.eatBiteCount >= 4) {
          startCelebration();
        }
      }
    } else {
      // Gently auto-feed if child is happily watching without tapping
      state.eatAutoTimer -= dt;
      if (state.eatAutoTimer <= 0) {
        triggerEatBite();
      }
    }
  }

  // 8. Celebration & Smooth Transition to Next Guest
  if (state.phase === 'celebrating') {
    state.celebrateTimer -= dt;
    if (Math.random() < dt * 4.5) {
      spawnParticles('bokeh', layout.guestPos.clone().add(new THREE.Vector3(0, 1.35, 0.35)), 2);
    }
    if (state.celebrateTimer <= 0) {
      transitionToNextGuest();
    }
  }

  if (state.phase === 'resetting') {
    state.resetTimer += dt;
    const t = Math.min(1, state.resetTimer / 0.72);
    const elastic = t < 1 ? 1 + Math.sin(t * Math.PI * 1.35) * 0.14 * (1 - t) : 1;
    if (activeGuest) {
      activeGuest.root.scale.setScalar(Math.max(0.01, t * elastic));
    }
    cake.cakeBodyGroup.position.y = THREE.MathUtils.lerp(0.65, 0.068, 1 - Math.pow(1 - t, 3));
    if (t >= 1) {
      cake.cakeBodyGroup.position.y = 0.068;
      if (activeGuest) activeGuest.root.scale.setScalar(1);
      state.phase = 'frosting';
    }
  }

  // 9. Update Active & Shelf Guests
  if (activeGuest) {
    if (state.activePointerId === null && (state.phase === 'frosting' || state.phase === 'decorating')) {
      activeGuest.setLookTarget(layout.cakePos.clone().add(new THREE.Vector3(0, 0.85, 0)));
    }
    activeGuest.update(dt);
  }
  for (const sg of shelfGuests) {
    sg.setLookTarget(layout.cakePos.clone().add(new THREE.Vector3(0, 0.8, 0)));
    sg.update(dt);
  }

  // 10. Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      if (p.mesh.material) p.mesh.material.dispose();
      particles.splice(i, 1);
      continue;
    }
    if (p.kind === 'crumb') p.vel.y -= 4.8 * dt;
    if (p.kind === 'bokeh') {
      p.vel.x += Math.sin(p.life * 4.5 + i) * 0.015;
      p.mesh.material.opacity = Math.min(0.92, (p.life / p.maxLife) * 1.4);
    }
    if (p.kind === 'sugar') {
      p.vel.x += Math.sin(p.life * 8 + i) * 0.01;
      if (p.mesh.position.y < CAKE_HEIGHT + 0.35) {
        p.life = 0;
      }
    }
    p.mesh.position.addScaledVector(p.vel, dt);
  }

  // 11. Smooth Cinema Camera Framing (Decorating View <-> Cozy Eating View)
  const inEatView = state.phase === 'serving' || state.phase === 'eating' || state.phase === 'celebrating';
  const targetCamP = inEatView ? layout.camEatPos : layout.camRestPos;
  const targetCamL = inEatView ? layout.camEatLook : layout.camRestLook;
  currentCamPos.lerp(targetCamP, Math.min(1, dt * 3.8));
  currentCamLook.lerp(targetCamL, Math.min(1, dt * 4.2));
  camera.position.copy(currentCamPos);
  camera.lookAt(currentCamLook);

  renderer.render(scene, camera);
}

animate();
