import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rowNavProps } from '../data/rowNavigation';
import { useData } from '../data/useData';
import { PlayerTable } from '../components/PlayerTable';
import { GradeBadge } from '../components/GradeBadge';
import { DIMENSION_METRICS, METRIC_LABELS, PCT_METRICS, scoreColor } from '../data/constants';
import { SkeletonPage } from '../components/Skeleton';
import type { Pitcher, DimensionKey, MetricKey } from '../types';

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ label, color = '#4a9eff' }: { label: string; color?: string }) {
  return (
    <span style={{
      background: `${color}18`, border: `1px solid ${color}40`,
      color, borderRadius: 4, padding: '2px 8px', fontSize: 11,
      fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.8,
    }}>
      {label}
    </span>
  );
}

// ─── Metrics detail table ─────────────────────────────────────────────────────

const DIM_ORDER: DimensionKey[] = ['stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal'];
const DIM_LABEL: Record<DimensionKey, string> = {
  stuff: 'Stuff', command: 'Command', deception: 'Deception',
  tunnel_and_sequence: 'Tunnel & Seq', outcomes: 'Outcomes', arsenal: 'Arsenal',
};

function formatMetric(key: MetricKey, raw: number): string {
  if (PCT_METRICS.has(key)) return `${(raw * 100).toFixed(1)}%`;
  if (key === 'n_pitch_types') return String(Math.round(raw));
  if (Math.abs(raw) < 10) return raw.toFixed(2);
  return raw.toFixed(1);
}

