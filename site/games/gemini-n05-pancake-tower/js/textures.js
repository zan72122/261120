import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createOakWoodTextures() {
  const w = 1024, h = 1024;
  const colC = makeCanvas(w, h);
  const bumpC = makeCanvas(w, h);
  const roughC = makeCanvas(w, h);
  const c = colC.getContext('2d');
  const b = bumpC.getContext('2d');
  const r = roughC.getContext('2d');
  const rand = mulberry32(4021);

  const planks = 6;
  const ph = h / planks;

  for (let p = 0; p < planks; p++) {
    const y0 = p * ph;
    const hueShift = (rand() - 0.5) * 16;
    const baseR = 148 + hueShift;
    const baseG = 102 + hueShift * 0.78;
    const baseB = 62 + hueShift * 0.55;

    c.fillStyle = `rgb(${baseR | 0},${baseG | 0},${baseB | 0})`;
    c.fillRect(0, y0, w, ph);

    b.fillStyle = '#808080';
    b.fillRect(0, y0, w, ph);

    const baseRough = 122 + (rand() - 0.5) * 28;
    r.fillStyle = `rgb(${baseRough | 0},${baseRough | 0},${baseRough | 0})`;
    r.fillRect(0, y0, w, ph);

    // Horizontally seamless fine wood grain fibers (integer periods across width!)
    for (let i = 0; i < 260; i++) {
      const gy = y0 + rand() * ph;
      const alpha = 0.05 + rand() * 0.14;
      const dark = rand() > 0.3;
      const lw = 0.8 + rand() * 2.6;
      const amp = 1.5 + rand() * 5.2;
      const periods = 1 + Math.floor(rand() * 3);
      const freq = (Math.PI * 2 * periods) / w;
      const phase = rand() * Math.PI * 2;

      c.strokeStyle = dark
        ? `rgba(${Math.max(20, baseR - 48) | 0},${Math.max(15, baseG - 38) | 0},${Math.max(10, baseB - 26) | 0},${alpha})`
        : `rgba(${Math.min(255, baseR + 34) | 0},${Math.min(255, baseG + 26) | 0},${Math.min(255, baseB + 18) | 0},${alpha * 0.72})`;
      c.lineWidth = lw;
      c.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = gy + Math.sin(x * freq + phase) * amp;
        if (x === 0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      }
      c.stroke();

      b.strokeStyle = dark ? `rgba(42,42,42,${alpha * 0.95})` : `rgba(182,182,182,${alpha * 0.65})`;
      b.lineWidth = lw;
      b.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const yy = gy + Math.sin(x * freq + phase) * amp;
        if (x === 0) b.moveTo(x, yy);
        else b.lineTo(x, yy);
      }
      b.stroke();
    }

    // Subtle knots
    if (rand() > 0.45) {
      const kx = 120 + rand() * (w - 240);
      const ky = y0 + ph * (0.25 + rand() * 0.5);
      const rx = 20 + rand() * 30;
      const ry = 6 + rand() * 10;
      const grad = c.createRadialGradient(kx, ky, 2, kx, ky, rx);
      grad.addColorStop(0, 'rgba(92,58,34,0.45)');
      grad.addColorStop(0.55, 'rgba(116,78,48,0.22)');
      grad.addColorStop(1, 'rgba(140,98,64,0)');
      c.save();
      c.translate(kx, ky);
      c.scale(1, ry / rx);
      c.translate(-kx, -ky);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(kx, ky, rx, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    // Plank bevel seam
    c.fillStyle = 'rgba(65,42,24,0.42)';
    c.fillRect(0, y0, w, 2.5);
    c.fillStyle = 'rgba(255,235,205,0.14)';
    c.fillRect(0, y0 + 2.5, w, 1.5);
    b.fillStyle = '#1f1f1f';
    b.fillRect(0, y0, w, 3);
    r.fillStyle = '#dedede';
    r.fillRect(0, y0, w, 3);
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.2, 2.2);
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.2, 2.2);

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2.2, 2.2);

  return { map, bumpMap, roughnessMap };
}

export function createCeramicTextures(baseColor = '#f6efe3', speckleColor = '#8c7660') {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const rand = mulberry32(991);

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle glaze tonal depth
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.5, 'rgba(230,215,195,0.0)');
  g.addColorStop(1, 'rgba(180,155,130,0.16)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  // Organic stoneware mineral speckles
  for (let i = 0; i < 650; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const rad = 0.5 + rand() * 1.6;
    ctx.fillStyle = speckleColor;
    ctx.globalAlpha = 0.14 + rand() * 0.28;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map };
}

