import { NextResponse } from 'next/server';
import { loadSurveyData, applyRecencyWeights } from '@/lib/data-loader';
import { deleteRecords } from '@/lib/data-store';
import { logAuditEvent } from '@/lib/audit-logger';
import { extractTokenFromCookie, isSessionValid } from '@/lib/admin-auth';
import { weightedEffectiveN } from '@/lib/recency-weights';
import type { SizeBucket } from '@/lib/types';

export const runtime = 'nodejs';

const PER_PAGE = 50;

function authCheck(request: Request): boolean {
  const token = extractTokenFromCookie(request.headers.get('cookie'));
  return isSessionValid(token);
}

export async function GET(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const yearFilter = searchParams.get('year');
  const sizeFilter = searchParams.get('size') as SizeBucket | null;
  const industryFilter = searchParams.get('industry');
  const emailSearch = searchParams.get('email');
  const minAgeMonths = searchParams.get('min_age') ? parseInt(searchParams.get('min_age')!, 10) : null;

  const records = loadSurveyData();
  const weighted = applyRecencyWeights(records);

  let filtered = weighted;
  if (yearFilter) filtered = filtered.filter(r => r.survey_year === parseInt(yearFilter, 10));
  if (sizeFilter) filtered = filtered.filter(r => r.size_bucket === sizeFilter);
  if (industryFilter) filtered = filtered.filter(r => r.industry === industryFilter);
  if (emailSearch) filtered = filtered.filter(r => r.email?.toLowerCase().includes(emailSearch.toLowerCase()));
  if (minAgeMonths != null) filtered = filtered.filter(r => r.age_months >= minAgeMonths);

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(total / PER_PAGE);
  const weightedN = weightedEffectiveN(filtered.map(r => r.recency_weight));

  return NextResponse.json({ records: paginated, total, page, total_pages: totalPages, weighted_n: weightedN });
}

export async function DELETE(request: Request) {
  if (!authCheck(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const confirmation = request.headers.get('X-Delete-Confirmation');
  if (confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Confirmation header required: X-Delete-Confirmation: DELETE' }, { status: 400 });
  }

  try {
    const { ids } = (await request.json()) as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    const result = await deleteRecords(new Set(ids));
    await logAuditEvent({
      action: 'DELETE',
      records_affected: result.deleted,
      detail: `Deleted ${result.deleted} records`,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
