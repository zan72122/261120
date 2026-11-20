import * as THREE from 'three';

export const WORLD = {
  counterY: 0.0,
  counterFrontZ: 1.12,
  counterBackZ: 0.36,
  counterRightX: 0.25,
  fridgeCenterX: 0.02,
  fridgeWidth: 0.62,
  fridgeDepth: 0.48,
  fridgeFrontZ: 0.04,
  fridgeBackZ: -0.44,
};

function addBoxWithUV(w, h, d, uvScale = 1.0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ny > 0.5) {
      uv.setXY(i, x * uvScale, z * uvScale);
    } else if (nx > 0.5) {
      uv.setXY(i, z * uvScale, y * uvScale);
    } else {
      uv.setXY(i, x * uvScale, y * uvScale);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

// Photorealistic clear glass tumbler (single-pass Fresnel physical glass — ultra crisp AND super fast on iPhone!)
export function createDrinkingGlass() {
  const group = new THREE.Group();
  group.name = 'drinking_glass';

  // Real kitchen tumbler: 11.2cm tall, thick 13mm solid glass bottom, gentle tapered silhouette
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.0285, 0.0),
    new THREE.Vector2(0.0315, 0.003),
    new THREE.Vector2(0.0328, 0.015),
    new THREE.Vector2(0.0365, 0.072),
    new THREE.Vector2(0.0385, 0.110),
    new THREE.Vector2(0.0378, 0.1125),
    new THREE.Vector2(0.0364, 0.1125),
    new THREE.Vector2(0.0355, 0.110),
    new THREE.Vector2(0.0335, 0.070),
    new THREE.Vector2(0.0294, 0.018),
    new THREE.Vector2(0.0258, 0.014),
    new THREE.Vector2(0.0, 0.0135),
  ];

  const glassGeo = new THREE.LatheGeometry(pts, 32);
  glassGeo.computeVertexNormals();

  // Real physical glass with crisp HDRI reflections & soft bottle-glass tint
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eaf4f2'),
    roughness: 0.04,
    metalness: 0.05,
    ior: 1.52,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.55,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.renderOrder = 6;
  group.add(glassMesh);

  // Thick solid glass base optical catchlight (fast MeshStandardMaterial!)
  const baseDiscGeo = new THREE.CylinderGeometry(0.0308, 0.0295, 0.012, 24);
  const baseDiscMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#dcebe7'),
    roughness: 0.08,
    metalness: 0.14,
    envMapIntensity: 1.65,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
  baseDisc.position.y = 0.007;
  baseDisc.renderOrder = 5;
  group.add(baseDisc);

  // Subtle bright light-catching glass rim (fast MeshStandardMaterial!)
  const rimGeo = new THREE.TorusGeometry(0.0371, 0.0011, 8, 32);
  rimGeo.rotateX(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f4fbf9'),
    roughness: 0.12,
    metalness: 0.12,
    envMapIntensity: 1.6,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.y = 0.112;
  rim.renderOrder = 7;
  group.add(rim);

  // Dynamic milk liquid mesh inside glass (starts empty, rises smoothly during pouring!)
  const milkGroup = new THREE.Group();
  milkGroup.visible = false;

  const milkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbf7ee'),
    roughness: 0.18,
    metalness: 0.0,
    envMapIntensity: 0.78,
  });

  const milkColGeo = new THREE.CylinderGeometry(0.0342, 0.0288, 0.088, 24, 1, false);
  milkColGeo.translate(0, 0.044, 0);
  const milkCol = new THREE.Mesh(milkColGeo, milkMat);
  milkCol.position.y = 0.0145;
  milkCol.receiveShadow = true;
  milkCol.renderOrder = 3;
  milkGroup.add(milkCol);

  const foamRingGeo = new THREE.TorusGeometry(0.032, 0.0017, 10, 32);
  foamRingGeo.rotateX(Math.PI / 2);
  const foamMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fffdf9'),
    roughness: 0.45,
    metalness: 0.0,
    transparent: true,
    opacity: 0.85,
  });
  const foamRing = new THREE.Mesh(foamRingGeo, foamMat);
  foamRing.position.y = 0.0145;
  foamRing.renderOrder = 4;
  milkGroup.add(foamRing);

  group.add(milkGroup);

  function setFillLevel(level) {
    const t = THREE.MathUtils.clamp(level, 0, 1);
    if (t <= 0.005) {
      milkGroup.visible = false;
      return;
    }
    milkGroup.visible = true;
    milkCol.scale.set(1, t, 1);
    const topY = 0.0145 + 0.088 * t;
    const rad = THREE.MathUtils.lerp(0.0288, 0.0341, t);
    foamRing.position.y = topY;
    foamRing.scale.set(rad / 0.032, 1, rad / 0.032);
  }

  return { group, setFillLevel, milkGroup };
}

