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
  stuff: ['stuff_z', 'ssw_proxy', 'avg_perceived_velo'],
  command: [
    'k_bb_pct',
    'zone_rate',
    'edge_rate',
    'loc_precision',
    'first_pitch_strike_rate',
    'in_zone_whiff_rate',
    'chase_rate',
    'csw_rate',
  ],
  deception: [
    'in_zone_whiff_rate',
    'pitcher_deception_index',
    'chase_rate',
    'csw_rate',
    'avg_extension',
    'fb_vaa',
    'release_consistency',
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
  outcomes: ['wrc_plus_against', 'k_rate', 'bb_rate', 'avg_launch_speed_against', 'gb_rate'],
  arsenal: [
    'count_conditional_entropy',
    'arsenal_synergy',
    'best_secondary_whiff',
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
]);

// ─── Percentage Metrics (multiply raw × 100 for display) ──────────────────

export const PCT_METRICS = new Set<MetricKey>([
  'k_bb_pct',
  'zone_rate',
  'edge_rate',
  'first_pitch_strike_rate',
  'in_zone_whiff_rate',
  'chase_rate',
  'csw_rate',
  'k_rate',
  'bb_rate',
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

export const GRADE_COLORS: Record<string, string> = {
  'A+': '#d44040',
  A: '#c85a5a',
  'B+': '#a87070',
  B: '#8890a0',
  'C+': '#6878a0',
  C: '#4a6494',
  D: '#3a5080',
};

export function gradeColor(score: number): string {
  return GRADE_COLORS[numericGrade(score)] ?? '#e0e0e8';
}

// ─── Score Color (table cells) ────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 115) return 'rgba(212,64,64,0.25)';
  if (score >= 105) return 'rgba(200,90,90,0.15)';
  if (score >= 95) return 'transparent';
  if (score >= 85) return 'rgba(74,100,148,0.15)';
  return 'rgba(58,80,128,0.25)';
}

// ─── Continuous Score Color (for percentile bars, heatmaps) ──────────────

export function scoreColorContinuous(score: number, alpha = 1): string {
  // Maps score (0-200, centered at 100) to red(good) → gray(avg) → blue(bad)
  const t = Math.max(0, Math.min(1, (score - 50) / 100)); // 0=bad(50), 1=good(150)
  let r: number, g: number, b: number;
  if (t >= 0.5) {
    // neutral → red (good)
    const s = (t - 0.5) * 2; // 0..1
    r = Math.round(136 + s * 76);  // 136 → 212
    g = Math.round(144 - s * 80);  // 144 → 64
    b = Math.round(160 - s * 96);  // 160 → 64
  } else {
    // blue (bad) → neutral
    const s = t * 2; // 0..1
    r = Math.round(58 + s * 78);   // 58 → 136
    g = Math.round(80 + s * 64);   // 80 → 144
    b = Math.round(128 + s * 32);  // 128 → 160
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
