// ─── Pitcher Data ───────────────────────────────────────────────────────────

export type DimensionKey =
  | 'stuff'
  | 'command'
  | 'deception'
  | 'tunnel_and_sequence'
  | 'outcomes'
  | 'arsenal';

// ScoredMetricKey is the contract with models/constants.py:PITCH_PLUS_DIMENSIONS.
// Any change here MUST be paired with a constants.py change (and vice versa).
// The sync-types skill validates this contract; the PostToolUse hook surfaces drift.
// Use this type wherever scoring math runs.
export type ScoredMetricKey =
  // ── Stuff ──────────────────────────────────────────────────────────────────
  | 'stuff_z'
  | 'ssw_proxy'
  | 'avg_perceived_velo'
  | 'spin_direction_efficiency'  // cos(axis) × spin efficiency (Stuff)
  | 'bat_speed_suppression'      // pitcher degrades batter bat speed (Stuff)
  | 'swing_plus_suppression'     // swing quality degradation composite (Stuff)
  // ── Command ────────────────────────────────────────────────────────────────
  | 'bip_adjusted_kbb'           // K%×1.3 − BB% — replaces k_bb_pct in scoring
  | 'zone_rate'
  | 'edge_rate'
  | 'loc_precision'
  | 'first_pitch_strike_rate'
  | 'obp_hr_residual'            // FIP-buster indicator (Command)
  | 'take_rv_against'            // passive command: mean RV on takes
  | 'race_to_2_strikes'          // pitches to reach 2-strike count (Command)
  | 'markov_efficiency'          // expected pitches/PA from 0-0 (Command)
  // ── Deception ─────────────────────────────────────────────────────────────
  | 'in_zone_whiff_rate'
  | 'zone_weighted_chase'        // Decision+ zone-weighted chase rate (Deception)
  | 'chase_rate'
  | 'csw_rate'
  | 'avg_extension'
  | 'fb_vaa'
  | 'swing_length_inducement'    // longer swings = confused batter (Deception)
  | 'release_consistency'
  | 'pitcher_deception_index'
  | 'regime_whiff_delta'         // whiff% ahead − whiff% behind (Deception)
  // ── Tunnel & Sequence ─────────────────────────────────────────────────────
  | 'temporal_tunnel_tightness'
  | 'temporal_tunnel_effectiveness'
  | 'tunnel_tightness'
  | 'tunnel_effectiveness'
  | 'release_uniqueness'
  | 'speed_differential'
  | 'movement_differential'
  | 'sequence_surprise'
  // ── Outcomes ──────────────────────────────────────────────────────────────
  | 'swing_rv_against'           // mean RV on swings — best ERA predictor (r=0.854)
  | 'in_zone_swing_rv'           // in-zone contact quality suppression (r=0.799)
  | 'barrel_rate_against'        // barrel rate allowed
  | 'chase_swing_rv'             // bad contact on chases (r=0.354)
  | 'k_rate'
  | 'bb_rate'
  | 'bip_rate'                   // BIP per PA (BIP avoidance)
  | 'wrc_plus_against'
  | 'avg_launch_speed_against'
  | 'gb_rate'
  | 'markov_dominance'           // P(K | start 0-0)
  // ── Arsenal ───────────────────────────────────────────────────────────────
  | 'count_conditional_entropy'
  | 'arsenal_synergy'
  | 'best_secondary_whiff'
  | 'spin_diversity'             // decorrelated spin profiles (Arsenal)
  | 'speed_diversity'            // decorrelated speed profiles (Arsenal)
  | 'platoon_resistance'
  | 'n_pitch_types'
  | 'pitch_entropy';

// Display-only — surfaced in UI / decomposition panels, but NOT used in composite scoring.
// Adding here does NOT require a constants.py change.
export type DisplayMetricKey =
  | 'called_strike_rv'           // take RV decomposition: called strikes only
  | 'ball_rv'                    // take RV decomposition: balls only
  | 'velocity_adaptation'        // velo_behind − velo_ahead (regime adaptation)
  | 'mix_adaptation'             // entropy_ahead − entropy_behind
  | 'markov_walk_risk'           // P(BB | start 0-0)
  | 'markov_recovery_score'      // P(K | 2-0) / P(K | 0-0)
  | 'markov_k_from_behind'       // mean P(K) across behind-count starts
  | 'non_stuff_alpha'            // ERA outperformance beyond Stuff+
  | 'command_alpha'              // K-BB% outperformance beyond Stuff+
  | 'trajectory_slope'           // Pitch+ trend (pts/yr via OLS)
  | 'k_bb_pct';                  // kept for display; scoring uses bip_adjusted_kbb

// Back-compat alias. Prefer ScoredMetricKey where the math actually runs.
export type MetricKey = ScoredMetricKey | DisplayMetricKey;

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
  season?: number | null;  // season year (added by pipeline; sync-types flagged drift 2026-05-21)
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

  // IAA fields (from induced_attack_angle.py --merge)
  // iaa_score composite NOT injected — failed decile monotonicity test (Spearman r≈0).
  // iaa_fb:  YoY r=0.706, r=-0.126** vs avg EV — future Stuff candidate (display only for now)
  // iaa_brk: YoY r=0.223 (unstable), r=-0.133* vs wRC+ — display only, MIN_n_brk=75
  iaa_fb?: number | null;         // fastball IAA score (100=avg, σ=15) — validated
  iaa_brk?: number | null;        // breaking ball IAA score — display only, small-sample caution
  iaa_os?: number | null;         // offspeed IAA score — display only, no confirmed signal
  iaa_n_contacts?: number | null; // total tracked contacts used for IAA

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
  // BDQ v2: primary discipline metric — swing-decision run value per 100
  // out-of-zone pitches (higher = better). bad_chase_rate is now secondary
  // ("chase composition"). See models/run_value.py.
  n_ooz?: number;
  ooz_decision_rv?: number;
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
  // IAA batter-side fields (from induced_attack_angle.py)
  aa_opt_fb?: number | null;    // % contacts in optimal AA window vs fastballs
  aa_opt_brk?: number | null;   // % contacts in optimal AA window vs breaking balls
  aa_opt_os?: number | null;    // % contacts in optimal AA window vs offspeed
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

