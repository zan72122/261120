import * as THREE from 'three';

// 1. Kraft Paper Grocery Bag (supple crinkled paper folds, V-pleated gussets, folded cuff, twisted handles)
export function createKraftShoppingBag(pbr, contactShadowTex) {
  const group = new THREE.Group();
  group.name = 'shopping_bag';

  const W = 0.215;
  const D = 0.140;
  const H = 0.198;

  function makeSideWall(w, h, flip, isGusset) {
    const geo = new THREE.PlaneGeometry(w, h, isGusset ? 16 : 22, 18);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      const y = pos.getY(i);
      const yn = (y + h / 2) / h; // 0..1
      const xn = x / (w / 2);     // -1..1

      // Slight relaxed flare near top rim + gentle corner pinch near bottom
      const flare = 1.0 + 0.085 * Math.pow(yn, 1.25) - 0.02 * Math.sin(yn * Math.PI);
      x *= flare;

      let z = 0;
      if (isGusset) {
        const pleatDepth = (0.025 * (1.0 - 0.48 * yn)) * (1.0 - Math.abs(xn));
        const crinkle = 0.0024 * Math.sin(yn * 16.0 + xn * 5.0) * Math.sin(yn * Math.PI);
        z -= pleatDepth + crinkle;
      } else {
        // Authentic stuffed-bag organic belly bulge + diagonal paper crinkle creases!
        const belly = 0.013 * Math.sin(yn * Math.PI) * (1.0 - xn * xn * 0.65);
        const crease1 = 0.0036 * Math.sin(xn * 7.8 + yn * 9.5) * Math.sin(yn * Math.PI);
        const crease2 = 0.0022 * Math.cos(xn * 14.0 - yn * 12.0) * Math.pow(yn, 0.7);
        const bottomFold = yn < 0.14 ? -0.004 * (1 - yn / 0.14) : 0;
        z += belly + crease1 + crease2 + bottomFold;
      }
      const topWave = 0.0038 * Math.sin(xn * 5.2 + 0.7) * Math.pow(yn, 2.5);
      pos.setXYZ(i, x, y + h / 2 + topWave, flip ? -z : z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const frontWall = new THREE.Mesh(makeSideWall(W, H, false, false), pbr.kraftBag);
  frontWall.position.z = D / 2;
  frontWall.castShadow = true;
  frontWall.receiveShadow = true;
  group.add(frontWall);

  const backWall = new THREE.Mesh(makeSideWall(W, H, true, false), pbr.kraftBag);
  backWall.rotation.y = Math.PI;
  backWall.position.z = -D / 2;
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  const rightGusset = new THREE.Mesh(makeSideWall(D, H, false, true), pbr.kraftBag);
  rightGusset.rotation.y = Math.PI / 2;
  rightGusset.position.x = W / 2;
  rightGusset.castShadow = true;
  rightGusset.receiveShadow = true;
  group.add(rightGusset);

  const leftGusset = new THREE.Mesh(makeSideWall(D, H, false, true), pbr.kraftBag);
  leftGusset.rotation.y = -Math.PI / 2;
  leftGusset.position.x = -W / 2;
  leftGusset.castShadow = true;
  leftGusset.receiveShadow = true;
  group.add(leftGusset);

  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(W, D), pbr.kraftBagInside);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.004;
  bottom.receiveShadow = true;
  group.add(bottom);

  const innerShade = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.94, H * 0.86, D * 0.88),
    new THREE.MeshStandardMaterial({ color: '#453220', roughness: 0.98, side: THREE.BackSide })
  );
  innerShade.position.y = H * 0.44;
  group.add(innerShade);

  // Softly crinkled folded top rim cuff
  const rimMat = pbr.kraftBag;
  const rimThick = 0.0038;
  const rimH = 0.013;
  const rimW = W * 1.08;
  const rimD = D * 1.075;
  for (const sz of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(rimW, rimH, rimThick), rimMat);
    strip.position.set(0, H - rimH / 2 + 0.001, sz * (rimD / 2));
    strip.castShadow = true;
    group.add(strip);
  }
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(rimThick, rimH, rimD), rimMat);
    strip.position.set(sx * (rimW / 2), H - rimH / 2 + 0.001, 0);
    group.add(strip);
  }

  // Two organic curved twisted kraft-paper loop handles
  const handleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#bc946a'),
    normalMap: pbr.pulpNormalTex,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.94,
    metalness: 0.0,
  });
  for (const sz of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.046, H - 0.012, sz * (D * 0.52)),
      new THREE.Vector3(-0.043, H + 0.046, sz * (D * 0.62)),
      new THREE.Vector3(0.0,    H + 0.062, sz * (D * 0.69)),
      new THREE.Vector3(0.043,  H + 0.046, sz * (D * 0.62)),
      new THREE.Vector3(0.046,  H - 0.012, sz * (D * 0.52)),
    ]);
    const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.0035, 8, false), handleMat);
    handle.castShadow = true;
    group.add(handle);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.48, D * 1.56),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.0012;
  group.add(shadow);

  return group;
}

