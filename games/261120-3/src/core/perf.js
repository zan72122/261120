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

// ---------- shader warm-up (in the background) ----------
// Compiling a program the first time a material shows up costs tens of ms on iOS (visible hitch at
// phase changes). Compiling all of them before the first frame, though, keeps the player waiting on a
// dark screen. So the first frame only compiles what it shows; afterwards this generator, stepped once
// per frame from the main loop, renders the remaining materials a few at a time (hidden props and one
// filling of each kind, with and without the bite clip plane) into a 1×1 viewport right before the real
// frame. Rendering through the real scene, lights and renderer keeps every program key identical to what
// the game will ask for later. Each step yields the time it took so the batch size adapts to the device.
const WARM_LAYER = 31;
const now = () => performance.now();

export function* warmUpGen(renderer, scene, camera, gate) {
  const vp = new THREE.Vector4();
  const isDrawable = (o) => (o.isMesh || o.isPoints || o.isLine || o.isSprite) && o.material;

  // one filling of each kind, with and without the clip plane, parked under the table (hidden between steps)
  const extra = new THREE.Group();
  extra.position.set(0, -500, 0);
  extra.visible = false;
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
      extra.add(f);
    }
    yield 0;
  }
  scene.add(extra);

  const lights = [];
  scene.traverse((o) => {
    if (o.isLight && !o.layers.isEnabled(WARM_LAYER)) {
      o.layers.enable(WARM_LAYER);
      lights.push(o);
    }
  });

  function renderBatch(objs, shadows) {
    const shown = [];
    const culled = [];
    const layered = [];
    for (const o of objs) {
      if (!o.layers.isEnabled(WARM_LAYER)) {
        o.layers.enable(WARM_LAYER);
        layered.push(o);
      }
      if (o.frustumCulled) {
        o.frustumCulled = false;
        culled.push(o);
      }
      for (let p = o; p; p = p.parent) {
        if (!p.visible) {
          p.visible = true;
          shown.push(p);
        }
      }
    }
    const mask = camera.layers.mask;
    const sm = renderer.shadowMap;
    const needs = sm.needsUpdate;
    const auto = sm.autoUpdate;
    const clip = renderer.localClippingEnabled;
    renderer.getViewport(vp);
    try {
      camera.layers.set(WARM_LAYER); // main pass: only the batch (and the lights, so program keys match)
      sm.autoUpdate = false;
      sm.needsUpdate = !!shadows;
      renderer.localClippingEnabled = true;
      renderer.setViewport(0, 0, 1, 1);
      if (shadows) scene.updateMatrixWorld();
      renderer.render(scene, camera);
    } finally {
      renderer.setViewport(vp.x, vp.y, vp.z, vp.w);
      renderer.localClippingEnabled = clip;
      camera.layers.mask = mask;
      sm.autoUpdate = auto;
      sm.needsUpdate = needs || !!shadows; // a shadow warm pass leaves a wrong map behind: redraw it
      for (const o of layered) o.layers.disable(WARM_LAYER);
      for (const o of culled) o.frustumCulled = true;
      for (const o of shown) o.visible = false;
    }
  }

  // materials in scene order (props are built in the order the phases use them)
  const byMat = new Map();
  scene.traverse((o) => {
    if (!isDrawable(o)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      let l = byMat.get(m);
      if (!l) byMat.set(m, (l = []));
      l.push(o);
    }
  });
  const compiled = (m) => !!renderer.properties.get(m).currentProgram;
  const list = [...byMat];
  let n = 2;
  let i = 0;
  while (i < list.length) {
    const batch = [];
    let mats = 0;
    while (mats < n && i < list.length) {
      const [m, objs] = list[i++];
      if (compiled(m)) continue;
      batch.push(...objs);
      mats++;
    }
    if (!batch.length) continue;
    const t = now();
    renderBatch(batch, false);
    const dt = now() - t;
    n = dt > 24 ? 1 : dt < 6 ? Math.min(n * 2, 8) : n;
    yield dt;
  }

  // depth programs of the shadow pass (clip planes, alpha test, ...): one shadow render with every caster shown
  const casters = [];
  scene.traverse((o) => {
    if (isDrawable(o) && o.castShadow) casters.push(o);
  });
  const t = now();
  renderBatch(casters, true); // the shadow pass also tests the main camera's layers
  if (gate) gate.invalidate();
  const dt = now() - t;

  scene.remove(extra);
  for (const l of lights) l.layers.disable(WARM_LAYER);
  // the warm-up materials are kept alive on purpose (disposing would release the cached programs)
  return dt;
}
