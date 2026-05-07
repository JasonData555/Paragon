'use client';

import { useState, useEffect, useRef } from 'react';
import type { CompBands, CandidatePosition, OperatingMode } from '@/lib/types';

interface ComparisonBoxPlotProps {
  benchmark: CompBands;
  profile: CompBands;
  candidate?: CandidatePosition | null;
  mode: OperatingMode;
}

const METRICS = [
  { key: 'base',       label: 'Base' },
  { key: 'bonus',      label: 'Bonus' },
  { key: 'equity',     label: 'Equity' },
  { key: 'total_cash', label: 'Total Cash' },
  { key: 'total_comp', label: 'Total Comp' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

interface BandData {
  p10: number; p25: number; p50: number; p75: number; p90: number;
}

function fmt(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}

const SVG_H = 320;
const AXIS_LEFT = 52;
const AXIS_RIGHT = 16;
const AXIS_BOTTOM = 36;
const AXIS_TOP = 12;
const PLOT_H = SVG_H - AXIS_BOTTOM - AXIS_TOP;
const BENCH_W = 30;
const PROF_W = 18;
const BOX_OFFSET = 14;
const TICK_H = 7;

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    obs.observe(ref.current);
    setWidth(ref.current.clientWidth);
    return () => obs.disconnect();
  }, [ref]);
  return width;
}

