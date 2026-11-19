import * as THREE from 'three';
import {
  createKraftPaperTextures,
  createWovenFabricTextures,
  createGoldStickerTexture,
  createReceiptTexture,
} from './textures.js';
import { LAYOUT } from './counter.js';

const BAG_STYLES = [
  { name: 'kraft', type: 'kraft', base: '#b5824a', handle: '#875c2f', inner: '#614120' },
  { name: 'tote', type: 'canvas', base: '#e5dac6', accent: '#234a73', striped: false, handle: '#1d3c5e', inner: '#8a806f' },
  { name: 'bakery', type: 'kraft', base: '#e6dccf', handle: '#9c2d3c', inner: '#948a7e' },
  { name: 'cooler', type: 'canvas', base: '#345c7d', accent: '#1e3a52', striped: true, handle: '#1a2026', inner: '#7f93a1' },
];

let sharedStickerTex = null;
let sharedReceiptTex = null;

export function createShoppingBag(scene) {
  if (!sharedStickerTex) sharedStickerTex = createGoldStickerTexture();
  if (!sharedReceiptTex) sharedReceiptTex = createReceiptTexture();

  const root = new THREE.Group();
  root.position.copy(LAYOUT.bagPos);
  scene.add(root);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const itemsContainer = new THREE.Group();
  bodyGroup.add(itemsContainer);

  const decorContainer = new THREE.Group();
  bodyGroup.add(decorContainer);

  const w = 0.27;
  const h = 0.255;
  const d = 0.21;
  const wallT = 0.009;

  const wallMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.85,
    metalness: 0.02,
    bumpScale: 0.004,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: '#6b4e2d',
    roughness: 0.92,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: '#9c7142',
    roughness: 0.72,
  });

  // Bottom slab
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, wallT, d), wallMat);
  bottom.position.y = wallT * 0.5 + 0.01;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  bodyGroup.add(bottom);

  // Dark recessed interior floor so bag looks deep and open
  const innerFloor = new THREE.Mesh(new THREE.PlaneGeometry(w - wallT * 2, d - wallT * 2), innerMat);
  innerFloor.rotation.x = -Math.PI / 2;
  innerFloor.position.y = wallT + 0.012;
  bodyGroup.add(innerFloor);

  // 4 outer walls (open top!)
  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), wallMat);
  frontWall.position.set(0, h * 0.5 + 0.01, d * 0.5 - wallT * 0.5);
  frontWall.castShadow = true;
  frontWall.receiveShadow = true;
  bodyGroup.add(frontWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), wallMat);
  backWall.position.set(0, h * 0.5 + 0.01, -d * 0.5 + wallT * 0.5);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  bodyGroup.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d - wallT * 2), wallMat);
  leftWall.position.set(-w * 0.5 + wallT * 0.5, h * 0.5 + 0.01, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  bodyGroup.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d - wallT * 2), wallMat);
  rightWall.position.set(w * 0.5 - wallT * 0.5, h * 0.5 + 0.01, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  bodyGroup.add(rightWall);

  // Folded top cuff rim around the bag mouth
  const cuffH = 0.018;
  const cuffFront = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, cuffH, wallT + 0.005), wallMat);
  cuffFront.position.set(0, h + 0.004, d * 0.5 - wallT * 0.5);
  bodyGroup.add(cuffFront);
  const cuffBack = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, cuffH, wallT + 0.005), wallMat);
  cuffBack.position.set(0, h + 0.004, -d * 0.5 + wallT * 0.5);
  bodyGroup.add(cuffBack);

  // Two realistic curved rope/ribbon handles that drape outward while open & rise upright when ready!
  function buildHandle() {
    const pivot = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.056, 0, 0),
      new THREE.Vector3(-0.052, 0.068, 0),
      new THREE.Vector3(0, 0.098, 0),
      new THREE.Vector3(0.052, 0.068, 0),
      new THREE.Vector3(0.056, 0, 0),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.0062, 8, false), handleMat);
    tube.castShadow = true;
    pivot.add(tube);
    return pivot;
  }

  const frontHandle = buildHandle();
  frontHandle.position.set(0, h + 0.006, d * 0.5 - 0.008);
  bodyGroup.add(frontHandle);

  const backHandle = buildHandle();
  backHandle.position.set(0, h + 0.006, -d * 0.5 + 0.008);
  bodyGroup.add(backHandle);

  // Subtle inner warm glow ring ONLY when bag is ready to hand to customer (zero text!)
  const readyGlowMat = new THREE.MeshBasicMaterial({
    color: '#ffe27a',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const readyHalo = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.21, 32), readyGlowMat);
  readyHalo.rotation.x = -Math.PI / 2;
  readyHalo.position.y = 0.016;
  root.add(readyHalo);

  // Generous invisible touch hitbox for grabbing/tapping the bag
  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.38, 0.30),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = 0.19;
  hitMesh.userData.interactive = 'bag';
  root.add(hitMesh);

  // Style textures cache
  const styleTextures = BAG_STYLES.map((st) => {
    if (st.type === 'kraft') {
      return createKraftPaperTextures(st.base);
    }
    return createWovenFabricTextures(st.base, st.accent, st.striped);
  });

  const state = {
    styleIndex: 0,
    items: [],
    readyToHandOver: false,
    handedOver: false,
    dragging: false,
    hasGoldSticker: false,
    hasReceipt: false,
    squash: 0,
    wobble: 0,
    wobblePhase: 0,
    handleAngle: 0.52,
    enterProgress: 1,
    hoverHighlight: false,
  };

  function setStyle(index) {
    state.styleIndex = index % BAG_STYLES.length;
    const st = BAG_STYLES[state.styleIndex];
    const tex = styleTextures[state.styleIndex];
    wallMat.map = tex.map;
    wallMat.bumpMap = tex.bumpMap;
    wallMat.needsUpdate = true;
    innerMat.color.set(st.inner);
    handleMat.color.set(st.handle);
  }
  setStyle(0);

  // Compute physical slot inside the open bag so packed items visibly peek out!
  function getSlotLocalPos(slotIndex, item) {
    const slots = [
      [-0.055, 0.024, -0.025],
      [0.055, 0.024, -0.020],
      [-0.048, 0.036, 0.035],
      [0.050, 0.042, 0.032],
      [0.0, 0.075, 0.0],
      [-0.025, 0.105, -0.01],
    ];
    const s = slots[slotIndex % slots.length];
    const yBoost = item.tall ? 0.015 : 0.085;
    return new THREE.Vector3(s[0], s[1] + yBoost, s[2]);
  }

  function addItem(item) {
    const slotIdx = state.items.length;
    state.items.push(item);
    item.bagSlotIndex = slotIdx;
    item.state = 'bagged';

    const localPos = getSlotLocalPos(slotIdx, item);
    itemsContainer.add(item.root);
    item.root.position.copy(localPos);
    item.root.rotation.set(
      (Math.random() - 0.5) * 0.14,
      (Math.random() - 0.5) * 0.65,
      (Math.random() - 0.5) * 0.16
    );
    item.visual.scale.setScalar(0.86);
    item.tiltX = 0;
    item.tiltZ = 0;

    state.squash = Math.min(1.0, 0.45 + item.weight * 0.55);
    state.wobble = 0.22;
  }

  function addGoldSticker() {
    if (state.hasGoldSticker) return false;
    state.hasGoldSticker = true;
    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.064, 0.064),
      new THREE.MeshPhysicalMaterial({
        map: sharedStickerTex,
        transparent: true,
        roughness: 0.16,
        metalness: 0.65,
        clearcoat: 1.0,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      })
    );
    sticker.position.set(0.03, 0.165, d * 0.5 + 0.004);
    sticker.rotation.z = -0.14;
    decorContainer.add(sticker);
    state.wobble = 0.18;
    return true;
  }

  function tuckReceipt() {
    if (state.hasReceipt) return false;
    state.hasReceipt = true;
    const slip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.052, 0.105),
      new THREE.MeshStandardMaterial({ map: sharedReceiptTex, roughness: 0.72, side: THREE.DoubleSide })
    );
    slip.position.set(-0.075, h + 0.025, d * 0.36);
    slip.rotation.set(0.24, 0.18, 0.14);
    decorContainer.add(slip);
    state.wobble = 0.16;
    return true;
  }

  function resetForNewCustomer(customerIndex) {
    state.items.forEach((it) => {
      if (it.root.parent) it.root.parent.remove(it.root);
    });
    state.items.length = 0;
    while (decorContainer.children.length > 0) {
      decorContainer.remove(decorContainer.children[0]);
    }
    state.readyToHandOver = false;
    state.handedOver = false;
    state.dragging = false;
    state.hasGoldSticker = false;
    state.hasReceipt = false;
    state.squash = 0.4;
    state.enterProgress = 0;
    setStyle(customerIndex);
    root.position.set(LAYOUT.bagPos.x + 0.35, 0.08, LAYOUT.bagPos.z);
    root.rotation.set(0, 0, 0);
    root.scale.setScalar(1);
    root.visible = true;
  }

  function update(dt, now) {
    if (state.enterProgress < 1 && !state.handedOver && !state.dragging) {
      state.enterProgress = Math.min(1, state.enterProgress + dt * 2.6);
      const ease = 1 - Math.pow(1 - state.enterProgress, 3);
      root.position.x = THREE.MathUtils.lerp(LAYOUT.bagPos.x + 0.35, LAYOUT.bagPos.x, ease);
      root.position.y = Math.sin(ease * Math.PI) * 0.06;
      root.position.z = LAYOUT.bagPos.z;
    }

    const fullness = Math.min(1, state.items.length / 4);
    if (state.squash > 0.001) {
      state.squash *= Math.exp(-dt * 9.5);
    }
    const sx = 1 + fullness * 0.08 + state.squash * 0.10 + (state.hoverHighlight ? 0.045 : 0);
    const sy = 1 - state.squash * 0.12 + (state.readyToHandOver ? Math.sin(now * 4.5) * 0.018 : 0);
    const sz = 1 + fullness * 0.10 + state.squash * 0.10 + (state.hoverHighlight ? 0.045 : 0);
    bodyGroup.scale.lerp(new THREE.Vector3(sx, sy, sz), Math.min(1, dt * 16));

    if (state.wobble > 0.002) {
      state.wobblePhase += dt * 18;
      state.wobble *= Math.exp(-dt * 6.5);
      bodyGroup.rotation.z = Math.sin(state.wobblePhase) * state.wobble * 0.25;
    } else if (state.readyToHandOver && !state.dragging && !state.handedOver) {
      bodyGroup.rotation.z = Math.sin(now * 3.8) * 0.032;
    } else {
      bodyGroup.rotation.z = THREE.MathUtils.lerp(bodyGroup.rotation.z, 0, Math.min(1, dt * 10));
    }

    const targetHandleAngle = state.readyToHandOver ? 0.06 : 0.62;
    state.handleAngle = THREE.MathUtils.lerp(state.handleAngle, targetHandleAngle, Math.min(1, dt * 7));
    frontHandle.rotation.x = state.handleAngle;
    backHandle.rotation.x = -state.handleAngle;

    const targetHalo = (state.readyToHandOver && !state.handedOver && !state.dragging)
      ? 0.42 + Math.sin(now * 4.5) * 0.18
      : (state.hoverHighlight ? 0.35 : 0.0);
    readyGlowMat.opacity = THREE.MathUtils.lerp(readyGlowMat.opacity, targetHalo, Math.min(1, dt * 10));
    readyHalo.scale.setScalar(1 + Math.sin(now * 4.0) * 0.05);
  }

  return {
    root,
    bodyGroup,
    itemsContainer,
    hitMesh,
    state,
    addItem,
    addGoldSticker,
    tuckReceipt,
    resetForNewCustomer,
    update,
  };
}
