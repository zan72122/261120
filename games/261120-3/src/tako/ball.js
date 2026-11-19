// One takoyaki ball: per-vertex cook map in object space, shape derived from cook + gravity, flip dynamics, sauce, bite.
import * as THREE from 'three';
import { BALL_R, holeCenter } from '../config.js';
import { createTakoMaterial } from './material.js';
import { createSkirt } from './skirt.js';
import { makeFilling } from './filling.js';
import { fbm3, vnoise3, mulberry, smoothstep } from './noise.js';

const R = BALL_R;
const L_FULL = 0.12; // liquid level above the centre when the hole is full (meniscus)
const COOK_BASE = 0.5 / 7; // cook/s at the bottom of the hole
const SOAK = 0.012; // all-over heat soak after the first flip
const READY_MEAN = 0.56;
const DONE_FRAC = 0.96;
const DONE_COOK = 0.55;
const HOP_SPEED = 110;
const SPIN_WN = 16, SPIN_ZETA = 0.74;
const G_HOP = 720;

// multi-flip chain: consecutive flips within 0.4 s rise in pitch
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19];
const chain = { t: -10, n: 0 };

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _plane = new THREE.Plane();
const UP = new THREE.Vector3(0, 1, 0);

// rotate (x,y,z) by quaternion q into out array slot
function rotY(q, x, y, z) {
  // y component of q * v
  const tx = 2 * (q.y * z - q.z * y), ty = 2 * (q.z * x - q.x * z), tz = 2 * (q.x * y - q.y * x);
  return y + q.w * ty + (q.z * tx - q.x * tz);
}

