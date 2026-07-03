/**
 * Singleton fetch hooks for arsenal_matchup_{year}.json and
 * catchers_{year}.json (module-level cache — same pattern as useTTOData).
 * State is 'loading' | 'missing' | the parsed doc.
 */
import { useEffect, useState } from 'react';
import type { ArsenalDoc } from '../data/arsenal';

export interface CatcherRow {
  id: number;
  name: string;
  n: number;
  cs: number;
  xcs: number;
  csoe100: number;
  percentile: number;
  grid: Record<string, [number, number]>;   // "col,row" → [sum residual, n]
}
export interface CatchersDoc {
  meta: { auc: number; n_taken: number; league_cs_rate: number; min_taken: number };
  catchers: CatcherRow[];
}

export interface ChallengeRow {
  id: number;
  name: string;
  team: string;
  n_challenges: number;
  n_overturned: number;
  success_pct: number;
  runs_saved: number;
}
export interface ChallengesDoc {
  year: number;
  generated_from: string;
  league: { catcher_challenges: number; overturned: number; success_pct: number; total_runs_saved: number };
  catchers: ChallengeRow[];
}

type Cached<T> = T | 'missing';
const arsenalCache = new Map<number, Cached<ArsenalDoc>>();
const arsenalPending = new Map<number, Promise<Cached<ArsenalDoc>>>();
const catcherCache = new Map<number, Cached<CatchersDoc>>();
const catcherPending = new Map<number, Promise<Cached<CatchersDoc>>>();
const challengeCache = new Map<number, Cached<ChallengesDoc>>();
const challengePending = new Map<number, Promise<Cached<ChallengesDoc>>>();

function fetchOnce<T>(
  year: number,
  cache: Map<number, Cached<T>>,
  pending: Map<number, Promise<Cached<T>>>,
  url: string,
): Promise<Cached<T>> {
  const hit = cache.get(year);
  if (hit !== undefined) return Promise.resolve(hit);
  const inflight = pending.get(year);
  if (inflight) return inflight;
  const p = fetch(url)
    .then(r => (r.ok ? r.json() : 'missing') as Promise<Cached<T>>)
    .catch(() => 'missing' as const)
    .then(doc => { cache.set(year, doc); pending.delete(year); return doc; });
  pending.set(year, p);
  return p;
}

export function useArsenal(year: number): ArsenalDoc | 'loading' | 'missing' {
  const [state, setState] = useState<ArsenalDoc | 'loading' | 'missing'>(
    () => arsenalCache.get(year) ?? 'loading');
  useEffect(() => {
    let live = true;
    setState(arsenalCache.get(year) ?? 'loading');
    fetchOnce(year, arsenalCache, arsenalPending, `/data/arsenal_matchup_${year}.json`)
      .then(doc => { if (live) setState(doc); });
    return () => { live = false; };
  }, [year]);
  return state;
}

export function useCatchers(year: number): CatchersDoc | 'loading' | 'missing' {
  const [state, setState] = useState<CatchersDoc | 'loading' | 'missing'>(
    () => catcherCache.get(year) ?? 'loading');
  useEffect(() => {
    let live = true;
    setState(catcherCache.get(year) ?? 'loading');
    fetchOnce(year, catcherCache, catcherPending, `/data/catchers_${year}.json`)
      .then(doc => { if (live) setState(doc); });
    return () => { live = false; };
  }, [year]);
  return state;
}

/** ABS challenge run value (models/catcher_challenges.py) — 2026+ only. */
export function useChallenges(year: number): ChallengesDoc | 'loading' | 'missing' {
  const [state, setState] = useState<ChallengesDoc | 'loading' | 'missing'>(
    () => challengeCache.get(year) ?? 'loading');
  useEffect(() => {
    let live = true;
    setState(challengeCache.get(year) ?? 'loading');
    fetchOnce(year, challengeCache, challengePending, `/data/challenges_${year}.json`)
      .then(doc => { if (live) setState(doc); });
    return () => { live = false; };
  }, [year]);
  return state;
}