export function createCastIronTextures() {
  const c = makeCanvas(512, 512);
  const b = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const btx = b.getContext('2d');
  const rand = mulberry32(1337);

  ctx.fillStyle = '#242529';
  ctx.fillRect(0, 0, 512, 512);
  btx.fillStyle = '#808080';
  btx.fillRect(0, 0, 512, 512);

  // Seasoned oil sheen radial center
  const radG = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
  radG.addColorStop(0, 'rgba(54,50,46,0.45)');
  radG.addColorStop(0.7, 'rgba(36,36,40,0.1)');
  radG.addColorStop(1, 'rgba(18,18,22,0.5)');
  ctx.fillStyle = radG;
  ctx.fillRect(0, 0, 512, 512);

  // Micro-pebbled cast-iron grain
  for (let i = 0; i < 6500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const s = 0.8 + rand() * 1.9;
    const v = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},0.032)`;
    ctx.fillRect(x, y, s, s);
    btx.fillStyle = `rgba(${v},${v},${v},0.16)`;
    btx.fillRect(x, y, s, s);
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(b);
  return { map, bumpMap };
}

export function createWovenCoasterTextures() {
  const c = makeCanvas(512, 512);
  const b = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const btx = b.getContext('2d');
  const cx = 256, cy = 256;

  ctx.fillStyle = '#b98f59';
  ctx.fillRect(0, 0, 512, 512);
  btx.fillStyle = '#686868';
  btx.fillRect(0, 0, 512, 512);

  // Concentric braided rattan coils
  for (let r = 8; r < 248; r += 9) {
    ctx.strokeStyle = r % 18 === 0 ? '#a87c45' : '#cba46f';
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    btx.strokeStyle = '#d0d0d0';
    btx.lineWidth = 5;
    btx.beginPath();
    btx.arc(cx, cy, r, 0, Math.PI * 2);
    btx.stroke();

    // Cross-stitches along coil
    const segs = Math.max(12, Math.floor((Math.PI * 2 * r) / 14));
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2 + (r * 0.05);
      const x1 = cx + Math.cos(a) * (r - 4);
      const y1 = cy + Math.sin(a) * (r - 4);
      const x2 = cx + Math.cos(a) * (r + 4);
      const y2 = cy + Math.sin(a) * (r + 4);
      ctx.strokeStyle = 'rgba(92,60,26,0.48)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      btx.strokeStyle = '#303030';
      btx.lineWidth = 1.8;
      btx.beginPath();
      btx.moveTo(x1, y1);
      btx.lineTo(x2, y2);
      btx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(b);
  return { map, bumpMap };
}

export function createTileWallTextures() {
  const c = makeCanvas(1024, 512);
  const b = makeCanvas(1024, 512);
  const ctx = c.getContext('2d');
  const btx = b.getContext('2d');
  const rand = mulberry32(77);

  ctx.fillStyle = '#ddd3c6';
  ctx.fillRect(0, 0, 1024, 512);
  btx.fillStyle = '#353535';
  btx.fillRect(0, 0, 1024, 512);

  const tw = 128, th = 64;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * (tw / 2);
    for (let col = -1; col <= 8; col++) {
      const x = col * tw + offset;
      const y = row * th;
      const warm = 244 + (rand() - 0.5) * 10;
      ctx.fillStyle = `rgb(${warm | 0},${(warm - 5) | 0},${(warm - 13) | 0})`;
      ctx.fillRect(x + 3, y + 3, tw - 6, th - 6);

      btx.fillStyle = '#d5d5d5';
      btx.fillRect(x + 3, y + 3, tw - 6, th - 6);
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 2);

  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 2);
  return { map, bumpMap };
}

export function createStrawberryTextures() {
  const c = makeCanvas(256, 256);
  const b = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const btx = b.getContext('2d');

  // Rich ripe ruby-crimson gradient (v=0 is tip, v=1 is crown)
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#c81d25');
  g.addColorStop(0.55, '#b1121c');
  g.addColorStop(0.88, '#d43634');
  g.addColorStop(1, '#e89b80');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  btx.fillStyle = '#909090';
  btx.fillRect(0, 0, 256, 256);

  // Achenes (tiny golden seeds in soft dimples)
  const rows = 10, cols = 14;
  for (let r = 1; r < rows; r++) {
    const y = (r / rows) * 240 + 6;
    const shift = (r % 2) * (256 / cols) * 0.5;
    for (let col = 0; col < cols; col++) {
      const x = ((col / cols) * 256 + shift) % 256;
      // Dimple
      ctx.fillStyle = 'rgba(72,6,12,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y, 4.2, 5.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Golden seed
      ctx.fillStyle = '#e7c26c';
      ctx.beginPath();
      ctx.ellipse(x, y, 1.8, 2.7, 0, 0, Math.PI * 2);
      ctx.fill();

      btx.fillStyle = '#303030';
      btx.beginPath();
      btx.ellipse(x, y, 4.5, 5.5, 0, 0, Math.PI * 2);
      btx.fill();
      btx.fillStyle = '#e0e0e0';
      btx.beginPath();
      btx.ellipse(x, y, 1.6, 2.4, 0, 0, Math.PI * 2);
      btx.fill();
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(b);
  return { map, bumpMap };
}

export function createFurTextures(baseHex = '#e6b27a', stripeHex = '#c57c3e', tabby = true) {
  const c = makeCanvas(512, 512);
  const b = makeCanvas(512, 512);
  const ctx = c.getContext('2d');
  const btx = b.getContext('2d');
  const rand = mulberry32(baseHex.charCodeAt(1) * 31 + (tabby ? 7 : 3));

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);
  btx.fillStyle = '#808080';
  btx.fillRect(0, 0, 512, 512);

  if (tabby) {
    // Soft ginger tabby stripes
    for (let i = 0; i < 12; i++) {
      const y = (i / 12) * 512;
      ctx.strokeStyle = stripeHex;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 14 + rand() * 12;
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 32) {
        const yy = y + Math.sin(x * 0.025 + i) * 14;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Fine directional soft hair strands
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const len = 6 + rand() * 14;
    const ang = Math.PI * 0.5 + (rand() - 0.5) * 0.35;
    const bright = rand() > 0.45;
    ctx.strokeStyle = bright ? 'rgba(255,248,236,0.12)' : 'rgba(90,56,30,0.09)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();

    btx.strokeStyle = bright ? 'rgba(210,210,210,0.22)' : 'rgba(65,65,65,0.22)';
    btx.lineWidth = 1.2;
    btx.beginPath();
    btx.moveTo(x, y);
    btx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    btx.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

export function createPancakeEdgeTexture() {
  const c = makeCanvas(512, 128);
  const b = makeCanvas(512, 128);
  const ctx = c.getContext('2d');
  const btx = b.getContext('2d');
  const rand = mulberry32(2026);

  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#b56a25');
  g.addColorStop(0.22, '#edc77f');
  g.addColorStop(0.78, '#e6ba6c');
  g.addColorStop(1, '#ae611f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 128);

  btx.fillStyle = '#909090';
  btx.fillRect(0, 0, 512, 128);

  // Airy porous sponge bubbles along the pancake rim
  for (let i = 0; i < 420; i++) {
    const x = rand() * 512;
    const y = 14 + rand() * 100;
    const rx = 1.2 + rand() * 3.8;
    const ry = 0.8 + rand() * 2.4;
    ctx.fillStyle = `rgba(175,122,64,${0.12 + rand() * 0.24})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    btx.fillStyle = `rgba(35,35,35,${0.25 + rand() * 0.35})`;
    btx.beginPath();
    btx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    btx.fill();
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = THREE.RepeatWrapping;
  return { map, bumpMap };
}

