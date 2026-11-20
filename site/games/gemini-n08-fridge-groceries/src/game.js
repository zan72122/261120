import * as THREE from 'three';
import { WORLD } from './kitchen.js';

export function createGameController({ scene, camera, renderer, fridge, kitchenBundle, bag, groceries, audio }) {
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const tmpVec = new THREE.Vector3();
  const tmpVec2 = new THREE.Vector3();
  const tmpWorld = new THREE.Vector3();

  // State
  let activePointerId = null;
  let draggedItem = null;
  let dragStartPos = new THREE.Vector2();
  let dragStartTime = 0;
  let hasMoved = false;
  let dragTargetWorld = new THREE.Vector3();
  let prevDragWorld = new THREE.Vector3();
  let dragVel = new THREE.Vector3();

  // Milk pouring & handover state
  let milkFill = 0.0;
  let isPouring = false;
  let autoPourTimer = 0.0;
  let pourOverflew = false;
  let handoverPhase = 'idle'; // 'idle' | 'offering' | 'drinking' | 'returning' | 'done'
  let handoverT = 0.0;
  let storedCount = 0;
  let lastInteractionTime = performance.now() / 1000;
  let idleHintStep = 0;
  let bagBounce = 0.0;
  let doorOpen = true;
  let crisperOpen = true;

  // Dynamic camera override for warm first-person milk handover moment
  const baseCamPos = new THREE.Vector3();
  const baseCamTarget = new THREE.Vector3();
  const curCamPos = new THREE.Vector3();
  const curCamTarget = new THREE.Vector3();
  let camInitialized = false;

  // --- 1. DYNAMIC POURING MILK STREAM & SPLASH DROPLETS ---
  const pourMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fffdf8'),
    roughness: 0.14,
    metalness: 0.0,
    envMapIntensity: 0.85,
  });
  // Unit-length vertical cylinder deformed smoothly into pouring arc
  const streamGeo = new THREE.CylinderGeometry(0.0042, 0.0052, 1.0, 12, 10);
  streamGeo.translate(0, -0.5, 0);
  const milkStream = new THREE.Mesh(streamGeo, pourMat);
  milkStream.visible = false;
  milkStream.renderOrder = 5;
  scene.add(milkStream);

  // Tiny playful milk splash droplets at liquid impact point
  const droplets = [];
  const dropGeo = new THREE.SphereGeometry(0.0028, 8, 8);
  for (let i = 0; i < 8; i++) {
    const d = new THREE.Mesh(dropGeo, pourMat);
    d.visible = false;
    d.userData = { vel: new THREE.Vector3(), life: 0, phase: i * 0.4 };
    scene.add(d);
    droplets.push(d);
  }

  // Subtle playful milk-spill coaster droplet (only appears if child delightfully overflows the glass!)
  const spillDrop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.020, 0.0014, 16),
    pourMat
  );
  spillDrop.position.set(kitchenBundle.glassHome.x - 0.032, kitchenBundle.glassHome.y + 0.001, kitchenBundle.glassHome.z + 0.025);
  spillDrop.scale.set(0.01, 1, 0.01);
  spillDrop.visible = false;
  scene.add(spillDrop);

  // --- 2. HELPER: EGG CARTON LID TARGET ---
  const eggItem = groceries.find((g) => g.id === 'eggs');
  let eggLidAngle = -2.92;
  let eggLidTarget = -2.92;

  // --- 3. POINTER UTILITIES ---
  function updatePointerNDC(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findGroceryAtPointer() {
    raycaster.setFromCamera(pointerNDC, camera);
    // 1. Direct mesh raycast against all grocery roots
    const roots = groceries.map((g) => g.root);
    const hits = raycaster.intersectObjects(roots, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.name.startsWith('grocery_')) obj = obj.parent;
      if (obj) {
        const found = groceries.find((g) => g.root === obj);
        if (found) return found;
      }
    }
    // 2. Generous 5-year-old-friendly screen-space proximity fallback (within ~44px!)
    let best = null;
    let bestDist = 0.14; // normalized screen distance
    for (const item of groceries) {
      item.root.getWorldPosition(tmpWorld);
      tmpWorld.y += item.height * 0.45;
      tmpWorld.project(camera);
      const d = Math.hypot(tmpWorld.x - pointerNDC.x, (tmpWorld.y - pointerNDC.y) * (camera.aspect || 1));
      if (d < bestDist) {
        bestDist = d;
        best = item;
      }
    }
    return best;
  }

  function isPointerNearGlass(radiusNDC = 0.15) {
    kitchenBundle.glass.group.getWorldPosition(tmpWorld);
    tmpWorld.y += 0.065;
    tmpWorld.project(camera);
    const d = Math.hypot(tmpWorld.x - pointerNDC.x, (tmpWorld.y - pointerNDC.y) * (camera.aspect || 1));
    return d < radiusNDC;
  }

  // Determine the intuitive 3D drop/drag zone from pointer ray!
  function resolvePointerZone(item) {
    raycaster.setFromCamera(pointerNDC, camera);
    const ray = raycaster.ray;

    // A. Check if holding MILK over the CLEAR DRINKING GLASS -> pouring position!
    if (item && item.id === 'milk' && handoverPhase === 'idle' && isPointerNearGlass(0.22)) {
      const gh = kitchenBundle.glassHome;
      // With rotZ = -1.78 rad, spout at local (0, +0.215, 0) reaches world (+0.210, -0.045, 0) from base!
      // Place base at (gh.x - 0.212, gh.y + 0.215, gh.z) so spout sits DEAD-CENTER 5cm above glass rim!
      return {
        zone: 'pour_glass',
        point: new THREE.Vector3(gh.x - 0.212, gh.y + 0.215, gh.z),
      };
    }

    // B. Check Right-Side Swinging Door Pockets (when door is open!)
    if (fridge.getDoorAngle() > 0.75) {
      // Intersect ray with a plane aligned to the open door's inner pocket centerline
      const doorOrigin = new THREE.Vector3();
      fridge.doorPivot.getWorldPosition(doorOrigin);
      // Door pocket plane normal in doorPivot local space is (0, 0, -1)
      const localNormal = new THREE.Vector3(0, 0, -1).applyQuaternion(fridge.doorPivot.quaternion);
      const localMid = new THREE.Vector3(-0.31, 0.25, -0.055).applyMatrix4(fridge.doorPivot.matrixWorld);
      const doorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(localNormal, localMid);
      const hitDoor = new THREE.Vector3();
      if (ray.intersectPlane(doorPlane, hitDoor)) {
        const localHit = fridge.doorPivot.worldToLocal(hitDoor.clone());
        // Check if within door pocket width & height bounds
        if (localHit.x > -0.58 && localHit.x < -0.04 && localHit.y > 0.02 && localHit.y < 0.64) {
          // Pick lower pocket (tall milk/beverage) or upper pocket (small citrus/fruit)
          const pocketIdx = (item && item.id === 'milk') ? 0 : (localHit.y > 0.31 ? 1 : 0);
          const p = fridge.pockets[pocketIdx];
          const clampedX = THREE.MathUtils.clamp(localHit.x, p.minLocalX, p.maxLocalX);
          const targetLocal = new THREE.Vector3(clampedX, p.localY + 0.025, p.localZ);
          return {
            zone: p.id,
            pocket: p,
            localPoint: new THREE.Vector3(clampedX, p.localY, p.localZ),
            point: targetLocal.applyMatrix4(fridge.doorPivot.matrixWorld),
          };
        }
      }
    }

    // C. Check Refrigerator Interior Cavity (shelves + crisper) when door is open!
    if (fridge.getDoorAngle() > 0.55) {
      const fridgePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.14); // Z = -0.14 mid-cavity plane
      const hitFridge = new THREE.Vector3();
      if (ray.intersectPlane(fridgePlane, hitFridge)) {
        const minX = WORLD.fridgeCenterX - 0.265;
        const maxX = WORLD.fridgeCenterX + 0.265;
        if (hitFridge.x >= minX && hitFridge.x <= maxX && hitFridge.y >= -0.06 && hitFridge.y <= 0.68) {
          const cx = THREE.MathUtils.clamp(hitFridge.x, minX + 0.03, maxX - 0.03);
          // Crisper drawer zone (lower cavity)
          if (hitFridge.y < 0.145) {
            const cb = fridge.crisperBounds;
            const slide = fridge.getCrisperSlide();
            return {
              zone: 'crisper',
              point: new THREE.Vector3(
                THREE.MathUtils.clamp(cx, cb.minX, cb.maxX),
                cb.y + 0.075,
                THREE.MathUtils.clamp(-0.08 + slide, cb.minZ + slide, cb.maxZ + slide)
              ),
            };
          }
          // Snap cleanly to whichever glass shelf height the pointer is over!
          let chosenShelf = fridge.shelves[0];
          if (hitFridge.y >= 0.50) chosenShelf = fridge.shelves[2];
          else if (hitFridge.y >= 0.30) chosenShelf = fridge.shelves[1];
          else chosenShelf = fridge.shelves[0];

          return {
            zone: chosenShelf.id,
            shelf: chosenShelf,
            point: new THREE.Vector3(
              THREE.MathUtils.clamp(cx, chosenShelf.minX, chosenShelf.maxX),
              chosenShelf.y + 0.045,
              THREE.MathUtils.clamp(-0.14, chosenShelf.minZ, chosenShelf.maxZ)
            ),
          };
        }
      }
    }

    // D. Default: Foreground Wooden Kitchen Countertop!
    const counterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.055);
    const hitCounter = new THREE.Vector3();
    if (ray.intersectPlane(counterPlane, hitCounter)) {
      return {
        zone: 'counter',
        point: new THREE.Vector3(
          THREE.MathUtils.clamp(hitCounter.x, -0.34, 0.19),
          0.065,
          THREE.MathUtils.clamp(hitCounter.z, 0.44, 0.86)
        ),
      };
    }
    return { zone: 'counter', point: new THREE.Vector3(0.0, 0.065, 0.66) };
  }

  // --- 4. START HANDOVER CINEMATIC (OFFER FULL GLASS OF MILK TO SOMEONE!) ---
  function startHandover() {
    if (handoverPhase !== 'idle' || milkFill < 0.45) return;
    handoverPhase = 'offering';
    handoverT = 0.0;
    audio.playHandoverDrink();
  }

  // Reset / Unpack a brand-new grocery shopping bag (seamless endless replayability!)
  function refillFreshGroceries() {
    handoverPhase = 'idle';
    handoverT = 0;
    milkFill = 0;
    pourOverflew = false;
    spillDrop.visible = false;
    kitchenBundle.glass.setFillLevel(0);
    kitchenBundle.glass.group.position.copy(kitchenBundle.glassHome);
    kitchenBundle.glass.group.rotation.set(0, 0, 0);

    doorOpen = true;
    fridge.setDoorTarget(1.74);
    crisperOpen = true;
    fridge.setCrisperTarget(0.095);

    audio.playBagRustle();
    bagBounce = 1.0;

    for (const item of groceries) {
      scene.attach(item.root);
      item.zone = 'counter';
      item.state = 'counter';
      item.root.position.copy(item.homePos);
      item.root.position.y += 0.06; // gentle playful drop onto counter!
      item.root.rotation.set(0, item.homeRotY, 0);
      item.meshGroup.rotation.set(0, 0, 0);
      item.vel.set(0, -0.4, 0);
      item.angVel.set(0, 0, 0);
    }
    eggLidTarget = -2.92;
    storedCount = 0;
  }

  // --- 5. SINGLE-FINGER POINTER EVENTS ---
  function onPointerDown(e) {
    if (activePointerId !== null) return; // ignore multi-touch extra fingers gracefully!
    activePointerId = e.pointerId;
    audio.unlock();
    lastInteractionTime = performance.now() / 1000;
    idleHintStep = 0;
    updatePointerNDC(e);
    dragStartPos.set(e.clientX, e.clientY);
    dragStartTime = performance.now();
    hasMoved = false;

    if (handoverPhase !== 'idle' && handoverPhase !== 'done') return;

    // 1. If handover is done & child taps glass or shopping bag -> bring fresh groceries!
    if (handoverPhase === 'done') {
      raycaster.setFromCamera(pointerNDC, camera);
      const hitGlass = isPointerNearGlass(0.18);
      const hitBag = raycaster.intersectObject(bag, true).length > 0;
      if (hitGlass || hitBag) {
        refillFreshGroceries();
        activePointerId = null;
        return;
      }
    }

    // 2. If glass is filled with milk and child taps/touches the glass -> Hand it to someone!
    if (milkFill >= 0.45 && isPointerNearGlass(0.16) && handoverPhase === 'idle') {
      startHandover();
      activePointerId = null;
      return;
    }

    // 3. Try picking up any grocery item!
    const picked = findGroceryAtPointer();
    if (picked) {
      draggedItem = picked;
      scene.attach(picked.root);
      picked.state = 'dragging';
      picked.vel.set(0, 0, 0);
      picked.angVel.set(0, 0, 0);
      picked.root.getWorldPosition(prevDragWorld);
      dragTargetWorld.copy(prevDragWorld);
      dragTargetWorld.y += 0.05;
      audio.playPickup(picked.category);

      // If grabbing a vegetable, gently open the crisper drawer in anticipation!
      if (picked.category === 'veg' && doorOpen) {
        crisperOpen = true;
        fridge.setCrisperTarget(0.155);
      }
      return;
    }

    // 4. Direct interactive world objects (zero decoration-only dead objects!)
    raycaster.setFromCamera(pointerNDC, camera);

    // 4a. Tap the clear empty glass -> gentle crystalline clink!
    if (isPointerNearGlass(0.14)) {
      audio.playGlassClink();
      // If all other groceries are stored & milk is handy, tapping empty glass invites pouring!
      const milkItem = groceries.find((g) => g.id === 'milk');
      if (milkItem && milkFill < 0.92 && storedCount >= 6) {
        // Gentle auto-pour invitation if she taps the empty glass after putting groceries away!
        scene.attach(milkItem.root);
        milkItem.state = 'pouring';
        isPouring = true;
        autoPourTimer = 2.6;
      }
      activePointerId = null;
      return;
    }

    // 4b. Tap the Kraft Paper Shopping Bag -> rustles & bounces remaining items inside!
    if (raycaster.intersectObject(bag, true).length > 0) {
      audio.playBagRustle();
      bagBounce = 1.0;
      for (const g of groceries) {
        if (g.zone === 'counter' && g.root.position.y > 0.05) {
          g.vel.y = 0.85;
        }
      }
      activePointerId = null;
      return;
    }

    // 4c. Tap the Vegetable Crisper Drawer -> glides smoothly open / closed!
    if (doorOpen && raycaster.intersectObject(fridge.crisperGroup, true).length > 0) {
      crisperOpen = !crisperOpen;
      fridge.setCrisperTarget(crisperOpen ? 0.16 : 0.0);
      audio.playCrisper(crisperOpen);
      // Give veggies resting inside the drawer subtle real rolling inertia!
      for (const g of groceries) {
        if (g.zone === 'crisper' && g.rollable) {
          g.vel.z += crisperOpen ? -0.18 : 0.18;
        }
      }
      activePointerId = null;
      return;
    }

    // 4d. Tap the Swinging Stainless Fridge Door -> swings closed (LED off!) or open (LED on!)
    if (raycaster.intersectObject(fridge.doorPivot, true).length > 0) {
      doorOpen = !doorOpen;
      fridge.setDoorTarget(doorOpen ? 1.74 : 0.0);
      if (!doorOpen) {
        crisperOpen = false;
        fridge.setCrisperTarget(0.0);
      }
      audio.playDoor(!doorOpen);
      activePointerId = null;
      return;
    }
  }

  function onPointerMove(e) {
    if (e.pointerId !== activePointerId) return;
    lastInteractionTime = performance.now() / 1000;
    updatePointerNDC(e);

    const movedPx = Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y);
    if (movedPx > 10) hasMoved = true;

    if (!draggedItem) return;

    const resolved = resolvePointerZone(draggedItem);
    dragTargetWorld.copy(resolved.point);

    // Auto-open crisper when dragging ANY item down near the crisper zone!
    if (resolved.zone === 'crisper' && !crisperOpen) {
      crisperOpen = true;
      fridge.setCrisperTarget(0.16);
      audio.playCrisper(true);
    }

    // Live pouring when dragging the Milk Carton over the Clear Glass!
    if (resolved.zone === 'pour_glass') {
      isPouring = true;
      autoPourTimer = 0;
    } else if (draggedItem.id === 'milk') {
      isPouring = false;
    }
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    lastInteractionTime = performance.now() / 1000;

    if (!draggedItem) return;
    const item = draggedItem;
    draggedItem = null;

    const elapsed = performance.now() - dragStartTime;

    // Quick tap (no drag) special tactile actions!
    if (!hasMoved && elapsed < 280) {
      if (item.id === 'eggs') {
        // Flip the molded egg carton lid open / closed!
        const currentlyOpen = eggLidTarget < -1.0;
        eggLidTarget = currentlyOpen ? 0.0 : -2.92;
        audio.playEggLid(!currentlyOpen);
        item.state = item.zone === 'counter' ? 'counter' : 'stored';
        return;
      }
      if (item.id === 'milk' && storedCount >= 6 && milkFill < 0.92 && handoverPhase === 'idle') {
        // After groceries are put away, even a gentle tap on the milk carton smoothly pours milk into the glass!
        item.state = 'pouring';
        isPouring = true;
        autoPourTimer = 2.6;
        return;
      }
    }

    // If releasing milk right while pouring -> gently return milk beside glass & stop stream
    if (item.id === 'milk' && isPouring) {
      isPouring = false;
      audio.updatePour(false, milkFill);
      item.zone = 'counter';
      item.state = 'counter';
      item.root.rotation.set(0, -0.22, 0);
      item.root.position.set(0.012, 0.04, 0.605);
      item.vel.set(0, -0.3, 0);
      return;
    }

    // Determine landing zone cleanly
    const resolved = resolvePointerZone(item);
    if (resolved.zone === 'door_pocket_lower' || resolved.zone === 'door_pocket_upper') {
      // Reparent directly to swinging fridge door so it rides inside the pocket!
      fridge.doorPivot.attach(item.root);
      item.zone = resolved.zone;
      item.state = 'stored';
      item.pocketRef = resolved.pocket;
      item.root.position.copy(resolved.localPoint);
      item.root.position.y += 0.035;
      item.root.rotation.set(0, 0, 0);
      item.meshGroup.rotation.set(0, 0, 0);
      item.vel.set(0, -0.5, 0);
      audio.playLand(item.category, 'pocket', 0.9);
      updateStoredProgress();
    } else if (resolved.zone === 'crisper') {
      // Reparent directly to sliding crisper drawer!
      fridge.crisperGroup.attach(item.root);
      item.zone = 'crisper';
      item.state = 'stored';
      item.root.position.y = Math.max(item.root.position.y, fridge.crisperBounds.y + 0.05);
      item.vel.set(
        THREE.MathUtils.clamp(dragVel.x * 0.35, -0.55, 0.55),
        -0.45,
        THREE.MathUtils.clamp(dragVel.z * 0.35, -0.45, 0.45)
      );
      updateStoredProgress();
    } else if (resolved.zone.startsWith('shelf_')) {
      scene.attach(item.root);
      item.zone = resolved.zone;
      item.shelfRef = resolved.shelf;
      item.state = 'stored';
      item.vel.set(
        THREE.MathUtils.clamp(dragVel.x * 0.45, -0.65, 0.65),
        -0.35,
        THREE.MathUtils.clamp(dragVel.z * 0.35, -0.45, 0.45)
      );
      updateStoredProgress();
    } else {
      scene.attach(item.root);
      item.zone = 'counter';
      item.state = 'counter';
      item.vel.set(
        THREE.MathUtils.clamp(dragVel.x * 0.45, -0.7, 0.7),
        -0.35,
        THREE.MathUtils.clamp(dragVel.z * 0.45, -0.55, 0.55)
      );
      updateStoredProgress();
    }
  }

  function updateStoredProgress() {
    const prev = storedCount;
    storedCount = groceries.filter((g) => g.zone !== 'counter').length;
    if (storedCount > prev) {
      audio.playSettleHappy(storedCount);
    }
  }

  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // --- 6. PHYSICS + POURING + HANDOVER UPDATE LOOP ---
  function getSurfaceFloorY(item) {
    if (item.zone === 'counter') {
      // Keep items still tucked inside the Kraft bag resting naturally at bag rim height if still over the bag!
      const dx = item.root.position.x - bag.position.x;
      const dz = item.root.position.z - bag.position.z;
      if (Math.abs(dx) < 0.095 && Math.abs(dz) < 0.062 && item.root.position.y > 0.09) {
        return 0.135;
      }
      return 0.0;
    }
    if (item.zone === 'crisper') return fridge.crisperBounds.y;
    if (item.zone.startsWith('shelf_') && item.shelfRef) return item.shelfRef.y;
    if (item.zone.startsWith('door_pocket_') && item.pocketRef) return item.pocketRef.localY;
    return 0.0;
  }

  function getZoneBounds(item) {
    if (item.zone === 'counter') {
      return { minX: -0.35, maxX: 0.20, minZ: 0.43, maxZ: 0.87 };
    }
    if (item.zone === 'crisper') {
      const cb = fridge.crisperBounds;
      return { minX: cb.minX, maxX: cb.maxX, minZ: cb.minZ, maxZ: cb.maxZ };
    }
    if (item.zone.startsWith('shelf_') && item.shelfRef) {
      return item.shelfRef;
    }
    if (item.zone.startsWith('door_pocket_') && item.pocketRef) {
      return {
        minX: item.pocketRef.minLocalX,
        maxX: item.pocketRef.maxLocalX,
        minZ: item.pocketRef.localZ - 0.015,
        maxZ: item.pocketRef.localZ + 0.015,
      };
    }
    return { minX: -0.35, maxX: 0.20, minZ: 0.43, maxZ: 0.87 };
  }

  function updatePhysics(dt, nowSec) {
    // Smooth egg carton lid hinge animation
    if (eggItem && eggItem.meshGroup.userData.lidPivot) {
      eggLidAngle += (eggLidTarget - eggLidAngle) * (1 - Math.exp(-11 * dt));
      eggItem.meshGroup.userData.lidPivot.rotation.x = eggLidAngle;
    }

    // Playful Kraft paper bag squish-bounce when tapped
    if (bagBounce > 0.001) {
      bagBounce = Math.max(0, bagBounce - dt * 3.8);
      const s = 1 + Math.sin(bagBounce * Math.PI * 2.5) * 0.035 * bagBounce;
      bag.scale.set(s, 1 / Math.sqrt(s), s);
    } else {
      bag.scale.set(1, 1, 1);
    }

    // Update fridge compressor hum softly with door angle
    audio.setFridgeHum(THREE.MathUtils.clamp(fridge.getDoorAngle() / 1.7, 0, 1));

    // A. Dragged Item smooth first-person hand carry + velocity tracking
    if (draggedItem) {
      const k = 1 - Math.exp(-18 * dt);
      prevDragWorld.copy(draggedItem.root.position);
      draggedItem.root.position.lerp(dragTargetWorld, k);
      dragVel.subVectors(draggedItem.root.position, prevDragWorld).divideScalar(Math.max(dt, 0.008));

      // Natural wrist tilt while carrying (or graceful pouring tilt when milk is over the glass!)
      if (draggedItem.id === 'milk' && isPouring) {
        draggedItem.root.rotation.z += (-1.78 - draggedItem.root.rotation.z) * (1 - Math.exp(-9 * dt));
        draggedItem.root.rotation.x += (0.0 - draggedItem.root.rotation.x) * (1 - Math.exp(-9 * dt));
        draggedItem.root.rotation.y += (0.0 - draggedItem.root.rotation.y) * (1 - Math.exp(-9 * dt));
      } else {
        const tiltZ = THREE.MathUtils.clamp(-dragVel.x * 0.22, -0.32, 0.32);
        const tiltX = THREE.MathUtils.clamp(dragVel.z * 0.18, -0.25, 0.25);
        draggedItem.root.rotation.z += (tiltZ - draggedItem.root.rotation.z) * (1 - Math.exp(-12 * dt));
        draggedItem.root.rotation.x += (tiltX - draggedItem.root.rotation.x) * (1 - Math.exp(-12 * dt));
      }
      // Fade contact shadow smoothly while lifted in the air
      draggedItem.shadowMat.opacity = 0.12;
    }

    // B. Auto-pour milk carton animation (when tapped cleanly after storing groceries)
    const milkItem = groceries.find((g) => g.id === 'milk');
    if (milkItem && milkItem.state === 'pouring') {
      const gh = kitchenBundle.glassHome;
      const pourPos = new THREE.Vector3(gh.x - 0.212, gh.y + 0.215, gh.z);
      milkItem.root.position.lerp(pourPos, 1 - Math.exp(-8 * dt));
      milkItem.root.rotation.z += (-1.78 - milkItem.root.rotation.z) * (1 - Math.exp(-8 * dt));
      milkItem.root.rotation.x += (0.0 - milkItem.root.rotation.x) * (1 - Math.exp(-8 * dt));
      milkItem.root.rotation.y += (0.0 - milkItem.root.rotation.y) * (1 - Math.exp(-8 * dt));
      milkItem.shadowMat.opacity = 0.12;
      autoPourTimer -= dt;
      if (autoPourTimer <= 0 || milkFill >= 0.96) {
        isPouring = false;
        milkItem.state = 'counter';
        milkItem.zone = 'counter';
        milkItem.root.position.set(0.022, 0.02, 0.562);
        milkItem.root.rotation.set(0, -0.18, 0);
        audio.updatePour(false, milkFill);
      }
    }

    // C. Active Milk Stream + Rising Level + Playful Foam Overflow!
    if (isPouring && milkItem && handoverPhase === 'idle') {
      const tiltReady = Math.abs(milkItem.root.rotation.z) > 1.35;
      if (tiltReady) {
        milkFill = Math.min(1.06, milkFill + dt * 0.38);
        kitchenBundle.glass.setFillLevel(Math.min(1.0, milkFill));
        audio.updatePour(true, Math.min(1.0, milkFill));

        // Position pouring stream from tilted carton spout dead-center down into rising milk meniscus!
        const gh = kitchenBundle.glassHome;
        milkItem.root.updateMatrixWorld(true);
        const spoutWorld = new THREE.Vector3(-0.015, 0.212, 0.0).applyMatrix4(milkItem.root.matrixWorld);
        const surfaceY = gh.y + 0.016 + 0.088 * Math.min(1.0, milkFill);
        const startY = Math.max(surfaceY + 0.025, spoutWorld.y);

        const streamLen = Math.max(0.02, startY - surfaceY);
        milkStream.visible = true;
        milkStream.position.set(gh.x, startY, gh.z);
        const wobble = 1.0 + 0.12 * Math.sin(nowSec * 38);
        milkStream.scale.set(wobble, streamLen, wobble);

        // Animate tiny splash droplets bouncing gently on the creamy surface!
        for (const d of droplets) {
          d.visible = true;
          const ph = (nowSec * 6.5 + d.userData.phase) % 1.0;
          const ang = d.userData.phase * 9.0;
          const r = 0.005 + ph * 0.022;
          d.position.set(
            gh.x + Math.cos(ang) * r,
            surfaceY + Math.sin(ph * Math.PI) * 0.018,
            gh.z + Math.sin(ang) * r
          );
          d.scale.setScalar(1.0 - ph * 0.6);
        }

        // Playful safe overflow foam droplet onto linen coaster if held past full!
        if (milkFill > 1.01 && !pourOverflew) {
          pourOverflew = true;
          spillDrop.visible = true;
        }
        if (pourOverflew) {
          spillDrop.scale.x += (1.0 - spillDrop.scale.x) * (1 - Math.exp(-4 * dt));
          spillDrop.scale.z = spillDrop.scale.x;
        }
      }
    } else {
      milkStream.visible = false;
      for (const d of droplets) d.visible = false;
      audio.updatePour(false, milkFill);
    }

    // D. Gravity, Rolling, Stacking, Toppling & Elastic Bumps for all non-dragged groceries!
    for (const item of groceries) {
      if (item === draggedItem || item.state === 'pouring') continue;

      const floorBase = getSurfaceFloorY(item);
      let supportY = floorBase;
      let restingOnItem = null;

      // Check stacking on top of another settled item in the same zone!
      for (const other of groceries) {
        if (other === item || other === draggedItem || other.zone !== item.zone) continue;
        const dx = item.root.position.x - other.root.position.x;
        const dz = item.root.position.z - other.root.position.z;
        const horizDist = Math.hypot(dx, dz);
        const combinedR = (item.radius + other.radius) * 0.85;

        // If item is above the other item and overlapping horizontally -> stack or topple!
        if (item.root.position.y >= other.root.position.y + other.height * 0.52 && horizDist < combinedR * 0.72) {
          const canStack = other.stackable || (other.id === 'eggs' && eggLidTarget > -0.5);
          if (canStack && horizDist < combinedR * 0.48) {
            const topY = other.root.position.y + other.height * 0.88;
            if (topY > supportY) {
              supportY = topY;
              restingOnItem = other;
            }
          } else if (horizDist > 0.002) {
            // Natural off-center topple / roll off!
            const push = 0.55 * dt;
            item.vel.x += (dx / horizDist) * push;
            item.vel.z += (dz / horizDist) * push;
          }
        }
      }

      // Gravity & landing bounce
      if (item.root.position.y > supportY + 0.001 || item.vel.y > 0) {
        item.vel.y -= 9.6 * dt;
        item.root.position.y += item.vel.y * dt;
        if (item.root.position.y <= supportY) {
          const impactSpeed = Math.abs(item.vel.y);
          item.root.position.y = supportY;
          if (impactSpeed > 0.35) {
            const surfaceType = item.zone.startsWith('shelf_')
              ? 'shelf'
              : item.zone.startsWith('door_pocket_')
                ? 'pocket'
                : item.zone;
            audio.playLand(item.category, surfaceType, impactSpeed * 0.85);
            const bounce = item.rollable ? 0.24 : 0.08;
            item.vel.y = impactSpeed * bounce;
            if (item.vel.y < 0.14) item.vel.y = 0;
          } else {
            item.vel.y = 0;
          }
        }
      } else {
        item.root.position.y = supportY;
        item.vel.y = 0;
      }

      // Horizontal rolling & friction
      item.root.position.x += item.vel.x * dt;
      item.root.position.z += item.vel.z * dt;

      const isOnGlass = item.zone.startsWith('shelf_');
      const friction = item.rollable ? (isOnGlass ? 0.962 : 0.915) : 0.82;
      const damp = Math.pow(friction, dt * 60);
      item.vel.x *= damp;
      item.vel.z *= damp;
      if (Math.abs(item.vel.x) < 0.003) item.vel.x = 0;
      if (Math.abs(item.vel.z) < 0.003) item.vel.z = 0;

      // Authentic visual rolling rotation proportional to horizontal velocity!
      if (item.rollable && (Math.abs(item.vel.x) > 0.004 || Math.abs(item.vel.z) > 0.004)) {
        const r = Math.max(0.03, item.radius);
        item.meshGroup.rotation.z -= (item.vel.x * dt) / r;
        item.meshGroup.rotation.x += (item.vel.z * dt) / r;
      } else if (!item.rollable) {
        // Upright items settle cleanly upright
        item.root.rotation.x *= Math.pow(0.82, dt * 60);
        item.root.rotation.z *= Math.pow(0.82, dt * 60);
      }

      // Keep inside surface bounds with soft wall bounce!
      const b = getZoneBounds(item);
      if (item.root.position.x < b.minX) {
        item.root.position.x = b.minX;
        if (Math.abs(item.vel.x) > 0.08) audio.playBump(Math.abs(item.vel.x));
        item.vel.x = Math.abs(item.vel.x) * 0.42;
      } else if (item.root.position.x > b.maxX) {
        item.root.position.x = b.maxX;
        if (Math.abs(item.vel.x) > 0.08) audio.playBump(Math.abs(item.vel.x));
        item.vel.x = -Math.abs(item.vel.x) * 0.42;
      }
      if (item.root.position.z < b.minZ) {
        item.root.position.z = b.minZ;
        if (Math.abs(item.vel.z) > 0.08) audio.playBump(Math.abs(item.vel.z));
        item.vel.z = Math.abs(item.vel.z) * 0.42;
      } else if (item.root.position.z > b.maxZ) {
        item.root.position.z = b.maxZ;
        if (Math.abs(item.vel.z) > 0.08) audio.playBump(Math.abs(item.vel.z));
        item.vel.z = -Math.abs(item.vel.z) * 0.42;
      }

      // Soft contact shadow grounded right at support height!
      const lift = Math.max(0, item.root.position.y - supportY);
      item.shadow.position.y = Math.max(0.0012 - lift, -lift + 0.0012);
      item.shadowMat.opacity = restingOnItem ? 0.35 : THREE.MathUtils.clamp(0.65 - lift * 3.5, 0.08, 0.65);
    }

    // E. Pairwise Horizontal Soft Collisions (so rolling apples gently bump & scatter pears/onions!)
    for (let i = 0; i < groceries.length; i++) {
      const a = groceries[i];
      if (a === draggedItem || a.state === 'pouring') continue;
      for (let j = i + 1; j < groceries.length; j++) {
        const b = groceries[j];
        if (b === draggedItem || b.state === 'pouring' || a.zone !== b.zone) continue;
        if (Math.abs(a.root.position.y - b.root.position.y) > Math.min(a.height, b.height) * 0.6) continue;

        const dx = b.root.position.x - a.root.position.x;
        const dz = b.root.position.z - a.root.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = (a.radius + b.radius) * 0.88;
        if (dist > 0.0005 && dist < minDist) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = (minDist - dist) * 0.5;
          a.root.position.x -= nx * overlap;
          a.root.position.z -= nz * overlap;
          b.root.position.x += nx * overlap;
          b.root.position.z += nz * overlap;

          // Elastic velocity impulse exchange
          const relVx = b.vel.x - a.vel.x;
          const relVz = b.vel.z - a.vel.z;
          const sepVel = relVx * nx + relVz * nz;
          if (sepVel < 0) {
            const imp = -sepVel * 0.65;
            a.vel.x -= nx * imp;
            a.vel.z -= nz * imp;
            b.vel.x += nx * imp;
            b.vel.z += nz * imp;
            if (Math.abs(sepVel) > 0.09) audio.playBump(Math.abs(sepVel));
          }
        }
      }
    }

    // F. First-Person Milk Handover Cinematic Sequence ("最後にグラスに牛乳を注いで誰かに渡す")
    const gObj = kitchenBundle.glass.group;
    const gh = kitchenBundle.glassHome;
    if (handoverPhase === 'offering') {
      handoverT += dt;
      const p = THREE.MathUtils.smoothstep(handoverT, 0, 0.95);
      // Lift glass smoothly toward upper-right sunlit dining edge (first-person offering gesture!)
      gObj.position.set(
        THREE.MathUtils.lerp(gh.x, gh.x + 0.09, p),
        THREE.MathUtils.lerp(gh.y, gh.y + 0.24, p),
        THREE.MathUtils.lerp(gh.z, gh.z + 0.16, p)
      );
      gObj.rotation.z = -0.08 * p;
      if (handoverT >= 0.95) {
        handoverPhase = 'drinking';
        handoverT = 0;
      }
    } else if (handoverPhase === 'drinking') {
      handoverT += dt;
      // Glass lifts gently up toward the recipient & tilts as they take 3 warm happy sips!
      const sip = THREE.MathUtils.clamp(handoverT / 1.85, 0, 1);
      const liftOut = THREE.MathUtils.smoothstep(handoverT, 0, 0.45) - THREE.MathUtils.smoothstep(handoverT, 1.55, 2.0) * 0.65;
      gObj.position.set(
        gh.x + 0.09 + Math.sin(sip * Math.PI) * 0.04,
        gh.y + 0.24 + liftOut * 0.34,
        gh.z + 0.16 + liftOut * 0.14
      );
      gObj.rotation.x = -0.35 * Math.sin(sip * Math.PI);
      // Milk visibly drains down to a cozy ~12% sip!
      const drained = THREE.MathUtils.lerp(Math.min(1.0, milkFill), 0.11, THREE.MathUtils.smoothstep(handoverT, 0.35, 1.75));
      kitchenBundle.glass.setFillLevel(drained);

      if (handoverT >= 2.05) {
        handoverPhase = 'returning';
        handoverT = 0;
        milkFill = 0.11;
      }
    } else if (handoverPhase === 'returning') {
      handoverT += dt;
      const p = THREE.MathUtils.smoothstep(handoverT, 0, 0.85);
      gObj.position.lerpVectors(
        new THREE.Vector3(gh.x + 0.09, gh.y + 0.35, gh.z + 0.21),
        gh,
        p
      );
      gObj.rotation.x *= 1 - p;
      gObj.rotation.z *= 1 - p;
      if (handoverT >= 0.85) {
        gObj.position.copy(gh);
        gObj.rotation.set(0, 0, 0);
        handoverPhase = 'done';
        handoverT = 0;
      }
    }

    // G. Subtle, Slow Wordless Organic Nudge ONLY after 10+ seconds of complete stillness!
    const idleSec = nowSec - lastInteractionTime;
    if (idleSec > 10.5 && !draggedItem && handoverPhase === 'idle') {
      const cycle = Math.floor((idleSec - 10.5) / 6.5);
      if (cycle > idleHintStep) {
        idleHintStep = cycle;
        if (milkFill >= 0.5) {
          // Gentle crystalline invitation on full milk glass!
          audio.playGlassClink();
        } else {
          const counterItem = groceries.find((g) => g.zone === 'counter');
          if (counterItem) {
            counterItem.vel.y = 0.45;
            if (counterItem.rollable) counterItem.vel.x = 0.09;
            audio.playBagRustle();
          }
        }
      }
    }
  }

  // Smooth first-person camera breathing & warm lean-in during glass handover!
  function updateCamera(dt, layoutPos, layoutTarget) {
    baseCamPos.copy(layoutPos);
    baseCamTarget.copy(layoutTarget);
    if (!camInitialized) {
      curCamPos.copy(baseCamPos);
      curCamTarget.copy(baseCamTarget);
      camInitialized = true;
    }

    const desiredPos = baseCamPos.clone();
    const desiredTarget = baseCamTarget.clone();

    if (handoverPhase === 'offering' || handoverPhase === 'drinking') {
      // Warm gentle first-person lean-in as you hand over the glass of fresh milk!
      desiredPos.z -= 0.14;
      desiredPos.y += 0.03;
      desiredTarget.x += 0.07;
      desiredTarget.y += 0.08;
    }

    const k = 1 - Math.exp(-4.5 * dt);
    curCamPos.lerp(desiredPos, k);
    curCamTarget.lerp(desiredTarget, k);
    camera.position.copy(curCamPos);
    camera.lookAt(curCamTarget);
  }

  return {
    update(dt, nowSec, layoutPos, layoutTarget) {
      updatePhysics(dt, nowSec);
      updateCamera(dt, layoutPos, layoutTarget);
      // Report whether any shadow-casting object moved so renderer updates shadow map only when needed!
      let moving = !!draggedItem || isPouring || bagBounce > 0.001 || (handoverPhase !== 'idle' && handoverPhase !== 'done') || Math.abs(eggLidTarget - eggLidAngle) > 0.004;
      if (!moving) {
        for (const g of groceries) {
          if (Math.abs(g.vel.x) > 0.003 || Math.abs(g.vel.y) > 0.003 || Math.abs(g.vel.z) > 0.003) {
            moving = true;
            break;
          }
        }
      }
      return moving;
    },
    getState: () => ({
      storedCount,
      totalGroceries: groceries.length,
      milkFill: Number(milkFill.toFixed(2)),
      handoverPhase,
      doorOpen,
      crisperOpen,
    }),
    // Expose clean programmatic hooks ONLY for automated end-to-end visual verification
    __test: {
      storeSampleGroceries() {
        const map = {
          apple: { zone: 'shelf_mid', x: -0.10, z: -0.13 },
          pear: { zone: 'shelf_mid', x: 0.03, z: -0.15 },
          bananas: { zone: 'shelf_top', x: -0.02, z: -0.15 },
          eggs: { zone: 'shelf_lower', x: 0.08, z: -0.13 },
          avocado: { zone: 'crisper', x: -0.08, z: -0.12 },
          onion: { zone: 'crisper', x: 0.04, z: -0.11 },
          sweet_potato: { zone: 'crisper', x: 0.14, z: -0.14 },
          ginger: { zone: 'crisper', x: -0.15, z: -0.15 },
          lemon: { zone: 'door_pocket_upper', lx: -0.22 },
          lime: { zone: 'door_pocket_upper', lx: -0.35 },
        };
        for (const item of groceries) {
          const cfg = map[item.id];
          if (!cfg) continue;
          if (cfg.zone.startsWith('shelf_')) {
            const sh = fridge.shelves.find((s) => s.id === cfg.zone);
            scene.attach(item.root);
            item.zone = cfg.zone;
            item.shelfRef = sh;
            item.state = 'stored';
            item.root.position.set(cfg.x, sh.y, cfg.z);
            if (item.id === 'eggs') {
              eggLidTarget = 0.0;
              eggLidAngle = 0.0;
            }
          } else if (cfg.zone === 'crisper') {
            fridge.crisperGroup.attach(item.root);
            item.zone = 'crisper';
            item.state = 'stored';
            item.root.position.set(cfg.x, fridge.crisperBounds.y, cfg.z);
          } else if (cfg.zone === 'door_pocket_upper') {
            const pk = fridge.pockets[1];
            fridge.doorPivot.attach(item.root);
            item.zone = cfg.zone;
            item.pocketRef = pk;
            item.state = 'stored';
            item.root.position.set(cfg.lx, pk.localY, pk.localZ);
          }
        }
        storedCount = 10;
      },
      triggerPour() {
        const milk = groceries.find((g) => g.id === 'milk');
        if (!milk) return;
        scene.attach(milk.root);
        milk.state = 'pouring';
        isPouring = true;
        autoPourTimer = 2.4;
      },
      setFilledMilk(level) {
        milkFill = level;
        kitchenBundle.glass.setFillLevel(level);
      },
    },
  };
}
