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
  // Async results are tagged with their season so a late completion for a
  // previous season is never shown; warm-cache reads happen during render.
  const [fetched, setFetched] = useState<{ season: Season; data: PitchAttributesData | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAttributes(season)
      .then((d) => { if (!cancelled) setFetched({ season, data: d }); })
      .catch(() => { if (!cancelled) setFetched({ season, data: null }); });
    return () => { cancelled = true; };
  }, [season]);

  const fromFetch = fetched?.season === season ? fetched : null;
  const data = cache.get(season) ?? fromFetch?.data ?? null;
  const loading = data == null && fromFetch == null;

  // Convenience: get a specific pitcher's attributes
  function getPitcherAttributes(pitcherId: number): Record<string, AttributeGrades> | null {
    return data?.pitchers[String(pitcherId)]?.types ?? null;
  }

  function getExpectedPitchPlus(pitcherId: number): number | null {
    return data?.pitchers[String(pitcherId)]?.expected_pitch_plus ?? null;
  }

  return { data, loading, getPitcherAttributes, getExpectedPitchPlus };
}
