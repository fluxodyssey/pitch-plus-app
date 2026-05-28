import { describe, it, expect } from 'vitest';
import {
  filterPitches,
  countActiveFilters,
  DEFAULT_FILTERS,
  SEASON_DATE_FROM,
  SEASON_DATE_TO,
} from '../filterPitches';
import type { RawPitch, PitchFilters } from '../../types';

function makePitch(overrides: Partial<RawPitch> = {}): RawPitch {
  return {
    pid: 1,
    gid: 100,
    gd: '2025-05-15',
    inn: 1,
    ih: 'T',
    abi: 1,
    bid: 1000,
    bn: 'Test Batter',
    bh: 'R',
    s: 0,
    b: 0,
    o: 0,
    pt: 'FF',
    v: 95,
    sp: 2300,
    ivb: 16,
    hb: 8,
    px: 0,
    pz: 2.5,
    ext: 6.2,
    vaa: -4.5,
    pv: 0.5,
    z: 5,
    sw: false,
    wh: false,
    ip: false,
    desc: 'called_strike',
    pn: 'Test Pitcher',
    ph: 'R',
    ptm: 'TST',
    ...overrides,
  };
}

function withFilters(overrides: Partial<PitchFilters>): PitchFilters {
  return { ...DEFAULT_FILTERS, ...overrides };
}

