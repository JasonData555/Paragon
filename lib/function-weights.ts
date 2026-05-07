import { FSS_DIMINISHING_RETURNS_FACTOR, FSS_DIMINISHING_RETURNS_THRESHOLD } from './constants';
import type { FSSLabel } from './types';

// ---------------------------------------------------------------------------
// FSS weight tiers (empirically derived, n=922)
// ---------------------------------------------------------------------------
export const FUNCTION_WEIGHTS: Record<string, number> = {
  // Tier 1 — High Impact (r > 0.10, p < 0.001)
  'Product Security / AppSec':                    1.5,
  'Cloud Security':                               1.5,
  'Fraud':                                        1.5,
  'Security Operations':                          1.5,

  // Tier 2 — Moderate Impact (r = 0.06–0.10)
  'Corp IT Security / Enterprise Security':       1.2,
  'GRC':                                          1.2,
  'AI/ML Security Engineering':                   1.2,
  'Incident Response':                            1.2,
  'AI Threat Intelligence and Incident Response': 1.2,
  'Information Technology / BizApps':             1.2,
  'Post-Quantum Cryptography (PQC)':              1.2,
  'Identity and Access Management / IAM':         1.2,

  // Tier 3 — Neutral (r < 0.06, not statistically significant)
  'Third Party Risk Management (TPRM)':           1.0,
  'Infrastructure Engineering / Operations':      1.0,
  'Physical Security / Executive Protection':     1.0,
  'AI Safety and Reliability':                    1.0,
  'AI Security and Safety':                       1.0,
  'Trust and Safety':                             1.0,

  // Flagged Neutral — negative raw correlators, no penalty, not surfaced as missing
  'Enterprise Risk':                              1.0,
  'Privacy':                                      1.0,
  'AI Ethics and Responsible Use':                1.0,
  'AI Governance Risk Management and Policy':     1.0,
};

// Tier 1 functions for the "owned vs missing" analysis in FSSCard
export const TIER1_FUNCTIONS = [
  'Product Security / AppSec',
  'Cloud Security',
  'Fraud',
  'Security Operations',
];

// Functions flagged as neutral (negative raw correlators) — do NOT surface as "missing"
export const FLAGGED_NEUTRAL_FUNCTIONS = new Set([
  'Enterprise Risk',
  'Privacy',
  'AI Ethics and Responsible Use',
  'AI Governance Risk Management and Policy',
]);

// UI function columns (3-column multi-select pill grid)
export const UI_FUNCTIONS = {
  col1: [
    'Product Security / AppSec',
    'Cloud Security',
    'AI/ML Security Engineering',
    'Incident Response',
    'Identity and Access Management / IAM',
    'Post-Quantum Cryptography (PQC)',
    'Infrastructure Engineering / Operations',
    'Trust and Safety',
  ],
  col2: [
    'GRC',
    'AI Threat Intelligence and Incident Response',
    'Information Technology / BizApps',
    'Third Party Risk Management (TPRM)',
    'AI Safety and Reliability',
    'AI Security and Safety',
    'Enterprise Risk',
    'Privacy',
  ],
  col3: [
    'Security Operations',
    'Fraud',
    'Corp IT Security / Enterprise Security',
    'Physical Security / Executive Protection',
    'AI Ethics and Responsible Use',
    'AI Governance Risk Management and Policy',
  ],
} as const;

export const ALL_UI_FUNCTIONS = [
  ...UI_FUNCTIONS.col1,
  ...UI_FUNCTIONS.col2,
  ...UI_FUNCTIONS.col3,
];

// Max possible FSS score (all 22 functions, first 13 full weight, rest at 50%)
// Sorted by weight: 4×1.5 + 8×1.2 + 1×1.0 full, then 9×1.0 at 50%
// = 6.0 + 9.6 + 1.0 = 16.6 (first 13) + 9×1.0×0.5 = 4.5 → total = 21.1
export const MAX_FSS_SCORE = (() => {
  return calculateFSS(ALL_UI_FUNCTIONS);
})();

export function calculateFSS(selectedFunctions: string[]): number {
  const weights = selectedFunctions
    .map(fn => FUNCTION_WEIGHTS[fn] ?? 1.0)
    .sort((a, b) => b - a);

  return weights.reduce((sum, weight, index) => {
    const effective = index < FSS_DIMINISHING_RETURNS_THRESHOLD
      ? weight
      : weight * FSS_DIMINISHING_RETURNS_FACTOR;
    return sum + effective;
  }, 0);
}

export function getFSSLabel(score: number, dist: { p25: number; p75: number; p90: number }): FSSLabel {
  if (score < dist.p25) return 'Narrow';
  if (score <= dist.p75) return 'Standard';
  if (score <= dist.p90) return 'Broad';
  return 'Expansive';
}
