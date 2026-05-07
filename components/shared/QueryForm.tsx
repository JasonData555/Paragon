'use client';

import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PillToggle } from '@/components/ui/PillToggle';
import { SearchableDropdown } from '@/components/ui/SearchableDropdown';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { FunctionSelector } from '@/components/shared/FunctionSelector';
import type { QueryParams, QueryResult, RoleTier, MetroTier, CompanyStructure, SizeBucket, OperatingMode } from '@/lib/types';

const ROLE_OPTIONS: { value: RoleTier; label: string }[] = [
  { value: 'CISO', label: 'CISO' },
  { value: 'VP Security', label: 'VP Security' },
  { value: 'Director', label: 'Director' },
  { value: 'Manager', label: 'Manager' },
];

const METRO_OPTIONS: { value: MetroTier; label: string }[] = [
  { value: 'T1', label: 'T1 — Major Metro' },
  { value: 'T2', label: 'T2 — Secondary' },
  { value: 'T3', label: 'T3 — Other' },
];

const STRUCTURE_OPTIONS: { value: CompanyStructure; label: string }[] = [
  { value: 'Publicly Traded', label: 'Publicly Traded' },
  { value: 'Privately Held', label: 'Privately Held' },
  { value: 'PE-Backed', label: 'PE-Backed' },
  { value: 'Non-Profit', label: 'Non-Profit' },
  { value: 'Government', label: 'Government' },
];

const SIZE_OPTIONS: { value: SizeBucket; label: string }[] = [
  { value: 'Small', label: 'Small (<250)' },
  { value: 'Mid-Market', label: 'Mid-Market (250–999)' },
  { value: 'Large', label: 'Large (1,000–4,999)' },
  { value: 'Enterprise', label: 'Enterprise (5,000+)' },
];

interface QueryFormProps {
  mode: OperatingMode;
  onResult: (result: QueryResult, params: QueryParams) => void;
  onLoading: (loading: boolean) => void;
  fssDistribution?: { p25: number; p50: number; p75: number; p90: number };
}

const MIN_LOADING_MS = 600;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div className="label-caps mb-2">
      {children}
      {required && <span className="text-paragon-danger ml-1">*</span>}
    </div>
  );
}

