import { scoreColorContinuous } from '../data/constants';
import type { AttributeGrades } from '../types';

interface Props {
  attrs: AttributeGrades;
  compact?: boolean;
}

const ATTR_KEYS: Array<{ key: keyof AttributeGrades; label: string }> = [
  { key: 'velo',            label: 'Velocity' },
  { key: 'movement',        label: 'Movement' },
  { key: 'location',        label: 'Location' },
  { key: 'spin_efficiency', label: 'Spin Eff.' },
  { key: 'extension',       label: 'Extension' },
  { key: 'spin',            label: 'Spin' },
];

export function AttributeGauges({ attrs, compact = false }: Props) {
  const rowH = compact ? 14 : 18;
  const fontSize = compact ? 10 : 11;
  const labelWidth = compact ? 56 : 70;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>
      {ATTR_KEYS.map(({ key, label }) => {
        const grade = attrs[key] as number;
        if (grade == null) return null;
        // Map grade (0-200) to color
        const color = scoreColorContinuous(grade, 0.85);
        const pct = Math.max(0, Math.min(100, grade / 2)); // 0-200 → 0-100%

        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, height: rowH }}>
            <span style={{
              width: labelWidth,
              fontSize,
              color: '#606080',
              flexShrink: 0,
              textAlign: 'right',
            }}>
              {label}
            </span>
            <div style={{
              flex: 1,
              height: compact ? 4 : 6,
              background: '#1a1a2e',
              borderRadius: 3,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: color,
                borderRadius: 3,
                transition: 'width 0.4s ease-out',
              }} />
            </div>
            <span style={{
              width: 30,
              fontSize,
              fontWeight: 700,
              color: scoreColorContinuous(grade, 1),
              textAlign: 'right',
              fontFamily: 'monospace',
              flexShrink: 0,
            }}>
              {Math.round(grade)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
