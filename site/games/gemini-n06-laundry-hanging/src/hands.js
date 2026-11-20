import * as THREE from 'three';
import { loadPolyHavenPBRAsync } from './textures.js';

let handAssets = null;

async function ensureHandAssets() {
  if (handAssets) return handAssets;
  const [jersey, linen, oak] = await Promise.all([
    loadPolyHavenPBRAsync('cotton_jersey', {
      repeat: [2.4, 2.4],
      anisotropy: 4,
      diffuseFile: 'diffuse_neutral.jpg',
    }),
    loadPolyHavenPBRAsync('rough_linen', { repeat: [2.6, 2.6], anisotropy: 4 }),
    loadPolyHavenPBRAsync('oak_veneer_01', { repeat: [1.8, 1.8], anisotropy: 4 }),
  ]);
  handAssets = { jersey, linen, oak };
  return handAssets;
}

function createSkinMaterial(tint = 0xd9a888) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint),
    roughness: 0.74,
    metalness: 0.0,
    sheen: 0.16,
    sheenRoughness: 0.82,
    sheenColor: new THREE.Color(0xffcdb0),
  });
}

/**
 * Smooth tapered anatomical finger reaching forward along +Z (so Object3D.lookAt points fingertips at target!)
 */
function buildTaperedFingerMesh(length, baseRadius, curl, skinMat) {
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -Math.sin(curl * 0.35) * length * 0.36, Math.cos(curl * 0.35) * length * 0.36),
    new THREE.Vector3(0, -Math.sin(curl * 0.82) * length * 0.72, Math.cos(curl * 0.82) * length * 0.72),
    new THREE.Vector3(0, -Math.sin(curl * 1.18) * length, Math.cos(curl * 1.18) * length),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const tSegs = 12;
  const rSegs = 10;
  const frames = curve.computeFrenetFrames(tSegs, false);

  const positions = [];
  const indices = [];
  for (let i = 0; i <= tSegs; i++) {
    const t = i / tSegs;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    let r = baseRadius * (1.0 - t * 0.34);
    if (t > 0.85) {
      const tipT = (t - 0.85) / 0.15;
      r *= Math.sqrt(Math.max(0.02, 1 - tipT * tipT));
    }
    for (let j = 0; j <= rSegs; j++) {
      const ang = (j / rSegs) * Math.PI * 2;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      positions.push(
        p.x + N.x * cos * r * 0.94 + B.x * sin * r * 1.04,
        p.y + N.y * cos * r * 0.94 + B.y * sin * r * 1.04,
        p.z + N.z * cos * r * 0.94 + B.z * sin * r * 1.04
      );
    }
  }
  const stride = rSegs + 1;
  for (let i = 0; i < tSegs; i++) {
    for (let j = 0; j < rSegs; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, skinMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Sculpted organic hand oriented cleanly along +Z:
 *   sleeve (-Z) -> wrist -> palm (0) -> curled fingers (+Z)!
 */
function buildHandAssembly({
  scale = 1.0,
  sleeveColor = 0xcfa99d,
  sleeveTex = 'jersey',
  side = 1,
  skinTint = 0xdba98a,
  sleeveLen = 0.24,
} = {}) {
  const texSet = sleeveTex === 'linen' ? handAssets.linen : handAssets.jersey;
  const root = new THREE.Group();
  const skinMat = createSkinMaterial(skinTint);

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sleeveColor),
    map: texSet.map,
    normalMap: texSet.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    aoMap: texSet.aoMap,
    aoMapIntensity: 0.72,
    roughnessMap: texSet.roughnessMap,
    roughness: 0.94,
    metalness: 0.0,
  });

  // Sculpted organic palm centered at (0,0,0)
  const palmGeo = new THREE.SphereGeometry(0.036, 16, 14);
  palmGeo.scale(1.04, 0.44, 1.24);
  const pPos = palmGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    let x = pPos.getX(i), y = pPos.getY(i), z = pPos.getZ(i);
    // Taper gently toward wrist (-z) and widen subtly across knuckles (+z)
    const taper = z < 0 ? 1 - (-z / 0.045) * 0.26 : 1 + (z / 0.045) * 0.05;
    x *= taper;
    y -= (1 - Math.min(1, (x * x) / 0.0014)) * 0.0028;
    pPos.setXYZ(i, x, y, z);
  }
  palmGeo.computeVertexNormals();
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.castShadow = true;
  palm.receiveShadow = true;
  root.add(palm);

  // Smooth tapered wrist extending back along -Z
  const wristGeo = new THREE.CylinderGeometry(0.025, 0.021, 0.072, 14);
  wristGeo.rotateX(Math.PI / 2);
  wristGeo.scale(1.10, 0.78, 1.0);
  const wrist = new THREE.Mesh(wristGeo, skinMat);
  wrist.position.set(0, -0.002, -0.054);
  wrist.castShadow = true;
  root.add(wrist);

  // Soft textured ribbed cuff + natural sleeve extending back along -Z
  const cuffGeo = new THREE.CylinderGeometry(0.032, 0.028, 0.038, 16);
  cuffGeo.rotateX(Math.PI / 2);
  cuffGeo.scale(1.06, 0.86, 1.0);
  cuffGeo.setAttribute('uv2', cuffGeo.attributes.uv);
  const cuff = new THREE.Mesh(cuffGeo, sleeveMat);
  cuff.position.set(0, -0.002, -0.092);
  cuff.castShadow = true;
  root.add(cuff);

  const sleeveGeo = new THREE.CylinderGeometry(0.042, 0.033, sleeveLen, 16, 4);
  sleeveGeo.rotateX(Math.PI / 2);
  sleeveGeo.scale(1.08, 0.88, 1.0);
  // Add subtle natural cloth folds along the sleeve so it never reads like a smooth geometric tube
  const sPos = sleeveGeo.attributes.position;
  for (let i = 0; i < sPos.count; i++) {
    const x = sPos.getX(i), y = sPos.getY(i), z = sPos.getZ(i);
    const wrinkle = 1 + Math.sin(z * 42 + Math.atan2(y, x) * 3) * 0.032;
    sPos.setXYZ(i, x * wrinkle, y * wrinkle, z);
  }
  sleeveGeo.computeVertexNormals();
  sleeveGeo.setAttribute('uv2', sleeveGeo.attributes.uv);
  const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
  sleeve.position.set(0, -0.004, -0.108 - sleeveLen * 0.5);
  sleeve.castShadow = true;
  sleeve.receiveShadow = true;
  root.add(sleeve);

  // 4 fingers reaching forward along +Z + opposable thumb!
  const fingersGroup = new THREE.Group();
  root.add(fingersGroup);

  const fingerSpecs = [
    { x: -0.023 * side, len: 0.056, rad: 0.0072, curl: 0.34, yaw: -0.06 * side },
    { x: -0.007 * side, len: 0.062, rad: 0.0074, curl: 0.40, yaw: -0.01 * side },
    { x: 0.009 * side, len: 0.056, rad: 0.0070, curl: 0.46, yaw: 0.04 * side },
    { x: 0.023 * side, len: 0.045, rad: 0.0062, curl: 0.52, yaw: 0.09 * side },
  ];
  const fingerPivots = [];
  for (const fs of fingerSpecs) {
    const piv = new THREE.Group();
    piv.position.set(fs.x, 0.001, 0.036);
    piv.rotation.y = fs.yaw;
    piv.add(buildTaperedFingerMesh(fs.len, fs.rad, fs.curl, skinMat));
    fingersGroup.add(piv);
    fingerPivots.push(piv);
  }

  const thumbPiv = new THREE.Group();
  thumbPiv.position.set(-0.029 * side, -0.006, 0.006);
  thumbPiv.rotation.set(0.18, -0.56 * side, 0.20 * side);
  thumbPiv.add(buildTaperedFingerMesh(0.045, 0.0080, 0.28, skinMat));
  root.add(thumbPiv);

  root.scale.setScalar(scale);

  return {
    group: root,
    setPinch(amount) {
      const a = THREE.MathUtils.clamp(amount, 0, 1);
      fingerPivots.forEach((p, idx) => {
        p.rotation.x = a * (0.36 + idx * 0.06);
      });
      thumbPiv.rotation.y = (-0.56 + a * 0.32) * side;
      thumbPiv.rotation.x = 0.18 + a * 0.22;
    },
  };
}