// 2. Photorealistic Wordless 1L Japanese Gable-Top Milk Carton
function createMilkCartonTextures() {
  const w = 512;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.scale(0.5, 0.5); // Keep exact 1024-unit coordinate math at crisp 512x512 memory footprint!

  // Warm PE-coated dairy paperboard base
  ctx.fillStyle = '#f2efe6';
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const a = Math.random() * 0.025;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(175,165,148,${a})` : `rgba(255,253,248,${a})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Deep Japanese dairy cobalt upper band
  const topGrad = ctx.createLinearGradient(0, 0, 0, 345);
  topGrad.addColorStop(0.0, '#1c549c');
  topGrad.addColorStop(0.72, '#2463b2');
  topGrad.addColorStop(1.0, '#2f74c6');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 1024, 335);

  // Creamy undulating milk wave across all 4 faces
  ctx.beginPath();
  ctx.moveTo(0, 330);
  for (let x = 0; x <= 1024; x += 8) {
    const wave = Math.sin((x / 256) * Math.PI * 2 + 0.5) * 26 + Math.cos((x / 256) * Math.PI * 4) * 7;
    ctx.lineTo(x, 344 + wave);
  }
  ctx.lineTo(1024, 460);
  ctx.lineTo(0, 460);
  ctx.closePath();
  ctx.fillStyle = '#f2efe6';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 358);
  for (let x = 0; x <= 1024; x += 8) {
    const wave = Math.sin((x / 256) * Math.PI * 2 + 0.5) * 26 + Math.cos((x / 256) * Math.PI * 4) * 7;
    ctx.lineTo(x, 358 + wave);
  }
  for (let x = 1024; x >= 0; x -= 8) {
    const wave = Math.sin((x / 256) * Math.PI * 2 + 0.85) * 20;
    ctx.lineTo(x, 396 + wave);
  }
  ctx.closePath();
  ctx.fillStyle = '#cde1f4';
  ctx.fill();

  // Bottom cobalt trim + lush meadow hill silhouette (purely visual, ZERO text!)
  ctx.fillStyle = '#225fae';
  ctx.fillRect(0, 882, 1024, 142);

  ctx.beginPath();
  ctx.moveTo(0, 885);
  for (let x = 0; x <= 1024; x += 8) {
    const hill = Math.sin((x / 256) * Math.PI * 2) * 20 + Math.cos((x / 512) * Math.PI * 2) * 14;
    ctx.lineTo(x, 848 + hill);
  }
  ctx.lineTo(1024, 890);
  ctx.lineTo(0, 890);
  ctx.closePath();
  ctx.fillStyle = '#5f9658';
  ctx.fill();

  // Minimalist pure-graphic milk-drop medallion on each of the 4 panels
  for (let p = 0; p < 4; p++) {
    const cx = p * 256 + 128;
    const cy = 610;

    ctx.beginPath();
    ctx.arc(cx, cy, 68, 0, Math.PI * 2);
    ctx.fillStyle = '#e5eff9';
    ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = '#2463b2';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - 42);
    ctx.bezierCurveTo(cx + 34, cy - 2, cx + 38, cy + 32, cx, cy + 38);
    ctx.bezierCurveTo(cx - 38, cy + 32, cx - 34, cy - 2, cx, cy - 42);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#2463b2';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx - 10, cy + 8, 9, Math.PI * 0.7, Math.PI * 1.4);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#b4d3f2';
    ctx.stroke();

    ctx.fillStyle = '#8db4de';
    ctx.fillRect(cx - 42, cy + 88, 84, 5);
    ctx.fillStyle = '#bcd5ee';
    ctx.fillRect(cx - 26, cy + 100, 52, 4);

    const edgeX = p * 256;
    const crease = ctx.createLinearGradient(edgeX - 7, 0, edgeX + 7, 0);
    crease.addColorStop(0, 'rgba(40,35,30,0)');
    crease.addColorStop(0.5, 'rgba(40,35,30,0.16)');
    crease.addColorStop(1, 'rgba(40,35,30,0)');
    ctx.fillStyle = crease;
    ctx.fillRect(edgeX - 7, 0, 14, 1024);
  }

  const foldGrad = ctx.createLinearGradient(0, 290, 0, 316);
  foldGrad.addColorStop(0, 'rgba(18,28,42,0)');
  foldGrad.addColorStop(0.5, 'rgba(18,28,42,0.24)');
  foldGrad.addColorStop(1, 'rgba(18,28,42,0)');
  ctx.fillStyle = foldGrad;
  ctx.fillRect(0, 290, 1024, 26);

  const colorTex = new THREE.CanvasTexture(c);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;

  const rc = document.createElement('canvas');
  rc.width = 256;
  rc.height = 256;
  const rctx = rc.getContext('2d');
  rctx.fillStyle = 'rgb(76, 76, 76)';
  rctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 800; i++) {
    const v = 64 + Math.floor(Math.random() * 28);
    rctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    rctx.fillRect(Math.random() * 256, Math.random() * 256, 5, 5);
  }
  rctx.fillStyle = 'rgb(152,152,152)';
  rctx.fillRect(0, 0, 256, 18);
  for (let p = 0; p < 4; p++) {
    rctx.fillRect(p * 64 - 2, 0, 4, 256);
  }
  const roughTex = new THREE.CanvasTexture(rc);
  roughTex.colorSpace = THREE.NoColorSpace;
  roughTex.wrapS = THREE.RepeatWrapping;

  return { colorTex, roughTex };
}

