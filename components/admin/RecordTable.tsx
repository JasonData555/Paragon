'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, AlertTriangle } from 'lucide-react';
import type { WeightedRecord } from '@/lib/types';

interface PagedResponse {
  records: WeightedRecord[];
  total: number;
  page: number;
  total_pages: number;
  weighted_n: number;
}

type SortKey = 'survey_date' | 'age_months' | 'base_salary' | 'survey_year' | 'industry' | 'size_bucket';
type SortDir = 'asc' | 'desc';

function ageColor(months: number): string {
  if (months < 12) return 'text-paragon-success';
  if (months < 18) return 'text-paragon-warning';
  return 'text-paragon-danger';
}

export function RecordTable() {
  const [data, setData] = useState<PagedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('survey_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Filters
  const [yearFilter, setYearFilter] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [minAge, setMinAge] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (yearFilter) params.set('year', yearFilter);
    if (emailSearch) params.set('email', emailSearch);
    if (minAge) params.set('min_age', minAge);

    try {
      const res = await fetch(`/api/admin/records?${params}`);
      if (res.ok) {
        const json: PagedResponse = await res.json();
        // Client-side sort since API returns flat list
        json.records.sort((a, b) => {
          let av: string | number = a[sortKey] ?? '';
          let bv: string | number = b[sortKey] ?? '';
          if (typeof av === 'number' && typeof bv === 'number') {
            return sortDir === 'asc' ? av - bv : bv - av;
          }
          av = String(av); bv = String(bv);
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [page, yearFilter, emailSearch, minAge, sortKey, sortDir]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    const allIds = data.records.map(r => r.id);
    const allSelected = allIds.every(id => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  async function runDelete() {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/admin/records', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Delete-Confirmation': 'DELETE',
        },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json.error ?? 'Delete failed');
        return;
      }
      setSelected(new Set());
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      await fetchRecords();
    } catch {
      setDeleteError('Delete request failed');
    } finally {
      setDeleting(false);
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }

  const fmt = (n: number | null) => n == null ? '—' : `$${n.toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label-caps mb-1">Year</label>
          <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setPage(1); }}
            className="block text-sm border border-paragon-border rounded-sm px-2 py-1.5 bg-white text-paragon-text-primary">
            <option value="">All years</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
        </div>
        <div>
          <label className="label-caps mb-1">Age ≥ (months)</label>
          <input type="number" min="0" max="24" value={minAge} placeholder="0"
            onChange={e => { setMinAge(e.target.value); setPage(1); }}
            className="block w-24 text-sm border border-paragon-border rounded-sm px-2 py-1.5" />
        </div>
        <div className="flex-1 min-w-48">
          <label className="label-caps mb-1">Email search</label>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-paragon-text-muted" />
            <input value={emailSearch} placeholder="Search email…"
              onChange={e => { setEmailSearch(e.target.value); setPage(1); }}
              className="w-full text-sm border border-paragon-border rounded-sm pl-7 pr-2 py-1.5" />
          </div>
        </div>
        {data && (
          <div className="text-xs text-paragon-text-muted ml-auto">
            {data.total} records · weighted N = {data.weighted_n}
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-sm text-sm">
          <span className="text-amber-800">{selected.size} record{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteError(''); }}
            className="flex items-center gap-1.5 px-3 py-1 bg-paragon-danger text-white rounded-sm text-xs hover:bg-red-700 transition-colors"
          >
            <Trash2 size={12} />
            Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-amber-700 hover:underline ml-auto">
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-4 animate-skeleton-pulse">
                <div className="w-4 h-4 bg-paragon-border rounded" />
                <div className="h-3 bg-paragon-border rounded flex-1" />
                <div className="h-3 bg-paragon-border rounded w-20" />
                <div className="h-3 bg-paragon-border rounded w-20" />
              </div>
            ))}
          </div>
        ) : data && data.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-paragon-border bg-paragon-surface-primary">
                <tr>
                  <th className="p-3 w-8">
                    <input type="checkbox"
                      checked={data.records.every(r => selected.has(r.id))}
                      onChange={toggleAll} />
                  </th>
                  <ThCol label="Date" col="survey_date" sortKey={sortKey} onClick={() => toggleSort('survey_date')}>
                    <SortIcon col="survey_date" />
                  </ThCol>
                  <ThCol label="Age (mo)" col="age_months" sortKey={sortKey} onClick={() => toggleSort('age_months')}>
                    <SortIcon col="age_months" />
                  </ThCol>
                  <ThCol label="Year" col="survey_year" sortKey={sortKey} onClick={() => toggleSort('survey_year')}>
                    <SortIcon col="survey_year" />
                  </ThCol>
                  <ThCol label="Industry" col="industry" sortKey={sortKey} onClick={() => toggleSort('industry')}>
                    <SortIcon col="industry" />
                  </ThCol>
                  <ThCol label="Size" col="size_bucket" sortKey={sortKey} onClick={() => toggleSort('size_bucket')}>
                    <SortIcon col="size_bucket" />
                  </ThCol>
                  <ThCol label="Base Salary" col="base_salary" sortKey={sortKey} onClick={() => toggleSort('base_salary')}>
                    <SortIcon col="base_salary" />
                  </ThCol>
                  <th className="p-3 text-left font-medium text-paragon-text-muted">Governance</th>
                  <th className="p-3 text-left font-medium text-paragon-text-muted">Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paragon-border/50">
                {data.records.map(r => (
                  <>
                    <tr
                      key={r.id}
                      className="hover:bg-paragon-surface-primary/50 cursor-pointer transition-colors"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    >
                      <td className="p-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} />
                      </td>
                      <td className="p-3 font-medium text-paragon-text-primary">{r.survey_date}</td>
                      <td className={`p-3 font-medium ${ageColor(r.age_months)}`}>{r.age_months}</td>
                      <td className="p-3 text-paragon-text-secondary">{r.survey_year}</td>
                      <td className="p-3 text-paragon-text-secondary max-w-40 truncate">{r.industry ?? '—'}</td>
                      <td className="p-3 text-paragon-text-secondary">{r.size_bucket ?? '—'}</td>
                      <td className="p-3 font-medium text-paragon-text-primary">{fmt(r.base_salary)}</td>
                      <td className="p-3">
                        <GovernanceDots r={r} />
                      </td>
                      <td className="p-3 text-paragon-text-muted">{r.recency_weight.toFixed(2)}</td>
                    </tr>
                    {expanded === r.id && (
                      <tr key={`${r.id}-expanded`}>
                        <td colSpan={9} className="bg-paragon-surface-primary border-b border-paragon-border px-6 py-4">
                          <RecordDetail r={r} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-paragon-text-muted">No records match filters.</div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-xs text-paragon-text-muted">
          <span>Page {data.page} of {data.total_pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 border border-paragon-border rounded-sm hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1">
              <ChevronLeft size={12} /> Prev
            </button>
            <button onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
              className="px-3 py-1.5 border border-paragon-border rounded-sm hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1">
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-sm p-6 w-full max-w-md shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-paragon-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-paragon-text-primary">Delete {selected.size} Record{selected.size !== 1 ? 's' : ''}?</h3>
                <p className="text-xs text-paragon-text-muted mt-1">
                  This action cannot be undone. The dataset will be permanently modified.
                </p>
              </div>
            </div>

            {data && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-800">
                Weighted N will decrease by approximately{' '}
                <strong>
                  {Math.round(
                    data.records.filter(r => selected.has(r.id)).reduce((s, r) => s + r.recency_weight, 0)
                  )}
                </strong> effective records.
              </div>
            )}

            <label className="block text-xs text-paragon-text-secondary mb-1">
              Type <strong>DELETE</strong> to confirm:
            </label>
            <input
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full text-sm border border-paragon-border rounded-sm px-3 py-2 mb-4 font-mono"
            />
            {deleteError && <p className="text-xs text-paragon-danger mb-3">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                className="flex-1 px-3 py-2 text-sm border border-paragon-border rounded-sm hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={runDelete}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 px-3 py-2 text-sm bg-paragon-danger text-white rounded-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Records'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThCol({ label, col, sortKey, onClick, children }: {
  label: string; col: string; sortKey: string; onClick: () => void; children?: React.ReactNode;
}) {
  return (
    <th
      className="p-3 text-left font-medium text-paragon-text-muted cursor-pointer hover:text-paragon-text-primary transition-colors select-none"
      onClick={onClick}
    >
      <span className="flex items-center gap-1">
        {label}
        {children}
      </span>
    </th>
  );
}

function GovernanceDots({ r }: { r: WeightedRecord }) {
  const flags = [
    { key: 'has_do', label: 'D&O' },
    { key: 'has_indemnification', label: 'Ind' },
    { key: 'has_severance', label: 'Sev' },
    { key: 'has_accel_vest', label: 'AV' },
  ] as const;
  return (
    <div className="flex gap-1">
      {flags.map(f => (
        <span key={f.key} title={f.label}
          className={`w-2 h-2 rounded-full ${r[f.key] ? 'bg-paragon-success' : 'bg-paragon-border'}`} />
      ))}
    </div>
  );
}

function RecordDetail({ r }: { r: WeightedRecord }) {
  const fmt = (n: number | null) => n == null ? '—' : `$${n.toLocaleString()}`;
  return (
    <div className="grid grid-cols-3 gap-6 text-xs">
      <div className="space-y-1.5">
        <DetailRow label="ID" value={r.id} />
        <DetailRow label="Email" value={r.email ?? '—'} />
        <DetailRow label="Title" value={r.title ?? '—'} />
        <DetailRow label="Metro Tier" value={r.metro_tier ?? '—'} />
        <DetailRow label="Company Structure" value={r.company_structure ?? '—'} />
        <DetailRow label="Reporting To" value={r.reporting_to ?? '—'} />
      </div>
      <div className="space-y-1.5">
        <DetailRow label="Base Salary" value={fmt(r.base_salary)} />
        <DetailRow label="Bonus" value={fmt(r.bonus)} />
        <DetailRow label="Equity" value={fmt(r.equity)} />
        <DetailRow label="Team Size" value={r.team_size != null ? String(r.team_size) : '—'} />
        <DetailRow label="Board Frequency" value={r.board_frequency ?? '—'} />
        <DetailRow label="Repeat CISO" value={r.repeat_ciso ? 'Yes' : 'No'} />
      </div>
      <div className="space-y-1.5">
        <div>
          <span className="text-paragon-text-muted">Functions</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {r.functions.length > 0 ? r.functions.map(fn => (
              <span key={fn} className="px-1.5 py-0.5 bg-paragon-mint-chip border border-paragon-accent-primary/30 rounded-sm text-xs">
                {fn}
              </span>
            )) : <span className="text-paragon-text-muted">—</span>}
          </div>
        </div>
        <div className="mt-3 flex gap-3">
          {[
            { label: 'D&O', val: r.has_do },
            { label: 'Ind', val: r.has_indemnification },
            { label: 'Sev', val: r.has_severance },
            { label: 'Accel', val: r.has_accel_vest },
          ].map(({ label, val }) => (
            <span key={label} className={`px-2 py-0.5 rounded-sm ${val ? 'bg-paragon-success/10 text-paragon-success' : 'bg-paragon-border/40 text-paragon-text-muted'}`}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-paragon-text-muted w-32 flex-shrink-0">{label}</span>
      <span className="text-paragon-text-primary truncate">{value}</span>
    </div>
  );
}
