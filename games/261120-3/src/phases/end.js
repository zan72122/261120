// Phase 'end': the camera pulls back over the quiet table, a gentle music-box phrase plays, then the empty
// platter is carried away and a fresh round begins by itself (the loop is the replay button).
import * as THREE from 'three';
import { syncPlatter } from './common.js';

const T_MELODY = 7.6;
const T_TAP_OK = 3;
const T_SLIDE = 1.1;

const from = new THREE.Vector3();
const S = { t: 0, tapped: false, slide: -1 };

export default {
  id: 'end',

  enter(G) {
    S.t = 0;
    S.tapped = false;
    S.slide = -1;
    G.tools.dismiss();
    G.cam.focusOffset(null, 0);
    G.cam.frame('end', { dur: 3 });
    G.audio.setBrush(0);
    G.audio.setSqueeze(0);
    G.audio.setSizzle(0);
    G.audio.play('ending', { vol: 1, delay: 0.4 });
    for (const b of G.balls) b.heat = 0;
  },

  update(G, dt) {
    S.t += dt;
    const pl = G.world.props.platter;
    if (S.slide < 0) {
      syncPlatter(G);
      if (pl && pl.visible) G.world.setFocus(pl.position, 16, 0.7);
      if (S.t > T_MELODY || (S.tapped && S.t > T_TAP_OK)) {
        S.slide = 0;
        if (pl && pl.visible) {
          from.copy(pl.position);
          G.audio.play('slide', { vol: 0.7, pitch: 0.95 });
        }
      }
    } else {
      S.slide += dt / T_SLIDE;
      const k = Math.min(1, S.slide);
      if (pl && pl.visible) {
        pl.position.lerpVectors(from, G.layout.platterSlideFrom, k * k * k);
        if (k >= 1) pl.visible = false;
      }
      if (k >= 1) G.flow.complete();
    }
  },

  exit() {},
  onDown() {
    S.tapped = true;
  },
  onMove() {},
  onUp() {},
  fastForward() {},
  reset(G) {
    S.slide = -1;
    const pl = G.world.props.platter;
    if (pl) pl.visible = false;
  },
};
