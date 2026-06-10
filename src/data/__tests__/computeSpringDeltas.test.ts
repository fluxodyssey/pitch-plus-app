import { describe, it, expect } from 'vitest';
import { computeSpringDeltas } from '../computeSpringDeltas';
import type { PitchersData, PitchTypesData, Pitcher } from '../../types';

function makePitcher(overrides: Partial<Pitcher> & { pitcher_id: number; pitcher_name: string }): Pitcher {
  return {
    pitcher_hand: 'R',
    pitcher_team: 'NYY',
    pitch_plus: 100,
    n_pitches: 500,
    n_games: 10,
    dimensions: {
      stuff: { score: 100, grade: 'B' },
      command: { score: 100, grade: 'B' },
      deception: { score: 100, grade: 'B' },
      tunnel_and_sequence: { score: 100, grade: 'B' },
      outcomes: { score: 100, grade: 'B' },
      arsenal: { score: 100, grade: 'B' },
    },
    metric_grades: {} as Pitcher['metric_grades'],
    ...overrides,
  };
}

function makeData(pitchers: Pitcher[]): PitchersData {
  return {
    metadata: { generated: '2026-03-24', n_pitchers: pitchers.length, n_pitches: 1000, n_games: 10, model_version: 'v3.0' },
    population_stats: {} as PitchersData['population_stats'],
    dimension_weights: { stuff: 0.15, command: 0.21, deception: 0.18, tunnel_and_sequence: 0.09, outcomes: 0.22, arsenal: 0.15 },
    pitchers,
  };
}

const emptyPt: PitchTypesData = { league_averages: {}, pitch_names: {}, pitchers: {} };

describe('computeSpringDeltas', () => {
  it('matches pitchers by ID and computes deltas', () => {
    const spring = makeData([
      makePitcher({ pitcher_id: 1, pitcher_name: 'Cole', pitch_plus: 130, dimensions: { ...makePitcher({ pitcher_id: 0, pitcher_name: '' }).dimensions, stuff: { score: 140, grade: 'A+' } } }),
    ]);
    const baseline = makeData([
      makePitcher({ pitcher_id: 1, pitcher_name: 'Cole', pitch_plus: 120 }),
    ]);

    const deltas = computeSpringDeltas(spring, baseline, null, null);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.pitch_plus_delta).toBe(10);
    expect(deltas[0]!.dimension_deltas.stuff).toBe(40); // 140 - 100
  });

  it('excludes pitchers without baseline', () => {
    const spring = makeData([
      makePitcher({ pitcher_id: 1, pitcher_name: 'New Guy', pitch_plus: 110 }),
    ]);
    const baseline = makeData([
      makePitcher({ pitcher_id: 2, pitcher_name: 'Other', pitch_plus: 100 }),
    ]);

    const deltas = computeSpringDeltas(spring, baseline, null, null);
    expect(deltas).toHaveLength(0);
  });

  it('handles negative deltas', () => {
    const spring = makeData([
      makePitcher({ pitcher_id: 1, pitcher_name: 'Declining', pitch_plus: 80 }),
    ]);
    const baseline = makeData([
      makePitcher({ pitcher_id: 1, pitcher_name: 'Declining', pitch_plus: 110 }),
    ]);

    const deltas = computeSpringDeltas(spring, baseline, null, null);
    expect(deltas[0]!.pitch_plus_delta).toBe(-30);
  });

  it('detects new pitch types', () => {
    const spring = makeData([makePitcher({ pitcher_id: 1, pitcher_name: 'Test' })]);
    const baseline = makeData([makePitcher({ pitcher_id: 1, pitcher_name: 'Test' })]);

    const springPt: PitchTypesData = {
      ...emptyPt,
      pitchers: { '1': [{ pitch_type: 'FF', pitch_name: 'Four-Seam', n: 100, usage_pct: 0.6, velo: 95, spin: 2200, ivb: 14, hb: -8, ext: 6.2, perc_velo: 95, whiff_rate: 0.25 },
                         { pitch_type: 'SL', pitch_name: 'Slider', n: 50, usage_pct: 0.3, velo: 85, spin: 2400, ivb: 2, hb: 3, ext: 6.0, perc_velo: 85, whiff_rate: 0.35 }] },
    };
    const baselinePt: PitchTypesData = {
      ...emptyPt,
      pitchers: { '1': [{ pitch_type: 'FF', pitch_name: 'Four-Seam', n: 500, usage_pct: 0.7, velo: 94, spin: 2100, ivb: 13, hb: -9, ext: 6.1, perc_velo: 94, whiff_rate: 0.20 }] },
    };

    const deltas = computeSpringDeltas(spring, baseline, springPt, baselinePt);
    const ptDeltas = deltas[0]!.pitch_type_deltas;

    const ff = ptDeltas.find(d => d.pitch_type === 'FF')!;
    expect(ff.is_new).toBe(false);
    expect(ff.velo_delta).toBe(1.0);
    expect(ff.spin_delta).toBe(100);

    const sl = ptDeltas.find(d => d.pitch_type === 'SL')!;
    expect(sl.is_new).toBe(true);
  });

  it('detects dropped pitch types', () => {
    const spring = makeData([makePitcher({ pitcher_id: 1, pitcher_name: 'Test' })]);
    const baseline = makeData([makePitcher({ pitcher_id: 1, pitcher_name: 'Test' })]);

    const springPt: PitchTypesData = {
      ...emptyPt,
      pitchers: { '1': [{ pitch_type: 'FF', pitch_name: 'Four-Seam', n: 100, usage_pct: 1.0, velo: 95, spin: 2200, ivb: 14, hb: -8, ext: 6.2, perc_velo: 95, whiff_rate: 0.25 }] },
    };
    const baselinePt: PitchTypesData = {
      ...emptyPt,
      pitchers: { '1': [{ pitch_type: 'FF', pitch_name: 'Four-Seam', n: 500, usage_pct: 0.7, velo: 94, spin: 2100, ivb: 13, hb: -9, ext: 6.1, perc_velo: 94, whiff_rate: 0.20 },
                         { pitch_type: 'CU', pitch_name: 'Curveball', n: 200, usage_pct: 0.3, velo: 78, spin: 2800, ivb: -8, hb: 6, ext: 5.8, perc_velo: 78, whiff_rate: 0.30 }] },
    };

    const deltas = computeSpringDeltas(spring, baseline, springPt, baselinePt);
    const dropped = deltas[0]!.pitch_type_deltas.find(d => d.pitch_type === 'CU')!;
    expect(dropped.is_dropped).toBe(true);
    expect(dropped.spring_velo).toBeNull();
  });
});
