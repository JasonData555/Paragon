import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/query-engine';
import type { QueryParams } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const params = body as QueryParams;
    // governance_selection is accepted for future use; matrix is precomputed for all combos
    // const governanceSelection = body.governance_selection;

    if (!params.role_tier) {
      return NextResponse.json({ error: 'role_tier is required' }, { status: 400 });
    }

    const t0 = Date.now();
    const result = executeQuery(params);
    const elapsed = Date.now() - t0;

    console.log(
      `Query: ${params.role_tier} / ${params.industry || 'all'} — ${result.profile_n} records / ${elapsed}ms`,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[query] error:', error);
    return NextResponse.json(
      { error: 'Query failed. Please try again.' },
      { status: 500 },
    );
  }
}
