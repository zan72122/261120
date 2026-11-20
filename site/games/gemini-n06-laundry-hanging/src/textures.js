import * as THREE from 'three';

const loader = new THREE.TextureLoader();

export async function loadTextureAsync(url, { srgb = false, repeat = [1, 1], anisotropy = 4 } = {}) {
  const tex = await loader.loadAsync(url);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  return tex;
}

export async function loadPolyHavenPBRAsync(
  folder,
  { repeat = [1, 1], anisotropy = 4, diffuseFile = 'diffuse.jpg' } = {}
) {
  const base = `./assets/textures/${folder}`;
  const [map, normalMap, armMap] = await Promise.all([
    loadTextureAsync(`${base}/${diffuseFile}`, { srgb: true, repeat, anisotropy }),
    loadTextureAsync(`${base}/nor_gl.jpg`, { srgb: false, repeat, anisotropy }),
    loadTextureAsync(`${base}/arm.jpg`, { srgb: false, repeat, anisotropy }),
  ]);
  return {
    map,
    normalMap,
    aoMap: armMap,
    roughnessMap: armMap,
  };
}

export async function loadMetal032PBRAsync({ repeat = [1, 1], anisotropy = 4 } = {}) {
  const base = './assets/textures/metal032';
  const [map, normalMap, roughnessMap, metalnessMap] = await Promise.all([
    loadTextureAsync(`${base}/color.jpg`, { srgb: true, repeat, anisotropy }),
    loadTextureAsync(`${base}/normalgl.jpg`, { srgb: false, repeat, anisotropy }),
    loadTextureAsync(`${base}/roughness.jpg`, { srgb: false, repeat, anisotropy }),
    loadTextureAsync(`${base}/metalness.jpg`, { srgb: false, repeat, anisotropy }),
  ]);
  return { map, normalMap, roughnessMap, metalnessMap };
}

let cachedContactTex = null;
export function getContactShadowTexture() {
  if (cachedContactTex) return cachedContactTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.49);
  g.addColorStop(0.0, 'rgba(18, 22, 28, 0.72)');
  g.addColorStop(0.45, 'rgba(18, 22, 28, 0.38)');
  g.addColorStop(0.78, 'rgba(18, 22, 28, 0.10)');
  g.addColorStop(1.0, 'rgba(18, 22, 28, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cachedContactTex = new THREE.CanvasTexture(canvas);
  cachedContactTex.colorSpace = THREE.SRGBColorSpace;
  return cachedContactTex;
}

export function createContactShadow(width, depth, opacity = 0.56) {
  const geo = new THREE.PlaneGeometry(width, depth);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}
