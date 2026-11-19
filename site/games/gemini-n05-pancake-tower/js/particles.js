import * as THREE from 'three';
import { createSoftParticleTexture } from './textures.js';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.tex = createSoftParticleTexture();
    this.particles = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    // Floating sunlit morning dust motes (ambient atmosphere)
    this.motes = [];
    const moteGeo = new THREE.PlaneGeometry(0.032, 0.032);
    const moteMat = new THREE.MeshBasicMaterial({
      map: this.tex,
      color: 0xfff3d4,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.tex,
          color: 0xfff1cc,
          transparent: true,
          opacity: 0.25 + Math.random() * 0.25,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      const s = 0.028 + Math.random() * 0.038;
      m.scale.set(s, s, 1);
      m.position.set(
        (Math.random() - 0.5) * 4.2,
        0.25 + Math.random() * 1.9,
        -1.6 + Math.random() * 3.0
      );
      m.userData = {
        baseX: m.position.x,
        baseY: m.position.y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.4,
      };
      this.group.add(m);
      this.motes.push(m);
    }
    moteGeo.dispose();
    moteMat.dispose();
  }

  emit({
    pos,
    vel = new THREE.Vector3(0, 0.3, 0),
    color = 0xffffff,
    size = 0.14,
    endSize = 0.32,
    life = 1.4,
    opacity = 0.28,
    gravity = 0,
    additive = false,
  }) {
    if (this.particles.length > 140) return;
    const mat = new THREE.SpriteMaterial({
      map: this.tex,
      color,
      transparent: true,
      opacity: 0.01,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    sp.scale.set(size, size, 1);
    this.group.add(sp);
    this.particles.push({
      sprite: sp,
      mat,
      vel: vel.clone(),
      age: 0,
      life,
      startSize: size,
      endSize,
      maxOpacity: opacity,
      gravity,
      swayPhase: Math.random() * Math.PI * 2,
    });
  }

  emitSteam(pos, strength = 1) {
    this.emit({
      pos: new THREE.Vector3(
        pos.x + (Math.random() - 0.5) * 0.28,
        pos.y + 0.03,
        pos.z + (Math.random() - 0.5) * 0.28
      ),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.07,
        0.22 + Math.random() * 0.14,
        (Math.random() - 0.5) * 0.07
      ),
      color: 0xfffaf2,
      size: 0.11 * strength,
      endSize: 0.36 * strength,
      life: 1.5 + Math.random() * 0.8,
      opacity: 0.19 * Math.min(1.2, strength),
      gravity: 0.02,
    });
  }

  emitFlourPuff(pos) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.15 + Math.random() * 0.35;
      this.emit({
        pos: new THREE.Vector3(pos.x + Math.cos(a) * 0.1, pos.y + 0.04, pos.z + Math.sin(a) * 0.1),
        vel: new THREE.Vector3(Math.cos(a) * spd, 0.24 + Math.random() * 0.28, Math.sin(a) * spd),
        color: 0xfffcf6,
        size: 0.09 + Math.random() * 0.08,
        endSize: 0.28,
        life: 0.75 + Math.random() * 0.45,
        opacity: 0.46,
        gravity: -0.25,
      });
    }
  }

  emitSparkles(pos, count = 12, color = 0xffe08a) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.2 + Math.random() * 0.65;
      this.emit({
        pos: new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.25, pos.y + Math.random() * 0.25, pos.z + (Math.random() - 0.5) * 0.25),
        vel: new THREE.Vector3(Math.cos(a) * spd, 0.45 + Math.random() * 0.55, Math.sin(a) * spd),
        color,
        size: 0.065 + Math.random() * 0.055,
        endSize: 0.015,
        life: 0.7 + Math.random() * 0.5,
        opacity: 0.85,
        gravity: -0.45,
        additive: true,
      });
    }
  }

  emitCrumbs(pos, count = 7) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.28 + Math.random() * 0.48;
      this.emit({
        pos: pos.clone(),
        vel: new THREE.Vector3(Math.cos(a) * spd, 0.35 + Math.random() * 0.35, Math.sin(a) * spd),
        color: Math.random() > 0.35 ? 0xe7b665 : 0xf4dca5,
        size: 0.036 + Math.random() * 0.025,
        endSize: 0.02,
        life: 0.55 + Math.random() * 0.25,
        opacity: 0.9,
        gravity: -1.7,
      });
    }
  }

  update(dt, time) {
    for (const m of this.motes) {
      const d = m.userData;
      m.position.x = d.baseX + Math.sin(time * d.speed + d.phase) * 0.14;
      m.position.y = d.baseY + Math.cos(time * d.speed * 0.7 + d.phase) * 0.08;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.group.remove(p.sprite);
        p.mat.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.age / p.life;
      p.vel.y += p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.position.x += Math.sin(time * 2.2 + p.swayPhase) * 0.03 * dt;

      const s = p.startSize + (p.endSize - p.startSize) * t;
      p.sprite.scale.set(s, s, 1);

      // Smooth fade-in then fade-out
      const fadeIn = Math.min(1, t / 0.18);
      const fadeOut = 1 - Math.max(0, (t - 0.35) / 0.65);
      p.mat.opacity = p.maxOpacity * fadeIn * fadeOut;
    }
  }
}
