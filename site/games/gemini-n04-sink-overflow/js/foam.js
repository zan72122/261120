import * as THREE from 'three';
import { SINK } from './kitchen.js';
import { audio } from './audio.js';

export class FoamSystem {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;

    this._buildFoamPuffs();
    this._buildIridescentBubbles();
    this._buildPopSparkles();
  }

  _buildFoamPuffs() {
    this.maxFoam = 480;
    const geo = new THREE.SphereGeometry(0.056, 14, 12);
    // Creamy pearlescent sunlit soap foam material with rich clearcoat speculars
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xf7fbff,
      roughness: 0.16,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      iridescence: 0.72,
      iridescenceIOR: 1.33,
      iridescenceThicknessRange: [180, 520],
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.25
    });

    this.foamMesh = new THREE.InstancedMesh(geo, mat, this.maxFoam);
    this.foamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.foamMesh.castShadow = false;
    this.foamMesh.receiveShadow = true;
    this.foamMesh.renderOrder = 4;
    this.scene.add(this.foamMesh);

    this.puffs = [];
    this._dummy = new THREE.Object3D();
    this._dummy.scale.setScalar(0);
    this._dummy.updateMatrix();

    for (let i = 0; i < this.maxFoam; i++) {
      this.puffs.push({
        active: false,
        spilled: false,
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        baseRadius: 1.0,
        pileOffset: 0.0,
        scale: 0.0,
        wobble: Math.random() * Math.PI * 2,
        age: 0,
        maxAge: 90
      });
      this.foamMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.foamMesh.instanceMatrix.needsUpdate = true;
    this.activeCount = 0;
  }

  _buildIridescentBubbles() {
    // Thin-film rainbow iridescent soap bubble shader (photorealistic window highlight + Fresnel rainbow)
    const bubbleGeo = new THREE.SphereGeometry(0.11, 24, 24);
    this.bubbleShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLightDir: { value: new THREE.Vector3(-0.55, 0.72, 0.42).normalize() }
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uLightDir;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;

        vec3 thinFilm(float t) {
          return 0.58 + 0.42 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
        }

        void main() {
          vec3 N = normalize(vNormalW);
          vec3 V = normalize(vViewDir);
          float ndotv = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = pow(1.0 - ndotv, 2.35);

          float swirl = sin(vLocalPos.y * 18.0 + uTime * 1.9 + vLocalPos.x * 11.0) * 0.16;
          vec3 irid = thinFilm(fresnel * 1.45 + swirl + uTime * 0.12);

          // Crisp sunlit window specular highlight
          vec3 H = normalize(uLightDir + V);
          float spec1 = pow(max(dot(N, H), 0.0), 96.0);
          // Secondary soft bounce highlight
          vec3 H2 = normalize(vec3(0.45, 0.5, 0.7) + V);
          float spec2 = pow(max(dot(N, H2), 0.0), 28.0) * 0.35;

          vec3 col = mix(vec3(0.95, 0.99, 1.0), irid, 0.78) + vec3(1.0) * (spec1 * 1.6 + spec2);
          float alpha = clamp(0.11 + fresnel * 0.62 + spec1 * 0.85, 0.0, 0.92);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide
    });

    this.maxBubbles = 26;
    this.bubbles = [];
    this.bubbleGroup = new THREE.Group();
    this.scene.add(this.bubbleGroup);

    for (let i = 0; i < this.maxBubbles; i++) {
      const m = new THREE.Mesh(bubbleGeo, this.bubbleShaderMat);
      m.visible = false;
      m.renderOrder = 10;
      m.userData = { type: 'bubble', index: i };
      this.bubbleGroup.add(m);
      this.bubbles.push({
        mesh: m,
        active: false,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        radius: 0.1,
        age: 0,
        maxAge: 8,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  _buildPopSparkles() {
    this.maxSparkles = 96;
    const geo = new THREE.SphereGeometry(0.015, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92
    });
    this.sparkleMesh = new THREE.InstancedMesh(geo, mat, this.maxSparkles);
    this.sparkleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.sparkleMesh);

    this.sparkles = [];
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < this.maxSparkles; i++) {
      this.sparkles.push({
        active: false,
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0.45
      });
      this.sparkleMesh.setMatrixAt(i, dummy.matrix);
    }
    this.sparkleMesh.instanceMatrix.needsUpdate = true;
  }

  spawnSparkles(x, y, z, count = 10, spread = 1.1) {
    let n = 0;
    for (let i = 0; i < this.maxSparkles && n < count; i++) {
      const s = this.sparkles[i];
      if (!s.active) {
        s.active = true;
        s.x = x;
        s.y = y;
        s.z = z;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const spd = (0.45 + Math.random() * 0.85) * spread;
        s.vx = Math.sin(phi) * Math.cos(theta) * spd;
        s.vy = Math.abs(Math.cos(phi)) * spd + 0.25;
        s.vz = Math.sin(phi) * Math.sin(theta) * spd;
        s.life = 0;
        s.maxLife = 0.28 + Math.random() * 0.26;
        n++;
      }
    }
  }

  addFoamCluster(x, y, z, count = 4, canSpill = false) {
    let added = 0;
    for (let i = 0; i < this.maxFoam && added < count; i++) {
      const p = this.puffs[i];
      if (!p.active) {
        p.active = true;
        p.spilled = canSpill;
        p.x = x + (Math.random() - 0.5) * 0.22;
        p.z = z + (Math.random() - 0.5) * 0.22;
        // Pile higher as foam becomes thicker!
        const densityBoost = Math.min(0.24, (this.activeCount / this.maxFoam) * 0.28);
        p.pileOffset = Math.random() * (0.04 + densityBoost);
        p.y = y + p.pileOffset;
        p.vx = (Math.random() - 0.5) * 0.28;
        p.vy = 0.05 + Math.random() * 0.14;
        p.vz = (Math.random() - 0.5) * 0.28;
        p.baseRadius = 0.65 + Math.random() * 1.15;
        p.scale = 0.08;
        p.age = 0;
        p.maxAge = 75 + Math.random() * 65;
        added++;
      }
    }
    // Occasionally release a big floating iridescent bubble!
    if (added > 0 && Math.random() < 0.22) {
      this.spawnFloatingBubble(x, y + 0.09, z);
    }
  }

  spawnFloatingBubble(x, y, z, sizeMul = 1.0) {
    for (const b of this.bubbles) {
      if (!b.active) {
        b.active = true;
        b.x = x + (Math.random() - 0.5) * 0.14;
        b.y = y;
        b.z = z + (Math.random() - 0.5) * 0.14;
        b.vx = (Math.random() - 0.5) * 0.22;
        b.vy = 0.28 + Math.random() * 0.28;
        b.vz = (Math.random() - 0.5) * 0.18;
        b.radius = (0.62 + Math.random() * 0.85) * sizeMul;
        b.age = 0;
        b.maxAge = 6.5 + Math.random() * 5.0;
        b.mesh.position.set(b.x, b.y, b.z);
        b.mesh.scale.setScalar(0.05);
        b.mesh.visible = true;
        return b;
      }
    }
    return null;
  }

  popBubble(index) {
    const b = this.bubbles[index];
    if (!b || !b.active) return false;
    b.active = false;
    b.mesh.visible = false;
    this.spawnSparkles(b.x, b.y, b.z, 10, 1.05);
    audio.playBubblePop(b.radius);
    return true;
  }

  stirAt(worldX, worldZ, velX, velZ, water, radius = 0.44) {
    // Push foam smoothly with finger/sponge & trigger spillover when full!
    const r2 = radius * radius;
    let poppedAny = false;
    for (let i = 0; i < this.maxFoam; i++) {
      const p = this.puffs[i];
      if (!p.active) continue;
      const dx = p.x - worldX;
      const dz = p.z - worldZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < r2) {
        const d = Math.sqrt(d2) + 0.01;
        const push = (1 - d / radius) * 1.45;
        p.vx += (dx / d) * push * 0.45 + velX * 0.32;
        p.vz += (dz / d) * push * 0.45 + velZ * 0.32;
        p.vy += 0.16 * push;

        // Occasional satisfying mini foam pop when poking
        if (!poppedAny && Math.random() < 0.025) {
          poppedAny = true;
          p.active = false;
          this.spawnSparkles(p.x, p.y + 0.04, p.z, 4, 0.55);
          audio.playBubblePop(p.baseRadius * 0.7);
        }

        // If water is brim-full, poking/stirring pushes foam RIGHT OVER the rim!
        if (!p.spilled && water.level > 0.86) {
          if (p.z > SINK.maxZ - 0.16 || p.x < SINK.minX + 0.14 || p.x > SINK.maxX - 0.14) {
            p.spilled = true;
            p.vy = 0.24 + Math.random() * 0.18;
            p.vz += p.z > 0 ? 0.55 : -0.1;
          }
        }
      }
    }
  }

  wipeSpilledFoamAt(worldX, worldZ, radius = 0.48) {
    // Cotton towel wipes up overflowed foam puffs on the marble countertop!
    const r2 = radius * radius;
    let wipedCount = 0;
    for (let i = 0; i < this.maxFoam; i++) {
      const p = this.puffs[i];
      if (!p.active || !p.spilled) continue;
      const dx = p.x - worldX;
      const dz = p.z - worldZ;
      if (dx * dx + dz * dz < r2) {
        p.active = false;
        this.spawnSparkles(p.x, p.y + 0.03, p.z, 3, 0.4);
        wipedCount++;
      }
    }
    return wipedCount > 0;
  }

  update(dt, water) {
    this.time += dt;
    const clampedDt = Math.min(dt, 0.04);
    this.bubbleShaderMat.uniforms.uTime.value = this.time;

    const surfaceY = water.getSurfaceY();
    const draining = !water.isPlugged && water.level > 0.015;
    let count = 0;

    // 1. Update thick 3D foam puffs
    for (let i = 0; i < this.maxFoam; i++) {
      const p = this.puffs[i];
      if (!p.active) {
        this._dummy.scale.setScalar(0);
        this._dummy.updateMatrix();
        this.foamMesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }

      count++;
      p.age += clampedDt;
      if (p.age > p.maxAge) {
        p.active = false;
        continue;
      }

      // Smooth elastic grow-in
      const targetScale = p.baseRadius * (p.age > p.maxAge - 3 ? Math.max(0, (p.maxAge - p.age) / 3) : 1.0);
      p.scale += (targetScale - p.scale) * Math.min(1, clampedDt * 8.0);

      if (!p.spilled) {
        // Inside the sink: float on water surface waves, gently drift & pile up!
        const waveH = water.getWaveHeightAt(p.x, p.z);
        const targetY = Math.max(SINK.bottomY + 0.04, surfaceY + waveH + p.pileOffset * 0.85);
        p.y += (targetY - p.y) * Math.min(1, clampedDt * 9.0);

        // Push outward slightly from faucet impact stream
        if (water.faucetFlow > 0.05) {
          const fx = p.x - SINK.spoutPos.x;
          const fz = p.z - SINK.spoutPos.z;
          const fd = Math.sqrt(fx * fx + fz * fz) + 0.05;
          if (fd < 0.72) {
            const rep = (1 - fd / 0.72) * water.faucetFlow * 1.45 * clampedDt;
            p.vx += (fx / fd) * rep;
            p.vz += (fz / fd) * rep;
          }
        }

        // Swirling drain suction when unplugged!
        if (draining) {
          const dx = SINK.drainX - p.x;
          const dz = SINK.drainZ - p.z;
          const dist = Math.sqrt(dx * dx + dz * dz) + 0.02;
          const pull = 1.65 * clampedDt;
          // Tangential swirl + radial inward pull
          p.vx += (dx / dist) * pull - (dz / dist) * pull * 1.25;
          p.vz += (dz / dist) * pull + (dx / dist) * pull * 1.25;
          if (dist < 0.13) {
            p.active = false;
            continue;
          }
        }

        p.x += p.vx * clampedDt;
        p.z += p.vz * clampedDt;
        p.vx *= Math.pow(0.18, clampedDt);
        p.vz *= Math.pow(0.18, clampedDt);

        // Check rim spillover when sink is full or overflowing!
        const canSpillOver = water.level > 0.91 && (water.overflowRate > 0.08 || count > 90);
        const nearFront = p.z > SINK.maxZ - 0.06;
        const nearLeft = p.x < SINK.minX + 0.06;
        const nearRight = p.x > SINK.maxX - 0.06;

        if (canSpillOver && (nearFront || nearLeft || nearRight) && Math.random() < clampedDt * (1.8 + water.overflowRate * 3.5)) {
          p.spilled = true;
          p.vy = 0.26;
          if (nearFront) p.vz = 0.52 + Math.random() * 0.45;
          if (nearLeft) p.vx = -0.45 - Math.random() * 0.35;
          if (nearRight) p.vx = 0.45 + Math.random() * 0.35;
        } else {
          // Bounce gently off inner stainless walls
          const pad = 0.06;
          if (p.x < SINK.minX + pad) { p.x = SINK.minX + pad; p.vx = Math.abs(p.vx) * 0.4; }
          if (p.x > SINK.maxX - pad) { p.x = SINK.maxX - pad; p.vx = -Math.abs(p.vx) * 0.4; }
          if (p.z < SINK.minZ + pad) { p.z = SINK.minZ + pad; p.vz = Math.abs(p.vz) * 0.4; }
          if (p.z > SINK.maxZ - pad) { p.z = SINK.maxZ - pad; p.vz = -Math.abs(p.vz) * 0.4; }
        }
      } else {
        // Spilled over the rim onto the marble countertop! Tumbles, slides & jiggles!
        p.vy -= 3.8 * clampedDt;
        p.x += p.vx * clampedDt;
        p.y += p.vy * clampedDt;
        p.z += p.vz * clampedDt;

        const floorY = 0.032 + p.baseRadius * 0.035;
        if (p.y <= floorY && p.z < 1.32) {
          p.y = floorY;
          p.vy = Math.abs(p.vy) * 0.15;
          p.vx *= Math.pow(0.08, clampedDt);
          p.vz *= Math.pow(0.08, clampedDt);
        }
        // Keep foam within countertop bounds or let front-edge foam tumble off!
        if (p.y < -1.2 || Math.abs(p.x) > 2.2) {
          p.active = false;
          continue;
        }
      }

      const jiggle = 1 + Math.sin(this.time * 4.2 + p.wobble) * 0.055;
      this._dummy.position.set(p.x, p.y, p.z);
      this._dummy.scale.set(p.scale * jiggle, p.scale * 0.78 / jiggle, p.scale * jiggle);
      this._dummy.updateMatrix();
      this.foamMesh.setMatrixAt(i, this._dummy.matrix);
    }

    this.activeCount = count;
    this.foamMesh.instanceMatrix.needsUpdate = true;

    // 2. Update floating airborne iridescent soap bubbles!
    for (const b of this.bubbles) {
      if (!b.active) continue;
      b.age += clampedDt;
      if (b.age > b.maxAge || b.y > 3.4) {
        b.active = false;
        b.mesh.visible = false;
        this.spawnSparkles(b.x, b.y, b.z, 5, 0.5);
        continue;
      }
      b.x += (b.vx + Math.sin(this.time * 1.9 + b.phase) * 0.14) * clampedDt;
      b.y += b.vy * clampedDt;
      b.z += (b.vz + Math.cos(this.time * 1.5 + b.phase) * 0.10) * clampedDt;

      const grow = Math.min(1, b.age * 3.2);
      const wobbleX = 1 + Math.sin(this.time * 5.2 + b.phase) * 0.055;
      const wobbleY = 1 / Math.sqrt(wobbleX);
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.scale.set(b.radius * grow * wobbleX, b.radius * grow * wobbleY, b.radius * grow * wobbleX);
    }

    // 3. Update pop sparkles
    let sparkChanged = false;
    for (let i = 0; i < this.maxSparkles; i++) {
      const s = this.sparkles[i];
      if (!s.active) continue;
      sparkChanged = true;
      s.life += clampedDt;
      s.vy -= 2.4 * clampedDt;
      s.x += s.vx * clampedDt;
      s.y += s.vy * clampedDt;
      s.z += s.vz * clampedDt;
      if (s.life >= s.maxLife) {
        s.active = false;
        this._dummy.scale.setScalar(0);
      } else {
        const f = 1 - s.life / s.maxLife;
        this._dummy.position.set(s.x, s.y, s.z);
        this._dummy.scale.setScalar(f * 1.15);
      }
      this._dummy.updateMatrix();
      this.sparkleMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (sparkChanged) {
      this.sparkleMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
