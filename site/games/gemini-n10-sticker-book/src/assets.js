import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const STICKER_SHEETS_DEF = [
  {
    id: 'fruits',
    frameColor: '#eedcd2',
    linerColor: '#f6f4ef',
    accentRim: '#d7bfb0',
    items: [
      { id: 'fruits_strawberry', file: './assets/stickers/fruits_strawberry.png', scale: 1.00 },
      { id: 'fruits_apple',      file: './assets/stickers/fruits_apple.png',      scale: 0.98 },
      { id: 'fruits_banana',     file: './assets/stickers/fruits_banana.png',     scale: 1.06 },
      { id: 'fruits_orange',     file: './assets/stickers/fruits_orange.png',     scale: 0.98 },
      { id: 'fruits_grapes',     file: './assets/stickers/fruits_grapes.png',     scale: 1.04 },
      { id: 'fruits_watermelon', file: './assets/stickers/fruits_watermelon.png', scale: 1.04 },
    ],
  },
  {
    id: 'vegetables',
    frameColor: '#d9e5d3',
    linerColor: '#f4f6f1',
    accentRim: '#b8ccb0',
    items: [
      { id: 'vegetables_tomato',   file: './assets/stickers/vegetables_tomato.png',   scale: 0.96 },
      { id: 'vegetables_carrot',   file: './assets/stickers/vegetables_carrot.png',   scale: 1.06 },
      { id: 'vegetables_broccoli', file: './assets/stickers/vegetables_broccoli.png', scale: 1.00 },
      { id: 'vegetables_corn',     file: './assets/stickers/vegetables_corn.png',     scale: 1.06 },
      { id: 'vegetables_eggplant', file: './assets/stickers/vegetables_eggplant.png', scale: 1.02 },
      { id: 'vegetables_pepper',   file: './assets/stickers/vegetables_pepper.png',   scale: 0.98 },
    ],
  },
  {
    id: 'vehicles',
    frameColor: '#d4e1ec',
    linerColor: '#f3f6f8',
    accentRim: '#b0c5d8',
    items: [
      { id: 'vehicles_firetruck', file: './assets/stickers/vehicles_firetruck.png', scale: 1.12 },
      { id: 'vehicles_schoolbus', file: './assets/stickers/vehicles_schoolbus.png', scale: 1.12 },
      { id: 'vehicles_dumptruck', file: './assets/stickers/vehicles_dumptruck.png', scale: 1.10 },
      { id: 'vehicles_redcar',    file: './assets/stickers/vehicles_redcar.png',    scale: 1.08 },
      { id: 'vehicles_bluesuv',   file: './assets/stickers/vehicles_bluesuv.png',   scale: 1.08 },
      { id: 'vehicles_airplane',  file: './assets/stickers/vehicles_airplane.png',  scale: 1.14 },
    ],
  },
];

