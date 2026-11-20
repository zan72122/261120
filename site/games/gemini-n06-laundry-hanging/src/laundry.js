import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadPolyHavenPBRAsync, loadMetal032PBRAsync } from './textures.js';

let sharedAssets = null;

export async function preloadLaundryAssets() {
  if (sharedAssets) return sharedAssets;
  const [terry, jersey, waffle, oak, steel] = await Promise.all([
    loadPolyHavenPBRAsync('terry_cloth', {
      repeat: [3.2, 4.4],
      anisotropy: 8,
      diffuseFile: 'diffuse_neutral.jpg',
    }),
    loadPolyHavenPBRAsync('cotton_jersey', {
      repeat: [3.4, 3.4],
      anisotropy: 8,
      diffuseFile: 'diffuse_neutral.jpg',
    }),
    loadPolyHavenPBRAsync('waffle_pique_cotton', {
      repeat: [2.6, 4.0],
      anisotropy: 8,
      diffuseFile: 'diffuse_neutral.jpg',
    }),
    loadPolyHavenPBRAsync('oak_veneer_01', { repeat: [1.4, 1.4], anisotropy: 4 }),
    loadMetal032PBRAsync({ repeat: [1, 1], anisotropy: 4 }),
  ]);
  sharedAssets = { terry, jersey, waffle, oak, steel };
  return sharedAssets;
}

function getAssets() {
  if (!sharedAssets) throw new Error('Call preloadLaundryAssets() before creating laundry.');
  return sharedAssets;
}

let cachedPinGeos = null;
function getClothespinGeos() {
  if (cachedPinGeos) return cachedPinGeos;

  const jawShape = new THREE.Shape();
  jawShape.moveTo(0.0012, 0.045);
  jawShape.lineTo(0.0088, 0.044);
  jawShape.lineTo(0.0098, 0.014);
  jawShape.lineTo(0.0084, 0.003);
  jawShape.lineTo(0.0088, -0.014);
  jawShape.lineTo(0.0058, -0.043);
  jawShape.lineTo(0.0006, -0.044);
  jawShape.lineTo(0.0006, -0.028);
  jawShape.absarc(0.0006, -0.016, 0.0055, -Math.PI * 0.48, Math.PI * 0.48, false);
  jawShape.lineTo(0.0020, -0.004);
  jawShape.lineTo(0.0040, 0.000);
  jawShape.lineTo(0.0022, 0.005);
  jawShape.lineTo(0.0012, 0.045);

  const halfGeo = new THREE.ExtrudeGeometry(jawShape, {
    depth: 0.0128,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0012,
    bevelSegments: 2,
    curveSegments: 10,
  });
  halfGeo.translate(0, 0, -0.0064);
  halfGeo.setAttribute('uv2', halfGeo.attributes.uv);

  const coilPts = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const ang = t * Math.PI * 2 * 3.5;
    coilPts.push(new THREE.Vector3(Math.cos(ang) * 0.0058, Math.sin(ang) * 0.0058, (t - 0.5) * 0.0155));
  }
  const coilGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 32, 0.0011, 6, false);

  const armL = new THREE.TorusGeometry(0.0084, 0.00105, 6, 12, Math.PI * 0.92);
  armL.rotateZ(Math.PI * 0.55);
  armL.translate(0.0022, -0.0045, 0.0076);

  const armR = new THREE.TorusGeometry(0.0084, 0.00105, 6, 12, Math.PI * 0.92);
  armR.rotateZ(-Math.PI * 0.55);
  armR.translate(-0.0022, -0.0045, -0.0076);

  const springGeo = mergeGeometries([coilGeo, armL, armR], false);
  coilGeo.dispose();
  armL.dispose();
  armR.dispose();

  cachedPinGeos = { halfGeo, springGeo };
  return cachedPinGeos;
}

