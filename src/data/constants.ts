import type { DimensionKey, MetricKey, ScoredMetricKey } from '../types';

// ─── Metric Labels ─────────────────────────────────────────────────────────

// Labels for every MetricKey (scored 38 from constants.py:PITCH_PLUS_DIMENSIONS
// + display-only keys). Exhaustive by type — pruned to the canonical metric set
// 2026-06-12 (phantom v3-era metrics removed from the union).
export const METRIC_LABELS: Record<MetricKey, string> = {
  // ── Stuff ────────────────────────────────────────────────────────────────
  stuff_z: 'Stuff Z-Score',
  swing_plus_suppression: 'Swing+ Suppression',
  avg_perceived_velo: 'Perceived Velocity',
  bat_speed_suppression: 'Bat Speed Suppression',
  ssw_proxy: 'Seam-Shifted Wake',
  // ── Command ──────────────────────────────────────────────────────────────
  bip_adjusted_kbb: 'BIP-Adj K-BB%',
  race_to_2_strikes: 'Race to 2 Strikes',
  loc_precision: 'Location Precision',
  zone_rate: 'Zone%',
  first_pitch_strike_rate: 'First Pitch K%',
  take_rv_against: 'Take RV Against',
  edge_rate: 'Edge%',
  markov_efficiency: 'Markov Efficiency',
  // ── Deception ────────────────────────────────────────────────────────────
  in_zone_whiff_rate: 'In-Zone Whiff%',
  csw_rate: 'CSW%',
  chase_rate: 'Chase%',
  avg_extension: 'Extension',
  regime_whiff_delta: 'Regime Whiff Delta',
  swing_length_inducement: 'Swing Length Inducement',
  release_consistency: 'Release Consistency',
  // ── Tunnel & Sequence ────────────────────────────────────────────────────
  movement_differential: 'Movement Differential',
  sequence_surprise: 'Sequence Surprise',
  speed_differential: 'Speed Differential',
  // ── Outcomes ─────────────────────────────────────────────────────────────
  markov_dominance: 'Markov Dominance',
  wrc_plus_against: 'wRC+ Against',
  k_rate: 'K%',
  avg_launch_speed_against: 'EV Against',
  bb_rate: 'BB%',
  gb_rate: 'GB%',
  bip_rate: 'BIP Rate',
  swing_rv_against: 'Swing RV Against',
  in_zone_swing_rv: 'In-Zone Swing RV',
  chase_swing_rv: 'Chase Swing RV',
  // ── Arsenal ──────────────────────────────────────────────────────────────
  best_secondary_whiff: 'Best Secondary Whiff%',
  count_conditional_entropy: 'Count-Cond. Entropy',
  platoon_resistance: 'Platoon Resistance',
  n_pitch_types: '# Pitch Types',
  pitch_entropy: 'Pitch Entropy',
  // ── Display-only keys (not in the composite) ─────────────────────────────
  k_bb_pct: 'K-BB%',
  called_strike_rv: 'Called Strike RV',
  ball_rv: 'Ball RV',
  velocity_adaptation: 'Velocity Adaptation',
  mix_adaptation: 'Mix Adaptation',
  markov_walk_risk: 'Markov Walk Risk',
  markov_recovery_score: 'Markov Recovery',
  markov_k_from_behind: 'K% from Behind',
  non_stuff_alpha: 'Non-Stuff Alpha',
  command_alpha: 'Command Alpha',
  trajectory_slope: 'Trajectory Slope',
};

// ─── Dimension Labels ─────────────────────────────────────────────────────

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  stuff: 'Stuff',
  command: 'Command',
  deception: 'Deception',
  tunnel_and_sequence: 'Tunnel & Sequence',
  outcomes: 'Outcomes',
  arsenal: 'Arsenal',
};

// ─── Dimension to Metrics Mapping ─────────────────────────────────────────

