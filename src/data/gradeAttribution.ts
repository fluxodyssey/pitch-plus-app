import type { Pitcher, DimensionKey, AttributeGrades } from '../types';
import type { PercentileEntry } from './percentiles';

export interface GradeDriver {
  label: string;
  percentile: number;
  contribution: 'positive' | 'negative' | 'neutral';
}

export interface DimensionExplanation {
  dimensionKey: DimensionKey;
  score: number;
  drivers: GradeDriver[];   // up to 3, sorted by impact magnitude
  summary: string;
}

function contribution(pct: number): GradeDriver['contribution'] {
  if (pct >= 60) return 'positive';
  if (pct <= 40) return 'negative';
  return 'neutral';
}

function gradeToPercentile(grade: number): number {
  // Grade 0-200, centered at 100 = 50th percentile
  // Linear: grade 100 → 50th pct, grade 150 → 75th, grade 50 → 25th
  return Math.round(Math.max(1, Math.min(99, (grade / 200) * 100)));
}

function buildSummary(drivers: GradeDriver[]): string {
  if (drivers.length === 0) return '';
  const positives = drivers.filter(d => d.contribution === 'positive');
  const negatives = drivers.filter(d => d.contribution === 'negative');

  const parts: string[] = [];
  if (positives.length > 0) {
    parts.push(`Led by ${positives.slice(0, 2).map(d => `${d.label} (${d.percentile}th)`).join(' and ')}`);
  }
  if (negatives.length > 0) {
    parts.push(`held back by ${negatives.slice(0, 1).map(d => `${d.label} (${d.percentile}th)`).join(', ')}`);
  }
  return parts.join('; ') + '.';
}

