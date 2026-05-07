import { getDatasetStats } from '@/lib/data-loader';
import Link from 'next/link';
import { getAuditLog } from '@/lib/audit-logger';
import { AlertTriangle, CheckCircle2, Database, Upload } from 'lucide-react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default async function AdminDashboardPage() {
  const stats = getDatasetStats();
  const { events } = await getAuditLog(1, 10);
  const lastImport = events.find(e => e.action === 'IMPORT');

  const writesEnabled = process.env.ALLOW_WRITES === 'true';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium text-paragon-text-primary">Dataset Overview</h1>
        <p className="text-sm text-paragon-text-muted mt-1">
          Hitch Partners CISO Compensation Survey
        </p>
      </div>

      {!writesEnabled && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-sm text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <strong>Read-only deployment.</strong> Upload and delete operations require{' '}
            <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">ALLOW_WRITES=true</code>{' '}
            to be set. Manage data locally and redeploy to refresh.
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Records" value={stats.total.toString()} />
        <StatCard label="Weighted N" value={stats.weighted_n.toString()} sub="Kish effective N" />
        <StatCard label="Approaching Expiry" value={stats.approaching_expiry.length.toString()} sub="≥18 months old" warn={stats.approaching_expiry.length > 0} />
        <StatCard label="Last Import" value={lastImport ? new Date(lastImport.timestamp).toLocaleDateString() : '—'} sub={lastImport ? `${lastImport.records_affected} records` : 'No imports yet'} />
      </div>

      {/* Year distribution */}
      <div className="card p-5">
        <h2 className="label-caps mb-4 flex items-center gap-2">
          <Database size={12} />
          Year Distribution
        </h2>
        <div className="flex gap-6">
          {Object.entries(stats.by_year).sort().map(([year, count]) => (
            <div key={year}>
              <div className="text-2xl font-medium text-paragon-text-primary">{count}</div>
              <div className="text-xs text-paragon-text-muted">{year}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Expiring records */}
      {stats.approaching_expiry.length > 0 && (
        <div className="card p-5">
          <h2 className="label-caps mb-4 flex items-center gap-2 text-paragon-warning">
            <AlertTriangle size={12} />
            Records Approaching Expiry (≥18 Months)
          </h2>
          <div className="text-xs text-paragon-text-secondary mb-3">
            {stats.approaching_expiry.length} records will expire within 6 months (at 24 months).
            Annual data refresh expected Q3/Q4 2026.
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-paragon-text-muted border-b border-paragon-border">
                <th className="text-left pb-2 font-medium">Survey Date</th>
                <th className="text-left pb-2 font-medium">Industry</th>
                <th className="text-left pb-2 font-medium">Size</th>
                <th className="text-right pb-2 font-medium">Age (months)</th>
                <th className="text-right pb-2 font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {stats.approaching_expiry.slice(0, 10).map(r => (
                <tr key={r.id} className="border-b border-paragon-border/50">
                  <td className="py-2">{r.survey_date}</td>
                  <td className="py-2 text-paragon-text-secondary">{r.industry ?? '—'}</td>
                  <td className="py-2 text-paragon-text-secondary">{r.size_bucket ?? '—'}</td>
                  <td className={`py-2 text-right font-medium ${r.age_months >= 21 ? 'text-paragon-danger' : 'text-paragon-warning'}`}>
                    {r.age_months}
                  </td>
                  <td className="py-2 text-right text-paragon-text-muted">{r.recency_weight.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.approaching_expiry.length > 10 && (
            <p className="text-xs text-paragon-text-muted mt-2">
              …and {stats.approaching_expiry.length - 10} more.{' '}
              <Link href="/admin/manage" className="text-paragon-accent-primary hover:underline">View in Manage →</Link>
            </p>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href="/admin/upload"
          className="flex items-center gap-2 px-4 py-2.5 bg-paragon-accent-primary hover:bg-paragon-accent-hover text-white text-sm rounded-sm transition-colors"
        >
          <Upload size={14} />
          Upload New Dataset
        </Link>
        <Link
          href="/admin/manage"
          className="flex items-center gap-2 px-4 py-2.5 border border-paragon-border bg-white hover:bg-gray-50 text-paragon-text-secondary text-sm rounded-sm transition-colors"
        >
          <Database size={14} />
          Manage Records
        </Link>
      </div>

      {/* Field completion */}
      <FieldCompletionCard />
    </div>
  );
}

function StatCard({ label, value, sub, warn = false }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <div className="label-caps mb-1">{label}</div>
      <div className={`text-2xl font-medium ${warn ? 'text-paragon-warning' : 'text-paragon-text-primary'}`}>{value}</div>
      {sub && <div className="text-xs text-paragon-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

async function FieldCompletionCard() {
  const { loadSurveyData } = await import('@/lib/data-loader');
  const records = loadSurveyData();
  const n = records.length;

  const fields = [
    { label: 'Base Salary', pct: records.filter(r => r.base_salary != null).length / n * 100 },
    { label: 'Functions', pct: records.filter(r => r.functions.length > 0).length / n * 100 },
    { label: 'Industry', pct: records.filter(r => r.industry != null).length / n * 100 },
    { label: 'Metro Tier', pct: records.filter(r => r.metro_tier != null).length / n * 100 },
    { label: 'D&O Flag', pct: records.filter(r => r.has_do != null).length / n * 100 },
    { label: 'Severance Flag', pct: records.filter(r => r.has_severance != null).length / n * 100 },
  ];

  return (
    <div className="card p-5">
      <h2 className="label-caps mb-4 flex items-center gap-2">
        <CheckCircle2 size={12} />
        Field Completion Rates
      </h2>
      <div className="grid grid-cols-3 gap-3">
        {fields.map(({ label, pct }) => (
          <div key={label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-paragon-text-secondary">{label}</span>
              <span className={`font-medium ${pct >= 95 ? 'text-paragon-success' : pct >= 80 ? 'text-paragon-warning' : 'text-paragon-danger'}`}>
                {Math.round(pct)}%
              </span>
            </div>
            <div className="h-1.5 bg-paragon-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 95 ? 'bg-paragon-success' : pct >= 80 ? 'bg-paragon-warning' : 'bg-paragon-danger'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
