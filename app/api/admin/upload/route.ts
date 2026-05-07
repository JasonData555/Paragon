import { NextResponse } from 'next/server';
import { loadSurveyData, applyRecencyWeights } from '@/lib/data-loader';
import { mergeRecords } from '@/lib/data-store';
import { logAuditEvent } from '@/lib/audit-logger';
import { extractTokenFromCookie, isSessionValid } from '@/lib/admin-auth';
import { deduplicateRecords } from '@/lib/deduplication';
import { calcAgeMonths } from '@/lib/recency-weights';
import { RECENCY_MAX_MONTHS } from '@/lib/constants';
import type { SurveyRecord, ValidationCheck, ValidationResult, MergePreview } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

const REQUIRED_COLUMNS = [
  'Annual Base Salary $',
  '_date',
  'Email Address',
  'Title-Level',
  'Company Structure',
  'Size_Bucket',
  'Which of the following functions do you currently own for your company?',
  'has_do',
  'has_indemnification',
  'has_severance',
  'has_accel_vest',
];

const COMPANY_STRUCTURE_MAP: Record<string, string> = {
  'Publicly Traded Company': 'Publicly Traded',
  'Privately Held Company': 'Privately Held',
  'Non-Profit': 'Non-Profit',
  'Government / Municipality': 'Government',
};

const ROLE_TIER_MAP: Record<string, string> = {
  'CISO / Head Security Level': 'CISO',
  'VP Security': 'VP Security',
  'Director': 'Director',
  'Manager': 'Manager',
};

