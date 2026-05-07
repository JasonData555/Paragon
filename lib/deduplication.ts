import type { SurveyRecord } from './types';

export interface DeduplicationResult {
  toAdd: SurveyRecord[];
  skipped: Array<{ email: string; year: number; reason: string }>;
}

/**
 * Deduplication rules:
 * - Duplicate = same email (case-insensitive) + same survey_year → SKIP
 * - Same email + different year = longitudinal → KEEP BOTH
 * - Records with null email → always keep (cannot deduplicate)
 */
export function deduplicateRecords(
  incoming: SurveyRecord[],
  existing: SurveyRecord[],
): DeduplicationResult {
  const existingKeys = new Set(
    existing
      .filter(r => r.email)
      .map(r => `${r.email!.toLowerCase()}:${r.survey_year}`),
  );

  const toAdd: SurveyRecord[] = [];
  const skipped: Array<{ email: string; year: number; reason: string }> = [];

  for (const record of incoming) {
    if (!record.email) {
      // No email — cannot deduplicate, always add
      toAdd.push(record);
      continue;
    }

    const key = `${record.email.toLowerCase()}:${record.survey_year}`;
    if (existingKeys.has(key)) {
      skipped.push({
        email: record.email,
        year: record.survey_year,
        reason: `Duplicate: same email + year ${record.survey_year}`,
      });
    } else {
      toAdd.push(record);
      // Add to set to catch duplicates within the incoming batch itself
      existingKeys.add(key);
    }
  }

  return { toAdd, skipped };
}
