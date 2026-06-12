import { useState, useEffect } from 'react';
import type { ScoringConfig } from '../types';

let cachedConfig: ScoringConfig | null = null;
let configPromise: Promise<ScoringConfig> | null = null;

export function useScoringConfig() {
  const [config, setConfig] = useState<ScoringConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(cachedConfig === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Warm-cache mount is covered by the useState initializers; subscribing to
    // the (possibly already-resolved) promise keeps every setState async.
    if (!configPromise) {
      configPromise = fetch('/data/scoring_config.json').then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch scoring_config.json: ${r.status}`);
        return r.json();
      });
    }

    let cancelled = false;
    configPromise
      .then((cfg) => {
        cachedConfig = cfg;
        if (!cancelled) {
          setConfig(cfg);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { config, loading, error };
}
