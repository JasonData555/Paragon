interface StatementDisplayProps {
  statement: string;
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

export function StatementDisplay({ statement }: StatementDisplayProps) {
  return (
    <div className="card p-5 border-l-4 border-paragon-accent-primary animate-fade-in-up">
      <p className="text-sm text-paragon-text-secondary leading-relaxed">
        {parseStatement(statement)}
      </p>
    </div>
  );
}
