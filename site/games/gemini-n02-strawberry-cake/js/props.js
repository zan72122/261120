import * as THREE from 'three';
import {
  createStrawberryTextures,
  createWoodTextures,
  createCreamSwirlBump,
} from './textures.js';

let cachedBerryAssets = null;

function getBerryAssets() {
  if (cachedBerryAssets) return cachedBerryAssets;

  const redTex = createStrawberryTextures('red');
  const whiteTex = createStrawberryTextures('white');

  // Plump realistic Japanese Amaou/Tochiotome strawberry profile!
  // Note: Lathe y=0 is bottom (sits on cake/base), y=0.32 is top crown? Wait:
  // On a Japanese shortcake, strawberries stand upright with leafy calyx at bottom OR tip pointing up!
  // Let's make the iconic Japanese shortcake upright berry: plump rounded bottom at y=0, luscious red conical tip pointing UP to y=0.31, OR leafy calyx crowning the plump top?
  // WAIT: real whole strawberries on shortcake sit on their wide leafy base (or slightly tilted with green calyx visible!) OR with green calyx at the wide base sitting into the cream and pointy ruby tip UP!
  // Actually, if the calyx is at the wide bottom it gets buried in cream; whereas in Japanese patisserie shortcake, berries often have the calyx peeking out on the side/top OR sit tip-up with a vibrant green leafy collar right at the cream rim!
  // Even better: build the berry with plump shoulder at y=0.08..0.15 and tapering sweetly up to a glossy ruby tip at y=0.30, WITH the lush green curled calyx hugging the wide base shoulder (tilted slightly ~18° so you ALWAYS see both the gorgeous green leafy calyx AND the gleaming ruby tip!).
  // Wait—let's check! In `createStrawberryTextures`, y=0 (UV v=1) is pale shoulder near calyx, y=512 (UV v=0) is deep ruby tip.
  // In LatheGeometry, UV v=0 is first point in pts[], v=1 is last point in pts[].
  // So if first point is bottom (wide shoulder near calyx, y=0) -> wait: if v=0 is first point, canvas y=512 is v=0!
  // Let's match UV accurately: canvas y=0 is v=1 (pale shoulder), canvas y=512 is v=0 (deep ruby tip).
  // So let's put the deep ruby tip at y=0.30 with v=0? No, easier: put pts from bottom (y=0) to top (y=0.31), and flip V or match shoulder at bottom vs top:
  // Wait: if a strawberry sits on its wide bottom with tip pointing UP, the green leaves (calyx) are at the WIDE bottom shoulder (`y = 0.03`), fanning gracefully outward over the cream! Let's check: does that look iconic on Japanese shortcake? YES! Or sitting slightly tilted at ~25°! Even better: on a real shortcake, whole berries with calyx removed sit wide-base-down, tip-up, OR berries WITH calyx sit slightly nestled on their side/shoulder so the bright green star calyx is super visible and adorable!
  // Let's make the berry wide-shoulder at TOP (y=0.27) with calyx crowning the top? Wait—when kids draw or imagine a strawberry on a cake, they love seeing the bright green leafy crown AND the plump heart shape! Let's tilt berries gently (22°-35°) when calyx is at the base OR keep plump heart-berry with lush green calyx right at the shoulder so it's 100% unmistakably a real strawberry from every angle!
  // Wait: actually, a strawberry sitting upright on its rounded tip? No, gravity makes wide-base down natural, AND if the wide base has the green calyx petals curling gently outward/upward around the lower rim (like a fresh berry nestled in cream with leaves peeking around the red sides), OR if calyx is at the wide upper-side at a charming 35° angle... Let's test mentally:
  // Real strawberries in a bowl sit on their sides/shoulders with green calyx clearly visible. On a cake, upright wide-base-down with curled green calyx petals hugging the bottom rim looks slightly upside-down if you're used to berries hanging down, UNLESS the calyx curls neatly upward around the shoulder! Wait—Japanese patisseries almost ALWAYS place whole strawberries either:
  // (a) Upright tip-up (wide base down, calyx right at the base hugging the cream — very common in Japan when leaves are kept on!) OR
  // (b) Nestled at a 40° jaunty angle with the green calyx crowning the upper-side!
  // Let's build the berry geometry with wide shoulder at y=0.22 (calyx crowning top!) and heart tip at y=0.0? NO, if tip is down it looks pointy at bottom. Wide base at y=0.06, glossy tip at y=0.31, and green calyx hugging y=0.04 curling nicely up to y=0.10 looks super realistic upright AND when tilted 30° in the bowl! Let's invert UV.y on geometry so pale shoulder is at wide base (near calyx) and deep ruby crimson is at the tip!

  const pts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.095, 0.015),
    new THREE.Vector2(0.142, 0.058),
    new THREE.Vector2(0.152, 0.115),
    new THREE.Vector2(0.132, 0.185),
    new THREE.Vector2(0.092, 0.248),
    new THREE.Vector2(0.046, 0.292),
    new THREE.Vector2(0.001, 0.312),
  ];
  const bodyGeo = new THREE.LatheGeometry(pts, 28);
  // Subtle organic natural asymmetry + invert V so v=1 (pale shoulder) is near y=0 (calyx) and v=0 (deep ruby) is at tip y=0.312!
  const pos = bodyGeo.attributes.position;
  const uv = bodyGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const lobe = 1 + 0.045 * Math.sin(ang * 3 + y * 4) + 0.025 * Math.cos(ang * 2);
    pos.setXYZ(i, x * lobe, y, z * lobe * 0.96);
    uv.setY(i, 1 - uv.getY(i));
  }
  bodyGeo.computeVertexNormals();

  const redMat = new THREE.MeshPhysicalMaterial({
    map: redTex.map,
    bumpMap: redTex.bumpMap,
    bumpScale: 0.018,
    roughnessMap: redTex.roughnessMap,
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.92,
    clearcoatRoughness: 0.09,
    sheen: 0.15,
    sheenColor: new THREE.Color(0xff7788),
  });

  const whiteMat = new THREE.MeshPhysicalMaterial({
    map: whiteTex.map,
    bumpMap: whiteTex.bumpMap,
    bumpScale: 0.016,
    roughnessMap: whiteTex.roughnessMap,
    roughness: 0.26,
    metalness: 0.0,
    clearcoat: 0.94,
    clearcoatRoughness: 0.08,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xffeef2),
  });

  // Curved natural tapered green leaf geometry for calyx sepals
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.044, 0.055, 0.018, 0.145);
  leafShape.lineTo(0, 0.185);
  leafShape.lineTo(-0.018, 0.145);
  leafShape.quadraticCurveTo(-0.044, 0.055, 0, 0);
  const sepalGeo = new THREE.ShapeGeometry(leafShape, 6);
  // Gently curl sepal outward & slightly upward so green leaves frame the glossy ruby berry!
  const sp = sepalGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i);
    const y = sp.getY(i);
    const zCurve = Math.sin(y * 12) * 0.032 + (x * x) * 3.2;
    sp.setZ(i, zCurve);
  }
  sepalGeo.computeVertexNormals();

  const leafMat = new THREE.MeshPhysicalMaterial({
    color: 0x347d26,
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.32,
    clearcoatRoughness: 0.32,
    side: THREE.DoubleSide,
  });

  // Mint leaf geometry (broader ovate leaf)
  const mintShape = new THREE.Shape();
  mintShape.moveTo(0, 0);
  mintShape.bezierCurveTo(0.075, 0.04, 0.082, 0.14, 0, 0.22);
  mintShape.bezierCurveTo(-0.082, 0.14, -0.075, 0.04, 0, 0);
  const mintLeafGeo = new THREE.ShapeGeometry(mintShape, 8);
  const mp = mintLeafGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i);
    const y = mp.getY(i);
    const curl = Math.sin((y / 0.22) * Math.PI) * 0.026 - Math.abs(x) * 0.22;
    mp.setZ(i, curl);
  }
  mintLeafGeo.computeVertexNormals();

  const mintMat = new THREE.MeshPhysicalMaterial({
    color: 0x2e853c,
    roughness: 0.36,
    clearcoat: 0.32,
    clearcoatRoughness: 0.3,
    side: THREE.DoubleSide,
  });

  cachedBerryAssets = { bodyGeo, redMat, whiteMat, sepalGeo, leafMat, mintLeafGeo, mintMat };
  return cachedBerryAssets;
}

