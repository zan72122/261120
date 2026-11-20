import * as THREE from 'three';
import { createStickerObject } from './stickerMesh.js';

export function setupInteraction(renderer, world, assets, audio) {
  const dom = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.008);
  const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  let activePointerId = null;
  let dragState = null; // { mode: 'peeling' | 'carrying' | 're_peel_pending' | 'rubbing', ... }
  let deskStickers = [];
  let activePressAnims = [];
  let propAnims = [];
  let showMomAnim = null;
  let cupBeckonTimer = 0;
  let lastInteractionTime = performance.now() * 0.001;
  let hasInteractedOnce = false;
  let idleHintTriggered = false;

  // Tag pencils & eraser for tactile playfulness (zero fake affordances!)
  world.pencilA.traverse((c) => { if (c.isMesh) c.userData.kind = 'pencil_a'; });
  world.pencilUsed.traverse((c) => { if (c.isMesh) c.userData.kind = 'pencil_used'; });
  world.eraser.traverse((c) => { if (c.isMesh) c.userData.kind = 'eraser'; });

  const tmpVec = new THREE.Vector3();
  const tmpVec2 = new THREE.Vector3();

  function setRayFromEvent(ev) {
    const rect = dom.getBoundingClientRect();
    ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, world.camera);
  }

  function intersectPlane(plane, out) {
    return raycaster.ray.intersectPlane(plane, out);
  }

  /**
   * Collect all placed stickers on the current notebook page + wooden desk for hit testing.
   */
  function getPlacedStickerMeshes() {
    const meshes = [];
    const page = world.notebook.getCurrentPage();
    // Reverse order so top overlapped sticker is always picked first!
    for (let i = page.stickers.length - 1; i >= 0; i--) {
      const entry = page.stickers[i];
      if (!entry.sticker.isGoldSeal) {
        entry.sticker.frontMesh.userData = {
          kind: 'placed_notebook_sticker',
          stickerObj: entry.sticker,
          entry,
        };
        meshes.push(entry.sticker.frontMesh);
      }
    }
    for (let i = deskStickers.length - 1; i >= 0; i--) {
      const entry = deskStickers[i];
      entry.sticker.frontMesh.userData = {
        kind: 'placed_desk_sticker',
        stickerObj: entry.sticker,
        entry,
      };
      meshes.push(entry.sticker.frontMesh);
    }
    return meshes;
  }

  /**
   * Generous proximity pick on top sticker sheet for 5-year-old fingertips.
   */
  function findNearestTopSheetSticker(worldPt) {
    const top = world.stickerStack.getTopSheet();
    if (!top) return null;
    let best = null;
    let bestDist = 0.036; // generous 3.6cm radius
    const p = new THREE.Vector3();
    for (const slot of top.slots) {
      if (slot.peeled || !slot.stickerObj) continue;
      slot.stickerObj.group.getWorldPosition(p);
      const d = Math.hypot(worldPt.x - p.x, worldPt.z - p.z);
      if (d < bestDist) {
        bestDist = d;
        best = { sheetIdx: top.sheetIdx, slotIdx: slot.idx, stickerObj: slot.stickerObj, slot };
      }
    }
    return best;
  }

  function triggerPropReaction(kind) {
    if (kind === 'pencil_a' || kind === 'pencil_used') {
      audio.playPropTap('pencil');
      const obj = kind === 'pencil_a' ? world.pencilA : world.pencilUsed;
      propAnims.push({
        obj,
        t: 0,
        duration: 0.34,
        baseX: obj.position.x,
        baseZ: obj.position.z,
        baseRotY: obj.rotation.y,
        axis: kind === 'pencil_a' ? 'z' : 'x',
        amp: 0.009,
        kind: 'roll',
      });
    } else if (kind === 'eraser') {
      audio.playPropTap('eraser');
      const obj = world.eraser;
      propAnims.push({
        obj,
        t: 0,
        duration: 0.26,
        baseX: obj.position.x,
        baseZ: obj.position.z,
        baseRotY: obj.rotation.y,
        kind: 'hop',
      });
    }
  }

  function startShowToMom() {
    if (showMomAnim) return;
    const page = world.notebook.getCurrentPage();
    const regularCount = page.stickers.filter((s) => !s.sticker.isGoldSeal).length;

    if (regularCount === 0) {
      // Page is blank -> Mom's teacup simply gives a cute authentic porcelain clink!
      audio.playTeacupClink(false);
      propAnims.push({
        obj: world.momCupGroup,
        t: 0,
        duration: 0.30,
        baseX: world.momCupGroup.position.x,
        baseZ: world.momCupGroup.position.z,
        baseRotY: world.momCupGroup.rotation.y,
        kind: 'cup_clink',
      });
      return;
    }

    if (regularCount < 4) {
      // A few stickers -> encouraging warm double clink & friendly brief tilt!
      audio.playTeacupClink(true);
      showMomAnim = {
        full: false,
        t: 0,
        duration: 0.95,
        sealSpawned: true,
        sealObj: null,
      };
      return;
    }

    // 4+ stickers -> FULL joyful Show-to-Mom celebration + Mom's embossed gold-foil star seal!
    audio.playShowMomCelebration();
    cupBeckonTimer = 0;
    showMomAnim = {
      full: true,
      t: 0,
      duration: 2.85,
      sealSpawned: false,
      sealLanded: false,
      sealObj: null,
      sealTargetLocal: findCleanSealSpot(page),
    };
  }

  /**
   * Pick a tidy corner on the sketchbook page for Mom's embossed gold-foil star seal
   * (prefer upper-right corner, or avoid directly burying an existing sticker if possible).
   */
  function findCleanSealSpot(page) {
    const candidates = [
      { x:  0.076, z: -0.044 },
      { x: -0.076, z: -0.044 },
      { x:  0.076, z:  0.042 },
      { x: -0.076, z:  0.042 },
    ];
    let best = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
      let minD = 999;
      for (const s of page.stickers) {
        const d = Math.hypot(s.localX - c.x, s.localZ - c.z);
        if (d < minD) minD = d;
      }
      if (minD > bestScore) {
        bestScore = minD;
        best = c;
      }
    }
    return best;
  }

  function onPointerDown(ev) {
    if (activePointerId !== null) return; // Single-finger strict lock!
    if (showMomAnim) return;

    audio.unlock();
    activePointerId = ev.pointerId;
    lastInteractionTime = performance.now() * 0.001;
    hasInteractedOnce = true;

    try { dom.setPointerCapture(ev.pointerId); } catch {}
    setRayFromEvent(ev);

    const worldPt = new THREE.Vector3();
    intersectPlane(deskPlane, worldPt);

    // 1. Check Mom's teacup first!
    const cupHits = raycaster.intersectObject(world.momCupGroup, true);
    if (cupHits.length > 0) {
      startShowToMom();
      activePointerId = null;
      return;
    }

    // 2. Check stickers on the TOP sticker sheet (direct hit or generous proximity hit!)
    const topSheet = world.stickerStack.getTopSheet();
    let pickedSheetSticker = null;
    if (topSheet) {
      const topMeshes = topSheet.slots
        .filter((s) => !s.peeled && s.stickerObj)
        .map((s) => s.stickerObj.frontMesh);
      const hits = raycaster.intersectObjects(topMeshes, false);
      if (hits.length > 0) {
        pickedSheetSticker = hits[0].object.userData;
      } else {
        pickedSheetSticker = findNearestTopSheetSticker(worldPt);
      }
    }

    if (pickedSheetSticker) {
      const { sheetIdx, slotIdx, stickerObj } = pickedSheetSticker;
      stickerObj._suppressIdleCurl = true;
      audio.playPeelStart();

      const startWorld = new THREE.Vector3();
      stickerObj.group.getWorldPosition(startWorld);

      // Instant tactile corner lift (<16ms!)
      stickerObj.setDeform({ cornerCurl: 0.92 });
      stickerObj.setContactShadow(0.32, 0.0008, 0.0008, 1.04);

      dragState = {
        mode: 'peeling',
        source: 'sheet',
        sheetIdx,
        slotIdx,
        stickerObj,
        startPtrWorld: worldPt.clone(),
        lastPtrWorld: worldPt.clone(),
        stickerOriginWorld: startWorld,
        peelProgress: 0.12,
        peelAngle: Math.PI * 0.25,
        isTouch: ev.pointerType === 'touch',
        downTime: performance.now(),
      };
      return;
    }

    // 3. Check already-placed stickers (on notebook page or wooden desk) for re-peel / rub!
    const placedMeshes = getPlacedStickerMeshes();
    const placedHits = raycaster.intersectObjects(placedMeshes, false);
    if (placedHits.length > 0) {
      const ud = placedHits[0].object.userData;
      audio.playPeelStart();
      dragState = {
        mode: 're_peel_pending',
        source: ud.kind === 'placed_notebook_sticker' ? 'notebook' : 'desk',
        stickerObj: ud.stickerObj,
        entry: ud.entry,
        startPtrWorld: worldPt.clone(),
        lastPtrWorld: worldPt.clone(),
        isTouch: ev.pointerType === 'touch',
        downTime: performance.now(),
      };
      return;
    }

    // 4. Check peeking underlying sticker sheets (or empty top sheet refill!)
    const backingMeshes = world.stickerStack.getSheets().map((s) => s.backingMesh);
    const backingHits = raycaster.intersectObjects(backingMeshes, false);
    if (backingHits.length > 0) {
      const hitIdx = backingHits[0].object.userData.sheetIdx;
      const topIdx = world.stickerStack.getTopSheet().sheetIdx;
      if (hitIdx !== topIdx) {
        // Bring peeking sheet smoothly to top!
        world.stickerStack.bringSheetToTop(hitIdx);
        // Also replenish any completely empty sheet quietly when switched away
        world.stickerStack.refillSheetIfEmpty(topIdx);
        audio.playSheetSlide();
      } else {
        // Top sheet tapped on empty backing: if all 6 stickers peeled, slide in fresh sheet!
        if (world.stickerStack.refillSheetIfEmpty(topIdx)) {
          audio.playSheetSlide();
        }
      }
      activePointerId = null;
      return;
    }

    // 5. Check sketchbook page corners (flip next / flip back)
    const nbHits = raycaster.intersectObject(world.notebook.activePageMesh, false);
    if (nbHits.length > 0) {
      const localPt = world.notebook.root.worldToLocal(nbHits[0].point.clone());
      if (world.notebook.isNearFlipCorner(localPt.x, localPt.z)) {
        // Flip forward to fresh drawing paper!
        const nextIdx = world.notebook.getCurrentPageIndex() + 1;
        if (world.notebook.flipToPage(nextIdx)) {
          audio.playPageFlip();
        }
        activePointerId = null;
        return;
      }
      // Left-bottom corner flips back to previous decorated page (if on page 2+)
      if (localPt.x < -world.notebook.width * 0.25 && localPt.z > world.notebook.height * 0.18) {
        const prevIdx = world.notebook.getCurrentPageIndex() - 1;
        if (prevIdx >= 0 && world.notebook.flipToPage(prevIdx)) {
          audio.playPageFlip();
        }
        activePointerId = null;
        return;
      }
      // Soft paper tap when touching empty paper
      audio.playStickerRub();
      activePointerId = null;
      return;
    }

    // 6. Check real desk props (pencils & pink eraser)
    const propHits = raycaster.intersectObjects([world.pencilA, world.pencilUsed, world.eraser], true);
    if (propHits.length > 0) {
      triggerPropReaction(propHits[0].object.userData.kind);
      activePointerId = null;
      return;
    }

    activePointerId = null;
  }

  function promoteToCarrying(state, worldPt) {
    if (state.source === 'sheet') {
      const peeled = world.stickerStack.peelSlot(state.sheetIdx, state.slotIdx);
      if (!peeled) return false;
      const st = peeled.stickerObj;
      st.group.position.copy(peeled.worldPos);
      st.group.quaternion.copy(peeled.worldQuat);
      world.scene.add(st.group);
      state.stickerObj = st;
    } else if (state.source === 'notebook') {
      const st = state.stickerObj;
      const wp = new THREE.Vector3();
      st.group.getWorldPosition(wp);
      world.notebook.detachSticker(st);
      st.group.position.copy(wp);
      st.group.rotation.set(0, 0, 0);
      world.scene.add(st.group);
    } else if (state.source === 'desk') {
      const st = state.stickerObj;
      const idx = deskStickers.findIndex((d) => d.sticker === st);
      if (idx >= 0) deskStickers.splice(idx, 1);
      world.deskStickersGroup.remove(st.group);
      world.scene.add(st.group);
    }

    audio.playPeelPop();
    state.mode = 'carrying';
    state.stickerObj.setRenderLayer(180);
    state.stickerObj.setDeform({ hoverBow: 0.80 });
    state.stickerObj.setContactShadow(0.14, 0.007, 0.008, 1.08);
    state.targetCarryPos = new THREE.Vector3(worldPt.x, 0.030, worldPt.z - (state.isTouch ? 0.012 : 0));
    state.velX = 0;
    state.velZ = 0;
    return true;
  }

  function onPointerMove(ev) {
    if (ev.pointerId !== activePointerId || !dragState) return;
    lastInteractionTime = performance.now() * 0.001;
    setRayFromEvent(ev);

    const worldPt = new THREE.Vector3();
    if (!intersectPlane(deskPlane, worldPt)) return;

    const dx = worldPt.x - dragState.startPtrWorld.x;
    const dz = worldPt.z - dragState.startPtrWorld.z;
    const dist = Math.hypot(dx, dz);

    const stepDist = Math.hypot(worldPt.x - dragState.lastPtrWorld.x, worldPt.z - dragState.lastPtrWorld.z);
    dragState.lastPtrWorld.copy(worldPt);

    if (dragState.mode === 'peeling') {
      const peelThreshold = 0.019; // Responsive 1.9cm peel gesture!
      const prog = Math.min(1.0, 0.12 + (dist / peelThreshold) * 0.88);
      dragState.peelProgress = prog;
      if (dist > 0.002) {
        // Peel away from drag direction so the pulled edge curls smoothly toward the child's finger
        dragState.peelAngle = Math.atan2(-dz, -dx);
      }

      dragState.stickerObj.setDeform({
        peelAmount: prog * 0.82,
        peelAngle: dragState.peelAngle,
      });
      dragState.stickerObj.setContactShadow(0.28 * (1 - prog * 0.4), 0.001 + prog * 0.003, 0.001 + prog * 0.003, 1.04);

      if (stepDist > 0.0035) {
        audio.playPeelStretch(stepDist * 180);
      }

      if (dist >= peelThreshold) {
        promoteToCarrying(dragState, worldPt);
      }
      return;
    }

    if (dragState.mode === 're_peel_pending') {
      if (dist > 0.004) {
        const p = Math.min(1, dist / 0.014);
        dragState.stickerObj.setDeform({
          peelAmount: p * 0.65,
          peelAngle: Math.atan2(-dz, -dx),
        });
        if (stepDist > 0.003) audio.playPeelStretch(stepDist * 140);
      }
      if (dist >= 0.014) {
        promoteToCarrying(dragState, worldPt);
      }
      return;
    }

    if (dragState.mode === 'carrying') {
      const touchOffsetZ = dragState.isTouch ? -0.012 : 0;
      dragState.targetCarryPos.set(worldPt.x, 0.032, worldPt.z + touchOffsetZ);
    }
  }

  function finishStickerDrop(state) {
    const st = state.stickerObj;
    st._suppressIdleCurl = false;

    const dropWorld = new THREE.Vector3(st.group.position.x, 0, st.group.position.z);

    // 1. Check if dropped over (or very near) the sketchbook drawing page!
    const nbLocal = world.notebook.root.worldToLocal(dropWorld.clone());
    const padX = st.size * 0.36;
    const padZ = st.size * 0.36;
    const insideNotebook =
      Math.abs(nbLocal.x) <= world.notebook.width * 0.5 + 0.014 &&
      nbLocal.z >= -world.notebook.height * 0.5 + 0.004 &&
      nbLocal.z <= world.notebook.height * 0.5 + 0.014;

    if (insideNotebook) {
      // Gentle magnetic edge forgiveness so stickers near the page rim land neatly on the paper
      const clampedX = THREE.MathUtils.clamp(nbLocal.x, -world.notebook.width * 0.5 + padX, world.notebook.width * 0.5 - padX);
      const clampedZ = THREE.MathUtils.clamp(nbLocal.z, -world.notebook.height * 0.5 + 0.022 + padZ * 0.4, world.notebook.height * 0.5 - padZ);

      world.scene.remove(st.group);
      const subtleAngle = (Math.random() - 0.5) * 0.18;
      world.notebook.attachSticker(st, clampedX, clampedZ, subtleAngle);

      // Tactile press-down spring settle animation!
      const finalY = st.group.position.y;
      st.group.position.y = finalY + 0.010;
      activePressAnims.push({ stickerObj: st, startY: finalY + 0.010, endY: finalY, t: 0, duration: 0.14 });
      audio.playStickPress(false);

      // Check if page just hit 4+ stickers -> warm subtle beckon from Mom's teacup!
      const page = world.notebook.getCurrentPage();
      const count = page.stickers.filter((s) => !s.sticker.isGoldSeal).length;
      if (count === 4 && !page.hasGoldSeal) {
        cupBeckonTimer = 0.65;
      }
      return;
    }

    // 2. Check if dropped back over the sticker sheet stack (cancel peel neatly!)
    const sheetLocal = world.stickerStack.root.worldToLocal(dropWorld.clone());
    const isOverSheet = Math.abs(sheetLocal.x) < 0.125 && Math.abs(sheetLocal.z) < 0.115;
    if (isOverSheet && state.source === 'sheet') {
      world.scene.remove(st.group);
      world.stickerStack.returnStickerToSlot(state.sheetIdx, state.slotIdx, st);
      audio.playStickPress(false);
      return;
    }

    // 3. Otherwise (wooden table! 脱線遊び!), stick genuinely right onto the oak wooden desk!
    world.scene.remove(st.group);
    const deskIdx = deskStickers.length;
    const clampedDeskX = THREE.MathUtils.clamp(dropWorld.x, -0.34, 0.34);
    const clampedDeskZ = THREE.MathUtils.clamp(dropWorld.z, -0.25, 0.24);
    const deskY = 0.00065 + deskIdx * 0.00032;
    st.group.position.set(clampedDeskX, deskY + 0.009, clampedDeskZ);
    st.group.rotation.set(0, (Math.random() - 0.5) * 0.25, 0);
    st.setDeform({ cornerCurl: 0, peelAmount: 0, hoverBow: 0 });
    st.setRenderLayer(5 + deskIdx);
    st.setContactShadow(0.28, 0.00065, 0.00060, 1.03);
    world.deskStickersGroup.add(st.group);
    deskStickers.push({ sticker: st, x: clampedDeskX, z: clampedDeskZ });
    activePressAnims.push({ stickerObj: st, startY: deskY + 0.009, endY: deskY, t: 0, duration: 0.14 });
    audio.playStickPress(true);
  }

  function onPointerUp(ev) {
    if (ev.pointerId !== activePointerId) return;
    activePointerId = null;

    if (!dragState) return;
    const state = dragState;
    dragState = null;

    if (state.mode === 'carrying') {
      finishStickerDrop(state);
      return;
    }

    if (state.mode === 'peeling') {
      // Child tapped a sticker briefly without dragging far -> keep corner invitingly curled up!
      state.stickerObj._suppressIdleCurl = false;
      state.stickerObj.setDeform({ cornerCurl: 0.95 });
      state.stickerObj.setContactShadow(0.32, 0.0007, 0.0007, 1.03);
      return;
    }

    if (state.mode === 're_peel_pending') {
      // Child gently tapped/rubbed a stuck sticker -> smooth it snugly down!
      state.stickerObj.setDeform({ cornerCurl: 0, peelAmount: 0, hoverBow: 0 });
      audio.playStickerRub();
      return;
    }
  }

  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerUp);

  return {
    triggerShowToMom: startShowToMom,
    update(dt, elapsed) {
      // 1. Carrying physics (silky spring follow + gentle paper flutter tilt)
      if (dragState && dragState.mode === 'carrying') {
        const st = dragState.stickerObj;
        const pos = st.group.position;
        const target = dragState.targetCarryPos;
        const k = Math.min(1, dt * 22);
        const dx = (target.x - pos.x) * k;
        const dz = (target.z - pos.z) * k;
        pos.x += dx;
        pos.z += dz;
        pos.y = THREE.MathUtils.lerp(pos.y, target.y, Math.min(1, dt * 16));

        // Subtle physical air-drag flutter when moving sticker through the air
        const tiltZ = THREE.MathUtils.clamp(-dx * 16, -0.26, 0.26);
        const tiltX = THREE.MathUtils.clamp(dz * 16, -0.22, 0.22);
        st.group.rotation.z = THREE.MathUtils.lerp(st.group.rotation.z, tiltZ, Math.min(1, dt * 14));
        st.group.rotation.x = THREE.MathUtils.lerp(st.group.rotation.x, tiltX, Math.min(1, dt * 14));

        // Keep ground contact shadow softly floating underneath on desk/notebook
        st.setContactShadow(0.14, 0.008, 0.009, 1.12);
      }

      // 2. Tactile press-down settle springs
      for (let i = activePressAnims.length - 1; i >= 0; i--) {
        const a = activePressAnims[i];
        a.t += dt / a.duration;
        const p = Math.min(1, a.t);
        const eased = 1 - Math.pow(1 - p, 3);
        a.stickerObj.group.position.y = THREE.MathUtils.lerp(a.startY, a.endY, eased);
        a.stickerObj.setDeform({ hoverBow: (1 - eased) * 0.25 });
        if (p >= 1) {
          a.stickerObj.group.position.y = a.endY;
          activePressAnims.splice(i, 1);
        }
      }

      // 3. Desk prop playful reactions (pencils rolling, eraser hopping, teacup clink)
      for (let i = propAnims.length - 1; i >= 0; i--) {
        const p = propAnims[i];
        p.t += dt / p.duration;
        const u = Math.min(1, p.t);
        const damp = Math.sin(u * Math.PI * 2.5) * (1 - u);
        if (p.kind === 'roll') {
          if (p.axis === 'z') p.obj.position.z = p.baseZ + damp * p.amp;
          else p.obj.position.x = p.baseX + damp * p.amp;
          p.obj.rotation.y = p.baseRotY + damp * 0.04;
        } else if (p.kind === 'hop') {
          p.obj.position.y = Math.sin(u * Math.PI) * 0.007;
          p.obj.rotation.y = p.baseRotY + Math.sin(u * Math.PI * 2) * 0.08 * (1 - u);
        } else if (p.kind === 'cup_clink') {
          p.obj.rotation.z = Math.sin(u * Math.PI * 3) * 0.032 * (1 - u);
        }
        if (u >= 1) {
          p.obj.position.set(p.baseX, 0, p.baseZ);
          p.obj.rotation.set(0, p.baseRotY, 0);
          propAnims.splice(i, 1);
        }
      }

      // 4. Delayed warm teacup beckon right after placing 4th sticker on a page
      if (cupBeckonTimer > 0) {
        cupBeckonTimer -= dt;
        if (cupBeckonTimer <= 0) {
          audio.playTeacupClink(true);
          propAnims.push({
            obj: world.momCupGroup,
            t: 0,
            duration: 0.45,
            baseX: world.momCupGroup.position.x,
            baseZ: world.momCupGroup.position.z,
            baseRotY: world.momCupGroup.rotation.y,
            kind: 'cup_clink',
          });
        }
      }

      // 5. Show-to-Mom physical sketchbook lift + embossed gold-foil star seal landing!
      if (showMomAnim) {
        showMomAnim.t += dt / showMomAnim.duration;
        const p = Math.min(1, showMomAnim.t);
        const nb = world.notebook.root;
        const basePos = world.layoutState.notebookBasePos;
        const baseRotY = world.layoutState.notebookBaseRotY;

        if (!showMomAnim.full) {
          // Gentle friendly nod toward Mom for 1-3 stickers
          const wave = Math.sin(p * Math.PI);
          nb.position.set(basePos.x, wave * 0.022, basePos.z - wave * 0.018);
          nb.rotation.set(wave * 0.24, baseRotY, 0);
          world.notebook.setContactShadowOpacity(1 - wave * 0.9);
          if (p >= 1) {
            nb.position.copy(basePos);
            nb.rotation.set(0, baseRotY, 0);
            world.notebook.setContactShadowOpacity(1);
            showMomAnim = null;
          }
        } else {
          // Full celebration lift toward sunlit window / Mom across the table!
          let liftFactor = 0;
          if (p < 0.22) {
            const u = p / 0.22;
            liftFactor = 1 - Math.pow(1 - u, 3);
          } else if (p < 0.78) {
            liftFactor = 1.0 + 0.04 * Math.sin((p - 0.22) * 16);
          } else {
            const u = (p - 0.78) / 0.22;
            liftFactor = 1 - (u * u * (3 - 2 * u));
          }

          nb.position.set(
            THREE.MathUtils.lerp(basePos.x, 0.0, liftFactor * 0.65),
            liftFactor * 0.068,
            basePos.z - liftFactor * 0.036
          );
          nb.rotation.set(liftFactor * 0.44, THREE.MathUtils.lerp(baseRotY, 0, liftFactor), 0);
          world.notebook.setContactShadowOpacity(1 - Math.min(1, liftFactor * 2.2));

          // Spawn & glide Mom's real embossed metallic gold-foil star seal onto the page!
          if (!showMomAnim.sealSpawned && p >= 0.34) {
            showMomAnim.sealSpawned = true;
            const seal = createStickerObject(
              { id: 'gold_star_seal' },
              assets,
              { size: 0.044, isGoldSeal: true }
            );
            seal.setRenderLayer(190);
            seal.setDeform({ hoverBow: 0.55 });
            seal.setContactShadow(0.18, 0.004, 0.004, 1.08);
            world.notebook.root.add(seal.group);
            showMomAnim.sealObj = seal;
          }

          if (showMomAnim.sealObj && !showMomAnim.sealLanded) {
            const su = Math.min(1, (p - 0.34) / 0.26);
            const eased = 1 - Math.pow(1 - su, 3);
            const tgt = showMomAnim.sealTargetLocal;
            const tgtY = world.notebook.getPageHeight(tgt.x, tgt.z, 0.2) + 0.0008 + world.notebook.getCurrentPage().stickers.length * 0.00032;
            const startX = 0.04;
            const startZ = -0.18;
            const startY = 0.095;
            showMomAnim.sealObj.group.position.set(
              THREE.MathUtils.lerp(startX, tgt.x, eased),
              THREE.MathUtils.lerp(startY, tgtY, eased) + Math.sin(su * Math.PI) * 0.025,
              THREE.MathUtils.lerp(startZ, tgt.z, eased)
            );
            showMomAnim.sealObj.group.rotation.set(
              (1 - eased) * -0.4,
              (1 - eased) * 0.6 - 0.08,
              0
            );
            showMomAnim.sealObj.setDeform({ hoverBow: (1 - eased) * 0.55 });

            if (su >= 1) {
              showMomAnim.sealLanded = true;
              world.notebook.root.remove(showMomAnim.sealObj.group);
              world.notebook.attachSticker(showMomAnim.sealObj, tgt.x, tgt.z, -0.08);
              world.notebook.getCurrentPage().hasGoldSeal = true;
              audio.playGoldSealLand();
            }
          }

          if (p >= 1) {
            nb.position.copy(basePos);
            nb.rotation.set(0, baseRotY, 0);
            world.notebook.setContactShadowOpacity(1);
            showMomAnim = null;
          }
        }
      }

      // 6. Subtle idle guidance (wordless.short.md: 0-10s nothing intrusive; >10s gentle single curl beckon)
      const nowSec = performance.now() * 0.001;
      if (!hasInteractedOnce && !idleHintTriggered && nowSec - lastInteractionTime > 10.0) {
        idleHintTriggered = true;
        const top = world.stickerStack.getTopSheet();
        const first = top?.slots.find((s) => !s.peeled && s.stickerObj);
        if (first?.stickerObj) {
          first.stickerObj.setDeform({ cornerCurl: 0.92 });
        }
      }
    },
  };
}
