import { promises as fs } from 'fs';
import path from 'path';
import type { AuditEvent } from './types';

function getAuditPath(): string {
  return path.join(process.cwd(), 'data', 'audit.json');
}

async function readAuditLog(): Promise<AuditEvent[]> {
  try {
    const raw = await fs.readFile(getAuditPath(), 'utf-8');
    return JSON.parse(raw) as AuditEvent[];
  } catch {
    return [];
  }
}

export async function logAuditEvent(
  event: Omit<AuditEvent, 'timestamp'>,
): Promise<void> {
  // Only log if writes are enabled (audit writes locally)
  if (process.env.ALLOW_WRITES !== 'true' && event.action !== 'LOGIN_SUCCESS' && event.action !== 'LOGIN_FAILED') {
    return;
  }

  try {
    const existing = await readAuditLog();
    const newEvent: AuditEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    existing.push(newEvent);
    await fs.writeFile(getAuditPath(), JSON.stringify(existing, null, 2), 'utf-8');
  } catch {
    // Silently fail — audit logging must never block the main operation
  }
}

export async function getAuditLog(page = 1, perPage = 50): Promise<{
  events: AuditEvent[];
  total: number;
  page: number;
  total_pages: number;
}> {
  const all = await readAuditLog();
  const sorted = all.slice().reverse(); // most recent first
  const total = sorted.length;
  const total_pages = Math.max(1, Math.ceil(total / perPage));
  const events = sorted.slice((page - 1) * perPage, page * perPage);
  return { events, total, page, total_pages };
}
