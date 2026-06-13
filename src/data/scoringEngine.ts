import type { RawPitch, ScoringConfig, ComputedMetrics, ComputedScores } from '../types';

// ─── Math helpers ─────────────────────────────────────────────────────────────

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function shannonEntropy(counts: Map<string, number>, total: number): number {
  if (total === 0) return 0;
  let entropy = 0;
  for (const count of counts.values()) {
    if (count === 0) continue;
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ─── wOBA linear weights (approximate from scoring_config) ───────────────────
const WOBA_WEIGHTS: Record<string, number> = {
  walk: 0.69,
  hit_by_pitch: 0.72,
  single: 0.89,
  double: 1.27,
  triple: 1.62,
  home_run: 2.10,
};

// ─── Main metric computation ──────────────────────────────────────────────────

export function computeMetrics(pitches: RawPitch[], config: ScoringConfig): ComputedMetrics {
  const n = pitches.length;
  if (n === 0) return {};

  const swings = pitches.filter((p) => p.sw);
  const whiffs = pitches.filter((p) => p.wh);
  const inZone = pitches.filter((p) => p.z >= 1 && p.z <= 9);
  const edgeZone = pitches.filter((p) => p.z >= 11 && p.z <= 14);
  const outZone = pitches.filter((p) => p.z > 9);
  const inPlay = pitches.filter((p) => p.ip);
  const events = pitches.filter((p) => p.et);
  const calledStrikes = pitches.filter((p) => p.desc === 'Called Strike');

  // Strike rate metric (lower dispersion = better)
  const pxValues = pitches.map((p) => p.px);
  const pzValues = pitches.map((p) => p.pz);
  const locPrecision = (std(pxValues) + std(pzValues)) / 2;

  // In-zone whiff rate
  const inZoneSwings = inZone.filter((p) => p.sw);
  const inZoneWhiffs = inZone.filter((p) => p.wh);
  const inZoneWhiffRate =
    inZoneSwings.length > 0 ? inZoneWhiffs.length / inZoneSwings.length : null;

  // Chase rate
  const chaseRate =
    outZone.length > 0 ? outZone.filter((p) => p.sw).length / outZone.length : null;

  // K/BB rates from terminal events
  const kEvents = events.filter((p) => p.et === 'strikeout').length;
  const bbEvents = events.filter((p) => p.et === 'walk').length;
  const kRate = events.length > 0 ? kEvents / events.length : null;
  const bbRate = events.length > 0 ? bbEvents / events.length : null;
  const kBbPct = kRate !== null && bbRate !== null ? kRate - bbRate : null;

  // First pitch strike rate
  const firstPitches = pitches.filter((p) => p.s === 0 && p.b === 0);
  const firstPitchStrikes = firstPitches.filter(
    (p) =>
      p.sw ||
      p.desc === 'Called Strike' ||
      p.desc === 'Foul' ||
      p.desc === 'Foul Tip' ||
      p.ip
  );
  const firstPitchStrikeRate =
    firstPitches.length > 0 ? firstPitchStrikes.length / firstPitches.length : null;

  // Pitch entropy (Shannon entropy of pitch type distribution)
  const typeCounts = new Map<string, number>();
  for (const p of pitches) {
    typeCounts.set(p.pt, (typeCounts.get(p.pt) ?? 0) + 1);
  }
  const pitchEntropy = shannonEntropy(typeCounts, n);

  // Best secondary whiff rate (non-fastball)
  const fbTypes = new Set(config.fastball_types);
  const secondaryTypes = Array.from(typeCounts.keys()).filter((t) => !fbTypes.has(t));
  let bestSecondaryWhiff: number | null = null;
  for (const pt of secondaryTypes) {
    const ptSwings = pitches.filter((p) => p.pt === pt && p.sw);
    const ptWhiffs = pitches.filter((p) => p.pt === pt && p.wh);
    if (ptSwings.length >= 3) {
      const wr = ptWhiffs.length / ptSwings.length;
      if (bestSecondaryWhiff === null || wr > bestSecondaryWhiff) {
        bestSecondaryWhiff = wr;
      }
    }
  }

  // Launch speed against
  const launchSpeeds = inPlay.filter((p) => p.ls != null).map((p) => p.ls as number);
  const avgLaunchSpeedAgainst = mean(launchSpeeds);

  // GB rate (launch angle < 10 degrees)
  const gbRate =
    inPlay.length > 0
      ? inPlay.filter((p) => p.la != null && p.la < 10).length / inPlay.length
      : null;

  // wRC+ against (simplified wOBA-based)
  let wobaAgainst: number | null = null;
  if (events.length > 0) {
    let wobaSum = 0;
    let wobaDenom = 0;
    for (const p of events) {
      if (!p.et) continue;
      const w = WOBA_WEIGHTS[p.et];
      if (w !== undefined) {
        wobaSum += w;
      }
      // denominator: PA-like (exclude intentional walks if distinguishable)
      wobaDenom++;
    }
    if (wobaDenom > 0) {
      const wobaPct = wobaSum / wobaDenom;
      // wRC+ against = ((wOBA - lgwOBA) / wOBA_scale + lgR/PA) / lgR/PA * 100
      const lgWoba = config.league_woba ?? 0.315;
      const wobaScale = config.woba_scale ?? 1.15;
      const lgRpa = config.lg_rpa ?? 0.11;
      const wrcPlus = ((wobaPct - lgWoba) / wobaScale + lgRpa) / lgRpa * 100;
      wobaAgainst = Math.round(wrcPlus);
    }
  }

  // Extension and perceived velo
  const extValues = pitches.filter((p) => p.ext > 0).map((p) => p.ext);
  const pvValues = pitches.filter((p) => p.pv > 0).map((p) => p.pv);
  const fbVaaValues = pitches
    .filter((p) => fbTypes.has(p.pt) && p.vaa != null)
    .map((p) => p.vaa as number);

  return {
    zone_rate: inZone.length / n,
    edge_rate: edgeZone.length / n,
    loc_precision: locPrecision,
    whiff_rate: swings.length > 0 ? whiffs.length / swings.length : null,
    in_zone_whiff_rate: inZoneWhiffRate,
    chase_rate: chaseRate,
    csw_rate: (whiffs.length + calledStrikes.length) / n,
    k_rate: kRate,
    bb_rate: bbRate,
    k_bb_pct: kBbPct,
    // K%×1.3 − BB% — mirrors novel_metrics.py; the scored Command metric
    bip_adjusted_kbb: kRate != null && bbRate != null ? 1.3 * kRate - bbRate : null,
    avg_extension: mean(extValues),
    avg_perceived_velo: mean(pvValues),
    fb_vaa: mean(fbVaaValues),
    avg_launch_speed_against: avgLaunchSpeedAgainst,
    gb_rate: gbRate,
    first_pitch_strike_rate: firstPitchStrikeRate,
    pitch_entropy: pitchEntropy,
    n_pitch_types: typeCounts.size,
    best_secondary_whiff: bestSecondaryWhiff,
    wrc_plus_against: wobaAgainst,
  };
}

// ─── Score a single metric ────────────────────────────────────────────────────

export function scoreMetric(
  value: number,
  popMean: number,
  popStd: number,
  direction: string
): number {
  let sd = popStd;
  if (sd === 0) sd = Math.abs(popMean) * 0.1 || 1;
  const z = direction === 'lower' ? (popMean - value) / sd : (value - popMean) / sd;
  return Math.max(20, Math.min(180, 70 + z * 15));
}

// ─── Compute all dimension scores and overall Pitch+ ─────────────────────────

export function computeScores(
  metrics: ComputedMetrics,
  config: ScoringConfig,
  fullSeasonGrades?: Record<string, { grade: number; raw: number }>
): ComputedScores {
  const dimensionScores: Record<string, number | null> = {};
  const fullSeasonOnly = new Set(config.fullseason_only_metrics ?? []);

  for (const [dimKey, dimDef] of Object.entries(config.dimensions)) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const metricDef of dimDef.metrics) {
      const { key, direction, weight } = metricDef;

      // Full-season-only metrics: use provided grades if available
      if (fullSeasonOnly.has(key)) {
        if (fullSeasonGrades && fullSeasonGrades[key] != null) {
          weightedSum += fullSeasonGrades[key].grade * weight;
          totalWeight += weight;
        }
        continue;
      }

      const value = metrics[key];
      if (value == null) continue;

      const popStat = config.population_stats[key];
      if (!popStat) continue;

      const score = scoreMetric(value, popStat.mean, popStat.std, direction);
      weightedSum += score * weight;
      totalWeight += weight;
    }

    dimensionScores[dimKey] = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  }

  // Overall Pitch+ = weighted average of dimension scores
  let totalScore = 0;
  let totalWeight = 0;
  for (const [dimKey, dimDef] of Object.entries(config.dimensions)) {
    const score = dimensionScores[dimKey];
    if (score == null) continue;
    totalScore += score * dimDef.weight;
    totalWeight += dimDef.weight;
  }

  const pitchPlus = totalWeight > 0 ? Math.round(totalScore / totalWeight) : null;

  return { dimensions: dimensionScores, pitchPlus };
}
