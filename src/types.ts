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
  | 'pitcher_deception_index'
  // New v3.1: backtest-validated novel metrics (2026-03-24)
  | 'bip_adjusted_kbb'        // K%×1.3 - BB% (replaces k_bb_pct in Command)
  | 'bip_rate'                // BIP per PA (Outcomes — BIP avoidance)
  | 'take_rv_against'         // passive command: mean RV on takes
  | 'called_strike_rv'        // take RV decomposition: called strikes only
  | 'ball_rv'                 // take RV decomposition: balls only
  | 'regime_whiff_delta'      // whiff% ahead - whiff% behind (Deception)
  | 'velocity_adaptation'     // velo_behind - velo_ahead (regime adaptation)
  | 'mix_adaptation'          // entropy_ahead - entropy_behind
  // Markov chain metrics (from markov_pitch.py)
  | 'markov_dominance'        // P(K | start 0-0)
  | 'markov_walk_risk'        // P(BB | start 0-0)
  | 'markov_efficiency'       // Expected pitches per PA from 0-0
  | 'markov_recovery_score'   // P(K | 2-0) / P(K | 0-0)
  | 'markov_k_from_behind'    // mean P(K) across behind-count starts
  // Stuff alpha metrics (from stuff_alpha.py)
  | 'non_stuff_alpha'         // ERA outperformance beyond Stuff+
  | 'command_alpha'           // K-BB% outperformance beyond Stuff+
  // Trajectory metrics (from trajectory.py)
  | 'trajectory_slope'        // Pitch+ trend (pts/yr via OLS)
  // v3.1 display-only fields (not scored but shown in app)
  | 'k_bb_pct';               // kept for display; scoring uses bip_adjusted_kbb

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
  ip?: number;  // season total innings pitched (baseball notation: 185.2)
  dimensions: Record<DimensionKey, DimensionScore>;
  metric_grades: Record<string, MetricGrade>;  // string (not MetricKey) for forward compat

  // v3.1 raw display fields (shown in app without requiring population stats)
  bat_speed_suppression?: number | null;
  swing_length_inducement?: number | null;
  swing_plus_suppression?: number | null;
  bip_adjusted_kbb?: number | null;
  bip_rate?: number | null;
  take_rv_against?: number | null;
  called_strike_rv?: number | null;
  ball_rv?: number | null;
  regime_whiff_delta?: number | null;
  velocity_adaptation?: number | null;
  mix_adaptation?: number | null;

  // Markov fields (from markov_pitch.py --merge)
  markov_dominance?: number | null;
  markov_walk_risk?: number | null;
  markov_efficiency?: number | null;
  markov_recovery_score?: number | null;
  markov_k_from_behind?: number | null;

  // Alpha fields (from stuff_alpha.py --merge)
  non_stuff_alpha?: number | null;
  command_alpha?: number | null;
  stuff_independence?: number | null;

  // Trajectory fields (from trajectory.py --merge)
  trajectory_slope?: number | null;
  trajectory_label?: string | null;
  trajectory_confidence?: number | null;
  seasons_observed?: number | null;

  // Bootstrap CI fields (from --bootstrap flag)
  ci_p10?: number | null;
  ci_p50?: number | null;
  ci_p90?: number | null;
  ci_width?: number | null;
  /** Per-dimension CI bands: { stuff: { p10, p90 }, command: { p10, p90 }, … } */
  dim_ci?: Partial<Record<DimensionKey, { p10: number; p90: number }>>;
  /** Per-count Markov absorption data for count-state heatmap */
  markov_count_data?: Record<string, { k: number; bb: number; bip: number; exp: number }>;
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
  homeRuns: number;
  runs: number;
}

export interface GameLogEntry {
  game_id: number;
  date: string;
  opp: string;
  home: boolean;
  p: number;    // pitches
  ip: number;   // innings pitched (baseball notation: 6.2)
  k: number;
  bb: number;
  h: number;
  hr: number;
  r: number;    // runs
  er?: number;  // earned runs
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

// ─── Per-Pitch-Type Grades ──────────────────────────────────────────────────

export interface PitchTypeGrade {
  pitchType: string;
  pitchName: string;
  count: number;
  usagePct: number;
  // Physical attributes (computed from raw pitches)
  avgVelo: number | null;
  avgSpin: number | null;
  avgIvb: number | null;
  avgHb: number | null;
  avgVaa: number | null;
  avgExt: number | null;
  // Outcome stats
  zoneRate: number | null;
  chaseRate: number | null;
  whiffRate: number | null;
  cswRate: number | null;
  // Grades (0-200, 100 = league avg for that pitch type)
  stuffGrade: number;
  scoutingGrade: number;   // 20-80 scale
  veloGrade: number;
  spinGrade: number;
  ivbGrade: number;
  hbGrade: number;
  extGrade: number;
}
