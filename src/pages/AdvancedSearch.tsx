/**
 * Advanced Search — Baseball Savant-style slice/filter over all pitcher metrics.
 * Supports: season, team, hand, game type, pitch type, min pitches,
 *           metric range filters, and full-text search.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../data/useData';
import { GradeBadge } from '../components/GradeBadge';
import { gradeColor, ALL_METRIC_OPTIONS, PCT_METRICS, METRIC_LABELS, DIMENSION_LABELS } from '../data/constants';
import type { Pitcher, MetricKey, DimensionKey } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RangeFilter { min: string; max: string }
type SortField = 'pitch_plus' | MetricKey | DimensionKey;

// ── Helpers ───────────────────────────────────────────────────────────────────

function metricRaw(p: Pitcher, key: MetricKey): number | null {
  return p.metric_grades[key]?.raw ?? null;
}
function metricGrade(p: Pitcher, key: MetricKey): number {
  return p.metric_grades[key]?.grade ?? 0;
}
function dimScore(p: Pitcher, key: DimensionKey): number {
  return p.dimensions[key]?.score ?? 0;
}
function displayRaw(key: MetricKey, raw: number): string {
  if (PCT_METRICS.has(key)) return `${(raw * 100).toFixed(1)}%`;
  if (key === 'n_pitch_types') return String(Math.round(raw));
  return Math.abs(raw) < 10 ? raw.toFixed(2) : raw.toFixed(1);
}

const SORTABLE_DIMS = Object.keys(DIMENSION_LABELS) as DimensionKey[];
const SORTABLE_METRICS = (Object.keys(METRIC_LABELS) as MetricKey[]).slice(0, 20); // top metrics

const SEL_STYLE = {
  background: '#1a1a2e', border: '1px solid #2a2a3e',
  color: '#e0e0e8', borderRadius: 6, padding: '7px 10px', fontSize: 13,
};

const INPUT_STYLE = {
  background: '#1a1a2e', border: '1px solid #2a2a3e',
  color: '#e0e0e8', borderRadius: 6, padding: '7px 10px', fontSize: 13,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AdvancedSearch() {
  const { data, loading, error, season } = useData();
  const navigate = useNavigate();

  // Filter state
  const [search,         setSearch]        = useState('');
  const [teamFilter,     setTeamFilter]     = useState('All');
  const [handFilter,     setHandFilter]     = useState('All');
  const [pitchTypeFilter,setPitchTypeFilter]= useState('All');
  const [minPitches,     setMinPitches]     = useState(0);
  const [sortField,      setSortField]      = useState<SortField>('pitch_plus');
  const [sortAsc,        setSortAsc]        = useState(false);

  // Which columns to show (user-configurable)
  const [shownDims,      setShownDims]      = useState<Set<DimensionKey>>(
    new Set(SORTABLE_DIMS)
  );
  const [shownMetric,    setShownMetric]    = useState<MetricKey | null>(null);

  // Metric range filters
  const [rangeFilters,   setRangeFilters]   = useState<Partial<Record<MetricKey, RangeFilter>>>({});

  const teams = useMemo(() => {
    if (!data) return ['All'];
    return ['All', ...Array.from(new Set(data.pitchers.pitchers.map(p => p.pitcher_team))).sort()];
  }, [data]);

  const allPitchTypes = useMemo(() => {
    if (!data) return ['All'];
    const s = new Set<string>();
    Object.values(data.pitchTypes.pitchers).forEach(ts => ts.forEach(t => s.add(t.pitch_type)));
    return ['All', ...Array.from(s).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let ps = data.pitchers.pitchers;

    if (search)               ps = ps.filter(p => p.pitcher_name.toLowerCase().includes(search.toLowerCase()));
    if (teamFilter !== 'All') ps = ps.filter(p => p.pitcher_team === teamFilter);
    if (handFilter !== 'All') ps = ps.filter(p => p.pitcher_hand === handFilter);
    if (minPitches > 0)       ps = ps.filter(p => p.n_pitches >= minPitches);
    if (pitchTypeFilter !== 'All') {
      ps = ps.filter(p => {
        const types = data.pitchTypes.pitchers[String(p.pitcher_id)] ?? [];
        return types.some(t => t.pitch_type === pitchTypeFilter);
      });
    }

    // Range filters
    for (const [mk, range] of Object.entries(rangeFilters)) {
      const metricKey = mk as MetricKey;
      const lo = range?.min !== '' ? parseFloat(range!.min) : -Infinity;
      const hi = range?.max !== '' ? parseFloat(range!.max) :  Infinity;
      if (!isNaN(lo) || !isNaN(hi)) {
        ps = ps.filter(p => {
          const raw = metricRaw(p, metricKey);
          if (raw === null) return false;
          const val = PCT_METRICS.has(metricKey) ? raw * 100 : raw;
          return val >= lo && val <= hi;
        });
      }
    }

    // Sort
    return [...ps].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortField === 'pitch_plus') { av = a.pitch_plus; bv = b.pitch_plus; }
      else if (SORTABLE_DIMS.includes(sortField as DimensionKey)) {
        av = dimScore(a, sortField as DimensionKey);
        bv = dimScore(b, sortField as DimensionKey);
      } else {
        av = metricGrade(a, sortField as MetricKey);
        bv = metricGrade(b, sortField as MetricKey);
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [data, search, teamFilter, handFilter, minPitches, pitchTypeFilter, rangeFilters, sortField, sortAsc]);

  function handleSortField(f: SortField) {
    if (f === sortField) setSortAsc(a => !a);
    else { setSortField(f); setSortAsc(false); }
  }

  function setRange(mk: MetricKey, side: 'min' | 'max', val: string) {
    setRangeFilters(prev => ({
      ...prev,
      [mk]: { ...{ min: '', max: '' }, ...(prev[mk] ?? {}), [side]: val },
    }));
  }

  if (loading) return <div className="loading">Loading…</div>;
  if (error)   return <div className="error">Error: {error}</div>;
  if (!data)   return null;

  const stickyTh = {
    background: '#14141f', borderBottom: '2px solid #1e1e2e',
    position: 'sticky' as const, top: 0, zIndex: 2,
    padding: '8px 10px', whiteSpace: 'nowrap' as const, userSelect: 'none' as const,
  };

  function SortTh({ field, label, title }: { field: SortField; label: string; title?: string }) {
    const active = sortField === field;
    return (
      <th onClick={() => handleSortField(field)} title={title} style={{
        ...stickyTh, cursor: 'pointer',
        color: active ? '#4a9eff' : '#a0a0b8',
        fontWeight: active ? 700 : 500,
      }}>
        {label}{active ? (sortAsc ? ' ▲' : ' ▼') : ''}
      </th>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Advanced Search</h1>
        <p className="subtitle">
          {data.pitchers.metadata.n_pitchers.toLocaleString()} pitchers ·{' '}
          {data.pitchers.metadata.n_pitches.toLocaleString()} pitches ·{' '}
          {String(season).replace('spring_', 'Spring ').replace('_', ' ')}
        </p>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <div style={{ color: '#a0a0b8', fontSize: 11, marginBottom: 4 }}>SEARCH</div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pitcher name…" style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ color: '#a0a0b8', fontSize: 11, marginBottom: 4 }}>TEAM</div>
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
            style={{ ...SEL_STYLE, width: '100%' }}>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={{ color: '#a0a0b8', fontSize: 11, marginBottom: 4 }}>THROWS</div>
          <select value={handFilter} onChange={e => setHandFilter(e.target.value)}
            style={{ ...SEL_STYLE, width: '100%' }}>
            <option value="All">All</option>
            <option value="R">RHP</option>
            <option value="L">LHP</option>
          </select>
        </div>
        <div>
          <div style={{ color: '#a0a0b8', fontSize: 11, marginBottom: 4 }}>PITCH TYPE</div>
          <select value={pitchTypeFilter} onChange={e => setPitchTypeFilter(e.target.value)}
            style={{ ...SEL_STYLE, width: '100%' }}>
            {allPitchTypes.map(pt => (
              <option key={pt} value={pt}>
                {pt === 'All' ? 'All Types' : (data.pitchTypes.pitch_names[pt] ?? pt)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ color: '#a0a0b8', fontSize: 11, marginBottom: 4 }}>MIN PITCHES</div>
          <input type="number" value={minPitches} min={0} step={10}
            onChange={e => setMinPitches(Number(e.target.value))}
            style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ color: '#a0a0b8', fontSize: 11, marginBottom: 4 }}>SORT BY</div>
          <select value={sortField} onChange={e => setSortField(e.target.value as SortField)}
            style={{ ...SEL_STYLE, width: '100%' }}>
            <option value="pitch_plus">Pitch+</option>
            <optgroup label="Dimensions">
              {SORTABLE_DIMS.map(d => <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>)}
            </optgroup>
            <optgroup label="Metrics">
              {SORTABLE_METRICS.map(m => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      {/* ── Metric range filters ── */}
      <details style={{ color: '#a0a0b8', fontSize: 13 }}>
        <summary style={{ cursor: 'pointer', color: '#4a9eff', fontWeight: 600, marginBottom: 10 }}>
          + Metric Range Filters
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, paddingTop: 8 }}>
          {SORTABLE_METRICS.map(mk => (
            <div key={mk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 120, fontSize: 12, color: '#a0a0b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {METRIC_LABELS[mk]}{PCT_METRICS.has(mk) ? ' (%)' : ''}
              </span>
              <input placeholder="min" type="number" step="any"
                value={rangeFilters[mk]?.min ?? ''} onChange={e => setRange(mk, 'min', e.target.value)}
                style={{ ...INPUT_STYLE, width: 60, padding: '4px 6px', fontSize: 12 }} />
              <span style={{ color: '#606080' }}>–</span>
              <input placeholder="max" type="number" step="any"
                value={rangeFilters[mk]?.max ?? ''} onChange={e => setRange(mk, 'max', e.target.value)}
                style={{ ...INPUT_STYLE, width: 60, padding: '4px 6px', fontSize: 12 }} />
            </div>
          ))}
        </div>
      </details>

      {/* ── Column toggles ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#a0a0b8', fontSize: 12 }}>Show metric:</span>
        {SORTABLE_METRICS.slice(0, 12).map(mk => (
          <button key={mk} onClick={() => setShownMetric(prev => prev === mk ? null : mk)}
            style={{
              padding: '3px 10px', fontSize: 11, border: '1px solid',
              borderColor: shownMetric === mk ? '#4a9eff' : '#2a2a3e',
              background: shownMetric === mk ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: shownMetric === mk ? '#4a9eff' : '#606080',
              borderRadius: 4, cursor: 'pointer',
            }}>
            {METRIC_LABELS[mk]}
          </button>
        ))}
      </div>

      {/* ── Results count ── */}
      <div style={{ color: '#606080', fontSize: 13 }}>
        {filtered.length.toLocaleString()} results
        {Object.values(rangeFilters).some(r => r?.min || r?.max) && (
          <button onClick={() => setRangeFilters({})}
            style={{ marginLeft: 12, color: '#4a9eff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            Clear range filters ×
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...stickyTh, color: '#606080' }}>#</th>
                <th style={{ ...stickyTh, textAlign: 'left', color: '#a0a0b8' }}>Pitcher</th>
                <th style={{ ...stickyTh, color: '#a0a0b8' }}>Team</th>
                <th style={{ ...stickyTh, color: '#a0a0b8' }}>H</th>
                <SortTh field="pitch_plus" label="Pitch+" />
                {SORTABLE_DIMS.map(d => (
                  <SortTh key={d} field={d} label={DIMENSION_LABELS[d].slice(0, 4)} title={DIMENSION_LABELS[d]} />
                ))}
                {shownMetric && (
                  <SortTh field={shownMetric} label={METRIC_LABELS[shownMetric]} />
                )}
                <th style={{ ...stickyTh, color: '#a0a0b8' }}>Pitches</th>
                <th style={{ ...stickyTh, color: '#a0a0b8' }}>G</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.pitcher_id}
                  onClick={() => navigate(`/player/${p.pitcher_id}`)}
                  className="table-row-hover"
                  style={{ borderBottom: '1px solid #1e1e2e', cursor: 'pointer' }}>
                  <td style={{ padding: '6px 10px', color: '#606080', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ padding: '6px 10px', color: '#e0e0e8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {p.pitcher_name}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>{p.pitcher_team}</td>
                  <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>{p.pitcher_hand}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <GradeBadge score={p.pitch_plus} size="sm" />
                  </td>
                  {SORTABLE_DIMS.map(d => {
                    const s = dimScore(p, d);
                    const bg = s >= 115 ? 'rgba(212,64,64,0.15)'
                             : s >= 105 ? 'rgba(200,90,90,0.1)'
                             : s >= 85  ? 'transparent'
                             : s >= 70  ? 'rgba(74,100,148,0.1)'
                             : 'rgba(58,80,128,0.2)';
                    return (
                      <td key={d} style={{ padding: '6px 8px', textAlign: 'center', background: bg, fontSize: 12 }}>
                        <span style={{ color: gradeColor(s) }}>{s}</span>
                      </td>
                    );
                  })}
                  {shownMetric && (() => {
                    const raw = metricRaw(p, shownMetric);
                    const g   = metricGrade(p, shownMetric);
                    return (
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: gradeColor(g) }}>
                        {raw !== null ? displayRaw(shownMetric, raw) : '—'}
                      </td>
                    );
                  })()}
                  <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'right' }}>
                    {p.n_pitches.toLocaleString()}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>
                    {p.n_games}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer metadata ── */}
      <div style={{ color: '#606080', fontSize: 12, paddingBottom: 24 }}>
        Model {data.pitchers.metadata.model_version} · Generated {data.pitchers.metadata.generated} ·{' '}
        Click any row to open pitcher profile
      </div>
    </div>
  );
}
