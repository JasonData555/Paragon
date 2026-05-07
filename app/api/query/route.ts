import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/query-engine';
import type { QueryParams } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const params = (await request.json()) as QueryParams;

    if (!params.role_tier) {
      return NextResponse.json({ error: 'role_tier is required' }, { status: 400 });
    }

    const result = executeQuery(params);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[query] error:', error);
    return NextResponse.json(
      { error: 'Query failed. Please try again.' },
      { status: 500 },
    );
  }
}
