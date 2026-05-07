export type RoleTier = 'CISO' | 'VP Security' | 'Director' | 'Manager';
export type MetroTier = 'T1' | 'T2' | 'T3';
export type CompanyStructure = 'Publicly Traded' | 'Privately Held' | 'PE-Backed' | 'Non-Profit' | 'Government';
export type SizeBucket = 'Small' | 'Mid-Market' | 'Large' | 'Enterprise';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
export type FSSLabel = 'Narrow' | 'Standard' | 'Broad' | 'Expansive';
export type OperatingMode = 'intake' | 'offer';

export interface SurveyRecord {
  id: string;
  survey_date: string;
  survey_year: number;
  email: string | null;
  title: string | null;
  role_tier: RoleTier;
  location: string | null;
  metro_tier: MetroTier | null;
  industry: string | null;
  company_structure: CompanyStructure | null;
  size_bucket: SizeBucket | null;
  reporting_to: string | null;
  team_size: number | null;
  base_salary: number | null;
  bonus: number | null;
  equity: number | null;
  board_frequency: string | null;
  functions: string[];
  has_do: boolean;
  has_indemnification: boolean;
  has_severance: boolean;
  has_accel_vest: boolean;
  has_signing: boolean;
  full_quad: boolean;
  zero_quad: boolean;
  zero_protection: boolean;
  elevated_reporting: boolean;
  board_quarterly: boolean;
  board_semi: boolean;
  board_regular: boolean;
  board_no_access: boolean;
  repeat_ciso: boolean;
  first_time_ciso: boolean;
}

export interface WeightedRecord extends SurveyRecord {
  age_months: number;
  recency_weight: number;
}

export interface QueryParams {
  role_tier: RoleTier;
  industry?: string;
  company_structure?: CompanyStructure;
  size_bucket?: SizeBucket;
  metro_tier?: MetroTier | 'All';
  selected_functions?: string[];
  candidate_base?: number;
  candidate_bonus?: number;
  candidate_equity?: number;
  mode: OperatingMode;
}

export interface PercentileBand {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sample_n: number;
}

export interface CompBands {
  base: PercentileBand;
  bonus: PercentileBand;
  equity: PercentileBand;
  total_cash: PercentileBand;
  total_comp: PercentileBand;
}

export interface GovernanceElement {
  key: string;
  name: string;
  prevalence_pct: number;
  delta: number;
  correlation: number;
  tc_have: number;
  tc_dont: number;
}

export interface GovernanceResult {
  elements: GovernanceElement[];
  full_trifecta_pct: number;
  full_quad_pct: number;
  zero_protection_pct: number;
  signing_bonus_pct: number;
  signing_bonus_delta: number;
  board_quarterly_pct: number;
  board_no_access_pct: number;
  board_regular_pct: number;
}

export interface ReportingLine {
  title: string;
  count: number;
  pct: number;
}

export interface FunctionFrequency {
  name: string;
  count: number;
  pct: number;
}

export interface OrgStructureResult {
  team_size_p25: number;
  team_size_p50: number;
  team_size_p75: number;
  team_size_n: number;
  top_reporting_lines: ReportingLine[];
  top_functions: FunctionFrequency[];
}

export interface FSSDistribution {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface FSSResult {
  score: number;
  label: FSSLabel;
  peer_percentile: number;
  peer_distribution: FSSDistribution;
  tier1_owned: string[];
  tier1_missing: string[];
  justification: string;
}

export interface RelaxationStep {
  field_relaxed: string;
  n_before: number;
  n_after: number;
}

export interface AppliedFilters {
  role_tier: RoleTier;
  industry: string | null;
  company_structure: CompanyStructure | null;
  size_bucket: SizeBucket | null;
  metro_tier: MetroTier | 'All' | null;
}

export interface CandidatePosition {
  base_percentile: number | null;
  total_comp_percentile: number | null;
  base_value: number;
  bonus_value: number;
  equity_value: number;
  total_cash: number;
  total_comp: number;
}

export interface QueryResult {
  confidence: ConfidenceLevel;
  raw_n: number;
  weighted_n: number;
  relaxation_log: RelaxationStep[];
  comp_bands: CompBands;
  benchmark_comp: CompBands;
  profile_comp: CompBands;
  benchmark_n: number;
  profile_n: number;
  governance: GovernanceResult;
  org_structure: OrgStructureResult;
  fss: FSSResult | null;
  statement: string;
  candidate: CandidatePosition | null;
  filters_applied: AppliedFilters;
  query_params: QueryParams;
}

export interface AuditEvent {
  timestamp: string;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'IMPORT' | 'DELETE' | 'EXPORT';
  records_affected?: number;
  detail?: string;
  ip?: string;
}

export interface ValidationResult {
  status: 'pass' | 'warn' | 'fail';
  row_count: number;
  checks: ValidationCheck[];
  duplicate_count: number;
  longitudinal_count: number;
}

export interface ValidationCheck {
  field: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface MergePreview {
  new_records: number;
  duplicate_skipped: number;
  longitudinal: number;
  expiring_after_upload: number;
}

export interface ImportResult {
  added: number;
  skipped: number;
  warnings: number;
  skipped_details: Array<{ email: string; year: number; reason: string }>;
}
