import * as THREE from 'three';
import {
  createOakWoodTextures,
  createCeramicTextures,
  createCastIronTextures,
  createWovenCoasterTextures,
  createTileWallTextures,
  createStrawberryTextures,
  createFurTextures,
  createPancakeEdgeTexture,
  createContactShadowTexture,
  PancakeFaceTexture,
} from './textures.js';

const shared = {};

function getShared() {
  if (shared.ready) return shared;
  shared.ready = true;
  shared.contactShadowTex = createContactShadowTexture();
  shared.pancakeEdge = createPancakeEdgeTexture();
  shared.strawberryTex = createStrawberryTextures();
  shared.ceramicCream = createCeramicTextures('#f8f3e9', '#9c866e');
  shared.ceramicWarm = createCeramicTextures('#e6d5be', '#7b6149');
  shared.castIron = createCastIronTextures();
  shared.coaster = createWovenCoasterTextures();

  shared.steelMat = new THREE.MeshStandardMaterial({
    color: 0xe6e8ec,
    metalness: 0.9,
    roughness: 0.2,
  });
  shared.woodHandleMat = new THREE.MeshStandardMaterial({
    color: 0x9b663b,
    roughness: 0.52,
    metalness: 0.04,
  });
  shared.syrupMat = new THREE.MeshPhysicalMaterial({
    color: 0x7b2902,
    emissive: 0x330d00,
    emissiveIntensity: 0.24,
    roughness: 0.04,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    ior: 1.5,
    transparent: true,
    opacity: 0.88,
  });
  shared.butterMat = new THREE.MeshPhysicalMaterial({
    color: 0xfad464,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
  });
  shared.meltedButterMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2b526,
    roughness: 0.06,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.74,
  });
  shared.creamMat = new THREE.MeshPhysicalMaterial({
    color: 0xfffcf5,
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.35,
  });
  shared.strawberryMat = new THREE.MeshPhysicalMaterial({
    map: shared.strawberryTex.map,
    bumpMap: shared.strawberryTex.bumpMap,
    bumpScale: 0.008,
    roughness: 0.22,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14,
  });
  shared.leafMat = new THREE.MeshStandardMaterial({
    color: 0x3c7d2c,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
  shared.blueberryMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a3562,
    roughness: 0.38,
    clearcoat: 0.32,
    clearcoatRoughness: 0.35,
  });
  return shared;
}

export function addContactShadow(parent, radius = 0.5, opacity = 0.55) {
  const s = getShared();
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.2, radius * 2.2),
    new THREE.MeshBasicMaterial({
      map: s.contactShadowTex,
      transparent: true,
      opacity,
      depthWrite: false,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  parent.add(m);
  return m;
}

export function createKitchenEnvironment(scene) {
  const group = new THREE.Group();
  const oak = createOakWoodTextures();
  const tiles = createTileWallTextures();

  // Warm solid oak dining/kitchen table
  const tableGeo = new THREE.BoxGeometry(7.2, 0.22, 4.4);
  const tableMat = new THREE.MeshStandardMaterial({
    map: oak.map,
    bumpMap: oak.bumpMap,
    bumpScale: 0.012,
    roughnessMap: oak.roughnessMap,
    roughness: 0.52,
    metalness: 0.03,
  });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.set(0, -0.11, 0.0);
  table.receiveShadow = true;
  group.add(table);

  // Back sunlit tiled kitchen wall
  const wallMat = new THREE.MeshStandardMaterial({
    map: tiles.map,
    bumpMap: tiles.bumpMap,
    bumpScale: 0.01,
    roughness: 0.32,
    metalness: 0.02,
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(11, 6.2), wallMat);
  wall.position.set(0, 2.3, -2.55);
  wall.receiveShadow = true;
  group.add(wall);

  // Soft sunlit window glow frame on upper-left wall for photographic morning ambiance
  const windowGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.4),
    new THREE.MeshBasicMaterial({ color: 0xfff8e7 })
  );
  windowGlow.position.set(-2.4, 2.2, -2.52);
  group.add(windowGlow);

  // Wooden window mullions
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.55 });
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.45, 0.06), frameMat);
  barV.position.set(-2.4, 2.2, -2.49);
  group.add(barV);
  const barH = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.08, 0.06), frameMat);
  barH.position.set(-2.4, 2.15, -2.49);
  group.add(barH);

  // Soft cozy cafe chair back behind guest
  const chairWood = new THREE.MeshStandardMaterial({ color: 0x9d6b43, roughness: 0.55 });
  const chairBack = new THREE.Group();
  chairBack.position.set(0, 0, -1.78);
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.14, 0.07), chairWood);
  topRail.position.set(0, 0.96, 0);
  topRail.castShadow = true;
  chairBack.add(topRail);
  for (let i = -2; i <= 2; i++) {
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 1.05, 10), chairWood);
    spindle.position.set(i * 0.21, 0.42, 0);
    spindle.castShadow = true;
    chairBack.add(spindle);
  }
  group.add(chairBack);

  // Subtle decorative sunlit wooden shelf far back-right (pure atmosphere, out of reach)
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.3), chairWood);
  shelf.position.set(2.1, 1.65, -2.38);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  group.add(shelf);

  // Small terracotta herb pot on shelf for depth
  const potMat = new THREE.MeshStandardMaterial({ color: 0xc5744a, roughness: 0.72 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.18, 16), potMat);
  pot.position.set(1.65, 1.77, -2.35);
  group.add(pot);
  const herbMat = new THREE.MeshStandardMaterial({ color: 0x4b7d42, roughness: 0.6 });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), herbMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(1.65 + Math.cos(a) * 0.07, 1.9 + (i % 2) * 0.04, -2.35 + Math.sin(a) * 0.07);
    group.add(leaf);
  }

  scene.add(group);
  return group;
}

