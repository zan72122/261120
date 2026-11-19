import * as THREE from 'three';
import { createClothingTextures } from './textures.js';
import { LAYOUT } from './counter.js';

const CUSTOMER_STYLES = [
  {
    name: 'creamKnit',
    fabric: 'knit',
    primary: '#d8c3a8',
    secondary: '#b89f82',
    skin: '#f0c4a3',
    cuff: '#c4ab8e',
    hair: '#4a2e1f',
    hairStyle: 'ponytail',
    accent: '#c94a58', // hair ribbon
    basket: '#276b41',
  },
  {
    name: 'navyStripe',
    fabric: 'stripe',
    primary: '#ebe5da',
    secondary: '#22456e',
    skin: '#ebc09e',
    cuff: '#22456e',
    hair: '#2b2019',
    hairStyle: 'bob',
    accent: '#d99b38', // beret/headband
    basket: '#2f5f8c',
  },
  {
    name: 'terracotta',
    fabric: 'corduroy',
    primary: '#ad553b',
    secondary: '#823924',
    skin: '#e8b996',
    cuff: '#8c3f28',
    hair: '#694025',
    hairStyle: 'bun',
    accent: '#4a8562',
    basket: '#b87624',
  },
  {
    name: 'sageCardigan',
    fabric: 'knit',
    primary: '#7d9c82',
    secondary: '#5d7a62',
    skin: '#f2c9ac',
    cuff: '#68856d',
    hair: '#3a281d',
    hairStyle: 'beret',
    accent: '#a63848',
    basket: '#276b41',
  },
];

