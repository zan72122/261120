import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, { srgb = true, repeat = null, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

// 1. Brushed Stainless Steel Counter PBR maps
export function createBrushedSteelTextures() {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const rgh = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const cc = col.getContext('2d');
  const rc = rgh.getContext('2d');
  const bc = bmp.getContext('2d');

  cc.fillStyle = '#cfd4d8';
  cc.fillRect(0, 0, w, h);
  rc.fillStyle = '#484848';
  rc.fillRect(0, 0, w, h);
  bc.fillStyle = '#808080';
  bc.fillRect(0, 0, w, h);

  // Fine horizontal brushed grain lines
  for (let i = 0; i < 2400; i++) {
    const y = Math.random() * h;
    const x = Math.random() * w;
    const len = 50 + Math.random() * 240;
    const v = Math.floor(195 + Math.random() * 35);
    cc.fillStyle = `rgba(${v},${v + 2},${v + 5},0.16)`;
    cc.fillRect(x, y, len, 1);

    const rv = Math.floor(45 + Math.random() * 65);
    rc.fillStyle = `rgba(${rv},${rv},${rv},0.22)`;
    rc.fillRect(x, y, len, 1.2);

    const bv = Math.floor(110 + Math.random() * 36);
    bc.fillStyle = `rgba(${bv},${bv},${bv},0.22)`;
    bc.fillRect(x, y, len, 1);
  }

  // Subtle realistic counter micro-scuffs from grocery baskets
  for (let i = 0; i < 40; i++) {
    const x1 = Math.random() * w;
    const y1 = Math.random() * h;
    const ang = (Math.random() - 0.5) * 0.4;
    const len = 25 + Math.random() * 90;
    rc.strokeStyle = 'rgba(130,130,130,0.18)';
    rc.lineWidth = 1;
    rc.beginPath();
    rc.moveTo(x1, y1);
    rc.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    rc.stroke();
  }

  return {
    map: finalizeTexture(col, { srgb: true, repeat: [2, 1.5] }),
    roughnessMap: finalizeTexture(rgh, { srgb: false, repeat: [2, 1.5] }),
    bumpMap: finalizeTexture(bmp, { srgb: false, repeat: [2, 1.5] }),
  };
}

// 2. Vulcanized Dark Ribbed Rubber Conveyor Belt
export function createConveyorBeltTextures() {
  const w = 512, h = 256;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const rgh = makeCanvas(w, h);
  const cc = col.getContext('2d');
  const bc = bmp.getContext('2d');
  const rc = rgh.getContext('2d');

  cc.fillStyle = '#1f2226';
  cc.fillRect(0, 0, w, h);
  bc.fillStyle = '#555555';
  bc.fillRect(0, 0, w, h);
  rc.fillStyle = '#c8c8c8';
  rc.fillRect(0, 0, w, h);

  // Subtle matte rubber speckle
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const d = Math.floor(24 + Math.random() * 20);
    cc.fillStyle = `rgba(${d},${d + 2},${d + 4},0.35)`;
    cc.fillRect(x, y, 2, 2);
  }

  // Transverse rubber grip ribs (scrolls along U!)
  const ribCount = 16;
  const step = w / ribCount;
  for (let i = 0; i < ribCount; i++) {
    const rx = i * step;
    // Raised rib strip
    const grad = cc.createLinearGradient(rx, 0, rx + step * 0.42, 0);
    grad.addColorStop(0, '#181a1d');
    grad.addColorStop(0.45, '#2f343a');
    grad.addColorStop(1, '#181a1d');
    cc.fillStyle = grad;
    cc.fillRect(rx, 10, step * 0.42, h - 20);

    const bGrad = bc.createLinearGradient(rx, 0, rx + step * 0.42, 0);
    bGrad.addColorStop(0, '#505050');
    bGrad.addColorStop(0.5, '#e8e8e8');
    bGrad.addColorStop(1, '#505050');
    bc.fillStyle = bGrad;
    bc.fillRect(rx, 10, step * 0.42, h - 20);

    rc.fillStyle = '#9c9c9c';
    rc.fillRect(rx + step * 0.1, 10, step * 0.2, h - 20);
  }

  // Subtle center belt guide seams
  cc.fillStyle = 'rgba(255,255,255,0.035)';
  cc.fillRect(0, 0, w, 10);
  cc.fillRect(0, h - 10, w, 10);

  return {
    map: finalizeTexture(col, { srgb: true, repeat: [2.2, 1] }),
    bumpMap: finalizeTexture(bmp, { srgb: false, repeat: [2.2, 1] }),
    roughnessMap: finalizeTexture(rgh, { srgb: false, repeat: [2.2, 1] }),
  };
}

