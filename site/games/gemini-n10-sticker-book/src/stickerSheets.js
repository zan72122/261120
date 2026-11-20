import * as THREE from 'three';
import { STICKER_SHEETS_DEF } from './assets.js';
import { createStickerObject } from './stickerMesh.js';

function createRoundedSheetGeometry(w, h, r, thickness = 0.00045) {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geom.rotateX(-Math.PI / 2);

  // Normalize top-down planar UVs cleanly [0..1]
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, (x + hw) / w, 1.0 - (z + hh) / h);
  }
  uv.needsUpdate = true;
  return geom;
}

/**
 * Generates the realistic kiss-cut backing sheet diffuse + roughness textures
 * with exact silhouette recessed silicone release-liner cavities for all 6 slots!
 */
function buildBackingSheetTextures(sheetDef, slots, wMeters, hMeters, assets) {
  const texW = 768;
  const texH = Math.round(texW * (hMeters / wMeters));

  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = texW;
  diffCanvas.height = texH;
  const dctx = diffCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = texW;
  roughCanvas.height = texH;
  const rctx = roughCanvas.getContext('2d');

  // 1. Base matrix paper fill (semi-gloss coated sticker sheet background)
  dctx.fillStyle = sheetDef.frameColor;
  dctx.fillRect(0, 0, texW, texH);

  // Subtle paper fiber grain from ambientCG Paper001
  if (assets.paperWhite.map?.image) {
    dctx.save();
    dctx.globalAlpha = 0.22;
    dctx.globalCompositeOperation = 'multiply';
    dctx.drawImage(assets.paperWhite.map.image, 0, 0, texW, texH);
    dctx.restore();
  }

  // Subtle printed decorative fine border inset (like real Japanese stationery sheets, ZERO text)
  const inset = 12;
  dctx.strokeStyle = sheetDef.accentRim;
  dctx.lineWidth = 2.5;
  dctx.beginPath();
  dctx.roundRect(inset, inset, texW - inset * 2, texH - inset * 2, 16);
  dctx.stroke();

  // Roughness base: matrix frame is semi-matte coated paper (~0.45 -> 115/255)
  rctx.fillStyle = 'rgb(115, 115, 115)';
  rctx.fillRect(0, 0, texW, texH);

  // Helper offscreen canvas to render silhouette cutouts cleanly
  const sil = document.createElement('canvas');
  sil.width = 256;
  sil.height = 256;
  const sctx = sil.getContext('2d');

  for (const slot of slots) {
    const u = (slot.lx + wMeters / 2) / wMeters;
    const v = (slot.lz + hMeters / 2) / hMeters;
    const cx = u * texW;
    const cy = v * texH;
    const sw = (slot.size / wMeters) * texW;
    const sh = (slot.size / hMeters) * texH;

    const img = slot.stickerData.image;

    // A) Inner micro-shadow along upper-left edge of recessed cavity (recessed step depth!)
    sctx.clearRect(0, 0, 256, 256);
    sctx.drawImage(img, 0, 0, 256, 256);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = 'rgba(62, 50, 40, 0.44)';
    sctx.fillRect(0, 0, 256, 256);
    sctx.globalCompositeOperation = 'source-over';
    dctx.drawImage(sil, cx - sw / 2 - 2.0, cy - sh / 2 - 2.0, sw + 4.0, sh + 4.0);

    // B) Shiny pale silicone release liner inside the die-cut cavity
    sctx.clearRect(0, 0, 256, 256);
    sctx.drawImage(img, 0, 0, 256, 256);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = sheetDef.linerColor;
    sctx.fillRect(0, 0, 256, 256);
    sctx.globalCompositeOperation = 'source-over';
    dctx.drawImage(sil, cx - sw / 2 + 1.5, cy - sh / 2 + 1.5, sw - 2.0, sh - 2.0);

    // Subtle crisp kiss-cut groove outline around cavity
    dctx.save();
    dctx.globalAlpha = 0.22;
    dctx.drawImage(sil, cx - sw / 2 - 0.8, cy - sh / 2 - 0.8, sw + 1.6, sh + 1.6);
    dctx.restore();

    // Roughness inside cavity: glossy silicone release liner (~0.13 -> 34/255)!
    sctx.clearRect(0, 0, 256, 256);
    sctx.drawImage(img, 0, 0, 256, 256);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = 'rgb(34, 34, 34)';
    sctx.fillRect(0, 0, 256, 256);
    sctx.globalCompositeOperation = 'source-over';
    rctx.drawImage(sil, cx - sw / 2, cy - sh / 2, sw, sh);
  }

  const diffTex = new THREE.CanvasTexture(diffCanvas);
  diffTex.colorSpace = THREE.SRGBColorSpace;
  diffTex.anisotropy = 8;
  diffTex.needsUpdate = true;

  const roughTex = new THREE.CanvasTexture(roughCanvas);
  roughTex.colorSpace = THREE.NoColorSpace;
  roughTex.anisotropy = 4;
  roughTex.needsUpdate = true;

  return { diffTex, roughTex };
}

