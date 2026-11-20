import * as THREE from 'three';
import { createContactShadow } from './materials.js';

export const TUB = {
  outerMinX: -0.84,
  outerMaxX: 0.60,
  outerMinZ: -0.62,
  outerMaxZ: 0.16,
  rimY: 0.52,
  floorY: 0.10,
  innerMinX: -0.68,
  innerMaxX: 0.44,
  innerMinZ: -0.45,
  innerMaxZ: 0.06,
  drainPos: new THREE.Vector3(-0.53, 0.10, -0.195),
  overflowPos: new THREE.Vector3(-0.674, 0.432, -0.195),
  spoutTip: new THREE.Vector3(-0.535, 0.618, -0.195),
};

export function buildBathroomScene(scene, assets) {
  const { materials, models } = assets;
  const root = new THREE.Group();
  scene.add(root);

  // =========================================================================
  // 1. ARCHITECTURAL ROOM (Tiled Floor, Subway-Tiled Walls, Frosted Window, Ceiling)
  // =========================================================================
  const floorGeo = new THREE.PlaneGeometry(3.8, 3.6);
  const floor = new THREE.Mesh(floorGeo, materials.floorTileMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.3, 0, 0.6);
  floor.receiveShadow = true;
  root.add(floor);

  // Back tiled wall (z = -0.62)
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.5), materials.wallTileMat);
  backWall.position.set(0.35, 1.25, -0.62);
  backWall.receiveShadow = true;
  root.add(backWall);

  // Left tiled wall (x = -0.84)
  const leftWallMat = materials.wallTileMat.clone();
  leftWallMat.map = materials.wallTileMat.map.clone();
  leftWallMat.map.repeat.set(2.4, 2.2);
  leftWallMat.map.needsUpdate = true;
  leftWallMat.normalMap = materials.wallTileMat.normalMap.clone();
  leftWallMat.normalMap.repeat.set(2.4, 2.2);
  leftWallMat.normalMap.needsUpdate = true;
  leftWallMat.roughnessMap = materials.wallTileMat.roughnessMap.clone();
  leftWallMat.roughnessMap.repeat.set(2.4, 2.2);
  leftWallMat.roughnessMap.needsUpdate = true;

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), leftWallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-0.84, 1.25, 0.63);
  leftWall.receiveShadow = true;
  root.add(leftWall);

  // Right tiled wall (x = 1.45)
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), leftWallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(1.45, 1.25, 0.63);
  rightWall.receiveShadow = true;
  root.add(rightWall);

  // Ceiling (warm matte plaster with recessed downlight fixture for natural reflections)
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1ea,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.4,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.4), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0.3, 2.45, 0.6);
  root.add(ceiling);

  // Recessed ceiling light trim + glowing diffuser (adds crisp specular reflection on water & chrome!)
  const lightTrim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 12, 32), materials.stainlessMat);
  lightTrim.rotation.x = Math.PI / 2;
  lightTrim.position.set(-0.15, 2.445, -0.15);
  root.add(lightTrim);

  const lightDiffuser = new THREE.Mesh(
    new THREE.CircleGeometry(0.078, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff8ec })
  );
  lightDiffuser.rotation.x = Math.PI / 2;
  lightDiffuser.position.set(-0.15, 2.442, -0.15);
  root.add(lightDiffuser);

  // Frosted daylight bathroom window on upper-left wall (real light source!)
  const windowGroup = new THREE.Group();
  windowGroup.position.set(-0.836, 1.48, -0.05);
  const sashMat = new THREE.MeshStandardMaterial({ color: 0xd9dce0, roughness: 0.35, metalness: 0.72 });
  const winW = 0.86, winH = 0.76, frameT = 0.032;
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, frameT, winW + frameT * 2), sashMat);
  topBar.position.set(0, winH / 2 + frameT / 2, 0);
  const botBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, frameT, winW + frameT * 2), sashMat);
  botBar.position.set(0.01, -winH / 2 - frameT / 2, 0);
  const lBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, winH, frameT), sashMat);
  lBar.position.set(0, 0, -winW / 2 - frameT / 2);
  const rBar = new THREE.Mesh(new THREE.BoxGeometry(0.035, winH, frameT), sashMat);
  rBar.position.set(0, 0, winW / 2 + frameT / 2);
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.025, winH, 0.022), sashMat);
  const frostedPane = new THREE.Mesh(
    new THREE.PlaneGeometry(winW, winH),
    new THREE.MeshStandardMaterial({
      color: 0xfffdf8,
      emissive: new THREE.Color(0xfffaf0),
      emissiveIntensity: 1.35,
      roughness: 0.55,
      metalness: 0.0,
    })
  );
  frostedPane.rotation.y = Math.PI / 2;
  frostedPane.position.x = -0.008;
  windowGroup.add(topBar, botBar, lBar, rBar, mullion, frostedPane);
  root.add(windowGroup);

  // Wall corner silicone caulk & stainless floor baseboard trim
  const backFloorTrim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.014, 0.012), materials.caulkMat);
  backFloorTrim.position.set(0.35, 0.007, -0.614);
  root.add(backFloorTrim);

  // Marble floating shelf on back tiled wall (holds potted succulent — framed cleanly in upper shot!)
  const shelfGroup = new THREE.Group();
  const shelfSlab = new THREE.Mesh(
    createBeveledBox(0.68, 0.022, 0.155, 0.004),
    materials.marbleMat
  );
  shelfSlab.position.set(0.28, 0.84, -0.542);
  shelfSlab.castShadow = true;
  shelfSlab.receiveShadow = true;
  shelfGroup.add(shelfSlab);
  for (const bx of [0.06, 0.50]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.036, 0.105), materials.stainlessMat);
    bracket.position.set(bx, 0.812, -0.568);
    shelfGroup.add(bracket);
  }
  root.add(shelfGroup);

  // Sleek brushed-charcoal framed bathroom mirror above marble shelf (adds genuine architectural depth & steamable glass!)
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(0.28, 1.24, -0.608);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.36, metalness: 0.72 });
  const mW = 0.62, mH = 0.64, fT = 0.014, fD = 0.022;
  const mTop = new THREE.Mesh(new THREE.BoxGeometry(mW + fT * 2, fT, fD), frameMat);
  mTop.position.y = mH / 2 + fT / 2;
  const mBot = new THREE.Mesh(new THREE.BoxGeometry(mW + fT * 2, fT, fD), frameMat);
  mBot.position.y = -mH / 2 - fT / 2;
  const mL = new THREE.Mesh(new THREE.BoxGeometry(fT, mH, fD), frameMat);
  mL.position.x = -mW / 2 - fT / 2;
  const mR = new THREE.Mesh(new THREE.BoxGeometry(fT, mH, fD), frameMat);
  mR.position.x = mW / 2 + fT / 2;
  const mirrorUniforms = {
    uEnvMap: { value: assets.rawHdr },
    uFog: { value: 0.35 },
    uTime: { value: 0 },
  };
  const mirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(mW, mH),
    new THREE.ShaderMaterial({
      uniforms: mirrorUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uEnvMap;
        uniform float uFog;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        const float PI = 3.14159265359;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }

        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = vec3(0.0, 0.0, 1.0);
          vec3 R = reflect(-V, N);
          // Sample realistic bathroom interior behind viewer from HDRI
          float phi = atan(R.z, R.x) - 0.55;
          vec2 envUV = vec2(fract(phi / (2.0 * PI) + 0.5), clamp(asin(clamp(R.y, -1.0, 1.0)) / PI + 0.5, 0.02, 0.98));
          vec3 refl = texture2D(uEnvMap, envUV).rgb * 0.72;

          // Subtle mirror glass depth + soft bevel edge vignette + faint diagonal room light sheen
          float diagSheen = smoothstep(0.35, 0.85, 1.0 - abs((vUv.x * 0.8 + vUv.y * 0.5) - 0.62)) * 0.14;
          vec3 glassCol = refl * vec3(0.95, 0.98, 0.99) + vec3(diagSheen);

          // Realistic warm steam condensation creeping up from the bottom of the mirror!
          float n = noise(vUv * 5.5) * 0.28 + noise(vUv * 14.0) * 0.14;
          float fogGrad = smoothstep(0.85, 0.02, vUv.y - n * 0.25);
          float fogMask = clamp(fogGrad * uFog * 1.15, 0.0, 0.82);
          vec3 fogCol = vec3(0.88, 0.89, 0.90);

          vec3 col = mix(glassCol, fogCol, fogMask);
          // Subtle inner frame shadow around edges of mirror glass
          float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          col *= mix(0.65, 1.0, smoothstep(0.0, 0.035, edge));

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })
  );
  mirrorGlass.position.z = 0.004;
  mirrorGroup.add(mTop, mBot, mL, mR, mirrorGlass);
  root.add(mirrorGroup);

  // Chrome bathroom hand-towel rail on back wall (clean architectural spacing left of marble shelf)
  const barGroup = new THREE.Group();
  const barY = 0.76, barZ = -0.562;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.28, 16), materials.chromeMat);
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-0.32, barY, barZ);
  rail.castShadow = true;
  barGroup.add(rail);
  for (const sx of [-0.44, -0.20]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.058, 12), materials.chromeMat);
    post.rotation.x = Math.PI / 2;
    post.position.set(sx, barY, -0.590);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.022, 0.011, 20), materials.chromeMat);
    base.rotation.x = Math.PI / 2;
    base.position.set(sx, barY, -0.615);
    barGroup.add(post, base);
  }
  root.add(barGroup);

  // =========================================================================
  // 2. HIGH-DETAIL SCULPTED GLAZED PORCELAIN BATHTUB
  // =========================================================================
  const tubGroup = buildPorcelainBathtub(materials);
  root.add(tubGroup);

  // Contact shadow grounding bathtub firmly onto bathroom floor tiles (crisp architectural toe-kick AO)
  const tubShadow = createContactShadow(1.62, 0.92, 0.68, 0.16);
  tubShadow.position.set(-0.11, 0.0018, -0.21);
  root.add(tubShadow);

  // Subtle dark recessed toe-kick shadow strip right under front tub skirt (tucked inside curved corners)
  const toeStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(1.26, 0.042),
    new THREE.MeshBasicMaterial({ color: 0x161412, transparent: true, opacity: 0.42, depthWrite: false })
  );
  toeStrip.rotation.x = -Math.PI / 2;
  toeStrip.position.set(-0.16, 0.0021, 0.166);
  root.add(toeStrip);

  // Silicone caulk seams trimmed cleanly inside rounded corners (zero overhang!)
  const caulkBack = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.32, 8), materials.caulkMat);
  caulkBack.rotation.z = Math.PI / 2;
  caulkBack.position.set(-0.17, TUB.rimY + 0.001, -0.617);
  const caulkLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.72, 8), materials.caulkMat);
  caulkLeft.rotation.x = Math.PI / 2;
  caulkLeft.position.set(-0.837, TUB.rimY + 0.001, -0.25);
  root.add(caulkBack, caulkLeft);

  // =========================================================================
  // 3. WALL-MOUNTED CHROME SINGLE-LEVER MIXER FAUCET
  // =========================================================================
  const faucet = buildChromeFaucet(materials);
  root.add(faucet.group);

  // =========================================================================
  // 4. RECESSED DRAIN, OVERFLOW, RUBBER PLUG & ARTICULATED BEADED CHAIN
  // =========================================================================
  const drainSystem = buildDrainAndPlug(materials);
  root.add(drainSystem.group);

  // =========================================================================
  // 5. BUNDLED POLY HAVEN CC0 GLTF MODELS + CONTACT SHADOWS
  // =========================================================================

  // 5a. Ceramic Bath-Foam Bottle (Poly Haven ceramic_vase_01 + chrome pour neck cap)
  const bathBottle = new THREE.Group();
  const vaseClone = models.ceramicBottleModel.clone();
  vaseClone.scale.setScalar(0.50); // ~10cm wide x 20cm tall
  // Subtle warm rose-clay stoneware glaze tint so bottle stands out crisply against white tiles
  vaseClone.traverse((o) => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
      o.material.color.setHex(0xe8d0cc);
      o.material.roughness = 0.22;
    }
  });
  bathBottle.add(vaseClone);

  // Subtle chrome collar & dispenser cap so it reads unmistakably as a bath-foam bottle
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.020, 0.022, 24), materials.chromeMat);
  collar.position.set(0, 0.205, 0);
  collar.castShadow = true;
  const nozzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.018, 20), materials.chromeMat);
  nozzleRing.position.set(0, 0.222, 0);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.010, 20), materials.chromeMat);
  capTop.position.set(0, 0.232, 0);
  const spoutPin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.036, 12), materials.chromeMat);
  spoutPin.rotation.z = -Math.PI / 2 + 0.18;
  spoutPin.position.set(0.022, 0.228, 0);
  bathBottle.add(collar, nozzleRing, capTop, spoutPin);

  const bottleRestPos = new THREE.Vector3(-0.56, TUB.rimY + 0.001, -0.535);
  bathBottle.position.copy(bottleRestPos);
  bathBottle.userData.restPos = bottleRestPos.clone();
  root.add(bathBottle);

  const bottleShadow = createContactShadow(0.14, 0.14, 0.45, 0.5);
  bottleShadow.position.set(bottleRestPos.x, TUB.rimY + 0.0022, bottleRestPos.z);
  root.add(bottleShadow);

  // 5b. Carved Wooden Bath Bowl (Poly Haven wooden_bowl_01 + pink-white bath salt mound inside)
  const woodenBowl = new THREE.Group();
  const bowlClone = models.woodenBowlModel.clone();
  bowlClone.scale.setScalar(0.52); // ~16cm diameter x 4.8cm tall
  woodenBowl.add(bowlClone);

  // Crystalline mineral bath salts heaped gently inside the wooden bowl
  const saltGeo = new THREE.SphereGeometry(0.068, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.45);
  saltGeo.scale(1.0, 0.34, 1.0);
  const saltPos = saltGeo.attributes.position;
  for (let i = 0; i < saltPos.count; i++) {
    const x = saltPos.getX(i), y = saltPos.getY(i), z = saltPos.getZ(i);
    const n = (Math.sin(x * 160) * Math.cos(z * 175) + Math.sin((x + z) * 240)) * 0.0022;
    saltPos.setY(i, y + n);
  }
  saltGeo.computeVertexNormals();
  const saltMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf6e4e2),
    roughness: 0.48,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    normalMap: materials.porcelainMat.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const saltMound = new THREE.Mesh(saltGeo, saltMat);
  saltMound.position.set(0, 0.022, 0);
  saltMound.receiveShadow = true;
  woodenBowl.add(saltMound);

  const bowlRestPos = new THREE.Vector3(-0.08, TUB.rimY + 0.001, -0.535);
  woodenBowl.position.copy(bowlRestPos);
  woodenBowl.userData.restPos = bowlRestPos.clone();
  woodenBowl.userData.saltMound = saltMound;
  root.add(woodenBowl);

  const bowlShadow = createContactShadow(0.18, 0.18, 0.42, 0.5);
  bowlShadow.position.set(bowlRestPos.x, TUB.rimY + 0.0022, bowlRestPos.z);
  root.add(bowlShadow);

  // 5c. Potted Succulent (Poly Haven potted_plant_04) on the upper marble wall shelf
  const plantClone = models.pottedPlantModel.clone();
  plantClone.scale.setScalar(0.76);
  plantClone.position.set(0.36, 0.852, -0.535);
  plantClone.rotation.y = -0.6;
  root.add(plantClone);
  const plantShadow = createContactShadow(0.16, 0.16, 0.45, 0.5);
  plantShadow.position.set(0.36, 0.853, -0.535);
  root.add(plantShadow);

  // 5d. Handwoven Rattan Basket (Poly Haven wicker_basket_02) on the bathroom floor beside tub
  const basketClone = models.wickerBasketModel.clone();
  basketClone.scale.setScalar(1.45);
  basketClone.position.set(0.88, 0.001, -0.26);
  basketClone.rotation.y = 0.4;
  root.add(basketClone);
  const basketShadow = createContactShadow(0.38, 0.38, 0.48, 0.5);
  basketShadow.position.set(0.88, 0.002, -0.26);
  root.add(basketShadow);

  // Extra rolled cotton spa towel tucked naturally inside the rattan basket
  const rolledTowel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.068, 0.068, 0.28, 22, 4),
    materials.towelMat
  );
  rolledTowel.position.set(0.85, 0.20, -0.25);
  rolledTowel.rotation.set(0.18, 0.3, -0.22);
  rolledTowel.castShadow = true;
  rolledTowel.receiveShadow = true;
  root.add(rolledTowel);

  // =========================================================================
  // 6. SCULPTED FOLDED TERRYCLOTH BATH TOWEL (Poly Haven terry_cloth PBR)
  // =========================================================================
  const towel = buildFoldedTowel(materials.towelMat);
  const towelRestPos = new THREE.Vector3(0.485, TUB.rimY + 0.002, -0.07);
  towel.position.copy(towelRestPos);
  towel.rotation.y = 0.06;
  towel.userData.restPos = towelRestPos.clone();
  towel.userData.restRotY = 0.06;
  root.add(towel);

  const towelShadow = createContactShadow(0.20, 0.29, 0.50, 0.40);
  towelShadow.position.set(towelRestPos.x, TUB.rimY + 0.0024, towelRestPos.z);
  towelShadow.rotation.z = 0.06;
  root.add(towelShadow);

  // =========================================================================
  // 7. WET RIM CONDENSATION SHEEN & TILE STEAM HAZE (Cleared by Towel!)
  // =========================================================================
  const rimWetMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.03,
    metalness: 0.0,
    transmission: 0.0,
    transparent: true,
    opacity: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
    depthWrite: false,
  });
  // Thin water film strips hugging the front & right rim where overflow/splashes land
  const rimWetFront = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.095), rimWetMat);
  rimWetFront.rotation.x = -Math.PI / 2;
  rimWetFront.position.set(-0.12, TUB.rimY + 0.0025, 0.11);
  root.add(rimWetFront);

  // Subtle wall condensation mist haze on lower back tiles
  const wallFogMat = new THREE.MeshBasicMaterial({
    color: 0xf7f5f0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const wallFog = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.72), wallFogMat);
  wallFog.position.set(-0.08, 0.88, -0.612);
  root.add(wallFog);

  return {
    root,
    faucet,
    drainSystem,
    bathBottle,
    bottleShadow,
    woodenBowl,
    bowlShadow,
    towel,
    towelShadow,
    rimWetMat,
    wallFogMat,
    mirrorUniforms,
  };
}

