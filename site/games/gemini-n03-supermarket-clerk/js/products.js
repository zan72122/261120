import * as THREE from 'three';
import {
  createBarcodeTexture,
  createMilkCartonTexture,
  createAppleSkinTexture,
  createStrawberrySkinTexture,
  createBananaSkinTexture,
  createOrangeJuiceLabelTexture,
  createChocolateWrapperTexture,
  createCornCanLabelTexture,
  createHoneyLabelTexture,
  createDiscountStickerTexture,
  createGoldStickerTexture,
} from './textures.js';

// Shared texture cache
let cache = null;
function getCache() {
  if (cache) return cache;
  cache = {
    barcodeUnscanned: createBarcodeTexture(false),
    barcodeScanned: createBarcodeTexture(true),
    milk: createMilkCartonTexture(),
    apple: createAppleSkinTexture(),
    strawberry: createStrawberrySkinTexture(),
    banana: createBananaSkinTexture(),
    orangeJuice: createOrangeJuiceLabelTexture(),
    chocolate: createChocolateWrapperTexture(),
    cornCan: createCornCanLabelTexture(),
    honeyLabel: createHoneyLabelTexture(),
    discountSticker: createDiscountStickerTexture(),
    goldSticker: createGoldStickerTexture(),
  };
  return cache;
}

export const PRODUCT_CATALOG = [
  { id: 'strawberry', weight: 0.45, material: 'plastic', color: '#e62a35', tall: false },
  { id: 'milk', weight: 0.92, material: 'carton', color: '#2678d6', tall: true },
  { id: 'apple', weight: 0.38, material: 'produce', color: '#c41e22', tall: false },
  { id: 'shortcake', weight: 0.35, material: 'plastic', color: '#ff8da8', tall: false },
  { id: 'orangeJuice', weight: 0.82, material: 'liquid', color: '#ff8a14', tall: true },
  { id: 'croissant', weight: 0.22, material: 'crinkle', color: '#d48b35', tall: false },
  { id: 'honey', weight: 0.78, material: 'glass', color: '#e8a21a', tall: false },
  { id: 'chocolate', weight: 0.28, material: 'crinkle', color: '#6b351c', tall: false },
  { id: 'eggs', weight: 0.55, material: 'plastic', color: '#e8d8be', tall: false },
  { id: 'cornCan', weight: 0.68, material: 'metal', color: '#f2c122', tall: false },
  { id: 'bananas', weight: 0.52, material: 'produce', color: '#f0c82e', tall: false },
  { id: 'pudding', weight: 0.32, material: 'pudding', color: '#f5cc45', tall: false },
];

