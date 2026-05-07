import { loadSurveyData, applyRecencyWeights } from '@/lib/data-loader';
import { weightedEffectiveN } from '@/lib/recency-weights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SIZE_ORDER = ['Small', 'Mid-Market', 'Large', 'Enterprise'] as const;

export default async function CoveragePage() {
  const raw = loadSurveyData();
  const records = applyRecencyWeights(raw);

  // Industry × size bucket heatmap
  const industries = Array.from(new Set(records.map(r => r.industry).filter(Boolean) as string[])).sort();
  const heatmap: Record<string, Record<string, number>> = {};
  for (const r of records) {
    const ind = r.industry ?? '(Unknown)';
    const sz = r.size_bucket ?? '(Unknown)';
    if (!heatmap[ind]) heatmap[ind] = {};
    heatmap[ind][sz] = (heatmap[ind][sz] ?? 0) + 1;
  }

  // Age distribution (6-month bins)
  const AGE_BINS = [
    { label: '0–6 mo', min: 0, max: 6 },
    { label: '6–12 mo', min: 6, max: 12 },
    { label: '12–15 mo', min: 12, max: 15 },
    { label: '15–18 mo', min: 15, max: 18 },
    { label: '18–21 mo', min: 18, max: 21 },
    { label: '21–24 mo', min: 21, max: 24 },
  ];
  const ageCounts = AGE_BINS.map(b => ({
    ...b,
    count: records.filter(r => r.age_months >= b.min && r.age_months < b.max).length,
  }));
  const maxAge = Math.max(...ageCounts.map(b => b.count));

  // Industry breakdown with weighted N
  const industryStats = industries
    .map(ind => {
      const recs = records.filter(r => r.industry === ind);
      return {
        name: ind,
        count: recs.length,
        weighted_n: weightedEffectiveN(recs.map(r => r.recency_weight)),
      };
    })
    .sort((a, b) => b.count - a.count);

  const maxCount = industryStats[0]?.count ?? 1;

  // Top 12 industries for heatmap (others collapse)
  const topIndustries = industryStats.slice(0, 20).map(s => s.name);

  function cellColor(count: number): string {
    if (count === 0) return 'bg-paragon-border/30 text-transparent';
    if (count <= 2) return 'bg-paragon-mint-chip/40 text-paragon-text-muted';
    if (count <= 8) return 'bg-paragon-mint-chip text-paragon-accent-primary';
    if (count <= 20) return 'bg-paragon-accent-light/40 text-paragon-accent-primary';
    return 'bg-paragon-accent-primary text-white';
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 overflow-y-auto" style={{ height: '100vh' }}>
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-paragon-text-primary">Coverage Map</h1>
        <p className="text-sm text-paragon-text-muted mt-1">
          Dataset distribution across industry, company size, and cohort age.
        </p>
      </div>

      {/* Age distribution histogram */}
      <div className="card p-5">
        <h2 className="label-caps mb-4">Cohort Age Distribution</h2>
        <div className="flex items-end gap-3 h-24">
          {ageCounts.map(b => (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-paragon-text-muted">{b.count}</span>
              <div
                className={`w-full rounded-sm transition-all ${
                  b.min >= 18 ? 'bg-paragon-danger/60' : b.min >= 12 ? 'bg-paragon-warning/60' : 'bg-paragon-success/60'
                }`}
                style={{ height: `${maxAge > 0 ? (b.count / maxAge) * 72 : 0}px`, minHeight: b.count > 0 ? '4px' : '0' }}
              />
              <span className="text-xs text-paragon-text-muted text-center leading-tight whitespace-nowrap">{b.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-paragon-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-paragon-success/60 inline-block" /> Current</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-paragon-warning/60 inline-block" /> Aging</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-paragon-danger/60 inline-block" /> Expiring</span>
        </div>
      </div>

      {/* Industry × Size heatmap */}
      <div className="card p-5">
        <h2 className="label-caps mb-4">Industry × Company Size Heatmap</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left pb-2 pr-4 font-medium text-paragon-text-muted">Industry</th>
                {SIZE_ORDER.map(sz => (
                  <th key={sz} className="pb-2 px-2 text-center font-medium text-paragon-text-muted">{sz}</th>
                ))}
                <th className="pb-2 px-2 text-center font-medium text-paragon-text-muted">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paragon-border/30">
              {topIndustries.map(ind => {
                const row = heatmap[ind] ?? {};
                const total = Object.values(row).reduce((s, n) => s + n, 0);
                return (
                  <tr key={ind}>
                    <td className="py-1.5 pr-4 text-paragon-text-secondary max-w-48 truncate">{ind}</td>
                    {SIZE_ORDER.map(sz => {
                      const n = row[sz] ?? 0;
                      return (
                        <td key={sz} className="py-1.5 px-2 text-center">
                          <span className={`inline-block w-8 h-6 leading-6 rounded-sm text-xs font-medium ${cellColor(n)}`}>
                            {n > 0 ? n : ''}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-center font-medium text-paragon-text-primary">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {industries.length > 20 && (
          <p className="text-xs text-paragon-text-muted mt-3">
            Showing top 20 industries by record count. {industries.length - 20} additional industries have fewer records.
          </p>
        )}
      </div>

      {/* Industry breakdown table */}
      <div className="card p-5">
        <h2 className="label-caps mb-4">Industry Record Counts</h2>
        <div className="space-y-2">
          {industryStats.slice(0, 30).map(({ name, count, weighted_n }) => (
            <div key={name} className="flex items-center gap-3">
              <span className="text-xs text-paragon-text-secondary w-64 truncate flex-shrink-0">{name}</span>
              <div className="flex-1 h-2 bg-paragon-border/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-paragon-accent-primary/60 rounded-full transition-all"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-paragon-text-primary w-8 text-right">{count}</span>
              <span className="text-xs text-paragon-text-muted w-20 text-right">eff. N={weighted_n}</span>
            </div>
          ))}
        </div>
        {industryStats.length > 30 && (
          <p className="text-xs text-paragon-text-muted mt-3">
            …and {industryStats.length - 30} more industries.
          </p>
        )}
      </div>
    </div>
    </div>
  );
}
