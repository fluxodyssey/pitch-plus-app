// ─── Pitcher Data ───────────────────────────────────────────────────────────

export type DimensionKey =
  | 'stuff'
  | 'command'
  | 'deception'
  | 'tunnel_and_sequence'
  | 'outcomes'
  | 'arsenal';

export type MetricKey =
  | 'stuff_z'
  | 'ssw_proxy'
  | 'avg_perceived_velo'
  | 'k_bb_pct'
  | 'zone_rate'
  | 'edge_rate'
  | 'loc_precision'
  | 'first_pitch_strike_rate'
  | 'in_zone_whiff_rate'
  | 'chase_rate'
  | 'csw_rate'
  | 'avg_extension'
  | 'fb_vaa'
  | 'release_consistency'
  // New v3: temporal tunnel (velocity-adjusted commit point)
  | 'temporal_tunnel_tightness'
  | 'temporal_tunnel_effectiveness'
  | 'tunnel_tightness'
  | 'tunnel_effectiveness'
  | 'release_uniqueness'
  | 'speed_differential'
  | 'movement_differential'
  | 'sequence_surprise'
  | 'wrc_plus_against'
  | 'k_rate'
  | 'bb_rate'
  | 'avg_launch_speed_against'
  | 'gb_rate'
  | 'pitch_entropy'
  // New v3: count-conditional entropy + arsenal synergy
  | 'count_conditional_entropy'
  | 'arsenal_synergy'
  | 'n_pitch_types'
  | 'best_secondary_whiff'
  | 'platoon_resistance'
  // New v3: pitcher deception index
  | 'pitcher_deception_index';

export interface DimensionScore {
  score: number;
  grade: string;
}

export interface MetricGrade {
  grade: number;
  raw: number;
}

export interface Pitcher {
  pitcher_id: number;
  pitcher_name: string;
  pitcher_hand: 'L' | 'R' | 'S';
  pitcher_team: string;
  pitch_plus: number;
  n_pitches: number;
  n_games: number;
  dimensions: Record<DimensionKey, DimensionScore>;
  metric_grades: Record<MetricKey, MetricGrade>;
}

// ─── Pitch Attribute Intelligence ────────────────────────────────────────────

export interface AttributeGrades {
  velo: number;           // 0-200 vs pitch-type peers
  spin: number;
  movement: number;       // movement ideality for this pitch type
  location: number;       // non-center zone rate vs pitch-type peers
  extension: number;      // vs all pitchers
  spin_efficiency: number;
  overall: number;        // weighted composite
  // Raw values for display
  avg_velo: number;
  avg_spin: number;
  avg_ivb: number;
  avg_hb: number;
  avg_ext: number;
  usage_pct: number;
}

export interface PitchAttributesData {
  season: number;
  n_pitchers: number;
  league_movement: Record<string, {
    n: number;
    ivb_mean: number;
    ivb_std: number;
    hb_mean: number;
    hb_std: number;
    velo_mean: number;
    velo_std: number;
    spin_mean: number;
    spin_std: number;
    ext_mean: number;
  }>;
  pitchers: Record<string, {
    types: Record<string, AttributeGrades>;
    expected_pitch_plus?: number;
    movement_diversity?: number;
  }>;
}

export interface PopulationStat {
  mean: number;
  std: number;
  p25: number;
  p75: number;
}

export interface PitchersData {
  metadata: {
    generated: string;
    n_pitchers: number;
    n_pitches: number;
    n_games: number;
    model_version: string;
  };
  population_stats: Record<MetricKey, PopulationStat>;
  dimension_weights: Record<DimensionKey, number>;
  pitchers: Pitcher[];
}

// ─── Pitch Types Data ────────────────────────────────────────────────────────

export interface PitchType {
  pitch_type: string;
  pitch_name: string;
  n: number;
  usage_pct: number;
  velo: number;
  spin: number;
  ivb: number;
  hb: number;
  ext: number;
  perc_velo: number;
  whiff_rate: number;
}

export interface LeagueAvg {
  velo: number;
  spin: number;
  ivb: number;
  hb: number;
  ext: number;
}

export interface PitchTypesData {
  league_averages: Record<string, LeagueAvg>;
  pitch_names: Record<string, string>;
  pitchers: Record<string, PitchType[]>;
}

// ─── Rotations Data ──────────────────────────────────────────────────────────

export interface TeamRotation {
  team_name: string;
  rotation_ids: number[];
  rotation_names: string[];
}

export interface RotationsData {
  teams: Record<string, TeamRotation>;
}

// ─── Batter BDQ Data ─────────────────────────────────────────────────────────