function enableShadows(obj) {
  obj.traverse((child) => {
    if (child.isMesh && !child.userData.noShadow) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function attachBarcode(parent, pos, rot, size = [0.075, 0.042]) {
  const c = getCache();
  const mat = new THREE.MeshStandardMaterial({
    map: c.barcodeUnscanned,
    roughness: 0.35,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.userData.noShadow = true;
  parent.add(mesh);
  return mesh;
}

// Helper: sculpted organic strawberry
function makeBerry(scale = 1) {
  const c = getCache();
  const group = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.009, 0.005),
    new THREE.Vector2(0.019, 0.018),
    new THREE.Vector2(0.023, 0.032),
    new THREE.Vector2(0.017, 0.043),
    new THREE.Vector2(0.0, 0.045),
  ];
  const geo = new THREE.LatheGeometry(pts, 14);
  const mat = new THREE.MeshPhysicalMaterial({
    map: c.strawberry,
    roughness: 0.24,
    clearcoat: 0.7,
    clearcoatRoughness: 0.22,
  });
  const berry = new THREE.Mesh(geo, mat);
  group.add(berry);

  // Leafy green calyx crown
  const leafMat = new THREE.MeshStandardMaterial({ color: '#2e7d28', roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.018, 4), leafMat);
    leaf.position.set(Math.cos(a) * 0.008, 0.045, Math.sin(a) * 0.008);
    leaf.rotation.z = -Math.PI * 0.42;
    leaf.rotation.y = -a;
    group.add(leaf);
  }
  group.scale.setScalar(scale);
  return group;
}

// 1. Fresh Strawberries in Clear Clamshell Pack
function buildStrawberryPack(visual) {
  // Base molded plastic tray
  const trayMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.30,
    roughness: 0.06,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    side: THREE.DoubleSide,
  });

  // Soft white absorbent fruit pad underneath berries
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.165, 0.008, 0.125),
    new THREE.MeshStandardMaterial({ color: '#f5f2ec', roughness: 0.9 })
  );
  pad.position.y = 0.008;
  visual.add(pad);

  // 6 lush red strawberries nestled inside
  const positions = [
    [-0.048, 0.014, -0.028, 0.35],
    [0.0, 0.014, -0.030, -0.2],
    [0.048, 0.014, -0.025, 0.45],
    [-0.044, 0.014, 0.028, -0.4],
    [0.004, 0.014, 0.030, 0.25],
    [0.048, 0.014, 0.026, -0.35],
  ];
  positions.forEach(([x, y, z, tilt], i) => {
    const b = makeBerry(1.15 + (i % 2) * 0.08);
    b.position.set(x, y, z);
    b.rotation.set(0.28 * (i % 2 ? 1 : -1), i * 1.1, tilt);
    visual.add(b);
  });

  // Clear PET clamshell lid & base flange
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.072, 0.145), trayMat);
  shell.position.y = 0.040;
  shell.userData.noShadow = true;
  visual.add(shell);

  // Molded crisp plastic rim flange
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.202, 0.006, 0.162), trayMat);
  rim.position.y = 0.038;
  rim.userData.noShadow = true;
  visual.add(rim);

  // Barcode on top corner of clear pack (super readable & realistic!)
  const barcode = attachBarcode(visual, [0.032, 0.077, 0.022], [-Math.PI / 2, 0, 0], [0.078, 0.044]);
  return { barcode, hitSize: [0.22, 0.11, 0.18], height: 0.08 };
}

// 2. Gable-Top Fresh Milk Carton
function buildMilkCarton(visual) {
  const c = getCache();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: c.milk,
    roughness: 0.26,
    metalness: 0.02,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: '#f7f9fc',
    roughness: 0.28,
    clearcoat: 0.4,
  });

  // Rectangular carton body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.195, 0.105), bodyMat);
  body.position.y = 0.0975;
  visual.add(body);

  // Gable roof prism
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-0.0525, 0);
  gableShape.lineTo(0.0525, 0);
  gableShape.lineTo(0, 0.046);
  gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.105, bevelEnabled: false });
  gableGeo.translate(0, 0, -0.0525);
  const gable = new THREE.Mesh(gableGeo, new THREE.MeshPhysicalMaterial({
    color: '#1962ba',
    roughness: 0.26,
    clearcoat: 0.45,
  }));
  gable.position.y = 0.195;
  visual.add(gable);

  // Folded sealed top fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.019, 0.106), whiteMat);
  fin.position.y = 0.246;
  visual.add(fin);

  const barcode = attachBarcode(visual, [0.053, 0.075, 0], [0, Math.PI / 2, 0], [0.068, 0.040]);
  // Also subtle barcode on front lower corner so visible from clerk POV
  attachBarcode(visual, [0.015, 0.045, 0.0535], [0, 0, 0], [0.064, 0.036]);
  return { barcode, hitSize: [0.14, 0.27, 0.14], height: 0.255 };
}

