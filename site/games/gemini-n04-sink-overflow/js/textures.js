import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Seeded deterministic PRNG so textures always look crisp and curated
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBrushedSteelTextures() {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const rough = makeCanvas(w, h);
  const bump = makeCanvas(w, h);

  const cCtx = col.getContext('2d');
  const rCtx = rough.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rand = mulberry32(101);

  cCtx.fillStyle = '#9aa3aa';
  cCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = '#4c4c4c';
  rCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  // Fine directional brushed grain
  for (let i = 0; i < 4800; i++) {
    const y = rand() * h;
    const x = rand() * w;
    const len = 30 + rand() * 140;
    const v = Math.floor(148 + (rand() - 0.5) * 44);
    cCtx.strokeStyle = `rgba(${v},${v + 3},${v + 7},0.28)`;
    cCtx.lineWidth = 0.6 + rand() * 1.1;
    cCtx.beginPath();
    cCtx.moveTo(x, y);
    cCtx.lineTo(x + len, y + (rand() - 0.5) * 1.2);
    cCtx.stroke();

    const rv = Math.floor(62 + rand() * 58);
    rCtx.strokeStyle = `rgba(${rv},${rv},${rv},0.28)`;
    rCtx.lineWidth = 0.8 + rand() * 1.1;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + len, y);
    rCtx.stroke();

    const bv = Math.floor(110 + rand() * 36);
    bCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.3)`;
    bCtx.lineWidth = 0.7;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + len, y);
    bCtx.stroke();
  }

  // Subtle realistic sink micro-scratches
  for (let i = 0; i < 65; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI * 2;
    const l = 12 + rand() * 45;
    rCtx.strokeStyle = 'rgba(130,130,130,0.16)';
    rCtx.lineWidth = 0.6;
    rCtx.beginPath();
    rCtx.moveTo(x, y);
    rCtx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    rCtx.stroke();
  }

  const map = new THREE.CanvasTexture(col);
  const roughnessMap = new THREE.CanvasTexture(rough);
  const bumpMap = new THREE.CanvasTexture(bump);
  [map, roughnessMap, bumpMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
  });
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, roughnessMap, bumpMap };
}

export function createMarbleTextures() {
  const w = 1024, h = 512;
  const col = makeCanvas(w, h);
  const rough = makeCanvas(w, h);
  const cCtx = col.getContext('2d');
  const rCtx = rough.getContext('2d');
  const rand = mulberry32(202);

  // Warm honed Calacatta limestone/marble base (rich enough that white foam & glossy water pop!)
  const grad = cCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#ded6c9');
  grad.addColorStop(0.5, '#d8cfc1');
  grad.addColorStop(1, '#d1c7b8');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, w, h);

  rCtx.fillStyle = '#424242'; // satin-polished stone
  rCtx.fillRect(0, 0, w, h);

  // Soft cloudy mineral patches
  for (let i = 0; i < 90; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 40 + rand() * 140;
    const g = cCtx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rand() > 0.5 ? 'rgba(170,156,140,0.14)' : 'rgba(245,239,230,0.16)';
    g.addColorStop(0, tone);
    g.addColorStop(1, 'rgba(220,212,200,0)');
    cCtx.fillStyle = g;
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();
  }

  // Delicate natural mineral veins
  for (let v = 0; v < 30; v++) {
    let x = rand() * w;
    let y = rand() * h;
    let angle = -0.35 + (rand() - 0.5) * 0.7;
    const steps = 40 + Math.floor(rand() * 55);
    const width = 0.8 + rand() * 3.8;
    const warm = rand() > 0.35;
    cCtx.strokeStyle = warm
      ? `rgba(146,132,116,${0.14 + rand() * 0.16})`
      : `rgba(128,124,119,${0.12 + rand() * 0.15})`;
    cCtx.lineWidth = width;
    cCtx.lineCap = 'round';
    cCtx.beginPath();
    cCtx.moveTo(x, y);

    rCtx.strokeStyle = `rgba(95,95,95,${0.12 + rand() * 0.12})`;
    rCtx.lineWidth = width * 1.2;
    rCtx.beginPath();
    rCtx.moveTo(x, y);

    for (let s = 0; s < steps; s++) {
      angle += (rand() - 0.5) * 0.38;
      x += Math.cos(angle) * 14;
      y += Math.sin(angle) * 14;
      cCtx.lineTo(x, y);
      rCtx.lineTo(x, y);
    }
    cCtx.stroke();
    rCtx.stroke();
  }

  // Tiny mineral speckles
  for (let i = 0; i < 1200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    cCtx.fillStyle = `rgba(165,155,142,${0.05 + rand() * 0.1})`;
    cCtx.fillRect(x, y, 1.5, 1.5);
  }

  const map = new THREE.CanvasTexture(col);
  const roughnessMap = new THREE.CanvasTexture(rough);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap };
}

export function createSubwayTileTextures() {
  const w = 1024, h = 1024;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const rough = makeCanvas(w, h);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rCtx = rough.getContext('2d');
  const rand = mulberry32(303);

  // Warm stone-grey grout
  cCtx.fillStyle = '#8b928d';
  cCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#303030';
  bCtx.fillRect(0, 0, w, h);
  rCtx.fillStyle = '#d4d4d4'; // matte grout
  rCtx.fillRect(0, 0, w, h);

  const cols = 6;
  const rows = 12;
  const tw = w / cols;
  const th = h / rows;
  const gap = 5;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (tw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + offset + gap * 0.5;
      const y = r * th + gap * 0.5;
      const bw = tw - gap;
      const bh = th - gap;

      // Handmade glazed misty sage-celadon ceramic tiles (editorial kitchen contrast for chrome, glass & white foam!)
      const vr = 166 + Math.floor((rand() - 0.5) * 14);
      const vg = 179 + Math.floor((rand() - 0.5) * 14);
      const vb = 174 + Math.floor((rand() - 0.5) * 12);
      const grad = cCtx.createLinearGradient(x, y, x + bw, y + bh);
      grad.addColorStop(0, `rgb(${vr + 6},${vg + 6},${vb + 5})`);
      grad.addColorStop(0.5, `rgb(${vr},${vg},${vb})`);
      grad.addColorStop(1, `rgb(${vr - 8},${vg - 7},${vb - 7})`);
      cCtx.fillStyle = grad;
      roundRect(cCtx, x, y, bw, bh, 5);
      cCtx.fill();

      // Subtle beveled pillow bump for realistic glazed ceramic light catch
      const bGrad = bCtx.createRadialGradient(
        x + bw * 0.5, y + bh * 0.5, Math.min(bw, bh) * 0.1,
        x + bw * 0.5, y + bh * 0.5, Math.max(bw, bh) * 0.65
      );
      bGrad.addColorStop(0, '#f2f2f2');
      bGrad.addColorStop(0.75, '#dcdcdc');
      bGrad.addColorStop(1, '#a0a0a0');
      bCtx.fillStyle = bGrad;
      roundRect(bCtx, x, y, bw, bh, 5);
      bCtx.fill();

      // Glossy glaze roughness
      const rv = 26 + Math.floor(rand() * 20);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      roundRect(rCtx, x, y, bw, bh, 5);
      rCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(col);
  const bumpMap = new THREE.CanvasTexture(bump);
  const roughnessMap = new THREE.CanvasTexture(rough);
  map.colorSpace = THREE.SRGBColorSpace;
  [map, bumpMap, roughnessMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.2, 1.45);
  });
  return { map, bumpMap, roughnessMap };
}

export function createOakWoodTextures() {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rand = mulberry32(404);

  cCtx.fillStyle = '#a87b4e';
  cCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  // Horizontal oak grain bands
  for (let y = 0; y < h; y += 2) {
    const wave = Math.sin(y * 0.045) * 12 + Math.sin(y * 0.14) * 5;
    const tone = Math.floor(wave + (rand() - 0.5) * 14);
    cCtx.fillStyle = `rgb(${168 + tone},${124 + Math.floor(tone * 0.78)},${78 + Math.floor(tone * 0.55)})`;
    cCtx.fillRect(0, y, w, 2.5);
  }

  // Fine wood fiber streaks
  for (let i = 0; i < 1600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 30 + rand() * 130;
    const dark = rand() > 0.35;
    cCtx.strokeStyle = dark ? 'rgba(115,75,40,0.16)' : 'rgba(235,204,165,0.14)';
    cCtx.lineWidth = 0.7 + rand() * 1.4;
    cCtx.beginPath();
    cCtx.moveTo(x, y);
    cCtx.bezierCurveTo(x + len * 0.33, y + (rand() - 0.5) * 5, x + len * 0.66, y + (rand() - 0.5) * 5, x + len, y);
    cCtx.stroke();

    const bv = dark ? 105 : 148;
    bCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.35)`;
    bCtx.lineWidth = 1;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + len, y);
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(col);
  const bumpMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

