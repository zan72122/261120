import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function heightToNormalCanvas(heightData, w, h, strength = 2.0) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const idx = (x, y) => ((y + h) % h) * w + ((x + w) % w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = heightData[idx(x - 1, y - 1)];
      const t  = heightData[idx(x,     y - 1)];
      const tr = heightData[idx(x + 1, y - 1)];
      const l  = heightData[idx(x - 1, y)];
      const r  = heightData[idx(x + 1, y)];
      const bl = heightData[idx(x - 1, y + 1)];
      const b  = heightData[idx(x,     y + 1)];
      const br = heightData[idx(x + 1, y + 1)];
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      const o = (y * w + x) * 4;
      d[o]     = Math.round(((-dx * invLen) * 0.5 + 0.5) * 255);
      d[o + 1] = Math.round(((dy * invLen) * 0.5 + 0.5) * 255);
      d[o + 2] = Math.round(((dz * invLen) * 0.5 + 0.5) * 255);
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTexture(canvas, { srgb = false, repeat = [1, 1], anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export async function loadPBRSet(loader, basePath, files, { repeat = [1, 1], anisotropy = 4 } = {}) {
  const loadOne = (file, srgb) =>
    new Promise((resolve, reject) => {
      loader.load(
        `${basePath}/${file}`,
        (tex) => {
          tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(repeat[0], repeat[1]);
          tex.anisotropy = anisotropy;
          resolve(tex);
        },
        undefined,
        reject
      );
    });

  const out = {};
  const tasks = [];
  if (files.map) tasks.push(loadOne(files.map, true).then((t) => (out.map = t)));
  if (files.normalMap) tasks.push(loadOne(files.normalMap, false).then((t) => (out.normalMap = t)));
  if (files.roughnessMap) tasks.push(loadOne(files.roughnessMap, false).then((t) => (out.roughnessMap = t)));
  if (files.aoMap) tasks.push(loadOne(files.aoMap, false).then((t) => (out.aoMap = t)));
  await Promise.all(tasks);
  return out;
}

// 1. Cooked Koshihikari Rice packed-grain PBR maps (plump short-grain Japanese rice!)
export function createRiceTextures(anisotropy = 4) {
  const size = 512;
  const rand = mulberry32(104729);
  const colC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const hC = makeCanvas(size, size);
  const hCtx = hC.getContext('2d');
  const rC = makeCanvas(size, size);
  const rCtx = rC.getContext('2d');

  // Warm milky-starch interstitial base (prevents harsh dark gray gaps between rice grains!)
  colCtx.fillStyle = '#ddd6c7';
  colCtx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#404040';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#a8a8a8';
  rCtx.fillRect(0, 0, size, size);

  const count = 1100;
  for (let i = 0; i < count; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    // Plump short-grain Japonica ratio (~1.55:1, chubby pearls!)
    const rx = 10.5 + rand() * 3.8;
    const ry = 6.6 + rand() * 2.2;
    const ang = rand() * Math.PI;
    const lum = 238 + Math.floor(rand() * 14);
    const warm = Math.floor(rand() * 6);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const px = cx + ox * size;
        const py = cy + oy * size;
        if (px < -26 || px > size + 26 || py < -26 || py > size + 26) continue;

        colCtx.save();
        colCtx.translate(px, py);
        colCtx.rotate(ang);
        const grad = colCtx.createRadialGradient(-rx * 0.12, -ry * 0.16, 1, 0, 0, rx * 1.05);
        grad.addColorStop(0, `rgb(${Math.min(255, lum + 5)}, ${Math.min(255, lum + 3)}, ${lum - 5 - warm})`);
        grad.addColorStop(0.72, `rgb(${lum - 6}, ${lum - 8}, ${lum - 16 - warm})`);
        grad.addColorStop(1, `rgb(${lum - 24}, ${lum - 28}, ${lum - 36})`);
        colCtx.fillStyle = grad;
        colCtx.beginPath();
        colCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        colCtx.fill();
        colCtx.restore();

        hCtx.save();
        hCtx.translate(px, py);
        hCtx.rotate(ang);
        const hg = hCtx.createRadialGradient(0, 0, 0.5, 0, 0, rx);
        hg.addColorStop(0, 'rgb(245,245,245)');
        hg.addColorStop(0.68, 'rgb(185,185,185)');
        hg.addColorStop(1, 'rgb(65,65,65)');
        hCtx.fillStyle = hg;
        hCtx.beginPath();
        hCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        hCtx.fill();
        hCtx.restore();

        rCtx.save();
        rCtx.translate(px, py);
        rCtx.rotate(ang);
        const rg = rCtx.createRadialGradient(0, 0, 0.5, 0, 0, rx);
        rg.addColorStop(0, 'rgb(58,58,58)');
        rg.addColorStop(0.72, 'rgb(102,102,102)');
        rg.addColorStop(1, 'rgb(180,180,180)');
        rCtx.fillStyle = rg;
        rCtx.beginPath();
        rCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        rCtx.fill();
        rCtx.restore();
      }
    }
  }

  const hImg = hCtx.getImageData(0, 0, size, size).data;
  const heightFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) heightFloat[i] = hImg[i * 4] / 255;
  const norC = heightToNormalCanvas(heightFloat, size, size, 2.2);

  return {
    map: toTexture(colC, { srgb: true, repeat: [2, 2], anisotropy }),
    normalMap: toTexture(norC, { srgb: false, repeat: [2, 2], anisotropy }),
    roughnessMap: toTexture(rC, { srgb: false, repeat: [2, 2], anisotropy }),
  };
}

