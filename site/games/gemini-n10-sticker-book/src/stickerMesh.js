import * as THREE from 'three';

const alphaMaskCache = new Map();

/**
 * Build a grayscale alpha mask texture (white silhouette on black) from a sticker RGBA image
 * so the matte adhesive back face & contact shadow match the exact die-cut contour.
 */
export function getStickerAlphaTexture(id, img) {
  if (alphaMaskCache.has(id)) return alphaMaskCache.get(id);
  const w = img.width || 256;
  const h = img.height || 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    px[i] = a;
    px[i + 1] = a;
    px[i + 2] = a;
    px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  alphaMaskCache.set(id, tex);
  return tex;
}

/**
 * Create a soft blurred contact-shadow alpha texture from a sticker silhouette
 * so stuck stickers have a tight physical paper-thickness shadow underneath their cut rim.
 */
const shadowMaskCache = new Map();
export function getStickerShadowTexture(id, img) {
  if (shadowMaskCache.has(id)) return shadowMaskCache.get(id);
  const w = 128, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  // Draw black silhouette with subtle blur
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(img, 0, 0, w, h);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = '#1c120a';
  tctx.fillRect(0, 0, w, h);

  ctx.filter = 'blur(2.5px)';
  ctx.drawImage(tmp, 0, 0);
  ctx.filter = 'none';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  shadowMaskCache.set(id, tex);
  return tex;
}

const SEG = 14;