// ============================================================================
// High-Detail Parametric Glazed Porcelain Bathtub Builder
// Builds a real thick-walled built-in bathtub with ergonomic sloped backrest,
// curved rolled rim lip, recessed inner basin, and smooth continuous normals/UVs.
// ============================================================================
function buildPorcelainBathtub(materials) {
  const group = new THREE.Group();
  const mat = materials.porcelainMat;

  // Build lofted inner basin + rolled top rim + outer front/right skirt as one clean watertight surface
  // Parameterization around perimeter angle theta in [0, 2*PI) using superellipse/rounded-rect mapping
  const segU = 72; // around perimeter
  const profilePts = [
    // [tOut (0=basin center, 1=inner wall, 2=outer rim edge), y, extraBackSlope]
    // Floor center to inner floor corner
    { s: 0.0, y: 0.100, inner: true },
    { s: 0.45, y: 0.101, inner: true },
    { s: 0.82, y: 0.105, inner: true },
    // Curved cove transition from basin floor to inner walls
    { s: 0.90, y: 0.125, inner: true },
    { s: 0.95, y: 0.170, inner: true },
    { s: 0.98, y: 0.250, inner: true },
    { s: 1.00, y: 0.370, inner: true },
    { s: 1.01, y: 0.485, inner: true },
    // Soft inner fillet up to flat top rim deck (y = 0.52)
    { s: 1.03, y: 0.514, inner: true },
    { s: 1.06, y: 0.521, inner: true },
    // Flat porcelain deck across to outer rolled edge
    { s: 1.50, y: 0.521, outer: true },
    { s: 1.94, y: 0.520, outer: true },
    // Outer rolled lip fillet
    { s: 1.985, y: 0.512, outer: true },
    { s: 2.00, y: 0.495, outer: true },
    // Outer vertical apron skirt down to toe-kick at floor
    { s: 2.00, y: 0.045, outer: true },
    { s: 1.985, y: 0.030, outer: true },
    { s: 1.985, y: 0.000, outer: true },
  ];

  // Helper: point on rounded rectangle centered at (cx, cz) with half-extents (hx, hz) and corner radius r
  function roundedRectPoint(angle, cx, cz, hx, hz, r) {
    // Map uniform perimeter angle cleanly onto rounded rectangle
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    // Superellipse exponent n=6 gives crisp straight sides with smooth real porcelain corners
    const n = 5.2;
    const ax = Math.pow(Math.abs(ca), 2 / n) * Math.sign(ca);
    const az = Math.pow(Math.abs(sa), 2 / n) * Math.sign(sa);
    // Blend slight corner rounding
    const x = cx + ax * hx;
    const z = cz + az * hz;
    return [x, z];
  }

  const innerCX = (TUB.innerMinX + TUB.innerMaxX) * 0.5; // -0.12
  const innerCZ = (TUB.innerMinZ + TUB.innerMaxZ) * 0.5; // -0.195
  const innerHX = (TUB.innerMaxX - TUB.innerMinX) * 0.5; // 0.56
  const innerHZ = (TUB.innerMaxZ - TUB.innerMinZ) * 0.5; // 0.255

  const outerCX = (TUB.outerMinX + TUB.outerMaxX) * 0.5; // -0.12
  const outerCZ = (TUB.outerMinZ + TUB.outerMaxZ) * 0.5; // -0.23
  const outerHX = (TUB.outerMaxX - TUB.outerMinX) * 0.5; // 0.72
  const outerHZ = (TUB.outerMaxZ - TUB.outerMinZ) * 0.5; // 0.39

  const positions = [];
  const uvs = [];
  const indices = [];

  const ringCount = profilePts.length;
  for (let ri = 0; ri < ringCount; ri++) {
    const p = profilePts[ri];
    for (let ui = 0; ui <= segU; ui++) {
      const u = ui / segU;
      const angle = u * Math.PI * 2;
      let x, z, y = p.y;

      if (p.s <= 1.06) {
        // Inside basin cavity: smoothly interpolate ergonomic backrest recline on +X side!
        const [ix, iz] = roundedRectPoint(angle, innerCX, innerCZ, innerHX, innerHZ, 0.11);
        const depthT = Math.max(0, Math.min(1, (TUB.rimY - y) / (TUB.rimY - TUB.floorY)));
        // Ergonomic backrest slopes inward on +X side as it goes down
        let xAdj = ix;
        if (ix > innerCX) {
          const rightFrac = (ix - innerCX) / innerHX;
          xAdj -= rightFrac * depthT * 0.145; // 14.5cm backrest slope!
        } else {
          // Slight draft angle on faucet end
          const leftFrac = (innerCX - ix) / innerHX;
          xAdj += leftFrac * depthT * 0.032;
        }
        // Slight inward draft on front/back walls
        const zAdj = innerCZ + (iz - innerCZ) * (1 - depthT * 0.09);

        const scale = Math.min(1, p.s);
        const rimExpand = Math.max(0, p.s - 1.0);
        x = innerCX + (xAdj - innerCX) * scale + Math.cos(angle) * rimExpand * 0.18;
        z = innerCZ + (zAdj - innerCZ) * scale + Math.sin(angle) * rimExpand * 0.18;
      } else {
        // Rim deck & outer skirt: blend from inner lip to crisp architectural outer tub rectangle
        const t = Math.min(1, (p.s - 1.06) / (2.0 - 1.06));
        const [ix, iz] = roundedRectPoint(angle, innerCX, innerCZ, innerHX + 0.012, innerHZ + 0.012, 0.11);
        // Outer perimeter uses sharper architectural corners (n=14) so tub sits tightly against tile walls
        const ca = Math.cos(angle), sa = Math.sin(angle);
        const nOut = 14.0;
        const ox = outerCX + Math.pow(Math.abs(ca), 2 / nOut) * Math.sign(ca) * outerHX;
        const oz = outerCZ + Math.pow(Math.abs(sa), 2 / nOut) * Math.sign(sa) * outerHZ;

        // Slight toe-kick tuck on bottom rings
        const kick = p.s < 1.99 && y < 0.04 ? 0.985 : 1.0;
        x = THREE.MathUtils.lerp(ix, outerCX + (ox - outerCX) * kick, t);
        z = THREE.MathUtils.lerp(iz, outerCZ + (oz - outerCZ) * kick, t);
      }

      positions.push(x, y, z);
      // World-scale triplanar-friendly UV
      uvs.push(u * 3.0, ri / (ringCount - 1) * 1.6);
    }
  }

  const stride = segU + 1;
  for (let ri = 0; ri < ringCount - 1; ri++) {
    for (let ui = 0; ui < segU; ui++) {
      const a = ri * stride + ui;
      const b = a + 1;
      const c = (ri + 1) * stride + ui;
      const d = c + 1;
      // Winding order so normals face upward/inward inside basin and outward on skirt
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const tubMesh = new THREE.Mesh(geo, mat);
  tubMesh.castShadow = true;
  tubMesh.receiveShadow = true;
  group.add(tubMesh);

  // Subtle recessed porcelain soap-tray groove on far-back rim edge (micro architectural realism)
  return group;
}

// ============================================================================
// High-Detail Wall-Mounted Single-Lever Chrome Mixer Faucet
// ============================================================================
function buildChromeFaucet(materials) {
  const group = new THREE.Group();
  const wallX = -0.84;
  const centerZ = TUB.drainPos.z; // -0.195
  const bodyY = 0.655;

  // Dual chrome wall escutcheon flanges + matte black rubber wall seals
  for (const dz of [-0.075, 0.075]) {
    const z = centerZ + dz;
    const gasket = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.004, 24), materials.rubberMat);
    gasket.rotation.z = Math.PI / 2;
    gasket.position.set(wallX + 0.002, bodyY, z);
    group.add(gasket);

    const escutcheon = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.031, 0.022, 28), materials.chromeMat);
    escutcheon.rotation.z = -Math.PI / 2;
    escutcheon.position.set(wallX + 0.014, bodyY, z);
    escutcheon.castShadow = true;
    group.add(escutcheon);

    // Hex union nut
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.018, 6), materials.chromeMat);
    nut.rotation.z = Math.PI / 2;
    nut.position.set(wallX + 0.032, bodyY, z);
    nut.castShadow = true;
    group.add(nut);

    // Stub connecting to mixer bar
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.042, 16), materials.chromeMat);
    stub.rotation.z = Math.PI / 2;
    stub.position.set(wallX + 0.056, bodyY, z);
    stub.castShadow = true;
    group.add(stub);

    // Subtle wall contact shadow behind escutcheon
    const wShadow = createContactShadow(0.085, 0.085, 0.35, 0.5);
    wShadow.rotation.set(0, Math.PI / 2, 0);
    wShadow.position.set(wallX + 0.001, bodyY, z);
    group.add(wShadow);
  }

  // Horizontal cylindrical mixer bar
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.19, 28), materials.chromeMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(wallX + 0.082, bodyY, centerZ);
  bar.castShadow = true;
  group.add(bar);

  // Rounded bar end caps
  for (const dz of [-0.095, 0.095]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.023, 20, 14), materials.chromeMat);
    cap.scale.set(1, 1, 0.45);
    cap.position.set(wallX + 0.082, bodyY, centerZ + dz);
    group.add(cap);
  }

  // Curved bath spout arching smoothly out over the bathtub
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(wallX + 0.082, bodyY - 0.002, centerZ),
    new THREE.Vector3(wallX + 0.175, bodyY + 0.006, centerZ),
    new THREE.Vector3(wallX + 0.265, bodyY + 0.002, centerZ),
    new THREE.Vector3(wallX + 0.302, bodyY - 0.020, centerZ),
    new THREE.Vector3(wallX + 0.305, bodyY - 0.036, centerZ),
  ]);
  const spoutGeo = new THREE.TubeGeometry(spoutCurve, 28, 0.0165, 20, false);
  // Slightly flatten top/bottom for contemporary architectural spout silhouette
  const spPos = spoutGeo.attributes.position;
  for (let i = 0; i < spPos.count; i++) {
    const z = spPos.getZ(i);
    spPos.setZ(i, centerZ + (z - centerZ) * 1.25);
  }
  spoutGeo.computeVertexNormals();
  const spout = new THREE.Mesh(spoutGeo, materials.chromeMat);
  spout.castShadow = true;
  group.add(spout);

  // Recessed chrome aerator nozzle + dark honeycomb screen
  const aeratorRim = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.016, 0.010, 24), materials.chromeMat);
  aeratorRim.position.set(wallX + 0.305, bodyY - 0.037, centerZ);
  const aeratorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0135, 0.0135, 0.006, 20),
    new THREE.MeshStandardMaterial({ color: 0x26292d, roughness: 0.55, metalness: 0.4 })
  );
  aeratorCore.position.set(wallX + 0.305, bodyY - 0.040, centerZ);
  group.add(aeratorRim, aeratorCore);

  // Cartridge tower on top of mixer body
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.023, 0.044, 24), materials.chromeMat);
  turret.position.set(wallX + 0.082, bodyY + 0.034, centerZ);
  turret.castShadow = true;
  group.add(turret);

  // Articulated Single-Lever Mixer Handle (pivots smoothly upward to open flow!)
  const leverPivot = new THREE.Group();
  leverPivot.position.set(wallX + 0.082, bodyY + 0.056, centerZ);
  group.add(leverPivot);

  const leverCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.024, 24), materials.chromeMat);
  leverCap.position.set(0, 0.008, 0);
  leverCap.castShadow = true;
  leverPivot.add(leverCap);

  // Ergonomic curved chrome flat lever bar extending forward (+X)
  const leverBar = new THREE.Mesh(createBeveledBox(0.118, 0.010, 0.028, 0.004), materials.chromeMat);
  leverBar.position.set(0.062, 0.016, 0);
  leverBar.rotation.z = 0.06;
  leverBar.castShadow = true;
  leverPivot.add(leverBar);

  // Subtle hot/cold ceramic dot inlay on front of lever cap
  const hotDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.0032, 12),
    new THREE.MeshStandardMaterial({ color: 0xb83832, roughness: 0.25 })
  );
  hotDot.position.set(0.0228, 0.008, -0.005);
  hotDot.rotation.y = Math.PI / 2;
  const coldDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.0032, 12),
    new THREE.MeshStandardMaterial({ color: 0x2d6aa3, roughness: 0.25 })
  );
  coldDot.position.set(0.0228, 0.008, 0.005);
  coldDot.rotation.y = Math.PI / 2;
  leverPivot.add(hotDot, coldDot);

  return { group, leverPivot };
}