// Mirrors models/constants.py:PITCH_PLUS_DIMENSIONS exactly (metric membership
// AND weight order) — this map drives the dimension drill-down panels, so any
// drift here misrepresents what the composite actually scores.
export const DIMENSION_METRICS: Record<DimensionKey, ScoredMetricKey[]> = {
  stuff: [
    'stuff_z',
    'swing_plus_suppression',
    'avg_perceived_velo',
    'bat_speed_suppression',
    'ssw_proxy',
  ],
  command: [
    'bip_adjusted_kbb',
    'race_to_2_strikes',
    'loc_precision',
    'zone_rate',
    'first_pitch_strike_rate',
    'take_rv_against',
    'edge_rate',
    'markov_efficiency',
  ],
  deception: [
    'in_zone_whiff_rate',
    'csw_rate',
    'chase_rate',
    'avg_extension',
    'regime_whiff_delta',
    'swing_length_inducement',
    'release_consistency',
  ],
  tunnel_and_sequence: [
    'movement_differential',
    'sequence_surprise',
    'speed_differential',
  ],
  outcomes: [
    'markov_dominance',
    'wrc_plus_against',
    'k_rate',
    'avg_launch_speed_against',
    'bb_rate',
    'gb_rate',
    'bip_rate',
    'swing_rv_against',
    'in_zone_swing_rv',
    'chase_swing_rv',
  ],
  arsenal: [
    'best_secondary_whiff',
    'count_conditional_entropy',
    'platoon_resistance',
    'n_pitch_types',
    'pitch_entropy',
  ],
};

// ─── Metrics where LOWER is better ────────────────────────────────────────

// Must agree with the "lower" direction flags in constants.py:PITCH_PLUS_DIMENSIONS
// for every scored metric (display-only keys: markov_walk_risk, ball_rv).
export const LOWER_IS_BETTER = new Set<MetricKey>([
  'loc_precision',
  'release_consistency',
  'wrc_plus_against',
  'bb_rate',
  'avg_launch_speed_against',
  // run-value metrics (lower RV = pitcher wins)
  'swing_rv_against',
  'in_zone_swing_rv',
  'chase_swing_rv',
  'take_rv_against',
  'bip_rate',
  'race_to_2_strikes',           // fewer pitches to 2 strikes = better
  'markov_walk_risk',
  'markov_efficiency',           // fewer pitches per PA = more efficient
  'ball_rv',                     // lower ball RV = better passive command
]);

// ─── Percentage Metrics (multiply raw × 100 for display) ──────────────────

export const PCT_METRICS = new Set<MetricKey>([
  'k_bb_pct',
  'bip_adjusted_kbb',
  'zone_rate',
  'edge_rate',
  'first_pitch_strike_rate',
  'in_zone_whiff_rate',
  'chase_rate',
  'csw_rate',
  'k_rate',
  'bb_rate',
  'bip_rate',
  'gb_rate',
  'best_secondary_whiff',
  'platoon_resistance',
  'markov_dominance',            // P(K | 0-0) — a probability
  'regime_whiff_delta',          // whiff% delta — percentage points
  'markov_walk_risk',            // P(BB | 0-0) — display-only
]);

// ─── Grade Thresholds ─────────────────────────────────────────────────────

export function numericGrade(score: number): string {
  if (score >= 130) return 'A+';
  if (score >= 115) return 'A';
  if (score >= 105) return 'B+';
  if (score >= 95) return 'B';
  if (score >= 85) return 'C+';
  if (score >= 70) return 'C';
  return 'D';
}

// Grade badge background colors — warm crimson for elite, steel blue for below avg
// Matches Baseball Savant's heat-map convention: red = best, blue = worst
export const GRADE_COLORS: Record<string, string> = {
  'A+': '#c0392b',   // deep crimson
  A:   '#c0502b',   // warm red-orange
  'B+': '#8b6a4a',   // warm neutral
  B:   '#566a7a',   // blue-gray neutral
  'C+': '#2e5f8a',   // steel blue
  C:   '#1a4a7a',   // deeper blue
  D:   '#0f3060',   // dark navy
};

export function gradeColor(score: number): string {
  return GRADE_COLORS[numericGrade(score)] ?? '#566a7a';
}