export function ComparisonBoxPlot({ benchmark, profile, candidate, mode }: ComparisonBoxPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWidth = useContainerWidth(containerRef);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const [needleProgress, setNeedleProgress] = useState(0);
  const needleAnimRef = useRef<number | null>(null);

  // Animate needle when in offer mode
  useEffect(() => {
    if (mode !== 'offer' || !candidate?.total_comp_percentile) {
      setNeedleProgress(0);
      return;
    }
    const start = performance.now();
    const duration = 300;
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setNeedleProgress(ease);
      if (t < 1) needleAnimRef.current = requestAnimationFrame(step);
    }
    // Wait for card fade-in first
    const timer = setTimeout(() => {
      needleAnimRef.current = requestAnimationFrame(step);
    }, 200);
    return () => {
      clearTimeout(timer);
      if (needleAnimRef.current) cancelAnimationFrame(needleAnimRef.current);
    };
  }, [mode, candidate?.total_comp_percentile]);

  const plotW = svgWidth - AXIS_LEFT - AXIS_RIGHT;

  // Compute global Y range from all bands
  const allValues: number[] = [];
  for (const b of [benchmark, profile]) {
    for (const m of METRICS) {
      const band = b[m.key];
      allValues.push(band.p10, band.p90);
    }
  }
  if (candidate) allValues.push(candidate.total_comp);
  const globalMin = Math.max(0, Math.min(...allValues) * 0.90);
  const globalMax = Math.max(...allValues) * 1.04;

  function yPct(v: number): number {
    return 1 - (v - globalMin) / (globalMax - globalMin);
  }
  function yPx(v: number): number {
    return AXIS_TOP + yPct(v) * PLOT_H;
  }

  // Y-axis ticks (5 evenly spaced)
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(globalMin + (i / 4) * (globalMax - globalMin));
  }

  // X positions for each metric group
  const groupW = plotW / METRICS.length;

  function groupCenterX(i: number): number {
    return AXIS_LEFT + groupW * i + groupW / 2;
  }

  function renderBoxes(metricIdx: number, band: BandData, isBenchmark: boolean, cx: number) {
    const bw = isBenchmark ? BENCH_W : PROF_W;
    const x1 = cx - bw / 2;
    const yP10 = yPx(band.p10);
    const yP25 = yPx(band.p25);
    const yP50 = yPx(band.p50);
    const yP75 = yPx(band.p75);
    const yP90 = yPx(band.p90);

    // Two-tone: upper half (P50→P75) darker, lower half (P25→P50) lighter
    const colorUpper = isBenchmark ? '#94A3B8' : '#0F6E56';
    const colorLower = isBenchmark ? '#CBD5E1' : '#5DCAA5';
    const whiskerColor = isBenchmark ? '#64748B' : '#0F4A42';
    const capW = TICK_H / 2;

    return (
      <g key={`${metricIdx}-${isBenchmark ? 'b' : 'p'}`}>
        {/* Upper whisker: P75 → P90 */}
        <line x1={cx} y1={yP75} x2={cx} y2={yP90} stroke={whiskerColor} strokeWidth={1} />
        <line x1={cx - capW} y1={yP90} x2={cx + capW} y2={yP90} stroke={whiskerColor} strokeWidth={1} />
        {/* Upper box: P50 → P75 */}
        <rect x={x1} y={yP75} width={bw} height={Math.max(1, yP50 - yP75)} fill={colorUpper} />
        {/* Lower box: P25 → P50 */}
        <rect x={x1} y={yP50} width={bw} height={Math.max(1, yP25 - yP50)} fill={colorLower} />
        {/* Lower whisker: P25 → P10 */}
        <line x1={cx} y1={yP25} x2={cx} y2={yP10} stroke={whiskerColor} strokeWidth={1} />
        <line x1={cx - capW} y1={yP10} x2={cx + capW} y2={yP10} stroke={whiskerColor} strokeWidth={1} />
      </g>
    );
  }

  // Divergence on Total Comp
  const tcIdx = METRICS.findIndex(m => m.key === 'total_comp');
  const tcBench = benchmark.total_comp;
  const tcProfile = profile.total_comp;
  const divergencePct =
    tcBench.p50 > 0 ? ((tcProfile.p50 - tcBench.p50) / tcBench.p50) * 100 : 0;
  const showDivergence = Math.abs(divergencePct) > 15;

  const needleY = mode === 'offer' && candidate ? yPx(candidate.total_comp) : 0;

  function handleBoxHover(e: React.MouseEvent<SVGGElement>, _metricKey: MetricKey, band: BandData, isBenchmark: boolean) {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const labelColor = isBenchmark ? '#888780' : '#0F6E56';
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      content: (
        <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px' }}>
          <div style={{ color: labelColor, fontWeight: 600, marginBottom: 4 }}>
            {isBenchmark ? 'All Peers' : 'Your Profile'}
          </div>
          {(['p10', 'p25', 'p50', 'p75', 'p90'] as const).map(p => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#888780' }}>{p.toUpperCase()}</span>
              <span style={{ color: labelColor }}>{fmt(band[p])}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  return (
    <div ref={containerRef} className="relative" style={{ userSelect: 'none' }}>
      <svg width={svgWidth} height={SVG_H} onMouseLeave={() => setTooltip(null)}>
        {/* Y-axis */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={AXIS_LEFT - 4} y1={yPx(v)}
              x2={svgWidth - AXIS_RIGHT} y2={yPx(v)}
              stroke="#D3D1C7" strokeWidth={0.5} strokeDasharray="3,3"
            />
            <text
              x={AXIS_LEFT - 8} y={yPx(v) + 4}
              textAnchor="end"
              style={{ fontSize: '10px', fill: '#888780', fontFamily: 'var(--font-jetbrains-mono)' }}
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* Box plots */}
        {METRICS.map((m, i) => {
          const cx = groupCenterX(i);
          const bBand = benchmark[m.key];
          const pBand = profile[m.key];
          return (
            <g key={m.key}>
              {/* Benchmark (behind, shifted left) */}
              <g
                style={{ cursor: 'pointer' }}
                onMouseMove={e => handleBoxHover(e, m.key, bBand, true)}
                onMouseLeave={() => setTooltip(null)}
              >
                {renderBoxes(i, bBand, true, cx - BOX_OFFSET)}
              </g>
              {/* Profile (front, shifted right) */}
              <g
                style={{ cursor: 'pointer' }}
                onMouseMove={e => handleBoxHover(e, m.key, pBand, false)}
                onMouseLeave={() => setTooltip(null)}
              >
                {renderBoxes(i, pBand, false, cx + BOX_OFFSET)}
              </g>
              {/* X-axis label */}
              <text
                x={cx} y={SVG_H - 6}
                textAnchor="middle"
                style={{ fontSize: '10px', fill: '#5F5E5A', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-inter)' }}
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Candidate needle (offer mode, total comp) */}
        {mode === 'offer' && candidate && needleProgress > 0 && (
          <g>
            <line
              x1={AXIS_LEFT}
              y1={needleY}
              x2={AXIS_LEFT + (svgWidth - AXIS_LEFT - AXIS_RIGHT) * needleProgress}
              y2={needleY}
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="6,3"
            />
            <text
              x={AXIS_LEFT + 4}
              y={needleY - 4}
              style={{ fontSize: '10px', fill: '#F59E0B', fontFamily: 'var(--font-jetbrains-mono)' }}
            >
              Candidate
            </text>
          </g>
        )}
      </svg>

      {/* Divergence callout */}
      {showDivergence && (
        <div
          className="text-xs mt-1 font-mono"
          style={{
            textAlign: 'center',
            color: divergencePct > 0 ? '#0F6E56' : '#DC2626',
            paddingLeft: `${groupCenterX(tcIdx)}px`,
          }}
        >
          {divergencePct > 0 ? '↑' : '↓'} Profile {divergencePct > 0 ? '+' : ''}{divergencePct.toFixed(0)}% {divergencePct > 0 ? 'above' : 'below'} market median
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-20 bg-white border border-paragon-border rounded shadow-card px-3 py-2"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10, minWidth: 140 }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
