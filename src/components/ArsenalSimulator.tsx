/**
 * ArsenalSimulator.tsx — What-If Arsenal Simulator
 *
 * Lets users drag pitch mix sliders and see the projected impact on Arsenal
 * dimension metrics (pitch_entropy, speed_differential) in real time.
 *
 * Approach:
 *   - Load current pitch type usage from pitchTypes data
 *   - Sliders adjust usage percentages (locked to sum to 100%)
 *   - Recompute pitch_entropy and speed_differential from the new mix
 *   - Show projected vs. actual values with delta indicators
 *
 * Limitations (clearly disclosed):
 *   - Only entropy and speed_differential are recomputable client-side
 *   - arsenal_synergy and best_secondary_whiff require pitch-level data
 *   - Adding a NEW pitch type uses its league-average velocity (not pitcher-specific)
 */

import { useState, useMemo } from 'react';
import type { PitchType } from '../types';

// Fallback names when pitch_names aren't passed from parent
const PITCH_NAME_FALLBACKS: Record<string, string> = {
  FF: '4-Seam', SI: 'Sinker', FC: 'Cutter', FS: 'Splitter',
  SL: 'Slider', ST: 'Sweeper', CU: 'Curve', CH: 'Change',
};

function computeEntropy(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return -weights.reduce((h, w) => {
    const p = w / total;
    return p > 0 ? h + p * Math.log2(p) : h;
  }, 0);
}

function computeSpeedDiff(types: PitchType[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const velos = types.map((t, i) => ({ velo: t.velo, w: (weights[i] ?? 0) / total }))
    .filter(x => x.velo > 0 && x.w > 0);
  if (velos.length < 2) return 0;
  const maxV = Math.max(...velos.map(x => x.velo));
  const minV = Math.min(...velos.map(x => x.velo));
  return maxV - minV;
}

function InsightCard({ delta, threshold, positive, negative }: {
  delta: number; threshold: number; positive: string; negative: string;
}) {
  if (Math.abs(delta) <= threshold) return null;
  const good = delta > 0;
  return (
    <div style={{
      background: good ? '#16a34a11' : '#ef444411',
      border: `1px solid ${good ? '#16a34a44' : '#ef444444'}`,
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
      color: good ? '#4ade80' : '#f87171', marginBottom: 8,
    }}>
      {good ? positive : negative}
    </div>
  );
}

interface Props {
  pitchTypes: PitchType[];
  pitchNames?: Record<string, string>;
}

export function ArsenalSimulator({ pitchTypes, pitchNames = {} }: Props) {
  const resolvedNames = { ...PITCH_NAME_FALLBACKS, ...pitchNames };
  const sorted = useMemo(
    () => [...pitchTypes].sort((a, b) => b.usage_pct - a.usage_pct),
    [pitchTypes]
  );

  // Usage weights in integer percentages (start from actual usage)
  const [weights, setWeights] = useState<number[]>(() =>
    sorted.map(t => Math.round(t.usage_pct * 100))
  );

  const totalWeight = weights.reduce((a, b) => a + b, 0);

  // Original metrics
  const origEntropy   = useMemo(() => computeEntropy(sorted.map(t => t.usage_pct)), [sorted]);
  const origSpeedDiff = useMemo(() => computeSpeedDiff(sorted, sorted.map(t => t.usage_pct)), [sorted]);

  // Projected metrics from slider state
  const projEntropy   = useMemo(() => computeEntropy(weights), [weights]);
  const projSpeedDiff = useMemo(() => computeSpeedDiff(sorted, weights), [sorted, weights]);

  function updateWeight(idx: number, val: number) {
    setWeights(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }

  function reset() {
    setWeights(sorted.map(t => Math.round(t.usage_pct * 100)));
  }

  const entropyDelta   = projEntropy   - origEntropy;
  const speedDiffDelta = projSpeedDiff - origSpeedDiff;

  return (
    <div>
      <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 16 }}>
        Drag sliders to simulate arsenal changes. Projections are approximate —
        only pitch entropy and speed differential are recomputable without pitch-level data.
      </div>

      {/* Pitch sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {sorted.map((pt, i) => (
          <div key={pt.pitch_type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Pitch type label */}
            <div style={{ width: 90, fontSize: 12, color: 'var(--text-1)', flexShrink: 0 }}>
              <span style={{
                background: 'var(--border)', borderRadius: 4, padding: '2px 6px',
                fontSize: 10, fontWeight: 700, color: 'var(--text-2)', marginRight: 6,
              }}>
                {pt.pitch_type}
              </span>
              {(resolvedNames[pt.pitch_type] ?? pt.pitch_type).split(' ').slice(-1)[0]}
            </div>

            {/* Slider */}
            <input
              type="range" min={0} max={100} value={weights[i]}
              onChange={e => updateWeight(i, Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />

            {/* Percentage badge */}
            <div style={{
              width: 44, textAlign: 'right', fontSize: 13, fontWeight: 700,
              color: weights[i] !== Math.round(pt.usage_pct * 100) ? '#fbbf24' : 'var(--text-2)',
              flexShrink: 0,
            }}>
              {weights[i]}%
            </div>

            {/* Original value */}
            <div style={{ width: 36, textAlign: 'right', fontSize: 11, color: 'var(--text-4)', flexShrink: 0 }}>
              ({Math.round(pt.usage_pct * 100)}%)
            </div>
          </div>
        ))}
      </div>

      {/* Total usage indicator */}
      <div style={{
        textAlign: 'center', fontSize: 12, marginBottom: 16,
        color: Math.abs(totalWeight - 100) > 5 ? '#f87171' : 'var(--text-4)',
      }}>
        Total: {totalWeight}% {Math.abs(totalWeight - 100) > 5 && '— adjust to reach 100%'}
      </div>

      {/* Projected metrics */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16,
      }}>
        {[
          { label: 'Pitch Entropy',      orig: origEntropy,   proj: projEntropy,   delta: entropyDelta,   higher: true,  fmt: (v: number) => v.toFixed(3) },
          { label: 'Speed Differential', orig: origSpeedDiff, proj: projSpeedDiff, delta: speedDiffDelta, higher: true,  fmt: (v: number) => `${v.toFixed(1)} mph` },
        ].map(({ label, orig, proj, delta, higher, fmt }) => (
          <div key={label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-plus)', borderRadius: 10,
            padding: '12px 16px',
          }}>
            <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-4)' }}>Current</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-2)' }}>{fmt(orig)}</div>
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700,
                color: Math.abs(delta) < 0.001 ? 'var(--text-4)'
                  : (delta > 0) === higher ? '#4ade80' : '#f87171',
              }}>
                {delta >= 0 ? '+' : ''}{fmt(delta)}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-4)' }}>Projected</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{fmt(proj)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <InsightCard delta={entropyDelta} threshold={0.05}
        positive={`Increasing pitch variety improves unpredictability (+${entropyDelta.toFixed(3)} entropy)`}
        negative={`Reducing pitch variety makes sequencing more predictable (${entropyDelta.toFixed(3)} entropy)`}
      />
      <InsightCard delta={speedDiffDelta} threshold={0.5}
        positive={`Wider speed differential improves tunnelling effectiveness (+${speedDiffDelta.toFixed(1)} mph range)`}
        negative={`Narrower speed range reduces arsenal contrast (${speedDiffDelta.toFixed(1)} mph range)`}
      />

      <button
        onClick={reset}
        style={{
          background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-3)',
          borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
        }}
      >
        Reset to actual usage
      </button>
    </div>
  );
}
