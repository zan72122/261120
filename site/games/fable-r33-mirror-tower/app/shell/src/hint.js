// 合図：hero.getHint() の位置に光の輪と、「こう動かすよ」と指でなぞって見せる手（HERO-SPEC §8）。
// 手は 押す → ドラッグ方向へすーっと動く → 離す、をくり返す（タップ専用の操作部では、その場でトントン押す）。
// 文字を読めない子でも、止まったら「どこを・どう動かすか」が絵で分かるように。
import THREE from './three.js';

const CYCLE = 2.4;            // 手の動き1回の秒
const HAND_TIP = [0.4, 0.07]; // 手のテクスチャ内の指先（u, v：左上が 0,0）

export function createHintMarker({ scene, ringTexture, handTexture }) {
  const group = new THREE.Group();
  group.name = 'hint-marker';
  const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture, color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const handMat = new THREE.MeshBasicMaterial({ map: handTexture, color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const plane = new THREE.PlaneGeometry(1, 1);
  const ring = new THREE.Mesh(plane, ringMat);
  const hand = new THREE.Mesh(plane, handMat);
  ring.renderOrder = 1000; hand.renderOrder = 1001;
  ring.frustumCulled = hand.frustumCulled = false;
  group.add(ring, hand);
  group.visible = false;
  scene.add(group);

  let alpha = 0, t = 0, shownFor = 0;
  const right = new THREE.Vector3(), up = new THREE.Vector3(), pos = new THREE.Vector3(), dir = new THREE.Vector3();
  const lastHint = { position: new THREE.Vector3(), radius: 0.5, drag: 'x' };
  const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

  return {
    // want: 合図を出すべきか、hint: hero.getHint() の結果
    update(dt, camera, want, hint, level) {
      t += dt;
      if (hint) { lastHint.position.copy(hint.position); lastHint.radius = hint.radius || 0.5; lastHint.drag = hint.drag || 'x'; }
      const target = want && hint ? 1 : 0;
      if (target && alpha < 0.01) t = 0; // 出るたびに手の動きを最初から
      alpha += (target - alpha) * Math.min(1, dt * (target ? 4 : 6));
      shownFor = target ? shownFor + dt : 0;
      group.visible = alpha > 0.01;
      if (!group.visible) return false;
      const r = THREE.MathUtils.clamp(lastHint.radius, 0.3, 0.8);
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.8);
      ring.quaternion.copy(camera.quaternion);
      hand.quaternion.copy(camera.quaternion);
      ring.position.copy(lastHint.position);
      const s = r * 2.5 * (1 + 0.1 * pulse);
      ring.scale.set(s, s, 1);
      ringMat.opacity = alpha * Math.min(1, (0.6 + 0.3 * pulse) * (level >= 2 ? 1.15 : 1));

      // 手：押す(0〜0.15) → 動かす(0.15〜0.7) → 離す(0.7〜0.85) → 休み
      const c = (t % CYCLE) / CYCLE;
      const press = smooth(c / 0.15) * (1 - smooth((c - 0.7) / 0.15));
      let travel = 0, show = 1 - smooth((c - 0.78) / 0.12);
      if (lastHint.drag === 'x' || lastHint.drag === 'y') {
        travel = smooth((c - 0.15) / 0.55) * 2 - 1;      // −1 → +1
        dir.copy(lastHint.drag === 'x' ? right : up);
      } else {
        travel = 0; dir.set(0, 0, 0);
        show = 1;
      }
      const hs = r * 1.9 * (1 - 0.12 * press);
      pos.copy(lastHint.position).addScaledVector(dir, travel * r * 1.1);
      // 指先が pos に来るように、手の板をずらす（板の中心 → 指先 のぶん）
      pos.addScaledVector(right, (0.5 - HAND_TIP[0]) * hs).addScaledVector(up, -(0.5 - HAND_TIP[1]) * hs);
      hand.position.copy(pos);
      hand.scale.set(hs, hs, 1);
      handMat.opacity = alpha * show;
      return shownFor > 0 && shownFor - dt <= 0; // 出始めた瞬間
    },
    hide() { alpha = 0; group.visible = false; },
    dispose() { scene.remove(group); plane.dispose(); ringMat.dispose(); handMat.dispose(); },
  };
}