export class PancakeFaceTexture {
  constructor(seed = 1) {
    this.canvas = makeCanvas(512, 512);
    this.ctx = this.canvas.getContext('2d');
    this.bumpCanvas = makeCanvas(512, 512);
    this.btx = this.bumpCanvas.getContext('2d');
    this.seed = seed;
    this.lastCook = -1;

    // Pre-generate organic mottling & pore spots for this pancake
    const rand = mulberry32(seed * 977 + 19);
    this.mottles = [];
    for (let i = 0; i < 65; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.pow(rand(), 0.65) * 195;
      this.mottles.push({
        x: 256 + Math.cos(ang) * dist,
        y: 256 + Math.sin(ang) * dist,
        r: 12 + rand() * 34,
        v: rand(),
      });
    }
    this.pores = [];
    for (let i = 0; i < 160; i++) {
      const ang = rand() * Math.PI * 2;
      const dist = Math.pow(rand(), 0.55) * 225;
      this.pores.push({
        x: 256 + Math.cos(ang) * dist,
        y: 256 + Math.sin(ang) * dist,
        r: 1.4 + rand() * 3.8,
        a: 0.14 + rand() * 0.3,
      });
    }

    this.map = new THREE.CanvasTexture(this.canvas);
    this.map.colorSpace = THREE.SRGBColorSpace;
    this.bumpMap = new THREE.CanvasTexture(this.bumpCanvas);

    this.update(0);
  }

