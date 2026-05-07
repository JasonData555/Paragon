'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { UI_FUNCTIONS, calculateFSS } from '@/lib/function-weights';
import { ScopeStabilityGauge } from './ScopeStabilityGauge';
import type { FSSDistribution } from '@/lib/types';

interface FunctionSelectorProps {
  selected: string[];
  onChange: (fns: string[]) => void;
  peerDistribution?: FSSDistribution;
  hasQueryResult?: boolean;
}

export function FunctionSelector({
  selected,
  onChange,
  peerDistribution,
  hasQueryResult = false,
}: FunctionSelectorProps) {
  const [open, setOpen] = useState(false);

  const fss = calculateFSS(selected);

  function toggle(fn: string) {
    onChange(
      selected.includes(fn)
        ? selected.filter(s => s !== fn)
        : [...selected, fn]
    );
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div style={{ backgroundColor: '#FAFAFA', border: '1px solid #D3D1C7', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between hover:bg-paragon-surface-primary/50 transition-colors"
        style={{ padding: 16 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-paragon-text-primary">Functional Scope</span>
          <span className="text-xs text-paragon-text-muted">(Optional)</span>
          {selected.length > 0 ? (
            <span
              className="font-mono"
              style={{
                padding: '1px 8px',
                backgroundColor: '#E1F5EE',
                color: '#0F6E56',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {selected.length} selected
            </span>
          ) : (
            <span
              style={{
                padding: '1px 8px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D3D1C7',
                color: '#888780',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              0 selected
            </span>
          )}
        </div>
        <div
          style={{
            transition: 'transform 200ms',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <ChevronDown size={14} className="text-paragon-text-muted" />
        </div>
      </button>

      {/* Function grid (expanded) */}
      {open && (
        <div className="border-t border-paragon-border px-5 py-4">
          {selected.length > 0 && (
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-paragon-text-muted hover:text-paragon-text-primary transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-x-6 gap-y-2">
            {[UI_FUNCTIONS.col1, UI_FUNCTIONS.col2, UI_FUNCTIONS.col3].map((col, colIdx) => (
              <div key={colIdx} className="space-y-1.5">
                {col.map(fn => {
                  const active = selected.includes(fn);
                  return (
                    <button
                      key={fn}
                      type="button"
                      onClick={() => toggle(fn)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-sm border transition-colors ${
                        active
                          ? 'bg-paragon-mint-chip border-paragon-accent-primary text-paragon-accent-primary'
                          : 'bg-white border-paragon-border text-paragon-text-secondary hover:border-paragon-border-dark hover:text-paragon-text-primary'
                      }`}
                    >
                      {active && <span className="mr-1 text-paragon-accent-primary">✓</span>}
                      {fn}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stability Gauge — always visible at bottom */}
      <div className="px-5 pb-4">
        <ScopeStabilityGauge
          score={fss}
          peerDistribution={peerDistribution}
          hasQueryResult={hasQueryResult}
          selectedCount={selected.length}
        />
      </div>
    </div>
  );
}
