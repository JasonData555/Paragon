import type { CompanyStructure, MetroTier, RoleTier, SizeBucket } from './types';

// ---------------------------------------------------------------------------
// Confidence thresholds (applied to weighted effective N)
// ---------------------------------------------------------------------------
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 30,
  MEDIUM: 15,
  LOW: 8,
} as const;

// ---------------------------------------------------------------------------
// Recency weighting
// ---------------------------------------------------------------------------
export const RECENCY_MAX_MONTHS = 24;
export const RECENCY_DECAY_FACTOR = 0.4;

// ---------------------------------------------------------------------------
// FSS algorithm parameters
// ---------------------------------------------------------------------------
export const FSS_DIMINISHING_RETURNS_THRESHOLD = 13;
export const FSS_DIMINISHING_RETURNS_FACTOR = 0.5;

// ---------------------------------------------------------------------------
// Filter application order (relaxation reverses this)
// ---------------------------------------------------------------------------
export const FILTER_PRIORITY = [
  'role_tier',
  'industry',
  'company_structure',
  'size_bucket',
  'metro_tier',
] as const;

export const RELAX_ORDER = ['metro_tier', 'size_bucket', 'company_structure', 'industry'] as const;

// ---------------------------------------------------------------------------
// Governance stats (published analytical values — r-values and spec benchmarks)
// NOTE: Live prevalence rates and TC deltas are computed dynamically in query
// engine from the filtered dataset. These are the overall-dataset reference values.
// ---------------------------------------------------------------------------
export const GOVERNANCE_STATS = {
  has_accel_vest: {
    key: 'has_accel_vest',
    name: 'Accelerated Vesting Double Trigger',
    prevalence_pct: 16,
    delta: 362000,
    correlation: 0.284,
    tc_have: 810000,
    tc_dont: 448000,
  },
  has_severance: {
    key: 'has_severance',
    name: 'Pre-Negotiated Severance',
    prevalence_pct: 17,
    delta: 351000,
    correlation: 0.255,
    tc_have: 800000,
    tc_dont: 449000,
  },
  has_indemnification: {
    key: 'has_indemnification',
    name: 'Corporate Indemnification',
    prevalence_pct: 22,
    delta: 211000,
    correlation: 0.217,
    tc_have: 658000,
    tc_dont: 447000,
  },
  has_do: {
    key: 'has_do',
    name: 'D&O Coverage',
    prevalence_pct: 50,
    delta: 250000,
    correlation: 0.304,
    tc_have: 623000,
    tc_dont: 373000,
  },
} as const;

// Display order: strongest delta first
export const GOVERNANCE_DISPLAY_ORDER = [
  'has_accel_vest',
  'has_severance',
  'has_indemnification',
  'has_do',
] as const;

// Full trifecta = D&O + Severance + Accel Vesting (7.7% prevalence, matches spec's "7.6%")
// Full quad = all four (3.4% prevalence)
export const FULL_TRIFECTA_PREVALENCE = 7.7;
export const FULL_TRIFECTA_TC_MEDIAN = 900000;
export const FULL_QUAD_PREVALENCE = 3.4;
export const FULL_QUAD_TC_MEDIAN = 955000;
export const ZERO_PROTECTION_PREVALENCE = 33;
export const ZERO_PROTECTION_TC_MEDIAN = 337000;
export const ZERO_PROTECTION_PEER_MEDIAN = 594000;
export const ZERO_PROTECTION_GAP = 257000;

// Secondary governance
export const SIGNING_BONUS_PREVALENCE = 36;
export const SIGNING_BONUS_DELTA = 277000;
export const BOARD_QUARTERLY_PREVALENCE = 48;
export const BOARD_QUARTERLY_DELTA = 200000;
export const BOARD_NO_ACCESS_PREVALENCE = 14;
export const BOARD_NO_ACCESS_DELTA = -176000;

// ---------------------------------------------------------------------------
// Dataset benchmarks (n=926 after outlier removal — from spec)
// ---------------------------------------------------------------------------
export const DATASET_BENCHMARKS = {
  base: { p25: 250000, p50: 300000, p75: 365000, p90: 425000 },
  total_comp: { p25: 315000, p50: 480000, p75: 805000, p90: 1103000 },
};

export const SIZE_BUCKET_BENCHMARKS: Record<SizeBucket, { n: number; base_p50: number; tc_p50: number }> = {
  'Small':       { n: 286, base_p50: 275000, tc_p50: 377000 },
  'Mid-Market':  { n: 351, base_p50: 300000, tc_p50: 525000 },
  'Large':       { n: 187, base_p50: 330000, tc_p50: 540000 },
  'Enterprise':  { n: 102, base_p50: 350000, tc_p50: 668000 },
};

// ---------------------------------------------------------------------------
// Filter option lists
// ---------------------------------------------------------------------------
export const ROLE_TIER_OPTIONS: RoleTier[] = ['CISO', 'VP Security', 'Director', 'Manager'];

export const COMPANY_STRUCTURE_OPTIONS: CompanyStructure[] = [
  'Publicly Traded',
  'Privately Held',
  'PE-Backed',
  'Non-Profit',
  'Government',
];

export const SIZE_BUCKET_OPTIONS: SizeBucket[] = ['Small', 'Mid-Market', 'Large', 'Enterprise'];

export const METRO_TIER_OPTIONS: Array<MetroTier | 'All'> = ['All', 'T1', 'T2', 'T3'];

export const METRO_TIER_LABELS: Record<MetroTier | 'All', string> = {
  'All': 'All Metros',
  'T1': 'Tier 1 (SF, NY, SEA, LA)',
  'T2': 'Tier 2 (ATL, CHI, BOS, DC)',
  'T3': 'Tier 3 (Regional)',
};

// Static industry fallback (populated from dataset at runtime via data-loader)
export const INDUSTRY_FALLBACK = [
  'Artificial Intelligence (AI)',
  'Banking / Financial Services',
  'BioTech',
  'Cloud Security',
  'Education',
  'Enterprise Software',
  'FinTech',
  'Financial Services',
  'Government',
  'Healthcare',
  'HealthTech',
  'Industrial / Manufacturing',
  'Insurance',
  'Internet',
  'Manufacturing',
  'Professional Services',
  'Retail',
  'Technology',
  'Telecommunications',
  'Other',
];
