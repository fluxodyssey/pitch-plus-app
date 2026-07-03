/**
 * Advanced Search — Baseball Savant-style slice/filter over all pitcher metrics.
 * Supports: season, team, hand, game type, pitch type, min pitches,
 *           metric range filters, and full-text search.
 */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { rowNavProps } from '../data/rowNavigation';
import { useData } from '../data/useData';
import { GradeBadge } from '../components/GradeBadge';
import { gradeColor, PCT_METRICS, METRIC_LABELS, DIMENSION_LABELS } from '../data/constants';
import { exportCsv } from '../data/exportCsv';
import { getSavedFilters, saveFilter, deleteSavedFilter } from '../data/savedFilters';
import type { Pitcher, MetricKey, DimensionKey } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RangeFilter { min: string; max: string }
type SortField = 'pitch_plus' | MetricKey | DimensionKey;

// ── Trait Presets ─────────────────────────────────────────────────────────────

interface TraitPreset {
  label: string;
  color: string;
  description: string;
  dimFilters: Partial<Record<DimensionKey, { min?: number; max?: number }>>;
  metricFilters: Partial<Record<MetricKey, RangeFilter>>;
}

const TRAIT_PRESETS: TraitPreset[] = [
  {
    label: 'Power Arm',
    color: '#f87171',
    description: 'Elite Stuff, high K%',
    dimFilters: { stuff: { min: 110 } },
    metricFilters: { k_rate: { min: '0.25', max: '' } },
  },
  {
    label: 'Command Artist',
    color: 'var(--accent)',
    description: 'Elite Command, low BB%',
    dimFilters: { command: { min: 110 } },
    metricFilters: { bb_rate: { min: '', max: '0.07' } },
  },
  {
    label: 'Deception Master',
    color: '#a78bfa',
    description: 'Elite Deception, high Whiff%',
    dimFilters: { deception: { min: 110 } },
    metricFilters: { in_zone_whiff_rate: { min: '0.28', max: '' } },
  },
  {
    label: 'Ground Ball Specialist',
    color: '#34d399',
    description: 'Strong Outcomes, high GB%',
    dimFilters: { outcomes: { min: 105 } },
    metricFilters: { gb_rate: { min: '0.45', max: '' } },
  },
  {
    label: 'FIP-Beater',
    color: '#fbbf24',
    description: 'Strong Command, suppresses wRC+',
    dimFilters: { command: { min: 108 } },
    metricFilters: { wrc_plus_against: { min: '', max: '90' } },
  },
  {
    label: 'Stuff Only',
    color: '#f97316',
    description: 'High Stuff but average Outcomes (stuff not translating)',
    dimFilters: { stuff: { min: 110 }, outcomes: { max: 100 } },
    metricFilters: {},
  },
  {
    label: 'Deep Arsenal',
    color: '#06b6d4',
    description: 'Elite Arsenal, many pitch types',
    dimFilters: { arsenal: { min: 110 } },
    metricFilters: { n_pitch_types: { min: '4', max: '' } },
  },
  {
    label: 'Elite All-Around',
    color: 'var(--text-1)',
    description: 'All 6 dimensions above 105',
    dimFilters: {
      stuff: { min: 105 }, command: { min: 105 }, deception: { min: 105 },
      outcomes: { min: 105 }, arsenal: { min: 105 },
    },
    metricFilters: {},
  },
];

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
  background: 'var(--bg-elevated)', border: '1px solid var(--border-plus)',
  color: 'var(--text-1)', borderRadius: 6, padding: '7px 10px', fontSize: 13,
};

const INPUT_STYLE = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-plus)',
  color: 'var(--text-1)', borderRadius: 6, padding: '7px 10px', fontSize: 13,
};

// ── Component ─────────────────────────────────────────────────────────────────

const stickyTh = {
  background: 'var(--bg-surface)', borderBottom: '2px solid var(--border)',
  position: 'sticky' as const, top: 0, zIndex: 2,
  padding: '8px 10px', whiteSpace: 'nowrap' as const, userSelect: 'none' as const,
};

