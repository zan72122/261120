import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {
  loadPolyHavenPBRAsync,
  loadMetal032PBRAsync,
  createContactShadow,
} from './textures.js';
import { preloadLaundryAssets } from './laundry.js';

export async function buildBalconyScene(renderer, { hdriName = 'suburban_garden' } = {}) {
  const scene = new THREE.Scene();

  const hdrLoader = new HDRLoader();
  const gltfLoader = new GLTFLoader();

  const [
    envTex,
    concretePBR,
    plasterPBR,
    oakPBR,
    linenPBR,
    metalPBR,
    basketGLTF,
    tableGLTF,
    cabinetGLTF,
    plantGLTF,
  ] = await Promise.all([
    hdrLoader.loadAsync(`./assets/hdri/${hdriName}_1k.hdr`),
    loadPolyHavenPBRAsync('concrete_floor_02', { repeat: [3.6, 2.5], anisotropy: 8 }),
    loadPolyHavenPBRAsync('painted_plaster_wall', { repeat: [2.4, 2.0], anisotropy: 4 }),
    loadPolyHavenPBRAsync('oak_veneer_01', { repeat: [3.4, 1.0], anisotropy: 8 }),
    loadPolyHavenPBRAsync('rough_linen', { repeat: [2.5, 4.0], anisotropy: 4 }),
    loadMetal032PBRAsync({ repeat: [3.0, 1.0], anisotropy: 8 }),
    gltfLoader.loadAsync('./assets/models/wicker_basket_01/wicker_basket_01_1k.gltf'),
    gltfLoader.loadAsync('./assets/models/small_wooden_table_01/small_wooden_table_01_1k.gltf'),
    gltfLoader.loadAsync('./assets/models/drawer_cabinet/drawer_cabinet_1k.gltf'),
    gltfLoader.loadAsync('./assets/models/potted_plant_02/potted_plant_02_1k.gltf'),
    preloadLaundryAssets(),
  ]);

  // 1. Real Photographed Outdoor Morning HDRI (Suburban Garden: real sunlit greenery, neighborhood & blue sky!)
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.94;
  scene.background = envTex;
  // Subtle real camera f/2.8 background bokeh so distant photographed garden feels natural!
  scene.backgroundBlurriness = 0.042;
  scene.backgroundIntensity = 1.08;
  const rotY = hdriName === 'suburban_garden' ? 3.55 : 0.85;
  scene.backgroundRotation.y = rotY;
  scene.environmentRotation.y = rotY;
  pmrem.dispose();

  // 2. Crisp Bright Morning Raking Sunlight (Shadow-casting, 1024^2 PCFSoft)
  const sunLight = new THREE.DirectionalLight(0xfff3db, 3.45);
  sunLight.position.set(-2.85, 3.85, 2.0);
  sunLight.target.position.set(0.10, 0.52, -0.58);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.8;
  sunLight.shadow.camera.far = 11.0;
  const d = 2.25;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.016;
  scene.add(sunLight, sunLight.target);

  // Subtle sky-to-concrete natural bounce fill
  const bounceLight = new THREE.HemisphereLight(0xe4f2ff, 0xb29d86, 0.44);
  scene.add(bounceLight);

  // 3. Architectural PBR Materials
  const concreteMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xdad8d2),
    map: concretePBR.map,
    normalMap: concretePBR.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    aoMap: concretePBR.aoMap,
    aoMapIntensity: 0.78,
    roughnessMap: concretePBR.roughnessMap,
    roughness: 0.92,
    metalness: 0.0,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xeae4d9),
    map: plasterPBR.map,
    normalMap: plasterPBR.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    aoMap: plasterPBR.aoMap,
    aoMapIntensity: 0.65,
    roughnessMap: plasterPBR.roughnessMap,
    roughness: 0.9,
    metalness: 0.0,
  });

  const woodDeckMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xdcc3a1),
    map: oakPBR.map,
    normalMap: oakPBR.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: oakPBR.aoMap,
    aoMapIntensity: 0.76,
    roughnessMap: oakPBR.roughnessMap,
    roughness: 0.82,
    metalness: 0.0,
  });

  const steelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xe3e7eb),
    map: metalPBR.map,
    normalMap: metalPBR.normalMap,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: metalPBR.roughnessMap,
    metalnessMap: metalPBR.metalnessMap,
    roughness: 0.24,
    metalness: 0.94,
  });

  const anodizedAluminumMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xb2b7bd),
    normalMap: metalPBR.normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughnessMap: metalPBR.roughnessMap,
    roughness: 0.36,
    metalness: 0.82,
  });

  const darkSashMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x3a3937),
    normalMap: metalPBR.normalMap,
    normalScale: new THREE.Vector2(0.18, 0.18),
    roughness: 0.42,
    metalness: 0.68,
  });

  const rubberCapMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x3f444a),
    roughness: 0.78,
    metalness: 0.04,
  });

  // 4. Balcony Concrete Floor + Sunlit Natural Cedar Duckboard Mat (すのこ)
  const balconyGroup = new THREE.Group();
  balconyGroup.name = 'balcony_architecture';
  scene.add(balconyGroup);

  const floorGeo = new THREE.BoxGeometry(4.6, 0.16, 2.9);
  floorGeo.setAttribute('uv2', floorGeo.attributes.uv);
  const floorMesh = new THREE.Mesh(floorGeo, concreteMat);
  floorMesh.position.set(0.0, -0.08, 0.08);
  floorMesh.receiveShadow = true;
  balconyGroup.add(floorMesh);

  // Recessed drainage channel along outer concrete curb
  const gutterMat = concreteMat.clone();
  gutterMat.color = new THREE.Color(0xb0afa9);
  const gutterMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.008, 0.15), gutterMat);
  gutterMesh.position.set(0.0, 0.001, -1.04);
  gutterMesh.receiveShadow = true;
  balconyGroup.add(gutterMesh);

  // Sunlit slatted natural cedar duckboard mat (realistic plank variation, leaving concrete border visible!)
  const plankGeo = new THREE.BoxGeometry(1.92, 0.015, 0.088);
  plankGeo.setAttribute('uv2', plankGeo.attributes.uv);
  const plankCount = 9;
  const deckInst = new THREE.InstancedMesh(plankGeo, woodDeckMat, plankCount);
  deckInst.receiveShadow = true;
  deckInst.castShadow = true;
  const dummy = new THREE.Object3D();
  const cTmp = new THREE.Color();
  const plankShades = [0.96, 1.02, 0.91, 1.00, 0.94, 1.03, 0.92, 0.98, 0.95];
  for (let i = 0; i < plankCount; i++) {
    dummy.position.set(0.02, 0.014, -0.46 + i * 0.104);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    deckInst.setMatrixAt(i, dummy.matrix);
    const s = plankShades[i];
    cTmp.setRGB(s, s * 0.985, s * 0.965);
    deckInst.setColorAt(i, cTmp);
  }
  deckInst.instanceMatrix.needsUpdate = true;
  deckInst.instanceColor.needsUpdate = true;
  balconyGroup.add(deckInst);

  // Subtle dark cross-battens tucked cleanly underneath the cedar duckboard
  const battenMat = woodDeckMat.clone();
  battenMat.color = new THREE.Color(0x7c654a);
  for (const bx of [-0.74, 0.02, 0.78]) {
    const batten = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.012, 0.84), battenMat);
    batten.position.set(bx, 0.006, -0.044);
    balconyGroup.add(batten);
  }
  const deckShadow = createContactShadow(2.02, 1.04, 0.42);
  deckShadow.position.set(0.02, 0.002, -0.044);
  balconyGroup.add(deckShadow);

  // Low Outer Concrete Curb (y = 0 .. 0.25m)
  const curbGeo = new THREE.BoxGeometry(4.6, 0.25, 0.18);
  curbGeo.setAttribute('uv2', curbGeo.attributes.uv);
  const curb = new THREE.Mesh(curbGeo, wallMat);
  curb.position.set(0.0, 0.125, -1.21);
  curb.castShadow = true;
  curb.receiveShadow = true;
  balconyGroup.add(curb);

  const coping = new THREE.Mesh(new THREE.BoxGeometry(4.64, 0.032, 0.21), anodizedAluminumMat);
  coping.position.set(0.0, 0.265, -1.21);
  coping.castShadow = true;
  coping.receiveShadow = true;
  balconyGroup.add(coping);

  // Architectural Brushed Aluminum Balustrade (y = 0.28 .. 1.09m)
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.042, 0.066), anodizedAluminumMat);
  topRail.position.set(0.0, 1.09, -1.21);
  topRail.castShadow = true;
  topRail.receiveShadow = true;
  balconyGroup.add(topRail);

  const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.026, 0.038), anodizedAluminumMat);
  lowerRail.position.set(0.0, 0.34, -1.21);
  lowerRail.castShadow = true;
  balconyGroup.add(lowerRail);

  // Instanced balustrade slats (1 draw call!)
  const slatXs = [];
  for (let x = -2.1; x <= 2.11; x += 0.13) slatXs.push(x);
  const slatGeo = new THREE.BoxGeometry(0.018, 0.74, 0.022);
  const slatInst = new THREE.InstancedMesh(slatGeo, anodizedAluminumMat, slatXs.length);
  slatInst.castShadow = true;
  slatInst.receiveShadow = true;
  slatXs.forEach((sx, idx) => {
    const isMajor = idx % 6 === 0;
    dummy.position.set(sx, 0.70, -1.21);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(isMajor ? 2.1 : 1.0, isMajor ? 1.06 : 1.0, isMajor ? 1.9 : 1.0);
    dummy.updateMatrix();
    slatInst.setMatrixAt(idx, dummy.matrix);
  });
  slatInst.instanceMatrix.needsUpdate = true;
  balconyGroup.add(slatInst);

  // Translucent frosted architectural balcony glass panel behind slats
  const railGlassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf0f6f8),
    roughness: 0.28,
    metalness: 0.0,
    transparent: true,
    opacity: 0.20,
    reflectivity: 0.72,
  });
  const railGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.72), railGlassMat);
  railGlass.position.set(0.0, 0.71, -1.235);
  balconyGroup.add(railGlass);

  // Left Balcony Dividing Wall
  const leftWallGeo = new THREE.BoxGeometry(0.20, 2.75, 2.95);
  leftWallGeo.setAttribute('uv2', leftWallGeo.attributes.uv);
  const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
  leftWall.position.set(-1.62, 1.375, 0.05);
  leftWall.castShadow = false;
  leftWall.receiveShadow = true;
  balconyGroup.add(leftWall);

  const baseboard = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.09, 2.75), gutterMat);
  baseboard.position.set(-1.505, 0.045, 0.05);
  baseboard.receiveShadow = true;
  balconyGroup.add(baseboard);

  // Right Side: Sliding Veranda Glass Door & Warm Sunlit Interior
  const doorGroup = new THREE.Group();
  doorGroup.position.set(1.56, 0, 0.02);
  balconyGroup.add(doorGroup);

  const rightWallPillar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 0.48), wallMat);
  rightWallPillar.position.set(0.06, 1.35, -1.04);
  rightWallPillar.castShadow = true;
  rightWallPillar.receiveShadow = true;
  doorGroup.add(rightWallPillar);

  const trackBottom = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 2.2), darkSashMat);
  trackBottom.position.set(0.0, 0.022, 0.18);
  trackBottom.receiveShadow = true;
  doorGroup.add(trackBottom);

  const trackTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 2.2), darkSashMat);
  trackTop.position.set(0.0, 2.16, 0.18);
  doorGroup.add(trackTop);

  for (const mz of [-0.82, 0.06, 1.22]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.14, 0.055), darkSashMat);
    mullion.position.set(0.0, 1.09, mz);
    mullion.castShadow = true;
    doorGroup.add(mullion);
  }
  const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.22, 0.028), anodizedAluminumMat);
  doorHandle.position.set(-0.042, 1.02, 0.10);
  doorGroup.add(doorHandle);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xeef5f8),
    roughness: 0.06,
    metalness: 0.02,
    reflectivity: 0.88,
    transparent: true,
    opacity: 0.30,
  });
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(2.04, 2.08), glassMat);
  glassPane.rotation.y = -Math.PI / 2;
  glassPane.position.set(-0.01, 1.09, 0.18);
  doorGroup.add(glassPane);

  const interiorFloor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 2.4), woodDeckMat);
  interiorFloor.position.set(0.75, 0.03, 0.12);
  interiorFloor.receiveShadow = true;
  doorGroup.add(interiorFloor);

  const interiorBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 2.6), wallMat);
  interiorBackWall.position.set(1.42, 1.25, 0.12);
  doorGroup.add(interiorBackWall);

  const curtainGeo = new THREE.PlaneGeometry(0.68, 2.05, 16, 10);
  const cPos = curtainGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    cPos.setZ(i, Math.sin(cPos.getX(i) * 24) * 0.026 + Math.sin(cPos.getY(i) * 3.5) * 0.008);
  }
  curtainGeo.computeVertexNormals();
  curtainGeo.setAttribute('uv2', curtainGeo.attributes.uv);
  const curtainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xf6f1e8),
    map: linenPBR.map,
    normalMap: linenPBR.normalMap,
    roughnessMap: linenPBR.roughnessMap,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const curtain = new THREE.Mesh(curtainGeo, curtainMat);
  curtain.rotation.y = -Math.PI / 2;
  curtain.position.set(0.16, 1.1, -0.42);
  doorGroup.add(curtain);

  // 5. Realistic Japanese Balcony Stainless Steel Laundry Pole (物干し竿) + Flush Metal Brackets
  const poleY = 1.38;
  const poleZ = -0.66;
  const poleGroup = new THREE.Group();
  poleGroup.name = 'laundry_pole_assembly';
  scene.add(poleGroup);

  const poleLength = 2.48;
  const poleGeo = new THREE.CylinderGeometry(0.015, 0.015, poleLength, 24);
  poleGeo.rotateZ(Math.PI / 2);
  const poleMesh = new THREE.Mesh(poleGeo, steelMat);
  poleMesh.position.set(-0.04, poleY, poleZ);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  poleGroup.add(poleMesh);

  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0168, 0.0162, 0.042, 18), rubberCapMat);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(-0.04 + side * (poleLength / 2 + 0.016), poleY, poleZ);
    cap.castShadow = true;
    poleGroup.add(cap);
  }

  function createPoleBracket(bx) {
    const bg = new THREE.Group();
    const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.036, 1.44, 0.042), anodizedAluminumMat);
    stanchion.position.set(bx, 0.72, -1.18);
    stanchion.castShadow = true;
    bg.add(stanchion);

    // Flush mounting collar clamp around stanchion
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.09, 0.058), darkSashMat);
    collar.position.set(bx, poleY - 0.03, -1.18);
    bg.add(collar);

    // Horizontal laundry pole arm from stanchion (-1.18) cleanly to poleZ (-0.64)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.028, 0.56), anodizedAluminumMat);
    arm.position.set(bx, poleY - 0.024, -0.90);
    arm.castShadow = true;
    bg.add(arm);

    // Cleanly joined diagonal strut from (y=poleY-0.25, z=-1.16) to (y=poleY-0.03, z=-0.88)
    const p1 = new THREE.Vector3(bx, poleY - 0.25, -1.16);
    const p2 = new THREE.Vector3(bx, poleY - 0.035, -0.88);
    const dir = p2.clone().sub(p1);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, dir.length()), anodizedAluminumMat);
    strut.position.copy(p1).addScaledVector(dir, 0.5);
    strut.lookAt(p2);
    strut.castShadow = true;
    bg.add(strut);

    // Pole saddle ring
    const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.005, 8, 18), anodizedAluminumMat);
    cradle.rotation.y = Math.PI / 2;
    cradle.position.set(bx, poleY, poleZ);
    bg.add(cradle);
    return bg;
  }
  poleGroup.add(createPoleBracket(-1.12), createPoleBracket(1.02));

  // 6. Real Poly Haven CC0 glTF Models
  function setupGLTFShadows(root, { castLeaves = true } = {}) {
    root.traverse((obj) => {
      if (obj.isMesh) {
        const isLeaves = obj.name.toLowerCase().includes('leaves');
        obj.castShadow = isLeaves ? castLeaves : true;
        obj.receiveShadow = true;
      }
    });
  }

  // 6a. Real Wicker Laundry Basket (front-left on wooden duckboard mat, fully framed!)
  const basket = basketGLTF.scene;
  basket.name = 'wicker_basket';
  basket.scale.set(1.36, 1.50, 1.36);
  basket.position.set(-0.46, 0.022, 0.05);
  basket.rotation.y = 0.26;
  setupGLTFShadows(basket);
  scene.add(basket);

  const basketShadow = createContactShadow(0.68, 0.54, 0.70);
  basketShadow.position.set(-0.46, 0.023, 0.05);
  basketShadow.rotation.y = 0.26;
  scene.add(basketShadow);

  // 6b. Real Small Wooden Folding Table (front-right!)
  const table = tableGLTF.scene;
  table.name = 'folding_table';
  table.scale.set(0.82, 0.88, 0.96);
  table.position.set(0.42, 0.022, 0.10);
  table.rotation.y = -0.22;
  setupGLTFShadows(table);
  scene.add(table);

  const tableShadow = createContactShadow(0.88, 0.54, 0.58);
  tableShadow.position.set(0.42, 0.023, 0.10);
  tableShadow.rotation.y = -0.22;
  scene.add(tableShadow);

  // 6c. Real Wooden Drawer Cabinet with 4 separate working drawers (clean separation from right sock!)
  const cabinet = cabinetGLTF.scene;
  cabinet.name = 'drawer_cabinet';
  cabinet.scale.set(0.66, 0.66, 0.74);
  cabinet.position.set(1.06, 0.002, -0.40);
  cabinet.rotation.y = -0.82;
  setupGLTFShadows(cabinet);
  scene.add(cabinet);

  const topDrawer = cabinet.getObjectByName('drawer_cabinet_drawer_01');
  const secondDrawer = cabinet.getObjectByName('drawer_cabinet_drawer_02');
  if (topDrawer) {
    topDrawer.userData.closedZ = topDrawer.position.z;
  }

  const cabinetShadow = createContactShadow(0.94, 0.54, 0.66);
  cabinetShadow.position.set(1.06, 0.004, -0.40);
  cabinetShadow.rotation.y = -0.82;
  scene.add(cabinetShadow);

  // 6d. Real Potted Plant (far-left concrete corner)
  const plant = plantGLTF.scene;
  plant.name = 'potted_plant';
  plant.scale.set(0.90, 0.90, 0.90);
  plant.position.set(-1.12, 0.002, -0.78);
  plant.rotation.y = 0.65;
  setupGLTFShadows(plant, { castLeaves: false });
  scene.add(plant);

  const plantShadow = createContactShadow(0.60, 0.60, 0.66);
  plantShadow.position.set(-1.12, 0.004, -0.78);
  scene.add(plantShadow);

  return {
    scene,
    sunLight,
    pole: {
      y: poleY,
      z: poleZ,
      mesh: poleMesh,
      slots: [-0.50, -0.05, 0.36], // Fits 100% inside both 1024x768 landscape and 390x844 portrait!
    },
    basket,
    table,
    tableTopY: 0.533 * 0.88 + 0.022,
    cabinet,
    topDrawer,
    secondDrawer,
    plant,
    slidingGlassPane: glassPane,
  };
}
