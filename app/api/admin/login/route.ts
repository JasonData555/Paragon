import { NextResponse } from 'next/server';
import { verifyPassword, createSessionToken, buildSessionCookieHeader } from '@/lib/admin-auth';
import { logAuditEvent } from '@/lib/audit-logger';

export const runtime = 'nodejs';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function POST(request: Request) {
  try {
    const ip = getIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    const { password } = await request.json();

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    const valid = await verifyPassword(password);

    if (!valid) {
      await logAuditEvent({ action: 'LOGIN_FAILED', records_affected: 0, detail: 'Invalid password attempt' });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    loginAttempts.delete(ip);
    const token = createSessionToken();
    await logAuditEvent({ action: 'LOGIN_SUCCESS', records_affected: 0, detail: 'Admin authenticated' });

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', buildSessionCookieHeader(token));
    return response;
  } catch (error) {
    console.error('[admin/login] error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
