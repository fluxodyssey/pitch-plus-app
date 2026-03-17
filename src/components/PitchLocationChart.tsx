import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { pitchColor } from '../data/constants';
import type { RawPitch } from '../types';

interface Props {
  pitches: RawPitch[];
  pitchTypeNames?: Record<string, string>;
  height?: number;
  highlightedPitchTypes?: string[];
  onPitchTypeClick?: (pitchType: string) => void;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: RawPitch;
  highlightedTypes?: string[];
}

function PitchDot({ cx, cy, payload, highlightedTypes }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = pitchColor(payload.pt);
  const highlighted = !highlightedTypes?.length || highlightedTypes.includes(payload.pt);
  const opacity = highlighted
    ? (payload.wh ? 1.0 : payload.sw ? 0.8 : 0.45)
    : 0.08;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={highlighted ? 4 : 3}
      fill={color}
      fillOpacity={opacity}
      stroke={color}
      strokeWidth={0.5}
      strokeOpacity={opacity}
    />
  );
}

interface TooltipItem {
  payload?: RawPitch;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipItem[];
  pitchTypeNames?: Record<string, string>;
}

function CustomTooltip({ active, payload, pitchTypeNames }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const p = payload[0].payload as RawPitch;
  const color = pitchColor(p.pt);
  const result = p.wh ? 'Whiff' : p.ip ? 'In Play' : p.sw ? 'Swing' : 'Take';
  const zoneName = p.z >= 1 && p.z <= 9 ? 'In Zone' : p.z >= 11 && p.z <= 14 ? 'Edge' : 'Chase';

  return (
    <div
      style={{
        background: '#1a1a2e',
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: '8px 12px',
        color: '#e0e0e8',
        fontSize: 12,
        minWidth: 160,
      }}
    >
      <div style={{ color, fontWeight: 700, marginBottom: 4 }}>
        {pitchTypeNames?.[p.pt] ?? p.ptm ?? p.pt}
        <span style={{ color: '#606080', fontWeight: 400, marginLeft: 6 }}>({p.pt})</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
        <span style={{ color: '#a0a0b8' }}>Velo</span>
        <span style={{ textAlign: 'right' }}>{p.v.toFixed(1)} mph</span>
        <span style={{ color: '#a0a0b8' }}>Spin</span>
        <span style={{ textAlign: 'right' }}>{p.sp.toLocaleString()} rpm</span>
        <span style={{ color: '#a0a0b8' }}>iVB</span>
        <span style={{ textAlign: 'right' }}>{p.ivb.toFixed(1)}"</span>
        <span style={{ color: '#a0a0b8' }}>HBreak</span>
        <span style={{ textAlign: 'right' }}>{p.hb.toFixed(1)}"</span>
        <span style={{ color: '#a0a0b8' }}>Zone</span>
        <span style={{ textAlign: 'right' }}>{zoneName} ({p.z})</span>
        <span style={{ color: '#a0a0b8' }}>Count</span>
        <span style={{ textAlign: 'right' }}>{p.b}-{p.s}</span>
      </div>
      <div style={{ marginTop: 4, borderTop: '1px solid #2a2a3e', paddingTop: 4 }}>
        <div style={{ color: result === 'Whiff' ? '#d44040' : '#a0a0b8', fontWeight: 600 }}>{result}</div>
        {p.bn && <div style={{ color: '#606080', fontSize: 11 }}>vs {p.bn} ({p.bh})</div>}
        {p.desc && <div style={{ color: '#606080', fontSize: 11 }}>{p.desc}</div>}
      </div>
    </div>
  );
}

export function PitchLocationChart({
  pitches,
  pitchTypeNames,
  height = 380,
  highlightedPitchTypes,
  onPitchTypeClick,
}: Props) {
  // Group pitches by type for separate scatter series
  const typeMap = new Map<string, RawPitch[]>();
  for (const p of pitches) {
    if (!typeMap.has(p.pt)) typeMap.set(p.pt, []);
    typeMap.get(p.pt)!.push(p);
  }

  const types = Array.from(typeMap.keys()).sort();

  if (pitches.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#606080',
        }}
      >
        No pitch location data available
      </div>
    );
  }

  return (
    <div className="pitch-location-chart">
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="2 2" />
          <XAxis
            dataKey="px"
            type="number"
            name="Plate X"
            domain={[-2.5, 2.5]}
            ticks={[-2, -1, 0, 1, 2]}
            label={{
              value: 'Plate X (ft)',
              position: 'insideBottom',
              offset: -10,
              fill: '#a0a0b8',
              fontSize: 12,
            }}
            tick={{ fill: '#a0a0b8', fontSize: 11 }}
          />
          <YAxis
            dataKey="pz"
            type="number"
            name="Plate Z"
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
            label={{
              value: 'Plate Z (ft)',
              angle: -90,
              position: 'insideLeft',
              fill: '#a0a0b8',
              fontSize: 12,
            }}
            tick={{ fill: '#a0a0b8', fontSize: 11 }}
          />
          {/* Strike zone */}
          <ReferenceArea
            x1={-0.83}
            x2={0.83}
            y1={1.5}
            y2={3.5}
            stroke="#4a9eff"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            fill="rgba(74,158,255,0.04)"
          />
          <ReferenceLine x={0} stroke="#2a2a3e" strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip pitchTypeNames={pitchTypeNames} />} />
          {types.map((pt) => (
            <Scatter
              key={pt}
              name={pitchTypeNames?.[pt] ?? pt}
              data={typeMap.get(pt)!}
              fill={pitchColor(pt)}
              shape={<PitchDot highlightedTypes={highlightedPitchTypes} />}
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
                color: isActive ? '#e0e0e8' : '#404060',
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
              {pitchTypeNames?.[pt] ?? pt}
            </span>
          );
        })}
      </div>
    </div>
  );
}
