/**
 * CountStateHeatmap.tsx — Count-State Absorption Probability Heatmap
 *
 * Visualises the Markov chain outputs from markov_pitch.py as a 4×3 grid of
 * count states (0-0 through 3-2), coloured by P(strikeout) from each state.
 *
 * This answers the question: "How lethal is this pitcher from every count?"
 * A pitcher who maintains high K probability even from 3-0 (behind counts) is
 * more dangerous than one whose K probability collapses when behind.
 *
 * Data source: pitcher.markov_count_data (from markov_pitch.py --merge)
 * Format: { "0-0": { k, bb, bip, exp }, "1-0": {...}, … }
 */

import { useState } from 'react';

// Count layout: rows = balls (0-3), cols = strikes (0-2)
const BALLS      = [0, 1, 2, 3];
const STRIKES    = [0, 1, 2];
const GRID_COLS  = '36px repeat(3, 1fr)';

const COUNT_LABELS: Record<string, string> = {
  '0-0': '0-0', '0-1': '0-1', '0-2': '0-2',
  '1-0': '1-0', '1-1': '1-1', '1-2': '1-2',
  '2-0': '2-0', '2-1': '2-1', '2-2': '2-2',
  '3-0': '3-0', '3-1': '3-1', '3-2': '3-2',
};

interface CountEntry { k: number; bb: number; bip: number; exp: number }
type CountData = Partial<Record<string, CountEntry>>;

type View = 'k' | 'bb' | 'bip' | 'exp';

const VIEW_CONFIG: Record<View, { label: string; tooltip: string; higherBetter: boolean; fmt: (v: number) => string }> = {
  k:   { label: 'P(K)',      tooltip: 'Probability of strikeout from this count',         higherBetter: true,  fmt: v => `${(v * 100).toFixed(1)}%` },
  bb:  { label: 'P(BB)',     tooltip: 'Probability of walk from this count',               higherBetter: false, fmt: v => `${(v * 100).toFixed(1)}%` },
  bip: { label: 'P(BIP)',    tooltip: 'Probability of ball in play from this count',       higherBetter: false, fmt: v => `${(v * 100).toFixed(1)}%` },
  exp: { label: 'Exp Ptch',  tooltip: 'Expected pitches remaining to PA end from this count', higherBetter: false, fmt: v => v.toFixed(1) },
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Map value to an RGB color: red (bad) → grey (neutral) → green (good) */
function valueToColor(value: number, lo: number, hi: number, higherBetter: boolean): string {
  if (lo >= hi) return 'rgba(100,100,120,0.3)';
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const adjusted = higherBetter ? t : 1 - t;
  // 0 = red (#ef4444), 0.5 = neutral (var(--border)), 1 = green (#16a34a)
  if (adjusted < 0.5) {
    const tt = adjusted / 0.5;
    return `rgb(${Math.round(lerp(239, 30, tt))},${Math.round(lerp(68, 41, tt))},${Math.round(lerp(68, 59, tt))})`;
  } else {
    const tt = (adjusted - 0.5) / 0.5;
    return `rgb(${Math.round(lerp(30, 22, tt))},${Math.round(lerp(41, 163, tt))},${Math.round(lerp(59, 74, tt))})`;
  }
}

interface Props {
  countData: CountData;
  pitcherName?: string;
}

export function CountStateHeatmap({ countData, pitcherName }: Props) {
  const [view, setView] = useState<View>('k');
  const [hovered, setHovered] = useState<string | null>(null);
  const cfg = VIEW_CONFIG[view];

  // Range for colour scaling
  const values = Object.values(countData)
    .map(e => e?.[view] ?? 0)
    .filter(v => v > 0);
  // reduce avoids spread-on-array stack risk for large arrays
  const lo = values.length ? values.reduce((a, b) => Math.min(a, b)) : 0;
  const hi = values.length ? values.reduce((a, b) => Math.max(a, b)) : 1;

  return (
    <div>
      {/* View selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Show:</span>
        {(Object.keys(VIEW_CONFIG) as View[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20,
              border: `1px solid ${view === v ? 'var(--accent)' : 'var(--border)'}`,
              background: view === v ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: view === v ? 'var(--accent)' : 'var(--text-3)',
              cursor: 'pointer',
            }}
          >
            {VIEW_CONFIG[v].label}
          </button>
        ))}
        <span style={{ color: 'var(--text-4)', fontSize: 11, marginLeft: 6 }}>{cfg.tooltip}</span>
      </div>

      {/* Grid header — strike labels */}
      <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 4, marginBottom: 4 }}>
        <div />
        {STRIKES.map(s => (
          <div key={s} style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>
            {s}K
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {BALLS.map(b => (
        <div key={b} style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 4, marginBottom: 4 }}>
          {/* Ball label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        paddingRight: 8, color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>
            {b}B
          </div>
          {STRIKES.map(s => {
            const key = `${b}-${s}`;
            const entry = countData[key];
            const val = entry?.[view];
            const bg = val != null ? valueToColor(val, lo, hi, cfg.higherBetter) : 'var(--bg-input)';
            const isHovered = hovered === key;

            return (
              <div
                key={key}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: bg,
                  borderRadius: 8,
                  padding: '10px 4px',
                  textAlign: 'center',
                  cursor: 'default',
                  border: isHovered ? '1px solid var(--accent)' : '1px solid transparent',
                  transition: 'border-color 0.1s',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                  {COUNT_LABELS[key]}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
                  {val != null ? cfg.fmt(val) : '—'}
                </div>

                {/* Tooltip on hover */}
                {isHovered && entry && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-plus)',
                    borderRadius: 8, padding: '8px 12px', zIndex: 100,
                    whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-1)',
                    marginBottom: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>
                      Count {key}
                      {pitcherName && <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>— {pitcherName}</span>}
                    </div>
                    <div>K:    <strong>{(entry.k   * 100).toFixed(1)}%</strong></div>
                    <div>BB:   <strong>{(entry.bb  * 100).toFixed(1)}%</strong></div>
                    <div>BIP:  <strong>{(entry.bip * 100).toFixed(1)}%</strong></div>
                    <div>Exp:  <strong>{entry.exp.toFixed(1)} pitches</strong></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 10, color: 'var(--text-4)' }}>
        <span>Lower {cfg.label}</span>
        <div style={{
          width: 120, height: 6, borderRadius: 3,
          background: cfg.higherBetter
            ? 'linear-gradient(to right, #ef4444, var(--border), #16a34a)'
            : 'linear-gradient(to right, #16a34a, var(--border), #ef4444)',
        }} />
        <span>Higher {cfg.label}</span>
      </div>

      <div style={{ color: 'var(--text-4)', fontSize: 10, marginTop: 6 }}>
        Absorbing Markov Chain · rows = balls · cols = strikes ·
        generated by markov_pitch.py
      </div>
    </div>
  );
}