// 3. Sculpted Crisp Red Apple
function buildApple(visual) {
  const c = getCache();
  // Organic lathe silhouette with realistic top/bottom indentations
  const pts = [
    new THREE.Vector2(0.0, 0.008),
    new THREE.Vector2(0.026, 0.001),
    new THREE.Vector2(0.049, 0.020),
    new THREE.Vector2(0.058, 0.052),
    new THREE.Vector2(0.057, 0.082),
    new THREE.Vector2(0.042, 0.106),
    new THREE.Vector2(0.020, 0.110),
    new THREE.Vector2(0.0, 0.097),
  ];
  const geo = new THREE.LatheGeometry(pts, 28);
  const mat = new THREE.MeshPhysicalMaterial({
    map: c.apple,
    roughness: 0.18,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
  });
  const apple = new THREE.Mesh(geo, mat);
  visual.add(apple);

  // Curved woody stem
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.096, 0),
    new THREE.Vector3(0.003, 0.118, 0.002),
    new THREE.Vector3(0.011, 0.132, 0.006),
  ]);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 8, 0.0042, 8, false),
    new THREE.MeshStandardMaterial({ color: '#4d321c', roughness: 0.88 })
  );
  visual.add(stem);

  // Crisp green leaf
  const leaf = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 12, 8),
    new THREE.MeshStandardMaterial({ color: '#398a2c', roughness: 0.45 })
  );
  leaf.scale.set(1.3, 0.18, 0.65);
  leaf.position.set(-0.019, 0.118, 0.006);
  leaf.rotation.set(0.25, 0.2, 0.42);
  visual.add(leaf);

  const barcode = attachBarcode(visual, [0.0, 0.062, 0.058], [-0.08, 0, 0], [0.052, 0.032]);
  return { barcode, hitSize: [0.14, 0.15, 0.14], height: 0.13 };
}

// 4. Strawberry Shortcake Slice in Clear Bakery Dome
function buildShortcake(visual) {
  // Golden scalloped foil pastry base
  const tray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.074, 0.068, 0.008, 24),
    new THREE.MeshStandardMaterial({ color: '#e2b744', metalness: 0.82, roughness: 0.25 })
  );
  tray.position.y = 0.004;
  visual.add(tray);

  // Triangular cake wedge layers (sponge + cream + red berry filling + sponge + thick cream!)
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-0.048, -0.042);
  wedgeShape.lineTo(0.052, -0.042);
  wedgeShape.lineTo(0.0, 0.054);
  wedgeShape.closePath();

  const extrudeLayer = (h, y, color, rough = 0.82) => {
    const g = new THREE.ExtrudeGeometry(wedgeShape, { depth: h, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: rough }));
    m.position.y = y;
    visual.add(m);
  };

  extrudeLayer(0.018, 0.010, '#f4d38c', 0.88); // lower sponge
  extrudeLayer(0.012, 0.029, '#fffcf5', 0.45); // whipped cream
  extrudeLayer(0.007, 0.041, '#df2938', 0.35); // strawberry jam slice
  extrudeLayer(0.017, 0.048, '#f4d38c', 0.88); // upper sponge
  extrudeLayer(0.016, 0.066, '#fffdf7', 0.42); // rich cream frosting

  // Whipped cream rosette swirl + glossy fresh strawberry on top!
  const rosette = new THREE.Mesh(
    new THREE.ConeGeometry(0.019, 0.022, 12),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 })
  );
  rosette.position.set(0, 0.090, -0.008);
  visual.add(rosette);

  const topBerry = makeBerry(0.88);
  topBerry.position.set(0, 0.092, -0.008);
  topBerry.rotation.set(0.15, 0.4, 0.12);
  visual.add(topBerry);

  // Crystal clear bakery plastic dome
  const domeMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.24,
    roughness: 0.04,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    side: THREE.DoubleSide,
  });
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.060, 0.072, 0.125, 24, 1, false),
    domeMat
  );
  dome.position.y = 0.070;
  dome.userData.noShadow = true;
  visual.add(dome);

  const barcode = attachBarcode(visual, [0, 0.048, 0.069], [-0.08, 0, 0], [0.062, 0.036]);
  return { barcode, hitSize: [0.16, 0.16, 0.16], height: 0.138 };
}

