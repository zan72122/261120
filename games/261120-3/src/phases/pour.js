// PLACEHOLDER phase 'pour' — replaced by the stage-2 phase author.
import { canon } from './common.js';
export default {
  id: 'pour',
  enter(G) {
    this.t = 0;
  },
  update(G, dt) {
    this.t += dt;
    if (this.t > 1.5) G.flow.complete();
  },
  exit() {},
  onDown() {},
  onMove() {},
  onUp() {},
  fastForward(G) {
    canon.poured(G);
  },
  reset() {},
};
