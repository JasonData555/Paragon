'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, LogIn, LogOut, Upload, Trash2, FileText } from 'lucide-react';
import type { AuditEvent } from '@/lib/types';

interface AuditPage {
  events: AuditEvent[];
  total: number;
  page: number;
  total_pages: number;
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  LOGIN_SUCCESS: { icon: LogIn, color: 'text-paragon-success', label: 'Login' },
  LOGIN_FAILED: { icon: LogIn, color: 'text-paragon-danger', label: 'Login Failed' },
  IMPORT: { icon: Upload, color: 'text-paragon-accent-primary', label: 'Import' },
  DELETE: { icon: Trash2, color: 'text-paragon-warning', label: 'Delete' },
  EXPORT: { icon: FileText, color: 'text-paragon-text-muted', label: 'Export' },
  LOGOUT: { icon: LogOut, color: 'text-paragon-text-muted', label: 'Logout' },
};

export function AuditLogTable() {
  const [data, setData] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/audit?page=${page}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  function downloadCSV() {
    if (!data) return;
    const rows = [
      ['timestamp', 'action', 'ip', 'records_affected', 'detail'],
      ...data.events.map(e => [
        e.timestamp,
        e.action,
        e.ip ?? '',
        String(e.records_affected ?? ''),
        e.detail ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paragon_audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {data && (
          <span className="text-xs text-paragon-text-muted">{data.total} total events</span>
        )}
        <button
          onClick={downloadCSV}
          disabled={!data || data.events.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-paragon-border rounded-sm hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-4 animate-skeleton-pulse">
                <div className="w-16 h-3 bg-paragon-border rounded" />
                <div className="w-24 h-3 bg-paragon-border rounded" />
                <div className="h-3 bg-paragon-border rounded flex-1" />
              </div>
            ))}
          </div>
        ) : data && data.events.length > 0 ? (
          <table className="w-full text-xs">
            <thead className="border-b border-paragon-border bg-paragon-surface-primary">
              <tr>
                <th className="p-3 text-left font-medium text-paragon-text-muted">Timestamp</th>
                <th className="p-3 text-left font-medium text-paragon-text-muted">Action</th>
                <th className="p-3 text-left font-medium text-paragon-text-muted">Records</th>
                <th className="p-3 text-left font-medium text-paragon-text-muted">IP</th>
                <th className="p-3 text-left font-medium text-paragon-text-muted">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paragon-border/50">
              {data.events.map((e, i) => {
                const cfg = ACTION_CONFIG[e.action] ?? { icon: FileText, color: 'text-paragon-text-muted', label: e.action };
                const Icon = cfg.icon;
                return (
                  <tr key={i} className="hover:bg-paragon-surface-primary/50 transition-colors">
                    <td className="p-3 font-mono text-paragon-text-muted whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false,
                      })}
                    </td>
                    <td className="p-3">
                      <span className={`flex items-center gap-1.5 font-medium ${cfg.color}`}>
                        <Icon size={12} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="p-3 text-paragon-text-secondary">
                      {e.records_affected != null ? e.records_affected : '—'}
                    </td>
                    <td className="p-3 font-mono text-paragon-text-muted">{e.ip ?? '—'}</td>
                    <td className="p-3 text-paragon-text-secondary">{e.detail ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-sm text-paragon-text-muted">No audit events recorded yet.</div>
        )}
      </div>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-xs text-paragon-text-muted">
          <span>Page {data.page} of {data.total_pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 border border-paragon-border rounded-sm hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1">
              <ChevronLeft size={12} /> Prev
            </button>
            <button onClick={() => setPage(p => Math.min(data!.total_pages, p + 1))} disabled={page === data.total_pages}
              className="px-3 py-1.5 border border-paragon-border rounded-sm hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1">
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
