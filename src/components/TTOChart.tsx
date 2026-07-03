import { pitchColor, scoreColorContinuous } from '../data/constants';
import type { TTOPitcherData, TTOMetrics } from '../data/useTTOData';

interface Props {
  data: TTOPitcherData;
  pitchTypeNames?: Record<string, string>;
}

const TTO_LABELS: Record<string, string> = { tto1: '1st TTO', tto2: '2nd TTO', tto3: '3rd+' };
const TTO_COLORS = ['#4a9eff', '#e6c547', '#c85a5a'];

function fmt(v: number | null | undefined, pct = false): string {
  if (v == null) return '—';
  return pct ? (v * 100).toFixed(1) + '%' : v.toFixed(3);
}

function TrendBar({ tto1, tto3, metric }: { tto1: number | null; tto3: number | null; metric: 'whiff_rate' | 'xwoba' }) {
  if (tto1 == null || tto3 == null) return null;
  const delta = tto3 - tto1;
  // For whiff_rate: decline (negative delta) is bad → red
  // For xwoba: increase (positive delta) is bad → red
  const isBad = metric === 'whiff_rate' ? delta < 0 : delta > 0;
  const color = Math.abs(delta) < 0.01 ? 'var(--text-4)' : isBad ? '#c85a5a' : '#4a9eff';
  return (
    <span style={{ color, fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }}>
      {delta >= 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
    </span>
  );
}

function PassBars({ ptData, metric }: { ptData: Record<string, TTOMetrics>; metric: keyof TTOMetrics }) {
  const ttoPasses = ['tto1', 'tto2', 'tto3'];
  const vals = ttoPasses.map(k => ptData[k]?.[metric] as number | null ?? null);
  const maxVal = Math.max(...vals.filter((v): v is number => v !== null), 0.01);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {ttoPasses.map((key, i) => {
        const v = vals[i];
        if (v == null) return null;
        const pct = Math.max(0, Math.min(100, (v / maxVal) * 100));
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 40, fontSize: 10, color: TTO_COLORS[i], textAlign: 'right', flexShrink: 0 }}>
              {(TTO_LABELS[key] ?? '').split(' ')[0]}
            </div>
            <div style={{ flex: 1, height: 8, background: '#12121e', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: TTO_COLORS[i], borderRadius: 2 }} />
            </div>
            <div style={{ width: 36, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-2)', textAlign: 'right' }}>
              {fmt(v, typeof v === 'number' && metric !== 'xwoba')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TTOChart({ data, pitchTypeNames }: Props) {
  const overall = data.tto_overall;
  const byPt = data.by_pitch_type;

  const hasOverall = '1' in overall || '2' in overall || '3' in overall;
  const ptKeys = Object.keys(byPt).sort((a, b) => {
    const na = (byPt[a]?.tto1?.n ?? 0) + (byPt[a]?.tto2?.n ?? 0) + (byPt[a]?.tto3?.n ?? 0);
    const nb = (byPt[b]?.tto1?.n ?? 0) + (byPt[b]?.tto2?.n ?? 0) + (byPt[b]?.tto3?.n ?? 0);
    return nb - na;
  });

  return (
    <div>
      {/* Resilience header */}
      {data.tto_resilience != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
              TTO Resilience
            </div>
            <span style={{
              background: scoreColorContinuous(data.tto_resilience, 0.2),
              border: `1px solid ${scoreColorContinuous(data.tto_resilience, 0.5)}`,
              color: scoreColorContinuous(data.tto_resilience, 1),
              borderRadius: 6, padding: '4px 12px',
              fontFamily: 'monospace', fontWeight: 800, fontSize: 22,
            }}>{data.tto_resilience}</span>
          </div>
          {hasOverall && (
            <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
              {(['1', '2', '3'] as const).map((k, i) => {
                const m = overall[k];
                if (!m) return null;
                return (
                  <div key={k} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: TTO_COLORS[i], textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 }}>
                      {TTO_LABELS[`tto${k}`]}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-1)' }}>
                      {fmt(m.whiff_rate, true)} whiff
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {m.n} pitches
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
                <TrendBar
                  tto1={overall['1']?.whiff_rate ?? null}
                  tto3={overall['3']?.whiff_rate ?? null}
                  metric="whiff_rate"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-pitch-type breakdown */}
      {ptKeys.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            By Pitch Type — Whiff%
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {ptKeys.map(pt => {
              const color = pitchColor(pt);
              const ptData = byPt[pt];
              if (!ptData) return null;
              return (
                <div key={pt} style={{
                  background: '#0e0e1c', border: `1px solid ${color}30`,
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{
                      background: color + '22', border: `1px solid ${color}55`,
                      borderRadius: 4, padding: '1px 6px',
                      fontSize: 10, fontFamily: 'monospace', color,
                    }}>{pt}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                      {pitchTypeNames?.[pt] ?? ''}
                    </span>
                    <TrendBar
                      tto1={ptData.tto1?.whiff_rate ?? null}
                      tto3={ptData.tto3?.whiff_rate ?? null}
                      metric="whiff_rate"
                    />
                  </div>
                  <PassBars ptData={ptData} metric="whiff_rate" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zone breakdown */}
      {Object.keys(data.by_zone).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            By Zone — xwOBA Against
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {(['heart', 'shadow', 'chase', 'waste'] as const).map(zone => {
              const zd = data.by_zone[zone];
              if (!zd) return null;
              return (
                <div key={zone} style={{ background: '#0e0e1c', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    {zone}
                  </div>
                  <PassBars ptData={zd} metric="xwoba" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
