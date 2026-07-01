import { describe, it, expect } from 'vitest';
import {
  fitLocationModel, sampleFromModel, densityGrid, empiricalGrid,
  PLATE_BOUNDS, type PlatePoint,
} from '../locationDensity';

// Deterministic RNG so the sampling test is reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A correlated cloud: down-and-glove-side drift (negative x/z correlation).
function makeCloud(n: number, rng: () => number): PlatePoint[] {
  const pts: PlatePoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * 2 - 1, b = rng() * 2 - 1;
    pts.push({ px: -0.4 + 0.5 * a, pz: 2.2 + 0.4 * b - 0.25 * a });
  }
  return pts;
}

describe('fitLocationModel', () => {
  it('recovers the mean and flags small samples as not ok', () => {
    const pts = makeCloud(200, mulberry32(1));
    const m = fitLocationModel(pts, 40);
    expect(m.ok).toBe(true);
    expect(m.mu[0]).toBeCloseTo(-0.4, 1);
    expect(m.mu[1]).toBeCloseTo(2.2, 1);
    expect(fitLocationModel(pts.slice(0, 10), 40).ok).toBe(false);
  });

  it('produces a valid Cholesky factor (L11>0, L22>0)', () => {
    const m = fitLocationModel(makeCloud(200, mulberry32(2)), 40);
    expect(m.L[0]).toBeGreaterThan(0);
    expect(m.L[2]).toBeGreaterThan(0);
  });
});

describe('densityGrid', () => {
  it('peaks at the cell containing the mean', () => {
    const m = fitLocationModel(makeCloud(300, mulberry32(3)), 40);
    const g = densityGrid(m, 36);
    let best = -1, bj = 0, bi = 0;
    for (let j = 0; j < g.length; j++)
      for (let i = 0; i < g[j]!.length; i++)
        if (g[j]![i]! > best) { best = g[j]![i]!; bj = j; bi = i; }
    expect(best).toBeCloseTo(1, 5); // normalized peak == 1
    // Peak cell maps back near the fitted mean.
    const { xMin, xMax, zMin, zMax } = PLATE_BOUNDS;
    const peakX = xMin + ((bi + 0.5) / 36) * (xMax - xMin);
    const peakZ = zMax - ((bj + 0.5) / 36) * (zMax - zMin);
    expect(peakX).toBeCloseTo(m.mu[0], 0);
    expect(peakZ).toBeCloseTo(m.mu[1], 0);
  });
});

describe('empiricalGrid', () => {
  it('is normalized to a peak of 1 and is non-empty for real points', () => {
    const g = empiricalGrid(makeCloud(150, mulberry32(4)), 36);
    const flat = g.flat();
    expect(Math.max(...flat)).toBeCloseTo(1, 5);
    expect(flat.some((v) => v > 0)).toBe(true);
  });
});

// CONTRACT for the function left to implement. Fails on the placeholder
// (which returns the mean every time → zero variance), passes once
// sampleFromModel applies the Cholesky transform μ + L·z.
describe('sampleFromModel (your implementation)', () => {
  it('reproduces the fitted mean and covariance over many draws', () => {
    const model = fitLocationModel(makeCloud(400, mulberry32(5)), 40);
    const rng = mulberry32(99);
    const N = 8000;
    let mx = 0, mz = 0;
    const xs: number[] = [], zs: number[] = [];
    for (let i = 0; i < N; i++) {
      const [x, z] = sampleFromModel(model, rng);
      xs.push(x); zs.push(z); mx += x; mz += z;
    }
    mx /= N; mz /= N;
    // Mean recovered.
    expect(mx).toBeCloseTo(model.mu[0], 1);
    expect(mz).toBeCloseTo(model.mu[1], 1);
    // Variance is non-degenerate (placeholder returns a constant → 0 variance).
    let vx = 0, vz = 0, cxz = 0;
    for (let i = 0; i < N; i++) { const dx = xs[i]! - mx, dz = zs[i]! - mz; vx += dx * dx; vz += dz * dz; cxz += dx * dz; }
    vx /= N; vz /= N; cxz /= N;
    expect(vx).toBeCloseTo(model.cov[0], 1);
    expect(vz).toBeCloseTo(model.cov[2], 1);
    // Correlation sign matches the fitted covariance (the down-and-in tilt).
    expect(Math.sign(cxz)).toBe(Math.sign(model.cov[1]));
  });
});
