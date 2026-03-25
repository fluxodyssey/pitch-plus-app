import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DIMENSION_LABELS } from '../data/constants';
import type { DimensionKey } from '../types';

interface DimensionData {
  dimension: DimensionKey;
  score: number;
}

interface CIBand {
  p10: number;
  p90: number;
}

interface Props {
  dimensions: DimensionData[];
  color?: string;
  secondaryDimensions?: DimensionData[];
  secondaryColor?: string;
  secondaryLabel?: string;
  height?: number;
  /** Per-dimension bootstrap CI bands — rendered as dashed p10/p90 polygons */
  ciBands?: Partial<Record<DimensionKey, CIBand>>;
}

const RADAR_MIN = 60;
const RADAR_MAX = 140;

function normalize(score: number): number {
  return Math.max(RADAR_MIN, Math.min(RADAR_MAX, score));
}

export function DimensionRadarChart({
  dimensions,
  color = '#4a9eff',
  secondaryDimensions,
  secondaryColor = '#ffd54f',
  secondaryLabel = 'League Avg',
  height = 320,
  ciBands,
}: Props) {
  const hasCi = ciBands != null && Object.keys(ciBands).length > 0;

  const data = dimensions.map((d) => ({
    subject: DIMENSION_LABELS[d.dimension],
    value:   normalize(d.score),
    fullMark: RADAR_MAX,
    rawScore: d.score,
    secondary: secondaryDimensions
      ? normalize(secondaryDimensions.find((s) => s.dimension === d.dimension)?.score ?? 100)
      : undefined,
    // Bootstrap CI bounds — undefined when no CI data available
    ciLow:  hasCi ? normalize(ciBands![d.dimension]?.p10 ?? d.score) : undefined,
    ciHigh: hasCi ? normalize(ciBands![d.dimension]?.p90 ?? d.score) : undefined,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#2a2a3e" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#a0a0b8', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[RADAR_MIN, RADAR_MAX]}
            tick={{ fill: '#606080', fontSize: 10 }}
            tickCount={5}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a2e',
              border: '1px solid #2a2a4a',
              borderRadius: 6,
              color: '#e0e0e8',
            }}
            formatter={(value, name, item) => {
              if (name === 'ciLow' || name === 'ciHigh') return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = (item as any)?.payload?.rawScore;
              return [raw !== undefined ? raw : value, 'Score'];
            }}
          />
          {/* CI lower bound — dashed, no fill */}
          {hasCi && (
            <Radar
              name="ciLow"
              dataKey="ciLow"
              stroke={color}
              strokeOpacity={0.3}
              fill="none"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              legendType="none"
            />
          )}
          {/* CI upper bound — dashed, translucent fill to show the band */}
          {hasCi && (
            <Radar
              name="ciHigh"
              dataKey="ciHigh"
              stroke={color}
              strokeOpacity={0.3}
              fill={color}
              fillOpacity={0.07}
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              legendType="none"
            />
          )}
          {secondaryDimensions && (
            <Radar
              name={secondaryLabel}
              dataKey="secondary"
              stroke={secondaryColor}
              fill={secondaryColor}
              fillOpacity={0.1}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          )}
          <Radar
            name="Score"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      {hasCi && (
        <div style={{ textAlign: 'center', fontSize: 10, color: '#4b5563', marginTop: 2 }}>
          Dashed band = 80% bootstrap CI (run with --bootstrap to generate)
        </div>
      )}
    </div>
  );
}
