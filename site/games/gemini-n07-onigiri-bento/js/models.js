import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

export function createContactShadow(shadowTex, width, depth, opacity = 0.82) {
  const geo = new THREE.PlaneGeometry(width, depth);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.0005;
  mesh.renderOrder = 1;
  return mesh;
}

// Helper: oval bentwood hollow wall with real thickness, subtle bevels, horizontal wood grain UVs
function createBentwoodOvalRing({ rx, rz, height, thickness, segments = 64, bevel = 0.0012 }) {
  // Cross section around the oval perimeter (closed loop of profile points)
  const rOut = 0;
  const rIn = -thickness;
  const profile = [
    [rOut, 0.0],
    [rOut, bevel],
    [rOut, height - bevel],
    [rOut - bevel * 0.7, height],
    [rIn + bevel * 0.7, height],
    [rIn, height - bevel],
    [rIn, bevel],
    [rIn, 0.0],
  ];
  const pLen = profile.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const theta = u * Math.PI * 2;
    const cx = Math.cos(theta) * rx;
    const cz = Math.sin(theta) * rz;
    // Outward normal of ellipse
    let nx = Math.cos(theta) / rx;
    let nz = Math.sin(theta) / rz;
    const nl = Math.hypot(nx, nz);
    nx /= nl;
    nz /= nl;

    for (let j = 0; j < pLen; j++) {
      const [dr, y] = profile[j];
      positions.push(cx + nx * dr, y, cz + nz * dr);
      uvs.push(u * 2.4, (y / height) * 0.45 + (j >= 4 ? 0.5 : 0.0));
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < pLen; j++) {
      const jNext = (j + 1) % pLen;
      const a = i * pLen + j;
      const b = (i + 1) * pLen + j;
      const c = (i + 1) * pLen + jNext;
      const d = i * pLen + jNext;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createOvalDisk({ rx, rz, thickness, segments = 64, yBottom = 0 }) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * rz;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: segments,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, yBottom, 0);
  // Normalize UVs cleanly to wood grain
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) / (rx * 2) + 0.5) * 1.1, (pos.getZ(i) / (rz * 2) + 0.5) * 1.1);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Traditional Japanese Magewappa (bentwood cedar/maple) Bento Box + Lid + Divider + Sakura-bark seam
export function createMagewappaBentoBox(maplePBR, cherryPBR, cedarGrainMap = null) {
  const rx = 0.092; // 18.4cm wide
  const rz = 0.061; // 12.2cm deep
  const wallH = 0.054; // 5.4cm tall
  const wallT = 0.0042; // 4.2mm bentwood wall

  // Authentic Akita-sugi cedar wood grain paired with Poly Haven cherry_veneer normal & roughness maps!
  const woodMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff5e6'),
    map: cedarGrainMap || cherryPBR.map,
    normalMap: cherryPBR.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: cherryPBR.roughnessMap,
    aoMap: maplePBR.aoMap,
    aoMapIntensity: 0.65,
    roughness: 0.72,
    metalness: 0.0,
  });

  const innerWoodMat = woodMat.clone();
  innerWoodMat.color = new THREE.Color('#efd8b8');
  innerWoodMat.roughness = 0.78;

  const barkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4a2110'),
    map: cherryPBR.map,
    normalMap: cherryPBR.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: cherryPBR.roughnessMap,
    roughness: 0.52,
    metalness: 0.0,
  });

  // --- Box Base ---
  const boxGroup = new THREE.Group();
  boxGroup.name = 'bentoBox';

  const wallGeo = createBentwoodOvalRing({ rx, rz, height: wallH, thickness: wallT, segments: 48 });
  const wallMesh = new THREE.Mesh(wallGeo, woodMat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  boxGroup.add(wallMesh);

  // Recessed wooden floor (4mm off table, 4mm thick)
  const floorGeo = createOvalDisk({ rx: rx - wallT + 0.0005, rz: rz - wallT + 0.0005, thickness: 0.004, segments: 48, yBottom: 0.004 });
  const floorMesh = new THREE.Mesh(floorGeo, innerWoodMat);
  floorMesh.receiveShadow = true;
  floorMesh.castShadow = true;
  boxGroup.add(floorMesh);

  // Authentic cherry-bark (kabazaiku) seam binding on front-right bentwood joint
  const seamAngle = 0.35;
  const seamGroup = new THREE.Group();
  const sx = Math.cos(seamAngle) * (rx + 0.0004);
  const sz = Math.sin(seamAngle) * (rz + 0.0004);
  seamGroup.position.set(sx, 0, sz);
  seamGroup.rotation.y = -seamAngle + Math.PI / 2;

  // Vertical overlap step strip
  const lapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.008, wallH - 0.002, 0.0012), woodMat);
  lapMesh.position.set(0, wallH / 2, 0.0002);
  seamGroup.add(lapMesh);

  // 4 horizontal sakura-bark stitches merged into 1 draw call
  const stitchGeos = [];
  for (let i = 0; i < 4; i++) {
    const sy = 0.011 + i * 0.011;
    const g = new THREE.BoxGeometry(0.014, 0.0036, 0.0018);
    g.translate(0, sy, 0.0008);
    stitchGeos.push(g);
  }
  const stitchesMesh = new THREE.Mesh(mergeGeometries(stitchGeos), barkMat);
  seamGroup.add(stitchesMesh);
  boxGroup.add(seamGroup);

  // Removable interior wooden divider (shikiri) — authentically lower than rim (31mm) with gentle curve
  const divShape = new THREE.Shape();
  const dh = 0.030;
  const dw = rz * 1.84;
  divShape.moveTo(-dw / 2, 0);
  divShape.lineTo(dw / 2, 0);
  divShape.lineTo(dw / 2, dh - 0.005);
  divShape.quadraticCurveTo(dw / 2, dh, dw / 2 - 0.006, dh);
  divShape.lineTo(-dw / 2 + 0.006, dh);
  divShape.quadraticCurveTo(-dw / 2, dh, -dw / 2, dh - 0.005);
  divShape.closePath();
  const divGeo = new THREE.ExtrudeGeometry(divShape, {
    depth: 0.0032,
    bevelEnabled: true,
    bevelThickness: 0.0006,
    bevelSize: 0.0006,
    bevelSegments: 2,
  });
  divGeo.rotateY(Math.PI / 2);
  divGeo.translate(-0.0016, 0.008, 0);
  const divMesh = new THREE.Mesh(divGeo, innerWoodMat);
  divMesh.position.x = 0.002;
  divMesh.castShadow = true;
  divMesh.receiveShadow = true;
  boxGroup.add(divMesh);

  // --- Matching Overlapping Bentwood Lid ---
  const lidGroup = new THREE.Group();
  lidGroup.name = 'bentoLid';
  const lidRx = rx + 0.0048;
  const lidRz = rz + 0.0048;
  const lidH = 0.0175;

  const lidWallGeo = createBentwoodOvalRing({ rx: lidRx, rz: lidRz, height: lidH, thickness: 0.0038, segments: 48 });
  const lidWall = new THREE.Mesh(lidWallGeo, woodMat);
  lidWall.castShadow = true;
  lidWall.receiveShadow = true;
  lidGroup.add(lidWall);

  const lidTopGeo = createOvalDisk({ rx: lidRx - 0.0012, rz: lidRz - 0.0012, thickness: 0.004, segments: 48, yBottom: lidH - 0.0042 });
  const lidTop = new THREE.Mesh(lidTopGeo, woodMat);
  lidTop.castShadow = true;
  lidTop.receiveShadow = true;
  lidGroup.add(lidTop);

  // Sakura bark stitch on lid rim
  const lidSeam = new THREE.Group();
  lidSeam.position.set(Math.cos(seamAngle) * (lidRx + 0.0004), 0, Math.sin(seamAngle) * (lidRz + 0.0004));
  lidSeam.rotation.y = -seamAngle + Math.PI / 2;
  const lStitch = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.0035, 0.0018), barkMat);
  lStitch.position.set(0, lidH * 0.5, 0.0007);
  lidSeam.add(lStitch);
  lidGroup.add(lidSeam);

  return {
    boxGroup,
    lidGroup,
    dimensions: { rx, rz, wallH, lidH },
  };
}