export function createMixingBowl(batterTex) {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.42, 0.5);

  // Thick sculptural stoneware bowl profile
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.24, 0.0),
    new THREE.Vector2(0.35, 0.08),
    new THREE.Vector2(0.43, 0.24),
    new THREE.Vector2(0.45, 0.34),
    new THREE.Vector2(0.415, 0.345),
    new THREE.Vector2(0.39, 0.23),
    new THREE.Vector2(0.30, 0.08),
    new THREE.Vector2(0.0, 0.04),
  ];
  const bowlGeo = new THREE.LatheGeometry(pts, 48);
  const bowlMat = new THREE.MeshPhysicalMaterial({
    map: s.ceramicCream.map,
    roughness: 0.16,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
  });
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);

  // Subtle decorative stoneware base band
  const bandGeo = new THREE.CylinderGeometry(0.36, 0.25, 0.09, 44, 1, true);
  const bandMat = new THREE.MeshStandardMaterial({
    map: s.ceramicWarm.map,
    roughness: 0.58,
  });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = 0.05;
  group.add(band);

  // Dynamic Batter Surface Mesh (deforms softly when whisked!)
  const batterGeo = new THREE.CircleGeometry(0.385, 42);
  batterGeo.rotateX(-Math.PI / 2);
  const batterMat = new THREE.MeshPhysicalMaterial({
    map: batterTex.map,
    roughness: 0.58,
    clearcoat: 0.1,
    clearcoatRoughness: 0.25,
  });
  const batterMesh = new THREE.Mesh(batterGeo, batterMat);
  batterMesh.position.y = 0.17;
  batterMesh.receiveShadow = true;
  group.add(batterMesh);

  return { group, bowl, batterMesh, batterMat };
}

export function createWhisk() {
  const s = getShared();
  const group = new THREE.Group();

  // Warm wood handle
  const handleGeo = new THREE.CylinderGeometry(0.022, 0.027, 0.26, 18);
  const handle = new THREE.Mesh(handleGeo, s.woodHandleMat);
  handle.position.y = 0.36;
  handle.castShadow = true;
  group.add(handle);

  // Rounded wood cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), s.woodHandleMat);
  cap.position.y = 0.49;
  group.add(cap);

  // Stainless collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.017, 0.06, 18), s.steelMat);
  collar.position.y = 0.21;
  collar.castShadow = true;
  group.add(collar);

  // 6 sculpted stainless wire loops
  const wireMat = s.steelMat;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI;
    const curvePts = [];
    for (let t = 0; t <= 16; t++) {
      const u = (t / 16) * Math.PI;
      const r = Math.sin(u) * 0.078;
      const y = 0.19 - Math.sin(u * 0.5) * 0.19 * (0.85 + 0.15 * Math.sin(u));
      const px = Math.cos(ang) * r * (t <= 8 ? 1 : -1) * Math.sin(u);
      // Clean balloon whisk loop
      const theta = (t / 16) * Math.PI * 2;
      const lx = Math.sin(theta) * 0.072;
      const ly = 0.095 - Math.cos(theta) * 0.095;
      curvePts.push(new THREE.Vector3(Math.cos(ang) * lx, ly, Math.sin(ang) * lx));
    }
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0038, 6, false), wireMat);
    tube.castShadow = true;
    group.add(tube);
  }

  return group;
}

export function createEggInCup() {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.15, 0.45);

  // Small ceramic egg cup
  const cupPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.095, 0),
    new THREE.Vector2(0.065, 0.045),
    new THREE.Vector2(0.115, 0.13),
    new THREE.Vector2(0.10, 0.135),
    new THREE.Vector2(0.06, 0.06),
    new THREE.Vector2(0, 0.05),
  ];
  const cup = new THREE.Mesh(
    new THREE.LatheGeometry(cupPts, 28),
    new THREE.MeshPhysicalMaterial({
      map: s.ceramicCream.map,
      roughness: 0.18,
      clearcoat: 0.8,
    })
  );
  cup.castShadow = true;
  cup.receiveShadow = true;
  group.add(cup);

  // Two-piece real speckled brown egg!
  const eggRoot = new THREE.Group();
  eggRoot.position.set(0, 0.15, 0);
  group.add(eggRoot);

  const eggMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcb48d,
    roughness: 0.48,
    clearcoat: 0.12,
  });

  // Top & Bottom halves so they visibly crack apart
  const bottomGeo = new THREE.SphereGeometry(0.088, 24, 16, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52);
  bottomGeo.scale(0.88, 1.15, 0.88);
  const bottomHalf = new THREE.Mesh(bottomGeo, eggMat);
  bottomHalf.castShadow = true;
  eggRoot.add(bottomHalf);

  const topGeo = new THREE.SphereGeometry(0.088, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
  topGeo.scale(0.88, 1.15, 0.88);
  const topHalf = new THREE.Mesh(topGeo, eggMat);
  topHalf.castShadow = true;
  eggRoot.add(topHalf);

  // Falling 3D Yolk & Albumen (shown during crack drop)
  const yolkGroup = new THREE.Group();
  yolkGroup.visible = false;
  const yolk = new THREE.Mesh(
    new THREE.SphereGeometry(0.046, 18, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0xffa41b,
      roughness: 0.1,
      clearcoat: 1.0,
    })
  );
  const white = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 16, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0xfff8e4,
      roughness: 0.08,
      transparent: true,
      opacity: 0.5,
      clearcoat: 1.0,
    })
  );
  white.scale.set(1.1, 0.75, 1.1);
  yolkGroup.add(white, yolk);
  group.add(yolkGroup);

  return { group, cup, eggRoot, topHalf, bottomHalf, yolkGroup };
}