export function createStickerObject(stickerData, assets, { size = 0.044, isGoldSeal = false } = {}) {
  const group = new THREE.Group();
  group.name = `sticker_${stickerData.id}`;

  // Plane lying flat in XZ with +Y normal
  const geom = new THREE.PlaneGeometry(size, size, SEG, SEG);
  geom.rotateX(-Math.PI / 2);

  // Store rest coordinates for fast deformation
  const posAttr = geom.attributes.position;
  const restX = new Float32Array(posAttr.count);
  const restZ = new Float32Array(posAttr.count);
  for (let i = 0; i < posAttr.count; i++) {
    restX[i] = posAttr.getX(i);
    restZ[i] = posAttr.getZ(i);
  }

  const alphaTex = isGoldSeal
    ? getStickerAlphaTexture('gold_seal', assets.goldSeal.image)
    : getStickerAlphaTexture(stickerData.id, stickerData.image);

  const shadowTex = isGoldSeal
    ? getStickerShadowTexture('gold_seal', assets.goldSeal.image)
    : getStickerShadowTexture(stickerData.id, stickerData.image);

  let frontMat;
  if (isGoldSeal) {
    frontMat = new THREE.MeshPhysicalMaterial({
      map: assets.goldSeal.colorTex,
      bumpMap: assets.goldSeal.bumpTex,
      bumpScale: 0.0012,
      metalness: 0.88,
      roughness: 0.24,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  } else {
    frontMat = new THREE.MeshPhysicalMaterial({
      map: stickerData.texture,
      roughness: 0.22,
      roughnessMap: assets.stickerMicroRoughness,
      metalness: 0.0,
      clearcoat: 0.96,
      clearcoatRoughness: 0.11,
      envMapIntensity: 1.32,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  }

  // Real matte pale paper-adhesive backing on the underside when curled/peeled!
  const backMat = new THREE.MeshStandardMaterial({
    color: isGoldSeal ? 0xe5dec9 : 0xefece4,
    alphaMap: alphaTex,
    roughness: 0.88,
    metalness: 0.0,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    side: THREE.BackSide,
  });

  // Custom depth material so shadows follow exact alpha silhouette when lifted/curled
  const depthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    alphaMap: alphaTex,
    alphaTest: 0.45,
  });

  const frontMesh = new THREE.Mesh(geom, frontMat);
  frontMesh.castShadow = true;
  frontMesh.receiveShadow = true;
  frontMesh.customDepthMaterial = depthMat;

  const backMesh = new THREE.Mesh(geom, backMat);
  backMesh.castShadow = false;
  backMesh.receiveShadow = true;

  // Tight micro contact-shadow right under the sticker silhouette for physical paper thickness
  const shadowGeom = new THREE.PlaneGeometry(size * 1.03, size * 1.03, 1, 1);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
  shadowMesh.position.set(0.00055, -0.00018, 0.00050);
  shadowMesh.renderOrder = 1;

  group.add(shadowMesh);
  group.add(frontMesh);
  group.add(backMesh);

  const state = {
    id: stickerData.id,
    data: stickerData,
    isGoldSeal,
    size,
    group,
    frontMesh,
    backMesh,
    shadowMesh,
    geom,
    restX,
    restZ,
    setRenderLayer(layerIndex) {
      shadowMesh.renderOrder = 10 + layerIndex * 3;
      backMesh.renderOrder = 10 + layerIndex * 3 + 1;
      frontMesh.renderOrder = 10 + layerIndex * 3 + 2;
    },
    setContactShadow(opacity, offsetX = 0.00055, offsetZ = 0.00050, scale = 1.03) {
      shadowMat.opacity = opacity;
      shadowMesh.position.set(offsetX, -0.00018, offsetZ);
      shadowMesh.scale.set(scale, 1, scale);
      shadowMesh.visible = opacity > 0.005;
    },
    /**
     * Deform sticker mesh vertices realistically:
     * - cornerCurl: 0..1 gentle inviting lift of bottom-right corner
     * - peelAmount: 0..1 active peeling curl along peelAngle
     * - hoverBow: 0..1 slight gentle concave bow when held in midair
     * - surfaceHeightFn: optional (rx, rz) => dy function to hug curved notebook pages
     */
    setDeform({
      cornerCurl = 0,
      peelAmount = 0,
      peelAngle = Math.PI * 0.25,
      hoverBow = 0,
      surfaceHeightFn = null,
    } = {}) {
      const half = size * 0.5;
      const cosA = Math.cos(peelAngle);
      const sinA = Math.sin(peelAngle);

      for (let i = 0; i < posAttr.count; i++) {
        const rx = restX[i];
        const rz = restZ[i];
        let x = rx;
        let y = 0;
        let z = rz;

        if (surfaceHeightFn) {
          y += surfaceHeightFn(rx, rz);
        }

        // Gentle inviting corner lift at bottom-right (+x, +z)
        if (cornerCurl > 0.0001) {
          // Projection toward bottom-right corner
          const u = (rx * 0.72 + rz * 0.69) / half; // -1..+1.4
          const start = 0.22;
          if (u > start) {
            const t = (u - start) / (1.05 - start);
            const curlH = cornerCurl * 0.0068 * t * t;
            const pullIn = cornerCurl * 0.0018 * t * t;
            y += curlH;
            x -= pullIn * 0.72;
            z -= pullIn * 0.69;
          }
        }

        // Realistic cylindrical peel curl (preserves paper length, curls back cleanly)
        if (peelAmount > 0.0001) {
          // Projection along peel axis (-half .. +half)
          const s = rx * cosA + rz * sinA;
          const p = -rx * sinA + rz * cosA;
          // Hinge line sweeps from +half to -half as peelAmount goes 0..1
          const hinge = half * (1.05 - peelAmount * 1.95);
          if (s > hinge) {
            const ds = s - hinge;
            // Tight realistic paper curl radius (~1.6cm)
            const radius = Math.max(0.009, 0.022 - peelAmount * 0.009);
            const theta = Math.min(Math.PI * 0.92, ds / radius);
            const newS = hinge + Math.sin(theta) * radius;
            const lift = (1.0 - Math.cos(theta)) * radius;
            // Remainder past max angle continues smoothly along tangent
            const extra = Math.max(0, ds - theta * radius);
            const finalS = newS + Math.cos(theta) * extra;
            const finalY = lift + Math.sin(theta) * extra;

            x = finalS * cosA - p * sinA;
            z = finalS * sinA + p * cosA;
            y += finalY;
          }
        }

        // Gentle finger-pinch paper bow when floating/carrying
        if (hoverBow > 0.0001) {
          const r2 = (rx * rx + rz * rz) / (half * half);
          y += hoverBow * (0.0028 * (1.0 - r2 * 0.85) + 0.0014 * (rz / half));
        }

        posAttr.setXYZ(i, x, y, z);
      }

      posAttr.needsUpdate = true;
      geom.computeVertexNormals();
    },
  };

  state.setRenderLayer(0);
  return state;
}