// 2. Roasted Yakinori (Japanese dried seaweed) — organic dark olive-black algal fibers
export function createNoriTextures(anisotropy = 4) {
  const size = 512;
  const rand = mulberry32(42913);
  const colC = makeCanvas(size, size);
  const colCtx = colC.getContext('2d');
  const hFloat = new Float32Array(size * size);
  const rC = makeCanvas(size, size);
  const rCtx = rC.getContext('2d');

  // Deep roasted dark olive-charcoal base (NEVER flat #000000)
  colCtx.fillStyle = '#121810';
  colCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#b8b8b8';
  rCtx.fillRect(0, 0, size, size);

  // Subtle organic mottling
  for (let i = 0; i < 180; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 16 + rand() * 44;
    const g = colCtx.createRadialGradient(x, y, 2, x, y, rad);
    const v = rand() > 0.5 ? 'rgba(28, 39, 21, 0.28)' : 'rgba(10, 14, 9, 0.35)';
    g.addColorStop(0, v);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    colCtx.fillStyle = g;
    colCtx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Crisscrossing dried pressed marine algae fibers (gives unmistakable authentic nori micro-relief!)
  const hCanvas = makeCanvas(size, size);
  const hCtx = hCanvas.getContext('2d');
  hCtx.fillStyle = '#707070';
  hCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2400; i++) {
    const x1 = rand() * size;
    const y1 = rand() * size;
    const len = 10 + rand() * 34;
    const ang = rand() * Math.PI * 2;
    const x2 = x1 + Math.cos(ang) * len;
    const y2 = y1 + Math.sin(ang) * len;
    const w = 0.7 + rand() * 2.1;

    const shade = rand();
    const r = Math.floor(14 + shade * 16);
    const g = Math.floor(21 + shade * 24);
    const b = Math.floor(11 + shade * 12);
    colCtx.strokeStyle = `rgba(${r},${g},${b},${0.45 + rand() * 0.45})`;
    colCtx.lineWidth = w;
    colCtx.beginPath();
    colCtx.moveTo(x1, y1);
    colCtx.lineTo(x2, y2);
    colCtx.stroke();

    const hv = Math.floor(110 + shade * 125);
    hCtx.strokeStyle = `rgba(${hv},${hv},${hv},0.55)`;
    hCtx.lineWidth = w;
    hCtx.beginPath();
    hCtx.moveTo(x1, y1);
    hCtx.lineTo(x2, y2);
    hCtx.stroke();

    // Slightly glossier smooth fibers vs matte rough crevices
    const rv = Math.floor(138 + (1 - shade) * 88);
    rCtx.strokeStyle = `rgba(${rv},${rv},${rv},0.5)`;
    rCtx.lineWidth = w;
    rCtx.beginPath();
    rCtx.moveTo(x1, y1);
    rCtx.lineTo(x2, y2);
    rCtx.stroke();
  }

  // Tiny natural crispy micro-pores
  for (let i = 0; i < 320; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 0.6 + rand() * 1.4;
    colCtx.fillStyle = 'rgba(6, 9, 5, 0.75)';
    colCtx.beginPath();
    colCtx.arc(x, y, rad, 0, Math.PI * 2);
    colCtx.fill();

    hCtx.fillStyle = 'rgb(20,20,20)';
    hCtx.beginPath();
    hCtx.arc(x, y, rad, 0, Math.PI * 2);
    hCtx.fill();
  }

  const hd = hCtx.getImageData(0, 0, size, size).data;
  for (let i = 0; i < size * size; i++) hFloat[i] = hd[i * 4] / 255;
  const norC = heightToNormalCanvas(hFloat, size, size, 2.2);

  return {
    map: toTexture(colC, { srgb: true, anisotropy }),
    normalMap: toTexture(norC, { srgb: false, anisotropy }),
    roughnessMap: toTexture(rC, { srgb: false, anisotropy }),
  };
}

