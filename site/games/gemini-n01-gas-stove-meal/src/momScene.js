import * as THREE from 'three';
import {
  createQuiltTextures,
  createTatamiTextures,
  createWoodTextures,
  createHanamaruCardTexture,
} from './textures.js';

function tagInteractive(obj, id) {
  obj.userData.interactive = id;
  obj.traverse((c) => {
    c.userData.interactive = id;
  });
}

function enableShadows(obj) {
  obj.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

export function buildMomScene(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const quiltTex = createQuiltTextures({ base: '#9cb59c', stitch: '#7b967c', stripe: '#b9ccb6' });
  const pillowTex = createQuiltTextures({ base: '#f7f0e4', stitch: '#d6c9b4', stripe: '#ece2d0' });
  const tatamiTex = createTatamiTextures();
  const oakTex = createWoodTextures({ base: '#b8834d', dark: '#7c4e24', light: '#d4a672', seed: 91 });

  const oakMat = new THREE.MeshStandardMaterial({
    map: oakTex.map,
    bumpMap: oakTex.bumpMap,
    bumpScale: 0.004,
    roughness: 0.45,
  });

  // Tatami floor in Mom's cozy alcove behind the kitchen counter
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.1, 2.3),
    new THREE.MeshStandardMaterial({
      map: tatamiTex.map,
      bumpMap: tatamiTex.bumpMap,
      bumpScale: 0.005,
      roughness: 0.78,
    })
  );
  floor.position.set(0, -0.18, -1.82);
  floor.receiveShadow = true;
  root.add(floor);

  // Warm sunlit plaster back wall & side walls
  const plasterMat = new THREE.MeshStandardMaterial({
    color: 0xf4eadc,
    roughness: 0.88,
  });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 0.12), plasterMat);
  backWall.position.set(0, 0.95, -2.75);
  backWall.receiveShadow = true;
  root.add(backWall);

  // Warm sunlit shoji window on the left alcove wall (real glowing daylight source!)
  const shojiGroup = new THREE.Group();
  shojiGroup.position.set(-1.35, 0.92, -1.85);
  shojiGroup.rotation.y = Math.PI / 2;
  root.add(shojiGroup);

  const shojiPaper = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({ color: 0xfff6e0 })
  );
  shojiGroup.add(shojiPaper);

  // Wooden lattice muntins on the shoji screen
  for (let i = -2; i <= 2; i++) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.024, 0.024), oakMat);
    hBar.position.y = i * 0.31;
    shojiGroup.add(hBar);
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.024, 1.32, 0.024), oakMat);
    vBar.position.x = i * 0.31;
    shojiGroup.add(vBar);
  }

  // Cozy Bed / Futon Mattress + Plump Pillow + Quilted Blanket
  const futonGroup = new THREE.Group();
  futonGroup.position.set(0, -0.13, -1.82);
  root.add(futonGroup);

  const mattress = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.16, 1.35),
    new THREE.MeshStandardMaterial({
      map: pillowTex.map,
      bumpMap: pillowTex.bumpMap,
      bumpScale: 0.004,
      roughness: 0.86,
    })
  );
  mattress.position.set(0, 0.08, -0.05);
  futonGroup.add(mattress);

  // Backrest bolster pillow so Mom is propped comfortably in view through the pass-through
  const pillow = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 24, 18),
    new THREE.MeshStandardMaterial({
      map: pillowTex.map,
      bumpMap: pillowTex.bumpMap,
      bumpScale: 0.006,
      roughness: 0.88,
    })
  );
  pillow.scale.set(1.45, 0.72, 0.72);
  pillow.position.set(0, 0.34, -0.44);
  futonGroup.add(pillow);

  // Quilted draped blanket covering Mom's lower torso (cleanly tucked under bedside tray table!)
  const quilt = new THREE.Mesh(
    new THREE.SphereGeometry(0.54, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.54),
    new THREE.MeshStandardMaterial({
      map: quiltTex.map,
      bumpMap: quiltTex.bumpMap,
      bumpScale: 0.014,
      roughness: 0.85,
    })
  );
  quilt.scale.set(1.06, 0.42, 0.96);
  quilt.position.set(0, 0.14, -0.04);
  futonGroup.add(quilt);
  enableShadows(futonGroup);

  // =========================================================================
  // LOVABLE HANDCRAFTED-MINIATURE PHOTOREALISTIC 3D MOM CHARACTER
  // =========================================================================
  const momGroup = new THREE.Group();
  momGroup.position.set(0, 0.34, -1.86);
  root.add(momGroup);

  // Warm soft matte-porcelain skin (warm peach, subtle sheen — cozy, never uncanny)
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf4ccb0,
    roughness: 0.62,
    metalness: 0.0,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x3a281e,
    roughness: 0.48,
    metalness: 0.05,
  });
  const cardiganMat = new THREE.MeshStandardMaterial({
    color: 0xb85f52,
    roughness: 0.88,
    bumpMap: quiltTex.bumpMap,
    bumpScale: 0.01,
  });
  const blushMat = new THREE.MeshBasicMaterial({
    color: 0xff6e78,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  // Upper body / shoulders pivot (leans back when resting, sits up brightly when recovered!)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, -0.05, 0);
  momGroup.add(torsoPivot);

  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), cardiganMat);
  shoulders.scale.set(1.22, 0.92, 0.82);
  shoulders.position.set(0, 0.02, 0.02);
  torsoPivot.add(shoulders);

  // Cream inner turtleneck collar
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.098, 0.08, 20),
    new THREE.MeshStandardMaterial({ color: 0xf6ebd9, roughness: 0.88 })
  );
  collar.position.set(0, 0.18, 0.03);
  torsoPivot.add(collar);

  // Cozy knit sleeves resting naturally inward on top of the quilt (raise cheerfully when recovered!)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.22, 0.05, 0.05);
  torsoPivot.add(leftArmPivot);
  const leftSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.15, 8, 14), cardiganMat);
  leftSleeve.rotation.z = -0.58;
  leftSleeve.rotation.x = 0.28;
  leftSleeve.position.set(0.05, -0.07, 0.06);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), skinMat);
  leftHand.position.set(0.11, -0.13, 0.10);
  leftArmPivot.add(leftSleeve, leftHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.22, 0.05, 0.05);
  torsoPivot.add(rightArmPivot);
  const rightSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.15, 8, 14), cardiganMat);
  rightSleeve.rotation.z = 0.58;
  rightSleeve.rotation.x = 0.28;
  rightSleeve.position.set(-0.05, -0.07, 0.06);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), skinMat);
  rightHand.position.set(-0.11, -0.13, 0.10);
  rightArmPivot.add(rightSleeve, rightHand);

  // Head pivot
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.28, 0.04);
  torsoPivot.add(headPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 28, 22), skinMat);
  head.scale.set(0.98, 1.02, 0.94);
  headPivot.add(head);

  // Soft sculpted bob hairstyle — tilted BACK off the forehead so face & cooling pad are 100% clear!
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.182, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hairMat
  );
  hairCap.position.set(0, 0.022, -0.024);
  hairCap.rotation.x = -0.55; // Tilt backward toward -Z so forehead & eyes are completely unobstructed!
  headPivot.add(hairCap);

  // Gentle side-parted framing hair locks on upper temples
  [-1, 1].forEach((s) => {
    const temple = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 12), hairMat);
    temple.scale.set(1.1, 0.65, 0.8);
    temple.position.set(s * 0.095, 0.125, 0.075);
    temple.rotation.z = -s * 0.38;
    headPivot.add(temple);

    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.082, 18, 14), hairMat);
    bob.scale.set(0.72, 1.52, 1.02);
    bob.position.set(s * 0.15, -0.03, -0.025);
    headPivot.add(bob);
  });

  // Back hair cushion
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.168, 22, 16), hairMat);
  backHair.scale.set(1.06, 1.08, 0.82);
  backHair.position.set(0, -0.035, -0.08);
  headPivot.add(backHair);

  // Warm gold-amber hair clip on right temple
  const hairClip = new THREE.Mesh(
    new THREE.BoxGeometry(0.048, 0.015, 0.014),
    new THREE.MeshStandardMaterial({ color: 0xf0b23a, roughness: 0.25, metalness: 0.35 })
  );
  hairClip.position.set(0.125, 0.095, 0.105);
  hairClip.rotation.z = -0.4;
  hairClip.rotation.y = 0.55;
  headPivot.add(hairClip);

  // Cute tiny nose button
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.015, 14, 12), skinMat);
  nose.position.set(0, -0.014, 0.162);
  headPivot.add(nose);

  // Rosy cheek blushes (bloom warmly as Mom recovers!)
  const cheeks = [];
  [-1, 1].forEach((s) => {
    const ch = new THREE.Mesh(new THREE.CircleGeometry(0.034, 18), blushMat);
    ch.position.set(s * 0.078, -0.034, 0.146);
    ch.rotation.y = s * 0.42;
    headPivot.add(ch);
    cheeks.push(ch);
  });

  // Sleepy downward-curved closed eyes (clearly visible!)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x352217, roughness: 0.38 });
  const sleepyEyesGroup = new THREE.Group();
  [-1, 1].forEach((s) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.024, 0.0055, 8, 16, Math.PI),
      eyeMat
    );
    arc.position.set(s * 0.056, 0.016, 0.154);
    arc.rotation.z = Math.PI;
    arc.rotation.y = s * 0.22;
    sleepyEyesGroup.add(arc);
  });
  headPivot.add(sleepyEyesGroup);

  // Happy upward-curved smiling crescent eyes (shown when eating & recovered!)
  const happyEyesGroup = new THREE.Group();
  happyEyesGroup.visible = false;
  [-1, 1].forEach((s) => {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.006, 8, 16, Math.PI),
      eyeMat
    );
    arc.position.set(s * 0.056, 0.008, 0.155);
    arc.rotation.y = s * 0.22;
    happyEyesGroup.add(arc);
  });
  headPivot.add(happyEyesGroup);

  // Soft mouth (gentle tiny resting line → warm happy smile arc!)
  const sleepyMouth = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.0045, 0.022, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0xb85e58, roughness: 0.48 })
  );
  sleepyMouth.rotation.z = Math.PI / 2;
  sleepyMouth.position.set(0, -0.068, 0.152);
  headPivot.add(sleepyMouth);

  const happyMouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.026, 0.006, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xd45b58, roughness: 0.4 })
  );
  happyMouth.rotation.z = Math.PI;
  happyMouth.position.set(0, -0.054, 0.152);
  happyMouth.visible = false;
  headPivot.add(happyMouth);

  // Crisp Cool Blue Forehead Gel Pack (冷えピタ!) — clean, curved slightly, sitting proudly on forehead!
  const coolingPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.112, 0.044, 0.012),
    new THREE.MeshPhysicalMaterial({
      color: 0x6ec6ff,
      roughness: 0.15,
      transparent: true,
      opacity: 0.94,
      clearcoat: 1.0,
    })
  );
  coolingPad.position.set(0, 0.068, 0.156);
  coolingPad.rotation.x = -0.32;
  headPivot.add(coolingPad);

  const momHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  momHit.position.set(0, 0.18, 0.04);
  torsoPivot.add(momHit);

  enableShadows(momGroup);
  tagInteractive(momGroup, 'mom');

  // =========================================================================
  // LOW OAK BEDSIDE TRAY TABLE + HANAMARU CARD & WOODEN RED CRAYON
  // =========================================================================
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, -0.13, -1.18);
  root.add(tableGroup);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.026, 0.44), oakMat);
  tableTop.position.y = 0.34;
  tableGroup.add(tableTop);

  [
    [-0.33, 0.17, -0.17],
    [0.33, 0.17, -0.17],
    [-0.33, 0.17, 0.17],
    [0.33, 0.17, 0.17],
  ].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.34, 12), oakMat);
    leg.position.set(lx, ly, lz);
    tableGroup.add(leg);
  });
  enableShadows(tableGroup);

  // Target world position where the serving tray lands on Mom's bedside table!
  const trayTargetPos = new THREE.Vector3(0.0, 0.223, -1.18);

  // Hanamaru Thick Cardstock Canvas (pops upright gently in front of Mom to draw the big red Hanamaru!)
  const hanamaruDyn = createHanamaruCardTexture();
  const hanamaruCardGroup = new THREE.Group();
  const cardRestPos = new THREE.Vector3(0.34, 0.17, -1.16);
  const cardShowPos = new THREE.Vector3(0.0, 0.44, -1.12);
  hanamaruCardGroup.position.copy(cardRestPos);
  hanamaruCardGroup.scale.setScalar(0.001);
  hanamaruCardGroup.visible = false;
  root.add(hanamaruCardGroup);

  const cardGeo = new THREE.BoxGeometry(0.36, 0.36, 0.012);
  const cardBackMat = new THREE.MeshStandardMaterial({ color: 0xf7efe0, roughness: 0.78 });
  const cardFrontMat = new THREE.MeshStandardMaterial({
    map: hanamaruDyn.texture,
    roughness: 0.65,
  });
  const cardMesh = new THREE.Mesh(cardGeo, [
    cardBackMat, cardBackMat, cardBackMat, cardBackMat, cardFrontMat, cardBackMat,
  ]);
  hanamaruCardGroup.add(cardMesh);
  enableShadows(hanamaruCardGroup);
  tagInteractive(hanamaruCardGroup, 'hanamaru_card');

  // Chunky Red Wooden Crayon that physically traces the Hanamaru live!
  const crayonGroup = new THREE.Group();
  const crayonBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.13, 14),
    new THREE.MeshStandardMaterial({ color: 0xe0312b, roughness: 0.42 })
  );
  crayonBody.position.y = 0.085;
  const crayonWrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0138, 0.0138, 0.065, 14),
    new THREE.MeshStandardMaterial({ color: 0xf7efe2, roughness: 0.72 })
  );
  crayonWrap.position.y = 0.085;
  const crayonTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.013, 0.032, 14),
    new THREE.MeshStandardMaterial({ color: 0xd92520, roughness: 0.35 })
  );
  crayonTip.rotation.x = Math.PI;
  crayonTip.position.y = 0.006;
  crayonGroup.add(crayonBody, crayonWrap, crayonTip);
  crayonGroup.rotation.z = -0.38;
  crayonGroup.rotation.x = 0.35;
  crayonGroup.visible = false;
  hanamaruCardGroup.add(crayonGroup);

  return {
    root,
    momGroup,
    torsoPivot,
    headPivot,
    leftArmPivot,
    rightArmPivot,
    sleepyEyesGroup,
    happyEyesGroup,
    sleepyMouth,
    happyMouth,
    coolingPad,
    blushMat,
    tableGroup,
    trayTargetPos,
    hanamaruDyn,
    hanamaruCardGroup,
    cardMesh,
    cardRestPos,
    cardShowPos,
    crayonGroup,
  };
}
