import { useState, useEffect, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { GradeBadge } from '../components/GradeBadge';
import { scoreColor } from '../data/constants';
import { useData } from '../data/useData';
import { useBatterOutcomes } from '../data/useMatchupData';
import { isJsonResponse } from '../data/fetchJson';
import type { Batter, BatterBDQData, BatterOutcomesData, Hitter, EnrichedHitter, SwingPlusMetrics } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'swing' | 'bdq' | 'combined' | 'scatter';
type SwingMetricKey = keyof SwingPlusMetrics;

// ─── Data Loading ─────────────────────────────────────────────────────────────

function useBatterData(season: number) {
  // Async results are tagged with their season so a late completion for a
  // previous season is never shown (no synchronous setState in the effect).
  const [bdqState, setBdqState] = useState<{ season: number; data: BatterBDQData | null; error: string | null } | null>(null);
  const [hittersState, setHittersState] = useState<{ season: number; data: Hitter[] | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const expectedSource = `mlb_${season}`;

    // Year-specific files only. No silent fallback to flat files — a missing or
    // wrong-season file must fail loud (the flat files silently served 2025 data
    // under any year label, which is the bug this page used to have).

    // ── BDQ ──
    fetch(`/data/batter_bdq_${season}.json`)
      .then(r => {
        if (!isJsonResponse(r)) throw new Error(`No BDQ data for ${season} (HTTP ${r.status})`);
        return r.json();
      })
      .then((data: BatterBDQData) => {
        if (data?.metadata?.source !== expectedSource) {
          throw new Error(`BDQ source mismatch for ${season}: file reports ${data?.metadata?.source}`);
        }
        if (!cancelled) setBdqState({ season, data, error: null });
      })
      .catch((e) => { console.error(e); if (!cancelled) setBdqState({ season, data: null, error: String(e) }); });

    // ── Swing+ hitters (wrapped { hitters, metadata }) ──
    fetch(`/data/hitters_${season}.json`)
      .then(r => {
        if (!isJsonResponse(r)) throw new Error(`No Swing+ data for ${season} (HTTP ${r.status})`);
        return r.json();
      })
      .then((data) => {
        const src = Array.isArray(data) ? null : data?.metadata?.source;
        if (src !== expectedSource) {
          throw new Error(`Swing+ source mismatch for ${season}: file reports ${src}`);
        }
        if (!cancelled) setHittersState({ season, data: data.hitters ?? [], error: null });
      })
      .catch((e) => { console.error(e); if (!cancelled) setHittersState({ season, data: null, error: String(e) }); });

    return () => { cancelled = true; };
  }, [season]);

  const bdq = bdqState?.season === season ? bdqState.data : null;
  const bdqError = bdqState?.season === season ? bdqState.error : null;
  const rawHitters = hittersState?.season === season ? hittersState.data : null;
  const hittersError = hittersState?.season === season ? hittersState.error : null;

  const enriched = useMemo<EnrichedHitter[] | null>(() => {
    if (!bdq || !rawHitters) return null;
    const bdqMap = new Map(bdq.batters.map(b => [b.batter_id, b]));
    return rawHitters.map(h => {
      const b = bdqMap.get(h.id);
      return { ...h, team: b?.batter_team ?? '—', hand: b?.batter_hand ?? '—' };
    });
  }, [bdq, rawHitters]);

  const error = bdqError ?? hittersError ?? null;
  // loading = still waiting; error = failed; otherwise ready
  const loading = !error && (!bdq || !rawHitters);
  return { bdq, enriched, loading, error };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SWING_DIMS = [
  'Power Ceiling', 'Batted Ball Quality', 'Barrel Accuracy',
  'Swing Efficiency', 'Swing Decisions', 'Contact Quality', 'Pitch Handling',
] as const;

const DIM_ABBR: Record<typeof SWING_DIMS[number], string> = {
  'Power Ceiling': 'Pwr',
  'Batted Ball Quality': 'BBQ',
  'Barrel Accuracy': 'Brl',
  'Swing Efficiency': 'Eff',
  'Swing Decisions': 'Dec',
  'Contact Quality': 'Ctc',
  'Pitch Handling': 'Ptc',
};

interface MetricDef { label: string; fmt: (v: number) => string; lowerBetter?: boolean }

const METRIC_CONFIG: Record<SwingMetricKey, MetricDef> = {
  ev90:                  { label: 'EV90',         fmt: v => v.toFixed(1) },
  ev50:                  { label: 'EV50',         fmt: v => v.toFixed(1) },
  avg_launch_speed:      { label: 'Avg EV',       fmt: v => v.toFixed(1) },
  max_launch_speed:      { label: 'Max EV',       fmt: v => v.toFixed(1) },
  ev_std:                { label: 'EV σ',         fmt: v => v.toFixed(2), lowerBetter: true },
  hard_hit_rate:         { label: 'Hard Hit%',    fmt: v => `${(v*100).toFixed(1)}%` },
  barrel_rate:           { label: 'Barrel%',      fmt: v => `${(v*100).toFixed(1)}%` },
  sweet_spot_rate:       { label: 'Sweet Spot%',  fmt: v => `${(v*100).toFixed(1)}%` },
  avg_launch_angle:      { label: 'Avg LA',       fmt: v => `${v.toFixed(1)}°` },
  gb_rate:               { label: 'GB%',          fmt: v => `${(v*100).toFixed(1)}%`, lowerBetter: true },
  avg_bat_speed:         { label: 'Bat Speed',    fmt: v => v.toFixed(1) },
  swing_length:          { label: 'Swing Len',    fmt: v => v.toFixed(2), lowerBetter: true },
  squared_up_per_swing:  { label: 'Sq-Up%',       fmt: v => `${(v*100).toFixed(1)}%` },
  blast_per_swing:       { label: 'Blast%',       fmt: v => `${(v*100).toFixed(1)}%` },
  speed_per_length:      { label: 'Spd/Len',      fmt: v => v.toFixed(2) },
  attack_angle:          { label: 'Atk Ang',      fmt: v => `${v.toFixed(1)}°` },
  ideal_attack_angle_rate: { label: 'Ideal LA%',  fmt: v => `${(v*100).toFixed(1)}%` },
  whiff_rate:            { label: 'Whiff%',       fmt: v => `${(v*100).toFixed(1)}%`, lowerBetter: true },
  chase_rate:            { label: 'Chase%',       fmt: v => `${(v*100).toFixed(1)}%`, lowerBetter: true },
  zone_contact_rate:     { label: 'Zone Ct%',     fmt: v => `${(v*100).toFixed(1)}%` },
  in_zone_swing_rate:    { label: 'Z-Swing%',     fmt: v => `${(v*100).toFixed(1)}%` },
  competitive_swing_rate:{ label: 'Comp Sw%',     fmt: v => `${(v*100).toFixed(1)}%` },
  fastball_ev:           { label: 'FB EV',        fmt: v => v.toFixed(1) },
  offspeed_ev:           { label: 'OS EV',        fmt: v => v.toFixed(1) },
  breaking_ev:           { label: 'Brk EV',       fmt: v => v.toFixed(1) },
  breaking_contact_rate: { label: 'Brk Ct%',      fmt: v => `${(v*100).toFixed(1)}%` },
  velo_adjustment:       { label: 'Velo Adj',     fmt: v => v.toFixed(3) },
  k_rate:                { label: 'K%',           fmt: v => `${(v*100).toFixed(1)}%`, lowerBetter: true },
  bb_rate:               { label: 'BB%',          fmt: v => `${(v*100).toFixed(1)}%` },
  xwoba:                 { label: 'xwOBA',        fmt: v => v.toFixed(3) },
  xslg:                  { label: 'xSLG',         fmt: v => v.toFixed(3) },
  bat_speed_efficiency:  { label: 'BS Eff',       fmt: v => v.toFixed(3) },
};

const METRIC_GROUPS: { label: string; keys: SwingMetricKey[] }[] = [
  { label: 'Exit Velocity', keys: ['ev90', 'ev50', 'avg_launch_speed', 'max_launch_speed', 'ev_std', 'hard_hit_rate', 'barrel_rate', 'sweet_spot_rate'] },
  { label: 'Bat Tracking',  keys: ['avg_bat_speed', 'swing_length', 'squared_up_per_swing', 'blast_per_swing', 'speed_per_length', 'bat_speed_efficiency'] },
  { label: 'Trajectory',    keys: ['avg_launch_angle', 'gb_rate', 'attack_angle', 'ideal_attack_angle_rate'] },
  { label: 'Discipline',    keys: ['whiff_rate', 'chase_rate', 'zone_contact_rate', 'in_zone_swing_rate', 'competitive_swing_rate', 'k_rate', 'bb_rate'] },
  { label: 'Pitch Splits',  keys: ['fastball_ev', 'offspeed_ev', 'breaking_ev', 'breaking_contact_rate', 'velo_adjustment'] },
  { label: 'Outcomes',      keys: ['xwoba', 'xslg'] },
];

const TIER_COLORS: Record<string, string> = {
  ELITE: '#d44040',
  ABOVE_AVG: '#c85a5a',
  AVERAGE: '#a87070',
  BELOW_AVG: '#6878a0',
  POOR: '#4a6494',
};

function tierColor(t: string) { return TIER_COLORS[t] ?? 'var(--text-1)'; }

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }

