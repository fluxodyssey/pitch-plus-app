import { useState, useEffect } from 'react';
import type { GameLogEntry } from '../types';

interface GameLogsData {
  metadata: { season: number; n_pitchers: number; n_games: number };
  pitchers: Record<string, GameLogEntry[]>;
}

let cache: GameLogsData | null = null;
let inflight: Promise<GameLogsData | null> | null = null;

async function loadGameLogs(season: number): Promise<GameLogsData | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch(`/data/game_logs_${season}.json`)
    .then((r) => {
      if (!r.ok) return null;
      return r.json() as Promise<GameLogsData>;
    })
    .then((d) => {
      cache = d;
      inflight = null;
      return d;
    })
    .catch(() => {
      inflight = null;
      return null;
    });
  return inflight;
}

export function useGameLogs(season: number) {
  const [data, setData] = useState<GameLogsData | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setData(cache); setLoading(false); return; }
    setLoading(true);
    loadGameLogs(season).then((d) => { setData(d); setLoading(false); });
  }, [season]);

  function getPlayerGames(pitcherId: number): GameLogEntry[] {
    return data?.pitchers[String(pitcherId)] ?? [];
  }

  return { data, loading, getPlayerGames };
}
