// Phase runner. Every phase call is guarded so one phase bug cannot stop the game.
import { RIM_Y } from '../config.js';
import { freshState } from './save.js';

const GRACE = 0.6;

export function createFlow(G, phases) {
  const warned = new Set();

  function call(ph, fn, ...args) {
    const f = ph && ph[fn];
    if (typeof f !== 'function') return undefined;
    try {
      return f.call(ph, G, ...args);
    } catch (e) {
      const k = (ph.id || '?') + '.' + fn;
      if (!warned.has(k)) {
        warned.add(k);
        console.warn('[flow] ' + k + ' failed:', e);
      }
      return undefined;
    }
  }

  function safe(fn) {
    try {
      fn();
    } catch (e) {
      if (!warned.has('sys')) {
        warned.add('sys');
        console.warn('[flow] reset step failed:', e);
      }
    }
  }

  const flow = {
    phases,
    index: -1,
    id: null,
    current: null,
    completed: false, // complete() was called for the running phase
    grace: 0,
    call,

    complete() {
      if (!flow.current || flow.completed) return;
      flow.completed = true;
      flow.grace = GRACE;
    },

    // enter phase i (no exit of the previous one: use advance() for that)
    enter(i) {
      i = Math.max(0, Math.min(phases.length - 1, i | 0));
      flow.index = i;
      flow.current = phases[i];
      flow.id = flow.current.id;
      flow.completed = false;
      flow.grace = 0;
      if (G.input) G.input.planeY = RIM_Y + 1;
      if (G.hints) safe(() => G.hints.clear());
      G.state.phase = i;
      G.save.store(G.state);
      call(flow.current, 'enter');
    },

    // reset every phase + balls/bits (new round or failed restore)
    resetAll() {
      for (const ph of phases) call(ph, 'reset');
      safe(() => G.tako && G.tako.resetAll && G.tako.resetAll());
      safe(() => G.bits && G.bits.clear && G.bits.clear());
      if (G.hints) safe(() => G.hints.clear());
    },

    advance() {
      const ph = flow.current;
      call(ph, 'exit');
      if (flow.index >= phases.length - 1) {
        G.state.round = (G.state.round | 0) + 1;
        flow.resetAll();
        flow.enter(0);
      } else {
        flow.enter(flow.index + 1);
      }
    },

    // start at checkpoint `index`: fast-forward every earlier phase, then enter it
    start(index) {
      index = index | 0;
      try {
        for (let i = 0; i < index; i++) {
          const f = phases[i].fastForward;
          if (typeof f === 'function') f.call(phases[i], G); // unguarded: errors abort the restore
        }
        flow.enter(index);
      } catch (e) {
        console.warn('[flow] restore failed, starting fresh:', e);
        const round = G.state && Number.isInteger(G.state.round) ? G.state.round : 0;
        Object.keys(G.state).forEach((k) => delete G.state[k]);
        Object.assign(G.state, freshState(), { round });
        flow.resetAll();
        flow.enter(0);
      }
    },

    update(dt) {
      if (!flow.current) return;
      call(flow.current, 'update', dt);
      if (flow.completed) {
        flow.grace -= dt;
        if (flow.grace <= 0) flow.advance();
      }
    },

    dispatch(name, p) {
      if (flow.current) call(flow.current, name, p);
    },
  };
  return flow;
}