export function createStrawberryMesh(variant = 'red', sizeScale = 1.0) {
  const assets = getBerryAssets();
  const group = new THREE.Group();

  if (variant === 'mint') {
    // Fresh 3-leaf patisserie mint sprig
    const angles = [0, 2.15, 4.25];
    angles.forEach((a, idx) => {
      const leaf = new THREE.Mesh(assets.mintLeafGeo, assets.mintMat);
      leaf.rotation.x = -Math.PI * 0.42 + idx * 0.08;
      leaf.rotation.z = a;
      leaf.scale.setScalar(idx === 0 ? 1.05 : 0.85);
      leaf.castShadow = true;
      leaf.receiveShadow = true;
      group.add(leaf);
    });
    group.scale.setScalar(sizeScale);
    group.userData.variant = 'mint';
    return group;
  }

  const body = new THREE.Mesh(assets.bodyGeo, variant === 'white' ? assets.whiteMat : assets.redMat);
  body.castShadow = true;
  body.receiveShadow = true;
  // Center berry cleanly so local y=0 is near its center of mass for natural rotation
  body.position.y = -0.14;
  group.add(body);

  // Lush 8-leaf curled green calyx hugging the base shoulder so crisp green leaves frame the ruby berry!
  const calyx = new THREE.Group();
  calyx.position.y = -0.105;
  const numSepals = 8;
  for (let i = 0; i < numSepals; i++) {
    const ang = (i / numSepals) * Math.PI * 2 + (i % 2) * 0.14;
    const sepal = new THREE.Mesh(assets.sepalGeo, assets.leafMat);
    const wrap = new THREE.Group();
    wrap.rotation.y = ang;
    sepal.rotation.x = -Math.PI * 0.34 + (i % 2) * 0.14; // fans visibly outward & slightly up around shoulder
    sepal.position.z = 0.048;
    sepal.scale.set(1.0 + (i % 3) * 0.12, 0.98 + (i % 2) * 0.18, 1);
    sepal.castShadow = true;
    wrap.add(sepal);
    calyx.add(wrap);
  }
  // Tiny green stem nub at base
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.014, 0.06, 8),
    assets.leafMat
  );
  stem.position.y = -0.025;
  calyx.add(stem);
  group.add(calyx);

  group.scale.setScalar(sizeScale);
  group.userData.variant = variant;
  return group;
}

