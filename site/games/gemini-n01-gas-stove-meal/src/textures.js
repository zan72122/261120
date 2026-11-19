import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finishTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createSunlitEnvTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');

  // Warm sunlit room ceiling-to-floor gradient
  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0.0, '#fff7e8');
  bg.addColorStop(0.32, '#f4e6d2');
  bg.addColorStop(0.52, '#d8c5ad');
  bg.addColorStop(0.75, '#7c6652');
  bg.addColorStop(1.0, '#3e3024');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Bright morning sun window softbox (left-front)
  const sun = ctx.createRadialGradient(115, 78, 6, 115, 78, 86);
  sun.addColorStop(0.0, 'rgba(255, 252, 236, 1.0)');
  sun.addColorStop(0.35, 'rgba(255, 240, 205, 0.92)');
  sun.addColorStop(1.0, 'rgba(255, 232, 190, 0.0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 260, 180);

  // Cool sky fill window (right-upper)
  const sky = ctx.createRadialGradient(390, 74, 8, 390, 74, 95);
  sky.addColorStop(0.0, 'rgba(225, 240, 255, 0.85)');
  sky.addColorStop(0.5, 'rgba(210, 228, 245, 0.45)');
  sky.addColorStop(1.0, 'rgba(210, 228, 245, 0.0)');
  ctx.fillStyle = sky;
  ctx.fillRect(260, 0, 252, 180);

  // Overhead warm kitchen pendant soft highlight
  const lamp = ctx.createRadialGradient(256, 26, 4, 256, 26, 62);
  lamp.addColorStop(0.0, 'rgba(255, 246, 220, 0.95)');
  lamp.addColorStop(1.0, 'rgba(255, 240, 200, 0.0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(180, 0, 152, 100);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createWoodTextures({
  base = '#c6935c',
  dark = '#8d5b2d',
  light = '#dfb37f',
  seed = 101,
  repeatX = 1,
  repeatY = 1,
} = {}) {
  const rand = seededRand(seed);
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');

  cctx.fillStyle = base;
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  // Layered wood grain bands
  for (let y = 0; y < h; y += 2) {
    const wave = Math.sin(y * 0.045) * 0.5 + Math.sin(y * 0.13 + 1.2) * 0.35 + (rand() - 0.5) * 0.35;
    cctx.fillStyle = wave > 0.2 ? light : wave < -0.25 ? dark : base;
    cctx.globalAlpha = 0.22 + Math.abs(wave) * 0.16;
    cctx.fillRect(0, y, w, 2 + (rand() > 0.7 ? 1 : 0));

    const bVal = Math.floor(128 + wave * 34);
    bctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bctx.fillRect(0, y, w, 2);
  }

  // Fine pore streaks
  cctx.globalAlpha = 0.16;
  for (let i = 0; i < 650; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 30 + rand() * 140;
    cctx.fillStyle = rand() > 0.35 ? dark : light;
    cctx.fillRect(x, y, len, 1);
    bctx.fillStyle = rand() > 0.5 ? '#666' : '#969696';
    bctx.fillRect(x, y, len, 1);
  }
  cctx.globalAlpha = 1;

  return {
    map: finishTexture(col, { repeatX, repeatY, srgb: true }),
    bumpMap: finishTexture(bump, { repeatX, repeatY, srgb: false }),
  };
}

export function createBrushedMetalTextures({ base = '#cfd4d8', seed = 202 } = {}) {
  const rand = seededRand(seed);
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const rough = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const rctx = rough.getContext('2d');

  cctx.fillStyle = base;
  cctx.fillRect(0, 0, w, h);
  rctx.fillStyle = '#484848';
  rctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 2400; i++) {
    const y = rand() * h;
    const x = rand() * w;
    const len = 60 + rand() * 240;
    const shade = 192 + Math.floor((rand() - 0.5) * 44);
    cctx.fillStyle = `rgba(${shade},${shade + 2},${shade + 4},0.22)`;
    cctx.fillRect(x, y, len, 1);

    const rv = 55 + Math.floor(rand() * 55);
    rctx.fillStyle = `rgba(${rv},${rv},${rv},0.3)`;
    rctx.fillRect(x, y, len, 1);
  }

  return {
    map: finishTexture(col, { srgb: true }),
    roughnessMap: finishTexture(rough, { srgb: false }),
    bumpMap: finishTexture(rough, { srgb: false }),
  };
}