// Authentic Japanese glazed porcelain shallow plate (ambientCG Porcelain001 CC0!)
export function createPorcelainNoriPlate(porcelainPBR) {
  const pts = [
    new THREE.Vector2(0.0, 0.0035),
    new THREE.Vector2(0.036, 0.0035),
    new THREE.Vector2(0.038, 0.0),      // recessed foot ring (kodai)
    new THREE.Vector2(0.043, 0.0),
    new THREE.Vector2(0.045, 0.0045),
    new THREE.Vector2(0.068, 0.012),
    new THREE.Vector2(0.074, 0.0165),   // gentle curved lip
    new THREE.Vector2(0.0725, 0.0182),
    new THREE.Vector2(0.068, 0.0152),
    new THREE.Vector2(0.046, 0.0072),
    new THREE.Vector2(0.0, 0.0068),
  ];
  const geo = new THREE.LatheGeometry(pts, 40);
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f4f1ea'),
    map: porcelainPBR.map,
    normalMap: porcelainPBR.normalMap,
    normalScale: new THREE.Vector2(0.18, 0.18),
    roughnessMap: porcelainPBR.roughnessMap,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Individual plump short-grain Koshihikari rice grain geometry (mobile-optimized 36 tris smooth-shaded!)
export function createRiceGrainGeometry() {
  const geo = new THREE.SphereGeometry(1, 6, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Plump rounded short-grain Japanese rice (~4.6mm long x 3.0mm wide x 2.7mm thick)
    const pinch = 1.0 - 0.08 * x * x;
    x *= 0.00235;
    y *= 0.00155 * pinch;
    z *= 0.00142 * pinch;
    y += 0.00012 * (1 - (x / 0.00235) * (x / 0.00235));
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createRiceGrainMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f7f3eb'),
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.52,
    clearcoatRoughness: 0.14,
    sheen: 0.28,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#fffaf0'),
  });
}

