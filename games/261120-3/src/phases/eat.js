// Phase 'eat': tap a ball → the pick spears it and lifts it up to the camera ("the mouth") with steam;
// the first bite shows the filling the child put in (cheese stretches). Tap again → gone, munch.
import * as THREE from 'three';
import { canon, dressBalls, dressHit, ballTopY, syncPlatter, keepWarm } from './common.js';

const T_STAB = 0.16;
const T_LIFT = 0.45;
const T_HOT = 0.8;
const T_MIN_MOUTH = 0.45; // the cut face stays at least this long before a queued tap eats it
const T_DROP = 0.4;
const WIGGLE_EVERY = 2.4;

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const cTmp = new THREE.Vector3();
const mouth = new THREE.Vector3();
const from = new THREE.Vector3();
const ballPos = new THREE.Vector3();
const camR = new THREE.Vector3();
const camU = new THREE.Vector3();
const camF = new THREE.Vector3();
const dirPlat = new THREE.Vector3(0.42, 0.82, 0.4).normalize();
const dirMouth = new THREE.Vector3();
const dirCur = new THREE.Vector3();
const pickFrom = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const qTmp = new THREE.Quaternion();
const tgtPts = Array.from({ length: 3 }, () => new THREE.Vector3());
const demoPts = [new THREE.Vector3(), new THREE.Vector3()];
const scr = { x: 0, y: 0 };
const list = [];

const S = {
  mode: 'idle', // idle | stab | lift | hot | mouth | drop | done
  t: 0,
  ball: null,
  queue: null, // {x, y} css px of a tap that arrived while busy
  eaten: 0,
  firstDone: false,
  steamT: 0,
  wigT: 0,
  wigBall: null,
  pick: null,
  cheese: null,
  doneT: 0,
};

// ---------- pick (our own clone of the prop, so no tool logic ever moves it) ----------
function getPick(G) {
  if (!S.pick) {
    S.pick = G.world.props.pick.clone();
    S.pick.name = 'eatPick';
    S.pick.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    G.scene.add(S.pick);
  }
  return S.pick;
}
function placePick(tip, dir) {
  const p = S.pick;
  p.visible = true;
  p.quaternion.setFromUnitVectors(UP, dir);
  p.position.copy(tip);
}

// ---------- camera-relative "mouth" point ----------
function camBasis(G) {
  const c = G.camera;
  camR.set(1, 0, 0).applyQuaternion(c.quaternion);
  camU.set(0, 1, 0).applyQuaternion(c.quaternion);
  camF.set(0, 0, -1).applyQuaternion(c.quaternion);
}
function mouthPoint(G, out) {
  camBasis(G);
  const c = G.camera;
  const th = Math.tan((c.fov * Math.PI) / 360);
  const short = Math.min(th, th * c.aspect);
  const d = Math.max(15, Math.min(40, G.cfg.BALL_R / (0.54 * short)));
  out.copy(c.position).addScaledVector(camF, d).addScaledVector(camU, -th * d * 0.14);
  // pick handle toward the bottom-right of the screen (the hand), slightly toward the viewer
  dirMouth.set(0, 0, 0).addScaledVector(camR, 0.5).addScaledVector(camU, -0.8).addScaledVector(camF, 0.3).normalize();
  return out;
}

