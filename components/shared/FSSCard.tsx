import type { FSSResult } from '@/lib/types';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface FSSCardProps {
  fss: FSSResult;
  selectedFunctions: string[];
}

const LABEL_COLOR: Record<string, string> = {
  Narrow: 'text-paragon-warning',
  Standard: 'text-paragon-accent-primary',
  Broad: 'text-paragon-success',
  Expansive: 'text-paragon-success',
};

export function FSSCard({ fss, selectedFunctions }: FSSCardProps) {
  if (selectedFunctions.length === 0) return null;

  const labelColor = LABEL_COLOR[fss.label] ?? 'text-paragon-text-primary';
  const { p25, p50, p75, p90 } = fss.peer_distribution;
  const maxVal = p90 * 1.1;

  function barPct(v: number) { return Math.min(100, (v / maxVal) * 100); }

  return (
    <div className="card p-5 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
      <h3 className="label-caps mb-4">Functional Scope Profile</h3>

      {/* Score + bar */}
      <div className="mb-5">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-medium text-paragon-text-primary">{fss.score.toFixed(1)}</span>
          <span className={`text-sm font-medium ${labelColor}`}>{fss.label}</span>
          <span className="text-xs text-paragon-text-muted ml-auto">
            P{Math.round(fss.peer_percentile)} vs. peers
          </span>
        </div>

        {/* Bar with peer markers */}
        <div className="relative h-3 bg-paragon-border/40 rounded-full overflow-visible mb-4">
          {/* IQR shading */}
          <div
            className="absolute top-0 h-full bg-paragon-accent-primary/15 rounded-sm"
            style={{ left: `${barPct(p25)}%`, width: `${barPct(p75) - barPct(p25)}%` }}
          />
          {/* Candidate fill */}
          <div
            className="absolute left-0 top-0 h-full bg-paragon-accent-primary rounded-full"
            style={{ width: `${barPct(fss.score)}%`, transition: 'width 200ms ease' }}
          />
          {/* Peer markers */}
          {[{ v: p25, l: 'P25' }, { v: p50, l: 'P50' }, { v: p75, l: 'P75' }, { v: p90, l: 'P90' }].map(({ v, l }) => (
            <div
              key={l}
              className="absolute top-0 h-full flex flex-col items-center"
              style={{ left: `${barPct(v)}%` }}
            >
              <div className="w-px h-full bg-paragon-text-muted/40" />
              <span className="absolute -bottom-4 text-[9px] text-paragon-text-muted -translate-x-1/2 whitespace-nowrap">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tier 1 analysis */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs font-medium text-paragon-text-secondary mb-2">Tier 1 Functions (owned)</div>
          <div className="space-y-1">
            {fss.tier1_owned.length > 0 ? (
              fss.tier1_owned.map(fn => (
                <div key={fn} className="flex items-center gap-1.5 text-xs text-paragon-text-secondary">
                  <CheckCircle2 size={11} className="text-paragon-success flex-shrink-0" />
                  {fn}
                </div>
              ))
            ) : (
              <p className="text-xs text-paragon-text-muted italic">None selected</p>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-paragon-text-secondary mb-2">Tier 1 Functions (missing)</div>
          <div className="space-y-1">
            {fss.tier1_missing.length > 0 ? (
              fss.tier1_missing.map(fn => (
                <div key={fn} className="flex items-center gap-1.5 text-xs text-paragon-text-muted">
                  <AlertTriangle size={11} className="text-paragon-warning flex-shrink-0" />
                  {fn}
                </div>
              ))
            ) : (
              <p className="text-xs text-paragon-success text-xs">All Tier 1 functions covered</p>
            )}
          </div>
        </div>
      </div>

      {/* Justification */}
      {fss.justification && (
        <div className="bg-paragon-surface-primary rounded-sm p-3 border border-paragon-border">
          <p className="text-xs text-paragon-text-secondary leading-relaxed">{fss.justification}</p>
        </div>
      )}
    </div>
  );
}