// Rounded-triangle Onigiri SDF-like radial profile: morphs smoothly from loose round scoop (t=0) -> plump Japanese onigiri (t=1)
function evalOnigiriPoint(ux, uy, uz, shapeT) {
  // Loose rice scoop (t=0): slightly lumpy oblate mound
  const looseR = 0.031;
  const lx = ux * looseR * 1.15;
  const ly = uy * looseR * 0.92;
  const lz = uz * looseR * 1.08;

  // Classic plump rounded-triangle Japanese onigiri (t=1): ~7.0cm wide, ~6.4cm tall, ~3.4cm thick
  // Polar angle in XY plane for rounded equilateral triangle
  const ang = Math.atan2(uy, ux);
  // Shift so apex points UP (+Y, ang = PI/2)
  const triMod = Math.cos(3 * (ang - Math.PI / 2));
  // Smooth rounded triangle radius in XY
  const rXY = 0.0335 * (1.0 + 0.145 * triMod + 0.025 * Math.cos(6 * (ang - Math.PI / 2)));
  // Flatten front & back slightly (palm-pressed pillows!)
  const flatZ = 0.0178 * (1.0 + 0.15 * (1.0 - Math.min(1, ux * ux + uy * uy)));
  const rSphereXY = Math.hypot(ux, uy);
  const scaleXY = rSphereXY > 1e-4 ? rXY : 0;

  let tx = ux * scaleXY * 1.08;
  let ty = uy * scaleXY * 1.04 - 0.003; // settle lower center of gravity
  let tz = uz * flatZ;

  // Softly flatten base slightly so it sits naturally on palm / bento
  if (ty < -0.025) {
    ty = -0.025 + (ty + 0.025) * 0.35;
  }

  // Smooth interpolation
  const s = shapeT * shapeT * (3 - 2 * shapeT);
  return [
    lx + (tx - lx) * s,
    ly + (ty - ly) * s,
    lz + (tz - lz) * s,
  ];
}

