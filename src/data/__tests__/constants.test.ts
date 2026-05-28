import { describe, it, expect } from 'vitest';
import {
  numericGrade, gradeColor, scoreColor, scoreColorContinuous,
  toScoutingGrade, LOWER_IS_BETTER, DIMENSION_METRICS,
  METRIC_LABELS, DIMENSION_LABELS,
} from '../constants';

describe('numericGrade', () => {
  it('returns A+ for 130+', () => expect(numericGrade(135)).toBe('A+'));
  it('returns A for 115-129', () => expect(numericGrade(120)).toBe('A'));
  it('returns B+ for 105-114', () => expect(numericGrade(110)).toBe('B+'));
  it('returns B for 95-104', () => expect(numericGrade(100)).toBe('B'));
  it('returns C+ for 85-94', () => expect(numericGrade(90)).toBe('C+'));
  it('returns C for 70-84', () => expect(numericGrade(75)).toBe('C'));
  it('returns D for <70', () => expect(numericGrade(60)).toBe('D'));
  it('handles boundary at 130', () => expect(numericGrade(130)).toBe('A+'));
});

describe('gradeColor', () => {
  it('returns a color for every grade', () => {
    for (const score of [60, 75, 90, 100, 110, 120, 140]) {
      expect(gradeColor(score)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('scoreColor', () => {
  it('returns faint warm tint for average scores', () => {
    expect(scoreColor(100)).toBe('rgba(192,57,43,0.06)');
  });
});

describe('scoreColorContinuous', () => {
  it('returns rgba string', () => {
    const result = scoreColorContinuous(120);
    expect(result).toMatch(/^rgba\(/);
  });
});

describe('toScoutingGrade', () => {
  it('returns 50 for average', () => expect(toScoutingGrade(100)).toBe(50));
  it('clips to 20 minimum', () => expect(toScoutingGrade(20)).toBe(20));
  it('clips to 80 maximum', () => expect(toScoutingGrade(180)).toBe(80));
  it('returns grades in steps of 5', () => {
    for (const score of [80, 90, 100, 110, 120, 130]) {
      expect(toScoutingGrade(score) % 5).toBe(0);
    }
  });
});

describe('DIMENSION_METRICS consistency', () => {
  it('all metrics in DIMENSION_METRICS have labels', () => {
    for (const [dim, metrics] of Object.entries(DIMENSION_METRICS)) {
      for (const metric of metrics) {
        expect(METRIC_LABELS[metric]).toBeDefined();
      }
    }
  });

  it('all dimensions have labels', () => {
    for (const dim of Object.keys(DIMENSION_METRICS)) {
      expect(DIMENSION_LABELS[dim as keyof typeof DIMENSION_LABELS]).toBeDefined();
    }
  });
});

describe('LOWER_IS_BETTER', () => {
  it('contains expected metrics', () => {
    expect(LOWER_IS_BETTER.has('wrc_plus_against')).toBe(true);
    expect(LOWER_IS_BETTER.has('bb_rate')).toBe(true);
  });

  it('does not contain higher-is-better metrics', () => {
    expect(LOWER_IS_BETTER.has('k_rate')).toBe(false);
    expect(LOWER_IS_BETTER.has('chase_rate')).toBe(false);
  });
});
