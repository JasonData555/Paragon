'use client';

import { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import type { GovernanceResult, OperatingMode } from '@/lib/types';

interface GovernanceDeltaPanelProps {
  governance: GovernanceResult;
  mode: OperatingMode;
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

export function GovernanceDeltaPanel({ governance, mode }: GovernanceDeltaPanelProps) {
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  function handleToggle(key: string) {
    setToggles(t => ({ ...t, [key]: !t[key] }));
    if (!hasInteracted) setHasInteracted(true);
  }

  // Full quad: all four > 50%
  const elementsAbove50 = governance.elements.filter(e => e.prevalence_pct > 50);
  const isFullQuad = elementsAbove50.length === 4;
  const elementsBelow20 = governance.elements.filter(e => e.prevalence_pct < 20);
  const isZeroProtection = elementsBelow20.length === 4;

  // Board access percentages
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
                  {/* Tooltip */}
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

      {/* Secondary metrics */}
      <div className="border-t border-paragon-border pt-4">
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
