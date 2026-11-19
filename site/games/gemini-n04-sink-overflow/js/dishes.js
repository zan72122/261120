import * as THREE from 'three';
import { SINK } from './kitchen.js';
import { createDishDirtCanvas } from './textures.js';
import { audio } from './audio.js';

export class DishManager {
  constructor(scene) {
    this.scene = scene;
    this.dishes = [];
    this.round = 0;
    this.time = 0;
    this._createDishes();
  }

  _createDishes() {
    const specs = [
      {
        id: 0,
        kind: 'plate',
        color: 0xfaf5ec,
        rimColor: 0xe6d8c3,
        sinkPos: new THREE.Vector3(-0.74, SINK.bottomY + 0.16, -0.34),
        sinkRot: new THREE.Euler(0.72, 0.32, -0.18),
        shelfTilted: true,
        buoyancy: 0.45
      },
      {
        id: 1,
        kind: 'bowl',
        color: 0xf2b0be,
        rimColor: 0xde8e9f,
        sinkPos: new THREE.Vector3(0.42, SINK.bottomY + 0.025, 0.04),
        sinkRot: new THREE.Euler(-0.04, -0.35, 0.05),
        shelfTilted: false,
        buoyancy: 0.65
      },
      {
        id: 2,
        kind: 'mug',
        color: 0x9cd4c7,
        rimColor: 0x7ebcb0,
        sinkPos: new THREE.Vector3(-0.42, SINK.bottomY + 0.02, 0.10),
        sinkRot: new THREE.Euler(0, 0.55, 0),
        shelfTilted: false,
        buoyancy: 0.58
      },
      {
        id: 3,
        kind: 'glass',
        color: 0xdff5f8,
        rimColor: 0xffffff,
        sinkPos: new THREE.Vector3(0.32, SINK.bottomY + 0.02, -0.44),
        sinkRot: new THREE.Euler(0, -0.2, 0),
        shelfTilted: false,
        buoyancy: 0.52
      },
      {
        id: 4,
        kind: 'cakePlate',
        color: 0xf8dc7d,
        rimColor: 0xe5c156,
        sinkPos: new THREE.Vector3(0.76, SINK.bottomY + 0.14, -0.30),
        sinkRot: new THREE.Euler(0.68, -0.35, 0.18),
        shelfTilted: true,
        buoyancy: 0.50
      }
    ];

    specs.forEach((spec) => {
      const dish = this._buildSingleDish(spec);
      this.dishes.push(dish);
      this.scene.add(dish.group);
    });
  }