describe('countActiveFilters', () => {
  it('returns 0 when filters match defaults', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it('does not count season-default dates as active', () => {
    // Pre-filled season range should NOT increment the badge count.
    const filters = withFilters({ dateFrom: SEASON_DATE_FROM, dateTo: SEASON_DATE_TO });
    expect(countActiveFilters(filters)).toBe(0);
  });

  it('counts dateFrom as active when it differs from the season default', () => {
    const filters = withFilters({ dateFrom: '2025-06-01' });
    expect(countActiveFilters(filters)).toBe(1);
  });

  it('counts dateTo as active when it differs from the season default', () => {
    const filters = withFilters({ dateTo: '2025-08-01' });
    expect(countActiveFilters(filters)).toBe(1);
  });

  it('counts each populated array filter once, regardless of length', () => {
    const filters = withFilters({
      pitchTypes: ['FF', 'SL', 'CH'],
      counts: ['0-0', '3-2'],
      innings: [1],
      outs: [0, 1, 2],
    });
    expect(countActiveFilters(filters)).toBe(4);
  });

  it('counts categorical filters when set away from "all"', () => {
    const filters = withFilters({
      batterHand: 'L',
      zone: 'in',
      result: 'whiff',
    });
    expect(countActiveFilters(filters)).toBe(3);
  });

  it('counts velo bounds independently', () => {
    expect(countActiveFilters(withFilters({ veloMin: 90 }))).toBe(1);
    expect(countActiveFilters(withFilters({ veloMax: 100 }))).toBe(1);
    expect(countActiveFilters(withFilters({ veloMin: 90, veloMax: 100 }))).toBe(2);
  });

  it('treats veloMin of 0 as active (only null is inactive)', () => {
    // Edge case: 0 is a valid filter value; null is the "not set" sentinel.
    expect(countActiveFilters(withFilters({ veloMin: 0 }))).toBe(1);
  });

  it('counts gameId when set', () => {
    expect(countActiveFilters(withFilters({ gameId: 42 }))).toBe(1);
  });
});

describe('filterPitches', () => {
  it('returns all pitches when filters are at defaults', () => {
    const pitches = [makePitch({ pid: 1 }), makePitch({ pid: 2 })];
    expect(filterPitches(pitches, DEFAULT_FILTERS)).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(filterPitches([], DEFAULT_FILTERS)).toEqual([]);
  });

  describe('date range', () => {
    it('excludes pitches before dateFrom', () => {
      const pitches = [
        makePitch({ pid: 1, gd: '2025-04-01' }),
        makePitch({ pid: 2, gd: '2025-06-01' }),
      ];
      const result = filterPitches(pitches, withFilters({ dateFrom: '2025-05-15' }));
      expect(result.map(p => p.pid)).toEqual([2]);
    });

    it('excludes pitches after dateTo', () => {
      const pitches = [
        makePitch({ pid: 1, gd: '2025-06-01' }),
        makePitch({ pid: 2, gd: '2025-08-01' }),
      ];
      const result = filterPitches(pitches, withFilters({ dateTo: '2025-07-01' }));
      expect(result.map(p => p.pid)).toEqual([1]);
    });

    it('includes pitches on the boundary dates (inclusive)', () => {
      const pitches = [
        makePitch({ pid: 1, gd: '2025-06-01' }),
        makePitch({ pid: 2, gd: '2025-07-01' }),
      ];
      const result = filterPitches(
        pitches,
        withFilters({ dateFrom: '2025-06-01', dateTo: '2025-07-01' }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('pitch type', () => {
    it('returns all when pitchTypes is empty', () => {
      const pitches = [makePitch({ pt: 'FF' }), makePitch({ pt: 'SL' })];
      expect(filterPitches(pitches, DEFAULT_FILTERS)).toHaveLength(2);
    });

    it('keeps only matching pitch types', () => {
      const pitches = [
        makePitch({ pid: 1, pt: 'FF' }),
        makePitch({ pid: 2, pt: 'SL' }),
        makePitch({ pid: 3, pt: 'CH' }),
      ];
      const result = filterPitches(pitches, withFilters({ pitchTypes: ['FF', 'CH'] }));
      expect(result.map(p => p.pid).sort()).toEqual([1, 3]);
    });
  });

  describe('count', () => {
    it('matches the "b-s" string format', () => {
      const pitches = [
        makePitch({ pid: 1, b: 0, s: 0 }),
        makePitch({ pid: 2, b: 3, s: 2 }),
        makePitch({ pid: 3, b: 1, s: 2 }),
      ];
      const result = filterPitches(pitches, withFilters({ counts: ['3-2'] }));
      expect(result.map(p => p.pid)).toEqual([2]);
    });
  });

  describe('batter hand', () => {
    it('"all" keeps every batter hand', () => {
      const pitches = [makePitch({ bh: 'L' }), makePitch({ bh: 'R' })];
      expect(filterPitches(pitches, withFilters({ batterHand: 'all' }))).toHaveLength(2);
    });

    it('keeps only the specified hand', () => {
      const pitches = [
        makePitch({ pid: 1, bh: 'L' }),
        makePitch({ pid: 2, bh: 'R' }),
      ];
      const result = filterPitches(pitches, withFilters({ batterHand: 'L' }));
      expect(result.map(p => p.pid)).toEqual([1]);
    });
  });

  describe('innings and outs', () => {
    it('filters by inning', () => {
      const pitches = [
        makePitch({ pid: 1, inn: 1 }),
        makePitch({ pid: 2, inn: 5 }),
        makePitch({ pid: 3, inn: 9 }),
      ];
      const result = filterPitches(pitches, withFilters({ innings: [5, 9] }));
      expect(result.map(p => p.pid).sort()).toEqual([2, 3]);
    });

    it('filters by outs', () => {
      const pitches = [
        makePitch({ pid: 1, o: 0 }),
        makePitch({ pid: 2, o: 2 }),
      ];
      const result = filterPitches(pitches, withFilters({ outs: [2] }));
      expect(result.map(p => p.pid)).toEqual([2]);
    });
  });

  describe('zone', () => {
    it('"in" keeps zones 1-9', () => {
      const pitches = [
        makePitch({ pid: 1, z: 1 }),
        makePitch({ pid: 2, z: 9 }),
        makePitch({ pid: 3, z: 11 }),
        makePitch({ pid: 4, z: 14 }),
      ];
      const result = filterPitches(pitches, withFilters({ zone: 'in' }));
      expect(result.map(p => p.pid).sort()).toEqual([1, 2]);
    });

    it('"edge" keeps zones 11-14', () => {
      const pitches = [
        makePitch({ pid: 1, z: 9 }),
        makePitch({ pid: 2, z: 11 }),
        makePitch({ pid: 3, z: 14 }),
      ];
      const result = filterPitches(pitches, withFilters({ zone: 'edge' }));
      expect(result.map(p => p.pid).sort()).toEqual([2, 3]);
    });

    it('"chase" keeps zones > 9', () => {
      // Per the source: chase excludes z <= 9, so 10/11+ all count as chase.
      const pitches = [
        makePitch({ pid: 1, z: 5 }),
        makePitch({ pid: 2, z: 9 }),
        makePitch({ pid: 3, z: 11 }),
      ];
      const result = filterPitches(pitches, withFilters({ zone: 'chase' }));
      expect(result.map(p => p.pid)).toEqual([3]);
    });
  });

  describe('result', () => {
    it('"swing" keeps only swung pitches', () => {
      const pitches = [
        makePitch({ pid: 1, sw: true }),
        makePitch({ pid: 2, sw: false }),
      ];
      const result = filterPitches(pitches, withFilters({ result: 'swing' }));
      expect(result.map(p => p.pid)).toEqual([1]);
    });

    it('"take" inverts the swing flag', () => {
      const pitches = [
        makePitch({ pid: 1, sw: true }),
        makePitch({ pid: 2, sw: false }),
      ];
      const result = filterPitches(pitches, withFilters({ result: 'take' }));
      expect(result.map(p => p.pid)).toEqual([2]);
    });

    it('"whiff" requires the whiff flag', () => {
      const pitches = [
        makePitch({ pid: 1, sw: true, wh: true }),
        makePitch({ pid: 2, sw: true, wh: false }),
      ];
      const result = filterPitches(pitches, withFilters({ result: 'whiff' }));
      expect(result.map(p => p.pid)).toEqual([1]);
    });

    it('"in-play" requires the in-play flag', () => {
      const pitches = [
        makePitch({ pid: 1, ip: true }),
        makePitch({ pid: 2, ip: false }),
      ];
      const result = filterPitches(pitches, withFilters({ result: 'in-play' }));
      expect(result.map(p => p.pid)).toEqual([1]);
    });
  });

  describe('velocity', () => {
    it('excludes pitches below veloMin', () => {
      const pitches = [
        makePitch({ pid: 1, v: 88 }),
        makePitch({ pid: 2, v: 95 }),
      ];
      const result = filterPitches(pitches, withFilters({ veloMin: 90 }));
      expect(result.map(p => p.pid)).toEqual([2]);
    });

    it('excludes pitches above veloMax', () => {
      const pitches = [
        makePitch({ pid: 1, v: 95 }),
        makePitch({ pid: 2, v: 102 }),
      ];
      const result = filterPitches(pitches, withFilters({ veloMax: 100 }));
      expect(result.map(p => p.pid)).toEqual([1]);
    });

    it('keeps pitches on the velo boundary (inclusive on both sides)', () => {
      const pitches = [
        makePitch({ pid: 1, v: 90 }),
        makePitch({ pid: 2, v: 100 }),
      ];
      const result = filterPitches(pitches, withFilters({ veloMin: 90, veloMax: 100 }));
      expect(result).toHaveLength(2);
    });
  });

  describe('gameId', () => {
    it('keeps only pitches from the specified game', () => {
      const pitches = [
        makePitch({ pid: 1, gid: 100 }),
        makePitch({ pid: 2, gid: 200 }),
      ];
      const result = filterPitches(pitches, withFilters({ gameId: 200 }));
      expect(result.map(p => p.pid)).toEqual([2]);
    });
  });

  describe('composition', () => {
    it('AND-combines multiple filters', () => {
      const pitches = [
        makePitch({ pid: 1, pt: 'FF', bh: 'R', v: 95 }),
        makePitch({ pid: 2, pt: 'FF', bh: 'L', v: 95 }),
        makePitch({ pid: 3, pt: 'SL', bh: 'R', v: 88 }),
        makePitch({ pid: 4, pt: 'FF', bh: 'R', v: 88 }),
      ];
      const result = filterPitches(
        pitches,
        withFilters({ pitchTypes: ['FF'], batterHand: 'R', veloMin: 90 }),
      );
      expect(result.map(p => p.pid)).toEqual([1]);
    });

    it('returns empty when filters mutually exclude every pitch', () => {
      const pitches = [makePitch({ pt: 'FF', bh: 'R' })];
      const result = filterPitches(
        pitches,
        withFilters({ pitchTypes: ['SL'], batterHand: 'L' }),
      );
      expect(result).toEqual([]);
    });
  });
});
