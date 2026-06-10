import type { Pitcher, DimensionKey, MetricKey } from '../types';

export type PercentileMap = Map<number, PercentileEntry>;

export interface PercentileEntry {
  pitch_plus: number;
  dimensions: Record<DimensionKey, number>;
  metrics: Partial<Record<MetricKey, number>>;
}

const DIMENSION_KEYS: DimensionKey[] = [
  'stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal',
];

function rankPercentile(values: number[], target: number): number {
  let below = 0;
  for (const v of values) {
    if (v < target) below++;
  }
  return Math.round((below / values.length) * 100);
}

export function computePercentiles(pitchers: Pitcher[]): PercentileMap {
  if (pitchers.length === 0) return new Map();

  // Collect all score arrays once
  const ppScores = pitchers.map(p => p.pitch_plus);

  const dimScores: Record<DimensionKey, number[]> = {
    stuff: [], command: [], deception: [],
    tunnel_and_sequence: [], outcomes: [], arsenal: [],
  };
  for (const dk of DIMENSION_KEYS) {
    dimScores[dk] = pitchers.map(p => p.dimensions[dk].score);
  }

  // Collect metric grade arrays — find all metrics present
  const allMetrics = new Set<MetricKey>();
  for (const p of pitchers) {
    for (const k of Object.keys(p.metric_grades) as MetricKey[]) {
      allMetrics.add(k);
    }
  }

  const metricGrades: Partial<Record<MetricKey, number[]>> = {};
  for (const mk of allMetrics) {
    metricGrades[mk] = pitchers
      .map(p => p.metric_grades[mk]?.grade)
      .filter((g): g is number => g != null);
  }

  // Build the map
  const result: PercentileMap = new Map();

  for (const p of pitchers) {
    const dims: Record<DimensionKey, number> = {
      stuff: 0, command: 0, deception: 0,
      tunnel_and_sequence: 0, outcomes: 0, arsenal: 0,
    };
    for (const dk of DIMENSION_KEYS) {
      dims[dk] = rankPercentile(dimScores[dk], p.dimensions[dk].score);
    }

    const metrics: Partial<Record<MetricKey, number>> = {};
    for (const mk of allMetrics) {
      const mg = p.metric_grades[mk];
      if (mg == null) continue;
      const pctile = rankPercentile(metricGrades[mk]!, mg.grade);
      // For LOWER_IS_BETTER metrics, the grade system already inverts
      // (higher grade = better), so percentile is already correct.
      // No need to invert here.
      metrics[mk] = pctile;
    }

    result.set(p.pitcher_id, {
      pitch_plus: rankPercentile(ppScores, p.pitch_plus),
      dimensions: dims,
      metrics,
    });
  }

  return result;
}