// 3. Barcode Sticker (ZERO digits — pure realistic vertical bars!)
export function createBarcodeTexture(scanned = false) {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');

  // Crisp glossy white adhesive label with subtle rounded border
  ctx.fillStyle = scanned ? '#eefdf4' : '#f8f8f5';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = scanned ? '#34c77b' : '#dcdad2';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 122);

  // Authentic varying-width barcode stripes (no text/numbers!)
  const pattern = [2, 1, 1, 3, 1, 2, 1, 1, 4, 1, 2, 2, 1, 1, 3, 2, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 2];
  let x = 22;
  ctx.fillStyle = '#151618';
  pattern.forEach((w, idx) => {
    const px = w * 4.1;
    if (idx % 2 === 0) {
      const h = (idx === 0 || idx === 14 || idx === pattern.length - 1) ? 94 : 84;
      ctx.fillRect(x, 18, Math.max(2, px), h);
    }
    x += px;
  });

  if (scanned) {
    // Subtle emerald confirmation dot & sleek check arc (zero text)
    ctx.fillStyle = 'rgba(30, 210, 110, 0.92)';
    ctx.beginPath();
    ctx.arc(224, 30, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(216, 30);
    ctx.lineTo(222, 36);
    ctx.lineTo(233, 24);
    ctx.stroke();
  }

  return finalizeTexture(c, { srgb: true });
}

// 4. Kraft Paper Bag Texture
export function createKraftPaperTextures(baseColor = '#c59969') {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const cc = col.getContext('2d');
  const bc = bmp.getContext('2d');

  cc.fillStyle = baseColor;
  cc.fillRect(0, 0, w, h);
  bc.fillStyle = '#808080';
  bc.fillRect(0, 0, w, h);

  // Subtle paper tonal mottling
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 10 + Math.random() * 40;
    const dark = Math.random() > 0.5;
    cc.fillStyle = dark ? 'rgba(90,55,20,0.035)' : 'rgba(255,240,210,0.035)';
    cc.beginPath();
    cc.arc(x, y, r, 0, Math.PI * 2);
    cc.fill();
  }

  // Paper fibers & tiny pulp specks
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 3 + Math.random() * 14;
    const ang = Math.random() * Math.PI * 2;
    cc.strokeStyle = Math.random() > 0.35
      ? 'rgba(85,52,22,0.13)'
      : 'rgba(245,228,195,0.16)';
    cc.lineWidth = 0.8 + Math.random() * 0.8;
    cc.beginPath();
    cc.moveTo(x, y);
    cc.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    cc.stroke();

    const bv = Math.floor(105 + Math.random() * 50);
    bc.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
    bc.fillRect(x, y, 2, 2);
  }

  // Subtle vertical bag fold crease
  const foldGrad = cc.createLinearGradient(w * 0.48, 0, w * 0.52, 0);
  foldGrad.addColorStop(0, 'rgba(60,35,10,0)');
  foldGrad.addColorStop(0.5, 'rgba(60,35,10,0.12)');
  foldGrad.addColorStop(1, 'rgba(60,35,10,0)');
  cc.fillStyle = foldGrad;
  cc.fillRect(w * 0.46, 0, w * 0.08, h);

  return {
    map: finalizeTexture(col, { srgb: true }),
    bumpMap: finalizeTexture(bmp, { srgb: false }),
  };
}

// 5. Woven Canvas / Tote Fabric
export function createWovenFabricTextures(baseHex = '#ede4d4', accentHex = '#2a4d6e', striped = false) {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const cc = col.getContext('2d');
  const bc = bmp.getContext('2d');

  cc.fillStyle = baseHex;
  cc.fillRect(0, 0, w, h);
  bc.fillStyle = '#808080';
  bc.fillRect(0, 0, w, h);

  if (striped) {
    cc.fillStyle = accentHex;
    for (let y = 0; y < h; y += 64) {
      cc.fillRect(0, y, w, 24);
    }
  } else {
    // Decorative wide bottom accent band
    cc.fillStyle = accentHex;
    cc.fillRect(0, h * 0.72, w, h * 0.12);
  }

  // Realistic warp & weft weave
  for (let y = 0; y < h; y += 4) {
    cc.fillStyle = y % 8 === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    cc.fillRect(0, y, w, 2);
    bc.fillStyle = y % 8 === 0 ? '#686868' : '#a4a4a4';
    bc.fillRect(0, y, w, 2);
  }
  for (let x = 0; x < w; x += 4) {
    cc.fillStyle = x % 8 === 0 ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.055)';
    cc.fillRect(x, 0, 2, h);
    bc.fillStyle = x % 8 === 0 ? 'rgba(85,85,85,0.55)' : 'rgba(185,185,185,0.55)';
    bc.fillRect(x, 0, 2, h);
  }

  return {
    map: finalizeTexture(col, { srgb: true, repeat: [1.5, 1.5] }),
    bumpMap: finalizeTexture(bmp, { srgb: false, repeat: [1.5, 1.5] }),
  };
}

