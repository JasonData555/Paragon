'use client';

import { useState, useRef, useEffect, useId } from 'react';
import type { CandidatePosition, OperatingMode, PISResult, QuadrantLabel } from '@/lib/types';

interface PISCoordinateChartProps {
  pis: PISResult;
  candidate?: CandidatePosition | null;
  mode: OperatingMode;
}

const CHART_W = 400;
const CHART_H = 280;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 36;

const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

const QUADRANT_COLORS: Record<QuadrantLabel, string> = {
  'Paragon Leader':    '#E1F5EE',
  'Utility Player':    '#F5F0E8',
  'Specialist Surgeon':'#F0F4FF',
  'Generalist':        '#FAFAFA',
};

const QUADRANT_PILL_BG: Record<QuadrantLabel, string> = {
  'Paragon Leader':    '#0F6E56',
  'Specialist Surgeon':'#1D9E75',
  'Utility Player':    '#F59E0B',
  'Generalist':        '#888780',
};

function fmt1(v: number) { return v.toFixed(1); }

export function PISCoordinateChart({ pis, candidate, mode }: PISCoordinateChartProps) {
  const chartId = useId().replace(/:/g, '');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const roleDotRef = useRef<{ cx: number; cy: number } | null>(null);

  const { peer_points, quadrant_peer_fss_median, quadrant_peer_rci_median, fss, rci, pis: pisScore, quadrant } = pis;

  // Compute axis extents from peer data
  const allFSS = peer_points.map(p => p.fss);
  const allRCI = peer_points.map(p => p.rci);
  const maxFSS = Math.max(...allFSS, fss, 2) * 1.1;
  const maxRCI = 100;

  function toChartX(fssVal: number) {
    return PAD_L + (fssVal / maxFSS) * PLOT_W;
  }
  function toChartY(rciVal: number) {
    return PAD_T + (1 - rciVal / maxRCI) * PLOT_H;
  }

  // Crosshair positions
  const crossX = toChartX(quadrant_peer_fss_median);
  const crossY = toChartY(quadrant_peer_rci_median);

  // Current role marker position
  const roleCX = toChartX(fss);
  const roleCY = toChartY(rci.rci_score);

  // Animate role dot to new position when pis changes
  const [displayCX, setDisplayCX] = useState(roleCX);
  const [displayCY, setDisplayCY] = useState(roleCY);
  const rafRef = useRef<number | null>(null);
  const prevPosRef = useRef({ cx: roleCX, cy: roleCY });

  useEffect(() => {
    const fromCX = prevPosRef.current.cx;
    const fromCY = prevPosRef.current.cy;
    if (fromCX === roleCX && fromCY === roleCY) return;
    prevPosRef.current = { cx: roleCX, cy: roleCY };
    const start = performance.now();
    const duration = 400;
    function step(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayCX(fromCX + (roleCX - fromCX) * ease);
      setDisplayCY(fromCY + (roleCY - fromCY) * ease);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [roleCX, roleCY]);

  // Quadrant background zones (4 rectangles)
  function renderQuadrantZones() {
    const midX = crossX;
    const midY = crossY;
    return (
      <>
        {/* Top-left: Specialist Surgeon */}
        <rect x={PAD_L} y={PAD_T} width={midX - PAD_L} height={midY - PAD_T}
          fill={QUADRANT_COLORS['Specialist Surgeon']} fillOpacity={0.6} />
        {/* Top-right: Paragon Leader */}
        <rect x={midX} y={PAD_T} width={PAD_L + PLOT_W - midX} height={midY - PAD_T}
          fill={QUADRANT_COLORS['Paragon Leader']} fillOpacity={0.6} />
        {/* Bottom-left: Generalist */}
        <rect x={PAD_L} y={midY} width={midX - PAD_L} height={PAD_T + PLOT_H - midY}
          fill={QUADRANT_COLORS['Generalist']} fillOpacity={0.6} />
        {/* Bottom-right: Utility Player */}
        <rect x={midX} y={midY} width={PAD_L + PLOT_W - midX} height={PAD_T + PLOT_H - midY}
          fill={QUADRANT_COLORS['Utility Player']} fillOpacity={0.6} />
      </>
    );
  }

  function renderQuadrantLabels() {
    const midX = crossX;
    const midY = crossY;
    const style: React.CSSProperties = {
      fontSize: 9,
      fill: '#B4B2A9',
      fontFamily: 'var(--font-inter)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
    };
    const pad = 6;
    return (
      <>
        <text x={PAD_L + pad} y={PAD_T + pad + 9} style={style}>Specialist</text>
        <text x={PAD_L + pad} y={PAD_T + pad + 9 + 11} style={style}>Surgeon</text>
        <text x={midX + pad} y={PAD_T + pad + 9} style={style}>Paragon</text>
        <text x={midX + pad} y={PAD_T + pad + 9 + 11} style={style}>Leader</text>
        <text x={PAD_L + pad} y={PAD_T + PLOT_H - pad - 3} style={style}>Generalist</text>
        <text x={midX + pad} y={PAD_T + PLOT_H - pad - 3} style={style}>Utility Player</text>
      </>
    );
  }

  function handleRoleDotHover(e: React.MouseEvent<SVGCircleElement>) {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 10,
      content: (
        <div style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: 11, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 600, color: '#0F4A42', marginBottom: 4 }}>Role Profile</div>
          <div>PIS: <span style={{ color: '#0F6E56' }}>{fmt1(pisScore)}</span></div>
          <div>FSS: <span style={{ color: '#0F6E56' }}>{fmt1(fss)}</span></div>
          <div>RCI: <span style={{ color: '#0F6E56' }}>{rci.rci_score}</span></div>
          <div style={{ color: QUADRANT_PILL_BG[quadrant], fontWeight: 600 }}>{quadrant}</div>
        </div>
      ),
    });
  }

  return (
    <div className="card p-5 mb-4">
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="label-caps">Leadership Intensity Matrix</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 13, color: '#0F4A42', fontWeight: 500 }}>
            PIS: {fmt1(pisScore)}
          </span>
          <span
            style={{
              backgroundColor: QUADRANT_PILL_BG[quadrant],
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 10px',
              borderRadius: 8,
              letterSpacing: '0.03em',
            }}
          >
            {quadrant}
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative" onMouseLeave={() => setTooltip(null)}>
        <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ display: 'block' }}>
          {/* Quadrant background fills */}
          {renderQuadrantZones()}

          {/* Chart border */}
          <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H}
            fill="none" stroke="#D3D1C7" strokeWidth={1} />

          {/* Peer dots */}
          {peer_points.map((p, i) => (
            <circle
              key={i}
              cx={toChartX(p.fss)}
              cy={toChartY(p.rci)}
              r={3}
              fill="#D3D1C7"
              fillOpacity={0.6}
            />
          ))}

          {/* Crosshairs at peer medians */}
          <line x1={crossX} y1={PAD_T} x2={crossX} y2={PAD_T + PLOT_H}
            stroke="#D3D1C7" strokeWidth={1} strokeDasharray="4,4" />
          <line x1={PAD_L} y1={crossY} x2={PAD_L + PLOT_W} y2={crossY}
            stroke="#D3D1C7" strokeWidth={1} strokeDasharray="4,4" />

          {/* Quadrant labels */}
          {renderQuadrantLabels()}

          {/* Axis labels */}
          <text
            x={PAD_L + PLOT_W / 2} y={CHART_H - 4}
            textAnchor="middle"
            style={{ fontSize: 9, fill: '#888780', fontFamily: 'var(--font-inter)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            FSS — Load
          </text>
          <text
            x={10} y={PAD_T + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90, 10, ${PAD_T + PLOT_H / 2})`}
            style={{ fontSize: 9, fill: '#888780', fontFamily: 'var(--font-inter)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            RCI — Friction
          </text>

          {/* Candidate dot (offer mode) */}
          {mode === 'offer' && candidate && (
            <g>
              <circle
                cx={toChartX(fss)}
                cy={toChartY(rci.rci_score)}
                r={8}
                fill="#F59E0B"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
              <text
                x={toChartX(fss)}
                y={toChartY(rci.rci_score) - 12}
                textAnchor="middle"
                style={{ fontSize: 10, fill: '#F59E0B', fontFamily: 'var(--font-jetbrains-mono)' }}
              >
                Candidate
              </text>
            </g>
          )}

          {/* Current role marker — animated position */}
          <circle
            cx={displayCX}
            cy={displayCY}
            r={9}
            fill="#0F6E56"
            stroke="#FFFFFF"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onMouseMove={handleRoleDotHover}
            onMouseLeave={() => setTooltip(null)}
          />
        </svg>

        {/* Hover tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-20 bg-white border border-paragon-border rounded shadow-card px-3 py-2"
            style={{ left: tooltip.x, top: tooltip.y, minWidth: 140 }}
          >
            {tooltip.content}
          </div>
        )}
      </div>

      {/* Axis labels + legend row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5F5E5A' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#0F6E56', border: '2px solid #FFFFFF', boxShadow: '0 0 0 1px #0F6E56' }} />
            This role
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#5F5E5A' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#D3D1C7' }} />
            Peer ({peer_points.length} records)
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#888780' }}>
          Crosshairs = peer medians
        </span>
      </div>
    </div>
  );
}
