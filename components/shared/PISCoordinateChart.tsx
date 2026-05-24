'use client';

import { useState, useRef, useEffect } from 'react';
import type { CandidatePosition, OperatingMode, PISResult, QuadrantLabel } from '@/lib/types';

interface PISCoordinateChartProps {
  pis: PISResult;
  candidate?: CandidatePosition | null;
  mode: OperatingMode;
}

const CHART_W = 400;
const CHART_H = 310;   // was 280 — extra room for 2-line bottom axis label
const PAD_L = 50;      // was 36 — extra room for 2-line rotated Y label
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 52;      // was 36 — fits 13px + 11px label + spacing

const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

// Quadrant background fill colors (updated per spec)
const QUADRANT_COLORS: Record<QuadrantLabel, string> = {
  'Paragon Leader':     '#E1F5EE',
  'Utility Player':     '#FEF3C7',
  'Specialist Surgeon': '#EEF2FF',
  'Generalist':         '#F5F5F5',
};

// Base fill opacity for inactive quadrants (active always 0.60)
const QUADRANT_BASE_OPACITY: Record<QuadrantLabel, number> = {
  'Paragon Leader':     0.40,
  'Utility Player':     0.30,
  'Specialist Surgeon': 0.40,
  'Generalist':         0.40,
};

// Quadrant pill badge colors (unchanged)
const QUADRANT_PILL_BG: Record<QuadrantLabel, string> = {
  'Paragon Leader':    '#0F6E56',
  'Specialist Surgeon':'#1D9E75',
  'Utility Player':    '#F59E0B',
  'Generalist':        '#888780',
};

// Corner label colors per quadrant
const QUADRANT_LABEL_COLOR: Record<QuadrantLabel, string> = {
  'Paragon Leader':     '#0F6E56',
  'Specialist Surgeon': '#1D9E75',
  'Utility Player':     '#F59E0B',
  'Generalist':         '#888780',
};

// Fixed TC medians from full validated dataset (not filtered)
const QUADRANT_TC_MEDIAN: Record<QuadrantLabel, string> = {
  'Paragon Leader':     '$700k median',
  'Specialist Surgeon': '$577k median',
  'Utility Player':     '$403k median',
  'Generalist':         '$380k median',
};

function fmt1(v: number) { return v.toFixed(1); }

