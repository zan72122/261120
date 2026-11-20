// モバイル判定とティア別設定。iPad は Mac の UA を名乗るので maxTouchPoints で判定する。
export const TIERS = {
  high: { dprCap: 1.5, maxPixels: 2.6e6, scale: 1.0, trees: true },
  mid:  { dprCap: 1.0, maxPixels: 1.6e6, scale: 1.0, trees: true },
  low:  { dprCap: 1.0, maxPixels: 0.9e6, scale: 0.75, trees: false },
};
export const TIER_ORDER = ['high', 'mid', 'low'];

export function detectTier(params) {
  const isMobile = (navigator.maxTouchPoints || 0) > 1;
  let tier = isMobile ? 'mid' : 'high';
  const q = params.get('tier');
  if (q && TIERS[q]) tier = q;
  return { isMobile, tier, forced: !!(q && TIERS[q]) };
}

// モバイルは DPR 1.0 固定（low はさらに 0.75 倍）。上限ピクセル数を超えたら縮める。
export function pixelRatioFor(tier, isMobile, cssW, cssH) {
  const t = TIERS[tier];
  let dpr = isMobile ? 1.0 : Math.min(window.devicePixelRatio || 1, t.dprCap);
  dpr *= t.scale;
  const px = Math.max(1, cssW * cssH * dpr * dpr);
  if (px > t.maxPixels) dpr *= Math.sqrt(t.maxPixels / px);
  return Math.max(0.25, dpr);
}

// 平均 fps が低い状態が続いたら1段下げる（上げはしない）。
export function createTierGovernor(initialTier, onChange, { enabled = true } = {}) {
  let tier = initialTier;
  let t = 0, winT = 0, winFrames = 0, lastChange = -1e9;
  return {
    get tier() { return tier; },
    frame(dt) {
      t += dt;
      if (!enabled || t < 3) return;
      winT += dt; winFrames++;
      if (winT >= 4) {
        const fps = winFrames / winT;
        winT = 0; winFrames = 0;
        const i = TIER_ORDER.indexOf(tier);
        if (fps < 40 && i < TIER_ORDER.length - 1 && t - lastChange > 6) {
          tier = TIER_ORDER[i + 1];
          lastChange = t;
          onChange(tier, fps);
        }
      }
    },
  };
}
