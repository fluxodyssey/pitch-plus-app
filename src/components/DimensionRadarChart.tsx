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

interface Props {
  dimensions: DimensionData[];
  color?: string;
  secondaryDimensions?: DimensionData[];
  secondaryColor?: string;
  secondaryLabel?: string;
  height?: number;
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
}: Props) {
  const data = dimensions.map((d) => ({
    subject: DIMENSION_LABELS[d.dimension],
    value: normalize(d.score),
    fullMark: RADAR_MAX,
    rawScore: d.score,
    secondary: secondaryDimensions
      ? normalize(secondaryDimensions.find((s) => s.dimension === d.dimension)?.score ?? 100)
      : undefined,
  }));

  return (
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
          formatter={(value, _name, item) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = (item as any)?.payload?.rawScore;
            return [raw !== undefined ? raw : value, 'Score'];
          }}
        />
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
  );
}
