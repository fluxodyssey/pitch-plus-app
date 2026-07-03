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

export interface RadarSeries {
  dimensions: DimensionData[];
  color: string;
  label: string;
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
  /** Additional series for batch comparison (up to 4 extra) */
  extraSeries?: RadarSeries[];
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
  extraSeries = [],
}: Props) {
  const hasCi = ciBands != null && Object.keys(ciBands).length > 0;

  const data = dimensions.map((d) => {
    const point: Record<string, unknown> = {
      subject: DIMENSION_LABELS[d.dimension],
      value:   normalize(d.score),
      fullMark: RADAR_MAX,
      rawScore: d.score,
      secondary: secondaryDimensions
        ? normalize(secondaryDimensions.find((s) => s.dimension === d.dimension)?.score ?? 100)
        : undefined,
      ciLow:  hasCi ? normalize(ciBands?.[d.dimension]?.p10 ?? d.score) : undefined,
      ciHigh: hasCi ? normalize(ciBands?.[d.dimension]?.p90 ?? d.score) : undefined,
    };
    extraSeries.forEach((es, i) => {
      point[`extra${i}`] = normalize(es.dimensions.find(s => s.dimension === d.dimension)?.score ?? 100);
    });
    return point;
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="var(--border-plus)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: 'var(--text-2)', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[RADAR_MIN, RADAR_MAX]}
            tick={{ fill: 'var(--text-3)', fontSize: 10 }}
            tickCount={5}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid #2a2a4a',
              borderRadius: 6,
              color: 'var(--text-1)',
            }}
            formatter={(value, name, item) => {
              if (name === 'ciLow' || name === 'ciHigh') return null;
              const payload = (item as { payload?: { rawScore?: number } } | undefined)?.payload;
              const raw = payload?.rawScore;
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
          {extraSeries.map((es, i) => (
            <Radar
              key={`extra-${i}`}
              name={es.label}
              dataKey={`extra${i}`}
              stroke={es.color}
              fill={es.color}
              fillOpacity={0.08}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          ))}
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
