'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import type { GovernanceCombinationResult, GovernanceResult, OperatingMode, ProtectionKey } from '@/lib/types';

interface GovernanceDeltaPanelProps {
  governance: GovernanceResult;
  mode: OperatingMode;
  governanceMatrix?: Record<string, GovernanceCombinationResult>;
  rciScore?: number;
  onGovernanceSelectionChange?: (selected: ProtectionKey[]) => void;
}

const ELEMENT_TOOLTIPS: Record<string, string> = {
  has_accel_vest:
    'Equity vests immediately upon qualifying termination following a change of control (double trigger)',
  has_severance:
    'Pre-negotiated cash payment upon termination, agreed at time of hire',
  has_indemnification:
    'Company legally obligates itself to cover personal legal costs arising from role-related litigation',
  has_do:
    'Directors and Officers insurance — personal liability coverage for decisions made in the role',
};

// Map element key (has_do, etc.) to ProtectionKey (do, etc.)
const ELEMENT_TO_PROTECTION: Record<string, ProtectionKey> = {
  has_do: 'do',
  has_indemnification: 'indemnification',
  has_severance: 'severance',
  has_accel_vest: 'accel_vest',
};

// Short labels for combination pills
const PROTECTION_ABBREV: Record<ProtectionKey, string> = {
  do: 'D&O',
  indemnification: 'Indem',
  severance: 'Sev',
  accel_vest: 'DT',
};

function matrixKey(protections: ProtectionKey[]): string {
  return [...protections].sort().join('+');
}

function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

function PrevalenceDot({ pct }: { pct: number }) {
  const color = pct >= 60 ? '#0F6E56' : pct >= 30 ? '#F59E0B' : '#DC2626';
  return (
    <span
      className="inline-block rounded-full mr-1.5"
      style={{ width: 6, height: 6, backgroundColor: color, verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 36,
        height: 20,
        borderRadius: 10,
        backgroundColor: on ? '#0F6E56' : '#D3D1C7',
        padding: 2,
        transition: 'background-color 200ms ease',
        cursor: 'pointer',
        border: 'none',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          transform: on ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 200ms ease',
        }}
      />
    </button>
  );
}

function useCountUp(target: number | null, duration = 300): number | null {
  const [display, setDisplay] = useState<number | null>(target);
  const prevRef = useRef<number | null>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) { setDisplay(null); prevRef.current = null; return; }
    const from = prevRef.current ?? target;
    prevRef.current = target;
    if (from === target) { setDisplay(target); return; }

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target! - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(target!);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

function CombinationPanel({
  combination,
  activeProtections,
}: {
  combination: GovernanceCombinationResult | null;
  activeProtections: ProtectionKey[];
}) {
  const animWith    = useCountUp(combination?.median_tc_with    ?? null, 300);
  const animWithout = useCountUp(combination?.median_tc_without ?? null, 300);
  const animDelta   = useCountUp(combination?.delta             ?? null, 300);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1.5px solid #0F6E56',
        borderRadius: 12,
        padding: '20px 24px',
        marginTop: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="label-caps" style={{ color: '#5F5E5A' }}>Selected Combination Analysis</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {activeProtections.map(k => (
            <span
              key={k}
              style={{
                backgroundColor: '#0F6E56',
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 8,
                letterSpacing: '0.04em',
              }}
            >
              {PROTECTION_ABBREV[k]}
            </span>
          ))}
        </div>
      </div>

      {!combination || combination.insufficient_data ? (
        <p style={{ textAlign: 'center', fontSize: 13, color: '#888780', padding: '8px 0' }}>
          Insufficient peer data for this exact combination
          {combination ? ` (${combination.n_with} matching records)` : ''}.
          Individual element premiums shown above remain valid.
        </p>
      ) : (
        <>
          {/* Three stat blocks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 12 }}>
            {/* WITH ALL */}
            <div style={{ textAlign: 'center' }}>
              <div className="label-caps" style={{ marginBottom: 6 }}>With All Selected</div>
              <div className="font-mono" style={{ fontSize: 24, color: '#0F4A42', fontWeight: 500 }}>
                {animWith !== null ? fmt(animWith) : '—'}
              </div>
              <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 4 }}>
                median TC — <span className="font-mono">{combination.n_with}</span> peers
              </div>
            </div>

            {/* WITHOUT ANY */}
            <div style={{ textAlign: 'center' }}>
              <div className="label-caps" style={{ marginBottom: 6 }}>Without Any</div>
              <div className="font-mono" style={{ fontSize: 24, color: '#888780' }}>
                {animWithout !== null ? fmt(animWithout) : '—'}
              </div>
              <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 4 }}>
                median TC — <span className="font-mono">{combination.n_without}</span> peers
              </div>
            </div>

            {/* COMBINATION PREMIUM */}
            <div style={{ textAlign: 'center' }}>
              <div className="label-caps" style={{ marginBottom: 6 }}>Combination Premium</div>
              <div className="font-mono" style={{ fontSize: 24, color: '#0F6E56', fontWeight: 500 }}>
                {animDelta !== null ? `+${fmt(animDelta)}` : '—'}
              </div>
              <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 4 }}>
                observed market premium
              </div>
            </div>
          </div>

          {/* Explanatory line */}
          <p style={{ fontSize: 12, color: '#5F5E5A', fontStyle: 'italic', textAlign: 'center' }}>
            Based on <span className="font-mono">{combination.n_with}</span> peers with exactly this
            protection profile vs <span className="font-mono">{combination.n_without}</span> peers with none
            of these protections
          </p>
        </>
      )}
    </div>
  );
}

