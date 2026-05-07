'use client';

import { UI_FUNCTIONS, calculateFSS, FUNCTION_WEIGHTS } from '@/lib/function-weights';
import type { FSSDistribution } from '@/lib/types';

interface ScopeStabilityGaugeProps {
  score: number;
  peerDistribution?: FSSDistribution;
  hasQueryResult: boolean;
  selectedCount: number;
}

const ALL_FUNCTIONS = [...UI_FUNCTIONS.col1, ...UI_FUNCTIONS.col2, ...UI_FUNCTIONS.col3];
const MAX_FSS = calculateFSS(
  ALL_FUNCTIONS.slice().sort((a, b) => (FUNCTION_WEIGHTS[b] ?? 1) - (FUNCTION_WEIGHTS[a] ?? 1))
);

// FSS score when exactly the top 13 functions (by weight) are selected
const TOP_13 = ALL_FUNCTIONS.slice()
  .sort((a, b) => (FUNCTION_WEIGHTS[b] ?? 1) - (FUNCTION_WEIGHTS[a] ?? 1))
  .slice(0, 13);
const THRESHOLD_FSS = calculateFSS(TOP_13);
const TICK_PCT = MAX_FSS > 0 ? Math.min(100, (THRESHOLD_FSS / MAX_FSS) * 100) : 65;

function getZone(
  score: number,
  peerDistribution?: FSSDistribution,
  selectedCount?: number,
): { zone: 'narrow' | 'standard' | 'broad' | 'expansive' | 'none' } {
  if (score === 0) return { zone: 'none' };
  if (selectedCount != null && selectedCount > 13) return { zone: 'expansive' };
  if (!peerDistribution) {
    if (score < 8) return { zone: 'narrow' };
    if (score < 16) return { zone: 'standard' };
    if (score < 24) return { zone: 'broad' };
    return { zone: 'expansive' };
  }
  if (score >= peerDistribution.p90) return { zone: 'expansive' };
  if (score >= peerDistribution.p75) return { zone: 'broad' };
  if (score >= peerDistribution.p25) return { zone: 'standard' };
  return { zone: 'narrow' };
}

const ZONE_CONFIG = {
  none:      { fill: '#D3D1C7', pillBg: '#F5F5F5', pillText: '#888780', pillLabel: 'No scope selected', subLabel: '' },
  narrow:    { fill: '#D3D1C7', pillBg: '#F5F5F5', pillText: '#5F5E5A', pillLabel: 'NARROW', subLabel: 'Below market scope for this peer group' },
  standard:  { fill: 'linear-gradient(to right, #E1F5EE, #1D9E75)', pillBg: '#E1F5EE', pillText: '#0F6E56', pillLabel: 'STANDARD', subLabel: 'Consistent with peer median scope' },
  broad:     { fill: '#0F6E56', pillBg: '#0F6E56', pillText: '#FFFFFF', pillLabel: 'BROAD', subLabel: 'Above market scope — comp lift supported' },
  expansive: { fill: '#F59E0B', pillBg: '#F59E0B', pillText: '#FFFFFF', pillLabel: 'EXPANSIVE', subLabel: 'Scope exceeds market norm — verify role definition' },
} as const;

export function ScopeStabilityGauge({
  score,
  peerDistribution,
  hasQueryResult,
  selectedCount,
}: ScopeStabilityGaugeProps) {
  const { zone } = getZone(score, peerDistribution, selectedCount);
  const config = ZONE_CONFIG[zone];
  const barPct = MAX_FSS > 0 ? Math.min(100, (score / MAX_FSS) * 100) : 0;
  const isExpansive = zone === 'expansive';

  const peerMedianPct =
    peerDistribution && MAX_FSS > 0
      ? Math.min(100, (peerDistribution.p50 / MAX_FSS) * 100)
      : null;

  return (
    <div className="mt-4 pt-4 border-t border-paragon-border">
      {/* Label row */}
      <div className="flex items-center justify-between mb-2">
        <span className="label-caps">Scope Position</span>
        {zone !== 'none' && (
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{
              backgroundColor: config.pillBg,
              color: config.pillText,
              fontFamily: 'var(--font-jetbrains-mono)',
              fontSize: '11px',
            }}
          >
            {config.pillLabel}
          </span>
        )}
      </div>

      {/* Gauge bar */}
      <div className="relative mb-1" style={{ height: '20px' }}>
        {/* Tick mark at 13-function threshold */}
        <div
          className="absolute top-0 z-10"
          style={{ left: `${TICK_PCT}%`, transform: 'translateX(-50%)' }}
          title="Diminishing returns threshold — 13 functions. Additional functions scored at 50% weight beyond this point."
        >
          <div style={{ width: '1px', height: '12px', backgroundColor: '#F59E0B' }} />
        </div>

        {/* Track */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded"
          style={{ height: '8px', backgroundColor: '#D3D1C7', borderRadius: '4px' }}
        />

        {/* Peer median marker (after query) */}
        {hasQueryResult && peerMedianPct != null && (
          <div
            className="absolute bottom-0 z-10"
            style={{ left: `${peerMedianPct}%`, transform: 'translateX(-50%)' }}
          >
            <div style={{ width: '2px', height: '8px', backgroundColor: '#888780' }} />
          </div>
        )}

        {/* Fill */}
        {barPct > 0 && (
          <div
            className="absolute bottom-0 left-0 rounded"
            style={{
              height: '8px',
              width: `${barPct}%`,
              borderRadius: '4px',
              background: config.fill,
              transition: 'width 300ms ease-out',
            }}
          />
        )}
      </div>

      {/* Sub-label */}
      {config.subLabel && (
        <p
          className="text-xs mt-1"
          style={{ color: isExpansive ? '#F59E0B' : '#888780' }}
        >
          {config.subLabel}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-xs text-paragon-text-secondary">
          Functions Selected: {selectedCount}
        </span>
        {score > 0 && (
          <span className="font-mono text-xs text-paragon-text-secondary">
            Score: {score.toFixed(1)}
          </span>
        )}
        {hasQueryResult && peerDistribution ? (
          <span className="font-mono text-xs text-paragon-text-muted">
            Peer median: {peerDistribution.p50.toFixed(1)}
          </span>
        ) : (
          <span className="text-xs text-paragon-text-muted italic">
            Run a brief to compare vs. peers
          </span>
        )}
      </div>
    </div>
  );
}
