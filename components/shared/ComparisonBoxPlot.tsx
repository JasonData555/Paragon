'use client';

import { useState, useEffect, useRef, useId } from 'react';
import type { CompBands, ConfidenceLevel, PercentileBand } from '@/lib/types';

interface ComparisonBoxPlotProps {
  benchmark: CompBands;
  profile: CompBands;
  confidence?: ConfidenceLevel;
  governanceLayer?: PercentileBand | null;
  activeGovernanceCount?: number;
  nextgenBands?: CompBands | null;
  nextgenN?: number;
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
const GOV_W = 14;
const NEXTGEN_W = 12;
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

export function ComparisonBoxPlot({
  benchmark,
  profile,
  confidence = 'HIGH',
  governanceLayer,
  activeGovernanceCount = 0,
  nextgenBands,
  nextgenN,
}: ComparisonBoxPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWidth = useContainerWidth(containerRef);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const patternId = useId().replace(/:/g, '');

  // Profile transition opacity (fades to 0.6 when profile changes, back to 1.0 after animation)
  const [profileOpacity, setProfileOpacity] = useState(1);
  const profileRef = useRef(profile);
  useEffect(() => {
    if (profileRef.current === profile) return;
    profileRef.current = profile;
    setProfileOpacity(0.6);
    const t = setTimeout(() => setProfileOpacity(1), 400);
    return () => clearTimeout(t);
  }, [profile]);

  const plotW = svgWidth - AXIS_LEFT - AXIS_RIGHT;

  const showNextGenLayer = !!nextgenBands && (nextgenN ?? 0) >= 5;

  const allValues: number[] = [];
  for (const b of [benchmark, profile]) {
    for (const m of METRICS) {
      const band = b[m.key];
      allValues.push(band.p10, band.p90);
    }
  }
  if (governanceLayer && activeGovernanceCount > 0) {
    allValues.push(governanceLayer.p10, governanceLayer.p90);
  }
  if (showNextGenLayer && nextgenBands) {
    for (const m of METRICS) {
      allValues.push(nextgenBands[m.key].p10, nextgenBands[m.key].p90);
    }
  }
  const globalMin = Math.max(0, Math.min(...allValues) * 0.90);
  const globalMax = Math.max(...allValues) * 1.04;

  function yPx(v: number): number {
    return AXIS_TOP + (1 - (v - globalMin) / (globalMax - globalMin)) * PLOT_H;
  }

  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(globalMin + (i / 4) * (globalMax - globalMin));
  }

  const groupW = plotW / METRICS.length;
  function groupCenterX(i: number): number {
    return AXIS_LEFT + groupW * i + groupW / 2;
  }

  const isInsufficient = confidence === 'INSUFFICIENT';
  const isMedium = confidence === 'MEDIUM';
  const isLow = confidence === 'LOW';
  const usePattern = isMedium || isLow;

  function renderBenchmarkBoxes(metricIdx: number, band: BandData, cx: number) {
    const bw = BENCH_W;
    const x1 = cx - bw / 2;
    const yP10 = yPx(band.p10);
    const yP25 = yPx(band.p25);
    const yP50 = yPx(band.p50);
    const yP75 = yPx(band.p75);
    const yP90 = yPx(band.p90);
    const capW = TICK_H / 2;

    return (
      <g key={`${metricIdx}-b`}>
        <line x1={cx} y1={yP75} x2={cx} y2={yP90} stroke="#64748B" strokeWidth={1} />
        <line x1={cx - capW} y1={yP90} x2={cx + capW} y2={yP90} stroke="#64748B" strokeWidth={1} />
        <rect x={x1} y={yP75} width={bw} height={Math.max(1, yP50 - yP75)} fill="#94A3B8" />
        <rect x={x1} y={yP50} width={bw} height={Math.max(1, yP25 - yP50)} fill="#CBD5E1" />
        <line x1={cx} y1={yP25} x2={cx} y2={yP10} stroke="#64748B" strokeWidth={1} />
        <line x1={cx - capW} y1={yP10} x2={cx + capW} y2={yP10} stroke="#64748B" strokeWidth={1} />
      </g>
    );
  }