// 5. Orange Juice PET Bottle (with sloshing liquid!)
function buildOrangeJuice(visual) {
  const c = getCache();
  // Bottle outer clear shell
  const bottlePts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.043, 0.002),
    new THREE.Vector2(0.046, 0.018),
    new THREE.Vector2(0.046, 0.115),
    new THREE.Vector2(0.040, 0.155),
    new THREE.Vector2(0.022, 0.195),
    new THREE.Vector2(0.021, 0.212),
    new THREE.Vector2(0.0, 0.212),
  ];
  const shellGeo = new THREE.LatheGeometry(bottlePts, 24);
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: '#fff8ee',
    transparent: true,
    opacity: 0.30,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });

  // Vibrant golden-orange juice core inside
  const juicePts = [
    new THREE.Vector2(0.0, 0.005),
    new THREE.Vector2(0.042, 0.006),
    new THREE.Vector2(0.043, 0.115),
    new THREE.Vector2(0.037, 0.152),
    new THREE.Vector2(0.027, 0.174),
    new THREE.Vector2(0.0, 0.174),
  ];
  const juiceMat = new THREE.MeshPhysicalMaterial({
    color: '#ff8a0e',
    roughness: 0.14,
    clearcoat: 0.6,
    emissive: '#6e2800',
    emissiveIntensity: 0.18,
  });
  const juiceMesh = new THREE.Mesh(new THREE.LatheGeometry(juicePts, 22), juiceMat);
  visual.add(juiceMesh);

  const shellMesh = new THREE.Mesh(shellGeo, shellMat);
  shellMesh.userData.noShadow = true;
  visual.add(shellMesh);

  // Glossy wrap-around citrus label
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0472, 0.0472, 0.076, 24, 1, true),
    new THREE.MeshPhysicalMaterial({
      map: c.orangeJuice,
      roughness: 0.22,
      clearcoat: 0.6,
    })
  );
  label.position.y = 0.072;
  visual.add(label);

  // White ribbed screw cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.023, 0.022, 18),
    new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.32 })
  );
  cap.position.y = 0.220;
  visual.add(cap);

  const barcode = attachBarcode(visual, [0, 0.072, 0.0485], [0, 0, 0], [0.058, 0.034]);
  return { barcode, hitSize: [0.13, 0.25, 0.13], height: 0.235, liquidMesh: juiceMesh };
}

// 6. Fresh Flaky Croissant in Clear Bakery Cellophane Bag
function buildCroissant(visual) {
  // Golden-brown crescent croissant composed of overlapping curved buttery segments
  const pastryMat = new THREE.MeshStandardMaterial({
    color: '#c87b28',
    roughness: 0.58,
    metalness: 0.02,
  });
  const glazeMat = new THREE.MeshPhysicalMaterial({
    color: '#d98a2c',
    roughness: 0.32,
    clearcoat: 0.4,
  });

  const group = new THREE.Group();
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const angle = (t - 0.5) * 1.95;
    const rad = 0.054;
    const thickness = Math.sin(t * Math.PI) * 0.026 + 0.011;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(thickness, 14, 10), i % 2 === 0 ? glazeMat : pastryMat);
    seg.scale.set(1.05, 0.85, 1.25);
    seg.position.set(Math.sin(angle) * rad, 0.030, -Math.cos(angle) * rad + 0.036);
    seg.rotation.y = -angle;
    group.add(seg);
  }
  visual.add(group);

  // Crinkly translucent bakery cellophane pouch
  const bagMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.25,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  });
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.075, 0.115), bagMat);
  pouch.position.set(0, 0.039, 0.004);
  pouch.userData.noShadow = true;
  visual.add(pouch);

  // Shiny metallic gold twist-tie on gathered bag end
  const tie = new THREE.Mesh(
    new THREE.TorusGeometry(0.014, 0.003, 8, 16),
    new THREE.MeshStandardMaterial({ color: '#f0c038', metalness: 0.9, roughness: 0.2 })
  );
  tie.position.set(0.086, 0.038, 0.004);
  tie.rotation.y = Math.PI / 2;
  visual.add(tie);

  const barcode = attachBarcode(visual, [-0.01, 0.078, 0.01], [-Math.PI / 2, 0, 0], [0.068, 0.038]);
  return { barcode, hitSize: [0.20, 0.10, 0.14], height: 0.08 };
}

