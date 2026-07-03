/**
 * PitchersPanel — the Pitchers tab of the Leaderboard hub.
 *
 * Three views over one filtered pitcher set:
 *   Summary     — PlayerTable (rank, Pitch+, dimensions)
 *   All Metrics — per-dimension raw metric table
 *   Rankings    — rank all pitchers by any single metric (presets + full picker)
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rowNavProps } from '../data/rowNavigation';
import { useData } from '../data/useData';
import { PlayerTable } from '../components/PlayerTable';
import { GradeBadge } from '../components/GradeBadge';
import { ALL_METRIC_OPTIONS, DIMENSION_METRICS, METRIC_LABELS, PCT_METRICS, gradeColor, scoreColor } from '../data/constants';
import { exportCsv } from '../data/exportCsv';
import { SkeletonPage } from '../components/Skeleton';
import type { Pitcher, DimensionKey, MetricKey } from '../types';

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

const stickyTh = {
  borderBottom: '2px solid var(--border)', background: 'var(--bg-input)',
  position: 'sticky' as const, top: 0, zIndex: 1,
  padding: '10px 12px', whiteSpace: 'nowrap' as const,
  textTransform: 'uppercase' as const, letterSpacing: 0.5,
  fontSize: 11,
};

function pillStyle(active: boolean) {
  return {
    padding: '5px 13px', fontSize: 12, border: '1px solid',
    borderColor: active ? 'var(--accent)' : 'var(--border-plus)',
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-2)',
    borderRadius: 4, cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  } as const;
}

// Module scope so React preserves <th> identity across renders (react-hooks/static-components).
function SortTh({ k, label, sortMetric, sortDir, onSort }: {
  k: MetricKey | 'pitch_plus'; label: string;
  sortMetric: MetricKey | 'pitch_plus'; sortDir: 'asc' | 'desc';
  onSort: (k: MetricKey | 'pitch_plus') => void;
}) {
  const active = sortMetric === k;
  return (
    <th onClick={() => onSort(k)} style={{
      ...stickyTh, cursor: 'pointer', userSelect: 'none',
      color: active ? 'var(--accent)' : 'var(--text-2)', fontWeight: active ? 700 : 500,
    }}>
      {label}{active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
    </th>
  );
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

  const sortCtx = { sortMetric, sortDir, onSort: handleSort };

  return (
    <div>
      {/* Dimension tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-2)', fontSize: 12, marginRight: 4 }}>Dimension:</span>
        {DIM_ORDER.map(d => (
          <button key={d} onClick={() => { setActiveDim(d); setSortMetric('pitch_plus'); setSortDir('desc'); }}
            style={pillStyle(activeDim === d)}>
            {DIM_LABEL[d]}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...stickyTh, color: 'var(--text-3)' }}>#</th>
              <th style={{ ...stickyTh, color: 'var(--text-2)', textAlign: 'left' }}>Name</th>
              <th style={{ ...stickyTh, color: 'var(--text-2)' }}>Team</th>
              <th style={{ ...stickyTh, color: 'var(--text-2)' }}>H</th>
              <SortTh k="pitch_plus" label="Pitch+" {...sortCtx} />
              {metrics.map(mk => <SortTh key={mk} k={mk} label={METRIC_LABELS[mk]} {...sortCtx} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.pitcher_id} {...rowNavProps(navigate, `/player/${p.pitcher_id}`)}
                className="table-row-hover"
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--text-3)', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.pitcher_name}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-2)', textAlign: 'center' }}>{p.pitcher_team}</td>
                <td style={{ padding: '8px 12px', color: 'var(--text-2)', textAlign: 'center' }}>{p.pitcher_hand}</td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  <GradeBadge score={p.pitch_plus} size="sm" />
                </td>
                {metrics.map(mk => {
                  const mg = p.metric_grades[mk];
                  if (!mg) return <td key={mk} style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-3)', borderRight: '1px solid var(--border)' }}>—</td>;
                  return (
                    <td key={mk} style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, borderRight: '1px solid var(--border)' }}>
                      <span title={`Grade: ${Math.round(mg.grade)}`} style={{ color: 'var(--text-1)' }}>
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

// ─── Rankings view (rank by any single metric) ───────────────────────────────

// grade: null = pitcher has no value for this metric (sorts last, shows '—',
// exports blank — never a fake 0, per the app's N/A convention).
function getMetricValue(pitcher: Pitcher, key: string): { grade: number | null; raw: string } {
  if (key === 'pitch_plus') {
    return { grade: pitcher.pitch_plus, raw: String(pitcher.pitch_plus) };
  }
  if (key.startsWith('dim_')) {
    const dimKey = key.slice(4) as DimensionKey;
    const dim = pitcher.dimensions[dimKey];
    return dim ? { grade: dim.score, raw: String(dim.score) } : { grade: null, raw: '—' };
  }
  if (key.startsWith('metric_')) {
    const mk = key.slice(7) as MetricKey;
    const mg = pitcher.metric_grades[mk];
    if (!mg) return { grade: null, raw: '—' };
    const rawDisplay = PCT_METRICS.has(mk)
      ? `${(mg.raw * 100).toFixed(1)}%`
      : mk === 'n_pitch_types'
      ? String(Math.round(mg.raw))
      : Math.abs(mg.raw) < 10
      ? mg.raw.toFixed(2)
      : mg.raw.toFixed(1);
    return { grade: mg.grade, raw: rawDisplay };
  }
  return { grade: null, raw: '—' };
}

const RANK_PRESETS = [
  { label: 'Overall', key: 'pitch_plus' },
  { label: 'Stuff', key: 'dim_stuff' },
  { label: 'Command', key: 'dim_command' },
  { label: 'Deception', key: 'dim_deception' },
  { label: 'K%', key: 'metric_k_rate' },
  { label: 'Whiff%', key: 'metric_in_zone_whiff_rate' },
  { label: 'wRC+ Against', key: 'metric_wrc_plus_against' },
  { label: 'CSW%', key: 'metric_csw_rate' },
];

function RankingsView({ pitchers, season }: { pitchers: Pitcher[]; season: number }) {
  const navigate = useNavigate();
  const [selectedMetric, setSelectedMetric] = useState('pitch_plus');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const sorted = useMemo(() =>
    [...pitchers].sort((a, b) => {
      const av = getMetricValue(a, selectedMetric).grade ?? -Infinity;
      const bv = getMetricValue(b, selectedMetric).grade ?? -Infinity;
      return bv - av || a.pitcher_name.localeCompare(b.pitcher_name);
    }),
    [pitchers, selectedMetric]
  );

  // Reset page when metric or upstream filters change — render-phase adjustment
  const filterKey = `${selectedMetric}|${pitchers.length}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(0);
  }

  const selectedOption = ALL_METRIC_OPTIONS.find((o) => o.key === selectedMetric);
  const groups = Array.from(new Set(ALL_METRIC_OPTIONS.map((o) => o.group)));

  return (
    <div>
      {/* Presets + metric picker + export */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        {RANK_PRESETS.map(({ label, key }) => (
          <button key={key} onClick={() => setSelectedMetric(key)}
            style={{ ...pillStyle(selectedMetric === key), borderRadius: 12, padding: '4px 10px', fontSize: 11 }}>
            {label}
          </button>
        ))}
        <select
          className="filter-select"
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          style={{ minWidth: 220 }}
        >
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {ALL_METRIC_OPTIONS.filter((o) => o.group === group).map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={() => {
            const headers = ['Rank', 'Name', 'Team', 'H', selectedOption?.label ?? 'Value', 'Grade', 'Pitches', 'IP', 'Games'];
            const rows = sorted.map((p, i) => {
              const { raw, grade } = getMetricValue(p, selectedMetric);
              return [i + 1, p.pitcher_name, p.pitcher_team, p.pitcher_hand, raw, grade ?? '', p.n_pitches, p.ip?.toFixed(1) ?? '', p.n_games];
            });
            exportCsv(headers, rows, `leaderboard-${selectedMetric}-${season}.csv`);
          }}
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 5, marginLeft: 'auto',
            border: '1px solid var(--border-plus)', background: 'transparent',
            color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          ↓ Export CSV
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          color: 'var(--accent)', fontWeight: 600, fontSize: 14,
        }}>
          Ranked by: {selectedOption?.label ?? selectedMetric}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['#', 'Name', 'Team', 'Hand', selectedOption?.label ?? 'Value', 'Grade', 'Pitches', 'IP', 'Games'].map((h) => (
                  <th key={h} style={{
                    padding: '8px 12px', color: 'var(--text-2)',
                    borderBottom: '2px solid var(--border)', background: 'var(--bg-input)',
                    textAlign: h === 'Name' ? 'left' : 'right', fontWeight: 500,
                    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((pitcher, idx) => {
                const { grade, raw } = getMetricValue(pitcher, selectedMetric);
                const color = grade != null ? gradeColor(grade) : 'var(--text-3)';
                const rank = page * PAGE_SIZE + idx + 1;
                return (
                  <tr
                    key={pitcher.pitcher_id}
                    className="table-row-hover"
                    {...rowNavProps(navigate, `/player/${pitcher.pitcher_id}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '7px 12px', color: 'var(--text-3)', textAlign: 'right' }}>{rank}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{pitcher.pitcher_name}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-2)', textAlign: 'right' }}>{pitcher.pitcher_team}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-2)', textAlign: 'right' }}>{pitcher.pitcher_hand}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color, fontWeight: 700, fontFamily: 'var(--mono)' }}>{raw}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                      {grade != null
                        ? <GradeBadge score={grade} size="sm" />
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-2)', textAlign: 'right' }}>{pitcher.n_pitches.toLocaleString()}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-2)', textAlign: 'right' }}>{pitcher.ip != null ? pitcher.ip.toFixed(1) : '—'}</td>
                    <td style={{ padding: '7px 12px', color: 'var(--text-2)', textAlign: 'right' }}>{pitcher.n_games}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sorted.length > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '16px 0' }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--border-plus)', background: 'var(--bg-elevated)',
                color: page === 0 ? 'var(--text-4)' : 'var(--text-1)',
                cursor: page === 0 ? 'default' : 'pointer',
              }}
            >Prev</button>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <button
              disabled={(page + 1) * PAGE_SIZE >= sorted.length}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 6,
                border: '1px solid var(--border-plus)', background: 'var(--bg-elevated)',
                color: (page + 1) * PAGE_SIZE >= sorted.length ? 'var(--text-4)' : 'var(--text-1)',
                cursor: (page + 1) * PAGE_SIZE >= sorted.length ? 'default' : 'pointer',
              }}
            >Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pitchers panel ───────────────────────────────────────────────────────────

type ViewMode = 'summary' | 'metrics' | 'rankings';

const VIEW_LABEL: Record<ViewMode, string> = {
  summary: 'Summary', metrics: 'All Metrics', rankings: 'Rankings',
};

export function PitchersPanel() {
  const { data, loading, error, season } = useData();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [handFilter, setHandFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Starter' | 'Reliever'>('All');
  const [minPitches, setMinPitches] = useState(0);
  const [pitchTypeFilter, setPitchTypeFilter] = useState('All');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

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
    <div>
      <p className="subtitle" style={{ marginTop: 0, marginBottom: 14 }}>
        {meta.n_pitchers.toLocaleString()} pitchers ·{' '}
        {meta.n_pitches.toLocaleString()} pitches ·{' '}
        {meta.n_games} games · Model {meta.model_version} ·{' '}
        Generated {meta.generated}
      </p>

      {/* Filters */}
      <div className="filters-bar">
        <input
          className="search-input"
          placeholder="Filter by pitcher name…"
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
                ...pillStyle(roleFilter === role),
                borderRadius: role === 'All' ? '4px 0 0 4px' : role === 'Reliever' ? '0 4px 4px 0' : '0',
                background: roleFilter === role ? 'var(--accent-dim)' : 'var(--bg-input)',
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
        {viewMode !== 'metrics' && (
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
        <span style={{ color: 'var(--text-2)', fontSize: 12 }}>View:</span>
        {(['summary', 'metrics', 'rankings'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} style={pillStyle(viewMode === mode)}>
            {VIEW_LABEL[mode]}
          </button>
        ))}
      </div>

      {viewMode === 'summary' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <PlayerTable
            pitchers={filtered}
            showRank
            {...(pitchTypeFilter !== 'All' && { pitchTypeFilter })}
            {...(pitchTypeFilter !== 'All' && data?.pitchTypes && { pitchTypesData: data.pitchTypes })}
          />
        </div>
      )}
      {viewMode === 'metrics' && <MetricsTable pitchers={filtered} />}
      {viewMode === 'rankings' && <RankingsView pitchers={filtered} season={season} />}
    </div>
  );
}