  function renderProfileBoxes(metricIdx: number, band: BandData, cx: number) {
    const bw = PROF_W;
    const x1 = cx - bw / 2;
    const yP10 = yPx(band.p10);
    const yP25 = yPx(band.p25);
    const yP50 = yPx(band.p50);
    const yP75 = yPx(band.p75);
    const yP90 = yPx(band.p90);
    const capW = TICK_H / 2;

    const upperFill = usePattern ? `url(#${patternId}-upper)` : '#0F6E56';
    const lowerFill = usePattern ? `url(#${patternId}-lower)` : '#5DCAA5';
    const stroke = isLow ? '#0F6E56' : 'none';
    const strokeDasharray = isLow ? '4,2' : undefined;

    return (
      <g
        key={`${metricIdx}-p`}
        style={{ opacity: profileOpacity, transition: 'opacity 200ms ease' }}
      >
        <line x1={cx} y1={yP75} x2={cx} y2={yP90} stroke="#0F4A42" strokeWidth={1} />
        <line x1={cx - capW} y1={yP90} x2={cx + capW} y2={yP90} stroke="#0F4A42" strokeWidth={1} />
        <rect
          x={x1} y={yP75} width={bw} height={Math.max(1, yP50 - yP75)}
          fill={upperFill}
          stroke={stroke} strokeDasharray={strokeDasharray}
          style={{ transition: 'y 300ms ease, height 300ms ease' }}
        />
        <rect
          x={x1} y={yP50} width={bw} height={Math.max(1, yP25 - yP50)}
          fill={lowerFill}
          stroke={stroke} strokeDasharray={strokeDasharray}
          style={{ transition: 'y 300ms ease, height 300ms ease' }}
        />
        <line x1={cx} y1={yP25} x2={cx} y2={yP10} stroke="#0F4A42" strokeWidth={1} />
        <line x1={cx - capW} y1={yP10} x2={cx + capW} y2={yP10} stroke="#0F4A42" strokeWidth={1} />
      </g>
    );
  }

  function renderGovernanceBox(band: BandData, cx: number) {
    const bw = GOV_W;
    const x1 = cx - bw / 2;
    const yP10 = yPx(band.p10);
    const yP25 = yPx(band.p25);
    const yP50 = yPx(band.p50);
    const yP75 = yPx(band.p75);
    const yP90 = yPx(band.p90);
    const capW = 3;

    return (
      <g style={{ transition: 'opacity 150ms ease' }}>
        <line x1={cx} y1={yP75} x2={cx} y2={yP90} stroke="#0F6E56" strokeWidth={1} />
        <line x1={cx - capW} y1={yP90} x2={cx + capW} y2={yP90} stroke="#0F6E56" strokeWidth={1} />
        <rect x={x1} y={yP75} width={bw} height={Math.max(1, yP50 - yP75)}
          fill="transparent" stroke="#0F6E56" strokeWidth={2} strokeDasharray="4,2" />
        <rect x={x1} y={yP50} width={bw} height={Math.max(1, yP25 - yP50)}
          fill="transparent" stroke="#0F6E56" strokeWidth={2} strokeDasharray="4,2" />
        {/* Solid median line */}
        <line x1={x1} y1={yP50} x2={x1 + bw} y2={yP50} stroke="#0F6E56" strokeWidth={2} />
        <line x1={cx} y1={yP25} x2={cx} y2={yP10} stroke="#0F6E56" strokeWidth={1} />
        <line x1={cx - capW} y1={yP10} x2={cx + capW} y2={yP10} stroke="#0F6E56" strokeWidth={1} />
      </g>
    );
  }

  function renderNextGenBox(band: BandData, cx: number) {
    const bw = NEXTGEN_W;
    const x1 = cx - bw / 2;
    const yP10 = yPx(band.p10);
    const yP25 = yPx(band.p25);
    const yP50 = yPx(band.p50);
    const yP75 = yPx(band.p75);
    const yP90 = yPx(band.p90);
    const capW = 3;

    return (
      <g>
        <line x1={cx} y1={yP75} x2={cx} y2={yP90} stroke="#5DCAA5" strokeWidth={1} />
        <line x1={cx - capW} y1={yP90} x2={cx + capW} y2={yP90} stroke="#5DCAA5" strokeWidth={1} />
        <rect x={x1} y={yP75} width={bw} height={Math.max(1, yP50 - yP75)}
          fill="transparent" stroke="#5DCAA5" strokeWidth={1.5} strokeDasharray="3,2" />
        <rect x={x1} y={yP50} width={bw} height={Math.max(1, yP25 - yP50)}
          fill="transparent" stroke="#5DCAA5" strokeWidth={1.5} strokeDasharray="3,2" />
        {/* Solid median line */}
        <line x1={x1} y1={yP50} x2={x1 + bw} y2={yP50} stroke="#5DCAA5" strokeWidth={2} />
        <line x1={cx} y1={yP25} x2={cx} y2={yP10} stroke="#5DCAA5" strokeWidth={1} />
        <line x1={cx - capW} y1={yP10} x2={cx + capW} y2={yP10} stroke="#5DCAA5" strokeWidth={1} />
      </g>
    );
  }

