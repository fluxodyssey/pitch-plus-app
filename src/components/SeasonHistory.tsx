import { useMemo } from 'react';
import { LineChart, Line, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useData, AVAILABLE_SEASONS, type Season } from '../data/useData';
import { scoreColorContinuous, gradeColor } from '../data/constants';
import { usePitcherSparklines, usePitcherTrajectory } from '../data/useSparklines';
import type { MetricKey } from '../types';

// ── Trajectory badge ──────────────────────────────────────────────────────────

const DEFAULT_TRAJECTORY_STYLE = { color: 'var(--text-4)', bg: 'var(--border)', arrow: '?' };
const TRAJECTORY_STYLES: Record<string, { color: string; bg: string; arrow: string }> = {
  ascending:        { color: '#4ade80', bg: '#16a34a22', arrow: '↑' },
  declining:        { color: '#f87171', bg: '#ef444422', arrow: '↓' },
  plateau:          { color: 'var(--text-2)', bg: 'var(--border)',   arrow: '→' },
  volatile:         { color: '#fb923c', bg: '#f9731622', arrow: '~' },
  insufficient_data: DEFAULT_TRAJECTORY_STYLE,
};

function TrajectoryBadge({ pitcherId }: { pitcherId: number }) {
  const traj = usePitcherTrajectory(pitcherId);
  if (!traj) return null;

  const label = traj.trajectory_label ?? 'insufficient_data';
  const style = TRAJECTORY_STYLES[label] ?? DEFAULT_TRAJECTORY_STYLE;
  const slopeStr = traj.trajectory_slope != null
    ? `${traj.trajectory_slope > 0 ? '+' : ''}${traj.trajectory_slope.toFixed(1)} pts/yr`
    : '';
  const confStr = traj.trajectory_confidence != null
    ? ` (R²=${traj.trajectory_confidence.toFixed(2)})`
    : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span style={{
        background: style.bg, color: style.color,
        border: `1px solid ${style.color}44`,
        borderRadius: 8, padding: '4px 12px',
        fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
      }}>
        {style.arrow} {label.replace('_', ' ').toUpperCase()}
      </span>
      {slopeStr && (
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
          {slopeStr}{confStr} · {traj.seasons_observed} seasons
        </span>
      )}
    </div>
  );
}

// ── Pitch+ sparkline (mini trend chart) ──────────────────────────────────────

function PitchPlusSparkline({ pitcherId }: { pitcherId: number }) {
  const points = usePitcherSparklines(pitcherId);
  if (points.length < 2) return null;

  const filtered = points.filter((p) => p.pitch_plus != null);
  if (filtered.length < 2) return null;

  // Single pass for min/max/trend instead of three separate map()s
  let min = Infinity, max = -Infinity;
  for (const p of filtered) {
    if (p.pitch_plus! < min) min = p.pitch_plus!;
    if (p.pitch_plus! > max) max = p.pitch_plus!;
  }
  const trend = (filtered[filtered.length - 1]?.pitch_plus ?? 0) - (filtered[0]?.pitch_plus ?? 0);
  const trendColor = trend > 2 ? '#4ade80' : trend < -2 ? '#f87171' : 'var(--text-2)';

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 6 }}>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
          Pitch+ trend  ({filtered[0]?.season}–{filtered[filtered.length - 1]?.season})
        </span>
        <span style={{ color: trendColor, fontSize: 11, fontWeight: 700 }}>
          {trend > 0 ? '+' : ''}{trend.toFixed(0)} pts over period
        </span>
      </div>
      <ResponsiveContainer width="100%" height={56}>
        <LineChart data={filtered} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="pitch_plus"
            stroke={trendColor}
            strokeWidth={2}
            dot={{ fill: trendColor, r: 3 }}
            activeDot={{ r: 5 }}
          />
          <ReferenceLine y={100} stroke="#2e4560" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{ background: 'var(--bg-input)', border: '1px solid var(--border-plus)',
                            borderRadius: 6, fontSize: 11 }}
            formatter={(v) => [v != null ? `${v} Pitch+` : '', '']}
            labelFormatter={(l) => `${l}`}
          />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>
        <span>Low: {min}</span>
        <span style={{ color: 'var(--text-4)' }}>─── 100 = MLB avg</span>
        <span>High: {max}</span>
      </div>
    </div>
  );
}

interface Props {
  pitcherId: number;
}

