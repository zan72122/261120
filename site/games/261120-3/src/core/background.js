// Background work queue: generator jobs run a few milliseconds per frame while the game is already playing.
// A job is a generator; every `yield` is a point where it may be paused, `yield 'frame'` also ends this
// frame's slice (used after work whose real cost lands later, e.g. a texture upload on the next render).
export function createBackground() {
  const queue = [];
  let cur = null;
  let warned = false;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  return {
    // lower `prio` runs first (stable among equal priorities)
    add(job, prio = 5) {
      const it = typeof job === 'function' ? job() : job;
      if (!it || typeof it.next !== 'function') return;
      let i = queue.length;
      while (i > 0 && queue[i - 1].prio > prio) i--;
      queue.splice(i, 0, { it, prio });
    },
    get pending() {
      return (cur ? 1 : 0) + queue.length;
    },
    // run queued jobs for about `budgetMs`; returns the time actually spent
    run(budgetMs) {
      const t0 = now();
      while (now() - t0 < budgetMs) {
        if (!cur) {
          const q = queue.shift();
          if (!q) break;
          cur = q.it;
        }
        let r;
        try {
          r = cur.next();
        } catch (e) {
          if (!warned) {
            warned = true;
            console.warn('[background] job failed:', e);
          }
          r = { done: true };
        }
        if (r.done) cur = null;
        else if (r.value === 'frame') break;
      }
      return now() - t0;
    },
  };
}
