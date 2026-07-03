/**
 * Arsenal-weighted matchup logic (pure functions — unit tested).
 *
 * Data contract: public/data/arsenal_matchup_{year}.json written by
 * models/arsenal_matchup.py. Counts per (batter × pitcher-hand × pitch-type):
 *   n pitches, sw swings, wf whiffs, cs called strikes, oz out-of-zone,
 *   ozsw chases, k2 two-strike pitches, pa putaways.
 * Each batter cell is shrunk toward the LEAGUE rate for that (hand, pitch
 * type) with the exported prior strengths, then combined with the pitcher's
 * usage weights vs the batter's side — "he throws his splitter 26% to lefties,
 * so a lefty's splitter numbers get 26% of the weight."
 */
import { shrinkRate, shrinkVariance, type CredibleRate } from './credible';

export type BoardMetric = 'csw' | 'swstr' | 'whiff' | 'chase' | 'putaway';
export const BOARD_METRICS: BoardMetric[] = ['csw', 'swstr', 'whiff', 'chase', 'putaway'];
export const METRIC_LABEL: Record<BoardMetric, string> = {
  csw: 'CSW%', swstr: 'SwStr%', whiff: 'Whiff%', chase: 'Chase%', putaway: 'PutAway%',
};

export interface ArsenalCounts {
  n: number; sw: number; wf: number; cs: number;
  oz: number; ozsw: number; k2: number; pa: number;
  zones?: Record<string, [number, number]>;  // zone → [csw, n]
}
export interface PitcherPitchType {
  n: number;
  usage: number;
  zones: Record<string, number>;             // zone → pitches
}
export interface ArsenalPitcher {
  name: string; hand: string; team: string;
  vsL: Record<string, PitcherPitchType>;
  vsR: Record<string, PitcherPitchType>;
}
export interface ArsenalBatter {
  name: string; hand: string; team: string;
  vsL: Record<string, ArsenalCounts>;
  vsR: Record<string, ArsenalCounts>;
}
export interface ArsenalLeague {
  vsL: Record<string, ArsenalCounts>;
  vsR: Record<string, ArsenalCounts>;
  prior_n: Record<BoardMetric, number>;
}
export interface ArsenalDoc {
  league: ArsenalLeague;
  pitchers: Record<string, ArsenalPitcher>;
  batters: Record<string, ArsenalBatter>;
}

export const ZONES_INNER = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ZONES_OUTER = [11, 12, 13, 14];

/** numerator / denominator counts for one metric from one cell */
export function metricCounts(c: ArsenalCounts, m: BoardMetric): { x: number; n: number } {
  switch (m) {
    case 'csw':     return { x: c.cs + c.wf, n: c.n };
    case 'swstr':   return { x: c.wf, n: c.n };
    case 'whiff':   return { x: c.wf, n: c.sw };
    case 'chase':   return { x: c.ozsw, n: c.oz };
    case 'putaway': return { x: c.pa, n: c.k2 };
  }
}

export function leagueRate(league: ArsenalLeague, side: 'vsL' | 'vsR', pt: string, m: BoardMetric): number | null {
  const cell = league[side][pt];
  if (!cell) return null;
  const { x, n } = metricCounts(cell, m);
  return n > 0 ? x / n : null;
}

export interface WeightedPart {
  pt: string;
  usage: number;
  rate: CredibleRate | null;   // shrunk batter rate vs this pitch type
  league: number | null;
}
export interface WeightedMetric {
  rate: number;      // usage-weighted shrunk rate
  lo: number;        // 90% CI propagated through the weights
  hi: number;
  league: number;    // same weights applied to league rates (color baseline)
  effN: number;      // usage-weighted batter sample size
  coverage: number;  // Σ usage over pitch types the batter has data for
  parts: WeightedPart[];
}

/**
 * The core computation: pitcher's usage vs the batter's side × batter's
 * (shrunk) splits vs each pitch type. `ptFilter` restricts to one pitch type
 * (the interactive "click a pitch" mode) — weights renormalize automatically.
 */
