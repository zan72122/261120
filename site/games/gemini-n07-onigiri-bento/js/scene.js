import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {
  loadPBRSet,
  createRiceTextures,
  createNoriTextures,
  createTamagoyakiTextures,
  createTomatoTextures,
  createLeafTextures,
  createSkinTextures,
  createKnitSleeveTextures,
  createKitchenTileTextures,
  createCedarWoodTexture,
  createContactShadowTexture,
  createSteamTexture,
} from './textures.js';
import {
  createContactShadow,
  createMagewappaBentoBox,
  createPorcelainNoriPlate,
  createRiceGrainGeometry,
  createRiceGrainMaterial,
  createOnigiri,
  createBowlRiceMound,
  createFlatNoriSheet,
  createTamagoyakiSlice,
  createCherryTomato,
  createCrispLettuceLeaf,
  createFuroshikiCloth,
  createSteamSystem,
} from './models.js';
import { createHumanHand } from './hands.js';

export async function buildBentoScene(canvas) {
  const params = new URLSearchParams(window.location.search);
  const useACES = params.get('tm') === 'aces';

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = useACES ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
  renderer.toneMappingExposure = useACES ? 0.96 : 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let currentDPR = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(currentDPR);

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8cec0');
  scene.fog = new THREE.Fog('#dcd3c7', 1.5, 3.8);

  // Separate camera framing for Portrait (iPhone 390x844) vs Landscape (iPad 1024x768)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 12);
  const camTarget = new THREE.Vector3();
  const baseCamPos = new THREE.Vector3();

  function updateCameraLayout(width, height) {
    const aspect = width / Math.max(1, height);
    camera.aspect = aspect;
    if (aspect < 0.78) {
      camera.fov = 47;
      baseCamPos.set(0.0, 0.67, 0.56);
      camTarget.set(0.0, 0.015, -0.055);
    } else if (aspect < 1.15) {
      camera.fov = 42;
      baseCamPos.set(0.0, 0.50, 0.42);
      camTarget.set(0.0, 0.02, -0.048);
    } else {
      camera.fov = 38;
      baseCamPos.set(0.0, 0.42, 0.40);
      camTarget.set(0.0, 0.026, -0.048);
    }
    camera.position.copy(baseCamPos);
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  updateCameraLayout(window.innerWidth, window.innerHeight);

  // Poly Haven morning kitchen HDRI (blinds_1k.hdr)
  const hdrLoader = new HDRLoader();
  const envMap = await hdrLoader.loadAsync('./assets/hdri/blinds_1k.hdr');
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = envMap;
  scene.environmentIntensity = 0.85;
  scene.environmentRotation = new THREE.Euler(0, 1.15, 0);

  // Single primary shadow-casting morning window sunlight (1024x1024 PCFSoftShadowMap)
  const sunLight = new THREE.DirectionalLight('#fff3e0', 2.55);
  sunLight.position.set(-1.15, 1.30, 0.18);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.35;
  sunLight.shadow.camera.far = 3.2;
  const d = 0.52;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.007;
  sunLight.shadow.radius = 2.8;
  scene.add(sunLight);

  const bounceLight = new THREE.HemisphereLight('#f7efe4', '#9c7e62', 0.34);
  scene.add(bounceLight);

  // Load CC0 PBR textures (<= 1024px) + bespoke organic food & skin detail maps
  const texLoader = new THREE.TextureLoader();
  const [tablePBR, maplePBR, cherryPBR, ginghamPBR, plasterPBR, porcelainPBR] = await Promise.all([
    loadPBRSet(texLoader, './assets/textures/wood_table_001', {
      map: 'wood_table_001_diff_1k.jpg',
      normalMap: 'wood_table_001_nor_gl_1k.jpg',
      roughnessMap: 'wood_table_001_rough_1k.jpg',
      aoMap: 'wood_table_001_ao_1k.jpg',
    }, { repeat: [2.2, 1.5], anisotropy: maxAniso }),
    loadPBRSet(texLoader, './assets/textures/white_maple_veneer', {
      map: 'white_maple_veneer_diff_1k.jpg',
      normalMap: 'white_maple_veneer_nor_gl_1k.jpg',
      roughnessMap: 'white_maple_veneer_rough_1k.jpg',
      aoMap: 'white_maple_veneer_ao_1k.jpg',
    }, { repeat: [1, 1], anisotropy: maxAniso }),
    loadPBRSet(texLoader, './assets/textures/cherry_veneer', {
      map: 'cherry_veneer_diff_1k.jpg',
      normalMap: 'cherry_veneer_nor_gl_1k.jpg',
      roughnessMap: 'cherry_veneer_rough_1k.jpg',
    }, { repeat: [1, 1], anisotropy: maxAniso }),
    loadPBRSet(texLoader, './assets/textures/gingham_check', {
      map: 'gingham_check_diff_1k.jpg',
      normalMap: 'gingham_check_nor_gl_1k.jpg',
      roughnessMap: 'gingham_check_rough_1k.jpg',
      aoMap: 'gingham_check_ao_1k.jpg',
    }, { repeat: [3.2, 3.2], anisotropy: maxAniso }),
    loadPBRSet(texLoader, './assets/textures/white_plaster_02', {
      map: 'white_plaster_02_diff_1k.jpg',
      normalMap: 'white_plaster_02_nor_gl_1k.jpg',
      roughnessMap: 'white_plaster_02_rough_1k.jpg',
    }, { repeat: [3.0, 2.0], anisotropy: maxAniso }),
    loadPBRSet(texLoader, './assets/textures/ambientcg_Porcelain001', {
      map: 'Porcelain001_1K-JPG_Color.jpg',
      normalMap: 'Porcelain001_1K-JPG_NormalGL.jpg',
      roughnessMap: 'Porcelain001_1K-JPG_Roughness.jpg',
    }, { repeat: [1, 1], anisotropy: maxAniso }),
  ]);

  const ricePBR = createRiceTextures(maxAniso);
  const noriPBR = createNoriTextures(maxAniso);
  const tamagoyakiPBR = createTamagoyakiTextures(maxAniso);
  const tomatoPBR = createTomatoTextures(maxAniso);
  const leafPBR = createLeafTextures(maxAniso);
  const childSkinPBR = createSkinTextures({ warmTone: '#e4b394', seed: 5511, anisotropy: maxAniso });
  const papaSkinPBR = createSkinTextures({ warmTone: '#d9a686', seed: 9921, anisotropy: maxAniso });
  const childSleevePBR = createKnitSleeveTextures('#dec3b8', maxAniso);
  const papaSleevePBR = createKnitSleeveTextures('#cad7e4', maxAniso);
  const kitchenTilePBR = createKitchenTileTextures(maxAniso);
  const cedarGrainMap = createCedarWoodTexture(maxAniso);
  const shadowTex = createContactShadowTexture();
  const steamTex = createSteamTexture();

  // --- Kitchen Environment: Solid Oiled Oak Dining Table & Japanese Ceramic Tile Backsplash ---
  const tableGeo = new THREE.BoxGeometry(1.75, 0.04, 1.25);
  tableGeo.setAttribute('uv2', tableGeo.attributes.uv);
  const tableMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d8c4ae'),
    map: tablePBR.map,
    normalMap: tablePBR.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: tablePBR.roughnessMap,
    aoMap: tablePBR.aoMap,
    aoMapIntensity: 0.48,
    roughness: 0.86,
    metalness: 0.0,
  });
  const tableMesh = new THREE.Mesh(tableGeo, tableMat);
  tableMesh.position.set(0, -0.02, -0.06);
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  const tileWallGeo = new THREE.PlaneGeometry(2.8, 0.34);
  const tileWallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f4efe7'),
    map: kitchenTilePBR.map,
    normalMap: kitchenTilePBR.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: kitchenTilePBR.roughnessMap,
    roughness: 0.42,
  });
  const tileWall = new THREE.Mesh(tileWallGeo, tileWallMat);
  tileWall.position.set(0, 0.16, -0.63);
  tileWall.receiveShadow = true;
  scene.add(tileWall);

  const wallGeo = new THREE.PlaneGeometry(2.8, 1.3);
  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#eee6da'),
    map: plasterPBR.map,
    normalMap: plasterPBR.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: plasterPBR.roughnessMap,
    roughness: 0.90,
  });
  const backWall = new THREE.Mesh(wallGeo, wallMat);
  backWall.position.set(0, 0.96, -0.635);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const railGeo = new THREE.BoxGeometry(2.8, 0.018, 0.024);
  const railMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#c8a782'),
    map: cherryPBR.map,
    roughness: 0.74,
  });
  const railMesh = new THREE.Mesh(railGeo, railMat);
  railMesh.position.set(0, 0.33, -0.62);
  railMesh.receiveShadow = true;
  scene.add(railMesh);

  // --- Load Poly Haven Photogrammetry glTF Kitchen Models ---
  const gltfLoader = new GLTFLoader();
  const loadGLTF = async (path, scale = 1.0, castShadow = true) => {
    const gltf = await gltfLoader.loadAsync(path);
    const root = gltf.scene;
    root.scale.setScalar(scale);
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = castShadow;
        obj.receiveShadow = true;
        if (obj.material) obj.material.envMapIntensity = 0.92;
      }
    });
    return root;
  };

  const [woodenBowl, carvedPlate, woodenSpoon, cuttingBoard, ceramicJug] = await Promise.all([
    loadGLTF('./assets/models/wooden_bowl_01/wooden_bowl_01_1k.gltf', 0.60, true),
    loadGLTF('./assets/models/carved_wooden_plate/carved_wooden_plate_1k.gltf', 0.54, true),
    loadGLTF('./assets/models/wooden_spoon/wooden_spoon_1k.gltf', 0.62, true),
    loadGLTF('./assets/models/wooden_cutting_board/wooden_cutting_board_1k.gltf', 0.52, false),
    loadGLTF('./assets/models/jug_01/jug_01_1k.gltf', 0.80, false),
  ]);

  // 1. Background Ceramic Jug (right-back morning kitchen ambiance)
  ceramicJug.position.set(0.24, 0.0, -0.36);
  ceramicJug.rotation.y = -0.82;
  scene.add(ceramicJug);
  const jugShadow = createContactShadow(shadowTex, 0.18, 0.18, 0.78);
  jugShadow.position.set(0.24, 0.0005, -0.36);
  scene.add(jugShadow);

  // 2. Wooden Cutting Board (upper-left background, zero overlap)
  cuttingBoard.position.set(-0.24, 0.0, -0.35);
  cuttingBoard.rotation.y = 0.14;
  scene.add(cuttingBoard);
  const boardShadow = createContactShadow(shadowTex, 0.25, 0.15, 0.72);
  boardShadow.position.set(-0.24, 0.0005, -0.35);
  boardShadow.rotation.y = 0.14;
  scene.add(boardShadow);

  // 3. Carved Wooden Rice Bowl (Ohitsu) + Steaming Freshly Cooked Rice
  const bowlPos = new THREE.Vector3(-0.102, -0.0022, -0.165);
  woodenBowl.position.copy(bowlPos);
  woodenBowl.rotation.y = 0.4;
  scene.add(woodenBowl);
  const bowlShadow = createContactShadow(shadowTex, 0.205, 0.205, 0.92);
  bowlShadow.position.set(bowlPos.x, 0.0005, bowlPos.z);
  scene.add(bowlShadow);

  const grainGeo = createRiceGrainGeometry();
  const grainMat = createRiceGrainMaterial();

  const bowlRice = createBowlRiceMound(ricePBR, grainGeo, grainMat, 0.082, 0.043);
  bowlRice.position.set(bowlPos.x, 0.020, bowlPos.z);
  scene.add(bowlRice);

  const bowlSteam = createSteamSystem(steamTex, 10, 0.052);
  bowlSteam.group.position.set(bowlPos.x, 0.062, bowlPos.z);
  scene.add(bowlSteam.group);

  // 4. Wooden Spoon (Shamoji) beside rice bowl
  const spoonRestPos = new THREE.Vector3(-0.215, 0.011, -0.085);
  const spoonRestRot = new THREE.Euler(0.05, 0.28, -0.04);
  woodenSpoon.position.copy(spoonRestPos);
  woodenSpoon.rotation.copy(spoonRestRot);
  scene.add(woodenSpoon);
  const spoonShadow = createContactShadow(shadowTex, 0.068, 0.19, 0.56);
  spoonShadow.position.set(-0.215, 0.0005, -0.095);
  spoonShadow.rotation.y = 0.28;
  scene.add(spoonShadow);

  // 5. Glazed Porcelain Nori Plate (ambientCG Porcelain001 CC0!) cleanly separated from bento box!
  const noriPlatePos = new THREE.Vector3(-0.158, 0.0, 0.025);
  const noriPlate = createPorcelainNoriPlate(porcelainPBR);
  noriPlate.scale.setScalar(0.80);
  noriPlate.position.copy(noriPlatePos);
  scene.add(noriPlate);
  const noriPlateShadow = createContactShadow(shadowTex, 0.132, 0.132, 0.80);
  noriPlateShadow.position.set(noriPlatePos.x, 0.0005, noriPlatePos.z);
  scene.add(noriPlateShadow);

  const noriStrips = [
    createFlatNoriSheet(noriPBR),
    createFlatNoriSheet(noriPBR),
  ];
  const noriRest = [
    { pos: new THREE.Vector3(noriPlatePos.x - 0.005, 0.0080, noriPlatePos.z + 0.002), rotY: 0.16 },
    { pos: new THREE.Vector3(noriPlatePos.x + 0.006, 0.0098, noriPlatePos.z - 0.003), rotY: -0.14 },
  ];
  noriStrips.forEach((m, i) => {
    m.position.copy(noriRest[i].pos);
    m.rotation.y = noriRest[i].rotY;
    scene.add(m);
  });

  // 6. Carved Wooden Side-Dish Plate (holds Tamagoyaki & Cherry Tomatoes)
  const sidePlatePos = new THREE.Vector3(0.110, 0.0028, -0.155);
  carvedPlate.position.copy(sidePlatePos);
  carvedPlate.rotation.y = -0.35;
  scene.add(carvedPlate);
  const sidePlateShadow = createContactShadow(shadowTex, 0.175, 0.175, 0.86);
  sidePlateShadow.position.set(sidePlatePos.x, 0.0004, sidePlatePos.z);
  scene.add(sidePlateShadow);

  // 7. Bundle Group (wraps Bento Box + Lid + Furoshiki Cloth together so the whole wrapped bento can be lifted and handed to Papa!)
  const bentoPos = new THREE.Vector3(0.015, 0.0, 0.055);
  const bundleGroup = new THREE.Group();
  bundleGroup.position.copy(bentoPos);
  scene.add(bundleGroup);

  const furoshiki = createFuroshikiCloth(ginghamPBR);
  furoshiki.group.position.set(0, 0, 0);
  bundleGroup.add(furoshiki.group);

  const { boxGroup: bentoBox, lidGroup: bentoLid } = createMagewappaBentoBox(maplePBR, cherryPBR, cedarGrainMap);
  bentoBox.position.set(0, 0.0035, 0);
  bentoBox.rotation.y = -0.04;
  bundleGroup.add(bentoBox);

  const bentoShadow = createContactShadow(shadowTex, 0.222, 0.152, 0.86);
  bentoShadow.position.set(bentoPos.x, 0.0022, bentoPos.z);
  bentoShadow.rotation.y = -0.04;
  scene.add(bentoShadow);

  // Matching Bentwood Lid resting behind-center
  const lidRestPos = new THREE.Vector3(0.015, 0.0, -0.315);
  const lidRestRotY = 0.08;
  bentoLid.position.copy(lidRestPos);
  bentoLid.rotation.y = lidRestRotY;
  scene.add(bentoLid);
  const lidShadow = createContactShadow(shadowTex, 0.225, 0.158, 0.78);
  lidShadow.position.set(lidRestPos.x, 0.0005, lidRestPos.z);
  lidShadow.rotation.y = lidRestRotY;
  scene.add(lidShadow);

  // Crisp Green Lettuce Leaf lining right compartment of Bento Box
  const lettuceLeaf = createCrispLettuceLeaf(leafPBR);
  lettuceLeaf.castShadow = false;
  lettuceLeaf.position.set(0.030, 0.022, -0.004);
  lettuceLeaf.rotation.set(-1.12, 0.18, -0.32);
  bentoBox.add(lettuceLeaf);

  // --- Food Entities (2 Onigiri, 2 Tamagoyaki Slices, 3 Cherry Tomatoes) ---
  const onigiris = [
    createOnigiri(ricePBR, noriPBR, grainGeo, grainMat, 101),
    createOnigiri(ricePBR, noriPBR, grainGeo, grainMat, 207),
  ];
  onigiris.forEach((o) => {
    o.group.visible = false;
    scene.add(o.group);
  });

  const handSteam = createSteamSystem(steamTex, 6, 0.024);
  handSteam.group.visible = false;
  scene.add(handSteam.group);

  // 2 Golden Tamagoyaki slices starting on the carved wooden plate -> pack into right half of bento
  const tamagoyakis = [
    {
      mesh: createTamagoyakiSlice(tamagoyakiPBR, 1),
      platePos: new THREE.Vector3(sidePlatePos.x - 0.028, 0.021, sidePlatePos.z - 0.014),
      plateRot: new THREE.Euler(-0.10, 0.38, 0.04),
      bentoPos: new THREE.Vector3(0.035, 0.024, -0.017),
      bentoRot: new THREE.Euler(-0.18, -0.32, 0.06),
      packed: false,
    },
    {
      mesh: createTamagoyakiSlice(tamagoyakiPBR, 2),
      platePos: new THREE.Vector3(sidePlatePos.x - 0.014, 0.021, sidePlatePos.z + 0.020),
      plateRot: new THREE.Euler(-0.08, 0.56, -0.03),
      bentoPos: new THREE.Vector3(0.040, 0.024, 0.012),
      bentoRot: new THREE.Euler(-0.16, -0.44, -0.05),
      packed: false,
    },
  ];
  tamagoyakis.forEach((item) => {
    item.mesh.position.copy(item.platePos);
    item.mesh.rotation.copy(item.plateRot);
    scene.add(item.mesh);
  });

  // 3 Glossy Red Cherry Tomatoes starting on the carved wooden plate -> pack snugly into bento
  const tomatoes = [
    {
      mesh: createCherryTomato(tomatoPBR, 1),
      platePos: new THREE.Vector3(sidePlatePos.x + 0.026, 0.020, sidePlatePos.z - 0.020),
      plateRot: new THREE.Euler(0.16, 0.7, -0.20),
      bentoPos: new THREE.Vector3(0.068, 0.023, -0.014),
      bentoRot: new THREE.Euler(0.24, 0.5, -0.18),
      packed: false,
    },
    {
      mesh: createCherryTomato(tomatoPBR, 2),
      platePos: new THREE.Vector3(sidePlatePos.x + 0.032, 0.020, sidePlatePos.z + 0.008),
      plateRot: new THREE.Euler(-0.18, 1.9, 0.16),
      bentoPos: new THREE.Vector3(0.066, 0.023, 0.013),
      bentoRot: new THREE.Euler(-0.15, 1.8, 0.22),
      packed: false,
    },
    {
      mesh: createCherryTomato(tomatoPBR, 3),
      platePos: new THREE.Vector3(sidePlatePos.x + 0.012, 0.020, sidePlatePos.z + 0.034),
      plateRot: new THREE.Euler(0.22, 2.8, -0.12),
      bentoPos: new THREE.Vector3(0.050, 0.023, 0.036),
      bentoRot: new THREE.Euler(0.18, 0.9, -0.24),
      packed: false,
    },
  ];
  tomatoes.forEach((item) => {
    item.mesh.position.copy(item.platePos);
    item.mesh.rotation.copy(item.plateRot);
    scene.add(item.mesh);
  });

  // --- First-Person Child's Hands (5-year-old knit-sleeved warm hands) ---
  const leftHand = createHumanHand({
    side: 'left',
    isChild: true,
    skinPBR: childSkinPBR,
    sleeveColor: '#e5cac0',
    sleevePBR: childSleevePBR,
  });
  scene.add(leftHand.root);

  const rightHand = createHumanHand({
    side: 'right',
    isChild: true,
    skinPBR: childSkinPBR,
    sleeveColor: '#e5cac0',
    sleevePBR: childSleevePBR,
  });
  scene.add(rightHand.root);

  // --- Papa's Welcoming Hands (warm adult hands in crisp pale-blue Oxford dress shirt cuffs) ---
  const papaLeft = createHumanHand({
    side: 'left',
    isChild: false,
    skinPBR: papaSkinPBR,
    sleeveColor: '#d2dfeb',
    sleevePBR: papaSleevePBR,
  });
  papaLeft.root.visible = false;
  scene.add(papaLeft.root);

  const papaRight = createHumanHand({
    side: 'right',
    isChild: false,
    skinPBR: papaSkinPBR,
    sleeveColor: '#d2dfeb',
    sleevePBR: papaSleevePBR,
  });
  papaRight.root.visible = false;
  scene.add(papaRight.root);

  // Dynamic mobile pixelRatio scaler (maintains >=30fps on iPhone/iPad automatically)
  let slowFrameCount = 0;
  function adaptQuality(dt) {
    if (dt > 0.034 && currentDPR > 1.0) {
      slowFrameCount++;
      if (slowFrameCount >= 18) {
        currentDPR = Math.max(1.0, +(currentDPR - 0.15).toFixed(2));
        renderer.setPixelRatio(currentDPR);
        slowFrameCount = 0;
      }
    } else if (dt < 0.022) {
      slowFrameCount = Math.max(0, slowFrameCount - 1);
    }
  }

  window.addEventListener('resize', () => {
    updateCameraLayout(window.innerWidth, window.innerHeight);
  });

  return {
    renderer,
    scene,
    camera,
    camTarget,
    baseCamPos,
    adaptQuality,
    updateCameraLayout,
    toneMappingName: useACES ? 'ACESFilmic' : 'AgX',
    props: {
      woodenBowl,
      bowlPos,
      bowlRice,
      bowlSteam,
      woodenSpoon,
      spoonRestPos,
      spoonRestRot,
      noriPlate,
      noriPlatePos,
      noriStrips,
      noriRest,
      carvedPlate,
      sidePlatePos,
      ceramicJug,
      bundleGroup,
      bentoPos,
      bentoBox,
      bentoLid,
      bentoShadow,
      lidRestPos,
      lidRestRotY,
      lidShadow,
      furoshiki,
      lettuceLeaf,
      onigiris,
      handSteam,
      tamagoyakis,
      tomatoes,
      leftHand,
      rightHand,
      papaLeft,
      papaRight,
    },
  };
}
