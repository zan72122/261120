// Pooled effects: steam, sparkle, splash, liquid streams, hint glow. No per-frame allocation.
import * as THREE from 'three';

const STEAM_MAX = 70;
const SPARK_MAX = 48;
const SPLASH_MAX = 36;
const GLOW_MAX = 12;
const GRAV = 981; // cm/s²

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function steamTexture() {
  return canvasTex(128, (g, s) => {
    const img = g.createImageData(s, s);
    // value noise with a few octaves, masked by a soft radial falloff
    const N = 16;
    const grid = new Float32Array((N + 1) * (N + 1)).map(() => Math.random());
    const at = (x, y) => grid[(y % N) * (N + 1) + (x % N)];
    const noise = (u, v, f) => {
      const x = u * f;
      const y = v * f;
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const tx = x - xi;
      const ty = y - yi;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
      const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
      return a + (b - a) * sy;
    };
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s;
        const v = y / s;
        const dx = u - 0.5;
        const dy = v - 0.5;
        const r = Math.sqrt(dx * dx + dy * dy) * 2;
        const n = noise(u, v, 4) * 0.55 + noise(u, v, 8) * 0.3 + noise(u, v, 16) * 0.15;
        const fall = Math.max(0, 1 - r);
        const a = Math.pow(fall, 1.6) * (0.45 + 0.75 * n);
        const i = (y * s + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
      }
    }
    g.putImageData(img, 0, 0);
  });
}

function radialTexture(stops) {
  return canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });
}

function starTexture() {
  return canvasTex(64, (g, s) => {
    const c = s / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.15, 'rgba(255,245,220,0.8)');
    gr.addColorStop(0.5, 'rgba(255,220,160,0.12)');
    gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'lighter';
    for (const [w, h] of [
      [s * 0.9, s * 0.05],
      [s * 0.05, s * 0.9],
    ]) {
      const lg = g.createRadialGradient(c, c, 0, c, c, Math.max(w, h) / 2);
      lg.addColorStop(0, 'rgba(255,250,235,0.9)');
      lg.addColorStop(1, 'rgba(255,230,180,0)');
      g.fillStyle = lg;
      g.fillRect(c - w / 2, c - h / 2, w, h);
    }
  });
}

const rand = (a, b) => a + Math.random() * (b - a);

