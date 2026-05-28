import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { pitchColor } from '../data/constants';
import type { PitchType } from '../types';

interface Props {
  pitches: PitchType[];
  height?: number;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: PitchType;
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = pitchColor(payload.pitch_type);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={Math.max(5, Math.min(14, payload.usage_pct * 30))}
      fill={color}
      fillOpacity={0.75}
      stroke={color}
      strokeWidth={1.5}
    />
  );
}

interface TooltipPayloadItem {
  payload: PitchType;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const p = payload[0].payload as PitchType;
  const color = pitchColor(p.pitch_type);
  return (
    <div
      style={{
        background: '#1a1a2e',
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: '8px 12px',
        color: '#e0e0e8',
        fontSize: 13,
      }}
    >
      <div style={{ color, fontWeight: 700, marginBottom: 4 }}>
        {p.pitch_name} ({p.pitch_type})
      </div>
      <div>HBreak: {p.hb.toFixed(1)}"</div>
      <div>iVB: {p.ivb.toFixed(1)}"</div>
      <div>Velo: {p.velo.toFixed(1)} mph</div>
      <div>Usage: {(p.usage_pct * 100).toFixed(1)}%</div>
      <div>Whiff%: {(p.whiff_rate * 100).toFixed(1)}%</div>
    </div>
  );
}

// Group pitches by type for separate Scatter series (for legend)
export function PitchMovementChart({ pitches, height = 320 }: Props) {
  if (!pitches.length) {
    return (
      <div style={{ color: '#606080', textAlign: 'center', padding: 40 }}>
        No pitch data available
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid stroke="#1e1e2e" />
          <XAxis
            dataKey="hb"
            type="number"
            name="HBreak"
            label={{ value: 'Horizontal Break (in)', position: 'insideBottom', offset: -10, fill: '#a0a0b8', fontSize: 12 }}
            tick={{ fill: '#a0a0b8', fontSize: 11 }}
            domain={['auto', 'auto']}
          />
          <YAxis
            dataKey="ivb"
            type="number"
            name="iVB"
            label={{ value: 'iVB (in)', angle: -90, position: 'insideLeft', fill: '#a0a0b8', fontSize: 12 }}
            tick={{ fill: '#a0a0b8', fontSize: 11 }}
            domain={['auto', 'auto']}
          />
          <ReferenceLine x={0} stroke="#3a3a5a" strokeDasharray="3 3" />
          <ReferenceLine y={0} stroke="#3a3a5a" strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span style={{ color: '#a0a0b8', fontSize: 12 }}>{value}</span>}
          />
          {pitches.map((p) => (
            <Scatter
              key={p.pitch_type}
              name={p.pitch_name}
              data={[p]}
              fill={pitchColor(p.pitch_type)}
              shape={<CustomDot />}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <p style={{ textAlign: 'center', color: '#606080', fontSize: 12, marginTop: 4 }}>
        Bubble size = usage%. From pitcher's perspective.
      </p>
    </div>
  );
}
