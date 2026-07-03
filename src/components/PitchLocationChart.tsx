import { useState, type ComponentProps } from 'react';
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

// Recharts' chart-event handlers pass an object with xValue/yValue (chart coords).
// We narrow once here so handler call sites stay type-safe.
type ChartMouseEvent = NonNullable<ComponentProps<typeof ScatterChart>['onMouseDown']>;
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
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const p = payload[0].payload as RawPitch;
  const color = pitchColor(p.pt);
  const result = p.wh ? 'Whiff' : p.ip ? 'In Play' : p.sw ? 'Swing' : 'Take';
  const zoneName = p.z >= 1 && p.z <= 9 ? 'In Zone' : p.z >= 11 && p.z <= 14 ? 'Edge' : 'Chase';

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: '8px 12px',
        color: 'var(--text-1)',
        fontSize: 12,
        minWidth: 160,
      }}
    >
      <div style={{ color, fontWeight: 700, marginBottom: 4 }}>
        {pitchTypeNames?.[p.pt] ?? p.ptm ?? p.pt}
        <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>({p.pt})</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
        <span style={{ color: 'var(--text-2)' }}>Velo</span>
        <span style={{ textAlign: 'right' }}>{p.v.toFixed(1)} mph</span>
        <span style={{ color: 'var(--text-2)' }}>Spin</span>
        <span style={{ textAlign: 'right' }}>{p.sp.toLocaleString()} rpm</span>
        <span style={{ color: 'var(--text-2)' }}>iVB</span>
        <span style={{ textAlign: 'right' }}>{p.ivb.toFixed(1)}"</span>
        <span style={{ color: 'var(--text-2)' }}>HBreak</span>
        <span style={{ textAlign: 'right' }}>{p.hb.toFixed(1)}"</span>
        <span style={{ color: 'var(--text-2)' }}>Zone</span>
        <span style={{ textAlign: 'right' }}>{zoneName} ({p.z})</span>
        <span style={{ color: 'var(--text-2)' }}>Count</span>
        <span style={{ textAlign: 'right' }}>{p.b}-{p.s}</span>
      </div>
      <div style={{ marginTop: 4, borderTop: '1px solid var(--border-plus)', paddingTop: 4 }}>
        <div style={{ color: result === 'Whiff' ? '#d44040' : 'var(--text-2)', fontWeight: 600 }}>{result}</div>
        {p.bn && <div style={{ color: 'var(--text-3)', fontSize: 11 }}>vs {p.bn} ({p.bh})</div>}
        {p.desc && <div style={{ color: 'var(--text-3)', fontSize: 11 }}>{p.desc}</div>}
      </div>
    </div>
  );
}

// Default axis bounds
const DEFAULT_X: [number, number] = [-2.5, 2.5];
const DEFAULT_Y: [number, number] = [0, 5];