// 7. Glass Jar of Golden Honey
function buildHoneyJar(visual) {
  const c = getCache();
  // Faceted hexagonal glass jar
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#fffef5',
    transparent: true,
    opacity: 0.28,
    roughness: 0.04,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });
  const honeyMat = new THREE.MeshPhysicalMaterial({
    color: '#e59210',
    emissive: '#6e3800',
    emissiveIntensity: 0.25,
    roughness: 0.10,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.92,
  });

  const honeyCore = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.098, 8), honeyMat);
  honeyCore.position.y = 0.056;
  visual.add(honeyCore);

  const jarGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.115, 8), glassMat);
  jarGlass.position.y = 0.059;
  jarGlass.userData.noShadow = true;
  visual.add(jarGlass);

  // Honey label band
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.049, 0.049, 0.054, 8, 1, true),
    new THREE.MeshStandardMaterial({ map: c.honeyLabel, roughness: 0.55 })
  );
  label.position.y = 0.058;
  visual.add(label);

  // Brushed gold metal screw lid
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.044, 0.022, 24),
    new THREE.MeshStandardMaterial({ color: '#d8a634', metalness: 0.85, roughness: 0.22 })
  );
  lid.position.y = 0.126;
  visual.add(lid);

  const barcode = attachBarcode(visual, [0, 0.058, 0.046], [0, 0, 0], [0.056, 0.034]);
  return { barcode, hitSize: [0.13, 0.16, 0.13], height: 0.14 };
}

// 8. Luxury Chocolate Bar (Foil + Cocoa Paper Sleeve)
function buildChocolateBar(visual) {
  const c = getCache();
  // Gold foil inner bar peeking out both ends
  const foil = new THREE.Mesh(
    new THREE.BoxGeometry(0.168, 0.022, 0.088),
    new THREE.MeshStandardMaterial({ color: '#eac048', metalness: 0.88, roughness: 0.24 })
  );
  foil.position.y = 0.012;
  visual.add(foil);

  // Rich cocoa paper sleeve
  const sleeve = new THREE.Mesh(
    new THREE.BoxGeometry(0.142, 0.025, 0.092),
    new THREE.MeshPhysicalMaterial({ map: c.chocolate, roughness: 0.35, clearcoat: 0.3 })
  );
  sleeve.position.y = 0.013;
  visual.add(sleeve);

  const barcode = attachBarcode(visual, [0.025, 0.0265, 0], [-Math.PI / 2, 0, 0], [0.064, 0.036]);
  return { barcode, hitSize: [0.19, 0.07, 0.12], height: 0.03 };
}

