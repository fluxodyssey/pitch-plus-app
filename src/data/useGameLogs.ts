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
  const [data, setData] = useState<GameLogsData | null>(cache.get(season) ?? null);
  const [loading, setLoading] = useState(!cache.has(season));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = cache.get(season);
    if (cached) { setData(cached); setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);
    loadGameLogs(season)
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setData(null); setLoading(false); setError(err.message); });
  }, [season]);

  function getPlayerGames(pitcherId: number): GameLogEntry[] {
    return data?.pitchers[String(pitcherId)] ?? [];
  }

  return { data, loading, error, getPlayerGames };
}
