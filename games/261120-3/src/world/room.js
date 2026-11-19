// Dining table, dim room behind it, the ordinary family place settings on the far side, and the env-map room.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { lathe, arc, roundRectPath, offsetContour, sweep, cap, freeze } from './geom.js';
import { tableWoodGen, windowTex, linenGen, stonewareGen, progressive } from './textures.js';

// Table top extents (cm). Player at +z.
export const TABLE = { x0: -115, x1: 135, z0: -72, z1: 88, thick: 3.6 };

export function buildTable(ctx) {
  const { low, aniso } = ctx;
  const T = TABLE;
  const w = T.x1 - T.x0, d = T.z1 - T.z0, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
  const tw = progressive(ctx, 256, low ? 512 : 1024, (s) => tableWoodGen(s, aniso), 1);
  ctx.tex.tableWood = tw;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tw.map,
    roughnessMap: tw.roughnessMap,
    roughness: 1,
    bumpMap: tw.bumpMap,
    bumpScale: 0.6,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.9,
  });
  // texture covers 90 cm (planks along x)
  const S = 1 / 90;
  const path = roundRectPath(w, d, 2.5, 6);
  const top = cap(offsetContour(path, -0.6), [], 0, { uvXZ: S });
  // edge profile walks: underside -> up the outside -> rounded top edge -> onto the top
  const edge = sweep(path, [
    [-3, -T.thick],
    ...arc(-0.5, -T.thick + 0.5, 0.5, -Math.PI / 2, 0, 3, true),
    [0, -0.6],
    ...arc(-0.6, -0.6, 0.6, 0, Math.PI / 2, 6, true),
  ], { uvXZ: S });
  const g = new THREE.Group();
  const mTop = new THREE.Mesh(top, mat);
  mTop.position.set(cx, 0, cz);
  mTop.receiveShadow = true;
  // shift uvs so texture is anchored to world coords
  const mEdge = new THREE.Mesh(edge, mat);
  mEdge.position.set(cx, 0, cz);
  mEdge.receiveShadow = true;
  g.add(mTop, mEdge);
  return g;
}

// Dim room: floor, back wall with a dusk window, a low sideboard silhouette
export function buildRoom(ctx) {
  const g = new THREE.Group();
  const floorY = -74;
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.7, map: ctx.tex.tableWood.map });
  const floorGeo = new THREE.PlaneGeometry(900, 700);
  floorGeo.rotateX(-Math.PI / 2);
  const uv = floorGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 5);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, floorY, -40);
  g.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7866, roughness: 0.95 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(900, 360), wallMat);
  wall.position.set(0, floorY + 180, -230);
  g.add(wall);

  // window: dusk gradient + frame
  const win = new THREE.Mesh(new THREE.PlaneGeometry(110, 120), new THREE.MeshBasicMaterial({ map: windowTex(256), color: 0x8a8a8a, toneMapped: true }));
  win.position.set(-60, floorY + 150, -229.5);
  g.add(win);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: 0.6 });
  const fr = [
    [0, 62, 118, 5], [0, -62, 118, 5], [-57, 0, 5, 128], [57, 0, 5, 128], [0, 0, 3, 120], [0, 10, 110, 3],
  ];
  for (const [x, y, w, h] of fr) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), frameMat);
    b.position.set(-60 + x, floorY + 150 + y, -228);
    g.add(b);
  }
  // curtain (soft vertical folds)
  const curtGeo = new THREE.PlaneGeometry(40, 170, 40, 1);
  const cp = curtGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 0.7) * 2.2);
  curtGeo.computeVertexNormals();
  const curt = new THREE.Mesh(curtGeo, new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 0.9, side: THREE.DoubleSide }));
  curt.position.set(12, floorY + 140, -224);
  g.add(curt);

  // sideboard + a few shapes on it
  const sbMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1f, roughness: 0.6, map: ctx.tex.tableWood.map });
  const sb = new THREE.Mesh(new RoundedBoxGeometry(120, 80, 42, 2, 1.5), sbMat);
  sb.position.set(95, floorY + 40, -205);
  g.add(sb);
  const potMat = new THREE.MeshStandardMaterial({ color: 0x7d6a58, roughness: 0.5 });
  const pot = new THREE.Mesh(lathe([[0, 0], [9, 0], [12, 10], [10, 24], [4, 30], [4.5, 34], [0, 34]], { segs: 24 }), potMat);
  pot.position.set(70, floorY + 80, -205);
  g.add(pot);
  const books = new THREE.Mesh(new RoundedBoxGeometry(30, 26, 20, 1, 0.8), new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: 0.8 }));
  books.position.set(115, floorY + 93, -208);
  g.add(books);
  freeze(g);
  return g;
}