// 9. 6-Egg Clear Molded Carton
function buildEggCarton(visual) {
  const eggMat = new THREE.MeshPhysicalMaterial({
    color: '#f2e0c9',
    roughness: 0.42,
    clearcoat: 0.2,
  });
  const eggPositions = [
    [-0.048, -0.026], [0, -0.026], [0.048, -0.026],
    [-0.048, 0.026], [0, 0.026], [0.048, 0.026],
  ];
  eggPositions.forEach(([ex, ez]) => {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), eggMat);
    egg.scale.set(1.0, 1.32, 1.0);
    egg.position.set(ex, 0.034, ez);
    visual.add(egg);
  });

  // Translucent molded plastic egg shell pack
  const packMat = new THREE.MeshPhysicalMaterial({
    color: '#fafdff',
    transparent: true,
    opacity: 0.32,
    roughness: 0.10,
    clearcoat: 0.9,
    side: THREE.DoubleSide,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.066, 0.112), packMat);
  base.position.y = 0.035;
  base.userData.noShadow = true;
  visual.add(base);

  const flange = new THREE.Mesh(new THREE.BoxGeometry(0.184, 0.005, 0.126), packMat);
  flange.position.y = 0.034;
  flange.userData.noShadow = true;
  visual.add(flange);

  const barcode = attachBarcode(visual, [0, 0.069, 0], [-Math.PI / 2, 0, 0], [0.074, 0.040]);
  return { barcode, hitSize: [0.20, 0.10, 0.15], height: 0.072 };
}

// 10. Metallic Sweet Corn Can
function buildCornCan(visual) {
  const c = getCache();
  const tinMat = new THREE.MeshStandardMaterial({
    color: '#d8dde2',
    metalness: 0.92,
    roughness: 0.20,
  });

  // Main tin cylinder
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.116, 28), tinMat);
  core.position.y = 0.058;
  visual.add(core);

  // Rolled metal top & bottom rims
  const topRim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0032, 10, 28), tinMat);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = 0.116;
  visual.add(topRim);

  const botRim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0032, 10, 28), tinMat);
  botRim.rotation.x = Math.PI / 2;
  botRim.position.y = 0.003;
  visual.add(botRim);

  // Easy-open pull tab on top lid
  const tab = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 8, 16), tinMat);
  tab.rotation.x = Math.PI / 2;
  tab.position.set(0.012, 0.118, 0);
  visual.add(tab);

  // Glossy paper wrap label
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0452, 0.0452, 0.098, 28, 1, true),
    new THREE.MeshPhysicalMaterial({ map: c.cornCan, roughness: 0.26, clearcoat: 0.45 })
  );
  label.position.y = 0.058;
  visual.add(label);

  const barcode = attachBarcode(visual, [0, 0.058, 0.0462], [0, 0, 0], [0.056, 0.034]);
  return { barcode, hitSize: [0.13, 0.15, 0.13], height: 0.12 };
}

// 11. Bunch of 3 Ripe Yellow Bananas
function buildBananas(visual) {
  const c = getCache();
  const banMat = new THREE.MeshPhysicalMaterial({
    map: c.banana,
    roughness: 0.36,
    clearcoat: 0.22,
  });

  const bunch = new THREE.Group();
  [-0.028, 0, 0.028].forEach((zOff, idx) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.072, 0.058, zOff * 0.45),
      new THREE.Vector3(-0.028, 0.022, zOff * 0.9),
      new THREE.Vector3(0.028, 0.018, zOff),
      new THREE.Vector3(0.076, 0.048, zOff * 0.8),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.0165, 10, false), banMat);
    tube.rotation.x = (idx - 1) * 0.12;
    bunch.add(tube);
  });

  // Woody crown stem joining the bunch
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.018, 0.026, 10),
    new THREE.MeshStandardMaterial({ color: '#6b5c2a', roughness: 0.85 })
  );
  crown.position.set(-0.076, 0.068, 0);
  crown.rotation.z = 0.45;
  bunch.add(crown);

  visual.add(bunch);

  // Subtle wrap band with barcode
  const barcode = attachBarcode(visual, [0.005, 0.044, 0.018], [-0.45, 0, 0], [0.062, 0.034]);
  return { barcode, hitSize: [0.19, 0.11, 0.13], height: 0.085 };
}

