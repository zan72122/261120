import * as THREE from 'three';
import {
  createSpongeTextures,
  createCakeInteriorTexture,
  createLaceDoilyTexture,
  createCreamSwirlBump,
} from './textures.js';

export const CAKE_RADIUS = 1.02;
export const CAKE_HEIGHT = 0.82;
export const PLATE_TOP_Y = 0.14; // height of porcelain plate top inside servePlateGroup

function buildFlutedRosetteGeometry() {
  // Real star-nozzle piped whipped cream rosette (twisted 8-flute star tip)
  const radialSegs = 40;
  const heightSegs = 16;
  const geo = new THREE.BufferGeometry();
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= heightSegs; iy++) {
    const v = iy / heightSegs; // 0 bottom -> 1 pointy swirl tip
    const y = v * 0.24;
    // Soft bell profile tapering to a delicate curved peak
    const baseR = 0.145 * Math.pow(1 - v, 0.72) * (0.75 + 0.35 * Math.sin(v * Math.PI * 0.85));
    const twist = v * 1.45;
    // Subtle curved peak tip
    const tipLeanX = Math.pow(v, 2.4) * 0.028;
    const tipLeanZ = Math.pow(v, 2.4) * 0.014;

    for (let ix = 0; ix <= radialSegs; ix++) {
      const u = ix / radialSegs;
      const theta = u * Math.PI * 2;
      const flute = 1 + 0.18 * Math.cos(theta * 8 + twist) * (1 - v * 0.55);
      const r = baseR * flute;
      const x = Math.cos(theta) * r + tipLeanX;
      const z = Math.sin(theta) * r + tipLeanZ;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const stride = radialSegs + 1;
  for (let iy = 0; iy < heightSegs; iy++) {
    for (let ix = 0; ix < radialSegs; ix++) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBeveledSpongeGeometry(radius, height) {
  // Soft baked genoise sponge profile with gently rounded top/bottom shoulders
  const pts = [];
  const bevel = 0.07;
  pts.push(new THREE.Vector2(0.001, 0));
  pts.push(new THREE.Vector2(radius - bevel, 0));
  pts.push(new THREE.Vector2(radius - bevel * 0.3, bevel * 0.25));
  pts.push(new THREE.Vector2(radius, bevel));
  pts.push(new THREE.Vector2(radius * 1.006, height * 0.5));
  pts.push(new THREE.Vector2(radius, height - bevel));
  pts.push(new THREE.Vector2(radius - bevel * 0.28, height - bevel * 0.25));
  pts.push(new THREE.Vector2(radius - bevel, height));
  pts.push(new THREE.Vector2(0.001, height + 0.004));
  return new THREE.LatheGeometry(pts, 56);
}

export class ShortcakeSystem {
  constructor() {
    this.root = new THREE.Group(); // Centered on turntable base at y = 0

    // Shared textures & materials
    this.spongeTex = createSpongeTextures();
    this.interiorTex = createCakeInteriorTexture();
    this.doilyTex = createLaceDoilyTexture();
    this.creamSwirlBump = createCreamSwirlBump();

    this.rosetteGeo = buildFlutedRosetteGeometry();

    this.creamMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffcf5,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.38,
      clearcoatRoughness: 0.22,
      sheen: 0.45,
      sheenColor: new THREE.Color(0xfff7ea),
      sheenRoughness: 0.55,
      bumpMap: this.creamSwirlBump,
      bumpScale: 0.012,
    });

    this.turntableBase = new THREE.Group();
    this.spinGroup = new THREE.Group();
    this.servePlateGroup = new THREE.Group(); // Glides off turntable to guest!
    this.cakeBodyGroup = new THREE.Group(); // Sits at y = PLATE_TOP_Y inside servePlateGroup

    this.root.add(this.turntableBase);
    this.turntableBase.add(this.spinGroup);
    this.spinGroup.add(this.servePlateGroup);
    this.servePlateGroup.add(this.cakeBodyGroup);
    this.cakeBodyGroup.position.y = PLATE_TOP_Y;

    // Turntable & sponge spring physics
    this.spinAngle = 0;
    this.spinVel = 0;
    this.squish = 0;
    this.squishVel = 0;

    // Placed decorations
    this.rosettes = [];
    this.berries = []; // { mesh, collar, localPos, stackLevel, parentBerry, wobblePhase, wobbleAmp, tumbling, vel, variant, radius }
    this.sugarDustCount = 0;
    this.sugarSprites = [];

    // Sliced state
    this.eatenWedges = 0;
    this.slicedGroup = null;

    // Dynamic cream grids & canvases
    this.topGridSize = 48;
    this.topHeight = new Float32Array(this.topGridSize * this.topGridSize);
    this.sideGridW = 64;
    this.sideGridH = 18;
    this.sideHeight = new Float32Array(this.sideGridW * this.sideGridH);

    this.topCoverage = 0;
    this.sideCoverage = 0;
    this.overallCoverage = 0;

    this._buildTurntable();
    this._buildPlateAndDoily();
    this._buildSponge();
    this._buildDynamicCreamMeshes();
    this._buildPowderedSugarLayer();
  }

  _buildTurntable() {
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xe6e8ec,
      metalness: 0.88,
      roughness: 0.22,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x9aa0a8,
      metalness: 0.84,
      roughness: 0.34,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x3b3835,
      roughness: 0.9,
    });

    // Non-slip rubber base ring
    const baseRubber = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.96, 0.03, 40), rubberMat);
    baseRubber.position.y = 0.015;
    baseRubber.receiveShadow = true;
    this.turntableBase.add(baseRubber);

    // Tapered brushed metal pedestal
    const pedestalPts = [
      new THREE.Vector2(0.88, 0.03),
      new THREE.Vector2(0.74, 0.09),
      new THREE.Vector2(0.42, 0.16),
      new THREE.Vector2(0.38, 0.24),
      new THREE.Vector2(0.46, 0.26),
    ];
    const pedestal = new THREE.Mesh(new THREE.LatheGeometry(pedestalPts, 40), darkSteelMat);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    this.turntableBase.add(pedestal);

    // Rotating top turntable platform
    this.spinGroup.position.y = 0.26;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.35, 0.065, 56), steelMat);
    disc.position.y = 0.032;
    disc.castShadow = true;
    disc.receiveShadow = true;
    this.spinGroup.add(disc);

    // Subtle concentric lathe grooves on steel turntable so rotation is visually legible!
    const grooveMat = new THREE.MeshStandardMaterial({
      color: 0xc8ccd2,
      metalness: 0.9,
      roughness: 0.32,
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.09), grooveMat);
      tick.position.set(Math.cos(a) * 1.31, 0.066, Math.sin(a) * 1.31);
      tick.rotation.y = -a + Math.PI / 2;
      this.spinGroup.add(tick);
    }

    // Serve plate rests directly on top of the turntable disc
    this.servePlateGroup.position.y = 0.065;
  }

  _buildPlateAndDoily() {
    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbfaf6,
      roughness: 0.11,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
    });
    const goldRimMat = new THREE.MeshStandardMaterial({
      color: 0xd9b366,
      metalness: 0.92,
      roughness: 0.24,
    });

    // Classic shallow patisserie porcelain cake plate
    const platePts = [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.88, 0.0),
      new THREE.Vector2(1.06, 0.035),
      new THREE.Vector2(1.24, 0.095),
      new THREE.Vector2(1.27, 0.135),
      new THREE.Vector2(1.24, 0.145),
      new THREE.Vector2(1.16, 0.115),
      new THREE.Vector2(1.04, 0.068),
      new THREE.Vector2(0.95, 0.055),
      new THREE.Vector2(0.001, 0.055),
    ];
    const plate = new THREE.Mesh(new THREE.LatheGeometry(platePts, 56), porcelainMat);
    plate.castShadow = true;
    plate.receiveShadow = true;
    plate.position.y = 0.0;
    this.servePlateGroup.add(plate);

    // Delicate gold rim hairline
    const goldRim = new THREE.Mesh(new THREE.TorusGeometry(1.252, 0.009, 10, 64), goldRimMat);
    goldRim.rotation.x = Math.PI / 2;
    goldRim.position.y = 0.141;
    this.servePlateGroup.add(goldRim);

    // Translucent paper lace doily sitting gently in the plate well
    const doilyMat = new THREE.MeshStandardMaterial({
      map: this.doilyTex,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.86,
      side: THREE.DoubleSide,
    });
    const doily = new THREE.Mesh(new THREE.CircleGeometry(1.14, 48), doilyMat);
    doily.rotation.x = -Math.PI / 2;
    doily.position.y = 0.064;
    doily.receiveShadow = true;
    this.servePlateGroup.add(doily);

    // Cake sits at y = 0.068 (slightly above doily), override PLATE_TOP_Y visual sync
    this.cakeBodyGroup.position.y = 0.068;
  }

  _buildSponge() {
    this.spongeGroup = new THREE.Group();
    this.cakeBodyGroup.add(this.spongeGroup);

    const spongeGeo = buildBeveledSpongeGeometry(CAKE_RADIUS, CAKE_HEIGHT);
    const spongeMat = new THREE.MeshStandardMaterial({
      map: this.spongeTex.sideMap,
      bumpMap: this.spongeTex.bumpMap,
      bumpScale: 0.032,
      roughness: 0.88,
      metalness: 0.0,
    });

    this.spongeMesh = new THREE.Mesh(spongeGeo, spongeMat);
    this.spongeMesh.castShadow = true;
    this.spongeMesh.receiveShadow = true;
    this.spongeGroup.add(this.spongeMesh);

    // Baked golden top cap texture overlay for authentic top crust
    const topCapMat = new THREE.MeshStandardMaterial({
      map: this.spongeTex.topMap,
      bumpMap: this.spongeTex.bumpMap,
      bumpScale: 0.022,
      roughness: 0.84,
    });
    const topCap = new THREE.Mesh(new THREE.CircleGeometry(CAKE_RADIUS - 0.055, 48), topCapMat);
    topCap.rotation.x = -Math.PI / 2;
    topCap.position.y = CAKE_HEIGHT + 0.008;
    topCap.receiveShadow = true;
    this.spongeGroup.add(topCap);

    // Invisible slightly larger smooth hit cylinder for buttery-smooth raycasting while spreading cream
    this.hitCollider = new THREE.Mesh(
      new THREE.CylinderGeometry(CAKE_RADIUS + 0.08, CAKE_RADIUS + 0.08, CAKE_HEIGHT + 0.08, 32),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitCollider.position.y = CAKE_HEIGHT * 0.5;
    this.hitCollider.userData.kind = 'cake';
    this.cakeBodyGroup.add(this.hitCollider);
  }

  _buildDynamicCreamMeshes() {
    this.creamGroup = new THREE.Group();
    this.cakeBodyGroup.add(this.creamGroup);

    // --- 1. TOP CREAM DYNAMIC CANVASES ---
    this.topAlphaCanvas = document.createElement('canvas');
    this.topAlphaCanvas.width = 256;
    this.topAlphaCanvas.height = 256;
    this.topAlphaCtx = this.topAlphaCanvas.getContext('2d');
    this.topAlphaTex = new THREE.CanvasTexture(this.topAlphaCanvas);

    this.topBumpCanvas = document.createElement('canvas');
    this.topBumpCanvas.width = 256;
    this.topBumpCanvas.height = 256;
    this.topBumpCtx = this.topBumpCanvas.getContext('2d');
    this.topBumpTex = new THREE.CanvasTexture(this.topBumpCanvas);

    // Subdivided polar disc for silky 3D top frosting with rounded waterfall rim
    const rings = 24;
    const segs = 60;
    const topGeo = new THREE.BufferGeometry();
    const pos = [];
    const basePos = [];
    const uvs = [];
    const indices = [];

    for (let r = 0; r <= rings; r++) {
      const frac = r / rings; // 0 center -> 1 outer shoulder
      const rad = frac * (CAKE_RADIUS + 0.035);
      // Curve gently down at outer bevel rim so top cream hugs the cake edge seamlessly
      let baseY = CAKE_HEIGHT + 0.012 * (1 - frac * frac);
      if (frac > 0.88) {
        const edgeT = (frac - 0.88) / 0.12;
        baseY -= edgeT * edgeT * 0.085;
      }
      for (let s = 0; s <= segs; s++) {
        const theta = (s / segs) * Math.PI * 2;
        const x = Math.cos(theta) * rad;
        const z = Math.sin(theta) * rad;
        pos.push(x, baseY - 0.018, z);
        basePos.push(x, baseY, z);
        // Planar top UV [0..1]
        const u = 0.5 + (x / ((CAKE_RADIUS + 0.035) * 2));
        const v = 0.5 + (z / ((CAKE_RADIUS + 0.035) * 2));
        uvs.push(u, 1 - v);
      }
    }
    const stride = segs + 1;
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * stride + s;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    topGeo.setIndex(indices);
    topGeo.computeVertexNormals();
    this.topBasePos = new Float32Array(basePos);

    this.topCreamMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffaf0,
      roughness: 0.23,
      metalness: 0.0,
      clearcoat: 0.42,
      clearcoatRoughness: 0.2,
      sheen: 0.45,
      sheenColor: new THREE.Color(0xfff1dc),
      sheenRoughness: 0.55,
      alphaMap: this.topAlphaTex,
      transparent: true,
      alphaTest: 0.08,
      bumpMap: this.topBumpTex,
      bumpScale: 0.044,
      depthWrite: true,
    });

    this.creamTopMesh = new THREE.Mesh(topGeo, this.topCreamMat);
    this.creamTopMesh.castShadow = true;
    this.creamTopMesh.receiveShadow = true;
    this.creamGroup.add(this.creamTopMesh);

    // --- 2. SIDE CREAM DYNAMIC CANVASES ---
    this.sideAlphaCanvas = document.createElement('canvas');
    this.sideAlphaCanvas.width = 256;
    this.sideAlphaCanvas.height = 128;
    this.sideAlphaCtx = this.sideAlphaCanvas.getContext('2d');
    this.sideAlphaTex = new THREE.CanvasTexture(this.sideAlphaCanvas);
    this.sideAlphaTex.wrapS = THREE.RepeatWrapping;

    this.sideBumpCanvas = document.createElement('canvas');
    this.sideBumpCanvas.width = 256;
    this.sideBumpCanvas.height = 128;
    this.sideBumpCtx = this.sideBumpCanvas.getContext('2d');
    this.sideBumpTex = new THREE.CanvasTexture(this.sideBumpCanvas);
    this.sideBumpTex.wrapS = THREE.RepeatWrapping;

    const sideGeo = new THREE.CylinderGeometry(
      CAKE_RADIUS + 0.005,
      CAKE_RADIUS + 0.005,
      CAKE_HEIGHT - 0.02,
      64,
      16,
      true
    );
    sideGeo.translate(0, CAKE_HEIGHT * 0.5, 0);
    this.sideBasePos = new Float32Array(sideGeo.attributes.position.array);

    this.sideCreamMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffaf0,
      roughness: 0.24,
      metalness: 0.0,
      clearcoat: 0.4,
      clearcoatRoughness: 0.22,
      sheen: 0.42,
      sheenColor: new THREE.Color(0xfff1dc),
      sheenRoughness: 0.55,
      alphaMap: this.sideAlphaTex,
      transparent: true,
      alphaTest: 0.08,
      bumpMap: this.sideBumpTex,
      bumpScale: 0.042,
      depthWrite: true,
    });

    this.creamSideMesh = new THREE.Mesh(sideGeo, this.sideCreamMat);
    this.creamSideMesh.castShadow = true;
    this.creamSideMesh.receiveShadow = true;
    this.creamGroup.add(this.creamSideMesh);

    this._clearCreamCanvases();
  }

  _buildPowderedSugarLayer() {
    // Dedicated soft frosty snow dusting overlay on top of cake
    this.sugarCanvas = document.createElement('canvas');
    this.sugarCanvas.width = 256;
    this.sugarCanvas.height = 256;
    this.sugarCtx = this.sugarCanvas.getContext('2d');
    this.sugarTex = new THREE.CanvasTexture(this.sugarCanvas);

    const sugarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.sugarTex,
      transparent: true,
      opacity: 0.92,
      roughness: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.sugarOverlay = new THREE.Mesh(new THREE.CircleGeometry(CAKE_RADIUS + 0.02, 40), sugarMat);
    this.sugarOverlay.rotation.x = -Math.PI / 2;
    this.sugarOverlay.position.y = CAKE_HEIGHT + 0.082;
    this.cakeBodyGroup.add(this.sugarOverlay);
  }

  _clearCreamCanvases() {
    this.topHeight.fill(0);
    this.sideHeight.fill(0);

    this.topAlphaCtx.fillStyle = '#000000';
    this.topAlphaCtx.fillRect(0, 0, 256, 256);
    this.topBumpCtx.fillStyle = '#808080';
    this.topBumpCtx.fillRect(0, 0, 256, 256);
    this.topAlphaTex.needsUpdate = true;
    this.topBumpTex.needsUpdate = true;

    this.sideAlphaCtx.fillStyle = '#000000';
    this.sideAlphaCtx.fillRect(0, 0, 256, 128);
    this.sideBumpCtx.fillStyle = '#808080';
    this.sideBumpCtx.fillRect(0, 0, 256, 128);
    this.sideAlphaTex.needsUpdate = true;
    this.sideBumpTex.needsUpdate = true;

    if (this.sugarCtx) {
      this.sugarCtx.clearRect(0, 0, 256, 256);
      this.sugarTex.needsUpdate = true;
    }

    this._syncTopVertices();
    this._syncSideVertices();
    this.topCoverage = 0;
    this.sideCoverage = 0;
    this.overallCoverage = 0;
  }

  resetForNewCake() {
    // Re-attach servePlateGroup to turntable spinGroup if detached
    if (this.servePlateGroup.parent !== this.spinGroup) {
      this.spinGroup.add(this.servePlateGroup);
    }
    this.servePlateGroup.position.set(0, 0.065, 0);
    this.servePlateGroup.rotation.set(0, 0, 0);
    this.servePlateGroup.scale.set(1, 1, 1);

    // Clear rosettes & berries
    this.rosettes.forEach((r) => this.cakeBodyGroup.remove(r.mesh));
    this.rosettes = [];
    this.berries.forEach((b) => {
      this.cakeBodyGroup.remove(b.mesh);
      if (b.collar) this.cakeBodyGroup.remove(b.collar);
    });
    this.berries = [];
    this.sugarDustCount = 0;

    // Remove sliced representation & restore intact sponge + dynamic cream
    if (this.slicedGroup) {
      this.cakeBodyGroup.remove(this.slicedGroup);
      this.slicedGroup = null;
    }
    this.eatenWedges = 0;
    this.spongeGroup.visible = true;
    this.creamGroup.visible = true;
    this.sugarOverlay.visible = true;

    this._clearCreamCanvases();
    this.spinVel = 0;
    this.squish = 0;
    this.squishVel = 0;
  }

  triggerSquish(strength = 0.075) {
    this.squishVel -= strength * 9.5;
  }

  // Spread real-time cream at a local cake-space point!
  // Returns { amountAdded, onTop }
  paintCreamAt(localPoint, strokeDirLocal, brushRadius = 0.34, strength = 0.55) {
    const r = Math.hypot(localPoint.x, localPoint.z);
    const isTop = localPoint.y >= CAKE_HEIGHT - 0.14 || r < CAKE_RADIUS * 0.84;
    let added = 0;

    if (isTop) {
      added += this._paintTop(localPoint.x, localPoint.z, strokeDirLocal, brushRadius, strength);
      // Naturally cascade cream slightly over the upper rim when spreading near edge!
      if (r > CAKE_RADIUS * 0.68) {
        const ang = Math.atan2(localPoint.x, localPoint.z);
        added += this._paintSideAngle(ang, 0.84, 0.36, 0.38, strength * 0.72);
      }
    } else {
      const ang = Math.atan2(localPoint.x, localPoint.z);
      const vFrac = THREE.MathUtils.clamp(localPoint.y / CAKE_HEIGHT, 0.06, 0.96);
      added += this._paintSideAngle(ang, vFrac, 0.42, 0.45, strength * 0.95);
      // Also softly kiss top edge if painting near upper rim
      if (vFrac > 0.72) {
        const rx = Math.sin(ang) * (CAKE_RADIUS * 0.92);
        const rz = Math.cos(ang) * (CAKE_RADIUS * 0.92);
        added += this._paintTop(rx, rz, strokeDirLocal, brushRadius * 0.75, strength * 0.55);
      }
    }

    this._recomputeCoverage();
    return { amountAdded: added, onTop: isTop };
  }

  // Big creamy plop when child taps the cream bowl directly!
  dropCreamDollop(localX, localZ) {
    const r = Math.hypot(localX, localZ);
    const clampedR = Math.min(r, CAKE_RADIUS * 0.72);
    const scale = r > 0.001 ? clampedR / r : 1;
    const x = localX * scale;
    const z = localZ * scale;
    this._paintTop(x, z, new THREE.Vector3(1, 0, 0), 0.44, 0.85);
    this._recomputeCoverage();
    this.triggerSquish(0.055);
  }

  _paintTop(lx, lz, dir, radius, strength) {
    const maxR = CAKE_RADIUS + 0.035;
    const u = 0.5 + lx / (maxR * 2);
    const v = 0.5 + lz / (maxR * 2); // Canvas y corresponds to +z
    const cx = u * 256;
    const cy = v * 256;
    const pixR = (radius / (maxR * 2)) * 256;

    // 1. Soft creamy alpha stroke
    const grad = this.topAlphaCtx.createRadialGradient(cx, cy, pixR * 0.12, cx, cy, pixR);
    grad.addColorStop(0, `rgba(255,255,255,${Math.min(1, strength * 1.15)})`);
    grad.addColorStop(0.65, `rgba(255,255,255,${strength * 0.82})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    this.topAlphaCtx.fillStyle = grad;
    this.topAlphaCtx.beginPath();
    this.topAlphaCtx.arc(cx, cy, pixR, 0, Math.PI * 2);
    this.topAlphaCtx.fill();
    this.topAlphaTex.needsUpdate = true;

    // 2. Directional glossy spatula swirl ridges in bump map!
    const angle = dir && dir.lengthSq() > 0.0001 ? Math.atan2(dir.z, dir.x) : Math.random() * Math.PI;
    this.topBumpCtx.save();
    this.topBumpCtx.translate(cx, cy);
    this.topBumpCtx.rotate(angle);
    for (let i = -3; i <= 3; i++) {
      const oy = i * (pixR * 0.22);
      this.topBumpCtx.strokeStyle = i % 2 === 0 ? 'rgba(235,235,235,0.42)' : 'rgba(65,65,65,0.34)';
      this.topBumpCtx.lineWidth = Math.max(2, pixR * 0.14);
      this.topBumpCtx.lineCap = 'round';
      this.topBumpCtx.beginPath();
      this.topBumpCtx.moveTo(-pixR * 0.65, oy);
      this.topBumpCtx.quadraticCurveTo(0, oy + (i % 2 === 0 ? 3 : -3), pixR * 0.65, oy);
      this.topBumpCtx.stroke();
    }
    this.topBumpCtx.restore();
    this.topBumpTex.needsUpdate = true;

    // 3. Update height grid for 3D sculptural thickness
    const N = this.topGridSize;
    const gx0 = Math.max(0, Math.floor((u - radius / (maxR * 2)) * N));
    const gx1 = Math.min(N - 1, Math.ceil((u + radius / (maxR * 2)) * N));
    const gy0 = Math.max(0, Math.floor((v - radius / (maxR * 2)) * N));
    const gy1 = Math.min(N - 1, Math.ceil((v + radius / (maxR * 2)) * N));
    let deltaSum = 0;

    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const pu = (gx + 0.5) / N;
        const pv = (gy + 0.5) / N;
        const px = (pu - 0.5) * maxR * 2;
        const pz = (pv - 0.5) * maxR * 2;
        const dist = Math.hypot(px - lx, pz - lz);
        if (dist < radius) {
          const falloff = 1 - dist / radius;
          const smooth = falloff * falloff * (3 - 2 * falloff);
          const idx = gy * N + gx;
          const prev = this.topHeight[idx];
          const next = Math.min(1, prev + smooth * strength * 0.85);
          this.topHeight[idx] = next;
          deltaSum += next - prev;
        }
      }
    }

    this._syncTopVertices();
    return deltaSum;
  }

  _paintSideAngle(theta, vFrac, arcSpan, vSpan, strength) {
    // CylinderGeometry UV u=0 starts at +z (theta=0), wraps around 2*PI
    let u = (theta / (Math.PI * 2)) % 1;
    if (u < 0) u += 1;
    const cx = u * 256;
    const cy = (1 - vFrac) * 128; // canvas y=0 is top (v=1)
    const rx = (arcSpan / (Math.PI * 2)) * 256;
    const ry = vSpan * 128;

    // Paint wrapped across seam (cx - 256, cx, cx + 256)
    [-256, 0, 256].forEach((offsetX) => {
      const px = cx + offsetX;
      if (px + rx < -10 || px - rx > 266) return;
      const grad = this.sideAlphaCtx.createRadialGradient(px, cy, Math.min(rx, ry) * 0.15, px, cy, Math.max(rx, ry));
      grad.addColorStop(0, `rgba(255,255,255,${Math.min(1, strength * 1.1)})`);
      grad.addColorStop(0.65, `rgba(255,255,255,${strength * 0.8})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      this.sideAlphaCtx.fillStyle = grad;
      this.sideAlphaCtx.beginPath();
      this.sideAlphaCtx.ellipse(px, cy, rx, ry, 0, 0, Math.PI * 2);
      this.sideAlphaCtx.fill();

      // Horizontal patisserie palette knife ridges along side!
      for (let k = -2; k <= 2; k++) {
        this.sideBumpCtx.strokeStyle = k % 2 === 0 ? 'rgba(230,230,230,0.42)' : 'rgba(65,65,65,0.34)';
        this.sideBumpCtx.lineWidth = 3.5;
        this.sideBumpCtx.beginPath();
        this.sideBumpCtx.moveTo(px - rx * 0.7, cy + k * 7);
        this.sideBumpCtx.lineTo(px + rx * 0.7, cy + k * 7);
        this.sideBumpCtx.stroke();
      }
    });

    this.sideAlphaTex.needsUpdate = true;
    this.sideBumpTex.needsUpdate = true;

    // Update side height grid
    const W = this.sideGridW;
    const H = this.sideGridH;
    let deltaSum = 0;
    for (let gy = 0; gy < H; gy++) {
      const pv = 1 - (gy + 0.5) / H;
      const dv = Math.abs(pv - vFrac) / vSpan;
      if (dv >= 1) continue;
      for (let gx = 0; gx < W; gx++) {
        const pu = (gx + 0.5) / W;
        let du = Math.abs(pu - u);
        if (du > 0.5) du = 1 - du;
        const duNorm = (du * Math.PI * 2) / arcSpan;
        const d = Math.hypot(duNorm, dv);
        if (d < 1) {
          const falloff = 1 - d;
          const smooth = falloff * falloff * (3 - 2 * falloff);
          const idx = gy * W + gx;
          const prev = this.sideHeight[idx];
          const next = Math.min(1, prev + smooth * strength * 0.88);
          this.sideHeight[idx] = next;
          deltaSum += next - prev;
        }
      }
    }

    this._syncSideVertices();
    return deltaSum;
  }

  _sampleTopHeight(lx, lz) {
    const maxR = CAKE_RADIUS + 0.035;
    const u = THREE.MathUtils.clamp(0.5 + lx / (maxR * 2), 0, 0.999);
    const v = THREE.MathUtils.clamp(0.5 + lz / (maxR * 2), 0, 0.999);
    const gx = Math.floor(u * this.topGridSize);
    const gy = Math.floor(v * this.topGridSize);
    return this.topHeight[gy * this.topGridSize + gx];
  }

  _syncTopVertices() {
    const pos = this.creamTopMesh.geometry.attributes.position;
    const base = this.topBasePos;
    const N = this.topGridSize;
    const maxR = CAKE_RADIUS + 0.035;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      const u = THREE.MathUtils.clamp(0.5 + bx / (maxR * 2), 0, 0.999);
      const v = THREE.MathUtils.clamp(0.5 + bz / (maxR * 2), 0, 0.999);
      const gx = Math.floor(u * N);
      const gy = Math.floor(v * N);
      const h = this.topHeight[gy * N + gx];
      // Tucked under sponge when unpainted, thick lush 3D whipped cream when painted!
      const lift = h > 0.05 ? 0.008 + Math.pow(h, 0.72) * 0.062 : -0.02;
      pos.setXYZ(i, bx, by + lift, bz);
    }
    pos.needsUpdate = true;
    this.creamTopMesh.geometry.computeVertexNormals();
  }

  _syncSideVertices() {
    const pos = this.creamSideMesh.geometry.attributes.position;
    const uv = this.creamSideMesh.geometry.attributes.uv;
    const base = this.sideBasePos;
    const W = this.sideGridW;
    const H = this.sideGridH;

    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      const u = ((uv.getX(i) % 1) + 1) % 1;
      const v = THREE.MathUtils.clamp(uv.getY(i), 0, 0.999);
      const gx = Math.min(W - 1, Math.floor(u * W));
      const gy = Math.min(H - 1, Math.floor((1 - v) * H));
      const h = this.sideHeight[gy * W + gx];
      const rLen = Math.hypot(bx, bz) || 1;
      const push = h > 0.05 ? 0.006 + Math.pow(h, 0.75) * 0.054 : -0.018;
      const scale = (rLen + push) / rLen;
      pos.setXYZ(i, bx * scale, by, bz * scale);
    }
    pos.needsUpdate = true;
    this.creamSideMesh.geometry.computeVertexNormals();
  }

  _recomputeCoverage() {
    // Count only pixels inside the circular top surface
    const N = this.topGridSize;
    let topIn = 0;
    let topCovered = 0;
    for (let gy = 0; gy < N; gy++) {
      for (let gx = 0; gx < N; gx++) {
        const dx = (gx + 0.5) / N - 0.5;
        const dy = (gy + 0.5) / N - 0.5;
        if (dx * dx + dy * dy <= 0.21) {
          topIn++;
          topCovered += Math.min(1, this.topHeight[gy * N + gx] * 1.35);
        }
      }
    }
    this.topCoverage = topIn > 0 ? topCovered / topIn : 0;

    let sideSum = 0;
    for (let i = 0; i < this.sideHeight.length; i++) {
      sideSum += Math.min(1, this.sideHeight[i] * 1.35);
    }
    this.sideCoverage = sideSum / this.sideHeight.length;
    this.overallCoverage = this.topCoverage * 0.68 + this.sideCoverage * 0.32;
  }

  getCreamHeightAtLocal(lx, lz) {
    const h = this._sampleTopHeight(lx, lz);
    return CAKE_HEIGHT + (h > 0.05 ? 0.02 + Math.pow(h, 0.72) * 0.058 : 0.01);
  }

  hasCreamAtLocal(lx, lz) {
    return this._sampleTopHeight(lx, lz) > 0.16;
  }

  // Pipe a sculpted 3D star-nozzle cream rosette!
  addRosette(localX, localZ) {
    if (this.rosettes.length > 42) return null;
    const r = Math.hypot(localX, localZ);
    if (r > CAKE_RADIUS * 0.92) {
      const s = (CAKE_RADIUS * 0.90) / r;
      localX *= s;
      localZ *= s;
    }
    // Paint a small base of cream underneath so rosette sits naturally
    this._paintTop(localX, localZ, null, 0.24, 0.55);
    this._recomputeCoverage();

    const y = this.getCreamHeightAtLocal(localX, localZ) - 0.012;
    const mesh = new THREE.Mesh(this.rosetteGeo, this.creamMat);
    mesh.position.set(localX, y, localZ);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.scale.set(0.01, 0.01, 0.01);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.cakeBodyGroup.add(mesh);

    const targetScale = 0.88 + Math.random() * 0.28;
    const item = { mesh, targetScale, age: 0, localX, localZ };
    this.rosettes.push(item);
    this.triggerSquish(0.032);
    return item;
  }

  // Place or stack a strawberry (or mint sprig) onto the cake!
  // Returns { stacked, stackLevel, onCream, tumbledImmediately }
  placeBerry(berryMesh, localX, localZ, variant = 'red') {
    const r = Math.hypot(localX, localZ);
    const maxPlaceR = CAKE_RADIUS * 0.88;
    if (r > maxPlaceR) {
      const s = maxPlaceR / r;
      localX *= s;
      localZ *= s;
    }

    const onCream = this.hasCreamAtLocal(localX, localZ);
    const baseSurfaceY = this.getCreamHeightAtLocal(localX, localZ);

    // Check if dropping on top of an existing berry -> STACKING!
    let supportBerry = null;
    let bestDist = 0.24;
    for (const b of this.berries) {
      if (b.tumbling || b.variant === 'mint') continue;
      const d = Math.hypot(b.localPos.x - localX, b.localPos.z - localZ);
      if (d < bestDist) {
        if (!supportBerry || b.stackLevel >= supportBerry.stackLevel) {
          bestDist = d;
          supportBerry = b;
        }
      }
    }

    let stackLevel = 0;
    let targetY = baseSurfaceY + (variant === 'mint' ? 0.025 : onCream ? 0.13 : 0.16);
    if (supportBerry && variant !== 'mint') {
      stackLevel = supportBerry.stackLevel + 1;
      // Nudge slightly toward parent center so stacking is gratifying and achievable, keeping natural offset
      localX = THREE.MathUtils.lerp(localX, supportBerry.localPos.x, 0.45);
      localZ = THREE.MathUtils.lerp(localZ, supportBerry.localPos.z, 0.45);
      targetY = supportBerry.localPos.y + 0.255;
    }

    // Re-parent berry into cakeBodyGroup
    this.cakeBodyGroup.add(berryMesh);
    berryMesh.position.set(localX, targetY + 0.14, localZ); // Start slightly above for cushy landing drop!
    const tiltX = (Math.random() - 0.5) * 0.24;
    const tiltZ = (Math.random() - 0.5) * 0.24;
    berryMesh.rotation.set(tiltX, Math.random() * Math.PI * 2, tiltZ);

    // Create cushioned displaced whipped-cream collar if landing directly on frosted cake!
    let collar = null;
    if (onCream && stackLevel === 0 && variant !== 'mint') {
      const collarGeo = new THREE.TorusGeometry(0.145, 0.045, 10, 24);
      collarGeo.scale(1, 1, 0.58);
      collar = new THREE.Mesh(collarGeo, this.creamMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(localX, baseSurfaceY + 0.012, localZ);
      collar.scale.set(0.1, 0.1, 0.1);
      collar.castShadow = true;
      collar.receiveShadow = true;
      this.cakeBodyGroup.add(collar);
    }

    const entry = {
      mesh: berryMesh,
      collar,
      localPos: new THREE.Vector3(localX, targetY, localZ),
      baseRot: new THREE.Euler(tiltX, berryMesh.rotation.y, tiltZ),
      stackLevel,
      parentBerry: supportBerry,
      variant,
      dropAge: 0,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: stackLevel >= 2 ? 0.16 : stackLevel === 1 ? 0.06 : 0,
      tumbling: false,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    };

    // If stacked 3+ high (stackLevel >= 3), it teeters briefly then tumbles delightfully!
    let tumbledSoon = false;
    if (stackLevel >= 3) {
      entry.wobbleAmp = 0.34;
      entry.tumbleCountdown = 0.55;
      tumbledSoon = true;
    }

    this.berries.push(entry);
    this.triggerSquish(variant === 'mint' ? 0.02 : 0.05);

    return {
      stacked: stackLevel > 0,
      stackLevel,
      onCream,
      tumbledSoon,
    };
  }

  // Dust frosted powdered sugar snow across top of cake!
  addPowderedSugarBurst(localX, localZ) {
    this.sugarDustCount++;
    const maxR = CAKE_RADIUS + 0.02;
    const cx = (0.5 + localX / (maxR * 2)) * 256;
    const cy = (0.5 + localZ / (maxR * 2)) * 256;

    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.7) * 68;
      const sx = cx + Math.cos(a) * dist;
      const sy = cy + Math.sin(a) * dist;
      const r = 0.8 + Math.random() * 2.4;
      this.sugarCtx.fillStyle = `rgba(255, 255, 255, ${0.26 + Math.random() * 0.48})`;
      this.sugarCtx.beginPath();
      this.sugarCtx.arc(sx, sy, r, 0, Math.PI * 2);
      this.sugarCtx.fill();
    }
    this.sugarTex.needsUpdate = true;
  }

  // Triggered when guest eats a slice: removes a 60° wedge centered cleanly toward the camera
  // so BOTH interior layered sponge + cream + strawberry cross-sections shine openly!
  cutNextSlice() {
    const wedgeAngle = Math.PI / 3; // 60 degrees per bite
    this.eatenWedges++;
    // Compensate for turntable spin so the open cut ALWAYS faces the viewer at a 3/4 hero angle!
    const cutOrigin = -this.servePlateGroup.rotation.y - Math.PI * 0.28;
    const startAngle = cutOrigin + (this.eatenWedges - 1) * wedgeAngle;
    const totalEatenAngle = Math.min(Math.PI * 1.92, this.eatenWedges * wedgeAngle);

    // Hide intact dynamic meshes and show cleanly sliced cake with exact cream coat + interior layers!
    this.spongeGroup.visible = false;
    this.creamGroup.visible = false;
    this.sugarOverlay.visible = false;

    if (this.slicedGroup) {
      this.cakeBodyGroup.remove(this.slicedGroup);
    }

    const remainingAngle = Math.max(0.05, Math.PI * 2 - totalEatenAngle);
    this.slicedGroup = this._buildCakeArcMesh(cutOrigin + totalEatenAngle, remainingAngle, this.overallCoverage > 0.25);
    this.cakeBodyGroup.add(this.slicedGroup);

    // Build the cut wedge that rides on the fork!
    const sliceMesh = this._buildCakeArcMesh(-Math.PI * 0.16, wedgeAngle, this.overallCoverage > 0.25, 0.96);
    sliceMesh.position.set(0, 0, 0);

    // Move any berries/rosettes that fell inside the eaten angular wedge onto the fork slice (or remove cleanly)!
    let carriedBerry = false;
    const normAng = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const inWedge = (x, z) => {
      const a = normAng(Math.atan2(x, z));
      const s = normAng(startAngle);
      const diff = normAng(a - s);
      return diff <= wedgeAngle + 0.1 || diff >= Math.PI * 2 - 0.1;
    };

    for (let i = this.berries.length - 1; i >= 0; i--) {
      const b = this.berries[i];
      if (inWedge(b.localPos.x, b.localPos.z) || (this.eatenWedges >= 4 && !carriedBerry)) {
        if (b.collar) this.cakeBodyGroup.remove(b.collar);
        this.cakeBodyGroup.remove(b.mesh);
        if (!carriedBerry && b.variant !== 'mint') {
          b.mesh.position.set(0.32, CAKE_HEIGHT + 0.14, 0.36);
          b.mesh.rotation.set(0.1, 0.4, 0);
          sliceMesh.add(b.mesh);
          carriedBerry = true;
        }
        this.berries.splice(i, 1);
      }
    }

    for (let i = this.rosettes.length - 1; i >= 0; i--) {
      const r = this.rosettes[i];
      if (inWedge(r.localX, r.localZ) || this.eatenWedges >= 4) {
        this.cakeBodyGroup.remove(r.mesh);
        this.rosettes.splice(i, 1);
      }
    }

    // If all 4 slices eaten, hide remaining cake so plate shows cute crumbs!
    if (this.eatenWedges >= 4) {
      this.slicedGroup.visible = false;
    }

    return sliceMesh;
  }

  _buildCakeArcMesh(thetaStart, thetaLength, frosted = true, scale = 1.0) {
    const g = new THREE.Group();
    const r = CAKE_RADIUS * scale + (frosted ? 0.04 : 0);
    const h = CAKE_HEIGHT * scale + (frosted ? 0.04 : 0);

    const outerMat = frosted
      ? this.creamMat
      : new THREE.MeshStandardMaterial({
          map: this.spongeTex.sideMap,
          bumpMap: this.spongeTex.bumpMap,
          bumpScale: 0.03,
          roughness: 0.88,
        });

    const topMat = frosted
      ? this.creamMat
      : new THREE.MeshStandardMaterial({
          map: this.spongeTex.topMap,
          bumpMap: this.spongeTex.bumpMap,
          bumpScale: 0.02,
          roughness: 0.85,
        });

    // Curved exterior arc
    const cylGeo = new THREE.CylinderGeometry(r, r, h, Math.max(8, Math.round(thetaLength * 10)), 1, false, thetaStart, thetaLength);
    cylGeo.translate(0, h * 0.5, 0);
    const cyl = new THREE.Mesh(cylGeo, [outerMat, topMat, outerMat]);
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    g.add(cyl);

    // Two flat interior cross-section walls showing double-layer sponge + cream + sliced strawberries!
    const interiorMat = new THREE.MeshStandardMaterial({
      map: this.interiorTex,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });

    const wallGeo = new THREE.PlaneGeometry(r, h);
    wallGeo.translate(r * 0.5, h * 0.5, 0);

    // Start face (angle = thetaStart, Three.js CylinderGeometry angle 0 is +Z, rotating around Y)
    const wall1 = new THREE.Mesh(wallGeo, interiorMat);
    wall1.rotation.y = thetaStart - Math.PI / 2;
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    g.add(wall1);

    // End face (angle = thetaStart + thetaLength)
    const wall2 = new THREE.Mesh(wallGeo, interiorMat);
    wall2.rotation.y = thetaStart + thetaLength - Math.PI / 2;
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    g.add(wall2);

    return g;
  }

  update(dt, onTumbleCallback) {
    // 1. Turntable rotation with smooth bearing damping
    if (Math.abs(this.spinVel) > 0.001) {
      this.spinAngle += this.spinVel * dt;
      this.spinGroup.rotation.y = this.spinAngle;
      this.spinVel *= Math.exp(-3.4 * dt);
    } else {
      this.spinVel = 0;
    }

    // 2. Elastic cake sponge spring bounce
    const springK = 140;
    const damp = 12;
    const acc = -springK * this.squish - damp * this.squishVel;
    this.squishVel += acc * dt;
    this.squish += this.squishVel * dt;
    const sy = THREE.MathUtils.clamp(1 + this.squish, 0.88, 1.12);
    const sxz = 1 / Math.sqrt(sy);
    this.cakeBodyGroup.scale.set(sxz, sy, sxz);

    // 3. Rosette elastic pop-in animation
    for (const r of this.rosettes) {
      if (r.age < 0.45) {
        r.age += dt;
        const t = Math.min(1, r.age / 0.34);
        // Overshoot elastic ease
        const s = t < 1 ? 1 + Math.sin(t * Math.PI * 1.45) * 0.24 * (1 - t) : 1;
        const cur = r.targetScale * Math.min(1.22, t * 1.25 * s);
        r.mesh.scale.set(cur, cur * (1 + (1 - t) * 0.25), cur);
      }
    }

    // 4. Berry landing cushion, wobble & playful centrifugal / tall-stack tumble!
    const fastSpin = Math.abs(this.spinVel) > 3.8;
    for (const b of this.berries) {
      // Landing cushion drop & collar rise
      if (b.dropAge < 0.45 && !b.tumbling) {
        b.dropAge += dt;
        const t = Math.min(1, b.dropAge / 0.26);
        const ease = 1 - Math.pow(1 - t, 3);
        const bounce = Math.sin(t * Math.PI) * 0.025 * (1 - t);
        b.mesh.position.y = THREE.MathUtils.lerp(b.localPos.y + 0.14, b.localPos.y, ease) + bounce;
        const sq = 1 - Math.sin(t * Math.PI) * 0.12;
        b.mesh.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        if (b.collar) {
          const cs = Math.min(1, ease * 1.15);
          b.collar.scale.set(cs, cs, cs);
        }
      }

      // Tall stack wobble or fast turntable centrifugal tumble!
      if (!b.tumbling && b.stackLevel >= 1) {
        b.wobblePhase += dt * (6.5 + b.stackLevel * 2.5);
        if (fastSpin && b.stackLevel >= 1) {
          b.wobbleAmp = Math.min(0.45, b.wobbleAmp + dt * 0.7);
          if (b.wobbleAmp > 0.32 && b.tumbleCountdown === undefined) {
            b.tumbleCountdown = 0.2;
          }
        }
        if (b.wobbleAmp > 0.01) {
          b.mesh.rotation.x = b.baseRot.x + Math.sin(b.wobblePhase) * b.wobbleAmp;
          b.mesh.rotation.z = b.baseRot.z + Math.cos(b.wobblePhase * 1.1) * b.wobbleAmp;
        }
        if (b.tumbleCountdown !== undefined) {
          b.tumbleCountdown -= dt;
          if (b.tumbleCountdown <= 0) {
            b.tumbling = true;
            const outAng = Math.atan2(b.localPos.z, b.localPos.x) + (Math.random() - 0.5) * 0.9;
            b.vel.set(Math.cos(outAng) * 0.85, 0.75, Math.sin(outAng) * 0.85);
            b.angVel.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9);
            if (onTumbleCallback) onTumbleCallback();
          }
        }
      }

      if (b.tumbling) {
        b.vel.y -= 5.8 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.x += b.angVel.x * dt;
        b.mesh.rotation.y += b.angVel.y * dt;
        b.mesh.rotation.z += b.angVel.z * dt;

        // Land gently on cake top or porcelain plate rim (never lost off table!)
        const dist = Math.hypot(b.mesh.position.x, b.mesh.position.z);
        const floorY = dist < CAKE_RADIUS * 0.96 ? CAKE_HEIGHT + 0.14 : 0.16;
        if (dist > 1.12) {
          const s = 1.12 / dist;
          b.mesh.position.x *= s;
          b.mesh.position.z *= s;
          b.vel.x *= -0.45;
          b.vel.z *= -0.45;
        }
        if (b.mesh.position.y <= floorY) {
          b.mesh.position.y = floorY;
          b.vel.y = Math.abs(b.vel.y) * 0.34;
          b.vel.x *= 0.65;
          b.vel.z *= 0.65;
          b.angVel.multiplyScalar(0.6);
          if (Math.abs(b.vel.y) < 0.18 && Math.hypot(b.vel.x, b.vel.z) < 0.12) {
            b.tumbling = false;
            b.stackLevel = 0;
            b.wobbleAmp = 0;
            b.tumbleCountdown = undefined;
            b.localPos.copy(b.mesh.position);
            b.baseRot.copy(b.mesh.rotation);
          }
        }
      }
    }
  }
}
