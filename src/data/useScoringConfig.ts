import { useState, useEffect } from 'react';
import type { ScoringConfig } from '../types';

let cachedConfig: ScoringConfig | null = null;
let configPromise: Promise<ScoringConfig> | null = null;

export function useScoringConfig() {
  const [config, setConfig] = useState<ScoringConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(cachedConfig === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      setLoading(false);
      return;
    }

    if (!configPromise) {
      configPromise = fetch('/data/scoring_config.json').then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch scoring_config.json: ${r.status}`);
        return r.json();
      });
    }

    configPromise
      .then((cfg) => {
        cachedConfig = cfg;
        setConfig(cfg);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  return { config, loading, error };
}
