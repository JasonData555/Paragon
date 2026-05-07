import { promises as fs } from 'fs';
import path from 'path';
import type { SurveyRecord } from './types';
import { loadSurveyData, invalidateCache } from './data-loader';
import { deduplicateRecords } from './deduplication';
import type { ImportResult } from './types';

function getDataPath(filename: string): string {
  return path.join(process.cwd(), 'data', filename);
}

function assertWritesEnabled(): void {
  if (process.env.ALLOW_WRITES !== 'true') {
    throw new Error(
      'Write operations are not available in this deployment. ' +
      'Manage data locally and redeploy to refresh the dataset.',
    );
  }
}

/**
 * Atomic write: write to .tmp file then rename to target.
 * Prevents data corruption if the process is interrupted mid-write.
 */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmpPath = filePath + '.tmp';
  await fs.writeFile(tmpPath, data, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function mergeRecords(newRecords: SurveyRecord[]): Promise<ImportResult> {
  assertWritesEnabled();

  const existing = loadSurveyData();
  const { toAdd, skipped } = deduplicateRecords(newRecords, existing);
  const merged = [...existing, ...toAdd];

  await atomicWrite(getDataPath('survey.json'), JSON.stringify(merged, null, 2));
  invalidateCache();

  return {
    added: toAdd.length,
    skipped: skipped.length,
    warnings: 0,
    skipped_details: skipped,
  };
}

export async function deleteRecords(ids: Set<string>): Promise<{ deleted: number }> {
  assertWritesEnabled();

  const existing = loadSurveyData();
  const remaining = existing.filter(r => !ids.has(r.id));
  const deleted = existing.length - remaining.length;

  await atomicWrite(getDataPath('survey.json'), JSON.stringify(remaining, null, 2));
  invalidateCache();

  return { deleted };
}

export async function deleteExpiredRecords(): Promise<{ deleted: number }> {
  assertWritesEnabled();

  const { calcAgeMonths } = await import('./recency-weights');
  const { RECENCY_MAX_MONTHS } = await import('./constants');

  const existing = loadSurveyData();
  const today = new Date();
  const remaining = existing.filter(r => calcAgeMonths(r.survey_date, today) <= RECENCY_MAX_MONTHS);
  const deleted = existing.length - remaining.length;

  if (deleted > 0) {
    await atomicWrite(getDataPath('survey.json'), JSON.stringify(remaining, null, 2));
    invalidateCache();
  }

  return { deleted };
}
