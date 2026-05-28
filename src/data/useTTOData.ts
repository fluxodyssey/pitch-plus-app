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
  const [data, setData] = useState<TTOPitcherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pitcherId == null) return;
    setLoading(true);
    setError(null);

    const load = (): Promise<TTOData> => {
      if (cache[season]) return Promise.resolve(cache[season]!);
      if (promises[season]) return promises[season]!;
      const p = fetchJson<TTOData>(`/data/tto_${season}.json`)
        .then(d => { cache[season] = d; return d; });
      promises[season] = p;
      return p;
    };

    load()
      .then(d => {
        setData(d[String(pitcherId)] ?? null);
        setLoading(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, [pitcherId, season]);

  return { data, loading, error };
}
