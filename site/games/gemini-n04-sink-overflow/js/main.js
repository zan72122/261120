import * as THREE from 'three';
import { setupKitchenEnvironment } from './environment.js';
import { createKitchen, SINK } from './kitchen.js';
import { WaterSystem } from './water.js';
import { FoamSystem } from './foam.js';
import { DishManager } from './dishes.js';
import { audio } from './audio.js';

const stage = document.getElementById('stage');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true // helps crisp screenshot capture too
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

// --- Scene & Camera ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 40);

const env = setupKitchenEnvironment(renderer, scene);
const kitchen = createKitchen(scene);
const water = new WaterSystem(scene);
const foam = new FoamSystem(scene);
const dishMgr = new DishManager(scene);

// --- Responsive Framing (iPhone Portrait & iPad Landscape & 4:3) ---
function updateCameraFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  renderer.setSize(w, h);
  camera.aspect = aspect;

  if (aspect >= 0.95) {
    // iPad landscape / 4:3 / desktop
    camera.fov = 40;
    const baseDist = aspect < 1.25 ? 4.85 / (aspect / 1.25) : 4.65;
    const clampedDist = Math.min(5.6, Math.max(4.55, baseDist));
    const lookAt = new THREE.Vector3(0.08, 0.62, -0.22);
    const dir = new THREE.Vector3(0.0, 0.42, 0.91).normalize();
    camera.position.copy(lookAt).addScaledVector(dir, clampedDist);
    camera.lookAt(lookAt);
  } else {
    // iPhone portrait: fit full essential width (soap bottle to towel ~3.65 units) cleanly!
    camera.fov = 52;
    const halfW = 1.96;
    const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
    const dist = Math.max(4.9, halfW / (tanHalfV * Math.max(0.42, aspect)));
    const lookAt = new THREE.Vector3(0.08, 0.54, -0.18);
    const dir = new THREE.Vector3(0.0, 0.46, 0.89).normalize();
    camera.position.copy(lookAt).addScaledVector(dir, dist);
    camera.lookAt(lookAt);
  }
  camera.updateProjectionMatrix();
}

updateCameraFraming();
window.addEventListener('resize', updateCameraFraming);

// --- Interaction State ---
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const dragPlaneHoriz = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragPlaneVert = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.3);
const intersectPt = new THREE.Vector3();

let activePointerId = null;
let dragMode = null; // 'faucet' | 'sponge' | 'towel' | 'dish' | 'water' | 'stream'
let draggedDish = null;
let pointerDownScreen = new THREE.Vector2();
let lastWorldPos = new THREE.Vector3();
let pointerMoved = 0;

// Visual animation states
let soapPumpAnim = 0;
let soapSquirtAnim = 0;
let spongeSquish = 0;
let spongeHolding = false;
let spongeVel = new THREE.Vector3();
let towelHolding = false;
let towelAutoRubDish = null;
let towelAutoRubTimer = 0;

// Celebration & Replay state
let celebrationPlayed = false;
let celebrationTimer = 0;
let replayTrayVisible = false;
let replayTrayProgress = 0;

// Gentle Idle Hint (ONLY after 12s complete inactivity, runs ONCE then stays quiet!)
let idleSeconds = 0;
let hintActive = false;
let hintProgress = 0;
let hintShownForStage = -1;

// Raycast target collections
function getInteractiveObjects() {
  const list = [
    kitchen.faucetHit,
    kitchen.soapHit,
    kitchen.spongeHit,
    kitchen.towelHit,
    kitchen.drainHit,
    water.waterHit
  ];
  if (water.faucetFlow > 0.05) list.push(water.streamHit);
  if (replayTrayVisible) list.push(kitchen.replayHit);
  for (const d of dishMgr.dishes) list.push(d.hitMesh);
  for (const b of foam.bubbles) {
    if (b.active) list.push(b.mesh);
  }
  return list;
}

