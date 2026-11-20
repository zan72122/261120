import { THREE } from './three.js';
import { canvasTexture } from './textures.js';

// 周辺の場面（低ポリ＋写真風テクスチャ／板ポリゴン）。三角形 ≈ 3,000、draw call ≤ 12。
// 机の天板上面が y=0。hero は原点に置かれる。

export function buildEnvironment(renderer, scene, tex) {
  const disposables = [];
  const own = (x) => { disposables.push(x); return x; };
  const group = new THREE.Group();
  group.name = 'environment';

  scene.background = new THREE.Color(0xcfe0fa);
  scene.fog = new THREE.Fog(0xe9eefb, 18, 78);

  // ---- 光（影なし）
  const hemi = new THREE.HemisphereLight(0xfff6ee, 0x9bb58a, 1.15);
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(3.5, 7, 5);
  group.add(hemi, sun);

  // ---- 空（上半球の内側。鏡映繰り返しで継ぎ目なし）
  const skyTex = own(tex.sky_pastel.clone());
  skyTex.wrapS = THREE.MirroredRepeatWrapping; skyTex.wrapT = THREE.ClampToEdgeWrapping;
  skyTex.repeat.set(6, 1);
  const sky = new THREE.Mesh(
    own(new THREE.SphereGeometry(80, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    own(new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })),
  );
  sky.renderOrder = -10;
  group.add(sky);

  // ---- 地面（フェルトに緑を掛ける）
  const feltGround = own(tex.felt_teal.clone());
  feltGround.repeat.set(26, 26);
  const ground = new THREE.Mesh(
    own(new THREE.CircleGeometry(80, 32)),
    own(new THREE.MeshLambertMaterial({ map: feltGround, color: 0xc4f0a8 })),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -2.6;
  group.add(ground);

  // ---- 遠い丘（3 帯。フェルトに色を掛け、遠いほど青く）
  const feltHill = own(tex.felt_teal.clone());
  feltHill.repeat.set(10, 1);
  const hillMat = own(new THREE.MeshLambertMaterial({ map: feltHill, vertexColors: true, side: THREE.DoubleSide }));
  const hills = new THREE.Mesh(own(mergeSimple([
    hillBand(24, -2.6, 3.6, 1.3, [0.78, 0.98, 0.62]),
    hillBand(33, -2.6, 6.5, 4.1, [0.66, 0.9, 0.78]),
    hillBand(45, -2.6, 10, 7.7, [0.78, 0.86, 1.0]),
  ])), hillMat);
  group.add(hills);

  // ---- 木と茂み（InstancedMesh、フェルト）
  const feltTree = own(tex.felt_teal.clone()); feltTree.repeat.set(2, 2);
  const treeMat = own(new THREE.MeshLambertMaterial({ map: feltTree, color: 0xffffff }));
  const trees = new THREE.InstancedMesh(own(new THREE.ConeGeometry(0.9, 2.6, 8, 1)), treeMat, 18);
  const bushes = new THREE.InstancedMesh(own(new THREE.IcosahedronGeometry(0.9, 1)), treeMat, 12);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const rnd = mulberry(7);
  const greens = [0xb5f09a, 0x9fe3a6, 0xd4f5a0, 0x8fd9b8];
  for (let i = 0; i < 18; i++) {
    const a = THREE.MathUtils.lerp(-1.25, 1.25, i / 17) + (rnd() - 0.5) * 0.12;
    const r = 11 + rnd() * 9;
    const s = 0.8 + rnd() * 0.7;
    p.set(Math.sin(a) * r, -2.6 + 1.3 * s, -Math.cos(a) * r);
    sc.set(s, s, s); m.compose(p, q, sc); trees.setMatrixAt(i, m);
    trees.setColorAt(i, new THREE.Color(greens[i % 4]));
  }
  for (let i = 0; i < 12; i++) {
    const a = THREE.MathUtils.lerp(-1.4, 1.4, i / 11) + (rnd() - 0.5) * 0.2;
    const r = 8 + rnd() * 6;
    const s = 0.6 + rnd() * 0.6;
    p.set(Math.sin(a) * r, -2.6 + 0.3 * s, -Math.cos(a) * r);
    sc.set(s * 1.3, s, s * 1.3); m.compose(p, q, sc); bushes.setMatrixAt(i, m);
    bushes.setColorAt(i, new THREE.Color(greens[(i + 2) % 4]));
  }
  group.add(trees, bushes);

  // ---- 机（丸い木の天板＋脚）
  const wood = own(tex.wood_table.clone()); wood.repeat.set(1.5, 1.5);
  const woodMat = own(new THREE.MeshLambertMaterial({ map: wood }));
  const top = new THREE.Mesh(own(new THREE.CylinderGeometry(3.4, 3.3, 0.22, 64, 1)), woodMat);
  top.position.y = -0.11;
  const leg = new THREE.Mesh(own(new THREE.CylinderGeometry(0.45, 0.8, 2.4, 16, 1, true)), own(new THREE.MeshLambertMaterial({ map: tex.wood_table, color: 0xb98a63 })));
  leg.position.y = -1.4;
  group.add(top, leg);

  // ---- フェルトのマット（波形のふち）
  const feltMat = own(tex.felt_teal.clone()); feltMat.repeat.set(1.4, 1.4);
  const mat = new THREE.Mesh(own(scallopDisc(1.85, 0.07, 14, 112)), own(new THREE.MeshLambertMaterial({ map: feltMat, color: 0xffffff })));
  mat.position.y = 0.004;
  group.add(mat);

  // ---- 疑似影（放射グラデの板）
  const shadowTex = own(canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(20,30,40,0.55)'); gr.addColorStop(0.55, 'rgba(20,30,40,0.25)'); gr.addColorStop(1, 'rgba(20,30,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { srgb: false }));
  const shadow = new THREE.Mesh(own(new THREE.PlaneGeometry(3.6, 2.6)), own(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false })));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.renderOrder = 1;
  group.add(shadow);

  // ---- 見せ場（finale）だけで使う虹ときらきらは、起動時には作らない（最初の場面だけ作る）。
  //      最初の描画のあと手が空いたとき（prepareLater）か、最初に使うときに作る。
  let rainbow = null, rainbowMat = null, spark = null, sparkGeo = null, pos = null, vel = null, life = null, sparkTime = 0;
  const N = 160;
  function ensureFinaleFx() {
    if (rainbow) return;
    const rainbowTex = own(canvasTexture(512, 128, (g, w, h) => {
      const cols = ['#ff9aa8', '#ffc58f', '#fff19a', '#a8eea0', '#9fd4ff', '#c8b0ff'];
      g.lineWidth = 9;
      cols.forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.ellipse(w / 2, h + 4, w / 2 - 12 - i * 9, h - 10 - i * 9, 0, Math.PI, 2 * Math.PI); g.stroke(); });
    }));
    rainbowTex.wrapS = rainbowTex.wrapT = THREE.ClampToEdgeWrapping;
    rainbowMat = own(new THREE.MeshBasicMaterial({ map: rainbowTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    rainbow = new THREE.Mesh(own(new THREE.PlaneGeometry(44, 11)), rainbowMat);
    rainbow.position.set(0, 2.5, -40); rainbow.visible = false; rainbow.renderOrder = -5;
    group.add(rainbow);

    // きらきら（finale の噴き上がり、Points 1 つ）
    sparkGeo = own(new THREE.BufferGeometry());
    pos = new Float32Array(N * 3); vel = new Float32Array(N * 3); life = new Float32Array(N);
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const sparkTex = own(canvasTexture(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,200,240,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(32, 2); g.lineTo(32, 62); g.moveTo(2, 32); g.lineTo(62, 32); g.stroke();
    }));
    spark = new THREE.Points(sparkGeo, own(new THREE.PointsMaterial({ map: sparkTex, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xfff4e0 })));
    spark.visible = false; spark.frustumCulled = false; spark.renderOrder = 10;
    group.add(spark);
  }

  let rainbowTarget = 0;

  scene.add(group);

  return {
    group,
    // 最初の描画のあと、手が空いているときに見せ場の資源を作っておく（見せ場の始まりで止まらないように）
    prepareLater(delayMs = 2500) {
      setTimeout(() => {
        try { ensureFinaleFx(); renderer.initTexture(rainbowMat.map); renderer.initTexture(spark.material.map); } catch (e) { /* 使うときにもう一度作る */ }
      }, delayMs);
    },
    setRainbow(v) { if (v > 0) ensureFinaleFx(); rainbowTarget = v; if (v > 0 && rainbow) rainbow.visible = true; },
    burst(at) {
      ensureFinaleFx();
      for (let i = 0; i < N; i++) {
        pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
        const a = Math.random() * Math.PI * 2, up = 1.6 + Math.random() * 2.2, out = 0.4 + Math.random() * 1.2;
        vel[i * 3] = Math.cos(a) * out; vel[i * 3 + 1] = up; vel[i * 3 + 2] = Math.sin(a) * out;
        life[i] = 1.6 + Math.random() * 1.4;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      spark.visible = true; sparkTime = 3.2;
    },
    update(dt) {
      if (!rainbow) return;
      const o = rainbowMat.opacity;
      const k = 1 - Math.exp(-dt * 1.2);
      rainbowMat.opacity = o + (rainbowTarget - o) * k;
      if (rainbowTarget === 0 && rainbowMat.opacity < 0.01) rainbow.visible = false;
      if (spark.visible) {
        sparkTime -= dt;
        for (let i = 0; i < N; i++) {
          life[i] -= dt;
          if (life[i] <= 0) { pos[i * 3 + 1] = -100; continue; }
          vel[i * 3 + 1] -= 1.4 * dt;
          pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        if (sparkTime <= 0) spark.visible = false;
      }
    },
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose();
      trees.dispose(); bushes.dispose();
    },
  };
}

// 環境マップ（PMREM）。手続きの 256×128 正距円筒グラデから作る。コンテキスト復帰時にも呼ぶ。
export function makeEnvMap(renderer) {
  const src = canvasTexture(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#9fbcef'); gr.addColorStop(0.45, '#eef1ff'); gr.addColorStop(0.5, '#fff1df');
    gr.addColorStop(0.56, '#b9cf9a'); gr.addColorStop(1, '#5d6e4c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (const [x, y, r] of [[0.28, 0.25, 26], [0.72, 0.18, 18], [0.52, 0.38, 12]]) {
      const b = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r);
      b.addColorStop(0, 'rgba(255,255,250,1)'); b.addColorStop(1, 'rgba(255,255,250,0)');
      g.fillStyle = b; g.fillRect(0, 0, w, h);
    }
  });
  src.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromEquirectangular(src);
  pm.dispose(); src.dispose();
  return rt;
}