// 12. Caramel Custard Pudding Cup (jiggles!)
function buildPuddingCup(visual) {
  // Translucent tapered plastic cup
  const cupMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.32,
    roughness: 0.06,
    clearcoat: 1.0,
  });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.036, 0.072, 24), cupMat);
  cup.position.y = 0.036;
  cup.userData.noShadow = true;
  visual.add(cup);

  // Jiggling inner pudding group
  const jellyGroup = new THREE.Group();
  const caramel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.033, 0.014, 22),
    new THREE.MeshPhysicalMaterial({ color: '#4d1b06', roughness: 0.12, clearcoat: 0.8 })
  );
  caramel.position.y = 0.010;
  jellyGroup.add(caramel);

  const custard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.036, 0.050, 22),
    new THREE.MeshPhysicalMaterial({ color: '#f8d358', roughness: 0.18, clearcoat: 0.65 })
  );
  custard.position.y = 0.042;
  jellyGroup.add(custard);
  visual.add(jellyGroup);

  // Glossy gold foil seal lid with peel tab
  const foilLid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.049, 0.049, 0.004, 24),
    new THREE.MeshStandardMaterial({ color: '#f2ca4e', metalness: 0.78, roughness: 0.24 })
  );
  foilLid.position.y = 0.073;
  visual.add(foilLid);

  const barcode = attachBarcode(visual, [0, 0.076, 0], [-Math.PI / 2, 0, 0], [0.056, 0.032]);
  return { barcode, hitSize: [0.13, 0.11, 0.13], height: 0.082, jellyGroup };
}

export function createProduct(typeId, { isSpecial = false } = {}) {
  const spec = PRODUCT_CATALOG.find((p) => p.id === typeId) || PRODUCT_CATALOG[0];
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);

  let built;
  switch (spec.id) {
    case 'strawberry': built = buildStrawberryPack(visual); break;
    case 'milk': built = buildMilkCarton(visual); break;
    case 'apple': built = buildApple(visual); break;
    case 'shortcake': built = buildShortcake(visual); break;
    case 'orangeJuice': built = buildOrangeJuice(visual); break;
    case 'croissant': built = buildCroissant(visual); break;
    case 'honey': built = buildHoneyJar(visual); break;
    case 'chocolate': built = buildChocolateBar(visual); break;
    case 'eggs': built = buildEggCarton(visual); break;
    case 'cornCan': built = buildCornCan(visual); break;
    case 'bananas': built = buildBananas(visual); break;
    case 'pudding': built = buildPuddingCup(visual); break;
    default: built = buildApple(visual); break;
  }

  enableShadows(visual);

  // Special ruby/gold sparkle sticker (from Customer #2+ as an exciting discovery!)
  let specialBadge = null;
  if (isSpecial) {
    const c = getCache();
    const badgeMat = new THREE.MeshPhysicalMaterial({
      map: c.discountSticker,
      transparent: true,
      roughness: 0.18,
      metalness: 0.25,
      clearcoat: 1.0,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    specialBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.048), badgeMat);
    specialBadge.position.set(-0.025, built.height * 0.72, built.hitSize[2] * 0.42);
    specialBadge.rotation.set(-0.22, -0.15, 0.15);
    specialBadge.userData.noShadow = true;
    visual.add(specialBadge);
  }

  // Generous invisible touch hitbox for effortless 5-year-old grabbing
  const hitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(built.hitSize[0] * 1.22, built.hitSize[1] * 1.25, built.hitSize[2] * 1.22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.position.y = built.hitSize[1] * 0.5;
  hitMesh.userData.noShadow = true;
  root.add(hitMesh);

  const item = {
    id: spec.id,
    root,
    visual,
    hitMesh,
    barcodeMesh: built.barcode,
    weight: spec.weight,
    material: spec.material,
    color: spec.color,
    tall: spec.tall,
    height: built.height,
    isSpecial,
    specialBadge,
    jellyGroup: built.jellyGroup || null,
    liquidMesh: built.liquidMesh || null,
    // Runtime state
    state: 'belt', // 'belt' | 'dragging' | 'flying' | 'counter' | 'bagged'
    scanned: false,
    hasGoldSticker: false,
    scanFlash: 0,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 0,
    tiltX: 0,
    tiltZ: 0,
    vel: new THREE.Vector3(),
    flyAnim: null,
    bagSlotIndex: -1,
  };

  hitMesh.userData.interactive = 'product';
  hitMesh.userData.product = item;

  return item;
}

