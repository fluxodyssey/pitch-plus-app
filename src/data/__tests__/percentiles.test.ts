import { describe, it, expect } from 'vitest';
import { computePercentiles } from '../percentiles';
import type { Pitcher, DimensionKey, MetricGrade } from '../../types';

const DIMENSIONS: DimensionKey[] = [
  'stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal',
];

function makePitcher(
  id: number,
  pitch_plus: number,
  dimScores: Record<DimensionKey, number>,
  metric_grades: Record<string, MetricGrade> = {},
): Pitcher {
  return {
    pitcher_id: id,
    pitcher_name: `Pitcher${id}`,
    pitcher_hand: 'R',
    pitcher_team: 'TST',
    pitch_plus,
    n_pitches: 1000,
    n_games: 30,
    dimensions: {
      stuff: { score: dimScores.stuff, grade: 'B' },
      command: { score: dimScores.command, grade: 'B' },
      deception: { score: dimScores.deception, grade: 'B' },
      tunnel_and_sequence: { score: dimScores.tunnel_and_sequence, grade: 'B' },
      outcomes: { score: dimScores.outcomes, grade: 'B' },
      arsenal: { score: dimScores.arsenal, grade: 'B' },
    },
    metric_grades,
  };
}

function uniformDims(score: number): Record<DimensionKey, number> {
  return Object.fromEntries(DIMENSIONS.map(d => [d, score])) as Record<DimensionKey, number>;
}

describe('computePercentiles', () => {
  it('returns an empty Map for an empty pitcher array', () => {
    const result = computePercentiles([]);
    expect(result.size).toBe(0);
  });

  it('places a single pitcher at the 0th percentile (nothing below them)', () => {
    const p = makePitcher(1, 100, uniformDims(100));
    const result = computePercentiles([p]);
    const entry = result.get(1)!;
    // rankPercentile counts values STRICTLY below; with one pitcher, 0 are below itself.
    expect(entry.pitch_plus).toBe(0);
  });

  it('approximates the median at P50 with synthetic uniform distribution', () => {
    // 100 pitchers with pitch_plus from 1 to 100 — pitcher 50 should land near P50.
    const pitchers = Array.from({ length: 100 }, (_, i) =>
      makePitcher(i + 1, i + 1, uniformDims(i + 1))
    );
    const result = computePercentiles(pitchers);
    // Pitcher with pitch_plus = 50 (id 50) → 49 values below → 49%
    expect(result.get(50)!.pitch_plus).toBeCloseTo(49, 0);
  });

  it('approximates P90 for top-decile pitchers', () => {
    const pitchers = Array.from({ length: 100 }, (_, i) =>
      makePitcher(i + 1, i + 1, uniformDims(i + 1))
    );
    const result = computePercentiles(pitchers);
    expect(result.get(90)!.pitch_plus).toBeCloseTo(89, 0);
    expect(result.get(99)!.pitch_plus).toBeCloseTo(98, 0);
  });

  it('places the lowest pitcher at the 0th percentile', () => {
    const pitchers = Array.from({ length: 100 }, (_, i) =>
      makePitcher(i + 1, i + 1, uniformDims(i + 1))
    );
    const result = computePercentiles(pitchers);
    expect(result.get(1)!.pitch_plus).toBe(0);
  });

  it('populates all six dimension percentiles for every pitcher', () => {
    const pitchers = Array.from({ length: 20 }, (_, i) =>
      makePitcher(i + 1, 100, uniformDims(50 + i * 5))
    );
    const result = computePercentiles(pitchers);
    for (const p of pitchers) {
      const entry = result.get(p.pitcher_id)!;
      for (const dk of DIMENSIONS) {
        expect(entry.dimensions[dk]).toBeTypeOf('number');
        expect(entry.dimensions[dk]).toBeGreaterThanOrEqual(0);
        expect(entry.dimensions[dk]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('handles per-dimension differences in score independently', () => {
    // Pitcher A: top in stuff, bottom in command. Pitcher B: opposite.
    const a = makePitcher(1, 100, {
      stuff: 130, command: 70, deception: 100,
      tunnel_and_sequence: 100, outcomes: 100, arsenal: 100,
    });
    const b = makePitcher(2, 100, {
      stuff: 70, command: 130, deception: 100,
      tunnel_and_sequence: 100, outcomes: 100, arsenal: 100,
    });
    const c = makePitcher(3, 100, uniformDims(100));
    const result = computePercentiles([a, b, c]);
    // A is the top stuff (2 below) and bottom command (0 below)
    expect(result.get(1)!.dimensions.stuff).toBeGreaterThan(result.get(2)!.dimensions.stuff);
    expect(result.get(2)!.dimensions.command).toBeGreaterThan(result.get(1)!.dimensions.command);
  });

  it('only computes metric percentiles for pitchers who have that metric', () => {
    // Pitcher 1 has k_rate, pitcher 2 doesn't.
    const grades1: Record<string, MetricGrade> = {
      k_rate: { grade: 130, raw: 0.30 },
    };
    const grades2: Record<string, MetricGrade> = {};
    const p1 = makePitcher(1, 100, uniformDims(100), grades1);
    const p2 = makePitcher(2, 100, uniformDims(100), grades2);
    const result = computePercentiles([p1, p2]);
    expect(result.get(1)!.metrics.k_rate).toBeDefined();
    expect(result.get(2)!.metrics.k_rate).toBeUndefined();
  });

  it('returns 0 percentile for a metric grade tied with itself (no values strictly below)', () => {
    // All three pitchers have the same k_rate grade — nothing is below.
    const grades: Record<string, MetricGrade> = { k_rate: { grade: 100, raw: 0.25 } };
    const pitchers = [1, 2, 3].map(id =>
      makePitcher(id, 100, uniformDims(100), { ...grades })
    );
    const result = computePercentiles(pitchers);
    for (const p of pitchers) {
      expect(result.get(p.pitcher_id)!.metrics.k_rate).toBe(0);
    }
  });
});
