import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export function createAssetLoader(renderer) {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const texLoader = new THREE.TextureLoader();
  const gltfLoader = new GLTFLoader();
  const hdrLoader = new HDRLoader();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  function loadTex(url, { srgb = false, repeat = [1, 1], flipY = true } = {}) {
    const tex = texLoader.load(url);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.flipY = flipY;
    tex.anisotropy = maxAniso;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return tex;
  }

  async function loadHDRI(url) {
    const hdr = await hdrLoader.loadAsync(url);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const envRT = pmrem.fromEquirectangular(hdr);
    hdr.dispose();
    return envRT;
  }

  async function loadGLTF(url) {
    const gltf = await gltfLoader.loadAsync(url);
    gltf.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (!m) continue;
          if (m.map) m.map.anisotropy = maxAniso;
          if (m.normalMap) m.normalMap.anisotropy = maxAniso;
          if (m.roughnessMap) m.roughnessMap.anisotropy = maxAniso;
          // Slightly ground specular intensity on photogrammetry scans so fruits look real, not waxed plastic
          if (m.envMapIntensity !== undefined) m.envMapIntensity = 0.85;
        }
      }
    });
    return gltf.scene;
  }

  function loadPBRSets() {
    // 1. Kitchen Wood Countertop (Poly Haven: kitchen_wood)
    const woodRep = [2.4, 1.5];
    const woodDiff = loadTex('./assets/textures/kitchen_wood/Diffuse.jpg', { srgb: true, repeat: woodRep });
    const woodNor = loadTex('./assets/textures/kitchen_wood/nor_gl.jpg', { srgb: false, repeat: woodRep });
    const woodArm = loadTex('./assets/textures/kitchen_wood/arm.jpg', { srgb: false, repeat: woodRep });

    // 2. Kitchen Backsplash Tiles (ambientCG: Tiles133A)
    const tileRep = [3.6, 1.9];
    const tileDiff = loadTex('./assets/textures/Tiles133A/Tiles133A_1K-JPG_Color.jpg', { srgb: true, repeat: tileRep });
    const tileNor = loadTex('./assets/textures/Tiles133A/Tiles133A_1K-JPG_NormalGL.jpg', { srgb: false, repeat: tileRep });
    const tileRough = loadTex('./assets/textures/Tiles133A/Tiles133A_1K-JPG_Roughness.jpg', { srgb: false, repeat: tileRep });
    const tileAO = loadTex('./assets/textures/Tiles133A/Tiles133A_1K-JPG_AmbientOcclusion.jpg', { srgb: false, repeat: tileRep });

    // 3. White Plaster Wall (Poly Haven: white_plaster_02)
    const wallRep = [2.5, 2.0];
    const wallDiff = loadTex('./assets/textures/white_plaster_02/Diffuse.jpg', { srgb: true, repeat: wallRep });
    const wallNor = loadTex('./assets/textures/white_plaster_02/nor_gl.jpg', { srgb: false, repeat: wallRep });
    const wallArm = loadTex('./assets/textures/white_plaster_02/arm.jpg', { srgb: false, repeat: wallRep });

    // 4. Brushed Stainless Steel (ambientCG: Metal009)
    const metalRep = [1.4, 2.2];
    const metalDiff = loadTex('./assets/textures/Metal009/Metal009_1K-JPG_Color.jpg', { srgb: true, repeat: metalRep });
    const metalNor = loadTex('./assets/textures/Metal009/Metal009_1K-JPG_NormalGL.jpg', { srgb: false, repeat: metalRep });
    const metalRough = loadTex('./assets/textures/Metal009/Metal009_1K-JPG_Roughness.jpg', { srgb: false, repeat: metalRep });
    const metalMet = loadTex('./assets/textures/Metal009/Metal009_1K-JPG_Metalness.jpg', { srgb: false, repeat: metalRep });

    // 5. Fridge Interior Satin Polymer (ambientCG: Plastic013A — subtle micro-grain normal only so no blotchy mirror patches!)
    const plasRep = [2.0, 2.2];
    const plasNor = loadTex('./assets/textures/Plastic013A/Plastic013A_1K-JPG_NormalGL.jpg', { srgb: false, repeat: plasRep });

    // 6. Kraft Shopping Bag Paper (ambientCG: Paper005)
    const paperRep = [1.3, 1.3];
    const paperDiff = loadTex('./assets/textures/Paper005/Paper005_1K-JPG_Color.jpg', { srgb: true, repeat: paperRep });
    const paperNor = loadTex('./assets/textures/Paper005/Paper005_1K-JPG_NormalGL.jpg', { srgb: false, repeat: paperRep });
    const paperRough = loadTex('./assets/textures/Paper005/Paper005_1K-JPG_Roughness.jpg', { srgb: false, repeat: paperRep });

    // 7. Molded Egg Carton Pulp (ambientCG: Cardboard004)
    const pulpRep = [2.5, 2.5];
    const pulpDiff = loadTex('./assets/textures/Cardboard004/Cardboard004_1K-JPG_Color.jpg', { srgb: true, repeat: pulpRep });
    const pulpNor = loadTex('./assets/textures/Cardboard004/Cardboard004_1K-JPG_NormalGL.jpg', { srgb: false, repeat: pulpRep });
    const pulpRough = loadTex('./assets/textures/Cardboard004/Cardboard004_1K-JPG_Roughness.jpg', { srgb: false, repeat: pulpRep });

    // 8. Woven Linen Cloth (Poly Haven: rough_linen)
    const linenRep = [1.4, 1.4];
    const linenDiff = loadTex('./assets/textures/rough_linen/Diffuse.jpg', { srgb: true, repeat: linenRep });
    const linenNor = loadTex('./assets/textures/rough_linen/nor_gl.jpg', { srgb: false, repeat: linenRep });
    const linenArm = loadTex('./assets/textures/rough_linen/arm.jpg', { srgb: false, repeat: linenRep });

    return {
      counterWood: new THREE.MeshStandardMaterial({
        map: woodDiff,
        normalMap: woodNor,
        normalScale: new THREE.Vector2(0.5, 0.5),
        aoMap: woodArm,
        aoMapIntensity: 0.55,
        roughnessMap: woodArm,
        roughness: 0.68,
        metalness: 0.0,
        color: new THREE.Color('#ead9c3'),
        envMapIntensity: 0.72,
      }),
      backsplashTile: new THREE.MeshStandardMaterial({
        map: tileDiff,
        normalMap: tileNor,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughnessMap: tileRough,
        roughness: 0.38,
        aoMap: tileAO,
        aoMapIntensity: 0.75,
        metalness: 0.0,
        color: new THREE.Color('#f4f1ea'),
        envMapIntensity: 0.65,
      }),
      plasterWall: new THREE.MeshStandardMaterial({
        map: wallDiff,
        normalMap: wallNor,
        normalScale: new THREE.Vector2(0.25, 0.25),
        aoMap: wallArm,
        roughnessMap: wallArm,
        roughness: 0.92,
        metalness: 0.0,
        color: new THREE.Color('#eae3d7'),
      }),
      brushedSteel: new THREE.MeshStandardMaterial({
        map: metalDiff,
        normalMap: metalNor,
        normalScale: new THREE.Vector2(0.16, 0.16),
        roughnessMap: metalRough,
        roughness: 0.34,
        metalness: 0.58,
        color: new THREE.Color('#e3e7ec'),
        envMapIntensity: 1.25,
      }),
      // Bright satin anodized aluminum trim (crisp silver catchlight inside cool fridge!)
      chromeTrim: new THREE.MeshStandardMaterial({
        map: metalDiff,
        normalMap: metalNor,
        normalScale: new THREE.Vector2(0.08, 0.08),
        roughness: 0.28,
        metalness: 0.38,
        color: new THREE.Color('#eef3f7'),
        envMapIntensity: 1.45,
      }),
      fridgeLiner: new THREE.MeshStandardMaterial({
        normalMap: plasNor,
        normalScale: new THREE.Vector2(0.04, 0.04),
        roughness: 0.44,
        metalness: 0.0,
        color: new THREE.Color('#edf2f6'),
        envMapIntensity: 0.55,
      }),
      fridgeLinerAO: new THREE.MeshStandardMaterial({
        normalMap: plasNor,
        normalScale: new THREE.Vector2(0.04, 0.04),
        roughness: 0.46,
        metalness: 0.0,
        vertexColors: true,
        color: new THREE.Color('#eff4f8'),
        envMapIntensity: 0.50,
      }),
      rubberGasket: new THREE.MeshStandardMaterial({
        normalMap: plasNor,
        normalScale: new THREE.Vector2(0.15, 0.15),
        roughness: 0.84,
        metalness: 0.0,
        color: new THREE.Color('#8e959e'),
      }),
      kraftBag: new THREE.MeshStandardMaterial({
        map: paperDiff,
        normalMap: paperNor,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughnessMap: paperRough,
        roughness: 0.94,
        metalness: 0.0,
        color: new THREE.Color('#c8a278'),
        envMapIntensity: 0.55,
        side: THREE.DoubleSide,
      }),
      kraftBagInside: new THREE.MeshStandardMaterial({
        map: paperDiff,
        normalMap: paperNor,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughnessMap: paperRough,
        roughness: 0.97,
        metalness: 0.0,
        color: new THREE.Color('#7a5d3f'),
        side: THREE.DoubleSide,
      }),
      eggPulp: new THREE.MeshStandardMaterial({
        map: pulpDiff,
        normalMap: pulpNor,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: pulpRough,
        roughness: 0.96,
        metalness: 0.0,
        vertexColors: true,
        color: new THREE.Color('#d2c5b3'),
        envMapIntensity: 0.45,
        side: THREE.DoubleSide,
      }),
      eggPulpPlain: new THREE.MeshStandardMaterial({
        map: pulpDiff,
        normalMap: pulpNor,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughnessMap: pulpRough,
        roughness: 0.96,
        metalness: 0.0,
        color: new THREE.Color('#c9bba7'),
        envMapIntensity: 0.45,
        side: THREE.DoubleSide,
      }),
      pulpNormalTex: pulpNor,
      linenCloth: new THREE.MeshStandardMaterial({
        map: linenDiff,
        normalMap: linenNor,
        normalScale: new THREE.Vector2(0.85, 0.85),
        aoMap: linenArm,
        roughnessMap: linenArm,
        roughness: 0.95,
        metalness: 0.0,
        color: new THREE.Color('#dfd3be'),
        envMapIntensity: 0.45,
      }),
    };
  }

  return { loadHDRI, loadGLTF, loadPBRSets, maxAniso, pmrem };
}

export function createContactShadowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.49);
  grad.addColorStop(0.0, 'rgba(20, 14, 9, 0.72)');
  grad.addColorStop(0.42, 'rgba(24, 17, 11, 0.38)');
  grad.addColorStop(0.76, 'rgba(26, 19, 13, 0.11)');
  grad.addColorStop(1.0, 'rgba(26, 19, 13, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