let cachedPinMats = null;
function getClothespinMats() {
  if (cachedPinMats) return cachedPinMats;
  const assets = getAssets();
  cachedPinMats = {
    woodMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xe6cba4),
      map: assets.oak.map,
      normalMap: assets.oak.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      aoMap: assets.oak.aoMap,
      aoMapIntensity: 0.72,
      roughnessMap: assets.oak.roughnessMap,
      roughness: 0.80,
      metalness: 0.0,
    }),
    springMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdce2e8),
      map: assets.steel.map,
      normalMap: assets.steel.normalMap,
      roughnessMap: assets.steel.roughnessMap,
      metalnessMap: assets.steel.metalnessMap,
      roughness: 0.25,
      metalness: 0.94,
    }),
  };
  return cachedPinMats;
}

/**
 * Realistic wooden clothespin (2 sculpted beveled oak levers + coiled stainless spring)
 */
export function createClothespin() {
  const { halfGeo, springGeo } = getClothespinGeos();
  const { woodMat, springMat } = getClothespinMats();

  const group = new THREE.Group();
  group.name = 'clothespin';

  const leftPivot = new THREE.Group();
  const leftMesh = new THREE.Mesh(halfGeo, woodMat);
  leftMesh.castShadow = true;
  leftMesh.receiveShadow = true;
  leftPivot.add(leftMesh);

  const rightPivot = new THREE.Group();
  const rightMesh = new THREE.Mesh(halfGeo, woodMat);
  rightMesh.scale.x = -1;
  rightMesh.castShadow = true;
  rightMesh.receiveShadow = true;
  rightPivot.add(rightMesh);

  const springMesh = new THREE.Mesh(springGeo, springMat);
  springMesh.castShadow = true;

  group.add(leftPivot, rightPivot, springMesh);

  group.userData = {
    leftPivot,
    rightPivot,
    openAmount: 0,
    setOpen(amount) {
      this.openAmount = amount;
      const angle = amount * 0.28;
      leftPivot.rotation.z = -angle;
      rightPivot.rotation.z = angle;
    },
  };
  return group;
}