export function markProductScanned(item) {
  if (item.scanned) return false;
  item.scanned = true;
  item.scanFlash = 1.0;
  const c = getCache();
  if (item.barcodeMesh) {
    item.barcodeMesh.material.map = c.barcodeScanned;
    item.barcodeMesh.material.needsUpdate = true;
  }
  item.wobbleAmp = Math.max(item.wobbleAmp, 0.28);
  return true;
}

export function applyGoldStickerToProduct(item) {
  if (item.hasGoldSticker) return false;
  item.hasGoldSticker = true;
  const c = getCache();
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.044, 0.044),
    new THREE.MeshPhysicalMaterial({
      map: c.goldSticker,
      transparent: true,
      roughness: 0.16,
      metalness: 0.65,
      clearcoat: 1.0,
      polygonOffset: true,
      polygonOffsetFactor: -5,
    })
  );
  sticker.position.set(0.022, item.height * 0.68, 0.056);
  sticker.rotation.set(-0.25, 0.15, -0.18);
  sticker.userData.noShadow = true;
  item.visual.add(sticker);
  item.wobbleAmp = 0.25;
  return true;
}

export function updateProductVisuals(item, dt, now) {
  // Decay scan flash scale pop
  if (item.scanFlash > 0) {
    item.scanFlash = Math.max(0, item.scanFlash - dt * 3.8);
    const bump = 1 + Math.sin(item.scanFlash * Math.PI) * 0.14;
    item.visual.scale.setScalar(bump);
  } else if (item.visual.scale.x !== 1) {
    item.visual.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 14));
  }

  // Elastic wobble (e.g. when poked, placed, or pudding jiggles)
  if (item.wobbleAmp > 0.002) {
    item.wobblePhase += dt * (item.material === 'pudding' ? 22 : 16);
    item.wobbleAmp *= Math.exp(-dt * (item.material === 'pudding' ? 3.5 : 7.0));
    const s = Math.sin(item.wobblePhase) * item.wobbleAmp;
    item.visual.rotation.z = item.tiltZ + s * 0.35;
    item.visual.rotation.x = item.tiltX + Math.cos(item.wobblePhase * 0.8) * item.wobbleAmp * 0.22;
    if (item.jellyGroup) {
      item.jellyGroup.scale.set(1 + s * 0.22, 1 - s * 0.25, 1 + s * 0.22);
    }
  } else {
    item.visual.rotation.z = THREE.MathUtils.lerp(item.visual.rotation.z, item.tiltZ, Math.min(1, dt * 12));
    item.visual.rotation.x = THREE.MathUtils.lerp(item.visual.rotation.x, item.tiltX, Math.min(1, dt * 12));
    if (item.jellyGroup) {
      item.jellyGroup.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 10));
    }
  }

  // Orange juice gentle liquid slosh when moving
  if (item.liquidMesh) {
    const targetRotZ = THREE.MathUtils.clamp(-item.vel.x * 0.18, -0.18, 0.18);
    const targetRotX = THREE.MathUtils.clamp(item.vel.z * 0.18, -0.18, 0.18);
    item.liquidMesh.rotation.z = THREE.MathUtils.lerp(item.liquidMesh.rotation.z, targetRotZ, Math.min(1, dt * 10));
    item.liquidMesh.rotation.x = THREE.MathUtils.lerp(item.liquidMesh.rotation.x, targetRotX, Math.min(1, dt * 10));
  }

  // Gentle breathing sheen on special discount badge
  if (item.specialBadge && !item.scanned) {
    const s = 1 + Math.sin(now * 5.2) * 0.08;
    item.specialBadge.scale.setScalar(s);
  }
}