export interface Batter {
  batter_id: number;
  batter_name: string;
  batter_hand: 'L' | 'R' | 'S';
  batter_team: string;
  n_deceptive: number;
  n_bad: number;
  n_chases: number;
  chase_whiff_rate: number;
  bad_chase_rate: number;
  deceptive_chase_rate: number;
}

export interface BatterBDQData {
  metadata: {
    n_batters: number;
    source: string;
    model: string;
  };
  batters: Batter[];
}

// ─── Hitter (Swing+) Data ─────────────────────────────────────────────────────

export type SwingDimension =
  | 'Power Ceiling'
  | 'Batted Ball Quality'
  | 'Barrel Accuracy'
  | 'Swing Efficiency'
  | 'Swing Decisions'
  | 'Contact Quality'
  | 'Pitch Handling';

export interface SwingPlusMetrics {
  ev90: number;
  ev50: number;
  avg_launch_speed: number;
  max_launch_speed: number;
  ev_std: number;
  hard_hit_rate: number;
  barrel_rate: number;
  sweet_spot_rate: number;
  avg_launch_angle: number;
  gb_rate: number;
  avg_bat_speed: number;
  swing_length: number;
  squared_up_per_swing: number;
  blast_per_swing: number;
  speed_per_length: number;
  attack_angle: number;
  ideal_attack_angle_rate: number;
  whiff_rate: number;
  chase_rate: number;
  zone_contact_rate: number;
  in_zone_swing_rate: number;
  competitive_swing_rate: number;
  fastball_ev: number;
  offspeed_ev: number;
  breaking_ev: number;
  breaking_contact_rate: number;
  velo_adjustment: number;
  k_rate: number;
  bb_rate: number;
  xwoba: number;
  xslg: number;
  bat_speed_efficiency: number;
}

export interface DecisionPlusComponents {
  heart_swing: number;
  shadow_take: number;
  chase_take:  number;
  waste_take:  number;
}

export interface Hitter {
  rank: number;
  name: string;
  id: number;
  swing_plus: number;
  tier: string;
  n_pa: number;
  n_bbe: number;
  dimensions: Record<SwingDimension, number>;
  metrics: SwingPlusMetrics;
  // Decision+ fields (added by decision_plus.py)
  decision_plus?: number;
  decision_plus_components?: DecisionPlusComponents;
  batting_plus?: number;
}

export type EnrichedHitter = Hitter & { team: string; hand: string };

// ─── App Data ─────────────────────────────────────────────────────────────────

export interface AppData {
  pitchers: PitchersData;
  pitchTypes: PitchTypesData;
  rotations: RotationsData;
}

// ─── Raw Pitch Data ───────────────────────────────────────────────────────────

export interface RawPitch {
  pid: number;
  gid: number;
  gd: string;
  inn: number;
  ih: string;
  abi: number;
  bid: number;
  bn: string;
  bh: string;
  s: number;
  b: number;
  o: number;
  pt: string;
  v: number;
  sp: number;
  ivb: number;
  hb: number;
  px: number;
  pz: number;
  ext: number;
  vaa: number | null;
  pv: number;
  z: number;
  sw: boolean;
  wh: boolean;
  ip: boolean;
  ls?: number;
  la?: number;
  ev?: string;
  et?: string;
  desc: string;
  pn: string;
  ph: string;
  ptm: string;
}

export interface GameInfo {
  date: string;
  away: string;
  home: string;
}

export interface PitchFilters {
  dateFrom: string | null;
  dateTo: string | null;
  pitchTypes: string[];
  counts: string[];
  batterHand: 'L' | 'R' | 'all';
  innings: number[];
  outs: number[];
  zone: 'in' | 'edge' | 'chase' | 'all';
  result: 'swing' | 'take' | 'whiff' | 'in-play' | 'all';
  veloMin: number | null;
  veloMax: number | null;
  gameId: number | null;
}

export interface GameAppearance {
  gameId: number;
  date: string;
  opponent: string;
  isHome: boolean;
  pitchCount: number;
  innings: number;
  strikeouts: number;
  walks: number;
  hits: number;
}

export interface ScoringConfig {
  dimensions: Record<string, {
    label: string;
    weight: number;
    metrics: Array<{ key: string; direction: string; weight: number }>;
  }>;
  population_stats: Record<string, { mean: number; std: number; p25: number; p75: number }>;
  league_averages: Record<string, Record<string, number>>;
  fastball_types: string[];
  recomputable_metrics: string[];
  fullseason_only_metrics: string[];
  league_woba: number;
  woba_scale: number;
  lg_rpa: number;
}

export interface ComputedMetrics {
  [key: string]: number | null;
}

export interface ComputedScores {
  dimensions: Record<string, number | null>;
  pitchPlus: number | null;
}