// 6. Customer Sweater / Corduroy / Knit Fabric
export function createClothingTextures(style = 'knit', primary = '#dfd3c3', secondary = '#c4b59f') {
  const w = 512, h = 512;
  const col = makeCanvas(w, h);
  const bmp = makeCanvas(w, h);
  const cc = col.getContext('2d');
  const bc = bmp.getContext('2d');

  cc.fillStyle = primary;
  cc.fillRect(0, 0, w, h);
  bc.fillStyle = '#808080';
  bc.fillRect(0, 0, w, h);

  if (style === 'knit') {
    for (let x = 0; x < w; x += 16) {
      for (let y = 0; y < h; y += 12) {
        cc.strokeStyle = secondary;
        cc.lineWidth = 3;
        cc.beginPath();
        cc.moveTo(x + 2, y);
        cc.lineTo(x + 8, y + 10);
        cc.lineTo(x + 14, y);
        cc.stroke();

        bc.strokeStyle = '#d4d4d4';
        bc.lineWidth = 3.5;
        bc.beginPath();
        bc.moveTo(x + 2, y);
        bc.lineTo(x + 8, y + 10);
        bc.lineTo(x + 14, y);
        bc.stroke();
      }
    }
  } else if (style === 'stripe') {
    for (let y = 0; y < h; y += 48) {
      cc.fillStyle = secondary;
      cc.fillRect(0, y, w, 18);
    }
    for (let y = 0; y < h; y += 4) {
      bc.fillStyle = y % 8 === 0 ? '#707070' : '#969696';
      bc.fillRect(0, y, w, 2);
    }
  } else if (style === 'corduroy') {
    for (let x = 0; x < w; x += 10) {
      const g = cc.createLinearGradient(x, 0, x + 10, 0);
      g.addColorStop(0, secondary);
      g.addColorStop(0.5, primary);
      g.addColorStop(1, secondary);
      cc.fillStyle = g;
      cc.fillRect(x, 0, 10, h);

      const bg = bc.createLinearGradient(x, 0, x + 10, 0);
      bg.addColorStop(0, '#444444');
      bg.addColorStop(0.5, '#dcdcdc');
      bg.addColorStop(1, '#444444');
      bc.fillStyle = bg;
      bc.fillRect(x, 0, 10, h);
    }
  }

  return {
    map: finalizeTexture(col, { srgb: true, repeat: [2, 2] }),
    bumpMap: finalizeTexture(bmp, { srgb: false, repeat: [2, 2] }),
  };
}

