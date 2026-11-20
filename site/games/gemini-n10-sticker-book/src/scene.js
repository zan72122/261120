import * as THREE from 'three';
import { createNotebook } from './notebook.js';
import { createStickerSheetStack } from './stickerSheets.js';

/**
 * Helper to clone an individual named mesh/node from a loaded Poly Haven glTF scene,
 * center its local X/Z origin, ground its bottom exactly at y = 0, and enable shadows.
 */
function extractGroundedProp(gltfScene, nodeNames) {
  const group = new THREE.Group();
  const names = Array.isArray(nodeNames) ? nodeNames : [nodeNames];

  for (const name of names) {
    const found = gltfScene.getObjectByName(name);
    if (!found) continue;
    const clone = found.clone(true);
    // Reset original showcase offset so we can place cleanly
    clone.position.set(0, 0, 0);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.envMapIntensity = 0.95;
        }
      }
    });
    group.add(clone);
  }

  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (!box.isEmpty()) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    for (const child of group.children) {
      child.position.x -= center.x;
      child.position.z -= center.z;
      child.position.y -= box.min.y;
    }
  }
  return group;
}

function addRadialContactShadow(parent, assets, radiusX, radiusZ, opacity = 0.52, offsetX = 0.002, offsetZ = 0.002) {
  const g = new THREE.PlaneGeometry(radiusX * 2, radiusZ * 2);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({
    map: assets.shadowRadial,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(offsetX, 0.00022, offsetZ);
  mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}

function createRealisticTeaTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  // Beer-Lambert optical depth gradient: deep ruby-amber center -> warm luminous honey meniscus rim
  const g = ctx.createRadialGradient(128, 128, 18, 128, 128, 126);
  g.addColorStop(0.0, '#2b0d03');
  g.addColorStop(0.45, '#4c1b06');
  g.addColorStop(0.76, '#7f330c');
  g.addColorStop(0.92, '#b9651d');
  g.addColorStop(0.98, '#d99a4e');
  g.addColorStop(1.0, '#edd09a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle curved meniscus highlight along sunlit upper-left porcelain wall
  ctx.strokeStyle = 'rgba(255, 240, 210, 0.38)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 121, Math.PI * 0.92, Math.PI * 1.62);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createPhotorealScene(renderer, assets) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbca78e);
  scene.environment = assets.envMap;
  scene.environmentIntensity = 0.90;
  // Rotate HDRI so bright living-room window reflects cleanly across stickers & tea from upper-left
  scene.environmentRotation = new THREE.Euler(0, 0.72, 0);

  // First-person camera (natural human/camera FOV 37-39°, no miniature distortion!)
  const camera = new THREE.PerspectiveCamera(37, window.innerWidth / window.innerHeight, 0.03, 6.0);

  // Single Shadow-Casting Window Sunlight Key Light (warm sunlit morning/afternoon)
  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.35);
  sunLight.position.set(-0.56, 0.90, -0.34);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 0.20;
  sunLight.shadow.camera.far = 2.6;
  const d = 0.50;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.00018;
  sunLight.shadow.normalBias = 0.0020;
  sunLight.shadow.radius = 2.6;
  scene.add(sunLight);

  // Subtle non-shadowed warm bounce light from opposite room wall to avoid crushed blacks
  const bounceLight = new THREE.HemisphereLight(0xf6efe6, 0x9b8268, 0.24);
  scene.add(bounceLight);

  // 1. Real Wooden Dining / Study Table (Poly Haven oak_veneer_01 PBR, oversized so table edge never clips)
  const tableGeom = new THREE.PlaneGeometry(2.80, 2.40);
  tableGeom.rotateX(-Math.PI / 2);
  // Set UV2 for aoMap
  tableGeom.setAttribute('uv2', tableGeom.attributes.uv);

  const tableMat = new THREE.MeshStandardMaterial({
    map: assets.wood.map,
    normalMap: assets.wood.normalMap,
    normalScale: new THREE.Vector2(0.58, 0.58),
    roughnessMap: assets.wood.roughnessMap,
    roughness: 0.68, // Natural satin-varnished oak dining table
    aoMap: assets.wood.armMap,
    aoMapIntensity: 0.35,
    metalness: 0.0,
    envMapIntensity: 0.85,
  });
  const tableMesh = new THREE.Mesh(tableGeom, tableMat);
  tableMesh.name = 'wooden_table';
  tableMesh.receiveShadow = true;
  scene.add(tableMesh);

  // 2. Hero Objects: Spiral Drawing Sketchbook & 3 Fanned Sticker Sheets
  const notebook = createNotebook(assets, { width: 0.232, height: 0.176 });
  scene.add(notebook.root);

  const stickerStack = createStickerSheetStack(assets);
  scene.add(stickerStack.root);

  // Container for stickers stuck playfully directly onto the wooden desk (脱線 OK!)
  const deskStickersGroup = new THREE.Group();
  deskStickersGroup.name = 'desk_stickers';
  scene.add(deskStickersGroup);

  // 3. Real Poly Haven glTF Desk Props (1:1 real-world meter scale)
  // A) Mom's Ceramic Teacup & Saucer across the table (tea_set_01)
  const momCupGroup = new THREE.Group();
  momCupGroup.name = 'mom_teacup';
  const saucer = extractGroundedProp(assets.models.teaSet, 'tea_set_01_saucer_circular_03');
  const cup = extractGroundedProp(assets.models.teaSet, 'tea_set_01_cup_small_01');
  cup.position.y = 0.0085; // Nest neatly inside the saucer well
  cup.rotation.y = 0.65;
  momCupGroup.add(saucer);
  momCupGroup.add(cup);

  // Realistic translucent-looking amber tea liquid surface with meniscus & crisp HDRI reflection
  const teaGeom = new THREE.CircleGeometry(0.0415, 36);
  teaGeom.rotateX(-Math.PI / 2);
  const teaMat = new THREE.MeshPhysicalMaterial({
    map: createRealisticTeaTexture(),
    roughness: 0.025,
    metalness: 0.0,
    ior: 1.333,
    reflectivity: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.1,
  });
  const teaSurface = new THREE.Mesh(teaGeom, teaMat);
  teaSurface.position.set(0, 0.0565, 0);
  momCupGroup.add(teaSurface);
  addRadialContactShadow(momCupGroup, assets, 0.078, 0.078, 0.56, 0.003, 0.003);
  momCupGroup.traverse((c) => {
    if (c.isMesh) c.userData.kind = 'mom_teacup';
  });
  scene.add(momCupGroup);

  // B) Real Pencils & Pink Eraser from Poly Haven stationery_supplies
  const pencilA = extractGroundedProp(assets.models.stationery, 'stationery_supplies_pencil_new_a');
  addRadialContactShadow(pencilA, assets, 0.098, 0.011, 0.36, 0.001, 0.0015);
  scene.add(pencilA);

  const pencilUsed = extractGroundedProp(assets.models.stationery, 'stationery_supplies_pencil_used');
  addRadialContactShadow(pencilUsed, assets, 0.062, 0.011, 0.36, 0.001, 0.0015);
  scene.add(pencilUsed);

  const eraser = extractGroundedProp(assets.models.stationery, 'stationery_supplies_eraser');
  addRadialContactShadow(eraser, assets, 0.026, 0.014, 0.42, 0.0015, 0.0015);
  scene.add(eraser);

  // C) Real Potted Houseplant peeking from far upper-left corner of the table
  const plant = extractGroundedProp(assets.models.plant, [
    'potted_plant_04_pot',
    'potted_plant_04_dirt',
    'potted_plant_04_ground',
    'potted_plant_04_plant',
  ]);
  plant.scale.setScalar(0.84);
  addRadialContactShadow(plant, assets, 0.092, 0.092, 0.58, 0.005, 0.005);
  scene.add(plant);

  // Layout state for Portrait (iPhone 390x844) vs Landscape (iPad 1024x768)
  const layoutState = {
    isPortrait: false,
    camBasePos: new THREE.Vector3(),
    camBaseLook: new THREE.Vector3(),
    notebookBasePos: new THREE.Vector3(),
    notebookBaseRotY: 0,
  };

  function applyResponsiveLayout(width, height) {
    const aspect = width / Math.max(1, height);
    const isPortrait = aspect < 0.90;
    layoutState.isPortrait = isPortrait;

    const fov = isPortrait ? 39 : 37;
    camera.aspect = aspect;
    camera.fov = fov;
    camera.updateProjectionMatrix();

    const vTan = Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    const hTan = vTan * aspect;

    if (isPortrait) {
      // Portrait iPhone (390x844): Full sketchbook + full 3x2 sticker sheet with clean wood margins!
      stickerStack.setOrientation('portrait');

      layoutState.notebookBasePos.set(-0.002, 0, -0.036);
      layoutState.notebookBaseRotY = -0.015;
      notebook.root.position.copy(layoutState.notebookBasePos);
      notebook.root.rotation.set(0, layoutState.notebookBaseRotY, 0);

      stickerStack.root.position.set(0.002, 0, 0.138);
      stickerStack.root.rotation.set(0, 0.010, 0);

      // Mom's teacup across the top right of the table
      momCupGroup.position.set(0.078, 0, -0.232);
      momCupGroup.rotation.y = -0.35;

      // Pencils & pink eraser cleanly separated above sketchbook (generous breathing room)
      pencilA.position.set(-0.032, 0, -0.156);
      pencilA.rotation.y = 0.04;

      pencilUsed.position.set(-0.058, 0, -0.184);
      pencilUsed.rotation.y = -0.07;

      eraser.position.set(0.078, 0, -0.152);
      eraser.rotation.y = -0.22;

      // Potted plant positioned off upper-left so foliage shadow enters softly without white pot blob
      plant.position.set(-0.235, 0, -0.290);
      plant.rotation.y = 0.58;

      // Guarantee full 0.268m horizontal & 0.48m vertical workspace fits cleanly inside frustum
      const reqDistW = 0.136 / hTan;
      const reqDistH = 0.255 / vTan;
      const dist = Math.max(reqDistW, reqDistH, 0.72);
      const pitch = 1.18; // ~67° comfortable first-person look-down angle
      const lookZ = -0.006;
      layoutState.camBaseLook.set(0.0, 0.004, lookZ);
      layoutState.camBasePos.set(0.0, Math.sin(pitch) * dist, lookZ + Math.cos(pitch) * dist);
    } else {
      // Landscape iPad (1024x768) & wider screens: Sketchbook left-center + ALL 6 stickers right!
      stickerStack.setOrientation('landscape');

      layoutState.notebookBasePos.set(-0.074, 0, 0.026);
      layoutState.notebookBaseRotY = -0.018;
      notebook.root.position.copy(layoutState.notebookBasePos);
      notebook.root.rotation.set(0, layoutState.notebookBaseRotY, 0);

      stickerStack.root.position.set(0.128, 0, 0.028);
      stickerStack.root.rotation.set(0, 0.020, 0);

      // Mom's teacup across top-right of table
      momCupGroup.position.set(0.118, 0, -0.154);
      momCupGroup.rotation.y = -0.45;

      // Pencils & eraser neatly placed around sketchbook with zero clipping
      pencilA.position.set(-0.076, 0, -0.094);
      pencilA.rotation.y = 0.03;

      pencilUsed.position.set(-0.222, 0, 0.034);
      pencilUsed.rotation.y = Math.PI * 0.47;

      eraser.position.set(-0.192, 0, -0.098);
      eraser.rotation.y = 0.26;

      // Potted plant positioned further upper-left so lush foliage shadow falls onto wood without white pot sliver
      plant.position.set(-0.372, 0, -0.258);
      plant.rotation.y = 0.72;

      // Workspace spans x in [-0.240 .. +0.230] (halfW = 0.245) and z in [-0.195 .. +0.165] (halfH = 0.195)
      const reqDistW = 0.252 / hTan;
      const reqDistH = 0.205 / vTan;
      const dist = Math.max(reqDistW, reqDistH, 0.62);
      const pitch = 1.13; // ~65° natural seated first-person look-down angle
      const lookX = 0.008;
      const lookZ = -0.004;
      layoutState.camBaseLook.set(lookX, 0.004, lookZ);
      layoutState.camBasePos.set(lookX, Math.sin(pitch) * dist, lookZ + Math.cos(pitch) * dist);
    }

    camera.position.copy(layoutState.camBasePos);
    camera.lookAt(layoutState.camBaseLook);
  }

  applyResponsiveLayout(window.innerWidth, window.innerHeight);

  return {
    scene,
    camera,
    sunLight,
    tableMesh,
    notebook,
    stickerStack,
    deskStickersGroup,
    momCupGroup,
    pencilA,
    pencilUsed,
    eraser,
    plant,
    layoutState,
    applyResponsiveLayout,
  };
}
