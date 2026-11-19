import * as THREE from 'three';

export function setupKitchenEnvironment(renderer, scene) {
  // Procedural high-contrast sunlit kitchen HDR environment for crisp chrome, steel, glass & water reflections!
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x7c7b78);

  // Balanced sunlit room shell so stainless steel reads bright metallic silver & chrome keeps crisp contrast
  const roomGeo = new THREE.BoxGeometry(16, 12, 16);
  const roomMat = new THREE.MeshBasicMaterial({
    color: 0x86817a,
    side: THREE.BackSide
  });
  envScene.add(new THREE.Mesh(roomGeo, roomMat));

  // Warm dark walnut floor bounce
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ color: 0x4b3828 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -5.9;
  envScene.add(floor);

  // Soft cream ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ color: 0x9b958d })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 5.9;
  envScene.add(ceiling);

  // Bright HDR sunlit kitchen window on upper-left wall (crisp reflections on chrome, water & bubbles!)
  const winMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(6.2, 5.6, 4.7)
  });
  const win1 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.6), winMat);
  win1.position.set(-6.5, 2.2, 2.0);
  win1.lookAt(0, 0, 0);
  envScene.add(win1);

  // Dark window muntin bars (gives realistic windowpane reflections on polished chrome & bubbles!)
  const barMat = new THREE.MeshBasicMaterial({ color: 0x2a2826 });
  const vBar = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 4.6), barMat);
  vBar.position.set(-6.42, 2.2, 2.0);
  vBar.lookAt(0, 0, 0);
  envScene.add(vBar);

  const hBar = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.32), barMat);
  hBar.position.set(-6.42, 2.2, 2.0);
  hBar.lookAt(0, 0, 0);
  envScene.add(hBar);

  // Cool sky fill pane on upper-right
  const skyFill = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 2.25, 2.95) })
  );
  skyFill.position.set(6.5, 2.8, 1.8);
  skyFill.lookAt(0, 0, 0);
  envScene.add(skyFill);

  // Warm overhead kitchen pendant specular highlight
  const pendant = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 16, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 3.8, 2.8) })
  );
  pendant.position.set(0.4, 5.2, 1.2);
  envScene.add(pendant);

  // Subtle dark vertical contrast strip behind camera so chrome faucet has rich metallic edge definition
  const darkStripe = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 7.0),
    new THREE.MeshBasicMaterial({ color: 0x262422 })
  );
  darkStripe.position.set(0.0, 1.0, 7.5);
  darkStripe.lookAt(0, 0, 0);
  envScene.add(darkStripe);

  const envRT = pmrem.fromScene(envScene, 0.025);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.05;
  scene.background = new THREE.Color(0xc8c2b8);

  pmrem.dispose();

  // --- Scene Lights ---
  // Warm directional morning sunlight streaming diagonally from upper-left kitchen window
  const sunLight = new THREE.DirectionalLight(0xfff0d4, 2.35);
  sunLight.position.set(-3.6, 5.6, 3.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1.0;
  sunLight.shadow.camera.far = 15.0;
  sunLight.shadow.camera.left = -3.8;
  sunLight.shadow.camera.right = 3.8;
  sunLight.shadow.camera.top = 3.8;
  sunLight.shadow.camera.bottom = -2.8;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.018;
  scene.add(sunLight);

  // Balanced sky/wood ambient fill (not washed out so shadows and 3D depth stay rich!)
  const hemi = new THREE.HemisphereLight(0xdcebff, 0x8f775c, 0.48);
  scene.add(hemi);

  // Soft warm bounce light from front-right to illuminate inside sink basin & wet dishes
  const fillLight = new THREE.DirectionalLight(0xffe9cc, 0.42);
  fillLight.position.set(3.2, 3.0, 2.8);
  scene.add(fillLight);

  // Celebratory warm golden sunbeam light (gently intensifies when all 5 dishes are shelved!)
  const celebrationLight = new THREE.PointLight(0xffd98e, 0.0, 7.5, 1.5);
  celebrationLight.position.set(0, 2.2, -0.4);
  scene.add(celebrationLight);

  // Soft feathered sunlit window glow patches cast across the glazed subway tile backsplash
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const gCtx = glowCanvas.getContext('2d');
  const rad = gCtx.createRadialGradient(128, 128, 18, 128, 128, 124);
  rad.addColorStop(0.0, 'rgba(255, 245, 214, 0.92)');
  rad.addColorStop(0.55, 'rgba(255, 243, 210, 0.45)');
  rad.addColorStop(1.0, 'rgba(255, 240, 200, 0.0)');
  gCtx.fillStyle = rad;
  gCtx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCanvas);

  const sunPatchGroup = new THREE.Group();
  const patchMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    color: 0xfff4d6,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.85), patchMat.clone());
    p.position.set(-0.92 + i * 1.65, 1.50 - i * 0.22, -1.46);
    p.rotation.z = -0.20;
    sunPatchGroup.add(p);
  }
  scene.add(sunPatchGroup);

  return { sunLight, celebrationLight, sunPatchGroup };
}
