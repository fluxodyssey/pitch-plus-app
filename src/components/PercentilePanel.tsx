import { PercentileGauge } from './PercentileGauge';
import type { PercentileEntry } from '../data/percentiles';
import type { Pitcher, MetricKey } from '../types';
import { PCT_METRICS } from '../data/constants';

interface Props {
  pitcher: Pitcher;
  percentiles: PercentileEntry;
}

interface GaugeSpec {
  key: string;
  label: string;
}

const GROUPS: Array<{ title: string; items: GaugeSpec[] }> = [
  {
    title: 'Overall',
    items: [{ key: 'pitch_plus', label: 'Pitch+' }],
  },
  {
    title: 'Stuff & Command',
    items: [
      { key: 'dim_stuff', label: 'Stuff' },
      { key: 'dim_command', label: 'Command' },
      { key: 'dim_deception', label: 'Deception' },
      { key: 'avg_perceived_velo', label: 'Perceived Velo' },
    ],
  },
  {
    title: 'Outcomes',
    items: [
      { key: 'k_rate', label: 'K%' },
      { key: 'bb_rate', label: 'BB%' },
      { key: 'in_zone_whiff_rate', label: 'Whiff%' },
      { key: 'chase_rate', label: 'Chase%' },
      { key: 'csw_rate', label: 'CSW%' },
      { key: 'wrc_plus_against', label: 'wRC+ Against' },
    ],
  },
];

function formatRaw(key: MetricKey, raw: number): string {
  if (PCT_METRICS.has(key)) return `${(raw * 100).toFixed(1)}%`;
  if (key === 'n_pitch_types') return String(Math.round(raw));
  if (Math.abs(raw) < 10) return raw.toFixed(2);
  return raw.toFixed(1);
}

export function PercentilePanel({ pitcher, percentiles }: Props) {
  return (
    <div className="card" style={{ padding: '16px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="card-title" style={{ margin: 0, flex: 1 }}>Percentile Rankings</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr 36px 52px',
          gap: 8,
          width: '100%',
          maxWidth: 480,
          paddingLeft: 168,
        }}>
          {/* scale labels over the bar */}
          <div style={{ gridColumn: '2', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-4)', fontWeight: 600, letterSpacing: 0.5 }}>
            <span>POOR</span>
            <span>AVERAGE</span>
            <span>GREAT</span>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4a9eff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              {group.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.items.map(({ key, label }) => {
                let pctile: number;
                let rawStr: string | undefined;

                if (key === 'pitch_plus') {
                  pctile = percentiles.pitch_plus;
                  rawStr = String(pitcher.pitch_plus);
                } else if (key.startsWith('dim_')) {
                  const dk = key.slice(4) as keyof typeof percentiles.dimensions;
                  pctile = percentiles.dimensions[dk] ?? 50;
                  rawStr = String(pitcher.dimensions[dk]?.score ?? '');
                } else {
                  const mk = key as MetricKey;
                  pctile = percentiles.metrics[mk] ?? 50;
                  const mg = pitcher.metric_grades[mk];
                  rawStr = mg ? formatRaw(mk, mg.raw) : undefined;
                }

                return (
                  <PercentileGauge
                    key={key}
                    label={label}
                    percentile={pctile}
                    {...(rawStr !== undefined && { rawValue: rawStr })}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
