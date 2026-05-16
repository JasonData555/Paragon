import { calculateFSS } from './function-weights';
import { weightedPercentile } from './recency-weights';
import {
  REPORTING_POINTS,
  BOARD_POINTS,
  SIZE_POINTS,
  INDUSTRY_POINTS,
  RCI_WEIGHTS,
} from './constants';
import type {
  GovernanceCombinationResult,
  PeerPISPoint,
  PISResult,
  PercentileBand,
  ProtectionKey,
  QuadrantLabel,
  RCIProfile,
  WeightedRecord,
} from './types';

// ---------------------------------------------------------------------------
// RCI — Role Complexity Index (0–100)
// ---------------------------------------------------------------------------

function getReportingPts(reportingLine: string | undefined | null): number {
  if (!reportingLine) return 0;
  const lower = reportingLine.toLowerCase();
  // Sort by specificity — check longer/more specific keys first
  const sorted = Object.entries(REPORTING_POINTS).sort((a, b) => b[0].length - a[0].length);
  for (const [key, pts] of sorted) {
    if (lower.includes(key.toLowerCase())) return pts;
  }
  return 0;
}

function getBoardPts(boardFrequency: string | undefined | null): number {
  if (!boardFrequency) return 0;
  return BOARD_POINTS[boardFrequency] ?? 0;
}

function getSizePts(sizeBucket: string | undefined | null): number {
  if (!sizeBucket) return 0;
  return SIZE_POINTS[sizeBucket] ?? 0;
}

function getIndustryPts(industry: string | undefined | null): number {
  if (!industry) return 8;
  return INDUSTRY_POINTS[industry] ?? 8;
}

export function calcRCI(
  reportingLine: string | undefined | null,
  boardFrequency: string | undefined | null,
  sizeBucket: string | undefined | null,
  industry: string | undefined | null,
): RCIProfile {
  const reporting_pts = getReportingPts(reportingLine);
  const board_pts = getBoardPts(boardFrequency);
  const size_pts = getSizePts(sizeBucket);
  const industry_pts = getIndustryPts(industry);

  const rci_raw =
    reporting_pts * RCI_WEIGHTS.reporting +
    board_pts     * RCI_WEIGHTS.board +
    size_pts      * RCI_WEIGHTS.size +
    industry_pts  * RCI_WEIGHTS.industry;

  const rci_score = Math.min(100, rci_raw);
  const rci_multiplier = 0.5 + (rci_score / 100) * 1.5;

  return { reporting_pts, board_pts, size_pts, industry_pts, rci_raw, rci_score, rci_multiplier };
}

// ---------------------------------------------------------------------------
// PIS — Paragon Intensity Score
// ---------------------------------------------------------------------------

export function calcPIS(fss: number, rciMultiplier: number): number {
  return fss * rciMultiplier;
}

// ---------------------------------------------------------------------------
// Quadrant classification (relative to matched peer medians)
// ---------------------------------------------------------------------------

export function classifyQuadrant(
  fss: number,
  rciScore: number,
  peerFSSMedian: number,
  peerRCIMedian: number,
): QuadrantLabel {
  const highFSS = fss >= peerFSSMedian;
  const highRCI = rciScore >= peerRCIMedian;
  if (highFSS && highRCI)  return 'Paragon Leader';
  if (highFSS && !highRCI) return 'Utility Player';
  if (!highFSS && highRCI) return 'Specialist Surgeon';
  return 'Generalist';
}

// ---------------------------------------------------------------------------
// Per-record helpers (for scatter plot peer dots)
// ---------------------------------------------------------------------------

export function calcRecordFSS(record: WeightedRecord): number {
  return calculateFSS(record.functions);
}

export function calcRecordRCI(record: WeightedRecord): number {
  const profile = calcRCI(record.reporting_to, record.board_frequency, record.size_bucket, record.industry);
  return profile.rci_score;
}

