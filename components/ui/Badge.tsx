'use client';

import type { ConfidenceLevel } from '@/lib/types';

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  HIGH:         'bg-paragon-success text-white',
  MEDIUM:       'bg-paragon-warning text-white',
  LOW:          'bg-paragon-danger text-white',
  INSUFFICIENT: 'bg-paragon-danger text-white',
};

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  rawN: number;
  weightedN: number;
}

export function ConfidenceBadge({ level, rawN, weightedN }: ConfidenceBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-sm text-xs font-medium ${CONFIDENCE_STYLES[level]}`}>
      <span>{level}</span>
      <span className="opacity-80">n={rawN} (eff. {weightedN})</span>
    </span>
  );
}

interface ChipProps {
  children: React.ReactNode;
  className?: string;
}

export function Chip({ children, className = '' }: ChipProps) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-pill text-xs font-medium bg-paragon-mint-chip text-paragon-accent-primary ${className}`}>
      {children}
    </span>
  );
}