export function createMilkJug() {
  const group = new THREE.Group();
  addContactShadow(group, 0.19, 0.45);

  const jugRoot = new THREE.Group();
  group.add(jugRoot);

  // Clear blown-glass pitcher profile
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.115, 0.0),
    new THREE.Vector2(0.145, 0.07),
    new THREE.Vector2(0.125, 0.18),
    new THREE.Vector2(0.10, 0.25),
    new THREE.Vector2(0.118, 0.30),
    new THREE.Vector2(0.106, 0.302),
    new THREE.Vector2(0.088, 0.24),
    new THREE.Vector2(0.112, 0.17),
    new THREE.Vector2(0.128, 0.07),
    new THREE.Vector2(0.10, 0.015),
    new THREE.Vector2(0.0, 0.015),
  ];
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    metalness: 0.0,
    transparent: true,
    opacity: 0.28,
    ior: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    depthWrite: false,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), glassMat);
  body.castShadow = true;
  jugRoot.add(body);

  // Curved glass handle
  const hCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.095, 0.25, 0),
    new THREE.Vector3(0.185, 0.22, 0),
    new THREE.Vector3(0.185, 0.10, 0),
    new THREE.Vector3(0.125, 0.07, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(hCurve, 18, 0.013, 10, false), glassMat);
  jugRoot.add(handle);

  // Creamy white milk inside
  const milkGeo = new THREE.CylinderGeometry(0.102, 0.118, 0.18, 26);
  const milkMat = new THREE.MeshPhysicalMaterial({
    color: 0xfffdf7,
    roughness: 0.14,
    clearcoat: 0.6,
  });
  const milkInner = new THREE.Mesh(milkGeo, milkMat);
  milkInner.position.y = 0.105;
  jugRoot.add(milkInner);

  // Milk pour stream
  const streamGeo = new THREE.CylinderGeometry(0.012, 0.02, 0.42, 12);
  const stream = new THREE.Mesh(streamGeo, milkMat);
  stream.visible = false;
  group.add(stream);

  return { group, jugRoot, milkInner, stream };
}

export function createSkilletStation() {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.58, 0.55);

  // Sleek low-profile tabletop ceramic induction burner
  const burnerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.49, 0.52, 0.048, 44),
    new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.26, metalness: 0.3 })
  );
  burnerBase.position.y = 0.024;
  burnerBase.receiveShadow = true;
  burnerBase.castShadow = true;
  group.add(burnerBase);

  // Subtle warm glowing heat ring
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff6b24,
    transparent: true,
    opacity: 0.45,
  });
  const heatRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.355, 44), glowMat);
  heatRing.rotation.x = -Math.PI / 2;
  heatRing.position.y = 0.05;
  group.add(heatRing);

  // Cast-iron skillet group (can tilt subtly during flips!)
  const panGroup = new THREE.Group();
  panGroup.position.y = 0.052;
  group.add(panGroup);

  const panPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.42, 0.0),
    new THREE.Vector2(0.47, 0.028),
    new THREE.Vector2(0.51, 0.095),
    new THREE.Vector2(0.52, 0.102),
    new THREE.Vector2(0.495, 0.105),
    new THREE.Vector2(0.455, 0.032),
    new THREE.Vector2(0.41, 0.018),
    new THREE.Vector2(0.0, 0.018),
  ];
  const ironMat = new THREE.MeshStandardMaterial({
    map: s.castIron.map,
    bumpMap: s.castIron.bumpMap,
    bumpScale: 0.008,
    roughness: 0.42,
    metalness: 0.45,
  });
  const panMesh = new THREE.Mesh(new THREE.LatheGeometry(panPts, 48), ironMat);
  panMesh.castShadow = true;
  panMesh.receiveShadow = true;
  panGroup.add(panMesh);

  // Skillet handle (angled toward lower-left so it never clips the spatula on the right!)
  const handleGroup = new THREE.Group();
  handleGroup.rotation.y = Math.PI * 0.76;
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.028, 0.072), ironMat);
  stem.position.set(0.68, 0.095, 0);
  stem.rotation.z = 0.14;
  stem.castShadow = true;
  handleGroup.add(stem);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.26, 16), s.woodHandleMat);
  grip.rotation.z = Math.PI / 2 - 0.14;
  grip.position.set(0.80, 0.114, 0);
  grip.castShadow = true;
  handleGroup.add(grip);
  panGroup.add(handleGroup);

  return { group, panGroup, heatRing, glowMat };
}