// ---------------------------------------------------------------------------
// Full PIS result for the current query profile
// ---------------------------------------------------------------------------

export function buildPISResult(
  fss: number,
  rci: RCIProfile,
  pis: number,
  quadrant: QuadrantLabel,
  peerFSSMedian: number,
  peerRCIMedian: number,
  pisPercentile: number,
  peerPoints: PeerPISPoint[],
): PISResult {
  return {
    fss,
    rci,
    pis,
    quadrant,
    quadrant_peer_fss_median: peerFSSMedian,
    quadrant_peer_rci_median: peerRCIMedian,
    pis_percentile: pisPercentile,
    peer_points: peerPoints,
  };
}

// ---------------------------------------------------------------------------
// Governance matrix — precompute all 15 non-empty subsets
// ---------------------------------------------------------------------------

const ALL_PROTECTIONS: ProtectionKey[] = ['do', 'indemnification', 'severance', 'accel_vest'];

function subsetKey(keys: ProtectionKey[]): string {
  return [...keys].sort().join('+');
}

function protectionField(key: ProtectionKey): keyof WeightedRecord {
  const map: Record<ProtectionKey, keyof WeightedRecord> = {
    do: 'has_do',
    indemnification: 'has_indemnification',
    severance: 'has_severance',
    accel_vest: 'has_accel_vest',
  };
  return map[key];
}

function simpleMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calcTCPercentileBand(records: WeightedRecord[]): PercentileBand | null {
  if (records.length === 0) return null;
  const tcs = records.map(r => (r.base_salary ?? 0) + (r.bonus ?? 0) + (r.equity ?? 0));
  const ws = records.map(r => r.recency_weight);
  return {
    p10: weightedPercentile(tcs, ws, 10),
    p25: weightedPercentile(tcs, ws, 25),
    p50: weightedPercentile(tcs, ws, 50),
    p75: weightedPercentile(tcs, ws, 75),
    p90: weightedPercentile(tcs, ws, 90),
    sample_n: records.length,
  };
}

function calcCombination(
  records: WeightedRecord[],
  subset: ProtectionKey[],
): GovernanceCombinationResult {
  const fields = subset.map(protectionField);

  const withRecords = records.filter(r => fields.every(f => r[f] === true));
  const withoutRecords = records.filter(r => fields.every(f => r[f] === false));

  const n_with = withRecords.length;
  const n_without = withoutRecords.length;
  const insufficient_data = n_with < 5 || n_without < 5;

  const tcOf = (recs: WeightedRecord[]): number | null => {
    if (recs.length === 0) return null;
    const tcs = recs.map(r => (r.base_salary ?? 0) + (r.bonus ?? 0) + (r.equity ?? 0));
    return simpleMedian(tcs);
  };

  const median_tc_with = tcOf(withRecords);
  const median_tc_without = tcOf(withoutRecords);
  const delta =
    median_tc_with !== null && median_tc_without !== null
      ? median_tc_with - median_tc_without
      : null;

  const tc_distribution = calcTCPercentileBand(withRecords);

  return {
    selected_protections: subset,
    n_with,
    n_without,
    median_tc_with,
    median_tc_without,
    delta,
    prevalence: records.length > 0 ? n_with / records.length : 0,
    insufficient_data,
    tc_distribution,
  };
}

export function precomputeGovernanceMatrix(
  records: WeightedRecord[],
): Record<string, GovernanceCombinationResult> {
  const matrix: Record<string, GovernanceCombinationResult> = {};

  // All 15 non-empty subsets of 4 protections
  for (let mask = 1; mask < 16; mask++) {
    const subset: ProtectionKey[] = [];
    for (let bit = 0; bit < 4; bit++) {
      if (mask & (1 << bit)) subset.push(ALL_PROTECTIONS[bit]);
    }
    const key = subsetKey(subset);
    matrix[key] = calcCombination(records, subset);
  }

  return matrix;
}
