// Single-pointer input (Pointer Events). Extra touches are ignored.
// Dispatch order per event: hints -> tools -> current phase.
import * as THREE from 'three';
import { RIM_Y } from '../config.js';

const MAX_R = 60; // cm: world point is clamped within this radius (xz) of the camera frame centre

export function createInput(G) {
  const canvas = G.canvas;
  const raycaster = new THREE.Raycaster();
  const tmp = new THREE.Vector3();
  const prevWorld = new THREE.Vector3();
  const warned = new Set();

  const p = {
    id: -1,
    x: 0,
    y: 0,
    ndc: new THREE.Vector2(),
    ray: new THREE.Ray(),
    world: new THREE.Vector3(),
    delta: new THREE.Vector3(),
    speed: 0,
    down: false,
    t: 0,
  };
  let lastEvT = 0;
  let lastMoveT = 0;

  const input = {
    planeY: RIM_Y + 1,
    pointer: null,
    raycast(objects, recursive = true) {
      if (!input.pointer) return [];
      raycaster.ray.copy(p.ray);
      raycaster.near = 0;
      raycaster.far = 1000;
      try {
        return raycaster.intersectObjects(Array.isArray(objects) ? objects : [objects], recursive);
      } catch (e) {
        return [];
      }
    },
    update,
  };

  function guard(tag, fn) {
    try {
      fn();
    } catch (e) {
      if (!warned.has(tag)) {
        warned.add(tag);
        console.warn('[input] ' + tag + ' failed:', e);
      }
    }
  }

  // screen (css px) -> ndc, ray, world point on plane y = planeY
  function project(x, y) {
    const r = canvas.getBoundingClientRect();
    const w = r.width || window.innerWidth || 1;
    const h = r.height || window.innerHeight || 1;
    p.x = x - r.left;
    p.y = y - r.top;
    p.ndc.set((p.x / w) * 2 - 1, -(p.y / h) * 2 + 1);
    const cam = G.camera;
    cam.updateMatrixWorld();
    p.ray.origin.setFromMatrixPosition(cam.matrixWorld);
    p.ray.direction.set(p.ndc.x, p.ndc.y, 0.5).unproject(cam).sub(p.ray.origin).normalize();
    const c = (G.cam && G.cam.center) || tmp.set(0, 0, 0);
    const o = p.ray.origin;
    const d = p.ray.direction;
    const py = input.planeY;
    let hit = false;
    if (d.y < -1e-3) {
      const t = (py - o.y) / d.y;
      if (t > 0 && t < 2000) {
        p.world.copy(o).addScaledVector(d, t);
        hit = true;
      }
    }
    if (!hit) {
      // ray misses the plane (aims above the horizon): use the far clamp along the ray direction
      p.world.set(o.x + d.x * 1000, py, o.z + d.z * 1000);
    }
    const dx = p.world.x - c.x;
    const dz = p.world.z - c.z;
    const dist = Math.hypot(dx, dz);
    if (dist > MAX_R) {
      p.world.x = c.x + (dx / dist) * MAX_R;
      p.world.z = c.z + (dz / dist) * MAX_R;
    }
    p.world.y = py;
  }

  function dispatch(kind, name) {
    const H = G.hints;
    const T = G.tools;
    if (H && H._pointer) guard('hints.' + kind, () => H._pointer(kind, p));
    if (T && T._pointer) guard('tools.' + kind, () => T._pointer(kind, p));
    if (G.flow) guard('flow.' + kind, () => G.flow.dispatch(name, p));
  }

  function now() {
    return performance.now() / 1000;
  }

  function onDown(e) {
    if (e.cancelable) e.preventDefault();
    try {
      G.audio && G.audio.unlock();
    } catch (err) {
      /* audio failure must not matter */
    }
    if (input.pointer) return; // another finger is already active
    if (e.button != null && e.button > 0 && e.pointerType === 'mouse') return;
    p.id = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    project(e.clientX, e.clientY);
    prevWorld.copy(p.world);
    p.delta.set(0, 0, 0);
    p.speed = 0;
    p.down = true;
    p.t = G.time || 0;
    lastEvT = lastMoveT = now();
    input.pointer = p;
    dispatch('down', 'onDown');
  }

  function onMove(e) {
    if (!input.pointer || e.pointerId !== p.id) return;
    if (e.cancelable) e.preventDefault();
    moveTo(e.clientX, e.clientY);
    dispatch('move', 'onMove');
  }

  function moveTo(cx, cy) {
    prevWorld.copy(p.world);
    project(cx, cy);
    p.delta.subVectors(p.world, prevWorld);
    const t = now();
    const dtEv = Math.max(0.004, t - lastEvT);
    lastEvT = lastMoveT = t;
    const inst = Math.min(2000, p.delta.length() / dtEv);
    const k = 1 - Math.exp(-dtEv / 0.05);
    p.speed += (inst - p.speed) * k;
    p.t = G.time || 0;
  }

  function end(e) {
    if (!input.pointer) return;
    if (e && e.pointerId != null && e.pointerId !== p.id) return;
    if (e && e.type === 'pointerup' && e.clientX != null) {
      prevWorld.copy(p.world);
      project(e.clientX, e.clientY);
      p.delta.subVectors(p.world, prevWorld);
    }
    p.down = false;
    p.t = G.time || 0;
    const id = p.id;
    dispatch('up', 'onUp');
    input.pointer = null;
    p.id = -1;
    try {
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    } catch (err) {
      /* ignore */
    }
  }

  function onUp(e) {
    if (e.cancelable) e.preventDefault();
    try {
      G.audio && G.audio.unlock(); // iOS sometimes needs the touchend gesture
    } catch (err) {
      /* ignore */
    }
    end(e);
  }

  // per frame: the camera may move while the finger is still -> refresh world point, decay speed
  let lastX = 0;
  let lastY = 0;
  function update() {
    if (!input.pointer) return;
    const r = canvas.getBoundingClientRect();
    lastX = p.x + r.left;
    lastY = p.y + r.top;
    const before = tmp.copy(p.world);
    const bx = before.x;
    const bz = before.z;
    project(lastX, lastY);
    // keep delta meaningful only for events; just refresh position here
    if (Math.abs(p.world.x - bx) + Math.abs(p.world.z - bz) > 1e-4) prevWorld.copy(p.world);
    const idle = now() - lastMoveT;
    if (idle > 0.05) p.speed *= Math.exp(-(G.dt || 0.016) / 0.08);
  }

  const opt = { passive: false };
  canvas.addEventListener('pointerdown', onDown, opt);
  canvas.addEventListener('pointermove', onMove, opt);
  canvas.addEventListener('pointerup', onUp, opt);
  canvas.addEventListener('pointercancel', end, opt);
  canvas.addEventListener('lostpointercapture', end, opt);
  window.addEventListener('blur', () => end(null));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) end(null);
  });
  // also make the window-level move/up reach us if capture failed
  window.addEventListener('pointerup', (e) => end(e), opt);
  window.addEventListener('pointercancel', (e) => end(e), opt);

  return input;
}