export function PitchLocationChart({
  pitches,
  pitchTypeNames,
  height = 380,
  highlightedPitchTypes,
  onPitchTypeClick,
}: Props) {
  const [xDomain, setXDomain] = useState<[number, number]>(DEFAULT_X);
  const [yDomain, setYDomain] = useState<[number, number]>(DEFAULT_Y);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const isZoomed = xDomain[0] !== DEFAULT_X[0] || xDomain[1] !== DEFAULT_X[1]
    || yDomain[0] !== DEFAULT_Y[0] || yDomain[1] !== DEFAULT_Y[1];

  // Group pitches by type for separate scatter series
  const typeMap = new Map<string, RawPitch[]>();
  for (const p of pitches) {
    if (!typeMap.has(p.pt)) typeMap.set(p.pt, []);
    typeMap.get(p.pt)!.push(p);
  }

  const types = Array.from(typeMap.keys()).sort();

  if (pitches.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
        No pitch location data available
      </div>
    );
  }

  const resetZoom = () => {
    setXDomain(DEFAULT_X);
    setYDomain(DEFAULT_Y);
    setDragStart(null);
    setDragCurrent(null);
  };

  // Recharts selection zoom: use ReferenceArea during drag
  const handleMouseDown = (e: { xValue?: number; yValue?: number }) => {
    if (e.xValue == null || e.yValue == null) return;
    setDragStart({ x: e.xValue, y: e.yValue });
    setDragCurrent({ x: e.xValue, y: e.yValue });
  };

  const handleMouseMove = (e: { xValue?: number; yValue?: number }) => {
    if (!dragStart || e.xValue == null || e.yValue == null) return;
    setDragCurrent({ x: e.xValue, y: e.yValue });
  };

  const handleMouseUp = () => {
    if (dragStart && dragCurrent) {
      const x1 = Math.min(dragStart.x, dragCurrent.x);
      const x2 = Math.max(dragStart.x, dragCurrent.x);
      const y1 = Math.min(dragStart.y, dragCurrent.y);
      const y2 = Math.max(dragStart.y, dragCurrent.y);
      // Only zoom if selection is meaningful
      if (x2 - x1 > 0.1 && y2 - y1 > 0.1) {
        setXDomain([x1, x2]);
        setYDomain([y1, y2]);
      }
    }
    setDragStart(null);
    setDragCurrent(null);
  };

  return (
    <div className="pitch-location-chart">
      {/* Zoom controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4, gap: 8 }}>
        {isZoomed && (
          <button
            onClick={resetZoom}
            style={{
              padding: '3px 8px', fontSize: 11, borderRadius: 4,
              border: '1px solid var(--border-plus)', background: 'transparent',
              color: 'var(--text-2)', cursor: 'pointer',
            }}
          >
            ↺ Reset zoom
          </button>
        )}
        {!isZoomed && (
          <span style={{ fontSize: 10, color: 'var(--text-4)' }}>Drag to zoom</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart
          margin={{ top: 10, right: 20, bottom: 30, left: 20 }}
          onMouseDown={handleMouseDown as ChartMouseEvent}
          onMouseMove={handleMouseMove as ChartMouseEvent}
          onMouseUp={handleMouseUp}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
          <XAxis
            dataKey="px"
            type="number"
            name="Plate X"
            domain={xDomain}
            label={{ value: 'Plate X (ft)', position: 'insideBottom', offset: -10, fill: 'var(--text-2)', fontSize: 12 }}
            tick={{ fill: 'var(--text-2)', fontSize: 11 }}
          />
          <YAxis
            dataKey="pz"
            type="number"
            name="Plate Z"
            domain={yDomain}
            label={{ value: 'Plate Z (ft)', angle: -90, position: 'insideLeft', fill: 'var(--text-2)', fontSize: 12 }}
            tick={{ fill: 'var(--text-2)', fontSize: 11 }}
          />
          {/* Strike zone */}
          <ReferenceArea
            x1={-0.83} x2={0.83} y1={1.5} y2={3.5}
            stroke="#4a9eff" strokeWidth={1.5} strokeDasharray="4 2"
            fill="rgba(74,158,255,0.04)"
          />
          <ReferenceLine x={0} stroke="var(--border-plus)" strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip {...(pitchTypeNames && { pitchTypeNames })} />} />

          {/* Zoom selection overlay */}
          {dragStart && dragCurrent && (
            <ReferenceArea
              x1={Math.min(dragStart.x, dragCurrent.x)}
              x2={Math.max(dragStart.x, dragCurrent.x)}
              y1={Math.min(dragStart.y, dragCurrent.y)}
              y2={Math.max(dragStart.y, dragCurrent.y)}
              stroke="#4a9eff"
              fill="rgba(74,158,255,0.1)"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
          )}

          {types.map((pt) => (
            <Scatter
              key={pt}
              name={pitchTypeNames?.[pt] ?? pt}
              data={typeMap.get(pt)!}
              fill={pitchColor(pt)}
              shape={<PitchDot {...(highlightedPitchTypes && { highlightedTypes: highlightedPitchTypes })} />}
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
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                color: isActive ? 'var(--text-1)' : 'var(--text-4)',
                cursor: onPitchTypeClick ? 'pointer' : 'default',
                padding: '2px 6px', borderRadius: 4,
                background: isActive && highlightedPitchTypes?.length ? 'rgba(74,158,255,0.1)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: pitchColor(pt), display: 'inline-block', opacity: isActive ? 1 : 0.3 }} />
              {pitchTypeNames?.[pt] ?? pt}
            </span>
          );
        })}
      </div>
    </div>
  );
}
