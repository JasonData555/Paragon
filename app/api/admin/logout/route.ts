import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/admin-auth';
import { logAuditEvent } from '@/lib/audit-logger';

export const runtime = 'nodejs';

export async function POST() {
  await logAuditEvent({ action: 'LOGOUT', records_affected: 0, detail: 'Admin logged out' });
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