export function QueryForm({ mode, onResult, onLoading, fssDistribution }: QueryFormProps) {
  const [roleTier, setRoleTier] = useState<RoleTier | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [companyStructure, setCompanyStructure] = useState<CompanyStructure | null>(null);
  const [sizeBucket, setSizeBucket] = useState<SizeBucket | null>(null);
  const [metroTier, setMetroTier] = useState<MetroTier | null>(null);
  const [functions, setFunctions] = useState<string[]>([]);

  // Offer mode inputs
  const [candidateBase, setCandidateBase] = useState<number | null>(null);
  const [candidateBonus, setCandidateBonus] = useState<number | null>(null);
  const [candidateEquity, setCandidateEquity] = useState<number | null>(null);

  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasResult = useRef(false);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((data: { industries?: string[] }) => {
        if (data.industries) setIndustries(data.industries);
      })
      .catch(() => {});
  }, []);

  async function submitQuery(currentFunctions: string[]) {
    if (!roleTier) return;

    const params: QueryParams = {
      role_tier: roleTier,
      industry: industry ?? undefined,
      company_structure: companyStructure ?? undefined,
      size_bucket: sizeBucket ?? undefined,
      metro_tier: metroTier ?? undefined,
      selected_functions: currentFunctions.length > 0 ? currentFunctions : undefined,
      candidate_base: mode === 'offer' ? (candidateBase ?? undefined) : undefined,
      candidate_bonus: mode === 'offer' ? (candidateBonus ?? undefined) : undefined,
      candidate_equity: mode === 'offer' ? (candidateEquity ?? undefined) : undefined,
      mode,
    };

    setLoading(true);
    setError('');
    onLoading(true);

    const [res] = await Promise.all([
      fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }),
      new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS)),
    ]);

    try {
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Query failed');
      } else {
        hasResult.current = true;
        onResult(data as QueryResult, params);
      }
    } catch {
      setError('Request failed');
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuery(functions);
  }

  // Auto-resubmit when functions change after the first successful query
  useEffect(() => {
    if (!hasResult.current || loading) return;
    const timer = setTimeout(() => submitQuery(functions), 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functions]);

  // Auto-resubmit when other filter fields change after the first successful query
  useEffect(() => {
    if (!hasResult.current || loading) return;
    const timer = setTimeout(() => submitQuery(functions), 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleTier, industry, companyStructure, sizeBucket, metroTier]);

  const canSubmit = roleTier != null && !loading;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page title and subtitle */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: '#2C2C2A', marginBottom: 6 }}>
          {mode === 'intake' ? 'Intake Brief' : 'Offer Brief'}
        </h1>
        <p style={{ fontSize: 14, color: '#5F5E5A', lineHeight: 1.6 }}>
          {mode === 'intake'
            ? 'Generate real-time compensation and governance intelligence for a candidate profile'
            : 'Position a compensation package against the peer distribution'}
        </p>
      </div>

      {/* Scrollable content area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>

        {/* SECTION 1: PRIMARY PROFILE */}
        <div className="label-caps text-paragon-text-secondary" style={{ marginBottom: 16 }}>
          Primary Profile
        </div>

        {/* 1. Role Tier */}
        <div style={{ marginBottom: 20 }}>
          <FieldLabel required>Role Tier</FieldLabel>
          <PillToggle
            options={ROLE_OPTIONS}
            value={roleTier}
            onChange={setRoleTier}
            required
          />
        </div>

        {/* 2. Industry */}
        <div style={{ marginBottom: 20 }}>
          <SearchableDropdown
            label="Industry"
            options={industries}
            value={industry}
            onChange={setIndustry}
            placeholder="Any industry"
          />
        </div>

        {/* 3. Company Structure */}
        <div style={{ marginBottom: 20 }}>
          <SearchableDropdown
            label="Company Structure"
            options={STRUCTURE_OPTIONS.map(o => o.value)}
            value={companyStructure}
            onChange={v => setCompanyStructure(v as CompanyStructure | null)}
            placeholder="Any structure"
          />
        </div>

        {/* 4. Company Size */}
        <div style={{ marginBottom: 20 }}>
          <SearchableDropdown
            label="Company Size"
            options={SIZE_OPTIONS.map(o => o.value)}
            value={sizeBucket}
            onChange={v => setSizeBucket(v as SizeBucket | null)}
            placeholder="Any size"
          />
        </div>

        {/* 5. Metro Tier */}
        <div style={{ marginBottom: mode === 'offer' ? 0 : 0 }}>
          <FieldLabel>Metro Tier</FieldLabel>
          <PillToggle
            options={METRO_OPTIONS}
            value={metroTier}
            onChange={setMetroTier}
          />
        </div>

        {/* Offer mode — Candidate Compensation inputs (after Metro Tier) */}
        {mode === 'offer' && (
          <>
            <div style={{ height: 1, backgroundColor: '#D3D1C7', margin: '20px 0' }} />
            <div className="label-caps text-paragon-text-secondary" style={{ marginBottom: 12 }}>
              Candidate Compensation
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <CurrencyInput
                label="Annual Base"
                value={candidateBase}
                onChange={setCandidateBase}
                placeholder="$300,000"
              />
              <CurrencyInput
                label="Annual Bonus"
                value={candidateBonus}
                onChange={setCandidateBonus}
                placeholder="$0"
              />
              <CurrencyInput
                label="Annual Equity — RSU"
                value={candidateEquity}
                onChange={setCandidateEquity}
                placeholder="$0"
              />
            </div>
          </>
        )}

        {/* Hairline divider between sections */}
        <div style={{ height: 1, backgroundColor: '#D3D1C7', margin: '24px 0' }} />

        {/* SECTION 2: FUNCTIONAL SCOPE */}
        <div className="label-caps text-paragon-text-secondary" style={{ marginBottom: 12 }}>
          Functional Scope
        </div>

        <FunctionSelector
          selected={functions}
          onChange={setFunctions}
          peerDistribution={fssDistribution}
          hasQueryResult={fssDistribution != null}
        />
      </div>

      {/* Sticky footer */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          backgroundColor: '#FFFFFF',
          paddingTop: 12,
          borderTop: '1px solid #D3D1C7',
          marginTop: 8,
          flexShrink: 0,
        }}
      >
        {/* Error chip */}
        {error && (
          <div
            className="flex items-center justify-between mb-3 rounded"
            style={{
              backgroundColor: '#FEF3C7',
              border: '1px solid #F59E0B',
              color: '#92400E',
              fontSize: 12,
              padding: '8px 12px',
              borderRadius: 8,
            }}
          >
            <span>No matching records — try broadening your filters</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="ml-2 flex-shrink-0"
              aria-label="Dismiss error"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 12,
            backgroundColor: loading ? '#0F6E56' : '#0F6E56',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 500,
            border: 'none',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: !canSubmit && !loading ? 0.5 : loading ? 0.8 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'background-color 150ms',
          }}
          onMouseEnter={e => {
            if (canSubmit && !loading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0A5240';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0F6E56';
          }}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Generating...
            </>
          ) : (
            'Generate Brief →'
          )}
        </button>
      </div>
    </form>
  );
}