// ---------- 小さな形の道具
function hillBand(radius, baseY, height, seed, color, segs = 40, arc = Math.PI * 1.25) {
  const pos = [], col = [], uv = [], idx = [];
  const rows = 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = -arc / 2 + arc * t;
    const n = 0.55 + 0.25 * Math.sin(a * 3.1 + seed) + 0.15 * Math.sin(a * 7.3 + seed * 2.1) + 0.05 * Math.sin(a * 13 + seed);
    const topY = baseY + height * n;
    for (let r = 0; r < rows; r++) {
      const f = r / (rows - 1);
      const y = baseY - 0.5 + (topY - baseY + 0.5) * Math.pow(f, 0.8);
      const rr = radius + (1 - f) * 2.5; // 裾を少し手前に広げて丸みを出す
      pos.push(Math.sin(a) * rr, y, -Math.cos(a) * rr);
      const shade = 0.78 + 0.22 * f;
      col.push(color[0] * shade, color[1] * shade, color[2] * shade);
      uv.push(t, f);
    }
  }
  for (let i = 0; i < segs; i++) for (let r = 0; r < rows - 1; r++) {
    const a = i * rows + r, b = a + rows;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function scallopDisc(r, amp, waves, segs) {
  const pos = [0, 0, 0], uv = [0.5, 0.5], nrm = [0, 1, 0], idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2, rr = r + amp * Math.cos(a * waves);
    const x = Math.cos(a) * rr, z = -Math.sin(a) * rr;
    pos.push(x, 0, z); nrm.push(0, 1, 0); uv.push(0.5 + x / (2 * r), 0.5 - z / (2 * r));
    if (i > 0) idx.push(0, i, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// 同じ属性構成（position/normal/uv/color）の index 付き形をまとめる。
function mergeSimple(list) {
  const names = Object.keys(list[0].attributes);
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const size = list[0].attributes[n].itemSize;
    const arr = [];
    for (const g of list) arr.push(...g.attributes[n].array);
    out.setAttribute(n, new THREE.Float32BufferAttribute(arr, size));
  }
  const idx = []; let off = 0;
  for (const g of list) { for (const i of g.index.array) idx.push(i + off); off += g.attributes.position.count; g.dispose(); }
  out.setIndex(idx);
  return out;
}

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