export function createMilkCarton(pbr) {
  const group = new THREE.Group();
  group.name = 'milk_carton';

  const { colorTex, roughTex } = createMilkCartonTextures();
  const mat = new THREE.MeshStandardMaterial({
    map: colorTex,
    roughnessMap: roughTex,
    roughness: 0.96,
    normalMap: pbr.pulpNormalTex,
    normalScale: new THREE.Vector2(0.07, 0.07),
    metalness: 0.0,
    envMapIntensity: 0.90,
  });

  const W = 0.068;
  const D = 0.068;
  const bodyH = 0.168;
  const roofH = 0.036;
  const finH = 0.013;

  // Rounded-corner body + authentic slight hydrostatic milk-weight belly bulge
  const bodyGeo = new THREE.BoxGeometry(W, bodyH, D, 8, 12, 8);
  const pos = bodyGeo.attributes.position;
  const uv = bodyGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + bodyH / 2) / bodyH;

    const ax = Math.abs(x) / (W / 2);
    const az = Math.abs(z) / (D / 2);
    if (ax > 0.84 && az > 0.84) {
      x *= 0.96;
      z *= 0.96;
    }
    const bulge = 1.0 + 0.036 * Math.sin(yn * Math.PI);
    if (ax < 0.88) z *= bulge;
    if (az < 0.88) x *= bulge;

    pos.setXYZ(i, x, y + bodyH / 2, z);

    // Align panel center directly with +Z front face!
    const angle = Math.atan2(x, z); // 0 at +Z
    const u = ((angle / (Math.PI * 2)) + 1.125) % 1.0;
    const v = 0.03 + yn * 0.65;
    uv.setXY(i, u, v);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Crisp extruded gable roof with paperboard bevel
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-D / 2, 0);
  roofShape.lineTo(D / 2, 0);
  roofShape.lineTo(0.0022, roofH);
  roofShape.lineTo(-0.0022, roofH);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: W - 0.003,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0011,
    bevelSegments: 2,
  });
  roofGeo.translate(0, 0, -(W - 0.003) / 2);
  roofGeo.rotateY(Math.PI / 2);
  const ruv = roofGeo.attributes.uv;
  const rpos = roofGeo.attributes.position;
  for (let i = 0; i < rpos.count; i++) {
    const ry = rpos.getY(i) / roofH;
    ruv.setXY(i, 0.25 + (rpos.getX(i) / W) * 0.22, 0.72 + ry * 0.24);
  }
  ruv.needsUpdate = true;

  const roof = new THREE.Mesh(roofGeo, mat);
  roof.position.y = bodyH;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Subtle folded white laminated paperboard edge lines on gable shoulders
  const edgePaperMat = new THREE.MeshStandardMaterial({ color: '#e6e1d6', roughness: 0.75 });
  for (const sz of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.002, 0.0024, 0.0024), edgePaperMat);
    lip.position.set(0, bodyH + 0.0005, sz * (D / 2 + 0.0005));
    group.add(lip);
  }

  // Recessed side-tuck triangular indentation lines on left & right of gable
  const tuckMat = new THREE.MeshStandardMaterial({ color: '#1b4e8e', roughness: 0.48 });
  for (const sx of [-1, 1]) {
    const tuck = new THREE.Mesh(new THREE.ConeGeometry(D * 0.36, roofH * 0.82, 3), tuckMat);
    tuck.scale.set(0.16, 1.0, 1.0);
    tuck.position.set(sx * (W / 2 - 0.0008), bodyH + roofH * 0.42, 0);
    group.add(tuck);
  }

  // Sealed crimped top ridge fin + white raw paperboard top cut seam
  const finMat = new THREE.MeshStandardMaterial({ color: '#205ca5', roughness: 0.38 });
  const fin = new THREE.Mesh(new THREE.BoxGeometry(W + 0.002, finH, 0.0052), finMat);
  fin.position.y = bodyH + roofH + finH / 2 - 0.001;
  fin.castShadow = true;
  group.add(fin);

  const seamEdge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.003, 0.0024, 0.0056), edgePaperMat);
  seamEdge.position.y = bodyH + roofH + finH - 0.0015;
  group.add(seamEdge);

  return group;
}