const SHOW_METRICS: Array<{ key: MetricKey; label: string; pct?: boolean }> = [
  { key: 'avg_perceived_velo', label: 'Velo' },
  { key: 'k_rate', label: 'K%', pct: true },
  { key: 'bb_rate', label: 'BB%', pct: true },
  { key: 'in_zone_whiff_rate', label: 'Whiff%', pct: true },
  { key: 'chase_rate', label: 'Chase%', pct: true },
  { key: 'csw_rate', label: 'CSW%', pct: true },
  { key: 'wrc_plus_against', label: 'wRC+' },
];

// Single-season row — loads its own data; useMemo avoids repeated O(n) .find() on re-renders
function SeasonRow({ pitcherId, season }: { pitcherId: number; season: Season }) {
  const { data } = useData(season);
  const pitcher = useMemo(
    () => data?.pitchers.pitchers.find((p) => p.pitcher_id === pitcherId),
    [data, pitcherId],
  );
  if (!pitcher) return null;

  const thCell: React.CSSProperties = {
    padding: '6px 10px',
    textAlign: 'right',
    fontFamily: 'monospace',
    fontSize: 12,
    whiteSpace: 'nowrap',
  };

  return (
    <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
      <td style={{ padding: '6px 10px', color: '#a0a0b8', fontWeight: 600, fontSize: 12 }}>{season}</td>
      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
        <span style={{
          display: 'inline-block',
          background: gradeColor(pitcher.pitch_plus),
          color: '#fff',
          borderRadius: 4,
          padding: '1px 7px',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'monospace',
        }}>
          {pitcher.pitch_plus}
        </span>
      </td>
      <td style={{ ...thCell, color: '#a0a0b8' }}>{pitcher.n_pitches.toLocaleString()}</td>
      <td style={{ ...thCell, color: '#a0a0b8' }}>{pitcher.n_games}</td>
      {/* Dimension scores */}
      {(['stuff','command','deception','tunnel_and_sequence','outcomes','arsenal'] as const).map((dk) => {
        const score = pitcher.dimensions[dk]?.score ?? 0;
        return (
          <td key={dk} style={{
            ...thCell,
            background: scoreColorContinuous(score, 0.25),
            color: 'var(--text-1)',
            fontWeight: score >= 115 ? 700 : 400,
          }}>
            {score}
          </td>
        );
      })}
      {/* Key metrics */}
      {SHOW_METRICS.map(({ key, pct }) => {
        const mg = pitcher.metric_grades[key];
        if (!mg) return <td key={key} style={{ ...thCell, color: '#404060' }}>—</td>;
        const display = pct ? `${(mg.raw * 100).toFixed(1)}%` : mg.raw.toFixed(1);
        return (
          <td key={key} style={{
            ...thCell,
            background: scoreColorContinuous(mg.grade, 0.2),
            color: 'var(--text-1)',
          }}>
            {display}
          </td>
        );
      })}
    </tr>
  );
}

export function SeasonHistory({ pitcherId }: Props) {
  const seasons = [...AVAILABLE_SEASONS].reverse(); // newest first
  const thStyle: React.CSSProperties = {
    padding: '7px 10px',
    color: '#a0a0b8',
    fontWeight: 500,
    fontSize: 11,
    textAlign: 'right',
    borderBottom: '2px solid #1e1e2e',
    background: '#0f0f1a',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  };

  return (
    <div>
      {/* Trajectory indicator + Pitch+ sparkline (from sparklines.json / trajectories.json) */}
      <TrajectoryBadge pitcherId={pitcherId} />
      <PitchPlusSparkline pitcherId={pitcherId} />

      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }}>Season</th>
            <th style={thStyle}>Pitch+</th>
            <th style={thStyle}>Pitches</th>
            <th style={thStyle}>G</th>
            <th style={thStyle}>Stuff</th>
            <th style={thStyle}>Cmd</th>
            <th style={thStyle}>Dec</th>
            <th style={thStyle}>Tunnel</th>
            <th style={thStyle}>Out</th>
            <th style={thStyle}>Ars</th>
            {SHOW_METRICS.map(({ label }) => (
              <th key={label} style={thStyle}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {seasons.map((season) => (
            <SeasonRow
              key={season}
              pitcherId={pitcherId}
              season={season}
            />
          ))}
        </tbody>
      </table>
      <p style={{ color: '#404060', fontSize: 10, marginTop: 6 }}>
        Cell shading: green = above average, red = below average · Seasons with no data are hidden
      </p>
    </div>  {/* end overflowX wrapper */}
    </div>
  );
}
