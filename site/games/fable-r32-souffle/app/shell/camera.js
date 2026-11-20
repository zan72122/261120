// スフレ シェル: カメラの定位置と、ゆっくりした移動（急な回転・揺れ・ズームなし）
(function (S) {
  'use strict';
  S.VIEWS = {
    mixer: { position: [-0.30, 0.60, 0.74], target: [-0.30, 0.16, 0.00] },  // hero-notes の頼み：泡立てる前の液体がボウルの壁に隠れないよう少し高く
    pour:  { position: [-0.16, 0.46, 0.78], target: [-0.16, 0.10, 0.05] },
    counter: { position: [0.25, 0.52, 1.15], target: [0.26, 0.10, 0.00] },
    oven:  { position: [0.38, 0.40, 0.90],  target: [0.42, 0.14, 0.00] },
    serve: { position: [0.02, 0.34, 0.62],  target: [0.02, 0.07, 0.10] },
    wide:  { position: [0.06, 0.55, 1.35],  target: [0.06, 0.15, 0.00] },
  };
  const BASE_VFOV = 38, REF_ASPECT = 4 / 3, MAX_VFOV = 64, MOVE_TIME = 1.8;

  S.createCameraRig = function (THREE, camera) {
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    const fromP = new THREE.Vector3(), fromT = new THREE.Vector3(), toP = new THREE.Vector3(), toT = new THREE.Vector3();
    let t = 1, current = null, lastRef = null;

    function resolve(v) {
      if (!v) return S.VIEWS.mixer;
      if (typeof v === 'string') return S.VIEWS[v] || S.VIEWS.mixer;
      if (v.position && v.target) return v;
      return S.VIEWS.mixer;
    }
    function key(v) { return typeof v === 'string' ? v : JSON.stringify(v); }

    function fit(aspect) {
      // 縦長でも横幅が収まるよう視野角を広げる
      const hHalf = Math.atan(Math.tan(BASE_VFOV * Math.PI / 360) * REF_ASPECT);
      let v = 2 * Math.atan(Math.tan(hHalf) / aspect) * 180 / Math.PI;
      v = Math.max(BASE_VFOV, Math.min(MAX_VFOV, v));
      camera.fov = v; camera.aspect = aspect; camera.updateProjectionMatrix();
    }

    return {
      fit,
      // 即座に置く（起動・リセット）
      jump(view) {
        const v = resolve(view); current = key(view || 'mixer'); lastRef = view;
        pos.fromArray(v.position); tgt.fromArray(v.target); t = 1;
        camera.position.copy(pos); camera.lookAt(tgt);
      },
      // 1.8 秒かけて移る
      go(view) {
        // main は毎フレーム呼ぶ。同じ参照なら比べるまでもない（hero が返すオブジェクトの JSON 化を毎フレームしない）
        if (view === lastRef) return;
        lastRef = view;
        const k = key(view);
        if (k === current) return;
        current = k;
        const v = resolve(view);
        fromP.copy(pos); fromT.copy(tgt); toP.fromArray(v.position); toT.fromArray(v.target); t = 0;
      },
      update(dt) {
        if (t < 1) {
          t = Math.min(1, t + dt / MOVE_TIME);
          const e = t * t * t * (t * (t * 6 - 15) + 10); // smootherstep
          pos.lerpVectors(fromP, toP, e); tgt.lerpVectors(fromT, toT, e);
          camera.position.copy(pos); camera.lookAt(tgt);
        }
      },
      get moving() { return t < 1; },
      get name() { return current; },
    };
  };
})(window.Souffle = window.Souffle || {});
