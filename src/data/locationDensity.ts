/**
 * locationDensity.ts — pure math for the Pitch Location Simulator.
 *
 * A pitcher's plate locations for one (pitch type × batter hand) cell are modeled
 * as a single 2-D Gaussian in (plate_x, plate_z) feet. We fit it from the real
 * shipped px/pz, then (a) SAMPLE from it to "throw" simulated pitches and
 * (b) evaluate its DENSITY on a grid for the smooth contour panel. The "actual"
 * panel uses `empiricalGrid` (a smoothed histogram of the real points) so the
 * side-by-side shows how well the Gaussian approximates reality.
 *
 * All geometry is in feet; the rendering layer converts to pixels.
 */

// Plate-region bounds (feet) — shared with the canvas renderer & PitchHeatmap.
export const PLATE_BOUNDS = { xMin: -2, xMax: 2, zMin: 0.5, zMax: 4.5 } as const;
export const STRIKE_ZONE = { xMin: -0.83, xMax: 0.83, zMin: 1.5, zMax: 3.5 } as const;

/** A fitted 2-D Gaussian. `cov` = [σxx, σxz, σzz]; `L` = lower-Cholesky [L11, L21, L22]. */
export interface LocationModel {
  n: number;
  ok: boolean;                          // enough data AND non-degenerate covariance
  mu: readonly [number, number];        // [meanX, meanZ]
  cov: readonly [number, number, number];
  L: readonly [number, number, number]; // precomputed Cholesky factor of cov
}

export interface PlatePoint { px: number; pz: number }

const EPS = 1e-3; // covariance ridge: keeps the fit non-singular at low n

/** Fit a 2-D Gaussian (mean + covariance) to a cell's plate locations. */
export function fitLocationModel(pts: readonly PlatePoint[], minN = 40): LocationModel {
  const n = pts.length;
  if (n < 2) {
    return { n, ok: false, mu: [0, 2], cov: [0, 0, 0], L: [0, 0, 0] };
  }
  let mx = 0, mz = 0;
  for (const p of pts) { mx += p.px; mz += p.pz; }
  mx /= n; mz /= n;

  let sxx = 0, sxz = 0, szz = 0;
  for (const p of pts) {
    const dx = p.px - mx, dz = p.pz - mz;
    sxx += dx * dx; sxz += dx * dz; szz += dz * dz;
  }
  // Sample covariance (n-1), ridged so a degenerate cell still inverts/factors.
  const d = n - 1;
  sxx = sxx / d + EPS; sxz = sxz / d; szz = szz / d + EPS;

  // Cholesky of [[sxx, sxz], [sxz, szz]].
  const L11 = Math.sqrt(sxx);
  const L21 = sxz / L11;
  const L22 = Math.sqrt(Math.max(szz - L21 * L21, 0));

  const det = sxx * szz - sxz * sxz;
  const ok = n >= minN && det > 0 && L22 > 0;
  return { n, ok, mu: [mx, mz], cov: [sxx, sxz, szz], L: [L11, L21, L22] };
}

/** Standard normal draw via Box–Muller, using the provided uniform RNG. */
export function randn(rng: () => number = Math.random): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Draw ONE simulated pitch location [x, z] (feet) from the fitted model.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(you): implement the correlated-Gaussian sample. This is the core of the
 * simulator — the "Throw a pitch" button calls it.
 *
 * To sample from a 2-D Gaussian with mean μ and covariance Σ, you draw two
 * INDEPENDENT standard normals z = [z1, z2] and apply the Cholesky factor L
 * (already precomputed in `m.L` as [L11, L21, L22], the lower triangle of Σ):
 *
 *     x = μ.x + L11·z1
 *     z = μ.z + L21·z1 + L22·z2
 *
 * Why L and not just σ per axis? Because plate_x and plate_z are CORRELATED
 * (e.g. a slider drifts down-and-glove-side together). L bakes that tilt into
 * the cloud so samples lean the same way the real pitches do — using only the
 * diagonal would produce an axis-aligned blob that ignores the correlation.
 *
 * Use `randn(rng)` for each independent normal. ~4 lines.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function sampleFromModel(m: LocationModel, rng: () => number = Math.random): [number, number] {
  // Two independent standard normals, transformed by the Cholesky factor L so
  // the cloud inherits the real pitch's x/z correlation (the down-and-in tilt).
  const z1 = randn(rng);
  const z2 = randn(rng);
  return [
    m.mu[0] + m.L[0] * z1,                 // x = μx + L11·z1
    m.mu[1] + m.L[1] * z1 + m.L[2] * z2,   // z = μz + L21·z1 + L22·z2
  ];
}