// Module scope so React preserves <th> identity across renders (react-hooks/static-components).
function SortTh({ field, label, title, sortField, sortAsc, onSort }: {
  field: SortField; label: string; title?: string;
  sortField: SortField; sortAsc: boolean; onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th onClick={() => onSort(field)} title={title} style={{
      ...stickyTh, cursor: 'pointer',
      color: active ? 'var(--accent)' : 'var(--text-2)',
      fontWeight: active ? 700 : 500,
    }}>
      {label}{active ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

export function AdvancedSearch() {
  const { data, loading, error, season } = useData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filter state from URL params
  const [search,         setSearch]        = useState(() => searchParams.get('q') ?? '');
  const [teamFilter,     setTeamFilter]     = useState(() => searchParams.get('team') ?? 'All');
  const [handFilter,     setHandFilter]     = useState(() => searchParams.get('hand') ?? 'All');
  const [pitchTypeFilter,setPitchTypeFilter]= useState(() => searchParams.get('pt') ?? 'All');
  const [minPitches,     setMinPitches]     = useState(() => parseInt(searchParams.get('min') ?? '0', 10) || 0);
  const [sortField,      setSortField]      = useState<SortField>(() => (searchParams.get('sort') as SortField) ?? 'pitch_plus');
  const [sortAsc,        setSortAsc]        = useState(() => searchParams.get('asc') === '1');

  const [shownMetric,    setShownMetric]    = useState<MetricKey | null>(null);

  // Metric range filters — restore from URL params (rf_<key>_min / rf_<key>_max)
  const [rangeFilters, setRangeFilters] = useState<Partial<Record<MetricKey, RangeFilter>>>(() => {
    const rf: Partial<Record<MetricKey, RangeFilter>> = {};
    for (const [k, v] of searchParams.entries()) {
      const minMatch = k.match(/^rf_(.+)_min$/);
      const maxMatch = k.match(/^rf_(.+)_max$/);
      if (minMatch) {
        const mk = minMatch[1] as MetricKey;
        rf[mk] = { ...(rf[mk] ?? { min: '', max: '' }), min: v };
      } else if (maxMatch) {
        const mk = maxMatch[1] as MetricKey;
        rf[mk] = { ...(rf[mk] ?? { min: '', max: '' }), max: v };
      }
    }
    return rf;
  });
  // Dimension score range filters (for trait presets)
  const [dimFilters, setDimFilters] = useState<Partial<Record<DimensionKey, { min?: number; max?: number }>>>({});
  const [activePreset, setActivePreset] = useState<string | null>(() => searchParams.get('preset') ?? null);
  const [savedFilters, setSavedFilters] = useState(() => getSavedFilters('search'));

  // Sync filter state → URL (replace, no history bloat)
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (teamFilter !== 'All') params.set('team', teamFilter);
    if (handFilter !== 'All') params.set('hand', handFilter);
    if (pitchTypeFilter !== 'All') params.set('pt', pitchTypeFilter);
    if (minPitches > 0) params.set('min', String(minPitches));
    if (sortField !== 'pitch_plus') params.set('sort', sortField);
    if (sortAsc) params.set('asc', '1');
    if (activePreset) params.set('preset', activePreset);
    for (const [mk, rf] of Object.entries(rangeFilters)) {
      if (rf?.min) params.set(`rf_${mk}_min`, rf.min);
      if (rf?.max) params.set(`rf_${mk}_max`, rf.max);
    }
    setSearchParams(params, { replace: true });
  }, [search, teamFilter, handFilter, pitchTypeFilter, minPitches, sortField, sortAsc, activePreset, rangeFilters, setSearchParams]);

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

  // Filtering separated from sorting so sort changes don't re-run the full filter pass
  const filteredUnsorted = useMemo(() => {
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

    for (const [dk, range] of Object.entries(dimFilters)) {
      const dimKey = dk as DimensionKey;
      if (range?.min != null) ps = ps.filter(p => dimScore(p, dimKey) >= range.min!);
      if (range?.max != null) ps = ps.filter(p => dimScore(p, dimKey) <= range.max!);
    }

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

    return ps;
  }, [data, search, teamFilter, handFilter, minPitches, pitchTypeFilter, rangeFilters, dimFilters]);

  const filtered = useMemo(() => {
    return [...filteredUnsorted].sort((a, b) => {
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
  }, [filteredUnsorted, sortField, sortAsc]);

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

  const sortCtx = { sortField, sortAsc, onSort: handleSortField };

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

      {/* ── Trait Presets ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 8, fontWeight: 600, letterSpacing: 1 }}>
          PITCHER ARCHETYPES
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TRAIT_PRESETS.map(preset => {
            const isActive = activePreset === preset.label;
            return (
              <button
                key={preset.label}
                title={preset.description}
                onClick={() => {
                  if (isActive) {
                    setActivePreset(null);
                    setDimFilters({});
                    setRangeFilters({});
                  } else {
                    setActivePreset(preset.label);
                    setDimFilters(preset.dimFilters);
                    setRangeFilters(preset.metricFilters);
                    setSearch('');
                    setTeamFilter('All');
                    setHandFilter('All');
                    setPitchTypeFilter('All');
                    setMinPitches(0);
                  }
                }}
                style={{
                  padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                  border: `1px solid ${isActive ? preset.color : 'var(--border)'}`,
                  background: isActive ? `${preset.color}22` : 'transparent',
                  color: isActive ? preset.color : 'var(--text-3)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {preset.label}
              </button>
            );
          })}
          {activePreset && (
            <button
              onClick={() => { setActivePreset(null); setDimFilters({}); setRangeFilters({}); }}
              style={{
                padding: '5px 12px', fontSize: 11, borderRadius: 20,
                border: '1px solid var(--text-4)', background: 'transparent',
                color: 'var(--text-3)', cursor: 'pointer',
              }}
            >
              Clear ×
            </button>
          )}
        </div>
        {activePreset && (
          <div style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 6 }}>
            {TRAIT_PRESETS.find(p => p.label === activePreset)?.description}
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 4 }}>SEARCH</div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Pitcher name…" style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 4 }}>TEAM</div>
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
            style={{ ...SEL_STYLE, width: '100%' }}>
            {teams.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 4 }}>THROWS</div>
          <select value={handFilter} onChange={e => setHandFilter(e.target.value)}
            style={{ ...SEL_STYLE, width: '100%' }}>
            <option value="All">All</option>
            <option value="R">RHP</option>
            <option value="L">LHP</option>
          </select>
        </div>
        <div>
          <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 4 }}>PITCH TYPE</div>
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
          <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 4 }}>MIN PITCHES</div>
          <input type="number" value={minPitches} min={0} step={10}
            onChange={e => setMinPitches(Number(e.target.value))}
            style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <div style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 4 }}>SORT BY</div>
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
      <details style={{ color: 'var(--text-2)', fontSize: 13 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>
          + Metric Range Filters
        </summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, paddingTop: 8 }}>
          {SORTABLE_METRICS.map(mk => (
            <div key={mk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 120, fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {METRIC_LABELS[mk]}{PCT_METRICS.has(mk) ? ' (%)' : ''}
              </span>
              <input placeholder="min" type="number" step="any"
                value={rangeFilters[mk]?.min ?? ''} onChange={e => setRange(mk, 'min', e.target.value)}
                style={{ ...INPUT_STYLE, width: 60, padding: '4px 6px', fontSize: 12 }} />
              <span style={{ color: 'var(--text-3)' }}>–</span>
              <input placeholder="max" type="number" step="any"
                value={rangeFilters[mk]?.max ?? ''} onChange={e => setRange(mk, 'max', e.target.value)}
                style={{ ...INPUT_STYLE, width: 60, padding: '4px 6px', fontSize: 12 }} />
            </div>
          ))}
        </div>
      </details>

      {/* ── Column toggles ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-2)', fontSize: 12 }}>Show metric:</span>
        {SORTABLE_METRICS.slice(0, 12).map(mk => (
          <button key={mk} onClick={() => setShownMetric(prev => prev === mk ? null : mk)}
            style={{
              padding: '3px 10px', fontSize: 11, border: '1px solid',
              borderColor: shownMetric === mk ? 'var(--accent)' : 'var(--border-plus)',
              background: shownMetric === mk ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: shownMetric === mk ? 'var(--accent)' : 'var(--text-3)',
              borderRadius: 4, cursor: 'pointer',
            }}>
            {METRIC_LABELS[mk]}
          </button>
        ))}
      </div>

      {/* ── Results count + actions ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
          {filtered.length.toLocaleString()} results
        </span>
        {Object.values(rangeFilters).some(r => r?.min || r?.max) && (
          <button onClick={() => setRangeFilters({})}
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            Clear range filters ×
          </button>
        )}
        <button
          onClick={() => {
            const dimKeys = SORTABLE_DIMS;
            const headers = ['Name', 'Team', 'H', 'Pitch+', ...dimKeys.map(d => DIMENSION_LABELS[d]), 'Pitches', 'Games'];
            const rows = filtered.map(p => [
              p.pitcher_name, p.pitcher_team, p.pitcher_hand, p.pitch_plus,
              ...dimKeys.map(d => p.dimensions[d]?.score ?? 0),
              p.n_pitches, p.n_games,
            ]);
            exportCsv(headers, rows, `pitch-plus-search-${season}.csv`);
          }}
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 5,
            border: '1px solid var(--border-plus)', background: 'transparent',
            color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          ↓ Export CSV
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(window.location.href)}
          title="Copy shareable link with current filters"
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 5,
            border: '1px solid var(--border-plus)', background: 'transparent',
            color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          ⎘ Copy link
        </button>
        <button
          onClick={() => {
            const name = window.prompt('Name this filter set:');
            if (!name?.trim()) return;
            saveFilter(name.trim(), 'search', window.location.search);
            setSavedFilters(getSavedFilters('search'));
          }}
          style={{
            padding: '4px 10px', fontSize: 11, borderRadius: 5,
            border: '1px solid var(--border-plus)', background: 'transparent',
            color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          ☆ Save filters
        </button>
        {savedFilters.length > 0 && (
          <details style={{ display: 'inline' }}>
            <summary style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', listStyle: 'none' }}>
              ★ Saved ({savedFilters.length})
            </summary>
            <div style={{
              position: 'absolute', background: 'var(--bg-surface)', border: '1px solid var(--border-plus)',
              borderRadius: 8, padding: 8, zIndex: 50, minWidth: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {savedFilters.map(sf => (
                <div key={sf.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                  <button
                    onClick={() => { window.location.search = sf.url; }}
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-1)', fontSize: 12, cursor: 'pointer' }}
                  >
                    {sf.name}
                  </button>
                  <button
                    onClick={() => { deleteSavedFilter(sf.id); setSavedFilters(getSavedFilters('search')); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
                  >×</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...stickyTh, color: 'var(--text-3)' }}>#</th>
                <th style={{ ...stickyTh, textAlign: 'left', color: 'var(--text-2)' }}>Pitcher</th>
                <th style={{ ...stickyTh, color: 'var(--text-2)' }}>Team</th>
                <th style={{ ...stickyTh, color: 'var(--text-2)' }}>H</th>
                <SortTh field="pitch_plus" label="Pitch+" {...sortCtx} />
                {SORTABLE_DIMS.map(d => (
                  <SortTh key={d} field={d} label={DIMENSION_LABELS[d].slice(0, 4)} title={DIMENSION_LABELS[d]} {...sortCtx} />
                ))}
                {shownMetric && (
                  <SortTh field={shownMetric} label={METRIC_LABELS[shownMetric]} {...sortCtx} />
                )}
                <th style={{ ...stickyTh, color: 'var(--text-2)' }}>Pitches</th>
                <th style={{ ...stickyTh, color: 'var(--text-2)' }}>G</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.pitcher_id}
                  {...rowNavProps(navigate, `/player/${p.pitcher_id}`)}
                  className="table-row-hover"
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={{ padding: '6px 10px', color: 'var(--text-3)', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-1)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {p.pitcher_name}
                  </td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-2)', textAlign: 'center' }}>{p.pitcher_team}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-2)', textAlign: 'center' }}>{p.pitcher_hand}</td>
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
                  <td style={{ padding: '6px 10px', color: 'var(--text-2)', textAlign: 'right' }}>
                    {p.n_pitches.toLocaleString()}
                  </td>
                  <td style={{ padding: '6px 10px', color: 'var(--text-2)', textAlign: 'center' }}>
                    {p.n_games}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer metadata ── */}
      <div style={{ color: 'var(--text-3)', fontSize: 12, paddingBottom: 24 }}>
        Model {data.pitchers.metadata.model_version} · Generated {data.pitchers.metadata.generated} ·{' '}
        Click any row to open pitcher profile
      </div>
    </div>
  );
}