/**
 * 1. First-person child's right hand (reaches naturally from lower-right foreground, fingertips pointing at target!)
 */
export async function createFirstPersonHand(scene) {
  await ensureHandAssets();
  const hand = buildHandAssembly({
    scale: 0.78, // natural 5-year-old child hand scale
    sleeveColor: 0xd4b2a7, // muted dusty-rose knit cotton sleeve
    sleeveTex: 'jersey',
    side: 1,
    skinTint: 0xdfb092,
    sleeveLen: 0.34,
  });

  const restPos = new THREE.Vector3(0.32, 0.36, 1.48);
  const currentPos = restPos.clone();
  const targetPos = restPos.clone();
  let visibility = 0;
  let targetVis = 0;
  let pinch = 0;
  let targetPinch = 0;

  hand.group.position.copy(restPos);
  hand.group.visible = false;
  scene.add(hand.group);

  return {
    group: hand.group,
    reachTo(worldPos, { pinchAmount = 0.65 } = {}) {
      targetPos.copy(worldPos);
      targetVis = 1;
      targetPinch = pinchAmount;
    },
    release() {
      targetVis = 0;
      targetPinch = 0.1;
    },
    update(dt, camera) {
      const k = 1 - Math.exp(-dt * 11);
      visibility += (targetVis - visibility) * (1 - Math.exp(-dt * 7.5));
      pinch += (targetPinch - pinch) * k;
      hand.setPinch(pinch);

      const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      restPos
        .copy(camera.position)
        .addScaledVector(camFwd, 0.44)
        .addScaledVector(camRight, 0.28)
        .addScaledVector(camUp, -0.46);

      const activeGoal = targetVis > 0.05 ? targetPos : restPos;
      currentPos.lerp(activeGoal, k);

      if (visibility < 0.02) {
        hand.group.visible = false;
        return;
      }
      hand.group.visible = true;
      hand.group.position.lerpVectors(restPos, currentPos, visibility);

      // Position fingertips slightly back along the reach vector so fingers touch the cloth naturally
      const shoulder = camera.position
        .clone()
        .addScaledVector(camRight, 0.26)
        .addScaledVector(camUp, -0.36)
        .addScaledVector(camFwd, 0.04);

      const reachDir = hand.group.position.clone().sub(shoulder).normalize();
      // Pull palm back ~5.5cm so fingertips touch the target instead of clipping through it
      hand.group.position.addScaledVector(reachDir, -0.055);
      // Point +Z (fingertips!) forward along reachDir toward the target!
      hand.group.lookAt(hand.group.position.clone().add(reachDir));
    },
  };
}

