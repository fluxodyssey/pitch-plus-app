import { useState, useEffect } from 'react';
import { fetchJson } from './fetchJson';

export interface TTOMetrics {
  n: number;
  whiff_rate: number | null;
  chase_rate: number | null;
  xwoba: number | null;
  csw_rate: number | null;
}

export interface TTOPitcherData {
  tto_resilience: number | null;
  tto_overall: Record<string, TTOMetrics>;         // keys: "1", "2", "3"
  by_pitch_type: Record<string, Record<string, TTOMetrics>>;  // pt → tto1/tto2/tto3
  by_zone: Record<string, Record<string, TTOMetrics>>;        // zone → tto1/tto2/tto3
}

type TTOData = Record<string, TTOPitcherData>;

const cache: Partial<Record<number, TTOData>> = {};
const promises: Partial<Record<number, Promise<TTOData>>> = {};

export function useTTOData(pitcherId: number | null, season: number) {
  // Async results are tagged with their request key so a late completion for a
  // previous pitcher/season is never shown; warm-cache reads happen during render.
  const key = pitcherId == null ? null : `${season}:${pitcherId}`;
  const [fetched, setFetched] = useState<{ key: string; data: TTOPitcherData | null; error: string | null } | null>(null);

  useEffect(() => {
    if (key == null || pitcherId == null) return;
    let cancelled = false;

    const load = (): Promise<TTOData> => {
      if (cache[season]) return Promise.resolve(cache[season]!);
      if (promises[season]) return promises[season]!;
      const p = fetchJson<TTOData>(`/data/tto_${season}.json`)
        .then(d => { cache[season] = d; return d; });
      promises[season] = p;
      return p;
    };

    load()
      .then(d => { if (!cancelled) setFetched({ key, data: d[String(pitcherId)] ?? null, error: null }); })
      .catch(e => { if (!cancelled) setFetched({ key, data: null, error: String(e) }); });
    return () => { cancelled = true; };
  }, [key, pitcherId, season]);

  const seasonData = pitcherId == null ? null : cache[season];
  const fromFetch = fetched?.key === key && key != null ? fetched : null;
  const data = seasonData ? (seasonData[String(pitcherId)] ?? null) : (fromFetch?.data ?? null);
  const error = fromFetch?.error ?? null;
  const loading = key != null && seasonData == null && fromFetch == null;

  return { data, loading, error };
}