export function GovernanceDeltaPanel({
  governance,
  mode,
  governanceMatrix = {},
  rciScore,
  onGovernanceSelectionChange,
}: GovernanceDeltaPanelProps) {
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showCombination, setShowCombination] = useState(false);

  function handleToggle(key: string) {
    setToggles(t => {
      const next = { ...t, [key]: !t[key] };
      const activeProtections = Object.entries(next)
        .filter(([, on]) => on)
        .map(([k]) => ELEMENT_TO_PROTECTION[k])
        .filter(Boolean) as ProtectionKey[];
      onGovernanceSelectionChange?.(activeProtections);
      setShowCombination(activeProtections.length > 0);
      return next;
    });
    if (!hasInteracted) setHasInteracted(true);
  }

  // Active protections for the combination panel
  const activeProtections = Object.entries(toggles)
    .filter(([, on]) => on)
    .map(([k]) => ELEMENT_TO_PROTECTION[k])
    .filter(Boolean) as ProtectionKey[];

  const combinationResult = activeProtections.length > 0
    ? (governanceMatrix[matrixKey(activeProtections)] ?? null)
    : null;

  // Full quad: all four > 50%
  const elementsAbove50 = governance.elements.filter(e => e.prevalence_pct > 50);
  const isFullQuad = elementsAbove50.length === 4;
  const elementsBelow20 = governance.elements.filter(e => e.prevalence_pct < 20);
  const isZeroProtection = elementsBelow20.length === 4;

  // Full Quad friction signal (RCI > 75)
  const showFrictionSignal = typeof rciScore === 'number' && rciScore > 75;

  const totalBoardPct =
    governance.board_quarterly_pct + governance.board_regular_pct + governance.board_no_access_pct;

  return (
    <div className="card p-5">
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <span className="label-caps">Governance & Protection Profile</span>
        <span className="text-xs text-paragon-text-muted italic">Toggle to emphasize in conversation</span>
      </div>

      {/* Prompt text (before any toggle interaction) */}
      {!hasInteracted && (
        <p className="text-xs text-paragon-text-muted italic text-center mb-4">
          Toggle protection elements on to highlight in a client conversation
        </p>
      )}

      {/* Four element rows */}
      <div className="space-y-2 mb-4">
        {governance.elements.map(el => {
          const on = !!toggles[el.key];
          const tooltip = ELEMENT_TOOLTIPS[el.key];

          return (
            <div
              key={el.key}
              className="relative rounded-sm transition-all duration-200"
              style={{
                padding: '12px',
                backgroundColor: on ? '#F5F0E8' : '#FFFFFF',
                borderLeft: on ? '3px solid #0F6E56' : '3px solid transparent',
                opacity: on ? 1 : 0.4,
              }}
            >
              <div className="flex items-center gap-3">
                {/* Column 1: name + prevalence */}
                <div
                  className="flex-1 min-w-0 cursor-help"
                  onMouseEnter={() => setHoveredKey(el.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <div className="flex items-center">
                    <PrevalenceDot pct={el.prevalence_pct} />
                    <span className="text-sm font-medium text-paragon-text-primary truncate">{el.name}</span>
                  </div>
                  <p className="text-xs text-paragon-text-secondary mt-0.5 ml-3">
                    <span className="font-mono">{Math.round(el.prevalence_pct)}%</span> of peers have this
                  </p>
                  {hoveredKey === el.key && tooltip && (
                    <div
                      className="absolute left-0 z-30 rounded pointer-events-none"
                      style={{
                        top: '110%',
                        backgroundColor: '#1E293B',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        padding: '8px 12px',
                        maxWidth: 280,
                        borderRadius: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      {tooltip}
                    </div>
                  )}
                </div>

                {/* Column 2: WITH */}
                <div className="text-center w-20">
                  <div className="text-[10px] uppercase tracking-wide text-paragon-text-muted">With</div>
                  <div className="font-mono text-paragon-sidebar" style={{ fontSize: 14, fontWeight: 500 }}>
                    {fmt(el.tc_have)}
                  </div>
                </div>

                {/* Column 3: WITHOUT */}
                <div className="text-center w-20">
                  <div className="text-[10px] uppercase tracking-wide text-paragon-text-muted">Without</div>
                  <div className="font-mono text-paragon-text-muted" style={{ fontSize: 14 }}>
                    {fmt(el.tc_dont)}
                  </div>
                </div>

                {/* Column 4: TC Premium + toggle */}
                <div className="text-center w-24 flex flex-col items-center gap-1.5">
                  <div className="text-[10px] uppercase tracking-wide text-paragon-text-muted">TC Premium</div>
                  {el.delta > 0 ? (
                    <div className="font-mono text-paragon-accent-primary" style={{ fontSize: 14, fontWeight: 500 }}>
                      +{fmt(el.delta)}
                    </div>
                  ) : (
                    <div className="font-mono text-paragon-text-muted" style={{ fontSize: 14 }}>
                      —
                    </div>
                  )}
                  <ToggleSwitch on={on} onToggle={() => handleToggle(el.key)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Combination Result Panel */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: showCombination ? 300 : 0,
          opacity: showCombination ? 1 : 0,
          transition: 'max-height 200ms ease, opacity 150ms ease',
        }}
      >
        <CombinationPanel combination={combinationResult} activeProtections={activeProtections} />
      </div>

      {/* High-friction Full Quad signal */}
      {showFrictionSignal && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            backgroundColor: '#E1F5EE',
            border: '1px solid #1D9E75',
            borderRadius: 8,
            fontSize: 12,
            color: '#0F4A42',
          }}
        >
          Roles at this friction level show Full Quad protection at 2.5× the market rate.
        </div>
      )}

      {/* Secondary metrics */}
      <div className="border-t border-paragon-border pt-4 mt-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Signing Bonus */}
          <div>
            <p className="text-xs text-paragon-text-secondary">
              <span className="font-mono">{Math.round(governance.signing_bonus_pct)}%</span> of peers received a signing bonus
            </p>
            <p className="text-xs text-paragon-text-secondary mt-1">
              Median signing bonus:{' '}
              <span className="font-mono">{fmt(governance.signing_bonus_delta)}</span>
            </p>
          </div>

          {/* Board Reporting Frequency */}
          <div>
            <span className="label-caps block mb-2">Board Reporting Frequency</span>
            <div className="relative h-1.5 rounded overflow-hidden" style={{ backgroundColor: '#D3D1C7' }}>
              <div className="absolute left-0 top-0 h-full" style={{ width: `${governance.board_quarterly_pct}%`, backgroundColor: '#0F6E56' }} />
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${governance.board_quarterly_pct}%`,
                  width: `${governance.board_regular_pct}%`,
                  backgroundColor: '#1D9E75',
                }}
              />
              <div
                className="absolute top-0 h-full"
                style={{
                  left: `${governance.board_quarterly_pct + governance.board_regular_pct}%`,
                  width: `${governance.board_no_access_pct}%`,
                  backgroundColor: '#D3D1C7',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-mono" style={{ color: '#0F6E56' }}>
                {Math.round(governance.board_quarterly_pct)}% Quarterly
              </span>
              <span className="text-[10px] font-mono" style={{ color: '#1D9E75' }}>
                {Math.round(governance.board_regular_pct)}% Regular
              </span>
              <span className="text-[10px] font-mono text-paragon-text-muted">
                {Math.round(governance.board_no_access_pct)}% None
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Quad flag */}
      {isFullQuad && (
        <div
          className="flex items-center gap-3 mt-4 p-3 rounded"
          style={{ backgroundColor: '#E1F5EE', border: '1px solid #0F6E56', borderRadius: 8 }}
        >
          <Shield size={20} className="text-paragon-accent-primary flex-shrink-0" />
          <p className="text-sm text-paragon-sidebar">
            Full Protection Profile — Top 7.6% of market. Peers with all four elements show median TC of{' '}
            <span className="font-mono">$894K</span>.
          </p>
        </div>
      )}

      {/* Zero Protection flag */}
      {isZeroProtection && !isFullQuad && (
        <div
          className="flex items-center gap-3 mt-4 p-3 rounded"
          style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8 }}
        >
          <AlertTriangle size={16} className="text-paragon-warning flex-shrink-0" />
          <p className="text-sm text-paragon-text-primary">
            Limited protection profile detected. Peers without any protection elements show median TC of{' '}
            <span className="font-mono">$337K</span> — <span className="font-mono">$257K</span> below fully protected peers.
          </p>
        </div>
      )}
    </div>
  );
}
