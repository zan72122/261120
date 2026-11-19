// Overflow batter sheet around one hole ("skirt"). Thin irregular rounded-square patch on the plate; neighbouring patches merge into one sheet.
import * as THREE from 'three';
import { RIM_Y, HOLE_R, PITCH, COLS, ROWS, holeCenter } from '../config.js';
import { createTakoMaterial } from './material.js';
import { vnoise3 } from './noise.js';

const A = 60; // angular segments
const K = 6; // radial rings

let sharedIndex = null;
function getIndex() {
  if (sharedIndex) return sharedIndex;
  const idx = [];
  for (let k = 0; k < K - 1; k++) {
    for (let a = 0; a < A; a++) {
      const v00 = k * A + a, v01 = k * A + ((a + 1) % A), v10 = (k + 1) * A + a, v11 = (k + 1) * A + ((a + 1) % A);
      idx.push(v00, v01, v10, v01, v11, v10);
    }
  }
  sharedIndex = new THREE.BufferAttribute(new Uint16Array(idx), 1);
  return sharedIndex;
}

export function createSkirt(scene, index) {
  const c = holeCenter(index);
  const col = index % COLS, row = Math.floor(index / COLS);
  const geo = new THREE.BufferGeometry();
  geo.setIndex(getIndex());
  const pos = new Float32Array(K * A * 3);
  const nrm = new Float32Array(K * A * 3);
  const tako = new Float32Array(K * A * 3);
  const obj = new Float32Array(K * A * 3);
  for (let i = 0; i < K * A; i++) nrm[i * 3 + 1] = 1;
  const posA = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const takoA = new THREE.BufferAttribute(tako, 3).setUsage(THREE.DynamicDrawUsage);
  const objA = new THREE.BufferAttribute(obj, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA);
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aTako', takoA);
  geo.setAttribute('aObj', objA);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), PITCH);
  const mat = createTakoMaterial({ skirt: true });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -2;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(c.x, 0, c.z);
  mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.renderOrder = 1;
  scene.add(mesh);

  const outer = new Float32Array(A);
  const edgeN = new Float32Array(A);
  const ri = HOLE_R * 0.97;
  let seed = index * 31 + 7;

  function shapeOuter() {
    const half = PITCH * 0.6;
    for (let a = 0; a < A; a++) {
      const th = (a / A) * Math.PI * 2;
      const cx = Math.cos(th), sz = Math.sin(th);
      const n = 6;
      let r = half / Math.pow(Math.pow(Math.abs(cx), n) + Math.pow(Math.abs(sz), n), 1 / n);
      // spill less over the outer border of the grid
      if ((col === 0 && cx < -0.3) || (col === COLS - 1 && cx > 0.3) || (row === 0 && sz < -0.3) || (row === ROWS - 1 && sz > 0.3)) r = ri + (r - ri) * 0.6;
      const nz = vnoise3(cx * 2.2 + 5, sz * 2.2, seed * 0.37, seed) - 0.5;
      const nz2 = vnoise3(cx * 6.5, sz * 6.5 + 3, seed * 0.11, seed + 3) - 0.5;
      outer[a] = r * (1 + nz * 0.16 + nz2 * 0.07);
      edgeN[a] = nz2;
    }
  }
  shapeOuter();

  const st = { spread: -1, cook: -1, tuck: 0, version: 0 };

  function build(spread, cook, tuck) {
    const s = Math.max(0, Math.min(1, spread));
    const e = tuck * tuck * (3 - 2 * tuck);
    for (let k = 0; k < K; k++) {
      const f = k / (K - 1);
      for (let a = 0; a < A; a++) {
        const th = (a / A) * Math.PI * 2;
        const ro = ri + (outer[a] - ri) * (0.3 + 0.7 * Math.sqrt(s));
        let r = ri + (ro - ri) * f;
        let y = RIM_Y + 0.004 + index * 0.0012 + 0.1 * Math.pow(1 - f, 0.7) * (0.35 + 0.65 * s);
        if (k === K - 1) y = RIM_Y + 0.003 + index * 0.0012;
        r = r + (ri * 0.88 - r) * e;
        y = y + (RIM_Y - 0.03 - y) * e;
        const x = Math.cos(th) * r, z = Math.sin(th) * r;
        const i = (k * A + a) * 3;
        pos[i] = x; pos[i + 1] = y; pos[i + 2] = z;
        obj[i] = (x + c.x) * 0.476; obj[i + 1] = 1; obj[i + 2] = (z + c.z) * 0.476;
        // thin edge browns first (lacy brown border)
        const ck = cook * (1 + 0.38 * f * f) + edgeN[a] * 0.1 * f;
        tako[i] = Math.min(0.9, Math.max(0, ck));
        tako[i + 1] = 0;
        tako[i + 2] = 0;
      }
    }
    posA.needsUpdate = true;
    takoA.needsUpdate = true;
    objA.needsUpdate = true;
  }

  return {
    mesh,
    update(spread, cook, tuck) {
      const show = spread > 0.015 && tuck < 1;
      mesh.visible = show;
      if (!show) return;
      if (Math.abs(spread - st.spread) > 0.004 || Math.abs(cook - st.cook) > 0.006 || tuck !== st.tuck) {
        st.spread = spread; st.cook = cook; st.tuck = tuck;
        build(spread, cook, tuck);
      }
    },
    // world height of the sheet at (x,z) or -Infinity if outside
    heightAt(x, z, spread) {
      if (!mesh.visible) return -Infinity;
      const dx = x - c.x, dz = z - c.z;
      const r = Math.hypot(dx, dz);
      if (r < ri) return -Infinity;
      let th = Math.atan2(dz, dx);
      if (th < 0) th += Math.PI * 2;
      const a = Math.round((th / (Math.PI * 2)) * A) % A;
      const ro = ri + (outer[a] - ri) * (0.3 + 0.7 * Math.sqrt(Math.max(0, spread)));
      if (r > ro) return -Infinity;
      const f = (r - ri) / (ro - ri);
      return RIM_Y + 0.1 * Math.pow(1 - f, 0.7) * (0.35 + 0.65 * spread);
    },
    reset(newSeed) {
      seed = newSeed;
      shapeOuter();
      st.spread = -1;
      mesh.visible = false;
    },
  };
}
