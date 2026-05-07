'use client';

import { useState } from 'react';

interface CurrencyInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  placeholder?: string;
}

export function CurrencyInput({ value, onChange, label, placeholder = '$0' }: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);

  const display = focused
    ? (value != null ? String(value) : '')
    : (value != null ? `$${value.toLocaleString()}` : '');

  function handleChange(raw: string) {
    const digits = raw.replace(/[^0-9]/g, '');
    onChange(digits ? parseInt(digits, 10) : null);
  }

  return (
    <div>
      <div className="label-caps mb-1">{label}</div>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={focused ? '' : placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => handleChange(e.target.value)}
        className="w-full text-sm border border-paragon-border rounded-sm px-3 py-2 focus:outline-none focus:border-paragon-accent-primary transition-colors"
      />
    </div>
  );
}