// The family's ordinary place settings on the far side (outside the play area)
export function buildPlaceSettings(ctx) {
  const g = new THREE.Group();
  const sw = ctx.tex.stoneware2 || (ctx.tex.stoneware2 = progressive(ctx, 64, 256, (s) => stonewareGen(s, [0.86, 0.88, 0.89], 33)));
  // small plate ~15 cm
  const plateProf = [
    [0, 0.25], [5.2, 0.25], [5.4, 0.0], [5.8, 0.0], [5.9, 0.3], [6.4, 0.42], [7.2, 0.9], [7.5, 1.35],
    ...arc(7.45, 1.35, 0.15, 0, Math.PI, 4, true),
    [6.9, 1.05], [6.0, 0.62], [0, 0.6],
  ];
  const plateGeo = lathe(plateProf, { segs: 64, uvXZ: 0.12 });
  const plateMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: sw.map, roughnessMap: sw.roughnessMap, normalMap: sw.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 1, clearcoat: 0.6, clearcoatRoughness: 0.12 });
  const plates = new THREE.InstancedMesh(plateGeo, plateMat, 3);

  // chopsticks: tapered, dark lacquer
  const csGeo = lathe([[0, 0], [0.16, 0.02], [0.18, 0.2], [0.34, 22.5], [0.33, 23], [0, 23.05]], { segs: 12 });
  csGeo.rotateZ(-Math.PI / 2); // tip toward -x (Japanese setting: tips left, on the rest)
  csGeo.translate(-11.5, 0, 0);
  const csMat = new THREE.MeshPhysicalMaterial({ color: 0x3a1a10, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const chop = new THREE.InstancedMesh(csGeo, csMat, 6);
  // chopstick rest: small ceramic pebble
  const restGeo = new THREE.SphereGeometry(1, 24, 12);
  restGeo.scale(2.2, 0.55, 0.85);
  restGeo.translate(0, 0.5, 0);
  const restMat = new THREE.MeshPhysicalMaterial({ color: 0x8e9a8a, roughness: 0.25, clearcoat: 0.6 });
  const rests = new THREE.InstancedMesh(restGeo, restMat, 3);

  // barley tea glasses
  const glassProf = [
    [0, 0], [3.0, 0], ...arc(3.0, 0.35, 0.35, -Math.PI / 2, 0, 4, true), [3.75, 9.2],
    ...arc(3.68, 9.2, 0.08, 0, Math.PI, 4, true), [3.3, 1.0], [0, 0.9],
  ];
  const glassGeo = lathe(glassProf, { segs: 48 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.2, envMapIntensity: 2.2, specularIntensity: 1, depthWrite: false });
  const glasses = new THREE.InstancedMesh(glassGeo, glassMat, 3);
  glasses.renderOrder = 2;
  const teaGeo = lathe([[0, 0.95], [3.27, 0.95], [3.58, 6.8], [0, 6.8]], { segs: 48 });
  const teaMat = new THREE.MeshPhysicalMaterial({ color: 0x9a5a1c, roughness: 0.06, transparent: true, opacity: 0.9, emissive: 0x2a1204, emissiveIntensity: 0.6, envMapIntensity: 1.5 });
  const tea = new THREE.InstancedMesh(teaGeo, teaMat, 3);
  tea.renderOrder = 1;

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), E = new THREE.Euler();
  const set = (im, i, x, y, z, yaw = 0, roll = 0) => { M.compose(P.set(x, y, z), Q.setFromEuler(E.set(0, yaw, roll, 'YXZ')), S); im.setMatrixAt(i, M); };
  const xs = [-36, 0, 36], zp = -46;
  xs.forEach((x, i) => {
    set(plates, i, x + (i - 1) * 0.6, 0, zp + (i % 2) * 1.2);
    set(rests, i, x - 9.5, 0, zp + 10.8, 0.05);
    // tips lie on the rest (top ~1.05), handles touch the table -> slight roll
    set(chop, i * 2, x - 1.5, 0.75, zp + 10.4, 0.02 * (i - 1), -0.03);
    set(chop, i * 2 + 1, x - 1.5, 0.75, zp + 11.3, -0.015 + 0.015 * i, -0.03);
    set(glasses, i, x + 13, 0, zp - 7.5 + (i % 2));
    set(tea, i, x + 13, 0, zp - 7.5 + (i % 2));
  });
  for (const im of [plates, chop, rests, glasses, tea]) {
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = im !== glasses && im !== tea;
    im.receiveShadow = true;
    im.computeBoundingSphere();
  }
  // folded cloth (linen napkin)
  const cloth = new THREE.Mesh(new RoundedBoxGeometry(13, 1.4, 9.5, 3, 0.6), new THREE.MeshStandardMaterial({ color: 0xb8a68a, roughness: 0.9, normalMap: progressive(ctx, 64, 256, linenGen), normalScale: new THREE.Vector2(0.6, 0.6) }));
  cloth.position.set(58, 0.7, -40);
  cloth.rotation.y = -0.18;
  cloth.castShadow = cloth.receiveShadow = true;
  const cloth2 = new THREE.Mesh(new RoundedBoxGeometry(12.6, 1.0, 9.0, 3, 0.45), cloth.material);
  cloth2.position.set(58.3, 1.85, -40.3);
  cloth2.rotation.y = -0.2;
  cloth2.castShadow = cloth2.receiveShadow = true;
  g.add(plates, chop, rests, tea, glasses, cloth, cloth2);
  freeze(g);
  return g;
}

