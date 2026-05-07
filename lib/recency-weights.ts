import { RECENCY_DECAY_FACTOR, RECENCY_MAX_MONTHS } from './constants';

/**
 * Months between survey_date and today (truncated, not rounded).
 */
export function calcAgeMonths(surveyDate: string, now: Date = new Date()): number {
  const d = new Date(surveyDate);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

/**
 * Linear decay weight: 1.0 at 0 months → 0.60 at 24 months.
 * Returns 0 for records older than RECENCY_MAX_MONTHS (should not exist after admin aging).
 */
export function calcRecencyWeight(ageMonths: number): number {
  if (ageMonths > RECENCY_MAX_MONTHS) return 0;
  return 1 - (ageMonths / RECENCY_MAX_MONTHS) * RECENCY_DECAY_FACTOR;
}

/**
 * Weighted percentile using cumulative weight threshold (NOT rank-based).
 * This is the correct implementation for recency-weighted comp calculations.
 */
export function weightedPercentile(
  values: number[],
  weights: number[],
  percentile: number,
): number {
  if (values.length === 0) return 0;

  const pairs = values
    .map((v, i) => ({ value: v, weight: weights[i] }))
    .sort((a, b) => a.value - b.value);

  const totalWeight = pairs.reduce((s, p) => s + p.weight, 0);
  const target = (percentile / 100) * totalWeight;

  let cumulative = 0;
  for (const pair of pairs) {
    cumulative += pair.weight;
    if (cumulative >= target) return pair.value;
  }
  return pairs[pairs.length - 1].value;
}

/**
 * Kish effective sample size: (Σw)² / Σw²
 * Always ≤ raw N. Used to report confidence levels.
 */
export function weightedEffectiveN(weights: number[]): number {
  if (weights.length === 0) return 0;
  const sumW = weights.reduce((s, w) => s + w, 0);
  const sumW2 = weights.reduce((s, w) => s + w * w, 0);
  if (sumW2 === 0) return 0;
  return Math.round((sumW * sumW) / sumW2);
}

/**
 * Weighted frequency rate: Σ(weight × flag) / Σ(weight)
 */
export function weightedRate(flags: boolean[], weights: number[]): number {
  if (flags.length === 0) return 0;
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = flags.reduce((s, f, i) => s + (f ? weights[i] : 0), 0);
  return weightedSum / totalWeight;
}
