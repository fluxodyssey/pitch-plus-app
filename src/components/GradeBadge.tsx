import { numericGrade, GRADE_COLORS } from '../data/constants';
import type { CSSProperties } from 'react';

interface Props {
  score: number;
  showLetter?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function GradeBadge({ score, showLetter = true, size = 'md' }: Props) {
  const letter = numericGrade(score);
  const color = GRADE_COLORS[letter] ?? '#e0e0e8';

  const sizeStyles: CSSProperties =
    size === 'sm'
      ? { fontSize: '0.65rem', padding: '1px 4px', minWidth: 28 }
      : size === 'lg'
      ? { fontSize: '1rem', padding: '4px 10px', minWidth: 52 }
      : { fontSize: '0.75rem', padding: '2px 6px', minWidth: 40 };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        background: `${color}22`,
        border: `1px solid ${color}88`,
        borderRadius: 4,
        color,
        fontWeight: 700,
        fontFamily: 'monospace',
        ...sizeStyles,
      }}
    >
      {score}
      {showLetter && (
        <span style={{ fontSize: '0.85em', opacity: 0.9 }}>{letter}</span>
      )}
    </span>
  );
}
