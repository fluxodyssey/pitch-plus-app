import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradeBadge } from './GradeBadge';
import { scoreColor, scoreColorContinuous, pitchColor } from '../data/constants';
import { computePercentiles } from '../data/percentiles';
import type { Pitcher, DimensionKey, PitchTypesData } from '../types';

type SortKey =
  | 'rank'
  | 'pitcher_name'
  | 'pitcher_team'
  | 'pitch_plus'
  | 'n_pitches'
  | 'ip'
  | 'n_games'
  | DimensionKey
  | 'pt_usage'
  | 'pt_velo'
  | 'pt_spin'
  | 'pt_ivb'
  | 'pt_hb'
  | 'pt_whiff';

interface Props {
  pitchers: Pitcher[];
  showRank?: boolean;
  pitchTypeFilter?: string;
  pitchTypesData?: PitchTypesData;
}

const DIMENSION_KEYS: DimensionKey[] = [
  'stuff',
  'command',
  'deception',
  'tunnel_and_sequence',
  'outcomes',
  'arsenal',
];

const DIM_HEADERS: Record<DimensionKey, string> = {
  stuff: 'Stuff',
  command: 'Cmd',
  deception: 'Dec',
  tunnel_and_sequence: 'Tun',
  outcomes: 'Out',
  arsenal: 'Ars',
};

const PAGE_SIZE = 50;