export async function POST(request: Request) {
  const token = extractTokenFromCookie(request.headers.get('cookie'));
  if (!isSessionValid(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const step = searchParams.get('step');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Extension check
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'csv') {
      return NextResponse.json({ error: 'Only .xlsx and .csv files are accepted' }, { status: 400 });
    }

    // Size check (50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const parsed = await parseFile(buffer, ext);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (step === 'validate') {
      const validation = validateParsedData(parsed.rows!, parsed.headers!);
      return NextResponse.json(validation);
    }

    if (step === 'preview') {
      const records = transformRows(parsed.rows!, parsed.headers!);
      const existing = loadSurveyData();
      const { toAdd, skipped } = deduplicateRecords(records, existing);
      const today = new Date();
      const expiringAfter = toAdd.filter(r => {
        const age = calcAgeMonths(r.survey_date, today);
        return age >= 18;
      });

      const preview: MergePreview = {
        new_records: toAdd.length,
        duplicate_skipped: skipped.length,
        longitudinal: records.filter(r => r.email && existing.some(
          e => e.email?.toLowerCase() === r.email?.toLowerCase() && e.survey_year !== r.survey_year,
        )).length,
        expiring_after_upload: expiringAfter.length,
      };
      return NextResponse.json(preview);
    }

    if (step === 'import') {
      if (process.env.ALLOW_WRITES !== 'true') {
        return NextResponse.json(
          { error: 'Write operations are not available in this deployment. Manage data locally and redeploy.' },
          { status: 503 },
        );
      }

      const records = transformRows(parsed.rows!, parsed.headers!);
      const result = await mergeRecords(records);
      await logAuditEvent({
        action: 'IMPORT',
        records_affected: result.added,
        detail: `Added ${result.added}, skipped ${result.skipped} duplicates`,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid step parameter' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[admin/upload] error:', error);
    const msg = error instanceof Error ? error.message : 'Upload processing failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------
async function parseFile(
  buffer: Buffer,
  ext: string,
): Promise<{ success: boolean; error?: string; rows?: Record<string, unknown>[]; headers?: string[] }> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    let sheetName = workbook.SheetNames[0];
    if (workbook.SheetNames.includes('Clean Data')) sheetName = 'Clean Data';

    const sheet = workbook.Sheets[sheetName];

    // For uploaded files, try header row 0 first, then 2
    let rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

    // Check if required columns exist
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]);
      const hasRequired = REQUIRED_COLUMNS.some(col => keys.includes(col));
      if (!hasRequired) {
        // Try with header row offset
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, range: 2 });
      }
    }

    if (rows.length === 0) {
      return { success: false, error: 'File contains no data rows' };
    }

    const headers = Object.keys(rows[0]);
    return { success: true, rows, headers };
  } catch (err) {
    return { success: false, error: `Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
function validateParsedData(
  rows: Record<string, unknown>[],
  headers: string[],
): ValidationResult {
  const checks: ValidationCheck[] = [];
  let overallStatus: 'pass' | 'warn' | 'fail' = 'pass';

  // Required column checks
  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) {
      checks.push({ field: col, status: 'fail', detail: `Required column "${col}" not found` });
      overallStatus = 'fail';
    } else {
      checks.push({ field: col, status: 'pass', detail: 'Column present' });
    }
  }

  if (overallStatus === 'fail') {
    return { status: 'fail', row_count: rows.length, checks, duplicate_count: 0, longitudinal_count: 0 };
  }

  // Date validation
  const badDates = rows.filter(r => !r['_date']).length;
  if (badDates > 0) {
    checks.push({ field: '_date', status: 'warn', detail: `${badDates} rows have missing dates and will be skipped` });
    if (overallStatus === 'pass') overallStatus = 'warn';
  }

  // Salary validation
  const badSalaries = rows.filter(r => {
    const v = Number(r['Annual Base Salary $']);
    return isNaN(v) || v <= 0;
  }).length;
  if (badSalaries > 0) {
    checks.push({ field: 'Annual Base Salary $', status: 'warn', detail: `${badSalaries} rows have invalid salary values` });
    if (overallStatus === 'pass') overallStatus = 'warn';
  }

  // Outlier detection (>3 SD)
  const salaries = rows
    .map(r => Number(r['Annual Base Salary $']))
    .filter(v => !isNaN(v) && v > 0);
  if (salaries.length > 0) {
    const mean = salaries.reduce((s, v) => s + v, 0) / salaries.length;
    const std = Math.sqrt(salaries.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / salaries.length);
    const outliers = salaries.filter(v => Math.abs(v - mean) > 3 * std).length;
    if (outliers > 0) {
      checks.push({ field: 'Annual Base Salary $', status: 'warn', detail: `${outliers} salary values are statistical outliers (>3σ from mean of ${Math.round(mean / 1000)}K)` });
      if (overallStatus === 'pass') overallStatus = 'warn';
    }
  }

  // Duplicate detection
  const existing = loadSurveyData();
  const transformed = transformRows(rows, headers);
  const { toAdd, skipped } = deduplicateRecords(transformed, existing);
  const longitudinal = transformed.filter(r => r.email && existing.some(
    e => e.email?.toLowerCase() === r.email?.toLowerCase() && e.survey_year !== r.survey_year,
  )).length;

  if (skipped.length > 0) {
    checks.push({
      field: 'Duplicates',
      status: 'warn',
      detail: `${skipped.length} records match existing email + year combinations and will be skipped`,
    });
    if (overallStatus === 'pass') overallStatus = 'warn';
  }

  return {
    status: overallStatus,
    row_count: rows.length,
    checks,
    duplicate_count: skipped.length,
    longitudinal_count: longitudinal,
  };
}

// ---------------------------------------------------------------------------
// Transform rows to SurveyRecord[]
// ---------------------------------------------------------------------------
function transformRows(rows: Record<string, unknown>[], _headers: string[]): SurveyRecord[] {
  const records: SurveyRecord[] = [];

  for (const row of rows) {
    if (!row['_date']) continue;

    const functions = parseFunctions(row['Which of the following functions do you currently own for your company?']);
    const surveyDate = formatDate(row['_date']);
    if (!surveyDate) continue;

    records.push({
      id: uuidv4(),
      survey_date: surveyDate,
      survey_year: Math.floor(Number(row['_year'] ?? new Date(surveyDate).getFullYear())),
      email: safeStr(row['Email Address']),
      title: safeStr(row['Your Title']),
      role_tier: (ROLE_TIER_MAP[safeStr(row['Title-Level']) ?? ''] ?? 'CISO') as SurveyRecord['role_tier'],
      location: safeStr(row['Location']),
      metro_tier: deriveMetroTier(row),
      industry: cleanIndustry(row),
      company_structure: (COMPANY_STRUCTURE_MAP[safeStr(row['Company Structure']) ?? ''] ?? null) as SurveyRecord['company_structure'],
      size_bucket: (safeStr(row['Size_Bucket']) as SurveyRecord['size_bucket']) ?? null,
      reporting_to: safeStr(row['What is the title of person you report to?']),
      team_size: safeInt(row['Team Size']),
      base_salary: safeFloat(row['Annual Base Salary $']),
      bonus: safeFloat(row['Estimated Annual Bonus $']),
      equity: safeFloat(row['Estimated Annual Equity / RSU Value']),
      board_frequency: safeStr(row['How often do you present to the Board of Directors?']),
      functions,
      has_do: safeBool(row['has_do']),
      has_indemnification: safeBool(row['has_indemnification']),
      has_severance: safeBool(row['has_severance']),
      has_accel_vest: safeBool(row['has_accel_vest']),
      has_signing: safeBool(row['has_signing']),
      full_quad: safeBool(row['full_quad']),
      zero_quad: safeBool(row['zero_quad']),
      zero_protection: safeBool(row['zero_protection']),
      elevated_reporting: safeBool(row['elevated_reporting']),
      board_quarterly: safeBool(row['board_quarterly']),
      board_semi: safeBool(row['board_semi']),
      board_regular: safeBool(row['board_regular']),
      board_no_access: safeBool(row['board_no_access']),
      repeat_ciso: safeBool(row['repeat_ciso']),
      first_time_ciso: safeBool(row['first_time_ciso']),
    });
  }

  return records;
}

// Helpers
function safeStr(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
}
function safeInt(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : Math.floor(n);
}
function safeFloat(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function safeBool(v: unknown): boolean {
  return Number(v) === 1;
}
function formatDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

const FUNCTION_CANONICAL_MAP: Record<string, string | null> = {
  'Application Security': 'Product Security / AppSec',
  'Product Security': 'Product Security / AppSec',
  'Product Security / AppSec': 'Product Security / AppSec',
  'Identity & Access Management': 'Identity and Access Management / IAM',
  'Identity & Access Management / IAM': 'Identity and Access Management / IAM',
  'Identity and Access Management / IAM': 'Identity and Access Management / IAM',
  '3rd Party Risk Management (TPRM)': 'Third Party Risk Management (TPRM)',
  'Third Party Risk Management (TPRM)': 'Third Party Risk Management (TPRM)',
  'Trust & Safety (Content moderation, User issues, etc.)': 'Trust and Safety',
  'Trust and Safety': 'Trust and Safety',
  'AI Ethics & Responsible Use': 'AI Ethics and Responsible Use',
  'AI Ethics and Responsible Use': 'AI Ethics and Responsible Use',
  'AI Safety & Reliability': 'AI Safety and Reliability',
  'AI Safety and Reliability': 'AI Safety and Reliability',
  'AI Security & Safety': 'AI Security and Safety',
  'AI Security and Safety': 'AI Security and Safety',
  'AI Governance, Risk Management, and Policy': 'AI Governance Risk Management and Policy',
  'AI Governance Risk Management and Policy': 'AI Governance Risk Management and Policy',
  'Information Technology (IT) / Business Technology (BizApps)': 'Information Technology / BizApps',
  'Information Technology (IT)': 'Information Technology / BizApps',
  'Information Technology / BizApps': 'Information Technology / BizApps',
  'Infrastructure Engineering': 'Infrastructure Engineering / Operations',
  'Infrastructure Engineering / Operations': 'Infrastructure Engineering / Operations',
  'Enterprise Risk for the organization': 'Enterprise Risk',
  'Enterprise Risk': 'Enterprise Risk',
  'Risk & Fraud': 'Fraud',
  'AI Data Protection, Privacy, and Security': 'AI Data Protection, Privacy, and Security',
  'Other': null,
};

function parseFunctions(raw: unknown): string[] {
  if (!raw) return [];
  const str = String(raw).trim();
  if (!str) return [];

  // Parse as CSV to handle quoted fields with internal commas
  const results: string[] = [];
  let inQuotes = false;
  let current = '';

  for (const ch of str) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      const fn = current.trim();
      if (fn) results.push(fn);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) results.push(current.trim());

  return results
    .map(fn => FUNCTION_CANONICAL_MAP[fn] ?? fn)
    .filter((fn): fn is string => fn !== null && fn !== 'Other');
}

function deriveMetroTier(row: Record<string, unknown>): SurveyRecord['metro_tier'] {
  if (Number(row['tier1']) === 1 || Number(row['tier2']) === 1) return 'T1';
  if (Number(row['tier3']) === 1 || Number(row['tier4']) === 1) return 'T2';
  if (Number(row['tier5']) === 1 || Number(row['tier6']) === 1) return 'T3';
  return null;
}

function cleanIndustry(row: Record<string, unknown>): string | null {
  const clean = safeStr(row['What industry?']);
  if (clean) return clean;
  const raw = safeStr(row['Company Industry']);
  if (!raw) return null;
  return raw.split(',')[0].trim() || null;
}