export function createCustomer(scene) {
  const root = new THREE.Group();
  root.position.set(0.0, 0.0, LAYOUT.customerZ);
  scene.add(root);

  const clothMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.88,
    bumpScale: 0.006,
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: '#c4ab8e',
    roughness: 0.86,
  });
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: '#f0c4a3',
    roughness: 0.48,
    clearcoat: 0.08,
  });
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: '#4a2e1f',
    roughness: 0.46,
    clearcoat: 0.28,
    clearcoatRoughness: 0.35,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: '#c94a58',
    roughness: 0.55,
  });
  const basketMat = new THREE.MeshPhysicalMaterial({
    color: '#276b41',
    roughness: 0.36,
    clearcoat: 0.32,
  });
  const basketInnerMat = new THREE.MeshStandardMaterial({
    color: '#19452a',
    roughness: 0.72,
  });
  const handleDarkMat = new THREE.MeshStandardMaterial({ color: '#1f2328', roughness: 0.52 });

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // --- Natural Sculpted Torso with Smooth Sloped Shoulders (Lathe profile, zero bulky sphere balls!) ---
  const torsoPts = [
    new THREE.Vector2(0.18, -0.10),
    new THREE.Vector2(0.195, 0.05),
    new THREE.Vector2(0.215, 0.22),
    new THREE.Vector2(0.225, 0.32),
    new THREE.Vector2(0.19, 0.385),
    new THREE.Vector2(0.115, 0.425),
    new THREE.Vector2(0.068, 0.44),
    new THREE.Vector2(0.0, 0.44),
  ];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 28), clothMat);
  torso.scale.set(1.16, 1.0, 0.64);
  torso.position.set(0, 0.0, -0.08);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  // Cozy ribbed sweater neckline
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.020, 12, 24), cuffMat);
  collar.rotation.x = Math.PI / 2 + 0.14;
  collar.position.set(0, 0.435, -0.07);
  bodyGroup.add(collar);

  // Smooth natural neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.052, 0.085, 18), skinMat);
  neck.position.set(0, 0.468, -0.072);
  neck.castShadow = true;
  bodyGroup.add(neck);

  // --- Warm, Friendly Sculpted Head (looks naturally down at the checkout counter & smiles!) ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.565, -0.058);
  bodyGroup.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.105, 28, 22), skinMat);
  headMesh.scale.set(0.95, 1.04, 0.96);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Subtle cute ears
  [-0.098, 0.098].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.020, 12, 10), skinMat);
    ear.scale.set(0.65, 1.1, 0.85);
    ear.position.set(ex, -0.006, -0.008);
    headGroup.add(ear);
  });

  // Soft delicate nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), skinMat);
  nose.scale.set(0.9, 0.85, 1.1);
  nose.position.set(0, -0.010, 0.100);
  headGroup.add(nose);

  // Warm soft rosy cheeks
  const cheekMat = new THREE.MeshStandardMaterial({
    color: '#e68c82',
    transparent: true,
    opacity: 0.36,
    roughness: 0.8,
  });
  [-0.054, 0.054].forEach((cx) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), cheekMat);
    cheek.scale.set(1.2, 0.72, 0.35);
    cheek.position.set(cx, -0.024, 0.084);
    headGroup.add(cheek);
  });

  // Glossy expressive dark eyes with crisp white catchlights
  const eyeDarkMat = new THREE.MeshPhysicalMaterial({
    color: '#1f1612',
    roughness: 0.08,
    clearcoat: 1.0,
  });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes = [];
  [-0.038, 0.038].forEach((ex) => {
    const eyePivot = new THREE.Group();
    eyePivot.position.set(ex, 0.008, 0.088);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 14, 12), eyeDarkMat);
    pupil.scale.set(0.95, 1.08, 0.65);
    eyePivot.add(pupil);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 8), catchlightMat);
    glint.position.set(0.0045, 0.0055, 0.009);
    eyePivot.add(glint);

    headGroup.add(eyePivot);
    eyes.push(eyePivot);
  });

  // Warm gentle curved smile
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.028, -0.038, 0.092),
    new THREE.Vector3(0, -0.048, 0.098),
    new THREE.Vector3(0.028, -0.038, 0.092),
  ]);
  const smileMat = new THREE.MeshStandardMaterial({ color: '#b55650', roughness: 0.45 });
  const smileMesh = new THREE.Mesh(new THREE.TubeGeometry(smileCurve, 12, 0.0042, 8, false), smileMat);
  headGroup.add(smileMesh);

  // Hair Base Cap & Natural Side-Parted Bangs
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);

  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.111, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.50),
    hairMat
  );
  hairCrown.scale.set(0.99, 1.04, 1.02);
  hairCrown.position.set(0, 0.012, -0.022);
  hairCrown.rotation.x = -0.42;
  hairCrown.castShadow = true;
  hairGroup.add(hairCrown);

  // Soft back hair volume (strictly behind the ears/face!)
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.104, 20, 16), hairMat);
  hairBack.scale.set(1.02, 1.00, 0.80);
  hairBack.position.set(0, -0.008, -0.046);
  hairBack.castShadow = true;
  hairGroup.add(hairBack);

  // Soft swept bangs perched cleanly above the eyebrows (never covering eyes!)
  const bangL = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), hairMat);
  bangL.scale.set(1.22, 0.45, 0.55);
  bangL.position.set(-0.044, 0.074, 0.056);
  bangL.rotation.set(0.10, 0.28, 0.30);
  hairGroup.add(bangL);

  const bangR = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), hairMat);
  bangR.scale.set(1.15, 0.42, 0.52);
  bangR.position.set(0.048, 0.072, 0.052);
  bangR.rotation.set(0.10, -0.28, -0.34);
  hairGroup.add(bangR);

  // Hair Style Variants (toggled cleanly per customer!)
  const ponytailGroup = new THREE.Group();
  const ponyTie = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.009, 10, 18), accentMat);
  ponyTie.position.set(0, 0.045, -0.115);
  ponytailGroup.add(ponyTie);
  const ponyTail = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.16, 16), hairMat);
  ponyTail.position.set(0, -0.025, -0.145);
  ponyTail.rotation.x = -0.35;
  ponytailGroup.add(ponyTail);
  hairGroup.add(ponytailGroup);

  const bunGroup = new THREE.Group();
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 14), hairMat);
  bun.position.set(0, 0.118, -0.045);
  bunGroup.add(bun);
  const bunBand = new THREE.Mesh(new THREE.TorusGeometry(0.040, 0.009, 10, 20), accentMat);
  bunBand.rotation.x = Math.PI / 2 - 0.35;
  bunBand.position.set(0, 0.098, -0.036);
  bunGroup.add(bunBand);
  hairGroup.add(bunGroup);

  const bobGroup = new THREE.Group();
  [-0.088, 0.088].forEach((bx) => {
    const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.085, 8, 12), hairMat);
    sideLock.position.set(bx, -0.035, -0.015);
    bobGroup.add(sideLock);
  });
  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.011, 10, 28, Math.PI), accentMat);
  headband.position.set(0, 0.022, 0.012);
  headband.rotation.x = -0.35;
  bobGroup.add(headband);
  hairGroup.add(bobGroup);

  const beretGroup = new THREE.Group();
  const beret = new THREE.Mesh(new THREE.SphereGeometry(0.115, 22, 14), accentMat);
  beret.scale.set(1.12, 0.42, 1.08);
  beret.position.set(0.018, 0.105, -0.010);
  beret.rotation.set(-0.18, 0, -0.22);
  beret.castShadow = true;
  beretGroup.add(beret);
  hairGroup.add(beretGroup);

  // --- Connected Upper Arm + Forearm + Expressive Hand ---
  function buildArm(side) {
    // Upper arm attached cleanly to shoulder
    const shoulderPos = new THREE.Vector3(side * 0.21, 0.34, -0.07);
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.16, 8, 14), clothMat);
    upperArm.castShadow = true;
    bodyGroup.add(upperArm);

    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.23, 0.18, 0.04);

    // Forearm sleeve
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, 0.22, 8, 14), clothMat);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, 0, 0.11);
    sleeve.castShadow = true;
    armPivot.add(sleeve);

    // Ribbed sweater cuff
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.038, 16), cuffMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(0, 0, 0.24);
    armPivot.add(cuff);

    // Sculpted Hand
    const hand = new THREE.Group();
    hand.position.set(0, 0, 0.285);
    armPivot.add(hand);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.025, 0.074), skinMat);
    palm.castShadow = true;
    hand.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.028, 6, 10), skinMat);
    thumb.position.set(-side * 0.041, -0.002, 0.012);
    thumb.rotation.set(Math.PI / 2, 0, side * 0.55);
    thumb.castShadow = true;
    hand.add(thumb);

    for (let f = 0; f < 4; f++) {
      const len = f === 1 || f === 2 ? 0.040 : 0.033;
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0082, len, 6, 10), skinMat);
      finger.position.set(-0.025 + f * 0.0165, -0.004, 0.050 + (f === 1 || f === 2 ? 0.004 : 0));
      finger.rotation.x = Math.PI / 2 + 0.16;
      finger.castShadow = true;
      hand.add(finger);
    }

    bodyGroup.add(armPivot);
    return { shoulderPos, upperArm, armPivot, hand };
  }

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  function alignUpperArm(arm) {
    // Orient upper arm cylinder seamlessly from shoulder socket to elbow pivot!
    const a = arm.shoulderPos;
    const b = arm.armPivot.position;
    arm.upperArm.position.copy(a).lerp(b, 0.5);
    const dir = b.clone().sub(a);
    const len = dir.length();
    arm.upperArm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    arm.upperArm.scale.set(1, Math.max(0.6, len / 0.22), 1);
  }

  // --- Realistic HOLLOW Open Supermarket Shopping Basket ---
  const basketGroup = new THREE.Group();
  basketGroup.position.set(-0.56, 0.0, 0.27);
  basketGroup.rotation.y = 0.18;
  root.add(basketGroup);

  const bW = 0.26, bH = 0.125, bD = 0.19, bT = 0.011;
  const bBottom = new THREE.Mesh(new THREE.BoxGeometry(bW, bT, bD), basketMat);
  bBottom.position.y = bT * 0.5;
  bBottom.castShadow = true;
  basketGroup.add(bBottom);

  const bFloorInner = new THREE.Mesh(new THREE.PlaneGeometry(bW - bT * 2, bD - bT * 2), basketInnerMat);
  bFloorInner.rotation.x = -Math.PI / 2;
  bFloorInner.position.y = bT + 0.002;
  basketGroup.add(bFloorInner);

  // 4 thin walls leaving the top genuinely OPEN & HOLLOW!
  const bFront = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bT), basketMat);
  bFront.position.set(0, bH * 0.5, bD * 0.5 - bT * 0.5);
  bFront.castShadow = true;
  basketGroup.add(bFront);
  const bBack = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bT), basketMat);
  bBack.position.set(0, bH * 0.5, -bD * 0.5 + bT * 0.5);
  bBack.castShadow = true;
  basketGroup.add(bBack);
  const bLeft = new THREE.Mesh(new THREE.BoxGeometry(bT, bH, bD - bT * 2), basketMat);
  bLeft.position.set(-bW * 0.5 + bT * 0.5, bH * 0.5, 0);
  bLeft.castShadow = true;
  basketGroup.add(bLeft);
  const bRight = new THREE.Mesh(new THREE.BoxGeometry(bT, bH, bD - bT * 2), basketMat);
  bRight.position.set(bW * 0.5 - bT * 0.5, bH * 0.5, 0);
  bRight.castShadow = true;
  basketGroup.add(bRight);

  // Molded hollow top rim (4 bars around perimeter — NOT a solid box!)
  const rimF = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.018, 0.018, 0.018), basketMat);
  rimF.position.set(0, bH, bD * 0.5 - 0.004);
  basketGroup.add(rimF);
  const rimB = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.018, 0.018, 0.018), basketMat);
  rimB.position.set(0, bH, -bD * 0.5 + 0.004);
  basketGroup.add(rimB);
  const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, bD + 0.004), basketMat);
  rimL.position.set(-bW * 0.5 + 0.004, bH, 0);
  basketGroup.add(rimL);
  const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, bD + 0.004), basketMat);
  rimR.position.set(bW * 0.5 - 0.004, bH, 0);
  basketGroup.add(rimR);

  // Resting dark carry handle folded cleanly along back rim
  const bHandleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.105, bH + 0.006, 0),
    new THREE.Vector3(-0.088, bH + 0.014, -0.09),
    new THREE.Vector3(0.088, bH + 0.014, -0.09),
    new THREE.Vector3(0.105, bH + 0.006, 0),
  ]);
  const bHandle = new THREE.Mesh(new THREE.TubeGeometry(bHandleCurve, 16, 0.0065, 8, false), handleDarkMat);
  basketGroup.add(bHandle);

  // Generous hit area for receiving bag
  const receiveHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.65, 0.65),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  receiveHit.position.set(0.16, 0.28, 0.25);
  receiveHit.userData.interactive = 'customer';
  root.add(receiveHit);

  // Prebuild clothing textures
  const styleTextures = CUSTOMER_STYLES.map((st) =>
    createClothingTextures(st.fabric, st.primary, st.secondary)
  );

  const state = {
    mode: 'entering', // 'entering' | 'waiting' | 'beckoning' | 'receiving' | 'leaving'
    styleIndex: 0,
    clapTimer: 0,
    receiveTimer: 0,
    carriedBag: null,
    targetX: 0.0,
    blinkTimer: 2.2,
  };

  function setStyle(idx) {
    state.styleIndex = idx % CUSTOMER_STYLES.length;
    const st = CUSTOMER_STYLES[state.styleIndex];
    const tex = styleTextures[state.styleIndex];
    clothMat.map = tex.map;
    clothMat.bumpMap = tex.bumpMap;
    clothMat.needsUpdate = true;
    cuffMat.color.set(st.cuff);
    skinMat.color.set(st.skin);
    hairMat.color.set(st.hair);
    accentMat.color.set(st.accent);
    basketMat.color.set(st.basket);

    ponytailGroup.visible = st.hairStyle === 'ponytail';
    bobGroup.visible = st.hairStyle === 'bob';
    bunGroup.visible = st.hairStyle === 'bun';
    beretGroup.visible = st.hairStyle === 'beret';
  }
  setStyle(0);

  function startCustomer(index) {
    setStyle(index);
    state.mode = 'entering';
    state.clapTimer = 0;
    state.receiveTimer = 0;
    state.carriedBag = null;
    state.targetX = 0.0;
    root.position.set(-1.35, 0.0, LAYOUT.customerZ);
  }

  function triggerHappyClap() {
    state.clapTimer = 0.62;
  }

  function setBeckoning(active) {
    if (state.mode === 'receiving' || state.mode === 'leaving') return;
    state.mode = active ? 'beckoning' : 'waiting';
  }

  function receiveBag(bag) {
    state.mode = 'receiving';
    state.receiveTimer = 0;
    state.carriedBag = bag;
  }

  function update(dt, now) {
    // Natural breathing
    bodyGroup.position.y = Math.sin(now * 2.1) * 0.007;

    // Natural soft blinking
    state.blinkTimer -= dt;
    let eyeScaleY = 1.0;
    if (state.blinkTimer < 0) {
      if (state.blinkTimer > -0.11) {
        eyeScaleY = 0.14;
      } else {
        state.blinkTimer = 2.6 + Math.random() * 2.4;
      }
    }
    eyes.forEach((e) => {
      e.scale.y = THREE.MathUtils.lerp(e.scale.y, eyeScaleY, Math.min(1, dt * 28));
    });

    if (state.mode === 'entering') {
      root.position.x = THREE.MathUtils.lerp(root.position.x, state.targetX, Math.min(1, dt * 4.5));
      bodyGroup.position.y += Math.abs(Math.sin(now * 8.5)) * 0.014 * Math.min(1, Math.abs(state.targetX - root.position.x) * 2);
      if (Math.abs(root.position.x - state.targetX) < 0.02) {
        root.position.x = state.targetX;
        state.mode = 'waiting';
      }
    } else if (state.mode === 'leaving') {
      root.position.x += dt * 1.05;
      bodyGroup.position.y += Math.abs(Math.sin(now * 8.5)) * 0.016;
    }

    // Warm expressive head gaze & nod
    let targetHeadX = 0.24; // gently looking down at the products/scanner!
    let targetHeadY = Math.sin(now * 0.9) * 0.08;
    let targetHeadZ = 0;

    // Arm animation targets per mode
    let lPos = new THREE.Vector3(-0.22, 0.16, 0.08);
    let rPos = new THREE.Vector3(0.22, 0.16, 0.08);
    let lRot = new THREE.Euler(0.16, 0.12, 0.0);
    let rRot = new THREE.Euler(0.16, -0.12, 0.0);

    if (state.clapTimer > 0) {
      state.clapTimer = Math.max(0, state.clapTimer - dt);
      const clap = Math.abs(Math.sin(state.clapTimer * 24));
      lPos.set(-0.08 - clap * 0.06, 0.22 + clap * 0.03, 0.17);
      rPos.set(0.08 + clap * 0.06, 0.22 + clap * 0.03, 0.17);
      lRot.set(-0.08, 0.42, -0.45);
      rRot.set(-0.08, -0.42, 0.45);
      targetHeadZ = Math.sin(state.clapTimer * 16) * 0.09;
    } else if (state.mode === 'beckoning') {
      const sway = Math.sin(now * 4.6) * 0.022;
      lPos.set(0.14, 0.19 + sway, 0.24);
      rPos.set(0.42, 0.19 + sway, 0.24);
      lRot.set(-0.10, 0.30, 0.22);
      rRot.set(-0.10, -0.22, -0.22);
      targetHeadY = 0.26; // looks eagerly toward the packed bag!
      targetHeadX = 0.28;
    } else if (state.mode === 'receiving') {
      state.receiveTimer += dt;
      const lift = Math.min(1, state.receiveTimer * 2.2);
      const bounce = Math.sin(Math.min(1, state.receiveTimer * 2.0) * Math.PI) * 0.045;
      // Right hand grips the bag handles cleanly from ABOVE (zero clipping into bag!)
      rPos.set(0.32, 0.34 + lift * 0.06 + bounce, 0.16 - lift * 0.04);
      rRot.set(0.12, -0.10, 0.0);

      // Left hand gives a joyful friendly wave!
      const wave = Math.sin(state.receiveTimer * 13) * 0.32;
      lPos.set(-0.24, 0.33 + lift * 0.04, 0.14);
      lRot.set(-0.68, 0.18, wave);

      targetHeadX = 0.10; // looks happily up toward the clerk!
      targetHeadZ = Math.sin(state.receiveTimer * 6) * 0.08;

      if (state.carriedBag) {
        // Hang bag cleanly BELOW the customer's hand gripping the handles!
        const bagWorld = new THREE.Vector3(0.32, 0.03 + lift * 0.06 + bounce, 0.44 - lift * 0.04).add(root.position);
        state.carriedBag.root.position.lerp(bagWorld, Math.min(1, dt * 10));
        state.carriedBag.root.rotation.z = THREE.MathUtils.lerp(state.carriedBag.root.rotation.z, Math.sin(now * 6) * 0.035, Math.min(1, dt * 8));
      }

      if (state.receiveTimer > 1.35) {
        state.mode = 'leaving';
      }
    } else if (state.mode === 'leaving') {
      const walkWave = Math.sin(now * 10) * 0.26;
      rPos.set(0.32, 0.38, 0.12);
      rRot.set(0.12, -0.10, 0);
      lPos.set(-0.24, 0.35, 0.12);
      lRot.set(-0.68, 0.18, walkWave);
      targetHeadX = 0.08;
      targetHeadY = -0.18;
      if (state.carriedBag) {
        const bagWorld = new THREE.Vector3(0.32, 0.07, 0.40).add(root.position);
        state.carriedBag.root.position.lerp(bagWorld, Math.min(1, dt * 14));
      }
    } else {
      const f = Math.sin(now * 2.4) * 0.007;
      lPos.set(-0.22, 0.15 + f, 0.08);
      rPos.set(0.22, 0.15 - f, 0.08);
    }

    const lerpRate = Math.min(1, dt * 9);
    headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, targetHeadX, lerpRate);
    headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, targetHeadY, lerpRate);
    headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, targetHeadZ, lerpRate);

    leftArm.armPivot.position.lerp(lPos, lerpRate);
    rightArm.armPivot.position.lerp(rPos, lerpRate);
    leftArm.armPivot.rotation.x = THREE.MathUtils.lerp(leftArm.armPivot.rotation.x, lRot.x, lerpRate);
    leftArm.armPivot.rotation.y = THREE.MathUtils.lerp(leftArm.armPivot.rotation.y, lRot.y, lerpRate);
    leftArm.armPivot.rotation.z = THREE.MathUtils.lerp(leftArm.armPivot.rotation.z, lRot.z, lerpRate);
    rightArm.armPivot.rotation.x = THREE.MathUtils.lerp(rightArm.armPivot.rotation.x, rRot.x, lerpRate);
    rightArm.armPivot.rotation.y = THREE.MathUtils.lerp(rightArm.armPivot.rotation.y, rRot.y, lerpRate);
    rightArm.armPivot.rotation.z = THREE.MathUtils.lerp(rightArm.armPivot.rotation.z, rRot.z, lerpRate);

    // Keep upper arms seamlessly joined to shoulders & elbows every frame!
    alignUpperArm(leftArm);
    alignUpperArm(rightArm);
  }

  return {
    root,
    state,
    receiveHit,
    startCustomer,
    triggerHappyClap,
    setBeckoning,
    receiveBag,
    update,
  };
}
