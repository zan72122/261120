// 子どもが止まったときの「指の絵」と、触った所の波紋（DOM。文字なし）。

const HAND_SVG = `
<svg viewBox="0 0 64 72" width="64" height="72" aria-hidden="true">
  <g fill="#ffffff" stroke="#8a6aa8" stroke-width="2.6" stroke-linejoin="round">
    <ellipse cx="13" cy="44" rx="6" ry="11" transform="rotate(-28 13 44)"/>
    <rect x="15" y="30" width="36" height="34" rx="12"/>
    <rect x="15" y="3" width="12" height="40" rx="6"/>
    <circle cx="33" cy="33" r="6.5"/><circle cx="41" cy="34" r="6.5"/><circle cx="48" cy="37" r="5.5"/>
  </g>
</svg>`;
// 指先（SVG 内の 21,6）を point に合わせる
const TIP_X = 21, TIP_Y = 6;
// iPad の大きな画面でも目に入るように少し大きく（指先の位置は変わらない：transform-origin が指先）
const SCALE = 1.3;

export class HintFinger {
  constructor(container) {
    this.el = document.createElement('div');
    this.el.className = 'hint-finger';
    this.el.innerHTML = `<div class="hint-dot"></div>${HAND_SVG}`;
    container.appendChild(this.el);
    this.dot = this.el.querySelector('.hint-dot');
    this.visible = false; this.t = 0; this.alpha = 0;
  }

  // sx, sy: 触る場所（CSS px）。path: ドラッグの道すじ（画面の点の列、先頭が sx,sy。タップなら null）。
  update(dt, show, sx, sy, path) {
    this.alpha += ((show ? 1 : 0) - this.alpha) * (1 - Math.exp(-dt * 6));
    if (show) this.t += dt; else this.t = 0;
    if (this.alpha < 0.02 || !Number.isFinite(sx) || !Number.isFinite(sy)) {
      if (this.visible) { this.el.style.display = 'none'; this.visible = false; }
      return;
    }
    if (!this.visible) { this.el.style.display = 'block'; this.visible = true; }
    const CYCLE = 2.4, ph = this.t % CYCLE;
    let ox = 0, oy = 0, press = 0, fade = 1;
    if (path && path.length > 1) {
      // 押す(0-0.35) → 道すじをなぞる(0.35-1.45) → 離して消える(1.45-1.9) → 休む
      const m = smooth(clamp01((ph - 0.35) / 1.1));
      const p = along(path, m);
      ox = p.x - sx; oy = p.y - sy;
      press = ph < 0.35 ? ph / 0.35 : ph < 1.45 ? 1 : Math.max(0, 1 - (ph - 1.45) / 0.2);
      fade = ph < 1.45 ? 1 : Math.max(0, 1 - (ph - 1.45) / 0.45);
    } else {
      // タップを 2 回
      const k = ph < 0.4 ? ph / 0.4 : ph < 0.6 ? 1 - (ph - 0.4) / 0.2 : ph < 0.9 ? (ph - 0.6) / 0.3 : ph < 1.1 ? 1 - (ph - 0.9) / 0.2 : 0;
      press = clamp01(k);
      fade = ph < 1.6 ? 1 : Math.max(0, 1 - (ph - 1.6) / 0.4);
    }
    const s = SCALE * (1 - 0.12 * press);
    const x = sx + ox - TIP_X, y = sy + oy - TIP_Y + (1 - press) * -10;
    this.el.style.opacity = String(this.alpha * fade);
    this.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
    this.dot.style.opacity = String(press * 0.9);
  }
}

// 折れ線の長さの割合 f（0〜1）の点
function along(pts, f) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let d = f * total;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (d <= l || i === pts.length - 1) { const k = l > 1e-6 ? Math.min(1, d / l) : 1; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k }; }
    d -= l;
  }
  return pts[pts.length - 1];
}

export function ripple(container, x, y, strong) {
  const d = document.createElement('div');
  d.className = strong ? 'ripple strong' : 'ripple';
  d.style.left = x + 'px'; d.style.top = y + 'px';
  container.appendChild(d);
  setTimeout(() => d.remove(), 700);
}

function clamp01(v) { return Math.min(1, Math.max(0, v)); }
function smooth(t) { return t * t * (3 - 2 * t); }
