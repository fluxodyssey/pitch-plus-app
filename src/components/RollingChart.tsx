import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { RawPitch } from '../types';

interface Props {
  pitches: RawPitch[];
  metric?: 'velo' | 'whiffRate' | 'zoneRate' | 'cswRate';
  height?: number;
}

const METRIC_CONFIG = {
  velo: { label: 'Avg Velocity', format: (v: number) => `${v.toFixed(1)} mph`, color: '#4a9eff' },
  whiffRate: { label: 'Whiff%', format: (v: number) => `${(v * 100).toFixed(1)}%`, color: '#d44040' },
  zoneRate: { label: 'Zone%', format: (v: number) => `${(v * 100).toFixed(1)}%`, color: '#a87070' },
  cswRate: { label: 'CSW%', format: (v: number) => `${(v * 100).toFixed(1)}%`, color: '#c85a5a' },
};

interface GamePoint {
  date: string;
  value: number;
  rolling: number | null;
  pitches: number;
}

export function RollingChart({ pitches, metric = 'velo', height = 240 }: Props) {
  const config = METRIC_CONFIG[metric];

  const data = useMemo(() => {
    // Group pitches by game
    const gameMap = new Map<number, RawPitch[]>();
    for (const p of pitches) {
      if (!gameMap.has(p.gid)) gameMap.set(p.gid, []);
      gameMap.get(p.gid)!.push(p);
    }

    const games: GamePoint[] = [];
    for (const [, ps] of gameMap) {
      const first = ps[0];
      if (!first) continue;
      const date = first.gd;
      let value: number;

      switch (metric) {
        case 'velo': {
          const velos = ps.filter(p => p.v > 0).map(p => p.v);
          value = velos.length > 0 ? velos.reduce((a, b) => a + b) / velos.length : 0;
          break;
        }
        case 'whiffRate': {
          const sw = ps.filter(p => p.sw).length;
          const wh = ps.filter(p => p.wh).length;
          value = sw > 0 ? wh / sw : 0;
          break;
        }
        case 'zoneRate': {
          const iz = ps.filter(p => p.z >= 1 && p.z <= 9).length;
          value = ps.length > 0 ? iz / ps.length : 0;
          break;
        }
        case 'cswRate': {
          const csw = ps.filter(p => p.wh || p.desc === 'Called Strike').length;
          value = ps.length > 0 ? csw / ps.length : 0;
          break;
        }
      }

      games.push({ date, value, rolling: null, pitches: ps.length });
    }

    // Sort by date
    games.sort((a, b) => a.date.localeCompare(b.date));

    // Compute 3-game rolling average
    for (let i = 0; i < games.length; i++) {
      const g = games[i]!;
      if (i < 2) {
        g.rolling = null;
      } else {
        g.rolling = (g.value + games[i - 1]!.value + games[i - 2]!.value) / 3;
      }
    }

    return games;
  }, [pitches, metric]);

  if (data.length < 2) return null;

  // Compute overall average for reference line
  const avg = data.reduce((s, d) => s + d.value, 0) / data.length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ color: '#606080', fontSize: 11 }}>
          {data.length} games · 3-game rolling avg
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="2 2" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#606080', fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)} // MM-DD
            stroke="#2a2a3e"
          />
          <YAxis
            tick={{ fill: '#606080', fontSize: 10 }}
            stroke="#2a2a3e"
            tickFormatter={(v: number) => metric === 'velo' ? v.toFixed(0) : `${(v * 100).toFixed(0)}%`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#a0a0b8' }}
            formatter={(value) => [config.format(value as number), config.label]}
          />
          <ReferenceLine y={avg} stroke="#4a9eff" strokeDasharray="4 4" strokeOpacity={0.3} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={config.color}
            strokeWidth={1}
            dot={{ fill: config.color, r: 3 }}
            strokeOpacity={0.4}
            name={config.label}
          />
          <Line
            type="monotone"
            dataKey="rolling"
            stroke={config.color}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            name="3-Game Avg"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
