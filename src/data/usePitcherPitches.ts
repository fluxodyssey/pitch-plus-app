/**
 * usePitcherPitches.ts — on-demand fetch of one pitcher's pitch-level file
 * (public/data/slice_pitches/{year}/{id}.json, written by score_slice.py
 * --export-pitches and gitignored) plus the committed season calibration
 * (pitch_calibration.json). Singleton caches per the useData pattern.
 *
 * NOT /data/pitches/ — that directory belongs to usePitchData.ts (old
 * {"pitches":[...]} schema from generate_pitch_json.py).
 *
 * The slice_pitches files may legitimately be absent (fresh checkout without a
 * local pipeline run) — callers get status 'missing' and should degrade gracefully.
 */
import { useEffect, useState } from 'react';
import type { PitchCalibration, PitcherPitchFile } from '../types';
import type { PitchRow } from './customSlice';
import { parsePitchFile } from './customSlice';
import type { Season } from './useData';

// cache value: PitchRow[] = loaded, null = file missing (404), absent = not fetched yet
const pitchCache = new Map<string, PitchRow[] | null>();
const pitchInflight = new Map<string, Promise<PitchRow[] | null>>();

function fetchPitches(season: Season, pid: string): Promise<PitchRow[] | null> {
  const key = `${season}:${pid}`;
  const hit = pitchCache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const running = pitchInflight.get(key);
  if (running) return running;

  const p = fetch(`/data/slice_pitches/${season}/${pid}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<PitcherPitchFile>) : null))
    .then((d) => {
      const rows = d ? parsePitchFile(d) : null;
      pitchCache.set(key, rows);
      pitchInflight.delete(key);
      return rows;
    })
    .catch(() => {
      pitchInflight.delete(key);
      return null;
    });
  pitchInflight.set(key, p);
  return p;
}

export type PitchesState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; rows: PitchRow[] };

export function usePitcherPitches(season: Season, pid: string): PitchesState {
  const [state, setState] = useState<PitchesState>({ status: 'loading' });
  useEffect(() => {
    if (!pid) {
      setState({ status: 'missing' });
      return;
    }
    let alive = true;
    const cached = pitchCache.get(`${season}:${pid}`);
    if (cached !== undefined) {
      setState(cached === null ? { status: 'missing' } : { status: 'ready', rows: cached });
      return;
    }
    setState({ status: 'loading' });
    fetchPitches(season, pid).then((rows) => {
      if (!alive) return;
      setState(rows === null ? { status: 'missing' } : { status: 'ready', rows });
    });
    return () => {
      alive = false;
    };
  }, [season, pid]);
  return state;
}

export type CalibrationState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; data: PitchCalibration };

// undefined = not fetched yet, null = fetch failed/404, object = loaded
let calCache: PitchCalibration | null | undefined;
let calInflight: Promise<PitchCalibration | null> | null = null;

function fetchCalibration(): Promise<PitchCalibration | null> {
  if (calCache !== undefined) return Promise.resolve(calCache);
  if (calInflight) return calInflight;
  calInflight = fetch('/data/pitch_calibration.json')
    .then((r) => (r.ok ? (r.json() as Promise<PitchCalibration>) : null))
    .then((d) => {
      calCache = d;
      calInflight = null;
      return d;
    })
    .catch(() => {
      calCache = null;
      calInflight = null;
      return null;
    });
  return calInflight;
}

function toCalState(cal: PitchCalibration | null | undefined): CalibrationState {
  if (cal === undefined) return { status: 'loading' };
  if (cal === null) return { status: 'missing' };
  return { status: 'ready', data: cal };
}

export function usePitchCalibration(): CalibrationState {
  const [state, setState] = useState<CalibrationState>(toCalState(calCache));
  useEffect(() => {
    if (calCache !== undefined) return;
    let alive = true;
    fetchCalibration().then((d) => {
      if (alive) setState(toCalState(d));
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
