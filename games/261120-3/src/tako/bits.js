// Toppings as pooled InstancedMeshes: they fall, land on the first surface below and stick to their owner.
// Flakes (katsuobushi) are bent in the vertex shader so landed ones "dance" in the heat without CPU cost.
import * as THREE from 'three';
import { RIM_Y, HOTPLATE, PLATTER } from '../config.js';
import { getFlakeTexture } from './textures.js';
import { mulberry } from './noise.js';

const KINDS = ['negi', 'tenkasu', 'beni', 'flake', 'aonori', 'mayo'];
const CAPS = { negi: 200, tenkasu: 120, beni: 100, flake: 260, aonori: 300, mayo: 520 };

// owner types
const O_NONE = 0, O_BALL = 1, O_PLATTER = 2, O_SKIRT = 3;
// states
const FREE = 0, FALL = 1, LAND = 2;

const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _n = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function negiGeo() {
  const g = new THREE.TorusGeometry(0.12, 0.045, 4, 12);
  g.rotateX(Math.PI / 2);
  g.scale(1, 0.45, 1);
  return g;
}
function tenkasuGeo() {
  const g = new THREE.IcosahedronGeometry(0.15, 1);
  const p = g.attributes.position;
  const r = mulberry(5);
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, 0.7 + r() * 0.6);
    const s = map.get(k);
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.7, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}
function beniGeo() {
  const g = new THREE.BoxGeometry(0.55, 0.07, 0.1, 4, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.08 * p.getX(i) * p.getX(i) * 4 * 0.5);
  g.computeVertexNormals();
  return g;
}
function aonoriGeo() {
  const g = new THREE.CircleGeometry(0.07, 5);
  g.rotateX(-Math.PI / 2);
  return g;
}
function mayoGeo() {
  const g = new THREE.SphereGeometry(0.25, 16, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.09 * Math.cos(a * 8) * Math.min(1, Math.hypot(x, z) / 0.25);
    p.setXYZ(i, x * k * 1.05, Math.max(-0.05, y * 0.62), z * k);
  }
  g.computeVertexNormals();
  return g;
}
function flakeGeo() {
  const g = new THREE.PlaneGeometry(1, 1, 8, 3);
  g.rotateX(-Math.PI / 2);
  g.translate(0.5, 0, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) + 0.5, p.getX(i));
  return g;
}

const FLAKE_V_HEAD = /* glsl */ `
attribute vec4 aFl; // phase, amplitude, base curl, twist
uniform float uTime;
`;
const FLAKE_V_NORMAL = /* glsl */ `
#include <beginnormal_vertex>
float flT = position.x;
float flK = aFl.z + aFl.y * (0.9 * sin(uTime * 6.3 + aFl.x + flT * 2.6) + 0.45 * sin(uTime * 10.7 + aFl.x * 1.9));
float flA = flK * flT;
float flTw = aFl.w + aFl.y * 0.5 * sin(uTime * 8.1 + aFl.x * 2.3) * flT;
float flC = cos(flTw), flS = sin(flTw);
vec3 flN = vec3(-sin(flA), cos(flA), 0.0);
flN = vec3(flN.x, flN.y * flC - flN.z * flS, flN.y * flS + flN.z * flC);
objectNormal = flN;
`;
const FLAKE_V_BEGIN = /* glsl */ `
#include <begin_vertex>
{
  vec3 p = position;
  if (abs(flK) > 1e-3) { p.x = sin(flA) / flK; p.y = (1.0 - cos(flA)) / flK; }
  else { p.x = flT; p.y = 0.0; }
  // twist about the length axis, then add the width offset rotated
  vec3 w = vec3(0.0, -flS * position.z, flC * position.z);
  // crinkled ruffle across the width
  float rf = 0.06 * sin(position.z * 9.0 + flT * 11.0 + aFl.x) * (0.4 + flT);
  transformed = vec3(p.x, p.y, 0.0) + w + vec3(-sin(flA), cos(flA), 0.0) * (0.015 + rf);
}
`;

