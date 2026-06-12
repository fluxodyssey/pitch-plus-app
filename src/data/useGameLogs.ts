import { useState, useEffect } from 'react';
import type { GameLogEntry } from '../types';
import { fetchJson } from './fetchJson';

interface GameLogsData {
  metadata: { season: number; n_pitchers: number; n_games: number };
  pitchers: Record<string, GameLogEntry[]>;
}

const cache = new Map<number, GameLogsData>();
const inflight = new Map<number, Promise<GameLogsData | null>>();

async function loadGameLogs(season: number): Promise<GameLogsData | null> {
  const cached = cache.get(season);
  if (cached) return cached;
  const existing = inflight.get(season);
  if (existing) return existing;

  const promise = fetchJson<GameLogsData>(`/data/game_logs_${season}.json`)
    .then((d) => {
      cache.set(season, d);
      inflight.delete(season);
      return d;
    })
    .catch((err) => {
      inflight.delete(season);
      throw err;
    });

  inflight.set(season, promise);
  return promise;
}

export function useGameLogs(season: number) {
  // Async results are tagged with their season so a late completion for a
  // previous season is never shown; warm-cache reads happen during render.
  const [fetched, setFetched] = useState<{ season: number; data: GameLogsData | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGameLogs(season)
      .then((d) => { if (!cancelled) setFetched({ season, data: d, error: null }); })
      .catch((err) => { if (!cancelled) setFetched({ season, data: null, error: err.message }); });
    return () => { cancelled = true; };
  }, [season]);

  const fromFetch = fetched?.season === season ? fetched : null;
  const data = cache.get(season) ?? fromFetch?.data ?? null;
  const error = fromFetch?.error ?? null;
  const loading = data == null && error == null;

  function getPlayerGames(pitcherId: number): GameLogEntry[] {
    return data?.pitchers[String(pitcherId)] ?? [];
  }

  return { data, loading, error, getPlayerGames };
}