// ─── Score Color (table cells) ────────────────────────────────────────────
// Subtle background tints — Savant-style heat coloring

export function scoreColor(score: number): string {
  if (score >= 120) return 'rgba(192,57,43,0.28)';
  if (score >= 110) return 'rgba(192,57,43,0.15)';
  if (score >= 100) return 'rgba(192,57,43,0.06)';
  if (score >= 90)  return 'rgba(30,95,138,0.08)';
  if (score >= 80)  return 'rgba(30,95,138,0.18)';
  return 'rgba(30,95,138,0.28)';
}

// ─── Continuous Score Color (for percentile bars, heatmaps) ──────────────
// Maps score (0-200, 100=avg) → crimson(elite) → neutral → steel blue(poor)
// Calibrated to match Baseball Savant's red-blue heat map palette

export function scoreColorContinuous(score: number, alpha = 1): string {
  const t = Math.max(0, Math.min(1, (score - 50) / 100)); // 0=poor, 1=elite
  let r: number, g: number, b: number;
  if (t >= 0.5) {
    const s = (t - 0.5) * 2;
    r = Math.round(86  + s * 106);  // 86  → 192 (crimson)
    g = Math.round(106 - s * 63);   // 106 → 43
    b = Math.round(122 - s * 79);   // 122 → 43
  } else {
    const s = t * 2;
    r = Math.round(22  + s * 64);   // 22  → 86
    g = Math.round(74  + s * 32);   // 74  → 106
    b = Math.round(130 - s * 8);    // 130 → 122
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Pitch Type Colors ────────────────────────────────────────────────────

export const PITCH_TYPE_COLORS: Record<string, string> = {
  FF: '#ef5350',
  FA: '#e57373',
  SI: '#ff8a65',
  FC: '#ffd54f',
  CH: '#69f0ae',
  FS: '#00e676',
  SC: '#00bcd4',
  FO: '#26c6da',
  SL: '#4a9eff',
  ST: '#7c4dff',
  SV: '#9c27b0',
  KC: '#ab47bc',
  CU: '#e040fb',
  CS: '#f48fb1',
  EP: '#bcaaa4',
  KN: '#90a4ae',
};

export function pitchColor(type: string): string {
  // literal (not a CSS var): consumed by canvas fillStyle in chart components
  return PITCH_TYPE_COLORS[type] ?? '#e4e4e7';
}

// ─── 20-80 Scouting Grade Scale ──────────────────────────────────────────

export function toScoutingGrade(score: number): number {
  const raw = 50 + (score - 100) * 0.5;
  return Math.max(20, Math.min(80, Math.round(raw / 5) * 5));
}

export const SCOUTING_LABELS: Record<number, string> = {
  80: 'Elite',
  75: 'Plus-Plus',
  70: 'Plus-Plus',
  65: 'Plus',
  60: 'Above Avg',
  55: 'Avg+',
  50: 'Average',
  45: 'Below Avg',
  40: 'Fringe',
  35: 'Well Below',
  30: 'Poor',
  25: 'Poor',
  20: 'Poor',
};

// ─── All sortable metric options for Leaderboard ─────────────────────────

export const ALL_METRIC_OPTIONS: Array<{ key: string; label: string; group: string }> = [
  { key: 'pitch_plus', label: 'Pitch+', group: 'Overall' },
  ...Object.entries(DIMENSION_LABELS).map(([k, v]) => ({
    key: `dim_${k}`,
    label: v,
    group: 'Dimensions',
  })),
  // Scored metrics only, grouped by their dimension — display-only keys have no
  // metric_grades entry, so offering them would rank every pitcher as missing.
  ...(Object.entries(DIMENSION_METRICS) as [DimensionKey, ScoredMetricKey[]][]).flatMap(
    ([dim, metrics]) =>
      metrics.map((m) => ({
        key: `metric_${m}`,
        label: METRIC_LABELS[m],
        group: `${DIMENSION_LABELS[dim]} Metrics`,
      })),
  ),
];