// ─── Game Grades ─────────────────────────────────────────────────────────────

export interface GameGradeEntry {
  game_id: number;
  date: string;
  opp: string;
  home: boolean;
  n_pitches: number;
  pitch_plus: number;
  stuff: number;
  command: number;
  deception: number;
  tunnel_and_sequence: number;
  outcomes: number;
  arsenal: number;
  deltas: {
    pitch_plus: number;
    stuff: number;
    command: number;
    deception: number;
    tunnel_and_sequence: number;
    outcomes: number;
    arsenal: number;
  };
}

export interface PitcherGameGrades {
  season_grades: {
    pitch_plus: number;
    stuff: number;
    command: number;
    deception: number;
    tunnel_and_sequence: number;
    outcomes: number;
    arsenal: number;
  };
  games: GameGradeEntry[];
}

export type GameGradesData = Record<string, PitcherGameGrades>;

// ─── Pitcher Similarity ───────────────────────────────────────────────────────

export interface SimilarPitcherEntry {
  id: number;
  name: string;
  team: string;
  hand: string;
  role: 'SP' | 'RP';
  similarity: number;
  pitch_plus: number;
  dimensions: Record<string, number>;
}

export interface PitcherSimilarityInfo {
  hand: string;
  role: 'SP' | 'RP';
  similar: SimilarPitcherEntry[];
}

export type SimilarityData = Record<string, PitcherSimilarityInfo>;

// ─── Batter Outcomes ─────────────────────────────────────────────────────────

export interface BatterOutcomeStats {
  n_pa: number;
  k_pct: number;
  bb_pct: number;
  single_pct?: number;
  double_pct?: number;
  triple_pct?: number;
  hr_pct?: number;
  xwoba?: number | null;
  avg_ev?: number | null;
  hard_hit_rate?: number | null;
  barrel_rate?: number | null;
  barrel_pct?: number | null;   // computed barrel% (replaces barrel_rate for new splits)
  pull_air_pct?: number | null; // pulled fly ball % — primary HR predictor
  gb_rate?: number | null;
  fb_rate?: number | null;
  swing_rv_for?: number | null;
  take_rv_for?: number | null;
  // BIPR (Batter Ideal Process Rate) — see models/batter_outcomes.py
  bipr_simple?: number | null;
  bipr_rv?: number | null;
  wobacon?: number | null;
  pred_rv_100?: number | null;
  n_pitches?: number | null;
  n_bip?: number | null;
}

export interface BatterOutcomeProfile {
  name: string;
  hand: string;
  team: string;
  overall?: BatterOutcomeStats;
  vs_hand?: { L?: BatterOutcomeStats; R?: BatterOutcomeStats };
  vs_pitcher?: Record<string, BatterOutcomeStats>;
  /** Outcomes vs each pitch type (FF, SL, CH, …). Min 15 PA-ending pitches to publish. */
  vs_pitch_type?: Record<string, BatterOutcomeStats>;
  /** Outcomes vs coarse shape bucket (e.g. "FB_hard_ride", "BRK_avg_sweep"). Min 15 PA. */
  vs_shape_bucket?: Record<string, BatterOutcomeStats>;
}

export type BatterOutcomesData = Record<string, BatterOutcomeProfile>;

// ─── Matchup Projection ───────────────────────────────────────────────────────

export interface MatchupOutcomes {
  reach_pct: number;
  hit_pct: number;
  hr_pct: number;
  double_triple_pct: number;
  single_pct: number;
  bb_pct: number;
  k_pct: number;
  xwoba: number;
  /** 7-way vector fields from Python backend (matchup_outcomes.py) */
  out_pct?: number;
  double_pct?: number;
  triple_pct?: number;
  hard_hit_rate?: number;
  gb_rate?: number;
  fb_rate?: number;
  barrel_rate?: number;
  wrc_plus_proj?: number;
}

export interface MatchupDeltas {
  from_batter_avg: Partial<MatchupOutcomes>;
  from_pitcher_avg: Partial<MatchupOutcomes>;
}

/** HR component breakdown — which estimator drove the HR probability */
export interface HrComponents {
  hr_from_sim:   number | null;   // similarity estimator HR%
  hr_from_shape: number | null;   // shape-mix estimator HR%
  hr_refined:    number;          // after logit refinement (final)
}

export interface MatchupProjection {
  pitcher_id: number;
  batter_id: number;
  outcomes: MatchupOutcomes;
  deltas: MatchupDeltas;
  grade: number;          // -10 to +10 (+ = batter advantage)
  grade_label: string;
  leans: 'pitcher' | 'batter' | 'neutral';
  n_similar_with_data: number;
  confidence: 'high' | 'medium' | 'low';
  /** Fraction of pitcher arsenal covered by batter shape-bucket data (0-1) */
  shape_coverage?: number;
  /** Decomposition of HR probability by estimator */
  components?: HrComponents;
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