export function buildKitchen(pbr, cuttingBoardScene, contactShadowTex) {
  const kitchen = new THREE.Group();
  kitchen.name = 'kitchen_environment';

  // 1. Foreground Prep Island / Countertop (extends generously to Z = 1.12 so bottom frame is ALWAYS warm wood!)
  const counterW = 1.32;
  const counterD = WORLD.counterFrontZ - WORLD.counterBackZ; // 0.76m
  const counterH = 0.040;
  const counterGeo = addBoxWithUV(counterW, counterH, counterD, 1.35);
  const counter = new THREE.Mesh(counterGeo, pbr.counterWood);
  counter.position.set(WORLD.counterRightX - counterW / 2, -counterH / 2, WORLD.counterBackZ + counterD / 2);
  counter.receiveShadow = true;
  counter.castShadow = false;
  kitchen.add(counter);

  // Softly rounded wood bullnose edges
  const rightEdgeGeo = new THREE.CylinderGeometry(0.0055, 0.0055, counterD, 10);
  rightEdgeGeo.rotateX(Math.PI / 2);
  const rightEdge = new THREE.Mesh(rightEdgeGeo, pbr.counterWood);
  rightEdge.position.set(WORLD.counterRightX, -0.004, counter.position.z);
  kitchen.add(rightEdge);

  const backEdgeGeo = new THREE.CylinderGeometry(0.0055, 0.0055, counterW, 10);
  backEdgeGeo.rotateZ(Math.PI / 2);
  const backEdge = new THREE.Mesh(backEdgeGeo, pbr.counterWood);
  backEdge.position.set(counter.position.x, -0.004, WORLD.counterBackZ);
  kitchen.add(backEdge);

  // Left-side back counter (L-shaped kitchen!)
  const backCounterW = 0.85;
  const backCounterD = 0.80;
  const backCounter = new THREE.Mesh(addBoxWithUV(backCounterW, counterH, backCounterD, 1.35), pbr.counterWood);
  backCounter.position.set(-0.31 - backCounterW / 2, -counterH / 2, -0.44 + backCounterD / 2);
  backCounter.receiveShadow = true;
  backCounter.castShadow = false;
  kitchen.add(backCounter);

  // Matte off-white cabinet fronts underneath countertops
  const cabMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e0d9ce'),
    roughness: 0.72,
    metalness: 0.0,
  });
  const fgCab = new THREE.Mesh(new THREE.BoxGeometry(counterW - 0.03, 0.82, counterD - 0.04), cabMat);
  fgCab.position.set(counter.position.x, -counterH - 0.41, counter.position.z);
  fgCab.receiveShadow = true;
  kitchen.add(fgCab);

  const leftCab = new THREE.Mesh(new THREE.BoxGeometry(backCounterW - 0.02, 0.82, backCounterD - 0.02), cabMat);
  leftCab.position.set(backCounter.position.x, -counterH - 0.41, backCounter.position.z);
  leftCab.receiveShadow = true;
  kitchen.add(leftCab);

  // 2. Clean Ceramic Tile Backsplash (subtle warm morning gradient wall behind counter & fridge)
  const tileWall = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.45), pbr.backsplashTile);
  tileWall.position.set(-0.1, 0.50, -0.455);
  tileWall.receiveShadow = true;
  kitchen.add(tileWall);

  // Upper matte plaster wall & enclosing room walls
  const upperWall = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.6), pbr.plasterWall);
  upperWall.position.set(0.0, 1.55, -0.46);
  upperWall.receiveShadow = true;
  kitchen.add(upperWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.5), pbr.plasterWall);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-1.12, 0.55, 0.45);
  leftWall.receiveShadow = true;
  kitchen.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.5), pbr.plasterWall);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(1.28, 0.55, 0.45);
  rightWall.receiveShadow = true;
  kitchen.add(rightWall);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 3.8),
    new THREE.MeshStandardMaterial({ color: '#c4b6a6', roughness: 0.74 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.84, 0.5);
  floor.receiveShadow = true;
  kitchen.add(floor);

  // 3. Real Poly Haven Wooden Cutting Board on right-rear of foreground counter (serving stage for the glass!)
  if (cuttingBoardScene) {
    const board = cuttingBoardScene.clone(true);
    const box = new THREE.Box3().setFromObject(board);
    const size = box.getSize(new THREE.Vector3());
    const scale = 0.23 / Math.max(size.x, size.z);
    board.scale.setScalar(scale);
    board.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(board);
    board.position.set(0.115, -b2.min.y, 0.61);
    board.rotation.y = -0.10;
    kitchen.add(board);

    const bShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.16),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      })
    );
    bShadow.rotation.x = -Math.PI / 2;
    bShadow.rotation.z = 0.10;
    bShadow.position.set(0.115, 0.0012, 0.61);
    kitchen.add(bShadow);
  }

  // 4. Folded Woven Linen Cloth Coaster (soft square linen mat resting right on the cutting board!)
  const boardTopY = 0.0205;
  const glassX = 0.132;
  const glassZ = 0.625;

  const coasterGeo = new THREE.BoxGeometry(0.105, 0.004, 0.105, 8, 1, 8);
  // Subtle organic woven-cloth edge softness
  const cpos = coasterGeo.attributes.position;
  for (let i = 0; i < cpos.count; i++) {
    const x = cpos.getX(i);
    const y = cpos.getY(i);
    const z = cpos.getZ(i);
    if (y > 0) {
      const edge = Math.max(Math.abs(x), Math.abs(z)) / 0.0525;
      const drop = edge > 0.8 ? (edge - 0.8) * 0.006 : 0;
      const wave = 0.0004 * Math.sin(x * 70 + z * 55);
      cpos.setY(i, y - drop + wave);
    }
  }
  coasterGeo.computeVertexNormals();
  const coaster = new THREE.Mesh(coasterGeo, pbr.linenCloth);
  coaster.position.set(glassX, boardTopY + 0.002, glassZ);
  coaster.rotation.y = 0.16;
  coaster.receiveShadow = true;
  coaster.castShadow = false;
  kitchen.add(coaster);

  // 5. Crystal Clear Drinking Glass resting on the linen cloth on the wooden serving board!
  const glass = createDrinkingGlass();
  const glassBaseY = boardTopY + 0.004;
  glass.group.position.set(glassX, glassBaseY, glassZ);
  kitchen.add(glass.group);

  const glassShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.088, 0.088),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  glassShadow.rotation.x = -Math.PI / 2;
  glassShadow.position.set(glassX, glassBaseY + 0.0008, glassZ);
  kitchen.add(glassShadow);

  return {
    kitchen,
    glass,
    glassHome: new THREE.Vector3(glassX, glassBaseY, glassZ),
    coasterPos: new THREE.Vector3(glassX, boardTopY, glassZ),
  };
}