export function createFx(G) {
  const root = new THREE.Group();
  root.name = 'fx';
  G.scene.add(root);
  const qs = () => (G.quality && G.quality.particleScale) || 1;
  const nCount = (n) => {
    const v = n * qs();
    const f = Math.floor(v);
    return f + (Math.random() < v - f ? 1 : 0);
  };

  // ---------- steam ----------
  const steamTex = steamTexture();
  const steam = [];
  for (let i = 0; i < STEAM_MAX; i++) {
    const m = new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, color: 0xf2eee8 });
    const s = new THREE.Sprite(m);
    s.visible = false;
    s.renderOrder = 5;
    root.add(s);
    steam.push({ s, m, live: false, age: 0, life: 1, vel: new THREE.Vector3(), size: 1, rot: 0, rv: 0, seed: 0 });
  }
  let steamLive = 0;

  function emitSteam(pos, o = {}) {
    const count = nCount(o.count != null ? o.count : 1);
    const cap = Math.max(8, Math.floor(STEAM_MAX * qs()));
    const spread = o.spread != null ? o.spread : 0.6;
    const rise = o.rise != null ? o.rise : 6;
    const size = o.size != null ? o.size : 2.5;
    const life = o.life != null ? o.life : 1.6;
    for (let k = 0; k < count; k++) {
      if (steamLive >= cap) return;
      let p = null;
      for (let i = 0; i < STEAM_MAX; i++) if (!steam[i].live) (p = steam[i]), (i = STEAM_MAX);
      if (!p) return;
      p.live = true;
      steamLive++;
      p.age = 0;
      p.life = life * rand(0.8, 1.2);
      p.size = size * rand(0.8, 1.15);
      p.seed = Math.random() * 100;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      p.s.position.set(pos.x + Math.cos(a) * r, pos.y, pos.z + Math.sin(a) * r);
      p.vel.set(rand(-0.6, 0.6), rise * rand(0.8, 1.2), rand(-0.6, 0.6));
      p.m.rotation = Math.random() * Math.PI * 2;
      p.rv = rand(-0.5, 0.5);
      if (o.tint != null) p.m.color.set(o.tint);
      else p.m.color.set(0xf2eee8);
      p.s.visible = true;
      p.m.opacity = 0;
    }
  }

  function updateSteam(dt, t) {
    for (const p of steam) {
      if (!p.live) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.live = false;
        steamLive--;
        p.s.visible = false;
        continue;
      }
      // gentle curl drift, slowing rise
      p.vel.x += Math.sin(t * 1.3 + p.seed) * 2.0 * dt;
      p.vel.z += Math.cos(t * 1.1 + p.seed * 1.7) * 2.0 * dt;
      p.vel.multiplyScalar(Math.exp(-dt * 0.6));
      p.s.position.addScaledVector(p.vel, dt);
      p.m.rotation += p.rv * dt;
      const sc = p.size * (1 + 1.3 * k);
      p.s.scale.set(sc, sc, 1);
      const fin = Math.min(1, k / 0.18);
      p.m.opacity = 0.25 * fin * (1 - k) * (1 - k * 0.3);
    }
  }

  // ---------- sparkle ----------
  const starTex = starTexture();
  const sparks = [];
  for (let i = 0; i < SPARK_MAX; i++) {
    const m = new THREE.SpriteMaterial({
      map: starTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffe2a8,
      opacity: 0,
    });
    const s = new THREE.Sprite(m);
    s.visible = false;
    s.renderOrder = 6;
    root.add(s);
    sparks.push({ s, m, live: false, age: 0, life: 0.6, vel: new THREE.Vector3(), size: 0.6 });
  }
  function emitSparkle(pos, o = {}) {
    const count = nCount(o.count != null ? o.count : 6);
    const spread = o.spread != null ? o.spread : 1.6;
    for (let k = 0; k < count; k++) {
      let p = null;
      for (let i = 0; i < SPARK_MAX; i++) if (!sparks[i].live) (p = sparks[i]), (i = SPARK_MAX);
      if (!p) return;
      p.live = true;
      p.age = -Math.random() * 0.15;
      p.life = rand(0.35, 0.65);
      p.size = rand(0.5, 1.1) * (o.size || 1);
      p.s.position.set(pos.x + rand(-1, 1) * spread, pos.y + rand(-0.3, 1) * spread * 0.6, pos.z + rand(-1, 1) * spread);
      p.vel.set(rand(-1, 1), rand(1, 3), rand(-1, 1));
      p.m.rotation = Math.random() * Math.PI;
      if (o.color != null) p.m.color.set(o.color);
      else p.m.color.set(0xffe2a8);
      p.s.visible = false;
    }
  }
  function updateSparks(dt) {
    for (const p of sparks) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age < 0) continue;
      const k = p.age / p.life;
      if (k >= 1) {
        p.live = false;
        p.s.visible = false;
        continue;
      }
      p.s.visible = true;
      p.s.position.addScaledVector(p.vel, dt);
      const tw = Math.sin(k * Math.PI);
      const sc = p.size * (0.4 + 0.8 * tw);
      p.s.scale.set(sc, sc, 1);
      p.m.opacity = tw * 0.9;
      p.m.rotation += dt * 1.5;
    }
  }

  // ---------- splash ----------
  const dropGeo = new THREE.SphereGeometry(1, 10, 8);
  const drops = [];
  for (let i = 0; i < SPLASH_MAX; i++) {
    const m = new THREE.MeshPhysicalMaterial({ color: 0xe8c98a, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3 });
    const s = new THREE.Mesh(dropGeo, m);
    s.visible = false;
    root.add(s);
    drops.push({ s, m, live: false, age: 0, life: 0.5, vel: new THREE.Vector3(), r: 0.2, y0: 0 });
  }
  function emitSplash(pos, o = {}) {
    const count = nCount(o.count != null ? o.count : 5);
    const pw = o.power != null ? o.power : 1;
    for (let k = 0; k < count; k++) {
      let p = null;
      for (let i = 0; i < SPLASH_MAX; i++) if (!drops[i].live) (p = drops[i]), (i = SPLASH_MAX);
      if (!p) return;
      p.live = true;
      p.age = 0;
      p.life = rand(0.25, 0.45);
      p.r = rand(0.12, 0.26) * (o.size || 1);
      p.y0 = pos.y;
      p.s.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const h = rand(10, 28) * pw;
      p.vel.set(Math.cos(a) * h, rand(35, 70) * pw, Math.sin(a) * h);
      p.m.color.set(o.color != null ? o.color : 0xe8c98a);
      p.s.scale.setScalar(p.r);
      p.s.visible = true;
    }
  }
  function updateDrops(dt) {
    for (const p of drops) {
      if (!p.live) continue;
      p.age += dt;
      p.vel.y -= GRAV * dt;
      p.s.position.addScaledVector(p.vel, dt);
      const k = p.age / p.life;
      if (k >= 1 || p.s.position.y < p.y0 - 1.5) {
        p.live = false;
        p.s.visible = false;
        continue;
      }
      p.s.scale.setScalar(p.r * (1 - k * k * 0.6));
    }
  }

  // ---------- streams ----------
  const RINGS = 32;
  const SIDES = 10;
  const streams = {};
  const P0 = new THREE.Vector3();
  const P1 = new THREE.Vector3();
  const P2 = new THREE.Vector3();
  const P3 = new THREE.Vector3();
  const cpos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const ref = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function bez(t, out) {
    const u = 1 - t;
    return out
      .copy(P0)
      .multiplyScalar(u * u * u)
      .addScaledVector(P1, 3 * u * u * t)
      .addScaledVector(P2, 3 * u * t * t)
      .addScaledVector(P3, t * t * t);
  }

  function makeStream(name) {
    const n = RINGS * (SIDES + 1);
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const idx = [];
    for (let r = 0; r < RINGS - 1; r++) {
      for (let s = 0; s < SIDES; s++) {
        const a = r * (SIDES + 1) + s;
        const b = a + SIDES + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xe9cf98,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.15,
      sheen: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.castShadow = !(G.quality && G.quality.low);
    root.add(mesh);
    const st = {
      name,
      mesh,
      geo,
      mat,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      hasDir: false,
      on: false,
      radius: 0.35,
      head: 0, // 0..1 how far the front has fallen
      tail: 0, // 0..1 how far the detached tail has fallen
      tailV: 0,
      seed: Math.random() * 10,
      api: null,
    };
    st.api = {
      set(from, to, on, radius = 0.35, dir) {
        if (on) {
          if (!st.on) {
            // (re)start: front falls from the spout
            if (st.tail > 0 || !st.mesh.visible) st.head = 0;
            st.tail = 0;
            st.tailV = 0;
          }
          st.from.copy(from);
          st.to.copy(to);
          if (dir) {
            st.dir.copy(dir);
            st.hasDir = true;
          } else st.hasDir = false;
          st.radius = radius;
        }
        st.on = !!on;
      },
      setColor(hex) {
        st.mat.color.set(hex);
      },
      get active() {
        return st.mesh.visible;
      },
    };
    streams[name] = st;
    return st;
  }

  function updateStream(st, dt, t) {
    if (st.on) {
      st.head = Math.min(1, st.head + dt / 0.12);
      st.tail = 0;
    } else if (st.mesh.visible) {
      st.tailV += dt * 9;
      st.tail = Math.min(1, st.tail + dt * (2.2 + st.tailV));
      st.head = Math.min(1, st.head + dt / 0.12);
      if (st.tail >= 1) {
        st.mesh.visible = false;
        return;
      }
    }
    if (!st.on && !st.mesh.visible) return;
    if (st.head <= 0) return;
    st.mesh.visible = true;

    const drop = Math.max(0.5, st.from.y - st.to.y);
    P0.copy(st.from);
    P3.copy(st.to);
    if (st.hasDir) {
      tmp.copy(st.dir);
      tmp.y = Math.min(0, tmp.y);
      if (tmp.lengthSq() < 1e-6) tmp.set(0, -1, 0);
      tmp.normalize();
      P1.copy(P0).addScaledVector(tmp, Math.min(1.5, drop * 0.15));
    } else {
      P1.set(P0.x + (P3.x - P0.x) * 0.6, P0.y - drop * 0.05, P0.z + (P3.z - P0.z) * 0.6);
    }
    P2.set(P3.x, P3.y + drop * 0.5, P3.z);

    const pos = st.geo.attributes.position.array;
    const nor = st.geo.attributes.normal.array;
    const t0 = st.tail;
    const t1 = st.head;
    ref.set(1, 0, 0);
    for (let r = 0; r < RINGS; r++) {
      const u = r / (RINGS - 1);
      const s = t0 + (t1 - t0) * u;
      bez(s, cpos);
      bez(Math.min(1, s + 0.01), tmp);
      tan.subVectors(tmp, cpos);
      if (tan.lengthSq() < 1e-10) bez(Math.max(0, s - 0.01), tmp), tan.subVectors(cpos, tmp);
      if (tan.lengthSq() < 1e-10) tan.set(0, -1, 0);
      tan.normalize();
      nrm.crossVectors(ref, tan);
      if (nrm.lengthSq() < 1e-6) nrm.crossVectors(tmp.set(0, 0, 1), tan);
      nrm.normalize();
      bin.crossVectors(tan, nrm).normalize();
      // radius: thins as it accelerates, wobbles, rounded ends
      let rad = st.radius * (1 - 0.4 * s);
      rad *= 1 + 0.09 * Math.sin(t * 23 + s * 14 + st.seed) + 0.05 * Math.sin(t * 37 - s * 31);
      const endTail = t0 > 0 ? Math.min(1, u * (RINGS - 1) / 3) : 1;
      const endHead = Math.min(1, (1 - u) * (RINGS - 1) / 2.5 + (t1 >= 1 && st.on ? 1 : 0));
      rad *= Math.sqrt(Math.max(0, endTail)) * Math.sqrt(Math.max(0, endHead));
      if (t0 > 0) rad *= 1 - 0.5 * t0;
      for (let k = 0; k <= SIDES; k++) {
        const a = (k / SIDES) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const nx = nrm.x * ca + bin.x * sa;
        const ny = nrm.y * ca + bin.y * sa;
        const nz = nrm.z * ca + bin.z * sa;
        const i = (r * (SIDES + 1) + k) * 3;
        pos[i] = cpos.x + nx * rad;
        pos[i + 1] = cpos.y + ny * rad;
        pos[i + 2] = cpos.z + nz * rad;
        nor[i] = nx;
        nor[i + 1] = ny;
        nor[i + 2] = nz;
      }
    }
    st.geo.attributes.position.needsUpdate = true;
    st.geo.attributes.normal.needsUpdate = true;
  }

  // ---------- glow ----------
  const glowTex = radialTexture([
    [0, 'rgba(255,246,214,1)'],
    [0.35, 'rgba(255,226,160,0.55)'],
    [0.7, 'rgba(255,200,120,0.15)'],
    [1, 'rgba(255,190,110,0)'],
  ]);
  const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const glows = [];
  for (let i = 0; i < GLOW_MAX; i++) {
    const m = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      color: 0xffe6b0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });
    const s = new THREE.Mesh(glowGeo, m);
    s.visible = false;
    s.renderOrder = 4;
    root.add(s);
    glows.push({ s, m, a: 0, goal: 0, want: new THREE.Vector3(), has: false });
  }
  let glowRadius = 2.8;

  function glow(points, strength = 0.5, radius) {
    if (radius) glowRadius = radius;
    const n = points ? Math.min(points.length, GLOW_MAX) : 0;
    for (let i = 0; i < GLOW_MAX; i++) {
      const g = glows[i];
      if (i < n && points[i]) {
        const p = points[i];
        if (!g.has || g.a < 0.01) g.s.position.set(p.x, p.y + 0.05, p.z);
        g.want.set(p.x, p.y + 0.05, p.z);
        g.has = true;
        g.goal = Math.max(0, Math.min(1.2, strength));
      } else g.goal = 0;
    }
  }

  function updateGlow(dt) {
    const k = 1 - Math.exp(-dt * 6);
    for (let i = 0; i < GLOW_MAX; i++) {
      const g = glows[i];
      g.a += (g.goal - g.a) * k;
      if (g.a < 0.004 && g.goal === 0) {
        g.s.visible = false;
        g.has = false;
        continue;
      }
      g.s.position.lerp(g.want, Math.min(1, dt * 10));
      g.s.visible = true;
      const d = glowRadius * 2 * (0.9 + 0.12 * g.a);
      g.s.scale.set(d, 1, d);
      g.m.opacity = g.a * 0.55;
    }
  }

  const fx = {
    root,
    steam: emitSteam,
    sparkle: emitSparkle,
    splash: emitSplash,
    stream(name = 'main') {
      return (streams[name] || makeStream(name)).api;
    },
    glow,
    update(dt) {
      const t = G.time || 0;
      updateSteam(dt, t);
      updateSparks(dt);
      updateDrops(dt);
      for (const k in streams) updateStream(streams[k], dt, t);
      updateGlow(dt);
    },
    clear() {
      for (const p of steam) (p.live = false), (p.s.visible = false);
      steamLive = 0;
      for (const p of sparks) (p.live = false), (p.s.visible = false);
      for (const p of drops) (p.live = false), (p.s.visible = false);
      for (const k in streams) (streams[k].on = false), (streams[k].mesh.visible = false);
    },
  };
  return fx;
}