  update(cookLevel) {
    const q = Math.round(cookLevel * 32) / 32;
    if (Math.abs(q - this.lastCook) < 0.015) return;
    this.lastCook = q;

    const ctx = this.ctx;
    const btx = this.btx;
    const c = Math.max(0, Math.min(1.25, cookLevel));

    // Interpolate colors: raw cream -> pale gold -> rich Maillard kissaten amber -> deep toasty caramel
    const lerp = (a, b, t) => a + (b - a) * t;
    let centerR, centerG, centerB;
    let rimR, rimG, rimB;

    if (c < 0.72) {
      const t = c / 0.72;
      centerR = lerp(244, 174, t);
      centerG = lerp(220, 96, t);
      centerB = lerp(164, 32, t);
      rimR = lerp(244, 224, t);
      rimG = lerp(220, 178, t);
      rimB = lerp(164, 102, t);
    } else {
      const t = (c - 0.72) / 0.53;
      centerR = lerp(174, 104, t);
      centerG = lerp(96, 46, t);
      centerB = lerp(32, 14, t);
      rimR = lerp(224, 166, t);
      rimG = lerp(178, 102, t);
      rimB = lerp(102, 42, t);
    }

    // Outer pale ring + golden seared center (classic fluffy hotcake look!)
    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 254);
    grad.addColorStop(0, `rgb(${centerR | 0},${centerG | 0},${centerB | 0})`);
    grad.addColorStop(0.76, `rgb(${(centerR * 1.03) | 0},${(centerG * 1.04) | 0},${(centerB * 1.05) | 0})`);
    grad.addColorStop(0.87, `rgb(${rimR | 0},${rimG | 0},${rimB | 0})`);
    grad.addColorStop(1, `rgb(${(rimR * 0.96) | 0},${(rimG * 0.94) | 0},${(rimB * 0.9) | 0})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    btx.fillStyle = '#909090';
    btx.fillRect(0, 0, 512, 512);

    // Subtle organic skillet Maillard heat variation
    if (c > 0.12) {
      const strength = Math.min(1, (c - 0.12) * 1.1);
      for (const m of this.mottles) {
        const mg = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, m.r);
        if (m.v > 0.45) {
          mg.addColorStop(0, `rgba(115,56,18,${0.14 * strength})`);
          mg.addColorStop(1, 'rgba(115,56,18,0)');
        } else {
          mg.addColorStop(0, `rgba(248,214,148,${0.16 * strength})`);
          mg.addColorStop(1, 'rgba(248,214,148,0)');
        }
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Cooked micro-pores & popped bubble craters
    const poreVis = 0.25 + Math.min(1, c * 1.2) * 0.75;
    for (const p of this.pores) {
      ctx.fillStyle = `rgba(110,58,20,${p.a * poreVis * (0.4 + c * 0.65)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      btx.fillStyle = `rgba(38,38,38,${0.32 * poreVis})`;
      btx.beginPath();
      btx.arc(p.x, p.y, p.r * 1.15, 0, Math.PI * 2);
      btx.fill();
    }

    this.map.needsUpdate = true;
    this.bumpMap.needsUpdate = true;
  }
}

export class BatterTextureController {
  constructor() {
    this.canvas = makeCanvas(512, 512);
    this.ctx = this.canvas.getContext('2d');
    this.map = new THREE.CanvasTexture(this.canvas);
    this.map.colorSpace = THREE.SRGBColorSpace;
    this.swirlAngle = 0;
    this.rand = mulberry32(552);
    this.lumps = Array.from({ length: 28 }, () => ({
      a: this.rand() * Math.PI * 2,
      d: 25 + this.rand() * 190,
      r: 7 + this.rand() * 16,
    }));
    this.bubbles = Array.from({ length: 34 }, () => ({
      a: this.rand() * Math.PI * 2,
      d: 20 + this.rand() * 200,
      r: 2 + this.rand() * 5.5,
    }));
    this.render({ hasEgg: false, hasMilk: false, mixProgress: 0, swirlAngle: 0 });
  }

