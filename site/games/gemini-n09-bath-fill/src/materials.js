import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadBathroomAssets(renderer) {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const texLoader = new THREE.TextureLoader();
  const hdrLoader = new HDRLoader();
  const gltfLoader = new GLTFLoader();

  const loadTex = (path, { srgb = false, repeat = [1, 1] } = {}) =>
    new Promise((resolve, reject) => {
      texLoader.load(
        path,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(repeat[0], repeat[1]);
          tex.anisotropy = maxAniso;
          tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        reject
      );
    });

  // 1. Load Poly Haven modern_bathroom 1k HDRI
  const rawHdr = await hdrLoader.loadAsync('./assets/hdri/modern_bathroom_1k.hdr');
  rawHdr.mapping = THREE.EquirectangularReflectionMapping;
  rawHdr.minFilter = THREE.LinearFilter;
  rawHdr.magFilter = THREE.LinearFilter;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(rawHdr).texture;
  pmrem.dispose();

  // 2. Load CC0 PBR Texture Sets (all <=1024px)
  const [
    wallColor, wallNormal, wallRough,
    floorColor, floorNormal, floorRough,
    porcColor, porcNormal, porcRough,
    metalColor, metalNormal, metalRough, metalMetal,
    marbleColor, marbleNormal, marbleRough, marbleAO,
    terryColor, terryNormal, terryRough, terryAO,
  ] = await Promise.all([
    loadTex('./assets/textures/Tiles036/Tiles036_1K-JPG_Color.jpg', { srgb: true, repeat: [3.2, 2.2] }),
    loadTex('./assets/textures/Tiles036/Tiles036_1K-JPG_NormalGL.jpg', { repeat: [3.2, 2.2] }),
    loadTex('./assets/textures/Tiles036/Tiles036_1K-JPG_Roughness.jpg', { repeat: [3.2, 2.2] }),

    loadTex('./assets/textures/Tiles074/Tiles074_1K-JPG_Color.jpg', { srgb: true, repeat: [2.8, 2.8] }),
    loadTex('./assets/textures/Tiles074/Tiles074_1K-JPG_NormalGL.jpg', { repeat: [2.8, 2.8] }),
    loadTex('./assets/textures/Tiles074/Tiles074_1K-JPG_Roughness.jpg', { repeat: [2.8, 2.8] }),

    loadTex('./assets/textures/Porcelain002/Porcelain002_1K-JPG_Color.jpg', { srgb: true, repeat: [2.2, 1.8] }),
    loadTex('./assets/textures/Porcelain002/Porcelain002_1K-JPG_NormalGL.jpg', { repeat: [2.2, 1.8] }),
    loadTex('./assets/textures/Porcelain002/Porcelain002_1K-JPG_Roughness.jpg', { repeat: [2.2, 1.8] }),

    loadTex('./assets/textures/Metal049A/Metal049A_1K-JPG_Color.jpg', { srgb: true, repeat: [2, 2] }),
    loadTex('./assets/textures/Metal049A/Metal049A_1K-JPG_NormalGL.jpg', { repeat: [2, 2] }),
    loadTex('./assets/textures/Metal049A/Metal049A_1K-JPG_Roughness.jpg', { repeat: [2, 2] }),
    loadTex('./assets/textures/Metal049A/Metal049A_1K-JPG_Metalness.jpg', { repeat: [2, 2] }),

    loadTex('./assets/textures/marble_01/marble_01_diff_1k.jpg', { srgb: true, repeat: [1.6, 0.8] }),
    loadTex('./assets/textures/marble_01/marble_01_nor_gl_1k.jpg', { repeat: [1.6, 0.8] }),
    loadTex('./assets/textures/marble_01/marble_01_rough_1k.jpg', { repeat: [1.6, 0.8] }),
    loadTex('./assets/textures/marble_01/marble_01_ao_1k.jpg', { repeat: [1.6, 0.8] }),

    loadTex('./assets/textures/terry_cloth/terry_cloth_diff_1k.jpg', { srgb: true, repeat: [4.2, 3.6] }),
    loadTex('./assets/textures/terry_cloth/terry_cloth_nor_gl_1k.jpg', { repeat: [4.2, 3.6] }),
    loadTex('./assets/textures/terry_cloth/terry_cloth_rough_1k.jpg', { repeat: [4.2, 3.6] }),
    loadTex('./assets/textures/terry_cloth/terry_cloth_ao_1k.jpg', { repeat: [4.2, 3.6] }),
  ]);

  // 3. Load Poly Haven CC0 glTF Models
  const loadModel = async (path) => {
    const gltf = await gltfLoader.loadAsync(path);
    gltf.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material.envMapIntensity = 0.95;
          if (obj.material.map) obj.material.map.anisotropy = maxAniso;
        }
      }
    });
    return gltf.scene;
  };

  const [ceramicBottleModel, woodenBowlModel, pottedPlantModel, wickerBasketModel] = await Promise.all([
    loadModel('./assets/models/ceramic_vase_01/ceramic_vase_01_1k.gltf'),
    loadModel('./assets/models/wooden_bowl_01/wooden_bowl_01_1k.gltf'),
    loadModel('./assets/models/potted_plant_04/potted_plant_04_1k.gltf'),
    loadModel('./assets/models/wicker_basket_02/wicker_basket_02_1k.gltf'),
  ]);

  // 4. Construct physically calibrated PBR materials
  const wallTileMat = new THREE.MeshStandardMaterial({
    map: wallColor,
    normalMap: wallNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: wallRough,
    roughness: 0.32,
    metalness: 0.0,
    color: new THREE.Color(0xdad4ca),
    envMapIntensity: 0.82,
  });

  // Floor tile material (slightly warmer stone/marble grid, matte-satin dry; wetness added via puddle layer)
  const floorTileMat = new THREE.MeshStandardMaterial({
    map: floorColor,
    normalMap: floorNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: floorRough,
    roughness: 0.48,
    metalness: 0.0,
    color: new THREE.Color(0xebe6de),
    envMapIntensity: 0.8,
  });

  // Glazed Porcelain bathtub (real micro-roughness variation + subtle ceramic glaze clearcoat)
  const porcelainMat = new THREE.MeshPhysicalMaterial({
    map: porcColor,
    normalMap: porcNormal,
    normalScale: new THREE.Vector2(0.14, 0.14),
    roughnessMap: porcRough,
    roughness: 0.18,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.075,
    reflectivity: 0.62,
    color: new THREE.Color(0xf8f7f4),
    envMapIntensity: 1.0,
  });

  // Polished Chrome fixtures (real metal PBR + subtle micro-variation so it's not CG-perfect mirror)
  const chromeMat = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    normalScale: new THREE.Vector2(0.12, 0.12),
    roughnessMap: metalRough,
    metalnessMap: metalMetal,
    roughness: 0.14,
    metalness: 0.96,
    color: new THREE.Color(0xeef1f4),
    envMapIntensity: 1.25,
  });

  // Brushed stainless steel for drain strainer & overflow ring
  const stainlessMat = new THREE.MeshStandardMaterial({
    map: metalColor,
    normalMap: metalNormal,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughnessMap: metalRough,
    metalnessMap: metalMetal,
    roughness: 0.28,
    metalness: 0.92,
    color: new THREE.Color(0xdbe0e5),
    envMapIntensity: 1.05,
  });

  // Natural veined marble ledge / counter
  const marbleMat = new THREE.MeshStandardMaterial({
    map: marbleColor,
    normalMap: marbleNormal,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughnessMap: marbleRough,
    aoMap: marbleAO,
    aoMapIntensity: 0.5,
    roughness: 0.24,
    metalness: 0.0,
    color: new THREE.Color(0xf2efe9),
    envMapIntensity: 0.9,
  });

  // Woven Cotton Terry Cloth Towel (real Poly Haven terry_cloth weave re-toned into warm oatmeal-taupe spa cotton
  // with crisp woven dobby stripes so it contrasts naturally against the white glazed porcelain tub!)
  const warmTerryTex = createWarmCottonTexture(terryColor.image, maxAniso);
  const towelMat = new THREE.MeshPhysicalMaterial({
    map: warmTerryTex,
    normalMap: terryNormal,
    normalScale: new THREE.Vector2(1.85, 1.85),
    roughnessMap: terryRough,
    aoMap: terryAO,
    aoMapIntensity: 0.85,
    roughness: 0.96,
    metalness: 0.0,
    sheen: 0.65,
    sheenRoughness: 0.80,
    sheenColor: new THREE.Color(0xf4eadc),
    color: new THREE.Color(0xdccbb5),
    envMapIntensity: 0.42,
  });

  // Matte dark rubber (drain plug & faucet wall gasket seals)
  const rubberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x232528),
    roughness: 0.72,
    metalness: 0.02,
    normalMap: porcNormal,
    normalScale: new THREE.Vector2(0.2, 0.2),
    envMapIntensity: 0.45,
  });

  // Silicone caulk seam material
  const caulkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xeae8e2),
    roughness: 0.42,
    metalness: 0.0,
    envMapIntensity: 0.55,
  });

  return {
    envMap,
    rawHdr,
    materials: {
      wallTileMat,
      floorTileMat,
      porcelainMat,
      chromeMat,
      stainlessMat,
      marbleMat,
      towelMat,
      rubberMat,
      caulkMat,
    },
    models: {
      ceramicBottleModel,
      woodenBowlModel,
      pottedPlantModel,
      wickerBasketModel,
    },
  };
}

