'use client';

import { useState } from 'react';
import { ComparisonBoxPlot } from './ComparisonBoxPlot';
import type { CompBands, CandidatePosition, OperatingMode } from '@/lib/types';

interface CompDistributionCardProps {
  benchmark: CompBands;
  profile: CompBands;
  candidate?: CandidatePosition | null;
  mode: OperatingMode;
  profileN: number;
  benchmarkN: number;
}

const METRICS = [
  { key: 'base',       label: 'Base' },
  { key: 'bonus',      label: 'Bonus' },
  { key: 'equity',     label: 'Equity' },
  { key: 'total_cash', label: 'Total Cash' },
  { key: 'total_comp', label: 'Total Comp' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

function candidateIndicator(value: number, band: { p25: number; p75: number }) {
  if (value > band.p75) return { symbol: '↑', color: '#0F6E56' };
  if (value < band.p25) return { symbol: '↓', color: '#DC2626' };
  return { symbol: '', color: '#2C2C2A' };
}

export function CompDistributionCard({
  benchmark,
  profile,
  candidate,
  mode,
  profileN,
  benchmarkN,
}: CompDistributionCardProps) {
  const [tableExpanded, setTableExpanded] = useState(false);

  return (
    <div className="card p-5 mb-4">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <span className="label-caps">Compensation Distribution</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-paragon-text-muted">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(to bottom, #94A3B8 50%, #CBD5E1 50%)' }} />
            All Peers (n=<span className="font-mono">{benchmarkN}</span>)
          </span>
          <span className="flex items-center gap-1.5 text-xs text-paragon-accent-primary">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(to bottom, #0F6E56 50%, #5DCAA5 50%)' }} />
            Your Profile (n=<span className="font-mono">{profileN}</span>)
          </span>
        </div>
      </div>

      {/* Box plot */}
      <ComparisonBoxPlot
        benchmark={benchmark}
        profile={profile}
        candidate={candidate}
        mode={mode}
      />

      {/* Details toggle */}
      <div className="flex items-center mt-3 border-t border-paragon-border pt-2">
        <button
          onClick={() => setTableExpanded(v => !v)}
          className="text-xs text-paragon-text-secondary hover:text-paragon-text-primary transition-colors flex items-center gap-1"
        >
          {tableExpanded ? 'Hide Details ▲' : 'Details ▼'}
        </button>
      </div>

      {/* Data table */}
      {tableExpanded && <div className="mt-2">
        <div>
          {METRICS.map((m, i) => {
            const bBand = benchmark[m.key];
            const pBand = profile[m.key];
            const isTotal = m.key === 'total_comp';
            const rowBg = i % 2 === 0 ? '#FFFFFF' : '#FAFAFA';

            return (
              <div key={m.key} style={{ backgroundColor: rowBg }} className="border-b border-paragon-border/30">
                <div className="flex items-center py-1 hover:bg-paragon-surface-primary/50 transition-colors">
                  <span
                    className="w-28 text-xs text-paragon-text-secondary flex-shrink-0"
                    style={{ fontWeight: isTotal ? 600 : 400 }}
                  >
                    {m.label}
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-1">
                    {/* All Peers sub-row */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-paragon-text-muted w-20">All Peers</span>
                      <div className="flex gap-3 ml-auto">
                        {[bBand.p25, bBand.p50, bBand.p75, bBand.p90].map((v, j) => (
                          <span
                            key={j}
                            className="font-mono text-xs text-paragon-text-muted w-14 text-right"
                            style={{ fontWeight: j === 1 ? 600 : 400 }}
                          >
                            {fmt(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Profile sub-row */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-paragon-accent-primary w-24">Your Profile</span>
                      <div className="flex gap-3 ml-auto">
                        {[pBand.p25, pBand.p50, pBand.p75, pBand.p90].map((v, j) => (
                          <span
                            key={j}
                            className="font-mono text-xs text-paragon-accent-primary w-14 text-right"
                            style={{ fontWeight: j === 1 ? 600 : 400 }}
                          >
                            {fmt(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Candidate row (offer mode) */}
          {mode === 'offer' && candidate && (
            <div className="flex items-center py-1.5" style={{ backgroundColor: '#FEF3C7' }}>
              <span className="w-28 text-xs uppercase tracking-wide font-medium flex-shrink-0" style={{ color: '#92400E' }}>
                Candidate
              </span>
              <div className="flex-1 flex justify-end gap-3">
                {[candidate.base_value, candidate.bonus_value, candidate.equity_value, candidate.total_cash, candidate.total_comp].map((v, j) => {
                  const metricKey = METRICS[j]?.key;
                  const pBand = metricKey ? profile[metricKey] : null;
                  const { symbol, color } = pBand ? candidateIndicator(v, pBand) : { symbol: '', color: '#2C2C2A' };
                  return (
                    <span
                      key={j}
                      className="font-mono text-xs w-14 text-right"
                      style={{ color }}
                    >
                      {symbol} {fmt(v)}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
