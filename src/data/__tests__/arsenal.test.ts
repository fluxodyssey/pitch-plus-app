import { describe, it, expect } from 'vitest';
import { shrinkRate, shrinkVariance } from '../credible';
import {
  metricCounts, weightedMetric, weightedZones, heatColor,
  type ArsenalPitcher, type ArsenalBatter, type ArsenalLeague, type ArsenalCounts,
} from '../arsenal';

const cell = (over: Partial<ArsenalCounts> = {}): ArsenalCounts => ({
  n: 100, sw: 50, wf: 10, cs: 20, oz: 40, ozsw: 12, k2: 25, pa: 6, ...over,
});

const league: ArsenalLeague = {
  vsL: { FF: cell(), SL: cell({ wf: 20 }) },
  vsR: { FF: cell({ zones: { '5': [30, 100], '11': [10, 50] } }), SL: cell({ wf: 20, zones: { '5': [40, 100] } }) },
  prior_n: { csw: 100, swstr: 35, whiff: 18, chase: 30, putaway: 70 },
};

const pitcher: ArsenalPitcher = {
  name: 'P', hand: 'R', team: 'STL',
  vsL: { FF: { n: 200, usage: 0.6, zones: {} }, SL: { n: 130, usage: 0.4, zones: {} } },
  vsR: { FF: { n: 150, usage: 0.5, zones: {} }, SL: { n: 150, usage: 0.5, zones: {} } },
};

const batter: ArsenalBatter = {
  name: 'B', hand: 'R', team: 'CHC',
  vsL: {},
  vsR: {
    FF: cell({ n: 200, sw: 100, wf: 10 }),                        // whiff 10% (league 20%)
    SL: cell({ n: 60, sw: 30, wf: 15, zones: { '5': [30, 40] } }), // whiff 50% (league 40%)
  },
};

describe('shrinkRate (beta-binomial)', () => {
  it('shrinks toward the prior at small n and converges at large n', () => {
    const small = shrinkRate(10, 20, 0.25, 200);   // observed .500
    expect(small.rate).toBeCloseTo((10 + 50) / (20 + 200), 10); // ≈ .273 (the BDA example)
    const big = shrinkRate(5000, 10000, 0.25, 200);
    expect(big.rate).toBeGreaterThan(0.49);
  });
  it('interval tightens with n and stays in [0,1]', () => {
    const a = shrinkRate(5, 20, 0.3, 30);
    const b = shrinkRate(50, 200, 0.3, 30);
    expect(b.hi - b.lo).toBeLessThan(a.hi - a.lo);
    expect(a.lo).toBeGreaterThanOrEqual(0);
    expect(a.hi).toBeLessThanOrEqual(1);
  });
  it('variance matches the Beta posterior', () => {
    const v = shrinkVariance(10, 40, 0.25, 60);
    const alpha = 10 + 15, beta = 30 + 45, tot = alpha + beta;
    expect(v).toBeCloseTo(((alpha / tot) * (1 - alpha / tot)) / (tot + 1), 12);
  });
});

describe('metricCounts', () => {
  const c = cell();
  it('maps every metric to the documented numerator/denominator', () => {
    expect(metricCounts(c, 'csw')).toEqual({ x: 30, n: 100 });
    expect(metricCounts(c, 'swstr')).toEqual({ x: 10, n: 100 });
    expect(metricCounts(c, 'whiff')).toEqual({ x: 10, n: 50 });
    expect(metricCounts(c, 'chase')).toEqual({ x: 12, n: 40 });
    expect(metricCounts(c, 'putaway')).toEqual({ x: 6, n: 25 });
  });
});

describe('weightedMetric', () => {
  it('weights by the pitcher usage vs the batter side', () => {
    const wm = weightedMetric(pitcher, batter, league, 'whiff')!;
    // batter is R → pitcher vsR usage (.5/.5); pitcher is R → batter vsR splits
    const ff = shrinkRate(10, 100, 0.2, 18).rate;
    const sl = shrinkRate(15, 30, 0.4, 18).rate;
    expect(wm.rate).toBeCloseTo(0.5 * ff + 0.5 * sl, 10);
    expect(wm.league).toBeCloseTo(0.5 * 0.2 + 0.5 * 0.4, 10);
    expect(wm.coverage).toBe(1);
  });
  it('renormalizes when a pitch type has no batter data', () => {
    const thin: ArsenalBatter = { ...batter, vsR: { FF: batter.vsR.FF! } };
    const wm = weightedMetric(pitcher, thin, league, 'whiff')!;
    expect(wm.rate).toBeCloseTo(shrinkRate(10, 100, 0.2, 18).rate, 10);
    expect(wm.coverage).toBeCloseTo(0.5, 10);
  });
  it('pitch-type filter isolates one pitch', () => {
    const wm = weightedMetric(pitcher, batter, league, 'whiff', 'SL')!;
    expect(wm.rate).toBeCloseTo(shrinkRate(15, 30, 0.4, 18).rate, 10);
  });
  it('CI propagates: single dominated pitch ≈ its cell CI width', () => {
    const wm = weightedMetric(pitcher, batter, league, 'whiff', 'FF')!;
    const sr = shrinkRate(10, 100, 0.2, 18);
    expect(wm.hi - wm.lo).toBeCloseTo(sr.hi - sr.lo, 6);
  });
});

describe('weightedZones', () => {
  it('falls back to league zone rate where the batter has no zone cell', () => {
    const z = weightedZones(pitcher, batter, league);
    // zone 5: FF league .30 (batter none), SL league .40 + batter cell [30,40]
    expect(z[5]).toBeDefined();
    const slShrunk = shrinkRate(30, 40, 0.4, 50).rate;
    expect(z[5]!.rate).toBeCloseTo(0.5 * 0.3 + 0.5 * slShrunk, 10);
    expect(z[5]!.league).toBeCloseTo(0.35, 10);
    // zone 11 exists only for FF league → uses FF weight alone
    expect(z[11]!.rate).toBeCloseTo(0.2, 10);
  });
});

describe('heatColor', () => {
  it('is neutral near zero, emerald above, rose below, and saturates', () => {
    expect(heatColor(0, 0.1)).toBe('#263349');
    expect(heatColor(0.03, 0.1)).toBe('#2b524b');
    expect(heatColor(-0.03, 0.1)).toBe('#77384e');
    expect(heatColor(0.06, 0.1)).toBe('#14a276');
    expect(heatColor(0.5, 0.1)).toBe('#10cf8e');
    expect(heatColor(-0.5, 0.1)).toBe('#f8556f');
  });
});
