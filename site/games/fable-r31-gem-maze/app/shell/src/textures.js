import { THREE } from './three.js';

// 共有テクスチャ（hero にも opts.getTexture で渡す）。名前 → ファイル。
export const TEXTURE_MANIFEST = {
  sky_pastel: 'sky_pastel_512.jpg',
  felt_teal: 'felt_teal_512.jpg',
  wood_table: 'wood_table_512.jpg',
  brass_ring: 'brass_ring_1024.jpg',
  gem_facets: 'gem_facets_1024.jpg',
};
const FALLBACK_COLOR = { sky_pastel: '#bcd0f5', felt_teal: '#2f8c7d', wood_table: '#e2a868', brass_ring: '#c8a046', gem_facets: '#d0406a' };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('script load failed: ' + src));
    document.head.appendChild(s);
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    // decode() は画像の展開を別スレッドで済ませる（WebGL へ渡すときにメインスレッドで展開して止まるのを防ぐ）
    img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(img));
    img.onerror = () => reject(new Error('image load failed: ' + src.slice(0, 60)));
    img.src = src;
  });
}

// file:// では画像が「別オリジン」扱いで WebGL に渡せないため、data URI 版（assets/textures.js）を使う。
export async function loadSharedTextures(anisotropy, onError) {
  const isFile = location.protocol === 'file:';
  if (isFile && !window.GEM_TEXTURE_DATA) {
    try { await loadScript('assets/textures.js'); } catch (e) { onError(e); }
  }
  const out = {};
  await Promise.all(Object.entries(TEXTURE_MANIFEST).map(async ([name, file]) => {
    let img = null;
    const data = window.GEM_TEXTURE_DATA && window.GEM_TEXTURE_DATA[file];
    try { img = await loadImage(isFile && data ? data : 'assets/' + file); }
    catch (e) {
      onError(e);
      if (data) { try { img = await loadImage(data); } catch (e2) { onError(e2); } }
    }
    const tex = img ? new THREE.Texture(img) : solidTexture(FALLBACK_COLOR[name]);
    tex.name = name;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
    out[name] = tex;
  }));
  return out;
}

function solidTexture(color) {
  return canvasTexture(4, 4, (g) => { g.fillStyle = color; g.fillRect(0, 0, 4, 4); });
}

// 手続き Canvas テクスチャ（ミップあり、sRGB）。
export function canvasTexture(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