export function createLadle() {
  const s = getShared();
  const group = new THREE.Group();

  // Stainless ladle cup
  const cupGeo = new THREE.SphereGeometry(0.115, 24, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
  const cup = new THREE.Mesh(cupGeo, s.steelMat);
  cup.material = s.steelMat.clone();
  cup.material.side = THREE.DoubleSide;
  cup.castShadow = true;
  group.add(cup);

  // Batter pool inside ladle
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(0.102, 22),
    new THREE.MeshPhysicalMaterial({ color: 0xf4de9e, roughness: 0.25, clearcoat: 0.5 })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = -0.008;
  group.add(fill);

  // Curved stainless handle
  const hCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.095, 0.01, 0),
    new THREE.Vector3(0.15, 0.16, 0),
    new THREE.Vector3(0.24, 0.42, 0),
    new THREE.Vector3(0.28, 0.46, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(hCurve, 18, 0.011, 10, false), s.steelMat);
  handle.castShadow = true;
  group.add(handle);

  // Pouring batter stream
  const pourStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.028, 0.36, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xf5e0a2, roughness: 0.2, clearcoat: 0.55 })
  );
  pourStream.visible = false;
  group.add(pourStream);

  return { group, fill, pourStream };
}

export function createSpatula() {
  const s = getShared();
  const group = new THREE.Group();

  // Flat slotted metal blade
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.008, 0.17), s.steelMat);
  blade.castShadow = true;
  group.add(blade);

  // Angled neck
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.01, 0.032), s.steelMat);
  neck.position.set(0.16, 0.03, 0);
  neck.rotation.z = 0.42;
  neck.castShadow = true;
  group.add(neck);

  // Warm wooden handle
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.24, 14), s.woodHandleMat);
  handle.rotation.z = Math.PI / 2 - 0.32;
  handle.position.set(0.32, 0.095, 0);
  handle.castShadow = true;
  group.add(handle);

  return group;
}

export function createServingPlate() {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.54, 0.52);

  // Crisp glossy porcelain plate profile
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.32, 0.0),
    new THREE.Vector2(0.37, 0.015),
    new THREE.Vector2(0.50, 0.056),
    new THREE.Vector2(0.515, 0.062),
    new THREE.Vector2(0.495, 0.068),
    new THREE.Vector2(0.36, 0.03),
    new THREE.Vector2(0.0, 0.026),
  ];
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0xfdfbf7,
    roughness: 0.1,
    metalness: 0.0,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
  });
  const plate = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), plateMat);
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  // Delicate brushed-gold cafe rim accent
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.502, 0.0055, 8, 56),
    new THREE.MeshStandardMaterial({ color: 0xd9b36c, metalness: 0.82, roughness: 0.24 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.064;
  group.add(rim);

  // Organic scalloped plate syrup puddle (grows when maple syrup overflows!)
  const puddleShape = new THREE.Shape();
  const segs = 40;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const rad = 0.355 * (1 + Math.sin(a * 5) * 0.065 + Math.cos(a * 3 + 1.2) * 0.055);
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) puddleShape.moveTo(px, py);
    else puddleShape.lineTo(px, py);
  }
  const plateSyrup = new THREE.Mesh(
    new THREE.ShapeGeometry(puddleShape),
    s.syrupMat.clone()
  );
  plateSyrup.rotation.x = -Math.PI / 2;
  plateSyrup.position.y = 0.031;
  plateSyrup.scale.set(0.001, 0.001, 1);
  plateSyrup.visible = false;
  group.add(plateSyrup);

  return { group, plate, plateSyrup };
}