/**
 * Evaluate the model's Gaussian density on a G×G grid over PLATE_BOUNDS,
 * normalized so the peak = 1. Row j=0 is the TOP (high z) to match canvas rows.
 */
export function densityGrid(m: LocationModel, g = 36): number[][] {
  const { xMin, xMax, zMin, zMax } = PLATE_BOUNDS;
  const [sxx, sxz, szz] = m.cov;
  const det = sxx * szz - sxz * sxz || EPS;
  // Inverse covariance entries.
  const iXX = szz / det, iXZ = -sxz / det, iZZ = sxx / det;
  const out: number[][] = [];
  let max = 0;
  for (let j = 0; j < g; j++) {
    const z = zMax - ((j + 0.5) / g) * (zMax - zMin);
    const row = new Array<number>(g);
    for (let i = 0; i < g; i++) {
      const x = xMin + ((i + 0.5) / g) * (xMax - xMin);
      const dx = x - m.mu[0], dz = z - m.mu[1];
      const quad = iXX * dx * dx + 2 * iXZ * dx * dz + iZZ * dz * dz;
      const v = Math.exp(-0.5 * quad);
      row[i] = v;
      if (v > max) max = v;
    }
    out.push(row);
  }
  if (max > 0) for (const row of out) for (let i = 0; i < g; i++) row[i]! /= max;
  return out;
}

/**
 * Empirical density of REAL points: a Gaussian-smoothed histogram on a G×G grid
 * over PLATE_BOUNDS, normalized to peak = 1. This is the "Actual" panel — kept
 * non-parametric on purpose so it can show multimodality the single Gaussian can't.
 */
export function empiricalGrid(pts: readonly PlatePoint[], g = 36, sigmaCells = 1.3): number[][] {
  const { xMin, xMax, zMin, zMax } = PLATE_BOUNDS;
  const grid: number[][] = Array.from({ length: g }, () => new Array<number>(g).fill(0));
  const xr = xMax - xMin, zr = zMax - zMin;
  const reach = Math.ceil(3 * sigmaCells);
  const twoS2 = 2 * sigmaCells * sigmaCells;
  for (const p of pts) {
    const gx = ((p.px - xMin) / xr) * g;
    const gy = ((zMax - p.pz) / zr) * g; // invert z so top row = high z
    const iMin = Math.max(0, Math.floor(gx - reach)), iMax = Math.min(g - 1, Math.ceil(gx + reach));
    const jMin = Math.max(0, Math.floor(gy - reach)), jMax = Math.min(g - 1, Math.ceil(gy + reach));
    for (let j = jMin; j <= jMax; j++) {
      const row = grid[j]!;
      for (let i = iMin; i <= iMax; i++) {
        const ddx = gx - (i + 0.5), ddy = gy - (j + 0.5);
        row[i]! += Math.exp(-(ddx * ddx + ddy * ddy) / twoS2);
      }
    }
  }
  let max = 0;
  for (const row of grid) for (let i = 0; i < g; i++) if (row[i]! > max) max = row[i]!;
  if (max > 0) for (const row of grid) for (let i = 0; i < g; i++) row[i]! /= max;
  return grid;
}