// 3. Tamagoyaki (Japanese Rolled Omelette) — spiral cut face + makisu seared outer skin
export function createTamagoyakiTextures(anisotropy = 4) {
  const size = 512;
  const rand = mulberry32(77319);

  // --- Cut face (spiral layered egg!) ---
  const faceC = makeCanvas(size, size);
  const fCtx = faceC.getContext('2d');
  const fhC = makeCanvas(size, size);
  const fhCtx = fhC.getContext('2d');
  const frC = makeCanvas(size, size);
  const frCtx = frC.getContext('2d');

  // Rich warm golden Japanese dashi-maki egg yolk base (appetizing moist yellow-gold, never dry cardboard!)
  const bgGrad = fCtx.createRadialGradient(size * 0.5, size * 0.5, 16, size * 0.5, size * 0.5, size * 0.58);
  bgGrad.addColorStop(0, '#f8d04a');
  bgGrad.addColorStop(0.72, '#efb528');
  bgGrad.addColorStop(1, '#d98f18');
  fCtx.fillStyle = bgGrad;
  fCtx.fillRect(0, 0, size, size);
  fhCtx.fillStyle = '#909090';
  fhCtx.fillRect(0, 0, size, size);
  frCtx.fillStyle = '#686868';
  frCtx.fillRect(0, 0, size, size);

  // Subtle pale egg-white marbling
  for (let i = 0; i < 65; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rx = 18 + rand() * 55;
    const ry = 8 + rand() * 22;
    fCtx.save();
    fCtx.translate(x, y);
    fCtx.rotate((rand() - 0.5) * 0.8);
    fCtx.fillStyle = rand() > 0.35 ? 'rgba(255, 244, 198, 0.26)' : 'rgba(224, 152, 34, 0.22)';
    fCtx.beginPath();
    fCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    fCtx.fill();
    fCtx.restore();
  }

  // Authentic spiral rolled layers (golden-brown cooked layer boundaries!)
  const drawSpiral = (ctx, strokeStyle, lineWidth, jitter = 0) => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const cx = size * 0.5;
    const cy = size * 0.5;
    const steps = 260;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const theta = t * Math.PI * 6.4;
      const rx = (0.04 + t * 0.43) * size;
      const ry = (0.03 + t * 0.40) * size;
      // Squircle spiral matching rectangular tamagoyaki cross-section
      const ca = Math.cos(theta);
      const sa = Math.sin(theta);
      const sx = Math.sign(ca) * Math.pow(Math.abs(ca), 0.72);
      const sy = Math.sign(sa) * Math.pow(Math.abs(sa), 0.72);
      const wob = Math.sin(t * 42) * 3.5 + jitter;
      const x = cx + sx * (rx + wob);
      const y = cy + sy * (ry + wob * 0.7);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  drawSpiral(fCtx, 'rgba(176, 102, 26, 0.58)', 9);
  drawSpiral(fCtx, 'rgba(255, 238, 174, 0.45)', 4, 4);
  drawSpiral(fCtx, 'rgba(138, 72, 16, 0.45)', 3.5, -2);

  drawSpiral(fhCtx, 'rgba(42, 42, 42, 0.75)', 7);
  drawSpiral(frCtx, 'rgba(150, 150, 150, 0.55)', 7);

  // Tiny fluffy dashi-egg micro-bubbles/pores on cut face
  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 0.8 + rand() * 2.4;
    fCtx.fillStyle = rand() > 0.3 ? 'rgba(190, 128, 32, 0.25)' : 'rgba(255, 245, 200, 0.22)';
    fCtx.beginPath();
    fCtx.arc(x, y, rad, 0, Math.PI * 2);
    fCtx.fill();

    fhCtx.fillStyle = 'rgba(30,30,30,0.6)';
    fhCtx.beginPath();
    fhCtx.arc(x, y, rad, 0, Math.PI * 2);
    fhCtx.fill();
  }

  const fhd = fhCtx.getImageData(0, 0, size, size).data;
  const fhFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) fhFloat[i] = fhd[i * 4] / 255;
  const faceNorC = heightToNormalCanvas(fhFloat, size, size, 1.8);

  // --- Outer seared skin with subtle makisu grooves ---
  const outC = makeCanvas(size, size);
  const oCtx = outC.getContext('2d');
  const ohC = makeCanvas(size, size);
  const ohCtx = ohC.getContext('2d');
  const orC = makeCanvas(size, size);
  const orCtx = orC.getContext('2d');

  oCtx.fillStyle = '#e7ac26';
  oCtx.fillRect(0, 0, size, size);
  ohCtx.fillStyle = '#888888';
  ohCtx.fillRect(0, 0, size, size);
  orCtx.fillStyle = '#585858'; // subtle cooked oil sheen
  orCtx.fillRect(0, 0, size, size);

  // Caramelized golden-brown skillet browning patches (yakime!)
  for (let i = 0; i < 95; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 20 + rand() * 64;
    const g = oCtx.createRadialGradient(x, y, 4, x, y, rad);
    const brown = rand() > 0.30;
    g.addColorStop(0, brown ? 'rgba(155, 76, 12, 0.52)' : 'rgba(252, 212, 74, 0.36)');
    g.addColorStop(1, 'rgba(155, 76, 12, 0)');
    oCtx.fillStyle = g;
    oCtx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Subtle makisu bamboo rolling mat parallel ribs
  const ribs = 16;
  for (let i = 0; i < ribs; i++) {
    const y = (i / ribs) * size;
    const h = size / ribs;
    const g = ohCtx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgb(110,110,110)');
    g.addColorStop(0.5, 'rgb(175,175,175)');
    g.addColorStop(1, 'rgb(110,110,110)');
    ohCtx.fillStyle = g;
    ohCtx.fillRect(0, y, size, h);
  }

  // Fine cooked egg dimples
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 1 + rand() * 3;
    ohCtx.fillStyle = rand() > 0.5 ? 'rgba(210,210,210,0.35)' : 'rgba(55,55,55,0.35)';
    ohCtx.beginPath();
    ohCtx.arc(x, y, rad, 0, Math.PI * 2);
    ohCtx.fill();

    orCtx.fillStyle = rand() > 0.5 ? 'rgba(130,130,130,0.35)' : 'rgba(72,72,72,0.35)';
    orCtx.beginPath();
    orCtx.arc(x, y, rad * 1.5, 0, Math.PI * 2);
    orCtx.fill();
  }

  const ohd = ohCtx.getImageData(0, 0, size, size).data;
  const ohFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) ohFloat[i] = ohd[i * 4] / 255;
  const outNorC = heightToNormalCanvas(ohFloat, size, size, 1.5);

  return {
    face: {
      map: toTexture(faceC, { srgb: true, anisotropy }),
      normalMap: toTexture(faceNorC, { srgb: false, anisotropy }),
      roughnessMap: toTexture(frC, { srgb: false, anisotropy }),
    },
    outer: {
      map: toTexture(outC, { srgb: true, anisotropy }),
      normalMap: toTexture(outNorC, { srgb: false, anisotropy }),
      roughnessMap: toTexture(orC, { srgb: false, anisotropy }),
    },
  };
}

