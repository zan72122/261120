import * as THREE from 'three';

const PAGE_STYLES = [
  { name: 'white',    paperKey: 'paperWhite', tint: 0xfbf9f4, roughness: 0.90, normalScale: 0.78 },
  { name: 'cream',    paperKey: 'paperWhite', tint: 0xf4ebd8, roughness: 0.92, normalScale: 0.84 },
  { name: 'kraft',    paperKey: 'paperBeige', tint: 0xe6d6bc, roughness: 0.94, normalScale: 0.92 },
  { name: 'paleBlue', paperKey: 'paperWhite', tint: 0xe4edf1, roughness: 0.91, normalScale: 0.80 },
];

function createRoundedRectShape(w, h, r) {
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
  return s;
}

/**
 * Generates crisp layered paper-stack edge texture (horizontal micro-sheet lines)
 * for the visible side thickness of the sketchbook paper block.
 */
function createPaperStackEdgeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece6da';
  ctx.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 5) {
    const shade = 212 + ((y * 17) % 24);
    ctx.fillStyle = `rgb(${shade}, ${shade - 6}, ${shade - 15})`;
    ctx.fillRect(0, y, 256, 3);
    ctx.fillStyle = 'rgba(110, 96, 78, 0.28)';
    ctx.fillRect(0, y + 3, 256, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/**
 * Generates a subtle top-page punch-hole & micro-margin detail overlay texture
 * (we actually draw dark punched square holes along the top margin where the twin-wire spiral threads through).
 */
function createPunchHoleMap(width, height, holeCount) {
  const w = 1024, h = 768;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Faint realistic paper shadow under the spiral rings at top edge
  const topGrad = ctx.createLinearGradient(0, 0, 0, 72);
  topGrad.addColorStop(0, 'rgba(60, 50, 40, 0.14)');
  topGrad.addColorStop(0.45, 'rgba(60, 50, 40, 0.05)');
  topGrad.addColorStop(1, 'rgba(60, 50, 40, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, 72);

  // Subtle paper vignette / realistic edge softness
  const edgeGrad = ctx.createLinearGradient(0, h - 22, 0, h);
  edgeGrad.addColorStop(0, 'rgba(90, 78, 62, 0)');
  edgeGrad.addColorStop(1, 'rgba(90, 78, 62, 0.06)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, h - 22, w, 22);

  // Crisp dark punched rectangular holes along the top binding edge
  const marginX = 76;
  const spanX = w - marginX * 2;
  const holeY = 26;
  const holeW = 14;
  const holeH = 14;
  for (let i = 0; i < holeCount; i++) {
    const t = holeCount === 1 ? 0.5 : i / (holeCount - 1);
    const hx = marginX + t * spanX;
    // Slight paper punch rim bevel
    ctx.fillStyle = '#c9c2b6';
    ctx.beginPath();
    ctx.roundRect(hx - holeW / 2 - 1.5, holeY - holeH / 2 - 1.5, holeW + 3, holeH + 3, 3);
    ctx.fill();
    // Deep punch shadow cavity
    ctx.fillStyle = '#2d2620';
    ctx.beginPath();
    ctx.roundRect(hx - holeW / 2, holeY - holeH / 2, holeW, holeH, 2.5);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createNotebook(assets, { width = 0.232, height = 0.176 } = {}) {
  const root = new THREE.Group();
  root.name = 'sketchbook';

  const coverPad = 0.0045;
  const coverThick = 0.0024;
  const blockThick = 0.0068;
  const basePageY = coverThick + blockThick;
  const holeCount = 13;

  // 1. Contact shadow plane right on table (y = 0.00025)
  const contactShadowGeom = new THREE.PlaneGeometry(width + 0.036, height + 0.036);
  contactShadowGeom.rotateX(-Math.PI / 2);
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: assets.shadowRect,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(contactShadowGeom, contactShadowMat);
  contactShadow.position.set(0.0025, 0.00025, 0.0028);
  contactShadow.renderOrder = 1;
  root.add(contactShadow);

  // 2. Heavy Kraft Cardboard Back Cover (ambientCG Paper005)
  const coverShape = createRoundedRectShape(width + coverPad * 2, height + coverPad * 2, 0.004);
  const coverGeom = new THREE.ExtrudeGeometry(coverShape, {
    depth: coverThick,
    bevelEnabled: true,
    bevelThickness: 0.0005,
    bevelSize: 0.0005,
    bevelSegments: 2,
  });
  coverGeom.rotateX(-Math.PI / 2);
  // Normalize UVs on extruded cover for clean cardboard texture scale
  const uv = coverGeom.attributes.uv;
  const pos = coverGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + 0.15) * 3.0, (pos.getZ(i) + 0.15) * 3.0);
  }
  const coverMat = new THREE.MeshStandardMaterial({
    map: assets.paperKraftCover.map,
    normalMap: assets.paperKraftCover.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: assets.paperKraftCover.roughnessMap,
    roughness: 0.92,
    color: 0xb09373,
  });
  const coverMesh = new THREE.Mesh(coverGeom, coverMat);
  coverMesh.position.y = 0.0005;
  coverMesh.castShadow = true;
  coverMesh.receiveShadow = true;
  root.add(coverMesh);

  // 3. Layered Paper Block underneath active sheet
  const stackEdgeTex = createPaperStackEdgeTexture();
  const blockSideMat = new THREE.MeshStandardMaterial({
    map: stackEdgeTex,
    roughness: 0.92,
    color: 0xf4efe6,
  });
  // Create a subtle ambient shadow texture for the top of the underlying paper stack
  // so the curled bottom-right page corner casts an unmistakable crisp shadow crease underneath!
  const underCanvas = document.createElement('canvas');
  underCanvas.width = 512;
  underCanvas.height = 384;
  const uctx = underCanvas.getContext('2d');
  uctx.fillStyle = '#f2ede3';
  uctx.fillRect(0, 0, 512, 384);
  const cornerGrad = uctx.createRadialGradient(512, 384, 4, 512, 384, 145);
  cornerGrad.addColorStop(0.0, 'rgba(55, 42, 30, 0.34)');
  cornerGrad.addColorStop(0.45, 'rgba(55, 42, 30, 0.14)');
  cornerGrad.addColorStop(1.0, 'rgba(55, 42, 30, 0.0)');
  uctx.fillStyle = cornerGrad;
  uctx.fillRect(340, 220, 172, 164);
  const underTex = new THREE.CanvasTexture(underCanvas);
  underTex.colorSpace = THREE.SRGBColorSpace;

  const blockTopMat = new THREE.MeshStandardMaterial({
    map: underTex,
    normalMap: assets.paperWhite.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.92,
    color: 0xffffff,
  });
  const blockGeom = new THREE.BoxGeometry(width - 0.001, blockThick, height - 0.001);
  const blockMesh = new THREE.Mesh(blockGeom, [
    blockSideMat, blockSideMat,
    blockTopMat, blockTopMat,
    blockSideMat, blockSideMat,
  ]);
  blockMesh.position.y = coverThick + blockThick / 2;
  blockMesh.castShadow = true;
  blockMesh.receiveShadow = true;
  root.add(blockMesh);

  // Helper: subtle realistic 3D page contour (gentle organic rise + upturned bottom-right corner)
  function getPageHeight(localX, localZ, cornerLift = 1.0) {
    // Normalize x in [-1, 1], z in [-1, 1] (top spine = -1, bottom = +1)
    const nx = localX / (width / 2);
    const nz = localZ / (height / 2);

    // Subtle organic wave: held down at top spiral rings (nz = -1), gently arches ~1.5mm in middle
    const spineEase = Math.max(0, (nz + 1) * 0.5); // 0 at top, 1 at bottom
    let dy = Math.sin(spineEase * Math.PI) * 0.0014 * (1.0 - 0.25 * nx * nx);

    // Slight inviting upturned bottom-right page corner (for page-turning affordance)
    if (cornerLift > 0 && nx > 0.48 && nz > 0.42) {
      const tx = (nx - 0.48) / 0.52;
      const tz = (nz - 0.42) / 0.58;
      const c = Math.max(0, tx * tz);
      dy += cornerLift * 0.0058 * c * c;
    }
    return basePageY + 0.00045 + dy;
  }

  // 4. Active Top Drawing Page (subdivided mesh with real ambientCG Paper PBR + punched holes)
  const punchDetailTex = createPunchHoleMap(width, height, holeCount);
  const pageSegX = 24, pageSegZ = 18;
  const pageGeom = new THREE.PlaneGeometry(width, height, pageSegX, pageSegZ);
  pageGeom.rotateX(-Math.PI / 2);

  function buildPageSurface(geom, cornerLift = 1.0) {
    const p = geom.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i);
      const lz = p.getZ(i);
      p.setY(i, getPageHeight(lx, lz, cornerLift));
    }
    p.needsUpdate = true;
    geom.computeVertexNormals();
  }
  buildPageSurface(pageGeom, 1.0);

  // Build materials for each page paper stock
  function createPageMaterial(styleIdx) {
    const style = PAGE_STYLES[styleIdx % PAGE_STYLES.length];
    const pbr = assets[style.paperKey];
    // Combine ambientCG real paper texture + punch holes into a cached composite diffuse canvas
    const comp = document.createElement('canvas');
    comp.width = 1024;
    comp.height = 768;
    const ctx = comp.getContext('2d');
    ctx.fillStyle = '#' + style.tint.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 1024, 768);
    if (pbr.map && pbr.map.image) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(pbr.map.image, 0, 0, 1024, 768);
      ctx.globalAlpha = 1.0;
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(punchDetailTex.image, 0, 0, 1024, 768);
    ctx.globalCompositeOperation = 'source-over';

    const compTex = new THREE.CanvasTexture(comp);
    compTex.colorSpace = THREE.SRGBColorSpace;
    compTex.anisotropy = 8;

    return new THREE.MeshStandardMaterial({
      map: compTex,
      normalMap: pbr.normalMap,
      normalScale: new THREE.Vector2(style.normalScale, style.normalScale),
      roughnessMap: pbr.roughnessMap,
      roughness: style.roughness,
      metalness: 0.0,
      envMapIntensity: 0.65,
      side: THREE.DoubleSide,
    });
  }

  const pageMaterials = PAGE_STYLES.map((_, i) => createPageMaterial(i));
  const activePageMesh = new THREE.Mesh(pageGeom, pageMaterials[0]);
  activePageMesh.receiveShadow = true;
  activePageMesh.castShadow = true;
  activePageMesh.name = 'notebook_active_page';
  root.add(activePageMesh);

  // 5. Realistic Metallic Twin-Wire Spiral Rings along the top edge (-height/2)
  const spiralGroup = new THREE.Group();
  const wireMat = new THREE.MeshStandardMaterial({
    color: 0x3b3d42,
    metalness: 0.86,
    roughness: 0.26,
    envMapIntensity: 1.2,
  });
  const marginX = width * (76 / 1024);
  const spanX = width - marginX * 2;
  const ringRadius = 0.0068;
  const wireTube = 0.00085;
  const ringGeom = new THREE.TorusGeometry(ringRadius, wireTube, 10, 22, Math.PI * 1.56);
  // Orient ring upright in YZ plane looping cleanly from top punch hole around back edge
  ringGeom.rotateY(Math.PI / 2);
  ringGeom.rotateX(-0.22);

  // Align ring front entry directly into the dark punched square holes (y=26/768)
  const holeZ = -height / 2 + height * (26 / 768);
  const wireZ = holeZ - ringRadius * 0.84;
  const wireY = basePageY - 0.0014;

  for (let i = 0; i < holeCount; i++) {
    const t = i / (holeCount - 1);
    const x = -width / 2 + marginX + t * spanX;
    // Twin wire (double loop per hole, just like real Maruman/Japanese spiral sketchbooks!)
    for (const dx of [-0.0012, 0.0012]) {
      const ring = new THREE.Mesh(ringGeom, wireMat);
      ring.position.set(x + dx, wireY, wireZ);
      ring.castShadow = true;
      ring.receiveShadow = true;
      spiralGroup.add(ring);
    }
  }
  root.add(spiralGroup);

  // 6. Turning Page Mesh (used during realistic 3D page-turn curl animation)
  const flipGeom = new THREE.PlaneGeometry(width, height, 20, 20);
  flipGeom.rotateX(-Math.PI / 2);
  const flipRestPos = new Float32Array(flipGeom.attributes.position.array);
  const flipMesh = new THREE.Mesh(flipGeom, pageMaterials[0]);
  flipMesh.visible = false;
  flipMesh.castShadow = true;
  flipMesh.receiveShadow = true;
  root.add(flipMesh);

  // 7. Per-page Sticker Containers (multi-page memory!)
  const pages = [];
  let currentPageIndex = 0;

  function ensurePage(idx) {
    while (pages.length <= idx) {
      const pIdx = pages.length;
      const g = new THREE.Group();
      g.name = `notebook_page_stickers_${pIdx}`;
      g.visible = pIdx === currentPageIndex;
      root.add(g);
      pages.push({
        index: pIdx,
        styleIndex: pIdx % PAGE_STYLES.length,
        stickerGroup: g,
        stickers: [],
        hasGoldSeal: false,
      });
    }
    return pages[idx];
  }
  ensurePage(0);

  let flipAnim = null;

  function updateFlipMesh(progress) {
    // Flip from bottom edge (+height/2) upward around top spiral spine (-height/2)
    const p = flipGeom.attributes.position;
    const spineZ = -height / 2 + 0.005;
    const angle = progress * Math.PI * 0.96;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const curlWave = Math.sin(progress * Math.PI);

    for (let i = 0; i < p.count; i++) {
      const rx = flipRestPos[i * 3];
      const rz = flipRestPos[i * 3 + 2];
      const distFromSpine = Math.max(0, rz - spineZ);
      const frac = distFromSpine / height;

      // Page lags gracefully at outer edge for crisp physical paper flex
      const lagAngle = Math.max(0, angle - curlWave * 0.42 * frac * frac);
      const c = Math.cos(lagAngle);
      const s = Math.sin(lagAngle);

      const newZ = spineZ + distFromSpine * c;
      const newY = basePageY + 0.001 + distFromSpine * s + curlWave * 0.004 * Math.sin(frac * Math.PI);
      p.setXYZ(i, rx, newY, newZ);
    }
    p.needsUpdate = true;
    flipGeom.computeVertexNormals();
  }

  return {
    root,
    width,
    height,
    basePageY,
    activePageMesh,
    getPageHeight,
    setContactShadowOpacity(factor) {
      contactShadowMat.opacity = 0.72 * Math.max(0, Math.min(1, factor));
    },
    getCurrentPage() {
      return ensurePage(currentPageIndex);
    },
    getCurrentPageIndex() {
      return currentPageIndex;
    },
    getPageCount() {
      return pages.length;
    },
    isInPageBounds(localX, localZ, pad = 0.006) {
      return (
        Math.abs(localX) <= width / 2 - pad &&
        localZ >= -height / 2 + 0.016 &&
        localZ <= height / 2 - pad
      );
    },
    isNearFlipCorner(localX, localZ) {
      return localX > width * 0.24 && localZ > height * 0.22;
    },
    /**
     * Place a sticker object cleanly onto the current notebook page at local (lx, lz)
     */
    attachSticker(stickerObj, localX, localZ, rotY = 0) {
      const page = ensurePage(currentPageIndex);
      const stackIdx = page.stickers.length;
      const stackOffsetY = 0.00032 * stackIdx;

      stickerObj.group.position.set(localX, getPageHeight(localX, localZ, 0.2) + 0.00035 + stackOffsetY, localZ);
      stickerObj.group.rotation.set(0, rotY, 0);

      // Conform sticker vertices smoothly to the exact underlying page curve
      const baseH = getPageHeight(localX, localZ, 0.2);
      const cosR = Math.cos(rotY);
      const sinR = Math.sin(rotY);
      stickerObj.setDeform({
        cornerCurl: 0,
        peelAmount: 0,
        hoverBow: 0,
        surfaceHeightFn: (rx, rz) => {
          const wx = localX + rx * cosR + rz * sinR;
          const wz = localZ - rx * sinR + rz * cosR;
          return getPageHeight(wx, wz, 0.2) - baseH;
        },
      });
      stickerObj.setRenderLayer(stackIdx + 1);
      stickerObj.setContactShadow(0.24, 0.00055, 0.00052, 1.03);

      page.stickerGroup.add(stickerObj.group);
      page.stickers.push({
        sticker: stickerObj,
        localX,
        localZ,
        rotY,
        layer: stackIdx,
      });
      return page.stickers[page.stickers.length - 1];
    },
    detachSticker(stickerObj) {
      const page = ensurePage(currentPageIndex);
      const idx = page.stickers.findIndex((s) => s.sticker === stickerObj);
      if (idx >= 0) {
        page.stickers.splice(idx, 1);
        page.stickerGroup.remove(stickerObj.group);
        return true;
      }
      return false;
    },
    flipToPage(targetIdx, onDone) {
      if (flipAnim) return false;
      const oldPage = ensurePage(currentPageIndex);
      const nextIdx = Math.max(0, targetIdx);
      const nextPage = ensurePage(nextIdx);
      if (nextIdx === currentPageIndex) return false;

      const forward = nextIdx > currentPageIndex;
      flipMesh.material = pageMaterials[forward ? oldPage.styleIndex : nextPage.styleIndex];
      flipMesh.visible = true;

      if (forward) {
        // Immediately show next page underneath as old page flips away
        activePageMesh.material = pageMaterials[nextPage.styleIndex];
        oldPage.stickerGroup.visible = false;
        nextPage.stickerGroup.visible = true;
      }

      currentPageIndex = nextIdx;
      flipAnim = {
        forward,
        t: 0,
        duration: 0.52,
        oldPage,
        nextPage,
        onDone,
      };
      return true;
    },
    update(dt) {
      if (!flipAnim) return;
      flipAnim.t += dt / flipAnim.duration;
      const raw = Math.min(1, flipAnim.t);
      // Smooth cubic ease-in-out
      const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      const progress = flipAnim.forward ? eased : 1 - eased;
      updateFlipMesh(progress);

      if (raw >= 1) {
        flipMesh.visible = false;
        activePageMesh.material = pageMaterials[flipAnim.nextPage.styleIndex];
        for (const p of pages) {
          p.stickerGroup.visible = p.index === currentPageIndex;
        }
        const cb = flipAnim.onDone;
        flipAnim = null;
        if (cb) cb();
      }
    },
  };
}
