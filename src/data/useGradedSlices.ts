/**
 * useGradedSlices.ts — per-season singleton hook for the graded-pitch slice JSON
 * (models/score_slice.py --export → public/data/graded_slices_{year}.json).
 *
 * Singleton cache per season (matches the useData pattern). Returns null while
 * loading or if the season has no exported slices file (graceful — the page shows
 * an "unavailable" state rather than crashing).
 */
import { useEffect, useState } from 'react';
import type { GradedSlices } from '../types';
import type { Season } from './useData';

const cache = new Map<Season, GradedSlices>();
const inflight = new Map<Season, Promise<GradedSlices | null>>();

function fetchSlices(season: Season): Promise<GradedSlices | null> {
  const hit = cache.get(season);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(season);
  if (running) return running;

  const p = fetch(`/data/graded_slices_${season}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<GradedSlices>) : null))
    .then((d) => {
      if (d) cache.set(season, d);
      inflight.delete(season);
      return d;
    })
    .catch(() => {
      inflight.delete(season);
      return null;
    });
  inflight.set(season, p);
  return p;
}

export function useGradedSlices(season: Season): GradedSlices | null {
  const [data, setData] = useState<GradedSlices | null>(cache.get(season) ?? null);
  useEffect(() => {
    let alive = true;
    setData(cache.get(season) ?? null);
    if (!cache.has(season)) {
      fetchSlices(season).then((d) => {
        if (alive) setData(d);
      });
    }
    return () => {
      alive = false;
    };
  }, [season]);
  return data;
}
