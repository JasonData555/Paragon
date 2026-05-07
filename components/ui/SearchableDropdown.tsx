'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface SearchableDropdownProps {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  label?: string;
}

export function SearchableDropdown({ options, value, onChange, placeholder = 'Select…', label }: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function select(opt: string | null) {
    onChange(opt);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={ref} className="relative">
      {label && <div className="label-caps mb-1">{label}</div>}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-paragon-border rounded-sm bg-white hover:border-paragon-border-dark transition-colors text-left"
      >
        <span className={value ? 'text-paragon-text-primary' : 'text-paragon-text-muted'}>
          {value ?? placeholder}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); select(null); }}
              className="text-paragon-text-muted hover:text-paragon-text-primary"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={12} className={`text-paragon-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-paragon-border rounded-sm shadow-lg max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-paragon-border">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full text-sm px-2 py-1 border border-paragon-border rounded-sm outline-none focus:border-paragon-accent-primary"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            <button
              type="button"
              onClick={() => select(null)}
              className="w-full text-left px-3 py-2 text-xs text-paragon-text-muted hover:bg-paragon-surface-primary transition-colors"
            >
              — Any —
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-paragon-text-muted">No results</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => select(opt)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    opt === value
                      ? 'bg-paragon-mint-chip text-paragon-accent-primary'
                      : 'text-paragon-text-secondary hover:bg-paragon-surface-primary hover:text-paragon-text-primary'
                  }`}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
