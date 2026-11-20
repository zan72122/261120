// スフレ シェル: 周辺の場面（作業台・壁・窓・遠景・棚・ひよこ・紙ふぶき）、ライト、環境マップ、疑似影
// すべて低ポリ。遠景は板ポリゴンと頂点色、手続きの Canvas テクスチャ（512² 以下）。
(function (S) {
  'use strict';

  function canvasTex(THREE, w, h, draw, opts) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (opts && opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = (opts && opts.anisotropy) || 1;
    return t;
  }

  // 疑似影（全員で共有）
  S.makeBlobTexture = function (THREE) {
    const t = canvasTex(THREE, 64, 64, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.45, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
    t.colorSpace = THREE.NoColorSpace;
    t.name = 'blob';
    t.userData.owner = 'shared';
    return t;
  };
  S.makeBlob = function (THREE, tex, w, d, opacity) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, color: 0x3a2410, transparent: true, opacity: opacity == null ? 0.45 : opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.0015; m.renderOrder = -1;
    return m;
  };

  // 環境マップ（PMREM）：暖かい部屋＋明るい窓。金属・陶器の映り込み用。
  S.makeEnvMap = function (THREE, renderer, size) {
    const env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 24, 12);
    const col = [], pos = geo.attributes.position;
    const top = new THREE.Color(1.25, 1.18, 1.08), wall = new THREE.Color(0.82, 0.72, 0.6), floor = new THREE.Color(0.35, 0.22, 0.12), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      if (y > 0) c.copy(wall).lerp(top, Math.min(1, y * 1.6)); else c.copy(wall).lerp(floor, Math.min(1, -y * 2.2));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const room = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    env.add(room);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 3.6) }));
    win.position.set(-2, 1.5, -8); env.add(win);
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.5) }));
    lamp.position.set(1, 8, 2); lamp.rotation.x = Math.PI / 2; env.add(lamp);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.02, 0.1, 50, { size: size || 256 });
    pm.dispose();
    geo.dispose(); room.material.dispose(); win.geometry.dispose(); win.material.dispose(); lamp.geometry.dispose(); lamp.material.dispose();
    rt.texture.name = 'env';
    rt.texture.userData.owner = 'shared';
    return rt;
  };

  // ---- 周辺の場面 ----
  S.buildEnvironment = function (THREE, store, shared) {
    const A = window.THREE_ADDONS;
    const group = new THREE.Group(); group.name = 'shell-environment';
    const owned = []; // dispose 用（geometry / material / texture）
    const own = (x) => { owned.push(x); return x; };

    // 光
    const hemi = new THREE.HemisphereLight(0xfff3e2, 0x9a7656, 1.15);
    const sun = new THREE.DirectionalLight(0xfff0dc, 2.1);
    sun.position.set(-1.3, 2.2, 1.7);
    group.add(hemi, sun, sun.target);

    // 木（共有テクスチャ）
    const wood = shared.wood;

    // 作業台：天板（木）＋ 戸棚
    const topMat = own(new THREE.MeshLambertMaterial({ map: wood, color: 0xffffff }));
    const topGeo = own(new THREE.BoxGeometry(2.3, 0.045, 0.84));
    // 天板の木目の繰り返し（UV を直接スケール。テクスチャは共有なので repeat は触らない）
    { const uv = topGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.6, uv.getY(i) * 1.0); }
    const top = new THREE.Mesh(topGeo, topMat); top.position.set(0, -0.0225, 0); group.add(top);

    const cabParts = [];
    const cab = new THREE.BoxGeometry(2.3, 0.86, 0.78); cab.translate(0, -0.475, -0.02); cabParts.push(colorize(cab, 0xa9d8c4));
    for (let i = 0; i < 4; i++) {
      const p = new THREE.BoxGeometry(0.5, 0.36, 0.02); p.translate(-0.84 + i * 0.56, -0.5, 0.375); cabParts.push(colorize(p, 0xc3e6d6));
      const d = new THREE.BoxGeometry(0.5, 0.14, 0.02); d.translate(-0.84 + i * 0.56, -0.17, 0.375); cabParts.push(colorize(d, 0xc3e6d6));
      const k = new THREE.SphereGeometry(0.018, 8, 6); k.translate(-0.84 + i * 0.56, -0.17, 0.395); cabParts.push(colorize(k, 0xf2c14e));
    }
    const kick = new THREE.BoxGeometry(2.3, 0.07, 0.7); kick.translate(0, -0.87, -0.05); cabParts.push(colorize(kick, 0x6f8f80));
    // 床（戸棚と同じメッシュに結合。動かない物は頂点色の 1 つの材質にまとめ、シェーダーの種類と draw call を減らす）
    const floorG = new THREE.PlaneGeometry(5, 3); floorG.rotateX(-Math.PI / 2); floorG.translate(0, -0.905, 0.6); cabParts.push(colorize(floorG, 0xd9b48a));
    const cabGeo = own(A.mergeGeometries(cabParts.map(flat)));
    cabParts.forEach((g) => g.dispose());
    const vcMat = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
    group.add(new THREE.Mesh(cabGeo, vcMat));

    // 奥の壁（タイル）と窓の穴
    const tiles = own(canvasTex(THREE, 512, 512, (g, w) => {
      g.fillStyle = '#e9dccb'; g.fillRect(0, 0, w, w);
      const n = 4, s = w / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = 244 - ((x * 7 + y * 13) % 5) * 3;
        g.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
        g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
        const gr = g.createLinearGradient(x * s, y * s, x * s + s, y * s + s);
        gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,.04)');
        g.fillStyle = gr; g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
      }
    }, { repeat: true }));
    tiles.name = 'wall_tiles'; tiles.userData.owner = 'shell';
    const WIN = { x0: -0.98, x1: -0.06, y0: 0.14, y1: 0.80 };
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-2.3, -0.02); wallShape.lineTo(2.3, -0.02); wallShape.lineTo(2.3, 1.7); wallShape.lineTo(-2.3, 1.7); wallShape.lineTo(-2.3, -0.02);
    const hole = new THREE.Path();
    hole.moveTo(WIN.x0, WIN.y0); hole.lineTo(WIN.x0, WIN.y1); hole.lineTo(WIN.x1, WIN.y1); hole.lineTo(WIN.x1, WIN.y0); hole.lineTo(WIN.x0, WIN.y0);
    wallShape.holes.push(hole);
    const wallGeo = own(new THREE.ShapeGeometry(wallShape));
    { const uv = wallGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 0.44, uv.getY(i) / 0.44); }
    const wall = new THREE.Mesh(wallGeo, own(new THREE.MeshLambertMaterial({ map: tiles })));
    wall.position.z = -0.42; group.add(wall);

    // 窓枠（白い木）・桟・窓台
    const frameParts = [];
    const fw = 0.045, fz = -0.42;
    const box = (w, h, d, x, y, z, color) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); frameParts.push(colorize(b, color)); };
    const cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
    box(ww + fw * 2, fw, 0.08, cx, WIN.y1 + fw / 2, fz, 0xfbf6ee);
    box(ww + fw * 2 + 0.08, 0.03, 0.16, cx, WIN.y0 - 0.0, fz + 0.03, 0xfbf6ee);
    box(fw, wh, 0.08, WIN.x0 - fw / 2, cy, fz, 0xfbf6ee);
    box(fw, wh, 0.08, WIN.x1 + fw / 2, cy, fz, 0xfbf6ee);
    box(0.022, wh, 0.03, cx, cy, fz - 0.03, 0xfbf6ee);
    box(ww, 0.022, 0.03, cx, cy, fz - 0.03, 0xfbf6ee);
    // 棚（右の壁）と支え
    box(0.95, 0.025, 0.13, 0.66, 0.47, -0.355, 0xd7a46a);
    box(0.02, 0.08, 0.1, 0.26, 0.42, -0.37, 0xb98552);
    box(0.02, 0.08, 0.1, 1.06, 0.42, -0.37, 0xb98552);
    // 鉢植え（窓台の左）
    const pot = new THREE.CylinderGeometry(0.045, 0.034, 0.07, 10); pot.translate(-0.88, WIN.y0 + 0.05, -0.39); frameParts.push(colorize(pot, 0xe0805a));
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.IcosahedronGeometry(0.035, 0); leaf.scale(0.7, 1.3, 0.7);
      const a = i * 1.26; leaf.translate(-0.88 + Math.cos(a) * 0.025, WIN.y0 + 0.13 + (i % 2) * 0.03, -0.39 + Math.sin(a) * 0.02);
      frameParts.push(colorize(leaf, i % 2 ? 0x6fbf5a : 0x58a84a));
    }
    // カーテン（ゆるいひだの板。手前からしか見えないので片面で、窓枠と同じメッシュに結合）
    for (const x of [WIN.x0 + 0.04, WIN.x1 - 0.04]) {
      const c = new THREE.PlaneGeometry(0.22, 0.74, 10, 1);
      const p = c.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 60) * 0.012);
      c.computeVertexNormals(); c.translate(x, cy + 0.03, -0.37); frameParts.push(colorize(c, 0xf6b8c8));
    }
    // 棚のびん（動かないので、形と色を焼き込んで窓枠と同じメッシュに結合）
    const jarCols = [0xfff1c9, 0xf9d6a2, 0xe9f3ff, 0xffe3ec, 0xf6e7b0, 0xe6f7e4, 0xfde0c4];
    const lidCols = [0xe06666, 0x6aa9d8, 0xf2c14e, 0x7bc47f, 0xd98ad3, 0xe08e4a, 0x6aa9d8];
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < 7; i++) {
      const s = 0.8 + ((i * 37) % 5) * 0.08;
      m4.makeScale(s, s * (0.9 + (i % 3) * 0.15), s).setPosition(0.28 + i * 0.12, 0.4825, -0.355);
      const jar = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12); jar.translate(0, 0.06, 0); jar.applyMatrix4(m4); frameParts.push(colorize(jar, jarCols[i]));
      const lid = new THREE.CylinderGeometry(0.043, 0.043, 0.025, 12); lid.translate(0, 0.13, 0); lid.applyMatrix4(m4); frameParts.push(colorize(lid, lidCols[i]));
    }
    const frameGeo = own(A.mergeGeometries(frameParts.map(flat)));
    frameParts.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(frameGeo, vcMat));

    // ---- 窓の外（遠景） ----
    const outside = new THREE.Group(); outside.name = 'outside'; group.add(outside);
    // 空：頂点色のグラデーション（テクスチャなし）
    const skyGeo = own(new THREE.SphereGeometry(40, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2 + 0.2));
    { const p = skyGeo.attributes.position, c = [], lo = new THREE.Color(0xeaf6ff), hi = new THREE.Color(0x86c4ef), k = new THREE.Color();
      for (let i = 0; i < p.count; i++) { k.copy(lo).lerp(hi, Math.max(0, Math.min(1, p.getY(i) / 22))); c.push(k.r, k.g, k.b); }
      skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); }
    const sky = new THREE.Mesh(skyGeo, own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false })));
    sky.position.set(-0.5, -1.2, -2); sky.renderOrder = -10; outside.add(sky);
    // 遠い山（Canvas の絵を円弧の板に）
    const landscape = own(canvasTex(THREE, 512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const ridge = (base, amp, f, ph, c1, c2) => {
        const gr = g.createLinearGradient(0, base - amp, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 4) g.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(x * f + ph) * Math.cos(x * f * 0.37 + ph * 2)));
        g.lineTo(w, h); g.closePath(); g.fill();
      };
      ridge(150, 90, 0.018, 0.5, '#b9cfe6', '#d6e4ef');
      ridge(185, 70, 0.027, 2.0, '#9fc0a8', '#bcd6bf');
      // 雪のない柔らかい山の上に小さな雲
      g.fillStyle = 'rgba(255,255,255,.9)';
      [[80, 40, 26], [110, 34, 20], [360, 52, 30], [395, 46, 22], [430, 55, 18]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    }));
    landscape.name = 'landscape'; landscape.userData.owner = 'shell';
    const bandGeo = own(new THREE.CylinderGeometry(14, 14, 7, 24, 1, true, Math.PI * 0.75, Math.PI * 0.5));
    const band = new THREE.Mesh(bandGeo, own(new THREE.MeshBasicMaterial({ map: landscape, side: THREE.BackSide, alphaTest: 0.5, fog: false })));
    band.position.set(-0.5, 1.6, -1); outside.add(band);
    // 近い丘：低ポリの地面（頂点色、フラット）。木・幹と 1 つのメッシュに結合し、面の法線は頂点に持たせる（flatShading の別シェーダーを使わない）
    const farParts = [];
    const hillGeo = new THREE.PlaneGeometry(26, 12, 36, 14);
    hillGeo.rotateX(-Math.PI / 2);
    { const p = hillGeo.attributes.position, c = [], g1 = new THREE.Color(0x8fcf72), g2 = new THREE.Color(0x5fae5a), k = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const far = Math.max(0, (-z + 6) / 12);
        const y = far * (1.2 + 0.9 * Math.sin(x * 0.45 + 1) + 0.5 * Math.sin(x * 1.1 - z * 0.7)) + 0.05 * Math.sin(x * 5.3 + z * 3.1);
        p.setY(i, y);
        k.copy(g1).lerp(g2, Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(x * 0.9 + z * 1.3))));
        c.push(k.r, k.g, k.b);
      }
      hillGeo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      hillGeo.translate(-0.5, -0.45, -6.4); farParts.push(hillGeo); }
    // 木（円すい＋幹）
    const N_TREE = 18;
    for (let i = 0; i < N_TREE; i++) {
      const x = -4.5 + (i * 2.37) % 9 + Math.sin(i * 3.1) * 0.3, z = -2.8 - (i * 1.71) % 5.5;
      const far = Math.max(0, (-(z + 6.4) + 6) / 12);
      const y = -0.45 + far * (1.2 + 0.9 * Math.sin((x + 0.5) * 0.45 + 1) + 0.5 * Math.sin((x + 0.5) * 1.1 - (z + 6.4) * 0.7));
      const s = 0.8 + (i % 4) * 0.18;
      m4.makeScale(s, s, s).setPosition(x, y, z);
      const top = new THREE.ConeGeometry(0.28, 0.75, 7); top.translate(0, 0.62, 0); top.applyMatrix4(m4);
      farParts.push(colorize(top, i % 3 === 0 ? 0x3f8f4a : i % 3 === 1 ? 0x4ea152 : 0x6bb85a));
      const tr = new THREE.CylinderGeometry(0.05, 0.06, 0.3, 5); tr.translate(0, 0.15, 0); tr.applyMatrix4(m4); farParts.push(colorize(tr, 0x8a5a36));
    }
    const farGeo = own(A.mergeGeometries(farParts.map(faceted)));
    farParts.forEach((g) => g.dispose());
    outside.add(new THREE.Mesh(farGeo, vcMat));
    // 雲（つぶした多面体を結合。emissive は uniform なので vcMat と同じシェーダーで済む）
    const cloudParts = [];
    const cloudPos = [[-3, 3.2, -9, 1.4], [-2.2, 3.4, -9.3, 1.0], [0.5, 2.6, -8, 1.1], [1.3, 2.5, -8.2, 0.8], [3.5, 3.6, -10, 1.5], [-5, 2.8, -8, 0.9]];
    cloudPos.forEach(([x, y, z, s]) => { const g = new THREE.IcosahedronGeometry(0.6, 1); g.applyMatrix4(m4.makeScale(s * 1.6, s * 0.6, s).setPosition(x, y, z)); cloudParts.push(colorize(g, 0xffffff)); });
    const cloudGeo = own(A.mergeGeometries(cloudParts.map(faceted)));
    cloudParts.forEach((g) => g.dispose());
    outside.add(new THREE.Mesh(cloudGeo, own(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x9aa8b8 }))));

    // ---- ひよこ（見守り役。段階を終えると跳ねる） ----
    const chick = buildChick(THREE, A, own, shared.blob);
    chick.root.position.set(-0.74, 0, 0.18);
    chick.root.rotation.y = 0.5;
    group.add(chick.root);

    // ---- 紙ふぶき（完成時だけ作り、終わったら dispose） ----
    const N_CONF = 140;
    const confMesh = new THREE.InstancedMesh(own(new THREE.PlaneGeometry(0.018, 0.026)), own(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })), N_CONF);
    { const pal = [0xff7aa2, 0xffd166, 0x6ccff6, 0x9be36d, 0xc59bff, 0xff9f5a]; for (let i = 0; i < N_CONF; i++) confMesh.setColorAt(i, col.set(pal[i % pal.length])); }
    confMesh.frustumCulled = false; confMesh.visible = false;
    group.add(confMesh);
    const confParts = [];
    for (let i = 0; i < N_CONF; i++) confParts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: 0, ph: 0 });
    let confetti = null;
    function spawnConfetti(center) {
      for (const o of confParts) {
        o.p.set(center.x + (Math.random() - 0.5) * 0.9, center.y + 0.5 + Math.random() * 0.5, center.z + (Math.random() - 0.5) * 0.5);
        o.v.set((Math.random() - 0.5) * 0.3, -0.15 - Math.random() * 0.2, (Math.random() - 0.5) * 0.2);
        o.r.set(Math.random() * 6, Math.random() * 6, 0); o.w = 2 + Math.random() * 6; o.ph = Math.random() * 6;
      }
      confMesh.visible = true;
      confetti = { mesh: confMesh, parts: confParts, t: 0, q: new THREE.Quaternion() };
    }
    function clearConfetti() {
      confMesh.visible = false;
      confetti = null;
    }
    const tmpM = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    function updateConfetti(dt) {
      if (!confetti) return;
      confetti.t += dt;
      const P = confetti.parts;
      for (let i = 0; i < P.length; i++) {
        const o = P[i];
        o.p.addScaledVector(o.v, dt);
        o.p.x += Math.sin(confetti.t * 2 + o.ph) * 0.05 * dt;
        if (o.p.y < 0.005) { o.p.y = 0.005; o.v.set(0, 0, 0); }
        else { o.r.x += o.w * dt; o.r.y += o.w * 0.7 * dt; }
        confetti.q.setFromEuler(o.r);
        tmpM.compose(o.p, confetti.q, one);
        confetti.mesh.setMatrixAt(i, tmpM);
      }
      confetti.mesh.instanceMatrix.needsUpdate = true;
      if (confetti.t > 9) clearConfetti();
    }

    return {
      group,
      chick,
      spawnConfetti,
      clearConfetti,
      update(dt, ctx) { chick.update(dt, ctx); updateConfetti(dt); },
      dispose() {
        clearConfetti();
        owned.forEach((x) => x.dispose && x.dispose());
        confMesh.dispose();
      },
    };
  };

  function flat(g) { return g.index ? g.toNonIndexed() : g; }
  // 面ごとの法線（flatShading の代わり。別のシェーダーにならない）
  function faceted(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
  function colorize(geo, hex) {
    const n = geo.attributes.position.count, c = new Float32Array(n * 3);
    const col = new (window.THREE.Color)(hex);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new window.THREE.BufferAttribute(c, 3));
    return geo;
  }

  // ひよこ：体（＋羽・足）と頭（＋くちばし・目・ほっぺ）を、それぞれ1つに結合した低ポリ
  function buildChick(THREE, A, own, blobTex) {
    const root = new THREE.Group(); root.name = 'chick';
    const hop = new THREE.Group(); root.add(hop);
    const bodyParts = [];
    const body = new THREE.SphereGeometry(0.05, 16, 12); body.scale(1, 0.92, 1.05); body.translate(0, 0.048, 0); bodyParts.push(colorize(body, 0xffd84d));
    const wingL = new THREE.SphereGeometry(0.022, 10, 8); wingL.scale(0.45, 1, 1.3); wingL.translate(-0.048, 0.05, -0.004); bodyParts.push(colorize(wingL, 0xffc93c));
    const wingR = wingL.clone(); wingR.translate(0.096, 0, 0); bodyParts.push(wingR);
    const footL = new THREE.BoxGeometry(0.016, 0.006, 0.024); footL.translate(-0.018, 0.003, 0.03); bodyParts.push(colorize(footL, 0xf08a24));
    const footR = footL.clone(); footR.translate(0.036, 0, 0); bodyParts.push(footR);
    const bodyGeo = own(A.mergeGeometries(bodyParts.map(flat)));
    bodyParts.forEach((g) => g.dispose());
    const mat = own(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const bodyMesh = new THREE.Mesh(bodyGeo, mat); hop.add(bodyMesh);
    const head = new THREE.Group(); head.position.set(0, 0.105, 0.004); hop.add(head);
    const headParts = [];
    const hs = new THREE.SphereGeometry(0.036, 16, 12); headParts.push(colorize(hs, 0xffdc5a));
    const beak = new THREE.ConeGeometry(0.009, 0.02, 8); beak.rotateX(Math.PI / 2); beak.translate(0, -0.004, 0.039); headParts.push(colorize(beak, 0xf28b22));
    const eyeL = new THREE.SphereGeometry(0.0055, 8, 6); eyeL.translate(-0.014, 0.008, 0.032); headParts.push(colorize(eyeL, 0x2a1a10));
    const eyeR = eyeL.clone(); eyeR.translate(0.028, 0, 0); headParts.push(eyeR);
    const chL = new THREE.SphereGeometry(0.007, 8, 6); chL.scale(1, 0.6, 0.4); chL.translate(-0.024, -0.008, 0.027); headParts.push(colorize(chL, 0xff9db0));
    const chR = chL.clone(); chR.translate(0.048, 0, 0); headParts.push(chR);
    const tuft = new THREE.ConeGeometry(0.006, 0.02, 6); tuft.rotateZ(0.3); tuft.translate(-0.003, 0.04, 0); headParts.push(colorize(tuft, 0xffc93c));
    const headGeo = own(A.mergeGeometries(headParts.map(flat)));
    headParts.forEach((g) => g.dispose());
    head.add(new THREE.Mesh(headGeo, mat));
    const blob = S.makeBlob(THREE, blobTex, 0.14, 0.12, 0.4);
    own(blob.geometry); own(blob.material);
    root.add(blob);

    let t = 0, hopT = -1, hops = 0, spin = 0;
    const tmp = new THREE.Vector3();
    return {
      root,
      hop(n) { hops = Math.max(hops, n || 1); if (hopT < 0) hopT = 0; },
      celebrate() { hops = 4; hopT = 0; spin = 1; },
      update(dt, ctx) {
        t += dt;
        // 息をする
        const br = 1 + Math.sin(t * 2.4) * 0.018;
        bodyMesh.scale.set(br, 1 / br, br);
        // 跳ねる（放物線＋つぶれ・伸び）
        let y = 0, sq = 1;
        if (hopT >= 0) {
          hopT += dt;
          const D = 0.42, k = hopT / D;
          if (k >= 1) { hops -= 1; hopT = hops > 0 ? 0 : -1; if (hops <= 0) spin = 0; }
          else { y = 4 * k * (1 - k) * 0.06; sq = k < 0.12 ? 1 - (0.12 - k) * 1.5 : 1 + Math.sin(k * Math.PI) * 0.12; }
          if (spin && k < 1) hop.rotation.y += dt * 9;
        } else {
          hop.rotation.y *= Math.max(0, 1 - dt * 4);
        }
        hop.position.y = y; hop.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
        // 頭を、いま触ってほしい部品のほうへゆっくり向ける
        if (ctx && ctx.lookAt) {
          tmp.copy(ctx.lookAt); root.worldToLocal(tmp);
          const yaw = Math.atan2(tmp.x, tmp.z);
          head.rotation.y += (Math.max(-0.9, Math.min(0.9, yaw)) - head.rotation.y) * Math.min(1, dt * 2.5);
        }
        head.rotation.z = Math.sin(t * 1.3) * 0.08;
      },
    };
  }
})(window.Souffle = window.Souffle || {});
