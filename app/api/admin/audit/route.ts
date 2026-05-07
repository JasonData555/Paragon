import { NextResponse } from 'next/server';
import { getAuditLog } from '@/lib/audit-logger';
import { extractTokenFromCookie, isSessionValid } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = extractTokenFromCookie(request.headers.get('cookie'));
  if (!isSessionValid(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const result = await getAuditLog(page, 50);
  return NextResponse.json(result);
}
