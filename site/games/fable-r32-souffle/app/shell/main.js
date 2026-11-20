// スフレ シェル: 起動・ループ・hero の読み込みと橋渡し・コンテキスト喪失・ティア自動降格
(function (S) {
  'use strict';
  const THREE = window.THREE;
  // 時刻はすべてページの読み込み開始（navigation start）から。three.min.js の読み込み・解釈も含む
  const marks = { shell: Math.round(performance.now()) };
  S.bootMarks = marks;
  const canvas = document.getElementById('view');
  const bootEl = document.getElementById('boot');

  let renderer, scene, camera, rig, store, blob, envRT, env, inputSys, hint, debugUI;
  let hero = null, lost = false, time = 0, last = 0, heroErrors = 0;
  let completeTimer = -1, lowFps = 0, tierCheck = 0, nanCount = 0, nanCheck = 0, stageTouched = false, precompilePending = false;
  const frame = S.createFrameStats();
  const eventQueue = [];

  function makeRenderer() {
    S.hardenShaders(THREE);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: S.tier.antialias, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(S.tier.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0xf6e7d2, 1);
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    rig.fit(w / Math.max(1, h));
  }

  async function loadHeroFactory() {
    // http(s) では hero.js を ES モジュールとしてそのまま、file:// では束ねた hero.bundle.js を使う
    if (!S.isFile && S.params.get('bundle') !== '1') {
      try {
        const m = await import(new URL('hero/hero.js', document.baseURI).href);
        if (typeof m.createHero === 'function') { S.heroSource = 'module'; return m.createHero; }
      } catch (e) { console.warn('hero module import failed, falling back to bundle', e); }
    }
    await S.loadScript('hero/hero.bundle.js');
    S.heroSource = 'bundle';
    if (!window.SouffleHero || typeof window.SouffleHero.createHero !== 'function') throw new Error('hero.bundle.js has no createHero');
    return window.SouffleHero.createHero;
  }

  const STAGES = ['whisk', 'pour', 'load', 'close', 'bake', 'open', 'wobble', 'scoop', 'finale'];
  function validateHero(h) {
    const need = ['root', 'targets', 'loops', 'update', 'reset', 'dispose', 'onContextRestored', 'getState'];
    need.forEach((k) => { if (h[k] == null) S.pushError('hero API missing: ' + k); });
    if (h.stages && h.stages.join() !== STAGES.join()) S.pushError('hero.stages differs from HERO-SPEC');
    (h.targets || []).forEach((t) => { if (!t.object || !t.pivot || !t.kind || !t.id) S.pushError('hero target incomplete: ' + t.id); });
  }

  function onHeroEvent(ev) {
    if (!ev || !ev.type) return;
    if (!rig || !env) { eventQueue.push(ev); return; }
    switch (ev.type) {
      case 'stage':
        rig.go(ev.view || (hero && hero.view) || 'mixer');
        inputSys.resetIdle();
        stageTouched = false;
        break;
      case 'stageDone':
        S.playSound('chime');
        env.chick.hop(2);
        break;
      case 'sound':
        S.playSound(ev.name, ev.gain, ev.pitch);
        break;
      case 'complete':
        S.playSound('fanfare');
        env.chick.celebrate();
        env.spawnConfetti(new THREE.Vector3(0.06, 0.1, 0.0));
        completeTimer = 2.5;
        break;
      default:
        break;
    }
  }

  function activeTarget() {
    if (!hero || !hero.activeTargetId) return null;
    for (const t of hero.targets) if (t.id === hero.activeTargetId && t.enabled) return t;
    return null;
  }

  function replay() {
    if (!hero) return;
    env.clearConfetti();
    completeTimer = -1;
    hero.reset();
    inputSys.resetIdle();
    S.playSound('whoosh');
  }

  function restoreAfterContextLoss() {
    // three は自分のリスナーで内部状態を作り直す（テクスチャ・頂点は次の描画で再転送）。
    // 中身が消える RenderTarget（環境マップ）はここで作り直す。ゲームの状態はそのまま。
    // 古い envRT の GL 資源は喪失とともに消えている。dispose すると古い文脈の物を消そうとして警告が出るので、参照を捨てるだけ。
    envRT = S.makeEnvMap(THREE, renderer, envSize());
    scene.environment = envRT.texture;
    frame.reset(); lowFps = 0;
    try { hero && hero.onContextRestored(); } catch (e) { S.pushError('hero.onContextRestored: ' + e.message); }
    lost = false;
    S.contextRestores = (S.contextRestores || 0) + 1;
  }

  function heroTexOwner(t) { return (t.userData && t.userData.owner) || 'hero'; }

  function getStats() {
    const info = renderer.info;
    const hc = hero ? S.countTriangles(hero.root) : { tris: 0 };
    const ec = S.countTriangles(env.group);
    const hr = hero ? S.collectResources(hero.root) : { textures: new Set(), texBytes: 0, geoBytes: 0 };
    const er = S.collectResources(env.group);
    const all = new Set([...hr.textures, ...er.textures]);
    let heroTex = 0, envTex = 0, sharedTex = 0, texB = 0;
    all.forEach((t) => {
      const o = heroTexOwner(t);
      const inHero = hr.textures.has(t);
      if (o === 'shared') sharedTex++; else if (o === 'shell' || !inHero) envTex++; else heroTex++;
      texB += S.texBytes(t);
    });
    const envMapB = envRT ? envRT.width * envRT.height * 6 * 8 * 4 / 3 : 0; // キューブ 6 面 × HalfFloat RGBA × ミップ
    const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
    const fbB = size.x * size.y * (4 * 2 + 4); // 色（表・裏）＋深度24/ステンシル8
    const geoB = hr.geoBytes + er.geoBytes;
    return {
      tier: S.tier.name, mobile: S.isMobile, pixelRatio: renderer.getPixelRatio(),
      canvasW: size.x, canvasH: size.y,
      fpsAvg: frame.avgFps(), fpsP95: frame.p95Fps(),
      calls: info.render.calls, tris: info.render.triangles,
      heroTris: hc.tris, envTris: ec.tris,
      glTextures: info.memory.textures, glGeometries: info.memory.geometries,
      heroTex, envTex, sharedTex,
      heroTexMiB: S.MiB(hr.texBytes), heroGeoMiB: S.MiB(hr.geoBytes),
      texMiB: S.MiB(texB), geoMiB: S.MiB(geoB), fbMiB: S.MiB(fbB), envMiB: S.MiB(envMapB),
      gpuMiB: S.MiB(texB + geoB + fbB + envMapB),
      stage: hero ? hero.stage : '-', progress: hero ? +hero.progress || 0 : 0,
      idle: inputSys ? inputSys.input.idle : 0,
      heroState: hero ? safeJSON(hero.getState()) : '-',
      heroSource: S.heroSource, readyMs: S.readyMs, firstFrameMs: marks.firstFrame,
      programs: info.programs ? info.programs.length : 0,
      nan: nanCount, ctxLost: S.contextLosses || 0, ctxRestored: S.contextRestores || 0,
    };
  }
  function safeJSON(o) {
    try { return JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)); } catch (e) { return '?'; }
  }

  function tick(now) {
    requestAnimationFrame(tick);
    const raw = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    if (lost) return;
    const dt = Math.min(0.05, Math.max(0, raw));
    time += dt;
    frame.push(raw * 1000);

    const input = inputSys.input;
    inputSys.begin(dt, time);
    if (hero) {
      try { hero.update(dt, input); }
      catch (e) { if (heroErrors++ < 5) S.pushError('hero.update: ' + (e && e.stack || e)); }
    }
    inputSys.end();
    if (hero) {
      S.audioLoops(hero.loops);
      rig.go(hero.view);
    }
    rig.update(dt);
    const at = activeTarget();
    const look = at ? at.pivot.getWorldPosition(tmpLook) : null;
    env.update(dt, { lookAt: look });
    if (input.isDown) stageTouched = true;
    hint.update(dt, at, input.idle, rig.moving, !stageTouched);
    if (completeTimer > 0) { completeTimer -= dt; if (completeTimer <= 0) hint.showReplay(); }
    renderer.render(scene, camera);
    if (precompilePending && time > 0.25 && !input.isDown) {
      precompilePending = false;
      // 並列コンパイルの拡張があれば裏で、なければその場で（three の警告を出さないため自分で分ける）
      try {
        if (renderer.extensions.has('KHR_parallel_shader_compile')) renderer.compileAsync(scene, camera).then(() => { marks.precompiled = Math.round(performance.now()); }, () => {});
        else { renderer.compile(scene, camera); marks.precompiled = Math.round(performance.now()); }
      }
      catch (e) { S.pushError('precompile: ' + e.message); }
    }

    // ティア自動降格：平均 fps < 40 が 5 秒続いたら1段下げる
    tierCheck += raw;
    if (tierCheck >= 1) {
      if (frame.count >= 60 && frame.avgFps() < 40 && !document.hidden) lowFps += tierCheck; else lowFps = 0;
      tierCheck = 0;
      if (lowFps >= 5 && S.params.get('tier') == null && S.lowerTier()) {
        renderer.setPixelRatio(S.tier.pixelRatio); onResize(); store.setAnisotropy(S.tier.anisotropy);
        lowFps = 0; frame.reset();
      }
    }
    if (debugUI) {
      // NaN の見張り（2 秒ごと、debug のときだけ）
      nanCheck += raw;
      if (nanCheck > 2) { nanCheck = 0; nanCount = S.countNaN(hero ? [hero.root, env.group, camera] : [env.group, camera]); }
      debugUI.update(raw);
    }
  }
  const tmpLook = new THREE.Vector3();

  async function boot() {
    makeRenderer();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6e7d2);
    camera = new THREE.PerspectiveCamera(38, 1, 0.02, 80);
    rig = S.createCameraRig(THREE, camera);
    rig.fit(window.innerWidth / Math.max(1, window.innerHeight));
    rig.jump('mixer');

    store = S.createTextureStore(THREE, S.tier.anisotropy);
    // hero の起動時テクスチャを、hero のスクリプトを読むのと並行して先に取りに行く（golden_crust は hero が後で読む）
    ['whipped_foam', 'hammered_copper', 'ceramic_glaze'].forEach((n) => store.get(n));
    const heroFactory = loadHeroFactory();
    blob = S.makeBlobTexture(THREE);
    const shared = { blob, wood: store.get('wood_board') };
    envRT = S.makeEnvMap(THREE, renderer, envSize());
    marks.env = Math.round(performance.now());
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.75;

    env = S.buildEnvironment(THREE, store, shared);
    scene.add(env.group);
    marks.scene = Math.round(performance.now());

    inputSys = S.createInput(THREE, canvas, camera, () => (hero ? hero.targets : []), () => S.audioUnlock());
    hint = S.createHint(document.getElementById('hand'), document.getElementById('replay'), replay);

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; inputSys.cancel(); S.contextLosses = (S.contextLosses || 0) + 1; }, false);
    canvas.addEventListener('webglcontextrestored', restoreAfterContextLoss, false);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
    document.addEventListener('visibilitychange', () => S.audioSuspend(document.hidden));

    const createHero = await heroFactory;
    marks.heroLoaded = Math.round(performance.now());
    hero = createHero(THREE, {
      tier: S.tier.name,
      quality: { detail: S.tier.detail, anisotropy: S.tier.anisotropy, triBudget: 50000, drawCallBudget: 40, maxTextures: 4, maxTextureSize: 1024 },
      textures: { get: (n) => { check(n); return store.get(n); }, ready: (n) => { check(n); return store.ready(n); } },
      shared,
      addons: window.THREE_ADDONS,
      camera,
      onEvent: onHeroEvent,
      debug: S.debug,
    });
    marks.heroBuilt = Math.round(performance.now());
    validateHero(hero);
    scene.add(hero.root);
    while (eventQueue.length) onHeroEvent(eventQueue.shift());
    rig.jump(hero.view || 'mixer');

    renderer.render(scene, camera);
    marks.firstFrame = Math.round(performance.now());
    marks.programsFirst = renderer.info.programs ? renderer.info.programs.length : 0;
    S.readyMs = marks.firstFrame;                       // ここから触れる（ページの読み込み開始から）
    bootEl.remove();
    // 画面の外にある部品（オーブンの中・スプーンなど）のシェーダーを、最初の絵を出した後に裏で用意しておく。
    // 段階が変わってカメラが動いたときに、初めて見える材質のコンパイルでつかえないように。
    // compile は見えない物（visible=false：紙ふぶき・スプーンなど）の材質も含めて全部を見る。指が触れていない時に 1 回だけ（tick から）。
    precompilePending = !!renderer.compileAsync;
    if (S.debug) {
      debugUI = S.createDebugOverlay(getStats, {
        'lose ctx': () => api.loseContext(1200),
        'skip': () => hero.debugSkip && hero.debugSkip(),
        'reset': replay,
      });
    }
    requestAnimationFrame(tick);
  }
  // 環境マップ（PMREM キューブ・HalfFloat・ミップ込み）の一辺。low は 128（1.0 MiB）、それ以外は 256（4.0 MiB）
  function envSize() { return S.tier.name === 'low' ? 128 : 256; }
  function check(n) { if (!S.TEXTURE_FILES[n] || S.TEXTURE_FILES[n].owner !== 'hero') S.pushError('hero asked for non-hero texture: ' + n); }

  // 煙テスト・デバッグ用の窓口
  const api = {
    get ready() { return !!hero && S.readyMs != null; },
    get readyMs() { return S.readyMs; },
    get stage() { return hero ? hero.stage : null; },
    get stageIndex() { return hero ? hero.stageIndex : -1; },
    get cameraMoving() { return rig ? rig.moving : true; },
    get replayShown() { return hint ? hint.replayShown : false; },
    get errors() { return S.errors.slice(); },
    get contextRestores() { return S.contextRestores || 0; },
    get heroSource() { return S.heroSource; },
    activeTarget() {
      const t = activeTarget();
      if (!t) return null;
      const s = S.pivotScreen(t), r = canvas.getBoundingClientRect();
      return { id: t.id, kind: t.kind, gesture: t.gesture, x: s.x + r.left, y: s.y + r.top };
    },
    stats: () => getStats(),
    get bootMarks() { return Object.assign({}, marks); },
    skip() { if (hero && hero.debugSkip) hero.debugSkip(); },
    programs: () => (renderer.info.programs || []).map((p) => (p.type || p.name) + ' ' + String(p.cacheKey).slice(0, 40) + ' #' + p.usedTimes),
    state: () => (hero ? hero.getState() : null),
    loseContext(ms) {
      renderer.forceContextLoss();
      setTimeout(() => renderer.forceContextRestore(), ms || 800);
    },
  };
  window.__souffle = api;

  boot().catch((e) => {
    S.pushError('boot: ' + (e && e.stack || e));
    if (bootEl) bootEl.style.borderTopColor = '#c33';
  });
})(window.Souffle = window.Souffle || {});
