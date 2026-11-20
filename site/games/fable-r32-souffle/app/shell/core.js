// スフレ シェル: 共通（名前空間・ティア・エラー記録・テクスチャ・資源の数え上げ）
// file:// でも動くよう、シェルは ES モジュールにせず古典スクリプトで window.Souffle にぶら下げる。
(function (S) {
  'use strict';
  const params = new URLSearchParams(location.search);
  S.params = params;
  S.debug = params.get('debug') === '1';
  S.isFile = location.protocol === 'file:';

  // ---- エラー記録（debug 表示・煙テスト用） ----
  S.errors = [];
  function pushError(msg) {
    S.errors.push(String(msg).slice(0, 300));
    if (S.errors.length > 30) S.errors.shift();
  }
  S.pushError = pushError;
  window.addEventListener('error', (e) => pushError(e.message || (e.target && e.target.src ? 'load ' + e.target.src : 'error')), true);
  window.addEventListener('unhandledrejection', (e) => pushError('promise: ' + (e.reason && e.reason.message || e.reason)));
  const origErr = console.error.bind(console);
  console.error = function () { pushError([].map.call(arguments, String).join(' ')); origErr.apply(null, arguments); };

  // ---- モバイル判定とティア ----
  // iPad は Mac の UA を名乗るので maxTouchPoints で判定する。
  S.isMobile = (navigator.maxTouchPoints || 0) > 1 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const dpr = window.devicePixelRatio || 1;
  S.TIERS = {
    low:  { name: 'low',  pixelRatio: 0.8, anisotropy: 1, detail: 0.6, antialias: false },
    mid:  { name: 'mid',  pixelRatio: 1.0, anisotropy: 4, detail: 1.0, antialias: false },
    high: { name: 'high', pixelRatio: Math.min(dpr, 2), anisotropy: 8, detail: 1.0, antialias: false },
  };
  const forced = params.get('tier');
  S.tier = S.TIERS[forced] ? S.TIERS[forced] : (S.isMobile ? S.TIERS.mid : S.TIERS.high);
  if (S.isMobile && S.tier.pixelRatio > 1) S.tier.pixelRatio = 1; // モバイルは DPR 1.0 固定
  S.lowerTier = function () {
    if (S.tier.name === 'high') S.tier = S.TIERS.mid;
    else if (S.tier.name === 'mid') S.tier = S.TIERS.low;
    else return false;
    return true;
  };

  // ---- NaN 防止：three の組み込みシェーダーの normalize / pow を守る ----
  // 0 ベクトルの normalize（退化した三角形・微分が 0 の画素・光と視線が真逆）や負の底の pow は、
  // GPU によっては NaN になり、トーンマップを通って画面が黒く抜ける。描画結果はふつうの画素では変わらない。
  S.hardenShaders = function (THREE) {
    const C = THREE.ShaderChunk;
    if (!C || C.__souffleSafe) return;
    const SAFE = [
      '#ifndef SOUFFLE_SAFE_NORMALIZE',
      '#define SOUFFLE_SAFE_NORMALIZE',
      'vec3 safeNormalize( vec3 v ) { float l2 = dot( v, v ); return l2 > 1e-24 ? v * inversesqrt( l2 ) : vec3( 0.0, 0.0, 1.0 ); }',
      '#endif',
    ].join('\n');
    const miss = [];
    function patch(name, from, to, all) {
      const src = C[name];
      if (typeof src !== 'string' || src.indexOf(from) < 0) { miss.push(name); return; }
      C[name] = all ? src.split(from).join(to) : src.replace(from, to);
    }
    // common は全シェーダーの頭に入るので、ここに safeNormalize を置き、common 自身の normalize も守る
    C.common = SAFE + '\n' + C.common.split('normalize(').join('safeNormalize(');
    patch('normal_vertex', 'normalize( transformedNormal )', 'safeNormalize( transformedNormal )');
    patch('normal_fragment_begin', 'normalize( cross( fdx, fdy ) )', 'safeNormalize( cross( fdx, fdy ) )');
    patch('normal_fragment_begin', 'normalize( vNormal )', 'safeNormalize( vNormal )');
    patch('bumpmap_pars_fragment', 'normalize(', 'safeNormalize(', true);
    patch('lights_fragment_begin', 'normalize( vViewPosition )', 'safeNormalize( vViewPosition )');
    patch('lights_physical_pars_fragment', 'normalize(', 'safeNormalize(', true);
    patch('bsdfs', 'normalize( lightDir + viewDir )', 'safeNormalize( lightDir + viewDir )');
    patch('envmap_physical_pars_fragment', 'normalize(', 'safeNormalize(', true);
    // 色空間の変換（common より前に入る）：pow の底を 0 以上に
    patch('colorspace_pars_fragment', 'pow( value.rgb, vec3( 0.41666 ) )', 'pow( max( value.rgb, vec3( 0.0 ) ), vec3( 0.41666 ) )');
    patch('colorspace_pars_fragment', 'pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) )', 'pow( max( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 0.0 ) ), vec3( 2.4 ) )');
    // トーンマップの入口：負の色・無限大を切る
    patch('tonemapping_pars_fragment', 'vec3 ACESFilmicToneMapping( vec3 color ) {', 'vec3 ACESFilmicToneMapping( vec3 color ) {\n\tcolor = clamp( color, vec3( 0.0 ), vec3( 64.0 ) );');
    if (miss.length) pushError('hardenShaders: chunk not patched: ' + miss.join(', '));
    C.__souffleSafe = true;
    S.shaderPatchMisses = miss;
  };

  // NaN の見張り（debug）：hero と周辺の頂点・法線・行列に有限でない数がないか数える
  S.countNaN = function (roots) {
    let bad = 0;
    const seen = new Set();
    for (const root of roots) {
      root.traverse((o) => {
        const e = o.matrixWorld.elements;
        for (let i = 0; i < 16; i++) if (!Number.isFinite(e[i])) { bad++; break; }
        const g = o.geometry;
        if (!g || seen.has(g)) return;
        seen.add(g);
        for (const k of ['position', 'normal']) {
          const a = g.attributes[k];
          if (!a) continue;
          const arr = a.array;
          for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { bad++; break; }
        }
      });
    }
    return bad;
  };

  // ---- 古典スクリプトの動的読み込み（file:// 可） ----
  S.loadScript = function (src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('script load failed: ' + src));
      document.head.appendChild(s);
    });
  };

  // ---- テクスチャ ----
  // 名前 → ファイル（app/assets/）。平均色は画像が届くまでの仮の色。
  S.TEXTURE_FILES = {
    whipped_foam:    { file: 'whipped_foam_1024',    color: '#f3f0ea', owner: 'hero' },
    hammered_copper: { file: 'hammered_copper_1024', color: '#c7774f', owner: 'hero' },
    golden_crust:    { file: 'golden_crust_1024',    color: '#d59a3e', owner: 'hero' },
    ceramic_glaze:   { file: 'ceramic_glaze_512',    color: '#ecebe6', owner: 'hero' },
    wood_board:      { file: 'wood_board_512',       color: '#c98a45', owner: 'shell' },
  };

  S.createTextureStore = function (THREE, anisotropy) {
    const cache = new Map();
    function placeholder(color) {
      const c = document.createElement('canvas'); c.width = c.height = 4;
      const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 4, 4);
      return c;
    }
    function loadImage(file) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        // 描画のフレームで JPEG を展開しないよう、先に decode() してから渡す（iPad で 1024² 1 枚あたり 10ms 以上のつかえを避ける）
        img.onload = () => { (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => resolve(img)); };
        img.onerror = () => reject(new Error('image load failed: ' + file));
        if (S.isFile) {
          // file:// の Chrome は画像ファイルを WebGL に渡せない（別オリジン扱い）ので data URI 版を使う
          const key = file;
          const go = () => { img.src = window.SouffleTexData[key]; };
          if (window.SouffleTexData && window.SouffleTexData[key]) go();
          else S.loadScript('assets/' + file + '.jpg.js').then(go, reject);
        } else {
          img.src = 'assets/' + file + '.jpg';
        }
      });
    }
    function entry(name) {
      let e = cache.get(name);
      if (e) return e;
      const info = S.TEXTURE_FILES[name];
      if (!info) throw new Error('unknown texture: ' + name);
      const tex = new THREE.Texture(placeholder(info.color));
      tex.name = name;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = anisotropy;
      tex.needsUpdate = true;
      tex.userData.owner = info.owner;
      const promise = loadImage(info.file).then((img) => {
        tex.dispose();          // 仮の 4x4 から実寸へ（GPU 側を作り直す）
        tex.image = img;
        tex.needsUpdate = true;
        tex.userData.loaded = true;
        return tex;
      });
      promise.catch((err) => pushError(err.message));
      e = { tex, promise };
      cache.set(name, e);
      return e;
    }
    return {
      get: (name) => entry(name).tex,
      ready: (name) => entry(name).promise,
      all: () => Array.from(cache.values()).map((e) => e.tex),
      setAnisotropy(a) { cache.forEach((e) => { e.tex.anisotropy = a; e.tex.needsUpdate = e.tex.userData.loaded || false; }); },
    };
  };

  // ---- 資源の数え上げ（debug・PLAN の実測用） ----
  // 三角形：見えているメッシュのインデックス数/3 × インスタンス数（drawRange 考慮）。
  S.countTriangles = function (root) {
    let tris = 0, meshes = 0;
    root.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
      const dr = g.drawRange;
      const used = Math.max(0, Math.min(n, dr.count === Infinity ? n : dr.count) - (dr.start || 0));
      const inst = o.isInstancedMesh ? o.count : 1;
      tris += Math.floor(used / 3) * inst;
      meshes += 1;
    });
    return { tris, meshes };
  };

  function texBytes(t) {
    const img = t.image;
    if (!img) return 0;
    const w = img.width || 0, h = img.height || 0;
    if (t.isCubeTexture) return 0;
    const mip = (t.generateMipmaps !== false && t.minFilter !== 1006 && t.minFilter !== 1003) ? 4 / 3 : 1;
    return w * h * 4 * mip;
  }
  S.texBytes = texBytes;

  // 見積もり GPU メモリ：テクスチャ（ミップ込み）＋頂点・インデックス。textures は Set を返す。
  S.collectResources = function (root) {
    const textures = new Set(), geoms = new Set();
    root.traverse((o) => {
      if (o.geometry) geoms.add(o.geometry);
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const k in m) {
          const v = m[k];
          if (v && v.isTexture) textures.add(v);
        }
        if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture) textures.add(v); }
      }
    });
    let geoBytes = 0;
    geoms.forEach((g) => {
      for (const k in g.attributes) geoBytes += g.attributes[k].array.byteLength;
      if (g.index) geoBytes += g.index.array.byteLength;
    });
    let texB = 0;
    textures.forEach((t) => { texB += texBytes(t); });
    return { textures, texBytes: texB, geoBytes, geomCount: geoms.size };
  };

  S.MiB = (b) => (b / 1048576);
})(window.Souffle = window.Souffle || {});