  _buildSingleDish(spec) {
    const group = new THREE.Group();
    group.position.copy(spec.sinkPos);
    group.rotation.copy(spec.sinkRot);

    const visual = new THREE.Group();
    group.add(visual);

    const dirtInfo = createDishDirtCanvas(spec.id, this.round);
    const dirtMat = new THREE.MeshStandardMaterial({
      map: dirtInfo.texture,
      transparent: true,
      opacity: 0.94,
      roughness: 0.32,
      metalness: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });

    const ceramicMat = spec.kind === 'glass'
      ? new THREE.MeshPhysicalMaterial({
          color: 0xe8f9fc,
          roughness: 0.05,
          metalness: 0.02,
          transparent: true,
          opacity: 0.48,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          ior: 1.5,
          envMapIntensity: 1.75,
          side: THREE.DoubleSide
        })
      : new THREE.MeshPhysicalMaterial({
          color: spec.color,
          roughness: 0.14,
          metalness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.15,
          side: THREE.DoubleSide
        });

    let dirtMesh = null;
    let hitRadius = 0.26;
    let hitHeight = 0.18;

    if (spec.kind === 'plate' || spec.kind === 'cakePlate') {
      const rScale = spec.kind === 'plate' ? 1.0 : 0.84;
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.14 * rScale, 0.0),
        new THREE.Vector2(0.16 * rScale, 0.015),
        new THREE.Vector2(0.24 * rScale, 0.044),
        new THREE.Vector2(0.255 * rScale, 0.052),
        new THREE.Vector2(0.245 * rScale, 0.058),
        new THREE.Vector2(0.15 * rScale, 0.026),
        new THREE.Vector2(0.0, 0.022)
      ];
      const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), ceramicMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      visual.add(mesh);

      // Subtle artisan colored rim line
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.246 * rScale, 0.007, 10, 40),
        new THREE.MeshStandardMaterial({ color: spec.rimColor, roughness: 0.2 })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.054;
      visual.add(rim);

      // Erasable dirt stain overlay conforming to plate face
      const dirtGeo = new THREE.CircleGeometry(0.22 * rScale, 32);
      dirtGeo.rotateX(-Math.PI / 2);
      dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
      dirtMesh.position.y = 0.036;
      visual.add(dirtMesh);

      hitRadius = 0.27 * rScale;
      hitHeight = 0.14;
    } else if (spec.kind === 'bowl') {
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.105, 0.0),
        new THREE.Vector2(0.175, 0.055),
        new THREE.Vector2(0.205, 0.145),
        new THREE.Vector2(0.192, 0.152),
        new THREE.Vector2(0.160, 0.062),
        new THREE.Vector2(0.095, 0.020),
        new THREE.Vector2(0.0, 0.018)
      ];
      const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), ceramicMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      visual.add(mesh);

      // Dirt overlay inside & around upper bowl rim
      const dirtGeo = new THREE.SphereGeometry(0.182, 24, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55);
      dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
      dirtMesh.position.y = 0.155;
      dirtMesh.scale.set(1, 0.72, 1);
      visual.add(dirtMesh);

      hitRadius = 0.23;
      hitHeight = 0.19;
    } else if (spec.kind === 'mug') {
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.115, 0.0),
        new THREE.Vector2(0.125, 0.02),
        new THREE.Vector2(0.128, 0.215),
        new THREE.Vector2(0.115, 0.220),
        new THREE.Vector2(0.110, 0.022),
        new THREE.Vector2(0.0, 0.022)
      ];
      const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), ceramicMat);
      body.castShadow = true;
      body.receiveShadow = true;
      visual.add(body);

      // Curved ceramic handle
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.068, 0.017, 12, 24, Math.PI * 1.12),
        ceramicMat
      );
      handle.position.set(0.122, 0.118, 0);
      handle.rotation.z = -Math.PI * 0.56;
      handle.castShadow = true;
      visual.add(handle);

      // Outer dirt smudge cylinder wrap
      const dirtGeo = new THREE.CylinderGeometry(0.131, 0.127, 0.18, 28, 1, true);
      dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
      dirtMesh.position.y = 0.115;
      visual.add(dirtMesh);

      hitRadius = 0.20;
      hitHeight = 0.25;
    } else if (spec.kind === 'glass') {
      // Clear fluted glass tumbler
      const pts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.092, 0.0),
        new THREE.Vector2(0.112, 0.245),
        new THREE.Vector2(0.103, 0.248),
        new THREE.Vector2(0.084, 0.022),
        new THREE.Vector2(0.0, 0.022)
      ];
      const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), ceramicMat);
      glass.castShadow = true;
      visual.add(glass);

      // Crisp specular rim ring
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.108, 0.005, 8, 28),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, clearcoat: 1.0, transparent: true, opacity: 0.72 })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.246;
      visual.add(rim);

      const dirtGeo = new THREE.CylinderGeometry(0.114, 0.095, 0.20, 24, 1, true);
      dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
      dirtMesh.position.y = 0.125;
      visual.add(dirtMesh);

      hitRadius = 0.17;
      hitHeight = 0.27;
    }

    // Sparkling 3D wet droplets attached to dish (visible when state === 'wet')
    const dropletGroup = new THREE.Group();
    dropletGroup.visible = false;
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xeaf9ff,
      roughness: 0.03,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
      envMapIntensity: 1.9
    });
    const dropGeo = new THREE.SphereGeometry(0.015, 8, 8);
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Mesh(dropGeo, dropMat);
      const a = (i / 12) * Math.PI * 2 + (i % 3) * 0.3;
      const r = spec.kind === 'plate' || spec.kind === 'cakePlate'
        ? 0.05 + (i % 4) * 0.042
        : 0.115 + (spec.kind === 'bowl' ? 0.065 : 0.008);
      const y = spec.kind === 'plate' || spec.kind === 'cakePlate'
        ? 0.042
        : 0.05 + (i % 4) * 0.042;
      d.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      const sc = 0.65 + (i % 3) * 0.35;
      d.scale.set(sc, sc * 0.7, sc);
      dropletGroup.add(d);
    }
    visual.add(dropletGroup);

    // Subtle dry clean gleam star (twinkles gently on dry/shelved dishes!)
    const gleamMat = new THREE.MeshBasicMaterial({
      color: 0xfffdf0,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const gleam = new THREE.Group();
    const gBar1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), gleamMat);
    gBar1.scale.set(0.28, 1.5, 0.28);
    const gBar2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 0), gleamMat);
    gBar2.scale.set(1.5, 0.28, 0.28);
    gleam.add(gBar1, gBar2);
    gleam.position.set(hitRadius * 0.42, hitHeight * 0.85, hitRadius * 0.35);
    visual.add(gleam);

    // Generous invisible touch hit collider
    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(hitRadius * 1.15, hitRadius * 1.15, hitHeight * 1.35, 14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.y = hitHeight * 0.5;
    hitMesh.userData = { type: 'dish', dishId: spec.id };
    group.add(hitMesh);

    return {
      id: spec.id,
      spec,
      group,
      visual,
      hitMesh,
      dirtInfo,
      dirtMesh,
      dirtMat,
      dropletGroup,
      gleam,
      gleamMat,
      state: 'dirty', // 'dirty' | 'wet' | 'dry' | 'shelved'
      dirtLevel: 1.0,
      wetness: 0.0,
      inSink: true,
      onMat: false,
      isDragged: false,
      homePos: spec.sinkPos.clone(),
      targetPos: spec.sinkPos.clone(),
      targetRot: spec.sinkRot.clone(),
      wobbleTime: 0,
      bobPhase: spec.id * 1.37,
      animArc: null
    };
  }

  scrubDish(dish, amount, water, foam) {
    if (dish.state !== 'dirty') return false;
    // Wet/soapy scrubbing is fastest, dry scrubbing still gently works!
    const soapBoost = 0.65 + (water.level > 0.04 ? 0.55 : 0) + Math.min(1.2, water.soapiness * 0.95);
    const delta = amount * soapBoost;
    dish.dirtLevel = Math.max(0, dish.dirtLevel - delta);

    // Physically erase soft blotches from the dish's stain canvas texture!
    const ctx = dish.dirtInfo.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const wipes = 2 + Math.floor(delta * 14);
    for (let i = 0; i < wipes; i++) {
      const cx = 36 + Math.random() * 184;
      const cy = 36 + Math.random() * 184;
      const r = 18 + Math.random() * 26;
      const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      g.addColorStop(0, 'rgba(0,0,0,0.85)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    dish.dirtInfo.texture.needsUpdate = true;
    dish.dirtMat.opacity = Math.min(0.95, dish.dirtLevel * 1.15);

    // Tactile tiny jiggle
    dish.wobbleTime = 0.16;

    // Spawn scrubby suds right on the dish!
    if (foam && Math.random() < 0.42) {
      foam.addFoamCluster(
        dish.group.position.x,
        dish.group.position.y + 0.09,
        dish.group.position.z,
        water.soapiness > 0.05 ? 2 : 1
      );
    }

    if (dish.dirtLevel <= 0.07) {
      dish.dirtLevel = 0;
      dish.dirtMat.opacity = 0;
      dish.dirtMesh.visible = false;
      dish.state = 'wet';
      dish.wetness = 1.0;
      dish.dropletGroup.visible = true;
      dish.wobbleTime = 0.35;
      audio.playCleanSparkle();
      if (foam) {
        foam.spawnSparkles(dish.group.position.x, dish.group.position.y + 0.12, dish.group.position.z, 12, 1.0);
        foam.spawnFloatingBubble(dish.group.position.x, dish.group.position.y + 0.16, dish.group.position.z, 0.9);
      }
      return true;
    }
    return false;
  }

  wipeDish(dish, amount, foam) {
    if (dish.state !== 'wet') return false;
    dish.wetness = Math.max(0, dish.wetness - amount);
    dish.wobbleTime = 0.14;

    // Shrink water droplets smoothly as towel dries them!
    const s = Math.max(0.01, dish.wetness);
    dish.dropletGroup.scale.setScalar(s);

    if (dish.wetness <= 0.06) {
      dish.wetness = 0;
      dish.dropletGroup.visible = false;
      dish.state = 'dry';
      dish.wobbleTime = 0.42;
      audio.playDryShine();
      if (foam) {
        foam.spawnSparkles(dish.group.position.x, dish.group.position.y + 0.14, dish.group.position.z, 16, 1.15);
      }
      return true;
    }
    return false;
  }

  placeOnShelf(dish, foam) {
    const spot = SINK.coasterSpots[dish.id];
    dish.state = 'shelved';
    dish.inSink = false;
    dish.onMat = false;
    dish.isDragged = false;

    const endPos = spot.clone();
    const endRot = dish.spec.shelfTilted
      ? new THREE.Euler(1.18, 0, 0) // plates lean gleaming upright against backsplash tiles!
      : new THREE.Euler(0, dish.id === 2 ? -0.45 : 0, 0);
    if (dish.spec.shelfTilted) {
      endPos.y += 0.19;
      endPos.z -= 0.05;
    }

    dish.animArc = {
      startPos: dish.group.position.clone(),
      endPos,
      startRot: dish.group.rotation.clone(),
      endRot,
      t: 0,
      duration: 0.42,
      onDone: () => {
        dish.wobbleTime = 0.32;
        audio.playDishClink(dish.id, true);
        if (foam) {
          foam.spawnSparkles(endPos.x, endPos.y + 0.12, endPos.z + 0.05, 14, 0.9);
        }
      }
    };
  }

  sendToDryingMat(dish, autoQuickDry = false, foam = null) {
    dish.inSink = false;
    dish.onMat = true;
    dish.isDragged = false;
    const endPos = new THREE.Vector3(
      SINK.dryingZone.x + (Math.random() - 0.5) * 0.08,
      0.025,
      SINK.dryingZone.z - 0.18 + (Math.random() - 0.5) * 0.08
    );
    dish.targetPos.copy(endPos);
    dish.targetRot.set(0, dish.id === 2 ? -0.4 : 0, 0);
    dish.animArc = {
      startPos: dish.group.position.clone(),
      endPos,
      startRot: dish.group.rotation.clone(),
      endRot: dish.targetRot.clone(),
      t: 0,
      duration: 0.32,
      onDone: () => {
        audio.playDishClink(dish.id, true);
        if (autoQuickDry && dish.state === 'wet') {
          this.wipeDish(dish, 0.52, foam);
        }
      }
    };
  }

  returnToSink(dish, water) {
    dish.inSink = true;
    dish.onMat = false;
    dish.isDragged = false;
    const endPos = dish.spec.sinkPos.clone();
    dish.targetPos.copy(endPos);
    dish.targetRot.copy(dish.spec.sinkRot);
    dish.animArc = {
      startPos: dish.group.position.clone(),
      endPos,
      startRot: dish.group.rotation.clone(),
      endRot: dish.spec.sinkRot.clone(),
      t: 0,
      duration: 0.36,
      onDone: () => {
        if (water && water.level > 0.08) {
          water.addRipple(endPos.x, endPos.z, -0.055, 3);
          water.spawnSplash(endPos.x, water.getSurfaceY(), endPos.z, 10, 1.3);
          audio.playSplash(0.65);
        } else {
          audio.playDishClink(dish.id, false);
        }
      }
    };
  }

  allShelved() {
    return this.dishes.every((d) => d.state === 'shelved');
  }

  resetForNewRound(water) {
    this.round++;
    this.dishes.forEach((dish, i) => {
      // Repaint fresh food stains for the new round!
      const fresh = createDishDirtCanvas(dish.id, this.round);
      dish.dirtInfo = fresh;
      dish.dirtMat.map = fresh.texture;
      dish.dirtMat.opacity = 0.94;
      dish.dirtMat.needsUpdate = true;
      dish.dirtMesh.visible = true;

      dish.state = 'dirty';
      dish.dirtLevel = 1.0;
      dish.wetness = 0.0;
      dish.dropletGroup.visible = false;
      dish.dropletGroup.scale.setScalar(1);
      dish.inSink = true;
      dish.onMat = false;

      // Playful staggered glide from left counter into the sink!
      const startPos = new THREE.Vector3(-1.85, 0.55 + i * 0.14, 0.15);
      dish.group.position.copy(startPos);
      dish.animArc = {
        startPos,
        endPos: dish.spec.sinkPos.clone(),
        startRot: new THREE.Euler(0.2, 0.4, -0.2),
        endRot: dish.spec.sinkRot.clone(),
        t: -i * 0.12,
        duration: 0.45,
        onDone: () => {
          audio.playDishClink(dish.id, false);
          if (water && water.level > 0.05) {
            water.addRipple(dish.spec.sinkPos.x, dish.spec.sinkPos.z, -0.045, 2);
            water.spawnSplash(dish.spec.sinkPos.x, water.getSurfaceY(), dish.spec.sinkPos.z, 6, 1.0);
          }
        }
      };
    });
  }

  update(dt, water) {
    this.time += dt;
    const clampedDt = Math.min(dt, 0.04);
    const surfaceY = water.getSurfaceY();

    for (const d of this.dishes) {
      // Smooth arc animation (e.g., flying neatly to shelf or drying mat)
      if (d.animArc) {
        d.animArc.t += clampedDt;
        const p = THREE.MathUtils.clamp(d.animArc.t / d.animArc.duration, 0, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        d.group.position.lerpVectors(d.animArc.startPos, d.animArc.endPos, ease);
        d.group.position.y += Math.sin(p * Math.PI) * 0.24;
        d.group.rotation.x = THREE.MathUtils.lerp(d.animArc.startRot.x, d.animArc.endRot.x, ease);
        d.group.rotation.y = THREE.MathUtils.lerp(d.animArc.startRot.y, d.animArc.endRot.y, ease);
        d.group.rotation.z = THREE.MathUtils.lerp(d.animArc.startRot.z, d.animArc.endRot.z, ease);
        if (p >= 1) {
          const cb = d.animArc.onDone;
          d.animArc = null;
          if (cb) cb();
        }
      } else if (!d.isDragged) {
        if (d.inSink) {
          // Gentle buoyancy bobbing in rising water!
          const floatTargetY = water.level > 0.15
            ? THREE.MathUtils.lerp(d.spec.sinkPos.y, surfaceY - 0.11, d.spec.buoyancy * Math.min(1, water.level * 1.15))
            : d.spec.sinkPos.y;
          const wave = water.getWaveHeightAt(d.group.position.x, d.group.position.z);
          const bob = water.level > 0.12 ? Math.sin(this.time * 2.4 + d.bobPhase) * 0.012 : 0;

          d.group.position.y += (floatTargetY + wave * 0.7 + bob - d.group.position.y) * Math.min(1, clampedDt * 6.5);
          d.group.position.x += (d.targetPos.x - d.group.position.x) * Math.min(1, clampedDt * 5.0);
          d.group.position.z += (d.targetPos.z - d.group.position.z) * Math.min(1, clampedDt * 5.0);

          // Gentle tilt with water bobbing
          const tilt = water.level > 0.15 ? Math.sin(this.time * 1.9 + d.bobPhase) * 0.05 : 0;
          d.group.rotation.x += (d.spec.sinkRot.x + tilt - d.group.rotation.x) * Math.min(1, clampedDt * 5);
          d.group.rotation.z += (d.spec.sinkRot.z - tilt * 0.8 - d.group.rotation.z) * Math.min(1, clampedDt * 5);
        } else if (d.onMat) {
          d.group.position.lerp(d.targetPos, Math.min(1, clampedDt * 8));
        }
      }

      // Elastic tactile wobble on scrub / wipe / tap
      if (d.wobbleTime > 0) {
        d.wobbleTime = Math.max(0, d.wobbleTime - clampedDt);
        const w = Math.sin(d.wobbleTime * 36) * d.wobbleTime * 0.36;
        d.visual.rotation.z = w;
        const sc = 1 + Math.sin(d.wobbleTime * 28) * d.wobbleTime * 0.08;
        d.visual.scale.set(sc, 1 / Math.sqrt(sc), sc);
      } else {
        d.visual.rotation.z *= 0.8;
        d.visual.scale.lerp(new THREE.Vector3(1, 1, 1), 0.25);
      }

      // Subtle sunlit dry twinkle on gleaming dry/shelved dishes!
      if (d.state === 'dry' || d.state === 'shelved') {
        const twinkle = Math.max(0, Math.sin(this.time * 3.2 + d.id * 1.7) - 0.55) * 2.2;
        d.gleamMat.opacity = twinkle * (d.state === 'dry' ? 0.92 : 0.65);
        d.gleam.rotation.z = this.time * 1.5;
        d.gleam.scale.setScalar(0.55 + twinkle * 0.65);
      } else {
        d.gleamMat.opacity = 0;
      }
    }
  }
}