// ============================================================================
// Recessed Drain, Chrome Overflow Plate, Rubber Plug & Articulated Ball Chain
// ============================================================================
function buildDrainAndPlug(materials) {
  const group = new THREE.Group();
  const dp = TUB.drainPos;
  const op = TUB.overflowPos;

  // Recessed stainless drain flange sitting flush on tub floor
  const flange = new THREE.Mesh(
    new THREE.RingGeometry(0.022, 0.039, 32),
    materials.stainlessMat
  );
  flange.rotation.x = -Math.PI / 2;
  flange.position.set(dp.x, dp.y + 0.0022, dp.z);
  group.add(flange);

  const flangeRim = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.0025, 10, 28), materials.stainlessMat);
  flangeRim.rotation.x = Math.PI / 2;
  flangeRim.position.set(dp.x, dp.y + 0.002, dp.z);
  group.add(flangeRim);

  // Dark drain pipe interior well
  const drainHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.022, 24),
    new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.9, metalness: 0.1 })
  );
  drainHole.rotation.x = -Math.PI / 2;
  drainHole.position.set(dp.x, dp.y + 0.0018, dp.z);
  group.add(drainHole);

  // Stainless drain strainer crossbars
  for (let i = 0; i < 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.002, 0.0035), materials.stainlessMat);
    bar.position.set(dp.x, dp.y + 0.0025, dp.z);
    bar.rotation.y = i * Math.PI / 2;
    group.add(bar);
  }

  // Chrome Overflow Plate on inner faucet-end tub wall
  const overflowPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.009, 28), materials.chromeMat);
  overflowPlate.rotation.z = Math.PI / 2;
  overflowPlate.position.set(op.x, op.y, op.z);
  group.add(overflowPlate);

  const overflowAnchor = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0018, 8, 16), materials.chromeMat);
  overflowAnchor.position.set(op.x + 0.009, op.y - 0.012, op.z);
  group.add(overflowAnchor);

  // Rubber Drain Plug (matte dark charcoal rubber + chrome pull ring)
  const plugGroup = new THREE.Group();
  const rubberBody = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.015, 28), materials.rubberMat);
  rubberBody.position.y = 0.0075;
  rubberBody.castShadow = true;
  const rubberLip = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.003, 10, 28), materials.rubberMat);
  rubberLip.rotation.x = Math.PI / 2;
  rubberLip.position.y = 0.014;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.012, 14), materials.chromeMat);
  post.position.y = 0.019;
  const pullRing = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 10, 20), materials.chromeMat);
  pullRing.position.y = 0.031;
  pullRing.rotation.y = Math.PI / 2;
  plugGroup.add(rubberBody, rubberLip, post, pullRing);
  plugGroup.position.set(dp.x, dp.y + 0.001, dp.z);
  group.add(plugGroup);

  // Articulated 28-bead chrome ball chain (InstancedMesh updated each frame)
  const beadCount = 28;
  const beadGeo = new THREE.SphereGeometry(0.0042, 8, 8);
  const chainMesh = new THREE.InstancedMesh(beadGeo, materials.chromeMat, beadCount);
  chainMesh.castShadow = true;
  group.add(chainMesh);

  const anchorWorld = new THREE.Vector3(op.x + 0.011, op.y - 0.014, op.z);
  const dummy = new THREE.Object3D();

  function updateChain(plugPos, waterLevel, swirlPhase = 0) {
    const end = new THREE.Vector3(plugPos.x, plugPos.y + 0.035, plugPos.z);
    const mid = anchorWorld.clone().lerp(end, 0.52);
    // Natural catenary sag + gentle buoyancy wave in water
    const dist = anchorWorld.distanceTo(end);
    const slack = Math.max(0.02, 0.44 - dist);
    mid.y = Math.max(TUB.floorY + 0.012, mid.y - slack * 0.62);
    mid.x += slack * 0.14;
    if (waterLevel > 0.16 && plugPos.y < waterLevel) {
      mid.z += Math.sin(swirlPhase) * 0.018;
    }

    for (let i = 0; i < beadCount; i++) {
      const t = i / (beadCount - 1);
      const inv = 1 - t;
      // Quadratic Bezier
      const x = inv * inv * anchorWorld.x + 2 * inv * t * mid.x + t * t * end.x;
      const y = inv * inv * anchorWorld.y + 2 * inv * t * mid.y + t * t * end.y;
      const z = inv * inv * anchorWorld.z + 2 * inv * t * mid.z + t * t * end.z;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      chainMesh.setMatrixAt(i, dummy.matrix);
    }
    chainMesh.instanceMatrix.needsUpdate = true;
  }

  updateChain(plugGroup.position, 0, 0);

  return {
    group,
    plugGroup,
    anchorWorld,
    updateChain,
  };
}