export function createPancakeMesh(radius = 0.34, thickness = 0.062, seed = 1) {
  const s = getShared();
  const root = new THREE.Group();

  const topTex = new PancakeFaceTexture(seed);
  const bottomTex = new PancakeFaceTexture(seed + 113);

  // Slightly rounded organic fluffy pancake geometry
  const radialSegs = 40;
  const sideGeo = new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, thickness, radialSegs, 4, true);
  // Puff out the middle of the side edge for authentic thick soufflé/hotcake cushion
  const posAttr = sideGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const yn = y / (thickness * 0.5); // -1 to 1
    const puff = 1 + (1 - yn * yn) * 0.065;
    const ang = Math.atan2(z, x);
    // Subtle organic homemade irregularity
    const wobble = 1 + Math.sin(ang * 3 + seed) * 0.018 + Math.cos(ang * 5 - seed * 2) * 0.012;
    posAttr.setX(i, x * puff * wobble);
    posAttr.setZ(i, z * puff * wobble);
  }
  sideGeo.computeVertexNormals();

  const sideMat = new THREE.MeshStandardMaterial({
    map: s.pancakeEdge.map,
    bumpMap: s.pancakeEdge.bumpMap,
    bumpScale: 0.008,
    roughness: 0.86,
  });
  const sideMesh = new THREE.Mesh(sideGeo, sideMat);
  sideMesh.castShadow = true;
  sideMesh.receiveShadow = true;
  root.add(sideMesh);

  // Helper to build slightly domed organic top/bottom caps
  const makeCap = (tex, isTop) => {
    const geo = new THREE.CircleGeometry(radius * 0.96, radialSegs);
    geo.rotateX(isTop ? -Math.PI / 2 : Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z) / (radius * 0.96);
      const ang = Math.atan2(z, x);
      const wobble = 1 + Math.sin(ang * 3 + seed) * 0.018 + Math.cos(ang * 5 - seed * 2) * 0.012;
      const dome = (1 - r * r) * 0.011;
      p.setX(i, x * wobble);
      p.setZ(i, z * wobble);
      p.setY(i, isTop ? thickness * 0.5 + dome : -thickness * 0.5 - dome);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 0.006,
      roughness: 0.72,
    });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return { mesh: m, mat };
  };

  const topCap = makeCap(topTex, true);
  const botCap = makeCap(bottomTex, false);
  root.add(topCap.mesh, botCap.mesh);

  // 3D Cooking Batter Bubbles (pop on the upper side during baking!)
  const bubbles = [];
  const bubGeo = new THREE.SphereGeometry(0.012, 10, 8);
  const bubMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4dca0,
    roughness: 0.25,
    clearcoat: 0.65,
  });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + seed;
    const d = (0.14 + ((i * 37) % 100) / 100 * 0.64) * radius;
    const b = new THREE.Mesh(bubGeo, bubMat);
    b.position.set(Math.cos(a) * d, thickness * 0.52, Math.sin(a) * d);
    b.scale.setScalar(0.001);
    b.visible = false;
    root.add(b);
    bubbles.push({
      mesh: b,
      phase: (i * 0.37) % 1,
      popped: false,
      active: false,
    });
  }

  // Glossy organic maple syrup glaze layer on top of this pancake
  const glazeShape = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const rad = radius * 0.86 * (1 + Math.sin(a * 4 + seed) * 0.08 + Math.cos(a * 7 - seed) * 0.045);
    const gx = Math.cos(a) * rad;
    const gy = Math.sin(a) * rad;
    if (i === 0) glazeShape.moveTo(gx, gy);
    else glazeShape.lineTo(gx, gy);
  }
  const glazeGeo = new THREE.ShapeGeometry(glazeShape);
  glazeGeo.rotateX(-Math.PI / 2);
  const glaze = new THREE.Mesh(glazeGeo, s.syrupMat.clone());
  glaze.position.y = thickness * 0.5 + 0.014;
  glaze.scale.set(0.001, 1, 0.001);
  glaze.visible = false;
  root.add(glaze);

  return {
    root,
    topTex,
    bottomTex,
    topMat: topCap.mat,
    botMat: botCap.mat,
    bubbles,
    glaze,
    radius,
    thickness,
  };
}

export function createButterDish() {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.22, 0.42);

  // Rectangular porcelain butter dish
  const dish = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.026, 0.22),
    new THREE.MeshPhysicalMaterial({ color: 0xfcf9f2, roughness: 0.12, clearcoat: 0.9 })
  );
  dish.position.y = 0.013;
  dish.castShadow = true;
  dish.receiveShadow = true;
  group.add(dish);

  // Stack of inviting golden butter pats
  for (let i = 0; i < 2; i++) {
    const pat = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.042, 0.105), s.butterMat);
    pat.position.set(-0.055 + i * 0.115, 0.047, 0);
    pat.rotation.y = i * 0.16;
    pat.castShadow = true;
    group.add(pat);
  }

  return group;
}

export function createMeltableButterPat() {
  const s = getShared();
  const group = new THREE.Group();

  // Cold butter square (softens & flattens gently while staying appetizingly visible!)
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.042, 0.105), s.butterMat.clone());
  cube.position.y = 0.021;
  cube.castShadow = true;
  group.add(cube);

  // Compact organic glistening melted butter puddle (stays cleanly on top of the pancake!)
  const bpShape = new THREE.Shape();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rad = 0.108 * (1 + Math.sin(a * 4) * 0.09 + Math.cos(a * 3 + 0.8) * 0.06);
    const bx = Math.cos(a) * rad;
    const by = Math.sin(a) * rad;
    if (i === 0) bpShape.moveTo(bx, by);
    else bpShape.lineTo(bx, by);
  }
  const puddle = new THREE.Mesh(new THREE.ShapeGeometry(bpShape), s.meltedButterMat.clone());
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = 0.007;
  puddle.scale.set(0.01, 0.01, 1);
  puddle.visible = false;
  group.add(puddle);

  return { group, cube, puddle, melt: 0 };
}

