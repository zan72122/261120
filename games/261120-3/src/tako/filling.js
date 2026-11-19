// Filling pieces: boiled octopus chunk, cheese cube, sausage slice (~1.3 cm). Procedural geometry + vertex colours.
// Every material carries one clipping plane (far away by default) and a "cut face" shader so a bitten ball can show the piece sliced.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm3, mulberry } from './noise.js';

const geoCache = {};

function superBlob(rx, ry, rz, n, detail, seed, noiseAmp) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const s = Math.pow(Math.pow(Math.abs(v.x), n) + Math.pow(Math.abs(v.y), n) + Math.pow(Math.abs(v.z), n), 1 / n);
    const nn = 1 + noiseAmp * (fbm3(v.x * 2.2, v.y * 2.2, v.z * 2.2, seed, 2) - 0.5);
    p.setXYZ(i, (v.x / s) * rx * nn, (v.y / s) * ry * nn, (v.z / s) * rz * nn);
  }
  return g;
}

function octopusGeometry(variant) {
  const key = 'oct' + variant;
  if (geoCache[key]) return geoCache[key];
  const rnd = mulberry(77 + variant * 13);
  const g = superBlob(0.68, 0.55, 0.6, 2.6, 3, 5 + variant, 0.22);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const skinDir = new THREE.Vector3(0.2, 1, 0.35).normalize();
  const v = new THREE.Vector3();
  const cSkin = new THREE.Color('#6e1a2a'), cSkin2 = new THREE.Color('#9b2f3c');
  const cEdge = new THREE.Color('#d9a3a6'), cFlesh = new THREE.Color('#f2e9de');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize().dot(skinDir);
    // skin side bulges (tentacle exterior), cut sides stay flatter
    if (d > 0.15) {
      const k = 1 + 0.12 * (d - 0.15);
      p.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    const sp = fbm3(v.x * 9, v.y * 9, v.z * 9, 41, 2);
    if (d > 0.32) c.copy(cSkin).lerp(cSkin2, sp);
    else if (d > 0.18) c.copy(cEdge).lerp(cSkin, (d - 0.18) / 0.14);
    else c.copy(cFlesh).lerp(cEdge, Math.max(0, d + 0.1) * 0.6);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  // suckers: small pale rings on the skin side
  const suckers = [];
  const nS = 1 + (rnd() < 0.5 ? 1 : 0);
  for (let k = 0; k < nS; k++) {
    const t = new THREE.TorusGeometry(0.15 + rnd() * 0.05, 0.055, 6, 14);
    const dir = new THREE.Vector3(-0.5 + rnd() * 0.4 + k * 0.6, 0.8, 0.5 + rnd() * 0.3).normalize();
    const pos = dir.clone().multiplyScalar(0.62);
    t.applyMatrix4(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), new THREE.Vector3(1, 1, 0.8)));
    suckers.push(t);
  }
  return (geoCache[key] = { g, suckers });
}

function addCutFace(mat, interiorHex, u) {
  const ic = new THREE.Color(interiorHex);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = u.uCut;
    sh.uniforms.uCutPlane = u.uCutPlane;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCut;\nuniform vec4 uCutPlane;')
      .replace('#include <color_fragment>', `#include <color_fragment>\nbool fCut = uCut > 0.5 && !gl_FrontFacing;\nif (fCut) diffuseColor.rgb = vec3(${ic.r.toFixed(4)},${ic.g.toFixed(4)},${ic.b.toFixed(4)});`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif (fCut) normal = -uCutPlane.xyz;');
  };
  mat.customProgramCacheKey = () => 'tako-fill-' + interiorHex;
  mat.side = THREE.DoubleSide;
  mat.clippingPlanes = [u.plane];
  mat.clipShadows = true;
}

let variantCounter = 0;

export function makeFilling(kind = 'octopus') {
  const group = new THREE.Group();
  const u = {
    uCut: { value: 0 },
    uCutPlane: { value: new THREE.Vector4(0, 0, 1, 1000) },
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5),
  };
  group.userData.cutU = u;
  group.userData.kind = kind;
  const mats = [];
  if (kind === 'cheese') {
    const g = geoCache.cheese || (geoCache.cheese = (() => {
      const gg = superBlob(0.5, 0.48, 0.52, 6, 3, 9, 0.05);
      gg.computeVertexNormals();
      return gg;
    })());
    const m = new THREE.MeshPhysicalMaterial({ color: '#f1cf6a', roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color('#fff2c0') });
    addCutFace(m, '#f6d978', u);
    mats.push(m);
    group.add(new THREE.Mesh(g, m));
  } else if (kind === 'sausage') {
    const g = geoCache.sausage || (geoCache.sausage = (() => {
      const gg = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 26, 2);
      // slightly rounded rim + uneven cut
      const p = gg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const r = Math.hypot(x, z);
        const ny = y + (r < 0.6 ? 0.02 * Math.sin(x * 7 + z * 5) : 0) * Math.sign(y);
        p.setY(i, ny * (r > 0.6 ? 0.92 : 1));
      }
      gg.computeVertexNormals();
      return gg;
    })());
    const casing = new THREE.MeshPhysicalMaterial({ color: '#a2442d', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    const cut = new THREE.MeshStandardMaterial({ color: '#df9c86', roughness: 0.6 });
    addCutFace(casing, '#e3a28d', u);
    addCutFace(cut, '#e3a28d', u);
    mats.push(casing, cut);
    const m = new THREE.Mesh(g, [casing, cut, cut]);
    m.rotation.x = 0.35;
    group.add(m);
  } else {
    const variant = variantCounter++ % 3;
    const { g, suckers } = octopusGeometry(variant);
    const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.25 });
    addCutFace(m, '#f4ece2', u);
    mats.push(m);
    group.add(new THREE.Mesh(g, m));
    const sm = new THREE.MeshStandardMaterial({ color: '#d9a4a0', roughness: 0.45 });
    addCutFace(sm, '#e9c9c4', u);
    mats.push(sm);
    for (const s of suckers) group.add(new THREE.Mesh(s, sm));
  }
  group.userData.mats = mats;
  group.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return group;
}