export function createBits(G, balls) {
  const scene = G.scene;
  const uTime = { value: 0 };
  const pools = {};

  const makeMat = (kind) => {
    switch (kind) {
      case 'negi': return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 });
      case 'tenkasu': return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, flatShading: true });
      case 'beni': return new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      case 'aonori': return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
      case 'mayo': return new THREE.MeshPhysicalMaterial({ color: '#f5edd3', roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.12, sheen: 0.2, sheenColor: new THREE.Color('#fffbe8') });
      case 'flake': {
        const m = new THREE.MeshStandardMaterial({
          map: getFlakeTexture(), color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide, alphaTest: 0.45,
          emissive: new THREE.Color('#5a2c18'), emissiveIntensity: 0.35,
        });
        m.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = uTime;
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\n' + FLAKE_V_HEAD)
            .replace('#include <beginnormal_vertex>', FLAKE_V_NORMAL)
            .replace('#include <begin_vertex>', FLAKE_V_BEGIN);
        };
        m.customProgramCacheKey = () => 'tako-flake-v1';
        return m;
      }
    }
  };
  const makeGeo = { negi: negiGeo, tenkasu: tenkasuGeo, beni: beniGeo, aonori: aonoriGeo, mayo: mayoGeo, flake: flakeGeo };

  for (const kind of KINDS) {
    const cap = CAPS[kind];
    const geo = makeGeo[kind]();
    let flA = null;
    if (kind === 'flake') {
      flA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFl', flA);
    }
    const mesh = new THREE.InstancedMesh(geo, makeMat(kind), cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = kind === 'mayo';
    mesh.receiveShadow = true;
    mesh.count = 0;
    mesh.name = 'bits-' + kind;
    for (let i = 0; i < cap; i++) mesh.setMatrixAt(i, ZERO);
    if (kind !== 'mayo' && kind !== 'flake') {
      for (let i = 0; i < cap; i++) mesh.setColorAt(i, _c.set(0xffffff));
    }
    scene.add(mesh);
    pools[kind] = {
      kind, cap, mesh, flA,
      state: new Uint8Array(cap),
      born: new Float32Array(cap),
      p: new Float32Array(cap * 3),
      vel: new Float32Array(cap * 3),
      rq: new Float32Array(cap * 4), // world rotation while falling
      av: new Float32Array(cap * 3), // angular velocity
      sc: new Float32Array(cap * 3),
      owner: new Int8Array(cap),
      oi: new Int16Array(cap),
      vi: new Int16Array(cap),
      off: new Float32Array(cap * 3),
      lq: new Float32Array(cap * 4), // rotation in the owner frame
      boost: new Float32Array(cap),
      ph: new Float32Array(cap),
      falling: 0,
      high: 0,
      dirty: false,
    };
  }

  let rnd = Math.random;
  const ballStamp = new Float64Array(balls.length);
  const ballChanged = new Uint8Array(balls.length);
  let platterStamp = 0, platterChanged = false;
  const platterInv = new THREE.Matrix4();

  const getPlatter = () => {
    const p = G.world?.props?.platter;
    return p && p.visible !== false ? p : null;
  };

  function alloc(P, wantFalling) {
    if (wantFalling) {
      const lim = Math.max(8, Math.floor(P.cap * (G.quality?.particleScale ?? 1)));
      if (P.falling >= lim) return -1;
    }
    for (let i = 0; i < P.cap; i++) if (P.state[i] === FREE) return i;
    // recycle oldest non-owned, else oldest overall
    let best = -1, bt = Infinity, best2 = -1, bt2 = Infinity;
    for (let i = 0; i < P.cap; i++) {
      if (P.owner[i] !== O_BALL && P.born[i] < bt) { bt = P.born[i]; best = i; }
      if (P.born[i] < bt2) { bt2 = P.born[i]; best2 = i; }
    }
    const i = best >= 0 ? best : best2;
    freeBit(P, i);
    return i;
  }

  function freeBit(P, i) {
    if (P.state[i] === FALL) P.falling--;
    P.state[i] = FREE;
    P.owner[i] = O_NONE;
    P.mesh.setMatrixAt(i, ZERO);
    P.dirty = true;
  }

  function setScale(P, i) {
    const k = P.kind;
    let x = 1, y = 1, z = 1;
    if (k === 'negi') { const s = 0.75 + rnd() * 0.6; x = s; y = 0.8 + rnd() * 0.5; z = s * (0.85 + rnd() * 0.3); }
    else if (k === 'tenkasu') { const s = 0.6 + rnd() * 0.9; x = s * (0.8 + rnd() * 0.5); y = s * (0.6 + rnd() * 0.5); z = s; }
    else if (k === 'beni') { x = 0.6 + rnd() * 0.7; y = 1; z = 0.7 + rnd() * 0.6; }
    else if (k === 'aonori') { const s = 0.5 + rnd() * 1.0; x = s; y = 1; z = s * (0.6 + rnd() * 0.6); }
    else if (k === 'mayo') { const s = 0.92 + rnd() * 0.16; x = s; y = s * (0.9 + rnd() * 0.2); z = s; }
    else if (k === 'flake') { const len = 1.25 + rnd() * 1.0; x = len; y = len; z = 0.62 + rnd() * 0.5; }
    P.sc[i * 3] = x; P.sc[i * 3 + 1] = y; P.sc[i * 3 + 2] = z;
  }

  function setColor(P, i) {
    const k = P.kind;
    if (k === 'negi') {
      const t = rnd();
      _c.set(t < 0.7 ? '#4f8f2c' : t < 0.88 ? '#86b04a' : '#d9e8b0').offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.08);
    } else if (k === 'tenkasu') _c.set('#e3b15a').offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.14);
    else if (k === 'beni') _c.set(rnd() < 0.5 ? '#d9223f' : '#e8485f').offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
    else if (k === 'aonori') _c.set(rnd() < 0.5 ? '#27501a' : '#3a6a22');
    else return;
    P.mesh.setColorAt(i, _c);
    if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true;
  }

  function initFlake(P, i) {
    if (!P.flA) return;
    const a = P.flA.array;
    a[i * 4] = rnd() * 20;
    a[i * 4 + 1] = 0.5;
    a[i * 4 + 2] = 0.6 + rnd() * 1.6;
    a[i * 4 + 3] = (rnd() - 0.5) * 0.9;
    P.ph[i] = a[i * 4 + 2];
    P.flA.needsUpdate = true;
  }

  function writeFalling(P, i) {
    _q.set(P.rq[i * 4], P.rq[i * 4 + 1], P.rq[i * 4 + 2], P.rq[i * 4 + 3]);
    _v.set(P.p[i * 3], P.p[i * 3 + 1], P.p[i * 3 + 2]);
    _s.set(P.sc[i * 3], P.sc[i * 3 + 1], P.sc[i * 3 + 2]);
    _m.compose(_v, _q, _s);
    P.mesh.setMatrixAt(i, _m);
    P.dirty = true;
  }

  function writeLanded(P, i) {
    _s.set(P.sc[i * 3], P.sc[i * 3 + 1], P.sc[i * 3 + 2]);
    _q.set(P.lq[i * 4], P.lq[i * 4 + 1], P.lq[i * 4 + 2], P.lq[i * 4 + 3]);
    const o = P.owner[i];
    if (o === O_BALL) {
      const b = balls[P.oi[i]];
      const vi = P.vi[i];
      const pos = b._pos;
      _v.set(pos[vi * 3] + P.off[i * 3], pos[vi * 3 + 1] + P.off[i * 3 + 1], pos[vi * 3 + 2] + P.off[i * 3 + 2]);
      _m.compose(_v, _q, _s);
      _m.premultiply(b.mesh.matrixWorld);
      if (!b.group.visible || !b.mesh.visible) _m.copy(ZERO);
    } else if (o === O_PLATTER) {
      const pl = getPlatter();
      _v.set(P.off[i * 3], P.off[i * 3 + 1], P.off[i * 3 + 2]);
      _m.compose(_v, _q, _s);
      if (pl) _m.premultiply(pl.matrixWorld);
      else _m.copy(ZERO);
    } else {
      _v.set(P.off[i * 3], P.off[i * 3 + 1], P.off[i * 3 + 2]);
      _m.compose(_v, _q, _s);
    }
    P.mesh.setMatrixAt(i, _m);
    P.dirty = true;
  }

  // surface below a falling point. Returns height and fills hit info.
  const hit = { y: 0, type: O_NONE, ball: null };
  function surfaceBelow(x, z, yMax) {
    hit.y = 0; hit.type = O_NONE; hit.ball = null; hit.table = true;
    let best = 0;
    if (Math.abs(x) < HOTPLATE.w / 2 && Math.abs(z) < HOTPLATE.d / 2) { best = RIM_Y; hit.table = false; }
    for (let k = 0; k < balls.length; k++) {
      const b = balls[k];
      if (b.mode === 'gone' || !b.group.visible) continue;
      const sh = b.mode === 'hole' ? b.skirtHeightAt(x, z) : -Infinity;
      if (sh > best && sh <= yMax) { best = sh; hit.type = O_SKIRT; hit.ball = b; hit.table = false; }
      const e = b.mesh.matrixWorld.elements;
      if (Math.abs(x - e[12]) > 2.4 || Math.abs(z - e[14]) > 2.4) continue;
      const tp = b.topPointAt(x, z, _v2);
      if (tp && tp.y > best && tp.y <= yMax + 0.6) { best = tp.y; hit.type = O_BALL; hit.ball = b; hit.table = false; }
    }
    const pl = getPlatter();
    if (pl) {
      _v2.set(x, 0, z).applyMatrix4(platterInv);
      if (Math.abs(_v2.x) < PLATTER.w / 2 - 0.4 && Math.abs(_v2.z) < PLATTER.d / 2 - 0.4) {
        const py = pl.matrixWorld.elements[13] + PLATTER.surfaceY;
        if (py > best && py <= yMax + 0.1) { best = py; hit.type = O_PLATTER; hit.ball = null; hit.table = false; }
      }
    }
    hit.y = best;
    return hit;
  }

  // attach bit i at world point wp with world normal n
  function attach(P, i, wp, n, type, ball) {
    // orientation: local y along normal, random yaw
    _q.setFromUnitVectors(UP, n);
    _q2.setFromAxisAngle(UP, rnd() * Math.PI * 2);
    _q.multiply(_q2);
    if (P.kind === 'tenkasu') { _e.set((rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6); _q.multiply(_q2.setFromEuler(_e)); }
    if (P.kind === 'beni' || P.kind === 'negi') { _e.set((rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4); _q.multiply(_q2.setFromEuler(_e)); }
    if (P.state[i] === FALL) P.falling--;
    P.state[i] = LAND;
    P.owner[i] = type;
    const lift = P.kind === 'mayo' ? -0.02 : P.kind === 'flake' ? 0.01 : 0.02;
    _v.copy(wp).addScaledVector(n, lift);
    if (type === O_BALL && ball) {
      ball.mesh.updateWorldMatrix(true, false);
      _m2.copy(ball.mesh.matrixWorld).invert();
      _v.applyMatrix4(_m2);
      const vi = ball.nearestVertex(_v.x, _v.y, _v.z);
      const pos = ball._pos;
      P.oi[i] = ball.index;
      P.vi[i] = vi;
      P.off[i * 3] = _v.x - pos[vi * 3];
      P.off[i * 3 + 1] = _v.y - pos[vi * 3 + 1];
      P.off[i * 3 + 2] = _v.z - pos[vi * 3 + 2];
      ball.mesh.getWorldQuaternion(_q2).invert();
      _q.premultiply(_q2);
    } else if (type === O_PLATTER) {
      _v.applyMatrix4(platterInv);
      const pl = getPlatter();
      if (pl) { pl.getWorldQuaternion(_q2).invert(); _q.premultiply(_q2); }
      P.off[i * 3] = _v.x; P.off[i * 3 + 1] = _v.y; P.off[i * 3 + 2] = _v.z;
    } else {
      if (type === O_SKIRT && ball) P.oi[i] = ball.index;
      P.off[i * 3] = _v.x; P.off[i * 3 + 1] = _v.y; P.off[i * 3 + 2] = _v.z;
    }
    P.lq[i * 4] = _q.x; P.lq[i * 4 + 1] = _q.y; P.lq[i * 4 + 2] = _q.z; P.lq[i * 4 + 3] = _q.w;
    P.born[i] = G.time || 0;
    writeLanded(P, i);
  }

  function ballNormal(ball, wp, out) {
    // vertex normal at the landing point, world frame
    ball.mesh.updateWorldMatrix(true, false);
    _m2.copy(ball.mesh.matrixWorld).invert();
    _v2.copy(wp).applyMatrix4(_m2);
    const vi = ball.nearestVertex(_v2.x, _v2.y, _v2.z);
    const nr = ball._nrm;
    out.set(nr[vi * 3], nr[vi * 3 + 1], nr[vi * 3 + 2]);
    ball.mesh.getWorldQuaternion(_q2);
    return out.applyQuaternion(_q2).normalize();
  }

  const bits = {
    emit(kind, worldPos, vel) {
      const P = pools[kind];
      if (!P || !worldPos) return -1;
      const i = alloc(P, true);
      if (i < 0) return -1;
      P.state[i] = FALL;
      P.falling++;
      P.owner[i] = O_NONE;
      P.born[i] = G.time || 0;
      P.p[i * 3] = worldPos.x; P.p[i * 3 + 1] = worldPos.y; P.p[i * 3 + 2] = worldPos.z;
      const vx = vel ? vel.x : (rnd() - 0.5) * 4, vy = vel ? vel.y : -rnd() * 5, vz = vel ? vel.z : (rnd() - 0.5) * 4;
      P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
      _q.setFromEuler(_e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
      P.rq[i * 4] = _q.x; P.rq[i * 4 + 1] = _q.y; P.rq[i * 4 + 2] = _q.z; P.rq[i * 4 + 3] = _q.w;
      const spin = kind === 'flake' ? 2.5 : 9;
      P.av[i * 3] = (rnd() - 0.5) * spin; P.av[i * 3 + 1] = (rnd() - 0.5) * spin; P.av[i * 3 + 2] = (rnd() - 0.5) * spin;
      P.boost[i] = 0;
      setScale(P, i);
      setColor(P, i);
      initFlake(P, i);
      if (i >= P.high) { P.high = i + 1; P.mesh.count = P.high; }
      writeFalling(P, i);
      return i;
    },

    place(kind, worldPos, normal, ownerBall = null) {
      const P = pools[kind];
      if (!P || !worldPos) return -1;
      const i = alloc(P, false);
      if (i < 0) return -1;
      setScale(P, i);
      setColor(P, i);
      initFlake(P, i);
      if (i >= P.high) { P.high = i + 1; P.mesh.count = P.high; }
      _n.copy(normal || UP).normalize();
      let type = O_NONE;
      if (ownerBall) type = O_BALL;
      else {
        refreshPlatter();
        const h = surfaceBelow(worldPos.x, worldPos.z, worldPos.y + 0.5);
        if (h.type === O_PLATTER) type = O_PLATTER;
        else if (h.type === O_BALL) { type = O_BALL; ownerBall = h.ball; }
      }
      attach(P, i, worldPos, _n, type, ownerBall);
      return i;
    },

    countOn(ball, kind) {
      const P = pools[kind];
      if (!P || !ball) return 0;
      let n = 0;
      for (let i = 0; i < P.high; i++) if (P.state[i] === LAND && P.owner[i] === O_BALL && P.oi[i] === ball.index) n++;
      return n;
    },

    disturb(worldPos, radius = 2) {
      const P = pools.flake;
      const r2 = radius * radius;
      let lifted = 0;
      const e = P.mesh.instanceMatrix.array;
      for (let i = 0; i < P.high; i++) {
        if (P.state[i] !== LAND) continue;
        const dx = e[i * 16 + 12] - worldPos.x, dy = e[i * 16 + 13] - worldPos.y, dz = e[i * 16 + 14] - worldPos.z;
        if (dx * dx + dy * dy + dz * dz < r2) {
          P.boost[i] = 1;
          if (lifted < 2 && rnd() < 0.35) {
            lifted++;
            P.state[i] = FALL;
            P.falling++;
            P.owner[i] = O_NONE;
            P.p[i * 3] = e[i * 16 + 12]; P.p[i * 3 + 1] = e[i * 16 + 13] + 0.3; P.p[i * 3 + 2] = e[i * 16 + 14];
            P.vel[i * 3] = (rnd() - 0.5) * 12; P.vel[i * 3 + 1] = 22 + rnd() * 14; P.vel[i * 3 + 2] = (rnd() - 0.5) * 12;
            _m.fromArray(e, i * 16);
            _m.decompose(_v, _q, _s);
            P.rq[i * 4] = _q.x; P.rq[i * 4 + 1] = _q.y; P.rq[i * 4 + 2] = _q.z; P.rq[i * 4 + 3] = _q.w;
            P.av[i * 3] = (rnd() - 0.5) * 6; P.av[i * 3 + 1] = (rnd() - 0.5) * 6; P.av[i * 3 + 2] = (rnd() - 0.5) * 6;
          }
        }
      }
    },

    removeOwner(ball) {
      if (!ball) return;
      for (const k of KINDS) {
        const P = pools[k];
        for (let i = 0; i < P.high; i++) {
          if (P.state[i] !== FREE && (P.owner[i] === O_BALL || P.owner[i] === O_SKIRT) && P.oi[i] === ball.index) freeBit(P, i);
        }
      }
    },

    removeSkirtOwner(ball) {
      for (const k of KINDS) {
        const P = pools[k];
        for (let i = 0; i < P.high; i++) if (P.state[i] === LAND && P.owner[i] === O_SKIRT && P.oi[i] === ball.index) freeBit(P, i);
      }
    },

    // a ball left its hole: stray bits that were resting on the batter there must not stay floating over the empty hole
    removeNear(x, z, r) {
      const r2 = r * r;
      for (const k of KINDS) {
        const P = pools[k];
        const e = P.mesh.instanceMatrix.array;
        for (let i = 0; i < P.high; i++) {
          if (P.state[i] !== LAND || P.owner[i] === O_BALL) continue;
          const dx = e[i * 16 + 12] - x, dz = e[i * 16 + 14] - z;
          if (dx * dx + dz * dz < r2 && e[i * 16 + 13] > 3) freeBit(P, i);
        }
      }
    },

    // hide bits of a bitten ball that sit on the removed side of the plane
    cullOwner(ball, plane) {
      for (const k of KINDS) {
        const P = pools[k];
        const e = P.mesh.instanceMatrix.array;
        for (let i = 0; i < P.high; i++) {
          if (P.state[i] === LAND && P.owner[i] === O_BALL && P.oi[i] === ball.index) {
            _v.set(e[i * 16 + 12], e[i * 16 + 13], e[i * 16 + 14]);
            if (plane.distanceToPoint(_v) < 0.05) freeBit(P, i);
          }
        }
      }
    },

    clear() {
      for (const k of KINDS) {
        const P = pools[k];
        for (let i = 0; i < P.cap; i++) { P.state[i] = FREE; P.owner[i] = O_NONE; P.mesh.setMatrixAt(i, ZERO); }
        P.falling = 0;
        P.high = 0;
        P.mesh.count = 0;
        P.mesh.instanceMatrix.needsUpdate = true;
      }
    },

    update(dt) {
      const t = G.time || 0;
      uTime.value = t;
      // owner change detection
      for (let k = 0; k < balls.length; k++) {
        const b = balls[k];
        b.mesh.updateWorldMatrix(true, false);
        const e = b.mesh.matrixWorld.elements;
        let s = b.version * 1.618 + (b.group.visible ? 0 : 7.7);
        for (let j = 0; j < 16; j++) s += e[j] * (j + 1.37);
        ballChanged[k] = s !== ballStamp[k] ? 1 : 0;
        ballStamp[k] = s;
      }
      refreshPlatter();
      const dtc = Math.min(dt, 0.05);
      for (const kind of KINDS) {
        const P = pools[kind];
        const isFlake = kind === 'flake';
        const fa = P.flA ? P.flA.array : null;
        let flDirty = false;
        for (let i = 0; i < P.high; i++) {
          const stt = P.state[i];
          if (stt === FALL) {
            const i3 = i * 3;
            const py0 = P.p[i3 + 1];
            if (isFlake) {
              // slow fluttering descent with sway
              const ph = P.ph[i] * 3 + i;
              P.vel[i3 + 1] += (-9 - P.vel[i3 + 1]) * Math.min(1, dtc * (P.vel[i3 + 1] > 0 ? 2.5 : 4)) - (P.vel[i3 + 1] > 0 ? 300 * dtc : 0);
              P.vel[i3] += (Math.sin(t * 3.1 + ph) * 9 - P.vel[i3]) * Math.min(1, dtc * 2.2);
              P.vel[i3 + 2] += (Math.cos(t * 2.3 + ph * 1.3) * 7 - P.vel[i3 + 2]) * Math.min(1, dtc * 2.2);
              if (fa) { fa[i * 4 + 1] = 0.6; flDirty = true; }
            } else {
              const drag = kind === 'aonori' ? 3 : 1.4;
              P.vel[i3 + 1] -= (kind === 'aonori' ? 450 : 700) * dtc;
              const f = Math.exp(-drag * dtc);
              P.vel[i3] *= f; P.vel[i3 + 1] *= f; P.vel[i3 + 2] *= f;
            }
            P.p[i3] += P.vel[i3] * dtc; P.p[i3 + 1] += P.vel[i3 + 1] * dtc; P.p[i3 + 2] += P.vel[i3 + 2] * dtc;
            // tumble
            _q.set(P.rq[i * 4], P.rq[i * 4 + 1], P.rq[i * 4 + 2], P.rq[i * 4 + 3]);
            _v.set(P.av[i3], P.av[i3 + 1], P.av[i3 + 2]);
            const al = _v.length();
            if (al > 1e-4) { _q2.setFromAxisAngle(_v.multiplyScalar(1 / al), al * dtc); _q.premultiply(_q2); }
            P.rq[i * 4] = _q.x; P.rq[i * 4 + 1] = _q.y; P.rq[i * 4 + 2] = _q.z; P.rq[i * 4 + 3] = _q.w;
            // landing
            const x = P.p[i3], z = P.p[i3 + 2], y = P.p[i3 + 1];
            if (P.vel[i3 + 1] <= 0) {
              const h = surfaceBelow(x, z, py0 + 0.05);
              if (y <= h.y + 0.02) {
                _v.set(x, h.y, z);
                if (h.type === O_BALL) ballNormal(h.ball, _v, _n);
                else _n.copy(UP);
                attach(P, i, _v, _n, h.type, h.ball);
                if (isFlake && fa) {
                  // drape over a ball (bend with its curvature), lie looser on flat ground
                  fa[i * 4 + 2] = h.type === O_BALL ? -(P.sc[i * 3] / 2.1) * 0.95 + rnd() * 0.45 : 0.2 + rnd() * 0.9;
                  flDirty = true;
                }
                continue;
              }
            }
            if (y < -5) { freeBit(P, i); continue; }
            writeFalling(P, i);
          } else if (stt === LAND) {
            const o = P.owner[i];
            if ((o === O_BALL && ballChanged[P.oi[i]]) || (o === O_PLATTER && platterChanged)) writeLanded(P, i);
            if (isFlake && fa) {
              let heat = 0.05;
              if (o === O_BALL) { const b = balls[P.oi[i]]; heat = b.heat > 0.15 ? 0.15 + 0.6 * b.heat : 0.04; }
              else if (o === O_SKIRT) heat = 0.35;
              if (P.boost[i] > 0) P.boost[i] = Math.max(0, P.boost[i] - dtc);
              const amp = heat * (1 + 2.2 * P.boost[i]);
              if (Math.abs(fa[i * 4 + 1] - amp) > 0.01) { fa[i * 4 + 1] += (amp - fa[i * 4 + 1]) * Math.min(1, dtc * 4); flDirty = true; }
            }
          }
        }
        if (flDirty) P.flA.needsUpdate = true;
        if (P.dirty) { P.mesh.instanceMatrix.needsUpdate = true; P.dirty = false; }
      }
    },

    _pools: pools,
  };

  function refreshPlatter() {
    const pl = getPlatter();
    if (!pl) { platterChanged = platterStamp !== 0; platterStamp = 0; return; }
    pl.updateWorldMatrix(true, false);
    const e = pl.matrixWorld.elements;
    let s = 1;
    for (let j = 0; j < 16; j++) s += e[j] * (j + 1.37);
    platterChanged = s !== platterStamp;
    platterStamp = s;
    platterInv.copy(pl.matrixWorld).invert();
  }

  return bits;
}
