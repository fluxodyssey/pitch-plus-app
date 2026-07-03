import { scoreColorContinuous } from '../data/constants';

interface Props {
  label: string;
  percentile: number; // 0–100
  rawValue?: string;
}

export function PercentileGauge({ label, percentile, rawValue }: Props) {
  const clipped = Math.max(0, Math.min(100, percentile));
  // Map percentile to score for color (50=bad, 150=good)
  const score = 50 + clipped;
  const fillColor = scoreColorContinuous(score, 0.9);
  const circleColor = scoreColorContinuous(score, 1);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '160px 1fr 36px 52px',
      alignItems: 'center',
      gap: 8,
      height: 26,
    }}>
      {/* Label */}
      <span style={{
        fontSize: 12,
        color: 'var(--text-2)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'right',
        paddingRight: 4,
      }}>
        {label}
      </span>

      {/* Bar track */}
      <div style={{
        height: 8,
        background: 'var(--bg-elevated)',
        borderRadius: 4,
        position: 'relative',
        overflow: 'visible',
      }}>
        {/* Fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${clipped}%`,
          background: fillColor,
          borderRadius: 4,
          transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        }} />

        {/* Score circle — sits on top of the bar at the percentile position */}
        <div style={{
          position: 'absolute',
          left: `${clipped}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: circleColor,
          border: '2px solid var(--bg-base)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          transition: 'left 0.6s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 8,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1,
            fontFamily: 'monospace',
          }}>
            {clipped}
          </span>
        </div>
      </div>

      {/* Percentile rank text */}
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: circleColor,
        textAlign: 'center',
        fontFamily: 'monospace',
      }}>
        {clipped}
      </span>

      {/* Raw value */}
      <span style={{
        fontSize: 11,
        color: 'var(--text-3)',
        textAlign: 'right',
        fontFamily: 'monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {rawValue ?? ''}
      </span>
    </div>
  );
}