export function createTowelTextures() {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');

  // Warm cream organic linen-cotton base
  cCtx.fillStyle = '#f8f2e8';
  cCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  // Soft rose-terracotta woven stripes near the edges
  cCtx.fillStyle = '#d98a7c';
  cCtx.fillRect(0, 56, w, 16);
  cCtx.fillRect(0, 82, w, 6);
  cCtx.fillRect(0, h - 72, w, 16);
  cCtx.fillRect(0, h - 90, w, 6);

  // Waffle-weave texture
  const cell = 12;
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      // Subtle shading in waffle pocket
      cCtx.fillStyle = 'rgba(120,100,82,0.08)';
      cCtx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      cCtx.fillStyle = 'rgba(255,255,255,0.22)';
      cCtx.fillRect(x, y, cell, 2);
      cCtx.fillRect(x, y, 2, cell);

      // High-contrast bump for tactile fabric feel
      bCtx.fillStyle = '#d8d8d8';
      bCtx.fillRect(x, y, cell, cell);
      bCtx.fillStyle = '#484848';
      bCtx.fillRect(x + 2.5, y + 2.5, cell - 5, cell - 5);
    }
  }

  const map = new THREE.CanvasTexture(col);
  const bumpMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

export function createSpongeTextures() {
  const w = 256, h = 256;
  const col = makeCanvas(w, h);
  const bump = makeCanvas(w, h);
  const cCtx = col.getContext('2d');
  const bCtx = bump.getContext('2d');
  const rand = mulberry32(505);

  cCtx.fillStyle = '#f2c338';
  cCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#c8c8c8';
  bCtx.fillRect(0, 0, w, h);

  // Cellulose pores
  for (let i = 0; i < 950; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 1.2 + Math.pow(rand(), 2.2) * 7.5;
    cCtx.fillStyle = `rgba(195,134,16,${0.25 + rand() * 0.45})`;
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();

    const bv = Math.floor(30 + rand() * 45);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Green fibrous scouring pad texture
  const gCol = makeCanvas(w, h);
  const gBump = makeCanvas(w, h);
  const gc = gCol.getContext('2d');
  const gb = gBump.getContext('2d');
  gc.fillStyle = '#2d6e47';
  gc.fillRect(0, 0, w, h);
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI * 2;
    const l = 6 + rand() * 14;
    gc.strokeStyle = rand() > 0.5 ? 'rgba(65,140,92,0.5)' : 'rgba(22,68,40,0.55)';
    gc.lineWidth = 1.2;
    gc.beginPath();
    gc.moveTo(x, y);
    gc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    gc.stroke();

    const bv = rand() > 0.5 ? 210 : 50;
    gb.strokeStyle = `rgba(${bv},${bv},${bv},0.6)`;
    gb.lineWidth = 1.2;
    gb.beginPath();
    gb.moveTo(x, y);
    gb.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    gb.stroke();
  }

  const yellowMap = new THREE.CanvasTexture(col);
  const yellowBump = new THREE.CanvasTexture(bump);
  const greenMap = new THREE.CanvasTexture(gCol);
  const greenBump = new THREE.CanvasTexture(gBump);
  yellowMap.colorSpace = THREE.SRGBColorSpace;
  greenMap.colorSpace = THREE.SRGBColorSpace;
  return { yellowMap, yellowBump, greenMap, greenBump };
}

