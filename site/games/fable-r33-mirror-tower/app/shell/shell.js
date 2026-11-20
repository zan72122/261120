/* 自動生成（tools/build.mjs）。直接編集しない。src-hash:26e9b4f199 */
var MirrorTowerShell = (() => {
  // app/shell/src/three.js
  var THREE = globalThis.THREE;
  if (!THREE) throw new Error("THREE が読み込まれていません（vendor/three.min.js）");
  var three_default = THREE;

  // app/shell/src/tier.js
  var TIERS = {
    high: { dprCap: 1.5, maxPixels: 26e5, scale: 1, trees: true },
    mid: { dprCap: 1, maxPixels: 16e5, scale: 1, trees: true },
    low: { dprCap: 1, maxPixels: 9e5, scale: 0.75, trees: false }
  };
  var TIER_ORDER = ["high", "mid", "low"];
  function detectTier(params2) {
    const isMobile = (navigator.maxTouchPoints || 0) > 1;
    let tier = isMobile ? "mid" : "high";
    const q = params2.get("tier");
    if (q && TIERS[q]) tier = q;
    return { isMobile, tier, forced: !!(q && TIERS[q]) };
  }
  function pixelRatioFor(tier, isMobile, cssW, cssH) {
    const t = TIERS[tier];
    let dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, t.dprCap);
    dpr *= t.scale;
    const px = Math.max(1, cssW * cssH * dpr * dpr);
    if (px > t.maxPixels) dpr *= Math.sqrt(t.maxPixels / px);
    return Math.max(0.25, dpr);
  }
  function createTierGovernor(initialTier, onChange, { enabled = true } = {}) {
    let tier = initialTier;
    let t = 0, winT = 0, winFrames = 0, lastChange = -1e9;
    return {
      get tier() {
        return tier;
      },
      frame(dt) {
        t += dt;
        if (!enabled || t < 3) return;
        winT += dt;
        winFrames++;
        if (winT >= 4) {
          const fps = winFrames / winT;
          winT = 0;
          winFrames = 0;
          const i = TIER_ORDER.indexOf(tier);
          if (fps < 40 && i < TIER_ORDER.length - 1 && t - lastChange > 6) {
            tier = TIER_ORDER[i + 1];
            lastChange = t;
            onChange(tier, fps);
          }
        }
      }
    };
  }

  // app/shell/src/textures.js
  var BASE = "assets/tex/";
  var isFile = location.protocol === "file:";
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => {
        s.remove();
        res();
      };
      s.onerror = () => {
        s.remove();
        rej(new Error("読み込み失敗: " + src));
      };
      document.head.appendChild(s);
    });
  }
  async function imageURL(file) {
    if (!isFile) return BASE + file;
    window.MT_TEX = window.MT_TEX || {};
    if (!window.MT_TEX[file]) await loadScript(BASE + file + ".js");
    const url = window.MT_TEX[file];
    delete window.MT_TEX[file];
    if (!url) throw new Error("data URL なし: " + file);
    return url;
  }
  function createTextureStore(renderer2, tier, onError) {
    const cache = /* @__PURE__ */ new Map();
    const pending = /* @__PURE__ */ new Set();
    const maxAniso = Math.min(4, renderer2.capabilities.getMaxAnisotropy());
    function makeVariant(file) {
      const entry = cache.get(file);
      const t = three_default.Texture.prototype.clone.call(entry.base);
      if (!entry.loaded) t.version = 0;
      t.clone = () => makeVariant(file);
      entry.variants.push(t);
      t.addEventListener("dispose", () => {
        const i = entry.variants.indexOf(t);
        if (i >= 0) entry.variants.splice(i, 1);
      });
      return t;
    }
    function loadFile(file, { srgb = true, repeat = true } = {}) {
      if (cache.has(file)) return cache.get(file).base;
      const tex = new three_default.Texture();
      tex.name = file;
      tex.colorSpace = srgb ? three_default.SRGBColorSpace : three_default.NoColorSpace;
      if (repeat) tex.wrapS = tex.wrapT = three_default.RepeatWrapping;
      tex.anisotropy = maxAniso;
      const entry = { base: tex, variants: [], loaded: false };
      tex.clone = () => makeVariant(file);
      cache.set(file, entry);
      const p = imageURL(file).then((url) => new Promise((res, rej) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          tex.image = img;
          tex.needsUpdate = true;
          entry.loaded = true;
          for (const v of entry.variants) v.needsUpdate = true;
          res();
        };
        img.onerror = () => rej(new Error("画像デコード失敗: " + file));
        img.src = url;
      })).catch((e) => onError(e)).finally(() => pending.delete(p));
      pending.add(p);
      return tex;
    }
    const HERO_TEX = { brass_frame: true, prism_rainbow: true };
    function loadHeroTexture(name) {
      if (!HERO_TEX[name]) {
        onError(new Error("hero が使えないテクスチャ名: " + name));
        return null;
      }
      return loadFile(`${name}_${tier === "low" ? 512 : 1024}.jpg`);
    }
    return {
      loadFile,
      loadHeroTexture,
      whenIdle: () => Promise.all([...pending]),
      get pendingCount() {
        return pending.size;
      },
      all: () => [...cache.values()].flatMap((e) => [e.base, ...e.variants])
    };
  }
  function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")];
  }
  function makeBlobTexture() {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.65)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new three_default.CanvasTexture(c);
    t.name = "blob-shadow";
    return t;
  }
  function makeRingTexture() {
    const [c, g] = canvas(128, 128);
    const grd = g.createRadialGradient(64, 64, 26, 64, 64, 63);
    grd.addColorStop(0, "rgba(120,60,10,0)");
    grd.addColorStop(0.28, "rgba(120,60,10,0.32)");
    grd.addColorStop(0.42, "rgba(255,214,90,1)");
    grd.addColorStop(0.56, "rgba(255,255,236,1)");
    grd.addColorStop(0.7, "rgba(255,200,80,0.95)");
    grd.addColorStop(0.84, "rgba(120,60,10,0.3)");
    grd.addColorStop(1, "rgba(120,60,10,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new three_default.CanvasTexture(c);
    t.name = "hint-ring";
    t.colorSpace = three_default.SRGBColorSpace;
    return t;
  }
  function makeHandTexture() {
    const [c, g] = canvas(128, 128);
    const rr = (x, y, w, h, r) => {
      g.beginPath();
      g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
    };
    const shapes = [
      () => rr(40, 6, 21, 70, 10.5),
      // 人さし指（左寄り、親指の隣）
      () => rr(36, 54, 60, 62, 20),
      // 手のひら
      () => rr(59, 48, 16, 32, 8),
      // にぎった指 3 本
      () => rr(73, 53, 15, 30, 7.5),
      () => rr(86, 59, 13, 28, 6.5),
      () => {
        g.beginPath();
        g.ellipse(33, 86, 9, 21, -0.6, 0, Math.PI * 2);
      }
      // 親指
    ];
    g.lineJoin = "round";
    g.shadowColor = "rgba(60,30,0,0.35)";
    g.shadowBlur = 6;
    g.shadowOffsetY = 3;
    g.strokeStyle = "#7a4512";
    g.lineWidth = 10;
    for (const sh of shapes) {
      sh();
      g.stroke();
    }
    g.shadowColor = "transparent";
    g.fillStyle = "#fffaf0";
    for (const sh of shapes) {
      sh();
      g.fill();
    }
    g.strokeStyle = "rgba(122,69,18,0.6)";
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(73, 60);
    g.lineTo(73, 80);
    g.moveTo(86, 64);
    g.lineTo(86, 82);
    g.moveTo(60, 56);
    g.lineTo(60, 80);
    g.stroke();
    g.fillStyle = "rgba(255,190,170,0.9)";
    rr(44, 10, 13, 13, 5.5);
    g.fill();
    const t = new three_default.CanvasTexture(c);
    t.name = "hint-hand";
    t.colorSpace = three_default.SRGBColorSpace;
    return t;
  }
  function makeEnvTexture() {
    const [c, g] = canvas(256, 128);
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, "#7fa6dc");
    grd.addColorStop(0.35, "#b9c8ea");
    grd.addColorStop(0.49, "#f6cdb8");
    grd.addColorStop(0.52, "#c9b49a");
    grd.addColorStop(0.7, "#6f8a52");
    grd.addColorStop(1, "#4d6a3a");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
    const sun = g.createRadialGradient(170, 40, 0, 170, 40, 26);
    sun.addColorStop(0, "rgba(255,248,225,1)");
    sun.addColorStop(1, "rgba(255,240,210,0)");
    g.fillStyle = sun;
    g.fillRect(130, 10, 80, 60);
    const t = new three_default.CanvasTexture(c);
    t.name = "env-gradient";
    t.mapping = three_default.EquirectangularReflectionMapping;
    t.colorSpace = three_default.SRGBColorSpace;
    return t;
  }

  // app/shell/src/geo.js
  function grid(nu, nv, fn, flip = false) {
    const pos = [], nor = [], uv = [], col = [], idx = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const s = fn(i / nu, j / nv);
        pos.push(...s.p);
        nor.push(...s.n);
        uv.push(...s.uv);
        col.push(...s.c || [1, 1, 1]);
      }
    }
    const row = nu + 1;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
        if (flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
    const g = new three_default.BufferGeometry();
    g.setAttribute("position", new three_default.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new three_default.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new three_default.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new three_default.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }
  function merge(geoms) {
    let nv = 0, ni = 0;
    for (const g of geoms) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const g of geoms) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, vo * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
      if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
      else col.fill(1, vo * 3, (vo + n) * 3);
      if (g.index) {
        const a = g.index.array;
        for (let k = 0; k < a.length; k++) idx[io++] = a[k] + vo;
      } else for (let k = 0; k < n; k++) idx[io++] = k + vo;
      vo += n;
      g.dispose();
    }
    const out = new three_default.BufferGeometry();
    out.setAttribute("position", new three_default.BufferAttribute(pos, 3));
    out.setAttribute("normal", new three_default.BufferAttribute(nor, 3));
    out.setAttribute("uv", new three_default.BufferAttribute(uv, 2));
    out.setAttribute("color", new three_default.BufferAttribute(col, 3));
    out.setIndex(new three_default.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }
  function tint(g, r, gr, b) {
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = r;
      c[i * 3 + 1] = gr;
      c[i * 3 + 2] = b;
    }
    g.setAttribute("color", new three_default.BufferAttribute(c, 3));
    return g;
  }
  function scaleUV(g, su, sv) {
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * su, a.getY(i) * sv);
    return g;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = s + 1831565813 >>> 0;
      let t = s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // app/shell/src/world.js
  var TOWER = { inner: 4.2, outer: 4.6, height: 7.6 };
  var TILE = 2;
  function createWorld({ scene: scene2, textures: textures2, tier, shared: shared2 }) {
    const disposables = [];
    const keep = (o) => {
      disposables.push(o);
      return o;
    };
    const root = new three_default.Group();
    root.name = "world";
    scene2.add(root);
    const hemi = new three_default.HemisphereLight(14543103, 8362594, 1.7);
    const sun = new three_default.DirectionalLight(16773340, 2.1);
    sun.position.set(6, 11, 9);
    root.add(hemi, sun);
    scene2.background = new three_default.Color(15913668);
    scene2.fog = new three_default.Fog(15519682, 45, 280);
    const skyTex = textures2.loadFile("sky_dusk_512.jpg").clone();
    keep(skyTex);
    skyTex.wrapS = three_default.MirroredRepeatWrapping;
    skyTex.wrapT = three_default.ClampToEdgeWrapping;
    skyTex.repeat.set(4, 1);
    const skyGeo = keep(new three_default.SphereGeometry(320, 24, 9, 0, Math.PI * 2, 0, Math.PI * 0.56));
    const skyMat = keep(new three_default.MeshBasicMaterial({ map: skyTex, side: three_default.BackSide, fog: false, depthWrite: false }));
    const sky = new three_default.Mesh(skyGeo, skyMat);
    sky.renderOrder = -10;
    sky.name = "sky";
    root.add(sky);
    const grassTex = keep(textures2.loadFile("lawn_grass_512.jpg").clone());
    grassTex.repeat.set(110, 110);
    const groundGeo = keep(new three_default.CircleGeometry(230, 40));
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new three_default.Mesh(groundGeo, keep(new three_default.MeshLambertMaterial({ map: grassTex, color: 14215360 })));
    ground.position.y = -0.02;
    ground.name = "ground";
    root.add(ground);
    const r = rng(7);
    function hillRing(r0, r1, r2, hMin, hMax, phase, cLow, cTop) {
      const seg = 64;
      const hs = [];
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2;
        const n = 0.5 + 0.28 * Math.sin(a * 3 + phase) + 0.16 * Math.sin(a * 7 + phase * 2.1) + 0.06 * Math.sin(a * 13 + phase * 0.7);
        hs.push(hMin + (hMax - hMin) * Math.max(0, Math.min(1, n)));
      }
      hs[seg] = hs[0];
      return grid(seg, 2, (u, v) => {
        const i = Math.round(u * seg), a = u * Math.PI * 2;
        const rad = v === 0 ? r0 : v < 1 ? r1 : r2;
        const y = v === 0 ? -1 : v < 1 ? hs[i] : hs[i] * 0.5;
        const sx = Math.sin(a), cz = Math.cos(a);
        const k = v === 0 ? 0 : 1;
        const c = [cLow[0] + (cTop[0] - cLow[0]) * k, cLow[1] + (cTop[1] - cLow[1]) * k, cLow[2] + (cTop[2] - cLow[2]) * k];
        return { p: [sx * rad, y, cz * rad], n: [-sx * 0.5, 0.85, -cz * 0.5], uv: [u, v], c };
      });
    }
    const hillsGeo = keep(merge([
      hillRing(85, 105, 125, 5, 17, 1.3, [0.36, 0.55, 0.3], [0.55, 0.72, 0.42]),
      hillRing(150, 175, 205, 14, 42, 4.1, [0.45, 0.55, 0.62], [0.62, 0.66, 0.78])
    ]));
    const hills = new three_default.Mesh(hillsGeo, keep(new three_default.MeshLambertMaterial({ vertexColors: true })));
    hills.name = "hills";
    root.add(hills);
    const trees = new three_default.Group();
    trees.name = "trees";
    root.add(trees);
    function buildTrees() {
      const coneGeo = keep(new three_default.ConeGeometry(1, 1, 7, 1));
      coneGeo.translate(0, 0.5, 0);
      const ballGeo = keep(new three_default.IcosahedronGeometry(1, 1));
      const trunkGeo = keep(new three_default.CylinderGeometry(0.12, 0.17, 1, 5, 1, true));
      trunkGeo.translate(0, 0.5, 0);
      const N = 72;
      const leafMat = keep(new three_default.MeshLambertMaterial({ color: 16777215 }));
      const cones = new three_default.InstancedMesh(coneGeo, leafMat, N);
      const balls = new three_default.InstancedMesh(ballGeo, leafMat, N);
      const trunks = new three_default.InstancedMesh(trunkGeo, keep(new three_default.MeshLambertMaterial({ color: 9069640 })), N * 2);
      const m = new three_default.Matrix4(), q = new three_default.Quaternion(), s = new three_default.Vector3(), p = new three_default.Vector3();
      const greens = [6265418, 7843157, 5212744, 9223262, 6989418];
      let nc = 0, nb = 0, nt = 0;
      for (let k = 0; k < N * 2 && (nc < N || nb < N); k++) {
        const a = r() * Math.PI * 2, rad = 20 + r() * 52;
        const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
        if (z > -2 && Math.abs(x) < 16) continue;
        const h = 3 + r() * 4, w = 1.2 + r() * 1.3;
        const col = new three_default.Color(greens[Math.floor(r() * greens.length)]);
        const trunkH = h * 0.35;
        if (r() < 0.55 && nc < N) {
          p.set(x, trunkH * 0.6, z);
          s.set(w, h, w);
          m.compose(p, q.identity(), s);
          cones.setMatrixAt(nc, m);
          cones.setColorAt(nc, col);
          nc++;
        } else if (nb < N) {
          p.set(x, trunkH + w * 0.9, z);
          s.set(w, w * 1.05, w);
          m.compose(p, q.identity(), s);
          balls.setMatrixAt(nb, m);
          balls.setColorAt(nb, col);
          nb++;
        } else continue;
        p.set(x, 0, z);
        s.set(1, trunkH + 0.5, 1);
        m.compose(p, q.identity(), s);
        trunks.setMatrixAt(nt++, m);
      }
      cones.count = nc;
      balls.count = nb;
      trunks.count = nt;
      for (const im of [cones, balls, trunks]) {
        im.computeBoundingSphere();
        trees.add(im);
      }
    }
    const bushGeo = keep(new three_default.IcosahedronGeometry(1, 1));
    const bushes = new three_default.InstancedMesh(bushGeo, keep(new three_default.MeshLambertMaterial({ color: 16777215 })), 16);
    {
      const m = new three_default.Matrix4(), q = new three_default.Quaternion(), s = new three_default.Vector3(), p = new three_default.Vector3();
      for (let i = 0; i < 16; i++) {
        const a = Math.PI * 0.42 + i / 15 * Math.PI * 1.16 + (r() - 0.5) * 0.08;
        const rad = 5.15 + r() * 0.5, sc = 0.45 + r() * 0.45;
        p.set(Math.sin(a) * rad, sc * 0.45, Math.cos(a) * rad);
        s.set(sc * 1.2, sc, sc * 1.2);
        m.compose(p, q.identity(), s);
        bushes.setMatrixAt(i, m);
        bushes.setColorAt(i, new three_default.Color().setHSL(0.26 + r() * 0.06, 0.45, 0.36 + r() * 0.1));
      }
      bushes.computeBoundingSphere();
    }
    bushes.name = "bushes";
    root.add(bushes);
    const { inner: RI, outer: RO, height: H } = TOWER;
    const A0 = Math.PI / 2, A1 = Math.PI * 1.5;
    const SEG = 36;
    const parts = [];
    parts.push(grid(SEG, 1, (u, v) => {
      const a = A0 + (A1 - A0) * u, sx = Math.sin(a), cz = Math.cos(a);
      return { p: [sx * RO, v * H, cz * RO], n: [sx, 0, cz], uv: [RO * (a - A0) / TILE, v * H / TILE], c: [0.95, 0.93, 0.9] };
    }, true));
    parts.push(grid(SEG, 4, (u, v) => {
      const a = A0 + (A1 - A0) * u, sx = Math.sin(a), cz = Math.cos(a);
      const y = v * v * H;
      const ao = 0.66 + 0.34 * Math.min(1, y / 2.6);
      return { p: [sx * RI, y, cz * RI], n: [-sx, 0, -cz], uv: [RI * (a - A0) / TILE, y / TILE], c: [ao * 1, ao * 0.96, ao * 0.92] };
    }));
    parts.push(grid(SEG, 1, (u, v) => {
      const a = A0 + (A1 - A0) * u, rad = RI + (RO - RI) * v;
      return { p: [Math.sin(a) * rad, H, Math.cos(a) * rad], n: [0, 1, 0], uv: [rad * (a - A0) / TILE, v * 0.2], c: [0.9, 0.88, 0.85] };
    }));
    for (const side of [1, -1]) {
      parts.push(grid(1, 1, (u, v) => {
        const rad = RI + (RO - RI) * u;
        return { p: [side * rad, v * H, 0], n: [0, 0, 1], uv: [u * 0.2, v * H / TILE], c: [0.86, 0.84, 0.8] };
      }, side > 0));
    }
    parts.push(grid(40, 1, (u, v) => {
      const a = u * Math.PI * 2, rad = v * RO;
      const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
      const k = 0.78 + 0.1 * (1 - v);
      return { p: [x, 0, z], n: [0, 1, 0], uv: [x / TILE, z / TILE], c: [k, k * 0.95, k * 0.9] };
    }));
    parts.push(grid(40, 1, (u, v) => {
      const a = u * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      return { p: [sx * RO, -0.45 + v * 0.45, cz * RO], n: [sx, 0, cz], uv: [RO * a / TILE, v * 0.22], c: [0.8, 0.77, 0.72] };
    }, true));
    const merlons = 9;
    for (let i = 0; i < merlons; i++) {
      const a = A0 + (A1 - A0) * ((i + 0.5) / merlons);
      const b = new three_default.BoxGeometry(0.62, 0.62, RO - RI + 0.08);
      scaleUV(b, 0.31, 0.31);
      tint(b, 0.93, 0.9, 0.86);
      b.rotateY(a);
      b.translate(Math.sin(a) * (RI + RO) / 2, H + 0.31, Math.cos(a) * (RI + RO) / 2);
      parts.push(b);
    }
    const FLAG_A = [A0 + (A1 - A0) * (1.5 / 9), Math.PI, A0 + (A1 - A0) * (7.5 / 9)];
    for (const a of FLAG_A) {
      const pole = new three_default.CylinderGeometry(0.04, 0.05, 1.3, 5, 1, true);
      tint(pole, 0.35, 0.26, 0.2);
      pole.translate(Math.sin(a) * (RI + RO) / 2, H + 0.62 + 0.65, Math.cos(a) * (RI + RO) / 2);
      parts.push(pole);
    }
    const stoneTex = keep(textures2.loadFile("stone_blocks_512.jpg").clone());
    const towerGeo = keep(merge(parts));
    const tower = new three_default.Mesh(towerGeo, keep(new three_default.MeshLambertMaterial({ map: stoneTex, vertexColors: true, side: three_default.FrontSide })));
    tower.name = "tower";
    root.add(tower);
    const flagGeo = keep(new three_default.BufferGeometry());
    flagGeo.setAttribute("position", new three_default.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0.85, -0.25, 0], 3));
    flagGeo.setAttribute("normal", new three_default.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    const flags = new three_default.InstancedMesh(flagGeo, keep(new three_default.MeshLambertMaterial({ side: three_default.DoubleSide })), 3);
    const flagCol = [16748465, 16766044, 8379588];
    const flagBase = FLAG_A.map((a) => new three_default.Vector3(Math.sin(a) * (RI + RO) / 2, H + 1.9, Math.cos(a) * (RI + RO) / 2));
    flagBase.forEach((_, i) => flags.setColorAt(i, new three_default.Color(flagCol[i])));
    flags.name = "flags";
    root.add(flags);
    const blob = new three_default.Mesh(
      keep(new three_default.PlaneGeometry(12.5, 12.5)),
      keep(new three_default.MeshBasicMaterial({ map: shared2.blobShadow, color: 2109464, transparent: true, opacity: 0.32, depthWrite: false }))
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = -0.012;
    blob.renderOrder = -1;
    blob.name = "tower-shadow";
    root.add(blob);
    const fm = new three_default.Matrix4(), fq = new three_default.Quaternion(), fs = new three_default.Vector3(1, 1, 1), fe = new three_default.Euler();
    function update(t) {
      for (let i = 0; i < 3; i++) {
        fe.set(0, -Math.PI / 2 + 0.35 * Math.sin(t * 0.7 + i * 2.1), 0.05 * Math.sin(t * 1.1 + i));
        fq.setFromEuler(fe);
        fm.compose(flagBase[i], fq, fs);
        flags.setMatrixAt(i, fm);
      }
      flags.instanceMatrix.needsUpdate = true;
    }
    update(0);
    flags.computeBoundingSphere();
    let treesBuilt = false;
    const treeRes = [];
    function setTier(t) {
      tier = t;
      if (tier !== "low" && !treesBuilt) {
        const n = disposables.length;
        buildTrees();
        treesBuilt = true;
        treeRes.push(...disposables.splice(n));
      }
      if (tier === "low" && treeRes.length) {
        for (const o of [...trees.children]) {
          trees.remove(o);
          if (o.isInstancedMesh) o.dispose();
        }
        for (const d of treeRes) d.dispose();
        treeRes.length = 0;
      }
      trees.visible = tier !== "low";
    }
    return {
      root,
      update,
      setTier,
      // 起動を速くするため、木は最初のフレームの後に作る
      deferred() {
        setTier(tier);
      },
      dispose() {
        scene2.remove(root);
        for (const d of [...disposables, ...treeRes]) d.dispose();
      }
    };
  }

  // app/shell/src/camera.js
  var FOV = 40;
  var VIEWS = {
    all: { target: [0, 4.1, -0.6], w: 10, h: 9.4, pitch: 7 },
    low: { target: [0, 2, -0.6], w: 6.4, h: 4.4, pitch: 4 },
    high: { target: [0, 5, -0.6], w: 6.4, h: 4.4, pitch: 4 }
  };
  var MOVE_SECONDS = 2.5;
  var MIN_INTERVAL = 4;
  var canGoNow = (name, sinceMove, t) => t >= 1 && (sinceMove >= MIN_INTERVAL || name === "all");
  function poseFor(name, aspect) {
    const v = VIEWS[name];
    const tanH = Math.tan(three_default.MathUtils.degToRad(FOV / 2));
    const d = Math.max(v.h / 2 / tanH, v.w / 2 / (tanH * aspect)) * 1.06 + 0.4;
    const p = three_default.MathUtils.degToRad(v.pitch);
    const target = new three_default.Vector3(...v.target);
    const pos = new three_default.Vector3(0, Math.sin(p) * d, Math.cos(p) * d).add(target);
    return { pos, target };
  }
  var ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function createCameraRig(aspect) {
    const camera2 = new three_default.PerspectiveCamera(FOV, aspect, 0.1, 800);
    let current = "all";
    let from = null, to = poseFor("all", aspect), t = 1, sinceMove = 1e9, queued = null;
    const curPos = to.pos.clone(), curTarget = to.target.clone();
    camera2.position.copy(curPos);
    camera2.lookAt(curTarget);
    function start(name) {
      from = { pos: curPos.clone(), target: curTarget.clone() };
      to = poseFor(name, camera2.aspect);
      current = name;
      t = 0;
      sinceMove = 0;
    }
    return {
      camera: camera2,
      get view() {
        return current;
      },
      request(name, { immediate = false } = {}) {
        if (!VIEWS[name]) return false;
        if (immediate) {
          current = name;
          to = poseFor(name, camera2.aspect);
          t = 1;
          queued = null;
          curPos.copy(to.pos);
          curTarget.copy(to.target);
          return true;
        }
        if (name === current && !queued) return true;
        if (!canGoNow(name, sinceMove, t)) {
          queued = name;
          return true;
        }
        queued = null;
        if (name !== current) start(name);
        return true;
      },
      setAspect(aspect2) {
        camera2.aspect = aspect2;
        camera2.updateProjectionMatrix();
        to = poseFor(current, aspect2);
        if (t >= 1) {
          curPos.copy(to.pos);
          curTarget.copy(to.target);
        }
      },
      update(dt) {
        sinceMove += dt;
        if (queued && canGoNow(queued, sinceMove, t)) {
          const q = queued;
          queued = null;
          if (q !== current) start(q);
        }
        if (t < 1) {
          t = Math.min(1, t + dt / MOVE_SECONDS);
          const k = ease(t);
          curPos.lerpVectors(from.pos, to.pos, k);
          curTarget.lerpVectors(from.target, to.target, k);
        }
        camera2.position.copy(curPos);
        camera2.lookAt(curTarget);
      },
      get moving() {
        return t < 1;
      }
    };
  }

  // app/shell/src/input.js
  var HINT_DELAY = 3;
  var HINT_STRONG = 8;
  var TAP_MOVE_PX = 12;
  var TAP_SECONDS = 0.4;
  var NEAR_PX = 70;
  function createInput({ canvas: canvas3, camera: camera2, getHandles, onEmptyTap, onAnyDown, onAnyUp }) {
    const raycaster = new three_default.Raycaster();
    const ndc = new three_default.Vector2();
    const box = new three_default.Box3(), center = new three_default.Vector3(), tmpP = new three_default.Vector3();
    let rect = canvas3.getBoundingClientRect();
    let time = 0;
    let idle = HINT_DELAY;
    let ptr = null;
    const taps = [], released = [];
    let fdx = 0, fdy = 0;
    let justStarted = false;
    const input2 = {
      time: 0,
      camera: camera2,
      idle,
      hintLevel: 0,
      pointer: { active: false, x: 0, y: 0, ndcX: 0, ndcY: 0 },
      ray: { origin: new three_default.Vector3(), direction: new three_default.Vector3(0, 0, -1) },
      grab: null,
      released,
      taps
    };
    const grab = { id: "", dx: 0, dy: 0, ddx: 0, ddy: 0, vx: 0, vy: 0, point: new three_default.Vector3(), duration: 0, justStarted: false };
    function local(e) {
      return [e.clientX - rect.left, e.clientY - rect.top];
    }
    function setRay(x, y) {
      ndc.set(x / rect.width * 2 - 1, -(y / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera2);
    }
    function pick(x, y) {
      setRay(x, y);
      const hs = (getHandles() || []).filter((h) => h && h.enabled && h.object);
      if (!hs.length) return null;
      const hits = raycaster.intersectObjects(hs.map((h) => h.object), true);
      if (hits.length) {
        for (const hit of hits) {
          let o = hit.object;
          while (o) {
            const h = hs.find((hh) => hh.object === o);
            if (h) return { handle: h, point: hit.point.clone() };
            o = o.parent;
          }
        }
      }
      let best = null, bestD = NEAR_PX;
      const consider = (h, wp) => {
        const p = tmpP.copy(wp).project(camera2);
        if (p.z > 1) return;
        const sx = (p.x + 1) / 2 * rect.width, sy = (1 - p.y) / 2 * rect.height;
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) {
          bestD = d;
          best = { handle: h, point: wp.clone() };
        }
      };
      for (const h of hs) {
        let n = 0;
        h.object.traverse((o) => {
          if (o.isMesh) {
            n++;
            consider(h, o.getWorldPosition(center));
          }
        });
        if (!n) {
          box.setFromObject(h.object, true);
          if (box.isEmpty()) h.object.getWorldPosition(center);
          else box.getCenter(center);
          consider(h, center);
        }
      }
      return best;
    }
    function down(e) {
      if (ptr) return;
      e.preventDefault();
      rect = canvas3.getBoundingClientRect();
      const [x, y] = local(e);
      try {
        canvas3.setPointerCapture(e.pointerId);
      } catch (_) {
      }
      const hit = pick(x, y);
      ptr = { id: e.pointerId, x0: x, y0: y, x, y, t0: time, handle: hit ? hit.handle : null, vx: 0, vy: 0, moved: 0, lastT: performance.now() };
      if (hit) {
        grab.id = hit.handle.id;
        grab.dx = grab.dy = grab.ddx = grab.ddy = grab.vx = grab.vy = 0;
        grab.point.copy(hit.point);
        grab.duration = 0;
        justStarted = true;
      }
      idle = 0;
      onAnyDown && onAnyDown(!!hit);
    }
    function move(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      e.preventDefault();
      const [x, y] = local(e);
      const H = Math.max(1, rect.height);
      const ddx = (x - ptr.x) / H, ddy = -(y - ptr.y) / H;
      const now = performance.now(), dts = Math.max(1e-3, (now - ptr.lastT) / 1e3);
      const k = Math.min(1, dts / 0.1);
      ptr.vx += (ddx / dts - ptr.vx) * k;
      ptr.vy += (ddy / dts - ptr.vy) * k;
      ptr.lastT = now;
      fdx += ddx;
      fdy += ddy;
      ptr.moved = Math.max(ptr.moved, Math.hypot(x - ptr.x0, y - ptr.y0));
      ptr.x = x;
      ptr.y = y;
      idle = 0;
    }
    function up(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      e.preventDefault();
      const isTap = ptr.moved < TAP_MOVE_PX && time - ptr.t0 < TAP_SECONDS && e.type === "pointerup";
      const still = performance.now() - ptr.lastT > 90;
      if (ptr.handle) {
        released.push({ id: ptr.handle.id, vx: still ? 0 : ptr.vx, vy: still ? 0 : ptr.vy });
        if (isTap) {
          taps.push({ id: ptr.handle.id, point: grab.point.clone() });
          idle = HINT_DELAY;
        }
      } else if (isTap) {
        taps.push({ id: null, point: null });
        idle = HINT_DELAY;
        onEmptyTap && onEmptyTap();
      }
      if (!ptr.handle && !isTap) idle = 0;
      try {
        canvas3.releasePointerCapture(e.pointerId);
      } catch (_) {
      }
      ptr = null;
      onAnyUp && onAnyUp();
    }
    const opts = { passive: false };
    canvas3.addEventListener("pointerdown", down, opts);
    canvas3.addEventListener("pointermove", move, opts);
    canvas3.addEventListener("pointerup", up, opts);
    canvas3.addEventListener("pointercancel", up, opts);
    canvas3.addEventListener("lostpointercapture", (e) => {
      if (ptr && e.pointerId === ptr.id) up(Object.assign({}, e, { type: "pointercancel", preventDefault() {
      }, pointerId: e.pointerId }));
    });
    window.addEventListener("resize", () => {
      rect = canvas3.getBoundingClientRect();
    });
    return {
      input: input2,
      // 毎フレームの最初に呼ぶ
      frame(dt) {
        time += dt;
        if (!ptr || !ptr.handle) idle += dt;
        input2.time = time;
        input2.idle = idle;
        input2.hintLevel = ptr && ptr.handle ? 0 : idle >= HINT_STRONG ? 2 : idle >= HINT_DELAY ? 1 : 0;
        const pa = input2.pointer;
        pa.active = !!ptr;
        if (ptr) {
          pa.x = ptr.x;
          pa.y = ptr.y;
          setRay(ptr.x, ptr.y);
          pa.ndcX = ndc.x;
          pa.ndcY = ndc.y;
          input2.ray.origin.copy(raycaster.ray.origin);
          input2.ray.direction.copy(raycaster.ray.direction);
        }
        if (ptr && ptr.handle) {
          grab.ddx = fdx;
          grab.ddy = fdy;
          grab.dx += fdx;
          grab.dy += fdy;
          grab.vx = ptr.vx;
          grab.vy = ptr.vy;
          grab.duration = time - ptr.t0;
          grab.justStarted = justStarted;
          input2.grab = grab;
        } else input2.grab = null;
        justStarted = false;
        fdx = fdy = 0;
        return input2;
      },
      // hero.update の後に呼ぶ（このフレームの出来事を消す）
      endFrame() {
        taps.length = 0;
        released.length = 0;
      },
      setIdle(v) {
        idle = v;
      },
      get grabbing() {
        return !!(ptr && ptr.handle);
      },
      cancel() {
        ptr = null;
      }
    };
  }

  // app/shell/src/audio.js
  var MIN_GAP = { tick: 0.05, beam: 0.12, hit: 0.08, hint: 0.8, default: 0.03 };
  var MAX_VOICES = 24;
  function createAudio({ onWarn } = {}) {
    let ctx = null, master = null, voices = 0;
    const last2 = /* @__PURE__ */ new Map();
    let muted = false;
    function ensure() {
      if (ctx) {
        if (ctx.state !== "running") ctx.resume().catch(() => {
        });
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC({ latencyHint: "interactive" });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(comp).connect(ctx.destination);
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      if (ctx.state !== "running") ctx.resume().catch(() => {
      });
    }
    function out(pan) {
      if (ctx.createStereoPanner && pan) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        p.connect(master);
        return p;
      }
      return master;
    }
    function tone(dest, { type = "sine", f, f2, t0, a = 5e-3, d, g }) {
      const o = ctx.createOscillator();
      const e = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + d);
      e.gain.setValueAtTime(1e-4, t0);
      e.gain.exponentialRampToValueAtTime(Math.max(2e-4, g), t0 + a);
      e.gain.exponentialRampToValueAtTime(1e-4, t0 + a + d);
      o.connect(e).connect(dest);
      o.start(t0);
      o.stop(t0 + a + d + 0.05);
      voices++;
      o.onended = () => {
        voices--;
        e.disconnect();
      };
    }
    function bell(dest, f, t0, g, d = 1.6) {
      tone(dest, { f, t0, d, g });
      tone(dest, { f: f * 2.76, t0, d: d * 0.5, g: g * 0.35 });
      tone(dest, { f: f * 5.4, t0, d: d * 0.25, g: g * 0.15 });
    }
    const NOTE = (semi) => 523.25 * Math.pow(2, semi / 12);
    const SYNTH = {
      grab(d, t, k, g) {
        tone(d, { type: "triangle", f: 460 * k, f2: 340 * k, t0: t, d: 0.11, g: 0.28 * g });
      },
      release(d, t, k, g) {
        tone(d, { type: "triangle", f: 330 * k, f2: 240 * k, t0: t, d: 0.13, g: 0.22 * g });
      },
      tick(d, t, k, g) {
        tone(d, { type: "square", f: 2100 * k, t0: t, a: 2e-3, d: 0.025, g: 0.035 * g });
      },
      beam(d, t, k, g) {
        tone(d, { f: 700 * k, f2: 1500 * k, t0: t, a: 0.02, d: 0.28, g: 0.12 * g });
        tone(d, { f: 1050 * k, f2: 2250 * k, t0: t + 0.03, a: 0.02, d: 0.25, g: 0.05 * g });
      },
      hit(d, t, k, g) {
        tone(d, { f: 1568 * k, t0: t, d: 0.3, g: 0.1 * g });
      },
      awaken(d, t, k, g) {
        bell(d, 523.25 * k, t, 0.3 * g);
      },
      bloom(d, t, k, g) {
        [0, 4, 7].forEach((s, i) => tone(d, { type: "triangle", f: NOTE(s) * k, t0: t + i * 0.12, d: 0.6, g: 0.18 * g }));
      },
      spin(d, t, k, g) {
        tone(d, { f: 220 * k, f2: 340 * k, t0: t, a: 0.25, d: 1, g: 0.14 * g });
        tone(d, { f: 330 * k, f2: 510 * k, t0: t, a: 0.3, d: 0.9, g: 0.06 * g });
      },
      stage(d, t, k, g) {
        bell(d, NOTE(7) * k, t, 0.22 * g, 1);
        bell(d, NOTE(12) * k, t + 0.18, 0.22 * g, 1.3);
      },
      complete(d, t, k, g) {
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(d, { type: "triangle", f: NOTE(s) * k, t0: t + i * 0.13, d: 0.7, g: 0.16 * g }));
        [0, 4, 7].forEach((s) => tone(d, { f: NOTE(s - 12) * k, t0: t + 0.9, a: 0.6, d: 2.6, g: 0.1 * g }));
        bell(d, NOTE(24) * k, t + 1, 0.12 * g, 2.5);
      },
      pop(d, t, k, g) {
        tone(d, { f: 520 * k, f2: 880 * k, t0: t, a: 4e-3, d: 0.08, g: 0.16 * g });
      },
      hint(d, t, k, g) {
        tone(d, { f: 2093 * k, t0: t, d: 0.35, g: 0.03 * g });
        tone(d, { f: 2637 * k, t0: t + 0.08, d: 0.35, g: 0.025 * g });
      }
    };
    return {
      unlock: ensure,
      get state() {
        return ctx ? ctx.state : "none";
      },
      get voices() {
        return voices;
      },
      setMuted(v) {
        muted = v;
        if (master) master.gain.value = v ? 0 : 0.7;
      },
      suspend() {
        if (ctx && ctx.state === "running") ctx.suspend().catch(() => {
        });
      },
      resume() {
        if (ctx && ctx.state !== "running") ctx.resume().catch(() => {
        });
      },
      play(name, { gain = 1, pitch = 0, pan = 0 } = {}) {
        let fn = SYNTH[name];
        if (!fn) {
          onWarn && onWarn("知らない音の名前: " + name);
          fn = SYNTH.tick;
          name = "tick";
        }
        if (!ctx || muted || ctx.state !== "running") return false;
        const now = ctx.currentTime;
        const gap = MIN_GAP[name] ?? MIN_GAP.default;
        if (now - (last2.get(name) ?? -1) < gap) return false;
        if (voices > MAX_VOICES) return false;
        last2.set(name, now);
        const g = Math.max(0, Math.min(1, Number.isFinite(gain) ? gain : 1));
        const k = Math.pow(2, (Number.isFinite(pitch) ? pitch : 0) / 12);
        fn(out(pan), now + 5e-3, k, g);
        return true;
      }
    };
  }

  // app/shell/src/hint.js
  var CYCLE = 2.4;
  var HAND_TIP = [0.4, 0.07];
  function createHintMarker({ scene: scene2, ringTexture, handTexture }) {
    const group = new three_default.Group();
    group.name = "hint-marker";
    const ringMat = new three_default.MeshBasicMaterial({ map: ringTexture, color: 16777215, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    const handMat = new three_default.MeshBasicMaterial({ map: handTexture, color: 16777215, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    const plane = new three_default.PlaneGeometry(1, 1);
    const ring = new three_default.Mesh(plane, ringMat);
    const hand = new three_default.Mesh(plane, handMat);
    ring.renderOrder = 1e3;
    hand.renderOrder = 1001;
    ring.frustumCulled = hand.frustumCulled = false;
    group.add(ring, hand);
    group.visible = false;
    scene2.add(group);
    let alpha = 0, t = 0, shownFor = 0;
    const right = new three_default.Vector3(), up = new three_default.Vector3(), pos = new three_default.Vector3(), dir = new three_default.Vector3();
    const lastHint = { position: new three_default.Vector3(), radius: 0.5, drag: "x" };
    const smooth = (x) => {
      x = Math.min(1, Math.max(0, x));
      return x * x * (3 - 2 * x);
    };
    return {
      // want: 合図を出すべきか、hint: hero.getHint() の結果
      update(dt, camera2, want, hint, level) {
        t += dt;
        if (hint) {
          lastHint.position.copy(hint.position);
          lastHint.radius = hint.radius || 0.5;
          lastHint.drag = hint.drag || "x";
        }
        const target = want && hint ? 1 : 0;
        if (target && alpha < 0.01) t = 0;
        alpha += (target - alpha) * Math.min(1, dt * (target ? 4 : 6));
        shownFor = target ? shownFor + dt : 0;
        group.visible = alpha > 0.01;
        if (!group.visible) return false;
        const r = three_default.MathUtils.clamp(lastHint.radius, 0.3, 0.8);
        right.setFromMatrixColumn(camera2.matrixWorld, 0);
        up.setFromMatrixColumn(camera2.matrixWorld, 1);
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.8);
        ring.quaternion.copy(camera2.quaternion);
        hand.quaternion.copy(camera2.quaternion);
        ring.position.copy(lastHint.position);
        const s = r * 2.5 * (1 + 0.1 * pulse);
        ring.scale.set(s, s, 1);
        ringMat.opacity = alpha * Math.min(1, (0.6 + 0.3 * pulse) * (level >= 2 ? 1.15 : 1));
        const c = t % CYCLE / CYCLE;
        const press = smooth(c / 0.15) * (1 - smooth((c - 0.7) / 0.15));
        let travel = 0, show = 1 - smooth((c - 0.78) / 0.12);
        if (lastHint.drag === "x" || lastHint.drag === "y") {
          travel = smooth((c - 0.15) / 0.55) * 2 - 1;
          dir.copy(lastHint.drag === "x" ? right : up);
        } else {
          travel = 0;
          dir.set(0, 0, 0);
          show = 1;
        }
        const hs = r * 1.9 * (1 - 0.12 * press);
        pos.copy(lastHint.position).addScaledVector(dir, travel * r * 1.1);
        pos.addScaledVector(right, (0.5 - HAND_TIP[0]) * hs).addScaledVector(up, -(0.5 - HAND_TIP[1]) * hs);
        hand.position.copy(pos);
        hand.scale.set(hs, hs, 1);
        handMat.opacity = alpha * show;
        return shownFor > 0 && shownFor - dt <= 0;
      },
      hide() {
        alpha = 0;
        group.visible = false;
      },
      dispose() {
        scene2.remove(group);
        plane.dispose();
        ringMat.dispose();
        handMat.dispose();
      }
    };
  }

  // app/shell/src/stats.js
  function visibleChain(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }
  function countGroup(root) {
    let tris = 0, calls = 0;
    root.traverse((o) => {
      if (!o.isMesh || !visibleChain(o)) return;
      const g = o.geometry;
      if (!g || !g.attributes.position) return;
      let n = g.index ? g.index.count : g.attributes.position.count;
      n = Math.min(n, g.drawRange.count === Infinity ? n : g.drawRange.count);
      const inst = o.isInstancedMesh ? o.count : 1;
      const mats = Array.isArray(o.material) ? o.material.length : 1;
      if (inst > 0) {
        tris += Math.floor(n / 3) * inst;
        calls += mats;
      }
    });
    return { tris, calls };
  }
  var MAP_KEYS = ["map", "alphaMap", "aoMap", "bumpMap", "emissiveMap", "envMap", "lightMap", "metalnessMap", "normalMap", "roughnessMap", "specularMap", "displacementMap"];
  function texBytes(t) {
    const img = t.image || t.source && t.source.data;
    if (!img) return { w: 0, h: 0, bytes: 0 };
    const w = img.naturalWidth || img.videoWidth || img.width || 0, h = img.naturalHeight || img.videoHeight || img.height || 0;
    const mip = t.generateMipmaps !== false && t.minFilter !== three_default.LinearFilter && t.minFilter !== three_default.NearestFilter ? 4 / 3 : 1;
    return { w, h, bytes: w * h * 4 * mip };
  }
  function collectTextures(root, extra = []) {
    const bySource = /* @__PURE__ */ new Map();
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
    const seen = /* @__PURE__ */ new Set();
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
  function estimate({ renderer: renderer2, scene: scene2, heroRoot, envTexture, sharedTextures = [] }) {
    const size = renderer2.getDrawingBufferSize(new three_default.Vector2());
    const fb = size.x * size.y * 16;
    const sharedSrc = new Set(sharedTextures.map((t) => t.source));
    const heroTex = heroRoot ? collectTextures(heroRoot).filter((t) => !sharedSrc.has(t.tex.source)) : [];
    const heroSources = new Set(heroTex.map((t) => t.tex.source));
    const allTex = collectTextures(scene2, envTexture ? [envTexture] : []);
    const otherTex = allTex.filter((t) => !heroSources.has(t.tex.source));
    const pmrem = envTexture ? 256 * 256 * 6 * 8 * (4 / 3) * 2 : 0;
    const heroGeo = heroRoot ? geoBytes(heroRoot) : 0;
    const allGeo = geoBytes(scene2);
    const sum = (a) => a.reduce((s, t) => s + t.bytes, 0);
    const hero2 = heroRoot ? countGroup(heroRoot) : { tris: 0, calls: 0 };
    const all = countGroup(scene2);
    const MB = 1024 * 1024;
    const r = {
      drawingBuffer: [size.x, size.y],
      tris: { hero: hero2.tris, other: all.tris - hero2.tris, total: all.tris },
      calls: { hero: hero2.calls, other: all.calls - hero2.calls, total: all.calls },
      textures: {
        hero: heroTex.map((t) => `${t.tex.name || "?"} ${t.w}x${t.h}`),
        other: otherTex.map((t) => `${t.tex.name || "?"} ${t.w}x${t.h}`)
      },
      mb: {
        heroTex: sum(heroTex) / MB,
        otherTex: sum(otherTex) / MB,
        pmrem: pmrem / MB,
        heroGeo: heroGeo / MB,
        otherGeo: (allGeo - heroGeo) / MB,
        framebuffer: fb / MB
      }
    };
    r.mb.total = Object.values(r.mb).reduce((a, b) => a + b, 0);
    return r;
  }
  function countNaN(scene2, camera2) {
    let bad = 0;
    const scan = (arr) => {
      for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) bad++;
    };
    if (camera2) {
      scan(camera2.matrixWorld.elements);
      scan(camera2.projectionMatrix.elements);
    }
    scene2.traverse((o) => {
      scan(o.matrixWorld.elements);
      if (o.isInstancedMesh) scan(o.instanceMatrix.array.subarray(0, o.count * 16));
    });
    return bad;
  }

  // app/shell/src/debug.js
  function createErrorLog() {
    const errors = [];
    const push = (msg) => {
      errors.push(String(msg).slice(0, 300));
      if (errors.length > 50) errors.shift();
    };
    window.addEventListener("error", (e) => push(e.message || e.error || "error"));
    window.addEventListener("unhandledrejection", (e) => push("promise: " + (e.reason && e.reason.message || e.reason)));
    const origErr = console.error.bind(console);
    console.error = (...a) => {
      push(a.map(String).join(" "));
      origErr(...a);
    };
    return { errors, push };
  }
  function createFrameTimer() {
    const N = 180;
    const buf = new Float32Array(N);
    let i = 0, n = 0;
    return {
      add(ms) {
        buf[i] = ms;
        i = (i + 1) % N;
        n = Math.min(N, n + 1);
      },
      get() {
        if (!n) return { avg: 0, p95: 0 };
        const a = Array.from(buf.subarray(0, n)).sort((x, y) => x - y);
        const mean = a.reduce((s, v) => s + v, 0) / n;
        const p95ms = a[Math.min(n - 1, Math.floor(n * 0.95))];
        return { avg: 1e3 / Math.max(0.1, mean), p95: 1e3 / Math.max(0.1, p95ms) };
      }
    };
  }
  function createCpuTimer() {
    const v = { hero: 0, render: 0, frame: 0 };
    let n = 0;
    return {
      add(k, ms) {
        const a = n < 30 ? 0.3 : 0.05;
        v[k] += (ms - v[k]) * a;
      },
      tick() {
        n++;
      },
      get: () => ({ ...v })
    };
  }
  function createDebugOverlay({ enabled, renderer: renderer2, scene: scene2, camera: camera2, getHeroRoot, envTexture, sharedTextures, frames: frames2, cpu: cpu2, errors, getInfo }) {
    let el = null, acc = 0;
    if (enabled) {
      el = document.createElement("pre");
      el.id = "debug";
      el.style.cssText = "position:fixed;left:6px;top:6px;margin:0;padding:6px 8px;background:rgba(0,0,0,.62);color:#e8ffe8;font:11px/1.35 ui-monospace,Menlo,monospace;z-index:20;pointer-events:none;border-radius:6px;white-space:pre;max-width:96vw;overflow:hidden";
      document.body.appendChild(el);
    }
    let lastStats = null;
    function snapshot() {
      const st = estimate({ renderer: renderer2, scene: scene2, heroRoot: getHeroRoot(), envTexture, sharedTextures });
      const info = renderer2.info;
      st.frameCalls = info.render.calls;
      st.frameTris = info.render.triangles;
      st.glTextures = info.memory.textures;
      st.glGeometries = info.memory.geometries;
      st.fps = frames2.get();
      st.cpu = cpu2 ? cpu2.get() : null;
      st.nan = countNaN(scene2, camera2);
      lastStats = st;
      return st;
    }
    return {
      snapshot,
      get last() {
        return lastStats;
      },
      update(dt) {
        if (!el) return;
        acc += dt;
        if (acc < 0.25) return;
        acc = 0;
        const s = snapshot();
        const i = getInfo();
        const f = (x) => x.toFixed(1);
        el.textContent = [
          `tier ${i.tier}${i.isMobile ? " (mobile)" : ""}  canvas ${s.drawingBuffer[0]}x${s.drawingBuffer[1]} dpr ${f(i.dpr)}  tti ${i.tti ? Math.round(i.tti) + "ms" : "-"}`,
          `fps avg ${f(s.fps.avg)}  p95 ${f(s.fps.p95)}` + (s.cpu ? `  cpu ms: hero ${s.cpu.hero.toFixed(2)} render ${s.cpu.render.toFixed(2)} frame ${s.cpu.frame.toFixed(2)}` : ""),
          `draw ${s.frameCalls} (hero ${s.calls.hero} / other ${s.calls.other})`,
          `tris ${s.frameTris} (hero ${s.tris.hero} / other ${s.tris.other})`,
          `tex gl ${s.glTextures}  hero ${s.textures.hero.length}/4: ${s.textures.hero.join(", ") || "-"}`,
          `     other ${s.textures.other.length}: ${s.textures.other.join(", ")}`,
          `gpu≈ ${f(s.mb.total)}MB (fb ${f(s.mb.framebuffer)} heroTex ${f(s.mb.heroTex)} tex ${f(s.mb.otherTex)} pmrem ${f(s.mb.pmrem)} geo ${f(s.mb.heroGeo + s.mb.otherGeo)})`,
          `stage ${i.stage}/${i.count}${i.complete ? " complete" : ""}${i.busy ? " busy" : ""}  view ${i.view}  idle ${f(i.idle)}  audio ${i.audio}  ctx ${i.ctx}`,
          `nan ${s.nan}  errors ${errors.length}${errors.length ? ": " + errors[errors.length - 1] : ""}`
        ].join("\n");
      }
    };
  }

  // app/shell/src/main.js
  var params = new URLSearchParams(location.search);
  var DEBUG = params.get("debug") === "1";
  var errorLog = createErrorLog();
  var warnOnce = /* @__PURE__ */ new Set();
  function warn(msg) {
    if (warnOnce.has(msg)) return;
    warnOnce.add(msg);
    errorLog.push("warn: " + msg);
    console.warn("[shell]", msg);
  }
  var canvas2 = document.getElementById("c");
  var veil = document.getElementById("veil");
  var againBtn = document.getElementById("again");
  var det = detectTier(params);
  var state = {
    tier: det.tier,
    isMobile: det.isMobile,
    dpr: 1,
    tti: 0,
    firstFrame: 0,
    stage: 0,
    count: 0,
    complete: false,
    completeAt: 0,
    finaleSeconds: 6,
    finaleView: "all",
    againAt: 0,
    busy: false,
    ctx: "ok",
    time: 0,
    events: [],
    sounds: {}
  };
  var renderer = new three_default.WebGLRenderer({ canvas: canvas2, antialias: false, alpha: false, stencil: false, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.outputColorSpace = three_default.SRGBColorSpace;
  renderer.toneMapping = three_default.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = false;
  var scene = new three_default.Scene();
  var rig = createCameraRig(window.innerWidth / Math.max(1, window.innerHeight));
  var camera = rig.camera;
  var textures = createTextureStore(renderer, state.tier, (e) => errorLog.push(e.message || String(e)));
  var shared = { blobShadow: makeBlobTexture() };
  var ringTex = makeRingTexture();
  var handTex = makeHandTexture();
  var envTex = makeEnvTexture();
  scene.environment = envTex;
  scene.environmentIntensity = 0.9;
  var world = createWorld({ scene, textures, tier: state.tier, shared });
  var hintMarker = createHintMarker({ scene, ringTexture: ringTex, handTexture: handTex });
  var audio = createAudio({ onWarn: warn });
  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    state.dpr = pixelRatioFor(state.tier, state.isMobile, w, h);
    renderer.setPixelRatio(state.dpr);
    renderer.setSize(w, h, false);
    rig.setAspect(w / h);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 200));
  var governor = createTierGovernor(state.tier, (t, fps) => {
    state.tier = t;
    errorLog.push(`info: tier を ${t} に下げた（平均 ${fps.toFixed(0)}fps）`);
    resize();
    world.setTier(t);
  }, { enabled: !det.forced && params.get("autotier") !== "0" });
  var hero = null;
  function onHeroEvent(e) {
    if (!e || typeof e.type !== "string") return;
    if (e.type !== "sound") state.events.push({ t: +state.time.toFixed(2), type: e.type, index: e.index, name: e.name, id: e.id });
    if (state.events.length > 200) state.events.shift();
    switch (e.type) {
      case "sound": {
        state.sounds[e.name] = (state.sounds[e.name] || 0) + 1;
        let pan = 0;
        if (e.position && e.position.isVector3) pan = three_default.MathUtils.clamp(e.position.clone().project(camera).x * 0.6, -0.8, 0.8);
        audio.play(e.name, { gain: e.gain, pitch: e.pitch, pan });
        break;
      }
      case "stage":
        state.stage = e.index | 0;
        break;
      case "awaken":
        break;
      case "view":
        rig.request(e.name);
        break;
      case "busy":
        state.busy = !!e.value;
        break;
      case "complete":
        state.complete = true;
        state.completeAt = state.time;
        state.finaleSeconds = Number.isFinite(e.finaleSeconds) ? e.finaleSeconds : 6;
        state.finaleView = e.view && VIEWS[e.view] ? e.view : "all";
        state.againAt = 0;
        rig.request(state.finaleView);
        break;
      default:
        warn("知らない hero イベント: " + e.type);
    }
  }
  function createHeroSafe() {
    const mod = window.MirrorTowerHero;
    if (!mod || typeof mod.createHero !== "function") {
      errorLog.push("hero/hero.bundle.js が読み込まれていない（npm run pack:hero）");
      return null;
    }
    try {
      const h = mod.createHero(three_default, {
        tier: state.tier,
        isMobile: state.isMobile,
        debug: DEBUG,
        onEvent: onHeroEvent,
        loadTexture: (name) => textures.loadHeroTexture(name),
        shared,
        world: {
          towerInnerRadius: TOWER.inner,
          towerHeight: TOWER.height,
          floorY: 0,
          volume: { min: [-3.6, 0, -3.6], max: [3.6, 7, 2] }
        }
      });
      for (const k of ["root", "update", "getHandles", "getHint", "getState", "reset", "debugAdvance", "onContextRestored", "dispose"]) {
        if (!(k in h)) errorLog.push("hero API が足りない: " + k);
      }
      scene.add(h.root);
      state.count = h.stageCount | 0;
      return h;
    } catch (e) {
      errorLog.push("createHero 失敗: " + (e && e.stack || e));
      return null;
    }
  }
  hero = createHeroSafe();
  var input = createInput({
    canvas: canvas2,
    camera,
    getHandles: () => hero ? safe(() => hero.getHandles(), []) : [],
    onEmptyTap: () => audio.play("pop", { gain: 0.6 }),
    onAnyDown: () => audio.unlock(),
    onAnyUp: () => audio.unlock()
    // iOS Safari は指を離した時（touchend）を音の解錠に数えることがある
  });
  function safe(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      const m = "hero エラー: " + (e && e.message || e);
      if (!warnOnce.has(m)) {
        warnOnce.add(m);
        errorLog.push(m);
        console.error(e);
      }
      return fallback;
    }
  }
  function resetGame() {
    if (hero) safe(() => hero.reset());
    state.stage = 0;
    state.complete = false;
    state.busy = false;
    state.finaleView = "all";
    state.againAt = 0;
    rig.request("all");
    input.setIdle(HINT_DELAY);
    againBtn.hidden = true;
  }
  againBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    audio.unlock();
    audio.play("pop");
    resetGame();
  });
  for (const ev of ["gesturestart", "gesturechange", "dblclick", "contextmenu"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) audio.suspend();
    else audio.resume();
  });
  canvas2.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    state.ctx = "lost";
    veil.classList.remove("hide");
    input.cancel();
  }, false);
  canvas2.addEventListener("webglcontextrestored", () => {
    for (const t of [...textures.all(), shared.blobShadow, ringTex, handTex, envTex]) if (t.image) t.needsUpdate = true;
    if (hero) safe(() => hero.onContextRestored());
    state.ctx = "ok";
    resize();
    veil.classList.add("hide");
  }, false);
  var frames = createFrameTimer();
  var cpu = createCpuTimer();
  var overlay = createDebugOverlay({
    enabled: DEBUG,
    renderer,
    scene,
    camera,
    envTexture: envTex,
    sharedTextures: [shared.blobShadow],
    frames,
    cpu,
    errors: errorLog.errors,
    getHeroRoot: () => hero && hero.root,
    getInfo: () => ({ ...state, view: rig.view, idle: input.input.idle, audio: audio.state })
  });
  var VEIL_MAX_MS = 1500;
  var last = performance.now();
  var frameNo = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const rawMs = now - last;
    last = now;
    if (state.ctx !== "ok") return;
    const dt = Math.min(0.05, Math.max(0, rawMs / 1e3));
    state.time += dt;
    if (frameNo > 0) frames.add(rawMs);
    const tf0 = performance.now();
    const inp = input.frame(dt);
    if (hero) safe(() => hero.update(dt, inp));
    const tf1 = performance.now();
    input.endFrame();
    if (hero) {
      const st = safe(() => hero.getState(), null);
      if (st) {
        state.busy = !!st.busy;
        if (st.complete && !state.complete) onHeroEvent({ type: "complete" });
      }
    }
    rig.update(dt);
    world.update(state.time);
    camera.updateMatrixWorld();
    const hint = hero && !state.busy && !state.complete ? safe(() => hero.getHint(), null) : null;
    const appeared = hintMarker.update(dt, camera, inp.hintLevel >= 1 && !input.grabbing, hint, inp.hintLevel);
    if (appeared && frameNo > 30) audio.play("hint");
    const backAt = Math.max(6, state.finaleSeconds - 2.5);
    if (state.complete && state.finaleView !== "all" && state.time - state.completeAt > backAt) {
      state.finaleView = "all";
      state.againAt = backAt + 2.5;
      rig.request("all");
    }
    if (state.complete && againBtn.hidden && state.time - state.completeAt > Math.max(state.finaleSeconds, state.againAt)) againBtn.hidden = false;
    const tr0 = performance.now();
    renderer.render(scene, camera);
    const tr1 = performance.now();
    cpu.add("hero", tf1 - tf0);
    cpu.add("render", tr1 - tr0);
    cpu.add("frame", tr1 - tf0);
    cpu.tick();
    governor.frame(dt);
    overlay.update(dt);
    frameNo++;
    if (frameNo === 1) state.firstFrame = performance.now();
    if (frameNo === 3) world.deferred();
    if (!state.tti && (textures.pendingCount === 0 || performance.now() - state.firstFrame > VEIL_MAX_MS)) {
      state.tti = performance.now();
      veil.classList.add("hide");
      document.documentElement.dataset.ready = "1";
    }
  }
  requestAnimationFrame(loop);
  window.__mt = {
    THREE: three_default,
    renderer,
    scene,
    camera,
    rig,
    state,
    textures,
    get hero() {
      return hero;
    },
    errors: errorLog.errors,
    stats: () => overlay.snapshot(),
    tiers: TIERS,
    loseContext: () => renderer.forceContextLoss(),
    restoreContext: () => renderer.forceContextRestore(),
    // 操作部の画面上の位置（CSS px）
    handleScreen(id) {
      const h = hero && hero.getHandles().find((x) => x.id === id);
      if (!h) return null;
      const b = new three_default.Box3().setFromObject(h.object, true), c = new three_default.Vector3();
      if (b.isEmpty()) h.object.getWorldPosition(c);
      else b.getCenter(c);
      c.project(camera);
      const r = canvas2.getBoundingClientRect();
      return { x: r.left + (c.x + 1) / 2 * r.width, y: r.top + (1 - c.y) / 2 * r.height };
    },
    resetGame
  };
})();
(globalThis.__mtSrcHash=globalThis.__mtSrcHash||{})["MirrorTowerShell"]="26e9b4f199";