export function createBall(G, index, S) {
  const N = S.N;
  const cook = new Float32Array(N);
  const sauce = new Float32Array(N);
  const rateVar = new Float32Array(N);
  const jit = new Float32Array(N);
  const rNoise = new Float32Array(N);
  const sArr = new Float32Array(N);
  const vyArr = new Float32Array(N);
  const pos = new Float32Array(N * 3);
  const nrm = new Float32Array(N * 3);
  const tako = new Float32Array(N * 3);

  const geo = new THREE.BufferGeometry();
  geo.setIndex(S.index);
  const posA = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const nrmA = new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage);
  const takoA = new THREE.BufferAttribute(tako, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posA);
  geo.setAttribute('normal', nrmA);
  geo.setAttribute('aTako', takoA);
  geo.setAttribute('aObj', S.aObj);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.35);

  const mat = createTakoMaterial();
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);
  mat.clippingPlanes = [cutPlane];
  mat.clipShadows = true;
  const U = mat.userData.u;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const body = new THREE.Group(); // squash / swing
  body.add(mesh);
  const group = new THREE.Group();
  group.add(body);
  group.name = 'tako' + index;
  G.scene.add(group);

  const skirtObj = createSkirt(G.scene, index);

  const q = new THREE.Quaternion();
  const spin = { axis: new THREE.Vector3(1, 0, 0), x: 0, v: 0, X: 0, q0: new THREE.Quaternion() };
  const st = {
    seed: index * 101 + 1,
    resets: 0,
    shapeDirty: true,
    colorDirty: true,
    lastFill: -1,
    cookAcc: (index / 12) / 12,
    unset: N,
    wobT: 9,
    hopY: 0, hopV: 0, airborne: false,
    sq: 0, sqV: 0,
    sizzleT: -1, sizzleAmt: 0,
    steamT: 1 + Math.random() * 2,
    lastSwipe: -10,
    tuckT: -1,
    skirtCook: 0,
    evenT: 0,
    prevPos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    swX: 0, swZ: 0, swVX: 0, swVZ: 0,
    fly: null,
    cutKeep: new THREE.Vector3(0, 0, -1),
    fillOff: new THREE.Vector3(),
    fillQ: new THREE.Quaternion(),
    topS: 0,
    readinessV: 0,
    lastMode: 'hole',
  };

  const ball = {
    index,
    group,
    mesh,
    body,
    mode: 'hole',
    fill: 0,
    skirt: 0,
    filling: null,
    fillingObj: null,
    cookCap: 1,
    ready: false,
    flips: 0,
    spinning: false,
    done: false,
    justDone: false,
    onDone: null,
    heat: 0,
    bitten: 0,
    q,
    version: 0, // increments whenever the displayed vertex positions change (used by bits)
    _pos: pos,
    _nrm: nrm,
    _cook: cook,
    _sauce: sauce,
  };

  function seedNoise() {
    const sd = st.seed + st.resets * 977;
    const b = S.base;
    for (let i = 0; i < N; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
      const lf = fbm3(x * 1.6 + 3, y * 1.6, z * 1.6, sd, 3) - 0.5; // smooth marbling
      const hf = vnoise3(x * 6, y * 6, z * 6, sd + 5) - 0.5;
      rateVar[i] = Math.max(0.5, 1 + lf * 0.9 + hf * 0.22);
      jit[i] = (fbm3(x * 2.4, y * 2.4 + 7, z * 2.4, sd + 9, 2) - 0.5) * 0.12 + hf * 0.04;
      rNoise[i] = (fbm3(x * 1.3, y * 1.3, z * 1.3 + 11, sd + 13, 2) - 0.5) * 2;
    }
    U.uSeed.value.set(((sd * 0.137) % 7) + 0.3, ((sd * 0.311) % 5) + 0.1, ((sd * 0.173) % 3) + 0.7);
  }

  const level = () => {
    const f = Math.min(1, Math.max(0, ball.fill));
    return -R + R * Math.pow(f, 0.62) + L_FULL * f;
  };

  // ---------- shape rebuild ----------
  function rebuild() {
    const b = S.base;
    const L = level();
    const rk = Math.sqrt(Math.max(R * R - L * L, 0)) / R;
    const inHole = ball.mode === 'hole';
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    let unset = 0;
    let topY = -9, topS = 1;
    for (let i = 0; i < N; i++) {
      const px = b[i * 3], py = b[i * 3 + 1], pz = b[i * 3 + 2];
      const c = cook[i];
      const s = smoothstep(0.43 + jit[i], 0.52 + jit[i], c);
      sArr[i] = s;
      if (s < 0.999) unset++;
      const rad = R * (1 + rNoise[i] * 0.03 * s) + sauce[i] * 0.04;
      // v = q * p * rad
      let tx = 2 * (qy * pz - qz * py), ty = 2 * (qz * px - qx * pz), tz = 2 * (qx * py - qy * px);
      let vx = (px + qw * tx + (qy * tz - qz * ty)) * rad;
      let vy = (py + qw * ty + (qz * tx - qx * tz)) * rad;
      let vz = (pz + qw * tz + (qx * ty - qy * tx)) * rad;
      vyArr[i] = vy;
      if (vy > topY) { topY = vy; topS = s; }
      let flat = 0;
      let dx = vx, dy = vy, dz = vz;
      if (vy > L && s < 0.999) {
        // raw batter cannot stand above the level: flat liquid surface
        let fx, fz;
        if (vy >= 0) { fx = vx * rk; fz = vz * rk; }
        else {
          const h = Math.hypot(vx, vz) || 1;
          fx = (vx / h) * R * rk; fz = (vz / h) * R * rk;
        }
        dx = fx + (vx - fx) * s;
        dy = L + (vy - L) * s;
        dz = fz + (vz - fz) * s;
        flat = 1 - s;
      } else if (inHole && vy < -0.05) {
        // tuck slightly inside the hole wall (avoid z-fighting with the plate)
        dx *= 0.986; dy *= 0.986; dz *= 0.986;
      }
      // to object frame: o = q^-1 * d
      tx = 2 * (-qy * dz + qz * dy); ty = 2 * (-qz * dx + qx * dz); tz = 2 * (-qx * dy + qy * dx);
      pos[i * 3] = dx + qw * tx + (-qy * tz + qz * ty);
      pos[i * 3 + 1] = dy + qw * ty + (-qz * tx + qx * tz);
      pos[i * 3 + 2] = dz + qw * tz + (-qx * ty + qy * tx);
      tako[i * 3 + 2] = flat;
    }
    st.unset = unset;
    st.topS = topS;
    computeNormals();
    // flattened vertices: normal = up (object frame)
    _v.copy(UP).applyQuaternion(_q.copy(q).invert());
    for (let i = 0; i < N; i++) {
      const f = tako[i * 3 + 2];
      if (f > 0.01) {
        const k = Math.min(1, f * 1.6);
        let nx = nrm[i * 3] + (_v.x - nrm[i * 3]) * k, ny = nrm[i * 3 + 1] + (_v.y - nrm[i * 3 + 1]) * k, nz = nrm[i * 3 + 2] + (_v.z - nrm[i * 3 + 2]) * k;
        const l = Math.hypot(nx, ny, nz) || 1;
        nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l;
      }
    }
    posA.needsUpdate = true;
    nrmA.needsUpdate = true;
    writeColor();
    st.shapeDirty = false;
    ball.version++;
  }

  function writeColor() {
    for (let i = 0; i < N; i++) {
      tako[i * 3] = cook[i];
      tako[i * 3 + 1] = sauce[i];
    }
    takoA.needsUpdate = true;
    st.colorDirty = false;
  }

  function computeNormals() {
    nrm.fill(0);
    const ix = S.tris;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, bb = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const e1x = pos[bb] - pos[a], e1y = pos[bb + 1] - pos[a + 1], e1z = pos[bb + 2] - pos[a + 2];
      const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
      nrm[bb] += nx; nrm[bb + 1] += ny; nrm[bb + 2] += nz;
      nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    const cn = S.canon;
    for (let i = 0; i < N; i++) {
      const k = cn[i];
      if (k !== i) { nrm[k * 3] += nrm[i * 3]; nrm[k * 3 + 1] += nrm[i * 3 + 1]; nrm[k * 3 + 2] += nrm[i * 3 + 2]; }
    }
    for (let i = 0; i < N; i++) {
      const k = cn[i];
      let nx = nrm[k * 3], ny = nrm[k * 3 + 1], nz = nrm[k * 3 + 2];
      let l = Math.hypot(nx, ny, nz);
      if (l < 1e-9) { nx = S.base[i * 3]; ny = S.base[i * 3 + 1]; nz = S.base[i * 3 + 2]; l = 1; }
      if (k !== i) { nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l; }
    }
    for (let i = 0; i < N; i++) {
      if (cn[i] === i) {
        const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
        const l = Math.hypot(nx, ny, nz);
        if (l < 1e-9) { nrm[i * 3] = S.base[i * 3]; nrm[i * 3 + 1] = S.base[i * 3 + 1]; nrm[i * 3 + 2] = S.base[i * 3 + 2]; }
        else { nrm[i * 3] = nx / l; nrm[i * 3 + 1] = ny / l; nrm[i * 3 + 2] = nz / l; }
      }
    }
  }

  // ---------- cooking ----------
  let readyMean = 0;
  function cookStep(dt) {
    const b = S.base, w = S.area;
    const inHole = ball.mode === 'hole';
    const hot = inHole && G.state?.heat !== false && ball.fill > 0.3;
    const L = level();
    const cap = Math.min(1, Math.max(0, ball.cookCap));
    let band = false;
    let sw = 0, swc = 0, wa = 0, wd = 0;
    for (let i = 0; i < N; i++) {
      const vy = rotY(q, b[i * 3], b[i * 3 + 1], b[i * 3 + 2]) * R;
      let c = cook[i];
      if (hot) {
        let rate = 0;
        if (vy < 0.25 && vy < L + 0.05) {
          if (vy < 0) {
            const d = Math.min(1, -vy / R);
            rate = COOK_BASE * (0.06 + 0.94 * Math.pow(d, 1.3));
          } else rate = COOK_BASE * 0.06 * (1 - vy / 0.25);
          rate *= rateVar[i] * (ball.flips >= 1 ? 1.4 : 1);
        }
        if (ball.flips >= 1) rate += SOAK * (0.7 + 0.6 * rateVar[i]);
        if (c > 0.62) rate *= 1 - 0.8 * smoothstep(0.62, 1.0, c);
        if (st.evenT > 0) rate = Math.max(rate, c < 0.62 ? 0.9 : 0);
        const lim = st.evenT > 0 ? Math.max(cap, 0.64) : cap;
        if (rate > 0 && c < lim) {
          const nc = Math.min(lim, c + rate * dt);
          if (nc < 0.56 + jit[i] && nc > 0.39 + jit[i]) band = true;
          cook[i] = c = nc;
        }
      } else if (st.evenT > 0 && c < 0.64) {
        cook[i] = c = Math.min(0.64, c + 0.9 * dt);
        band = true;
      }
      if (vy < -0.55 * R) { const d = (-vy / R) * w[i]; sw += d; swc += d * Math.min(c, 1); }
      wa += w[i];
      if (c >= DONE_COOK) wd += w[i];
    }
    readyMean = sw > 0 ? swc / sw : 0;
    st.doneFrac = wd / wa;
    st.readinessV = ball.fill > 0.9 ? Math.min(1, readyMean / READY_MEAN) : 0;
    ball.ready = st.readinessV >= 1;
    st.colorDirty = true;
    if (band) st.shapeDirty = true;
    if (!ball.done && ball.flips >= 1 && st.doneFrac >= DONE_FRAC && ball.mode === 'hole') {
      ball.done = true;
      ball.justDone = true;
      st.evenT = 1.1;
      try { ball.onDone?.(ball); } catch (e) { /* ignore */ }
    }
  }

  function rawExposedFraction() {
    const b = S.base, w = S.area;
    const L = level();
    let raw = 0, tot = 0;
    for (let i = 0; i < N; i++) {
      tot += w[i];
      if (sArr[i] < 0.5 && rotY(q, b[i * 3], b[i * 3 + 1], b[i * 3 + 2]) * R > L - 0.6) raw += w[i];
    }
    return raw / tot;
  }

  // ---------- filling ----------
  function placeFilling(t) {
    const f = ball.fillingObj;
    if (!f) return;
    // object-frame offset + bobbing while the top is still liquid
    const liquidTop = st.topS < 0.5 && ball.mode === 'hole';
    _v.copy(st.fillOff).applyQuaternion(q); // displayed offset (gravity frame)
    let y = _v.y;
    if (liquidTop) {
      const L = level();
      y = Math.min(y, L + 0.35, L - 0.08) + Math.sin(t * 2.3 + index * 1.7) * 0.05 * Math.min(1, ball.fill);
    }
    _v.y = y;
    _v.applyQuaternion(_q.copy(q).invert());
    f.position.copy(_v);
    f.quaternion.copy(st.fillQ);
    f.visible = ball.fill > 0.35;
  }

  // ---------- public API ----------
  ball.readiness = () => st.readinessV;
  ball.doneness = () => {
    const d = Math.min(1, (st.doneFrac || 0) / DONE_FRAC);
    return ball.done ? 1 : ball.flips >= 1 ? d : Math.min(0.9, d);
  };
  ball.level = () => level();
  ball.addBatter = (amount) => {
    const nf = ball.fill + amount;
    if (nf > 1) { ball.fill = 1; return nf - 1; }
    ball.fill = Math.max(0, nf);
    return 0;
  };
  ball.addSkirt = (amount) => { ball.skirt = Math.max(0, Math.min(1, ball.skirt + amount)); };
  ball.setFilling = (kind) => {
    if (ball.fillingObj) { mesh.remove(ball.fillingObj); ball.fillingObj = null; }
    ball.filling = kind || null;
    if (!kind) return;
    const f = makeFilling(kind);
    const rnd = mulberry(st.seed * 7 + st.resets * 13 + 3);
    st.fillOff.set((rnd() - 0.5) * 0.5, 0.0, (rnd() - 0.5) * 0.5).applyQuaternion(_q.copy(q).invert());
    st.fillQ.setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
    // link the filling's cut uniforms to this ball's cut plane
    const cu = f.userData.cutU;
    for (const m of f.userData.mats) m.clippingPlanes = [cutPlane];
    cu.uCut = U.uCut;
    cu.uCutPlane = U.uCutPlane;
    for (const m of f.userData.mats) {
      const ob = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => { ob(sh, r); sh.uniforms.uCut = U.uCut; sh.uniforms.uCutPlane = U.uCutPlane; };
    }
    ball.fillingObj = f;
    mesh.add(f);
    placeFilling(G.time || 0);
  };

  function startSpin(axisX, axisZ, angle, impulse) {
    // bake current spin into q0 and combine remaining rotation with the new stroke
    const remX = spin.axis.x * (spin.X - spin.x), remY = spin.axis.y * (spin.X - spin.x), remZ = spin.axis.z * (spin.X - spin.x);
    const velX = spin.axis.x * spin.v, velY = spin.axis.y * spin.v, velZ = spin.axis.z * spin.v;
    spin.q0.copy(q);
    const ax = remX + axisX * angle, ay = remY, az = remZ + axisZ * angle;
    let tot = Math.hypot(ax, ay, az);
    if (tot < 1e-5) return;
    spin.axis.set(ax / tot, ay / tot, az / tot);
    tot = Math.min(tot, Math.PI * 1.7);
    spin.X = tot;
    spin.x = 0;
    spin.v = Math.min(velX * spin.axis.x + velY * spin.axis.y + velZ * spin.axis.z + impulse, 26);
    ball.spinning = true;
  }

  ball.swipe = (dir, speed = 60) => {
    if (ball.mode !== 'hole' || ball.fill < 0.6 || ball.bitten) return null;
    const now = G.time ?? performance.now() / 1000;
    if (now - st.lastSwipe < 0.09) return null;
    st.lastSwipe = now;
    const dx = dir ? dir.x : 0, dz = dir ? dir.z : 0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4 || (!ball.ready && !ball.spinning && !ball.done)) {
      st.wobT = 0;
      st.sqV -= 1.2;
      G.audio?.play?.('wobble', { vol: 0.8, pitch: 0.92 + Math.random() * 0.16 });
      return 'wobble';
    }
    const ux = dx / len, uz = dz / len;
    const deg = 95 + Math.min(1, Math.max(0, (speed - 15) / 100)) * 105 + (Math.random() - 0.5) * 10;
    const ang = (deg * Math.PI) / 180;
    // axis = up x dir -> the top surface moves along the swipe
    startSpin(uz, -ux, ang, ang * 6.5);
    ball.flips++;
    if (ball.flips === 1 && ball.skirt > 0.01 && st.tuckT < 0) st.tuckT = 0;
    // raw batter that will run down into the hot hole
    const raw = ball.done ? 0 : rawExposedFraction();
    if (raw > 0.04) { st.sizzleT = 0.12; st.sizzleAmt = Math.min(1, raw * 2.2); }
    const hop = speed > HOP_SPEED;
    // chained flips rise in pitch
    chain.n = now - chain.t < 0.4 ? Math.min(chain.n + 1, SCALE.length - 1) : 0;
    chain.t = now;
    const pitch = Math.pow(2, SCALE[chain.n] / 12) * (0.97 + Math.random() * 0.06);
    G.audio?.play?.('flip', { pitch, vol: 0.9, pan: Math.max(-1, Math.min(1, group.position.x / 12)) });
    if (hop) {
      const h = 1.5 + Math.min(1, (speed - HOP_SPEED) / 140) * 2;
      st.hopV = Math.sqrt(2 * G_HOP * h);
      st.airborne = true;
      G.audio?.play?.('hop', { pitch: 0.95 + Math.random() * 0.1, vol: 0.8 });
    }
    st.readinessV = Math.min(st.readinessV, 0.99);
    st.cookAcc = 1; // re-evaluate readiness soon
    return hop ? 'hop' : 'flip';
  };

  ball.hold = () => {
    if (ball.mode === 'gone') return;
    if (group.parent !== G.scene) G.scene.attach(group);
    ball.mode = 'held';
    st.fly = null;
    stopSpin();
    if (st.tuckT < 0 && ball.skirt > 0) st.tuckT = 0;
    group.getWorldPosition(st.prevPos);
    st.vel.set(0, 0, 0);
    st.shapeDirty = true;
  };

  function stopSpin() {
    if (ball.spinning) {
      spin.X = spin.x; spin.v = 0; ball.spinning = false;
    }
  }

  ball.flyTo = (worldPos, opts = {}) => {
    if (ball.mode === 'gone') return;
    if (group.parent !== G.scene) G.scene.attach(group);
    stopSpin();
    const from = group.position.clone();
    const to = worldPos.clone();
    const d = _v.subVectors(to, from);
    const ax = new THREE.Vector3(d.z, 0, -d.x);
    if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
    ax.normalize();
    st.fly = {
      from, to, t: 0,
      dur: opts.dur ?? 0.45,
      height: opts.height ?? 6,
      axis: ax,
      spin: (opts.spin ?? 1) * Math.PI * 1.6,
      onLand: opts.onLand,
      slot: opts.slot,
      parent: opts.parent,
    };
    if (st.tuckT < 0 && ball.skirt > 0) st.tuckT = 0;
    ball.mode = 'fly';
    st.shapeDirty = true;
  };

  ball.rollBy = (dx, dz) => {
    const d = Math.hypot(dx, dz);
    group.position.x += dx;
    group.position.z += dz;
    if (d < 1e-6) return;
    _v.set(dz / d, 0, -dx / d);
    _q.setFromAxisAngle(_v, d / R);
    q.premultiply(_q).normalize();
    spin.q0.copy(q);
    if (st.unset > 0) st.shapeDirty = true;
  };

  ball.paintSauce = (worldPoint, radius = 1, amount = 1) => {
    if (ball.mode === 'gone') return;
    mesh.updateWorldMatrix(true, false);
    _m.copy(mesh.matrixWorld).invert();
    _v.copy(worldPoint).applyMatrix4(_m);
    const r2 = radius * radius;
    let ch = false;
    for (let i = 0; i < N; i++) {
      const ddx = pos[i * 3] - _v.x, ddy = pos[i * 3 + 1] - _v.y, ddz = pos[i * 3 + 2] - _v.z;
      const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
      if (d2 < r2 && sauce[i] < 1) {
        const f = 1 - Math.sqrt(d2) / radius;
        sauce[i] = Math.min(1, sauce[i] + amount * (0.35 + 0.65 * f));
        ch = true;
      }
    }
    if (ch) { st.shapeDirty = true; }
  };

  ball.sauceCoverage = () => {
    const b = S.base, w = S.area;
    mesh.updateWorldMatrix(true, false);
    mesh.getWorldQuaternion(_q2);
    let tot = 0, cov = 0;
    for (let i = 0; i < N; i++) {
      const ny = rotY(_q2, b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
      if (ny > 0.05) {
        tot += w[i] * ny;
        if (sauce[i] > 0.45) cov += w[i] * ny;
      }
    }
    return tot > 0 ? cov / tot : 0;
  };

  // nearest vertex to an object-frame direction (lat-long lookup)
  ball.nearestVertex = (x, y, z) => {
    const l = Math.hypot(x, y, z) || 1;
    const th = Math.acos(Math.max(-1, Math.min(1, y / l)));
    let ph = Math.atan2(z, -x);
    if (ph < 0) ph += Math.PI * 2;
    const ix = Math.round((ph / (Math.PI * 2)) * S.wS);
    const iy = Math.round((th / Math.PI) * S.hS);
    return iy * (S.wS + 1) + ix;
  };

  ball.topPointAt = (x, z, out = new THREE.Vector3()) => {
    if (ball.mode === 'gone' || !group.visible || ball.fill < 0.05) return null;
    mesh.updateWorldMatrix(true, false);
    const e = mesh.matrixWorld.elements;
    const cx = e[12], cy = e[13], cz = e[14];
    const dx = x - cx, dz = z - cz;
    const r2 = dx * dx + dz * dz;
    const Rm = R * 1.04 + 0.04;
    if (r2 > Rm * Rm) return null;
    let ys = Math.sqrt(Rm * Rm - r2);
    // object-frame direction
    _v.set(dx, ys, dz).applyQuaternion(_q.copy(q).invert());
    const vi = ball.nearestVertex(_v.x, _v.y, _v.z);
    const rr = Math.hypot(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]);
    if (r2 > rr * rr && sArr[vi] > 0.5) return null;
    ys = Math.sqrt(Math.max(0, rr * rr - r2));
    const s = sArr[vi];
    if (ball.mode === 'hole') {
      const L = level();
      if (ys > L && s < 1) ys = L + (ys - L) * s;
      if (r2 > R * R) return null;
    }
    return out.set(x, cy + ys, z);
  };

  ball.bite = () => {
    if (ball.bitten === 0) {
      ball.bitten = 1;
      if (G.renderer) G.renderer.localClippingEnabled = true;
      mesh.updateWorldMatrix(true, false);
      const cp = G.camera ? G.camera.getWorldPosition(_v2) : _v2.set(0, 40, 60);
      const c = mesh.getWorldPosition(_v);
      const toCam = cp.sub(c);
      const dl = toCam.length() || 1;
      toCam.y += dl * 0.25;
      toCam.normalize();
      // keep side = away from the camera; stored in object frame
      mesh.getWorldQuaternion(_q2).invert();
      st.cutKeep.copy(toCam).negate().applyQuaternion(_q2);
      U.uCut.value = 1;
      updateCut();
      if (S.bits) S.bits.cullOwner(ball, cutPlane);
      return 1;
    }
    if (ball.bitten === 1) {
      ball.bitten = 2;
      ball.mode = 'gone';
      group.visible = false;
      S.bits?.removeOwner?.(ball);
      return 2;
    }
    return ball.bitten;
  };

  function updateCut() {
    if (!ball.bitten) return;
    mesh.updateWorldMatrix(true, false);
    mesh.getWorldQuaternion(_q2);
    const n = _v.copy(st.cutKeep).applyQuaternion(_q2);
    const c = mesh.getWorldPosition(_v2);
    c.addScaledVector(n, -R * 0.065);
    cutPlane.setFromNormalAndCoplanarPoint(n, c);
  }

  mesh.onBeforeRender = (renderer, scene, camera) => {
    if (!ball.bitten) return;
    _plane.copy(cutPlane).applyMatrix4(camera.matrixWorldInverse);
    U.uCutPlane.value.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    mat.uniformsNeedUpdate = true;
  };

  ball.cookAll = () => {
    const rnd = mulberry(index * 7919 + 17 + st.resets * 3);
    const a1 = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const a2 = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const b = S.base;
    for (let i = 0; i < N; i++) {
      const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
      const d1 = Math.max(0, x * a1.x + y * a1.y + z * a1.z), d2 = Math.max(0, x * a2.x + y * a2.y + z * a2.z);
      const c = 0.62 + 0.24 * d1 * d1 + 0.14 * d2 * d2 * d2 + (rateVar[i] - 1) * 0.22;
      cook[i] = Math.max(Math.max(cook[i], 0.6), Math.min(0.95, c));
    }
    ball.fill = 1;
    ball.skirt = 0;
    st.tuckT = -1;
    ball.flips = Math.max(ball.flips, 2);
    ball.done = true;
    ball.justDone = false;
    ball.ready = true;
    st.readinessV = 1;
    st.doneFrac = 1;
    st.evenT = 0;
    spin.X = spin.x = spin.v = 0;
    ball.spinning = false;
    q.setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28));
    spin.q0.copy(q);
    if (ball.mode === 'hole') ball.heat = 1;
    st.shapeDirty = true;
    st.colorDirty = true;
  };

  ball.reset = () => {
    S.bits?.removeOwner?.(ball);
    st.resets++;
    G.scene.add(group);
    holeCenter(index, group.position);
    group.visible = true;
    group.quaternion.identity();
    body.scale.set(1, 1, 1);
    body.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0);
    ball.mode = 'hole';
    ball.fill = 0;
    ball.skirt = 0;
    ball.cookCap = 1;
    ball.ready = false;
    ball.flips = 0;
    ball.spinning = false;
    ball.done = false;
    ball.justDone = false;
    ball.heat = 0;
    ball.bitten = 0;
    U.uCut.value = 0;
    cutPlane.set(UP, 1e5);
    cook.fill(0);
    sauce.fill(0);
    seedNoise();
    q.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
    spin.q0.copy(q);
    spin.X = spin.x = spin.v = 0;
    Object.assign(st, { wobT: 9, hopY: 0, hopV: 0, airborne: false, sq: 0, sqV: 0, sizzleT: -1, tuckT: -1, skirtCook: 0, evenT: 0, fly: null, readinessV: 0, doneFrac: 0, swX: 0, swZ: 0, swVX: 0, swVZ: 0 });
    ball.setFilling(null);
    skirtObj.reset(st.seed + st.resets * 31);
    st.shapeDirty = true;
    st.colorDirty = true;
  };

  // ---------- per-frame ----------
  ball.update = (dt, t) => {
    if (ball.mode === 'gone') return;
    const inHole = ball.mode === 'hole';
    // heat
    if (inHole) {
      const hot = G.state?.heat !== false && ball.fill > 0.2;
      const target = hot ? 1 : 0;
      ball.heat += (target - ball.heat) * (1 - Math.exp(-dt / (hot ? 3 : 40)));
    } else ball.heat *= Math.exp(-dt / 60);

    let qChanged = false;
    // spin: damped spring on the angle along spin.axis
    if (ball.spinning) {
      const sub = 2, h = dt / sub;
      for (let k = 0; k < sub; k++) {
        const a = SPIN_WN * SPIN_WN * (spin.X - spin.x) - 2 * SPIN_ZETA * SPIN_WN * spin.v;
        spin.v += a * h;
        spin.x += spin.v * h;
      }
      _q.setFromAxisAngle(spin.axis, spin.x);
      q.multiplyQuaternions(_q, spin.q0).normalize();
      qChanged = true;
      if (Math.abs(spin.X - spin.x) < 0.004 && Math.abs(spin.v) < 0.06) {
        _q.setFromAxisAngle(spin.axis, spin.X);
        q.multiplyQuaternions(_q, spin.q0).normalize();
        spin.q0.copy(q);
        spin.X = spin.x = spin.v = 0;
        ball.spinning = false;
      }
    }

    // hop
    if (st.airborne) {
      st.hopV -= G_HOP * dt;
      st.hopY += st.hopV * dt;
      if (st.hopY <= 0 && st.hopV < 0) {
        st.hopY = 0;
        st.airborne = false;
        st.sqV -= Math.min(4, -st.hopV * 0.025);
        G.audio?.play?.('land', { vol: 0.7, pitch: 0.95 + Math.random() * 0.1 });
      }
    }
    // squash spring
    st.sqV += (-900 * st.sq - 2 * 0.3 * 30 * st.sqV) * dt;
    st.sq += st.sqV * dt;
    if (Math.abs(st.sq) < 1e-4 && Math.abs(st.sqV) < 1e-3) { st.sq = 0; st.sqV = 0; }
    const sy = 1 + Math.max(-0.25, Math.min(0.25, st.sq * 0.18));
    body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    body.position.y = st.hopY - (1 - sy) * R;

    // held: slight pendulum swing from motion
    if (ball.mode === 'held') {
      group.getWorldPosition(_v);
      if (dt > 0) {
        st.vel.lerp(_v2.subVectors(_v, st.prevPos).multiplyScalar(1 / dt), Math.min(1, dt * 12));
      }
      st.prevPos.copy(_v);
      const tx = Math.max(-0.35, Math.min(0.35, st.vel.z * 0.006)), tz = Math.max(-0.35, Math.min(0.35, -st.vel.x * 0.006));
      st.swVX += ((tx - st.swX) * 80 - st.swVX * 6) * dt; st.swX += st.swVX * dt;
      st.swVZ += ((tz - st.swZ) * 80 - st.swVZ * 6) * dt; st.swZ += st.swVZ * dt;
      body.rotation.set(st.swX, 0, st.swZ);
    } else if (body.rotation.x !== 0 || body.rotation.z !== 0) {
      body.rotation.x *= Math.exp(-dt * 8); body.rotation.z *= Math.exp(-dt * 8);
      if (Math.abs(body.rotation.x) + Math.abs(body.rotation.z) < 1e-3) body.rotation.set(0, 0, 0);
    }

    // flight
    if (ball.mode === 'fly' && st.fly) {
      const F = st.fly;
      F.t += dt / Math.max(0.05, F.dur);
      const e = Math.min(1, F.t);
      group.position.lerpVectors(F.from, F.to, e);
      group.position.y += F.height * 4 * e * (1 - e);
      _q.setFromAxisAngle(F.axis, (F.spin * dt) / Math.max(0.05, F.dur));
      q.premultiply(_q).normalize();
      spin.q0.copy(q);
      qChanged = true;
      if (F.t >= 1) {
        group.position.copy(F.to);
        st.fly = null;
        st.sqV -= 2.2;
        if (F.parent) {
          F.parent.attach(group);
          ball.mode = 'slot';
        } else ball.mode = 'free';
        try { F.onLand?.(ball); } catch (err) { /* ignore */ }
      }
    }

    // wobble (raw poke)
    if (st.wobT < 2) {
      st.wobT += dt;
      U.uWob.value.x = 0.11 * Math.exp(-st.wobT / 0.16);
      U.uWob.value.y = st.wobT * 30;
    } else U.uWob.value.x = 0;
    // readiness quiver of the liquid edge
    const quiv = inHole && !ball.done ? smoothstep(0.85, 1, st.readinessV) : 0;
    U.uWob.value.z += (quiv - U.uWob.value.z) * Math.min(1, dt * 3);
    U.uWob.value.w = t;

    // cooking (throttled ~12 Hz, staggered)
    st.cookAcc += dt;
    if (st.cookAcc >= 1 / 12) {
      const cdt = Math.min(st.cookAcc, 0.25);
      st.cookAcc = 0;
      if (st.evenT > 0) st.evenT -= cdt;
      cookStep(cdt);
      // skirt cooks quickly (thin)
      if (inHole && ball.skirt > 0 && G.state?.heat !== false) st.skirtCook = Math.min(0.5, st.skirtCook + cdt * 0.03);
    }

    // sizzle burst when the raw batter hits the hole
    if (st.sizzleT >= 0) {
      st.sizzleT -= dt;
      if (st.sizzleT < 0) {
        G.audio?.sizzleBurst?.(st.sizzleAmt);
        group.getWorldPosition(_v);
        _v.y += 0.6;
        G.fx?.steam?.(_v.clone(), { count: 1 + Math.round(st.sizzleAmt * 3), spread: 1.2, rise: 6, size: 2.4, life: 1.4 });
      }
    }

    // steam: ready balls in the hole, hot balls elsewhere
    st.steamT -= dt;
    if (st.steamT < 0) {
      const visibleHot = ball.mode !== 'gone' && ball.heat > 0.2;
      if (inHole && ball.ready && !ball.done && !ball.spinning) {
        st.steamT = 2.2 + Math.random() * 1.8;
        group.getWorldPosition(_v); _v.y += 0.4;
        G.fx?.steam?.(_v.clone(), { count: 1, spread: 0.7, rise: 5, size: 2.2, life: 1.6 });
      } else if (!inHole && visibleHot && ball.mode !== 'fly') {
        st.steamT = 4 + Math.random() * 4 / Math.max(0.3, ball.heat);
        group.getWorldPosition(_v); _v.y += R * 0.9;
        G.fx?.steam?.(_v.clone(), { count: 1, spread: 0.5, rise: 4, size: 1.8 * ball.heat + 0.6, life: 1.4 });
      } else st.steamT = 1 + Math.random();
    }

    // skirt
    if (st.tuckT >= 0) {
      st.tuckT += dt / 0.3;
      if (st.tuckT >= 1) {
        st.tuckT = -2; // finished
        ball.skirt = 0;
        S.bits?.removeSkirtOwner?.(ball);
      }
    }
    skirtObj.update(ball.skirt, st.skirtCook, st.tuckT >= 0 ? Math.min(1, st.tuckT) : st.tuckT === -2 ? 1 : 0);
    if (st.tuckT === -2 && ball.skirt > 0.02) st.tuckT = -1; // new batter after tucking (rare) shows again

    if (ball.mode !== st.lastMode) { st.lastMode = ball.mode; st.shapeDirty = true; }
    if (Math.abs(ball.fill - st.lastFill) > 1e-4) { st.lastFill = ball.fill; st.shapeDirty = true; }
    if (qChanged && st.unset > 0) st.shapeDirty = true;
    mesh.visible = ball.fill > 0.01;
    if (st.shapeDirty) rebuild();
    else if (st.colorDirty) writeColor();
    mesh.quaternion.copy(q);
    _v.copy(UP).applyQuaternion(_q.copy(q).invert());
    U.uUp.value.copy(_v);
    if (qChanged) ball.version++;
    placeFilling(t);
    updateCut();
  };

  ball.skirtHeightAt = (x, z) => skirtObj.heightAt(x, z, ball.skirt);
  ball._sOf = (i) => sArr[i];

  ball.reset();
  return ball;
}
