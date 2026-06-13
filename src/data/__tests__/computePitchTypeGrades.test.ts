import { describe, it, expect } from 'vitest';
import { computePitchTypeGrades } from '../computePitchTypeGrades';
import type { RawPitch, LeagueAvgDetailed } from '../../types';

// Minimal pitch factory — only the fields computePitchTypeGrades reads.
function pitch(pt: string, over: Partial<RawPitch> = {}): RawPitch {
  return {
    pid: 1, gid: 1, gd: '2026-06-01', inn: 1, ih: 'top', abi: 0,
    bid: 2, bn: 'B', bh: 'R', s: 0, b: 0, o: 0,
    pt, v: 90, sp: 2200, ivb: 10, hb: 8, px: 0, pz: 2.5,
    ext: 6.3, vaa: null, pv: 90, z: 5, sw: false, wh: false, ip: false,
    desc: 'Ball', pn: 'P', ph: 'R', ptm: 'SEA',
    ...over,
  };
}

function league(over: Partial<LeagueAvgDetailed> = {}): Record<string, LeagueAvgDetailed> {
  const base: LeagueAvgDetailed = {
    n: 1000,
    avg_velo: 90, std_velo: 2,
    avg_spin: 2200, std_spin: 150,
    avg_ivb: 10, std_ivb: 4,
    avg_hb: 3, std_hb: 8,          // signed league mean — L/R pooled
    avg_abs_hb: 8, std_abs_hb: 3,  // hand-neutral magnitude
    avg_ext: 6.3, std_ext: 0.4,
    ...over,
  };
  return { FF: base, SI: base, CU: base, FC: base };
}

describe('computePitchTypeGrades direction rules', () => {
  it('rewards rise for four-seamers (higher iVB → grade > 100)', () => {
    const [g] = computePitchTypeGrades([pitch('FF', { ivb: 18 })], league());
    expect(g!.ivbGrade).toBeGreaterThan(100);
  });

  it('rewards drop for sinkers (lower iVB → grade > 100)', () => {
    const [g] = computePitchTypeGrades([pitch('SI', { ivb: 2 })], league());
    expect(g!.ivbGrade).toBeGreaterThan(100);
  });

  it('rewards drop for breaking balls (lower iVB → grade > 100)', () => {
    const [g] = computePitchTypeGrades([pitch('CU', { ivb: -8, sp: 2200 })], league({ avg_ivb: -4 }));
    expect(g!.ivbGrade).toBeGreaterThan(100);
  });

  it('excludes iVB from the cutter composite (extreme iVB does not move stuffGrade)', () => {
    const [lo] = computePitchTypeGrades([pitch('FC', { ivb: -20 })], league());
    const [hi] = computePitchTypeGrades([pitch('FC', { ivb: 20 })], league());
    expect(lo!.stuffGrade).toBe(hi!.stuffGrade);
  });

  it('grades HB on magnitude, so a normal LHP pitch is not an outlier', () => {
    // -8" HB (LHP sign) with league abs avg 8" → dead average, grade ≈ 100.
    const [g] = computePitchTypeGrades([pitch('FF', { hb: -8 })], league());
    expect(g!.hbGrade).toBe(100);
  });

  it('falls back to neutral HB grade when abs stats are absent from config', () => {
    const la = league();
    delete la['FF']!.avg_abs_hb;
    delete la['FF']!.std_abs_hb;
    const [g] = computePitchTypeGrades([pitch('FF', { hb: -8 })], la);
    expect(g!.hbGrade).toBe(100);
  });
});
