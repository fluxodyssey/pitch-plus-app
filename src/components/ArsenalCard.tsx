import { pitchColor, scoreColorContinuous } from '../data/constants';
import type { ScoringConfig } from '../types';

interface PitchStats {
  pt: string;
  name: string;
  count: number;
  usagePct: number;
  avgVelo: number | null;
  avgSpin: number | null;
  avgIvb: number | null;
  avgHb: number | null;
  whiffRate: number | null;
  chaseRate: number | null;
}

interface Props {
  arsenal: PitchStats[];
  config: ScoringConfig | null;
}

interface StatBarProps {
  label: string;
  value: number | null;
  lgValue: number | undefined;
  format: (v: number) => string;
  higherIsBetter?: boolean;
}

function StatBar({ label, value, lgValue, format, higherIsBetter = true }: StatBarProps) {
  if (value == null) return null;

  let barWidth = 50;
  let barColor = '#8890a0';

  if (lgValue != null && lgValue > 0) {
    const diff = (value - lgValue) / Math.abs(lgValue);
    const good = higherIsBetter ? diff > 0 : diff < 0;
    const intensity = Math.min(Math.abs(diff) * 5, 1);
    // Map to score: 100 (neutral), good = higher, bad = lower
    const score = 100 + (good ? intensity * 50 : -intensity * 50);
    barColor = scoreColorContinuous(score, 0.7);
    barWidth = Math.min(95, 50 + Math.abs(diff) * 200);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18 }}>
      <span style={{ width: 48, fontSize: 10, color: '#606080', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: '#1a1a2e', borderRadius: 2, position: 'relative' }}>
        <div style={{
          height: '100%',
          width: `${barWidth}%`,
          background: barColor,
          borderRadius: 2,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ width: 50, fontSize: 11, color: '#a0a0b8', textAlign: 'right', fontFamily: 'monospace', flexShrink: 0 }}>
        {format(value)}
      </span>
    </div>
  );
}

export function ArsenalCards({ arsenal, config }: Props) {
  const lgAvgs = config?.league_averages ?? {};

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 10,
    }}>
      {arsenal.map((p) => {
        const lg = lgAvgs[p.pt] as Record<string, number> | undefined;
        const color = pitchColor(p.pt);

        return (
          <div
            key={p.pt}
            style={{
              background: '#14141f',
              border: '1px solid #1e1e2e',
              borderRadius: 8,
              padding: '12px 14px',
              borderTop: `3px solid ${color}`,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }} />
              <span style={{ color: '#e0e0e8', fontSize: 13, fontWeight: 600, flex: 1 }}>{p.name}</span>
              <span style={{ color: '#606080', fontSize: 11 }}>{p.pt}</span>
            </div>

            {/* Usage bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: '#606080', width: 48 }}>Usage</span>
              <div style={{ flex: 1, height: 6, background: '#1a1a2e', borderRadius: 3 }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(p.usagePct * 100, 100)}%`,
                  background: color,
                  borderRadius: 3,
                  opacity: 0.7,
                }} />
              </div>
              <span style={{ fontSize: 11, color: '#a0a0b8', fontFamily: 'monospace', width: 50, textAlign: 'right' }}>
                {(p.usagePct * 100).toFixed(1)}%
              </span>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <StatBar label="Velo" value={p.avgVelo} lgValue={lg?.avg_velo} format={(v) => `${v.toFixed(1)}`} />
              <StatBar label="Spin" value={p.avgSpin} lgValue={lg?.avg_spin} format={(v) => `${Math.round(v)}`} />
              <StatBar label="iVB" value={p.avgIvb} lgValue={lg?.avg_ivb} format={(v) => `${v.toFixed(1)}"`} />
              <StatBar label="HBreak" value={p.avgHb} lgValue={lg?.avg_hb} format={(v) => `${v.toFixed(1)}"`} />
              <StatBar label="Whiff%" value={p.whiffRate} lgValue={lg?.avg_whiff_rate} format={(v) => `${(v * 100).toFixed(1)}%`} />
              <StatBar label="Chase%" value={p.chaseRate} lgValue={lg?.avg_chase_rate} format={(v) => `${(v * 100).toFixed(1)}%`} />
            </div>

            {/* Count */}
            <div style={{ marginTop: 6, color: '#404060', fontSize: 10, textAlign: 'right' }}>
              {p.count} pitches
            </div>
          </div>
        );
      })}
    </div>
  );
}
