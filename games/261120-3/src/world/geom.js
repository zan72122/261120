// Geometry helpers: smooth lathes / sweeps with numerically smooth normals, flat caps, rounded-rect paths.
import * as THREE from 'three';

const TAU = Math.PI * 2;

// Generic parametric surface over a (nu x nv) grid. f(i, j, out) writes position into out (Vector3).
// wrapU: i is periodic (closed around); a duplicate seam column is emitted for UVs.
// Normals = cross(dP/du, dP/dv) by central differences (wrapping in u), so faces & normals agree.
export function surface(nu, nv, f, { wrapU = true, uv = null, fallback = null, flip = false } = {}) {
  const cols = wrapU ? nu + 1 : nu;
  const P = new Float32Array(nu * nv * 3);
  const v3 = new THREE.Vector3();
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      f(i, j, v3);
      const k = (j * nu + i) * 3;
      P[k] = v3.x; P[k + 1] = v3.y; P[k + 2] = v3.z;
    }
  const get = (i, j, o) => {
    if (wrapU) i = ((i % nu) + nu) % nu;
    else i = Math.min(nu - 1, Math.max(0, i));
    j = Math.min(nv - 1, Math.max(0, j));
    const k = (j * nu + i) * 3;
    return o.set(P[k], P[k + 1], P[k + 2]);
  };
  const pos = new Float32Array(cols * nv * 3);
  const nrm = new Float32Array(cols * nv * 3);
  const uvs = new Float32Array(cols * nv * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();
  for (let j = 0; j < nv; j++)
    for (let c = 0; c < cols; c++) {
      const i = wrapU ? c % nu : c;
      get(i + 1, j, a); get(i - 1, j, b); du.subVectors(a, b);
      get(i, j + 1, a); get(i, j - 1, b); dv.subVectors(a, b);
      n.crossVectors(du, dv);
      if (n.lengthSq() < 1e-12) {
        if (fallback) fallback(i, j, n);
        else n.set(0, 1, 0);
      }
      n.normalize();
      if (flip) n.negate();
      get(i, j, a);
      const k = (j * cols + c) * 3;
      pos[k] = a.x; pos[k + 1] = a.y; pos[k + 2] = a.z;
      nrm[k] = n.x; nrm[k + 1] = n.y; nrm[k + 2] = n.z;
      const t = (j * cols + c) * 2;
      if (uv) {
        const r = uv(c, j, a);
        uvs[t] = r[0]; uvs[t + 1] = r[1];
      } else {
        uvs[t] = c / (cols - 1); uvs[t + 1] = j / (nv - 1);
      }
    }
  const idx = [];
  for (let j = 0; j < nv - 1; j++)
    for (let c = 0; c < cols - 1; c++) {
      const A = j * cols + c, B = A + 1, D = A + cols, C = D + 1;
      if (flip) idx.push(A, D, B, B, D, C);
      else idx.push(A, B, D, B, C, D);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// Arc-length array of a 2D profile
function arcLen(prof) {
  const L = [0];
  for (let j = 1; j < prof.length; j++) L.push(L[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
  return L;
}

// Lathe around +y. profile: [[r, y], ...]. Convention: a profile walking "up the outside" gets outward normals.
// mod(phi, j, r, y) -> [r, y] optional deformation. vScale: uv.v = arcLength*vScale (else 0..1).
// Vertex at angle phi: x = r*sin(phi), z = r*cos(phi). (phi = -PI/2 points to -x)
export function lathe(profile, { segs = 64, mod = null, vScale = 0, uScale = 1, uvXZ = 0, colors = null } = {}) {
  const L = arcLen(profile);
  const tot = L[L.length - 1] || 1;
  const fallback = (i, j, n) => {
    const p0 = profile[Math.max(0, j - 1)], p1 = profile[Math.min(profile.length - 1, j + 1)];
    const dr = p1[0] - p0[0], dy = p1[1] - p0[1];
    const phi = (i / segs) * TAU;
    const nr = dy, ny = -dr;
    n.set(nr * Math.sin(phi), ny, nr * Math.cos(phi));
    if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
  };
  const g = surface(segs, profile.length, (i, j, o) => {
    const phi = (i / segs) * TAU;
    let r = profile[j][0], y = profile[j][1];
    if (mod) [r, y] = mod(phi, j, r, y);
    o.set(r * Math.sin(phi), y, r * Math.cos(phi));
  }, {
    fallback,
    uv: uvXZ ? (c, j, p) => [p.x * uvXZ, p.z * uvXZ] : (c, j) => [(c / segs) * uScale, vScale ? L[j] * vScale : L[j] / tot],
  });
  if (colors) {
    // colors: per profile point [r,g,b] (linear)
    const cols = segs + 1;
    const ca = new Float32Array(cols * profile.length * 3);
    for (let j = 0; j < profile.length; j++)
      for (let c = 0; c < cols; c++) ca.set(colors[j], (j * cols + c) * 3);
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
  }
  return g;
}

// Points on an arc (2D), from angle a0 to a1 (radians), n segments, inclusive both ends.
export function arc(cx, cy, r, a0, a1, n, skipFirst = false) {
  const out = [];
  for (let k = skipFirst ? 1 : 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// Rounded rectangle path in XZ, centred at origin: [{x,z,nx,nz}] counter-clockwise seen from +y... (order checked by normals).
export function roundRectPath(w, d, r, cornerSegs = 10, straightSegs = 1) {
  const hx = w / 2 - r, hz = d / 2 - r;
  const pts = [];
  const corners = [
    [hx, hz, 0], // +x +z, angles 0..90 (angle measured from +x toward +z)
    [-hx, hz, Math.PI / 2],
    [-hx, -hz, Math.PI],
    [hx, -hz, (3 * Math.PI) / 2],
  ];
  for (let c = 0; c < 4; c++) {
    const [cx, cz, a0] = corners[c];
    for (let k = 0; k <= cornerSegs; k++) {
      const a = a0 + (k / cornerSegs) * (Math.PI / 2);
      const nx = Math.cos(a), nz = Math.sin(a);
      pts.push({ x: cx + nx * r, z: cz + nz * r, nx, nz, r });
    }
    // straight segment to next corner start (intermediate points)
    const [ncx, ncz, na0] = corners[(c + 1) % 4];
    const ex = cx + Math.cos(a0 + Math.PI / 2) * r, ez = cz + Math.sin(a0 + Math.PI / 2) * r;
    const sx = ncx + Math.cos(na0) * r, sz = ncz + Math.sin(na0) * r;
    for (let k = 1; k < straightSegs; k++) {
      const t = k / straightSegs;
      pts.push({ x: ex + (sx - ex) * t, z: ez + (sz - ez) * t, nx: Math.cos(a0 + Math.PI / 2), nz: Math.sin(a0 + Math.PI / 2), r });
    }
  }
  return pts;
}

// Offset contour (2D [x,z]) of a path by d
export function offsetContour(path, d) {
  return path.map((p) => new THREE.Vector2(p.x + p.nx * d, p.z + p.nz * d));
}

// Sweep a profile [[d, y]] (d = outward offset) around a closed path. Outward-walking-up profile -> outward normals.
export function sweep(path, profile, { uvXZ = 0.1, vScale = 0 } = {}) {
  const nu = path.length;
  // determine orientation: path direction vs normal; we want cross(du,dv) to equal outward-ish
  const p0 = path[0], p1 = path[1];
  const tx = p1.x - p0.x, tz = p1.z - p0.z;
  // for profile going up (dv=+y), outward normal ~ cross(t, up) = (t.z*1 - 0, 0, 0 - t.x)?? compute: t x up = (tz*0 - 0*1?, ...)
  // cross((tx,0,tz),(0,1,0)) = (0*0 - tz*1, tz*0 - tx*0, tx*1 - 0*0) = (-tz, 0, tx)
  const dotN = -tz * p0.nx + tx * p0.nz;
  const flip = dotN < 0;
  const L = arcLen(profile);
  return surface(nu, profile.length, (i, j, o) => {
    const p = path[i];
    const [d, y] = profile[j];
    o.set(p.x + p.nx * d, y, p.z + p.nz * d);
  }, { flip, uv: vScale ? (c, j, p) => [c / nu, L[j] * vScale] : (c, j, p) => [p.x * uvXZ, p.z * uvXZ] });
}

// Flat horizontal cap from contour (Vector2 x,z) with optional holes, at height y, facing +y (or -y).
export function cap(contour, holes = [], y = 0, { up = true, uvXZ = 0.1 } = {}) {
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
  const all = contour.concat(...holes);
  const pos = new Float32Array(all.length * 3), nrm = new Float32Array(all.length * 3), uv = new Float32Array(all.length * 2);
  all.forEach((p, k) => {
    pos[k * 3] = p.x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = p.y;
    nrm[k * 3 + 1] = up ? 1 : -1;
    uv[k * 2] = p.x * uvXZ; uv[k * 2 + 1] = p.y * uvXZ;
  });
  const idx = [];
  for (const t of tris) {
    const [a, b, c] = t;
    // face normal y = (b-a) x (c-a) . y  -> in xz: (bz-az)*(cx-ax) - (bx-ax)*(cz-az)
    const A = all[a], B = all[b], C = all[c];
    const ny = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y);
    if ((ny > 0) === up) idx.push(a, b, c);
    else idx.push(a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Small deterministic RNG
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Freeze static object trees
export function freeze(obj) {
  obj.updateMatrix();
  obj.matrixAutoUpdate = false;
  obj.children.forEach(freeze);
}
