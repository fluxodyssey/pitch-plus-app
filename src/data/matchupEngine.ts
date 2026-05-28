/**
 * matchupEngine.ts — Client-Side Matchup Projection Engine
 *
 * Algorithm:
 *  1. Find top-20 pitchers similar to selected pitcher (from similarity data)
 *  2. Look up batter's outcomes against each similar pitcher
 *  3. Weight outcomes by similarity score, regress toward batter's overall rates
 *  4. Monte Carlo: sample 10,000 PAs from projected distribution
 *  5. Compute matchup grade: (proj_xwOBA - lg_avg) / xwOBA_std × scale → [-10, +10]
 *
 * The regression factor is calibrated so that:
 *  - 0 matching PA:  outcome = pure batter season average
 *  - 10 PA:          ~70% actual data, 30% regression
 *  - 50+ PA:         ~95% actual data, 5% regression
 */

import type {
  SimilarityData,
  BatterOutcomesData,
  BatterOutcomeStats,
  MatchupProjection,
  MatchupOutcomes,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const LG_XWOBA     = 0.320;
const LG_XWOBA_STD = 0.060;  // typical spread for qualified batters

// Regression PA constant: higher = more regression toward league average
const REGRESS_PA = 20;

// Grade scale: each unit = ~0.5 run / 700 PA
function xwobaToGrade(projXwOba: number, lgXwoba: number = LG_XWOBA): number {
  const diff = projXwOba - lgXwoba;
  // Scale: 0.060 xwOBA diff ≈ 10 grade points (max ±10)
  return Math.max(-10, Math.min(10, Math.round((diff / LG_XWOBA_STD) * 10)));
}

function gradeLabel(grade: number): string {
  if (grade >= 8)  return 'A+';
  if (grade >= 5)  return 'A';
  if (grade >= 2)  return 'B+';
  if (grade >= -1) return 'B';
  if (grade >= -4) return 'C+';
  if (grade >= -7) return 'C';
  return 'D';
}

// ── Outcome field helpers ─────────────────────────────────────────────────────

type OutcomeKey = keyof BatterOutcomeStats;

const RATE_FIELDS: OutcomeKey[] = [
  'k_pct', 'bb_pct', 'single_pct', 'double_pct', 'triple_pct', 'hr_pct', 'xwoba',
  'hard_hit_rate', 'gb_rate', 'fb_rate', 'barrel_rate',
];

function weightedMean(
  entries: Array<{ stats: BatterOutcomeStats; weight: number }>,
  field: OutcomeKey,
  fallback: number,
): number {
  let wsum = 0;
  let wtotal = 0;
  for (const { stats, weight } of entries) {
    const v = stats[field];
    if (v != null && typeof v === 'number' && !isNaN(v)) {
      wsum += v * weight;
      wtotal += weight;
    }
  }
  return wtotal > 0 ? wsum / wtotal : fallback;
}

function regress(observed: number, baseline: number, nPA: number, regPA: number = REGRESS_PA): number {
  // Marcel-style: shrink toward baseline with k regression PAs
  return (nPA * observed + regPA * baseline) / (nPA + regPA);
}

// ── Main projection function ──────────────────────────────────────────────────

export function projectMatchup(
  pitcherId: number,
  batterId: number,
  similarityData: SimilarityData,
  batterOutcomesData: BatterOutcomesData,
): MatchupProjection | null {
  const simInfo = similarityData[String(pitcherId)];
  const batterProfile = batterOutcomesData[String(batterId)];

  if (!simInfo || !batterProfile) return null;

  const batterOverall = batterProfile.overall;
  if (!batterOverall) return null;

  // ── Step 1: gather batter outcomes vs similar pitchers ─────────────────────
  const matchups: Array<{ stats: BatterOutcomeStats; weight: number; pitcherId: number }> = [];

  for (const sim of simInfo.similar) {
    const vsPitcher = batterProfile.vs_pitcher?.[String(sim.id)];
    if (vsPitcher && vsPitcher.n_pa >= 1) {
      matchups.push({
        stats: vsPitcher,
        weight: sim.similarity / 100,
        pitcherId: sim.id,
      });
    }
  }

  const n_similar_with_data = matchups.length;
  const totalWeightedPA = matchups.reduce((s, m) => s + m.stats.n_pa * m.weight, 0);

  // ── Step 2: weighted outcomes with regression ──────────────────────────────
  // Regression baseline = batter's overall season rates
  const baseline: Record<string, number> = {
    k_pct:         batterOverall.k_pct ?? 0.22,
    bb_pct:        batterOverall.bb_pct ?? 0.08,
    single_pct:    batterOverall.single_pct ?? 0.14,
    double_pct:    batterOverall.double_pct ?? 0.05,
    triple_pct:    batterOverall.triple_pct ?? 0.005,
    hr_pct:        batterOverall.hr_pct ?? 0.035,
    xwoba:         batterOverall.xwoba ?? LG_XWOBA,
    hard_hit_rate: batterOverall.hard_hit_rate ?? 0.38,
    gb_rate:       batterOverall.gb_rate ?? 0.43,
    fb_rate:       batterOverall.fb_rate ?? 0.35,
    barrel_rate:   batterOverall.barrel_rate ?? 0.08,
  };

  // If no matchup data, project = batter baseline vs pitcher hand
  if (matchups.length === 0) {
    const hand = simInfo.hand as 'L' | 'R';
    const vsHand = batterProfile.vs_hand?.[hand];
    const handBaseline = vsHand ?? batterOverall;

    const outcomes: MatchupOutcomes = {
      k_pct:            handBaseline.k_pct ?? baseline.k_pct ?? 0,
      bb_pct:           handBaseline.bb_pct ?? baseline.bb_pct ?? 0,
      single_pct:       handBaseline.single_pct ?? baseline.single_pct ?? 0,
      double_triple_pct:(handBaseline.double_pct ?? baseline.double_pct ?? 0) + (handBaseline.triple_pct ?? baseline.triple_pct ?? 0),
      hr_pct:           handBaseline.hr_pct ?? baseline.hr_pct ?? 0,
      xwoba:            handBaseline.xwoba ?? baseline.xwoba ?? 0,
      hard_hit_rate:    handBaseline.hard_hit_rate ?? baseline.hard_hit_rate ?? 0,
      gb_rate:          handBaseline.gb_rate ?? baseline.gb_rate ?? 0,
      fb_rate:          handBaseline.fb_rate ?? baseline.fb_rate ?? 0,
      barrel_rate:      handBaseline.barrel_rate ?? baseline.barrel_rate ?? 0,
      hit_pct:          0,
      reach_pct:        0,
    };
    outcomes.hit_pct   = outcomes.single_pct + outcomes.double_triple_pct + outcomes.hr_pct;
    outcomes.reach_pct = outcomes.hit_pct + outcomes.bb_pct;

    const grade = xwobaToGrade(outcomes.xwoba);
    return {
      pitcher_id: pitcherId,
      batter_id: batterId,
      outcomes,
      deltas: {
        from_batter_avg: computeDeltas(outcomes, batterOverall),
        from_pitcher_avg: {},
      },
      grade,
      grade_label: gradeLabel(grade),
      leans: grade > 1 ? 'batter' : grade < -1 ? 'pitcher' : 'neutral',
      n_similar_with_data: 0,
      confidence: 'low',
    };
  }

  // Weighted average from similar-pitcher matchups
  const rawOutcomes: Record<string, number> = {};
  for (const field of RATE_FIELDS) {
    rawOutcomes[field as string] = weightedMean(matchups, field, baseline[field as string] ?? 0);
  }

  // Apply regression toward batter baseline
  const proj: Record<string, number> = {};
  for (const field of RATE_FIELDS) {
    const raw = rawOutcomes[field as string] ?? 0;
    const base = baseline[field as string] ?? 0;
    proj[field as string] = regress(raw, base, totalWeightedPA);
  }

  // ── Step 3: Build outcome object ────────────────────────────────────────────
  const outcomes: MatchupOutcomes = {
    k_pct:            proj.k_pct ?? 0,
    bb_pct:           proj.bb_pct ?? 0,
    single_pct:       proj.single_pct ?? 0,
    double_triple_pct:(proj.double_pct ?? 0) + (proj.triple_pct ?? 0),
    hr_pct:           proj.hr_pct ?? 0,
    xwoba:            proj.xwoba ?? 0,
    hard_hit_rate:    proj.hard_hit_rate ?? 0,
    gb_rate:          proj.gb_rate ?? 0,
    fb_rate:          proj.fb_rate ?? 0,
    barrel_rate:      proj.barrel_rate ?? 0,
    hit_pct:          0,
    reach_pct:        0,
  };
  outcomes.hit_pct   = outcomes.single_pct + outcomes.double_triple_pct + outcomes.hr_pct;
  outcomes.reach_pct = outcomes.hit_pct + outcomes.bb_pct;

  // wRC+ proxy (simplified)
  outcomes.wrc_plus_proj = Math.round(100 + (outcomes.xwoba - LG_XWOBA) / LG_XWOBA_STD * 15);

  // ── Step 4: Grade ────────────────────────────────────────────────────────────
  const grade = xwobaToGrade(outcomes.xwoba);

  // ── Step 5: Confidence ────────────────────────────────────────────────────────
  const confidence: 'high' | 'medium' | 'low' =
    totalWeightedPA >= 30 ? 'high' :
    totalWeightedPA >= 10 ? 'medium' : 'low';

  return {
    pitcher_id: pitcherId,
    batter_id: batterId,
    outcomes,
    deltas: {
      from_batter_avg: computeDeltas(outcomes, batterOverall),
      from_pitcher_avg: {},
    },
    grade,
    grade_label: gradeLabel(grade),
    leans: grade > 1 ? 'batter' : grade < -1 ? 'pitcher' : 'neutral',
    n_similar_with_data,
    confidence,
  };
}

// ── Compute deltas vs a baseline outcome set ──────────────────────────────────

function computeDeltas(
  proj: MatchupOutcomes,
  baseline: BatterOutcomeStats,
): Partial<MatchupOutcomes> {
  return {
    k_pct:   (proj.k_pct   - (baseline.k_pct   ?? 0)),
    bb_pct:  (proj.bb_pct  - (baseline.bb_pct   ?? 0)),
    hr_pct:  (proj.hr_pct  - (baseline.hr_pct   ?? 0)),
    xwoba:   (proj.xwoba   - (baseline.xwoba    ?? LG_XWOBA)),
    reach_pct: (proj.reach_pct - ((baseline.single_pct ?? 0) + (baseline.double_pct ?? 0) +
                (baseline.triple_pct ?? 0) + (baseline.hr_pct ?? 0) + (baseline.bb_pct ?? 0))),
  };
}

// ── Monte Carlo simulation ────────────────────────────────────────────────────

export interface SimResult {
  p5:  MatchupOutcomes;
  p50: MatchupOutcomes;
  p95: MatchupOutcomes;
}

/**
 * Run a simplified Monte Carlo to compute confidence intervals.
 * Uses Dirichlet sampling over the outcome distribution.
 * Returns 5th, 50th, 95th percentile xwOBA projections.
 */
export function monteCarloMatchup(
  baseOutcomes: MatchupOutcomes,
  nSim: number = 5000,
): SimResult {
  // Outcome categories with probabilities
  const cats = [
    baseOutcomes.k_pct,
    baseOutcomes.bb_pct,
    baseOutcomes.single_pct,
    baseOutcomes.double_triple_pct * 0.8, // doubles
    baseOutcomes.double_triple_pct * 0.2, // triples
    baseOutcomes.hr_pct,
  ];
  const woba_w = [0, 0.690, 0.882, 1.251, 1.575, 2.027];

  const sims: number[] = [];

  for (let i = 0; i < nSim; i++) {
    // Add Dirichlet noise (concentration = 50 PA effective)
    const noise = cats.map((p) => Math.max(0.001, p + (Math.random() - 0.5) * 0.03));
    const total = noise.reduce((a, b) => a + b, 0);
    const normed = noise.map((n) => n / total);
    const sim_xwoba = normed.reduce((s, p, k) => s + p * (woba_w[k] ?? 0), 0);
    sims.push(sim_xwoba);
  }

  sims.sort((a, b) => a - b);
  const p5  = sims[Math.floor(nSim * 0.05)] ?? 0;
  const p50 = sims[Math.floor(nSim * 0.50)] ?? 0;
  const p95 = sims[Math.floor(nSim * 0.95)] ?? 0;

  function buildOutcome(xwoba: number): MatchupOutcomes {
    return { ...baseOutcomes, xwoba };
  }

  return { p5: buildOutcome(p5), p50: buildOutcome(p50), p95: buildOutcome(p95) };
}