export function createCastIronTextures({ seed = 303 } = {}) {
  const rand = seededRand(seed);
  const w = 256, h = 256;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');

  cctx.fillStyle = '#252629';
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 4500; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.7 + rand() * 1.6;
    const v = 24 + Math.floor(rand() * 26);
    cctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    cctx.fillRect(x, y, r, r);

    const bv = 75 + Math.floor(rand() * 110);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x, y, r, r);
  }

  return {
    map: finishTexture(col, { repeatX: 2, repeatY: 2, srgb: true }),
    bumpMap: finishTexture(bump, { repeatX: 2, repeatY: 2, srgb: false }),
  };
}

export function createCeramicTextures({ base = '#f6f0e6', speckle = '#8b7662', rimTint = null, seed = 404 } = {}) {
  const rand = seededRand(seed);
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');

  cctx.fillStyle = base;
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  // Subtle glaze tonal warmth
  const grad = cctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.7, 'rgba(220,200,175,0.06)');
  grad.addColorStop(1, 'rgba(180,150,120,0.15)');
  cctx.fillStyle = grad;
  cctx.fillRect(0, 0, w, h);

  if (rimTint) {
    cctx.fillStyle = rimTint;
    cctx.fillRect(0, 0, w, 26);
  }

  // Artisan stoneware iron flecks
  for (let i = 0; i < 650; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.6 + rand() * 1.5;
    cctx.fillStyle = speckle;
    cctx.globalAlpha = 0.16 + rand() * 0.35;
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.fill();

    bctx.fillStyle = '#707070';
    bctx.globalAlpha = 0.2;
    bctx.fillRect(x, y, r, r);
  }
  cctx.globalAlpha = 1;
  bctx.globalAlpha = 1;

  return {
    map: finishTexture(col, { srgb: true }),
    bumpMap: finishTexture(bump, { srgb: false }),
  };
}

export function createCounterStoneTextures({ seed = 505 } = {}) {
  const rand = seededRand(seed);
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');

  // Rich warm honed greige-limestone countertop (provides gorgeous photographic contrast for ceramic/glass/wood!)
  cctx.fillStyle = '#c8bfb2';
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#828282';
  bctx.fillRect(0, 0, w, h);

  // Soft natural stone clouds & subtle mineral veining
  for (let i = 0; i < 45; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 45 + rand() * 95;
    const g = cctx.createRadialGradient(x, y, 4, x, y, r);
    const tone = rand() > 0.5 ? 'rgba(235,227,214,0.28)' : 'rgba(155,142,126,0.24)';
    g.addColorStop(0, tone);
    g.addColorStop(1, 'rgba(200,191,178,0)');
    cctx.fillStyle = g;
    cctx.fillRect(0, 0, w, h);
  }

  // Fine mineral quartz flecks
  for (let i = 0; i < 2200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.7 + rand() * 1.6;
    cctx.fillStyle = rand() > 0.45 ? 'rgba(122,110,96,0.32)' : 'rgba(246,240,230,0.36)';
    cctx.fillRect(x, y, r, r);
    const bv = 118 + Math.floor(rand() * 20);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(x, y, r, r);
  }

  return {
    map: finishTexture(col, { repeatX: 3, repeatY: 1.5, srgb: true }),
    bumpMap: finishTexture(bump, { repeatX: 3, repeatY: 1.5, srgb: false }),
  };
}

