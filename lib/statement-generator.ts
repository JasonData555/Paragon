import type {
  AppliedFilters,
  CompBands,
  ConfidenceLevel,
  FSSResult,
  GovernanceResult,
} from './types';

interface StatementInput {
  comp_bands: CompBands;
  governance: GovernanceResult;
  fss: FSSResult | null;
  filters_applied: AppliedFilters;
  confidence: ConfidenceLevel;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function generateStatement(input: StatementInput): string {
  const { comp_bands, governance, fss, filters_applied, confidence } = input;

  if (confidence === 'INSUFFICIENT') {
    return 'Insufficient data to generate a market calibration statement for these filter parameters. Try broadening your search criteria.';
  }

  const scopeLabel = fss ? ` with a ${fss.label.toLowerCase()} functional scope` : '';
  const sizeContext = filters_applied.size_bucket
    ? ` at ${filters_applied.size_bucket.toLowerCase()}-market companies`
    : '';
  const industryContext = filters_applied.industry ? ` in ${filters_applied.industry}` : '';

  const baseP50 = comp_bands.base.p50;
  const tcP50 = comp_bands.total_comp.p50;

  const gouvHighlight = buildGovernanceHighlight(governance);
  return (
    `The market for ${filters_applied.role_tier} roles${sizeContext}${industryContext}${scopeLabel} shows a median base salary of ${fmt(baseP50)} and median total compensation of ${fmt(tcP50)}. ` +
    `Compensation spans ${fmt(comp_bands.base.p25)}–${fmt(comp_bands.base.p75)} at base (P25–P75), with total package ranging ${fmt(comp_bands.total_comp.p25)}–${fmt(comp_bands.total_comp.p75)}.` +
    (gouvHighlight ? ` ${gouvHighlight}` : '')
  );
}

function buildGovernanceHighlight(gov: GovernanceResult): string {
  const doElement = gov.elements.find(e => e.key === 'has_do');
  if (!doElement) return '';

  const prevalentElements = gov.elements.filter(e => e.prevalence_pct >= 40);
  const rareElements = gov.elements.filter(e => e.prevalence_pct < 20);

  if (gov.full_trifecta_pct > 5) {
    return `Only ${gov.full_trifecta_pct.toFixed(1)}% of comparable roles include D&O coverage, severance, and accelerated vesting — consider these as leverage points in negotiation.`;
  }

  if (rareElements.length >= 2) {
    const names = rareElements.slice(0, 2).map(e => e.name.split(' ')[0]).join(' and ');
    return `${names} protection provisions are present in fewer than 20% of comparable offers — strong differentiators if included.`;
  }

  if (doElement.prevalence_pct >= 45) {
    return `D&O coverage is present in ~${Math.round(doElement.prevalence_pct)}% of comparable roles — standard but worth confirming.`;
  }

  return '';
}