export function PlayerTable({ pitchers, showRank = true, pitchTypeFilter, pitchTypesData }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('pitch_plus');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [highlightedRow, setHighlightedRow] = useState(-1);

  const percentileMap = useMemo(() => computePercentiles(pitchers), [pitchers]);

  function getPitchTypeRow(pitcher_id: number) {
    if (!pitchTypeFilter || !pitchTypesData) return null;
    const types = pitchTypesData.pitchers[String(pitcher_id)] ?? [];
    return types.find((t) => t.pitch_type === pitchTypeFilter) ?? null;
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const PT_SORT_FIELD: Record<string, keyof NonNullable<ReturnType<typeof getPitchTypeRow>>> = {
    pt_usage: 'usage_pct',
    pt_velo: 'velo',
    pt_spin: 'spin',
    pt_ivb: 'ivb',
    pt_hb: 'hb',
    pt_whiff: 'whiff_rate',
  };

  const sorted = [...pitchers].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;
    if (sortKey === 'pitcher_name' || sortKey === 'pitcher_team') {
      av = a[sortKey];
      bv = b[sortKey];
    } else if (sortKey === 'rank') {
      av = a.pitch_plus;
      bv = b.pitch_plus;
    } else if (sortKey === 'pitch_plus') {
      av = a.pitch_plus;
      bv = b.pitch_plus;
    } else if (sortKey === 'n_pitches') {
      av = pitchTypeFilter ? (getPitchTypeRow(a.pitcher_id)?.n ?? 0) : a.n_pitches;
      bv = pitchTypeFilter ? (getPitchTypeRow(b.pitcher_id)?.n ?? 0) : b.n_pitches;
    } else if (sortKey === 'ip') {
      av = a.ip ?? 0;
      bv = b.ip ?? 0;
    } else if (sortKey === 'n_games') {
      av = a.n_games;
      bv = b.n_games;
    } else if (DIMENSION_KEYS.includes(sortKey as DimensionKey)) {
      av = a.dimensions[sortKey as DimensionKey]?.score ?? 0;
      bv = b.dimensions[sortKey as DimensionKey]?.score ?? 0;
    } else if (sortKey in PT_SORT_FIELD) {
      const field = PT_SORT_FIELD[sortKey];
      av = getPitchTypeRow(a.pitcher_id)?.[field] ?? 0;
      bv = getPitchTypeRow(b.pitcher_id)?.[field] ?? 0;
    }

    if (typeof av === 'string' && typeof bv === 'string') {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function SortHeader({
    label,
    col,
    title,
  }: {
    label: string;
    col: SortKey;
    title?: string;
  }) {
    const active = sortKey === col;
    return (
      <th
        onClick={() => handleSort(col)}
        title={title}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          color: active ? '#4a9eff' : '#a0a0b8',
          fontWeight: active ? 700 : 500,
          padding: '8px 10px',
          borderBottom: '2px solid #1e1e2e',
          background: '#14141f',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {label}
        {active && (
          <span style={{ marginLeft: 4, fontSize: 10 }}>{sortAsc ? '▲' : '▼'}</span>
        )}
      </th>
    );
  }

  const pageItems = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedRow((r) => Math.min(r + 1, pageItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedRow((r) => Math.max(r - 1, 0));
    } else if (e.key === 'Enter' && highlightedRow >= 0 && pageItems[highlightedRow]) {
      e.preventDefault();
      navigate(`/player/${pageItems[highlightedRow].pitcher_id}`);
    }
  }, [highlightedRow, pageItems, navigate]);

  return (
    <div style={{ overflowX: 'auto' }} tabIndex={0} onKeyDown={handleKeyDown}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
        }}
      >
        <thead>
          <tr>
            {showRank && (
              <th
                onClick={() => handleSort('rank')}
                title="Rank by Pitch+"
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  color: sortKey === 'rank' ? '#4a9eff' : '#a0a0b8',
                  fontWeight: sortKey === 'rank' ? 700 : 500,
                  padding: '8px 10px',
                  borderBottom: '2px solid #1e1e2e',
                  background: '#14141f',
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 3,
                }}
              >
                #{sortKey === 'rank' && <span style={{ marginLeft: 4, fontSize: 10 }}>{sortAsc ? '▲' : '▼'}</span>}
              </th>
            )}
            <th
              onClick={() => handleSort('pitcher_name')}
              style={{
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                color: sortKey === 'pitcher_name' ? '#4a9eff' : '#a0a0b8',
                fontWeight: sortKey === 'pitcher_name' ? 700 : 500,
                padding: '8px 10px',
                borderBottom: '2px solid #1e1e2e',
                background: '#14141f',
                position: 'sticky',
                top: 0,
                left: showRank ? 40 : 0,
                zIndex: 3,
              }}
            >
              Name{sortKey === 'pitcher_name' && <span style={{ marginLeft: 4, fontSize: 10 }}>{sortAsc ? '▲' : '▼'}</span>}
            </th>
            <SortHeader label="Team" col="pitcher_team" />
            <th style={{ padding: '8px 6px', color: '#a0a0b8', borderBottom: '2px solid #1e1e2e', background: '#14141f', position: 'sticky', top: 0, zIndex: 1 }}>Hand</th>
            <SortHeader label="Pitch+" col="pitch_plus" />
            {pitchTypeFilter ? (
              <>
                <SortHeader label="Usage%" col="pt_usage" title="Usage percentage" />
                <SortHeader label="Velo" col="pt_velo" title="Average velocity" />
                <SortHeader label="Spin" col="pt_spin" title="Average spin rate" />
                <SortHeader label="IVB" col="pt_ivb" title="Induced vertical break" />
                <SortHeader label="HB" col="pt_hb" title="Horizontal break" />
                <SortHeader label="Whiff%" col="pt_whiff" title="Whiff rate" />
              </>
            ) : (
              DIMENSION_KEYS.map((d) => (
                <SortHeader
                  key={d}
                  label={DIM_HEADERS[d]}
                  col={d}
                  title={d.replace(/_/g, ' ')}
                />
              ))
            )}
            <SortHeader label="Pitches" col="n_pitches" />
            <SortHeader label="IP" col="ip" title="Innings Pitched" />
            <SortHeader label="G" col="n_games" title="Games" />
          </tr>
        </thead>
        <tbody>
          {pageItems.map((p, idx) => {
            const globalIdx = page * PAGE_SIZE + idx;
            const ptRow = getPitchTypeRow(p.pitcher_id);
            return (
              <tr
                key={p.pitcher_id}
                onClick={() => navigate(`/player/${p.pitcher_id}`)}
                style={{
                  cursor: 'pointer',
                  borderBottom: '1px solid #1e1e2e',
                  background: idx === highlightedRow ? '#1a1a2e' : undefined,
                }}
                className="table-row-hover"
              >
                {showRank && (
                  <td style={{ padding: '6px 10px', color: '#606080', textAlign: 'center', position: 'sticky', left: 0, background: '#0a0a0f', zIndex: 1 }}>
                    {globalIdx + 1}
                  </td>
                )}
                <td style={{ padding: '6px 10px', color: '#e0e0e8', fontWeight: 500, whiteSpace: 'nowrap', position: 'sticky', left: showRank ? 40 : 0, background: '#0a0a0f', zIndex: 1 }}>
                  {p.pitcher_name}
                </td>
                <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>
                  {p.pitcher_team}
                </td>
                <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>
                  {p.pitcher_hand}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <GradeBadge score={p.pitch_plus} size="sm" />
                </td>
                {pitchTypeFilter ? (
                  <>
                    <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>
                      {ptRow ? `${(ptRow.usage_pct * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#e0e0e8', textAlign: 'center' }}>
                      {ptRow ? ptRow.velo.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>
                      {ptRow ? Math.round(ptRow.spin).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: pitchColor(pitchTypeFilter), textAlign: 'center' }}>
                      {ptRow ? ptRow.ivb.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: pitchColor(pitchTypeFilter), textAlign: 'center' }}>
                      {ptRow ? ptRow.hb.toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#e0e0e8', textAlign: 'center', fontWeight: ptRow && ptRow.whiff_rate > 0.30 ? 700 : 400 }}>
                      {ptRow ? `${(ptRow.whiff_rate * 100).toFixed(1)}%` : '—'}
                    </td>
                  </>
                ) : (
                  DIMENSION_KEYS.map((d) => {
                    const score = p.dimensions[d]?.score ?? 0;
                    const pctile = percentileMap.get(p.pitcher_id)?.dimensions[d] ?? 50;
                    return (
                      <td
                        key={d}
                        style={{
                          padding: '6px 8px',
                          textAlign: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          fontSize: 12,
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          height: '100%',
                          width: `${pctile}%`,
                          background: scoreColorContinuous(50 + pctile, 0.2),
                          transition: 'width 0.3s ease-out',
                        }} />
                        <span style={{
                          position: 'relative',
                          zIndex: 1,
                          color: '#e0e0e8',
                          fontWeight: score >= 115 ? 700 : 400,
                        }}>
                          {score}
                        </span>
                      </td>
                    );
                  })
                )}
                <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'right' }}>
                  {pitchTypeFilter ? (ptRow?.n.toLocaleString() ?? '—') : p.n_pitches.toLocaleString()}
                </td>
                <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'right' }}>
                  {p.ip != null ? p.ip.toFixed(1) : '—'}
                </td>
                <td style={{ padding: '6px 10px', color: '#a0a0b8', textAlign: 'center' }}>
                  {p.n_games}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Pagination */}
      {sorted.length > PAGE_SIZE && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 0',
        }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: '1px solid #2a2a3e',
              borderRadius: 4,
              background: 'transparent',
              color: page === 0 ? '#404060' : '#a0a0b8',
              cursor: page === 0 ? 'default' : 'pointer',
            }}
          >
            Prev
          </button>
          <span style={{ color: '#606080', fontSize: 12 }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <button
            disabled={(page + 1) * PAGE_SIZE >= sorted.length}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '4px 10px',
              fontSize: 12,
              border: '1px solid #2a2a3e',
              borderRadius: 4,
              background: 'transparent',
              color: (page + 1) * PAGE_SIZE >= sorted.length ? '#404060' : '#a0a0b8',
              cursor: (page + 1) * PAGE_SIZE >= sorted.length ? 'default' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