export function createCorkCoasterTexture() {
  const w = 256, h = 256;
  const col = makeCanvas(w, h);
  const ctx = col.getContext('2d');
  const rand = mulberry32(606);

  ctx.fillStyle = '#c59d70';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 1 + rand() * 4.5;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(150,108,66,0.35)' : 'rgba(222,190,148,0.32)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function createCausticsTexture() {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rand = mulberry32(707);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  // Soft overlapping bright caustic rings
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 42; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 18 + rand() * 46;
    ctx.strokeStyle = `rgba(180,225,255,${0.12 + rand() * 0.14})`;
    ctx.lineWidth = 3 + rand() * 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Per-dish erasable dirt texture (painted stains that physically disappear when scrubbed!)
export function createDishDirtCanvas(themeIndex, roundSeed = 0) {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(900 + themeIndex * 37 + roundSeed * 113);

  const palettes = [
    // Round 0: appetizing everyday kitchen stains (tomato, berry jam, chocolate, cocoa, butter-jam)
    [
      ['rgba(192,48,32,0.88)', 'rgba(218,74,42,0.72)', 'rgba(148,30,18,0.7)'], // tomato sauce
      ['rgba(176,34,78,0.84)', 'rgba(212,68,108,0.68)', 'rgba(130,20,58,0.65)'], // strawberry/berry jam
      ['rgba(104,58,34,0.88)', 'rgba(136,84,52,0.72)', 'rgba(78,42,22,0.72)'], // hot cocoa
      ['rgba(225,134,38,0.76)', 'rgba(244,186,88,0.65)', 'rgba(196,98,24,0.62)'], // orange juice / honey
      ['rgba(122,64,34,0.85)', 'rgba(194,48,74,0.78)', 'rgba(232,172,62,0.72)'] // cake chocolate & jam
    ],
    // Round 1+: varied fun afternoon tea/cooking stains
    [
      ['rgba(96,52,132,0.82)', 'rgba(134,78,172,0.68)', 'rgba(66,32,96,0.72)'], // blueberry jam
      ['rgba(92,138,62,0.82)', 'rgba(134,174,88,0.68)', 'rgba(68,106,44,0.7)'], // matcha cream
      ['rgba(216,112,48,0.84)', 'rgba(238,158,76,0.68)', 'rgba(176,78,24,0.7)'], // pumpkin soup / curry
      ['rgba(212,68,102,0.76)', 'rgba(238,118,144,0.62)', 'rgba(166,42,72,0.62)'], // strawberry milk
      ['rgba(108,58,30,0.86)', 'rgba(164,98,52,0.72)', 'rgba(218,144,58,0.7)'] // caramel chocolate
    ]
  ];

  const set = palettes[roundSeed % palettes.length];
  const colors = set[themeIndex % set.length];

  function paintStains() {
    ctx.clearRect(0, 0, size, size);
    const cx = size * 0.5;
    const cy = size * 0.5;

    // Organic sauce swirls & smudges
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const dist = rand() * size * 0.28;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      const rx = 14 + rand() * 34;
      const ry = 10 + rand() * 28;
      const rot = rand() * Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Playful spoon-swirl streaks
    for (let s = 0; s < 5; s++) {
      ctx.strokeStyle = colors[s % colors.length];
      ctx.lineWidth = 8 + rand() * 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const startA = rand() * Math.PI * 2;
      const r0 = 18 + rand() * 48;
      ctx.arc(cx, cy, r0, startA, startA + 0.8 + rand() * 1.4);
      ctx.stroke();
    }

    // Little berry seeds / crumbs for photoreal detail
    for (let d = 0; d < 28; d++) {
      const a = rand() * Math.PI * 2;
      const dist = rand() * size * 0.34;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      ctx.fillStyle = colors[2];
      ctx.beginPath();
      ctx.arc(x, y, 2 + rand() * 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  paintStains();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture, repaint: paintStains };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
