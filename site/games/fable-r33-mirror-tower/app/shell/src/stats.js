// 三角形・draw call・テクスチャ・GPUメモリの見積もり（?debug=1 と煙テストで使う）
import THREE from './three.js';

function visibleChain(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

// 静的な数え上げ：見えている Mesh の三角形（Instanced は個数倍）と draw call 数
export function countGroup(root) {
  let tris = 0, calls = 0;
  root.traverse((o) => {
    if (!o.isMesh || !visibleChain(o)) return;
    const g = o.geometry;
    if (!g || !g.attributes.position) return;
    let n = g.index ? g.index.count : g.attributes.position.count;
    n = Math.min(n, g.drawRange.count === Infinity ? n : g.drawRange.count);
    const inst = o.isInstancedMesh ? o.count : 1;
    const mats = Array.isArray(o.material) ? o.material.length : 1;
    if (inst > 0) { tris += Math.floor(n / 3) * inst; calls += mats; }
  });
  return { tris, calls };
}

const MAP_KEYS = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'emissiveMap', 'envMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap', 'specularMap', 'displacementMap'];

function texBytes(t) {
  const img = t.image || (t.source && t.source.data);
  if (!img) return { w: 0, h: 0, bytes: 0 };
  const w = img.naturalWidth || img.videoWidth || img.width || 0, h = img.naturalHeight || img.videoHeight || img.height || 0;
  const mip = t.generateMipmaps !== false && t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter ? 4 / 3 : 1;
  return { w, h, bytes: w * h * 4 * mip };
}

export function collectTextures(root, extra = []) {
  const bySource = new Map();
  const add = (t, owner) => {
    if (!t || !t.isTexture) return;
    const key = t.source || t;
    if (!bySource.has(key)) bySource.set(key, { tex: t, owner, ...texBytes(t) });
  };
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of MAP_KEYS) add(m[k], o);
  });
  for (const t of extra) add(t, null);
  return [...bySource.values()];
}

function geoBytes(root) {
  const seen = new Set();
  let bytes = 0;
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array ? a.array.byteLength : 0;
      if (o.geometry.index) bytes += o.geometry.index.array.byteLength;
    }
    if (o.isInstancedMesh) {
      bytes += o.instanceMatrix.array.byteLength;
      if (o.instanceColor) bytes += o.instanceColor.array.byteLength;
    }
  });
  return bytes;
}

// GPU メモリ見積もり（MSAA なし）。フレームバッファは色×3（表・裏・合成）＋深度で 16B/px と安全側に見る。
// 共有テクスチャ（疑似影など）は hero の4枚に数えず、シェル側に数える。
export function estimate({ renderer, scene, heroRoot, envTexture, sharedTextures = [] }) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const fb = size.x * size.y * 16;
  const sharedSrc = new Set(sharedTextures.map((t) => t.source));
  const heroTex = heroRoot ? collectTextures(heroRoot).filter((t) => !sharedSrc.has(t.tex.source)) : [];
  const heroSources = new Set(heroTex.map((t) => t.tex.source));
  const allTex = collectTextures(scene, envTexture ? [envTexture] : []);
  const otherTex = allTex.filter((t) => !heroSources.has(t.tex.source));
  // 環境マップの PMREM：256² キューブ×6面、HalfFloat RGBA (8B)、mip 込み 4/3、作業用にもう1枚
  const pmrem = envTexture ? 256 * 256 * 6 * 8 * (4 / 3) * 2 : 0;
  const heroGeo = heroRoot ? geoBytes(heroRoot) : 0;
  const allGeo = geoBytes(scene);
  const sum = (a) => a.reduce((s, t) => s + t.bytes, 0);
  const hero = heroRoot ? countGroup(heroRoot) : { tris: 0, calls: 0 };
  const all = countGroup(scene);
  const MB = 1024 * 1024;
  const r = {
    drawingBuffer: [size.x, size.y],
    tris: { hero: hero.tris, other: all.tris - hero.tris, total: all.tris },
    calls: { hero: hero.calls, other: all.calls - hero.calls, total: all.calls },
    textures: {
      hero: heroTex.map((t) => `${t.tex.name || '?'} ${t.w}x${t.h}`),
      other: otherTex.map((t) => `${t.tex.name || '?'} ${t.w}x${t.h}`),
    },
    mb: {
      heroTex: sum(heroTex) / MB, otherTex: sum(otherTex) / MB, pmrem: pmrem / MB,
      heroGeo: heroGeo / MB, otherGeo: (allGeo - heroGeo) / MB, framebuffer: fb / MB,
    },
  };
  r.mb.total = Object.values(r.mb).reduce((a, b) => a + b, 0);
  return r;
}

// NaN の見張り（?debug=1 と煙テスト）：カメラと場面の行列、Instanced の行列に 有限でない数 がいくつあるか。
// 1つでも入ると、その物（や画面全体）が黒く・消えて見える。
export function countNaN(scene, camera) {
  let bad = 0;
  const scan = (arr) => { for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) bad++; };
  if (camera) { scan(camera.matrixWorld.elements); scan(camera.projectionMatrix.elements); }
  scene.traverse((o) => {
    scan(o.matrixWorld.elements);
    if (o.isInstancedMesh) scan(o.instanceMatrix.array.subarray(0, o.count * 16));
  });
  return bad;
}
