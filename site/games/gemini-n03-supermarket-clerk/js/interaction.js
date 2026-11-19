import * as THREE from 'three';
import { audio } from './audio.js';
import { LAYOUT } from './counter.js';
import {
  createProduct,
  PRODUCT_CATALOG,
  markProductScanned,
  applyGoldStickerToProduct,
  updateProductVisuals,
} from './products.js';

// Customer waves designed for progressive discovery (0-30s quick first win, then richer items & special stickers!)
const CUSTOMER_ORDERS = [
  ['apple', 'strawberry', 'milk'],
  ['shortcake', 'orangeJuice', 'croissant'],
  ['bananas', 'honey', 'pudding', 'chocolate'],
  ['eggs', 'cornCan', 'strawberry', 'milk'],
  ['shortcake', 'pudding', 'apple', 'orangeJuice', 'croissant'],
  ['honey', 'chocolate', 'bananas', 'cornCan', 'eggs'],
];

export function createGameController({ scene, camera, renderer, counter, bag, customer, spawnSparkles }) {
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);
  const bagDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.12);
  const intersectPt = new THREE.Vector3();

  // Floating gold sticker preview mesh when dragging from sticker roll
  const floatingStickerMat = new THREE.MeshBasicMaterial({
    color: '#ffd94a',
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });
  const floatingSticker = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), floatingStickerMat);
  floatingSticker.rotation.x = -Math.PI / 2;
  floatingSticker.visible = false;
  scene.add(floatingSticker);

  const productsGroup = new THREE.Group();
  scene.add(productsGroup);

  const state = {
    customerIndex: 0,
    phase: 'arriving', // 'arriving' | 'playing' | 'readyHandover' | 'celebrating'
    products: [],
    scannedColors: [],
    activePointerId: null,
    dragMode: null, // 'product' | 'bag' | 'gun' | 'sticker'
    dragProduct: null,
    dragStartTime: 0,
    dragStartClient: new THREE.Vector2(),
    dragMoved: false,
    dragTargetPos: new THREE.Vector3(),
    beltJogTimer: 0,
    nextCustomerTimer: 0,
    idleSeconds: 0,
    hintShownThisStage: false,
    hintAnim: null, // { t, duration, fromWorld, midWorld, toWorld }
    rescanCooldown: new Map(),
    gunTargetAnim: null,
  };

  function getClientNDC(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function clearProducts() {
    state.products.forEach((p) => {
      if (p.root.parent) p.root.parent.remove(p.root);
    });
    state.products.length = 0;
    state.scannedColors.length = 0;
  }

  function startCustomerRound(idx) {
    clearProducts();
    state.customerIndex = idx;
    state.phase = 'arriving';
    state.idleSeconds = 0;
    state.hintShownThisStage = false;
    state.hintAnim = null;
    state.nextCustomerTimer = 0;

    counter.setDrawerOpen(false);
    counter.clearTrayCoins();
    counter.resetReceipt();
    counter.updateLCD([], false);
    counter.setScaleWeight(0);

    customer.startCustomer(idx);
    bag.resetForNewCustomer(idx);

    // Pick product lineup (first 6 curated for progressive delight, then endless playful mixes)
    let order;
    if (idx < CUSTOMER_ORDERS.length) {
      order = CUSTOMER_ORDERS[idx];
    } else {
      const count = 4 + (idx % 2);
      const pool = [...PRODUCT_CATALOG].sort(() => Math.random() - 0.5);
      order = pool.slice(0, count).map((p) => p.id);
    }

    // Place products neatly on the conveyor belt so they roll in smoothly!
    const count = order.length;
    order.forEach((typeId, i) => {
      // Starting customer #2, give 1 product a special shiny discount sparkle sticker!
      const isSpecial = idx >= 1 && i === 0;
      const item = createProduct(typeId, { isSpecial });
      // Arrange in a natural staggered cluster along the belt
      const colSpan = Math.min(0.56, (count - 1) * 0.21);
      const targetX = LAYOUT.beltCenterX + 0.14 - (i / Math.max(1, count - 1)) * colSpan;
      const rowOffset = count <= 3
        ? (i % 2 === 0 ? -0.05 : 0.07)
        : ((i % 2 === 0 ? -0.095 : 0.095) + (Math.random() - 0.5) * 0.03);
      const targetZ = LAYOUT.beltZ + rowOffset;

      item.beltTargetX = THREE.MathUtils.clamp(targetX, LAYOUT.beltMinX + 0.08, LAYOUT.beltMaxX - 0.06);
      item.root.position.set(item.beltTargetX - 0.42, LAYOUT.beltY, targetZ);
      item.root.rotation.y = (Math.random() - 0.5) * 0.35;
      productsGroup.add(item.root);
      state.products.push(item);
    });

    // Belt rolls products cleanly into view
    state.beltJogTimer = 0.72;
    audio.playBeltWhir(0.65);
  }

  function handleScanProduct(item, viaGun = false) {
    if (!item) return;
    const now = performance.now() * 0.001;
    if (item.scanned) {
      const last = state.rescanCooldown.get(item) || 0;
      if (now - last > 0.75) {
        state.rescanCooldown.set(item, now);
        audio.playRescanChirp();
        item.wobbleAmp = 0.22;
        counter.triggerScanFlash();
      }
      return;
    }

    markProductScanned(item);
    counter.triggerScanFlash();
    counter.feedReceipt(0.24);
    state.scannedColors.push(item.color);
    counter.updateLCD(state.scannedColors, false);

    if (viaGun) {
      audio.playGunBeep();
    } else {
      audio.playScanBeep(item.isSpecial);
    }
    audio.playReceiptFeed();

    // Sparkle burst right over item!
    const worldPos = new THREE.Vector3();
    item.root.getWorldPosition(worldPos);
    worldPos.y += item.height * 0.55;
    spawnSparkles(worldPos, item.isSpecial ? 0xffd23c : 0x30ff88, item.isSpecial ? 18 : 10);

    // Customer reacts warmly when scanning special items or sweet treats!
    if (item.isSpecial || item.id === 'shortcake' || item.id === 'strawberry') {
      customer.triggerHappyClap();
    }

    state.idleSeconds = 0;
    state.hintAnim = null;
  }

  function handleBagProduct(item) {
    if (!item || item.state === 'bagged') return;

    if (!item.scanned) {
      // Friendly self-explanatory bounce back toward scanner!
      audio.playScanFirstBounce();
      item.state = 'flying';
      item.flyAnim = {
        t: 0,
        duration: 0.34,
        from: item.root.position.clone(),
        to: new THREE.Vector3(LAYOUT.scannerPos.x, 0.018, LAYOUT.scannerPos.z),
        arcH: 0.14,
        onDone: () => {
          item.state = 'counter';
          item.wobbleAmp = 0.32;
          // Gently scans it once it bounces cleanly onto the scanner!
          handleScanProduct(item, false);
        },
      };
      return;
    }

    audio.playBagDrop(item.weight, item.material);
    bag.addItem(item);

    // Subtle sparkle at bag rim
    spawnSparkles(
      new THREE.Vector3(LAYOUT.bagPos.x, 0.28, LAYOUT.bagPos.z),
      0xfff0a8,
      7
    );

    // Check if ALL products for this customer are now packed!
    const remaining = state.products.filter((p) => p.state !== 'bagged');
    if (remaining.length === 0) {
      state.phase = 'readyHandover';
      bag.state.readyToHandOver = true;
      customer.setBeckoning(true);
      state.idleSeconds = 0;
      state.hintShownThisStage = false;
      state.hintAnim = null;
      // Gentle inviting chime
      setTimeout(() => {
        if (state.phase === 'readyHandover') {
          audio.playSoftTap();
        }
      }, 220);
    }
  }

  function completeHandover() {
    if (state.phase !== 'readyHandover' || bag.state.handedOver) return;
    state.phase = 'celebrating';
    bag.state.handedOver = true;
    bag.state.readyToHandOver = false;
    bag.state.dragging = false;
    state.hintAnim = null;

    const hasBonus = bag.state.hasGoldSticker || bag.state.hasReceipt || state.products.some((p) => p.hasGoldSticker);

    // Customer joyfully receives the bag!
    customer.receiveBag(bag);

    // Register & Coins celebration cascade!
    counter.setDrawerOpen(true);
    counter.updateLCD(state.scannedColors, true);
    counter.spawnTrayCoins(hasBonus ? 9 : 5);

    audio.playKaChing(hasBonus);
    setTimeout(() => audio.playCustomerHappy(hasBonus), 260);

    // Warm golden celebratory glints in the sunlight!
    spawnSparkles(new THREE.Vector3(0.28, 0.36, -0.20), 0xffdc5c, hasBonus ? 28 : 18);
    spawnSparkles(new THREE.Vector3(LAYOUT.coinTrayPos.x, 0.14, LAYOUT.coinTrayPos.z), 0xffe985, 12);

    // Schedule next customer seamlessly (gives child time to enjoy coins/drawer without stalling!)
    state.nextCustomerTimer = 3.2;
  }

  function flyProductToScanner(item) {
    audio.playPickup(item.material);
    item.state = 'flying';
    item.flyAnim = {
      t: 0,
      duration: 0.34,
      from: item.root.position.clone(),
      to: new THREE.Vector3(
        LAYOUT.scannerPos.x + (Math.random() - 0.5) * 0.05,
        0.018,
        LAYOUT.scannerPos.z + (Math.random() - 0.5) * 0.05
      ),
      arcH: 0.18,
      onDone: () => {
        item.state = 'counter';
        audio.playPlace(item.material, item.weight);
        handleScanProduct(item, false);
      },
    };
  }

  function flyProductToBag(item) {
    audio.playPickup(item.material);
    item.state = 'flying';
    item.flyAnim = {
      t: 0,
      duration: 0.36,
      from: item.root.position.clone(),
      to: new THREE.Vector3(LAYOUT.bagPos.x, 0.27, LAYOUT.bagPos.z),
      arcH: 0.22,
      onDone: () => {
        handleBagProduct(item);
      },
    };
  }

  function fireHandheldGunAt(targetItem) {
    counter.state.gunActive = 1.0;
    if (targetItem) {
      const worldTarget = new THREE.Vector3();
      targetItem.root.getWorldPosition(worldTarget);
      state.gunTargetAnim = {
        t: 0,
        duration: 0.55,
        targetPos: worldTarget,
        item: targetItem,
        scanned: false,
      };
    } else {
      audio.playGunBeep();
      state.gunTargetAnim = {
        t: 0,
        duration: 0.4,
        targetPos: new THREE.Vector3(-0.3, 0.08, 0.1),
        item: null,
        scanned: true,
      };
    }
  }

  // Raycast helper returning topmost interactive object
  function hitTest(ev) {
    getClientNDC(ev);
    raycaster.setFromCamera(pointerNDC, camera);

    const targets = [];
    // Active unbagged products
    state.products.forEach((p) => {
      if (p.state !== 'bagged' && p.state !== 'flying') {
        targets.push(p.hitMesh);
      }
    });
    // Bag (always raycastable for tapping or dragging when ready)
    if (!bag.state.handedOver) targets.push(bag.hitMesh);
    // Customer hands (when ready to receive!)
    if (state.phase === 'readyHandover') targets.push(customer.receiveHit);
    // Counter interactive gadgets
    counter.hitMeshes.forEach((m) => targets.push(m));

    const hits = raycaster.intersectObjects(targets, false);
    return hits.length > 0 ? hits[0] : null;
  }

  function onPointerDown(ev) {
    audio.unlock();
    if (state.activePointerId !== null) return; // Ignore second finger!
    state.activePointerId = ev.pointerId;
    state.idleSeconds = 0;
    state.hintAnim = null;
    state.dragStartTime = performance.now();
    state.dragStartClient.set(ev.clientX, ev.clientY);
    state.dragMoved = false;

    const hit = hitTest(ev);
    if (!hit) return;

    const kind = hit.object.userData.interactive;

    if (kind === 'product') {
      const item = hit.object.userData.product;
      state.dragMode = 'product';
      state.dragProduct = item;
      item.state = 'dragging';
      audio.playPickup(item.material);
      if (item.material === 'pudding') item.wobbleAmp = 0.42;

      if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
        state.dragTargetPos.copy(intersectPt);
      } else {
        state.dragTargetPos.copy(item.root.position);
      }
      renderer.domElement.classList.add('grabbing');
    } else if (kind === 'bag') {
      if (state.phase === 'readyHandover') {
        state.dragMode = 'bag';
        bag.state.dragging = true;
        audio.playPickup('carton');
        if (raycaster.ray.intersectPlane(bagDragPlane, intersectPt)) {
          state.dragTargetPos.copy(intersectPt);
        }
        renderer.domElement.classList.add('grabbing');
      } else {
        // Stage focus: bag is waiting for items, just gives a small tactile wiggle!
        bag.state.wobble = 0.16;
        audio.playSoftTap();
      }
    } else if (kind === 'customer') {
      if (state.phase === 'readyHandover') {
        completeHandover();
      }
    } else if (kind === 'beltButton') {
      counter.state.beltBtnPress = 1.0;
      state.beltJogTimer = Math.max(state.beltJogTimer, 0.55);
      audio.playBeltWhir(0.5);
      // Gently jiggle items currently on belt!
      state.products.forEach((p) => {
        if (p.state === 'belt') {
          p.beltTargetX = Math.min(LAYOUT.beltMaxX - 0.05, p.root.position.x + 0.11);
          p.wobbleAmp = Math.max(p.wobbleAmp, p.material === 'pudding' ? 0.55 : 0.22);
        }
      });
    } else if (kind === 'handheldGun') {
      state.dragMode = 'gun';
      renderer.domElement.classList.add('grabbing');
      counter.state.gunActive = 1.0;
    } else if (kind === 'stickerRoll') {
      state.dragMode = 'sticker';
      audio.playPickup('crinkle');
      floatingSticker.visible = true;
      if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
        floatingSticker.position.set(intersectPt.x, 0.20, intersectPt.z);
      }
      renderer.domElement.classList.add('grabbing');
    } else if (kind === 'receipt') {
      if (counter.tearReceipt()) {
        audio.playReceiptTear();
        bag.tuckReceipt();
        customer.triggerHappyClap();
        spawnSparkles(new THREE.Vector3(LAYOUT.bagPos.x - 0.06, 0.29, LAYOUT.bagPos.z), 0xffffff, 9);
      } else {
        audio.playSoftTap();
      }
    } else if (kind === 'coinTray') {
      if (counter.sweepTrayCoins()) {
        audio.playCoinClink(1.1);
        setTimeout(() => audio.playCoinClink(1.3), 75);
        setTimeout(() => audio.playCoinClink(1.5), 145);
        spawnSparkles(new THREE.Vector3(LAYOUT.coinTrayPos.x, 0.09, LAYOUT.coinTrayPos.z), 0xffe46b, 10);
      } else {
        audio.playSoftTap();
      }
    } else if (kind === 'cashDrawer') {
      if (counter.state.drawerOpen) {
        counter.setDrawerOpen(false);
        audio.playDrawerClose();
        // If customer has already walked away, bring the next customer right away!
        if (state.phase === 'celebrating' && customer.state.mode === 'leaving') {
          state.nextCustomerTimer = Math.min(state.nextCustomerTimer, 0.45);
        }
      } else {
        audio.playSoftTap();
      }
    }
  }

  function onPointerMove(ev) {
    if (ev.pointerId !== state.activePointerId || !state.dragMode) return;
    state.idleSeconds = 0;

    const dx = ev.clientX - state.dragStartClient.x;
    const dy = ev.clientY - state.dragStartClient.y;
    if (dx * dx + dy * dy > 144) { // > 12px movement = real drag
      state.dragMoved = true;
    }

    getClientNDC(ev);
    raycaster.setFromCamera(pointerNDC, camera);

    if (state.dragMode === 'product' && state.dragProduct) {
      if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
        // Clamp neatly within visible counter workspace
        intersectPt.x = THREE.MathUtils.clamp(intersectPt.x, -1.05, 0.92);
        intersectPt.z = THREE.MathUtils.clamp(intersectPt.z, -0.38, 0.46);

        // Subtle magnetic assist toward scanner center if unscanned and nearby
        const item = state.dragProduct;
        const dScan = Math.hypot(intersectPt.x - LAYOUT.scannerPos.x, intersectPt.z - LAYOUT.scannerPos.z);
        if (!item.scanned && dScan < 0.26) {
          intersectPt.x = THREE.MathUtils.lerp(intersectPt.x, LAYOUT.scannerPos.x, 0.35);
          intersectPt.z = THREE.MathUtils.lerp(intersectPt.z, LAYOUT.scannerPos.z, 0.35);
        }

        state.dragTargetPos.copy(intersectPt);

        // Live scan when sweeping directly across the red laser window!
        if (dScan < LAYOUT.scannerRadius + 0.035) {
          counter.state.scannerActiveHover = true;
          handleScanProduct(item, false);
        } else {
          counter.state.scannerActiveHover = false;
        }

        // Bag anticipation bulge when hovering scanned item over open bag
        const dBag = Math.hypot(intersectPt.x - LAYOUT.bagPos.x, intersectPt.z - LAYOUT.bagPos.z);
        bag.state.hoverHighlight = item.scanned && dBag < 0.27;
      }
    } else if (state.dragMode === 'bag') {
      if (raycaster.ray.intersectPlane(bagDragPlane, intersectPt)) {
        const bx = THREE.MathUtils.clamp(intersectPt.x, -0.35, 0.85);
        const bz = THREE.MathUtils.clamp(intersectPt.z, -0.42, 0.32);
        state.dragTargetPos.set(bx, 0.07, bz);

        // As soon as bag reaches customer's outstretched hands across counter -> complete handover!
        if (bz < -0.14) {
          state.dragMode = null;
          renderer.domElement.classList.remove('grabbing');
          completeHandover();
        }
      }
    } else if (state.dragMode === 'gun') {
      counter.state.gunActive = 1.0;
      if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
        // Aim handheld scanner toward finger position and zap any unscanned item!
        const localDir = intersectPt.clone().sub(LAYOUT.gunDockPos);
        const yaw = Math.atan2(-localDir.x, -localDir.z);
        counter.gunGroup.rotation.y = THREE.MathUtils.clamp(yaw, -1.35, 1.35);
        counter.gunGroup.position.y = 0.085;

        // Check if aiming near any unscanned product
        state.products.forEach((p) => {
          if (!p.scanned && p.state !== 'bagged') {
            const dist = Math.hypot(p.root.position.x - intersectPt.x, p.root.position.z - intersectPt.z);
            if (dist < 0.17) {
              handleScanProduct(p, true);
            }
          }
        });
      }
    } else if (state.dragMode === 'sticker') {
      if (raycaster.ray.intersectPlane(dragPlane, intersectPt)) {
        floatingSticker.position.set(
          THREE.MathUtils.clamp(intersectPt.x, -1.0, 0.9),
          0.22,
          THREE.MathUtils.clamp(intersectPt.z, -0.4, 0.45)
        );
      }
    }
  }

  function onPointerUp(ev) {
    if (ev.pointerId !== state.activePointerId) return;
    state.activePointerId = null;
    renderer.domElement.classList.remove('grabbing');
    counter.state.scannerActiveHover = false;
    bag.state.hoverHighlight = false;

    const elapsed = performance.now() - state.dragStartTime;
    const isTap = !state.dragMoved && elapsed < 320;

    if (state.dragMode === 'product' && state.dragProduct) {
      const item = state.dragProduct;
      state.dragProduct = null;
      state.dragMode = null;

      if (isTap) {
        // Strict 1-step causality on tap!
        if (!item.scanned) {
          flyProductToScanner(item);
        } else {
          flyProductToBag(item);
        }
      } else {
        // Released after drag: check drop zone!
        const dBag = Math.hypot(item.root.position.x - LAYOUT.bagPos.x, item.root.position.z - LAYOUT.bagPos.z);
        const dScan = Math.hypot(item.root.position.x - LAYOUT.scannerPos.x, item.root.position.z - LAYOUT.scannerPos.z);

        if (dBag < 0.28) {
          handleBagProduct(item);
        } else if (dScan < LAYOUT.scannerRadius + 0.05) {
          item.state = 'counter';
          item.root.position.y = 0.018;
          audio.playPlace(item.material, item.weight);
          if (!item.scanned) handleScanProduct(item, false);
        } else {
          // Set down smoothly on belt or stainless counter
          const onBelt = item.root.position.x < LAYOUT.beltMaxX + 0.04;
          item.state = onBelt ? 'belt' : 'counter';
          item.beltTargetX = item.root.position.x;
          item.root.position.y = onBelt ? LAYOUT.beltY : 0.004;
          item.wobbleAmp = Math.max(item.wobbleAmp, item.material === 'pudding' ? 0.52 : 0.16);
          audio.playPlace(item.material, item.weight);
        }
      }
    } else if (state.dragMode === 'bag') {
      state.dragMode = null;
      bag.state.dragging = false;
      if (isTap || bag.root.position.z < -0.04) {
        completeHandover();
      } else {
        // Settle gently back on bagging cradle
        bag.root.position.copy(LAYOUT.bagPos);
        audio.playPlace('carton', 0.6);
      }
    } else if (state.dragMode === 'gun') {
      state.dragMode = null;
      if (isTap) {
        // Tap gun -> aims & zaps nearest unscanned product on belt!
        const nextUnscanned = state.products.find((p) => !p.scanned && p.state !== 'bagged');
        fireHandheldGunAt(nextUnscanned);
      }
    } else if (state.dragMode === 'sticker') {
      state.dragMode = null;
      floatingSticker.visible = false;

      if (isTap) {
        // Tap sticker roll -> sticks gleaming gold star sticker on bag (or on first scanned item if bag already has one!)
        if (!bag.state.hasGoldSticker) {
          bag.addGoldSticker();
          audio.playStickerStick();
          spawnSparkles(new THREE.Vector3(LAYOUT.bagPos.x, 0.20, LAYOUT.bagPos.z + 0.12), 0xffdd55, 12);
          customer.triggerHappyClap();
        } else {
          const targetProd = state.products.find((p) => !p.hasGoldSticker && p.state !== 'bagged');
          if (targetProd && applyGoldStickerToProduct(targetProd)) {
            audio.playStickerStick();
            const wp = new THREE.Vector3();
            targetProd.root.getWorldPosition(wp);
            wp.y += targetProd.height * 0.6;
            spawnSparkles(wp, 0xffdd55, 10);
          } else {
            audio.playSoftTap();
          }
        }
      } else {
        // Dropped sticker onto bag or onto a specific product!
        const sx = floatingSticker.position.x;
        const sz = floatingSticker.position.z;
        const dBag = Math.hypot(sx - LAYOUT.bagPos.x, sz - LAYOUT.bagPos.z);
        if (dBag < 0.28) {
          if (bag.addGoldSticker()) {
            audio.playStickerStick();
            spawnSparkles(new THREE.Vector3(LAYOUT.bagPos.x, 0.20, LAYOUT.bagPos.z + 0.12), 0xffdd55, 12);
            customer.triggerHappyClap();
          }
        } else {
          // Find nearest product
          let best = null;
          let bestD = 0.22;
          state.products.forEach((p) => {
            if (p.state !== 'bagged') {
              const d = Math.hypot(p.root.position.x - sx, p.root.position.z - sz);
              if (d < bestD) { bestD = d; best = p; }
            }
          });
          if (best && applyGoldStickerToProduct(best)) {
            audio.playStickerStick();
            const wp = new THREE.Vector3();
            best.root.getWorldPosition(wp);
            wp.y += best.height * 0.6;
            spawnSparkles(wp, 0xffdd55, 10);
          }
        }
      }
    }
  }

  // Bind pointer listeners
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Subtle 10-second idle hint (drawn ONCE softly on 2D overlay, zero text/arrows!)
  const hintCanvas = document.getElementById('hint-overlay');
  const hintCtx = hintCanvas ? hintCanvas.getContext('2d') : null;

  function projectToScreen(vec3) {
    const v = vec3.clone().project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function updateHintOverlay(dt) {
    if (!hintCanvas || !hintCtx) return;
    if (hintCanvas.width !== window.innerWidth || hintCanvas.height !== window.innerHeight) {
      hintCanvas.width = window.innerWidth;
      hintCanvas.height = window.innerHeight;
    }
    hintCtx.clearRect(0, 0, hintCanvas.width, hintCanvas.height);

    if (!state.hintAnim) return;
    state.hintAnim.t += dt;
    const p = state.hintAnim.t / state.hintAnim.duration;
    if (p >= 1) {
      state.hintAnim = null;
      return;
    }

    // Smooth cubic path from start -> mid -> end
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const a = state.hintAnim.fromWorld;
    const b = state.hintAnim.midWorld;
    const c = state.hintAnim.toWorld;
    const cur = new THREE.Vector3();
    const omt = 1 - ease;
    cur.x = omt * omt * a.x + 2 * omt * ease * b.x + ease * ease * c.x;
    cur.y = omt * omt * a.y + 2 * omt * ease * b.y + ease * ease * c.y;
    cur.z = omt * omt * a.z + 2 * omt * ease * b.z + ease * ease * c.z;

    const pt = projectToScreen(cur);
    const alpha = Math.sin(p * Math.PI) * 0.65;

    // Soft glowing fingertip ring (no arrow, no text — gentle single demonstration!)
    hintCtx.save();
    const grad = hintCtx.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, 32);
    grad.addColorStop(0, `rgba(255, 252, 235, ${alpha})`);
    grad.addColorStop(0.55, `rgba(255, 235, 165, ${alpha * 0.45})`);
    grad.addColorStop(1, 'rgba(255, 235, 165, 0)');
    hintCtx.fillStyle = grad;
    hintCtx.beginPath();
    hintCtx.arc(pt.x, pt.y, 32, 0, Math.PI * 2);
    hintCtx.fill();

    hintCtx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
    hintCtx.lineWidth = 2.5;
    hintCtx.beginPath();
    hintCtx.arc(pt.x, pt.y, 13, 0, Math.PI * 2);
    hintCtx.stroke();
    hintCtx.restore();
  }

  // Main per-frame update
  function update(dt, now) {
    // Conveyor belt roll animation
    if (state.beltJogTimer > 0) {
      state.beltJogTimer = Math.max(0, state.beltJogTimer - dt);
      counter.state.beltSpeed = 0.55;
      state.products.forEach((p) => {
        if (p.state === 'belt' && p.beltTargetX !== undefined) {
          p.root.position.x = THREE.MathUtils.lerp(p.root.position.x, p.beltTargetX, Math.min(1, dt * 5.2));
        }
      });
      if (state.beltJogTimer === 0 && state.phase === 'arriving') {
        state.phase = 'playing';
      }
    } else {
      counter.state.beltSpeed = THREE.MathUtils.lerp(counter.state.beltSpeed, 0, Math.min(1, dt * 10));
    }

    // Update dragged item smooth follow & weight tilt
    if (state.dragMode === 'product' && state.dragProduct) {
      const item = state.dragProduct;
      const prev = item.root.position.clone();
      const target = new THREE.Vector3(state.dragTargetPos.x, 0.165, state.dragTargetPos.z);
      item.root.position.lerp(target, Math.min(1, dt * 22));
      item.vel.copy(item.root.position).sub(prev).divideScalar(Math.max(0.001, dt));
      item.tiltZ = THREE.MathUtils.clamp(-item.vel.x * 0.10, -0.28, 0.28);
      item.tiltX = THREE.MathUtils.clamp(item.vel.z * 0.10, -0.22, 0.22);
    } else if (state.dragMode === 'bag') {
      bag.root.position.lerp(state.dragTargetPos, Math.min(1, dt * 18));
    }

    // Handheld gun quick-tap auto-aim animation
    if (state.gunTargetAnim) {
      const ga = state.gunTargetAnim;
      ga.t += dt;
      const p = Math.min(1, ga.t / ga.duration);
      const localDir = ga.targetPos.clone().sub(LAYOUT.gunDockPos);
      const yaw = Math.atan2(-localDir.x, -localDir.z);
      counter.gunGroup.rotation.y = THREE.MathUtils.lerp(counter.gunGroup.rotation.y, yaw, Math.min(1, dt * 14));
      counter.gunGroup.position.y = THREE.MathUtils.lerp(counter.gunGroup.position.y, 0.085, Math.min(1, dt * 14));
      counter.state.gunActive = 1.0 - p * 0.3;

      if (!ga.scanned && p > 0.32 && ga.item) {
        ga.scanned = true;
        handleScanProduct(ga.item, true);
      }
      if (p >= 1) {
        state.gunTargetAnim = null;
      }
    } else if (state.dragMode !== 'gun') {
      // Return handheld gun gently into its dock
      counter.gunGroup.rotation.y = THREE.MathUtils.lerp(counter.gunGroup.rotation.y, 0, Math.min(1, dt * 8));
      counter.gunGroup.position.y = THREE.MathUtils.lerp(counter.gunGroup.position.y, 0.025, Math.min(1, dt * 8));
    }

    // Update all products (flying arcs, visual micro-physics, scale weight sum!)
    let scaleWeightSum = 0;
    state.products.forEach((p) => {
      if (p.state === 'flying' && p.flyAnim) {
        const fa = p.flyAnim;
        fa.t += dt;
        const u = Math.min(1, fa.t / fa.duration);
        const ease = 1 - Math.pow(1 - u, 3);
        p.root.position.lerpVectors(fa.from, fa.to, ease);
        p.root.position.y += Math.sin(u * Math.PI) * fa.arcH;
        p.tiltZ = Math.sin(u * Math.PI) * 0.25;
        if (u >= 1) {
          p.flyAnim = null;
          p.tiltZ = 0;
          if (fa.onDone) fa.onDone();
        }
      } else if (p.state !== 'dragging') {
        p.tiltX = 0;
        p.tiltZ = 0;
        p.vel.multiplyScalar(0.85);
      }

      // Integrated Scanner Weight-Scale calculation (any product on or hovering directly over glass!)
      if (p.state !== 'bagged') {
        const dScan = Math.hypot(p.root.position.x - LAYOUT.scannerPos.x, p.root.position.z - LAYOUT.scannerPos.z);
        if (dScan < 0.21) {
          scaleWeightSum += p.weight;
        }
      }

      updateProductVisuals(p, dt, now);
    });
    counter.setScaleWeight(scaleWeightSum);

    // Next customer transition after celebration
    if (state.phase === 'celebrating' && state.nextCustomerTimer > 0) {
      state.nextCustomerTimer -= dt;
      if (state.nextCustomerTimer <= 0) {
        startCustomerRound(state.customerIndex + 1);
      }
    }

    // 10-second gentle single idle hint (strictly silent for first 10 seconds!)
    if (!state.dragMode && (state.phase === 'playing' || state.phase === 'readyHandover')) {
      state.idleSeconds += dt;
      if (state.idleSeconds > 10.5 && !state.hintShownThisStage) {
        state.hintShownThisStage = true;
        if (state.phase === 'readyHandover') {
          state.hintAnim = {
            t: 0,
            duration: 1.5,
            fromWorld: new THREE.Vector3(LAYOUT.bagPos.x, 0.22, LAYOUT.bagPos.z),
            midWorld: new THREE.Vector3(0.35, 0.26, -0.05),
            toWorld: new THREE.Vector3(0.22, 0.22, -0.35),
          };
        } else {
          const targetItem = state.products.find((p) => !p.scanned && p.state !== 'bagged')
            || state.products.find((p) => p.scanned && p.state !== 'bagged');
          if (targetItem) {
            const fromW = targetItem.root.position.clone();
            fromW.y += targetItem.height * 0.6;
            const toW = targetItem.scanned
              ? new THREE.Vector3(LAYOUT.bagPos.x, 0.24, LAYOUT.bagPos.z)
              : new THREE.Vector3(LAYOUT.scannerPos.x, 0.14, LAYOUT.scannerPos.z);
            const midW = fromW.clone().lerp(toW, 0.5);
            midW.y += 0.16;
            state.hintAnim = { t: 0, duration: 1.55, fromWorld: fromW, midWorld: midW, toWorld: toW };
          }
        }
      }
    }

    updateHintOverlay(dt);
  }

  // Launch Customer #1 immediately!
  startCustomerRound(0);

  return {
    state,
    update,
    startCustomerRound,
    handleScanProduct,
    handleBagProduct,
    completeHandover,
  };
}