export class CreamBowlProp {
  constructor() {
    this.root = new THREE.Group();
    this.swirlAngle = 0;
    this.swirlVel = 0;
    this.wiggle = 0;

    // 1. Thick clear glossy patisserie glass mixing bowl
    const bowlPts = [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.36, 0.0),
      new THREE.Vector2(0.52, 0.08),
      new THREE.Vector2(0.64, 0.25),
      new THREE.Vector2(0.70, 0.44),
      new THREE.Vector2(0.72, 0.47),
      new THREE.Vector2(0.67, 0.48),
      new THREE.Vector2(0.64, 0.42),
      new THREE.Vector2(0.58, 0.24),
      new THREE.Vector2(0.45, 0.09),
      new THREE.Vector2(0.32, 0.05),
      new THREE.Vector2(0.001, 0.05),
    ];
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4fafc,
      roughness: 0.06,
      metalness: 0.04,
      transmission: 0.72,
      thickness: 0.18,
      ior: 1.5,
      transparent: true,
      opacity: 0.62,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 40), glassMat);
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    this.root.add(bowl);

    // 2. Overflowing silky ivory whipped cream mound inside bowl
    const swirlBump = createCreamSwirlBump();
    const creamGeo = new THREE.SphereGeometry(0.60, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62);
    creamGeo.scale(1.0, 0.56, 1.0);
    // Add sculpted creamy soft peak swirl on top!
    const cp = creamGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i);
      const y = cp.getY(i);
      const z = cp.getZ(i);
      const r = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      const ripple = Math.sin(a * 4 + r * 8) * 0.025 * (1 - r / 0.65);
      const peak = Math.exp(-r * r * 14) * 0.14;
      cp.setY(i, y + ripple + peak);
    }
    creamGeo.computeVertexNormals();

    this.creamMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffdf7,
      roughness: 0.21,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
      sheen: 0.45,
      sheenColor: new THREE.Color(0xfff5e4),
      bumpMap: swirlBump,
      bumpScale: 0.02,
    });
    this.creamMesh = new THREE.Mesh(creamGeo, this.creamMat);
    this.creamMesh.position.y = 0.24;
    this.creamMesh.castShadow = true;
    this.creamMesh.receiveShadow = true;
    this.root.add(this.creamMesh);

    // Generous invisible touch sphere for 5-year-old finger accuracy
    this.hitCollider = new THREE.Mesh(
      new THREE.SphereGeometry(0.84, 16, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitCollider.position.y = 0.34;
    this.hitCollider.userData.kind = 'creamBowl';
    this.root.add(this.hitCollider);

    // 3. Real Offset Stainless Patisserie Spatula (Palette Knife)
    this.spatula = this._buildSpatula();
    this.spatulaRestOffset = new THREE.Vector3(-0.22, 0.54, 0.18);
    this.spatulaRestRot = new THREE.Euler(0.35, 0.55, -0.45);
    this.spatulaLoaded = false;
  }

  _buildSpatula() {
    const group = new THREE.Group();

    // Warm walnut wooden handle
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6f4324,
      roughness: 0.45,
      metalness: 0.05,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdab25c,
      metalness: 0.9,
      roughness: 0.25,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xeef1f5,
      metalness: 0.92,
      roughness: 0.15,
    });

    // Origin of spatula is right at the blade tip so it tracks the finger/cake contact point accurately!
    // Blade: flat rounded patisserie palette blade extending from tip (0,0,0) back along +Z
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.075, 0.04);
    bladeShape.quadraticCurveTo(0, -0.04, 0.075, 0.04);
    bladeShape.lineTo(0.068, 0.54);
    bladeShape.lineTo(-0.068, 0.54);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    bladeGeo.rotateX(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, steelMat);
    blade.castShadow = true;
    group.add(blade);

    // Offset angled neck
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.016, 0.14), steelMat);
    neck.position.set(0, 0.04, 0.60);
    neck.rotation.x = -0.58;
    neck.castShadow = true;
    group.add(neck);

    // Brass ferrule collar
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.06, 16), brassMat);
    ferrule.rotation.x = Math.PI / 2;
    ferrule.position.set(0, 0.08, 0.69);
    group.add(ferrule);

    // Turned walnut handle
    const handlePts = [
      new THREE.Vector2(0.038, 0.0),
      new THREE.Vector2(0.056, 0.12),
      new THREE.Vector2(0.064, 0.34),
      new THREE.Vector2(0.055, 0.52),
      new THREE.Vector2(0.001, 0.56),
    ];
    const handle = new THREE.Mesh(new THREE.LatheGeometry(handlePts, 20), woodMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.08, 0.72);
    handle.castShadow = true;
    group.add(handle);

    // Visible luscious dollop of whipped cream perched on blade tip when scooped!
    const dollopGeo = new THREE.SphereGeometry(0.115, 20, 14);
    dollopGeo.scale(1.15, 0.68, 1.35);
    this.bladeDollop = new THREE.Mesh(dollopGeo, this.creamMat);
    this.bladeDollop.position.set(0, 0.048, 0.12);
    this.bladeDollop.scale.set(0.001, 0.001, 0.001);
    this.bladeDollop.castShadow = true;
    group.add(this.bladeDollop);

    return group;
  }

  setCreamLoaded(loaded) {
    this.spatulaLoaded = loaded;
  }

  stir(strength = 4.5) {
    this.swirlVel += strength;
  }

  update(dt) {
    if (Math.abs(this.swirlVel) > 0.01) {
      this.swirlAngle += this.swirlVel * dt;
      this.creamMesh.rotation.y = this.swirlAngle;
      this.swirlVel *= Math.exp(-3.5 * dt);
    }
    const targetDollop = this.spatulaLoaded ? 1.0 : 0.001;
    const cur = this.bladeDollop.scale.x;
    const next = THREE.MathUtils.lerp(cur, targetDollop, Math.min(1, dt * 14));
    this.bladeDollop.scale.set(next * 1.15, next * 0.68, next * 1.35);
  }
}

