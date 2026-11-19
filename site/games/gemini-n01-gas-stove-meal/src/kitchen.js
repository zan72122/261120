import * as THREE from 'three';
import {
  createWoodTextures,
  createBrushedMetalTextures,
  createCastIronTextures,
  createCeramicTextures,
  createCounterStoneTextures,
  createSubwayTileTextures,
  createCarrotSliceTexture,
  createSpongeTextures,
  createEggWhiteDynamicTexture,
  createDishSmudgeTexture,
} from './textures.js';

function tagInteractive(obj, id) {
  obj.userData.interactive = id;
  obj.traverse((child) => {
    child.userData.interactive = id;
  });
}

function enableShadows(obj, cast = true, receive = true) {
  obj.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = cast;
      c.receiveShadow = receive;
    }
  });
}

export function buildKitchen(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // Shared photorealistic textures & materials
  const oakTex = createWoodTextures({ base: '#c99762', dark: '#915f30', light: '#e2b886', seed: 11 });
  const walnutTex = createWoodTextures({ base: '#8c5d36', dark: '#5a3619', light: '#ae7c50', seed: 22 });
  const steelTex = createBrushedMetalTextures({ base: '#d5dade', seed: 33 });
  const ironTex = createCastIronTextures({ seed: 44 });
  const ceramicCream = createCeramicTextures({ base: '#f7f1e7', speckle: '#8b735c', rimTint: '#c9a681', seed: 55 });
  const ceramicSage = createCeramicTextures({ base: '#eff3ee', speckle: '#7b8b79', rimTint: null, seed: 66 });
  const stoneTex = createCounterStoneTextures({ seed: 77 });
  const tileTex = createSubwayTileTextures({ repeatX: 3.5, repeatY: 2.2 });
  const carrotSliceTex = createCarrotSliceTexture();
  const spongeTex = createSpongeTextures();

  const mats = {
    oak: new THREE.MeshStandardMaterial({
      map: oakTex.map,
      bumpMap: oakTex.bumpMap,
      bumpScale: 0.004,
      roughness: 0.46,
      metalness: 0.02,
    }),
    walnut: new THREE.MeshStandardMaterial({
      map: walnutTex.map,
      bumpMap: walnutTex.bumpMap,
      bumpScale: 0.004,
      roughness: 0.42,
      metalness: 0.04,
    }),
    steel: new THREE.MeshStandardMaterial({
      map: steelTex.map,
      roughnessMap: steelTex.roughnessMap,
      bumpMap: steelTex.bumpMap,
      bumpScale: 0.0015,
      roughness: 0.28,
      metalness: 0.88,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xeaf0f5,
      roughness: 0.1,
      metalness: 0.96,
    }),
    iron: new THREE.MeshStandardMaterial({
      map: ironTex.map,
      bumpMap: ironTex.bumpMap,
      bumpScale: 0.006,
      roughness: 0.72,
      metalness: 0.48,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xc29c59,
      roughness: 0.34,
      metalness: 0.82,
    }),
    ceramicCream: new THREE.MeshPhysicalMaterial({
      map: ceramicCream.map,
      bumpMap: ceramicCream.bumpMap,
      bumpScale: 0.002,
      roughness: 0.2,
      metalness: 0.02,
      clearcoat: 0.75,
      clearcoatRoughness: 0.14,
    }),
    ceramicSage: new THREE.MeshPhysicalMaterial({
      map: ceramicSage.map,
      bumpMap: ceramicSage.bumpMap,
      bumpScale: 0.002,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.75,
      clearcoatRoughness: 0.16,
    }),
    enamelPot: new THREE.MeshPhysicalMaterial({
      color: 0xf6efe1,
      roughness: 0.14,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    }),
    enamelRim: new THREE.MeshStandardMaterial({
      color: 0xc95238,
      roughness: 0.28,
      metalness: 0.15,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xf4fbff,
      roughness: 0.05,
      metalness: 0.0,
      transmission: 0.88,
      transparent: true,
      opacity: 0.48,
      ior: 1.48,
      thickness: 0.02,
      clearcoat: 1.0,
    }),
    carrotOuter: new THREE.MeshStandardMaterial({
      color: 0xe6651c,
      roughness: 0.52,
      metalness: 0.0,
    }),
    carrotCut: new THREE.MeshStandardMaterial({
      map: carrotSliceTex,
      roughness: 0.32,
      metalness: 0.0,
    }),
    broccoli: new THREE.MeshStandardMaterial({
      color: 0x3b8432,
      roughness: 0.68,
      metalness: 0.0,
    }),
    broccoliStem: new THREE.MeshStandardMaterial({
      color: 0x7cb05b,
      roughness: 0.56,
    }),
    eggShell: new THREE.MeshStandardMaterial({
      color: 0xd9a882,
      roughness: 0.52,
      metalness: 0.0,
    }),
    yolk: new THREE.MeshPhysicalMaterial({
      color: 0xff8c04,
      emissive: 0x4a1800,
      emissiveIntensity: 0.16,
      roughness: 0.06,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    }),
  };

  // =========================================================================
  // 1. COUNTERTOP & BACKSPLASH WITH SUNLIT PASS-THROUGH WINDOW TO MOM'S ROOM
  // =========================================================================
  const counterMat = new THREE.MeshStandardMaterial({
    map: stoneTex.map,
    bumpMap: stoneTex.bumpMap,
    bumpScale: 0.002,
    roughness: 0.28,
    metalness: 0.04,
  });

  // Left + Center counter slab (up to sink edge at x = 1.40)
  const counterLeft = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.08, 1.24), counterMat);
  counterLeft.position.set(-0.375, -0.04, 0.0);
  counterLeft.receiveShadow = true;
  root.add(counterLeft);

  // Counter front & back strips around recessed sink (x: 1.40 .. 2.12)
  const counterSinkBack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.36), counterMat);
  counterSinkBack.position.set(1.76, -0.04, -0.44);
  counterSinkBack.receiveShadow = true;
  root.add(counterSinkBack);

  const counterSinkFront = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.34), counterMat);
  counterSinkFront.position.set(1.76, -0.04, 0.45);
  counterSinkFront.receiveShadow = true;
  root.add(counterSinkFront);

  // Far-right counter slab (dish rack area, x: 2.12 .. 3.15)
  const counterRight = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.08, 1.24), counterMat);
  counterRight.position.set(2.65, -0.04, 0.0);
  counterRight.receiveShadow = true;
  root.add(counterRight);

  // Lower warm wood cabinet apron cleanly BELOW the recessed sink basin (top at y = -0.22)
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.9, 1.14), mats.oak);
  cabinet.position.set(0.45, -0.67, -0.02);
  root.add(cabinet);

  // Front cabinet fascia strip up to countertop underside (only on front edge z = +0.52 so sink recess stays 100% open!)
  const cabinetFrontFascia = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.22, 0.08), mats.oak);
  cabinetFrontFascia.position.set(0.45, -0.19, 0.54);
  root.add(cabinetFrontFascia);

  // Tiled backsplash walls flanking the pass-through opening (opening x: -0.68 .. +0.68, y: 0.14 .. 1.32)
  const tileMat = new THREE.MeshPhysicalMaterial({
    map: tileTex.map,
    bumpMap: tileTex.bumpMap,
    bumpScale: 0.006,
    roughness: 0.24,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.5, 0.12), tileMat);
  wallLeft.position.set(-1.53, 1.24, -0.64);
  wallLeft.receiveShadow = true;
  root.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.5, 0.12), tileMat);
  wallRight.position.set(1.98, 1.24, -0.64);
  wallRight.receiveShadow = true;
  root.add(wallRight);

  const tileTopTex = createSubwayTileTextures({ repeatX: 2.9, repeatY: 1.15 });
  const tileTopMat = new THREE.MeshPhysicalMaterial({
    map: tileTopTex.map,
    bumpMap: tileTopTex.bumpMap,
    bumpScale: 0.006,
    roughness: 0.24,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });
  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(1.42, 1.18, 0.12), tileTopMat);
  wallTop.position.set(0.0, 1.90, -0.64);
  root.add(wallTop);

  // Warm oak pass-through frame & windowsill (holds earned Hanamaru cards!)
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.045, 0.22), mats.oak);
  sill.position.set(0.0, 0.12, -0.62);
  enableShadows(sill);
  root.add(sill);

  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.05, 0.18), mats.oak);
  frameTop.position.set(0.0, 1.31, -0.64);
  root.add(frameTop);

  [-0.70, 0.70].forEach((fx) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.24, 0.18), mats.oak);
    post.position.set(fx, 0.71, -0.64);
    enableShadows(post);
    root.add(post);
  });

  // Wall shelf on right backsplash with cozy ceramic canisters
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.032, 0.16), mats.oak);
  shelf.position.set(1.32, 0.68, -0.52);
  enableShadows(shelf);
  root.add(shelf);

  // Small decorative ceramic jars on the shelf (gently clink if poked!)
  const shelfJars = [];
  [
    { x: 1.02, r: 0.045, h: 0.11, mat: mats.ceramicCream },
    { x: 1.15, r: 0.038, h: 0.09, mat: mats.ceramicSage },
    { x: 1.56, r: 0.042, h: 0.12, mat: mats.ceramicCream },
  ].forEach((j, idx) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(j.r, j.r * 1.04, j.h, 20), j.mat);
    body.position.y = j.h * 0.5;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(j.r * 0.94, j.r * 0.94, 0.022, 20), mats.oak);
    lid.position.y = j.h + 0.011;
    grp.add(body, lid);
    grp.position.set(j.x, 0.696, -0.52);
    enableShadows(grp);
    tagInteractive(grp, `prop_jar_${idx}`);
    root.add(grp);
    shelfJars.push(grp);
  });

  // =========================================================================
  // 2. HERO 2-BURNER JAPANESE GAS STOVE (ガスコンロ)
  // =========================================================================
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(0.0, 0.0, -0.02);
  root.add(stoveGroup);

  // Brushed stainless steel stove body
  const stoveBody = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.095, 0.52), mats.steel);
  stoveBody.position.set(0, 0.048, -0.02);
  enableShadows(stoveBody);
  stoveGroup.add(stoveBody);

  // Front angled control panel (tilted toward user for clear visibility & easy knob turning)
  const frontBevel = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.095, 0.09), mats.steel);
  frontBevel.position.set(0, 0.046, 0.255);
  frontBevel.rotation.x = -0.45;
  enableShadows(frontBevel);
  stoveGroup.add(frontBevel);

  // Recessed stove dark trim strip on top
  const stoveTopPlate = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.008, 0.48), mats.steel);
  stoveTopPlate.position.set(0, 0.098, -0.02);
  stoveTopPlate.receiveShadow = true;
  stoveGroup.add(stoveTopPlate);

  // Helper to build each gas burner + trivet + multi-jet blue flame crown + rotary knob
  const burners = {};
  const knobMeshes = {};

  function buildBurnerAndKnob(side, bx) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0.102, -0.03);
    stoveGroup.add(bGroup);

    // Recessed dark enamel burner bowl
    const dripBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.095, 0.012, 32),
      mats.iron
    );
    dripBowl.position.y = 0.002;
    bGroup.add(dripBowl);

    // Brass burner head with serrated gas ports
    const brassCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.064, 0.022, 24),
      mats.brass
    );
    brassCap.position.y = 0.015;
    bGroup.add(brassCap);

    const capTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.056, 0.058, 0.006, 24),
      mats.iron
    );
    capTop.position.y = 0.028;
    bGroup.add(capTop);

    // Cast-iron 5-prong trivet (五徳)
    const trivetRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.0085, 10, 32),
      mats.iron
    );
    trivetRing.rotation.x = Math.PI / 2;
    trivetRing.position.y = 0.024;
    bGroup.add(trivetRing);

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.026, 0.072), mats.iron);
      prong.position.set(Math.cos(a) * 0.088, 0.028, Math.sin(a) * 0.088);
      prong.rotation.y = -a + Math.PI / 2;
      bGroup.add(prong);
    }
    enableShadows(bGroup);

    // Multi-jet realistic blue/cyan/orange gas flame crown
    const flameGroup = new THREE.Group();
    flameGroup.position.y = 0.024;
    flameGroup.visible = false;
    bGroup.add(flameGroup);

    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0x1e88ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0x9cf2ff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameTipMat = new THREE.MeshBasicMaterial({
      color: 0xff8a24,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const jetGeo = new THREE.ConeGeometry(0.011, 0.044, 8);
    jetGeo.translate(0, 0.022, 0);
    const coreGeo = new THREE.ConeGeometry(0.0065, 0.028, 8);
    coreGeo.translate(0, 0.014, 0);
    const tipGeo = new THREE.ConeGeometry(0.007, 0.024, 6);
    tipGeo.translate(0, 0.036, 0);

    const jets = [];
    const numJets = 16;
    for (let i = 0; i < numJets; i++) {
      const a = (i / numJets) * Math.PI * 2;
      const jHolder = new THREE.Group();
      jHolder.position.set(Math.cos(a) * 0.076, 0, Math.sin(a) * 0.076);
      jHolder.rotation.y = -a;
      jHolder.rotation.z = -0.62; // Splay outward naturally hugging the pot/pan base!

      const outer = new THREE.Mesh(jetGeo, flameOuterMat);
      const core = new THREE.Mesh(coreGeo, flameCoreMat);
      const tip = new THREE.Mesh(tipGeo, flameTipMat);
      jHolder.add(outer, core, tip);
      flameGroup.add(jHolder);
      jets.push({ holder: jHolder, phase: i * 1.17 });
    }

    // Soft additive blue glow halo right beneath pot/pan on the brushed steel top
    const glowRing = new THREE.Mesh(
      new THREE.RingGeometry(0.048, 0.125, 24),
      new THREE.MeshBasicMaterial({
        color: 0x2694ff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glowRing.rotation.x = -Math.PI / 2;
    glowRing.position.y = 0.008;
    flameGroup.add(glowRing);

    // Subtle localized point light just outside the front rim of the burner (illuminates steel deck without bleeding into pan interior!)
    const flameLight = new THREE.PointLight(0x3ba0ff, 0, 0.28, 2.2);
    flameLight.position.set(0, 0.016, 0.13);
    bGroup.add(flameLight);

    // Tactile Rotary Knob (つまみ) mounted on the front bevel
    const knobMount = new THREE.Group();
    knobMount.position.set(bx, 0.062, 0.285);
    knobMount.rotation.x = -0.45;
    stoveGroup.add(knobMount);

    // Sculpted chrome bezel collar
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.056, 0.012, 32),
      mats.chrome
    );
    bezel.rotation.x = Math.PI / 2;
    knobMount.add(bezel);

    // Purely visual flame-size pips neatly seated around dial (ZERO text!)
    const pipDefs = [
      { angle: 0, r: 0.0045, color: 0x5c646d },
      { angle: 1.05, r: 0.005, color: 0x3b9eff },
      { angle: 2.05, r: 0.0065, color: 0x1e7dff },
      { angle: 2.85, r: 0.008, color: 0xff6b2b },
    ];
    pipDefs.forEach((p) => {
      const pip = new THREE.Mesh(
        new THREE.SphereGeometry(p.r, 12, 10),
        new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.3, emissive: p.color, emissiveIntensity: 0.18 })
      );
      pip.position.set(-Math.sin(p.angle) * 0.058, Math.cos(p.angle) * 0.058, 0.003);
      knobMount.add(pip);
    });

    // Rotating knob dial + raised central grip fin
    const knobRotor = new THREE.Group();
    knobRotor.position.z = 0.018;
    knobMount.add(knobRotor);

    const knobBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.048, 0.032, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0xf7f2ea,
        roughness: 0.18,
        metalness: 0.04,
        clearcoat: 0.8,
      })
    );
    knobBody.rotation.x = Math.PI / 2;
    knobRotor.add(knobBody);

    // Brushed metallic center cap
    const knobCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.033, 0.034, 28),
      mats.steel
    );
    knobCap.rotation.x = Math.PI / 2;
    knobRotor.add(knobCap);

    // Ergonomic raised tactile fin bar (clearly shows rotation angle!)
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.076, 0.030),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.16,
        clearcoat: 0.85,
      })
    );
    fin.position.z = 0.014;
    knobRotor.add(fin);

    // Vivid orange-red indicator notch at the top tip of the fin
    const notch = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.018, 0.033),
      new THREE.MeshStandardMaterial({ color: 0xe64a2e, roughness: 0.3 })
    );
    notch.position.set(0, 0.029, 0.015);
    knobRotor.add(notch);

    // Generous invisible touch hitbox sphere for tiny fingers
    const knobHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.088, 12, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    knobHit.position.z = 0.02;
    knobMount.add(knobHit);

    enableShadows(knobRotor);
    tagInteractive(knobMount, `knob_${side}`);

    burners[side] = {
      group: bGroup,
      flameGroup,
      jets,
      flameTipMat,
      flameOuterMat,
      glowRing,
      flameLight,
      knobMount,
      knobRotor,
      worldPos: new THREE.Vector3(bx, 0.13, -0.05),
      knobWorldPos: new THREE.Vector3(bx, 0.062, 0.27),
    };
    knobMeshes[side] = knobRotor;
  }

  buildBurnerAndKnob('left', -0.22);
  buildBurnerAndKnob('right', 0.22);

  // =========================================================================
  // 3. LEFT BURNER: CREAM ENAMEL SOUP POT + DYNAMIC SOUP + FLOATING VEGGIES
  // =========================================================================
  const potGroup = new THREE.Group();
  potGroup.position.set(-0.22, 0.136, -0.05);
  root.add(potGroup);

  // Pot exterior wall (open top hollow cylinder)
  const potOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.132, 0.122, 0.125, 36, 1, true),
    mats.enamelPot
  );
  potOuter.position.y = 0.0625;
  potOuter.material.side = THREE.DoubleSide;
  potGroup.add(potOuter);

  const potBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.122, 0.12, 0.012, 32),
    mats.enamelPot
  );
  potBottom.position.y = 0.006;
  potGroup.add(potBottom);

  const potInnerBottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 32),
    new THREE.MeshStandardMaterial({ color: 0xeae3d6, roughness: 0.3 })
  );
  potInnerBottom.rotation.x = -Math.PI / 2;
  potInnerBottom.position.y = 0.014;
  potGroup.add(potInnerBottom);

  // Terracotta rolled top rim
  const potRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.132, 0.0065, 12, 36),
    mats.enamelRim
  );
  potRim.rotation.x = Math.PI / 2;
  potRim.position.y = 0.125;
  potGroup.add(potRim);

  // Side loop handles
  [-1, 1].forEach((dir) => {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.006, 10, 20, Math.PI),
      mats.enamelRim
    );
    handle.position.set(dir * 0.132, 0.095, 0);
    handle.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    potGroup.add(handle);
  });

  // Dynamic soup liquid disc with vertices for live boil ripples
  const soupGeo = new THREE.CircleGeometry(0.124, 32);
  soupGeo.rotateX(-Math.PI / 2);
  const soupMat = new THREE.MeshPhysicalMaterial({
    color: 0xffe4a0,
    roughness: 0.12,
    metalness: 0.0,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const soupMesh = new THREE.Mesh(soupGeo, soupMat);
  soupMesh.position.y = 0.016;
  soupMesh.visible = false;
  potGroup.add(soupMesh);

  // Boiling froth bubbles on the soup surface
  const soupBubbles = [];
  const boilBubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xfff5d6,
    roughness: 0.1,
    transparent: true,
    opacity: 0.75,
    clearcoat: 1.0,
  });
  for (let i = 0; i < 14; i++) {
    const bm = new THREE.Mesh(new THREE.SphereGeometry(0.008 + (i % 3) * 0.004, 10, 8), boilBubbleMat);
    const a = (i / 14) * Math.PI * 2 + i * 0.4;
    const rad = 0.02 + (i % 5) * 0.02;
    bm.userData.baseA = a;
    bm.userData.baseR = rad;
    bm.userData.phase = i * 0.91;
    bm.visible = false;
    potGroup.add(bm);
    soupBubbles.push(bm);
  }

  // Container for veggies floating inside the pot
  const potVeggiesGroup = new THREE.Group();
  potGroup.add(potVeggiesGroup);

  // Generous pot hitbox
  const potHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.135, 0.15, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  potHit.position.y = 0.075;
  potGroup.add(potHit);

  enableShadows(potGroup);
  tagInteractive(potGroup, 'soup_pot');

  // Wooden Ladle resting neatly beside the soup pot
  const ladleGroup = new THREE.Group();
  const ladleHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.009, 0.25, 12), mats.oak);
  ladleHandle.rotation.z = Math.PI / 2;
  ladleHandle.position.set(-0.08, 0.018, 0);
  const ladleCup = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 18, 12, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52),
    mats.oak
  );
  ladleCup.material.side = THREE.DoubleSide;
  ladleCup.position.set(0.055, 0.024, 0);
  const ladleSoupFill = new THREE.Mesh(
    new THREE.CircleGeometry(0.032, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xf0a63a, roughness: 0.14, clearcoat: 1.0 })
  );
  ladleSoupFill.rotation.x = -Math.PI / 2;
  ladleSoupFill.position.set(0.055, 0.022, 0);
  ladleSoupFill.visible = false;
  ladleGroup.add(ladleHandle, ladleCup, ladleSoupFill);
  const ladleHome = new THREE.Vector3(-0.49, 0.014, -0.24);
  ladleGroup.position.copy(ladleHome);
  ladleGroup.rotation.y = 0.45;
  enableShadows(ladleGroup);
  tagInteractive(ladleGroup, 'ladle');
  root.add(ladleGroup);

  // =========================================================================
  // 4. RIGHT BURNER: CAST-IRON FRYING PAN + DYNAMIC FRIED EGG (目玉焼き)
  // =========================================================================
  const panGroup = new THREE.Group();
  panGroup.position.set(0.22, 0.136, -0.05);
  root.add(panGroup);

  const panBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.126, 0.012, 32), mats.iron);
  panBottom.position.y = 0.006;
  panGroup.add(panBottom);

  const panRimWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.148, 0.132, 0.038, 36, 1, true),
    mats.iron
  );
  panRimWall.material.side = THREE.DoubleSide;
  panRimWall.position.y = 0.025;
  panGroup.add(panRimWall);

  const panTopLip = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.0045, 10, 36), mats.iron);
  panTopLip.rotation.x = Math.PI / 2;
  panTopLip.position.y = 0.044;
  panGroup.add(panTopLip);

  // Frying pan handle angled front-right
  const panHandleHolder = new THREE.Group();
  panHandleHolder.rotation.y = -0.58;
  panGroup.add(panHandleHolder);

  const panNeck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.02), mats.iron);
  panNeck.position.set(0.165, 0.038, 0);
  panNeck.rotation.z = 0.2;
  panHandleHolder.add(panNeck);

  const panWoodHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.016, 0.17, 16), mats.walnut);
  panWoodHandle.rotation.z = Math.PI / 2 - 0.18;
  panWoodHandle.position.set(0.255, 0.056, 0);
  panHandleHolder.add(panWoodHandle);

  // Melting glossy butter pat sheen on pan surface
  const butterPat = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.012, 0.032),
    new THREE.MeshPhysicalMaterial({ color: 0xffe478, roughness: 0.18, clearcoat: 0.7 })
  );
  butterPat.position.set(0.0, 0.018, 0.0);
  panGroup.add(butterPat);

  const oilSheen = new THREE.Mesh(
    new THREE.CircleGeometry(0.118, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0xffdf7a,
      roughness: 0.06,
      transparent: true,
      opacity: 0.18,
      clearcoat: 1.0,
    })
  );
  oilSheen.rotation.x = -Math.PI / 2;
  oilSheen.position.y = 0.013;
  panGroup.add(oilSheen);

  // Dynamic Fried Egg inside the frying pan!
  const eggWhiteDyn = createEggWhiteDynamicTexture();
  const friedEggInPan = new THREE.Group();
  friedEggInPan.position.set(0, 0.016, 0);
  friedEggInPan.visible = false;
  panGroup.add(friedEggInPan);

  const eggWhiteMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.095, 36),
    new THREE.MeshPhysicalMaterial({
      map: eggWhiteDyn.texture,
      transparent: true,
      roughness: 0.14,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      depthWrite: false,
    })
  );
  eggWhiteMesh.rotation.x = -Math.PI / 2;
  eggWhiteMesh.position.y = 0.002;
  friedEggInPan.add(eggWhiteMesh);

  // Glossy plump wobbling 3D golden-orange yolk dome
  const eggYolkMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mats.yolk
  );
  eggYolkMesh.scale.set(1.0, 0.66, 1.0);
  eggYolkMesh.position.set(0.006, 0.001, -0.004);
  friedEggInPan.add(eggYolkMesh);

  // Herb flakes sprinkled on egg (shown when seasoned!)
  const eggHerbsGroup = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const h = new THREE.Mesh(
      new THREE.CircleGeometry(0.003 + (i % 2) * 0.0015, 6),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x2b2b2b : 0x3b8c32, roughness: 0.7 })
    );
    h.rotation.x = -Math.PI / 2;
    const a = i * 1.7;
    const r = 0.02 + (i % 4) * 0.015;
    h.position.set(Math.cos(a) * r, 0.005, Math.sin(a) * r);
    eggHerbsGroup.add(h);
  }
  eggHerbsGroup.visible = false;
  friedEggInPan.add(eggHerbsGroup);

  const panHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.155, 0.145, 0.08, 16),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  panHit.position.y = 0.035;
  panGroup.add(panHit);

  enableShadows(panGroup);
  tagInteractive(panGroup, 'frying_pan');

  // Stainless Spatula resting near the frying pan
  const spatulaGroup = new THREE.Group();
  const spatHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.13, 12), mats.walnut);
  spatHandle.rotation.z = Math.PI / 2;
  spatHandle.position.set(-0.075, 0.016, 0);
  const spatNeck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, 0.012), mats.steel);
  spatNeck.position.set(0.02, 0.012, 0);
  const spatBlade = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.003, 0.068), mats.steel);
  spatBlade.position.set(0.088, 0.008, 0);
  spatulaGroup.add(spatHandle, spatNeck, spatBlade);
  const spatulaHome = new THREE.Vector3(0.49, 0.008, -0.25);
  spatulaGroup.position.copy(spatulaHome);
  spatulaGroup.rotation.y = -0.5;
  enableShadows(spatulaGroup);
  tagInteractive(spatulaGroup, 'spatula');
  root.add(spatulaGroup);

  // =========================================================================
  // 5. PREP ZONE: OAK CUTTING BOARD, CARROT, BROCCOLI, KNIFE, WATER PITCHER, EGG, SHAKER
  // =========================================================================
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.024, 0.30), mats.oak);
  board.position.set(-0.78, 0.012, 0.08);
  enableShadows(board);
  tagInteractive(board, 'cutting_board');
  root.add(board);

  // Whole Carrot made of 5 crisp separable round segments + leafy green top
  const carrotGroup = new THREE.Group();
  carrotGroup.position.set(-0.83, 0.044, 0.09);
  root.add(carrotGroup);

  const carrotSlices = [];
  const sliceRadii = [0.022, 0.020, 0.018, 0.015, 0.012];
  for (let i = 0; i < 5; i++) {
    const r0 = sliceRadii[i];
    const r1 = i < 4 ? sliceRadii[i + 1] : 0.008;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r0, 0.032, 18),
      [mats.carrotOuter, mats.carrotCut, mats.carrotCut]
    );
    seg.rotation.z = -Math.PI / 2;
    const homeX = -0.064 + i * 0.033;
    seg.position.set(homeX, 0, 0);
    seg.userData.homePos = seg.position.clone();
    seg.userData.sliceIndex = i;
    carrotGroup.add(seg);
    carrotSlices.push(seg);
  }
  // Leafy carrot stem tuft on left end
  const carrotLeaves = new THREE.Group();
  carrotLeaves.position.set(-0.085, 0.002, 0);
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.04, 6), mats.broccoli);
    leaf.rotation.z = Math.PI / 2 + (i - 1.5) * 0.25;
    leaf.rotation.y = (i - 1.5) * 0.3;
    leaf.position.x = -0.018;
    carrotLeaves.add(leaf);
  }
  carrotGroup.add(carrotLeaves);

  const carrotHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.09, 0.11),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  carrotGroup.add(carrotHit);
  enableShadows(carrotGroup);
  tagInteractive(carrotGroup, 'veggies');

  // Fresh Broccoli made of 3 plump separable florets
  const broccoliGroup = new THREE.Group();
  broccoliGroup.position.set(-0.74, 0.025, -0.005);
  root.add(broccoliGroup);

  const broccoliFlorets = [];
  const floretOffsets = [
    [-0.032, 0.018, 0.008],
    [0.012, 0.022, -0.014],
    [0.036, 0.018, 0.016],
  ];
  floretOffsets.forEach(([fx, fy, fz], idx) => {
    const fl = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.026, 10), mats.broccoliStem);
    stem.position.y = 0.008;
    fl.add(stem);
    for (let b = 0; b < 5; b++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), mats.broccoli);
      const a = (b / 5) * Math.PI * 2;
      puff.position.set(
        b === 0 ? 0 : Math.cos(a) * 0.011,
        0.024 + (b === 0 ? 0.005 : 0),
        b === 0 ? 0 : Math.sin(a) * 0.011
      );
      fl.add(puff);
    }
    fl.position.set(fx, fy - 0.012, fz);
    fl.userData.homePos = fl.position.clone();
    fl.userData.floretIndex = idx;
    broccoliGroup.add(fl);
    broccoliFlorets.push(fl);
  });

  const brocHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.09, 0.11),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  brocHit.position.y = 0.02;
  broccoliGroup.add(brocHit);
  enableShadows(broccoliGroup);
  tagInteractive(broccoliGroup, 'veggies');

  // Kid-friendly Wooden-Handle Chef Knife resting beside cutting board
  const knifeGroup = new THREE.Group();
  const kHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.095, 14), mats.walnut);
  kHandle.rotation.z = Math.PI / 2;
  kHandle.position.set(-0.055, 0.014, 0);
  const kBlade = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.032, 0.003), mats.steel);
  kBlade.position.set(0.055, 0.014, 0);
  knifeGroup.add(kHandle, kBlade);
  const knifeHome = new THREE.Vector3(-0.74, 0.024, 0.185);
  knifeGroup.position.copy(knifeHome);
  knifeGroup.rotation.x = Math.PI / 2;
  knifeGroup.rotation.z = 0.14;
  enableShadows(knifeGroup);
  tagInteractive(knifeGroup, 'veggies');
  root.add(knifeGroup);

  // Glass Broth / Water Pitcher (warm glass carafe with wooden grip collar & rich golden broth!)
  const pitcherGroup = new THREE.Group();
  const pitcherHome = new THREE.Vector3(-0.62, 0.0, -0.24);
  pitcherGroup.position.copy(pitcherHome);
  root.add(pitcherGroup);

  const pitcherGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6eff5,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.42,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });
  const pitcherGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.064, 0.165, 24, 1, true),
    pitcherGlassMat
  );
  pitcherGlass.material.side = THREE.DoubleSide;
  pitcherGlass.position.y = 0.084;
  const pitcherRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.052, 0.0045, 10, 24),
    mats.steel
  );
  pitcherRim.rotation.x = Math.PI / 2;
  pitcherRim.position.y = 0.166;
  const pitcherBase = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.01, 24), pitcherGlassMat);
  pitcherBase.position.y = 0.005;
  const pitcherCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.057, 0.026, 24, 1, true),
    mats.oak
  );
  pitcherCollar.position.y = 0.132;
  const pitcherHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.044, 0.0075, 10, 20, Math.PI),
    mats.oak
  );
  pitcherHandle.position.set(-0.054, 0.09, 0);
  pitcherHandle.rotation.z = Math.PI / 2;
  const pitcherLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.049, 0.058, 0.115, 22),
    new THREE.MeshPhysicalMaterial({
      color: 0xe8a428,
      roughness: 0.08,
      transparent: true,
      opacity: 0.90,
      clearcoat: 1.0,
    })
  );
  pitcherLiquid.position.y = 0.064;
  const pitcherHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.20, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pitcherHit.position.y = 0.10;
  pitcherGroup.add(pitcherGlass, pitcherRim, pitcherBase, pitcherCollar, pitcherHandle, pitcherLiquid, pitcherHit);
  enableShadows(pitcherGroup);
  tagInteractive(pitcherGroup, 'pitcher');

  // Pouring liquid arc stream (visible while pouring broth into soup pot)
  const pourStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.013, 0.18, 12),
    new THREE.MeshPhysicalMaterial({
      color: 0xffe6a3,
      roughness: 0.05,
      transparent: true,
      opacity: 0.78,
      clearcoat: 1.0,
    })
  );
  pourStream.visible = false;
  root.add(pourStream);

  // Fresh Brown Egg in Speckled Ceramic Egg Cup (right next to frying pan!)
  const eggCupGroup = new THREE.Group();
  eggCupGroup.position.set(0.50, 0.0, 0.16);
  root.add(eggCupGroup);

  const cupFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.032, 20), mats.ceramicCream);
  cupFoot.position.y = 0.016;
  const cupBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 20, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    mats.ceramicCream
  );
  cupBowl.material.side = THREE.DoubleSide;
  cupBowl.position.y = 0.048;
  eggCupGroup.add(cupFoot, cupBowl);
  enableShadows(eggCupGroup);

  // 2-half crackable brown egg sitting inside the cup
  const rawEggGroup = new THREE.Group();
  const rawEggHome = new THREE.Vector3(0.50, 0.068, 0.16);
  rawEggGroup.position.copy(rawEggHome);
  root.add(rawEggGroup);

  const eggTopHalf = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    mats.eggShell
  );
  eggTopHalf.scale.set(0.95, 1.25, 0.95);
  const eggBottomHalf = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 20, 14, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    mats.eggShell
  );
  eggBottomHalf.scale.set(0.95, 1.15, 0.95);

  // Dark hairline crack band shown after first tap
  const eggCrackRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0268, 0.0018, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0x3b2616 })
  );
  eggCrackRing.rotation.x = Math.PI / 2;
  eggCrackRing.visible = false;

  const eggHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  rawEggGroup.add(eggTopHalf, eggBottomHalf, eggCrackRing, eggHit);
  enableShadows(rawEggGroup);
  tagInteractive(rawEggGroup, 'raw_egg');
  tagInteractive(eggCupGroup, 'raw_egg');

  // Glass Salt & Herb Shaker behind the stove (playful seasoning discovery!)
  const shakerGroup = new THREE.Group();
  const shakerHome = new THREE.Vector3(0.0, 0.0, -0.34);
  shakerGroup.position.copy(shakerHome);
  root.add(shakerGroup);

  const shakerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.026, 0.072, 18), mats.glass);
  shakerBody.position.y = 0.036;
  const shakerSalt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.022, 0.052, 16),
    new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.7 })
  );
  shakerSalt.position.y = 0.030;
  const shakerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.02, 18), mats.chrome);
  shakerCap.position.y = 0.082;
  const shakerHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.13, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  shakerHit.position.y = 0.06;
  shakerGroup.add(shakerBody, shakerSalt, shakerCap, shakerHit);
  enableShadows(shakerGroup);
  tagInteractive(shakerGroup, 'shaker');

  // =========================================================================
  // 6. OAK SERVING TRAY (お盆) + SOUP BOWL + EGG PLATE (MOVES TO MOM & SINK!)
  // =========================================================================
  const trayGroup = new THREE.Group();
  const trayKitchenHome = new THREE.Vector3(0.79, 0.0, 0.04);
  trayGroup.position.copy(trayKitchenHome);
  root.add(trayGroup);

  const trayBase = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.016, 0.34), mats.oak);
  trayBase.position.y = 0.008;
  trayGroup.add(trayBase);

  // Raised wooden lips & curved side handles
  [
    [0, 0.022, -0.165, 0.50, 0.026, 0.012],
    [0, 0.022, 0.165, 0.50, 0.026, 0.012],
    [-0.244, 0.022, 0, 0.012, 0.026, 0.34],
    [0.244, 0.022, 0, 0.012, 0.026, 0.34],
  ].forEach(([x, y, z, w, h, d]) => {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.oak);
    lip.position.set(x, y, z);
    trayGroup.add(lip);
  });

  // Ceramic Soup Bowl on the left side of the tray
  const bowlGroup = new THREE.Group();
  const bowlTrayPos = new THREE.Vector3(-0.115, 0.016, 0.01);
  bowlGroup.position.copy(bowlTrayPos);
  trayGroup.add(bowlGroup);

  const bowlOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.088, 28, 16, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    mats.ceramicCream
  );
  bowlOuter.material.side = THREE.DoubleSide;
  bowlOuter.position.y = 0.072;
  bowlOuter.scale.set(1, 0.82, 1);
  bowlGroup.add(bowlOuter);

  const bowlFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.012, 22), mats.ceramicCream);
  bowlFoot.position.y = 0.006;
  bowlGroup.add(bowlFoot);

  // Plated Soup inside bowl (visible after ladling!)
  const bowlSoupGroup = new THREE.Group();
  bowlSoupGroup.visible = false;
  bowlGroup.add(bowlSoupGroup);

  const bowlSoupLiquid = new THREE.Mesh(
    new THREE.CircleGeometry(0.078, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0xf2a738,
      roughness: 0.1,
      clearcoat: 1.0,
    })
  );
  bowlSoupLiquid.rotation.x = -Math.PI / 2;
  bowlSoupLiquid.position.y = 0.056;
  bowlSoupGroup.add(bowlSoupLiquid);

  // Cute carrot & broccoli garnish floating in the plated soup bowl
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.008, 14),
      [mats.carrotOuter, mats.carrotCut, mats.carrotCut]
    );
    const a = i * 1.65 + 0.4;
    c.position.set(Math.cos(a) * 0.032, 0.057, Math.sin(a) * 0.032);
    c.rotation.x = 0.18;
    bowlSoupGroup.add(c);
  }
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), mats.broccoli);
    const a = i * 2.1 + 1.1;
    b.position.set(Math.cos(a) * 0.038, 0.058, Math.sin(a) * 0.038);
    bowlSoupGroup.add(b);
  }

  // Washable soup smudge overlay inside the bowl (visible after Mom finishes eating!)
  const bowlSmudgeDyn = createDishSmudgeTexture('soup');
  const bowlSmudgeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.072, 24),
    new THREE.MeshBasicMaterial({ map: bowlSmudgeDyn.texture, transparent: true, depthWrite: false })
  );
  bowlSmudgeMesh.rotation.x = -Math.PI / 2;
  bowlSmudgeMesh.position.y = 0.028;
  bowlGroup.add(bowlSmudgeMesh);

  const bowlHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.095, 0.11, 14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  bowlHit.position.y = 0.055;
  bowlGroup.add(bowlHit);
  tagInteractive(bowlGroup, 'soup_bowl');

  // Ceramic Egg Plate on the right side of the tray
  const plateGroup = new THREE.Group();
  const plateTrayPos = new THREE.Vector3(0.11, 0.016, 0.01);
  plateGroup.position.copy(plateTrayPos);
  trayGroup.add(plateGroup);

  const plateDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.078, 0.016, 32), mats.ceramicSage);
  plateDisc.position.y = 0.008;
  plateGroup.add(plateDisc);

  // Plated Fried Egg on the plate (shares crisp cooked egg white texture!)
  const platedEggGroup = new THREE.Group();
  platedEggGroup.position.y = 0.017;
  platedEggGroup.visible = false;
  plateGroup.add(platedEggGroup);

  const platedEggWhite = new THREE.Mesh(
    new THREE.CircleGeometry(0.082, 32),
    new THREE.MeshPhysicalMaterial({
      map: eggWhiteDyn.texture,
      transparent: true,
      roughness: 0.16,
      clearcoat: 0.85,
      depthWrite: false,
    })
  );
  platedEggWhite.rotation.x = -Math.PI / 2;
  platedEggWhite.position.y = 0.002;
  const platedEggYolk = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mats.yolk
  );
  platedEggYolk.scale.set(1.0, 0.65, 1.0);
  platedEggYolk.position.set(0.005, 0.001, -0.003);
  platedEggGroup.add(platedEggWhite, platedEggYolk);

  // Washable yolk smudge on plate after Mom finishes eating
  const plateSmudgeDyn = createDishSmudgeTexture('egg');
  const plateSmudgeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.082, 24),
    new THREE.MeshBasicMaterial({ map: plateSmudgeDyn.texture, transparent: true, depthWrite: false })
  );
  plateSmudgeMesh.rotation.x = -Math.PI / 2;
  plateSmudgeMesh.position.y = 0.018;
  plateGroup.add(plateSmudgeMesh);

  const plateHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.10, 0.07, 14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  plateHit.position.y = 0.035;
  plateGroup.add(plateHit);
  tagInteractive(plateGroup, 'egg_plate');

  // Cozy wooden spoon neatly placed at the front of the tray
  const traySpoon = new THREE.Group();
  const spStem = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.13, 10), mats.oak);
  spStem.rotation.z = Math.PI / 2;
  const spTip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), mats.oak);
  spTip.scale.set(1.25, 0.35, 0.85);
  spTip.position.x = 0.072;
  traySpoon.add(spStem, spTip);
  traySpoon.position.set(-0.08, 0.022, 0.125);
  trayGroup.add(traySpoon);

  enableShadows(trayGroup);
  // Tag tray base separately for carrying tray
  tagInteractive(trayBase, 'tray');

  // =========================================================================
  // 7. KITCHEN SINK, CHROME FAUCET, POROUS SPONGE & WOODEN DISH RACK (FAR RIGHT)
  // =========================================================================
  const sinkGroup = new THREE.Group();
  sinkGroup.position.set(1.76, 0.0, 0.0);
  root.add(sinkGroup);

  // Recessed stainless basin (0.72 wide x 0.56 deep x 0.18 tall)
  const sinkBottom = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.012, 0.56), mats.steel);
  sinkBottom.position.set(0, -0.175, 0.0);
  sinkGroup.add(sinkBottom);

  const sinkWalls = [
    [0, -0.09, -0.28, 0.72, 0.18, 0.012],
    [0, -0.09, 0.28, 0.72, 0.18, 0.012],
    [-0.36, -0.09, 0, 0.012, 0.18, 0.56],
    [0.36, -0.09, 0, 0.012, 0.18, 0.56],
  ];
  sinkWalls.forEach(([x, y, z, w, h, d]) => {
    const wMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.steel);
    wMesh.position.set(x, y, z);
    sinkGroup.add(wMesh);
  });

  // Stainless rim collar around sink cutout
  [
    [0, 0.004, -0.29, 0.76, 0.008, 0.025],
    [0, 0.004, 0.29, 0.76, 0.008, 0.025],
    [-0.37, 0.004, 0, 0.025, 0.008, 0.60],
    [0.37, 0.004, 0, 0.025, 0.008, 0.60],
  ].forEach(([x, y, z, w, h, d]) => {
    const rMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.chrome);
    rMesh.position.set(x, y, z);
    sinkGroup.add(rMesh);
  });

  // Drain grate
  const drain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, 0.006, 20),
    mats.iron
  );
  drain.position.set(0, -0.168, -0.04);
  sinkGroup.add(drain);

  // Chrome Gooseneck Faucet + Tactile Lever Handle
  const faucetGroup = new THREE.Group();
  faucetGroup.position.set(0, 0.0, -0.34);
  sinkGroup.add(faucetGroup);

  const faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.04, 20), mats.chrome);
  faucetBase.position.y = 0.02;
  faucetGroup.add(faucetBase);

  // Curved gooseneck spout built along CatmullRomCurve3
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.035, 0),
    new THREE.Vector3(0, 0.28, 0.01),
    new THREE.Vector3(0, 0.34, 0.14),
    new THREE.Vector3(0, 0.26, 0.26),
  ]);
  const spoutTube = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 28, 0.013, 14, false), mats.chrome);
  faucetGroup.add(spoutTube);

  // Tactile chrome lever on right side of faucet base
  const faucetLeverPivot = new THREE.Group();
  faucetLeverPivot.position.set(0.03, 0.055, 0.0);
  faucetGroup.add(faucetLeverPivot);

  const leverBar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.095, 12), mats.chrome);
  leverBar.rotation.z = -Math.PI / 2;
  leverBar.position.x = 0.045;
  const leverKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x3b9eff, roughness: 0.2, metalness: 0.3 })
  );
  leverKnob.position.x = 0.092;
  faucetLeverPivot.add(leverBar, leverKnob);

  const faucetHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.36, 0.32),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  faucetHit.position.set(0.03, 0.16, 0.12);
  faucetGroup.add(faucetHit);
  enableShadows(faucetGroup);
  tagInteractive(faucetGroup, 'faucet');

  // Animated translucent running water stream from faucet tip into basin
  const faucetStream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.017, 0.43, 16),
    new THREE.MeshPhysicalMaterial({
      color: 0xdff5ff,
      roughness: 0.04,
      transmission: 0.82,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1.0,
    })
  );
  faucetStream.position.set(0, 0.05, -0.08);
  faucetStream.visible = false;
  sinkGroup.add(faucetStream);

  // Water splash ring at bottom of sink
  const sinkSplashRing = new THREE.Mesh(
    new THREE.RingGeometry(0.02, 0.08, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8f9ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  sinkSplashRing.rotation.x = -Math.PI / 2;
  sinkSplashRing.position.set(0, -0.164, -0.08);
  sinkSplashRing.visible = false;
  sinkGroup.add(sinkSplashRing);

  // Porous Yellow-Green Kitchen Sponge
  const spongeGroup = new THREE.Group();
  const spongeHome = new THREE.Vector3(1.50, 0.02, -0.36);
  spongeGroup.position.copy(spongeHome);
  root.add(spongeGroup);

  const spongeFoam = new THREE.Mesh(
    new THREE.BoxGeometry(0.105, 0.030, 0.068),
    new THREE.MeshStandardMaterial({
      map: spongeTex.map,
      bumpMap: spongeTex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.88,
    })
  );
  spongeFoam.position.y = 0.015;
  const spongeScrub = new THREE.Mesh(
    new THREE.BoxGeometry(0.106, 0.010, 0.069),
    new THREE.MeshStandardMaterial({ color: 0x2c8a47, roughness: 0.95 })
  );
  spongeScrub.position.y = 0.035;
  const spongeHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.10, 0.13),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  spongeHit.position.y = 0.03;
  spongeGroup.add(spongeFoam, spongeScrub, spongeHit);
  enableShadows(spongeGroup);
  tagInteractive(spongeGroup, 'sponge');

  // Translucent Mint-Green Dish Soap Bottle
  const soapGroup = new THREE.Group();
  soapGroup.position.set(2.04, 0.0, -0.36);
  root.add(soapGroup);
  const soapBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.038, 0.13, 20),
    new THREE.MeshPhysicalMaterial({
      color: 0x7de0b6,
      roughness: 0.12,
      transmission: 0.55,
      transparent: true,
      opacity: 0.86,
      clearcoat: 0.9,
    })
  );
  soapBottle.position.y = 0.065;
  const soapPump = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.045, 12), mats.ceramicCream);
  soapPump.position.y = 0.15;
  const soapNozzle = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.01, 0.012), mats.ceramicCream);
  soapNozzle.position.set(-0.018, 0.168, 0);
  soapGroup.add(soapBottle, soapPump, soapNozzle);
  enableShadows(soapGroup);
  tagInteractive(soapGroup, 'soap_bottle');

  // Slatted Wooden Dish Drying Rack on the far right (x = 2.46)
  const rackGroup = new THREE.Group();
  rackGroup.position.set(2.44, 0.0, 0.0);
  root.add(rackGroup);

  const rackTray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.014, 0.36), mats.oak);
  rackTray.position.y = 0.007;
  rackGroup.add(rackTray);

  for (let i = -2; i <= 2; i++) {
    const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 8), mats.oak);
    slat.position.set(i * 0.075, 0.06, -0.15);
    rackGroup.add(slat);
    const slat2 = slat.clone();
    slat2.position.z = 0.15;
    rackGroup.add(slat2);
  }
  const backRail = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.014, 0.014), mats.oak);
  backRail.position.set(0, 0.115, -0.15);
  rackGroup.add(backRail);
  enableShadows(rackGroup);

  // Keepsake Hanamaru Card Stand on the kitchen pass-through windowsill (collects completed cards!)
  const keepsakeCardsGroup = new THREE.Group();
  keepsakeCardsGroup.position.set(-0.52, 0.145, -0.61);
  root.add(keepsakeCardsGroup);

  return {
    root,
    mats,
    burners,
    potGroup,
    soupMesh,
    soupMat,
    soupBubbles,
    potVeggiesGroup,
    ladleGroup,
    ladleSoupFill,
    ladleHome,
    panGroup,
    butterPat,
    oilSheen,
    friedEggInPan,
    eggWhiteDyn,
    eggWhiteMesh,
    eggYolkMesh,
    eggHerbsGroup,
    spatulaGroup,
    spatulaHome,
    board,
    carrotGroup,
    carrotSlices,
    carrotLeaves,
    broccoliGroup,
    broccoliFlorets,
    knifeGroup,
    knifeHome,
    pitcherGroup,
    pitcherLiquid,
    pitcherHome,
    pourStream,
    rawEggGroup,
    rawEggHome,
    eggTopHalf,
    eggBottomHalf,
    eggCrackRing,
    shakerGroup,
    shakerHome,
    trayGroup,
    trayKitchenHome,
    bowlGroup,
    bowlTrayPos,
    bowlSoupGroup,
    bowlSmudgeDyn,
    plateGroup,
    plateTrayPos,
    platedEggGroup,
    platedEggYolk,
    plateSmudgeDyn,
    sinkGroup,
    faucetLeverPivot,
    faucetStream,
    sinkSplashRing,
    spongeGroup,
    spongeHome,
    soapGroup,
    rackGroup,
    shelfJars,
    keepsakeCardsGroup,
  };
}