  const tcIdx = METRICS.findIndex(m => m.key === 'total_comp');
  const tcBench = benchmark.total_comp;
  const tcProfile = profile.total_comp;
  const divergencePct = tcBench.p50 > 0 ? ((tcProfile.p50 - tcBench.p50) / tcBench.p50) * 100 : 0;
  const showDivergence = Math.abs(divergencePct) > 15;
  const showGovLayer = activeGovernanceCount > 0 && governanceLayer != null;

  function handleBoxHover(e: React.MouseEvent<SVGGElement>, _k: MetricKey, band: BandData, label: string, color: string) {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      content: (
        <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '11px' }}>
          <div style={{ color, fontWeight: 600, marginBottom: 4 }}>{label}</div>
          {(['p10', 'p25', 'p50', 'p75', 'p90'] as const).map(p => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#888780' }}>{p.toUpperCase()}</span>
              <span style={{ color }}>{fmt(band[p])}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  return (
    <div ref={containerRef} className="relative" style={{ userSelect: 'none' }}>
      {isInsufficient ? (
        <div
          style={{
            height: SVG_H,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          {/* Still render benchmark boxes for all peers */}
          <svg width={svgWidth} height={SVG_H} style={{ position: 'absolute', top: 0, left: 0 }}>
            <defs>
              <pattern id={`${patternId}-upper`} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
                <line x1="0" y1="6" x2="6" y2="0" stroke="#0F6E56" strokeWidth="1" strokeOpacity="0.2" />
              </pattern>
              <pattern id={`${patternId}-lower`} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
                <line x1="0" y1="6" x2="6" y2="0" stroke="#5DCAA5" strokeWidth="1" strokeOpacity="0.2" />
              </pattern>
            </defs>
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={AXIS_LEFT - 4} y1={yPx(v)} x2={svgWidth - AXIS_RIGHT} y2={yPx(v)}
                  stroke="#D3D1C7" strokeWidth={0.5} strokeDasharray="3,3" />
                <text x={AXIS_LEFT - 8} y={yPx(v) + 4} textAnchor="end"
                  style={{ fontSize: '10px', fill: '#888780', fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {fmt(v)}
                </text>
              </g>
            ))}
            {METRICS.map((m, i) => {
              const cx = groupCenterX(i);
              return (
                <g key={m.key}>
                  <g style={{ cursor: 'pointer' }}
                    onMouseMove={e => handleBoxHover(e, m.key, benchmark[m.key], 'All Peers', '#888780')}
                    onMouseLeave={() => setTooltip(null)}>
                    {renderBenchmarkBoxes(i, benchmark[m.key], cx - BOX_OFFSET)}
                  </g>
                  <text x={cx} y={SVG_H - 6} textAnchor="middle"
                    style={{ fontSize: '10px', fill: '#5F5E5A', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-inter)' }}>
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <p style={{ position: 'relative', zIndex: 1, fontSize: 13, color: '#888780', textAlign: 'center', padding: '0 24px' }}>
            Insufficient data for this profile — broaden filters
          </p>
        </div>
      ) : (
        <svg width={svgWidth} height={SVG_H} onMouseLeave={() => setTooltip(null)}>
          <defs>
            <pattern id={`${patternId}-upper`} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <line x1="0" y1="6" x2="6" y2="0" stroke="#0F6E56" strokeWidth="1" strokeOpacity="0.2" />
            </pattern>
            <pattern id={`${patternId}-lower`} x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
              <line x1="0" y1="6" x2="6" y2="0" stroke="#5DCAA5" strokeWidth="1" strokeOpacity="0.2" />
            </pattern>
          </defs>

          {/* Y-axis grid + labels */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={AXIS_LEFT - 4} y1={yPx(v)} x2={svgWidth - AXIS_RIGHT} y2={yPx(v)}
                stroke="#D3D1C7" strokeWidth={0.5} strokeDasharray="3,3" />
              <text x={AXIS_LEFT - 8} y={yPx(v) + 4} textAnchor="end"
                style={{ fontSize: '10px', fill: '#888780', fontFamily: 'var(--font-jetbrains-mono)' }}>
                {fmt(v)}
              </text>
            </g>
          ))}

          {/* Box plots per metric */}
          {METRICS.map((m, i) => {
            const cx = groupCenterX(i);
            const bBand = benchmark[m.key];
            const pBand = profile[m.key];
            const isTotalComp = m.key === 'total_comp';

            return (
              <g key={m.key}>
                {/* Layer 1: Benchmark */}
                <g style={{ cursor: 'pointer' }}
                  onMouseMove={e => handleBoxHover(e, m.key, bBand, 'All Peers', '#888780')}
                  onMouseLeave={() => setTooltip(null)}>
                  {renderBenchmarkBoxes(i, bBand, cx - BOX_OFFSET)}
                </g>

                {/* Layer 2: Profile */}
                <g style={{ cursor: 'pointer' }}
                  onMouseMove={e => handleBoxHover(e, m.key, pBand, 'Your Profile', '#0F6E56')}
                  onMouseLeave={() => setTooltip(null)}>
                  {renderProfileBoxes(i, pBand, cx + BOX_OFFSET)}
                </g>

                {/* Layer 3: Governance-filtered (Total Comp only) */}
                {showGovLayer && isTotalComp && governanceLayer && (
                  <g style={{ cursor: 'pointer' }}
                    onMouseMove={e => handleBoxHover(e, m.key, governanceLayer, `With Protection (n=${governanceLayer.sample_n})`, '#0F6E56')}
                    onMouseLeave={() => setTooltip(null)}>
                    {renderGovernanceBox(governanceLayer, cx + BOX_OFFSET + PROF_W)}
                  </g>
                )}

                {/* Layer 4: NextGen population */}
                {showNextGenLayer && nextgenBands && (
                  <g style={{ cursor: 'pointer' }}
                    onMouseMove={e => handleBoxHover(e, m.key, nextgenBands[m.key], `NextGen (n=${nextgenN ?? 0})`, '#5DCAA5')}
                    onMouseLeave={() => setTooltip(null)}>
                    {renderNextGenBox(
                      nextgenBands[m.key],
                      cx + BOX_OFFSET + PROF_W + (showGovLayer && isTotalComp ? GOV_W + 4 : 4),
                    )}
                  </g>
                )}

                {/* X-axis label */}
                <text x={cx} y={SVG_H - 6} textAnchor="middle"
                  style={{ fontSize: '10px', fill: '#5F5E5A', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-inter)' }}>
                  {m.label}
                </text>
              </g>
            );
          })}

        </svg>
      )}

      {/* Legend entries for Layer 3 and Layer 4 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        {showGovLayer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5F5E5A' }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px dashed #0F6E56', borderRadius: 2 }} />
            With selection (n=<span className="font-mono">{governanceLayer?.sample_n ?? 0}</span>)
          </div>
        )}
        {showNextGenLayer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#5F5E5A' }}>
            <span style={{ display: 'inline-block', width: 12, height: 10, border: '1.5px dashed #5DCAA5', borderRadius: 2 }} />
            NextGen (n=<span className="font-mono">{nextgenN ?? 0}</span>)
          </div>
        )}
      </div>

      {/* Divergence callout */}
      {showDivergence && !isInsufficient && (
        <div className="text-xs mt-1 font-mono"
          style={{
            textAlign: 'center',
            color: divergencePct > 0 ? '#0F6E56' : '#DC2626',
            paddingLeft: `${groupCenterX(tcIdx)}px`,
          }}>
          {divergencePct > 0 ? '↑' : '↓'} Profile {divergencePct > 0 ? '+' : ''}{divergencePct.toFixed(0)}% {divergencePct > 0 ? 'above' : 'below'} market median
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div className="absolute pointer-events-none z-20 bg-white border border-paragon-border rounded shadow-card px-3 py-2"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10, minWidth: 140 }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
