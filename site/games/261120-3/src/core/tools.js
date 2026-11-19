// One active tool at a time: rests on the table, springs to the finger while held, returns on release.
import * as THREE from 'three';

const W_HELD = 28; // critically damped spring rate (≈0.17 s to arrive)
const W_REST = 15;
const W_GHOST = 14;
const SLIDE_IN = 0.7;
const SLIDE_OUT = 0.6;
const UP = new THREE.Vector3(0, 1, 0);

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;

// exact critically-damped step for one scalar component
function springStep(x, v, target, w, dt) {
  const d = x - target;
  const e = Math.exp(-w * dt);
  const k = v + w * d;
  return [target + (d + k * dt) * e, (v - k * w * dt) * e];
}

export function createTools(G) {
  const defs = {};
  const tv = new THREE.Vector3();
  const tq = new THREE.Quaternion();
  const tq2 = new THREE.Quaternion();
  const te = new THREE.Euler();
  const restPos = new THREE.Vector3();
  const restQuat = new THREE.Quaternion();
  const heldVel = new THREE.Vector3();
  const prevTarget = new THREE.Vector3();
  const slideTmp = new THREE.Vector3();
  const warned = new Set();
  let putTimer = -1;

  const tools = {
    active: null,
    held: false,
    ghost: false, // the hint ghost finger is "carrying" the tool (not a real touch: phases must not do work)
    target: new THREE.Vector3(),
    arrived: 0,
    swayFactor: 1, // set by hints
    ghostTarget: null, // Vector3 or null, set by hints
    defs,

    define(name, def) {
      const obj = def.object;
      defs[name] = {
        name,
        def,
        object: obj,
        mode: 'hidden', // hidden | slideIn | rest | held | slideOut
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        q: new THREE.Vector4(0, 0, 0, 1),
        qv: new THREE.Vector4(),
        t: 0,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        startQ: new THREE.Quaternion(),
        hop: 0,
        heldQuat: new THREE.Quaternion(),
        heldPos: new THREE.Vector3(),
      };
      if (obj) obj.visible = false;
      return defs[name];
    },

    bring(name, o = {}) {
      const d = defs[name];
      if (!d || !d.object) return;
      if (tools.active && tools.active !== name) tools.dismiss(tools.active);
      tools.active = name;
      tools.held = false;
      tools.arrived = 0;
      const obj = d.object;
      if (!obj.parent) G.scene.add(obj);
      obj.visible = true;
      readRest(d);
      const L = G.layout || {};
      const src = o.from || L.toolSlideFrom || tv.set(restPos.x + 30, 0, restPos.z);
      d.from.copy(src);
      d.from.y = restPos.y;
      d.mode = 'slideIn';
      d.t = 0;
      d.vel.set(0, 0, 0);
      d.qv.set(0, 0, 0, 0);
      d.pos.copy(d.from);
      setQ(d, restQuat);
      play('slide', { vol: 0.9 });
      writePose(d, d.pos, restQuat);
    },

    dismiss(name) {
      name = name || tools.active;
      const d = defs[name];
      if (!d) return;
      if (tools.active === name) {
        tools.active = null;
        tools.held = false;
        tools.arrived = 0;
      }
      if (d.mode === 'hidden' || d.mode === 'slideOut') return;
      d.mode = 'slideOut';
      d.t = 0;
      d.from.copy(d.object.position);
      const L = G.layout || {};
      d.to.copy(L.toolSlideFrom || tv.set(d.from.x + 30, 0, d.from.z));
      d.to.y = 0;
      d.startQ.copy(d.object.quaternion);
      play('slide', { vol: 0.6, pitch: 1.1 });
    },

    hop() {
      const d = defs[tools.active];
      if (d && (d.mode === 'rest') && d.hop <= 0) d.hop = 1e-4;
    },

    actionPoint(out = new THREE.Vector3()) {
      const d = defs[tools.active];
      if (!d || !d.object) return out.set(0, 0, 0);
      const a = d.object.userData && d.object.userData.action;
      if (a) out.copy(a);
      else out.set(0, 0, 0);
      d.object.updateMatrixWorld();
      return d.object.localToWorld(out);
    },

    // called by input (hints first, then tools, then phase)
    _pointer(kind, p) {
      const d = defs[tools.active];
      if (kind === 'down') {
        if (!d || d.mode === 'slideOut' || d.mode === 'hidden') return;
        tools.held = true;
        tools.target.copy(p.world);
        prevTarget.copy(p.world);
        heldVel.set(0, 0, 0);
        if (d.mode === 'slideIn') d.mode = 'held';
        d.mode = 'held';
        putTimer = -1;
        play('pick', { vol: 0.8 });
      } else if (kind === 'up') {
        if (tools.held && d && d.mode === 'held') {
          d.mode = 'rest';
          putTimer = 0.17;
        }
        tools.held = false;
        tools.arrived = 0;
      }
    },

    update(dt) {
      const time = G.time || 0;
      const P = G.input && G.input.pointer;
      if (tools.held && P) {
        // light smoothing of the finger target
        const k = 1 - Math.exp(-dt / 0.025);
        tools.target.lerp(P.world, k);
      }
      if (dt > 0) {
        tv.subVectors(tools.target, prevTarget).divideScalar(dt);
        heldVel.lerp(tv, 1 - Math.exp(-dt / 0.06));
      }
      prevTarget.copy(tools.target);
      tools.ghost = false;

      for (const name in defs) {
        const d = defs[name];
        if (!d.object) continue;
        try {
          step(d, dt, time, name === tools.active);
        } catch (e) {
          if (!warned.has(name)) {
            warned.add(name);
            console.warn('[tools] ' + name + ' failed:', e);
          }
        }
      }

      if (putTimer > 0) {
        putTimer -= dt;
        if (putTimer <= 0) play('put', { vol: 0.7 });
      }

      // focus light follows the protagonist
      const W = G.world;
      const a = defs[tools.active];
      if (W && typeof W.setFocus === 'function' && a) {
        try {
          if (tools.held) W.setFocus(tools.target);
          else W.setFocus(restPos);
        } catch (e) {
          /* ignore */
        }
      }
    },
  };

  function play(n, o) {
    try {
      G.audio && G.audio.play(n, o);
    } catch (e) {
      /* ignore */
    }
  }

  function readRest(d) {
    let r = null;
    try {
      r = d.def.rest ? d.def.rest() : null;
    } catch (e) {
      r = null;
    }
    if (r && r.pos) restPos.copy(r.pos);
    else restPos.copy((G.layout && G.layout.toolRest) || tv.set(0, 0, 20));
    if (r && r.quat) restQuat.copy(r.quat);
    else restQuat.setFromAxisAngle(UP, (r && r.yaw) || 0);
  }

  function setQ(d, q) {
    d.q.set(q.x, q.y, q.z, q.w);
    d.qv.set(0, 0, 0, 0);
  }

  function springQ(d, q, w, dt) {
    // keep in the same hemisphere
    if (d.q.x * q.x + d.q.y * q.y + d.q.z * q.z + d.q.w * q.w < 0) {
      d.q.multiplyScalar(-1);
      d.qv.multiplyScalar(-1);
    }
    let r;
    r = springStep(d.q.x, d.qv.x, q.x, w, dt); d.q.x = r[0]; d.qv.x = r[1];
    r = springStep(d.q.y, d.qv.y, q.y, w, dt); d.q.y = r[0]; d.qv.y = r[1];
    r = springStep(d.q.z, d.qv.z, q.z, w, dt); d.q.z = r[0]; d.qv.z = r[1];
    r = springStep(d.q.w, d.qv.w, q.w, w, dt); d.q.w = r[0]; d.qv.w = r[1];
    const l = d.q.length() || 1;
    d.q.multiplyScalar(1 / l);
  }

  function springP(d, p, w, dt) {
    let r;
    r = springStep(d.pos.x, d.vel.x, p.x, w, dt); d.pos.x = r[0]; d.vel.x = r[1];
    r = springStep(d.pos.y, d.vel.y, p.y, w, dt); d.pos.y = r[0]; d.vel.y = r[1];
    r = springStep(d.pos.z, d.vel.z, p.z, w, dt); d.pos.z = r[0]; d.vel.z = r[1];
  }

  function writePose(d, pos, quat) {
    d.object.position.copy(pos);
    d.object.quaternion.copy(quat);
    d.object.updateMatrixWorld();
  }

  // rest pose with idle sway (amplitude * swayFactor) and hop
  function swayPose(d, time, dt, outPos, outQuat) {
    const f = tools.swayFactor;
    const a = (2.5 * Math.PI) / 180 * f;
    te.set(Math.sin(time * 1.7 + 0.6) * a * 0.6, 0, Math.sin(time * 1.3) * a, 'XYZ');
    tq2.setFromEuler(te);
    outQuat.copy(restQuat).multiply(tq2);
    outPos.copy(restPos);
    outPos.y += (0.5 + 0.5 * Math.sin(time * 2.1)) * 0.15 * f;
    if (d.hop > 0) {
      d.hop += dt / 0.42;
      if (d.hop >= 1) d.hop = 0;
      else {
        const h = d.hop;
        outPos.y += Math.sin(h * Math.PI) * 1.6;
        te.set(Math.sin(h * Math.PI * 2) * 0.08, 0, Math.sin(h * Math.PI * 2) * -0.06, 'XYZ');
        outQuat.multiply(tq2.setFromEuler(te));
      }
    }
  }

  const goalPos = new THREE.Vector3();
  const goalQuat = new THREE.Quaternion();

  function heldPose(d, target, working) {
    let r = null;
    try {
      r = d.def.held ? d.def.held(target, { vel: heldVel, time: G.time || 0, working }) : null;
    } catch (e) {
      r = null;
    }
    if (r && r.pos) goalPos.copy(r.pos);
    else goalPos.copy(target);
    if (r && r.quat) goalQuat.copy(r.quat);
    else goalQuat.copy(restQuat);
  }

  function step(d, dt, time, isActive) {
    if (d.mode === 'hidden') return;
    if (isActive) readRest(d);

    if (d.mode === 'slideIn') {
      d.t += dt / SLIDE_IN;
      const k = Math.min(1, d.t);
      const e = easeOut(k);
      slideTmp.lerpVectors(d.from, restPos, e);
      // tiny settle at the end: a small tilt that relaxes
      const settle = Math.sin(Math.min(1, Math.max(0, (k - 0.75) / 0.25)) * Math.PI) * 0.035;
      te.set(0, 0, settle, 'XYZ');
      tq.copy(restQuat).multiply(tq2.setFromEuler(te));
      d.pos.copy(slideTmp);
      d.vel.set(0, 0, 0);
      setQ(d, tq);
      writePose(d, d.pos, tq);
      if (k >= 1) d.mode = 'rest';
      return;
    }

    if (d.mode === 'slideOut') {
      d.t += dt / SLIDE_OUT;
      const k = Math.min(1, d.t);
      slideTmp.lerpVectors(d.from, d.to, easeIn(k));
      slideTmp.y = d.from.y * (1 - Math.min(1, k * 3));
      tq.copy(d.startQ);
      writePose(d, slideTmp, tq);
      d.pos.copy(slideTmp);
      if (k >= 1) {
        d.mode = 'hidden';
        d.object.visible = false;
      }
      return;
    }

    if (d.mode === 'held' && isActive && tools.held) {
      let working = false;
      try {
        working = d.def.workWhile ? !!d.def.workWhile() : false;
      } catch (e) {
        working = false;
      }
      heldPose(d, tools.target, working);
      springP(d, goalPos, W_HELD, dt);
      springQ(d, goalQuat, W_HELD, dt);
      tq.set(d.q.x, d.q.y, d.q.z, d.q.w);
      writePose(d, d.pos, tq);
      const dist = d.pos.distanceTo(goalPos);
      const ang = tq.angleTo(goalQuat);
      tools.arrived = Math.max(0, Math.min(1, 1 - dist / 8 - ang / 1.2));
      return;
    }

    // rest (or ghost-carried)
    if (d.mode === 'held') d.mode = 'rest';
    if (isActive && tools.ghostTarget) {
      tools.ghost = true;
      heldPose(d, tools.ghostTarget, false);
      springP(d, goalPos, W_GHOST, dt);
      springQ(d, goalQuat, W_GHOST, dt);
    } else {
      swayPose(d, time, dt, goalPos, goalQuat);
      const w = d.hop > 0 ? 40 : W_REST;
      springP(d, goalPos, w, dt);
      springQ(d, goalQuat, w, dt);
    }
    tq.set(d.q.x, d.q.y, d.q.z, d.q.w);
    writePose(d, d.pos, tq);
  }

  return tools;
}