// 4. Cherry Tomato realistic natural ripe skin (NOT uniform toy red!)
export function createTomatoTextures(anisotropy = 4) {
  const size = 512;
  const rand = mulberry32(99173);
  const colC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const hC = makeCanvas(size, size);
  const hCtx = hC.getContext('2d');
  const rC = makeCanvas(size, size);
  const rCtx = rC.getContext('2d');

  // Vertical ripening gradient: warm subtle orange-red shoulder at top (v=0) -> deep crimson body -> rich dark ruby bottom
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0.0, '#b53a16');
  g.addColorStop(0.14, '#bd2212');
  g.addColorStop(0.55, '#ad140c');
  g.addColorStop(1.0, '#8d0e09');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#383838'; // fresh smooth waxy skin ~0.22 roughness
  rCtx.fillRect(0, 0, size, size);

  // Faint natural mottled ripening depth
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 18 + rand() * 55;
    const mg = ctx.createRadialGradient(x, y, 2, x, y, rad);
    mg.addColorStop(0, rand() > 0.5 ? 'rgba(130, 12, 8, 0.16)' : 'rgba(218, 56, 22, 0.12)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Subtle natural pale gold/yellowish micro-lenticel speckles real cherry tomatoes have!
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 0.4 + rand() * 1.1;
    ctx.fillStyle = `rgba(246, 175, 110, ${0.06 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle waxy micro-irregularity in roughness & height
  for (let i = 0; i < 240; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 6 + rand() * 20;
    rCtx.fillStyle = rand() > 0.5 ? 'rgba(72,72,72,0.18)' : 'rgba(34,34,34,0.18)';
    rCtx.beginPath();
    rCtx.arc(x, y, rad, 0, Math.PI * 2);
    rCtx.fill();

    hCtx.fillStyle = rand() > 0.5 ? 'rgba(142,142,142,0.15)' : 'rgba(114,114,114,0.15)';
    hCtx.beginPath();
    hCtx.arc(x, y, rad, 0, Math.PI * 2);
    hCtx.fill();
  }

  const hd = hCtx.getImageData(0, 0, size, size).data;
  const hFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) hFloat[i] = hd[i * 4] / 255;
  const norC = heightToNormalCanvas(hFloat, size, size, 0.7);

  return {
    map: toTexture(colC, { srgb: true, anisotropy }),
    normalMap: toTexture(norC, { srgb: false, anisotropy }),
    roughnessMap: toTexture(rC, { srgb: false, anisotropy }),
  };
}

// 5. Crisp Green Lettuce / Shiso Divider Leaf
export function createLeafTextures(anisotropy = 4) {
  const size = 512;
  const rand = mulberry32(31415);
  const colC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const hC = makeCanvas(size, size);
  const hCtx = hC.getContext('2d');

  // Natural fresh leafy green gradient (lighter pale crisp stem-center -> richer green ruffled margin)
  const g = ctx.createLinearGradient(0, size, 0, 0);
  g.addColorStop(0.0, '#96b95e');
  g.addColorStop(0.35, '#598d35');
  g.addColorStop(0.85, '#3b6d22');
  g.addColorStop(1.0, '#4c7c2c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  hCtx.fillStyle = '#7c7c7c';
  hCtx.fillRect(0, 0, size, size);

  // Subtle mottled chlorophyll variation
  for (let i = 0; i < 120; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 14 + rand() * 48;
    const mg = ctx.createRadialGradient(x, y, 2, x, y, r);
    mg.addColorStop(0, rand() > 0.5 ? 'rgba(130, 172, 68, 0.16)' : 'rgba(34, 72, 18, 0.16)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Central pale crisp midrib + branching lateral veins
  ctx.strokeStyle = 'rgba(182, 212, 128, 0.72)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size);
  ctx.quadraticCurveTo(size * 0.49, size * 0.5, size * 0.5, size * 0.08);
  ctx.stroke();

  hCtx.strokeStyle = 'rgb(225,225,225)';
  hCtx.lineWidth = 12;
  hCtx.beginPath();
  hCtx.moveTo(size * 0.5, size);
  hCtx.quadraticCurveTo(size * 0.49, size * 0.5, size * 0.5, size * 0.08);
  hCtx.stroke();

  for (let i = 1; i <= 8; i++) {
    const y0 = size * (0.92 - i * 0.095);
    const span = size * (0.38 - Math.abs(i - 4) * 0.04);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = 'rgba(168, 202, 110, 0.55)';
      ctx.lineWidth = 4 - i * 0.25;
      ctx.beginPath();
      ctx.moveTo(size * 0.5, y0);
      ctx.quadraticCurveTo(size * 0.5 + side * span * 0.55, y0 - 18, size * 0.5 + side * span, y0 - 52);
      ctx.stroke();

      hCtx.strokeStyle = 'rgb(190,190,190)';
      hCtx.lineWidth = 5 - i * 0.25;
      hCtx.beginPath();
      hCtx.moveTo(size * 0.5, y0);
      hCtx.quadraticCurveTo(size * 0.5 + side * span * 0.55, y0 - 18, size * 0.5 + side * span, y0 - 52);
      hCtx.stroke();
    }
  }

  // Fine organic crinkle bump
  for (let i = 0; i < 400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 4 + rand() * 14;
    hCtx.fillStyle = rand() > 0.5 ? 'rgba(165,165,165,0.22)' : 'rgba(85,85,85,0.22)';
    hCtx.beginPath();
    hCtx.arc(x, y, r, 0, Math.PI * 2);
    hCtx.fill();
  }

  const hd = hCtx.getImageData(0, 0, size, size).data;
  const hFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) hFloat[i] = hd[i * 4] / 255;
  const norC = heightToNormalCanvas(hFloat, size, size, 1.8);

  return {
    map: toTexture(colC, { srgb: true, anisotropy }),
    normalMap: toTexture(norC, { srgb: false, anisotropy }),
  };
}

// 6. Lifelike Human Skin (matte-satin natural warmth, subtle rosy variation, fine skin grain)
export function createSkinTextures({ warmTone = '#e0ae8e', seed = 5511, anisotropy = 4 } = {}) {
  const size = 512;
  const rand = mulberry32(seed);
  const colC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const hC = makeCanvas(size, size);
  const hCtx = hC.getContext('2d');
  const rC = makeCanvas(size, size);
  const rCtx = rC.getContext('2d');

  ctx.fillStyle = warmTone;
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#aeaeae'; // ~0.68 natural soft matte skin roughness (zero plastic shine!)
  rCtx.fillRect(0, 0, size, size);

  // Organic subcutaneous warmth (rosy hemoglobin & golden melanin variation)
  for (let i = 0; i < 200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 18 + rand() * 68;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const pick = rand();
    if (pick < 0.45) {
      g.addColorStop(0, 'rgba(205, 118, 98, 0.11)');
    } else if (pick < 0.78) {
      g.addColorStop(0, 'rgba(244, 206, 178, 0.10)');
    } else {
      g.addColorStop(0, 'rgba(170, 120, 96, 0.08)');
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fine skin micro-pores & delicate cross-hatch skin grain
  for (let i = 0; i < 2800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const rad = 0.6 + rand() * 1.4;
    hCtx.fillStyle = rand() > 0.4 ? 'rgba(98,98,98,0.25)' : 'rgba(158,158,158,0.22)';
    hCtx.beginPath();
    hCtx.arc(x, y, rad, 0, Math.PI * 2);
    hCtx.fill();

    rCtx.fillStyle = rand() > 0.5 ? 'rgba(186,186,186,0.22)' : 'rgba(148,148,148,0.22)';
    rCtx.beginPath();
    rCtx.arc(x, y, rad * 2.2, 0, Math.PI * 2);
    rCtx.fill();
  }

  // Subtle horizontal knuckle/palm micro-creases
  for (let i = 0; i < 85; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 14 + rand() * 38;
    hCtx.strokeStyle = 'rgba(85,85,85,0.26)';
    hCtx.lineWidth = 1.1;
    hCtx.beginPath();
    hCtx.moveTo(x, y);
    hCtx.lineTo(x + len, y + (rand() - 0.5) * 4);
    hCtx.stroke();
  }

  const hd = hCtx.getImageData(0, 0, size, size).data;
  const hFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) hFloat[i] = hd[i * 4] / 255;
  const norC = heightToNormalCanvas(hFloat, size, size, 0.72);

  return {
    map: toTexture(colC, { srgb: true, repeat: [2, 2], anisotropy }),
    normalMap: toTexture(norC, { srgb: false, repeat: [2, 2], anisotropy }),
    roughnessMap: toTexture(rC, { srgb: false, repeat: [2, 2], anisotropy }),
  };
}

// 6b. Cozy Soft Ribbed Cotton Knit Sleeve Texture (distinct from tablecloth!)
export function createKnitSleeveTextures(baseColor = '#d8b7ab', anisotropy = 4) {
  const size = 256;
  const rand = mulberry32(6041);
  const colC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const hC = makeCanvas(size, size);
  const hCtx = hC.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#808080';
  hCtx.fillRect(0, 0, size, size);

  // Fine vertical cotton knit ribs + soft heather melange
  const ribs = 32;
  const rw = size / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = i * rw;
    const g = hCtx.createLinearGradient(x, 0, x + rw, 0);
    g.addColorStop(0, 'rgb(75,75,75)');
    g.addColorStop(0.5, 'rgb(205,205,205)');
    g.addColorStop(1, 'rgb(75,75,75)');
    hCtx.fillStyle = g;
    hCtx.fillRect(x, 0, rw, size);

    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,250,245,0.06)' : 'rgba(80,50,45,0.06)';
    ctx.fillRect(x, 0, rw, size);
  }
  for (let y = 0; y < size; y += 6) {
    hCtx.strokeStyle = 'rgba(110,110,110,0.28)';
    hCtx.lineWidth = 1.5;
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    hCtx.lineTo(size, y);
    hCtx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(60,40,35,0.06)';
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }

  const hd = hCtx.getImageData(0, 0, size, size).data;
  const hFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) hFloat[i] = hd[i * 4] / 255;
  const norC = heightToNormalCanvas(hFloat, size, size, 1.5);

  return {
    map: toTexture(colC, { srgb: true, repeat: [3, 2], anisotropy }),
    normalMap: toTexture(norC, { srgb: false, repeat: [3, 2], anisotropy }),
  };
}

// 7. Soft photographic Contact Shadow texture (elliptical ambient occlusion under resting objects)
export function createContactShadowTexture() {
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
  g.addColorStop(0.0, 'rgba(18, 11, 6, 0.72)');
  g.addColorStop(0.45, 'rgba(20, 12, 7, 0.44)');
  g.addColorStop(0.75, 'rgba(22, 14, 8, 0.14)');
  g.addColorStop(1.0, 'rgba(22, 14, 8, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 8. Delicate sunlit rising steam wisp sprite
export function createSteamTexture() {
  const size = 128;
  const rand = mulberry32(8821);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 18; i++) {
    const x = size * (0.34 + rand() * 0.32);
    const y = size * (0.34 + rand() * 0.32);
    const r = size * (0.14 + rand() * 0.22);
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(255, 252, 245, 0.16)');
    g.addColorStop(0.6, 'rgba(255, 250, 242, 0.06)');
    g.addColorStop(1, 'rgba(255, 250, 242, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}


// 9. Warm Japanese Ceramic Kitchen Backsplash Tiles (subtle off-white glazed tiles with realistic mortar grout)
export function createKitchenTileTextures(anisotropy = 4) {
  const size = 512;
  const rand = mulberry32(51203);
  const colC = makeCanvas(size, size);
  const ctx = colC.getContext('2d');
  const hC = makeCanvas(size, size);
  const hCtx = hC.getContext('2d');
  const rC = makeCanvas(size, size);
  const rCtx = rC.getContext('2d');

  ctx.fillStyle = '#c8bfb2';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#383838';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#e0e0e0';
  rCtx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 8;
  const tw = size / cols;
  const th = size / rows;
  const grout = 5;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset + grout * 0.5;
      const y = r * th + grout * 0.5;
      const w = tw - grout;
      const h = th - grout;
      const v = 234 + Math.floor((rand() - 0.5) * 14);
      const warm = Math.floor(rand() * 8);
      ctx.fillStyle = `rgb(${v}, ${v - 4 - warm * 0.3}, ${v - 12 - warm})`;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = 'rgba(175, 162, 145, 0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      const hg = hCtx.createLinearGradient(x, y, x, y + h);
      hg.addColorStop(0, 'rgb(175,175,175)');
      hg.addColorStop(0.5, 'rgb(235,235,235)');
      hg.addColorStop(1, 'rgb(175,175,175)');
      hCtx.fillStyle = hg;
      hCtx.fillRect(x, y, w, h);

      const rv = 66 + Math.floor(rand() * 22);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x, y, w, h);
    }
  }

  const hd = hCtx.getImageData(0, 0, size, size).data;
  const hFloat = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) hFloat[i] = hd[i * 4] / 255;
  const norC = heightToNormalCanvas(hFloat, size, size, 1.4);

  return {
    map: toTexture(colC, { srgb: true, repeat: [6, 1.4], anisotropy }),
    normalMap: toTexture(norC, { srgb: false, repeat: [6, 1.4], anisotropy }),
    roughnessMap: toTexture(rC, { srgb: false, repeat: [6, 1.4], anisotropy }),
  };
}


// 10. Crisp Japanese Akita-sugi Cedar Wood Grain (for authentic Magewappa bentwood bento box, paired with Poly Haven cherry_veneer normal/roughness!)
export function createCedarWoodTexture(anisotropy = 4) {
  const size = 512;
  const rand = mulberry32(93211);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  // Warm natural hinoki/cedar wood base
  ctx.fillStyle = '#d9b589';
  ctx.fillRect(0, 0, size, size);

  // Authentic fine straight Japanese cedar growth rings (masame grain!)
  for (let y = 0; y < size; y++) {
    const wave = Math.sin(y * 0.045) * 0.5 + Math.sin(y * 0.19 + 1.2) * 0.3 + Math.sin(y * 0.52) * 0.2;
    const ring = Math.pow(0.5 + 0.5 * wave, 2.2);
    const r = Math.round(182 + ring * 52 + (rand() - 0.5) * 6);
    const g = Math.round(134 + ring * 54 + (rand() - 0.5) * 5);
    const b = Math.round(86 + ring * 46 + (rand() - 0.5) * 4);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Subtle natural fine wood fiber streaks & warm organic tonal shifts
  for (let i = 0; i < 420; i++) {
    const y = rand() * size;
    const x = rand() * size;
    const w = 60 + rand() * 240;
    const h = 1 + rand() * 2.4;
    ctx.fillStyle = rand() > 0.45 ? 'rgba(138, 86, 40, 0.16)' : 'rgba(246, 224, 188, 0.14)';
    ctx.fillRect(x, y, w, h);
    if (x + w > size) ctx.fillRect(x - size, y, w, h);
  }

  // Gentle organic wood cathedral/wave sheen
  for (let i = 0; i < 18; i++) {
    const y = rand() * size;
    ctx.strokeStyle = 'rgba(126, 76, 36, 0.18)';
    ctx.lineWidth = 1.5 + rand() * 2.0;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 + i) * (4 + rand() * 3);
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  return toTexture(c, { srgb: true, repeat: [1, 1], anisotropy });
}
