import { useState, useMemo } from 'react';
import type { PitchTypeGrade } from '../types';
import { scoreColorContinuous, pitchColor, numericGrade, gradeColor, toScoutingGrade, SCOUTING_LABELS } from '../data/constants';

// ─── Column definitions ──────────────────────────────────────────────────────

interface ColDef {
  key: string;
  label: string;
  shortLabel?: string;
  getValue: (g: PitchTypeGrade) => number | string | null;
  getGrade?: (g: PitchTypeGrade) => number;
  format?: (v: number | null) => string;
  align?: 'left' | 'right' | 'center';
  width?: number;
}

const fmtPct = (v: number | null) => v != null ? (v * 100).toFixed(1) + '%' : '--';
const fmt1 = (v: number | null) => v != null ? v.toFixed(1) : '--';
const fmt0 = (v: number | null) => v != null ? Math.round(v).toString() : '--';

const COLUMNS: ColDef[] = [
  { key: 'type', label: 'Pitch', getValue: g => g.pitchName, align: 'left', width: 110 },
  { key: 'count', label: '#', getValue: g => g.count, align: 'right', width: 40 },
  { key: 'usage', label: 'Usage%', getValue: g => g.usagePct, format: fmtPct, align: 'right', width: 58 },
  { key: 'velo', label: 'Velo', getValue: g => g.avgVelo, format: fmt1, getGrade: g => g.veloGrade, align: 'right', width: 52 },
  { key: 'ivb', label: 'iVB', getValue: g => g.avgIvb, format: fmt1, getGrade: g => g.ivbGrade, align: 'right', width: 48 },
  { key: 'hb', label: 'HB', getValue: g => g.avgHb, format: fmt1, getGrade: g => g.hbGrade, align: 'right', width: 48 },
  { key: 'spin', label: 'Spin', getValue: g => g.avgSpin, format: fmt0, getGrade: g => g.spinGrade, align: 'right', width: 52 },
  { key: 'vaa', label: 'VAA', getValue: g => g.avgVaa, format: fmt1, align: 'right', width: 48 },
  { key: 'ext', label: 'Ext', getValue: g => g.avgExt, format: fmt1, getGrade: g => g.extGrade, align: 'right', width: 44 },
  { key: 'stuff', label: 'Stuff+', getValue: g => g.stuffGrade, format: fmt0, getGrade: g => g.stuffGrade, align: 'center', width: 56 },
  { key: 'grade', label: 'Grade', getValue: g => g.scoutingGrade, align: 'center', width: 52 },
  { key: 'zone', label: 'Zone%', getValue: g => g.zoneRate, format: fmtPct, align: 'right', width: 56 },
  { key: 'chase', label: 'Chase%', getValue: g => g.chaseRate, format: fmtPct, align: 'right', width: 58 },
  { key: 'whiff', label: 'Whiff%', getValue: g => g.whiffRate, format: fmtPct, align: 'right', width: 58 },
  { key: 'csw', label: 'CSW%', getValue: g => g.cswRate, format: fmtPct, align: 'right', width: 56 },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  grades: PitchTypeGrade[];
  compact?: boolean;
  showBatterHandToggle?: boolean;
  onBatterHandChange?: (hand: 'all' | 'L' | 'R') => void;
  batterHand?: 'all' | 'L' | 'R';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PitchTypeGradeTable({
  grades,
  compact = false,
  showBatterHandToggle = false,
  onBatterHandChange,
  batterHand = 'all',
}: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!sortKey) return grades;
    const col = COLUMNS.find(c => c.key === sortKey);
    if (!col) return grades;
    return [...grades].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortAsc ? cmp : -cmp;
    });
  }, [grades, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Aggregate "All" row
  const allRow = useMemo(() => {
    if (grades.length === 0) return null;
    const total = grades.reduce((s, g) => s + g.count, 0);
    const weightedStuff = grades.reduce((s, g) => s + g.stuffGrade * g.count, 0) / total;
    return {
      count: total,
      stuffGrade: Math.round(weightedStuff),
      scoutingGrade: toScoutingGrade(Math.round(weightedStuff)),
    };
  }, [grades]);

  const fontSize = compact ? 11 : 12;
  const cellPadY = compact ? 4 : 6;
  const cellPadX = compact ? 4 : 6;

  return (
    <div>
      {/* Batter hand toggle */}
      {showBatterHandToggle && onBatterHandChange && (
        <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
          {(['all', 'L', 'R'] as const).map(h => (
            <button
              key={h}
              onClick={() => onBatterHandChange(h)}
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid',
                borderColor: batterHand === h ? '#4a9eff' : 'var(--border-plus)',
                borderRadius: 4,
                background: batterHand === h ? 'rgba(74,158,255,0.12)' : 'transparent',
                color: batterHand === h ? '#4a9eff' : 'var(--text-3)',
                cursor: 'pointer',
              }}
            >
              {h === 'all' ? 'All' : `vs ${h}HH`}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize,
          fontFamily: 'system-ui, sans-serif',
        }}>
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.key !== 'type' && handleSort(col.key)}
                  style={{
                    padding: `${cellPadY}px ${cellPadX}px`,
                    textAlign: col.align ?? 'right',
                    color: 'var(--text-3)',
                    fontSize: compact ? 10 : 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    borderBottom: '1px solid var(--border)',
                    cursor: col.key !== 'type' ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                    width: col.width,
                    userSelect: 'none',
                  }}
                >
                  {col.shortLabel ?? col.label}
                  {sortKey === col.key && (sortAsc ? ' \u25B2' : ' \u25BC')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(g => (
              <tr key={g.pitchType} style={{ borderBottom: '1px solid var(--bg-surface)' }}>
                {COLUMNS.map(col => {
                  const raw = col.getValue(g);
                  const grade = col.getGrade?.(g);
                  const display = col.format && typeof raw === 'number'
                    ? col.format(raw)
                    : raw != null ? String(raw) : '--';

                  // Cell background tinted by grade
                  const bgColor = grade != null
                    ? scoreColorContinuous(grade, 0.15)
                    : 'transparent';

                  // Special rendering for pitch name (with color dot)
                  if (col.key === 'type') {
                    return (
                      <td key={col.key} style={{
                        padding: `${cellPadY}px ${cellPadX}px`,
                        textAlign: 'left',
                        color: 'var(--text-1)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: pitchColor(g.pitchType),
                          marginRight: 6,
                          verticalAlign: 'middle',
                        }} />
                        {display}
                      </td>
                    );
                  }

                  // Special rendering for scouting grade
                  if (col.key === 'grade') {
                    const sg = g.scoutingGrade;
                    const label = SCOUTING_LABELS[sg] ?? '';
                    return (
                      <td key={col.key} style={{
                        padding: `${cellPadY}px ${cellPadX}px`,
                        textAlign: 'center',
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '1px 6px',
                          borderRadius: 3,
                          fontSize: compact ? 10 : 11,
                          fontWeight: 700,
                          background: scoreColorContinuous(g.stuffGrade, 0.2),
                          color: scoreColorContinuous(g.stuffGrade, 0.9),
                        }}>
                          {sg}
                        </span>
                        {!compact && (
                          <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>{label}</div>
                        )}
                      </td>
                    );
                  }

                  // Special rendering for stuff+
                  if (col.key === 'stuff') {
                    const letterGrade = numericGrade(g.stuffGrade);
                    return (
                      <td key={col.key} style={{
                        padding: `${cellPadY}px ${cellPadX}px`,
                        textAlign: 'center',
                        background: bgColor,
                      }}>
                        <span style={{
                          fontWeight: 700,
                          color: gradeColor(g.stuffGrade),
                          fontSize: compact ? 12 : 13,
                        }}>
                          {g.stuffGrade}
                        </span>
                        <span style={{
                          marginLeft: 3,
                          fontSize: 9,
                          color: gradeColor(g.stuffGrade),
                          opacity: 0.7,
                        }}>
                          {letterGrade}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td key={col.key} style={{
                      padding: `${cellPadY}px ${cellPadX}px`,
                      textAlign: col.align ?? 'right',
                      color: 'var(--text-2)',
                      background: bgColor,
                      fontFamily: typeof raw === 'number' ? 'monospace' : undefined,
                      whiteSpace: 'nowrap',
                    }}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* All row */}
            {allRow && (
              <tr style={{ borderTop: '2px solid var(--border-plus)' }}>
                <td style={{
                  padding: `${cellPadY}px ${cellPadX}px`,
                  fontWeight: 700,
                  color: 'var(--text-1)',
                  fontSize,
                }}>All</td>
                <td style={{ padding: `${cellPadY}px ${cellPadX}px`, textAlign: 'right', color: 'var(--text-2)', fontFamily: 'monospace' }}>
                  {allRow.count}
                </td>
                <td style={{ padding: `${cellPadY}px ${cellPadX}px`, textAlign: 'right', color: 'var(--text-3)' }}>100.0%</td>
                {/* Empty cells for physical metrics */}
                {COLUMNS.slice(3, 9).map(col => (
                  <td key={col.key} style={{ padding: `${cellPadY}px ${cellPadX}px`, color: 'var(--text-3)', textAlign: 'center' }}>--</td>
                ))}
                {/* Weighted stuff grade */}
                <td style={{
                  padding: `${cellPadY}px ${cellPadX}px`,
                  textAlign: 'center',
                  background: scoreColorContinuous(allRow.stuffGrade, 0.15),
                }}>
                  <span style={{ fontWeight: 700, color: gradeColor(allRow.stuffGrade), fontSize: compact ? 12 : 13 }}>
                    {allRow.stuffGrade}
                  </span>
                  <span style={{ marginLeft: 3, fontSize: 9, color: gradeColor(allRow.stuffGrade), opacity: 0.7 }}>
                    {numericGrade(allRow.stuffGrade)}
                  </span>
                </td>
                {/* Scouting grade */}
                <td style={{ padding: `${cellPadY}px ${cellPadX}px`, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: compact ? 10 : 11,
                    fontWeight: 700,
                    background: scoreColorContinuous(allRow.stuffGrade, 0.2),
                    color: scoreColorContinuous(allRow.stuffGrade, 0.9),
                  }}>
                    {allRow.scoutingGrade}
                  </span>
                </td>
                {/* Empty outcome cells */}
                {COLUMNS.slice(11).map(col => (
                  <td key={col.key} style={{ padding: `${cellPadY}px ${cellPadX}px`, color: 'var(--text-3)', textAlign: 'center' }}>--</td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