// Small procedural room used only to bake the environment map (soft lamp + walls + window + warm table below)
export function bakeEnvironment(renderer) {
  const s = new THREE.Scene();
  const box = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.075, 0.055), side: THREE.BackSide }));
  box.position.y = 1.5;
  s.add(box);
  const add = (geo, rgb, x, y, z, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    s.add(m);
    return m;
  };
  // pendant lamp: bright warm disc overhead + dimmer shade ring
  add(new THREE.CircleGeometry(0.55, 32), [9, 6.2, 3.6], 0.2, 3.0, 0.2, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.9, 0.6, 0.5, 32, 1, true), [0.5, 0.33, 0.18], 0.2, 3.25, 0.2);
  // second soft warm source (another lamp in the room, kitchen light) far right/back
  add(new THREE.PlaneGeometry(1.6, 0.8), [1.6, 1.15, 0.7], 5.9, 2.2, -2, 0, -Math.PI / 2);
  // dusk window on the far wall
  add(new THREE.PlaneGeometry(2.4, 2.2), [0.25, 0.32, 0.55], -1.4, 2.4, -5.9);
  // warm wooden table beneath
  add(new THREE.PlaneGeometry(7, 5), [0.16, 0.085, 0.045], 0, -0.6, 0, -Math.PI / 2);
  // near wall (behind player) slightly lit
  add(new THREE.PlaneGeometry(10, 4), [0.12, 0.09, 0.07], 0, 1.5, 5.9, 0, Math.PI);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035, 0.1, 50);
  pm.dispose();
  s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}
