import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { rowNavProps } from '../data/rowNavigation';
import { useSpringData } from '../data/useSpringData';
import { DeltaBadge } from '../components/DeltaBadge';
import { DIMENSION_LABELS, gradeColor, PITCH_TYPE_COLORS } from '../data/constants';
import { SkeletonPage } from '../components/Skeleton';
import type { SpringDelta, PitchTypeDelta } from '../data/computeSpringDeltas';

type SortKey = 'pitch_plus_delta' | 'stuff' | 'command' | 'deception' | 'tunnel_and_sequence' | 'outcomes' | 'arsenal';
type Direction = 'all' | 'improved' | 'declined';
type ViewMode = 'overview' | 'arsenal';

function getSortValue(d: SpringDelta, key: SortKey): number {
  if (key === 'pitch_plus_delta') return d.pitch_plus_delta;
  return d.dimension_deltas[key] ?? 0;
}

const DIM_KEYS = ['stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal'] as const;

// Module scope so React preserves <th> identity across renders (react-hooks/static-components).
function SortHeader({ k, label, width, sortKey, sortAsc, onSort }: {
  k: SortKey; label: string; width?: number;
  sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(k)}
      style={{
        cursor: 'pointer', padding: '8px 6px', textAlign: 'center', fontSize: 11,
        color: sortKey === k ? '#4a9eff' : '#808098', width,
        userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      {label} {sortKey === k ? (sortAsc ? '▲' : '▼') : ''}
    </th>
  );
}

// ─── Top Movers Card ─────────────────────────────────────────────────────────

function MoverCard({ player, rank, type }: { player: SpringDelta; rank: number; type: 'improve' | 'decline' }) {
  const navigate = useNavigate();
  const color = type === 'improve' ? '#22c55e' : '#ef4444';
  const biggestDim = DIM_KEYS.reduce((best, dk) => {
    const v = Math.abs(player.dimension_deltas[dk] ?? 0);
    return v > Math.abs(player.dimension_deltas[best] ?? 0) ? dk : best;
  }, DIM_KEYS[0]);

  return (
    <div
      {...rowNavProps(navigate, `/player/${player.pitcher_id}`)}
      style={{
        background: '#12121e', border: `1px solid ${color}33`, borderRadius: 8,
        padding: '10px 14px', cursor: 'pointer', flex: 1, minWidth: 180,
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = `${color}33`)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: '#808098', fontSize: 11 }}>#{rank}</span>
        <span style={{ color, fontSize: 18, fontWeight: 700 }}>
          {player.pitch_plus_delta > 0 ? '+' : ''}{player.pitch_plus_delta}
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#e0e0e8', marginBottom: 2 }}>
        {player.pitcher_name}
      </div>
      <div style={{ color: '#808098', fontSize: 11 }}>
        {player.pitcher_team} • {player.spring_n_pitches} pitches
      </div>
      <div style={{ color: '#a0a0b8', fontSize: 11, marginTop: 4 }}>
        Biggest change: <span style={{ color }}>{DIMENSION_LABELS[biggestDim as keyof typeof DIMENSION_LABELS] ?? biggestDim}</span>{' '}
        <DeltaBadge delta={player.dimension_deltas[biggestDim] ?? null} size="sm" />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function SpringTraining() {
  const { deltas, loading, error, springMeta } = useSpringData();
  const navigate = useNavigate();

  const [sortKey, setSortKey] = useState<SortKey>('pitch_plus_delta');
  const [sortAsc, setSortAsc] = useState(false);
  const [direction, setDirection] = useState<Direction>('all');
  const [teamFilter, setTeamFilter] = useState('All');
  const [handFilter, setHandFilter] = useState('All');
  const [minPitches, setMinPitches] = useState(30);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [ptFilter, setPtFilter] = useState('All');

  const teams = useMemo(() => {
    if (!deltas) return [];
    const s = new Set(deltas.map(d => d.pitcher_team));
    return ['All', ...Array.from(s).sort()];
  }, [deltas]);

  const allPitchTypes = useMemo(() => {
    if (!deltas) return [];
    const s = new Set<string>();
    deltas.forEach(d => d.pitch_type_deltas.forEach(pt => s.add(pt.pitch_type)));
    return Array.from(s).sort();
  }, [deltas]);

  const filtered = useMemo(() => {
    if (!deltas) return [];
    return deltas
      .filter(d => {
        if (d.spring_n_pitches < minPitches) return false;
        if (teamFilter !== 'All' && d.pitcher_team !== teamFilter) return false;
        if (handFilter !== 'All' && d.pitcher_hand !== handFilter) return false;
        if (direction === 'improved' && d.pitch_plus_delta <= 0) return false;
        if (direction === 'declined' && d.pitch_plus_delta >= 0) return false;
        return true;
      })
      .sort((a, b) => {
        const av = getSortValue(a, sortKey);
        const bv = getSortValue(b, sortKey);
        return sortAsc ? av - bv : bv - av;
      });
  }, [deltas, sortKey, sortAsc, direction, teamFilter, handFilter, minPitches]);

  const topImprovers = useMemo(() =>
    [...(deltas ?? [])].filter(d => d.spring_n_pitches >= minPitches).sort((a, b) => b.pitch_plus_delta - a.pitch_plus_delta).slice(0, 5),
    [deltas, minPitches]
  );
  const topDecliners = useMemo(() =>
    [...(deltas ?? [])].filter(d => d.spring_n_pitches >= minPitches).sort((a, b) => a.pitch_plus_delta - b.pitch_plus_delta).slice(0, 5),
    [deltas, minPitches]
  );

  // Arsenal view: flatten pitch type deltas
  const arsenalRows = useMemo(() => {
    if (!filtered) return [];
    const rows: Array<{ player: SpringDelta; pt: PitchTypeDelta }> = [];
    for (const d of filtered) {
      for (const pt of d.pitch_type_deltas) {
        if (ptFilter !== 'All' && pt.pitch_type !== ptFilter) continue;
        rows.push({ player: d, pt });
      }
    }
    return rows;
  }, [filtered, ptFilter]);

  if (loading) return <SkeletonPage />;
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h2 style={{ color: '#e0e0e8' }}>Spring Training Data Not Available</h2>
      <p style={{ color: '#808098' }}>Run the Pitch+ model on spring 2026 data to generate spring_pitchers.json</p>
      <p style={{ color: '#606080', fontSize: 12 }}>{error}</p>
    </div>
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortCtx = { sortKey, sortAsc, onSort: handleSort };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ color: '#e0e0e8', fontSize: 24, margin: 0 }}>Spring Training 2026</h1>
        <span style={{
          background: '#f59e0b33', color: '#f59e0b', fontSize: 11, fontWeight: 700,
          padding: '2px 8px', borderRadius: 4,
        }}>SPRING 2026</span>
        <span style={{
          background: '#ef444433', color: '#ef4444', fontSize: 11, fontWeight: 700,
          padding: '2px 8px', borderRadius: 4,
        }}>TEST DATA</span>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#f59e0b15', border: '1px solid #f59e0b33', borderRadius: 8,
        padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#d4a050',
      }}>
        Spring training data is for model testing and evaluation only — not used in model training.
        Small sample sizes (avg ~{springMeta ? Math.round(springMeta.n_pitches / springMeta.n_pitchers) : 90} pitches/pitcher) mean scores are noisier than regular season.
        {springMeta && (
          <span style={{ color: '#a08050', marginLeft: 8 }}>
            {springMeta.n_pitchers} pitchers • {springMeta.n_pitches.toLocaleString()} pitches • {springMeta.n_games} games • Scored vs 2025 MLB baselines
          </span>
        )}
      </div>

      {/* Top Movers */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Top 5 Improvers</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {topImprovers.map((p, i) => <MoverCard key={p.pitcher_id} player={p} rank={i + 1} type="improve" />)}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Top 5 Decliners</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {topDecliners.map((p, i) => <MoverCard key={p.pitcher_id} player={p} rank={i + 1} type="decline" />)}
          </div>
        </div>
      </div>

      {/* View mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['overview', 'arsenal'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              background: viewMode === mode ? '#2a2a3e' : 'transparent',
              border: `1px solid ${viewMode === mode ? '#4a9eff' : '#2a2a3e'}`,
              color: viewMode === mode ? '#4a9eff' : '#808098',
              borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13,
            }}
          >
            {mode === 'overview' ? 'Overview' : 'Arsenal Changes'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={selectStyle}>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={handFilter} onChange={e => setHandFilter(e.target.value)} style={selectStyle}>
          <option value="All">All Hands</option>
          <option value="L">LHP</option>
          <option value="R">RHP</option>
        </select>
        <select value={direction} onChange={e => setDirection(e.target.value as Direction)} style={selectStyle}>
          <option value="all">All</option>
          <option value="improved">Improved Only</option>
          <option value="declined">Declined Only</option>
        </select>
        {viewMode === 'arsenal' && (
          <select value={ptFilter} onChange={e => setPtFilter(e.target.value)} style={selectStyle}>
            <option value="All">All Pitch Types</option>
            {allPitchTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
          </select>
        )}
        <label style={{ color: '#808098', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          Min pitches:
          <input
            type="number" value={minPitches} min={0} step={10}
            onChange={e => setMinPitches(Number(e.target.value))}
            style={{ ...selectStyle, width: 60 }}
          />
        </label>
        <span style={{ color: '#606080', fontSize: 12, marginLeft: 'auto' }}>
          {filtered.length} pitchers
        </span>
      </div>

      {/* Overview Table */}
      {viewMode === 'overview' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a3e' }}>
                <th style={{ ...thStyle, width: 30 }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 160 }}>Pitcher</th>
                <th style={{ ...thStyle, width: 50 }}>Team</th>
                <th style={{ ...thStyle, width: 40 }}>H</th>
                <th style={{ ...thStyle, width: 50 }}>SP P</th>
                <th style={{ ...thStyle, width: 50 }}>2025</th>
                <th style={{ ...thStyle, width: 55 }}>Spring</th>
                <SortHeader k="pitch_plus_delta" label="Delta" width={55} {...sortCtx} />
                {DIM_KEYS.map(dk => (
                  <SortHeader key={dk} k={dk} label={DIMENSION_LABELS[dk as keyof typeof DIMENSION_LABELS] ?? dk} width={65} {...sortCtx} />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr
                  key={d.pitcher_id}
                  {...rowNavProps(navigate, `/player/${d.pitcher_id}`)}
                  style={{
                    borderBottom: '1px solid #1a1a2e', cursor: 'pointer',
                    background: i % 2 === 0 ? 'transparent' : '#0a0a14',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1a1a2e')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#0a0a14')}
                >
                  <td style={{ ...tdStyle, color: '#606080', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: '#e0e0e8' }}>
                    {d.pitcher_name}
                    {d.pitcher_team !== d.team_2025 && (
                      <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }} title={`Was ${d.team_2025} in 2025`}>*</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#808098' }}>{d.pitcher_team}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#808098' }}>{d.pitcher_hand}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: '#606080', fontSize: 11 }}>{d.spring_n_pitches}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: gradeColor(d.baseline_pitch_plus) }}>{d.baseline_pitch_plus}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: gradeColor(d.spring_pitch_plus), fontWeight: 600 }}>{d.spring_pitch_plus}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <DeltaBadge delta={d.pitch_plus_delta} />
                  </td>
                  {DIM_KEYS.map(dk => (
                    <td key={dk} style={{ ...tdStyle, textAlign: 'center' }}>
                      <DeltaBadge delta={d.dimension_deltas[dk] ?? null} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Arsenal Changes Table */}
      {viewMode === 'arsenal' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a3e' }}>
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>Pitcher</th>
                <th style={{ ...thStyle, width: 80 }}>Pitch</th>
                <th style={{ ...thStyle, width: 60 }}>Status</th>
                <th style={{ ...thStyle, width: 65 }}>Velo &Delta;</th>
                <th style={{ ...thStyle, width: 65 }}>Spin &Delta;</th>
                <th style={{ ...thStyle, width: 60 }}>IVB &Delta;</th>
                <th style={{ ...thStyle, width: 60 }}>HB &Delta;</th>
                <th style={{ ...thStyle, width: 65 }}>Usage &Delta;</th>
                <th style={{ ...thStyle, width: 65 }}>Whiff &Delta;</th>
              </tr>
            </thead>
            <tbody>
              {arsenalRows.map((row, i) => (
                <tr
                  key={`${row.player.pitcher_id}-${row.pt.pitch_type}`}
                  style={{
                    borderBottom: '1px solid #1a1a2e',
                    background: i % 2 === 0 ? 'transparent' : '#0a0a14',
                  }}
                >
                  <td
                    style={{ ...tdStyle, fontWeight: 500, color: '#e0e0e8', cursor: 'pointer' }}
                    {...rowNavProps(navigate, `/player/${row.player.pitcher_id}`)}
                  >
                    {row.player.pitcher_name}
                    <span style={{ color: '#606080', fontSize: 11, marginLeft: 4 }}>{row.player.pitcher_team}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ color: PITCH_TYPE_COLORS[row.pt.pitch_type] ?? '#e0e0e8', fontWeight: 500 }}>
                      {row.pt.pitch_name}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {row.pt.is_new && (
                      <span style={{ background: '#f59e0b33', color: '#f59e0b', fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>NEW</span>
                    )}
                    {row.pt.is_dropped && (
                      <span style={{ background: '#60608033', color: '#808098', fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>DROPPED</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaBadge delta={row.pt.velo_delta} format="decimal" /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaBadge delta={row.pt.spin_delta} /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaBadge delta={row.pt.ivb_delta} format="decimal" /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaBadge delta={row.pt.hb_delta} format="decimal" /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaBadge delta={row.pt.usage_delta} format="percent" /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}><DeltaBadge delta={row.pt.whiff_delta} format="percent" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {arsenalRows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#606080' }}>
              No pitch type data available. Run the model to generate spring_pitch_types.json.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', color: '#e0e0e8',
  borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  padding: '8px 6px', textAlign: 'center', fontSize: 11, color: '#808098',
  whiteSpace: 'nowrap', userSelect: 'none',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 6px', fontSize: 13,
};
