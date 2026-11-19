import * as THREE from 'three';
import { createSoftParticleTexture } from './textures.js';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.steamTex = createSoftParticleTexture('rgba(255,252,246,1)', 'rgba(255,252,246,0)');
    this.sparkTex = createSoftParticleTexture('rgba(195,236,255,1)', 'rgba(80,170,255,0)');
    this.goldTex = createSoftParticleTexture('rgba(255,232,140,1)', 'rgba(255,175,60,0)');

    this.sprites = [];
    this.bubbles = [];
    this.droplets = [];

    this.bubbleGeo = new THREE.SphereGeometry(1, 16, 12);
    this.bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0.05,
      transmission: 0.85,
      transparent: true,
      opacity: 0.72,
      ior: 1.33,
      iridescence: 1.0,
      iridescenceIOR: 1.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });

    this.dropGeo = new THREE.SphereGeometry(1, 8, 8);
    this.waterDropMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f7ff,
      roughness: 0.06,
      metalness: 0.0,
      transparent: true,
      opacity: 0.78,
      clearcoat: 1.0,
    });
    this.oilDropMat = new THREE.MeshStandardMaterial({
      color: 0xffd268,
      roughness: 0.15,
      metalness: 0.1,
    });
    this.spiceMat = new THREE.MeshStandardMaterial({
      color: 0xfff8e6,
      roughness: 0.4,
    });
    this.herbMat = new THREE.MeshStandardMaterial({
      color: 0x3b8c32,
      roughness: 0.55,
    });
  }

  spawnSteam(pos, { count = 1, scale = 0.09, speed = 0.18, opacity = 0.28, color = 0xfffaf2 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.sprites.length > 90) break;
      const mat = new THREE.SpriteMaterial({
        map: this.steamTex,
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.position.set(
        pos.x + (Math.random() - 0.5) * 0.09,
        pos.y + Math.random() * 0.02,
        pos.z + (Math.random() - 0.5) * 0.09
      );
      const s0 = scale * (0.65 + Math.random() * 0.5);
      sp.scale.set(s0, s0, 1);
      this.group.add(sp);
      this.sprites.push({
        mesh: sp,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.04, speed * (0.7 + Math.random() * 0.5), (Math.random() - 0.5) * 0.03),
        age: 0,
        life: 1.2 + Math.random() * 1.1,
        baseScale: s0,
        grow: 2.2,
        maxOpacity: opacity,
        driftPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  spawnSpark(pos, count = 6) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.sparkTex,
        color: 0xb8ecff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.position.copy(pos);
      sp.scale.set(0.032, 0.032, 1);
      this.group.add(sp);
      const a = Math.random() * Math.PI * 2;
      this.sprites.push({
        mesh: sp,
        vel: new THREE.Vector3(Math.cos(a) * (0.25 + Math.random() * 0.35), 0.15 + Math.random() * 0.25, Math.sin(a) * (0.25 + Math.random() * 0.35)),
        age: 0,
        life: 0.18 + Math.random() * 0.12,
        baseScale: 0.032,
        grow: 0.3,
        maxOpacity: 1.0,
        driftPhase: 0,
      });
    }
  }

  spawnGoldSparkle(pos, count = 8, spread = 0.22) {
    for (let i = 0; i < count; i++) {
      if (this.sprites.length > 110) break;
      const mat = new THREE.SpriteMaterial({
        map: this.goldTex,
        color: i % 2 === 0 ? 0xffe072 : 0xff9eb5,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.position.set(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + (Math.random() - 0.5) * spread * 0.5,
        pos.z + (Math.random() - 0.5) * spread
      );
      const s0 = 0.035 + Math.random() * 0.04;
      sp.scale.set(s0, s0, 1);
      this.group.add(sp);
      this.sprites.push({
        mesh: sp,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.18, 0.18 + Math.random() * 0.22, (Math.random() - 0.5) * 0.18),
        age: 0,
        life: 0.75 + Math.random() * 0.65,
        baseScale: s0,
        grow: 0.5,
        maxOpacity: 0.95,
        driftPhase: Math.random() * 6,
      });
    }
  }

  spawnSoapBubble(pos, { count = 3, floatUp = true, radiusMin = 0.011, radiusMax = 0.026 } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.bubbles.length > 75) {
        const old = this.bubbles.shift();
        this.group.remove(old.mesh);
      }
      const r = radiusMin + Math.random() * (radiusMax - radiusMin);
      const m = new THREE.Mesh(this.bubbleGeo, this.bubbleMat);
      m.position.set(
        pos.x + (Math.random() - 0.5) * 0.09,
        pos.y + Math.random() * 0.03,
        pos.z + (Math.random() - 0.5) * 0.09
      );
      m.scale.setScalar(0.001);
      this.group.add(m);
      this.bubbles.push({
        mesh: m,
        targetR: r,
        vel: floatUp
          ? new THREE.Vector3((Math.random() - 0.5) * 0.06, 0.09 + Math.random() * 0.14, (Math.random() - 0.5) * 0.06)
          : new THREE.Vector3((Math.random() - 0.5) * 0.015, 0.004, (Math.random() - 0.5) * 0.015),
        age: 0,
        life: floatUp ? 1.8 + Math.random() * 1.8 : 2.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  spawnDroplets(pos, { count = 5, kind = 'water', spread = 0.14 } = {}) {
    const mat = kind === 'oil' ? this.oilDropMat : kind === 'spice' ? this.spiceMat : kind === 'herb' ? this.herbMat : this.waterDropMat;
    for (let i = 0; i < count; i++) {
      if (this.droplets.length > 90) break;
      const m = new THREE.Mesh(this.dropGeo, mat);
      const r = kind === 'spice' || kind === 'herb' ? 0.0045 : 0.006 + Math.random() * 0.005;
      m.scale.setScalar(r);
      m.position.set(
        pos.x + (Math.random() - 0.5) * 0.06,
        pos.y,
        pos.z + (Math.random() - 0.5) * 0.06
      );
      this.group.add(m);
      this.droplets.push({
        mesh: m,
        vel: kind === 'spice' || kind === 'herb'
          ? new THREE.Vector3((Math.random() - 0.5) * 0.08, -0.15 - Math.random() * 0.15, (Math.random() - 0.5) * 0.08)
          : new THREE.Vector3((Math.random() - 0.5) * spread, 0.22 + Math.random() * 0.24, (Math.random() - 0.5) * spread),
        age: 0,
        life: kind === 'spice' || kind === 'herb' ? 0.55 : 0.42 + Math.random() * 0.22,
        gravity: kind === 'spice' || kind === 'herb' ? 0.9 : 2.2,
      });
    }
  }

  update(dt, elapsed) {
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const p = this.sprites[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        this.group.remove(p.mesh);
        p.mesh.material.dispose();
        this.sprites.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.driftPhase) {
        p.mesh.position.x += Math.sin(elapsed * 2.4 + p.driftPhase) * 0.015 * dt;
      }
      const s = p.baseScale * (1 + t * p.grow);
      p.mesh.scale.set(s, s, 1);
      const alpha = t < 0.2 ? (t / 0.2) : (1 - (t - 0.2) / 0.8);
      p.mesh.material.opacity = Math.max(0, alpha * p.maxOpacity);
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      const t = b.age / b.life;
      if (t >= 1) {
        this.group.remove(b.mesh);
        this.bubbles.splice(i, 1);
        continue;
      }
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.position.x += Math.sin(elapsed * 3.1 + b.phase) * 0.018 * dt;
      const popIn = Math.min(1, b.age * 8);
      const wobble = 1 + Math.sin(elapsed * 7 + b.phase) * 0.06;
      const r = b.targetR * popIn * (t > 0.9 ? (1 - (t - 0.9) * 10) : 1);
      b.mesh.scale.set(r * wobble, r / wobble, r * wobble);
    }

    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.age += dt;
      if (d.age >= d.life) {
        this.group.remove(d.mesh);
        this.droplets.splice(i, 1);
        continue;
      }
      d.vel.y -= d.gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
    }
  }
}
