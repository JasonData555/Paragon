import type { ConfidenceLevel } from '@/lib/types';

const CONFIG: Record<ConfidenceLevel, { label: string; bg: string; text: string; border: string }> = {
  HIGH:         { label: 'HIGH',         bg: 'bg-paragon-success/10',  text: 'text-paragon-success',       border: 'border-paragon-success/30' },
  MEDIUM:       { label: 'MEDIUM',       bg: 'bg-amber-50',            text: 'text-amber-700',              border: 'border-amber-200' },
  LOW:          { label: 'LOW',          bg: 'bg-paragon-danger/10',   text: 'text-paragon-danger',         border: 'border-paragon-danger/30' },
  INSUFFICIENT: { label: 'INSUFFICIENT', bg: 'bg-paragon-danger/10',   text: 'text-paragon-danger',         border: 'border-paragon-danger/30' },
};

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel;
  n: number;
  effectiveN: number;
}

export function ConfidenceIndicator({ level, n, effectiveN }: ConfidenceIndicatorProps) {
  const { label, bg, text, border } = CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-medium border ${bg} ${text} ${border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        level === 'HIGH' ? 'bg-paragon-success' :
        level === 'MEDIUM' ? 'bg-amber-500' :
        'bg-paragon-danger'
      }`} />
      {label}
      <span className="opacity-70 font-normal">
        n={n} (eff. {effectiveN})
      </span>
    </span>
  );
}
