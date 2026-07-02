import { describe, expect, it } from 'vitest';
import type { PitchRow } from '../customSlice';
import { EMPTY_FILTERS, filterPitches, gradeSlice, parsePitchFile } from '../customSlice';
import type { PitchMetricCal } from '../../types';

function row(over: Partial<PitchRow>): PitchRow {
  return {
    date: '2025-06-01', game: 1, ab: 1, b: 0, s: 0, bh: 'R', pt: 'FF', zone: 5,
    xrv: 0, xrvs: 0, pw: null, sw: 0, wf: 0, velo: 94, ...over,
  };
}

function cal(over: Partial<PitchMetricCal>): PitchMetricCal {
  return { league: 0, mu: 0, sd: 1, k: 0, higher: true, label: 'x', ...over };
}

describe('parsePitchFile', () => {
  it('maps fields by name, independent of column order', () => {
    const rows = parsePitchFile({
      f: ['velo', 'date', 'b'],
      p: [[95.5, '2025-04-01', 2]],
    });
    expect(rows[0]!.velo).toBe(95.5);
    expect(rows[0]!.date).toBe('2025-04-01');
    expect(rows[0]!.b).toBe(2);
    expect(rows[0]!.xrv).toBeNull(); // absent column -> null
  });

  it('treats short rows and nulls as null', () => {
    const rows = parsePitchFile({ f: ['velo', 'xrv'], p: [[null], [93.1, 0.2]] });
    expect(rows[0]!.velo).toBeNull();
    expect(rows[0]!.xrv).toBeNull();
    expect(rows[1]!.xrv).toBeCloseTo(0.2);
  });
});

describe('filterPitches', () => {
  const rows = [
    row({ b: 0, s: 2, bh: 'L', pt: 'SL', zone: 4, date: '2025-04-10' }),
    row({ b: 3, s: 0, bh: 'R', pt: 'FF', zone: 12, date: '2025-05-10' }),
    row({ b: 1, s: 1, bh: 'R', pt: 'FF', zone: null, date: '2025-06-10' }),
  ];

  it('passes everything through with empty filters', () => {
    expect(filterPitches(rows, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('filters by count, hand, and pitch type', () => {
    expect(filterPitches(rows, { ...EMPTY_FILTERS, balls: 0, strikes: 2 })).toHaveLength(1);
    expect(filterPitches(rows, { ...EMPTY_FILTERS, hand: 'R' })).toHaveLength(2);
    expect(filterPitches(rows, { ...EMPTY_FILTERS, pitchType: 'SL' })).toHaveLength(1);
  });

  it('zone filter: 1-9 in, 11+ out, null excluded from both', () => {
    expect(filterPitches(rows, { ...EMPTY_FILTERS, zone: 'in' })).toHaveLength(1);
    expect(filterPitches(rows, { ...EMPTY_FILTERS, zone: 'out' })).toHaveLength(1);
  });

  it('date range is inclusive on both ends', () => {
    expect(filterPitches(rows, { ...EMPTY_FILTERS, from: '2025-05-10', to: '2025-06-10' }))
      .toHaveLength(2);
  });
});

describe('gradeSlice', () => {
  it('scales a raw mean to 100/σ=15 against calibration (k=0 disables shrinkage)', () => {
    const rows = [row({ velo: 95 }), row({ velo: 96 })];
    const r = gradeSlice(rows, { velo: cal({ league: 94, mu: 94, sd: 1 }) });
    // raw mean 95.5, z = 1.5 -> 122.5 -> 123
    expect(r.grades.velo).toBe(123);
    expect(r.grades.quality).toBeNull(); // no calibration entry -> null
  });

  it('flips sign for lower-is-better metrics (quality/stuff are offense-positive)', () => {
    const rows = [row({ xrv: -0.5 }), row({ xrv: -0.5 })];
    const r = gradeSlice(rows, { quality: cal({ higher: false, mu: 0, sd: 0.5 }) });
    // shrunk -0.5, z = -1 flipped to +1 -> 115
    expect(r.grades.quality).toBe(115);
  });

  it('shrinks small samples toward league mean', () => {
    const rows = [row({ velo: 100 })]; // 1 pitch, 6 above league
    const r = gradeSlice(rows, { velo: cal({ league: 94, mu: 94, sd: 1, k: 1 }) });
    // shrunk = (1*100 + 1*94)/2 = 97 -> z=3 -> 145
    expect(r.grades.velo).toBe(145);
  });

  it('grades an empty slice at league (100 when mu == league)', () => {
    const r = gradeSlice([], { velo: cal({ league: 94, mu: 94, sd: 1, k: 30 }) });
    expect(r.grades.velo).toBe(100);
    expect(r.n).toBe(0);
  });

  it('uses swings as the whiff denominators and ignores null p_whiff', () => {
    const rows = [
      row({ sw: 1, wf: 1, pw: 0.4 }),
      row({ sw: 1, wf: 0, pw: 0.2 }),
      row({ sw: 0, wf: 0, pw: null }), // take: excluded from whiff metrics
    ];
    const r = gradeSlice(rows, {
      whiff: cal({ league: 0.25, mu: 0.25, sd: 0.125, k: 0 }),
      xwhiff: cal({ league: 0.25, mu: 0.25, sd: 0.025, k: 0 }),
    });
    expect(r.swings).toBe(2);
    // whiff rate 1/2 = 0.5, z = 2 -> 130
    expect(r.grades.whiff).toBe(130);
    // pw mean 0.3, z = 2 -> 130
    expect(r.grades.xwhiff).toBe(130);
  });

  it('clips to [20, 180]', () => {
    const r = gradeSlice([row({ velo: 200 })], { velo: cal({ league: 94, mu: 94, sd: 0.1 }) });
    expect(r.grades.velo).toBe(180);
  });
});