// Create a hero morphable Onigiri with sculpted packed-rice core + 560 individual 3D rice grains + wrapping Yakinori!
export function createOnigiri(ricePBR, noriPBR, grainGeo, grainMat, seed = 101) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'onigiri';

  // 1. Core rice mass (prevents seeing gaps between grains, textured with dense packed-grain PBR)
  const coreGeo = new THREE.SphereGeometry(1, 20, 16);
  const baseDirs = new Float32Array(coreGeo.attributes.position.array);
  const coreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#eee7d9'),
    map: ricePBR.map,
    normalMap: ricePBR.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: ricePBR.roughnessMap,
    roughness: 0.45,
    metalness: 0.0,
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  group.add(coreMesh);

  // 2. 540 individual plump 3D Koshihikari rice grains carpeting the surface (1 draw call, coreMesh casts shadow!)
  const grainCount = 540;
  const grains = new THREE.InstancedMesh(grainGeo, grainMat, grainCount);
  grains.castShadow = false;
  grains.receiveShadow = true;

  // Fibonacci sphere distribution for even, organic packing of rice grains across the surface
  const grainSeeds = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < grainCount; i++) {
    const y = 1 - (i / (grainCount - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i + (rand() - 0.5) * 0.25;
    const dir = new THREE.Vector3(
      Math.cos(theta) * rad + (rand() - 0.5) * 0.07,
      y + (rand() - 0.5) * 0.07,
      Math.sin(theta) * rad + (rand() - 0.5) * 0.07
    ).normalize();
    grainSeeds.push({
      dir,
      spin: rand() * Math.PI * 2,
      tilt: (rand() - 0.5) * 0.28,
      scaleX: 0.90 + rand() * 0.24,
      scaleY: 0.92 + rand() * 0.20,
      scaleZ: 0.90 + rand() * 0.22,
      sink: 0.955 + rand() * 0.030,
      tint: 0.96 + rand() * 0.05,
    });
  }

  // Slight per-grain luminance variation so it looks naturally cooked!
  const col = new THREE.Color();
  for (let i = 0; i < grainCount; i++) {
    const t = grainSeeds[i].tint;
    col.setRGB(t, t * 0.994, t * 0.978);
    grains.setColorAt(i, col);
  }
  grains.instanceColor.needsUpdate = true;
  group.add(grains);

  // 3. Roasted Yakinori wrap conforming cleanly OUTSIDE the rice grains (zero pokethrough!)
  const noriW = 0.042; // 4.2cm wide classic roasted seaweed strip
  const noriSegU = 18;
  const noriSegV = 36;
  const noriGeo = new THREE.PlaneGeometry(1, 1, noriSegU, noriSegV);
  const noriMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    map: noriPBR.map,
    normalMap: noriPBR.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: noriPBR.roughnessMap,
    roughness: 0.74,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const noriMesh = new THREE.Mesh(noriGeo, noriMat);
  noriMesh.castShadow = true;
  noriMesh.receiveShadow = true;
  noriMesh.visible = false;
  group.add(noriMesh);

  // Precompute nori UV coordinates
  const nPos = noriGeo.attributes.position;
  const nUV = noriGeo.attributes.uv;
  const noriBaseUV = [];
  for (let i = 0; i < nPos.count; i++) {
    noriBaseUV.push([nUV.getX(i), nUV.getY(i)]);
  }

  const dummy = new THREE.Object3D();
  const upVec = new THREE.Vector3(0, 1, 0);
  const normalVec = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const tan1 = new THREE.Vector3();
  const tan2 = new THREE.Vector3();
  const qAlign = new THREE.Quaternion();
  const qSpin = new THREE.Quaternion();

  let currentShapeT = 1.0;
  let currentWrapT = 0.0;

  function updateRiceGrains() {
    const shapeT = currentShapeT;
    const cPos = coreGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const ux = baseDirs[i * 3];
      const uy = baseDirs[i * 3 + 1];
      const uz = baseDirs[i * 3 + 2];
      const [x, y, z] = evalOnigiriPoint(ux, uy, uz, shapeT);
      // Core sits snugly right behind the plump 3D grains so no dark gaps show
      cPos.setXYZ(i, x * 0.985, y * 0.985, z * 0.975);
    }
    cPos.needsUpdate = true;
    coreGeo.computeVertexNormals();

    for (let i = 0; i < grainCount; i++) {
      const g = grainSeeds[i];
      const d = g.dir;
      const [x, y, z] = evalOnigiriPoint(d.x, d.y, d.z, shapeT);
      const eps = 0.04;
      const ref = Math.abs(d.y) < 0.9 ? upVec : new THREE.Vector3(1, 0, 0);
      tan1.crossVectors(d, ref).normalize();
      tan2.crossVectors(d, tan1).normalize();
      const d1 = d.clone().addScaledVector(tan1, eps).normalize();
      const d2 = d.clone().addScaledVector(tan2, eps).normalize();
      const [x1, y1, z1] = evalOnigiriPoint(d1.x, d1.y, d1.z, shapeT);
      const [x2, y2, z2] = evalOnigiriPoint(d2.x, d2.y, d2.z, shapeT);
      p0.set(x, y, z);
      p1.set(x1, y1, z1).sub(p0);
      p2.set(x2, y2, z2).sub(p0);
      normalVec.crossVectors(p1, p2).normalize();
      if (normalVec.dot(d) < 0) normalVec.negate();

      // Compress rice grains slightly inward right under the wrapped nori band so ZERO grains poke through!
      let sinkMul = g.sink;
      if (currentWrapT > 0.25 && Math.abs(x) < noriW * 0.54 && y < 0.008) {
        sinkMul *= 1.0 - 0.14 * currentWrapT;
      }

      dummy.position.set(x * sinkMul, y * sinkMul, z * sinkMul);
      qAlign.setFromUnitVectors(upVec, normalVec);
      qSpin.setFromAxisAngle(upVec, g.spin);
      dummy.quaternion.copy(qAlign).multiply(qSpin);
      dummy.rotateX(g.tilt);
      dummy.scale.set(g.scaleX, g.scaleY, g.scaleZ);
      dummy.updateMatrix();
      grains.setMatrixAt(i, dummy.matrix);
    }
    grains.instanceMatrix.needsUpdate = true;
  }

  function setShape(t) {
    currentShapeT = THREE.MathUtils.clamp(t, 0, 1);
    updateRiceGrains();
  }

  // Wrap progress: 0 = flat under/behind, 1 = crisply wrapped cleanly OVER the rice grains!
  function setNoriWrap(wrapT) {
    currentWrapT = THREE.MathUtils.clamp(wrapT, 0, 1);
    if (currentWrapT <= 0.001) {
      noriMesh.visible = false;
      updateRiceGrains();
      return;
    }
    noriMesh.visible = true;
    const e = currentWrapT * currentWrapT * (3 - 2 * currentWrapT);

    for (let i = 0; i < nPos.count; i++) {
      const [u, v] = noriBaseUV[i];
      const x = (u - 0.5) * noriW;
      const s = (v - 0.5) * 2.0; // -1 (back) .. 0 (bottom) .. +1 (front)
      const absS = Math.abs(s);

      // Compute exact target wrapped coordinates hugging OUTSIDE the plump onigiri surface
      const flatY = -0.0325;
      const flatZ = s * 0.054;

      let wrapY, wrapZ;
      if (absS < 0.24) {
        // Bottom face curve hugging smoothly beneath base
        const t = s / 0.24; // -1..1
        wrapZ = t * 0.0155;
        wrapY = -0.0312 + (1 - Math.sqrt(Math.max(0.01, 1 - t * t * 0.55))) * 0.006;
      } else {
        // Front & back curved faces ascending cleanly up the pillow of the onigiri
        const hT = (absS - 0.24) / 0.76; // 0 at bottom corner -> 1 at upper nori edge (~y = +0.006)
        wrapY = -0.0285 + hT * 0.0345;
        // Exact Z profile matching onigiri pillow thickness + 3.2mm clearance outside rice grain tips!
        const pillow = Math.cos((wrapY + 0.004) * 22.0);
        const surfZ = 0.0205 * (0.86 + 0.16 * Math.max(0, pillow)) - Math.max(0, wrapY + 0.015) * 0.14;
        wrapZ = Math.sign(s) * (surfZ + 0.0018);
      }

      const y = flatY + (wrapY - flatY) * e;
      const z = flatZ + (wrapZ - flatZ) * e;

      // Subtle crisp roasted seaweed micro-ripple (small enough to stay cleanly outside rice!)
      const crinkle =
        Math.sin(u * 21.0 + v * 15.0) * 0.00042 +
        Math.cos(u * 33.0 - v * 25.0) * 0.00026;
      const edgeCurl = Math.pow(Math.max(0, Math.abs(u - 0.5) * 2), 2.2) * 0.0010 * absS;

      nPos.setXYZ(
        i,
        x * (1.0 - Math.max(0, y + 0.018) * 1.15),
        y + crinkle * 0.3,
        z + Math.sign(s || 1) * (crinkle + edgeCurl)
      );
    }
    nPos.needsUpdate = true;
    noriGeo.computeVertexNormals();
    updateRiceGrains();
  }

  setShape(1.0);
  setNoriWrap(0.0);

  return {
    group,
    coreMesh,
    grains,
    noriMesh,
    setShape,
    setNoriWrap,
  };
}