  render({ hasEgg, hasMilk, mixProgress, swirlAngle }) {
    const ctx = this.ctx;
    const cx = 256, cy = 256;
    const m = Math.max(0, Math.min(1, mixProgress));
    const lerp = (a, b, t) => a + (b - a) * t;

    // Base flour -> silky golden-cream batter
    const br = lerp(250, 244, m);
    const bg = lerp(246, 224, m);
    const bb = lerp(236, 170, m);

    const baseG = ctx.createRadialGradient(cx, cy, 18, cx, cy, 256);
    baseG.addColorStop(0, `rgb(${br | 0},${bg | 0},${bb | 0})`);
    baseG.addColorStop(1, `rgb(${(br - 12) | 0},${(bg - 14) | 0},${(bb - 16) | 0})`);
    ctx.fillStyle = baseG;
    ctx.fillRect(0, 0, 512, 512);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(swirlAngle);

    // Powdery flour mound texture before milk/mixing
    if (m < 0.85) {
      const flourAlpha = (1 - m) * (hasMilk ? 0.48 : 0.9);
      for (const l of this.lumps) {
        const x = Math.cos(l.a) * l.d;
        const y = Math.sin(l.a) * l.d;
        const lg = ctx.createRadialGradient(x, y, 1, x, y, l.r * (1.2 - m * 0.6));
        lg.addColorStop(0, `rgba(255,253,248,${flourAlpha})`);
        lg.addColorStop(1, 'rgba(245,238,225,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(x, y, l.r * (1.2 - m * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Creamy milk pool rings
    if (hasMilk) {
      const milkVis = Math.max(0.1, 1 - m * 0.85);
      const mg = ctx.createRadialGradient(0, 0, 70, 0, 0, 245);
      mg.addColorStop(0, 'rgba(255,252,245,0)');
      mg.addColorStop(0.55, `rgba(252,249,240,${0.42 * milkVis})`);
      mg.addColorStop(1, `rgba(240,234,218,${0.55 * milkVis})`);
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(0, 0, 250, 0, Math.PI * 2);
      ctx.fill();
    }

    // Egg yolk & marbled golden ribbons as whisk swirls!
    if (hasEgg) {
      if (m < 0.14) {
        // Intact glossy egg white & plump yolk
        ctx.fillStyle = 'rgba(255,244,210,0.42)';
        ctx.beginPath();
        ctx.ellipse(24, -12, 92, 74, 0.25, 0, Math.PI * 2);
        ctx.fill();

        const yg = ctx.createRadialGradient(16, -20, 6, 26, -12, 54);
        yg.addColorStop(0, '#ffcf48');
        yg.addColorStop(0.55, '#f69c18');
        yg.addColorStop(1, '#d87609');
        ctx.fillStyle = yg;
        ctx.beginPath();
        ctx.arc(26, -12, 52, 0, Math.PI * 2);
        ctx.fill();

        // Specular glint on raw yolk
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.ellipse(10, -28, 12, 6, -0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Stretched golden swirl ribbons gradually harmonizing into silky batter!
        const streakAlpha = Math.max(0.06, (1 - m) * 0.85);
        for (let s = 0; s < 5; s++) {
          ctx.strokeStyle = s % 2 === 0
            ? `rgba(244,168,36,${streakAlpha})`
            : `rgba(255,248,225,${streakAlpha * 0.7})`;
          ctx.lineWidth = lerp(34, 12, m);
          ctx.lineCap = 'round';
          ctx.beginPath();
          const startA = (s / 5) * Math.PI * 2;
          for (let t = 0; t <= 1; t += 0.04) {
            const rad = 18 + t * 200;
            const ang = startA + t * (2.6 + m * 4.5);
            const px = Math.cos(ang) * rad;
            const py = Math.sin(ang) * rad;
            if (t === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      }
    }

    // Silky whisk groove lines & air bubbles when mixed
    if (m > 0.25) {
      const grooveA = Math.min(0.22, (m - 0.25) * 0.3);
      for (let r = 36; r < 225; r += 26) {
        ctx.strokeStyle = `rgba(255,250,234,${grooveA})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0.2, Math.PI * 1.65);
        ctx.stroke();
      }

      const bubVis = Math.min(1, (m - 0.3) * 1.5);
      for (const b of this.bubbles) {
        const bx = Math.cos(b.a) * b.d;
        const by = Math.sin(b.a) * b.d;
        ctx.fillStyle = `rgba(255,252,242,${0.55 * bubVis})`;
        ctx.strokeStyle = `rgba(195,152,85,${0.32 * bubVis})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
    this.map.needsUpdate = true;
  }
}

export function createSoftParticleTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.42, 'rgba(255,252,246,0.45)');
  g.addColorStop(1, 'rgba(255,250,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createContactShadowTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(38,22,10,0.44)');
  g.addColorStop(0.6, 'rgba(38,22,10,0.18)');
  g.addColorStop(1, 'rgba(38,22,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
