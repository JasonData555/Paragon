import type { OrgStructureResult } from '@/lib/types';

interface OrgDisplayProps {
  org: OrgStructureResult;
}

export function OrgDisplay({ org }: OrgDisplayProps) {
  const maxReportingCount = org.top_reporting_lines[0]?.count ?? 1;
  const topFunctions = org.top_functions.slice(0, 8);

  return (
    <div className="card p-5 animate-fade-in-up" style={{ animationDelay: '225ms' }}>
      <h3 className="label-caps mb-4">Org Structure</h3>

      {/* Team size */}
      <div className="mb-5">
        <div className="text-xs text-paragon-text-muted mb-1">Team Size</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-medium text-paragon-text-primary">
            {org.team_size_p50}
          </span>
          <span className="text-xs text-paragon-text-muted">
            median (P25: {org.team_size_p25} – P75: {org.team_size_p75})
          </span>
        </div>
        <div className="text-xs text-paragon-text-muted mt-0.5">n={org.team_size_n} with data</div>
      </div>

      {/* Reporting lines */}
      {org.top_reporting_lines.length > 0 && (
        <div className="mb-5">
          <div className="text-xs text-paragon-text-muted mb-2">Reports To</div>
          <div className="space-y-1.5">
            {org.top_reporting_lines.slice(0, 3).map(rl => (
              <div key={rl.title} className="flex items-center gap-2">
                <div
                  className="h-2 bg-paragon-accent-primary/50 rounded-full flex-shrink-0"
                  style={{ width: `${(rl.count / maxReportingCount) * 120}px`, minWidth: '4px' }}
                />
                <span className="text-xs text-paragon-text-secondary truncate flex-1">{rl.title}</span>
                <span className="text-xs text-paragon-text-muted flex-shrink-0">{Math.round(rl.pct)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Function tag cloud */}
      {topFunctions.length > 0 && (
        <div>
          <div className="text-xs text-paragon-text-muted mb-2">Common Functions (peer group)</div>
          <div className="flex flex-wrap gap-1.5">
            {topFunctions.map(fn => (
              <span
                key={fn.name}
                className="px-2 py-0.5 bg-paragon-mint-chip text-paragon-accent-primary text-xs rounded-sm border border-paragon-accent-primary/20"
                title={`${Math.round(fn.pct)}% of peers`}
              >
                {fn.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