// ============================================================================
// Organically Sculpted Plush Folded Terrycloth Bath Towel (Continuous C-Fold Cloth)
// Uses a continuous folded cloth ribbon extruded along Z with soft pillowed drape,
// natural slump, subtle fabric wrinkles, and zero rigid box seams!
// ============================================================================
function buildFoldedTowel(towelMat) {
  const group = new THREE.Group();

  // Build continuous S/C-folded cloth cross-section curve in XY, then sweep along Z with organic cloth creases!
  const foldCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 0.068, 0.008, 0),
    new THREE.Vector3( 0.010, 0.008, 0),
    new THREE.Vector3(-0.056, 0.010, 0),
    new THREE.Vector3(-0.072, 0.019, 0), // smooth bottom-left bend
    new THREE.Vector3(-0.056, 0.030, 0),
    new THREE.Vector3( 0.010, 0.031, 0),
    new THREE.Vector3( 0.058, 0.033, 0),
    new THREE.Vector3( 0.072, 0.044, 0), // smooth middle-right fold loop
    new THREE.Vector3( 0.056, 0.055, 0),
    new THREE.Vector3(-0.005, 0.058, 0),
    new THREE.Vector3(-0.062, 0.054, 0),
  ]);

  const segU = 68; // along the folded cross-section
  const segV = 28; // along towel length Z
  const halfThick = 0.0068;
  const lengthZ = 0.245;

  // Sweep a soft oval/pillow thickness around the 2D centerline curve in XY, then extrude along Z!
  const pts = foldCurve.getPoints(segU);
  const tangents = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(segU, i + 1)];
    return new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
  });

  // Closed loop around the cloth cross-section (top face forward + rounded end + bottom face back + rounded start)
  const ring2D = [];
  for (let i = 0; i <= segU; i++) {
    const n = new THREE.Vector2(-tangents[i].y, tangents[i].x);
    ring2D.push({ x: pts[i].x + n.x * halfThick, y: pts[i].y + n.y * halfThick, u: i / segU });
  }
  for (let i = segU; i >= 0; i--) {
    const n = new THREE.Vector2(-tangents[i].y, tangents[i].x);
    ring2D.push({ x: pts[i].x - n.x * halfThick, y: pts[i].y - n.y * halfThick, u: i / segU });
  }
  ring2D.push(ring2D[0]);

  const positions = [];
  const uvs = [];
  const indices = [];
  const R = ring2D.length;

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const zBase = (v - 0.5) * lengthZ;
    // Softly pinch ends & add organic asymmetric cloth pillowing + gentle corner slump
    const endTaper = Math.sin(v * Math.PI);
    const zSoft = 0.84 + 0.16 * Math.pow(endTaper, 0.35);

    for (let ir = 0; ir < R; ir++) {
      const p = ring2D[ir];
      const wrinkle =
        Math.sin(v * Math.PI * 3.0 + p.x * 26.0) * 0.0022 +
        Math.cos(v * Math.PI * 5.0 - p.x * 18.0) * 0.0014;
      const slump = Math.pow(Math.abs(v - 0.5) * 2.0, 2.2) * -0.004;
      const x = p.x * (0.94 + 0.06 * zSoft) + wrinkle * 0.7;
      const y = Math.max(0.001, p.y * zSoft + wrinkle + slump * (p.y / 0.06));
      const z = zBase + Math.sin(p.y * 45.0 + p.x * 16.0) * 0.003;

      positions.push(x, y, z);
      uvs.push(p.u * 2.5, v);
    }
  }

  for (let iv = 0; iv < segV; iv++) {
    for (let ir = 0; ir < R - 1; ir++) {
      const a = iv * R + ir;
      const b = a + 1;
      const c = (iv + 1) * R + ir;
      const d = c + 1;
      indices.push(a, c, d);
      indices.push(a, d, b);
    }
  }

  // Close the actual folded cloth ends cleanly (visible real S-fold cotton layers & crevices, zero clay bun cap!)
  const startBase = positions.length / 3;
  // Front/back end caps triangulated cleanly between upper & lower cloth faces of each segment i
  const nCurve = segU + 1;
  for (const endIdx of [0, segV]) {
    const rowOff = endIdx * R;
    for (let i = 0; i < segU; i++) {
      const topA = rowOff + i;
      const topB = rowOff + i + 1;
      const botA = rowOff + (2 * nCurve - 1 - i);
      const botB = rowOff + (2 * nCurve - 1 - (i + 1));
      if (endIdx === 0) {
        indices.push(topA, botA, botB);
        indices.push(topA, botB, topB);
      } else {
        indices.push(topA, botB, botA);
        indices.push(topA, topB, botB);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const clothMesh = new THREE.Mesh(geo, towelMat);
  clothMesh.castShadow = true;
  clothMesh.receiveShadow = true;
  group.add(clothMesh);

  return group;
}

// ============================================================================
// Helper: Softly Beveled Box Geometry (No razor-sharp CG edges!)
// ============================================================================
function createBeveledBox(w, h, d, r) {
  const geo = new THREE.BoxGeometry(w, h, d, 6, 4, 6);
  const pos = geo.attributes.position;
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = Math.max(-hw, Math.min(hw, x));
    const cy = Math.max(-hh, Math.min(hh, y));
    const cz = Math.max(-hd, Math.min(hd, z));
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len > 1e-5) {
      pos.setXYZ(i, cx + (dx / len) * r, cy + (dy / len) * r, cz + (dz / len) * r);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
