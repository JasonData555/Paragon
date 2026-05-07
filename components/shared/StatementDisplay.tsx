import type { OperatingMode, CandidatePosition } from '@/lib/types';

interface StatementDisplayProps {
  statement: string;
  mode: OperatingMode;
  candidate?: CandidatePosition | null;
}

function borderColor(mode: OperatingMode, candidate?: CandidatePosition | null): string {
  if (mode === 'intake') return 'border-paragon-accent-primary';
  if (!candidate) return 'border-paragon-accent-primary';
  const p = candidate.total_comp_percentile;
  if (p == null) return 'border-paragon-accent-primary';
  if (p >= 75) return 'border-paragon-success';
  if (p >= 50) return 'border-paragon-accent-primary';
  if (p >= 25) return 'border-paragon-warning';
  return 'border-paragon-danger';
}

// Bold numbers and key phrases (e.g., "$300K", "P50", "7.6%")
function parseStatement(text: string): React.ReactNode {
  const parts = text.split(/(\$[\d,KMB]+(?:\.\d+)?%?|\d+(?:\.\d+)?%|P\d{2}|r=[\d.]+)/g);
  return parts.map((part, i) =>
    /^\$|^\d+(?:\.\d+)?%$|^P\d{2}$|^r=/.test(part)
      ? <strong key={i} className="font-medium text-paragon-text-primary">{part}</strong>
      : part
  );
}

export function StatementDisplay({ statement, mode, candidate }: StatementDisplayProps) {
  const border = borderColor(mode, candidate);
  return (
    <div className={`card p-5 border-l-4 ${border} animate-fade-in-up`}>
      <p className="text-sm text-paragon-text-secondary leading-relaxed">
        {parseStatement(statement)}
      </p>
    </div>
  );
}
