import { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { pitchColor } from '../data/constants';
import { PitchLocationChart } from './PitchLocationChart';
import { PitchHeatmap } from './PitchHeatmap';
import type { RawPitch, ScoringConfig } from '../types';

interface Props {
  pitches: RawPitch[];
  config: ScoringConfig | null;
  pitchTypeNames: Record<string, string>;
  title?: string;
  highlightedPitchTypes?: string[];
  onPitchTypeClick?: (pitchType: string) => void;
}

interface PitchTypeSummary {
  pt: string;
  name: string;
  count: number;
  usagePct: number;
  avgVelo: number | null;
  avgSpin: number | null;
  avgIvb: number | null;
  avgHb: number | null;
  whiffRate: number | null;
  zoneRate: number | null;
  chaseRate: number | null;
  avgExt: number | null;
}

function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeArsenal(pitches: RawPitch[], pitchTypeNames: Record<string, string>): PitchTypeSummary[] {
  const typeMap = new Map<string, RawPitch[]>();
  for (const p of pitches) {
    if (!typeMap.has(p.pt)) typeMap.set(p.pt, []);
    typeMap.get(p.pt)!.push(p);
  }

  const total = pitches.length;

  return Array.from(typeMap.entries())
    .map(([pt, ps]) => {
      const swings = ps.filter((p) => p.sw);
      const whiffs = ps.filter((p) => p.wh);
      const inZone = ps.filter((p) => p.z >= 1 && p.z <= 9);
      const outZone = ps.filter((p) => p.z > 9);
      return {
        pt,
        name: pitchTypeNames[pt] ?? pt,
        count: ps.length,
        usagePct: ps.length / total,
        avgVelo: mean(ps.filter((p) => p.v > 0).map((p) => p.v)),
        avgSpin: mean(ps.filter((p) => p.sp > 0).map((p) => p.sp)),
        avgIvb: mean(ps.map((p) => p.ivb)),
        avgHb: mean(ps.map((p) => p.hb)),
        avgExt: mean(ps.filter((p) => p.ext > 0).map((p) => p.ext)),
        whiffRate: swings.length > 0 ? whiffs.length / swings.length : null,
        zoneRate: ps.length > 0 ? inZone.length / ps.length : null,
        chaseRate: outZone.length > 0 ? outZone.filter((p) => p.sw).length / outZone.length : null,
      };
    })
    .sort((a, b) => b.count - a.count);
}

function cellBg(
  value: number | null,
  lgValue: number | null | undefined,
  higher: boolean,
  threshold = 0.03
): string {
  if (value == null || lgValue == null || lgValue === 0) return 'transparent';
  const rel = (value - lgValue) / Math.abs(lgValue);
  const good = higher ? rel > threshold : rel < -threshold;
  const bad = higher ? rel < -threshold : rel > threshold;
  const intensity = Math.min(Math.abs(rel) * 4, 1);
  if (good) return `rgba(212,64,64,${intensity * 0.35})`;
  if (bad) return `rgba(58,80,128,${intensity * 0.35})`;
  return 'transparent';
}

interface MovementDotProps {
  cx?: number;
  cy?: number;
  payload?: RawPitch;
  highlightedTypes?: string[];
}

function MovementDot({ cx, cy, payload, highlightedTypes }: MovementDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = pitchColor(payload.pt);
  const highlighted = !highlightedTypes?.length || highlightedTypes.includes(payload.pt);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={highlighted ? 3.5 : 2.5}
      fill={color}
      fillOpacity={highlighted ? 0.7 : 0.08}
      stroke={color}
      strokeWidth={0.5}
      strokeOpacity={highlighted ? 0.7 : 0.08}
    />
  );
}