function MetricsTable({ pitchers }: { pitchers: Pitcher[] }) {
  const navigate = useNavigate();
  const [activeDim, setActiveDim] = useState<DimensionKey>('stuff');
  const [sortMetric, setSortMetric] = useState<MetricKey | 'pitch_plus'>('pitch_plus');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const metrics = DIMENSION_METRICS[activeDim];

  function handleSort(k: MetricKey | 'pitch_plus') {
    if (k === sortMetric) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortMetric(k); setSortDir('desc'); }
  }

  const sorted = useMemo(() =>
    [...pitchers].sort((a, b) => {
      let av: number, bv: number;
      if (sortMetric === 'pitch_plus') { av = a.pitch_plus; bv = b.pitch_plus; }
      else {
        av = a.metric_grades[sortMetric]?.grade ?? 0;
        bv = b.metric_grades[sortMetric]?.grade ?? 0;
      }
      return sortDir === 'desc' ? bv - av : av - bv;
    }),
    [pitchers, sortMetric, sortDir]
  );

  const stickyTh = {
    borderBottom: '2px solid #1e1e2e', background: '#0f0f1a',
    position: 'sticky' as const, top: 0, zIndex: 1,
    padding: '10px 12px', whiteSpace: 'nowrap' as const,
    textTransform: 'uppercase' as const, letterSpacing: 0.5,
    fontSize: 11,
  };

  function SortTh({ k, label }: { k: MetricKey | 'pitch_plus'; label: string }) {
    const active = sortMetric === k;
    return (
      <th onClick={() => handleSort(k)} style={{
        ...stickyTh, cursor: 'pointer', userSelect: 'none',
        color: active ? '#4a9eff' : '#a0a0b8', fontWeight: active ? 700 : 500,
      }}>
        {label}{active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
      </th>
    );
  }

  return (
    <div>
      {/* Dimension tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#a0a0b8', fontSize: 12, marginRight: 4 }}>Dimension:</span>
        {DIM_ORDER.map(d => (
          <button key={d} onClick={() => { setActiveDim(d); setSortMetric('pitch_plus'); setSortDir('desc'); }}
            style={{
              padding: '5px 13px', fontSize: 12, border: '1px solid',
              borderColor: activeDim === d ? '#4a9eff' : '#2a2a3e',
              background: activeDim === d ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: activeDim === d ? '#4a9eff' : '#a0a0b8',
              borderRadius: 4, cursor: 'pointer',
            }}>
            {DIM_LABEL[d]}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #1e1e2e' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...stickyTh, color: '#606080' }}>#</th>
              <th style={{ ...stickyTh, color: '#a0a0b8', textAlign: 'left' }}>Name</th>
              <th style={{ ...stickyTh, color: '#a0a0b8' }}>Team</th>
              <th style={{ ...stickyTh, color: '#a0a0b8' }}>H</th>
              <SortTh k="pitch_plus" label="Pitch+" />
              {metrics.map(mk => <SortTh key={mk} k={mk} label={METRIC_LABELS[mk]} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.pitcher_id} {...rowNavProps(navigate, `/player/${p.pitcher_id}`)}
                className="table-row-hover"
                style={{ borderBottom: '1px solid #1e1e2e', cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 12px', color: '#606080', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '8px 12px', color: '#e0e0e8', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.pitcher_name}</td>
                <td style={{ padding: '8px 12px', color: '#a0a0b8', textAlign: 'center' }}>{p.pitcher_team}</td>
                <td style={{ padding: '8px 12px', color: '#a0a0b8', textAlign: 'center' }}>{p.pitcher_hand}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <GradeBadge score={p.pitch_plus} size="sm" />
                </td>
                {metrics.map(mk => {
                  const mg = p.metric_grades[mk];
                  if (!mg) return <td key={mk} style={{ padding: '8px 12px', textAlign: 'center', color: '#606080', borderRight: '1px solid #151520' }}>—</td>;
                  return (
                    <td key={mk} style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12, borderRight: '1px solid #151520' }}>
                      <span title={`Grade: ${Math.round(mg.grade)}`} style={{ color: '#e0e0e8' }}>
                        {formatMetric(mk, mg.raw)}
                      </span>
                      <span style={{ display: 'block', height: 2, borderRadius: 1, marginTop: 2, background: scoreColor(mg.grade) }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PlayerBrowser() {
  const { data, loading, error, season } = useData();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [handFilter, setHandFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Starter' | 'Reliever'>('All');
  const [minPitches, setMinPitches] = useState(0);
  const [pitchTypeFilter, setPitchTypeFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'summary' | 'metrics'>('summary');

  const teams = useMemo(() => {
    if (!data) return [];
    const s = new Set(data.pitchers.pitchers.map((p) => p.pitcher_team));
    return ['All', ...Array.from(s).sort()];
  }, [data]);

  // Build starter set from rotations.json rotation_ids
  const starterIds = useMemo(() => {
    if (!data) return new Set<number>();
    const ids = new Set<number>();
    Object.values(data.rotations.teams).forEach((t) =>
      t.rotation_ids.forEach((id) => ids.add(id))
    );
    return ids;
  }, [data]);

  const allPitchTypes = useMemo(() => {
    if (!data) return [];
    const s = new Set<string>();
    Object.values(data.pitchTypes.pitchers).forEach((types) =>
      types.forEach((t) => s.add(t.pitch_type))
    );
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.pitchers.pitchers.filter((p) => {
      if (search && !p.pitcher_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter !== 'All' && p.pitcher_team !== teamFilter) return false;
      if (handFilter !== 'All' && p.pitcher_hand !== handFilter) return false;
      if (roleFilter === 'Starter' && !starterIds.has(p.pitcher_id)) return false;
      if (roleFilter === 'Reliever' && starterIds.has(p.pitcher_id)) return false;
      if (p.n_pitches < minPitches) return false;
      if (pitchTypeFilter !== 'All') {
        const types = data.pitchTypes.pitchers[String(p.pitcher_id)] ?? [];
        if (!types.some((t) => t.pitch_type === pitchTypeFilter)) return false;
      }
      return true;
    });
  }, [data, search, teamFilter, handFilter, roleFilter, starterIds, minPitches, pitchTypeFilter]);

  if (loading) return <SkeletonPage />;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return null;

  const maxPitches = data.pitchers.pitchers.length > 0 ? Math.max(...data.pitchers.pitchers.map((p) => p.n_pitches)) : 0;
  const meta = data.pitchers.metadata;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h1>Player Browser</h1>
          <SourceBadge label={`${season} MLB`} color="#4a9eff" />
        </div>
        <p className="subtitle">
          {meta.n_pitchers.toLocaleString()} pitchers ·{' '}
          {meta.n_pitches.toLocaleString()} pitches ·{' '}
          {meta.n_games} games · Model {meta.model_version} ·{' '}
          Generated {meta.generated}
        </p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          className="search-input"
          placeholder="Search pitcher name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="filter-select" value={handFilter} onChange={(e) => setHandFilter(e.target.value)}>
          <option value="All">All Hands</option>
          <option value="R">Right</option>
          <option value="L">Left</option>
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
        <div className="slider-group">
          <label>Min Pitches: <strong>{minPitches}</strong></label>
          <input type="range" min={0} max={maxPitches} step={10} value={minPitches}
            onChange={(e) => setMinPitches(Number(e.target.value))} style={{ width: 140 }} />
        </div>
        {viewMode === 'summary' && (
          <select className="filter-select" value={pitchTypeFilter} onChange={(e) => setPitchTypeFilter(e.target.value)}>
            <option value="All">All Pitch Types</option>
            {allPitchTypes.map((pt) => (
              <option key={pt} value={pt}>{data?.pitchTypes.pitch_names[pt] ?? pt}</option>
            ))}
          </select>
        )}
        <span className="results-count">{filtered.length} results</span>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ color: '#a0a0b8', fontSize: 12 }}>View:</span>
        {(['summary', 'metrics'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            style={{
              padding: '5px 14px', fontSize: 12, border: '1px solid',
              borderColor: viewMode === mode ? '#4a9eff' : '#2a2a3e',
              background: viewMode === mode ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: viewMode === mode ? '#4a9eff' : '#a0a0b8',
              borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize',
            }}>
            {mode === 'summary' ? 'Summary' : 'All Metrics'}
          </button>
        ))}
      </div>

      {viewMode === 'summary' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <PlayerTable
            pitchers={filtered}
            showRank
            {...(pitchTypeFilter !== 'All' && { pitchTypeFilter })}
            {...(pitchTypeFilter !== 'All' && data?.pitchTypes && { pitchTypesData: data.pitchTypes })}
          />
        </div>
      ) : (
        <MetricsTable pitchers={filtered} />
      )}
    </div>
  );
}
