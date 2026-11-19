import * as THREE from 'three';

// Deterministic pseudo-random helper for crisp repeatable procedural textures
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

export function createBakeryEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0xefe1ce);

  // Room shell
  const roomMat = new THREE.MeshBasicMaterial({ color: 0xead8c0, side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 16, 24), roomMat);
  envScene.add(room);

  // Warm wooden floor bounce
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshBasicMaterial({ color: 0x8f623d })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -7.9;
  envScene.add(floor);

  // Large sunlit patisserie window (upper-left) with mullion bars for crisp real catchlights!
  const windowGroup = new THREE.Group();
  const paneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 3.35, 2.95) });
  const paneGeo = new THREE.PlaneGeometry(3.2, 3.6);
  const offsets = [
    [-1.85, 2.0],
    [1.85, 2.0],
    [-1.85, -2.0],
    [1.85, -2.0],
  ];
  offsets.forEach(([ox, oy]) => {
    const pane = new THREE.Mesh(paneGeo, paneMat);
    pane.position.set(ox, oy, 0);
    windowGroup.add(pane);
  });
  windowGroup.position.set(-8.5, 3.6, 4.0);
  windowGroup.lookAt(0, 0, 0);
  envScene.add(windowGroup);

  // Overhead warm diffused studio softbox
  const softbox = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 7),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.1, 1.98, 1.82) })
  );
  softbox.position.set(0.5, 7.8, 1.5);
  softbox.rotation.x = Math.PI / 2;
  envScene.add(softbox);

  // Cool daylight skylight bounce on right side for realistic color contrast
  const coolFill = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 1.22, 1.48) })
  );
  coolFill.position.set(10.5, 2.8, 3.5);
  coolFill.lookAt(0, 0, 0);
  envScene.add(coolFill);

  // Warm cafe pendant lamp accent in back-right
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.4, 1.4) })
  );
  lamp.position.set(5.5, 5.2, -7.5);
  envScene.add(lamp);

  const envRT = pmrem.fromScene(envScene, 0.025);
  pmrem.dispose();
  return envRT.texture;
}

export function createWoodTextures() {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  colCanvas.width = bumpCanvas.width = roughCanvas.width = size;
  colCanvas.height = bumpCanvas.height = roughCanvas.height = size;

  const cCtx = colCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  const rand = mulberry32(4211);

  // Base warm rich honey-walnut patisserie wood (contrasts vividly with ivory cream!)
  cCtx.fillStyle = '#a87448';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#8e8e8e';
  rCtx.fillRect(0, 0, size, size);

  // Horizontal planks with slight tone variation
  const planks = 4;
  const plankH = size / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH;
    const toneShift = (rand() - 0.5) * 20;
    cCtx.fillStyle = `rgb(${172 + toneShift}, ${118 + toneShift * 0.78}, ${74 + toneShift * 0.55})`;
    cCtx.fillRect(0, y0, size, plankH);

    // Subtle longitudinal grain waves
    for (let i = 0; i < 160; i++) {
      const y = y0 + rand() * plankH;
      const dark = rand() > 0.42;
      const alpha = 0.04 + rand() * 0.11;
      cCtx.strokeStyle = dark
        ? `rgba(112, 68, 34, ${alpha})`
        : `rgba(242, 206, 162, ${alpha * 0.85})`;
      cCtx.lineWidth = 0.7 + rand() * 2.4;
      cCtx.beginPath();
      const waveAmp = 1.5 + rand() * 4.5;
      const waveFreq = 0.008 + rand() * 0.015;
      const phase = rand() * Math.PI * 2;
      for (let x = 0; x <= size; x += 16) {
        const wy = y + Math.sin(x * waveFreq + phase) * waveAmp;
        if (x === 0) cCtx.moveTo(x, wy);
        else cCtx.lineTo(x, wy);
      }
      cCtx.stroke();

      // Matching bump & roughness
      bCtx.strokeStyle = dark ? `rgba(96,96,96,${alpha * 1.4})` : `rgba(155,155,155,${alpha})`;
      bCtx.lineWidth = cCtx.lineWidth;
      bCtx.stroke();

      rCtx.strokeStyle = dark ? `rgba(175,175,175,${alpha * 1.3})` : `rgba(125,125,125,${alpha})`;
      rCtx.lineWidth = cCtx.lineWidth;
      rCtx.stroke();
    }

    // Subtle knot
    if (rand() > 0.45) {
      const kx = 60 + rand() * (size - 120);
      const ky = y0 + 25 + rand() * (plankH - 50);
      const kr = 8 + rand() * 14;
      const grad = cCtx.createRadialGradient(kx, ky, 1, kx, ky, kr);
      grad.addColorStop(0, 'rgba(92, 52, 24, 0.42)');
      grad.addColorStop(0.6, 'rgba(130, 82, 42, 0.18)');
      grad.addColorStop(1, 'rgba(130, 82, 42, 0)');
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.ellipse(kx, ky, kr * 1.8, kr * 0.75, 0, 0, Math.PI * 2);
      cCtx.fill();
    }

    // Fine plank groove seam
    cCtx.fillStyle = 'rgba(78, 46, 22, 0.35)';
    cCtx.fillRect(0, y0, size, 2);
    bCtx.fillStyle = '#383838';
    bCtx.fillRect(0, y0, size, 2);
    rCtx.fillStyle = '#dedede';
    rCtx.fillRect(0, y0, size, 2);
  }

  const map = new THREE.CanvasTexture(colCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  [map, bumpMap, roughnessMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3.2, 2.4);
  });
  return { map, bumpMap, roughnessMap };
}

