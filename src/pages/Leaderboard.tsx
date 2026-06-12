import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rowNavProps } from '../data/rowNavigation';
import { useData } from '../data/useData';
import { GradeBadge } from '../components/GradeBadge';
import { ALL_METRIC_OPTIONS, PCT_METRICS, gradeColor } from '../data/constants';
import { exportCsv } from '../data/exportCsv';
import { SkeletonPage } from '../components/Skeleton';
import type { Pitcher, DimensionKey, MetricKey } from '../types';

function getMetricValue(pitcher: Pitcher, key: string): { grade: number; raw: string } {
  if (key === 'pitch_plus') {
    return { grade: pitcher.pitch_plus, raw: String(pitcher.pitch_plus) };
  }
  if (key.startsWith('dim_')) {
    const dimKey = key.slice(4) as DimensionKey;
    const dim = pitcher.dimensions[dimKey];
    return { grade: dim?.score ?? 0, raw: String(dim?.score ?? 0) };
  }
  if (key.startsWith('metric_')) {
    const mk = key.slice(7) as MetricKey;
    const mg = pitcher.metric_grades[mk];
    if (!mg) return { grade: 0, raw: '—' };
    const rawDisplay = PCT_METRICS.has(mk)
      ? `${(mg.raw * 100).toFixed(1)}%`
      : mk === 'n_pitch_types'
      ? String(Math.round(mg.raw))
      : Math.abs(mg.raw) < 10
      ? mg.raw.toFixed(2)
      : mg.raw.toFixed(1);
    return { grade: mg.grade, raw: rawDisplay };
  }
  return { grade: 0, raw: '—' };
}

