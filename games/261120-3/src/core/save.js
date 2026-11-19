// Persistent game state in localStorage. Never throws; writes are throttled (>= 0.5 s apart).
import { PHASES, BALL_COUNT } from '../config.js';

const KEY = 'takopa-261120-3';
const VERSION = 1;
const MIN_GAP = 500; // ms

export function freshState() {
  return { round: 0, phase: 0, fillings: new Array(BALL_COUNT).fill(null) };
}

function valid(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  if (!Number.isInteger(s.round) || s.round < 0 || s.round > 1e6) return false;
  if (!Number.isInteger(s.phase) || s.phase < 0 || s.phase >= PHASES.length) return false;
  if (s.fillings != null && (!Array.isArray(s.fillings) || s.fillings.length !== BALL_COUNT)) return false;
  return true;
}

export function createSave() {
  let last = -1e9;
  let pending = null;
  let timer = 0;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
    if (!pending) return;
    const s = pending;
    pending = null;
    last = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, s }));
    } catch (e) {
      /* storage blocked / full: ignore */
    }
  }

  return {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o || o.v !== VERSION || !valid(o.s)) return null;
        const s = Object.assign(freshState(), o.s);
        if (!Array.isArray(s.fillings)) s.fillings = freshState().fillings;
        return s;
      } catch (e) {
        return null;
      }
    },
    store(state) {
      try {
        pending = state;
        const gap = Date.now() - last;
        if (gap >= MIN_GAP) flush();
        else if (!timer) timer = setTimeout(flush, MIN_GAP - gap);
      } catch (e) {
        /* ignore */
      }
    },
    flush() {
      try {
        flush();
      } catch (e) {
        /* ignore */
      }
    },
    clear() {
      pending = null;
      try {
        localStorage.removeItem(KEY);
      } catch (e) {
        /* ignore */
      }
    },
  };
}
