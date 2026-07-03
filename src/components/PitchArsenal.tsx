import { pitchColor, scoreColorContinuous } from '../data/constants';
import { PitchHeatmap } from './PitchHeatmap';
import { AttributeGauges } from './AttributeGauges';
import type { RawPitch, PitchType, ScoringConfig, AttributeGrades } from '../types';

interface Props {
  pitches: RawPitch[];
  pitchTypes: PitchType[];
  config: ScoringConfig | null;
  pitchTypeNames: Record<string, string>;
  onPitchTypeClick?: (pt: string) => void;
  highlightedTypes?: string[];
  attributesByType?: Record<string, AttributeGrades> | null;
}

export function PitchArsenal({ pitches, pitchTypes, config, pitchTypeNames, onPitchTypeClick, highlightedTypes, attributesByType }: Props) {
  const lgAvgs = config?.league_averages ?? {};

  // Build per-pitch-type pitch arrays from raw pitches
  const typeMap = new Map<string, RawPitch[]>();
  for (const p of pitches) {
    if (!typeMap.has(p.pt)) typeMap.set(p.pt, []);
    typeMap.get(p.pt)!.push(p);
  }

  // Use pitchTypes for ordering and metadata; fallback to raw types
  const displayTypes = pitchTypes.length > 0
    ? pitchTypes.sort((a, b) => b.usage_pct - a.usage_pct)
    : Array.from(typeMap.keys()).map((pt) => {
        const ps = typeMap.get(pt)!;
        const sw = ps.filter((p) => p.sw);
        const wh = ps.filter((p) => p.wh);
        return {
          pitch_type: pt,
          pitch_name: pitchTypeNames[pt] ?? pt,
          n: ps.length,
          usage_pct: ps.length / pitches.length,
          velo: ps.reduce((s, p) => s + p.v, 0) / ps.length,
          spin: ps.reduce((s, p) => s + p.sp, 0) / ps.length,
          ivb: ps.reduce((s, p) => s + p.ivb, 0) / ps.length,
          hb: ps.reduce((s, p) => s + p.hb, 0) / ps.length,
          ext: ps.reduce((s, p) => s + p.ext, 0) / ps.length,
          perc_velo: ps.reduce((s, p) => s + p.v, 0) / ps.length,
          whiff_rate: sw.length > 0 ? wh.length / sw.length : 0,
        };
      });

  if (displayTypes.length === 0) return null;

  // Usage summary line
  const summaryLine = displayTypes
    .map((pt) => (
      <span key={pt.pitch_type} style={{ color: pitchColor(pt.pitch_type) }}>
        {pt.pitch_name} ({(pt.usage_pct * 100).toFixed(1)}%)
      </span>
    ));

  return (
    <div>
      {/* Summary line */}
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
        {summaryLine.reduce<React.ReactNode[]>((acc, el, i) => {
          if (i > 0) acc.push(<span key={`sep-${i}`} style={{ color: 'var(--text-4)' }}>·</span>);
          acc.push(el);
          return acc;
        }, [])}
      </p>

      {/* Cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 12,
      }}>
        {displayTypes.map((pt) => {
          const color = pitchColor(pt.pitch_type);
          const typePitches = typeMap.get(pt.pitch_type) ?? [];
          const lg = lgAvgs[pt.pitch_type] as Record<string, number> | undefined;
          const isHighlighted = !highlightedTypes?.length || highlightedTypes.includes(pt.pitch_type);
          const attrs = attributesByType?.[pt.pitch_type];

          function statRow(label: string, val: number | null, lgVal: number | undefined, fmt: (v: number) => string, higherGood = true) {
            if (val == null) return null;
            let diffPct = 0;
            let good = false;
            if (lgVal && lgVal > 0) {
              diffPct = (val - lgVal) / Math.abs(lgVal);
              good = higherGood ? diffPct > 0.02 : diffPct < -0.02;
            }
            const diffColor = !lgVal ? 'var(--text-3)' : Math.abs(diffPct) < 0.02 ? 'var(--text-3)' : good ? '#c85a5a' : '#4a6494';
            const diffStr = lgVal ? ` (${diffPct > 0 ? '+' : ''}${(diffPct * 100).toFixed(0)}%)` : '';
            return (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: diffColor }}>
                  {fmt(val)}
                  {lgVal && <span style={{ fontSize: 10, opacity: 0.7 }}>{diffStr}</span>}
                </span>
              </div>
            );
          }

          return (
            <div
              key={pt.pitch_type}
              onClick={() => onPitchTypeClick?.(pt.pitch_type)}
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${isHighlighted ? 'var(--border-plus)' : 'var(--bg-elevated)'}`,
                borderTop: `3px solid ${color}`,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: onPitchTypeClick ? 'pointer' : 'default',
                opacity: isHighlighted ? 1 : 0.45,
                transition: 'opacity 0.15s, border-color 0.15s',
              }}
            >
              {/* Header */}
              <div style={{ padding: '10px 12px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ color, fontSize: 14, fontWeight: 700 }}>{pt.pitch_name}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 1 }}>
                    {pt.n.toLocaleString()} pitches · {(pt.usage_pct * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{
                    background: `${color}20`,
                    border: `1px solid ${color}40`,
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: 10,
                    color,
                    fontWeight: 700,
                  }}>
                    {pt.pitch_type}
                  </span>
                  {attrs && (
                    <span style={{
                      background: scoreColorContinuous(attrs.overall, 0.15),
                      border: `1px solid ${scoreColorContinuous(attrs.overall, 0.4)}`,
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: scoreColorContinuous(attrs.overall, 1),
                    }}>
                      {Math.round(attrs.overall)}
                    </span>
                  )}
                </div>
              </div>

              {/* Attribute Grades (if available) */}
              {attrs && (
                <div style={{ padding: '4px 12px 8px', borderBottom: '1px solid var(--bg-elevated)' }}>
                  <AttributeGauges attrs={attrs} compact />
                </div>
              )}

              {/* Heatmap */}
              {typePitches.length > 5 && (
                <div style={{ padding: '6px 12px 8px', display: 'flex', justifyContent: 'center' }}>
                  <PitchHeatmap pitches={typePitches} colorBy="density" width={216} height={180} />
                </div>
              )}

              {/* Stats */}
              <div style={{ padding: '6px 12px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {statRow('Velo', pt.velo, lg?.velo, (v) => `${v.toFixed(1)} mph`)}
                {statRow('Spin', pt.spin, lg?.avg_spin, (v) => `${Math.round(v)} rpm`)}
                {statRow('iVB', pt.ivb, lg?.avg_ivb, (v) => `${v.toFixed(1)}"`, false)}
                {statRow('HBreak', pt.hb, lg?.avg_hb, (v) => `${v.toFixed(1)}"`)}
                {statRow('Whiff%', pt.whiff_rate, lg?.avg_whiff_rate, (v) => `${(v * 100).toFixed(1)}%`)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
