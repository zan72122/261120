// Rendering-performance helpers (no game logic): pixel budget, shadow-map update gating, shader warm-up.
import * as THREE from 'three';
import { makeFilling } from '../tako/filling.js';

// ---------- pixel budget ----------
// Large tablets at DPR 2 push 4–6 M pixels through heavy physical materials every frame.
// Start within this drawing-buffer budget; phones at DPR 2 (≈1.3–1.7 M px) are untouched,
// and dynamic resolution (main.js) still climbs to the full DPR when frames stay fast.
export const PIXEL_BUDGET = 3.0e6;
export function budgetScale(cssW, cssH, dprCap) {
  const px = Math.max(1, cssW * cssH);
  return Math.max(1, Math.min(dprCap, Math.sqrt(PIXEL_BUDGET / px)));
}

// ---------- shadow-map gating ----------
// The key light and its shadow camera never move; the shadow map only has to be re-rendered
// when a shadow caster moves, changes shape, appears or disappears. Each frame we write a compact
// snapshot of every visible caster (id, world matrix, geometry/instance versions, clip planes)
// and request a shadow update only when it differs from the previous frame.
export function createShadowGate(renderer, scene) {
  let buf = new Float64Array(4096);
  let len = 0;
  let n = 0;
  let changed = true;
  const put = (v) => {
    if (n >= buf.length) {
      const nb = new Float64Array(buf.length * 2);
      nb.set(buf);
      buf = nb;
      changed = true;
    }
    if (buf[n] !== v) {
      buf[n] = v;
      changed = true;
    }
    n++;
  };
  const visit = (o) => {
    if (!o.castShadow || !(o.isMesh || o.isPoints || o.isLine)) return;
    put(o.id);
    const e = o.matrixWorld.elements;
    for (let i = 0; i < 16; i++) put(e[i]);
    const g = o.geometry;
    if (g) {
      const p = g.attributes.position;
      put(p ? p.version : -1);
      put(g.index ? g.index.version : -1);
      put(g.drawRange.start);
      put(g.drawRange.count);
    }
    if (o.isInstancedMesh) {
      put(o.count);
      put(o.instanceMatrix.version);
    }
    const m = o.material;
    const ms = Array.isArray(m) ? m : m ? [m] : [];
    for (const mm of ms) {
      put(mm.version);
      const cp = mm.clippingPlanes;
      if (cp && mm.clipShadows) {
        for (const pl of cp) {
          put(pl.normal.x);
          put(pl.normal.y);
          put(pl.normal.z);
          put(pl.constant);
        }
      }
    }
  };
  const gate = {
    // call once per frame right before renderer.render(); updates world matrices itself
    update() {
      scene.updateMatrixWorld(); // the scene's own auto-update is switched off: this is the one pass per frame
      const sm = renderer.shadowMap;
      if (!sm.enabled) return;
      sm.autoUpdate = false;
      n = 0;
      scene.traverseVisible(visit);
      if (n !== len) changed = true;
      len = n;
      if (changed) sm.needsUpdate = true;
      changed = false;
    },
    invalidate() {
      changed = true;
      renderer.shadowMap.needsUpdate = true;
    },
  };
  return gate;
}

// ---------- shader warm-up ----------
// Compiling a program the first time a material shows up costs tens of ms on iOS (visible hitch at
// phase changes). Render one throw-away frame at boot with every object visible and unculled, plus
// one filling of each kind (with and without the bite clip plane), so every program exists up front.
// Rendering twice in the same task means only the real frame ever reaches the screen.
export function warmUp(renderer, scene, camera) {
  const touched = [];
  scene.traverse((o) => {
    if (!o.visible || o.frustumCulled) touched.push([o, o.visible, o.frustumCulled]);
  });
  for (const [o] of touched) {
    o.visible = true;
    o.frustumCulled = false;
  }
  const extra = new THREE.Group();
  extra.position.set(0, -500, 0); // under the table: irrelevant for the image, still rendered (unculled)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);
  for (const kind of ['octopus', 'cheese', 'sausage']) {
    for (const clip of [false, true]) {
      let f;
      try {
        f = makeFilling(kind, { variant: 0 });
      } catch (e) {
        continue;
      }
      if (clip) for (const m of f.userData.mats) m.clippingPlanes = [plane];
      f.traverse((o) => {
        o.frustumCulled = false;
      });
      extra.add(f);
    }
  }
  scene.add(extra);
  const prevClip = renderer.localClippingEnabled;
  renderer.localClippingEnabled = true;
  try {
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  } finally {
    renderer.localClippingEnabled = prevClip;
    scene.remove(extra);
    for (const [o, v, fc] of touched) {
      o.visible = v;
      o.frustumCulled = fc;
    }
    // materials are kept alive on purpose (disposing would release the cached programs)
    renderer.shadowMap.needsUpdate = true;
  }
}