// 7. Realistic Product Textures (ZERO TEXT!)
export function createMilkCartonTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');

  // Crisp glossy white paperboard
  ctx.fillStyle = '#f8f9fb';
  ctx.fillRect(0, 0, 512, 512);

  // Rich dairy cobalt-blue top band
  const topGrad = ctx.createLinearGradient(0, 0, 0, 165);
  topGrad.addColorStop(0, '#1355a6');
  topGrad.addColorStop(1, '#2474cc');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 512, 150);

  // Flowing white milk wave splash
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 132);
  ctx.bezierCurveTo(130, 92, 240, 175, 370, 126);
  ctx.bezierCurveTo(435, 100, 480, 130, 512, 118);
  ctx.lineTo(512, 190);
  ctx.lineTo(0, 190);
  ctx.closePath();
  ctx.fill();

  // Soft pastoral green meadow & golden sun emblem (pure illustration, zero text)
  ctx.fillStyle = '#d9edff';
  ctx.beginPath();
  ctx.arc(256, 295, 108, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffd55a';
  ctx.beginPath();
  ctx.arc(304, 248, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(256, 295, 108, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#6db856';
  ctx.beginPath();
  ctx.ellipse(210, 365, 145, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4f9a3d';
  ctx.beginPath();
  ctx.ellipse(315, 385, 135, 65, 0, 0, Math.PI * 2);
  ctx.fill();

  // Milk droplets icon
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(256, 238);
  ctx.bezierCurveTo(286, 285, 290, 326, 256, 336);
  ctx.bezierCurveTo(222, 326, 226, 285, 256, 238);
  ctx.fill();
  ctx.restore();

  // Bottom cobalt trim
  ctx.fillStyle = '#185db0';
  ctx.fillRect(0, 446, 512, 66);
  ctx.fillStyle = '#5da4ec';
  ctx.fillRect(0, 434, 512, 12);

  return finalizeTexture(c, { srgb: true });
}

export function createAppleSkinTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');

  // Rich crimson-red apple gradient with natural golden-yellow top blush
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#c89b32');
  g.addColorStop(0.14, '#bf2622');
  g.addColorStop(0.55, '#a61419');
  g.addColorStop(0.88, '#8d1118');
  g.addColorStop(1, '#b88b35');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  // Organic vertical red/gold mottling stripes
  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 512;
    const width = 4 + Math.random() * 14;
    ctx.fillStyle = Math.random() > 0.4
      ? 'rgba(130, 8, 12, 0.22)'
      : 'rgba(242, 190, 75, 0.16)';
    ctx.fillRect(x, 20, width, 472);
  }

  // Realistic tiny cream lenticel speckles
  for (let i = 0; i < 950; i++) {
    const x = Math.random() * 512;
    const y = 35 + Math.random() * 440;
    const r = 0.7 + Math.random() * 1.4;
    ctx.fillStyle = 'rgba(255, 232, 180, 0.38)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(c, { srgb: true });
}

export function createStrawberrySkinTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#e85b4c');
  g.addColorStop(0.2, '#d41b25');
  g.addColorStop(0.8, '#aa0b18');
  g.addColorStop(1, '#7a0712');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Recessed dimples and golden strawberry achenes (seeds)
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 14; col++) {
      const sx = (col + (row % 2) * 0.5) * (256 / 14);
      const sy = 22 + row * 19;
      ctx.fillStyle = 'rgba(85, 0, 8, 0.45)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1, 3.2, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f2d36b';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 1.6, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return finalizeTexture(c, { srgb: true });
}

export function createBananaSkinTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#6a5b2c');
  g.addColorStop(0.08, '#9cb53b');
  g.addColorStop(0.22, '#f2cc36');
  g.addColorStop(0.82, '#e8bc24');
  g.addColorStop(0.94, '#b8a534');
  g.addColorStop(1, '#4c381a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle fibrous ridges & light sugar spots
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(135, 95, 25, 0.18)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, 40 + Math.random() * 175, 1.5 + Math.random() * 2, 1 + Math.random() * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeTexture(c, { srgb: true });
}

export function createOrangeJuiceLabelTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');

  // Fresh sunlit orange & cream wrap label
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#fff7e8');
  g.addColorStop(0.35, '#ffebd0');
  g.addColorStop(1, '#ff981e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Vivid orange top & bottom bands
  ctx.fillStyle = '#e8680a';
  ctx.fillRect(0, 0, 512, 26);
  ctx.fillRect(0, 230, 512, 26);

  // Sliced orange wheel illustration (repeated around wrap)
  [128, 384].forEach((cx) => {
    ctx.fillStyle = '#ff7e08';
    ctx.beginPath();
    ctx.arc(cx, 128, 72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.arc(cx, 128, 63, 0, Math.PI * 2);
    ctx.fill();

    // Juicy wedges
    for (let s = 0; s < 8; s++) {
      const a0 = (s * Math.PI) / 4 + 0.08;
      const a1 = ((s + 1) * Math.PI) / 4 - 0.08;
      ctx.fillStyle = '#ff9814';
      ctx.beginPath();
      ctx.moveTo(cx, 128);
      ctx.arc(cx, 128, 56, a0, a1);
      ctx.closePath();
      ctx.fill();
    }

    // Fresh green citrus leaf
    ctx.fillStyle = '#3c9436';
    ctx.beginPath();
    ctx.ellipse(cx + 52, 72, 26, 12, -0.55, 0, Math.PI * 2);
    ctx.fill();
  });

  return finalizeTexture(c, { srgb: true });
}

export function createChocolateWrapperTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');

  // Rich luxury cocoa-brown matte wrapper
  const g = ctx.createLinearGradient(0, 0, 512, 256);
  g.addColorStop(0, '#4e2716');
  g.addColorStop(0.5, '#64321c');
  g.addColorStop(1, '#3d1c0f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Metallic gold decorative ribbon bands
  const gold = ctx.createLinearGradient(0, 0, 512, 0);
  gold.addColorStop(0, '#b8892d');
  gold.addColorStop(0.5, '#f5d97b');
  gold.addColorStop(1, '#b8892d');
  ctx.fillStyle = gold;
  ctx.fillRect(0, 26, 512, 16);
  ctx.fillRect(0, 214, 512, 16);

  // Embossed graphic chocolate squares icon (zero text)
  ctx.save();
  ctx.translate(256, 128);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#311408';
  ctx.fillRect(-74, -44, 148, 88);
  for (let r = 0; r < 2; r++) {
    for (let col = 0; col < 3; col++) {
      const bx = -66 + col * 46;
      const by = -36 + r * 38;
      ctx.fillStyle = '#5c2b14';
      ctx.fillRect(bx, by, 40, 32);
      ctx.strokeStyle = '#7e4326';
      ctx.lineWidth = 3;
      ctx.strokeRect(bx + 4, by + 4, 32, 24);
    }
  }
  ctx.restore();

  return finalizeTexture(c, { srgb: true });
}

export function createCornCanLabelTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');

  // Deep royal navy & cream tin label
  ctx.fillStyle = '#183768';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#f8f2e0';
  ctx.fillRect(0, 22, 512, 12);
  ctx.fillRect(0, 222, 512, 12);

  // Realistic golden sweet corn kernels illustration
  [128, 384].forEach((cx) => {
    // Husk leaves
    ctx.fillStyle = '#4e9637';
    ctx.beginPath();
    ctx.ellipse(cx - 42, 145, 22, 68, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 42, 145, 22, 68, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Corn cob oval
    ctx.fillStyle = '#f6c526';
    ctx.beginPath();
    ctx.ellipse(cx, 126, 36, 72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kernels
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 5; col++) {
        const kx = cx - 22 + col * 11;
        const ky = 72 + row * 15;
        ctx.fillStyle = (row + col) % 2 === 0 ? '#ffe052' : '#eeb418';
        ctx.beginPath();
        ctx.ellipse(kx, ky, 4.8, 6.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  return finalizeTexture(c, { srgb: true });
}

export function createHoneyLabelTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#faf3e1';
  ctx.fillRect(0, 0, 512, 256);

  // Gold border
  ctx.strokeStyle = '#d49a2a';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 484, 228);

  // Golden honeycomb hexagons (zero text)
  const hexR = 24;
  ctx.fillStyle = '#e8a822';
  ctx.strokeStyle = '#c27b10';
  ctx.lineWidth = 3;
  const centers = [
    [256, 128], [214, 104], [298, 104],
    [214, 152], [298, 152], [256, 80], [256, 176]
  ];
  centers.forEach(([hx, hy]) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = hx + Math.cos(a) * hexR;
      const py = hy + Math.sin(a) * hexR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });

  return finalizeTexture(c, { srgb: true });
}

export function createGoldStickerTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Radiant metallic gold circle with scalloped edge
  const grad = ctx.createRadialGradient(104, 96, 12, 128, 128, 118);
  grad.addColorStop(0, '#fff7c2');
  grad.addColorStop(0.45, '#f4c73c');
  grad.addColorStop(0.85, '#c98e14');
  grad.addColorStop(1, '#9e6809');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fff5bd';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();

  // Crisp 5-point star in center (zero text!)
  ctx.fillStyle = '#fff9d6';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 64 : 28;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = 128 + Math.cos(a) * r;
    const py = 128 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  return finalizeTexture(c, { srgb: true });
}

export function createDiscountStickerTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Glossy crimson-red & gold supermarket sparkle starburst (zero text/numbers)
  ctx.fillStyle = '#e5252c';
  ctx.beginPath();
  const spikes = 16;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 118 : 96;
    const a = (i * Math.PI) / spikes;
    const px = 128 + Math.cos(a) * r;
    const py = 128 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffe052';
  ctx.lineWidth = 9;
  ctx.stroke();

  // Bright gold sparkle diamond inside
  ctx.fillStyle = '#fff188';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 66 : 22;
    const a = (i * Math.PI) / 4;
    const px = 128 + Math.cos(a) * r;
    const py = 128 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  return finalizeTexture(c, { srgb: true });
}

// Thermal paper receipt with purely visual dots/bars (ZERO text/digits!)
export function createReceiptTexture() {
  const c = makeCanvas(128, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f9f8f4';
  ctx.fillRect(0, 0, 128, 512);

  // Subtle top decorative star header
  ctx.fillStyle = '#33363b';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(24 + i * 20, 26, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dotted line
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#666b72';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 48);
  ctx.lineTo(116, 48);
  ctx.stroke();
  ctx.setLineDash([]);

  // Graphic tally rows (colored dot + dark bar, no letters/digits)
  const colors = ['#d62828', '#2a72cc', '#f2a516', '#3c9436', '#c8558a', '#7c4b2a'];
  for (let r = 0; r < 14; r++) {
    const y = 68 + r * 28;
    ctx.fillStyle = colors[r % colors.length];
    ctx.beginPath();
    ctx.arc(22, y, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#40444a';
    const w1 = 26 + ((r * 19) % 34);
    ctx.fillRect(36, y - 3, w1, 6);
    ctx.fillRect(94, y - 3, 20, 6);
  }

  // Bottom mini barcode stripes
  for (let x = 18; x < 110; x += 6) {
    ctx.fillStyle = '#222428';
    ctx.fillRect(x, 466, (x % 12 === 0) ? 3.5 : 1.8, 28);
  }

  return finalizeTexture(c, { srgb: true });
}

// Crisp photographic bokeh supermarket aisle backdrop
export function createAisleBackdropTexture() {
  const c = makeCanvas(1024, 512);
  const ctx = c.getContext('2d');

  // Warm supermarket interior ceiling-to-floor ambient gradient
  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#eae3d6');
  bg.addColorStop(0.28, '#dcd2c2');
  bg.addColorStop(0.68, '#b9a892');
  bg.addColorStop(1, '#7c6f60');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 512);

  // Softly blurred bright overhead LED store light panels
  ctx.filter = 'blur(8px)';
  for (let i = 0; i < 6; i++) {
    const lx = 70 + i * 175;
    ctx.fillStyle = 'rgba(255, 253, 245, 0.92)';
    ctx.fillRect(lx, 18, 120, 26);
    ctx.fillStyle = 'rgba(255, 248, 224, 0.45)';
    ctx.beginPath();
    ctx.ellipse(lx + 60, 42, 95, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft bokeh supermarket aisle shelves stocked with warm colorful goods
  ctx.filter = 'blur(6px)';
  const shelfRows = [145, 235, 325, 415];
  const palette = ['#d4513b', '#e5a832', '#4c8e4b', '#3b73b0', '#f0e2c6', '#c96f32', '#df889b', '#7b9c43'];
  shelfRows.forEach((sy, rowIdx) => {
    // Wood shelf plank
    ctx.fillStyle = '#73573d';
    ctx.fillRect(0, sy + 52, 1024, 14);
    ctx.fillStyle = '#4e3926';
    ctx.fillRect(0, sy + 64, 1024, 8);

    // Colorful product clusters
    let x = 15;
    let seed = rowIdx * 17 + 3;
    while (x < 1005) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const bw = 24 + (seed % 34);
      const bh = 32 + ((seed >> 4) % 24);
      ctx.fillStyle = palette[seed % palette.length];
      ctx.fillRect(x, sy + 52 - bh, bw, bh);
      // Tiny specular highlight
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + 3, sy + 55 - bh, bw * 0.28, bh - 6);
      x += bw + 6 + (seed % 10);
    }
  });

  // Soft warm golden light bokeh orbs
  ctx.filter = 'blur(12px)';
  for (let i = 0; i < 18; i++) {
    const bx = (i * 67 + 40) % 1000;
    const by = 60 + ((i * 53) % 140);
    ctx.fillStyle = 'rgba(255, 244, 210, 0.22)';
    ctx.beginPath();
    ctx.arc(bx, by, 18 + (i % 4) * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.filter = 'none';

  return finalizeTexture(c, { srgb: true });
}

// Warm oak wood for store trim
export function createOakWoodTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9c734b';
  ctx.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = Math.sin(y * 0.08) * 14 + (Math.random() - 0.5) * 10;
    ctx.fillStyle = `rgb(${152 + shade}, ${112 + shade * 0.75}, ${72 + shade * 0.5})`;
    ctx.fillRect(0, y, 512, 2);
  }
  return finalizeTexture(c, { srgb: true, repeat: [2, 1] });
}
