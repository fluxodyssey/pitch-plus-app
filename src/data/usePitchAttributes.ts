import { useState, useEffect } from 'react';
import type { PitchAttributesData, AttributeGrades } from '../types';
import type { Season } from './useData';
import { fetchJson } from './fetchJson';

const cache = new Map<Season, PitchAttributesData>();
const inflight = new Map<Season, Promise<PitchAttributesData>>();

function attrUrl(season: Season): string {
  return `/data/pitch_attributes_${season}.json`;
}

async function loadAttributes(season: Season): Promise<PitchAttributesData> {
  const hit = cache.get(season);
  if (hit) return hit;
  const existing = inflight.get(season);
  if (existing) return existing;

  const p = fetchJson<PitchAttributesData>(attrUrl(season))
    .then((data) => {
      cache.set(season, data);
      inflight.delete(season);
      return data;
    });

  inflight.set(season, p);
  return p;
}

export function usePitchAttributes(season: Season) {
  const [data, setData] = useState<PitchAttributesData | null>(cache.get(season) ?? null);
  const [loading, setLoading] = useState(!cache.has(season));

  useEffect(() => {
    let cancelled = false;
    if (!cache.has(season)) {
      setLoading(true);
      loadAttributes(season)
        .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
        .catch(() => { if (!cancelled) setLoading(false); });
    } else {
      setData(cache.get(season)!);
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [season]);

  // Convenience: get a specific pitcher's attributes
  function getPitcherAttributes(pitcherId: number): Record<string, AttributeGrades> | null {
    return data?.pitchers[String(pitcherId)]?.types ?? null;
  }

  function getExpectedPitchPlus(pitcherId: number): number | null {
    return data?.pitchers[String(pitcherId)]?.expected_pitch_plus ?? null;
  }

  return { data, loading, getPitcherAttributes, getExpectedPitchPlus };
}