// Freshly steamed rice mound inside the wooden ohitsu bowl (core + 520 real 3D rice grains!)
export function createBowlRiceMound(ricePBR, grainGeo, grainMat, radius = 0.086, height = 0.036) {
  const rand = mulberry32(8129);
  const group = new THREE.Group();
  group.name = 'bowlRice';

  // Sculpted organic domed rice mound
  const domeGeo = new THREE.SphereGeometry(radius, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.54);
  const pos = domeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const lump =
      Math.sin(x * 58 + 0.4) * Math.cos(z * 54 - 0.3) * 0.0024 +
      Math.sin((x + z) * 90) * 0.0012;
    const ny = (y / radius) * height + lump * (y / radius);
    pos.setXYZ(i, x, ny, z);
  }
  domeGeo.computeVertexNormals();

  const domeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#efe8db'),
    map: ricePBR.map,
    normalMap: ricePBR.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: ricePBR.roughnessMap,
    roughness: 0.44,
    metalness: 0.0,
  });
  const domeMesh = new THREE.Mesh(domeGeo, domeMat);
  domeMesh.castShadow = true;
  domeMesh.receiveShadow = true;
  group.add(domeMesh);

  // 560 plump 3D individual grains crowning the fluffy rice surface (domeMesh casts bowl shadow!)
  const count = 560;
  const grains = new THREE.InstancedMesh(grainGeo, grainMat, count);
  grains.castShadow = false;
  grains.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const rNorm = Math.sqrt((i + 0.5) / count) * 0.96;
    const theta = i * 2.399963 + (rand() - 0.5) * 0.2;
    const x = Math.cos(theta) * rNorm * radius;
    const z = Math.sin(theta) * rNorm * radius;
    const domeY = Math.sqrt(Math.max(0.001, 1 - rNorm * rNorm)) * height;
    const lump =
      Math.sin(x * 58 + 0.4) * Math.cos(z * 54 - 0.3) * 0.0024 +
      Math.sin((x + z) * 90) * 0.0012;
    const y = domeY + lump - 0.0004;

    dummy.position.set(x, y, z);
    dummy.rotation.set(
      (rand() - 0.5) * 0.85,
      rand() * Math.PI * 2,
      (rand() - 0.5) * 0.85
    );
    const s = 0.92 + rand() * 0.24;
    dummy.scale.set(s * (0.96 + rand() * 0.10), s, s);
    dummy.updateMatrix();
    grains.setMatrixAt(i, dummy.matrix);

    const lum = 0.95 + rand() * 0.06;
    col.setRGB(lum, lum * 0.994, lum * 0.978);
    grains.setColorAt(i, col);
  }
  grains.instanceMatrix.needsUpdate = true;
  grains.instanceColor.needsUpdate = true;
  group.add(grains);

  return group;
}

// Flat crisp Yakinori strip resting on porcelain plate (before wrapping)
export function createFlatNoriSheet(noriPBR) {
  const geo = new THREE.PlaneGeometry(0.044, 0.102, 14, 24);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Natural gentle crisp curl at ends & subtle wave
    const curl = Math.pow(Math.abs(z) / 0.051, 2.2) * 0.0032 + Math.pow(Math.abs(x) / 0.022, 2.0) * 0.0012;
    const wave = Math.sin(x * 85 + z * 40) * 0.0005;
    pos.setY(i, curl + wave);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    map: noriPBR.map,
    normalMap: noriPBR.normalMap,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughnessMap: noriPBR.roughnessMap,
    roughness: 0.78,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Sculpted Japanese Rolled Omelette (Tamagoyaki) slice — spiral cut face + seared makisu outer rind!
export function createTamagoyakiSlice(tamagoyakiPBR, seed = 1) {
  const rand = mulberry32(seed * 913);
  const w = 0.044;  // 4.4cm wide
  const h = 0.026;  // 2.6cm tall
  const thick = 0.020; // 2.0cm thick slice

  // Rounded-rectangle squircle cross-section with soft natural handmade sag
  const shape = new THREE.Shape();
  const r = 0.0085;
  const hw = w / 2;
  const hh = h / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.0018,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geo.center();

  // Gentle organic pillow bulge + subtle surface irregularity
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const bulge = 1.0 + 0.04 * (1.0 - (x * x) / (hw * hw + 1e-4)) * (1.0 - (y * y) / (hh * hh + 1e-4));
    const wob = Math.sin(x * 160 + seed * 2) * Math.cos(y * 150) * 0.0005;
    x *= bulge;
    y *= bulge;
    z += Math.sign(z) * (bulge - 1) * 0.008 + wob;
    pos.setXYZ(i, x, y, z);

    // Clean UV mapping: front/back caps map to [0,1] spiral cut face; side perimeter wraps cleanly!
    const nz = Math.abs(nor.getZ(i));
    if (nz > 0.65) {
      uv.setXY(i, x / w + 0.5, y / h + 0.5);
    } else {
      const ang = (Math.atan2(y, x) + Math.PI) / (Math.PI * 2);
      uv.setXY(i, ang * 2.0, z / thick + 0.5);
    }
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();

  const faceMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: tamagoyakiPBR.face.map,
    normalMap: tamagoyakiPBR.face.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: tamagoyakiPBR.face.roughnessMap,
    roughness: 0.44,
    clearcoat: 0.16,
    clearcoatRoughness: 0.35,
  });

  const outerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: tamagoyakiPBR.outer.map,
    normalMap: tamagoyakiPBR.outer.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: tamagoyakiPBR.outer.roughnessMap,
    roughness: 0.38,
    clearcoat: 0.25,
    clearcoatRoughness: 0.28,
  });

  // ExtrudeGeometry uses material index 0 for front/back caps, 1 for side walls!
  const mesh = new THREE.Mesh(geo, [faceMat, outerMat]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Slightly tilt orientation naturally
  mesh.rotation.y = (rand() - 0.5) * 0.12;
  return mesh;
}

