import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rowNavProps } from '../data/rowNavigation';
import { useData } from '../data/useData';
import { gradeColor, DIMENSION_LABELS } from '../data/constants';
import type { DimensionKey, Pitcher } from '../types';

const DIMENSION_KEYS: DimensionKey[] = [
  'stuff',
  'command',
  'deception',
  'tunnel_and_sequence',
  'outcomes',
  'arsenal',
];

type SortOption =
  | 'pitch_plus'
  | 'stuff'
  | 'command'
  | 'deception'
  | 'tunnel_and_sequence'
  | 'outcomes'
  | 'arsenal'
  | 'team_name';

function weightedAvg(pitchers: Pitcher[], getValue: (p: Pitcher) => number): number {
  const total = pitchers.reduce((s, p) => s + p.n_pitches, 0);
  if (total === 0) return 0;
  return pitchers.reduce((s, p) => s + getValue(p) * p.n_pitches, 0) / total;
}

interface MiniBarProps {
  values: { label: string; score: number }[];
}

function MiniBar({ values }: MiniBarProps) {
  const max = 140;
  const min = 60;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
      {values.map(({ label, score }) => {
        const pct = ((score - min) / (max - min)) * 100;
        const color = gradeColor(score);
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-3)', fontSize: 10, width: 26, flexShrink: 0 }}>{label}</span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: 'var(--border)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, pct))}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 3,
                }}
              />
            </div>
            <span style={{ color, fontSize: 10, width: 26, textAlign: 'right' }}>
              {Math.round(score)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TeamBrowser() {
  const { data, loading, error } = useData();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('pitch_plus');

  const teamCards = useMemo(() => {
    if (!data) return [];

    return Object.entries(data.rotations.teams).map(([abbrev, team]) => {
      const pitchers = team.rotation_ids
        .map((id) => data.pitchers.pitchers.find((p) => p.pitcher_id === id))
        .filter((p): p is Pitcher => p !== undefined);

      const avgPitchPlus = pitchers.length
        ? weightedAvg(pitchers, (p) => p.pitch_plus)
        : 0;

      const dimAverages = DIMENSION_KEYS.reduce(
        (acc, d) => {
          acc[d] = pitchers.length
            ? weightedAvg(pitchers, (p) => p.dimensions[d]?.score ?? 100)
            : 100;
          return acc;
        },
        {} as Record<DimensionKey, number>
      );

      return {
        abbrev,
        team_name: team.team_name,
        pitchers,
        n_pitchers: pitchers.length,
        avgPitchPlus,
        dimAverages,
      };
    });
  }, [data]);

  const sorted = useMemo(() => {
    return [...teamCards].sort((a, b) => {
      if (sortBy === 'team_name') return a.team_name.localeCompare(b.team_name);
      if (sortBy === 'pitch_plus') return b.avgPitchPlus - a.avgPitchPlus;
      return (b.dimAverages[sortBy as DimensionKey] ?? 0) - (a.dimAverages[sortBy as DimensionKey] ?? 0);
    });
  }, [teamCards, sortBy]);

  if (loading) return <div className="loading">Loading data…</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Team Rotations</h1>
        <p className="subtitle">30 teams · weighted by pitch count</p>
      </div>

      <div className="filters-bar">
        <label style={{ color: 'var(--text-2)' }}>Sort by:</label>
        <select
          className="filter-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="pitch_plus">Pitch+</option>
          <option value="team_name">Team Name</option>
          {DIMENSION_KEYS.map((d) => (
            <option key={d} value={d}>
              {DIMENSION_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      <div className="team-grid">
        {sorted.map((t, idx) => {
          const displayScore = (sortBy === 'pitch_plus' || sortBy === 'team_name')
            ? t.avgPitchPlus
            : t.dimAverages[sortBy as DimensionKey];
          const displayColor = gradeColor(displayScore);
          const displayLabel = (sortBy === 'pitch_plus' || sortBy === 'team_name')
            ? 'Pitch+'
            : DIMENSION_LABELS[sortBy as DimensionKey];
          return (
            <div
              key={t.abbrev}
              className="team-card"
              {...rowNavProps(navigate, `/team/${t.abbrev}`)}
              style={{ borderTop: `3px solid ${displayColor}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div
                    style={{
                      color: 'var(--text-3)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 1,
                      marginBottom: 2,
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <div style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 15 }}>
                    {t.abbrev}
                  </div>
                  <div style={{ color: 'var(--text-2)', fontSize: 11, marginTop: 1 }}>
                    {t.team_name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: displayColor, fontSize: 22, fontWeight: 800 }}>
                    {Math.round(displayScore)}
                  </div>
                  <div style={{ color: 'var(--text-3)', fontSize: 10 }}>{displayLabel}</div>
                </div>
              </div>

              <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 8 }}>
                {t.n_pitchers} pitcher{t.n_pitchers !== 1 ? 's' : ''} matched
              </div>

              <MiniBar
                values={DIMENSION_KEYS.map((d) => ({
                  label: DIMENSION_LABELS[d].substring(0, 3),
                  score: t.dimAverages[d],
                }))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
