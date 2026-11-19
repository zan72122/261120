import * as THREE from 'three';
import { createPlushTextures } from './textures.js';

export class PlushGuest {
  constructor(type = 'bear') {
    this.type = type;
    this.root = new THREE.Group();
    this.bodyRoot = new THREE.Group();
    this.root.add(this.bodyRoot);

    const tex = createPlushTextures(type);
    const palettes = {
      bear: {
        base: 0xffffff, // map provides honey color
        sheen: 0xffe4bc,
        muzzle: 0xf4e4cb,
        innerEar: 0xe6c8a8,
        nose: 0x4a2f1d,
        accent: 0xb63842, // burgundy knitted bowtie
      },
      cat: {
        base: 0xffffff, // calico map
        sheen: 0xfff3e2,
        muzzle: 0xfbf5ec,
        innerEar: 0xf2bfc0,
        nose: 0xe28d93,
        accent: 0x3b8c8e, // teal ribbon + brass bell
      },
      bunny: {
        base: 0xffffff, // cocoa map
        sheen: 0xf0dac8,
        muzzle: 0xf6ece1,
        innerEar: 0xefc3c2,
        nose: 0xd9878e,
        accent: 0xe27b68, // warm coral knitted scarf
      },
    };
    const pal = palettes[type] || palettes.bear;

    this.furMat = new THREE.MeshPhysicalMaterial({
      color: pal.base,
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 0.018,
      roughness: 0.92,
      metalness: 0.0,
      sheen: 1.0,
      sheenColor: new THREE.Color(pal.sheen),
      sheenRoughness: 0.65,
    });

    const muzzleMat = new THREE.MeshPhysicalMaterial({
      color: pal.muzzle,
      bumpMap: tex.bumpMap,
      bumpScale: 0.012,
      roughness: 0.9,
      sheen: 0.85,
      sheenColor: new THREE.Color(0xfff9f0),
      sheenRoughness: 0.68,
    });

    const innerEarMat = new THREE.MeshPhysicalMaterial({
      color: pal.innerEar,
      roughness: 0.88,
      sheen: 0.7,
      sheenColor: new THREE.Color(0xffece8),
    });

    const glassEyeMat = new THREE.MeshPhysicalMaterial({
      color: 0x16110e,
      roughness: 0.03,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      ior: 1.55,
    });

    const noseMat = new THREE.MeshPhysicalMaterial({
      color: pal.nose,
      roughness: 0.35,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
    });

    const fabricMat = new THREE.MeshPhysicalMaterial({
      color: pal.accent,
      roughness: 0.86,
      sheen: 0.8,
      sheenColor: new THREE.Color(0xffffff),
      sheenRoughness: 0.6,
    });

    // --- Torso sitting behind the wooden café table ---
    const torsoGeo = new THREE.SphereGeometry(0.62, 28, 22);
    torsoGeo.scale(1.02, 1.08, 0.86);
    const torso = new THREE.Mesh(torsoGeo, this.furMat);
    torso.position.set(0, 0.48, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyRoot.add(torso);

    // Soft creamy tummy patch
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), muzzleMat);
    belly.scale.set(0.95, 1.0, 0.55);
    belly.position.set(0, 0.45, 0.34);
    this.bodyRoot.add(belly);

    // Unique neck accessory (bowtie / collar+bell / cozy scarf)
    this._buildNeckAccessory(fabricMat);

    // --- Head Group (smoothly tracks spatula, berries & cake!) ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.24, 0.06);
    this.bodyRoot.add(this.headGroup);

    const headGeo = new THREE.SphereGeometry(0.56, 32, 24);
    headGeo.scale(1.06, 0.96, 0.98);
    const head = new THREE.Mesh(headGeo, this.furMat);
    head.castShadow = true;
    head.receiveShadow = true;
    this.headGroup.add(head);

