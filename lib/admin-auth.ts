import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

export const SESSION_COOKIE = 'paragon_admin_session';
const SESSION_DURATION_HOURS = 8;
const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 3600 * 1000;

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) throw new Error('ADMIN_PASSWORD_HASH not configured');
  return bcrypt.compare(password, hash);
}

export function createSessionToken(): string {
  const rand = randomBytes(24).toString('hex');
  return `${rand}:${Date.now()}`;
}

export function isSessionValid(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(':');
  if (parts.length < 2) return false;
  const timestamp = parseInt(parts[parts.length - 1], 10);
  if (isNaN(timestamp)) return false;
  return Date.now() - timestamp < SESSION_DURATION_MS;
}

export function buildSessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DURATION_HOURS * 3600}${secure}`;
}

export function extractTokenFromCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}
