import * as THREE from 'three';
import { BentoAudio } from './audio.js';

function smoothstep(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function easeOutBack(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  const c1 = 1.45;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(c - 1, 3) + c1 * Math.pow(c - 1, 2);
}

// Rest / active poses for the 5-year-old's first-person hands
const HAND_REST_L = { pos: new THREE.Vector3(-0.138, 0.064, 0.242), rot: new THREE.Euler(-1.22, 0.28, -0.48), pose: { curl: 0.38, thumbCurl: 0.26, cup: 0.22 } };
const HAND_REST_R = { pos: new THREE.Vector3( 0.138, 0.064, 0.242), rot: new THREE.Euler(-1.22, -0.28, 0.48), pose: { curl: 0.38, thumbCurl: 0.26, cup: 0.22 } };

const HAND_CUP_L  = { pos: new THREE.Vector3(-0.084, 0.095, 0.184), rot: new THREE.Euler(-1.32, 0.56, -1.16), pose: { curl: 0.68, thumbCurl: 0.40, cup: 0.80 } };
const HAND_CUP_R  = { pos: new THREE.Vector3( 0.056, 0.103, 0.184), rot: new THREE.Euler(-1.28, -0.58, 1.16), pose: { curl: 0.70, thumbCurl: 0.42, cup: 0.76 } };

// Onigiri slot positions inside the left half of the Magewappa bento box
const ONIGIRI_BENTO_SLOTS = [
  { pos: new THREE.Vector3(-0.044, 0.036, -0.014), rot: new THREE.Euler(-0.22, 0.18, 0.08) },
  { pos: new THREE.Vector3(-0.038, 0.036,  0.022), rot: new THREE.Euler(-0.26, 0.24, -0.04) },
];

export function createBentoGame(sceneCtx) {
  const { renderer, scene, camera, adaptQuality, props } = sceneCtx;
  const audio = new BentoAudio();
  const params = new URLSearchParams(window.location.search);
  const showcaseMode = params.get('showcase') === '1';
  const jumpStage = params.get('stage');

  // --- Game State ---
  // Phases: 'TABLE' | 'SHAPING' | 'NEED_NORI' | 'HOLDING_ONIGIRI' | 'LID_CLOSED' | 'PAPA_WAIT' | 'PAPA_DONE' | 'BUSY'
  let phase = 'TABLE';
  let onigiriPackedCount = 0;
  let activeOnigiriIdx = -1;
  let shapeStep = 0;          // 0..3 squeezes -> plump triangular onigiri
  let currentShapeT = 0;
  let targetShapeT = 0;
  let squeezePulse = 0;       // 0..1 spring animation when squeezing palms
  let foldStage = 0;          // 0: flat, 1: back folded, 2: front folded, 3: tied bow knot!
  let foldAnim = { back: 0, front: 0, side: 0, knot: 0 };
  let foldTarget = { back: 0, front: 0, side: 0, knot: 0 };
  let lidClosed = false;
  let lidNudged = false;
  let idleTime = 0;
  let idleHintTimer = 0;

  // Active tween animations list (lightweight & deterministic)
  const tweens = [];
  function addTween(duration, onUpdate, onDone = null) {
    tweens.push({ t: 0, duration: Math.max(0.01, duration), onUpdate, onDone });
  }

  // Hand smooth target controllers
  const handState = {
    L: {
      pos: HAND_REST_L.pos.clone(),
      rot: HAND_REST_L.rot.clone(),
      tPos: HAND_REST_L.pos.clone(),
      tRot: HAND_REST_L.rot.clone(),
      pose: { ...HAND_REST_L.pose },
      tPose: { ...HAND_REST_L.pose },
    },
    R: {
      pos: HAND_REST_R.pos.clone(),
      rot: HAND_REST_R.rot.clone(),
      tPos: HAND_REST_R.pos.clone(),
      tRot: HAND_REST_R.rot.clone(),
      pose: { ...HAND_REST_R.pose },
      tPose: { ...HAND_REST_R.pose },
    },
  };

  function setHandTarget(side, target) {
    const h = handState[side];
    h.tPos.copy(target.pos);
    h.tRot.copy(target.rot);
    if (target.pose) Object.assign(h.tPose, target.pose);
  }

  // Living prop micro-wobble trackers (spoon rock, jug shimmer, tomato jiggle, bento knock)
  const wobbles = {
    spoon: 0,
    jug: 0,
    bento: 0,
    lid: 0,
    items: new Map(),
  };

  // --- Generous Invisible Raycast Hitboxes for Easy 5-Year-Old One-Finger Touch ---
  const hitGroup = new THREE.Group();
  hitGroup.name = 'hitboxes';
  scene.add(hitGroup);

  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  function makeHitSphere(radius, name, pos) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), hitMat);
    m.position.copy(pos);
    m.userData.hitId = name;
    hitGroup.add(m);
    return m;
  }
  function makeHitBox(w, h, d, name, pos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
    m.position.copy(pos);
    m.userData.hitId = name;
    hitGroup.add(m);
    return m;
  }

  const hitBowl     = makeHitSphere(0.115, 'bowl', new THREE.Vector3(props.bowlPos.x, 0.045, props.bowlPos.z));
  const hitNori     = makeHitSphere(0.088, 'nori', new THREE.Vector3(props.noriPlatePos.x, 0.02, props.noriPlatePos.z));
  const hitBento    = makeHitBox(0.22, 0.09, 0.16, 'bento', new THREE.Vector3(props.bentoPos.x, 0.045, props.bentoPos.z));
  const hitLid      = makeHitBox(0.21, 0.06, 0.15, 'lid', new THREE.Vector3(props.lidRestPos.x, 0.025, props.lidRestPos.z));
  const hitCloth    = makeHitBox(0.36, 0.06, 0.36, 'cloth', new THREE.Vector3(props.bentoPos.x, 0.02, props.bentoPos.z));
  const hitHeld     = makeHitSphere(0.085, 'held_onigiri', new THREE.Vector3(-0.015, 0.115, 0.145));
  const hitSpoon    = makeHitBox(0.09, 0.04, 0.21, 'spoon', new THREE.Vector3(props.spoonRestPos.x, 0.02, props.spoonRestPos.z));
  const hitJug      = makeHitSphere(0.10, 'jug', new THREE.Vector3(0.24, 0.09, -0.36));

  const hitTamagos = props.tamagoyakis.map((t, idx) =>
    makeHitSphere(0.042, `tamago_${idx}`, t.platePos.clone())
  );
  const hitTomatoes = props.tomatoes.map((t, idx) =>
    makeHitSphere(0.032, `tomato_${idx}`, t.platePos.clone())
  );

  function allSidesPacked() {
    return props.tamagoyakis.every((t) => t.packed) && props.tomatoes.every((t) => t.packed);
  }

  function isReadyToCloseLid() {
    return !lidClosed && onigiriPackedCount >= 1 && allSidesPacked();
  }

  function maybeNudgeLid() {
    if (!lidNudged && onigiriPackedCount >= 2 && allSidesPacked()) {
      lidNudged = true;
      const startZ = props.bentoLid.position.z;
      const targetZ = props.lidRestPos.z + 0.038;
      addTween(0.55, (u) => {
        const s = smoothstep(u);
        props.bentoLid.position.z = startZ + (targetZ - startZ) * s;
        props.bentoLid.position.y = Math.sin(s * Math.PI) * 0.008;
        props.lidShadow.position.z = props.bentoLid.position.z;
        hitLid.position.z = props.bentoLid.position.z;
      });
      audio.playPropTap('wood');
    }
  }

  // --- Core Tactile Actions ---

  // 1. Scoop warm freshly cooked rice from wooden bowl into cupped hands
  function actionScoopRice() {
    if (phase !== 'TABLE' || onigiriPackedCount >= 2) return;
    phase = 'BUSY';
    activeOnigiriIdx = onigiriPackedCount;
    const oni = props.onigiris[activeOnigiriIdx];
    audio.playRiceScoop();

    // Right hand dips gracefully toward the steaming rice bowl
    setHandTarget('R', {
      pos: new THREE.Vector3(props.bowlPos.x + 0.055, 0.115, props.bowlPos.z + 0.085),
      rot: new THREE.Euler(-1.18, -0.35, 0.72),
      pose: { curl: 0.58, thumbCurl: 0.35, cup: 0.75 },
    });
    setHandTarget('L', {
      pos: new THREE.Vector3(-0.088, 0.095, 0.185),
      rot: new THREE.Euler(-1.30, 0.54, -1.14),
      pose: { curl: 0.52, thumbCurl: 0.30, cup: 0.72 },
    });

    const startPos = new THREE.Vector3(props.bowlPos.x + 0.01, 0.068, props.bowlPos.z + 0.01);
    const holdPos = new THREE.Vector3(-0.015, 0.116, 0.145);

    shapeStep = 0;
    currentShapeT = 0.0;
    targetShapeT = 0.0;
    oni.setShape(0.0);
    oni.setNoriWrap(0.0);
    oni.group.position.copy(startPos);
    oni.group.rotation.set(-0.28, 0.12, 0.0);
    oni.group.scale.setScalar(0.35);
    oni.group.visible = true;

    // Slight dip of rice mound in bowl as scoop is taken
    const moundStartY = props.bowlRice.position.y;

    addTween(0.24, (u) => {
      props.bowlRice.position.y = moundStartY - smoothstep(u) * 0.0025;
    }, () => {
      setHandTarget('L', HAND_CUP_L);
      setHandTarget('R', HAND_CUP_R);
      addTween(0.46, (u) => {
        const s = smoothstep(u);
        oni.group.position.lerpVectors(startPos, holdPos, s);
        oni.group.position.y += Math.sin(s * Math.PI) * 0.048;
        oni.group.scale.setScalar(0.35 + 0.65 * easeOutBack(u));
      }, () => {
        oni.group.position.copy(holdPos);
        oni.group.scale.setScalar(1.0);
        props.handSteam.group.position.copy(holdPos).add(new THREE.Vector3(0, 0.025, 0));
        props.handSteam.group.visible = true;
        phase = 'SHAPING';
      });
    });
  }

  // 2. Squeeze & shape warm rice in palms (3 satisfying rhythmic pats -> plump triangular onigiri!)
  function actionSqueezeRice() {
    if (phase !== 'SHAPING' || activeOnigiriIdx < 0) return;
    const oni = props.onigiris[activeOnigiriIdx];
    audio.playRicePat(shapeStep);
    shapeStep = Math.min(3, shapeStep + 1);
    targetShapeT = shapeStep / 3;
    squeezePulse = 1.0;

    // Slight authentic hand-turning rotation of the onigiri between squeezes!
    const baseRotZ = oni.group.rotation.z;
    const nextRotZ = shapeStep === 3 ? -0.04 : baseRotZ + 0.35;
    addTween(0.26, (u) => {
      const s = smoothstep(u);
      oni.group.rotation.z = baseRotZ + (nextRotZ - baseRotZ) * s;
      // Plump soft squish bounce
      const sq = Math.sin(u * Math.PI);
      oni.group.scale.set(1 - sq * 0.09, 1 + sq * 0.08, 1 - sq * 0.06);
    }, () => {
      oni.group.scale.setScalar(1.0);
      if (shapeStep >= 3) {
        phase = 'NEED_NORI';
        // Gently tilt shaped white onigiri slightly open in left hand while right hand frees to pick crisp nori!
        setHandTarget('L', {
          pos: new THREE.Vector3(-0.072, 0.098, 0.184),
          rot: new THREE.Euler(-1.26, 0.50, -1.04),
          pose: { curl: 0.66, thumbCurl: 0.38, cup: 0.78 },
        });
        setHandTarget('R', {
          pos: new THREE.Vector3(0.082, 0.086, 0.215),
          rot: new THREE.Euler(-1.22, -0.35, 0.68),
          pose: { curl: 0.32, thumbCurl: 0.26, cup: 0.22 },
        });
      }
    });
  }

  // 3. Pick crisp roasted Yakinori strip and wrap smoothly around the shaped onigiri!
  function actionWrapNori() {
    if (phase !== 'NEED_NORI' || activeOnigiriIdx < 0) return;
    phase = 'BUSY';
    const oni = props.onigiris[activeOnigiriIdx];
    const stripIdx = Math.min(props.noriStrips.length - 1, activeOnigiriIdx);
    const strip = props.noriStrips[stripIdx];
    audio.playNoriCrinkle();

    // Right hand glides gracefully to porcelain nori plate, lifts crisp strip, wraps around onigiri!
    setHandTarget('R', {
      pos: new THREE.Vector3(props.noriPlatePos.x + 0.06, 0.068, props.noriPlatePos.z + 0.08),
      rot: new THREE.Euler(-1.15, -0.22, 0.45),
      pose: { curl: 0.35, thumbCurl: 0.45, pinch: 0.85 },
    });

    const stripStart = strip.position.clone();
    const midTarget = oni.group.position.clone().add(new THREE.Vector3(0, -0.025, 0.015));

    addTween(0.24, () => {}, () => {
      setHandTarget('R', HAND_CUP_R);
      addTween(0.32, (u) => {
        const s = smoothstep(u);
        strip.position.lerpVectors(stripStart, midTarget, s);
        strip.position.y += Math.sin(s * Math.PI) * 0.045;
        strip.rotation.x = s * 1.1;
      }, () => {
        strip.visible = false;
        oni.setNoriWrap(0.05);
        addTween(0.34, (u) => {
          oni.setNoriWrap(0.05 + 0.95 * smoothstep(u));
          const sq = Math.sin(u * Math.PI);
          oni.group.scale.set(1 - sq * 0.04, 1 + sq * 0.03, 1 - sq * 0.05);
        }, () => {
          oni.setNoriWrap(1.0);
          oni.group.scale.setScalar(1.0);
          // Cradle completed crisp-nori onigiri poised right above open cedar bento box!
          setHandTarget('L', HAND_CUP_L);
          setHandTarget('R', HAND_CUP_R);
          phase = 'HOLDING_ONIGIRI';
        });
      });
    });
  }

  // 4. Lower completed onigiri snugly into the open left compartment of the Magewappa bento box!
  function actionPackOnigiri() {
    if (phase !== 'HOLDING_ONIGIRI' || activeOnigiriIdx < 0) return;
    phase = 'BUSY';
    const idx = activeOnigiriIdx;
    const oni = props.onigiris[idx];
    const slot = ONIGIRI_BENTO_SLOTS[idx];
    props.handSteam.group.visible = false;

    // World target position corresponding to slot inside bentoBox
    const worldSlotPos = slot.pos.clone().applyMatrix4(props.bentoBox.matrixWorld);
    const startPos = oni.group.position.clone();
    const startRot = oni.group.rotation.clone();

    // Both hands glide forward and gently lower the plump onigiri into the bento box
    setHandTarget('L', {
      pos: worldSlotPos.clone().add(new THREE.Vector3(-0.072, 0.048, 0.078)),
      rot: new THREE.Euler(-1.26, 0.42, -0.82),
      pose: { curl: 0.48, thumbCurl: 0.30, cup: 0.48 },
    });
    setHandTarget('R', {
      pos: worldSlotPos.clone().add(new THREE.Vector3(0.068, 0.052, 0.082)),
      rot: new THREE.Euler(-1.24, -0.44, 0.82),
      pose: { curl: 0.48, thumbCurl: 0.30, cup: 0.48 },
    });

    addTween(0.44, (u) => {
      const s = smoothstep(u);
      oni.group.position.lerpVectors(startPos, worldSlotPos, s);
      oni.group.position.y += Math.sin(s * Math.PI) * 0.035;
      oni.group.rotation.x = startRot.x + (slot.rot.x - startRot.x) * s;
      oni.group.rotation.y = startRot.y + (slot.rot.y - startRot.y) * s;
      oni.group.rotation.z = startRot.z + (slot.rot.z - startRot.z) * s;
    }, () => {
      // Reparent cleanly inside bentoBox so it moves with the wrapped box at the end!
      props.bentoBox.add(oni.group);
      oni.group.position.copy(slot.pos);
      oni.group.rotation.copy(slot.rot);
      audio.playPackFood('onigiri');
      wobbles.bento = 1.0;

      onigiriPackedCount++;
      activeOnigiriIdx = -1;
      setHandTarget('L', HAND_REST_L);
      setHandTarget('R', HAND_REST_R);
      phase = 'TABLE';
      maybeNudgeLid();
    });
  }

  // 5. Pick & pack a Tamagoyaki slice or Cherry Tomato from the carved wooden plate into the bento box!
  function actionPackSideItem(kind, idx) {
    if (phase !== 'TABLE' || lidClosed) return;
    const list = kind === 'tamago' ? props.tamagoyakis : props.tomatoes;
    const item = list[idx];
    if (!item || item.packed) {
      // Already packed -> playful tactile wobble!
      if (item && item.packed) {
        audio.playPropTap('wobble');
        wobbles.items.set(item.mesh, 1.0);
      }
      return;
    }

    phase = 'BUSY';
    item.packed = true;
    const startPos = item.mesh.position.clone();
    const startRot = item.mesh.rotation.clone();
    const worldDest = item.bentoPos.clone().applyMatrix4(props.bentoBox.matrixWorld);

    // Right hand reaches smoothly over to pinch the golden tamagoyaki or glossy cherry tomato
    setHandTarget('R', {
      pos: startPos.clone().add(new THREE.Vector3(0.055, 0.068, 0.095)),
      rot: new THREE.Euler(-1.18, -0.25, 0.42),
      pose: { curl: 0.42, thumbCurl: 0.48, pinch: 0.90 },
    });

    addTween(0.24, () => {}, () => {
      // Glide item in a graceful high arc right into the green lettuce nest inside the bento box
      setHandTarget('R', {
        pos: worldDest.clone().add(new THREE.Vector3(0.055, 0.068, 0.095)),
        rot: new THREE.Euler(-1.22, -0.28, 0.48),
        pose: { curl: 0.36, thumbCurl: 0.38, pinch: 0.72 },
      });
      addTween(0.44, (u) => {
        const s = smoothstep(u);
        item.mesh.position.lerpVectors(startPos, worldDest, s);
        item.mesh.position.y += Math.sin(s * Math.PI) * 0.068;
        item.mesh.rotation.x = startRot.x + (item.bentoRot.x - startRot.x) * s;
        item.mesh.rotation.y = startRot.y + (item.bentoRot.y - startRot.y) * s;
        item.mesh.rotation.z = startRot.z + (item.bentoRot.z - startRot.z) * s;
      }, () => {
        props.bentoBox.add(item.mesh);
        item.mesh.position.copy(item.bentoPos);
        item.mesh.rotation.copy(item.bentoRot);
        audio.playPackFood(kind);
        wobbles.items.set(item.mesh, 1.0);
        wobbles.bento = 0.65;

        // Move hitbox along with packed item so child can still tap it for a cute jiggle!
        const hb = kind === 'tamago' ? hitTamagos[idx] : hitTomatoes[idx];
        hb.position.copy(worldDest);

        setHandTarget('R', HAND_REST_R);
        phase = 'TABLE';
        maybeNudgeLid();
      });
    });
  }

  // 6. Close the Cedar Magewappa Bento Lid!
  function actionCloseLid() {
    if (phase !== 'TABLE' || !isReadyToCloseLid()) {
      // Gentle physical wobble if tapped before bento is ready
      audio.playPropTap('wood');
      wobbles.lid = 1.0;
      return;
    }
    phase = 'BUSY';
    lidClosed = true;

    const startPos = props.bentoLid.position.clone();
    const startRotY = props.bentoLid.rotation.y;
    const endWorldPos = new THREE.Vector3(props.bentoPos.x, 0.0445, props.bentoPos.z);
    const endRotY = props.bentoBox.rotation.y;

    // Both hands reach up to lift the oval cedar lid
    setHandTarget('L', {
      pos: startPos.clone().add(new THREE.Vector3(-0.105, 0.065, 0.075)),
      rot: new THREE.Euler(-1.24, 0.25, -0.55),
      pose: { curl: 0.44, thumbCurl: 0.35, pinch: 0.55 },
    });
    setHandTarget('R', {
      pos: startPos.clone().add(new THREE.Vector3(0.105, 0.065, 0.075)),
      rot: new THREE.Euler(-1.24, -0.25, 0.55),
      pose: { curl: 0.44, thumbCurl: 0.35, pinch: 0.55 },
    });

    addTween(0.26, () => {}, () => {
      props.lidShadow.visible = false;
      setHandTarget('L', {
        pos: endWorldPos.clone().add(new THREE.Vector3(-0.11, 0.06, 0.075)),
        rot: new THREE.Euler(-1.24, 0.25, -0.52),
        pose: { curl: 0.36, thumbCurl: 0.28, pinch: 0.45 },
      });
      setHandTarget('R', {
        pos: endWorldPos.clone().add(new THREE.Vector3(0.11, 0.06, 0.075)),
        rot: new THREE.Euler(-1.24, -0.25, 0.52),
        pose: { curl: 0.36, thumbCurl: 0.28, pinch: 0.45 },
      });

      addTween(0.58, (u) => {
        const s = smoothstep(u);
        props.bentoLid.position.lerpVectors(startPos, endWorldPos, s);
        props.bentoLid.position.y += Math.sin(s * Math.PI) * 0.065;
        props.bentoLid.rotation.y = startRotY + (endRotY - startRotY) * s;
      }, () => {
        // Parent lid cleanly onto bentoBox inside bundleGroup so the closed bento moves as one!
        props.bundleGroup.add(props.bentoLid);
        props.bentoLid.position.set(0, 0.0445, 0);
        props.bentoLid.rotation.set(0, props.bentoBox.rotation.y, 0);
        // Hide interior food once lid snaps shut (zero pokethrough + big mobile draw-call savings!)
        props.onigiris.forEach((o) => (o.group.visible = false));
        props.tamagoyakis.forEach((t) => (t.mesh.visible = false));
        props.tomatoes.forEach((t) => (t.mesh.visible = false));
        props.lettuceLeaf.visible = false;
        audio.playLidClose();
        wobbles.bento = 1.0;

        setHandTarget('L', HAND_REST_L);
        setHandTarget('R', HAND_REST_R);
        phase = 'LID_CLOSED';
      });
    });
  }

  // 7. Wrap the closed bento box in the Gingham Cotton Handkerchief (3 crisp cloth folds -> bunny-ear knot!)
  function actionFoldCloth() {
    if (phase !== 'LID_CLOSED') return;
    phase = 'BUSY';
    foldStage++;
    const isFinalKnot = foldStage >= 3;
    audio.playClothFold(isFinalKnot);

    props.furoshiki.clothMesh.castShadow = true;

    if (foldStage === 1) {
      // Back corner sweeps cleanly over the cedar lid
      foldTarget.back = 1.0;
      setHandTarget('R', {
        pos: new THREE.Vector3(0.025, 0.115, props.bentoPos.z - 0.02),
        rot: new THREE.Euler(-1.18, -0.15, 0.35),
        pose: { curl: 0.40, thumbCurl: 0.32, cup: 0.35 },
      });
    } else if (foldStage === 2) {
      // Front corner sweeps up and over the lid
      foldTarget.front = 1.0;
      setHandTarget('L', {
        pos: new THREE.Vector3(-0.025, 0.115, props.bentoPos.z + 0.06),
        rot: new THREE.Euler(-1.26, 0.22, -0.45),
        pose: { curl: 0.42, thumbCurl: 0.32, cup: 0.38 },
      });
    } else {
      // Left & Right corners sweep together and tie into a cute plump cotton bunny-ear knot!
      foldTarget.side = 1.0;
      foldTarget.knot = 1.0;
      setHandTarget('L', {
        pos: new THREE.Vector3(-0.068, 0.125, props.bentoPos.z + 0.065),
        rot: new THREE.Euler(-1.32, 0.45, -0.95),
        pose: { curl: 0.56, thumbCurl: 0.45, pinch: 0.72 },
      });
      setHandTarget('R', {
        pos: new THREE.Vector3(0.068, 0.125, props.bentoPos.z + 0.065),
        rot: new THREE.Euler(-1.32, -0.45, 0.95),
        pose: { curl: 0.56, thumbCurl: 0.45, pinch: 0.72 },
      });
    }

    const startFold = { ...foldAnim };
    addTween(isFinalKnot ? 0.65 : 0.48, (u) => {
      const s = smoothstep(u);
      foldAnim.back = startFold.back + (foldTarget.back - startFold.back) * s;
      foldAnim.front = startFold.front + (foldTarget.front - startFold.front) * s;
      foldAnim.side = startFold.side + (foldTarget.side - startFold.side) * s;
      const kt = THREE.MathUtils.clamp((u - 0.35) / 0.65, 0, 1);
      foldAnim.knot = startFold.knot + (foldTarget.knot - startFold.knot) * easeOutBack(kt);
      props.furoshiki.setFoldState(foldAnim.back, foldAnim.front, foldAnim.side, foldAnim.knot);
      if (foldAnim.side > 0.72 && foldAnim.knot > 0.35) {
        props.bentoBox.visible = false;
        props.bentoLid.visible = false;
      }
    }, () => {
      setHandTarget('L', HAND_REST_L);
      setHandTarget('R', HAND_REST_R);
      if (isFinalKnot) {
        bringInPapaHands();
      } else {
        phase = 'LID_CLOSED';
      }
    });
  }

  // 8. Papa's warm adult hands reach naturally forward FROM the top edge (-Z -> +Z), palms warmly open upward!
  // Note: Facing the child across the table, Papa's RIGHT hand is on viewer's LEFT (x < 0), Papa's LEFT hand is on viewer's RIGHT (x > 0)!
  function setPapaHandPose(pRightPos, pLeftPos, curl = 0.28, cup = 0.42) {
    props.papaRight.root.position.copy(pRightPos);
    props.papaLeft.root.position.copy(pLeftPos);
    // Exact anatomical orientation: forearm (-Y) extends back off top edge (-Z), fingers (+Y) point forward (+Z), palms (+Z) face UP (+Y)!
    props.papaRight.root.rotation.set(-1.38, -0.22, Math.PI - 0.16);
    props.papaLeft.root.rotation.set(-1.38,  0.22, Math.PI + 0.16);
    props.papaRight.setPose({ curl, thumbCurl: 0.22, cup });
    props.papaLeft.setPose({ curl, thumbCurl: 0.22, cup });
  }

  function bringInPapaHands() {
    props.papaLeft.root.visible = true;
    props.papaRight.root.visible = true;

    const pRStart = new THREE.Vector3(-0.12, 0.19, -0.52);
    const pLStart = new THREE.Vector3( 0.12, 0.19, -0.52);
    const pRWait  = new THREE.Vector3(-0.10, 0.145, -0.235);
    const pLWait  = new THREE.Vector3( 0.10, 0.145, -0.235);

    const tmpR = new THREE.Vector3();
    const tmpL = new THREE.Vector3();
    addTween(0.75, (u) => {
      const s = smoothstep(u);
      tmpR.lerpVectors(pRStart, pRWait, s);
      tmpL.lerpVectors(pLStart, pLWait, s);
      setPapaHandPose(tmpR, tmpL, 0.28, 0.42);
    }, () => {
      phase = 'PAPA_WAIT';
    });
  }

  // 9. Hand the wrapped gingham bento lovingly to Papa!
  function actionHandToPapa() {
    if (phase !== 'PAPA_WAIT') return;
    phase = 'PAPA_DONE';
    audio.playClothFold(false);

    const startBundle = props.bundleGroup.position.clone();
    const handoffPos = new THREE.Vector3(0.0, 0.135, -0.115);

    // Child's hands lift the wrapped bento off the table toward Papa's waiting palms
    setHandTarget('L', {
      pos: new THREE.Vector3(-0.105, 0.145, 0.015),
      rot: new THREE.Euler(-1.26, 0.35, -0.68),
      pose: { curl: 0.48, thumbCurl: 0.35, cup: 0.55 },
    });
    setHandTarget('R', {
      pos: new THREE.Vector3( 0.105, 0.145, 0.015),
      rot: new THREE.Euler(-1.26, -0.35, 0.68),
      pose: { curl: 0.48, thumbCurl: 0.35, cup: 0.55 },
    });

    addTween(0.72, (u) => {
      const s = smoothstep(u);
      props.bundleGroup.position.lerpVectors(startBundle, handoffPos, s);
      props.bundleGroup.position.y += Math.sin(s * Math.PI) * 0.04;
      props.bentoShadow.material.opacity = 0.86 * (1 - s);
    }, () => {
      // Papa's hands gently cup & receive the wrapped bento with joyful warm acoustic chord!
      audio.playPapaThanks();
      props.papaRight.setPose({ curl: 0.52, thumbCurl: 0.38, cup: 0.72 });
      props.papaLeft.setPose({ curl: 0.52, thumbCurl: 0.38, cup: 0.72 });

      // Child's hands relax warmly back
      setHandTarget('L', HAND_REST_L);
      setHandTarget('R', HAND_REST_R);

      // Papa lifts the beloved bento happily away
      const liftEnd = new THREE.Vector3(0.0, 0.24, -0.38);
      const pRBase = props.papaRight.root.position.clone();
      const pLBase = props.papaLeft.root.position.clone();

      addTween(1.35, (u) => {
        const s = smoothstep(u);
        props.bundleGroup.position.lerpVectors(handoffPos, liftEnd, s);
        props.papaRight.root.position.set(pRBase.x + 0.01 * s, pRBase.y + 0.10 * s, pRBase.z - 0.18 * s);
        props.papaLeft.root.position.set(pLBase.x - 0.01 * s, pLBase.y + 0.10 * s, pLBase.z - 0.18 * s);
      }, () => {
        addTween(1.4, () => {}, () => {
          resetGame();
        });
      });
    });
  }

  // Smooth reset for endless joyful bento making!
  function resetGame() {
    onigiriPackedCount = 0;
    activeOnigiriIdx = -1;
    shapeStep = 0;
    currentShapeT = 0;
    targetShapeT = 0;
    foldStage = 0;
    foldAnim = { back: 0, front: 0, side: 0, knot: 0 };
    foldTarget = { back: 0, front: 0, side: 0, knot: 0 };
    lidClosed = false;
    lidNudged = false;
    idleTime = 0;

    props.papaLeft.root.visible = false;
    props.papaRight.root.visible = false;

    props.furoshiki.setFoldState(0, 0, 0, 0);
    props.furoshiki.clothMesh.castShadow = false;
    props.bentoBox.visible = true;
    props.bentoLid.visible = true;

    // Reset lid to back-center resting spot
    scene.add(props.bentoLid);
    props.bentoLid.position.copy(props.lidRestPos);
    props.bentoLid.rotation.set(0, props.lidRestRotY, 0);
    props.lidShadow.position.set(props.lidRestPos.x, 0.0005, props.lidRestPos.z);
    props.lidShadow.visible = true;
    hitLid.position.set(props.lidRestPos.x, 0.025, props.lidRestPos.z);

    // Reset onigiris & nori strips
    props.onigiris.forEach((o) => {
      scene.add(o.group);
      o.group.visible = false;
      o.setShape(0);
      o.setNoriWrap(0);
    });
    props.noriStrips.forEach((m, i) => {
      m.visible = true;
      m.position.copy(props.noriRest[i].pos);
      m.rotation.set(0, props.noriRest[i].rotY, 0);
    });
    props.bowlRice.position.y = 0.020;

    // Reset tamagoyakis, tomatoes & lettuce leaf back visible
    props.lettuceLeaf.visible = true;
    props.tamagoyakis.forEach((t, idx) => {
      t.packed = false;
      t.mesh.visible = true;
      scene.add(t.mesh);
      t.mesh.position.copy(t.platePos);
      t.mesh.rotation.copy(t.plateRot);
      hitTamagos[idx].position.copy(t.platePos);
    });
    props.tomatoes.forEach((t, idx) => {
      t.packed = false;
      t.mesh.visible = true;
      scene.add(t.mesh);
      t.mesh.position.copy(t.platePos);
      t.mesh.rotation.copy(t.plateRot);
      hitTomatoes[idx].position.copy(t.platePos);
    });

    // Slide fresh empty cedar bento box & gingham cloth gently onto the sunlit table
    const slideFrom = props.bentoPos.clone().add(new THREE.Vector3(0, 0.04, 0.24));
    props.bundleGroup.position.copy(slideFrom);
    props.bentoShadow.material.opacity = 0;

    addTween(0.65, (u) => {
      const s = smoothstep(u);
      props.bundleGroup.position.lerpVectors(slideFrom, props.bentoPos, s);
      props.bentoShadow.material.opacity = 0.86 * s;
    }, () => {
      phase = 'TABLE';
    });
  }

  // --- Showcase / Stage Jump Helper (for verification & thumbnail capture!) ---
  function applyPresetStage(stage) {
    if (stage === 'showcase') {
      // Phase 1-style hero frame: 1 onigiri + 2 tamagoyaki + 2 tomatoes in bento, 2nd onigiri cradled in warm hands!
      const o0 = props.onigiris[0];
      o0.setShape(1);
      o0.setNoriWrap(1);
      props.bentoBox.add(o0.group);
      o0.group.position.copy(ONIGIRI_BENTO_SLOTS[0].pos);
      o0.group.rotation.copy(ONIGIRI_BENTO_SLOTS[0].rot);
      o0.group.visible = true;

      const o1 = props.onigiris[1];
      o1.setShape(1);
      o1.setNoriWrap(1);
      o1.group.position.set(-0.015, 0.114, 0.145);
      o1.group.rotation.set(-0.34, 0.08, -0.04);
      o1.group.visible = true;
      props.handSteam.group.position.set(-0.015, 0.138, 0.145);
      props.handSteam.group.visible = true;

      props.tamagoyakis.forEach((t) => {
        t.packed = true;
        props.bentoBox.add(t.mesh);
        t.mesh.position.copy(t.bentoPos);
        t.mesh.rotation.copy(t.bentoRot);
      });
      // Put 2 tomatoes in bento, keep 1 on carved plate for colorful balance
      for (let i = 0; i < 2; i++) {
        const t = props.tomatoes[i];
        t.packed = true;
        props.bentoBox.add(t.mesh);
        t.mesh.position.copy(t.bentoPos);
        t.mesh.rotation.copy(t.bentoRot);
      }

      handState.L.pos.copy(HAND_CUP_L.pos);
      handState.L.tPos.copy(HAND_CUP_L.pos);
      handState.L.rot.copy(HAND_CUP_L.rot);
      handState.L.tRot.copy(HAND_CUP_L.rot);
      Object.assign(handState.L.pose, HAND_CUP_L.pose);
      Object.assign(handState.L.tPose, HAND_CUP_L.pose);

      handState.R.pos.copy(HAND_CUP_R.pos);
      handState.R.tPos.copy(HAND_CUP_R.pos);
      handState.R.rot.copy(HAND_CUP_R.rot);
      handState.R.tRot.copy(HAND_CUP_R.rot);
      Object.assign(handState.R.pose, HAND_CUP_R.pose);
      Object.assign(handState.R.tPose, HAND_CUP_R.pose);

      onigiriPackedCount = 1;
      activeOnigiriIdx = 1;
      phase = 'HOLDING_ONIGIRI';
    } else if (stage === 'packed') {
      // Completely packed bento ready to close lid!
      props.onigiris.forEach((o, i) => {
        o.setShape(1);
        o.setNoriWrap(1);
        props.bentoBox.add(o.group);
        o.group.position.copy(ONIGIRI_BENTO_SLOTS[i].pos);
        o.group.rotation.copy(ONIGIRI_BENTO_SLOTS[i].rot);
        o.group.visible = true;
      });
      props.noriStrips.forEach((m) => (m.visible = false));
      props.tamagoyakis.forEach((t) => {
        t.packed = true;
        props.bentoBox.add(t.mesh);
        t.mesh.position.copy(t.bentoPos);
        t.mesh.rotation.copy(t.bentoRot);
      });
      props.tomatoes.forEach((t) => {
        t.packed = true;
        props.bentoBox.add(t.mesh);
        t.mesh.position.copy(t.bentoPos);
        t.mesh.rotation.copy(t.bentoRot);
      });
      onigiriPackedCount = 2;
      phase = 'TABLE';
    } else if (stage === 'papa') {
      // Wrapped gingham bento with smooth pillowed parcel & bunny-ear knot + Papa's welcoming hands!
      applyPresetStage('packed');
      lidClosed = true;
      props.bundleGroup.add(props.bentoLid);
      props.bentoLid.position.set(0, 0.0445, 0);
      props.bentoLid.rotation.set(0, props.bentoBox.rotation.y, 0);
      props.lidShadow.visible = false;
      // Hide interior food cleanly inside closed wrapped bento!
      props.onigiris.forEach((o) => (o.group.visible = false));
      props.tamagoyakis.forEach((t) => (t.mesh.visible = false));
      props.tomatoes.forEach((t) => (t.mesh.visible = false));
      props.lettuceLeaf.visible = false;

      foldStage = 3;
      foldAnim = { back: 1, front: 1, side: 1, knot: 1 };
      foldTarget = { back: 1, front: 1, side: 1, knot: 1 };
      props.furoshiki.clothMesh.castShadow = true;
      props.furoshiki.setFoldState(1, 1, 1, 1);
      props.bentoBox.visible = false;
      props.bentoLid.visible = false;

      props.papaLeft.root.visible = true;
      props.papaRight.root.visible = true;
      setPapaHandPose(
        new THREE.Vector3(-0.10, 0.145, -0.235),
        new THREE.Vector3( 0.10, 0.145, -0.235),
        0.28,
        0.42
      );
      phase = 'PAPA_WAIT';
    }
  }

  // --- One-Finger Pointer Handling (Tap + Drag/Swipe + Multi-Touch Safe!) ---
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let activePointerId = null;
  let downPos = { x: 0, y: 0 };
  let downHit = null;
  let dragTriggered = false;

  function pickHit(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);

    // Filter hit targets dynamically by priority
    const hits = raycaster.intersectObjects(hitGroup.children, false);
    if (!hits.length) return null;

    // Prioritize current phase's direct interactive target when hitboxes overlap!
    const ids = hits.map((h) => h.object.userData.hitId);
    if (phase === 'SHAPING' && ids.includes('held_onigiri')) return 'held_onigiri';
    if (phase === 'NEED_NORI' && ids.includes('nori')) return 'nori';
    if (phase === 'HOLDING_ONIGIRI' && (ids.includes('bento') || ids.includes('held_onigiri'))) return 'bento';
    if (phase === 'LID_CLOSED' && (ids.includes('cloth') || ids.includes('bento'))) return 'cloth';
    if (phase === 'PAPA_WAIT' && (ids.includes('cloth') || ids.includes('bento'))) return 'cloth';

    if (phase === 'TABLE') {
      // Specific side items before general plate/cloth
      const sideHit = ids.find((id) => id.startsWith('tamago_') || id.startsWith('tomato_'));
      if (sideHit) return sideHit;
      if (ids.includes('bowl')) return 'bowl';
      if (ids.includes('lid')) return 'lid';
      if (ids.includes('nori')) return 'nori';
      if (ids.includes('bento')) return 'bento';
    }
    return ids[0];
  }

  function handleInteraction(hitId) {
    if (!hitId) return;
    idleTime = 0;
    idleHintTimer = 0;

    // Micro-reactions for ambient living props anytime
    if (hitId === 'spoon') {
      audio.playPropTap('wood');
      wobbles.spoon = 1.0;
      return;
    }
    if (hitId === 'jug') {
      audio.playPropTap('ceramic');
      wobbles.jug = 1.0;
      return;
    }

    if (phase === 'SHAPING') {
      if (hitId === 'held_onigiri' || hitId === 'bento') {
        actionSqueezeRice();
      } else {
        audio.playPropTap('wood');
      }
      return;
    }

    if (phase === 'NEED_NORI') {
      if (hitId === 'nori') {
        actionWrapNori();
      } else if (hitId === 'held_onigiri') {
        // Soft bouncy rice squish feedback (doesn't auto-skip nori!)
        audio.playRicePat(2);
        squeezePulse = 0.65;
      } else {
        audio.playPropTap('wood');
      }
      return;
    }

    if (phase === 'HOLDING_ONIGIRI') {
      if (hitId === 'bento' || hitId === 'held_onigiri') {
        actionPackOnigiri();
      } else {
        audio.playPropTap('wood');
      }
      return;
    }

    if (phase === 'LID_CLOSED') {
      if (hitId === 'cloth' || hitId === 'bento') {
        actionFoldCloth();
      } else {
        audio.playPropTap('wood');
      }
      return;
    }

    if (phase === 'PAPA_WAIT') {
      if (hitId === 'cloth' || hitId === 'bento') {
        actionHandToPapa();
      }
      return;
    }

    if (phase === 'TABLE') {
      if (hitId === 'bowl') {
        if (onigiriPackedCount < 2) actionScoopRice();
        else audio.playPropTap('wood');
        return;
      }
      if (hitId.startsWith('tamago_')) {
        actionPackSideItem('tamago', parseInt(hitId.split('_')[1], 10));
        return;
      }
      if (hitId.startsWith('tomato_')) {
        actionPackSideItem('tomato', parseInt(hitId.split('_')[1], 10));
        return;
      }
      if (hitId === 'lid') {
        actionCloseLid();
        return;
      }
      if (hitId === 'bento') {
        audio.playPropTap('wood');
        wobbles.bento = 0.8;
        return;
      }
      if (hitId === 'nori') {
        audio.playNoriCrinkle();
        return;
      }
    }
  }

  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', (e) => {
    if (activePointerId !== null) return; // Multi-touch safe!
    activePointerId = e.pointerId;
    audio.unlock();
    downPos = { x: e.clientX, y: e.clientY };
    downHit = pickHit(e.clientX, e.clientY);
    dragTriggered = false;
  });

  dom.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId || dragTriggered) return;
    const dx = e.clientX - downPos.x;
    const dy = e.clientY - downPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 28) return;

    // Intuitive drag/swipe support!
    if (phase === 'SHAPING' && downHit === 'held_onigiri') {
      dragTriggered = true;
      actionSqueezeRice();
    } else if (phase === 'NEED_NORI' && downHit === 'nori') {
      dragTriggered = true;
      actionWrapNori();
    } else if (phase === 'HOLDING_ONIGIRI' && (downHit === 'held_onigiri' || downHit === 'bento')) {
      dragTriggered = true;
      actionPackOnigiri();
    } else if (phase === 'LID_CLOSED' && (downHit === 'cloth' || downHit === 'bento')) {
      dragTriggered = true;
      actionFoldCloth();
    } else if (phase === 'PAPA_WAIT' && dy < -20) {
      dragTriggered = true;
      actionHandToPapa();
    } else if (phase === 'TABLE' && downHit) {
      if (downHit === 'bowl' || downHit.startsWith('tamago_') || downHit.startsWith('tomato_') || downHit === 'lid') {
        dragTriggered = true;
        handleInteraction(downHit);
      }
    }
  });

  const endPointer = (e) => {
    if (e.pointerId !== activePointerId) return;
    if (!dragTriggered) {
      const hitNow = pickHit(e.clientX, e.clientY) || downHit;
      handleInteraction(hitNow);
    }
    activePointerId = null;
    downHit = null;
  };
  dom.addEventListener('pointerup', endPointer);
  dom.addEventListener('pointercancel', endPointer);

  // Subtle 10s wordless physical cue (her right hand gently reaches partway toward the next object once, no arrows/text!)
  function triggerGentleHandCue() {
    let targetPos = null;
    if (phase === 'TABLE') {
      if (onigiriPackedCount === 0) targetPos = props.bowlPos.clone().add(new THREE.Vector3(0.05, 0.11, 0.08));
      else if (!allSidesPacked()) targetPos = props.sidePlatePos.clone().add(new THREE.Vector3(0.04, 0.10, 0.09));
      else if (onigiriPackedCount < 2) targetPos = props.bowlPos.clone().add(new THREE.Vector3(0.05, 0.11, 0.08));
      else targetPos = props.bentoLid.position.clone().add(new THREE.Vector3(0.08, 0.09, 0.09));
    } else if (phase === 'NEED_NORI') {
      targetPos = props.noriPlatePos.clone().add(new THREE.Vector3(0.06, 0.085, 0.08));
    } else if (phase === 'LID_CLOSED' || phase === 'PAPA_WAIT') {
      targetPos = props.bentoPos.clone().add(new THREE.Vector3(0.08, 0.11, 0.07));
    }
    if (!targetPos) return;

    const prevR = { pos: handState.R.tPos.clone(), rot: handState.R.tRot.clone(), pose: { ...handState.R.tPose } };
    setHandTarget('R', {
      pos: targetPos,
      rot: new THREE.Euler(-1.18, -0.22, 0.42),
      pose: { curl: 0.22, thumbCurl: 0.18, cup: 0.2 },
    });
    addTween(0.75, () => {}, () => {
      if (phase !== 'BUSY') setHandTarget('R', prevR);
    });
  }

  // Apply optional preset stage (default is fresh empty bento ready to make from scratch!)
  if (showcaseMode) {
    applyPresetStage('showcase');
  } else if (jumpStage) {
    applyPresetStage(jumpStage);
  }

  // --- Main Render & Physics Loop ---
  const clock = new THREE.Clock();
  let animId = null;

  function updateLoop() {
    animId = requestAnimationFrame(updateLoop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;

    adaptQuality(dt);

    // Update active tweens
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.duration);
      tw.onUpdate(u);
      if (u >= 1) {
        tweens.splice(i, 1);
        if (tw.onDone) tw.onDone();
      }
    }

    // Smooth rice morphing during shaping
    if (activeOnigiriIdx >= 0 && Math.abs(targetShapeT - currentShapeT) > 0.002) {
      currentShapeT += (targetShapeT - currentShapeT) * Math.min(1, dt * 11);
      props.onigiris[activeOnigiriIdx].setShape(currentShapeT);
    }

    // Smooth palm squeeze pulse animation
    if (squeezePulse > 0.001) {
      squeezePulse = Math.max(0, squeezePulse - dt * 3.8);
    }
    const sqAmt = Math.sin(squeezePulse * Math.PI);

    // Subtle organic breathing & smooth hand interpolation
    const breathe = Math.sin(elapsed * 1.85) * 0.0022;
    for (const side of ['L', 'R']) {
      const h = handState[side];
      const handObj = side === 'L' ? props.leftHand : props.rightHand;
      const lerpK = Math.min(1, dt * 8.5);
      h.pos.lerp(h.tPos, lerpK);
      h.rot.x += (h.tRot.x - h.rot.x) * lerpK;
      h.rot.y += (h.tRot.y - h.rot.y) * lerpK;
      h.rot.z += (h.tRot.z - h.rot.z) * lerpK;
      for (const k of ['curl', 'thumbCurl', 'cup', 'pinch']) {
        const tv = h.tPose[k] ?? 0;
        const cv = h.pose[k] ?? 0;
        h.pose[k] = cv + (tv - cv) * lerpK;
      }

      const sqShift = (phase === 'SHAPING' || phase === 'NEED_NORI') ? (side === 'L' ? 1 : -1) * sqAmt * 0.015 : 0;
      handObj.root.position.set(h.pos.x + sqShift, h.pos.y + breathe, h.pos.z);
      handObj.root.rotation.copy(h.rot);
      handObj.setPose({
        curl: h.pose.curl + sqAmt * 0.22,
        thumbCurl: h.pose.thumbCurl + sqAmt * 0.16,
        cup: h.pose.cup + sqAmt * 0.18,
        pinch: h.pose.pinch || 0,
      });
    }

    // Gentle breathing on Papa's welcoming hands when waiting
    if (phase === 'PAPA_WAIT') {
      const pWave = Math.sin(elapsed * 2.2) * 0.003;
      props.papaLeft.root.position.y = 0.145 + pWave;
      props.papaRight.root.position.y = 0.145 + pWave;
    }

    // Living prop micro-wobbles
    if (wobbles.spoon > 0) {
      wobbles.spoon = Math.max(0, wobbles.spoon - dt * 2.5);
      props.woodenSpoon.rotation.z = props.spoonRestRot.z + Math.sin(wobbles.spoon * Math.PI * 5) * 0.14 * wobbles.spoon;
    }
    if (wobbles.jug > 0) {
      wobbles.jug = Math.max(0, wobbles.jug - dt * 2.6);
      props.ceramicJug.rotation.z = Math.sin(wobbles.jug * Math.PI * 4) * 0.03 * wobbles.jug;
    }
    if (wobbles.bento > 0) {
      wobbles.bento = Math.max(0, wobbles.bento - dt * 4.0);
      const s = 1 + Math.sin(wobbles.bento * Math.PI * 3) * 0.014 * wobbles.bento;
      props.bentoBox.scale.set(s, 1 / s, s);
    }
    if (wobbles.lid > 0) {
      wobbles.lid = Math.max(0, wobbles.lid - dt * 3.5);
      props.bentoLid.rotation.z = Math.sin(wobbles.lid * Math.PI * 4) * 0.04 * wobbles.lid;
    }
    for (const [mesh, val] of wobbles.items.entries()) {
      const nv = Math.max(0, val - dt * 3.2);
      const s = 1 + Math.sin(nv * Math.PI * 4) * 0.08 * nv;
      mesh.scale.set(s, 1 / s, s);
      if (nv <= 0) {
        mesh.scale.setScalar(1);
        wobbles.items.delete(mesh);
      } else {
        wobbles.items.set(mesh, nv);
      }
    }

    // Steam updates
    props.bowlSteam.update(dt, elapsed);
    if (props.handSteam.group.visible) {
      props.handSteam.update(dt, elapsed);
    }

    // Gentle 10-second idle physical cue (zero arrows, zero text!)
    if (phase !== 'BUSY' && phase !== 'PAPA_DONE' && !showcaseMode) {
      idleTime += dt;
      if (idleTime > 10.0) {
        idleHintTimer += dt;
        if (idleHintTimer > 5.5) {
          idleHintTimer = 0;
          triggerGentleHandCue();
        }
      }
    }

    renderer.render(scene, camera);
  }

  // Expose debug API for verification
  window.__BENTO_DEBUG__ = {
    renderer,
    scene,
    camera,
    getState: () => ({ phase, onigiriPackedCount, shapeStep, foldStage, lidClosed }),
    getStats: () => ({
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      toneMapping: sceneCtx.toneMappingName,
      pixelRatio: renderer.getPixelRatio(),
    }),
    // Programmatic triggers for automated end-to-end verification
    step: (act) => handleInteraction(act),
    setStage: (st) => applyPresetStage(st),
  };

  renderer.render(scene, camera);
  updateLoop();

  if (params.get('debug') === '1') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const s = window.__BENTO_DEBUG__.getStats();
        document.title = `Ready|tris=${s.triangles}|calls=${s.calls}|tex=${s.textures}|dpr=${s.pixelRatio}|tm=${s.toneMapping}`;
      });
    });
  }

  return {
    stop: () => cancelAnimationFrame(animId),
  };
}