// Photorealistic Cherry Tomato with organic asymmetry, waxy skin clearcoat & 3D 5-sepal star calyx (heta)!
export function createCherryTomato(tomatoPBR, seed = 1) {
  const rand = mulberry32(seed * 419);
  const group = new THREE.Group();
  group.name = 'cherryTomato';

  const rad = 0.0128 + (rand() - 0.5) * 0.0012; // ~2.55cm realistic mini-tomato
  const bodyGeo = new THREE.SphereGeometry(rad, 20, 14);
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const ny = y / rad;
    const ang = Math.atan2(z, x);
    // Natural subtle 5-shoulder tomato contour + tiny stem dimple at top
    const lobe = 1.0 + 0.022 * Math.sin(ang * 5 + seed) * (1 - ny * ny);
    const oblate = 0.93;
    let dimple = 0;
    if (ny > 0.72) {
      const t = (ny - 0.72) / 0.28;
      dimple = -t * t * rad * 0.14;
    }
    // Slight organic asymmetry
    const asym = 1.0 + 0.03 * Math.cos(ang + seed * 1.7);
    pos.setXYZ(i, x * lobe * asym, y * oblate + dimple, z * lobe * asym);
  }
  bodyGeo.computeVertexNormals();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: tomatoPBR.map,
    normalMap: tomatoPBR.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: tomatoPBR.roughnessMap,
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.88,
    clearcoatRoughness: 0.11,
    reflectivity: 0.65,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Authentic 5-pointed green star calyx (heta) + curved cut stem (merged cleanly into 1 mesh = 1 draw call!)
  const calyxMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2d611b'),
    roughness: 0.62,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const calyxParts = [];
  const crownGeo = new THREE.CylinderGeometry(0.0018, 0.0026, 0.0018, 8);
  crownGeo.translate(0, rad * 0.83, 0);
  calyxParts.push(crownGeo);

  const sepalCount = 5;
  for (let s = 0; s < sepalCount; s++) {
    const a = (s / sepalCount) * Math.PI * 2 + (rand() - 0.5) * 0.22;
    const len = 0.0078 + rand() * 0.0028;
    const sepGeo = new THREE.PlaneGeometry(0.0028, len, 2, 5);
    const sp = sepGeo.attributes.position;
    for (let j = 0; j < sp.count; j++) {
      const sx = sp.getX(j);
      const sy = Math.max(0, sp.getY(j) + len / 2);
      const t = THREE.MathUtils.clamp(sy / len, 0, 1);
      const widthScale = Math.sin(Math.pow(t, 0.65) * Math.PI) * 1.15;
      const curveY = -Math.sin(t * Math.PI * 0.72) * 0.0024 + t * t * t * 0.0019;
      sp.setXYZ(j, sx * widthScale, curveY, sy);
    }
    sepGeo.rotateY(a);
    sepGeo.translate(0, rad * 0.83, 0);
    sepGeo.computeVertexNormals();
    calyxParts.push(sepGeo);
  }

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, rad * 0.83 + 0.0005, 0),
    new THREE.Vector3(0.0006, rad * 0.83 + 0.0035, 0.0004),
    new THREE.Vector3(0.0018, rad * 0.83 + 0.0062, -0.0006),
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 6, 0.00075, 6, false);
  calyxParts.push(stemGeo);

  const mergedCalyx = mergeGeometries(calyxParts, false);
  const calyxMesh = new THREE.Mesh(mergedCalyx, calyxMat);
  calyxMesh.castShadow = true;
  group.add(calyxMesh);

  return group;
}