// Primary discipline grade: swing-decision run value per 100 OOZ pitches
// (higher = better). League average ≈ +2.5; elite takers clear +3.5.
function rvGrade(rv: number | undefined): { label: string; color: string } {
  const v = rv ?? 0;
  if (v >= 3.5) return { label: 'Elite', color: '#2ec27e' };
  if (v >= 3.0) return { label: 'Above Avg', color: '#5fb87a' };
  if (v >= 2.3) return { label: 'Average', color: 'var(--text-2)' };
  if (v >= 1.7) return { label: 'Below Avg', color: '#c89060' };
  if (v >= 1.0) return { label: 'Poor', color: '#c85a5a' };
  return { label: 'Very Poor', color: '#a04040' };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const filterInputStyle = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-plus)',
  color: 'var(--text-1)', borderRadius: 6, padding: '8px 12px', fontSize: 14,
};

const stickyHeaderStyle = {
  borderBottom: '2px solid var(--border)', background: 'var(--bg-surface)',
  position: 'sticky' as const, top: 0, zIndex: 1,
};

// Shared sortable-header cells (module scope so React preserves the th subtree).
// Each tab spreads its own { sortKey, sortDir, onSort } context into these.

function SortTh<K extends string>({ k, label, title, pad, sortKey, sortDir, onSort }: {
  k: K; label: string; title?: string; pad: string;
  sortKey: string; sortDir: 'asc' | 'desc'; onSort: (k: K) => void;
}) {
  const active = sortKey === k;
  return (
    <th onClick={() => onSort(k)} title={title} style={{
      cursor: 'pointer', padding: pad, userSelect: 'none',
      whiteSpace: 'nowrap', color: active ? '#4a9eff' : 'var(--text-2)',
      fontWeight: active ? 700 : 500, ...stickyHeaderStyle,
    }}>
      {label}{active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
    </th>
  );
}

function SortHdr<K extends string>({ k, label, sortKey, sortDir, onSort }: {
  k: K; label: string; sortKey: string; sortDir: 'asc' | 'desc'; onSort: (k: K) => void;
}) {
  const active = sortKey === k;
  return (
    <th onClick={() => onSort(k)} style={{ cursor: 'pointer', padding: '10px 14px', userSelect: 'none', color: active ? '#4a9eff' : 'var(--text-2)', ...stickyHeaderStyle }}>
      {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );
}

// ─── Swing+ Leaderboard Tab ───────────────────────────────────────────────────

function SwingPlusTab({ hitters }: { hitters: EnrichedHitter[] }) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [handFilter, setHandFilter] = useState<'all' | 'L' | 'R'>('all');
  const [minPA, setMinPA] = useState(100);
  const [tierFilter, setTierFilter] = useState('all');
  const [sortKey, setSortKey] = useState('swing_plus');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [metricGroup, setMetricGroup] = useState<string | null>(null);

  const teams = useMemo(() =>
    ['all', ...Array.from(new Set(hitters.map(h => h.team).filter(t => t !== '—'))).sort()],
    [hitters]
  );

  const filtered = useMemo(() => {
    function getSortValue(h: EnrichedHitter): number {
      if (sortKey === 'swing_plus') return h.swing_plus;
      if (sortKey === 'batting_plus') return h.batting_plus ?? h.swing_plus;
      if (sortKey === 'decision_plus') return h.decision_plus ?? 100;
      if (sortKey === 'n_pa') return h.n_pa;
      if (sortKey.startsWith('dim_')) return h.dimensions[sortKey.slice(4) as typeof SWING_DIMS[number]] ?? 0;
      if (sortKey.startsWith('metric_')) return h.metrics[sortKey.slice(7) as SwingMetricKey] ?? 0;
      return 0;
    }
    return hitters
      .filter(h => h.n_pa >= minPA)
      .filter(h => !search || h.name.toLowerCase().includes(search.toLowerCase()))
      .filter(h => teamFilter === 'all' || h.team === teamFilter)
      .filter(h => handFilter === 'all' || h.hand === handFilter)
      .filter(h => tierFilter === 'all' || h.tier === tierFilter)
      .sort((a, b) => {
        const d = getSortValue(b) - getSortValue(a);
        return sortDir === 'desc' ? d : -d;
      });
  }, [hitters, search, teamFilter, handFilter, minPA, tierFilter, sortKey, sortDir]);

  function handleSort(key: string) {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const sortCtx = { sortKey, sortDir, onSort: handleSort, pad: '8px 10px' };

  const activeGroup = metricGroup ? METRIC_GROUPS.find(g => g.label === metricGroup) : null;

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search batter…" style={{ ...filterInputStyle, width: 200 }} />
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={filterInputStyle}>
          {teams.map(t => <option key={t} value={t}>{t === 'all' ? 'All Teams' : t}</option>)}
        </select>
        <select value={handFilter} onChange={e => setHandFilter(e.target.value as typeof handFilter)} style={filterInputStyle}>
          <option value="all">Both Hands</option>
          <option value="R">RHB</option>
          <option value="L">LHB</option>
        </select>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={filterInputStyle}>
          <option value="all">All Tiers</option>
          {Object.keys(TIER_COLORS).map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Min PA:</span>
          <input type="number" value={minPA} onChange={e => setMinPA(Number(e.target.value))}
            min={0} max={800} step={25} style={{ ...filterInputStyle, width: 70 }} />
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{filtered.length} batters</span>
      </div>

      {/* Metric group selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-2)', fontSize: 12, marginRight: 4 }}>Show metrics:</span>
        {[null, ...METRIC_GROUPS.map(g => g.label)].map(g => (
          <button key={g ?? 'dims'} onClick={() => setMetricGroup(g)}
            style={{
              padding: '4px 12px', fontSize: 12, border: '1px solid',
              borderColor: metricGroup === g ? '#4a9eff' : 'var(--border-plus)',
              background: metricGroup === g ? 'rgba(74,158,255,0.15)' : 'transparent',
              color: metricGroup === g ? '#4a9eff' : 'var(--text-2)',
              borderRadius: 4, cursor: 'pointer',
            }}>
            {g ?? 'Dimensions'}
          </button>
        ))}
      </div>

      {/* Sort bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Sort by:</span>
        <select value={sortKey} onChange={e => { setSortKey(e.target.value); setSortDir('desc'); }}
          style={{ ...filterInputStyle, minWidth: 180 }}>
          <optgroup label="Overall">
            <option value="batting_plus">Batting+ (Swing×85% + Decision×15%)</option>
            <option value="swing_plus">Swing+</option>
            <option value="decision_plus">Decision+</option>
            <option value="n_pa">PA</option>
          </optgroup>
          <optgroup label="Dimensions">
            {SWING_DIMS.map(d => <option key={d} value={`dim_${d}`}>{d}</option>)}
          </optgroup>
          {METRIC_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.keys.map(k => <option key={k} value={`metric_${k}`}>{METRIC_CONFIG[k].label}</option>)}
            </optgroup>
          ))}
        </select>
        <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          style={{ ...filterInputStyle, cursor: 'pointer', padding: '8px 12px' }}>
          {sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px', color: 'var(--text-2)', textAlign: 'center', ...stickyHeaderStyle }}>#</th>
              <SortTh {...sortCtx} k="name" label="Batter" />
              <SortTh {...sortCtx} k="team" label="Team" />
              <th style={{ padding: '8px 6px', color: 'var(--text-2)', textAlign: 'center', ...stickyHeaderStyle }}>H</th>
              <SortTh {...sortCtx} k="swing_plus" label="Swing+" />
              <th style={{ padding: '8px 8px', color: 'var(--text-2)', textAlign: 'center', ...stickyHeaderStyle }}>Tier</th>
              <SortTh {...sortCtx} k="batting_plus" label="Bat+" title="Batting+ = 0.85×Swing+ + 0.15×Decision+ (RV-calibrated blend)" />
              <SortTh {...sortCtx} k="decision_plus" label="Dec+" title="Decision+ (Thomas zone-weighted discipline)" />
              <SortTh {...sortCtx} k="n_pa" label="PA" />
              {activeGroup
                ? activeGroup.keys.map(k => <SortTh {...sortCtx} key={k} k={`metric_${k}`} label={METRIC_CONFIG[k].label} />)
                : SWING_DIMS.map(d => <SortTh {...sortCtx} key={d} k={`dim_${d}`} label={DIM_ABBR[d]} title={d} />)
              }
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, i) => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--bg-elevated)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                <td style={{ padding: '7px 10px', color: 'var(--text-3)', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h.name}</td>
                <td style={{ padding: '7px 10px', color: 'var(--text-2)', textAlign: 'center' }}>{h.team}</td>
                <td style={{ padding: '7px 6px', color: 'var(--text-2)', textAlign: 'center' }}>{h.hand}</td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                  <GradeBadge score={Math.round(h.swing_plus)} size="sm" />
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                  <span style={{ background: tierColor(h.tier) + '22', color: tierColor(h.tier), borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
                    {h.tier.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                  {h.batting_plus != null
                    ? <GradeBadge score={Math.round(h.batting_plus)} size="sm" />
                    : <span style={{ color: 'var(--text-3)' }}>—</span>}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12,
                  color: h.decision_plus != null && h.decision_plus >= 115 ? '#d44040'
                       : h.decision_plus != null && h.decision_plus >= 105 ? '#c85a5a'
                       : h.decision_plus != null && h.decision_plus <= 85  ? '#4a6494' : 'var(--text-1)' }}>
                  {h.decision_plus != null ? Math.round(h.decision_plus) : '—'}
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-2)', textAlign: 'center' }}>{h.n_pa}</td>
                {activeGroup
                  ? activeGroup.keys.map(k => {
                      const v = h.metrics[k];
                      return <td key={k} style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--text-1)', fontFamily: 'monospace' }}>{v != null ? METRIC_CONFIG[k].fmt(v) : '—'}</td>;
                    })
                  : SWING_DIMS.map(d => {
                      const score = h.dimensions[d] ?? 0;
                      return (
                        <td key={d} style={{ padding: '7px 8px', textAlign: 'center', background: scoreColor(score), color: score >= 105 ? 'var(--bg-base)' : 'var(--text-1)', fontWeight: score >= 115 ? 700 : 400, fontSize: 12 }}>
                          {Math.round(score)}
                        </td>
                      );
                    })
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Key */}
      {!activeGroup && (
        <div style={{ marginTop: 10, display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--text-3)', fontSize: 12 }}>
          {SWING_DIMS.map(d => <span key={d}><strong style={{ color: 'var(--text-2)' }}>{DIM_ABBR[d]}</strong> = {d}</span>)}
        </div>
      )}
    </div>
  );
}

// ─── BDQ Tab ──────────────────────────────────────────────────────────────────

function BDQTab({ bdq }: { bdq: BatterBDQData }) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [handFilter, setHandFilter] = useState<'all' | 'L' | 'R'>('all');
  const [sortKey, setSortKey] = useState<'ooz_decision_rv' | 'bad_chase_rate' | 'deceptive_chase_rate' | 'n_chases'>('ooz_decision_rv');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [minChases, setMinChases] = useState(50);

  const teams = useMemo(() =>
    ['all', ...Array.from(new Set(bdq.batters.map(b => b.batter_team))).sort()],
    [bdq]
  );

  const filtered = useMemo(() =>
    bdq.batters
      .filter(b => b.n_chases >= minChases)
      .filter(b => !search || b.batter_name.toLowerCase().includes(search.toLowerCase()))
      .filter(b => teamFilter === 'all' || b.batter_team === teamFilter)
      .filter(b => handFilter === 'all' || b.batter_hand === handFilter)
      .sort((a, b) => {
        const d = ((a[sortKey] as number | undefined) ?? 0) - ((b[sortKey] as number | undefined) ?? 0);
        return sortDir === 'asc' ? d : -d;
      }),
    [bdq, search, teamFilter, handFilter, sortKey, sortDir, minChases]
  );

  function handleSort(k: typeof sortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    // bad_chase_rate is "lower = better"; all others are "higher = better".
    else { setSortKey(k); setSortDir(k === 'bad_chase_rate' ? 'asc' : 'desc'); }
  }

  const sortCtx = { sortKey, sortDir, onSort: handleSort };

  return (
    <div>
      <div style={{ background: 'rgba(74,158,255,0.06)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 8, padding: '12px 18px', marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div>
          <div style={{ color: '#4a9eff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Commit Point</div>
          <div style={{ color: 'var(--text-1)', fontSize: 18, fontWeight: 700, marginTop: 4 }}>167ms before plate</div>
          <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Tom Tango's batter decision threshold</div>
        </div>
        <div>
          <div style={{ color: '#4a9eff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Validation</div>
          <div style={{ color: 'var(--text-1)', fontSize: 18, fontWeight: 700, marginTop: 4 }}>+28.5% whiff rate</div>
          <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Deceptive vs bad chases (2025 MLB)</div>
        </div>
        <div>
          <div style={{ color: '#4a9eff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Primary Metric</div>
          <div style={{ color: 'var(--text-1)', fontSize: 18, fontWeight: 700, marginTop: 4 }}>Decision RV / 100 OOZ</div>
          <div style={{ color: 'var(--text-2)', fontSize: 12 }}>Run value of swing/take on out-of-zone pitches (higher = better)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search batter…" style={{ ...filterInputStyle, width: 200 }} />
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={filterInputStyle}>
          {teams.map(t => <option key={t} value={t}>{t === 'all' ? 'All Teams' : t}</option>)}
        </select>
        <select value={handFilter} onChange={e => setHandFilter(e.target.value as typeof handFilter)} style={filterInputStyle}>
          <option value="all">Both Hands</option>
          <option value="R">RHB</option>
          <option value="L">LHB</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Min chases:</span>
          <input type="number" value={minChases} onChange={e => setMinChases(Number(e.target.value))}
            min={10} max={500} step={10} style={{ ...filterInputStyle, width: 70 }} />
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{filtered.length} batters</span>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0d0d16' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-3)', ...stickyHeaderStyle }}>#</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-3)', ...stickyHeaderStyle }}>Batter</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-3)', ...stickyHeaderStyle }}>Team</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-3)', ...stickyHeaderStyle }}>H</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-3)', ...stickyHeaderStyle }}>Grade</th>
              <SortHdr {...sortCtx} k="ooz_decision_rv" label="Decision RV" />
              <SortHdr {...sortCtx} k="bad_chase_rate" label="Bad Chase%" />
              <SortHdr {...sortCtx} k="deceptive_chase_rate" label="Dec Chase%" />
              <SortHdr {...sortCtx} k="n_chases" label="Chases" />
              <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-3)', ...stickyHeaderStyle }}>Chase Whiff%</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-3)', ...stickyHeaderStyle }}>N Bad</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-3)', ...stickyHeaderStyle }}>N Dec</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => {
              const g = rvGrade(b.ooz_decision_rv);
              const rv = b.ooz_decision_rv ?? 0;
              return (
                <tr key={b.batter_id} style={{ borderBottom: '1px solid var(--bg-elevated)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '9px 14px', color: 'var(--text-3)' }}>{i + 1}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-1)', fontWeight: 500 }}>{b.batter_name}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-2)' }}>{b.batter_team}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-2)', textAlign: 'center' }}>{b.batter_hand}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                    <span style={{ background: g.color + '22', color: g.color, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: g.color, fontFamily: 'monospace', fontWeight: 600 }}>{rv >= 0 ? '+' : ''}{rv.toFixed(2)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'monospace' }}>{pct(b.bad_chase_rate)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: '#4a9eff', fontFamily: 'monospace' }}>{pct(b.deceptive_chase_rate)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-2)' }}>{b.n_chases}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'monospace' }}>{pct(b.chase_whiff_rate)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-2)' }}>{b.n_bad}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right', color: 'var(--text-2)' }}>{b.n_deceptive}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Elite', desc: '< 45%', color: '#d44040' },
          { label: 'Above Avg', desc: '45–55%', color: '#c85a5a' },
          { label: 'Average', desc: '55–65%', color: '#a87070' },
          { label: 'Below Avg', desc: '65–75%', color: '#6878a0' },
          { label: 'Poor', desc: '75–85%', color: '#4a6494' },
          { label: 'Very Poor', desc: '> 85%', color: '#3a5080' },
        ].map(({ label, desc, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{label} ({desc})</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, color: 'var(--text-3)', fontSize: 12 }}>
        <strong style={{ color: 'var(--text-2)' }}>Bad Chase%</strong> — out-of-zone swings where pitch was already outside at 167ms commit point (lower = better).{' '}
        <strong style={{ color: '#4a9eff' }}>Dec Chase%</strong> — chases where pitch was inside zone at commit but moved out (pitcher-induced, understandable).
      </div>
    </div>
  );
}

