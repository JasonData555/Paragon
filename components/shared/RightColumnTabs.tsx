'use client';

import { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import type { QueryResult, QueryParams, OperatingMode, ConfidenceLevel } from '@/lib/types';
import { CompDistributionCard } from './CompDistributionCard';
import { GovernanceDeltaPanel } from './GovernanceDeltaPanel';
import { OrgDisplay } from './OrgDisplay';
import { FSSCard } from './FSSCard';
import { ExportButton } from './ExportButton';

interface RightColumnTabsProps {
  result: QueryResult | null;
  params: QueryParams | null;
  loading: boolean;
  mode: OperatingMode;
}

type Tab = 'overview' | 'compensation' | 'governance';

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------
const CONF_BADGE: Record<ConfidenceLevel, { label: string; bg: string; color: string }> = {
  HIGH:         { label: 'HIGH', bg: '#E1F5EE', color: '#0F6E56' },
  MEDIUM:       { label: 'MED',  bg: '#FEF3C7', color: '#92400E' },
  LOW:          { label: 'LOW',  bg: '#FEE2E2', color: '#991B1B' },
  INSUFFICIENT: { label: 'LOW',  bg: '#FEE2E2', color: '#991B1B' },
};

function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

function SkeletonBadge() {
  return (
    <span
      className="inline-block rounded animate-skeleton-pulse"
      style={{ width: 40, height: 18, backgroundColor: '#E1F5EE' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Overview tab sub-components
// ---------------------------------------------------------------------------
function PrevalenceDot({ pct }: { pct: number }) {
  const color = pct >= 60 ? '#0F6E56' : pct >= 30 ? '#F59E0B' : '#DC2626';
  return (
    <span
      className="inline-block rounded-full mr-1"
      style={{ width: 6, height: 6, backgroundColor: color, verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
}

function GovernanceSnapshotCard({
  result,
  onGovernanceClick,
}: {
  result: QueryResult;
  onGovernanceClick: () => void;
}) {
  return (
    <div className="card mb-5" style={{ padding: '20px 24px' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="label-caps">Governance Snapshot</span>
        <button
          type="button"
          onClick={onGovernanceClick}
          className="text-xs text-paragon-accent-primary hover:underline transition-colors"
          style={{ fontSize: 12 }}
        >
          Full analysis →
        </button>
      </div>

      <div className="flex divide-x divide-paragon-border">
        {result.governance.elements.map(el => (
          <div key={el.key} className="flex-1 px-4 first:pl-0 last:pr-0 text-center">
            <div className="flex items-center justify-center mb-1">
              <PrevalenceDot pct={el.prevalence_pct} />
              <span
                className="font-medium"
                style={{ fontSize: 28, color: '#0F4A42', lineHeight: 1 }}
              >
                {Math.round(el.prevalence_pct)}%
              </span>
            </div>
            <div className="label-caps text-paragon-text-secondary mt-1">{el.name.split(' ')[0]}</div>
          </div>
        ))}
      </div>

      {/* Conditional flags */}
      {(() => {
        const above50 = result.governance.elements.every(e => e.prevalence_pct > 50);
        const below20 = result.governance.elements.every(e => e.prevalence_pct < 20);
        if (above50) {
          return (
            <div className="mt-3 flex items-center gap-2 text-xs text-paragon-accent-primary">
              <span>🛡</span>
              <span>Full protection profile in this peer group</span>
            </div>
          );
        }
        if (below20) {
          return (
            <div className="mt-3 flex items-center gap-2 text-xs text-paragon-warning">
              <span>⚠</span>
              <span>Limited protection profile in this peer group</span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

function OverviewTab({
  result,
  params,
  mode,
  onGovernanceClick,
}: {
  result: QueryResult;
  params: QueryParams;
  mode: OperatingMode;
  onGovernanceClick: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Border color for calibration card
  const candidatePct = result.candidate?.total_comp_percentile ?? null;
  let caliBorderColor = '#0F6E56';
  if (mode === 'offer' && candidatePct != null) {
    if (candidatePct < 25) caliBorderColor = '#DC2626';
    else if (candidatePct < 50) caliBorderColor = '#F59E0B';
    else caliBorderColor = '#0F6E56';
  }

  // Peer description
  const filterParts: string[] = [];
  if (params.industry) filterParts.push(params.industry);
  if (params.company_structure) filterParts.push(params.company_structure);
  if (params.size_bucket) filterParts.push(params.size_bucket);
  const peerDesc = filterParts.length > 0 ? filterParts.join(' · ') : 'matched';

  // Percentile badge color (offer mode)
  let percBg = '#E1F5EE', percColor = '#0F6E56';
  if (mode === 'offer' && candidatePct != null) {
    if (candidatePct < 25) { percBg = '#FEE2E2'; percColor = '#991B1B'; }
    else if (candidatePct < 50) { percBg = '#FEF3C7'; percColor = '#92400E'; }
  }

  // Methodology tooltip text
  const tooltipText = `Results based on ${result.weighted_n.toFixed(0)} weighted records from ${result.raw_n} matched responses. Records weighted by recency: past 12 months carry full weight, declining linearly to 0.60 at 24 months. Data older than 24 months excluded.`;

  return (
    <div className="flex flex-col" style={{ minHeight: '100%' }}>
      {/* 1. Market Calibration / Offer Assessment card */}
      <div
        className="mb-5"
        style={{
          borderLeft: `4px solid ${caliBorderColor}`,
          borderRadius: 12,
          padding: '28px 24px',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div
          className="label-caps mb-3"
          style={{ color: caliBorderColor, letterSpacing: '0.08em' }}
        >
          {mode === 'intake' ? 'Market Calibration' : 'Offer Assessment'}
        </div>
        <p
          className="text-paragon-text-primary"
          style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.6 }}
        >
          {result.statement}
        </p>
        <p className="text-paragon-text-secondary mt-3" style={{ fontSize: 13 }}>
          Based on{' '}
          <span className="font-mono">{result.raw_n}</span>{' '}
          {peerDesc} peers
        </p>
        {mode === 'offer' && candidatePct != null && (
          <span
            className="inline-block mt-2 font-mono rounded"
            style={{
              backgroundColor: percBg,
              color: percColor,
              fontSize: 12,
              padding: '2px 10px',
              borderRadius: 8,
            }}
          >
            Candidate at {candidatePct}th percentile of matched peers
          </span>
        )}
      </div>

      {/* 2. Governance Snapshot */}
      <GovernanceSnapshotCard result={result} onGovernanceClick={onGovernanceClick} />

      {/* 3. Bottom row — anchors to bottom */}
      <div className="flex items-center gap-4 mt-auto pt-4 border-t border-paragon-border">
        {/* Left: Confidence chip */}
        <span
          className="font-mono rounded flex-shrink-0"
          style={{
            backgroundColor: CONF_BADGE[result.confidence].bg,
            color: CONF_BADGE[result.confidence].color,
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 8,
          }}
        >
          {CONF_BADGE[result.confidence].label}
          {' '}
          <span className="opacity-70 font-normal">
            {result.weighted_n.toFixed(0)} wtd / {result.raw_n} total
          </span>
        </span>

        {/* Center: Methodology footnote */}
        <div
          className="relative flex-1 text-center"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span
            className="text-paragon-text-muted cursor-help"
            style={{ fontSize: 11, whiteSpace: 'nowrap' }}
          >
            Recency-weighted · 2022–2025 data · 24-month window
          </span>
          {showTooltip && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 rounded pointer-events-none"
              style={{
                backgroundColor: '#1E293B',
                color: '#FFFFFF',
                fontSize: 12,
                padding: '8px 12px',
                maxWidth: 320,
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              {tooltipText}
            </div>
          )}
        </div>

        {/* Right: Export button */}
        <div className="flex-shrink-0">
          <ExportButton result={result} params={params} mode={mode} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center" style={{ height: '100%' }}>
      <BarChart2 size={48} className="text-paragon-border mb-4" />
      <p className="text-paragon-text-muted text-sm text-center" style={{ maxWidth: 280 }}>
        Configure your search parameters and generate a brief.
      </p>
      <p className="text-paragon-text-muted text-xs text-center mt-2">
        Results will appear across three tabs.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function RightColumnTabs({ result, params, loading, mode }: RightColumnTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Badge values (derived from result)
  const overviewBadge = result ? CONF_BADGE[result.confidence] : null;
  const compBadgeValue = result
    ? `P50 ${fmt(result.profile_comp?.total_comp?.p50 ?? result.comp_bands?.total_comp?.p50 ?? 0)}`
    : null;
  const govBadgeCount = result
    ? result.governance.elements.filter(e => e.prevalence_pct > 50).length
    : null;

  function govBadgeStyle(n: number): { bg: string; color: string; border?: string } {
    if (n === 4) return { bg: '#E1F5EE', color: '#0F6E56' };
    if (n === 0) return { bg: '#FEF3C7', color: '#F59E0B' };
    return { bg: '#FFFFFF', color: '#5F5E5A', border: '1px solid #D3D1C7' };
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'compensation', label: 'Compensation' },
    { key: 'governance', label: 'Governance' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div
        style={{
          height: 48,
          flexShrink: 0,
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #D3D1C7',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0 24px',
          gap: 0,
        }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #0F6E56' : '2px solid transparent',
                marginBottom: -1,
                background: 'none',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: isActive ? '#0F6E56' : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? '#0F4A42' : '#888780',
                  transition: 'color 150ms',
                }}
              >
                {tab.label}
              </span>

              {/* Badges — hidden on active tab, visible on inactive after query */}
              {!isActive && (
                <>
                  {/* Overview badge */}
                  {tab.key === 'overview' && (
                    loading ? (
                      <SkeletonBadge />
                    ) : overviewBadge ? (
                      <span
                        className="font-mono"
                        style={{
                          backgroundColor: overviewBadge.bg,
                          color: overviewBadge.color,
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 8,
                          fontFamily: 'var(--font-jetbrains-mono)',
                        }}
                      >
                        {overviewBadge.label}
                      </span>
                    ) : null
                  )}

                  {/* Compensation badge */}
                  {tab.key === 'compensation' && (
                    loading ? (
                      <SkeletonBadge />
                    ) : compBadgeValue ? (
                      <span
                        className="font-mono"
                        style={{
                          backgroundColor: '#E1F5EE',
                          color: '#0F6E56',
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 8,
                          fontFamily: 'var(--font-jetbrains-mono)',
                        }}
                      >
                        {compBadgeValue}
                      </span>
                    ) : null
                  )}

                  {/* Governance badge */}
                  {tab.key === 'governance' && (
                    loading ? (
                      <SkeletonBadge />
                    ) : govBadgeCount != null ? (
                      <span
                        className="font-mono"
                        style={{
                          ...govBadgeStyle(govBadgeCount),
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 8,
                          fontFamily: 'var(--font-jetbrains-mono)',
                        }}
                      >
                        {govBadgeCount} / 4
                      </span>
                    ) : null
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: 24,
        }}
      >
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="animate-skeleton-pulse rounded-card"
                style={{ height: i === 1 ? 120 : 80, backgroundColor: '#E1F5EE' }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && <EmptyState />}

        {/* Overview tab */}
        {!loading && result && params && activeTab === 'overview' && (
          <OverviewTab
            result={result}
            params={params}
            mode={mode}
            onGovernanceClick={() => setActiveTab('governance')}
          />
        )}

        {/* Compensation tab */}
        {!loading && result && activeTab === 'compensation' && (
          <div>
            {result.fss && params && params.selected_functions && params.selected_functions.length > 0 && (
              <div className="mb-4">
                <FSSCard fss={result.fss} selectedFunctions={params.selected_functions ?? []} />
              </div>
            )}
            <OrgDisplay org={result.org_structure} />
            <CompDistributionCard
              benchmark={result.benchmark_comp ?? result.comp_bands}
              profile={result.profile_comp ?? result.comp_bands}
              candidate={result.candidate}
              mode={mode}
              profileN={result.profile_n ?? result.raw_n}
              benchmarkN={result.benchmark_n ?? result.raw_n}
            />
          </div>
        )}

        {/* Governance tab */}
        {!loading && result && activeTab === 'governance' && (
          <GovernanceDeltaPanel governance={result.governance} mode={mode} />
        )}
      </div>
    </div>
  );
}
