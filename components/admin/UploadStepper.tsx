'use client';

import { useState, useCallback } from 'react';
import { CheckCircle2, ChevronRight, Upload, AlertTriangle, XCircle, FileText } from 'lucide-react';
import type { MergePreview, ValidationResult, ImportResult } from '@/lib/types';

type Step = 'select' | 'validate' | 'preview' | 'confirm';

const STEPS: { key: Step; label: string }[] = [
  { key: 'select',   label: '1. Select File' },
  { key: 'validate', label: '2. Validate' },
  { key: 'preview',  label: '3. Preview Merge' },
  { key: 'confirm',  label: '4. Import' },
];

export function UploadStepper() {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [warnsAcknowledged, setWarnsAcknowledged] = useState(false);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }, []);

  function selectFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'csv') {
      setError('Only .xlsx and .csv files are accepted');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB limit');
      return;
    }
    setError('');
    setFile(f);
  }

  async function runValidation() {
    if (!file) return;
    setValidating(true);
    setValidation(null);
    setStep('validate');

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/admin/upload?step=validate', { method: 'POST', body: fd });
      const data: ValidationResult = await res.json();
      setValidation(data);
    } catch {
      setError('Validation request failed');
    } finally {
      setValidating(false);
    }
  }

  async function runPreview() {
    if (!file) return;
    setPreviewing(true);
    setStep('preview');

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/admin/upload?step=preview', { method: 'POST', body: fd });
      const data: MergePreview = await res.json();
      setPreview(data);
    } catch {
      setError('Preview request failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function runImport() {
    if (!file) return;
    setImporting(true);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/admin/upload?step=import', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Import failed');
        return;
      }
      setImportResult(data as ImportResult);
      setStep('confirm');
    } catch {
      setError('Import request failed');
    } finally {
      setImporting(false);
    }
  }

  function downloadLog() {
    if (!importResult) return;
    const rows = [
      ['email', 'year', 'reason'],
      ...importResult.skipped_details.map(s => [s.email, String(s.year), s.reason]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paragon_import_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFails = validation?.checks.some(c => c.status === 'fail');
  const hasWarns = validation?.checks.some(c => c.status === 'warn');

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const idx = STEPS.findIndex(x => x.key === step);
          const done = i < idx;
          const active = s.key === step;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-sm ${
                done ? 'bg-paragon-success/10 text-paragon-success' :
                active ? 'bg-paragon-accent-primary text-white' :
                'bg-paragon-border/40 text-paragon-text-muted'
              }`}>
                {done && <CheckCircle2 size={12} />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight size={12} className="text-paragon-text-muted" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Select */}
      {step === 'select' && (
        <div className="card p-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-sm p-10 text-center transition-colors cursor-pointer ${
              dragging ? 'border-paragon-accent-primary bg-paragon-mint-chip/30' : 'border-paragon-border hover:border-paragon-border-dark'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload size={32} className="mx-auto mb-3 text-paragon-text-muted" />
            <p className="text-sm text-paragon-text-primary mb-1">Drop your file here or click to browse</p>
            <p className="text-xs text-paragon-text-muted">.xlsx or .csv, max 50MB</p>
          </div>
          <input id="file-input" type="file" accept=".xlsx,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f); }} />

          {file && (
            <div className="flex items-center gap-3 mt-4 p-3 bg-paragon-surface-primary rounded-sm border border-paragon-border">
              <FileText size={16} className="text-paragon-accent-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-paragon-text-primary truncate">{file.name}</div>
                <div className="text-xs text-paragon-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-paragon-danger mt-2">{error}</p>}

          <button
            onClick={runValidation}
            disabled={!file}
            className="mt-4 px-4 py-2 bg-paragon-accent-primary hover:bg-paragon-accent-hover text-white text-sm rounded-sm transition-colors disabled:opacity-50"
          >
            Continue to Validation →
          </button>
        </div>
      )}

      {/* Step 2: Validate */}
      {step === 'validate' && (
        <div className="card p-6">
          {validating ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex gap-4 items-center animate-skeleton-pulse">
                  <div className="w-4 h-4 bg-paragon-border rounded-full" />
                  <div className="h-3 bg-paragon-border rounded flex-1" />
                  <div className="h-3 bg-paragon-border rounded w-24" />
                </div>
              ))}
            </div>
          ) : validation ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-paragon-text-secondary">{validation.row_count} rows detected</span>
                <StatusBadge status={validation.status} />
              </div>

              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-paragon-border text-paragon-text-muted">
                    <th className="text-left pb-2">Field</th>
                    <th className="text-left pb-2">Status</th>
                    <th className="text-left pb-2">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paragon-border/50">
                  {validation.checks.map((c, i) => (
                    <tr key={i}>
                      <td className="py-2 font-medium">{c.field}</td>
                      <td className="py-2"><StatusBadge status={c.status} /></td>
                      <td className="py-2 text-paragon-text-secondary">{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hasWarns && !hasFails && (
                <label className="flex items-start gap-2 text-xs text-paragon-text-secondary cursor-pointer">
                  <input type="checkbox" checked={warnsAcknowledged} onChange={e => setWarnsAcknowledged(e.target.checked)} className="mt-0.5" />
                  I acknowledge the warnings above and wish to proceed.
                </label>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('select')} className="px-3 py-2 text-sm border border-paragon-border rounded-sm hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
                <button
                  onClick={runPreview}
                  disabled={hasFails || (hasWarns && !warnsAcknowledged)}
                  className="px-4 py-2 bg-paragon-accent-primary hover:bg-paragon-accent-hover text-white text-sm rounded-sm transition-colors disabled:opacity-50"
                >
                  Continue to Preview →
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="card p-6">
          {previewing ? (
            <div className="space-y-3 animate-skeleton-pulse">
              <div className="h-4 bg-paragon-border rounded w-48" />
              <div className="h-3 bg-paragon-border rounded w-full" />
              <div className="h-3 bg-paragon-border rounded w-3/4" />
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Merge Preview</h3>

              <div className="grid grid-cols-2 gap-3">
                <PreviewStat label="New records to add" value={preview.new_records} color="text-paragon-success" />
                <PreviewStat label="Duplicates (will be skipped)" value={preview.duplicate_skipped} color="text-paragon-text-muted" />
                <PreviewStat label="Longitudinal (same email, diff year)" value={preview.longitudinal} color="text-paragon-accent-primary" />
                <PreviewStat label="Records ≥18 months old" value={preview.expiring_after_upload} color="text-paragon-warning" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('validate')} className="px-3 py-2 text-sm border border-paragon-border rounded-sm hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
                <button
                  onClick={runImport}
                  disabled={importing || preview.new_records === 0}
                  className="px-4 py-2 bg-paragon-accent-primary hover:bg-paragon-accent-hover text-white text-sm rounded-sm transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing…' : `Confirm and Import ${preview.new_records} Records`}
                </button>
              </div>
              {error && <p className="text-xs text-paragon-danger">{error}</p>}
            </div>
          ) : null}
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && importResult && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 size={24} className="text-paragon-success" />
            <h3 className="text-base font-medium text-paragon-text-primary">Import Complete</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <PreviewStat label="Records added" value={importResult.added} color="text-paragon-success" />
            <PreviewStat label="Duplicates skipped" value={importResult.skipped} color="text-paragon-text-muted" />
            <PreviewStat label="Warnings" value={importResult.warnings} color="text-paragon-warning" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadLog}
              className="px-4 py-2 border border-paragon-border rounded-sm text-sm hover:bg-gray-50 transition-colors"
            >
              Download Import Log (CSV)
            </button>
            <button
              onClick={() => { setStep('select'); setFile(null); setValidation(null); setPreview(null); setImportResult(null); }}
              className="px-4 py-2 bg-paragon-accent-primary hover:bg-paragon-accent-hover text-white text-sm rounded-sm transition-colors"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  const map = { pass: 'text-paragon-success', warn: 'text-paragon-warning', fail: 'text-paragon-danger' } as const;
  const Icon = status === 'pass' ? CheckCircle2 : status === 'warn' ? AlertTriangle : XCircle;
  return <span className={`flex items-center gap-1 ${map[status]}`}><Icon size={12} />{status}</span>;
}

function PreviewStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-paragon-surface-primary p-3 rounded-sm border border-paragon-border">
      <div className={`text-xl font-medium ${color}`}>{value}</div>
      <div className="text-xs text-paragon-text-muted mt-0.5">{label}</div>
    </div>
  );
}