export function PISCoordinateChart({ pis, candidate, mode }: PISCoordinateChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  const {
    peer_points,
    all_peer_points,
    total_market_n,
    quadrant_peer_fss_median,
    quadrant_peer_rci_median,
    fss,
    rci,
    pis: pisScore,
    quadrant,
  } = pis;

  // Compute axis extents from all peer data so ghost dots don't fall outside the chart
  const allFSS = all_peer_points.map(p => p.fss);
  const allRCI = all_peer_points.map(p => p.rci);
  const maxFSS = Math.max(...allFSS, fss, 2) * 1.1;
  const maxRCI = 100;

  function toChartX(fssVal: number) {
    return PAD_L + (fssVal / maxFSS) * PLOT_W;
  }
  function toChartY(rciVal: number) {
    return PAD_T + (1 - rciVal / maxRCI) * PLOT_H;
  }

  // Crosshair positions (peer medians)
  const crossX = toChartX(quadrant_peer_fss_median);
  const crossY = toChartY(quadrant_peer_rci_median);

  // Current role marker position
  const roleCX = toChartX(fss);
  const roleCY = toChartY(rci.rci_score);

  // Animate role dot to new position when pis changes — 400ms cubic ease, preserved
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

  // Ghost dots active when matched peer set is sparse
  const showGhostDots = peer_points.length < 30;

  // Quadrant zone opacity — active quadrant gets 60%, inactive uses base
  function zoneOpacity(zone: QuadrantLabel): number {
    return zone === quadrant ? 0.60 : QUADRANT_BASE_OPACITY[zone];
  }

  // Quadrant background zones — active gets elevated opacity
  function renderQuadrantZones() {
    const midX = crossX;
    const midY = crossY;
    return (
      <>
        {/* Top-left: Specialist Surgeon */}
        <rect x={PAD_L} y={PAD_T} width={midX - PAD_L} height={midY - PAD_T}
          fill={QUADRANT_COLORS['Specialist Surgeon']} fillOpacity={zoneOpacity('Specialist Surgeon')} />
        {/* Top-right: Paragon Leader */}
        <rect x={midX} y={PAD_T} width={PAD_L + PLOT_W - midX} height={midY - PAD_T}
          fill={QUADRANT_COLORS['Paragon Leader']} fillOpacity={zoneOpacity('Paragon Leader')} />
        {/* Bottom-left: Generalist */}
        <rect x={PAD_L} y={midY} width={midX - PAD_L} height={PAD_T + PLOT_H - midY}
          fill={QUADRANT_COLORS['Generalist']} fillOpacity={zoneOpacity('Generalist')} />
        {/* Bottom-right: Utility Player */}
        <rect x={midX} y={midY} width={PAD_L + PLOT_W - midX} height={PAD_T + PLOT_H - midY}
          fill={QUADRANT_COLORS['Utility Player']} fillOpacity={zoneOpacity('Utility Player')} />
      </>
    );
  }

  // Corner-anchored two-line quadrant labels — 16px from each outer corner
  function renderQuadrantCornerLabels() {
    const CORNER_PAD = 16;
    const labelStyle = (q: QuadrantLabel): React.CSSProperties => ({
      fontSize: 11,
      fontVariant: 'small-caps',
      fontWeight: 500,
      letterSpacing: '0.06em',
      fill: QUADRANT_LABEL_COLOR[q],
      fontFamily: 'var(--font-inter)',
    });
    const medianStyle: React.CSSProperties = {
      fontSize: 11,
      fill: '#888780',
      fontFamily: 'var(--font-jetbrains-mono)',
    };

    return (
      <>
        {/* Top-left: Specialist Surgeon */}
        <text
          x={PAD_L + CORNER_PAD}
          y={PAD_T + CORNER_PAD}
          textAnchor="start"
          style={labelStyle('Specialist Surgeon')}
        >
          Specialist Surgeon
        </text>
        <text
          x={PAD_L + CORNER_PAD}
          y={PAD_T + CORNER_PAD + 14}
          textAnchor="start"
          style={medianStyle}
        >
          {QUADRANT_TC_MEDIAN['Specialist Surgeon']}
        </text>

        {/* Top-right: Paragon Leader */}
        <text
          x={PAD_L + PLOT_W - CORNER_PAD}
          y={PAD_T + CORNER_PAD}
          textAnchor="end"
          style={labelStyle('Paragon Leader')}
        >
          Paragon Leader
        </text>
        <text
          x={PAD_L + PLOT_W - CORNER_PAD}
          y={PAD_T + CORNER_PAD + 14}
          textAnchor="end"
          style={medianStyle}
        >
          {QUADRANT_TC_MEDIAN['Paragon Leader']}
        </text>

        {/* Bottom-left: Generalist */}
        <text
          x={PAD_L + CORNER_PAD}
          y={PAD_T + PLOT_H - CORNER_PAD - 12}
          textAnchor="start"
          style={labelStyle('Generalist')}
        >
          Generalist
        </text>
        <text
          x={PAD_L + CORNER_PAD}
          y={PAD_T + PLOT_H - CORNER_PAD}
          textAnchor="start"
          style={medianStyle}
        >
          {QUADRANT_TC_MEDIAN['Generalist']}
        </text>

        {/* Bottom-right: Utility Player */}
        <text
          x={PAD_L + PLOT_W - CORNER_PAD}
          y={PAD_T + PLOT_H - CORNER_PAD - 12}
          textAnchor="end"
          style={labelStyle('Utility Player')}
        >
          Utility Player
        </text>
        <text
          x={PAD_L + PLOT_W - CORNER_PAD}
          y={PAD_T + PLOT_H - CORNER_PAD}
          textAnchor="end"
          style={medianStyle}
        >
          {QUADRANT_TC_MEDIAN['Utility Player']}
        </text>
      </>
    );
  }

  function handleRoleDotHover(e: React.MouseEvent<SVGGElement>) {
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
      {/* Card header — top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span className="label-caps">Leadership Intensity Matrix</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="font-mono" style={{ fontSize: 14, color: '#0F4A42', fontWeight: 500 }}>
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

      {/* Context line below header */}
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 12 }}>
        Role positioned relative to{' '}
        <span className="font-mono">{peer_points.length}</span> matched peers and{' '}
        <span className="font-mono">{total_market_n}</span> market records
      </div>

      {/* Chart area */}
      <div className="relative" onMouseLeave={() => setTooltip(null)}>
        <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ display: 'block' }}>

          {/* Quadrant background fills — active quadrant at 60%, inactive at base opacity */}
          {renderQuadrantZones()}

          {/* Chart border */}
          <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={PLOT_H}
            fill="none" stroke="#D3D1C7" strokeWidth={1} />

          {/* Layer 1: Ghost dots (full dataset) — only rendered when matched peers < 30 */}
          {showGhostDots && all_peer_points.map((p, i) => (
            <circle
              key={`ghost-${i}`}
              cx={toChartX(p.fss)}
              cy={toChartY(p.rci)}
              r={3}
              fill="#E8E8E8"
              fillOpacity={0.4}
            />
          ))}

          {/* Layer 2: Matched peer dots */}
          {peer_points.map((p, i) => (
            <circle
              key={`peer-${i}`}
              cx={toChartX(p.fss)}
              cy={toChartY(p.rci)}
              r={4}
              fill="#B4B2A9"
              fillOpacity={0.7}
            />
          ))}

          {/* Crosshairs at peer medians */}
          <line x1={crossX} y1={PAD_T} x2={crossX} y2={PAD_T + PLOT_H}
            stroke="#D3D1C7" strokeWidth={1} strokeDasharray="4,4" />
          <line x1={PAD_L} y1={crossY} x2={PAD_L + PLOT_W} y2={crossY}
            stroke="#D3D1C7" strokeWidth={1} strokeDasharray="4,4" />

          {/* Crosshair end labels — clarify what the dashed lines reference */}
          <text
            x={PAD_L + PLOT_W - 3}
            y={crossY - 4}
            textAnchor="end"
            style={{ fontSize: 11, fill: '#B4B2A9', fontFamily: 'var(--font-inter)' }}
          >
            Peer median FSS
          </text>
          <text
            x={crossX + 4}
            y={PAD_T + 11}
            textAnchor="start"
            style={{ fontSize: 11, fill: '#B4B2A9', fontFamily: 'var(--font-inter)' }}
          >
            Peer median RCI
          </text>

          {/* Corner quadrant labels */}
          {renderQuadrantCornerLabels()}

          {/* Y-axis labels — "Role Complexity" + secondary, rotated */}
          <text
            x={-(PAD_T + PLOT_H / 2)}
            y={14}
            textAnchor="middle"
            transform="rotate(-90)"
            style={{ fontSize: 13, fill: '#5F5E5A', fontFamily: 'var(--font-inter)' }}
          >
            Role Complexity
          </text>
          <text
            x={-(PAD_T + PLOT_H / 2)}
            y={28}
            textAnchor="middle"
            transform="rotate(-90)"
            style={{ fontSize: 11, fill: '#888780', fontFamily: 'var(--font-inter)' }}
          >
            ↓ Low friction          High friction ↑
          </text>

          {/* X-axis labels — "Functional Scope" + secondary */}
          <text
            x={PAD_L + PLOT_W / 2}
            y={CHART_H - 30}
            textAnchor="middle"
            style={{ fontSize: 13, fill: '#5F5E5A', fontFamily: 'var(--font-inter)' }}
          >
            Functional Scope
          </text>
          <text
            x={PAD_L + PLOT_W / 2}
            y={CHART_H - 14}
            textAnchor="middle"
            style={{ fontSize: 11, fill: '#888780', fontFamily: 'var(--font-inter)' }}
          >
            ← Narrow role          Broad role →
          </text>

          {/* Candidate dot (offer mode) — unchanged */}
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

          {/* Current role marker — target style: outer ring + inner dot, animated */}
          <g
            style={{ cursor: 'pointer' }}
            onMouseMove={handleRoleDotHover}
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Outer ring — 14px diameter, transparent fill */}
            <circle
              cx={displayCX}
              cy={displayCY}
              r={7}
              fill="transparent"
              stroke="#0F6E56"
              strokeWidth={2}
            />
            {/* Inner dot — 5px diameter */}
            <circle
              cx={displayCX}
              cy={displayCY}
              r={2.5}
              fill="#0F6E56"
            />
          </g>

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

      {/* Density indicator — shown when matched peer set is sparse */}
      {showGhostDots && (
        <div style={{ fontSize: 11, color: '#888780', fontStyle: 'italic', marginTop: 4, textAlign: 'left' }}>
          Showing {peer_points.length} matched peers — broaden filters for larger peer set
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>

          {/* This role — mini target marker matching chart style */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888780' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
              <circle cx="6" cy="6" r="5" fill="transparent" stroke="#0F6E56" strokeWidth="1.5" />
              <circle cx="6" cy="6" r="2" fill="#0F6E56" />
            </svg>
            This role profile
          </span>

          {/* Matched peers */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888780' }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              backgroundColor: '#B4B2A9', flexShrink: 0,
            }} />
            Matched peers (<span className="font-mono">{peer_points.length}</span> records)
          </span>

          {/* Full market reference — only shown when ghost dots are active */}
          {showGhostDots && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888780' }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                backgroundColor: '#E8E8E8', border: '1px solid #D3D1C7', flexShrink: 0,
              }} />
              Full market reference (<span className="font-mono">{total_market_n}</span> records)
            </span>
          )}
        </div>

        <span style={{ fontSize: 11, color: '#888780', whiteSpace: 'nowrap' }}>
          Dashed lines = matched peer medians
        </span>
      </div>
    </div>
  );
}
