import * as THREE from 'three';
import {
  createBrushedSteelTextures,
  createMarbleTextures,
  createSubwayTileTextures,
  createOakWoodTextures,
  createTowelTextures,
  createSpongeTextures,
  createCorkCoasterTexture
} from './textures.js';

export const SINK = {
  minX: -1.12,
  maxX: 1.12,
  minZ: -0.78,
  maxZ: 0.78,
  width: 2.24,
  depth: 1.56,
  bottomY: -0.54,
  rimY: 0.0,
  drainX: 0.0,
  drainZ: -0.08,
  spoutPos: new THREE.Vector3(0.0, 0.90, -0.34),
  towelHome: new THREE.Vector3(1.52, 0.065, 0.36),
  dryingZone: new THREE.Vector3(1.50, 0.035, 0.14),
  spongeHome: new THREE.Vector3(-0.98, 0.065, 0.90),
  soapPos: new THREE.Vector3(-1.38, 0.0, -0.58),
  shelfY: 1.72,
  shelfZ: -1.20,
  coasterSpots: [
    new THREE.Vector3(-1.20, 1.768, -1.18),
    new THREE.Vector3(-0.60, 1.768, -1.18),
    new THREE.Vector3(0.0, 1.768, -1.18),
    new THREE.Vector3(0.60, 1.768, -1.18),
    new THREE.Vector3(1.20, 1.768, -1.18)
  ]
};

