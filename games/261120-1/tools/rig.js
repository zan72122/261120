/* 開発用プレビュー台（本番には入らない）。
   build.mjs --mods common,<mod> --extra tools/rig.js --extra <自分のharness.js> で使う（papa を見る時は acorn も入れる: --mods common,acorn,papa）。
   harness 側は window.HARNESS = function(ctx){ ...; return { update(dt,t){} }; } を定義する。
   ctx = { THREE, renderer, scene, camera, lights, lowPower:false, aniso, envMap, floor }
   URL: ?cam=portrait|papa|close  （harness 内で camera を自由に動かしてもよい） */
window.addEventListener('DOMContentLoaded', function () {
  var canvas = document.getElementById('stage');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9c8ae);
  var envMap = G.makeEnvMap(renderer);
  scene.environment = envMap;
  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 30);
  var q = new URLSearchParams(location.search);
  var cam = q.get('cam') || 'portrait';
  if (cam === 'papa') { camera.position.set(0, 1.18, 0.45); camera.lookAt(0, 1.24, -0.7); }
  else if (cam === 'close') { camera.position.set(0, 0.55, 0.6); camera.lookAt(0, 0.03, 0); }
  else { camera.position.set(0, 2.0, 1.4); camera.lookAt(0, 0, -0.1); }
  var lights = G.makeDefaultLights(scene);
  var floor = null;
  if (!q.has('nofloor')) {
    floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0xc9a77c, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  }
  var ctx = { THREE: THREE, renderer: renderer, scene: scene, camera: camera, lights: lights, lowPower: false,
    aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()), envMap: envMap, floor: floor };
  G.app = G.app || { renderer: renderer, scene: scene, camera: camera, lowPower: false };
  var h = window.HARNESS ? window.HARNESS(ctx) : null;
  window.__h = h; window.__ctx = ctx;
  var last = performance.now(), t = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (h && h.update) h.update(dt, t);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  });
});
