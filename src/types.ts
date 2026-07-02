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
  // ── Stuff (ordered by 2026-05-28 reweight weights) ─────────────────────────
  | 'stuff_z'
  | 'swing_plus_suppression'     // swing quality degradation composite
  | 'avg_perceived_velo'
  | 'bat_speed_suppression'      // pitcher degrades batter bat speed
  | 'ssw_proxy'
  // ── Command ────────────────────────────────────────────────────────────────
  | 'bip_adjusted_kbb'           // K%×1.3 − BB% — replaces k_bb_pct in scoring
  | 'race_to_2_strikes'          // pitches to reach 2-strike count
  | 'loc_precision'
  | 'zone_rate'
  | 'first_pitch_strike_rate'
  | 'take_rv_against'            // passive command: mean RV on takes
  | 'edge_rate'
  | 'markov_efficiency'          // expected pitches/PA from 0-0
  // ── Deception ─────────────────────────────────────────────────────────────
  | 'in_zone_whiff_rate'
  | 'csw_rate'
  | 'chase_rate'
  | 'avg_extension'
  | 'regime_whiff_delta'         // whiff% ahead − whiff% behind
  | 'swing_length_inducement'    // longer swings = confused batter
  | 'release_consistency'
  // ── Tunnel & Sequence ─────────────────────────────────────────────────────
  | 'movement_differential'
  | 'sequence_surprise'
  | 'speed_differential'
  // ── Outcomes ──────────────────────────────────────────────────────────────
  | 'markov_dominance'           // P(K | start 0-0) — top Outcomes weight
  | 'wrc_plus_against'
  | 'k_rate'
  | 'avg_launch_speed_against'
  | 'bb_rate'
  | 'gb_rate'
  | 'bip_rate'                   // BIP per PA (BIP avoidance)
  | 'swing_rv_against'           // mean RV on swings against
  | 'in_zone_swing_rv'           // in-zone contact quality suppression
  | 'chase_swing_rv'             // bad contact on chases
  // ── Arsenal ───────────────────────────────────────────────────────────────
  | 'best_secondary_whiff'
  | 'count_conditional_entropy'
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

  // IAA fields (from induced_attack_angle.py --merge, 2025+ after bat-tracking
  // merge). Display-only — iaa_score composite failed validation, never score it.
  iaa_fb?: number | null;
  iaa_brk?: number | null;
  iaa_os?: number | null;
  iaa_n_contacts?: number | null;

  // IAA and per-pitcher bootstrap CI scalars were removed 2026-06-09: no
  // pitchers_{year}.json has carried them (re-add when the model merges them;
  // IAA validation notes live in models/CLAUDE.md).

  // Swing-timing display fields (swing_timing.py --merge, 2023+)
  timing_disruption?: number | null;        // inches, higher = better (displaces swing timing)
  plane_mismatch_induced?: number | null;   // degrees, higher = better (forces off-plane swings)
  miss_distance_against?: number | null;    // inches, neutral descriptor (mean bat-miss on whiffs)

  // Tunnel display fields (tunnel_metrics.py --merge)
  temporal_tunnel_tightness?: number | null;     // feet, lower = better (spread at 167ms commit)
  temporal_tunnel_effectiveness?: number | null; // ratio, higher = better (plate ÷ commit spread)
  release_uniqueness?: number | null;            // population-σ units, neutral descriptor

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
  // Swing-timing display fields (swing_timing.py --merge, 2023+)
  timing_consistency?: number | null;  // inches σ, lower = steadier (neutral descriptor)
  barrel_accuracy?: number | null;     // inches, mean whiff miss distance (neutral descriptor)
  perfect_swing_rate?: number | null;  // 0-1 fraction, higher = better (league ≈ 20%)
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

/** Per-pitch-type league averages in scoring_config.json (written by the Python pipeline). */
export interface LeagueAvgDetailed {
  n: number;
  avg_velo: number;  std_velo: number;
  avg_spin: number;  std_spin: number;
  avg_ivb: number;   std_ivb: number;
  avg_hb: number;    std_hb: number;
  /** Hand-neutral |HB| stats (2026-06-12) — grade HB against these, not signed avg_hb. */
  avg_abs_hb?: number;  std_abs_hb?: number;
  avg_ext: number;   std_ext: number;
  avg_spin_eff?: number;  std_spin_eff?: number;
  /** League whiff/zone/chase rates (2026-06-10) — drive GameSummary cell shading. */
  avg_whiff_rate?: number | null;
  avg_zone_rate?: number | null;
  avg_chase_rate?: number | null;
}

export interface ScoringConfig {
  dimensions: Record<string, {
    label: string;
    weight: number;
    metrics: Array<{ key: string; direction: string; weight: number }>;
  }>;
  population_stats: Record<string, { mean: number; std: number; p25: number; p75: number }>;
  league_averages: Record<string, LeagueAvgDetailed>;
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

// ─── Graded Pitch Slices (models/score_slice.py → graded_slices_{year}.json) ───
// The per-pitch grade foundation aggregated to sliceable grains. Every grade is
// 100/σ=15, standardized across all pitchers' cells AT THAT GRAIN and
// reliability-shrunk toward league mean (small samples pulled to average).
export interface SliceGrades {
  quality: number | null; // Quality+ (xRV) — expected run value from shape+location (higher = better)
  stuff: number | null;   // Stuff+ — expected run value from shape ONLY (location-free; quality−stuff ≈ command)
  xwhiff: number | null;  // expected whiff from shape
  whiff: number | null;   // realized whiff rate
  velo: number | null;
}
export interface GameSlice extends SliceGrades { date: string; n: number; }
export interface CellSlice extends SliceGrades { n: number; }
export interface GradedPitcher {
  name: string;
  hand: string | null;
  n: number;
  season: SliceGrades;
  games: GameSlice[];
  counts: Record<string, CellSlice>;   // 'ahead' | 'even' | 'behind'
  hands: Record<string, CellSlice>;    // 'L' | 'R'
}
export interface GradedSlices {
  metadata: { season: number; n_pitchers: number; metrics: Record<string, string> };
  pitchers: Record<string, GradedPitcher>;
}
export type SliceMetricKey = keyof SliceGrades;

// ─── Pitch-level custom slicing (models/score_slice.py --export-pitches) ───
// slice_pitches/{year}/{pitcher_id}.json is compact {f: field names, p: rows};
// the files are gitignored (regenerate via the pipeline). NOT pitches/{year}/ —
// that is usePitchData's older, incompatible schema. pitch_calibration.json
// (committed) carries season-grain calibration per year+metric so the client
// grades any filtered slice on the SEASON scale: aggregate raw → shrink toward
// league → z vs (mu, sd) → 100/σ=15.
export interface PitcherPitchFile { f: string[]; p: (number | string | null)[][]; }
export interface PitchMetricCal {
  league: number;   // league per-pitch mean of the raw source
  mu: number;       // mean of shrunk pitcher-season values
  sd: number;       // sd (ddof=0) of shrunk pitcher-season values
  k: number;        // reliability shrinkage constant (denominator units)
  higher: boolean;  // true if higher raw = better for the pitcher
  label: string;
}
// year (as string) → metric key → calibration
export type PitchCalibration = Record<string, Record<string, PitchMetricCal>>;
