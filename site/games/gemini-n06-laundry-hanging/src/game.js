import * as THREE from 'three';
import {
  createClothespin,
  createTowel,
  createTShirt,
  createSocks,
} from './laundry.js';
import { createFirstPersonHand, createMomReceivingStation } from './hands.js';
import { createPhysicalEffects } from './effects.js';
import { audio } from './audio.js';

const PALETTES = [
  { towel: 0xefe1d4, stripe: 0xc2937d, tshirt: 0xb2cad9, socks: 0xf4ecdf },
  { towel: 0xcbd8c7, stripe: 0x91a68c, tshirt: 0xe6c8c0, socks: 0xf0e7d8 },
  { towel: 0xf0e6c9, stripe: 0xc7b288, tshirt: 0xc4c6d8, socks: 0xf4ecdf },
];

export async function createLaundryGame({ world, camera, renderer }) {
  const { scene, pole, basket, table, tableTopY, cabinet, topDrawer, plant, slidingGlassPane } = world;

  const [fpHand, mom] = await Promise.all([
    createFirstPersonHand(scene),
    createMomReceivingStation(scene, slidingGlassPane),
  ]);
  const effects = createPhysicalEffects(scene);

  // 1. Six permanent realistic wooden clothespins clipped along the stainless pole (2 per slot)
  const pinPairs = [];
  const slotOffsets = [
    [-0.115, 0.115], // Towel
    [-0.103, 0.103], // T-Shirt
    [-0.072, 0.072], // Socks
  ];

  for (let s = 0; s < 3; s++) {
    const pair = [];
    for (let p = 0; p < 2; p++) {
      const pin = createClothespin();
      const px = pole.slots[s] + slotOffsets[s][p];
      pin.position.set(px, pole.y + 0.015, pole.z);
      pin.rotation.y = Math.PI * 0.34;
      pin.userData.baseY = pole.y + 0.015;
      pin.userData.openTarget = 0.14; // slightly ajar waiting on pole
      pin.userData.openNow = 0.14;
      pin.userData.setOpen(0.14);
      scene.add(pin);
      pair.push(pin);
    }
    pinPairs.push(pair);
  }

  // 2. Invisible generous hit proxies for 5-year-old one-finger forgiving touch!
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitProxies = [];

  function addHitProxy(name, geo, pos, parent = scene, meta = {}) {
    const m = new THREE.Mesh(geo, hitMat);
    m.position.copy(pos);
    m.userData = { hitName: name, ...meta };
    parent.add(m);
    hitProxies.push(m);
    return m;
  }

  // Generous hit volumes for environment & stations
  addHitProxy('basket_zone', new THREE.BoxGeometry(0.62, 0.34, 0.48), new THREE.Vector3(basket.position.x, 0.16, basket.position.z));
  addHitProxy('pole_zone', new THREE.BoxGeometry(1.75, 0.46, 0.34), new THREE.Vector3(-0.08, pole.y - 0.16, pole.z));
  addHitProxy('table_zone', new THREE.BoxGeometry(0.76, 0.32, 0.50), new THREE.Vector3(table.position.x, tableTopY + 0.08, table.position.z));
  addHitProxy('plant_zone', new THREE.CylinderGeometry(0.32, 0.24, 0.65, 10), new THREE.Vector3(plant.position.x, 0.32, plant.position.z));

  // Drawer interior anchor (attached directly to real Poly Haven topDrawer node!)
  const drawerAnchor = new THREE.Group();
  // drawer_cabinet_drawer_01 bbox in local space: x[-0.519..0.515], y[0.954..1.103], z[-0.188..0.24]
  drawerAnchor.position.set(0.0, 1.032, 0.04);
  if (topDrawer) {
    topDrawer.add(drawerAnchor);
    addHitProxy('drawer_zone', new THREE.BoxGeometry(1.08, 0.30, 0.58), new THREE.Vector3(0, 1.04, 0.06), topDrawer);
  }
  addHitProxy('mom_tray_zone', new THREE.BoxGeometry(0.68, 0.38, 0.52), new THREE.Vector3(0, 0.08, 0), mom.trayGroup);

  // 3. Game State & Laundry Items
  let roundIndex = 0;
  let items = [];
  let drawerOpenTarget = 0; // 0 = closed, 1 = smoothly pulled open
  let drawerOpenNow = 0;
  let globalGust = 0;
  let poleShake = 0;
  let plantWobble = 0;
  let basketWobble = 0;
  let handoffState = 'none'; // 'none' | 'waiting_mom' | 'handed' | 'resetting'
  let handoffTimer = 0;
  let idleSeconds = 0;
  let idleHintShown = false;
  let idleHintTimer = 0;
  let handBusyTimer = 0;

  // Basket resting offsets for the 3 wet items
  const basketSlots = [
    new THREE.Vector3(-0.11, 0.052, 0.03),
    new THREE.Vector3(0.02, 0.066, -0.03),
    new THREE.Vector3(0.12, 0.058, 0.04),
  ];

  // Drawer local slots (nested neatly side-by-side inside topDrawer!)
  const drawerLocalSlots = [
    new THREE.Vector3(-0.27, 0.0, 0.02),
    new THREE.Vector3(0.02, 0.0, 0.02),
    new THREE.Vector3(0.28, 0.0, 0.02),
  ];

  // Stacked heights when handed together onto Mom's wooden linen tray
  const momStackOffsets = [
    new THREE.Vector3(0.0, 0.002, 0.0),   // Towel base
    new THREE.Vector3(0.0, 0.058, 0.0),   // T-Shirt middle
    new THREE.Vector3(0.0, 0.098, 0.0),   // Socks perched neatly on top!
  ];

  function createRoundItems(palette) {
    // Clean up previous round items if any
    for (const it of items) {
      if (it.group.parent) it.group.parent.remove(it.group);
    }
    items = [];

    const specs = [
      { kind: 'towel', slotIdx: 0, meshGroup: createTowel({ colorHex: palette.towel, stripeHex: palette.stripe, seed: 0.6 + roundIndex }) },
      { kind: 'tshirt', slotIdx: 1, meshGroup: createTShirt({ colorHex: palette.tshirt, seed: 2.1 + roundIndex }) },
      { kind: 'socks', slotIdx: 2, meshGroup: createSocks({ colorHex: palette.socks }) },
    ];

    specs.forEach((sp, idx) => {
      const g = sp.meshGroup;
      // Add generous invisible hit box onto each laundry item for easy 5-year-old touching!
      const hitGeo = new THREE.BoxGeometry(0.36, 0.44, 0.26);
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(0, 0.06, 0);
      hitMesh.userData = { itemIdx: idx };
      g.add(hitMesh);

      const startPos = basket.position.clone().add(basketSlots[idx]);
      g.position.copy(startPos);
      g.rotation.set(0, 0.35 - idx * 0.45, 0);
      scene.add(g);

      const entry = {
        idx,
        kind: sp.kind,
        slotIdx: sp.slotIdx,
        group: g,
        hitMesh,
        state: 'basket', // 'basket' | 'dragging' | 'anim_to_pole' | 'hanging' | 'dry' | 'anim_to_table' | 'table' | 'folded_on_table' | 'anim_to_drawer' | 'in_drawer' | 'anim_to_mom' | 'on_mom_tray'
        wetness: 1.0,
        foldStage: 0,
        dripCooldown: 1.2 + Math.random() * 1.4,
        localGust: 0,
        animT: 0,
        animDur: 0.55,
        fromPos: startPos.clone(),
        toPos: startPos.clone(),
        fromRot: g.rotation.clone(),
        toRot: g.rotation.clone(),
        fromScale: new THREE.Vector3(1, 1, 1),
        toScale: new THREE.Vector3(1, 1, 1),
        onAnimDone: null,
      };
      g.userData.updateShape({ mode: 'basket', wetness: 1.0, time: 0 });
      items.push(entry);
    });

    // Reset clothespins slightly open ready on pole
    for (const pair of pinPairs) {
      for (const pin of pair) {
        pin.userData.openTarget = 0.14;
      }
    }
    drawerOpenTarget = 0;
    handoffState = 'none';
    handoffTimer = 0;
  }

  createRoundItems(PALETTES[0]);

  function startItemAnim(it, { toPos, toRot = new THREE.Euler(0, 0, 0), toScale = new THREE.Vector3(1, 1, 1), dur = 0.52, state, onDone }) {
    // Detach from drawer/tray back to world space cleanly if needed
    if (it.group.parent !== scene) {
      scene.attach(it.group);
    }
    it.fromPos.copy(it.group.position);
    it.toPos.copy(toPos);
    it.fromRot.copy(it.group.rotation);
    it.toRot.copy(toRot);
    it.fromScale.copy(it.group.scale);
    it.toScale.copy(toScale);
    it.animT = 0;
    it.animDur = dur;
    it.state = state;
    it.onAnimDone = onDone;
  }

  function hangItemOnPole(it) {
    const slotX = pole.slots[it.slotIdx];
    const targetPos = new THREE.Vector3(slotX, pole.y - 0.015, pole.z);

    // Open both clothespins wide to receive the wet garment!
    pinPairs[it.slotIdx].forEach((pin) => {
      pin.userData.openTarget = 0.92;
    });

    audio.playClothRustle({ wet: true, duration: 0.28, volume: 0.24 });
    it.group.userData.updateShape({ mode: 'hanging', wetness: it.wetness, time: 0, wind: 0.2 });

    // Reach first-person child's hand smoothly up to pole!
    fpHand.reachTo(targetPos.clone().add(new THREE.Vector3(0, -0.08, 0.08)), { pinchAmount: 0.78 });
    handBusyTimer = 0.65;

    startItemAnim(it, {
      toPos: targetPos,
      toRot: new THREE.Euler(0, 0, 0),
      dur: 0.54,
      state: 'anim_to_pole',
      onDone: () => {
        it.state = 'hanging';
        it.localGust = 0.55;
        poleShake = 1.0;
        // Snap both wooden clothespins shut!
        pinPairs[it.slotIdx].forEach((pin, idx) => {
          pin.userData.openTarget = 0.0;
          setTimeout(() => audio.playClothespinSnap(), idx * 75);
        });
        // Real dripping droplets when newly hung wet laundry settles!
        effects.spawnDroplets(new THREE.Vector3(slotX, pole.y - 0.36, pole.z), 4);
        audio.playWaterDrop();
        fpHand.release();
      },
    });
  }

  function takeDownToTable(it) {
    // Only allow taking down onto table if no other unfolded item is currently occupying the table
    const busyOnTable = items.find((o) => o !== it && (o.state === 'table' || o.state === 'anim_to_table' || o.state === 'folded_on_table'));
    if (busyOnTable) {
      // Gently advance the table item into drawer if already folded, else nudge child's focus
      if (busyOnTable.state === 'folded_on_table') {
        stowItemInDrawer(busyOnTable);
      } else {
        foldItemStep(busyOnTable);
        return;
      }
    }

    // Pop open both clothespins on the pole!
    pinPairs[it.slotIdx].forEach((pin, idx) => {
      pin.userData.openTarget = 0.95;
      setTimeout(() => audio.playClothespinSnap(), idx * 55);
      setTimeout(() => { pin.userData.openTarget = 0.14; }, 420);
    });

    audio.playClothRustle({ wet: false, duration: 0.25, volume: 0.22 });
    const tableTarget = new THREE.Vector3(table.position.x - 0.02, tableTopY + 0.008, table.position.z + 0.01);

    fpHand.reachTo(it.group.position.clone().add(new THREE.Vector3(0, -0.08, 0.08)), { pinchAmount: 0.8 });
    handBusyTimer = 0.72;

    startItemAnim(it, {
      toPos: tableTarget,
      toRot: new THREE.Euler(0, table.rotation.y, 0),
      dur: 0.58,
      state: 'anim_to_table',
      onDone: () => {
        it.state = 'table';
        it.foldStage = 0;
        it.group.userData.updateShape({ mode: 'table', foldStage: 0, wetness: 0, time: 0 });
        audio.playClothRustle({ wet: false, duration: 0.18, volume: 0.16 });
        fpHand.release();
      },
    });
  }

  function foldItemStep(it) {
    if (it.state !== 'table') return;
    it.foldStage += 1;
    audio.playClothRustle({ wet: false, duration: 0.22, volume: 0.24 });

    // First-person child's hand sweeps gently across the wooden table to fold!
    fpHand.reachTo(new THREE.Vector3(table.position.x, tableTopY + 0.06, table.position.z + 0.03), { pinchAmount: 0.42 });
    handBusyTimer = 0.45;

    if (it.foldStage === 1) {
      it.group.userData.updateShape({ mode: 'table', foldStage: 1, wetness: 0, time: 0 });
    } else {
      it.foldStage = 2;
      it.state = 'folded_on_table';
      it.group.userData.updateShape({ mode: 'folded', foldStage: 2, wetness: 0, time: 0 });
      // Gentle physical bounce when neatly folded + smoothly open the real wooden top drawer!
      effects.spawnSunlitMotes(new THREE.Vector3(table.position.x, tableTopY + 0.06, table.position.z), { count: 5, driftX: 0.1, riseY: 0.18, spread: 0.18 });
      if (drawerOpenTarget < 0.8) {
        drawerOpenTarget = 1.0;
        audio.playDrawerSlide(true);
      }
    }
  }

  function stowItemInDrawer(it) {
    if (it.state !== 'folded_on_table') return;
    drawerOpenTarget = 1.0;

    // Compute world position of this item's dedicated slot inside the open real wooden drawer!
    const drawerWorld = drawerLocalSlots[it.slotIdx].clone();
    drawerAnchor.updateWorldMatrix(true, false);
    drawerAnchor.localToWorld(drawerWorld);

    // Match cabinet scale cleanly so the folded clothes fit snugly inside the real wooden drawer!
    const drawerScale = new THREE.Vector3(0.76, 0.76, 0.76);
    const drawerRot = new THREE.Euler(0, cabinet.rotation.y, 0);

    audio.playClothRustle({ wet: false, duration: 0.20, volume: 0.2 });
    fpHand.reachTo(drawerWorld.clone().add(new THREE.Vector3(0, 0.06, 0.04)), { pinchAmount: 0.7 });
    handBusyTimer = 0.68;

    startItemAnim(it, {
      toPos: drawerWorld,
      toRot: drawerRot,
      toScale: drawerScale,
      dur: 0.56,
      state: 'anim_to_drawer',
      onDone: () => {
        it.state = 'in_drawer';
        // Attach directly to the real sliding drawer node so it moves physically WITH the drawer!
        drawerAnchor.attach(it.group);
        it.group.position.copy(drawerLocalSlots[it.slotIdx]);
        it.group.rotation.set(0, 0, 0);
        it.group.scale.set(1.08, 1.08, 1.08);
        audio.playClothRustle({ wet: false, duration: 0.14, volume: 0.14 });
        fpHand.release();

        // Check if ALL 3 items are neatly stowed in the drawer -> Mom arrives at sunlit doorway!
        if (items.every((x) => x.state === 'in_drawer')) {
          handoffState = 'waiting_mom';
          mom.arrive();
          audio.playDryChime();
        }
      },
    });
  }

  function handStackToMom() {
    if (handoffState !== 'waiting_mom') return;
    handoffState = 'handed';
    handoffTimer = 0;

    const trayWorld = mom.getTrayWorldPos(new THREE.Vector3());
    fpHand.reachTo(trayWorld.clone().add(new THREE.Vector3(-0.04, 0.08, 0.04)), { pinchAmount: 0.65 });
    handBusyTimer = 0.9;

    // Close the wooden drawer gently behind us as we lift the clean folded stack to Mom!
    setTimeout(() => {
      drawerOpenTarget = 0;
      audio.playDrawerSlide(false);
    }, 260);

    items.forEach((it, idx) => {
      const destWorld = trayWorld.clone().add(momStackOffsets[idx]);
      setTimeout(() => {
        audio.playClothRustle({ wet: false, duration: 0.18, volume: 0.18 });
        startItemAnim(it, {
          toPos: destWorld,
          toRot: new THREE.Euler(0, mom.group.rotation.y, 0),
          toScale: new THREE.Vector3(0.95, 0.95, 0.95),
          dur: 0.52,
          state: 'anim_to_mom',
          onDone: () => {
            it.state = 'on_mom_tray';
            mom.stackAnchor.attach(it.group);
            it.group.position.copy(momStackOffsets[idx]);
            it.group.rotation.set(0, 0, 0);
            it.group.scale.set(0.96, 0.96, 0.96);

            if (idx === items.length - 1) {
              fpHand.release();
              mom.celebrate();
              audio.playMomHappyMelody();
              effects.spawnSunlitMotes(trayWorld.clone().add(new THREE.Vector3(0, 0.12, 0)), {
                count: 14,
                driftX: 0.25,
                riseY: 0.34,
                spread: 0.36,
              });
            }
          },
        });
      }, idx * 120);
    });
  }

  function triggerWindGust(originWorld) {
    globalGust = Math.min(1.4, globalGust + 1.0);
    audio.playBreezeGust();
    effects.spawnSunlitMotes(originWorld || new THREE.Vector3(-0.1, 1.18, -0.5), {
      count: 10,
      driftX: 0.85,
      riseY: 0.12,
      spread: 0.65,
    });
    // Wind visibly accelerates drying & shakes droplets off wet hanging items!
    for (const it of items) {
      if (it.state === 'hanging') {
        it.localGust = 1.0;
        if (it.wetness > 0.08) {
          it.wetness = Math.max(0, it.wetness - 0.24);
          effects.spawnDroplets(
            new THREE.Vector3(pole.slots[it.slotIdx], pole.y - 0.32, pole.z),
            2
          );
        }
      }
    }
  }

  // 4. Unified One-Finger Pointer Interaction (Tap AND Drag seamlessly supported!)
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  const dragIntersect = new THREE.Vector3();

  let activePointerId = null;
  let pointerDownXY = { x: 0, y: 0 };
  let pointerMoved = false;
  let draggedItem = null;
  let dragOriginState = null;

  function setNDC(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickTargets() {
    raycaster.setFromCamera(pointerNDC, camera);
    const itemMeshes = items.map((it) => it.hitMesh);
    const hits = raycaster.intersectObjects([...itemMeshes, ...hitProxies], false);
    return hits;
  }

  function onPointerDown(e) {
    if (activePointerId !== null) return; // Ignore multi-touch so resting fingers never break interaction!
    activePointerId = e.pointerId;
    pointerDownXY = { x: e.clientX, y: e.clientY };
    pointerMoved = false;
    idleSeconds = 0;
    idleHintShown = false;

    audio.unlock();
    setNDC(e.clientX, e.clientY);
    const hits = pickTargets();

    // Priority 1: Handoff to Mom when all 3 items are neatly in the drawer!
    if (handoffState === 'waiting_mom') {
      const hitMomOrDrawer = hits.some(
        (h) => h.object.userData.hitName === 'mom_tray_zone' ||
               h.object.userData.hitName === 'drawer_zone' ||
               h.object.userData.itemIdx !== undefined
      );
      if (hitMomOrDrawer) {
        handStackToMom();
        return;
      }
    }

    // Priority 2: Direct laundry item hit
    const itemHit = hits.find((h) => h.object.userData.itemIdx !== undefined);
    if (itemHit) {
      const it = items[itemHit.object.userData.itemIdx];
      if (it.state === 'basket' || it.state === 'dry' || it.state === 'folded_on_table') {
        draggedItem = it;
        dragOriginState = it.state;
        // Set drag plane parallel to camera facing through the item
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
        dragPlane.setFromNormalAndCoplanarPoint(normal, it.group.position);
        return;
      }
      if (it.state === 'hanging') {
        // Poking a wet hanging item shakes it playfully, flings water droplets, & dries faster!
        it.localGust = 1.1;
        poleShake = 0.65;
        it.wetness = Math.max(0, it.wetness - 0.24);
        audio.playClothRustle({ wet: true, duration: 0.20, volume: 0.2 });
        audio.playWaterDrop();
        effects.spawnDroplets(new THREE.Vector3(pole.slots[it.slotIdx], pole.y - 0.32, pole.z), 4);
        fpHand.reachTo(it.group.position.clone().add(new THREE.Vector3(0, -0.18, 0.08)), { pinchAmount: 0.2 });
        handBusyTimer = 0.35;
        return;
      }
      if (it.state === 'table') {
        foldItemStep(it);
        return;
      }
    }

    // Priority 3: Zone hits (forgiving taps on basket, open drawer, folding table, plant, pole!)
    const zoneHit = hits.find((h) => h.object.userData.hitName);
    if (zoneHit) {
      const zName = zoneHit.object.userData.hitName;
      if (zName === 'basket_zone') {
        const nextBasket = items.find((x) => x.state === 'basket');
        if (nextBasket) {
          draggedItem = nextBasket;
          dragOriginState = 'basket';
          const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
          dragPlane.setFromNormalAndCoplanarPoint(normal, nextBasket.group.position);
          return;
        }
        basketWobble = 1.0;
        audio.playClothRustle({ wet: false, duration: 0.14, volume: 0.12 });
        return;
      }
      if (zName === 'drawer_zone') {
        const folded = items.find((x) => x.state === 'folded_on_table');
        if (folded) {
          stowItemInDrawer(folded);
          return;
        }
        // Playfully nudge open/closed when no item waiting
        drawerOpenTarget = drawerOpenTarget > 0.5 ? 0 : 0.65;
        audio.playDrawerSlide(drawerOpenTarget > 0.5);
        return;
      }
      if (zName === 'table_zone') {
        const onTable = items.find((x) => x.state === 'table');
        if (onTable) {
          foldItemStep(onTable);
          return;
        }
        const folded = items.find((x) => x.state === 'folded_on_table');
        if (folded) {
          stowItemInDrawer(folded);
          return;
        }
      }
      if (zName === 'plant_zone') {
        plantWobble = 1.0;
        audio.playLeafRustle();
        return;
      }
      if (zName === 'pole_zone') {
        // Check if any dry item is hanging nearby to pluck, else ring the stainless pole!
        const dryNearby = items.find((x) => x.state === 'dry');
        if (dryNearby) {
          takeDownToTable(dryNearby);
        } else {
          poleShake = 0.85;
          audio.playPolePing();
        }
        return;
      }
    }

    // Touching the bright sunny sky / breeze area summons a refreshing morning breeze gust!
    if (pointerNDC.y > -0.05) {
      triggerWindGust(new THREE.Vector3(pointerNDC.x * 0.6, 1.15, -0.55));
    }
  }

  function onPointerMove(e) {
    if (e.pointerId !== activePointerId) return;
    const dx = e.clientX - pointerDownXY.x;
    const dy = e.clientY - pointerDownXY.y;
    if (Math.hypot(dx, dy) > 14) pointerMoved = true;

    setNDC(e.clientX, e.clientY);

    if (draggedItem && pointerMoved) {
      if (draggedItem.state !== 'dragging') {
        draggedItem.state = 'dragging';
        audio.playClothRustle({ wet: draggedItem.wetness > 0.3, duration: 0.22, volume: 0.22 });
        if (dragOriginState === 'dry') {
          pinPairs[draggedItem.slotIdx].forEach((p) => { p.userData.openTarget = 0.85; });
          audio.playClothespinSnap();
        }
      }
      raycaster.setFromCamera(pointerNDC, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
        draggedItem.group.position.lerp(dragIntersect, 0.45);
        fpHand.reachTo(draggedItem.group.position.clone().add(new THREE.Vector3(0, 0.02, 0.08)), { pinchAmount: 0.82 });
        handBusyTimer = 0.25;
      }
    } else if (!draggedItem && pointerMoved && Math.abs(dx) > 48 && globalGust < 0.4) {
      // Swiping horizontally across the air blows a refreshing gust of morning wind!
      triggerWindGust(new THREE.Vector3(pointerNDC.x * 0.5, 1.18, -0.5));
    }
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;

    if (!draggedItem) return;
    const it = draggedItem;
    const origin = dragOriginState;
    draggedItem = null;
    dragOriginState = null;

    // Forgiving completion: both clean taps AND drags complete the natural next physical action!
    if (origin === 'basket') {
      hangItemOnPole(it);
    } else if (origin === 'dry') {
      takeDownToTable(it);
    } else if (origin === 'folded_on_table') {
      stowItemInDrawer(it);
    }
  }

  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // 5. Smooth Camera Framing Director (Dedicated Portrait 390x844 & Landscape 1024x768)
  const camPosNow = new THREE.Vector3();
  const camLookNow = new THREE.Vector3();
  let camInitialized = false;

  function getDesiredCameraPose(aspect) {
    const isPortrait = aspect < 0.85;
    const activeOnTable = items.some((x) => x.state === 'table' || x.state === 'anim_to_table' || x.state === 'folded_on_table' || x.state === 'anim_to_drawer');

    if (handoffState === 'waiting_mom' || handoffState === 'handed') {
      // Warm intimate framing of the open wooden drawer + Mom's oak linen tray & hands at sunlit doorway!
      return isPortrait
        ? { pos: new THREE.Vector3(0.06, 1.14, 1.72), look: new THREE.Vector3(0.86, 0.78, -0.02), fov: 50 }
        : { pos: new THREE.Vector3(0.02, 1.12, 1.54), look: new THREE.Vector3(0.86, 0.78, -0.04), fov: 44 };
    }
    if (activeOnTable) {
      // Gentle turn toward sunlit wooden folding table & open wooden drawer!
      return isPortrait
        ? { pos: new THREE.Vector3(0.14, 1.16, 1.56), look: new THREE.Vector3(0.56, 0.62, -0.06), fov: 50 }
        : { pos: new THREE.Vector3(0.10, 1.14, 1.48), look: new THREE.Vector3(0.52, 0.64, -0.12), fov: 44 };
    }
    // Default full sunny balcony vista (basket + pole + hanging laundry + plant + table + drawer edge)
    return isPortrait
      ? { pos: new THREE.Vector3(-0.02, 1.18, 2.08), look: new THREE.Vector3(0.02, 0.70, -0.36), fov: 52 }
      : { pos: new THREE.Vector3(-0.05, 1.19, 1.82), look: new THREE.Vector3(0.05, 0.70, -0.38), fov: 45 };
  }

  // 6. Idle Gentle Single Physical Cue (ONLY after 10s idle, once, subtle child hand hover — ZERO arrows/glows!)
  function getNextGentleCueTarget() {
    if (handoffState === 'waiting_mom') {
      return mom.getTrayWorldPos(new THREE.Vector3()).add(new THREE.Vector3(0, 0.06, 0));
    }
    const folded = items.find((x) => x.state === 'folded_on_table');
    if (folded) return folded.group.position.clone().add(new THREE.Vector3(0, 0.06, 0));
    const onTable = items.find((x) => x.state === 'table');
    if (onTable) return onTable.group.position.clone().add(new THREE.Vector3(0, 0.06, 0));
    const dryItem = items.find((x) => x.state === 'dry');
    if (dryItem) return dryItem.group.position.clone().add(new THREE.Vector3(0, -0.16, 0.06));
    const basketItem = items.find((x) => x.state === 'basket');
    if (basketItem) return basketItem.group.position.clone().add(new THREE.Vector3(0, 0.08, 0.04));
    return null;
  }

  // 7. Main Per-Frame Simulation Update
  function update(dt, elapsed) {
    const clampedDt = Math.min(dt, 0.05);

    // Natural breeze & decay
    globalGust = Math.max(0, globalGust - clampedDt * 0.75);
    const baseBreeze = 0.30 + 0.16 * Math.sin(elapsed * 0.62) + 0.08 * Math.sin(elapsed * 1.45);
    const totalWind = baseBreeze + globalGust * 0.95;

    // Subtle micro-elasticity on pole, plant, basket
    if (poleShake > 0.001) {
      poleShake *= Math.exp(-clampedDt * 5.2);
      pole.mesh.position.y = pole.y + Math.sin(elapsed * 32) * 0.0045 * poleShake;
    } else {
      pole.mesh.position.y = pole.y;
    }
    if (plantWobble > 0.001) {
      plantWobble *= Math.exp(-clampedDt * 3.8);
      plant.rotation.z = Math.sin(elapsed * 16) * 0.032 * plantWobble;
    }
    if (basketWobble > 0.001) {
      basketWobble *= Math.exp(-clampedDt * 5.0);
      basket.rotation.z = Math.sin(elapsed * 18) * 0.025 * basketWobble;
    }

    // Smoothly slide real Poly Haven wooden top drawer
    drawerOpenNow += (drawerOpenTarget - drawerOpenNow) * (1 - Math.exp(-clampedDt * 6.5));
    if (topDrawer) {
      topDrawer.position.z = (topDrawer.userData.closedZ || 0) + drawerOpenNow * 0.25;
    }

    // Smoothly animate all 6 wooden clothespins
    for (const pair of pinPairs) {
      for (const pin of pair) {
        pin.userData.openNow += (pin.userData.openTarget - pin.userData.openNow) * (1 - Math.exp(-clampedDt * 16));
        pin.userData.setOpen(pin.userData.openNow);
        pin.position.y = pin.userData.baseY + Math.sin(elapsed * 32) * 0.0045 * poleShake;
      }
    }

    // Update each laundry item
    for (const it of items) {
      it.localGust = Math.max(0, it.localGust - clampedDt * 1.1);
      // Keep generous hit proxy centered on the garment whether hanging (-Y) or resting (+Y)
      it.hitMesh.position.y = (it.state === 'hanging' || it.state === 'dry') ? -0.22 : 0.06;

      if (it.state === 'anim_to_pole' || it.state === 'anim_to_table' || it.state === 'anim_to_drawer' || it.state === 'anim_to_mom') {
        it.animT = Math.min(1, it.animT + clampedDt / it.animDur);
        const s = it.animT * it.animT * (3 - 2 * it.animT); // smoothstep
        it.group.position.lerpVectors(it.fromPos, it.toPos, s);
        // Natural gentle arc lift during carry
        it.group.position.y += Math.sin(it.animT * Math.PI) * 0.14;
        it.group.rotation.set(
          THREE.MathUtils.lerp(it.fromRot.x, it.toRot.x, s),
          THREE.MathUtils.lerp(it.fromRot.y, it.toRot.y, s),
          THREE.MathUtils.lerp(it.fromRot.z, it.toRot.z, s)
        );
        it.group.scale.lerpVectors(it.fromScale, it.toScale, s);

        if (it.state === 'anim_to_pole') {
          it.group.userData.updateShape({ mode: 'hanging', time: elapsed, wind: 0.4, wetness: it.wetness });
        }
        if (it.animT >= 1) {
          const cb = it.onAnimDone;
          it.onAnimDone = null;
          if (cb) cb();
        }
      } else if (it.state === 'hanging') {
        // Real sun + breeze drying progression
        const dryRate = 0.115 + globalGust * 0.18 + it.localGust * 0.14;
        it.wetness = Math.max(0, it.wetness - dryRate * clampedDt);

        // Occasional glistening water droplet falling while noticeably wet
        if (it.wetness > 0.35) {
          it.dripCooldown -= clampedDt;
          if (it.dripCooldown <= 0) {
            it.dripCooldown = 1.4 + Math.random() * 1.8;
            effects.spawnDroplets(new THREE.Vector3(pole.slots[it.slotIdx], pole.y - 0.35, pole.z), 1);
            audio.playWaterDrop();
          }
        }

        it.group.userData.updateShape({
          mode: 'hanging',
          time: elapsed,
          wind: totalWind,
          wetness: it.wetness,
          gust: it.localGust + globalGust * 0.5,
        });

        // Transition smoothly to dry!
        if (it.wetness <= 0.01) {
          it.wetness = 0;
          it.state = 'dry';
          it.localGust = 0.65;
          audio.playDryChime();
          effects.spawnSunlitMotes(
            new THREE.Vector3(pole.slots[it.slotIdx], pole.y - 0.22, pole.z + 0.05),
            { count: 8, driftX: 0.22, riseY: 0.28, spread: 0.24 }
          );
        }
      } else if (it.state === 'dry') {
        // Dry fluffy cotton dances happily & lightly in the morning breeze!
        it.group.userData.updateShape({
          mode: 'hanging',
          time: elapsed,
          wind: totalWind + 0.18,
          wetness: 0.0,
          gust: it.localGust + globalGust * 0.5,
        });
      } else if (it.state === 'dragging') {
        it.group.userData.updateShape({
          mode: dragOriginState === 'folded_on_table' ? 'folded' : 'hanging',
          foldStage: it.foldStage,
          time: elapsed,
          wind: 0.5,
          wetness: it.wetness,
        });
      } else if (it.state === 'basket') {
        // Subtle gentle organic breathing settle on the next damp item waiting in basket
        const isFirstWet = items.find((x) => x.state === 'basket') === it;
        const baseP = basket.position.clone().add(basketSlots[it.idx]);
        it.group.position.set(
          baseP.x,
          baseP.y + (isFirstWet ? Math.sin(elapsed * 2.2) * 0.0025 : 0),
          baseP.z
        );
      }
    }

    // Mom celebration -> smoothly transition into a fresh new laundry round!
    if (handoffState === 'handed') {
      handoffTimer += clampedDt;
      if (handoffTimer > 3.4) {
        handoffState = 'resetting';
        mom.leave();
      }
    } else if (handoffState === 'resetting') {
      handoffTimer += clampedDt;
      if (handoffTimer > 4.6) {
        roundIndex = (roundIndex + 1) % PALETTES.length;
        createRoundItems(PALETTES[roundIndex]);
      }
    }

    // Hand release & single gentle 10-second idle cue (never looping!)
    if (handBusyTimer > 0) {
      handBusyTimer -= clampedDt;
      if (handBusyTimer <= 0 && !draggedItem) {
        fpHand.release();
      }
    } else if (!draggedItem && handoffState !== 'handed' && handoffState !== 'resetting') {
      idleSeconds += clampedDt;
      if (idleSeconds > 10.0 && !idleHintShown) {
        const cuePos = getNextGentleCueTarget();
        if (cuePos) {
          idleHintShown = true;
          idleHintTimer = 1.35;
          fpHand.reachTo(cuePos, { pinchAmount: 0.25 });
        }
      }
      if (idleHintTimer > 0) {
        idleHintTimer -= clampedDt;
        if (idleHintTimer <= 0) {
          fpHand.release();
        }
      }
    }

    // Smooth camera easing toward current active veranda zone
    const desired = getDesiredCameraPose(camera.aspect);
    if (!camInitialized) {
      camInitialized = true;
      camPosNow.copy(desired.pos);
      camLookNow.copy(desired.look);
      camera.fov = desired.fov;
    } else {
      const ck = 1 - Math.exp(-clampedDt * 3.4);
      camPosNow.lerp(desired.pos, ck);
      camLookNow.lerp(desired.look, ck);
      camera.fov += (desired.fov - camera.fov) * ck;
    }
    camera.position.copy(camPosNow);
    camera.lookAt(camLookNow);
    camera.updateProjectionMatrix();

    fpHand.update(clampedDt, camera);
    mom.update(clampedDt, elapsed);
    effects.update(clampedDt);
  }

  // Expose silent programmatic testing hook (no visible UI)
  window.__GAME = {
    getState: () => ({
      roundIndex,
      handoffState,
      drawerOpenNow: Number(drawerOpenNow.toFixed(2)),
      items: items.map((it) => ({
        kind: it.kind,
        state: it.state,
        wetness: Number(it.wetness.toFixed(2)),
        foldStage: it.foldStage,
      })),
    }),
    // Helper for automated screenshot verification of later game phases
    fastForwardToStage(stage) {
      if (stage === 'hanging') {
        items.forEach((it) => { if (it.state === 'basket') hangItemOnPole(it); });
      } else if (stage === 'dry') {
        items.forEach((it) => {
          it.wetness = 0;
          if (it.state === 'basket') hangItemOnPole(it);
        });
      } else if (stage === 'folding') {
        items.forEach((it, idx) => {
          it.wetness = 0;
          if (idx === 0) {
            it.state = 'table';
            it.foldStage = 0;
            it.group.position.set(table.position.x - 0.02, tableTopY + 0.008, table.position.z + 0.01);
            it.group.rotation.set(0, table.rotation.y, 0);
            it.group.userData.updateShape({ mode: 'table', foldStage: 0, wetness: 0, time: 0 });
          } else {
            it.state = 'dry';
            it.group.position.set(pole.slots[it.slotIdx], pole.y - 0.015, pole.z);
            it.group.rotation.set(0, 0, 0);
            it.group.userData.updateShape({ mode: 'hanging', wetness: 0, time: 0 });
            pinPairs[it.slotIdx].forEach((p) => { p.userData.openTarget = 0; p.userData.openNow = 0; });
          }
        });
      } else if (stage === 'mom') {
        drawerOpenTarget = 1.0;
        drawerOpenNow = 1.0;
        if (topDrawer) topDrawer.position.z = (topDrawer.userData.closedZ || 0) + 0.25;
        items.forEach((it) => {
          it.wetness = 0;
          it.foldStage = 2;
          it.state = 'in_drawer';
          it.group.userData.updateShape({ mode: 'folded', foldStage: 2, wetness: 0, time: 0 });
          drawerAnchor.attach(it.group);
          it.group.position.copy(drawerLocalSlots[it.slotIdx]);
          it.group.rotation.set(0, 0, 0);
          it.group.scale.set(1.08, 1.08, 1.08);
        });
        handoffState = 'waiting_mom';
        mom.arrive();
      }
    },
  };

  return { update };
}
