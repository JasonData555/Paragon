import { getDatasetStats } from '@/lib/data-loader';
import Link from 'next/link';
import { BarChart2, Search, TrendingUp } from 'lucide-react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const stats = getDatasetStats();

  const yearEntries = Object.entries(stats.by_year).sort();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 overflow-y-auto" style={{ height: '100vh' }}>
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-paragon-text-primary">Paragon Intelligence</h1>
        <p className="text-sm text-paragon-text-muted mt-1">
          Hitch Partners CISO Compensation & Governance Survey · {stats.total} records
        </p>
      </div>

      {/* Dataset stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Records"
          value={stats.total.toString()}
          sub="across all cohorts"
        />
        <StatCard
          label="Weighted N"
          value={stats.weighted_n.toString()}
          sub="Kish effective sample"
        />
        <StatCard
          label="Survey Years"
          value={yearEntries.map(([y]) => y).join(', ')}
          sub={`${yearEntries[yearEntries.length - 1]?.[1] ?? 0} records in latest cohort`}
        />
      </div>

      {/* Quick launch */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/intake"
          className="card p-6 hover:scale-[1.01] transition-transform duration-150 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-sm bg-paragon-accent-primary/10 flex items-center justify-center">
              <Search size={18} className="text-paragon-accent-primary" />
            </div>
            <h2 className="text-sm font-medium text-paragon-text-primary">Intake Brief</h2>
          </div>
          <p className="text-xs text-paragon-text-muted leading-relaxed">
            Generate a real-time compensation and governance intelligence brief for a candidate profile. Filter by role, industry, company size, and metro tier.
          </p>
          <div className="mt-4 text-xs text-paragon-accent-primary group-hover:text-paragon-accent-hover transition-colors">
            Open Intake →
          </div>
        </Link>

        <Link
          href="/offer"
          className="card p-6 hover:scale-[1.01] transition-transform duration-150 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-sm bg-paragon-accent-primary/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-paragon-accent-primary" />
            </div>
            <h2 className="text-sm font-medium text-paragon-text-primary">Offer Analysis</h2>
          </div>
          <p className="text-xs text-paragon-text-muted leading-relaxed">
            Position a specific compensation package within the peer distribution. Overlay candidate TC against weighted percentile bands.
          </p>
          <div className="mt-4 text-xs text-paragon-accent-primary group-hover:text-paragon-accent-hover transition-colors">
            Open Offer Analysis →
          </div>
        </Link>
      </div>

      {/* Coverage heatmap teaser */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="label-caps flex items-center gap-2">
            <BarChart2 size={12} />
            Coverage Snapshot
          </h2>
          <Link href="/coverage" className="text-xs text-paragon-accent-primary hover:underline">
            Full coverage map →
          </Link>
        </div>
        <div className="flex gap-8">
          {yearEntries.map(([year, count]) => (
            <div key={year}>
              <div className="text-2xl font-medium text-paragon-text-primary">{count}</div>
              <div className="text-xs text-paragon-text-muted">{year}</div>
            </div>
          ))}
          <div className="ml-auto text-right">
            <div className="text-2xl font-medium text-paragon-text-primary">{stats.approaching_expiry.length}</div>
            <div className="text-xs text-paragon-warning">records ≥18 months</div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="label-caps mb-1">{label}</div>
      <div className="text-2xl font-medium text-paragon-text-primary">{value}</div>
      {sub && <div className="text-xs text-paragon-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