export class BerryDishProp {
  constructor() {
    this.root = new THREE.Group();
    this.berriesInDish = [];
    this.pickedCount = 0;
    this.wiggleTime = 0;
    this.activeHighlight = 0;

    // Warm cream ceramic handmade berry dish with glazed inside & subtle blush edge
    const dishPts = [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.42, 0.0),
      new THREE.Vector2(0.56, 0.07),
      new THREE.Vector2(0.68, 0.22),
      new THREE.Vector2(0.72, 0.30),
      new THREE.Vector2(0.67, 0.32),
      new THREE.Vector2(0.61, 0.22),
      new THREE.Vector2(0.49, 0.09),
      new THREE.Vector2(0.36, 0.06),
      new THREE.Vector2(0.001, 0.06),
    ];
    const ceramicMat = new THREE.MeshPhysicalMaterial({
      color: 0xf9f1ea,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 0.78,
      clearcoatRoughness: 0.12,
    });
    const dish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 40), ceramicMat);
    dish.castShadow = true;
    dish.receiveShadow = true;
    this.root.add(dish);

    // Subtle terracotta clay rim accent
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.695, 0.015, 10, 48),
      new THREE.MeshStandardMaterial({ color: 0xd8a894, roughness: 0.45 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.312;
    this.root.add(rim);

    // Big generous hit collider
    this.hitCollider = new THREE.Mesh(
      new THREE.SphereGeometry(0.84, 16, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitCollider.position.y = 0.28;
    this.hitCollider.userData.kind = 'berryDish';
    this.root.add(this.hitCollider);

    // Slots inside the bowl for a lush heaped pile of strawberries
    this.slots = [
      { pos: new THREE.Vector3(0.0, 0.23, 0.0), rot: new THREE.Euler(0.28, 0.4, 0.12) },
      { pos: new THREE.Vector3(-0.26, 0.20, 0.16), rot: new THREE.Euler(0.5, 1.2, -0.25) },
      { pos: new THREE.Vector3(0.27, 0.20, 0.14), rot: new THREE.Euler(0.45, -0.8, 0.3) },
      { pos: new THREE.Vector3(-0.22, 0.21, -0.22), rot: new THREE.Euler(-0.4, 2.2, -0.2) },
      { pos: new THREE.Vector3(0.24, 0.21, -0.20), rot: new THREE.Euler(-0.35, -2.0, 0.28) },
      { pos: new THREE.Vector3(0.02, 0.20, 0.30), rot: new THREE.Euler(0.6, 0.1, -0.15) },
      { pos: new THREE.Vector3(-0.02, 0.20, -0.30), rot: new THREE.Euler(-0.55, 3.1, 0.12) },
      { pos: new THREE.Vector3(-0.34, 0.25, -0.02), rot: new THREE.Euler(0.18, 1.6, -0.5) },
      { pos: new THREE.Vector3(0.34, 0.25, -0.04), rot: new THREE.Euler(0.22, -1.5, 0.45) },
      { pos: new THREE.Vector3(0.08, 0.35, 0.04), rot: new THREE.Euler(0.32, 0.9, 0.22) },
    ];

    this.refillAll();
  }

  refillAll() {
    this.berriesInDish.forEach((b) => this.root.remove(b.mesh));
    this.berriesInDish = [];
    this.slots.forEach((slot, idx) => {
      const variant = idx === 9 && this.pickedCount >= 3 ? 'white' : 'red';
      this._spawnInSlot(slot, variant, idx);
    });
  }

  _spawnInSlot(slot, variant, slotIdx) {
    const scale = variant === 'mint' ? 1.05 : 0.96 + (slotIdx % 3) * 0.07;
    const mesh = createStrawberryMesh(variant, scale);
    mesh.position.copy(slot.pos);
    mesh.rotation.copy(slot.rot);
    this.root.add(mesh);
    this.berriesInDish.push({ mesh, slot, variant, scale, popAge: 0 });
  }

  // Pick a fresh glossy berry (returns detached mesh + variant) & smoothly replenishes!
  pickBerry() {
    this.pickedCount++;
    // Prefer topmost/special berry if present, otherwise pick from dish
    let idx = this.berriesInDish.length - 1;
    // Let's occasionally serve the rare pearl-white strawberry (every 5th pick) or fresh mint sprig (every 7th pick)!
    let chosenVariant = 'red';
    if (this.pickedCount % 5 === 0) chosenVariant = 'white';
    else if (this.pickedCount % 7 === 0) chosenVariant = 'mint';

    const scale = chosenVariant === 'mint' ? 1.1 : 0.98 + Math.random() * 0.14;
    const pickedMesh = createStrawberryMesh(chosenVariant, scale);

    // Briefly animate a berry bobbing out of the dish and popping back in
    if (idx >= 0) {
      const top = this.berriesInDish[idx];
      top.popAge = 0.01;
      // Preview upcoming rare white berry in top slot before pick 5!
      if (this.pickedCount % 5 === 4 && top.variant !== 'white') {
        this.root.remove(top.mesh);
        const whitePreview = createStrawberryMesh('white', 1.08);
        whitePreview.position.copy(top.slot.pos);
        whitePreview.rotation.copy(top.slot.rot);
        this.root.add(whitePreview);
        top.mesh = whitePreview;
        top.variant = 'white';
      } else if (top.variant === 'white' && chosenVariant === 'white') {
        this.root.remove(top.mesh);
        const redPreview = createStrawberryMesh('red', 1.02);
        redPreview.position.copy(top.slot.pos);
        redPreview.rotation.copy(top.slot.rot);
        this.root.add(redPreview);
        top.mesh = redPreview;
        top.variant = 'red';
      }
    }

    this.triggerWiggle(0.4);
    return { mesh: pickedMesh, variant: chosenVariant };
  }

  triggerWiggle(strength = 1.0) {
    this.wiggleTime = 0.45 * strength;
  }

  update(dt) {
    if (this.wiggleTime > 0) {
      this.wiggleTime = Math.max(0, this.wiggleTime - dt);
      const s = Math.sin(this.wiggleTime * 34) * this.wiggleTime * 0.18;
      this.root.rotation.z = s;
      this.root.rotation.x = s * 0.5;
    } else {
      this.root.rotation.z *= 0.85;
      this.root.rotation.x *= 0.85;
    }

    for (const b of this.berriesInDish) {
      if (b.popAge > 0 && b.popAge < 0.4) {
        b.popAge += dt;
        const t = Math.min(1, b.popAge / 0.35);
        const sc = b.scale * (0.4 + 0.6 * t + Math.sin(t * Math.PI) * 0.12);
        b.mesh.scale.setScalar(sc);
      }
    }
  }
}

export class SugarShakerProp {
  constructor() {
    this.root = new THREE.Group();
    this.restPos = new THREE.Vector3();
    this.shakeAnim = 0;
    this.wiggleTime = 0;
    this.awake = false;

    // Fluted glass shaker jar filled with snowy white powdered sugar
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7fbfd,
      roughness: 0.08,
      metalness: 0.04,
      transmission: 0.65,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1.0,
    });
    const sugarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
    });
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0xe6e9ee,
      metalness: 0.92,
      roughness: 0.18,
    });

    // Inner snow-white powdered sugar volume
    const sugarFill = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.23, 0.38, 24), sugarMat);
    sugarFill.position.y = 0.21;
    this.root.add(sugarFill);

    // Outer glossy glass cylinder
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.265, 0.52, 24), glassMat);
    jar.position.y = 0.26;
    jar.castShadow = true;
    jar.receiveShadow = true;
    this.root.add(jar);

    // Stainless perforated dome shaker cap
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.235, 0.09, 24), lidMat);
    collar.position.y = 0.55;
    collar.castShadow = true;
    this.root.add(collar);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.218, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      lidMat
    );
    dome.position.y = 0.59;
    dome.castShadow = true;
    this.root.add(dome);

    // Tiny decorative shaker holes on dome top
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x3a3d42 });
    const holeGeo = new THREE.CircleGeometry(0.015, 8);
    const holePos = [
      [0, 0],
      [0.065, 0],
      [-0.065, 0],
      [0, 0.065],
      [0, -0.065],
      [0.048, 0.048],
      [-0.048, 0.048],
      [0.048, -0.048],
      [-0.048, -0.048],
    ];
    holePos.forEach(([hx, hz]) => {
      const h = new THREE.Mesh(holeGeo, holeMat);
      h.position.set(hx, 0.802 - (hx * hx + hz * hz) * 2.2, hz);
      h.rotation.x = -Math.PI / 2;
      this.root.add(h);
    });

    this.hitCollider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.95, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitCollider.position.y = 0.42;
    this.hitCollider.userData.kind = 'sugarShaker';
    this.root.add(this.hitCollider);
  }

  triggerWiggle() {
    this.wiggleTime = 0.35;
  }

  update(dt) {
    if (this.wiggleTime > 0) {
      this.wiggleTime = Math.max(0, this.wiggleTime - dt);
      this.root.rotation.z = Math.sin(this.wiggleTime * 36) * this.wiggleTime * 0.25;
    } else if (!this.shaking) {
      this.root.rotation.z *= 0.86;
    }
  }
}

