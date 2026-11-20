// エラー収集・フレーム統計・GPU メモリ見積もり・?debug=1 オーバーレイ。

export class ErrorLog {
  constructor() {
    this.list = []; this.warnings = 0;
    window.addEventListener('error', (e) => this.add('error', e.message || String(e.error || e.type)));
    window.addEventListener('unhandledrejection', (e) => this.add('promise', String(e.reason && e.reason.message || e.reason)));
    const ce = console.error.bind(console), cw = console.warn.bind(console);
    console.error = (...a) => { this.add('console', a.map(String).join(' ')); ce(...a); };
    console.warn = (...a) => { this.warnings++; cw(...a); };
  }
  add(kind, msg) {
    this.list.push({ kind, msg: String(msg).slice(0, 300), t: performance.now() });
    if (this.list.length > 50) this.list.shift();
  }
}

export class FrameStats {
  constructor(n = 180) { this.ms = new Float32Array(n); this.cpu = new Float32Array(n); this.i = 0; this.count = 0; this.calls = 0; this.tris = 0; }
  // ms：フレームの間隔、cpu：そのフレームの JS（入力→hero.update→描画命令の発行）にかかった時間
  push(ms, info, cpu = 0) {
    this.ms[this.i] = ms; this.cpu[this.i] = cpu; this.i = (this.i + 1) % this.ms.length; this.count = Math.min(this.count + 1, this.ms.length);
    if (info) { this.calls = info.render.calls; this.tris = info.render.triangles; }
  }
  summary() {
    const n = this.count; if (!n) return { fps: 0, p95ms: 0, meanMs: 0, cpuMs: 0, cpuP95: 0 };
    const a = Array.from(this.ms.subarray(0, n)).sort((x, y) => x - y);
    const mean = a.reduce((s, v) => s + v, 0) / n;
    const p95 = a[Math.min(n - 1, Math.floor(n * 0.95))];
    const c = Array.from(this.cpu.subarray(0, n)).sort((x, y) => x - y);
    const cpuMs = c.reduce((s, v) => s + v, 0) / n, cpuP95 = c[Math.min(n - 1, Math.floor(n * 0.95))];
    return { fps: 1000 / Math.max(1e-3, mean), p95ms: p95, meanMs: mean, p95fps: 1000 / Math.max(1e-3, p95), cpuMs, cpuP95 };
  }
}

const TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap', 'lightMap', 'envMap', 'matcap', 'specularMap', 'displacementMap', 'gradientMap'];

function texBytes(t) {
  if (t.isRenderTargetTexture) return 0; // RenderTarget（環境マップ）は呼び出し側で別に数える
  const img = t.image || {};
  const w = img.width || img.videoWidth || 0, h = img.height || img.videoHeight || 0;
  const bpp = t.type === 1016 /* HalfFloatType */ ? 8 : t.type === 1015 /* FloatType */ ? 16 : 4;
  const mips = t.generateMipmaps && t.minFilter >= 1004 && !t.isRenderTargetTexture ? 4 / 3 : 1;
  return w * h * bpp * mips;
}

// root 以下の形と三角形・テクスチャを数える（画面外も含む静的な値）。
export function countResources(root, extraTextures = []) {
  const geos = new Set(), texKeys = new Map();
  let tris = 0, geoBytes = 0, meshes = 0;
  const addTex = (t) => {
    if (!t || !t.isTexture) return;
    const key = (t.source ? t.source.uuid : t.uuid) + ':' + t.wrapS + ':' + t.wrapT + ':' + t.minFilter + ':' + t.colorSpace;
    if (!texKeys.has(key)) texKeys.set(key, t);
  };
  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine)) return;
    const g = o.geometry; if (!g) return;
    meshes++;
    const inst = o.isInstancedMesh ? o.count : 1;
    if (o.isMesh && o.visible) {
      const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
      const dr = g.drawRange; const c = Math.min(n, dr.count === Infinity ? n : dr.count);
      tris += (c / 3) * inst;
    }
    if (!geos.has(g)) {
      geos.add(g);
      for (const k in g.attributes) geoBytes += g.attributes[k].array.byteLength;
      if (g.index) geoBytes += g.index.array.byteLength;
    }
    if (o.isInstancedMesh) { geoBytes += o.instanceMatrix.array.byteLength; if (o.instanceColor) geoBytes += o.instanceColor.array.byteLength; }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) { if (!m) continue; for (const k of TEX_KEYS) addTex(m[k]); if (m.uniforms) for (const u in m.uniforms) addTex(m.uniforms[u].value); }
  });
  for (const t of extraTextures) addTex(t);
  let texBytesSum = 0, maxTex = 0;
  for (const t of texKeys.values()) { texBytesSum += texBytes(t); const im = t.image || {}; maxTex = Math.max(maxTex, im.width || 0, im.height || 0); }
  return { tris: Math.round(tris), meshes, geoBytes, textures: texKeys.size, texBytes: texBytesSum, maxTex };
}

export function framebufferBytes(w, h, samples) {
  const px = w * h, s = Math.max(1, samples);
  return px * 8 * s + (s > 1 ? px * 4 : 0) + px * 4;
}

const MiB = 1024 * 1024;
export function fmtMiB(b) { return (b / MiB).toFixed(1); }

export class DebugOverlay {
  constructor(container, actions) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    this.text = document.createElement('pre');
    const bar = document.createElement('div');
    for (const [label, fn] of Object.entries(actions)) {
      const b = document.createElement('button'); b.textContent = label;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(); });
      bar.appendChild(b);
    }
    this.el.append(this.text, bar);
    container.appendChild(this.el);
    this.acc = 0;
  }
  update(dt, getText) {
    this.acc += dt; if (this.acc < 0.25) return; this.acc = 0;
    this.text.textContent = getText();
  }
}
