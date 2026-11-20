// 材質。テクスチャは hero 枠の 4 枚（foam・copper・ceramic・crust）だけ。Canvas テクスチャは作らない。
//  - hard  : ほうろう・鋼・真鍮・鉄を 1 つのシェーダーで（頂点ごとの色と metalness/roughness/emissive 強さ）。
//            同じ動きをする部品を、材質が違っても 1 回の描画にまとめるため。
//  - food  : 生地・スフレ。泡の細かさ（foam の繰り返し）・模様の濃さ・焼き色・断面を uniform で連続的に変える。
// シェーダーの追加部分は pow・normalize を使わない（NaN 防止）。

export function createMaterials(THREE, opts, own, P) {
  const T = opts.textures;
  const foamTex = T.get('whipped_foam');
  const copperTex = T.get('hammered_copper');
  const ceramicTex = T.get('ceramic_glaze');

  // ---- 硬い物 ----
  function hard(extra) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, metalness: 1, roughness: 1 }, extra || {}));
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aMRE;\nvarying vec3 vMRE;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMRE = aMRE;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMRE;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp( roughnessFactor * vMRE.y, 0.05, 1.0 );')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = clamp( metalnessFactor * vMRE.x, 0.0, 1.0 );')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vMRE.z;');
    };
    m.customProgramCacheKey = () => 'souffle-hard';
    return own(m);
  }

  // ---- 食べ物 ----
  // U は { value } の入れ物（同じ材質を使うメッシュで共有）。kind: 'batter' | 'souffle'
  function food(kind, U) {
    const m = new THREE.MeshStandardMaterial({ map: foamTex, bumpMap: foamTex, bumpScale: 0, color: 0xffffff, roughness: 0.5, metalness: 0 });
    const souffle = kind === 'souffle';
    if (souffle) m.defines = Object.assign({}, m.defines, { SOUFFLE: '' });
    m.userData.U = U;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform float uRep;',
          '#ifdef SOUFFLE',
          'attribute float aTop;',
          'varying float vTop;',
          'varying vec3 vObj;',
          'varying vec2 vCrustUv;',
          'uniform vec2 uBake;',
          '#endif',
        ].join('\n'))
        .replace('#include <uv_vertex>', [
          '#include <uv_vertex>',
          '#ifdef USE_MAP',
          '  vMapUv = vMapUv * uRep;',
          '#endif',
          '#ifdef USE_BUMPMAP',
          '  vBumpMapUv = vMapUv;',
          '#endif',
          '#ifdef SOUFFLE',
          '  vTop = aTop; vObj = position; vCrustUv = uv;',
          '  #ifdef USE_BUMPMAP',
          '    vBumpMapUv = mix( vMapUv, vCrustUv, uBake.y );',
          '  #endif',
          '#endif',
        ].join('\n'));
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform vec2 uFoam;',       // x = 泡の模様の濃さ（0=なめらかな液体）、y = 明るさ
          '#ifdef SOUFFLE',
          'uniform sampler2D uCrust;',
          'uniform vec2 uBake;',       // x = 焼き色の進み、y = バンプを crust に切り替え
          'uniform vec3 uCrustTint;',
          'uniform vec4 uScoop;',      // xyz = すくった跡の球の中心（ローカル）、w = 半径（0 で無効）
          'uniform vec3 uInside;',     // x = 断面の模様の繰り返し、y = 断面の濃さ（0..1）
          'uniform vec3 uInsideTint;',
          'varying float vTop;',
          'varying vec3 vObj;',
          'varying vec2 vCrustUv;',
          '#endif',
        ].join('\n'))
        .replace('#include <map_fragment>', [
          '#ifdef USE_MAP',
          '  vec3 fTex = texture2D( map, vMapUv ).rgb;',
          '  vec3 fCol = diffuseColor.rgb * mix( vec3( 1.0 ), clamp( fTex * uFoam.y, 0.0, 1.0 ), uFoam.x );',
          '  #ifdef SOUFFLE',
          '    vec3 cTex = texture2D( uCrust, vCrustUv ).rgb;',
          '    float cLum = dot( cTex, vec3( 0.3333 ) );',
          '    float bm = uBake.x * ( 0.30 + 0.95 * vTop ) + ( cLum - 0.5 ) * 0.4 * uBake.x;',
          '    bm = smoothstep( 0.12, 0.80, clamp( bm, 0.0, 1.0 ) );',
          '    fCol = mix( fCol, cTex * uCrustTint, bm );',
          '    float ins = ( 1.0 - smoothstep( uScoop.w * 1.02, uScoop.w * 1.10 + 1e-5, distance( vObj, uScoop.xyz ) ) ) * uInside.y;',
          '    vec3 iTex = texture2D( map, vObj.xz * uInside.x + vObj.y * vec2( 0.61, 0.37 ) * uInside.x ).rgb;',
          '    fCol = mix( fCol, iTex * uInsideTint, ins );',
          '  #endif',
          '  diffuseColor.rgb = fCol;',
          '#endif',
        ].join('\n'));
    };
    m.customProgramCacheKey = () => 'souffle-food-' + kind;
    return own(m);
  }

  const col = P.col;
  // 生地（ボウルの表面・流れ・泡立て器についた泡）
  const batterU = { uRep: { value: P.batter.rep0 }, uFoam: { value: new THREE.Vector2(0, 1.0) } };
  const batter = food('batter', batterU);
  batter.vertexColors = true;                        // 表面の谷を少し暗くして起伏を見せる（頂点色）
  // スフレ（ココットの中の生地 → ドーム）
  const souffleU = {
    uRep: { value: (P.batter.rep0 + P.batter.rep1) * (2 * P.ramekin.Ri / P.batter.uvSize) },
    uFoam: { value: new THREE.Vector2(1, 1.0) },
    uCrust: { value: foamTex },                       // golden_crust は pour 段階で読み込んでから差し替える
    uBake: { value: new THREE.Vector2(0, 0) },
    uCrustTint: { value: new THREE.Color(1.08, 1.0, 0.92) },
    uScoop: { value: new THREE.Vector4(0, 0, 0, 0) },
    uInside: { value: new THREE.Vector3(P.souffle.insideRep, 0, 0) },
    uInsideTint: { value: new THREE.Color(col.inside) },
  };
  const souffle = food('souffle', souffleU);
  // スプーンの上のひとすくい（断面と同じ気泡の模様）
  const scoopU = { uRep: { value: 2.6 }, uFoam: { value: new THREE.Vector2(1, 1.04) } };
  const scoop = food('batter', scoopU);
  scoop.color.set(col.inside); scoop.roughness = 0.9; scoop.bumpScale = 0.6;

  const copper = own(new THREE.MeshStandardMaterial({ map: copperTex, bumpMap: copperTex, bumpScale: 0.9, color: 0xffffff, metalness: 1.0, roughness: 0.24 }));
  const ceramic = own(new THREE.MeshStandardMaterial({ map: ceramicTex, color: 0xffffff, metalness: 0.0, roughness: 0.16 }));
  const wood = () => own(new THREE.MeshStandardMaterial({ map: opts.shared.wood, color: 0xffe9cf, metalness: 0, roughness: 0.55 }));
  // 扉の窓ガラス：うすい色つきの板（中が見える）。透過はこの 1 枚だけ。
  const glass = own(new THREE.MeshStandardMaterial({ color: 0x4a3222, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.16, depthWrite: false, emissive: col.heat, emissiveIntensity: 0 }));
  const blob = own(new THREE.MeshBasicMaterial({ map: opts.shared.blob, color: 0x3a2410, transparent: true, opacity: 0.42, depthWrite: false }));
  const hit = own(new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }));

  return {
    foamTex, copperTex, ceramicTex,
    hard, wood, batter, batterU, souffle, souffleU, scoop, scoopU, copper, ceramic, glass, blob, hit,
    setCrust(tex) { souffleU.uCrust.value = tex; souffle.crustMap = tex; }, // crustMap は数え上げ用（debug のテクスチャ集計に載せる）
  };
}