// Crisp ruffled green lettuce / shiso divider leaf inside the bento box
export function createCrispLettuceLeaf(leafPBR) {
  const segX = 14;
  const segY = 16;
  const geo = new THREE.PlaneGeometry(0.078, 0.088, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i); // 0..1 across width
    const v = uv.getY(i); // 0 at stem base -> 1 at ruffled leaf top
    const nx = (u - 0.5) * 2; // -1..1

    // Leaf silhouette: narrow stem at bottom, broad heart/fan at top
    const silhouette = Math.sin(Math.pow(v, 0.68) * Math.PI) * 0.95 + 0.14 * v;
    const x = nx * 0.042 * silhouette;
    const y = (v - 0.5) * 0.084;

    // Cupped curvature + crisp organic ruffled frills along upper leaf edge!
    const edgeFactor = Math.pow(Math.abs(nx), 1.5) * Math.pow(v, 0.7);
    const ruffle =
      Math.sin(nx * 14.0 + v * 9.0) * 0.0042 * edgeFactor +
      Math.cos(nx * 24.0 - v * 16.0) * 0.0022 * edgeFactor;
    const cup = (nx * nx) * 0.0085 - Math.sin(v * Math.PI) * 0.004;
    const z = cup + ruffle;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    map: leafPBR.map,
    normalMap: leafPBR.normalMap,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughness: 0.46,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.35,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Cotton Gingham Bento Handkerchief (Furoshiki) with organic flat drape + animated 4-corner wrapping & bunny-ear knot!
export function createFuroshikiCloth(ginghamPBR) {
  const group = new THREE.Group();
  group.name = 'furoshikiCloth';

  // Warm soft cotton handkerchief using real Poly Haven gingham_check PBR!
  const clothMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f7ece2'), // softly warms the gingham weave for cozy Japanese lunch cloth
    map: ginghamPBR.map,
    normalMap: ginghamPBR.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: ginghamPBR.roughnessMap,
    aoMap: ginghamPBR.aoMap,
    aoMapIntensity: 0.45,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color('#fff5ec'),
    side: THREE.DoubleSide,
  });

  // High-subdivision square cloth rotated diagonally (45 deg) like real Japanese furoshiki wrapping!
  const size = 0.35; // 35cm square lunch cloth
  const seg = 28;
  const clothGeo = new THREE.PlaneGeometry(size, size, seg, seg);
  clothGeo.rotateX(-Math.PI / 2);
  clothGeo.rotateY(Math.PI / 4); // diamond orientation: corners point N, S, E, W!

  const pos = clothGeo.attributes.position;
  const restPos = new Float32Array(pos.array);

  const clothMesh = new THREE.Mesh(clothGeo, clothMat);
  clothMesh.castShadow = false;
  clothMesh.receiveShadow = true;
  group.add(clothMesh);

  // Sculpted knotted furoshiki bow ("bunny ears" musubime) that blooms smoothly as the final two corners tie!
  const knotGroup = new THREE.Group();
  knotGroup.position.set(0, 0.072, 0);
  knotGroup.scale.setScalar(0.001);
  knotGroup.visible = false;

  // Center twisted fabric knot core (wider soft pleated cotton cinch)
  const coreGeo = new THREE.SphereGeometry(0.016, 14, 10);
  coreGeo.scale(1.35, 0.72, 1.15);
  const knotCore = new THREE.Mesh(coreGeo, clothMat);
  knotCore.castShadow = true;
  knotCore.receiveShadow = true;
  knotGroup.add(knotCore);

  // Two soft organic fabric bunny-ear tails drooping gently on top of the wrapped bento
  for (const side of [-1, 1]) {
    const earGeo = new THREE.PlaneGeometry(0.042, 0.076, 10, 14);
    const ep = earGeo.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      const ex = ep.getX(i);
      const ey = Math.max(0, ep.getY(i) + 0.038);
      const t = THREE.MathUtils.clamp(ey / 0.076, 0, 1);
      const wScale = Math.sin(Math.pow(t, 0.65) * Math.PI) * 1.18 + 0.20 * (1 - t);
      const archY = Math.sin(t * Math.PI * 0.78) * 0.022 - t * t * 0.008;
      const archX = side * (t * 0.064);
      const foldZ = Math.abs(ex) * 0.42 * (1 - t * 0.4) + Math.sin(t * 9 + side) * 0.0022;
      ep.setXYZ(i, archX + ex * 0.25 * wScale, archY + Math.abs(ex) * 0.16, ex * wScale + foldZ);
    }
    earGeo.computeVertexNormals();
    const ear = new THREE.Mesh(earGeo, clothMat);
    ear.rotation.y = side * 0.22;
    ear.castShadow = true;
    ear.receiveShadow = true;
    knotGroup.add(ear);
  }
  group.add(knotGroup);

  // Smooth oval wrapped furoshiki parcel mesh (fades/morphs smoothly around closed oval bentwood bento with ZERO sawtooth edges or pokethrough!)
  const wrapGeo = new THREE.SphereGeometry(1, 36, 22);
  const wp = wrapGeo.attributes.position;
  const wuv = wrapGeo.attributes.uv;
  for (let i = 0; i < wp.count; i++) {
    const ux = wp.getX(i);
    const uy = wp.getY(i);
    const uz = wp.getZ(i);
    // Pillowed oval bento parcel matching bentwood dimensions + 8mm soft cotton thickness!
    const sqY = Math.sign(uy) * Math.pow(Math.abs(uy), 0.56);
    const rx = 0.106;
    const rz = 0.074;
    const ry = 0.036;
    let x = ux * rx * (1 + 0.06 * (1 - uy * uy));
    let y = (sqY * 0.5 + 0.5) * (ry * 2.0) + 0.002;
    let z = uz * rz * (1 + 0.06 * (1 - uy * uy));
    // Soft diagonal cotton pleat folds gathering cleanly toward top knot!
    const ang = Math.atan2(uz, ux);
    const pleat = Math.sin(ang * 4.0) * 0.0032 * Math.max(0, uy) + Math.cos(ang * 8.0) * 0.0014 * Math.max(0, uy);
    y += pleat;
    x *= 1 + pleat * 3.5;
    z *= 1 + pleat * 3.5;
    wp.setXYZ(i, x, y, z);
    wuv.setXY(i, (ux * 0.5 + 0.5) * 1.4, (uz * 0.5 + 0.5) * 1.4);
  }
  wrapGeo.computeVertexNormals();
  const wrappedParcel = new THREE.Mesh(wrapGeo, clothMat);
  wrappedParcel.castShadow = true;
  wrappedParcel.receiveShadow = true;
  wrappedParcel.visible = false;
  group.add(wrappedParcel);

  // Organic cloth folding function:
  // stage 0 = laid flat with soft organic ripples
  // backT / frontT / sideT sweep corners smoothly up & over closed oval lid (bh=0.070 clearance!),
  // and as sideT + knotT reach 1, smoothly transitions to the seamless pillowed oval wrapped parcel + bunny-ear knot!
  function setFoldState(backT, frontT, sideT, knotT) {
    const bx = 0.104;
    const bz = 0.070;
    const bh = 0.071; // safely clears closed oval lid top (0.066) with zero pokethrough!

    const fullyWrapped = sideT > 0.72 && knotT > 0.35;
    wrappedParcel.visible = sideT > 0.35;
    if (wrappedParcel.visible) {
      const ws = smoothstepLocal((sideT - 0.35) / 0.65);
      wrappedParcel.scale.set(0.96 + 0.04 * ws, 0.25 + 0.75 * ws, 0.96 + 0.04 * ws);
    }
    clothMesh.visible = !fullyWrapped;

    if (clothMesh.visible) {
      for (let i = 0; i < pos.count; i++) {
        const rx = restPos[i * 3];
        const rz = restPos[i * 3 + 2];

        let x = rx;
        let y = 0.0034 + Math.sin(rx * 28 + rz * 22) * 0.0009 + Math.cos(rx * 41 - rz * 35) * 0.0005;
        let z = rz;

        // Smooth elliptical boundary factor so folds hug the oval bento without harsh straight sawtooth kinks!
        const ellipR = Math.hypot(rx / bx, rz / bz);

        if (rz < -bz * 0.65 && ellipR > 0.92 && backT > 0.001) {
          const d = Math.max(0, -(rz + bz * 0.65));
          const s = backT * backT * (3 - 2 * backT);
          const wallPart = Math.min(d, bh);
          const topPart = Math.max(0, d - bh);
          const targetY = Math.min(bh + 0.002, wallPart) + (topPart > 0 ? 0.002 : 0);
          const targetZ = -bz + topPart * 0.82;
          const targetX = rx * (1 - 0.32 * Math.min(1, d / 0.15));
          const arcLift = Math.sin(s * Math.PI) * Math.min(0.065, d * 0.6);
          x = x + (targetX - x) * s;
          y = y + (targetY - y) * s + arcLift;
          z = z + (targetZ - z) * s;
        }

        if (rz > bz * 0.65 && ellipR > 0.92 && frontT > 0.001) {
          const d = Math.max(0, rz - bz * 0.65);
          const s = frontT * frontT * (3 - 2 * frontT);
          const wallPart = Math.min(d, bh);
          const topPart = Math.max(0, d - bh);
          const targetY = Math.min(bh + 0.005, wallPart) + (topPart > 0 ? 0.004 : 0);
          const targetZ = bz - topPart * 0.82;
          const targetX = rx * (1 - 0.32 * Math.min(1, d / 0.15));
          const arcLift = Math.sin(s * Math.PI) * Math.min(0.065, d * 0.6);
          x = x + (targetX - x) * s;
          y = y + (targetY - y) * s + arcLift;
          z = z + (targetZ - z) * s;
        }

        if (Math.abs(rx) > bx * 0.72 && ellipR > 0.92 && sideT > 0.001) {
          const sign = Math.sign(rx);
          const d = Math.max(0, Math.abs(rx) - bx * 0.72);
          const s = sideT * sideT * (3 - 2 * sideT);
          const wallPart = Math.min(d, bh);
          const topPart = Math.max(0, d - bh);
          const targetX = sign * Math.max(0.004, bx - topPart * 0.92);
          const targetY = Math.min(bh + 0.007, wallPart) + (topPart > 0 ? 0.006 : 0);
          const targetZ = z * (1 - 0.75 * Math.min(1, d / 0.14));
          const arcLift = Math.sin(s * Math.PI) * Math.min(0.055, d * 0.55);
          x = x + (targetX - x) * s;
          y = y + (targetY - y) * s + arcLift;
          z = z + (targetZ - z) * s;
        }

        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      clothGeo.computeVertexNormals();
    }

    if (knotT > 0.01) {
      knotGroup.visible = true;
      const ks = knotT * knotT * (3 - 2 * knotT);
      knotGroup.scale.setScalar(0.05 + 0.95 * ks);
      knotGroup.position.y = 0.072 + 0.004 * ks;
    } else {
      knotGroup.visible = false;
    }
  }

  function smoothstepLocal(v) {
    const c = THREE.MathUtils.clamp(v, 0, 1);
    return c * c * (3 - 2 * c);
  }

  setFoldState(0, 0, 0, 0);

  return {
    group,
    clothMesh,
    knotGroup,
    setFoldState,
  };
}

