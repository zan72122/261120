// Electric takoyaki maker: plastic housing + removable coated aluminium plate with 12 smooth hemispherical holes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { lathe, arc, roundRectPath, offsetContour, sweep, cap } from './geom.js';
import { coatedMetalGen, smudgeGen, progressive } from './textures.js';

export function buildHotplate(ctx) {
  const { cfg, low } = ctx;
  const { RIM_Y, HOLE_R, HOTPLATE: H } = cfg;
  const group = new THREE.Group();
  group.name = 'hotplate';

  // ---------- cooking plate ----------
  const cm = progressive(ctx, 128, low ? 256 : 512, coatedMetalGen, 0);
  const UVS = 1 / 6; // micro speckle repeats every 6 cm
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0x232222,
    metalness: 0.45,
    roughness: 1,
    roughnessMap: cm.roughnessMap,
    normalMap: cm.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    clearcoat: 0.35,
    clearcoatRoughness: 0.28,
    envMapIntensity: 1.1,
  });
  const f = 0.32; // rim fillet radius
  const R = HOLE_R;
  const cR = Math.sqrt((R + f) * (R + f) - f * f); // where the fillet meets the flat top
  const HS = low ? 36 : 40; // radial segments per hole (sub-pixel facets even on iPad; normals are analytic)
  const sphereSegs = low ? 12 : 14;
  // profile walks from the flat top down into the hole (normals face up / toward the axis)
  const prof = [];
  const a0 = Math.atan2(f, -cR); // fillet: from top (90deg) to contact angle
  for (let k = 0; k <= 7; k++) {
    const a = Math.PI / 2 + ((a0 - Math.PI / 2) * k) / 7;
    prof.push([cR + f * Math.cos(a), RIM_Y - f + f * Math.sin(a)]);
  }
  const tc = Math.atan2(cR, f); // contact angle on the sphere, measured from the bottom
  for (let k = 1; k <= sphereSegs; k++) {
    const t = tc * (1 - k / sphereSegs);
    prof.push([R * Math.sin(t), RIM_Y - R * Math.cos(t)]);
  }
  prof[prof.length - 1][0] = 0;
  const holes2D = [];
  const geos = [];
  const c = new THREE.Vector3();
  for (let i = 0; i < cfg.BALL_COUNT; i++) {
    cfg.holeCenter(i, c);
    const g = lathe(prof, { segs: HS });
    g.translate(c.x, 0, c.z);
    // planar uvs from world xz
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < p.count; k++) uv.setXY(k, p.getX(k) * UVS, p.getZ(k) * UVS);
    geos.push(g);
    // matching hole contour for the flat top: exactly the lathe's top ring
    const ring = [];
    for (let s = 0; s < HS; s++) {
      const phi = (s / HS) * Math.PI * 2;
      ring.push(new THREE.Vector2(c.x + cR * Math.sin(phi), c.z + cR * Math.cos(phi)));
    }
    holes2D.push(ring);
  }
  // flat top inside the lip
  const pW = H.plateW, pD = H.plateD, pr = 1.4, lipIn = 0.9;
  const ppath = roundRectPath(pW, pD, pr, 8);
  geos.push(cap(offsetContour(ppath, -lipIn), holes2D, RIM_Y, { uvXZ: UVS }));
  // raised lip + outer side of the plate (going down into the housing recess)
  // profile walks up the plate's outer side, over the rounded lip, down a concave fillet onto the flat top
  const lh = 0.35, er = 0.17;
  const lipProf = [
    [0, RIM_Y - 1.6],
    [0, RIM_Y + lh - er],
    ...arc(-er, RIM_Y + lh - er, er, 0, Math.PI / 2, 4, true),
    [-0.38, RIM_Y + lh],
    ...arc(-0.38, RIM_Y + lh - er, er, Math.PI / 2, Math.PI, 4, true),
    ...arc(-0.56 - er, RIM_Y + er, er, 0, -Math.PI / 2, 4, true),
    [-lipIn, RIM_Y],
  ];
  const lipG = sweep(ppath, lipProf, { uvXZ: UVS });
  geos.push(lipG);
  const plateGeo = mergeGeometries(geos, false);
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.receiveShadow = true;
  plate.castShadow = true;
  plate.name = 'cookingPlate';
  group.add(plate);

  // ---------- housing (matte black heat-resistant plastic) ----------
  const hsm = progressive(ctx, 64, 256, (s) => smudgeGen(s, 0.55, 0.75, 12), 4);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x141415, roughness: 1, roughnessMap: hsm, metalness: 0, envMapIntensity: 0.9 });
  const bW = pW, bD = H.d - 6.4; // inner reference rect; outer = +3.2 each side
  const hpath = roundRectPath(bW, bD, 1.8, 10);
  const top = H.bodyH;
  const hProf = [
    [1.2, 0.8], // underside
    [2.62, 0.8],
    ...arc(2.62, 1.2, 0.4, -Math.PI / 2, 0, 4, true), // bottom edge
    [3.2 - 0.02, top - 0.9],
    ...arc(2.4, top - 0.8, 0.8, 0, Math.PI / 2, 8, true), // big rounded top edge
    [1.0, top + 0.02],
    [0.45, top],
    ...arc(0.45, top - 0.25, 0.25, Math.PI / 2, Math.PI, 3, true), // inner recess edge
    [0.2, 3.4],
  ];
  // slight draft: sides lean in toward the bottom
  const housingGeo = sweep(hpath, hProf, { uvXZ: 1 / 20 });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.castShadow = housing.receiveShadow = true;
  group.add(housing);
  // recess floor (dark) so nothing can be seen through gaps
  const floorG = cap(offsetContour(hpath, 0.3), [], 3.4, { uvXZ: 0.05 });
  const recess = new THREE.Mesh(floorG, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }));
  group.add(recess);
  const outerHalfD = bD / 2 + 3.2; // = H.d / 2

  // handles (moulded, slightly lower than the top, protruding <= H.handle)
  const handleGeo = new RoundedBoxGeometry(9, 1.5, 2.6, 4, 0.6);
  for (const s of [-1, 1]) {
    const hnd = new THREE.Mesh(handleGeo, housingMat);
    hnd.position.set(0, top - 1.35, s * (outerHalfD + H.handle - 1.3));
    hnd.castShadow = true;
    group.add(hnd);
  }
  // feet
  const footGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.85, 20);
  footGeo.translate(0, 0.42, 0);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const ft = new THREE.Mesh(footGeo, footMat);
    ft.position.set(sx * 9.6, 0, sz * 12.4);
    group.add(ft);
  }

  // ---------- front controls: thermostat dial + indicator lamp ----------
  const frontZ = outerHalfD - 0.05;
  const dialY = 3.6;
  const knurl = (phi, j, r, y) => [r * (1 + (y > 0.2 && y < 0.95 ? 0.035 * Math.cos(phi * 24) : 0)), y];
  const dialGeo = lathe([[0, 0], [1.35, 0], [1.35, 0.15], [1.3, 0.9], ...arc(1.1, 0.9, 0.2, 0, Math.PI / 2, 3, true), [0, 1.1]], { segs: 72, mod: knurl });
  dialGeo.rotateX(Math.PI / 2); // axis along +z
  const dialMat = new THREE.MeshStandardMaterial({ color: 0x262627, roughness: 0.45, metalness: 0.0 });
  const dial = new THREE.Mesh(dialGeo, dialMat);
  dial.position.set(-8.3, dialY, frontZ - 0.2);
  dial.castShadow = true;
  group.add(dial);
  const ptr = new THREE.Mesh(new RoundedBoxGeometry(0.18, 1.0, 0.12, 1, 0.05), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.5 }));
  ptr.position.set(-8.3 + 0.3, dialY + 0.4, frontZ + 0.92);
  ptr.rotation.z = -0.6;
  group.add(ptr);
  // lamp bezel + lens
  const bez = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 10, 32), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.35, metalness: 0.6 }));
  bez.position.set(-5.4, dialY, frontZ + 0.02);
  group.add(bez);
  const lensGeo = new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  lensGeo.rotateX(Math.PI / 2);
  lensGeo.scale(1, 1, 0.5);
  const lampMat = new THREE.MeshPhysicalMaterial({ color: 0x5a2a08, emissive: 0xff5208, emissiveIntensity: 0, roughness: 0.15, clearcoat: 1 });
  const lens = new THREE.Mesh(lensGeo, lampMat);
  lens.position.set(-5.4, dialY, frontZ);
  group.add(lens);

  group.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; });
  return { group, plate, lampMat, plateMat };
}