export function createStickerSheetStack(assets) {
  const root = new THREE.Group();
  root.name = 'sticker_sheet_stack';

  let currentOrientation = 'landscape'; // 'landscape' (2x3 tall) or 'portrait' (3x2 wide)
  let order = [0, 1, 2]; // index 0 = top sheet
  const sheetObjs = [];
  let slideAnim = null;

  function computeLayout(orientation) {
    if (orientation === 'portrait') {
      return {
        w: 0.210,
        h: 0.124,
        cols: 3,
        rows: 2,
        stickerSize: 0.055,
        fanOffsets: [
          { dx: 0.0,    dz: 0.0,    rot: -0.010 },
          { dx: 0.010,  dz: 0.011,  rot:  0.020 },
          { dx: -0.012, dz: 0.019,  rot: -0.028 },
        ],
      };
    }
    return {
      w: 0.132,
      h: 0.192,
      cols: 2,
      rows: 3,
      stickerSize: 0.054,
      fanOffsets: [
        { dx: 0.0,    dz: 0.0,    rot:  0.016 },
        { dx: 0.011,  dz: -0.008, rot: -0.026 },
        { dx: 0.020,  dz:  0.008, rot:  0.042 },
      ],
    };
  }

  function buildAllSheets(orientation) {
    // Clear previous sheet meshes cleanly
    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }
    sheetObjs.length = 0;
    currentOrientation = orientation;
    const layout = computeLayout(orientation);

    STICKER_SHEETS_DEF.forEach((def, sheetIdx) => {
      const sheetGroup = new THREE.Group();
      sheetGroup.name = `sticker_sheet_${def.id}`;

      const slots = [];
      const padX = layout.w * 0.255;
      const padZ = layout.h * 0.245;
      const stepX = layout.cols > 1 ? (layout.w - padX * 2) / (layout.cols - 1) : 0;
      const stepZ = layout.rows > 1 ? (layout.h - padZ * 2) / (layout.rows - 1) : 0;

      def.items.forEach((item, idx) => {
        const col = idx % layout.cols;
        const row = Math.floor(idx / layout.cols);
        const lx = -layout.w / 2 + padX + col * stepX;
        const lz = -layout.h / 2 + padZ + row * stepZ;
        const stickerData = assets.stickers[item.id];
        slots.push({
          idx,
          lx,
          lz,
          size: layout.stickerSize * (item.scale || 1.0),
          stickerData,
          stickerObj: null,
          peeled: false,
        });
      });

      const { diffTex, roughTex } = buildBackingSheetTextures(def, slots, layout.w, layout.h, assets);

      // Soft contact shadow directly beneath each backing sheet
      const shGeom = new THREE.PlaneGeometry(layout.w + 0.022, layout.h + 0.022);
      shGeom.rotateX(-Math.PI / 2);
      const shMat = new THREE.MeshBasicMaterial({
        map: assets.shadowRect,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      });
      const shMesh = new THREE.Mesh(shGeom, shMat);
      shMesh.position.set(0.0018, -0.00015, 0.0020);
      shMesh.renderOrder = 2;
      sheetGroup.add(shMesh);

      // Backing sheet solid paper slab with rounded corners
      const sheetGeom = createRoundedSheetGeometry(layout.w, layout.h, 0.005, 0.00055);
      const sheetMat = new THREE.MeshPhysicalMaterial({
        map: diffTex,
        roughnessMap: roughTex,
        roughness: 0.95, // modulated by roughTex (0.45 frame, 0.16 glossy silicone cavity!)
        metalness: 0.0,
        clearcoat: 0.42,
        clearcoatRoughness: 0.24,
        normalMap: assets.paperWhite.normalMap,
        normalScale: new THREE.Vector2(0.14, 0.14),
        envMapIntensity: 0.85,
      });
      const backingMesh = new THREE.Mesh(sheetGeom, sheetMat);
      backingMesh.castShadow = true;
      backingMesh.receiveShadow = true;
      backingMesh.userData = { kind: 'sheet_backing', sheetIdx };
      sheetGroup.add(backingMesh);

      // Populate all 6 peelable 3D stickers onto their die-cut slots (flat initially; top sheet curls in applyStackTransforms)
      slots.forEach((slot, sIdx) => {
        const st = createStickerObject(slot.stickerData, assets, { size: slot.size });
        st.group.position.set(slot.lx, 0.00085, slot.lz);
        st.setDeform({ cornerCurl: 0.0 });
        st.setContactShadow(0.14, 0.00045, 0.00045, 1.02);
        st.frontMesh.userData = { kind: 'sheet_sticker', sheetIdx, slotIdx: sIdx, stickerObj: st, slot };
        sheetGroup.add(st.group);
        slot.stickerObj = st;
      });

      root.add(sheetGroup);
      sheetObjs.push({
        sheetIdx,
        def,
        group: sheetGroup,
        backingMesh,
        shadowMesh: shMesh,
        slots,
      });
    });

    applyStackTransforms(true);
  }

  function applyStackTransforms(immediate = false) {
    const layout = computeLayout(currentOrientation);
    order.forEach((sheetIdx, stackRank) => {
      const sh = sheetObjs[sheetIdx];
      if (!sh) return;
      const fan = layout.fanOffsets[stackRank] || layout.fanOffsets[2];
      // Top sheet (stackRank 0) sits highest; underlying sheets sit neatly beneath it
      const targetY = 0.00045 + (2 - stackRank) * 0.0011;
      sh.targetPos = new THREE.Vector3(fan.dx, targetY, fan.dz);
      sh.targetRotY = fan.rot;

      // Render layers cleanly so top sheet's stickers always draw cleanly over lower sheets
      // AND strictly flatten underlying sheets' stickers so nothing ever pokes through the top sheet!
      const baseLayer = (2 - stackRank) * 20;
      sh.shadowMesh.renderOrder = 2 + (2 - stackRank);
      let invitedSet = false;
      sh.slots.forEach((slot, i) => {
        if (slot.stickerObj && !slot.peeled) {
          slot.stickerObj.setRenderLayer(baseLayer + i);
          if (stackRank === 0 && !invitedSet) {
            slot.stickerObj.setDeform({ cornerCurl: 0.62 });
            slot.stickerObj.setContactShadow(0.30, 0.00055, 0.00055, 1.03);
            invitedSet = true;
          } else {
            slot.stickerObj.setDeform({ cornerCurl: 0.0 });
            slot.stickerObj.setContactShadow(0.14, 0.00042, 0.00042, 1.02);
          }
        }
      });

      if (immediate) {
        sh.group.position.copy(sh.targetPos);
        sh.group.rotation.y = sh.targetRotY;
      }
    });
  }

  buildAllSheets('landscape');

  return {
    root,
    getOrientation: () => currentOrientation,
    setOrientation(orientation) {
      if (orientation === currentOrientation) return;
      // Remember which stickers were peeled so orientation switch preserves state
      const peeledMap = sheetObjs.map((sh) => sh.slots.map((s) => s.peeled));
      buildAllSheets(orientation);
      peeledMap.forEach((arr, si) => {
        arr.forEach((isPeeled, slotIdx) => {
          if (isPeeled && sheetObjs[si]?.slots[slotIdx]) {
            const slot = sheetObjs[si].slots[slotIdx];
            slot.peeled = true;
            if (slot.stickerObj) {
              sheetObjs[si].group.remove(slot.stickerObj.group);
              slot.stickerObj = null;
            }
          }
        });
      });
    },
    getTopSheet() {
      return sheetObjs[order[0]];
    },
    getSheets() {
      return sheetObjs;
    },
    bringSheetToTop(sheetIdx) {
      const pos = order.indexOf(sheetIdx);
      if (pos <= 0) return false;
      order.splice(pos, 1);
      order.unshift(sheetIdx);
      applyStackTransforms(false);
      // Give the newly promoted sheet a physical slide-out-and-over arc
      slideAnim = {
        sheetIdx,
        t: 0,
        duration: 0.36,
        startPos: sheetObjs[sheetIdx].group.position.clone(),
        startRot: sheetObjs[sheetIdx].group.rotation.y,
      };
      return true;
    },
    /**
     * Detach a sticker from its sheet slot (revealing the shiny recessed silicone cutout underneath!)
     * and return the live sticker object for dragging/peeling.
     */
    peelSlot(sheetIdx, slotIdx) {
      const sh = sheetObjs[sheetIdx];
      if (!sh) return null;
      const slot = sh.slots[slotIdx];
      if (!slot || slot.peeled || !slot.stickerObj) return null;
      const st = slot.stickerObj;
      // Convert to world transform before detaching
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      st.group.getWorldPosition(worldPos);
      st.group.getWorldQuaternion(worldQuat);

      sh.group.remove(st.group);
      slot.peeled = true;
      slot.stickerObj = null;

      // Gently curl the next remaining sticker on this sheet to keep inviting!
      const nextSlot = sh.slots.find((s) => !s.peeled && s.stickerObj);
      if (nextSlot) {
        nextSlot.stickerObj.setDeform({ cornerCurl: 0.55 });
        nextSlot.stickerObj.setContactShadow(0.26, 0.00045, 0.00045, 1.02);
      }

      return { stickerObj: st, worldPos, worldQuat, slot };
    },
    /**
     * Replenish an empty sheet (when all 6 stickers are peeled and user taps it, or automatically on return)
     */
    refillSheetIfEmpty(sheetIdx) {
      const sh = sheetObjs[sheetIdx];
      if (!sh) return false;
      if (sh.slots.some((s) => !s.peeled)) return false;
      sh.slots.forEach((slot, sIdx) => {
        const st = createStickerObject(slot.stickerData, assets, { size: slot.size });
        st.group.position.set(slot.lx, 0.00085, slot.lz);
        st.setDeform({ cornerCurl: sIdx === 0 ? 0.58 : 0.0 });
        st.setContactShadow(sIdx === 0 ? 0.28 : 0.14, 0.00045, 0.00045, 1.02);
        st.frontMesh.userData = { kind: 'sheet_sticker', sheetIdx, slotIdx: sIdx, stickerObj: st, slot };
        sh.group.add(st.group);
        slot.stickerObj = st;
        slot.peeled = false;
      });
      applyStackTransforms(false);
      return true;
    },
    /**
     * Return a sticker back onto its slot if the user cancelled peeling mid-way
     */
    returnStickerToSlot(sheetIdx, slotIdx, stickerObj) {
      const sh = sheetObjs[sheetIdx];
      if (!sh) return;
      const slot = sh.slots[slotIdx];
      if (!slot) return;
      stickerObj.group.position.set(slot.lx, 0.00085, slot.lz);
      stickerObj.group.rotation.set(0, 0, 0);
      stickerObj.setDeform({ cornerCurl: 0.52 });
      stickerObj.setContactShadow(0.26, 0.00045, 0.00045, 1.02);
      stickerObj.frontMesh.userData = { kind: 'sheet_sticker', sheetIdx, slotIdx, stickerObj, slot };
      sh.group.add(stickerObj.group);
      slot.stickerObj = stickerObj;
      slot.peeled = false;
      applyStackTransforms(false);
    },
    update(dt, elapsed) {
      // Smoothly animate sheet stack slide transitions
      if (slideAnim) {
        slideAnim.t += dt / slideAnim.duration;
        const p = Math.min(1, slideAnim.t);
        const eased = 1 - Math.pow(1 - p, 3);
        const sh = sheetObjs[slideAnim.sheetIdx];
        const lift = Math.sin(p * Math.PI) * 0.016;
        const swingX = Math.sin(p * Math.PI) * (currentOrientation === 'portrait' ? 0.035 : 0.045);
        sh.group.position.lerpVectors(slideAnim.startPos, sh.targetPos, eased);
        sh.group.position.y += lift;
        sh.group.position.x += swingX;
        sh.group.rotation.y = THREE.MathUtils.lerp(slideAnim.startRot, sh.targetRotY, eased);
        if (p >= 1) {
          sh.group.position.copy(sh.targetPos);
          sh.group.rotation.y = sh.targetRotY;
          slideAnim = null;
        }
      }

      // Gently settle non-sliding sheets
      for (const sh of sheetObjs) {
        if (slideAnim && slideAnim.sheetIdx === sh.sheetIdx) continue;
        if (sh.targetPos) {
          sh.group.position.lerp(sh.targetPos, Math.min(1, dt * 10));
          sh.group.rotation.y = THREE.MathUtils.lerp(sh.group.rotation.y, sh.targetRotY, Math.min(1, dt * 10));
        }
      }

      // Very subtle organic breathing on the single inviting lifted corner of the top sheet
      const top = sheetObjs[order[0]];
      if (top) {
        const invite = top.slots.find((s) => !s.peeled && s.stickerObj);
        if (invite && invite.stickerObj && !invite.stickerObj._suppressIdleCurl) {
          const gentle = 0.52 + 0.10 * Math.sin(elapsed * 2.1);
          invite.stickerObj.setDeform({ cornerCurl: gentle });
        }
      }
    },
  };
}