// 3. Organically Scalloped Molded Fiber 6-Egg Carton + 6 Realistic Speckled Farm Eggs
function createEggshellTexture(seed) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  let s = seed * 1337 + 17;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  for (let i = 0; i < 950; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.5 + rand() * 1.4;
    ctx.fillStyle = rand() > 0.38
      ? `rgba(128, 86, 56, ${0.05 + rand() * 0.14})`
      : `rgba(255, 250, 244, ${0.05 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function createEggGeometry() {
  const pts = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI;
    const y = (1 - Math.cos(angle)) * 0.5 * 0.0565;
    const asym = 1.0 - 0.16 * (t - 0.38);
    const r = Math.sin(angle) * 0.0214 * asym;
    pts.push(new THREE.Vector2(Math.max(0, r), y));
  }
  const geo = new THREE.LatheGeometry(pts, 18);
  geo.computeVertexNormals();
  return geo;
}

export function createEggCarton(pbr) {
  const group = new THREE.Group();
  group.name = 'egg_carton';

  const W = 0.152;
  const D = 0.104;
  const baseH = 0.032;

  const cupCenters = [];
  for (let col = -1; col <= 1; col++) {
    for (let row = -0.5; row <= 0.5; row += 1) {
      cupCenters.push([col * 0.046, row * 0.046]);
    }
  }
  const postCenters = [[-0.023, 0], [0.023, 0]];

  // Unified sculpted molded-pulp tray with rounded outer shoulders, scalloped sides, & deep AO cup pockets!
  const trayGeo = new THREE.BoxGeometry(W, baseH, D, 22, 3, 16);
  const pos = trayGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = THREE.MathUtils.clamp((y + baseH / 2) / baseH, 0, 1);

    // Softly taper bottom inward like a real thermo-molded paper pulp egg carton!
    const bottomTaper = 0.87 + 0.13 * Math.pow(yn, 0.7);
    let nearestCup = 99;
    for (const [cx, cz] of cupCenters) {
      nearestCup = Math.min(nearestCup, Math.hypot(x - cx, z - cz));
    }
    const ax = Math.abs(x) / (W / 2);
    const az = Math.abs(z) / (D / 2);

    if (ax > 0.78 && az > 0.78) {
      const dx = (ax - 0.78) / 0.22;
      const dz = (az - 0.78) / 0.22;
      const cornerRound = Math.max(0, Math.hypot(dx, dz) - 1.0);
      if (cornerRound > 0) {
        const pull = 1.0 - 0.075 * cornerRound;
        x *= pull;
        z *= pull;
      }
    }

    const onWall = ax > 0.86 || az > 0.86;
    if (onWall && yn < 0.85) {
      const scallop = 1.0 - 0.04 * Math.max(0, nearestCup - 0.024) / 0.015;
      x *= bottomTaper * scallop;
      z *= bottomTaper * scallop;
    } else if (yn < 0.85) {
      x *= bottomTaper;
      z *= bottomTaper;
    }

    let finalY = y + baseH / 2;
    let ao = 0.86 + 0.14 * yn;

    if (yn > 0.82) {
      finalY = baseH * 0.90;
      for (const [cx, cz] of cupCenters) {
        const dist = Math.hypot(x - cx, z - cz);
        if (dist < 0.0255) {
          const k = Math.cos((dist / 0.0255) * (Math.PI / 2));
          const cupY = baseH * (0.90 - 0.82 * k * k);
          if (cupY < finalY) {
            finalY = cupY;
            ao = Math.min(ao, 0.56 + 0.40 * (1 - k * k));
          }
        }
      }
      for (const [px, pz] of postCenters) {
        const dist = Math.hypot(x - px, z - pz);
        if (dist < 0.018) {
          const k = Math.cos((dist / 0.018) * (Math.PI / 2));
          finalY = Math.max(finalY, baseH * (0.90 + 0.72 * k));
        }
      }
      const edgeDist = Math.max(ax, az);
      if (edgeDist > 0.86) {
        finalY -= (edgeDist - 0.86) * 0.016;
      }
    }

    const lump = 0.00045 * Math.sin(x * 150 + z * 125);
    pos.setXYZ(i, x, Math.max(0.001, finalY + lump), z);

    colors[i * 3 + 0] = ao;
    colors[i * 3 + 1] = ao * 0.985;
    colors[i * 3 + 2] = ao * 0.96;
  }
  trayGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  trayGeo.computeVertexNormals();

  const trayMesh = new THREE.Mesh(trayGeo, pbr.eggPulp);
  trayMesh.castShadow = true;
  trayMesh.receiveShadow = true;
  group.add(trayMesh);

  // 6 Realistic Speckled Farm Eggs nestled deeply inside the 6 pulp cups (sharing 2 lightweight textures!)
  const eggGeo = createEggGeometry();
  const eggTexA = createEggshellTexture(3);
  const eggTexB = createEggshellTexture(7);
  const eggShades = ['#d8ae8b', '#e5c6ab', '#f1e6d8', '#cea07c', '#ede2d2', '#dcb594'];
  cupCenters.forEach(([cx, cz], idx) => {
    const eggMat = new THREE.MeshStandardMaterial({
      map: idx % 2 === 0 ? eggTexA : eggTexB,
      color: new THREE.Color(eggShades[idx % eggShades.length]),
      roughness: 0.53 + (idx % 3) * 0.03,
      metalness: 0.0,
      envMapIntensity: 0.55,
    });
    const egg = new THREE.Mesh(eggGeo, eggMat);
    egg.position.set(cx, 0.005, cz);
    egg.rotation.set((idx % 2 === 0 ? 1 : -1) * 0.032, idx * 1.15, ((idx % 3) - 1) * 0.028);
    egg.castShadow = true;
    egg.receiveShadow = true;
    group.add(egg);
  });

  // Sculpted Hinged Molded Pulp Lid (clamped yn — ZERO NaN normals! Rests naturally folded back open!)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, baseH * 0.84, -D / 2 + 0.002);

  const lidH = 0.038;
  const lidGeo = new THREE.BoxGeometry(W - 0.004, lidH, D - 0.004, 12, 4, 8);
  const lpos = lidGeo.attributes.position;
  for (let i = 0; i < lpos.count; i++) {
    let x = lpos.getX(i);
    let y = lpos.getY(i);
    let z = lpos.getZ(i);
    const yn = THREE.MathUtils.clamp((y + lidH / 2) / lidH, 0, 1);
    const ax = Math.abs(x) / ((W - 0.004) / 2);
    const az = Math.abs(z) / ((D - 0.004) / 2);

    const taper = 1.0 - 0.16 * Math.pow(yn, 0.85);
    x *= taper;
    z *= taper;
    if (ax > 0.78 && az > 0.78) {
      x *= 0.94;
      z *= 0.94;
    }
    let ly = y + lidH / 2;
    if (yn < 0.15 && ax < 0.82 && az < 0.82) {
      ly += 0.012;
    }
    lpos.setXYZ(i, x, ly, z + D / 2);
  }
  lidGeo.computeVertexNormals();
  const lidMesh = new THREE.Mesh(lidGeo, pbr.eggPulpPlain);
  lidMesh.castShadow = true;
  lidMesh.receiveShadow = true;
  lidPivot.add(lidMesh);

  // Rest lid naturally folded flat-open (~168° back onto the wood counter) so it looks effortless & NEVER hides the milk carton!
  lidPivot.rotation.x = -2.92;
  group.add(lidPivot);
  group.userData.lidPivot = lidPivot;
  group.userData.lidOpen = true;

  return group;
}

function normalizeModel(gltfScene, { nodeName = null, targetSize = 0.09, rotX = 0, rotY = 0, rotZ = 0 } = {}) {
  let source = gltfScene;
  if (nodeName) {
    const found = gltfScene.getObjectByName(nodeName);
    if (found) source = found;
  }
  const clone = source.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(rotX, rotY, rotZ);
  clone.scale.setScalar(1);
  clone.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 0.1;
  const s = targetSize / maxDim;
  clone.scale.setScalar(s);
  clone.updateMatrixWorld(true);

  const b2 = new THREE.Box3().setFromObject(clone);
  const center = b2.getCenter(new THREE.Vector3());
  clone.position.set(-center.x, -b2.min.y, -center.z);

  const wrapper = new THREE.Group();
  wrapper.add(clone);
  wrapper.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(wrapper);
  const finalSize = finalBox.getSize(new THREE.Vector3());
  return { wrapper, size: finalSize };
}

export function createGroceries(models, pbr, contactShadowTex) {
  const items = [];

  function registerItem(id, category, meshGroup, { radius, height, rollable = false, stackable = false, preferredZone, homePos, homeRotY = 0 }) {
    const root = new THREE.Group();
    root.name = `grocery_${id}`;
    root.add(meshGroup);

    const shSize = Math.max(radius * 2.55, 0.085);
    const shMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(shSize, shSize), shMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.0014;
    root.add(shadow);

    root.position.copy(homePos);
    root.rotation.y = homeRotY;

    items.push({
      id,
      category,
      root,
      meshGroup,
      shadow,
      shadowMat: shMat,
      radius,
      height,
      rollable,
      stackable,
      preferredZone,
      homePos: homePos.clone(),
      homeRotY,
      state: 'counter',
      zone: 'counter',
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    });
  }

  // Tight, cozy real-world kitchen unpack cluster (X = -0.22..+0.15, Z = 0.50..0.82) — 100% visible in BOTH 390x844 and 1024x768!

  // 1. Milk Carton — unobstructed hero placement right beside the bag & glass with crisp gap behind open egg lid!
  const milk = createMilkCarton(pbr);
  registerItem('milk', 'milk', milk, {
    radius: 0.044,
    height: 0.218,
    rollable: false,
    stackable: false,
    preferredZone: 'door_pocket_lower',
    homePos: new THREE.Vector3(0.022, 0.0, 0.562),
    homeRotY: -0.18,
  });

  // 2. Molded Pulp 6-Egg Carton — foreground center-right so all 6 speckled eggs gleam cleanly!
  const eggs = createEggCarton(pbr);
  registerItem('eggs', 'eggs', eggs, {
    radius: 0.070,
    height: 0.068,
    rollable: false,
    stackable: true,
    preferredZone: 'shelf',
    homePos: new THREE.Vector3(0.015, 0.0, 0.792),
    homeRotY: -0.10,
  });

  // 3. Red Apple (Poly Haven food_apple_01)
  if (models.food_apple_01) {
    const { wrapper, size } = normalizeModel(models.food_apple_01, { targetSize: 0.082 });
    registerItem('apple', 'fruit', wrapper, {
      radius: Math.max(size.x, size.z) * 0.5,
      height: size.y,
      rollable: true,
      preferredZone: 'shelf',
      homePos: new THREE.Vector3(-0.118, 0.0, 0.742),
      homeRotY: 0.65,
    });
  }

  // 4. Golden Asian Pear (Poly Haven food_pears_asian_01)
  if (models.food_pears_asian_01) {
    const { wrapper, size } = normalizeModel(models.food_pears_asian_01, { nodeName: 'food_pears_asian_01_a', targetSize: 0.082 });
    registerItem('pear', 'fruit', wrapper, {
      radius: Math.max(size.x, size.z) * 0.5,
      height: size.y,
      rollable: true,
      preferredZone: 'shelf',
      homePos: new THREE.Vector3(-0.175, 0.0, 0.702),
      homeRotY: -0.45,
    });
  }

  // 5. Bright Yellow Lemon (Poly Haven lemon)
  if (models.lemon) {
    const { wrapper, size } = normalizeModel(models.lemon, { targetSize: 0.075, rotZ: Math.PI / 2 });
    registerItem('lemon', 'fruit', wrapper, {
      radius: Math.max(size.x, size.z) * 0.48,
      height: size.y,
      rollable: true,
      preferredZone: 'door_pocket_upper',
      homePos: new THREE.Vector3(0.135, 0.0, 0.748),
      homeRotY: 0.35,
    });
  }

  // 6. Fresh Green Lime (Poly Haven food_lime_01 — peeking out of shopping bag!)
  if (models.food_lime_01) {
    const { wrapper, size } = normalizeModel(models.food_lime_01, { targetSize: 0.064, rotZ: Math.PI / 2 });
    registerItem('lime', 'fruit', wrapper, {
      radius: Math.max(size.x, size.z) * 0.48,
      height: size.y,
      rollable: true,
      preferredZone: 'door_pocket_upper',
      homePos: new THREE.Vector3(-0.115, 0.162, 0.565),
      homeRotY: 1.0,
    });
  }

  // 7. Banana Bunch (Poly Haven bananas — peeking out of shopping bag!)
  if (models.bananas) {
    const { wrapper, size } = normalizeModel(models.bananas, { nodeName: 'bananas_bunch', targetSize: 0.165 });
    registerItem('bananas', 'fruit', wrapper, {
      radius: 0.068,
      height: size.y,
      rollable: false,
      stackable: true,
      preferredZone: 'shelf',
      homePos: new THREE.Vector3(-0.185, 0.140, 0.548),
      homeRotY: 0.48,
    });
  }

  // 8. Avocado (Poly Haven food_avocado_01)
  if (models.food_avocado_01) {
    const { wrapper, size } = normalizeModel(models.food_avocado_01, { targetSize: 0.098, rotZ: Math.PI / 2 });
    registerItem('avocado', 'veg', wrapper, {
      radius: Math.max(size.x, size.z) * 0.45,
      height: size.y,
      rollable: true,
      preferredZone: 'crisper',
      homePos: new THREE.Vector3(-0.072, 0.0, 0.678),
      homeRotY: 0.42,
    });
  }

  // 9. Yellow Onion (Poly Haven yellow_onion)
  if (models.yellow_onion) {
    const { wrapper, size } = normalizeModel(models.yellow_onion, { targetSize: 0.078 });
    registerItem('onion', 'veg', wrapper, {
      radius: Math.max(size.x, size.z) * 0.5,
      height: size.y,
      rollable: true,
      preferredZone: 'crisper',
      homePos: new THREE.Vector3(-0.165, 0.0, 0.805),
      homeRotY: 1.35,
    });
  }

  // 10. Sweet Potato (Poly Haven sweet_potato — nestled cleanly inside Kraft bag, peeking over top rim!)
  if (models.sweet_potato) {
    const { wrapper, size } = normalizeModel(models.sweet_potato, { targetSize: 0.128, rotZ: Math.PI / 2 });
    registerItem('sweet_potato', 'veg', wrapper, {
      radius: 0.052,
      height: size.y,
      rollable: true,
      preferredZone: 'crisper',
      homePos: new THREE.Vector3(-0.105, 0.145, 0.548),
      homeRotY: 0.25,
    });
  }

  // 11. Fresh Ginger (Poly Haven food_ginger_01)
  if (models.food_ginger_01) {
    const { wrapper, size } = normalizeModel(models.food_ginger_01, { targetSize: 0.105, rotZ: Math.PI / 2 });
    registerItem('ginger', 'veg', wrapper, {
      radius: 0.048,
      height: size.y,
      rollable: false,
      preferredZone: 'crisper',
      homePos: new THREE.Vector3(-0.035, 0.0, 0.485),
      homeRotY: 0.75,
    });
  }

  return items;
}
