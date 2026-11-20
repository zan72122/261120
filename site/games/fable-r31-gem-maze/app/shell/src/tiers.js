// ティア別の性能設定。iPad は Mac の UA を名乗るので maxTouchPoints で判定する。
export const TIERS = {
  // dpr は固定値。pixel 上限で更に絞る。
  mobile:  { dpr: 1.0, maxPixels: 1.45e6, antialias: true,  heroQuality: 'high', anisotropy: 2 },
  desktop: { dpr: 2.0, maxPixels: 1.6e6,  antialias: true,  heroQuality: 'high', anisotropy: 4 },
  low:     { dpr: 1.0, maxPixels: 0.9e6,  antialias: false, heroQuality: 'low',  anisotropy: 1 },
};

export function detectTier(params) {
  const mobile = (navigator.maxTouchPoints || 0) > 1;
  const forced = params.get('tier');
  const name = forced && TIERS[forced] ? forced : mobile ? 'mobile' : 'desktop';
  const t = { name, mobile, ...TIERS[name] };
  // モバイルは常に 1.0 固定。デスクトップは実機の dpr（最大2）。
  t.dpr = mobile || name !== 'desktop' ? 1.0 : Math.min(window.devicePixelRatio || 1, TIERS.desktop.dpr);
  t.pixelCap = t.maxPixels; // 自動降格で下げる値
  return t;
}

// 画面サイズと画素上限から実際の pixelRatio を決める。
export function pixelRatioFor(tier, cssW, cssH) {
  const area = Math.max(1, cssW * cssH);
  return Math.max(0.5, Math.min(tier.dpr, Math.sqrt(tier.pixelCap / area)));
}

// 自動降格：起動 4 秒後から、直近 3 秒の平均フレーム時間が 26ms を超えたら画素上限 ×0.7（下限 0.6M）。
export class AutoTier {
  constructor(tier) { this.tier = tier; this.t = 0; this.acc = 0; this.n = 0; this.cool = 0; this.downgrades = 0; }
  // 戻り値 true なら resize が必要
  sample(dtMs) {
    this.t += dtMs / 1000;
    if (this.t < 4) return false;
    this.acc += dtMs; this.n++;
    this.cool -= dtMs / 1000;
    if (this.acc < 3000) return false;
    const mean = this.acc / this.n; this.acc = 0; this.n = 0;
    if (mean > 26 && this.cool <= 0 && this.tier.pixelCap > 0.6e6) {
      this.tier.pixelCap = Math.max(0.6e6, this.tier.pixelCap * 0.7);
      this.downgrades++; this.cool = 3;
      return true;
    }
    return false;
  }
}