interface MvTooltipItem {
  payload?: RawPitch;
}
interface MvTooltipProps {
  active?: boolean;
  payload?: MvTooltipItem[];
}
function MovementTooltip({ active, payload }: MvTooltipProps) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const p = payload[0].payload as RawPitch;
  const color = pitchColor(p.pt);
  const result = p.wh ? 'Whiff' : p.ip ? 'In Play' : p.sw ? 'Swing' : 'Take';
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: '8px 12px',
        color: 'var(--text-1)',
        fontSize: 12,
        minWidth: 140,
      }}
    >
      <div style={{ color, fontWeight: 700, marginBottom: 4 }}>{p.ptm ?? p.pt}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
        <span style={{ color: 'var(--text-2)' }}>iVB</span>
        <span style={{ textAlign: 'right' }}>{p.ivb.toFixed(1)}"</span>
        <span style={{ color: 'var(--text-2)' }}>HBreak</span>
        <span style={{ textAlign: 'right' }}>{p.hb.toFixed(1)}"</span>
        <span style={{ color: 'var(--text-2)' }}>Velo</span>
        <span style={{ textAlign: 'right' }}>{p.v.toFixed(1)} mph</span>
        <span style={{ color: 'var(--text-2)' }}>Spin</span>
        <span style={{ textAlign: 'right' }}>{p.sp.toLocaleString()}</span>
      </div>
      <div style={{ marginTop: 3, color: result === 'Whiff' ? '#d44040' : 'var(--text-3)', fontSize: 11 }}>{result}</div>
    </div>
  );
}