export function createSyrupPitcher() {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.18, 0.46);

  const pitcherRoot = new THREE.Group();
  group.add(pitcherRoot);

  // Teardrop glass syrup cruet
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.105, 0),
    new THREE.Vector2(0.14, 0.08),
    new THREE.Vector2(0.11, 0.19),
    new THREE.Vector2(0.062, 0.28),
    new THREE.Vector2(0.074, 0.34),
    new THREE.Vector2(0.062, 0.342),
    new THREE.Vector2(0.052, 0.28),
  ];
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff3de,
    roughness: 0.06,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    depthWrite: false,
  });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), glassMat);
  glass.castShadow = true;
  pitcherRoot.add(glass);

  // Rich glowing amber maple syrup inside
  const innerPts = [
    new THREE.Vector2(0, 0.015),
    new THREE.Vector2(0.095, 0.015),
    new THREE.Vector2(0.125, 0.08),
    new THREE.Vector2(0.098, 0.18),
    new THREE.Vector2(0.056, 0.24),
    new THREE.Vector2(0, 0.24),
  ];
  const inner = new THREE.Mesh(new THREE.LatheGeometry(innerPts, 28), s.syrupMat);
  pitcherRoot.add(inner);

  // Brass collar & handle
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.032, 24),
    new THREE.MeshStandardMaterial({ color: 0xd4a454, metalness: 0.85, roughness: 0.24 })
  );
  collar.position.y = 0.295;
  pitcherRoot.add(collar);

  const hCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.062, 0.29, 0),
    new THREE.Vector3(0.165, 0.24, 0),
    new THREE.Vector3(0.165, 0.10, 0),
    new THREE.Vector3(0.12, 0.07, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(hCurve, 16, 0.012, 8, false), glassMat);
  pitcherRoot.add(handle);

  // Continuous pouring amber stream
  const stream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.016, 0.5, 12),
    s.syrupMat
  );
  stream.visible = false;
  group.add(stream);

  return { group, pitcherRoot, stream };
}

export function createSyrupDrip(height = 0.12) {
  const s = getShared();
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.011, height, 10), s.syrupMat);
  stem.position.y = -height * 0.5;
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), s.syrupMat);
  bead.scale.set(1.0, 1.35, 0.68);
  bead.position.y = -height;
  group.add(stem, bead);
  return group;
}

export function createCreamBag() {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.16, 0.38);

  const bagRoot = new THREE.Group();
  bagRoot.rotation.z = -1.08;
  bagRoot.rotation.y = 0.35;
  bagRoot.position.set(0, 0.11, 0);
  bagRoot.scale.setScalar(0.84);
  group.add(bagRoot);

  // Soft cloth pastry cone
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.115, 0.34, 24),
    new THREE.MeshStandardMaterial({ color: 0xfaf5ec, roughness: 0.72 })
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 0.05;
  cone.castShadow = true;
  bagRoot.add(cone);

  // Soft cream ribbon tie at top
  const tie = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.014, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xe8a3a8, roughness: 0.65 })
  );
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.18;
  bagRoot.add(tie);

  // Stainless star piping nozzle
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.08, 12), s.steelMat);
  tip.rotation.x = Math.PI;
  tip.position.y = -0.14;
  bagRoot.add(tip);

  // Tiny dab of whipped cream peeking out of the nozzle
  const dab = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), s.creamMat);
  dab.position.y = -0.185;
  bagRoot.add(dab);

  return { group, bagRoot };
}

export function createCreamSwirl() {
  const s = getShared();
  const group = new THREE.Group();
  // Sculpted 3-tier fluffy piped whipped cream rosette
  const tiers = [
    { r: 0.052, tube: 0.026, y: 0.022 },
    { r: 0.034, tube: 0.023, y: 0.048 },
    { r: 0.016, tube: 0.018, y: 0.070 },
  ];
  for (const t of tiers) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(t.r, t.tube, 10, 20), s.creamMat);
    m.rotation.x = Math.PI / 2;
    m.position.y = t.y;
    m.castShadow = true;
    group.add(m);
  }
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.045, 14), s.creamMat);
  peak.position.y = 0.092;
  peak.rotation.z = 0.18;
  peak.castShadow = true;
  group.add(peak);
  return group;
}

export function createStrawberry(scale = 1) {
  const s = getShared();
  const group = new THREE.Group();

  // Heart-conical plump strawberry profile
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.014, 0.012),
    new THREE.Vector2(0.042, 0.048),
    new THREE.Vector2(0.056, 0.088),
    new THREE.Vector2(0.048, 0.118),
    new THREE.Vector2(0.022, 0.13),
    new THREE.Vector2(0.0, 0.128),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), s.strawberryMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Fresh green leafy calyx crown
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.052, 5), s.leafMat);
    leaf.position.set(Math.cos(a) * 0.025, 0.128, Math.sin(a) * 0.025);
    leaf.rotation.z = Math.PI * 0.44;
    leaf.rotation.y = -a;
    group.add(leaf);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.024, 6), s.leafMat);
  stem.position.y = 0.142;
  group.add(stem);

  group.scale.setScalar(scale);
  return group;
}

export function createBlueberry(scale = 1) {
  const s = getShared();
  const group = new THREE.Group();
  const berry = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), s.blueberryMat);
  berry.scale.set(1.06, 0.88, 1.06);
  berry.position.y = 0.028;
  berry.castShadow = true;
  group.add(berry);

  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.008, 0.003, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x1d2342, roughness: 0.7 })
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 0.054;
  group.add(crown);

  group.scale.setScalar(scale);
  return group;
}

