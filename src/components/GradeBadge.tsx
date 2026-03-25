import { numericGrade, GRADE_COLORS } from '../data/constants';
import type { CSSProperties } from 'react';

interface Props {
  score: number;
  showLetter?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function GradeBadge({ score, showLetter = true, size = 'md' }: Props) {
  const letter = numericGrade(score);
  const color = GRADE_COLORS[letter] ?? '#566a7a';

  const sizeStyles: CSSProperties =
    size === 'sm'
      ? { fontSize: '0.65rem', padding: '2px 5px', minWidth: 30 }
      : size === 'lg'
      ? { fontSize: '1rem', padding: '5px 12px', minWidth: 56 }
      : { fontSize: '0.75rem', padding: '3px 7px', minWidth: 42 };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: `${color}20`,
        border: `1px solid ${color}60`,
        borderRadius: 5,
        color: '#e2eaf6',
        fontWeight: 500,
        fontFamily: "'DM Mono', monospace",
        letterSpacing: '-0.02em',
        ...sizeStyles,
      }}
    >
      {score}
      {showLetter && (
        <span style={{ fontSize: '0.78em', color, fontWeight: 600 }}>{letter}</span>
      )}
    </span>
  );
}
