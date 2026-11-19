// WORLD: table, room, hot plate, lights, environment and props.
import * as THREE from 'three';
import { buildTable, buildRoom, buildPlaceSettings, bakeEnvironment } from './room.js';
import { buildHotplate } from './hotplate.js';
import { buildProps } from './props.js';

export function buildWorld(G) {
  const { renderer, scene, cfg } = G;
  const low = !!(G.quality && G.quality.low);
  const ctx = { cfg, low, bg: G.bg || null, aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4), tex: {} };

  if (!renderer.shadowMap.enabled) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // ---------- environment ----------
  scene.environment = bakeEnvironment(renderer);
  scene.environmentIntensity = 0.75;
  scene.background = new THREE.Color(0x0d0907);

  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);

  group.add(buildTable(ctx));
  group.add(buildRoom(ctx));
  group.add(buildPlaceSettings(ctx));
  const hp = buildHotplate(ctx);
  group.add(hp.group);

  // ---------- lights ----------
  // key: warm pendant lamp (~3000 K) above the table, the only shadow caster
  const key = new THREE.SpotLight(0xffd4a8, 4.8e4, 0, 0.7, 0.75, 2);
  key.position.set(6, 112, 8);
  key.target.position.set(10, 0, 12);
  key.castShadow = true;
  const sm = low ? 512 : 1024;
  key.shadow.mapSize.set(sm, sm);
  key.shadow.camera.near = 50;
  key.shadow.camera.far = 170;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.06;
  key.shadow.focus = 1;
  group.add(key, key.target);

  // fill: dim cool sky / warm table bounce
  const fill = new THREE.HemisphereLight(0x9fb3d0, 0x4a2c18, 0.35);
  group.add(fill);

  // focus: soft warm pool on the current protagonist (no shadow)
  const focus = new THREE.SpotLight(0xffd0a0, 0, 0, 0.2, 1, 2);
  const FH = 80; // height above target
  focus.position.set(0, FH, 0);
  focus.target.position.set(0, 0, 0);
  group.add(focus, focus.target);
  const fCur = { pos: new THREE.Vector3(0, 0, 0), radius: 14, strength: 0 };
  const fTgt = { pos: new THREE.Vector3(0, 0, 0), radius: 14, strength: 0.0 };
  const FOCUS_I = 1.25e4;

  // ---------- props ----------
  const props = buildProps(ctx);
  for (const k in props) scene.add(props[k]);

  // ---------- state ----------
  let power = true, lampGlow = 1;

  const world = {
    group,
    hotplate: hp.group,
    lights: { key, focus, fill },
    props,
    setPower(on) { power = !!on; },
    setFocus(pos, radius = 12, strength = 1) {
      if (pos) fTgt.pos.copy(pos);
      fTgt.radius = Math.max(3, radius);
      fTgt.strength = Math.max(0, strength);
    },
    update(dt) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      // indicator lamp
      const lt = power ? 1 : 0;
      lampGlow += (lt - lampGlow) * (1 - Math.exp(-dt / 0.12));
      hp.lampMat.emissiveIntensity = lampGlow * 1.8;
      // focus easing (~0.35 s)
      const k = 1 - Math.exp(-dt / 0.11);
      fCur.pos.lerp(fTgt.pos, k);
      fCur.radius += (fTgt.radius - fCur.radius) * k;
      fCur.strength += (fTgt.strength - fCur.strength) * k;
      focus.position.set(fCur.pos.x - 6, fCur.pos.y + FH, fCur.pos.z + 10);
      focus.target.position.copy(fCur.pos);
      focus.target.updateMatrixWorld();
      focus.angle = Math.atan((fCur.radius * 1.45) / FH);
      focus.intensity = FOCUS_I * fCur.strength;
    },
  };
  world.setFocus(new THREE.Vector3(0, cfg.RIM_Y, 0), 16, 1);
  world.update(1);
  return world;
}
