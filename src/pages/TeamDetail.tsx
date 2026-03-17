import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../data/useData';
import { DimensionRadarChart } from '../components/DimensionRadarChart';
import { GradeBadge } from '../components/GradeBadge';
import { PlayerTable } from '../components/PlayerTable';
import { gradeColor, DIMENSION_LABELS, METRIC_LABELS } from '../data/constants';
import type { DimensionKey, MetricKey, Pitcher } from '../types';

const DIMENSION_KEYS: DimensionKey[] = [
  'stuff',
  'command',
  'deception',
  'tunnel_and_sequence',
  'outcomes',
  'arsenal',
];

function weightedAvg(pitchers: Pitcher[], getValue: (p: Pitcher) => number): number {
  const total = pitchers.reduce((s, p) => s + p.n_pitches, 0);
  if (total === 0) return 0;
  return pitchers.reduce((s, p) => s + getValue(p) * p.n_pitches, 0) / total;
}


export function TeamDetail() {
  const { abbrev } = useParams<{ abbrev: string }>();
  const navigate = useNavigate();
  const { data, loading, error } = useData();

  const teamData = useMemo(() => {
    if (!data || !abbrev) return null;

    const teamInfo = data.rotations.teams[abbrev];
    if (!teamInfo) return null;

    const pitchers = teamInfo.rotation_ids
      .map((id) => data.pitchers.pitchers.find((p) => p.pitcher_id === id))
      .filter((p): p is Pitcher => p !== undefined);

    const avgPitchPlus = pitchers.length ? weightedAvg(pitchers, (p) => p.pitch_plus) : 0;

    const dimAverages = DIMENSION_KEYS.reduce(
      (acc, d) => {
        acc[d] = pitchers.length
          ? weightedAvg(pitchers, (p) => p.dimensions[d]?.score ?? 100)
          : 100;
        return acc;
      },
      {} as Record<DimensionKey, number>
    );

    // Per-dimension top contributor
    const topContributors = DIMENSION_KEYS.reduce(
      (acc, d) => {
        const top = pitchers.reduce(
          (best, p) =>
            (p.dimensions[d]?.score ?? 0) > (best?.dimensions[d]?.score ?? 0) ? p : best,
          pitchers[0]
        );
        acc[d] = top;
        return acc;
      },
      {} as Record<DimensionKey, Pitcher>
    );

    // League avg metric grades (all 100)
    const leagueMetricAvgs = Object.keys(data.pitchers.population_stats).reduce(
      (acc, k) => {
        acc[k as MetricKey] = 100;
        return acc;
      },
      {} as Record<MetricKey, number>
    );

    // Team avg metric grades (weighted)
    const metricKeys = Object.keys(data.pitchers.population_stats) as MetricKey[];
    const teamMetricAvgs = metricKeys.reduce(
      (acc, mk) => {
        acc[mk] = pitchers.length
          ? weightedAvg(pitchers, (p) => p.metric_grades[mk]?.grade ?? 100)
          : 100;
        return acc;
      },
      {} as Record<MetricKey, number>
    );

    const leagueAllDims = DIMENSION_KEYS.map((d) => ({ dimension: d, score: 100 }));
    const teamDimRadar = DIMENSION_KEYS.map((d) => ({ dimension: d, score: dimAverages[d] }));

    return {
      teamInfo,
      pitchers,
      avgPitchPlus,
      dimAverages,
      topContributors,
      leagueMetricAvgs,
      teamMetricAvgs,
      leagueAllDims,
      teamDimRadar,
      metricKeys,
    };
  }, [data, abbrev]);

  if (loading) return <div className="loading">Loading data…</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data || !teamData) {
    return (
      <div className="page">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h1>Team not found: {abbrev}</h1>
      </div>
    );
  }

  const { teamInfo, pitchers, avgPitchPlus, dimAverages, topContributors, teamMetricAvgs, leagueAllDims, teamDimRadar, metricKeys } = teamData;
  const mainColor = gradeColor(avgPitchPlus);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>
              {abbrev} — {teamInfo.team_name}
            </h1>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              {pitchers.length} pitchers in rotation
            </p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div style={{ color: mainColor, fontSize: 32, fontWeight: 800 }}>
              {Math.round(avgPitchPlus)}
            </div>
            <div style={{ color: '#606080', fontSize: 11 }}>Avg Pitch+</div>
          </div>
        </div>
      </div>

      {/* Dimension score cards */}
      <div className="scores-row">
        {DIMENSION_KEYS.map((d) => {
          const score = dimAverages[d];
          const color = gradeColor(score);
          return (
            <div key={d} className="score-card" style={{ borderTop: `3px solid ${color}` }}>
              <div className="score-card-label">{DIMENSION_LABELS[d]}</div>
              <div className="score-card-value" style={{ color }}>
                {Math.round(score)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="two-col">
        {/* Radar */}
        <div className="card">
          <h3 className="card-title">Team vs League Avg</h3>
          <DimensionRadarChart
            dimensions={teamDimRadar}
            secondaryDimensions={leagueAllDims}
            secondaryLabel="League Avg (100)"
          />
        </div>

        {/* Top contributors */}
        <div className="card">
          <h3 className="card-title">Top Contributor per Dimension</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {DIMENSION_KEYS.map((d) => {
              const top = topContributors[d];
              if (!top) return null;
              const score = top.dimensions[d]?.score ?? 0;
              const color = gradeColor(score);
              return (
                <div
                  key={d}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#0f0f1a',
                    borderRadius: 6,
                    cursor: 'pointer',
                    borderLeft: `3px solid ${color}`,
                  }}
                  onClick={() => navigate(`/player/${top.pitcher_id}`)}
                >
                  <div>
                    <div style={{ color: '#a0a0b8', fontSize: 11 }}>
                      {DIMENSION_LABELS[d]}
                    </div>
                    <div style={{ color: '#e0e0e8', fontWeight: 600 }}>
                      {top.pitcher_name}
                    </div>
                  </div>
                  <GradeBadge score={score} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rotation table */}
      {pitchers.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <h3 className="card-title" style={{ padding: '16px 20px', margin: 0, borderBottom: '1px solid #1e1e2e' }}>
            Rotation Pitchers
          </h3>
          <PlayerTable pitchers={pitchers} showRank={false} />
        </div>
      )}

      {/* Metric comparison vs league */}
      <div className="card">
        <h3 className="card-title">Metric Grades vs League Average</h3>
        <p style={{ color: '#606080', fontSize: 12, marginBottom: 12 }}>
          Team rotation average grade (weighted by pitches) vs league average (100)
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 8,
          }}
        >
          {metricKeys.map((mk) => {
            const teamGrade = teamMetricAvgs[mk] ?? 100;
            const diff = teamGrade - 100;
            const color = gradeColor(teamGrade);
            const barPct = Math.min(100, Math.max(0, ((teamGrade - 60) / 80) * 100));
            return (
              <div
                key={mk}
                style={{
                  background: '#0f0f1a',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: '#a0a0b8', fontSize: 12 }}>
                    {METRIC_LABELS[mk]}
                  </span>
                  <span
                    style={{
                      color,
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    {Math.round(teamGrade)}
                    <span
                      style={{
                        fontSize: 11,
                        marginLeft: 4,
                        color: diff >= 0 ? '#c85a5a' : '#4a6494',
                      }}
                    >
                      {diff >= 0 ? '+' : ''}
                      {diff.toFixed(0)}
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: '#1e1e2e',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${barPct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
