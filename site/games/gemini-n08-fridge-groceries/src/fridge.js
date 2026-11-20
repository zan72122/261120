import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD } from './kitchen.js';

function createAOLinerPlane(w, h, segX, segY, aoFn) {
  const geo = new THREE.PlaneGeometry(w, h, segX, segY);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) / w) + 0.5;
    const v = (pos.getY(i) / h) + 0.5;
    const shade = THREE.MathUtils.clamp(aoFn(u, v), 0.56, 1.0);
    // Cool crisp fridge shadow tone
    colors[i * 3 + 0] = shade * 0.965;
    colors[i * 3 + 1] = shade * 0.985;
    colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// Helper to merge non-indexed/indexed static boxes into a single draw call cleanly
function mergeBucket(geos) {
  const prepped = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    if (!ng.attributes.uv) {
      const count = ng.attributes.position.count;
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    return ng;
  });
  const merged = mergeGeometries(prepped, false);
  prepped.forEach((g) => g.dispose());
  return merged;
}

function boxAt(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

export function buildFridge(pbr) {
  const root = new THREE.Group();
  root.name = 'refrigerator';

  const W = WORLD.fridgeWidth;     // 0.62m
  const D = WORLD.fridgeDepth;     // 0.48m
  const wallT = 0.032;
  const innerW = W - wallT * 2;    // 0.556m
  const innerD = D - 0.045;        // 0.435m
  const cavityBottomY = -0.06;     // raised +4cm so frosted vegetable crisper sits clearly visible above foreground counter!
  const cavityTopY = 0.71;
  const cavityH = cavityTopY - cavityBottomY; // 0.77m
  const cx = WORLD.fridgeCenterX;
  const frontZ = WORLD.fridgeFrontZ;
  const backZ = WORLD.fridgeBackZ;
  const cz = (frontZ + backZ) / 2;

  const innerFrontZ = frontZ - 0.014;
  const innerBackZ = innerFrontZ - innerD;
  const innerMidZ = (innerFrontZ + innerBackZ) / 2;
  const innerMidY = (cavityBottomY + cavityTopY) / 2;

  // --- 1. MERGED STATIC EXTERIOR STAINLESS SHELL (1 draw call!) ---
  const steelGeos = [
    boxAt(wallT - 0.004, cavityH + 0.06, D, cx - W / 2 + (wallT - 0.004) / 2, innerMidY, cz),
    boxAt(wallT - 0.004, cavityH + 0.06, D, cx + W / 2 - (wallT - 0.004) / 2, innerMidY, cz),
    boxAt(W, 0.046, D, cx, cavityTopY + 0.028, cz),
    boxAt(W, 0.74, D, cx, cavityBottomY - 0.032 - 0.37, cz),
  ];
  const steelShell = new THREE.Mesh(mergeBucket(steelGeos), pbr.brushedSteel);
  steelShell.castShadow = false;
  steelShell.receiveShadow = true;
  root.add(steelShell);

  const freezerSeam = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.002, 0.014, 0.025),
    new THREE.MeshStandardMaterial({ color: '#454a50', roughness: 0.7, metalness: 0.25 })
  );
  freezerSeam.position.set(cx, cavityBottomY - 0.032, frontZ - 0.008);
  root.add(freezerSeam);

  // --- 2. MERGED INTERIOR LINER WITH BAKED CORNER AO (1 draw call!) ---
  const aoPlanes = [];
  const backGeo = createAOLinerPlane(innerW, cavityH, 10, 12, (u, v) => {
    const edgeX = Math.min(u, 1 - u);
    const edgeY = Math.min(v, 1 - v);
    const cornerAO = 0.70 + 0.30 * Math.min(1, edgeX * 5.8) * Math.min(1, edgeY * 4.2);
    const ledGrad = 0.80 + 0.20 * Math.pow(Math.max(0, v), 0.55);
    return cornerAO * ledGrad;
  });
  backGeo.translate(cx, innerMidY, innerBackZ);
  aoPlanes.push(backGeo);

  const sideAO = (u, v) => {
    const backAO = 0.68 + 0.32 * Math.min(1, u * 4.0);
    const edgeY = 0.78 + 0.22 * Math.min(1, Math.min(v, 1 - v) * 5.2);
    return backAO * edgeY;
  };
  const leftInnerGeo = createAOLinerPlane(innerD, cavityH, 8, 12, (u, v) => sideAO(u, v));
  leftInnerGeo.rotateY(Math.PI / 2);
  leftInnerGeo.translate(cx - innerW / 2, innerMidY, innerMidZ);
  aoPlanes.push(leftInnerGeo);

  const rightInnerGeo = createAOLinerPlane(innerD, cavityH, 8, 12, (u, v) => sideAO(1 - u, v));
  rightInnerGeo.rotateY(-Math.PI / 2);
  rightInnerGeo.translate(cx + innerW / 2, innerMidY, innerMidZ);
  aoPlanes.push(rightInnerGeo);

  const ceilGeo = createAOLinerPlane(innerW, innerD, 8, 8, (u, v) => 0.76 + 0.24 * Math.min(1, Math.min(u, 1 - u) * 5.2));
  ceilGeo.rotateX(Math.PI / 2);
  ceilGeo.translate(cx, cavityTopY, innerMidZ);
  aoPlanes.push(ceilGeo);

  const floorGeo = createAOLinerPlane(innerW, innerD, 8, 8, (u, v) => 0.72 + 0.28 * Math.min(1, Math.min(u, 1 - u) * 4.8));
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(cx, cavityBottomY, innerMidZ);
  aoPlanes.push(floorGeo);

  const linerMesh = new THREE.Mesh(mergeBucket(aoPlanes), pbr.fridgeLinerAO);
  linerMesh.receiveShadow = true;
  root.add(linerMesh);

  // --- 3. MERGED MOLDED WHITE PLASTIC HARDWARE (bezel, vent tower, shelf rails, rear shelf lips, LED housing -> 1 draw call!) ---
  const shelfYs = [0.155, 0.355, 0.540];
  const whiteHardwareGeos = [
    boxAt(W - 0.008, 0.030, 0.016, cx, cavityTopY + 0.014, frontZ - 0.006),
    boxAt(W - 0.008, 0.026, 0.016, cx, cavityBottomY - 0.014, frontZ - 0.006),
    boxAt(0.030, cavityH + 0.024, 0.016, cx - (W / 2 - 0.016), innerMidY, frontZ - 0.006),
    boxAt(0.030, cavityH + 0.024, 0.016, cx + (W / 2 - 0.016), innerMidY, frontZ - 0.006),
    boxAt(0.132, cavityH - 0.14, 0.016, cx, innerMidY + 0.02, innerBackZ + 0.008),
    boxAt(0.28, 0.014, 0.044, cx, cavityTopY - 0.007, innerFrontZ - 0.075),
  ];

  const chromeGeos = [
    boxAt(0.086, 0.005, 0.005, cx, cavityTopY - 0.085, innerBackZ + 0.017),
  ];
  const slotGeos = [];
  for (let i = 0; i < 5; i++) {
    const yOff = cavityTopY - 0.13 - i * 0.105;
    slotGeos.push(boxAt(0.078, 0.008, 0.005, cx, yOff, innerBackZ + 0.016));
  }

  // Subtle physical temperature control dial (purely geometric, zero text!) at top of vent tower
  const dialGeo = new THREE.CylinderGeometry(0.015, 0.016, 0.010, 20);
  dialGeo.rotateX(Math.PI / 2);
  dialGeo.translate(cx, cavityTopY - 0.062, innerBackZ + 0.018);
  chromeGeos.push(dialGeo);

  const glassShelfMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d2ece4'),
    roughness: 0.08,
    metalness: 0.14,
    envMapIntensity: 1.4,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });

  const glassPaneGeos = [];
  const greenEdgeGeos = [];
  const shelfData = [];

  for (let i = 0; i < shelfYs.length; i++) {
    const sy = shelfYs[i];
    const sW = innerW - 0.008;
    const sD = i === 0 ? innerD - 0.014 : innerD - 0.042;
    const sZ = innerBackZ + 0.012 + sD / 2;

    whiteHardwareGeos.push(boxAt(0.012, 0.010, innerD - 0.03, cx - (innerW / 2 - 0.006), sy - 0.008, innerMidZ));
    whiteHardwareGeos.push(boxAt(0.012, 0.010, innerD - 0.03, cx + (innerW / 2 - 0.006), sy - 0.008, innerMidZ));
    whiteHardwareGeos.push(boxAt(sW, 0.012, 0.008, cx, sy + 0.002, sZ - sD / 2 - 0.003));

    glassPaneGeos.push(boxAt(sW, 0.006, sD, cx, sy - 0.003, sZ));
    chromeGeos.push(boxAt(sW + 0.002, 0.011, 0.010, cx, sy - 0.003, sZ + sD / 2 + 0.004));
    greenEdgeGeos.push(boxAt(sW - 0.006, 0.0055, 0.005, cx, sy - 0.003, sZ + sD / 2 - 0.002));

    shelfData.push({
      id: i === 0 ? 'shelf_lower' : i === 1 ? 'shelf_mid' : 'shelf_top',
      y: sy,
      minX: cx - sW / 2 + 0.055,
      maxX: cx + sW / 2 - 0.055,
      minZ: sZ - sD / 2 + 0.06,
      maxZ: sZ + sD / 2 - 0.05,
    });
  }

  const whiteHardware = new THREE.Mesh(mergeBucket(whiteHardwareGeos), pbr.fridgeLiner);
  whiteHardware.receiveShadow = true;
  root.add(whiteHardware);

  const chromeHardware = new THREE.Mesh(mergeBucket(chromeGeos), pbr.chromeTrim);
  chromeHardware.castShadow = false;
  chromeHardware.receiveShadow = true;
  root.add(chromeHardware);

  const ventSlots = new THREE.Mesh(
    mergeBucket(slotGeos),
    new THREE.MeshStandardMaterial({ color: '#86919c', roughness: 0.72, metalness: 0.1 })
  );
  root.add(ventSlots);

  const glassPanes = new THREE.Mesh(mergeBucket(glassPaneGeos), glassShelfMat);
  glassPanes.receiveShadow = true;
  glassPanes.renderOrder = 2;
  root.add(glassPanes);

  const greenEdges = new THREE.Mesh(
    mergeBucket(greenEdgeGeos),
    new THREE.MeshStandardMaterial({ color: '#7cbcae', roughness: 0.16, metalness: 0.08, transparent: true, opacity: 0.88 })
  );
  root.add(greenEdges);

  // --- 4. INTERIOR COOL-DAYLIGHT LED LIGHT BAR (contrasts richly against warm kitchen sunlight!) ---
  const ledLensMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f7fbff'),
    emissive: new THREE.Color('#e6f3ff'),
    emissiveIntensity: 2.8,
    roughness: 0.25,
  });
  const ledLens = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.006, 0.026), ledLensMat);
  ledLens.position.set(cx, cavityTopY - 0.014, innerFrontZ - 0.075);
  root.add(ledLens);

  // Crisp cool-white (~5800K) refrigerator LED interior lighting vs warm (~4200K) kitchen morning sun!
  const fridgeLightTop = new THREE.PointLight('#eaf4ff', 1.35, 1.65, 1.8);
  fridgeLightTop.position.set(cx, cavityTopY - 0.07, innerFrontZ - 0.05);
  root.add(fridgeLightTop);

  const fridgeLightCrisper = new THREE.PointLight('#e8f4ff', 0.62, 1.05, 1.8);
  fridgeLightCrisper.position.set(cx, 0.08, innerFrontZ - 0.01);
  root.add(fridgeLightCrisper);

  // --- 5. VEGETABLE CRISPER DRAWER (merged opaque tray + frosted translucent acrylic front!) ---
  const crisperGroup = new THREE.Group();
  crisperGroup.name = 'crisper_drawer';
  const cW = innerW - 0.022;
  const cH = 0.195;
  const cD = innerD - 0.035;
  const cWall = 0.007;
  const cBaseZ = innerBackZ + 0.02 + cD / 2;
  const cBaseY = cavityBottomY + 0.008;

  const crisperOpaqueGeos = [
    boxAt(cW, cWall, cD, cx, cBaseY + cWall / 2, cBaseZ),
    boxAt(cW, cH, cWall, cx, cBaseY + cH / 2, cBaseZ - cD / 2 + cWall / 2),
    boxAt(cWall, cH, cD, cx - (cW / 2 - cWall / 2), cBaseY + cH / 2, cBaseZ),
    boxAt(cWall, cH, cD, cx + (cW / 2 - cWall / 2), cBaseY + cH / 2, cBaseZ),
    boxAt(cW + 0.004, 0.016, 0.014, cx, cBaseY + cH - 0.005, cBaseZ + cD / 2 + 0.002),
    boxAt(cW + 0.004, 0.012, 0.012, cx, cBaseY + 0.006, cBaseZ + cD / 2 + 0.001),
  ];
  for (let r = -3; r <= 3; r++) {
    crisperOpaqueGeos.push(boxAt(cW - 0.03, 0.003, 0.004, cx, cBaseY + cWall + 0.0015, cBaseZ + r * 0.045));
  }
  const crisperBody = new THREE.Mesh(
    mergeBucket(crisperOpaqueGeos),
    new THREE.MeshStandardMaterial({ color: '#e8eff4', roughness: 0.34, metalness: 0.0, envMapIntensity: 0.65 })
  );
  crisperBody.receiveShadow = true;
  crisperGroup.add(crisperBody);

  const crisperFrontMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dfeff4'),
    roughness: 0.20,
    metalness: 0.08,
    envMapIntensity: 1.25,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const cFront = new THREE.Mesh(new THREE.BoxGeometry(cW, cH, cWall), crisperFrontMat);
  cFront.position.set(cx, cBaseY + cH / 2, cBaseZ + cD / 2 - cWall / 2);
  cFront.renderOrder = 3;
  crisperGroup.add(cFront);

  const cHandle = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.013, 0.018), pbr.chromeTrim);
  cHandle.position.set(cx, cBaseY + cH - 0.018, cBaseZ + cD / 2 + 0.010);
  cHandle.castShadow = false;
  crisperGroup.add(cHandle);

  root.add(crisperGroup);

  // --- 6. SWINGING STAINLESS DOOR WITH MERGED GASKET & TRANSLUCENT DOOR POCKETS ---
  const doorPivot = new THREE.Group();
  doorPivot.name = 'fridge_door_pivot';
  doorPivot.position.set(cx + W / 2, 0, frontZ);

  const doorH = cavityH + 0.072;
  const doorThick = 0.048;
  const doorMidY = innerMidY;

  const doorOuter = new THREE.Mesh(new THREE.BoxGeometry(W, doorH, doorThick * 0.62), pbr.brushedSteel);
  doorOuter.position.set(-W / 2, doorMidY, doorThick * 0.69);
  doorOuter.castShadow = true;
  doorOuter.receiveShadow = true;
  doorPivot.add(doorOuter);

  const gT = 0.016;
  const gD = 0.014;
  const gasketGeos = [
    boxAt(W - 0.024, gT, gD, -W / 2, doorMidY + doorH / 2 - 0.018, -gD / 2),
    boxAt(W - 0.024, gT, gD, -W / 2, doorMidY - doorH / 2 + 0.018, -gD / 2),
    boxAt(gT, doorH - 0.036, gD, -0.02, doorMidY, -gD / 2),
    boxAt(gT, doorH - 0.036, gD, -W + 0.02, doorMidY, -gD / 2),
  ];
  doorPivot.add(new THREE.Mesh(mergeBucket(gasketGeos), pbr.rubberGasket));

  const doorWhiteGeos = [
    boxAt(W - 0.012, doorH - 0.012, doorThick * 0.36, -W / 2, doorMidY, doorThick * 0.18),
  ];
  const doorChromeGeos = [
    boxAt(0.018, 0.34, 0.022, -W + 0.008, 0.28, doorThick * 0.92),
  ];
  const doorPocketGlassGeos = [];

  const pocketDefs = [
    { id: 'door_pocket_lower', yBottom: 0.085, pDepth: 0.105, guardH: 0.082 },
    { id: 'door_pocket_upper', yBottom: 0.405, pDepth: 0.095, guardH: 0.056 },
  ];
  const pockets = [];
  for (const pd of pocketDefs) {
    const pW = W - 0.11;
    const pX = -W / 2;
    const wall = 0.005;
    doorWhiteGeos.push(boxAt(pW, 0.008, pd.pDepth, pX, pd.yBottom, -pd.pDepth / 2));
    doorWhiteGeos.push(boxAt(wall, pd.guardH, pd.pDepth, pX - (pW / 2 - wall / 2), pd.yBottom + pd.guardH / 2, -pd.pDepth / 2));
    doorWhiteGeos.push(boxAt(wall, pd.guardH, pd.pDepth, pX + (pW / 2 - wall / 2), pd.yBottom + pd.guardH / 2, -pd.pDepth / 2));
    doorChromeGeos.push(boxAt(pW + 0.004, 0.009, 0.009, pX, pd.yBottom + pd.guardH + 0.002, -pd.pDepth + wall / 2));
    doorPocketGlassGeos.push(boxAt(pW, pd.guardH, wall, pX, pd.yBottom + pd.guardH / 2, -pd.pDepth + wall / 2));

    pockets.push({
      id: pd.id,
      localY: pd.yBottom + 0.005,
      localZ: -pd.pDepth / 2,
      minLocalX: pX - pW / 2 + 0.055,
      maxLocalX: pX + pW / 2 - 0.055,
      depth: pd.pDepth,
    });
  }

  const doorInnerMesh = new THREE.Mesh(mergeBucket(doorWhiteGeos), pbr.fridgeLiner);
  doorInnerMesh.receiveShadow = true;
  doorPivot.add(doorInnerMesh);

  doorPivot.add(new THREE.Mesh(mergeBucket(doorChromeGeos), pbr.chromeTrim));

  const pocketGlassMesh = new THREE.Mesh(
    mergeBucket(doorPocketGlassGeos),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e0f0f6'),
      roughness: 0.14,
      metalness: 0.10,
      envMapIntensity: 1.35,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    })
  );
  pocketGlassMesh.renderOrder = 3;
  doorPivot.add(pocketGlassMesh);

  let doorAngle = 1.74;
  let targetDoorAngle = 1.74;
  let crisperSlide = 0.0;
  let targetCrisperSlide = 0.0;
  doorPivot.rotation.y = doorAngle;

  root.add(doorPivot);

  function setDoorTarget(angle) {
    targetDoorAngle = THREE.MathUtils.clamp(angle, 0.0, 2.02);
  }
  function setCrisperTarget(slide) {
    targetCrisperSlide = THREE.MathUtils.clamp(slide, 0.0, 0.175);
  }

  function update(dt) {
    const prevDoor = doorAngle;
    const prevCrisper = crisperSlide;
    const k = 1 - Math.exp(-8.5 * dt);
    doorAngle += (targetDoorAngle - doorAngle) * k;
    doorPivot.rotation.y = doorAngle;

    crisperSlide += (targetCrisperSlide - crisperSlide) * k;
    crisperGroup.position.z = crisperSlide;

    const lightOn = THREE.MathUtils.smoothstep(doorAngle, 0.03, 0.35);
    ledLensMat.emissiveIntensity = 0.15 + 2.65 * lightOn;
    fridgeLightTop.intensity = 1.35 * lightOn;
    fridgeLightCrisper.intensity = 0.62 * lightOn;

    return Math.abs(doorAngle - prevDoor) > 0.0005 || Math.abs(crisperSlide - prevCrisper) > 0.0004;
  }

  return {
    root,
    doorPivot,
    crisperGroup,
    shelves: shelfData,
    pockets,
    crisperBounds: {
      y: cBaseY + cWall + 0.004,
      minX: cx - cW / 2 + 0.055,
      maxX: cx + cW / 2 - 0.055,
      minZ: cBaseZ - cD / 2 + 0.055,
      maxZ: cBaseZ + cD / 2 - 0.055,
    },
    getDoorAngle: () => doorAngle,
    getCrisperSlide: () => crisperSlide,
    setDoorTarget,
    setCrisperTarget,
    update,
  };
}
