import type { DimensionKey, MetricKey } from '../types';

// ─── Metric Labels ─────────────────────────────────────────────────────────

export const METRIC_LABELS: Record<MetricKey, string> = {
  stuff_z: 'Stuff Z-Score',
  ssw_proxy: 'Seam-Shifted Wake',
  avg_perceived_velo: 'Perceived Velocity',
  k_bb_pct: 'K-BB%',
  zone_rate: 'Zone%',
  edge_rate: 'Edge%',
  loc_precision: 'Location Precision',
  first_pitch_strike_rate: 'First Pitch K%',
  in_zone_whiff_rate: 'In-Zone Whiff%',
  chase_rate: 'Chase%',
  csw_rate: 'CSW%',
  avg_extension: 'Extension',
  fb_vaa: 'Fastball VAA',
  release_consistency: 'Release Consistency',
  // v3: Tango 167ms commit point tunneling
  temporal_tunnel_tightness: 'Temporal Tunnel (167ms)',
  temporal_tunnel_effectiveness: 'Temporal Tunnel Effect.',
  tunnel_tightness: 'Tunnel Tightness',
  tunnel_effectiveness: 'Tunnel Effectiveness',
  release_uniqueness: 'Release Uniqueness',
  speed_differential: 'Speed Differential',
  movement_differential: 'Movement Differential',
  sequence_surprise: 'Sequence Surprise',
  wrc_plus_against: 'wRC+ Against',
  k_rate: 'K%',
  bb_rate: 'BB%',
  avg_launch_speed_against: 'EV Against',
  gb_rate: 'GB%',
  pitch_entropy: 'Pitch Entropy',
  // v3: count-conditional entropy + synergy
  count_conditional_entropy: 'Count-Cond. Entropy',
  arsenal_synergy: 'Arsenal Synergy',
  n_pitch_types: '# Pitch Types',
  best_secondary_whiff: 'Best Secondary Whiff%',
  platoon_resistance: 'Platoon Resistance',
  // v3: Pitcher Deception Index
  pitcher_deception_index: 'Deception Index (PDI)',
  // v3.1: Stuff — spin quality & swing suppression
  spin_direction_efficiency: 'Spin Direction Eff.',
  bat_speed_suppression: 'Bat Speed Suppression',
  swing_plus_suppression: 'Swing+ Suppression',
  // v3.1: Command — novel metrics
  obp_hr_residual: 'OBP-HR Residual',
  race_to_2_strikes: 'Race to 2 Strikes',
  // v3.1: Deception — zone-weighted & swing inducement
  zone_weighted_chase: 'Zone-Weighted Chase%',
  swing_length_inducement: 'Swing Length Inducement',
  // v3.1: Outcomes — swing run values & barrel suppression
  swing_rv_against: 'Swing RV Against',
  in_zone_swing_rv: 'In-Zone Swing RV',
  barrel_rate_against: 'Barrel Rate Against',
  chase_swing_rv: 'Chase Swing RV',
  // v3.1: Arsenal — diversity metrics
  spin_diversity: 'Spin Diversity',
  speed_diversity: 'Speed Diversity',
  // v3.1: backtest-validated novel metrics
  bip_adjusted_kbb: 'BIP-Adj K-BB%',
  bip_rate: 'BIP Rate',
  take_rv_against: 'Take RV Against',
  called_strike_rv: 'Called Strike RV',
  ball_rv: 'Ball RV',
  regime_whiff_delta: 'Regime Whiff Delta',
  velocity_adaptation: 'Velocity Adaptation',
  mix_adaptation: 'Mix Adaptation',
  // Markov chain metrics
  markov_dominance: 'Markov Dominance',
  markov_walk_risk: 'Markov Walk Risk',
  markov_efficiency: 'Markov Efficiency',
  markov_recovery_score: 'Markov Recovery',
  markov_k_from_behind: 'K% from Behind',
  // Stuff alpha / trajectory metrics
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

export const DIMENSION_METRICS: Record<DimensionKey, MetricKey[]> = {
  stuff: ['stuff_z', 'ssw_proxy', 'avg_perceived_velo', 'spin_direction_efficiency', 'bat_speed_suppression', 'swing_plus_suppression'],
  command: [
    'bip_adjusted_kbb',
    'k_bb_pct',
    'zone_rate',
    'edge_rate',
    'loc_precision',
    'first_pitch_strike_rate',
    'obp_hr_residual',
    'take_rv_against',
    'race_to_2_strikes',
    'markov_efficiency',
    'called_strike_rv',
    'ball_rv',
  ],
  deception: [
    'in_zone_whiff_rate',
    'zone_weighted_chase',
    'chase_rate',
    'csw_rate',
    'avg_extension',
    'fb_vaa',
    'swing_length_inducement',
    'release_consistency',
    'pitcher_deception_index',
    'regime_whiff_delta',
    'velocity_adaptation',
    'mix_adaptation',
  ],
  tunnel_and_sequence: [
    'temporal_tunnel_tightness',
    'temporal_tunnel_effectiveness',
    'tunnel_tightness',
    'tunnel_effectiveness',
    'release_uniqueness',
    'speed_differential',
    'movement_differential',
    'sequence_surprise',
  ],
  outcomes: [
    'swing_rv_against',
    'in_zone_swing_rv',
    'barrel_rate_against',
    'chase_swing_rv',
    'k_rate',
    'bb_rate',
    'bip_rate',
    'wrc_plus_against',
    'avg_launch_speed_against',
    'gb_rate',
    'markov_dominance',
  ],
  arsenal: [
    'count_conditional_entropy',
    'arsenal_synergy',
    'best_secondary_whiff',
    'spin_diversity',
    'speed_diversity',
    'platoon_resistance',
    'n_pitch_types',
    'pitch_entropy',
  ],
};

// ─── Metrics where LOWER is better ────────────────────────────────────────

export const LOWER_IS_BETTER = new Set<MetricKey>([
  'loc_precision',
  'release_consistency',
  'temporal_tunnel_tightness',   // lower = pitches look identical at commit point
  'tunnel_tightness',
  'wrc_plus_against',
  'bb_rate',
  'avg_launch_speed_against',
  // v3.1: run-value metrics (lower RV = pitcher wins)
  'swing_rv_against',
  'in_zone_swing_rv',
  'chase_swing_rv',
  'take_rv_against',
  'barrel_rate_against',
  'bip_rate',
  'race_to_2_strikes',           // fewer pitches to 2 strikes = better
  'obp_hr_residual',             // FIP-buster indicator
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
  'zone_weighted_chase',
  'chase_rate',
  'csw_rate',
  'k_rate',
  'bb_rate',
  'bip_rate',
  'gb_rate',
  'best_secondary_whiff',
  'pitcher_deception_index',     // shown as %
  'platoon_resistance',
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
  return PITCH_TYPE_COLORS[type] ?? '#e0e0e8';
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
  ...Object.entries(METRIC_LABELS).map(([k, v]) => ({
    key: `metric_${k}`,
    label: v,
    group: 'Metrics',
  })),
];