export function createSubwayTileTextures({ repeatX = 4, repeatY = 3 } = {}) {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');

  // Warm recessed mortar grout
  cctx.fillStyle = '#a89f92';
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#323232';
  bctx.fillRect(0, 0, w, h);

  const rows = 8;
  const cols = 4;
  const tw = w / cols;
  const th = h / rows;
  const gap = 5;
  const rand = seededRand(606);

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset + gap * 0.5;
      const y = r * th + gap * 0.5;
      const shade = 232 + Math.floor((rand() - 0.5) * 14);
      cctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 15})`;
      cctx.fillRect(x, y, tw - gap, th - gap);

      // Subtle glossy ceramic bevel
      cctx.fillStyle = 'rgba(255,255,255,0.42)';
      cctx.fillRect(x + 2, y + 2, tw - gap - 4, 4);
      cctx.fillStyle = 'rgba(130,115,98,0.18)';
      cctx.fillRect(x + 2, y + th - gap - 5, tw - gap - 4, 3);

      bctx.fillStyle = '#dadada';
      bctx.fillRect(x + 1, y + 1, tw - gap - 2, th - gap - 2);
    }
  }

  return {
    map: finishTexture(col, { repeatX, repeatY, srgb: true }),
    bumpMap: finishTexture(bump, { repeatX, repeatY, srgb: false }),
  };
}

export function createQuiltTextures({ base = '#f3e5d4', stitch = '#d8c2aa', stripe = '#e8cbb1' } = {}) {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');

  cctx.fillStyle = base;
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#c8c8c8';
  bctx.fillRect(0, 0, w, h);

  // Soft woven linen crosshatch
  const rand = seededRand(707);
  for (let i = 0; i < w; i += 3) {
    cctx.fillStyle = i % 6 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(170,145,120,0.07)';
    cctx.fillRect(i, 0, 1, h);
    cctx.fillRect(0, i, w, 1);
  }

  // Gentle pastel-warm gingham/quilt panels
  const step = 64;
  cctx.fillStyle = stripe;
  cctx.globalAlpha = 0.28;
  for (let y = 0; y < h; y += step * 2) {
    cctx.fillRect(0, y, w, step);
  }
  for (let x = 0; x < w; x += step * 2) {
    cctx.fillRect(x, 0, step, h);
  }
  cctx.globalAlpha = 1;

  // Quilted diamond puff bump & stitching
  bctx.strokeStyle = '#525252';
  bctx.lineWidth = 5;
  cctx.strokeStyle = stitch;
  cctx.lineWidth = 2;
  cctx.setLineDash([6, 4]);
  for (let i = -h; i < w + h; i += step) {
    bctx.beginPath(); bctx.moveTo(i, 0); bctx.lineTo(i + h, h); bctx.stroke();
    bctx.beginPath(); bctx.moveTo(i, h); bctx.lineTo(i + h, 0); bctx.stroke();
    cctx.beginPath(); cctx.moveTo(i, 0); cctx.lineTo(i + h, h); cctx.stroke();
    cctx.beginPath(); cctx.moveTo(i, h); cctx.lineTo(i + h, 0); cctx.stroke();
  }
  cctx.setLineDash([]);

  // Fine cotton fuzz
  for (let i = 0; i < 1500; i++) {
    const x = rand() * w, y = rand() * h;
    const bv = 175 + Math.floor(rand() * 45);
    bctx.fillStyle = `rgba(${bv},${bv},${bv},0.22)`;
    bctx.fillRect(x, y, 2, 2);
  }

  return {
    map: finishTexture(col, { repeatX: 2, repeatY: 2, srgb: true }),
    bumpMap: finishTexture(bump, { repeatX: 2, repeatY: 2, srgb: false }),
  };
}

export function createTatamiTextures() {
  const w = 256, h = 256;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');
  const rand = seededRand(808);

  cctx.fillStyle = '#c8be8d';
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 3) {
    const v = (rand() - 0.5) * 14;
    cctx.fillStyle = `rgb(${200 + v},${190 + v},${140 + v})`;
    cctx.fillRect(0, y, w, 2);
    bctx.fillStyle = y % 6 === 0 ? '#a8a8a8' : '#646464';
    bctx.fillRect(0, y, w, 2);
  }

  return {
    map: finishTexture(col, { repeatX: 4, repeatY: 3, srgb: true }),
    bumpMap: finishTexture(bump, { repeatX: 4, repeatY: 3, srgb: false }),
  };
}

export function createCarrotSliceTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const cx = 64, cy = 64;
  ctx.fillStyle = '#ea6a1f';
  ctx.fillRect(0, 0, 128, 128);

  // Outer juicy cortex
  const g1 = ctx.createRadialGradient(cx, cy, 4, cx, cy, 62);
  g1.addColorStop(0.0, '#ffae47');
  g1.addColorStop(0.42, '#f99531');
  g1.addColorStop(0.50, '#df5c14');
  g1.addColorStop(0.88, '#f06e20');
  g1.addColorStop(1.0, '#c84b0f');
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.fill();

  // Subtle radial starburst fibers
  ctx.strokeStyle = 'rgba(255, 224, 150, 0.25)';
  ctx.lineWidth = 1.5;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    ctx.lineTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46);
    ctx.stroke();
  }

  return finishTexture(c, { srgb: true });
}

export function createSpongeTextures() {
  const rand = seededRand(909);
  const w = 256, h = 256;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cctx = col.getContext('2d');
  const bctx = bump.getContext('2d');

  cctx.fillStyle = '#f6cc36';
  cctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#d0d0d0';
  bctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 900; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 1.2 + rand() * 3.8;
    cctx.fillStyle = rand() > 0.25 ? '#d9a416' : '#ffe378';
    cctx.globalAlpha = 0.55;
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.fill();

    bctx.fillStyle = '#252525';
    bctx.globalAlpha = 0.7;
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  }
  cctx.globalAlpha = 1;
  bctx.globalAlpha = 1;

  return {
    map: finishTexture(col, { srgb: true }),
    bumpMap: finishTexture(bump, { srgb: false }),
  };
}

/**
 * Dynamic fried-egg white canvas texture (progress: 0 = clear glossy raw albumen,
 * 0.65 = snowy white soft-cooked, 1.0 = snowy puffed white with crispy golden-brown lacy edge)
 */
export function createEggWhiteDynamicTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const update = (cookProgress, crispProgress = 0) => {
    ctx.clearRect(0, 0, 256, 256);
    const cx = 128, cy = 128;

    // Outer lacy crispy edge appears when cookProgress > 0.45
    const crispAlpha = Math.max(0, Math.min(1, (cookProgress - 0.42) * 1.8 + crispProgress * 0.5));
    const whiteAlpha = Math.max(0.18, Math.min(0.99, 0.20 + cookProgress * 0.80));

    // Organic slightly-ruffled egg white silhouette
    ctx.save();
    ctx.beginPath();
    const pts = 48;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const wobble = 1 + 0.08 * Math.sin(a * 3 + 0.5) + 0.045 * Math.cos(a * 7 - 0.8) + 0.025 * Math.sin(a * 13);
      const r = 104 * wobble;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // Radial fill from yolk center outward
    const g = ctx.createRadialGradient(cx, cy, 18, cx, cy, 114);
    if (cookProgress < 0.25) {
      // Raw translucent glossy albumen
      g.addColorStop(0.0, `rgba(255, 252, 238, ${0.32 + cookProgress * 1.4})`);
      g.addColorStop(0.65, `rgba(250, 248, 236, ${0.24 + cookProgress * 1.2})`);
      g.addColorStop(0.92, `rgba(255, 253, 245, ${0.18 + cookProgress * 1.6})`);
      g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    } else {
      // Setting snowy white from outer edge inward + warm golden lacy rim
      const centerWhite = Math.min(1, (cookProgress - 0.15) * 1.25);
      const innerR = Math.round(255);
      const innerG = Math.round(252 - (1 - centerWhite) * 6);
      const innerB = Math.round(244 - (1 - centerWhite) * 16);
      g.addColorStop(0.0, `rgba(${innerR}, ${innerG}, ${innerB}, ${0.55 + centerWhite * 0.44})`);
      g.addColorStop(0.68, `rgba(255, 253, 248, ${whiteAlpha})`);
      g.addColorStop(0.86, `rgba(252, 244, 224, ${whiteAlpha})`);
      const rimR = Math.round(235 - crispAlpha * 68);
      const rimG = Math.round(205 - crispAlpha * 102);
      const rimB = Math.round(148 - crispAlpha * 105);
      g.addColorStop(0.95, `rgba(${rimR}, ${rimG}, ${rimB}, ${0.65 + crispAlpha * 0.35})`);
      g.addColorStop(1.0, 'rgba(180, 110, 45, 0.0)');
    }
    ctx.fillStyle = g;
    ctx.fill();

    // Subtle cooking micro-bubbles near the edge when sizzling
    if (cookProgress > 0.3) {
      const rand = seededRand(1234);
      const count = Math.floor(cookProgress * 42);
      for (let i = 0; i < count; i++) {
        const a = rand() * Math.PI * 2;
        const rad = 52 + rand() * 44;
        const bx = cx + Math.cos(a) * rad;
        const by = cy + Math.sin(a) * rad;
        const br = 2 + rand() * 4.5;
        ctx.fillStyle = rad > 84 && crispAlpha > 0.25
          ? `rgba(195, 130, 58, ${0.28 * crispAlpha})`
          : 'rgba(240, 232, 214, 0.42)';
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    tex.needsUpdate = true;
  };

  update(0, 0);
  return { texture: tex, update };
}

/**
 * Dynamic Hanamaru drawing card texture (draws red crayon spiral + bouncy flower petals)
 */
export function createHanamaruCardTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const drawPaperBase = () => {
    ctx.fillStyle = '#fcf8ef';
    ctx.fillRect(0, 0, 512, 512);
    // Warm cream cardstock frame & subtle paper grain
    const rand = seededRand(555);
    for (let i = 0; i < 1600; i++) {
      const x = rand() * 512, y = rand() * 512;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(220,206,184,0.22)' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = '#e7d8be';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, 476, 476);
  };

  // Precompute authentic Japanese Hanamaru spiral + 6 lush flower petals
  const spiralPts = [];
  const cx = 256, cy = 256;
  // Inner spiral (~2.2 turns)
  for (let i = 0; i <= 110; i++) {
    const t = i / 110;
    const angle = -Math.PI * 0.5 + t * Math.PI * 4.35;
    const r = 18 + t * 94;
    spiralPts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  // 6 scalloped flower petals going around the spiral
  const petalPts = [];
  const numPetals = 6;
  const totalP = 180;
  for (let i = 0; i <= totalP; i++) {
    const t = i / totalP;
    const baseAngle = -Math.PI * 0.45 + t * Math.PI * 2;
    const petalPhase = (t * numPetals) % 1;
    const bump = Math.sin(petalPhase * Math.PI);
    const r = 128 + bump * 58;
    petalPts.push([cx + Math.cos(baseAngle) * r, cy + Math.sin(baseAngle) * r]);
  }

  const extraStamps = [];

  const drawCrayonStroke = (pts, maxCount, width, color) => {
    if (maxCount < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Main vivid red-vermilion crayon stroke
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < maxCount; i++) {
      ctx.lineTo(pts[i][0], pts[i][1]);
    }
    ctx.stroke();

    // Subtle waxy crayon texture highlight
    ctx.strokeStyle = 'rgba(255, 190, 175, 0.38)';
    ctx.lineWidth = width * 0.32;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] - 2, pts[0][1] - 2);
    for (let i = 1; i < maxCount; i++) {
      ctx.lineTo(pts[i][0] - 2, pts[i][1] - 2);
    }
    ctx.stroke();
    ctx.restore();
  };

  const render = (progress) => {
    drawPaperBase();

    // First half (0..0.48): spiral; second half (0.48..1.0): petals
    const spiralT = Math.max(0, Math.min(1, progress / 0.48));
    const petalT = Math.max(0, Math.min(1, (progress - 0.48) / 0.52));

    drawCrayonStroke(spiralPts, Math.floor(spiralT * spiralPts.length), 16, '#e0312b');
    drawCrayonStroke(petalPts, Math.floor(petalT * petalPts.length), 18, '#e63932');

    // Cute tiny happy sparkle dots around the finished hanamaru
    if (progress > 0.94) {
      const a = Math.min(1, (progress - 0.94) / 0.06);
      ctx.fillStyle = `rgba(246, 174, 45, ${a})`;
      const stars = [[84, 96], [428, 102], [90, 418], [422, 412]];
      for (const [sx, sy] of stars) {
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const ang = (k / 8) * Math.PI * 2;
          const rr = k % 2 === 0 ? 18 : 7;
          const px = sx + Math.cos(ang) * rr;
          const py = sy + Math.sin(ang) * rr;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // Extra playful sticker petals if the child taps the card!
    for (const s of extraStamps) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = s.color;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 11, Math.sin(a) * 11, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffdf6b';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    tex.needsUpdate = true;
  };

  const getTipUV = (progress) => {
    if (progress <= 0.48) {
      const idx = Math.min(spiralPts.length - 1, Math.floor((progress / 0.48) * spiralPts.length));
      const p = spiralPts[idx];
      return { u: p[0] / 512, v: 1 - p[1] / 512 };
    }
    const idx = Math.min(petalPts.length - 1, Math.floor(((progress - 0.48) / 0.52) * petalPts.length));
    const p = petalPts[idx];
    return { u: p[0] / 512, v: 1 - p[1] / 512 };
  };

  const addFlowerStamp = (u, v) => {
    const colors = ['#ff6b8b', '#ffb84d', '#ff7a59', '#e64980', '#ff922b'];
    extraStamps.push({
      x: Math.max(46, Math.min(466, u * 512)),
      y: Math.max(46, Math.min(466, (1 - v) * 512)),
      rot: Math.random() * Math.PI * 2,
      color: colors[extraStamps.length % colors.length],
    });
    render(1);
  };

  const reset = () => {
    extraStamps.length = 0;
    render(0);
  };

  render(0);
  return { texture: tex, render, getTipUV, addFlowerStamp, reset };
}

/**
 * Dynamic soft smudge overlay texture for dirty dishes (fades cleanly as scrubbed!)
 */
export function createDishSmudgeTexture(kind = 'soup') {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const update = (dirtAmount) => {
    ctx.clearRect(0, 0, 256, 256);
    if (dirtAmount <= 0.01) {
      tex.needsUpdate = true;
      return;
    }
    const rand = seededRand(kind === 'soup' ? 771 : 882);
    const blobs = kind === 'soup' ? 14 : 11;
    for (let i = 0; i < blobs; i++) {
      const a = rand() * Math.PI * 2;
      const dist = 16 + rand() * 76;
      const x = 128 + Math.cos(a) * dist;
      const y = 128 + Math.sin(a) * dist;
      const r = 16 + rand() * 30;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      if (kind === 'soup') {
        g.addColorStop(0, `rgba(218, 138, 42, ${0.72 * dirtAmount})`);
        g.addColorStop(0.65, `rgba(226, 165, 72, ${0.42 * dirtAmount})`);
        g.addColorStop(1, 'rgba(226, 165, 72, 0)');
      } else {
        g.addColorStop(0, `rgba(235, 168, 28, ${0.78 * dirtAmount})`);
        g.addColorStop(0.6, `rgba(240, 198, 92, ${0.45 * dirtAmount})`);
        g.addColorStop(1, 'rgba(240, 198, 92, 0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.needsUpdate = true;
  };

  update(0);
  return { texture: tex, update };
}

/**
 * Soft radial sprite texture for steam puffs, glow sparkles, and flame particles
 */
export function createSoftParticleTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner.replace('1)', '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
