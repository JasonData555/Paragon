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

// Canonical industry list — all industries in the dataset, alphabetical, used for dropdown
export const INDUSTRY_LIST = [
  'AdTech',
  'Aerospace & Defense',
  'Airlines',
  'Amusement / Gambling',
  'Artificial Intelligence (AI)',
  'Aviation',
  'Banking / Financial Services',
  'Big Data / Analytics',
  'BioTech / Pharma',
  'Broadcasting / Media',
  'Cloud Infrastructure',
  'Cloud Security',
  'Consulting',
  'Consulting / Professional Services',
  'Construction',
  'Consumer Packaged Goods',
  'Consumer Software',
  'Contingent Staffing',
  'Cryptocurrency',
  'Customer Experience (CX)',
  'EdTech',
  'Education',
  'Energy / Utilities',
  'Enterprise Software',
  'Entertainment / Media',
  'Financial Services',
  'FinTech',
  'Food & Beverage',
  'Government',
  'GovTech',
  'Healthcare',
  'HealthTech',
  'Home Services / Technology',
  'Industrial / Manufacturing',
  'Insurance',
  'Internet',
  'IoT security',
  'Legal',
  'Leisure / Hospitality',
  'Logistics / Transportation',
  'Other',
  'Professional Services',
  'Real Estate',
  'Retail',
  'Safety & Science',
  'Semiconductor',
  'Space Technology',
  'Technology',
  'Telecommunications',
  'Waste Management',
] as const;

// Keep INDUSTRY_FALLBACK as alias for backward compatibility with api/config route
export const INDUSTRY_FALLBACK = INDUSTRY_LIST;

// ---------------------------------------------------------------------------
// RCI scoring constants
// ---------------------------------------------------------------------------

// Reporting line points (case-insensitive contains match in pis-engine)
export const REPORTING_POINTS: Record<string, number> = {
  'Board of Directors': 30,
  'CEO': 25,
  'Chief Executive': 25,
  'COO': 20,
  'President': 20,
  'Chief Operating': 20,
  'Chief Technology Officer': 15,
  'CTO': 15,
  'Chief Financial Officer': 10,
  'CFO': 10,
  'General Counsel': 10,
  'CLO': 10,
  'Chief Risk Officer': 10,
  'CRO': 10,
  'Chief Product Officer': 8,
  'CPO': 8,
  'Chief Information Officer': 5,
  'CIO': 5,
  'VP Engineering': 5,
  'VP of Engineering': 5,
};

// Board access frequency points (exact match on board_frequency field values)
export const BOARD_POINTS: Record<string, number> = {
  'At least quarterly': 25,
  'At least semi-annually': 15,
  'At least annually': 8,
  'Per request': 4,
  'I do not report to the Board of Directors': 0,
};

// Company size points
export const SIZE_POINTS: Record<string, number> = {
  'Enterprise': 25,
  'Large': 18,
  'Mid-Market': 10,
  'Small': 5,
};

// Industry RCI points by tier
export const INDUSTRY_POINTS: Record<string, number> = {
  // Tier A — 20 pts
  'Consumer Software': 20,
  'Internet': 20,
  'FinTech': 20,
  'Food & Beverage': 20,
  'AdTech': 20,
  'Cryptocurrency': 20,
  'Customer Experience (CX)': 20,
  // Tier B — 18 pts
  'Enterprise Software': 18,
  'Big Data / Analytics': 18,
  // Tier D — 15 pts
  'Retail': 15,
  'Logistics / Transportation': 15,
  'Artificial Intelligence (AI)': 15,
  'Semiconductor': 15,
  'Technology': 15,
  'Home Services / Technology': 15,
  // Tier E — 14 pts
  'Insurance': 14,
  'EdTech': 14,
  // Tier F — 12 pts
  'Consumer Packaged Goods': 12,
  'Industrial / Manufacturing': 12,
  'Cloud Infrastructure': 12,
  'Healthcare': 12,
  'Leisure / Hospitality': 12,
  'Financial Services': 12,
  'Cloud Security': 12,
  'Banking / Financial Services': 12,
  'Telecommunications': 12,
  'Amusement / Gambling': 12,
  'IoT security': 12,
  'Real Estate': 12,
  'Safety & Science': 12,
  // Tier G — 10 pts
  'HealthTech': 10,
  'Airlines': 10,
  'Aviation': 10,
  'Space Technology': 10,
  // Tier H — 8 pts
  'Other': 8,
  'Entertainment / Media': 8,
  'Aerospace & Defense': 8,
  'BioTech / Pharma': 8,
  'Broadcasting / Media': 8,
  // Tier I — 7 pts
  'Professional Services': 7,
  'Legal': 7,
  'Consulting': 7,
  'Consulting / Professional Services': 7,
  'Contingent Staffing': 7,
  'Construction': 7,
  // Tier J — 6 pts
  'Energy / Utilities': 6,
  'Waste Management': 6,
  // Tier K — 4 pts
  'Education': 4,
  'GovTech': 4,
  // Tier L — 3 pts
  'Government': 3,
};

// RCI component weights (empirically optimized, n=926)
export const RCI_WEIGHTS = {
  reporting: 1.0,
  board: 1.5,
  size: 2.0,
  industry: 0.5,
} as const;

// Form dropdown options for reporting line and board frequency
export const REPORTING_LINE_OPTIONS = [
  'CEO',
  'COO / President',
  'Chief Technology Officer',
  'Chief Financial Officer',
  'General Counsel / Chief Legal Officer',
  'Chief Risk Officer',
  'Chief Product Officer',
  'Chief Information Officer',
  'VP Engineering',
  'Other',
] as const;

export const BOARD_FREQUENCY_OPTIONS = [
  'At least quarterly',
  'At least semi-annually',
  'At least annually',
  'Per request',
  'I do not report to the Board of Directors',
] as const;
