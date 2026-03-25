interface DeltaBadgeProps {
  delta: number | null;
  format?: 'integer' | 'decimal' | 'percent';
  size?: 'sm' | 'md';
  invertColor?: boolean; // for metrics where lower is better
}

const COLORS = {
  strongGreen: '#22c55e',
  lightGreen: '#4ade80',
  neutral: '#8890a0',
  lightRed: '#f87171',
  strongRed: '#ef4444',
};

function deltaColor(delta: number, invert: boolean): string {
  const d = invert ? -delta : delta;
  if (d >= 10) return COLORS.strongGreen;
  if (d >= 3) return COLORS.lightGreen;
  if (d <= -10) return COLORS.strongRed;
  if (d <= -3) return COLORS.lightRed;
  return COLORS.neutral;
}

export function DeltaBadge({ delta, format = 'integer', size = 'md', invertColor = false }: DeltaBadgeProps) {
  if (delta == null || isNaN(delta)) {
    return <span style={{ color: '#606080', fontSize: size === 'sm' ? 11 : 13 }}>—</span>;
  }

  const color = deltaColor(delta, invertColor);
  const sign = delta > 0 ? '+' : '';
  let text: string;
  if (format === 'percent') {
    text = `${sign}${(delta * 100).toFixed(1)}%`;
  } else if (format === 'decimal') {
    text = `${sign}${delta.toFixed(1)}`;
  } else {
    text = `${sign}${Math.round(delta)}`;
  }

  return (
    <span style={{
      color,
      fontWeight: Math.abs(delta) >= 10 ? 700 : 500,
      fontSize: size === 'sm' ? 11 : 13,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {text}
    </span>
  );
}
