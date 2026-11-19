import * as THREE from 'three';
import { SINK } from './kitchen.js';
import { createCausticsTexture } from './textures.js';
import { audio } from './audio.js';

export class WaterSystem {
  constructor(scene) {
    this.scene = scene;

    // Core simulation state
    this.level = 0.0; // 0.0 (empty) .. 1.0 (brim full at rim!)
    this.faucetFlow = 0.0; // 0 .. 1
    this.targetFlow = 0.0;
    this.isPlugged = true;
    this.soapiness = 0.0; // 0 .. 1.5
    this.overflowRate = 0.0; // current spill intensity
    this.puddleAmount = 0.0; // 0 .. 1.0 accumulated water on counter
    this.vortexPhase = 0.0;
    this.time = 0;

    // Idle drip timer (when faucet is off and sink is empty)
    this.dripTimer = 1.2;
    this.idleDripMesh = null;
    this.idleDripState = { active: false, y: SINK.spoutPos.y, vy: 0, grow: 0 };

    // 2D Shallow-water heightfield grid
    this.gx = 38;
    this.gz = 26;
    const count = this.gx * this.gz;
    this.hCurr = new Float32Array(count);
    this.hPrev = new Float32Array(count);

    this._buildWaterSurface();
    this._buildCaustics();
    this._buildFaucetStream();
    this._buildOverflowVisuals();
    this._buildSplashDroplets();
    this._buildIdleDrip();
  }

  getSurfaceY() {
    // Maps level 0..1 from bottomY+0.01 to rimY+0.018 (slightly proud surface tension dome at brim!)
    return THREE.MathUtils.lerp(SINK.bottomY + 0.012, SINK.rimY + 0.018, this.level);
  }

