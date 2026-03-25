import { DIMENSION_LABELS, gradeColor } from '../data/constants';
import type { DimensionKey, Pitcher } from '../types';

const DIMS: DimensionKey[] = ['stuff', 'command', 'deception', 'tunnel_and_sequence', 'outcomes', 'arsenal'];

interface Props {
  pitcherA: Pitcher;
  pitcherB: Pitcher;
}

export function ComparisonBars({ pitcherA, pitcherB }: Props) {
  const maxScore = 160;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {DIMS.map(dim => {
        const a = pitcherA.dimensions[dim].score;
        const b = pitcherB.dimensions[dim].score;
        const aPct = Math.min(100, (a / maxScore) * 100);
        const bPct = Math.min(100, (b / maxScore) * 100);
        const aColor = gradeColor(a);
        const bColor = gradeColor(b);

        return (
          <div key={dim}>
            <div style={{ fontSize: 10, color: '#606080', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, textAlign: 'center' }}>
              {DIMENSION_LABELS[dim]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 4, alignItems: 'center' }}>
              {/* Left bar (pitcher A) — grows right-to-left */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: aColor, fontFamily: 'monospace', minWidth: 28, textAlign: 'right' }}>{a}</span>
                <div style={{ flex: 1, height: 10, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden', direction: 'rtl' }}>
                  <div style={{ width: `${aPct}%`, height: '100%', background: aColor, borderRadius: 3, opacity: 0.7, transition: 'width 0.4s' }} />
                </div>
              </div>
              {/* Center divider */}
              <div style={{ width: 1, height: 18, background: '#2a2a3e', margin: '0 auto' }} />
              {/* Right bar (pitcher B) — grows left-to-right */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 10, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${bPct}%`, height: '100%', background: bColor, borderRadius: 3, opacity: 0.7, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: bColor, fontFamily: 'monospace', minWidth: 28 }}>{b}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
