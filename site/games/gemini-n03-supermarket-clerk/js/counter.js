import * as THREE from 'three';
import {
  createBrushedSteelTextures,
  createConveyorBeltTextures,
  createReceiptTexture,
  createGoldStickerTexture,
  createAisleBackdropTexture,
  createOakWoodTexture,
} from './textures.js';

export const LAYOUT = {
  beltCenterX: -0.56,
  beltMinX: -0.90,
  beltMaxX: -0.22,
  beltZ: 0.09,
  beltY: 0.012,
  scannerPos: new THREE.Vector3(0.0, 0.0, 0.10),
  scannerRadius: 0.21,
  bagPos: new THREE.Vector3(0.52, 0.0, 0.12),
  coinTrayPos: new THREE.Vector3(-0.02, 0.0, -0.27),
  stickerPos: new THREE.Vector3(-0.35, 0.0, -0.31),
  gunDockPos: new THREE.Vector3(0.24, 0.0, -0.29),
  registerPos: new THREE.Vector3(0.60, 0.0, -0.33),
  customerZ: -0.78,
};

export function createCheckoutCounter(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const steelTex = createBrushedSteelTextures();
  const beltTex = createConveyorBeltTextures();
  const oakTex = createOakWoodTexture();
  const receiptTex = createReceiptTexture();
  const goldStickerTex = createGoldStickerTexture();

  // --- 1. Main Brushed Stainless Steel Countertop ---
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#aeb5bc',
    map: steelTex.map,
    roughnessMap: steelTex.roughnessMap,
    bumpMap: steelTex.bumpMap,
    bumpScale: 0.0025,
    metalness: 0.78,
    roughness: 0.34,
  });

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.08, 1.12), steelMat);
  counterTop.position.set(0, -0.04, 0.0);
  counterTop.receiveShadow = true;
  group.add(counterTop);

  // Dark matte rubber bumper trim along clerk-facing front edge
  const trimMat = new THREE.MeshStandardMaterial({ color: '#24272c', roughness: 0.72, metalness: 0.15 });
  const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.084, 0.036), trimMat);
  frontTrim.position.set(0, -0.04, 0.56);
  group.add(frontTrim);

  // Warm oak cabinet base beneath counter
  const oakMat = new THREE.MeshStandardMaterial({ map: oakTex, roughness: 0.52, metalness: 0.05 });
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(2.50, 0.85, 1.04), oakMat);
  cabinet.position.set(0, -0.50, 0.0);
  group.add(cabinet);

  // --- 2. Conveyor Belt (Left) ---
  const beltGroup = new THREE.Group();
  beltGroup.position.set(LAYOUT.beltCenterX, 0, LAYOUT.beltZ);
  group.add(beltGroup);

  // Recessed stainless frame around belt
  const beltFrame = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.020, 0.52), trimMat);
  beltFrame.position.y = 0.003;
  beltFrame.receiveShadow = true;
  beltGroup.add(beltFrame);

  // Rolling ribbed rubber belt surface
  const beltMat = new THREE.MeshStandardMaterial({
    map: beltTex.map,
    bumpMap: beltTex.bumpMap,
    bumpScale: 0.006,
    roughnessMap: beltTex.roughnessMap,
    roughness: 0.84,
    metalness: 0.05,
  });
  const beltSurface = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.012, 0.46), beltMat);
  beltSurface.position.y = 0.009;
  beltSurface.receiveShadow = true;
  beltGroup.add(beltSurface);

  // Chrome aluminum rollers at belt ends
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#c4cbd2', metalness: 0.88, roughness: 0.20 });
  [-0.355, 0.355].forEach((rx) => {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 16), chromeMat);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(rx, 0.007, 0);
    beltGroup.add(roller);
  });

  // Front & back subtle brushed side rails
  [-0.245, 0.245].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.022, 0.022), chromeMat);
    rail.position.set(0, 0.014, rz);
    rail.castShadow = true;
    rail.receiveShadow = true;
    beltGroup.add(rail);
  });

  // Chunky tactile green belt jog switch button (front-right corner of belt)
  const beltBtnGroup = new THREE.Group();
  beltBtnGroup.position.set(0.28, 0.012, 0.30);
  beltGroup.add(beltBtnGroup);

  const btnHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.054, 0.020, 24),
    trimMat
  );
  btnHousing.position.y = 0.010;
  beltBtnGroup.add(btnHousing);

  const beltBtnMat = new THREE.MeshPhysicalMaterial({
    color: '#25b864',
    emissive: '#0e5e30',
    emissiveIntensity: 0.35,
    roughness: 0.22,
    clearcoat: 0.8,
  });
  const beltBtnCap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.018, 24), beltBtnMat);
  beltBtnCap.position.y = 0.024;
  beltBtnCap.castShadow = true;
  beltBtnGroup.add(beltBtnCap);

  // Subtle embossed chevron play-arrow on belt button (pure shape, zero text)
  const chevShape = new THREE.Shape();
  chevShape.moveTo(-0.011, -0.013);
  chevShape.lineTo(0.014, 0);
  chevShape.lineTo(-0.011, 0.013);
  chevShape.closePath();
  const chevMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(chevShape),
    new THREE.MeshBasicMaterial({ color: '#e6fff0' })
  );
  chevMesh.rotation.x = -Math.PI / 2;
  chevMesh.position.set(0.002, 0.034, 0);
  beltBtnGroup.add(chevMesh);

  const beltBtnHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.07, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  beltBtnHit.position.y = 0.03;
  beltBtnHit.userData.interactive = 'beltButton';
  beltBtnGroup.add(beltBtnHit);

  // --- 3. Recessed Glass Barcode Scanner + Integrated Weight Scale (Center) ---
  const scannerGroup = new THREE.Group();
  scannerGroup.position.copy(LAYOUT.scannerPos);
  group.add(scannerGroup);

  // Flush brushed stainless bezel
  const scannerBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.014, 0.34),
    chromeMat
  );
  scannerBezel.position.y = 0.004;
  scannerBezel.receiveShadow = true;
  scannerGroup.add(scannerBezel);

  // Dark optical cavity beneath glass
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.015, 0.26),
    new THREE.MeshStandardMaterial({ color: '#090b0e', roughness: 0.65, metalness: 0.12 })
  );
  cavity.position.y = 0.0055;
  scannerGroup.add(cavity);

  // Internal chrome angled mirror bars visible inside cavity
  [-0.06, 0.06].forEach((mx) => {
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.006, 0.20),
      new THREE.MeshStandardMaterial({ color: '#5c6670', metalness: 0.92, roughness: 0.16 })
    );
    mirror.position.set(mx, 0.010, 0);
    scannerGroup.add(mirror);
  });

  // Glowing crossed red laser beams inside & projecting softly above glass!
  const laserLineMat = new THREE.MeshBasicMaterial({
    color: '#ff2233',
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const laserGroup = new THREE.Group();
  laserGroup.position.y = 0.015;
  scannerGroup.add(laserGroup);

  const laserBeam1 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.0065), laserLineMat);
  laserBeam1.rotation.x = -Math.PI / 2;
  laserGroup.add(laserBeam1);

  const laserBeam2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.0065), laserLineMat);
  laserBeam2.rotation.x = -Math.PI / 2;
  laserBeam2.rotation.z = Math.PI / 2;
  laserGroup.add(laserBeam2);

  const laserDiag1 = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.0045), laserLineMat);
  laserDiag1.rotation.x = -Math.PI / 2;
  laserDiag1.rotation.z = Math.PI / 4;
  laserGroup.add(laserDiag1);

  const laserDiag2 = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.0045), laserLineMat);
  laserDiag2.rotation.x = -Math.PI / 2;
  laserDiag2.rotation.z = -Math.PI / 4;
  laserGroup.add(laserDiag2);

  // Soft vertical volumetric laser glow fan (visible when item passes over!)
  const laserFanMat = new THREE.MeshBasicMaterial({
    color: '#ff1f38',
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const laserFan1 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), laserFanMat);
  laserFan1.position.y = 0.055;
  laserGroup.add(laserFan1);
  const laserFan2 = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), laserFanMat);
  laserFan2.position.y = 0.055;
  laserFan2.rotation.y = Math.PI / 2;
  laserGroup.add(laserFan2);

  // Crystal-clear protective glass plate
  const glassPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, 0.004, 0.27),
    new THREE.MeshPhysicalMaterial({
      color: '#e8f4ff',
      transparent: true,
      opacity: 0.24,
      roughness: 0.03,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    })
  );
  glassPlate.position.y = 0.0155;
  glassPlate.receiveShadow = true;
  scannerGroup.add(glassPlate);

  // Dynamic upward point light illuminating the underside of products over the scanner!
  const scannerLight = new THREE.PointLight('#ff1a2c', 0.85, 0.72, 1.8);
  scannerLight.position.set(0, 0.06, 0);
  scannerGroup.add(scannerLight);

  // Scanner status indicator LED (red idle -> bright emerald on scan)
  const ledMat = new THREE.MeshStandardMaterial({
    color: '#ff2838',
    emissive: '#ff1828',
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const statusLed = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 16), ledMat);
  statusLed.position.set(0.145, 0.013, 0.135);
  scannerGroup.add(statusLed);

  // Integrated Weight-Scale LED Bar along back edge of scanner bezel (8 segments, ZERO numbers!)
  const weightLeds = [];
  for (let i = 0; i < 8; i++) {
    const segMat = new THREE.MeshStandardMaterial({
      color: '#22262b',
      emissive: '#ffb82e',
      emissiveIntensity: 0.0,
      roughness: 0.25,
    });
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.014), segMat);
    seg.position.set(-0.112 + i * 0.032, 0.013, -0.148);
    scannerGroup.add(seg);
    weightLeds.push(segMat);
  }

  // --- 4. Shopping Bag Stainless Cradle (Right) ---
  const cradleGroup = new THREE.Group();
  cradleGroup.position.copy(LAYOUT.bagPos);
  group.add(cradleGroup);

  const cradlePad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.20, 0.010, 32),
    new THREE.MeshStandardMaterial({ color: '#2b2f35', roughness: 0.78 })
  );
  cradlePad.position.y = 0.005;
  cradlePad.receiveShadow = true;
  cradleGroup.add(cradlePad);

  const cradleRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.195, 0.007, 10, 36),
    chromeMat
  );
  cradleRing.rotation.x = Math.PI / 2;
  cradleRing.position.y = 0.012;
  cradleGroup.add(cradleRing);

  // --- 5. Blue Rubber Coin Tray (カルトン) ---
  const coinTrayGroup = new THREE.Group();
  coinTrayGroup.position.copy(LAYOUT.coinTrayPos);
  group.add(coinTrayGroup);

  const trayBlueMat = new THREE.MeshPhysicalMaterial({
    color: '#1b589e',
    roughness: 0.42,
    clearcoat: 0.35,
  });
  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.016, 0.14), trayBlueMat);
  trayBase.position.y = 0.008;
  trayBase.receiveShadow = true;
  trayBase.castShadow = true;
  coinTrayGroup.add(trayBase);

  // Raised tray lips
  const lipLongGeo = new THREE.BoxGeometry(0.22, 0.022, 0.014);
  const lipShortGeo = new THREE.BoxGeometry(0.014, 0.022, 0.14);
  [-0.066, 0.066].forEach((lz) => {
    const lip = new THREE.Mesh(lipLongGeo, trayBlueMat);
    lip.position.set(0, 0.016, lz);
    coinTrayGroup.add(lip);
  });
  [-0.106, 0.106].forEach((lx) => {
    const lip = new THREE.Mesh(lipShortGeo, trayBlueMat);
    lip.position.set(lx, 0.016, 0);
    coinTrayGroup.add(lip);
  });

  // Soft rubber coin mat dots inside tray
  const matInner = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.004, 0.11),
    new THREE.MeshStandardMaterial({ color: '#14447c', roughness: 0.82 })
  );
  matInner.position.y = 0.017;
  matInner.receiveShadow = true;
  coinTrayGroup.add(matInner);

  const trayCoinsGroup = new THREE.Group();
  trayCoinsGroup.position.y = 0.020;
  coinTrayGroup.add(trayCoinsGroup);

  const coinTrayHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.08, 0.18),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  coinTrayHit.position.y = 0.03;
  coinTrayHit.userData.interactive = 'coinTray';
  coinTrayGroup.add(coinTrayHit);

  // --- 6. Gold Star Sticker Roll Dispenser (お買い上げシール) ---
  const stickerGroup = new THREE.Group();
  stickerGroup.position.copy(LAYOUT.stickerPos);
  stickerGroup.rotation.y = 0.22;
  group.add(stickerGroup);

  const dispBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.018, 0.13),
    new THREE.MeshStandardMaterial({ color: '#d9dfe4', metalness: 0.72, roughness: 0.28 })
  );
  dispBase.position.y = 0.009;
  dispBase.castShadow = true;
  stickerGroup.add(dispBase);

  // Side arms holding the gold roll
  [-0.042, 0.042].forEach((sx) => {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.010, 0.085, 0.055),
      chromeMat
    );
    arm.position.set(sx, 0.055, -0.01);
    arm.castShadow = true;
    stickerGroup.add(arm);
  });

  // Glossy gold sticker spool
  const goldRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, 0.068, 24),
    new THREE.MeshStandardMaterial({ color: '#e5b836', metalness: 0.82, roughness: 0.22 })
  );
  goldRoll.rotation.z = Math.PI / 2;
  goldRoll.position.set(0, 0.068, -0.01);
  goldRoll.castShadow = true;
  stickerGroup.add(goldRoll);

  // Ready-to-grab curled gold star sticker tab peeking off the front edge!
  const stickerTabMat = new THREE.MeshPhysicalMaterial({
    map: goldStickerTex,
    transparent: true,
    roughness: 0.16,
    metalness: 0.65,
    clearcoat: 1.0,
    side: THREE.DoubleSide,
  });
  const stickerTab = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.052), stickerTabMat);
  stickerTab.position.set(0, 0.046, 0.052);
  stickerTab.rotation.x = -0.55;
  stickerGroup.add(stickerTab);

  const stickerHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.14, 0.16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  stickerHit.position.y = 0.06;
  stickerHit.userData.interactive = 'stickerRoll';
  stickerGroup.add(stickerHit);

  // --- 7. Handheld Laser Scanner Gun in Dock ---
  const gunDockGroup = new THREE.Group();
  gunDockGroup.position.copy(LAYOUT.gunDockPos);
  group.add(gunDockGroup);

  const dockBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.052, 0.024, 20),
    trimMat
  );
  dockBase.position.y = 0.012;
  dockBase.castShadow = true;
  gunDockGroup.add(dockBase);

  const gunGroup = new THREE.Group();
  gunGroup.position.set(0, 0.025, 0);
  gunDockGroup.add(gunGroup);

  const gunBodyMat = new THREE.MeshPhysicalMaterial({
    color: '#25282e',
    roughness: 0.32,
    clearcoat: 0.4,
  });
  const gunAccentMat = new THREE.MeshPhysicalMaterial({
    color: '#d92634',
    roughness: 0.26,
    clearcoat: 0.7,
  });

  // Ergonomic grip handle
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.115, 14), gunBodyMat);
  grip.position.set(0, 0.056, 0.01);
  grip.rotation.x = -0.25;
  grip.castShadow = true;
  gunGroup.add(grip);

  // Scanner optical head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.044, 0.088), gunBodyMat);
  head.position.set(0, 0.122, -0.018);
  head.rotation.x = 0.15;
  head.castShadow = true;
  gunGroup.add(head);

  // Red rubber bumper hood on head
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.048, 0.026), gunAccentMat);
  hood.position.set(0, 0.126, -0.056);
  hood.rotation.x = 0.15;
  gunGroup.add(hood);

  // Handheld laser fan beam (visible when firing!)
  const gunBeamMat = new THREE.MeshBasicMaterial({
    color: '#ff1c34',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const gunBeamShape = new THREE.Shape();
  gunBeamShape.moveTo(0, 0);
  gunBeamShape.lineTo(-0.14, 0.65);
  gunBeamShape.lineTo(0.14, 0.65);
  gunBeamShape.closePath();
  const gunBeam = new THREE.Mesh(new THREE.ShapeGeometry(gunBeamShape), gunBeamMat);
  gunBeam.rotation.x = -Math.PI / 2;
  gunBeam.position.set(0, 0.12, -0.068);
  gunGroup.add(gunBeam);

  const gunHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.18, 0.14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  gunHit.position.set(0, 0.09, -0.01);
  gunHit.userData.interactive = 'handheldGun';
  gunGroup.add(gunHit);

  // --- 8. POS Cash Register + Visual LCD + Receipt Printer + Pop-Out Drawer ---
  const registerGroup = new THREE.Group();
  registerGroup.position.copy(LAYOUT.registerPos);
  registerGroup.rotation.y = -0.34;
  group.add(registerGroup);

  const regDarkMat = new THREE.MeshPhysicalMaterial({
    color: '#2b2f36',
    roughness: 0.36,
    metalness: 0.18,
    clearcoat: 0.35,
  });

  // Heavy steel cash drawer housing
  const drawerHousing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.085, 0.28), regDarkMat);
  drawerHousing.position.y = 0.0425;
  drawerHousing.castShadow = true;
  drawerHousing.receiveShadow = true;
  registerGroup.add(drawerHousing);

  // Sliding Cash Drawer Tray with embossed golden/silver coins!
  const cashDrawer = new THREE.Group();
  cashDrawer.position.set(0, 0.042, 0.0);
  registerGroup.add(cashDrawer);

  const drawerBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, 0.064, 0.24),
    new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.6 })
  );
  cashDrawer.add(drawerBox);

  const drawerFront = new THREE.Mesh(new THREE.BoxGeometry(0.305, 0.072, 0.016), chromeMat);
  drawerFront.position.set(0, 0, 0.125);
  drawerFront.castShadow = true;
  cashDrawer.add(drawerFront);

  // Gleaming coins neatly stacked in drawer compartments
  const goldCoinMat = new THREE.MeshStandardMaterial({ color: '#f2c43c', metalness: 0.92, roughness: 0.16 });
  const silverCoinMat = new THREE.MeshStandardMaterial({ color: '#dfe4e8', metalness: 0.94, roughness: 0.14 });
  const copperCoinMat = new THREE.MeshStandardMaterial({ color: '#cf7c44', metalness: 0.88, roughness: 0.22 });
  const coinMats = [goldCoinMat, silverCoinMat, copperCoinMat, goldCoinMat];
  for (let c = 0; c < 4; c++) {
    for (let s = 0; s < 4; s++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.0045, 16), coinMats[c]);
      coin.position.set(-0.095 + c * 0.063, 0.014 + s * 0.005, 0.055);
      cashDrawer.add(coin);
    }
  }
  // Crisp pastel-green & warm-gold paper bills (zero text!)
  const bill1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.008, 0.058),
    new THREE.MeshStandardMaterial({ color: '#d8e3c5', roughness: 0.72 })
  );
  bill1.position.set(-0.065, 0.022, -0.035);
  cashDrawer.add(bill1);
  const bill2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.008, 0.058),
    new THREE.MeshStandardMaterial({ color: '#e8d7b7', roughness: 0.72 })
  );
  bill2.position.set(0.065, 0.022, -0.035);
  cashDrawer.add(bill2);

  const drawerHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.11, 0.28),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  drawerHit.position.set(0, 0.01, 0.04);
  drawerHit.userData.interactive = 'cashDrawer';
  cashDrawer.add(drawerHit);

  // Upper POS Terminal Pedestal & Slanted Touch/Display Screen
  const posNeck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.11), regDarkMat);
  posNeck.position.set(0.02, 0.135, -0.03);
  posNeck.castShadow = true;
  registerGroup.add(posNeck);

  const screenBezel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.165, 0.024), regDarkMat);
  screenBezel.position.set(0.02, 0.225, 0.01);
  screenBezel.rotation.x = -0.34;
  screenBezel.castShadow = true;
  registerGroup.add(screenBezel);

  // Dynamic Canvas LCD Screen (Pure visual product dots & happy icons — ZERO text/numbers!)
  const lcdCanvas = document.createElement('canvas');
  lcdCanvas.width = 256;
  lcdCanvas.height = 176;
  const lcdCtx = lcdCanvas.getContext('2d');
  const lcdTex = new THREE.CanvasTexture(lcdCanvas);
  lcdTex.colorSpace = THREE.SRGBColorSpace;

  const lcdMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.215, 0.140),
    new THREE.MeshBasicMaterial({ map: lcdTex })
  );
  lcdMesh.position.set(0.02, 0.225, 0.023);
  lcdMesh.rotation.x = -0.34;
  registerGroup.add(lcdMesh);

  function updateLCD(scannedColors = [], celebrating = false) {
    lcdCtx.fillStyle = '#0f1b24';
    lcdCtx.fillRect(0, 0, 256, 176);

    // Subtle glossy glass diagonal sheen
    const sheen = lcdCtx.createLinearGradient(0, 0, 256, 176);
    sheen.addColorStop(0, 'rgba(130, 220, 255, 0.14)');
    sheen.addColorStop(0.5, 'rgba(130, 220, 255, 0.0)');
    lcdCtx.fillStyle = sheen;
    lcdCtx.fillRect(0, 0, 256, 176);

    if (celebrating) {
      // Glowing warm golden star & smile arc (zero text)
      lcdCtx.fillStyle = '#ffd54a';
      lcdCtx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 48 : 22;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = 128 + Math.cos(a) * r;
        const py = 88 + Math.sin(a) * r;
        if (i === 0) lcdCtx.moveTo(px, py);
        else lcdCtx.lineTo(px, py);
      }
      lcdCtx.closePath();
      lcdCtx.fill();
    } else {
      // Visual tally pips for each scanned product
      const totalSlots = Math.max(5, scannedColors.length);
      scannedColors.forEach((col, i) => {
        const colIdx = i % 5;
        const rowIdx = Math.floor(i / 5);
        const cx = 36 + colIdx * 46;
        const cy = 54 + rowIdx * 54;
        lcdCtx.fillStyle = col;
        lcdCtx.beginPath();
        lcdCtx.arc(cx, cy, 17, 0, Math.PI * 2);
        lcdCtx.fill();

        // Tiny bright specular highlight on dot
        lcdCtx.fillStyle = 'rgba(255,255,255,0.45)';
        lcdCtx.beginPath();
        lcdCtx.arc(cx - 5, cy - 5, 5, 0, Math.PI * 2);
        lcdCtx.fill();
      });

      // Bottom emerald progress bar
      const barW = Math.min(220, (scannedColors.length / Math.max(3, totalSlots)) * 220);
      lcdCtx.fillStyle = '#1b3545';
      lcdCtx.fillRect(18, 146, 220, 14);
      lcdCtx.fillStyle = '#2de082';
      lcdCtx.fillRect(18, 146, barW, 14);
    }
    lcdTex.needsUpdate = true;
  }
  updateLCD([], false);

  // Thermal Receipt Printer Box on Left Side of Register
  const printerBox = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.088, 0.115), regDarkMat);
  printerBox.position.set(-0.115, 0.125, 0.02);
  printerBox.castShadow = true;
  registerGroup.add(printerBox);

  // Paper slot
  const paperSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.008, 0.012),
    new THREE.MeshBasicMaterial({ color: '#090a0c' })
  );
  paperSlot.position.set(-0.115, 0.170, 0.028);
  registerGroup.add(paperSlot);

  // Curling Thermal Paper Receipt Strip!
  const receiptPivot = new THREE.Group();
  receiptPivot.position.set(-0.115, 0.170, 0.028);
  registerGroup.add(receiptPivot);

  const receiptMat = new THREE.MeshStandardMaterial({
    map: receiptTex,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const receiptGeo = new THREE.PlaneGeometry(0.056, 0.16, 1, 8);
  // Subtle natural thermal paper curl
  const rPos = receiptGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const py = rPos.getY(i) + 0.08; // 0 to 0.16
    rPos.setY(i, py);
    rPos.setZ(i, Math.pow(py / 0.16, 2) * 0.038);
  }
  receiptGeo.computeVertexNormals();

  const receiptMesh = new THREE.Mesh(receiptGeo, receiptMat);
  receiptMesh.scale.set(1, 0.05, 1);
  receiptMesh.castShadow = true;
  receiptPivot.add(receiptMesh);

  const receiptHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.18, 0.10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  receiptHit.position.set(0, 0.08, 0.02);
  receiptHit.userData.interactive = 'receipt';
  receiptPivot.add(receiptHit);

  // --- 9. Warm Photographic Bokeh Supermarket Aisle Backdrop ---
  const backdropTex = createAisleBackdropTexture();
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(8.5, 4.2),
    new THREE.MeshBasicMaterial({ map: backdropTex })
  );
  backdrop.position.set(0, 1.05, -2.55);
  scene.add(backdrop);

  // Subtle side aisle partition pillars for cozy framing depth
  const wallMat = new THREE.MeshStandardMaterial({ color: '#d8cfc2', roughness: 0.85 });
  const floorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(8.5, 4.0),
    new THREE.MeshStandardMaterial({ color: '#c4b8a6', roughness: 0.45, metalness: 0.05 })
  );
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.set(0, -0.92, -0.8);
  scene.add(floorPlane);

  // --- Runtime Controller State ---
  const state = {
    beltOffset: 0,
    beltSpeed: 0,
    beltBtnPress: 0,
    scanFlashTimer: 0,
    scannerActiveHover: false,
    weightDisplay: 0,
    targetWeight: 0,
    drawerOpen: false,
    drawerSlide: 0, // 0 closed, 1 open
    receiptLength: 0.08,
    targetReceiptLength: 0.08,
    receiptTorn: false,
    gunActive: 0,
    trayCoins: [],
  };

  function spawnTrayCoins(count = 5) {
    const mats = [goldCoinMat, silverCoinMat, goldCoinMat, copperCoinMat];
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.017, 0.017, 0.0038, 18),
        mats[i % mats.length]
      );
      const tx = (Math.random() - 0.5) * 0.12;
      const tz = (Math.random() - 0.5) * 0.065;
      const ty = 0.004 + state.trayCoins.length * 0.0022;
      coin.position.set(tx, 0.14 + i * 0.04, tz - 0.06);
      coin.castShadow = true;
      trayCoinsGroup.add(coin);
      state.trayCoins.push({
        mesh: coin,
        target: new THREE.Vector3(tx, ty, tz),
        vy: 0,
        landed: false,
        sweeping: false,
      });
    }
  }

  function sweepTrayCoins() {
    if (state.trayCoins.length === 0) return false;
    state.trayCoins.forEach((c) => {
      c.sweeping = true;
    });
    return true;
  }

  function clearTrayCoins() {
    state.trayCoins.forEach((c) => trayCoinsGroup.remove(c.mesh));
    state.trayCoins.length = 0;
  }

  function triggerScanFlash() {
    state.scanFlashTimer = 0.42;
  }

  function feedReceipt(step = 0.24) {
    state.receiptTorn = false;
    state.targetReceiptLength = Math.min(1.25, state.targetReceiptLength + step);
  }

  function resetReceipt() {
    state.receiptTorn = false;
    state.targetReceiptLength = 0.08;
  }

  function tearReceipt() {
    if (state.targetReceiptLength < 0.22 || state.receiptTorn) return false;
    state.receiptTorn = true;
    state.targetReceiptLength = 0.06;
    return true;
  }

  function setDrawerOpen(open) {
    state.drawerOpen = open;
  }

  function setScaleWeight(w) {
    state.targetWeight = Math.min(1.6, Math.max(0, w));
  }

  function update(dt, now) {
    // Scroll conveyor belt rubber texture
    if (Math.abs(state.beltSpeed) > 0.001) {
      state.beltOffset -= state.beltSpeed * dt * 1.45;
      beltTex.map.offset.x = state.beltOffset;
      beltTex.bumpMap.offset.x = state.beltOffset;
      beltTex.roughnessMap.offset.x = state.beltOffset;
    }

    // Belt button press depression
    if (state.beltBtnPress > 0) {
      state.beltBtnPress = Math.max(0, state.beltBtnPress - dt * 5);
    }
    beltBtnCap.position.y = 0.024 - state.beltBtnPress * 0.008;
    beltBtnMat.emissiveIntensity = 0.32 + state.beltBtnPress * 0.8 + Math.sin(now * 2.5) * 0.08;

    // Scanner laser color & emerald scan flash!
    if (state.scanFlashTimer > 0) {
      state.scanFlashTimer = Math.max(0, state.scanFlashTimer - dt);
      const f = Math.min(1, state.scanFlashTimer * 3.5);
      laserLineMat.color.setHex(0x18ff7a);
      laserLineMat.opacity = 0.95;
      laserFanMat.color.setHex(0x18ff7a);
      laserFanMat.opacity = 0.34 * f;
      scannerLight.color.setHex(0x18ff7a);
      scannerLight.intensity = 1.9 * f + 0.5;
      ledMat.color.setHex(0x1eff7c);
      ledMat.emissive.setHex(0x1eff7c);
      ledMat.emissiveIntensity = 2.5;
    } else {
      const pulse = 0.72 + Math.sin(now * 5.0) * 0.18;
      laserLineMat.color.setHex(0xff2034);
      laserLineMat.opacity = state.scannerActiveHover ? 0.98 : 0.78 * pulse;
      laserFanMat.color.setHex(0xff1c32);
      laserFanMat.opacity = state.scannerActiveHover ? 0.28 : 0.11 * pulse;
      scannerLight.color.setHex(0xff1e30);
      scannerLight.intensity = state.scannerActiveHover ? 1.45 : 0.72 * pulse;
      ledMat.color.setHex(0xff2636);
      ledMat.emissive.setHex(0xff1a2a);
      ledMat.emissiveIntensity = 1.1 + Math.sin(now * 3.2) * 0.3;
    }

    // Smooth weight-scale LED bar (subtle learning seed: heavier items light more bars!)
    state.weightDisplay = THREE.MathUtils.lerp(state.weightDisplay, state.targetWeight, Math.min(1, dt * 10));
    const litCount = Math.round(state.weightDisplay * 6.5);
    for (let i = 0; i < weightLeds.length; i++) {
      const active = i < litCount;
      const mat = weightLeds[i];
      if (active) {
        const col = i < 3 ? 0x35e67d : i < 6 ? 0xffc42e : 0xff6230;
        mat.emissive.setHex(col);
        mat.color.setHex(col);
        mat.emissiveIntensity = 1.6;
      } else {
        mat.emissiveIntensity = 0.0;
        mat.color.setHex(0x23272c);
      }
    }

    // Cash drawer smooth slide
    const targetSlide = state.drawerOpen ? 1 : 0;
    state.drawerSlide = THREE.MathUtils.lerp(state.drawerSlide, targetSlide, Math.min(1, dt * 11));
    cashDrawer.position.z = state.drawerSlide * 0.145;

    // Receipt strip feed animation
    state.receiptLength = THREE.MathUtils.lerp(state.receiptLength, state.targetReceiptLength, Math.min(1, dt * 9));
    receiptMesh.scale.y = Math.max(0.04, state.receiptLength);
    receiptMesh.visible = state.receiptLength > 0.05;

    // Gentle curl shimmer on sticker tab
    stickerTab.rotation.x = -0.52 + Math.sin(now * 2.8) * 0.06;

    // Handheld laser gun beam fade
    if (state.gunActive > 0) {
      state.gunActive = Math.max(0, state.gunActive - dt * 2.4);
      gunBeamMat.opacity = Math.min(0.65, state.gunActive * 0.8);
    } else {
      gunBeamMat.opacity = 0;
    }

    // Coin physics in blue coin tray
    for (let i = state.trayCoins.length - 1; i >= 0; i--) {
      const c = state.trayCoins[i];
      if (c.sweeping) {
        // Arc coins neatly toward the register cash drawer!
        c.mesh.position.x = THREE.MathUtils.lerp(c.mesh.position.x, 0.65, Math.min(1, dt * 9));
        c.mesh.position.y = THREE.MathUtils.lerp(c.mesh.position.y, 0.12, Math.min(1, dt * 7));
        c.mesh.position.z = THREE.MathUtils.lerp(c.mesh.position.z, -0.05, Math.min(1, dt * 9));
        c.mesh.scale.multiplyScalar(Math.max(0.1, 1 - dt * 6));
        if (c.mesh.position.x > 0.50) {
          trayCoinsGroup.remove(c.mesh);
          state.trayCoins.splice(i, 1);
        }
      } else if (!c.landed) {
        c.vy -= dt * 3.8;
        c.mesh.position.y += c.vy * dt;
        c.mesh.position.z = THREE.MathUtils.lerp(c.mesh.position.z, c.target.z, Math.min(1, dt * 8));
        if (c.mesh.position.y <= c.target.y) {
          c.mesh.position.y = c.target.y;
          if (Math.abs(c.vy) > 0.35) {
            c.vy = -c.vy * 0.32;
          } else {
            c.landed = true;
          }
        }
      }
    }
  }

  return {
    group,
    state,
    beltBtnGroup,
    scannerGroup,
    gunGroup,
    gunDockGroup,
    stickerGroup,
    receiptPivot,
    registerGroup,
    cashDrawer,
    coinTrayGroup,
    updateLCD,
    triggerScanFlash,
    feedReceipt,
    resetReceipt,
    tearReceipt,
    setDrawerOpen,
    setScaleWeight,
    spawnTrayCoins,
    sweepTrayCoins,
    clearTrayCoins,
    update,
    hitMeshes: [beltBtnHit, coinTrayHit, stickerHit, gunHit, drawerHit, receiptHit],
  };
}