export function createSpongeTextures() {
  const size = 512;
  const colTop = document.createElement('canvas');
  const colSide = document.createElement('canvas');
  const bump = document.createElement('canvas');
  colTop.width = colSide.width = bump.width = size;
  colTop.height = colSide.height = bump.height = size;

  const ct = colTop.getContext('2d');
  const cs = colSide.getContext('2d');
  const bt = bump.getContext('2d');
  const rand = mulberry32(8871);

  // Top: golden baked genoise crust transitioning gently to warm crumb
  const topGrad = ct.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.5);
  topGrad.addColorStop(0, '#f3ca78');
  topGrad.addColorStop(0.72, '#e6b259');
  topGrad.addColorStop(0.92, '#d59740');
  topGrad.addColorStop(1, '#c38130');
  ct.fillStyle = topGrad;
  ct.fillRect(0, 0, size, size);

  // Side: moist pale-golden airy sponge crumb with slightly toasted top/bottom rim
  const sideGrad = cs.createLinearGradient(0, 0, 0, size);
  sideGrad.addColorStop(0, '#d89b44');
  sideGrad.addColorStop(0.08, '#f6d687');
  sideGrad.addColorStop(0.5, '#fae09c');
  sideGrad.addColorStop(0.92, '#f2cc78');
  sideGrad.addColorStop(1, '#cf8f3c');
  cs.fillStyle = sideGrad;
  cs.fillRect(0, 0, size, size);

  bt.fillStyle = '#a8a8a8';
  bt.fillRect(0, 0, size, size);

  // Airy sponge pores & fine crumb grain (makes it immediately recognizable as real sponge!)
  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + Math.pow(rand(), 2.2) * 4.2;
    const shade = 0.09 + rand() * 0.22;

    // Pores on side & top
    cs.fillStyle = `rgba(176, 118, 42, ${shade})`;
    cs.beginPath();
    cs.ellipse(x, y, r * (0.8 + rand() * 0.5), r * (0.7 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
    cs.fill();

    ct.fillStyle = `rgba(162, 102, 32, ${shade * 0.78})`;
    ct.beginPath();
    ct.arc(x, y, r * 0.85, 0, Math.PI * 2);
    ct.fill();

    // Recessed pore in bump map
    bt.fillStyle = `rgba(42, 42, 42, ${0.28 + rand() * 0.55})`;
    bt.beginPath();
    bt.arc(x, y, r * 0.95, 0, Math.PI * 2);
    bt.fill();
  }

  // Bright soft crumb highlights
  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.7 + rand() * 2.1;
    cs.fillStyle = `rgba(255, 245, 208, ${0.14 + rand() * 0.2})`;
    cs.beginPath();
    cs.arc(x, y, r, 0, Math.PI * 2);
    cs.fill();
    bt.fillStyle = `rgba(230, 230, 230, ${0.18 + rand() * 0.25})`;
    bt.beginPath();
    bt.arc(x, y, r, 0, Math.PI * 2);
    bt.fill();
  }

  const topMap = new THREE.CanvasTexture(colTop);
  const sideMap = new THREE.CanvasTexture(colSide);
  const bumpMap = new THREE.CanvasTexture(bump);
  topMap.colorSpace = THREE.SRGBColorSpace;
  sideMap.colorSpace = THREE.SRGBColorSpace;
  sideMap.wrapS = THREE.RepeatWrapping;
  sideMap.repeat.set(2, 1);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 1);
  return { topMap, sideMap, bumpMap };
}

