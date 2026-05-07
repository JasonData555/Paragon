import { readFileSync, existsSync } from 'fs';
import path from 'path';
import type { SurveyRecord, WeightedRecord } from './types';
import { calcAgeMonths, calcRecencyWeight } from './recency-weights';
import { RECENCY_MAX_MONTHS } from './constants';

// Module-level cache — parsed once per server process
let _cache: SurveyRecord[] | null = null;

function getSurveyPath(): string {
  return path.join(process.cwd(), 'data', 'survey.json');
}

export function loadSurveyData(): SurveyRecord[] {
  if (_cache) return _cache;

  const filePath = getSurveyPath();
  if (!existsSync(filePath)) {
    _cache = [];
    return _cache;
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as SurveyRecord[];
    _cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    _cache = [];
  }

  return _cache;
}

/**
 * Call after any write operation to clear the module cache.
 * Next request will re-read from disk.
 */
export function invalidateCache(): void {
  _cache = null;
}

/**
 * Attach recency weight to every record and exclude expired ones (age > 24 months).
 */
export function applyRecencyWeights(records: SurveyRecord[], now?: Date): WeightedRecord[] {
  const today = now ?? new Date();
  return records
    .map(r => {
      const age_months = calcAgeMonths(r.survey_date, today);
      const recency_weight = calcRecencyWeight(age_months);
      return { ...r, age_months, recency_weight };
    })
    .filter(r => r.age_months <= RECENCY_MAX_MONTHS);
}

/**
 * Unique industry values from the loaded dataset, sorted alphabetically.
 */
export function getUniqueIndustries(): string[] {
  const records = loadSurveyData();
  const industries = new Set<string>();
  for (const r of records) {
    if (r.industry) industries.add(r.industry);
  }
  return Array.from(industries).sort();
}

/**
 * Dataset health stats for the admin dashboard.
 */
export function getDatasetStats(now?: Date): {
  total: number;
  by_year: Record<number, number>;
  weighted_n: number;
  approaching_expiry: WeightedRecord[];
} {
  const records = loadSurveyData();
  const today = now ?? new Date();
  const weighted = applyRecencyWeights(records, today);

  const by_year: Record<number, number> = {};
  for (const r of records) {
    by_year[r.survey_year] = (by_year[r.survey_year] ?? 0) + 1;
  }

  // Kish effective N
  const { weightedEffectiveN } = require('./recency-weights');
  const wn = weightedEffectiveN(weighted.map(r => r.recency_weight));

  // Records approaching expiry (age >= 18 months)
  const approaching_expiry = weighted
    .filter(r => r.age_months >= 18)
    .sort((a, b) => b.age_months - a.age_months);

  return { total: records.length, by_year, weighted_n: wn, approaching_expiry };
}