    // Soft plush muzzle / cheeks
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 18), muzzleMat);
    muzzle.scale.set(1.25, 0.85, 0.78);
    muzzle.position.set(0, -0.09, 0.43);
    muzzle.castShadow = true;
    this.headGroup.add(muzzle);

    // Cute nose
    const noseGeo = new THREE.SphereGeometry(0.072, 18, 14);
    noseGeo.scale(1.22, 0.84, 0.8);
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, -0.02, 0.60);
    this.headGroup.add(nose);

    // Surprise whipped-cream dab on nose (hidden until eating super creamy cake!)
    const creamDabMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffdf7,
      roughness: 0.2,
      clearcoat: 0.45,
      sheen: 0.4,
    });
    this.noseCreamDab = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 12), creamDabMat);
    this.noseCreamDab.scale.set(1.15, 0.82, 0.95);
    this.noseCreamDab.position.set(0.015, 0.025, 0.635);
    this.noseCreamDab.visible = false;
    this.headGroup.add(this.noseCreamDab);

    // Glossy obsidian glass button eyes (with crisp window reflections!)
    this.leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 16), glassEyeMat);
    this.leftEye.position.set(-0.21, 0.09, 0.49);
    this.headGroup.add(this.leftEye);

    this.rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.078, 20, 16), glassEyeMat);
    this.rightEye.position.set(0.21, 0.09, 0.49);
    this.headGroup.add(this.rightEye);

    // Subtle rosy velvet blush cheeks (brighten when happy!)
    this.cheekMat = new THREE.MeshPhysicalMaterial({
      color: 0xf49ba4,
      roughness: 0.92,
      transparent: true,
      opacity: 0.35,
    });
    const cheekGeo = new THREE.SphereGeometry(0.11, 16, 12);
    cheekGeo.scale(1.25, 0.72, 0.38);
    this.leftCheek = new THREE.Mesh(cheekGeo, this.cheekMat);
    this.leftCheek.position.set(-0.33, -0.06, 0.44);
    this.rightCheek = new THREE.Mesh(cheekGeo, this.cheekMat);
    this.rightCheek.position.set(0.33, -0.06, 0.44);
    this.headGroup.add(this.leftCheek, this.rightCheek);

    // Expressive happy open mouth (appears gently during yum bites & cheers)
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xc24c5c, roughness: 0.65 });
    this.openMouth = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mouthMat);
    this.openMouth.scale.set(1.15, 0.95, 0.55);
    this.openMouth.position.set(0, -0.155, 0.545);
    this.openMouth.scale.y = 0.01;
    this.headGroup.add(this.openMouth);

    // Species-specific ears!
    this._buildEars(innerEarMat);

    // --- Expressive Plush Paws ---
    const pawGeo = new THREE.SphereGeometry(0.19, 20, 16);
    pawGeo.scale(0.92, 0.76, 1.28);
    this.leftPaw = new THREE.Mesh(pawGeo, this.furMat);
    this.leftPaw.position.set(-0.46, 0.32, 0.52);
    this.leftPaw.castShadow = true;
    this.bodyRoot.add(this.leftPaw);

    this.rightPaw = new THREE.Mesh(pawGeo, this.furMat);
    this.rightPaw.position.set(0.46, 0.32, 0.52);
    this.rightPaw.castShadow = true;
    this.bodyRoot.add(this.rightPaw);

    // Generous invisible touch collider so tapping the guest always responds warmly
    this.hitCollider = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 16, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.hitCollider.position.set(0, 1.05, 0.1);
    this.hitCollider.userData.kind = 'guest';
    this.bodyRoot.add(this.hitCollider);

    // Animation state
    this.time = Math.random() * 10;
    this.blinkTimer = 2.2 + Math.random() * 2.5;
    this.blinkProgress = 0;
    this.lookTarget = new THREE.Vector3(0, 0.8, 0.4);
    this.curLookYaw = 0;
    this.curLookPitch = 0;

    this.mood = 'watching'; // watching | eager | eating | celebrating | shelf
    this.chewTimer = 0;
    this.bounceTimer = 0;
    this.wiggleTimer = 0;
    this.noseCreamTimer = 0;
    this.blushLevel = 0.32;
  }

  _buildNeckAccessory(fabricMat) {
    if (this.type === 'bear') {
      // Cute burgundy knitted bowtie
      const bow = new THREE.Group();
      bow.position.set(0, 0.82, 0.44);
      const wingGeo = new THREE.ConeGeometry(0.12, 0.22, 12);
      const left = new THREE.Mesh(wingGeo, fabricMat);
      left.rotation.z = -Math.PI / 2;
      left.position.x = -0.11;
      const right = new THREE.Mesh(wingGeo, fabricMat);
      right.rotation.z = Math.PI / 2;
      right.position.x = 0.11;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), fabricMat);
      bow.add(left, right, knot);
      this.bodyRoot.add(bow);
    } else if (this.type === 'cat') {
      // Teal collar ribbon + gleaming brass bell!
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 10, 28), fabricMat);
      collar.rotation.x = Math.PI / 2 + 0.12;
      collar.position.set(0, 0.84, 0.10);
      this.bodyRoot.add(collar);
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.082, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xe2bc5c, metalness: 0.92, roughness: 0.2 })
      );
      bell.position.set(0, 0.78, 0.48);
      this.bodyRoot.add(bell);
    } else {
      // Cozy coral knitted neck scarf
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.075, 12, 28), fabricMat);
      scarf.rotation.x = Math.PI / 2 + 0.1;
      scarf.position.set(0, 0.82, 0.08);
      this.bodyRoot.add(scarf);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 6, 12), fabricMat);
      tail.position.set(0.22, 0.64, 0.44);
      tail.rotation.z = 0.24;
      this.bodyRoot.add(tail);
    }
  }

  _buildEars(innerEarMat) {
    this.leftEar = new THREE.Group();
    this.rightEar = new THREE.Group();
    this.headGroup.add(this.leftEar, this.rightEar);

    if (this.type === 'bear') {
      // Classic round teddy bear ears
      const earGeo = new THREE.SphereGeometry(0.20, 20, 16);
      earGeo.scale(1, 1, 0.56);
      const inGeo = new THREE.SphereGeometry(0.115, 16, 12);
      inGeo.scale(1, 1, 0.4);

      const lOut = new THREE.Mesh(earGeo, this.furMat);
      const lIn = new THREE.Mesh(inGeo, innerEarMat);
      lIn.position.z = 0.06;
      lOut.castShadow = true;
      this.leftEar.add(lOut, lIn);
      this.leftEar.position.set(-0.44, 0.42, 0.02);

      const rOut = new THREE.Mesh(earGeo, this.furMat);
      const rIn = new THREE.Mesh(inGeo, innerEarMat);
      rIn.position.z = 0.06;
      rOut.castShadow = true;
      this.rightEar.add(rOut, rIn);
      this.rightEar.position.set(0.44, 0.42, 0.02);
    } else if (this.type === 'cat') {
      // Soft rounded triangular plush cat ears
      const earGeo = new THREE.ConeGeometry(0.22, 0.36, 16);
      earGeo.scale(1.0, 1.0, 0.58);
      const inGeo = new THREE.ConeGeometry(0.13, 0.23, 12);
      inGeo.scale(1.0, 1.0, 0.45);

      const lOut = new THREE.Mesh(earGeo, this.furMat);
      lOut.position.y = 0.14;
      lOut.castShadow = true;
      const lIn = new THREE.Mesh(inGeo, innerEarMat);
      lIn.position.set(0, 0.11, 0.065);
      this.leftEar.add(lOut, lIn);
      this.leftEar.position.set(-0.34, 0.42, 0.04);
      this.leftEar.rotation.z = 0.28;

      const rOut = new THREE.Mesh(earGeo, this.furMat);
      rOut.position.y = 0.14;
      rOut.castShadow = true;
      const rIn = new THREE.Mesh(inGeo, innerEarMat);
      rIn.position.set(0, 0.11, 0.065);
      this.rightEar.add(rOut, rIn);
      this.rightEar.position.set(0.34, 0.42, 0.04);
      this.rightEar.rotation.z = -0.28;
    } else {
      // Soft long plush lop-bunny ears!
      const earGeo = new THREE.CapsuleGeometry(0.145, 0.46, 10, 16);
      earGeo.scale(1.0, 1.0, 0.48);
      const inGeo = new THREE.CapsuleGeometry(0.08, 0.34, 8, 12);
      inGeo.scale(1.0, 1.0, 0.35);

      const lOut = new THREE.Mesh(earGeo, this.furMat);
      lOut.position.y = -0.26;
      lOut.castShadow = true;
      const lIn = new THREE.Mesh(inGeo, innerEarMat);
      lIn.position.set(0, -0.26, 0.045);
      this.leftEar.add(lOut, lIn);
      this.leftEar.position.set(-0.48, 0.28, -0.02);
      this.leftEar.rotation.z = -0.22;

      const rOut = new THREE.Mesh(earGeo, this.furMat);
      rOut.position.y = -0.26;
      rOut.castShadow = true;
      const rIn = new THREE.Mesh(inGeo, innerEarMat);
      rIn.position.set(0, -0.26, 0.045);
      this.rightEar.add(rOut, rIn);
      this.rightEar.position.set(0.48, 0.28, -0.02);
      this.rightEar.rotation.z = 0.22;
    }
  }

  setLookTarget(worldVec) {
    this.lookTarget.copy(worldVec);
  }

  setMood(mood) {
    this.mood = mood;
  }

  triggerHappyReaction() {
    this.bounceTimer = 0.75;
    this.wiggleTimer = 0.65;
  }

  triggerBite(withCreamOnNose = false) {
    this.chewTimer = 1.25;
    this.bounceTimer = 0.55;
    if (withCreamOnNose) {
      this.noseCreamDab.visible = true;
      this.noseCreamTimer = 2.6;
      this.wiggleTimer = 1.1;
    }
  }

  clearNoseCream() {
    this.noseCreamDab.visible = false;
    this.noseCreamTimer = 0;
  }

  getMouthWorldPosition(out = new THREE.Vector3()) {
    this.openMouth.getWorldPosition(out);
    return out;
  }

  update(dt) {
    this.time += dt;

    // Gentle living breathing
    const breath = Math.sin(this.time * 2.4) * 0.022;
    let jumpY = 0;
    let bodyTiltZ = 0;
    let leanForward = 0;

    if (this.mood === 'eager') {
      leanForward = 0.16;
      jumpY = Math.abs(Math.sin(this.time * 4.4)) * 0.045;
    } else if (this.mood === 'celebrating') {
      jumpY = Math.abs(Math.sin(this.time * 8.2)) * 0.22;
      bodyTiltZ = Math.sin(this.time * 7.2) * 0.11;
    } else if (this.mood === 'shelf') {
      jumpY = Math.sin(this.time * 2.1) * 0.015;
    }

    if (this.bounceTimer > 0) {
      this.bounceTimer = Math.max(0, this.bounceTimer - dt);
      jumpY += Math.sin((this.bounceTimer / 0.75) * Math.PI * 2) * 0.09 * (this.bounceTimer / 0.75);
    }

    this.bodyRoot.position.y = jumpY + breath * 0.4;
    this.bodyRoot.rotation.x = THREE.MathUtils.lerp(this.bodyRoot.rotation.x, leanForward, Math.min(1, dt * 6));
    this.bodyRoot.rotation.z = THREE.MathUtils.lerp(this.bodyRoot.rotation.z, bodyTiltZ, Math.min(1, dt * 8));

    // Smooth gaze tracking toward spatula / berry / cake!
    const headWorld = new THREE.Vector3();
    this.headGroup.getWorldPosition(headWorld);
    const toTarget = this.lookTarget.clone().sub(headWorld);
    const targetYaw = THREE.MathUtils.clamp(Math.atan2(toTarget.x, Math.max(0.4, toTarget.z)), -0.58, 0.58);
    const targetPitch = THREE.MathUtils.clamp(-Math.atan2(toTarget.y, Math.hypot(toTarget.x, toTarget.z)) * 0.55, -0.25, 0.38);

    let extraHeadShake = 0;
    if (this.wiggleTimer > 0) {
      this.wiggleTimer = Math.max(0, this.wiggleTimer - dt);
      extraHeadShake = Math.sin(this.wiggleTimer * 24) * 0.22 * this.wiggleTimer;
    }
    if (this.noseCreamTimer > 0) {
      this.noseCreamTimer -= dt;
      if (this.noseCreamTimer <= 0) {
        this.noseCreamDab.visible = false;
      }
    }

    this.curLookYaw = THREE.MathUtils.lerp(this.curLookYaw, targetYaw, Math.min(1, dt * 5.5));
    this.curLookPitch = THREE.MathUtils.lerp(this.curLookPitch, targetPitch, Math.min(1, dt * 5.5));
    this.headGroup.rotation.y = this.curLookYaw + extraHeadShake;
    this.headGroup.rotation.x = this.curLookPitch;
    this.headGroup.rotation.z = -this.curLookYaw * 0.16 + Math.sin(this.time * 1.6) * 0.035;

    // Natural eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkProgress += dt * 7.5;
      if (this.blinkProgress >= Math.PI) {
        this.blinkProgress = 0;
        this.blinkTimer = 2.6 + Math.random() * 3.0;
      }
    }
    const blinkScaleY = this.blinkProgress > 0 ? Math.max(0.12, 1 - Math.sin(this.blinkProgress) * 0.9) : 1.0;
    // Happy curved squint during celebration!
    const happyEyeY = this.mood === 'celebrating' ? 0.55 : 1.0;
    this.leftEye.scale.set(1, blinkScaleY * happyEyeY, 1);
    this.rightEye.scale.set(1, blinkScaleY * happyEyeY, 1);

    // Ears subtle joyful bounce
    const earBounce = Math.sin(this.time * (this.mood === 'celebrating' ? 11 : 3.2)) * (this.mood === 'celebrating' ? 0.16 : 0.04);
    const baseEarZ = this.type === 'cat' ? 0.28 : this.type === 'bunny' ? -0.22 : 0;
    this.leftEar.rotation.z = baseEarZ + earBounce;
    this.rightEar.rotation.z = -baseEarZ - earBounce;

    // Chewing mouth & rosy cheeks!
    let targetMouthOpen = 0.01;
    let targetBlush = 0.30;
    if (this.chewTimer > 0) {
      this.chewTimer = Math.max(0, this.chewTimer - dt);
      targetMouthOpen = 0.35 + Math.abs(Math.sin(this.chewTimer * 14)) * 0.72;
      targetBlush = 0.72;
    } else if (this.mood === 'celebrating') {
      targetMouthOpen = 0.92;
      targetBlush = 0.85;
    } else if (this.mood === 'eager') {
      targetMouthOpen = 0.22;
      targetBlush = 0.46;
    }
    this.openMouth.scale.y = THREE.MathUtils.lerp(this.openMouth.scale.y, targetMouthOpen, Math.min(1, dt * 14));
    this.blushLevel = THREE.MathUtils.lerp(this.blushLevel, targetBlush, Math.min(1, dt * 4));
    this.cheekMat.opacity = this.blushLevel;

    // Paw expressive animations!
    if (this.mood === 'celebrating') {
      const clap = Math.sin(this.time * 13);
      this.leftPaw.position.set(-0.28 + clap * 0.12, 0.62 + Math.abs(clap) * 0.14, 0.62);
      this.rightPaw.position.set(0.28 - clap * 0.12, 0.62 + Math.abs(clap) * 0.14, 0.62);
    } else if (this.mood === 'eager') {
      const tap = Math.abs(Math.sin(this.time * 5.2));
      this.leftPaw.position.set(-0.44, 0.34 + tap * 0.07, 0.58);
      this.rightPaw.position.set(0.44, 0.34 + (1 - tap) * 0.07, 0.58);
    } else if (this.chewTimer > 0) {
      const yum = Math.sin(this.time * 10);
      this.leftPaw.position.set(-0.42, 0.48 + yum * 0.05, 0.56);
      this.rightPaw.position.set(0.42, 0.48 - yum * 0.05, 0.56);
    } else {
      this.leftPaw.position.lerp(new THREE.Vector3(-0.46, 0.32, 0.52), Math.min(1, dt * 7));
      this.rightPaw.position.lerp(new THREE.Vector3(0.46, 0.32, 0.52), Math.min(1, dt * 7));
    }
  }
}
