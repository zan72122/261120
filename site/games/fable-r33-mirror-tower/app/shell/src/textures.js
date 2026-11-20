// テクスチャ読み込み。http(s) は .jpg、file:// は data URL を入れた .jpg.js（classic script）を読む。
// （file:// の Chrome は <img> 由来の画像を WebGL に渡せないため）
import THREE from './three.js';

const BASE = 'assets/tex/';
const isFile = location.protocol === 'file:';

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => { s.remove(); res(); };
    s.onerror = () => { s.remove(); rej(new Error('読み込み失敗: ' + src)); };
    document.head.appendChild(s);
  });
}

async function imageURL(file) {
  if (!isFile) return BASE + file;
  window.MT_TEX = window.MT_TEX || {};
  if (!window.MT_TEX[file]) await loadScript(BASE + file + '.js');
  const url = window.MT_TEX[file];
  delete window.MT_TEX[file]; // 文字列を早めに手放す
  if (!url) throw new Error('data URL なし: ' + file);
  return url;
}

export function createTextureStore(renderer, tier, onError) {
  const cache = new Map();
  const pending = new Set();
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  // 画像が届く前に clone すると three が空の画像を転送しようとして警告が出るので、
  // clone は必ずここを通し、届いた時に全部の variant を needsUpdate にする。
  function makeVariant(file) {
    const entry = cache.get(file);
    const t = THREE.Texture.prototype.clone.call(entry.base);
    if (!entry.loaded) t.version = 0;
    t.clone = () => makeVariant(file);
    entry.variants.push(t);
    t.addEventListener('dispose', () => { const i = entry.variants.indexOf(t); if (i >= 0) entry.variants.splice(i, 1); });
    return t;
  }

  function loadFile(file, { srgb = true, repeat = true } = {}) {
    if (cache.has(file)) return cache.get(file).base;
    const tex = new THREE.Texture();
    tex.name = file;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAniso;
    const entry = { base: tex, variants: [], loaded: false };
    tex.clone = () => makeVariant(file);
    cache.set(file, entry);
    const p = imageURL(file).then((url) => new Promise((res, rej) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        tex.image = img; tex.needsUpdate = true; entry.loaded = true;
        for (const v of entry.variants) v.needsUpdate = true;
        res();
      };
      img.onerror = () => rej(new Error('画像デコード失敗: ' + file));
      img.src = url;
    })).catch((e) => onError(e)).finally(() => pending.delete(p));
    pending.add(p);
    return tex;
  }

  // hero 用：名前 → tier に応じた大きさ
  const HERO_TEX = { brass_frame: true, prism_rainbow: true };
  function loadHeroTexture(name) {
    if (!HERO_TEX[name]) { onError(new Error('hero が使えないテクスチャ名: ' + name)); return null; }
    return loadFile(`${name}_${tier === 'low' ? 512 : 1024}.jpg`);
  }

  return {
    loadFile,
    loadHeroTexture,
    whenIdle: () => Promise.all([...pending]),
    get pendingCount() { return pending.size; },
    all: () => [...cache.values()].flatMap((e) => [e.base, ...e.variants]),
  };
}

// ---- 手続きの Canvas テクスチャ ----
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// 疑似影：白→透明のぼかし円（色は材質の color で決める）
export function makeBlobTexture() {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.name = 'blob-shadow';
  return t;
}

// 合図の輪：やわらかい光の輪。内と外にうすい茶色のふちを入れて、明るい床の上でも暗い所でも見えるように
export function makeRingTexture() {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 26, 64, 64, 63);
  grd.addColorStop(0, 'rgba(120,60,10,0)');
  grd.addColorStop(0.28, 'rgba(120,60,10,0.32)');
  grd.addColorStop(0.42, 'rgba(255,214,90,1)');
  grd.addColorStop(0.56, 'rgba(255,255,236,1)');
  grd.addColorStop(0.7, 'rgba(255,200,80,0.95)');
  grd.addColorStop(0.84, 'rgba(120,60,10,0.3)');
  grd.addColorStop(1, 'rgba(120,60,10,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.name = 'hint-ring';
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 合図の手：人さし指を立てた白い手（茶色のふち）。指先はテクスチャの (0.4, 0.06) あたり（hint.js の HAND_TIP）
export function makeHandTexture() {
  const [c, g] = canvas(128, 128);
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const shapes = [
    () => rr(40, 6, 21, 70, 10.5),                                  // 人さし指（左寄り、親指の隣）
    () => rr(36, 54, 60, 62, 20),                                   // 手のひら
    () => rr(59, 48, 16, 32, 8),                                    // にぎった指 3 本
    () => rr(73, 53, 15, 30, 7.5),
    () => rr(86, 59, 13, 28, 6.5),
    () => { g.beginPath(); g.ellipse(33, 86, 9, 21, -0.6, 0, Math.PI * 2); }, // 親指
  ];
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(60,30,0,0.35)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  g.strokeStyle = '#7a4512'; g.lineWidth = 10;
  for (const sh of shapes) { sh(); g.stroke(); }
  g.shadowColor = 'transparent';
  g.fillStyle = '#fffaf0';
  for (const sh of shapes) { sh(); g.fill(); }
  // 指の境目と爪（ほんの少し）
  g.strokeStyle = 'rgba(122,69,18,0.6)'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(73, 60); g.lineTo(73, 80); g.moveTo(86, 64); g.lineTo(86, 82); g.moveTo(60, 56); g.lineTo(60, 80); g.stroke();
  g.fillStyle = 'rgba(255,190,170,0.9)';
  rr(44, 10, 13, 13, 5.5); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.name = 'hint-hand';
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 環境マップ：空のグラデーション（equirect 256×128 → three が自動で PMREM 化）
export function makeEnvTexture() {
  const [c, g] = canvas(256, 128);
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.0, '#7fa6dc');
  grd.addColorStop(0.35, '#b9c8ea');
  grd.addColorStop(0.49, '#f6cdb8');
  grd.addColorStop(0.52, '#c9b49a');
  grd.addColorStop(0.7, '#6f8a52');
  grd.addColorStop(1.0, '#4d6a3a');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  // 太陽のにじみ（金属に暖かいハイライト）
  const sun = g.createRadialGradient(170, 40, 0, 170, 40, 26);
  sun.addColorStop(0, 'rgba(255,248,225,1)');
  sun.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = sun; g.fillRect(130, 10, 80, 60);
  const t = new THREE.CanvasTexture(c);
  t.name = 'env-gradient';
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