function loadTexture(loader, url, { srgb = false, repeat = null, anisotropy = 8 } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.anisotropy = anisotropy;
        if (repeat) {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(repeat[0], repeat[1]);
        }
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      (err) => reject(new Error(`Failed texture ${url}: ${err?.message || err}`))
    );
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed image ${url}`));
    img.src = url;
  });
}

function createSoftShadowTexture(type = 'radial') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (type === 'radial') {
    const g = ctx.createRadialGradient(128, 128, 22, 128, 128, 124);
    g.addColorStop(0.0, 'rgba(22, 15, 10, 0.52)');
    g.addColorStop(0.55, 'rgba(22, 15, 10, 0.24)');
    g.addColorStop(0.82, 'rgba(22, 15, 10, 0.06)');
    g.addColorStop(1.0, 'rgba(22, 15, 10, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  } else {
    // Soft rounded rectangle ambient occlusion shadow
    ctx.clearRect(0, 0, 256, 256);
    const pad = 26;
    const rad = 18;
    ctx.save();
    ctx.shadowColor = 'rgba(18, 12, 7, 0.65)';
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(18, 12, 7, 0.55)';
    ctx.beginPath();
    ctx.roundRect(pad, pad, 256 - pad * 2, 256 - pad * 2, rad);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Create a realistic embossed metallic gold-foil star seal texture (color + bump/normal + roughness)
 * used as Mom's real physical reward seal pressed onto completed pages.
 */
export function createGoldSealTextures() {
  const size = 256;
  const col = document.createElement('canvas');
  col.width = size; col.height = size;
  const cctx = col.getContext('2d');

  const bump = document.createElement('canvas');
  bump.width = size; bump.height = size;
  const bctx = bump.getContext('2d');

  const cx = size / 2, cy = size / 2;

  function traceScallopedCircle(ctx, rOuter, rInner, teeth) {
    ctx.beginPath();
    const steps = teeth * 4;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const wave = 0.5 + 0.5 * Math.cos(a * teeth);
      const r = rInner + (rOuter - rInner) * Math.pow(wave, 0.65);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function traceStar(ctx, rOuter, rInner, pts = 5) {
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / pts;
      const r = i % 2 === 0 ? rOuter : rInner;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Foil metallic warm gold gradient
  cctx.clearRect(0, 0, size, size);
  traceScallopedCircle(cctx, 114, 102, 24);
  const grad = cctx.createLinearGradient(24, 24, 232, 232);
  grad.addColorStop(0.0, '#f3d27a');
  grad.addColorStop(0.32, '#d8a63c');
  grad.addColorStop(0.55, '#fae19c');
  grad.addColorStop(0.78, '#c7922c');
  grad.addColorStop(1.0, '#e5bc5b');
  cctx.fillStyle = grad;
  cctx.fill();

  // Subtle foil rim & inner ring
  cctx.strokeStyle = 'rgba(130, 88, 16, 0.45)';
  cctx.lineWidth = 3;
  cctx.stroke();

  cctx.beginPath();
  cctx.arc(cx, cy, 86, 0, Math.PI * 2);
  cctx.strokeStyle = 'rgba(255, 245, 200, 0.65)';
  cctx.lineWidth = 2.5;
  cctx.stroke();

  // Embossed 5-point star with facets
  traceStar(cctx, 68, 29, 5);
  const sgrad = cctx.createLinearGradient(cx - 50, cy - 50, cx + 50, cy + 50);
  sgrad.addColorStop(0, '#fff0b8');
  sgrad.addColorStop(0.5, '#dfad42');
  sgrad.addColorStop(1, '#b8821e');
  cctx.fillStyle = sgrad;
  cctx.fill();
  cctx.strokeStyle = 'rgba(120, 78, 10, 0.4)';
  cctx.lineWidth = 2;
  cctx.stroke();

  // Bump map for physical foil embossing
  bctx.fillStyle = '#000000';
  bctx.fillRect(0, 0, size, size);
  traceScallopedCircle(bctx, 114, 102, 24);
  bctx.fillStyle = '#707070';
  bctx.fill();
  bctx.beginPath();
  bctx.arc(cx, cy, 86, 0, Math.PI * 2);
  bctx.strokeStyle = '#c8c8c8';
  bctx.lineWidth = 5;
  bctx.stroke();
  traceStar(bctx, 68, 29, 5);
  bctx.fillStyle = '#f0f0f0';
  bctx.fill();

  const colorTex = new THREE.CanvasTexture(col);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 8;

  const bumpTex = new THREE.CanvasTexture(bump);
  bumpTex.colorSpace = THREE.NoColorSpace;

  return { colorTex, bumpTex, image: col };
}

/**
 * Generates a subtle real paper-fiber micro-bump texture for glossy sticker laminate
 * so stickers have realistic slight coated-paper surface micro-variation instead of sterile CG mirror.
 */
function createStickerMicroRoughness() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 256 * 256; i++) {
    const v = Math.floor(42 + rand() * 24); // ~0.16..0.26 roughness
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export async function loadAllAssets(renderer) {
  const texLoader = new THREE.TextureLoader();
  const gltfLoader = new GLTFLoader();
  const hdrLoader = new HDRLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const [
    hdrRaw,
    woodDiff, woodNor, woodRough, woodArm,
    paper1Col, paper1Nor, paper1Rough,
    paper5Col, paper5Nor, paper5Rough,
    paper6Col, paper6Nor, paper6Rough,
    stationeryGltf, teaSetGltf, plantGltf,
  ] = await Promise.all([
    hdrLoader.loadAsync('./assets/hdri/lebombo_1k.hdr'),
    loadTexture(texLoader, './assets/textures/oak_veneer_01/oak_veneer_01_Diffuse_1k.jpg', { srgb: true, repeat: [4.6, 3.8], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/oak_veneer_01/oak_veneer_01_nor_gl_1k.jpg',  { srgb: false, repeat: [4.6, 3.8], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/oak_veneer_01/oak_veneer_01_Rough_1k.jpg',   { srgb: false, repeat: [4.6, 3.8], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/oak_veneer_01/oak_veneer_01_arm_1k.jpg',     { srgb: false, repeat: [4.6, 3.8], anisotropy: maxAniso }),

    loadTexture(texLoader, './assets/textures/Paper001/Paper001_1K-JPG_Color.jpg',     { srgb: true,  repeat: [2.2, 1.7], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/Paper001/Paper001_1K-JPG_NormalGL.jpg',  { srgb: false, repeat: [2.2, 1.7], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/Paper001/Paper001_1K-JPG_Roughness.jpg', { srgb: false, repeat: [2.2, 1.7], anisotropy: maxAniso }),

    loadTexture(texLoader, './assets/textures/Paper005/Paper005_1K-JPG_Color.jpg',     { srgb: true,  repeat: [1.2, 1.0], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/Paper005/Paper005_1K-JPG_NormalGL.jpg',  { srgb: false, repeat: [1.2, 1.0], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/Paper005/Paper005_1K-JPG_Roughness.jpg', { srgb: false, repeat: [1.2, 1.0], anisotropy: maxAniso }),

    loadTexture(texLoader, './assets/textures/Paper006/Paper006_1K-JPG_Color.jpg',     { srgb: true,  repeat: [1.4, 1.1], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/Paper006/Paper006_1K-JPG_NormalGL.jpg',  { srgb: false, repeat: [1.4, 1.1], anisotropy: maxAniso }),
    loadTexture(texLoader, './assets/textures/Paper006/Paper006_1K-JPG_Roughness.jpg', { srgb: false, repeat: [1.4, 1.1], anisotropy: maxAniso }),

    gltfLoader.loadAsync('./assets/models/stationery_supplies/stationery_supplies_1k.gltf'),
    gltfLoader.loadAsync('./assets/models/tea_set_01/tea_set_01_1k.gltf'),
    gltfLoader.loadAsync('./assets/models/potted_plant_04/potted_plant_04_1k.gltf'),
  ]);

  const envRT = pmrem.fromEquirectangular(hdrRaw);
  const envMap = envRT.texture;
  hdrRaw.dispose();
  pmrem.dispose();

  // Load all 18 sticker images & create textures
  const stickers = {};
  const stickerPromises = [];
  for (const sheet of STICKER_SHEETS_DEF) {
    for (const item of sheet.items) {
      stickerPromises.push(
        loadImage(item.file).then((img) => {
          const tex = new THREE.Texture(img);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = maxAniso;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.needsUpdate = true;
          stickers[item.id] = { ...item, sheetId: sheet.id, image: img, texture: tex };
        })
      );
    }
  }
  await Promise.all(stickerPromises);

  const goldSeal = createGoldSealTextures();

  return {
    envMap,
    wood: { map: woodDiff, normalMap: woodNor, roughnessMap: woodRough, armMap: woodArm },
    paperWhite: { map: paper1Col, normalMap: paper1Nor, roughnessMap: paper1Rough },
    paperKraftCover: { map: paper5Col, normalMap: paper5Nor, roughnessMap: paper5Rough },
    paperBeige: { map: paper6Col, normalMap: paper6Nor, roughnessMap: paper6Rough },
    models: {
      stationery: stationeryGltf.scene,
      teaSet: teaSetGltf.scene,
      plant: plantGltf.scene,
    },
    stickers,
    goldSeal,
    stickerMicroRoughness: createStickerMicroRoughness(),
    shadowRadial: createSoftShadowTexture('radial'),
    shadowRect: createSoftShadowTexture('rect'),
  };
}
