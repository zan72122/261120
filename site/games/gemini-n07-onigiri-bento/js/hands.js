import * as THREE from 'three';

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Smooth organic anatomical phalanx with gentle joint tapers, plump fingertip pad & warm rosy vertex tint
function createPhalanxGeo(len, rBase, rTip, isTip = false, segU = 12, segV = 8) {
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const y = v * len;

    let r = rBase + (rTip - rBase) * v;
    if (isTip && v > 0.68) {
      const tt = (v - 0.68) / 0.32;
      r *= Math.max(0.12, Math.sqrt(Math.max(0.0, 1 - tt * tt * 0.96)));
    } else if (!isTip) {
      r *= 1.0 + 0.03 * Math.cos(v * Math.PI * 2);
    }

    // Subtle rosy fingertip blush & gentle warm knuckle occlusion
    const blush = isTip ? smoothstep(0.35, 1.0, v) : 0;
    const jointAO = 1.0 - 0.06 * Math.pow(1 - Math.abs(v * 2 - 1), 3);
    const cr = (1.0 + blush * 0.03) * jointAO;
    const cg = (1.0 - blush * 0.075) * jointAO;
    const cb = (1.0 - blush * 0.085) * jointAO;

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const a = u * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rx = r * 1.03;
      const rz = r * (sa > 0 ? 0.96 : 0.88);
      const pad = isTip && sa > 0 ? Math.sin(v * Math.PI) * r * 0.14 * sa : 0;
      positions.push(ca * rx, y, sa * rz + pad);
      // Palmar side slightly warmer/rosier
      const palmTint = sa > 0 ? 0.025 * sa : 0;
      colors.push(cr, cg - palmTint, cb - palmTint * 1.1);
      uvs.push(u, v);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = (iv + 1) * (segU + 1) + iu + 1;
      const d = (iv + 1) * (segU + 1) + iu;
      indices.push(a, d, c, a, c, b);
    }
  }

  // Smooth rounded joint bulb at base so curling joints stay completely seamless
  const baseCapStart = positions.length / 3;
  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    const a = u * Math.PI * 2;
    positions.push(Math.cos(a) * rBase * 0.82, -rBase * 0.38, Math.sin(a) * rBase * 0.78);
    colors.push(0.95, 0.92, 0.90);
    uvs.push(u, 0);
  }
  const baseCenterIdx = positions.length / 3;
  positions.push(0, -rBase * 0.62, 0);
  colors.push(0.92, 0.89, 0.87);
  uvs.push(0.5, 0);
  for (let iu = 0; iu < segU; iu++) {
    indices.push(iu, baseCapStart + iu + 1, baseCapStart + iu);
    indices.push(iu, iu + 1, baseCapStart + iu + 1);
    indices.push(baseCapStart + iu, baseCapStart + iu + 1, baseCenterIdx);
  }

  // Smooth rounded tip dome cap (avoids degenerate zero-normal dark pinhole at fingertip pole!)
  if (isTip) {
    const tipRingStart = segV * (segU + 1);
    const tipCenterIdx = positions.length / 3;
    positions.push(0, len + rTip * 0.14, 0);
    colors.push(0.99, 0.90, 0.89);
    uvs.push(0.5, 1);
    for (let iu = 0; iu < segU; iu++) {
      indices.push(tipRingStart + iu, tipCenterIdx, tipRingStart + iu + 1);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Curved natural human fingernail nestled smoothly onto dorsal fingertip
function createFingernailMesh(width, length, nailMat) {
  const geo = new THREE.PlaneGeometry(width, length, 8, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / (width * 0.5);
    const ny = y / (length * 0.5);
    const roundTop = ny > 0
      ? Math.sqrt(Math.max(0.08, 1 - ny * ny * 0.58))
      : Math.sqrt(Math.max(0.32, 1 - ny * ny * 0.32));
    const rx = x * roundTop;
    const archZ = -(nx * nx) * width * 0.24 - (ny > 0.45 ? (ny - 0.45) * width * 0.06 : 0);
    pos.setXYZ(i, rx, y, archZ);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, nailMat);
}

// Smooth C2-continuous organic palm & slender tapered wrist with biological skin shading & sleeve-cuff AO
function createAnatomicalPalmGeo(palmW, palmL, palmThick, wristW, forearmLen) {
  const segU = 28;
  const segV = 24;
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0 = inside sleeve, 0.38 = wrist, 1.0 = knuckle crest
    const y = -forearmLen + v * (forearmLen + palmL);

    const wristToPalm = smoothstep(0.32, 0.78, v);
    const knuckleTaper = smoothstep(0.84, 1.0, v);
    const forearmTaper = smoothstep(0.0, 0.38, v);

    let hw = wristW * (0.56 - 0.05 * forearmTaper) + (palmW * 0.5 - wristW * 0.51) * wristToPalm;
    let ht = palmThick * (1.06 - 0.14 * forearmTaper + 0.10 * Math.sin(wristToPalm * Math.PI));

    hw *= 1.0 - knuckleTaper * 0.14;
    ht *= Math.sqrt(Math.max(0.14, 1 - knuckleTaper * knuckleTaper * 0.72));

    // Soft ambient occlusion shadow on wrist right where it emerges from knitted sleeve cuff!
    const sleeveAO = 0.84 + 0.16 * smoothstep(0.32, 0.56, v);

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const a = u * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      const sqX = Math.sign(ca) * Math.pow(Math.abs(ca), 0.91);
      const sqZ = Math.sign(sa) * Math.pow(Math.abs(sa), 0.92);

      let x = sqX * hw;
      let z = sqZ * ht;
      let py = y;

      let cr = sleeveAO;
      let cg = sleeveAO;
      let cb = sleeveAO;

      const tPalm = THREE.MathUtils.clamp((v - 0.36) / 0.64, 0, 1);
      if (tPalm > 0) {
        const archMask = smoothstep(0.55, 1.0, tPalm);
        py += Math.cos((ca + 0.18) * 1.45) * palmL * 0.085 * archMask;

        const dxT = ca - 0.62;
        const dyT = tPalm - 0.30;
        const thenar = Math.exp(-(dxT * dxT * 3.2 + dyT * dyT * 6.5)) * palmThick * 0.55;

        if (sa > 0) {
          const dxH = ca + 0.65;
          const dyH = tPalm - 0.42;
          const hypo = Math.exp(-(dxH * dxH * 4.2 + dyH * dyH * 5.2)) * palmThick * 0.22 * sa;
          const hollowVal = Math.exp(-(ca * ca * 4.8 + (tPalm - 0.58) * (tPalm - 0.58) * 7.0));
          const hollow = hollowVal * palmThick * 0.22 * sa;
          z += thenar * sa + hypo - hollow;
          // Subtle warm rosy shading inside palm crease & center hollow
          cr *= 1.0 - hollowVal * 0.05 * sa;
          cg *= 1.0 - (0.04 + hollowVal * 0.09) * sa;
          cb *= 1.0 - (0.05 + hollowVal * 0.10) * sa;
        } else {
          const dorsalRound = Math.sin(tPalm * Math.PI) * palmThick * 0.14 * (-sa);
          z -= dorsalRound;
          // Faint rosy knuckle ridge blush
          const knBlush = smoothstep(0.75, 1.0, tPalm) * (-sa);
          cg *= 1.0 - knBlush * 0.04;
          cb *= 1.0 - knBlush * 0.05;
        }
        if (ca > 0.3) {
          x += thenar * 0.55 * ca;
        }
      }

      positions.push(x, py, z);
      colors.push(cr, cg, cb);
      uvs.push(u * 1.3, v * 1.7);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = (iv + 1) * (segU + 1) + iu + 1;
      const d = (iv + 1) * (segU + 1) + iu;
      indices.push(a, d, c, a, c, b);
    }
  }

  const topRing = segV * (segU + 1);
  const topCenter = positions.length / 3;
  positions.push(0, palmL + 0.001, 0);
  colors.push(0.95, 0.90, 0.88);
  uvs.push(0.5, 1.0);
  for (let iu = 0; iu < segU; iu++) {
    indices.push(topRing + iu, topCenter, topRing + iu + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Organic tapered soft fabric sleeve with rounded inward-tucked knitted cuff thickness!
function createSoftSleeveGeo(rWrist, rArm, length) {
  const segU = 24;
  const segV = 16;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV; // 0..0.85 = outer sleeve, 0.85..1.0 = rolled thick knitted cuff curving inward onto wrist!
    let y, r;
    if (v <= 0.85) {
      const t = v / 0.85;
      y = -length + t * length;
      const cuffSwell = smoothstep(0.75, 1.0, t) * 0.0022;
      r = rArm + (rWrist - rArm) * smoothstep(0, 0.95, t) + cuffSwell;
    } else {
      // Smooth 180-degree rounded knitted cuff lip tucking 6mm back inside around wrist
      const t = (v - 0.85) / 0.15; // 0..1
      const ang = t * Math.PI;
      y = Math.sin(ang) * 0.0028 - Math.max(0, t - 0.5) * 0.008;
      r = rWrist + 0.0022 - (1 - Math.cos(ang)) * 0.0038;
    }

    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const a = u * Math.PI * 2;
      const fold = Math.sin(a * 5 + v * 3.5) * 0.0009 * (1 - v * 0.5);
      const rx = (r + fold) * 1.02;
      const rz = (r + fold) * 0.80;
      positions.push(Math.cos(a) * rx, y, Math.sin(a) * rz);
      uvs.push(u * 2.0, v * 1.6);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + 1;
      const c = (iv + 1) * (segU + 1) + iu + 1;
      const d = (iv + 1) * (segU + 1) + iu;
      indices.push(a, d, c, a, c, b);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createHumanHand({
  side = 'right',
  isChild = true,
  skinPBR,
  sleeveColor = '#dfbeb2',
  sleevePBR = null,
}) {
  const mirror = side === 'left' ? -1 : 1;
  // Slightly softer, realistic delicate proportions for a 5-year-old child (~11.5cm hand)
  const scale = isChild ? 0.64 : 1.0;

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(isChild ? '#f2d0ba' : '#e6c2aa'),
    vertexColors: true,
    map: skinPBR.map,
    normalMap: skinPBR.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: skinPBR.roughnessMap,
    roughness: isChild ? 0.74 : 0.78,
    metalness: 0.0,
    sheen: 0.36,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color('#f4a890'),
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f2d6cb'),
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.42,
    clearcoatRoughness: 0.22,
  });

  const sleeveMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sleeveColor),
    map: sleevePBR ? sleevePBR.map : null,
    normalMap: sleevePBR ? sleevePBR.normalMap : null,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.92,
    metalness: 0.0,
    sheen: 0.45,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color('#fff5f0'),
    side: THREE.DoubleSide,
  });

  const root = new THREE.Group();
  root.name = `${isChild ? 'child' : 'papa'}_hand_${side}`;

  const rig = new THREE.Group();
  rig.scale.set(mirror * scale, scale, scale);
  root.add(rig);

  // Slimmer, organically contoured child palm & wrist
  const palmW = 0.074;
  const palmL = 0.082;
  const palmThick = isChild ? 0.0145 : 0.014;
  const wristW = 0.048;
  const forearmLen = 0.135;

  const palmGeo = createAnatomicalPalmGeo(palmW, palmL, palmThick, wristW, forearmLen);
  const palmMesh = new THREE.Mesh(palmGeo, skinMat);
  palmMesh.castShadow = true;
  palmMesh.receiveShadow = true;
  rig.add(palmMesh);

  // Soft natural knitted cardigan / shirt sleeve
  const sleeveGeo = createSoftSleeveGeo(wristW * 0.64, wristW * 0.82, 0.145);
  const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMat);
  sleeveMesh.position.set(0, -0.022, 0);
  sleeveMesh.castShadow = true;
  sleeveMesh.receiveShadow = true;
  rig.add(sleeveMesh);

  // 4 Articulated Organic Fingers (index, middle, ring, pinky)
  const fingerSpecs = [
    { name: 'index',  x:  0.0255, y: palmL - 0.004, z:  0.001, r: 0.0084, lens: [0.031, 0.020, 0.017], spread:  0.06 },
    { name: 'middle', x:  0.0084, y: palmL + 0.000, z:  0.000, r: 0.0088, lens: [0.035, 0.022, 0.018], spread:  0.01 },
    { name: 'ring',   x: -0.0092, y: palmL - 0.003, z:  0.001, r: 0.0083, lens: [0.032, 0.020, 0.017], spread: -0.04 },
    { name: 'pinky',  x: -0.0250, y: palmL - 0.009, z:  0.002, r: 0.0072, lens: [0.025, 0.016, 0.015], spread: -0.09 },
  ];

  const fingers = [];
  for (const spec of fingerSpecs) {
    const fBase = new THREE.Group();
    fBase.position.set(spec.x, spec.y, spec.z);
    fBase.rotation.z = -spec.spread;
    rig.add(fBase);

    const joints = [];
    let parent = fBase;
    let rCur = spec.r * (isChild ? 1.06 : 1.0);
    for (let j = 0; j < 3; j++) {
      const len = spec.lens[j];
      const rNext = rCur * (j === 2 ? 0.80 : 0.88);
      const jGroup = new THREE.Group();
      if (j > 0) jGroup.position.y = spec.lens[j - 1] * 0.94;
      parent.add(jGroup);

      const segMesh = new THREE.Mesh(createPhalanxGeo(len, rCur, rNext, j === 2), skinMat);
      segMesh.castShadow = true;
      segMesh.receiveShadow = true;
      jGroup.add(segMesh);

      if (j === 2) {
        const nail = createFingernailMesh(rNext * 1.35, len * 0.58, nailMat);
        nail.position.set(0, len * 0.56, -rNext * 0.86);
        nail.rotation.y = Math.PI;
        jGroup.add(nail);
      }

      joints.push(jGroup);
      parent = jGroup;
      rCur = rNext;
    }
    fingers.push({ name: spec.name, base: fBase, joints, defaultSpread: spec.spread });
  }

  // Seamless Opposable Thumb nested deeper into the thenar eminence!
  const thumbBase = new THREE.Group();
  thumbBase.position.set(0.022, 0.024, 0.005);
  rig.add(thumbBase);

  const metaMesh = new THREE.Mesh(createPhalanxGeo(0.027, 0.0135, 0.0102, false), skinMat);
  metaMesh.castShadow = true;
  metaMesh.receiveShadow = true;
  thumbBase.add(metaMesh);

  const thumbJoints = [];
  const tLens = [0.024, 0.021];
  let tParent = thumbBase;
  let tRad = 0.0104 * (isChild ? 1.05 : 1.0);
  for (let j = 0; j < 2; j++) {
    const len = tLens[j];
    const rNext = tRad * (j === 1 ? 0.82 : 0.89);
    const jGroup = new THREE.Group();
    jGroup.position.y = j === 0 ? 0.024 : tLens[0] * 0.92;
    tParent.add(jGroup);

    const mesh = new THREE.Mesh(createPhalanxGeo(len, tRad, rNext, j === 1), skinMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    jGroup.add(mesh);

    if (j === 1) {
      const nail = createFingernailMesh(rNext * 1.36, len * 0.56, nailMat);
      nail.position.set(0, len * 0.56, -rNext * 0.88);
      nail.rotation.y = Math.PI;
      jGroup.add(nail);
    }

    thumbJoints.push(jGroup);
    tParent = jGroup;
    tRad = rNext;
  }

  function setPose({ curl = 0.25, thumbCurl = 0.22, spread = 0.0, pinch = 0.0, cup = 0.0 } = {}) {
    fingers.forEach((f, idx) => {
      const naturalBias = idx * 0.055;
      const c = THREE.MathUtils.clamp(curl + naturalBias + cup * 0.22, -0.08, 1.35);
      const isPinchFinger = idx === 0;
      const pExtra = isPinchFinger ? pinch * 0.55 : pinch * 0.2;

      f.base.rotation.z = -(f.defaultSpread + (1.5 - idx) * 0.045 * spread - cup * 0.035 * (1.5 - idx));
      f.joints[0].rotation.x = c * 0.58 + pExtra * 0.52;
      f.joints[1].rotation.x = c * 0.68 + pExtra * 0.62;
      f.joints[2].rotation.x = c * 0.42 + pExtra * 0.34;
    });

    // Natural tucked diagonal opposable thumb (never sticking straight out like a stub!)
    thumbBase.rotation.set(
      0.22 + thumbCurl * 0.24 + pinch * 0.30 + cup * 0.16,
      -0.44 - thumbCurl * 0.22 - pinch * 0.32,
      -0.42 + thumbCurl * 0.18 + pinch * 0.24 + cup * 0.12
    );
    thumbJoints[0].rotation.x = 0.14 + thumbCurl * 0.28 + pinch * 0.22;
    thumbJoints[1].rotation.x = 0.10 + thumbCurl * 0.36 + pinch * 0.26;
  }

  setPose({ curl: 0.26, thumbCurl: 0.22 });

  return {
    root,
    rig,
    setPose,
  };
}
