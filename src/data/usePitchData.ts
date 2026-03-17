import { useState, useCallback } from 'react';
import type { RawPitch, GameInfo } from '../types';
import type { Season } from './useData';

export interface PitchIndex {
  index: Map<number, RawPitch[]>;
  games: Record<string, GameInfo>;
}

// Cache per season+pitcher: `${season}:${pitcherId}` → RawPitch[]
const pitcherCache = new Map<string, RawPitch[]>();
// Cache games per season
const gamesCache = new Map<Season, Record<string, GameInfo>>();
const gamesFetching = new Map<Season, Promise<Record<string, GameInfo>>>();

function pitchUrl(season: Season, pitcherId: number): string {
  return `/data/pitches/${season}/${pitcherId}.json`;
}

function gamesUrl(season: Season): string {
  return `/data/pitches/${season}/games.json`;
}

async function fetchGames(season: Season): Promise<Record<string, GameInfo>> {
  const hit = gamesCache.get(season);
  if (hit) return hit;
  const inflight = gamesFetching.get(season);
  if (inflight) return inflight;

  const url = gamesUrl(season);
  if (!url) return {};

  const p = fetch(url)
    .then((r) => r.ok ? r.json() : {})
    .then((data: Record<string, GameInfo>) => {
      gamesCache.set(season, data);
      gamesFetching.delete(season);
      return data;
    });
  gamesFetching.set(season, p);
  return p;
}

export function usePitchData(season: Season = 2025) {
  const [pitches, setPitches] = useState<RawPitch[] | null>(null);
  const [games, setGames] = useState<Record<string, GameInfo>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadForPitcher = useCallback(async (pitcherId: number) => {
    setLoading(true);
    setError(null);

    try {
      const cacheKey = `${season}:${pitcherId}`;
      let pitcherPitches: RawPitch[];

      if (pitcherCache.has(cacheKey)) {
        pitcherPitches = pitcherCache.get(cacheKey)!;
      } else {
        const url = pitchUrl(season, pitcherId);
        const res = await fetch(url);
        if (!res.ok) {
          pitcherPitches = [];
        } else {
          const data = await res.json();
          pitcherPitches = data.pitches ?? [];
          pitcherCache.set(cacheKey, pitcherPitches);
        }
      }

      const seasonGames = await fetchGames(season);
      setPitches(pitcherPitches);
      setGames(seasonGames);
    } catch (err) {
      setError(String(err));
      setPitches([]);
    } finally {
      setLoading(false);
    }
  }, [season]);

  return { loadForPitcher, pitches: pitches ?? [], games, loading, error };
}
