import { useState, useEffect } from 'react';
import type { PitchersData, PitchTypesData } from '../types';
import { computeSpringDeltas, type SpringDelta } from './computeSpringDeltas';

export interface UseSpringDataResult {
  deltas: SpringDelta[] | null;
  loading: boolean;
  error: string | null;
  springMeta: PitchersData['metadata'] | null;
}

let cachedResult: { deltas: SpringDelta[]; meta: PitchersData['metadata'] } | null = null;
let inflightPromise: Promise<{ deltas: SpringDelta[]; meta: PitchersData['metadata'] }> | null = null;

async function loadSpringDeltas() {
  if (cachedResult) return cachedResult;
  if (inflightPromise) return inflightPromise;

  inflightPromise = (async () => {
    const [springRes, baselineRes, springPtRes, baselinePtRes] = await Promise.all([
      fetch('/data/spring_pitchers.json'),
      fetch('/data/pitchers_2025.json'),
      fetch('/data/spring_pitch_types.json'),
      fetch('/data/pitch_types.json'),
    ]);

    if (!springRes.ok) throw new Error('Spring training data not available yet');
    if (!baselineRes.ok) throw new Error('2025 baseline data not found');

    const [springData, baselineData]: [PitchersData, PitchersData] = await Promise.all([
      springRes.json(),
      baselineRes.json(),
    ]);

    const springPt: PitchTypesData | null = springPtRes.ok ? await springPtRes.json() : null;
    const baselinePt: PitchTypesData | null = baselinePtRes.ok ? await baselinePtRes.json() : null;

    const deltas = computeSpringDeltas(springData, baselineData, springPt, baselinePt);
    const result = { deltas, meta: springData.metadata };
    cachedResult = result;
    inflightPromise = null;
    return result;
  })();

  return inflightPromise;
}

export function useSpringData(): UseSpringDataResult {
  const [state, setState] = useState<UseSpringDataResult>({
    deltas: cachedResult?.deltas ?? null,
    loading: !cachedResult,
    error: null,
    springMeta: cachedResult?.meta ?? null,
  });

  useEffect(() => {
    // Warm-cache mount is covered by the useState initializer; loadSpringDeltas
    // resolves instantly from cache, so every setState here stays async.
    let cancelled = false;
    loadSpringDeltas()
      .then(r => { if (!cancelled) setState({ deltas: r.deltas, loading: false, error: null, springMeta: r.meta }); })
      .catch(err => { if (!cancelled) setState({ deltas: null, loading: false, error: String(err), springMeta: null }); });
    return () => { cancelled = true; };
  }, []);

  return state;
}
