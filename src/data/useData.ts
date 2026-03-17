import { useState, useEffect, useCallback } from 'react';
import type { AppData } from '../types';

// ── Season config ─────────────────────────────────────────────────────────────

export const AVAILABLE_SEASONS = [2021, 2022, 2023, 2024, 2025] as const;
export type Season = typeof AVAILABLE_SEASONS[number];
export const DEFAULT_SEASON: Season = 2025;

export const SEASON_LABELS: Record<Season, string> = {
  2021: '2021 MLB',
  2022: '2022 MLB',
  2023: '2023 MLB',
  2024: '2024 MLB',
  2025: '2025 MLB',
};

function pitchersUrl(season: Season): string {
  return `/data/pitchers_${season}.json`;
}
function pitchTypesUrl(_season: Season): string {
  return '/data/pitch_types.json';
}

// ── Per-season cache ──────────────────────────────────────────────────────────

const seasonCache = new Map<Season, AppData>();
const seasonPromises = new Map<Season, Promise<AppData>>();

async function loadSeason(season: Season): Promise<AppData> {
  const hit = seasonCache.get(season);
  if (hit) return hit;

  const inflight = seasonPromises.get(season);
  if (inflight) return inflight;

  const p = (async () => {
    const [pitchersRes, pitchTypesRes, rotationsRes] = await Promise.all([
      fetch(pitchersUrl(season)),
      fetch(pitchTypesUrl(season)),
      fetch('/data/rotations.json'),
    ]);

    if (!pitchersRes.ok) throw new Error(`Season ${season} data not found`);

    const [pitchers, pitchTypes, rotations] = await Promise.all([
      pitchersRes.json(),
      pitchTypesRes.ok && pitchTypesRes.headers.get('content-type')?.includes('json') ? pitchTypesRes.json() : Promise.resolve({ league_averages: {}, pitch_names: {}, pitchers: {} }),
      rotationsRes.json(),
    ]);

    const data: AppData = { pitchers, pitchTypes, rotations };
    seasonCache.set(season, data);
    seasonPromises.delete(season);
    return data;
  })();

  seasonPromises.set(season, p);
  return p;
}

// ── Global season state (shared across the whole app) ────────────────────────

let globalSeason: Season = DEFAULT_SEASON;
const seasonListeners = new Set<(s: Season) => void>();

export function setGlobalSeason(s: Season): void {
  globalSeason = s;
  seasonListeners.forEach((fn) => fn(s));
}

export function getGlobalSeason(): Season { return globalSeason; }

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseDataResult {
  data: AppData | null;
  loading: boolean;
  error: string | null;
  season: Season;
  setSeason: (s: Season) => void;
}

export function useData(overrideSeason?: Season): UseDataResult {
  const [season, setSeasonLocal] = useState<Season>(overrideSeason ?? globalSeason);
  const [state, setState] = useState<Omit<UseDataResult, 'season' | 'setSeason'>>({
    data: seasonCache.get(season) ?? null,
    loading: !seasonCache.has(season),
    error: null,
  });

  // Listen for global season changes (unless overridden)
  useEffect(() => {
    if (overrideSeason) return;
    const handler = (s: Season) => setSeasonLocal(s);
    seasonListeners.add(handler);
    return () => { seasonListeners.delete(handler); };
  }, [overrideSeason]);

  useEffect(() => {
    const cached = seasonCache.get(season);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }
    setState({ data: null, loading: true, error: null });
    loadSeason(season)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => setState({ data: null, loading: false, error: String(err) }));
  }, [season]);

  const setSeason = useCallback((s: Season) => {
    setSeasonLocal(s);
    if (!overrideSeason) setGlobalSeason(s);
  }, [overrideSeason]);

  return { ...state, season, setSeason };
}

// Convenience: preload a season without rendering anything
export function preloadSeason(season: Season): void {
  loadSeason(season).catch(() => {/* season data not yet available — suppress */});
}
