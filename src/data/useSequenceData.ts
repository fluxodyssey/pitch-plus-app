import { useState, useEffect } from 'react';
import { fetchJsonOrNull } from './fetchJson';

export interface TransitionStats {
  n: number;
  whiff_rate: number;
  csw_rate: number;
  chase_rate: number;
  woba: number;
  effectiveness: number;
}

export interface NashSide {
  strategy: Record<string, number>;
  expected_effectiveness: number;
}

export interface SequencePitcher {
  pitcher_name: string;
  pitcher_team: string;
  n_pitches: number;
  sequence_plus: number;
  grade: string;
  sub_scores: {
    transition_quality: number;
    count_optimization: number;
    unpredictability: number;
    speed_exploitation: number;
  };
  transition_matrix: Record<string, TransitionStats>;
  best_transitions: string[];
  worst_transitions: string[];
  recommendations: string[];
  nash_equilibria: Record<'L' | 'R', NashSide>;
  batter_hand_splits: Record<string, unknown>;
}

export interface SequenceData {
  metadata: Record<string, unknown>;
  league_transitions: Record<string, TransitionStats>;
  pitchers: Record<string, SequencePitcher>;
}

let cache: SequenceData | null = null;
let inflight: Promise<SequenceData | null> | null = null;

async function loadSequenceData(): Promise<SequenceData | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetchJsonOrNull<SequenceData>('/data/sequence_plus.json')
    .then((d) => {
      cache = d;
      inflight = null;
      return d;
    });
  return inflight;
}

export function useSequenceData() {
  const [data, setData] = useState<SequenceData | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    // Warm-cache mount is covered by the useState initializers; loadSequenceData
    // dedupes via the module cache, so every setState here stays async.
    let cancelled = false;
    loadSequenceData().then((d) => {
      if (!cancelled) { setData(d); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  function getPitcher(id: number): SequencePitcher | null {
    return data?.pitchers[String(id)] ?? null;
  }

  return { data, loading, getPitcher };
}
