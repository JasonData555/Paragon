'use client';

import { useState, useRef } from 'react';
import { Download, FileText } from 'lucide-react';
import type { QueryResult, QueryParams, OperatingMode } from '@/lib/types';

interface ExportButtonProps {
  result: QueryResult;
  params: QueryParams;
  mode: OperatingMode;
}

export function ExportButton({ result, params, mode }: ExportButtonProps) {
  const [showInput, setShowInput] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function openInput() {
    setShowInput(true);
    setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function runExport() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryResult: result, params, recipientName: recipientName || undefined }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paragon_${mode}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setShowInput(false);
      setRecipientName('');
    } catch {
      setError('Export request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 justify-end">
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={recipientName}
            onChange={e => setRecipientName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runExport(); if (e.key === 'Escape') setShowInput(false); }}
            placeholder="Recipient name (optional)"
            className="text-sm border border-paragon-border rounded-sm px-3 py-1.5 w-52 focus:outline-none focus:border-paragon-accent-primary transition-colors"
          />
          <button
            onClick={runExport}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-paragon-accent-primary hover:bg-paragon-accent-hover text-white text-sm rounded-sm transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>Generating…</>
            ) : (
              <><Download size={14} /> Export PDF</>
            )}
          </button>
          <button
            onClick={() => setShowInput(false)}
            className="text-xs text-paragon-text-muted hover:text-paragon-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={openInput}
          className="flex items-center gap-1.5 px-4 py-1.5 border border-paragon-border bg-white hover:bg-paragon-surface-primary text-paragon-text-secondary text-sm rounded-sm transition-colors"
        >
          <FileText size={14} />
          Export Brief
        </button>
      )}
      {error && <p className="text-xs text-paragon-danger">{error}</p>}
    </div>
  );
}