export function computeGradeAttribution(
  pitcher: Pitcher,
  attributesByType: Record<string, AttributeGrades> | null,
  percentiles: PercentileEntry | undefined,
): DimensionExplanation[] {
  const results: DimensionExplanation[] = [];

  if (!attributesByType) return results;

  // Sort pitch types by usage descending
  const sortedTypes = Object.entries(attributesByType)
    .sort((a, b) => b[1].usage_pct - a[1].usage_pct);

  // ── Stuff ─────────────────────────────────────────────────────────────────
  {
    const dim = pitcher.dimensions['stuff'];
    // Best pitch type by overall attribute grade
    const drivers: GradeDriver[] = sortedTypes
      .flatMap(([pt, attrs]) => [
        { label: `${pt} velocity`, percentile: gradeToPercentile(attrs.velo), contribution: contribution(gradeToPercentile(attrs.velo)) },
        { label: `${pt} movement`, percentile: gradeToPercentile(attrs.movement), contribution: contribution(gradeToPercentile(attrs.movement)) },
        { label: `${pt} spin efficiency`, percentile: gradeToPercentile(attrs.spin_efficiency), contribution: contribution(gradeToPercentile(attrs.spin_efficiency)) },
      ])
      .sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50))
      .slice(0, 3);

    results.push({
      dimensionKey: 'stuff',
      score: dim.score,
      drivers,
      summary: buildSummary(drivers),
    });
  }

  // ── Command ───────────────────────────────────────────────────────────────
  {
    const dim = pitcher.dimensions['command'];
    const drivers: GradeDriver[] = [];

    // Location quality across pitch types
    const locDrivers = sortedTypes
      .map(([pt, attrs]) => ({
        label: `${pt} location`,
        percentile: gradeToPercentile(attrs.location),
        contribution: contribution(gradeToPercentile(attrs.location)),
      }))
      .sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50))
      .slice(0, 2);
    drivers.push(...locDrivers);

    // BIP-adjusted K-BB% — the scored Command signal (k_bb_pct was purged from
    // metric_grades, so the old driver could never fire)
    if (percentiles?.metrics.bip_adjusted_kbb != null) {
      drivers.push({
        label: 'BIP-Adj K-BB%',
        percentile: percentiles.metrics.bip_adjusted_kbb,
        contribution: contribution(percentiles.metrics.bip_adjusted_kbb),
      });
    }

    drivers.sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));

    results.push({
      dimensionKey: 'command',
      score: dim.score,
      drivers: drivers.slice(0, 3),
      summary: buildSummary(drivers.slice(0, 3)),
    });
  }

  // ── Deception ─────────────────────────────────────────────────────────────
  {
    const dim = pitcher.dimensions['deception'];
    const drivers: GradeDriver[] = [];

    // Extension is the main physical deception driver
    const bestExt = sortedTypes
      .map(([pt, attrs]) => ({
        label: `${pt} extension`,
        percentile: gradeToPercentile(attrs.extension),
        contribution: contribution(gradeToPercentile(attrs.extension)),
      }))
      .sort((a, b) => b.percentile - a.percentile)[0];
    if (bestExt) drivers.push(bestExt);

    // Movement diversity creates deception — best + worst movement ideality
    const byMovement = sortedTypes.map(([pt, attrs]) => ({
      label: `${pt} movement`,
      percentile: gradeToPercentile(attrs.movement),
      contribution: contribution(gradeToPercentile(attrs.movement)),
    })).sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));
    drivers.push(...byMovement.slice(0, 1));

    // Whiff rate from outcome metrics
    if (percentiles?.metrics.in_zone_whiff_rate != null) {
      drivers.push({
        label: 'in-zone whiff rate',
        percentile: percentiles.metrics.in_zone_whiff_rate,
        contribution: contribution(percentiles.metrics.in_zone_whiff_rate),
      });
    }

    drivers.sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));

    results.push({
      dimensionKey: 'deception',
      score: dim.score,
      drivers: drivers.slice(0, 3),
      summary: buildSummary(drivers.slice(0, 3)),
    });
  }

  // ── Arsenal ───────────────────────────────────────────────────────────────
  {
    const dim = pitcher.dimensions['arsenal'];
    const drivers: GradeDriver[] = [];

    // Best secondary (non-fastball) pitch by overall grade
    const secondaries = sortedTypes
      .filter(([pt]) => !['FF', 'FA', 'SI', 'FC'].includes(pt))
      .map(([pt, attrs]) => ({
        label: `${pt} overall stuff`,
        percentile: gradeToPercentile(attrs.overall),
        contribution: contribution(gradeToPercentile(attrs.overall)),
      }))
      .sort((a, b) => b.percentile - a.percentile);
    if (secondaries.length > 0) drivers.push(secondaries[0]!);

    // Arsenal diversity (implied by spread of overall grades across types)
    const overalls = sortedTypes.map(([, attrs]) => attrs.overall);
    const spread = overalls.length > 1 ? Math.max(...overalls) - Math.min(...overalls) : 0;
    const spreadPct = Math.min(99, Math.max(1, spread * 0.6)); // rough normalization
    drivers.push({
      label: 'arsenal diversity',
      percentile: Math.round(spreadPct),
      contribution: contribution(spreadPct),
    });

    // CSW from outcome metrics
    if (percentiles?.metrics.csw_rate != null) {
      drivers.push({
        label: 'CSW%',
        percentile: percentiles.metrics.csw_rate,
        contribution: contribution(percentiles.metrics.csw_rate),
      });
    }

    drivers.sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));

    results.push({
      dimensionKey: 'arsenal',
      score: dim.score,
      drivers: drivers.slice(0, 3),
      summary: buildSummary(drivers.slice(0, 3)),
    });
  }

  // ── Outcomes ──────────────────────────────────────────────────────────────
  {
    const dim = pitcher.dimensions['outcomes'];
    const drivers: GradeDriver[] = [];

    const metricKeys: Array<keyof PercentileEntry['metrics']> = ['k_rate', 'bb_rate', 'wrc_plus_against', 'avg_launch_speed_against'];
    const metricLabels: Record<string, string> = { k_rate: 'K%', bb_rate: 'BB%', wrc_plus_against: 'wRC+ against', avg_launch_speed_against: 'exit velocity against' };

    for (const mk of metricKeys) {
      const pct = percentiles?.metrics[mk];
      if (pct != null) {
        drivers.push({
          label: metricLabels[mk] ?? mk,
          percentile: pct,
          contribution: contribution(pct),
        });
      }
    }

    drivers.sort((a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50));

    results.push({
      dimensionKey: 'outcomes',
      score: dim.score,
      drivers: drivers.slice(0, 3),
      summary: buildSummary(drivers.slice(0, 3)),
    });
  }

  return results;
}
