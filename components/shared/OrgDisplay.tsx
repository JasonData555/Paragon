'use client';

import { useState, useEffect, useRef } from 'react';
import type { OrgStructureResult } from '@/lib/types';

interface OrgDisplayProps {
  org: OrgStructureResult;
}

function useCountUpInt(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) { setDisplay(target); return; }
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(target);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

export function OrgDisplay({ org }: OrgDisplayProps) {
  const p50Display = useCountUpInt(org.team_size_p50, 400);
  const topFunctions = org.top_functions.slice(0, 8);
  const maxReportingCount = Math.max(1, ...org.top_reporting_lines.map(r => r.count));

  // Track function tag changes for fade animations
  const prevFnNamesRef = useRef<string[]>([]);
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());
  const [fadingIn, setFadingIn] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prevSet = new Set(prevFnNamesRef.current);
    const currSet = new Set(topFunctions.map(f => f.name));
    const leaving = prevFnNamesRef.current.filter(n => !currSet.has(n));
    const entering = topFunctions.map(f => f.name).filter(n => !prevSet.has(n));
    prevFnNamesRef.current = topFunctions.map(f => f.name);

    if (leaving.length > 0) {
      setFadingOut(new Set(leaving));
      const t = setTimeout(() => setFadingOut(new Set()), 200);
      return () => clearTimeout(t);
    }
    if (entering.length > 0) {
      setFadingIn(new Set(entering));
      const t = setTimeout(() => setFadingIn(new Set()), 200);
      return () => clearTimeout(t);
    }
  }, [topFunctions]);

  return (
    <div className="card p-5 animate-fade-in-up" style={{ animationDelay: '225ms' }}>
      <h3 className="label-caps mb-4">Org Structure</h3>

      {/* Team size */}
      <div className="mb-5">
        <div className="text-xs text-paragon-text-muted mb-1">Team Size</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-medium font-mono text-paragon-text-primary">
            {p50Display}
          </span>
          <span className="text-xs text-paragon-text-muted">
            median (P25: <span className="font-mono">{org.team_size_p25}</span> – P75: <span className="font-mono">{org.team_size_p75}</span>)
          </span>
        </div>
        <div className="text-xs text-paragon-text-muted mt-0.5">n=<span className="font-mono">{org.team_size_n}</span> with data</div>
      </div>

      {/* Reporting lines */}
      {org.top_reporting_lines.length > 0 && (
        <div className="mb-5">
          <div className="text-xs text-paragon-text-muted mb-2">Reports To</div>
          <div className="space-y-1.5">
            {org.top_reporting_lines.slice(0, 4).map(rl => (
              <div key={rl.title} className="flex items-center gap-2">
                <div
                  className="h-2 rounded-full flex-shrink-0"
                  style={{
                    width: `${(rl.count / maxReportingCount) * 120}px`,
                    minWidth: 4,
                    backgroundColor: '#0F6E56',
                    opacity: 0.5,
                    transition: 'width 300ms ease',
                  }}
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
                style={{
                  opacity: fadingOut.has(fn.name) ? 0 : 1,
                  transition: 'opacity 150ms ease',
                }}
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