export function Leaderboard() {
  const { data, loading, error, season } = useData();
  const navigate = useNavigate();
  const [selectedMetric, setSelectedMetric] = useState('pitch_plus');
  const [minPitches, setMinPitches] = useState(0);
  const [handFilter, setHandFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Starter' | 'Reliever'>('All');
  const [pitchTypeFilter, setPitchTypeFilter] = useState('All');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const teams = useMemo(() => {
    if (!data) return [];
    const s = new Set(data.pitchers.pitchers.map((p) => p.pitcher_team));
    return ['All', ...Array.from(s).sort()];
  }, [data]);

  const allPitchTypes = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    Object.values(data.pitchTypes.pitchers).forEach((types) =>
      types.forEach((t) => s.add(t.pitch_type))
    );
    return Array.from(s).sort();
  }, [data]);

  const starterIds = useMemo(() => {
    if (!data) return new Set<number>();
    const ids = new Set<number>();
    Object.values(data.rotations.teams).forEach((t) =>
      t.rotation_ids.forEach((id) => ids.add(id))
    );
    return ids;
  }, [data]);

  const sorted = useMemo(() => {
    if (!data) return [];
    const pitchers = data.pitchers.pitchers.filter((p) => {
      if (p.n_pitches < minPitches) return false;
      if (handFilter !== 'All' && p.pitcher_hand !== handFilter) return false;
      if (teamFilter !== 'All' && p.pitcher_team !== teamFilter) return false;
      if (roleFilter === 'Starter' && !starterIds.has(p.pitcher_id)) return false;
      if (roleFilter === 'Reliever' && starterIds.has(p.pitcher_id)) return false;
      if (pitchTypeFilter !== 'All') {
        const types = data.pitchTypes.pitchers[String(p.pitcher_id)] ?? [];
        if (!types.some((t) => t.pitch_type === pitchTypeFilter)) return false;
      }
      return true;
    });
    return [...pitchers].sort((a, b) => {
      const av = getMetricValue(a, selectedMetric).grade;
      const bv = getMetricValue(b, selectedMetric).grade;
      return bv - av || a.pitcher_name.localeCompare(b.pitcher_name);
    });
  }, [data, selectedMetric, minPitches, handFilter, teamFilter, roleFilter, starterIds, pitchTypeFilter]);

  // Reset to first page when filters/sort change — render-phase adjustment
  // (avoids the one-frame flash of a stale/out-of-range page an effect would cause)
  const filterKey = `${selectedMetric}|${minPitches}|${handFilter}|${teamFilter}|${roleFilter}|${pitchTypeFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(0);
  }

  if (loading) return <SkeletonPage />;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  const selectedOption = ALL_METRIC_OPTIONS.find((o) => o.key === selectedMetric);
  const maxPitches = data.pitchers.pitchers.length > 0 ? Math.max(...data.pitchers.pitchers.map((p) => p.n_pitches)) : 0;

  // Group options by group
  const groups = Array.from(new Set(ALL_METRIC_OPTIONS.map((o) => o.group)));

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1>Metric Leaderboard</h1>
          <span style={{
            background: 'rgba(74,158,255,0.12)', border: '1px solid rgba(74,158,255,0.3)',
            color: '#4a9eff', borderRadius: 4, padding: '2px 8px', fontSize: 11,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8,
          }}>
            {season} MLB
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p className="subtitle" style={{ margin: 0 }}>Rank any of 33 metrics across all pitchers · {data.pitchers.metadata.n_pitchers.toLocaleString()} pitchers · {data.pitchers.metadata.n_games} games</p>
          <button
            onClick={() => {
              const headers = ['Rank', 'Name', 'Team', 'H', selectedOption?.label ?? 'Value', 'Grade', 'Pitches', 'IP', 'Games'];
              const rows = sorted.map((p, i) => {
                const { raw } = getMetricValue(p, selectedMetric);
                return [i + 1, p.pitcher_name, p.pitcher_team, p.pitcher_hand, raw, getMetricValue(p, selectedMetric).grade, p.n_pitches, p.ip?.toFixed(1) ?? '', p.n_games];
              });
              exportCsv(headers, rows, `leaderboard-${selectedMetric}-${season}.csv`);
            }}
            style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 5,
              border: '1px solid #2a2a3e', background: 'transparent',
              color: '#a0a0b8', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'Overall', key: 'pitch_plus' },
          { label: 'Stuff', key: 'dim_stuff' },
          { label: 'Command', key: 'dim_command' },
          { label: 'Deception', key: 'dim_deception' },
          { label: 'K%', key: 'metric_k_rate' },
          { label: 'Whiff%', key: 'metric_in_zone_whiff_rate' },
          { label: 'wRC+ Against', key: 'metric_wrc_plus_against' },
          { label: 'CSW%', key: 'metric_csw_rate' },
        ].map(({ label, key }) => (
          <button
            key={key}
            onClick={() => setSelectedMetric(key)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: selectedMetric === key ? 600 : 400,
              border: `1px solid ${selectedMetric === key ? '#4a9eff' : '#2a2a3e'}`,
              borderRadius: 12,
              background: selectedMetric === key ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: selectedMetric === key ? '#4a9eff' : '#a0a0b8',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="filters-bar">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: '#a0a0b8', fontSize: 12 }}>Metric</label>
          <select
            className="filter-select"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            style={{ minWidth: 220 }}
          >
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {ALL_METRIC_OPTIONS.filter((o) => o.group === group).map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <select className="filter-select" value={handFilter} onChange={(e) => setHandFilter(e.target.value)}>
          <option value="All">All Hands</option>
          <option value="R">Right</option>
          <option value="L">Left</option>
        </select>

        <select className="filter-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 2 }}>
          {(['All', 'Starter', 'Reliever'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: roleFilter === role ? 600 : 400,
                border: `1px solid ${roleFilter === role ? '#4a9eff' : '#2a2a3e'}`,
                borderRadius: role === 'All' ? '4px 0 0 4px' : role === 'Reliever' ? '0 4px 4px 0' : '0',
                background: roleFilter === role ? 'rgba(74,158,255,0.15)' : '#0f0f1a',
                color: roleFilter === role ? '#4a9eff' : '#a0a0b8',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {role}
            </button>
          ))}
        </div>

        <select className="filter-select" value={pitchTypeFilter} onChange={(e) => setPitchTypeFilter(e.target.value)}>
          <option value="All">All Pitch Types</option>
          {allPitchTypes.map((pt) => (
            <option key={pt} value={pt}>{data.pitchTypes.pitch_names[pt] ?? pt}</option>
          ))}
        </select>

        <div className="slider-group">
          <label>
            Min Pitches: <strong>{minPitches}</strong>
          </label>
          <input
            type="range"
            min={0}
            max={maxPitches}
            step={10}
            value={minPitches}
            onChange={(e) => setMinPitches(Number(e.target.value))}
            style={{ width: 140 }}
          />
        </div>

        <span className="results-count">{sorted.length} pitchers</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #1e1e2e',
            color: '#4a9eff',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          Ranked by: {selectedOption?.label ?? selectedMetric}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['#', 'Name', 'Team', 'Hand', selectedOption?.label ?? 'Value', 'Grade', 'Pitches', 'IP', 'Games'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        color: '#a0a0b8',
                        borderBottom: '2px solid #1e1e2e',
                        background: '#14141f',
                        textAlign: h === 'Name' ? 'left' : 'right',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((pitcher, idx) => {
                const { grade, raw } = getMetricValue(pitcher, selectedMetric);
                const color = gradeColor(grade);
                const rank = page * PAGE_SIZE + idx + 1;
                return (
                  <tr
                    key={pitcher.pitcher_id}
                    className="table-row-hover"
                    {...rowNavProps(navigate, `/player/${pitcher.pitcher_id}`)}
                    style={{ borderBottom: '1px solid #1e1e2e', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '7px 12px', color: '#606080', textAlign: 'right' }}>
                      {rank}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#e0e0e8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {pitcher.pitcher_name}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#a0a0b8', textAlign: 'right' }}>
                      {pitcher.pitcher_team}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#a0a0b8', textAlign: 'right' }}>
                      {pitcher.pitcher_hand}
                    </td>
                    <td
                      style={{
                        padding: '7px 12px',
                        textAlign: 'right',
                        color,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}
                    >
                      {raw}
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      <GradeBadge score={grade} size="sm" />
                    </td>
                    <td style={{ padding: '7px 12px', color: '#a0a0b8', textAlign: 'right' }}>
                      {pitcher.n_pitches.toLocaleString()}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#a0a0b8', textAlign: 'right' }}>
                      {pitcher.ip != null ? pitcher.ip.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '7px 12px', color: '#a0a0b8', textAlign: 'right' }}>
                      {pitcher.n_games}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sorted.length > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 6,
                border: '1px solid #2a2a3e', background: '#1a1a2e', color: page === 0 ? '#404060' : '#e0e0e8',
                cursor: page === 0 ? 'default' : 'pointer',
              }}
            >Prev</button>
            <span style={{ color: '#a0a0b8', fontSize: 12 }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <button
              disabled={(page + 1) * PAGE_SIZE >= sorted.length}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 6,
                border: '1px solid #2a2a3e', background: '#1a1a2e',
                color: (page + 1) * PAGE_SIZE >= sorted.length ? '#404060' : '#e0e0e8',
                cursor: (page + 1) * PAGE_SIZE >= sorted.length ? 'default' : 'pointer',
              }}
            >Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
