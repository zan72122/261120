// Idle escalation: glow -> stronger sway/pulse -> tool hop + chime -> ghost finger demo.
import * as THREE from 'three';

const L1 = 3;
const L2 = 6.5;
const L3 = 10;
const HOP_EVERY = 3.5;
const DEMO_SPEED = 14; // cm/s
const GHOST_F = 0.72; // ghost is drawn at this fraction of the camera->point distance (reads as "on the glass")
const MAXPTS = 96;

const smooth = (t) => t * t * (3 - 2 * t);

export function createHints(G) {
  let cfg = null;
  let idle = 0;
  let level = 0;
  let nextHop = 0;
  let glowT = 0;
  const empty = [];

  // ghost demo state
  const ghost = { stage: 'off', t: 0, alpha: 0, len: 0, dur: 0, n: 0 };
  const px = new Float32Array(MAXPTS);
  const py = new Float32Array(MAXPTS);
  const pz = new Float32Array(MAXPTS);
  const acc = new Float32Array(MAXPTS);
  const pt = new THREE.Vector3();
  const disp = new THREE.Vector3();
  const tv = new THREE.Vector3();
  const box = new THREE.Box3();
  const ghostTarget = new THREE.Vector3();
  // finger direction in camera space: toward screen bottom-right and toward the viewer
  const FINGER_DIR = new THREE.Vector3(0.42, -0.5, 0.75).normalize();
  const Y = new THREE.Vector3(0, 1, 0);
  const dirW = new THREE.Vector3();
  let ghostMats = null;
  let ghostObj = null;

  const hints = {
    get level() {
      return level;
    },
    set(c) {
      cfg = c || null;
      idle = 0;
      level = 0;
      nextHop = L2;
      stopGhost(true);
    },
    clear() {
      cfg = null;
      idle = 0;
      level = 0;
      stopGhost(true);
      if (G.tools) G.tools.swayFactor = 1;
      try {
        G.fx && G.fx.glow(empty, 0);
      } catch (e) {
        /* ignore */
      }
    },
    poke() {
      idle = 0;
      level = 0;
      nextHop = L2;
      if (ghost.stage !== 'off') stopGhost(false);
    },
    _pointer(kind) {
      if (kind === 'down') {
        idle = 0;
        level = 0;
        nextHop = L2;
        stopGhost(false);
      }
    },
    update,
  };

  function call(fn) {
    if (typeof fn !== 'function') return null;
    try {
      return fn();
    } catch (e) {
      return null;
    }
  }

  function getGhost() {
    const o = G.world && G.world.props && G.world.props.ghostFinger;
    if (!o) return null;
    if (o !== ghostObj) {
      ghostObj = o;
      ghostMats = [];
      o.traverse((n) => {
        const ms = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
        for (const m of ms) {
          if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.opacity != null ? m.opacity : 1;
          m.transparent = true;
          ghostMats.push(m);
        }
        n.renderOrder = 999;
      });
      if (!o.parent) G.scene.add(o);
      o.userData.baseScale = o.scale.x || 1;
    }
    return o;
  }

  function setAlpha(a) {
    ghost.alpha = a;
    if (!ghostObj) return;
    for (const m of ghostMats) m.opacity = m.userData.baseOpacity * a;
    ghostObj.visible = a > 0.003;
  }

  function stopGhost(instant) {
    if (G.tools) G.tools.ghostTarget = null;
    if (ghost.stage === 'off') return;
    if (instant) {
      ghost.stage = 'off';
      setAlpha(0);
    } else {
      ghost.stage = 'vanish';
      ghost.t = 0;
    }
  }

  // build the path: tool centre (touch) -> demo polyline; arc-length table
  function buildPath() {
    const T = G.tools;
    const d = T && T.defs[cfg && cfg.tool ? cfg.tool : T.active];
    let n = 0;
    if (d && d.object && d.object.visible) {
      box.setFromObject(d.object);
      box.getCenter(tv);
      px[0] = tv.x;
      py[0] = tv.y;
      pz[0] = tv.z;
      n = 1;
    }
    const demo = call(cfg && cfg.demo);
    if (Array.isArray(demo)) {
      for (const v of demo) {
        if (n >= MAXPTS) break;
        if (!v || !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) continue;
        px[n] = v.x;
        py[n] = v.y;
        pz[n] = v.z;
        n++;
      }
    }
    if (n === 0) return false;
    acc[0] = 0;
    for (let i = 1; i < n; i++) {
      acc[i] = acc[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1], pz[i] - pz[i - 1]);
    }
    ghost.n = n;
    ghost.len = acc[n - 1];
    ghost.dur = ghost.len > 0.01 ? ghost.len / DEMO_SPEED + 0.5 : 0.5;
    return true;
  }

  function sample(s, out) {
    const n = ghost.n;
    if (n === 1 || s <= 0) return out.set(px[0], py[0], pz[0]);
    if (s >= ghost.len) return out.set(px[n - 1], py[n - 1], pz[n - 1]);
    let i = 1;
    while (i < n - 1 && acc[i] < s) i++;
    const seg = acc[i] - acc[i - 1] || 1;
    const k = (s - acc[i - 1]) / seg;
    return out.set(
      px[i - 1] + (px[i] - px[i - 1]) * k,
      py[i - 1] + (py[i] - py[i - 1]) * k,
      pz[i - 1] + (pz[i] - pz[i - 1]) * k
    );
  }

  // place the ghost so its pad is at world point w (+lift), drawn nearer to the camera so it reads "on top"
  function placeGhost(w, lift) {
    const o = ghostObj;
    if (!o) return;
    const cam = G.camera;
    pt.copy(w);
    pt.y += lift;
    disp.subVectors(pt, cam.position).multiplyScalar(GHOST_F).add(cam.position);
    o.position.copy(disp);
    dirW.copy(FINGER_DIR).applyQuaternion(cam.quaternion);
    o.quaternion.setFromUnitVectors(Y, dirW);
    // size it like a real fingertip on the glass: ~11 % of the short screen side wide (36..72 css px)
    const cv = G.renderer.domElement;
    const cw = cv.clientWidth || 390, ch = cv.clientHeight || 844;
    const dist = disp.distanceTo(cam.position);
    const pxPerCm = ch / (2 * Math.tan((cam.fov * Math.PI) / 360) * dist);
    const wantPx = Math.max(36, Math.min(72, Math.min(cw, ch) * 0.11));
    o.scale.setScalar((o.userData.baseScale * wantPx) / (pxPerCm * 1.56));
    o.updateMatrixWorld();
  }

  // ray camera->w intersected with the input plane: what the tool would follow for a real touch there
  function carryTarget(w) {
    const cam = G.camera;
    const py0 = (G.input && G.input.planeY) || 8;
    tv.subVectors(w, cam.position);
    if (tv.y > -1e-3) return ghostTarget.copy(w);
    const t = (py0 - cam.position.y) / tv.y;
    return ghostTarget.copy(cam.position).addScaledVector(tv, t);
  }

  function updateGhost(dt) {
    const T = G.tools;
    if (ghost.stage === 'off') {
      if (level >= 3 && cfg) {
        if (!getGhost() || !buildPath()) return;
        ghost.stage = 'in';
        ghost.t = 0;
        try {
          G.audio && G.audio.play('hint', { vol: 0.6 });
        } catch (e) {
          /* ignore */
        }
      } else return;
    }
    ghost.t += dt;
    const g = ghost;
    switch (g.stage) {
      case 'in': {
        sample(0, pt);
        placeGhost(pt, 3);
        setAlpha(smooth(Math.min(1, g.t / 0.35)));
        if (g.t >= 0.35) (g.stage = 'press'), (g.t = 0);
        break;
      }
      case 'press': {
        const k = smooth(Math.min(1, g.t / 0.25));
        sample(0, pt);
        placeGhost(pt, 3 * (1 - k));
        setAlpha(1);
        if (g.t >= 0.25) {
          g.stage = 'travel';
          g.t = 0;
          if (T) T.ghostTarget = carryTarget(pt);
        }
        break;
      }
      case 'travel': {
        const k = Math.min(1, g.t / g.dur);
        sample(smooth(k) * g.len, pt);
        placeGhost(pt, 0);
        if (T) T.ghostTarget = carryTarget(pt);
        if (k >= 1) (g.stage = 'lift'), (g.t = 0);
        break;
      }
      case 'lift': {
        const k = smooth(Math.min(1, g.t / 0.25));
        if (T) T.ghostTarget = null;
        sample(g.len, pt);
        placeGhost(pt, 3 * k);
        if (g.t >= 0.25) (g.stage = 'out'), (g.t = 0);
        break;
      }
      case 'out': {
        sample(g.len, pt);
        placeGhost(pt, 3);
        setAlpha(1 - smooth(Math.min(1, g.t / 0.35)));
        if (g.t >= 0.35) (g.stage = 'pause'), (g.t = 0), setAlpha(0);
        break;
      }
      case 'pause': {
        if (g.t >= 1.2) {
          g.stage = 'off'; // next frame re-samples the path and starts again (if still idle)
          g.t = 0;
        }
        break;
      }
      case 'vanish': {
        if (T) T.ghostTarget = null;
        setAlpha(Math.max(0, ghost.alpha - dt / 0.12));
        if (ghost.alpha <= 0) g.stage = 'off';
        break;
      }
      default:
        g.stage = 'off';
    }
  }

  function update(dt) {
    const T = G.tools;
    const down = !!(G.input && G.input.pointer);
    if (!cfg) {
      if (T) T.swayFactor += (1 - T.swayFactor) * Math.min(1, dt * 4);
      if (ghost.stage !== 'off') updateGhost(dt);
      return;
    }
    if (down) idle = 0;
    else idle += dt;
    level = idle >= L3 ? 3 : idle >= L2 ? 2 : idle >= L1 ? 1 : 0;

    // tool sway
    if (T) {
      const goal = level >= 1 ? 2.3 : 1;
      T.swayFactor += (goal - T.swayFactor) * Math.min(1, dt * 3);
    }

    // glow
    glowT += dt;
    const pts = call(cfg.targets);
    let s;
    if (down) s = 0.18;
    else if (level === 0) s = 0.32;
    else s = 0.55 + 0.35 * Math.sin(glowT * 4.2);
    try {
      G.fx && G.fx.glow(Array.isArray(pts) ? pts : empty, s);
    } catch (e) {
      /* ignore */
    }

    // hop + chime
    if (level === 2 && idle >= nextHop) {
      nextHop = idle + HOP_EVERY;
      if (T) T.hop();
      try {
        G.audio && G.audio.play('hint', { vol: 0.8 });
      } catch (e) {
        /* ignore */
      }
    }

    updateGhost(dt);
  }

  return hints;
}