function setNDCFromEvent(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function raycastToPlane(plane, out) {
  raycaster.setFromCamera(pointerNDC, camera);
  return raycaster.ray.intersectPlane(plane, out);
}

function triggerSoapPump() {
  soapPumpAnim = 1.0;
  soapSquirtAnim = 1.0;
  audio.playSoapSquirt();
  water.soapiness = Math.min(1.6, water.soapiness + 0.36);

  // Spawn immediate cheerful burst of foam right where the soap lands!
  const landingY = water.level > 0.02 ? water.getSurfaceY() : SINK.bottomY + 0.04;
  water.addRipple(-0.42, -0.05, -0.032, 2);
  foam.addFoamCluster(-0.42, landingY + 0.02, -0.05, water.level > 0.04 ? 9 : 4);
  foam.spawnFloatingBubble(-0.42, landingY + 0.14, -0.05, 1.05);
}

function toggleDrainPlug() {
  water.isPlugged = !water.isPlugged;
  audio.playPlugPop(!water.isPlugged);
  if (water.level > 0.04) {
    water.addRipple(SINK.drainX, SINK.drainZ, water.isPlugged ? -0.04 : 0.05, 3);
    water.spawnSplash(SINK.drainX, water.getSurfaceY(), SINK.drainZ, 8, 1.1);
  }
}

function resetIdle() {
  idleSeconds = 0;
  if (hintActive) {
    hintActive = false;
    kitchen.hintHand.visible = false;
  }
}

function onPointerDown(e) {
  if (activePointerId !== null) return; // Strict one-finger guard
  activePointerId = e.pointerId;
  renderer.domElement.setPointerCapture?.(e.pointerId);

  audio.unlock();
  resetIdle();
  setNDCFromEvent(e);
  pointerDownScreen.set(e.clientX, e.clientY);
  pointerMoved = 0;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(getInteractiveObjects(), false);

  if (hits.length === 0) return;

  // Priority check: pop floating iridescent bubbles first!
  const bubbleHit = hits.find((h) => h.object.userData.type === 'bubble');
  if (bubbleHit) {
    foam.popBubble(bubbleHit.object.userData.index);
    return;
  }

  // Pick highest-priority tangible object (skip waterHit if a tangible item is hit behind/near it,
  // and prioritize picking up a dry dish sitting on the drying mat over the towel underneath!)
  let chosen = hits[0];
  if (chosen.object.userData.type === 'water' && hits.length > 1) {
    const better = hits.find((h) => h.object.userData.type !== 'water' && h.object.userData.type !== 'stream');
    if (better && better.distance - chosen.distance < 1.35) {
      chosen = better;
    }
  }
  if (chosen.object.userData.type === 'towel' && hits.length > 1) {
    const dryDishHit = hits.find((h) => {
      if (h.object.userData.type !== 'dish') return false;
      const d = dishMgr.dishes[h.object.userData.dishId];
      return d && d.onMat && d.state === 'dry';
    });
    if (dryDishHit) chosen = dryDishHit;
  }

  const type = chosen.object.userData.type;

  if (type === 'replayTray') {
    replayTrayVisible = false;
    celebrationPlayed = false;
    dishMgr.resetForNewRound(water);
    audio.playSplash(0.5);
    return;
  }

  if (type === 'faucet') {
    dragMode = 'faucet';
    // Immediate snappy toggle on tap (or smooth adjust on drag)
    const opening = water.targetFlow < 0.1;
    water.targetFlow = opening ? 1.0 : 0.0;
    audio.playValveClick(opening);
    return;
  }

  if (type === 'soap') {
    triggerSoapPump();
    return;
  }

  if (type === 'drain') {
    toggleDrainPlug();
    return;
  }

  if (type === 'sponge') {
    dragMode = 'sponge';
    spongeHolding = true;
    spongeSquish = 0.65;
    dragPlaneHoriz.constant = -(Math.max(0.06, water.getSurfaceY() + 0.03));
    if (raycastToPlane(dragPlaneHoriz, lastWorldPos)) {
      // Gentle splash if picking up from water
      if (water.level > 0.2 && Math.abs(kitchen.spongeGroup.position.x) < SINK.maxX) {
        audio.playSplash(0.3);
      }
    }
    return;
  }

  if (type === 'towel') {
    dragMode = 'towel';
    towelHolding = true;
    towelAutoRubDish = null;
    dragPlaneHoriz.constant = -0.18;
    raycastToPlane(dragPlaneHoriz, lastWorldPos);
    audio.playWipe(0.35);
    return;
  }

  if (type === 'dish') {
    const dish = dishMgr.dishes[chosen.object.userData.dishId];
    if (!dish) return;
    dragMode = 'dish';
    draggedDish = dish;
    dish.isDragged = true;
    dish.animArc = null;
    dish.wobbleTime = 0.2;
    audio.playDishClink(dish.id, dish.state === 'shelved');

    // If pulled from shelf, allow moving freely again
    if (dish.state === 'shelved') {
      dish.state = 'dry';
    }

    // Set initial world anchor
    dragPlaneHoriz.constant = -Math.max(0.15, dish.group.position.y);
    raycastToPlane(dragPlaneHoriz, lastWorldPos);
    return;
  }

  if (type === 'stream') {
    dragMode = 'stream';
    water.spawnSplash(SINK.spoutPos.x, chosen.point.y, SINK.spoutPos.z, 10, 1.5);
    audio.playSplash(0.5);
    return;
  }

  if (type === 'water') {
    dragMode = 'water';
    lastWorldPos.copy(chosen.point);
    if (water.level > 0.02) {
      water.addRipple(chosen.point.x, chosen.point.z, -0.052, 3);
      water.spawnSplash(chosen.point.x, water.getSurfaceY(), chosen.point.z, 7, 1.15);
      audio.playSplash(0.45);
      if (water.soapiness > 0.08) {
        foam.addFoamCluster(chosen.point.x, water.getSurfaceY() + 0.02, chosen.point.z, 3);
      }
      foam.stirAt(chosen.point.x, chosen.point.z, 0, 0, water, 0.5);
    } else {
      // Gentle tap on dry stainless steel bottom
      audio.playDrip(0.75, 0.09);
    }
  }
}

function onPointerMove(e) {
  if (e.pointerId !== activePointerId) return;
  resetIdle();
  setNDCFromEvent(e);

  const dxScreen = e.clientX - pointerDownScreen.x;
  const dyScreen = e.clientY - pointerDownScreen.y;
  pointerMoved = Math.max(pointerMoved, Math.hypot(dxScreen, dyScreen));

  // Always allow popping floating bubbles while swiping across the screen!
  raycaster.setFromCamera(pointerNDC, camera);
  const activeBubbles = foam.bubbles.filter((b) => b.active).map((b) => b.mesh);
  if (activeBubbles.length > 0) {
    const bHits = raycaster.intersectObjects(activeBubbles, false);
    if (bHits.length > 0) {
      foam.popBubble(bHits[0].object.userData.index);
    }
  }

  if (dragMode === 'faucet') {
    // Smooth flow adjustment if dragging up/down on faucet
    if (pointerMoved > 18) {
      const flow = THREE.MathUtils.clamp(0.5 - dyScreen / 130, 0, 1);
      water.targetFlow = flow;
    }
    return;
  }

  if (dragMode === 'stream') {
    if (water.faucetFlow > 0.05) {
      water.spawnSplash(SINK.spoutPos.x, 0.35 + Math.random() * 0.35, SINK.spoutPos.z, 4, 1.45);
      audio.playSplash(0.38);
    }
    return;
  }

  if (dragMode === 'water') {
    dragPlaneHoriz.constant = -(water.level > 0.02 ? water.getSurfaceY() : SINK.bottomY + 0.05);
    if (raycastToPlane(dragPlaneHoriz, intersectPt)) {
      const vx = intersectPt.x - lastWorldPos.x;
      const vz = intersectPt.z - lastWorldPos.z;
      const spd = Math.hypot(vx, vz);

      if (spd > 0.015) {
        if (water.level > 0.02) {
          water.addRipple(intersectPt.x, intersectPt.z, -Math.min(0.068, spd * 0.42), 3);
          foam.stirAt(intersectPt.x, intersectPt.z, vx * 12, vz * 12, water, 0.48);

          if (spd > 0.045) {
            water.spawnSplash(intersectPt.x, water.getSurfaceY(), intersectPt.z, 3, Math.min(1.6, 0.7 + spd * 8));
            audio.playSplash(Math.min(0.85, spd * 6.5));
          }
          // Swishing soapy water with one finger whips up rich foam!
          if (water.soapiness > 0.06 && spd > 0.025) {
            foam.addFoamCluster(
              intersectPt.x,
              water.getSurfaceY() + 0.02,
              intersectPt.z,
              1 + Math.floor(Math.min(4, spd * 24 * water.soapiness))
            );
          }
        }
        // Forgiving: rubbing right over a dirty dish directly with finger in water also scrubs it!
        for (const d of dishMgr.dishes) {
          if (d.inSink && d.state === 'dirty') {
            const dist = Math.hypot(intersectPt.x - d.group.position.x, intersectPt.z - d.group.position.z);
            if (dist < 0.34) {
              dishMgr.scrubDish(d, spd * 0.95, water, foam);
              audio.playScrub(spd * 8, 1 - d.dirtLevel);
            }
          }
        }
        lastWorldPos.copy(intersectPt);
      }
    }
    return;
  }

  if (dragMode === 'sponge') {
    const hoverY = Math.max(0.04, water.getSurfaceY() + 0.01);
    dragPlaneHoriz.constant = -hoverY;
    if (raycastToPlane(dragPlaneHoriz, intersectPt)) {
      const tx = THREE.MathUtils.clamp(intersectPt.x, -1.75, 1.85);
      const tz = THREE.MathUtils.clamp(intersectPt.z, -0.95, 1.15);
      const vx = tx - kitchen.spongeGroup.position.x;
      const vz = tz - kitchen.spongeGroup.position.z;
      const spd = Math.hypot(vx, vz);

      kitchen.spongeGroup.position.x = THREE.MathUtils.lerp(kitchen.spongeGroup.position.x, tx, 0.52);
      kitchen.spongeGroup.position.z = THREE.MathUtils.lerp(kitchen.spongeGroup.position.z, tz, 0.52);

      // Dip into sink basin or glide across counter
      const insideSink = tx > SINK.minX && tx < SINK.maxX && tz > SINK.minZ && tz < SINK.maxZ;
      const targetY = insideSink
        ? Math.max(SINK.bottomY + 0.08, water.level > 0.05 ? water.getSurfaceY() - 0.02 : SINK.bottomY + 0.10)
        : 0.06;
      kitchen.spongeGroup.position.y = THREE.MathUtils.lerp(kitchen.spongeGroup.position.y, targetY, 0.35);

      spongeVel.set(vx, 0, vz);

      if (spd > 0.015) {
        if (insideSink && water.level > 0.02) {
          water.addRipple(tx, tz, -Math.min(0.07, spd * 0.45), 3);
          foam.stirAt(tx, tz, vx * 14, vz * 14, water, 0.52);
          if (spd > 0.05) {
            water.spawnSplash(tx, water.getSurfaceY(), tz, 4, 1.25);
            audio.playSplash(Math.min(0.8, spd * 5.5));
          }
          // Sponge whips up LOTS of lush 3D foam!
          if (water.soapiness > 0.04 || water.level > 0.1) {
            const count = water.soapiness > 0.04 ? Math.ceil(2 + water.soapiness * 3) : 1;
            if (Math.random() < 0.72) {
              foam.addFoamCluster(tx, water.getSurfaceY() + 0.03, tz, count);
            }
          }
        } else if (!insideSink) {
          // Sponge can also push/soak spilled foam on the counter!
          foam.stirAt(tx, tz, vx * 10, vz * 10, water, 0.44);
        }

        // Scrub any dirty dish the sponge passes over!
        for (const d of dishMgr.dishes) {
          if (d.state === 'dirty' && (d.inSink || d.onMat)) {
            const dist = Math.hypot(tx - d.group.position.x, tz - d.group.position.z);
            if (dist < 0.42) {
              dishMgr.scrubDish(d, spd * 1.65, water, foam);
              audio.playScrub(spd * 10, 1 - d.dirtLevel);
              spongeSquish = Math.max(spongeSquish, 0.38);
            }
          }
        }
      }
      lastWorldPos.copy(intersectPt);
    }
    return;
  }

  if (dragMode === 'towel') {
    dragPlaneHoriz.constant = -0.18;
    if (raycastToPlane(dragPlaneHoriz, intersectPt)) {
      const tx = THREE.MathUtils.clamp(intersectPt.x, -1.85, 1.95);
      const tz = THREE.MathUtils.clamp(intersectPt.z, -1.05, 1.18);
      const vx = tx - kitchen.towelGroup.position.x;
      const vz = tz - kitchen.towelGroup.position.z;
      const spd = Math.hypot(vx, vz);

      kitchen.towelGroup.position.x = THREE.MathUtils.lerp(kitchen.towelGroup.position.x, tx, 0.5);
      kitchen.towelGroup.position.z = THREE.MathUtils.lerp(kitchen.towelGroup.position.z, tz, 0.5);
      kitchen.towelGroup.position.y = THREE.MathUtils.lerp(kitchen.towelGroup.position.y, 0.16, 0.35);
      kitchen.towelGroup.rotation.z = THREE.MathUtils.clamp(-vx * 1.4, -0.35, 0.35);
      kitchen.towelGroup.rotation.x = THREE.MathUtils.clamp(vz * 1.4, -0.35, 0.35);

      if (spd > 0.015) {
        // 1. Wipe any clean wet dish!
        for (const d of dishMgr.dishes) {
          if (d.state === 'wet') {
            const dist = Math.hypot(tx - d.group.position.x, tz - d.group.position.z);
            if (dist < 0.52) {
              dishMgr.wipeDish(d, spd * 1.9, foam);
              audio.playWipe(spd * 9);
            }
          }
        }
        // 2. Wipe spilled overflow water puddles & foam right off the marble counter!
        const wipedPuddle = water.wipeCounterAt(tx, tz, spd * 0.42);
        const wipedFoam = foam.wipeSpilledFoamAt(tx, tz, 0.52);
        if (wipedPuddle || wipedFoam) {
          audio.playWipe(spd * 8);
        }
      }
      lastWorldPos.copy(intersectPt);
    }
    return;
  }

  if (dragMode === 'dish' && draggedDish) {
    // Allow seamless 3D dragging BOTH horizontally across sink/towel AND vertically up to the wooden wall shelf!
    const useShelfPlane = pointerNDC.y > 0.08;
    if (useShelfPlane) {
      // Intersect a vertical plane hovering smoothly in front of the shelf & faucet
      dragPlaneVert.constant = 0.72; // z = -0.72
      if (raycastToPlane(dragPlaneVert, intersectPt)) {
        const tx = THREE.MathUtils.clamp(intersectPt.x, -1.65, 1.75);
        const ty = THREE.MathUtils.clamp(intersectPt.y, 0.18, 2.25);
        const tz = THREE.MathUtils.lerp(0.15, SINK.shelfZ + 0.25, THREE.MathUtils.clamp((ty - 0.3) / 1.4, 0, 1));
        draggedDish.group.position.lerp(new THREE.Vector3(tx, ty, tz), 0.45);

        // Gently tilt plates upright as they approach the shelf!
        if (draggedDish.spec.shelfTilted && ty > 0.9) {
          draggedDish.group.rotation.x = THREE.MathUtils.lerp(draggedDish.group.rotation.x, 1.05, 0.2);
        }
      }
    } else {
      dragPlaneHoriz.constant = -0.18;
      if (raycastToPlane(dragPlaneHoriz, intersectPt)) {
        const tx = THREE.MathUtils.clamp(intersectPt.x, -1.55, 1.82);
        const tz = THREE.MathUtils.clamp(intersectPt.z, -0.82, 1.05);
        const prevX = draggedDish.group.position.x;
        const prevZ = draggedDish.group.position.z;

        const insideSink = tx > SINK.minX && tx < SINK.maxX && tz > SINK.minZ && tz < SINK.maxZ;
        const hoverY = insideSink
          ? Math.max(SINK.bottomY + 0.16, water.level > 0.12 ? water.getSurfaceY() + 0.02 : 0.04)
          : 0.16;

        draggedDish.group.position.lerp(new THREE.Vector3(tx, hoverY, tz), 0.48);
        draggedDish.group.rotation.x = THREE.MathUtils.lerp(draggedDish.group.rotation.x, 0.06, 0.2);

        const spd = Math.hypot(tx - prevX, tz - prevZ);

        // Swishing a dish in sink water creates ripples, splashes, and cleans dirty dishes!
        if (insideSink && water.level > 0.06 && spd > 0.015) {
          water.addRipple(tx, tz, -Math.min(0.055, spd * 0.35), 2);
          if (spd > 0.04) audio.playSplash(Math.min(0.6, spd * 5));
          if (draggedDish.state === 'dirty') {
            dishMgr.scrubDish(draggedDish, spd * 1.15, water, foam);
            audio.playScrub(spd * 8, 1 - draggedDish.dirtLevel);
          }
        }

        // Holding dish directly under running faucet stream rinses & sprays!
        if (water.faucetFlow > 0.08) {
          const dStream = Math.hypot(tx - SINK.spoutPos.x, tz - SINK.spoutPos.z);
          if (dStream < 0.34) {
            water.spawnSplash(tx, hoverY + 0.06, tz, 4, 1.35);
            if (draggedDish.state === 'dirty') {
              dishMgr.scrubDish(draggedDish, 0.028, water, foam);
            }
          }
        }

        // Dragging a clean WET dish over the cotton towel on the right dries it directly!
        const distTowel = Math.hypot(tx - SINK.towelHome.x, tz - SINK.towelHome.z);
        if (draggedDish.state === 'wet' && distTowel < 0.62 && spd > 0.012) {
          dishMgr.wipeDish(draggedDish, spd * 1.85, foam);
          audio.playWipe(spd * 9);
          // Make the towel physically nuzzle/flutter as she rubs the dish on it!
          kitchen.towelGroup.rotation.z = Math.sin(performance.now() * 0.03) * 0.16;
        }
      }
    }
  }
}

function onPointerUp(e) {
  if (e.pointerId !== activePointerId) return;
  activePointerId = null;

  if (dragMode === 'sponge') {
    spongeHolding = false;
    // If tapped quickly -> Sponge Squeeze fountain of bubbles & droplets!
    if (pointerMoved < 16) {
      spongeSquish = 1.0;
      const p = kitchen.spongeGroup.position;
      audio.playSplash(0.55);
      water.spawnSplash(p.x, p.y + 0.08, p.z, 12, 1.45);
      foam.addFoamCluster(p.x, p.y + 0.08, p.z, 6, p.z > SINK.maxZ - 0.1);
      foam.spawnFloatingBubble(p.x, p.y + 0.18, p.z, 1.0);
    }
  }

  if (dragMode === 'towel') {
    towelHolding = false;
  }

  if (dragMode === 'dish' && draggedDish) {
    const d = draggedDish;
    draggedDish = null;
    d.isDragged = false;

    const pos = d.group.position;
    const nearShelf = pos.y > 0.78 || pointerNDC.y > 0.24;
    const nearRightMat = pos.x > 0.88;

    if (nearShelf) {
      if (d.state === 'dry') {
        // Spotless & dry -> magnetic smooth glide right onto its oak shelf coaster!
        dishMgr.placeOnShelf(d, foam);
      } else if (d.state === 'wet') {
        // Still wet -> self-explanatory water drip + glides neatly onto the drying mat right by the towel!
        water.spawnSplash(pos.x, pos.y - 0.05, pos.z, 9, 0.9);
        audio.playDrip(1.1, 0.18);
        dishMgr.sendToDryingMat(d, false, foam);
        // Make towel give a cozy inviting wiggle!
        towelAutoRubTimer = 0.45;
      } else {
        // Still dirty -> soft dull thud + gently slides back into sink!
        audio.playSoftThud();
        d.wobbleTime = 0.45;
        dishMgr.returnToSink(d, water);
      }
    } else if (nearRightMat) {
      if (d.state === 'wet') {
        // Dropped a clean wet dish onto the bamboo drying mat/towel!
        // Start a charming cozy cloth rub by the towel so a 5yo succeeds smoothly whether she rubs OR drops it on the towel!
        dishMgr.sendToDryingMat(d, false, foam);
        towelAutoRubDish = d;
        towelAutoRubTimer = 1.15;
      } else if (d.state === 'dry') {
        // Keep clean dry dish sitting neatly on the drying mat ready to lift to shelf!
        dishMgr.sendToDryingMat(d, false, foam);
      } else {
        // Dirty dish dropped on mat -> gently returns to sink
        audio.playSoftThud();
        dishMgr.returnToSink(d, water);
      }
    } else {
      // Released over sink area
      const insideSink = pos.x > SINK.minX - 0.15 && pos.x < SINK.maxX + 0.15 && pos.z > SINK.minZ - 0.15 && pos.z < SINK.maxZ + 0.15;
      if (insideSink) {
        d.inSink = true;
        d.onMat = false;
        d.targetPos.set(
          THREE.MathUtils.clamp(pos.x, SINK.minX + 0.26, SINK.maxX - 0.26),
          d.spec.sinkPos.y,
          THREE.MathUtils.clamp(pos.z, SINK.minZ + 0.22, SINK.maxZ - 0.22)
        );
        if (water.level > 0.08) {
          water.addRipple(pos.x, pos.z, -0.06, 3);
          water.spawnSplash(pos.x, water.getSurfaceY(), pos.z, 10, 1.35);
          audio.playSplash(0.62);
        }
        // If a dry dish is dunked back into water, it becomes wet again! (Real-world physics!)
        if (d.state === 'dry' && water.level > 0.1) {
          d.state = 'wet';
          d.wetness = 1.0;
          d.dropletGroup.visible = true;
          d.dropletGroup.scale.setScalar(1);
        }
      } else {
        dishMgr.returnToSink(d, water);
      }
    }
  }

  dragMode = null;
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// --- Subtle Single-Pass Idle Hint Logic (only after 12s complete inactivity!) ---
function getCurrentStageIndex() {
  if (dishMgr.allShelved()) return 5;
  if (water.level < 0.2 && water.targetFlow < 0.1) return 0; // Turn on faucet
  if (water.soapiness < 0.08 && foam.activeCount < 10) return 1; // Pump soap
  if (dishMgr.dishes.some((d) => d.state === 'dry')) return 4; // Put dry dish on shelf
  if (dishMgr.dishes.some((d) => d.state === 'wet')) return 3; // Wipe wet dish with towel
  return 2; // Scrub dirty dish with sponge
}

function updateIdleHint(dt) {
  if (activePointerId !== null) {
    idleSeconds = 0;
    return;
  }
  idleSeconds += dt;
  const stageIdx = getCurrentStageIndex();

  if (!hintActive && idleSeconds > 12.0 && hintShownForStage !== stageIdx && stageIdx < 5) {
    hintActive = true;
    hintProgress = 0;
    hintShownForStage = stageIdx;
    kitchen.hintHand.visible = true;
  }

  if (hintActive) {
    hintProgress += dt / 2.2;
    if (hintProgress >= 1.0) {
      hintActive = false;
      kitchen.hintHand.visible = false;
      return;
    }
    const alpha = Math.sin(hintProgress * Math.PI) * 0.62;
    kitchen.hintHand.userData.mat.opacity = alpha;

    const p = hintProgress;
    const h = kitchen.hintHand;
    if (stageIdx === 0) {
      // Gently tap faucet lever
      h.position.set(0.24, 0.36 + Math.sin(p * Math.PI * 2) * 0.08, -0.78);
    } else if (stageIdx === 1) {
      // Gently tap soap pump
      h.position.set(SINK.soapPos.x, 0.84 - Math.sin(p * Math.PI) * 0.12, SINK.soapPos.z + 0.1);
    } else if (stageIdx === 2) {
      // Gently glide from sponge to a dirty dish
      const dirty = dishMgr.dishes.find((d) => d.state === 'dirty');
      const target = dirty ? dirty.group.position : new THREE.Vector3(0, 0, 0);
      h.position.lerpVectors(
        new THREE.Vector3(kitchen.spongeGroup.position.x, 0.25, kitchen.spongeGroup.position.z),
        new THREE.Vector3(target.x, 0.22, target.z),
        p
      );
    } else if (stageIdx === 3) {
      // Gently glide from towel to a wet dish (or wet dish to towel)
      const wet = dishMgr.dishes.find((d) => d.state === 'wet');
      const start = wet ? wet.group.position : new THREE.Vector3(0, 0.1, 0);
      h.position.lerpVectors(
        new THREE.Vector3(start.x, 0.22, start.z),
        new THREE.Vector3(SINK.towelHome.x, 0.24, SINK.towelHome.z),
        p
      );
    } else if (stageIdx === 4) {
      // Gently glide from dry dish up to oak shelf
      const dry = dishMgr.dishes.find((d) => d.state === 'dry');
      if (dry) {
        const spot = SINK.coasterSpots[dry.id];
        h.position.lerpVectors(
          new THREE.Vector3(dry.group.position.x, dry.group.position.y + 0.16, dry.group.position.z),
          new THREE.Vector3(spot.x, spot.y + 0.15, spot.z + 0.15),
          p
        );
      }
    }
  }
}

// --- Main Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // 1. Update Core Physical Simulations
  water.update(dt, foam);
  foam.update(dt, water);
  dishMgr.update(dt, water);

  // 2. Articulated Chrome Faucet Lever
  const targetLeverX = -water.faucetFlow * 0.52;
  const targetLeverY = water.faucetFlow * 0.22;
  kitchen.leverPivot.rotation.x += (targetLeverX - kitchen.leverPivot.rotation.x) * Math.min(1, dt * 12);
  kitchen.leverPivot.rotation.y += (targetLeverY - kitchen.leverPivot.rotation.y) * Math.min(1, dt * 12);

  // 3. Soap Pump Press & Glossy Soap Squirt Arc
  if (soapPumpAnim > 0) {
    soapPumpAnim = Math.max(0, soapPumpAnim - dt * 4.5);
    const press = Math.sin(soapPumpAnim * Math.PI);
    kitchen.soapPumpGroup.position.y = 0.64 - press * 0.075;
    kitchen.soapGroup.scale.set(1 + press * 0.03, 1 - press * 0.025, 1 + press * 0.03);
  } else {
    kitchen.soapPumpGroup.position.y = 0.64;
    kitchen.soapGroup.scale.set(1, 1, 1);
  }

  if (soapSquirtAnim > 0) {
    soapSquirtAnim = Math.max(0, soapSquirtAnim - dt * 3.4);
    kitchen.soapSquirtMesh.visible = true;
    kitchen.soapSquirtMesh.material.opacity = Math.sin(soapSquirtAnim * Math.PI) * 0.88;
    const sc = 0.7 + soapSquirtAnim * 0.5;
    kitchen.soapSquirtMesh.scale.set(1, sc, 1);
  } else {
    kitchen.soapSquirtMesh.visible = false;
    kitchen.soapSquirtMesh.material.opacity = 0;
  }

  // 4. Rubber Drain Plug Position (seated in drain vs popped onto back rim!)
  const plugTargetPos = water.isPlugged
    ? new THREE.Vector3(SINK.drainX, SINK.bottomY + 0.012, SINK.drainZ)
    : new THREE.Vector3(SINK.drainX + 0.34, SINK.bottomY + 0.05, SINK.drainZ - 0.34);
  kitchen.plugGroup.position.lerp(plugTargetPos, Math.min(1, dt * 9));
  const plugTargetTilt = water.isPlugged ? 0 : 0.42;
  kitchen.plugGroup.rotation.z += (plugTargetTilt - kitchen.plugGroup.rotation.z) * Math.min(1, dt * 9);

  // 5. Sponge Buoyancy & Elastic Squash-and-Stretch
  if (!spongeHolding) {
    const sp = kitchen.spongeGroup.position;
    const insideSink = sp.x > SINK.minX + 0.05 && sp.x < SINK.maxX - 0.05 && sp.z > SINK.minZ + 0.05 && sp.z < SINK.maxZ - 0.05;
    if (insideSink) {
      const floatY = water.level > 0.06
        ? water.getSurfaceY() - 0.02 + water.getWaveHeightAt(sp.x, sp.z) + Math.sin(t * 2.8) * 0.008
        : SINK.bottomY + 0.04;
      sp.y += (floatY - sp.y) * Math.min(1, dt * 7);
      kitchen.spongeGroup.rotation.x = Math.sin(t * 2.1) * 0.06;
      kitchen.spongeGroup.rotation.z = Math.cos(t * 1.8) * 0.06;
    } else {
      // Settle smoothly on counter/rim
      sp.y += (0.015 - sp.y) * Math.min(1, dt * 8);
      kitchen.spongeGroup.rotation.x *= 0.88;
      kitchen.spongeGroup.rotation.z *= 0.88;
    }
  }
  if (spongeSquish > 0) {
    spongeSquish = Math.max(0, spongeSquish - dt * 3.8);
    const sq = Math.sin(spongeSquish * Math.PI);
    kitchen.spongeInner.scale.set(1 + sq * 0.18, 1 - sq * 0.35, 1 + sq * 0.16);
  } else {
    kitchen.spongeInner.scale.lerp(new THREE.Vector3(1, 1, 1), 0.25);
  }

  // 6. Cotton Towel Home Return & Cozy Auto-Rub when wet dish lands on mat!
  if (!towelHolding) {
    if (towelAutoRubDish && towelAutoRubTimer > 0) {
      towelAutoRubTimer -= dt;
      const dp = towelAutoRubDish.group.position;
      const rubX = dp.x + Math.sin(t * 24) * 0.11;
      const rubZ = dp.z + Math.cos(t * 20) * 0.08;
      kitchen.towelGroup.position.lerp(new THREE.Vector3(rubX, dp.y + 0.13, rubZ), Math.min(1, dt * 16));
      kitchen.towelGroup.rotation.z = Math.sin(t * 24) * 0.22;
      if (towelAutoRubDish.state === 'wet') {
        dishMgr.wipeDish(towelAutoRubDish, dt * 1.45, foam);
        audio.playWipe(0.55);
      }
      if (towelAutoRubTimer <= 0 || towelAutoRubDish.state !== 'wet') {
        towelAutoRubDish = null;
      }
    } else if (towelAutoRubTimer > 0) {
      // Gentle inviting flutter on the towel when a wet dish tried to jump to the shelf
      towelAutoRubTimer -= dt;
      kitchen.towelGroup.position.lerp(SINK.towelHome, Math.min(1, dt * 8));
      kitchen.towelGroup.rotation.z = Math.sin(t * 16) * 0.12 * towelAutoRubTimer;
    } else {
      kitchen.towelGroup.position.lerp(SINK.towelHome, Math.min(1, dt * 8));
      kitchen.towelGroup.rotation.x *= 0.85;
      kitchen.towelGroup.rotation.z *= 0.85;
    }
  }

  // 7. All 5 Dishes Shelved -> Golden Sunbeam World Transformation & Replay Tray!
  if (dishMgr.allShelved()) {
    if (!celebrationPlayed) {
      celebrationPlayed = true;
      celebrationTimer = 4.2;
      audio.playCelebration();
      // Launch festive sunlit iridescent bubbles floating across the kitchen!
      for (let i = 0; i < 9; i++) {
        setTimeout(() => {
          foam.spawnFloatingBubble(
            -1.2 + Math.random() * 2.4,
            0.3 + Math.random() * 0.7,
            -0.3 + Math.random() * 0.5,
            0.95 + Math.random() * 0.5
          );
        }, i * 160);
      }
    }
    if (celebrationTimer > 0) {
      celebrationTimer -= dt;
      const glow = Math.sin((1 - celebrationTimer / 4.2) * Math.PI);
      env.celebrationLight.intensity = glow * 3.8;
      env.sunPatchGroup.children.forEach((p, idx) => {
        p.material.opacity = 0.14 + glow * 0.24;
        p.position.x = (-0.9 + idx * 1.65) + Math.sin(t * 0.8) * 0.25;
      });
    } else {
      env.celebrationLight.intensity *= 0.94;
      if (!replayTrayVisible) {
        replayTrayVisible = true;
        kitchen.replayTray.visible = true;
      }
    }
  } else {
    env.celebrationLight.intensity *= 0.9;
  }

  // Smoothly slide replay dish tray onto left counter edge once unlocked
  const trayTargetX = replayTrayVisible ? -1.48 : -2.65;
  kitchen.replayTray.position.x += (trayTargetX - kitchen.replayTray.position.x) * Math.min(1, dt * 4.5);
  if (replayTrayVisible) {
    kitchen.replayTray.rotation.y = Math.sin(t * 1.5) * 0.08;
  } else if (kitchen.replayTray.position.x < -2.45) {
    kitchen.replayTray.visible = false;
  }

  // 8. Gentle Idle Hint (after 12s inactivity only)
  updateIdleHint(dt);

  renderer.render(scene, camera);
}

animate();
