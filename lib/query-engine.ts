import { loadSurveyData, applyRecencyWeights } from './data-loader';
import {
  weightedPercentile,
  weightedEffectiveN,
  weightedRate,
} from './recency-weights';
import {
  CONFIDENCE_THRESHOLDS,
  GOVERNANCE_DISPLAY_ORDER,
  GOVERNANCE_STATS,
  RELAX_ORDER,
} from './constants';
import { calculateFSS, getFSSLabel, TIER1_FUNCTIONS, FLAGGED_NEUTRAL_FUNCTIONS } from './function-weights';
import { generateStatement } from './statement-generator';
import type {
  AppliedFilters,
  CompBands,
  ConfidenceLevel,
  FSSResult,
  GovernanceElement,
  GovernanceResult,
  OrgStructureResult,
  PercentileBand,
  QueryParams,
  QueryResult,
  RelaxationStep,
  WeightedRecord,
} from './types';

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------
type FilterKey = 'role_tier' | 'industry' | 'company_structure' | 'size_bucket' | 'metro_tier';

function filterRecords(
  records: WeightedRecord[],
  params: QueryParams,
  excludeFilters: FilterKey[] = [],
): WeightedRecord[] {
  return records.filter(r => {
    if (!excludeFilters.includes('role_tier') && r.role_tier !== params.role_tier) return false;

    if (!excludeFilters.includes('industry') && params.industry && params.industry !== '') {
      if (r.industry !== params.industry) return false;
    }

    if (!excludeFilters.includes('company_structure') && params.company_structure) {
      if (r.company_structure !== params.company_structure) return false;
    }

    if (!excludeFilters.includes('size_bucket') && params.size_bucket) {
      if (r.size_bucket !== params.size_bucket) return false;
    }

    if (
      !excludeFilters.includes('metro_tier') &&
      params.metro_tier &&
      params.metro_tier !== 'All'
    ) {
      if (r.metro_tier !== params.metro_tier) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Progressive relaxation
// ---------------------------------------------------------------------------
function progressiveRelax(
  allWeighted: WeightedRecord[],
  params: QueryParams,
): { filtered: WeightedRecord[]; log: RelaxationStep[] } {
  const log: RelaxationStep[] = [];
  const excluded: FilterKey[] = [];

  let current = filterRecords(allWeighted, params);
  let currentN = weightedEffectiveN(current.map(r => r.recency_weight));

  for (const field of RELAX_ORDER) {
    if (currentN >= CONFIDENCE_THRESHOLDS.LOW) break;

    excluded.push(field);
    const relaxed = filterRecords(allWeighted, params, [...excluded]);
    const relaxedN = weightedEffectiveN(relaxed.map(r => r.recency_weight));

    log.push({ field_relaxed: field, n_before: currentN, n_after: relaxedN });
    current = relaxed;
    currentN = relaxedN;
  }

  return { filtered: current, log };
}

// ---------------------------------------------------------------------------
// Confidence level
// ---------------------------------------------------------------------------
function getConfidence(weightedN: number): ConfidenceLevel {
  if (weightedN >= CONFIDENCE_THRESHOLDS.HIGH)  return 'HIGH';
  if (weightedN >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM';
  if (weightedN >= CONFIDENCE_THRESHOLDS.LOW)    return 'LOW';
  return 'INSUFFICIENT';
}

// ---------------------------------------------------------------------------
// Comp band calculation
// ---------------------------------------------------------------------------
function calcPercentileBand(
  values: (number | null)[],
  weights: number[],
): PercentileBand {
  const valid: { v: number; w: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) valid.push({ v: values[i]!, w: weights[i] });
  }

  if (valid.length === 0) {
    return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, sample_n: 0 };
  }

  const vs = valid.map(x => x.v);
  const ws = valid.map(x => x.w);

  return {
    p10: weightedPercentile(vs, ws, 10),
    p25: weightedPercentile(vs, ws, 25),
    p50: weightedPercentile(vs, ws, 50),
    p75: weightedPercentile(vs, ws, 75),
    p90: weightedPercentile(vs, ws, 90),
    sample_n: valid.length,
  };
}

function calcCompBands(records: WeightedRecord[]): CompBands {
  const weights = records.map(r => r.recency_weight);

  const baseBand = calcPercentileBand(records.map(r => r.base_salary), weights);
  const bonusBand = calcPercentileBand(records.map(r => r.bonus), weights);
  const equityBand = calcPercentileBand(records.map(r => r.equity), weights);

  // Total cash = base + bonus (impute 0 for null)
  const totalCash = records.map(r => (r.base_salary ?? 0) + (r.bonus ?? 0));
  const totalCashBand = calcPercentileBand(totalCash, weights);

  // Total comp = base + bonus + equity (impute 0 for null)
  const totalComp = records.map(r => (r.base_salary ?? 0) + (r.bonus ?? 0) + (r.equity ?? 0));
  const totalCompBand = calcPercentileBand(totalComp, weights);

  return {
    base:       baseBand,
    bonus:      bonusBand,
    equity:     equityBand,
    total_cash: totalCashBand,
    total_comp: totalCompBand,
  };
}

// ---------------------------------------------------------------------------
// Governance calculation (live from filtered data)
// ---------------------------------------------------------------------------
function calcGovernance(records: WeightedRecord[]): GovernanceResult {
  const weights = records.map(r => r.recency_weight);

  function calcElement(key: keyof typeof GOVERNANCE_STATS): GovernanceElement {
    const specStats = GOVERNANCE_STATS[key];
    const flags = records.map(r => r[key as keyof WeightedRecord] as boolean);
    const prevalence_pct = weightedRate(flags, weights) * 100;

    // Split TC for have vs don't-have
    const haveRecords = records.filter(r => r[key as keyof WeightedRecord]);
    const dontRecords = records.filter(r => !r[key as keyof WeightedRecord]);

    const tcOf = (subset: WeightedRecord[]) => {
      if (subset.length === 0) return 0;
      const tcs = subset.map(r => (r.base_salary ?? 0) + (r.bonus ?? 0) + (r.equity ?? 0));
      const ws = subset.map(r => r.recency_weight);
      return weightedPercentile(tcs, ws, 50);
    };

    const tc_have = tcOf(haveRecords);
    const tc_dont = tcOf(dontRecords);

    return {
      key,
      name:          specStats.name,
      prevalence_pct,
      delta:         tc_have - tc_dont,
      correlation:   specStats.correlation,
      tc_have,
      tc_dont,
    };
  }

  const elements = GOVERNANCE_DISPLAY_ORDER.map(key =>
    calcElement(key as keyof typeof GOVERNANCE_STATS),
  );

  const trifecta = records.filter(r => r.has_do && r.has_severance && r.has_accel_vest);
  const fullQuad = records.filter(r => r.full_quad);
  const zeroP = records.filter(r => r.zero_protection);

  const signing = records.map(r => r.has_signing);
  const bqRecs = records.map(r => r.board_quarterly);
  const bnaRecs = records.map(r => r.board_no_access);
  const brRecs  = records.map(r => r.board_regular);

  const calcTcMedian = (subset: WeightedRecord[]) => {
    if (subset.length === 0) return 0;
    const tcs = subset.map(r => (r.base_salary ?? 0) + (r.bonus ?? 0) + (r.equity ?? 0));
    const ws = subset.map(r => r.recency_weight);
    return weightedPercentile(tcs, ws, 50);
  };
  const signingHave = records.filter(r => r.has_signing);
  const signingDont = records.filter(r => !r.has_signing);
  const signingDelta = signingHave.length > 0 && signingDont.length > 0
    ? calcTcMedian(signingHave) - calcTcMedian(signingDont)
    : 277000;

  return {
    elements,
    full_trifecta_pct:  (trifecta.length / records.length) * 100,
    full_quad_pct:      (fullQuad.length / records.length) * 100,
    zero_protection_pct:(zeroP.length   / records.length) * 100,
    signing_bonus_pct:  weightedRate(signing, weights) * 100,
    signing_bonus_delta: signingDelta,
    board_quarterly_pct: weightedRate(bqRecs, weights) * 100,
    board_no_access_pct: weightedRate(bnaRecs, weights) * 100,
    board_regular_pct:   weightedRate(brRecs, weights) * 100,
  };
}

// ---------------------------------------------------------------------------
// Org structure calculation
// ---------------------------------------------------------------------------
function calcOrgStructure(records: WeightedRecord[]): OrgStructureResult {
  const weights = records.map(r => r.recency_weight);

  // Team size (non-null records)
  const teamSizes = records
    .map((r, i) => ({ v: r.team_size, w: weights[i] }))
    .filter(x => x.v != null) as Array<{ v: number; w: number }>;

  const tsvs = teamSizes.map(x => x.v);
  const tsws = teamSizes.map(x => x.w);

  // Reporting lines
  const reportCounts: Record<string, number> = {};
  for (const r of records) {
    if (!r.reporting_to) continue;
    const title = normalizeReportingTitle(r.reporting_to);
    reportCounts[title] = (reportCounts[title] ?? 0) + 1;
  }
  const topReporting = Object.entries(reportCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([title, count]) => ({ title, count, pct: (count / records.length) * 100 }));

  // Function frequency
  const fnCounts: Record<string, number> = {};
  for (const r of records) {
    for (const fn of r.functions) {
      fnCounts[fn] = (fnCounts[fn] ?? 0) + 1;
    }
  }
  const topFunctions = Object.entries(fnCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, pct: (count / records.length) * 100 }));

  return {
    team_size_p25: tsvs.length > 0 ? weightedPercentile(tsvs, tsws, 25) : 0,
    team_size_p50: tsvs.length > 0 ? weightedPercentile(tsvs, tsws, 50) : 0,
    team_size_p75: tsvs.length > 0 ? weightedPercentile(tsvs, tsws, 75) : 0,
    team_size_n:   tsvs.length,
    top_reporting_lines: topReporting,
    top_functions:       topFunctions,
  };
}

function normalizeReportingTitle(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (upper.includes('CEO') || upper.includes('CHIEF EXECUTIVE')) return 'CEO';
  if (upper.includes('CIO') || upper.includes('CHIEF INFORMATION OFF')) return 'CIO';
  if (upper.includes('CTO') || upper.includes('CHIEF TECHNOLOGY')) return 'CTO';
  if (upper.includes('CISO') || upper.includes('CHIEF INFORMATION SECURITY')) return 'CISO';
  if (upper.includes('COO') || upper.includes('CHIEF OPERATING')) return 'COO';
  if (upper.includes('CFO') || upper.includes('CHIEF FINANCIAL')) return 'CFO';
  if (upper.includes('CPO') || upper.includes('CHIEF PRIVACY')) return 'CPO';
  if (upper === 'GC' || upper.includes('GENERAL COUNSEL') || upper.endsWith(' CLO') || upper.includes(' CLO ')) return 'General Counsel';
  if (upper.includes('BOARD') || upper.includes('AUDIT COMMITTEE')) return 'Board/Audit Committee';
  return raw.trim().substring(0, 40);
}

// ---------------------------------------------------------------------------
// FSS calculation
// ---------------------------------------------------------------------------
function calcFSS(
  records: WeightedRecord[],
  selectedFunctions: string[],
): FSSResult {
  const candidateScore = calculateFSS(selectedFunctions);

  // Compute FSS for every record in the filtered peer set
  const peerScores = records.map(r => calculateFSS(r.functions));
  const weights = records.map(r => r.recency_weight);

  const dist = {
    p25: weightedPercentile(peerScores, weights, 25),
    p50: weightedPercentile(peerScores, weights, 50),
    p75: weightedPercentile(peerScores, weights, 75),
    p90: weightedPercentile(peerScores, weights, 90),
  };

  const label = getFSSLabel(candidateScore, dist);

  // Percentile position of candidate score in peer distribution
  const below = peerScores.filter((s, i) =>
    s < candidateScore ? weights[i] : 0,
  );
  const totalW = weights.reduce((s, w) => s + w, 0);
  const belowW = peerScores.reduce((s, score, i) => s + (score < candidateScore ? weights[i] : 0), 0);
  const peer_percentile = totalW > 0 ? Math.round((belowW / totalW) * 100) : 50;

  // Tier 1 analysis
  const tier1_owned = TIER1_FUNCTIONS.filter(fn => selectedFunctions.includes(fn));
  const tier1_missing = TIER1_FUNCTIONS.filter(
    fn => !selectedFunctions.includes(fn) && !FLAGGED_NEUTRAL_FUNCTIONS.has(fn),
  );

  const justification = buildFSSJustification(label, peer_percentile, tier1_owned, tier1_missing);

  return { score: candidateScore, label, peer_percentile, peer_distribution: dist, tier1_owned, tier1_missing, justification };
}

function buildFSSJustification(
  label: string,
  peerPct: number,
  owned: string[],
  missing: string[],
): string {
  if (label === 'Broad' || label === 'Expansive') {
    const highlight = owned.slice(0, 2).join(' and ');
    return `This role's functional scope exceeds ${peerPct}% of comparable CISO positions. Ownership of ${highlight || 'high-impact functions'} supports an offer in the P65–P80 range.`;
  }
  if (label === 'Standard') {
    return `This role's functional scope is consistent with ${peerPct}% of comparable peers. The scope profile supports a market-rate offer in the P40–P60 range.`;
  }
  return `This role's functional scope is narrower than ${100 - peerPct}% of comparable peers. If this reflects a focused mandate, a P25–P40 offer is defensible. If scope is expected to expand post-hire, consider structuring at P50 with a scope-based review trigger.`;
}

// ---------------------------------------------------------------------------
// Candidate position (offer mode)
// ---------------------------------------------------------------------------
function calcCandidatePercentile(value: number, records: WeightedRecord[], field: 'total_comp' | 'base_salary'): number {
  const values = records.map(r => {
    if (field === 'base_salary') return r.base_salary ?? 0;
    return (r.base_salary ?? 0) + (r.bonus ?? 0) + (r.equity ?? 0);
  });
  const weights = records.map(r => r.recency_weight);
  const totalW = weights.reduce((s, w) => s + w, 0);
  const belowW = values.reduce((s, v, i) => s + (v < value ? weights[i] : 0), 0);
  return totalW > 0 ? Math.round((belowW / totalW) * 100) : 50;
}

// ---------------------------------------------------------------------------
// Main query entry point
// ---------------------------------------------------------------------------
export function executeQuery(params: QueryParams): QueryResult {
  const allRecords = loadSurveyData();
  const allWeighted = applyRecencyWeights(allRecords);

  // Apply filters with progressive relaxation
  const { filtered, log } = progressiveRelax(allWeighted, params);

  const raw_n = filtered.length;
  const weighted_n = weightedEffectiveN(filtered.map(r => r.recency_weight));
  const confidence = getConfidence(weighted_n);

  // Comp bands — dual pass
  const comp_bands = calcCompBands(filtered);
  const benchmark_comp = calcCompBands(allWeighted);
  const profile_comp = comp_bands;
  const benchmark_n = allWeighted.length;
  const profile_n = raw_n;

  // Governance
  const governance = calcGovernance(filtered);

  // Org structure
  const org_structure = calcOrgStructure(filtered);

  // FSS (only if functions selected)
  const fss: FSSResult | null =
    params.selected_functions && params.selected_functions.length > 0
      ? calcFSS(filtered, params.selected_functions)
      : null;

  // Candidate position (offer mode)
  const candidate = params.mode === 'offer' &&
    (params.candidate_base || params.candidate_bonus || params.candidate_equity)
    ? (() => {
        const base = params.candidate_base ?? 0;
        const bonus = params.candidate_bonus ?? 0;
        const equity = params.candidate_equity ?? 0;
        const total_comp = base + bonus + equity;
        return {
          base_value: base,
          bonus_value: bonus,
          equity_value: equity,
          total_cash: base + bonus,
          total_comp,
          base_percentile: base > 0 ? calcCandidatePercentile(base, filtered, 'base_salary') : null,
          total_comp_percentile: total_comp > 0 ? calcCandidatePercentile(total_comp, filtered, 'total_comp') : null,
        };
      })()
    : null;

  // Filters applied
  const filters_applied: AppliedFilters = {
    role_tier: params.role_tier,
    industry: params.industry ?? null,
    company_structure: params.company_structure ?? null,
    size_bucket: params.size_bucket ?? null,
    metro_tier: params.metro_tier ?? null,
  };

  // Statement
  const statement = generateStatement({
    mode: params.mode,
    comp_bands,
    governance,
    fss,
    candidate,
    filters_applied,
    confidence,
  });

  return {
    confidence,
    raw_n,
    weighted_n,
    relaxation_log: log,
    comp_bands,
    benchmark_comp,
    profile_comp,
    benchmark_n,
    profile_n,
    governance,
    org_structure,
    fss,
    statement,
    candidate,
    filters_applied,
    query_params: params,
  };
}