/**
 * 2. Mom's sunlit doorway receiving station (ZERO cylinder torso! Pure real-world photography framing!):
 *    Solid beveled oak wooden laundry tray lined with draped natural flax linen,
 *    held warmly from the sunlit veranda doorway by Mom's two sculpted hands with rolled flax-linen sleeves!
 */
export async function createMomReceivingStation(scene, slidingGlassPane = null) {
  await ensureHandAssets();
  const { linen, oak } = handAssets;

  const group = new THREE.Group();
  group.name = 'mom_receiving_station';

  const oakMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd5b186),
    map: oak.map,
    normalMap: oak.normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    aoMap: oak.aoMap,
    aoMapIntensity: 0.72,
    roughnessMap: oak.roughnessMap,
    roughness: 0.74,
    metalness: 0.0,
  });

  const linenMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xefe6d8),
    map: linen.map,
    normalMap: linen.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    aoMap: linen.aoMap,
    aoMapIntensity: 0.72,
    roughnessMap: linen.roughnessMap,
    roughness: 0.94,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Solid Oak Wooden Laundry Tray with soft draped linen cloth overhanging the edge!
  const trayGroup = new THREE.Group();
  trayGroup.position.set(0, 0.76, 0);
  group.add(trayGroup);

  const trayW = 0.42, trayD = 0.31, rimH = 0.046, wallT = 0.015;
  const trayBaseGeo = new THREE.BoxGeometry(trayW, 0.014, trayD);
  trayBaseGeo.setAttribute('uv2', trayBaseGeo.attributes.uv);
  const trayBase = new THREE.Mesh(trayBaseGeo, oakMat);
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  trayGroup.add(trayBase);

  // 4 beveled oak walls
  const frontWallGeo = new THREE.BoxGeometry(trayW, rimH, wallT);
  frontWallGeo.setAttribute('uv2', frontWallGeo.attributes.uv);
  const frontWall = new THREE.Mesh(frontWallGeo, oakMat);
  frontWall.position.set(0, rimH * 0.5, trayD * 0.5 - wallT * 0.5);
  const backWall = frontWall.clone();
  backWall.position.z = -trayD * 0.5 + wallT * 0.5;

  const sideWallGeo = new THREE.BoxGeometry(wallT, rimH, trayD - wallT * 2);
  sideWallGeo.setAttribute('uv2', sideWallGeo.attributes.uv);
  const leftWall = new THREE.Mesh(sideWallGeo, oakMat);
  leftWall.position.set(-trayW * 0.5 + wallT * 0.5, rimH * 0.5, 0);
  const rightWall = leftWall.clone();
  rightWall.position.x = trayW * 0.5 - wallT * 0.5;

  for (const w of [frontWall, backWall, leftWall, rightWall]) {
    w.castShadow = true;
    w.receiveShadow = true;
    trayGroup.add(w);
  }

  // Soft draped natural linen liner cloth inside tray + gently overhanging front lip!
  const linerGeo = new THREE.PlaneGeometry(trayW - 0.032, trayD + 0.04, 14, 14);
  linerGeo.rotateX(-Math.PI / 2);
  const lp = linerGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    let z = lp.getZ(i);
    let y = 0.011 + Math.sin(x * 18 + z * 14) * 0.0024;
    // Gently drape cloth up & over front tray lip (z > trayD * 0.44)
    if (z > trayD * 0.43) {
      const over = (z - trayD * 0.43) / 0.06;
      y = 0.048 - over * over * 0.036;
      z = trayD * 0.48 + over * 0.018;
    }
    lp.setXYZ(i, x, y, z);
  }
  linerGeo.computeVertexNormals();
  linerGeo.setAttribute('uv2', linerGeo.attributes.uv);
  const liner = new THREE.Mesh(linerGeo, linenMat);
  liner.receiveShadow = true;
  liner.castShadow = true;
  trayGroup.add(liner);

  // Mom's two warm natural hands holding the left & right wooden tray rims,
  // with soft natural linen sleeves extending seamlessly past the sunlit right doorway frame!
  const momHandL = buildHandAssembly({
    scale: 0.96,
    sleeveColor: 0xebe3d5,
    sleeveTex: 'linen',
    side: -1,
    skinTint: 0xdba98a,
    sleeveLen: 0.72,
  });
  momHandL.setPinch(0.55);
  momHandL.group.position.set(-trayW * 0.50 - 0.024, 0.028, -0.02);
  momHandL.group.rotation.set(-0.06, 0.14, -0.22);
  trayGroup.add(momHandL.group);

  const momHandR = buildHandAssembly({
    scale: 0.96,
    sleeveColor: 0xebe3d5,
    sleeveTex: 'linen',
    side: 1,
    skinTint: 0xdba98a,
    sleeveLen: 0.72,
  });
  momHandR.setPinch(0.55);
  momHandR.group.position.set(trayW * 0.50 + 0.024, 0.028, -0.02);
  momHandR.group.rotation.set(-0.06, -0.14, 0.22);
  trayGroup.add(momHandR.group);

  // Position Mom's tray emerging seamlessly from the sunlit open veranda sliding door on the right!
  const hiddenPos = new THREE.Vector3(1.98, 0.0, 0.34);
  const arrivedPos = new THREE.Vector3(1.28, 0.0, 0.22);
  group.position.copy(hiddenPos);
  group.rotation.y = -1.42;
  group.visible = false;
  scene.add(group);

  const glassClosedZ = slidingGlassPane ? slidingGlassPane.position.z : 0.18;

  let arrivalT = 0;
  let targetArrival = 0;
  let celebratePhase = 0;
  let celebrating = false;

  const stackAnchor = new THREE.Group();
  stackAnchor.position.set(0, 0.014, -0.01);
  trayGroup.add(stackAnchor);

  return {
    group,
    trayGroup,
    stackAnchor,
    arrive() {
      group.visible = true;
      targetArrival = 1;
      celebrating = false;
      celebratePhase = 0;
    },
    celebrate() {
      celebrating = true;
      celebratePhase = 0;
    },
    leave() {
      targetArrival = 0;
      celebrating = false;
    },
    getTrayWorldPos(out = new THREE.Vector3()) {
      return stackAnchor.getWorldPosition(out);
    },
    update(dt, elapsed) {
      const k = 1 - Math.exp(-dt * 4.2);
      arrivalT += (targetArrival - arrivalT) * k;

      // Gently slide the veranda glass door open when Mom arrives!
      if (slidingGlassPane) {
        slidingGlassPane.position.z = glassClosedZ - arrivalT * 0.52;
      }

      if (arrivalT < 0.01 && targetArrival === 0) {
        group.visible = false;
        return;
      }
      group.visible = true;
      group.position.lerpVectors(hiddenPos, arrivedPos, arrivalT);

      let trayY = 0.76 + Math.sin(elapsed * 2.0) * 0.006;
      let trayRotZ = Math.sin(elapsed * 1.4) * 0.012;
      if (celebrating) {
        celebratePhase += dt;
        trayY += Math.sin(Math.min(1, celebratePhase * 2.2) * Math.PI * 0.5) * 0.055;
        trayRotZ += Math.sin(celebratePhase * 6.2) * 0.038 * Math.exp(-celebratePhase * 0.65);
      }
      trayGroup.position.y = trayY;
      trayGroup.rotation.z = trayRotZ;
    },
  };
}