export function createBerryBowl() {
  const s = getShared();
  const group = new THREE.Group();
  addContactShadow(group, 0.22, 0.45);

  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.18, 0.055),
    new THREE.Vector2(0.20, 0.12),
    new THREE.Vector2(0.185, 0.122),
    new THREE.Vector2(0.155, 0.05),
    new THREE.Vector2(0, 0.025),
  ];
  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(pts, 32),
    new THREE.MeshPhysicalMaterial({ map: s.ceramicCream.map, roughness: 0.15, clearcoat: 0.85 })
  );
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  group.add(bowl);

  // Plump strawberries & blueberries nestled inside
  const sPos = [
    [-0.06, 0.05, 0.03, 0.35, 0.4],
    [0.06, 0.055, -0.02, -0.4, -0.2],
    [0.0, 0.068, 0.05, 0.25, -0.35],
    [-0.01, 0.062, -0.06, -0.3, 0.2],
  ];
  for (const [x, y, z, rx, rz] of sPos) {
    const st = createStrawberry(0.92);
    st.position.set(x, y, z);
    st.rotation.set(rx, Math.random() * 6, rz);
    group.add(st);
  }
  const bPos = [
    [0.09, 0.08, 0.05],
    [-0.09, 0.075, -0.04],
    [0.02, 0.095, 0.0],
    [-0.04, 0.09, 0.08],
  ];
  for (const [x, y, z] of bPos) {
    const bb = createBlueberry(0.95);
    bb.position.set(x, y, z);
    group.add(bb);
  }

  return group;
}

export function createWovenCoaster() {
  const s = getShared();
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.47, 0.475, 0.014, 48),
    new THREE.MeshStandardMaterial({
      map: s.coaster.map,
      bumpMap: s.coaster.bumpMap,
      bumpScale: 0.014,
      roughness: 0.88,
    })
  );
  mesh.position.y = 0.007;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