  _buildWaterSurface() {
    const geo = new THREE.PlaneGeometry(SINK.width - 0.01, SINK.depth - 0.01, this.gx - 1, this.gz - 1);
    geo.rotateX(-Math.PI / 2);

    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x96d9e8),
      roughness: 0.03,
      metalness: 0.06,
      transparent: true,
      opacity: 0.62,
      ior: 1.333,
      reflectivity: 0.98,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.75,
      side: THREE.DoubleSide
    });

    this.waterMesh = new THREE.Mesh(geo, this.waterMat);
    this.waterMesh.position.set(0, SINK.bottomY, 0);
    this.waterMesh.visible = false;
    this.waterMesh.renderOrder = 2;
    this.scene.add(this.waterMesh);

    // Invisible raycast plane for touching water surface
    this.waterHit = new THREE.Mesh(
      new THREE.PlaneGeometry(SINK.width, SINK.depth),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.waterHit.rotation.x = -Math.PI / 2;
    this.waterHit.position.set(0, SINK.bottomY + 0.02, 0);
    this.waterHit.userData = { type: 'water' };
    this.scene.add(this.waterHit);
  }

  _buildCaustics() {
    this.causticsTex = createCausticsTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: this.causticsTex,
      color: 0xdcf4ff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.causticsMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SINK.width - 0.06, SINK.depth - 0.06),
      mat
    );
    this.causticsMesh.rotation.x = -Math.PI / 2;
    this.causticsMesh.position.set(0, SINK.bottomY + 0.009, 0);
    this.scene.add(this.causticsMesh);
  }

  _buildFaucetStream() {
    // Tapered glistening water column from spout to surface
    const geo = new THREE.CylinderGeometry(0.024, 0.036, 1.0, 18, 16, true);
    geo.translate(0, -0.5, 0); // top anchored at y=0

    this.streamMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff6ff,
      roughness: 0.05,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.8,
      side: THREE.DoubleSide
    });
    this.streamMesh = new THREE.Mesh(geo, this.streamMat);
    this.streamMesh.position.copy(SINK.spoutPos);
    this.streamMesh.visible = false;
    this.streamMesh.renderOrder = 3;
    this.scene.add(this.streamMesh);

    // Inner bright aerated white core inside stream for real faucet aerator look
    const coreGeo = new THREE.CylinderGeometry(0.012, 0.022, 1.0, 12, 10, true);
    coreGeo.translate(0, -0.5, 0);
    this.streamCore = new THREE.Mesh(
      coreGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
      })
    );
    this.streamMesh.add(this.streamCore);

    // Hit box for touching the falling water stream!
    this.streamHit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 1.4, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.streamHit.position.set(SINK.spoutPos.x, 0.15, SINK.spoutPos.z);
    this.streamHit.userData = { type: 'stream' };
    this.scene.add(this.streamHit);

    // Impact splash ring where stream hits water/sink
    this.splashRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.018, 10, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.12,
        transparent: true,
        opacity: 0.72,
        clearcoat: 1.0
      })
    );
    this.splashRing.rotation.x = Math.PI / 2;
    this.splashRing.visible = false;
    this.scene.add(this.splashRing);
  }

  _buildOverflowVisuals() {
    this.overflowGroup = new THREE.Group();
    this.scene.add(this.overflowGroup);

    // Glossy thin water puddle discs spreading across the marble countertop around the sink!
    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0xaadfeb,
      roughness: 0.02,
      metalness: 0.08,
      transparent: true,
      opacity: 0.58,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.0,
      depthWrite: false
    });

    const puddleSpecs = [
      // Front counter spill pools (the most dramatic & visible!)
      { x: -0.35, z: 1.02, sx: 0.68, sz: 0.34, delay: 0.0 },
      { x: 0.28, z: 1.05, sx: 0.74, sz: 0.35, delay: 0.06 },
      { x: 0.85, z: 0.99, sx: 0.45, sz: 0.28, delay: 0.15 },
      // Left & right rim spills
      { x: -1.32, z: 0.25, sx: 0.34, sz: 0.62, delay: 0.12 },
      { x: 1.24, z: -0.34, sx: 0.28, sz: 0.48, delay: 0.18 },
      // Back rim puddle around faucet
      { x: -0.52, z: -0.94, sx: 0.48, sz: 0.22, delay: 0.22 }
    ];

    this.puddles = puddleSpecs.map((spec) => {
      // Irregular organic puddle silhouette
      const shape = new THREE.Shape();
      const pts = 24;
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const r = 1.0 + Math.sin(a * 3 + spec.x * 4) * 0.14 + Math.cos(a * 5 + spec.z * 3) * 0.08;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) shape.moveTo(px, py);
        else shape.lineTo(px, py);
      }
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, puddleMat.clone());
      mesh.position.set(spec.x, 0.005, spec.z);
      mesh.scale.set(0.001, 1, 0.001);
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.overflowGroup.add(mesh);
      return { mesh, spec, current: 0 };
    });

    // Rim Waterfall Ribbons (soft feathered glossy liquid sheets arching over the front steel rim — zero hard edges!)
    const spillCanvas = document.createElement('canvas');
    spillCanvas.width = 128;
    spillCanvas.height = 128;
    const sCtx = spillCanvas.getContext('2d');
    const sGrad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
    sGrad.addColorStop(0.0, 'rgba(235, 250, 255, 0.92)');
    sGrad.addColorStop(0.55, 'rgba(190, 236, 248, 0.52)');
    sGrad.addColorStop(1.0, 'rgba(180, 230, 245, 0.0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 128, 128);
    const spillTex = new THREE.CanvasTexture(spillCanvas);

    this.rimSpills = [];
    const spillMat = new THREE.MeshBasicMaterial({
      map: spillTex,
      color: 0xdff6ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const spillX = [-0.72, -0.32, 0.08, 0.45, 0.78];
    spillX.forEach((sx) => {
      const geo = new THREE.PlaneGeometry(0.38, 0.32, 4, 8);
      geo.rotateX(-Math.PI / 2);
      // Arch gently up and over the stainless steel rim lip!
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i); // -0.16 .. +0.16
        const arch = Math.cos((z / 0.16) * Math.PI * 0.5) * 0.028;
        pos.setY(i, 0.012 + arch);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, spillMat.clone());
      m.position.set(sx, 0, SINK.maxZ + 0.06);
      m.visible = false;
      m.renderOrder = 4;
      this.overflowGroup.add(m);
      this.rimSpills.push({ mesh: m, phase: Math.random() * 10 });
    });

    // Front counter-edge falling overflow drips!
    this.counterDrips = [];
    const dropGeo = new THREE.SphereGeometry(0.022, 10, 10);
    dropGeo.scale(0.85, 1.45, 0.85);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2f7ff,
      roughness: 0.04,
      transparent: true,
      opacity: 0.82,
      clearcoat: 1.0,
      envMapIntensity: 1.7
    });
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      m.visible = false;
      this.overflowGroup.add(m);
      this.counterDrips.push({
        mesh: m,
        active: false,
        x: 0,
        y: 0,
        z: 1.30,
        vy: 0
      });
    }
    this.dripSpawnTimer = 0;
  }

  _buildSplashDroplets() {
    this.maxDroplets = 110;
    const geo = new THREE.SphereGeometry(0.019, 8, 8);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f8ff,
      roughness: 0.05,
      transparent: true,
      opacity: 0.84,
      clearcoat: 1.0,
      envMapIntensity: 1.6
    });
    this.dropletMesh = new THREE.InstancedMesh(geo, mat, this.maxDroplets);
    this.dropletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.dropletMesh);

    this.droplets = [];
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < this.maxDroplets; i++) {
      this.droplets.push({
        active: false,
        x: 0, y: -10, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1
      });
      this.dropletMesh.setMatrixAt(i, dummy.matrix);
    }
    this.dropletMesh.instanceMatrix.needsUpdate = true;
    this._dummy = new THREE.Object3D();
  }

  _buildIdleDrip() {
    const geo = new THREE.SphereGeometry(0.022, 12, 12);
    geo.scale(0.85, 1.35, 0.85);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xe5f7ff,
      roughness: 0.03,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1.0,
      envMapIntensity: 1.8
    });
    this.idleDripMesh = new THREE.Mesh(geo, mat);
    this.idleDripMesh.visible = false;
    this.scene.add(this.idleDripMesh);
  }

  spawnSplash(x, y, z, count = 8, speed = 1.6) {
    let spawned = 0;
    for (let i = 0; i < this.maxDroplets && spawned < count; i++) {
      const d = this.droplets[i];
      if (!d.active) {
        d.active = true;
        d.x = x + (Math.random() - 0.5) * 0.08;
        d.y = y + 0.02;
        d.z = z + (Math.random() - 0.5) * 0.08;
        const a = Math.random() * Math.PI * 2;
        const r = (0.35 + Math.random() * 0.85) * speed;
        d.vx = Math.cos(a) * r * 0.65;
        d.vy = (0.65 + Math.random() * 0.95) * speed;
        d.vz = Math.sin(a) * r * 0.65;
        d.life = 0;
        d.maxLife = 0.42 + Math.random() * 0.35;
        d.size = 0.55 + Math.random() * 0.85;
        spawned++;
      }
    }
  }

  addRipple(worldX, worldZ, strength = 0.045, radiusCells = 2) {
    if (this.level <= 0.015) return;
    const u = (worldX - SINK.minX) / SINK.width;
    const v = (worldZ - SINK.minZ) / SINK.depth;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;

    const cx = Math.floor(u * (this.gx - 1));
    const cz = Math.floor(v * (this.gz - 1));
    for (let dz = -radiusCells; dz <= radiusCells; dz++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const ix = cx + dx;
        const iz = cz + dz;
        if (ix > 1 && ix < this.gx - 2 && iz > 1 && iz < this.gz - 2) {
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= radiusCells) {
            const falloff = Math.cos((dist / (radiusCells + 0.1)) * Math.PI * 0.5);
            this.hCurr[iz * this.gx + ix] += strength * falloff;
          }
        }
      }
    }

    // Extra splash overflow when poking a brim-full sink! ("ちょっかいで更に溢れる"!)
    if (this.level > 0.88) {
      const surge = Math.min(0.65, Math.abs(strength) * 7.5) * ((this.level - 0.85) / 0.15);
      this.overflowRate = Math.min(1.4, this.overflowRate + surge);
      this.puddleAmount = Math.min(1.0, this.puddleAmount + surge * 0.09);
      this.spawnSplash(
        THREE.MathUtils.clamp(worldX, SINK.minX + 0.1, SINK.maxX - 0.1),
        this.getSurfaceY() + 0.02,
        SINK.maxZ + 0.02,
        Math.ceil(3 + surge * 6),
        1.25
      );
    }
  }

  wipeCounterAt(worldX, worldZ, amount = 0.08) {
    // Cotton towel absorbs spilled countertop water!
    if (this.puddleAmount <= 0.001) return false;
    let wiped = false;
    for (const p of this.puddles) {
      const dx = worldX - p.spec.x;
      const dz = worldZ - p.spec.z;
      if (dx * dx + dz * dz < 0.72 * 0.72 && p.current > 0.02) {
        p.current = Math.max(0, p.current - amount);
        wiped = true;
      }
    }
    if (wiped) {
      let maxP = 0;
      for (const p of this.puddles) maxP = Math.max(maxP, p.current);
      this.puddleAmount = maxP;
    }
    return wiped;
  }

  getWaveHeightAt(worldX, worldZ) {
    if (this.level <= 0.015) return 0;
    const u = THREE.MathUtils.clamp((worldX - SINK.minX) / SINK.width, 0, 1);
    const v = THREE.MathUtils.clamp((worldZ - SINK.minZ) / SINK.depth, 0, 1);
    const ix = Math.floor(u * (this.gx - 1));
    const iz = Math.floor(v * (this.gz - 1));
    return this.hCurr[iz * this.gx + ix] || 0;
  }

  update(dt, foamSystem) {
    this.time += dt;
    const clampedDt = Math.min(dt, 0.04);

    // Smooth faucet flow transition
    this.faucetFlow += (this.targetFlow - this.faucetFlow) * Math.min(1, clampedDt * 9);

    // Fill or Drain water level
    const fillSpeed = 0.115; // fills completely in ~8.5 seconds of full stream
    const drainSpeed = 0.17;
    let vortexStrength = 0;

    if (this.faucetFlow > 0.02) {
      this.level += this.faucetFlow * fillSpeed * clampedDt;
    }

    if (!this.isPlugged && this.level > 0.001) {
      const out = drainSpeed * (0.45 + 0.55 * this.level) * clampedDt;
      this.level = Math.max(0, this.level - out);
      vortexStrength = Math.min(1, this.level * 2.2);
      this.vortexPhase += clampedDt * (6.5 + (1 - this.level) * 9.0);
      // Gradually dilute soap as water drains
      this.soapiness = Math.max(0, this.soapiness - out * 0.45);
    }

    // Overflow logic when full!
    let targetOverflow = 0;
    if (this.level >= 1.0) {
      const excess = this.level - 1.0;
      this.level = 1.0;
      if (this.faucetFlow > 0.05) {
        targetOverflow = 0.45 + this.faucetFlow * 0.75 + excess * 4.0;
        this.puddleAmount = Math.min(1.0, this.puddleAmount + clampedDt * 0.16 * this.faucetFlow);
      }
    }
    this.overflowRate += (targetOverflow - this.overflowRate) * Math.min(1, clampedDt * 3.5);
    if (this.overflowRate < 0.01) this.overflowRate = 0;

    // Update Water Surface visibility & height
    const surfaceY = this.getSurfaceY();
    this.waterMesh.visible = this.level > 0.012;
    this.waterMesh.position.y = surfaceY;
    this.waterHit.position.y = Math.max(SINK.bottomY + 0.03, surfaceY);

    // Water material becomes lush milky-pearlescent as soap increases
    const s = Math.min(1, this.soapiness);
    this.waterMat.color.setRGB(
      THREE.MathUtils.lerp(0.56, 0.88, s),
      THREE.MathUtils.lerp(0.84, 0.94, s),
      THREE.MathUtils.lerp(0.92, 0.97, s)
    );
    this.waterMat.opacity = THREE.MathUtils.lerp(0.58, 0.78, s);

    // Animate underwater caustics
    this.causticsMesh.material.opacity = this.level > 0.03 ? Math.min(0.45, this.level * 0.48) * (1 - s * 0.55) : 0;
    this.causticsTex.offset.x = Math.sin(this.time * 0.65) * 0.18 + this.time * 0.04;
    this.causticsTex.offset.y = Math.cos(this.time * 0.52) * 0.16 + this.time * 0.03;

    // Faucet stream geometry & splash excitation
    if (this.faucetFlow > 0.02) {
      this.streamMesh.visible = true;
      const hitY = this.level > 0.015 ? surfaceY : SINK.bottomY + 0.01;
      const len = Math.max(0.08, SINK.spoutPos.y - hitY);
      const thickness = 0.45 + this.faucetFlow * 0.72;
      const wobble = 1.0 + Math.sin(this.time * 38) * 0.045;
      this.streamMesh.scale.set(thickness * wobble, len, thickness / wobble);
      this.streamMat.opacity = 0.45 + this.faucetFlow * 0.34;

      // Splash ring at water impact
      this.splashRing.visible = true;
      const pulse = 0.85 + Math.sin(this.time * 24) * 0.22;
      this.splashRing.position.set(SINK.spoutPos.x, hitY + 0.014, SINK.spoutPos.z);
      this.splashRing.scale.setScalar(pulse * (0.65 + this.faucetFlow * 0.55));
      this.splashRing.material.opacity = 0.45 + this.faucetFlow * 0.32;

      // Excite waves continuously under faucet stream
      if (this.level > 0.015) {
        this.addRipple(
          SINK.spoutPos.x + (Math.random() - 0.5) * 0.06,
          SINK.spoutPos.z + (Math.random() - 0.5) * 0.06,
          -0.022 * this.faucetFlow,
          2
        );
      }

      // Splash droplets from stream impact
      if (Math.random() < this.faucetFlow * 0.75) {
        this.spawnSplash(SINK.spoutPos.x, hitY, SINK.spoutPos.z, 2, 1.05 * this.faucetFlow);
      }

      // Running faucet onto soapy water whips up lush foam automatically!
      if (foamSystem && this.soapiness > 0.08 && this.level > 0.04) {
        if (Math.random() < this.faucetFlow * (0.35 + this.soapiness * 0.45)) {
          foamSystem.addFoamCluster(
            SINK.spoutPos.x + (Math.random() - 0.5) * 0.28,
            surfaceY + 0.02,
            SINK.spoutPos.z + (Math.random() - 0.5) * 0.24,
            1 + Math.floor(this.soapiness * 2)
          );
        }
      }
    } else {
      this.streamMesh.visible = false;
      this.splashRing.visible = false;
    }

    // Idle single droplet affordance at spout when water is off & sink is empty
    this._updateIdleDrip(clampedDt);

    // Step 2D Wave Heightfield + Whirlpool Vortex
    if (this.waterMesh.visible) {
      this._stepWaveSimulation(vortexStrength);
    }

    // Update Overflow Puddles, Rim Waterfalls, and Front Counter Drips
    this._updateOverflowVisuals(clampedDt);

    // Update Splash Droplet Particles
    this._updateSplashDroplets(clampedDt, surfaceY);

    // Update continuous audio synthesis
    audio.updateContinuous(
      this.faucetFlow,
      this.level,
      this.overflowRate,
      vortexStrength,
      clampedDt
    );
  }

  _stepWaveSimulation(vortexStrength) {
    const gx = this.gx;
    const gz = this.gz;
    const curr = this.hCurr;
    const prev = this.hPrev;
    const damping = 0.962;

    for (let z = 1; z < gz - 1; z++) {
      const row = z * gx;
      for (let x = 1; x < gx - 1; x++) {
        const i = row + x;
        const avg = (curr[i - 1] + curr[i + 1] + curr[i - gx] + curr[i + gx]) * 0.5;
        let next = (avg - prev[i]) * damping;
        next = THREE.MathUtils.clamp(next, -0.075, 0.075);
        prev[i] = next;
      }
    }

    // Swap buffers
    this.hCurr = prev;
    this.hPrev = curr;

    // Write vertex Y displacements into PlaneGeometry
    const pos = this.waterMesh.geometry.attributes.position;
    const halfW = (SINK.width - 0.01) * 0.5;
    const halfD = (SINK.depth - 0.01) * 0.5;

    for (let z = 0; z < gz; z++) {
      for (let x = 0; x < gx; x++) {
        const i = z * gx + x;
        const wx = (x / (gx - 1) - 0.5) * 2 * halfW;
        const wz = (z / (gz - 1) - 0.5) * 2 * halfD;

        let h = this.hCurr[i];
        // Subtle ambient organic water shimmer
        h += Math.sin(wx * 4.5 + this.time * 2.1) * Math.cos(wz * 4.2 - this.time * 1.8) * 0.004;

        // Swirling 3D Whirlpool Funnel when unplugged!
        if (vortexStrength > 0.01) {
          const dx = wx - SINK.drainX;
          const dz = wz - SINK.drainZ;
          const r = Math.sqrt(dx * dx + dz * dz);
          const angle = Math.atan2(dz, dx);
          const funnel = -vortexStrength * 0.24 * Math.exp(-r * r * 14.0);
          const spiral = Math.sin(angle * 3.0 - this.vortexPhase + r * 14.0) * 0.014 * vortexStrength * Math.exp(-r * 2.2);
          h += funnel + spiral;
        }

        pos.setY(i, h);
      }
    }
    pos.needsUpdate = true;
    this.waterMesh.geometry.computeVertexNormals();
  }

  _updateOverflowVisuals(dt) {
    // Smoothly grow puddles toward puddleAmount
    for (const p of this.puddles) {
      const target = Math.max(0, (this.puddleAmount - p.spec.delay) / (1 - p.spec.delay));
      if (target > p.current) {
        p.current += (target - p.current) * Math.min(1, dt * 2.2);
      }
      if (p.current > 0.01) {
        p.mesh.visible = true;
        const ripple = 1 + Math.sin(this.time * 3.5 + p.spec.x * 5) * 0.015;
        p.mesh.scale.set(p.spec.sx * p.current * ripple, 1, p.spec.sz * p.current * ripple);
        p.mesh.material.opacity = Math.min(0.58, 0.25 + p.current * 0.35);
      } else {
        p.mesh.visible = false;
      }
    }

    // Active translucent water sheets cascading over the front stainless rim!
    for (const r of this.rimSpills) {
      if (this.overflowRate > 0.04) {
        r.mesh.visible = true;
        const pulse = 0.72 + Math.sin(this.time * 9.5 + r.phase) * 0.28;
        r.mesh.material.opacity = Math.min(0.68, this.overflowRate * 0.56 * pulse);
        r.mesh.scale.set(0.85 + pulse * 0.25, 1, 0.8 + this.overflowRate * 0.45);
      } else {
        r.mesh.visible = false;
      }
    }

    // Dripping water drops off the front edge of the marble countertop!
    if (this.puddleAmount > 0.22 || this.overflowRate > 0.2) {
      this.dripSpawnTimer -= dt * (0.8 + this.puddleAmount * 2.6 + this.overflowRate * 2.2);
      if (this.dripSpawnTimer <= 0) {
        this.dripSpawnTimer = 0.35 + Math.random() * 0.55;
        for (const d of this.counterDrips) {
          if (!d.active) {
            d.active = true;
            d.x = -0.82 + Math.random() * 1.65;
            d.y = -0.02;
            d.z = 1.295;
            d.vy = -0.15;
            d.mesh.position.set(d.x, d.y, d.z);
            d.mesh.visible = true;
            if (Math.random() < 0.6) audio.playDrip(0.95 + Math.random() * 0.35, 0.09);
            break;
          }
        }
      }
    }

    for (const d of this.counterDrips) {
      if (!d.active) continue;
      d.vy -= 5.2 * dt;
      d.y += d.vy * dt;
      d.mesh.position.set(d.x, d.y, d.z);
      if (d.y < -1.55) {
        d.active = false;
        d.mesh.visible = false;
      }
    }
  }

  _updateSplashDroplets(dt, surfaceY) {
    let anyChanged = false;
    for (let i = 0; i < this.maxDroplets; i++) {
      const d = this.droplets[i];
      if (!d.active) continue;
      anyChanged = true;
      d.life += dt;
      d.vy -= 6.8 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      if (d.life >= d.maxLife || d.y < SINK.bottomY - 0.1) {
        d.active = false;
        this._dummy.scale.setScalar(0);
      } else {
        const fade = 1 - d.life / d.maxLife;
        this._dummy.position.set(d.x, d.y, d.z);
        this._dummy.scale.set(d.size * fade, d.size * fade * 1.25, d.size * fade);
      }
      this._dummy.updateMatrix();
      this.dropletMesh.setMatrixAt(i, this._dummy.matrix);
    }
    if (anyChanged) {
      this.dropletMesh.instanceMatrix.needsUpdate = true;
    }
  }

  _updateIdleDrip(dt) {
    // Gentle single crystal drop from faucet spout when faucet is off -> natural wordless affordance!
    if (this.faucetFlow > 0.04) {
      this.idleDripState.active = false;
      this.idleDripMesh.visible = false;
      return;
    }

    if (!this.idleDripState.active) {
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) {
        this.idleDripState.active = true;
        this.idleDripState.grow = 0;
        this.idleDripState.y = SINK.spoutPos.y - 0.015;
        this.idleDripState.vy = 0;
        this.idleDripMesh.visible = true;
        this.dripTimer = 2.8 + Math.random() * 1.4;
      }
    } else {
      if (this.idleDripState.grow < 1.0) {
        // Slowly swells on aerator tip before letting go
        this.idleDripState.grow = Math.min(1.0, this.idleDripState.grow + dt * 1.6);
        const s = 0.25 + this.idleDripState.grow * 0.78;
        this.idleDripMesh.position.set(SINK.spoutPos.x, SINK.spoutPos.y - 0.015 - this.idleDripState.grow * 0.025, SINK.spoutPos.z);
        this.idleDripMesh.scale.set(s, s * 1.25, s);
      } else {
        this.idleDripState.vy -= 7.2 * dt;
        this.idleDripState.y += this.idleDripState.vy * dt;
        this.idleDripMesh.position.set(SINK.spoutPos.x, this.idleDripState.y, SINK.spoutPos.z);
        this.idleDripMesh.scale.set(0.85, 1.45, 0.85);
        const hitY = this.level > 0.015 ? this.getSurfaceY() : SINK.bottomY + 0.02;
        if (this.idleDripState.y <= hitY) {
          this.idleDripState.active = false;
          this.idleDripMesh.visible = false;
          this.addRipple(SINK.spoutPos.x, SINK.spoutPos.z, -0.028, 2);
          this.spawnSplash(SINK.spoutPos.x, hitY, SINK.spoutPos.z, 4, 0.72);
          audio.playDrip(1.0 + this.level * 0.45, 0.14);
        }
      }
    }
  }
}