// Re-hue real Poly Haven terry_cloth photograph from blue to warm oatmeal/ivory spa cotton
// while preserving 100% of the real photographic weave micro-contrast and thread grain.
function createWarmCottonTexture(img, maxAniso) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const im = ctx.getImageData(0, 0, size, size);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    // Perceived luminance of real weave with enhanced micro-loop fiber contrast
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const contrast = Math.min(1, Math.max(0, 0.5 + (lum - 0.48) * 1.85));
    const v = 0.48 + contrast * 0.48;
    d[i] = Math.round(v * 236);
    d[i + 1] = Math.round(v * 224);
    d[i + 2] = Math.round(v * 208);
  }
  ctx.putImageData(im, 0, 0);

  // Subtle woven dobby stripe border near hem of real spa towel
  ctx.fillStyle = 'rgba(138, 118, 98, 0.32)';
  ctx.fillRect(0, size * 0.78, size, size * 0.045);
  ctx.fillRect(0, size * 0.85, size, size * 0.016);
  ctx.fillRect(0, size * 0.14, size, size * 0.016);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4.2, 3.6);
  tex.anisotropy = maxAniso;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Create realistic soft contact-shadow decal mesh (multiply blending, never floats)
export function createContactShadow(width, depth, opacity = 0.42, roundness = 0.5) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  if (roundness >= 0.48) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.49);
    grad.addColorStop(0, `rgba(18, 16, 14, ${opacity})`);
    grad.addColorStop(0.55, `rgba(22, 20, 18, ${opacity * 0.58})`);
    grad.addColorStop(1, 'rgba(22, 20, 18, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  } else {
    // Soft rectangular contact shadow for bathtub base
    ctx.fillStyle = `rgba(18, 16, 14, ${opacity})`;
    ctx.filter = 'blur(12px)';
    ctx.fillRect(16, 16, size - 32, size - 32);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}
