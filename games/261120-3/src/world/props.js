// Hand-held props (all hidden at creation; CORE / phases position them). Local origin = base centre on the table, +y up,
// except pick / brush (origin = tip) and mayo (origin = nozzle tip) and ghostFinger (origin = fingertip pad).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { lathe, arc, roundRectPath, offsetContour, sweep, cap, rng, smooth } from './geom.js';
import { stoneware, smallWood, flakeTex, fadeAlpha } from './textures.js';

const TAU = Math.PI * 2;
const lin = (hex) => new THREE.Color(hex); // Color() converts sRGB hex to linear working space

// Radius of a profile's inner wall at height y (scans segments from index `from`, walking downward)
function innerR(prof, from, y) {
  for (let j = from; j < prof.length - 1; j++) {
    const [r0, y0] = prof[j], [r1, y1] = prof[j + 1];
    if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) {
      const t = y0 === y1 ? 0 : (y - y0) / (y1 - y0);
      return r0 + (r1 - r0) * t;
    }
  }
  return prof[from][0];
}
// per-profile-point colours: rimColour for points with y >= rimY, base otherwise
function rimColors(prof, rimY, base, rim) {
  return prof.map(([, y]) => (y >= rimY ? rim : base));
}
// Insert extra points right below the rim so a vertex-colour rim band stays crisp
function bowlProfile(outer, rimC, rimR, inner) {
  // outer: points walking up the outside; rim: arc over the top; inner: points walking down the inside
  const rim = arc(rimC[0], rimC[1], rimR, 0, Math.PI, 6);
  const o2 = outer.slice();
  const oLast = o2[o2.length - 1];
  o2.push([oLast[0] + (rim[0][0] - oLast[0]) * 0.85, oLast[1] + (rim[0][1] - oLast[1]) * 0.85]);
  const i0 = inner[0];
  const iFirst = [rim[rim.length - 1][0] + (i0[0] - rim[rim.length - 1][0]) * 0.15, rim[rim.length - 1][1] + (i0[1] - rim[rim.length - 1][1]) * 0.15];
  return [...o2, ...rim, iFirst, ...inner];
}

function hide(o) {
  o.visible = false;
  o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
}

