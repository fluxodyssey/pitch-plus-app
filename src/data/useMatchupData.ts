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

// ── Similarity data ───────────────────────────────────────────────────────────

const similarityFetcher = makeSeasonFetcher<SimilarityData>(
  (season) => `/data/similarity_${season}.json`
);

export function useSimilarityData(season: Season) {
  const [data, setData] = useState<SimilarityData | null>(similarityFetcher.getCached(season));
  const [loading, setLoading] = useState(!similarityFetcher.getCached(season));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = similarityFetcher.getCached(season);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    similarityFetcher
      .load(season)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [season]);

  return { data, loading, error };
}

// ── Batter outcomes data ──────────────────────────────────────────────────────

const batterOutcomesFetcher = makeSeasonFetcher<BatterOutcomesData>(
  (season) => `/data/batter_outcomes_${season}.json`
);

export function useBatterOutcomes(season: Season) {
  const [data, setData] = useState<BatterOutcomesData | null>(batterOutcomesFetcher.getCached(season));
  const [loading, setLoading] = useState(!batterOutcomesFetcher.getCached(season));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = batterOutcomesFetcher.getCached(season);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    batterOutcomesFetcher
      .load(season)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [season]);

  return { data, loading, error };
}

// ── Game grades data ──────────────────────────────────────────────────────────

const gameGradesFetcher = makeSeasonFetcher<GameGradesData>(
  (season) => `/data/game_grades_${season}.json`
);

export function useGameGrades(season: Season) {
  const [data, setData] = useState<GameGradesData | null>(gameGradesFetcher.getCached(season));
  const [loading, setLoading] = useState(!gameGradesFetcher.getCached(season));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = gameGradesFetcher.getCached(season);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    gameGradesFetcher
      .load(season)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [season]);

  return { data, loading, error };
}
