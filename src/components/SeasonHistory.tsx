import { useData } from '../data/useData';
import { AVAILABLE_SEASONS } from '../data/useData';
import { scoreColorContinuous, gradeColor, PCT_METRICS } from '../data/constants';
import type { MetricKey } from '../types';

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

// Single-season row — loads its own data
function SeasonRow({ pitcherId, season }: { pitcherId: number; season: number }) {
  const { data } = useData(season as any);
  const pitcher = data?.pitchers.pitchers.find((p) => p.pitcher_id === pitcherId);
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
            color: '#e0e0e8',
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
            color: '#e0e0e8',
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
        Cell shading: red = above average, blue = below average · Seasons with no data are hidden
      </p>
    </div>
  );
}