// ---------- cheese string ----------
const CR = 18;
const CS = 8;
function makeCheese(G) {
  const n = CR * (CS + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let r = 0; r < CR - 1; r++) {
    for (let s = 0; s < CS; s++) {
      const a = r * (CS + 1) + s;
      const b = a + CS + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(idx);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xf8de80, roughness: 0.3, clearcoat: 0.5, emissive: 0x6a4a12, sheen: 0.4, sheenColor: new THREE.Color(0xfff0b0) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 2;
  G.scene.add(mesh);
  return { mesh, geo, t: -1, A: new THREE.Vector3(), B: new THREE.Vector3(), C: new THREE.Vector3(), played: false };
}
const cp = new THREE.Vector3();
const ct = new THREE.Vector3();
const cn = new THREE.Vector3();
const cb = new THREE.Vector3();
function bezier(A, C, B, s, out) {
  const u = 1 - s;
  return out.set(0, 0, 0).addScaledVector(A, u * u).addScaledVector(C, 2 * u * s).addScaledVector(B, s * s);
}
function writeCheese(ch, rad) {
  const pos = ch.geo.attributes.position.array;
  const nor = ch.geo.attributes.normal.array;
  for (let r = 0; r < CR; r++) {
    const s = r / (CR - 1);
    bezier(ch.A, ch.C, ch.B, s, cp);
    bezier(ch.A, ch.C, ch.B, Math.min(1, s + 0.02), ct);
    bezier(ch.A, ch.C, ch.B, Math.max(0, s - 0.02), cn);
    ct.sub(cn).normalize();
    cn.copy(camR).addScaledVector(ct, -camR.dot(ct)).normalize();
    cb.crossVectors(ct, cn);
    // thinner in the middle, a bit lumpy
    const rr = rad * (0.3 + 0.7 * Math.pow(Math.abs(2 * s - 1), 1.5)) * (1 + 0.12 * Math.sin(s * 23));
    for (let k = 0; k <= CS; k++) {
      const a = (k / CS) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const i = (r * (CS + 1) + k) * 3;
      const nx = cn.x * ca + cb.x * sa;
      const ny = cn.y * ca + cb.y * sa;
      const nz = cn.z * ca + cb.z * sa;
      pos[i] = cp.x + nx * rr;
      pos[i + 1] = cp.y + ny * rr;
      pos[i + 2] = cp.z + nz * rr;
      nor[i] = nx;
      nor[i + 1] = ny;
      nor[i + 2] = nz;
    }
  }
  ch.geo.attributes.position.needsUpdate = true;
  ch.geo.attributes.normal.needsUpdate = true;
}
const C_STRETCH = 0.75;
const C_SNAP = 0.2;
function updateCheese(G, dt) {
  const ch = S.cheese;
  if (!ch || ch.t < 0) return;
  ch.t += dt;
  const b = S.ball;
  if (b) b.mesh.getWorldPosition(ch.A);
  // anchor on the cut face (toward the camera)
  v3.subVectors(G.camera.position, ch.A).normalize();
  ch.A.addScaledVector(v3, 0.15).addScaledVector(camU, -0.35);
  if (!ch.played && ch.t > C_STRETCH - 0.37) {
    ch.played = true;
    G.audio.play('cheese', { vol: 0.9 });
  }
  if (ch.t < C_STRETCH) {
    const k = ch.t / C_STRETCH;
    const e = 1 - Math.pow(1 - k, 2);
    ch.B.copy(ch.A).addScaledVector(camU, -5.5 * e).addScaledVector(v3, 4.5 * e).addScaledVector(camR, -0.6 * e);
    ch.C.lerpVectors(ch.A, ch.B, 0.5).addScaledVector(camU, -1.6 * e).addScaledVector(camR, 0.9 * e);
    ch.mesh.visible = true;
    writeCheese(ch, 0.27 * (1 - 0.5 * k));
  } else if (ch.t < C_STRETCH + C_SNAP) {
    // snapped: the strand springs back into the ball
    const k = (ch.t - C_STRETCH) / C_SNAP;
    ch.B.lerp(ch.A, Math.min(1, k * 1.6));
    ch.C.lerpVectors(ch.A, ch.B, 0.5).addScaledVector(camU, -0.6 * (1 - k));
    writeCheese(ch, 0.14 * (1 - k) + 0.02);
  } else {
    ch.mesh.visible = false;
    ch.t = -1;
  }
}

// ---------- choosing a ball ----------
function remaining(G) {
  return dressBalls(G, list).filter((b) => b.mode === 'slot' || b.mode === 'free');
}
function pickBallAt(G, x, y) {
  let best = null;
  let bd = Infinity;
  for (const b of remaining(G)) {
    b.mesh.getWorldPosition(v1);
    v1.y += G.cfg.BALL_R * 0.4;
    G.cam.worldToScreen(v1, scr);
    const d = Math.hypot(scr.x - x, scr.y - y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}
function nearestPlayer(G, n) {
  const r = remaining(G);
  r.sort((a, b) => {
    a.mesh.getWorldPosition(v1);
    b.mesh.getWorldPosition(v2);
    return v2.z - v1.z || Math.abs(v1.x) - Math.abs(v2.x);
  });
  return r.slice(0, n);
}

function startEat(G, x, y) {
  const b = pickBallAt(G, x, y);
  if (!b) return;
  stopWiggle();
  S.ball = b;
  S.mode = 'stab';
  S.t = 0;
  getPick(G);
  b.mesh.getWorldPosition(ballPos);
  pickFrom.copy(ballPos).addScaledVector(dirPlat, 7);
  placePick(v1.copy(ballPos).addScaledVector(dirPlat, 7 - 0.5), dirPlat);
  G.audio.play('pick', { vol: 0.6 });
  G.hints.poke();
}

function finishEat(G) {
  const b = S.ball;
  if (!b) return;
  b.bite();
  G.bits.removeOwner(b);
  S.eaten++;
  G.audio.play('munch', { vol: 1 });
  if (S.eaten % 3 === 0) G.audio.play('yum', { vol: 1, delay: 0.45 });
  b.mesh.getWorldPosition(v1);
  G.fx.steam(v1, { count: 2, spread: 1, rise: 3, size: 2.2, life: 1 });
  if (S.cheese) S.cheese.t = Math.max(S.cheese.t, C_STRETCH + C_SNAP); // never leave a strand floating
  S.mode = 'drop';
  S.t = 0;
  S.ball = null;
  pickFrom.copy(S.pick.position);
  G.hints.poke();
}

function stopWiggle() {
  if (S.wigBall) S.wigBall.group.rotation.set(0, 0, 0);
  S.wigBall = null;
}

export default {
  id: 'eat',

  enter(G) {
    S.mode = 'idle';
    S.t = 0;
    S.ball = null;
    S.queue = null;
    S.eaten = 0;
    S.firstDone = !!G.state.ateOne;
    S.wigT = 1.2;
    S.doneT = 0;
    syncPlatter(G);
    G.tools.dismiss();
    G.cam.frame('eat');
    G.input.planeY = ballTopY(G);
    getPick(G).visible = false;
    if (!S.cheese) S.cheese = makeCheese(G);
    G.hints.set({
      tool: null,
      targets: () => {
        if (S.mode === 'idle') {
          const n = nearestPlayer(G, 3);
          const out = [];
          n.forEach((b, k) => {
            b.mesh.getWorldPosition(tgtPts[k]);
            tgtPts[k].y += G.cfg.BALL_R;
            out.push(tgtPts[k]);
          });
          return out;
        }
        return [];
      },
      demo: () => {
        if (S.mode === 'mouth' && S.ball) {
          S.ball.mesh.getWorldPosition(demoPts[0]);
        } else {
          const n = nearestPlayer(G, 1);
          if (!n.length) return null;
          n[0].mesh.getWorldPosition(demoPts[0]);
          demoPts[0].y += G.cfg.BALL_R * 0.8;
        }
        demoPts[1].copy(demoPts[0]);
        return demoPts;
      },
    });
  },

  update(G, dt) {
    syncPlatter(G);
    keepWarm(G, 0.7);
    const pl = G.world.props.platter;
    if (pl) G.world.setFocus(pl.position, 13, 1);
    S.t += dt;
    const b = S.ball;
    if (b && b.mode === 'gone' && S.mode !== 'drop') S.mode = 'idle';

    switch (S.mode) {
      case 'idle': {
        if (S.queue) {
          const q = S.queue;
          S.queue = null;
          startEat(G, q.x, q.y);
          break;
        }
        if (!dressBalls(G, list).length) {
          S.mode = 'done';
          S.t = 0;
          G.audio.play('allDone', { vol: 0.8 });
          G.audio.play('yum', { vol: 1, delay: 0.5 });
          break;
        }
        // the ball nearest the player wiggles now and then: "me next!"
        S.wigT -= dt;
        if (S.wigT <= 0) {
          S.wigT = WIGGLE_EVERY;
          stopWiggle();
          S.wigBall = nearestPlayer(G, 1)[0] || null;
          S.wigStart = G.time;
          if (S.wigBall) G.audio.play('wobble', { vol: 0.3, pitch: 1.15 });
        }
        if (S.wigBall) {
          const t = G.time - S.wigStart;
          if (t > 0.9) stopWiggle();
          else {
            const a = Math.exp(-t * 4.5);
            S.wigBall.group.rotation.set(Math.sin(t * 23) * 0.05 * a, 0, Math.sin(t * 19) * 0.11 * a);
          }
        }
        break;
      }
      case 'stab': {
        const k = Math.min(1, S.t / T_STAB);
        b.mesh.getWorldPosition(ballPos);
        const e = k * k;
        v1.copy(ballPos).addScaledVector(dirPlat, (1 - e) * 7 - 0.5);
        placePick(v1, dirPlat);
        if (k >= 1) {
          G.audio.play('stab', { vol: 0.9 });
          b.group.rotation.set(0, 0, 0);
          b.hold();
          b.group.getWorldPosition(from);
          S.mode = 'lift';
          S.t = 0;
          G.audio.play('blow', { vol: 0.7, delay: 0.12 });
        }
        break;
      }
      case 'lift': {
        const k = Math.min(1, S.t / T_LIFT);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        mouthPoint(G, mouth);
        ballPos.lerpVectors(from, mouth, e);
        ballPos.y += Math.sin(Math.PI * e) * 3;
        b.group.position.copy(ballPos);
        dirCur.lerpVectors(dirPlat, dirMouth, e).normalize();
        placePick(v1.copy(ballPos).addScaledVector(dirCur, -0.5 * (1 - e)).addScaledVector(camF, 1.05 * e).addScaledVector(camU, -1.05 * e), dirCur);
        S.steamT -= dt;
        if (S.steamT <= 0) {
          S.steamT = 0.09;
          G.fx.steam(v1.copy(ballPos).addScaledVector(UP, 1.2), { count: 1, spread: 0.7, rise: 4, size: 1.8, life: 1.1 });
        }
        if (k >= 1) {
          S.t = 0;
          if (!S.firstDone) {
            // the very first one is too hot! ha-fu ha-fu
            S.firstDone = true;
            G.state.ateOne = true;
            S.mode = 'hot';
            G.audio.play('hot', { vol: 1 });
            G.fx.steam(v1.copy(ballPos).addScaledVector(UP, 1), { count: 6, spread: 1.4, rise: 6, size: 3.2, life: 1.5 });
            G.cam.shake(0.25);
          } else bite1(G);
        }
        break;
      }
      case 'hot': {
        mouthPoint(G, mouth);
        const w = Math.max(0, 1 - S.t / T_HOT);
        b.group.position.copy(mouth).addScaledVector(camR, Math.sin(S.t * 30) * 0.35 * w).addScaledVector(camU, Math.abs(Math.sin(S.t * 12)) * 0.6 * w);
        placePick(v1.copy(b.group.position).addScaledVector(camF, 1.05).addScaledVector(camU, -1.05), dirMouth);
        S.steamT -= dt;
        if (S.steamT <= 0) {
          S.steamT = 0.12;
          G.fx.steam(v1.copy(b.group.position).addScaledVector(UP, 1.1), { count: 1, spread: 1, rise: 5, size: 2.4, life: 1.2 });
        }
        if (S.t >= T_HOT) {
          S.t = 0;
          bite1(G);
        }
        break;
      }
      case 'mouth': {
        mouthPoint(G, mouth);
        // tiny breathing bob so it is clearly "being held"
        b.group.position.copy(mouth).addScaledVector(camU, Math.sin(S.t * 2.4) * 0.12);
        placePick(v1.copy(b.group.position).addScaledVector(camF, 1.05).addScaledVector(camU, -1.05), dirMouth);
        S.steamT -= dt;
        if (S.steamT <= 0) {
          S.steamT = 0.35 + Math.random() * 0.25;
          G.fx.steam(v1.copy(b.group.position).addScaledVector(UP, 0.8), { count: 1, spread: 0.6, rise: 3.5, size: 1.6, life: 1.2 });
        }
        if (S.queue && S.t >= T_MIN_MOUTH && !(S.cheese && S.cheese.t >= 0)) {
          S.queue = null;
          finishEat(G);
        }
        break;
      }
      case 'drop': {
        const k = Math.min(1, S.t / T_DROP);
        camBasis(G);
        v1.copy(pickFrom).addScaledVector(camU, -9 * k * k).addScaledVector(camR, 4 * k * k);
        placePick(v1, dirMouth);
        if (k >= 1) {
          S.pick.visible = false;
          S.mode = 'idle';
          S.t = 0;
          S.wigT = 1.6;
        }
        break;
      }
      case 'done': {
        if (S.t > 1.3) G.flow.complete();
        break;
      }
      default:
        S.mode = 'idle';
    }
    updateCheese(G, dt);
  },

  exit(G) {
    stopWiggle();
    if (S.pick) S.pick.visible = false;
    if (S.cheese) {
      S.cheese.mesh.visible = false;
      S.cheese.t = -1;
    }
  },

  onDown(G, p) {
    // stir the flakes where the finger touches
    const h = dressHit(G, p.world);
    if (h.onPlatter) G.bits.disturb(h.point, 2.6);
    if (S.mode === 'idle' && !S.queue) startEat(G, p.x, p.y);
    else if (S.mode === 'mouth' && S.t >= T_MIN_MOUTH && !(S.cheese && S.cheese.t >= 0)) finishEat(G);
    else if (S.mode !== 'done') S.queue = { x: p.x, y: p.y };
  },
  onMove(G, p) {
    if (p.speed > 15) {
      const h = dressHit(G, p.world);
      if (h.onPlatter) G.bits.disturb(h.point, 2);
    }
  },
  onUp() {},
  fastForward(G) {
    canon.eaten(G);
  },
  reset(G) {
    stopWiggle();
    S.mode = 'idle';
    S.ball = null;
    S.queue = null;
    if (S.pick) S.pick.visible = false;
    if (S.cheese) {
      S.cheese.mesh.visible = false;
      S.cheese.t = -1;
    }
    G.state.ateOne = false;
  },
};

function bite1(G) {
  const b = S.ball;
  b.bite();
  G.audio.play('bite', { vol: 1 });
  S.mode = 'mouth';
  S.t = 0;
  G.hints.poke();
  if (b.filling === 'cheese' && S.cheese) {
    S.cheese.t = 0;
    S.cheese.played = false;
    b.mesh.getWorldPosition(S.cheese.A);
    S.cheese.B.copy(S.cheese.A);
    S.cheese.C.copy(S.cheese.A);
  }
}
