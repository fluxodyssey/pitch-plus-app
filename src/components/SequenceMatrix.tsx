import { useState } from 'react';
import { useSequenceData } from '../data/useSequenceData';
import type { TransitionStats } from '../data/useSequenceData';
import { scoreColorContinuous, gradeColor, pitchColor } from '../data/constants';
import { MetricBar } from './MetricBar';

interface Props {
  pitcherId: number;
}

const SUB_SCORE_LABELS: Record<string, string> = {
  transition_quality: 'Transition Quality',
  count_optimization: 'Count Optimization',
  unpredictability: 'Unpredictability',
  speed_exploitation: 'Speed Exploitation',
};

function fmt2(v: number) { return (v * 100).toFixed(1) + '%'; }

interface TooltipState {
  key: string;
  stats: TransitionStats;
  x: number;
  y: number;
}

export function SequenceMatrix({ pitcherId }: Props) {
  const { getPitcher, loading } = useSequenceData();
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const pitcher = getPitcher(pitcherId);

  if (loading) {
    return (
      <div className="card">
        <div style={{ color: '#606080', fontSize: 13 }}>Loading sequence data…</div>
      </div>
    );
  }

  if (!pitcher) return null;

  // Build pitch type list from transitions
  const pitchTypes = Array.from(
    new Set(
      Object.keys(pitcher.transition_matrix).flatMap((k) => k.split('->'))
    )
  ).sort();

  const seqPlusColor = gradeColor(pitcher.sequence_plus);

  return (
    <div className="card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 16, cursor: 'pointer' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 className="card-title" style={{ margin: 0 }}>Pitch Sequence Matrix</h3>
          <span style={{ color: seqPlusColor, fontWeight: 700, fontSize: 15 }}>{pitcher.sequence_plus}</span>
          <span style={{
            background: `${seqPlusColor}22`, border: `1px solid ${seqPlusColor}55`,
            color: seqPlusColor, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
          }}>{pitcher.grade}</span>
        </div>
        <span style={{ color: '#606080', fontSize: 14 }}>{collapsed ? '▼' : '▲'}</span>
      </div>

      {!collapsed && (
        <>
          {/* Heatmap matrix */}
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px', color: '#606080', textAlign: 'right', fontSize: 10 }}>From ↓ To →</th>
                  {pitchTypes.map((pt) => (
                    <th key={pt} style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ color: pitchColor(pt), fontWeight: 600 }}>{pt}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pitchTypes.map((from) => (
                  <tr key={from}>
                    <td style={{ padding: '4px 8px', color: pitchColor(from), fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {from}
                    </td>
                    {pitchTypes.map((to) => {
                      const key = `${from}->${to}`;
                      const stats = pitcher.transition_matrix[key];
                      if (!stats) {
                        return (
                          <td key={to} style={{ padding: '4px 8px', textAlign: 'center', color: '#2a2a3e' }}>—</td>
                        );
                      }
                      const bg = scoreColorContinuous(stats.effectiveness, 0.8);
                      const isBest = pitcher.best_transitions.includes(key);
                      const isWorst = pitcher.worst_transitions.includes(key);
                      return (
                        <td
                          key={to}
                          style={{
                            padding: '5px 10px',
                            textAlign: 'center',
                            background: bg,
                            cursor: 'pointer',
                            outline: isBest ? '2px solid #69f0ae' : isWorst ? '2px solid #c85a5a' : undefined,
                            position: 'relative',
                          }}
                          onMouseEnter={(e) => setTooltip({ key, stats, x: e.clientX, y: e.clientY })}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <span style={{ color: '#e0e0e8', fontWeight: 600 }}>{Math.round(stats.effectiveness)}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div style={{
              position: 'fixed',
              left: tooltip.x + 12,
              top: tooltip.y + 12,
              background: '#16162a',
              border: '1px solid #2a2a3e',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              zIndex: 999,
              pointerEvents: 'none',
              minWidth: 160,
            }}>
              <div style={{ color: '#4a9eff', fontWeight: 600, marginBottom: 6 }}>{tooltip.key}</div>
              <div style={{ color: '#a0a0b8' }}>n = {tooltip.stats.n}</div>
              <div style={{ color: '#a0a0b8' }}>Whiff: {fmt2(tooltip.stats.whiff_rate)}</div>
              <div style={{ color: '#a0a0b8' }}>CSW: {fmt2(tooltip.stats.csw_rate)}</div>
              <div style={{ color: '#a0a0b8' }}>Chase: {fmt2(tooltip.stats.chase_rate)}</div>
              <div style={{ color: '#a0a0b8' }}>wOBA: {tooltip.stats.woba.toFixed(3)}</div>
            </div>
          )}

          {/* Best / Worst transitions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ color: '#69f0ae', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Best Sequences</div>
              {pitcher.best_transitions.slice(0, 3).map((t) => (
                <div key={t} style={{ color: '#e0e0e8', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'monospace', color: '#69f0ae' }}>{t}</span>
                  {pitcher.transition_matrix[t] && (
                    <span style={{ color: '#606080', marginLeft: 6 }}>
                      {Math.round(pitcher.transition_matrix[t].effectiveness)} eff · {fmt2(pitcher.transition_matrix[t].whiff_rate)} whiff
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: '#c85a5a', fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Worst Sequences</div>
              {pitcher.worst_transitions.slice(0, 3).map((t) => (
                <div key={t} style={{ color: '#e0e0e8', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'monospace', color: '#c85a5a' }}>{t}</span>
                  {pitcher.transition_matrix[t] && (
                    <span style={{ color: '#606080', marginLeft: 6 }}>
                      {Math.round(pitcher.transition_matrix[t].effectiveness)} eff · {fmt2(pitcher.transition_matrix[t].whiff_rate)} whiff
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sub-scores */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#a0a0b8', fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Sub-Scores</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(pitcher.sub_scores).map(([key, score]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#606080', fontSize: 11, width: 160, flexShrink: 0 }}>{SUB_SCORE_LABELS[key] ?? key}</span>
                  <div style={{ flex: 1 }}>
                    <MetricBar grade={score} />
                  </div>
                  <span style={{ color: gradeColor(score), fontSize: 12, fontWeight: 600, width: 36, textAlign: 'right' }}>{Math.round(score)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Nash Equilibria */}
          <div>
            <div style={{ color: '#a0a0b8', fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Optimal Pitch Mix (Nash Equilibrium)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {(['L', 'R'] as const).filter((hand) => pitcher.nash_equilibria[hand]).map((hand) => {
                const nash = pitcher.nash_equilibria[hand];
                return (
                  <div key={hand} style={{ background: '#1a1a2e', borderRadius: 6, padding: '10px 14px' }}>
                    <div style={{ color: '#4a9eff', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      vs {hand}HB · Expected Eff: {nash.expected_effectiveness.toFixed(1)}
                    </div>
                    {Object.entries(nash.strategy)
                      .sort(([, a], [, b]) => b - a)
                      .map(([pt, pct]) => (
                        <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ color: pitchColor(pt), fontSize: 11, width: 28 }}>{pt}</span>
                          <div style={{ flex: 1, height: 5, background: '#2a2a3e', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct * 100}%`, height: '100%', background: pitchColor(pt), borderRadius: 3 }} />
                          </div>
                          <span style={{ color: '#a0a0b8', fontSize: 11, width: 34, textAlign: 'right' }}>
                            {(pct * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