export function GameSummary({ pitches, config, pitchTypeNames, title, highlightedPitchTypes, onPitchTypeClick }: Props) {
  const [locationView, setLocationView] = useState<'scatter' | 'density' | 'whiff'>('scatter');
  const arsenal = computeArsenal(pitches, pitchTypeNames);
  const lgAvgs = config?.league_averages ?? {};

  // Aggregate "All" summary
  const allSwings = pitches.filter((p) => p.sw);
  const allWhiffs = pitches.filter((p) => p.wh);
  const allInZone = pitches.filter((p) => p.z >= 1 && p.z <= 9);
  const allOutZone = pitches.filter((p) => p.z > 9);

  const allSummary = {
    pt: 'ALL',
    name: 'All Pitches',
    count: pitches.length,
    usagePct: 1,
    avgVelo: mean(pitches.filter((p) => p.v > 0).map((p) => p.v)),
    avgSpin: mean(pitches.filter((p) => p.sp > 0).map((p) => p.sp)),
    avgIvb: mean(pitches.map((p) => p.ivb)),
    avgHb: mean(pitches.map((p) => p.hb)),
    avgExt: mean(pitches.filter((p) => p.ext > 0).map((p) => p.ext)),
    whiffRate: allSwings.length > 0 ? allWhiffs.length / allSwings.length : null,
    zoneRate: pitches.length > 0 ? allInZone.length / pitches.length : null,
    chaseRate: allOutZone.length > 0 ? allOutZone.filter((p) => p.sw).length / allOutZone.length : null,
  };

  const thStyle = {
    padding: '7px 8px',
    color: 'var(--text-2)',
    borderBottom: '2px solid var(--border)',
    background: 'var(--bg-input)',
    fontWeight: 500 as const,
    fontSize: 11,
    whiteSpace: 'nowrap' as const,
  };

  const tdNum = (
    value: number | null,
    fmt: (v: number) => string,
  ) => {
    const bg = 'transparent';
    return (
      <td
        style={{
          padding: '6px 8px',
          textAlign: 'right',
          color: value != null ? 'var(--text-1)' : 'var(--text-4)',
          background: bg,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {value != null ? fmt(value) : '—'}
      </td>
    );
  };

  // Group pitches by type for movement chart
  const typeMap = new Map<string, RawPitch[]>();
  for (const p of pitches) {
    if (!typeMap.has(p.pt)) typeMap.set(p.pt, []);
    typeMap.get(p.pt)!.push(p);
  }
  const types = Array.from(typeMap.keys()).sort();

  if (pitches.length === 0) {
    return (
      <div className="game-summary">
        <div style={{ color: 'var(--text-3)', padding: 20, textAlign: 'center' }}>
          No pitches match the current filters.
        </div>
      </div>
    );
  }

  return (
    <div className="game-summary">
      {title && <h3 className="card-title">{title}</h3>}

      {/* Arsenal Table */}
      <div className="arsenal-table">
        <h4 style={{ color: '#c0c0d8', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Arsenal Breakdown
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { label: 'Pitch', align: 'left' as const },
                  { label: '#', align: 'right' as const },
                  { label: 'Usage%', align: 'right' as const },
                  { label: 'Velo', align: 'right' as const },
                  { label: 'Spin', align: 'right' as const },
                  { label: 'iVB', align: 'right' as const },
                  { label: 'HBreak', align: 'right' as const },
                  { label: 'Ext', align: 'right' as const },
                  { label: 'Whiff%', align: 'right' as const },
                  { label: 'Zone%', align: 'right' as const },
                  { label: 'Chase%', align: 'right' as const },
                ].map(({ label, align }) => (
                  <th key={label} style={{ ...thStyle, textAlign: align }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {arsenal.map((row) => {
                const lg = lgAvgs[row.pt];
                function diffBg(val: number | null, lgVal: number | null | undefined, higher: boolean) {
                  return cellBg(val, lgVal ?? null, higher);
                }
                return (
                  <tr key={row.pt} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: pitchColor(row.pt),
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: 'var(--text-1)', fontSize: 12 }}>{row.name}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: 10 }}>({row.pt})</span>
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-2)', fontSize: 12 }}>
                      {row.count}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-2)', fontSize: 12 }}>
                      {(row.usagePct * 100).toFixed(1)}%
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        background: diffBg(row.avgVelo, lg?.avg_velo, true),
                      }}
                    >
                      {row.avgVelo != null ? row.avgVelo.toFixed(1) : '—'}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        background: diffBg(row.avgSpin, lg?.avg_spin, true),
                      }}
                    >
                      {row.avgSpin != null ? Math.round(row.avgSpin).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-1)', fontSize: 12, fontFamily: 'monospace' }}>
                      {row.avgIvb != null ? row.avgIvb.toFixed(1) : '—'}"
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-1)', fontSize: 12, fontFamily: 'monospace' }}>
                      {row.avgHb != null ? row.avgHb.toFixed(1) : '—'}"
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        background: diffBg(row.avgExt, lg?.avg_ext, true),
                      }}
                    >
                      {row.avgExt != null ? row.avgExt.toFixed(2) : '—'}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        background: diffBg(row.whiffRate, lg?.avg_whiff_rate, true),
                      }}
                    >
                      {row.whiffRate != null ? `${(row.whiffRate * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        background: diffBg(row.zoneRate, lg?.avg_zone_rate, true),
                      }}
                    >
                      {row.zoneRate != null ? `${(row.zoneRate * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        textAlign: 'right',
                        color: 'var(--text-1)',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        background: diffBg(row.chaseRate, lg?.avg_chase_rate, true),
                      }}
                    >
                      {row.chaseRate != null ? `${(row.chaseRate * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
              {/* All row */}
              <tr style={{ borderTop: '2px solid var(--border-plus)', background: 'var(--bg-input)' }}>
                <td style={{ padding: '6px 8px', color: '#c0c0d8', fontSize: 12, fontWeight: 600 }}>All</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-2)', fontSize: 12 }}>
                  {allSummary.count}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-2)', fontSize: 12 }}>
                  100.0%
                </td>
                {tdNum(allSummary.avgVelo, (v) => v.toFixed(1))}
                {tdNum(allSummary.avgSpin, (v) => Math.round(v).toLocaleString())}
                {tdNum(allSummary.avgIvb, (v) => `${v.toFixed(1)}`)}
                {tdNum(allSummary.avgHb, (v) => `${v.toFixed(1)}`)}
                {tdNum(allSummary.avgExt, (v) => v.toFixed(2))}
                {tdNum(allSummary.whiffRate, (v) => `${(v * 100).toFixed(1)}%`)}
                {tdNum(allSummary.zoneRate, (v) => `${(v * 100).toFixed(1)}%`)}
                {tdNum(allSummary.chaseRate, (v) => `${(v * 100).toFixed(1)}%`)}
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ color: 'var(--text-4)', fontSize: 10, marginTop: 6 }}>
          Cell shading vs league average for that pitch type (red = better, blue = worse)
        </p>
      </div>

      {/* Charts row */}
      <div className="two-col" style={{ marginTop: 16 }}>
        {/* Pitch Location */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h4 style={{ color: '#c0c0d8', fontSize: 13, fontWeight: 600, margin: 0 }}>
              Pitch Location
            </h4>
            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
              {([
                { key: 'scatter', label: 'Scatter' },
                { key: 'density', label: 'Density' },
                { key: 'whiff', label: 'Whiff%' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setLocationView(key)}
                  style={{
                    padding: '2px 8px',
                    fontSize: 10,
                    fontWeight: locationView === key ? 600 : 400,
                    border: `1px solid ${locationView === key ? '#4a9eff' : 'var(--border-plus)'}`,
                    borderRadius: 4,
                    background: locationView === key ? 'rgba(74,158,255,0.15)' : 'transparent',
                    color: locationView === key ? '#4a9eff' : 'var(--text-3)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {locationView === 'scatter' ? (
            <PitchLocationChart
              pitches={pitches}
              pitchTypeNames={pitchTypeNames}
              height={340}
              {...(highlightedPitchTypes && { highlightedPitchTypes })}
              {...(onPitchTypeClick && { onPitchTypeClick })}
            />
          ) : (
            <PitchHeatmap
              pitches={pitches}
              colorBy={locationView === 'whiff' ? 'whiffRate' : 'density'}
              height={340}
            />
          )}
        </div>

        {/* Movement Chart (individual pitches) */}
        <div>
          <h4 style={{ color: '#c0c0d8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Pitch Movement
          </h4>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
              <XAxis
                dataKey="hb"
                type="number"
                name="HBreak"
                domain={['auto', 'auto']}
                label={{
                  value: 'Horizontal Break (in)',
                  position: 'insideBottom',
                  offset: -10,
                  fill: 'var(--text-2)',
                  fontSize: 12,
                }}
                tick={{ fill: 'var(--text-2)', fontSize: 11 }}
              />
              <YAxis
                dataKey="ivb"
                type="number"
                name="iVB"
                domain={['auto', 'auto']}
                label={{
                  value: 'iVB (in)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: 'var(--text-2)',
                  fontSize: 12,
                }}
                tick={{ fill: 'var(--text-2)', fontSize: 11 }}
              />
              <ReferenceLine x={0} stroke="#3a3a5a" strokeDasharray="3 3" />
              <ReferenceLine y={0} stroke="#3a3a5a" strokeDasharray="3 3" />
              <Tooltip content={<MovementTooltip />} />
              {types.map((pt) => (
                <Scatter
                  key={pt}
                  name={pitchTypeNames[pt] ?? pt}
                  data={typeMap.get(pt)!}
                  fill={pitchColor(pt)}
                  shape={<MovementDot {...(highlightedPitchTypes && { highlightedTypes: highlightedPitchTypes })} />}
                  isAnimationActive={false}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            {types.map((pt) => {
              const isActive = !highlightedPitchTypes?.length || highlightedPitchTypes.includes(pt);
              return (
                <span
                  key={pt}
                  onClick={() => onPitchTypeClick?.(pt)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    color: isActive ? 'var(--text-1)' : 'var(--text-4)',
                    cursor: onPitchTypeClick ? 'pointer' : 'default',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isActive && highlightedPitchTypes?.length ? 'rgba(74,158,255,0.1)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: pitchColor(pt),
                      display: 'inline-block',
                      opacity: isActive ? 1 : 0.3,
                    }}
                  />
                  {pitchTypeNames[pt] ?? pt}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
