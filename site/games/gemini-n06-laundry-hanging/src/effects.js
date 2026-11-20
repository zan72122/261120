import * as THREE from 'three';

/**
 * Physical micro-effects: real water droplets, damp deck splashes, and sunlit breeze/evaporation motes.
 * Zero cartoon particles or neon glows.
 */
export function createPhysicalEffects(scene) {
  const dropGeo = new THREE.SphereGeometry(0.0052, 8, 8);
  dropGeo.scale(0.85, 1.45, 0.85);
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xeef7ff),
    roughness: 0.04,
    metalness: 0.0,
    transmission: 0.88,
    ior: 1.333,
    transparent: true,
    opacity: 0.78,
  });

  // Soft dark damp spot texture for concrete/wood deck
  const dampCanvas = document.createElement('canvas');
  dampCanvas.width = 64;
  dampCanvas.height = 64;
  const dctx = dampCanvas.getContext('2d');
  const dg = dctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  dg.addColorStop(0.0, 'rgba(32, 26, 20, 0.52)');
  dg.addColorStop(0.65, 'rgba(32, 26, 20, 0.24)');
  dg.addColorStop(1.0, 'rgba(32, 26, 20, 0.0)');
  dctx.fillStyle = dg;
  dctx.fillRect(0, 0, 64, 64);
  const dampTex = new THREE.CanvasTexture(dampCanvas);
  dampTex.colorSpace = THREE.SRGBColorSpace;
  const dampGeo = new THREE.PlaneGeometry(0.055, 0.055);
  dampGeo.rotateX(-Math.PI / 2);

  // Soft translucent morning sunlit vapor / air mote sprite
  const moteCanvas = document.createElement('canvas');
  moteCanvas.width = 64;
  moteCanvas.height = 64;
  const mctx = moteCanvas.getContext('2d');
  const mg = mctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  mg.addColorStop(0.0, 'rgba(255, 250, 238, 0.65)');
  mg.addColorStop(0.45, 'rgba(255, 248, 230, 0.22)');
  mg.addColorStop(1.0, 'rgba(255, 248, 230, 0.0)');
  mctx.fillStyle = mg;
  mctx.fillRect(0, 0, 64, 64);
  const moteTex = new THREE.CanvasTexture(moteCanvas);
  moteTex.colorSpace = THREE.SRGBColorSpace;

  const droplets = [];
  const dampSpots = [];
  const motes = [];

  function spawnDroplets(pos, count = 3) {
    for (let i = 0; i < count; i++) {
      if (droplets.length > 28) break;
      const mesh = new THREE.Mesh(dropGeo, dropMat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.16,
        pos.y + (Math.random() - 0.5) * 0.06,
        pos.z + (Math.random() - 0.5) * 0.05
      );
      scene.add(mesh);
      droplets.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.15 - Math.random() * 0.35,
        vz: (Math.random() - 0.5) * 0.18,
      });
    }
  }

  function spawnDampSpot(x, z) {
    if (dampSpots.length > 18) {
      const oldest = dampSpots.shift();
      scene.remove(oldest.mesh);
      oldest.mesh.material.dispose();
    }
    const mat = new THREE.MeshBasicMaterial({
      map: dampTex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const mesh = new THREE.Mesh(dampGeo, mat);
    const y = z > -0.52 && z < 0.45 && Math.abs(x) < 0.96 ? 0.024 : 0.004;
    mesh.position.set(x, y, z);
    const s = 0.7 + Math.random() * 0.75;
    mesh.scale.set(s, 1, s);
    scene.add(mesh);
    dampSpots.push({ mesh, age: 0, maxAge: 4.5 + Math.random() * 2.5 });
  }

  function spawnSunlitMotes(pos, { count = 8, driftX = 0.55, riseY = 0.22, spread = 0.25 } = {}) {
    for (let i = 0; i < count; i++) {
      if (motes.length > 42) break;
      const mat = new THREE.SpriteMaterial({
        map: moteTex,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + (Math.random() - 0.5) * spread * 0.8,
        pos.z + (Math.random() - 0.5) * 0.16
      );
      const sz = 0.045 + Math.random() * 0.075;
      sprite.scale.set(sz, sz, 1);
      scene.add(sprite);
      motes.push({
        sprite,
        vx: driftX * (0.65 + Math.random() * 0.7),
        vy: riseY * (0.6 + Math.random() * 0.8),
        vz: (Math.random() - 0.5) * 0.12,
        age: 0,
        maxAge: 1.0 + Math.random() * 0.75,
        peakOpacity: 0.34 + Math.random() * 0.22,
      });
    }
  }

  function update(dt) {
    // 1. Droplets gravity & splash
    for (let i = droplets.length - 1; i >= 0; i--) {
      const d = droplets[i];
      d.vy -= 7.8 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      if (d.mesh.position.y <= 0.025) {
        spawnDampSpot(d.mesh.position.x, d.mesh.position.z);
        scene.remove(d.mesh);
        droplets.splice(i, 1);
      }
    }

    // 2. Damp spots gently evaporating in sunlight
    for (let i = dampSpots.length - 1; i >= 0; i--) {
      const s = dampSpots[i];
      s.age += dt;
      const t = s.age / s.maxAge;
      s.mesh.material.opacity = Math.max(0, 0.58 * (1 - t));
      if (t >= 1) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        dampSpots.splice(i, 1);
      }
    }

    // 3. Sunlit morning air / evaporation motes
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i];
      m.age += dt;
      const t = m.age / m.maxAge;
      m.sprite.position.x += m.vx * dt;
      m.sprite.position.y += m.vy * dt;
      m.sprite.position.z += m.vz * dt;
      const fade = Math.sin(Math.min(1, t) * Math.PI);
      m.sprite.material.opacity = m.peakOpacity * fade;
      if (t >= 1) {
        scene.remove(m.sprite);
        m.sprite.material.dispose();
        motes.splice(i, 1);
      }
    }
  }

  return {
    spawnDroplets,
    spawnSunlitMotes,
    update,
  };
}
