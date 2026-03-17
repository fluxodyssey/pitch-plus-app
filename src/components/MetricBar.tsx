import { gradeColor } from '../data/constants';

interface Props {
  grade: number;        // 0-200 (100 = average)
  invertDirection?: boolean;
}

export function MetricBar({ grade, invertDirection = false }: Props) {
  // Clamp grade to [50, 150] for visual purposes
  const clamped = Math.max(50, Math.min(150, grade));
  const color = gradeColor(grade);

  // Percentage from center (100 = avg)
  // bar grows right if above avg, left if below avg
  const pct = Math.abs(clamped - 100) / 50; // 0..1

  const aboveAvg = grade >= 100;
  const positive = invertDirection ? !aboveAvg : aboveAvg;

  return (
    <div
      style={{
        width: '100%',
        height: 8,
        background: '#1e1e2e',
        borderRadius: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Center line */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          background: '#3a3a5a',
        }}
      />
      {/* Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: `${pct * 50}%`,
          ...(positive
            ? { left: '50%', background: color }
            : { right: '50%', background: gradeColor(grade) }),
          borderRadius: 4,
          opacity: 0.85,
        }}
      />
    </div>
  );
}
