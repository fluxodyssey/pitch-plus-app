/**
 * useMatchupData.ts — Data hooks for similarity, batter outcomes, and game grades.
 *
 * Each hook follows the module-singleton cache pattern from useData.ts:
 * - Cache is shared across all mounted components
 * - In-flight deduplication via promise sharing
 * - Season-keyed for similarity and game grades (batter_outcomes too)
 */

import { useState, useEffect } from 'react';
import type { Season } from './useData';
import type {
  SimilarityData,
  BatterOutcomesData,
  GameGradesData,
} from '../types';
import { fetchJson } from './fetchJson';

// ── Generic cached fetch utility ─────────────────────────────────────────────

type CacheEntry<T> = T;

function makeSeasonFetcher<T>(urlFn: (season: Season) => string) {
  const cache = new Map<Season, CacheEntry<T>>();
  const inflight = new Map<Season, Promise<T>>();

  async function load(season: Season): Promise<T> {
    const hit = cache.get(season);
    if (hit) return hit;

    const existing = inflight.get(season);
    if (existing) return existing;

    const p = fetchJson<T>(urlFn(season))
      .then((data) => {
        cache.set(season, data);
        inflight.delete(season);
        return data;
      })
      .catch((err) => {
        inflight.delete(season);
        throw err;
      });

    inflight.set(season, p);
    return p;
  }

  function getCached(season: Season): T | null {
    return cache.get(season) ?? null;
  }

  return { load, getCached };
}

type SeasonFetcher<T> = ReturnType<typeof makeSeasonFetcher<T>>;

/**
 * Shared hook body for season-keyed fetchers. Async results are tagged with
 * their season so a late completion for a previous season is never shown;
 * warm-cache reads happen during render (no synchronous setState in effects).
 */
function useSeasonFetch<T>(fetcher: SeasonFetcher<T>, season: Season) {
  const [fetched, setFetched] = useState<{ season: Season; data: T | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher
      .load(season)
      .then((d) => { if (!cancelled) setFetched({ season, data: d, error: null }); })
      .catch((e) => { if (!cancelled) setFetched({ season, data: null, error: String(e) }); });
    return () => { cancelled = true; };
  }, [fetcher, season]);

  const fromFetch = fetched?.season === season ? fetched : null;
  const data = fetcher.getCached(season) ?? fromFetch?.data ?? null;
  const error = fromFetch?.error ?? null;
  const loading = data == null && error == null;

  return { data, loading, error };
}

// ── Similarity data ───────────────────────────────────────────────────────────

const similarityFetcher = makeSeasonFetcher<SimilarityData>(
  (season) => `/data/similarity_${season}.json`
);

export function useSimilarityData(season: Season) {
  return useSeasonFetch(similarityFetcher, season);
}

// ── Batter outcomes data ──────────────────────────────────────────────────────

const batterOutcomesFetcher = makeSeasonFetcher<BatterOutcomesData>(
  (season) => `/data/batter_outcomes_${season}.json`
);

export function useBatterOutcomes(season: Season) {
  return useSeasonFetch(batterOutcomesFetcher, season);
}

// ── Game grades data ──────────────────────────────────────────────────────────

const gameGradesFetcher = makeSeasonFetcher<GameGradesData>(
  (season) => `/data/game_grades_${season}.json`
);

export function useGameGrades(season: Season) {
  return useSeasonFetch(gameGradesFetcher, season);
}
