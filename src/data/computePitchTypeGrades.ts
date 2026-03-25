import type { RawPitch, PitchTypeGrade } from '../types';
import { toScoutingGrade } from './constants';

// ─── Pitch type display names ────────────────────────────────────────────────

export const PITCH_NAMES: Record<string, string> = {
  FF: 'Four-Seam', SI: 'Sinker', FC: 'Cutter',
  SL: 'Slider', ST: 'Sweeper', SV: 'Slurve',
  CU: 'Curveball', KC: 'Knuckle-Curve', CS: 'Slow Curve',
  CH: 'Changeup', FS: 'Splitter', SC: 'Screwball',
  KN: 'Knuckleball', EP: 'Eephus', FA: 'Fastball',
  FO: 'Forkball',
};

// ─── League average structure from scoring_config.json ───────────────────────

interface LeagueAvgDetailed {
  n: number;
  avg_velo: number;  std_velo: number;
  avg_spin: number;  std_spin: number;
  avg_ivb: number;   std_ivb: number;
  avg_hb: number;    std_hb: number;
  avg_ext: number;   std_ext: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function zToGrade(value: number | null, mean: number, std: number): number {
  if (value == null || std === 0) return 100;
  const z = (value - mean) / std;
  return Math.max(20, Math.min(180, Math.round(100 + z * 15)));
}

// ─── Main computation ────────────────────────────────────────────────────────

export function computePitchTypeGrades(
  pitches: RawPitch[],
  leagueAvgs: Record<string, LeagueAvgDetailed>,
  pitchNames?: Record<string, string>,
): PitchTypeGrade[] {
  if (pitches.length === 0) return [];

  const names = pitchNames ?? PITCH_NAMES;
  const totalPitches = pitches.length;

  // Group pitches by type
  const grouped = new Map<string, RawPitch[]>();
  for (const p of pitches) {
    const arr = grouped.get(p.pt);
    if (arr) arr.push(p);
    else grouped.set(p.pt, [p]);
  }

  const grades: PitchTypeGrade[] = [];

  for (const [pt, ptPitches] of grouped) {
    const count = ptPitches.length;
    const la = leagueAvgs[pt];

    // Physical metrics
    const velos = ptPitches.filter(p => p.v > 0).map(p => p.v);
    const spins = ptPitches.filter(p => p.sp > 0).map(p => p.sp);
    const ivbs = ptPitches.filter(p => p.ivb != null).map(p => p.ivb);
    const hbs = ptPitches.filter(p => p.hb != null).map(p => p.hb);
    const vaas = ptPitches.filter(p => p.vaa != null).map(p => p.vaa!);
    const exts = ptPitches.filter(p => p.ext > 0).map(p => p.ext);

    const avgVelo = avg(velos);
    const avgSpin = avg(spins);
    const avgIvb = avg(ivbs);
    const avgHb = avg(hbs);
    const avgVaa = avg(vaas);
    const avgExt = avg(exts);

    // Outcome stats
    const inZone = ptPitches.filter(p => p.z >= 1 && p.z <= 9);
    const outZone = ptPitches.filter(p => p.z > 9);
    const swings = ptPitches.filter(p => p.sw);
    const whiffs = ptPitches.filter(p => p.wh);
    const calledStrikes = ptPitches.filter(p => p.desc === 'Called Strike');

    const zoneRate = count > 0 ? inZone.length / count : null;
    const chaseRate = outZone.length > 0
      ? outZone.filter(p => p.sw).length / outZone.length
      : null;
    const whiffRate = swings.length > 0
      ? whiffs.length / swings.length
      : null;
    const cswRate = count > 0
      ? (whiffs.length + calledStrikes.length) / count
      : null;

    // Grade against league averages for this pitch type
    let veloGrade = 100, spinGrade = 100, ivbGrade = 100, hbGrade = 100, extGrade = 100;
    if (la) {
      veloGrade = zToGrade(avgVelo, la.avg_velo, la.std_velo);
      spinGrade = zToGrade(avgSpin, la.avg_spin, la.std_spin);
      ivbGrade = zToGrade(avgIvb, la.avg_ivb, la.std_ivb);
      hbGrade = zToGrade(avgHb, la.avg_hb, la.std_hb);
      extGrade = zToGrade(avgExt, la.avg_ext, la.std_ext);
    }

    // Composite stuff grade: weighted average of physical attribute grades
    const stuffGrade = Math.round(
      veloGrade * 0.30 +
      spinGrade * 0.15 +
      ivbGrade * 0.25 +
      hbGrade * 0.15 +
      extGrade * 0.15
    );

    grades.push({
      pitchType: pt,
      pitchName: names[pt] ?? pt,
      count,
      usagePct: totalPitches > 0 ? count / totalPitches : 0,
      avgVelo, avgSpin, avgIvb, avgHb, avgVaa, avgExt,
      zoneRate, chaseRate, whiffRate, cswRate,
      stuffGrade,
      scoutingGrade: toScoutingGrade(stuffGrade),
      veloGrade, spinGrade, ivbGrade, hbGrade, extGrade,
    });
  }

  // Sort by usage (most used first)
  grades.sort((a, b) => b.count - a.count);
  return grades;
}
