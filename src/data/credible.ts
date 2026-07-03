/**
 * Beta-binomial shrinkage + credible intervals for displayed rate stats.
 *
 * The Python side (arsenal_matchup.py) exports RAW counts plus method-of-
 * moments prior strengths (league.prior_n). Client-side we form the posterior
 *   Beta(x + m·k, (n − x) + (1 − m)·k)
 * where m = league (prior) rate and k = prior strength in pseudo-pitches.
 * The displayed rate is the posterior mean; the 90% credible interval uses a
 * normal approximation of the Beta posterior — accurate to ~1pt for the
 * n ≥ 10 cells we render, and dependency-free.
 */

export interface CredibleRate {
  /** observed rate x/n (null when n = 0) */
  raw: number | null;
  /** posterior mean — the rate to display */
  rate: number;
  /** 90% credible interval */
  lo: number;
  hi: number;
  n: number;
}

export function shrinkRate(x: number, n: number, priorMean: number, priorN: number): CredibleRate {
  const alpha = x + priorMean * priorN;
  const beta = (n - x) + (1 - priorMean) * priorN;
  const total = alpha + beta;
  const mean = alpha / total;
  const sd = Math.sqrt((mean * (1 - mean)) / (total + 1));
  return {
    raw: n > 0 ? x / n : null,
    rate: mean,
    lo: Math.max(0, mean - 1.645 * sd),
    hi: Math.min(1, mean + 1.645 * sd),
    n,
  };
}

/** Variance of the posterior mean — used to propagate CI through weighted sums. */
export function shrinkVariance(x: number, n: number, priorMean: number, priorN: number): number {
  const alpha = x + priorMean * priorN;
  const beta = (n - x) + (1 - priorMean) * priorN;
  const total = alpha + beta;
  const mean = alpha / total;
  return (mean * (1 - mean)) / (total + 1);
}