export class GuestPlaceSetting {
  constructor() {
    this.root = new THREE.Group();

    const porcelainMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf9f4,
      roughness: 0.12,
      clearcoat: 0.82,
      clearcoatRoughness: 0.08,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd9b366,
      metalness: 0.9,
      roughness: 0.24,
    });
    const napkinMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4e8dc,
      roughness: 0.88,
      sheen: 0.65,
      sheenColor: new THREE.Color(0xfff5ec),
    });
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xedf0f4,
      metalness: 0.94,
      roughness: 0.14,
    });

    // Folded linen napkin resting neatly beside the guest's plate spot
    const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.025, 0.72), napkinMat);
    napkin.position.set(0.82, 0.014, 0.04);
    napkin.rotation.y = -0.06;
    napkin.castShadow = true;
    napkin.receiveShadow = true;
    this.root.add(napkin);

    // Subtle linen placemat under guest's serving spot (physically shows WHERE the finished cake goes!)
    const placematMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6d4be,
      roughness: 0.92,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xf7ead8),
    });
    const placemat = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.08, 0.012, 48), placematMat);
    placemat.position.set(0, 0.006, 0);
    placemat.receiveShadow = true;
    this.root.add(placemat);

    // Delicate stitched ring on placemat (subtle visual landing target, zero fake UI glow!)
    const stitchRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 0.955, 48),
      new THREE.MeshBasicMaterial({ color: 0xf9f2e6, side: THREE.DoubleSide })
    );
    stitchRing.rotation.x = -Math.PI / 2;
    stitchRing.position.set(0, 0.014, 0);
    this.root.add(stitchRing);

    // Small porcelain saucer/coaster waiting for the cake plate
    const platePts = [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.68, 0.0),
      new THREE.Vector2(0.86, 0.055),
      new THREE.Vector2(0.89, 0.085),
      new THREE.Vector2(0.84, 0.088),
      new THREE.Vector2(0.66, 0.036),
      new THREE.Vector2(0.001, 0.036),
    ];
    this.emptyPlate = new THREE.Mesh(new THREE.LatheGeometry(platePts, 48), porcelainMat);
    this.emptyPlate.position.y = 0.012;
    this.emptyPlate.castShadow = true;
    this.emptyPlate.receiveShadow = true;
    this.root.add(this.emptyPlate);

    const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.872, 0.007, 8, 48), goldMat);
    goldRing.rotation.x = Math.PI / 2;
    goldRing.position.y = 0.098;
    this.emptyPlate.add(goldRing);

    // Silver patisserie dessert fork!
    this.fork = this._buildFork(silverMat);
    this.forkRestPos = new THREE.Vector3(0.82, 0.042, 0.05);
    this.forkRestRot = new THREE.Euler(0, -0.06, 0);
    this.fork.position.copy(this.forkRestPos);
    this.fork.rotation.copy(this.forkRestRot);
    this.root.add(this.fork);

    // Generous hit zone over guest's serving area
    this.hitCollider = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 0.5, 24),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitCollider.position.y = 0.25;
    this.hitCollider.userData.kind = 'guestPlate';
    this.root.add(this.hitCollider);
  }

  _buildFork(mat) {
    const g = new THREE.Group();
    // Handle extending toward +Z (toward camera), tines pointing toward -Z (toward guest) or slightly angled
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.012, 0.44), mat);
    handle.position.set(0, 0, 0.14);
    handle.castShadow = true;
    g.add(handle);

    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.012, 0.06), mat);
    shoulder.position.set(0, 0, -0.10);
    shoulder.castShadow = true;
    g.add(shoulder);

    // 3 delicate silver tines
    [-0.032, 0, 0.032].forEach((tx) => {
      const tine = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.01, 0.17), mat);
      tine.position.set(tx, 0.004, -0.21);
      tine.castShadow = true;
      g.add(tine);
    });

    // Attachment mount for sliced cake wedge!
    this.forkSliceMount = new THREE.Group();
    this.forkSliceMount.position.set(0, 0.02, -0.20);
    g.add(this.forkSliceMount);

    return g;
  }
}

