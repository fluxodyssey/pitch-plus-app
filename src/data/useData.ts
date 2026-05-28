import { useState, useEffect, useCallback } from 'react';
import type { AppData } from '../types';

// ── Season config ─────────────────────────────────────────────────────────────

export const AVAILABLE_SEASONS = [2026, 2025, 2024, 2023, 2022, 2021] as const;
export type Season = typeof AVAILABLE_SEASONS[number];
export const DEFAULT_SEASON: Season = 2026;

export const SEASON_LABELS: Record<Season, string> = {
  2021: '2021 MLB',
  2022: '2022 MLB',
  2023: '2023 MLB',
  2024: '2024 MLB',
  2025: '2025 MLB',
  2026: '2026 MLB',
};

// Seasons the Matchup Machine is exposed for. Product decision — earlier seasons
// have the underlying data (similarity_{year}.json + batter_outcomes_{year}.json)
// but matchup projections are only shown for the current season.
export const MATCHUP_SEASONS: readonly Season[] = [2026];
export function hasMatchupData(season: Season): boolean {
  return MATCHUP_SEASONS.includes(season);
}
export const MATCHUP_DEFAULT_SEASON: Season = 2026;

function pitchersUrl(season: Season): string {
  return `/data/pitchers_${season}.json`;
}
function pitchTypesUrl(_season: Season): string {
  return '/data/pitch_types.json';
}

// ── Per-season cache (30-minute TTL) ─────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry { data: AppData; ts: number }
const seasonCache = new Map<Season, CacheEntry>();
const seasonPromises = new Map<Season, Promise<AppData>>();

async function loadSeason(season: Season): Promise<AppData> {
  const hit = seasonCache.get(season);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

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
    seasonCache.set(season, { data, ts: Date.now() });
    seasonPromises.delete(season);
    return data;
  })();

  seasonPromises.set(season, p);
  return p;
}

// ── Global season state (shared across the whole app) ────────────────────────

function getInitialSeason(): Season {
  try {
    const stored = parseInt(localStorage.getItem('pitch-plus-season') ?? '', 10);
    if ((AVAILABLE_SEASONS as readonly number[]).includes(stored)) return stored as Season;
  } catch { /* localStorage unavailable */ }
  return DEFAULT_SEASON;
}

let globalSeason: Season = getInitialSeason();
const seasonListeners = new Set<(s: Season) => void>();

export function setGlobalSeason(s: Season): void {
  globalSeason = s;
  try { localStorage.setItem('pitch-plus-season', String(s)); } catch { /* ignore */ }
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
  const cachedEntry = seasonCache.get(season);
  const isFresh = cachedEntry != null && Date.now() - cachedEntry.ts < CACHE_TTL_MS;
  const [state, setState] = useState<Omit<UseDataResult, 'season' | 'setSeason'>>({
    data: isFresh ? cachedEntry.data : null,
    loading: !isFresh,
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
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setState({ data: cached.data, loading: false, error: null });
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