export function createCakeInteriorTexture() {
  // Cross-section revealed when sliced: 2 fluffy sponge layers + thick cream filling + sliced strawberries!
  const w = 512;
  const h = 384;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(9912);

  // Base cream frost top
  ctx.fillStyle = '#fffdf7';
  ctx.fillRect(0, 0, w, h);

  // Helper to draw airy sponge band
  const drawSpongeBand = (y0, bandH) => {
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + bandH);
    grad.addColorStop(0, '#eab95a');
    grad.addColorStop(0.5, '#f6d47d');
    grad.addColorStop(1, '#e6b252');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, w, bandH);

    for (let i = 0; i < 1800; i++) {
      const x = rand() * w;
      const y = y0 + rand() * bandH;
      const r = 0.8 + Math.pow(rand(), 2) * 3.2;
      ctx.fillStyle = rand() > 0.35
        ? `rgba(156, 98, 28, ${0.16 + rand() * 0.28})`
        : `rgba(255, 245, 205, ${0.22 + rand() * 0.22})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Top whipped cream layer
  ctx.fillStyle = '#fffcf5';
  ctx.fillRect(0, 0, w, 46);

  // Upper sponge layer
  drawSpongeBand(46, 114);

  // Center whipped cream filling band
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 160, w, 86);
  // Subtle wavy cream edges
  for (let x = 0; x < w; x += 12) {
    ctx.fillStyle = '#fffdf7';
    ctx.beginPath();
    ctx.arc(x, 162, 7 + Math.sin(x * 0.1) * 3, 0, Math.PI * 2);
    ctx.arc(x, 244, 7 + Math.cos(x * 0.1) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sliced ruby strawberries embedded in the center cream layer!
  const sliceXs = [72, 198, 326, 444];
  sliceXs.forEach((sx, idx) => {
    const sy = 203 + (idx % 2 === 0 ? -3 : 4);
    const rx = 50;
    const ry = 34;
    // Outer juicy crimson rim
    const sGrad = ctx.createRadialGradient(sx, sy, 3, sx, sy, rx);
    sGrad.addColorStop(0, '#fff2f2');
    sGrad.addColorStop(0.24, '#ffb8be');
    sGrad.addColorStop(0.50, '#df1e34');
    sGrad.addColorStop(1, '#9a0818');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, (idx % 2 === 0 ? -0.06 : 0.07), 0, Math.PI * 2);
    ctx.fill();

    // Inner bright heart-vein rays
    ctx.strokeStyle = 'rgba(255, 232, 234, 0.78)';
    ctx.lineWidth = 2.2;
    for (let a = 0; a < 9; a++) {
      const ang = (a / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * rx * 0.56, sy + Math.sin(ang) * ry * 0.56);
      ctx.stroke();
    }
  });

  // Lower sponge layer
  drawSpongeBand(246, 128);

  // Subtle baked bottom crust
  ctx.fillStyle = '#cf9040';
  ctx.fillRect(0, h - 10, w, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStrawberryTextures(variant = 'red') {
  const size = 512;
  const col = document.createElement('canvas');
  const bump = document.createElement('canvas');
  const rough = document.createElement('canvas');
  col.width = bump.width = rough.width = size;
  col.height = bump.height = rough.height = size;

  const cc = col.getContext('2d');
  const bc = bump.getContext('2d');
  const rc = rough.getContext('2d');

  const isWhite = variant === 'white';

  // Vertical gradient: UV y=0 is tip (or top depending on lathe), let's make top (v=1 -> y=0 on canvas) pale shoulder and bottom (v=0 -> y=size) deep crimson tip!
  const grad = cc.createLinearGradient(0, 0, 0, size);
  if (isWhite) {
    grad.addColorStop(0.0, '#fff9f2');
    grad.addColorStop(0.22, '#fff0ec');
    grad.addColorStop(0.58, '#ffdbe0');
    grad.addColorStop(0.86, '#f9bfc8');
    grad.addColorStop(1.0, '#f0a6b3');
  } else {
    grad.addColorStop(0.0, '#f6d5be'); // pale natural shoulder right under calyx
    grad.addColorStop(0.10, '#e8413a');
    grad.addColorStop(0.38, '#d41724');
    grad.addColorStop(0.75, '#b60b1b');
    grad.addColorStop(1.0, '#8e0514');
  }
  cc.fillStyle = grad;
  cc.fillRect(0, 0, size, size);

  // Glossy berry skin base
  bc.fillStyle = '#d4d4d4';
  bc.fillRect(0, 0, size, size);
  rc.fillStyle = '#262626'; // very glossy skin!
  rc.fillRect(0, 0, size, size);

  // Natural staggered spiral dimples + achenes (strawberry seeds)
  const rows = 15;
  for (let r = 1; r < rows; r++) {
    const v = r / rows; // 0 = top shoulder, 1 = bottom tip
    const y = v * size;
    // Fewer seeds near tip & crown, denser around belly
    const count = Math.max(8, Math.round(24 * Math.sin(v * Math.PI * 0.88 + 0.18)));
    const rowShift = (r % 2) * 0.5;
    for (let i = 0; i < count; i++) {
      const u = (i + rowShift + (Math.sin(r * 7 + i * 3) * 0.08)) / count;
      const x = ((u % 1) + 1) % 1 * size;
      const dimpleR = 7.5 + Math.sin(v * Math.PI) * 3.5;

      // Soft recessed dimple around seed
      const dGrad = bc.createRadialGradient(x, y, 1, x, y, dimpleR);
      dGrad.addColorStop(0, '#323232');
      dGrad.addColorStop(0.55, '#686868');
      dGrad.addColorStop(1, 'rgba(212,212,212,0)');
      bc.fillStyle = dGrad;
      bc.beginPath();
      bc.ellipse(x, y, dimpleR * 0.9, dimpleR * 1.15, 0, 0, Math.PI * 2);
      bc.fill();

      // Subtle deeper color inside dimple
      cc.fillStyle = isWhite ? 'rgba(220, 120, 138, 0.24)' : 'rgba(92, 4, 12, 0.34)';
      cc.beginPath();
      cc.ellipse(x, y, dimpleR * 0.58, dimpleR * 0.78, 0, 0, Math.PI * 2);
      cc.fill();

      // Crisp teardrop seed (achene)
      cc.fillStyle = isWhite ? '#d63352' : '#e8be5a';
      cc.beginPath();
      cc.ellipse(x, y + 0.8, 2.3, 3.8, 0, 0, Math.PI * 2);
      cc.fill();

      // Tiny specular highlight dot on seed
      cc.fillStyle = isWhite ? '#ff8aa0' : '#fff0b3';
      cc.beginPath();
      cc.arc(x - 0.6, y - 0.6, 0.9, 0, Math.PI * 2);
      cc.fill();

      // Seed is slightly rougher than wet glossy skin
      rc.fillStyle = '#9c9c9c';
      rc.beginPath();
      rc.ellipse(x, y, 3.0, 4.2, 0, 0, Math.PI * 2);
      rc.fill();

      // Seed slightly raised center inside crater
      bc.fillStyle = '#c8c8c8';
      bc.beginPath();
      bc.ellipse(x, y, 2.0, 3.2, 0, 0, Math.PI * 2);
      bc.fill();
    }
  }

  const map = new THREE.CanvasTexture(col);
  const bumpMap = new THREE.CanvasTexture(bump);
  const roughnessMap = new THREE.CanvasTexture(rough);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = bumpMap.wrapS = roughnessMap.wrapS = THREE.RepeatWrapping;
  return { map, bumpMap, roughnessMap };
}

export function createLaceDoilyTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Scalloped outer petals
  const scallops = 32;
  ctx.fillStyle = '#fffdf9';
  ctx.beginPath();
  for (let i = 0; i < scallops; i++) {
    const a = (i / scallops) * Math.PI * 2;
    const px = cx + Math.cos(a) * (size * 0.435);
    const py = cy + Math.sin(a) * (size * 0.435);
    ctx.moveTo(px + 22, py);
    ctx.arc(px, py, 22, 0, Math.PI * 2);
  }
  ctx.fill();

  // Solid center disc
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.43, 0, Math.PI * 2);
  ctx.fill();

  // Cut out delicate eyelet lace holes
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < scallops; i++) {
    const a = (i / scallops) * Math.PI * 2;
    const aMid = ((i + 0.5) / scallops) * Math.PI * 2;

    // Outer petal eyelets
    const px = cx + Math.cos(a) * (size * 0.435);
    const py = cy + Math.sin(a) * (size * 0.435);
    ctx.beginPath();
    ctx.arc(px, py, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Inner lace diamond ring
    const rx = cx + Math.cos(aMid) * (size * 0.375);
    const ry = cy + Math.sin(aMid) * (size * 0.375);
    ctx.beginPath();
    ctx.arc(rx, ry, 5.2, 0, Math.PI * 2);
    ctx.fill();

    // Fine filigree pinholes
    const fx = cx + Math.cos(a) * (size * 0.34);
    const fy = cy + Math.sin(a) * (size * 0.34);
    ctx.beginPath();
    ctx.arc(fx, fy, 3.0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  // Soft embossed ring border
  ctx.strokeStyle = 'rgba(222, 212, 198, 0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.31, 0, Math.PI * 2);
  ctx.stroke();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function createPlushTextures(type = 'bear') {
  const size = 256;
  const col = document.createElement('canvas');
  const bump = document.createElement('canvas');
  col.width = bump.width = size;
  col.height = bump.height = size;
  const cc = col.getContext('2d');
  const bc = bump.getContext('2d');
  const rand = mulberry32(type === 'bear' ? 101 : type === 'cat' ? 202 : 303);

  const baseColors = {
    bear: '#c8925a',
    cat: '#f6efe4',
    bunny: '#b9957b',
  };
  cc.fillStyle = baseColors[type] || '#c8925a';
  cc.fillRect(0, 0, size, size);

  // Calico cat soft organic patches!
  if (type === 'cat') {
    const patches = [
      { x: 56, y: 74, rx: 52, ry: 40, c: '#d98a4a' },
      { x: 196, y: 92, rx: 46, ry: 38, c: '#6e4e3a' },
      { x: 132, y: 195, rx: 48, ry: 34, c: '#de9554' },
      { x: 34, y: 182, rx: 34, ry: 30, c: '#7a5842' },
    ];
    patches.forEach((p) => {
      const g = cc.createRadialGradient(p.x, p.y, p.rx * 0.25, p.x, p.y, p.rx);
      g.addColorStop(0, p.c);
      g.addColorStop(0.78, p.c);
      g.addColorStop(1, 'rgba(246,239,228,0)');
      cc.fillStyle = g;
      cc.beginPath();
      cc.ellipse(p.x, p.y, p.rx, p.ry, 0.2, 0, Math.PI * 2);
      cc.fill();
    });
  }

  bc.fillStyle = '#808080';
  bc.fillRect(0, 0, size, size);

  // Micro velvety plush fibers (creates realistic Steiff / flocked velvet toy texture!)
  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const ang = (rand() - 0.5) * 0.9 + Math.PI * 0.5;
    const len = 2.0 + rand() * 3.8;
    const bright = rand() > 0.5;
    cc.strokeStyle = bright ? 'rgba(255,248,236,0.09)' : 'rgba(65,38,18,0.07)';
    cc.lineWidth = 0.8;
    cc.beginPath();
    cc.moveTo(x, y);
    cc.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    cc.stroke();

    bc.strokeStyle = bright ? 'rgba(210,210,210,0.22)' : 'rgba(52,52,52,0.22)';
    bc.lineWidth = 0.9;
    bc.beginPath();
    bc.moveTo(x, y);
    bc.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    bc.stroke();
  }

  const map = new THREE.CanvasTexture(col);
  const bumpMap = new THREE.CanvasTexture(bump);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.5, 2.5);
  return { map, bumpMap };
}

export function createCreamSwirlBump() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Soft glossy spiral ridges
  const cx = size / 2;
  const cy = size / 2;
  for (let r = 8; r < size * 0.48; r += 5) {
    ctx.strokeStyle = r % 10 === 0 ? 'rgba(220,220,220,0.45)' : 'rgba(65,65,65,0.35)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createBokehTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const g = ctx.createRadialGradient(cx, cx, 2, cx, cx, cx);
  g.addColorStop(0, 'rgba(255, 252, 240, 1.0)');
  g.addColorStop(0.45, 'rgba(255, 244, 212, 0.72)');
  g.addColorStop(0.82, 'rgba(255, 232, 185, 0.20)');
  g.addColorStop(1, 'rgba(255, 232, 185, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
