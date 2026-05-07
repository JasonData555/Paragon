'use client';

interface PillToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  required?: boolean;
}

export function PillToggle<T extends string>({ options, value, onChange, required }: PillToggleProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-pill transition-colors border ${
              active
                ? 'bg-paragon-accent-primary border-paragon-accent-primary text-white'
                : 'bg-white border-paragon-border text-paragon-text-secondary hover:border-paragon-border-dark hover:text-paragon-text-primary'
            }`}
          >
            {opt.label}
            {required && active && <span className="ml-1 opacity-70">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
