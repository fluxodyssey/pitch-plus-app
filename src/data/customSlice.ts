/**
 * customSlice.ts — client-side custom-slice grading over per-pitcher pitch files.
 *
 * Mirrors models/score_slice.py EXACTLY (same shrinkage + scaling math): a custom
 * slice is filter → aggregate raw → reliability-shrink toward league → z against
 * the SEASON-grain calibration (pitch_calibration.json) → 100/σ=15, clip [20,180].
 * Grades answer "if this slice were a pitcher-season, what would it grade?" —
 * so a no-filter slice reproduces the season anchor from graded_slices_{year}.json.
 */
import type { PitcherPitchFile, PitchMetricCal, SliceMetricKey } from '../types';

export const SCORE_CENTER = 100;
export const SCORE_SCALE = 15;
export const SCORE_CLIP: readonly [number, number] = [20, 180];

export interface PitchRow {
  date: string;          // YYYY-MM-DD
  game: number;
  ab: number;            // at-bat index within game
  b: number;             // balls
  s: number;             // strikes
  bh: string;            // batter hand 'L' | 'R'
  pt: string;            // pitch type
  zone: number | null;   // statcast zone: 1-9 in-zone, 11-14 out
  xrv: number | null;    // expected RV, shape+location (offense-positive)
  xrvs: number | null;   // expected RV, shape only
  pw: number | null;     // P(whiff|swing) — null on non-swings
  sw: number | null;     // is_swing 0/1
  wf: number | null;     // is_whiff 0/1
  velo: number | null;
}

function num(v: number | string | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function parsePitchFile(file: PitcherPitchFile): PitchRow[] {
  const idx = new Map<string, number>(file.f.map((name, i) => [name, i]));
  const at = (row: (number | string | null)[], name: string): number | string | null => {
    const i = idx.get(name);
    return i === undefined ? null : row[i] ?? null;
  };
  return file.p.map((row) => ({
    date: String(at(row, 'date') ?? ''),
    game: num(at(row, 'game')) ?? 0,
    ab: num(at(row, 'ab')) ?? 0,
    b: num(at(row, 'b')) ?? 0,
    s: num(at(row, 's')) ?? 0,
    bh: String(at(row, 'bh') ?? ''),
    pt: String(at(row, 'pt') ?? ''),
    zone: num(at(row, 'zone')),
    xrv: num(at(row, 'xrv')),
    xrvs: num(at(row, 'xrvs')),
    pw: num(at(row, 'pw')),
    sw: num(at(row, 'sw')),
    wf: num(at(row, 'wf')),
    velo: num(at(row, 'velo')),
  }));
}

export interface SliceFilters {
  balls: number | null;        // exact count value; null = any
  strikes: number | null;
  hand: 'L' | 'R' | null;
  pitchType: string | null;
  zone: 'in' | 'out' | null;   // 1-9 in-zone, 11+ out of zone
  from: string | null;         // YYYY-MM-DD inclusive
  to: string | null;
}

export const EMPTY_FILTERS: SliceFilters = {
  balls: null, strikes: null, hand: null, pitchType: null, zone: null, from: null, to: null,
};

export function filterPitches(rows: PitchRow[], f: SliceFilters): PitchRow[] {
  return rows.filter((r) =>
    (f.balls == null || r.b === f.balls) &&
    (f.strikes == null || r.s === f.strikes) &&
    (f.hand == null || r.bh === f.hand) &&
    (f.pitchType == null || r.pt === f.pitchType) &&
    (f.zone == null || (r.zone != null && (f.zone === 'in' ? r.zone >= 1 && r.zone <= 9 : r.zone >= 11))) &&
    (f.from == null || f.from === '' || r.date >= f.from) &&
    (f.to == null || f.to === '' || r.date <= f.to));
}

export interface CustomSliceResult {
  n: number;
  swings: number;
  grades: Record<SliceMetricKey, number | null>;
}

/** Grade a set of pitches on the season scale. Mirrors score_slice._shrink +
 *  slice_grades: shrunk = (denom·raw + k·league)/(denom + k), raw→league when
 *  the slice has no data for a metric; z sign flips for lower-is-better. */
export function gradeSlice(
  rows: PitchRow[],
  cal: Record<string, PitchMetricCal> | undefined,
): CustomSliceResult {
  const n = rows.length;
  let swings = 0;
  let whiffs = 0;
  const xrv: number[] = [];
  const xrvs: number[] = [];
  const pw: number[] = [];
  const velo: number[] = [];
  for (const r of rows) {
    if (r.sw === 1) swings++;
    if (r.wf === 1) whiffs++;
    if (r.xrv != null) xrv.push(r.xrv);
    if (r.xrvs != null) xrvs.push(r.xrvs);
    if (r.pw != null) pw.push(r.pw);
    if (r.velo != null) velo.push(r.velo);
  }
  const mean = (a: number[]): number | null =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

  // raw + denominator per metric — same denominators as score_slice.METRICS
  const raws: Record<SliceMetricKey, { raw: number | null; denom: number }> = {
    quality: { raw: mean(xrv), denom: n },
    stuff: { raw: mean(xrvs), denom: n },
    xwhiff: { raw: mean(pw), denom: swings },
    whiff: { raw: swings > 0 ? whiffs / swings : null, denom: swings },
    velo: { raw: mean(velo), denom: n },
  };

  const grades = {} as Record<SliceMetricKey, number | null>;
  for (const key of Object.keys(raws) as SliceMetricKey[]) {
    const c = cal?.[key];
    if (!c) {
      grades[key] = null;
      continue;
    }
    const { raw, denom } = raws[key];
    // denom + k can only be 0 if both are 0 (empty slice, k=0) — league, not NaN
    const shrunk = denom + c.k > 0
      ? (denom * (raw ?? c.league) + c.k * c.league) / (denom + c.k)
      : c.league;
    let z = c.sd > 0 ? (shrunk - c.mu) / c.sd : 0;
    if (!c.higher) z = -z;
    const score = Math.round(SCORE_CENTER + SCORE_SCALE * z);
    grades[key] = Math.min(SCORE_CLIP[1], Math.max(SCORE_CLIP[0], score));
  }
  return { n, swings, grades };
}