export function createKitchen(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const steelTex = createBrushedSteelTextures();
  const marbleTex = createMarbleTextures();
  const tileTex = createSubwayTileTextures();
  const oakTex = createOakWoodTextures();
  const towelTex = createTowelTextures();
  const spongeTex = createSpongeTextures();
  const corkTex = createCorkCoasterTexture();

  // --- Materials ---
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xd8dfe6,
    map: steelTex.map,
    roughnessMap: steelTex.roughnessMap,
    bumpMap: steelTex.bumpMap,
    bumpScale: 0.004,
    metalness: 0.78,
    roughness: 0.30,
    envMapIntensity: 1.25
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fa,
    metalness: 0.98,
    roughness: 0.07,
    envMapIntensity: 1.35
  });

  const marbleMat = new THREE.MeshStandardMaterial({
    map: marbleTex.map,
    roughnessMap: marbleTex.roughnessMap,
    metalness: 0.02,
    roughness: 0.24,
    envMapIntensity: 0.85
  });

  const tileMat = new THREE.MeshStandardMaterial({
    map: tileTex.map,
    bumpMap: tileTex.bumpMap,
    bumpScale: 0.012,
    roughnessMap: tileTex.roughnessMap,
    metalness: 0.0,
    roughness: 0.22,
    envMapIntensity: 0.95
  });

  const oakMat = new THREE.MeshStandardMaterial({
    map: oakTex.map,
    bumpMap: oakTex.bumpMap,
    bumpScale: 0.008,
    metalness: 0.0,
    roughness: 0.56
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9a362,
    metalness: 0.88,
    roughness: 0.26
  });

  // --- 1. Subway Tile Backsplash Wall ---
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14.0, 9.0), tileMat);
  wall.position.set(0, 4.0, -1.48);
  wall.receiveShadow = true;
  root.add(wall);

  // Subtle marble backsplash curb strip along wall/counter joint
  const curb = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.11, 0.045), marbleMat);
  curb.position.set(0, 0.055, -1.455);
  curb.receiveShadow = true;
  root.add(curb);

  // --- 2. Honed Marble Countertop (4 slabs surrounding the sink cutout) ---
  const counterThick = 0.16;
  const counterY = -counterThick * 0.5;
  const counterFrontZ = 1.28;
  const counterBackZ = -1.48;

  // Back slab
  const backDepth = Math.abs(SINK.minZ - counterBackZ);
  const backSlab = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, counterThick, backDepth),
    marbleMat
  );
  backSlab.position.set(0, counterY, (SINK.minZ + counterBackZ) * 0.5);
  backSlab.receiveShadow = true;
  backSlab.castShadow = true;
  root.add(backSlab);

  // Front slab
  const frontDepth = counterFrontZ - SINK.maxZ;
  const frontSlab = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, counterThick, frontDepth),
    marbleMat
  );
  frontSlab.position.set(0, counterY, (SINK.maxZ + counterFrontZ) * 0.5);
  frontSlab.receiveShadow = true;
  frontSlab.castShadow = true;
  root.add(frontSlab);

  // Left slab
  const sideWidth = 4.2;
  const leftSlab = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, counterThick, SINK.depth),
    marbleMat
  );
  leftSlab.position.set(SINK.minX - sideWidth * 0.5, counterY, 0);
  leftSlab.receiveShadow = true;
  leftSlab.castShadow = true;
  root.add(leftSlab);

  // Right slab
  const rightSlab = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, counterThick, SINK.depth),
    marbleMat
  );
  rightSlab.position.set(SINK.maxX + sideWidth * 0.5, counterY, 0);
  rightSlab.receiveShadow = true;
  rightSlab.castShadow = true;
  root.add(rightSlab);

  // Smooth chamfered front marble bullnose edge
  const bullnose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 10.5, 12),
    marbleMat
  );
  bullnose.rotation.z = Math.PI / 2;
  bullnose.position.set(0, -0.025, counterFrontZ);
  root.add(bullnose);

  // --- 3. Lower Warm Oak Kitchen Cabinetry (front apron & under-sink structure — leaves sink basin 100% hollow!) ---
  const cabFrontApron = new THREE.Mesh(new THREE.BoxGeometry(11.5, 4.8, 0.24), oakMat);
  cabFrontApron.position.set(0, -2.56, 1.05);
  cabFrontApron.receiveShadow = true;
  root.add(cabFrontApron);

  // Solid base below the sink basin (y <= -0.92)
  const cabLowerBase = new THREE.Mesh(new THREE.BoxGeometry(11.5, 4.0, 2.3), oakMat);
  cabLowerBase.position.set(0, -2.96, 0.02);
  cabLowerBase.receiveShadow = true;
  root.add(cabLowerBase);

  // Subtle dark shadow-gap reveal right beneath marble bullnose
  const cabShadowStrip = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.04, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x3b2d21, roughness: 0.9 })
  );
  cabShadowStrip.position.set(0, -0.18, 1.18);
  root.add(cabShadowStrip);

  // Subtle shaker cabinet door panels & brass pulls
  for (let i = -2; i <= 2; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.52, 2.05, 0.04), oakMat);
    panel.position.set(i * 1.62, -1.32, 1.18);
    panel.receiveShadow = true;
    root.add(panel);

    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.065, 16), brassMat);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(i * 1.62 + (i <= 0 ? 0.58 : -0.58), -0.46, 1.22);
    root.add(knob);
  }

  // --- 4. Brushed Stainless Steel Sink Basin ---
  const sinkGroup = new THREE.Group();
  root.add(sinkGroup);

  const w = SINK.width;
  const d = SINK.depth;
  const h = Math.abs(SINK.bottomY);
  const wallT = 0.04;

  // Sink floor
  const basinFloor = new THREE.Mesh(new THREE.BoxGeometry(w, wallT, d), steelMat);
  basinFloor.position.set(0, SINK.bottomY - wallT * 0.5, 0);
  basinFloor.receiveShadow = true;
  sinkGroup.add(basinFloor);

  // 4 inner stainless walls (flush inside the cutout and sealed tightly up to the steel rim!)
  const wallH = h + 0.025;
  const wallCenterY = -h * 0.5 + 0.012;
  const basinBack = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, wallH, wallT), steelMat);
  basinBack.position.set(0, wallCenterY, SINK.minZ + wallT * 0.25);
  basinBack.receiveShadow = true;
  sinkGroup.add(basinBack);

  const basinFront = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, wallH, wallT), steelMat);
  basinFront.position.set(0, wallCenterY, SINK.maxZ - wallT * 0.25);
  basinFront.receiveShadow = true;
  sinkGroup.add(basinFront);

  const basinLeft = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, d + 0.04), steelMat);
  basinLeft.position.set(SINK.minX + wallT * 0.25, wallCenterY, 0);
  basinLeft.receiveShadow = true;
  sinkGroup.add(basinLeft);

  const basinRight = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, d + 0.04), steelMat);
  basinRight.position.set(SINK.maxX - wallT * 0.25, wallCenterY, 0);
  basinRight.receiveShadow = true;
  sinkGroup.add(basinRight);

  // Rounded inner bottom fillets (for photorealistic specular catch along basin seams)
  const filletGeoX = new THREE.CylinderGeometry(0.055, 0.055, w, 12);
  filletGeoX.rotateZ(Math.PI / 2);
  const fBack = new THREE.Mesh(filletGeoX, steelMat);
  fBack.position.set(0, SINK.bottomY + 0.025, SINK.minZ + 0.025);
  sinkGroup.add(fBack);
  const fFront = new THREE.Mesh(filletGeoX, steelMat);
  fFront.position.set(0, SINK.bottomY + 0.025, SINK.maxZ - 0.025);
  sinkGroup.add(fFront);

  // Top-mount beveled stainless rim frame around the sink
  const rimThick = 0.024;
  const rimW = 0.07;
  const rimTopY = 0.012;
  const rimParts = [
    [w + rimW * 2, rimThick, rimW, 0, rimTopY, SINK.minZ - rimW * 0.45],
    [w + rimW * 2, rimThick, rimW, 0, rimTopY, SINK.maxZ + rimW * 0.45],
    [rimW, rimThick, d, SINK.minX - rimW * 0.45, rimTopY, 0],
    [rimW, rimThick, d, SINK.maxX + rimW * 0.45, rimTopY, 0]
  ];
  rimParts.forEach(([rw, rh, rd, x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), steelMat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = true;
    sinkGroup.add(m);
  });

  // Drain strainer bezel + dark drain hole at bottom center
  const drainGroup = new THREE.Group();
  drainGroup.position.set(SINK.drainX, SINK.bottomY + 0.005, SINK.drainZ);
  sinkGroup.add(drainGroup);

  const drainRing = new THREE.Mesh(
    new THREE.RingGeometry(0.11, 0.175, 32),
    chromeMat
  );
  drainRing.rotation.x = -Math.PI / 2;
  drainRing.position.y = 0.004;
  drainGroup.add(drainRing);

  const drainHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.112, 32),
    new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.85, metalness: 0.3 })
  );
  drainHole.rotation.x = -Math.PI / 2;
  drainHole.position.y = 0.002;
  drainGroup.add(drainHole);

  // Drain strainer crossbars (visible when unplugged!)
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.008, 0.014), chromeMat);
    bar.rotation.y = (i * Math.PI) / 3;
    bar.position.y = 0.005;
    drainGroup.add(bar);
  }

  // Rubber Drain Plug with shiny chrome pull-ring
  const plugGroup = new THREE.Group();
  plugGroup.position.set(SINK.drainX, SINK.bottomY + 0.012, SINK.drainZ);
  sinkGroup.add(plugGroup);

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f35,
    roughness: 0.68,
    metalness: 0.05
  });
  const plugDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.108, 0.036, 28), rubberMat);
  plugDisc.position.y = 0.015;
  plugDisc.castShadow = true;
  plugGroup.add(plugDisc);

  const plugKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.028, 16), chromeMat);
  plugKnob.position.y = 0.042;
  plugGroup.add(plugKnob);

  const pullRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.011, 12, 28), chromeMat);
  pullRing.position.set(0, 0.088, 0);
  pullRing.rotation.x = 0.25;
  plugGroup.add(pullRing);

  // Generous invisible touch hit target for drain / plug
  const drainHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.24, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  drainHit.position.set(SINK.drainX, SINK.bottomY + 0.12, SINK.drainZ);
  drainHit.userData = { type: 'drain' };
  sinkGroup.add(drainHit);

  // --- 5. Polished Chrome Gooseneck Faucet & Articulated Lever ---
  const faucetGroup = new THREE.Group();
  faucetGroup.position.set(0, 0, -1.00);
  root.add(faucetGroup);

  // Escutcheon deck plate & base cylinder
  const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.035, 32), chromeMat);
  basePlate.position.y = 0.017;
  basePlate.castShadow = true;
  faucetGroup.add(basePlate);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.074, 0.34, 32), chromeMat);
  stem.position.y = 0.18;
  stem.castShadow = true;
  faucetGroup.add(stem);

  // Curved swan-neck spout tube
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.32, 0.0),
    new THREE.Vector3(0, 0.88, 0.02),
    new THREE.Vector3(0, 1.15, 0.20),
    new THREE.Vector3(0, 1.14, 0.50),
    new THREE.Vector3(0, 0.94, 0.66)
  ]);
  const spoutTube = new THREE.Mesh(
    new THREE.TubeGeometry(spoutCurve, 36, 0.036, 20, false),
    chromeMat
  );
  spoutTube.castShadow = true;
  faucetGroup.add(spoutTube);

  // Aerator nozzle collar at tip
  const aerator = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.041, 0.075, 24), chromeMat);
  aerator.position.set(0, 0.915, 0.66);
  aerator.castShadow = true;
  faucetGroup.add(aerator);

  // Articulated Lever Handle Pivot (right side of faucet base)
  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.075, 0.23, 0.0);
  faucetGroup.add(leverPivot);

  const leverHub = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.085, 20), chromeMat);
  leverHub.rotation.z = -Math.PI / 2;
  leverHub.position.x = 0.03;
  leverPivot.add(leverHub);

  // Tactile chrome lever arm pointing forward-right
  const leverStick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.28, 18), chromeMat);
  leverStick.rotation.x = Math.PI / 2;
  leverStick.rotation.z = -0.18;
  leverStick.position.set(0.07, 0.01, 0.13);
  leverStick.castShadow = true;
  leverPivot.add(leverStick);

  const leverTip = new THREE.Mesh(new THREE.SphereGeometry(0.034, 18, 18), chromeMat);
  leverTip.position.set(0.095, 0.01, 0.26);
  leverPivot.add(leverTip);

  // Subtle physical blue/coral temperature ceramic dot (no letters!)
  const dotBlue = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x3ba4e8, roughness: 0.2 })
  );
  dotBlue.position.set(0.07, 0.044, 0.05);
  leverPivot.add(dotBlue);

  const dotRed = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xe86153, roughness: 0.2 })
  );
  dotRed.position.set(0.07, 0.044, 0.005);
  leverPivot.add(dotRed);

  // Generous invisible touch hit zones for faucet lever & spout
  const faucetHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.96, 0.72),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  faucetHit.position.set(0.10, 0.56, 0.28);
  faucetHit.userData = { type: 'faucet' };
  faucetGroup.add(faucetHit);

  // --- 6. Translucent Dish Soap Pump Bottle ---
  const soapGroup = new THREE.Group();
  soapGroup.position.copy(SINK.soapPos);
  root.add(soapGroup);

  // Jewel-like rosy-coral liquid soap core inside clear bottle
  const soapLiquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xeb5a74,
    roughness: 0.10,
    metalness: 0.0,
    transmission: 0.35,
    thickness: 0.35,
    ior: 1.38,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06
  });
  const soapLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.155, 0.38, 28),
    soapLiquidMat
  );
  soapLiquid.position.y = 0.21;
  soapGroup.add(soapLiquid);

  // Clear outer bottle glass/PET shell
  const bottleShellMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.0,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.4
  });
  const bottlePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.16, 0.0),
    new THREE.Vector2(0.172, 0.04),
    new THREE.Vector2(0.168, 0.38),
    new THREE.Vector2(0.135, 0.48),
    new THREE.Vector2(0.062, 0.54),
    new THREE.Vector2(0.062, 0.60)
  ];
  const bottleShell = new THREE.Mesh(new THREE.LatheGeometry(bottlePoints, 32), bottleShellMat);
  bottleShell.castShadow = true;
  soapGroup.add(bottleShell);

  // Chrome collar
  const soapCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.072, 0.065, 24), chromeMat);
  soapCollar.position.y = 0.59;
  soapGroup.add(soapCollar);

  // Animated Pump Head (angled toward the sink!)
  const soapPumpGroup = new THREE.Group();
  soapPumpGroup.position.set(0, 0.64, 0);
  soapPumpGroup.rotation.y = -0.62; // points right-front into the sink basin
  soapGroup.add(soapPumpGroup);

  const whiteGlossMat = new THREE.MeshStandardMaterial({
    color: 0xfbf9f6,
    roughness: 0.16,
    metalness: 0.04
  });
  const pumpStem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.10, 16), chromeMat);
  pumpStem.position.y = 0.03;
  soapPumpGroup.add(pumpStem);

  const pumpCap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.058, 22), whiteGlossMat);
  pumpCap.position.y = 0.095;
  pumpCap.castShadow = true;
  soapPumpGroup.add(pumpCap);

  const pumpNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.17, 14), whiteGlossMat);
  pumpNozzle.rotation.z = -Math.PI / 2 - 0.15;
  pumpNozzle.position.set(0.085, 0.092, 0);
  pumpNozzle.castShadow = true;
  soapPumpGroup.add(pumpNozzle);

  // Generous invisible touch target for soap bottle
  const soapHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.92, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  soapHit.position.y = 0.45;
  soapHit.userData = { type: 'soap' };
  soapGroup.add(soapHit);

  // Animated soap squirt ribbon mesh (arcs from nozzle into sink when pumped!)
  const squirtCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-1.22, 0.72, -0.49),
    new THREE.Vector3(-0.78, 0.78, -0.25),
    new THREE.Vector3(-0.42, -0.15, -0.05)
  );
  const soapSquirtMesh = new THREE.Mesh(
    new THREE.TubeGeometry(squirtCurve, 22, 0.018, 10, false),
    new THREE.MeshPhysicalMaterial({
      color: 0xff8ea2,
      roughness: 0.08,
      transparent: true,
      opacity: 0.0,
      clearcoat: 1.0
    })
  );
  soapSquirtMesh.visible = false;
  root.add(soapSquirtMesh);

  // --- 7. Two-Tone Porous Kitchen Sponge ---
  const spongeGroup = new THREE.Group();
  spongeGroup.position.copy(SINK.spongeHome);
  spongeGroup.rotation.y = 0.28;
  root.add(spongeGroup);

  const spongeInner = new THREE.Group();
  spongeGroup.add(spongeInner);

  const yellowFoam = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.105, 0.24),
    new THREE.MeshStandardMaterial({
      map: spongeTex.yellowMap,
      bumpMap: spongeTex.yellowBump,
      bumpScale: 0.016,
      roughness: 0.88,
      metalness: 0.0
    })
  );
  yellowFoam.position.y = 0.052;
  yellowFoam.castShadow = true;
  yellowFoam.receiveShadow = true;
  spongeInner.add(yellowFoam);

  const greenPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.362, 0.032, 0.242),
    new THREE.MeshStandardMaterial({
      map: spongeTex.greenMap,
      bumpMap: spongeTex.greenBump,
      bumpScale: 0.018,
      roughness: 0.94,
      metalness: 0.0
    })
  );
  greenPad.position.y = 0.118;
  greenPad.castShadow = true;
  spongeInner.add(greenPad);

  const spongeHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  spongeHit.position.y = 0.08;
  spongeHit.userData = { type: 'sponge' };
  spongeGroup.add(spongeHit);

  // --- 8. Slatted Bamboo Drying Mat & Woven Waffle Cotton Dish Towel ---
  const dryingGroup = new THREE.Group();
  dryingGroup.position.set(1.52, 0.0, 0.16);
  root.add(dryingGroup);

  // Slatted wood/bamboo drying mat
  const slatCount = 7;
  for (let i = 0; i < slatCount; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.018, 1.06), oakMat);
    slat.position.set((i - (slatCount - 1) * 0.5) * 0.095, 0.009, 0);
    slat.castShadow = true;
    slat.receiveShadow = true;
    dryingGroup.add(slat);
  }
  // Cross runners underneath mat
  for (let s of [-0.36, 0.36]) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.012, 0.055), oakMat);
    runner.position.set(0, 0.006, s);
    dryingGroup.add(runner);
  }

  // Plush folded woven cotton waffle dish towel (draggable!)
  const towelGroup = new THREE.Group();
  towelGroup.position.copy(SINK.towelHome);
  root.add(towelGroup);

  const towelMat = new THREE.MeshStandardMaterial({
    map: towelTex.map,
    bumpMap: towelTex.bumpMap,
    bumpScale: 0.016,
    roughness: 0.92,
    metalness: 0.0
  });

  // Soft pillowy sculpted towel mesh (deformed box with gentle organic folds)
  const towelGeo = new THREE.BoxGeometry(0.48, 0.075, 0.56, 12, 4, 12);
  const tPos = towelGeo.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const y = tPos.getY(i);
    const z = tPos.getZ(i);
    const edge = Math.min(1, (Math.abs(x) / 0.24) ** 2 + (Math.abs(z) / 0.28) ** 2);
    const pillow = Math.cos(edge * Math.PI * 0.42);
    const fold = Math.sin(x * 16 + z * 5) * 0.008;
    tPos.setY(i, y * (0.55 + 0.55 * pillow) + fold);
  }
  towelGeo.computeVertexNormals();

  const towelMesh = new THREE.Mesh(towelGeo, towelMat);
  towelMesh.castShadow = true;
  towelMesh.receiveShadow = true;
  towelGroup.add(towelMesh);

  // Subtle top fold flap for realistic folded cloth silhouette
  const towelFlap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.022, 0.26), towelMat);
  towelFlap.position.set(0, 0.036, -0.06);
  towelFlap.rotation.x = 0.06;
  towelFlap.castShadow = true;
  towelGroup.add(towelFlap);

  const towelHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.34, 0.72),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  towelHit.position.y = 0.08;
  towelHit.userData = { type: 'towel' };
  towelGroup.add(towelHit);

  // --- 9. Sunlit Oak Wall Shelf with 5 Recessed Cork Coasters ---
  const shelfGroup = new THREE.Group();
  root.add(shelfGroup);

  const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.075, 0.52), oakMat);
  shelfBoard.position.set(0, SINK.shelfY, SINK.shelfZ);
  shelfBoard.castShadow = true;
  shelfBoard.receiveShadow = true;
  shelfGroup.add(shelfBoard);

  // Brushed brass minimalist wall brackets
  for (const bx of [-1.18, 1.18]) {
    const vert = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.035), brassMat);
    vert.position.set(bx, SINK.shelfY - 0.16, -1.45);
    shelfGroup.add(vert);
    const horiz = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.032, 0.42), brassMat);
    horiz.position.set(bx, SINK.shelfY - 0.052, -1.25);
    shelfGroup.add(horiz);
  }

  // 5 circular cork shelf coasters (natural physical placeholders for the 5 dishes!)
  const corkMat = new THREE.MeshStandardMaterial({
    map: corkTex,
    roughness: 0.88,
    metalness: 0.0
  });
  const coasterMeshes = [];
  SINK.coasterSpots.forEach((spot, idx) => {
    const radius = idx === 0 ? 0.23 : idx === 3 ? 0.14 : 0.19;
    const coaster = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius + 0.008, 0.016, 28),
      corkMat
    );
    coaster.position.set(spot.x, SINK.shelfY + 0.044, spot.z);
    coaster.receiveShadow = true;
    shelfGroup.add(coaster);
    coasterMeshes.push(coaster);
  });

  // --- 10. Subtle Replay Tray (slides in from left after all 5 dishes are shelved!) ---
  const replayTray = new THREE.Group();
  replayTray.position.set(-2.6, 0.02, 0.25);
  replayTray.visible = false;
  root.add(replayTray);

  const trayPlatter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.26, 0.032, 32),
    oakMat
  );
  trayPlatter.castShadow = true;
  trayPlatter.receiveShadow = true;
  replayTray.add(trayPlatter);

  // Miniature inviting stack of glossy stained plates on the tray (visual affordance for round 2!)
  const miniColors = [0xf6efe6, 0xf2b5c4, 0xa8d8cc];
  miniColors.forEach((col, i) => {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21 - i * 0.022, 0.14 - i * 0.015, 0.042, 24),
      new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.16, clearcoat: 0.8 })
    );
    p.position.y = 0.038 + i * 0.046;
    p.rotation.z = (i - 1) * 0.06;
    p.castShadow = true;
    replayTray.add(p);
  });
  // Playful little jam smudge on top plate of tray
  const miniJam = new THREE.Mesh(
    new THREE.CircleGeometry(0.085, 18),
    new THREE.MeshStandardMaterial({ color: 0xc8385a, roughness: 0.25 })
  );
  miniJam.rotation.x = -Math.PI / 2;
  miniJam.position.set(0.02, 0.155, 0.01);
  replayTray.add(miniJam);

  const replayHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.38, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  replayHit.position.y = 0.15;
  replayHit.userData = { type: 'replayTray' };
  replayTray.add(replayHit);

  // --- 11. Subtle Idle Hand Silhouette (shown ONLY after 12s inactivity, once!) ---
  const hintHand = createSubtleHintHand();
  hintHand.visible = false;
  scene.add(hintHand);

  return {
    root,
    faucetGroup,
    leverPivot,
    faucetHit,
    soapGroup,
    soapPumpGroup,
    soapSquirtMesh,
    soapHit,
    spongeGroup,
    spongeInner,
    spongeHit,
    towelGroup,
    towelHit,
    plugGroup,
    drainHit,
    coasterMeshes,
    replayTray,
    replayHit,
    hintHand
  };
}

function createSubtleHintHand() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    roughness: 0.4,
    depthTest: false
  });
  // Simple organic soft fingertip droplet/hand silhouette
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.10, 18, 18), mat);
  palm.scale.set(0.85, 1.15, 0.42);
  g.add(palm);

  const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.11, 8, 14), mat);
  finger.position.set(-0.02, 0.11, 0);
  finger.rotation.z = 0.12;
  g.add(finger);

  g.renderOrder = 999;
  g.userData.mat = mat;
  return g;
}