export function buildBakeryEnvironment(scene) {
  const env = new THREE.Group();

  // 1. Warm Sunlit Oak Wood Countertop
  const wood = createWoodTextures();
  const tableMat = new THREE.MeshStandardMaterial({
    map: wood.map,
    bumpMap: wood.bumpMap,
    bumpScale: 0.016,
    roughnessMap: wood.roughnessMap,
    roughness: 0.56,
    metalness: 0.02,
  });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 11), tableMat);
  tableTop.position.set(0, -0.2, 0.4);
  tableTop.receiveShadow = true;
  env.add(tableTop);

  // 2. Warm Sunlit Patisserie Café Back Wall
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf4e7d4,
    roughness: 0.92,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), wallMat);
  backWall.position.set(0, 4.5, -5.0);
  backWall.receiveShadow = true;
  env.add(backWall);

  // Wainscoting wooden wall paneling (cozy real Japanese patisserie feel!)
  const wainscotMat = new THREE.MeshStandardMaterial({
    color: 0xdcc4a4,
    roughness: 0.72,
  });
  const wainscot = new THREE.Mesh(new THREE.BoxGeometry(24, 2.6, 0.16), wainscotMat);
  wainscot.position.set(0, 0.8, -4.92);
  wainscot.receiveShadow = true;
  env.add(wainscot);

  // Cozy wooden café shelf along the back wall where satisfied past guests sit & cheer!
  const shelfMat = new THREE.MeshStandardMaterial({
    color: 0xa47144,
    roughness: 0.55,
  });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.16, 1.15), shelfMat);
  shelf.position.set(0, 1.92, -4.35);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  env.add(shelf);

  // Sunlit mullioned patisserie window frame above the shelf (left-center)
  const windowGroup = new THREE.Group();
  windowGroup.position.set(-2.3, 4.15, -4.88);
  const skyGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff8e6 });
  const glassBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.2), skyGlowMat);
  windowGroup.add(glassBackdrop);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.45 });
  const bars = [
    [3.95, 0.16, 0.12, 0, 1.62],
    [3.95, 0.16, 0.12, 0, -1.62],
    [0.16, 3.35, 0.12, -1.92, 0],
    [0.16, 3.35, 0.12, 1.92, 0],
    [0.09, 3.2, 0.08, 0, 0],
    [3.8, 0.09, 0.08, 0, 0.05],
  ];
  bars.forEach(([w, h, d, x, y]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
    bar.position.set(x, y, 0.04);
    windowGroup.add(bar);
  });
  env.add(windowGroup);

  // Soft decorative bakery glass cloche & stacked porcelain saucers far off on right shelf (atmosphere only, far out of reach)
  const propPorcelain = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f2, roughness: 0.14, clearcoat: 0.7 });
  for (let i = 0; i < 3; i++) {
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.045, 24), propPorcelain);
    saucer.position.set(3.4, 2.02 + i * 0.05, -4.35);
    env.add(saucer);
  }

  scene.add(env);
  return { env, shelfY: 2.0, shelfZ: -4.25 };
}