export function buildProps(ctx) {
  const { low } = ctx;
  const R = rng(1234);

  // ---------- shared materials ----------
  const sw = stoneware(low ? 256 : 512, [0.94, 0.92, 0.87], 21);
  const ceramic = (tint = 0xffffff, extra = {}) => new THREE.MeshPhysicalMaterial({
    color: tint, map: sw.map, roughnessMap: sw.roughnessMap, roughness: 1, normalMap: sw.normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.55, clearcoatRoughness: 0.1, vertexColors: true, ...extra,
  });
  const white = [1, 1, 1];
  const ironRim = lin(0x6b4a33).toArray();
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd0d2, metalness: 1, roughness: 0.28 });
  const lightWoodTex = smallWood(256, [0.74, 0.58, 0.38], [0.55, 0.39, 0.22], 3);
  const lightWood = new THREE.MeshStandardMaterial({ map: lightWoodTex, roughness: 0.55 });
  const darkWoodTex = smallWood(256, [0.45, 0.27, 0.15], [0.28, 0.15, 0.08], 9);
  const darkWood = new THREE.MeshPhysicalMaterial({ map: darkWoodTex, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 });

  const props = {};

  // ================= pitcher (white enamel jug, navy rim) =================
  {
    const g = new THREE.Group();
    g.name = 'pitcher';
    const outer = [[0, 0], [3.55, 0], ...arc(3.55, 0.35, 0.35, -Math.PI / 2, 0, 4, true), [4.15, 2], [4.4, 6], [4.48, 9], [4.52, 10.6]];
    const rim = arc(4.4, 10.65, 0.12, 0, Math.PI, 6);
    const inner = [[4.27, 10.45], [4.25, 9], [4.18, 6], [3.92, 2], [3.7, 0.7], [3.3, 0.48], [0, 0.45]];
    const prof = [...outer, ...rim, ...inner];
    const navy = lin(0x1c2740).toArray();
    const cols = prof.map(([r, y], j) => (y > 10.35 || (j <= 3 && y < 0.3 && r > 3.0) ? navy : white));
    const SPHI = (3 * Math.PI) / 2; // -x
    const spout = (phi, j, r, y) => {
      const s = smooth(6.8, 10.8, y);
      const k = Math.pow(Math.max(0, Math.cos(phi - SPHI)), 9);
      return [r + 2.1 * s * s * k, y + 0.75 * s * s * s * k];
    };
    const body = new THREE.Mesh(lathe(prof, { segs: low ? 72 : 96, mod: spout, colors: cols }),
      new THREE.MeshPhysicalMaterial({ color: 0xf6f4ee, vertexColors: true, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.1 }));
    g.add(body);
    // handle on +x
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(4.2, 9.9, 0), new THREE.Vector3(6.4, 9.9, 0), new THREE.Vector3(7.5, 8.2, 0),
      new THREE.Vector3(7.3, 5.4, 0), new THREE.Vector3(5.9, 3.6, 0), new THREE.Vector3(4.1, 3.0, 0),
    ]);
    const hg = new THREE.TubeGeometry(curve, 48, 0.42, 12, false);
    hg.scale(1, 1, 1.25);
    const handle = new THREE.Mesh(hg, body.material);
    // handle has no vertex colours: add a white colour attribute
    hg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(hg.attributes.position.count * 3).fill(1), 3));
    g.add(handle);
    // batter surface
    const batterMat = new THREE.MeshPhysicalMaterial({ color: 0xe2cd98, roughness: 0.38, clearcoat: 0.3, clearcoatRoughness: 0.2 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), batterMat);
    g.add(disc);
    const yMin = 0.55, yMax = 8.6;
    g.setLevel = (a) => {
      a = Math.min(1, Math.max(0, a));
      g.userData.level = a;
      disc.visible = a > 0.01;
      const y = yMin + (yMax - yMin) * a;
      const r = innerR(prof, outer.length + rim.length, y) - 0.02;
      disc.position.y = y;
      disc.scale.set(r, 1, r);
    };
    g.setLevel(1);
    // spout tip: deformed outer rim point at phi = -x
    const [tr, ty] = spout(SPHI, 0, 4.52, 10.7);
    g.userData.action = new THREE.Vector3(-tr, ty, 0);
    g.userData.size = { height: 11.5, diameter: 9 };
    props.pitcher = hide(g);
  }

  // ================= fillBowl (white stoneware, iron rim) =================
  const bowlMatWhite = ceramic(0xffffff);
  {
    const g = new THREE.Group();
    g.name = 'fillBowl';
    const prof = bowlProfile(
      [[0, 0.35], [2.6, 0.35], [2.72, 0.02], [3.2, 0.02], [3.32, 0.3], [4.2, 0.95], [5.2, 2.25], [5.82, 3.85], [6.02, 4.85]],
      [5.9, 4.9], 0.12,
      [[5.66, 3.9], [5.0, 2.4], [3.9, 1.15], [2.5, 0.85], [0, 0.8]],
    );
    const bowl = new THREE.Mesh(lathe(prof, { segs: 72, uvXZ: 0.1, colors: rimColors(prof, 4.78, white, ironRim) }), bowlMatWhite);
    g.add(bowl);
    // slots for filling pieces (~1.3 cm) heaped naturally
    const slots = [], yaws = [];
    const surfY = (r) => (r < 2.5 ? 0.8 + r * 0.02 : 0.85 + (r - 2.5) * 0.22 + Math.max(0, r - 3.9) * 0.9);
    const add = (r, a, lift) => { slots.push(new THREE.Vector3(Math.sin(a) * r, surfY(r) + 0.62 + lift, Math.cos(a) * r)); yaws.push(R() * TAU); };
    add(0, 0, 0);
    for (let k = 0; k < 6; k++) add(1.75 + R() * 0.25, (k / 6) * TAU + R() * 0.2, 0);
    for (let k = 0; k < 8; k++) add(3.35 + R() * 0.2, (k / 8) * TAU + 0.3 + R() * 0.15, 0.05);
    for (let k = 0; k < 4; k++) add(1.0 + R() * 0.3, (k / 4) * TAU + 0.6, 1.0);
    for (let k = 0; k < 4; k++) add(2.6 + R() * 0.2, (k / 4) * TAU + 1.3, 1.0);
    add(0.3, 1, 1.9);
    g.userData.slots = slots;
    g.userData.slotYaws = yaws;
    g.userData.action = new THREE.Vector3(-5.9, 5.0, 0);
    g.userData.size = { diameter: 12, height: 5 };
    props.fillBowl = hide(g);
  }

  // ================= toppingDish (small dish, three heaps) =================
  {
    const g = new THREE.Group();
    g.name = 'toppingDish';
    const prof = bowlProfile(
      [[0, 0.3], [3.3, 0.3], [3.42, 0.02], [3.9, 0.02], [4.02, 0.25], [4.7, 0.85], [5.05, 1.6]],
      [4.93, 1.66], 0.12,
      [[4.72, 1.5], [4.2, 0.9], [3.0, 0.63], [0, 0.6]],
    );
    const dish = new THREE.Mesh(lathe(prof, { segs: 72, uvXZ: 0.1, colors: rimColors(prof, 1.58, lin(0xd7dcd6).toArray(), ironRim) }), ceramic(0xffffff));
    g.add(dish);
    // piece geometries
    const negiGeo = new THREE.TorusGeometry(0.26, 0.075, 6, 16);
    negiGeo.scale(1, 1, 2.2);
    const tenGeo = new THREE.IcosahedronGeometry(0.24, 1);
    { const p = tenGeo.attributes.position; for (let i = 0; i < p.count; i++) { const h = 0.7 + 0.6 * Math.abs(Math.sin(p.getX(i) * 37 + p.getY(i) * 53 + p.getZ(i) * 71)); p.setXYZ(i, p.getX(i) * h, p.getY(i) * h * 0.8, p.getZ(i) * h); } tenGeo.computeVertexNormals(); }
    const beniGeo = new THREE.BoxGeometry(0.12, 0.08, 1.2, 1, 1, 6);
    { const p = beniGeo.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setX(i, p.getX(i) + z * z * 0.25); p.setY(i, p.getY(i) + Math.sin(z * 3) * 0.04); } beniGeo.computeVertexNormals(); }
    const kinds = [
      { geo: negiGeo, n: low ? 90 : 150, mat: new THREE.MeshStandardMaterial({ roughness: 0.45 }), cols: [0x3f7a22, 0x5f9a30, 0x7fb045, 0xc9dc9a, 0xe4ecc8], w: [3, 3, 2, 1, 1], a: Math.PI * 0.5, h: 1.9 },
      { geo: tenGeo, n: low ? 80 : 130, mat: new THREE.MeshStandardMaterial({ roughness: 0.75 }), cols: [0xd9a04a, 0xe8bb62, 0xf2d28a, 0xc78a34], w: [3, 3, 2, 1], a: Math.PI * 1.17, h: 1.7 },
      { geo: beniGeo, n: low ? 50 : 80, mat: new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.6 }), cols: [0xd0183c, 0xe0284f, 0xf0506a], w: [2, 2, 1], a: Math.PI * 1.83, h: 1.4 },
    ];
    const heaps = [];
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
    for (const k of kinds) {
      const im = new THREE.InstancedMesh(k.geo, k.mat, k.n);
      const cx = Math.sin(k.a) * 2.15, cz = Math.cos(k.a) * 2.15, Rh = 1.75;
      const items = [];
      // shells: the first i pieces always form a complete smaller heap (so setLevel shrinks it naturally)
      for (let i = 0; i < k.n; i++) {
        const sc = Math.cbrt((i + 0.5) / k.n);
        const rr = Rh * sc * Math.sqrt(R());
        const an = R() * TAU;
        const top = k.h * sc * (1 - (rr / (Rh * sc)) ** 2);
        const y = 0.68 + top * (0.75 + 0.25 * R());
        items.push([cx + Math.sin(an) * rr, y, cz + Math.cos(an) * rr]);
      }
      const wsum = k.w.reduce((a, b) => a + b, 0);
      items.forEach((it, i) => {
        E.set(R() * TAU, R() * TAU, R() * TAU);
        const s = 0.8 + R() * 0.45;
        M.compose(P.set(...it), Q.setFromEuler(E), S.set(s, s, s));
        im.setMatrixAt(i, M);
        let pick = R() * wsum, ci = 0;
        while (pick > k.w[ci]) { pick -= k.w[ci]; ci++; }
        C.set(k.cols[Math.min(ci, k.cols.length - 1)]);
        C.multiplyScalar(0.9 + R() * 0.2);
        im.setColorAt(i, C);
      });
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      g.add(im);
      heaps.push(im);
    }
    g.setLevel = (a) => {
      a = Math.min(1, Math.max(0, a));
      g.userData.level = a;
      for (const im of heaps) im.count = Math.round(im.instanceMatrix.count * a);
    };
    g.userData.action = new THREE.Vector3(0, 2.6, 0);
    g.userData.heaps = { negi: heaps[0], tenkasu: heaps[1], beni: heaps[2] };
    g.userData.size = { diameter: 10, height: 1.8 };
    props.toppingDish = hide(g);
  }

  // ================= pick (steel spike + turned wooden handle), origin = tip =================
  {
    const g = new THREE.Group();
    g.name = 'pick';
    const sp = new THREE.Mesh(lathe([[0, 0], [0.022, 0.05], [0.05, 0.6], [0.075, 3], [0.09, 6.2], [0.24, 6.25], [0.27, 6.4], [0.27, 7.4], [0.22, 7.5], [0, 7.5]], { segs: 20 }), steel);
    const hp = [[0, 7.3], [0.26, 7.3], [0.34, 8.0], [0.42, 9.4], [0.46, 12.0], [0.44, 15.6], ...arc(0.22, 15.75, 0.22, 0, Math.PI / 2, 6, true)];
    hp[hp.length - 1][0] = 0;
    const hd = new THREE.Mesh(lathe(hp, { segs: 24, vScale: 1 / 9 }), lightWood);
    g.add(sp, hd);
    g.userData.action = new THREE.Vector3(0, 0, 0);
    g.userData.size = { length: 16 };
    props.pick = hide(g);
  }

  // ================= platter (speckled stoneware, rounded rect, low rim) =================
  {
    const { w, d, surfaceY } = ctx.cfg.PLATTER;
    const g = new THREE.Group();
    g.name = 'platter';
    const pr = 3.4;
    const path = roundRectPath(w, d, pr, 12, 3);
    const inFlat = -1.75;
    const prof = [
      [-2.75, 0.42], [-2.5, 0.12], [-2.25, 0.0], [-1.95, 0.04], [-1.65, 0.17], [-1.1, 0.42], [-0.55, 0.86], [-0.18, 1.45],
      [-0.02, 1.9], ...arc(-0.16, 1.92, 0.15, 0, Math.PI, 6, true),
      [-0.42, 1.68], [-0.75, 1.4], [-1.2, 1.25], [inFlat, surfaceY],
    ];
    const pmat = ceramic(0xffffff, { vertexColors: false, clearcoat: 0.7 });
    const rimG = sweep(path, prof, { uvXZ: 1 / 12 });
    const topG = cap(offsetContour(path, inFlat), [], surfaceY, { uvXZ: 1 / 12 });
    const botG = cap(offsetContour(path, -2.75), [], 0.42, { up: false, uvXZ: 1 / 12 });
    const m = new THREE.Mesh(mergeGeometries([rimG, topG, botG]), pmat);
    g.add(m);
    g.userData.surfaceY = surfaceY;
    g.userData.size = { w, d, rimH: 2.07 };
    props.platter = hide(g);
  }

  // ================= sauceBowl =================
  {
    const g = new THREE.Group();
    g.name = 'sauceBowl';
    const inner = [[3.96, 3.3], [3.8, 2.5], [3.25, 1.25], [2.2, 0.75], [0, 0.7]];
    const prof = bowlProfile([[0, 0.3], [2.0, 0.3], [2.12, 0.02], [2.6, 0.02], [2.72, 0.3], [3.5, 1.2], [4.05, 2.5], [4.2, 3.3]], [4.08, 3.36], 0.12, inner);
    const bowl = new THREE.Mesh(lathe(prof, { segs: 64, uvXZ: 0.1, colors: rimColors(prof, 3.25, white, ironRim) }), bowlMatWhite);
    g.add(bowl);
    const sauceMat = new THREE.MeshPhysicalMaterial({ color: 0x2a1105, roughness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.03, envMapIntensity: 0.35 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), sauceMat);
    g.add(disc);
    const iStart = prof.length - inner.length - 1;
    g.setLevel = (a) => {
      a = Math.min(1, Math.max(0, a));
      g.userData.level = a;
      disc.visible = a > 0.01;
      const y = 0.82 + a * 1.9;
      const r = innerR(prof, iStart, y) - 0.01;
      disc.position.y = y;
      disc.scale.set(r, 1, r);
    };
    g.setLevel(1);
    g.userData.action = new THREE.Vector3(0, 2.7, 0);
    g.userData.size = { diameter: 8.4, height: 3.4 };
    props.sauceBowl = hide(g);
  }

  // ================= brush (bristles + ferrule + flat wooden handle), origin = bristle tip =================
  {
    const g = new THREE.Group();
    g.name = 'brush';
    const bGeo = new THREE.CylinderGeometry(0.032, 0.045, 3.0, 5, 1);
    bGeo.translate(0, 1.5, 0);
    const bristleMat = new THREE.MeshStandardMaterial({ color: 0xd9c8a0, roughness: 0.75 });
    const nb = low ? 90 : 150;
    const im = new THREE.InstancedMesh(bGeo, bristleMat, nb);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
    for (let i = 0; i < nb; i++) {
      const x = (R() - 0.5) * 2.3, z = (R() - 0.5) * 0.62;
      const y = Math.abs(x) * 0.06 + R() * 0.15;
      E.set(-z * 0.12, 0, x * 0.05);
      const s = 1 - y / 3.0;
      M.compose(P.set(x * 0.96, y, z * 0.96), Q.setFromEuler(E), S.set(1, s, 1));
      im.setMatrixAt(i, M);
      im.setColorAt(i, C.setScalar(0.85 + R() * 0.25));
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    const ferrule = new THREE.Mesh(new RoundedBoxGeometry(2.75, 1.4, 0.95, 3, 0.3), steel);
    ferrule.position.y = 2.95;
    // flat handle outline (x, y), extruded in z
    const sh = new THREE.Shape();
    sh.moveTo(-1.1, 3.4);
    sh.bezierCurveTo(-0.9, 5.5, -0.55, 7, -0.6, 9.5);
    sh.bezierCurveTo(-0.65, 12, -0.85, 14.5, -0.85, 15.6);
    sh.bezierCurveTo(-0.85, 16.8, 0.85, 16.8, 0.85, 15.6);
    sh.bezierCurveTo(0.85, 14.5, 0.65, 12, 0.6, 9.5);
    sh.bezierCurveTo(0.55, 7, 0.9, 5.5, 1.1, 3.4);
    sh.lineTo(-1.1, 3.4);
    const hole = new THREE.Path();
    hole.absarc(0, 15.55, 0.28, 0, TAU, true);
    sh.holes.push(hole);
    const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.14, bevelSegments: 3, curveSegments: 16 });
    hg.translate(0, 0, -0.2);
    { const uv = hg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.12 + 0.3, uv.getY(i) * 0.06); }
    const handle = new THREE.Mesh(hg, lightWood);
    g.add(im, ferrule, handle);
    const dry = new THREE.Color(0xd9c8a0), wet = new THREE.Color(0x3a190b);
    g.setLoaded = (a) => {
      a = Math.min(1, Math.max(0, a));
      g.userData.loaded = a;
      bristleMat.color.copy(dry).lerp(wet, a);
      bristleMat.roughness = 0.75 - 0.55 * a;
    };
    g.setLoaded(0);
    g.userData.action = new THREE.Vector3(0, 0, 0);
    g.userData.size = { length: 16.8, headW: 2.75 };
    props.brush = hide(g);
  }

  // ================= mayo (soft squeeze bottle, upside-down), origin = nozzle tip =================
  {
    const g = new THREE.Group();
    g.name = 'mayo';
    // cap with star nozzle
    const capProf = [[0, 0], [0.3, 0], [0.33, 0.08], [0.42, 0.7], [0.5, 1.2], [0.62, 1.35], [1.25, 1.55], [1.85, 1.95], [2.05, 2.3], [2.1, 3.4], [2.0, 3.6], [1.6, 3.65]];
    const capMod = (phi, j, r, y) => {
      if (y < 1.3) r *= 1 + 0.2 * Math.cos(phi * 8) * (1 - y / 1.4);
      else if (y > 2.35 && y < 3.35) r *= 1 + 0.018 * Math.cos(phi * 40);
      return [r, y];
    };
    const capMesh = new THREE.Mesh(lathe(capProf, { segs: 80, mod: capMod }), new THREE.MeshPhysicalMaterial({ color: 0xc8182a, roughness: 0.38, clearcoat: 0.3 }));
    // nozzle opening (dark)
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a2a10 }));
    hole.position.y = -0.002;
    // bottle body
    const bodyProf = [[1.55, 3.45], [2.25, 4.3], [2.72, 5.8], [2.8, 9], [2.8, 13], [2.74, 15.6], [2.45, 16.6], [1.5, 17.15], [0, 17.3]];
    const squeezeMod = (k) => (phi, j, r, y) => [r * (1 - k * Math.exp(-(((y - 10.5) / 2.8) ** 2))), y];
    const mkMorph = (geoA, geoB) => {
      geoA.morphAttributes.position = [geoB.attributes.position];
      geoA.morphAttributes.normal = [geoB.attributes.normal];
      return geoA;
    };
    const bodyGeo = mkMorph(lathe(bodyProf, { segs: 64 }), lathe(bodyProf, { segs: 64, mod: squeezeMod(0.24) }));
    const bottleMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f3ec, roughness: 0.32, transparent: true, opacity: 0.55, depthWrite: false, clearcoat: 0.3, clearcoatRoughness: 0.3 });
    const bottle = new THREE.Mesh(bodyGeo, bottleMat);
    bottle.renderOrder = 3;
    // mayo inside (opaque, slightly smaller), scaled from the cap end by level
    const mProf = [[0, 0], [1.45, 0], [2.15, 0.85], [2.6, 2.3], [2.66, 5], [2.66, 12.6], [2.4, 13.2], [1.4, 13.5], [0, 13.55]];
    const mGeo = mkMorph(lathe(mProf, { segs: 48 }), lathe(mProf, { segs: 48, mod: (phi, j, r, y) => [r * (1 - 0.25 * Math.exp(-(((y - 7) / 2.8) ** 2))), y] }));
    const mayoIn = new THREE.Mesh(mGeo, new THREE.MeshStandardMaterial({ color: 0xf1dc96, roughness: 0.45 }));
    mayoIn.position.y = 3.55;
    g.add(capMesh, hole, mayoIn, bottle);
    g.setLevel = (a) => {
      a = Math.min(1, Math.max(0, a));
      g.userData.level = a;
      mayoIn.visible = a > 0.01;
      mayoIn.scale.y = Math.max(0.02, a);
    };
    g.squeeze = (a) => {
      a = Math.min(1, Math.max(0, a));
      g.userData.squeeze = a;
      bottle.morphTargetInfluences[0] = a;
      mayoIn.morphTargetInfluences[0] = a;
    };
    g.setLevel(1);
    g.squeeze(0);
    g.userData.action = new THREE.Vector3(0, 0, 0);
    g.userData.size = { length: 17.3, diameter: 5.6 };
    props.mayo = hide(g);
    bottle.castShadow = true;
  }

  // ================= flakeBowl (wooden bowl heaped with katsuobushi) =================
  {
    const g = new THREE.Group();
    g.name = 'flakeBowl';
    const prof = [
      [0, 0.3], [2.6, 0.3], [2.72, 0.02], [3.3, 0.02], [3.42, 0.3], [4.6, 1.35], [5.38, 2.95], [5.6, 4.25],
      ...arc(5.47, 4.3, 0.14, 0, Math.PI, 5, true), [5.15, 3.0], [4.3, 1.45], [2.8, 0.78], [0, 0.66],
    ];
    const bowl = new THREE.Mesh(lathe(prof, { segs: 64, vScale: 1 / 6, uScale: 2 }), darkWood);
    g.add(bowl);
    const fGeo = new THREE.PlaneGeometry(1.25, 0.8, 5, 3);
    { const p = fGeo.attributes.position; const cr = 0.62; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const th = x / cr; p.setXYZ(i, cr * Math.sin(th), y, cr * (1 - Math.cos(th)) + x * y * 0.15); } fGeo.computeVertexNormals(); }
    const ft = flakeTex(128);
    const fMat = new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, emissive: 0x6a4436, emissiveMap: ft, emissiveIntensity: 1.0 });
    const n = low ? 200 : 340;
    const im = new THREE.InstancedMesh(fGeo, fMat, n);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
    const items = [];
    for (let i = 0; i < n; i++) {
      // fill level f of piece i: the first i pieces fill the bowl up to that level
      const f = (i + 0.5) / n;
      const rr = 4.9 * Math.sqrt(R()), an = R() * TAU;
      const floor = rr < 2.8 ? 0.9 : 0.9 + (rr - 2.8) * 0.75;
      const top = 4.3 + 2.0 * (1 - (rr / 5.0) ** 2);
      const y = Math.max(floor + 0.1, 0.9 + f * (top - 0.9) - R() * 0.5);
      items.push([Math.sin(an) * rr, y, Math.cos(an) * rr]);
    }
    items.forEach((it, i) => {
      E.set(R() * TAU, R() * TAU, R() * TAU);
      const s = 0.75 + R() * 0.55;
      M.compose(P.set(...it), Q.setFromEuler(E), S.set(s, s, s));
      im.setMatrixAt(i, M);
      im.setColorAt(i, C.setRGB(1, 0.92 + R() * 0.1, 0.9 + R() * 0.12).multiplyScalar(0.92 + R() * 0.16));
    });
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    g.add(im);
    g.setLevel = (a) => {
      a = Math.min(1, Math.max(0, a));
      g.userData.level = a;
      im.count = Math.round(n * a);
    };
    g.userData.action = new THREE.Vector3(0, 6.0, 0);
    g.userData.size = { diameter: 11.2, height: 4.4 };
    props.flakeBowl = hide(g);
  }

  // ================= ghostFinger (translucent fingertip), origin = fingertip pad =================
  {
    const g = new THREE.Group();
    g.name = 'ghostFinger';
    const fade = fadeAlpha(128, 0.38, 0.85);
    const skin = new THREE.MeshStandardMaterial({ color: 0xffd6c2, roughness: 0.5, emissive: 0xa86a55, emissiveIntensity: 0.55, transparent: true, opacity: 0.6, depthWrite: false, alphaMap: fade });
    const nailM = new THREE.MeshStandardMaterial({ color: 0xffeae4, roughness: 0.3, emissive: 0xa07a70, emissiveIntensity: 0.5, transparent: true, opacity: 0.6, depthWrite: false });
    const r = 0.78;
    // finger profile: rounded pad, slight narrowing at the joint, fades out toward the top (uv.v ~ height)
    const fprof = [...arc(0, r, r, -Math.PI / 2, 0, 10), [0.8, 1.6], [0.765, 2.6], [0.8, 3.4], [0.84, 4.6], [0.85, 6.4], [0.82, 7.6], [0.5, 8.0], [0, 8.1]];
    const fg = lathe(fprof, { segs: 32, vScale: 1 / 9 });
    fg.scale(1, 1, 0.86);
    const finger = new THREE.Mesh(fg, skin);
    const ng = new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2);
    ng.rotateX(Math.PI / 2); // dome toward +z
    ng.scale(0.56, 0.78, 0.16);
    const nail = new THREE.Mesh(ng, nailM);
    nail.position.set(0, 1.45, r * 0.86 - 0.07);
    const tilt = new THREE.Group();
    tilt.rotation.x = 0.3; // finger leans back toward the player (+z), nail facing up-ish
    tilt.add(finger, nail);
    g.add(tilt);
    for (const m of [finger, nail]) { m.renderOrder = 999; m.castShadow = false; m.receiveShadow = false; }
    g.userData.materials = [skin, nailM];
    g.setOpacity = (a) => { skin.opacity = a; nailM.opacity = a; };
    g.userData.action = new THREE.Vector3(0, 0, 0);
    g.visible = false;
    props.ghostFinger = g;
  }

  return props;
}
