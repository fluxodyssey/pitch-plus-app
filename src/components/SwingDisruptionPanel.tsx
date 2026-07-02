/**
 * SwingDisruptionPanel.tsx — display-only "Swing Disruption & Tunneling" card.
 *
 * Shows six per-pitcher fields merged by swing_timing.py / tunnel_metrics.py:
 *   timing_disruption, plane_mismatch_induced, miss_distance_against,
 *   temporal_tunnel_tightness, temporal_tunnel_effectiveness, release_uniqueness.
 *
 * Percentiles are computed client-side across all loaded pitchers with a
 * non-null value, direction-aware (LOWER=better metrics show the percentile
 * of being low). Neutral descriptors show value + percentile with no
 * good/bad coloring. None of these fields feed the Pitch+ composite.
 */

import { useMemo } from 'react';
import { scoreColorContinuous } from '../data/constants';
import type { Pitcher } from '../types';

type FieldKey =
  | 'timing_disruption'
  | 'plane_mismatch_induced'
  | 'miss_distance_against'
  | 'temporal_tunnel_tightness'
  | 'temporal_tunnel_effectiveness'
  | 'release_uniqueness';

type Direction = 'higher' | 'lower' | 'neutral';

interface FieldDef {
  key: FieldKey;
  label: string;
  unit: string;
  decimals: number;
  direction: Direction;
  note: string;
}

const FIELDS: FieldDef[] = [
  {
    key: 'timing_disruption', label: 'Timing Disruption', unit: 'in', decimals: 1,
    direction: 'higher',
    note: 'Displacement of batters’ swing timing off their own baseline — higher = more disruptive',
  },
  {
    key: 'plane_mismatch_induced', label: 'Plane Mismatch Induced', unit: '°', decimals: 1,
    direction: 'higher',
    note: 'Forces swings off the batter’s preferred plane (angle proxy) — higher = better',
  },
  {
    key: 'miss_distance_against', label: 'Miss Distance Against', unit: 'in', decimals: 2,
    direction: 'neutral',
    note: 'Mean bat-miss distance on whiffs — descriptive only, no outcome signal',
  },
  {
    key: 'temporal_tunnel_tightness', label: 'Tunnel Tightness (167ms)', unit: 'ft', decimals: 2,
    direction: 'lower',
    note: 'Pitch-location spread at the ~167ms commit moment — lower = tighter tunnel',
  },
  {
    key: 'temporal_tunnel_effectiveness', label: 'Tunnel Effectiveness', unit: '×', decimals: 2,
    direction: 'higher',
    note: 'Plate spread ÷ commit-point spread — "looks the same, ends different"',
  },
  {
    key: 'release_uniqueness', label: 'Release Uniqueness', unit: 'σ', decimals: 2,
    direction: 'neutral',
    note: 'Release-slot distance from same-hand league average — descriptive only',
  },
];

function fmtValue(v: number, def: FieldDef): string {
  const s = v.toFixed(def.decimals);
  // Degree / times / sigma symbols read better without a space
  return def.unit === '°' || def.unit === '×' ? `${s}${def.unit}` : `${s} ${def.unit}`;
}

/** Percentile of v among values (0-100). direction 'lower' flips so that a
 *  low raw value yields a high percentile ("percentile of being low"). */
function percentileOf(values: number[], v: number, direction: Direction): number {
  const n = values.length;
  if (n === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  const pctHigh = ((below + equal * 0.5) / n) * 100;
  return Math.round(direction === 'lower' ? 100 - pctHigh : pctHigh);
}

export function SwingDisruptionPanel({ pitcher, allPitchers }: { pitcher: Pitcher; allPitchers: Pitcher[] }) {
  // League value pools per field (non-null only), computed once per pitcher list
  const league = useMemo(() => {
    const out = new Map<FieldKey, number[]>();
    for (const f of FIELDS) {
      const vals: number[] = [];
      for (const p of allPitchers) {
        const v = p[f.key];
        if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
      }
      out.set(f.key, vals);
    }
    return out;
  }, [allPitchers]);

  const hasAny = FIELDS.some(f => typeof pitcher[f.key] === 'number');

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 4 }}>Swing Disruption &amp; Tunneling</h3>
      <p style={{ color: 'var(--text-3)', fontSize: 12, margin: '0 0 12px' }}>
        Display-only bat-tracking &amp; tunnel descriptors — not part of the Pitch+ composite.
        Percentiles are season-wide vs all pitchers with data.
      </p>

      {!hasAny ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '10px 0' }}>
          No bat-tracking data for this season.
        </div>
      ) : (
        <div>
          {FIELDS.map((f, i) => {
            const raw = pitcher[f.key];
            const hasValue = typeof raw === 'number' && Number.isFinite(raw);
            const vals = league.get(f.key) ?? [];
            const pct = hasValue ? percentileOf(vals, raw, f.direction) : null;
            const neutral = f.direction === 'neutral';
            const chipColor = pct != null && !neutral ? scoreColorContinuous(50 + pct, 1) : 'var(--text-2)';
            const chipBg = pct != null && !neutral ? scoreColorContinuous(50 + pct, 0.16) : 'var(--bg-input)';
            const chipBorder = pct != null && !neutral ? scoreColorContinuous(50 + pct, 0.4) : 'var(--border)';

            return (
              <div
                key={f.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0',
                  borderBottom: i < FIELDS.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 600 }}>
                    {f.label}
                    {neutral && (
                      <span style={{
                        marginLeft: 6, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                        textTransform: 'uppercase', color: 'var(--text-4)',
                        border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px',
                      }}>
                        Descriptive
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 1 }}>{f.note}</div>
                </div>

                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 13, color: hasValue ? 'var(--text-1)' : 'var(--text-3)',
                  minWidth: 70, textAlign: 'right', whiteSpace: 'nowrap',
                }}>
                  {hasValue ? fmtValue(raw, f) : 'N/A'}
                </span>

                {pct != null ? (
                  <span
                    title={
                      neutral
                        ? `${pct}th percentile of the raw value (no better/worse direction)`
                        : f.direction === 'lower'
                          ? `${pct}th percentile (percentile of being low — lower raw value is better)`
                          : `${pct}th percentile (higher is better)`
                    }
                    style={{
                      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                      color: chipColor, background: chipBg, border: `1px solid ${chipBorder}`,
                      borderRadius: 4, padding: '2px 7px', minWidth: 44, textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pct}
                    <span style={{ fontSize: 8, fontWeight: 500, marginLeft: 2, opacity: 0.8 }}>pctl</span>
                  </span>
                ) : (
                  <span style={{ minWidth: 44 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