// Subtle sunlit rising steam wisps above freshly steamed hot rice
export function createSteamSystem(steamTex, count = 12, radius = 0.05) {
  const group = new THREE.Group();
  const particles = [];
  const rand = mulberry32(2026);

  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      color: new THREE.Color('#fffaf2'),
    });
    const sp = new THREE.Sprite(mat);
    const phase = rand();
    const ox = (rand() - 0.5) * radius * 1.4;
    const oz = (rand() - 0.5) * radius * 1.4;
    const speed = 0.14 + rand() * 0.09;
    const baseScale = 0.045 + rand() * 0.035;
    sp.position.set(ox, phase * 0.11, oz);
    sp.scale.setScalar(baseScale);
    group.add(sp);
    particles.push({ sp, mat, phase, ox, oz, speed, baseScale, drift: (rand() - 0.5) * 0.02 });
  }

  let intensity = 1.0;

  return {
    group,
    setIntensity(v) {
      intensity = v;
    },
    update(dt, elapsed) {
      for (const p of particles) {
        p.phase = (p.phase + dt * p.speed) % 1.0;
        const t = p.phase;
        p.sp.position.x = p.ox + Math.sin(elapsed * 1.2 + p.phase * 6.0) * 0.009 + p.drift * t;
        p.sp.position.y = 0.01 + t * 0.13;
        p.sp.position.z = p.oz + Math.cos(elapsed * 0.9 + p.phase * 5.0) * 0.007;
        const sc = p.baseScale * (0.65 + t * 1.45);
        p.sp.scale.set(sc, sc * 1.15, 1);
        // Very delicate, realistic morning sunlit steam — NEVER cartoonish fog!
        const fade = Math.sin(t * Math.PI);
        p.mat.opacity = fade * fade * 0.22 * intensity;
      }
    },
  };
}