export function weightedMetric(
  pitcher: ArsenalPitcher,
  batter: ArsenalBatter,
  league: ArsenalLeague,
  m: BoardMetric,
  ptFilter?: string | null,
): WeightedMetric | null {
  const sideP = `vs${batter.hand === 'L' ? 'L' : 'R'}` as 'vsL' | 'vsR';   // pitcher vs batter side
  const sideB = `vs${pitcher.hand === 'L' ? 'L' : 'R'}` as 'vsL' | 'vsR';  // batter vs pitcher hand
  const priorN = league.prior_n[m] ?? 50;

  let wSum = 0, acc = 0, varAcc = 0, lgAcc = 0, lgW = 0, effN = 0, usageTotal = 0;
  const parts: WeightedPart[] = [];

  for (const [pt, ppt] of Object.entries(pitcher[sideP])) {
    if (ptFilter && pt !== ptFilter) continue;
    if (ppt.usage < 0.03 && !ptFilter) continue;      // ignore show-me pitches
    usageTotal += ppt.usage;
    const lg = leagueRate(league, sideB, pt, m);
    if (lg != null) { lgAcc += ppt.usage * lg; lgW += ppt.usage; }

    const cell = batter[sideB][pt];
    if (!cell) { parts.push({ pt, usage: ppt.usage, rate: null, league: lg }); continue; }
    const { x, n } = metricCounts(cell, m);
    if (n === 0 || lg == null) { parts.push({ pt, usage: ppt.usage, rate: null, league: lg }); continue; }

    const sr = shrinkRate(x, n, lg, priorN);
    parts.push({ pt, usage: ppt.usage, rate: sr, league: lg });
    acc += ppt.usage * sr.rate;
    varAcc += ppt.usage * ppt.usage * shrinkVariance(x, n, lg, priorN);
    wSum += ppt.usage;
    effN += ppt.usage * n;
  }

  if (wSum === 0 || lgW === 0) return null;
  const rate = acc / wSum;
  const sd = Math.sqrt(varAcc) / wSum;
  return {
    rate,
    lo: Math.max(0, rate - 1.645 * sd),
    hi: Math.min(1, rate + 1.645 * sd),
    league: lgAcc / lgW,
    effN: Math.round(effN),
    coverage: usageTotal > 0 ? wSum / usageTotal : 0,
    parts: parts.sort((a, b) => b.usage - a.usage),
  };
}

/** Arsenal-weighted per-zone CSW for the "city map" (zone → shrunk rate + n). */
export function weightedZones(
  pitcher: ArsenalPitcher,
  batter: ArsenalBatter,
  league: ArsenalLeague,
  ptFilter?: string | null,
): Record<number, { rate: number; league: number; n: number }> {
  const sideP = `vs${batter.hand === 'L' ? 'L' : 'R'}` as 'vsL' | 'vsR';
  const sideB = `vs${pitcher.hand === 'L' ? 'L' : 'R'}` as 'vsL' | 'vsR';
  const priorN = (league.prior_n.csw ?? 100) / 2;   // zone cells are sparse — lighter prior

  const out: Record<number, { acc: number; w: number; lgAcc: number; lgW: number; n: number }> = {};
  for (const z of [...ZONES_INNER, ...ZONES_OUTER]) out[z] = { acc: 0, w: 0, lgAcc: 0, lgW: 0, n: 0 };

  for (const [pt, ppt] of Object.entries(pitcher[sideP])) {
    if (ptFilter && pt !== ptFilter) continue;
    if (ppt.usage < 0.03 && !ptFilter) continue;
    const lgCell = league[sideB][pt];
    const bCell = batter[sideB][pt];
    for (const z of [...ZONES_INNER, ...ZONES_OUTER]) {
      const lgZ = lgCell?.zones?.[String(z)];
      if (!lgZ || lgZ[1] === 0) continue;
      const lgRate = lgZ[0] / lgZ[1];
      const bZ = bCell?.zones?.[String(z)];
      // batter zone cell shrunk toward the league zone rate; absent → league
      const rate = bZ ? shrinkRate(bZ[0], bZ[1], lgRate, priorN).rate : lgRate;
      const cell = out[z]!;
      cell.acc += ppt.usage * rate;
      cell.w += ppt.usage;
      cell.lgAcc += ppt.usage * lgRate;
      cell.lgW += ppt.usage;
      cell.n += bZ ? bZ[1] : 0;
    }
  }

  const res: Record<number, { rate: number; league: number; n: number }> = {};
  for (const z of [...ZONES_INNER, ...ZONES_OUTER]) {
    const c = out[z]!;
    if (c.w > 0 && c.lgW > 0) res[z] = { rate: c.acc / c.w, league: c.lgAcc / c.lgW, n: c.n };
  }
  return res;
}

// ── Diverging heat scale (validated: dataviz ordinal checks, dark surface) ──
// Emerald arm = pitcher advantage, rose arm = hitter advantage, neutral mid.
const EMERALD = ['#2b524b', '#1e7a61', '#14a276', '#10cf8e'];
const ROSE    = ['#77384e', '#9e3a56', '#c94360', '#f8556f'];
const NEUTRAL = 'var(--bg-elevated)';

/**
 * delta = value − baseline, in rate points; span = |delta| that saturates the
 * scale. Positive delta = pitcher advantage (emerald).
 */
export function heatColor(delta: number, span: number): string {
  if (!isFinite(delta)) return NEUTRAL;
  const t = Math.max(-1, Math.min(1, delta / span));
  if (Math.abs(t) < 0.125) return NEUTRAL;
  const arm = t > 0 ? EMERALD : ROSE;
  const idx = Math.min(3, Math.floor((Math.abs(t) - 0.125) / 0.219));
  return arm[idx]!;
}

/** ink that clears the heat fill — bright steps take dark ink */
export function heatInk(color: string): string {
  return color === '#10cf8e' || color === '#f8556f' ? '#071410' : 'var(--text-1)';
}