export function createAnimalGuest(type = 'kitten') {
  const s = getShared();
  const root = new THREE.Group();

  const palette =
    type === 'kitten'
      ? { base: '#d99858', stripe: '#9e5820', muzzle: '#f7ece0', earIn: '#eba9a7', nose: '#e07b86', tabby: true }
      : type === 'bunny'
      ? { base: '#e2d1bc', stripe: '#bea78c', muzzle: '#f8f0e6', earIn: '#eeb3b1', nose: '#e28992', tabby: false }
      : { base: '#c98e52', stripe: '#8f5927', muzzle: '#f2e0c9', earIn: '#c78863', nose: '#332016', tabby: false };

  const furTex = createFurTextures(palette.base, palette.stripe, palette.tabby);
  const furMat = new THREE.MeshStandardMaterial({
    map: furTex.map,
    bumpMap: furTex.bumpMap,
    bumpScale: 0.018,
    roughness: 0.86,
  });
  const muzzleMat = new THREE.MeshStandardMaterial({
    color: palette.muzzle,
    bumpMap: furTex.bumpMap,
    bumpScale: 0.01,
    roughness: 0.82,
  });
  const earInnerMat = new THREE.MeshStandardMaterial({
    color: palette.earIn,
    roughness: 0.75,
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x16110e,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const noseMat = new THREE.MeshPhysicalMaterial({
    color: palette.nose,
    roughness: 0.25,
    clearcoat: 0.55,
  });

  // Cozy upper body seated at the table
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 22), furMat);
  body.scale.set(1.02, 1.15, 0.9);
  body.position.set(0, 0.04, -0.08);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // Soft cream chest bib
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), muzzleMat);
  chest.scale.set(0.95, 1.1, 0.65);
  chest.position.set(0, 0.06, 0.19);
  root.add(chest);

  // Articulated Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.54, 0.04);
  root.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 24), furMat);
  head.scale.set(1.12, 0.96, 0.96);
  head.castShadow = true;
  head.receiveShadow = true;
  headGroup.add(head);

  // Cute fluffy cheek puffs
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 14), muzzleMat);
    cheek.scale.set(1.15, 0.82, 0.85);
    cheek.position.set(side * 0.11, -0.07, 0.22);
    headGroup.add(cheek);
  }

  // Lower jaw / mouth (animates open when munching!)
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.11, 0.24);
  headGroup.add(mouthGroup);

  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), muzzleMat);
  chin.scale.set(1.05, 0.72, 0.85);
  mouthGroup.add(chin);

  const mouthInside = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xc95b6a, roughness: 0.5 })
  );
  mouthInside.position.set(0, 0.015, 0.03);
  mouthInside.scale.set(0.9, 0.5, 0.5);
  mouthInside.visible = false;
  mouthGroup.add(mouthInside);

  // Cute pink tongue (pops out to lick whipped cream off nose!)
  const tongue = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 12, 10),
    new THREE.MeshPhysicalMaterial({ color: 0xf48b99, roughness: 0.22, clearcoat: 0.6 })
  );
  tongue.scale.set(0.9, 0.5, 1.35);
  tongue.position.set(0, 0.02, 0.08);
  tongue.visible = false;
  mouthGroup.add(tongue);

  // Delicate glossy nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), noseMat);
  nose.scale.set(1.22, 0.86, 0.85);
  nose.position.set(0, -0.02, 0.305);
  headGroup.add(nose);

  // Secret Discovery: Whipped cream dab on the nose!
  const noseCreamDab = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), s.creamMat);
  noseCreamDab.scale.set(1.15, 0.85, 0.85);
  noseCreamDab.position.set(0.012, 0.012, 0.332);
  noseCreamDab.visible = false;
  headGroup.add(noseCreamDab);

  // Glossy dark expressive eyes + catchlights + happy smiling eyelids
  const eyes = [];
  const eyelids = [];
  for (const side of [-1, 1]) {
    const eyeGrp = new THREE.Group();
    eyeGrp.position.set(side * 0.135, 0.055, 0.258);
    headGroup.add(eyeGrp);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 16), eyeMat);
    eye.scale.set(0.96, 1.08, 0.72);
    eyeGrp.add(eye);

    // Big sunlit window catchlight
    const cl1 = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), catchlightMat);
    cl1.position.set(-0.014, 0.018, 0.035);
    eyeGrp.add(cl1);
    const cl2 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), catchlightMat);
    cl2.position.set(0.016, -0.014, 0.035);
    eyeGrp.add(cl2);
    eyes.push(eyeGrp);

    // Closed happy smiling eyelid arc
    const happyArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.044, 0.009, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x3a2518, roughness: 0.6 })
    );
    happyArc.position.set(side * 0.135, 0.042, 0.292);
    happyArc.visible = false;
    headGroup.add(happyArc);
    eyelids.push(happyArc);
  }

  // Whiskers for kitten & bunny
  if (type !== 'puppy') {
    const whiskerMat = new THREE.MeshStandardMaterial({ color: 0xfbf4ea, roughness: 0.4 });
    for (const side of [-1, 1]) {
      for (let w = -1; w <= 1; w++) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.001, 0.18, 6), whiskerMat);
        wh.rotation.z = Math.PI * 0.5 + side * (w * 0.14);
        wh.rotation.y = side * -0.25;
        wh.position.set(side * 0.23, -0.045 + w * 0.025, 0.24);
        headGroup.add(wh);
      }
    }
  }

  // Species-specific Ears!
  const ears = [];
  for (const side of [-1, 1]) {
    const earPivot = new THREE.Group();
    if (type === 'kitten') {
      earPivot.position.set(side * 0.21, 0.23, 0.02);
      earPivot.rotation.z = side * -0.32;
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.22, 16), furMat);
      outer.scale.set(1.0, 1.0, 0.58);
      outer.position.y = 0.08;
      outer.castShadow = true;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.15, 14), earInnerMat);
      inner.scale.set(1.0, 1.0, 0.4);
      inner.position.set(0, 0.07, 0.032);
      earPivot.add(outer, inner);
    } else if (type === 'bunny') {
      // Soft floppy lop-ears framing her cheeks!
      earPivot.position.set(side * 0.24, 0.22, -0.02);
      earPivot.rotation.z = side * -0.18;
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), furMat);
      ear.scale.set(0.68, 2.35, 0.45);
      ear.position.set(side * 0.09, -0.12, 0.02);
      ear.rotation.z = side * 0.22;
      ear.castShadow = true;
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 12), earInnerMat);
      inner.scale.set(0.65, 1.85, 0.3);
      inner.position.set(side * 0.085, -0.13, 0.048);
      inner.rotation.z = side * 0.22;
      earPivot.add(ear, inner);
    } else {
      // Soft velvety floppy puppy ears
      earPivot.position.set(side * 0.28, 0.14, 0.0);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), new THREE.MeshStandardMaterial({
        color: 0xa66e38,
        bumpMap: furTex.bumpMap,
        bumpScale: 0.015,
        roughness: 0.85,
      }));
      ear.scale.set(0.65, 1.55, 0.58);
      ear.position.set(side * 0.04, -0.12, 0.04);
      ear.rotation.z = side * 0.26;
      ear.castShadow = true;
      earPivot.add(ear);
    }
    headGroup.add(earPivot);
    ears.push(earPivot);
  }

  // Fluffy front paws resting eagerly on the oak table edge!
  const paws = [];
  for (const side of [-1, 1]) {
    const pawGrp = new THREE.Group();
    pawGrp.position.set(side * 0.25, 0.052, 0.36);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.088, 18, 14), muzzleMat);
    paw.scale.set(1.0, 0.62, 1.25);
    paw.castShadow = true;
    paw.receiveShadow = true;
    pawGrp.add(paw);
    root.add(pawGrp);
    paws.push(pawGrp);
  }

  // Gently swaying fluffy tail behind
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.1, -0.42);
  if (type === 'bunny') {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), muzzleMat);
    puff.position.set(0, 0.05, -0.05);
    tailPivot.add(puff);
  } else {
    const tCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.08, 0.22, -0.14),
      new THREE.Vector3(0.14, 0.48, -0.1),
      new THREE.Vector3(0.06, 0.64, -0.02),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tCurve, 18, 0.048, 12, false), furMat);
    tail.castShadow = true;
    tailPivot.add(tail);
  }
  root.add(tailPivot);

  return {
    type,
    root,
    headGroup,
    mouthGroup,
    mouthInside,
    tongue,
    noseCreamDab,
    eyes,
    eyelids,
    ears,
    paws,
    tailPivot,
  };
}