// ─── Combined Profile Tab ─────────────────────────────────────────────────────

type CombinedSortKey = 'swing_plus' | 'bad_chase_rate' | 'xwoba' | 'barrel_rate' | 'avg_bat_speed' | 'n_pa'
                     | 'bipr_simple' | 'wobacon';

function CombinedTab({ hitters, bdq, outcomes }: { hitters: EnrichedHitter[]; bdq: BatterBDQData; outcomes: BatterOutcomesData | null }) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [handFilter, setHandFilter] = useState<'all' | 'L' | 'R'>('all');
  const [sortKey, setSortKey] = useState<CombinedSortKey>('swing_plus');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const bdqMap = useMemo(() => new Map(bdq.batters.map(b => [b.batter_id, b])), [bdq]);

  type CombinedPlayer = EnrichedHitter & {
    bdq: Batter;
    bipr_simple: number | null;
    bipr_rv: number | null;
    wobacon: number | null;
    pred_rv_100: number | null;
  };

  const combined = useMemo<CombinedPlayer[]>(() =>
    hitters
      .map(h => {
        const b = bdqMap.get(h.id);
        if (!b) return null;
        const ov = outcomes?.[String(h.id)]?.overall;
        return {
          ...h,
          bdq: b,
          bipr_simple: ov?.bipr_simple ?? null,
          bipr_rv: ov?.bipr_rv ?? null,
          wobacon: ov?.wobacon ?? null,
          pred_rv_100: ov?.pred_rv_100 ?? null,
        };
      })
      .filter((x): x is CombinedPlayer => x !== null),
    [hitters, bdqMap, outcomes]
  );

  const teams = useMemo(() =>
    ['all', ...Array.from(new Set(combined.map(c => c.team).filter(t => t !== '—'))).sort()],
    [combined]
  );

  const filtered = useMemo(() =>
    combined
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))
      .filter(p => teamFilter === 'all' || p.team === teamFilter)
      .filter(p => handFilter === 'all' || p.hand === handFilter)
      .sort((a, b) => {
        let av: number, bv: number;
        // Nullish BIPR fields sort to the bottom regardless of direction
        const sortNull = sortKey === 'bipr_simple' || sortKey === 'wobacon';
        switch (sortKey) {
          case 'bad_chase_rate': av = a.bdq.bad_chase_rate; bv = b.bdq.bad_chase_rate; break;
          case 'xwoba': av = a.metrics.xwoba; bv = b.metrics.xwoba; break;
          case 'barrel_rate': av = a.metrics.barrel_rate; bv = b.metrics.barrel_rate; break;
          case 'avg_bat_speed': av = a.metrics.avg_bat_speed; bv = b.metrics.avg_bat_speed; break;
          case 'n_pa': av = a.n_pa; bv = b.n_pa; break;
          case 'bipr_simple': av = a.bipr_simple ?? -Infinity; bv = b.bipr_simple ?? -Infinity; break;
          case 'wobacon': av = a.wobacon ?? -Infinity; bv = b.wobacon ?? -Infinity; break;
          default: av = a.swing_plus; bv = b.swing_plus;
        }
        const d = bv - av;
        if (sortKey === 'bad_chase_rate') return sortDir === 'asc' ? -d : d;
        if (sortNull && sortDir === 'asc') {
          // ascending: nulls still at bottom — flip non-null comparison
          if (av === -Infinity && bv !== -Infinity) return 1;
          if (bv === -Infinity && av !== -Infinity) return -1;
          return -d;
        }
        return sortDir === 'desc' ? d : -d;
      }),
    [combined, search, teamFilter, handFilter, sortKey, sortDir]
  );

  function handleSort(k: CombinedSortKey) {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'bad_chase_rate' ? 'asc' : 'desc'); }
  }

  const sortCtx = { sortKey, sortDir, onSort: handleSort, pad: '9px 12px' };

  return (
    <div>
      <p style={{ color: 'var(--text-2)', fontSize: 13, margin: '0 0 16px 0' }}>
        {combined.length} batters with both <strong style={{ color: '#4a9eff' }}>Swing+</strong> and <strong style={{ color: '#c85a5a' }}>BDQ</strong> data.
        Combines raw bat quality metrics with plate discipline quality scores for a complete batter profile.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search batter…" style={{ ...filterInputStyle, width: 200 }} />
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={filterInputStyle}>
          {teams.map(t => <option key={t} value={t}>{t === 'all' ? 'All Teams' : t}</option>)}
        </select>
        <select value={handFilter} onChange={e => setHandFilter(e.target.value as typeof handFilter)} style={filterInputStyle}>
          <option value="all">Both Hands</option>
          <option value="R">RHB</option>
          <option value="L">LHB</option>
        </select>
        <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{filtered.length} batters</span>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: '9px 10px', color: 'var(--text-3)', textAlign: 'center', ...stickyHeaderStyle }}>#</th>
              <th style={{ padding: '9px 12px', color: 'var(--text-2)', textAlign: 'left', ...stickyHeaderStyle }}>Batter</th>
              <th style={{ padding: '9px 10px', color: 'var(--text-2)', ...stickyHeaderStyle }}>Team</th>
              <th style={{ padding: '9px 8px', color: 'var(--text-2)', ...stickyHeaderStyle }}>H</th>
              <SortTh {...sortCtx} k="swing_plus" label="Swing+" />
              <th style={{ padding: '9px 8px', color: 'var(--text-2)', textAlign: 'center', ...stickyHeaderStyle }}>Tier</th>
              <SortTh {...sortCtx} k="n_pa" label="PA" />
              <SortTh {...sortCtx} k="bad_chase_rate" label="Bad Chase%" title="Bad chases ÷ chases — chase composition only; the BDQ grade uses Decision RV" />
              <th style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'center', ...stickyHeaderStyle }}>BDQ</th>
              <SortTh {...sortCtx} k="xwoba" label="xwOBA" />
              <SortTh {...sortCtx} k="barrel_rate" label="Barrel%" />
              <SortTh {...sortCtx} k="avg_bat_speed" label="Bat Spd" />
              <SortTh {...sortCtx} k="bipr_simple" label="BIPR%" title="Batter Ideal Process Rate — (Balls+BIP+HBP − CS−Whiff−FTip−FStrike) / Pitches" />
              <SortTh {...sortCtx} k="wobacon" label="wOBACON" title="wOBA on Contact (BIP only)" />
              <th style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'right', ...stickyHeaderStyle }}>EV90</th>
              <th style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'right', ...stickyHeaderStyle }}>Whiff%</th>
              <th style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'right', ...stickyHeaderStyle }}>K%</th>
              <th style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'right', ...stickyHeaderStyle }}>BB%</th>
              <th title="Timing Consistency — σ (inches) of contact-point timing. Steadier ≠ better outcomes (descriptive)." style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'right', ...stickyHeaderStyle }}>Timing σ</th>
              <th title="Barrel Accuracy — mean whiff miss distance (inches). Big-miss hitters skew power (descriptive)." style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'right', ...stickyHeaderStyle }}>Whiff Miss</th>
              <th title="Perfect Swing Rate — share of swings on-time + centered + on-plane vs the batter's own baselines (league ≈ 20%, higher = better)." style={{ padding: '9px 10px', color: 'var(--text-2)', textAlign: 'right', ...stickyHeaderStyle }}>Perfect Sw%</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              // BDQ grade uses Decision RV (higher = better), not bad_chase_rate
              // — bad_chase_rate conditions on chasing and inverts elite low-chase
              // hitters (Soto/Kwan), so it must not drive the grade (H3 fix).
              const g = rvGrade(p.bdq.ooz_decision_rv);
              const tc = tierColor(p.tier);
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--bg-elevated)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                  <td style={{ padding: '7px 10px', color: 'var(--text-3)', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ padding: '7px 12px', color: 'var(--text-1)', fontWeight: 500, whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-2)', textAlign: 'center' }}>{p.team}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-2)', textAlign: 'center' }}>{p.hand}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                    <GradeBadge score={Math.round(p.swing_plus)} size="sm" />
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                    <span style={{ background: tc + '22', color: tc, borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600 }}>
                      {p.tier.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-2)', textAlign: 'center' }}>{p.n_pa}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                    <span style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>{pct(p.bdq.bad_chase_rate)}</span>
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                    <span style={{ background: g.color + '22', color: g.color, borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600 }}>{g.label}</span>
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-1)', fontFamily: 'monospace' }}>{p.metrics.xwoba.toFixed(3)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-1)', fontFamily: 'monospace' }}>{pct(p.metrics.barrel_rate)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-1)', fontFamily: 'monospace' }}>{p.metrics.avg_bat_speed.toFixed(1)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.bipr_simple != null ? 'var(--text-1)' : 'var(--text-3)', fontFamily: 'monospace' }}>
                    {p.bipr_simple != null ? `${(p.bipr_simple * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.wobacon != null ? 'var(--text-1)' : 'var(--text-3)', fontFamily: 'monospace' }}>
                    {p.wobacon != null ? p.wobacon.toFixed(3) : 'N/A'}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'monospace' }}>{p.metrics.ev90.toFixed(1)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'monospace' }}>{pct(p.metrics.whiff_rate)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'monospace' }}>{pct(p.metrics.k_rate)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-2)', fontFamily: 'monospace' }}>{pct(p.metrics.bb_rate)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.timing_consistency != null ? 'var(--text-2)' : 'var(--text-3)', fontFamily: 'monospace' }}>
                    {p.timing_consistency != null ? p.timing_consistency.toFixed(1) : 'N/A'}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.barrel_accuracy != null ? 'var(--text-2)' : 'var(--text-3)', fontFamily: 'monospace' }}>
                    {p.barrel_accuracy != null ? p.barrel_accuracy.toFixed(2) : 'N/A'}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: p.perfect_swing_rate != null ? 'var(--text-1)' : 'var(--text-3)', fontFamily: 'monospace' }}>
                    {p.perfect_swing_rate != null ? `${(p.perfect_swing_rate * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Scatter Tab ──────────────────────────────────────────────────────────────

interface ScatterPoint {
  x: number; y: number; name: string; team: string; tier: string;
  oozRV: number; badChase: number; decChase: number; swingPlus: number; xwoba: number;
  barrelRate: number; batSpeed: number; n_pa: number; n_chases: number;
}

function xwobaColor(xw: number): string {
  if (xw >= 0.400) return '#d44040';
  if (xw >= 0.360) return '#c85a5a';
  if (xw >= 0.320) return '#a87070';
  if (xw >= 0.290) return '#6878a0';
  return '#4a6494';
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const g = rvGrade(d.oozRV);
  const tc = tierColor(d.tier);
  return (
    <div style={{ background: '#16162a', border: '1px solid var(--border-plus)', borderRadius: 8, padding: '10px 14px', fontSize: 13, minWidth: 180 }}>
      <div style={{ color: 'var(--text-1)', fontWeight: 700 }}>{d.name}</div>
      <div style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 6 }}>{d.team} · {d.n_pa} PA</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span><span style={{ color: 'var(--text-2)', fontSize: 12 }}>Swing+:</span> <span style={{ color: tc, fontWeight: 700 }}>{d.swingPlus.toFixed(1)}</span></span>
        <span><span style={{ color: 'var(--text-2)', fontSize: 12 }}>Tier:</span> <span style={{ color: tc }}>{d.tier.replace(/_/g, ' ')}</span></span>
        <span><span style={{ color: 'var(--text-2)', fontSize: 12 }}>Decision RV:</span> <span style={{ color: g.color }}>{d.oozRV.toFixed(1)}</span> <span style={{ color: 'var(--text-3)', fontSize: 11 }}>({g.label})</span></span>
        <span><span style={{ color: 'var(--text-2)', fontSize: 12 }}>Bad Chase%:</span> <span style={{ color: 'var(--text-2)' }}>{pct(d.badChase)}</span> <span style={{ color: 'var(--text-3)', fontSize: 11 }}>composition</span></span>
        <span><span style={{ color: 'var(--text-2)', fontSize: 12 }}>Dec Chase%:</span> <span style={{ color: '#4a9eff' }}>{pct(d.decChase)}</span></span>
        <span><span style={{ color: 'var(--text-2)', fontSize: 12 }}>xwOBA:</span> <span style={{ color: xwobaColor(d.xwoba) }}>{d.xwoba.toFixed(3)}</span></span>
        <span><span style={{ color: 'var(--text-2)', fontSize: 12 }}>Barrel%:</span> <span style={{ color: 'var(--text-1)' }}>{pct(d.barrelRate)}</span></span>
      </div>
    </div>
  );
}

function ScatterTab({ hitters, bdq }: { hitters: EnrichedHitter[]; bdq: BatterBDQData }) {
  const [minPA, setMinPA] = useState(100);
  const [minChases, setMinChases] = useState(30);
  const [colorBy, setColorBy] = useState<'tier' | 'xwoba'>('tier');

  const bdqMap = useMemo(() => new Map(bdq.batters.map(b => [b.batter_id, b])), [bdq]);

  const points = useMemo(() =>
    hitters
      .filter(h => h.n_pa >= minPA)
      .map(h => {
        const b = bdqMap.get(h.id);
        if (!b || b.n_chases < minChases) return null;
        return {
          x: b.ooz_decision_rv ?? 0,
          y: h.swing_plus,
          name: h.name,
          team: h.team,
          tier: h.tier,
          oozRV: b.ooz_decision_rv ?? 0,
          badChase: b.bad_chase_rate,
          decChase: b.deceptive_chase_rate,
          swingPlus: h.swing_plus,
          xwoba: h.metrics.xwoba,
          barrelRate: h.metrics.barrel_rate,
          batSpeed: h.metrics.avg_bat_speed,
          n_pa: h.n_pa,
          n_chases: b.n_chases,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    [hitters, bdqMap, minPA, minChases]
  );

  const avgOozRv = useMemo(() =>
    points.length ? points.reduce((s, p) => s + p.oozRV, 0) / points.length : 2.5,
    [points]
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: 'var(--text-1)', margin: '0 0 6px 0', fontSize: 16 }}>Swing Quality vs. Plate Discipline</h3>
        <p style={{ color: 'var(--text-2)', fontSize: 13, margin: 0 }}>
          Each dot is a batter with both Swing+ and BDQ data. Ideal batters are{' '}
          <strong style={{ color: '#d44040' }}>top-right</strong> (high Swing+ + high decision run value).
          n = {points.length} batters.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Min PA:</span>
          <input type="number" value={minPA} onChange={e => setMinPA(Number(e.target.value))}
            min={0} max={600} step={25} style={{ ...filterInputStyle, width: 70 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Min Chases:</span>
          <input type="number" value={minChases} onChange={e => setMinChases(Number(e.target.value))}
            min={10} max={200} step={10} style={{ ...filterInputStyle, width: 70 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Color by:</span>
          <select value={colorBy} onChange={e => setColorBy(e.target.value as typeof colorBy)} style={filterInputStyle}>
            <option value="tier">Swing+ Tier</option>
            <option value="xwoba">xwOBA</option>
          </select>
        </div>
      </div>

      {/* Quadrant labels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4, paddingLeft: 60 }}>
        <div style={{ textAlign: 'center', color: '#a87070', fontSize: 11, fontWeight: 600 }}>AGGRESSIVE ELITE ↑</div>
        <div style={{ textAlign: 'center', color: '#d44040', fontSize: 11, fontWeight: 600 }}>DISCIPLINED ELITE ↑</div>
      </div>

      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={{ top: 10, right: 30, bottom: 50, left: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="x" type="number"
            domain={['auto', 'auto']}
            tickFormatter={v => v.toFixed(1)}
            stroke="var(--border-plus)" tick={{ fill: 'var(--text-3)', fontSize: 11 }}
            label={{ value: 'Decision RV / 100 OOZ pitches (higher = better)', position: 'insideBottom', offset: -30, fill: 'var(--text-2)', fontSize: 12 }}
          />
          <YAxis
            dataKey="y" type="number"
            domain={[60, 200]}
            stroke="var(--border-plus)" tick={{ fill: 'var(--text-3)', fontSize: 11 }}
            label={{ value: 'Swing+', angle: -90, position: 'insideLeft', offset: 15, fill: 'var(--text-2)', fontSize: 12 }}
          />
          <Tooltip content={<ScatterTooltip />} />
          <ReferenceLine x={avgOozRv} stroke="#4a9eff" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Avg', position: 'top', fill: '#4a9eff', fontSize: 10 }} />
          <ReferenceLine y={100} stroke="#4a9eff" strokeDasharray="4 4" strokeOpacity={0.4} label={{ value: 'Avg', position: 'right', fill: '#4a9eff', fontSize: 10 }} />
          <Scatter data={points} fillOpacity={0.75} r={4}>
            {points.map((p) => (
              <Cell key={`${p.name}-${p.team}`} fill={colorBy === 'tier' ? tierColor(p.tier) : xwobaColor(p.xwoba)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, paddingLeft: 60, marginTop: 4 }}>
        <div style={{ textAlign: 'center', color: '#3a5080', fontSize: 11 }}>NEEDS WORK ↓</div>
        <div style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 11 }}>DISCIPLINED / LOW OUTPUT ↓</div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {colorBy === 'tier'
          ? Object.entries(TIER_COLORS).map(([tier, color]) => (
              <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 10, background: color }} />
                <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{tier.replace(/_/g, ' ')}</span>
              </div>
            ))
          : [
              { label: 'xwOBA ≥ .400', color: '#d44040' },
              { label: '.360–.400', color: '#c85a5a' },
              { label: '.320–.360', color: '#a87070' },
              { label: '.290–.320', color: '#6878a0' },
              { label: '< .290', color: '#4a6494' },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 10, background: color }} />
                <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{label}</span>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BattersPanel() {
  const { season } = useData();
  const safeSeason = (typeof season === 'number' ? season : 2025) as 2021 | 2022 | 2023 | 2024 | 2025 | 2026;
  const { bdq, enriched, loading, error } = useBatterData(safeSeason);
  const { data: outcomes } = useBatterOutcomes(safeSeason);
  const [activeTab, setActiveTab] = useState<Tab>('swing');

  if (loading) return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ height: 28, width: 200, background: 'var(--border)', borderRadius: 6, marginBottom: 10 }} />
        <div style={{ height: 14, width: 340, background: 'var(--border)', borderRadius: 4 }} />
      </div>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ height: 44, background: 'var(--bg-surface)', borderRadius: 6, marginBottom: 6,
          animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.6 + (i % 3) * 0.1 }} />
      ))}
    </div>
  );

  if (error) return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ color: '#ef4444', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Failed to load batter data
      </div>
      <div style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
        {error}
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{ background: '#4a9eff', color: 'var(--bg-base)', border: 'none', borderRadius: 6,
          padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}
      >
        Retry
      </button>
    </div>
  );

  if (!bdq || !enriched) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'swing',    label: 'Swing+ Leaderboard' },
    { id: 'bdq',      label: 'BDQ Decision Quality' },
    { id: 'combined', label: 'Combined Profile' },
    { id: 'scatter',  label: 'Scatter: Swing vs Discipline' },
  ];

  return (
    <div>
      <p className="subtitle" style={{ marginTop: 0, marginBottom: 14 }}>
        {enriched.length} Swing+ batters · {bdq.metadata.n_batters} BDQ batters · {bdq.metadata.model}
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: '10px 18px', border: 'none', cursor: 'pointer',
              background: activeTab === id ? '#4a9eff' : 'transparent',
              color: activeTab === id ? 'var(--bg-base)' : 'var(--text-2)',
              fontWeight: activeTab === id ? 700 : 400,
              borderRadius: '6px 6px 0 0',
              fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'swing'    && <SwingPlusTab hitters={enriched} />}
      {activeTab === 'bdq'      && <BDQTab bdq={bdq} />}
      {activeTab === 'combined' && <CombinedTab hitters={enriched} bdq={bdq} outcomes={outcomes} />}
      {activeTab === 'scatter'  && <ScatterTab hitters={enriched} bdq={bdq} />}
    </div>
  );
}