function createFabricMaterial(pbr, dryHex, { normalScale = 1.25 } = {}) {
  const dryColor = new THREE.Color(dryHex);
  const wetColor = dryColor.clone().multiplyScalar(0.58);
  const hsl = { h: 0, s: 0, l: 0 };
  wetColor.getHSL(hsl);
  wetColor.setHSL(hsl.h, Math.min(1, hsl.s * 1.32), hsl.l * 0.94);

  const mat = new THREE.MeshStandardMaterial({
    color: dryColor.clone(),
    map: pbr.map,
    normalMap: pbr.normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    aoMap: pbr.aoMap,
    aoMapIntensity: 0.70,
    roughnessMap: pbr.roughnessMap,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  mat.userData.dryColor = dryColor;
  mat.userData.wetColor = wetColor;
  mat.userData.setWetness = (w) => {
    const c = THREE.MathUtils.clamp(w, 0, 1);
    mat.color.copy(dryColor).lerp(wetColor, c);
    mat.roughness = THREE.MathUtils.lerp(0.96, 0.76, c);
  };
  return mat;
}

function buildClothGrid(segX, segY) {
  const geo = new THREE.PlaneGeometry(1, 1, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const count = pos.count;
  const baseUV = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    baseUV[i * 2] = pos.getX(i);
    baseUV[i * 2 + 1] = 0.5 - pos.getY(i);
  }
  geo.setAttribute('uv2', uv.clone());
  geo.userData.baseUV = baseUV;
  return geo;
}

/**
 * Soft rounded multi-layered folded cotton cushion geometry
 */
function buildFoldedClothStackGeo(w, h, d, layers = 2) {
  const geos = [];
  const layerH = h / layers;
  for (let l = 0; l < layers; l++) {
    const g = new THREE.BoxGeometry(w, layerH * 1.06, d, 14, 4, 12);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const nx = x / (w * 0.5);
      const ny = y / (layerH * 0.53);
      const nz = z / (d * 0.5);
      const rEdge = Math.min(1, Math.sqrt(nx * nx + nz * nz) * 0.72);
      const puff = Math.cos(rEdge * Math.PI * 0.42);
      const cornerShrink = 1 - 0.065 * Math.pow(Math.abs(nx * nz), 2) - 0.05 * ny * ny;
      x *= cornerShrink;
      z *= cornerShrink;
      y = y * (0.66 + 0.44 * puff) + Math.sin(nx * 6 + nz * 5 + l * 2.1) * 0.0022;
      const spine = Math.exp(-Math.pow((1 - Math.abs(nz)) * 3.5, 2)) * 0.0026;
      y += Math.sign(ny) * spine;
      p.setXYZ(i, x, y + (l + 0.5) * layerH, z);
    }
    g.computeVertexNormals();
    g.setAttribute('uv2', g.attributes.uv);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

/**
 * Organic rumpled damp cloth mound sitting naturally inside the wicker basket (never a stiff bowl!)
 */
function deformRumpledBasketCloth(u, v, seed = 0) {
  // u in [-0.5, 0.5], v in [0, 1] -> multi-lobed soft folded cloth mound tucked inside basket rim
  const lx = u * 0.25;
  const lz = (v - 0.5) * 0.21;
  const r2 = (lx * lx) / (0.145 * 0.145) + (lz * lz) / (0.115 * 0.115);
  const dome = Math.max(0, 1 - r2 * 0.85);
  // Multi-frequency organic fabric folds & pinched creases
  const ridge1 = Math.sin(u * 15.0 + v * 9.0 + seed) * 0.017;
  const ridge2 = Math.cos(u * 23.0 - v * 17.0 + seed * 1.7) * 0.011;
  const fold3 = Math.sin((u * 0.7 + v * 0.8) * 11.0 + seed * 0.5) * 0.019;
  const x = lx * (1 - 0.15 * Math.sin(v * Math.PI)) + Math.sin(v * 9.0 + seed) * 0.016;
  const z = lz * (1 - 0.12 * Math.cos(u * Math.PI)) + Math.cos(u * 10.0 + seed) * 0.014;
  const y = 0.025 + Math.pow(dome, 0.7) * 0.068 + (ridge1 + ridge2 + fold3) * (0.45 + 0.55 * dome);
  return [x, y, z];
}

/**
 * 1. TERRY TOWEL (Real thick terry cloth ~0.34m x 0.48m with dobby weave stripe & deep folds)
 */
export function createTowel({ colorHex = 0xefe1d4, stripeHex = 0xc59782, seed = 0 } = {}) {
  const assets = getAssets();
  const group = new THREE.Group();
  group.name = 'laundry_towel';

  const mat = createFabricMaterial(assets.terry, colorHex, { normalScale: 1.55 });

  const geo = buildClothGrid(26, 32);
  const count = geo.attributes.position.count;
  const baseUV = geo.userData.baseUV;

  const colors = new Float32Array(count * 3);
  const stripeC = new THREE.Color(stripeHex);
  const baseC = new THREE.Color(colorHex);
  const rr = stripeC.r / Math.max(0.01, baseC.r);
  const rg = stripeC.g / Math.max(0.01, baseC.g);
  const rb = stripeC.b / Math.max(0.01, baseC.b);

  for (let i = 0; i < count; i++) {
    const u = baseUV[i * 2];
    const v = baseUV[i * 2 + 1];
    const inStripe = (v > 0.825 && v < 0.87) || (v > 0.892 && v < 0.914);
    const inHem = Math.abs(u) > 0.455 || v < 0.04 || v > 0.96;
    let r = 1, g = 1, b = 1;
    if (inStripe) {
      r = rr; g = rg; b = rb;
    } else if (inHem) {
      r = 0.945; g = 0.94; b = 0.935;
    }
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  mat.vertexColors = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const foldedGeo = buildFoldedClothStackGeo(0.24, 0.056, 0.17, 3);
  const fc = new Float32Array(foldedGeo.attributes.position.count * 3).fill(1);
  foldedGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const foldedMesh = new THREE.Mesh(foldedGeo, mat);
  foldedMesh.castShadow = true;
  foldedMesh.receiveShadow = true;
  foldedMesh.visible = false;
  group.add(foldedMesh);

  const W = 0.34;
  const H = 0.48;

  function updateShape({ mode = 'hanging', time = 0, wind = 0.35, wetness = 0.5, foldStage = 0, gust = 0 }) {
    mat.userData.setWetness(wetness);
    const pos = geo.attributes.position;
    const dampWeight = 1 - wetness * 0.42;

    if (mode === 'folded' && foldStage >= 2) {
      mesh.visible = false;
      foldedMesh.visible = true;
      return;
    }
    mesh.visible = true;
    foldedMesh.visible = false;

    for (let i = 0; i < count; i++) {
      const u = baseUV[i * 2];
      const v = baseUV[i * 2 + 1];

      if (mode === 'hanging') {
        const dPinL = Math.abs(u + 0.34);
        const dPinR = Math.abs(u - 0.34);
        const dPin = Math.min(dPinL, dPinR);

        const midSag = Math.max(0, 1 - Math.pow(u / 0.34, 2)) * 0.028 * (1 - v * 0.62);
        const cornerSag = Math.max(0, (Math.abs(u) - 0.34) / 0.16) * 0.036 * (1 - v * 0.45);
        const topPinch = Math.exp(-dPin * 18) * (1 - v) * 0.01;

        const foldFreq = Math.sin((u + 0.34) * 26) * Math.exp(-dPinL * 3.4)
                       + Math.sin((u - 0.34) * 26) * Math.exp(-dPinR * 3.4);
        const drapeZ = (foldFreq * 0.015 + Math.sin(u * 13 + 0.5) * 0.015) * Math.pow(v, 0.72);

        const wAmp = (wind * 0.044 + gust * 0.11) * dampWeight;
        const swingZ = Math.sin(time * 1.9 + 0.4) * wAmp * Math.pow(v, 1.35)
                     + Math.sin(time * 4.3 - v * 5.2 + u * 3.0) * wAmp * 0.38 * Math.pow(v, 1.5);
        const swayX = Math.sin(time * 1.35) * wAmp * 0.25 * v;
        const hemCurl = v > 0.94 ? (v - 0.94) * 0.12 : 0;

        const x = u * W * (1 - 0.045 * Math.sin(v * Math.PI)) + swayX;
        const y = -v * H - midSag - cornerSag + topPinch;
        const z = drapeZ + swingZ + hemCurl;
        pos.setXYZ(i, x, y, z);
      } else if (mode === 'basket') {
        const [bx, by, bz] = deformRumpledBasketCloth(u, v, seed);
        pos.setXYZ(i, bx, by, bz);
      } else if (mode === 'table' || mode === 'folded') {
        const lx = u * W * 0.96;
        let lz = (v - 0.5) * H * 0.82;
        let ly = 0.010 + Math.sin(u * 14 + v * 9) * 0.0028;
        if (foldStage >= 1) {
          if (v > 0.5) {
            const fv = 1.0 - v;
            lz = (fv - 0.25) * H * 0.82;
            ly += 0.018 + Math.sin(u * 10) * 0.0025;
          } else {
            lz = (v - 0.25) * H * 0.82;
          }
        }
        pos.setXYZ(i, lx, ly, lz);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  updateShape({ mode: 'hanging', time: 0, wind: 0.35, wetness: 0.65 });

  group.userData = {
    id: 'towel',
    kind: 'towel',
    mat,
    mesh,
    foldedMesh,
    pinOffsets: [
      new THREE.Vector3(-0.34 * W, 0.004, 0),
      new THREE.Vector3(0.34 * W, 0.004, 0),
    ],
    updateShape,
  };
  return group;
}

/**
 * 2. SMOOTH SCULPTED COTTON T-SHIRT (Natural draped sleeves + 3D ribbed crew-neck + inner back collar!)
 */
export function createTShirt({ colorHex = 0xb5ccd9, seed = 1.8 } = {}) {
  const assets = getAssets();
  const group = new THREE.Group();
  group.name = 'laundry_tshirt';

  const mat = createFabricMaterial(assets.jersey, colorHex, { normalScale: 1.15 });
  const innerMat = mat.clone();
  innerMat.color = mat.userData.dryColor.clone().multiplyScalar(0.82);

  const torsoGeo = buildClothGrid(22, 24);
  const tCount = torsoGeo.attributes.position.count;
  const tUV = torsoGeo.userData.baseUV;

  const sleeveLGeo = buildClothGrid(10, 12);
  const sleeveRGeo = buildClothGrid(10, 12);
  const sCount = sleeveLGeo.attributes.position.count;
  const sUVL = sleeveLGeo.userData.baseUV;
  const sUVR = sleeveRGeo.userData.baseUV;

  const tColors = new Float32Array(tCount * 3);
  for (let i = 0; i < tCount; i++) {
    const u = tUV[i * 2];
    const v = tUV[i * 2 + 1];
    const isCollar = v < 0.068 && Math.abs(u) < 0.27;
    const isHem = v > 0.945;
    const sh = isCollar ? 0.87 : (isHem ? 0.94 : 1.0);
    tColors[i * 3] = sh; tColors[i * 3 + 1] = sh; tColors[i * 3 + 2] = sh;
  }
  torsoGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));
  const sCol = new Float32Array(sCount * 3);
  for (let i = 0; i < sCount; i++) {
    const sAlong = sUVL[i * 2] + 0.5;
    const sh = sAlong > 0.88 ? 0.93 : 1.0;
    sCol[i * 3] = sh; sCol[i * 3 + 1] = sh; sCol[i * 3 + 2] = sh;
  }
  sleeveLGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  sleeveRGeo.setAttribute('color', new THREE.BufferAttribute(sCol.slice(), 3));
  mat.vertexColors = true;

  const torsoMesh = new THREE.Mesh(torsoGeo, mat);
  const sleeveLMesh = new THREE.Mesh(sleeveLGeo, mat);
  const sleeveRMesh = new THREE.Mesh(sleeveRGeo, mat);

  // Subtle inner back-collar crescent visible behind the front crew-neck opening!
  const backNeckGeo = new THREE.PlaneGeometry(0.145, 0.056, 10, 4);
  const bnp = backNeckGeo.attributes.position;
  for (let i = 0; i < bnp.count; i++) {
    const x = bnp.getX(i), y = bnp.getY(i);
    const nx = x / 0.0725;
    bnp.setY(i, y - (1 - nx * nx) * 0.012);
    bnp.setZ(i, -0.012 - (1 - nx * nx) * 0.008);
  }
  backNeckGeo.computeVertexNormals();
  const backNeckMesh = new THREE.Mesh(backNeckGeo, innerMat);
  backNeckMesh.position.set(0, -0.032, -0.002);

  for (const m of [torsoMesh, sleeveLMesh, sleeveRMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  group.add(backNeckMesh);

  // Folded T-shirt mesh
  const foldedGroup = new THREE.Group();
  const fBodyGeo = buildFoldedClothStackGeo(0.24, 0.038, 0.21, 2);
  const fbc = new Float32Array(fBodyGeo.attributes.position.count * 3).fill(1);
  fBodyGeo.setAttribute('color', new THREE.BufferAttribute(fbc, 3));
  const fBody = new THREE.Mesh(fBodyGeo, mat);
  fBody.castShadow = true;
  fBody.receiveShadow = true;
  foldedGroup.add(fBody);

  const collarGeo = new THREE.TorusGeometry(0.044, 0.0068, 8, 18, Math.PI);
  collarGeo.rotateX(Math.PI / 2);
  const cc = new Float32Array(collarGeo.attributes.position.count * 3).fill(0.90);
  collarGeo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const collarMesh = new THREE.Mesh(collarGeo, mat);
  collarMesh.position.set(0, 0.038, -0.092);
  foldedGroup.add(collarMesh);
  foldedGroup.visible = false;
  group.add(foldedGroup);

  const torsoW = 0.295;
  const torsoH = 0.42;
  const sleeveLen = 0.105; // natural compact child short sleeve, never overlaps neighbor!
  const sleeveH = 0.132;

  function updateShape({ mode = 'hanging', time = 0, wind = 0.35, wetness = 0.5, foldStage = 0, gust = 0 }) {
    mat.userData.setWetness(wetness);
    innerMat.color.copy(mat.color).multiplyScalar(0.80);
    const dampWeight = 1 - wetness * 0.42;

    if (mode === 'folded' && foldStage >= 2) {
      torsoMesh.visible = sleeveLMesh.visible = sleeveRMesh.visible = backNeckMesh.visible = false;
      foldedGroup.visible = true;
      return;
    }
    torsoMesh.visible = sleeveLMesh.visible = sleeveRMesh.visible = true;
    backNeckMesh.visible = mode === 'hanging';
    foldedGroup.visible = false;

    const wAmp = (wind * 0.044 + gust * 0.115) * dampWeight;
    const tPos = torsoGeo.attributes.position;

    for (let i = 0; i < tCount; i++) {
      const u = tUV[i * 2];
      const v = tUV[i * 2 + 1];

      if (mode === 'hanging') {
        const neckU = Math.abs(u) / 0.25;
        const neckDrop = neckU < 1.0 ? Math.cos(neckU * Math.PI * 0.5) * 0.048 * (1 - v * 0.85) : 0;
        const shoulderSlope = Math.max(0, Math.abs(u) - 0.25) * 0.072 * (1 - v * 0.8);
        const widthMod = 1.0 - Math.sin(v * Math.PI) * 0.045 + v * 0.025;

        const dL = Math.abs(u + 0.35);
        const dR = Math.abs(u - 0.35);
        const fullness = Math.cos(u * Math.PI) * 0.024 * Math.sin(v * Math.PI);
        const pleats = (Math.sin((u + 0.35) * 20) * Math.exp(-dL * 3.5)
                      + Math.sin((u - 0.35) * 20) * Math.exp(-dR * 3.5)) * 0.013 * Math.pow(v, 0.75);

        const swingZ = Math.sin(time * 1.75 + 1.5) * wAmp * Math.pow(v, 1.32)
                     + Math.sin(time * 4.0 - v * 4.8 + u * 4.0) * wAmp * 0.36 * Math.pow(v, 1.45);
        const swayX = Math.sin(time * 1.2 + 1.0) * wAmp * 0.24 * v;

        tPos.setXYZ(
          i,
          u * torsoW * widthMod + swayX,
          -v * torsoH - neckDrop - shoulderSlope,
          fullness + pleats + swingZ
        );
      } else if (mode === 'basket') {
        const [bx, by, bz] = deformRumpledBasketCloth(u, v, seed);
        tPos.setXYZ(i, bx, by, bz);
      } else {
        const neckU = Math.abs(u) / 0.25;
        const neckDrop = neckU < 1.0 ? Math.cos(neckU * Math.PI * 0.5) * 0.042 * (1 - v) : 0;
        tPos.setXYZ(
          i,
          u * torsoW * 0.94,
          0.010 + Math.cos(u * 10 + v * 7) * 0.0025,
          (v - 0.5) * torsoH * 0.92 + neckDrop * 0.7
        );
      }
    }
    tPos.needsUpdate = true;
    torsoGeo.computeVertexNormals();

    function updateSleeve(sGeo, sUV, side) {
      const sp = sGeo.attributes.position;
      for (let i = 0; i < sCount; i++) {
        const sAlong = sUV[i * 2] + 0.5;
        const v = sUV[i * 2 + 1];

        if (mode === 'hanging') {
          // Natural gravity-draped short sleeve curving smoothly down from rounded shoulder cap (~50 deg!)
          const seamY = -0.018 - v * sleeveH * (1 - sAlong * 0.16);
          const droopY = -sAlong * 0.088 - Math.pow(sAlong, 1.7) * 0.022;
          const x = side * (torsoW * 0.482 + sAlong * sleeveLen * (0.94 - v * 0.22));
          const y = seamY + droopY;
          // Soft tubular rounded cloth volume + natural sleeve crease
          const roundZ = Math.sin(v * Math.PI) * 0.020 * (0.72 + 0.28 * sAlong) + Math.sin(sAlong * 8 + v * 5) * 0.003;
          const flutter = Math.sin(time * 3.6 + side * 1.2 - sAlong * 2.5) * wAmp * (0.24 + sAlong * 0.55);
          const sway = Math.sin(time * 1.75 + 1.5) * wAmp * Math.pow(v * 0.32 + 0.1, 1.3);
          sp.setXYZ(i, x, y, roundZ + flutter + sway);
        } else if (mode === 'basket') {
          const [bx, by, bz] = deformRumpledBasketCloth((sAlong - 0.5) * 0.6 + side * 0.15, v * 0.6 + 0.2, seed + side);
          sp.setXYZ(i, bx, by - 0.005, bz);
        } else {
          const tucked = foldStage >= 1;
          const sx = tucked
            ? side * (torsoW * 0.44 - sAlong * sleeveLen * 0.85)
            : side * (torsoW * 0.46 + sAlong * sleeveLen * 0.92);
          const sy = tucked ? 0.024 + sAlong * 0.004 : 0.011 + Math.sin(v * Math.PI) * 0.004;
          const sz = -torsoH * 0.42 + v * sleeveH * 0.92 + sAlong * (tucked ? 0.03 : 0.045);
          sp.setXYZ(i, sx, sy, sz);
        }
      }
      sp.needsUpdate = true;
      sGeo.computeVertexNormals();
    }

    updateSleeve(sleeveLGeo, sUVL, -1);
    updateSleeve(sleeveRGeo, sUVR, 1);
  }

  updateShape({ mode: 'hanging', time: 0, wind: 0.35, wetness: 0.65 });

  group.userData = {
    id: 'tshirt',
    kind: 'tshirt',
    mat,
    mesh: torsoMesh,
    meshes: [torsoMesh, sleeveLMesh, sleeveRMesh],
    foldedMesh: foldedGroup,
    pinOffsets: [
      new THREE.Vector3(-0.35 * torsoW, -0.007, 0.002),
      new THREE.Vector3(0.35 * torsoW, -0.007, 0.002),
    ],
    updateShape,
  };
  return group;
}

/**
 * 3. KNITTED COTTON SOCKS PAIR
 */
function buildSingleSockGeometry(mirror = 1) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, 0),
    new THREE.Vector3(0, -0.052, 0.002),
    new THREE.Vector3(0, -0.112, 0.003),
    new THREE.Vector3(0.014 * mirror, -0.152, 0.005),
    new THREE.Vector3(0.056 * mirror, -0.174, 0.003),
    new THREE.Vector3(0.100 * mirror, -0.180, 0.001),
  ]);

  const tubularSegs = 32;
  const radialSegs = 16;
  const frames = curve.computeFrenetFrames(tubularSegs, false);

  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    let rx = 0.0285;
    let rz = 0.0102;
    if (t < 0.22) {
      rx = 0.028;
      rz = 0.0112;
    } else if (t > 0.48 && t < 0.68) {
      const ht = Math.sin(((t - 0.48) / 0.20) * Math.PI);
      rx = 0.0295 + ht * 0.0065;
      rz = 0.0108 + ht * 0.0025;
    } else if (t > 0.84) {
      const tt = (t - 0.84) / 0.16;
      const cap = Math.sqrt(Math.max(0.001, 1 - tt * tt));
      rx = 0.0285 * cap;
      rz = 0.0098 * cap;
    }

    const isStripe = (t > 0.11 && t < 0.155) || (t > 0.185 && t < 0.215);
    const isHeelToe = (t > 0.51 && t < 0.65) || t > 0.86;
    let cr = 1.0, cg = 1.0, cb = 1.0;
    if (isStripe) {
      cr = 0.82; cg = 0.52; cb = 0.46;
    } else if (isHeelToe) {
      cr = 0.92; cg = 0.87; cb = 0.83;
    }

    for (let j = 0; j <= radialSegs; j++) {
      const s = j / radialSegs;
      const theta = s * Math.PI * 2;
      const rib = t < 0.24 ? 1 + Math.sin(theta * 14) * 0.04 * (1 - t / 0.24) : 1;
      const crease = 1 + Math.sin(t * 28 + theta * 2) * 0.02;
      const cos = Math.cos(theta) * rib * crease;
      const sin = Math.sin(theta) * rib * crease;

      positions.push(
        p.x + N.x * cos * rx + B.x * sin * rz,
        p.y + N.y * cos * rx + B.y * sin * rz,
        p.z + N.z * cos * rx + B.z * sin * rz
      );
      uvs.push(s * 1.5, t * 2.4);
      colors.push(cr, cg, cb);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createSocks({ colorHex = 0xf4ecdf } = {}) {
  const assets = getAssets();
  const group = new THREE.Group();
  group.name = 'laundry_socks';

  const mat = createFabricMaterial(assets.waffle, colorHex, { normalScale: 1.25 });
  mat.vertexColors = true;

  const sockL = new THREE.Mesh(buildSingleSockGeometry(-1), mat);
  sockL.position.set(-0.072, 0, 0);
  sockL.castShadow = true;
  sockL.receiveShadow = true;

  const sockR = new THREE.Mesh(buildSingleSockGeometry(1), mat);
  sockR.position.set(0.072, 0, 0);
  sockR.castShadow = true;
  sockR.receiveShadow = true;

  group.add(sockL, sockR);

  const foldedGeo = buildFoldedClothStackGeo(0.145, 0.044, 0.082, 2);
  const fc = new Float32Array(foldedGeo.attributes.position.count * 3).fill(1);
  foldedGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const foldedMesh = new THREE.Mesh(foldedGeo, mat);
  foldedMesh.castShadow = true;
  foldedMesh.receiveShadow = true;
  foldedMesh.visible = false;
  group.add(foldedMesh);

  function updateShape({ mode = 'hanging', time = 0, wind = 0.35, wetness = 0.5, foldStage = 0, gust = 0 }) {
    mat.userData.setWetness(wetness);
    const dampWeight = 1 - wetness * 0.4;

    if (mode === 'folded' && foldStage >= 2) {
      sockL.visible = false;
      sockR.visible = false;
      foldedMesh.visible = true;
      return;
    }
    sockL.visible = true;
    sockR.visible = true;
    foldedMesh.visible = false;

    if (mode === 'hanging') {
      const wAmp = (wind * 0.22 + gust * 0.55) * dampWeight;
      sockL.position.set(-0.072, 0, 0);
      sockR.position.set(0.072, 0, 0);
      sockL.rotation.set(
        Math.sin(time * 2.5 + 0.3) * wAmp,
        0.18 + Math.sin(time * 1.4) * 0.08,
        Math.sin(time * 1.8) * wAmp * 0.45
      );
      sockR.rotation.set(
        Math.sin(time * 2.6 + 1.4) * wAmp,
        -0.18 + Math.cos(time * 1.5) * 0.08,
        Math.sin(time * 1.9 + 1.0) * wAmp * 0.45
      );
    } else if (mode === 'basket') {
      sockL.position.set(-0.045, 0.042, 0.025);
      sockL.rotation.set(1.25, 0.4, 0.7);
      sockR.position.set(0.045, 0.056, -0.02);
      sockR.rotation.set(1.35, -0.6, -0.4);
    } else if (mode === 'table' || mode === 'folded') {
      if (foldStage === 0) {
        sockL.position.set(-0.06, 0.018, -0.05);
        sockL.rotation.set(-Math.PI / 2, 0, 0.12);
        sockR.position.set(0.06, 0.018, -0.05);
        sockR.rotation.set(-Math.PI / 2, 0, -0.12);
      } else {
        sockL.position.set(-0.005, 0.016, -0.04);
        sockL.rotation.set(-Math.PI / 2, 0, 0.04);
        sockR.position.set(0.005, 0.036, -0.04);
        sockR.rotation.set(-Math.PI / 2, 0, -0.04);
      }
    }
  }

  updateShape({ mode: 'hanging', time: 0, wind: 0.35, wetness: 0.65 });

  group.userData = {
    id: 'socks',
    kind: 'socks',
    mat,
    mesh: sockL,
    meshes: [sockL, sockR],
    foldedMesh,
    pinOffsets: [
      new THREE.Vector3(-0.072, 0.006, 0),
      new THREE.Vector3(0.072, 0.006, 0),
    ],
    updateShape,
  };
  return group;
}
